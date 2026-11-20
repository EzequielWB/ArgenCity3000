import { fromView, toView } from '../core/iso';
import { hash2 } from '../core/rng';
import { buildingIssues, type Issue, type Unlocked } from '../sim/warnings';
import { hubFacilities } from '../world/hubs';
import { TILE, World, zoneOf } from '../world/world';
import { CHUNK_PAD, FrameBudget, chunkRect, paddedRect, pickEvictions, renderOrder, visibleRect, type Rect } from './chunks';
import { PAL } from './color';
import { cellScreenCorners, type Pt } from './geometry';
import { FRAME_BUDGET_MS, MapRenderer } from './mapRenderer';
import { drawBubble } from './bubbles';
import { Traffic, drawTraffic } from './traffic';
import { Vessels, drawBoats, drawPlanes } from './vessels';
import { drawTornado } from './tornadoArt';
import type { TornadoRun } from '../sim/tornado';

export type Layer = 'none' | 'power' | 'traffic' | 'pollution' | 'landValue' | 'crime' | 'edu' | 'health' | 'fireCover';

export const ZOOMS = [0.25, 0.5, 1, 2, 3] as const;

/** Milliseconds per frame for drawing overlay chunks (they are flat polygons: cheap). */
const LAYER_BUDGET_MS = 8;
/** Most overlay chunk canvases kept alive; the ones in view are never dropped. */
const MAX_LIVE_LAYER_CHUNKS = 110;

/** One chunk of the overlay layer, in the same grid as the map's chunks. */
interface LayerChunk {
  canvas: HTMLCanvasElement;
  /** `layerGen` when it was drawn: older means out of date. */
  gen: number;
  /** Rotation it was drawn for. */
  rot: number;
  lastUsed: number;
}

export interface Preview {
  /** World cells covered by the drag. */
  cells: [number, number][];
  /** Indexes of the cells the action will actually change. */
  valid: Set<number>;
  color: string;
  /** Cells around the drag that the new building will reach (the light of a plant), drawn faintly. */
  halo?: [number, number][];
}

/** Draws the cached map plus per-frame overlays onto the visible canvas. */
export class View {
  readonly ctx: CanvasRenderingContext2D;
  width = 0;
  height = 0;
  dpr = 1;
  cam = { x: 0, y: 0, zoom: 1 };
  zoomIndex = 2;
  layer: Layer = 'none';
  hover: [number, number] | null = null;
  preview: Preview | null = null;

