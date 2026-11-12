import { project, rotateDir, toView, type Rotation } from '../core/iso';
import { Rng } from '../core/rng';
import { TILE, World } from '../world/world';
import { surfaceHeights, type Pt } from './geometry';
import type { MapRenderer, PlacedSprite } from './mapRenderer';

/** Cars per street cell (0–3), from the buildings around it. Purely visual. */
export function computeTraffic(w: World, out: Uint8Array): void {
  const n = w.n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      if (w.tiles[i] !== TILE.ROAD) {
        out[i] = 0;
        continue;
      }
      let levels = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < n && ny < n) levels += w.level[ny * n + nx];
        }
      }
      out[i] = Math.min(3, Math.round(levels / 7));
    }
  }
}

export type CarKind = 'car' | 'taxi' | 'bus';

export interface Car {
  id: number;
  /** Street cell the car is leaving (world coordinates). */
  x: number;
  y: number;
  /** Unit step towards the street cell it is driving to. */
  dx: number;
  dy: number;
  /** Progress from the centre of (x, y) to the centre of the next cell, in [0, 1). */
  t: number;
  /** Cells per second. */
  speed: number;
  kind: CarKind;
  color: number;
  age: number;
  life: number;
}

const DIRS: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
const LANE = 0.17;
const FADE = 0.4;

/**
 * Cars driving along the street network. They go centre to centre between neighbouring
 * street cells and choose where to turn at each cell, so they move continuously.
 * Purely decorative: the simulation does not depend on them.
 */
export class Traffic {
  static readonly MAX_CARS = 260;

  cars: Car[] = [];
  target = 0;

  private density: Uint8Array;
  private spawnCells: number[] = [];
  private rng: Rng;
  private nextId = 1;

  constructor(
    readonly world: World,
    seed: number,
  ) {
    this.density = new Uint8Array(world.n * world.n);
    this.rng = new Rng(seed);
  }

  /** Recounts how busy each street is; call after edits and every month. */
  refresh(): void {
    computeTraffic(this.world, this.density);
    this.spawnCells = [];
    let total = 0;
    for (let i = 0; i < this.density.length; i++) {
      const d = this.density[i];
      if (!d) continue;
      total += d;
      for (let k = 0; k < d; k++) this.spawnCells.push(i);
    }
    this.target = Math.min(Traffic.MAX_CARS, total);
  }

  private isRoad(x: number, y: number): boolean {
    return this.world.inBounds(x, y) && this.world.tileAt(x, y) === TILE.ROAD;
  }

  update(dt: number): void {
    if (dt <= 0) return;
    this.cars = this.cars.filter((c) => this.isRoad(c.x, c.y) && this.isRoad(c.x + c.dx, c.y + c.dy) && c.age < c.life);
    for (const c of this.cars) {
      c.age += dt;
      c.t += c.speed * dt;
      while (c.t >= 1) {
        c.t -= 1;
        this.advance(c);
      }
    }
    while (this.cars.length > this.target) this.cars.splice(this.rng.int(this.cars.length), 1);
    for (let k = 0; k < 6 && this.cars.length < this.target; k++) this.spawn();
  }

  /** The car reached the centre of its next cell: pick where to go from there. */
  private advance(c: Car): void {
    c.x += c.dx;
    c.y += c.dy;
    const options = DIRS.filter(([dx, dy]) => !(dx === -c.dx && dy === -c.dy) && this.isRoad(c.x + dx, c.y + dy));
    if (options.length === 0) {
      c.dx = -c.dx;
      c.dy = -c.dy;
      return;
    }
    const straight = options.find(([dx, dy]) => dx === c.dx && dy === c.dy);
    const [dx, dy] = straight && this.rng.chance(0.65) ? straight : this.rng.pick(options);
    c.dx = dx;
    c.dy = dy;
  }

  private spawn(): void {
    if (this.spawnCells.length === 0) return;
    const i = this.rng.pick(this.spawnCells);
    const n = this.world.n;
    const x = i % n;
    const y = (i - x) / n;
    const options = DIRS.filter(([dx, dy]) => this.isRoad(x + dx, y + dy));
    if (options.length === 0) return;
    const [dx, dy] = this.rng.pick(options);
    const r = this.rng.next();
    const kind: CarKind = r > 0.92 ? 'bus' : r > 0.74 ? 'taxi' : 'car';
    this.cars.push({
      id: this.nextId++,
      x,
      y,
      dx,
      dy,
      t: this.rng.next() * 0.9,
      speed: kind === 'bus' ? 0.9 : 1.2 + this.rng.next() * 0.8,
      kind,
      color: this.rng.int(CAR_COLORS.length),
      age: 0,
      life: 10 + this.rng.next() * 20,
    });
  }

  /** Continuous world position (cell units, cell centres at +0.5), driving on the right. */
  position(c: Car): Pt {
    return [c.x + 0.5 + c.dx * c.t - c.dy * LANE, c.y + 0.5 + c.dy * c.t + c.dx * LANE];
  }

