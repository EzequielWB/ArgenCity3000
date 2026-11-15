/**
 * What the bus lines do for the traffic. A depot takes load off every street within its area
 * (see `busArea`), but only while a street still comes within reach of it. The lines add up:
 * two of them take off 1 - (1 - relief)², never more than `BUS.maxRelief` together.
 *
 * The budget for transport (percent of the standard upkeep, like the services') sets how often the
 * buses run: at 100 % a line does all it can, at 50 % half of it, and at 0 % nothing, and it costs
 * the same share of its upkeep.
 */
import { BUS, MAX_FUNDING } from '../config';
import { busArea, busStations, streetNear } from '../world/transport';
import type { World } from '../world/world';

/** The share of a line's effect that a budget (percent) pays for: 1 at 100 %, 0 at 0 %. */
export const transitFactor = (funding: number): number => Math.max(0, Math.min(MAX_FUNDING, funding)) / 100;

/** For every cell, the share (0 up to `BUS.maxRelief`) of its traffic that the bus lines take off. */
export function transitRelief(w: World, funding = 100): Float32Array {
  const n = w.n;
  const keep = new Float32Array(n * n).fill(1);
  const each = BUS.relief * transitFactor(funding);
  for (const s of busStations(w)) {
    if (!streetNear(w, s.x, s.y)) continue;
    for (const [x, y] of busArea(n, s.x, s.y)) keep[y * n + x] *= 1 - each;
  }
  const relief = new Float32Array(n * n);
  for (let i = 0; i < relief.length; i++) relief[i] = Math.min(BUS.maxRelief, 1 - keep[i]);
  return relief;
}

/** Monthly upkeep of every bus depot of the city, at the given budget. */
export function transitUpkeep(w: World, funding = 100): number {
  return Math.round(busStations(w).length * BUS.upkeep * transitFactor(funding));
}

/** How many buses each line has on the street at the given budget: more frequency, more buses. */
export function transitBuses(funding = 100): number {
  return Math.round(BUS.buses * transitFactor(funding));
}
