import {
  BUS,
  DEFAULT_FUNDING,
  EVENT,
  GOVERNMENT_KINDS,
  HUB_KINDS,
  HUBS,
  LOANS,
  MAX_FUNDING,
  MAX_LEVEL,
  MAX_LINE_TIER,
  MAX_ROAD_TIER,
  CROPS,
  FARM_SIZE,
  MARKET_SIZE,
  MAX_TAX,
  MIN_TAX,
  PLANT_KINDS,
  PLANT_SIZE,
  SILO_CAPACITY,
  SILO_SIZE,
  SERVICE_KINDS,
  type CropKind,
  type GovernmentKind,
  type HubKind,
  type PlantKind,
  type ServiceFunding,
  type ZoneTaxes,
} from '../config';
import type { BudgetReport } from '../sim/budget';
import type { HarvestReport, SellOrder } from '../sim/campo';
import type { Commitment } from '../sim/commitments';
import type { Effects } from '../sim/effects';
import type { Loan } from '../sim/loans';
import { FAVOR } from '../sim/favor';
import { MILESTONES, milestoneForPop } from '../sim/milestones';
import type { FivePlan } from '../sim/plan';
import { APPROVAL } from '../sim/politics';
import { NO_MODS, RUN_MARKS, upgradeById, type RunPick, type RunState } from '../sim/roguelike';
import type { SimState } from '../sim/simulation';
import { MAX_HEIGHT } from '../world/terrain';
import { SERVICE_NAMES } from '../sim/report';
import { serviceBlocks, serviceFootprint } from '../world/services';
import { busLineProblem, busStations } from '../world/transport';
import { busFootprint } from '../world/tools';
import { MAX_TILE, TILE, World, hubOf, hubTile, serviceOf, serviceTile, zoneOf, type Plant } from '../world/world';
import { ALL_UNIQUE_KINDS, UNIQUES, type UniqueKind } from '../config';

export const SAVE_VERSION = 22;
/**
 * Versions this build can still read. Version 1 had no abandoned buildings or fires;
 * versions 1 and 2 had one tax for every zone, no service budgets and no inherited streets;
 * versions 1 to 3 had only coal plants (a plant without a kind is a coal one); versions 1 to 4
 * had no municipal loan, so they owe nothing; versions 1 to 5 had no mayor's name, so the
 * Intendente is simply the Intendente; versions 1 to 6 had no buildings of the coast (the tile ids
 * from 12 on) nor the two coast lines of the budget, which count as zero; versions 1 to 7 had no
 * provincial route, so they have none and their streets are free to start anywhere; versions 1 to
 * 8 had one kind of street, so all of theirs are asphalt; versions 1 to 9 had no form of
 * government, so they are democracies with no party; versions 1 to 17 have no roguelike run, so
 * they open as classic games; versions 1 to 19 have no unique buildings, so they have none;
 * versions 1 to 21 have no mark of big fire nor fire counters, so their fires are common and
 * their counters start at zero.
 */
const READABLE_VERSIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
import { GRIPES } from '../sim/vecinos';

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