  /** Fade in when appearing and out before vanishing, so cars never pop. */
  alpha(c: Car): number {
    return Math.max(0, Math.min(1, c.age / FADE, (c.life - c.age) / FADE));
  }
}

const CAR_COLORS = ['#c8392f', '#f4f0e6', '#2f63a6', '#3c8d4a', '#7d7f86', '#e0a526', '#6b3fa0'];

interface DrawItem {
  key: number;
  car?: Car;
  obj?: PlacedSprite;
}

/**
 * Draws the visible cars in painter's order: each car goes right after its own cell, and
 * every object drawn later that overlaps it (houses, trees, plants in front) is drawn again
 * on top, so cars pass behind buildings instead of over them.
 */
export function drawTraffic(g: CanvasRenderingContext2D, traffic: Traffic, map: MapRenderer, visible: [number, number, number, number]): void {
  const w = traffic.world;
  const n = w.n;
  const rot = map.rot;
  const [x0, y0, x1, y1] = visible;
  const items: DrawItem[] = [];
  const occluders = new Set<number>();
  const screen = new Map<number, { sx: number; sy: number; sdx: number; sdy: number }>();

  for (const c of traffic.cars) {
    const [px, py] = traffic.position(c);
    const [vx, vy] = toView(px, py, rot, n + 1);
    const cvx = Math.min(n - 1, Math.max(0, Math.floor(vx)));
    const cvy = Math.min(n - 1, Math.max(0, Math.floor(vy)));
    const h = heightAt(w, rot, cvx, cvy, vx - cvx, vy - cvy);
    const [ox, oy] = project(vx, vy, h);
    const sx = ox + map.originX;
    const sy = oy + map.originY;
    if (sx < x0 - 10 || sx > x1 + 10 || sy < y0 - 10 || sy > y1 + 10) continue;
    const [rdx, rdy] = rotateDir(c.dx, c.dy, rot);
    screen.set(c.id, { sx, sy, sdx: rdx - rdy, sdy: (rdx + rdy) / 2 });
    const key = cvy * n + cvx;
    items.push({ key: key + 0.5, car: c });
    // Objects drawn after this cell that may cover the car.
    for (let oy2 = cvy; oy2 <= Math.min(n - 1, cvy + 6); oy2++) {
      for (let ox2 = Math.max(0, cvx - 1); ox2 <= Math.min(n - 1, cvx + 6); ox2++) {
        const k = oy2 * n + ox2;
        if (k <= key || occluders.has(k)) continue;
        const obj = map.objectAt(ox2, oy2);
        if (!obj) continue;
        const left = obj.ax - obj.sprite.ax;
        const top = obj.ay - obj.sprite.ay;
        if (sx + 4 < left || sx - 4 > left + obj.sprite.canvas.width || sy + 4 < top || sy - 6 > top + obj.sprite.canvas.height) continue;
        occluders.add(k);
        items.push({ key: k, obj });
      }
    }
  }
  items.sort((a, b) => a.key - b.key);
  for (const it of items) {
    if (it.obj) {
      g.drawImage(it.obj.sprite.canvas, Math.round(it.obj.ax - it.obj.sprite.ax), Math.round(it.obj.ay - it.obj.sprite.ay));
    } else if (it.car) {
      drawCar(g, it.car, screen.get(it.car.id)!, traffic.alpha(it.car));
    }
  }
}

function drawCar(g: CanvasRenderingContext2D, c: Car, s: { sx: number; sy: number; sdx: number; sdy: number }, alpha: number): void {
  const len = c.kind === 'bus' ? 3.6 : 2.1;
  const dx = s.sdx * len;
  const dy = s.sdy * len;
  g.globalAlpha = alpha;
  g.fillStyle = c.kind === 'bus' ? '#e0a526' : c.kind === 'taxi' ? '#1f1611' : CAR_COLORS[c.color];
  g.beginPath();
  g.moveTo(s.sx - dx, s.sy - dy - 1.8);
  g.lineTo(s.sx + dx, s.sy + dy - 1.8);
  g.lineTo(s.sx + dx, s.sy + dy + 0.2);
  g.lineTo(s.sx - dx, s.sy - dy + 0.2);
  g.closePath();
  g.fill();
  g.fillStyle = c.kind === 'taxi' ? '#f2c94c' : c.kind === 'bus' ? '#c8392f' : 'rgba(255,255,255,0.7)';
  g.fillRect(s.sx - 0.7, s.sy - 2.6, 1.4, 0.9);
  g.globalAlpha = 1;
}

/** Surface height inside a view cell at fractional (u, v), as drawn by the map. */
function heightAt(w: World, rot: Rotation, vx: number, vy: number, u: number, v: number): number {
  const [t, r, b, l] = surfaceHeights(w, vx, vy, rot);
  return t * (1 - u) * (1 - v) + r * u * (1 - v) + b * u * v + l * (1 - u) * v;
}
