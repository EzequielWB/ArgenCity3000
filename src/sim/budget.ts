import { DEFAULT_FUNDING, ROAD_REACH, SERVICES, UPKEEP, type ServiceFunding, type ServiceKind, type ZoneTaxes } from '../config';
import { TILE, World, serviceOf, zoneOf } from '../world/world';
import { cityTotals, zoneTaxes } from './demand';

export interface BudgetReport {
  taxR: number;
  taxC: number;
  taxI: number;
  roads: number;
  lines: number;
  parks: number;
  plants: number;
  /** Garbage collection, street lighting and the like: grows faster than the city. */
  services: number;
  schools: number;
  clinics: number;
  police: number;
  firefighters: number;
  income: number;
  expenses: number;
  balance: number;
}

/** Monthly income and expenses for the current city. Whole pesos only. */
/**
 * Inherited streets (from a real-place map) within reach of a building or a service:
 * those are in use, so they are charged like any other street.
 */
function usedInheritedStreets(w: World): Uint8Array {
  const n = w.n;
  const used = new Uint8Array(n * n);
  if (!w.inherited.some((v) => v)) return used;
  for (let i = 0; i < n * n; i++) {
    const t = w.tiles[i];
    if (!((zoneOf(t) && w.level[i] > 0) || serviceOf(t))) continue;
    const x = i % n;
    const y = (i - x) / n;
    for (let dy = -ROAD_REACH; dy <= ROAD_REACH; dy++) {
      const r = ROAD_REACH - Math.abs(dy);
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < n && ny < n) used[ny * n + nx] = 1;
      }
    }
  }
  return used;
}

/** The month's income and expenses. `tax` is per zone, or one number for every zone. */
export function monthlyBudget(w: World, tax: ZoneTaxes | number, funding: Readonly<ServiceFunding> = DEFAULT_FUNDING): BudgetReport {
  const taxes = zoneTaxes(tax);
  const t = cityTotals(w);
  let roads = 0;
  let bridges = 0;
  let lines = 0;
  let parks = 0;
  const upkeep = { school: 0, clinic: 0, police: 0, fire: 0 };
  const used = usedInheritedStreets(w);
  for (let y = 0; y < w.n; y++) {
    for (let x = 0; x < w.n; x++) {
      const i = w.idx(x, y);
      const tile = w.tiles[i];
      if (tile === TILE.ROAD) {
        if (w.inherited[i] && !used[i]) continue;
        if (w.isWater(x, y)) bridges++;
        else roads++;
      } else if (tile === TILE.LINE) lines++;
      else if (tile === TILE.PARK) parks++;
      else {
        const k = serviceOf(tile);
        if (k) upkeep[k] += SERVICES[k].upkeep;
      }
    }
  }
  const taxR = Math.round(t.pop * taxes.R * 0.055);
  const taxC = Math.round(t.cJobs * taxes.C * 0.075);
  const taxI = Math.round(t.iJobs * taxes.I * 0.075);
  const funded = (k: ServiceKind) => Math.round((upkeep[k] * funding[k]) / 100);
  const r = {
    taxR,
    taxC,
    taxI,
    roads: Math.round(roads * UPKEEP.road + bridges * UPKEEP.bridge),
    lines: Math.round(lines * UPKEEP.line),
    parks: Math.round(parks * UPKEEP.park),
    plants: w.plants.length * UPKEEP.plant,
    services: Math.round(t.pop * UPKEEP.servicesPerResident * (1 + t.pop / UPKEEP.servicesScale)),
    schools: funded('school'),
    clinics: funded('clinic'),
    police: funded('police'),
    firefighters: funded('fire'),
  };
  const income = r.taxR + r.taxC + r.taxI;
  const expenses = r.roads + r.lines + r.parks + r.plants + r.services + r.schools + r.clinics + r.police + r.firefighters;
  return { ...r, income, expenses, balance: income - expenses };
}
