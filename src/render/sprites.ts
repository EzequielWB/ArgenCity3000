import { PAL, shade } from './color';
import type { CoastKind, PlantKind, ServiceKind } from '../config';
import type { ZoneKind } from '../world/world';

/**
 * Procedural isometric sprites. Every sprite is anchored at the top corner of its footprint
 * diamond on the ground: (ax, ay) inside the sprite canvas is where that corner goes on screen.
 */
export interface Sprite {
  canvas: HTMLCanvasElement;
  ax: number;
  ay: number;
  /** Chimney tops (relative to the anchor) that emit smoke. */
  smoke: [number, number][];
  /** Top of the power pole (relative to the anchor), for wires. */
  attach?: [number, number];
}

const TOP = 1;
const LEFT = 0.84;
const RIGHT = 0.64;

type Pt = [number, number];

class Painter {
  readonly g: CanvasRenderingContext2D;
  readonly smoke: [number, number][] = [];
  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly ax: number,
    readonly ay: number,
  ) {
    this.g = canvas.getContext('2d')!;
  }

  /** Footprint coordinates (u, v in cells, z in px) → sprite pixels. */
  P(u: number, v: number, z: number): Pt {
    return [this.ax + 16 * (u - v), this.ay + 8 * (u + v) - z];
  }

  poly(pts: Pt[], fill: string, stroke?: string): void {
    const g = this.g;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    if (stroke) {
      g.strokeStyle = stroke;
      g.lineWidth = 0.6;
      g.stroke();
    }
  }

  box(u0: number, v0: number, u1: number, v1: number, z0: number, h: number, color: string, outline = true): void {
    const z1 = z0 + h;
    const P = this.P.bind(this);
    const edge = outline ? shade(color, 0.45) : undefined;
    this.poly([P(u1, v0, z0), P(u1, v1, z0), P(u1, v1, z1), P(u1, v0, z1)], shade(color, RIGHT), edge);
    this.poly([P(u0, v1, z0), P(u1, v1, z0), P(u1, v1, z1), P(u0, v1, z1)], shade(color, LEFT), edge);
    this.poly([P(u0, v0, z1), P(u1, v0, z1), P(u1, v1, z1), P(u0, v1, z1)], shade(color, TOP), edge);
  }

  /** Rectangle on the left-facing wall (v fixed), spanning u0..u1 and z0..z1. */
  left(v: number, u0: number, u1: number, z0: number, z1: number, color: string): void {
    const P = this.P.bind(this);
    this.poly([P(u0, v, z0), P(u1, v, z0), P(u1, v, z1), P(u0, v, z1)], shade(color, LEFT));
  }

  /** Rectangle on the right-facing wall (u fixed), spanning v0..v1 and z0..z1. */
  right(u: number, v0: number, v1: number, z0: number, z1: number, color: string): void {
    const P = this.P.bind(this);
    this.poly([P(u, v0, z0), P(u, v1, z0), P(u, v1, z1), P(u, v0, z1)], shade(color, RIGHT));
  }

  /** Grid of windows on both visible walls of a box. */
  windows(
    u0: number,
    v0: number,
    u1: number,
    v1: number,
    zFrom: number,
    zTo: number,
    floorH: number,
    color: string,
    cols = 3,
    winH = 3,
  ): void {
    for (let z = zFrom; z + winH <= zTo; z += floorH) {
      for (let c = 0; c < cols; c++) {
        const a = u0 + ((u1 - u0) * (c + 0.25)) / cols;
        const b = u0 + ((u1 - u0) * (c + 0.75)) / cols;
        this.left(v1, a, b, z, z + winH, color);
        const p = v0 + ((v1 - v0) * (c + 0.25)) / cols;
        const q = v0 + ((v1 - v0) * (c + 0.75)) / cols;
        this.right(u1, p, q, z, z + winH, color);
      }
    }
  }

  hipRoof(u0: number, v0: number, u1: number, v1: number, z: number, rh: number, color: string): void {
    const P = this.P.bind(this);
    const apex = P((u0 + u1) / 2, (v0 + v1) / 2, z + rh);
    const dark = shade(color, 0.5);
    this.poly([P(u0, v0, z), P(u1, v0, z), apex], shade(color, 0.95), dark);
    this.poly([P(u0, v0, z), P(u0, v1, z), apex], shade(color, 1.05), dark);
    this.poly([P(u0, v1, z), P(u1, v1, z), apex], shade(color, LEFT), dark);
    this.poly([P(u1, v0, z), P(u1, v1, z), apex], shade(color, RIGHT), dark);
  }

  /** Gable roof with the ridge running along u. */
  gableRoof(u0: number, v0: number, u1: number, v1: number, z: number, rh: number, color: string, wall: string): void {
    const P = this.P.bind(this);
    const vm = (v0 + v1) / 2;
    const dark = shade(color, 0.5);
    this.poly([P(u0, v0, z), P(u1, v0, z), P(u1, vm, z + rh), P(u0, vm, z + rh)], shade(color, 1.05), dark);
    this.poly([P(u0, v1, z), P(u1, v1, z), P(u1, vm, z + rh), P(u0, vm, z + rh)], shade(color, LEFT), dark);
    this.poly([P(u1, v0, z), P(u1, v1, z), P(u1, vm, z + rh)], shade(wall, RIGHT), shade(wall, 0.45));
  }

  cylinder(cu: number, cv: number, r: number, z0: number, h: number, color: string): void {
    const g = this.g;
    const [bx, by] = this.P(cu, cv, z0);
    const [, ty] = this.P(cu, cv, z0 + h);
    const rx = r * 22.6;
    const ry = rx / 2;
    g.fillStyle = shade(color, 0.72);
    g.fillRect(bx - rx, ty, rx * 2, by - ty);
    g.fillStyle = shade(color, 0.88);
    g.fillRect(bx - rx, ty, rx * 0.8, by - ty);
    g.beginPath();
    g.ellipse(bx, by, rx, ry, 0, 0, Math.PI);
    g.fillStyle = shade(color, 0.72);
    g.fill();
    g.beginPath();
    g.ellipse(bx, ty, rx, ry, 0, 0, Math.PI * 2);
    g.fillStyle = shade(color, 1.05);
    g.fill();
    g.strokeStyle = shade(color, 0.5);
    g.lineWidth = 0.6;
    g.stroke();
  }

  /** Red-and-white striped chimney; registers a smoke source at its top. */
  chimney(u0: number, v0: number, s: number, h: number, base = 0, a = '#c8462f', b = '#efe6d8'): void {
    const bands = 5;
    for (let k = 0; k < bands; k++) {
      this.box(u0, v0, u0 + s, v0 + s, base + (h * k) / bands, h / bands, k % 2 ? b : a, false);
    }
    const [x, y] = this.P(u0 + s / 2, v0 + s / 2, base + h);
    this.smoke.push([x - this.ax, y - this.ay]);
  }

  /** Striped awning hanging off the left wall. */
  awning(v: number, u0: number, u1: number, z: number, c1: string, c2: string, stripes = 4): void {
    const P = this.P.bind(this);
    for (let k = 0; k < stripes; k++) {
      const a = u0 + ((u1 - u0) * k) / stripes;
      const b = u0 + ((u1 - u0) * (k + 1)) / stripes;
      this.poly([P(a, v, z), P(b, v, z), P(b, v + 0.13, z - 4), P(a, v + 0.13, z - 4)], k % 2 ? c2 : c1);
    }
  }

  /** Same awning on the right wall. */
  awningRight(u: number, v0: number, v1: number, z: number, c1: string, c2: string, stripes = 4): void {
    const P = this.P.bind(this);
    for (let k = 0; k < stripes; k++) {
      const a = v0 + ((v1 - v0) * k) / stripes;
      const b = v0 + ((v1 - v0) * (k + 1)) / stripes;
      this.poly([P(u, a, z), P(u, b, z), P(u + 0.13, b, z - 4), P(u + 0.13, a, z - 4)], shade(k % 2 ? c2 : c1, 0.85));
    }
  }

  tree(u: number, v: number, kind: number, scale = 1): void {
    const g = this.g;
    const [x, y] = this.P(u, v, 0);
    const s = scale;
    if (kind === 4) {
      // Eucalipto: tall and narrow.
      g.fillStyle = '#d9cfb8';
      g.fillRect(x - 0.7, y - 14 * s, 1.4, 14 * s);
      blob(g, x, y - 16 * s, 3.2 * s, 7 * s, '#6f9461');
      blob(g, x - 1, y - 19 * s, 2 * s, 3 * s, '#8db07c');
      return;
    }
    if (kind === 2) {
      // Palo borracho: swollen trunk, pink flowers.
      g.fillStyle = '#7f9a6a';
      g.beginPath();
      g.ellipse(x, y - 3 * s, 1.6 * s, 3.2 * s, 0, 0, Math.PI * 2);
      g.fill();
      blob(g, x, y - 9 * s, 5 * s, 3.6 * s, '#d97aa3');
      blob(g, x - 1.5 * s, y - 10.5 * s, 2.4 * s, 1.8 * s, '#f0a8c6');
      return;
    }
    g.fillStyle = '#6b4a2e';
    g.fillRect(x - 0.8, y - 6 * s, 1.6, 6 * s);
    if (kind === 3) {
      // Ombú: wide dark crown.
      blob(g, x, y - 9 * s, 6.5 * s, 4.5 * s, '#3e6e3a');
      blob(g, x - 2 * s, y - 11 * s, 3 * s, 2 * s, '#5a8a48');
    } else {
      // Jacarandá: lilac crown.
      blob(g, x, y - 9 * s, 5 * s, 4 * s, '#8e6cc2');
      blob(g, x - 1.5 * s, y - 10.5 * s, 2.5 * s, 2 * s, '#b49ae2');
    }
  }
}

