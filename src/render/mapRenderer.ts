import { PARK, PLANT_SIZE } from '../config';
import { HEIGHT_STEP, TILE_H, TILE_W, fromView, project, toView, unproject, type Rotation } from '../core/iso';
import { hash2 } from '../core/rng';
import { GROUND_TOP, MAX_HEIGHT, SEA_LEVEL, rockLine } from '../world/terrain';
import { TILE, World, coastOf, serviceOf, zoneOf } from '../world/world';
import type { RoadTier } from '../config';
import { KIND, analyzeRoads, boulevardMedian, centreMark, indexOf, isRouteCentre, kindOf, laneLine, routeSigns, tierOf, widthOf, type LaneLine } from './avenue';

/** Asphalt of each street quality: plain, reinforced pavement, boulevard. */
const ROAD_SURFACE = [PAL.asphalt, PAL.asphaltPaved, PAL.asphaltBoulevard] as const;
import {
  CHUNK_PAD,
  CHUNK_SIZE,
  FrameBudget,
  chunkMayHaveContent,
  chunkRect,
  chunksIntersecting,
  expandRect,
  makeGrid,
  paddedRect,
  pickEvictions,
  renderOrder,
  splitRect,
  type ChunkGrid,
  type ContentShape,
  type Rect,
} from './chunks';
import { PAL, mix, rgb, toRgb } from './color';
import { isPlatform, surfaceHeights, viewCornerHeights, plantHeight, type Pt } from './geometry';
import {
  abandonedBuildingSprite,
  buildingSprite,
  burningBuildingSprite,
  coastSprite,
  parkSpriteFor,
  plantSprite,
  poleSpriteFor,
  routeSignSpriteFor,
  serviceSprite,
  treeSpriteFor,
  type Sprite,
} from './sprites';
import { parkTreeHere } from './park';
import { wireCell, wireTargets } from './wire';

/** Room above the map for tall buildings and below it for the map's side walls. */
const PAD_TOP = MAX_HEIGHT * HEIGHT_STEP + 120;
const PAD_BOTTOM = MAX_HEIGHT * HEIGHT_STEP + 48;
const PAD_SIDE = 24;
/** Tallest thing that can stick up above a cell's top corner. */
const SPRITE_REACH = 112;
/** Most chunk canvases kept alive (about 1 MB each); the ones in view are never dropped. */
const MAX_LIVE_CHUNKS = 110;
/** Milliseconds of chunk drawing allowed per frame while the picture catches up with the camera. */
export const FRAME_BUDGET_MS = 30;
/** Budget of the frame after the whole map was invalidated (new game, load, rotation). */
export const URGENT_BUDGET_MS = 450;
/** Chunks this far outside the view are drawn ahead of time while the camera is still and the view is complete. */
const PREFETCH_PX = CHUNK_SIZE * 2;
const BASE_HEIGHT = 0;
/** Paint of the centre lines of an avenue. */
const AVENUE_LINE = '#e0b53c';
/** Asphalt of the provincial route: darker than a street. */
const ROUTE_ASPHALT = '#3a3a40';
/** Distance of each line of a double centre line from the lane boundary, in cell units. */
const DOUBLE_GAP = 0.08;
/** Guardrail of the provincial route, and the posts that hold it. */
const RAIL = '#d3d6cf';
const RAIL_POST = '#6f685e';
/** Lanes of the route that go the same way are told apart by white dashes. */
const ROUTE_DASH = '#f2f2ee';
/** The concrete median of a boulevard: one pixel, as wide as the division of the ways. */
const MEDIAN_CONCRETE = '#c9c4b6';


export interface PlacedSprite {
  sprite: Sprite;
  /** Cache coordinates where the sprite's anchor goes. */
  ax: number;
  ay: number;
}

interface Chunk {
  id: number;
  /** Where the canvas's top left corner is in cache coordinates (CHUNK_PAD before the chunk's own area). */
  x0: number;
  y0: number;
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  /** False once something changed that a redraw of the chunk has not caught up with. */
  valid: boolean;
  lastUsed: number;
}

/**
 * Renders the map (one rotation at a time) into a grid of chunk canvases in "cache
 * coordinates" and keeps them up to date. A chunk is drawn the first time it comes into view,
 * a few per frame, and the ones far from the camera are dropped to bound memory; an edit
 * redraws only the regions around the changed cells in the chunks that are alive, in painter's
 * order.
 */
export class MapRenderer {
  /** Size of the cache space (the map plus room for tall buildings and the walls). */
  readonly width: number;
  readonly height: number;
  readonly originX: number;
  readonly originY: number;
  readonly grid: ChunkGrid;
  rot: Rotation = 0;
  /** Smoke sources in cache coordinates, by cell index. */
  readonly smoke = new Map<number, Pt[]>();

  private g!: CanvasRenderingContext2D;
  private readonly shape: ContentShape;
  private readonly chunks = new Map<number, Chunk>();
  /** Whether each chunk can hold any drawing at all (the corners of the cache space cannot). */
  private readonly hasContent: Uint8Array;
  private tick = 0;
  /** The next frame may spend a long time drawing the view (after a full invalidation). */
  private urgent = true;
  /** Chunks in or near the view at the last `ensure`. */
  private lastKeep = new Set<number>();
  private missing = 0;
  /** Whether each world cell was a road when `bands` was computed. */
  private roadSnap: Uint8Array;
  /** The quality of each street cell when `bands` was computed: an upgrade changes the look too. */
  private tierSnap: Uint8Array;
  /** Avenue analysis of every world cell (see avenue.ts), kept in step with the road layout. */
  private bands: Uint16Array;
  /** Band analysis of the provincial route alone (null when the map has none), and where its signs stand. */
  private routeBands: Uint16Array | null = null;
  private signs = new Map<number, [number, number]>();

  constructor(readonly world: World) {
    const n = world.n;
    this.roadSnap = new Uint8Array(n * n);
    this.tierSnap = world.roadTier.slice();
    this.bands = new Uint16Array(n * n);
    this.width = n * TILE_W + PAD_SIDE * 2;
    this.height = n * TILE_H + PAD_TOP + PAD_BOTTOM;
    this.originX = (n * TILE_W) / 2 + PAD_SIDE;
    this.originY = PAD_TOP;
    this.grid = makeGrid(this.width, this.height);
    this.shape = {
      originX: this.originX,
      originY: this.originY,
      halfW: (n * TILE_W) / 2,
      halfH: (n * TILE_H) / 2,
      wide: TILE_W * (PLANT_SIZE + 0.2) + TILE_W / 2,
      up: MAX_HEIGHT * HEIGHT_STEP + SPRITE_REACH + 16,
      down: 16,
    };
    this.hasContent = new Uint8Array(this.grid.cols * this.grid.rows);
    for (let id = 0; id < this.hasContent.length; id++) this.hasContent[id] = chunkMayHaveContent(this.shape, chunkRect(this.grid, id)) ? 1 : 0;
  }

  /** Visible chunks that are still being drawn: 0 when the last frame showed the whole view. */
  pending(): number {
    return this.missing;
  }

  /** Live chunk canvases and the memory they hold. */
  stats(): { live: number; bytes: number } {
    let bytes = 0;
    for (const c of this.chunks.values()) bytes += c.canvas.width * c.canvas.height * 4;
    return { live: this.chunks.size, bytes };
  }