/** `fixedMonths` guarda −1 para «nunca»; el byte no tiene negativos, así que se escribe corrido uno. */
function monthsFixed(w: World): Uint8Array {
  const out = new Uint8Array(w.fixedMonths.length);
  for (let i = 0; i < out.length; i++) out[i] = w.fixedMonths[i] + 1;
  return out;
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
    anger: toBase64(w.anger),
    // Los meses de queja de cada lote existen desde el panel de los vecinos: un save más viejo no los trae.
    trouble: toBase64(w.troubleMonths),
    fixed: toBase64(monthsFixed(w)),
    what: toBase64(w.troubleWhat),
    inherited: toBase64(w.inherited),
    route: toBase64(w.route),
    roadTier: toBase64(w.roadTier),
    lineTier: toBase64(w.lineTier),
    fire: toBase64(w.fire),
    buses: busStations(w).map((b) => [b.i, b.line]),
    plants: w.plants,
    hubs: w.hubs,
    uniques: w.uniques,
    farms: w.farms,
    silos: w.silos,
    markets: w.markets,
    farmPressure: w.farmPressure,
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
    // A city saved before the neighbours had patience opens with a clean slate, not with a pent-up one.
    if (data.anger !== undefined) world.anger.set(fromBase64(data.anger, size, 100, 'El enojo de los vecinos'));
    // Los meses de queja son más nuevos que el enojo: una ciudad vieja abre sin reclamos con fecha.
    if (data.trouble !== undefined) world.troubleMonths.set(fromBase64(data.trouble, size, 255, 'Los meses de queja'));
    if (data.fixed !== undefined) {
      const raw = fromBase64(data.fixed, size, 101, 'Los agradecimientos');
      for (let i = 0; i < size; i++) world.fixedMonths[i] = raw[i] - 1;
    }
    // Qué problema tenía cada lote: es lo que el agradecimiento nombra cuando ya se arregló.
    if (data.what !== undefined) world.troubleWhat.set(fromBase64(data.what, size, GRIPES.length, 'El problema de cada lote'));
    world.fire.set(fromBase64(data.fire, size, 255, 'Los incendios'));
  }
  // Streets inherited from a real-place map exist from version 3 on.
  if ((data.version as number) >= 3) world.inherited.set(fromBase64(data.inherited, size, 1, 'Las calles del mapa'));
  // The provincial route exists from version 8 on.
  if ((data.version as number) >= 8) world.route.set(fromBase64(data.route, size, 1, 'La ruta provincial'));
  // Street qualities exist from version 9 on; older streets are all asphalt.
  if ((data.version as number) >= 9) world.roadTier.set(fromBase64(data.roadTier, size, MAX_ROAD_TIER, 'La calidad de las calles'));
  // The line of hormigón exists from version 21 on: an older city has the whole grid of wood.
  if ((data.version as number) >= 21) world.lineTier.set(fromBase64(data.lineTier, size, MAX_LINE_TIER, 'La calidad del tendido'));
  for (let i = 0; i < size; i++) {
    need(level[i] === 0 || zoneOf(tiles[i]) !== null, 'Hay edificios fuera de las zonas');
    need(world.inherited[i] === 0 || tiles[i] === TILE.ROAD, 'Las calles del mapa están dañadas');
    need(world.route[i] === 0 || tiles[i] === TILE.ROAD, 'La ruta provincial está dañada');
    need(world.roadTier[i] === 0 || tiles[i] === TILE.ROAD, 'La calidad de las calles está dañada');
    need(world.lineTier[i] === 0 || tiles[i] === TILE.LINE, 'La calidad del tendido está dañada');
  }

  // Bus lines exist from version 15 on: a list of [cell, packed line], one for every depot.
  if ((data.version as number) >= 15) {
    need(Array.isArray(data.buses), 'Faltan las líneas de colectivos');
    const taken = new Set<number>();
    for (const b of data.buses as unknown[]) {
      need(Array.isArray(b) && b.length === 2 && isInt(b[0]) && isInt(b[1]), 'Hay una línea de colectivos dañada');
      const [cell, line] = b as [number, number];
      need(cell >= 0 && cell < size && tiles[cell] === TILE.BUS, 'Hay una línea de colectivos fuera de su cochera');
      // A save keeps one entry per depot, at its anchor: the block is grown from it. A depot saved
      // when the cochera was one lot wide finds the rest of its ground empty and takes it.
      need(!taken.has(line), 'Hay dos líneas de colectivos con el mismo número');
      taken.add(line);
      for (const [cx, cy] of busFootprint(n as number, cell % (n as number), Math.floor(cell / (n as number)))) {
        const j = cy * (n as number) + cx;
        need(tiles[j] === TILE.BUS || tiles[j] === TILE.EMPTY, `La línea de colectivos no tiene lugar para su cochera de ${BUS.size}×${BUS.size}`);
        tiles[j] = TILE.BUS;
        world.tiles[j] = TILE.BUS;
        world.busLine[j] = line;
        world.terrain.trees[j] = 0;
      }
    }
  }
  for (let i = 0; i < size; i++) {
    need((tiles[i] === TILE.BUS) === (world.busLine[i] !== 0), 'Las líneas de colectivos no coinciden con el plano');
    if (tiles[i] === TILE.BUS) need(busLineProblem(world, world.busLine[i], i) === null, 'Hay una línea de colectivos inválida o repetida');
  }

  // The hospital and the university are 3x3 and the tiles are the truth, so nothing has to be written
  // down for them. A city saved when every service was one lot has a single lot: it grows over the free
  // ground around it, and it is said out loud when the ground is taken instead of trimming it in silence.
  for (let pass = 0; pass < 4; pass++) {
    let grew = false;
    for (const block of serviceBlocks(tiles, n as number)) {
      if (block.size === 1) continue;
      const tile = serviceTile(block.kind);
      for (const [cx, cy] of serviceFootprint(block.kind, n as number, block.x, block.y)) {
        const j = cy * (n as number) + cx;
        if (tiles[j] === tile) continue;
        need(tiles[j] === TILE.EMPTY, `${SERVICE_NAMES[block.kind]}: no tiene lugar para su lote de ${block.size}×${block.size}`);
        tiles[j] = tile;
        world.tiles[j] = tile;
        world.terrain.trees[j] = 0;
        grew = true;
      }
    }
    if (!grew) break;
  }
  let tileServices = 0;
  for (let i = 0; i < size; i++) if (serviceOf(tiles[i]) !== null) tileServices++;
  for (const block of serviceBlocks(tiles, n as number)) {
    for (const [cx, cy] of serviceFootprint(block.kind, n as number, block.x, block.y)) {
      need(tiles[cy * (n as number) + cx] === serviceTile(block.kind), 'Los servicios no coinciden con el plano');
    }
  }
  need(
    serviceBlocks(tiles, n as number).reduce((sum, b) => sum + b.size * b.size, 0) === tileServices,
    'Hay un servicio sin su lote completo',
  );

  need(Array.isArray(data.plants), 'Faltan las usinas');
  let plantCells = 0;
  for (const p of data.plants as unknown[]) {
    const { x, y, kind, age, warned } = (p ?? {}) as { x?: unknown; y?: unknown; kind?: unknown; age?: unknown; warned?: unknown };
    need(kind === undefined || PLANT_KINDS.includes(kind as PlantKind), 'Hay una usina de un tipo desconocido');
    need(isInt(x) && isInt(y) && x >= 0 && y >= 0 && x <= (n as number) - PLANT_SIZE && y <= (n as number) - PLANT_SIZE, 'Hay una usina fuera del mapa');
    for (let dy = 0; dy < PLANT_SIZE; dy++) {
      for (let dx = 0; dx < PLANT_SIZE; dx++) need(world.tileAt((x as number) + dx, (y as number) + dy) === TILE.PLANT, 'Hay una usina sin terreno');
    }
    // La edad de la usina existe desde la versión 22, y el archivo no subió de versión por ella: una usina
    // que no la trae es una usina nueva, y las viejas partidas se leen igual.
    need(age === undefined || (isInt(age) && (age as number) >= 0), 'Hay una usina con una edad imposible');
    // Una usina nueva se escribe igual que antes: los campos de la edad sólo aparecen cuando hay algo que
    // decir, así el archivo de una ciudad recién empezada no cambia ni un byte.
    const plant: Plant = { x: x as number, y: y as number, kind: (kind as PlantKind | undefined) ?? 'coal' };
    if (age !== undefined && (age as number) > 0) plant.age = age as number;
    if (warned === true) plant.warned = true;
    world.plants.push(plant);
    plantCells += PLANT_SIZE * PLANT_SIZE;
  }
  let tilePlants = 0;
  for (let i = 0; i < size; i++) if (tiles[i] === TILE.PLANT) tilePlants++;
  need(tilePlants === plantCells, 'Las usinas no coinciden con el plano');

  // Airports and harbours exist from version 16 on: a list of pieces, each with its anchor.
  let hubCells = 0;
  if ((data.version as number) >= 16) {
    need(Array.isArray(data.hubs), 'Faltan los aeropuertos y puertos');
    const covered = new Set<number>();
    for (const h of data.hubs as unknown[]) {
      const { x, y, kind } = (h ?? {}) as { x?: unknown; y?: unknown; kind?: unknown };
      need(HUB_KINDS.includes(kind as HubKind), 'Hay un aeropuerto o puerto de un tipo desconocido');
      const { w: pw, h: ph } = HUBS[kind as HubKind];
      need(isInt(x) && isInt(y) && x >= 0 && y >= 0 && x <= (n as number) - pw && y <= (n as number) - ph, 'Hay un aeropuerto o puerto fuera del mapa');
      for (let dy = 0; dy < ph; dy++) {
        for (let dx = 0; dx < pw; dx++) {
          const cell = ((y as number) + dy) * (n as number) + (x as number) + dx;
          need(tiles[cell] === hubTile(kind as HubKind) && !covered.has(cell), 'Hay un aeropuerto o puerto sin terreno');
          covered.add(cell);
        }
      }
      world.hubs.push({ x: x as number, y: y as number, kind: kind as HubKind });
      hubCells += pw * ph;
    }
  }
  let tileHubs = 0;
  for (let i = 0; i < size; i++) if (hubOf(tiles[i])) tileHubs++;
  need(tileHubs === hubCells, 'Los aeropuertos y puertos no coinciden con el plano');

  // Unique buildings exist from version 20 on: one anchor each, over a footprint of TILE.UNIQUE.
  let uniqueCells = 0;
  if ((data.version as number) >= 20) {
    need(Array.isArray(data.uniques), 'Faltan los edificios únicos');
    const coveredUniques = new Set<number>();
    const seenKinds = new Set<UniqueKind>();
    for (const u of data.uniques as unknown[]) {
      const { x, y, kind } = (u ?? {}) as { x?: unknown; y?: unknown; kind?: unknown };
      need(ALL_UNIQUE_KINDS.includes(kind as UniqueKind), 'Hay un edificio único de un tipo desconocido');
      const known = kind as UniqueKind;
      need(!seenKinds.has(known), 'Hay dos edificios únicos iguales');
      seenKinds.add(known);
      const { w: pw, h: ph } = UNIQUES[known];
      need(isInt(x) && isInt(y) && x >= 0 && y >= 0 && x <= (n as number) - pw && y <= (n as number) - ph, 'Hay un edificio único fuera del mapa');
      for (let dy = 0; dy < ph; dy++) {
        for (let dx = 0; dx < pw; dx++) {
          const cell = ((y as number) + dy) * (n as number) + (x as number) + dx;
          need(tiles[cell] === TILE.UNIQUE && !coveredUniques.has(cell), 'Hay un edificio único sin terreno');
          coveredUniques.add(cell);
        }
      }
      world.uniques.push({ x: x as number, y: y as number, kind: known });
      uniqueCells += pw * ph;
    }
  }
  let tileUniques = 0;
  for (let i = 0; i < size; i++) if (tiles[i] === TILE.UNIQUE) tileUniques++;
  need(tileUniques === uniqueCells, 'Los edificios únicos no coinciden con el plano');

  // El campo es nuevo: una ciudad guardada antes no tiene lotes, silos ni ferias, y se lee
  // con las tres listas vacías: el archivo crece, no se rompe.
  const anchorsOf = (key: string, size: number, tile: number, what: string): { x: number; y: number }[] => {
    const raw = data[key];
    if (raw === undefined) return [];
    need(Array.isArray(raw), `Faltan los ${what}`);
    const out: { x: number; y: number }[] = [];
    for (const item of raw as unknown[]) {
      const { x, y } = (item ?? {}) as { x?: unknown; y?: unknown };
      need(isInt(x) && isInt(y) && x >= 0 && y >= 0 && x <= (n as number) - size && y <= (n as number) - size, `Hay un lote de ${what} fuera del mapa`);
      for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) need(world.tileAt((x as number) + dx, (y as number) + dy) === tile, `Hay un lote de ${what} sin terreno`);
      }
      out.push({ x: x as number, y: y as number });
    }
    let inPlan = 0;
    for (let i = 0; i < tiles.length; i++) if (tiles[i] === tile) inPlan++;
    need(inPlan === out.length * size * size, `Los lotes de ${what} no coinciden con el plano`);
    return out;
  };

  const rawFarms = (data.farms as { crop?: unknown }[] | undefined) ?? [];
  const farmAnchors = anchorsOf('farms', FARM_SIZE, TILE.FARM, 'cultivo');
  for (let k = 0; k < farmAnchors.length; k++) {
    const crop = rawFarms[k]?.crop;
    need(typeof crop === 'string' && crop in CROPS, 'Hay un lote de cultivo de un tipo desconocido');
    world.farms.push({ ...farmAnchors[k], crop: crop as CropKind });
  }

  const rawSilos = (data.silos as { tons?: unknown }[] | undefined) ?? [];
  const siloAnchors = anchorsOf('silos', SILO_SIZE, TILE.SILO, 'silo');
  for (let k = 0; k < siloAnchors.length; k++) {
    const tons = rawSilos[k]?.tons;
    need(tons === undefined || (typeof tons === 'number' && Number.isFinite(tons) && tons >= 0 && tons <= SILO_CAPACITY), 'Hay un silo con una carga imposible');
    world.silos.push({ ...siloAnchors[k], tons: (tons as number | undefined) ?? 0 });
  }

  for (const anchor of anchorsOf('markets', MARKET_SIZE, TILE.MARKET, 'feria')) world.markets.push(anchor);

  // La presión de oferta: sin ella, el precio de una ciudad guardada volvería al de un mercado vacío.
  const rawPressure = data.farmPressure;
  need(rawPressure === undefined || (typeof rawPressure === 'number' && Number.isFinite(rawPressure) && rawPressure >= 0), 'La presión de oferta del campo es inválida');
  world.farmPressure = (rawPressure as number | undefined) ?? 0;

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
    need(validTax(s.tax), 'Los impuestos por zona son inválidos');
    taxes = { R: s.tax as number, C: s.tax as number, I: s.tax as number };
  } else {
    const t = (s.taxes ?? {}) as Record<string, unknown>;
    need(validTax(t.R) && validTax(t.C) && validTax(t.I), 'Los impuestos de la partida son inválidos');
    taxes = { R: t.R as number, C: t.C as number, I: t.I as number };
  }
  const funding: ServiceFunding = { ...DEFAULT_FUNDING };
  if (s.funding !== undefined) {
    const f = (s.funding ?? {}) as Record<string, unknown>;
    for (const k of SERVICE_KINDS) {
      const v = f[k];
      // The hospital and the university came later: an older save funds them in full.
      if (v === undefined && (k === 'hospital' || k === 'university')) continue;
      need(isInt(v) && v >= 0 && v <= MAX_FUNDING, 'El presupuesto de los servicios es inválido');
      funding[k] = v as number;
    }
  }
  // Format 11 added the budget for green spaces: an older save has well-kept plazas.
  need(s.green === undefined || (isInt(s.green) && s.green >= 0 && s.green <= MAX_FUNDING), 'El presupuesto de espacios verdes es inválido');
  // The budget for the bus lines came with them: an older save runs them at the standard 100 %.
  need(s.plants === undefined || (isInt(s.plants) && s.plants >= 0 && s.plants <= MAX_FUNDING), 'El presupuesto de usinas es inválido');
  need(s.roads === undefined || (isInt(s.roads) && s.roads >= 0 && s.roads <= MAX_FUNDING), 'El presupuesto de calles es inválido');
  need(s.transport === undefined || (isInt(s.transport) && s.transport >= 0 && s.transport <= MAX_FUNDING), 'El presupuesto de transporte es inválido');
  // Format 12 added the grudge of the demolitions; a city saved before it has none.
  need(s.grief === undefined || (isInt(s.grief) && s.grief >= 0), 'El enojo por las demoliciones es inválido');
  // Format 13 added the promises and the events with a decision.
  const commitment = parseCommitment(s.commitment);
  need(s.pendingEvent === undefined || s.pendingEvent === null || typeof s.pendingEvent === 'string', 'El evento de la partida es inválido');
  need(s.lastEvent === undefined || (isInt(s.lastEvent) && s.lastEvent >= 0), 'El evento de la partida es inválido');
  // The last events that showed up (their cooldown); a city saved before it has none.
  need(
    s.recentEvents === undefined || (Array.isArray(s.recentEvents) && s.recentEvents.length <= EVENT.cooldown && s.recentEvents.every((id) => typeof id === 'string' && id.length <= 40)),
    'Los últimos eventos de la partida son inválidos',
  );
  // Format 14 added the temporary effects of the events (see `sim/effects.ts`).
  const effects = parseEffects(s.effects);
  need(isInt(s.rngState), 'La partida está dañada');
  // El perfil de la apuesta del campo llegó con este formato; un save anterior arriesga cero.
  need(s.campoRisk === undefined || (isInt(s.campoRisk) && s.campoRisk >= 0 && s.campoRisk <= 100), 'El perfil del campo es inválido');
  need(typeof s.crisis === 'boolean', 'La partida está dañada');
  // La marca de foco grande y las cuentas de fuego existen desde la versión 22: un save viejo quema
  // común y abre con las cuentas en cero, que es lo que hacía hasta ahora.
  need(s.bigFire === undefined || (Array.isArray(s.bigFire) && s.bigFire.every((v) => isInt(v) && (v as number) >= 0)), 'Los focos de la partida son inválidos');
  const fireStats = (s.fireStats ?? {}) as Record<string, unknown>;
  const validStat = (v: unknown) => isInt(v) && (v as number) >= 0;
  need(s.fireStats === undefined || (validStat(fireStats.firesStarted) && validStat(fireStats.firesSaved) && validStat(fireStats.buildingsBurned)), 'Las cuentas de fuego de la partida son inválidas');
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
    const keys: (keyof BudgetReport)[] = ['taxR', 'taxC', 'taxI', 'roads', 'lines', 'parks', 'plants', 'services', 'schools', 'clinics', 'police', 'firefighters', 'hospitals', 'universities', 'loan', 'coast', 'transport', 'hubs', 'hubIncome', 'coastIncome', 'uniques', 'uniqueIncome', 'farmIncome', 'farmUpkeep', 'income', 'expenses', 'balance'];
    // Older budgets had no lines for services, the loan instalment, the coast or the uniques; they count as zero.
    for (const k of ['services', 'schools', 'clinics', 'police', 'firefighters', 'hospitals', 'universities', 'loan', 'coast', 'transport', 'hubs', 'hubIncome', 'coastIncome', 'uniques', 'uniqueIncome', 'farmIncome', 'farmUpkeep']) if (b[k] === undefined) b[k] = 0;
    for (const k of keys) need(isInt(b[k]), 'El presupuesto de la partida está dañado');
    lastBudget = Object.fromEntries(keys.map((k) => [k, b[k]])) as unknown as BudgetReport;
  }