function blob(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string): void {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fillStyle = color;
  g.fill();
  g.strokeStyle = shade(color.startsWith('#') ? color : '#000000', 0.6);
  g.lineWidth = 0.5;
  g.stroke();
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Creates a painter for a footprint of `cells`×`cells` and `height` px above the ground. */
function painter(cells: number, height: number): Painter {
  const w = 32 * cells + 4;
  const h = 16 * cells + height + 4;
  return new Painter(makeCanvas(w, h), w / 2, height + 2);
}

function done(p: Painter, attach?: [number, number]): Sprite {
  return { canvas: p.canvas, ax: p.ax, ay: p.ay, smoke: p.smoke, attach };
}

const WALLS = ['#f1e3c6', '#e9b9a2', '#b5d3e0', '#f0d27c', '#c2dbb3', '#f4f0e6'];
const ROOFS = ['#b4532f', '#9e4428', '#c06a3c', '#7d6a5e'];
const AWNINGS: [string, string][] = [
  ['#c8392f', '#f4ece0'],
  ['#2f7f4f', '#f4ece0'],
  ['#2f63a6', '#f4ece0'],
  ['#e0a526', '#7a2f2a'],
];

function residential(level: number, v: number): Sprite {
  const wall = WALLS[v % WALLS.length];
  const roof = ROOFS[(v >> 3) % ROOFS.length];
  if (level === 1) {
    const p = painter(1, 24);
    if (v % 3 === 0) p.tree(0.15, 0.85, 1 + ((v >> 2) % 4), 0.7);
    p.box(0.25, 0.25, 0.75, 0.75, 0, 8, wall);
    p.left(0.75, 0.42, 0.55, 0, 6, PAL.door);
    p.right(0.75, 0.38, 0.6, 3, 6, PAL.glass);
    p.hipRoof(0.2, 0.2, 0.8, 0.8, 8, 7, roof);
    return done(p);
  }
  if (level === 2) {
    const p = painter(1, 32);
    if (v % 2 === 0) {
      // Chalet with a tiled gable roof.
      p.box(0.14, 0.2, 0.86, 0.8, 0, 12, wall);
      p.left(0.8, 0.22, 0.34, 0, 8, PAL.door);
      p.left(0.8, 0.45, 0.6, 4, 9, PAL.glass);
      p.left(0.8, 0.68, 0.8, 4, 9, PAL.glass);
      p.right(0.86, 0.35, 0.62, 4, 9, PAL.glass);
      p.box(0.25, 0.3, 0.33, 0.38, 12, 9, '#9a8d80');
      p.gableRoof(0.1, 0.16, 0.9, 0.84, 12, 8, roof, wall);
    } else {
      // Casa chorizo with a rooftop terrace.
      p.box(0.1, 0.2, 0.9, 0.8, 0, 13, wall);
      p.left(0.8, 0.15, 0.27, 0, 9, PAL.door);
      for (const a of [0.35, 0.55, 0.75]) p.left(0.8, a, a + 0.1, 3, 10, '#4a5560');
      p.right(0.9, 0.3, 0.45, 3, 10, '#4a5560');
      p.right(0.9, 0.55, 0.7, 3, 10, '#4a5560');
      p.box(0.1, 0.2, 0.9, 0.24, 13, 2, shade(wall, 0.9), false);
      p.box(0.1, 0.76, 0.9, 0.8, 13, 2, shade(wall, 0.9), false);
      p.box(0.6, 0.35, 0.72, 0.47, 13, 3, '#4f8a3a', false);
    }
    return done(p);
  }
  if (level === 3) {
    const p = painter(1, 48);
    const facade = v % 2 ? PAL.brick : wall;
    p.box(0.1, 0.1, 0.9, 0.9, 0, 30, facade);
    p.left(0.9, 0.4, 0.6, 0, 7, PAL.door);
    p.windows(0.1, 0.1, 0.9, 0.9, 9, 30, 7, '#3f5866', 3, 3);
    for (const z of [8, 15, 22]) p.left(0.9, 0.1, 0.9, z, z + 1, shade(facade, 0.7));
    p.box(0.55, 0.55, 0.75, 0.75, 30, 6, '#8f9ea6');
    p.box(0.2, 0.2, 0.35, 0.35, 30, 3, '#9c8f86', false);
    return done(p);
  }
  const h = 56 + (v % 4) * 8;
  const p = painter(1, h + 24);
  const facade = ['#efe8dc', '#d9cbb4', '#c9b8a6', '#e4d6bf'][v % 4];
  p.box(0.15, 0.15, 0.85, 0.85, 0, h, facade);
  p.left(0.85, 0.4, 0.6, 0, 7, PAL.door);
  p.windows(0.15, 0.15, 0.85, 0.85, 9, h - 2, 6, '#41606f', 3, 3);
  for (let z = 12; z < h - 2; z += 12) p.left(0.85, 0.15, 0.85, z, z + 1, shade(facade, 0.62));
  p.box(0.45, 0.45, 0.7, 0.7, h, 7, '#8f9ea6');
  const [x, y] = p.P(0.3, 0.3, h);
  p.g.fillStyle = '#4a4440';
  p.g.fillRect(x, y - 12, 1, 12);
  return done(p);
}

function commercial(level: number, v: number): Sprite {
  const [a1, a2] = AWNINGS[v % AWNINGS.length];
  if (level === 1) {
    const p = painter(1, 24);
    const wall = WALLS[(v >> 2) % WALLS.length];
    p.box(0.3, 0.3, 0.7, 0.7, 0, 9, wall);
    p.left(0.7, 0.36, 0.64, 1, 6, PAL.glass);
    p.awning(0.7, 0.3, 0.7, 8, a1, a2, 3);
    p.box(0.3, 0.3, 0.7, 0.7, 9, 2, a1, false);
    return done(p);
  }
  if (level === 2) {
    const p = painter(1, 30);
    const wall = WALLS[(v >> 2) % WALLS.length];
    p.box(0.12, 0.12, 0.88, 0.88, 0, 13, wall);
    p.left(0.88, 0.18, 0.82, 1, 7, PAL.glass);
    p.right(0.88, 0.2, 0.8, 1, 7, PAL.glass);
    p.awning(0.88, 0.12, 0.88, 9, a1, a2, 5);
    p.awningRight(0.88, 0.12, 0.88, 9, a1, a2, 5);
    p.left(0.88, 0.12, 0.88, 10, 13, '#e0a526');
    for (const u of [0.25, 0.5, 0.75]) p.left(0.88, u, u + 0.04, 11, 12, '#c8392f');
    return done(p);
  }
  if (level === 3) {
    const p = painter(1, 44);
    const wall = ['#e7dccb', '#d6c3a5', '#c9d3d6'][v % 3];
    p.box(0.08, 0.08, 0.92, 0.92, 0, 24, wall);
    p.left(0.92, 0.1, 0.9, 0, 8, PAL.glassDark);
    p.right(0.92, 0.1, 0.9, 0, 8, PAL.glassDark);
    p.windows(0.08, 0.08, 0.92, 0.92, 11, 24, 6, PAL.glass, 4, 3);
    p.box(0.3, 0.5, 0.75, 0.56, 24, 9, a1);
    p.left(0.56, 0.34, 0.71, 26, 31, a2);
    return done(p);
  }
  const h = 64 + (v % 3) * 12;
  const p = painter(1, h + 22);
  const glass = ['#5f9fb8', '#6c8fa8', '#4f8f8a'][v % 3];
  p.box(0.18, 0.18, 0.82, 0.82, 0, h, glass);
  for (let z = 3; z < h; z += 4) {
    p.left(0.82, 0.18, 0.82, z, z + 1, shade(glass, 1.25));
    p.right(0.82, 0.18, 0.82, z, z + 1, shade(glass, 1.25));
  }
  p.box(0.25, 0.25, 0.75, 0.75, h, 5, '#d9d4cc');
  const [x, y] = p.P(0.5, 0.5, h + 5);
  p.g.fillStyle = '#3a3a3a';
  p.g.fillRect(x - 0.5, y - 14, 1, 14);
  p.g.fillStyle = '#e04a3a';
  p.g.fillRect(x - 1, y - 15, 2, 2);
  return done(p);
}

function industrial(level: number, v: number): Sprite {
  if (level === 1) {
    const p = painter(1, 24);
    p.box(0.12, 0.15, 0.88, 0.85, 0, 10, PAL.brick);
    p.left(0.85, 0.25, 0.65, 0, 7, '#6d6f72');
    for (let z = 1; z < 7; z += 2) p.left(0.85, 0.25, 0.65, z, z + 0.5, '#55575a');
    p.gableRoof(0.1, 0.12, 0.9, 0.88, 10, 5, PAL.chapa, PAL.brick);
    return done(p);
  }
  if (level === 2) {
    const p = painter(1, 28);
    const wall = v % 2 ? '#a9b4b8' : PAL.brick;
    p.box(0.06, 0.1, 0.94, 0.9, 0, 11, wall);
    p.left(0.9, 0.55, 0.85, 0, 8, '#5d6064');
    p.right(0.94, 0.3, 0.7, 4, 7, PAL.glassDark);
    p.gableRoof(0.04, 0.08, 0.96, 0.92, 11, 6, '#b7bfc2', wall);
    return done(p);
  }
  if (level === 3) {
    const p = painter(1, 52);
    p.chimney(0.72, 0.1, 0.14, 40);
    p.box(0.08, 0.08, 0.92, 0.92, 0, 16, PAL.brickDark);
    p.left(0.92, 0.1, 0.9, 5, 11, PAL.glassDark);
    const teeth = 3;
    for (let k = 0; k < teeth; k++) {
      const a = 0.08 + (0.84 * k) / teeth;
      const b = 0.08 + (0.84 * (k + 1)) / teeth;
      p.poly([p.P(a, 0.08, 16), p.P(b, 0.08, 22), p.P(b, 0.92, 22), p.P(a, 0.92, 16)], shade(PAL.chapa, 0.95), shade(PAL.chapa, 0.5));
      p.poly([p.P(b, 0.08, 16), p.P(b, 0.92, 16), p.P(b, 0.92, 22), p.P(b, 0.08, 22)], PAL.glass);
    }
    return done(p);
  }
  const p = painter(1, 64);
  p.chimney(0.1, 0.1, 0.14, 50);
  p.box(0.04, 0.04, 0.96, 0.96, 0, 3, '#8a8780', false);
  p.cylinder(0.32, 0.68, 0.2, 3, 18, '#e8e4dc');
  p.cylinder(0.68, 0.32, 0.18, 3, 14, '#d9c9a0');
  p.box(0.55, 0.55, 0.94, 0.94, 3, 20, '#a9b0b4');
  p.windows(0.55, 0.55, 0.94, 0.94, 8, 22, 6, PAL.glassDark, 2, 2);
  return done(p);
}

function plant(): Sprite {
  const p = painter(2, 84);
  p.box(0.05, 0.05, 1.95, 1.95, 0, 3, PAL.concrete, false);
  p.chimney(0.3, 0.15, 0.22, 64, 3);
  p.chimney(0.75, 0.15, 0.22, 64, 3);
  // Coal heap.
  p.poly([p.P(1.3, 0.15, 3), p.P(1.85, 0.15, 3), p.P(1.85, 0.7, 3), p.P(1.3, 0.7, 3), p.P(1.57, 0.42, 12)], '#2d2a28', '#1a1817');
  p.box(0.15, 0.6, 1.2, 1.85, 3, 26, PAL.brick);
  for (let u = 0.25; u < 1.15; u += 0.22) p.left(1.85, u, u + 0.1, 8, 24, PAL.glassDark);
  p.right(1.2, 0.8, 1.7, 14, 22, PAL.glassDark);
  p.box(1.25, 0.9, 1.85, 1.85, 3, 18, '#c9b9a0');
  p.right(1.85, 1.0, 1.75, 6, 9, '#7a3a2c');
  p.left(1.85, 1.3, 1.8, 3, 12, '#5d6064');
  return done(p);
}

/** Gas plant: two round tanks, a turbine hall and one slim stack. */
function gasPlant(): Sprite {
  const p = painter(2, 70);
  p.box(0.05, 0.05, 1.95, 1.95, 0, 3, PAL.concrete, false);
  p.chimney(0.25, 0.2, 0.14, 50, 3, '#9aa3a8', '#e8e4dc');
  p.cylinder(0.75, 0.45, 0.3, 3, 20, '#e8e4dc');
  p.cylinder(1.5, 0.45, 0.3, 3, 20, '#d9d4cc');
  p.box(0.2, 1.0, 1.85, 1.85, 3, 20, '#b9c4cc');
  for (let u = 0.3; u < 1.75; u += 0.26) p.left(1.85, u, u + 0.12, 8, 18, PAL.glassDark);
  p.right(1.85, 1.1, 1.75, 6, 10, '#3f6f9f');
  // Yellow gas pipe from the tanks to the hall.
  p.box(0.7, 0.75, 0.8, 1.0, 3, 5, '#e0b542', false);
  p.box(1.45, 0.75, 1.55, 1.0, 3, 5, '#e0b542', false);
  return done(p);
}

/** Wind farm: three white turbines on a gravel pad. */
function windFarm(): Sprite {
  const p = painter(2, 96);
  p.box(0.05, 0.05, 1.95, 1.95, 0, 2, '#b8ad8c', false);
  p.box(1.35, 1.35, 1.8, 1.8, 2, 7, '#e8e4dc');
  const g = p.g;
  const turbine = (u: number, v: number, h: number, turn: number) => {
    const [bx, by] = p.P(u, v, 2);
    const [tx, ty] = p.P(u, v, 2 + h);
    p.poly(
      [
        [bx - 1.6, by],
        [bx + 1.6, by],
        [tx + 0.8, ty],
        [tx - 0.8, ty],
      ],
      '#f4f0e6',
      '#9aa3a8',
    );
    g.strokeStyle = '#ffffff';
    g.lineCap = 'round';
    g.lineWidth = 1.6;
    for (let k = 0; k < 3; k++) {
      const a = turn + (k * Math.PI * 2) / 3;
      g.beginPath();
      g.moveTo(tx, ty);
      g.lineTo(tx + Math.cos(a) * 17, ty + Math.sin(a) * 17);
      g.stroke();
    }
    g.fillStyle = '#c8462f';
    g.beginPath();
    g.arc(tx, ty, 1.8, 0, Math.PI * 2);
    g.fill();
  };
  turbine(0.45, 0.45, 62, 0.4);
  turbine(1.35, 0.6, 70, 1.3);
  turbine(0.6, 1.45, 66, 2.2);
  return done(p);
}

/** Public school: white walls, celeste trim and the flag on a pole. */
function school(): Sprite {
  const p = painter(1, 40);
  p.box(0.06, 0.12, 0.94, 0.88, 0, 13, '#f4f0e6');
  p.left(0.88, 0.06, 0.94, 5, 6.5, '#6fb7e0');
  p.right(0.94, 0.12, 0.88, 5, 6.5, '#6fb7e0');
  p.windows(0.06, 0.12, 0.94, 0.88, 7.5, 12, 6, PAL.glass, 4, 3);
  p.left(0.88, 0.42, 0.58, 0, 4.5, '#5b3b26');
  p.gableRoof(0.04, 0.1, 0.96, 0.9, 13, 5, '#b4532f', '#f4f0e6');
  const [x, y] = p.P(0.12, 0.3, 18);
  p.g.fillStyle = '#d9d4cc';
  p.g.fillRect(x - 0.5, y - 18, 1, 18);
  for (const [k, color] of [
    [0, '#74acdf'],
    [1, '#ffffff'],
    [2, '#74acdf'],
  ] as const) {
    p.g.fillStyle = color;
    p.g.fillRect(x + 0.5, y - 18 + k * 1.6, 7, 1.6);
  }
  p.g.fillStyle = '#f6b40e';
  p.g.fillRect(x + 3.5, y - 16.2, 1, 1);
  return done(p);
}

/** Neighbourhood health centre: low white building with a green cross. */
function clinic(): Sprite {
  const p = painter(1, 30);
  p.box(0.12, 0.12, 0.88, 0.88, 0, 11, '#f4f0e6');
  p.left(0.88, 0.12, 0.88, 0, 2, '#3a8f5c');
  p.right(0.88, 0.12, 0.88, 0, 2, '#3a8f5c');
  p.left(0.88, 0.2, 0.45, 3, 8, PAL.glass);
  p.right(0.88, 0.25, 0.75, 4, 8, PAL.glass);
  p.box(0.12, 0.12, 0.88, 0.88, 11, 1.5, '#d8d2c4', false);
  // Green cross standing on the roof.
  const [x, y] = p.P(0.5, 0.5, 12.5);
  p.g.fillStyle = '#2f9a55';
  p.g.fillRect(x - 1.5, y - 11, 3, 9);
  p.g.fillRect(x - 4.5, y - 8, 9, 3);
  return done(p);
}

/** Police station: blue-grey block with a white band and a light bar on the roof. */
function police(): Sprite {
  const p = painter(1, 34);
  p.box(0.1, 0.1, 0.9, 0.9, 0, 15, '#3f5f8a');
  p.left(0.9, 0.1, 0.9, 9, 11, '#f4f0e6');
  p.right(0.9, 0.1, 0.9, 9, 11, '#f4f0e6');
  p.windows(0.1, 0.1, 0.9, 0.9, 3, 8, 6, '#cfe0ea', 3, 3);
  p.windows(0.1, 0.1, 0.9, 0.9, 12, 15, 6, '#cfe0ea', 3, 2);
  p.box(0.35, 0.4, 0.65, 0.6, 15, 3, '#d9d4cc');
  const [x, y] = p.P(0.5, 0.5, 18);
  p.g.fillStyle = '#2f63e0';
  p.g.fillRect(x - 4, y - 2, 4, 2);
  p.g.fillStyle = '#e03a2f';
  p.g.fillRect(x, y - 2, 4, 2);
  return done(p);
}

/** Volunteer fire station: red block with garage doors and a hose tower. */
function firehouse(): Sprite {
  const p = painter(1, 46);
  p.box(0.08, 0.1, 0.92, 0.9, 0, 14, '#b8322a');
  for (const [a, b] of [
    [0.14, 0.42],
    [0.5, 0.78],
  ]) {
    p.left(0.9, a, b, 0, 9, '#efe6d8');
    for (let z = 2; z < 9; z += 2) p.left(0.9, a, b, z, z + 0.4, '#b9ae9c');
  }
  p.right(0.92, 0.3, 0.7, 6, 10, PAL.glassDark);
  p.box(0.08, 0.1, 0.92, 0.9, 14, 1.5, '#efe6d8', false);
  p.box(0.66, 0.12, 0.9, 0.36, 15.5, 14, '#a52b24');
  p.right(0.9, 0.16, 0.32, 23, 27, PAL.glassDark);
  p.hipRoof(0.64, 0.1, 0.92, 0.38, 29.5, 4, '#7d6a5e');
  return done(p);
}

/** A building on fire: scorched, with flames on top and smoke rising from them. */
function burningOf(base: Sprite): Sprite {
  const c = makeCanvas(base.canvas.width, base.canvas.height);
  const g = c.getContext('2d')!;
  g.filter = 'brightness(0.55) sepia(0.4)';
  g.drawImage(base.canvas, 0, 0);
  g.filter = 'none';
  // Find the top of the building to put the flames on.
  const data = g.getImageData(0, 0, c.width, c.height).data;
  let top = base.ay;
  scan: for (let y = 0; y < c.height; y++) {
    for (let x = Math.max(0, base.ax - 8); x < Math.min(c.width, base.ax + 8); x++) {
      if (data[(y * c.width + x) * 4 + 3] > 0) {
        top = y;
        break scan;
      }
    }
  }
  const flames: [number, number, number][] = [
    [-6, 2, 5],
    [0, 0, 8],
    [6, 3, 5],
  ];
  for (const [dx, dy, h] of flames) {
    const x = base.ax + dx;
    const y = top + 4 + dy;
    for (const [color, s] of [
      ['#e0461f', 1],
      ['#f59a23', 0.65],
      ['#ffe066', 0.3],
    ] as const) {
      g.beginPath();
      g.moveTo(x - 3.5 * s, y);
      g.quadraticCurveTo(x - 3 * s, y - h * s * 0.6, x, y - h * s - 2);
      g.quadraticCurveTo(x + 3 * s, y - h * s * 0.6, x + 3.5 * s, y);
      g.closePath();
      g.fillStyle = color;
      g.fill();
    }
  }
  return { canvas: c, ax: base.ax, ay: base.ay, smoke: [[0, top - base.ay - 6]] };
}

function treeSprite(kind: number, v: number): Sprite {
  const p = painter(1, 26);
  const spots: [number, number][] = [
    [0.35, 0.35],
    [0.7, 0.45],
    [0.45, 0.75],
  ];
  const count = 1 + (v % 3);
  for (let k = 0; k < count; k++) {
    const [u, w] = spots[(k + v) % 3];
    p.tree(u, w, k === 2 && kind !== 4 ? ((kind % 4) + 1) : kind, 0.9 + 0.1 * ((v + k) % 3));
  }
  return done(p);
}

function parkSprite(v: number): Sprite {
  const p = painter(1, 30);
  const kind = v % 3;
  p.tree(0.2, 0.25, 1 + ((v >> 2) % 3), 0.8);
  if (kind === 0) {
    // Small obelisk.
    p.box(0.42, 0.42, 0.58, 0.58, 0, 2, '#d8d2c4', false);
    p.poly([p.P(0.45, 0.45, 2), p.P(0.55, 0.45, 2), p.P(0.55, 0.55, 2), p.P(0.45, 0.55, 2), p.P(0.5, 0.5, 20)], '#efe9dc', '#9a9284');
  } else if (kind === 1) {
    // Fountain.
    const [x, y] = p.P(0.5, 0.5, 1);
    p.g.beginPath();
    p.g.ellipse(x, y, 7, 3.5, 0, 0, Math.PI * 2);
    p.g.fillStyle = '#d8d2c4';
    p.g.fill();
    p.g.beginPath();
    p.g.ellipse(x, y, 5.5, 2.6, 0, 0, Math.PI * 2);
    p.g.fillStyle = '#6fb7e0';
    p.g.fill();
    p.g.fillStyle = '#d8d2c4';
    p.g.fillRect(x - 0.8, y - 5, 1.6, 5);
    p.g.fillStyle = '#cfe6ec';
    p.g.fillRect(x - 0.5, y - 7, 1, 2);
  } else {
    // Glorieta (bandstand).
    for (const [u, w] of [
      [0.35, 0.35],
      [0.65, 0.35],
      [0.35, 0.65],
      [0.65, 0.65],
    ]) {
      const [x, y] = p.P(u, w, 0);
      p.g.fillStyle = '#efe9dc';
      p.g.fillRect(x - 0.5, y - 7, 1, 7);
    }
    p.box(0.3, 0.3, 0.7, 0.7, 0, 1, '#d8d2c4', false);
    p.hipRoof(0.28, 0.28, 0.72, 0.72, 7, 6, '#2f7f4f');
  }
  p.tree(0.8, 0.75, 1 + ((v >> 4) % 4), 0.75);
  return done(p);
}

function poleSprite(): Sprite {
  const p = painter(1, 26);
  const [x, y] = p.P(0.5, 0.5, 0);
  p.g.fillStyle = PAL.pole;
  p.g.fillRect(x - 0.8, y - 18, 1.6, 18);
  p.g.fillRect(x - 5, y - 17, 10, 1.4);
  return done(p, [0, 8 - 17]);
}

/**
 * Edges of a view cell, in the order of the bits of an edge mask: back-right (v = 0), front-right
 * (u = 1), front-left (v = 1) and back-left (u = 0), each as its two end points in footprint units.
 */
const EDGES: readonly [number, number, number, number][] = [
  [0, 0, 1, 0],
  [1, 0, 1, 1],
  [0, 1, 1, 1],
  [0, 0, 0, 1],
];

/** Pulls a footprint coordinate a little towards the middle of the lot, so a rail stays inside it. */
const inset = (t: number) => t + (0.5 - t) * 0.14;

function lamp(p: Painter, u: number, v: number): void {
  const g = p.g;
  const [x, y] = p.P(u, v, 0);
  g.fillStyle = '#4a4650';
  g.fillRect(x - 0.7, y - 15, 1.4, 15);
  g.fillRect(x - 1.6, y - 1.4, 3.2, 1.4);
  blob(g, x, y - 16.5, 2.4, 2.1, '#ffe08a');
}

/**
 * Low railing and lamp posts along the edges of a promenade lot that face the water (bits 1 to 8
 * of `variant`; bit 16 asks for a lamp). The paving itself is the ground, drawn by the map renderer.
 */
function promenadeRail(variant: number): Sprite {
  const p = painter(1, 24);
  const g = p.g;
  const edges = [0, 3, 1, 2].filter((k) => variant & (1 << k));
  for (const k of edges) {
    const [u0, v0, u1, v1] = EDGES[k].map(inset) as [number, number, number, number];
    const a = p.P(u0, v0, 0);
    const b = p.P(u1, v1, 0);
    g.strokeStyle = '#efe9dc';
    g.lineWidth = 1.2;
    for (const z of [3.2, 6.2]) {
      g.beginPath();
      g.moveTo(a[0], a[1] - z);
      g.lineTo(b[0], b[1] - z);
      g.stroke();
    }
    g.lineWidth = 1.6;
    for (const t of [0, 0.5, 1]) {
      const x = a[0] + (b[0] - a[0]) * t;
      const y = a[1] + (b[1] - a[1]) * t;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y - 6.6);
      g.stroke();
    }
  }
  if (variant & 16 && edges.length) {
    const [u0, v0, u1, v1] = EDGES[edges[0]].map(inset) as [number, number, number, number];
    lamp(p, (u0 + u1) / 2, (v0 + v1) / 2);
  }
  return done(p);
}

