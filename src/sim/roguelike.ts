/**
 * The roguelike run: a separate game whose goal is a million residents. The city plays as always;
 * what changes is the goal, the run's own marks and the upgrades the player drafts at each one.
 * Every upgrade moves one of the knobs in `RunMods`, and the systems that already own each number
 * read those knobs instead of a second set of rules.
 */
import { TICKS_PER_MONTH } from '../config';
import { Rng } from '../core/rng';

/** Residents that win the run. */
export const RUN_GOAL = 1_000_000;

/** Population marks where the player drafts. The goal itself is the win, not a pick. */
export const RUN_MARKS: readonly number[] = [500, 2000, 5000, 10000, 25000, 50000, 100000, 200000, 350000, 500000, 700000];

/**
 * The knobs the upgrades move. Everything is a multiplier except `land`, which is points added to
 * the land value of every lot: 1 (and 0 for `land`) is the normal game, so a run without upgrades
 * computes exactly what the classic game computes.
 */
export interface RunMods {
  /** Residents per home. */
  density: number;
  /** Jobs per shop and factory. */
  jobs: number;
  /** The municipal administration line. */
  admin: number;
  /** How much the administration grows with the size of the city: 0 = it never does. */
  adminCurve: number;
  /** Points added to every lot's land value (can be negative). */
  land: number;
  /** Output of every power plant. */
  power: number;
  /** How fast the city grows. */
  growth: number;
  /** How many newcomers arrive. */
  migration: number;
  /** What the city collects. */
  income: number;
  /** What the public services cost to keep. */
  serviceCost: number;
}

export const NO_MODS: RunMods = { density: 1, jobs: 1, admin: 1, adminCurve: 1, land: 0, power: 1, growth: 1, migration: 1, income: 1, serviceCost: 1 };

export type UpgradeKind = 'buena' | 'mixta' | 'semilla';

export const KIND_LABEL: Record<UpgradeKind, string> = { buena: 'Solo buena', mixta: 'Con costo', semilla: 'A futuro' };

/** One turn of an upgrade: it starts `after` months from the pick and lasts to the end. */
export interface UpgradeStage {
  after: number;
  mods: Partial<RunMods>;
}

export interface Upgrade {
  id: string;
  label: string;
  /** What it does, in the game's voice, including when each stage lands. */
  blurb: string;
  kind: UpgradeKind;
  stages: readonly UpgradeStage[];
}

/**
 * The pool. Twenty cards for eleven picks, so no run sees the whole deck: the run is about which
 * engine you build, not about having every toy.
 */
