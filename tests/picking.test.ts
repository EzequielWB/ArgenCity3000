import { describe, expect, it } from 'vitest';
import { toView, type Rotation } from '../src/core/iso';
import { cellScreenCorners, pickCell, surfaceHeights } from '../src/render/geometry';
import { generateTerrain, SEA_LEVEL } from '../src/world/terrain';
import { World, TILE } from '../src/world/world';

function centre(poly: [number, number][]): [number, number] {
  return [(poly[0][0] + poly[2][0]) / 2, (poly[0][1] + poly[2][1]) / 2];
}

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
