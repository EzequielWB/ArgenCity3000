import {
  DEFAULT_FUNDING,
  DEFAULT_TAX,
  FIRE_SAFE_COVER,
  GOVERNMENTS,
  INITIAL_CASH,
  LOANS,
  MAX_FUNDING,
  MAX_TAX,
  MIN_TAX,
  TICKS_PER_MONTH,
  TICKS_PER_WEEK,
  WEEKS_PER_MONTH,
  type GovernmentKind,
  type ServiceFunding,
  type ServiceKind,
  type ZoneTaxes,
} from '../config';
import { formatMoney } from '../core/format';
import { Rng } from '../core/rng';
import { toolInfo } from '../world/tools';
import { World, zoneOf, type ZoneKind } from '../world/world';
import { buildingName } from './report';
import { monthlyBudget, type BudgetReport } from './budget';
import { cumulativeShare, dateLabel, dateOf } from './calendar';
import { countCoast } from './coast';
import { computeCongestion, jamGrowthFactor, type CongestionReport } from './congestion';
import { GROWTH_APPETITE, addBuilding, averageTax, cityTotals, computeDemand, levelCap, type Demand, type Totals } from './demand';
import { computeCrime, computeLandValue, computePollution, computeRoadAccess, computeServices } from './fields';
import { loanPaidOff, loanOwed, type Loan } from './loans';
import { foundingHeadline, electionHeadline, pollHeadline } from './mayor';
import { advanceMilestones, unlockNames } from './milestones';
import { FILLERS, headlinesFor, paperCanOpen, type CitySnapshot, type NewsItem } from './news';
import { runwayHeadline, servicesCostHeadline, servicesOutweighIncome } from './outlook';
import { APPROVAL, computeApproval, electionDue, monthsToElection, stepApproval, type ApprovalReport } from './politics';
import { computePower, type PowerReport } from './power';

export interface SimState {
  tick: number;
  cash: number;
  taxes: ZoneTaxes;
  funding: ServiceFunding;
  rngState: number;
  crisis: boolean;
  lastBudget: BudgetReport | null;
  /** Newest first. */
  news: NewsItem[];
  /** One entry per month. */
  history: { pop: number; cash: number }[];
  /** Tick at which each advice headline was last published. */
  hints: Record<string, number>;
  /** Index in `MILESTONES` of the highest milestone the city has reached. */
  milestone: number;
  /** Share of the neighbours (0 to 100) who approve of the Intendente. */
  approval: number;
  /** Elections won. */
  terms: number;
  /** True once an election was lost: the city goes on in free mode, with no more elections. */
  lostElection: boolean;
  /** The municipal loan being paid off, or null. One at a time. */
  loan: Loan | null;
  /** The form of government chosen when founding the city. */
  government: GovernmentKind;
  /** Name of the party in charge: what the diary and the politics panel call it. */
  party: string;
}

export function newSimState(seed: number, government: GovernmentKind = 'democracia', party = ''): SimState {
  return {
    tick: 0,
    government,
    party,
    cash: INITIAL_CASH,
    taxes: { R: DEFAULT_TAX, C: DEFAULT_TAX, I: DEFAULT_TAX },
    funding: { ...DEFAULT_FUNDING },
    rngState: seed >>> 0,
    crisis: false,
    lastBudget: null,
    news: [],
    history: [],
    hints: {},
    milestone: 0,
    approval: APPROVAL.start,
    terms: 0,
    lostElection: false,
    loan: null,
  };
}

const GROWTH_RATE = 0.01;
/** Above this average tax rate the city stops attracting extra newcomers. */
const APPETITE_MAX_TAX = 9;
/** Share of abandoned buildings that scares newcomers away. */
const ABANDON_LIMIT = 0.05;
/** Crime level above which people start leaving. */
const CRIME_ABANDON = 60;
const REOCCUPY_RATE = 0.003;
/** Monthly chance of a fire per 10 points of risk in an uncovered building. */
const FIRE_RATE = 0.00025;
/**
 * Chance that an uncovered fire jumps to each neighbour, checked every 15 ticks while it burns
 * (6 checks × up to 4 neighbours). Keeps the expected spread per fire near 0.5: above 1 every
 * fire would become an endless chain.
 */
