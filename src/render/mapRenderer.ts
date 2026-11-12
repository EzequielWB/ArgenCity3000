import { PLANT_SIZE } from '../config';
import { HEIGHT_STEP, TILE_H, TILE_W, fromView, project, toView, unproject, type Rotation } from '../core/iso';
import { hash2 } from '../core/rng';
import { MAX_HEIGHT, SEA_LEVEL } from '../world/terrain';
import { TILE, World, serviceOf, zoneOf } from '../world/world';
import { PAL, mix, rgb, hexToRgb } from './color';
import { isPlatform, surfaceHeights, viewCornerHeights, plantHeight, type Pt } from './geometry';
import {
  abandonedBuildingSprite,
  buildingSprite,
  burningBuildingSprite,
  parkSpriteFor,
  plantSprite,
  poleSpriteFor,
  serviceSprite,
  treeSpriteFor,
  type Sprite,
} from './sprites';

/** Room above the map for tall buildings and below it for the map's side walls. */
const PAD_TOP = MAX_HEIGHT * HEIGHT_STEP + 120;
const PAD_BOTTOM = MAX_HEIGHT * HEIGHT_STEP + 48;
const PAD_SIDE = 24;
/** Tallest thing that can stick up above a cell's top corner. */
const SPRITE_REACH = 112;
const BASE_HEIGHT = 0;

export interface PlacedSprite {
  sprite: Sprite;
  /** Cache coordinates where the sprite's anchor goes. */
  ax: number;
  ay: number;
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Renders the whole map into one big offscreen canvas (one rotation at a time) and keeps it
 * up to date by redrawing only the regions around changed cells, in painter's order.
 */
export class MapRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly originX: number;
  readonly originY: number;
  rot: Rotation = 0;
  /** Smoke sources in cache coordinates, by cell index. */
  readonly smoke = new Map<number, Pt[]>();

  private g: CanvasRenderingContext2D;

