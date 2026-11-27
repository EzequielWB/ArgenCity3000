import { FARM_SIZE, HUBS, MARKET_SIZE, SILO_SIZE, UNIQUES, plantSizeOf, type CoastKind, type CropKind, type HubKind, type PlantKind, type ServiceKind, type UniqueKind } from '../config';
import { isWaterCell, cellMinMax, type Terrain } from './terrain';

/** What occupies a cell. Zones keep their building level in `World.level`. */
export const TILE = {
  EMPTY: 0,
  ROAD: 1,
  LINE: 2,
  R: 3,
  C: 4,
  I: 5,
  PLANT: 6,
  PARK: 7,
  SCHOOL: 8,
  CLINIC: 9,
  POLICE: 10,
  FIREHOUSE: 11,
  FISHING: 12,
  PROMENADE: 13,
  PORT: 14,
  RESORT: 15,
  LIGHTHOUSE: 16,
  BUS: 17,
  AIRPORT: 18,
  HARBOR: 19,
  HOSPITAL: 20,
  UNIVERSITY: 21,
  UNIQUE: 22,
  FARM: 23,
  SILO: 24,
  MARKET: 25,
} as const;
export const MAX_TILE = TILE.MARKET;
export type TileId = (typeof TILE)[keyof typeof TILE];

export type ZoneKind = 'R' | 'C' | 'I';

export function zoneOf(tile: number): ZoneKind | null {
  if (tile === TILE.R) return 'R';
  if (tile === TILE.C) return 'C';
  if (tile === TILE.I) return 'I';
  return null;
}

const SERVICE_TILES: Record<ServiceKind, TileId> = { school: TILE.SCHOOL, clinic: TILE.CLINIC, police: TILE.POLICE, fire: TILE.FIREHOUSE, hospital: TILE.HOSPITAL, university: TILE.UNIVERSITY };

export function serviceTile(k: ServiceKind): TileId {
  return SERVICE_TILES[k];
}

export function serviceOf(tile: number): ServiceKind | null {
  if (tile === TILE.SCHOOL) return 'school';
  if (tile === TILE.CLINIC) return 'clinic';
  if (tile === TILE.POLICE) return 'police';
  if (tile === TILE.FIREHOUSE) return 'fire';
  if (tile === TILE.HOSPITAL) return 'hospital';
  if (tile === TILE.UNIVERSITY) return 'university';
  return null;
}

const COAST_TILES: Record<CoastKind, TileId> = { fishing: TILE.FISHING, promenade: TILE.PROMENADE, port: TILE.PORT, resort: TILE.RESORT, lighthouse: TILE.LIGHTHOUSE };

export function coastTile(k: CoastKind): TileId {
  return COAST_TILES[k];
}

export function coastOf(tile: number): CoastKind | null {
  if (tile === TILE.FISHING) return 'fishing';
  if (tile === TILE.PROMENADE) return 'promenade';
  if (tile === TILE.PORT) return 'port';
  if (tile === TILE.RESORT) return 'resort';
  if (tile === TILE.LIGHTHOUSE) return 'lighthouse';
  return null;
}

export function zoneTile(z: ZoneKind): TileId {
  return z === 'R' ? TILE.R : z === 'C' ? TILE.C : TILE.I;
}

export interface Plant {
  /** Top-left (minimum x, y) cell of the 2×2 footprint, in world coordinates. */
  x: number;
  y: number;
  kind: PlantKind;
  /**
   * Meses de servicio. Ausente en las partidas viejas, y ahí vale cero: una usina sin edad es una usina
   * nueva, y el archivo se lee igual sin subir la versión.
   */
  age?: number;
  /** Ya avisó en el diario que entró en declive (para no repetirlo todos los meses). */
  warned?: boolean;
}

/** One piece of an airport or a harbour: its top-left cell, in world coordinates (its size is in `HUBS`). */
export interface Hub {
  x: number;
  y: number;
  kind: HubKind;
}