const FIRE_SPREAD = 0.02;

export type StallReason = 'shortage' | 'taxes' | 'blight';

const STALL_TEXT: Record<StallReason, string> = {
  shortage: 'Hay apagones: mientras falte luz la ciudad no atrae gente nueva. Hace falta otra usina.',
  taxes: `Las tasas están altas: con un promedio de más de ${APPETITE_MAX_TAX} % la ciudad deja de atraer gente nueva. Bajalas en el Presupuesto.`,
  blight: 'Hay demasiados edificios abandonados (más del 5 %): hasta recuperarlos o demolerlos la ciudad no atrae gente nueva.',
};

function countAbandoned(w: World): number {
  let c = 0;
  for (let i = 0; i < w.abandoned.length; i++) if (w.abandoned[i] && w.level[i] > 0) c++;
  return c;
}
/** A changed light network is recomputed at the next tick, but no more often than every this many ticks. */
const POWER_DIRTY_GAP = 3;
/** Share of the commuters stuck in a saturated street from which the newspaper complains. */
const JAM_NEWS_SHARE = 0.25;
const MAX_NEWS = 50;
const MAX_HISTORY = 240;
const HINT_COOLDOWN = TICKS_PER_MONTH * 6;

export class Simulation {
  readonly world: World;
  readonly state: SimState;
  readonly cityName: string;
  totals: Totals = { pop: 0, cJobs: 0, iJobs: 0 };
  demand: Demand = { R: 0, C: 0, I: 0 };
  power: PowerReport = { capacity: 0, use: 0, shortage: false };
  congestion: CongestionReport = { trips: 0, worst: 0, jammedShare: 0 };
  /** What the city deserves today and why; `state.approval` follows it month by month. */
  approval: ApprovalReport = { target: 50, factors: [] };
  /** Above 1 the city attracts newcomers beyond what its jobs justify (see `updateAppetite`). */
  appetite = GROWTH_APPETITE;
  /** Why the city attracts nobody new (the appetite is off), or null while it does. */
  stall: StallReason | null = null;
  abandonedCount = 0;
  /**
   * True when a building appeared or disappeared since the light was last computed: buildings
   * pass the light on, so the network changed. It is recomputed once, however many buildings
   * changed, within `POWER_DIRTY_GAP` ticks (a level change between built levels never sets it).
   */
  powerDirty = false;
  private lightTick = 0;
  /** Counters for this session (not saved). */
  stats = { firesStarted: 0, firesSaved: 0, buildingsBurned: 0 };
  private burning = new Set<number>();
  private fireNews = 0;

  /** What this month's weekly settlements have already moved (not saved; see the constructor). */
  private monthPaid = 0;
  /** Months in a row in which the public services outweighed the income (not saved; see `hints`). */
  private servicesStreak = 0;
  private rng: Rng;
  private seenNetwork = -1;
  private prevSnapshot: CitySnapshot;

  /** The player's character, or an empty string when there is none (see `sim/mayor.ts`). */
  readonly mayor: string;

  constructor(world: World, state: SimState, cityName: string, mayor = '') {
    this.world = world;
    this.state = state;
    this.cityName = cityName;
    this.mayor = mayor;
    this.rng = new Rng(state.rngState);
    this.refresh();
    this.prevSnapshot = this.snapshot();
    this.monthPaid = this.paidSoFar();
    if (state.tick === 0 && state.news.length === 0) {
      this.publish(foundingHeadline(cityName, mayor, state.party, state.government), true);
    }
  }

  /**
   * Opens the mandate: the party and the form of government the player signs before moving a
   * brick. The founding headline published on construction named no party, so it is replaced.
   */
  found(government: GovernmentKind, party: string): void {
    const s = this.state;
    s.government = government;
    s.party = party;
    const plain = foundingHeadline(this.cityName, this.mayor);
    if (s.news.length > 0 && s.news[0].text === plain) s.news.shift();
    this.publish(foundingHeadline(this.cityName, this.mayor, party, government), true);
    this.updateAppetite();
  }

