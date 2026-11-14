import { describe, expect, it } from 'vitest';
import { toView, type Rotation } from '../src/core/iso';
import { bridgeDeckHeight, cellScreenCorners, pickCell, surfaceHeights } from '../src/render/geometry';
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

  it('rides the whole span at the height of its higher bank, so it meets the land at both ends', () => {
    const w = lake();
    for (let x = 2; x <= 14; x++) w.setTile(x, 8, TILE.ROAD);
    const bank = SEA_LEVEL + 2;
    let bridges = 0;
    for (let x = 2; x <= 14; x++) {
      if (!w.isWater(x, 8)) continue;
      bridges++;
      expect(surfaceHeights(w, x, 8, 0), `celda ${x}`).toEqual([bank, bank, bank, bank]);
    }
    expect(bridges).toBeGreaterThan(2);
  });

  it('takes the higher bank when the two ends are at different heights', () => {
    const w = lake();
    // Raise the eastern bank two levels: the deck follows it.
    for (let cy = 0; cy <= 16; cy++) for (let cx = 10; cx <= 16; cx++) w.terrain.corners[cy * 17 + cx] = SEA_LEVEL + 4;
    for (let x = 2; x <= 14; x++) w.setTile(x, 8, TILE.ROAD);
    expect(bridgeDeckHeight(w, 8, 8)).toBe(SEA_LEVEL + 4);
  });

  it('lifts the land cell at each end of the bridge into the rise up to the deck', () => {
    const w = lake();
    // The eastern bank sits two levels higher, so the deck lands there and the west end climbs.
    for (let cy = 0; cy <= 16; cy++) for (let cx = 10; cx <= 16; cx++) w.terrain.corners[cy * 17 + cx] = SEA_LEVEL + 4;
    for (let x = 2; x <= 14; x++) w.setTile(x, 8, TILE.ROAD);
    const deck = SEA_LEVEL + 4;
    const low = SEA_LEVEL + 2;
    // Corner order top, right, bottom, left: only the side facing the bridge is lifted.
    expect(surfaceHeights(w, 4, 8, 0)).toEqual([low, deck, deck, low]);
    expect(surfaceHeights(w, 5, 8, 0)).toEqual([deck, deck, deck, deck]);
    // The far end is already at the deck, so nothing moves there.
    expect(surfaceHeights(w, 9, 8, 0)).toEqual([deck, deck, deck, deck]);
    // The street past the rise keeps its own ground, one cell away from the bridge.
    expect(surfaceHeights(w, 3, 8, 0)).toEqual([low, low, low, low]);
  });

  it('keeps water without a road flat at sea level', () => {
    const w = lake();
    expect(surfaceHeights(w, 7, 3, 0)).toEqual([SEA_LEVEL, SEA_LEVEL, SEA_LEVEL, SEA_LEVEL]);
  });

  it('does not move the ground under the bridge', () => {
    const w = lake();
    const before = w.terrain.corners.slice();
    for (let x = 2; x <= 14; x++) w.setTile(x, 8, TILE.ROAD);
    expect(Array.from(w.terrain.corners)).toEqual(Array.from(before));
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