/** Un lote de cultivo: su esquina de arriba a la izquierda (es de `FARM_SIZE`) y qué se sembró. */
export interface Farm {
  x: number;
  y: number;
  crop: CropKind;
}

/** Un silo: su esquina, y las toneladas que tiene guardadas. */
export interface Silo {
  x: number;
  y: number;
  tons: number;
}

/** Una feria: una sola por ciudad en el corte 1, pero la lista deja lugar a más. */
export interface Market {
  x: number;
  y: number;
}

/** A unique building: its top-left cell (its size is in `UNIQUES`) and which monument it is. */
export interface Unique {
  x: number;
  y: number;
  kind: UniqueKind;
}

export function hubTile(kind: HubKind): TileId {
  return kind === 'airport' ? TILE.AIRPORT : TILE.HARBOR;
}

export function hubOf(tile: number): HubKind | null {
  return tile === TILE.AIRPORT ? 'airport' : tile === TILE.HARBOR ? 'harbor' : null;
}

/**
 * The city grid. Terrain is owned here too because building roads or zones removes trees.
 * Derived layers (powered, pollution, landValue, roadAccess) are recomputed by the simulation.
 */
export class World {
  readonly n: number;
  readonly terrain: Terrain;
  readonly tiles: Uint8Array;
  readonly level: Uint8Array;
  readonly variant: Uint8Array;
  /** 1 when a building stands empty: nobody lives or works there. */
  readonly abandoned: Uint8Array;
  /** 0–100: how tired the neighbours of this lot are of what is wrong and nobody fixes. At 100 they leave. */
  readonly anger: Uint8Array;
  /**
   * Meses que lleva este lote con algo mal (0 = nada). Lo escribe `stepAnger` y lo lee el panel de los
   * vecinos: «hace ocho meses que la luz se corta» es el dato, no una figura. Se satura a los 255 meses.
   */
  readonly troubleMonths: Uint8Array;
  /** Meses desde que el último problema del lote se arregló (−1 = nunca). Es lo que da el agradecimiento. */
  readonly fixedMonths: Int8Array;
  /**
   * Qué problema tenía el lote, como código de `GRIPES` (0 = ninguno). Se queda escrito después de
   * arreglarlo: es lo que le permite al vecino agradecer por lo que se arregló y no por otra cosa.
   */
  readonly troubleWhat: Uint8Array;
  /**
   * 1 on streets that came with a real-place map: they are only charged once buildings use
   * them. Any change of tile on the cell clears it, so a street bulldozed and built again is
   * the player's own (building a street over a street changes nothing).
   */
  readonly inherited: Uint8Array;
  /**
   * 1 on the cells of the provincial route of a generated map (an ordinary road that cannot be
   * touched and costs nothing; see `odd/tasks/ruta-provincial.md`). All zeros on real-place maps
   * and on cities without a route, which then have no restriction at all.
   */
  readonly route: Uint8Array;
  /**
   * Quality of each street cell: an index into `ROAD_TIERS` (0 = asphalt). Zero on every cell that
   * is not a street, and a cell that stops being a street loses it, like `inherited`.
   */
  readonly roadTier: Uint8Array;
  /**
   * Quality of each cell of the grid: an index into `LINE_TIERS` (0 = wooden, the line of always). Zero on
   * every cell that is not a pole, and a cell that stops being one loses it, like `roadTier`.
   */
  readonly lineTier: Uint8Array;
  /**
   * The line of each bus depot: its colour (an index into `BUS_COLORS`) and its number packed in
   * 16 bits (see `world/transport.ts`). Zero on every cell that is not a depot.
   */
  readonly busLine: Uint16Array;
  /** Ticks left of a fire burning in the cell (0 = no fire). */
  readonly fire: Uint8Array;
  plants: Plant[] = [];
  /** The pieces of the airports and harbours, each with its anchor; pieces that touch are one facility. */
  hubs: Hub[] = [];
  /** The unique buildings of the city, at most one of each kind, each with its anchor. */
  uniques: Unique[] = [];
  /** Los lotes de cultivo, cada uno con su esquina y su cultivo. */
  farms: Farm[] = [];
  /** Los silos, con lo que tienen guardado. El stock del campo es la suma de todos. */
  silos: Silo[] = [];
  /** Las ferias: lo único que convierte toneladas en pesos. */
  markets: Market[] = [];
  /**
   * La presión de oferta: cuánto ablanda el precio lo que la ciudad ya volcó al mercado (ver
   * `sim/campo.ts`). Vive acá y no en la simulación porque el presupuesto la lee del mundo, igual que la
   * costa, y porque así se guarda con el resto del terreno.
   */
  farmPressure = 0;

