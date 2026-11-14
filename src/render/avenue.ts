/**
 * Avenues: a purely visual reading of the road grid. Street cells placed side by side form a
 * band; the renderer draws a band of two or more cells as one wide road with lanes. Every cell
 * is still an ordinary road cell for the simulation: nothing here is read by `sim/` or saved.
 *
 * The analysis works on WORLD cells and does not depend on the view rotation.
 */
import type { RoadTier } from '../config';

export const KIND = {
  /** Not a road. */
  NONE: 0,
  /** A road cell that belongs to no 2x2 block of road: drawn exactly like a single street. */
  PLAIN: 1,
  /** Part of a band whose street runs along world x (lanes are rows). */
  BAND_X: 2,
  /** Part of a band whose street runs along world y (lanes are columns). */
  BAND_Y: 3,
  /** Wide road without a clear direction (junctions, solid blocks): plain asphalt, no lane lines. */
  BLOB: 4,
} as const;

export type RoadKind = (typeof KIND)[keyof typeof KIND];

/** Widest band that is told apart into lanes; anything wider is drawn as plain asphalt. */
export const MAX_BAND = 12;

// A cell's analysis is packed into 16 bits: kind (3) | width (4) | index (4) | tier (2).
export const kindOf = (code: number): RoadKind => (code & 7) as RoadKind;
export const widthOf = (code: number): number => (code >> 3) & 15;
export const indexOf = (code: number): number => (code >> 7) & 15;
/** Quality of the street a cell belongs to, already brought down to its weakest lane. */
export const tierOf = (code: number): RoadTier => ((code >> 11) & 3) as RoadTier;
const pack = (kind: number, width = 0, index = 0, tier = 0): number => kind | (width << 3) | (index << 7) | (tier << 11);

/**
 * Classifies every road cell of an n x n grid. Returns one packed code per cell (row-major);
 * read it with `kindOf`, `widthOf` and `indexOf`. A band cell carries the number of lanes
 * across the street and its own lane (0 .. width-1, counted along increasing world x or y).
 *
 * The street axis of a cell is the direction of its longer run of contiguous road cells; the
 * shorter run is the band's width. A cell is only a band cell ("clean") when the whole cross
 * section it sits in is a band of the same axis and the cells next to it along the street have
 * the same cross section; otherwise it is a junction or a corner and gets no lane lines.
 *
 * `tierAt` says which quality each cell was built with. A band is read by its weakest cell, so an
 * avenue with one plain lane in it is drawn as a plain avenue, the same way it carries traffic.
 */
