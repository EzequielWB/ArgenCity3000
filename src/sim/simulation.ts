import { DEFAULT_TAX, FIRE_SAFE_COVER, INITIAL_CASH, MAX_TAX, MIN_TAX, TICKS_PER_MONTH } from '../config';
import { Rng } from '../core/rng';
import { World, zoneOf, type ZoneKind } from '../world/world';
import { buildingName } from './report';
import { monthlyBudget, type BudgetReport } from './budget';
import { dateLabel, dateOf } from './calendar';
import { GROWTH_APPETITE, addBuilding, cityTotals, computeDemand, levelCap, type Demand, type Totals } from './demand';
import { computeCrime, computeLandValue, computePollution, computeRoadAccess, computeServices } from './fields';
import { FILLERS, headlinesFor, type CitySnapshot, type NewsItem } from './news';
import { computePower, type PowerReport } from './power';

export interface SimState {
  tick: number;
  cash: number;
  tax: number;
  rngState: number;
  crisis: boolean;
  lastBudget: BudgetReport | null;
  /** Newest first. */
  news: NewsItem[];
  /** One entry per month. */
  history: { pop: number; cash: number }[];
  /** Tick at which each advice headline was last published. */
  hints: Record<string, number>;
}

export function newSimState(seed: number): SimState {
  return {
    tick: 0,
    cash: INITIAL_CASH,
    tax: DEFAULT_TAX,
    rngState: seed >>> 0,
    crisis: false,
    lastBudget: null,
    news: [],
    history: [],
    hints: {},
  };
}

const GROWTH_RATE = 0.01;
/** Above this tax rate the city stops attracting extra newcomers. */
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

