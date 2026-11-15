import { describe, expect, it } from 'vitest';
import { MAP_SIZE, MAP_SIZES, PLAYABLE_SIZES } from '../src/config';
import { hashString } from '../src/core/rng';
import { MAP_KINDS, generateMap, terrainStats, type MapKind } from '../src/world/mapkinds';
import { GROUND_TOP, MAX_HEIGHT, SEA_LEVEL, cellMinMax, cornerAt, generateTerrain, isWaterCell, type Terrain } from '../src/world/terrain';

function checksum(t: Terrain): string {
  return hashString(Array.from(t.corners).join(',') + '|' + Array.from(t.trees).join(',')).toString(16);
}

/** Checksums of the coast generator before map kinds existed: it must never change. */
const COAST_PINS: Record<string, string> = {
  '1@64': '40e137eb',
  '7@64': '2465f996',
  '42@64': '687866a1',
  '1@128': '3399cc98',
  '7@128': 'f8b7d2db',
  '42@128': '9d8cc86b',
};

const KINDS: MapKind[] = ['coast', 'plain', 'relief', 'sierras'];

describe('map sizes', () => {
  it('keeps the small map at the historical 128 and offers growing sizes', () => {
    expect(MAP_SIZE).toBe(128);
    expect(MAP_SIZES.small).toBe(MAP_SIZE);
    expect(MAP_SIZES.medium).toBeGreaterThan(MAP_SIZES.small);
    expect(MAP_SIZES.large).toBeGreaterThan(MAP_SIZES.medium);
  });
});

describe('playable sizes', () => {
  it('always include the small map and only known sizes', () => {
    expect(PLAYABLE_SIZES).toContain('small');
    for (const id of PLAYABLE_SIZES) expect(MAP_SIZES[id]).toBeGreaterThan(0);
  });
});

describe('terrainStats', () => {
  it('counts land, flat land, the highest corner and the largest flat area', () => {
    // 4×4 cells: flat land at height 5 everywhere except a water column and one sloped cell.
    const n = 4;
    const s = n + 1;
    const corners = new Uint8Array(s * s).fill(5);
    for (let y = 0; y < s; y++) corners[y * s] = SEA_LEVEL - 1; // water bed on the west column of corners
    for (let y = 0; y < s; y++) corners[y * s + 1] = SEA_LEVEL; // shore, so no cell jumps by more than a step
    corners[2 * s + 3] = 6; // lifts one corner: 4 cells around it stop being flat
    const t: Terrain = { n, corners, trees: new Uint8Array(n * n) };
    const st = terrainStats(t);
    expect(st.maxHeight).toBe(6);
    expect(st.landPct).toBe(75); // the first column of cells is water
    // The shore column slopes (3 vs 5) and the lifted corner spoils the 2×2 cells around it: two flat
    // pairs are left, one on the top row and one on the bottom row, 2 cells each.
    expect(st.flatPct).toBeCloseTo((100 * 4) / 12, 5);
    expect(st.largestFlatPct).toBe(12.5);
  });
});

describe('coast kind', () => {
  for (const [key, pin] of Object.entries(COAST_PINS)) {
    const [seed, n] = key.split('@').map(Number);
    it(`reproduces the original generator for seed ${seed} at ${n}`, () => {
      expect(checksum(generateTerrain(seed, n))).toBe(pin);
      expect(checksum(generateMap(seed, n, 'coast'))).toBe(pin);
    });
  }

  it('is the default kind', () => {
    expect(checksum(generateMap(7, 64))).toBe(COAST_PINS['7@64']);
  });
});

describe('every kind', () => {
  for (const kind of KINDS) {
    describe(kind, () => {
      const n = 96;
      const t = generateMap(5, n, kind);

      it('has a label for the start screen', () => {
        expect(MAP_KINDS.find((k) => k.id === kind)?.label).toBeTruthy();
      });

      it('is deterministic and changes with the seed', () => {
        expect(checksum(generateMap(5, n, kind))).toBe(checksum(t));
        expect(checksum(generateMap(6, n, kind))).not.toBe(checksum(t));
      });

      it('has the requested size', () => {
        expect(t.n).toBe(n);
        expect(t.corners.length).toBe((n + 1) * (n + 1));
        expect(t.trees.length).toBe(n * n);
      });

      it('keeps neighbouring corners (8-neighbourhood) within one height step', () => {
        const s = n + 1;
        for (let y = 0; y < s; y++) {
          for (let x = 0; x < s; x++) {
            const h = cornerAt(t, x, y);
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= s || ny >= s) continue;
                if (Math.abs(h - cornerAt(t, nx, ny)) > 1) throw new Error(`step > 1 at ${x},${y}`);
              }
            }
          }
        }
      });

      it('stays between the water bed and the maximum height', () => {
        for (const h of t.corners) {
          expect(h).toBeGreaterThanOrEqual(SEA_LEVEL - 1);
          expect(h).toBeLessThanOrEqual(MAX_HEIGHT);
        }
      });

      it('water cells only touch the sea surface and trees only grow on land', () => {
        for (let y = 0; y < n; y++) {
          for (let x = 0; x < n; x++) {
            const water = isWaterCell(t, x, y);
            if (water && cellMinMax(t, x, y)[1] > SEA_LEVEL) throw new Error(`raised water at ${x},${y}`);
            if (water && t.trees[y * n + x]) throw new Error(`tree in water at ${x},${y}`);
          }
        }
        expect(t.trees.some((v) => v > 0)).toBe(true);
      });
    });
  }

  it('makes different maps for the same seed in different kinds', () => {
    const sums = new Set(KINDS.map((k) => checksum(generateMap(3, 64, k))));
    expect(sums.size).toBe(KINDS.length);
  });
});

