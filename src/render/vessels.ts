/**
 * Planes and boats. Every working airport has planes that take off and land on the runway of its
 * pieces (one more for each level), and every working harbour has boats that go for a walk on the water
 * near it, with a cruise ship in the biggest. Purely decorative, like the cars: the simulation does not
 * depend on them, and they are drawn from the facilities as they are (see `refresh`).
 */
import { HUBS } from '../config';
import { project, rotateDir, toView, type Rotation } from '../core/iso';
import { Rng } from '../core/rng';
import { hubFacilities, hubFootprint, type HubFacility } from '../world/hubs';
import type { World } from '../world/world';
import type { Pt } from './geometry';
import type { MapRenderer } from './mapRenderer';
import { heightAt } from './traffic';

/** Seconds a take-off (or its reverse, a landing) lasts, and how many of them are on the ground. */
const FLIGHT = 4;
const ON_GROUND = 2;
/** Cells a plane covers on the ground while it speeds up, and how fast it goes in the air (cells per second). */
const RUN = 3;
const AIR_SPEED = 3;
/** Pixels a plane climbs per second once it leaves the ground. */
const CLIMB = 14;
/** How far from its harbour a boat goes, in cells. */
const WALK = 9;

const DIRS: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

export interface Plane {
  /** The piece whose runway it uses (its top-left cell) and the level of its airport (the bigger, the bigger the plane). */
  x: number;
  y: number;
  level: number;
  phase: 'wait' | 'takeoff' | 'landing';
  /** Seconds into the phase (or left to wait). */
  t: number;
  dir: 1 | -1;
}

export interface Boat {
  x: number;
  y: number;
  dx: number;
  dy: number;
  /** Progress from the centre of (x, y) to the centre of the next water cell, in [0, 1). */
  t: number;
  speed: number;
  home: [number, number];
  kind: 'tour' | 'cruise';
}

export class Vessels {
  planes = new Map<string, Plane>();
  boats = new Map<string, Boat>();
  private rng: Rng;

  constructor(
    readonly world: World,
    seed: number,
  ) {
    this.rng = new Rng(seed);
  }

  /** Gives every working facility its vehicles and takes them away from the ones that are gone; call after edits and every month. */
  refresh(): void {
    const planes = new Set<string>();
    const boats = new Set<string>();
    for (const f of hubFacilities(this.world)) {
      if (!f.works) continue;
      const first = [...f.pieces].sort((a, b) => a.y - b.y || a.x - b.x)[0];
      if (f.kind === 'airport') {
        for (let k = 0; k < f.level; k++) {
          const piece = f.pieces[k % f.pieces.length];
          const key = `${piece.x},${piece.y}:${k}`;
          planes.add(key);
          const old = this.planes.get(key);
          if (old) old.level = f.level;
          else this.planes.set(key, { x: piece.x, y: piece.y, level: f.level, phase: 'wait', t: this.rng.next() * 6, dir: this.rng.chance(0.5) ? 1 : -1 });
        }
      } else {
        const start = this.waterNextTo(f);
        if (!start) continue;
        // One boat for a walk in a small harbour, two in a bigger one and, in the biggest, a cruise ship too.
        for (let k = 0; k < (f.level === 1 ? 1 : 3); k++) {
          const key = `${first.x},${first.y}:${k}`;
          boats.add(key);
          if (this.boats.has(key)) continue;
          const kind = k < 2 ? 'tour' : 'cruise';
          const boat: Boat = { x: start[0], y: start[1], dx: 1, dy: 0, t: this.rng.next(), speed: kind === 'cruise' ? 0.35 : 0.6, home: start, kind };
          this.turn(boat);
          this.boats.set(key, boat);
        }
      }
    }
    for (const k of [...this.planes.keys()]) if (!planes.has(k)) this.planes.delete(k);
    for (const k of [...this.boats.keys()]) if (!boats.has(k)) this.boats.delete(k);
  }

  /** A water lot next to one of the pieces of the facility, or null. */
  private waterNextTo(f: HubFacility): [number, number] | null {
    const w = this.world;
    const options: [number, number][] = [];
    for (const p of f.pieces) {
      const foot = hubFootprint(p.kind, w.n, p.x, p.y);
      const own = new Set(foot.map(([x, y]) => y * w.n + x));
      for (const [x, y] of foot) {
        for (const [dx, dy] of DIRS) {
          const nx = x + dx;
          const ny = y + dy;
          if (w.inBounds(nx, ny) && !own.has(ny * w.n + nx) && w.isWater(nx, ny)) options.push([nx, ny]);
        }
      }
    }
    return options.length > 0 ? this.rng.pick(options) : null;
  }