  /** Recomputes every derived layer. Call after loading or after big edits. */
  refresh(): void {
    const w = this.world;
    this.seenNetwork = w.networkVersion;
    computeRoadAccess(w);
    this.recomputePower();
    this.totals = cityTotals(w);
    this.updateFields();
    this.abandonedCount = countAbandoned(w);
    this.burning.clear();
    for (let i = 0; i < w.fire.length; i++) if (w.fire[i]) this.burning.add(i);
    this.updateAppetite();
    this.approval = this.judge();
  }

  /** What the neighbours think of the city as it is now. */
  private judge(): ApprovalReport {
    return computeApproval(this.world, {
      taxes: this.state.taxes,
      crisis: this.state.cash < 0,
      jammedShare: this.congestion.jammedShare,
      abandoned: this.abandonedCount,
      pop: this.totals.pop,
      jobs: this.totals.cJobs + this.totals.iJobs,
      growth: this.yearlyGrowth(),
    });
  }

  /** Growth of the population against twelve months ago (0 for a city too young or too small to compare). */
  private yearlyGrowth(): number {
    const h = this.state.history;
    const before = h.length >= 12 ? h[h.length - 12].pop : 0;
    return before >= 50 ? (this.totals.pop - before) / before : 0;
  }

  private recomputePower(): void {
    this.power = computePower(this.world);
    this.powerDirty = false;
    this.lightTick = this.state.tick;
  }

  /** Services, pollution, crime, congestion and land value, in that order (each needs the previous). */
  private updateFields(): void {
    const w = this.world;
    computeServices(w, this.state.funding);
    computePollution(w);
    computeCrime(w, this.totals.pop);
    this.congestion = computeCongestion(w);
    computeLandValue(w);
  }

  /**
   * A thriving city (no blackouts, reasonable taxes, little abandonment) attracts more people
   * than its jobs justify; otherwise it only grows as far as its own economy goes.
   */
  private updateAppetite(): void {
    let built = 0;
    for (let i = 0; i < this.world.level.length; i++) if (this.world.level[i] > 0) built++;
    const blighted = built > 20 && this.abandonedCount / built > ABANDON_LIMIT;
    this.stall = this.power.shortage ? 'shortage' : averageTax(this.state.taxes) > APPETITE_MAX_TAX ? 'taxes' : blighted ? 'blight' : null;
    this.appetite = this.stall ? 1 : GROWTH_APPETITE * GOVERNMENTS[this.state.government].migration;
    this.demand = computeDemand(this.totals, this.state.taxes, this.appetite);
  }

  /** What holds the city back, in words for the player, or null while it attracts people. */
  stallText(): string | null {
    return this.stall ? STALL_TEXT[this.stall] : null;
  }

  /** Charges `cost` if the city can afford it. */
  spend(cost: number): boolean {
    if (cost > this.state.cash) return false;
    this.state.cash -= cost;
    return true;
  }

  /**
   * Takes a municipal loan: the amount lands in the cash at once and the instalments start at the
   * end of this month. One at a time. False with a loan already running or an unknown kind.
   */
  takeLoan(kind: number): boolean {
    const offer = LOANS[kind];
    if (this.state.loan || !offer) return false;
    this.state.loan = { kind, paid: 0 };
    this.state.cash += offer.amount;
    return true;
  }

  /** Clears what is left of the loan in one payment. False with no loan, or without the cash. */
  payOffLoan(): boolean {
    const loan = this.state.loan;
    if (!loan) return false;
    const owed = loanOwed(loan);
    if (owed > this.state.cash) return false;
    this.state.cash -= owed;
    this.state.loan = null;
    return true;
  }

  /** Sets one zone's tax, or all three when no zone is given. */
  setTax(tax: number, zone?: ZoneKind): void {
    const v = Math.max(MIN_TAX, Math.min(MAX_TAX, Math.round(tax)));
    for (const z of zone ? [zone] : (['R', 'C', 'I'] as const)) this.state.taxes[z] = v;
    this.updateAppetite();
  }

  /** Sets a service's budget (percent of its standard upkeep); its coverage follows at once. */
  setFunding(kind: ServiceKind, percent: number): void {
    this.state.funding[kind] = Math.max(0, Math.min(MAX_FUNDING, Math.round(percent)));
    this.updateFields();
  }

