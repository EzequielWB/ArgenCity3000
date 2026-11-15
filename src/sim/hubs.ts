/**
 * What the airports and harbours give the city. A facility (pieces that share an edge, see
 * `world/hubs.ts`) that works gives the commercial jobs and the monthly income of its level; every
 * piece costs its upkeep whether it works or not. The airport is loud: see `computeLandValue`.
 */
import { HUBS } from '../config';
import { hubFacilities, type HubFacility } from '../world/hubs';
import type { World } from '../world/world';

const jobsOf = (f: HubFacility): number => (f.works ? HUBS[f.kind].jobs[f.level - 1] : 0);
const incomeOf = (f: HubFacility): number => (f.works ? HUBS[f.kind].income[f.level - 1] : 0);

/** Commercial jobs of all the working airports and harbours. */
export function hubJobs(w: World): number {
  return hubFacilities(w).reduce((sum, f) => sum + jobsOf(f), 0);
}

/** Monthly income (tourism and trade) of all the working airports and harbours. */
export function hubIncome(w: World): number {
  return hubFacilities(w).reduce((sum, f) => sum + incomeOf(f), 0);
}

/** Monthly upkeep of every piece, working or not. */
export function hubUpkeep(w: World): number {
  return w.hubs.reduce((sum, h) => sum + HUBS[h.kind].upkeep, 0);
}