export const UPGRADES: readonly Upgrade[] = [
  // ---- Only good
  { id: 'torres', label: 'Torres de propiedad horizontal', kind: 'buena', blurb: 'Cada vivienda alberga un 30 % más de gente.', stages: [{ after: 0, mods: { density: 1.3 } }] },
  { id: 'polo', label: 'Parque industrial planificado', kind: 'buena', blurb: 'Cada fábrica y cada comercio dan un 35 % más de puestos.', stages: [{ after: 0, mods: { jobs: 1.35 } }] },
  { id: 'catastro', label: 'Catastro digital', kind: 'buena', blurb: 'Nadie deja de pagar: la ciudad recauda un 15 % más.', stages: [{ after: 0, mods: { income: 1.15 } }] },
  { id: 'red', label: 'Red de alta tensión', kind: 'buena', blurb: 'Cada usina rinde un 60 % más.', stages: [{ after: 0, mods: { power: 1.6 } }] },
  { id: 'compras', label: 'Compras públicas', kind: 'buena', blurb: 'Los servicios cuestan un 20 % menos de mantener.', stages: [{ after: 0, mods: { serviceCost: 0.8 } }] },
  { id: 'obra', label: 'Plan de obra pública', kind: 'buena', blurb: 'La ciudad crece un 25 % más rápido.', stages: [{ after: 0, mods: { growth: 1.25 } }] },
  { id: 'descentralizacion', label: 'Descentralización municipal', kind: 'buena', blurb: 'Se acaba el costo de administrar una ciudad grande (queda en un 45 %) y la administración cuesta un 5 % menos.', stages: [{ after: 0, mods: { adminCurve: 0.55, admin: 0.95 } }] },
  // ---- Gives and takes
  { id: 'altura', label: 'Ley de altura libre', kind: 'mixta', blurb: 'Cada vivienda alberga un 45 % más de gente, pero el suelo pierde 6 puntos de valor.', stages: [{ after: 0, mods: { density: 1.45, land: -6 } }] },
  { id: 'tarifazo', label: 'Tarifazo', kind: 'mixta', blurb: 'La ciudad recauda un 30 % más, pero llega un 15 % menos de gente nueva.', stages: [{ after: 0, mods: { income: 1.3, migration: 0.85 } }] },
  { id: 'promocion', label: 'Promoción fabril', kind: 'mixta', blurb: 'Cada fábrica da un 45 % más de puestos, y el humo le saca 8 puntos al suelo.', stages: [{ after: 0, mods: { jobs: 1.45, land: -8 } }] },
  { id: 'ajuste', label: 'Ajuste del gasto', kind: 'mixta', blurb: 'Los servicios cuestan un 30 % menos, pero la ciudad crece un 20 % más lenta.', stages: [{ after: 0, mods: { serviceCost: 0.7, growth: 0.8 } }] },
  { id: 'inmobiliario', label: 'Inmobiliario progresivo', kind: 'mixta', blurb: 'Se recauda un 25 % más, pero cada vivienda alberga un 10 % menos.', stages: [{ after: 0, mods: { income: 1.25, density: 0.9 } }] },
  { id: 'reforma-estado', label: 'Reforma del Estado', kind: 'mixta', blurb: 'La administración deja de crecer la mitad con la ciudad, y la ciudad crece un 10 % más lenta.', stages: [{ after: 0, mods: { adminCurve: 0.5, growth: 0.9 } }] },
  // ---- Costs now, pays later
  { id: 'zona-franca', label: 'Zona franca', kind: 'semilla', blurb: 'Cuatro años sin recaudar: un 25 % menos. Después, un 70 % más de ingresos y un 20 % más de puestos.', stages: [{ after: 0, mods: { income: 0.75 } }, { after: 48, mods: { income: 1.7, jobs: 1.2 } }] },
  { id: 'ramal', label: 'Ramal electrificado', kind: 'semilla', blurb: 'Tres años pagando un 25 % más de administración. Después, 18 puntos de valor del suelo y un 15 % más de crecimiento.', stages: [{ after: 0, mods: { admin: 1.25 } }, { after: 36, mods: { land: 18, growth: 1.15 } }] },
  { id: 'petroquimico', label: 'Polo petroquímico', kind: 'semilla', blurb: 'Cuatro años con 12 puntos menos de valor del suelo. Después, un 60 % más de puestos y un 25 % más de ingresos.', stages: [{ after: 0, mods: { land: -12 } }, { after: 48, mods: { jobs: 1.6, income: 1.25 } }] },
  { id: 'canje', label: 'Canje de deuda', kind: 'semilla', blurb: 'Cinco años recaudando un 20 % menos. Después, la administración deja de crecer con la ciudad (queda en un 45 %).', stages: [{ after: 0, mods: { income: 0.8 } }, { after: 60, mods: { adminCurve: 0.45 } }] },
  { id: 'conurbano', label: 'Ley del conurbano', kind: 'semilla', blurb: 'Cuatro años creciendo un 15 % más lento. Después, cada vivienda alberga un 50 % más de gente.', stages: [{ after: 0, mods: { growth: 0.85 } }, { after: 48, mods: { density: 1.5 } }] },
  { id: 'universidad', label: 'Ciudad universitaria', kind: 'semilla', blurb: 'Tres años con los servicios un 20 % más caros. Después, un 35 % más de ingresos y un 15 % más de puestos.', stages: [{ after: 0, mods: { serviceCost: 1.2 } }, { after: 36, mods: { income: 1.35, jobs: 1.15 } }] },
  { id: 'digital', label: 'Gobierno digital', kind: 'semilla', blurb: 'Tres años de papelerío: un 15 % más de administración. Después, la administración crece la mitad con la ciudad.', stages: [{ after: 0, mods: { admin: 1.15 } }, { after: 36, mods: { adminCurve: 0.5 } }] },
];

