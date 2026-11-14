/**
 * Politics: how much the neighbours approve of the Intendente, and the elections that judge it.
 * Approval is 50 for a city where nothing stands out; each thing the neighbours enjoy or suffer
 * adds or takes points. Pure functions: the simulation keeps the state.
 */
import { CAPACITY, COAST_APPROVAL, DEFAULT_TAX, DEMOLITION, GOVERNMENTS, PARK, START_YEAR, TICKS_PER_MONTH, type GovernmentKind, type ZoneTaxes } from '../config';
import { TILE, type World } from '../world/world';
import { averageTax } from './demand';

export const APPROVAL = {
  /** Approval of a brand-new Intendente. */
  start: 55,
  /** Most points the approval moves in a month towards what the city deserves. */
  step: 4,
  /** Share of the votes needed to be re-elected. */
  toWin: 50,
  /** Residents from which the neighbours expect full services (below it they forgive in proportion). */
  fullExpectations: 1000,
  /** Health and education coverage the neighbours take for granted: more adds points, less takes them. */
  fairCoverage: 35,
  /** Land value of an ordinary neighbourhood: nicer ones add points. */
  fairLandValue: 30,
  /** Crime and smoke (0 to 100) nobody complains about. */
  tolerated: 10,
  /** Most points the neighbours take away for green spaces left untended, with every plaza dry. */
  greenNeglect: 10,
  /**
   * How far the neighbours' mood scales the appetite for growth: the factor is `floor + span`
   * times the approval over 100, so it is exactly 1 at 50 and runs from 0.75 to 1.25. A government
   * capped at 60 can never reach the top of that band.
   */
  appetite: { floor: 0.75, span: 0.5 },
} as const;

/**
 * How much the neighbours resent the demolitions of the last months, in points of approval. The
 * grudge is counted in people affected and divided by the population: in a village one house is
 * an outrage, in a metropolis it is nothing.
 */
export function demolitionPoints(grief: number, pop: number): number {
  return Math.min(DEMOLITION.max, (DEMOLITION.weight * grief) / Math.max(DEMOLITION.floor, pop));
}

export interface ApprovalInputs {
  taxes: ZoneTaxes;
  /** The cash is in the red. */
  crisis: boolean;
  /** Share of the commuters stuck in a saturated street (0 to 1). */
  jammedShare: number;
  /** Abandoned buildings. */
  abandoned: number;
  /** People affected by recent demolitions; see `demolitionPoints`. Missing means none. */
  grief?: number;
  pop: number;
  /** Commerce plus industry jobs. */
  jobs: number;
  /** Growth of the population over the last year, as a ratio (0.2 = 20 % more people). */
  growth: number;
}

export interface ApprovalFactor {
  label: string;
  /** Whole points added to (or taken from) the base of 50. */
  points: number;
}