/** Fishing pier: a wooden jetty across the lot to the water edge `dir` (an index of `EDGES`), with pilings, crates and a moored boat. */
function fishingPier(dir: number): Sprite {
  const p = painter(1, 26);
  const g = p.g;
  const [eu0, ev0, eu1, ev1] = EDGES[dir];
  const du = inset((eu0 + eu1) / 2) - 0.5;
  const dv = inset((ev0 + ev1) / 2) - 0.5;
  const alongU = Math.abs(du) > Math.abs(dv);
  // The deck runs the whole lot, from the dry side to the water; `at` is a point on its axis (-1 dry end, 1 water end).
  const at = (t: number): [number, number] => [0.5 + du * t, 0.5 + dv * t];
  const half = 0.13;
  const [u0, u1] = alongU ? [0.5 - Math.abs(du), 0.5 + Math.abs(du)] : [0.5 - half, 0.5 + half];
  const [v0, v1] = alongU ? [0.5 - half, 0.5 + half] : [0.5 - Math.abs(dv), 0.5 + Math.abs(dv)];
  for (const t of [-0.8, -0.27, 0.27, 0.8]) {
    const [pu, pv] = at(t);
    const [ou, ov] = alongU ? [0, 0.15] : [0.15, 0];
    p.box(pu - 0.05 - ou, pv - 0.05 - ov, pu + 0.05 - ou, pv + 0.05 - ov, 0, 5, '#4a2f1a', false);
    p.box(pu - 0.05 + ou, pv - 0.05 + ov, pu + 0.05 + ou, pv + 0.05 + ov, 0, 5, '#4a2f1a', false);
  }
  p.box(u0, v0, u1, v1, 5, 1.8, '#b5824a');
  g.strokeStyle = '#7a5530';
  g.lineWidth = 0.6;
  for (let k = 1; k < 8; k++) {
    const t = k / 8;
    const a = alongU ? p.P(u0 + (u1 - u0) * t, v0, 6.8) : p.P(u0, v0 + (v1 - v0) * t, 6.8);
    const b = alongU ? p.P(u0 + (u1 - u0) * t, v1, 6.8) : p.P(u1, v0 + (v1 - v0) * t, 6.8);
    g.beginPath();
    g.moveTo(a[0], a[1]);
    g.lineTo(b[0], b[1]);
    g.stroke();
  }
  // Crates at the dry end and a rowing boat tied up beside the water end.
  const [cu, cv] = at(-0.75);
  p.box(cu - 0.09, cv - 0.09, cu + 0.09, cv + 0.09, 6.8, 4.5, '#c9a45a');
  const [bu, bv] = at(0.45);
  const [bx, by] = p.P(bu - dv * 1.05, bv + du * 1.05, 2);
  g.beginPath();
  g.moveTo(bx - 9, by - 4);
  g.quadraticCurveTo(bx, by + 6, bx + 9, by - 4);
  g.closePath();
  g.fillStyle = '#c8462f';
  g.fill();
  g.strokeStyle = '#5a1a14';
  g.lineWidth = 0.8;
  g.stroke();
  g.strokeStyle = '#f4f0e6';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(bx - 7.5, by - 3);
  g.quadraticCurveTo(bx, by + 4.2, bx + 7.5, by - 3);
  g.stroke();
  g.strokeStyle = '#6b4a2e';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(bx, by - 2);
  g.lineTo(bx, by - 13);
  g.stroke();
  g.fillStyle = '#f4f0e6';
  g.beginPath();
  g.moveTo(bx, by - 13);
  g.lineTo(bx + 6, by - 7);
  g.lineTo(bx, by - 5);
  g.closePath();
  g.fill();
  return done(p);
}

