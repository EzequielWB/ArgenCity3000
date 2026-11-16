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
import { TILE, type World } from '../world/world';
import { coastWorks } from '../sim/coast';
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
/** The stretch of runway it has already covered when it lifts off, in cells. */
const AIRBORNE_FROM = RUN + AIR_SPEED * (FLIGHT - ON_GROUND);
/**
 * How far from the runway a plane goes before it leaves the map, in cells, and how many of those it
 * takes to fade. A plane that went to the edge of a huge map would be gone for a minute; one that
 * turned around a cell past the runway would never be seen leaving.
 */
const EDGE_NEAR = 18;
const EDGE_FAR = 44;
const FADE = 5;

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
  /**
   * What it is doing: waiting off the map, rolling and climbing out of the runway, flying away to
   * leave the map, coming back in from the edge, or landing.
   */
  phase: 'wait' | 'takeoff' | 'out' | 'in' | 'landing';
  /** Seconds into the phase (or left to wait). */
  t: number;
  dir: 1 | -1;
  /** How far along its course it leaves the map and comes back, in cells from the start of the runway. */
  far: number;
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
  kind: 'tour' | 'cruise' | 'fishing';
  /** How far from home it sails before it turns back, in cells: each boat gets its own so the water fills up. */
  roam: number;
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
          const dir: 1 | -1 = this.rng.chance(0.5) ? 1 : -1;
          const old = this.planes.get(key);
          if (old) {
            old.level = f.level;
            old.far = this.edgeOf(piece.x, dir);
          } else this.planes.set(key, { x: piece.x, y: piece.y, level: f.level, phase: 'wait', t: this.rng.next() * 6, dir, far: this.edgeOf(piece.x, dir) });
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
          const roam = kind === 'cruise' ? 26 : 12 + this.rng.int(6);
          const boat: Boat = { x: start[0], y: start[1], dx: 1, dy: 0, t: this.rng.next(), speed: kind === 'cruise' ? 0.35 : 0.6, home: start, kind, roam };
          this.turn(boat);
          this.boats.set(key, boat);
        }
      }
    }
    // A fishing boat for every working dock, sailing close to it.
    for (let i = 0; i < this.world.tiles.length; i++) {
      if (this.world.tiles[i] !== TILE.FISHING || !coastWorks(this.world, i)) continue;
      const key = `fish:${i}`;
      boats.add(key);
      if (this.boats.has(key)) continue;
      const x = i % this.world.n;
      const y = (i - x) / this.world.n;
      const start = DIRS.map(([dx, dy]): [number, number] => [x + dx, y + dy]).find(([wx, wy]) => this.isWater(wx, wy));
      if (!start) continue;
      const roam = 8 + this.rng.int(4);
      const boat: Boat = { x: start[0], y: start[1], dx: 1, dy: 0, t: this.rng.next(), speed: 0.45, home: start, kind: 'fishing', roam };
      this.turn(boat);
      this.boats.set(key, boat);
    }
    for (const k of [...this.planes.keys()]) if (!planes.has(k)) this.planes.delete(k);
    for (const k of [...this.boats.keys()]) if (!boats.has(k)) this.boats.delete(k);
  }

  /** How far a plane taking off at `x` towards `dir` flies before it leaves the map, in cells from the runway's start. */
  private edgeOf(x: number, dir: 1 | -1): number {
    const n = this.world.n;
    const edge = dir === 1 ? n + 2 - x : x + HUBS.airport.w + 2;
    return Math.min(EDGE_FAR, Math.max(EDGE_NEAR, edge));
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
      const cruise = (p.far - AIRBORNE_FROM) / AIR_SPEED;
      if (p.phase === 'wait') {
        if (p.t > 0) continue;
        // Half the time it leaves, half the time it arrives from beyond the map.
        const out = this.rng.chance(0.5);
        p.phase = out ? 'takeoff' : 'in';
        p.dir = this.rng.chance(0.5) ? 1 : -1;
        p.far = this.edgeOf(p.x, p.dir);
        p.t = 0;
      } else if (p.phase === 'takeoff' && p.t >= FLIGHT) {
        p.phase = 'out';
        p.t = 0;
      } else if (p.phase === 'out' && p.t >= cruise) {
        p.phase = 'wait';
        p.t = 2 + this.rng.next() * 5;
      } else if (p.phase === 'in' && p.t >= cruise) {
        p.phase = 'landing';
        p.t = 0;
      } else if (p.phase === 'landing' && p.t >= FLIGHT) {
        p.phase = 'wait';
        p.t = 3 + this.rng.next() * 7;
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

  /** The boat reached the middle of a water lot: pick where to go from there, inside its own patch of water. */
  private turn(b: Boat): void {
    const near = (x: number, y: number) => this.isWater(x, y) && Math.abs(x - b.home[0]) + Math.abs(y - b.home[1]) <= b.roam;
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

/** How far along the runway a plane is (in cells from the end it starts at) and its height, `t` seconds into a take-off. */
export function takeoffAt(t: number): { along: number; altitude: number } {
  const ground = Math.min(t, ON_GROUND);
  const air = Math.max(0, t - ON_GROUND);
  return {
    along: (RUN / (ON_GROUND * ON_GROUND)) * ground * ground + AIR_SPEED * air,
    altitude: air * CLIMB,
  };
}

/** The height a plane cruises at once it has left the runway: the ceiling of a take-off, held. */
const CEILING = CLIMB * (FLIGHT - ON_GROUND);

/**
 * Where a plane is, in cells of the world, and how high (px) and visible it is. A landing is a take-off
 * played backwards; between the two it flies away until it leaves the map and comes back in from there,
 * so there is always something crossing the sky. The runway of a piece runs along the world's x axis,
 * on the side the drawing puts it for the view: nearer the top of the piece from two of the four ways
 * of looking at the map, nearer the bottom from the other two.
 */
export function planeAt(p: Plane, rot: Rotation): { x: number; y: number; altitude: number; alpha: number } | null {
  if (p.phase === 'wait') return null;
  const length = HUBS.airport.w;
  let along: number;
  let altitude: number;
  if (p.phase === 'takeoff' || p.phase === 'landing') {
    const at = takeoffAt(p.phase === 'takeoff' ? p.t : FLIGHT - p.t);
    along = at.along;
    altitude = at.altitude;
  } else {
    along = p.phase === 'out' ? AIRBORNE_FROM + AIR_SPEED * p.t : p.far - AIR_SPEED * p.t;
    altitude = CEILING;
  }
  // It fades out on its way to the edge of the map and back in when it returns from it.
  const alpha = p.phase === 'takeoff' || p.phase === 'landing' ? 1 : Math.max(0, Math.min(1, (p.far - along) / FADE));
  const x = p.dir === 1 ? p.x + along : p.x + length - along;
  const y = p.y + (rot === 0 || rot === 3 ? 0.4 : HUBS.airport.h - 0.4);
  return { x, y, altitude, alpha };
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
    const fishing = b.kind === 'fishing';
    const len = cruise ? 8.5 : fishing ? 3.8 : 4.5;
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
    hull(0, 1.2, fishing ? '#24405f' : '#3c3b42');
    hull(1.2, cruise ? 3 : 2.4, fishing ? '#2f63a6' : '#f4f0e6');
    if (fishing) {
      // A little white wheelhouse at the back, a mast with a yellow flag and a red band along the hull.
      hull(1.8, 2, '#c8392f');
      g.fillStyle = '#f4f0e6';
      g.fillRect(sx - ux * 2.2 - 1.2, sy - uy * 2.2 - 4.4, 2.4, 2.4);
      g.fillStyle = '#4a4440';
      g.fillRect(sx + ux * 0.6 - 0.4, sy + uy * 0.6 - 7, 0.8, 5);
      g.fillStyle = '#f2c230';
      g.fillRect(sx + ux * 0.6 + 0.4, sy + uy * 0.6 - 7, 1.8, 1.2);
    } else if (cruise) {
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
