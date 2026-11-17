/**
 * Pixel art for the zone buildings, painted at 1x with hard pixels and a closed palette.
 *
 * This module is additive on purpose: nothing in the game uses it until `ART.residential` is on
 * (see `artSwitch.ts`), so the pixel pass can be shown and withdrawn without touching the rest of
 * the sprites, which are still being worked on in parallel.
 *
 * The tone ramps come from the reference measured in `odd/tasks/estetica.md`: a cream wall shows
 * its two visible faces at 0.69 and 0.59 of its base colour. Footprints are the game's 32 x 16 px
 * cell and the anchor is the top corner of the diamond, the same one `sprites.ts` uses, so either
 * painter can be plugged into the map renderer.
 */
import { Pixels, bayer, hex, noise, shade, type Paint, type Pt, type RGB, type WallPaint } from './pixel';
import type { Sprite } from './sprites';
import { BUS_COLORS, type PlantKind } from '../config';

/** Face tones measured on the reference. */
const LEFT = 0.69;
const RIGHT = 0.59;

/** A material as its three visible values: the top, the left face and the right face. */
type Ramp = [RGB, RGB, RGB];
const ramp = (c: string): Ramp => tone(hex(c));
/** The same, from a colour that is already resolved. */
const tone = (c: RGB): Ramp => [c, shade(c, LEFT), shade(c, RIGHT)];

const WALLS = ['#f6f2e8', '#f4c1a6', '#ccdae4', '#f5dfa3', '#cfe3b8', '#fffce6'].map(ramp);
const ROOFS = ['#c74625', '#a73b1f', '#cb632f', '#944822'].map(ramp);
const BRICK = ramp('#b6592a');
const BRICK_DARK = ramp('#944822');
const CHAPA = ramp('#92a0a7');
const CHAPA_RUST = ramp('#9b6a54');
const CONCRETE = ramp('#a9a395');
const ROOFTOP = hex('#b9b6ad');
const PERGOLA = ramp('#2f7a4a');
const TOWER_WALL = ramp('#c3cfd4');
/** The dark inside of a shop, and the warm light of the ones that are open. */
const INSIDE = hex('#2e2620');
const WARM = hex('#d8a24a');
const WOOD = ramp('#8a6a45');
const WOOD_DARK = ramp('#6b3f22');
const POLE: [RGB, RGB] = [hex('#c8392f'), hex('#f4ece0')];
/** The flag on the roof of the offices: light blue over white over light blue. */
const FLAG: [RGB, RGB] = [hex('#74acdf'), hex('#f4ece0')];
/** The colour a factory paints its sign band with: oxide, steel, tar. Nothing showy. */
const COMPANY = ['#3d4a52', '#5a3a2a', '#2f4a3a', '#4a4652'].map(hex);
/** The colour each shop paints its sign band with. */
const SIGNS = ['#c8392f', '#2f7a4a', '#2f5fa8', '#e0a526', '#8a3f7a'].map(hex);
const AWNING: [RGB, RGB] = [hex('#2f7a4a'), hex('#f4ece0')];
const RAIL = hex('#d8d2c4');
const FENCE = hex('#b9b2a4');
const TANK = ramp('#6f8fa8');
/** Industrial materials: steel galvanised and rusted, silo plate, and the red of the skyline. */
const STEEL = ramp('#93a0a8');
const SILO = ramp('#d8dee4');
/** The deck of an industrial roof: darker than the concrete of a house, so the plane stops shouting. */
const ROOF_DECK = shade(ROOFTOP, 0.84);
const ORE: [RGB, RGB] = [hex('#4a4a4f'), hex('#2f2f33')];
const STACK: [RGB, RGB] = [hex('#c8392f'), hex('#f4ece0')];
const GLASS = hex('#43606f');
const GLASS_LIT = hex('#7fa3b8');
const DOOR = hex('#5f3d25');
const GARAGE = hex('#4a4c52');
const SHUTTER = hex('#2f7a4a');
const TRUNK = hex('#61472d');
const BUSH: [RGB, RGB] = [hex('#5a8f45'), hex('#3f6f34')];
const LEG = hex('#3a3a3a');

/** A detail painted onto a wall, in wall coordinates: `t` px along the wall, `k` px above its foot. */
interface Patch {
  t0: number;
  t1: number;
  k0: number;
  k1: number;
  c: RGB;
}
type Tex = 'plain' | 'brick' | 'sheet';

/** Wall paint: one material, its texture, its details, and the light that falls on it. */
function face(base: RGB, tex: Tex, patches: Patch[], h: number): WallPaint {
  return (t, k, x, y) => {
    for (const p of patches) if (t >= p.t0 && t < p.t1 && k >= p.k0 && k < p.k1) return p.c;
    let c = base;
    if (tex === 'brick') {
      const row = Math.floor(k / 4);
      if (k % 4 === 3 || (t + (row & 1) * 3) % 7 === 0) return shade(base, 1.3);
      // Each brick a touch different, so the wall is not one flat block of colour.
      if (noise(Math.floor(t / 4), row, 11) < 0.34) c = shade(base, 0.93);
    } else if (tex === 'sheet' && t % 3 === 0) c = shade(base, 0.84);
    return volume(c, k, h, x, y);
  };
}

/**
 * The light on a wall: the foot sits in shadow, the top catches the sky, and the two seams are
 * dithered so the change of tone reads as light and not as a stripe.
 */
function volume(base: RGB, k: number, h: number, x: number, y: number): RGB {
  const d = h < 6 ? 1 : 2;
  if (k < d) return shade(base, 0.82);
  if (k === d) return bayer(x, y) < 0.5 ? shade(base, 0.82) : base;
  if (k >= h - d) return shade(base, 1.14);
  if (k === h - d - 1) return bayer(x, y) < 0.5 ? base : shade(base, 1.14);
  return base;
}

/** A band of windows with a lit top row, so it reads as glass and not as a hole in the wall. */
function ribbonIn(t0: number, t1: number, k0: number, h: number, glass: RGB): Patch[] {
  return [
    { t0, t1, k0, k1: k0 + h - 1, c: glass },
    { t0, t1, k0: k0 + h - 1, k1: k0 + h, c: shade(glass, 1.7) },
  ];
}

function ribbon(t0: number, t1: number, k0: number, h: number): Patch[] {
  return ribbonIn(t0, t1, k0, h, GLASS);
}

/** A glazed band: the mullions that break it into panes, then the glass and its lit top row. */
function glazed(t0: number, t1: number, k0: number, h: number, step = 5, glass: RGB = GLASS): Patch[] {
  const out: Patch[] = [];
  for (let t = t0; t < t1; t += step) out.push({ t0: t, t1: t + 1, k0, k1: k0 + h - 1, c: shade(glass, 0.76) });
  return out.concat(ribbonIn(t0, t1, k0, h, glass));
}

const door = (t: number, w = 4, h = 7): Patch => ({ t0: t, t1: t + w, k0: 0, k1: h, c: DOOR });
const pane = (t: number, k: number, w = 3, h = 4, c: RGB = GLASS): Patch => ({ t0: t, t1: t + w, k0: k, k1: k + h, c });
const shutter = (t: number, k: number, w = 3, h = 6): Patch => ({ t0: t, t1: t + w, k0: k, k1: k + h, c: SHUTTER });
/** The iron bars over a window: one dark pixel every two, so the reja reads at 1x. */
const reja = (t: number, k: number, w = 3, h = 6): Patch[] =>
  Array.from({ length: Math.ceil(w / 2) }, (_, i) => ({ t0: t + i * 2, t1: t + i * 2 + 1, k0: k, k1: k + h, c: LEG }));

class Pen {
  /** Chimney mouths, relative to the anchor, that the renderer turns into smoke. */
  readonly smoke: [number, number][] = [];

  constructor(
    readonly px: Pixels,
    readonly ax: number,
    readonly ay: number,
  ) {}

  /** Footprint coordinates (cell units) and height in px → sprite pixel. */
  P(u: number, v: number, z = 0): Pt {
    return [this.ax + 16 * (u - v), this.ay + 8 * (u + v) - z];
  }

  poly(pts: Pt[], paint: Paint): void {
    this.px.poly(pts, paint);
  }

  /** A box standing on the footprint, `h` px tall, with details on both visible faces. */
  box(
    u0: number,
    v0: number,
    u1: number,
    v1: number,
    z0: number,
    h: number,
    base: Ramp,
    tex: Tex,
    front: Patch[] = [],
    side: Patch[] = [],
    top: RGB = base[0],
  ): void {
    this.px.wall(this.P(u0, v1, z0), this.P(u1, v1, z0), h, face(base[1], tex, front, h));
    this.px.wall(this.P(u1, v1, z0), this.P(u1, v0, z0), h, face(base[2], tex, side, h));
    this.poly(
      [this.P(u0, v0, z0 + h), this.P(u1, v0, z0 + h), this.P(u1, v1, z0 + h), this.P(u0, v1, z0 + h)],
      (x, y) => (bayer(x, y) < 0.45 ? shade(top, 0.95) : top),
    );
  }

  /** A gable roof with its ridge along u: the slope towards the viewer is the lit one. */
  gable(u0: number, v0: number, u1: number, v1: number, z: number, rise: number, roof: Ramp, wall: RGB, tex: Tex): void {
    const vm = (v0 + v1) / 2;
    const rows = (f: number): Paint => (x, y) =>
      shade(roof[0], tex === 'sheet' ? ((x + 2 * y) % 4 === 0 ? f * 0.84 : f) : y % 3 === 0 ? f * 0.88 : f);
    this.poly([this.P(u0, v0, z), this.P(u1, v0, z), this.P(u1, vm, z + rise), this.P(u0, vm, z + rise)], rows(0.68));
    this.poly([this.P(u1, v1, z), this.P(u1, v0, z), this.P(u1, vm, z + rise)], () => wall);
    this.poly([this.P(u0, v1, z), this.P(u1, v1, z), this.P(u1, vm, z + rise), this.P(u0, vm, z + rise)], rows(1));
    // The ridge catches the sky and the eave casts a line on the wall: the roof stops being a plane.
    this.px.line(this.P(u0, vm, z + rise), this.P(u1, vm, z + rise), shade(roof[0], 1.22));
    this.px.line(this.P(u0, v1, z), this.P(u1, v1, z), shade(roof[0], 0.62));
  }

  /** A hip roof: four slopes around an apex, each with its own tone. */
  hip(u0: number, v0: number, u1: number, v1: number, z: number, rise: number, roof: Ramp): void {
    const apex = this.P((u0 + u1) / 2, (v0 + v1) / 2, z + rise);
    this.poly([this.P(u0, v0, z), this.P(u1, v0, z), apex], () => shade(roof[0], 0.72));
    this.poly([this.P(u0, v0, z), this.P(u0, v1, z), apex], () => shade(roof[0], 0.88));
    this.poly([this.P(u1, v0, z), this.P(u1, v1, z), apex], () => shade(roof[0], 0.8));
    this.poly([this.P(u0, v1, z), this.P(u1, v1, z), apex], () => shade(roof[0], 1));
  }

  /** A parapet standing on the roof edge: the front run and the side run. */
  parapet(u0: number, v0: number, u1: number, v1: number, z: number, h: number, base: Ramp): void {
    this.px.wall(this.P(u0, v1, z), this.P(u1, v1, z), h, () => base[1]);
    this.px.wall(this.P(u1, v1, z), this.P(u1, v0, z), h, () => base[2]);
  }

  /** A cornice: a slab that sticks out past the walls, so the top of the building casts a line. */
  cornice(u0: number, v0: number, u1: number, v1: number, z: number, h: number, base: Ramp, deck: RGB = ROOF_DECK): void {
    const o = 0.035;
    this.box(u0 - o, v0 - o, u1 + o, v1 + o, z, h, base, 'plain');
    // The slab is a ring, so the roof inside it stays the deck and not a plate of the wall colour.
    this.poly(
      [this.P(u0, v0, z + h), this.P(u1, v0, z + h), this.P(u1, v1, z + h), this.P(u0, v1, z + h)],
      (x, y) => (bayer(x, y) < 0.45 ? shade(deck, 0.95) : deck),
    );
  }

  /** A balcony slab sticking out of the front wall, with its rail on the outer edge. */
  balcony(u0: number, v1: number, u1: number, z: number): void {
    const d = 0.1;
    this.box(u0, v1, u1, v1 + d, z, 1, CONCRETE, 'plain');
    this.px.wall(this.P(u0, v1 + d, z + 1), this.P(u1, v1 + d, z + 1), 2, () => RAIL);
  }

  /** A striped awning hanging off the front wall and sloping down towards the street. */
  canopy(u0: number, v1: number, u1: number, z: number, a1: RGB, a2: RGB, drop = 3): void {
    const d = 0.14;
    this.poly([this.P(u0, v1, z), this.P(u1, v1, z), this.P(u1, v1 + d, z - drop), this.P(u0, v1 + d, z - drop)], (x, y) =>
      (Math.floor((x - 2 * y) / 3) & 1 ? a1 : a2),
    );
  }

  /** A sawtooth roof: one lit slope per strip along v, the shape of the old factories and the mills. */
  sawtooth(u0: number, v0: number, u1: number, v1: number, z: number, rise: number, n: number, roof: Ramp): void {
    const step = (v1 - v0) / n;
    for (let i = 0; i < n; i++) this.gable(u0, v0 + i * step, u1, v0 + (i + 1) * step, z, rise, roof, roof[2], 'plain');
  }

