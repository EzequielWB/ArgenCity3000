import { CAPACITY, DEFAULT_TAX, MAX_LEVEL, type ZoneTaxes } from '../config';
import { World, zoneOf, type ZoneKind } from '../world/world';

export interface Totals {
  pop: number;
  cJobs: number;
  iJobs: number;
}

export type Demand = Record<ZoneKind, number>;

export function cityTotals(w: World): Totals {
  const t: Totals = { pop: 0, cJobs: 0, iJobs: 0 };
  for (let i = 0; i < w.tiles.length; i++) if (w.isOccupied(i)) addBuilding(t, w.tiles[i], w.level[i], 1);
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

/** Demand points a zone loses for each point of tax above the default (and gains below it). */
export const TAX_DEMAND_POINTS = 6;

/** How much bigger than today a thriving city wants to be (see `Simulation.appetite`). */
export const GROWTH_APPETITE = 1.1;

/**
 * Residents come when there are jobs (two residents per job plus a few pioneers);
 * commerce follows the population and industry follows the workforce. With an appetite
 * above 1 every target is a bit above today's numbers, so a thriving city keeps growing;
 * at 1 it only grows as far as its own jobs and residents justify.
 * Each zone's tax above the default pushes that zone's demand down; below it, up.
 */
export function computeDemand(t: Totals, tax: ZoneTaxes | number, appetite = GROWTH_APPETITE): Demand {
  const taxes = zoneTaxes(tax);
  const taxEffect = (z: ZoneKind) => (taxes[z] - DEFAULT_TAX) * TAX_DEMAND_POINTS;
  const targetPop = (t.cJobs + t.iJobs) * 2 * appetite + 80;
  const targetC = t.pop * 0.15 * appetite + 10;
  const targetI = t.pop * 0.35 * appetite + 20;
  return {
    R: clamp(pressure(targetPop, t.pop) - taxEffect('R')),
    C: clamp(pressure(targetC, t.cJobs) - taxEffect('C')),
    I: clamp(pressure(targetI, t.iJobs) - taxEffect('I')),
  };
}

/** Per-zone taxes; a single number means the same tax for every zone. */
export function zoneTaxes(tax: ZoneTaxes | number): ZoneTaxes {
  return typeof tax === 'number' ? { R: tax, C: tax, I: tax } : tax;
}

/** The plain average of the three zone taxes. */
export function averageTax(taxes: ZoneTaxes): number {
  return (taxes.R + taxes.C + taxes.I) / 3;
}

export interface ServiceLevels {
  edu: number;
  health: number;
}

/** Coverage a lot needs to reach a level: health for the third, education for the fourth. */
export const SERVICE_NEED = 40;

/**
 * Highest level a lot can reach given its land value, the city size and the services around:
 * homes need a clinic nearby to go past level 2 and a school to go past 3; offices need a school.
 */
export function levelCap(zone: ZoneKind, landValue: number, pop: number, services: ServiceLevels = { edu: 100, health: 100 }): number {
  const byValue = (step: number) => 1 + Math.floor((landValue + 15) / step);
  let cap: number;
  if (zone === 'R') cap = Math.min(byValue(22), pop < 150 ? 2 : pop < 700 ? 3 : 4);
  else if (zone === 'C') cap = Math.min(byValue(20), pop < 250 ? 1 : pop < 900 ? 2 : pop < 2500 ? 3 : 4);
  else cap = pop < 200 ? 1 : pop < 900 ? 2 : pop < 2500 ? 3 : 4;
  if (zone === 'R') {
    if (services.health < SERVICE_NEED) cap = Math.min(cap, 2);
    if (services.edu < SERVICE_NEED) cap = Math.min(cap, 3);
  } else if (zone === 'C' && services.edu < SERVICE_NEED) cap = Math.min(cap, 3);
  return Math.max(1, Math.min(MAX_LEVEL, cap));
}