/** Cargo port: a quay with stacked containers and a gantry crane. */
function port(): Sprite {
  const p = painter(1, 58);
  p.box(0.02, 0.02, 0.98, 0.98, 0, 3, '#aaa293', false);
  const stack = (u0: number, v0: number, u1: number, v1: number, colors: string[]) => {
    colors.forEach((c, k) => p.box(u0, v0, u1, v1, 3 + k * 5.2, 5.2, c));
  };
  stack(0.08, 0.58, 0.46, 0.92, ['#c8462f', '#3f6f9f']);
  stack(0.54, 0.6, 0.92, 0.92, ['#e0a526', '#2f9a55', '#c8462f']);
  stack(0.55, 0.28, 0.9, 0.5, ['#3f6f9f']);
  // Gantry crane: two legs, a beam along u, a cab and a hanging spreader.
  p.box(0.07, 0.1, 0.15, 0.18, 3, 38, '#e0a526');
  p.box(0.83, 0.1, 0.91, 0.18, 3, 38, '#e0a526');
  p.box(0.05, 0.08, 0.93, 0.2, 41, 3.4, '#e0a526');
  p.box(0.42, 0.06, 0.62, 0.22, 44.4, 6, '#c8462f');
  p.right(0.62, 0.08, 0.2, 46, 49, PAL.glassDark);
  const g = p.g;
  const [cx, cy] = p.P(0.52, 0.14, 41);
  g.strokeStyle = '#3a2a20';
  g.lineWidth = 0.8;
  g.beginPath();
  g.moveTo(cx - 2, cy);
  g.lineTo(cx - 2, cy + 12);
  g.moveTo(cx + 2, cy);
  g.lineTo(cx + 2, cy + 12);
  g.stroke();
  p.box(0.44, 0.1, 0.6, 0.18, 29, 3, '#3a2a20', false);
  return done(p);
}

