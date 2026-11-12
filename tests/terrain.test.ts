import { describe, expect, it } from 'vitest';
import { SEA_LEVEL, generateTerrain, isWaterCell, cornerAt, cellMinMax } from '../src/world/terrain';

const N = 64;

describe('generateTerrain', () => {
  const t = generateTerrain(1234, N);

  it('is deterministic for the same seed', () => {
    const u = generateTerrain(1234, N);
    expect(Array.from(u.corners)).toEqual(Array.from(t.corners));
    expect(Array.from(u.trees)).toEqual(Array.from(t.trees));
  });

  it('changes with the seed', () => {
    const u = generateTerrain(999, N);
    expect(Array.from(u.corners)).not.toEqual(Array.from(t.corners));
  });

  it('keeps neighbouring corners (8-neighbourhood) within one height step', () => {
    const s = N + 1;
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const h = cornerAt(t, x, y);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= s || ny >= s) continue;
            expect(Math.abs(h - cornerAt(t, nx, ny))).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it('never digs below the flat water bed', () => {
    for (const h of t.corners) expect(h).toBeGreaterThanOrEqual(SEA_LEVEL - 1);
  });

  it('water cells only touch the sea surface (corners at bed or sea level)', () => {
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (!isWaterCell(t, x, y)) continue;
        const [, max] = cellMinMax(t, x, y);
        expect(max).toBeLessThanOrEqual(SEA_LEVEL);
      }
    }
  });

  it('has both land and water, with the coast on the east edge', () => {
    let water = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (isWaterCell(t, x, y)) water++;
    const frac = water / (N * N);
    expect(frac).toBeGreaterThan(0.08);
    expect(frac).toBeLessThan(0.6);
    let eastWater = 0;
    for (let y = 0; y < N; y++) if (isWaterCell(t, N - 1, y)) eastWater++;
    expect(eastWater).toBeGreaterThan(N * 0.8);
  });

  it('only places trees on land', () => {
    let trees = 0;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const tree = t.trees[y * N + x];
        if (tree) {
          trees++;
          expect(isWaterCell(t, x, y)).toBe(false);
        }
      }
    }
    expect(trees).toBeGreaterThan(0);
  });
});
