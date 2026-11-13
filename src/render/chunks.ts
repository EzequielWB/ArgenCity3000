/**
 * Pure logic behind the chunked map canvas: the grid of chunks, which of them a rectangle
 * touches, which can hold anything at all, what to render each frame within a time budget, and
 * which to evict. No canvas here, so it runs (and is tested) in node.
 */

/** A rectangle in cache coordinates, half-open: x0 <= x < x1, y0 <= y < y1. */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Side of a chunk in pixels. Small enough that one chunk draws in a few tens of milliseconds
 * (so a frame budget can fit it) and that phones can allocate it; a power of two so chunk
 * edges stay on whole pixels at every zoom the camera allows.
 */
export const CHUNK_SIZE = 512;

export interface ChunkGrid {
  /** Size of the whole cache space, in pixels. */
  width: number;
  height: number;
  size: number;
  cols: number;
  rows: number;
}

export function makeGrid(width: number, height: number, size: number = CHUNK_SIZE): ChunkGrid {
  return { width, height, size, cols: Math.ceil(width / size), rows: Math.ceil(height / size) };
}

export function chunkId(grid: ChunkGrid, cx: number, cy: number): number {
  return cy * grid.cols + cx;
}

/** The area of a chunk; the last row and column are cut at the edge of the cache space. */
export function chunkRect(grid: ChunkGrid, id: number): Rect {
  const cx = id % grid.cols;
  const cy = (id - cx) / grid.cols;
  return {
    x0: cx * grid.size,
    y0: cy * grid.size,
    x1: Math.min(grid.width, (cx + 1) * grid.size),
    y1: Math.min(grid.height, (cy + 1) * grid.size),
  };
}

/**
 * How far each chunk canvas extends past its own area on every side. A polygon cut by the
 * edge of a canvas is rasterized slightly differently from the same polygon on a canvas that
 * holds it whole (the edge is clipped before it is scanned), which would leave a faint seam
 * along the chunk borders; with this margin the cut happens outside the part that is shown.
 */
export const CHUNK_PAD = 16;

/** The canvas area of a chunk: its own area plus the margin (it may reach past the cache space). */
export function paddedRect(grid: ChunkGrid, id: number, pad: number = CHUNK_PAD): Rect {
  return expandRect(chunkRect(grid, id), pad, pad);
}

/**
 * Ids of the chunks a rectangle touches, row by row, counting the `pad` margin around each
 * chunk. Empty when it lies outside the grid.
 */
export function chunksIntersecting(grid: ChunkGrid, rect: Rect, pad = 0): number[] {
  const r = expandRect(rect, pad, pad);
  if (r.x1 <= r.x0 || r.y1 <= r.y0) return [];
  if (r.x1 <= 0 || r.y1 <= 0 || r.x0 >= grid.width || r.y0 >= grid.height) return [];
  const c0 = Math.max(0, Math.floor(r.x0 / grid.size));
  const c1 = Math.min(grid.cols - 1, Math.ceil(r.x1 / grid.size) - 1);
  const r0 = Math.max(0, Math.floor(r.y0 / grid.size));
  const r1 = Math.min(grid.rows - 1, Math.ceil(r.y1 / grid.size) - 1);
  const ids: number[] = [];
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) ids.push(chunkId(grid, cx, cy));
  return ids;
}

/** The pieces of a rectangle, one per chunk it touches, each clipped to the chunk's canvas (its area plus `pad`). */
export function splitRect(grid: ChunkGrid, r: Rect, pad = 0): { id: number; rect: Rect }[] {
  return chunksIntersecting(grid, r, pad).map((id) => {
    const c = paddedRect(grid, id, pad);
    return { id, rect: { x0: Math.max(r.x0, c.x0), y0: Math.max(r.y0, c.y0), x1: Math.min(r.x1, c.x1), y1: Math.min(r.y1, c.y1) } };
  });
}

export function expandRect(r: Rect, mx: number, my: number): Rect {
  return { x0: r.x0 - mx, y0: r.y0 - my, x1: r.x1 + mx, y1: r.y1 + my };
}

/** The part of the cache space a camera at (camX, camY) looking at `zoom` shows on a w x h screen. */
export function visibleRect(camX: number, camY: number, zoom: number, w: number, h: number): Rect {
  const hw = w / 2 / zoom;
  const hh = h / 2 / zoom;
  return { x0: camX - hw, y0: camY - hh, x1: camX + hw, y1: camY + hh };
}