const SIZES = [MAP_SIZES.small, MAP_SIZES.medium, MAP_SIZES.large];
const SEEDS = [1, 2, 3];

describe('plain kind', () => {
  for (const n of SIZES) {
    it(`is gentle land with little slope at ${n}`, () => {
      for (const seed of SEEDS) {
        const st = terrainStats(generateMap(seed, n, 'plain'));
        expect(st.landPct).toBeGreaterThanOrEqual(92);
        expect(st.flatPct).toBeGreaterThanOrEqual(85);
        expect(st.maxHeight).toBeLessThanOrEqual(SEA_LEVEL + 3);
      }
    });
  }
});

describe('relief kind', () => {
  for (const n of SIZES) {
    it(`has tall peaks and still enough flat land to build at ${n}`, () => {
      for (const seed of SEEDS) {
        const st = terrainStats(generateMap(seed, n, 'relief'));
        expect(st.maxHeight).toBeGreaterThanOrEqual(SEA_LEVEL + 8);
        expect(st.flatPct).toBeGreaterThanOrEqual(30);
        expect(st.landPct).toBeGreaterThanOrEqual(80);
      }
    });
  }
});

/** Share of corners standing above the grass ceiling, in percent: how much of the map is range. */
function rangeShare(t: Terrain): number {
  let high = 0;
  for (const h of t.corners) if (h > GROUND_TOP) high++;
  return (high / t.corners.length) * 100;
}

describe('sierras kind', () => {
  for (const n of SIZES) {
    it(`has ranges that rise above the grass and a valley to build in, at ${n}`, () => {
      for (const seed of SEEDS) {
        const t = generateMap(seed, n, 'sierras');
        const st = terrainStats(t);
        // Taller than any hill of the coastal map: the crests are not cut into a table.
        expect(st.maxHeight).toBeGreaterThan(GROUND_TOP);
        // And a real share of the map climbs above it, not one lonely spike.
        expect(rangeShare(t)).toBeGreaterThan(2);
        expect(st.largestFlatPct).toBeGreaterThanOrEqual(3);
        expect(st.landPct).toBeGreaterThanOrEqual(80);
      }
    });
  }
});

describe('the built-in generators keep their own ceilings', () => {
  it('leaves the coastal map exactly as it was, whatever the world allows', () => {
    for (const seed of SEEDS) {
      const st = terrainStats(generateTerrain(seed, MAP_SIZES.small));
      expect(st.maxHeight).toBe(GROUND_TOP);
      expect(MAX_HEIGHT).toBeGreaterThan(GROUND_TOP);
    }
  });
});

/** Water cells in the outer 12 % band of each edge (east, south, west, north): where a sea would show. */
function waterByEdge(t: Terrain): number[] {
  const n = t.n;
  const band = Math.floor(n * 0.12);
  const edges = [0, 0, 0, 0];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!isWaterCell(t, x, y)) continue;
      if (n - 1 - x < band) edges[0]++;
      if (n - 1 - y < band) edges[1]++;
      if (x < band) edges[2]++;
      if (y < band) edges[3]++;
    }
  }
  return edges;
}

describe('the way to the sea of every invented map', () => {
  for (const kind of ['plain', 'relief', 'sierras'] as const) {
    for (const n of SIZES) {
      it(`${kind} has a bay of sea on one side, at ${n}`, () => {
        for (const seed of [1, 2, 3, 4, 5, 6]) {
          // A stretch of the edge with water on it: far more than the creek that crosses a plain.
          expect(Math.max(...waterByEdge(generateMap(seed, n, kind)))).toBeGreaterThanOrEqual(0.015 * n * n);
        }
      });
    }
  }

  it('is smaller than the sea of the coastal map, which keeps a whole side of water', () => {
    const coast = Math.max(...waterByEdge(generateMap(1, 128, 'coast')));
    for (const kind of ['plain', 'relief', 'sierras'] as const) expect(Math.max(...waterByEdge(generateMap(1, 128, kind)))).toBeLessThan(coast);
  });

  it('opens it on different sides depending on the seed', () => {
    const sides = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => waterByEdge(generateMap(seed, 128, 'sierras')).indexOf(Math.max(...waterByEdge(generateMap(seed, 128, 'sierras'))))));
    expect(sides.size).toBeGreaterThan(1);
  });
});
