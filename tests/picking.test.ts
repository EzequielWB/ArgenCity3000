import { describe, expect, it } from 'vitest';
import { toView, type Rotation } from '../src/core/iso';
import { cellScreenCorners, pickCell, surfaceHeights } from '../src/render/geometry';
import { generateTerrain, SEA_LEVEL } from '../src/world/terrain';
import { World, TILE } from '../src/world/world';

function centre(poly: [number, number][]): [number, number] {
  return [(poly[0][0] + poly[2][0]) / 2, (poly[0][1] + poly[2][1]) / 2];
}

describe('bridge decks', () => {
  /** Flat land two levels above the sea, with a lake where the corners from 6 to 9 are low. */
  function lake(): World {
    const n = 16;
    const s = n + 1;
    const corners = new Uint8Array(s * s).fill(SEA_LEVEL + 2);
    for (let cy = 0; cy < s; cy++) for (let cx = 6; cx <= 9; cx++) corners[cy * s + cx] = SEA_LEVEL - 2;
    return new World({ n, corners, trees: new Uint8Array(n * n) });
  }

  it('rides flat above the water and lands on the bank it reaches', () => {
    const w = lake();
    for (let x = 2; x <= 14; x++) w.setTile(x, 8, TILE.ROAD);
    const deck = SEA_LEVEL + 0.75;
    const bank = SEA_LEVEL + 2;
    let wet = 0;
    let ramps = 0;
    for (let x = 2; x <= 14; x++) {
      if (!w.isWater(x, 8)) {
        expect(surfaceHeights(w, x, 8, 0)).toEqual([bank, bank, bank, bank]);
        continue;
      }
      wet++;
      const hs = surfaceHeights(w, x, 8, 0);
      const landLeft = !w.isWater(x - 1, 8);
      const landRight = !w.isWater(x + 1, 8);
      if (!landLeft && !landRight) {
        expect(hs, `celda ${x}`).toEqual([deck, deck, deck, deck]);
        continue;
      }
      ramps++;
      // Corner order is top, right, bottom, left: the side that reaches land takes its height.
      if (landLeft) {
        expect(hs[0]).toBe(bank);
        expect(hs[3]).toBe(bank);
      }
      if (landRight) {
        expect(hs[1]).toBe(bank);
        expect(hs[2]).toBe(bank);
      }
      expect(hs.some((h) => h === deck)).toBe(true);
    }
    expect(wet).toBeGreaterThan(2);
    expect(ramps).toBe(2);
  });

  it('keeps water without a road flat at sea level', () => {
    const w = lake();
    expect(surfaceHeights(w, 7, 3, 0)).toEqual([SEA_LEVEL, SEA_LEVEL, SEA_LEVEL, SEA_LEVEL]);
  });
});

describe('pickCell', () => {
  const rotations: Rotation[] = [0, 1, 2, 3];
  const w = new World(generateTerrain(42, 48));

  it('returns the cell under the centre of its own surface on real relief, in every rotation', () => {
    let checked = 0;
    for (const rot of rotations) {
      for (let y = 2; y < 46; y += 3) {
        for (let x = 2; x < 46; x += 3) {
          const [vx, vy] = toView(x, y, rot, w.n);
          const [cx, cy] = centre(cellScreenCorners(w, vx, vy, rot));
          const picked = pickCell(w, cx, cy + 2, rot);
          // A taller cell in front may hide the centre; then the pick must be one of the front neighbours.
          const front = (picked?.[0] ?? -1) !== x || (picked?.[1] ?? -1) !== y;
          if (front) {
            const [px, py] = toView(picked![0], picked![1], rot, w.n);
            expect(px + py).toBeGreaterThan(vx + vy);
          } else checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(rotations.length * 150);
  });

  it('returns null outside the map', () => {
    expect(pickCell(w, -100000, -100000, 0)).toBeNull();
    expect(pickCell(w, 0, 100000, 0)).toBeNull();
  });

  it('levels building lots at their highest corner and keeps water flat', () => {
    const t = new World(generateTerrain(3, 32));
    let lot = -1;
    for (let i = 0; i < 32 * 32 && lot < 0; i++) {
      const x = i % 32;
      const y = Math.floor(i / 32);
      const [min, max] = t.minMax(x, y);
      if (!t.isWater(x, y) && min !== max) lot = i;
    }
    expect(lot).toBeGreaterThanOrEqual(0);
    const x = lot % 32;
    const y = Math.floor(lot / 32);
    t.setTile(x, y, TILE.R, 2);
    const hs = surfaceHeights(t, x, y, 0);
    expect(new Set(hs).size).toBe(1);
    expect(hs[0]).toBe(t.minMax(x, y)[1]);
    for (let i = 0; i < 32 * 32; i++) {
      const wx = i % 32;
      const wy = Math.floor(i / 32);
      if (t.isWater(wx, wy)) {
        expect(surfaceHeights(t, wx, wy, 0)).toEqual([SEA_LEVEL, SEA_LEVEL, SEA_LEVEL, SEA_LEVEL]);
        break;
      }
    }
  });
});
