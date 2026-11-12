import { hash2 } from '../core/rng';

/** Height of the water surface. Water beds are flat at SEA_LEVEL - 1. */
export const SEA_LEVEL = 3;
export const MAX_HEIGHT = 12;

export interface Terrain {
  /** Cells per side. */
  n: number;
  /** Corner heights, (n + 1) × (n + 1), row-major. */
  corners: Uint8Array;
  /** Tree variant per cell (0 = no tree). */
  trees: Uint8Array;
}

export function cornerAt(t: Terrain, x: number, y: number): number {
  return t.corners[y * (t.n + 1) + x];
}

export function cellCorners(t: Terrain, x: number, y: number): [number, number, number, number] {
  const s = t.n + 1;
  const i = y * s + x;
  return [t.corners[i], t.corners[i + 1], t.corners[i + s + 1], t.corners[i + s]];
}

export function cellMinMax(t: Terrain, x: number, y: number): [number, number] {
  const c = cellCorners(t, x, y);
  return [Math.min(c[0], c[1], c[2], c[3]), Math.max(c[0], c[1], c[2], c[3])];
}

export function isWaterCell(t: Terrain, x: number, y: number): boolean {
  return cellMinMax(t, x, y)[0] < SEA_LEVEL;
}

export function isFlatCell(t: Terrain, x: number, y: number): boolean {
  const [min, max] = cellMinMax(t, x, y);
  return min === max;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Fractal value noise in [0, 1). */
export function fbm(x: number, y: number, seed: number, octaves = 4): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x * f, y * f, seed + o * 1013) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

/**
 * Generates a coastal plain: lomas inland, a wide river along the east edge and a creek
 * winding from the west into it. Corners are constrained so that any two neighbouring
 * corners (diagonals included) differ by at most one level.
 */
export function generateTerrain(seed: number, n: number): Terrain {
  const s = n + 1;
  const corners = new Uint8Array(s * s);
  const raw = new Float32Array(s * s);

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const hills = fbm(x / 34, y / 34, seed);
      const detail = fbm(x / 9, y / 9, seed + 77, 2);
      // Distance to the coast, with a wobbly shoreline.
      const shore = (n - x) / n - 0.12 + (fbm(y / 20, 3.7, seed + 5) - 0.5) * 0.12;
      const coast = Math.max(0, Math.min(1, shore / 0.3));
      const land = smooth(coast);
      const e = (0.62 * hills + 0.18 * detail) * land + 0.42 * land - 0.05;
      raw[y * s + x] = e * (MAX_HEIGHT + 2);
    }
  }

  // Creek: a meandering channel from the west to the coast.
  const creekY0 = n * (0.3 + 0.4 * hash2(1, 2, seed));
  const creekStart = Math.floor(n * 0.08);
  for (let x = creekStart; x < s; x++) {
    const cy = creekY0 + Math.sin(x * 0.08 + seed) * n * 0.07 + (fbm(x / 15, 9.1, seed + 11) - 0.5) * n * 0.15;
    const width = x < creekStart + 6 ? 0.6 : 1.4;
    for (let y = Math.floor(cy - 3); y <= Math.ceil(cy + 3); y++) {
      if (y < 0 || y >= s) continue;
      if (Math.abs(y - cy) <= width) raw[y * s + x] = SEA_LEVEL - 2;
    }
  }

  for (let i = 0; i < raw.length; i++) {
    corners[i] = Math.max(SEA_LEVEL - 1, Math.min(MAX_HEIGHT, Math.round(raw[i])));
  }
  constrainSlopes(corners, s);
  smoothCorners(corners, s);

  const trees = new Uint8Array(n * n);
  const t: Terrain = { n, corners, trees };
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (isWaterCell(t, x, y)) continue;
      const forest = fbm(x / 11, y / 11, seed + 301, 3);
      const r = hash2(x, y, seed + 999);
      if ((forest > 0.66 && r < 0.55) || r < 0.008) {
        trees[y * n + x] = 1 + Math.floor(hash2(y, x, seed + 7) * 4);
      }
    }
  }
  return t;
}

/**
 * Removes the lone one-level bumps and pits that make streets look like roller coasters,
 * keeping hills, slopes and shores: every land corner that does not touch a water cell moves
 * to the median of its 3×3 neighbourhood of land corners, a few times, and then slopes are
 * constrained again. Corners touching water never move, so water stays water and land stays
 * land.
 */
export function smoothCorners(c: Uint8Array, s: number, passes = 2): void {
  const n = s - 1;
  const frozen = new Uint8Array(s * s);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const k = [y * s + x, y * s + x + 1, (y + 1) * s + x, (y + 1) * s + x + 1];
      if (Math.min(c[k[0]], c[k[1]], c[k[2]], c[k[3]]) < SEA_LEVEL) for (const i of k) frozen[i] = 1;
    }
  }
  const around: number[] = [];
  for (let pass = 0; pass < passes; pass++) {
    const next = c.slice();
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const i = y * s + x;
        if (frozen[i]) continue;
        around.length = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < s && ny < s && c[ny * s + nx] >= SEA_LEVEL) around.push(c[ny * s + nx]);
          }
        }
        around.sort((a, b) => a - b);
        next[i] = Math.max(SEA_LEVEL, around[around.length >> 1]);
      }
    }
    c.set(next);
  }
  // The median can leave a few: a corner above (or below) all its neighbours joins the nearest.
  for (let y = 1; y < s - 1; y++) {
    for (let x = 1; x < s - 1; x++) {
      const i = y * s + x;
      if (frozen[i]) continue;
      let lo = Infinity;
      let hi = -Infinity;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const v = c[(y + dy) * s + x + dx];
          lo = Math.min(lo, v);
          hi = Math.max(hi, v);
        }
      }
      if (c[i] > hi) c[i] = hi;
      else if (c[i] < lo) c[i] = Math.max(SEA_LEVEL, lo);
    }
  }
  constrainSlopes(c, s);
}

/** Lowers corners until every 8-neighbour pair differs by at most 1. Monotone, so it terminates. */
export function constrainSlopes(h: Uint8Array, s: number): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      const forward = pass === 0;
      for (let k = 0; k < s * s; k++) {
        const i = forward ? k : s * s - 1 - k;
        const x = i % s;
        const y = (i - x) / s;
        let lim = h[i];
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= s) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            if ((dx === 0 && dy === 0) || nx < 0 || nx >= s) continue;
            const v = h[ny * s + nx] + 1;
            if (v < lim) lim = v;
          }
        }
        if (lim < h[i]) {
          h[i] = lim;
          changed = true;
        }
      }
    }
  }
}
