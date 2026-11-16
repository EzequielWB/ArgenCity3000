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
  /**
   * A card that rolls at the table instead of moving fixed knobs: it hits cash, population or
   * approval (see `rollGamble`). Its `stages` are empty and the result is written into the pick.
   */
  gamble?: 'split' | 'allin';
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
  { id: 'descentralizacion', label: 'Descentralización municipal', kind: 'buena', blurb: 'El recargo por tamaño de la ciudad se queda en un 55 %, y la administración entera, un 5 % más barata.', stages: [{ after: 0, mods: { adminCurve: 0.55, admin: 0.95 } }] },
  // ---- Gives and takes
  { id: 'altura', label: 'Ley de altura libre', kind: 'mixta', blurb: 'Cada vivienda alberga un 45 % más de gente, pero el suelo pierde 6 puntos de valor.', stages: [{ after: 0, mods: { density: 1.45, land: -6 } }] },
  { id: 'tarifazo', label: 'Tarifazo', kind: 'mixta', blurb: 'La ciudad recauda un 30 % más, pero llega un 15 % menos de gente nueva.', stages: [{ after: 0, mods: { income: 1.3, migration: 0.85 } }] },
  { id: 'promocion', label: 'Promoción fabril', kind: 'mixta', blurb: 'Cada fábrica da un 45 % más de puestos, y el humo le saca 8 puntos al suelo.', stages: [{ after: 0, mods: { jobs: 1.45, land: -8 } }] },
  { id: 'ajuste', label: 'Ajuste del gasto', kind: 'mixta', blurb: 'Los servicios cuestan un 30 % menos, pero la ciudad crece un 20 % más lenta.', stages: [{ after: 0, mods: { serviceCost: 0.7, growth: 0.8 } }] },
  { id: 'inmobiliario', label: 'Inmobiliario progresivo', kind: 'mixta', blurb: 'Se recauda un 25 % más, pero cada vivienda alberga un 10 % menos.', stages: [{ after: 0, mods: { income: 1.25, density: 0.9 } }] },
  { id: 'reforma-estado', label: 'Reforma del Estado', kind: 'mixta', blurb: 'El recargo por tamaño de la ciudad se queda en la mitad, pero la ciudad crece un 10 % más lenta.', stages: [{ after: 0, mods: { adminCurve: 0.5, growth: 0.9 } }] },
  // ---- Costs now, pays later
  { id: 'zona-franca', label: 'Zona franca', kind: 'semilla', blurb: 'Cuatro años sin recaudar: un 25 % menos. Después, un 70 % más de ingresos y un 20 % más de puestos.', stages: [{ after: 0, mods: { income: 0.75 } }, { after: 48, mods: { income: 1.7, jobs: 1.2 } }] },
  { id: 'ramal', label: 'Ramal electrificado', kind: 'semilla', blurb: 'Tres años pagando un 25 % más de administración. Después, 18 puntos de valor del suelo y un 15 % más de crecimiento.', stages: [{ after: 0, mods: { admin: 1.25 } }, { after: 36, mods: { land: 18, growth: 1.15 } }] },
  { id: 'petroquimico', label: 'Polo petroquímico', kind: 'semilla', blurb: 'Cuatro años con 12 puntos menos de valor del suelo. Después, un 60 % más de puestos y un 25 % más de ingresos.', stages: [{ after: 0, mods: { land: -12 } }, { after: 48, mods: { jobs: 1.6, income: 1.25 } }] },
  { id: 'canje', label: 'Canje de deuda', kind: 'semilla', blurb: 'Cinco años recaudando un 20 % menos. Después, el recargo por tamaño se queda en un 45 %.', stages: [{ after: 0, mods: { income: 0.8 } }, { after: 60, mods: { adminCurve: 0.45 } }] },
  { id: 'conurbano', label: 'Ley del conurbano', kind: 'semilla', blurb: 'Cuatro años creciendo un 15 % más lento. Después, cada vivienda alberga un 50 % más de gente.', stages: [{ after: 0, mods: { growth: 0.85 } }, { after: 48, mods: { density: 1.5 } }] },
  { id: 'universidad', label: 'Ciudad universitaria', kind: 'semilla', blurb: 'Tres años con los servicios un 20 % más caros. Después, un 35 % más de ingresos y un 15 % más de puestos.', stages: [{ after: 0, mods: { serviceCost: 1.2 } }, { after: 36, mods: { income: 1.35, jobs: 1.15 } }] },
  { id: 'digital', label: 'Gobierno digital', kind: 'semilla', blurb: 'Tres años de papelerío: un 15 % más de administración. Después, el recargo por tamaño se queda en la mitad.', stages: [{ after: 0, mods: { admin: 1.15 } }, { after: 36, mods: { adminCurve: 0.5 } }] },
  // ---- The two that roll on the spot: they hit cash, population or approval, and the table decides which.
  {
    id: 'cincuenta-cincuenta',
    label: '50/50',
    kind: 'mixta',
    blurb: 'Se sortea al tomarla: duplica una de tres cosas —plata, población o aprobación— y reduce otra a la mitad. No sabés cuáles hasta que la tomás.',
    stages: [],
    gamble: 'split',
  },
  {
    id: 'todo-o-nada',
    label: 'Todo o nada',
    kind: 'mixta',
    blurb: 'Se sortea al tomarla: triplica una de tres cosas —plata, población o aprobación— o te la deja a la mitad.',
    stages: [],
    gamble: 'allin',
  },
];

