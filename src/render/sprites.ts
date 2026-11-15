import { PAL, shade } from './color';
import { BUS_COLORS, type CoastKind, type HubKind, type PlantKind, type ServiceKind } from '../config';
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

  /**
   * A tree, in the same language as the buildings: flat facets, the same three values of light and
   * the same thin dark edge. The crown is a ring of faces around an apex, never an ellipse, and the
   * trunk is drawn in whole pixels with a lit side and a shaded one.
   */
  tree(u: number, v: number, kind: number, scale = 1): void {
    const s = scale;
    if (kind === 4) {
      // Eucalipto: tall and narrow.
      this.post(u, v, 8 * s, TREE.trunkLight);
      this.crown(u, v, 0.17 * s, 0.12 * s, 6 * s, 10 * s, TREE.eucalyptus);
      this.crown(u - 0.05 * s, v - 0.03 * s, 0.12 * s, 0.09 * s, 13 * s, 7 * s, TREE.eucalyptus);
      return;
    }
    if (kind === 2) {
      // Palo borracho: the swollen green trunk is the tree, crowned by its flowers.
      this.post(u, v, 3 * s, TREE.paloTrunk);
      this.crown(u, v, 0.07 * s, 0.05 * s, 1.5 * s, 5.5 * s, TREE.paloTrunk);
      this.crown(u, v, 0.19 * s, 0.15 * s, 6.5 * s, 5 * s, TREE.palo);
      this.crown(u - 0.06 * s, v - 0.05 * s, 0.09 * s, 0.07 * s, 8 * s, 3 * s, TREE.palo);
      return;
    }
    this.post(u, v, 5 * s, TREE.trunk);
    if (kind === 3) {
      // Ombú: wide dark crown.
      this.crown(u, v, 0.32 * s, 0.26 * s, 4 * s, 8 * s, TREE.ombu);
      this.crown(u - 0.07 * s, v - 0.05 * s, 0.18 * s, 0.15 * s, 8 * s, 5 * s, TREE.ombu);
    } else {
      // Jacarandá: lilac crown, muted so it sits with the rest of the map.
      this.crown(u, v, 0.28 * s, 0.23 * s, 4 * s, 7 * s, TREE.jacaranda);
      this.crown(u - 0.06 * s, v - 0.05 * s, 0.16 * s, 0.13 * s, 7 * s, 4.5 * s, TREE.jacaranda);
    }
  }

  /**
   * A faceted crown: three rings and eight faces per band, so the silhouette has shoulders and
   * reads as a crown instead of a cone. Each face is lit by the side it looks at, the way the walls
   * are (a face turned to +v is lighter than one turned to +u) and the upper bands are brighter.
   */
  crown(cu: number, cv: number, ru: number, rv: number, z: number, h: number, color: string): void {
    const P = this.P.bind(this);
    const edge = shade(color, 0.58);
    const faces = 8;
    /** Height (0 at the base, 1 at the apex) and radius of each ring. The middle one is the widest. */
    const rings: [number, number][] = [
      [0, 0.78],
      [0.42, 1],
      [0.82, 0.5],
    ];
    const ring = (k: number, t: number, scale: number): Pt => {
      const a = (k / faces) * Math.PI * 2;
      return P(cu + Math.cos(a) * ru * scale, cv + Math.sin(a) * rv * scale, z + h * t);
    };
    for (let band = 0; band < rings.length; band++) {
      const [t0, s0] = rings[band];
      const above = rings[band + 1];
      const [t1, s1] = above ?? [1, 0];
      for (let k = 0; k < faces; k++) {
        const a = ((k + 0.5) / faces) * Math.PI * 2;
        // -1 for the face turned away from the light, +1 for the one turned towards it.
        const facing = -(Math.cos(a) + Math.sin(a)) / 2;
        const fill = shade(color, 0.86 + 0.2 * facing + 0.08 * band);
        const low = [ring(k, t0, s0), ring(k + 1, t0, s0)];
        if (above) this.poly([...low, ring(k + 1, t1, s1), ring(k, t1, s1)], fill, edge);
        else this.poly([...low, P(cu, cv, z + h)], fill, edge);
      }
    }
  }

  /** A trunk: whole pixels, one lit column and one in shadow, like the two visible walls of a box. */
  post(cu: number, cv: number, h: number, color: string): void {
    const [x, y] = this.P(cu, cv, 0);
    const bx = Math.round(x);
    const by = Math.round(y);
    const tall = Math.max(2, Math.round(h));
    this.g.fillStyle = shade(color, 1.06);
    this.g.fillRect(bx - 2, by - tall, 1, tall);
    this.g.fillStyle = color;
    this.g.fillRect(bx - 1, by - tall, 1, tall);
    this.g.fillStyle = shade(color, 0.68);
    this.g.fillRect(bx, by - tall, 1, tall);
  }

  /** A park bench: a seat and its back, built like a tiny box so it sits on the ground like the rest. */
  bench(cu: number, cv: number): void {
    this.box(cu - 0.07, cv - 0.025, cu + 0.07, cv + 0.025, 0, 1.4, BENCH);
    this.box(cu - 0.07, cv - 0.03, cu + 0.07, cv - 0.015, 1.4, 1.3, shade(BENCH, 1.12));
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

/** Trees and plazas: the greens of the terrain, one muted lilac and one muted pink. */
const TREE = {
  trunk: '#6b4a2e',
  trunkLight: '#b3a78c',
  jacaranda: '#8c7fae',
  ombu: '#436e3a',
  palo: '#c98ba8',
  paloTrunk: '#7f9a6a',
  eucalyptus: '#7d9464',
} as const;

const BENCH = '#8a6a45';

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
    // Humble house: bare brick, a tin roof held down with stones, a door, a window and a stovepipe.
    const p = painter(1, 22);
    const brick = v % 2 ? PAL.brick : PAL.brickDark;
    p.box(0.22, 0.28, 0.78, 0.72, 0, 7, brick);
    p.left(0.72, 0.4, 0.55, 0, 5, PAL.door);
    p.right(0.78, 0.38, 0.6, 2, 5, PAL.glassDark);
    p.gableRoof(0.18, 0.24, 0.82, 0.76, 7, 4, v % 3 === 0 ? PAL.chapaRust : PAL.chapa, brick);
    p.box(0.6, 0.36, 0.65, 0.41, 9, 5, '#6d6f72', false);
    return done(p);
  }
  if (level === 2) {
    const p = painter(1, 24);
    if (v % 3 === 0) p.tree(0.15, 0.85, 1 + ((v >> 2) % 4), 0.75);
    p.box(0.25, 0.25, 0.75, 0.75, 0, 8, wall);
    p.left(0.75, 0.42, 0.55, 0, 6, PAL.door);
    p.right(0.75, 0.38, 0.6, 3, 6, PAL.glass);
    p.hipRoof(0.2, 0.2, 0.8, 0.8, 8, 7, roof);
    return done(p);
  }
  if (level === 3) {
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
  if (level === 4) {
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
    const p = painter(1, 22);
    if (v % 2 === 0) {
      // Greengrocer: an open front with a striped awning and crates of fruit and vegetables on the pavement.
      p.box(0.24, 0.24, 0.76, 0.66, 0, 9, WALLS[(v >> 2) % WALLS.length]);
      p.left(0.66, 0.3, 0.7, 1, 6, PAL.glassDark);
      p.awning(0.66, 0.24, 0.76, 8, '#2f7f4f', '#f4ece0', 4);
      for (const [u, c] of [[0.3, '#c8392f'], [0.44, '#e08a2f'], [0.58, '#5f9a3f']] as const) p.box(u, 0.7, u + 0.1, 0.8, 0, 3, c);
    } else {
      // Kiosk: a tiny box with a big service window, a striped awning and a sign on top.
      p.box(0.32, 0.32, 0.68, 0.68, 0, 9, WALLS[(v >> 2) % WALLS.length]);
      p.left(0.68, 0.37, 0.63, 2, 6, PAL.glass);
      p.awning(0.68, 0.32, 0.68, 8, a1, a2, 3);
      p.box(0.36, 0.36, 0.64, 0.4, 9, 3, a1, false);
    }
    return done(p);
  }
  if (level === 2) {
    const p = painter(1, 24);
    const wall = WALLS[(v >> 2) % WALLS.length];
    p.box(0.3, 0.3, 0.7, 0.7, 0, 9, wall);
    p.left(0.7, 0.36, 0.64, 1, 6, PAL.glass);
    p.awning(0.7, 0.3, 0.7, 8, a1, a2, 3);
    p.box(0.3, 0.3, 0.7, 0.7, 9, 2, a1, false);
    return done(p);
  }
  if (level === 3) {
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
  if (level === 4) {
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
    // A tin shed: corrugated sheet walls and roof, a wide dark door and a drum by the corner.
    const p = painter(1, 22);
    const sheet = v % 2 ? PAL.chapa : '#a8a398';
    p.box(0.14, 0.2, 0.86, 0.8, 0, 9, sheet);
    for (let u = 0.2; u < 0.86; u += 0.08) p.left(0.8, u, u + 0.02, 0, 9, shade(sheet, 0.8));
    p.left(0.8, 0.3, 0.7, 0, 7, '#3d3f42');
    p.gableRoof(0.1, 0.16, 0.9, 0.84, 9, 4, shade(sheet, 0.88), sheet);
    p.cylinder(0.9, 0.9, 0.07, 0, 5, PAL.brick);
    return done(p);
  }
  if (level === 2) {
    const p = painter(1, 24);
    p.box(0.12, 0.15, 0.88, 0.85, 0, 10, PAL.brick);
    p.left(0.85, 0.25, 0.65, 0, 7, '#6d6f72');
    for (let z = 1; z < 7; z += 2) p.left(0.85, 0.25, 0.65, z, z + 0.5, '#55575a');
    p.gableRoof(0.1, 0.12, 0.9, 0.88, 10, 5, PAL.chapa, PAL.brick);
    return done(p);
  }
  if (level === 3) {
    const p = painter(1, 28);
    const wall = v % 2 ? '#a9b4b8' : PAL.brick;
    p.box(0.06, 0.1, 0.94, 0.9, 0, 11, wall);
    p.left(0.9, 0.55, 0.85, 0, 8, '#5d6064');
    p.right(0.94, 0.3, 0.7, 4, 7, PAL.glassDark);
    p.gableRoof(0.04, 0.08, 0.96, 0.92, 11, 6, '#b7bfc2', wall);
    return done(p);
  }
  if (level === 4) {
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

/** A bus depot, painted in the colour of its line: a bus parked on a slab beside a little booth under a canopy of the same colour. */
function busDepot(color: number): Sprite {
  const body = BUS_COLORS[color].hex;
  const p = painter(1, 22);
  p.box(0.06, 0.06, 0.94, 0.94, 0, 1.5, '#a9a8ae', false);
  // The booth, with its canopy in the line's colour.
  p.box(0.62, 0.1, 0.9, 0.4, 1.5, 8, '#e8e4dc');
  p.left(0.4, 0.68, 0.84, 3.5, 7, PAL.glass);
  p.box(0.58, 0.06, 0.94, 0.44, 9.5, 2, body);
  // The bus: a long body along u with a row of windows, a lighter roof and its wheels.
  p.box(0.1, 0.52, 0.66, 0.88, 1.5, 8, body);
  p.left(0.88, 0.14, 0.62, 5, 8, PAL.glassDark);
  p.right(0.66, 0.56, 0.84, 5, 8, PAL.glassDark);
  p.left(0.88, 0.14, 0.62, 1.5, 2.6, shade(body, 0.55));
  p.box(0.1, 0.52, 0.66, 0.88, 9.5, 0.8, shade(body, 1.25), false);
  for (const u of [0.2, 0.52]) p.box(u, 0.86, u + 0.1, 0.94, 1.5, 2.2, '#1f1611', false);
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
  // Kept near the middle of the diamond: a crown reaches about 5 px sideways and the canvas is 36.
  const spots: [number, number][] = [
    [0.3, 0.36],
    [0.6, 0.62],
    [0.36, 0.72],
  ];
  const count = 1 + (v % 3);
  for (let k = 0; k < count; k++) {
    const [u, w] = spots[(k + v) % 3];
    p.tree(u, w, k === 2 && kind !== 4 ? ((kind % 4) + 1) : kind, 0.9 + 0.1 * ((v + k) % 3));
  }
  return done(p);
}

/** What stands on a plaza cell: a kept one with its tree, a kept one left bare, or a neglected one. */
export type ParkLook = 'tree' | 'bare' | 'neglected';

function parkSprite(v: number, look: ParkLook): Sprite {
  const p = painter(1, 30);
  const kind = v % 3;
  // The tree sits at the far corner of the diamond, where it does not cover the plaza itself; the
  // cells a block leaves bare get a bench there instead, so a plaza never reads as empty ground.
  if (look === 'tree') p.tree(0.1, 0.6, 1 + ((v >> 2) % 3));
  else if (kind !== 1) p.bench(0.14, 0.46);
  if (kind === 0) {
    // A monument: stone base and a bronze bust, no taller than a two-storey house.
    p.box(0.5, 0.5, 0.74, 0.74, 0, 2.5, '#d8d2c4', false);
    p.box(0.56, 0.56, 0.68, 0.68, 2.5, 4, '#7d6a45');
    p.box(0.58, 0.58, 0.66, 0.66, 6.5, 2.5, '#9a8355');
  } else if (kind === 1) {
    // A faceted basin with the water of the game inside.
    p.box(0.46, 0.5, 0.82, 0.86, 0, 1.5, '#d8d2c4', false);
    p.poly([p.P(0.53, 0.57, 1.6), p.P(0.75, 0.57, 1.6), p.P(0.75, 0.79, 1.6), p.P(0.53, 0.79, 1.6)], PAL.water, shade(PAL.water, 0.7));
    p.bench(0.18, 0.7);
  } else {
    // Glorieta (bandstand).
    for (const [u, w] of [
      [0.52, 0.56],
      [0.78, 0.56],
      [0.52, 0.82],
      [0.78, 0.82],
    ])
      p.post(u, w, 6, '#efe9dc');
    p.box(0.46, 0.5, 0.84, 0.88, 0, 1, '#d8d2c4', false);
    p.hipRoof(0.44, 0.48, 0.86, 0.9, 6, 5, '#4a6f45');
  }
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

// ---------------------------------------------------------------- airports and harbours

/** A painter for a footprint of `vw`×`vh` cells in view space and `height` px above the ground. */
function rectPainter(vw: number, vh: number, height: number): Painter {
  const w = 16 * (vw + vh) + 4;
  const h = 8 * (vw + vh) + height + 4;
  return new Painter(makeCanvas(w, h), 16 * vh + 2, height + 2);
}

/** A piece of a drawing and where it goes in the back-to-front order. */
interface Op {
  key: number;
  run: () => void;
}

const inOrder = (ops: Op[]): void => {
  ops.sort((a, b) => a.key - b.key);
  for (const o of ops) o.run();
};

/**
 * An airport piece (3×2 lots) in the colours of the rest of the city. The drawing is made along the
 * runway, so it holds for a map seen from any side: `vw`×`vh` is the footprint in view space and the
 * long side is the runway. Level 1 is a hangar with a little plane, 2 an aerodrome with a terminal and a
 * tower, 3 an international airport with a long glass terminal, jet bridges and an airliner.
 */
function airportArt(level: number, vw: number, vh: number): Sprite {
  const p = rectPainter(vw, vh, level === 1 ? 24 : level === 2 ? 36 : 48);
  const alongU = vw >= vh;
  const L = Math.max(vw, vh);
  const W = Math.min(vw, vh);
  const uv = (a: number, c: number): [number, number] => (alongU ? [a, c] : [c, a]);
  const ops: Op[] = [];
  const put = (key: number, run: () => void) => ops.push({ key, run });
  /** A footprint given along the runway (a) and across it (c), as view-space u0, v0, u1, v1. */
  const norm = (a0: number, c0: number, a1: number, c1: number): [number, number, number, number] => {
    const [u0, v0] = uv(a0, c0);
    const [u1, v1] = uv(a1, c1);
    return [Math.min(u0, u1), Math.min(v0, v1), Math.max(u0, u1), Math.max(v0, v1)];
  };
  const box = (a0: number, c0: number, a1: number, c1: number, z0: number, h: number, color: string, outline = true, key?: number) => {
    const [u0, v0, u1, v1] = norm(a0, c0, a1, c1);
    put(key ?? (u0 + u1 + v0 + v1) / 2 + z0 * 0.01, () => p.box(u0, v0, u1, v1, z0, h, color, outline));
  };
  /** A building: walls, a row of windows per floor and a hip roof with a small overhang. */
  const house = (a0: number, c0: number, a1: number, c1: number, z0: number, h: number, wall: string, roof: string, rh: number, floorH = 0, cols = 3) => {
    const [u0, v0, u1, v1] = norm(a0, c0, a1, c1);
    put((u0 + u1 + v0 + v1) / 2 + z0 * 0.01, () => {
      p.box(u0, v0, u1, v1, z0, h, wall);
      if (floorH > 0) p.windows(u0, v0, u1, v1, z0 + 2, z0 + h - 0.5, floorH, PAL.glassDark, cols, 2.4);
      p.hipRoof(u0 - 0.04, v0 - 0.04, u1 + 0.04, v1 + 0.04, z0 + h, rh, roof);
    });
  };
  const flat = (pts: [number, number][], z: number, fill: string) =>
    put(-1 + z * 0.001, () =>
      p.poly(
        pts.map(([a, c]) => {
          const [u, v] = uv(a, c);
          return p.P(u, v, z);
        }),
        fill,
      ),
    );
  /** A plane parked with its nose along the runway: a body, its wings, a tail fin and a dark cockpit. */
  const plane = (a: number, c: number, s: number, body: string, wing: string) => {
    box(a - 0.32 * s, c - 0.055 * s, a + 0.32 * s, c + 0.055 * s, 1.2, 3.4 * s, body);
    box(a - 0.05 * s, c - 0.34 * s, a + 0.1 * s, c + 0.34 * s, 1.2 + 1.2 * s, 0.9 * s, wing, false);
    box(a - 0.34 * s, c - 0.02 * s, a - 0.22 * s, c + 0.02 * s, 1.2 + 2.2 * s, 3 * s, shade(body, 0.8), false);
    box(a + 0.24 * s, c - 0.045 * s, a + 0.3 * s, c + 0.045 * s, 1.2 + 2.2 * s, 0.9 * s, PAL.glassDark, false);
  };
  const drum = (a: number, c: number, color: string) => {
    const [u, v] = uv(a, c);
    put(u + v + 0.02, () => p.cylinder(u, v, 0.06, 1.2, 3, color));
  };
  const lamp = (a: number, c: number) => {
    const [u, v] = uv(a, c);
    put(u + v + 0.02, () => {
      p.post(u, v, 7, '#4a4440');
      const [x, y] = p.P(u, v, 7);
      p.g.fillStyle = '#f6d86a';
      p.g.fillRect(Math.round(x) - 2, y - 1, 3, 1);
    });
  };
  const tree = (a: number, c: number, kind: number) => {
    const [u, v] = uv(a, c);
    put(u + v + 0.02, () => p.tree(u, v, kind, 0.8));
  };
  /** The wind sock: a mast with an orange and white sleeve. */
  const sock = (a: number, c: number) => {
    const [u, v] = uv(a, c);
    put(u + v + 0.02, () => {
      p.post(u, v, 11, '#4a4440');
      const [x, y] = p.P(u, v, 11);
      p.g.fillStyle = '#e8702a';
      p.g.fillRect(Math.round(x), y, 4, 2);
      p.g.fillStyle = '#f4f0e6';
      p.g.fillRect(Math.round(x) + 4, y, 2, 2);
    });
  };
  /** A control tower: a slim shaft, a glazed cab with a roof and an aerial. */
  const tower = (a: number, c: number, shaft: number) => {
    const [u0, v0, u1, v1] = norm(a - 0.15, c - 0.15, a + 0.15, c + 0.15);
    put((u0 + u1 + v0 + v1) / 2 + 0.01, () => {
      p.box(u0, v0, u1, v1, 1.2, shaft, '#d9d4cc');
      p.windows(u0, v0, u1, v1, 4, shaft - 2, 6, PAL.glassDark, 1, 2);
      p.box(u0 - 0.07, v0 - 0.07, u1 + 0.07, v1 + 0.07, 1.2 + shaft, 4, '#6fb7e0');
      p.hipRoof(u0 - 0.1, v0 - 0.1, u1 + 0.1, v1 + 0.1, 5.2 + shaft, 2.2, '#5a5560');
      const [cu, cv] = [(u0 + u1) / 2, (v0 + v1) / 2];
      const [x, y] = p.P(cu, cv, 7.4 + shaft);
      p.g.fillStyle = '#4a4440';
      p.g.fillRect(Math.round(x), y - 7, 1, 7);
    });
  };

  // The apron, the runway with its edge lines and its dashes.
  box(0, 0, L, W, 0, 1.2, '#a9a8ae', false, -2);
  flat([[0, 0.08], [L, 0.08], [L, 0.72], [0, 0.72]], 1.2, '#44444c');
  flat([[0, 0.1], [L, 0.1], [L, 0.12], [0, 0.12]], 1.22, '#d8d4c8');
  flat([[0, 0.68], [L, 0.68], [L, 0.7], [0, 0.7]], 1.22, '#d8d4c8');
  for (let a = 0.2; a < L - 0.3; a += 0.55) flat([[a, 0.37], [a + 0.28, 0.37], [a + 0.28, 0.43], [a, 0.43]], 1.25, '#f4f0e6');

  if (level === 1) {
    // A small hangar with its door to the apron, fuel drums, a wind sock and a little plane.
    house(0.25, 1.2, 1.05, 1.75, 1.2, 5.5, '#c9ccd1', '#7d8a96', 3);
    box(1.0, 1.35, 1.06, 1.6, 1.2, 4.2, '#2a2c30', false);
    drum(1.3, 1.9, '#2f63a6');
    drum(1.45, 1.8, '#c8392f');
    sock(2.7, 1.1);
    tree(0.2, 1.95, 3);
    plane(2.0, 1.45, 1.5, '#f4f0e6', '#c9ccd1');
  } else if (level === 2) {
    // A terminal with a blue stripe and a row of windows, a control tower, a small hangar and two planes.
    house(0.15, 1.05, 1.55, 1.75, 1.2, 8, '#d7d2c8', '#2f63a6', 2.5, 5, 5);
    box(0.7, 1.74, 0.9, 1.78, 1.2, 4, '#5a3d2a', false);
    tower(2.0, 1.35, 15);
    house(2.35, 1.1, 2.9, 1.7, 1.2, 5, '#c9ccd1', '#7d8a96', 2.6);
    lamp(0.1, 1.9);
    lamp(1.6, 1.9);
    sock(2.75, 0.95);
    plane(0.8, 0.4, 1.4, '#f4f0e6', '#c9ccd1');
    plane(2.3, 0.4, 1.2, '#e0a526', '#d9d4cc');
  } else {
    // A long glass terminal with jet bridges, a tall tower, a control hangar and an airliner at the gate.
    house(0.05, 1.0, 2.2, 1.85, 1.2, 10, '#8fb8cc', '#e8e4dc', 2.2, 4.5, 8);
    for (const a of [0.45, 1.1, 1.75]) box(a, 0.8, a + 0.12, 1.0, 4, 3.5, '#c9ccd1', false);
    tower(2.55, 1.4, 26);
    house(2.4, 1.7, 2.9, 1.95, 1.2, 4.5, '#c9ccd1', '#7d8a96', 2.4);
    lamp(0.1, 1.95);
    lamp(1.2, 1.95);
    lamp(2.2, 1.95);
    sock(2.85, 0.95);
    plane(1.3, 0.42, 2.3, '#f4f0e6', '#aeb4ba');
    plane(2.6, 0.4, 1.2, '#6fb7e0', '#d9d4cc');
  }
  inOrder(ops);
  return done(p);
}

/** The sides of a harbour piece, as the direction of the water in view space: +u, +v, -u, -v. */
const SIDES: readonly [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

/**
 * A harbour piece (2×2 lots): a quay with a wooden pier towards the water (`side`, see `SIDES`) and,
 * on the other side, a ticket booth (level 1), a terminal with a tourist office (2) or a cruise terminal
 * with a flag (3). The boats are not in the drawing: they sail (see `Boats`).
 */
function harborArt(level: number, side: number): Sprite {
  const p = rectPainter(2, 2, level === 1 ? 22 : level === 2 ? 30 : 42);
  const [sx, sy] = SIDES[side % 4];
  const ops: Op[] = [];
  const put = (key: number, run: () => void) => ops.push({ key, run });
  const box = (u0: number, v0: number, u1: number, v1: number, z0: number, h: number, color: string, outline = true, key?: number) =>
    put(key ?? (u0 + u1 + v0 + v1) / 2 + z0 * 0.01, () => p.box(u0, v0, u1, v1, z0, h, color, outline));
  /** A building: walls, windows, a hip roof with a small overhang and, optionally, a striped awning on its front. */
  const house = (cu: number, cv: number, half: number, h: number, wall: string, roof: string, rh: number, floorH: number, cols: number, awning?: [string, string]) => {
    const [u0, v0, u1, v1] = [cu - half, cv - half, cu + half, cv + half];
    put(cu + cv + 0.015, () => {
      p.box(u0, v0, u1, v1, 1.5, h, wall);
      if (floorH > 0) p.windows(u0, v0, u1, v1, 3.5, 1.5 + h - 0.5, floorH, PAL.glassDark, cols, 2.4);
      p.left(v1, cu - half * 0.2, cu + half * 0.2, 1.5, 5.5, '#5a3d2a');
      if (awning) p.awning(v1, u0 + half * 0.2, u1 - half * 0.2, 7.5, awning[0], awning[1], 4);
      p.hipRoof(u0 - 0.05, v0 - 0.05, u1 + 0.05, v1 + 0.05, 1.5 + h, rh, roof);
    });
  };
  const barrel = (u: number, v: number, color: string) => put(u + v + 0.02, () => p.cylinder(u, v, 0.06, 1.5, 2.6, color));
  const crate = (u: number, v: number) => box(u - 0.07, v - 0.07, u + 0.07, v + 0.07, 1.5, 2.6, '#b88a52');

  box(0.04, 0.04, 1.96, 1.96, 0, 1.5, PAL.concrete, false, -2);
  // The pier: planks from the middle of the piece out to the water, with rail posts on both edges and a bollard at the end.
  const pu0 = sx === 0 ? 0.8 : sx > 0 ? 1 : 0;
  const pu1 = sx === 0 ? 1.2 : sx > 0 ? 2 : 1;
  const pv0 = sy === 0 ? 0.8 : sy > 0 ? 1 : 0;
  const pv1 = sy === 0 ? 1.2 : sy > 0 ? 2 : 1;
  box(pu0, pv0, pu1, pv1, 1.5, 0.9, '#a9763f', false);
  const lo = sx > 0 || sy > 0 ? 1 : 0;
  for (const t of [0.2, 0.5, 0.8]) {
    for (const e of [0.83, 1.17]) {
      const [pu, pv] = sx !== 0 ? [lo + t, e] : [e, lo + t];
      put(pu + pv + 0.01, () => p.post(pu, pv, 4, '#6b4a2a'));
    }
  }
  const bu = sx > 0 ? 1.9 : sx < 0 ? 0.1 : 1;
  const bv = sy > 0 ? 1.9 : sy < 0 ? 0.1 : 1;
  box(bu - 0.06, bv - 0.06, bu + 0.06, bv + 0.06, 2.4, 2.2, '#2a2c30', false);

  // The building goes to the side away from the water, with the goods and the lamps of a quay around it.
  const cu = 1 - 0.5 * sx;
  const cv = 1 - 0.5 * sy;
  const wall = level === 3 ? '#e8e4dc' : '#f1e3c6';
  if (level === 1) {
    house(cu, cv, 0.26, 6, wall, '#c8392f', 3, 0, 1, ['#f4f0e6', '#c8392f']);
  } else if (level === 2) {
    house(cu, cv, 0.38, 9, wall, '#2f63a6', 3, 5, 3);
    const ou = cu + (sx === 0 ? 0.62 : 0);
    const ov = cv + (sx === 0 ? 0 : 0.62);
    house(ou, ov, 0.14, 5, '#f4f0e6', '#2f7f4f', 2, 0, 1, ['#2f7f4f', '#f4f0e6']);
  } else {
    house(cu, cv, 0.46, 12, wall, '#c8392f', 3.5, 4.5, 4);
    const ou = cu + (sx === 0 ? 0.62 : 0);
    const ov = cv + (sx === 0 ? 0 : 0.62);
    house(ou, ov, 0.13, 5, '#f4f0e6', '#2f63a6', 2, 0, 1, ['#2f63a6', '#f4f0e6']);
    // A flagpole on the terminal, with the national flag.
    put(cu + cv + 5, () => {
      const [x, y] = p.P(cu, cv, 1.5 + 12 + 3.5);
      p.g.fillStyle = '#4a4440';
      p.g.fillRect(Math.round(x), y - 14, 1, 14);
      p.g.fillStyle = '#74acdf';
      p.g.fillRect(Math.round(x) + 1, y - 14, 6, 2);
      p.g.fillStyle = '#f6f2e8';
      p.g.fillRect(Math.round(x) + 1, y - 12, 6, 2);
      p.g.fillStyle = '#74acdf';
      p.g.fillRect(Math.round(x) + 1, y - 10, 6, 2);
    });
  }
  // Goods on the quay: next to the building, away from the pier.
  const gu = sx === 0 ? 0.2 : cu;
  const gv = sx === 0 ? cv : 0.2;
  crate(gu, gv);
  crate(gu + 0.18, gv + 0.04);
  barrel(gu + 0.05, gv + 0.2, '#2f63a6');
  barrel(sx === 0 ? 1.8 : cu, sx === 0 ? cv : 1.8, '#c8392f');
  put(0.2 + 1.8 + 0.01, () => {
    const [u, v] = sx === 0 ? [1.82, cv + 0.3 * (sy > 0 ? -1 : 1)] : [cu + 0.3 * (sx > 0 ? -1 : 1), 1.82];
    p.post(u, v, 8, '#4a4440');
    const [x, y] = p.P(u, v, 8);
    p.g.fillStyle = '#f6d86a';
    p.g.fillRect(Math.round(x) - 2, y - 1, 3, 1);
  });
  inOrder(ops);
  return done(p);
}

/**
 * The sprite of an airport or harbour piece. `vw`×`vh` is its footprint seen from the camera (the
 * airport turns 90° with the view, the harbour is square), `side` the direction of the water for a harbour.
 */
export function hubSprite(kind: HubKind, level: number, vw: number, vh: number, side = 0): Sprite {
  return cached(`hub:${kind}${level}:${vw}x${vh}:${side}`, () => (kind === 'airport' ? airportArt(level, vw, vh) : harborArt(level, side)));
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

/** The depot of a bus line, in the colour (an index into `BUS_COLORS`) of the line. */
export function busDepotSprite(color: number): Sprite {
  return cached(`bus:${color}`, () => busDepot(color));
}

const PLANT_SPRITES: Record<PlantKind, () => Sprite> = { coal: plant, gas: gasPlant, wind: windFarm };

export function plantSprite(kind: PlantKind = 'coal'): Sprite {
  return cached(`plant:${kind}`, PLANT_SPRITES[kind]);
}

export function treeSpriteFor(kind: number, variant: number): Sprite {
  return cached(`tree${kind}:${variant % 6}`, () => treeSprite(kind, variant % 6));
}

export function parkSpriteFor(variant: number, look: ParkLook): Sprite {
  return cached(`park:${variant % 6}:${look}`, () => parkSprite(variant % 6, look));
}

export function poleSpriteFor(): Sprite {
  return cached('pole', poleSprite);
}

/** The digits of the route number, 2 2 6, as rows of a 3x5 font. */
const ROUTE_DIGITS: string[][] = [
  ['111', '001', '111', '100', '111'],
  ['111', '001', '111', '100', '111'],
  ['111', '100', '111', '101', '111'],
];

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
  // The number in whole pixels, a 3x5 font: at this size a text face turns the 6 into something like an 8.
  g.fillStyle = '#ffffff';
  const left = Math.round(x) - 5;
  const top = Math.round(y) - 20;
  ROUTE_DIGITS.forEach((rows, k) => {
    rows.forEach((row, r) => {
      for (let c = 0; c < 3; c++) if (row[c] === '1') g.fillRect(left + k * 4 + c, top + r, 1, 1);
    });
  });
  return done(p);
}

/** The route sign for a view direction (-1, 0, 1 on each axis) pointing from the cell to its inner edge. */
export function routeSignSpriteFor(dvx: number, dvy: number): Sprite {
  return cached(`rp:${dvx},${dvy}`, () => routeSignSprite(dvx, dvy));
}
