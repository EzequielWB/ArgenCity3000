import { PAL, shade } from './color';
import { BUS_COLORS, type CoastKind, type HubKind, type PlantKind, type ServiceKind, type UniqueKind } from '../config';
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

/** Face tone factors: measured on the reference, a cream wall (#f6f2e8) shows its sides at #aaa69c and #918d85. */
const TOP = 1;
const LEFT = 0.69;
const RIGHT = 0.59;

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

  box(u0: number, v0: number, u1: number, v1: number, z0: number, h: number, color: string, outline = false): void {
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
    this.poly([P(u0, v0, z), P(u1, v0, z), apex], shade(color, 0.95));
    this.poly([P(u0, v0, z), P(u0, v1, z), apex], shade(color, 1.05));
    this.poly([P(u0, v1, z), P(u1, v1, z), apex], shade(color, LEFT));
    this.poly([P(u1, v0, z), P(u1, v1, z), apex], shade(color, RIGHT));
  }

  /** Gable roof with the ridge running along u. */
  gableRoof(u0: number, v0: number, u1: number, v1: number, z: number, rh: number, color: string, wall: string): void {
    const P = this.P.bind(this);
    const vm = (v0 + v1) / 2;
    this.poly([P(u0, v0, z), P(u1, v0, z), P(u1, vm, z + rh), P(u0, vm, z + rh)], shade(color, 1.05));
    this.poly([P(u0, v1, z), P(u1, v1, z), P(u1, vm, z + rh), P(u0, vm, z + rh)], shade(color, LEFT));
    this.poly([P(u1, v0, z), P(u1, v1, z), P(u1, vm, z + rh)], shade(wall, RIGHT));
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

/** Trees and plazas: the greens of the terrain, one violet and one pink. */
const TREE = {
  trunk: '#61472d',
  trunkLight: '#b09e6d',
  jacaranda: '#ae8eff',
  ombu: '#46773b',
  palo: '#e87fa8',
  paloTrunk: '#879a72',
  eucalyptus: '#809e89',
} as const;

const BENCH = '#8a6a45';

const WALLS = ['#f6f2e8', '#f4c1a6', '#ccdae4', '#f5dfa3', '#cfe3b8', '#fffce6'];
const ROOFS = ['#c74625', '#a73b1f', '#cb632f', '#944822'];
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

/** Hospital: a tall white block with bands of blue glass, a red cross on its front and a helipad on the roof. */
function hospital(): Sprite {
  const p = painter(1, 44);
  p.box(0.08, 0.08, 0.92, 0.92, 0, 24, '#f4f0e6');
  p.windows(0.08, 0.08, 0.92, 0.92, 4, 23, 5.5, PAL.glass, 4, 2.6);
  p.box(0.08, 0.08, 0.92, 0.92, 24, 1.5, '#d8d2c4', false);
  // The cross on the front wall, over the windows.
  p.left(0.92, 0.45, 0.55, 9, 19, '#d23a32');
  p.left(0.92, 0.36, 0.64, 12.5, 15.5, '#d23a32');
  // The helipad: a dark square with a white H.
  p.box(0.28, 0.28, 0.72, 0.72, 25.5, 0.8, '#4a4c52', false);
  const [x, y] = p.P(0.5, 0.5, 26.3);
  p.g.fillStyle = '#f4f0e6';
  p.g.fillRect(Math.round(x) - 3, y - 4, 1, 6);
  p.g.fillRect(Math.round(x) + 2, y - 4, 1, 6);
  p.g.fillRect(Math.round(x) - 3, y - 1.5, 6, 1);
  return done(p);
}

/** University: a long brick building with a white portico and a clock tower at the corner. */
function university(): Sprite {
  const p = painter(1, 42);
  p.box(0.06, 0.18, 0.94, 0.94, 0, 13, '#b4532f');
  p.windows(0.06, 0.18, 0.94, 0.94, 4, 12, 5, PAL.glass, 5, 3);
  p.box(0.06, 0.18, 0.94, 0.94, 13, 1.5, '#8a8d90', false);
  // The portico: white columns along the front wall.
  for (const u of [0.22, 0.38, 0.54, 0.7]) p.post(u, 0.97, 9, '#f4f0e6');
  p.left(0.94, 0.16, 0.76, 9.5, 11, '#f4f0e6');
  // The clock tower on the corner, with its pointed roof and its clock.
  p.box(0.68, 0.68, 0.92, 0.92, 14.5, 12, '#d9a27a');
  p.left(0.92, 0.76, 0.84, 22, 25, '#f4f0e6');
  p.hipRoof(0.66, 0.66, 0.94, 0.94, 26.5, 6, '#6b6f78');
  return done(p);
}

const SERVICE_SPRITES: Record<ServiceKind, () => Sprite> = { school, clinic, police, fire: firehouse, hospital, university };

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

// ---------------------------------------------------------------- unique buildings

/**
 * A footprint painter that works along the long side of the monument, whatever side the camera is on:
 * `norm` takes lengths along the monument (a) and across it (c) and returns view-space u0, v0, u1, v1.
 */
function longPainter(vw: number, vh: number, height: number) {
  const p = rectPainter(vw, vh, height);
  const alongU = vw >= vh;
  const L = Math.max(vw, vh);
  const W = Math.min(vw, vh);
  const norm = (a0: number, c0: number, a1: number, c1: number): [number, number, number, number] => {
    const [u0, v0] = alongU ? [a0, c0] : [c0, a0];
    const [u1, v1] = alongU ? [a1, c1] : [c1, a1];
    return [Math.min(u0, u1), Math.min(v0, v1), Math.max(u0, u1), Math.max(v0, v1)];
  };
  const box = (a0: number, c0: number, a1: number, c1: number, z0: number, h: number, color: string, outline = true) => {
    const [u0, v0, u1, v1] = norm(a0, c0, a1, c1);
    p.box(u0, v0, u1, v1, z0, h, color, outline);
  };
  /** A point given along the monument (a) and across it (c), in view coordinates: for posts and trees. */
  const uv = (a: number, c: number): [number, number] => (alongU ? [a, c] : [c, a]);
  return { p, alongU, L, W, norm, uv, box };
}

/** The obelisco (2×2): the plaza, the straight shaft and the sharp cap of the one on Corrientes. */
function obeliscoArt(vw: number, vh: number): Sprite {
  const p = rectPainter(vw, vh, 116);
  const cx = vw / 2;
  const cy = vh / 2;
  // The plaza of the República: two stone steps.
  p.box(0.02, 0.02, vw - 0.02, vh - 0.02, 0, 1.2, '#cfc8bb', false);
  p.box(0.34, 0.34, vw - 0.34, vh - 0.34, 1.2, 1.6, '#beb7a9');
  // The four lamps of the plaza go in the order the camera meets them: the back one first, or it
  // lands on top of the shaft, which stands in the middle of the lot.
  const lamp = (u: number, v: number) => {
    p.post(u, v, 13, '#4a4440');
    const [x, y] = p.P(u, v, 13);
    p.g.fillStyle = '#f6d86a';
    p.g.fillRect(Math.round(x) - 2, y - 1, 3, 2);
  };
  lamp(0.24, 0.24);
  lamp(vw - 0.24, 0.24);
  lamp(0.24, vh - 0.24);
  // The shaft is straight, not a stair of narrowing boxes: the real obelisco is four flat faces.
  const z0 = 4.2;
  const height = 96;
  const hb = 0.33;
  const ht = 0.30;
  const stone = '#e6e1d6';
  p.box(cx - 0.44, cy - 0.44, cx + 0.44, cy + 0.44, 2.8, 1.4, '#d8d3c6');
  p.poly(
    [p.P(cx + hb, cy - hb, z0), p.P(cx + hb, cy + hb, z0), p.P(cx + ht, cy + ht, z0 + height), p.P(cx + ht, cy - ht, z0 + height)],
    shade(stone, RIGHT),
    shade(stone, 0.44),
  );
  p.poly(
    [p.P(cx - hb, cy + hb, z0), p.P(cx + hb, cy + hb, z0), p.P(cx + ht, cy + ht, z0 + height), p.P(cx - ht, cy + ht, z0 + height)],
    shade(stone, LEFT),
    shade(stone, 0.48),
  );
  // The door at the foot and the two small windows near the top, only on the faces that are seen.
  p.left(cy + hb - 0.01, cx - 0.1, cx + 0.1, z0 + 0.2, z0 + 7.4, '#443f39');
  p.left(cy + ht, cx - 0.1, cx - 0.015, z0 + height - 13, z0 + height - 7.6, '#4f4a44');
  p.right(cx + ht, cy - 0.1, cy - 0.015, z0 + height - 13, z0 + height - 7.6, '#4f4a44');
  // The pyramidion, tall and sharp like the real one, with the antenna on top.
  p.hipRoof(cx - ht, cy - ht, cx + ht, cy + ht, z0 + height, 15, '#eae5da');
  const [tx, ty] = p.P(cx, cy, z0 + height + 15);
  p.g.strokeStyle = '#4a4440';
  p.g.lineWidth = 0.7;
  p.g.beginPath();
  p.g.moveTo(tx, ty);
  p.g.lineTo(tx, ty - 6);
  p.g.stroke();
  // The lamp at the front corner goes last: it is in front of the shaft.
  lamp(vw - 0.24, vh - 0.24);
  return done(p);
}

/** El Calvario (3×6): the stone stair climbing the sierra of Tandil, the three crosses on top. */
function calvarioArt(vw: number, vh: number): Sprite {
  const { p, L, W, uv, box } = longPainter(vw, vh, 118);
  const g = p.g;
  const base = 1.2;
  const Q = (a: number, c: number, z: number): Pt => {
    const [u, v] = uv(a, c);
    return p.P(u, v, z);
  };
  /** A post that starts at height `z` instead of at the ground, for what stands on the hill. */
  const post = (a: number, c: number, z: number, h: number, color: string) => {
    const [u, v] = uv(a, c);
    const [x, y] = p.P(u, v, z);
    const bx = Math.round(x);
    const by = Math.round(y);
    const tall = Math.max(2, Math.round(h));
    g.fillStyle = shade(color, 1.08);
    g.fillRect(bx - 1, by - tall, 1, tall);
    g.fillStyle = color;
    g.fillRect(bx, by - tall, 1, tall);
    g.fillStyle = shade(color, 0.7);
    g.fillRect(bx + 1, by - tall, 1, tall);
  };
  const cFar = 0.16;
  const cNear = W - 0.16;
  const aBack = 0.4;
  const aCrest0 = 1.0;
  const aCrest1 = 2.0;
  const aFoot = L - 0.6;
  const H = 76;
  // The sierra rises from the near foot to a crest that is flat for about a cell, and falls away
  // behind it with a rounded shoulder: a hill, not a cone.
  const prof = (a: number): number => {
    if (a >= aFoot || a <= aBack) return base;
    if (a >= aCrest0 && a <= aCrest1) return base + H;
    if (a > aCrest1) return base + H * (1 - (a - aCrest1) / (aFoot - aCrest1)) ** 1.2;
    return base + H * (1 - (aCrest0 - a) / (aCrest0 - aBack)) ** 1.7;
  };
  box(0.02, 0.02, L - 0.02, W - 0.02, 0, base, '#6f9a52', false);
  // The slope that faces the camera, banded so the grass reads as a sunlit hillside.
  const bands = 8;
  for (let k = 0; k < bands; k++) {
    const aA = aCrest1 + ((aFoot - aCrest1) * k) / bands;
    const aB = aCrest1 + ((aFoot - aCrest1) * (k + 1)) / bands;
    p.poly([Q(aA, cFar, prof(aA)), Q(aB, cFar, prof(aB)), Q(aB, cNear, prof(aB)), Q(aA, cNear, prof(aA))], shade('#8aac5e', 0.98 - k * 0.02), '#617b41');
  }
  p.poly([Q(aCrest0, cFar, base + H), Q(aCrest1, cFar, base + H), Q(aCrest1, cNear, base + H), Q(aCrest0, cNear, base + H)], '#9cba6a', '#617b41');
  // The near face: the silhouette the stair climbs, with the grey rock of the sierra showing.
  const face: Pt[] = [];
  for (let k = 0; k <= 26; k++) {
    const a = aBack + ((aFoot - aBack) * k) / 26;
    face.push(Q(a, cNear, prof(a)));
  }
  p.poly(face, '#718f4a', '#54683a');
  // The rock of the sierra, in low outcrops at the foot and patches under the crest.
  p.poly([Q(4.3, cNear, base + 1), Q(4.6, cNear, prof(4.6) - 3), Q(5.1, cNear, base + 7), Q(5.0, cNear, base + 1)], '#9a9482', '#7d7863');
  p.poly([Q(3.6, cNear, base + 1), Q(3.85, cNear, prof(3.85) - 2), Q(4.15, cNear, base + 5), Q(3.95, cNear, base + 1)], '#a39d8b', '#7d7863');
  p.poly([Q(2.15, cNear, prof(2.15) - 3), Q(2.5, cNear, prof(2.5) - 12), Q(2.85, cNear, prof(2.85) - 6), Q(2.7, cNear, prof(2.7) - 2)], '#a8a291', '#7d7863');
  // Two strata lines down the face: the hill reads as a slope and not as a flat wall.
  for (const [off, color] of [
    [9, '#7f9c55'],
    [21, '#7b9752'],
    [33, '#779350'],
  ] as const) {
    g.beginPath();
    for (let k = 0; k <= 26; k++) {
      const a = aBack + ((aFoot - aBack) * k) / 26;
      const z = Math.max(base + 1, prof(a) - off);
      const [x, y] = Q(a, cNear, z);
      if (k === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.strokeStyle = color;
    g.lineWidth = 0.9;
    g.stroke();
  }
  // The stair: twelve thin flights cut into the slope, with a stone balustrade on each side.
  const N = 12;
  const sFar = 0.9;
  const sNear = 2.15;
  const rise = H / N;
  const stone = '#e4ddce';
  for (let k = N - 1; k >= 0; k--) {
    const aNear = aFoot - ((aFoot - aCrest1) * k) / N;
    const aFar = aFoot - ((aFoot - aCrest1) * (k + 1)) / N;
    const zTop = base + rise * (k + 1);
    p.poly([Q(aNear, sFar, zTop - rise), Q(aNear, sNear, zTop - rise), Q(aNear, sNear, zTop), Q(aNear, sFar, zTop)], shade(stone, 0.74), '#a89f8c');
    p.poly([Q(aFar, sFar, zTop), Q(aNear, sFar, zTop), Q(aNear, sNear, zTop), Q(aFar, sNear, zTop)], stone);
    box(aFar, sFar - 0.14, aNear, sFar, zTop, 2, '#c9c1b0', false);
    box(aFar, sNear, aNear, sNear + 0.14, zTop, 2.2, '#d2cab9', false);
  }
  // A Via Crucis station above the far balustrade every few flights.
  for (const k of [1, 4, 7, 10]) {
    const a = aFoot - ((aFoot - aCrest1) * (k + 0.5)) / N;
    const z = base + rise * (k + 1) + 2;
    post(a, sFar - 0.26, z, 9, '#6b4f35');
    const [u, v] = uv(a, sFar - 0.26);
    const [x, y] = p.P(u, v, z + 9);
    g.fillStyle = '#f2ecdc';
    g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
  }
  // The paved way up to the foot of the stair.
  p.poly([Q(aFoot, sFar - 0.3, base), Q(L - 0.1, sFar - 0.3, base), Q(L - 0.1, sNear + 0.3, base), Q(aFoot, sNear + 0.3, base)], '#b6afa0', '#948d7e');
  // The esplanade on the summit and the three crosses, the tall one in the middle.
  const platform = base + H + 1.8;
  box(aCrest0 + 0.02, 0.55, aCrest1 - 0.06, W - 0.55, base + H, 1.8, '#b3ab9a');
  const cross = (a: number, c: number, h: number, arm: number) => {
    post(a, c, platform, h, '#5d4529');
    const [u, v] = uv(a, c);
    const [x, y] = p.P(u, v, platform + h * 0.72);
    g.fillStyle = '#5d4529';
    g.fillRect(Math.round(x) - arm, Math.round(y), arm * 2 + 1, 2);
    g.fillStyle = '#7c5e39';
    g.fillRect(Math.round(x) - arm, Math.round(y), arm * 2 + 1, 1);
  };
  cross(1.16, W / 2 - 0.72, 20, 4);
  cross(1.16, W / 2 + 0.72, 20, 4);
  cross(1.22, W / 2, 30, 5);
  // Boulders at the foot and the trees of the sierra.
  p.hipRoof(aFoot + 0.05, 0.45, aFoot + 0.6, 0.95, base, 4, '#9a978c');
  p.hipRoof(L - 0.5, 2.5, L - 0.1, 2.9, base, 3, '#a8a18e');
  const tree = (a: number, c: number, kind: number, s: number) => {
    const [u, v] = uv(a, c);
    p.tree(u, v, kind, s);
  };
  tree(L - 0.16, 0.42, 2, 1);
  tree(L - 0.3, W - 0.4, 0, 1);
  return done(p);
}

/** The Puente Transbordador (2×6): two lattice towers, the high truss and the carriage it carries. */
function puenteArt(vw: number, vh: number): Sprite {
  const { p, L, W, uv, box } = longPainter(vw, vh, 56);
  const g = p.g;
  const Q = (a: number, c: number, z: number): Pt => {
    const [u, v] = uv(a, c);
    return p.P(u, v, z);
  };
  const steel = '#7c8790';
  const dark = '#39424a';
  const bank = 0.7;
  const towerA = 0.85;
  const legIn = 0.36;
  const legOut = W - 0.36;
  const towerTop = 45;
  const trussLow = 33;
  const trussHigh = 40;
  // The river with its two stone quays, which is what the bridge crosses.
  box(0.02, 0.02, L - 0.02, W - 0.02, 0, 0.8, '#4f7a78', false);
  box(0, 0, bank, W, 0, 2.6, '#a9a396');
  box(L - bank, 0, L, W, 0, 2.6, '#a9a396');
  box(0, 0, bank, W, 2.6, 0.7, '#c4bdae', false);
  box(L - bank, 0, L, W, 2.6, 0.7, '#c4bdae', false);
  // Three ripples, and the rowboat of the Riachuelo.
  g.strokeStyle = 'rgba(226,242,238,0.45)';
  g.lineWidth = 0.7;
  for (const [a, c] of [
    [2.1, 0.62],
    [3.2, 1.42],
    [4.4, 0.72],
  ]) {
    const [x, y] = Q(a, c, 0.85);
    g.beginPath();
    g.moveTo(x - 4, y);
    g.lineTo(x + 4, y);
    g.stroke();
  }
  box(1.55, 0.44, 2.1, 0.9, 0.8, 1, '#8a6a45', false);
  // The two towers: a leg at each side, three cross beams and one cross in each of the two bays.
  // Few members on purpose: a denser lattice turns into a grey smear at game size.
  for (const a of [towerA, L - towerA]) {
    for (const c of [legIn, legOut]) box(a - 0.11, c - 0.11, a + 0.11, c + 0.11, 2.6, towerTop, steel);
    for (const z of [2.6, 20, towerTop - 2.6]) box(a - 0.14, legIn, a + 0.14, legOut, z, 2.2, '#7d878e');
    g.strokeStyle = dark;
    g.lineWidth = 0.9;
    for (const [z0, z1] of [
      [4.8, 20],
      [22.2, towerTop - 2.6],
    ]) {
      g.beginPath();
      g.moveTo(...Q(a + 0.14, legIn, z0));
      g.lineTo(...Q(a + 0.14, legOut, z1));
      g.moveTo(...Q(a + 0.14, legOut, z0));
      g.lineTo(...Q(a + 0.14, legIn, z1));
      g.stroke();
    }
  }
  // The high truss between the towers, with its lattice on the near face only.
  const gA0 = towerA + 0.11;
  const gA1 = L - towerA - 0.11;
  for (const c of [legIn, legOut]) {
    box(gA0, c - 0.08, gA1, c + 0.08, trussLow, 1.3, steel, false);
    box(gA0, c - 0.08, gA1, c + 0.08, trussHigh - 1.3, 1.3, steel, false);
  }
  g.strokeStyle = dark;
  g.lineWidth = 1.1;
  const bays = 6;
  const cNear = legOut;
  for (let k = 0; k < bays; k++) {
    const a0 = gA0 + ((gA1 - gA0) * k) / bays;
    const a1 = gA0 + ((gA1 - gA0) * (k + 1)) / bays;
    const zLow = trussLow + 1.3;
    const zHigh = trussHigh - 1.3;
    g.beginPath();
    g.moveTo(...Q(a0, cNear, zLow));
    g.lineTo(...Q(a0, cNear, zHigh));
    g.moveTo(...Q(a0, cNear, zLow));
    g.lineTo(...Q(a1, cNear, zHigh));
    g.moveTo(...Q(a0, cNear, zHigh));
    g.lineTo(...Q(a1, cNear, zLow));
    g.stroke();
  }
  // The carriage: a thin deck hanging from four rods, with its railing and the small cabin of the
  // operator. It hangs well under the truss and well over the water, or it reads as a barge sitting
  // on the river instead of the thing the bridge carries.
  const mid = L / 2;
  const carZ = 20;
  const cIn = 0.36;
  const cOut = W - 0.36;
  for (const da of [-0.42, 0.42]) {
    for (const c of [cIn + 0.06, cOut - 0.06]) {
      g.strokeStyle = dark;
      g.lineWidth = 0.9;
      g.beginPath();
      g.moveTo(...Q(mid + da, c, trussLow));
      g.lineTo(...Q(mid + da, c, carZ + 2.6));
      g.stroke();
    }
  }
  // The deck: a red girder with the cream surface the cars drive onto.
  box(mid - 0.5, cIn, mid + 0.5, cOut, carZ, 2.4, '#a8382c');
  box(mid - 0.46, cIn + 0.04, mid + 0.46, cOut - 0.04, carZ + 2.4, 0.7, '#e8e0cc');
  // The railing: four posts on the near edge and the bar that joins them.
  for (const da of [-0.44, -0.15, 0.15, 0.44]) box(mid + da - 0.02, cOut - 0.1, mid + da + 0.02, cOut - 0.06, carZ + 3.1, 1.8, '#e8e0cc', false);
  box(mid - 0.46, cOut - 0.1, mid + 0.46, cOut - 0.07, carZ + 4.7, 0.5, '#e8e0cc', false);
  // The cabin, on the far half, so the deck stays free.
  box(mid - 0.22, cIn + 0.08, mid + 0.22, cIn + 0.34, carZ + 3.1, 3, '#b84434');
  box(mid - 0.26, cIn + 0.05, mid + 0.26, cIn + 0.37, carZ + 6.1, 0.6, '#e8e0cc');
  for (const da of [-0.12, 0, 0.12]) box(mid + da - 0.035, cIn + 0.32, mid + da + 0.035, cIn + 0.34, carZ + 4.1, 1.3, '#3a444a', false);
  return done(p);
}

/** The Teatro Colón (3×3): the portico of six columns, the pediment and the big copper dome. */
function teatroArt(vw: number, vh: number): Sprite {
  const p = rectPainter(vw, vh, 66);
  const cx = vw / 2;
  const g = p.g;
  const wall = '#efe2c4';
  const inn = 0.4;
  const face = vh - inn;
  const H = 30;
  // The stone apron, and the plinth the house stands on.
  p.box(0.02, 0.02, vw - 0.02, vh - 0.02, 0, 1.2, '#cfc8bb', false);
  p.box(0.22, 0.22, vw - 0.22, vh - 0.22, 1.2, 1.8, '#beb7a9');
  // The house: one wide block of three floors, with the stone quoins on its corners.
  p.box(inn, inn, vw - inn, vh - inn, 3.0, H, wall, true);
  // The side wall: three rows of windows with their stone frames.
  for (const z of [6.4, 13.4, 20.4]) {
    for (const [v0, v1] of [
      [inn + 0.18, inn + 0.44],
      [inn + 0.62, inn + 0.88],
      [inn + 1.06, inn + 1.32],
    ]) {
      p.right(vw - inn, v0, v1, z, z + 4.6, '#d9cdb2');
      p.right(vw - inn, v0 + 0.03, v1 - 0.03, z + 0.7, z + 4.2, PAL.glassDark);
    }
  }
  // The loggia: the dark plane the columns stand against, so six pale columns read at game size.
  p.left(face, inn + 0.26, vw - inn - 0.26, 3.4, H - 5.4, '#5d4f3c');
  p.left(face, cx - 0.17, cx + 0.17, 3.4, 12.6, '#332a24');
  // Six columns, proud of that plane, each with its base and its capital.
  const c0 = inn + 0.24;
  const c1 = vw - inn - 0.24;
  for (let k = 0; k < 6; k++) {
    const u = c0 + ((c1 - c0) * (k + 0.5)) / 6;
    p.box(u - 0.06, face, u + 0.06, face + 0.14, 4.6, H - 4.6, '#fbf8f0', false);
    p.box(u - 0.08, face - 0.02, u + 0.08, face + 0.16, 3.4, 1.4, '#ece4d2', false);
    p.box(u - 0.08, face - 0.02, u + 0.08, face + 0.16, H - 0.6, 1.8, '#f4efe2', false);
  }
  // The attic over the house, then the drum and the dome. Wide and low, with a stone lantern on
  // top: a tall dome with a golden finial reads as a mosque, which is what this building is not.
  p.box(inn - 0.06, inn - 0.06, vw - inn + 0.06, vh - inn + 0.06, H, 2.4, '#e6dbc4');
  const dv = vh / 2 - 0.15;
  // The drum is narrower than the dome on purpose: a drum as wide as the cap hides it, and the
  // monument ends up wearing a thin green ring instead of a dome.
  const drum = 0.28;
  p.box(cx - drum, dv - drum, cx + drum, dv + drum, H + 2.4, 4.8, '#ded3bb', true);
  const rx = 0.34 * vw * 16;
  // The dome is a stack of ellipses, each one smaller and higher than the last. A half ellipse on
  // its own gets half eaten by the drum's top face and the monument ends up wearing a green ring.
  const ring = (k: number, dz: number, col: string) => {
    const [ex, ey] = p.P(cx, dv, H + 7.2 + dz);
    g.beginPath();
    g.ellipse(ex, ey, rx * k, rx * k * 0.5, 0, 0, Math.PI * 2);
    g.closePath();
    g.fillStyle = col;
    g.fill();
    if (dz === 0) {
      g.strokeStyle = '#43604e';
      g.lineWidth = 0.7;
      g.stroke();
    }
  };
  ring(1, 0, '#4f6a58');
  ring(0.9, 3.2, '#6d8b74');
  ring(0.68, 6.4, '#82a48c');
  ring(0.42, 9.2, '#9fbea8');
  // The lantern that closes the dome, in stone, with its little cap.
  const top = H + 7.2 + 11.6;
  p.box(cx - 0.09, dv - 0.09, cx + 0.09, dv + 0.09, top, 2.4, '#e8dfc9', true);
  p.hipRoof(cx - 0.12, dv - 0.12, cx + 0.12, dv + 0.12, top + 2.4, 1.8, '#7f9c86');
  // The entablature and the pediment: wide and low over the whole portico, a shade darker than the
  // wall and with a dark tympanum, or it disappears at game size.
  p.box(inn - 0.04, face - 0.04, vw - inn + 0.04, face + 0.18, H, 2.6, '#e9dfca', true);
  const base = H + 2.6;
  const apex = 8.4;
  p.poly([p.P(inn + 0.02, face + 0.02, base), p.P(vw - inn - 0.02, face + 0.02, base), p.P(cx, face + 0.02, base + apex)], '#bdb097');
  p.poly(
    [p.P(inn - 0.04, face + 0.18, base), p.P(vw - inn + 0.04, face + 0.18, base), p.P(cx, face + 0.18, base + apex + 0.8)],
    '#e2d6bc',
    '#8f8574',
  );
  p.poly(
    [
      p.P(inn + 0.16, face + 0.19, base + 1.3),
      p.P(vw - inn - 0.16, face + 0.19, base + 1.3),
      p.P(cx, face + 0.19, base + apex - 1.6),
    ],
    '#b3a68d',
  );
  return done(p);
}

// ---------------------------------------------------------------- the uniques of each government

/**
 * The cabildo (3x2): the colonial town hall of Buenos Aires. A two-storey arcade of cream stone under
 * a red tile roof, with the central tower that holds the clock, the way it still stands on the Plaza
 * de Mayo. The seat of the government faces the plaza, so the front has the arches and the balcony.
 */
function cabildoArt(vw: number, vh: number): Sprite {
  const p = rectPainter(vw, vh, 56);
  const cream = '#efe6d2';
  const tile = '#a8503c';
  p.box(0.02, 0.02, vw - 0.02, vh - 0.02, 0, 1.2, '#cfc8bb', false);
  p.box(0.1, 0.14, vw - 0.1, vh - 0.14, 1.2, 1.4, '#dcd5c6', true);
  const z0 = 2.6;
  const bodyH = 15;
  p.box(0.16, 0.2, vw - 0.16, vh - 0.2, z0, bodyH, cream, true);
  const u0 = 0.16;
  const u1 = vw - 0.16;
  const v0 = 0.2;
  const v1 = vh - 0.2;
  // The ground floor is the arcade: an arch on each face, dark, at the level of the street.
  const arches = 4;
  for (let k = 0; k < arches; k++) {
    const a = u0 + ((u1 - u0) * (k + 0.28)) / arches;
    const b = u0 + ((u1 - u0) * (k + 0.72)) / arches;
    p.left(v1 - 0.005, a, b, z0 + 1.2, z0 + 6.6, '#6b6257');
    const c = v0 + ((v1 - v0) * (k + 0.28)) / arches;
    const d = v0 + ((v1 - v0) * (k + 0.72)) / arches;
    p.right(u1 - 0.005, c, d, z0 + 1.2, z0 + 6.6, '#6b6257');
  }
  p.windows(u0, v0, u1, v1, z0 + 8.8, z0 + bodyH - 0.8, 6, '#7a6a52', 4, 2.8);
  // The balcony and the tile roof, low and wide like the real one.
  p.box(u0 - 0.05, v0 - 0.05, u1 + 0.05, v1 + 0.05, z0 + 7.4, 0.8, '#e3dac7', true);
  p.hipRoof(u0 - 0.08, v0 - 0.08, u1 + 0.08, v1 + 0.08, z0 + bodyH, 3.6, tile);
  // The tower over the middle of the front, with the clock and its little roof.
  const cu = (u0 + u1) / 2;
  const cv = (v0 + v1) / 2;
  const tw = 0.74;
  p.box(cu - tw, cv - tw, cu + tw, cv + tw, z0 + bodyH, 13, cream, true);
  const clockZ = z0 + bodyH + 6.4;
  p.left(cv + tw - 0.01, cu - 0.3, cu + 0.3, clockZ, clockZ + 4, '#f7f2e6');
  p.right(cu + tw - 0.01, cv - 0.3, cv + 0.3, clockZ, clockZ + 4, '#f7f2e6');
  const [cx1, cy1] = p.P(cu, cv + tw - 0.02, clockZ + 1.6);
  const [cx2, cy2] = p.P(cu + tw - 0.02, cv, clockZ + 1.6);
  p.g.fillStyle = '#3b352e';
  p.g.fillRect(Math.round(cx1) - 1, Math.round(cy1) - 1, 2, 2);
  p.g.fillRect(Math.round(cx2) - 1, Math.round(cy2) - 1, 2, 2);
  p.box(cu - tw - 0.05, cv - tw - 0.05, cu + tw + 0.05, cv + tw + 0.05, z0 + bodyH + 13, 0.8, '#e3dac7', true);
  p.hipRoof(cu - tw - 0.07, cv - tw - 0.07, cu + tw + 0.07, cv + tw + 0.07, z0 + bodyH + 13.8, 4.4, tile);
  // The mast with the flag over the tower.
  p.post(cu, cv, z0 + bodyH + 18.2, '#5d554b');
  const [fx, fy] = p.P(cu, cv, z0 + bodyH + 18.2);
  p.g.fillStyle = '#7cb0d8';
  p.g.fillRect(Math.round(fx), Math.round(fy) - 4, 6, 4);
  p.g.fillStyle = '#f2efe6';
  p.g.fillRect(Math.round(fx), Math.round(fy) - 2.4, 6, 1.6);
  return done(p);
}

/**
 * The regimiento (4x3): a regimental barracks, the way Campo de Mayo looks from the road. Low
 * whitewashed blocks with green roofs around an open parade ground, a watchtower at the corner and
 * the flag mast in the middle, because the ground is empty on purpose: that is what it is for.
 */
function regimientoArt(vw: number, vh: number): Sprite {
  const p = rectPainter(vw, vh, 42);
  const wall = '#e2dccb';
  const roof = '#5d7a54';
  p.box(0.02, 0.02, vw - 0.02, vh - 0.02, 0, 1, '#b9a888', false);
  p.box(0.5, 0.5, vw - 0.5, vh - 0.5, 1, 0.4, '#a89474', false);
  const block = (u0: number, v0: number, u1: number, v1: number) => {
    p.box(u0, v0, u1, v1, 1, 12, wall, true);
    p.hipRoof(u0 - 0.06, v0 - 0.06, u1 + 0.06, v1 + 0.06, 13, 3.2, roof);
    p.windows(u0, v0, u1, v1, 3, 11, 5, '#5a5348', 4, 3.2);
  };
  block(0.34, 0.28, vw - 0.7, 0.9);
  block(0.28, vh - 0.94, 0.9, vh - 0.32);
  // The guard post and the watchtower with its lamp, at the corner the camera meets first.
  p.box(vw - 1.4, vh - 1.35, vw - 0.85, vh - 0.85, 1, 6, wall, true);
  p.hipRoof(vw - 1.46, vh - 1.41, vw - 0.79, vh - 0.79, 7, 2.2, roof);
  const tu = vw - 0.95;
  const tv = vh - 0.9;
  p.box(tu - 0.17, tv - 0.17, tu + 0.17, tv + 0.17, 1, 19, '#efe9da', true);
  p.box(tu - 0.25, tv - 0.25, tu + 0.25, tv + 0.25, 20, 1.1, '#cfc7b5', true);
  p.left(tv + 0.17, tu - 0.11, tu + 0.11, 14.5, 17.5, '#4d463d');
  p.hipRoof(tu - 0.28, tv - 0.28, tu + 0.28, tv + 0.28, 21.1, 2.8, roof);
  // The mast in the middle of the ground, with the flag: the one thing that reads from far away.
  const mu = vw / 2 - 0.15;
  const mv = vh / 2 + 0.25;
  p.post(mu, mv, 28, '#8f8b82');
  const [fx, fy] = p.P(mu, mv, 28);
  p.g.fillStyle = '#7cb0d8';
  p.g.fillRect(Math.round(fx) + 1, Math.round(fy) - 5, 8, 5);
  p.g.fillStyle = '#f4f1e8';
  p.g.fillRect(Math.round(fx) + 1, Math.round(fy) - 3.4, 8, 2);
  p.g.fillStyle = '#d9b45c';
  p.g.fillRect(Math.round(fx) + 4, Math.round(fy) - 4, 2, 2);
  // Two sandbag nests by the gate and the truck parked next to the block.
  for (const [su, sv] of [
    [0.5, vh - 0.5],
    [0.5, vh - 0.95],
  ]) {
    p.box(su - 0.13, sv - 0.11, su + 0.13, sv + 0.11, 1, 2.2, '#b3a888', true);
  }
  p.box(1.6, vh - 2.1, 2.5, vh - 1.5, 1, 3, '#6f7d63', true);
  return done(p);
}

/**
 * The planetario (3x3): the Galileo Galilei of Palermo. A white drum in the middle of a plaza and the
 * sphere on top of it, the dark ring of the gallery at its equator and the little lantern: it is the
 * only building of the city that is not a box, and that is exactly what makes it read.
 */
function planetarioArt(vw: number, vh: number): Sprite {
  const p = rectPainter(vw, vh, 52);
  const cu = vw / 2;
  const cv = vh / 2;
  p.box(0.02, 0.02, vw - 0.02, vh - 0.02, 0, 1, '#c9c4b4', false);
  // The parterre of the park and the steps that climb to the drum.
  p.poly([p.P(0.08, 0.08, 1.05), p.P(vw - 0.4, 0.08, 1.05), p.P(vw - 0.4, vh - 0.4, 1.05), p.P(0.08, vh - 0.4, 1.05)], '#79a95f');
  p.box(0.9, 1.2, 2.1, 1.9, 1, 0.9, '#b9b2a4', true);
  // The drum: a wide white cylinder with its band of windows, and the sphere sitting on it.
  p.cylinder(cu, cv, 0.56, 1, 15, '#eae4d6');
  p.cylinder(cu, cv, 0.58, 15, 1.2, '#f4efe3');
  for (const a of [-0.3, 0.3]) p.left(1.755, cu + a - 0.12, cu + a + 0.12, 5.6, 10.4, '#54707f');
  const [bx, by] = p.P(cu, cv, 18);
  const r = 14;
  // A sphere projects as a ball, not as a stack of ellipses: one circle, and over it three more,
  // each one smaller and shifted to the side the light comes from. That stepped shading is what
  // turns a flat disc into a volume without painting a single gradient.
  const sphere = '#b6ccd6';
  const disc = (dx: number, dy: number, rad: number, tone: string) => {
    p.g.beginPath();
    p.g.ellipse(bx + dx, by + dy, rad, rad, 0, 0, Math.PI * 2);
    p.g.fillStyle = tone;
    p.g.fill();
  };
  disc(0, 0, r, shade(sphere, 0.7));
  disc(-r * 0.05, -r * 0.1, r * 0.9, shade(sphere, 0.9));
  disc(-r * 0.2, -r * 0.3, r * 0.68, shade(sphere, 1.1));
  disc(-r * 0.32, -r * 0.46, r * 0.4, shade(sphere, 1.3));
  // The gallery: the walkway that goes round the equator, clipped to the ball so it hugs it.
  p.g.save();
  p.g.beginPath();
  p.g.ellipse(bx, by, r * 0.995, r * 0.995, 0, 0, Math.PI * 2);
  p.g.clip();
  p.g.beginPath();
  p.g.ellipse(bx, by + r * 0.02, r * 1.02, r * 0.32, 0, Math.PI * 0.02, Math.PI * 0.98);
  p.g.strokeStyle = '#4d5a64';
  p.g.lineWidth = 1.7;
  p.g.stroke();
  p.g.restore();
  // The lantern on the crown of the ball, with its little cap and the mast of the telescope.
  p.cylinder(cu, cv, 0.055, 31.4, 2, '#e8e2d4');
  p.hipRoof(cu - 0.075, cv - 0.075, cu + 0.075, cv + 0.075, 33.4, 1.2, '#b9b2a4');
  // The trees of the park.
  p.tree(0.34, vh - 0.34, 1, 0.9);
  p.tree(vw - 0.36, vh - 0.36, 3, 0.8);
  p.tree(vw - 0.34, 0.36, 1, 0.85);
  return done(p);
}

/**
 * The santuario (3x4): the basilica of Lujan, in brick, with the two towers of its front and the rose
 * window between them. The spires are drawn as the pyramids they are, so the building ends in two
 * points instead of a dome, which is what tells it apart from a church of any other style.
 */
function santuarioArt(vw: number, vh: number): Sprite {
  const p = rectPainter(vw, vh, 66);
  const brick = '#9c5a44';
  const brickDark = '#7d4433';
  const stone = '#e5ddc8';
  p.box(0.02, 0.02, vw - 0.02, vh - 0.02, 0, 1, '#c9c2b1', false);
  p.box(0.14, vh - 0.95, vw - 0.14, vh - 0.1, 1, 1.3, '#ddd6c4', true);
  const z0 = 2.2;
  // The nave: a long brick block with its gable roof and the buttresses that hold it.

  for (let k = 0; k < 3; k++) {
    const v = 1.05 + k * 1.45;
    p.box(0.64, v, 0.75, v + 0.24, z0, 16, brickDark, true);
    p.box(vw - 0.75, v, vw - 0.64, v + 0.24, z0, 16, brickDark, true);
  }
  // The front: two towers with their belfries and spires, and the gable with the rose window between.
  // The towers are the shape of the building, so they get the width: narrow ones read as pilasters.
  const front = vh - 1;
  const tower = (u: number) => {
    const tw = 0.36;
    // The towers are a touch lighter than the nave so their silhouette separates from the roof
    // behind them: at game size the two bricks otherwise merge into one mass.
    const towerBrick = '#ab6650';
    p.box(u - tw, front - 0.7, u + tw, front + 0.08, z0, 30, towerBrick, true);
    p.box(u - tw - 0.06, front - 0.76, u + tw + 0.06, front + 0.14, z0 + 30, 1, stone, true);
    p.left(front + 0.075, u - 0.26, u + 0.26, z0 + 23.5, z0 + 28.6, '#2f2b26');
    p.right(u + tw - 0.005, front - 0.5, front - 0.1, z0 + 23.5, z0 + 28.6, '#2f2b26');
    // The bell in the belfry, and the spire with its cross: tall and sharp, as Luján's are.
    p.left(front + 0.07, u - 0.07, u + 0.07, z0 + 25.4, z0 + 27.6, '#c9a24a');
    p.hipRoof(u - 0.3, front - 0.7, u + 0.3, front + 0.08, z0 + 31, 18, '#a95a44');
    p.box(u - 0.05, front - 0.34, u + 0.05, front - 0.24, z0 + 48, 3.2, '#5d554b', false);
    p.box(u - 0.14, front - 0.34, u + 0.14, front - 0.24, z0 + 49.6, 0.8, '#5d554b', false);
  };
  // The nave and its front first, and the towers last: drawn after, they stand in front of the
  // gable the way the two towers of a basilica stand in front of it, and neither one disappears.
  p.box(0.74, 0.5, vw - 0.74, vh - 1, z0, 19, brick, true);
  p.gableRoof(0.7, 0.46, vw - 0.7, vh - 0.96, z0 + 19, 4.4, '#8a4a3a', brick);
  p.box(0.86, front - 0.5, vw - 0.86, front - 0.02, z0, 21, brick, true);
  p.gableRoof(0.82, front - 0.54, vw - 0.82, front + 0.02, z0 + 21, 3.4, '#7d4433', brick);
  tower(0.44);
  tower(vw - 0.44);
  const [rx, ry] = p.P(vw / 2, front - 0.02, z0 + 15.5);
  p.g.beginPath();
  p.g.ellipse(rx, ry, 4, 4.4, 0, 0, Math.PI * 2);
  p.g.fillStyle = '#3f5a72';
  p.g.fill();
  p.g.strokeStyle = stone;
  p.g.lineWidth = 1;
  p.g.stroke();
  // The portal: a thin stone arch over the dark door, the way the basilica opens on its atrium.
  p.left(front - 0.015, vw / 2 - 0.3, vw / 2 + 0.3, z0 + 0.2, z0 + 8.6, '#3b322b');
  p.left(front - 0.02, vw / 2 - 0.34, vw / 2 + 0.34, z0 + 8.6, z0 + 9.4, stone);
  return done(p);
}

/**
 * The sindicato (3x2): the union hall of a working town, like the one of the meat workers in Berisso.
 * A plain concrete block with the big hall behind the wide door, the band of windows of the offices
 * and the banner over the entrance, because a union building is a building that shows its name.
 */
function sindicatoArt(vw: number, vh: number): Sprite {
  const p = rectPainter(vw, vh, 38);
  const concrete = '#d8d2c2';
  const red = '#b23a2e';
  p.box(0.02, 0.02, vw - 0.02, vh - 0.02, 0, 1, '#c2bba9', false);
  const z0 = 1;
  p.box(0.22, 0.26, vw - 0.22, vh - 0.34, z0, 14, concrete, true);
  p.box(0.18, 0.22, vw - 0.18, vh - 0.3, z0 + 14, 0.9, '#b8b2a2', true);
  p.windows(0.22, 0.26, vw - 0.22, vh - 0.34, z0 + 7, z0 + 12.6, 5.6, '#54707f', 3, 4);
  for (const a of [0.36, 0.86]) p.left(vh - 0.345, a, a + 0.34, z0 + 1.6, z0 + 6, '#54707f');
  // The hall opens on the street with its wide door, a stone frame and a step, and the banner over it.
  p.left(vh - 0.33, vw / 2 - 0.56, vw / 2 + 0.56, z0 + 0.2, z0 + 9.4, '#d0c9b8');
  p.left(vh - 0.335, vw / 2 - 0.46, vw / 2 + 0.46, z0 + 0.2, z0 + 8.6, '#3f3830');
  p.box(vw / 2 - 0.6, vh - 0.44, vw / 2 + 0.6, vh - 0.06, 1, 0.8, '#cfc8b8', true);
  p.left(vh - 0.35, vw / 2 - 0.62, vw / 2 + 0.62, z0 + 10.4, z0 + 13.4, red);
  const [bx, by] = p.P(vw / 2, vh - 0.36, z0 + 11.9);
  p.g.fillStyle = '#f2efe6';
  p.g.fillRect(Math.round(bx) - 5, Math.round(by) - 2, 10, 4);
  p.g.fillStyle = red;
  p.g.beginPath();
  p.g.arc(bx, by, 1.5, 0, Math.PI * 2);
  p.g.fill();
  // The flag over the door and the tree at the corner.
  const fu = vw / 2 + 0.62;
  const fv = vh - 0.5;
  p.post(fu, fv, 24, '#7d776d');
  const [fx, fy] = p.P(fu, fv, 24);
  p.g.fillStyle = red;
  p.g.fillRect(Math.round(fx) + 1, Math.round(fy) - 5, 7, 5);
  p.g.fillStyle = '#f2e6b8';
  p.g.fillRect(Math.round(fx) + 3, Math.round(fy) - 4, 3, 3);
  p.tree(0.34, vh - 0.34, 3, 0.75);
  return done(p);
}

/** The stadium (4×4): the yellow tiers of La Bombonera around the pitch, and the four floodlights. */
function estadioArt(vw: number, vh: number): Sprite {
  const p = rectPainter(vw, vh, 52);
  const g = p.g;
  const Q = (u: number, v: number, z: number): Pt => p.P(u, v, z);
  const yellow = '#e0c05c';
  const blue = '#2f5e9e';
  /** A corner floodlight: the mast, the lamp head and the glow it throws. */
  const flood = (u: number, v: number): void => {
    p.post(u, v, 44, '#564f48');
    const [x, y] = p.P(u, v, 44);
    const bx = Math.round(x);
    const by = Math.round(y);
    g.fillStyle = '#3f3a35';
    g.fillRect(bx - 4, by - 4, 9, 4);
    g.fillStyle = '#ffe9a0';
    g.fillRect(bx - 3, by - 3, 7, 2);
    g.fillStyle = 'rgba(255,233,160,0.22)';
    g.fillRect(bx - 6, by + 1, 13, 2);
  };
  // The two masts of the far corners and the one at the left: enough to read the stadium, and
  // none of them crosses the pitch.
  flood(0.14, 0.14);
  flood(vw - 0.14, 0.14);
  flood(0.14, vh - 0.14);
  // The apron of the ground, and the pitch with its outline, the halfway line and the circle.
  p.box(0.02, 0.02, vw - 0.02, vh - 0.02, 0, 1.1, '#a6a7ab', false);
  const p0 = 1;
  const p1 = vw - 1;
  p.poly([Q(p0, p0, 1.2), Q(p1, p0, 1.2), Q(p1, p1, 1.2), Q(p0, p1, 1.2)], '#3f8f4a', '#e7e2d2');
  g.strokeStyle = 'rgba(240,236,222,0.9)';
  g.lineWidth = 0.7;
  const [gx, gy] = Q(vw / 2, vh / 2, 1.2);
  g.beginPath();
  g.ellipse(gx, gy, 10, 5, 0, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(...Q(vw / 2, p0, 1.2));
  g.lineTo(...Q(vw / 2, p1, 1.2));
  g.stroke();
  // Four steep tiers of yellow concrete on the two sides that face away from the camera, so the
  // seating is visible; the front half stays low and the bowl reads as a horseshoe.
  const tiers: [number, number, number][] = [
    [0.04, 0.24, 22],
    [0.24, 0.46, 16.5],
    [0.46, 0.68, 11],
    [0.68, 0.84, 5.5],
  ];
  for (const [a, b, h] of tiers) p.box(0.04, a, vw - 0.22, b, 0, h, yellow, true);
  for (const [a, b, h] of tiers) p.box(a, 0.84, b, vh - 0.24, 0, h, yellow, true);
  // The blue band of the club on the top tier, the one the camera can see.
  p.left(0.24, 0.3, vw - 0.3, 18, 21, blue);
  p.right(0.24, 0.9, vh - 0.3, 18, 21, blue);
  // The crowd: flecks of colour along the steps.
  const flecks = ['#f2ead6', '#c8392f', '#2f5e9e', '#e0a526'];
  let seed = 5;
  const rnd = (): number => (seed = (seed * 41 + 13) % 97) / 97;
  for (const [c, z] of [
    [0.14, 22],
    [0.35, 16.5],
    [0.57, 11],
    [0.76, 5.5],
  ] as const) {
    for (let k = 0; k < 14; k++) {
      const [x, y] = Q(0.3 + rnd() * (vw - 0.6), c, z + 0.5);
      g.fillStyle = flecks[k % flecks.length];
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    for (let k = 0; k < 10; k++) {
      const [x, y] = Q(c, 0.95 + rnd() * (vh - 1.9), z + 0.5);
      g.fillStyle = flecks[(k + 2) % flecks.length];
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }
  // The low wall that closes the bowl in front, with the blue band and the gate of the horseshoe.
  p.box(0.22, 3.4, vw - 0.5, vh - 0.06, 0, 7, yellow, true);
  p.left(vh - 0.06, 0.3, vw - 0.6, 2.6, 4.8, blue);
  // The row of boxes over the blue band, the facade the barrio knows.
  for (let k = 0; k < 5; k++) {
    const a = 0.5 + k * 0.62;
    p.left(vh - 0.06, a, a + 0.34, 5.2, 6.2, '#8a7440');
  }
  for (const [c0, c1] of [
    [0.9, 1.62],
    [2.42, 3.1],
  ] as const) {
    p.box(vw - 0.42, c0, vw - 0.06, c1, 0, 7, yellow, true);
    p.right(vw - 0.06, c0 + 0.08, c1 - 0.08, 2.6, 4.8, blue);
  }
  return done(p);
}

/** The sprite of a unique building, on a footprint of `vw`×`vh` lots as the camera sees it. */
export function uniqueSprite(kind: UniqueKind, vw: number, vh: number): Sprite {
  return cached(`unique:${kind}:${vw}x${vh}`, () => {
    switch (kind) {
      case 'obelisco':
        return obeliscoArt(vw, vh);
      case 'calvario':
        return calvarioArt(vw, vh);
      case 'puente':
        return puenteArt(vw, vh);
      case 'teatro':
        return teatroArt(vw, vh);
      case 'estadio':
        return estadioArt(vw, vh);
      case 'cabildo':
        return cabildoArt(vw, vh);
      case 'regimiento':
        return regimientoArt(vw, vh);
      case 'planetario':
        return planetarioArt(vw, vh);
      case 'santuario':
        return santuarioArt(vw, vh);
      case 'sindicato':
        return sindicatoArt(vw, vh);
    }
  });
}