export function upgradeById(id: string): Upgrade | null {
  return UPGRADES.find((u) => u.id === id) ?? null;
}

/** One upgrade taken, and the tick it was taken at (its stages are counted from there). */
export interface RunPick {
  id: string;
  at: number;
  /** For a card that rolls: the knobs the roll left behind, already resolved. */
  mods?: Partial<RunMods>;
  /** For a card that rolls: what the table did, in words, for the summary. */
  outcome?: string;
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

/** The three things a gamble card can hit. Population moves as density: the homes take more people. */
export const GAMBLE_TARGETS = ['dinero', 'poblacion', 'aprobacion'] as const;
export type GambleTarget = (typeof GAMBLE_TARGETS)[number];

const TARGET_NAME: Record<GambleTarget, string> = { dinero: 'Plata', poblacion: 'Población', aprobacion: 'Aprobación' };

/** What a card did to the city the moment it was taken: multipliers on cash and approval, and a line for the diary. */
export interface PickResult {
  cash: number;
  approval: number;
  outcome: string | null;
}

/**
 * Rolls a gamble card with the draft's own generator: one target doubled and another halved, or one
 * target tripled or halved. The result is written into the pick so nothing is rolled twice.
 */
function rollGamble(run: RunState, mode: 'split' | 'allin'): { cash: number; approval: number; outcome: string; mods: Partial<RunMods> } {
  const rng = new Rng(run.rng);
  const result: { cash: number; approval: number; outcome: string; mods: Partial<RunMods> } = { cash: 1, approval: 1, outcome: '', mods: {} };
  const hit = (target: GambleTarget, factor: number): string => {
    if (target === 'dinero') result.cash = factor;
    else if (target === 'aprobacion') result.approval = factor;
    else result.mods = { density: factor };
    return `${TARGET_NAME[target]} ${factor >= 2 ? `×${factor}` : '÷2'}`;
  };
  if (mode === 'split') {
    const up = rng.int(3);
    const down = (up + 1 + rng.int(2)) % 3; // any of the other two
    result.outcome = `50/50: ${hit(GAMBLE_TARGETS[up], 2)} · ${hit(GAMBLE_TARGETS[down], 0.5)}`;
  } else {
    result.outcome = `Todo o nada: ${hit(GAMBLE_TARGETS[rng.int(3)], rng.chance(0.5) ? 3 : 0.5)}`;
  }
  run.rng = rng.state;
  return result;
}

/** Folds one set of knobs into another: everything multiplies except `land`, which adds. */
function merge(into: RunMods, partial: Partial<RunMods>): void {
  for (const [key, value] of Object.entries(partial) as [keyof RunMods, number][]) {
    if (key === 'land') into.land += value;
    else into[key] *= value;
  }
}

/** Every stage that has already started, plus every roll, folded into one set of knobs. */
export function runMods(run: RunState | null, tick: number): RunMods {
  const mods: RunMods = { ...NO_MODS };
  if (!run) return mods;
  for (const pick of run.picks) {
    if (pick.mods) merge(mods, pick.mods);
    const upgrade = upgradeById(pick.id);
    if (!upgrade) continue;
    for (const stage of upgrade.stages) {
      if (tick - pick.at < stage.after * TICKS_PER_MONTH) continue;
      merge(mods, stage.mods);
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
  // The order is part of the roll: a good card in the first slot every time is a tell.
  for (let k = offer.length - 1; k > 0; k--) {
    const j = rng.int(k + 1);
    [offer[k], offer[j]] = [offer[j], offer[k]];
  }
  run.offer = offer.length > 0 ? offer : null;
  run.rng = rng.state;
}

/** Takes one of the offered cards, rolling it when it is a gamble. Null when there is no draft open or the id is not on the table. */
export function takeUpgrade(run: RunState, id: string, tick: number): PickResult | null {
  if (!run.offer || !run.offer.includes(id)) return null;
  const upgrade = upgradeById(id);
  const pick: RunPick = { id, at: tick };
  let result: PickResult = { cash: 1, approval: 1, outcome: null };
  if (upgrade?.gamble) {
    const rolled = rollGamble(run, upgrade.gamble);
    pick.mods = rolled.mods;
    pick.outcome = rolled.outcome;
    result = { cash: rolled.cash, approval: rolled.approval, outcome: rolled.outcome };
  }
  run.picks.push(pick);
  run.offer = null;
  run.next++;
  return result;
}

/** Whether the run is won, lost (by the mandate or by the till), or still going. */
export function runOver(state: { run: RunState | null; lostElection: boolean }): 'ganada' | 'eleccion' | 'caja' | null {
  if (!state.run) return null;
  if (state.run.wonAt !== null) return 'ganada';
  if (state.lostElection) return 'eleccion';
  return state.run.dry >= RUN_DRY_MONTHS ? 'caja' : null;
}

/** The upgrades taken, oldest first, with the label the summary prints and what a roll did. */
export function pickedUpgrades(run: RunState): { label: string; kind: UpgradeKind; outcome: string | null }[] {
  return run.picks.map((p) => {
    const u = upgradeById(p.id);
    return { label: u?.label ?? p.id, kind: u?.kind ?? 'buena', outcome: p.outcome ?? null };
  });
}
