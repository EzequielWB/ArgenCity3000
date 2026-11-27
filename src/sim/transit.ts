/**
 * What the bus lines do for the traffic. The whole fleet carries `BUS.trips` commuters per line,
 * and takes them off the streets of the whole city, spread by what each street carries: the buses
 * run where the people are, not inside a ring around the depot. A population ceiling caps the
 * relief at `BUS.share` of the city's commuters: a thousand neighbours cannot feed ten lines, so
 * extra depots stay idle while the city is small.
 *
 * The budget for transport (percent of the standard upkeep, like the services') sets how often the
 * buses run: at 100 % a line does all it can, at 50 % half of it, and at 0 % nothing, and it costs
 * the same share of its upkeep.
 */
import { BUS, MAX_FUNDING } from '../config';
import { busStations, streetNear } from '../world/transport';
import { TILE, type World } from '../world/world';

/** The share of a line's effect that a budget (percent) pays for: 1 at 100 %, 0 at 0 %. */
export const transitFactor = (funding: number): number => Math.max(0, Math.min(MAX_FUNDING, funding)) / 100;

/**
 * Takes the fleet's trips off every street of the city, each one by the same share of its load:
 * a relief of `r` over a total load of `t` leaves every street with `(1 - r / t)` of what it had.
 * `commuters` (the city's residents who travel, passed by `computeCongestion`) sets the ceiling:
 * the fleet cannot carry more people than `BUS.share` of them.
 *
 * Returns the trips taken (summed over the cells, for the tests and the card) and the capacity
 * that did not run: depots without a street nearby, plus the relief nobody used.
 */
export function applyTransit(w: World, load: Float32Array, funding = 100, commuters = Infinity): { taken: number; idle: number } {
  const each = BUS.trips * transitFactor(funding);
  const stations = busStations(w);
  let working = 0;
  for (const s of stations) if (streetNear(w, s.x, s.y)) working++;
  const relief = Math.min(working * each, commuters * BUS.share);
  let total = 0;
  for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === TILE.ROAD) total += load[i];
  const ratio = total > 0 ? Math.min(relief / total, 1) : 0;
  let taken = 0;
  if (ratio > 0) {
    for (let i = 0; i < w.tiles.length; i++) {
      if (w.tiles[i] !== TILE.ROAD) continue;
      const cut = load[i] * ratio;
      load[i] -= cut;
      taken += cut;
    }
  }
  return { taken, idle: (stations.length - working) * each + Math.max(0, relief - taken) };
}

/** Monthly upkeep of every bus depot of the city, at the given budget. */
export function transitUpkeep(w: World, funding = 100): number {
  return Math.round(busStations(w).length * BUS.upkeep * transitFactor(funding));
}

/** How many buses each line has on the street at the given budget: more frequency, more buses. */
export function transitBuses(funding = 100): number {
  return Math.round(BUS.buses * transitFactor(funding));
}