  /** A low iron fence along a ground segment, with a post every three pixels and a rail. */
  fence(a: Pt, b: Pt): void {
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = Math.round(a[0] + (b[0] - a[0]) * t);
      const y = Math.round(a[1] + (b[1] - a[1]) * t);
      if (i % 3 === 0) this.px.rect(x, y - 2, 1, 2, FENCE);
      this.px.set(x, y - 1, FENCE);
    }
  }

  /** The shadow the building casts on its lot, towards the lower right, since the light is on the left. */
  shadow(u0: number, v0: number, u1: number, v1: number): void {
    const pts = [this.P(u0, v0), this.P(u1, v0), this.P(u1, v1), this.P(u0, v1)].map(([x, y]) => [x + 3, y + 2] as Pt);
    this.px.shadow(pts, 0.34);
  }

  /** A crate of produce on the pavement, with the fruit showing on top. */
  crate(u: number, v: number, fruit: RGB): void {
    this.box(u, v, u + 0.13, v + 0.13, 0, 3, WOOD_DARK, 'plain');
    const [x, y] = this.P(u + 0.065, v + 0.065, 3);
    this.px.rect(Math.round(x) - 1, Math.round(y) - 1, 3, 1, fruit);
  }

  /** The barber pole on the corner of the hairdresser: two columns of red and white rings. */
  barberPole(u: number, v: number, z: number, h: number): void {
    const [x, y] = this.P(u, v, z);
    const cx = Math.round(x);
    const cy = Math.round(y);
    for (let k = 0; k < h; k++) {
      const c = POLE[(k >> 1) & 1];
      this.px.set(cx, cy - k, c);
      this.px.set(cx + 1, cy - k, shade(c, 0.82));
    }
    this.px.rect(cx - 1, cy - h - 1, 4, 1, LEG);
  }

  /** A rooftop water tank on its two visible legs. */
  tank(u: number, v: number, z: number): void {
    this.px.line(this.P(u, v + 0.18, z), this.P(u, v + 0.18, z + 2), LEG);
    this.px.line(this.P(u + 0.18, v, z), this.P(u + 0.18, v, z + 2), LEG);
    this.box(u, v, u + 0.2, v + 0.2, z + 2, 4, TANK, 'plain');
  }

  /** A low bush in the yard. */
  bush(u: number, v: number): void {
    const [x, y] = this.P(u, v);
    const cx = Math.round(x);
    const cy = Math.round(y);
    this.px.rect(cx - 1, cy - 3, 3, 3, BUSH[0]);
    this.px.set(cx + 1, cy - 1, BUSH[1]);
    this.px.set(cx - 1, cy - 1, BUSH[1]);
    this.px.set(cx, cy - 4, BUSH[0]);
  }

  /** A tree in the yard: trunk and a small faceted crown. */
  tree(u: number, v: number): void {
    const [x, y] = this.P(u, v);
    const cx = Math.round(x);
    const cy = Math.round(y);
    this.px.rect(cx, cy - 4, 1, 4, TRUNK);
    this.px.blob(cx, cy - 8, 3, 2.6, [hex('#7fa85c'), hex('#5a8f45'), hex('#3f6f34')], null, false);
  }

  /** The stovepipe of the tin roof, with its cap. */
  pipe(u: number, v: number, z: number, h: number): void {
    const [ax, ay] = this.P(u, v, z);
    this.px.line([ax, ay], [ax, ay - h], LEG);
    this.px.line([ax + 2, ay], [ax + 2, ay - h], LEG);
    this.px.rect(Math.round(ax) - 1, Math.round(ay) - h, 4, 1, LEG);
  }

  /**
   * A factory stack: bands of red and cream up to `h`, its mouth registered as a smoke source so
   * the renderer animates the smoke the same way it does for the art it draws today.
   */
  chimney(u: number, v: number, z0: number, h: number, w = 0.11): void {
    const bands: Patch[] = [];
    for (let k = 0; k < h; k += 3) bands.push({ t0: 0, t1: 99, k0: k, k1: Math.min(k + 3, h), c: Math.floor(k / 3) % 2 ? STACK[1] : STACK[0] });
    this.box(u, v, u + w, v + w, z0, h, [STACK[0], STACK[0], shade(STACK[0], 0.78)], 'plain', bands, bands, shade(STACK[1], 0.82));
    const [x, y] = this.P(u + w / 2, v + w / 2, z0 + h);
    this.smoke.push([Math.round(x - this.ax), Math.round(y - this.ay)]);
  }

  /** A silo: galvanised plate, with the rings at its foot, its waist and its crown, and a cone top. */
  silo(u: number, v: number, w: number, z0: number, h: number, base: Ramp = SILO): void {
    const mid = Math.floor(h / 2);
    const rings: Patch[] = [
      { t0: 0, t1: 99, k0: 0, k1: 1, c: shade(base[1], 0.72) },
      { t0: 0, t1: 99, k0: mid, k1: mid + 1, c: shade(base[1], 0.86) },
      { t0: 0, t1: 99, k0: h - 1, k1: h, c: shade(base[1], 1.25) },
    ];
    this.box(u, v, u + w, v + w, z0, h, base, 'plain', rings, rings, shade(base[0], 1.12));
    this.hip(u, v, u + w, v + w, z0 + h, Math.max(2, Math.round(w * 10)), base);
  }

  /** A spherical tank on its legs: the shape that says chemical plant from a block away. */
  sphere(u: number, v: number, z0: number, r: number, base: Ramp = SILO): void {
    const [x, y] = this.P(u, v, z0 + r + 2);
    const cx = Math.round(x);
    const cy = Math.round(y);
    this.px.rect(cx - r + 1, cy + r, 1, 2, STEEL[2]);
    this.px.rect(cx + r - 1, cy + r, 1, 2, STEEL[2]);
    this.px.blob(cx, cy, r, r - 1, [shade(base[0], 1.16), base[0], base[1]], null, false);
  }

  /** A heap of ore or coal, dark with one lit side. */
  pile(u: number, v: number, w: number, c: RGB = ORE[0]): void {
    const [x, y] = this.P(u + w / 2, v + w / 2);
    this.px.blob(Math.round(x), Math.round(y - 1), Math.max(2, Math.round(w * 9)), Math.max(2, Math.round(w * 4)), [shade(c, 1.45), c, shade(c, 0.66)], null, false);
  }

  /** A run of pipe on its posts, the thing that ties an industrial lot together. */
  pipeRun(a: Pt, b: Pt, c: RGB = STEEL[1]): void {
    this.px.line(a, b, shade(c, 1.2));
    this.px.line([a[0], a[1] + 1], [b[0], b[1] + 1], shade(c, 0.66));
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 8));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(a[0] + ((b[0] - a[0]) * i) / n);
      const y = Math.round(a[1] + ((b[1] - a[1]) * i) / n);
      this.px.set(x, y + 2, STEEL[2]);
    }
  }

  /** A shipping container: a ribbed box in the colour of its company. */
  container(u: number, v: number, c: RGB, z0 = 0): void {
    this.box(u, v, u + 0.42, v + 0.16, z0, 4, [shade(c, 1.05), shade(c, LEFT), shade(c, RIGHT)], 'sheet');
  }

  /** The inclined belt of a cereal plant, from the pit up to the top of the silos. */
  belt(a: Pt, b: Pt): void {
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(a[0] + ((b[0] - a[0]) * i) / n);
      const y = Math.round(a[1] + ((b[1] - a[1]) * i) / n);
      this.px.set(x, y, STEEL[0]);
      this.px.set(x, y + 1, STEEL[2]);
    }
  }

  /** A thin antenna on the roof. */
  antenna(u: number, v: number, z: number, h: number): void {
    const [x, y] = this.P(u, v, z);
    this.px.rect(Math.round(x), Math.round(y) - h, 1, h, LEG);
    this.px.rect(Math.round(x) - 1, Math.round(y) - h + 1, 3, 1, LEG);
  }

  /** A flagpole on the roof, with the flag of the country: light blue, white, light blue. */
  flag(u: number, v: number, z: number, h: number): void {
    const [x, y] = this.P(u, v, z);
    const cx = Math.round(x);
    const cy = Math.round(y);
    this.px.rect(cx, cy - h, 1, h, LEG);
    this.px.rect(cx + 1, cy - h + 1, 3, 1, FLAG[0]);
    this.px.rect(cx + 1, cy - h + 2, 3, 1, FLAG[1]);
    this.px.rect(cx + 1, cy - h + 3, 3, 1, FLAG[0]);
  }
}

/** A pen whose anchor leaves room for a building `maxZ` px tall on a 1 x 1 lot, and for its shadow. */
function pen(maxZ: number): Pen {
  return new Pen(new Pixels(40, maxZ + 24), 20, maxZ + 4);
}

/** Level 1: the bare brick house of the first blocks, tin roof and a stovepipe. */
function humble(p: Pen, v: number): void {
  const u0 = 0.22;
  const v0 = 0.24;
  const u1 = 0.78;
  const v1 = 0.8;
  p.shadow(u0, v0, u1, v1);
  p.box(u0, v0, u1, v1, 0, 10, BRICK, 'brick', [door(5, 4, 6), pane(11, 4, 3, 3)], [pane(6, 4, 2, 3)]);
  p.gable(u0 - 0.03, v0 - 0.04, u1 + 0.03, v1 + 0.04, 10, 4, v % 2 ? CHAPA_RUST : CHAPA, BRICK[1], 'sheet');
  p.pipe(0.56, 0.5, 12, 4);
  if (v % 3 === 0) p.bush(0.1, 0.9);
  else if (v % 3 === 1) p.tree(0.08, 0.88);
}

/** Level 2: the family house, either a tiled gable roof or a flat roof with a tank. */
function family(p: Pen, v: number): void {
  const wall = WALLS[v % WALLS.length];
  const roof = ROOFS[(v >> 1) % ROOFS.length];
  const u0 = 0.26;
  const v0 = 0.3;
  const u1 = 0.76;
  const v1 = 0.74;
  p.shadow(u0, v0, u1, v1);
  p.fence(p.P(0.1, 0.92), p.P(0.62, 0.92));
  p.box(u0, v0, u1, v1, 0, 12, wall, 'plain', [door(4, 4, 7), pane(1, 4, 3, 4), pane(9, 4, 3, 4), { t0: 0, t1: 99, k0: 0, k1: 2, c: shade(wall[1], 0.62) }], [
    pane(2, 4, 3, 4),
    { t0: 0, t1: 99, k0: 0, k1: 2, c: shade(wall[2], 0.62) },
  ]);
  // The chimney goes up before the roof, so the roof covers its base and it reads as coming out of it.
  p.box(0.54, 0.42, 0.64, 0.52, 12, 9, BRICK_DARK, 'brick');
  // A small canopy over the door, on two posts.
  p.poly([p.P(0.28, v1, 9), p.P(0.62, v1, 9), p.P(0.62, v1 + 0.12, 6), p.P(0.28, v1 + 0.12, 6)], () => shade(wall[0], 1.1));
  p.px.rect(Math.round(p.P(0.3, v1 + 0.12, 6)[0]), Math.round(p.P(0.3, v1 + 0.12, 6)[1]), 1, 6, LEG);
  p.gable(u0 - 0.06, v0 - 0.06, u1 + 0.06, v1 + 0.06, 12, 8, roof, wall[1], 'plain');
  if (v % 2 === 0) p.tree(0.12, 0.9);
  else p.bush(0.12, 0.9);
}

/** Level 3: the "casa chorizo", wide and low, with a cornice, rejas and a pergola on the roof. */
function chorizo(p: Pen, v: number): void {
  const wall = WALLS[(v + 1) % WALLS.length];
  const u0 = 0.05;
  const v0 = 0.14;
  const u1 = 0.95;
  const v1 = 0.86;
  p.shadow(u0, v0, u1, v1);
  const front: Patch[] = [
    { t0: 0, t1: 99, k0: 0, k1: 2, c: shade(wall[1], 0.55) },
    door(6, 4, 8),
    pane(6, 8, 4, 3, GLASS_LIT),
    ...[1, 9].flatMap((t) => [shutter(t, 5, 4, 7), ...reja(t, 5, 4, 7)]),
    { t0: 0, t1: 99, k0: 13, k1: 14, c: shade(wall[1], 0.72) },
  ];
  const side: Patch[] = [
    { t0: 0, t1: 99, k0: 0, k1: 2, c: shade(wall[2], 0.55) },
    { t0: 2, t1: 11, k0: 0, k1: 9, c: GARAGE },
    { t0: 2, t1: 11, k0: 8, k1: 9, c: shade(GARAGE, 1.6) },
    shutter(13, 5, 3, 7),
    { t0: 0, t1: 99, k0: 13, k1: 14, c: shade(wall[2], 0.72) },
  ];
  p.box(u0, v0, u1, v1, 0, 18, wall, 'plain', front, side, ROOFTOP);
  p.cornice(u0, v0, u1, v1, 18, 2, CONCRETE);
  p.parapet(u0, v0, u1, v1, 20, 1, wall);
  // The pergola: the green box that says "azotea" in this street.
  p.box(0.3, 0.32, 0.52, 0.56, 20, 4, PERGOLA, 'plain');
  p.box(0.27, 0.29, 0.55, 0.59, 24, 1, CONCRETE, 'plain');
  p.tank(0.66, 0.28, 20);
}

/** Level 4: the rented block in bare brick, with a shop under an awning and balconies above. */
function block(p: Pen, v: number): void {
  const wall = v % 3 === 2 ? WALLS[(v + 1) % WALLS.length] : BRICK;
  const h = 30;
  const u0 = 0.08;
  const v0 = 0.1;
  const u1 = 0.92;
  const v1 = 0.9;
  p.shadow(u0, v0, u1, v1);
  const front: Patch[] = [
    { t0: 0, t1: 99, k0: 0, k1: 2, c: shade(wall[1], 0.55) },
    pane(1, 2, 6, 6, GLASS), // the shop window
    pane(9, 2, 5, 6, GLASS),
    door(7, 3, 7),
  ];
  const side: Patch[] = [
    { t0: 0, t1: 99, k0: 0, k1: 2, c: shade(wall[2], 0.55) },
    pane(4, 2, 4, 6, GARAGE),
  ];
  for (let f = 0; f < 3; f++) {
    const k = 11 + f * 6;
    front.push(...ribbon(2, 15, k, 4));
    side.push(...ribbon(3, 14, k, 4));
  }
  p.box(u0, v0, u1, v1, 0, h, wall, wall === BRICK ? 'brick' : 'plain', front, side, ROOFTOP);
  // The awning over the shop and one balcony slab per floor, so the facade has depth.
  p.canopy(0.1, v1, 0.9, 9, AWNING[0], AWNING[1]);
  for (let f = 0; f < 3; f++) p.balcony(0.12, v1, 0.88, 15 + f * 6);
  p.cornice(u0, v0, u1, v1, h, 2, CONCRETE);
  p.parapet(u0, v0, u1, v1, h + 2, 1, wall);
  p.tank(0.5, 0.24, h + 2);
  p.box(0.18, 0.28, 0.4, 0.5, h + 2, 4, CONCRETE, 'plain');
  if (v % 2 === 1) p.antenna(0.7, 0.34, h + 6, 7);
}

