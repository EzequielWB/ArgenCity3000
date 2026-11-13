/**
 * Style lab scene: one small neighbourhood (river, bluff, streets, homes, shops, a plaza, a
 * factory, a football pitch and trees) drawn in a given style. Used only by estilos.html to
 * choose an art direction; nothing here is part of the game yet.
 */
import { Pixels, bayer, hex, mix, noise, shade, type Pt, type RGB, type WallPaint } from '../render/pixel';

export interface Style {
  id: string;
  name: string;
  desc: string;
  /** Dark line around buildings and tree crowns, or null for none. */
  outline: RGB | null;
  /** Shade with ordered dithering instead of flat tones. */
  dither: boolean;
  /** Limited palette every colour is snapped to, or null for free colours. */
  palette: RGB[] | null;
  sky: string;
  grass: [RGB, RGB, RGB];
  water: [RGB, RGB];
  sand: RGB;
  earth: RGB;
  asphalt: RGB;
  walk: RGB;
  dirt: RGB;
  walls: RGB[];
  roofTile: RGB;
  brick: RGB;
  mortar: RGB;
  sheet: RGB;
  concrete: RGB;
  glass: RGB;
  wood: RGB;
  shutter: RGB;
  trunk: RGB;
  leaves: Record<'jacaranda' | 'tipa' | 'borracho' | 'eucalipto' | 'ombu' | 'alamo', RGB>;
}

const G = 14;
const OX = G * 16;
const OY = 44;
export const SCENE_W = G * 32;
export const SCENE_H = OY + G * 16 + 14;

const WHITE = hex('#f6f2e8');
const TOP = 1;
const LEFT = 0.96;
const RIGHT = 0.7;

type TreeKind = keyof Style['leaves'];

