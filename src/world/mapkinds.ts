import { hash2 } from '../core/rng';
import {
  MAX_HEIGHT,
  SEA_LEVEL,
  constrainSlopes,
  fbm,
  generateTerrain,
  isFlatCell,
  isWaterCell,
  scatterTrees,
  smooth,
  smoothCorners,
  type Terrain,
} from './terrain';

/** The kinds of invented map the player can pick on the start screen. */
export type MapKind = 'coast' | 'plain' | 'relief' | 'sierras';

export interface MapKindInfo {
  id: MapKind;
  /** Spanish label for the start screen. */
  label: string;
  blurb: string;
}

export const MAP_KINDS: readonly MapKindInfo[] = [
  { id: 'coast', label: 'Con salida al mar', blurb: 'Lomas suaves, el mar o un río ancho al este y un arroyo.' },
  { id: 'plain', label: 'Llanura', blurb: 'Terreno casi llano, con un arroyo y una laguna.' },
  { id: 'relief', label: 'Con gran relieve', blurb: 'Cerros y valles por todo el mapa.' },
  { id: 'sierras', label: 'Sierras', blurb: 'Cordones de montañas con valles anchos donde construir.' },
];

/**
 * Generates an invented map of the given kind. `coast` is the original generator, untouched;
 * the others share its pipeline: a float height field, rounded and clamped, then slopes
 * constrained to one level between neighbours, smoothed, and trees scattered.
 */
export function generateMap(seed: number, n: number, kind: MapKind = 'coast'): Terrain {
  if (kind === 'coast') return generateTerrain(seed, n);
  const s = n + 1;
  const raw = new Float32Array(s * s);
  // Features grow with the map, but slower than it: a big map has more of them, not bigger ones.
  const scale = 1 / Math.sqrt(n / 128);
  if (kind === 'plain') fillPlain(raw, n, seed, scale);
  else if (kind === 'relief') fillRelief(raw, n, seed, scale);
  else fillSierras(raw, n, seed, scale);

  const corners = new Uint8Array(s * s);
  for (let i = 0; i < raw.length; i++) {
    corners[i] = Math.max(SEA_LEVEL - 1, Math.min(MAX_HEIGHT, Math.round(raw[i])));
  }
  constrainSlopes(corners, s);
  smoothCorners(corners, s);
  const t: Terrain = { n, corners, trees: new Uint8Array(n * n) };
  scatterTrees(t, seed);
  return t;
}

/** Digs a meandering channel across the map, west to east, and a lake along it. */
function carveWater(raw: Float32Array, n: number, seed: number, scale: number): void {
  const s = n + 1;
  const y0 = n * (0.25 + 0.5 * hash2(3, 4, seed));
  const lakeAt = Math.floor(n * (0.3 + 0.4 * hash2(5, 6, seed)));
  const lakeR = n * 0.045 * (0.8 + 0.5 * hash2(7, 8, seed));
  const centre = (x: number) =>
    y0 + Math.sin(x * 0.06 * scale + seed) * n * 0.08 + (fbm(x / (16 / scale), 9.1, seed + 11) - 0.5) * n * 0.18;
  for (let x = 0; x < s; x++) {
    const cy = centre(x);
    for (let y = Math.floor(cy - 3); y <= Math.ceil(cy + 3); y++) {
      if (y >= 0 && y < s && Math.abs(y - cy) <= 1.3) raw[y * s + x] = SEA_LEVEL - 2;
    }
  }
  const cy = centre(lakeAt);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const wobble = 1 + (fbm(x / 6, y / 6, seed + 21, 2) - 0.5) * 0.8;
      const d = Math.hypot(x - lakeAt, (y - cy) * 1.3);
      if (d < lakeR * wobble) raw[y * s + x] = SEA_LEVEL - 2;
    }
  }
}