export interface ApprovalReport {
  /** What the city deserves today, 0 to 100; the approval moves towards it month by month. */
  target: number;
  /** What adds and what takes, strongest first; things that weigh nothing are left out. */
  factors: ApprovalFactor[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** What the city deserves today and why. Reads the service, crime, smoke, light and land-value layers. */
export function computeApproval(w: World, inp: ApprovalInputs): ApprovalReport {
  let residents = 0;
  let health = 0;
  let edu = 0;
  let crime = 0;
  let smoke = 0;
  let value = 0;
  let built = 0;
  let dark = 0;
  let promenade = 0;
  let lighthouse = 0;
  // Green spaces: only the cells of a patch big enough to count are a plaza the neighbours notice,
  // and how much they complain depends on how far the budget is below the care line.
  let parks = 0;
  let parksNeglected = 0;
  for (let i = 0; i < w.tiles.length; i++) {
    if (w.tiles[i] === TILE.PROMENADE) promenade++;
    else if (w.tiles[i] === TILE.LIGHTHOUSE) lighthouse = COAST_APPROVAL.lighthouse;
    else if (w.tiles[i] === TILE.PARK && w.parkArea[i] >= PARK.minArea) {
      parks++;
      if (w.parkCare[i] < PARK.care) parksNeglected += (PARK.care - w.parkCare[i]) / PARK.care;
    }
    if (w.level[i] === 0) continue;
    built++;
    if (!w.isOccupied(i)) continue;
    if (!w.powered[i]) dark++;
    if (w.tiles[i] !== TILE.R) continue;
    const r = CAPACITY.R[w.level[i]];
    residents += r;
    health += w.health[i] * r;
    edu += w.edu[i] * r;
    crime += w.crime[i] * r;
    smoke += w.pollution[i] * r;
    value += w.landValue[i] * r;
  }
  const raw: [string, number][] = [];
  if (residents > 0) {
    const avg = (sum: number) => sum / residents;
    // A hamlet does not expect a hospital: service complaints grow with the city.
    const expects = Math.min(1, inp.pop / APPROVAL.fullExpectations);
    const service = (sum: number) => expects * clamp((avg(sum) - APPROVAL.fairCoverage) / (100 - APPROVAL.fairCoverage), -1, 1);
    raw.push(['Salud', service(health) * 8]);
    raw.push(['Educación', service(edu) * 6]);
    raw.push(['Delito', -Math.min(15, Math.max(0, avg(crime) - APPROVAL.tolerated) * 0.3)]);
    raw.push(['Humo', -Math.min(12, Math.max(0, avg(smoke) - APPROVAL.tolerated) * 0.25)]);
    raw.push(['Barrios lindos', clamp((avg(value) - APPROVAL.fairLandValue) * 0.15, -5, 8)]);
    // Two residents per job, as the demand does: fewer jobs than that is unemployment.
    raw.push(['Falta de trabajo', -20 * Math.max(0, 1 - (inp.jobs * 2) / Math.max(1, inp.pop))]);
  }
  if (built > 0) {
    raw.push(['Apagones', (-30 * dark) / built]);
    raw.push(['Edificios abandonados', -Math.min(12, (80 * inp.abandoned) / built)]);
  }
  raw.push(['Impuestos', clamp((DEFAULT_TAX - averageTax(inp.taxes)) * 2.5, -20, 10)]);
  raw.push(['Tránsito', -15 * inp.jammedShare]);
  // A roof torn down is not forgotten overnight: the grudge fades month by month.
  const anger = demolitionPoints(inp.grief ?? 0, inp.pop);
  if (anger >= 0.5) raw.push(['Demoliciones', -anger]);
  // A plaza nobody keeps is a dry square of dirt with no trees: the neighbours see it every day.
  if (parks > 0) raw.push(['Zonas verdes descuidadas', -(APPROVAL.greenNeglect * parksNeglected) / parks]);
  // A city that keeps receiving people is a city on the move; one that empties is not.
  raw.push(['Progreso', clamp(inp.growth * 30, -6, 6)]);
  raw.push(['Caja en rojo', inp.crisis ? -15 : 0]);
  raw.push(['Costanera', Math.min(COAST_APPROVAL.promenadeMax, Math.floor(promenade / COAST_APPROVAL.promenadeLots))]);
  raw.push(['Faro', lighthouse]);

  const factors = raw.map(([label, v]) => ({ label, points: Math.round(v) })).filter((f) => f.points !== 0);
  factors.sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
  const target = clamp(50 + factors.reduce((sum, f) => sum + f.points, 0), 0, 100);
  return { target, factors };
}

/**
 * How much the neighbours' approval scales the appetite for growth. Happy neighbours bring people;
 * a disliked Intendente does not. Neutral (1) at 50, the score of a city where nothing stands out.
 */
export function approvalAppetite(approval: number): number {
  const { floor, span } = APPROVAL.appetite;
  return floor + span * (clamp(approval, 0, 100) / 100);
}

/** The approval a month later: it moves towards the target and stops at the ceiling of the
 * form of government, which is also how fast it moves. */
export function stepApproval(current: number, target: number, government: GovernmentKind = 'democracia'): number {
  const gov = GOVERNMENTS[government];
  const moved = current + clamp(target - current, -gov.approvalStep, gov.approvalStep);
  return Math.max(0, Math.min(gov.approvalCap, moved));
}

/** October, counted from zero. */
const ELECTION_MONTH = 9;

/** Month (counted from the start of the game) whose end holds election number `k` of a term. */
const electionMonth = (k: number, term: number) => ((k + 1) * term - 1) * 12 + ELECTION_MONTH;

/** Number of the next election still to be held at `tick` (0 = the first). */
function nextElection(tick: number, term: number): number {
  const month = Math.floor(tick / TICKS_PER_MONTH);
  let k = 0;
  while (electionMonth(k, term) < month) k++;
  return k;
}

/** True at the first tick after an election October: the simulation holds the election then. */
export function electionDue(tick: number, government: GovernmentKind = 'democracia'): boolean {
  const term = GOVERNMENTS[government].termYears;
  if (term === null) return false;
  const ended = Math.floor(tick / TICKS_PER_MONTH) - 1;
  return ended >= 0 && ended % 12 === ELECTION_MONTH && Math.floor(ended / 12) % term === term - 1;
}

/** Months left until the next election is held (1 during the election October itself), or null
 * when this form of government holds none. */
export function monthsToElection(tick: number, government: GovernmentKind = 'democracia'): number | null {
  const term = GOVERNMENTS[government].termYears;
  if (term === null) return null;
  return electionMonth(nextElection(tick, term), term) + 1 - Math.floor(tick / TICKS_PER_MONTH);
}

/** Year of the next election, or null when this form of government holds none. */
export function nextElectionYear(tick: number, government: GovernmentKind = 'democracia'): number | null {
  const term = GOVERNMENTS[government].termYears;
  if (term === null) return null;
  return START_YEAR + Math.floor(electionMonth(nextElection(tick, term), term) / 12);
}