  readonly powered: Uint8Array;
  /**
   * 1 en las celdas que caen dentro de alguna red eléctrica, tengan luz o no. Sirve para separar «no me
   * llega el tendido» de «la red no da abasto» en el consultar. Se recalcula en `computePower`, no se guarda.
   */
  readonly powerNet: Uint8Array;
  /** 1 en las celdas cuya red no da abasto: lo que falta es capacidad, no tendido. Se recalcula igual. */
  readonly powerShort: Uint8Array;
  readonly pollution: Uint8Array;
  readonly landValue: Uint8Array;
  readonly roadAccess: Uint8Array;
  /** Whether the coast building on the cell reaches the street, itself or through the ones beside it. */
  readonly coastAccess: Uint8Array;
  /** 0–100, how unsafe the cell is. */
  readonly crime: Uint8Array;
  /** 0–100 coverage of each public service. */
  readonly edu: Uint8Array;
  readonly health: Uint8Array;
  readonly safety: Uint8Array;
  readonly fireCover: Uint8Array;
  /** 0–100 coverage of the second-level services: what the tallest homes (hospital) and shops and factories (university) ask for. */
  readonly hospital: Uint8Array;
  readonly university: Uint8Array;
  /** Load of each street cell in percent of its capacity (over 100 = saturated; capped at 255). */
  readonly traffic: Uint8Array;
  /** For every lot near a street, the traffic of the street it opens onto. */
  readonly jam: Uint8Array;
  /** Cells of the plaza patch each park cell belongs to (0 outside a plaza). */
  readonly parkArea: Uint16Array;
  /** 0-100, how well the plaza patch of each cell is kept (0 outside a plaza). */
  readonly parkCare: Uint8Array;

  /** Bumped whenever something that conducts power or gives road access changes. */
  networkVersion = 0;
  private dirty = new Set<number>();

  constructor(terrain: Terrain) {
    this.n = terrain.n;
    this.terrain = terrain;
    const size = this.n * this.n;
    this.tiles = new Uint8Array(size);
    this.level = new Uint8Array(size);
    this.variant = new Uint8Array(size);
    this.abandoned = new Uint8Array(size);
    this.anger = new Uint8Array(size);
    this.troubleMonths = new Uint8Array(size);
    this.fixedMonths = new Int8Array(size).fill(-1);
    this.troubleWhat = new Uint8Array(size);
    this.inherited = new Uint8Array(size);
    this.route = new Uint8Array(size);
    this.roadTier = new Uint8Array(size);
    this.lineTier = new Uint8Array(size);
    this.busLine = new Uint16Array(size);
    this.fire = new Uint8Array(size);
    this.crime = new Uint8Array(size);
    this.edu = new Uint8Array(size);
    this.health = new Uint8Array(size);
    this.safety = new Uint8Array(size);
    this.fireCover = new Uint8Array(size);
    this.hospital = new Uint8Array(size);
    this.university = new Uint8Array(size);
    this.traffic = new Uint8Array(size);
    this.jam = new Uint8Array(size);
    this.parkArea = new Uint16Array(size);
    this.parkCare = new Uint8Array(size);
    this.powered = new Uint8Array(size);
    this.powerNet = new Uint8Array(size);
    this.powerShort = new Uint8Array(size);
    this.pollution = new Uint8Array(size);
    this.landValue = new Uint8Array(size);
    this.roadAccess = new Uint8Array(size);
    this.coastAccess = new Uint8Array(size);
    for (let i = 0; i < size; i++) this.variant[i] = (i * 2654435761) >>> 29;
  }

