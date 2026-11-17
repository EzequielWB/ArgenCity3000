/**
 * What the bus lines do for the traffic. A line's buses carry `BUS.trips` commuters, and they take
 * them off every street within its area (`busArea`): a number of people, not a share of the load.
 * Five lines in the same congested area carry five times that, and that is the point: it is still a
 * number of people, so a street loaded well above it stays saturated and the answer is more street,
 * not more depots.
 *
 * The budget for transport (percent of the standard upkeep, like the services') sets how often the
 * buses run: at 100 % a line does all it can, at 50 % half of it, and at 0 % nothing, and it costs
 * the same share of its upkeep.
 */
import { BUS, MAX_FUNDING } from '../config';
import { busArea, busStations, streetNear } from '../world/transport';
import { TILE, type World } from '../world/world';

/** The share of a line's effect that a budget (percent) pays for: 1 at 100 %, 0 at 0 %. */
export const transitFactor = (funding: number): number => Math.max(0, Math.min(MAX_FUNDING, funding)) / 100;

/**
 * Takes the buses' trips off every street of the area a line reaches, in place: the buses run along
 * the street, so each cell the line serves carries `BUS.trips` fewer commuters. That is a number of
 * people, not a share, and that is the whole point: a street loaded above it stays loaded.
 *
 * Returns the trips taken (summed over the cells, for the tests and the card) and the capacity a
 * line did not use because there was nobody left to carry.
 */
export function applyTransit(w: World, load: Float32Array, funding = 100): { taken: number; idle: number } {
  const n = w.n;
  const each = BUS.trips * transitFactor(funding);
  let taken = 0;
  let idle = 0;
  for (const s of busStations(w)) {
    if (!streetNear(w, s.x, s.y)) {
      idle += each;
      continue;
    }
    for (const [x, y] of busArea(n, s.x, s.y)) {
      const i = y * n + x;
      if (w.tiles[i] !== TILE.ROAD) continue;
      const cut = Math.min(each, load[i]);
      load[i] -= cut;
      taken += cut;
      idle += each - cut;
    }
  }
  return { taken, idle };
}

/** Monthly upkeep of every bus depot of the city, at the given budget. */
export function transitUpkeep(w: World, funding = 100): number {
  return Math.round(busStations(w).length * BUS.upkeep * transitFactor(funding));
}

/** How many buses each line has on the street at the given budget: more frequency, more buses. */
export function transitBuses(funding = 100): number {
  return Math.round(BUS.buses * transitFactor(funding));
}