  tick(): void {
    const w = this.world;
    const s = this.state;
    if (w.networkVersion !== this.seenNetwork) {
      this.refresh();
    } else {
      // Consumption changes all the time, so the light is recomputed every 5 ticks; a building
      // that appeared or vanished (a change of the network itself) does not wait for the 5th.
      if (s.tick % 5 === 0 || (this.powerDirty && s.tick - this.lightTick >= POWER_DIRTY_GAP)) {
        this.recomputePower();
        this.updateAppetite();
      }
      if (s.tick % 30 === 0) this.updateFields();
    }
    s.crisis = s.cash < 0;
    this.burn();
    this.grow();
    s.tick++;
    if (s.tick % TICKS_PER_MONTH === 0) this.endOfMonth();
    else if (s.tick % TICKS_PER_WEEK === 0) this.settleWeek();
    s.rngState = this.rng.state;
  }

  private grow(): void {
    const w = this.world;
    const rng = this.rng;
    const size = w.n * w.n;
    const start = rng.int(size);
    const t = this.totals;
    for (let k = 0; k < size; k++) {
      const i = (start + k) % size;
      const tile = w.tiles[i];
      const zone = zoneOf(tile);
      if (!zone) continue;
      if (w.fire[i]) continue;
      const level = w.level[i];
      const served = w.powered[i] === 1 && w.roadAccess[i] === 1;
      const d = this.demand[zone];
      if (level > 0 && w.abandoned[i]) {
        if (served && d > 0 && !this.state.crisis && w.crime[i] < CRIME_ABANDON && rng.chance(REOCCUPY_RATE)) this.setAbandoned(i, false);
        continue;
      }
      if (level > 0) {
        const risk = this.abandonRisk(i, zone, served);
        if (risk > 0 && rng.chance(risk)) {
          this.setAbandoned(i, true);
          continue;
        }
        if (d < -20 && rng.chance(0.002 * (-d / 100))) {
          this.changeLevel(i, level - 1);
          continue;
        }
      }
      if (!served || this.state.crisis || d <= 0) continue;
      const cap = levelCap(zone, w.landValue[i], t.pop, { edu: w.edu[i], health: w.health[i] });
      if (level >= cap) {
        if (level > cap && rng.chance(0.002)) this.changeLevel(i, level - 1);
        continue;
      }
      if (rng.chance(((GROWTH_RATE * d) / 100 / (1 + level * 0.5)) * jamGrowthFactor(w.jam[i]))) {
        this.changeLevel(i, level + 1);
        w.variant[i] = rng.int(256);
        w.terrain.trees[i] = 0;
      }
    }
  }

  /** Chance per tick that an occupied building empties out, from what is wrong around it. */
  private abandonRisk(i: number, zone: ZoneKind, served: boolean): number {
    const w = this.world;
    let p = 0;
    if (!served) p += 0.004;
    if (this.state.crisis) p += 0.0015;
    if (w.crime[i] > CRIME_ABANDON) p += (0.002 * (w.crime[i] - CRIME_ABANDON)) / (100 - CRIME_ABANDON);
    if (zone === 'R' && w.pollution[i] > 70) p += 0.0015;
    return p;
  }

  private changeLevel(i: number, level: number): void {
    const w = this.world;
    const tile = w.tiles[i];
    if ((w.level[i] === 0) !== (level === 0)) this.powerDirty = true; // a building appears or goes: the light network changes
    addBuilding(this.totals, tile, w.level[i], -1);
    w.setLevel(i, level);
    addBuilding(this.totals, tile, level, 1);
    this.demand = computeDemand(this.totals, this.state.taxes, this.appetite);
  }

  private setAbandoned(i: number, abandoned: boolean): void {
    const w = this.world;
    addBuilding(this.totals, w.tiles[i], w.level[i], abandoned ? -1 : 1);
    w.abandoned[i] = abandoned ? 1 : 0;
    this.abandonedCount += abandoned ? 1 : -1;
    w.markDirty(i);
    this.demand = computeDemand(this.totals, this.state.taxes, this.appetite);
  }