  /** Ids of the chunks in the rectangle that can hold any drawing. */
  contentChunks(r: Rect): number[] {
    return chunksIntersecting(this.grid, r).filter((id) => this.hasContent[id] === 1);
  }

  /**
   * Draws, within a time budget, the chunks of the view that are missing (and, when the view
   * is complete, a few just outside it), and drops the chunks far from the camera.
   * `view` is the visible rectangle in cache coordinates, `focus` the middle of the screen and
   * `budgetMs` the time to spend this frame (a chunk in view is drawn even if it costs more).
   * The chunks around the view are only drawn ahead when `prefetch` is set (the camera is still).
   */
  ensure(view: Rect, focus: readonly [number, number], budgetMs: number = FRAME_BUDGET_MS, prefetch = true): void {
    const tick = ++this.tick;
    const urgent = this.urgent;
    this.urgent = false;
    const visible = this.contentChunks(view);
    const seen = new Set(visible);
    const ring = this.contentChunks(expandRect(view, PREFETCH_PX, PREFETCH_PX)).filter((id) => !seen.has(id));
    this.lastKeep = new Set([...visible, ...ring]);
    for (const id of this.lastKeep) {
      const c = this.chunks.get(id);
      if (c) c.lastUsed = tick;
    }
    const valid = (id: number) => this.chunks.get(id)?.valid === true;
    // Copying a lot of chunks to the screen already takes time (far zooms show most of the map).
    const budget = new FrameBudget(urgent ? URGENT_BUDGET_MS : Math.max(8, budgetMs - 0.25 * visible.length));
    for (const item of renderOrder(this.grid, visible, urgent || !prefetch ? [] : ring, valid, focus)) {
      if (!budget.allow(item.visible)) break;
      budget.spent(this.renderChunk(item.id, tick));
    }
    this.missing = visible.filter((id) => !valid(id)).length;
    const live = [...this.chunks.values()].map((c) => ({ id: c.id, lastUsed: c.lastUsed }));
    for (const id of pickEvictions(live, this.lastKeep, MAX_LIVE_CHUNKS)) this.drop(id);
  }

  /**
   * Calls `draw` with every drawn chunk in the rectangle: its canvas and where the chunk's own
   * area starts in cache coordinates (the canvas has CHUNK_PAD more on every side).
   */
  forEachChunk(view: Rect, draw: (canvas: HTMLCanvasElement, x0: number, y0: number) => void): void {
    for (const id of this.contentChunks(view)) {
      const c = this.chunks.get(id);
      if (c?.valid) draw(c.canvas, c.x0 + CHUNK_PAD, c.y0 + CHUNK_PAD);
    }
  }

  /** Draws a chunk from scratch and returns what it cost, in milliseconds. */
  private renderChunk(id: number, tick: number): number {
    const r = paddedRect(this.grid, id);
    let c = this.chunks.get(id);
    if (!c) {
      const canvas = document.createElement('canvas');
      canvas.width = r.x1 - r.x0;
      canvas.height = r.y1 - r.y0;
      c = { id, x0: r.x0, y0: r.y0, canvas, g: canvas.getContext('2d')!, valid: false, lastUsed: tick };
      this.chunks.set(id, c);
    }
    c.lastUsed = tick;
    const t0 = performance.now();
    this.paint(c, r);
    c.valid = true;
    // A canvas does its drawing later (when it is read or copied). Reading a pixel makes it finish
    // now, so the clock sees the whole cost and the frame budget holds, instead of the bill
    // arriving all at once the first time many freshly drawn chunks are copied to the screen.
    c.g.getImageData(0, 0, 1, 1);
    return performance.now() - t0;
  }

  private drop(id: number): void {
    const c = this.chunks.get(id);
    if (!c) return;
    c.canvas.width = 0;
    c.canvas.height = 0;
    this.chunks.delete(id);
  }

  /** Marks every chunk as out of date: the ones in view are redrawn next frame, the rest freed. */
  private invalidateAll(): void {
    for (const c of [...this.chunks.values()]) {
      if (this.lastKeep.has(c.id)) c.valid = false;
      else this.drop(c.id);
    }
    this.urgent = true;
    this.missing = 1;
  }

  setRotation(rot: Rotation): void {
    this.rot = rot;
    this.redrawAll();
  }

  /** Map-origin-relative projection → cache canvas coordinates. */
  toCache(px: number, py: number, h: number): Pt {
    const [x, y] = project(px, py, h);
    return [x + this.originX, y + this.originY];
  }

  /** Recomputes which road cells form avenues. Cheap: one pass over the grid. */
  private refreshBands(): void {
    const w = this.world;
    this.bands = analyzeRoads((x, y) => w.tiles[y * w.n + x] === TILE.ROAD, w.n, (x, y) => w.roadTier[y * w.n + x] as RoadTier);
    for (let i = 0; i < this.roadSnap.length; i++) {
      this.roadSnap[i] = w.tiles[i] === TILE.ROAD ? 1 : 0;
      this.tierSnap[i] = w.roadTier[i];
    }
  }

  /**
   * Brings the avenue analysis up to date after an edit and returns the cells whose look
   * depends on it. A cell's look depends on the width of its band, so adding or removing one
   * road cell can change cells far from it along the band; comparing the analysis before and
   * after finds them all, whatever the distance.
   */
  private syncBands(dirty: number[]): number[] {
    const tiles = this.world.tiles;
    const tier = this.world.roadTier;
    let flipped = false;
    for (const i of dirty) {
      // An upgrade leaves the cell a street: the layout does not flip, its quality does.
      if ((tiles[i] === TILE.ROAD ? 1 : 0) !== this.roadSnap[i] || tier[i] !== this.tierSnap[i]) {
        flipped = true;
        break;
      }
    }
    if (!flipped) return [];
    const before = this.bands;
    this.refreshBands();
    const changed: number[] = [];
    for (let i = 0; i < before.length; i++) if (before[i] !== this.bands[i]) changed.push(i);
    return changed;
  }

  /** Reads the provincial route (it never changes while a game runs). */
  private refreshRoute(): void {
    const w = this.world;
    const any = w.route.some((v) => v === 1);
    this.routeBands = any ? analyzeRoads((x, y) => w.route[y * w.n + x] === 1, w.n) : null;
    this.signs = any ? routeSigns(w.route, w.n) : new Map();
  }

  /** Throws the drawing away; the chunks in view come back on the next `ensure`. */
  redrawAll(): void {
    this.refreshRoute();
    this.refreshBands();
    this.smoke.clear();
    this.invalidateAll();
  }

