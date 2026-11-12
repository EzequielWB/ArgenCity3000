import { SERVICES, UPKEEP } from '../config';
import { TILE, World, serviceOf } from '../world/world';
import { cityTotals } from './demand';

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
export function monthlyBudget(w: World, tax: number): BudgetReport {
  const t = cityTotals(w);
  let roads = 0;
  let bridges = 0;
  let lines = 0;
  let parks = 0;
  const upkeep = { school: 0, clinic: 0, police: 0, fire: 0 };
  for (let y = 0; y < w.n; y++) {
    for (let x = 0; x < w.n; x++) {
      const tile = w.tiles[w.idx(x, y)];
      if (tile === TILE.ROAD) {
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
  const taxR = Math.round(t.pop * tax * 0.055);
  const taxC = Math.round(t.cJobs * tax * 0.075);
  const taxI = Math.round(t.iJobs * tax * 0.075);
  const r = {
    taxR,
    taxC,
    taxI,
    roads: Math.round(roads * UPKEEP.road + bridges * UPKEEP.bridge),
    lines: Math.round(lines * UPKEEP.line),
    parks: Math.round(parks * UPKEEP.park),
    plants: w.plants.length * UPKEEP.plant,
    services: Math.round(t.pop * UPKEEP.servicesPerResident * (1 + t.pop / UPKEEP.servicesScale)),
    schools: upkeep.school,
    clinics: upkeep.clinic,
    police: upkeep.police,
    firefighters: upkeep.fire,
  };
  const income = r.taxR + r.taxC + r.taxI;
  const expenses = r.roads + r.lines + r.parks + r.plants + r.services + r.schools + r.clinics + r.police + r.firefighters;
  return { ...r, income, expenses, balance: income - expenses };
}