/** The keys a rolled pick may carry: the same knobs as `RunMods`. */
const MOD_KEYS = new Set(Object.keys(NO_MODS));

/** The roguelike run, or null in a classic game. Checked so a hand-edited save cannot pick a card that does not exist. */
function parseRun(raw: unknown): RunState | null {
  if (raw === null || raw === undefined) return null;
  const r = raw as Record<string, unknown>;
  need(Array.isArray(r.picks), 'La run de la partida es inválida');
  const picks = (r.picks as unknown[]).map((item) => {
    const { id, at, mods, outcome } = (item ?? {}) as { id?: unknown; at?: unknown; mods?: unknown; outcome?: unknown };
    need(typeof id === 'string' && upgradeById(id) !== null && isInt(at) && (at as number) >= 0, 'La run de la partida es inválida');
    // A card that rolled carries what it rolled: every knob has to be a real one and a real number.
    need(
      mods === undefined ||
        (typeof mods === 'object' && mods !== null && Object.entries(mods as Record<string, unknown>).every(([k, v]) => MOD_KEYS.has(k) && typeof v === 'number' && Number.isFinite(v))),
      'La run de la partida es inválida',
    );
    need(outcome === undefined || (typeof outcome === 'string' && outcome.length <= 120), 'La run de la partida es inválida');
    const pick: RunPick = { id: id as string, at: at as number };
    if (mods !== undefined) pick.mods = mods as RunPick['mods'];
    if (outcome !== undefined) pick.outcome = outcome as string;
    return pick;
  });
  const rawOffer = r.offer;
  need(
    rawOffer === null || rawOffer === undefined || (Array.isArray(rawOffer) && rawOffer.length <= 3 && rawOffer.every((id) => typeof id === 'string' && upgradeById(id) !== null)),
    'La run de la partida es inválida',
  );
  need(isInt(r.next) && (r.next as number) >= -1 && (r.next as number) <= RUN_MARKS.length, 'La run de la partida es inválida');
  need(r.wonAt === null || r.wonAt === undefined || (isInt(r.wonAt) && (r.wonAt as number) >= 0), 'La run de la partida es inválida');
  need(isInt(r.rng), 'La run de la partida es inválida');
  // What the run has already put on the table: a game saved before it existed opens with an empty deck.
  const rawSeen = r.seen;
  need(
    rawSeen === undefined || (Array.isArray(rawSeen) && rawSeen.length <= 40 && rawSeen.every((id) => typeof id === 'string' && upgradeById(id) !== null)),
    'La run de la partida es inválida',
  );
  return {
    picks,
    offer: (rawOffer as string[] | null | undefined) ?? null,
    next: r.next as number,
    wonAt: (r.wonAt as number | undefined) ?? null,
    rng: (r.rng as number) >>> 0,
    seen: (rawSeen as string[] | undefined) ?? [],
  };
}