/** Level 5: the tower, on a wider podium, with glass bands and a machine room on top. */
function tower(p: Pen, v: number): void {
  const h = 46 + (v % 3) * 6;
  p.shadow(0.06, 0.08, 0.94, 0.92);
  // The podium: two floors at street level, wider than the tower, so the silhouette steps in.
  p.box(0.06, 0.08, 0.94, 0.92, 0, 10, CONCRETE, 'plain', [door(4, 4, 8), pane(10, 2, 4, 6, GLASS)], [pane(4, 2, 4, 6, GLASS)], ROOFTOP);
  p.canopy(0.08, 0.92, 0.9, 11, GLASS, shade(GLASS, 1.4));
  const u0 = 0.18;
  const v0 = 0.2;
  const u1 = 0.82;
  const v1 = 0.8;
  const front: Patch[] = [];
  const side: Patch[] = [];
  for (let z = 14; z + 4 <= h; z += 5) {
    front.push(...ribbon(1, 14, z, 3));
    side.push(...ribbon(2, 13, z, 3));
  }
  p.box(u0, v0, u1, v1, 10, h - 10, TOWER_WALL, 'plain', front, side, ROOFTOP);
  p.cornice(u0, v0, u1, v1, h, 2, CONCRETE);
  p.box(0.32, 0.34, 0.6, 0.6, h + 2, 5, CONCRETE, 'plain');
  p.tank(0.66, 0.26, h + 2);
  p.antenna(0.42, 0.4, h + 7, 9);
}

/** Level 1: the kiosk, a lit counter behind a service window and an awning over the pavement. */
function kiosk(p: Pen, v: number): void {
  const wall = WALLS[v % WALLS.length];
  const sign = SIGNS[v % SIGNS.length];
  const u0 = 0.2;
  const v0 = 0.24;
  const u1 = 0.8;
  const v1 = 0.76;
  p.shadow(u0, v0, u1, v1);
  p.box(
    u0,
    v0,
    u1,
    v1,
    0,
    12,
    wall,
    'plain',
    [
      { t0: 0, t1: 99, k0: 2, k1: 3, c: shade(INSIDE, 2.2) },
      { t0: 0, t1: 99, k0: 7, k1: 8, c: shade(INSIDE, 1.6) },
      { t0: 0, t1: 99, k0: 2, k1: 8, c: INSIDE },
      { t0: 0, t1: 99, k0: 9, k1: 12, c: sign },
    ],
    [
      { t0: 0, t1: 99, k0: 9, k1: 12, c: shade(sign, 0.78) },
      pane(3, 3, 3, 3),
    ],
  );
  p.canopy(u0, v1, u1, 9, shade(sign, 0.78), hex('#f4ece0'));
  p.crate(0.12, 0.86, hex('#e0a526'));
}

/** Level 2: the greengrocer, open to the street, with its crates and its price board. */
function greengrocer(p: Pen, v: number): void {
  const wall = WALLS[(v + 3) % WALLS.length];
  const green = hex('#2f7a4a');
  const u0 = 0.12;
  const v0 = 0.18;
  const u1 = 0.88;
  const v1 = 0.78;
  p.shadow(u0, v0, u1, v1);
  p.box(
    u0,
    v0,
    u1,
    v1,
    0,
    14,
    wall,
    'plain',
    [
      { t0: 0, t1: 99, k0: 0, k1: 1, c: shade(INSIDE, 0.6) },
      { t0: 0, t1: 99, k0: 0, k1: 9, c: INSIDE },
      { t0: 0, t1: 99, k0: 10, k1: 14, c: green },
    ],
    [
      { t0: 0, t1: 99, k0: 10, k1: 14, c: shade(green, 0.78) },
      { t0: 2, t1: 7, k0: 2, k1: 6, c: shade(INSIDE, 1.7) },
    ],
  );
  p.canopy(u0, v1, u1, 10, green, hex('#f4ece0'));
  for (const [u, fruit] of [
    [0.16, '#c8392f'],
    [0.36, '#5f9a3f'],
    [0.56, '#e0a526'],
  ] as const)
    p.crate(u, 0.84, hex(fruit));
  p.box(0.74, 0.8, 0.86, 0.86, 1, 5, WOOD_DARK, 'plain');
}

/** Level 3: the hairdresser, a wide glass front, a sign band and the barber pole on the corner. */
function hairdresser(p: Pen, v: number): void {
  const wall = WALLS[(v + 1) % WALLS.length];
  const sign = SIGNS[(v + 2) % SIGNS.length];
  const u0 = 0.1;
  const v0 = 0.14;
  const u1 = 0.9;
  const v1 = 0.84;
  p.shadow(u0, v0, u1, v1);
  p.box(
    u0,
    v0,
    u1,
    v1,
    0,
    13,
    wall,
    'plain',
    [
      ...ribbon(1, 8, 1, 7),
      door(10, 4, 8),
      { t0: 0, t1: 99, k0: 8, k1: 9, c: shade(sign, 0.6) },
      { t0: 0, t1: 99, k0: 9, k1: 12, c: sign },
    ],
    [
      pane(3, 1, 4, 6, GLASS),
      { t0: 0, t1: 99, k0: 8, k1: 9, c: shade(sign, 0.5) },
      { t0: 0, t1: 99, k0: 9, k1: 12, c: shade(sign, 0.72) },
    ],
    ROOFTOP,
  );
  p.cornice(u0, v0, u1, v1, 13, 2, CONCRETE);
  p.parapet(u0, v0, u1, v1, 15, 1, wall);
  p.box(0.3, 0.3, 0.46, 0.46, 15, 3, CONCRETE, 'plain');
  p.barberPole(u0, v1 + 0.02, 0, 7);
}

/** Level 4: the bar, wooden ground floor with warm windows, awning and tables on the pavement. */
function bar(p: Pen, v: number): void {
  const wall = WALLS[(v + 4) % WALLS.length];
  const sign = SIGNS[(v + 1) % SIGNS.length];
  const u0 = 0.08;
  const v0 = 0.12;
  const u1 = 0.92;
  const v1 = 0.86;
  const front: Patch[] = [
    pane(1, 1, 5, 6, WARM),
    pane(10, 1, 5, 6, WARM),
    door(7, 3, 8),
    shutter(3, 11, 4, 5),
    shutter(10, 11, 4, 5),
    { t0: 0, t1: 99, k0: 8, k1: 10, c: sign },
    { t0: 0, t1: 99, k0: 0, k1: 8, c: WOOD[1] },
    { t0: 0, t1: 99, k0: 16, k1: 17, c: shade(wall[1], 1.2) },
  ];
  const side: Patch[] = [
    pane(3, 1, 4, 6, WARM),
    shutter(11, 11, 4, 5),
    { t0: 0, t1: 99, k0: 8, k1: 10, c: shade(sign, 0.72) },
    { t0: 0, t1: 99, k0: 0, k1: 8, c: WOOD[2] },
  ];
  p.shadow(u0, v0, u1, v1);
  p.box(u0, v0, u1, v1, 0, 17, wall, 'plain', front, side, ROOFTOP);
  p.canopy(u0, v1, u1, 8, shade(sign, 0.8), shade(sign, 0.64));
  p.cornice(u0, v0, u1, v1, 17, 2, CONCRETE);
  p.parapet(u0, v0, u1, v1, 19, 1, wall);
  p.tank(0.62, 0.24, 19);
}

/** Level 5: the clothing store, two display windows with mannequins and a vertical sign on the corner. */
function clothingStore(p: Pen, v: number): void {
  const wall = WALLS[(v + 5) % WALLS.length];
  const sign = SIGNS[(v + 3) % SIGNS.length];
  const h = 26;
  const u0 = 0.08;
  const v0 = 0.1;
  const u1 = 0.92;
  const v1 = 0.88;
  const front: Patch[] = [
    ...mannequins(1, 16, v),
    { t0: 0, t1: 99, k0: 0, k1: 2, c: shade(wall[1], 0.6) },
    ...ribbon(1, 6, 2, 6),
    ...ribbon(10, 15, 2, 6),
    door(7, 3, 7),
    { t0: 0, t1: 99, k0: 8, k1: 11, c: sign },
    ...ribbon(2, 15, 13, 4),
    ...ribbon(2, 15, 19, 4),
  ];
  const side: Patch[] = [
    { t0: 0, t1: 99, k0: 0, k1: 2, c: shade(wall[2], 0.6) },
    ...ribbon(2, 13, 2, 6),
    { t0: 0, t1: 99, k0: 8, k1: 11, c: shade(sign, 0.72) },
    ...ribbon(3, 14, 13, 4),
    ...ribbon(3, 14, 19, 4),
  ];
  p.shadow(u0, v0, u1, v1);
  p.box(u0, v0, u1, v1, 0, h, wall, 'plain', front, side, ROOFTOP);
  p.canopy(u0, v1, u1, 8, shade(sign, 0.8), shade(sign, 0.64));
  p.cornice(u0, v0, u1, v1, h, 2, CONCRETE);
  p.parapet(u0, v0, u1, v1, h + 2, 1, wall);
  // The vertical sign on the corner, the one you see from the end of the street.
  p.box(0.86, 0.12, 0.94, 0.2, 11, 14, [sign, shade(sign, LEFT), shade(sign, RIGHT)], 'plain');
  p.box(0.2, 0.24, 0.44, 0.4, h + 2, 3, CONCRETE, 'plain');
}

/* ---------- The lots that take more than one cell ---------- */

/**
 * Kinds that need a lot bigger than one cell. A shop that grows upwards on a single cell ends up
 * reading as a block of flats; a factory on one cell has no room for the yard, the silos or the
 * stacks that make it a factory. `n` is the side of the lot in cells, `h` the tallest pixel.
 */
export type LotKind =
  | 'mercado'
  | 'bar'
  | 'ropa'
  | 'oficinas'
  | 'galpon'
  | 'silos'
  | 'quimica'
  | 'frigorifico'
  | 'polo'
  | 'aceria';

const LOT: Record<LotKind, { n: number; h: number }> = {
  mercado: { n: 2, h: 26 },
  ropa: { n: 2, h: 32 },
  bar: { n: 2, h: 34 },
  oficinas: { n: 2, h: 44 },
  galpon: { n: 2, h: 22 },
  silos: { n: 2, h: 34 },
  quimica: { n: 2, h: 30 },
  frigorifico: { n: 2, h: 32 },
  polo: { n: 3, h: 40 },
  aceria: { n: 3, h: 54 },
};

/** The kinds of a given size, in the order the board shows them. */
export const LOT_KINDS = Object.keys(LOT) as LotKind[];
export const lotSize = (kind: LotKind): number => LOT[kind].n;

/**
 * A pen with room for a building `maxZ` px tall on a lot `n` cells a side: the ground is a
 * 32n x 16n diamond, the anchor its top corner, and the canvas keeps a margin for the shadow.
 */
function penLot(n: number, maxZ: number): Pen {
  return new Pen(new Pixels(32 * n + 8, maxZ + 16 * n + 8), 16 * n + 4, maxZ + 2);
}

/** The fruit and vegetables that show on the market stalls. */
const FRUIT = ['#c8392f', '#e0a526', '#4f8f3a', '#7a3f8a'].map(hex);

/**
 * One open stall on a market front: the goods on the counter, the counter, and the dark inside.
 * The order matters: the first patch that matches a pixel wins, so the goods go before the shade.
 */
function stall(t: number, w: number, v: number): Patch[] {
  const out: Patch[] = [];
  for (let i = 1; i + 2 < w; i += 3) out.push({ t0: t + i, t1: t + i + 2, k0: 3, k1: 5, c: FRUIT[(i + v) % FRUIT.length] });
  out.push({ t0: t, t1: t + w, k0: 2, k1: 3, c: WOOD_DARK[1] });
  out.push({ t0: t, t1: t + w, k0: 0, k1: 8, c: INSIDE });
  return out;
}

/**
 * The market: a wide brick shed with three open stalls, a shed roof, the little clock tower over
 * the ridge and the crates out on the pavement. The awnings run the whole frontage.
 */
function marketLot(p: Pen, v: number): void {
  const wall = v % 2 ? WALLS[(v + 3) % WALLS.length] : BRICK;
  const tex: Tex = wall === BRICK ? 'brick' : 'plain';
  const roof = ROOFS[(v >> 1) % ROOFS.length];
  const sign = SIGNS[(v + 1) % SIGNS.length];
  const h = 16;
  const u0 = 0.12;
  const v0 = 0.16;
  const u1 = 1.88;
  const v1 = 1.8;
  const front: Patch[] = [
    ...stall(3, 15, v),
    ...stall(20, 15, v),
    ...stall(37, 15, v),
    door(53, 4, 8),
    { t0: 0, t1: 99, k0: 8, k1: 9, c: shade(sign, 0.55) },
    { t0: 0, t1: 99, k0: 9, k1: 13, c: sign },
  ];
  const side: Patch[] = [
    ...stall(4, 13, v + 1),
    ...stall(21, 13, v + 2),
    door(40, 4, 8),
    { t0: 0, t1: 99, k0: 8, k1: 9, c: shade(sign, 0.5) },
    { t0: 0, t1: 99, k0: 9, k1: 13, c: shade(sign, 0.72) },
  ];
  p.shadow(u0, v0, u1, v1);
  p.box(u0, v0, u1, v1, 0, h, wall, tex, front, side, ROOFTOP);
  p.gable(u0 - 0.05, v0 - 0.05, u1 + 0.05, v1 + 0.05, h, 5, roof, wall[1], v % 2 ? 'plain' : 'sheet');
  // The tower over the ridge, with its clock facing the street.
  p.box(
    0.86,
    0.86,
    1.14,
    1.14,
    h + 3,
    6,
    WALLS[0],
    'plain',
    [{ t0: 2, t1: 4, k0: 1, k1: 3, c: LEG }],
    [{ t0: 1, t1: 3, k0: 1, k1: 3, c: LEG }],
    ROOFTOP,
  );
  p.canopy(u0, v1, u1, 9, shade(sign, 0.82), hex('#f4ece0'), 2);
  p.crate(0.24, 1.86, FRUIT[v % FRUIT.length]);
  p.crate(0.5, 1.86, FRUIT[(v + 1) % FRUIT.length]);
  p.crate(0.76, 1.86, FRUIT[(v + 2) % FRUIT.length]);
}

/**
 * The corner bar: wood on the ground floor, warm windows, the sign band and its awning, and the
 * two floors of the family living above with a balcony across the whole front.
 */
/**
 * The bar, in the two shapes a bar takes here. The even variants are the bar of the neighbourhood:
 * one storey, painted plaster, a shed awning of corrugated tin and the windows behind bars.
 * The odd ones are the common two-storey bar: the family above, the balcony, the corner sign.
 */
