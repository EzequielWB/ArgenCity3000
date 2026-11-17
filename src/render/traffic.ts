import { BUS, BUS_COLORS, CAR_COLORS, ROAD_REACH } from '../config';
import { project, rotateDir, toView, type Rotation } from '../core/iso';
import { Rng } from '../core/rng';
import { busStations, streetNear } from '../world/transport';
import { TILE, World } from '../world/world';
import { surfaceHeights, type Pt } from './geometry';
import type { MapRenderer, PlacedSprite } from './mapRenderer';
import { pixelArt } from './artSwitch';
import { carPixelSprite, headingOf, type Heading } from './vehicleArt';

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
  /** An index into `CAR_COLORS`, or into `BUS_COLORS` for the bus of a line. */
  color: number;
  age: number;
  life: number;
  /** For the bus of a line: the cell of its depot, which is as far as the bus goes (`BUS.radius`). */
  depot?: number;
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
  /** Buses each line keeps on the street: the budget for transport sets it (see `transitBuses`). */
  busesPerLine: number = BUS.buses;

  /** The depots whose buses are on the street. */
  private depots: { i: number; x: number; y: number; color: number }[] = [];
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
    this.depots = busStations(this.world).filter((s) => streetNear(this.world, s.x, s.y));
    this.syncBuses();
    // On a map with a provincial route the traffic comes in from it; the density only says how much.
    const w = this.world;
    const entrances: number[] = [];
    for (let i = 0; i < w.route.length; i++) if (w.route[i] && w.tiles[i] === TILE.ROAD) entrances.push(i);
    if (entrances.length > 0) this.spawnCells = entrances;
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
    // The buses of the lines are not part of the traffic's budget of cars: they stay as long as their depot does.
    if (this.cars.filter((c) => c.depot !== undefined).length !== this.depots.length * this.busesPerLine) this.syncBuses();
    let regular = this.cars.filter((c) => c.depot === undefined);
    while (regular.length > this.target) {
      const gone = regular[this.rng.int(regular.length)];
      this.cars.splice(this.cars.indexOf(gone), 1);
      regular = regular.filter((c) => c !== gone);
    }
    for (let k = 0; k < 6 && regular.length < this.target; k++) {
      this.spawn();
      regular = this.cars.filter((c) => c.depot === undefined);
    }
  }

  /** Gives every depot its buses, on the street nearest to it, and drops those of depots that are gone. */
  private syncBuses(): void {
    this.cars = this.cars.filter((c) => c.depot === undefined || this.depots.some((d) => d.i === c.depot && d.color === c.color));
    for (const d of this.depots) {
      // A cut in the budget takes buses off the street: the extra ones of the line leave.
      let own = this.cars.filter((c) => c.depot === d.i);
      while (own.length > this.busesPerLine) this.cars.splice(this.cars.indexOf(own.pop()!), 1);
      own = this.cars.filter((c) => c.depot === d.i);
      let have = own.length;
      const start = this.nearestStreet(d.x, d.y);
      if (start === null) continue;
      while (have < this.busesPerLine) {
        const options = DIRS.filter(([dx, dy]) => this.isRoad(start[0] + dx, start[1] + dy));
        if (options.length === 0) break;
        const [dx, dy] = this.rng.pick(options);
        this.cars.push({ id: this.nextId++, x: start[0], y: start[1], dx, dy, t: this.rng.next() * 0.9, speed: 0.9, kind: 'bus', color: d.color, age: 1, life: Infinity, depot: d.i });
        have++;
      }
    }
  }

  /** The street cell nearest to a depot, within ROAD_REACH, or null. */
  private nearestStreet(x: number, y: number): [number, number] | null {
    let best: [number, number] | null = null;
    let bestDist = Infinity;
    for (let dy = -ROAD_REACH; dy <= ROAD_REACH; dy++) {
      for (let dx = -ROAD_REACH; dx <= ROAD_REACH; dx++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d > ROAD_REACH || d >= bestDist || !this.isRoad(x + dx, y + dy)) continue;
        best = [x + dx, y + dy];
        bestDist = d;
      }
    }
    return best;
  }

  /** The car reached the centre of its next cell: pick where to go from there. */
  private advance(c: Car): void {
    c.x += c.dx;
    c.y += c.dy;
    const depot = c.depot === undefined ? null : this.depots.find((d) => d.i === c.depot);
    const inArea = (x: number, y: number) => !depot || Math.abs(x - depot.x) + Math.abs(y - depot.y) <= BUS.radius;
    const options = DIRS.filter(([dx, dy]) => !(dx === -c.dx && dy === -c.dy) && this.isRoad(c.x + dx, c.y + dy) && inArea(c.x + dx, c.y + dy));
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
    const kind: CarKind = r > 0.8 ? 'taxi' : 'car';
    this.cars.push({
      id: this.nextId++,
      x,
      y,
      dx,
      dy,
      t: this.rng.next() * 0.9,
      speed: 1.2 + this.rng.next() * 0.8,
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


/** Where a car is: its view cell (for the drawing order) and its position on the screen. */
export interface CarSpot {
  id: number;
  vx: number;
  vy: number;
  sx: number;
  sy: number;
}

export interface ClipBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Pixels around a car's position that its drawing can touch: the box objects are redrawn into. */
export const CAR_BOX = { side: 6, up: 6, down: 4 };

/**
 * How far in front of a car (in view cells) something can still cover it: the tallest sprite
 * is about 112 px, which is 14 cells of the diagonal; and how far to each side of its column.
 */
const FRONT_REACH = 15;
const FRONT_SIDE = 3;

export interface OverdrawOp<T extends CarSpot = CarSpot> {
  car: T;
  /** The only area the car and the objects in front of it can affect. */
  clip: ClipBox;
  /** Objects drawn after the car's cell that overlap its box, in drawing order. */
  objects: PlacedSprite[];
}

/**
 * For each car, in drawing order, the objects that stand in front of it (drawn after its cell)
 * and overlap it. Whatever they cover is taken off the car, inside the car's box only:
 * painting those sprites over the map again would also paint over the neighbours in front of
 * them, and buildings would flicker on top of each other wherever a car goes by.
 */
export function planOverdraw<T extends CarSpot>(cars: readonly T[], map: Pick<MapRenderer, 'objectAt'>, n: number): OverdrawOp<T>[] {
  const cache = new Map<number, PlacedSprite | null>();
  const objectAt = (vx: number, vy: number): PlacedSprite | null => {
    const k = vy * n + vx;
    let o = cache.get(k);
    if (o === undefined) {
      o = map.objectAt(vx, vy);
      cache.set(k, o);
    }
    return o;
  };
  const ops: OverdrawOp<T>[] = [];
  for (const car of cars) {
    const clip: ClipBox = { x0: car.sx - CAR_BOX.side, x1: car.sx + CAR_BOX.side, y0: car.sy - CAR_BOX.up, y1: car.sy + CAR_BOX.down };
    const key = car.vy * n + car.vx;
    const found: { key: number; obj: PlacedSprite }[] = [];
    // Cells t steps down the diagonal and e columns off it: dx + dy = t, dx - dy = e.
    for (let t = 1; t <= FRONT_REACH; t++) {
      for (let e = -FRONT_SIDE; e <= FRONT_SIDE; e++) {
        if ((t + e) % 2 !== 0) continue;
        const dx = (t + e) / 2;
        const dy = (t - e) / 2;
        const vx = car.vx + dx;
        const vy = car.vy + dy;
        if (vx < 0 || vy < 0 || vx >= n || vy >= n) continue;
        const k = vy * n + vx;
        if (k <= key) continue;
        const obj = objectAt(vx, vy);
        if (!obj) continue;
        const left = obj.ax - obj.sprite.ax;
        const top = obj.ay - obj.sprite.ay;
        if (left + obj.sprite.canvas.width <= clip.x0 || left >= clip.x1 || top + obj.sprite.canvas.height <= clip.y0 || top >= clip.y1) continue;
        found.push({ key: k, obj });
      }
    }
    found.sort((a, b) => a.key - b.key);
    ops.push({ car, clip, objects: found.map((f) => f.obj) });
  }
  return ops.sort((a, b) => a.car.vy * n + a.car.vx - (b.car.vy * n + b.car.vx));
}

/**
 * Draws the visible cars so they pass behind buildings instead of over them: each car loses
 * the pixels that the objects in front of it cover (see `planOverdraw`).
 */
export function drawTraffic(g: CanvasRenderingContext2D, traffic: Traffic, map: MapRenderer, visible: [number, number, number, number]): void {
  const w = traffic.world;
  const n = w.n;
  const rot = map.rot;
  const [x0, y0, x1, y1] = visible;
  const spots: (CarSpot & { ref: Car; sdx: number; sdy: number; dir: Heading })[] = [];

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
    spots.push({ id: c.id, vx: cvx, vy: cvy, sx, sy, ref: c, sdx: rdx - rdy, sdy: (rdx + rdy) / 2, dir: headingOf(rdx, rdy) });
  }

  const ops = planOverdraw(spots, map, n);
  if (ops.length === 0) return;

  // All the cars go on one layer the size of the screen, with the map's own transform (zoom,
  // pan), so each looks exactly as if it were drawn straight on the map. Each car is drawn and
  // then loses the pixels that the objects in front of it cover. The layer is pasted once at
  // the end, so the map itself is never painted over and the canvas is not switched per car.
  const m = g.getTransform();
  const lg = layerContext(g.canvas.width, g.canvas.height);
  lg.setTransform(1, 0, 0, 1, 0, 0);
  lg.clearRect(0, 0, g.canvas.width, g.canvas.height);
  lg.imageSmoothingEnabled = g.imageSmoothingEnabled;
  lg.setTransform(m);
  for (const op of ops) {
    drawCar(lg, op.car.ref, op.car, traffic.alpha(op.car.ref));
    if (op.objects.length === 0) continue;
    lg.globalCompositeOperation = 'destination-out';
    // Only the part of each sprite inside the car's box matters: copy just that (the sprites
    // sit on whole pixels, so source and destination match one to one).
    const cx0 = Math.floor(op.clip.x0);
    const cy0 = Math.floor(op.clip.y0);
    const cx1 = Math.ceil(op.clip.x1);
    const cy1 = Math.ceil(op.clip.y1);
    for (const o of op.objects) {
      const left = Math.round(o.ax - o.sprite.ax);
      const top = Math.round(o.ay - o.sprite.ay);
      const ix0 = Math.max(left, cx0);
      const iy0 = Math.max(top, cy0);
      const ix1 = Math.min(left + o.sprite.canvas.width, cx1);
      const iy1 = Math.min(top + o.sprite.canvas.height, cy1);
      if (ix1 <= ix0 || iy1 <= iy0) continue;
      lg.drawImage(o.sprite.canvas, ix0 - left, iy0 - top, ix1 - ix0, iy1 - iy0, ix0, iy0, ix1 - ix0, iy1 - iy0);
    }
    lg.globalCompositeOperation = 'source-over';
  }
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(layer!, 0, 0);
  g.restore();
}

let layer: HTMLCanvasElement | null = null;
let layerCtx: CanvasRenderingContext2D | null = null;

/** The cars' layer: a canvas of exactly the size of the screen canvas. */
function layerContext(w: number, h: number): CanvasRenderingContext2D {
  if (!layer || !layerCtx) {
    layer = document.createElement('canvas');
    layerCtx = layer.getContext('2d')!;
  }
  if (layer.width !== w) layer.width = w;
  if (layer.height !== h) layer.height = h;
  return layerCtx;
}

function drawCar(g: CanvasRenderingContext2D, c: Car, s: { sx: number; sy: number; sdx: number; sdy: number; dir: Heading }, alpha: number): void {
  if (pixelArt('vehiculos')) {
    // The pixel sprite, anchored on the ground point and snapped to whole pixels so it does not blur.
    const sprite = carPixelSprite(c.kind, c.color, s.dir);
    g.globalAlpha = alpha;
    g.drawImage(sprite.canvas, Math.round(s.sx - sprite.ax), Math.round(s.sy - sprite.ay));
    g.globalAlpha = 1;
    return;
  }
  // The bus of a line is longer and taller than a car, so it reads at a glance, with a row of windows.
  const bus = c.kind === 'bus';
  const len = bus ? 5.4 : 2.1;
  const top = bus ? 3.4 : 1.8;
  const dx = s.sdx * len;
  const dy = s.sdy * len;
  g.globalAlpha = alpha;
  g.fillStyle = bus ? BUS_COLORS[c.color].hex : c.kind === 'taxi' ? '#1f1611' : CAR_COLORS[c.color];
  g.beginPath();
  g.moveTo(s.sx - dx, s.sy - dy - top);
  g.lineTo(s.sx + dx, s.sy + dy - top);
  g.lineTo(s.sx + dx, s.sy + dy + 0.2);
  g.lineTo(s.sx - dx, s.sy - dy + 0.2);
  g.closePath();
  g.fill();
  if (bus) {
    g.fillStyle = 'rgba(25,35,45,0.65)';
    g.beginPath();
    g.moveTo(s.sx - dx * 0.85, s.sy - dy * 0.85 - 2.6);
    g.lineTo(s.sx + dx * 0.85, s.sy + dy * 0.85 - 2.6);
    g.lineTo(s.sx + dx * 0.85, s.sy + dy * 0.85 - 1.4);
    g.lineTo(s.sx - dx * 0.85, s.sy - dy * 0.85 - 1.4);
    g.closePath();
    g.fill();
  } else {
    g.fillStyle = c.kind === 'taxi' ? '#f2c94c' : 'rgba(255,255,255,0.7)';
    g.fillRect(s.sx - 0.7, s.sy - 2.6, 1.4, 0.9);
  }
  g.globalAlpha = 1;
}

/** Surface height inside a view cell at fractional (u, v), as drawn by the map. */
export function heightAt(w: World, rot: Rotation, vx: number, vy: number, u: number, v: number): number {
  const [t, r, b, l] = surfaceHeights(w, vx, vy, rot);
  return t * (1 - u) * (1 - v) + r * u * (1 - v) + b * u * v + l * (1 - u) * v;
}
