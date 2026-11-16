import { CAPACITY, DEFAULT_TAX, MAX_LEVEL, type ZoneTaxes } from '../config';
import { hash2 } from '../core/rng';
import { World, zoneOf, type ZoneKind } from '../world/world';
import { addCoastJobs } from './coast';
import { hubJobs } from './hubs';
import { NO_MODS, type RunMods } from './roguelike';

export interface Totals {
  pop: number;
  cJobs: number;
  iJobs: number;
}

export type Demand = Record<ZoneKind, number>;

export function cityTotals(w: World, mods: RunMods = NO_MODS): Totals {
  const t: Totals = { pop: 0, cJobs: 0, iJobs: 0 };
  for (let i = 0; i < w.tiles.length; i++) {
    if (w.isOccupied(i)) addBuilding(t, w.tiles[i], w.level[i], 1, mods);
    else addCoastJobs(t, w, i);
  }
  // The airports and harbours that work are a place of work for the commerce.
  t.cJobs += hubJobs(w);
  return t;
}

/** Adds (sign = 1) or removes (sign = -1) one building's residents or jobs, scaled by the run's upgrades. */
export function addBuilding(t: Totals, tile: number, level: number, sign: 1 | -1, mods: RunMods = NO_MODS): void {
  const z = zoneOf(tile);
  if (!z || level === 0) return;
  // Rounded per building so that adding and removing the same one always cancels out.
  const v = Math.round(CAPACITY[z][level] * (z === 'R' ? mods.density : mods.jobs)) * sign;
  if (z === 'R') t.pop += v;
  else if (z === 'C') t.cJobs += v;
  else t.iJobs += v;
}

const clamp = (v: number) => Math.max(-100, Math.min(100, Math.round(v)));

function pressure(target: number, current: number): number {
  return ((target - current) / Math.max(target, 1)) * 100;
}

/** Demand points a zone loses for each point of tax above the default (and gains below it). */
export const TAX_DEMAND_POINTS = 1.6;

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
  /** Coverage of the second-level services; missing means all there is (a caller that does not ask for them). */
  hospital?: number;
  university?: number;
}

/** Coverage a lot needs to reach a level: health for the third, education for the fourth. */
export const SERVICE_NEED = 40;

/**
 * Highest level a lot can reach given its land value, the city size and the services around:
 * homes need a clinic nearby to go past a chalet and a school to go past a PH; offices need a school.
 * The humble level 1 is never a target: the formula below counts from the casita as 1, and the
 * result is shifted up by one.
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
    // The tallest homes ask for a hospital, the tallest shops and factories for a university.
    if ((services.hospital ?? 100) < SERVICE_NEED) cap = Math.min(cap, 3);
  } else if ((zone === 'C' && services.edu < SERVICE_NEED) || (services.university ?? 100) < SERVICE_NEED) cap = Math.min(cap, 3);
  return Math.min(MAX_LEVEL, Math.max(1, cap) + 1);
}

/** The lowest building level: a tin-roof house, a kiosk, a shed. */
export const HUMBLE = 1;
/** Under this many people a new building is built humble. */
export const EARLY_CITY = 150;
/** Share of the humble buildings that never improve by themselves; only the player's bulldozer replaces them. */
export const HOLDOUT_SHARE = 0.35;

/** The level a new building (on an empty or demolished lot) is born at: humble in a small city, one below the cap in a grown one. */
export function spawnLevel(pop: number, cap: number): number {
  return pop < EARLY_CITY ? HUMBLE : Math.max(HUMBLE, cap - 1);
}

/** Whether a humble building, by its variant byte, is one of those that never improve by themselves. */
export function isHoldout(variant: number): boolean {
  return hash2(variant, 0, 29) < HOLDOUT_SHARE;
}