export function analyzeRoads(isRoad: (x: number, y: number) => boolean, n: number, tierAt?: (x: number, y: number) => RoadTier): Uint16Array {
  const size = n * n;
  const road = new Uint8Array(size);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (isRoad(x, y)) road[y * n + x] = 1;

  // Contiguous runs through each cell, along x (h) and along y (v): start coordinate and length.
  const hStart = new Int16Array(size);
  const hLen = new Int16Array(size);
  const vStart = new Int16Array(size);
  const vLen = new Int16Array(size);
  for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
      if (!road[y * n + x]) {
        x++;
        continue;
      }
      let e = x;
      while (e < n && road[y * n + e]) e++;
      for (let k = x; k < e; k++) {
        hStart[y * n + k] = x;
        hLen[y * n + k] = e - x;
      }
      x = e;
    }
  }
  for (let x = 0; x < n; x++) {
    let y = 0;
    while (y < n) {
      if (!road[y * n + x]) {
        y++;
        continue;
      }
      let e = y;
      while (e < n && road[e * n + x]) e++;
      for (let k = y; k < e; k++) {
        vStart[k * n + x] = y;
        vLen[k * n + x] = e - y;
      }
      y = e;
    }
  }

  // First guess from the two runs alone.
  const guess = new Uint8Array(size);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      if (!road[i]) continue;
      const inBlock = [
        [-1, -1],
        [0, -1],
        [-1, 0],
        [0, 0],
      ].some(([dx, dy]) => {
        const bx = x + dx;
        const by = y + dy;
        return bx >= 0 && by >= 0 && bx + 1 < n && by + 1 < n && road[by * n + bx] && road[by * n + bx + 1] && road[(by + 1) * n + bx] && road[(by + 1) * n + bx + 1];
      });
      if (!inBlock) guess[i] = KIND.PLAIN;
      else if (hLen[i] > vLen[i] && vLen[i] <= MAX_BAND) guess[i] = KIND.BAND_X;
      else if (vLen[i] > hLen[i] && hLen[i] <= MAX_BAND) guess[i] = KIND.BAND_Y;
      else guess[i] = KIND.BLOB;
    }
  }

  const out = new Uint16Array(size);
  const ownTier = (x: number, y: number): RoadTier => (tierAt ? tierAt(x, y) : 0);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      if (!road[i]) continue;
      const g = guess[i];
      if (g === KIND.PLAIN || g === KIND.BLOB) {
        out[i] = pack(g, 0, 0, ownTier(x, y));
        continue;
      }
      const alongX = g === KIND.BAND_X;
      // The whole cross section must be a band of the same axis...
      const width = alongX ? vLen[i] : hLen[i];
      const first = alongX ? vStart[i] : hStart[i];
      let clean = true;
      let tier = ownTier(x, y);
      for (let k = 0; k < width && clean; k++) {
        const jx = alongX ? x : first + k;
        const jy = alongX ? first + k : y;
        const j = jy * n + jx;
        if (guess[j] !== g) clean = false;
        else tier = Math.min(tier, ownTier(jx, jy)) as RoadTier;
      }
      // ...and the cells next to it along the street must have the same cross section.
      for (const d of [-1, 1]) {
        if (!clean) break;
        const nx = alongX ? x + d : x;
        const ny = alongX ? y : y + d;
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        const j = ny * n + nx;
        if (!road[j]) continue;
        if (alongX ? vStart[j] !== first || vLen[j] !== width : hStart[j] !== first || hLen[j] !== width) clean = false;
      }
      out[i] = clean ? pack(g, width, (alongX ? y : x) - first, tier) : pack(KIND.BLOB, 0, 0, ownTier(x, y));
    }
  }
  return out;
}

export type LaneLine = 'dash' | 'solid' | 'double';

/**
 * The line between lane `j` and lane `j + 1` of a band of `lanes` lanes: a double centre line
 * in the middle of an even band, a solid line on each side of the middle lane of an odd band,
 * and dashed white lines between lanes that go the same way.
 */
export function laneLine(lanes: number, j: number): LaneLine {
  if (lanes % 2 === 0) return j === lanes / 2 - 1 ? 'double' : 'dash';
  const mid = (lanes - 1) / 2;
  return j === mid - 1 || j === mid ? 'solid' : 'dash';
}

/** Distance in cells between two kilometre signs along the provincial route. */
export const SIGN_EVERY = 8;

/**
 * Where the kilometre signs of the provincial route stand: the route cells that sit on the lane
 * facing the inside of the map, every `SIGN_EVERY` cells along it, each with the world
 * direction pointing from the cell to that inside edge. The route is a two-cell band along one
 * border; anything else gets no signs.
 */
export function routeSigns(route: Uint8Array, n: number): Map<number, [number, number]> {
  const signs = new Map<number, [number, number]>();
  if (!route.some((v) => v)) return signs;
  const codes = analyzeRoads((x, y) => route[y * n + x] === 1, n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const code = codes[i];
      const kind = kindOf(code);
      if (kind !== KIND.BAND_X && kind !== KIND.BAND_Y) continue;
      const alongX = kind === KIND.BAND_X;
      if ((alongX ? x : y) % SIGN_EVERY !== SIGN_EVERY / 2) continue;
      const lane = indexOf(code);
      const lanes = widthOf(code);
      const first = (alongX ? y : x) - lane;
      // The lane with the highest coordinate faces the inside when the strip is in the lower half.
      const inwardIsHigh = first + lanes / 2 < (n - 1) / 2;
      if (lane !== (inwardIsHigh ? lanes - 1 : 0)) continue;
      const step = inwardIsHigh ? 1 : -1;
      signs.set(i, alongX ? [0, step] : [step, 0]);
    }
  }
  return signs;
}
