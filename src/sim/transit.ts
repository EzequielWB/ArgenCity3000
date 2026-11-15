/**
 * What the bus lines do for the traffic. A depot takes load off every street within its area
 * (see `busArea`), but only while a street still comes within reach of it. The lines add up:
 * two of them take off 1 - (1 - relief)², never more than `BUS.maxRelief` together.
 */
import { BUS } from '../config';
import { busArea, busStations, streetNear } from '../world/transport';
import type { World } from '../world/world';

/** For every cell, the share (0 up to `BUS.maxRelief`) of its traffic that the bus lines take off. */
export function transitRelief(w: World): Float32Array {
  const n = w.n;
  const keep = new Float32Array(n * n).fill(1);
  for (const s of busStations(w)) {
    if (!streetNear(w, s.x, s.y)) continue;
    for (const [x, y] of busArea(n, s.x, s.y)) keep[y * n + x] *= 1 - BUS.relief;
  }
  const relief = new Float32Array(n * n);
  for (let i = 0; i < relief.length; i++) relief[i] = Math.min(BUS.maxRelief, 1 - keep[i]);
  return relief;
}

/** Monthly upkeep of every bus depot of the city. */
export function transitUpkeep(w: World): number {
  return busStations(w).length * BUS.upkeep;
}
