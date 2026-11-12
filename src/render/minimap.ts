import { fromView, type Rotation } from '../core/iso';
import { MAX_HEIGHT, SEA_LEVEL, isWaterCell, type Terrain } from '../world/terrain';
import { TILE, World } from '../world/world';
import { hexToRgb, PAL } from './color';

const TILE_COLORS: Record<number, [number, number, number]> = {
  [TILE.ROAD]: [85, 84, 90],
  [TILE.LINE]: [140, 110, 70],
  [TILE.PLANT]: [150, 50, 40],
  [TILE.PARK]: [120, 190, 80],
};
const ZONE_EMPTY: Record<number, [number, number, number]> = {
  [TILE.R]: [150, 200, 130],
  [TILE.C]: [140, 190, 220],
  [TILE.I]: [225, 195, 110],
};
const ZONE_BUILT: Record<number, [number, number, number]> = {
  [TILE.R]: [60, 150, 60],
  [TILE.C]: [40, 110, 190],
  [TILE.I]: [190, 140, 30],
};

function terrainColor(t: Terrain, x: number, y: number): [number, number, number] {
  if (isWaterCell(t, x, y)) return hexToRgb(PAL.water);
  if (t.trees[y * t.n + x]) return [70, 115, 55];
  const s = t.n + 1;
  const h = t.corners[y * s + x];
  if (h <= SEA_LEVEL) return hexToRgb(PAL.sand);
  const k = (h - SEA_LEVEL) / (MAX_HEIGHT - SEA_LEVEL);
  return [160 - 25 * k, 180 - 40 * k, 90 - 10 * k];
}

/** Paints a top-down picture of a terrain (used for the start screen preview). */
export function paintTerrainPreview(canvas: HTMLCanvasElement, t: Terrain): void {
  const n = t.n;
  const img = new ImageData(n, n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const [r, g, b] = terrainColor(t, x, y);
      const o = (y * n + x) * 4;
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = 255;
    }
  }
  const tmp = document.createElement('canvas');
  tmp.width = n;
  tmp.height = n;
  tmp.getContext('2d')!.putImageData(img, 0, 0);
  const g = canvas.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.drawImage(tmp, 0, 0, canvas.width, canvas.height);
}

/** Diamond-shaped overview of the city in the current rotation. */
export class Minimap {
  private img: ImageData;
  private tmp: HTMLCanvasElement;
  /** Pixels per cell along each diamond axis. */
  readonly scale: number;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly world: World,
  ) {
    const n = world.n;
    this.img = new ImageData(n, n);
    this.tmp = document.createElement('canvas');
    this.tmp.width = n;
    this.tmp.height = n;
    this.scale = canvas.width / (2 * n);
  }

  draw(rot: Rotation, viewport: [number, number][] | null): void {
    const w = this.world;
    const n = w.n;
    const d = this.img.data;
    for (let vy = 0; vy < n; vy++) {
      for (let vx = 0; vx < n; vx++) {
        const [x, y] = fromView(vx, vy, rot, n);
        const i = w.idx(x, y);
        const t = w.tiles[i];
        let c: [number, number, number];
        if (TILE_COLORS[t]) c = TILE_COLORS[t];
        else if (ZONE_BUILT[t]) c = w.abandoned[i] ? [95, 85, 75] : w.level[i] > 0 ? ZONE_BUILT[t] : ZONE_EMPTY[t];
        else c = terrainColor(w.terrain, x, y);
        const o = (vy * n + vx) * 4;
        d[o] = c[0];
        d[o + 1] = c[1];
        d[o + 2] = c[2];
        d[o + 3] = 255;
      }
    }
    this.tmp.getContext('2d')!.putImageData(this.img, 0, 0);
    const g = this.canvas.getContext('2d')!;
    const s = this.scale;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.imageSmoothingEnabled = false;
    // vx → (s, s/2), vy → (-s, s/2): the same diamond as the main view.
    g.setTransform(s, s / 2, -s, s / 2, this.canvas.width / 2, 2);
    g.drawImage(this.tmp, 0, 0);
    if (viewport) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.strokeStyle = '#fff4d6';
      g.lineWidth = 1.5;
      g.beginPath();
      viewport.forEach(([vx, vy], k) => {
        const [px, py] = this.viewToPixel(vx, vy);
        if (k === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      });
      g.closePath();
      g.stroke();
    }
  }

  viewToPixel(vx: number, vy: number): [number, number] {
    const s = this.scale;
    return [this.canvas.width / 2 + (vx - vy) * s, 2 + ((vx + vy) * s) / 2];
  }

  /** Minimap pixel → world cell, or null outside the map. */
  pixelToWorld(px: number, py: number, rot: Rotation): [number, number] | null {
    const s = this.scale;
    const a = (px - this.canvas.width / 2) / s;
    const b = ((py - 2) * 2) / s;
    const vx = Math.floor((a + b) / 2);
    const vy = Math.floor((b - a) / 2);
    const n = this.world.n;
    if (vx < 0 || vy < 0 || vx >= n || vy >= n) return null;
    return fromView(vx, vy, rot, n);
  }
}
