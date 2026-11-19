import type { UniqueKind } from '../config';
import type { ZoneKind } from '../world/world';
import {
  cabildoPixelSprite,
  calvarioPixelSprite,
  commercialPixelSprite,
  estadioPixelSprite,
  industrialPixelSprite,
  obeliscoPixelSprite,
  planetarioPixelSprite,
  puentePixelSprite,
  regimientoPixelSprite,
  residentialPixelSprite,
  santuarioPixelSprite,
  sindicatoPixelSprite,
  teatroPixelSprite,
} from './pixelArt';

/**
 * Procedural isometric sprites in canvas: what the pixel pass of `pixelArt.ts` has not taken yet.
 * That is the ten unique buildings (a monument is one of each per map and has its own drawing anyway)
 * and the port, the resort and the lighthouse of the coast.
 *
 * Every sprite is anchored at the top corner of its footprint diamond on the ground: (ax, ay) inside
 * the sprite canvas is where that corner goes on screen.
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

/** What stands on a plaza cell: a kept one with its tree, a kept one left bare, or a neglected one. */
export type ParkLook = 'tree' | 'bare' | 'neglected';

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
  return cached(`pixel:${zone}${level}:${v}`, () =>
    zone === 'R' ? residentialPixelSprite(level, v) : zone === 'C' ? commercialPixelSprite(level, v) : industrialPixelSprite(level, v),
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

// ---------------------------------------------------------------- the uniques of each government

/** The sprite of a unique building, on a footprint of `vw`×`vh` lots as the camera sees it. */
export function uniqueSprite(kind: UniqueKind, vw: number, vh: number): Sprite {
  return cached(`unique:${kind}:${vw}x${vh}`, () => {
    switch (kind) {
      case 'obelisco':
        return obeliscoPixelSprite(vw, vh);
      case 'calvario':
        return calvarioPixelSprite(vw, vh);
      case 'puente':
        return puentePixelSprite(vw, vh);
      case 'teatro':
        return teatroPixelSprite(vw, vh);
      case 'estadio':
        return estadioPixelSprite(vw, vh);
      case 'cabildo':
        return cabildoPixelSprite(vw, vh);
      case 'regimiento':
        return regimientoPixelSprite(vw, vh);
      case 'planetario':
        return planetarioPixelSprite(vw, vh);
      case 'santuario':
        return santuarioPixelSprite(vw, vh);
      case 'sindicato':
        return sindicatoPixelSprite(vw, vh);
    }
  });
}