  /** Redraws everything around the given changed world cells. */
  update(dirty: number[]): void {
    if (dirty.length === 0) return;
    const w = this.world;
    const n = w.n;
    if (dirty.length > 2500) {
      this.redrawAll();
      return;
    }
    const cells = new Set<number>();
    for (const i of dirty) {
      cells.add(i);
      const x = i % n;
      const y = (i - x) / n;
      if (x > 0) cells.add(i - 1);
      if (x < n - 1) cells.add(i + 1);
      if (y > 0) cells.add(i - n);
      if (y < n - 1) cells.add(i + n);
    }
    // Cells whose avenue analysis changed, with their eight neighbours: a road cell's corners
    // and lane lines depend on the diagonals too.
    for (const i of this.syncBands(dirty)) {
      const x = i % n;
      const y = (i - x) / n;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (x + dx >= 0 && x + dx < n && y + dy >= 0 && y + dy < n) cells.add(i + dy * n + dx);
        }
      }
    }
    const rects: Rect[] = [];
    for (const i of cells) {
      const x = i % n;
      const [vx, vy] = toView(x, (i - x) / n, this.rot, n);
      addRect(rects, this.cellBounds(vx, vy));
      this.smoke.delete(i);
    }
    // A chunk that is not drawn (yet) needs nothing: it will be drawn from the world as it is.
    for (const r of rects) {
      const whole = { x0: Math.floor(r.x0), y0: Math.floor(r.y0), x1: Math.ceil(r.x1), y1: Math.ceil(r.y1) };
      for (const piece of this.piecesOf(whole)) {
        const c = this.chunks.get(piece.id);
        if (c?.valid) this.patch(c, piece.rect);
      }
    }
  }

  /**
   * Redraws part of a chunk that is already drawn. The area is painted on a scratch canvas with
   * a margin and only its inside is copied over the chunk: painting straight into the chunk
   * would cut the polygons along the edge of the area, and their rasterization there would
   * differ from a whole redraw by a few levels of colour (see CHUNK_PAD).
   */
  private patch(chunk: Chunk, r: Rect): void {
    const x0 = Math.floor(r.x0);
    const y0 = Math.floor(r.y0);
    const w = Math.ceil(r.x1) - x0;
    const h = Math.ceil(r.y1) - y0;
    if (w <= 0 || h <= 0) return;
    const scratch = scratchCanvas(w + 2 * CHUNK_PAD, h + 2 * CHUNK_PAD);
    const area = { x0: x0 - CHUNK_PAD, y0: y0 - CHUNK_PAD, x1: x0 + w + CHUNK_PAD, y1: y0 + h + CHUNK_PAD };
    this.paint({ ...chunk, x0: area.x0, y0: area.y0, canvas: scratch.canvas, g: scratch.g }, area);
    const g = chunk.g;
    g.clearRect(x0 - chunk.x0, y0 - chunk.y0, w, h);
    g.drawImage(scratch.canvas, CHUNK_PAD, CHUNK_PAD, w, h, x0 - chunk.x0, y0 - chunk.y0, w, h);
  }

  /** The chunks an area touches, each with the part of the area inside it. */
  private piecesOf(r: Rect): { id: number; rect: Rect }[] {
    return splitRect(this.grid, r, CHUNK_PAD);
  }

  private cellBounds(vx: number, vy: number): Rect {
    const [tx] = this.toCache(vx, vy, 0);
    const [, topY] = this.toCache(vx, vy, MAX_HEIGHT);
    const [, botY] = this.toCache(vx + 1, vy + 1, BASE_HEIGHT);
    const wide = TILE_W * (PLANT_SIZE + 0.2);
    return { x0: tx - wide, x1: tx + wide, y0: topY - SPRITE_REACH, y1: botY + 10 };
  }

  /**
   * Draws, inside a chunk, the part of the map that falls in `r` (cache coordinates, within the
   * chunk): clears it and paints again every cell whose drawing could reach it, in painter's
   * order, so the result is what a single canvas over the whole map would show there. Returns
   * how many cells it drew.
   */
  private paint(chunk: Chunk, r: Rect): number {
    const g = chunk.g;
    this.g = g;
    const x0 = Math.floor(r.x0);
    const y0 = Math.floor(r.y0);
    const x1 = Math.ceil(r.x1);
    const y1 = Math.ceil(r.y1);
    g.save();
    g.translate(-chunk.x0, -chunk.y0);
    g.beginPath();
    g.rect(x0, y0, x1 - x0, y1 - y0);
    g.clip();
    g.clearRect(x0, y0, x1 - x0, y1 - y0);
    const [vx0, vy0, vx1, vy1] = this.cellRange(x0, y0, x1, y1);
    let drawn = 0;
    for (let vy = vy0; vy <= vy1; vy++) {
      for (let vx = vx0; vx <= vx1; vx++) {
        const b = this.cellReach(vx, vy);
        if (b.x1 < x0 || b.x0 > x1 || b.y1 < y0 || b.y0 > y1) continue;
        this.drawCell(vx, vy);
        drawn++;
      }
    }
    g.restore();
    return drawn;
  }

  /**
   * The area `drawCell` paints for a cell as it is now: its ground up to its highest corner,
   * plus the sprite standing on it. Tighter than `cellBounds`, which must also cover what the
   * cell used to look like; this is only for choosing which cells to paint into a chunk.
   */
  private cellReach(vx: number, vy: number): Rect {
    const w = this.world;
    const rot = this.rot;
    const [x, y] = fromView(vx, vy, rot, w.n);
    // A pole's wires run to the neighbouring poles, which may stand at other heights.
    if (w.tiles[w.idx(x, y)] === TILE.LINE) return this.cellBounds(vx, vy);
    const hs = surfaceHeights(w, vx, vy, rot);
    const hc = viewCornerHeights(w, vx, vy, rot);
    let top = Math.max(hs[0], hs[1], hs[2], hs[3], hc[0], hc[1], hc[2], hc[3]);
    if (w.isWater(x, y)) top = Math.max(top, SEA_LEVEL + 1);
    const [tx, ty] = this.toCache(vx, vy, 0);
    const [, botY] = this.toCache(vx + 1, vy + 1, BASE_HEIGHT);
    // The ground spans half a tile either side of its top corner; a few pixels cover the strokes.
    const r: Rect = { x0: tx - TILE_W / 2 - 2, x1: tx + TILE_W / 2 + 2, y0: ty - top * HEIGHT_STEP - 2, y1: botY + 10 };
    const obj = this.objectAt(vx, vy);
    if (obj) {
      const left = Math.round(obj.ax - obj.sprite.ax);
      const upper = Math.round(obj.ay - obj.sprite.ay);
      r.x0 = Math.min(r.x0, left);
      r.y0 = Math.min(r.y0, upper);
      r.x1 = Math.max(r.x1, left + obj.sprite.canvas.width);
      r.y1 = Math.max(r.y1, upper + obj.sprite.canvas.height);
    }
    return r;
  }

  /** View cells (inclusive range) whose drawing could reach the rectangle, from its corners at every height. */
  cellRange(x0: number, y0: number, x1: number, y1: number): [number, number, number, number] {
    const n = this.world.n;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [sx, sy] of [
      [x0, y0],
      [x1, y0],
      [x0, y1],
      [x1, y1],
    ]) {
      for (const h of [BASE_HEIGHT - 2, MAX_HEIGHT + SPRITE_REACH / HEIGHT_STEP + 2]) {
        const [px, py] = unproject(sx - this.originX, sy - this.originY, h);
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      }
    }
    return [Math.max(0, Math.floor(minX) - 2), Math.max(0, Math.floor(minY) - 2), Math.min(n - 1, Math.ceil(maxX) + 2), Math.min(n - 1, Math.ceil(maxY) + 2)];
  }

  private drawCell(vx: number, vy: number): void {
    const w = this.world;
    const n = w.n;
    const rot = this.rot;
    const [x, y] = fromView(vx, vy, rot, n);
    const i = w.idx(x, y);
    const tile = w.tiles[i];
    const level = w.level[i];
    const water = w.isWater(x, y);
    const hs = surfaceHeights(w, vx, vy, rot);
    const pts = hs.map((h, k) => this.toCache(vx + (k === 1 || k === 2 ? 1 : 0), vy + (k >= 2 ? 1 : 0), h)) as Pt[];
    this.smoke.delete(i);

    if (water) {
      this.drawWater(vx, vy, x, y);
      if (tile === TILE.ROAD) this.drawBridge(vx, vy, pts, hs, i);
    } else if (hs[0] === hs[1] && hs[1] === hs[2] && hs[2] === hs[3] && isPlatform(w, i)) {
      this.drawPlatform(vx, vy, hs[0], tile);
    } else {
      this.drawGround(vx, vy, x, y);
      if (tile === TILE.ROAD) this.drawRoad(vx, vy, pts, i);
      else if (tile === TILE.PARK) this.drawPark(pts, w.parkArea[i] >= PARK.minArea && w.parkCare[i] < PARK.care);
      else if (tile === TILE.PROMENADE) this.drawPromenade(pts);
      else if (zoneOf(tile) && level === 0) this.drawZoneLot(pts, tile);
    }

    if (vx === n - 1 || vy === n - 1) this.drawSkirts(vx, vy, x, y);

    // Objects standing on the cell.
    const obj = this.objectAt(vx, vy);
    if (obj) this.blit(obj.sprite, obj.ax, obj.ay, i);
    if (tile === TILE.LINE) this.drawWires(vx, vy, obj!);
  }

  /**
   * The sprite standing on a view cell (building, plant, park, pole or trees) and where its
   * anchor goes in cache coordinates, or null. A plant is returned only by its front cell,
   * which is the one drawn last.
   */
  objectAt(vx: number, vy: number): PlacedSprite | null {
    const w = this.world;
    const n = w.n;
    const rot = this.rot;
    const [x, y] = fromView(vx, vy, rot, n);
    const i = w.idx(x, y);
    const tile = w.tiles[i];
    const level = w.level[i];
    if (tile === TILE.PLANT) {
      const p = w.plantAt(x, y);
      if (!p) return null;
      let fx = -1;
      let fy = -1;
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ]) {
        const [cx, cy] = toView(p.x + dx, p.y + dy, rot, n);
        fx = Math.max(fx, cx);
        fy = Math.max(fy, cy);
      }
      if (vx !== fx || vy !== fy) return null;
      const [ax, ay] = this.toCache(fx - (PLANT_SIZE - 1), fy - (PLANT_SIZE - 1), plantHeight(w, p.x, p.y));
      return { sprite: plantSprite(p.kind), ax, ay };
    }
    const hs = surfaceHeights(w, vx, vy, rot);
    if (level > 0 && zoneOf(tile)) {
      const [ax, ay] = this.toCache(vx, vy, hs[0]);
      const make = w.fire[i] ? burningBuildingSprite : w.abandoned[i] ? abandonedBuildingSprite : buildingSprite;
      return { sprite: make(zoneOf(tile)!, level, w.variant[i]), ax, ay };
    }
    const service = serviceOf(tile);
    if (service) {
      const [ax, ay] = this.toCache(vx, vy, hs[0]);
      return { sprite: serviceSprite(service), ax, ay };
    }
    const [ax, ay] = this.toCache(vx, vy, avg(hs));
    const coast = coastOf(tile);
    if (coast) return { sprite: coastSprite(coast, this.coastVariant(coast, vx, vy, x, y)), ax, ay };
    if (tile === TILE.PARK) {
      // A plaza nobody keeps loses its trees and shows dry ground, so the city tells you at a glance.
      const neglected = w.parkArea[i] >= PARK.minArea && w.parkCare[i] < PARK.care;
      const tree =
        !neglected && parkTreeHere(x, y, (cx, cy) => cx >= 0 && cy >= 0 && cx < n && cy < n && w.tiles[w.idx(cx, cy)] === TILE.PARK);
      return { sprite: parkSpriteFor(w.variant[i], neglected ? 'neglected' : tree ? 'tree' : 'bare'), ax, ay };
    }
    if (tile === TILE.LINE) return { sprite: poleSpriteFor(), ax, ay };
    const sign = tile === TILE.ROAD && !w.isWater(x, y) ? this.signs.get(i) : undefined;
    if (sign) {
      // The sign stands on the cell's edge that faces the inside of the map, whatever the rotation.
      const [px, py] = toView(x, y, rot, n);
      const [qx, qy] = toView(x + sign[0], y + sign[1], rot, n);
      return { sprite: routeSignSpriteFor(qx - px, qy - py), ax, ay };
    }
    if (w.terrain.trees[i] && !w.isWater(x, y) && tile !== TILE.ROAD) return { sprite: treeSpriteFor(w.terrain.trees[i], w.variant[i]), ax, ay };
    return null;
  }

  private blit(s: Sprite, ax: number, ay: number, i: number): void {
    this.g.drawImage(s.canvas, Math.round(ax - s.ax), Math.round(ay - s.ay));
    if (s.smoke.length) this.smoke.set(i, s.smoke.map(([dx, dy]) => [Math.round(ax) + dx, Math.round(ay) + dy] as Pt));
  }

  private poly(pts: Pt[], fill: string): void {
    const g = this.g;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    // A hairline in the same color hides the seams between neighbouring polygons.
    g.strokeStyle = fill;
    g.lineWidth = 0.5;
    g.stroke();
  }

  private groundColor(x: number, y: number, hmin: number): string {
    const jitter = 0.95 + hash2(x, y, 17) * 0.1;
    let base: string;
    if (hmin <= SEA_LEVEL) base = PAL.sand;
    else {
      // The grass ramp ends where the world used to: the lowlands keep the colours they had.
      const t = Math.min(1, (hmin - SEA_LEVEL - 1) / Math.max(1, GROUND_TOP - SEA_LEVEL - 1));
      base = t < 0.5 ? mix(PAL.grassLow, PAL.grassMid, t * 2) : mix(PAL.grassMid, PAL.grassHigh, (t - 0.5) * 2);
      // Above the rock line the ground is bare stone, lighter as it climbs to the crest.
      const line = rockLine();
      if (hmin > line) {
        const k = Math.min(1, (hmin - line) / Math.max(1, MAX_HEIGHT - line));
        base = k < 0.5 ? mix(base, PAL.rock, k * 2) : mix(PAL.rock, PAL.rockLight, (k - 0.5) * 2);
      }
    }
    return scaleRgb(base, jitter);
  }

  private drawGround(vx: number, vy: number, x: number, y: number): void {
    const [ht, hr, hb, hl] = viewCornerHeights(this.world, vx, vy, this.rot);
    const T = this.toCache(vx, vy, ht);
    const R = this.toCache(vx + 1, vy, hr);
    const B = this.toCache(vx + 1, vy + 1, hb);
    const L = this.toCache(vx, vy + 1, hl);
    const color = this.groundColor(x, y, Math.min(ht, hr, hb, hl));
    const tri = (a: [number, number, number], b: [number, number, number], c: [number, number, number], pa: Pt, pb: Pt, pc: Pt) => {
      this.poly([pa, pb, pc], scaleRgb(color, light(a, b, c)));
    };
    const vT: [number, number, number] = [vx, vy, ht];
    const vR: [number, number, number] = [vx + 1, vy, hr];
    const vB: [number, number, number] = [vx + 1, vy + 1, hb];
    const vL: [number, number, number] = [vx, vy + 1, hl];
    if (hr === hl && ht !== hb) {
      tri(vT, vR, vL, T, R, L);
      tri(vR, vB, vL, R, B, L);
    } else {
      tri(vT, vR, vB, T, R, B);
      tri(vT, vB, vL, T, B, L);
    }
  }

  private drawWater(vx: number, vy: number, x: number, y: number): void {
    const w = this.world;
    const n = w.n;
    const T = this.toCache(vx, vy, SEA_LEVEL);
    const R = this.toCache(vx + 1, vy, SEA_LEVEL);
    const B = this.toCache(vx + 1, vy + 1, SEA_LEVEL);
    const L = this.toCache(vx, vy + 1, SEA_LEVEL);
    const shimmer = 0.96 + hash2(x, y, 5) * 0.08;
    this.poly([T, R, B, L], scaleRgb(PAL.water, shimmer));
    const g = this.g;
    g.strokeStyle = PAL.foam;
    g.lineWidth = 1;
    const edges: [number, number, Pt, Pt][] = [
      [vx, vy - 1, T, R],
      [vx + 1, vy, R, B],
      [vx, vy + 1, B, L],
      [vx - 1, vy, L, T],
    ];
    for (const [nx, ny, a, b] of edges) {
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      const [wx, wy] = fromView(nx, ny, this.rot, n);
      if (w.isWater(wx, wy)) continue;
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
      g.stroke();
    }
  }

  private drawPlatform(vx: number, vy: number, h: number, tile: number): void {
    const hs = viewCornerHeights(this.world, vx, vy, this.rot);
    const R = this.toCache(vx + 1, vy, h);
    const B = this.toCache(vx + 1, vy + 1, h);
    const L = this.toCache(vx, vy + 1, h);
    const T = this.toCache(vx, vy, h);
    const found = '#a59c8b';
    if (hs[3] < h || hs[2] < h) {
      this.poly([L, B, this.toCache(vx + 1, vy + 1, hs[2]), this.toCache(vx, vy + 1, hs[3])], scaleRgb(found, 0.84));
    }
    if (hs[1] < h || hs[2] < h) {
      this.poly([B, R, this.toCache(vx + 1, vy, hs[1]), this.toCache(vx + 1, vy + 1, hs[2])], scaleRgb(found, 0.66));
    }
    const lot = tile === TILE.R ? '#9cc36b' : tile === TILE.C ? '#cfc6b4' : tile === TILE.I ? '#aaa293' : PAL.concrete;
    this.poly([T, R, B, L], lot);
  }

  private drawZoneLot(pts: Pt[], tile: number): void {
    const color = tile === TILE.R ? PAL.zoneR : tile === TILE.C ? PAL.zoneC : PAL.zoneI;
    const inner = [bilinear(pts, 0.1, 0.1), bilinear(pts, 0.9, 0.1), bilinear(pts, 0.9, 0.9), bilinear(pts, 0.1, 0.9)];
    const g = this.g;
    g.save();
    g.globalAlpha = 0.42;
    this.poly(inner, color);
    g.restore();
    g.beginPath();
    g.moveTo(inner[0][0], inner[0][1]);
    for (const p of inner.slice(1)) g.lineTo(p[0], p[1]);
    g.closePath();
    g.strokeStyle = color;
    g.lineWidth = 0.8;
    g.stroke();
  }

  private drawPark(pts: Pt[], dry = false): void {
    this.poly(pts, dry ? PAL.parkDry : PAL.park);
    const strip = (u0: number, v0: number, u1: number, v1: number) =>
      this.poly([bilinear(pts, u0, v0), bilinear(pts, u1, v0), bilinear(pts, u1, v1), bilinear(pts, u0, v1)], dry ? PAL.pathDry : PAL.path);
    strip(0.44, 0, 0.56, 1);
    strip(0, 0.44, 1, 0.56);
  }

  /** Paving of a promenade lot, with the seams between its slabs. */
  private drawPromenade(pts: Pt[]): void {
    this.poly(pts, '#d6cdbb');
    const seam = (u0: number, v0: number, u1: number, v1: number) =>
      this.poly([bilinear(pts, u0, v0), bilinear(pts, u1, v0), bilinear(pts, u1, v1), bilinear(pts, u0, v1)], '#c3b8a3');
    seam(0.48, 0, 0.52, 1);
    seam(0, 0.48, 1, 0.52);
    const g = this.g;
    g.strokeStyle = '#a79c86';
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
    g.closePath();
    g.stroke();
  }

  /**
   * What distinguishes the sprite of a coast building on a view cell: the sides of the lot that
   * face water (bits 1, 2, 4, 8 in the order of the sprite's edges, plus 16 on every other lot
   * for a lamp) for the promenade, and the side the jetty runs out to for the fishing pier.
   */
  private coastVariant(kind: ReturnType<typeof coastOf>, vx: number, vy: number, x: number, y: number): number {
    if (kind !== 'promenade' && kind !== 'fishing') return 0;
    const n = this.world.n;
    let mask = 0;
    [
      [vx, vy - 1],
      [vx + 1, vy],
      [vx, vy + 1],
      [vx - 1, vy],
    ].forEach(([nx, ny], k) => {
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) return;
      const [wx, wy] = fromView(nx, ny, this.rot, n);
      if (this.world.isWater(wx, wy)) mask |= 1 << k;
    });
    if (kind === 'promenade') return mask | ((x + y) % 2 === 0 ? 16 : 0);
    // The jetty goes to the first side facing water; with water only at a corner, to the front-left one.
    for (const k of [2, 1, 0, 3]) if (mask & (1 << k)) return k;
    return 2;
  }

  private isRoadView(vx: number, vy: number): boolean {
    const n = this.world.n;
    if (vx < 0 || vy < 0 || vx >= n || vy >= n) return false;
    const [x, y] = fromView(vx, vy, this.rot, n);
    return this.world.tileAt(x, y) === TILE.ROAD;
  }

  private drawRoad(vx: number, vy: number, pts: Pt[], i: number): void {
    // The route has no pavement strip: its asphalt runs to the edge of the cell.
    if (!this.routeBands || !this.world.route[i]) this.poly(pts, PAL.sidewalk);
    this.drawAsphalt(vx, vy, pts, i);
  }

  private drawAsphalt(vx: number, vy: number, pts: Pt[], i: number): void {
    if (this.routeBands && this.world.route[i]) {
      this.drawRouteAsphalt(vx, vy, pts, i);
      return;
    }
    const code = this.bands[i];
    if (kindOf(code) > KIND.PLAIN) {
      this.drawWideAsphalt(vx, vy, pts, i, code);
      return;
    }
    const up = this.isRoadView(vx, vy - 1);
    const right = this.isRoadView(vx + 1, vy);
    const down = this.isRoadView(vx, vy + 1);
    const left = this.isRoadView(vx - 1, vy);
    const a = 0.18;
    const b = 0.82;
    const tier = tierOf(code);
    const sub = (u0: number, v0: number, u1: number, v1: number) =>
      this.poly([bilinear(pts, u0, v0), bilinear(pts, u1, v0), bilinear(pts, u1, v1), bilinear(pts, u0, v1)], ROAD_SURFACE[tier]);
    sub(a, a, b, b);
    if (up) sub(a, 0, b, a);
    if (down) sub(a, b, b, 1);
    if (left) sub(0, a, a, b);
    if (right) sub(b, a, 1, b);
    // Centre lines towards each connection: cream dashes on plain asphalt, the raised markers of
    // reinforced pavement (little yellow lights), and the concrete median of a boulevard.
    const g = this.g;
    const mark = centreMark(tier);
    g.strokeStyle = mark === 'concrete' ? MEDIAN_CONCRETE : mark === 'lights' ? AVENUE_LINE : PAL.marking;
    g.lineWidth = mark === 'plain' ? 0.8 : mark === 'concrete' ? 1 : 1.2;
    g.setLineDash(mark === 'concrete' ? [] : mark === 'lights' ? [1, 2] : [2, 2]);
    const c = bilinear(pts, 0.5, 0.5);
    const line = (u: number, v: number) => {
      const p = bilinear(pts, u, v);
      g.beginPath();
      g.moveTo(c[0], c[1]);
      g.lineTo(p[0], p[1]);
      g.stroke();
    };
    const links = [up, right, down, left].filter(Boolean).length;
    if (links <= 2) {
      if (up) line(0.5, 0);
      if (down) line(0.5, 1);
      if (left) line(0, 0.5);
      if (right) line(1, 0.5);
    } else {
      // Crossing: zebra stripes instead of centre lines.
      g.setLineDash([]);
      g.strokeStyle = 'rgba(242,231,182,0.8)';
      for (let k = 0; k < 3; k++) {
        const t = 0.3 + k * 0.2;
        const p = bilinear(pts, t, 0.22);
        const q = bilinear(pts, t, 0.3);
        g.beginPath();
        g.moveTo(p[0], p[1]);
        g.lineTo(q[0], q[1]);
        g.stroke();
      }
    }
    g.setLineDash([]);
    if (tier === 2) this.drawLamps(pts, vx, vy, !up, !right, !down, !left);
  }

  /**
   * The lamps of a boulevard: one every few cells, standing on the sidewalk along its outer
   * edges. A cell with no sidewalk left (inside a junction) gets none.
   */
  private drawLamps(pts: Pt[], vx: number, vy: number, up: boolean, right: boolean, down: boolean, left: boolean): void {
    if ((vx + vy) % 3 !== 0) return;
    const g = this.g;
    g.fillStyle = PAL.lamp;
    for (const [on, u, v] of [
      [up, 0.5, 0.07],
      [down, 0.5, 0.93],
      [left, 0.07, 0.5],
      [right, 0.93, 0.5],
    ] as [boolean, number, number][]) {
      if (!on) continue;
      const p = bilinear(pts, u, v);
      g.beginPath();
      g.arc(p[0], p[1] - 1.2, 1.1, 0, Math.PI * 2);
      g.fill();
    }
  }

  /**
   * A cell of an avenue (or of a junction or block of road): asphalt runs to the edge wherever
   * the road continues, so sidewalk is left only along the outer edges of the whole band, and
   * the lane lines go on the boundaries between its lanes.
   */
  private drawWideAsphalt(vx: number, vy: number, pts: Pt[], i: number, code: number): void {
    const up = this.isRoadView(vx, vy - 1);
    const right = this.isRoadView(vx + 1, vy);
    const down = this.isRoadView(vx, vy + 1);
    const left = this.isRoadView(vx - 1, vy);
    const a = 0.18;
    const b = 0.82;
    const tier = tierOf(code);
    const boulevard = tier === 2;
    const kind = kindOf(code);
    const isBand = kind === KIND.BAND_X || kind === KIND.BAND_Y;
    const lane = isBand ? indexOf(code) : 0;
    const lanes = isBand ? widthOf(code) : 1;
    const surface = ROAD_SURFACE[tier];
    const sub = (u0: number, v0: number, u1: number, v1: number) =>
      this.poly([bilinear(pts, u0, v0), bilinear(pts, u1, v0), bilinear(pts, u1, v1), bilinear(pts, u0, v1)], surface);
    // The pieces overlap by `e`, and reach `e` into the neighbours drawn before this cell,
    // so no seam of sidewalk colour shows through the asphalt of a wide road.
    const e = 0.04;
    sub(a, a, b, b);
    if (up) sub(a, -e, b, a + e);
    if (down) sub(a, b - e, b, 1);
    if (left) sub(-e, a, a + e, b);
    if (right) sub(b - e, a, 1, b);
    // A corner is asphalt only when the road really wraps around it.
    if (up && left && this.isRoadView(vx - 1, vy - 1)) sub(-e, -e, a + e, a + e);
    if (up && right && this.isRoadView(vx + 1, vy - 1)) sub(b - e, -e, 1, a + e);
    if (down && right && this.isRoadView(vx + 1, vy + 1)) sub(b - e, b - e, 1, 1);
    if (down && left && this.isRoadView(vx - 1, vy + 1)) sub(-e, b - e, a + e, 1);

    if (kind === KIND.BLOB) this.drawLamps(pts, vx, vy, !up, !right, !down, !left);
    if (!isBand) return;
    // Each cell draws the lane boundary on its up and left edges, so a boundary is painted
    // once, by the cell drawn later, and never half-covered by it.
    const boundary = (nvx: number, nvy: number): number => {
      const n = this.world.n;
      if (nvx < 0 || nvy < 0 || nvx >= n || nvy >= n) return -1;
      const [x, y] = fromView(nvx, nvy, this.rot, n);
      const j = this.world.idx(x, y);
      // No lane line between a street and the provincial route beside it.
      if (this.world.route[j] !== this.world.route[i]) return -1;
      const other = this.bands[j];
      if (kindOf(other) !== kind || widthOf(other) !== lanes || Math.abs(indexOf(other) - lane) !== 1) return -1;
      return Math.min(lane, indexOf(other));
    };
    const g = this.g;
    const stroke = (style: LaneLine, at: (t: number, off: number) => Pt, t0: number, t1: number) => {
      // Where an avenue paints its double line, the quality decides what the centre looks like: a
      // concrete median on a boulevard and the little yellow markers of reinforced pavement.
      const centre = style === 'double' ? centreMark(tier) : 'plain';
      const single = centre !== 'plain';
      g.strokeStyle = centre === 'concrete' ? MEDIAN_CONCRETE : centre === 'lights' ? AVENUE_LINE : style === 'dash' ? PAL.marking : AVENUE_LINE;
      g.lineWidth = centre === 'concrete' ? 1 : centre === 'lights' ? 1.2 : style === 'dash' ? 0.8 : 0.9;
      g.setLineDash(centre === 'lights' ? [1, 2] : style === 'dash' && !boulevard ? [2, 2] : []);
      for (const off of single ? [0] : style === 'double' ? [-DOUBLE_GAP, DOUBLE_GAP] : [0]) {
        const p = at(t0, off);
        const q = at(t1, off);
        g.beginPath();
        g.moveTo(p[0], p[1]);
        g.lineTo(q[0], q[1]);
        g.stroke();
      }
      g.setLineDash([]);
    };
    if (boulevard && boulevardMedian(lanes, lane) === 'through') {
      // An odd band (or a street of a single cell): the median runs through the middle of this
      // cell, so it goes from the middle of one side to the middle of the opposite one.
      const n = this.world.n;
      const mid = (dx: number, dy: number): Pt | null => {
        const edge = (ex: number, ey: number): [Pt, Pt] =>
          ey < 0
            ? [bilinear(pts, 0, 0), bilinear(pts, 1, 0)]
            : ey > 0
              ? [bilinear(pts, 0, 1), bilinear(pts, 1, 1)]
              : ex < 0
                ? [bilinear(pts, 0, 0), bilinear(pts, 0, 1)]
                : [bilinear(pts, 1, 0), bilinear(pts, 1, 1)];
        const nxv = vx + dx;
        const nyv = vy + dy;
        if (nxv < 0 || nyv < 0 || nxv >= n || nyv >= n) return null;
        const [x, y] = fromView(nxv, nyv, this.rot, n);
        const other = this.bands[this.world.idx(x, y)];
        // Only along the street: the neighbour has to be the same lane of the same band.
        if (kindOf(other) !== kind || widthOf(other) !== lanes || indexOf(other) !== lane) return null;
        const [p, q] = edge(dx, dy);
        return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      };
      const [dx, dy] = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].find(([d1, d2]) => mid(d1, d2)) ?? [0, 0];
      const from = mid(dx, dy);
      const to = mid(-dx, -dy);
      if (from && to) {
        g.strokeStyle = MEDIAN_CONCRETE;
        g.lineWidth = 1;
        g.setLineDash([]);
        g.beginPath();
        g.moveTo(from[0], from[1]);
        g.lineTo(to[0], to[1]);
        g.stroke();
      }
    }
    const jUp = boundary(vx, vy - 1);
    if (jUp >= 0) stroke(laneLine(lanes, jUp), (t, off) => bilinear(pts, t, off), left ? -e : a, right ? 1 : b);
    const jLeft = boundary(vx - 1, vy);
    if (jLeft >= 0) stroke(laneLine(lanes, jLeft), (t, off) => bilinear(pts, off, t), up ? -e : a, down ? 1 : b);
    if (boulevard) this.drawLamps(pts, vx, vy, !up, !right, !down, !left);
  }

  /**
   * A cell of the provincial route: dark asphalt over the whole cell, with one continuous yellow
   * line between its two lanes. Like the lane lines of an avenue, each cell paints the line on
   * its up and left edges, and it comes from the route's own band analysis, so it does not break
   * where a street joins the route.
   */
  private drawRouteAsphalt(vx: number, vy: number, pts: Pt[], i: number): void {
    this.poly(pts, ROUTE_ASPHALT);
    const bands = this.routeBands!;
    const code = bands[i];
    const kind = kindOf(code);
    if (kind !== KIND.BAND_X && kind !== KIND.BAND_Y) return;
    const lane = indexOf(code);
    const lanes = widthOf(code);
    /** Lane of the neighbour across the strip, or -1 when that neighbour is not the lane beside it. */
    const partnerLane = (nvx: number, nvy: number): number => {
      const n = this.world.n;
      if (nvx < 0 || nvy < 0 || nvx >= n || nvy >= n) return -1;
      const [x, y] = fromView(nvx, nvy, this.rot, n);
      const other = bands[this.world.idx(x, y)];
      if (kindOf(other) !== kind || widthOf(other) !== lanes) return -1;
      const otherLane = indexOf(other);
      return Math.abs(otherLane - lane) === 1 ? otherLane : -1;
    };
    const along = (nvx: number, nvy: number): boolean => {
      const n = this.world.n;
      if (nvx < 0 || nvy < 0 || nvx >= n || nvy >= n) return false;
      const [x, y] = fromView(nvx, nvy, this.rot, n);
      return kindOf(bands[this.world.idx(x, y)]) === kind;
    };
    const g = this.g;
    const e = 0.04;
    // One solid yellow line down the middle of the strip; the lanes each way are split by white dashes.
    const stroke = (other: number, p: Pt, q: Pt) => {
      const middle = isRouteCentre(lanes, lane, other);
      g.strokeStyle = middle ? AVENUE_LINE : ROUTE_DASH;
      g.lineWidth = middle ? 1.1 : 0.8;
      g.setLineDash(middle ? [] : [2, 2]);
      g.beginPath();
      g.moveTo(p[0], p[1]);
      g.lineTo(q[0], q[1]);
      g.stroke();
      g.setLineDash([]);
    };
    const up = partnerLane(vx, vy - 1);
    if (up >= 0) stroke(up, bilinear(pts, along(vx - 1, vy) ? -e : 0, 0), bilinear(pts, 1, 0));
    const left = partnerLane(vx - 1, vy);
    if (left >= 0) stroke(left, bilinear(pts, 0, along(vx, vy - 1) ? -e : 0), bilinear(pts, 0, 1));

    // Guardrails along both long sides of the strip, so the road reads as one that passes outside
    // the city instead of a street of it. Which way the strip runs in the view is read from the
    // lane beside it: the outer side of the end lane is the opposite direction.
    const edgeOf = (dx: number, dy: number): [Pt, Pt] =>
      dy < 0 ? [bilinear(pts, 0, 0), bilinear(pts, 1, 0)] : dy > 0 ? [bilinear(pts, 0, 1), bilinear(pts, 1, 1)] : dx < 0 ? [bilinear(pts, 0, 0), bilinear(pts, 0, 1)] : [bilinear(pts, 1, 0), bilinear(pts, 1, 1)];
    const sides: [number, number][] = [];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as [number, number][]) {
      const other = partnerLane(vx + dx, vy + dy);
      if (other === lane + 1 && lane === 0) sides.push([-dx, -dy]);
      if (other === lane - 1 && lane === lanes - 1) sides.push([-dx, -dy]);
    }
    for (const [dx, dy] of sides) {
      const [p, q] = edgeOf(dx, dy);
      g.strokeStyle = RAIL;
      g.beginPath();
      g.moveTo(p[0], p[1] - 1.6);
      g.lineTo(q[0], q[1] - 1.6);
      g.stroke();
      if (i % 2 === 0) {
        g.fillStyle = RAIL_POST;
        for (const t of [0.3, 0.8]) {
          const rx = p[0] + (q[0] - p[0]) * t;
          const ry = p[1] + (q[1] - p[1]) * t;
          g.fillRect(rx - 0.6, ry - 2.8, 1.2, 2.8);
        }
      }
    }
  }

  private drawBridge(vx: number, vy: number, pts: Pt[], hs: readonly number[], i: number): void {
    const g = this.g;
    const deck = (hs[0] + hs[1] + hs[2] + hs[3]) / 4;
    // The faces of the deck: one wall from each outer edge down to the water. They are what
    // closes the gap between the span and the river instead of showing the water through it.
    for (const [u0, v0, u1, v1, nx, ny] of [
      [0, 0, 1, 0, vx, vy - 1],
      [1, 0, 1, 1, vx + 1, vy],
      [0, 1, 1, 1, vx, vy + 1],
      [0, 0, 0, 1, vx - 1, vy],
    ] as [number, number, number, number, number, number][]) {
      if (this.isRoadView(nx, ny)) continue;
      const top0 = this.toCache(vx + u0, vy + v0, deck);
      const top1 = this.toCache(vx + u1, vy + v1, deck);
      const low0 = this.toCache(vx + u0, vy + v0, SEA_LEVEL);
      const low1 = this.toCache(vx + u1, vy + v1, SEA_LEVEL);
      this.poly([top0, top1, low1, low0], '#8c857a');
    }
    // Pillars down to the water, under the span.
    if (deck > SEA_LEVEL) {
      const [px, py] = this.toCache(vx + 0.5, vy + 0.5, deck);
      g.fillStyle = '#6f685e';
      g.fillRect(px - 1.5, py, 3, (deck - SEA_LEVEL) * HEIGHT_STEP);
    }
    this.poly(pts, '#a7a093');
    this.drawAsphalt(vx, vy, pts, i);
    g.strokeStyle = '#6f685e';
    g.lineWidth = 1;
    // Inside a wide bridge there is no rail between its cells, only along its outer edges.
    const wide = kindOf(this.bands[i]) > KIND.PLAIN;
    for (const [a, b, nx, ny] of [
      [pts[3], pts[2], vx, vy + 1],
      [pts[2], pts[1], vx + 1, vy],
    ] as [Pt, Pt, number, number][]) {
      if (wide && this.isRoadView(nx, ny)) continue;
      g.beginPath();
      g.moveTo(a[0], a[1] - 1);
      g.lineTo(b[0], b[1] - 1);
      g.stroke();
    }
  }

  /**
   * The cables hanging from a pole: one to the next pole on each of the sides already painted. A
   * pole two or three cells from the next one is the same grid — the line lights everything within
   * its reach — so the cable spans the gap instead of stopping in the air.
   */
  private drawWires(vx: number, vy: number, pole: PlacedSprite): void {
    const s = pole.sprite;
    const top: Pt = [pole.ax + s.attach![0], pole.ay + s.attach![1]];
    const g = this.g;
    const world = this.world;
    const n = world.n;
    const targets = wireTargets(vx, vy, n, (cx, cy) => {
      const [wx, wy] = fromView(cx, cy, this.rot, n);
      return wireCell(world, wx, wy);
    });
    g.strokeStyle = PAL.wire;
    g.lineWidth = 0.6;
    for (const target of targets) {
      const nh = avg(surfaceHeights(world, target.vx, target.vy, this.rot));
      const [bx, by] = this.toCache(target.vx, target.vy, nh);
      const other: Pt = [bx + s.attach![0], by + s.attach![1]];
      // The two cables of the line, and a sag that grows with the span so a long run dips properly.
      const sag = 3 + 2 * (target.distance - 1);
      for (const off of [-4, 4]) {
        g.beginPath();
        g.moveTo(top[0] + off, top[1]);
        g.quadraticCurveTo((top[0] + other[0]) / 2 + off, (top[1] + other[1]) / 2 + sag, other[0] + off, other[1]);
        g.stroke();
      }
    }
  }

  private drawSkirts(vx: number, vy: number, x: number, y: number): void {
    const n = this.world.n;
    const water = this.world.isWater(x, y);
    const terrain = viewCornerHeights(this.world, vx, vy, this.rot);
    const face = (pa: [number, number, number], pb: [number, number, number], f: number) => {
      const [ax, ay, ha] = pa;
      const [bx, by, hb] = pb;
      const ta = water ? SEA_LEVEL : ha;
      const tb = water ? SEA_LEVEL : hb;
      const earthTopA = water ? SEA_LEVEL - 1 : ha;
      const earthTopB = water ? SEA_LEVEL - 1 : hb;
      if (water) {
        this.poly([this.toCache(ax, ay, ta), this.toCache(bx, by, tb), this.toCache(bx, by, earthTopB), this.toCache(ax, ay, earthTopA)], scaleRgb(PAL.waterDeep, f));
      }
      this.poly(
        [this.toCache(ax, ay, earthTopA), this.toCache(bx, by, earthTopB), this.toCache(bx, by, BASE_HEIGHT - 1), this.toCache(ax, ay, BASE_HEIGHT - 1)],
        scaleRgb(PAL.earth, f),
      );
      this.poly(
        [this.toCache(ax, ay, BASE_HEIGHT), this.toCache(bx, by, BASE_HEIGHT), this.toCache(bx, by, BASE_HEIGHT - 1), this.toCache(ax, ay, BASE_HEIGHT - 1)],
        scaleRgb(PAL.earthDark, f),
      );
    };
    // Use the terrain (not the levelled platform) for the walls of the map.
    if (vy === n - 1) face([vx, vy + 1, terrain[3]], [vx + 1, vy + 1, terrain[2]], 0.84);
    if (vx === n - 1) face([vx + 1, vy, terrain[1]], [vx + 1, vy + 1, terrain[2]], 0.64);
  }
}