/**
 * Where the drawing of a map can be: the diamond of its ground plane (centre at
 * (originX, originY + halfH)), plus `wide` on each side, `up` above it (tall sprites, terrain
 * height) and `down` below it (the walls of the map).
 */
export interface ContentShape {
  originX: number;
  originY: number;
  halfW: number;
  halfH: number;
  wide: number;
  up: number;
  down: number;
}

/** Whether anything of the map can be drawn inside the rectangle; false for the empty corners. */
export function chunkMayHaveContent(shape: ContentShape, r: Rect): boolean {
  // A pixel at (x, y) can belong to ground at (x +- wide, y - down .. y + up).
  const x0 = r.x0 - shape.wide;
  const x1 = r.x1 + shape.wide;
  const y0 = r.y0 - shape.down;
  const y1 = r.y1 + shape.up;
  const cx = shape.originX;
  const cy = shape.originY + shape.halfH;
  const dx = Math.max(x0 - cx, 0, cx - x1);
  const dy = Math.max(y0 - cy, 0, cy - y1);
  return dx / shape.halfW + dy / shape.halfH <= 1;
}

export interface RenderItem {
  id: number;
  visible: boolean;
}

/**
 * The chunks to draw now, in order: the missing ones in view first, nearest to the focus
 * point (the middle of the screen) first, then the missing ones just outside the view.
 */
export function renderOrder(
  grid: ChunkGrid,
  visible: readonly number[],
  ring: readonly number[],
  isValid: (id: number) => boolean,
  focus: readonly [number, number],
): RenderItem[] {
  const dist = (id: number): number => {
    const r = chunkRect(grid, id);
    const dx = (r.x0 + r.x1) / 2 - focus[0];
    const dy = (r.y0 + r.y1) / 2 - focus[1];
    return dx * dx + dy * dy;
  };
  const pick = (ids: readonly number[], vis: boolean): RenderItem[] =>
    ids
      .filter((id) => !isValid(id))
      .sort((a, b) => dist(a) - dist(b) || a - b)
      .map((id) => ({ id, visible: vis }));
  return [...pick(visible, true), ...pick(ring, false)];
}

export interface BudgetState {
  /** Chunks drawn so far this frame. */
  rendered: number;
  /** Milliseconds spent on them. */
  elapsed: number;
  /** Cost of the last one. */
  lastCost: number;
  limit: number;
  /** The chunk is in view (so something would be missing on screen without it). */
  mustHave: boolean;
}

/**
 * Whether to draw one more chunk this frame. A chunk in view is always drawn when nothing has
 * been drawn yet, so the picture makes progress even if a chunk costs more than the budget;
 * after that, only when the next one is expected to fit.
 */
export function shouldRender(s: BudgetState): boolean {
  if (s.rendered === 0 && s.mustHave) return true;
  return s.elapsed + (s.rendered > 0 ? s.lastCost : 0) <= s.limit;
}

/** The budget of one frame: keeps the clock and the cost of the chunks drawn so far. */
export class FrameBudget {
  private rendered = 0;
  private lastCost = 0;
  private readonly start: number;

  constructor(
    private readonly limit: number,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.start = now();
  }

  allow(mustHave: boolean): boolean {
    return shouldRender({ rendered: this.rendered, elapsed: this.now() - this.start, lastCost: this.lastCost, limit: this.limit, mustHave });
  }

  spent(cost: number): void {
    this.rendered++;
    this.lastCost = cost;
  }
}

/**
 * Chunks to free so that at most `maxLive` stay, oldest use first. Chunks in `keep` (in view)
 * are never freed, even when that leaves more than `maxLive`.
 */
export function pickEvictions(entries: readonly { id: number; lastUsed: number }[], keep: ReadonlySet<number>, maxLive: number): number[] {
  let live = entries.length;
  if (live <= maxLive) return [];
  const out: number[] = [];
  const candidates = entries.filter((e) => !keep.has(e.id)).sort((a, b) => a.lastUsed - b.lastUsed || a.id - b.id);
  for (const e of candidates) {
    if (live <= maxLive) break;
    out.push(e.id);
    live--;
  }
  return out;
}
