/**
 * Service buildings over more than one lot. School, clinic, police and firehouse are one lot and need
 * nothing of this; the hospital and the university take `SERVICE_SIZE` lots on each side, and the tiles
 * are still the truth: a block is the `size`x`size` square of the same tile, and it is **one** building
 * for the coverage, the upkeep, the power and the demolition.
 *
 * The blocks are rebuilt from the tiles in index order instead of being kept in a list: the first lot of
 * a kind that no block has claimed opens a block of its kind and claims its footprint. Two hospitals
 * side by side therefore stay two buildings, and a single lot left over by a mistake is a block of one.
 */
import { SERVICE_SIZE, type ServiceKind } from '../config';
import { serviceOf } from './world';

export type Cell = [number, number];

/** The world as this module needs it: the plan of the city and its size. */
export interface Planned {
  readonly tiles: ArrayLike<number>;
  readonly n: number;
  readonly networkVersion: number;
}

export interface ServiceBlock {
  kind: ServiceKind;
  /** The anchor: the lot at the back corner of the block, kept inside the map. */
  x: number;
  y: number;
  /** Lots on each side. One for the small services. */
  size: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The lots a service of `kind` anchored at (x, y) covers, kept inside the map. */
export function serviceFootprint(kind: ServiceKind, n: number, x: number, y: number): Cell[] {
  const size = SERVICE_SIZE[kind];
  const fx = clamp(x, 0, n - size);
  const fy = clamp(y, 0, n - size);
  const cells: Cell[] = [];
  for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) cells.push([fx + dx, fy + dy]);
  return cells;
}

/** Every service building of a plan, one entry per building and not per lot. */
export function serviceBlocks(tiles: ArrayLike<number>, n: number): ServiceBlock[] {
  const blocks: ServiceBlock[] = [];
  const claimed = new Uint8Array(n * n);
  const total = n * n;
  for (let i = 0; i < total; i++) {
    if (claimed[i] || !serviceOf(tiles[i])) continue;
    const kind = serviceOf(tiles[i])!;
    const x = i % n;
    const y = (i - x) / n;
    const foot = serviceFootprint(kind, n, x, y);
    for (const [cx, cy] of foot) claimed[cy * n + cx] = 1;
    blocks.push({ kind, x: foot[0][0], y: foot[0][1], size: SERVICE_SIZE[kind] });
  }
  return blocks;
}

interface Cached {
  version: number;
  blocks: ServiceBlock[];
  /** The anchor of every lot of a block, by cell index. */
  anchor: Int32Array;
}

const cache = new WeakMap<Planned, Cached>();

/**
 * The same blocks, memoised for a world: the renderer asks once per visible lot, and the plan only
 * changes when the tiles do, which is what `networkVersion` counts.
 */
export function serviceBlocksOf(w: Planned): Cached {
  const hit = cache.get(w);
  if (hit && hit.version === w.networkVersion) return hit;
  const blocks = serviceBlocks(w.tiles, w.n);
  const anchor = new Int32Array(w.n * w.n).fill(-1);
  for (const b of blocks) {
    const at = b.y * w.n + b.x;
    for (const [x, y] of serviceFootprint(b.kind, w.n, b.x, b.y)) anchor[y * w.n + x] = at;
  }
  const entry: Cached = { version: w.networkVersion, blocks, anchor };
  cache.set(w, entry);
  return entry;
}

/** The building that covers the lot at (x, y), or null: a service has to be one. */
export function serviceAt(w: Planned, x: number, y: number): ServiceBlock | null {
  if (x < 0 || y < 0 || x >= w.n || y >= w.n) return null;
  const at = serviceBlocksOf(w).anchor[y * w.n + x];
  return at < 0 ? null : serviceBlocksOf(w).blocks.find((b) => b.y * w.n + b.x === at) ?? null;
}

/** Cell index of the anchor of the building that covers `i`, or `i` when it is not a service. */
export function serviceAnchorIndex(w: Planned, i: number): number {
  const at = serviceBlocksOf(w).anchor[i];
  return at < 0 ? i : at;
}