function barLot(p: Pen, v: number): void {
  const barrio = v % 2 === 0;
  const wall = WALLS[(v + 2) % WALLS.length];
  const sign = SIGNS[(v + 1) % SIGNS.length];
  const u0 = 0.1;
  const v0 = 0.14;
  const u1 = 1.9;
  const v1 = 1.82;
  if (barrio) {
    const h = 14;
    const front: Patch[] = [
      ...reja(4, 2, 10, 6),
      ...reja(18, 2, 10, 6),
      pane(4, 2, 10, 6, WARM),
      pane(18, 2, 10, 6, WARM),
      door(32, 5, 8),
      pane(8, 11, 4, 3, WOOD[1]),
      pane(24, 11, 4, 3, WOOD[1]),
      pane(40, 11, 4, 3, WOOD[1]),
      { t0: 0, t1: 99, k0: 8, k1: 11, c: sign },
      { t0: 0, t1: 99, k0: 0, k1: 8, c: WOOD[1] },
    ];
    const side: Patch[] = [
      ...reja(6, 2, 10, 6),
      pane(6, 2, 10, 6, WARM),
      door(38, 5, 8),
      pane(10, 11, 4, 3, WOOD[2]),
      pane(26, 11, 4, 3, WOOD[2]),
      { t0: 0, t1: 99, k0: 8, k1: 11, c: shade(sign, 0.72) },
      { t0: 0, t1: 99, k0: 0, k1: 8, c: WOOD[2] },
    ];
    p.shadow(u0, v0, u1, v1);
    p.box(u0, v0, u1, v1, 0, h, wall, 'plain', front, side, ROOFTOP);
    // The tin awning of the corner bar, and the stovepipe of the kitchen behind it.
    p.canopy(u0, v1, u1, 8, CHAPA_RUST[0], shade(CHAPA_RUST[0], 0.74), 3);
    p.cornice(u0, v0, u1, v1, h, 1, wall);
    p.parapet(u0, v0, u1, v1, h + 1, 1, wall);
    p.pipe(1.34, 0.36, h + 2, 5);
    p.tank(0.42, 0.34, h + 1);
    if (v % 2 === 0) p.antenna(1.5, 0.6, h + 1, 6);
    return;
  }
  const h = 24;
  const front: Patch[] = [
    pane(4, 2, 10, 7, WARM),
    pane(18, 2, 10, 7, WARM),
    door(32, 5, 8),
    { t0: 6, t1: 11, k0: 15, k1: 21, c: shade(wall[1], 0.7) },
    { t0: 22, t1: 27, k0: 15, k1: 21, c: shade(wall[1], 0.7) },
    { t0: 38, t1: 43, k0: 15, k1: 21, c: shade(wall[1], 0.7) },
    { t0: 0, t1: 99, k0: 9, k1: 12, c: sign },
    { t0: 0, t1: 99, k0: 0, k1: 9, c: WOOD[1] },
  ];
  const side: Patch[] = [
    pane(6, 2, 10, 7, WARM),
    pane(22, 2, 10, 7, WARM),
    door(38, 5, 8),
    { t0: 8, t1: 13, k0: 15, k1: 21, c: shade(wall[2], 0.7) },
    { t0: 26, t1: 31, k0: 15, k1: 21, c: shade(wall[2], 0.7) },
    { t0: 0, t1: 99, k0: 9, k1: 12, c: shade(sign, 0.72) },
    { t0: 0, t1: 99, k0: 0, k1: 9, c: WOOD[2] },
  ];
  p.shadow(u0, v0, u1, v1);
  p.box(u0, v0, u1, v1, 0, h, wall, 'plain', front, side, ROOFTOP);
  p.balcony(u0, v1, u1, 13);
  p.canopy(u0, v1, u1, 9, shade(sign, 0.82), hex('#f4ece0'), 2);
  p.cornice(u0, v0, u1, v1, h, 2, wall);
  p.parapet(u0, v0, u1, v1, h + 2, 1, wall);
  p.box(0.3, 0.34, 0.72, 0.72, h + 2, 3, wall, 'plain');
  p.tank(1.24, 0.32, h + 2);
  // The sign you read from the corner, hanging over both streets.
  p.box(u1 - 0.24, v1 - 0.24, u1 - 0.04, v1 - 0.04, 13, 7, [sign, shade(sign, LEFT), shade(sign, RIGHT)], 'plain');
}

/**
 * The clothing store: two long display windows with mannequins, the sign band across the whole
 * frontage, the depot above and the tall vertical sign on the corner. Nothing of wood and no
 * balcony, so it never reads as the bar next door.
 */
function storeLot(p: Pen, v: number): void {
  const wall = WALLS[(v + 1) % WALLS.length];
  const sign = SIGNS[(v + 2) % SIGNS.length];
  // Low and wide on purpose: what makes a shop a shop is the frontage, not another floor.
  const h = 13;
  const u0 = 0.1;
  const v0 = 0.14;
  const u1 = 1.9;
  const v1 = 1.84;
  const front: Patch[] = [
    ...mannequins(4, 24, v),
    ...mannequins(30, 50, v),
    ...ribbon(4, 24, 2, 7),
    ...ribbon(30, 50, 2, 7),
    door(25, 5, 9),
    { t0: 0, t1: 99, k0: 9, k1: 13, c: sign },
    { t0: 0, t1: 99, k0: 0, k1: 2, c: shade(wall[1], 0.62) },
  ];
  const side: Patch[] = [
    ...mannequins(4, 20, v + 1),
    ...ribbon(4, 20, 2, 7),
    ...ribbon(26, 42, 2, 7),
    door(21, 4, 9),
    { t0: 0, t1: 99, k0: 9, k1: 13, c: shade(sign, 0.72) },
    { t0: 0, t1: 99, k0: 0, k1: 2, c: shade(wall[2], 0.62) },
  ];
  p.shadow(u0, v0, u1, v1);
  p.box(u0, v0, u1, v1, 0, h, wall, 'plain', front, side, ROOFTOP);
  p.canopy(u0, v1, u1, 9, shade(sign, 0.86), hex('#f4ece0'), 2);
  p.cornice(u0, v0, u1, v1, h, 2, wall);
  p.parapet(u0, v0, u1, v1, h + 2, 1, wall);
  // The billboard on the roof, the way a shop shouts from the next block.
  p.box(0.5, 1.2, 0.56, 1.26, h + 2, 4, tone(LEG), 'plain');
  p.box(1.16, 1.2, 1.22, 1.26, h + 2, 4, tone(LEG), 'plain');
  p.box(
    0.46,
    1.14,
    1.26,
    1.32,
    h + 6,
    5,
    tone(shade(sign, 0.9)),
    'plain',
    [{ t0: 2, t1: 22, k0: 1, k1: 4, c: hex('#f4ece0') }],
    [],
    sign,
  );
  p.box(1.34, 0.3, 1.7, 0.6, h + 2, 3, wall, 'plain');
}

/** Office walls and glass: four of each, crossed by the variant, so no two neighbours match. */
const OFFICE_WALLS = ['#c3cfd4', '#a9a395', '#d8d4c8', '#9aa3a8'].map(ramp);
const OFFICE_GLASS = ['#43606f', '#3f6b63', '#4a5f7a', '#61707c'].map(hex);

/** Two mannequins standing in a display window: a lit figure each, one darker head above. */
function mannequins(t: number, w: number, v: number): Patch[] {
  const out: Patch[] = [];
  for (let i = 3; i + 2 < w; i += 7) {
    const c = v % 2 ? hex('#e8dcc0') : hex('#f4ece0');
    out.push({ t0: t + i, t1: t + i + 2, k0: 2, k1: 7, c });
    out.push({ t0: t + i, t1: t + i + 2, k0: 7, k1: 8, c: shade(c, 0.55) });
  }
  return out;
}

/**
 * The offices: a double height glass lobby at street level, three floors of glazing between
 * concrete slabs, the plant room on the roof and the flag. The whole point is that it is wide.
 */
function officeLot(p: Pen, v: number): void {
  const wall = OFFICE_WALLS[v % OFFICE_WALLS.length];
  const glass = OFFICE_GLASS[(v + 1) % OFFICE_GLASS.length];
  const slab = wall;
  const h = 32;
  const u0 = 0.1;
  const v0 = 0.14;
  const u1 = 1.9;
  const v1 = 1.84;
  const floors = [12, 19, 26];
  const bands = (t1: number) =>
    floors.flatMap((k) => [
      ...glazed(4, t1, k, 5, 5, glass),
      { t0: 0, t1: 99, k0: k + 5, k1: k + 7, c: shade(slab[1], 1.12) },
    ]);
  const front: Patch[] = [
    ...glazed(16, 40, 1, 10, 6, glass),
    door(24, 8, 9),
    { t0: 0, t1: 99, k0: 1, k1: 2, c: WARM },
    ...bands(56),
    { t0: 0, t1: 99, k0: 0, k1: 1, c: shade(slab[2], 0.6) },
  ];
  const side: Patch[] = [
    ...glazed(6, 30, 1, 10, 6, glass),
    door(16, 8, 9),
    ...bands(52),
    { t0: 0, t1: 99, k0: 0, k1: 1, c: shade(slab[2], 0.55) },
  ];
  p.shadow(u0, v0, u1, v1);
  // Half the variants stand on a darker plinth, which changes the whole base of the building.
  if (v >= 4) p.box(u0 - 0.05, v0 - 0.05, u1 + 0.05, v1 + 0.05, 0, 3, tone(shade(slab[1], 0.7)), 'plain');
  p.box(u0, v0, u1, v1, 0, h, wall, 'plain', front, side, ROOFTOP);
  p.cornice(u0, v0, u1, v1, h, 2, slab);
  p.parapet(u0, v0, u1, v1, h + 2, 1, wall);
  p.box(0.46, 0.36, 1.1, 0.86, h + 2, 4, tone(shade(slab[1], 0.86)), 'plain');
  p.box(1.3, 0.9, 1.6, 1.2, h + 2, 2, tone(shade(slab[1], 0.86)), 'plain');
  p.antenna(1.24, 0.32, h + 2, 6);
  if (v % 2 === 0) p.flag(1.56, 0.5, h + 2, 8);
}

/* ---------- Industry on one cell ---------- */

/** Level 1: the tin workshop: a shed with a flat roof, the roller door and the tank out in the yard. */
function tinShop(p: Pen, v: number): void {
  const wall = v % 2 ? CHAPA : CHAPA_RUST;
  const sign = COMPANY[(v + 3) % COMPANY.length];
  const u0 = 0.14;
  const v0 = 0.18;
  const u1 = 0.86;
  const v1 = 0.82;
  p.shadow(u0, v0, u1, v1);
  p.box(
    u0,
    v0,
    u1,
    v1,
    0,
    10,
    wall,
    'sheet',
    [
      { t0: 2, t1: 14, k0: 0, k1: 8, c: GARAGE },
      { t0: 17, t1: 21, k0: 4, k1: 7, c: GLASS },
      { t0: 0, t1: 99, k0: 8, k1: 10, c: sign },
    ],
    [
      { t0: 4, t1: 9, k0: 4, k1: 7, c: GLASS },
      { t0: 0, t1: 99, k0: 8, k1: 10, c: shade(sign, 0.72) },
    ],
    ROOF_DECK,
  );
  // The drip edge of a metal roof, and the vent that comes out of it.
  p.px.line(p.P(u0, v1, 10), p.P(u1, v1, 10), shade(wall[0], 1.22));
  p.px.line(p.P(u1, v1, 10), p.P(u1, v0, 10), shade(wall[2], 1.2));
  p.pipe(0.68, 0.4, 10, 2);
  p.tank(0.08, 0.9, 0);
  p.crate(0.9, 0.88, STEEL[0]);
}

/** Level 2: the metal shop: brick and flat roof, the lean-to of tin over the door, the stack smoking. */
function metalShop(p: Pen, v: number): void {
  const sign = COMPANY[(v + 1) % COMPANY.length];
  const u0 = 0.12;
  const v0 = 0.16;
  const u1 = 0.88;
  const v1 = 0.8;
  p.shadow(u0, v0, u1, v1);
  p.box(
    u0,
    v0,
    u1,
    v1,
    0,
    11,
    BRICK,
    'brick',
    [
      ...reja(2, 4, 5, 4),
      { t0: 2, t1: 7, k0: 4, k1: 8, c: GLASS },
      { t0: 10, t1: 18, k0: 0, k1: 8, c: GARAGE },
      { t0: 0, t1: 99, k0: 8, k1: 11, c: sign },
    ],
    [
      { t0: 3, t1: 8, k0: 4, k1: 7, c: GLASS },
      { t0: 0, t1: 99, k0: 8, k1: 11, c: shade(sign, 0.72) },
    ],
    ROOF_DECK,
  );
  p.cornice(u0, v0, u1, v1, 11, 1, BRICK);
  p.parapet(u0, v0, u1, v1, 12, 1, BRICK);
  // The lean-to over the door, rust and all.
  p.canopy(u0, v1, u0 + 0.44, 8, CHAPA_RUST[0], shade(CHAPA_RUST[0], 0.78), 2);
  p.chimney(0.66, 0.34, 12, 7);
  p.pile(0.84, 0.88, 0.14);
  p.tank(0.1, 0.3, 12);
}

/** Level 3: the brick factory: two naves, the stack, a small silo and the containers outside. */
function brickFactory(p: Pen, v: number): void {
  const sign = COMPANY[(v + 2) % COMPANY.length];
  const u0 = 0.1;
  const v0 = 0.14;
  const u1 = 0.9;
  const v1 = 0.76;
  // The annex first, behind, so the nave covers its foot.
  p.box(0.62, 0.18, 0.94, 0.5, 0, 7, CONCRETE, 'plain', [], [], ROOFTOP);
  p.shadow(u0, v0, u1, v1);
  p.box(
    u0,
    v0,
    u1,
    v1,
    0,
    13,
    BRICK,
    'brick',
    [
      ...ribbon(2, 8, 5, 4),
      ...ribbon(11, 17, 5, 4),
      { t0: 20, t1: 27, k0: 0, k1: 8, c: GARAGE },
      { t0: 0, t1: 99, k0: 9, k1: 11, c: sign },
    ],
    [...ribbon(3, 9, 5, 4), { t0: 0, t1: 99, k0: 9, k1: 11, c: shade(sign, 0.72) }],
    ROOF_DECK,
  );
  p.sawtooth(u0 - 0.03, v0 - 0.03, u1 + 0.03, v1 + 0.03, 13, 3, 3, CHAPA);
  p.chimney(0.3, 0.42, 14, 8);
  p.silo(0.66, 0.3, 0.2, 0, 10);
  p.container(0.92, 0.92, SIGNS[(v + 3) % SIGNS.length]);
}

