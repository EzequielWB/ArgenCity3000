import { PLANT_SIZE } from '../config';
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
} as const;
export type TileId = (typeof TILE)[keyof typeof TILE];

export type ZoneKind = 'R' | 'C' | 'I';

export function zoneOf(tile: number): ZoneKind | null {
  if (tile === TILE.R) return 'R';
  if (tile === TILE.C) return 'C';
  if (tile === TILE.I) return 'I';
  return null;
}

export function zoneTile(z: ZoneKind): TileId {
  return z === 'R' ? TILE.R : z === 'C' ? TILE.C : TILE.I;
}

export interface Plant {
  /** Top-left (minimum x, y) cell of the 2×2 footprint, in world coordinates. */
  x: number;
  y: number;
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
  plants: Plant[] = [];

  readonly powered: Uint8Array;
  readonly pollution: Uint8Array;
  readonly landValue: Uint8Array;
  readonly roadAccess: Uint8Array;

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
    this.markDirty(i);
  }

  setLevel(i: number, level: number): void {
    if (this.level[i] === level) return;
    this.level[i] = level;
    this.markDirty(i);
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
