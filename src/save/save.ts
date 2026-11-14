import {
  DEFAULT_FUNDING,
  GOVERNMENT_KINDS,
  LOANS,
  MAX_FUNDING,
  MAX_LEVEL,
  MAX_ROAD_TIER,
  MAX_TAX,
  MIN_TAX,
  PLANT_KINDS,
  PLANT_SIZE,
  SERVICE_KINDS,
  type GovernmentKind,
  type PlantKind,
  type ServiceFunding,
  type ZoneTaxes,
} from '../config';
import type { BudgetReport } from '../sim/budget';
import type { Loan } from '../sim/loans';
import { MILESTONES, milestoneForPop } from '../sim/milestones';
import { APPROVAL } from '../sim/politics';
import type { SimState } from '../sim/simulation';
import { MAX_HEIGHT } from '../world/terrain';
import { MAX_TILE, TILE, World, zoneOf } from '../world/world';

export const SAVE_VERSION = 10;
/**
 * Versions this build can still read. Version 1 had no abandoned buildings or fires;
 * versions 1 and 2 had one tax for every zone, no service budgets and no inherited streets;
 * versions 1 to 3 had only coal plants (a plant without a kind is a coal one); versions 1 to 4
 * had no municipal loan, so they owe nothing; versions 1 to 5 had no mayor's name, so the
 * Intendente is simply the Intendente; versions 1 to 6 had no buildings of the coast (the tile ids
 * from 12 on) nor the two coast lines of the budget, which count as zero; versions 1 to 7 had no
 * provincial route, so they have none and their streets are free to start anywhere; versions 1 to
 * 8 had one kind of street, so all of theirs are asphalt; versions 1 to 9 had no form of
 * government, so they are democracies with no party.
 */
const READABLE_VERSIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const GAME_ID = 'argencity3000';

export interface SaveData {
  name: string;
  seed: number;
  /** The player's character. Absent in saves written before version 6. */
  mayor?: string;
  world: World;
  sim: SimState;
}

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Decodes a byte grid, checking its size and that no value goes above `max`. */
export function fromBase64(text: unknown, length: number, max: number, what: string, where = 'la partida'): Uint8Array {
  if (typeof text !== 'string') throw new Error(`Falta ${what} en ${where}`);
  let raw: string;
  try {
    raw = atob(text);
  } catch {
    throw new Error(`${what} está dañado`);
  }
  if (raw.length !== length) throw new Error(`${what} no tiene el tamaño esperado`);
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    const v = raw.charCodeAt(i);
    if (v > max) throw new Error(`${what} tiene valores imposibles`);
    out[i] = v;
  }
  return out;
}