  idx(x: number, y: number): number {
    return y * this.n + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.n && y < this.n;
  }

  tileAt(x: number, y: number): number {
    return this.tiles[this.idx(x, y)];
  }

  isWater(x: number, y: number): boolean {
    return isWaterCell(this.terrain, x, y);
  }

  minMax(x: number, y: number): [number, number] {
    return cellMinMax(this.terrain, x, y);
  }

  setTile(x: number, y: number, tile: number, level = 0): void {
    const i = this.idx(x, y);
    this.tiles[i] = tile;
    this.level[i] = level;
    this.abandoned[i] = 0;
    this.anger[i] = 0;
    this.troubleMonths[i] = 0;
    this.fixedMonths[i] = -1;
    this.troubleWhat[i] = 0;
    this.inherited[i] = 0;
    this.roadTier[i] = 0;
    this.lineTier[i] = 0;
    this.busLine[i] = 0;
    this.fire[i] = 0;
    this.markDirty(i);
  }

  setLevel(i: number, level: number): void {
    if (this.level[i] === level) return;
    this.level[i] = level;
    this.markDirty(i);
  }

  /** A building with people in it: built, not abandoned and not burning. */
  isOccupied(i: number): boolean {
    return this.level[i] > 0 && this.abandoned[i] === 0 && this.fire[i] === 0;
  }

  plantAt(x: number, y: number): Plant | undefined {
    return this.plants.find((p) => x >= p.x && x < p.x + plantSizeOf(p.kind) && y >= p.y && y < p.y + plantSizeOf(p.kind));
  }

  /** El lote de cultivo que cubre la celda, si hay. */
  farmAt(x: number, y: number): Farm | undefined {
    return this.farms.find((f) => x >= f.x && x < f.x + FARM_SIZE && y >= f.y && y < f.y + FARM_SIZE);
  }

  /** El silo que cubre la celda, si hay. */
  siloAt(x: number, y: number): Silo | undefined {
    return this.silos.find((s) => x >= s.x && x < s.x + SILO_SIZE && y >= s.y && y < s.y + SILO_SIZE);
  }

  /** La feria que cubre la celda, si hay. */
  marketAt(x: number, y: number): Market | undefined {
    return this.markets.find((m) => x >= m.x && x < m.x + MARKET_SIZE && y >= m.y && y < m.y + MARKET_SIZE);
  }

  /** The piece of an airport or a harbour that covers the cell, if any. */
  hubAt(x: number, y: number): Hub | undefined {
    return this.hubs.find((h) => x >= h.x && x < h.x + HUBS[h.kind].w && y >= h.y && y < h.y + HUBS[h.kind].h);
  }

  /** The unique building that covers the cell, if any. */
  uniqueAt(x: number, y: number): Unique | undefined {
    return this.uniques.find((u) => x >= u.x && x < u.x + UNIQUES[u.kind].w && y >= u.y && y < u.y + UNIQUES[u.kind].h);
  }

  markDirty(i: number): void {
    this.dirty.add(i);
  }

  markAllDirty(): void {
    for (let i = 0; i < this.n * this.n; i++) this.dirty.add(i);
  }

  /** Returns and clears the set of cells changed since the last call. */
  takeDirty(): number[] {
    const out = Array.from(this.dirty);
    this.dirty.clear();
    return out;
  }

  bumpNetwork(): void {
    this.networkVersion++;
  }
}