function umbrella(p: Painter, u: number, v: number, color: string): void {
  const g = p.g;
  const [x, y] = p.P(u, v, 0);
  g.fillStyle = '#6b4a2e';
  g.fillRect(x - 0.6, y - 14, 1.2, 14);
  const rx = 7.5;
  const ry = 3.4;
  const cy = y - 11;
  const wedges = 6;
  for (let k = 0; k < wedges; k++) {
    const a0 = Math.PI * (k / wedges);
    const a1 = Math.PI * ((k + 1) / wedges);
    g.beginPath();
    g.moveTo(x, cy - 4.5);
    g.lineTo(x - Math.cos(a0) * rx, cy + Math.sin(a0) * ry);
    g.lineTo(x - Math.cos(a1) * rx, cy + Math.sin(a1) * ry);
    g.closePath();
    g.fillStyle = k % 2 ? '#f4f0e6' : color;
    g.fill();
  }
}

/** Beach resort: a thatched bar with an awning, umbrellas and sun loungers on the sand. */
function resort(): Sprite {
  const p = painter(1, 38);
  p.box(0.5, 0.08, 0.92, 0.46, 0, 9, '#f1e3c6');
  p.left(0.46, 0.56, 0.86, 2, 7.5, PAL.glassDark);
  p.hipRoof(0.46, 0.04, 0.96, 0.5, 9, 5.5, '#c9a45a');
  p.awning(0.46, 0.5, 0.92, 8.6, '#e0453a', '#f4f0e6', 5);
  p.box(0.12, 0.62, 0.3, 0.74, 0, 1.4, '#f4f0e6');
  p.box(0.55, 0.7, 0.73, 0.82, 0, 1.4, '#f4f0e6');
  umbrella(p, 0.22, 0.38, '#e0453a');
  umbrella(p, 0.3, 0.78, '#3f8fe0');
  umbrella(p, 0.68, 0.64, '#e0b542');
  return done(p);
}

