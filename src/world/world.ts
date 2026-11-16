import { HUBS, PLANT_SIZE, type CoastKind, type HubKind, type PlantKind, type ServiceKind } from '../config';
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
} as const;
export const MAX_TILE = TILE.UNIVERSITY;
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
}

/** One piece of an airport or a harbour: its top-left cell, in world coordinates (its size is in `HUBS`). */
export interface Hub {
  x: number;
  y: number;
  kind: HubKind;
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
   * The line of each bus depot: its colour (an index into `BUS_COLORS`) and its number packed in
   * 16 bits (see `world/transport.ts`). Zero on every cell that is not a depot.
   */
  readonly busLine: Uint16Array;
  /** Ticks left of a fire burning in the cell (0 = no fire). */
  readonly fire: Uint8Array;
  plants: Plant[] = [];
  /** The pieces of the airports and harbours, each with its anchor; pieces that touch are one facility. */
  hubs: Hub[] = [];

  readonly powered: Uint8Array;
  readonly pollution: Uint8Array;
  readonly landValue: Uint8Array;
  readonly roadAccess: Uint8Array;
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
    this.inherited = new Uint8Array(size);
    this.route = new Uint8Array(size);
    this.roadTier = new Uint8Array(size);
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
    this.pollution = new Uint8Array(size);
    this.landValue = new Uint8Array(size);
    this.roadAccess = new Uint8Array(size);
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
    this.inherited[i] = 0;
    this.roadTier[i] = 0;
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
    return this.plants.find((p) => x >= p.x && x < p.x + PLANT_SIZE && y >= p.y && y < p.y + PLANT_SIZE);
  }

  /** The piece of an airport or a harbour that covers the cell, if any. */
  hubAt(x: number, y: number): Hub | undefined {
    return this.hubs.find((h) => x >= h.x && x < h.x + HUBS[h.kind].w && y >= h.y && y < h.y + HUBS[h.kind].h);
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