  /** Fires burn down; covered ones are put out and the building survives. Fires spread without cover. */
  private burn(): void {
    const w = this.world;
    const n = w.n;
    for (const i of Array.from(this.burning)) {
      w.fire[i]--;
      const covered = w.fireCover[i] >= FIRE_SAFE_COVER;
      if (!covered && w.fire[i] % 15 === 0) {
        const x = i % n;
        const y = (i - x) / n;
        for (const j of [x > 0 ? i - 1 : -1, x < n - 1 ? i + 1 : -1, y > 0 ? i - n : -1, y < n - 1 ? i + n : -1]) {
          if (j >= 0 && w.isOccupied(j) && zoneOf(w.tiles[j]) && w.fireCover[j] < FIRE_SAFE_COVER && this.rng.chance(FIRE_SPREAD)) this.ignite(j);
        }
      }
      if (w.fire[i] > 0) continue;
      this.burning.delete(i);
      if (covered) {
        addBuilding(this.totals, w.tiles[i], w.level[i], 1);
        this.stats.firesSaved++;
      } else {
        w.level[i] = 0;
        this.powerDirty = true; // the building no longer passes the light on
        this.stats.buildingsBurned++;
      }
      w.markDirty(i);
      this.demand = computeDemand(this.totals, this.state.taxes, this.appetite);
    }
  }

  private ignite(i: number): void {
    const w = this.world;
    if (w.fire[i] || !w.isOccupied(i)) return;
    addBuilding(this.totals, w.tiles[i], w.level[i], -1);
    const covered = w.fireCover[i] >= FIRE_SAFE_COVER;
    w.fire[i] = covered ? 20 : 90;
    w.markDirty(i);
    this.burning.add(i);
    this.stats.firesStarted++;
    if (this.fireNews < 2) {
      this.fireNews++;
      const name = buildingName(zoneOf(w.tiles[i])!, w.level[i], w.variant[i]).toLowerCase();
      this.publish(covered ? `Los bomberos voluntarios apagaron a tiempo un incendio en un ${name}` : `Incendio en un ${name}: los vecinos piden un cuartel de bomberos`);
    }
    this.demand = computeDemand(this.totals, this.state.taxes, this.appetite);
  }

  /** Each month a few dense buildings may catch fire; fire coverage makes it much rarer. */
  private igniteFires(): void {
    const w = this.world;
    const cityFactor = Math.min(1, this.totals.pop / 1500);
    if (cityFactor === 0) return;
    for (let i = 0; i < w.tiles.length; i++) {
      const zone = zoneOf(w.tiles[i]);
      if (!zone || w.level[i] < 2 || !w.isOccupied(i)) continue;
      const risk = w.level[i] * 10 + (zone === 'I' ? 20 : zone === 'C' ? 5 : 0);
      // Coverage makes fires rarer but never impossible; covered ones get put out (see `burn`).
      const exposure = 1 - (0.7 * w.fireCover[i]) / 100;
      if (this.rng.chance(((FIRE_RATE * risk) / 10) * cityFactor * exposure * exposure)) this.ignite(i);
    }
  }

  /**
   * Weeks 1 to 3 of a month collect and pay the cumulative quarter of the budget as it stands now;
   * week 4 (see `endOfMonth`) settles the rest, so the month always adds up to its balance.
   */
  private settleWeek(): void {
    const s = this.state;
    const week = Math.floor((s.tick % TICKS_PER_MONTH) / TICKS_PER_WEEK);
    const due = cumulativeShare(monthlyBudget(this.world, s.taxes, s.funding, s.loan, dateOf(s.tick).month).balance, week);
    s.cash += due - this.monthPaid;
    this.monthPaid = due;
    s.crisis = s.cash < 0;
  }

  /**
   * The part of this month's balance already settled when the simulation starts: zero at the
   * start of a month, an estimate from the current budget for a game saved in the middle of one.
   */
  private paidSoFar(): number {
    const s = this.state;
    const week = Math.floor((s.tick % TICKS_PER_MONTH) / TICKS_PER_WEEK);
    if (week === 0) return 0;
    return cumulativeShare(monthlyBudget(this.world, s.taxes, s.funding, s.loan, dateOf(s.tick).month).balance, Math.min(week, WEEKS_PER_MONTH - 1));
  }

