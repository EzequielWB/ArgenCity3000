import {
  BANKRUPT_MONTHS,
  CAPACITY,
  DEFAULT_FUNDING,
  DEFAULT_TAX,
  DEMOLITION,
  DESASTRE,
  EVENT,
  FIRE_SAFE_COVER,
  GOVERNMENTS,
  INITIAL_CASH,
  LOANS,
  MAX_FUNDING,
  MAX_TAX,
  MIN_TAX,
  PLANTS,
  PLANT_LIFE,
  PROMISE,
  ANGER,
  CRIME_ABANDON,
  JAM_CROWDED,
  TICKS_PER_MONTH,
  TICKS_PER_WEEK,
  WEEKS_PER_MONTH,
  type GovernmentKind,
  type ServiceFunding,
  type ServiceKind,
  type ZoneTaxes,
} from '../config';
import { formatMoney } from '../core/format';
import { Rng, hashString } from '../core/rng';
import { toolInfo } from '../world/tools';
import { TILE, World, coastOf, serviceOf, zoneOf, type ZoneKind } from '../world/world';
import { buildingName } from './report';
import { harvestNews, settleHarvest, type HarvestReport, type SellOrder } from './campo';
import { monthlyBudget, type BudgetReport } from './budget';
import { cumulativeShare, dateLabel, dateOf } from './calendar';
import { countCoast } from './coast';
import { computeCongestion, jamGrowthFactor, type CongestionReport } from './congestion';
import { SMOKE_BUBBLE } from './warnings';
import { GROWTH_APPETITE, HUMBLE, addBuilding, averageTax, cityTotals, computeDemand, educatedShare, isHoldout, levelCap, spawnLevel, type Demand, type Totals } from './demand';
import { computeCrime, computeLandValue, computeParks, computePollution, computeRoadAccess, computeServices } from './fields';
import { loanPaidOff, loanOwed, type Loan } from './loans';
import { DICTATOR_FOLLOWUPS, campoHeadline, dictatorHeadline, foundingHeadline, electionHeadline, intendente, milestoneHeadline, misaHeadline, pollHeadline } from './mayor';
import { FAVOR, computeFavor, judgementChance, moodOf, stepFavor, wrathApproval, wrathFires, wrathSick, type FavorReport } from './favor';
import { PLAN, newPlan, planPremium, type FivePlan } from './plan';
import { advanceMilestones, nextMilestone, unlockNames } from './milestones';
import { FILLERS, headlinesFor, paperCanOpen, type CitySnapshot, type NewsItem } from './news';
import { runwayHeadline, servicesCostHeadline, servicesOutweighIncome } from './outlook';
import { uniqueApproval, uniqueFavor } from '../world/uniques';
import { APPROVAL, approvalAppetite, computeApproval, demolitionPoints, electionDue, monthsToElection, stepApproval, type ApprovalReport } from './politics';
import { computePower, type PowerReport } from './power';
import { gripCode, gripOfCause } from './vecinos';import { monthsLeft, newCommitment, promiseDone, promiseKept, promiseWhat, type Commitment, type PromiseKind } from './commitments';
import { eventById, eventOfMonth, type CityEvent } from './events';
import { advanceTornado, newTornado, tornadoAllowedAt, tornadoCellsOf, tornadoDone, tornadoWidthFor, type TornadoRun } from './tornado';
import { NO_MODS, RUN_GOAL, dueMark, openOffer, runMods, takeUpgrade, type PickResult, type RunMods, type RunState } from './roguelike';import { COAST_BOOST, COAST_WORN, DROUGHT, FREEZE, INDUSTRY_BOOM, MIRACLE, INDUSTRY_FROZEN, NO_BLACKOUT, factorOf, incomeFactor, lockOf, tickEffects, type Effects } from './effects';

export interface SimState {
  tick: number;
  cash: number;
  taxes: ZoneTaxes;
  funding: ServiceFunding;
  /** La orden de venta del campo: el jugador fija los umbrales y el sistema vende. */
  order: SellOrder;
  /** El perfil de la apuesta del campo: qué parte de los lotes va en soja, de 0 a 100 (ver `cropOf`). */
  campoRisk: number;
  /** El recibo del último cierre del campo; null hasta la primera cosecha. */
  harvest: HarvestReport | null;
  /** Budget for green spaces (plazas), 0 to `MAX_FUNDING`. It decides how well plazas are kept. */
  green: number;
  /** Budget for the bus lines (percent of their standard upkeep), 0 to `MAX_FUNDING`: it sets the frequency. */
  transport: number;
  /** Budget for the streets (percent of their standard upkeep), 0 to `MAX_FUNDING`: it sets how much traffic they carry (see `roadCondition`). */
  roads: number;
  /** Budget for the power plants (percent of their standard upkeep), 0 to `MAX_FUNDING`: it sets how much they generate (see `fundingCondition`). */
  plants: number;
  /** People affected by the demolitions of the last months. It costs approval and wears off. */
  grief: number;
  /** The promise the neighbours are waiting on, or null. One at a time. */
  commitment: Commitment | null;
  /** Id of the event waiting for an answer, or null. Saved, so a loaded game reopens it. */
  pendingEvent: string | null;
  /** Tick of the last event, to keep them apart. */
  lastEvent: number;
  /** Ids of the last `EVENT.cooldown` events that showed up, the latest first: none of them can come back yet. */
  recentEvents: string[];
  /** Temporary effects, in months (see `sim/effects.ts`). Empty means none. */
  effects: Effects;
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
  /**
   * Meses seguidos con la caja en rojo. A `BANKRUPT_MONTHS` la Provincia interviene el municipio y la
   * partida termina, cualquiera sea el gobierno. Un mes en negro lo devuelve a cero.
   */
  dry: number;
  /** The municipal loan being paid off, or null. One at a time. */
  loan: Loan | null;
  /** The form of government chosen when founding the city. */
  government: GovernmentKind;
  /** Name of the party in charge: what the diary and the politics panel call it. */
  party: string;
  /** Favor of God, 0 to 100 (see `sim/favor.ts`): it only moves under a theocracy. */
  favor: number;
  /** The five-year plan the Party asked for, or null (see `sim/plan.ts`): it only exists under communism. */
  plan: FivePlan | null;
  /** The roguelike run, or null in a classic game (see `sim/roguelike.ts`). */
  run: RunState | null;
}

export function newSimState(seed: number, government: GovernmentKind = 'democracia', party = '', run: RunState | null = null): SimState {
  return {
    tick: 0,
    government,
    party,
    cash: INITIAL_CASH,
    taxes: { R: DEFAULT_TAX, C: DEFAULT_TAX, I: DEFAULT_TAX },
    funding: { ...DEFAULT_FUNDING },
    order: { minPrice: 0, keepTons: 0 },
    campoRisk: 0,
    harvest: null,
    green: 100,
    transport: 100,
    roads: 100,
    plants: 100,
    grief: 0,
    commitment: null,
    pendingEvent: null,
    lastEvent: 0,
    recentEvents: [],
    effects: {},
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
    dry: 0,
    loan: null,
    favor: FAVOR.start,
    plan: government === 'comunismo' ? newPlan(0, 0) : null,
    run,
  };
}