let scratch: { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D } | null = null;

/** A shared offscreen canvas of at least w x h (contents are not kept between uses). */
function scratchCanvas(w: number, h: number): { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  if (!scratch) {
    const canvas = document.createElement('canvas');
    scratch = { canvas, g: canvas.getContext('2d')! };
  }
  if (scratch.canvas.width < w) scratch.canvas.width = w;
  if (scratch.canvas.height < h) scratch.canvas.height = h;
  return scratch;
}

function avg(hs: readonly number[]): number {
  return (hs[0] + hs[1] + hs[2] + hs[3]) / 4;
}

/** Point at (u, v) inside a quad given as top, right, bottom, left (u: top→right, v: top→left). */
export function bilinear(p: readonly Pt[], u: number, v: number): Pt {
  const [T, R, B, L] = p;
  return [
    T[0] + u * (R[0] - T[0]) + v * (L[0] - T[0]) + u * v * (T[0] - R[0] - L[0] + B[0]),
    T[1] + u * (R[1] - T[1]) + v * (L[1] - T[1]) + u * v * (T[1] - R[1] - L[1] + B[1]),
  ];
}

function scaleRgb(color: string, f: number): string {
  const [r, g, b] = toRgb(color);
  return rgb(r * f, g * f, b * f);
}

/** Lambert-ish brightness of a terrain triangle; flat ground is 1. Light comes from the upper left. */
function light(a: [number, number, number], b: [number, number, number], c: [number, number, number]): number {
  const k = 0.45;
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = (b[2] - a[2]) * k;
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = (c[2] - a[2]) * k;
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  if (nz < 0) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }
  const len = Math.hypot(nx, ny, nz) || 1;
  const L = [-0.62, -0.12, 0.78];
  const ll = Math.hypot(L[0], L[1], L[2]);
  const dot = (nx * L[0] + ny * L[1] + nz * L[2]) / (len * ll);
  const flat = L[2] / ll;
  return Math.max(0.8, Math.min(1.18, dot / flat));
}

function addRect(rects: Rect[], r: Rect): void {
  for (const q of rects) {
    if (r.x0 <= q.x1 && r.x1 >= q.x0 && r.y0 <= q.y1 && r.y1 >= q.y0) {
      q.x0 = Math.min(q.x0, r.x0);
      q.y0 = Math.min(q.y0, r.y0);
      q.x1 = Math.max(q.x1, r.x1);
      q.y1 = Math.max(q.y1, r.y1);
      return;
    }
  }
  rects.push({ ...r });
}