  /** Counts the instalment this month paid, and closes the loan once the term is done. */
  private advanceLoan(): void {
    const loan = this.state.loan;
    if (!loan) return;
    loan.paid++;
    if (loanPaidOff(loan)) this.state.loan = null;
  }

  private endOfMonth(): void {
    const s = this.state;
    const w = this.world;
    this.fireNews = 0;
    this.openPaper(); // before the month's fires, so the opening month can report them
    this.igniteFires();
    // The tick already belongs to the next month: the season is the one of the month that just ended.
    const budget = monthlyBudget(w, s.taxes, s.funding, s.loan, dateOf(s.tick - 1).month);
    s.lastBudget = budget;
    s.cash += budget.balance - this.monthPaid; // the 4th week pays whatever the first three left
    this.monthPaid = 0;
    s.crisis = s.cash < 0;
    this.advanceLoan();
    this.totals = cityTotals(w);
    this.abandonedCount = countAbandoned(w);
    this.updateAppetite();
    const reached = advanceMilestones(s, this.totals.pop, GOVERNMENTS[s.government].grants);
    this.approval = this.judge();
    s.approval = stepApproval(s.approval, this.approval.target, s.government);
    s.history.push({ pop: this.totals.pop, cash: s.cash });
    if (s.history.length > MAX_HISTORY) s.history.shift();

    const snap = this.snapshot();
    if (this.paperOpen()) {
      const lines = headlinesFor(this.prevSnapshot, snap, this.cityName);
      for (const m of reached) {
        const opens = unlockNames(m, (t) => toolInfo(t).label.toLowerCase());
        lines.push(`${this.cityName} ya es ${m.name}: la Provincia gira ${formatMoney(m.grant)}${opens ? ` y habilita ${opens}` : ''}`);
      }
      lines.push(...this.hints());
      if (lines.length === 0 && this.rng.chance(0.3)) lines.push(this.rng.pick(FILLERS));
      for (const l of lines) this.publish(l, true); // the paper is open here
    }
    // While the paper is closed the snapshot still advances: those events are never reported.
    this.prevSnapshot = snap;
    this.holdElection(snap.year);
  }

  /**
   * Polls a year and six months before each election, and the election itself when October ends:
   * the Intendente stays with `APPROVAL.toWin` or more. A lost election ends the mandate for good.
   */
  private holdElection(year: number): void {
    const s = this.state;
    if (s.lostElection) return;
    const gov = GOVERNMENTS[s.government];
    if (!electionDue(s.tick, s.government)) {
      const left = monthsToElection(s.tick, s.government);
      if (left === 12 || left === 6) this.publish(pollHeadline(left, s.approval, this.mayor));
      return;
    }
    // The result is news even before the paper has opened.
    if (s.approval >= gov.toWin) {
      s.terms++;
      this.publish(electionHeadline(year, s.approval, true, this.mayor), true);
    } else {
      s.lostElection = true;
      this.publish(electionHeadline(year, s.approval, false, this.mayor), true);
    }
  }

