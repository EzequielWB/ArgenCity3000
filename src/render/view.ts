import { fromView, toView } from '../core/iso';
import { hash2 } from '../core/rng';
import { TILE, World, zoneOf } from '../world/world';
import { PAL } from './color';
import { cellScreenCorners, type Pt } from './geometry';
import { MapRenderer } from './mapRenderer';

export type Layer = 'none' | 'power' | 'pollution' | 'landValue';

export const ZOOMS = [0.25, 0.5, 1, 2, 3] as const;

export interface Preview {
  /** World cells covered by the drag. */
  cells: [number, number][];
  /** Indexes of the cells the action will actually change. */
  valid: Set<number>;
  color: string;
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

  private layerCanvas: HTMLCanvasElement;
  private layerDirty = true;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly map: MapRenderer,
    readonly world: World,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.layerCanvas = document.createElement('canvas');
    this.layerCanvas.width = map.canvas.width;
    this.layerCanvas.height = map.canvas.height;
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
    this.layerDirty = true;
  }

  invalidateLayer(): void {
    this.layerDirty = true;
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
    const c = this.map.canvas;
    this.cam.x = Math.max(0, Math.min(c.width, this.cam.x));
    this.cam.y = Math.max(0, Math.min(c.height, this.cam.y));
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

    const tx = Math.round((this.width / 2 - this.cam.x * z) * this.dpr) / this.dpr;
    const ty = Math.round((this.height / 2 - this.cam.y * z) * this.dpr) / this.dpr;
    g.setTransform(this.dpr * z, 0, 0, this.dpr * z, tx * this.dpr, ty * this.dpr);
    g.imageSmoothingEnabled = z < 1;
    g.drawImage(this.map.canvas, 0, 0);

    if (this.layer !== 'none') {
      if (this.layerDirty) this.renderLayer();
      g.drawImage(this.layerCanvas, 0, 0);
    }

    const [vx0, vy0] = this.screenToCache(0, 0);
    const [vx1, vy1] = this.screenToCache(this.width, this.height);
    const visible = (x: number, y: number, m = 40) => x > vx0 - m && x < vx1 + m && y > vy0 - m && y < vy1 + m;

    if (z >= 0.5) this.drawSmoke(g, time, visible);
    this.drawPowerWarnings(g, time, visible);
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

  private drawPowerWarnings(g: CanvasRenderingContext2D, time: number, visible: (x: number, y: number) => boolean): void {
    if ((time / 600) % 2 < 0.7) return;
    const w = this.world;
    const n = w.n;
    for (let i = 0; i < n * n; i++) {
      if (w.level[i] === 0 || w.powered[i] || !zoneOf(w.tiles[i])) continue;
      const x = i % n;
      const [vx, vy] = toView(x, (i - x) / n, this.map.rot, n);
      const [cx, cy] = this.map.toCache(vx + 0.5, vy + 0.5, w.minMax(x, (i - x) / n)[1]);
      if (!visible(cx, cy)) continue;
      const y = cy - 18;
      g.fillStyle = '#c8392f';
      g.beginPath();
      g.arc(cx, y, 4.5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ffd84a';
      g.beginPath();
      g.moveTo(cx + 0.8, y - 3.2);
      g.lineTo(cx - 1.8, y + 0.6);
      g.lineTo(cx - 0.1, y + 0.6);
      g.lineTo(cx - 0.8, y + 3.2);
      g.lineTo(cx + 1.8, y - 0.6);
      g.lineTo(cx + 0.1, y - 0.6);
      g.closePath();
      g.fill();
    }
  }

  private renderLayer(): void {
    this.layerDirty = false;
    const g = this.layerCanvas.getContext('2d')!;
    g.clearRect(0, 0, this.layerCanvas.width, this.layerCanvas.height);
    const w = this.world;
    const n = w.n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
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
        if (tile === TILE.EMPTY) return null;
        if (zoneOf(tile)) return w.powered[i] ? 'rgba(255,214,60,0.55)' : 'rgba(210,40,30,0.55)';
        return w.powered[i] ? 'rgba(255,214,60,0.3)' : 'rgba(120,120,120,0.3)';
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
      default:
        return null;
    }
  }
}
