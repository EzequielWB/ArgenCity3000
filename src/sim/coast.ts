/**
 * The buildings of the coast: where they may stand, whether they work, the jobs and the money they
 * bring. Pure functions of the world; the layers they read (`roadAccess`) come from the simulation.
 */
import { COAST, FISHING_SALES, LIGHTHOUSE_REACH, PORT_TAX_BOOST, TOURISM, type CoastKind } from '../config';
import { SEA_LEVEL } from '../world/terrain';
import { TILE, coastOf, type World } from '../world/world';
import type { Totals } from './demand';

export type Season = 'peak' | 'shoulder' | 'low';

/** Season of a calendar month (1 to 12) in the southern hemisphere. */
export function seasonOf(month: number): Season {
  if (TOURISM.peakMonths.includes(month)) return 'peak';
  if (TOURISM.shoulderMonths.includes(month)) return 'shoulder';
  return 'low';
}

/** Monthly tourism of one working resort in the given month. */
export function tourismFor(month: number): number {
  return TOURISM[seasonOf(month)];
}

/** Average monthly tourism of one working resort over a year. */
export function tourismAverage(): number {
  let sum = 0;
  for (let month = 1; month <= 12; month++) sum += tourismFor(month);
  return sum / 12;
}

/** True when a water cell lies within `reach` lots (any direction, the cell itself excluded). */
function touchesWater(w: World, x: number, y: number, reach: number): boolean {
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      if ((dx || dy) && w.inBounds(x + dx, y + dy) && w.isWater(x + dx, y + dy)) return true;
    }
  }
  return false;
}

/** Sand: dry land with a corner at the sea level or below, the rule the renderer paints the beach with. */
function isBeach(w: World, x: number, y: number): boolean {
  return !w.isWater(x, y) && w.minMax(x, y)[0] <= SEA_LEVEL;
}

/** True when the lot is where this building may stand, leaving aside whether the lot is free. */
export function coastFits(w: World, kind: CoastKind, x: number, y: number): boolean {
  if (w.isWater(x, y)) return false;
  if (kind === 'lighthouse') return !w.tiles.includes(TILE.LIGHTHOUSE) && touchesWater(w, x, y, LIGHTHOUSE_REACH);
  if (!touchesWater(w, x, y, 1)) return false;
  return kind !== 'resort' || isBeach(w, x, y);
}

/**
 * Why a coast building cannot go on the lot, in words for the player, or null when the ground is
 * fine for it. A lot that is merely taken is not a reason given here.
 */
export function coastRefusal(w: World, kind: CoastKind, x: number, y: number): string | null {
  if (coastFits(w, kind, x, y)) return null;
  const label = COAST[kind].label;
  if (!w.terrain.corners.some((h) => h < SEA_LEVEL)) return `${label}: tiene que estar sobre la costa, y este mapa no tiene agua`;
  if (w.isWater(x, y)) return `${label}: tiene que estar en tierra, sobre la costa`;
  if (kind === 'lighthouse') {
    return w.tiles.includes(TILE.LIGHTHOUSE)
      ? 'Ya hay un faro: la ciudad puede tener un solo faro'
      : `El faro tiene que estar a ${LIGHTHOUSE_REACH} lotes o menos del agua`;
  }
  if (!touchesWater(w, x, y, 1)) return `${label}: tiene que estar sobre la costa, pegado al agua`;
  return 'El balneario necesita playa: tiene que estar sobre la arena, pegado al agua';
}

/** True when the coast building at cell `i` works: the dock, the port and the resort need a street near. */
export function coastWorks(w: World, i: number): boolean {
  const kind = coastOf(w.tiles[i]);
  if (!kind) return false;
  return kind === 'promenade' || kind === 'lighthouse' || w.roadAccess[i] === 1;
}

/** Number of buildings of each kind on the map. */
export function countCoast(w: World): Record<CoastKind, number> {
  const out = { fishing: 0, promenade: 0, port: 0, resort: 0, lighthouse: 0 };
  for (let i = 0; i < w.tiles.length; i++) {
    if (w.tiles[i] < TILE.FISHING) continue;
    const kind = coastOf(w.tiles[i]);
    if (kind) out[kind]++;
  }
  return out;
}

/** Adds the jobs of the coast building at cell `i`, when it works: industrial for dock and port, commercial for the resort. */
export function addCoastJobs(t: Totals, w: World, i: number): void {
  if (w.tiles[i] < TILE.FISHING) return;
  const kind = coastOf(w.tiles[i]);
  if (!kind || !COAST[kind].jobs || !coastWorks(w, i)) return;
  if (kind === 'resort') t.cJobs += COAST[kind].jobs;
  else t.iJobs += COAST[kind].jobs;
}

/** Share by which the industrial taxes are multiplied with `ports` working ports (1 with none). */
export function portTaxBoost(ports: number): number {
  return 1 + Math.min(PORT_TAX_BOOST.max, PORT_TAX_BOOST.perPort * ports);
}

export interface CoastBudget {
  /** Upkeep of every coast building, working or not. */
  upkeep: number;
  /** Fish sold by the working docks plus the tourism of the working resorts. */
  income: number;
  /** Working ports. */
  ports: number;
}

/** What the coast costs and earns in a month; with no `month` (1 to 12) the tourism is the yearly average. */
export function coastBudget(w: World, month?: number): CoastBudget {
  let upkeep = 0;
  let sales = 0;
  let resorts = 0;
  let ports = 0;
  for (let i = 0; i < w.tiles.length; i++) {
    if (w.tiles[i] < TILE.FISHING) continue;
    const kind = coastOf(w.tiles[i]);
    if (!kind) continue;
    upkeep += COAST[kind].upkeep;
    if (!coastWorks(w, i)) continue;
    if (kind === 'fishing') sales += FISHING_SALES;
    else if (kind === 'resort') resorts++;
    else if (kind === 'port') ports++;
  }
  const tourism = resorts * (month === undefined ? tourismAverage() : tourismFor(month));
  return { upkeep, income: Math.round(sales + tourism), ports };
}
