import { describe, expect, it } from 'vitest';
import type { Pixels } from '../src/render/pixel';
import { boatArt, headingOf, planeArt, roadVehicle } from '../src/render/vehicleArt';

/** The painted pixels of a vehicle, as the painter leaves them: no canvas is needed to judge them. */
const painted = (kind: 'car' | 'taxi' | 'bus', color: number, dir: 0 | 1 | 2 | 3): Pixels => roadVehicle(kind, color, dir).px;

const opaque = (px: Pixels): number => {
  let n = 0;
  for (let i = 3; i < px.data.length; i += 4) if (px.data[i]) n++;
  return n;
};

describe('the heading of a vehicle', () => {
  it('turns each of the four steps of the grid into its own heading', () => {
    expect([headingOf(1, 0), headingOf(0, 1), headingOf(-1, 0), headingOf(0, -1)]).toEqual([0, 1, 2, 3]);
    // Two steps that are not a step of the grid still land on a heading, never on nothing.
    expect([headingOf(0, 0), headingOf(2, 0), headingOf(-3, 0)]).toEqual([3, 0, 2]);
  });
});

describe('the road vehicles in pixel', () => {
  it('draws a different vehicle for each heading instead of rotating one', () => {
    for (const kind of ['car', 'taxi', 'bus'] as const) {
      const drawn = [0, 1, 2, 3].map((dir) => Array.from(painted(kind, 0, dir as 0 | 1 | 2 | 3).data).join(','));
      // The four of them are kept apart by their own drawing, not by a rotation at paint time.
      expect(new Set(drawn).size).toBe(4);
    }
  });

  it('paints hard pixels, and only the shadow is allowed to be half transparent', () => {
    for (const dir of [0, 1, 2, 3] as const) {
      const px = painted('car', 0, dir);
      let count = 0;
      for (let i = 0; i < px.data.length; i += 4) {
        const a = px.data[i + 3];
        if (a === 0) continue;
        count++;
        if (a === 255) continue;
        expect(a).toBeLessThanOrEqual(96);
        expect([px.data[i], px.data[i + 1], px.data[i + 2]]).toEqual([0, 0, 0]);
      }
      expect(count).toBeGreaterThan(10);
    }
  });

  it('draws the boats with a hull, a deck and the four headings', () => {
    for (const kind of ['fishing', 'tour', 'cruise'] as const) {
      const drawn = [0, 1, 2, 3].map((dir) => Array.from(boatArt(kind, dir as 0 | 1 | 2 | 3).px.data).join(','));
      expect(new Set(drawn).size).toBe(4);
      expect(opaque(boatArt(kind, 0).px)).toBeGreaterThan(30);
    }
    // A cruise ship is a lot more boat than a fishing boat.
    expect(opaque(boatArt('cruise', 0).px)).toBeGreaterThan(opaque(boatArt('fishing', 0).px) * 2);
  });

  it('draws the planes bigger with the level of their airport', () => {
    const level1 = opaque(planeArt(1, 0).px);
    const level5 = opaque(planeArt(5, 0).px);
    expect(level5).toBeGreaterThan(level1 * 2);
    const drawn = [0, 1, 2, 3].map((dir) => Array.from(planeArt(3, dir as 0 | 1 | 2 | 3).px.data).join(','));
    expect(new Set(drawn).size).toBe(4);
  });

  it('paints the same thing twice for the same vehicle, and a different colour for another line', () => {
    expect(Array.from(painted('bus', 2, 1).data)).toEqual(Array.from(painted('bus', 2, 1).data));
    expect(Array.from(painted('bus', 2, 1).data)).not.toEqual(Array.from(painted('bus', 3, 1).data));
    // The bus of a line is longer than a car, and that shows in how much is painted.
    expect(opaque(painted('bus', 0, 0))).toBeGreaterThan(opaque(painted('car', 0, 0)));
  });
});