  constructor(readonly world: World) {
    const n = world.n;
    this.canvas = document.createElement('canvas');
    this.canvas.width = n * TILE_W + PAD_SIDE * 2;
    this.canvas.height = n * TILE_H + PAD_TOP + PAD_BOTTOM;
    this.originX = (n * TILE_W) / 2 + PAD_SIDE;
    this.originY = PAD_TOP;
    this.g = this.canvas.getContext('2d')!;
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

  redrawAll(): void {
    const g = this.g;
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.smoke.clear();
    const n = this.world.n;
    for (let vy = 0; vy < n; vy++) for (let vx = 0; vx < n; vx++) this.drawCell(vx, vy);
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
    const rects: Rect[] = [];
    for (const i of cells) {
      const x = i % n;
      const [vx, vy] = toView(x, (i - x) / n, this.rot, n);
      addRect(rects, this.cellBounds(vx, vy));
    }
    for (const r of rects) this.redrawRect(r);
  }

  private cellBounds(vx: number, vy: number): Rect {
    const [tx] = this.toCache(vx, vy, 0);
    const [, topY] = this.toCache(vx, vy, MAX_HEIGHT);
    const [, botY] = this.toCache(vx + 1, vy + 1, BASE_HEIGHT);
    const wide = TILE_W * (PLANT_SIZE + 0.2);
    return { x0: tx - wide, x1: tx + wide, y0: topY - SPRITE_REACH, y1: botY + 2 };
  }

  private redrawRect(r: Rect): void {
    const g = this.g;
    const n = this.world.n;
    const x0 = Math.floor(r.x0);
    const y0 = Math.floor(r.y0);
    const x1 = Math.ceil(r.x1);
    const y1 = Math.ceil(r.y1);
    g.save();
    g.beginPath();
    g.rect(x0, y0, x1 - x0, y1 - y0);
    g.clip();
    g.clearRect(x0, y0, x1 - x0, y1 - y0);
    // Every cell whose drawing could reach the rectangle.
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
    const vx0 = Math.max(0, Math.floor(minX) - 2);
    const vy0 = Math.max(0, Math.floor(minY) - 2);
    const vx1 = Math.min(n - 1, Math.ceil(maxX) + 2);
    const vy1 = Math.min(n - 1, Math.ceil(maxY) + 2);
    for (let vy = vy0; vy <= vy1; vy++) {
      for (let vx = vx0; vx <= vx1; vx++) {
        const b = this.cellBounds(vx, vy);
        if (b.x1 < x0 || b.x0 > x1 || b.y1 < y0 || b.y0 > y1) continue;
        this.drawCell(vx, vy);
      }
    }
    g.restore();
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
      if (tile === TILE.ROAD) this.drawBridge(vx, vy, pts);
    } else if (hs[0] === hs[1] && hs[1] === hs[2] && hs[2] === hs[3] && isPlatform(w, i)) {
      this.drawPlatform(vx, vy, hs[0], tile);
    } else {
      this.drawGround(vx, vy, x, y);
      if (tile === TILE.ROAD) this.drawRoad(vx, vy, pts);
      else if (tile === TILE.PARK) this.drawPark(pts);
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
      return { sprite: plantSprite(), ax, ay };
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
    if (tile === TILE.PARK) return { sprite: parkSpriteFor(w.variant[i]), ax, ay };
    if (tile === TILE.LINE) return { sprite: poleSpriteFor(), ax, ay };
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
      const t = (hmin - SEA_LEVEL - 1) / Math.max(1, MAX_HEIGHT - SEA_LEVEL - 1);
      base = t < 0.5 ? mix(PAL.grassLow, PAL.grassMid, t * 2) : mix(PAL.grassMid, PAL.grassHigh, (t - 0.5) * 2);
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

  private drawPark(pts: Pt[]): void {
    this.poly(pts, PAL.park);
    const strip = (u0: number, v0: number, u1: number, v1: number) =>
      this.poly([bilinear(pts, u0, v0), bilinear(pts, u1, v0), bilinear(pts, u1, v1), bilinear(pts, u0, v1)], PAL.path);
    strip(0.44, 0, 0.56, 1);
    strip(0, 0.44, 1, 0.56);
  }

  private isRoadView(vx: number, vy: number): boolean {
    const n = this.world.n;
    if (vx < 0 || vy < 0 || vx >= n || vy >= n) return false;
    const [x, y] = fromView(vx, vy, this.rot, n);
    return this.world.tileAt(x, y) === TILE.ROAD;
  }

  private drawRoad(vx: number, vy: number, pts: Pt[]): void {
    this.poly(pts, PAL.sidewalk);
    this.drawAsphalt(vx, vy, pts);
  }

  private drawAsphalt(vx: number, vy: number, pts: Pt[]): void {
    const up = this.isRoadView(vx, vy - 1);
    const right = this.isRoadView(vx + 1, vy);
    const down = this.isRoadView(vx, vy + 1);
    const left = this.isRoadView(vx - 1, vy);
    const a = 0.18;
    const b = 0.82;
    const sub = (u0: number, v0: number, u1: number, v1: number) =>
      this.poly([bilinear(pts, u0, v0), bilinear(pts, u1, v0), bilinear(pts, u1, v1), bilinear(pts, u0, v1)], PAL.asphalt);
    sub(a, a, b, b);
    if (up) sub(a, 0, b, a);
    if (down) sub(a, b, b, 1);
    if (left) sub(0, a, a, b);
    if (right) sub(b, a, 1, b);
    // Dashed centre lines towards each connection.
    const g = this.g;
    g.strokeStyle = PAL.marking;
    g.lineWidth = 0.8;
    g.setLineDash([2, 2]);
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
  }

  private drawBridge(vx: number, vy: number, pts: Pt[]): void {
    const g = this.g;
    // Pillars down to the water.
    const deck = SEA_LEVEL + 0.75;
    for (const [u, v] of [
      [0.5, 0.5],
    ]) {
      const [px, py] = this.toCache(vx + u, vy + v, deck);
      g.fillStyle = '#8c857a';
      g.fillRect(px - 1.5, py, 3, (deck - SEA_LEVEL) * HEIGHT_STEP);
    }
    this.poly(pts, '#a7a093');
    this.drawAsphalt(vx, vy, pts);
    g.strokeStyle = '#6f685e';
    g.lineWidth = 1;
    for (const [a, b] of [
      [pts[3], pts[2]],
      [pts[2], pts[1]],
    ]) {
      g.beginPath();
      g.moveTo(a[0], a[1] - 1);
      g.lineTo(b[0], b[1] - 1);
      g.stroke();
    }
  }

  private drawWires(vx: number, vy: number, pole: PlacedSprite): void {
    const s = pole.sprite;
    const top: Pt = [pole.ax + s.attach![0], pole.ay + s.attach![1]];
    const g = this.g;
    g.strokeStyle = PAL.wire;
    g.lineWidth = 0.6;
    const n = this.world.n;
    for (const [nx, ny] of [
      [vx - 1, vy],
      [vx, vy - 1],
    ]) {
      if (nx < 0 || ny < 0) continue;
      const [wx, wy] = fromView(nx, ny, this.rot, n);
      if (this.world.tileAt(wx, wy) !== TILE.LINE) continue;
      const nh = avg(surfaceHeights(this.world, nx, ny, this.rot));
      const [bx, by] = this.toCache(nx, ny, nh);
      const other: Pt = [bx + s.attach![0], by + s.attach![1]];
      for (const off of [-4, 4]) {
        g.beginPath();
        g.moveTo(top[0] + off, top[1]);
        g.quadraticCurveTo((top[0] + other[0]) / 2 + off, (top[1] + other[1]) / 2 + 3, other[0] + off, other[1]);
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
  let r: number;
  let g: number;
  let b: number;
  if (color.startsWith('#')) [r, g, b] = hexToRgb(color);
  else [r, g, b] = color.slice(4, -1).split(',').map(Number) as [number, number, number];
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