function countAbandoned(w: World): number {
  let c = 0;
  for (let i = 0; i < w.abandoned.length; i++) if (w.abandoned[i] && w.level[i] > 0) c++;
  return c;
}
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
  /** Above 1 the city attracts newcomers beyond what its jobs justify (see `updateAppetite`). */
  appetite = GROWTH_APPETITE;
  abandonedCount = 0;
  /** Counters for this session (not saved). */
  stats = { firesStarted: 0, firesSaved: 0, buildingsBurned: 0 };
  private burning = new Set<number>();
  private fireNews = 0;

  private rng: Rng;
  private seenNetwork = -1;
  private prevSnapshot: CitySnapshot;

  constructor(world: World, state: SimState, cityName: string) {
    this.world = world;
    this.state = state;
    this.cityName = cityName;
    this.rng = new Rng(state.rngState);
    this.refresh();
    this.prevSnapshot = this.snapshot();
    if (state.tick === 0 && state.news.length === 0) {
      this.publish(`Se funda ${cityName}: el Intendente promete calles, luz y progreso`);
    }
  }

  /** Recomputes every derived layer. Call after loading or after big edits. */
  refresh(): void {
    const w = this.world;
    this.seenNetwork = w.networkVersion;
    computeRoadAccess(w);
    this.power = computePower(w);
    this.totals = cityTotals(w);
    this.updateFields();
    this.abandonedCount = countAbandoned(w);
    this.burning.clear();
    for (let i = 0; i < w.fire.length; i++) if (w.fire[i]) this.burning.add(i);
    this.updateAppetite();
  }

  /** Services, pollution, crime and land value, in that order (each needs the previous). */
  private updateFields(): void {
    const w = this.world;
    computeServices(w);
    computePollution(w);
    computeCrime(w, this.totals.pop);
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
    this.appetite = !this.power.shortage && this.state.tax <= APPETITE_MAX_TAX && !blighted ? GROWTH_APPETITE : 1;
    this.demand = computeDemand(this.totals, this.state.tax, this.appetite);
  }

  /** Charges `cost` if the city can afford it. */
  spend(cost: number): boolean {
    if (cost > this.state.cash) return false;
    this.state.cash -= cost;
    return true;
  }

  setTax(tax: number): void {
    this.state.tax = Math.max(MIN_TAX, Math.min(MAX_TAX, Math.round(tax)));
    this.updateAppetite();
  }

  tick(): void {
    const w = this.world;
    const s = this.state;
    if (w.networkVersion !== this.seenNetwork) {
      this.refresh();
    } else {
      if (s.tick % 5 === 0) {
        this.power = computePower(w);
        this.updateAppetite();
      }
      if (s.tick % 30 === 0) this.updateFields();
    }
    s.crisis = s.cash < 0;
    this.burn();
    this.grow();
    s.tick++;
    if (s.tick % TICKS_PER_MONTH === 0) this.endOfMonth();
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
      if (rng.chance((GROWTH_RATE * d) / 100 / (1 + level * 0.5))) {
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
    addBuilding(this.totals, tile, w.level[i], -1);
    w.setLevel(i, level);
    addBuilding(this.totals, tile, level, 1);
    this.demand = computeDemand(this.totals, this.state.tax, this.appetite);
  }

  private setAbandoned(i: number, abandoned: boolean): void {
    const w = this.world;
    addBuilding(this.totals, w.tiles[i], w.level[i], abandoned ? -1 : 1);
    w.abandoned[i] = abandoned ? 1 : 0;
    this.abandonedCount += abandoned ? 1 : -1;
    w.markDirty(i);
    this.demand = computeDemand(this.totals, this.state.tax, this.appetite);
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
        this.stats.buildingsBurned++;
      }
      w.markDirty(i);
      this.demand = computeDemand(this.totals, this.state.tax, this.appetite);
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
    this.demand = computeDemand(this.totals, this.state.tax, this.appetite);
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

  private endOfMonth(): void {
    const s = this.state;
    const w = this.world;
    this.fireNews = 0;
    this.igniteFires();
    const budget = monthlyBudget(w, s.tax);
    s.lastBudget = budget;
    s.cash += budget.balance;
    s.crisis = s.cash < 0;
    this.totals = cityTotals(w);
    this.abandonedCount = countAbandoned(w);
    this.updateAppetite();
    s.history.push({ pop: this.totals.pop, cash: s.cash });
    if (s.history.length > MAX_HISTORY) s.history.shift();

    const snap = this.snapshot();
    const lines = headlinesFor(this.prevSnapshot, snap, this.cityName);
    lines.push(...this.hints());
    if (lines.length === 0 && this.rng.chance(0.3)) lines.push(this.rng.pick(FILLERS));
    for (const l of lines) this.publish(l);
    this.prevSnapshot = snap;
  }

  private hints(): string[] {
    const w = this.world;
    const s = this.state;
    const out: string[] = [];
    let zoned = 0;
    let noRoad = 0;
    const free: Record<ZoneKind, number> = { R: 0, C: 0, I: 0 };
    let smog = 0;
    for (let i = 0; i < w.tiles.length; i++) {
      const z = zoneOf(w.tiles[i]);
      if (!z) continue;
      zoned++;
      if (!w.roadAccess[i]) noRoad++;
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
    hint('noRoad', noRoad > 8, 'Vecinos reclaman calles para llegar a sus terrenos');
    hint('needR', this.demand.R > 50 && free.R === 0 && zoned > 0, `Faltan viviendas: hay familias que quieren mudarse a ${this.cityName}`);
    hint('needC', this.demand.C > 50 && free.C === 0 && zoned > 0, 'Los comerciantes buscan locales y no encuentran');
    hint('needI', this.demand.I > 50 && free.I === 0 && zoned > 0, 'Industriales buscan terrenos para instalarse');
    hint('power', this.power.shortage, 'La usina no da abasto: los vecinos piden otra usina');
    hint('appetite', this.appetite === 1 && !this.power.shortage && s.tax > APPETITE_MAX_TAX, 'Con tasas tan altas, nadie quiere mudarse: la ciudad dejó de atraer gente');
    hint('blight', this.appetite === 1 && !this.power.shortage && s.tax <= APPETITE_MAX_TAX && this.abandonedCount > 0, 'El abandono espanta a los nuevos vecinos: hay que recuperar o demoler los edificios vacíos');
    hint('smog', smog > 5, 'Vecinos se quejan del humo de las fábricas');
    return out;
  }

  private snapshot(): CitySnapshot {
    const { month, year } = dateOf(this.state.tick);
    let buildings = 0;
    for (let i = 0; i < this.world.level.length; i++) if (this.world.level[i] > 0) buildings++;
    return {
      pop: this.totals.pop,
      buildings,
      plants: this.world.plants.length,
      shortage: this.power.shortage,
      crisis: this.state.crisis,
      tax: this.state.tax,
      month,
      year,
      cash: this.state.cash,
      abandoned: this.abandonedCount,
    };
  }

  private publish(text: string): void {
    this.state.news.unshift({ date: dateLabel(this.state.tick), text });
    if (this.state.news.length > MAX_NEWS) this.state.news.length = MAX_NEWS;
  }
}