/** Level 4: the concrete plant: the block, the tall stack, the silo and the ore out in the open. */
function concretePlant(p: Pen, v: number): void {
  const sign = COMPANY[(v + 4) % COMPANY.length];
  const u0 = 0.08;
  const v0 = 0.12;
  const u1 = 0.92;
  const v1 = 0.74;
  p.shadow(u0, v0, u1, v1);
  p.box(
    u0,
    v0,
    u1,
    v1,
    0,
    21,
    CONCRETE,
    'plain',
    [
      ...ribbon(2, 9, 3, 4),
      ...ribbon(11, 18, 3, 4),
      ...ribbon(2, 9, 10, 4),
      ...ribbon(11, 18, 10, 4),
      { t0: 20, t1: 28, k0: 0, k1: 9, c: GARAGE },
      { t0: 0, t1: 99, k0: 15, k1: 18, c: sign },
    ],
    [...ribbon(3, 12, 3, 4), ...ribbon(3, 12, 10, 4), { t0: 0, t1: 99, k0: 15, k1: 18, c: shade(sign, 0.72) }],
    ROOF_DECK,
  );
  p.cornice(u0, v0, u1, v1, 21, 1, CONCRETE);
  p.parapet(u0, v0, u1, v1, 22, 1, CONCRETE);
  p.chimney(0.18, 0.4, 22, 12);
  p.silo(0.6, 0.24, 0.18, 0, 14);
  p.pile(0.14, 0.94, 0.16);
}

/** Level 5: the big plant: two blocks, two stacks, the silos and the machine room on the roof. */
function bigPlant(p: Pen, v: number): void {
  const sign = COMPANY[(v + 1) % COMPANY.length];
  const u0 = 0.06;
  const v0 = 0.1;
  const u1 = 0.94;
  const v1 = 0.72;
  // The lower nave first, so the tall one hides its foot.
  p.box(0.1, 0.16, 0.5, 0.66, 0, 16, CHAPA, 'sheet', [...ribbon(2, 10, 4, 4)], [], ROOFTOP);
  p.shadow(u0, v0, u1, v1);
  p.box(
    0.4,
    v0,
    u1,
    v1,
    0,
    29,
    CONCRETE,
    'plain',
    [
      ...ribbon(2, 8, 4, 4),
      ...ribbon(11, 17, 4, 4),
      ...ribbon(2, 8, 11, 4),
      ...ribbon(11, 17, 11, 4),
      ...ribbon(2, 8, 18, 3),
      ...ribbon(11, 17, 18, 3),
      { t0: 20, t1: 26, k0: 0, k1: 8, c: GARAGE },
      { t0: 0, t1: 99, k0: 24, k1: 27, c: sign },
    ],
    [...ribbon(3, 12, 4, 4), ...ribbon(3, 12, 11, 4), ...ribbon(3, 12, 18, 3), { t0: 0, t1: 99, k0: 24, k1: 27, c: shade(sign, 0.72) }],
    ROOF_DECK,
  );
  p.cornice(0.4, v0, u1, v1, 29, 1, CONCRETE);
  p.parapet(0.4, v0, u1, v1, 30, 1, CONCRETE);
  p.box(0.5, 0.2, 0.78, 0.44, 30, 4, CONCRETE, 'plain');
  p.chimney(0.62, 0.5, 30, 14);
  p.chimney(0.3, 0.44, 16, 10);
  p.silo(0.12, 0.3, 0.18, 0, 16);
  p.silo(0.12, 0.54, 0.18, 0, 13);
  p.pipeRun(p.P(0.2, 0.4, 16), p.P(0.5, 0.4, 24));
}

/* ---------- Industry on two and three cells ---------- */

/** The warehouse: a long tin shed with three docks, and the office in the corner of the lot. */
function warehouseLot(p: Pen, v: number): void {
  const wall = v % 2 ? CHAPA : CHAPA_RUST;
  const sign = COMPANY[(v + 2) % COMPANY.length];
  const u0 = 0.1;
  const v0 = 0.12;
  const u1 = 1.9;
  const v1 = 1.5;
  p.shadow(u0, v0, u1, v1);
  p.box(
    u0,
    v0,
    u1,
    v1,
    0,
    11,
    wall,
    'sheet',
    [
      { t0: 4, t1: 14, k0: 0, k1: 9, c: GARAGE },
      { t0: 18, t1: 28, k0: 0, k1: 9, c: GARAGE },
      { t0: 32, t1: 42, k0: 0, k1: 9, c: GARAGE },
      { t0: 44, t1: 48, k0: 3, k1: 6, c: GLASS },
      { t0: 0, t1: 99, k0: 9, k1: 12, c: sign },
    ],
    [{ t0: 6, t1: 12, k0: 3, k1: 6, c: GLASS }, { t0: 0, t1: 99, k0: 9, k1: 12, c: shade(sign, 0.72) }],
    ROOF_DECK,
  );
  p.gable(u0 - 0.03, v0 - 0.03, u1 + 0.03, v1 + 0.03, 12, 4, CHAPA, wall[1], 'plain');
  // The little office on the corner, with its window to the street.
  p.box(
    1.44,
    1.6,
    1.88,
    1.92,
    0,
    6,
    WALLS[v % WALLS.length],
    'plain',
    [
      { t0: 3, t1: 9, k0: 2, k1: 5, c: GLASS },
      { t0: 10, t1: 13, k0: 0, k1: 5, c: DOOR },
    ],
    [{ t0: 3, t1: 8, k0: 2, k1: 5, c: GLASS }],
    ROOF_DECK,
  );
  p.container(0.16, 1.9, SIGNS[(v + 3) % SIGNS.length]);
  p.container(0.64, 1.9, SIGNS[(v + 4) % SIGNS.length]);
  p.container(0.16, 1.62, SIGNS[(v + 1) % SIGNS.length]);
}

/** The cereal plant: the receiving shed on one side, the battery of silos on the other. */
function silosLot(p: Pen, v: number): void {
  const sign = COMPANY[(v + 3) % COMPANY.length];
  // The shed runs back along the left half, so the silos do not hide it.
  const u0 = 0.1;
  const v0 = 0.12;
  const u1 = 1.02;
  const v1 = 1.9;
  p.shadow(0.1, 0.12, 1.9, 1.9);
  p.box(
    u0,
    v0,
    u1,
    v1,
    0,
    8,
    CONCRETE,
    'plain',
    [
      { t0: 3, t1: 12, k0: 0, k1: 6, c: GARAGE },
      { t0: 15, t1: 21, k0: 2, k1: 5, c: GLASS },
      { t0: 0, t1: 99, k0: 6, k1: 8, c: sign },
    ],
    [{ t0: 3, t1: 9, k0: 2, k1: 5, c: GLASS }],
    ROOF_DECK,
  );
  p.gable(u0 - 0.03, v0 - 0.03, u1 + 0.03, v1 + 0.03, 8, 3, CHAPA, CONCRETE[1], 'plain');
  p.chimney(0.32, 0.4, 11, 9);
  // The battery, drawn from the back corner forward so each row covers the one behind it.
  const battery: [number, number, number][] = [
    [1.08, 0.18, 17],
    [1.5, 0.32, 16],
    [1.08, 0.58, 18],
    [1.5, 0.72, 17],
    [1.08, 1.06, 17],
    [1.5, 1.2, 16],
  ];
  for (const [u, vv, h] of battery) p.silo(u, vv, 0.3, 0, h);
  p.belt(p.P(0.86, 0.9, 6), p.P(1.14, 0.62, 17));
  p.box(1.2, 1.6, 1.86, 1.86, 0, 3, CONCRETE, 'plain');
}

/** The chemical plant: the steel frames, the spheres and the pipes between them. */
function chemicalLot(p: Pen, v: number): void {
  const sign = COMPANY[(v + 4) % COMPANY.length];
  p.shadow(0.1, 0.12, 1.9, 1.8);
  p.box(
    0.1,
    0.12,
    1.5,
    0.7,
    0,
    10,
    CONCRETE,
    'plain',
    [...ribbon(2, 10, 3, 4), ...ribbon(14, 22, 3, 4), { t0: 0, t1: 99, k0: 7, k1: 10, c: sign }],
    [{ t0: 0, t1: 99, k0: 7, k1: 10, c: shade(sign, 0.72) }],
    ROOF_DECK,
  );
  p.chimney(0.34, 0.36, 10, 10);
  // Two vertical tanks and three spheres, tied by the pipe run.
  p.silo(0.16, 0.8, 0.34, 0, 15, STEEL);
  p.silo(0.56, 0.8, 0.34, 0, 15, STEEL);
  p.sphere(1.3, 0.42, 10, 4);
  p.sphere(1.62, 0.5, 5, 3);
  p.sphere(1.44, 0.9, 3, 3);
  p.pipeRun(p.P(0.6, 1.0, 15), p.P(1.3, 0.6, 12));
  p.pipeRun(p.P(1.2, 0.5, 8), p.P(1.75, 1.0, 4));
}

/** The cold store: a blind brick box, the water tower on its legs and the loading dock. */
function coldStoreLot(p: Pen, v: number): void {
  const sign = COMPANY[(v + 1) % COMPANY.length];
  const u0 = 0.1;
  const v0 = 0.12;
  const u1 = 1.72;
  const v1 = 1.6;
  p.shadow(u0, v0, u1, v1);
  p.box(
    u0,
    v0,
    u1,
    v1,
    0,
    16,
    BRICK,
    'brick',
    [
      { t0: 6, t1: 18, k0: 0, k1: 9, c: GARAGE },
      { t0: 22, t1: 26, k0: 2, k1: 5, c: GLASS },
      { t0: 30, t1: 34, k0: 2, k1: 5, c: GLASS },
      { t0: 0, t1: 99, k0: 11, k1: 14, c: sign },
    ],
    [{ t0: 0, t1: 99, k0: 11, k1: 14, c: shade(sign, 0.72) }],
    ROOF_DECK,
  );
  p.cornice(u0, v0, u1, v1, 16, 1, BRICK);
  p.parapet(u0, v0, u1, v1, 17, 1, BRICK);
  p.chimney(1.5, 0.6, 17, 10);
  // The water tower: four legs and the tank, the landmark of every frigorifico.
  p.box(0.5, 1.0, 0.54, 1.04, 17, 6, tone(STEEL[2]), 'plain');
  p.box(0.92, 1.0, 0.96, 1.04, 17, 6, tone(STEEL[2]), 'plain');
  p.box(0.5, 1.3, 0.54, 1.34, 17, 6, tone(STEEL[2]), 'plain');
  p.box(0.92, 1.3, 0.96, 1.34, 17, 6, tone(STEEL[2]), 'plain');
  p.box(0.44, 0.94, 1.02, 1.4, 23, 5, TANK, 'plain');
  p.hip(0.44, 0.94, 1.02, 1.4, 28, 2, TANK);
  // The dock: a concrete platform along the front, where the trucks back in.
  p.box(0.1, 1.62, 1.72, 1.86, 0, 2, tone(CONCRETE[1]), 'plain');
}

/** The industrial park: three naves of different heights, the yard, the tanks and the stack. */
function parkLot(p: Pen, v: number): void {
  const sign = COMPANY[(v + 2) % COMPANY.length];
  p.shadow(0.12, 0.14, 2.86, 2.2);
  p.box(
    0.12,
    0.16,
    1.1,
    1.4,
    0,
    12,
    CHAPA,
    'sheet',
    [
      { t0: 3, t1: 13, k0: 0, k1: 9, c: GARAGE },
      { t0: 0, t1: 99, k0: 9, k1: 12, c: shade(sign, 0.8) },
    ],
    [],
    ROOF_DECK,
  );
  p.gable(0.09, 0.13, 1.13, 1.43, 12, 4, CHAPA, CHAPA[1], 'sheet');
  p.box(
    1.16,
    0.2,
    2.2,
    1.2,
    0,
    20,
    CONCRETE,
    'plain',
    [
      ...ribbon(3, 10, 4, 4),
      ...ribbon(13, 20, 4, 4),
      ...ribbon(3, 10, 11, 4),
      ...ribbon(13, 20, 11, 4),
      { t0: 22, t1: 30, k0: 0, k1: 9, c: GARAGE },
      { t0: 0, t1: 99, k0: 16, k1: 19, c: sign },
    ],
    [{ t0: 0, t1: 99, k0: 16, k1: 19, c: shade(sign, 0.72) }],
    ROOF_DECK,
  );
  p.cornice(1.16, 0.2, 2.2, 1.2, 20, 1, CONCRETE);
  p.parapet(1.16, 0.2, 2.2, 1.2, 21, 1, CONCRETE);
  p.box(1.3, 0.3, 1.7, 0.6, 21, 3, CONCRETE, 'plain');
  p.chimney(1.42, 0.44, 21, 12);
  p.chimney(0.4, 0.78, 15, 8);
  p.box(
    2.3,
    0.3,
    2.8,
    0.8,
    0,
    7,
    WALLS[3],
    'plain',
    [
      { t0: 3, t1: 9, k0: 2, k1: 5, c: GLASS },
      { t0: 12, t1: 15, k0: 0, k1: 5, c: DOOR },
    ],
    [{ t0: 3, t1: 8, k0: 2, k1: 5, c: GLASS }],
    ROOF_DECK,
  );
  // The yard: containers, the pipe run and the ore.
  p.container(0.2, 2.3, SIGNS[(v + 1) % SIGNS.length]);
  p.container(0.7, 2.3, SIGNS[(v + 4) % SIGNS.length]);
  p.container(1.2, 2.4, SIGNS[(v + 3) % SIGNS.length]);
  p.container(0.2, 2.62, SIGNS[(v + 2) % SIGNS.length]);
  p.pipeRun(p.P(1.1, 1.5, 9), p.P(2.3, 2.4, 4));
  p.pile(2.5, 1.9, 0.2);
  p.silo(2.3, 1.2, 0.28, 0, 12);
}

/** The steel mill: the big hall, the two stacks, the gas holder and the ore under the open sky. */
function millLot(p: Pen, v: number): void {
  const sign = COMPANY[(v + 4) % COMPANY.length];
  p.shadow(0.12, 0.14, 2.86, 2.5);
  p.box(
    0.12,
    0.16,
    1.9,
    2.0,
    0,
    24,
    CONCRETE,
    'plain',
    [
      ...ribbon(3, 12, 4, 5),
      ...ribbon(15, 24, 4, 5),
      ...ribbon(3, 12, 12, 5),
      ...ribbon(15, 24, 12, 5),
      { t0: 28, t1: 42, k0: 0, k1: 12, c: GARAGE },
      { t0: 44, t1: 50, k0: 3, k1: 7, c: GLASS },
      { t0: 0, t1: 99, k0: 18, k1: 22, c: sign },
    ],
    [...ribbon(3, 14, 4, 5), ...ribbon(3, 14, 12, 5), { t0: 0, t1: 99, k0: 18, k1: 22, c: shade(sign, 0.72) }],
    ROOF_DECK,
  );
  p.sawtooth(0.09, 0.13, 1.93, 2.03, 24, 4, 4, CHAPA);
  p.chimney(0.4, 0.4, 28, 20);
  p.chimney(0.9, 0.32, 28, 14);
  p.sphere(2.3, 0.5, 12, 5);
  p.silo(2.2, 1.0, 0.3, 0, 18, STEEL);
  p.silo(2.6, 1.0, 0.3, 0, 15, STEEL);
  p.pipeRun(p.P(2.35, 0.9, 14), p.P(1.9, 1.4, 12));
  p.pipeRun(p.P(2.6, 1.2, 15), p.P(1.9, 1.8, 10));
  p.pile(0.4, 2.4, 0.3);
  p.pile(1.1, 2.5, 0.24);
  p.container(1.9, 2.3, SIGNS[(v + 1) % SIGNS.length]);
  p.container(2.3, 2.4, SIGNS[(v + 3) % SIGNS.length]);
}

