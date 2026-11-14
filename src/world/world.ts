import { PLANT_SIZE, type CoastKind, type PlantKind, type ServiceKind } from '../config';
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
} as const;
export const MAX_TILE = TILE.LIGHTHOUSE;
export type TileId = (typeof TILE)[keyof typeof TILE];

export type ZoneKind = 'R' | 'C' | 'I';

export function zoneOf(tile: number): ZoneKind | null {
  if (tile === TILE.R) return 'R';
  if (tile === TILE.C) return 'C';
  if (tile === TILE.I) return 'I';
  return null;
}

const SERVICE_TILES: Record<ServiceKind, TileId> = { school: TILE.SCHOOL, clinic: TILE.CLINIC, police: TILE.POLICE, fire: TILE.FIREHOUSE };

export function serviceTile(k: ServiceKind): TileId {
  return SERVICE_TILES[k];
}

export function serviceOf(tile: number): ServiceKind | null {
  if (tile === TILE.SCHOOL) return 'school';
  if (tile === TILE.CLINIC) return 'clinic';
  if (tile === TILE.POLICE) return 'police';
  if (tile === TILE.FIREHOUSE) return 'fire';
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
  /**
   * 1 on streets that came with a real-place map: they are only charged once buildings use
   * them. Any change of tile on the cell clears it, so a street bulldozed and built again is
   * the player's own (building a street over a street changes nothing).
   */
  readonly inherited: Uint8Array;
  /** Ticks left of a fire burning in the cell (0 = no fire). */
  readonly fire: Uint8Array;
  plants: Plant[] = [];

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
  /** Load of each street cell in percent of its capacity (over 100 = saturated; capped at 255). */
  readonly traffic: Uint8Array;
  /** For every lot near a street, the traffic of the street it opens onto. */
  readonly jam: Uint8Array;

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
    this.inherited = new Uint8Array(size);
    this.fire = new Uint8Array(size);
    this.crime = new Uint8Array(size);
    this.edu = new Uint8Array(size);
    this.health = new Uint8Array(size);
    this.safety = new Uint8Array(size);
    this.fireCover = new Uint8Array(size);
    this.traffic = new Uint8Array(size);
    this.jam = new Uint8Array(size);
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
    this.inherited[i] = 0;
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