/** Lighthouse: a tapered tower banded red and white, a gallery and a lit lantern under a red cap. */
function lighthouse(): Sprite {
  const p = painter(1, 100);
  const g = p.g;
  p.box(0.18, 0.18, 0.82, 0.82, 0, 3, '#aaa293', false);
  const bands = 5;
  const bandH = 13;
  for (let k = 0; k < bands; k++) {
    p.cylinder(0.5, 0.5, 0.27 - k * 0.018, 3 + k * bandH, bandH, k % 2 ? '#c8392f' : '#f4f0e6');
  }
  const top = 3 + bands * bandH;
  p.cylinder(0.5, 0.5, 0.27, top, 3, '#4a4650');
  const [lx, ly] = p.P(0.5, 0.5, top + 3);
  const glow = g.createRadialGradient(lx, ly - 5, 1, lx, ly - 5, 20);
  glow.addColorStop(0, 'rgba(255,230,120,0.55)');
  glow.addColorStop(1, 'rgba(255,230,120,0)');
  g.fillStyle = glow;
  g.fillRect(lx - 22, ly - 28, 44, 46);
  p.cylinder(0.5, 0.5, 0.14, top + 3, 9, '#ffd84a');
  const [cx, cy] = p.P(0.5, 0.5, top + 12);
  g.beginPath();
  g.moveTo(cx - 6.4, cy);
  g.lineTo(cx, cy - 10);
  g.lineTo(cx + 6.4, cy);
  g.closePath();
  g.fillStyle = '#c8392f';
  g.fill();
  g.strokeStyle = shade('#c8392f', 0.5);
  g.lineWidth = 0.6;
  g.stroke();
  return done(p);
}

