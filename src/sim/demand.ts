import { CAPACITY, DEFAULT_TAX, MAX_LEVEL } from '../config';
import { World, zoneOf, type ZoneKind } from '../world/world';

export interface Totals {
  pop: number;
  cJobs: number;
  iJobs: number;
}

export type Demand = Record<ZoneKind, number>;

export function cityTotals(w: World): Totals {
  const t: Totals = { pop: 0, cJobs: 0, iJobs: 0 };
  for (let i = 0; i < w.tiles.length; i++) addBuilding(t, w.tiles[i], w.level[i], 1);
  return t;
}

/** Adds (sign = 1) or removes (sign = -1) one building's residents or jobs. */
export function addBuilding(t: Totals, tile: number, level: number, sign: 1 | -1): void {
  const z = zoneOf(tile);
  if (!z || level === 0) return;
  const v = CAPACITY[z][level] * sign;
  if (z === 'R') t.pop += v;
  else if (z === 'C') t.cJobs += v;
  else t.iJobs += v;
}

const clamp = (v: number) => Math.max(-100, Math.min(100, Math.round(v)));

function pressure(target: number, current: number): number {
  return ((target - current) / Math.max(target, 1)) * 100;
}

/**
 * Residents come when there are jobs (two residents per job plus a few pioneers);
 * commerce follows the population and industry follows the workforce.
 * Taxes above the default push every demand down, below it push them up.
 */
export function computeDemand(t: Totals, tax: number): Demand {
  const taxEffect = (tax - DEFAULT_TAX) * 6;
  const targetPop = (t.cJobs + t.iJobs + 40) * 2;
  const targetC = t.pop * 0.15 + 10;
  const targetI = t.pop * 0.35 + 20;
  return {
    R: clamp(pressure(targetPop, t.pop) - taxEffect),
    C: clamp(pressure(targetC, t.cJobs) - taxEffect),
    I: clamp(pressure(targetI, t.iJobs) - taxEffect),
  };
}

/** Highest level a lot can reach given its land value and the city size. */
export function levelCap(zone: ZoneKind, landValue: number, pop: number): number {
  const byValue = (step: number) => 1 + Math.floor(landValue / step);
  let cap: number;
  if (zone === 'R') cap = Math.min(byValue(25), pop < 150 ? 2 : pop < 800 ? 3 : 4);
  else if (zone === 'C') cap = Math.min(byValue(22), pop < 300 ? 1 : pop < 1200 ? 2 : pop < 4000 ? 3 : 4);
  else cap = pop < 200 ? 1 : pop < 1000 ? 2 : pop < 3000 ? 3 : 4;
  return Math.max(1, Math.min(MAX_LEVEL, cap));
}