/* ---------- The plaza and the street ---------- */

/** Greens of a kept plaza, from the corner in shade to the tuft that catches the light. */
const GRASS = ['#4d8440', '#559148', '#5f9a4f'].map(hex);
/** The same for a plaza nobody keeps: dry, patchy, half bare. */
const GRASS_DRY = ['#63701f', '#7f8a2c', '#97a03c'].map(hex);
/** Paving of the walks: the joint, the slab, and the light on the slab. */
const PAVING = ['#bda86f', '#d8c185', '#e5d2a1'].map(hex);
const PAVING_DRY = ['#8f8060', '#b0a074', '#c2b287'].map(hex);
const STONE_LIGHT: Ramp = [hex('#b0a996'), hex('#d8d2c4'), hex('#efe9dc')];
const BRONZE: Ramp = [hex('#5e4a2c'), hex('#8a7448'), hex('#b79a63')];
const GRANITE: Ramp = [hex('#6f6a5e'), hex('#8d8778'), hex('#736d61')];
const GLORIETA = ramp('#4a6f45');
const BENCH = ramp('#8a6a45');
const CREAM = hex('#efe9dc');
const IRON = hex('#4a4650');
const WATER_TOP = hex('#3d85b0');
const WATER_FOAM = hex('#9fd0e4');
const FLOWERS = ['#c8392f', '#e0a526', '#8a3f7a', '#f4ece0'].map(hex);

/** How far out from the middle the walks run: the middle square, then one arm per connected edge. */
const WALK = 0.43;
const WALK_EDGE = 0.57;

/**
 * The floor of a plaza cell: the whole 32 x 16 diamond, with a walk running out to every edge that
 * touches another plaza, so a block of plazas reads as one garden and not as the same square
 * repeated. `mask` follows the bits of the cell's edges: back-right, front-right, front-left,
 * back-left.
 */
function plazaFloor(p: Pen, mask: number, dry: boolean, v: number): void {
  const grass = dry ? GRASS_DRY : GRASS;
  const pave = dry ? PAVING_DRY : PAVING;
  const inside = (x: number, y: number): boolean => {
    const u = ((x - p.ax) / 16 + (y - p.ay) / 8) / 2;
    const w = ((y - p.ay) / 8 - (x - p.ax) / 16) / 2;
    return u >= 0 && u <= 1 && w >= 0 && w <= 1;
  };
  const quad = (a: number, b: number, c: number, d: number): Pt[] => [p.P(a, b), p.P(c, b), p.P(c, d), p.P(a, d)];
  // The ground: two tones of green ordered by the Bayer matrix, with the odd dry patch.
  p.poly(quad(0, 0, 1, 1), (x, y) => {
    const d = bayer(x, y);
    if (noise(x >> 1, y >> 1, 7) < (dry ? 0.12 : 0.06)) return dry ? hex('#8a7448') : grass[0];
    return d < (dry ? 0.36 : 0.18) ? grass[0] : d > (dry ? 0.8 : 0.9) ? grass[2] : grass[1];
  });
  // Tufts in the corners, where nobody walks.
  for (const [u, w] of [
    [0.14, 0.2],
    [0.82, 0.26],
    [0.24, 0.82],
    [0.8, 0.86],
  ] as const) {
    const [x, y] = p.P(u, w);
    const cx = Math.round(x);
    const cy = Math.round(y);
    p.px.set(cx, cy, grass[2]);
    p.px.set(cx + 1, cy - 1, grass[2]);
    p.px.set(cx, cy - 1, grass[0]);
  }
  const arms: [number, number, number, number][] = [[WALK, WALK, WALK_EDGE, WALK_EDGE]];
  if (mask & 1) arms.push([WALK, 0, WALK_EDGE, WALK]);
  if (mask & 2) arms.push([WALK_EDGE, WALK, 1, WALK_EDGE]);
  if (mask & 4) arms.push([WALK, WALK_EDGE, WALK_EDGE, 1]);
  if (mask & 8) arms.push([0, WALK, WALK, WALK_EDGE]);
  for (const [a, b, c, d] of arms) {
    p.poly(quad(a, b, c, d), (x, y) => {
      if (!inside(x, y)) return null;
      // Slabs: every fifth pixel on the diagonal is a joint, the rest is the face of the slab.
      if ((x + y) % 5 === 0) return pave[0];
      return bayer(x, y) < 0.5 ? pave[1] : pave[2];
    });
  }
  // A crack across the paving is what tells a plaza went to seed.
  if (dry) {
    const [x0, y0] = p.P(0.42, 0.5);
    const [x1, y1] = p.P(0.5, 0.58);
    p.px.line([x0, y0], [x1, y1], pave[0]);
  }
  if (!dry && v % 3 === 0) {
    // A cantero: four flowers on two stems, in a patch small enough to read as planted.
    for (let k = 0; k < 4; k++) {
      const [x, y] = p.P(0.14 + 0.035 * (k % 2), 0.46 + 0.04 * (k >> 1));
      const cx = Math.round(x);
      const cy = Math.round(y);
      p.px.set(cx, cy, FLOWERS[(v + k) % FLOWERS.length]);
      p.px.set(cx, cy + 1, grass[0]);
    }
  }
}

/** A bench: the back, the seat and two legs. */
function bench(p: Pen, u: number, v: number): void {
  const [x, y] = p.P(u, v);
  const cx = Math.round(x);
  const cy = Math.round(y);
  p.px.rect(cx - 3, cy - 4, 6, 1, BENCH[1]);
  p.px.rect(cx - 3, cy - 3, 6, 1, BENCH[0]);
  p.px.rect(cx - 3, cy - 2, 6, 1, BENCH[2]);
  p.px.set(cx - 2, cy - 1, BENCH[0]);
  p.px.set(cx + 2, cy - 1, BENCH[0]);
}

/** The lamp of the plaza: an iron post and a warm head. */
function lampPost(p: Pen, u: number, v: number): void {
  const [x, y] = p.P(u, v);
  const cx = Math.round(x);
  const cy = Math.round(y);
  p.px.rect(cx, cy - 10, 1, 10, IRON);
  p.px.set(cx - 1, cy - 11, IRON);
  p.px.rect(cx - 1, cy - 12, 2, 1, hex('#ffd84a'));
  p.px.set(cx - 1, cy - 11, hex('#fff3b0'));
}

/** The monument: three stone steps, the pedestal and the bust. */
function monument(p: Pen): void {
  // Two steps of granite, then the pedestal of light stone: without the darker base the whole
  // thing reads as one white mound over the pale paving.
  p.box(0.24, 0.24, 0.76, 0.76, 0, 2, GRANITE, 'plain');
  p.box(0.32, 0.32, 0.68, 0.68, 2, 2, STONE_LIGHT, 'plain');
  p.box(0.42, 0.42, 0.58, 0.58, 4, 5, STONE_LIGHT, 'plain');
  const [bx, by] = p.P(0.42, 0.58, 7);
  p.px.rect(Math.round(bx), Math.round(by) - 2, 6, 2, BRONZE[1]);
  p.box(0.45, 0.45, 0.55, 0.55, 9, 4, BRONZE, 'plain');
  const [x, y] = p.P(0.5, 0.56, 13);
  p.px.rect(Math.round(x) - 1, Math.round(y), 2, 1, BRONZE[2]);
}

/** The fountain: the basin, the water and the jet. */
function fountain(p: Pen): void {
  p.box(0.28, 0.28, 0.72, 0.72, 0, 2, STONE_LIGHT, 'plain', [], [], STONE_LIGHT[1]);
  p.poly([p.P(0.35, 0.35, 2.2), p.P(0.65, 0.35, 2.2), p.P(0.65, 0.65, 2.2), p.P(0.35, 0.65, 2.2)], (x, y) =>
    bayer(x, y) < 0.3 ? WATER_FOAM : WATER_TOP,
  );
  const [x, y] = p.P(0.5, 0.5, 2);
  const cx = Math.round(x);
  const cy = Math.round(y);
  p.px.rect(cx, cy - 6, 1, 6, WATER_FOAM);
  p.px.set(cx - 1, cy - 5, WATER_TOP);
  p.px.set(cx + 1, cy - 3, WATER_TOP);
}

/** The glorieta: the deck, the ring of posts and the green roof. */
function bandstand(p: Pen): void {
  p.box(0.26, 0.26, 0.74, 0.74, 0, 2, STONE_LIGHT, 'plain', [], [], STONE_LIGHT[1]);
  for (const [u, w] of [
    [0.3, 0.3],
    [0.5, 0.28],
    [0.7, 0.3],
    [0.72, 0.5],
    [0.7, 0.7],
    [0.5, 0.72],
    [0.3, 0.7],
    [0.28, 0.5],
  ] as const) {
    const [x, y] = p.P(u, w, 2);
    p.px.rect(Math.round(x), Math.round(y) - 5, 1, 5, CREAM);
  }
  // The rail between the posts, then the roof over everything.
  const rail: [number, number, number, number][] = [
    [0.3, 0.3, 0.7, 0.3],
    [0.7, 0.3, 0.7, 0.7],
    [0.5, 0.28, 0.5, 0.72],
    [0.3, 0.5, 0.72, 0.5],
  ];
  for (const [a, b, c, d] of rail) p.px.line(p.P(a, b, 3), p.P(c, d, 3), shade(CREAM, 0.86));
  p.hip(0.2, 0.2, 0.8, 0.8, 7, 5, GLORIETA);
  const [x, y] = p.P(0.5, 0.5, 12);
  p.px.set(Math.round(x), Math.round(y), hex('#ffd84a'));
}

/** What a plaza cell holds: the floor, and then whatever stands on it. */
export type PlazaLook = 'tree' | 'bare' | 'neglected';

/**
 * Paints a plaza cell. `mask` says which of its edges touch another plaza, so the walks line up and
 * a block of plazas reads as one garden. The ornament goes in the middle, which is the only place a
 * cell has no edge; the cells on the edge of the block get benches, trees and lamps instead.
 */
export function paintPlaza(variant: number, look: PlazaLook, mask: number): { px: Pixels; ax: number; ay: number; smoke: [number, number][] } {
  const v = ((variant % 8) + 8) % 8;
  const p = penLot(1, 14);
  const dry = look === 'neglected';
  plazaFloor(p, mask, dry, v);
  const interior = (mask & 15) === 15 && !dry;
  if (interior) {
    // The middle of the block is the plaza proper: paved, so the ornament does not stand on grass.
    const a = 0.32;
    const b = 0.68;
    p.poly([p.P(a, a), p.P(b, a), p.P(b, b), p.P(a, b)], (x, y) => {
      const u = ((x - p.ax) / 16 + (y - p.ay) / 8) / 2;
      const w = ((y - p.ay) / 8 - (x - p.ax) / 16) / 2;
      const edge = u < a + 0.05 || u > b - 0.05 || w < a + 0.05 || w > b - 0.05;
      if (edge) return PAVING[0];
      if ((x + y) % 5 === 0) return PAVING[0];
      return bayer(x, y) < 0.5 ? PAVING[1] : PAVING[2];
    });
    const kind = v % 3;
    if (kind === 0) monument(p);
    else if (kind === 1) fountain(p);
    else bandstand(p);
  } else if (look === 'tree' && !dry) {
    p.tree(0.16, 0.22);
    if (v % 2) p.tree(0.82, 0.8);
  } else if (!dry) {
    bench(p, 0.2, 0.24);
    if (v % 2 === 0) bench(p, 0.8, 0.78);
  }
  if (!dry) {
    if (v % 2 === 1) lampPost(p, 0.78, 0.22);
    if (v % 4 === 3) lampPost(p, 0.22, 0.78);
  } else if (v % 4 === 0) {
    bench(p, 0.62, 0.3);
  }
  return { px: p.px, ax: p.ax, ay: p.ay, smoke: p.smoke };
}

/** Plaza sprites are asked for cell by cell during a redraw, so they are built once and kept. */
const plazaCache = new Map<string, Sprite>();

export function plazaPixelSprite(variant: number, look: PlazaLook, mask: number): Sprite {
  const key = `${((variant % 8) + 8) % 8}|${look}|${mask & 15}`;
  let sprite = plazaCache.get(key);
  if (!sprite) {
    sprite = spriteOf(paintPlaza(variant, look, mask));
    plazaCache.set(key, sprite);
  }
  return sprite;
}

/* ---------- The power plants ---------- */

const PAD = ramp('#b6b2a8');
const WHITE_PAINT = ramp('#f2efe6');
const PIPE_GAS = hex('#d8ab35');
const COAL = hex('#2d2a28');
const GRAVEL = [hex('#c9c2ad'), hex('#b9b2a0'), hex('#a09988')];

/** The concrete pad every plant stands on, with its kerb along the two edges that face the street. */
function pad(p: Pen, base: Ramp = PAD): void {
  p.box(0.05, 0.05, 1.95, 1.95, 0, 1.5, base, 'plain');
}

/** A heap of coal: a mound with its lit side, its shaded slope and a few lumps on the silhouette. */
function coalPile(p: Pen, u: number, v: number, w = 0.5): void {
  const [x, y] = p.P(u + w / 2, v + w / 2, 1.5);
  const cx = Math.round(x);
  const cy = Math.round(y);
  const half = Math.max(4, Math.round(w * 16));
  const hgt = Math.max(4, Math.round(w * 13));
  for (let i = 0; i < hgt; i++) {
    const span = Math.round(half * (1 - (i / hgt) * 0.85));
    p.px.rect(cx - span, cy - i, span * 2, 1, i < hgt * 0.35 ? shade(COAL, 1.5) : COAL);
  }
  p.px.line([cx, cy - hgt], [cx + half, cy], shade(COAL, 0.72));
  for (let i = 0; i < 7; i++) {
    p.px.set(cx - half + 3 + ((i * 7) % Math.max(1, half * 2 - 5)), cy - 1 - ((i * 3) % Math.max(1, hgt - 2)), shade(COAL, 1.7));
  }
}