/**
 * Sprite of a coast building. `variant` is the mask of the water edges of the lot (see `EDGES`) for
 * the promenade (plus bit 16 for a lamp) and the index of the edge the jetty runs to for the fishing pier.
 */
export function coastSprite(kind: CoastKind, variant = 0): Sprite {
  switch (kind) {
    case 'promenade':
      return cached(`coast:promenade:${variant}`, () => promenadeRail(variant));
    case 'fishing':
      return cached(`coast:fishing:${variant}`, () => fishingPier(variant));
    case 'port':
      return cached('coast:port', port);
    case 'resort':
      return cached('coast:resort', resort);
    case 'lighthouse':
      return cached('coast:lighthouse', lighthouse);
  }
}

/** Same building, emptied: darker, washed out, with boarded windows. */
function abandonedOf(base: Sprite): Sprite {
  const c = makeCanvas(base.canvas.width, base.canvas.height);
  const g = c.getContext('2d')!;
  g.filter = 'grayscale(0.75) brightness(0.72) sepia(0.25)';
  g.drawImage(base.canvas, 0, 0);
  g.filter = 'none';
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(70,52,38,0.28)';
  g.fillRect(0, 0, c.width, c.height);
  // A few planks across the facade.
  g.strokeStyle = '#7a5a3a';
  g.lineWidth = 1;
  for (let k = 0; k < 3; k++) {
    const y = base.ay + 4 - k * 7;
    g.beginPath();
    g.moveTo(base.ax - 10 + k * 3, y);
    g.lineTo(base.ax - 3 + k * 3, y + 4);
    g.stroke();
  }
  return { canvas: c, ax: base.ax, ay: base.ay, smoke: [] };
}