  private hints(): string[] {
    const w = this.world;
    const s = this.state;
    const out: string[] = [];
    let zoned = 0;
    let noRoad = 0;
    let unlit = 0;
    const free: Record<ZoneKind, number> = { R: 0, C: 0, I: 0 };
    let smog = 0;
    for (let i = 0; i < w.tiles.length; i++) {
      const z = zoneOf(w.tiles[i]);
      if (!z) continue;
      zoned++;
      if (!w.roadAccess[i]) noRoad++;
      if (!w.powered[i]) unlit++;
      if (w.level[i] === 0 && w.roadAccess[i] && w.powered[i]) free[z]++;
      if (z === 'R' && w.level[i] > 0 && w.pollution[i] > 60) smog++;
    }
    const hint = (key: string, cond: boolean, text: string) => {
      if (!cond) return;
      const last = s.hints[key];
      if (last !== undefined && s.tick - last < HINT_COOLDOWN) return;
      s.hints[key] = s.tick;
      out.push(text);
    };
    hint('noPower', zoned > 0 && w.plants.length === 0, 'Los lotes esperan la luz: hace falta una usina');
    // With no shortage, a lot in the dark is simply out of reach of every building and plant.
    hint('farLots', w.plants.length > 0 && !this.power.shortage && unlit > 8, 'Hay lotes sin luz: la usina y cada edificio alumbran hasta 3 lotes a su alrededor; más lejos hace falta un tendido eléctrico');
    hint('noRoad', noRoad > 8, 'Vecinos reclaman calles para llegar a sus terrenos');
    hint('needR', this.demand.R > 50 && free.R === 0 && zoned > 0, `Faltan viviendas: hay familias que quieren mudarse a ${this.cityName}`);
    hint('needC', this.demand.C > 50 && free.C === 0 && zoned > 0, 'Los comerciantes buscan locales y no encuentran');
    hint('needI', this.demand.I > 50 && free.I === 0 && zoned > 0, 'Industriales buscan terrenos para instalarse');
    hint('power', this.power.shortage, 'La usina no da abasto: los vecinos piden otra usina');
    hint('appetite', this.appetite === 1 && !this.power.shortage && averageTax(s.taxes) > APPETITE_MAX_TAX, 'Con tasas tan altas, nadie quiere mudarse: la ciudad dejó de atraer gente');
    hint('blight', this.appetite === 1 && !this.power.shortage && averageTax(s.taxes) <= APPETITE_MAX_TAX && this.abandonedCount > 0, 'El abandono espanta a los nuevos vecinos: hay que recuperar o demoler los edificios vacíos');
    hint('smog', smog > 5, 'Vecinos se quejan del humo de las fábricas');
    hint('jam', this.congestion.jammedShare > JAM_NEWS_SHARE, 'Embotellamientos camino al trabajo: los vecinos piden avenidas u otro camino');
    const b = s.lastBudget;
    if (b) {
      const runway = runwayHeadline(b, s.cash);
      hint('runway', runway !== null, runway ?? '');
      this.servicesStreak = servicesOutweighIncome(b) ? this.servicesStreak + 1 : 0;
      hint('servicesCost', this.servicesStreak >= 2, servicesCostHeadline(b) ?? '');
    }
    return out;
  }

  private snapshot(): CitySnapshot {
    const { month, year } = dateOf(this.state.tick);
    let buildings = 0;
    for (let i = 0; i < this.world.level.length; i++) if (this.world.level[i] > 0) buildings++;
    const coast = countCoast(this.world);
    return {
      pop: this.totals.pop,
      buildings,
      plants: this.world.plants.length,
      shortage: this.power.shortage,
      crisis: this.state.crisis,
      taxes: { ...this.state.taxes },
      funding: { ...this.state.funding },
      month,
      year,
      cash: this.state.cash,
      abandoned: this.abandonedCount,
      // Only the kind: a copy would go stale as `advanceLoan` moves `paid`, and the rest comes from `LOANS`.
      loan: this.state.loan ? this.state.loan.kind : null,
      ports: coast.port,
      resorts: coast.resort,
    };
  }

  /**
   * The newspaper writes only once it has "opened": the founding headline does not count, and an
   * opened paper never closes again. Derived from the saved news, so nothing extra is stored.
   */
  private paperOpen(): boolean {
    return this.state.news.length > 1;
  }

  /** Opens the paper (with its opening headline) when the city has enough of each basic zone; true when open. */
  private openPaper(): boolean {
    if (this.paperOpen()) return true;
    if (!paperCanOpen(this.world)) return false;
    this.publish(`El Diario del Conurbano sale a la calle: ya hay vecinos, comercios y fábricas en ${this.cityName}`, true);
    return true;
  }

  /** Adds a headline. Only the founding and opening ones (`force`) may be written while the paper is closed. */
  private publish(text: string, force = false): void {
    if (!force && !this.paperOpen()) return;
    this.state.news.unshift({ date: dateLabel(this.state.tick), text });
    if (this.state.news.length > MAX_NEWS) this.state.news.length = MAX_NEWS;
  }
}
