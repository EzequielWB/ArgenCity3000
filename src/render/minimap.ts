import { fromView, type Rotation } from '../core/iso';
import { GROUND_TOP, MAX_HEIGHT, SEA_LEVEL, isWaterCell, rockLine, type Terrain } from '../world/terrain';
import { TILE, World } from '../world/world';
import { hexToRgb, PAL } from './color';

/** The streets, one colour per quality, so the minimap shows where the asphalt is new. */
const ROAD_TIER_COLORS: [number, number, number][] = [
  [85, 84, 90],
  [64, 63, 71],
  [52, 51, 59],
  [160, 124, 82],
];

const TILE_COLORS: Record<number, [number, number, number]> = {
  [TILE.ROAD]: ROAD_TIER_COLORS[0],
  [TILE.LINE]: [140, 110, 70],
  [TILE.PLANT]: [150, 50, 40],
  [TILE.PARK]: [120, 190, 80],
  [TILE.SCHOOL]: [245, 240, 230],
  [TILE.CLINIC]: [60, 160, 100],
  [TILE.POLICE]: [60, 90, 140],
  [TILE.FIREHOUSE]: [200, 50, 40],
  [TILE.FISHING]: [160, 110, 60],
  [TILE.PROMENADE]: [214, 205, 187],
  [TILE.PORT]: [224, 165, 38],
  [TILE.RESORT]: [226, 100, 80],
  [TILE.LIGHTHOUSE]: [245, 240, 230],
  [TILE.BUS]: [200, 140, 40],
};
/** The provincial route, brighter than a street so the strip reads on the overview. */
const ROUTE_COLOR: [number, number, number] = [244, 208, 64];
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
  const k = Math.min(1, (h - SEA_LEVEL) / (GROUND_TOP - SEA_LEVEL));
  const grass: [number, number, number] = [160 - 25 * k, 180 - 40 * k, 90 - 10 * k];
  const line = rockLine();
  if (h <= line) return grass;
  // The ranges read as stone, and the higher they go, the paler they get.
  const r = Math.min(1, (h - line) / Math.max(1, MAX_HEIGHT - line));
  return [grass[0] + (168 - grass[0]) * r, grass[1] + (164 - grass[1]) * r, grass[2] + (150 - grass[2]) * r];
}

/**
 * Paints a top-down picture of a terrain (used for the start screen preview), with the
 * cells marked in `roads` drawn as streets.
 */
export function paintTerrainPreview(canvas: HTMLCanvasElement, t: Terrain, roads?: Uint8Array): void {
  const n = t.n;
  const img = new ImageData(n, n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const [r, g, b] = roads?.[y * n + x] ? TILE_COLORS[TILE.ROAD] : terrainColor(t, x, y);
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
        if (t === TILE.ROAD && w.route[i]) c = ROUTE_COLOR;
        else if (t === TILE.ROAD) c = ROAD_TIER_COLORS[w.roadTier[i]];
        else if (TILE_COLORS[t]) c = TILE_COLORS[t];
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