  private isWater(x: number, y: number): boolean {
    return this.world.inBounds(x, y) && this.world.isWater(x, y);
  }

  update(dt: number): void {
    if (dt <= 0) return;
    for (const p of this.planes.values()) {
      p.t += p.phase === 'wait' ? -dt : dt;
      if (p.phase === 'wait' && p.t <= 0) {
        p.phase = this.rng.chance(0.5) ? 'takeoff' : 'landing';
        p.dir = this.rng.chance(0.5) ? 1 : -1;
        p.t = 0;
      } else if (p.phase !== 'wait' && p.t >= FLIGHT) {
        p.phase = 'wait';
        p.t = 4 + this.rng.next() * 8;
      }
    }
    for (const b of this.boats.values()) {
      b.t += b.speed * dt;
      while (b.t >= 1) {
        b.t -= 1;
        b.x += b.dx;
        b.y += b.dy;
        this.turn(b);
      }
    }
  }

  /** The boat reached the middle of a water lot: pick where to go from there, keeping close to its harbour. */
  private turn(b: Boat): void {
    const near = (x: number, y: number) => this.isWater(x, y) && Math.abs(x - b.home[0]) + Math.abs(y - b.home[1]) <= WALK;
    const options = DIRS.filter(([dx, dy]) => !(dx === -b.dx && dy === -b.dy) && near(b.x + dx, b.y + dy));
    if (options.length === 0) {
      const back = DIRS.find(([dx, dy]) => near(b.x + dx, b.y + dy));
      [b.dx, b.dy] = back ?? [0, 0];
      return;
    }
    const straight = options.find(([dx, dy]) => dx === b.dx && dy === b.dy);
    [b.dx, b.dy] = straight && this.rng.chance(0.75) ? straight : this.rng.pick(options);
  }
}

/** How far along the runway a plane is (in cells from the end it starts at), its height in pixels and its opacity, `t` seconds into a take-off. */
export function takeoffAt(t: number): { along: number; altitude: number; alpha: number } {
  const ground = Math.min(t, ON_GROUND);
  const air = Math.max(0, t - ON_GROUND);
  return {
    along: (RUN / (ON_GROUND * ON_GROUND)) * ground * ground + AIR_SPEED * air,
    altitude: air * CLIMB,
    alpha: 1 - air / (FLIGHT - ON_GROUND),
  };
}

/**
 * Where a plane is, in cells of the world, and how high (px) and visible it is. A landing is a take-off
 * played backwards. The runway of a piece runs along the world's x axis, on the side the drawing puts it
 * for the view: nearer the top of the piece from two of the four ways of looking at the map, nearer the bottom from the other two.
 */
export function planeAt(p: Plane, rot: Rotation): { x: number; y: number; altitude: number; alpha: number } | null {
  if (p.phase === 'wait') return null;
  const { along, altitude, alpha } = takeoffAt(p.phase === 'takeoff' ? p.t : FLIGHT - p.t);
  const length = HUBS.airport.w;
  const x = p.dir === 1 ? p.x + along : p.x + length - along;
  const y = p.y + (rot === 0 || rot === 3 ? 0.4 : HUBS.airport.h - 0.4);
  return { x, y, altitude, alpha: Math.max(0, Math.min(1, alpha)) };
}

/** Continuous world position of a boat: cell centres at +0.5. */
export function boatPosition(b: Boat): Pt {
  return [b.x + 0.5 + b.dx * b.t, b.y + 0.5 + b.dy * b.t];
}

function screenOf(w: World, map: MapRenderer, px: number, py: number): { sx: number; sy: number } {
  const n = w.n;
  const rot = map.rot;
  const [vx, vy] = toView(px, py, rot, n + 1);
  const cvx = Math.min(n - 1, Math.max(0, Math.floor(vx)));
  const cvy = Math.min(n - 1, Math.max(0, Math.floor(vy)));
  const [ox, oy] = project(vx, vy, heightAt(w, rot, cvx, cvy, vx - cvx, vy - cvy));
  return { sx: ox + map.originX, sy: oy + map.originY };
}