export function upgradeById(id: string): Upgrade | null {
  return UPGRADES.find((u) => u.id === id) ?? null;
}

/** One upgrade taken, and the tick it was taken at (its stages are counted from there). */
export interface RunPick {
  id: string;
  at: number;
}

/** Months in a row with the cash in the red that sink a run. */
export const RUN_DRY_MONTHS = 24;

export interface RunState {
  picks: RunPick[];
  /** The three upgrades offered while the window is open, or null. Saved, so a loaded game reopens it. */
  offer: string[] | null;
  /** Index in `RUN_MARKS` of the next draft. */
  next: number;
  /** Tick at which the city reached the goal, or null. */
  wonAt: number | null;
  /** Months in a row with the cash in the red: at `RUN_DRY_MONTHS` the run is over. */
  dry: number;
  /** The draft's own random state: same seed, same decisions, same offers. */
  rng: number;
}

export function newRun(seed: number): RunState {
  return { picks: [], offer: null, next: 0, wonAt: null, dry: 0, rng: (seed ^ 0x9e3779b9) >>> 0 };
}

/** Every stage that has already started, folded into one set of knobs. */
export function runMods(run: RunState | null, tick: number): RunMods {
  const mods: RunMods = { ...NO_MODS };
  if (!run) return mods;
  for (const pick of run.picks) {
    const upgrade = upgradeById(pick.id);
    if (!upgrade) continue;
    for (const stage of upgrade.stages) {
      if (tick - pick.at < stage.after * TICKS_PER_MONTH) continue;
      for (const [key, value] of Object.entries(stage.mods) as [keyof RunMods, number][]) {
        if (key === 'land') mods.land += value;
        else mods[key] *= value;
      }
    }
  }
  return mods;
}

/** The mark the city has passed and not drafted for yet, or null. */
export function dueMark(run: RunState, pop: number): number | null {
  return run.next < RUN_MARKS.length && pop >= RUN_MARKS[run.next] ? run.next : null;
}

/**
 * Draws the three cards: one of each class when the pool has them, so every draft has a free win, a
 * bargain and a bet. Already taken upgrades never come back and the three are always different.
 */
export function openOffer(run: RunState): void {
  const rng = new Rng(run.rng);
  const taken = new Set(run.picks.map((p) => p.id));
  const pool = UPGRADES.filter((u) => !taken.has(u.id));
  const offer: string[] = [];
  for (const kind of ['buena', 'mixta', 'semilla'] as const) {
    const of = pool.filter((u) => u.kind === kind && !offer.includes(u.id));
    if (of.length > 0) offer.push(rng.pick(of).id);
  }
  // A class that ran out still leaves three cards on the table.
  while (offer.length < 3) {
    const left = pool.filter((u) => !offer.includes(u.id));
    if (left.length === 0) break;
    offer.push(rng.pick(left).id);
  }
  run.offer = offer.length > 0 ? offer : null;
  run.rng = rng.state;
}

/** Takes one of the offered cards. False when there is no draft open or the id is not on the table. */
export function takeUpgrade(run: RunState, id: string, tick: number): boolean {
  if (!run.offer || !run.offer.includes(id)) return false;
  run.picks.push({ id, at: tick });
  run.offer = null;
  run.next++;
  return true;
}

/** Whether the run is won, lost (by the mandate or by the till), or still going. */
export function runOver(state: { run: RunState | null; lostElection: boolean }): 'ganada' | 'eleccion' | 'caja' | null {
  if (!state.run) return null;
  if (state.run.wonAt !== null) return 'ganada';
  if (state.lostElection) return 'eleccion';
  return state.run.dry >= RUN_DRY_MONTHS ? 'caja' : null;
}

/** The upgrades taken, oldest first, with the label the summary prints. */
export function pickedUpgrades(run: RunState): { label: string; kind: UpgradeKind }[] {
  return run.picks.map((p) => {
    const u = upgradeById(p.id);
    return { label: u?.label ?? p.id, kind: u?.kind ?? 'buena' };
  });
}
