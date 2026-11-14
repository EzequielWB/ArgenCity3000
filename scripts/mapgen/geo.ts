/**
 * Pure geometry used to turn real-world data into a game map. Build-time only: the game
 * ships the baked result, not this code.
 */
import { MAX_HEIGHT, SEA_LEVEL, constrainSlopes, smoothCorners } from '../../src/world/terrain';

export type Segment = [number, number, number, number];

/**
 * Orientation of a street grid, in degrees in [0, 90): the angle that most street length
 * runs along (or across). Segments are [x0, y0, x1, y1] in any metric plane.
 */
export function dominantBearing(segments: readonly Segment[]): number {
  const BINS = 180; // half-degree bins over 90°
  const hist = new Float64Array(BINS);
  const items: [number, number][] = [];
  for (const [x0, y0, x1, y1] of segments) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len === 0) continue;
    const deg = (((Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI) % 90 + 90) % 90;
    items.push([deg, len]);
    hist[Math.floor(deg * 2) % BINS] += len;
  }
  if (items.length === 0) return 0;
  // Smooth over ±2° (wrapping, since 0° and 90° are the same grid) and take the peak.
  let best = 0;
  let bestScore = -1;
  for (let b = 0; b < BINS; b++) {
    let score = 0;
    for (let d = -4; d <= 4; d++) score += hist[(b + d + BINS) % BINS];
    if (score > bestScore) {
      bestScore = score;
      best = b;
    }
  }
  // Refine with the circular mean (period 90°) of the segments near the peak.
  const peak = best / 2 + 0.25;
  let sx = 0;
  let sy = 0;
  for (const [deg, len] of items) {
    let diff = deg - peak;
    diff -= Math.round(diff / 90) * 90;
    if (Math.abs(diff) > 5) continue;
    const phi = (deg * 4 * Math.PI) / 180;
    sx += Math.cos(phi) * len;
    sy += Math.sin(phi) * len;
  }
  const mean = ((Math.atan2(sy, sx) * 180) / Math.PI / 4 + 90) % 90;
  return mean;
}

/** Cells of a line between two cells, each touching the previous one by a side. */
export function rasterLine4(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const out: [number, number][] = [[x0, y0]];
  const nx = Math.abs(x1 - x0);
  const ny = Math.abs(y1 - y0);
  const sx = x1 > x0 ? 1 : -1;
  const sy = y1 > y0 ? 1 : -1;
  let x = x0;
  let y = y0;
  // Step along the axis whose next cell border the line crosses first.
  for (let ix = 0, iy = 0; ix < nx || iy < ny; ) {
    if ((1 + 2 * ix) * ny < (1 + 2 * iy) * nx) {
      x += sx;
      ix++;
    } else {
      y += sy;
      iy++;
    }
    out.push([x, y]);
  }
  return out;
}

/**
 * Closed rings out of ways that share end points, as the outline of a big lake or river
 * comes in OpenStreetMap. `key` tells two points apart. Pieces that never close are left out.
 */
export function stitchRings<T>(ways: readonly (readonly T[])[], key: (p: T) => string): T[][] {
  const rings: T[][] = [];
  const open = ways.filter((w) => w.length > 1).map((w) => w.slice());
  while (open.length) {
    const ring = open.shift()!;
    const head = key(ring[0]);
    while (key(ring[ring.length - 1]) !== head) {
      const tail = key(ring[ring.length - 1]);
      const k = open.findIndex((w) => key(w[0]) === tail || key(w[w.length - 1]) === tail);
      if (k < 0) break;
      const [next] = open.splice(k, 1);
      if (key(next[0]) !== tail) next.reverse();
      ring.push(...next.slice(1));
    }
    if (ring.length > 3 && key(ring[ring.length - 1]) === head) rings.push(ring);
  }
  return rings;
}

/**
 * Corner heights for the game from elevations in metres sampled at the corners.
 * `water` marks the cells that are water. A corner is underwater when at least three
 * quarters of the cells around it are water, which keeps shorelines where they are.
 * Heights are measured from the shore (the low end of the land touching the water), so a
 * lake in the hills sits at sea level in the game and the hills rise around it.
 */
export function cornersFromElevation(elev: Float32Array, water: Uint8Array, n: number, metersPerLevel: number): Uint8Array {
  const s = n + 1;
  const wetCorner = new Uint8Array(s * s);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      let around = 0;
      let wet = 0;
      for (const [cx, cy] of [
        [x - 1, y - 1],
        [x, y - 1],
        [x - 1, y],
        [x, y],
      ]) {
        if (cx < 0 || cy < 0 || cx >= n || cy >= n) continue;
        around++;
        wet += water[cy * n + cx];
      }
      wetCorner[y * s + x] = around > 0 && wet * 4 >= around * 3 ? 1 : 0;
    }
  }

  // The shore: land corners next to a water corner. Its low end is "sea level".
  const shore: number[] = [];
  let lowest = Infinity;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      if (wetCorner[i]) continue;
      lowest = Math.min(lowest, elev[i]);
      let touches = false;
      for (let dy = -1; dy <= 1 && !touches; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < s && ny < s && wetCorner[ny * s + nx]) {
            touches = true;
            break;
          }
        }
      }
      if (touches) shore.push(elev[i]);
    }
  }
  shore.sort((a, b) => a - b);
  const base = shore.length ? shore[Math.floor(shore.length * 0.1)] : lowest;

  const corners = new Uint8Array(s * s);
  for (let i = 0; i < s * s; i++) {
    if (wetCorner[i]) corners[i] = SEA_LEVEL - 1;
    else corners[i] = Math.min(MAX_HEIGHT, SEA_LEVEL + Math.max(0, Math.round((elev[i] - base) / metersPerLevel)));
  }
  constrainSlopes(corners, s);
  // The data has a few metres of noise: drop the lone one-level bumps it leaves.
  smoothCorners(corners, s);
  return corners;
}