/** A wind turbine: a tapered tower, its nacelle and three blades at one fixed angle. */
function turbine(p: Pen, u: number, v: number, h: number, turn: number): void {
  const [bx, by] = p.P(u, v, 1.5);
  const bx0 = Math.round(bx);
  const by0 = Math.round(by);
  // The tower: three pixels wide at the foot, one at the top, with the lit side on the left.
  for (let k = 0; k < h; k++) {
    const y = by0 - k;
    const t = k / h;
    const half = k < 4 ? 1 : 0;
    p.px.set(bx0 - half, y, WHITE_PAINT[1]);
    p.px.set(bx0, y, WHITE_PAINT[0]);
    p.px.set(bx0 + half, y, WHITE_PAINT[2]);
    if (half === 0 && t < 0.3) p.px.set(bx0 + 1, y, WHITE_PAINT[2]);
  }
  const cx = bx0;
  const cy = by0 - h;
  // The nacelle and its red hub.
  p.px.rect(cx - 2, cy - 1, 5, 2, WHITE_PAINT[1]);
  p.px.set(cx - 2, cy + 1, WHITE_PAINT[2]);
  p.px.set(cx, cy - 2, hex('#c8462f'));
  // Three blades: a line each, thicker at the root so the rotor reads as a rotor.
  for (let k = 0; k < 3; k++) {
    const a = turn + (k * Math.PI * 2) / 3;
    const [dx, dy] = [Math.cos(a), Math.sin(a)];
    for (let r = 2; r <= 11; r++) {
      const x = Math.round(cx + dx * r);
      const y = Math.round(cy - 1 + dy * r);
      p.px.set(x, y, r > 8 ? WHITE_PAINT[2] : WHITE_PAINT[0]);
      if (r < 7 && Math.abs(dy) < 0.8) p.px.set(x, y + 1, WHITE_PAINT[2]);
    }
  }
}

/**
 * The coal plant: the two stacks stand on the boiler house and are painted before it, so the house
 * hides their feet; the coal arrives in a heap at the back and climbs to the furnace on a belt.
 */
export function paintCoalPlant(): { px: Pixels; ax: number; ay: number; smoke: [number, number][] } {
  const p = penLot(2, 48);
  pad(p);
  // The stacks first, on the line of the boiler house roof.
  p.chimney(0.3, 0.12, 26, 22);
  p.chimney(0.78, 0.12, 26, 26);
  // The boiler house, brick, with its band of windows under the roof.
  p.box(0.14, 0.1, 1.1, 0.78, 1.5, 24, BRICK, 'brick', [
    { t0: 0, t1: 99, k0: 18, k1: 22, c: GLASS },
    { t0: 6, t1: 26, k0: 4, k1: 16, c: GLASS },
  ], [{ t0: 4, t1: 20, k0: 4, k1: 16, c: shade(GLASS, 0.9) }]);
  p.cornice(0.14, 0.1, 1.1, 0.78, 25.5, 1.5, BRICK);
  // The coal yard in the front corner, where the hall cannot hide it, and the short chute that
  // carries the coal into the furnace.
  coalPile(p, 1.42, 1.36, 0.42);
  const [cx0, cy0] = p.P(1.62, 1.5, 8);
  const [cx1, cy1] = p.P(1.32, 1.4, 12);
  p.pipeRun([Math.round(cx0), Math.round(cy0)], [Math.round(cx1), Math.round(cy1)], STEEL[1]);
  // The turbine hall on the left front, long and low, with a ribbon of glass along the street.
  p.box(0.14, 0.95, 1.3, 1.55, 1.5, 12, CHAPA, 'sheet', [
    { t0: 0, t1: 99, k0: 6, k1: 10, c: GLASS_LIT },
    { t0: 0, t1: 99, k0: 10, k1: 12, c: shade(CHAPA[1], 1.16) },
  ], [{ t0: 0, t1: 99, k0: 6, k1: 10, c: shade(GLASS_LIT, 0.82) }]);
  p.gable(0.12, 0.93, 1.32, 1.57, 13.5, 4, CHAPA, CHAPA[1], 'sheet');
  // The control room by the gate.
  p.box(0.2, 1.66, 0.66, 1.92, 1.5, 7, WHITE_PAINT, 'plain', [{ t0: 3, t1: 11, k0: 3, k1: 5, c: GLASS }]);
  return { px: p.px, ax: p.ax, ay: p.ay, smoke: p.smoke };
}

/** The gas plant: two spherical holders, a turbine hall in blue glass and a thin stack that hardly smokes. */
export function paintGasPlant(): { px: Pixels; ax: number; ay: number; smoke: [number, number][] } {
  const p = penLot(2, 44);
  pad(p);
  // The stack on the hall roof, behind the hall.
  p.chimney(0.3, 0.14, 20, 20, 0.09);
  for (const [su, sv] of [
    [0.42, 0.44],
    [0.34, 1.4],
  ]) {
    p.sphere(su, sv, 1.5, 9);
    const [sx, sy] = p.P(su, sv, 1.5 + 11);
    const cxs = Math.round(sx);
    const cys = Math.round(sy);
    p.px.rect(cxs - 7, cys, 15, 1, SILO[2]);
    p.px.rect(cxs - 4, cys + 8, 9, 1, SILO[2]);
  }
  // The turbine hall, glass and steel, in the middle of the lot.
  p.box(0.72, 0.5, 1.86, 1.02, 1.5, 18, STEEL, 'plain', [
    { t0: 0, t1: 99, k0: 9, k1: 16, c: GLASS_LIT },
    { t0: 0, t1: 99, k0: 16, k1: 18, c: shade(STEEL[1], 1.2) },
  ], [{ t0: 4, t1: 20, k0: 9, k1: 16, c: shade(GLASS_LIT, 0.86) }]);
  p.pipeRun(p.P(0.5, 0.62, 4), p.P(0.94, 0.66, 4), PIPE_GAS);
  p.pipeRun(p.P(0.42, 1.58, 4), p.P(0.86, 1.1, 4), PIPE_GAS);
  // The office by the gate.
  p.box(0.24, 1.55, 0.7, 1.9, 1.5, 8, WHITE_PAINT, 'plain', [
    { t0: 3, t1: 11, k0: 3, k1: 5, c: GLASS },
    { t0: 0, t1: 99, k0: 7, k1: 8, c: shade(STACK[0], 0.9) },
  ]);
  return { px: p.px, ax: p.ax, ay: p.ay, smoke: p.smoke };
}

/** The wind farm: three turbines on a gravel pad and the little hut that steps the power up. */
export function paintWindFarm(): { px: Pixels; ax: number; ay: number } {
  const p = penLot(2, 54);
  // Grass instead of concrete: this one is a field, and the map grass shows around it.
  p.poly(
    [p.P(0.05, 0.05), p.P(1.95, 0.05), p.P(1.95, 1.95), p.P(0.05, 1.95)],
    (x, y) => (bayer(x, y) < 0.45 ? GRASS[2] : GRASS[1]),
  );
  p.px.line(p.P(0.05, 1.95), p.P(1.95, 1.95), GRASS[0]);
  // A dirt track in from the street corner, which is how the truck reaches the hut.
  p.px.line(p.P(0.06, 1.7), p.P(1.5, 1.7), GRAVEL[2]);
  p.px.line(p.P(0.06, 1.78), p.P(1.5, 1.78), GRAVEL[1]);
  // The back turbines first, so the near ones stand in front of them.
  turbine(p, 0.5, 0.35, 40, 0.35);
  turbine(p, 1.35, 0.45, 44, 1.4);
  turbine(p, 0.75, 1.35, 47, 2.3);
  // The transformer hut and the little fence of the enclosure.
  p.box(1.42, 1.5, 1.82, 1.88, 1.5, 6, WHITE_PAINT, 'plain', [{ t0: 2, t1: 10, k0: 2, k1: 4, c: GLASS }]);
  p.fence(p.P(1.36, 1.98), p.P(1.98, 1.98));
  p.fence(p.P(1.98, 1.36), p.P(1.98, 1.98));
  return { px: p.px, ax: p.ax, ay: p.ay };
}

const plantCache = new Map<string, Sprite>();

/** The sprite of a power plant, keyed by its kind. */
export function plantPixelSprite(kind: PlantKind): Sprite {
  let sprite = plantCache.get(kind);
  if (!sprite) {
    sprite = spriteOf(kind === 'coal' ? paintCoalPlant() : kind === 'gas' ? paintGasPlant() : paintWindFarm());
    plantCache.set(kind, sprite);
  }
  return sprite;
}

/* ---------- The bus depot ---------- */

const DEPOT_SLAB: Ramp = [hex('#a8a49b'), hex('#9c988f'), hex('#82807a')];
const DEPOT_WALL: Ramp = [hex('#f2efe6'), hex('#e8e4dc'), hex('#cfc9bb')];
const TYRE = hex('#1f1611');

/** One bus in the yard: the line's colour, a row of windows, a lighter roof and the shadow under it. */
function depotBus(p: Pen, u0: number, v0: number, line: Ramp): void {
  const u1 = u0 + 0.62;
  const v1 = v0 + 0.34;
  p.box(
    u0,
    v0,
    u1,
    v1,
    0,
    9,
    line,
    'plain',
    [
      { t0: 2, t1: 20, k0: 4, k1: 7, c: GLASS },
      { t0: 0, t1: 99, k0: 7, k1: 9, c: shade(line[1], 0.9) },
      { t0: 0, t1: 99, k0: 2, k1: 3, c: shade(line[1], 1.22) },
    ],
    [
      { t0: 2, t1: 16, k0: 4, k1: 7, c: shade(GLASS, 0.9) },
      { t0: 0, t1: 99, k0: 7, k1: 9, c: shade(line[2], 0.9) },
    ],
    line[0],
  );
  // The wheels show as a dark line under the body: at this size anything rounder reads as dirt.
  for (const du of [0.12, 0.44]) {
    const [x, y] = p.P(u0 + du, v1, 1);
    p.px.rect(Math.round(x) - 1, Math.round(y), 3, 1, TYRE);
  }
}

/**
 * A bus depot: a 2×2 lot, since a cochera that keeps three buses and their office does not fit in
 * one. Pale slab, the office and its sign at the back in the colour of the line, two buses parked
 * nose to the street and the bay markings between them.
 */
export function paintBusDepot(color: number): { px: Pixels; ax: number; ay: number } {
  const c = hex(BUS_COLORS[((color % BUS_COLORS.length) + BUS_COLORS.length) % BUS_COLORS.length].hex);
  const line: Ramp = [shade(c, 1.16), c, shade(c, 0.74)];
  const p = penLot(2, 15);
  // The slab, and the kerb along the two edges that face the street.
  p.poly(
    [p.P(0.04, 0.04), p.P(1.96, 0.04), p.P(1.96, 1.96), p.P(0.04, 1.96)],
    (x, y) => (bayer(x, y) < 0.4 ? DEPOT_SLAB[1] : DEPOT_SLAB[0]),
  );
  p.px.line(p.P(0.04, 1.96), p.P(1.96, 1.96), DEPOT_SLAB[2]);
  p.px.line(p.P(1.96, 0.04), p.P(1.96, 1.96), DEPOT_SLAB[2]);
  // Where the nose of each bus goes, painted on the slab.
  for (const v of [0.5, 1.42]) p.px.line(p.P(0.16, v), p.P(0.95, v), CREAM);
  // The office, with its door in glass and the sign of the line standing on the roof.
  p.box(
    1.18,
    0.12,
    1.86,
    0.6,
    0,
    11,
    DEPOT_WALL,
    'plain',
    [
      { t0: 4, t1: 14, k0: 1, k1: 8, c: GLASS },
      { t0: 16, t1: 21, k0: 1, k1: 8, c: shade(GLASS, 0.88) },
      { t0: 0, t1: 99, k0: 9, k1: 11, c: line[1] },
    ],
    [{ t0: 0, t1: 99, k0: 9, k1: 11, c: line[2] }],
    DEPOT_SLAB[1],
  );
  p.canopy(1.24, 0.62, 1.86, 8, line[1], shade(line[1], 0.74), 2);
  // The buses: the line's colour is what tells two depots apart from the outside.
  depotBus(p, 0.18, 0.62, line);
  depotBus(p, 0.18, 1.54, line);
  // A pump for the night shift, and the gate post by the entrance.
  p.box(1.24, 1.3, 1.44, 1.5, 0, 4, STEEL, 'plain');
  p.px.line(p.P(1.24, 1.4, 4), p.P(1.24, 1.4, 6), TYRE);
  return { px: p.px, ax: p.ax, ay: p.ay };
}

const depotCache = new Map<number, Sprite>();

/** The sprite of a bus depot, keyed by the colour of its line. */
export function busDepotPixelSprite(color: number): Sprite {
  let sprite = depotCache.get(color);
  if (!sprite) {
    sprite = spriteOf(paintBusDepot(color));
    depotCache.set(color, sprite);
  }
  return sprite;
}

/* ---------- The coast ---------- */

/** Slabs of a rambla: the joint, the stone, and the light on it. */
const SLAB = ['#b6ab96', '#d6cdbb', '#e6ded0'].map(hex);
/** The balustrade and the lamps: the same cream the promenade already uses. */
const BALUSTRE = hex('#efe9dc');
const BALUSTRE_DARK = hex('#c9c0ad');
const WATER_SHALLOW = hex('#5d9dc0');
const WOOD_DECK: Ramp = [hex('#6b4a2e'), hex('#b5824a'), hex('#8d6238')];
const WOOD_PILING: Ramp = [hex('#3a2414'), hex('#5d3f26'), hex('#4a2f1a')];
const BOAT = hex('#c8462f');

/**
 * The floor of a promenade cell: stone slabs over the whole diamond, and the water side carrying a
 * kerb of its own so the balustrade has something to stand on. The bits of `variant` are the sides
 * that face water, in the order back-right, front-right, front-left, back-left.
 */
