import { DEFAULT_FUNDING, FIXED_SHARE, GOVERNMENTS, MAX_FUNDING, ROAD_REACH, ROAD_TIERS, SERVICES, UPKEEP, type GovernmentKind, type ServiceFunding, type ServiceKind, type ZoneTaxes } from '../config';
import { TILE, World, serviceOf, zoneOf } from '../world/world';
import { coastBudget, portTaxBoost } from './coast';
import { cityTotals, zoneTaxes } from './demand';
import { utilization } from './fields';
import { loanInstalment, loanPaidOff, type Loan } from './loans';
import { hubIncome, hubUpkeep } from './hubs';
import { plantsUpkeep } from './plants';
import { transitUpkeep } from './transit';

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
  hospitals: number;
  universities: number;
  /** This month's loan instalment; zero when the city owes nothing. */
  loan: number;
  /** Upkeep of the bus lines. */
  transport: number;
  /** Upkeep of the airports and harbours. */
  hubs: number;
  /** Tourism and trade of the airports and harbours that work. */
  hubIncome: number;
  /** Upkeep of the buildings of the coast (docks, promenade, port, resort, lighthouse). */
  coast: number;
  /** Fish sold by the docks and tourism at the resorts. */
  coastIncome: number;
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

/** Monthly upkeep of one service at `utilization` (0 to 1) of its capacity, before the funding share. */
export function serviceUpkeep(kind: ServiceKind, utilization: number): number {
  return SERVICES[kind].upkeep * (FIXED_SHARE + (1 - FIXED_SHARE) * utilization);
}

/**
 * The month's income and expenses. `tax` is per zone, or one number for every zone. `loan` is the
 * credit being paid off, if any: its instalment is an expense like any other, so the balance, the
 * runway and the newspaper all account for it without knowing about loans. `month` (1 to 12) sets the
 * tourism season of the resorts; without it the tourism is the average of the year.
 */
export function monthlyBudget(
  w: World,
  tax: ZoneTaxes | number,
  funding: Readonly<ServiceFunding> = DEFAULT_FUNDING,
  loan: Loan | null = null,
  month?: number,
  green = 100,
  coastFactor = 1,
  transport = 100,
  government: GovernmentKind = 'democracia',
  earnings = 1,
  roadsFunding = 100,
  plantsFunding = 100,
): BudgetReport {
  const taxes = zoneTaxes(tax);
  const gov = GOVERNMENTS[government];
  const t = cityTotals(w);
  let roads = 0;
  let bridges = 0;
  let lines = 0;
  let parks = 0;
  const upkeep = { school: 0, clinic: 0, police: 0, fire: 0, hospital: 0, university: 0 };
  const used = usedInheritedStreets(w);
  for (let y = 0; y < w.n; y++) {
    for (let x = 0; x < w.n; x++) {
      const i = w.idx(x, y);
      const tile = w.tiles[i];
      if (tile === TILE.ROAD) {
        if (w.route[i] || (w.inherited[i] && !used[i])) continue;
        // A bridge is a surcharge on top of the quality: an asphalt bridge still costs UPKEEP.bridge.
        const extra = ROAD_TIERS[w.roadTier[i]].upkeep - UPKEEP.road;
        if (w.isWater(x, y)) bridges += UPKEEP.bridge + extra;
        else roads += ROAD_TIERS[w.roadTier[i]].upkeep;
      } else if (tile === TILE.LINE) lines++;
      else if (tile === TILE.PARK) parks++;
      else {
        const k = serviceOf(tile);
        if (k) upkeep[k] += serviceUpkeep(k, utilization(w, i, k));
      }
    }
  }
  // The form of government and the effects that move what the city earns (see `incomeFactor`).
  const taxR = Math.round(t.pop * taxes.R * 0.055 * gov.taxIncome.R * earnings);
  const taxC = Math.round(t.cJobs * taxes.C * 0.075 * gov.taxIncome.C * earnings);
  const coast = coastBudget(w, month);
  const taxI = Math.round(t.iJobs * taxes.I * 0.075 * portTaxBoost(coast.ports) * gov.taxIncome.I * earnings);
  const funded = (k: ServiceKind) => Math.round((upkeep[k] * funding[k] * gov.serviceCost) / 100);
  const loanDue = loan && !loanPaidOff(loan) ? loanInstalment(loan) : 0;
  const r = {
    taxR,
    taxC,
    taxI,
    roads: Math.round(((roads + bridges) * Math.max(0, Math.min(MAX_FUNDING, roadsFunding))) / 100),
    lines: Math.round(lines * UPKEEP.line),
    parks: Math.round(parks * UPKEEP.park * (Math.max(0, Math.min(MAX_FUNDING, green)) / 100)),
    plants: Math.round((plantsUpkeep(w) * Math.max(0, Math.min(MAX_FUNDING, plantsFunding))) / 100),
    services: Math.round(t.pop * UPKEEP.servicesPerResident * (1 + t.pop / UPKEEP.servicesScale)),
    schools: funded('school'),
    clinics: funded('clinic'),
    police: funded('police'),
    firefighters: funded('fire'),
    hospitals: funded('hospital'),
    universities: funded('university'),
    loan: loanDue,
    transport: transitUpkeep(w, transport),
    hubs: hubUpkeep(w),
    hubIncome: Math.round(hubIncome(w) * earnings),
    coast: coast.upkeep,
    coastIncome: Math.round(coast.income * coastFactor * earnings),
  };
  const income = r.taxR + r.taxC + r.taxI + r.coastIncome + r.hubIncome;
  const expenses = r.roads + r.lines + r.parks + r.plants + r.services + r.schools + r.clinics + r.police + r.firefighters + r.hospitals + r.universities + r.loan + r.coast + r.transport + r.hubs;
  return { ...r, income, expenses, balance: income - expenses };
}