export function serialize(d: SaveData): string {
  const w = d.world;
  return JSON.stringify({
    game: GAME_ID,
    version: SAVE_VERSION,
    name: d.name,
    mayor: d.mayor ?? '',
    seed: d.seed,
    savedAt: new Date().toISOString(),
    n: w.n,
    corners: toBase64(w.terrain.corners),
    trees: toBase64(w.terrain.trees),
    tiles: toBase64(w.tiles),
    level: toBase64(w.level),
    variant: toBase64(w.variant),
    abandoned: toBase64(w.abandoned),
    inherited: toBase64(w.inherited),
    route: toBase64(w.route),
    roadTier: toBase64(w.roadTier),
    fire: toBase64(w.fire),
    plants: w.plants,
    sim: d.sim,
  });
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

function need(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

/** Parses and validates a save. Throws an Error with a message for the player when anything is off. */
export function deserialize(text: string): SaveData {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Eso no es una partida de ArgenCity 3000');
  }
  if (!data || typeof data !== 'object' || data.game !== GAME_ID) throw new Error('Eso no es una partida de ArgenCity 3000');
  need(READABLE_VERSIONS.includes(data.version as number), 'Esta partida es de otra versión del juego');
  const n = data.n;
  need(isInt(n) && n >= 8 && n <= 512, 'El tamaño del mapa es inválido');
  const size = (n as number) * (n as number);
  const corners = fromBase64(data.corners, ((n as number) + 1) ** 2, MAX_HEIGHT, 'El terreno');
  const trees = fromBase64(data.trees, size, 4, 'La arboleda');
  const tiles = fromBase64(data.tiles, size, MAX_TILE, 'El plano de la ciudad');
  const level = fromBase64(data.level, size, MAX_LEVEL, 'Los edificios');
  const variant = fromBase64(data.variant, size, 255, 'Los edificios');

  const world = new World({ n: n as number, corners, trees });
  world.tiles.set(tiles);
  world.level.set(level);
  world.variant.set(variant);
  if (data.version !== 1) {
    world.abandoned.set(fromBase64(data.abandoned, size, 1, 'Los edificios abandonados'));
    world.fire.set(fromBase64(data.fire, size, 255, 'Los incendios'));
  }
  // Streets inherited from a real-place map exist from version 3 on.
  if ((data.version as number) >= 3) world.inherited.set(fromBase64(data.inherited, size, 1, 'Las calles del mapa'));
  // The provincial route exists from version 8 on.
  if ((data.version as number) >= 8) world.route.set(fromBase64(data.route, size, 1, 'La ruta provincial'));
  // Street qualities exist from version 9 on; older streets are all asphalt.
  if ((data.version as number) >= 9) world.roadTier.set(fromBase64(data.roadTier, size, MAX_ROAD_TIER, 'La calidad de las calles'));
  for (let i = 0; i < size; i++) {
    need(level[i] === 0 || zoneOf(tiles[i]) !== null, 'Hay edificios fuera de las zonas');
    need(world.inherited[i] === 0 || tiles[i] === TILE.ROAD, 'Las calles del mapa están dañadas');
    need(world.route[i] === 0 || tiles[i] === TILE.ROAD, 'La ruta provincial está dañada');
    need(world.roadTier[i] === 0 || tiles[i] === TILE.ROAD, 'La calidad de las calles está dañada');
  }

  need(Array.isArray(data.plants), 'Faltan las usinas');
  let plantCells = 0;
  for (const p of data.plants as unknown[]) {
    const { x, y, kind } = (p ?? {}) as { x?: unknown; y?: unknown; kind?: unknown };
    need(kind === undefined || PLANT_KINDS.includes(kind as PlantKind), 'Hay una usina de un tipo desconocido');
    need(isInt(x) && isInt(y) && x >= 0 && y >= 0 && x <= (n as number) - PLANT_SIZE && y <= (n as number) - PLANT_SIZE, 'Hay una usina fuera del mapa');
    for (let dy = 0; dy < PLANT_SIZE; dy++) {
      for (let dx = 0; dx < PLANT_SIZE; dx++) need(world.tileAt((x as number) + dx, (y as number) + dy) === TILE.PLANT, 'Hay una usina sin terreno');
    }
    world.plants.push({ x: x as number, y: y as number, kind: (kind as PlantKind | undefined) ?? 'coal' });
    plantCells += PLANT_SIZE * PLANT_SIZE;
  }
  let tilePlants = 0;
  for (let i = 0; i < size; i++) if (tiles[i] === TILE.PLANT) tilePlants++;
  need(tilePlants === plantCells, 'Las usinas no coinciden con el plano');

  return {
    name: typeof data.name === 'string' ? data.name.slice(0, 40) : 'Ciudad sin nombre',
    seed: isInt(data.seed) ? data.seed : 0,
    mayor: typeof data.mayor === 'string' ? data.mayor.slice(0, 40) : '',
    world,
    sim: parseSim(data.sim),
  };
}

function parseSim(raw: unknown): SimState {
  need(!!raw && typeof raw === 'object', 'Falta la simulación');
  const s = raw as Record<string, unknown>;
  need(isInt(s.tick) && s.tick >= 0, 'La fecha de la partida es inválida');
  need(isInt(s.cash), 'La caja de la partida es inválida');
  const validTax = (v: unknown) => isInt(v) && v >= MIN_TAX && v <= MAX_TAX;
  let taxes: ZoneTaxes;
  if (s.taxes === undefined) {
    // Older saves had one tax for every zone.
    need(validTax(s.tax), 'La tasa de impuestos es inválida');
    taxes = { R: s.tax as number, C: s.tax as number, I: s.tax as number };
  } else {
    const t = (s.taxes ?? {}) as Record<string, unknown>;
    need(validTax(t.R) && validTax(t.C) && validTax(t.I), 'Las tasas de la partida son inválidas');
    taxes = { R: t.R as number, C: t.C as number, I: t.I as number };
  }
  const funding: ServiceFunding = { ...DEFAULT_FUNDING };
  if (s.funding !== undefined) {
    const f = (s.funding ?? {}) as Record<string, unknown>;
    for (const k of SERVICE_KINDS) {
      const v = f[k];
      need(isInt(v) && v >= 0 && v <= MAX_FUNDING, 'El presupuesto de los servicios es inválido');
      funding[k] = v as number;
    }
  }
  need(isInt(s.rngState), 'La partida está dañada');
  need(typeof s.crisis === 'boolean', 'La partida está dañada');
  need(Array.isArray(s.news) && Array.isArray(s.history), 'La partida está dañada');
  const news = (s.news as unknown[]).map((item) => {
    const { date, text } = (item ?? {}) as { date?: unknown; text?: unknown };
    need(typeof date === 'string' && typeof text === 'string', 'El diario de la partida está dañado');
    return { date: date as string, text: text as string };
  });
  const history = (s.history as unknown[]).map((item) => {
    const { pop, cash } = (item ?? {}) as { pop?: unknown; cash?: unknown };
    need(isInt(pop) && isInt(cash), 'El historial de la partida está dañado');
    return { pop: pop as number, cash: cash as number };
  });
  const hints: Record<string, number> = {};
  if (s.hints && typeof s.hints === 'object') {
    for (const [k, v] of Object.entries(s.hints as Record<string, unknown>)) if (isInt(v)) hints[k] = v;
  }
  let lastBudget: BudgetReport | null = null;
  if (s.lastBudget !== null && s.lastBudget !== undefined) {
    const b = s.lastBudget as Record<string, unknown>;
    const keys: (keyof BudgetReport)[] = ['taxR', 'taxC', 'taxI', 'roads', 'lines', 'parks', 'plants', 'services', 'schools', 'clinics', 'police', 'firefighters', 'loan', 'coast', 'coastIncome', 'income', 'expenses', 'balance'];
    // Older budgets had no lines for services, the loan instalment or the coast; they count as zero.
    for (const k of ['services', 'schools', 'clinics', 'police', 'firefighters', 'loan', 'coast', 'coastIncome']) if (b[k] === undefined) b[k] = 0;
    for (const k of keys) need(isInt(b[k]), 'El presupuesto de la partida está dañado');
    lastBudget = Object.fromEntries(keys.map((k) => [k, b[k]])) as unknown as BudgetReport;
  }
  // Saves before version 4 had no milestones: the city keeps what its best month earned.
  let milestone = milestoneForPop(Math.max(0, ...history.map((h) => h.pop)));
  if (s.milestone !== undefined) {
    need(isInt(s.milestone) && s.milestone >= 0 && s.milestone < MILESTONES.length, 'El hito de la partida es inválido');
    milestone = s.milestone as number;
  }
  // Approval and mandate exist from version 4 on: older saves start a fresh mandate.
  need(s.approval === undefined || (isInt(s.approval) && s.approval >= 0 && s.approval <= 100), 'La aprobación de la partida es inválida');
  need(s.terms === undefined || (isInt(s.terms) && s.terms >= 0), 'El mandato de la partida es inválido');
  need(s.lostElection === undefined || typeof s.lostElection === 'boolean', 'El mandato de la partida es inválido');
  // The municipal loan exists from version 5 on: older saves owe nothing.
  const loan = parseLoan(s.loan);
  // The form of government exists from version 10 on: older saves are democracies without a party.
  need(s.government === undefined || GOVERNMENT_KINDS.includes(s.government as GovernmentKind), 'La forma de gobierno de la partida es inválida');
  need(s.party === undefined || (typeof s.party === 'string' && s.party.length <= 32), 'El partido de la partida es inválido');
  return {
    tick: s.tick as number,
    cash: s.cash as number,
    taxes,
    funding,
    rngState: (s.rngState as number) >>> 0,
    crisis: s.crisis as boolean,
    lastBudget,
    news,
    history,
    hints,
    milestone,
    approval: (s.approval as number | undefined) ?? APPROVAL.start,
    terms: (s.terms as number | undefined) ?? 0,
    lostElection: (s.lostElection as boolean | undefined) ?? false,
    loan,
    government: (s.government as GovernmentKind | undefined) ?? 'democracia',
    party: (s.party as string | undefined) ?? '',
  };
}

/**
 * A loan in progress, or null. `paid` has to be short of the term: a save where it reached the term
 * would mean the simulation did not drop the loan at the end of that month.
 */
function parseLoan(raw: unknown): Loan | null {
  if (raw === undefined || raw === null) return null;
  const { kind, paid } = (raw ?? {}) as { kind?: unknown; paid?: unknown };
  need(isInt(kind) && kind >= 0 && kind < LOANS.length, 'El crédito de la partida es inválido');
  const months = LOANS[kind as number].months;
  need(isInt(paid) && (paid as number) >= 0 && (paid as number) < months, 'El crédito de la partida es inválido');
  return { kind: kind as number, paid: paid as number };
}