export function drawScene(st: Style): Pixels {
  const px = new Pixels(SCENE_W, SCENE_H);
  px.palette = st.palette;

  const P = (u: number, v: number, z = 0): Pt => [OX + (u - v) * 16, OY + (u + v) * 8 - z];
  /** A colour under light `f`, with the style's dithering. */
  const lit = (c: RGB, f: number, x: number, y: number): RGB => shade(c, st.dither ? f + (bayer(x, y) - 0.5) * 0.24 : f);
  const edge = (a: Pt, b: Pt, c: RGB | null = st.outline) => {
    if (c) px.line(a, b, c);
  };

  // ------------------------------------------------------------ ground

  const isWater = (_u: number, v: number) => v >= 12;
  const isSand = (_u: number, v: number) => v === 11;
  const height = (u: number, v: number) => (u >= 10 && v <= 3 ? 10 : 0);
  const roadU = (u: number, v: number) => v === 5 && !isWater(u, v); // street running along u
  const roadV = (u: number, v: number) => u === 5 && v <= 10; // street running along v
  const dirtRoad = (u: number, v: number) => v === 9 && u >= 6;
  const pitch = (u: number, v: number) => v === 10 && u >= 7 && u <= 10;
  const plaza = (u: number, v: number) => u >= 6 && u <= 8 && v >= 1 && v <= 3;

  const grass = (u: number, v: number) => (x: number, y: number) => {
    const patch = noise(Math.floor(x / 9), Math.floor(y / 5), 3);
    if (st.dither) return bayer(x, y) < patch * 0.9 ? st.grass[1] : bayer(x + 2, y + 1) < 0.25 + noise(u, v) * 0.3 ? st.grass[2] : st.grass[0];
    const n = noise(x, y, 1);
    const base = patch > 0.6 ? mix(st.grass[0], st.grass[1], 0.45) : st.grass[0];
    return n < 0.07 ? st.grass[2] : n > 0.94 ? st.grass[1] : base;
  };
  const speckled = (c: RGB, amount = 0.1) => (x: number, y: number) => {
    const n = noise(x, y, 5);
    return lit(c, n < amount ? 0.86 : n > 1 - amount ? 1.1 : 1, x, y);
  };
  const waterPaint = (x: number, y: number) => {
    if (st.dither) return bayer(x, y >> 1) < 0.3 + 0.3 * Math.sin(y / 5 + x / 23) ? st.water[1] : st.water[0];
    return noise(x >> 2, y, 9) < 0.13 ? st.water[1] : noise(x >> 3, y, 4) < 0.1 ? shade(st.water[0], 0.9) : st.water[0];
  };

  const tile = (u: number, v: number, z: number, paint: (x: number, y: number) => RGB | null) => px.poly([P(u, v, z), P(u + 1, v, z), P(u + 1, v + 1, z), P(u, v + 1, z)], paint);

  for (let s = 0; s <= 2 * (G - 1); s++) {
    for (let u = 0; u < G; u++) {
      const v = s - u;
      if (v < 0 || v >= G) continue;
      const z = height(u, v);
      if (isWater(u, v)) tile(u, v, 0, waterPaint);
      else if (isSand(u, v)) tile(u, v, 0, speckled(st.sand, 0.12));
      else if (roadU(u, v) || roadV(u, v)) {
        tile(u, v, 0, speckled(st.walk, 0.05));
        if (roadU(u, v)) px.poly([P(u, v + 0.16), P(u + 1, v + 0.16), P(u + 1, v + 0.84), P(u, v + 0.84)], speckled(st.asphalt, 0.08));
        if (roadV(u, v)) px.poly([P(u + 0.16, v), P(u + 0.84, v), P(u + 0.84, v + 1), P(u + 0.16, v + 1)], speckled(st.asphalt, 0.08));
        const cross = roadU(u, v) && roadV(u, v);
        if (!cross) {
          // Dashed centre line.
          for (const t of [0.12, 0.62]) {
            if (roadU(u, v)) px.line(P(u + t, v + 0.5), P(u + t + 0.26, v + 0.5), WHITE);
            else px.line(P(u + 0.5, v + t), P(u + 0.5, v + t + 0.26), WHITE);
          }
        }
      } else if (dirtRoad(u, v)) {
        tile(u, v, 0, grass(u, v));
        px.poly([P(u, v + 0.2), P(u + 1, v + 0.2), P(u + 1, v + 0.8), P(u, v + 0.8)], speckled(st.dirt, 0.16));
      } else if (pitch(u, v)) {
        tile(u, v, 0, (x, y) => lit(st.grass[1], (Math.floor((x + 2 * y) / 8) & 1 ? 1 : 0.93), x, y));
      } else if (plaza(u, v)) {
        tile(u, v, 0, grass(u, v));
      } else tile(u, v, z, grass(u, v));

      // Bluff faces where the raised land meets lower ground or the edge of the scene.
      if (z > 0) {
        const earth: WallPaint = (_t, k, x, y) => lit(st.earth, (k > z - 3 ? 1.05 : 0.9) * (noise(x, y, 2) < 0.2 ? 0.85 : 1), x, y);
        if (height(u, v + 1) < z || v === G - 1) px.wall(P(u, v + 1), P(u + 1, v + 1), z, (t, k, x, y) => shade(earth(t, k, x, y)!, LEFT));
        if (u === G - 1 || height(u + 1, v) < z) px.wall(P(u + 1, v + 1), P(u + 1, v), z, (t, k, x, y) => shade(earth(t, k, x, y)!, RIGHT));
      }
    }
  }
  // Plaza paths (a cross) and pitch lines.
  for (const [a, b] of [
    [P(6, 2.5), P(9, 2.5)],
    [P(7.5, 1), P(7.5, 4)],
  ] as [Pt, Pt][]) {
    for (const d of [-2, -1, 0, 1, 2]) px.line([a[0], a[1] + d], [b[0], b[1] + d], d === -2 || d === 2 ? shade(st.sand, 0.85) : st.sand);
  }
  for (const [a, b] of [
    [P(7.1, 10.15), P(10.9, 10.15)],
    [P(7.1, 10.85), P(10.9, 10.85)],
    [P(7.1, 10.15), P(7.1, 10.85)],
    [P(10.9, 10.15), P(10.9, 10.85)],
    [P(9, 10.15), P(9, 10.85)],
  ] as [Pt, Pt][]) px.line(a, b, WHITE);

  // ------------------------------------------------------------ pieces

  interface Feature {
    t0: number;
    t1: number;
    k0: number;
    k1: number;
    c: RGB;
  }
  type Texture = 'plain' | 'brick' | 'sheet';

  const wallPaint = (base: RGB, light: number, tex: Texture, feats: Feature[] = []): WallPaint => (t, k, x, y) => {
    for (const f of feats) if (t >= f.t0 && t < f.t1 && k >= f.k0 && k < f.k1) return lit(f.c, light, x, y);
    if (tex === 'brick') {
      const row = Math.floor(k / 3);
      if (k % 3 === 2 || (t + (row & 1) * 3) % 6 === 0) return lit(st.mortar, light * 0.92, x, y);
      return lit(base, light * (noise(Math.floor(t / 6) + row * 7, row, 11) < 0.25 ? 0.9 : 1), x, y);
    }
    if (tex === 'sheet') return lit(base, light * (t % 3 === 0 ? 0.8 : 1) * (noise(t, k >> 2, 6) < 0.06 ? 0.75 : 1), x, y);
    return lit(base, light * (k < 1 ? 0.85 : 1), x, y);
  };

  /** A box on footprint (u0, v0)-(u1, v1); `front` is the face towards +v (left on screen), `side` the one towards +u. */
  const box = (u0: number, v0: number, u1: number, v1: number, z0: number, h: number, front: WallPaint, side: WallPaint, top: (x: number, y: number) => RGB | null) => {
    px.wall(P(u0, v1, z0), P(u1, v1, z0), h, front);
    px.wall(P(u1, v1, z0), P(u1, v0, z0), h, side);
    px.poly([P(u0, v0, z0 + h), P(u1, v0, z0 + h), P(u1, v1, z0 + h), P(u0, v1, z0 + h)], top);
    const z1 = z0 + h;
    edge(P(u0, v1, z0), P(u0, v1, z1));
    edge(P(u1, v0, z0), P(u1, v0, z1));
    edge(P(u0, v1, z0), P(u1, v1, z0));
    edge(P(u1, v1, z0), P(u1, v0, z0));
    edge(P(u0, v0, z1), P(u1, v0, z1));
    edge(P(u0, v0, z1), P(u0, v1, z1));
    edge(P(u0, v1, z1), P(u1, v1, z1), st.outline ? mix(st.outline, WHITE, 0.25) : null);
    edge(P(u1, v1, z1), P(u1, v0, z1), st.outline ? mix(st.outline, WHITE, 0.25) : null);
    edge(P(u1, v1, z0), P(u1, v1, z1), st.outline ? mix(st.outline, WHITE, 0.25) : null);
  };
  const flat = (c: RGB) => (x: number, y: number) => lit(c, TOP, x, y);

  /** Gable roof with its ridge along u, on top of a box. */
  const gable = (u0: number, v0: number, u1: number, v1: number, z: number, rise: number, c: RGB, wall: RGB, tex: Texture = 'plain') => {
    const vm = (v0 + v1) / 2;
    const rows = (f: number) => (x: number, y: number) => lit(c, f * (tex === 'sheet' ? ((x + 2 * y) % 4 === 0 ? 0.82 : 1) : y % 3 === 0 ? 0.84 : 1), x, y);
    px.poly([P(u0, v0, z), P(u1, v0, z), P(u1, vm, z + rise), P(u0, vm, z + rise)], rows(0.7));
    px.poly([P(u1, v1, z), P(u1, v0, z), P(u1, vm, z + rise)], (x, y) => lit(wall, RIGHT, x, y));
    px.poly([P(u0, v1, z), P(u1, v1, z), P(u1, vm, z + rise), P(u0, vm, z + rise)], rows(1));
    edge(P(u0, vm, z + rise), P(u1, vm, z + rise));
    edge(P(u0, v1, z), P(u0, vm, z + rise));
    edge(P(u1, v1, z), P(u1, vm, z + rise));
    edge(P(u1, v0, z), P(u1, vm, z + rise));
    edge(P(u0, v1, z), P(u1, v1, z));
  };

  /** Rooftop water tank on four legs. */
  const tank = (u: number, v: number, z: number) => {
    const c = hex('#6f8fa8');
    box(u, v, u + 0.2, v + 0.2, z + 2, 4, wallPaint(c, LEFT, 'plain'), wallPaint(c, RIGHT, 'plain'), flat(shade(c, 1.25)));
    for (const [a, b] of [
      [u, v + 0.2],
      [u + 0.2, v + 0.2],
      [u + 0.2, v],
    ]) px.line(P(a, b, z), P(a, b, z + 2), hex('#3a3a3a'));
  };

  const door = (t: number, c = st.wood): Feature => ({ t0: t, t1: t + 3, k0: 0, k1: 7, c });
  const win = (t: number, k: number, w = 3, h = 4, c = st.glass): Feature => ({ t0: t, t1: t + w, k0: k, k1: k + h, c });

  /** Long low "casa chorizo": tall shuttered windows, cornice, flat roof with a parapet. */
  const casaChorizo = (u: number, v: number, c: RGB) => {
    const f = [door(6), win(1, 4, 3, 6, st.shutter), win(10, 4, 3, 6, st.shutter), { t0: 0, t1: 99, k0: 12, k1: 14, c: shade(c, 1.12) }, { t0: 0, t1: 99, k0: 11, k1: 12, c: shade(c, 0.8) }];
    box(u + 0.08, v + 0.12, u + 0.94, v + 0.92, 0, 14, wallPaint(c, LEFT, 'plain', f), wallPaint(c, RIGHT, 'plain', [win(4, 5, 3, 5, st.shutter), { t0: 0, t1: 99, k0: 12, k1: 14, c: shade(c, 1.12) }]), flat(shade(c, 1.08)));
    px.poly([P(u + 0.2, v + 0.24, 14), P(u + 0.82, v + 0.24, 14), P(u + 0.82, v + 0.8, 14), P(u + 0.2, v + 0.8, 14)], flat(shade(st.concrete, 0.85)));
  };

  /** Chalet: white walls, tiled gable roof and a chimney. */
  const chalet = (u: number, v: number, c: RGB) => {
    const u0 = u + 0.12;
    const v0 = v + 0.18;
    const u1 = u + 0.9;
    const v1 = v + 0.88;
    px.wall(P(u0, v1), P(u1, v1), 9, wallPaint(c, LEFT, 'plain', [door(2), win(8, 3, 4, 4)]));
    px.wall(P(u1, v1), P(u1, v0), 9, wallPaint(c, RIGHT, 'plain', [win(4, 3, 3, 4)]));
    edge(P(u0, v1), P(u0, v1, 9));
    edge(P(u1, v1), P(u1, v1, 9));
    edge(P(u1, v0), P(u1, v0, 9));
    edge(P(u0, v1), P(u1, v1));
    edge(P(u1, v1), P(u1, v0));
    gable(u0 - 0.05, v0 - 0.05, u1 + 0.05, v1 + 0.05, 9, 8, st.roofTile, c);
    box(u + 0.62, v + 0.4, u + 0.74, v + 0.52, 12, 8, wallPaint(st.brick, LEFT, 'plain'), wallPaint(st.brick, RIGHT, 'plain'), flat(st.concrete));
  };

  /** Bare hollow-brick house, concrete slab, water tank and rebar waiting for a second floor. */
  const ladrillo = (u: number, v: number) => {
    const f = [door(8, hex('#5d6a70')), win(2, 4, 4, 4, hex('#7a858a'))];
    box(u + 0.1, v + 0.16, u + 0.9, v + 0.9, 0, 12, wallPaint(st.brick, LEFT, 'brick', f), wallPaint(st.brick, RIGHT, 'brick', [win(5, 4, 3, 3, hex('#7a858a'))]), flat(st.concrete));
    tank(u + 0.25, v + 0.3, 12);
    for (const [a, b] of [
      [0.14, 0.86],
      [0.86, 0.86],
      [0.86, 0.2],
      [0.5, 0.86],
    ]) px.line(P(u + a, v + b, 12), P(u + a, v + b, 17), hex('#6b3a2a'));
  };

  /** Three-storey block: balconies to the street, a blank party wall to the side. */
  const edificio = (u: number, v: number, c: RGB) => {
    const f: Feature[] = [door(6, st.glass)];
    for (let floor = 0; floor < 3; floor++) {
      const k = floor * 10;
      if (floor > 0) {
        f.push({ t0: 0, t1: 99, k0: k, k1: k + 1, c: shade(c, 0.7) });
        f.push({ t0: 1, t1: 12, k0: k + 1, k1: k + 3, c: shade(st.concrete, 0.95) });
      }
      for (const t of [1, 5, 9]) if (floor > 0 || t !== 5) f.push(win(t, k + 4, 3, 5));
    }
    const side: WallPaint = (t, k, x, y) => lit(c, RIGHT * (noise(t >> 1, k >> 2, 8) < 0.18 ? 0.9 : 1) * (k > 27 ? 0.92 : 1), x, y);
    box(u + 0.08, v + 0.1, u + 0.92, v + 0.92, 0, 32, wallPaint(c, LEFT, 'plain', f), side, flat(st.concrete));
    tank(u + 0.5, v + 0.25, 32);
  };

  /** Shop with a striped awning over the pavement and a sign band. */
  const comercio = (u: number, v: number, c: RGB, a1: RGB, a2: RGB, tall = 13) => {
    const f = [door(2, st.glass), win(6, 1, 6, 6), { t0: 0, t1: 99, k0: tall - 4, k1: tall - 1, c: a1 }];
    box(u + 0.1, v + 0.2, u + 0.92, v + 0.86, 0, tall, wallPaint(c, LEFT, 'plain', f), wallPaint(c, RIGHT, 'plain', [{ t0: 0, t1: 99, k0: tall - 4, k1: tall - 1, c: a1 }]), flat(st.concrete));
    px.poly([P(u + 0.1, v + 0.86, 9), P(u + 0.92, v + 0.86, 9), P(u + 0.92, v + 1.08, 6), P(u + 0.1, v + 1.08, 6)], (x, y) => lit(Math.floor((x - 2 * y) / 3) & 1 ? a1 : a2, 1, x, y));
    edge(P(u + 0.1, v + 1.08, 6), P(u + 0.92, v + 1.08, 6));
  };

  /** Corner kiosk: a small bright box with its awning. */
  const kiosco = (u: number, v: number) => {
    const c = hex('#f3c84a');
    const red = hex('#c9342c');
    box(u + 0.3, v + 0.34, u + 0.82, v + 0.8, 0, 8, wallPaint(c, LEFT, 'plain', [win(1, 2, 6, 3), { t0: 0, t1: 99, k0: 6, k1: 8, c: red }]), wallPaint(c, RIGHT, 'plain', [{ t0: 0, t1: 99, k0: 6, k1: 8, c: red }]), flat(shade(red, 0.9)));
    px.poly([P(u + 0.3, v + 0.8, 6), P(u + 0.82, v + 0.8, 6), P(u + 0.82, v + 0.98, 4), P(u + 0.3, v + 0.98, 4)], (x, y) => (Math.floor((x - 2 * y) / 2) & 1 ? red : WHITE));
  };

  /** Sheet-metal warehouse on a 2x2 footprint. */
  const galpon = (u: number, v: number) => {
    const f = [{ t0: 9, t1: 21, k0: 0, k1: 10, c: shade(st.sheet, 0.55) }, win(2, 8, 4, 2), win(24, 8, 4, 2)];
    px.wall(P(u + 0.1, v + 1.9), P(u + 1.9, v + 1.9), 13, wallPaint(st.sheet, LEFT, 'sheet', f));
    px.wall(P(u + 1.9, v + 1.9), P(u + 1.9, v + 0.1), 13, wallPaint(st.sheet, RIGHT, 'sheet'));
    edge(P(u + 0.1, v + 1.9), P(u + 0.1, v + 1.9, 13));
    edge(P(u + 1.9, v + 0.1), P(u + 1.9, v + 0.1, 13));
    edge(P(u + 0.1, v + 1.9), P(u + 1.9, v + 1.9));
    edge(P(u + 1.9, v + 1.9), P(u + 1.9, v + 0.1));
    gable(u + 0.05, v + 0.05, u + 1.95, v + 1.95, 13, 9, shade(st.sheet, 1.12), st.sheet, 'sheet');
  };

  const cylinder = (u: number, v: number, r: number, h: number, c: RGB, cap: RGB) => {
    const [cx, cy] = P(u, v);
    for (let x = -r; x < r; x++) {
      const dy = Math.round(Math.sqrt(1 - ((x + 0.5) / r) ** 2) * (r / 2));
      const f = 1.05 - ((x + r) / (2 * r)) * 0.5;
      for (let k = -dy; k < h + dy; k++) {
        const y = Math.round(cy) - 1 - k;
        if (k >= h - dy) px.set(Math.round(cx) + x, y, lit(cap, 1, x, y));
        else px.set(Math.round(cx) + x, y, lit(c, f * (k % 5 === 4 ? 0.88 : 1), Math.round(cx) + x, y));
      }
    }
    if (st.outline) {
      px.line([cx - r, cy - 1], [cx - r, cy - h], st.outline);
      px.line([cx + r - 1, cy - 1], [cx + r - 1, cy - h], st.outline);
    }
  };

  const chimney = (u: number, v: number) => {
    for (let b = 0; b < 6; b++) {
      const c = b & 1 ? WHITE : hex('#c9342c');
      box(u, v, u + 0.2, v + 0.2, b * 6, 6, wallPaint(c, LEFT, 'plain'), wallPaint(c, RIGHT, 'plain'), flat(hex('#3a3a3a')));
    }
  };

  const tree = (u: number, v: number, kind: TreeKind, z = 0) => {
    const [bx, by] = P(u, v, z);
    const x = Math.round(bx);
    const y = Math.round(by);
    const c = st.leaves[kind];
    const tones: [RGB, RGB, RGB] = [shade(c, 1.22), c, shade(c, 0.72)];
    const dark = st.outline;
    const trunk = (w: number, h: number, col = st.trunk) => {
      px.rect(x - (w >> 1), y - h, w, h, col);
      px.rect(x - (w >> 1), y - h, 1, h, shade(col, 1.25));
    };
    // Ground shadow.
    for (let i = -5; i <= 5; i++) for (let j = -1; j <= 1; j++) if ((i + j) & 1) px.set(x + i + 2, y + j, shade(st.grass[2], 0.8));
    if (kind === 'jacaranda') {
      trunk(2, 8);
      px.blob(x - 3, y - 11, 6, 4.5, tones, dark, st.dither);
      px.blob(x + 3, y - 13, 6.5, 5, tones, dark, st.dither);
      for (let i = 0; i < 7; i++) px.set(x - 7 + Math.floor(noise(i, 1, x) * 15), y - 1 + Math.floor(noise(i, 2, y) * 3), tones[0]); // fallen flowers
    } else if (kind === 'tipa') {
      trunk(2, 9);
      px.blob(x, y - 13, 10, 5.5, tones, dark, st.dither);
    } else if (kind === 'borracho') {
      trunk(2, 10, hex('#7f8f6a'));
      px.rect(x - 2, y - 6, 4, 4, hex('#7f8f6a')); // the bottle-shaped trunk
      px.blob(x, y - 14, 7, 4.5, tones, dark, st.dither);
      for (let i = 0; i < 9; i++) px.set(x - 5 + Math.floor(noise(i, 3, x) * 11), y - 17 + Math.floor(noise(i, 4, y) * 6), hex('#e87fa8'));
    } else if (kind === 'eucalipto') {
      trunk(2, 18, hex('#c9bfae'));
      px.blob(x - 1, y - 20, 4.5, 7, tones, dark, st.dither);
      px.blob(x + 2, y - 15, 4, 5, tones, dark, st.dither);
    } else if (kind === 'alamo') {
      trunk(1, 5);
      px.blob(x, y - 15, 3, 11, tones, dark, st.dither);
    } else {
      // Ombú: a wide low crown on a massive trunk with spreading roots.
      px.rect(x - 3, y - 6, 6, 6, st.trunk);
      px.rect(x - 5, y - 2, 10, 2, shade(st.trunk, 0.85));
      px.blob(x, y - 11, 13, 6.5, tones, dark, st.dither);
    }
  };

  const flag = (u: number, v: number) => {
    const [bx, by] = P(u, v);
    const x = Math.round(bx);
    const y = Math.round(by);
    px.rect(x, y - 22, 1, 22, hex('#d9d4cc'));
    const celeste = hex('#74acdf');
    px.rect(x + 1, y - 22, 9, 2, celeste);
    px.rect(x + 1, y - 20, 9, 2, WHITE);
    px.rect(x + 1, y - 18, 9, 2, celeste);
    px.set(x + 5, y - 20, hex('#f6b40e'));
    px.set(x + 5, y - 19, hex('#f6b40e'));
  };

  /** A city bus ("colectivo") driving along a street that runs along u. */
  const colectivo = (u: number, v: number, c: RGB, stripe: RGB) => {
    const f = [{ t0: 0, t1: 99, k0: 3, k1: 6, c: st.glass }, { t0: 0, t1: 99, k0: 1, k1: 2, c: stripe }];
    box(u + 0.1, v + 0.3, u + 1.0, v + 0.62, 1, 8, wallPaint(c, LEFT, 'plain', f), wallPaint(c, RIGHT, 'plain', [{ t0: 1, t1: 4, k0: 3, k1: 6, c: st.glass }]), flat(shade(c, 1.1)));
  };
  const car = (u: number, v: number, c: RGB) => {
    box(u + 0.3, v + 0.36, u + 0.78, v + 0.6, 1, 3, wallPaint(c, LEFT, 'plain'), wallPaint(c, RIGHT, 'plain'), flat(c));
    box(u + 0.4, v + 0.38, u + 0.66, v + 0.58, 4, 2, wallPaint(st.glass, LEFT, 'plain'), wallPaint(st.glass, RIGHT, 'plain'), flat(shade(c, 1.1)));
  };
  const goal = (u: number, v: number) => {
    px.line(P(u, v + 0.3, 0), P(u, v + 0.3, 5), WHITE);
    px.line(P(u, v + 0.7, 0), P(u, v + 0.7, 5), WHITE);
    px.line(P(u, v + 0.3, 5), P(u, v + 0.7, 5), WHITE);
  };

  // ------------------------------------------------------------ the neighbourhood

  const w = st.walls;
  const items: { depth: number; draw: () => void }[] = [];
  const put = (u: number, v: number, draw: () => void, size = 1) => items.push({ depth: u + v + (size - 1) * 2 + 1, draw });

  // Homes along the two streets, back yards with trees.
  put(0, 4, () => casaChorizo(0, 4, w[0]));
  put(1, 4, () => chalet(1, 4, w[3]));
  put(2, 4, () => ladrillo(2, 4));
  put(3, 4, () => chalet(3, 4, w[1]));
  put(4, 4, () => edificio(4, 4, w[2]));
  put(4, 3, () => casaChorizo(4, 3, w[4]));
  put(4, 2, () => ladrillo(4, 2));
  put(4, 1, () => chalet(4, 1, w[0]));
  put(4, 0, () => casaChorizo(4, 0, w[1]));
  put(1, 2, () => tree(1.5, 2.5, 'jacaranda'));
  put(2, 1, () => tree(2.6, 1.5, 'tipa'));
  put(0, 1, () => tree(0.5, 1.4, 'borracho'));
  put(3, 3, () => tree(3.3, 3.3, 'alamo'));
  put(0, 3, () => tree(0.5, 3.3, 'jacaranda'));
  put(2, 2, () => chalet(2, 2.6, w[2]));

  // Shops on the avenue, the plaza behind them.
  put(6, 4, () => kiosco(6, 4));
  put(7, 4, () => comercio(7, 4, w[3], hex('#c9342c'), WHITE));
  put(8, 4, () => comercio(8, 4, w[1], hex('#2f7a4a'), WHITE, 15));
  put(9, 4, () => edificio(9, 4, w[0]));
  put(7, 2, () => flag(7.5, 2.5));
  put(6, 1, () => tree(6.5, 1.5, 'jacaranda'));
  put(8, 1, () => tree(8.5, 1.5, 'borracho'));
  put(6, 3, () => tree(6.5, 3.4, 'tipa'));
  put(8, 3, () => tree(8.5, 3.4, 'jacaranda'));
  put(9, 2, () => casaChorizo(9, 2, w[4]));
  put(9, 1, () => chalet(9, 1, w[3]));
  put(9, 0, () => ladrillo(9, 0));
  put(7, 0, () => chalet(7, 0, w[1]));
  put(6, 0, () => casaChorizo(6, 0, w[2]));

  // The bluff: a windbreak of poplars, eucalyptus and an ombú.
  for (const v of [0, 1, 2, 3]) put(13, v, () => tree(13.5, v + 0.5, 'alamo', 10));
  put(11, 1, () => tree(11.5, 1.5, 'ombu', 10));
  put(10, 3, () => tree(10.6, 3.4, 'eucalipto', 10));
  put(12, 3, () => tree(12.4, 3.5, 'eucalipto', 10));
  put(11, 0, () => tree(11.3, 0.5, 'eucalipto', 10));

  // South of the avenue: the factory to the west, homes and vacant lots to the east.
  put(1, 7, () => galpon(1, 7), 2);
  put(3, 7, () => cylinder(3.5, 7.5, 6, 22, st.sheet, shade(st.sheet, 1.2)));
  put(3, 8, () => cylinder(3.5, 8.45, 6, 22, st.sheet, shade(st.sheet, 1.2)));
  put(0, 7, () => chimney(0.4, 7.3));
  put(0, 6, () => ladrillo(0, 6));
  put(1, 6, () => ladrillo(1, 6));
  put(2, 6, () => casaChorizo(2, 6, w[0]));
  put(3, 6, () => comercio(3, 6, w[4], hex('#2f5fa8'), WHITE));
  put(4, 6, () => chalet(4, 6, w[3]));
  put(4, 8, () => tree(4.5, 8.5, 'tipa'));
  put(0, 9, () => tree(0.6, 9.5, 'eucalipto'));
  put(2, 10, () => tree(2.5, 10.4, 'alamo'));
  put(3, 10, () => tree(3.5, 10.4, 'alamo'));
  put(6, 6, () => chalet(6, 6, w[1]));
  put(7, 6, () => ladrillo(7, 6));
  put(8, 6, () => casaChorizo(8, 6, w[2]));
  put(9, 6, () => chalet(9, 6, w[0]));
  put(10, 6, () => ladrillo(10, 6));
  put(11, 6, () => tree(11.5, 6.5, 'jacaranda'));
  put(12, 6, () => casaChorizo(12, 6, w[3]));
  put(13, 6, () => tree(13.5, 6.5, 'tipa'));
  put(6, 8, () => ladrillo(6, 8));
  put(7, 8, () => tree(7.5, 8.4, 'borracho'));
  put(8, 8, () => ladrillo(8, 8));
  put(9, 8, () => chalet(9, 8, w[4]));
  put(11, 8, () => tree(11.4, 8.5, 'ombu'));
  put(13, 8, () => ladrillo(13, 8));
  put(7, 10, () => goal(7.12, 10));
  put(10, 10, () => goal(10.88, 10));
  put(12, 10, () => tree(12.5, 10.5, 'eucalipto'));
  put(6, 7, () => tree(6.5, 7.5, 'alamo'));

  // Traffic.
  put(2, 5, () => colectivo(2, 5, hex('#c9342c'), WHITE));
  put(10, 5, () => colectivo(10, 5, hex('#2f7a4a'), hex('#f3c84a')));
  put(7, 5, () => car(7, 5, hex('#f4efe2')));
  put(12, 5, () => car(12, 5, hex('#2f5fa8')));

  items.sort((a, b) => a.depth - b.depth);
  for (const it of items) it.draw();
  return px;
}