const GROWTH_RATE = 0.01;
/** Above this average tax rate the city stops attracting extra newcomers. */
const APPETITE_TAX_FROM = 10;
/** ...and above this average tax rate the city attracts nobody new. */
const APPETITE_TAX_TO = 16;
/** Share of abandoned buildings that scares newcomers away. */
const ABANDON_LIMIT = 0.05;
const REOCCUPY_RATE = 0.003;
/** Monthly chance of a fire per 10 points of risk in an uncovered building. */
const FIRE_RATE = 0.00025;
/**
 * Chance that an uncovered fire jumps to each neighbour, checked every 15 ticks while it burns
 * (6 checks × up to 4 neighbours). Keeps the expected spread per fire near 0.5: above 1 every
 * fire would become an endless chain.
 */
const FIRE_SPREAD = 0.02;

export type StallReason = 'shortage' | 'taxes' | 'blight' | 'stopped';

const STALL_TEXT: Record<StallReason, string> = {
  shortage: 'Hay apagones: mientras falte luz la ciudad no atrae gente nueva. Hace falta otra usina.',
  taxes: `Los impuestos están altos: con un promedio de más de ${APPETITE_TAX_TO} % la ciudad deja de atraer gente nueva (desde ${APPETITE_TAX_FROM} % ya atrae menos). Bajalos en el Presupuesto.`,
  blight: 'Hay demasiados edificios abandonados (más del 5 %): hasta recuperarlos o demolerlos la ciudad no atrae gente nueva.',
  stopped: 'La ciudad está frenada por lo que pasó: mientras dure no se levanta nada nuevo. Mirá el diario.',
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

/** Every complaint a lot can carry, in the order the card of the lot cares about them. */
export type Cause = 'power' | 'road' | 'crisis' | 'crime' | 'smoke' | 'jam' | 'vacant';

export class Simulation {
  readonly world: World;
  readonly state: SimState;
  readonly cityName: string;
  totals: Totals = { pop: 0, cJobs: 0, iJobs: 0 };
  demand: Demand = { R: 0, C: 0, I: 0 };
  power: PowerReport = { capacity: 0, use: 0, shortage: false };
  congestion: CongestionReport = { trips: 0, worst: 0, jammedShare: 0 };
  /** Share of the residents (0 to 100) living with a school in reach: what the shops grow on. */
  schooled = 0;
  /** What the city deserves today and why; `state.approval` follows it month by month. */
  approval: ApprovalReport = { target: 50, factors: [] };
  /** Above 1 the city attracts newcomers beyond what its jobs justify (see `updateAppetite`). */
  appetite = GROWTH_APPETITE;
  /**
   * The knobs the roguelike upgrades turned (see `sim/roguelike.ts`). All neutral without a run, and
   * refreshed when a card is taken and at each month's end, because a stage can start with the month.
   */
  mods: RunMods = NO_MODS;
  /** Why the city attracts nobody new (the appetite is off), or null while it does. */
  stall: StallReason | null = null;
  abandonedCount = 0;
  /**
   * How many abandoned buildings stand within two lots of each cell: the vacuum that pulls the
   * neighbours down. Derived, rebuilt with the other fields, so it costs nothing to keep.
   */
  private blightNear = new Uint8Array(0);
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
  /**
   * Los focos del incendio grande. No se guardan: un incendio grande que se corta a mitad, se guarda y se
   * carga vuelve a ser uno común, y eso es lo más benigno que se puede hacer con él.
   */
  private bigFire = new Set<number>();
  /**
   * El tornado en curso, o null. Se guarda acá y no en el estado porque **no se guarda en disco**: el que
   * se corta a mitad no sigue al cargar, y arrancar un desastre a medias es peor que no tenerlo.
   */
  tornado: TornadoRun | null = null;
  /** Cuántos edificios se llevó el tornado que está pasando (o el último, hasta el aviso del diario). */
  private tornadoLost = 0;
  /** La alarma ya sonó para este tornado: suena una vez, no en cada celda. */
  private tornadoAlarmHeard = false;
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
    // A form of government that will not defund education says so also for a game loaded from before.
    const floor = GOVERNMENTS[state.government].fundingFloor;
    if (floor > 0) {
      for (const kind of ['school', 'university'] as const) state.funding[kind] = Math.max(floor, state.funding[kind]);
    }
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
    this.updateRunMods();
    this.seenNetwork = w.networkVersion;
    computeRoadAccess(w);
    this.recomputePower();
    this.totals = cityTotals(w, this.mods);
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
      grief: this.state.grief,
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
    this.power = computePower(this.world, this.state.plants, this.mods);
    // Power bought from the Province covers the gap for as long as the deal lasts.
    if (this.hasEffect(NO_BLACKOUT)) this.power = { ...this.power, shortage: false };
    this.powerDirty = false;
    this.lightTick = this.state.tick;
  }

  /** Services, pollution, crime, congestion and land value, in that order (each needs the previous). */
  private updateFields(): void {
    const w = this.world;
    computeServices(w, this.state.funding);
    // How much of the city lives with a school in reach: the shops grow on this, not on their own lot.
    this.schooled = educatedShare(w);
    // The plazas are read before the smoke: a plaza eats the smoke that reaches it, so its patch and
    // its care have to be the ones of this pass and not the ones of the pass before.
    computeParks(w, this.state.green);
    computePollution(w);
    computeCrime(w, this.totals.pop);
    this.congestion = computeCongestion(w, this.state.transport, this.state.roads);
    computeLandValue(w, factorOf(this.state.effects, COAST_WORN), this.mods.land);
    this.computeBlightNear();
  }

  /** Counts the abandoned buildings within two lots of each cell, once per fields pass. */
  private computeBlightNear(): void {
    const w = this.world;
    const n = w.n;
    if (this.blightNear.length !== n * n) this.blightNear = new Uint8Array(n * n);
    else this.blightNear.fill(0);
    for (let i = 0; i < w.abandoned.length; i++) {
      if (!w.abandoned[i] || w.level[i] === 0) continue;
      const x = i % n;
      const y = (i - x) / n;
      for (let dy = -2; dy <= 2; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= n) continue;
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= n) continue;
          const j = ny * n + nx;
          if (this.blightNear[j] < 255) this.blightNear[j]++;
        }
      }
    }
  }

  /** The abandoned buildings within two lots of a cell: with them the block stops coming back. */
  blightAround(i: number): number {
    return this.blightNear[i] ?? 0;
  }

  /**
   * What is wrong at a lot and how much it wears the neighbours' patience down each month, worst
   * first. The monthly step and the card of the lot read this same function, so a number the player
   * sees is the number the city acts on.
   */
  /**
   * Qué le está gastando la paciencia a un lote, y cuánto por mes.
   *
   * Las quejas son de **falla**, no de cobertura parcial: algo que está roto y se puede arreglar. Por eso
   * la falta de salita y de escuela **no** está acá, aunque la burbuja del lote las muestre: una escuela
   * cubre un radio y una ciudad grande siempre tiene barrios afuera, así que enojar por eso vaciaba todas
   * las casas aunque el jugador hiciera todo bien (medido: 0 habitantes en el año 11 con el peso de las
   * otras quejas, y en el año 15 con un tercio del peso). Su costo se paga en la aprobación, que es donde
   * tiene que doler: `computeApproval` resta hasta 8 puntos por salud y 6 por educación.
   * `tests/servicios-no-vacian.test.ts` ata la decisión.
   */
  unrest(i: number, zone: ZoneKind): { rise: number; worst: Cause | null } {
    const w = this.world;
    const causes: { cause: Cause; rise: number }[] = [];
    if (!w.powered[i]) causes.push({ cause: 'power', rise: ANGER.served });
    if (!w.roadAccess[i]) causes.push({ cause: 'road', rise: ANGER.served });
    if (this.state.crisis) causes.push({ cause: 'crisis', rise: ANGER.crisis });
    if (w.crime[i] > CRIME_ABANDON) causes.push({ cause: 'crime', rise: ANGER.crime });
    if (zone === 'R' && w.pollution[i] > SMOKE_BUBBLE) causes.push({ cause: 'smoke', rise: ANGER.smoke });
    if (w.jam[i] > JAM_CROWDED) causes.push({ cause: 'jam', rise: ANGER.jam });
    const vacant = Math.min(ANGER.vacantMax, this.blightNear[i]);
    if (vacant > 0) causes.push({ cause: 'vacant', rise: ANGER.vacant * vacant });
    causes.sort((a, b) => b.rise - a.rise);
    if (causes.length === 0) return { rise: 0, worst: null };
    return { rise: causes.reduce((sum, c) => sum + c.rise, 0), worst: causes[0].cause };
  }

  /**
   * A month of patience. Every occupied lot gets angrier while something is wrong and calmer once it
   * is fixed; at 100 the owner leaves, and the empty building starts wearing down the neighbours'
   * patience, so what the city neglects empties a street instead of a single house.
   */
  private stepAnger(): void {
    const w = this.world;
    for (let i = 0; i < w.anger.length; i++) {
      if (w.level[i] === 0) {
        w.anger[i] = 0;
        w.troubleMonths[i] = 0;
        w.fixedMonths[i] = -1;
        continue;
      }
      if (w.abandoned[i] || w.fire[i]) continue;
      const zone = zoneOf(w.tiles[i]);
      const unrest = zone ? this.unrest(i, zone) : { rise: 0, worst: null };
      if (unrest.rise === 0) {
        // Lo que se arregló queda como agradecimiento un par de meses y después se olvida.
        if (w.troubleMonths[i] > 0) {
          w.troubleMonths[i] = 0;
          w.fixedMonths[i] = 0;
        } else if (w.fixedMonths[i] >= 0 && w.fixedMonths[i] < 100) w.fixedMonths[i]++;
        w.anger[i] = Math.max(0, w.anger[i] - ANGER.forgive);
        continue;
      }
      // Se guarda qué lo tiene mal para que el agradecimiento hable de eso y no de otra cosa. Si el problema
      // cambió, los meses empiezan de nuevo: una casa que estuvo dos años en crisis y ayer se quedó sin luz
      // lleva un mes sin luz, no dos años. La crisis no es un problema del lote y no le suma meses.
      const grip = gripOfCause(unrest.worst);
      if (grip) {
        const code = gripCode(grip);
        if (w.troubleWhat[i] !== code) w.troubleMonths[i] = 0;
        if (w.troubleMonths[i] < 255) w.troubleMonths[i]++;
        w.troubleWhat[i] = code;
      }
      w.fixedMonths[i] = -1;
      w.anger[i] = Math.min(100, w.anger[i] + Math.min(ANGER.cap, unrest.rise));
      if (w.anger[i] < 100) continue;
      w.anger[i] = 0; // the next owner starts from scratch
      w.troubleMonths[i] = 0; // irse no es arreglar: no hay nada que agradecer
      this.setAbandoned(i, true);
    }
  }

  /**
   * A thriving city (no blackouts, reasonable taxes, little abandonment) attracts more people
   * than its jobs justify; otherwise it only grows as far as its own economy goes. The neighbours'
   * mood scales that appetite too: the happier they are, the faster people come.
   */
  private updateAppetite(): void {
    let built = 0;
    for (let i = 0; i < this.world.level.length; i++) if (this.world.level[i] > 0) built++;
    const blighted = built > 20 && this.abandonedCount / built > ABANDON_LIMIT;
    this.stall = this.hasEffect(FREEZE)
      ? 'stopped'
      : this.power.shortage
        ? 'shortage'
        : averageTax(this.state.taxes) > APPETITE_TAX_TO
          ? 'taxes'
          : blighted
            ? 'blight'
            : null;
    // Taxes do not switch the appetite off at a line: from `APPETITE_TAX_FROM` it fades towards neutral and is gone at `APPETITE_TAX_TO`.
    const base = GROWTH_APPETITE * approvalAppetite(this.state.approval);
    const taxFade = Math.max(0, Math.min(1, (averageTax(this.state.taxes) - APPETITE_TAX_FROM) / (APPETITE_TAX_TO - APPETITE_TAX_FROM)));
    this.appetite = this.stall
      ? 1
      : base + (1 - base) * taxFade;
    this.recomputeDemand();
  }

  /** Demand as the economy asks for it, with whatever the events did to the industry on top. */
  private recomputeDemand(): void {
    this.demand = computeDemand(this.totals, this.state.taxes, this.appetite);
    const f = factorOf(this.state.effects, INDUSTRY_FROZEN, INDUSTRY_BOOM);
    if (f !== 1) this.demand.I = Math.max(-100, Math.min(100, Math.round(this.demand.I * f)));
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

  /**
   * Adds to the neighbours' grudge whatever a plan is about to tear down. Called before the plan
   * touches the ground, with the cells it will clear. Returns how many people were affected: a
   * resident costs a whole point, a job half, a public work or a plant a flat 200 or 250. Ruins,
   * fires and empty lots cost nothing: clearing those is a favour.
   */
  noteDemolition(cells: readonly (readonly [number, number])[]): number {
    const w = this.world;
    const plants = new Set<object>();
    let affected = 0;
    for (const [x, y] of cells) {
      const i = w.idx(x, y);
      const tile = w.tiles[i];
      const plant = tile === TILE.PLANT ? w.plantAt(x, y) : undefined;
      if (plant) {
        if (!plants.has(plant)) {
          plants.add(plant);
          affected += DEMOLITION.plant;
        }
        continue;
      }
      if (serviceOf(tile) !== null || coastOf(tile) !== null) {
        affected += DEMOLITION.work;
        continue;
      }
      if (!w.isOccupied(i)) continue; // empty, abandoned or on fire: nobody to upset
      const zone = zoneOf(tile)!;
      affected += zone === 'R' ? CAPACITY.R[w.level[i]] * DEMOLITION.resident : CAPACITY[zone][w.level[i]] * DEMOLITION.job;
    }
    if (affected > 0) {
      // The part of the new grudge that lands today: what the neighbours feel on the spot, before
      // the monthly step has a chance to move the approval one point at a time.
      const before = demolitionPoints(this.state.grief, this.totals.pop);
      this.state.grief += affected;
      const after = demolitionPoints(this.state.grief, this.totals.pop);
      const shock = Math.min(DEMOLITION.shock, Math.max(0, after - before));
      if (shock > 0) this.nudgeApproval(-shock);
      this.approval = this.judge();
    }
    return affected;
  }

  /** Makes a promise to the neighbours, with its deadline and the city as it is today. */
  promise(kind: PromiseKind): Commitment {
    const c = newCommitment(this.world, kind, this.state.tick);
    this.state.commitment = c;
    return c;
  }

  /** Moves the approval now; the monthly step slowly brings it back to what the city deserves. */
  nudgeApproval(delta: number): void {
    this.state.approval = Math.max(0, Math.min(100, Math.round(this.state.approval + delta)));
  }

  /** What the neighbours are still waiting for, with the time left: the red warning says this. */
  commitmentText(): string | null {
    const c = this.state.commitment;
    if (!c) return null;
    const left = monthsLeft(c, this.state.tick);
    return `${promiseWhat(c.kind)} · ${left === 0 ? 'vence este mes' : left === 1 ? 'queda 1 mes' : `quedan ${left} meses`}`;
  }

  /** The event waiting for an answer, if any. */
  openEvent(): CityEvent | null {
    return this.state.pendingEvent ? (eventById(this.state.pendingEvent) ?? null) : null;
  }

  /** Answers the pending event with one of its options: doing nothing is not one. */
  answerEvent(index: number): void {
    const event = this.openEvent();
    const option = event && index >= 0 && index < event.options.length ? event.options[index] : null;
    this.state.pendingEvent = null;
    if (option) option.apply(this);
  }

  /**
   * Checks the promise once a month: kept as soon as the city shows it, lost when the deadline
   * arrives without it. Either way it is over, and the neighbours pay or charge on the spot.
   */
  /** What God thinks of the city today and why (only a theocracy cares: see `sim/favor.ts`). */
  favorReport(): FavorReport {
    const s = this.state;
    return computeFavor(this.world, { taxes: s.taxes, crisis: s.cash < 0, abandoned: this.abandonedCount, grief: s.grief, pop: this.totals.pop, green: s.green });
  }

  /** The built lots (homes, shops and factories with people in them) within `radius` of lot `centre`. */
  private builtAround(centre: number, radius: number): number[] {
    const w = this.world;
    const cx = centre % w.n;
    const cy = Math.floor(centre / w.n);
    const out: number[] = [];
    for (let y = Math.max(0, cy - radius); y <= Math.min(w.n - 1, cy + radius); y++) {
      for (let x = Math.max(0, cx - radius); x <= Math.min(w.n - 1, cx + radius); x++) {
        const i = w.idx(x, y);
        if (zoneOf(w.tiles[i]) && w.level[i] > 0 && w.isOccupied(i) && !w.fire[i]) out.push(i);
      }
    }
    return out;
  }

  /** A random lot with a building on it, or -1. */
  private anyBuilding(): number {
    const w = this.world;
    const all: number[] = [];
    for (let i = 0; i < w.tiles.length; i++) if (zoneOf(w.tiles[i]) && w.level[i] > 0 && w.isOccupied(i)) all.push(i);
    return all.length ? this.rng.pick(all) : -1;
  }

  /** Moves the favor of God towards what the city deserves and, when He is far from calm, rolls what falls from above. */
  private judgement(): void {
    const s = this.state;
    const month = dateOf(s.tick - 1).month;
    s.favor = stepFavor(s.favor, this.favorReport().target);
    // A santuario keeps a pilgrimage going all year, and fills the basilica in April.
    const santuario = uniqueFavor(this.world, month);
    if (santuario > 0) s.favor = Math.min(100, s.favor + santuario);
    if (this.totals.pop < 100 || !this.rng.chance(judgementChance(s.favor))) return;
    if (moodOf(s.favor) === 'wrath') this.catastrophe((FAVOR.wrath - s.favor) / FAVOR.wrath);
    else this.miracle();
  }

  /** A punishment: lightning and fires in one area, a plague that empties another, a drought, a revolt. */
  private catastrophe(severity: number): void {
    const s = this.state;
    const centre = this.anyBuilding();
    if (centre < 0) return;
    const kind = this.rng.pick(['rayos', 'plaga', 'sequia', 'revuelta'] as const);
    const city = this.cityName;
    if (kind === 'rayos') {
      const hit = this.builtAround(centre, 5).slice(0, wrathFires(severity));
      for (const i of hit) this.ignite(i);
      this.publish(`Cayeron rayos sobre ${city}: hay incendios en un barrio y dicen que es el castigo del cielo`, true);
    } else if (kind === 'plaga') {
      const sick = this.builtAround(centre, 7).filter((i) => zoneOf(this.world.tiles[i]) !== 'I' && !this.world.abandoned[i]).slice(0, wrathSick(severity));
      for (const i of sick) this.setAbandoned(i, true);
      this.recomputeDemand();
      this.publish(`Plaga de langostas: ${sick.length} edificios de ${city} quedaron vacíos y la gente reza en la calle`, true);
    } else if (kind === 'sequia') {
      this.effect(DROUGHT, 3);
      this.publish(`Sequía en ${city}: la plata del mes se seca durante tres meses (los ingresos caen un 20 %)`, true);
    } else {
      this.nudgeApproval(-wrathApproval(severity));
      this.publish(`Revuelta de los fieles en ${city}: dicen que el Intendente le dio la espalda a Dios`, true);
    }
    s.favor = Math.min(100, s.favor + 3); // the wrath is spent: it does not fall without end
  }

  /** A reward: more income, the people come back to the empty houses, more work, the neighbours' love. */
  private miracle(): void {
    const city = this.cityName;
    const abandoned = this.abandonedCount;
    const kind = this.rng.pick(abandoned > 0 ? (['plata', 'sanacion', 'trabajo', 'fe'] as const) : (['plata', 'trabajo', 'fe'] as const));
    if (kind === 'plata') {
      this.effect(MIRACLE, 3);
      this.publish(`Milagro en ${city}: la caja se llena sola durante tres meses (los ingresos suben un 20 %)`, true);
    } else if (kind === 'sanacion') {
      const w = this.world;
      let back = 0;
      for (let i = 0; i < w.tiles.length && back < 12; i++) {
        if (w.level[i] > 0 && w.abandoned[i] && zoneOf(w.tiles[i])) {
          this.setAbandoned(i, false);
          back++;
        }
      }
      this.recomputeDemand();
      this.publish(`Milagro en ${city}: ${back} familias vuelven a los edificios vacíos y lo atribuyen a la fe`, true);
    } else if (kind === 'trabajo') {
      this.effect(INDUSTRY_BOOM, 3);
      this.publish(`Bendición del trabajo en ${city}: las fábricas piden gente durante tres meses`, true);
    } else {
      this.nudgeApproval(8);
      this.publish(`Procesión multitudinaria en ${city}: los vecinos le agradecen al Intendente`, true);
    }
  }

  /** Closes the five-year plan when it is met or falls due, and sets the next one. Returns the headline, or null. */
  private settlePlan(): string | null {
    const s = this.state;
    const jobs = this.totals.iJobs;
    if (!s.plan) {
      s.plan = newPlan(s.tick, jobs);
      return null;
    }
    const done = jobs >= s.plan.jobs;
    if (!done && s.tick < s.plan.due) return null;
    const plan = s.plan;
    s.plan = newPlan(s.tick, jobs);
    if (done) {
      s.cash += planPremium(plan);
      this.nudgeApproval(PLAN.kept);
      return `Plan quinquenal cumplido: ${plan.jobs} puestos industriales y un premio de ${formatMoney(planPremium(plan))} del Partido`;
    }
    this.nudgeApproval(-PLAN.broken);
    return 'El plan quinquenal no se cumplió: el Partido pide explicaciones y el pueblo se enoja';
  }

  private settlePromise(): string | null {
    const c = this.state.commitment;
    if (!c) return null;
    const done = promiseDone(this.world, c);
    if (!done && this.state.tick < c.due) return null;
    this.state.commitment = null;
    if (done) {
      this.nudgeApproval(PROMISE.kept);
      return `${promiseKept(c.kind)}: los vecinos lo festejan`;
    }
    this.nudgeApproval(-PROMISE.broken);
    this.state.grief += PROMISE.grief;
    return 'Lo prometió el Intendente y no cumplió: el barrio corta la calle';
  }

  /**
   * The event of the month, if there is one. It stays pending until the player answers, so the
   * window reopens after a load and nothing gets decided behind their back.
   */
  private fireEvent(): void {
    const event = eventOfMonth(this, this.rng);
    if (!event) return;
    this.state.pendingEvent = event.id;
    this.state.lastEvent = this.state.tick;
    this.state.recentEvents = [event.id, ...this.state.recentEvents].slice(0, EVENT.cooldown);
  }

  /** Turns an effect on for `months` months, or extends it if it was already running. */
  effect(key: string, months: number): void {
    if (months <= 0) return;
    this.state.effects[key] = Math.max(this.state.effects[key] ?? 0, Math.round(months));
  }

  /** True while the effect is running. */
  hasEffect(key: string): boolean {
    return (this.state.effects[key] ?? 0) > 0;
  }

  /** Abandons the building in a cell: nobody lives or works there any more (see `setAbandoned`). */
  abandonBuilding(cell: number): void {
    if (this.world.level[cell] > 0 && !this.world.abandoned[cell]) this.setAbandoned(cell, true);
  }

  /** A roll of the simulation's own dice: a saved game plays the same. */
  chance(p: number): boolean {
    return this.rng.chance(p);
  }

  /** Publishes a headline in the paper, even before it has opened: the neighbours know anyway. */
  report(text: string): void {
    this.publish(text, true);
  }

  /** Sets the budget for green spaces (percent); how well the plazas are kept follows. */
  setGreen(percent: number): void {
    if (this.hasEffect(lockOf('green'))) return;
    this.state.green = Math.max(0, Math.min(MAX_FUNDING, Math.round(percent)));
    computeParks(this.world, this.state.green);
    computeLandValue(this.world);
    // The neighbours notice the dry plazas at once, not on the first of next month.
    this.approval = this.judge();
  }

  /** Sets the budget for the power plants (percent); what they generate follows at once. */
  setPlants(percent: number): void {
    this.state.plants = Math.max(0, Math.min(MAX_FUNDING, Math.round(percent)));
    this.refresh();
  }

  /** Sets the budget for the streets (percent); how much traffic they carry follows at once. */
  setRoads(percent: number): void {
    this.state.roads = Math.max(0, Math.min(MAX_FUNDING, Math.round(percent)));
    this.updateFields();
    this.approval = this.judge();
  }

  /** Sets the budget for the bus lines (percent); how much traffic they take off follows at once. */
  setTransport(percent: number): void {
    this.state.transport = Math.max(0, Math.min(MAX_FUNDING, Math.round(percent)));
    this.updateFields();
    this.approval = this.judge();
  }

  /** Sets a service's budget (percent of its standard upkeep); its coverage follows at once. */
  setFunding(kind: ServiceKind, percent: number): void {
    if (this.hasEffect(lockOf(kind))) return;
    const floor = kind === 'school' || kind === 'university' ? GOVERNMENTS[this.state.government].fundingFloor : 0;
    this.state.funding[kind] = Math.max(floor, Math.min(MAX_FUNDING, Math.round(percent)));
    this.updateFields();
  }

  /**
   * La orden de venta del campo. El jugador fija los dos umbrales y el sistema los ejecuta en el cierre del
   * mes: no hay un botón de "Vender", por la misma razón que no lo hay de "Subir el impuesto".
   */
  setSellOrder(order: SellOrder): void {
    this.state.order = {
      minPrice: Math.max(0, Math.round(order.minPrice)),
      keepTons: Math.max(0, Math.round(order.keepTons)),
    };
  }

  /** El perfil de la apuesta del campo: qué parte de los lotes va en soja, de 0 a 100. */
  setCampoRisk(risk: number): void {
    this.state.campoRisk = Math.max(0, Math.min(100, Math.round(risk)));
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
    this.stepTornado();
    this.grow();
    this.reachMilestones();
    this.reachRunMarks();
    s.tick++;
    if (s.tick % TICKS_PER_MONTH === 0) this.endOfMonth();
    else if (s.tick % TICKS_PER_WEEK === 0) this.settleWeek();
    s.rngState = this.rng.state;
  }

  private grow(): void {
    // A piquete, a rationing month or a jammed avenue: nothing new is built while it lasts.
    if (this.hasEffect(FREEZE)) return;
    const w = this.world;
    const rng = this.rng;
    const size = w.n * w.n;
    const start = rng.int(size);
    const t = this.totals;
    // How fast homes are raised, by the form of government: less people come, but they are not turned away at a line.
    const migration = GOVERNMENTS[this.state.government].migration;
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
        if (d < -20 && rng.chance(0.002 * (-d / 100))) {
          this.changeLevel(i, level - 1);
          continue;
        }
      }
      if (!served || this.state.crisis || d <= 0) continue;
      const cap = levelCap(zone, w.landValue[i], t.pop, { edu: w.edu[i], health: w.health[i], hospital: w.hospital[i], university: w.university[i], educated: this.schooled });
      if (level >= cap) {
        if (level > cap && rng.chance(0.002)) this.changeLevel(i, level - 1);
        continue;
      }
      // Some humble buildings are never improved by their owners: they stay until the player tears them down.
      if (level === HUMBLE && isHoldout(w.variant[i])) continue;
      if (rng.chance(((GROWTH_RATE * d) / 100 / (1 + level * 0.5)) * jamGrowthFactor(w.jam[i]) * (zone === 'R' ? migration * this.mods.migration : 1) * this.mods.growth)) {
        this.changeLevel(i, level === 0 ? spawnLevel(t.pop, cap) : level + 1);
        w.variant[i] = rng.int(256);
        w.terrain.trees[i] = 0;
      }
    }
  }

  private changeLevel(i: number, level: number): void {
    const w = this.world;
    const tile = w.tiles[i];
    if ((w.level[i] === 0) !== (level === 0)) this.powerDirty = true; // a building appears or goes: the light network changes
    addBuilding(this.totals, tile, w.level[i], -1, this.mods);
    w.setLevel(i, level);
    addBuilding(this.totals, tile, level, 1, this.mods);
    this.recomputeDemand();
  }

  private setAbandoned(i: number, abandoned: boolean): void {
    const w = this.world;
    addBuilding(this.totals, w.tiles[i], w.level[i], abandoned ? -1 : 1, this.mods);
    w.abandoned[i] = abandoned ? 1 : 0;
    this.abandonedCount += abandoned ? 1 : -1;
    w.markDirty(i);
    this.recomputeDemand();
  }

  /** Fires burn down; covered ones are put out and the building survives. Fires spread without cover. */
  private burn(): void {
    const w = this.world;
    const n = w.n;
    for (const i of Array.from(this.burning)) {
      w.fire[i]--;
      // Un foco grande arde hasta el final: la cobertura no lo salva. Los demás, sí.
      const big = this.bigFire.has(i);
      const covered = !big && w.fireCover[i] >= FIRE_SAFE_COVER;
      if (!covered && w.fire[i] % 15 === 0) {
        const x = i % n;
        const y = (i - x) / n;
        for (const j of [x > 0 ? i - 1 : -1, x < n - 1 ? i + 1 : -1, y > 0 ? i - n : -1, y < n - 1 ? i + n : -1]) {
          // Un foco grande prende a sus vecinos aunque estén cubiertos: la cobertura apaga el fuego del
          // vecino, pero no impide que se prenda. El que se prende es un fuego común, no un foco grande.
          if (j >= 0 && w.isOccupied(j) && zoneOf(w.tiles[j]) && (big || w.fireCover[j] < FIRE_SAFE_COVER) && this.rng.chance(FIRE_SPREAD)) this.ignite(j);
        }
      }
      if (w.fire[i] > 0) continue;
      this.burning.delete(i);
      this.bigFire.delete(i);
      if (covered) {
        addBuilding(this.totals, w.tiles[i], w.level[i], 1, this.mods);
        this.stats.firesSaved++;
      } else {
        w.level[i] = 0;
        this.powerDirty = true; // the building no longer passes the light on
        this.stats.buildingsBurned++;
      }
      w.markDirty(i);
      this.recomputeDemand();
    }
  }

  private ignite(i: number): void {
    const w = this.world;
    if (w.fire[i] || !w.isOccupied(i)) return;
    addBuilding(this.totals, w.tiles[i], w.level[i], -1, this.mods);
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
    this.recomputeDemand();
  }

  /** Each month a few dense buildings may catch fire; fire coverage makes it much rarer. */
  private igniteFires(): void {
    const w = this.world;
    const cityFactor = Math.min(1, this.totals.pop / 1500);
    if (cityFactor === 0) return;
    for (let i = 0; i < w.tiles.length; i++) {
      const zone = zoneOf(w.tiles[i]);
      if (!zone || w.level[i] < 3 || !w.isOccupied(i)) continue;
      const risk = (w.level[i] - 1) * 10 + (zone === 'I' ? 20 : zone === 'C' ? 5 : 0);
      // Coverage makes fires rarer but never impossible; covered ones get put out (see `burn`).
      const exposure = 1 - (0.7 * w.fireCover[i]) / 100;
      if (this.rng.chance(((FIRE_RATE * risk) / 10) * cityFactor * exposure * exposure)) this.ignite(i);
    }
  }

  /**
   * Un foco de incendio grande: se prende igual que cualquier fuego, pero **los bomberos no lo apagan**.
   *
   * Si la cobertura lo salvara, el incendio grande sería un incendio común con otro nombre. La cobertura
   * sigue sirviendo para lo demás: para que no se prenda nada más en el barrio, y para que los focos
   * vecinos, que son fuegos comunes, se apaguen antes de que el edificio se pierda.
   */
  private igniteGrande(i: number): void {
    const w = this.world;
    if (w.fire[i] || !w.isOccupied(i)) return;
    addBuilding(this.totals, w.tiles[i], w.level[i], -1, this.mods);
    w.fire[i] = 90;
    w.markDirty(i);
    this.burning.add(i);
    this.bigFire.add(i);
    this.stats.firesStarted++;
    this.recomputeDemand();
  }

  /**
   * Un incendio grande: varios focos a la vez en un barrio. El jugador lo corta como puede —demoliendo una
   * franja para que el fuego no tenga por dónde seguir, o rodeando el barrio de cuarteles—, y después
   * reconstruye lo que quedó baldío.
   */
  private incendioGrande(): void {
    const centre = this.anyBuilding();
    if (centre < 0) return;
    const hit = this.builtAround(centre, DESASTRE.radio).slice(0, DESASTRE.focos);
    if (hit.length === 0) return;
    for (const i of hit) this.igniteGrande(i);
    this.publish(`Incendio grande en ${this.cityName}: se prende un barrio entero y los bomberos no dan abasto`, true);
  }

  /**
   * Si el tornado puede pasar este mes.
   *
   * Hoy la respuesta es que no: el desastre está parado desde `DESASTRE.tornadoEnabled` (ver el comentario
   * ahí). Cuando se vuelva a prender, la regla es que los primeros diez años de la ciudad están a salvo y no
   * hay ninguna otra condición: no se puede prevenir, ni comprar, ni apagar.
   */
  tornadoAllowed(): boolean {
    return tornadoAllowedAt(this.state.tick);
  }

  /**
   * El tornado: entra por un borde del mapa, cruza en línea recta y sale por el otro, dejando el camino
   * destruido. **No se frena**: la cobertura de bomberos no lo desvía ni lo acorta, porque un tornado no es
   * un incendio y el juego no tiene con qué pelearle. Pasa por X zona y listo.
   *
   * Cruza **de a una celda por tick**, no de un golpe: el embudo tiene que verse venir, y lo que se lleva lo
   * tiene que ir tirando a la vista. El ancho no lo decide el azar, lo decide el impuesto promedio de la
   * ciudad: al tope entra angosto, por el piso se lleva la manzana entera.
   */
  private startTornado(): void {
    const n = this.world.n;
    this.tornado = newTornado(n, tornadoWidthFor(this.state.taxes), this.rng);
    this.tornadoLost = 0;
    this.tornadoAlarmHeard = false;
    const { wide, narrow } = DESASTRE.tornadoWidth;
    this.publish(
      this.tornado.width <= narrow
        ? `Un tornado entró a ${this.cityName} por el ${this.tornadoSide()}: los impuestos altos pagaron el radar y la ciudad se enteró a tiempo, así que el embudo pasa por una línea`
        : this.tornado.width >= wide
          ? `Un tornado entró a ${this.cityName} por el ${this.tornadoSide()}: sin plata para mirar el cielo nadie lo vio venir y el embudo entra ancho, con toda la manzana adentro`
          : `Un tornado entró a ${this.cityName} por el ${this.tornadoSide()}: viene ancho y no hay bomberos que lo paren`,
      true,
    );
  }

  /** Por dónde entró, en palabras: el diario no dice "por el borde 0". */
  private tornadoSide(): string {
    const t = this.tornado;
    if (!t) return 'sur';
    if (t.horizontal) return t.dir > 0 ? 'oeste' : 'este';
    return t.dir > 0 ? 'norte' : 'sur';
  }

  /**
   * Un paso del tornado: se lleva lo que pisa en la celda que está cruzando y avanza una.
   *
   * Se llama en cada tick. Cuando sale por el otro lado, el tornado se termina y el diario cuenta lo que
   * costó. El recorrido y las celdas los resuelve `sim/tornado.ts`, que es el mismo módulo que usa el
   * render para dibujar el embudo: si se calcularan por separado, el dibujo y el daño se desincronizarían.
   */
  private stepTornado(): void {
    const run = this.tornado;
    if (!run) return;
    const w = this.world;
    const n = w.n;
    for (const [x, y] of tornadoCellsOf(run, n)) {
      if (!w.inBounds(x, y)) continue;
      const i = w.idx(x, y);
      if (w.level[i] === 0) continue;
      if (!w.abandoned[i]) addBuilding(this.totals, w.tiles[i], w.level[i], -1, this.mods);
      w.level[i] = 0;
      w.abandoned[i] = 0;
      w.fire[i] = 0;
      this.burning.delete(i);
      w.markDirty(i);
      this.tornadoLost++;
      this.stats.buildingsBurned++;
    }
    this.powerDirty = true;
    advanceTornado(run, this.rng);
    if (!tornadoDone(run, n)) {
      this.recomputeDemand();
      return;
    }
    this.tornado = null;
    this.recomputeDemand();
    const lost = this.tornadoLost;
    this.publish(
      lost === 0
        ? `El tornado cruzó ${this.cityName} sin tocar nada: pasó por el campo y se fue`
        : `El tornado salió de ${this.cityName} y dejó ${lost} ${lost === 1 ? 'edificio' : 'edificios'} en el piso: no hubo bomberos que lo pararan`,
      true,
    );
  }

  /**
   * Si hay que sonar la alarma ahora: una sola vez por tornado, y sólo cuando el embudo entra en el radio.
   * La consume el que la hace sonar, así que dos llamadas seguidas no la repiten.
   */
  takeTornadoAlarm(): boolean {
    if (this.tornadoAlarmHeard || !this.tornadoNear()) return false;
    this.tornadoAlarmHeard = true;
    return true;
  }

  /** Si el embudo está lo bastante cerca del centro para que suene la alarma. */
  tornadoNear(): boolean {
    const run = this.tornado;
    if (!run) return false;
    const n = this.world.n;
    const [x, y] = tornadoCellsOf(run, n)[0] ?? [0, 0];
    const half = n / 2;
    // El radio se mide sobre el mapa, así que en un mapa chico no puede ser más grande que él: sin el tope,
    // en un pueblo de veinte celdas la alarma sonaba desde que el embudo asomaba.
    const reach = Math.min(DESASTRE.tornadoAlarmAt, n * 0.2);
    return Math.hypot(x - half, y - half) <= reach;
  }

  /** Los dos desastres que pasan sin pedir permiso. Cada uno tira su propia chance, una vez por mes. */
  private desastres(): void {
    if (this.totals.pop >= DESASTRE.fireFrom && this.rng.chance(DESASTRE.fireChance)) this.incendioGrande();
    if (this.tornadoAllowed() && this.rng.chance(DESASTRE.tornadoChance)) this.startTornado();
  }

  /**
   * Un mes más de servicio para cada usina. Cuando pasa los cincuenta años avisa una vez en el diario: el
   * aviso no se repite porque lo que hay que hacer ya se dijo, y el jugador que no quiere oírlo no tiene por
   * qué leerlo doce veces por año.
   */
  private agePlants(): void {
    for (const p of this.world.plants) {
      const age = (p.age ?? 0) + 1;
      p.age = age;
      if (age > PLANT_LIFE.full && !p.warned) {
        p.warned = true;
        this.publish(`La ${PLANTS[p.kind].label.toLowerCase()} cumplió ${Math.floor(age / 12)} años y ya no rinde como antes: conviene levantar una nueva`, true);
      }
    }
  }

  /**
   * Weeks 1 to 3 of a month collect and pay the cumulative quarter of the budget as it stands now;
   * week 4 (see `endOfMonth`) settles the rest, so the month always adds up to its balance.
   */
  private settleWeek(): void {
    const s = this.state;
    const week = Math.floor((s.tick % TICKS_PER_MONTH) / TICKS_PER_WEEK);
    const due = cumulativeShare(monthlyBudget(this.world, s.taxes, s.funding, s.loan, dateOf(s.tick).month, s.green, 1, s.transport, s.government, incomeFactor(s.effects), s.roads, s.plants, this.mods, s.harvest).balance, week);
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
    return cumulativeShare(monthlyBudget(this.world, s.taxes, s.funding, s.loan, dateOf(s.tick).month, s.green, 1, s.transport, s.government, incomeFactor(s.effects), s.roads, s.plants, this.mods, s.harvest).balance, Math.min(week, WEEKS_PER_MONTH - 1));
  }

  /** Counts the instalment this month paid, and closes the loan once the term is done. */
  private advanceLoan(): void {
    const loan = this.state.loan;
    if (!loan) return;
    loan.paid++;
    if (loanPaidOff(loan)) this.state.loan = null;
  }

  /**
   * Moves the city up as soon as its population reaches a milestone, not at the end of the month: the grant,
   * the tools it opens and the news arrive the moment the number is there.
   */
  /**
   * The run's own marks: a draft when the city reaches one, and the goal itself. Called the moment the
   * population is there, like the milestones, so the window opens without waiting for the month.
   */
  private reachRunMarks(): void {
    const run = this.state.run;
    if (!run || run.wonAt !== null) return;
    if (this.totals.pop >= RUN_GOAL) {
      run.wonAt = this.state.tick;
      return;
    }
    // One draft at a time: the card on the table is answered before the next mark deals.
    if (run.offer || this.state.lostElection || this.state.dry >= BANKRUPT_MONTHS) return;
    if (dueMark(run, this.totals.pop) === null) return;
    openOffer(run);
  }

  /** Takes one of the three cards on the table. Null when there is no draft open or the id is not offered. */
  applyUpgrade(id: string): PickResult | null {
    const s = this.state;
    if (!s.run) return null;
    const result = takeUpgrade(s.run, id, s.tick);
    if (!result) return null;
    // A gamble card hits the till and the neighbours' mood at once; the recount below is what moves
    // the population, because it doubles or halves the people each home holds.
    s.cash = Math.round(s.cash * result.cash);
    s.approval = Math.max(0, Math.min(100, Math.round(s.approval * result.approval)));
    // A card can change how many people a building holds, so every derived layer is recounted at once:
    // taking a density upgrade fills the city on the spot, which is the point of the card.
    this.refresh();
    this.reachRunMarks();
    return result;
  }

  private updateRunMods(): void {
    this.mods = runMods(this.state.run, this.state.tick);
  }

  private reachMilestones(): void {
    const s = this.state;
    const next = nextMilestone(s.milestone);
    if (!next || this.totals.pop < next.pop) return;
    for (const m of advanceMilestones(s, this.totals.pop, GOVERNMENTS[s.government].grants)) {
      if (!this.paperOpen()) continue;
      const opens = unlockNames(m, (t) => toolInfo(t).label.toLowerCase());
      this.publish(milestoneHeadline(this.cityName, m.name, opens, s.government, m.grant), true);
      // El campo tiene su propia línea: en el titular del hito queda enterrado entre las otras seis herramientas.
      if (m.unlocks.includes('farm')) this.publish(campoHeadline(this.cityName), false);
    }
  }

  private endOfMonth(): void {
    const s = this.state;
    const w = this.world;
    // A stage of an upgrade can start with the month, so the knobs are read before the budget does.
    this.updateRunMods();
    this.fireNews = 0;
    this.openPaper(); // before the month's fires, so the opening month can report them
    this.igniteFires();
    this.desastres();
    this.agePlants();
    // The tick already belongs to the next month: the season is the one of the month that just ended.
    const month = dateOf(s.tick - 1).month;
    // La cosecha se resuelve antes del presupuesto: el ingreso de la feria es plata de este mes y tiene que
    // entrar por la misma caja que el impuesto, no por un costado.
    s.harvest = settleHarvest(w, month, s.order, s.campoRisk, hashString(this.cityName), dateOf(s.tick - 1).year);
    // La cosecha entra de golpe y sin aviso sería un misterio en la caja: el diario dice qué pasó con las
    // toneladas, que es lo único que explica un salto de miles de pesos en un mes.
    const harvestLine = harvestNews(s.harvest);
    if (harvestLine) this.publish(harvestLine, true);
    const budget = monthlyBudget(w, s.taxes, s.funding, s.loan, month, s.green, factorOf(s.effects, COAST_BOOST), s.transport, s.government, incomeFactor(s.effects), s.roads, s.plants, this.mods, s.harvest);
    s.lastBudget = budget;
    s.cash += budget.balance - this.monthPaid; // the 4th week pays whatever the first three left
    this.monthPaid = 0;
    s.crisis = s.cash < 0;
    // A year in the red sinks the city, whatever the government; one month in the black starts the
    // count again.
    s.dry = s.cash < 0 ? s.dry + 1 : 0;
    this.checkBankruptcy();
    // The patience of the neighbours is read with the month it just had: who loses their home over it.
    this.stepAnger();
    this.advanceLoan();
    this.totals = cityTotals(w, this.mods);
    this.abandonedCount = countAbandoned(w);
    this.updateAppetite();
    this.reachMilestones();
    this.reachRunMarks();
    this.approval = this.judge();
    s.approval = stepApproval(s.approval, this.approval.target, s.government);
    this.checkOverthrow();
    // The cabildo works the neighbourhoods all year, and doubles its effort in the month of the election.
    const cabildo = uniqueApproval(w, month);
    if (cabildo > 0) s.approval = Math.min(GOVERNMENTS[s.government].approvalCap, Math.round(s.approval + cabildo));
    if (s.government === 'teocracia') this.judgement();
    const planLine = s.government === 'comunismo' ? this.settlePlan() : null;
    // The promise comes first: it is what the neighbours were waiting for all month.
    const promiseLine = this.settlePromise();
    tickEffects(s.effects);
    // The grudge of the demolitions wears off month by month, and dies below one person.
    s.grief = s.grief > 1 ? Math.max(1, Math.floor(s.grief * DEMOLITION.keep)) : 0;
    s.history.push({ pop: this.totals.pop, cash: s.cash });
    if (s.history.length > MAX_HISTORY) s.history.shift();

    this.fireEvent();
    // A promise kept or lost is news even before the paper has opened: the neighbours saw it.
    if (promiseLine) this.publish(promiseLine, true);
    if (planLine) this.publish(planLine, true);
    const snap = this.snapshot();
    if (this.paperOpen()) {
      const lines = headlinesFor(this.prevSnapshot, snap, this.cityName);
      lines.push(...this.hints());
      if (lines.length === 0 && this.rng.chance(0.3)) lines.push(this.rng.pick(FILLERS));
      for (const l of lines) this.publish(l, true); // the paper is open here
    }
    // While the paper is closed the snapshot still advances: those events are never reported.
    this.prevSnapshot = snap;
    this.holdElection(snap.year);
  }

  /**
   * La calle: la dictadura no pierde en octubre, pero se cae cualquier mes en que el pueblo la odie lo
   * suficiente. Es la contracara de no tener elecciones, y por eso el umbral vive en la forma de gobierno
   * y no en la campaña: sin elecciones no hay nada que esperar, la cuenta se cierra el mismo mes.
   *
   * No hay un segundo golpe sobre una partida ya perdida: el que se fue, se fue.
   */
  /**
   * La caja: doce meses seguidos en rojo y la Provincia interviene el municipio. No distingue gobierno —al
   * que no puede pagar los sueldos no lo salva ni la fe ni el Partido— y no tiene segunda vuelta.
   *
   * Con la ciudad en modo libre la partida ya está perdida, así que no hay una segunda intervención.
   */
  private checkBankruptcy(): void {
    const s = this.state;
    if (s.lostElection || s.dry < BANKRUPT_MONTHS) return;
    s.lostElection = true;
    const quien = this.mayor ? `al ${intendente(this.mayor)}` : 'al Intendente';
    this.publish(
      `${BANKRUPT_MONTHS} meses con la caja en rojo: la Provincia intervino ${this.cityName} y sacó ${quien} del gobierno: la ciudad queda en modo libre`,
      true,
    );
  }

  private checkOverthrow(): void {
    const s = this.state;
    if (s.lostElection) return;
    const floor = GOVERNMENTS[s.government].overthrowBelow;
    if (floor === null || s.approval >= floor) return;
    s.lostElection = true;
    const quien = this.mayor ? `al ${intendente(this.mayor)}` : 'al Intendente';
    this.publish(
      `Con ${s.approval} % de aprobación, una movilización popular tomó la Municipalidad y sacó ${quien} del gobierno: ${this.cityName} queda en modo libre`,
      true,
    );
  }

  /**
   * Polls a year and six months before each election, and the election itself when October ends:
   * the Intendente stays with `APPROVAL.toWin` or more. A lost election ends the mandate for good.
   */
  private holdElection(year: number): void {
    const s = this.state;
    if (s.lostElection) return;
    const gov = GOVERNMENTS[s.government];
    // Under a dictatorship nobody votes, but the calendar still says October: the paper covers the act.
    if (gov.termYears === null) {
      if (!electionDue(s.tick, 'democracia')) return;
      if (s.government === 'teocracia') {
        this.publish(misaHeadline(year), true);
        return;
      }
      this.publish(this.rng.pick(DICTATOR_FOLLOWUPS), true);
      this.publish(dictatorHeadline(year, s.party, this.mayor), true);
      return;
    }
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
    hint('appetite', this.appetite === 1 && !this.power.shortage && averageTax(s.taxes) > APPETITE_TAX_TO, 'Con impuestos tan altos, nadie quiere mudarse: la ciudad dejó de atraer gente');
    hint('blight', this.appetite === 1 && !this.power.shortage && averageTax(s.taxes) <= APPETITE_TAX_TO && this.abandonedCount > 0, 'El abandono espanta a los nuevos vecinos: hay que recuperar o demoler los edificios vacíos');
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
      green: this.state.green,
      grief: this.state.grief,
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