/**
 * Los meses seguidos con la caja en rojo, de cualquier lado donde estén.
 *
 * El contador se mudó de la run al estado cuando la quiebra dejó de ser una regla del roguelike y pasó a ser
 * la derrota por plata de cualquier partida. Un save anterior a la mudanza lo tiene adentro de `run`; uno
 * posterior, en el estado. Se leen los dos para que cargar no reinicie la cuenta de nadie.
 */
function dryOf(s: Record<string, unknown>): number {
  const own = s.dry;
  if (isInt(own) && (own as number) >= 0) return own as number;
  const r = s.run as Record<string, unknown> | null | undefined;
  const old = r?.dry;
  return isInt(old) && (old as number) >= 0 ? (old as number) : 0;
}

/**
 * La orden de venta del campo. Un guardado viejo no la tiene y abre vendiendo todo apenas la feria puede, que
 * es lo que hace el default: no se pierde ninguna partida por no haber elegido una política que todavía no
 * existía.
 */
function parseOrder(raw: unknown): SellOrder {
  const r = (raw ?? {}) as Record<string, unknown>;
  const minPrice = isInt(r.minPrice) && (r.minPrice as number) >= 0 ? (r.minPrice as number) : 0;
  const keepTons = isInt(r.keepTons) && (r.keepTons as number) >= 0 ? (r.keepTons as number) : 0;
  return { minPrice, keepTons };
}