function fillPlain(raw: Float32Array, n: number, seed: number, scale: number): void {
  const s = n + 1;
  const f = 1 / (46 / scale);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const g = fbm(x * f, y * f, seed + 101, 3);
      raw[y * s + x] = Math.min(SEA_LEVEL + 3, SEA_LEVEL + 2.1 + (g - 0.5) * 4.2);
    }
  }
  carveWater(raw, n, seed, scale);
}

function fillRelief(raw: Float32Array, n: number, seed: number, scale: number): void {
  const s = n + 1;
  const f = 1 / (38 / scale);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const g = fbm(x * f, y * f, seed + 202, 4);
      const detail = fbm(x / 8, y / 8, seed + 77, 2) - 0.5;
      // Soft ceiling: peaks are points and ridges, not a flat plateau at MAX_HEIGHT.
      raw[y * s + x] = SEA_LEVEL + 4.2 + 6.5 * Math.tanh(((g - 0.5) * 24) / 6.5) + detail * 1.5;
    }
  }
}

function fillSierras(raw: Float32Array, n: number, seed: number, scale: number): void {
  const s = n + 1;
  const f = 1 / (44 / scale);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      // Ridge lines: 1 on the crest, falling to 0 away from it. Two scales, so a range has
      // shoulders and spurs instead of one smooth dome.
      const a = 1 - Math.abs(2 * fbm(x * f, y * f, seed + 303, 1) - 1);
      const b = 1 - Math.abs(2 * fbm(x * f * 2.3, y * f * 2.3, seed + 404, 1) - 1);
      const ridge = (0.65 * a + 0.35 * b) ** 3;
      // Where the ranges stand: narrow bands with wide valleys between them, which is where the
      // city goes. The step is sharp, so the foot of a range is a foot and not a ramp.
      const band = (fbm(x * f * 0.5, y * f * 0.5, seed + 505, 2) - 0.34) / 0.18;
      const range = smooth(Math.max(0, Math.min(1, band)));
      const floor = SEA_LEVEL + 1 + (fbm(x * f * 0.7, y * f * 0.7, seed + 606, 2) - 0.5) * 2.6;
      // The crests climb to the ceiling of the world: tall, sharp, and with the valleys wide open.
      raw[y * s + x] = floor + range * ridge * (MAX_HEIGHT - 1);
    }
  }
}

export interface TerrainStats {
  /** Share of cells that are not water, in percent. */
  landPct: number;
  /** Share of land cells whose four corners are equal, in percent. */
  flatPct: number;
  /** Highest corner. */
  maxHeight: number;
  /** Largest 4-connected area of flat land cells, in percent of all cells. */
  largestFlatPct: number;
}

export function terrainStats(t: Terrain): TerrainStats {
  const n = t.n;
  let land = 0;
  let flat = 0;
  const isFlat = new Uint8Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (isWaterCell(t, x, y)) continue;
      land++;
      if (isFlatCell(t, x, y)) {
        flat++;
        isFlat[y * n + x] = 1;
      }
    }
  }
  let largest = 0;
  const stack: number[] = [];
  for (let start = 0; start < n * n; start++) {
    if (isFlat[start] !== 1) continue;
    let size = 0;
    isFlat[start] = 2;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop()!;
      size++;
      const x = i % n;
      const y = (i - x) / n;
      for (const j of [x > 0 ? i - 1 : -1, x < n - 1 ? i + 1 : -1, y > 0 ? i - n : -1, y < n - 1 ? i + n : -1]) {
        if (j >= 0 && isFlat[j] === 1) {
          isFlat[j] = 2;
          stack.push(j);
        }
      }
    }
    largest = Math.max(largest, size);
  }
  let maxHeight = 0;
  for (const h of t.corners) maxHeight = Math.max(maxHeight, h);
  return {
    landPct: (100 * land) / (n * n),
    flatPct: land ? (100 * flat) / land : 0,
    maxHeight,
    largestFlatPct: (100 * largest) / (n * n),
  };
}