/** The boats, drawn on the water. */
export function drawBoats(g: CanvasRenderingContext2D, v: Vessels, map: MapRenderer, visible: [number, number, number, number]): void {
  const [x0, y0, x1, y1] = visible;
  for (const b of v.boats.values()) {
    const [px, py] = boatPosition(b);
    const { sx, sy } = screenOf(v.world, map, px, py);
    if (sx < x0 - 20 || sx > x1 + 20 || sy < y0 - 20 || sy > y1 + 20) continue;
    const [rdx, rdy] = rotateDir(b.dx, b.dy, map.rot);
    const ux = rdx - rdy;
    const uy = (rdx + rdy) / 2;
    const cruise = b.kind === 'cruise';
    const len = cruise ? 8.5 : 4.5;
    const dx = ux * len;
    const dy = uy * len;
    // The wake behind it.
    g.globalAlpha = 0.45;
    g.strokeStyle = '#e8f2f6';
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(sx - dx * 1.1, sy - dy * 1.1);
    g.lineTo(sx - dx * 2.1, sy - dy * 2.1);
    g.stroke();
    g.globalAlpha = 1;
    // The hull, dark below and white above, then what stands on it.
    const hull = (h0: number, h1: number, color: string, k = 1) => {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(sx - dx * k, sy - dy * k - h1);
      g.lineTo(sx + dx * k, sy + dy * k - h1);
      g.lineTo(sx + dx * k, sy + dy * k - h0);
      g.lineTo(sx - dx * k, sy - dy * k - h0);
      g.closePath();
      g.fill();
    };
    hull(0, 1.2, '#3c3b42');
    hull(1.2, cruise ? 3 : 2.4, '#f4f0e6');
    if (cruise) {
      hull(3, 5, '#f4f0e6', 0.7);
      hull(3.6, 4, '#2f63a6', 0.7);
      g.fillStyle = '#c8392f';
      g.fillRect(sx - 0.8, sy - 8, 1.6, 3.2);
    } else {
      g.fillStyle = '#c8392f';
      g.fillRect(sx - 1, sy - 4.6, 2, 2.2);
    }
  }
}

/** The planes, drawn over everything, with their shadow on the ground. */
export function drawPlanes(g: CanvasRenderingContext2D, v: Vessels, map: MapRenderer, visible: [number, number, number, number]): void {
  const [x0, y0, x1, y1] = visible;
  const w = v.world;
  for (const p of v.planes.values()) {
    const at = planeAt(p, map.rot);
    if (!at) continue;
    const { sx, sy: ground } = screenOf(w, map, at.x, at.y);
    const sy = ground - 2.2; // the runway is a little above the ground
    if (sx < x0 - 30 || sx > x1 + 30 || sy < y0 - 60 || sy > y1 + 30) continue;
    const [rdx, rdy] = rotateDir(p.dir, 0, map.rot);
    const ux = rdx - rdy;
    const uy = (rdx + rdy) / 2;
    const size = 3.4 + p.level * 1.1;
    const cy = sy - at.altitude;
    // Its shadow stays on the ground.
    g.globalAlpha = at.alpha * 0.25;
    g.fillStyle = '#000';
    g.beginPath();
    g.moveTo(sx - ux * size, sy - uy * size);
    g.lineTo(sx + ux * size, sy + uy * size);
    g.lineTo(sx + ux * size, sy + uy * size + 1.2);
    g.lineTo(sx - ux * size, sy - uy * size + 1.2);
    g.closePath();
    g.fill();
    // The body, the wings across it and the tail.
    g.globalAlpha = at.alpha;
    g.fillStyle = '#f4f0e6';
    g.beginPath();
    g.moveTo(sx - ux * size, cy - uy * size - 1.4);
    g.lineTo(sx + ux * size, cy + uy * size - 1.4);
    g.lineTo(sx + ux * size, cy + uy * size + 0.4);
    g.lineTo(sx - ux * size, cy - uy * size + 0.4);
    g.closePath();
    g.fill();
    g.fillStyle = '#c9ccd1';
    const wx = -uy * size * 1.1;
    const wy = (ux * size * 1.1) / 2;
    g.beginPath();
    g.moveTo(sx - wx, cy - wy - 0.6);
    g.lineTo(sx + wx, cy + wy - 0.6);
    g.lineTo(sx + wx * 0.8 - ux * 1.2, cy + wy * 0.8 - uy * 1.2 + 0.4);
    g.lineTo(sx - wx * 0.8 - ux * 1.2, cy - wy * 0.8 - uy * 1.2 + 0.4);
    g.closePath();
    g.fill();
    g.fillStyle = '#2f63a6';
    g.fillRect(sx - ux * size - 0.5, cy - uy * size - 3.2, 1.2, 2.4);
    g.globalAlpha = 1;
  }
}