/** El recibo del último cierre del campo; un guardado viejo no lo tiene y el panel no lo muestra. */
function parseHarvest(raw: unknown): HarvestReport | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const nums = ['month', 'price', 'grown', 'lost', 'spoiled', 'sold', 'income'] as const;
  for (const k of nums) need(isInt(r[k]) || typeof r[k] === 'number', 'El recibo de la cosecha es inválido');
  for (const k of nums) if (!Number.isFinite(r[k] as number)) return null;
  // El clima, la soja y el camino llegaron con el perfil: un recibo de antes no jugó al dado ni pidió calles.
  const soy = isInt(r.soy) ? (r.soy as number) : 0;
  const climate = typeof r.climate === 'number' && Number.isFinite(r.climate) ? (r.climate as number) : 1;
  const unreached = isInt(r.unreached) ? (r.unreached as number) : 0;
  return {
    month: r.month as number,
    price: r.price as number,
    grown: r.grown as number,
    soy,
    climate,
    unreached,
    lost: r.lost as number,
    spoiled: r.spoiled as number,
    sold: r.sold as number,
    income: r.income as number,
  };
}

/** The effects running, in months. A city saved before them opens with none. */
function parseEffects(raw: unknown): Effects {
  const effects: Effects = {};
  if (raw === null || raw === undefined) return effects;
  need(typeof raw === 'object' && !Array.isArray(raw), 'Los efectos de la partida son inválidos');
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    need(k.length > 0 && k.length <= 32, 'Los efectos de la partida son inválidos');
    need(isInt(v) && (v as number) > 0 && (v as number) <= 600, 'Los efectos de la partida son inválidos');
    effects[k] = v as number;
  }
  return effects;
}