  /** Overlay layer drawn in chunks, only where it is on screen. */
  private readonly layerChunks = new Map<number, LayerChunk>();
  /** Bumped whenever the overlay's content changes; chunks drawn under an older one are redrawn. */
  private layerGen = 0;
  private layerTick = 0;
  private layerMissing = 0;
  private lastTime = 0;
  private lastCam = { x: -1, y: -1, zoom: 0 };
  readonly traffic: Traffic;
  /**
   * El tornado que está pasando, o null. Lo pone el juego antes de renderizar: la vista no conoce la
   * simulación, y el embudo es lo único de la simulación que se dibuja en cada frame.
   */
  tornado: TornadoRun | null = null;
  /** The planes and boats of the airports and harbours. */
  readonly vessels: Vessels;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly map: MapRenderer,
    readonly world: World,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.traffic = new Traffic(world, 12345);
    this.vessels = new Vessels(world, 54321);
    this.refreshTraffic();
    this.resize();
  }

  resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, r.width);
    this.height = Math.max(1, r.height);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
  }

  setLayer(layer: Layer): void {
    this.layer = layer;
    this.layerGen++;
    if (layer === 'none') this.dropLayerChunks();
  }

  invalidateLayer(): void {
    this.layerGen++;
  }

  /** Overlay chunks in view that are still being drawn: 0 when the last frame showed all of it. */
  layerPending(): number {
    return this.layerMissing;
  }

  private dropLayerChunks(): void {
    for (const c of this.layerChunks.values()) {
      c.canvas.width = 0;
      c.canvas.height = 0;
    }
    this.layerChunks.clear();
    this.layerMissing = 0;
  }

  /** Recounts cars per street; call after edits and every month. */
  refreshTraffic(): void {
    this.traffic.refresh();
    this.vessels.refresh();
  }

  /** Screen (CSS px) → cache canvas coordinates. */
  screenToCache(mx: number, my: number): Pt {
    const z = this.cam.zoom;
    return [this.cam.x + (mx - this.width / 2) / z, this.cam.y + (my - this.height / 2) / z];
  }

  /** Screen (CSS px) → coordinates relative to the map origin, as used by picking. */
  screenToMap(mx: number, my: number): Pt {
    const [cx, cy] = this.screenToCache(mx, my);
    return [cx - this.map.originX, cy - this.map.originY];
  }

  /** World cell whose centre is in the middle of the screen (approximately). */
  centreCell(): [number, number] {
    const [mx, my] = this.screenToMap(this.width / 2, this.height / 2);
    const n = this.world.n;
    const a = mx / 16;
    const b = (my + 4 * 8) / 8;
    const vx = Math.max(0, Math.min(n - 1, Math.floor((a + b) / 2)));
    const vy = Math.max(0, Math.min(n - 1, Math.floor((b - a) / 2)));
    return fromView(vx, vy, this.map.rot, n);
  }

  centreOn(x: number, y: number): void {
    const [vx, vy] = toView(x, y, this.map.rot, this.world.n);
    const [cx, cy] = this.map.toCache(vx + 0.5, vy + 0.5, 4);
    this.cam.x = cx;
    this.cam.y = cy;
    this.clamp();
  }

  pan(dx: number, dy: number): void {
    this.cam.x -= dx / this.cam.zoom;
    this.cam.y -= dy / this.cam.zoom;
    this.clamp();
  }

  /** Steps the zoom, keeping the point under (mx, my) fixed. */
  zoomStep(dir: number, mx = this.width / 2, my = this.height / 2): void {
    const next = Math.max(0, Math.min(ZOOMS.length - 1, this.zoomIndex + dir));
    if (next === this.zoomIndex) return;
    const [cx, cy] = this.screenToCache(mx, my);
    this.zoomIndex = next;
    this.cam.zoom = ZOOMS[next];
    this.cam.x = cx - (mx - this.width / 2) / this.cam.zoom;
    this.cam.y = cy - (my - this.height / 2) / this.cam.zoom;
    this.clamp();
  }

  private clamp(): void {
    this.cam.x = Math.max(0, Math.min(this.map.width, this.cam.x));
    this.cam.y = Math.max(0, Math.min(this.map.height, this.cam.y));
  }

  /** What the camera shows, in cache coordinates. */
  private visibleArea(): Rect {
    return visibleRect(this.cam.x, this.cam.y, this.cam.zoom, this.width, this.height);
  }

  /**
   * Draws a chunk image (its own area, without the margin) at its place on the screen, (x0, y0)
   * being where that area starts in cache coordinates. Both edges are snapped to whole device
   * pixels, so neighbouring chunks meet exactly (no seam, no overlap) at any zoom and pixel ratio.
   */
  private drawChunk(g: CanvasRenderingContext2D, img: HTMLCanvasElement, x0: number, y0: number, tx: number, ty: number): void {
    const s = this.dpr * this.cam.zoom;
    const w = img.width - 2 * CHUNK_PAD;
    const h = img.height - 2 * CHUNK_PAD;
    const dx0 = Math.round(x0 * s + tx);
    const dy0 = Math.round(y0 * s + ty);
    const dx1 = Math.round((x0 + w) * s + tx);
    const dy1 = Math.round((y0 + h) * s + ty);
    g.drawImage(img, CHUNK_PAD, CHUNK_PAD, w, h, dx0, dy0, dx1 - dx0, dy1 - dy0);
  }

  render(time: number): void {
    const g = this.ctx;
    const z = this.cam.zoom;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const sky = g.createLinearGradient(0, 0, 0, this.height);
    sky.addColorStop(0, '#f4dcb4');
    sky.addColorStop(1, '#e6b98c');
    g.fillStyle = sky;
    g.fillRect(0, 0, this.width, this.height);

    // Where cache coordinates (0, 0) land on the canvas, in whole device pixels.
    const txd = Math.round((this.width / 2 - this.cam.x * z) * this.dpr);
    const tyd = Math.round((this.height / 2 - this.cam.y * z) * this.dpr);
    const area = this.visibleArea();
    // When frames are already slow (a far zoom draws a lot of chunks), draw fewer new chunks per frame.
    const sinceLast = this.lastTime > 0 ? time - this.lastTime : 0;
    this.lastTime = time;
    const still = this.cam.x === this.lastCam.x && this.cam.y === this.lastCam.y && this.cam.zoom === this.lastCam.zoom;
    this.lastCam = { ...this.cam };
    this.map.ensure(area, [this.cam.x, this.cam.y], sinceLast > 50 ? FRAME_BUDGET_MS / 3 : sinceLast > 34 ? FRAME_BUDGET_MS * 0.6 : FRAME_BUDGET_MS, still);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = z < 1;
    this.map.forEachChunk(area, (img, x0, y0) => this.drawChunk(g, img, x0, y0, txd, tyd));

    if (this.layer !== 'none') {
      this.ensureLayer(area);
      for (const id of this.map.contentChunks(area)) {
        const c = this.layerChunks.get(id);
        // An out-of-date chunk of the right rotation still shows while it is being redrawn.
        if (!c || (c.gen !== this.layerGen && c.rot !== this.map.rot)) continue;
        const r = chunkRect(this.map.grid, id);
        this.drawChunk(g, c.canvas, r.x0, r.y0, txd, tyd);
      }
    }
    g.setTransform(this.dpr * z, 0, 0, this.dpr * z, txd, tyd);

    const [vx0, vy0] = this.screenToCache(0, 0);
    const [vx1, vy1] = this.screenToCache(this.width, this.height);
    const visible = (x: number, y: number, m = 40) => x > vx0 - m && x < vx1 + m && y > vy0 - m && y < vy1 + m;

    if (z >= 0.5) drawBoats(g, this.vessels, this.map, [vx0, vy0, vx1, vy1]);
    if (z >= 1) drawTraffic(g, this.traffic, this.map, [vx0, vy0, vx1, vy1]);
    if (z >= 0.5) drawPlanes(g, this.vessels, this.map, [vx0, vy0, vx1, vy1]);
    // El tornado se dibuja arriba de todo: es lo único del juego que no tiene que quedar tapado por nada.
    if (this.tornado) drawTornado(g, this.tornado, this.world, this.map, time);
    if (z >= 0.5) this.drawSmoke(g, time, visible);
    this.drawBubbles(g, time, visible);
    this.drawPreview(g);
    this.drawHover(g);
  }

  private corners(x: number, y: number): Pt[] {
    const [vx, vy] = toView(x, y, this.map.rot, this.world.n);
    return cellScreenCorners(this.world, vx, vy, this.map.rot).map(([a, b]) => [a + this.map.originX, b + this.map.originY] as Pt);
  }

  private path(g: CanvasRenderingContext2D, pts: Pt[]): void {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]);
    g.closePath();
  }

  private drawHover(g: CanvasRenderingContext2D): void {
    if (!this.hover || this.preview) return;
    this.path(g, this.corners(this.hover[0], this.hover[1]));
    g.strokeStyle = 'rgba(255,248,230,0.95)';
    g.lineWidth = 1.5 / this.cam.zoom;
    g.stroke();
  }

  private drawPreview(g: CanvasRenderingContext2D): void {
    const p = this.preview;
    if (!p) return;
    if (p.halo) {
      g.fillStyle = 'rgba(255,214,60,0.28)';
      for (const [x, y] of p.halo) {
        this.path(g, this.corners(x, y));
        g.fill();
      }
    }
    for (const [x, y] of p.cells) {
      const ok = p.valid.has(this.world.idx(x, y));
      this.path(g, this.corners(x, y));
      g.fillStyle = ok ? p.color : 'rgba(200,40,30,0.35)';
      g.fill();
      g.strokeStyle = ok ? 'rgba(255,255,255,0.7)' : 'rgba(160,20,10,0.7)';
      g.lineWidth = 0.8 / this.cam.zoom;
      g.stroke();
    }
  }

  private drawSmoke(g: CanvasRenderingContext2D, time: number, visible: (x: number, y: number) => boolean): void {
    const t = time / 1000;
    for (const [i, sources] of this.map.smoke) {
      for (const [sx, sy] of sources) {
        if (!visible(sx, sy)) continue;
        const seed = hash2(i, sx, 3);
        for (let k = 0; k < 4; k++) {
          const ph = (t * 0.35 + k / 4 + seed) % 1;
          const r = 1.5 + ph * 4.5;
          g.globalAlpha = 0.55 * (1 - ph);
          g.fillStyle = PAL.smoke;
          g.beginPath();
          g.arc(sx + ph * 9, sy - ph * 22, r, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    g.globalAlpha = 1;
  }

  /** The services the city has unlocked, which are the ones whose lack is shown with a bubble (set by the game). */
  bubbleKinds: Unlocked = { health: false, crime: false, school: false };
  private bubbles: { at: number; items: { i: number; issues: Issue[] }[] } = { at: -1e9, items: [] };

  /** The buildings with something wrong, looked up again every half second: the fields they come from change slowly. */
  private bubbleItems(time: number): { i: number; issues: Issue[] }[] {
    if (time - this.bubbles.at < 500) return this.bubbles.items;
    const w = this.world;
    const items: { i: number; issues: Issue[] }[] = [];
    for (let i = 0; i < w.n * w.n; i++) {
      const issues = buildingIssues(w, i, this.bubbleKinds);
      if (issues.length) items.push({ i, issues });
    }
    // An airport or a harbour without light or street: the bubble goes over the middle of its first piece.
    for (const f of hubFacilities(w)) {
      const issues: Issue[] = !f.lit ? ['power'] : !f.street ? ['road'] : [];
      if (issues.length) items.push({ i: w.idx(Math.min(w.n - 1, f.pieces[0].x + 1), f.pieces[0].y), issues });
    }
    this.bubbles = { at: time, items };
    return items;
  }

  /**
   * A bubble over each building with a problem, in the manner of the city builders: a bolt for the dark, a
   * masked figure for crime, a red cross for the lack of a health post, a cloud for smoke. A building with several
   * shows them one after another. They blink gently, and from afar only the dark ones are drawn.
   */
  private drawBubbles(g: CanvasRenderingContext2D, time: number, visible: (x: number, y: number) => boolean): void {
    if ((time / 600) % 2 < 0.7) return;
    const w = this.world;
    const n = w.n;
    const far = this.cam.zoom < 0.6;
    for (const { i, issues } of this.bubbleItems(time)) {
      const issue = issues[Math.floor(time / 1800) % issues.length];
      if (far && issue !== 'power') continue;
      const x = i % n;
      const [vx, vy] = toView(x, (i - x) / n, this.map.rot, n);
      const [cx, cy] = this.map.toCache(vx + 0.5, vy + 0.5, w.minMax(x, (i - x) / n)[1]);
      if (!visible(cx, cy)) continue;
      drawBubble(g, issue, cx, cy - 18, w.anger[i]);
    }
  }

  /** Draws, within a small time budget, the overlay chunks in view that are missing or out of date. */
  private ensureLayer(area: Rect): void {
    const tick = ++this.layerTick;
    const visible = this.map.contentChunks(area);
    const fresh = (id: number) => this.layerChunks.get(id)?.gen === this.layerGen;
    const budget = new FrameBudget(LAYER_BUDGET_MS);
    for (const item of renderOrder(this.map.grid, visible, [], fresh, [this.cam.x, this.cam.y])) {
      if (!budget.allow(true)) break;
      const t0 = performance.now();
      this.renderLayerChunk(item.id, tick);
      budget.spent(performance.now() - t0);
    }
    this.layerMissing = visible.filter((id) => !fresh(id)).length;
    for (const id of visible) {
      const c = this.layerChunks.get(id);
      if (c) c.lastUsed = tick;
    }
    const live = [...this.layerChunks].map(([id, c]) => ({ id, lastUsed: c.lastUsed }));
    for (const id of pickEvictions(live, new Set(visible), MAX_LIVE_LAYER_CHUNKS)) {
      const c = this.layerChunks.get(id)!;
      c.canvas.width = 0;
      c.canvas.height = 0;
      this.layerChunks.delete(id);
    }
  }

  /** Paints the overlay of the cells that reach one chunk, in the same cell order as the whole map would. */
  private renderLayerChunk(id: number, tick: number): void {
    const r = paddedRect(this.map.grid, id);
    let c = this.layerChunks.get(id);
    if (!c) {
      const canvas = document.createElement('canvas');
      canvas.width = r.x1 - r.x0;
      canvas.height = r.y1 - r.y0;
      c = { canvas, gen: -1, rot: this.map.rot, lastUsed: tick };
      this.layerChunks.set(id, c);
    }
    c.gen = this.layerGen;
    c.rot = this.map.rot;
    c.lastUsed = tick;
    const g = c.canvas.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.canvas.width, c.canvas.height);
    g.translate(-r.x0, -r.y0);
    const w = this.world;
    const n = w.n;
    const [vx0, vy0, vx1, vy1] = this.map.cellRange(r.x0, r.y0, r.x1, r.y1);
    const [ax, ay] = fromView(vx0, vy0, this.map.rot, n);
    const [bx, by] = fromView(vx1, vy1, this.map.rot, n);
    for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) {
      for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) {
        const i = w.idx(x, y);
        const color = this.layerColor(i, x, y);
        if (!color) continue;
        this.path(g, this.corners(x, y));
        g.fillStyle = color;
        g.fill();
      }
    }
  }

  private layerColor(i: number, x: number, y: number): string | null {
    const w = this.world;
    const tile = w.tiles[i];
    switch (this.layer) {
      case 'power':
        // Empty ground shows only where the light reaches: that is where a new lot would be lit.
        if (tile === TILE.EMPTY) return w.powered[i] && !w.isWater(x, y) ? 'rgba(255,214,60,0.18)' : null;
        if (zoneOf(tile)) return w.powered[i] ? 'rgba(255,214,60,0.55)' : 'rgba(210,40,30,0.55)';
        return w.powered[i] ? 'rgba(255,214,60,0.3)' : 'rgba(120,120,120,0.3)';
      case 'traffic': {
        if (tile !== TILE.ROAD) return null;
        const t = w.traffic[i];
        return t > 100 ? 'rgba(215,40,30,0.8)' : t > 60 ? 'rgba(240,170,40,0.75)' : 'rgba(90,190,90,0.6)';
      }
      case 'pollution': {
        const p = w.pollution[i];
        return p > 2 ? `rgba(110,60,40,${Math.min(0.75, p / 110)})` : null;
      }
      case 'landValue': {
        if (w.isWater(x, y)) return null;
        const v = w.landValue[i] / 100;
        const r = Math.round(220 - 170 * v);
        const gg = Math.round(70 + 140 * v);
        return `rgba(${r},${gg},60,0.5)`;
      }
      case 'crime': {
        const c = w.crime[i];
        return c > 3 ? `rgba(150,30,60,${Math.min(0.75, c / 110)})` : null;
      }
      case 'edu':
      case 'health':
      case 'fireCover': {
        if (w.isWater(x, y)) return null;
        const v = w[this.layer][i];
        if (v === 0) return zoneOf(tile) && w.level[i] > 0 ? 'rgba(120,120,120,0.35)' : null;
        const rgbBase = this.layer === 'edu' ? '80,150,230' : this.layer === 'health' ? '60,180,110' : '230,90,40';
        return `rgba(${rgbBase},${(0.15 + (0.5 * v) / 100).toFixed(2)})`;
      }
      default:
        return null;
    }
  }
}

/**
 * The cell the camera looks at when a game starts: the middle of the provincial route when the
 * map has one, otherwise the middle of the land, away from the river.
 */
export function startCameraCell(world: World): [number, number] {
  const n = world.n;
  let sx = 0;
  let sy = 0;
  let count = 0;
  for (let i = 0; i < world.route.length; i++) {
    if (!world.route[i]) continue;
    sx += i % n;
    sy += Math.floor(i / n);
    count++;
  }
  if (count > 0) return [Math.floor(sx / count), Math.floor(sy / count)];
  let best: [number, number] = [Math.floor(n / 2), Math.floor(n / 2)];
  for (let x = Math.floor(n * 0.4); x >= 0; x--) {
    if (!world.isWater(x, Math.floor(n / 2))) {
      best = [x, Math.floor(n / 2)];
      break;
    }
  }
  return best;
}