function promenadeFloor(p: Pen, variant: number): void {
  const water = [0, 1, 2, 3].filter((k) => variant & (1 << k));
  p.poly([p.P(0, 0), p.P(1, 0), p.P(1, 1), p.P(0, 1)], (x, y) => {
    // Big square slabs: a joint every seven pixels on both diagonals.
    const u = ((x - p.ax) / 16 + (y - p.ay) / 8) / 2;
    const w = ((y - p.ay) / 8 - (x - p.ax) / 16) / 2;
    const rows = Math.floor(u * 2.4) !== Math.floor((u + 0.045) * 2.4) || Math.floor(w * 2.4) !== Math.floor((w + 0.045) * 2.4);
    if (rows) return SLAB[0];
    return bayer(x, y) < 0.4 ? SLAB[1] : SLAB[2];
  });
  // A kerb along every side that looks at the water, and the drain of the rail above it.
  for (const k of water) {
    const [a, b, c, d] = [
      [0, 0, 1, 0],
      [1, 0, 1, 1],
      [0, 1, 1, 1],
      [0, 0, 0, 1],
    ][k];
    const ku = (c - a) * 0.06;
    const kv = (d - b) * 0.06;
    p.poly([p.P(a, b), p.P(c, b), p.P(c + kv * 0.4, d), p.P(a + ku * 0.4, d)], (x, y) => (bayer(x, y) < 0.5 ? SLAB[0] : SLAB[1]));
    p.poly([p.P(a + ku, b + kv), p.P(c - ku * 0, b + kv), p.P(c, d - kv), p.P(a, d - kv)], () => SLAB[0]);
  }
  // The water under the rail shows at the very edge of the cell.
  for (const k of water) {
    const [a, b, c, d] = [
      [0, 0, 1, 0],
      [1, 0, 1, 1],
      [0, 1, 1, 1],
      [0, 0, 0, 1],
    ][k];
    p.px.line(p.P(a, b, -1.4), p.P(c, d, -1.4), WATER_SHALLOW);
  }
}

/** The balustrade of one side: a stone base, two rails and the posts between them. */
function balustrade(p: Pen, side: number): void {
  const [a, b, c, d] = [
    [0, 0, 1, 0],
    [1, 0, 1, 1],
    [0, 1, 1, 1],
    [0, 0, 0, 1],
  ][side];
  const mn = 0.1;
  const a0 = a + (0.5 - a) * mn;
  const b0 = b + (0.5 - b) * mn;
  const c0 = c + (0.5 - c) * mn;
  const d0 = d + (0.5 - d) * mn;
  // The plinth, a solid rail two pixels thick, and three posts. A post every quarter turn reads as a
  // fence of sticks instead of a stone balustrade.
  p.px.line(p.P(a0, b0, 1), p.P(c0, d0, 1), SLAB[0]);
  p.px.line(p.P(a0, b0, 2), p.P(c0, d0, 2), BALUSTRE_DARK);
  p.px.line(p.P(a0, b0, 5), p.P(c0, d0, 5), BALUSTRE);
  p.px.line(p.P(a0, b0, 6), p.P(c0, d0, 6), BALUSTRE);
  p.px.line(p.P(a0, b0, 7), p.P(c0, d0, 7), BALUSTRE_DARK);
  for (const t of [0, 0.5, 1]) {
    const u = a0 + (c0 - a0) * t;
    const v = b0 + (d0 - b0) * t;
    p.px.line(p.P(u, v, 2), p.P(u, v, 5), BALUSTRE_DARK);
  }
}

/** A plane tree of the rambla: a crown wide enough to shade the slabs. */
function shadeTree(p: Pen, u: number, v: number): void {
  const [x, y] = p.P(u, v);
  const cx = Math.round(x);
  const cy = Math.round(y);
  p.px.rect(cx, cy - 6, 1, 6, hex('#6b5540'));
  p.px.blob(cx, cy - 11, 5, 3.4, [hex('#7fa85c'), hex('#5a8f45'), hex('#3f6f34')], null, false);
  p.px.blob(cx + 2, cy - 13, 4, 2.6, [hex('#8ab868'), hex('#639a4c'), hex('#456f36')], null, false);
}

/**
 * Paints a promenade cell. `variant` carries the sides that face water in its low four bits and the
 * lamp in bit 16, the same mask the renderer builds.
 */
export function paintPromenade(variant: number): { px: Pixels; ax: number; ay: number; smoke: [number, number][] } {
  const p = penLot(1, 18);
  promenadePixel(p, variant);
  return { px: p.px, ax: p.ax, ay: p.ay, smoke: p.smoke };
}

/** The rambla: slabs, a balustrade on every side that looks at the river, a bench, a tree, a lamp. */
function promenadePixel(p: Pen, variant: number): void {
  const water = [0, 1, 2, 3].filter((k) => variant & (1 << k));
  promenadeFloor(p, variant);
  for (const k of water) balustrade(p, k);
  const lamp = (variant & 16) !== 0;
  // The furniture goes on the land side, away from the rail.
  const land = [0, 1, 2, 3].find((k) => !water.includes(k)) ?? 0;
  const [fu, fv] = [
    [0.5, 0.24],
    [0.78, 0.5],
    [0.5, 0.78],
    [0.24, 0.5],
  ][land];
  if (lamp) lampPost(p, fu, fv);
  else {
    bench(p, fu, fv);
    if (variant % 3 === 0) shadeTree(p, 0.5 + (fu - 0.5) * 0.2, 0.5 + (fv - 0.5) * 0.2);
    else if (variant % 3 === 1) flowerBedAt(p, fu - 0.12, fv - 0.1, variant);
  }
}

/** A strip of flowers along the foot of a tree or a bench. */
function flowerBedAt(p: Pen, u: number, v: number, seed: number): void {
  for (let k = 0; k < 3; k++) {
    const [x, y] = p.P(u + 0.09 * k, v + 0.03 * (k % 2));
    p.px.set(Math.round(x), Math.round(y), FLOWERS[(seed + k) % FLOWERS.length]);
  }
}

/**
 * Paints a fishing pier. `dir` is the side the jetty runs out to, 0 to 3 in the order of the cell's
 * edges: back-right, front-right, front-left, back-left.
 */
export function paintFishing(dir: number): { px: Pixels; ax: number; ay: number; smoke: [number, number][] } {
  const p = penLot(1, 18);
  fishingPixel(p, dir);
  return { px: p.px, ax: p.ax, ay: p.ay, smoke: p.smoke };
}

/**
 * The fishing pier: a wooden jetty running out to the water on `dir`, on pilings, with the crates at
 * the dry end and the boat tied at the wet one.
 */
function fishingPixel(p: Pen, dir: number): void {
  const [du, dv] = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ][dir];
  const [pu, pv] = [-dv, du];
  const at = (t: number, s: number): [number, number] => [0.5 + du * t + pu * s, 0.5 + dv * t + pv * s];
  // The pilings first, so the deck sits on them.
  for (const t of [-0.4, -0.05, 0.3]) {
    for (const s of [-0.14, 0.14]) {
      const [u, v] = at(t, s);
      p.box(u - 0.035, v - 0.035, u + 0.035, v + 0.035, 0, 5, WOOD_PILING, 'plain');
    }
  }
  // The deck, raised five pixels over the water.
  const [u0, v0] = at(-0.5, -0.16);
  const [u1, v1] = at(0.42, 0.16);
  p.box(Math.min(u0, u1), Math.min(v0, v1), Math.max(u0, u1), Math.max(v0, v1), 5, 2, WOOD_DECK, 'plain', [], [], WOOD_DECK[2]);
  // The planks across the deck.
  for (let k = 1; k < 9; k++) {
    const t = -0.5 + (0.92 * k) / 9;
    const [au, av] = at(t, -0.16);
    const [bu, bv] = at(t, 0.16);
    p.px.line(p.P(au, av, 7), p.P(bu, bv, 7), WOOD_DECK[0]);
  }
  // Crates at the dry end, the net and the bollard at the wet one.
  const [cu, cv] = at(-0.42, -0.08);
  p.box(cu - 0.09, cv - 0.09, cu + 0.09, cv + 0.09, 7, 5, ramp('#c9a45a'), 'plain');
  const [cu2, cv2] = at(-0.42, 0.1);
  p.box(cu2 - 0.07, cv2 - 0.07, cu2 + 0.07, cv2 + 0.07, 7, 3, ramp('#8a6a45'), 'plain');
  const [nu, nv] = at(0.16, 0.02);
  for (let a = 0; a < 3; a++) {
    for (let b = 0; b < 2; b++) {
      const [x, y] = p.P(nu + 0.03 * a, nv + 0.03 * b, 7.2);
      p.px.set(Math.round(x), Math.round(y), BALUSTRE_DARK);
    }
  }
  const [bu, bv] = at(0.36, 0.14);
  const [bx, by] = p.P(bu, bv, 7);
  p.px.rect(Math.round(bx), Math.round(by) - 2, 1, 2, WOOD_PILING[1]);
  // The boat, tied beside the head of the jetty.
  const [ou, ov] = at(0.5, 0.4);
  const [ox, oy] = p.P(ou, ov, 1);
  const cx = Math.round(ox);
  const cy = Math.round(oy);
  // The hull: a pointed bow, the gunwale in cream and the bottom in shade.
  const hull = [BOAT, shade(BOAT, 0.82), shade(BOAT, 0.62)];
  p.px.rect(cx - 4, cy - 1, 9, 1, hull[0]);
  p.px.rect(cx - 3, cy, 7, 1, hull[1]);
  p.px.rect(cx - 2, cy + 1, 5, 1, hull[2]);
  p.px.rect(cx - 4, cy - 2, 9, 1, hex('#f4f0e6'));
  p.px.set(cx + 5, cy - 1, hull[0]);
  p.px.set(cx - 5, cy - 1, hull[0]);
  // The mast and its sail, drawn as a triangle of rows instead of a square.
  p.px.rect(cx + 1, cy - 11, 1, 9, hex('#6b4a2e'));
  p.px.rect(cx + 2, cy - 10, 2, 1, hex('#f4f0e6'));
  p.px.rect(cx + 2, cy - 9, 3, 1, hex('#f4f0e6'));
  p.px.rect(cx + 2, cy - 8, 4, 1, hex('#f4f0e6'));
  p.px.rect(cx + 2, cy - 7, 4, 1, hex('#e6ded0'));
}

const coastCache = new Map<string, Sprite>();

/** The sprite of a promenade cell, keyed by the sides that face water and the lamp bit. */
export function promenadePixelSprite(variant: number): Sprite {
  const key = `prom:${variant}`;
  let sprite = coastCache.get(key);
  if (!sprite) {
    sprite = spriteOf(paintPromenade(variant));
    coastCache.set(key, sprite);
  }
  return sprite;
}

/** The sprite of a fishing pier, keyed by the side it runs out to. */
export function fishingPixelSprite(dir: number): Sprite {
  const key = `fish:${dir}`;
  let sprite = coastCache.get(key);
  if (!sprite) {
    sprite = spriteOf(paintFishing(dir));
    coastCache.set(key, sprite);
  }
  return sprite;
}

/** Paints an industrial lot on one cell: level 1 to 5, each one a different kind of factory. */
export function paintIndustrial(level: number, variant: number): { px: Pixels; ax: number; ay: number; smoke: [number, number][] } {
  const lv = Math.max(1, Math.min(5, level));
  const v = ((variant % 8) + 8) % 8;
  const p = pen(HEIGHT.industrial[lv]);
  if (lv === 1) tinShop(p, v);
  else if (lv === 2) metalShop(p, v);
  else if (lv === 3) brickFactory(p, v);
  else if (lv === 4) concretePlant(p, v);
  else bigPlant(p, v);
  return { px: p.px, ax: p.ax, ay: p.ay, smoke: p.smoke };
}


/** Tallest pixel of each level, so the canvas has room without wasting any. */
const HEIGHT = {
  residential: [0, 22, 30, 36, 54, 78],
  commercial: [0, 24, 28, 34, 46, 62],
  industrial: [0, 16, 22, 30, 40, 50],
};

/** Paints a residential lot: level 1 to 5, the variant folded into the eight kept by the game. */
export function paintResidential(level: number, variant: number): { px: Pixels; ax: number; ay: number } {
  const lv = Math.max(1, Math.min(5, level));
  const v = ((variant % 8) + 8) % 8;
  const p = pen(HEIGHT.residential[lv]);
  if (lv === 1) humble(p, v);
  else if (lv === 2) family(p, v);
  else if (lv === 3) chorizo(p, v);
  else if (lv === 4) block(p, v);
  else tower(p, v);
  return { px: p.px, ax: p.ax, ay: p.ay };
}

/** Paints a commercial lot: kiosk, greengrocer, hairdresser, bar and clothing store. */
export function paintCommercial(level: number, variant: number): { px: Pixels; ax: number; ay: number } {
  const lv = Math.max(1, Math.min(5, level));
  const v = ((variant % 8) + 8) % 8;
  const p = pen(HEIGHT.commercial[lv]);
  if (lv === 1) kiosk(p, v);
  else if (lv === 2) greengrocer(p, v);
  else if (lv === 3) hairdresser(p, v);
  else if (lv === 4) bar(p, v);
  else clothingStore(p, v);
  return { px: p.px, ax: p.ax, ay: p.ay };
}

/** Paints a big lot: the kind decides the building, the variant its colours and details. */
export function paintLot(kind: LotKind, variant: number): { px: Pixels; ax: number; ay: number; smoke: [number, number][] } {
  const v = ((variant % 8) + 8) % 8;
  const p = penLot(LOT[kind].n, LOT[kind].h);
  if (kind === 'mercado') marketLot(p, v);
  else if (kind === 'bar') barLot(p, v);
  else if (kind === 'ropa') storeLot(p, v);
  else if (kind === 'oficinas') officeLot(p, v);
  else if (kind === 'galpon') warehouseLot(p, v);
  else if (kind === 'silos') silosLot(p, v);
  else if (kind === 'quimica') chemicalLot(p, v);
  else if (kind === 'frigorifico') coldStoreLot(p, v);
  else if (kind === 'polo') parkLot(p, v);
  else millLot(p, v);
  return { px: p.px, ax: p.ax, ay: p.ay, smoke: p.smoke };
}

/** The same lot as a sprite the map can blit. Needs a DOM: call it from the game, not a test. */
function spriteOf(painted: { px: Pixels; ax: number; ay: number; smoke?: [number, number][] }): Sprite {
  return { canvas: painted.px.toCanvas(1), ax: painted.ax, ay: painted.ay, smoke: painted.smoke ?? [] };
}

export const residentialPixelSprite = (level: number, variant: number): Sprite => spriteOf(paintResidential(level, variant));
export const commercialPixelSprite = (level: number, variant: number): Sprite => spriteOf(paintCommercial(level, variant));
export const lotPixelSprite = (kind: LotKind, variant: number): Sprite => spriteOf(paintLot(kind, variant));
export const industrialPixelSprite = (level: number, variant: number): Sprite => spriteOf(paintIndustrial(level, variant));