/** The promise being watched, or null. Checked so a hand-edited save cannot promise nonsense. */
function parseCommitment(raw: unknown): Commitment | null {
  if (raw === null || raw === undefined) return null;
  const c = raw as Record<string, unknown>;
  need(c.kind === 'school' || c.kind === 'plaza', 'La promesa de la partida es inválida');
  for (const k of ['made', 'due', 'baseline']) need(isInt(c[k]) && (c[k] as number) >= 0, 'La promesa de la partida es inválida');
  need((c.due as number) > (c.made as number), 'La promesa de la partida es inválida');
  return { kind: c.kind as Commitment['kind'], made: c.made as number, due: c.due as number, baseline: c.baseline as number };
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
  // The favor of God and the five-year plan exist from version 17 on: older cities have neither.
  need(s.favor === undefined || (typeof s.favor === 'number' && s.favor >= 0 && s.favor <= 100), 'El favor divino de la partida es inválido');
  // El telegrama del subsidio se ofrece una sola vez: en un save viejo todavía no se mandó.
  need(s.subsidy === undefined || typeof s.subsidy === 'boolean', 'El subsidio provincial es inválido');
  const plan = parsePlan(s.plan);
  // The roguelike run exists from version 18 on.
  const run = parseRun(s.run);
  return {
    tick: s.tick as number,
    cash: s.cash as number,
    taxes,
    funding,
    green: (s.green as number | undefined) ?? 100,
    transport: (s.transport as number | undefined) ?? 100,
    roads: (s.roads as number | undefined) ?? 100,
    plants: (s.plants as number | undefined) ?? 100,
    order: parseOrder(s.order),
    campoRisk: (s.campoRisk as number | undefined) ?? 0,
    harvest: parseHarvest(s.harvest),
    grief: (s.grief as number | undefined) ?? 0,
    commitment,
    pendingEvent: (s.pendingEvent as string | null | undefined) ?? null,
    lastEvent: (s.lastEvent as number | undefined) ?? 0,
    recentEvents: (s.recentEvents as string[] | undefined) ?? [],
    effects,
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
    // Los meses en rojo vivían dentro de la run hasta la version 22. Un save viejo los trae ahí; se leen de
    // los dos lados para que el que venía con la cuenta empezada no la reinicie al cargar.
    dry: dryOf(s),
    loan,
    government: (s.government as GovernmentKind | undefined) ?? 'democracia',
    party: (s.party as string | undefined) ?? '',
    favor: (s.favor as number | undefined) ?? FAVOR.start,
    subsidy: (s.subsidy as boolean | undefined) ?? false,
    bigFire: ((s.bigFire as number[] | undefined) ?? []).slice(),
    fireStats: {
      firesStarted: (fireStats.firesStarted as number | undefined) ?? 0,
      firesSaved: (fireStats.firesSaved as number | undefined) ?? 0,
      buildingsBurned: (fireStats.buildingsBurned as number | undefined) ?? 0,
    },
    plan,
    run,
  };
}

/** The five-year plan in progress, or null. */
function parsePlan(raw: unknown): FivePlan | null {
  if (raw === undefined || raw === null) return null;
  const p = raw as Partial<FivePlan>;
  need(typeof p === 'object' && isInt(p.jobs) && p.jobs >= 0 && isInt(p.due) && p.due >= 0 && isInt(p.start) && p.start >= 0, 'El plan quinquenal de la partida es inválido');
  return { jobs: p.jobs as number, due: p.due as number, start: p.start as number };
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