const cache = new Map<string, Sprite>();

function cached(key: string, make: () => Sprite): Sprite {
  let s = cache.get(key);
  if (!s) {
    s = make();
    cache.set(key, s);
  }
  return s;
}

/** Number of visual variants kept per building type (variant bytes are folded into this range). */
const VARIANTS = 8;

export function buildingSprite(zone: ZoneKind, level: number, variant: number): Sprite {
  const v = variant % VARIANTS;
  return cached(`${zone}${level}:${v}`, () =>
    zone === 'R' ? residential(level, v * 7 + 3) : zone === 'C' ? commercial(level, v * 5 + 1) : industrial(level, v),
  );
}

export function abandonedBuildingSprite(zone: ZoneKind, level: number, variant: number): Sprite {
  const v = variant % VARIANTS;
  return cached(`x${zone}${level}:${v}`, () => abandonedOf(buildingSprite(zone, level, variant)));
}

export function burningBuildingSprite(zone: ZoneKind, level: number, variant: number): Sprite {
  const v = variant % VARIANTS;
  return cached(`f${zone}${level}:${v}`, () => burningOf(buildingSprite(zone, level, variant)));
}

const SERVICE_SPRITES: Record<ServiceKind, () => Sprite> = { school, clinic, police, fire: firehouse };

export function serviceSprite(kind: ServiceKind): Sprite {
  return cached(`svc:${kind}`, SERVICE_SPRITES[kind]);
}

const PLANT_SPRITES: Record<PlantKind, () => Sprite> = { coal: plant, gas: gasPlant, wind: windFarm };

export function plantSprite(kind: PlantKind = 'coal'): Sprite {
  return cached(`plant:${kind}`, PLANT_SPRITES[kind]);
}

export function treeSpriteFor(kind: number, variant: number): Sprite {
  return cached(`tree${kind}:${variant % 6}`, () => treeSprite(kind, variant % 6));
}

export function parkSpriteFor(variant: number): Sprite {
  return cached(`park:${variant % 6}`, () => parkSprite(variant % 6));
}

export function poleSpriteFor(): Sprite {
  return cached('pole', poleSprite);
}

/** Kilometre sign of the provincial route: a green panel with the route number, 226, on a post. */
function routeSignSprite(dvx: number, dvy: number): Sprite {
  const p = painter(1, 26);
  // The post stands near the edge of the cell that faces the inside of the map.
  const [x, y] = p.P(0.5 + 0.34 * dvx, 0.5 + 0.34 * dvy, 0);
  const g = p.g;
  g.fillStyle = '#8a8d90';
  g.fillRect(Math.round(x) - 0.5, y - 12, 1.2, 12);
  g.fillStyle = '#ffffff';
  g.fillRect(Math.round(x) - 9.5, y - 22, 19, 10);
  g.fillStyle = '#1f6b43';
  g.fillRect(Math.round(x) - 8.5, y - 21, 17, 8);
  g.fillStyle = '#ffffff';
  g.font = 'bold 7px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('226', Math.round(x), y - 16.5);
  return done(p);
}

/** The route sign for a view direction (-1, 0, 1 on each axis) pointing from the cell to its inner edge. */
export function routeSignSpriteFor(dvx: number, dvy: number): Sprite {
  return cached(`rp:${dvx},${dvy}`, () => routeSignSprite(dvx, dvy));
}
