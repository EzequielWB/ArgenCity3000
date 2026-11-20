/**
 * Pixel art for the city, painted at 1x with hard pixels and a closed palette: the zone buildings
 * and the multi-lot kinds, the plazas, the coast promenade and pier, the depots, the plants, the
 * services, the poles and the trees, the airports and harbours piece by piece, and the vehicles.
 *
 * The map draws with these painters, always. What is still in canvas lives in `sprites.ts`: the ten
 * unique buildings and the port, the resort and the lighthouse of the coast.
 *
 * The tone ramps come from the reference measured in `odd/tasks/estetica.md`: a cream wall shows
 * its two visible faces at 0.69 and 0.59 of its base colour. Footprints are the game's 32 x 16 px
 * cell and the anchor is the top corner of the diamond, the same one `sprites.ts` uses, so either
 * painter can be plugged into the map renderer.
 */
import { Pixels, bayer, hex, noise, shade, type Paint, type Pt, type RGB, type WallPaint } from './pixel';
import type { Sprite } from './sprites';
import { BUS_COLORS, SERVICE_SIZE, type CoastKind, type HubKind, type PlantKind, type ServiceKind } from '../config';

/** Face tones measured on the reference. */
const LEFT = 0.69;
const RIGHT = 0.59;

/** A material as its three visible values: the top, the left face and the right face. */
export type Ramp = [RGB, RGB, RGB];
export const ramp = (c: string): Ramp => tone(hex(c));
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
/** The facades of the tall blocks: grey, off-white, sand, celadon, rose, vanilla, salmon and stone. */
const TOWER_WALLS = ['#c3cfd4', '#ece4d6', '#e2cdaa', '#c8d5c2', '#d9c2b8', '#e8dfc4', '#dcb6a0', '#cbb7a4'].map(ramp);
/** The stone of the podium: the base of the towers is not the same grey all down the avenue either. */
const TOWER_BASES = ['#a9a395', '#b5a894', '#9ea7a4', '#b9ae9c'].map(ramp);
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

export class Pen {
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
    const cx = Math.round(x);
    const cy = Math.round(y);
    this.px.rect(cx, cy - h, 1, h, LEG);
    // Dos travesaños, el de arriba más corto: con uno solo en la punta el mástil se lee como una cruz, y
    // una cruz en lo alto de una torre de oficinas es una iglesia.
    this.px.rect(cx - 1, cy - h + 1, 3, 1, LEG);
    this.px.rect(cx - 2, cy - Math.round(h * 0.5), 5, 1, LEG);
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
export function pen(maxZ: number): Pen {
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

/** El ancho de una cara en píxeles, que es en lo que se miden los parches (`t0`/`t1`). */
const faceW = (a: number, b: number): number => Math.round((b - a) * 16);

/**
 * Nivel 5: la torre. Cuatro **modelos** y no uno con ocho colores: con veinte torres en la ciudad, lo que
 * distingue un edificio de otro a 1× es la **silueta** —el podio, los escalones, el ala baja— antes que el
 * color de la fachada. La variante elige el modelo (`v & 3`) y la paleta (`v`), así que cada modelo
 * aparece con dos colores distintos.
 */
function tower(p: Pen, v: number): void {
  const model = v & 3;
  const wall = TOWER_WALLS[v % TOWER_WALLS.length];
  const base = TOWER_BASES[(v >> 2) % TOWER_BASES.length];
  if (model === 1) towerSteps(p, wall, base);
  else if (model === 2) towerWing(p, wall, base);
  else if (model === 3) towerSlab(p, wall, base);
  else towerPodium(p, wall, base, v);
}

/** Modelo 0: podio ancho de dos plantas y el fuste esbelto encima, con cintas de vidrio. */
function towerPodium(p: Pen, wall: Ramp, base: Ramp, v: number): void {
  const h = 46 + ((v >> 2) & 1) * 6;
  p.shadow(0.06, 0.08, 0.94, 0.92);
  // El podio: dos plantas a la calle, más ancho que la torre, así la silueta entra y sale.
  p.box(0.06, 0.08, 0.94, 0.92, 0, 10, base, 'plain', [door(4, 4, 8), pane(10, 2, 4, 6, GLASS)], [pane(4, 2, 4, 6, GLASS)], ROOFTOP);
  p.canopy(0.08, 0.92, 0.9, 11, GLASS, shade(GLASS, 1.4));
  const w = faceW(0.18, 0.82);
  const front: Patch[] = [];
  const side: Patch[] = [];
  for (let z = 14; z + 4 <= h; z += 5) {
    front.push(...ribbon(1, w - 1, z, 3));
    side.push(...ribbon(2, w - 2, z, 3));
  }
  p.box(0.18, 0.2, 0.82, 0.8, 10, h - 10, wall, 'plain', front, side, ROOFTOP);
  p.cornice(0.18, 0.2, 0.82, 0.8, h, 2, CONCRETE);
  p.box(0.32, 0.34, 0.6, 0.6, h + 2, 5, CONCRETE, 'plain');
  p.tank(0.66, 0.26, h + 2);
  p.antenna(0.42, 0.4, h + 7, 9);
}

/**
 * Modelo 1: **los escalones**. Tres cuerpos que se van achicando en altura: la torre de los setenta, la
 * que en Buenos Aires se ve en hilera sobre Avenida del Libertador, y la que más se diferencia de la del
 * podio en el contorno.
 */
function towerSteps(p: Pen, wall: Ramp, base: Ramp): void {
  p.shadow(0.05, 0.07, 0.95, 0.93);
  p.box(0.05, 0.07, 0.95, 0.93, 0, 9, base, 'plain', [door(3, 4, 7), pane(9, 2, 5, 5, GLASS)], [pane(3, 2, 4, 5, GLASS)], ROOFTOP);
  p.canopy(0.07, 0.93, 0.93, 10, GLASS, shade(GLASS, 1.4));
  // Cuerpo 1: el más ancho, seis plantas.
  const f1 = bands(0.06, 0.94, 12, 34);
  p.box(0.06, 0.08, 0.94, 0.92, 9, 25, wall, 'plain', f1.front, f1.side, ROOFTOP);
  p.cornice(0.06, 0.08, 0.94, 0.92, 34, 1, CONCRETE);
  // Cuerpo 2: se mete un tercio y saca tres plantas más.
  const f2 = bands(0.2, 0.8, 38, 48);
  p.box(0.2, 0.22, 0.8, 0.78, 35, 13, wall, 'plain', f2.front, f2.side, ROOFTOP);
  p.cornice(0.2, 0.22, 0.8, 0.78, 48, 1, CONCRETE);
  // Cuerpo 3: la cabina, chica y alta.
  const f3 = bands(0.34, 0.66, 51, 58);
  p.box(0.34, 0.36, 0.66, 0.64, 49, 9, wall, 'plain', f3.front, f3.side, ROOFTOP);
  p.cornice(0.34, 0.36, 0.66, 0.64, 58, 1, CONCRETE);
  p.tank(0.42, 0.42, 59);
  p.antenna(0.54, 0.48, 65, 8);
}

/** Las cintas de vidrio de un cuerpo, cara por cara, cada cinco píxeles de altura. */
function bands(u0: number, u1: number, z0: number, z1: number): { front: Patch[]; side: Patch[] } {
  const w = faceW(u0, u1);
  const front: Patch[] = [];
  const side: Patch[] = [];
  for (let z = z0; z + 4 <= z1; z += 5) {
    front.push(...ribbon(1, w - 1, z, 3));
    side.push(...ribbon(2, w - 2, z, 3));
  }
  return { front, side };
}

/**
 * Modelo 2: **la torre con el ala baja**. La torre va sobre la esquina del fondo y un ala de dos plantas
 * cruza el frente: la planta es una ele y el skyline gana un cuerpo bajo que ninguna otra torre tiene.
 */
function towerWing(p: Pen, wall: Ramp, base: Ramp): void {
  p.shadow(0.05, 0.07, 0.95, 0.93);
  const H = 50;
  // La torre primero, que está atrás: el ala la tapa abajo y así se lee que sale de ella. Va ancha —0,56
  // del lote— porque con las cintas de vidrio y 54 de alto, una torre de 14 píxeles de ancho no es una
  // torre, es una chimenea.
  const tb = bands(0.1, 0.66, 14, H);
  p.box(0.1, 0.1, 0.66, 0.56, 0, H, wall, 'plain', tb.front, tb.side, ROOFTOP);
  p.cornice(0.1, 0.1, 0.66, 0.56, H, 2, CONCRETE);
  p.box(0.22, 0.22, 0.54, 0.44, H + 2, 4, CONCRETE, 'plain');
  p.antenna(0.3, 0.3, H + 6, 8);
  // El ala: local a la calle, una planta de oficinas arriba y la azotea con pretil.
  const ab = bands(0.06, 0.94, 9, 13);
  p.box(0.06, 0.56, 0.94, 0.94, 0, 13, base, 'plain', [
    { t0: 0, t1: 99, k0: 0, k1: 1, c: shade(base[1], 0.6) },
    door(4, 4, 8),
    pane(10, 1, 5, 6, GLASS),
    ...ab.front,
  ], [pane(2, 1, 4, 6, GLASS)], ROOFTOP);
  p.cornice(0.06, 0.56, 0.94, 0.94, 13, 1, CONCRETE);
  p.parapet(0.06, 0.56, 0.94, 0.94, 14, 1, base);
  p.canopy(0.07, 0.94, 0.93, 10, GLASS, shade(GLASS, 1.4));
}

/**
 * Modelo 3: **las franjas verticales**. El prisma toma casi todo el lote, sin podio, y la fachada es una
 * tabiquería de hormigón con el vidrio hundido: la del edificio de oficinas de los sesenta. En el mapa se
 * distingue por el remate, que vuela, y por no tener el escalón del podio.
 */
function towerSlab(p: Pen, wall: Ramp, base: Ramp): void {
  p.shadow(0.06, 0.08, 0.94, 0.92);
  const H = 52;
  p.box(0.1, 0.12, 0.9, 0.88, 0, 6, base, 'plain', [door(6, 4, 6), pane(12, 1, 4, 4, GLASS)], [pane(4, 1, 4, 4, GLASS)], ROOFTOP);
  const w = faceW(0.13, 0.87);
  const front: Patch[] = [];
  const side: Patch[] = [];
  for (let t = 1; t + 1 < w - 1; t += 4) {
    front.push({ t0: t, t1: t + 2, k0: 0, k1: H - 8, c: GLASS });
    front.push({ t0: t, t1: t + 2, k0: H - 8, k1: H - 7, c: shade(GLASS, 1.6) });
    side.push({ t0: t, t1: t + 2, k0: 0, k1: H - 8, c: shade(GLASS, 0.86) });
  }
  p.box(0.13, 0.15, 0.87, 0.85, 6, H - 6, wall, 'plain', front, side, ROOFTOP);
  p.cornice(0.13, 0.15, 0.87, 0.85, H, 2, CONCRETE);
  p.box(0.3, 0.3, 0.54, 0.54, H + 2, 4, CONCRETE, 'plain');
  p.tank(0.62, 0.2, H + 2);
  p.antenna(0.36, 0.34, H + 6, 7);
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

/**
 * Level 1, the second model: **la panadería**. The kiosk is a box with a flat awning; the bakery is the
 * only shop on the low street with a **pitched roof**, and that triangle is what names it before the
 * player reads the sign. On the pavement, two baskets of bread — a paper bag at 1x is a white blot, a
 * wooden basket with the bread showing over the rim is not.
 */
function bakery(p: Pen, v: number): void {
  const wall = WALLS[(v + 2) % WALLS.length];
  const sign = SIGNS[(v + 3) % SIGNS.length];
  const roof = ROOFS[(v + 1) % ROOFS.length];
  const u0 = 0.14;
  const v0 = 0.18;
  const u1 = 0.86;
  // The shop is shallow on purpose: the pitched roof needs the depth to read as a roof and not as a
  // triangle stuck on a box, and the pavement keeps the baskets.
  const v1 = 0.62;
  // La pared sube a once para que la banda del cartel tenga tres filas libres debajo del alero: con la
  // pared en diez, el faldón del techo y la banda se tocaban y el cartel se leía como el canto del techo.
  const h = 11;
  const marco = hex('#e6e9e2');
  p.shadow(u0, v0, u1, v1);
  p.box(
    u0,
    v0,
    u1,
    v1,
    0,
    h,
    wall,
    'plain',
    [
      { t0: 0, t1: 99, k0: 0, k1: 1, c: shade(wall[1], 0.55) },
      // La vidriera con las hogazas, el marco claro y la puerta de madera. Nada de toldo: la panadería no
      // lo tiene porque el horno ya calienta la vereda, y por eso se distingue del kiosco a la distancia.
      { t0: 2, t1: 4, k0: 3, k1: 6, c: shade(WARM, 0.9) },
      { t0: 5, t1: 7, k0: 3, k1: 6, c: shade(WARM, 1.14) },
      { t0: 8, t1: 10, k0: 3, k1: 6, c: shade(WARM, 0.82) },
      { t0: 1, t1: 2, k0: 1, k1: 7, c: marco },
      { t0: 10, t1: 11, k0: 1, k1: 7, c: marco },
      door(12, 4, 7),
      // La banda del cartel **debajo del alero** y con su filo claro: es la única banda de la calle baja,
      // porque la panadería no tiene toldo que haga ese trabajo.
      { t0: 0, t1: 99, k0: 7, k1: 8, c: shade(sign, 1.3) },
      { t0: 0, t1: 99, k0: 8, k1: 11, c: sign },
      // La masa de vidrio al final, que es el fondo y no tapa el marco ni el pan.
      { t0: 1, t1: 11, k0: 1, k1: 7, c: shade(INSIDE, 0.9) },
    ],
    [
      { t0: 0, t1: 99, k0: 7, k1: 9, c: shade(sign, 0.78) },
      pane(2, 1, 4, 5, shade(WARM, 0.86)),
    ],
  );
  // Rise de cuatro y no de seis: con seis el faldón delantero se comía la fachada entera y la
  // panadería quedaba sin vidriera a la vista.
  p.gable(u0 - 0.04, v0, u1 + 0.04, v1, h, 4, roof, wall[1], 'sheet');
  // Los canastos del pan: la madera con el pan asomando.
  p.crate(0.2, 0.7, hex('#e8c48a'));
  p.crate(0.78, 0.7, hex('#e8c48a'));
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

/**
 * Level 2, the second model: **la carnicería**. La verdulería está **abierta a la calle** —el frente es un
 * hueco oscuro con los cajones de fruta afuera— y la carnicería está **cerrada**: vidriera de vidrio con
 * marco, zócalo de azulejo y la carne colgada adentro en tres manchas rojas. La cámara de frío en la
 * azotea, con su ventilador, remata la silueta.
 */
function butcher(p: Pen, v: number): void {
  const wall = WALLS[(v + 5) % WALLS.length];
  const sign = SIGNS[(v + 4) % SIGNS.length];
  const meat = hex('#b8382c');
  const u0 = 0.1;
  const v0 = 0.16;
  const u1 = 0.9;
  const v1 = 0.72;
  const w = faceW(u0, u1);
  const h = 13;
  p.shadow(u0, v0, u1, v1);
  p.box(
    u0,
    v0,
    u1,
    v1,
    0,
    h,
    wall,
    'plain',
    [
      // El azulejo blanco del zócalo, **dos filas**: la carnicería está revestida hasta la cintura, pero con
      // tres de trece la fachada se volvía blanca y se comía la vidriera.
      { t0: 0, t1: 99, k0: 0, k1: 2, c: hex('#e6e9e2') },
      { t0: 0, t1: 99, k0: 2, k1: 3, c: shade(wall[1], 0.6) },
      // La carne colgada, **antes** de la masa de vidrio que va al final.
      { t0: 2, t1: 4, k0: 5, k1: 9, c: meat },
      { t0: 5, t1: 7, k0: 5, k1: 8, c: shade(meat, 0.84) },
      { t0: 8, t1: 10, k0: 5, k1: 9, c: shade(meat, 1.1) },
      door(w - 5, 4, 8),
      // La vidriera y su marco de aluminio.
      { t0: 1, t1: w - 6, k0: 4, k1: 10, c: shade(GLASS, 0.7) },
      { t0: 1, t1: 2, k0: 4, k1: 10, c: hex('#c9cdc4') },
      { t0: w - 7, t1: w - 6, k0: 4, k1: 10, c: hex('#c9cdc4') },
      { t0: 0, t1: 99, k0: 10, k1: 13, c: sign },
      { t0: 0, t1: 99, k0: 10, k1: 11, c: shade(sign, 1.3) },
    ],
    [
      { t0: 0, t1: 99, k0: 0, k1: 2, c: hex('#e6e9e2') },
      pane(2, 5, 5, 4, shade(GLASS, 0.74)),
      { t0: 0, t1: 99, k0: 10, k1: 13, c: shade(sign, 0.8) },
    ],
    ROOFTOP,
  );
  // El toldo recto de **chapa gris**, sin rayas: el de la verdulería es de lona verde y éste es de chapa.
  // Claro se confundía con el azulejo y con el parapeto; oscuro se lee como el alero metálico que es.
  p.canopy(u0, v1, u1, 10, hex('#8f948d'), hex('#767b74'), 2);
  p.cornice(u0, v0, u1, v1, h, 1, CONCRETE);
  p.parapet(u0, v0, u1, v1, h + 1, 1, wall);
  // La cámara de frío en la azotea, con el ventilador: la única caja con rejilla de la calle.
  p.box(0.22, 0.24, 0.48, 0.44, h + 1, 5, [hex('#dfe3dc'), hex('#cdd2cb'), hex('#b6bbb4')], 'plain', [
    { t0: 1, t1: 5, k0: 1, k1: 2, c: hex('#8f948d') },
    { t0: 1, t1: 5, k0: 3, k1: 4, c: hex('#8f948d') },
  ]);
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

/**
 * Level 3, the second model: **la farmacia**. La peluquería se nombra por el poste de barbero, que es una
 * columna de anillos; la farmacia se nombra por la **cruz verde**, que es el único símbolo de la calle y
 * el único objeto de este tamaño que se lee a un píxel de distancia. Dos pisos por la escalera de la cruz.
 */
function pharmacy(p: Pen, v: number): void {
  const wall = WALLS[(v + 3) % WALLS.length];
  const sign = SIGNS[(v + 2) % SIGNS.length];
  const GREEN = hex('#2f9a4a');
  const u0 = 0.1;
  const v0 = 0.14;
  const u1 = 0.9;
  const v1 = 0.8;
  const w = faceW(u0, u1);
  const h = 18;
  p.shadow(u0, v0, u1, v1);
  p.box(
    u0,
    v0,
    u1,
    v1,
    0,
    h,
    wall,
    'plain',
    [
      { t0: 0, t1: 99, k0: 0, k1: 1, c: shade(wall[1], 0.55) },
      { t0: 1, t1: 3, k0: 13, k1: 16, c: shade(GLASS, 0.8) },
      { t0: w - 3, t1: w - 1, k0: 13, k1: 16, c: shade(GLASS, 0.8) },
      ...ribbon(1, 6, 1, 7),
      door(w - 5, 4, 8),
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
  p.cornice(u0, v0, u1, v1, h, 2, CONCRETE);
  p.parapet(u0, v0, u1, v1, h + 2, 1, wall);
  // **La cruz en el techo y no en la pared**: pegada a la fachada, con cinco píxeles y el escorzo de la
  // isométrica encima, se leía como una mancha verde entre las ventanas. En el techo, sobre su pie de
  // hierro, es la única pieza de la calle que se ve desde la esquina —que es lo que una cruz de farmacia
  // hace en la Argentina— y no compite con nada.
  const [cx, cy] = p.P(0.5, 0.36, h + 2);
  const cxi = Math.round(cx);
  const cyi = Math.round(cy);
  p.px.rect(cxi, cyi - 6, 1, 6, LEG);
  p.px.rect(cxi, cyi - 15, 1, 9, GREEN);
  p.px.rect(cxi - 2, cyi - 12, 5, 1, GREEN);
  p.px.set(cxi - 3, cyi - 12, shade(GREEN, 0.8));
  p.px.set(cxi + 3, cyi - 12, shade(GREEN, 0.8));
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

/**
 * Level 4, the second model: **la pizzería**. El bar es de madera, con el tanque de agua en la azotea; la
 * pizzería tiene **toldo a rayas** y una **campana de chapa** con su chimenea, que es lo que se ve desde
 * la esquina: el humo del horno. Es el único de la calle que echa humo y el único con el techo ocupado por
 * algo que no es un tanque.
 */
function pizzeria(p: Pen, v: number): void {
  const wall = WALLS[(v + 1) % WALLS.length];
  const sign = SIGNS[v % SIGNS.length];
  const u0 = 0.08;
  const v0 = 0.12;
  const u1 = 0.92;
  const v1 = 0.82;
  const w = faceW(u0, u1);
  const h = 16;
  p.shadow(u0, v0, u1, v1);
  p.box(
    u0,
    v0,
    u1,
    v1,
    0,
    h,
    wall,
    'plain',
    [
      ...ribbon(1, 8, 1, 7),
      door(w - 5, 4, 8),
      { t0: 0, t1: 99, k0: 8, k1: 9, c: shade(sign, 0.55) },
      { t0: 0, t1: 99, k0: 9, k1: 12, c: sign },
      // Las ventanas del piso alto, con su cortina: arriba también se come.
      ...glazed(2, w - 2, h - 4, 3, 6, shade(WARM, 0.9)),
      { t0: 0, t1: 99, k0: h - 1, k1: h, c: shade(wall[1], 1.2) },
    ],
    [
      pane(3, 1, 4, 6, shade(WARM, 0.9)),
      { t0: 0, t1: 99, k0: 9, k1: 12, c: shade(sign, 0.72) },
    ],
    ROOFTOP,
  );
  // El toldo a rayas, rojo y blanco, por las dos caras: es el toldo más ancho de la calle.
  // El toldo, un píxel adentro a cada lado: con los extremos del lote, el festón se salía del lote en la
  // esquina y quedaba un pico blanco flotando sobre el pasto.
  toldo(p, u0 + 0.03, u1 - 0.03, v1, 9, hex('#c8392f'), hex('#f2ede0'));
  p.cornice(u0, v0, u1, v1, h, 2, CONCRETE);
  p.parapet(u0, v0, u1, v1, h + 2, 1, wall);
  // La campana de chapa con su ducto, **una sola masa** sobre el techo. Con la chimenea de bandas al lado
  // se leían dos tarros de pintura: a diez píxeles de alto, las bandas de tres filas no son un ladrillo,
  // son un envase.
  const acero: Ramp = [hex('#cfd2cc'), hex('#b9bcb6'), hex('#9ba09a')];
  p.box(0.22, 0.22, 0.58, 0.46, h + 2, 5, acero, 'plain', [
    { t0: 1, t1: 9, k0: 1, k1: 2, c: hex('#7f847e') },
  ]);
  p.box(0.62, 0.28, 0.72, 0.38, h + 2, 11, acero, 'plain', [], [], hex('#dfe2dc'));
}

/**
 * Level 5: **four** department stores, not one with four colours. Level by level the street was already
 * doing its job — a kiosk, a greengrocer, a hairdresser, a bar — and the last one was the whole avenue
 * built out of the same box with a different awning. The four are told apart by how they meet the
 * pavement: the display window, the arcade, the two-storey glazing and the low shed with the sign on a
 * mast. What changes with the variant is the wall and the colour of the sign, as before.
 */
/**
 * El blanco roto y el verde del toldo de la heladería. Son colores propios, que no usa ningún otro
 * material del sprite, y el verde **no sale de la marca**: con las rayas del color del cartel, toldo y
 * cartel se leían como una sola masa y la marca desaparecía.
 */
const SOMBRILLA = hex('#f0ead8');

/**
 * Los pares del toldo de la heladería: **rosa con verde, amarillo con violeta**, celeste con naranja y
 * verde con rosa. Una heladería de barrio no se pinta en gris: el par de colores es lo que la nombra
 * desde la esquina, y a 1× dos tonos que no comparten nada se leen a veinte píxeles de distancia.
 */
const TOLDOS: [RGB, RGB][] = [
  [hex('#e86a9c'), hex('#2f7a4a')],
  [hex('#f2c422'), hex('#7a3fa0')],
  [hex('#5fb6d4'), hex('#e0742c')],
  [hex('#3f9a5a'), hex('#e0567f')],
];

/** Las paredes de la heladería, pastel y saturadas: la caja tiene que aguantar el toldo, no competir. */
const HELADERIA_WALLS = ['#f7bcd4', '#fbe486', '#a9dcef', '#c9e69a'].map(ramp);

/**
 * El toldo a rayas de la heladería, **de dos píxeles por raya**: el `canopy` del bar tiene franjas de seis
 * y a esta altura se lee como una banda de color con manchas, no como un toldo. Acá las rayas son finas y
 * el plano es casi horizontal —un píxel de caída y el festón otro—: con cinco de caída el toldo medía
 * nueve píxeles de alto y las rayas se leían como columnas de mármol.
 *
 * Se pinta por las dos caras, la del frente y la del costado, para que dé la vuelta a la esquina.
 */
function toldo(
  p: Pen,
  a0: number,
  a1: number,
  v: number,
  z: number,
  c1: RGB,
  c2: RGB,
  eje: 'u' | 'v' = 'u',
): void {
  const d = 0.2;
  const raya = (x: number) => (Math.floor(x / 2) & 1 ? c1 : c2);
  const at = (a: number, w: number, dz: number): Pt =>
    eje === 'u' ? p.P(a, v + w, z + dz) : p.P(v + w, a, z + dz);
  p.poly([at(a0, 0, 0), at(a1, 0, 0), at(a1, d, -1), at(a0, d, -1)], raya);
  p.poly([at(a0, d, -1), at(a1, d, -1), at(a1, d, -2), at(a0, d, -2)], (x, _y) =>
    Math.floor(x / 2) & 1 ? shade(c1, 0.8) : shade(c2, 0.8),
  );
}

/**
 * Los glifos de cinco filas del cartel de la cafetería. A 1× una letra no puede tener más de tres píxeles
 * de ancho, así que se escriben a mano y en mayúsculas: la minúscula se cierra y no se lee.
 */
const GLIFOS: Record<string, string[]> = {
  C: ['###', '#..', '#..', '#..', '###'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  F: ['###', '#..', '##.', '#..', '#..'],
  E: ['###', '#..', '##.', '#..', '###'],
  ' ': ['...', '...', '...', '...', '...'],
};

/**
 * El texto del cartel, en patches de la cara donde se pinta: cada letra son cinco filas de tres píxeles y
 * una columna de aire. Se devuelve en coordenadas de la cara —`t` a lo largo del frente, `k` de altura—
 * para que el escorzo de la isométrica lo haga el mismo motor que dibuja la pared, y el cartel quede
 * **paralelo al frente del local** en vez de flotando torcido.
 */
function textoDeCartel(texto: string, t0: number, k0: number, c: RGB): Patch[] {
  const out: Patch[] = [];
  let t = t0;
  for (const letra of texto) {
    const glifo = GLIFOS[letra] ?? GLIFOS[' '];
    for (let fila = 0; fila < glifo.length; fila++) {
      for (let col = 0; col < 3; col++) {
        if (glifo[fila][col] === '#') out.push({ t0: t + col, t1: t + col + 1, k0: k0 + (4 - fila), k1: k0 + (5 - fila), c });
      }
    }
    t += 4;
  }
  return out;
}

/** Ancho en píxeles de un texto de cartel, con las columnas de aire. */
const anchoDeCartel = (texto: string) => texto.length * 4 - 1;

/**
 * Una mesa de la vereda: el tablero con la pata y dos sillas. **Sin sombrilla**: a este tamaño una
 * sombrilla mide más que la planta baja y su palo de un píxel no se lee. El tablero y las dos sillas sí, y
 * dos mesas alineadas convierten una vereda vacía en la puerta de un café.
 */
function mesaDeVereda(p: Pen, u: number, v: number): void {
  const [cx, cy] = p.P(u, v, 0);
  const x = Math.round(cx);
  const y = Math.round(cy);
  // El mantel oscuro con el filo claro y **las sillas de madera clara**: sobre el hormigón de la vereda,
  // con todo oscuro la mesa y las sillas se leían como una mancha de escombros.
  const mantel = hex('#2f2a26');
  const silla = hex('#c9a06a');
  p.px.rect(x - 2, y - 3, 5, 2, mantel);
  p.px.rect(x - 2, y - 3, 5, 1, shade(mantel, 1.9));
  p.px.rect(x, y - 1, 1, 2, shade(LEG, 1.2));
  p.px.rect(x - 4, y - 3, 2, 2, silla);
  p.px.rect(x - 4, y - 1, 2, 1, shade(silla, 0.7));
  p.px.rect(x + 3, y - 3, 2, 2, shade(silla, 0.88));
  p.px.rect(x + 3, y - 1, 2, 1, shade(silla, 0.6));
}

function clothingStore(p: Pen, v: number): void {
  const model = v & 3;
  const wall = WALLS[(v + 5) % WALLS.length];
  const sign = SIGNS[(v + 3) % SIGNS.length];
  if (model === 1) storeArcade(p, wall, sign);
  else if (model === 2) storeAtrium(p, wall, sign);
  else if (model === 3) storeShed(p, wall, sign, v);
  else storeWindow(p, wall, sign, v);
}

/**
 * Model 0, **la heladería grande**: la caja baja y ancha de la esquina, toda vidriera, con **el toldo a
 * rayas** de punta a punta y el cartel de la marca arriba. El techo a dos aguas se fue: era lo que la
 * hacía pasar por una casa y no por un local. Lo que dice heladería es el toldo, y el toldo sólo se lee si
 * es lo más grande del dibujo — cinco píxeles de alto y todo el ancho de la fachada, no una franja
 * escondida abajo del cartel.
 */
function storeWindow(p: Pen, _wall: Ramp, _sign: RGB, v: number): void {
  // La variante elige **dos veces**: el par de colores por el modelo y la pared por el bloque de ocho. Con
  // `v % 4` en las dos, la variante 0 y la 4 —las dos heladerías— salían idénticas.
  const wall = HELADERIA_WALLS[(v >> 2) % HELADERIA_WALLS.length];
  const [toldoA, toldoB] = TOLDOS[(v + (v >> 2)) % TOLDOS.length];
  // El cartel toma el color del toldo que no es el dominante, así la fachada tiene tres tonos y no dos.
  const sign = toldoB;
  const u0 = 0.06;
  const v0 = 0.08;
  const u1 = 0.94;
  const v1 = 0.92;
  const w = faceW(u0, u1);
  const h = 20;
  /**
   * La vidriera: los paños de vidrio con el marco de hierro, el **mostrador** y la pizarra de los gustos
   * colgada del paño de la derecha. No lleva maniquíes —una heladería no exhibe ropa— y el mostrador bajo
   * es lo que se ve detrás del vidrio a esta escala.
   */
  const vidriera = (face: 1 | 2): Patch[] => {
    // **Una pared de vidrio con montantes**, no paños con marco claro: con el marco aclarado la fachada
    // se leía como una columnata de mármol y el local desaparecía detrás de sus propias columnas.
    // **El vidrio es la masa de fondo y va al final**: el primer parche que toca un píxel gana, así que
    // pintado antes se come el mostrador y los montantes y la fachada queda un vidrio liso.
    const out: Patch[] = [{ t0: 0, t1: 99, k0: 0, k1: 1, c: shade(wall[face], 0.55) }];
    // El mostrador, una franja clara a la altura de la cintura, de punta a punta.
    out.push({ t0: 1, t1: w - 1, k0: 3, k1: 5, c: shade(SOMBRILLA, 0.9) });
    for (let t = 1; t < w - 1; t += 4) out.push({ t0: t, t1: t + 1, k0: 1, k1: 12, c: shade(LEG, 1.5) });
    // La pizarra de los gustos, colgada del paño de la derecha.
    out.push({ t0: w - 5, t1: w - 2, k0: 6, k1: 10, c: shade(LEG, 0.9) });
    out.push({ t0: w - 5, t1: w - 2, k0: 8, k1: 10, c: shade(SOMBRILLA, 0.82) });
    out.push({ t0: 1, t1: w - 1, k0: 1, k1: 12, c: shade(GLASS, 0.94) });
    return out;
  };
  const cartel: Patch[] = [
    { t0: 0, t1: 99, k0: 16, k1: 19, c: sign },
    { t0: 1, t1: w - 1, k0: 17, k1: 18, c: shade(SOMBRILLA, 0.94) },
  ];
  p.shadow(u0, v0, u1, v1);
  p.box(u0, v0, u1, v1, 0, h, wall, 'plain', [...vidriera(1), ...cartel], [
    ...vidriera(2),
    { t0: 0, t1: 99, k0: 16, k1: 19, c: shade(sign, 0.74) },
  ], ROOFTOP);
  // El toldo a rayas, de punta a punta de la fachada y por la esquina también: es el techo del local y el
  // único dibujo del sprite que no es una pared.
  toldo(p, u0, u1, v1, 15, toldoA, toldoB);
  toldo(p, v0, v1, u1, 15, toldoA, toldoB, 'v');
  p.cornice(u0, v0, u1, v1, h, 1, CONCRETE);
  p.parapet(u0, v0, u1, v1, h + 1, 1, wall);
}

/**
 * Model 1, the arcade: the ground floor steps back and leaves a **colonnade over the pavement**, with
 * the shops in the shade behind it, and three floors of offices above. The hollow bottom is the whole
 * silhouette: no other model has a hole in it.
 */
function storeArcade(p: Pen, wall: Ramp, sign: RGB): void {
  const u0 = 0.06;
  const v0 = 0.08;
  const u1 = 0.94;
  const v1 = 0.9;
  const w = faceW(u0, u1);
  const h = 30;
  /**
   * La arcada: los pilares y, entre ellos, la vidriera del local con la sombra del pórtico arriba. Las
   * tres bandas —pilar, vidriera, sombra— no se pisan entre sí, que es la única forma de que el orden de
   * los parches no importe: el primer parche que toca un píxel gana y una sombra grande pintada antes se
   * come las vidrieras.
   */
  const arcade = (): Patch[] => {
    const out: Patch[] = [];
    for (let t = 0; t < w; t += 4) out.push({ t0: t, t1: t + 1, k0: 0, k1: 13, c: shade(wall[1], 1.08) });
    out.push({ t0: 0, t1: 99, k0: 12, k1: 13, c: shade(wall[0], 1.18) });
    out.push({ t0: 0, t1: 99, k0: 0, k1: 1, c: shade(wall[1], 0.5) });
    for (let t = 1; t < w; t += 4) {
      out.push({ t0: t, t1: t + 3, k0: 2, k1: 9, c: shade(GLASS, 0.92) });
      out.push({ t0: t, t1: t + 3, k0: 9, k1: 12, c: shade(LEG, 1.3) });
    }
    return out;
  };
  const sideArcade = (): Patch[] => {
    const out: Patch[] = [];
    for (let t = 0; t < w; t += 4) out.push({ t0: t, t1: t + 1, k0: 0, k1: 13, c: shade(wall[2], 1.06) });
    out.push({ t0: 0, t1: 99, k0: 12, k1: 13, c: shade(wall[0], 1.1) });
    out.push({ t0: 0, t1: 99, k0: 0, k1: 1, c: shade(wall[2], 0.5) });
    for (let t = 1; t < w; t += 4) {
      out.push({ t0: t, t1: t + 3, k0: 2, k1: 7, c: shade(GLASS, 0.84) });
      out.push({ t0: t, t1: t + 3, k0: 7, k1: 12, c: shade(LEG, 1.15) });
    }
    return out;
  };
  const upper: Patch[] = [
    { t0: 0, t1: 99, k0: 13, k1: 16, c: sign },
    { t0: 0, t1: 99, k0: 16, k1: 17, c: shade(sign, 1.3) },
    ...glazed(2, w - 2, 19, 5, 4),
    ...glazed(2, w - 2, 25, 5, 4),
    { t0: 0, t1: 99, k0: h - 1, k1: h, c: shade(wall[1], 1.16) },
  ];
  p.shadow(u0, v0, u1, v1);
  p.box(u0, v0, u1, v1, 0, h, wall, 'plain', [...arcade(), ...upper], [
    ...sideArcade(),
    { t0: 0, t1: 99, k0: 13, k1: 16, c: shade(sign, 0.74) },
    ...glazed(2, w - 2, 19, 5, 4),
    ...glazed(2, w - 2, 25, 5, 4),
  ]);
  p.cornice(u0, v0, u1, v1, h, 2, CONCRETE);
  p.parapet(u0, v0, u1, v1, h + 2, 1, wall);
  p.tank(0.64, 0.26, h + 2);
}

/**
 * Model 2, **la cafetería premium**: el café notable de la esquina, de dos pisos, con la **marquesina** de
 * chapa sobre la vidriera y los **balcones corridos** de hierro en los pisos altos. Es el más alto de los
 * cuatro después de la galería, y el único con dos cosas que ningún otro tiene: un plano volado sobre la
 * vereda y las barandas. Una torre de fajas de vidrio era un edificio de oficinas; un café tiene toldo,
 * vidriera baja y balcones, porque arriba también hay mesas.
 */
function storeAtrium(p: Pen, wall: Ramp, sign: RGB): void {
  const u0 = 0.1;
  const v0 = 0.06;
  const u1 = 0.9;
  // **Corto de fondo**: el local se corre hacia atrás y deja una vereda de verdad adelante, que es donde
  // van las mesas. Pegado al borde del lote no quedaba lugar ni para una silla.
  const v1 = 0.56;
  const w = faceW(u0, u1);
  // **Un solo piso**: el café es una planta baja con la vidriera de bar y el cartel, y nada más. Todo el
  // volumen que se le sacó al edificio se fue a la taza de la azotea, que ahora es más alta que el local.
  const h = 15;
  /**
   * La planta baja del café: los paños de vidrio oscuro —vidrio de bar, no de vidriera de ropa—, el
   * marco de hierro entre ellos y la puerta de madera. La carpintería oscura es la mitad del parecido con
   * un café notable; con marco claro volvía a ser un local cualquiera.
   */
  const plantaBaja = (face: 1 | 2): Patch[] => {
    const out: Patch[] = [
      { t0: 0, t1: 99, k0: 0, k1: 1, c: shade(wall[face], 0.55) },
      // El zócalo de granito y el reflejo: los detalles antes que la masa de vidrio, que va al final.
      { t0: 0, t1: 99, k0: 1, k1: 2, c: shade(LEG, 1.1) },
      { t0: 3, t1: 4, k0: 3, k1: 8, c: shade(GLASS, 1.24) },
      { t0: 7, t1: 8, k0: 3, k1: 8, c: shade(GLASS, 1.24) },
    ];
    for (let t = 1; t < w - 1; t += 4) out.push({ t0: t, t1: t + 1, k0: 1, k1: 9, c: LEG });
    out.push({ t0: 1, t1: w - 1, k0: 1, k1: 9, c: shade(GLASS, 0.72) });
    // La puerta de madera, al medio: un café tiene puerta y no sólo vidrio.
    out.push({ t0: Math.floor(w / 2) - 1, t1: Math.floor(w / 2) + 2, k0: 0, k1: 7, c: shade(hex('#5a3a24'), 1.1) });
    out.push({ t0: Math.floor(w / 2) - 1, t1: Math.floor(w / 2) + 2, k0: 0, k1: 7, c: shade(hex('#5a3a24'), 1.1) });
    return out;
  };
  const front: Patch[] = [
    ...plantaBaja(1),
    { t0: 0, t1: 99, k0: 9, k1: 13, c: sign },
    { t0: 1, t1: 99, k0: 10, k1: 12, c: shade(SOMBRILLA, 0.94) },
    { t0: 0, t1: 99, k0: 13, k1: 14, c: shade(sign, 1.3) },
    { t0: 0, t1: 99, k0: h - 1, k1: h, c: shade(wall[1], 1.16) },
  ];
  const side: Patch[] = [
    ...plantaBaja(2),
    { t0: 0, t1: 99, k0: 9, k1: 13, c: shade(sign, 0.74) },
  ];
  p.shadow(u0, v0, u1, v1);
  p.box(u0, v0, u1, v1, 0, h, wall, 'plain', front, side, ROOFTOP);
  p.cornice(u0, v0, u1, v1, h, 2, CONCRETE);
  p.parapet(u0, v0, u1, v1, h + 2, 1, wall);
  // **El cartel sobre la azotea, con la palabra escrita**: es el remate y el nombre. Va parado sobre el
  // techo, **paralelo al frente** —su cara mira a la calle, como la fachada— y más ancho que el local, que
  // es lo único que permite que las letras tengan tres píxeles y se lean.
  const texto = 'CAFE';
  // **Del ancho justo del texto**: cinco píxeles de alto y quince de ancho. Con siete de alto y todo el
  // frente, el cartel se comía el techo y la fachada.
  const medio = (u0 + u1) / 2;
  // Un píxel de aire a cada lado: con el ancho justo, la última letra se la comía el canto del cartel.
  const mediaCaña = (anchoDeCartel(texto) + 2) / 16 / 2;
  // **La palabra va en una sola cara**, la del frente. Repetida en el costado se leía "CAFEC": el lateral
  // devuelve la última letra y el cartel parece decir una palabra que no es. El costado es chapa lisa.
  p.box(medio - mediaCaña, v0 + 0.2, medio + mediaCaña, v0 + 0.34, h + 1, 5, [shade(sign, 1.1), sign, shade(sign, 0.8)], 'plain', [
    ...textoDeCartel(texto, 1, 0, SOMBRILLA),
  ], [], shade(sign, 1.3));
  // La vereda de hormigón delante del local, con la junta de las baldosas: sin ella las mesas quedaban
  // plantadas sobre el pasto y parecían escombros.
  p.poly([p.P(u0, v1), p.P(u1, v1), p.P(u1, 1), p.P(u0, 1)], (x, y) =>
    (x + y) % 8 === 0 ? shade(CONCRETE[2], 0.86) : shade(CONCRETE[1], 1.06),
  );
  // Las mesas, tres, sobre la vereda y del lado de la puerta.
  mesaDeVereda(p, 0.18, v1 + 0.24);
  mesaDeVereda(p, 0.52, v1 + 0.24);
  mesaDeVereda(p, 0.86, v1 + 0.24);
}

/**
 * Model 3, the shed: **one tall floor over a lower depot at the back, with the sign on a mast over the
 * roof**. It is the low, wide one — the only one of the four that does not grow — and the mast is what
 * names it from two blocks away.
 */
function storeShed(p: Pen, wall: Ramp, sign: RGB, v: number): void {
  const u0 = 0.03;
  const v0 = 0.06;
  const U1 = 0.97;
  const u1 = 0.78;
  const v1 = 0.94;
  const w = faceW(u0, u1);
  const h = 14;
  const FRENTE = 0.44;
  const DEP0 = 0.5;
  p.shadow(u0, v0, U1, v1);
  // El playón de estacionamiento, **al costado y sobre la calle**: es lo que una casa de ropa de avenida
  // tiene y ninguna de las otras tres. Atrás no servía: la nave lo tapaba entero.
  p.poly([p.P(u1 + 0.02, FRENTE), p.P(U1, FRENTE), p.P(U1, v1), p.P(u1 + 0.02, v1)], (x, y) =>
    (x + y) % 9 === 0 ? shade(CONCRETE[1], 1.12) : shade(CONCRETE[2], 0.9),
  );
  /** Un auto estacionado: la caja, el techo y el parabrisas. A este tamaño es una mancha con ruedas. */
  const parked = (u: number, vv: number, body: RGB) => {
    p.box(u, vv, u + 0.16, vv + 0.1, 0, 3, [body, body, shade(body, 0.8)], 'plain');
    p.box(u + 0.03, vv + 0.02, u + 0.13, vv + 0.08, 3, 2, [shade(body, 0.6), shade(body, 0.6), shade(body, 0.5)], 'plain');
  };
  parked(0.81, 0.56, hex('#b8443c'));
  parked(0.81, 0.74, hex('#3f5e7a'));
  // El depósito, atrás a la derecha y **tres píxeles más alto** que la nave: asoma por encima del techo y
  // la silueta escalona hacia el fondo. Se pinta antes, que el frente lo tapa por abajo.
  p.box(DEP0, v0, U1, FRENTE, 0, 17, [wall[2], wall[2], shade(wall[2], 0.9)], 'plain', [], [pane(3, 12, 2, 3, shade(GLASS, 0.8))]);
  p.cornice(DEP0, v0, U1, FRENTE, 17, 1, CONCRETE);
  // La nave del frente: una planta alta, la vidriera corrida y la banda de la marca.
  p.box(u0, FRENTE, u1, v1, 0, h, wall, 'plain', [
    ...mannequins(2, w - 2, v),
    { t0: 0, t1: 99, k0: 0, k1: 1, c: shade(wall[1], 0.6) },
    ...ribbon(1, w - 1, 1, 6),
    door(7, 4, 6),
    { t0: 0, t1: 99, k0: 7, k1: 11, c: sign },
    { t0: 0, t1: 99, k0: 11, k1: 12, c: shade(sign, 1.34) },
    { t0: 0, t1: 99, k0: h - 1, k1: h, c: shade(wall[1], 1.2) },
  ], [
    { t0: 0, t1: 99, k0: 0, k1: 1, c: shade(wall[2], 0.6) },
    ...ribbon(2, w - 3, 1, 6),
    { t0: 0, t1: 99, k0: 7, k1: 11, c: shade(sign, 0.74) },
  ], ROOFTOP);
  p.cornice(u0, FRENTE, u1, v1, h, 1, CONCRETE);
  p.parapet(u0, FRENTE, u1, v1, h + 1, 1, wall);
  /**
   * El cartel parante, sobre el techo del frente: el mástil y el paño de la marca. Es lo que se ve desde
   * la otra cuadra y lo que hace que la nave baja no sea un galpón. El mástil va **antes** que el paño, o
   * el paño lo tapa y el cartel queda flotando; y va en acero claro, que de hierro oscuro no se ve.
   */
  {
    const [sx, sy] = p.P(0.26, 0.62, h + 1);
    const cx = Math.round(sx);
    const cy = Math.round(sy);
    p.px.rect(cx, cy - 7, 1, 7, shade(STEEL[0], 1.05));
    p.px.rect(cx - 3, cy - 14, 7, 7, sign);
    p.px.rect(cx - 3, cy - 14, 1, 7, shade(sign, 1.55));
    p.px.rect(cx - 3, cy - 14, 7, 1, shade(sign, 1.4));
    p.px.rect(cx - 2, cy - 12, 5, 1, hex('#f4ece0'));
    p.px.rect(cx - 2, cy - 10, 5, 1, hex('#f4ece0'));
    p.px.rect(cx + 3, cy - 14, 1, 7, shade(sign, 0.7));
  }
  p.tank(0.84, 0.2, 18);
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

/** The same canvas as `penLot`, for a lot that is not square: the uniques and anything longer than a cell. */
function penRect(vw: number, vh: number, maxZ: number): Pen {
  return new Pen(new Pixels(16 * (vw + vh) + 8, maxZ + 8 * (vw + vh) + 8), 16 * vh + 4, maxZ + 2);
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

/* ---------- The services ---------- */

const SERVICE_MAX_Z: Record<ServiceKind, number> = { school: 30, clinic: 24, police: 30, fire: 36, hospital: 54, university: 52 };

const RED_CROSS = hex('#c8392f');
const GREEN_CROSS = hex('#2f9a55');
const CHALK_WHITE = hex('#f4f0e6');
const CHALK: Ramp = ramp('#f4f0e6');
const SLATE: Ramp = ramp('#6b6f78');
const LIGHT_BAR: [RGB, RGB] = [hex('#2f63e0'), hex('#e03a2f')];
const FASCIA = hex('#b8322a');

/** The yard of an institution: a concrete apron between the building and the street, with its kerb. */
function yard(p: Pen, u0: number, v0: number, u1: number, v1: number): void {
  p.box(u0, v0, u1, v1, 0, 1.2, PAD, 'plain');
  p.px.line(p.P(u0, v1, 1.2), p.P(u1, v1, 1.2), shade(PAD[1], 1.2));
}

/** A cross standing on a roof, one pixel of arm for every two of its height. */
function roofCross(p: Pen, u: number, v: number, z: number, c: RGB, size = 4): void {
  const [x, y] = p.P(u, v, z);
  const cx = Math.round(x);
  const cy = Math.round(y);
  p.px.rect(cx, cy - size * 2, 1, size * 2, c);
  p.px.rect(cx - Math.floor(size / 2), cy - size * 2 + size, size + 1, 1, c);
}

/**
 * The school: two floors of cream wall under a brick gable roof, the yard behind an iron fence and
 * the flag on its mast. The flag is what says "escuela" from across the map.
 */
function paintSchool(p: Pen): void {
  const u0 = 0.06;
  const v0 = 0.1;
  const u1 = 0.82;
  const v1 = 0.68;
  const wall = WALLS[0];
  const h = 13;
  p.shadow(u0, v0, u1, v1);
  yard(p, 0.04, 0.7, 0.96, 0.94);
  p.box(u0, v0, u1, v1, 0, h, wall, 'plain', [
    ...glazed(1, 12, 8, 3, 4, GLASS),
    ...glazed(1, 4, 2, 3, 3, GLASS),
    ...glazed(9, 12, 2, 3, 3, GLASS),
    { t0: 5, t1: 9, k0: 0, k1: 7, c: DOOR },
    { t0: 4, t1: 10, k0: 7, k1: 9, c: CHALK_WHITE },
  ], [
    ...glazed(2, 9, 8, 3, 4, GLASS),
    { t0: 0, t1: 99, k0: 0, k1: 2, c: shade(wall[2], 0.62) },
  ], ROOFTOP);
  p.gable(u0 - 0.03, v0 - 0.03, u1 + 0.03, v1 + 0.03, h, 5, ROOFS[0], wall[1], 'plain');
  // The little bell tower over the ridge, and the canopy over the door.
  p.box(0.36, 0.3, 0.52, 0.46, h + 4, 4, CHALK, 'plain', [{ t0: 1, t1: 3, k0: 1, k1: 3, c: GARAGE }]);
  p.hip(0.34, 0.28, 0.54, 0.48, h + 8, 3, ROOFS[1]);
  p.canopy(0.3, 0.7, 0.5, 7.5, ROOFS[1][1], CHALK_WHITE, 2);
  // The mast with the flag, in the corner of the yard, and a tree by the fence.
  const [fx, fy] = p.P(0.9, 0.86, 1.2);
  p.px.rect(Math.round(fx), Math.round(fy) - 22, 1, 22, LEG);
  p.flag(0.9, 0.86, 23, 9);
  p.tree(0.16, 0.88);
  p.fence(p.P(0.06, 0.95), p.P(0.94, 0.95));
}

/** The salita: one floor, the green band of the health centre and the green cross on the roof. */
function paintClinic(p: Pen): void {
  const u0 = 0.12;
  const v0 = 0.14;
  const u1 = 0.88;
  const v1 = 0.72;
  const wall = WALLS[2];
  const h = 10;
  p.shadow(u0, v0, u1, v1);
  yard(p, 0.06, 0.74, 0.94, 0.94);
  p.box(u0, v0, u1, v1, 0, h, wall, 'plain', [
    { t0: 0, t1: 99, k0: 5, k1: 7, c: GREEN_CROSS },
    ...glazed(1, 5, 1, 3, 3, GLASS),
    ...glazed(8, 12, 1, 3, 3, GLASS),
    { t0: 5, t1: 8, k0: 0, k1: 5, c: DOOR },
  ], [
    { t0: 0, t1: 99, k0: 5, k1: 7, c: shade(GREEN_CROSS, 0.72) },
    ...glazed(1, 10, 1, 3, 4, GLASS),
  ], ROOFTOP);
  p.cornice(u0, v0, u1, v1, h, 1.5, wall);
  p.parapet(u0, v0, u1, v1, h + 1.5, 1, wall);
  roofCross(p, 0.5, 0.42, h + 2.5, GREEN_CROSS, 4);
  p.box(0.62, 0.2, 0.8, 0.36, h + 1.5, 3, CHALK, 'plain', [{ t0: 0, t1: 99, k0: 1, k1: 2, c: GREEN_CROSS }]);
  // The awning over the door and the bench where the neighbours wait.
  p.canopy(0.3, 0.72, 0.6, 6, GREEN_CROSS, CHALK_WHITE, 2);
  bench(p, 0.72, 0.84);
}

/** The police station: a blue-grey block, the white band, the light bar and the patrol car in the yard. */
function paintPolice(p: Pen): void {
  const u0 = 0.1;
  const v0 = 0.12;
  const u1 = 0.86;
  const v1 = 0.7;
  const wall: Ramp = [hex('#4a6386'), hex('#3f5f8a'), hex('#355073')];
  const h = 15;
  p.shadow(u0, v0, u1, v1);
  yard(p, 0.06, 0.72, 0.94, 0.94);
  p.box(u0, v0, u1, v1, 0, h, wall, 'plain', [
    { t0: 0, t1: 99, k0: 8, k1: 11, c: CHALK_WHITE },
    ...glazed(1, 4, 12, 3, 3, GLASS_LIT),
    ...glazed(8, 12, 12, 3, 3, GLASS_LIT),
    ...glazed(1, 4, 2, 3, 3, GLASS),
    ...glazed(8, 12, 2, 3, 3, GLASS),
    { t0: 5, t1: 8, k0: 0, k1: 7, c: GLASS },
    { t0: 5, t1: 8, k0: 7, k1: 9, c: CHALK_WHITE },
  ], [
    { t0: 0, t1: 99, k0: 8, k1: 11, c: CHALK_WHITE },
    ...glazed(2, 9, 12, 3, 4, GLASS_LIT),
    ...glazed(2, 9, 2, 3, 4, GLASS),
  ], ROOFTOP);
  p.cornice(u0, v0, u1, v1, h, 1.5, CONCRETE);
  // The plant of the roof with the light bar on top, and the radio mast next to it.
  p.box(0.34, 0.3, 0.56, 0.5, h + 1.5, 3, CONCRETE, 'plain');
  const [bx, by] = p.P(0.45, 0.4, h + 4.5);
  p.px.rect(Math.round(bx) - 3, Math.round(by), 3, 1, LIGHT_BAR[0]);
  p.px.rect(Math.round(bx), Math.round(by), 3, 1, LIGHT_BAR[1]);
  p.antenna(0.7, 0.3, h + 1.5, 8);
  // The patrol car waiting with its light bar on.
  const [cx, cy] = p.P(0.34, 0.84, 1.2);
  const px = Math.round(cx);
  const py = Math.round(cy);
  p.px.rect(px - 3, py - 3, 7, 3, hex('#1f2a3a'));
  p.px.rect(px - 2, py - 5, 5, 2, hex('#2f4a72'));
  p.px.rect(px - 1, py - 6, 1, 1, LIGHT_BAR[0]);
  p.px.rect(px + 1, py - 6, 1, 1, LIGHT_BAR[1]);
  p.px.rect(px - 3, py - 1, 1, 1, TYRE);
  p.px.rect(px + 3, py - 1, 1, 1, TYRE);
}

/** The firehouse: two white garage doors in a brick wall and the hose tower with its siren. */
function paintFirehouse(p: Pen): void {
  const u0 = 0.06;
  const v0 = 0.1;
  const u1 = 0.9;
  const v1 = 0.68;
  const h = 14;
  p.shadow(u0, v0, u1, v1);
  yard(p, 0.04, 0.7, 0.96, 0.94);
  p.box(u0, v0, u1, v1, 0, h, BRICK, 'brick', [
    { t0: 0, t1: 99, k0: 11, k1: 13, c: CHALK_WHITE },
    { t0: 1, t1: 6, k0: 0, k1: 10, c: CHALK_WHITE },
    { t0: 7, t1: 12, k0: 0, k1: 10, c: CHALK_WHITE },
    { t0: 1, t1: 6, k0: 10, k1: 10, c: shade(CHALK_WHITE, 0.8) },
    { t0: 7, t1: 12, k0: 10, k1: 10, c: shade(CHALK_WHITE, 0.8) },
    { t0: 1, t1: 6, k0: 5, k1: 6, c: shade(LEG, 1.5) },
    { t0: 7, t1: 12, k0: 5, k1: 6, c: shade(LEG, 1.5) },
  ], [
    { t0: 0, t1: 99, k0: 11, k1: 13, c: shade(CHALK_WHITE, 0.86) },
    ...glazed(3, 9, 4, 4, 4, GLASS),
  ], ROOFTOP);
  p.cornice(u0, v0, u1, v1, h, 1.5, BRICK);
  // The hose tower on the corner, with its pointed roof and the siren under it.
  p.box(0.68, 0.14, 0.86, 0.3, h + 1.5, 16, BRICK, 'brick', [
    { t0: 0, t1: 99, k0: 10, k1: 11, c: CHALK_WHITE },
    { t0: 1, t1: 3, k0: 12, k1: 15, c: GLASS },
  ], [
    { t0: 0, t1: 99, k0: 10, k1: 11, c: shade(CHALK_WHITE, 0.86) },
    { t0: 1, t1: 3, k0: 12, k1: 15, c: shade(GLASS, 0.85) },
  ]);
  p.hip(0.66, 0.12, 0.88, 0.32, h + 17.5, 4, SLATE);
  const [sx, sy] = p.P(0.77, 0.22, h + 17.5);
  p.px.rect(Math.round(sx) - 1, Math.round(sy) + 2, 3, 1, hex('#e8b93c'));
  // The hydrant by the door of the garage.
  const [hx, hy] = p.P(0.94, 0.8, 1.2);
  p.px.rect(Math.round(hx) - 1, Math.round(hy) - 4, 2, 4, hex('#c8392f'));
  p.px.rect(Math.round(hx) - 2, Math.round(hy) - 3, 4, 1, hex('#c8392f'));
}

/** The hospital: four floors of white wall and blue glass, the red cross and the helipad on the roof. */
/**
 * The hospital: a complex on its 3x3 block and not a hospital the size of a kiosco. The tower of wards
 * stands at the back with the helipad on its roof, the ward wing runs behind it to the right, and the
 * emergency hall comes forward with its canopy and the ambulance under it. The cross is on the tower,
 * high enough to be read from the street.
 */
function paintHospital(p: Pen): void {
  const wall = WALLS[0];
  p.shadow(0.18, 0.2, 2.86, 2.3);
  // The apron along the front of the block, with its kerb and the ambulance bay.
  yard(p, 0.12, 2.14, 2.9, 2.9);

  // The ward wing, behind and to the right: four floors, a step lower than the tower.
  p.box(1.76, 0.22, 2.78, 1.14, 0, 20, WALLS[2], 'plain', [
    ...ribbonIn(0, 99, 3, 3, GLASS_LIT),
    ...ribbonIn(0, 99, 9, 3, GLASS_LIT),
    ...ribbonIn(0, 99, 15, 3, GLASS_LIT),
    { t0: 0, t1: 99, k0: 0, k1: 2, c: shade(WALLS[2][1], 0.72) },
  ], [...ribbonIn(0, 99, 3, 3, GLASS_LIT), ...ribbonIn(0, 99, 9, 3, GLASS_LIT), ...ribbonIn(0, 99, 15, 3, GLASS_LIT)], ROOFTOP);
  p.cornice(1.76, 0.22, 2.78, 1.14, 20, 1.5, CONCRETE, ROOF_DECK);
  p.box(2.5, 0.5, 2.72, 0.72, 21.5, 3, CONCRETE, 'plain');

  // The link between the wing and the tower, so the volumes are one building.
  p.box(1.5, 0.3, 1.82, 1.05, 0, 15, CHALK, 'plain', [...ribbonIn(0, 99, 10, 3, GLASS_LIT)], [], ROOFTOP);

  // The tower of wards: seven floors of white wall and blue glass, with its cornice on top.
  const h = 44;
  p.box(0.22, 0.22, 1.56, 1.6, 0, h, wall, 'plain', [
    // The cross goes first: in a face the first patch that matches wins, so a cross written after the
    // window bands is cut by them, and the front of the tower is only 21 px wide.
    { t0: 9, t1: 14, k0: 23, k1: 39, c: RED_CROSS },
    { t0: 4, t1: 19, k0: 29, k1: 34, c: RED_CROSS },
    ...ribbonIn(0, 99, 5, 3, GLASS_LIT),
    ...ribbonIn(0, 99, 12, 3, GLASS_LIT),
    ...ribbonIn(0, 99, 19, 3, GLASS_LIT),
    ...ribbonIn(0, 99, 26, 3, GLASS_LIT),
    ...ribbonIn(0, 99, 33, 3, GLASS_LIT),
    { t0: 0, t1: 99, k0: 0, k1: 3, c: shade(wall[1], 0.72) },
  ], [
    ...ribbonIn(0, 99, 5, 3, GLASS_LIT),
    ...ribbonIn(0, 99, 12, 3, GLASS_LIT),
    ...ribbonIn(0, 99, 19, 3, GLASS_LIT),
    ...ribbonIn(0, 99, 26, 3, GLASS_LIT),
    ...ribbonIn(0, 99, 33, 3, GLASS_LIT),
    { t0: 0, t1: 99, k0: 0, k1: 3, c: shade(wall[2], 0.66) },
  ], ROOFTOP);
  p.cornice(0.22, 0.22, 1.56, 1.6, h, 2, CONCRETE, ROOF_DECK);

  // The helipad on the roof of the tower: the dark square with the H painted on it.
  p.box(0.45, 0.45, 1.33, 1.33, h + 2, 1, [GARAGE, shade(GARAGE, 0.86), shade(GARAGE, 0.74)], 'plain', [], [], GARAGE);
  const [px, py] = p.P(0.89, 0.89, h + 3);
  const hx = Math.round(px);
  const hy = Math.round(py);
  p.px.rect(hx - 5, hy - 5, 2, 9, CHALK_WHITE);
  p.px.rect(hx + 4, hy - 5, 2, 9, CHALK_WHITE);
  p.px.rect(hx - 3, hy - 2, 7, 2, CHALK_WHITE);
  // The plant and the tank on the roof, next to the pad.
  p.box(0.3, 1.36, 0.58, 1.5, h + 2, 3, CONCRETE, 'plain');
  p.tank(1.28, 0.3, h + 2);

  // The emergency hall in front of the tower: one floor, the glass of the guard and the canopy.
  p.box(0.24, 1.66, 1.9, 2.1, 0, 13, CHALK, 'plain', [
    ...glazed(3, 28, 4, 5, 5, GLASS_LIT),
    { t0: 0, t1: 99, k0: 11, k1: 13, c: FASCIA },
    { t0: 0, t1: 99, k0: 0, k1: 2, c: shade(CHALK_WHITE, 0.78) },
  ], [...glazed(3, 14, 4, 5, 5, GLASS_LIT), { t0: 0, t1: 99, k0: 11, k1: 13, c: shade(FASCIA, 0.82) }], ROOFTOP);
  p.canopy(0.3, 2.1, 0.98, 10, FASCIA, FASCIA, 3);
  p.parapet(0.24, 1.66, 1.9, 2.1, 13, 1, CHALK);

  // The ambulance under the canopy, with its red cross.
  const [amx, amy] = p.P(1.68, 2.52, 1.2);
  const bx = Math.round(amx);
  const by = Math.round(amy);
  p.px.rect(bx - 5, by - 4, 12, 4, CHALK_WHITE);
  p.px.rect(bx - 5, by - 2, 12, 1, RED_CROSS);
  p.px.rect(bx - 8, by - 7, 6, 3, CHALK_WHITE);
  p.px.rect(bx - 7, by - 6, 4, 2, GLASS);
  p.px.rect(bx - 7, by - 8, 2, 1, LIGHT_BAR[0]);
  p.px.rect(bx - 5, by - 8, 2, 1, LIGHT_BAR[1]);
  p.px.set(bx - 4, by, TYRE);
  p.px.set(bx + 4, by, TYRE);

  // The tree of the garden, and the ambulance of the wing at the other end of the apron.
  p.tree(0.1, 2.6);
  p.tree(2.66, 2.24);
  const [qx, qy] = p.P(2.3, 2.66, 1.2);
  p.px.rect(Math.round(qx) - 3, Math.round(qy) - 3, 8, 3, CHALK_WHITE);
  p.px.rect(Math.round(qx) - 3, Math.round(qy) - 2, 8, 1, RED_CROSS);
  p.px.set(Math.round(qx) - 2, Math.round(qy), TYRE);
  p.px.set(Math.round(qx) + 3, Math.round(qy), TYRE);
}

/**
 * The university: the bar of the aulas along the back, the cloister with its garden in the middle, and
 * the building of the portico in front, with the clock tower on the corner of the bar.
 */
function paintUniversity(p: Pen): void {
  p.shadow(0.2, 0.2, 2.85, 2.3);
  // The apron of the entrance, where the fence and the gate stand.
  yard(p, 0.22, 2.04, 2.8, 2.86);
  // The courtyard: grass kept short and the paths that cross it.
  p.box(1.28, 1.16, 2.6, 2.12, 0, 1, [hex('#6f9a58'), hex('#5f8c4b'), hex('#527a41')], 'plain');
  const [cx0, cy0] = p.P(1.94, 1.64);
  p.px.rect(Math.round(cx0) - 11, Math.round(cy0) - 2, 22, 3, PAD[1]);

  // The bar of the aulas along the back: brick, three floors and the row of windows.
  const h = 20;
  p.box(0.24, 0.22, 2.6, 1.06, 0, h, BRICK, 'brick', [
    ...ribbonIn(0, 99, 4, 3, GLASS_LIT),
    ...ribbonIn(0, 99, 10, 3, GLASS_LIT),
    ...ribbonIn(0, 99, 16, 3, GLASS_LIT),
    ...glazed(2, 9, 1, 5, 3, GLASS),
    ...glazed(34, 41, 1, 5, 3, GLASS),
    { t0: 0, t1: 99, k0: 0, k1: 2, c: shade(BRICK[1], 0.7) },
  ], [...ribbonIn(0, 99, 4, 3, GLASS_LIT), ...ribbonIn(0, 99, 10, 3, GLASS_LIT), { t0: 0, t1: 99, k0: 0, k1: 2, c: shade(BRICK[2], 0.7) }], ROOFTOP);
  p.cornice(0.24, 0.22, 2.6, 1.06, h, 1.5, BRICK, ROOF_DECK);

  // The clock tower at the end of the bar.
  p.box(2.06, 0.26, 2.52, 0.72, h + 1.5, 14, WALLS[1], 'plain', [
    { t0: 2, t1: 6, k0: 8, k1: 12, c: CHALK_WHITE },
    { t0: 3, t1: 5, k0: 3, k1: 7, c: GLASS },
  ], [{ t0: 2, t1: 6, k0: 8, k1: 12, c: shade(CHALK_WHITE, 0.86) }, { t0: 3, t1: 5, k0: 3, k1: 7, c: shade(GLASS, 0.86) }]);
  p.hip(2.03, 0.23, 2.55, 0.75, h + 15.5, 5, SLATE);
  const [kx, ky] = p.P(2.29, 0.72, h + 12);
  p.px.rect(Math.round(kx) - 1, Math.round(ky) - 2, 3, 3, CHALK_WHITE);
  p.px.rect(Math.round(kx), Math.round(ky) - 1, 1, 1, GARAGE);
  p.px.set(Math.round(kx), Math.round(ky) - 2, GARAGE);

  // The building of the portico, in front: the columns, the entablature and the pediment.
  p.box(0.24, 1.44, 1.5, 1.96, 0, 18, BRICK, 'brick', [
    ...ribbonIn(0, 99, 12, 3, GLASS_LIT),
    { t0: 0, t1: 99, k0: 11, k1: 13, c: CHALK_WHITE },
    { t0: 6, t1: 14, k0: 0, k1: 11, c: GARAGE },
  ], [...ribbonIn(0, 99, 12, 3, GLASS_LIT)], ROOFTOP);
  p.cornice(0.24, 1.44, 1.5, 1.96, 18, 1.5, BRICK, ROOF_DECK);
  for (const u of [0.3, 0.62, 0.94, 1.26]) p.box(u, 1.96, u + 0.05, 2.02, 0, 11, CHALK, 'plain');
  p.box(0.26, 1.94, 1.38, 2.04, 11, 2, CHALK, 'plain');
  p.hip(0.24, 1.92, 1.4, 2.06, 13, 3, ROOFS[1]);

  // The garden of the cloister, once the wings are painted: its trees and the benches.
  p.tree(1.52, 1.62);
  p.tree(2.36, 1.9);
  bench(p, 1.72, 2.02);
  bench(p, 2.24, 1.3);

  // The iron fence along the street, with the gate between its pillars.
  p.fence(p.P(0.24, 2.86), p.P(1.16, 2.86));
  p.fence(p.P(1.46, 2.86), p.P(2.78, 2.86));
  for (const u of [1.16, 1.46]) p.box(u, 2.8, u + 0.1, 2.9, 0, 4, CHALK, 'plain');
  p.tree(2.78, 2.56);
}

/** Paints a service building on its own canvas, without turning it into a sprite. */
export function paintService(kind: ServiceKind): { px: Pixels; ax: number; ay: number } {
  // `penLot(n, z)` is `pen(z)` for one lot, so the small services keep the canvas they had and the two big
  // ones get the diamond of their 3x3 block.
  const p = penLot(SERVICE_SIZE[kind], SERVICE_MAX_Z[kind]);
  if (kind === 'school') paintSchool(p);
  else if (kind === 'clinic') paintClinic(p);
  else if (kind === 'police') paintPolice(p);
  else if (kind === 'fire') paintFirehouse(p);
  else if (kind === 'hospital') paintHospital(p);
  else paintUniversity(p);
  return { px: p.px, ax: p.ax, ay: p.ay };
}

const serviceCache = new Map<ServiceKind, Sprite>();

/** The sprite of a service building, keyed by its kind, in the pixel pass of the city. */
export function servicePixelSprite(kind: ServiceKind): Sprite {
  let sprite = serviceCache.get(kind);
  if (!sprite) {
    sprite = spriteOf(paintService(kind));
    serviceCache.set(kind, sprite);
  }
  return sprite;
}

/* ---------- The airport and the harbour ---------- */

const APRON: Ramp = [hex('#aaa69b'), hex('#9d998f'), hex('#85827a')];
const TARMAC: Ramp = [hex('#4e515a'), hex('#464951'), hex('#3a3d45')];
const STRIPE = hex('#e9e4d6');
const LINE_Y = hex('#d9b23c');
const HULL: Ramp = [hex('#f1eee7'), hex('#e6e2da'), hex('#c6c9cf')];
const WING_GREY: Ramp = [hex('#c6cbd2'), hex('#b6bbc2'), hex('#9aa0a8')];
const PLANE_GLASS = hex('#33424f');
const CRANE: Ramp = ramp('#e3b431');
const CARGO: RGB[] = ['#c8392f', '#2f63a6', '#3c8d4a', '#e0a526'].map(hex);
const QUAY: Ramp = [hex('#bdb8ab'), hex('#aca79b'), hex('#959085')];
const DARK_IRON = ramp('#3c3c40');

/** A frame of reference on the ground: `(a, c)` are cells of a rectangle of lots. */
interface Frame {
  at(a: number, c: number): [number, number];
  pt(a: number, c: number, z?: number): Pt;
  /** A flat patch of ground from (a0, c0) to (a1, c1) at one height. */
  quad(a0: number, c0: number, a1: number, c1: number, z: number, paint: Paint): void;
  /** A flat patch whose four corners each have their own height. */
  plane(pts: [number, number, number][], paint: Paint): void;
  flat(a0: number, c0: number, a1: number, c1: number, z: number, c: RGB): void;
  line(a0: number, c0: number, a1: number, c1: number, z: number, c: RGB): void;
  /** A box over the rectangle, with the same details on both visible faces. */
  box(a0: number, c0: number, a1: number, c1: number, z0: number, h: number, base: Ramp, tex: Tex, patches?: Patch[], top?: RGB): void;
  cornice(a0: number, c0: number, a1: number, c1: number, z: number, h: number, base: Ramp): void;
  /** A two-slope roof with its ridge along `a`, whatever the view does with the axes. */
  gable(a0: number, c0: number, a1: number, c1: number, z: number, rise: number, roof: Ramp): void;
}

/**
 * The frame the two facilities are painted in. Everything is in the coordinates of the whole
 * facility, never of one piece: each piece's canvas is only the window that belongs to it, so two
 * pieces side by side join at the pixel and read as one building.
 */
function frameUV(p: Pen, uv: (a: number, c: number) => [number, number]): Frame {
  const corners = (a0: number, c0: number, a1: number, c1: number) => [uv(a0, c0), uv(a1, c0), uv(a1, c1), uv(a0, c1)];
  const box = (a0: number, c0: number, a1: number, c1: number) => {
    const q = corners(a0, c0, a1, c1);
    return [
      Math.min(...q.map(([u]) => u)),
      Math.min(...q.map(([, v]) => v)),
      Math.max(...q.map(([u]) => u)),
      Math.max(...q.map(([, v]) => v)),
    ] as [number, number, number, number];
  };
  const poly = (pts: [number, number, number][], paint: Paint) =>
    p.poly(
      pts.map(([a, c, z]) => {
        const [u, v] = uv(a, c);
        return p.P(u, v, z);
      }),
      paint,
    );
  return {
    at: uv,
    pt: (a, c, z = 0) => {
      const [u, v] = uv(a, c);
      return p.P(u, v, z);
    },
    quad: (a0, c0, a1, c1, z, paint) => poly([[a0, c0, z], [a1, c0, z], [a1, c1, z], [a0, c1, z]], paint),
    plane: poly,
    flat: (a0, c0, a1, c1, z, c) => poly([[a0, c0, z], [a1, c0, z], [a1, c1, z], [a0, c1, z]], () => c),
    line: (a0, c0, a1, c1, z, c) => {
      const [u0, v0] = uv(a0, c0);
      const [u1, v1] = uv(a1, c1);
      p.px.line(p.P(u0, v0, z), p.P(u1, v1, z), c);
    },
    box: (a0, c0, a1, c1, z0, h, base, tex, patches = [], top) => {
      const [u0, v0, u1, v1] = box(a0, c0, a1, c1);
      p.box(u0, v0, u1, v1, z0, h, base, tex, patches, patches, top);
    },
    cornice: (a0, c0, a1, c1, z, h, base) => {
      const [u0, v0, u1, v1] = box(a0, c0, a1, c1);
      p.cornice(u0, v0, u1, v1, z, h, base);
    },
    gable: (a0, c0, a1, c1, z, rise, roof) => {
      const cm = (c0 + c1) / 2;
      const rows = (f: number): Paint => (x, y) => shade(roof[0], (x + 2 * y) % 4 === 0 ? f * 0.86 : f);
      poly([[a0, c0, z], [a1, c0, z], [a1, cm, z + rise], [a0, cm, z + rise]], rows(0.72));
      poly([[a0, cm, z + rise], [a1, cm, z + rise], [a1, c1, z], [a0, c1, z]], rows(1));
    },
  };
}

/** The frame of a rectangle with its long side (the runway, the quay) along `a`. */
const frameAC = (p: Pen, alongU: boolean): Frame => frameUV(p, alongU ? (a, c) => [a, c] : (a, c) => [c, a]);

/** The frame of a harbour: `t` runs along the water edge and `w` from the land out to the water. */
function frameQuay(p: Pen, fw: number, fh: number, side: number): Frame {
  const alongU = side === 0 || side === 2;
  const uv = (t: number, w: number): [number, number] => {
    if (alongU) return [side === 0 ? w : fw - w, t];
    return [t, side === 1 ? w : fh - w];
  };
  return frameUV(p, uv);
}

/** An airliner on the apron: fuselage along the runway, wings across it, tail fin and engines. */
function airliner(p: Pen, F: Frame, a: number, c: number, s: number, body: Ramp = HULL): void {
  const z = 1.6;
  const h = Math.max(2, Math.round(2.3 * s));
  const plan: Pt[] = [
    F.pt(a - 0.06 * s, c - 0.33 * s, 1.5),
    F.pt(a + 0.15 * s, c - 0.33 * s, 1.5),
    F.pt(a + 0.15 * s, c + 0.33 * s, 1.5),
    F.pt(a - 0.06 * s, c + 0.33 * s, 1.5),
  ];
  p.px.shadow(plan.map(([x, y]) => [x + 2, y + 1] as Pt), 0.3);
  const tail = Math.max(2, Math.round(2.6 * s));
  F.box(a - 0.36 * s, c - 0.05 * s, a + 0.36 * s, c + 0.05 * s, z, h, body, 'plain', [
    { t0: 2, t1: 99, k0: h - 1, k1: h, c: PLANE_GLASS },
  ]);
  F.box(a + 0.34 * s, c - 0.035 * s, a + 0.4 * s, c + 0.035 * s, z, Math.max(1, h - 1), body, 'plain');
  F.box(a + 0.19 * s, c - 0.03 * s, a + 0.27 * s, c + 0.03 * s, z + h - 1, 1, body, 'plain', [{ t0: 0, t1: 9, k0: 0, k1: 1, c: PLANE_GLASS }]);
  F.box(a - 0.05 * s, c - 0.33 * s, a + 0.15 * s, c + 0.33 * s, z + 1, 1, WING_GREY, 'plain');
  F.box(a - 0.37 * s, c - 0.012 * s, a - 0.25 * s, c + 0.012 * s, z + h, tail, body, 'plain');
  F.box(a - 0.38 * s, c - 0.16 * s, a - 0.27 * s, c + 0.16 * s, z + h, 1, WING_GREY, 'plain');
  for (const d of [-0.19, 0.19]) F.box(a - 0.02 * s, c + (d - 0.045) * s, a + 0.1 * s, c + (d + 0.045) * s, z + 1, 1, ramp('#a9aeb6'), 'plain');
}

/** The control tower: the shaft with its slits, the glazed cab, the roof and the aerial. */
function controlTower(p: Pen, F: Frame, a: number, c: number, shaft: number): void {
  const z = 1.5;
  F.box(a - 0.15, c - 0.15, a + 0.15, c + 0.15, z, shaft, TOWER_WALL, 'plain', [
    { t0: 2, t1: 3, k0: 4, k1: shaft - 2, c: shade(TOWER_WALL[1], 0.84) },
  ]);
  F.box(a - 0.22, c - 0.22, a + 0.22, c + 0.22, z + shaft, 4, ramp('#7fa3b8'), 'plain', [
    { t0: 0, t1: 99, k0: 3, k1: 4, c: shade(GLASS_LIT, 1.15) },
  ]);
  F.box(a - 0.25, c - 0.25, a + 0.25, c + 0.25, z + shaft + 4, 2, ramp('#a9a49b'), 'plain');
  const [u, v] = F.at(a, c);
  p.antenna(u, v, z + shaft + 6, 5);
}

/**
 * The airport, painted across the whole facility: the runway at the back with its markings, the apron
 * in the middle, the terminal and the tower in front, the hangar and the cargo shed along the ends.
 */
function paintAirport(p: Pen, level: number, fw: number, fh: number): void {
  const alongU = fw >= fh;
  const F = frameAC(p, alongU);
  const A = Math.max(fw, fh);
  const C = Math.min(fw, fh);

  // Three bands across the rectangle: the runway at the back, the buildings behind the apron and the
  // apron itself along the front. The buildings go behind and never in front, because a building in
  // front hides a couple of cells of whatever stands behind it, and the apron is the part of an
  // airport that has to be seen: it is where the planes are.
  const runC0 = 0.06;
  const runC1 = runC0 + Math.max(0.55, Math.min(0.44 * C + 0.05, C * 0.36));
  const termC0 = runC1 + 0.08;
  const termC1 = termC0 + Math.min(0.62, C * 0.31);
  const planeC = Math.min(C - 0.42, termC1 + 0.4);
  const runMid = (runC0 + runC1) / 2;

  // The concrete under everything: an airport is not built on the grass of its lots. The top face
  // gets its own grain, or the kerb's checker would read as a pattern of tiles.
  F.box(0.04, 0.04, A - 0.04, C - 0.04, 0, 1.4, APRON, 'plain');
  F.quad(0.04, 0.04, A - 0.04, C - 0.04, 1.5, (x, y) => (noise(x, y, 9) > 0.62 ? APRON[0] : APRON[1]));

  // The runway: asphalt with its grain, the edge lines, the centre dashes and the threshold bars. The
  // lines are thin quads and not pixel lines, because a one-pixel line along a diagonal comes out
  // dotted and a dotted runway reads as noise.
  F.quad(0, runC0, A, runC1, 1.6, (x, y) => (noise(x, y, 5) > 0.74 ? TARMAC[0] : TARMAC[1]));
  F.flat(0.04, runC0 + 0.05, A - 0.04, runC0 + 0.1, 1.7, STRIPE);
  F.flat(0.04, runC1 - 0.1, A - 0.04, runC1 - 0.05, 1.7, STRIPE);
  for (let a = 0.34; a < A - 0.6; a += 0.98) F.flat(a, runMid - 0.03, a + 0.52, runMid + 0.03, 1.7, STRIPE);
  for (const a0 of [0.16, A - 0.3]) {
    for (let k = 0; k < 2; k++) {
      const c = runC0 + 0.16 + k * 0.22;
      if (c < runC1 - 0.12) F.flat(a0, c, a0 + 0.14, c + 0.05, 1.7, STRIPE);
    }
  }

  // The taxiway that leaves the runway and runs along the apron, with its yellow guide line.
  F.flat(0.04, runC1 + 0.01, A - 0.04, runC1 + 0.05, 1.65, LINE_Y);
  if (level >= 2) F.flat(A - 0.62, runC1, A - 0.56, planeC + 0.2, 1.66, LINE_Y);

  // The terminal: a compact block with the red band of its fascia and the glass of the airside, and
  // the jet bridges that run from it out to the planes.
  const tA0 = 0.06 * A + 0.06;
  const tA1 = tA0 + Math.min(0.42 * A, 2.1);
  const th = level === 1 ? 9 : level === 2 ? 12 : 16;
  const gates = level === 1 ? 1 : level === 2 ? 2 : 3;
  const step = (tA1 - tA0) / (gates + 0.4);
  F.box(tA0, termC0, tA1, termC1, 1.5, th, TOWER_WALL, 'plain', [
    ...ribbonIn(2, 999, 2, 4, GLASS_LIT),
    { t0: 0, t1: 999, k0: th - 3, k1: th - 2, c: hex('#c8392f') },
    { t0: 0, t1: 999, k0: th - 2, k1: th - 1, c: shade(TOWER_WALL[1], 1.16) },
    { t0: 0, t1: 999, k0: th - 1, k1: th, c: shade(TOWER_WALL[1], 0.82) },
    { t0: Math.round(step * 0.6), t1: Math.round(step * 0.6) + 8, k0: 0, k1: 5, c: GLASS_LIT },
  ]);
  F.cornice(tA0, termC0, tA1, termC1, 1.5 + th, 1.5, TOWER_WALL);
  for (let k = 0; k < gates; k++) {
    const a = tA0 + step * (k + 0.7);
    F.box(a - 0.05, termC1 - 0.02, a + 0.05, planeC - 0.16, 4.5, 2.4, STEEL, 'plain');
    F.flat(a - 0.03, termC1, a + 0.03, planeC - 0.18, 1.66, LINE_Y);
  }

  // The hangar at the far end of the same band, its door to the apron, and the tower beside it.
  const hA1 = A - 0.1;
  const hA0 = hA1 - Math.min(0.34 * A, 1.15);
  F.box(hA0, termC0, hA1, termC1, 1.5, 7, ramp('#e2dfd6'), 'plain', [
    { t0: 4, t1: 999, k0: 0, k1: 6, c: GARAGE },
    { t0: 2, t1: 4, k0: 0, k1: 7, c: hex('#c8392f') },
    { t0: 0, t1: 999, k0: 6, k1: 7, c: hex('#c8392f') },
  ]);
  F.gable(hA0, termC0, hA1, termC1, 8.5, 3, ramp('#8f9aa2'));
  controlTower(p, F, (tA1 + hA0) / 2, termC0 + 0.22, level === 1 ? 12 : level === 2 ? 19 : 26);

  // The cargo shed and its containers, where the airport is big enough to have a cargo apron.
  if (level === 3) {
    const cA0 = (tA1 + hA0) / 2 + 0.5;
    const cA1 = Math.min(hA0 - 0.12, cA0 + 1.1);
    F.box(cA0, termC0 + 0.06, cA1, termC1, 1.5, 6, ramp('#d8d4c8'), 'plain', [
      { t0: 0, t1: 999, k0: 3, k1: 5, c: GLASS },
    ]);
    for (let k = 0; k < 3; k++) {
      const c = CARGO[k % 4];
      F.box(cA0 + k * 0.3, termC1 + 0.06, cA0 + k * 0.3 + 0.24, termC1 + 0.22, 1.5, 3, [shade(c, 1.06), shade(c, LEFT), shade(c, RIGHT)], 'sheet');
    }
  }

  // The planes on the apron, the biggest one in the middle, each on its own shadow.
  const planes = level === 1 ? 1 : level === 2 ? 2 : 3;
  const s = Math.min(1.5, 0.62 * C + 0.1);
  for (let k = 0; k < planes; k++) {
    const a = tA0 + step * (k + 0.7) + (level === 3 && k === 1 ? 0.25 : 0);
    airliner(p, F, a, planeC, level === 3 && k === 1 ? s * 1.25 : s);
  }

  // The fuel depot in the apron the terminal does not use, with its two tanks and their kerb.
  const fA = level === 3 ? A * 0.5 : A * 0.2;
  const fC = Math.min(C - 0.5, termC1 + 0.34);
  F.box(fA - 0.02, fC - 0.34, fA + 0.8, fC + 0.24, 1.5, 3, APRON, 'plain');
  for (const d of [0.16, 0.52]) {
    const [tu, tv] = F.at(fA + d, fC - 0.06);
    p.silo(tu, tv, 0.2, 1.5, 5);
  }

  // The wind sock by the runway, on its mast.
  const [sx, sy] = F.pt(A - 0.2, runC1 - 0.02, 1.5);
  p.px.rect(Math.round(sx), Math.round(sy) - 8, 1, 8, LEG);
  p.px.rect(Math.round(sx) + 1, Math.round(sy) - 8, 3, 1, hex('#e8702a'));
  p.px.rect(Math.round(sx) + 1, Math.round(sy) - 7, 3, 1, CREAM);
}

/** A dockside crane: four legs, the tower, the cab and the boom reaching out over the water. */
function docksideCrane(p: Pen, F: Frame, t: number, w: number, h: number, reach: number): void {
  const z = 1.5;
  for (const dt of [-0.15, 0.15]) {
    for (const dw of [-0.14, 0.14]) {
      F.box(t + dt - 0.03, w + dw - 0.03, t + dt + 0.03, w + dw + 0.03, z, 3, CRANE, 'plain');
    }
  }
  F.box(t - 0.17, w - 0.03, t + 0.17, w + 0.03, z + 3, 2, CRANE, 'plain');
  F.box(t - 0.1, w - 0.1, t + 0.1, w + 0.1, z + 5, h, CRANE, 'plain', [
    { t0: 0, t1: 999, k0: h - 2, k1: h - 1, c: shade(CRANE[1], 0.72) },
  ]);
  F.box(t - 0.06, w - 0.06, t + 0.06, w + reach, z + 4 + h, 2, CRANE, 'plain');
  F.box(t - 0.07, w - 0.26, t + 0.07, w - 0.12, z + 3 + h, 3, ramp('#c3cfd4'), 'plain', [
    { t0: 0, t1: 9, k0: 1, k1: 3, c: GLASS },
  ]);
  // The hoist line and its hook, hanging over the water.
  const [hx, hy] = F.pt(t, w + reach - 0.08, z + 4 + h);
  p.px.line([Math.round(hx), Math.round(hy)], [Math.round(hx), Math.round(hy) + 6], LEG);
  p.px.rect(Math.round(hx) - 1, Math.round(hy) + 6, 3, 1, DARK_IRON[1]);
}

/**
 * The harbour, painted across the whole facility: the quay with its cope and its bollards, the crane
 * and the containers on the water side, the terminal away from it, and the wooden jetty between them.
 */
function paintHarbor(p: Pen, level: number, fw: number, fh: number, side: number): void {
  const alongU = side === 0 || side === 2;
  const F = frameQuay(p, fw, fh, side % 4);
  const T = alongU ? fh : fw;
  const W = alongU ? fw : fh;

  // The quay: a concrete platform over the edge of the water, with its darker cope and its bollards.
  F.box(0.04, 0.04, T - 0.04, W - 0.04, 0, 1.4, QUAY, 'plain');
  F.quad(0.04, 0.04, T - 0.04, W - 0.04, 1.5, (x, y) => (noise(x, y, 11) > 0.66 ? QUAY[0] : QUAY[1]));
  F.flat(0.04, W - 0.22, T - 0.04, W - 0.04, 1.55, shade(QUAY[1], 0.84));
  F.line(0.05, W - 0.22, T - 0.05, W - 0.22, 1.56, STRIPE);
  for (let t = 0.16; t < T - 0.1; t += 0.46) F.box(t - 0.035, W - 0.16, t + 0.035, W - 0.09, 1.5, 2, DARK_IRON, 'plain');

  // The wooden jetty along the water edge, on its pilings, and the fenders under the cope.
  F.box(T * 0.2, W - 0.74, T * 0.66, W - 0.03, 1.5, 1, WOOD_DECK, 'plain');
  for (let t = T * 0.24; t < T * 0.64; t += 0.18) {
    const [u, v] = F.at(t, W - 0.05);
    const [x, y] = p.P(u, v, 1);
    p.px.rect(Math.round(x), Math.round(y) + 1, 1, 5, WOOD_PILING[1]);
  }

  // The crane on the water side: small for a jetty, a container crane once it is a harbour.
  docksideCrane(p, F, T * 0.72, W - 0.46, level === 1 ? 8 : level === 2 ? 10 : 13, level === 1 ? 0.5 : 0.85);
  if (level === 3) docksideCrane(p, F, T * 0.36, W - 0.46, 11, 0.7);

  // The containers, in rows along the quay between the terminal and the jetty: the long side along
  // the water, which is how they are stacked in a port, and never on top of the buildings.
  const depth = Math.min(0.52, W * 0.3);
  const rows = level === 1 ? 1 : level === 2 ? 2 : W > 3.2 ? 3 : 2;
  const stacks = Math.max(1, Math.floor((T - 0.25) / 0.46));
  for (let r = 0; r < rows; r++) {
    const w = 0.1 + depth + 0.14 + r * 0.24;
    for (let k = 0; k < stacks; k++) {
      const t = 0.12 + k * 0.46;
      const c = CARGO[(k + r * 3) % 4];
      F.box(t, w, t + 0.36, w + 0.16, 1.5, 3.5, [shade(c, 1.06), shade(c, LEFT), shade(c, RIGHT)], 'sheet');
      if (level === 3 && r === 0) F.box(t + 0.02, w + 0.01, t + 0.34, w + 0.14, 5, 3.5, [shade(c, 1.1), shade(c, LEFT), shade(c, RIGHT)], 'sheet');
    }
  }

  // The terminal, away from the water: a shed for a jetty, a cruise terminal for a harbour.
  const len = T * (level === 1 ? 0.42 : level === 2 ? 0.52 : 0.64);
  const th = level === 1 ? 6 : level === 2 ? 9 : 12;
  const wall = level === 3 ? ramp('#e8e4dc') : ramp('#f1e3c6');
  F.box(0.1 * T, 0.08, 0.1 * T + len, 0.08 + depth, 1.5, th, wall, 'plain', [
    ...ribbonIn(3, 999, 3, 2, GLASS),
    { t0: 0, t1: 999, k0: th - 2, k1: th - 1, c: shade(wall[1], 1.14) },
  ]);
  F.gable(0.1 * T, 0.08, 0.1 * T + len, 0.08 + depth, 1.5 + th, 3, level === 3 ? ramp('#c8392f') : ramp('#2f63a6'));
  if (level === 3) {
    const [fu, fv] = F.at(0.1 * T + len - 0.3, 0.08 + depth * 0.5);
    p.flag(fu, fv, 1.5 + th + 3, 8);
  }

  // The lamps of the quay, two of them, so the platform is lit at night.
  for (const t of [0.14 * T, 0.78 * T]) {
    const [lu, lv] = F.at(t, W - 0.62);
    lampPost(p, lu, lv);
  }
}

const HUB_MAX_Z: Record<HubKind, number> = { airport: 40, harbor: 30 };

/** The canvas of a facility `fw`×`fh` cells big, with the pen anchored at its top corner. */
function penHub(kind: HubKind, fw: number, fh: number): Pen {
  const maxZ = HUB_MAX_Z[kind];
  return new Pen(new Pixels(16 * (fw + fh) + 8, maxZ + 8 * (fw + fh) + 8), 16 * fh + 4, maxZ + 2);
}

/** Where a piece sits inside the rectangle of its facility, in view cells. */
export interface HubView {
  fw: number;
  fh: number;
  i: number;
  j: number;
  pw: number;
  ph: number;
}

/** The whole facility on one canvas: what the board shows and what the tests compare against. */
export function paintHub(kind: HubKind, level: number, fw: number, fh: number, side = 0): { px: Pixels; ax: number; ay: number } {
  const p = penHub(kind, fw, fh);
  if (kind === 'airport') paintAirport(p, level, fw, fh);
  else paintHarbor(p, level, fw, fh, side);
  return { px: p.px, ax: p.ax, ay: p.ay };
}

/**
 * One piece of a facility is a **crop** of the painting of the whole thing, never a painting of its
 * own. Two pieces therefore cannot disagree along the edge they share: the seam does not exist, the
 * same pixels come from the same drawing.
 */
export function paintHubPiece(kind: HubKind, level: number, view: HubView, side = 0): { px: Pixels; ax: number; ay: number } {
  const whole = paintHub(kind, level, view.fw, view.fh, side);
  const maxZ = HUB_MAX_Z[kind];
  const px = new Pixels(16 * (view.pw + view.ph) + 8, maxZ + 8 * (view.pw + view.ph) + 8);
  const ox = 16 * (view.fh - view.ph) + 16 * (view.i - view.j);
  const oy = 8 * (view.i + view.j);
  for (let y = 0; y < px.h; y++) {
    for (let x = 0; x < px.w; x++) {
      const from = ((oy + y) * whole.px.w + ox + x) * 4;
      const to = (y * px.w + x) * 4;
      for (let k = 0; k < 4; k++) px.data[to + k] = whole.px.data[from + k] ?? 0;
    }
  }
  return { px, ax: 16 * view.ph + 4, ay: maxZ + 2 };
}

const hubCache = new Map<string, Sprite>();

/** The sprite of one piece of an airport or a harbour, cut out of the painting of the whole facility. */
export function hubPixelSprite(kind: HubKind, level: number, view: HubView, side = 0): Sprite {
  const key = `${kind}|${level}|${view.fw}x${view.fh}|${view.i},${view.j}|${view.pw}x${view.ph}|${side}`;
  let sprite = hubCache.get(key);
  if (!sprite) {
    sprite = spriteOf(paintHubPiece(kind, level, view, side));
    hubCache.set(key, sprite);
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

/* ---------- The three buildings of the coast ---------- */

/** The sand of the beach, warmer than any pavement. */
const SAND: Ramp = [hex('#b58d52'), hex('#e2c48f'), hex('#cfae74')];
/** Thatch: straw over the shadow of the eave. */
const THATCH: Ramp = [hex('#8a6327'), hex('#d8b871'), hex('#b8934a')];
/** The stone the lighthouse stands on, and the foam that hits it. */
const STONE: Ramp = ramp('#8b8b84');
const FOAM = hex('#eaf5f8');
const LAMP = hex('#ffe37a');
const BEAM = hex('#ffeeb4');
const PLASTER = ramp('#f2efe6');

/** The sides of a cell that face water, in the order back-right, front-right, front-left, back-left. */
const waterSides = (mask: number): number[] => [0, 1, 2, 3].filter((k) => mask & (1 << k));

/** The two end points of each side of the diamond, in footprint units. */
const SIDE_EDGE: readonly [number, number, number, number][] = [
  [0, 0, 1, 0],
  [1, 0, 1, 1],
  [0, 1, 1, 1],
  [0, 0, 0, 1],
];

/** A line of foam along a side of the cell that looks at the river, dithered so it is not a bar. */
function surf(p: Pen, side: number, z = -1.2): void {
  const [a, b, c, d] = SIDE_EDGE[side];
  p.px.line(p.P(a, b, z), p.P(c, d, z), FOAM);
  p.poly([p.P(a, b, z - 1), p.P(c, d, z - 1), p.P(c, d, z), p.P(a, b, z)], (x, y) => (bayer(x, y) < 0.34 ? WATER_SHALLOW : null));
}

/**
 * The concrete apron of the port: slabs over the whole cell, a white line along the wet sides and
 * the bollards where the ship ties up. The crane and the stacks stand on this.
 */
function quayFloor(p: Pen, water: number[]): void {
  p.poly([p.P(0, 0), p.P(1, 0), p.P(1, 1), p.P(0, 1)], (x, y) => {
    const u = ((x - p.ax) / 16 + (y - p.ay) / 8) / 2;
    const v = ((y - p.ay) / 8 - (x - p.ax) / 16) / 2;
    // A joint every three slabs in both directions, and two tones between them so it is not a plate.
    if (Math.floor(u * 3) !== Math.floor((u + 0.05) * 3) || Math.floor(v * 3) !== Math.floor((v + 0.05) * 3)) return QUAY[0];
    return bayer(x, y) < 0.5 ? QUAY[1] : QUAY[2];
  });
  for (const k of water) {
    // The wall of the quay dropping to the water, and the white edge line along its top.
    const [a, b, c, d] = SIDE_EDGE[k];
    p.poly(
      [p.P(a, b), p.P(c, d), p.P(c, d, -2), p.P(a, b, -2)],
      (x, y) => (bayer(x, y) < 0.5 ? shade(QUAY[2], 0.66) : shade(QUAY[1], 0.74)),
    );
    p.px.line(p.P(a, b, 0.4), p.P(c, d, 0.4), shade(QUAY[1], 1.32));
    surf(p, k, -2.4);
  }
  // The bollards, on the wet sides: a one-pixel post with its cap.
  for (const k of water) {
    const [a, b, c, d] = SIDE_EDGE[k];
    for (const t of [0.3, 0.68]) {
      const u = a + (c - a) * t;
      const v = b + (d - b) * t;
      const [x, y] = p.P(u, v, 0.4);
      const cx = Math.round(x);
      const cy = Math.round(y);
      p.px.rect(cx, cy - 3, 1, 3, LEG);
      p.px.rect(cx - 1, cy - 3, 3, 1, STEEL[1]);
    }
  }
}

/**
 * A gantry crane over the quay: two legs standing on their rails, the beam on top and the cab under it.
 * The beam runs out past the legs on the water side, which is the boom, and that is what makes the
 * silhouette a crane and not a goal post.
 */
function gantryCrane(p: Pen, u0: number, u1: number, v: number, h: number, color: Ramp): [number, number] {
  const legW = 0.08;
  const depth = 0.1;
  for (const ua of [u0, u1 - legW]) {
    // The leg is a solid two-pixel post with one rail down its middle: a full lattice at this size
    // reads as a ladder, and no rail at all leaves a hollow doorway.
    p.box(ua, v, ua + legW, v + depth, 0, h, color, 'plain');
    const [rx, ry] = p.P(ua + legW / 2, v + depth, 0);
    p.px.rect(Math.round(rx), Math.round(ry) - h + 2, 1, h - 3, shade(color[2], 1.28));
    // The shoe, because a gantry crane runs on a rail.
    p.box(ua - 0.03, v - 0.02, ua + legW + 0.03, v + depth + 0.02, 0, 2, [shade(color[0], 0.86), shade(color[1], 0.86), shade(color[2], 0.86)], 'plain');
  }
  // The beam, two pixels over the legs, dark underneath, and the boom sticking out over the water.
  p.box(u0 - 0.07, v, u1 + 0.14, v + depth, h, 2, color, 'plain');
  p.px.line(p.P(u0 - 0.07, v, h), p.P(u1 + 0.14, v, h), shade(color[2], 0.64));
  // The cab under the beam, glass facing the quay.
  const uc = (u0 + u1) / 2;
  p.box(uc - 0.07, v + 0.01, uc + 0.07, v + depth, h - 5, 5, color, 'plain', [{ t0: 1, t1: 4, k0: 2, k1: 4, c: GLASS }]);
  return [uc, v + depth / 2];
}

/**
 * The load of the crane: the trolley on the beam, its two cables, the spreader and the container in the
 * air. It is painted after the yard, so it hangs in front of the containers instead of vanishing into
 * them.
 */
function gantryLoad(p: Pen, uc: number, v: number, h: number, color: Ramp, load: RGB): void {
  const z = Math.round(h) - 15;
  const [tx, ty] = p.P(uc, v, h);
  p.px.rect(Math.round(tx) - 3, Math.round(ty) - 1, 7, 2, shade(color[1], 0.88));
  const [bx, by] = p.P(uc, v, z + 4);
  for (const dx of [-3, 3]) p.px.rect(Math.round(tx) + dx, Math.round(ty) + 1, 1, Math.max(2, Math.round(by) - Math.round(ty) - 1), LEG);
  p.px.rect(Math.round(bx) - 4, Math.round(by) - 1, 9, 1, shade(color[0], 0.7));
  p.box(uc - 0.09, v - 0.02, uc + 0.09, v + 0.07, z, 3, [shade(load, 1.05), shade(load, LEFT), shade(load, RIGHT)], 'sheet', [], [], shade(load, 1.2));
}

/**
 * A row of containers stacked two high: one long ribbed box per tier, all of one colour. A tier in a
 * different colour turns three rows into a striped ramp — that was the first attempt — so the colour
 * changes from box to box and never from tier to tier. The ribs are what say "container".
 */
function containerRow(p: Pen, u: number, v: number, w: number, dv: number, tiers: number, c: RGB): void {
  const ribs: Patch[] = [];
  const len = Math.round(w * 32);
  for (let t = 2; t < len; t += 3) ribs.push({ t0: t, t1: t + 1, k0: 0, k1: 2, c: shade(c, 0.74) });
  for (let t = 0; t < tiers; t++) {
    p.box(u, v, u + w, v + dv, t * 2, 2, [shade(c, 1.06), shade(c, LEFT), shade(c, RIGHT)], 'sheet', ribs, [], shade(c, 1.14));
  }
}

/**
 * The cargo port. `mask` is the sides of the lot that face water: the apron runs out to them with the
 * bollards, and the stacks of containers and the crane work over the middle.
 */
function paintPort(p: Pen, mask: number): void {
  const water = waterSides(mask);
  p.shadow(0.06, 0.06, 0.94, 0.94);
  quayFloor(p, water);
  // The gantry spans the lot from the back edge, and the yard is stacked in front of its legs, two rows
  // deep, so the crane works over what you can see instead of hiding it.
  // The lane of the terminal, dashed in the yellow of the crane: without it the apron is a grey plate
  // and the whole front of the lot is empty.
  for (let t = 0.08; t < 0.92; t += 0.1) {
    const [lx, ly] = p.P(t, 0.84, 0.3);
    p.px.set(Math.round(lx), Math.round(ly), shade(CRANE[1], 1.12));
  }
  // The gantry spans the lot from the back edge, and the yard stacks in front of its legs: two rows of
  // two long boxes, each box one company colour, so the yard is a patchwork of four and none of them
  // turns into a stripe.
  const [cu] = gantryCrane(p, 0.16, 0.84, 0.06, 28, CRANE);
  containerRow(p, 0.04, 0.3, 0.42, 0.1, 2, CARGO[1]);
  containerRow(p, 0.52, 0.3, 0.44, 0.1, 2, CARGO[0]);
  containerRow(p, 0.04, 0.52, 0.42, 0.1, 2, CARGO[3]);
  containerRow(p, 0.52, 0.52, 0.44, 0.1, 1, CARGO[2]);
  // The trolley runs the beam, so the load hangs at the crane's own u, in front of the yard: over a stack
  // it reads as one more box instead of a box in the air.
  gantryLoad(p, cu, 0.72, 28, CRANE, CARGO[0]);
}

/** Paints the cargo port. */
export function paintPortCell(mask: number): { px: Pixels; ax: number; ay: number; smoke: [number, number][] } {
  const p = penLot(1, 58);
  paintPort(p, mask);
  return { px: p.px, ax: p.ax, ay: p.ay, smoke: p.smoke };
}

/** A parasol of the beach: a pole and a dome of stripes, wide enough to read at 1x. */
function parasol(p: Pen, u: number, v: number, a: RGB, b: RGB): void {
  const [x, y] = p.P(u, v);
  const cx = Math.round(x);
  const cy = Math.round(y);
  p.px.rect(cx, cy - 9, 1, 9, shade(WOOD_DARK[1], 0.9));
  // The dome: four rows that widen, with the stripes turning with it.
  for (const [dy, half] of [
    [-13, 1],
    [-12, 3],
    [-11, 4],
    [-10, 5],
  ] as const) {
    for (let dx = -half; dx <= half; dx++) p.px.set(cx + dx, cy + dy, Math.floor((dx + 5) / 2) % 2 ? a : b);
  }
  p.px.rect(cx - 5, cy - 9, 11, 1, shade(a, 0.62));
  p.px.set(cx, cy - 14, shade(b, 0.9));
}

/** A sun lounger on the sand: the canvas seat, the back raised and its two legs. */
function lounger(p: Pen, u: number, v: number, c: RGB): void {
  const [x, y] = p.P(u, v);
  const cx = Math.round(x);
  const cy = Math.round(y);
  // The shadow first, so the lounger is lying on the sand instead of floating over it.
  p.px.rect(cx - 3, cy, 7, 1, shade(SAND[0], 0.82));
  p.px.rect(cx - 3, cy - 4, 1, 2, shade(c, 0.8));
  p.px.set(cx - 2, cy - 3, shade(c, 0.8));
  p.px.rect(cx - 2, cy - 2, 6, 2, c);
  p.px.rect(cx - 2, cy - 1, 1, 1, LEG);
  p.px.rect(cx + 3, cy - 1, 1, 1, LEG);
}

/**
 * The beach resort. `mask` is the water: the sand runs out to it with the foam, the bar stays on the
 * dry side, and the parasols and the loungers fill the sand between them.
 */
function paintResort(p: Pen, mask: number): void {
  p.shadow(0.06, 0.06, 0.94, 0.94);
  // The sand over the whole lot: mostly the light tone, the dark one only where the wind ripples it.
  p.poly([p.P(0, 0), p.P(1, 0), p.P(1, 1), p.P(0, 1)], (x, y) => {
    const n = noise(x, y, 3);
    return n > 0.9 ? SAND[0] : n > 0.42 ? SAND[1] : SAND[2];
  });
  for (const k of waterSides(mask)) surf(p, k, -1.2);
  // A wooden deck under the bar, so the hut is not standing on the sand.
  p.box(0.42, 0.02, 0.98, 0.44, 0, 1.4, WOOD_DECK, 'plain', [], [], shade(WOOD_DECK[1], 1.08));
  // The bar: a small hut in the back corner, because the cell is a beach and the beach is the point.
  const u0 = 0.48;
  const v0 = 0.06;
  const u1 = 0.94;
  const v1 = 0.38;
  const h = 8;
  p.box(
    u0,
    v0,
    u1,
    v1,
    1.4,
    h,
    PLASTER,
    'plain',
    [
      { t0: 2, t1: 8, k0: 3, k1: 6, c: INSIDE },
      { t0: 2, t1: 8, k0: 2, k1: 3, c: WOOD[1] },
    ],
    [{ t0: 1, t1: 4, k0: 3, k1: 6, c: GLASS }],
    shade(PLASTER[0], 1.02),
  );
  // The thatch over it: thick, with the straw rows showing on the eave, and the ridge on top.
  p.hip(u0 - 0.04, v0 - 0.04, u1 + 0.04, v1 + 0.04, 1.4 + h, 5, THATCH);
  const [qx] = p.P(u0 - 0.04, v1 + 0.04, 0);
  for (let k = 0; k < 4; k++) {
    const [rx, ry] = p.P(u0 - 0.04, v1 + 0.04, 1.4 + h + k);
    p.px.rect(Math.round(rx) + 1, Math.round(ry), Math.round(qx) - Math.round(rx) - 1, 1, k % 2 ? shade(THATCH[1], 0.88) : THATCH[1]);
  }
  p.px.line(p.P(u0 - 0.02, (v0 + v1) / 2, 1.4 + h + 5), p.P(u1 + 0.02, (v0 + v1) / 2, 1.4 + h + 5), shade(THATCH[1], 1.22));
  // The awning over the counter, red and white: the thing that says "bar" from across the beach.
  p.canopy(u0 + 0.01, v1, u1 - 0.01, 1.4 + 5, hex('#e0453a'), hex('#f4f0e6'), 4);
  // The counter outside, with the bottles on it.
  const [cx, cy] = p.P(0.66, 0.5, 1.4);
  p.px.rect(Math.round(cx) - 4, Math.round(cy) - 3, 9, 3, WOOD[1]);
  p.px.rect(Math.round(cx) - 4, Math.round(cy), 9, 1, shade(WOOD[1], 0.7));
  for (const dx of [-2, 1, 4]) p.px.set(Math.round(cx) + dx, Math.round(cy) - 4, [hex('#2f9a55'), hex('#e0a526'), hex('#c8462f')][(dx + 4) % 3]);
  // The beach: two parasols with a lounger next to each, and the sand between them.
  parasol(p, 0.2, 0.18, hex('#e0453a'), hex('#f4f0e6'));
  parasol(p, 0.12, 0.56, hex('#3f8fe0'), hex('#f4f0e6'));
  parasol(p, 0.52, 0.88, hex('#e0b542'), hex('#f4f0e6'));
  lounger(p, 0.32, 0.3, hex('#f4f0e6'));
  lounger(p, 0.07, 0.84, hex('#e8dece'));
  lounger(p, 0.8, 0.72, hex('#f4f0e6'));
}

/** Paints the beach resort. */
export function paintResortCell(mask: number): { px: Pixels; ax: number; ay: number; smoke: [number, number][] } {
  const p = penLot(1, 42);
  paintResort(p, mask);
  return { px: p.px, ax: p.ax, ay: p.ay, smoke: p.smoke };
}

/**
 * The lighthouse: the rock in the water, the tapered tower banded red and white, the gallery and the
 * lantern with its beam. It is the tallest thing on the coast, so it reads as a silhouette: the bands
 * and the cone of the cap are what has to survive at 1x.
 */
function paintLighthouse(p: Pen, mask: number): void {
  p.shadow(0.26, 0.26, 0.74, 0.74);
  // The rock the tower stands on, with the foam breaking against it.
  const [rx, ry] = p.P(0.5, 0.5);
  p.px.blob(Math.round(rx), Math.round(ry + 1), 11, 6, [shade(STONE[2], 1.08), STONE[1], STONE[0]], shade(STONE[0], 0.7), false);
  p.px.blob(Math.round(rx) - 7, Math.round(ry + 2), 5, 4, [shade(STONE[2], 1.08), STONE[1], STONE[0]], shade(STONE[0], 0.7), false);
  for (const k of waterSides(mask)) {
    const [a, b, c, d] = SIDE_EDGE[k];
    p.px.line(p.P(a, b, -1.4), p.P(c, d, -1.4), FOAM);
  }
  const bands = 5;
  const h = 54;
  const [bx, by] = p.P(0.5, 0.5, 5);
  const cx = Math.round(bx);
  const cy = Math.round(by);
  for (let k = 0; k < h; k++) {
    const t = k / h;
    // The tower tapers: six pixels of half width at the foot, three at the top.
    const half = Math.max(3, Math.round(6 - 3 * t));
    const c = Math.floor(k / (h / bands)) % 2 ? hex('#c8392f') : hex('#f4f0e6');
    p.px.rect(cx - half, cy - k, half * 2 + 1, 1, c);
    // The lit side on the left and the shade on the right, so the tower turns instead of stacking.
    p.px.set(cx - half, cy - k, shade(c, 1.12));
    p.px.set(cx + half, cy - k, shade(c, 0.74));
  }
  const top = cy - h;
  // The gallery: a slab that sticks out, its railing and the lantern room with the light on.
  p.px.rect(cx - 6, top - 1, 13, 1, BALUSTRE);
  p.px.rect(cx - 6, top - 2, 13, 1, BALUSTRE_DARK);
  for (const dx of [-6, -3, 3, 6]) p.px.set(cx + dx, top - 3, BALUSTRE_DARK);
  p.px.rect(cx - 3, top - 9, 7, 7, shade(GLASS, 1.1));
  p.px.rect(cx - 2, top - 8, 5, 5, LAMP);
  p.px.rect(cx - 1, top - 7, 3, 3, hex('#fffbe8'));
  // The cap, a cone of red rows, with its ball on top.
  for (const [dy, half] of [
    [-10, 3],
    [-11, 2],
    [-12, 1],
  ] as const) {
    p.px.rect(cx - half, top + dy, half * 2 + 1, 1, hex('#c8392f'));
  }
  p.px.set(cx, top - 13, hex('#8a2a22'));
  // The beams: solid against the glass, then dithered until they fade, and a pixel taller near the lamp.
  for (const dir of [-1, 1]) {
    for (let d = 1; d < 16; d++) {
      const x = cx + dir * (4 + d);
      if (d > 5 && bayer(x, top - 7) > 0.62 - d * 0.03) continue;
      p.px.set(x, top - 7, d < 8 ? BEAM : shade(BEAM, 0.82));
      if (d <= 3) p.px.set(x, top - 6, shade(BEAM, 0.9));
    }
  }
}

/** Paints the lighthouse. */
export function paintLighthouseCell(mask: number): { px: Pixels; ax: number; ay: number; smoke: [number, number][] } {
  const p = penLot(1, 76);
  paintLighthouse(p, mask);
  return { px: p.px, ax: p.ax, ay: p.ay, smoke: p.smoke };
}

/** The sprite of a coast building, keyed by its kind and the sides that face water. */
export function coastPixelSprite(kind: CoastKind, variant: number): Sprite {
  const key = `coast:${kind}:${variant}`;
  let sprite = coastCache.get(key);
  if (!sprite) {
    const painted =
      kind === 'promenade'
        ? paintPromenade(variant)
        : kind === 'fishing'
          ? paintFishing(variant)
          : kind === 'port'
            ? paintPortCell(variant)
            : kind === 'resort'
              ? paintResortCell(variant)
              : paintLighthouseCell(variant);
    sprite = spriteOf(painted);
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
  // **Dos modelos por nivel en la calle baja**: la variante elige la silueta con `(v >> 1) & 1` y el
  // color con `v`, así que cada modelo aparece con cuatro paletas sobre las ocho que guarda la partida.
  // Con la variante entera eligiendo las dos cosas, la mitad de las calles serían del mismo negocio.
  const segundo = ((v >> 1) & 1) === 1;
  if (lv === 1) (segundo ? bakery : kiosk)(p, v);
  else if (lv === 2) (segundo ? butcher : greengrocer)(p, v);
  else if (lv === 3) (segundo ? pharmacy : hairdresser)(p, v);
  else if (lv === 4) (segundo ? pizzeria : bar)(p, v);
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

/* ---------- The power line and the trees of the map ---------- */

const POLE_CONCRETE: Ramp = ramp('#b8b4ab');
const POLE_INSULATOR = hex('#7fa2b8');
const TRANSFORMER: Ramp = ramp('#6f7a72');

/** The four species of the map, each in its own tone ramp. */
const CROWN_JACARANDA: Ramp = ramp('#a58fc9');
const CROWN_PALO: Ramp = ramp('#d98fa4');
const CROWN_OMBU: Ramp = ramp('#4e6b3a');
const CROWN_EUCALYPTUS: Ramp = ramp('#8aa87e');
const TRUNK_DARK = hex('#5a4632');

/**
 * The crossarm of the pole, with its two insulators. It is what the cable hangs from, so its middle is
 * the attach point the renderer uses to join one pole to the next.
 */
function crossarm(p: Pen, u: number, v: number, z: number, wide: number, thick = 2): void {
  const [x, y] = p.P(u, v, z);
  const cx = Math.round(x);
  const cy = Math.round(y);
  p.px.rect(cx - wide, cy, wide * 2 + 1, 1, POLE_CONCRETE[0]);
  p.px.rect(cx - wide, cy + 1, wide * 2 + 1, Math.max(1, thick - 1), POLE_CONCRETE[2]);
  // A brace under the arm, on the side the load pulls from, so the arm is not a stick in the air.
  p.px.line([cx + wide - 3, cy + 2], [cx + 1, cy + 5], POLE_CONCRETE[2]);
  for (const side of [-1, 1]) {
    const ix = cx + side * wide;
    p.px.rect(ix, cy - 2, 1, 2, POLE_INSULATOR);
    p.px.set(ix, cy - 2, shade(POLE_INSULATOR, 1.3));
  }
}

/**
 * A pole of the line on its lot: a concrete post on its pad, with the crossarm and the two insulators. The
 * variant hangs a transformer on it or doubles the arm. The post stands in the middle of the cell and the
 * cables leave from the middle of the arm.
 */
/** Wood of the old line: the one that was there before the concrete poles came. */
const POLE_WOOD: Ramp = ramp('#7d5a38');
const CERAMIC = hex('#dfe3e0');

/**
 * A pole of the wooden line: a crooked post, a wooden crossarm and two ceramic insulators. It is shorter
 * than the concrete one and it leans a little, which is what tells the two qualities apart from a block
 * away. The variant hangs a rural transformer or a guy wire on it.
 */
function paintPoleWood(variant: number): { px: Pixels; ax: number; ay: number; attach: [number, number] } {
  const p = pen(30);
  const h = 18;
  const [bx, by] = p.P(0.5, 0.5, 0);
  const x = Math.round(bx);
  const y = Math.round(by);
  const top = y - h;
  p.px.shadow(
    [
      [x - 3, y],
      [x, y - 2],
      [x + 3, y],
      [x, y + 2],
    ],
    0.3,
  );
  // The post: straight and thin, with the grain of the wood and a wider foot where it goes into the ground.
  p.px.rect(x, top, 2, h, POLE_WOOD[1]);
  p.px.rect(x, top, 1, h, POLE_WOOD[0]);
  p.px.rect(x + 1, top, 1, h, POLE_WOOD[2]);
  p.px.rect(x - 1, y - 2, 4, 2, POLE_WOOD[1]);
  p.px.rect(x - 1, y - 2, 2, 2, POLE_WOOD[0]);
  p.px.rect(x + 2, y - 2, 1, 2, POLE_WOOD[2]);
  p.px.set(x, y - 12, POLE_WOOD[2]);
  p.px.set(x + 1, y - 8, POLE_WOOD[0]);
  p.px.rect(x + 2, y - 10, 2, 1, STEEL[2]);
  // The crossarm: wider than the concrete one and with a brace under each end, which is what a wooden line
  // has instead of a bolted steel arm.
  const arm = 4;
  const x0 = x - 1 - arm;
  p.px.rect(x0, top, arm * 2 + 2, 1, POLE_WOOD[0]);
  p.px.rect(x0, top + 1, arm * 2 + 2, 1, POLE_WOOD[2]);
  if (variant % 3 !== 1) {
    p.px.line([x - 3, top + 5], [x - 1, top + 2], POLE_WOOD[2]);
    p.px.line([x + 4, top + 5], [x + 2, top + 2], POLE_WOOD[2]);
  }
  for (const ix of [x0, x0 + arm * 2 + 1]) {
    p.px.rect(ix, top - 2, 1, 2, CERAMIC);
    p.px.set(ix, top - 2, shade(CERAMIC, 0.82));
  }
  if (variant % 3 === 1) {
    // The transformer of the rural line: a grey can hanging from the arm, straddling the post.
    p.px.rect(x - 2, top + 3, 5, 6, TRANSFORMER[1]);
    p.px.rect(x - 2, top + 3, 2, 6, TRANSFORMER[0]);
    p.px.rect(x + 2, top + 3, 1, 6, TRANSFORMER[2]);
    p.px.rect(x - 2, top + 2, 5, 1, TRANSFORMER[2]);
    p.px.rect(x - 2, top + 9, 5, 1, TRANSFORMER[2]);
  } else if (variant % 3 === 2) {
    // The three-leg arm of the rural line: a second, shorter crossarm below, offset the other way.
    const arm2 = 2;
    p.px.rect(x + 2, top + 5, arm2 * 2 + 1, 1, POLE_WOOD[0]);
    p.px.rect(x + 2, top + 6, arm2 * 2 + 1, 1, POLE_WOOD[2]);
    p.px.rect(x + 2 + arm2, top + 3, 1, 2, CERAMIC);
    p.px.set(x + 2 + arm2, top + 3, shade(CERAMIC, 0.82));
  }
  return { px: p.px, ax: p.ax, ay: p.ay, attach: [x - p.ax, top - 1 - p.ay] };
}

/** Paints the concrete pole on its own canvas, without turning it into a sprite. */
function paintPoleConcrete(variant: number): { px: Pixels; ax: number; ay: number; attach: [number, number] } {
  const p = pen(30);
  const u = 0.5;
  const v = 0.5;
  const h = 22;
  const [bx, by] = p.P(u, v, 0);
  const px = Math.round(bx);
  const py = Math.round(by);
  // The shadow on the ground, towards the lower right like every other shadow of the city.
  p.px.shadow(
    [
      [px - 4, py],
      [px, py - 2],
      [px + 4, py],
      [px, py + 2],
    ],
    0.3,
  );
  // The pad and the pad's edge: without a foot a post floats over the grass.
  p.px.rect(px - 3, py - 1, 7, 2, POLE_CONCRETE[2]);
  p.px.rect(px - 3, py - 2, 7, 1, POLE_CONCRETE[1]);
  // The post: three pixels wide, lit on the left, in the shadow on the right, so it has volume.
  p.px.rect(px - 1, py - h, 1, h - 1, POLE_CONCRETE[0]);
  p.px.rect(px, py - h, 1, h - 1, POLE_CONCRETE[1]);
  p.px.rect(px + 1, py - h, 1, h - 1, POLE_CONCRETE[2]);
  // The joints of the concrete, and the plate with the number of the post.
  for (let k = 5; k < h - 3; k += 5) {
    p.px.set(px, py - k, shade(POLE_CONCRETE[2], 0.82));
    p.px.set(px - 1, py - k, shade(POLE_CONCRETE[1], 0.9));
  }
  if (variant % 3 !== 2) p.px.rect(px - 1, py - 9, 2, 2, CHALK_WHITE);
  crossarm(p, u, v, h, variant % 3 === 2 ? 5 : 4);
  if (variant % 3 === 2) crossarm(p, u, v, h - 5, 4, 1);
  // A transformer hanging on the post, on the variant that carries one: the tank, its lid and the
  // bracket that holds it up.
  if (variant % 3 === 1) {
    p.px.line([px + 2, py - h + 3], [px + 5, py - h + 6], POLE_CONCRETE[2]);
    p.px.rect(px + 2, py - h + 6, 6, 7, TRANSFORMER[1]);
    p.px.rect(px + 2, py - h + 6, 2, 7, TRANSFORMER[0]);
    p.px.rect(px + 7, py - h + 6, 1, 7, TRANSFORMER[2]);
    p.px.rect(px + 3, py - h + 5, 4, 1, shade(TRANSFORMER[2], 0.7));
    p.px.rect(px + 2, py - h + 12, 6, 1, TRANSFORMER[2]);
  }
  const [axTop, ayTop] = p.P(u, v, h);
  return { px: p.px, ax: p.ax, ay: p.ay, attach: [Math.round(axTop) - p.ax, Math.round(ayTop) - 1 - p.ay] };
}

const poleCache = new Map<string, Sprite>();

/** Where the cable hangs from, per quality of line, relative to the sprite's anchor. */
const POLE_ATTACH: [number, number][] = [paintPoleWood(0).attach, paintPoleConcrete(0).attach];

/** The attach point of the pole of a quality, for the far end of a cable (see `drawWires`). */
export function poleAttach(tier: number): [number, number] {
  return POLE_ATTACH[tier === 1 ? 1 : 0];
}

/** Paints a pole of the grid: the wooden one for the base quality, the concrete one for the improvement. */
export function paintPole(tier: number, variant: number): { px: Pixels; ax: number; ay: number; attach: [number, number] } {
  const v = ((variant % 3) + 3) % 3;
  return tier === 1 ? paintPoleConcrete(v) : paintPoleWood(v);
}

/** The sprite of a pole, keyed by quality and variant. */
export function polePixelSprite(tier: number, variant: number): Sprite {
  const t = tier === 1 ? 1 : 0;
  const v = ((variant % 3) + 3) % 3;
  const key = `${t}:${v}`;
  let sprite = poleCache.get(key);
  if (!sprite) {
    const painted = paintPole(t, v);
    sprite = { ...spriteOf(painted), attach: painted.attach };
    poleCache.set(key, sprite);
  }
  return sprite;
}

/**
 * One tree of the map. The species is the terrain's own number: 1 jacarandá, 2 palo borracho, 3 ombú and
 * 4 eucalipto, and each one is told apart by its silhouette and not by its colour, because at this size
 * the colour is the last thing that arrives. The crown is five pixels over the trunk on the smallest side,
 * which is what makes a tree read as a tree and not as a bush.
 */
function treeAt(p: Pen, u: number, v: number, kind: number, scale: number, z = 0): void {
  const [x, y] = p.P(u, v, z);
  const cx = Math.round(x);
  const cy = Math.round(y);
  const s = scale;
  p.px.shadow(
    [
      [cx - Math.round(6 * s), cy],
      [cx, cy - Math.round(3 * s)],
      [cx + Math.round(6 * s), cy],
      [cx, cy + Math.round(3 * s)],
    ],
    0.28,
  );
  if (kind === 4) {
    // Eucalipto: tall and narrow, the crown hugging the trunk and starting low.
    p.px.rect(cx, cy - Math.round(12 * s), 2, Math.round(12 * s), TRUNK_DARK);
    p.px.set(cx, cy - Math.round(12 * s), shade(TRUNK_DARK, 1.5));
    // The crown starts over the trunk and is a touch wider than the trunk on both sides: a eucalyptus is
    // tall and narrow, but it is still a crown on a trunk and not a green post.
    p.px.blob(cx, cy - Math.round(16 * s), 4 * s, 6.5 * s, [shade(CROWN_EUCALYPTUS[0], 1.2), CROWN_EUCALYPTUS[1], CROWN_EUCALYPTUS[2]], shade(CROWN_EUCALYPTUS[2], 0.85), false);
    p.px.blob(cx - Math.round(1 * s), cy - Math.round(21 * s), 2.6 * s, 2.8 * s, [CROWN_EUCALYPTUS[0], CROWN_EUCALYPTUS[1], CROWN_EUCALYPTUS[2]], null, false);
    return;
  }
  if (kind === 2) {
    // Palo borracho: the swollen green trunk is the tree, and the flowers sit on top of it.
    const trunk = Math.round(9 * s);
    p.px.rect(cx - 1, cy - trunk, 3, trunk, CROWN_OMBU[1]);
    p.px.rect(cx - 2, cy - Math.round(trunk * 0.65), 5, Math.round(trunk * 0.65), CROWN_OMBU[1]);
    p.px.rect(cx - 2, cy - Math.round(trunk * 0.65), 1, Math.round(trunk * 0.65), CROWN_OMBU[0]);
    p.px.set(cx + 2, cy - Math.round(trunk * 0.5), CROWN_OMBU[2]);
    p.px.blob(cx, cy - trunk - Math.round(3 * s), 4 * s, 3 * s, [shade(CROWN_PALO[0], 1.18), CROWN_PALO[1], CROWN_PALO[2]], shade(CROWN_PALO[2], 0.85), false);
    p.px.set(cx + 2, cy - trunk - Math.round(5 * s), CROWN_PALO[0]);
    return;
  }
  const tall = Math.round(8 * s);
  p.px.rect(cx, cy - tall, 2, tall, TRUNK_DARK);
  p.px.set(cx, cy - tall, shade(TRUNK_DARK, 1.4));
  if (kind === 3) {
    // Ombú: wide and low, wider than tall, with the crown sitting right over the trunk.
    p.px.rect(cx - 1, cy - Math.round(tall * 0.55), 4, Math.round(tall * 0.55), TRUNK_DARK);
    p.px.blob(cx, cy - tall - Math.round(5 * s), 8 * s, 4.6 * s, [shade(CROWN_OMBU[0], 1.25), CROWN_OMBU[1], CROWN_OMBU[2]], shade(CROWN_OMBU[2], 0.8), false);
    p.px.blob(cx - Math.round(4 * s), cy - tall - Math.round(7 * s), 3.5 * s, 2.4 * s, [CROWN_OMBU[0], CROWN_OMBU[1], CROWN_OMBU[2]], null, false);
    return;
  }
  // Jacarandá: the round crown of lilac flowers, with some of them fallen on the ground.
  p.px.blob(cx, cy - tall - Math.round(4 * s), 6 * s, 5.4 * s, [shade(CROWN_JACARANDA[0], 1.18), CROWN_JACARANDA[1], CROWN_JACARANDA[2]], shade(CROWN_JACARANDA[2], 0.82), false);
  p.px.blob(cx - Math.round(3 * s), cy - tall - Math.round(7 * s), 3.4 * s, 2.6 * s, [shade(CROWN_JACARANDA[0], 1.1), CROWN_JACARANDA[1], CROWN_JACARANDA[2]], null, false);
  p.px.set(cx - Math.round(5 * s), cy + 1, CROWN_JACARANDA[1]);
  p.px.set(cx + Math.round(4 * s), cy + 2, CROWN_JACARANDA[2]);
  p.px.set(cx - Math.round(2 * s), cy + 3, CROWN_JACARANDA[1]);
}

/** Where the trees of a cell stand: the same three spots the canvas art uses, kept inside the diamond. */
const TREE_SPOTS: [number, number][] = [
  [0.3, 0.36],
  [0.62, 0.64],
  [0.38, 0.74],
];

/** Paints the trees of one cell: one to three of them, as many as the variant asks for. */
export function paintTree(kind: number, variant: number): { px: Pixels; ax: number; ay: number } {
  const v = ((variant % 6) + 6) % 6;
  const p = pen(28);
  const count = 1 + (v % 3);
  for (let k = 0; k < count; k++) {
    const [u, w] = TREE_SPOTS[(k + v) % 3];
    // A tree of the same cell may be a different species, as it was in the canvas art: a grove of one
    // species everywhere reads as a stamp.
    const species = k === 2 && kind !== 4 ? ((kind % 4) + 1) : kind;
    treeAt(p, u, w, species, 0.85 + 0.1 * ((v + k) % 3));
  }
  return { px: p.px, ax: p.ax, ay: p.ay };
}

const treePixelCache = new Map<string, Sprite>();

/** The sprite of the trees of a cell, keyed by species and variant. */
export function treePixelSprite(kind: number, variant: number): Sprite {
  const key = `${kind}:${((variant % 6) + 6) % 6}`;
  let sprite = treePixelCache.get(key);
  if (!sprite) {
    sprite = spriteOf(paintTree(((kind - 1) % 4) + 1, variant));
    treePixelCache.set(key, sprite);
  }
  return sprite;
}

/* ---------- El Calvario de Tandil ---------- */

/** El verde de la loma y el del corte: los dos tonos del cerro. */
const HILL = ramp('#6f9a4a');
const HILL_CUT = ramp('#4f7038');

const CALVARIO_MAX_Z = 74;

/**
 * El Calvario (3x6): la escalinata del Via Crucis que sube el cerro en tramos rectos hasta la cruz alta.
 *
 * Es el Calvario de Tandil y no un monte genérico, y lo que lo hace reconocible es **el eje**: una
 * escalinata ancha y larga que sale del pie del lote y termina en la cruz. La versión anterior subía en
 * zigzag por un cerro redondo y la cruz quedaba de costado, así que a un píxel se leía como una loma con
 * un palo y no como una peregrinación.
 *
 * Dos cosas la hacen legible. La primera es el **contraste**: la escalinata va en la piedra más clara del
 * lote y el cerro en verde oscuro, así que el corredor se ve desde lejos, que es como se ve en la foto.
 * Con la escalera en el mismo gris del terreno todo se juntaba en una mancha. La segunda es la
 * **granularidad**: el terreno sube en ocho tramos bajos y no en cuatro altos, porque cuatro escalones de
 * nueve píxeles se leen como una escalera de cuatro escalones y no como un cerro.
 *
 * Datos del de verdad, en la ficha del monumento: 96 peldaños, la cruz de 17 metros que proyectó Bustillo,
 * el Cristo de piedra traído de Francia y las estaciones a los costados del camino.
 */
function paintCalvarioOn(p: Pen, vw: number, vh: number): void {
  const alongU = vw >= vh;
  const L = Math.max(vw, vh);
  const W = Math.min(vw, vh);
  const uv = (a: number, c: number): [number, number] => (alongU ? [a, c] : [c, a]);
  // `a` crece hacia la cumbre y **la cumbre va del lado de allá** de la cámara: en las dos orientaciones
  // eso es el extremo con `u + v` más chico, así que el eje se mide al revés. Con la cumbre de este lado,
  // la escalinata subía hacia el jugador y la cruz quedaba en primer plano, que es lo contrario de lo que
  // hace un cerro: el remate se ve al fondo y desde abajo.
  const Q = (a: number, c: number, z: number): Pt => {
    const [u, v] = uv(L - a, c);
    return p.P(u, v, z);
  };
  const cMid = W / 2;
  const H = 32;
  /** Ocho tramos: el terreno sube parejo y la escalinata tiene dónde apoyar sus peldaños. */
  const TERR = 8;
  const cut = Array.from({ length: TERR + 1 }, (_, k) => 0.05 + ((L - 0.1) * k) / TERR);
  const zAt = (k: number): number => (H * k) / TERR;
  /**
   * El ancho del cerro a la altura del tramo `k`: se angosta hacia arriba.
   *
   * Sin esto las huellas de los tramos altos llegaban hasta los dos bordes del lote y, como están treinta
   * píxeles más arriba, en isométrica se dibujaban afuera del rombo: quedaban lenguas de pasto en el aire a
   * los costados del atrio. Un cerro se angosta y así entra solo.
   */
  const edgeAt = (k: number): [number, number] => {
    const inset = 0.52 * (k / TERR);
    return [inset, W - inset];
  };

  /** El ancho de la escalinata, medido en lotes: casi la mitad del lote, como en el cerro de verdad. */
  const sHalf = W * 0.17;
  /** La piedra del camino, más clara que cualquier otra cosa del lote: es lo que hace que se lea. */
  const PATH: Ramp = [hex('#b9b2a0'), hex('#efe9d9'), hex('#fbf6e8')];

  // **La sombra del lote, como la de cualquier edificio.** El Calvario era el único que no la pintaba, con
  // el argumento de que el pasto cubría el rombo entero; y sin sombra que lo una al suelo, un monumento de
  // cuarenta píxeles de alto se lee como una maqueta puesta encima del mapa. Es lo que lo hacía flotar.
  // Adentro del borde y no sobre él: la sombra de lote va corrida hacia la cámara, y al filo del rombo se
  // leía como un marco negro alrededor del pasto.
  p.shadow(0.12, 0.12, L - 0.3, W - 0.12);
  // Y **nada de prado propio**: el mapa ya tiene su pasto, y una alfombra de otro verde encima se lee como
  // una baldosa pegada. El cerro se apoya directamente en el terreno del juego.
  

  // El cerro, tramo por tramo. En cada uno la **ladera** de adelante —verde, con la roca asomando— y la
  // huella de arriba. Los costados no son paredes: la loma se apaga contra el prado en pendiente, y si no
  // el monumento parece un edificio de piedra con jardín en vez de un cerro.
  for (let k = TERR - 1; k >= 0; k--) {
    const a0 = cut[k];
    const a1 = cut[k + 1];
    const z0 = zAt(k);
    const z1 = zAt(k + 1);
    // Las laderas laterales, **en pendiente hasta el borde del lote**: el cerro muere en el pasto del mapa
    // y no termina en una pared recta. Con el talud vertical el conjunto parecía una meseta elevada.
    const [l0, r0] = edgeAt(k);
    const [l1, r1] = edgeAt(k + 1);
    for (const [cb, ct, cn] of [
      [0, l1, l0],
      [W, r1, r0],
    ] as [number, number, number][]) {
      p.poly([Q(a0, cb, 0), Q(a1, cb, 0), Q(a1, ct, z1), Q(a0, cn, z0)], (x, y) => {
        // La roca asoma en la ladera, pero con cuentagotas: a una de cada veinte se ve como una salpicadura
        // de pintura blanca y no como piedra.
        const g = noise(x * 1.3, y * 1.7, 7);
        if (g > 0.975) return shade(STONE[1], 1.02);
        return g > 0.55 ? shade(HILL[1], 1.04) : shade(HILL_CUT[1], 0.97);
      });
    }
    // La ladera de adelante, con la roca a la vista en el medio y el pasto en los bordes: es el corte que
    // el camino atraviesa, y el mismo tono de la foto, piedra gris entre el verde.
    p.poly([Q(a0, l0, z0), Q(a0, r0, z0), Q(a0, r1, z1), Q(a0, l1, z1)], (x, y) => {
      const g = noise(x, y * 2, 9);
      if (g > 0.8) return shade(STONE[0], 1.14);
      if (bayer(x, y) < 0.4) return shade(HILL_CUT[0], 0.9);
      return shade(HILL_CUT[1], 0.98);
    });
    // La huella: pasto, salvo la franja del camino, que se pinta después y por encima.
    p.poly([Q(a0, l1, z1), Q(a1, l1, z1), Q(a1, r1, z1), Q(a0, r1, z1)], (x, y) =>
      noise(x, y * 1.7, 3) > 0.55 ? HILL[2] : HILL[1],
    );
  }

  // La escalinata. Peldaños de un píxel escaso, cuatro por tramo: la huella clara arriba y la
  // contrahuella en sombra abajo, que es lo único que hace que una banda clara se lea como escalones.
  const PER = 4;
  for (let k = TERR - 3; k >= 0; k--) {
    const a0 = cut[k];
    const a1 = cut[k + 1];
    const z0 = zAt(k);
    const dz = (zAt(k + 1) - z0) / PER;
    for (let i = 0; i < PER; i++) {
      const sa = a0 + ((a1 - a0) * i) / PER;
      const sb = a0 + ((a1 - a0) * (i + 1)) / PER;
      const z = z0 + dz * i;
      p.poly([Q(sa, cMid - sHalf, z + dz), Q(sb, cMid - sHalf, z + dz), Q(sb, cMid + sHalf, z + dz), Q(sa, cMid + sHalf, z + dz)], (x, y) =>
        bayer(x, y) < 0.18 ? shade(PATH[1], 1.04) : PATH[1],
      );
      // La contrahuella, oscura: es la única línea que hace que una cinta clara se lea como escalones y
      // no como una rampa de cemento.
      p.poly([Q(sb, cMid - sHalf, z), Q(sb, cMid + sHalf, z), Q(sb, cMid + sHalf, z + dz), Q(sb, cMid - sHalf, z + dz)], () =>
        shade(PATH[0], 0.86),
      );
    }
  }
  // Los pretiles: un píxel de piedra a cada lado del camino, del pie al atrio. Marcan el borde de la
  // escalinata sin taparla, y son lo que le da la escala de corredor.
  for (const c of [cMid - sHalf, cMid + sHalf]) {
    for (let k = TERR - 3; k >= 0; k--) {
      const a0 = cut[k];
      const a1 = cut[k + 1];
      const z0 = zAt(k);
      const z1 = zAt(k + 1);
      p.poly([Q(a0, c, z0), Q(a1, c, z0), Q(a1, c, z1), Q(a0, c, z1)], () => shade(PATH[2], 0.9));
    }
  }

  // Las estaciones, a los dos lados y escalonadas: un nicho blanco sobre un pedestal de piedra. Son la
  // prueba de que esto es un Via Crucis y no una escalera cualquiera, así que van parejas.
  const stationAt = (a: number, side: number): void => {
    const k = Math.min(TERR - 1, Math.max(0, cut.findIndex((v) => a < v) - 1));
    const z = zAt(k + 1);
    const [x, y] = Q(a, cMid + side * (sHalf + 0.3), z);
    const ix = Math.round(x);
    const iy = Math.round(y);
    p.px.rect(ix - 1, iy - 2, 3, 2, shade(STONE[1], 0.88));
    p.px.rect(ix - 1, iy - 6, 3, 4, PLASTER[1]);
    p.px.set(ix - 1, iy - 6, shade(PLASTER[1], 0.84));
    p.px.set(ix + 1, iy - 3, shade(PLASTER[1], 0.68));
    p.px.set(ix, iy - 5, shade(INSIDE, 0.92));
  };
  for (const [a, s] of [
    [0.6, -1],
    [0.9, 1],
    [1.9, -1],
    [2.2, 1],
    [3.3, -1],
    [3.6, 1],
    [4.6, -1],
    [4.9, 1],
  ] as [number, number][]) {
    stationAt(a, s);
  }

  // El ciprés: la columna verde oscura que enmarca el camino en el cerro de verdad, y el único verde
  // oscuro del lote. Va fino —tres píxeles— porque a cinco es un poste, y con la punta en aguja.
  const cypress = (a: number, c: number, s: number): void => {
    const k = Math.min(TERR - 1, Math.max(0, cut.findIndex((v) => a < v) - 1));
    const [x, y] = Q(a, c, zAt(k + 1));
    const cx = Math.round(x);
    const cy = Math.round(y);
    const tall = Math.round(17 * s);
    for (let i = 0; i < tall; i++) {
      const t = i / tall;
      // La copa: angosta abajo, más ancha al medio y en aguja arriba.
      const w = t < 0.12 ? 1 : t > 0.72 ? Math.max(0, Math.round(2.4 * (1 - (t - 0.72) / 0.28))) : 2;
      if (w <= 0) continue;
      const tone = 0.66 + 0.3 * (1 - Math.abs(t - 0.4) * 1.4);
      p.px.rect(cx - w, cy - i, w * 2 + 1, 1, shade(CROWN_EUCALYPTUS[2], tone * 0.8));
      p.px.set(cx + w, cy - i, shade(CROWN_EUCALYPTUS[2], tone * 0.62));
      p.px.set(cx - w, cy - i, shade(CROWN_EUCALYPTUS[2], tone * 1.1));
    }
    p.px.rect(cx, cy, 1, 2, TRUNK_DARK);
  };
  for (const [a, s, k] of [
    [0.45, -1, 0.8],
    [0.55, 1, 0.8],
    [1.5, -1, 0.9],
    [1.6, 1, 0.9],
    [2.9, -1, 1],
    [3.0, 1, 1],
    [4.2, -1, 1.1],
    [4.3, 1, 1.1],
    [4.9, -1, 1.15],
    [5.0, 1, 1.15],
  ] as [number, number, number][]) {
    cypress(a, cMid + s * (sHalf + 0.62), k);
  }

  // El monte de los costados y del fondo: los árboles de la sierra, fuera del corredor del camino.
  const wood: [number, number][] = [
    [0.5, 0.22],
    [1.2, W - 0.24],
    [2.4, 0.2],
    [3.2, W - 0.22],
    [4.4, 0.24],
    [5.1, W - 0.26],
    [5.5, 0.5],
    [5.55, W - 0.5],
  ];
  wood.sort((A, B) => A[0] + A[1] - (B[0] + B[1]));
  wood.forEach(([a, c], i) => {
    const k = Math.min(TERR - 1, Math.max(0, cut.findIndex((v) => a < v) - 1));
    const [u, v] = uv(L - a, c);
    treeAt(p, u, v, i % 2 === 0 ? 4 : 3, 0.72 + 0.05 * (i % 3), zAt(k + 1));
  });

  // El atrio: la explanada de piedra donde termina la escalinata y se para la cruz. Chico y adentro del
  // lote: más grande se salía del rombo y quedaba una planchada flotando sobre el pasto del vecino.
  // El atrio ocupa el último tramo entero y es **más angosto que el lote**: es la explanada del remate y
  // no una planchada que cruza de lado a lado.
  const aTop0 = cut[TERR - 2];
  const aTop1 = cut[TERR] - 0.2;
  const zTop = H;
  p.poly([Q(aTop0, 0.85, zTop), Q(aTop1, 0.85, zTop), Q(aTop1, W - 0.85, zTop), Q(aTop0, W - 0.85, zTop)], (x, y) =>
    bayer(x, y) < 0.25 ? shade(PATH[1], 1.02) : PATH[1],
  );
  // El escalón del atrio, en la cara que da al camino.
  p.poly([Q(aTop0, 0.85, zTop - 2), Q(aTop0, W - 0.85, zTop - 2), Q(aTop0, W - 0.85, zTop), Q(aTop0, 0.85, zTop)], () =>
    shade(PATH[0], 0.94),
  );

  // La cruz. Alta y de piedra clara, sobre un basamento, con el Cristo en sombra sobre el palo: a un
  // píxel el contraste es lo que hace que la figura se lea y no que sea una mancha más.
  {
    const aC = aTop0 + (aTop1 - aTop0) * 0.58;
    const [bx, by] = Q(aC, cMid, zTop);
    const cx = Math.round(bx);
    const cy = Math.round(by);
    // El basamento de roca: dos dados, el de abajo más ancho.
    p.px.rect(cx - 4, cy - 2, 9, 2, shade(STONE[1], 0.94));
    p.px.rect(cx - 4, cy - 2, 9, 1, shade(STONE[2], 1.08));
    p.px.rect(cx - 2, cy - 4, 5, 2, shade(STONE[1], 1.02));
    p.px.rect(cx - 2, cy - 4, 5, 1, shade(PATH[1], 0.98));
    const H_CROSS = 24;
    const armUp = Math.round(H_CROSS * 0.8);
    const arm = 5;
    const yBase = cy - 4;
    // El palo: tres píxeles, el carril claro y el filo de la derecha en sombra.
    p.px.rect(cx - 1, yBase - H_CROSS, 3, H_CROSS, PATH[2]);
    p.px.rect(cx + 1, yBase - H_CROSS, 1, H_CROSS, shade(PATH[0], 1.02));
    // El travesaño, con el remate de arriba más corto: la cruz latina y no la de cuatro brazos iguales.
    p.px.rect(cx - arm, yBase - armUp, arm * 2 + 3, 2, PATH[2]);
    p.px.rect(cx - arm, yBase - armUp, arm * 2 + 3, 1, PATH[1]);
    p.px.rect(cx + arm, yBase - armUp, 1, 2, shade(PATH[0], 1.02));
    // El cartel del INRI, arriba del todo.
    p.px.rect(cx - 2, yBase - H_CROSS - 2, 5, 2, shade(PATH[1], 0.9));
    // El Cristo: la silueta oscura **pegada al travesaño**, no flotando tres píxeles más abajo. Los
    // brazos van en la fila de abajo del madero y el cuerpo cuelga del centro.
    const yArm = yBase - armUp + 1;
    p.px.rect(cx - arm + 1, yArm, arm * 2 - 1, 1, shade(INSIDE, 1.45));
    p.px.rect(cx, yArm, 1, 5, shade(INSIDE, 1.4));
    p.px.rect(cx, yArm - 2, 1, 2, shade(INSIDE, 1.5));
    p.px.rect(cx - 1, yArm + 5, 3, 1, shade(INSIDE, 1.35));
  }
}

/** Paints el Calvario on the lot the camera sees: 3x6 or 6x3. */
export function paintCalvario(vw: number, vh: number): { px: Pixels; ax: number; ay: number; smoke: [number, number][] } {
  const p = penRect(vw, vh, CALVARIO_MAX_Z);
  paintCalvarioOn(p, vw, vh);
  return { px: p.px, ax: p.ax, ay: p.ay, smoke: p.smoke };
}

const OBELISCO_MAX_Z = 120;

/** La piedra del fuste: casi blanca, con el filo iluminado y la cara del costado en sombra. */
const MARBLE: Ramp = [hex('#c9c3b4'), hex('#f6f1e6'), hex('#efe9da')];

/**
 * El Obelisco (2x2): la plaza de la República con sus dos escalones y sus cuatro faroles, y el fuste de
 * cuatro caras planas que remata en el piramidión filoso. El fuste **no se angosta** —el de verdad son
 * cuatro caras planas— así que se pinta como dos quads y no como una escalera de cajas.
 */
function paintObeliscoOn(p: Pen, vw: number, vh: number): void {
  const cx = vw / 2;
  const cy = vh / 2;
  // La plaza: dos escalones de piedra, el de abajo más gastado y el de arriba más claro.
  p.box(0.03, 0.03, vw - 0.03, vh - 0.03, 0, 2, STONE_LIGHT, 'plain', [], [], hex('#c5bfb0'));
  p.box(0.26, 0.26, vw - 0.26, vh - 0.26, 2, 2, STONE_LIGHT, 'plain', [], [], hex('#ded8c9'));
  const lamp = (u: number, v: number) => {
    const [x, y] = p.P(u, v, 4);
    const ix = Math.round(x);
    const iy = Math.round(y);
    p.px.rect(ix, iy - 12, 1, 12, LEG);
    p.px.rect(ix - 1, iy - 15, 3, 3, LAMP);
    p.px.set(ix - 1, iy - 15, BEAM);
    p.px.set(ix + 1, iy - 14, shade(LAMP, 0.78));
  };
  // Tres faroles: el de la esquina de atrás cae justo detrás del fuste y no se ve, así que no se pinta.
  // Los del costado van antes que el fuste y el de adelante después, que es el orden de la cámara.
  lamp(vw - 0.3, 0.3);
  lamp(0.3, vh - 0.3);

  const z0 = 6;
  const zTop = z0 + 94;
  const hb = 0.36;
  // El zócalo: un dado apenas más ancho que el fuste, para que la piedra no salga cortando la plaza.
  p.box(cx - 0.46, cy - 0.46, cx + 0.46, cy + 0.46, 4, 2, MARBLE, 'plain', [], [], hex('#e6e0d2'));
  // La cara que da a la cámara (span en u) y la del costado (span en v). La primera toma la luz y la
  // segunda queda en sombra: sin ese contraste el fuste se lee como un rectángulo blanco.
  p.poly(
    [p.P(cx - hb, cy + hb, z0), p.P(cx + hb, cy + hb, z0), p.P(cx + hb, cy + hb, zTop), p.P(cx - hb, cy + hb, zTop)],
    (x, y) => (noise(x, y * 3, 9) > 0.93 ? shade(MARBLE[1], 0.95) : MARBLE[1]),
  );
  p.poly(
    [p.P(cx + hb, cy + hb, z0), p.P(cx + hb, cy - hb, z0), p.P(cx + hb, cy - hb, zTop), p.P(cx + hb, cy + hb, zTop)],
    (x, y) => (noise(x, y * 2, 7) > 0.9 ? shade(MARBLE[2], 0.92) : shade(MARBLE[2], 0.84)),
  );
  // El filo del vértice: una línea iluminada donde se encuentran las dos caras, y el otro filo oscuro.
  p.px.line(p.P(cx + hb, cy + hb, z0), p.P(cx + hb, cy + hb, zTop), shade(MARBLE[1], 1.1));
  p.px.line(p.P(cx - hb, cy + hb, z0), p.P(cx - hb, cy + hb, zTop), shade(MARBLE[2], 0.7));
  // La puerta al pie, en la cara de la cámara, y las dos ventanitas de arriba, una por cara visible.
  {
    const [dx, dy] = p.P(cx, cy + hb, z0);
    const ix = Math.round(dx);
    const iy = Math.round(dy);
    p.px.rect(ix - 1, iy - 7, 4, 7, INSIDE);
    p.px.rect(ix - 1, iy - 8, 4, 1, shade(MARBLE[2], 0.7));
    p.px.set(ix + 2, iy - 7, shade(MARBLE[1], 0.9));
    const [wx, wy] = p.P(cx, cy + hb, zTop - 9);
    p.px.rect(Math.round(wx) - 1, Math.round(wy) - 3, 2, 4, INSIDE);
    const [sx, sy] = p.P(cx + hb, cy, zTop - 9);
    p.px.rect(Math.round(sx), Math.round(sy) - 3, 2, 4, INSIDE);
  }
  // El piramidión: dos triángulos, el de la cámara iluminado y el del costado en sombra, con la arista
  // del vértice marcada. Es alto y filoso como el de verdad, y la antena lo cierra.
  const apex: Pt = p.P(cx, cy, zTop + 13);
  p.poly([p.P(cx - hb, cy + hb, zTop), p.P(cx + hb, cy + hb, zTop), apex], (x, y) =>
    noise(x, y * 2, 5) > 0.9 ? shade(MARBLE[1], 0.9) : MARBLE[1],
  );
  p.poly([p.P(cx + hb, cy + hb, zTop), p.P(cx + hb, cy - hb, zTop), apex], () => shade(MARBLE[2], 0.8));
  p.px.line(p.P(cx + hb, cy + hb, zTop), apex, shade(MARBLE[1], 1.14));
  const [ax, ay] = apex;
  p.px.rect(Math.round(ax), Math.round(ay) - 6, 1, 6, LEG);
  p.px.set(Math.round(ax) - 1, Math.round(ay) - 5, LEG);

  // El farol de adelante va último: está delante de todo.
  lamp(vw - 0.3, vh - 0.3);
}

/** Paints el Obelisco on the lot the camera sees: 2x2. */
export function paintObelisco(vw: number, vh: number): { px: Pixels; ax: number; ay: number; smoke: [number, number][] } {
  const p = penRect(vw, vh, OBELISCO_MAX_Z);
  paintObeliscoOn(p, vw, vh);
  return { px: p.px, ax: p.ax, ay: p.ay, smoke: p.smoke };
}

const obeliscoCache = new Map<string, Sprite>();

/** El Obelisco as a sprite. */
export function obeliscoPixelSprite(vw: number, vh: number): Sprite {
  const key = `${vw}x${vh}`;
  let sprite = obeliscoCache.get(key);
  if (!sprite) {
    sprite = spriteOf(paintObelisco(vw, vh));
    obeliscoCache.set(key, sprite);
  }
  return sprite;
}

const PUENTE_MAX_Z = 62;

/** El acero del transbordador: una chapa galvanizada, que a 1× se lee por el filo y no por el tono. */
const BRIDGE_STEEL: Ramp = ramp('#9aa6ae');
const BRIDGE_DARK = hex('#39424a');
/** El agua del Riachuelo: más verde y más sucia que el río de la costa. */
const RIVER = hex('#3f7f78');
const RIVER_LIGHT = hex('#5fa79b');
const RIVER_GLINT = hex('#8fc9bd');
/**
 * El Puente Transbordador Nicolás Avellaneda (2x6): dos torres de celosía apenas abocinadas sobre sus
 * pilas de mampostería en el agua, y la viga alta que las une, con su canto y sus cruces. **No lleva
 * barca**: el pedido fue la forma del puente, y la barca roja y blanca en el medio se comía el dibujo.
 * Pocos miembros a propósito: una celosía densa a 1× es una mancha gris. El puente pinta su propio río,
 * así que el agua y los dos muros son parte del dibujo.
 */
function paintPuenteOn(p: Pen, vw: number, vh: number): void {
  const alongU = vw >= vh;
  const L = Math.max(vw, vh);
  const W = Math.min(vw, vh);
  const uv = (a: number, c: number): [number, number] => (alongU ? [a, c] : [c, a]);
  const Q = (a: number, c: number, z: number): Pt => {
    const [u, v] = uv(a, c);
    return p.P(u, v, z);
  };
  const boxAC = (a0: number, c0: number, a1: number, c1: number, z: number, h: number, base: Ramp, tex: Tex = 'plain') => {
    const [u0, v0] = uv(Math.min(a0, a1), Math.min(c0, c1));
    const [u1, v1] = uv(Math.max(a0, a1), Math.max(c0, c1));
    p.box(Math.min(u0, u1), Math.min(v0, v1), Math.max(u0, u1), Math.max(v0, v1), z, h, base, tex);
  };
  const line = (a0: number, c0: number, z0: number, a1: number, c1: number, z1: number, c: RGB) => {
    p.px.line(Q(a0, c0, z0), Q(a1, c1, z1), c);
  };

  // El río, primero, bajo los dos muros: el agua se ve entre ellos y el puente la cruza.
  p.poly([Q(0, 0, -2), Q(L, 0, -2), Q(L, W, -2), Q(0, W, -2)], (x, y) => {
    const n = noise(x, y, 5);
    return n > 0.88 ? RIVER_LIGHT : RIVER;
  });
  // Los dos muros de piedra, con el borde oscuro donde toca el agua y el pretil arriba.
  const bank = 0.66;
  for (const a0 of [0, L - bank]) {
    boxAC(a0, 0, a0 + bank, W, -2, 5, QUAY);
    boxAC(a0 + 0.06, 0.06, a0 + bank - 0.06, W - 0.06, 3, 1.6, QUAY, 'plain');
    // Las hiladas de piedra en la cara que da al agua, o el muro es una losa lisa.
    for (const z of [0.6, 2.2]) {
      line(a0 + (a0 === 0 ? bank : 0), 0.04, z, a0 + (a0 === 0 ? bank : 0), W - 0.04, z, shade(QUAY[2], 0.72));
    }
  }
  // Tres brillos en el agua y el bote de remos del Riachuelo: sin ellos el río es una franja azul.
  for (const [a, c, w] of [
    [1.9, 1.45, 2],
    [3.1, 0.55, 3],
    [4.5, 1.35, 2],
  ]) {
    const [x, y] = Q(a, c, -1.6);
    p.px.rect(Math.round(x) - w, Math.round(y), w * 2, 1, RIVER_GLINT);
  }
  {
    const [bx, by] = Q(1.75, 0.72, -1.2);
    p.px.rect(Math.round(bx) - 3, Math.round(by) - 1, 6, 2, WOOD_DARK[1]);
    p.px.rect(Math.round(bx) - 2, Math.round(by) - 2, 4, 1, WOOD[1]);
  }

  // Las dos pilas de mampostería: el puente de verdad no apoya las torres en el muro, las apoya en dos
  // pilas que se meten en el río. Sin ellas las torres nacen del agua como postes clavados.
  const aNear = 0.62;
  const aFar = L - 0.62;
  for (const a of [aNear, aFar]) {
    boxAC(a - 0.3, 0.1, a + 0.36, W - 0.1, -2, 8.4, QUAY);
    boxAC(a - 0.34, 0.06, a + 0.4, W - 0.06, 7, 1.4, QUAY, 'plain');
    // El borde oscuro donde la pila toca el agua: es lo que la asienta.
    line(a + (a === aNear ? 0.36 : -0.3), 0.12, -1.4, a + (a === aNear ? 0.36 : -0.3), W - 0.12, -1.4, shade(QUAY[2], 0.66));
  }

  const cLow = 0.4;
  const cHigh = W - 0.4;
  const zFoot = 7;
  const zHead = 54;
  // El canto de la viga es un octavo del tramo: con quince píxeles —lo que tenía— la viga se lee como
  // una pared y las torres quedan flacas al lado de ella.
  const trussLow = 42;
  const trussHigh = 52;

  /** Una pata: se abocina, así que es una línea y no una columna, con la cara iluminada a la izquierda. */
  const leg = (a: number, c0: number, c1: number) => {
    const A = Q(a, c0, zFoot);
    const B = Q(a, c1, zHead);
    p.px.line(A, B, shade(BRIDGE_STEEL[1], 1.12));
    p.px.line([A[0] + 1, A[1]], [B[0] + 1, B[1]], shade(BRIDGE_STEEL[1], 0.9));
    p.px.line([A[0] + 2, A[1]], [B[0] + 2, B[1]], shade(BRIDGE_STEEL[2], 0.82));
  };

  /** Una torre: dos patas abocinadas, cinco travesaños y una cruz por vano. Toda la celosía que aguanta el 1×. */
  const tower = (a: number) => {
    // Abocinadas al revés de lo que sale por instinto: **más anchas abajo**. Una torre que se ensancha
    // hacia arriba se ve parada sobre la punta de un alfiler.
    const taper = 0.12;
    leg(a, cLow - taper, cLow);
    leg(a, cHigh + taper, cHigh);
    const levels = [zFoot + 1.4, 18, 27, 36];
    for (const [i, z] of levels.entries()) {
      const t = (z - zFoot) / (zHead - zFoot);
      const l0 = cLow - taper * (1 - t);
      const l1 = cHigh + taper * (1 - t);
      line(a, l0, z, a, l1, z, shade(BRIDGE_STEEL[1], 1.02));
      line(a, l0, z + 1, a, l1, z + 1, shade(BRIDGE_STEEL[2], 0.78));
      // La cruz de San Andrés del vano que queda arriba de este travesaño: en oscuro, que es como se lee
      // una celosía a 1×, y sin dithering, que la ensucia.
      const z2 = i < levels.length - 1 ? levels[i + 1] : zHead;
      if (z2 < trussLow) {
        const t2 = (z2 - zFoot) / (zHead - zFoot);
        const m0 = cLow - taper * (1 - t2);
        const m1 = cHigh + taper * (1 - t2);
        line(a, l0 + 0.04, z + 2, a, m1 - 0.04, z2 - 1, shade(BRIDGE_STEEL[1], 0.95));
        line(a, l1 - 0.04, z + 2, a, m0 + 0.04, z2 - 1, shade(BRIDGE_STEEL[1], 0.95));
      }
    }
    // El remate de la punta: un travesaño grueso con el filo de arriba iluminado, que es lo que le da
    // cabeza a la torre.
    line(a, cLow, zHead, a, cHigh, zHead, shade(BRIDGE_STEEL[1], 1.2));
    line(a, cLow, zHead - 1, a, cHigh, zHead - 1, shade(BRIDGE_STEEL[2], 0.8));
  };

  // La torre del fondo primero: la de adelante la tapa, como en la realidad.
  tower(aFar);

  // La viga alta entre las dos torres: dos cordones, los montantes y una cruz por vano. Es una viga
  // llena con la celosía marcada encima; una celosía de alambre sola se lee como una escalera colgada.
  p.poly(
    [Q(aNear, cHigh, trussLow), Q(aFar, cHigh, trussLow), Q(aFar, cHigh, trussHigh), Q(aNear, cHigh, trussHigh)],
    (x, y) => (bayer(x, y) < 0.22 ? shade(BRIDGE_STEEL[1], 0.94) : BRIDGE_STEEL[1]),
  );
  line(aNear, cHigh, trussHigh, aFar, cHigh, trussHigh, shade(BRIDGE_STEEL[1], 1.16));
  line(aNear, cHigh, trussLow, aFar, cHigh, trussLow, shade(BRIDGE_STEEL[2], 0.72));
  // El cordón del fondo se ve por arriba de la viga: dos líneas alcanzan, y una segunda viga llena
  // convertía el tablero en dos tableros paralelos.
  line(aNear, cLow, trussLow, aFar, cLow, trussLow, shade(BRIDGE_STEEL[2], 0.86));
  line(aNear, cLow, trussHigh, aFar, cLow, trussHigh, shade(BRIDGE_STEEL[1], 1.04));
  const bays = 5;
  for (let k = 0; k <= bays; k++) {
    const a = aNear + ((aFar - aNear) * k) / bays;
    line(a, cHigh, trussLow, a, cHigh, trussHigh, shade(BRIDGE_STEEL[2], 0.74));
    line(a, cLow, trussLow, a, cLow, trussHigh, shade(BRIDGE_STEEL[2], 0.8));
    if (k < bays) {
      const a2 = aNear + ((aFar - aNear) * (k + 1)) / bays;
      line(a, cHigh, trussLow + 1, a2, cHigh, trussHigh - 1, BRIDGE_DARK);
      line(a, cHigh, trussHigh - 1, a2, cHigh, trussLow + 1, BRIDGE_DARK);
      line(a, cLow, trussLow + 1, a2, cLow, trussHigh - 1, shade(BRIDGE_DARK, 1.18));
      line(a, cLow, trussHigh - 1, a2, cLow, trussLow + 1, shade(BRIDGE_DARK, 1.18));
    }
  }
  // El riel del carro, pegado abajo del cordón: una línea oscura que dice que de ahí cuelga algo.
  line(aNear, cHigh - 0.02, trussLow - 1, aFar, cHigh - 0.02, trussLow - 1, shade(BRIDGE_DARK, 1.1));

  // La sombra de la viga sobre el agua, antes de la torre de adelante: es lo que termina de decir que el
  // puente pasa por arriba del río y no está apoyado en él.
  p.poly(
    [Q(aNear + 0.1, cLow, -1.9), Q(aFar - 0.1, cLow, -1.9), Q(aFar - 0.1, cHigh + 0.5, -1.9), Q(aNear + 0.1, cHigh + 0.5, -1.9)],
    (x, y) => (bayer(x, y) < 0.5 ? shade(RIVER, 0.72) : null),
  );

  // La torre de adelante, al final: queda delante de la viga.
  tower(aNear);
}

/** Paints the Puente Transbordador on the lot the camera sees: 2x6 or 6x2. */
export function paintPuente(vw: number, vh: number): { px: Pixels; ax: number; ay: number; smoke: [number, number][] } {
  const p = penRect(vw, vh, PUENTE_MAX_Z);
  paintPuenteOn(p, vw, vh);
  return { px: p.px, ax: p.ax, ay: p.ay, smoke: p.smoke };
}

const puenteCache = new Map<string, Sprite>();

/** El Puente Transbordador as a sprite, keyed by the shape of the lot the camera sees. */
export function puentePixelSprite(vw: number, vh: number): Sprite {
  const key = `${vw}x${vh}`;
  let sprite = puenteCache.get(key);
  if (!sprite) {
    sprite = spriteOf(paintPuente(vw, vh));
    puenteCache.set(key, sprite);
  }
  return sprite;
}

const TEATRO_MAX_Z = 62;

/** La piedra del teatro, la mampostería de las columnas y la pizarra del techo. */
const THEATRE_WALL: Ramp = ramp('#f0dcb0');
const THEATRE_STONE: Ramp = ramp('#f2e9d3');
const THEATRE_COLUMN: Ramp = ramp('#fdfaf2');
const THEATRE_LOGGIA = hex('#4d4034');
/** La pizarra del techo del teatro, más azul y más pesada que la losa de las azoteas. */
const ROOF_SLATE: Ramp = [hex('#6d7480'), hex('#5a606a'), hex('#4a5058')];

/**
 * El Teatro (3x3): el pórtico de seis columnas contra la logia oscura, el frontón con el tímpano hundido
 * y la mansarda de pizarra detrás. **El Colón no tiene cúpula**: tiene un techo enorme y pesado, y es lo
 * que lo distingue de un banco con columnas.
 */
function paintTeatroOn(p: Pen, vw: number, vh: number): void {
  const cx = vw / 2;
  const inn = 0.42;
  const x0 = inn;
  const y0 = inn;
  const x1 = vw - inn;
  const y1 = vh - inn;
  // La vereda y el zócalo: el teatro está sobre un basamento de piedra.
  p.box(0.03, 0.03, vw - 0.03, vh - 0.03, 0, 2, STONE_LIGHT, 'plain', [], [], hex('#c5bfb0'));
  p.box(0.2, 0.2, vw - 0.2, vh - 0.2, 2, 2, STONE_LIGHT, 'plain', [], [], hex('#ded8c9'));

  const z0 = 4;
  const H = 26;
  // La casa: tres plantas con las ventanas en la cara del costado. La de adelante la ocupa la logia.
  // Los paños van primero: el primer parche que toca un píxel gana, así que las molduras no los tapan.
  const sidePanes: Patch[] = [];
  for (const z of [6, 13, 20]) {
    for (const t of [5, 15, 25]) {
      sidePanes.push({ t0: t, t1: t + 5, k0: z, k1: z + 5, c: shade(GLASS, 0.86) });
      sidePanes.push({ t0: t, t1: t + 5, k0: z + 5, k1: z + 6, c: shade(THEATRE_STONE[2], 0.72) });
      sidePanes.push({ t0: t + 1, t1: t + 2, k0: z, k1: z + 5, c: shade(GLASS, 1.5) });
    }
  }
  // El zócalo, las cornisas de piso y las pilastras: sin esto la piedra es un plano de un solo color y el
  // teatro se ve liso como una caja de zapatos.
  // El zócalo: dos hiladas de piedra gris, almohadilladas, que le dan base al edificio. Sin él la pared
  // arranca del suelo sin apoyo y todo el bloque se ve liviano.
  sidePanes.push({ t0: 0, t1: 40, k0: 0, k1: 1, c: shade(CONCRETE[1], 1.06) });
  sidePanes.push({ t0: 0, t1: 40, k0: 1, k1: 2, c: shade(CONCRETE[2], 0.84) });
  sidePanes.push({ t0: 0, t1: 40, k0: 2, k1: 3, c: shade(CONCRETE[1], 0.96) });
  for (const z of [11, 18]) {
    sidePanes.push({ t0: 0, t1: 40, k0: z, k1: z + 1, c: shade(THEATRE_STONE[1], 1.12) });
    sidePanes.push({ t0: 0, t1: 40, k0: z + 1, k1: z + 2, c: shade(THEATRE_STONE[2], 0.74) });
  }
  for (const t of [1, 12, 22]) {
    sidePanes.push({ t0: t, t1: t + 2, k0: 2, k1: 25, c: shade(THEATRE_STONE[1], 1.04) });
    sidePanes.push({ t0: t + 2, t1: t + 3, k0: 2, k1: 25, c: shade(THEATRE_STONE[2], 0.8) });
  }
  // La logia: un plano oscuro sobre la cara de adelante. Sin ese fondo, seis columnas claras sobre
  // piedra clara no se leen a 1×.
  const front: Patch[] = [
    { t0: 0, t1: 40, k0: 0, k1: 1, c: shade(CONCRETE[1], 1.06) },
    { t0: 0, t1: 40, k0: 1, k1: 2, c: shade(CONCRETE[2], 0.84) },
    { t0: 0, t1: 40, k0: 2, k1: 3, c: shade(CONCRETE[1], 0.96) },
    { t0: 2, t1: 36, k0: 4, k1: 22, c: THEATRE_LOGGIA },
    { t0: 2, t1: 36, k0: 22, k1: 23, c: shade(THEATRE_STONE[2], 0.72) },
    { t0: 13, t1: 21, k0: 4, k1: 12, c: INSIDE },
  ];
  // La cubierta de arriba es la pizarra del techo, no una losa de piedra.
  p.box(x0, y0, x1, y1, z0, H, THEATRE_WALL, 'plain', front, sidePanes, shade(ROOF_SLATE[2], 1.06));
  // Las seis columnas, cada una con su basa y su capitel, paradas un poco más adelante que la pared.
  const face = y1;
  for (let k = 0; k < 6; k++) {
    const u = x0 + 0.2 + ((x1 - x0 - 0.4) * (k + 0.5)) / 6;
    p.box(u - 0.055, face, u + 0.055, face + 0.1, z0 + 3, H - 3, THEATRE_COLUMN, 'plain');
    p.box(u - 0.075, face - 0.01, u + 0.075, face + 0.11, z0 + 2, 1.2, THEATRE_STONE, 'plain');
    p.box(u - 0.075, face - 0.01, u + 0.075, face + 0.11, z0 + H - 1.4, 1.4, THEATRE_COLUMN, 'plain');
  }
  // El techo: el Colón **no lleva cúpula**, lleva una mansarda de pizarra enorme y pesada. Se pinta con
  // dos faldas —la del frente y la del costado— y un quiebre arriba: pendiente fuerte abajo y remate más
  // tendido, que es la silueta que el teatro tiene desde la calle.
  // El alero vuela a los costados pero no al frente: el frontón tiene que quedar delante del techo.
  const eave = 0.07;
  const roofZ = z0 + H;
  const breakZ = roofZ + 6;
  const breakIn = 0.4;
  const topZ = breakZ + 2.2;
  const topIn = 0.66;
  /** Una falda de pizarra: hileras cada tres píxeles y el borde de arriba iluminado. */
  const slate = (tone: number): Paint => (x, y) => {
    if (y % 3 === 0) return shade(ROOF_SLATE[2], tone * 0.82);
    return noise(x, y >> 1, 5) > 0.86 ? shade(ROOF_SLATE[1], tone * 0.94) : shade(ROOF_SLATE[1], tone);
  };
  // La falda del frente, la del costado del mismo lado, y las dos del quiebre.
  p.poly(
    [p.P(x0, y1, roofZ), p.P(x1, y1, roofZ), p.P(x1 - breakIn, y1 - breakIn, breakZ), p.P(x0 + breakIn, y1 - breakIn, breakZ)],
    slate(1.06),
  );
  p.poly(
    [p.P(x1 + eave, y1, roofZ), p.P(x1 + eave, y0 - eave, roofZ), p.P(x1 - breakIn, y0 + breakIn, breakZ), p.P(x1 - breakIn, y1 - breakIn, breakZ)],
    slate(0.86),
  );
  p.poly(
    [p.P(x0 + breakIn, y1 - breakIn, breakZ), p.P(x1 - breakIn, y1 - breakIn, breakZ), p.P(x1 - topIn, y1 - topIn, topZ), p.P(x0 + topIn, y1 - topIn, topZ)],
    slate(1.2),
  );
  p.poly(
    [p.P(x1 - breakIn, y1 - breakIn, breakZ), p.P(x1 - breakIn, y0 + breakIn, breakZ), p.P(x1 - topIn, y0 + topIn, topZ), p.P(x1 - topIn, y1 - topIn, topZ)],
    slate(0.98),
  );
  // La cumbrera: el borde alto del techo, iluminado, y la losa de arriba.
  p.poly(
    [p.P(x0 + topIn, y0 + topIn, topZ), p.P(x1 - topIn, y0 + topIn, topZ), p.P(x1 - topIn, y1 - topIn, topZ), p.P(x0 + topIn, y1 - topIn, topZ)],
    (_x, y) => (y % 3 === 0 ? shade(ROOF_SLATE[0], 0.9) : shade(ROOF_SLATE[0], 1.12)),
  );
  p.px.line(p.P(x0 + breakIn, y1 - breakIn, breakZ), p.P(x1 - breakIn, y1 - breakIn, breakZ), shade(ROOF_SLATE[0], 1.26));
  p.px.line(p.P(x0, y1, roofZ), p.P(x1 + eave, y1, roofZ), shade(ROOF_SLATE[2], 0.66));
  // Las claraboyas del techo, dos, hundidas en la pizarra: un techo de ese tamaño vacío es una mancha.
  for (const k of [-0.28, 0.28]) {
    const bu = cx + k * 1.1;
    const bv = y1 - 0.2;
    p.poly(
      [p.P(bu - 0.12, bv, roofZ + 2), p.P(bu + 0.12, bv, roofZ + 2), p.P(bu + 0.12, bv - 0.16, roofZ + 3.4), p.P(bu - 0.12, bv - 0.16, roofZ + 3.4)],
      () => shade(ROOF_SLATE[0], 1.4),
    );
  }

  // El entablamento: sólo la banda del frente, sin tapa. Una caja con tapa se comía la cubierta entera y
  // el teatro quedaba con una losa de piedra por techo.
  p.poly(
    [p.P(x0 - 0.05, face + 0.12, z0 + H), p.P(x1 + 0.05, face + 0.12, z0 + H), p.P(x1 + 0.05, face + 0.12, z0 + H + 2.4), p.P(x0 - 0.05, face + 0.12, z0 + H + 2.4)],
    (x, y) => (bayer(x, y) < 0.2 ? shade(THEATRE_STONE[1], 1.06) : shade(THEATRE_STONE[1], 0.98)),
  );
  p.px.line(p.P(x0 - 0.05, face + 0.12, z0 + H + 2.4), p.P(x1 + 0.05, face + 0.12, z0 + H + 2.4), shade(THEATRE_STONE[1], 1.2));
  p.px.line(p.P(x0 - 0.05, face + 0.12, z0 + H), p.P(x1 + 0.05, face + 0.12, z0 + H), shade(THEATRE_STONE[2], 0.82));
  const base = z0 + H + 2.4;
  const apexH = 10;
  // El frontón, con las dos faldas en tonos distintos y la arista iluminada: tres triángulos encimados del
  // mismo color no se leen, y el frontón es lo único que dice que esto es un teatro y no un banco.
  const ped = face + 0.12;
  const apex = p.P(cx, ped, base + apexH);
  p.poly([p.P(x0 - 0.04, ped, base), p.P(cx, ped, base), apex], () => THEATRE_STONE[0]);
  p.poly([p.P(cx, ped, base), p.P(x1 + 0.04, ped, base), apex], () => shade(THEATRE_STONE[0], 0.84));
  p.px.line(p.P(cx, ped, base), apex, shade(THEATRE_STONE[0], 1.14));
  p.px.line(p.P(x0 - 0.04, ped, base), p.P(x1 + 0.04, ped, base), shade(THEATRE_STONE[2], 0.68));
  // El tímpano: el triángulo hundido entre la arista y la base, en sombra.
  p.poly(
    [p.P(x0 + 0.42, ped, base + 1.8), p.P(x1 - 0.42, ped, base + 1.8), p.P(cx, ped, base + apexH - 2.6)],
    () => shade(THEATRE_STONE[1], 0.88),
  );
}

/** Paints el Teatro on the lot the camera sees: 3x3. */
export function paintTeatro(vw: number, vh: number): { px: Pixels; ax: number; ay: number; smoke: [number, number][] } {
  const p = penRect(vw, vh, TEATRO_MAX_Z);
  paintTeatroOn(p, vw, vh);
  return { px: p.px, ax: p.ax, ay: p.ay, smoke: p.smoke };
}

const teatroCache = new Map<string, Sprite>();

/** El Teatro as a sprite, keyed by the shape of the lot the camera sees. */
export function teatroPixelSprite(vw: number, vh: number): Sprite {
  const key = `${vw}x${vh}`;
  let sprite = teatroCache.get(key);
  if (!sprite) {
    sprite = spriteOf(paintTeatro(vw, vh));
    teatroCache.set(key, sprite);
  }
  return sprite;
}

const ESTADIO_MAX_Z = 52;

/** El hormigón dorado de las tribunas, el azul del club y el verde de la cancha. */
const STADIUM_GOLD: Ramp = ramp('#dcc06a');
const STADIUM_BLUE = hex('#2f5e9e');
const PITCH = hex('#3d8b47');
const PITCH_DARK = hex('#316f3a');
const PITCH_LINE = hex('#eae5d5');
const FLOOD_LAMP = hex('#fff4c4');
/** La gente: cuatro colores y nada más. A 1× un moteado de diez colores es ruido. */
const CROWD: RGB[] = [hex('#f2ead6'), hex('#c8392f'), hex('#2f5e9e'), hex('#e0a526')];

/**
 * El Estadio (4x4): la cancha en el medio con sus líneas, las tribunas alrededor y las tres torres de
 * luz. La forma es la de una herradura **abierta hacia la cámara**: las gradas van por el fondo y por
 * la izquierda, y el frente lo cierra un muro bajo con la banda del club. Es una decisión de cámara y
 * de estadio a la vez: cerrado, no se ve la cancha y el edificio es una caja con un pozo adentro.
 */
function paintEstadioOn(p: Pen, vw: number, vh: number): void {
  const L = Math.max(vw, vh);
  const W = Math.min(vw, vh);
  const o = 0.04;
  const x0 = o;
  const y0 = o;
  const x1 = L - 0.22;

  /** Una escalera de cuatro bandas: la de fondo arranca alta y cada una baja. */
  const STEPS: [number, number, number][] = [
    [0.04, 0.24, 22],
    [0.24, 0.46, 16.5],
    [0.46, 0.68, 11],
    [0.68, 0.84, 5.5],
  ];

  /** La gente en la grada: motas de cuatro colores y nada más. El resto del asiento queda pelado. */
  const seats = (u0: number, v0: number, u1: number, v1: number, z: number) => {
    p.poly([p.P(u0, v0, z), p.P(u1, v0, z), p.P(u1, v1, z), p.P(u0, v1, z)], (x, y) =>
      noise(x, y, 21) > 0.84 ? CROWD[Math.floor(noise(x, y, 4) * 4)] : null,
    );
  };

  /** La cara de una grada: el filo de arriba al sol y una banda azul en la última hilera. */
  const riser =
    (h: number, blue: boolean): WallPaint =>
    (_t, k) => {
      if (k >= h - 1) return shade(STADIUM_GOLD[0], 1.16);
      // La banda del club: sólida, con el filo de arriba en luz. Cortada a motas parece un error de
      // pintura y no una bandera.
      if (blue && k >= h - 5 && k < h - 1) return k === h - 2 ? shade(STADIUM_BLUE, 1.5) : STADIUM_BLUE;
      return shade(STADIUM_GOLD[1], 1 - 0.05 * Math.floor(k / 6));
    };

  /** Una torre de luz: el mástil, la parrilla y la fila de lámparas. */
  const flood = (u: number, v: number) => {
    const [bx, by] = p.P(u, v, 0);
    const cx = Math.round(bx);
    const cy = Math.round(by);
    // El mástil de dos píxeles: de uno solo, a 1× se pierde contra el cielo y las torres flotan.
    p.px.rect(cx, cy - 40, 2, 40, shade(STEEL[1], 0.92));
    p.px.rect(cx + 1, cy - 40, 1, 40, shade(STEEL[2], 0.86));
    p.px.rect(cx - 3, cy - 44, 7, 4, shade(LEG, 1.45));
    p.px.rect(cx - 3, cy - 44, 7, 1, FLOOD_LAMP);
    p.px.rect(cx - 2, cy - 41, 5, 1, hex('#f7e08a'));
  };

  // Las torres van primero: las tribunas les tapan los pies.
  flood(x0 + 0.14, y0 + 0.14);
  flood(L - 0.14, y0 + 0.14);
  flood(x0 + 0.14, W - 0.14);

  // El playón de cemento, y la cancha justo encima.
  p.box(0.02, 0.02, L - 0.02, W - 0.02, 0, 1.1, CONCRETE, 'plain');
  const p0 = 1;
  const p1 = Math.min(L, W) - 1;
  const pz = 1.2;
  p.poly([p.P(p0, p0, pz), p.P(p1, p0, pz), p.P(p1, p1, pz), p.P(p0, p1, pz)], (x, y) =>
    noise(x, y, 3) > 0.84 ? PITCH_DARK : PITCH,
  );
  const ln = (a: number, b: number, c: number, d: number) => p.px.line(p.P(a, b, pz), p.P(c, d, pz), PITCH_LINE);
  const m = 0.14;
  ln(p0 + m, p0 + m, p1 - m, p0 + m);
  ln(p1 - m, p0 + m, p1 - m, p1 - m);
  ln(p1 - m, p1 - m, p0 + m, p1 - m);
  ln(p0 + m, p1 - m, p0 + m, p0 + m);
  ln((p0 + p1) / 2, p0 + m, (p0 + p1) / 2, p1 - m);
  // El círculo del medio, en doce píxeles: un círculo de dos píxeles de radio no tiene otra forma.
  {
    const [mx, my] = p.P((p0 + p1) / 2, (p0 + p1) / 2, pz);
    const cx = Math.round(mx);
    const cy = Math.round(my);
    for (const [dx, dy] of [
      [-3, 0], [3, 0], [-3, 1], [3, 1], [-2, -1], [2, -1], [-2, 2], [2, 2], [-1, -2], [1, -2], [-1, 3], [1, 3],
    ]) {
      p.px.set(cx + dx, cy + dy, PITCH_LINE);
    }
  }

  // La tribuna de fondo: cuatro bandas, la de atrás la más alta. Su cara visible es la del borde
  // cercano de cada banda, y por eso las gradas se ven por dentro.
  for (const [a, b, h] of STEPS) {
    const top = h === 22;
    p.box(0.04, a, x1, b, 0, h, STADIUM_GOLD, 'plain', top ? [] : [], [], shade(STADIUM_GOLD[1], 1.02));
    p.px.wall(p.P(0.04, b, 0), p.P(x1, b, 0), h, riser(h, top));
    seats(0.04, a, x1, b, h);
  }
  // La tribuna de la izquierda, la misma escalera girada, para que la herradura cierre.
  for (const [a, b, h] of STEPS) {
    const top = h === 22;
    p.box(a, 0.84, b, Math.min(L, W) - 0.22, 0, h, STADIUM_GOLD, 'plain', [], [], shade(STADIUM_GOLD[1], 1.02));
    p.px.wall(p.P(b, 0.84, 0), p.P(b, Math.min(L, W) - 0.22, 0), h, riser(h, top));
    seats(a, 0.84, b, Math.min(L, W) - 0.22, h);
  }

  // El frente: el muro bajo que cierra la herradura, con la banda del club, los palcos y la puerta.
  const fw = Math.min(L, W) - 0.06;
  // Los palcos van en vidrio y no en un gris oscuro: el muro del frente tiene siete píxeles y a esa
  // altura tres píxeles negros no son ventanas, son un agujero.
  const front: Patch[] = [
    // La puerta es un hueco en sombra y no un agujero negro: a tres píxeles de alto, el negro puro
    // se lee como una mancha.
    { t0: 24, t1: 29, k0: 0, k1: 3, c: shade(INSIDE, 1.7) },
    { t0: 0, t1: 52, k0: 2, k1: 4, c: STADIUM_BLUE },
    { t0: 6, t1: 12, k0: 4, k1: 6, c: GLASS },
    { t0: 16, t1: 22, k0: 4, k1: 6, c: GLASS },
    { t0: 31, t1: 37, k0: 4, k1: 6, c: GLASS },
    { t0: 41, t1: 47, k0: 4, k1: 6, c: GLASS },
    { t0: 6, t1: 12, k0: 5, k1: 6, c: shade(GLASS, 1.7) },
    { t0: 16, t1: 22, k0: 5, k1: 6, c: shade(GLASS, 1.7) },
    { t0: 31, t1: 37, k0: 5, k1: 6, c: shade(GLASS, 1.7) },
    { t0: 41, t1: 47, k0: 5, k1: 6, c: shade(GLASS, 1.7) },
  ];
  p.box(0.22, fw - 0.54, 3.5, fw, 0, 7, STADIUM_GOLD, 'plain', front, [], shade(STADIUM_GOLD[1], 1.04));
  // Las dos entradas del costado derecho, con su banda azul.
  for (const [c0, c1] of [
    [0.9, 1.62],
    [2.42, 3.1],
  ] as const) {
    p.box(L - 0.42, c0, L - 0.06, c1, 0, 7, STADIUM_GOLD, 'plain', [], [{ t0: 1, t1: 4, k0: 2, k1: 5, c: STADIUM_BLUE }], shade(STADIUM_GOLD[1], 1.04));
  }

  p.shadow(0.02, 0.02, L - 0.02, W - 0.02);
}

/** Paints el Estadio on the lot the camera sees: 4x4. */
export function paintEstadio(vw: number, vh: number): { px: Pixels; ax: number; ay: number; smoke: [number, number][] } {
  const p = penRect(vw, vh, ESTADIO_MAX_Z);
  paintEstadioOn(p, vw, vh);
  return { px: p.px, ax: p.ax, ay: p.ay, smoke: p.smoke };
}

const estadioCache = new Map<string, Sprite>();

/** El Estadio as a sprite, keyed by the shape of the lot the camera sees. */
export function estadioPixelSprite(vw: number, vh: number): Sprite {
  const key = `${vw}x${vh}`;
  let sprite = estadioCache.get(key);
  if (!sprite) {
    sprite = spriteOf(paintEstadio(vw, vh));
    estadioCache.set(key, sprite);
  }
  return sprite;
}

const CABILDO_MAX_Z = 64;

/**
 * La cal, con los tres tonos elegidos a mano: el 0,69 y el 0,59 automáticos dejan un crema grisáceo, y
 * el Cabildo es blanco. El ladrillo del techo y el hierro de las rejas van aparte.
 */
const CABILDO_WALL: Ramp = [hex('#fdf6e0'), hex('#f7edd4'), hex('#ded1ae')];
const CABILDO_TILE: Ramp = ramp('#b0472f');
const ARCH = hex('#413a31');
const CLOCK_FACE = hex('#f7f2e6');

/**
 * El Cabildo (3x2): dos plantas sobre la plaza, la de abajo de arcos y la de arriba de ventanas con
 * balcón corrido, el techo de tejas a cuatro aguas y **la torre con el reloj en el medio del frente**.
 * La torre es lo único que lo distingue de cualquier casa de gobierno: tiene que sobresalir del techo y
 * llevar la bandera, no quedar escondida entre las tejas.
 */
function paintCabildoOn(p: Pen, vw: number, vh: number): void {
  const L = Math.max(vw, vh);
  const W = Math.min(vw, vh);
  const x0 = 0.16;
  const y0 = 0.18;
  const x1 = L - 0.16;
  const y1 = W - 0.18;
  const z0 = 2.2;
  const H = 20;

  // El zócalo de piedra: una hilera clara y nada más. Dos cajas apiladas dejaban un basamento gris de
  // un tercio de la altura, que es más que el edificio.
  p.box(x0 - 0.05, y0 - 0.05, x1 + 0.05, y1 + 0.05, 0, z0, STONE_LIGHT, 'plain');

  const fw = Math.round((x1 - x0) * 16);
  const sw = Math.round((y1 - y0) * 16);

  /** La planta baja de arcos: el hueco oscuro con el dintel curvado un píxel por lado, y su clave. */
  const arcade = (w: number, n: number): Patch[] => {
    const out: Patch[] = [];
    for (let i = 0; i < n; i++) {
      const t = Math.round((w * (i + 0.5)) / n) - 3;
      out.push({ t0: t, t1: t + 6, k0: 1, k1: 6, c: ARCH });
      out.push({ t0: t + 1, t1: t + 5, k0: 6, k1: 7, c: ARCH });
      out.push({ t0: t + 2, t1: t + 4, k0: 7, k1: 8, c: ARCH });
      out.push({ t0: t - 1, t1: t + 8, k0: 8, k1: 9, c: shade(CABILDO_WALL[1], 1.16) });
    }
    // El muro de la planta baja, al final y detrás de los arcos: la cal viva es el contraste de los
    // huecos, y sin ella la planta baja es una banda marrón.
    out.push({ t0: 0, t1: w, k0: 0, k1: 9, c: shade(CABILDO_WALL[1], 1.04) });
    return out;
  };
  /**
   * La planta alta: la reja primero —el primer parche que toca un píxel gana, y las barras son de un
   * píxel—, después el filo iluminado y al final el vidrio.
   */
  const upper = (w: number, n: number): Patch[] => {
    const out: Patch[] = [];
    for (let i = 0; i < n; i++) {
      const t = Math.round((w * (i + 0.5)) / n) - 1;
      out.push({ t0: t, t1: t + 1, k0: 13, k1: 19, c: LEG });
      out.push({ t0: t + 2, t1: t + 3, k0: 13, k1: 19, c: LEG });
      out.push({ t0: t, t1: t + 3, k0: 18, k1: 19, c: shade(GLASS, 1.7) });
      out.push({ t0: t, t1: t + 3, k0: 13, k1: 19, c: GLASS });
      out.push({ t0: t - 1, t1: t + 4, k0: 12, k1: 13, c: shade(CABILDO_WALL[2], 0.78) });
    }
    out.push({ t0: 0, t1: w, k0: 10, k1: 20, c: CABILDO_WALL[1] });
    return out;
  };

  p.box(x0, y0, x1, y1, z0, H, CABILDO_WALL, 'plain', [...arcade(fw, 4), ...upper(fw, 4)], [...arcade(sw, 3), ...upper(sw, 3)]);
  // El balcón corrido por las dos caras, y su baranda.
  p.balcony(x0, y1, x1, z0 + 8.6);
  p.box(x1, y0, x1 + 0.1, y1, z0 + 8.6, 1, STONE_LIGHT, 'plain');
  p.px.line(p.P(x1 + 0.1, y0, z0 + 11.2), p.P(x1 + 0.1, y1, z0 + 11.2), RAIL);
  // El cornisamento, el techo de tejas bajo —detrás, apenas se ve— y **la balaustrada** en el borde.
  // El Cabildo no se reconoce por el techo: se reconoce por la balaustrada corrida y por la torre.
  p.cornice(x0, y0, x1, y1, z0 + H, 1, tone(shade(CABILDO_WALL[1], 1.06)));
  p.hip(x0, y0, x1, y1, z0 + H + 1, 3, CABILDO_TILE);
  {
    // La balaustrada: el zócalo, las barandas una sí una no, y el pasamanos al sol. Tres píxeles.
    const bal = (t: number, k: number) => (k >= 2 ? shade(CABILDO_WALL[0], 1.05) : t % 2 ? shade(CABILDO_WALL[2], 0.72) : CABILDO_WALL[1]);
    const zb = z0 + H + 1;
    p.px.wall(p.P(x0 - 0.03, y1 + 0.03, zb), p.P(x1 + 0.03, y1 + 0.03, zb), 3, bal);
    p.px.wall(p.P(x1 + 0.03, y1 + 0.03, zb), p.P(x1 + 0.03, y0 - 0.03, zb), 3, bal);
  }

  /**
   * **La crujía central, de una sola masa.** La torre no es una columna plantada adelante: es la crujía
   * del medio del Cabildo, que arranca en el suelo, atraviesa el techo y sigue. Por eso va a ras de la
   * pared, del ancho de dos arcos y con las mismas bandas que el cuerpo —arquería, balcón, ventanas,
   * cornisamento—: si se la dibuja como un tubo angosto en el medio, por más que esté a ras se lee
   * pegada adelante. Y no lleva losa de cornisamiento propio: esa tapa se lee como una mesa.
   */
  const cx = (x0 + x1) / 2;
  const tw = 0.56;
  const tw1 = y1;
  const tw0 = y1 - 0.56;
  const tH = H + 22;
  const tfw = Math.round(2 * tw * 16);
  const tsw = Math.round(0.56 * 16);
  /** Las tres bandas del cuerpo, en la crujía: dos arcos, el balcón y dos ventanas con reja. */
  const bay = (w: number): Patch[] => {
    const n = w > 12 ? 2 : 1;
    const out: Patch[] = [];
    for (let i = 0; i < n; i++) {
      const t = Math.round((w * (i + 0.5)) / n) - 3;
      out.push({ t0: t, t1: t + 6, k0: 1, k1: 6, c: ARCH });
      out.push({ t0: t + 1, t1: t + 5, k0: 6, k1: 7, c: ARCH });
      out.push({ t0: t + 2, t1: t + 4, k0: 7, k1: 8, c: ARCH });
      out.push({ t0: t - 1, t1: t + 8, k0: 8, k1: 9, c: shade(CABILDO_WALL[1], 1.16) });
    }
    out.push({ t0: 0, t1: w, k0: 9, k1: 11, c: shade(STONE_LIGHT[1], 1.02) });
    out.push({ t0: 0, t1: w, k0: 11, k1: 12, c: LEG });
    for (let i = 0; i < n; i++) {
      const t = Math.round((w * (i + 0.5)) / n) - 2;
      out.push({ t0: t, t1: t + 1, k0: 13, k1: 19, c: LEG });
      out.push({ t0: t + 3, t1: t + 4, k0: 13, k1: 19, c: LEG });
      out.push({ t0: t, t1: t + 4, k0: 18, k1: 19, c: shade(GLASS, 1.7) });
      out.push({ t0: t, t1: t + 4, k0: 13, k1: 19, c: GLASS });
      out.push({ t0: t - 1, t1: t + 5, k0: 12, k1: 13, c: shade(CABILDO_WALL[2], 0.78) });
    }
    out.push({ t0: 0, t1: w, k0: H - 1, k1: H + 1, c: shade(CABILDO_WALL[1], 1.14) });
    // El hueco de la campaña: sin él la torre tiene veinte píxeles de cal lisa entre el cornisamento y
    // el reloj, y la crujía deja de leerse como torre.
    out.push({ t0: Math.round(w / 2) - 2, t1: Math.round(w / 2) + 2, k0: H + 3, k1: H + 8, c: ARCH });
    out.push({ t0: Math.round(w / 2) - 1, t1: Math.round(w / 2) + 1, k0: H + 8, k1: H + 9, c: ARCH });
    out.push({ t0: Math.round(w / 2) - 3, t1: Math.round(w / 2) + 3, k0: H + 9, k1: H + 10, c: shade(CABILDO_WALL[1], 1.16) });
    return out;
  };
  p.box(cx - tw, tw0, cx + tw, tw1, z0, tH - 8, CABILDO_WALL, 'plain', bay(tfw), bay(tsw));
  /**
   * El cuerpo del reloj, un poco más ancho que la crujía: es el corrimiento que hace que la torre se lea
   * como torre. Las cuatro esquinas de la esfera van en cal porque un cuadrado blanco no es un reloj.
   */
  const clock = (w: number): Patch[] => {
    const t = Math.round(w / 2) - 3;
    const k = 1;
    const cal = shade(CABILDO_WALL[1], 1.05);
    return [
      { t0: t, t1: t + 1, k0: k, k1: k + 1, c: cal },
      { t0: t + 5, t1: t + 6, k0: k, k1: k + 1, c: cal },
      { t0: t, t1: t + 1, k0: k + 5, k1: k + 6, c: cal },
      { t0: t + 5, t1: t + 6, k0: k + 5, k1: k + 6, c: cal },
      { t0: t, t1: t + 6, k0: k, k1: k + 6, c: CLOCK_FACE },
      { t0: 0, t1: w, k0: 7, k1: 8, c: shade(CABILDO_WALL[1], 1.16) },
    ];
  };
  p.box(cx - tw - 0.05, tw0 - 0.05, cx + tw + 0.05, tw1 + 0.05, z0 + tH - 8, 8, CABILDO_WALL, 'plain', clock(tfw + 2), clock(tsw + 2));
  // Las agujas: dos píxeles oscuros en cada esfera, o el reloj es un cuadrado blanco.
  for (const [u, v] of [
    [cx, tw1 + 0.05],
    [cx + tw + 0.05, (tw0 + tw1) / 2],
  ]) {
    const [hx, hy] = p.P(u, v, z0 + tH - 4);
    const ix = Math.round(hx);
    const iy = Math.round(hy);
    p.px.set(ix, iy - 1, LEG);
    p.px.rect(ix, iy, 2, 1, LEG);
  }
  // El remate: cornisamiento y un casquete de tejas. Un cornisamiento **con la losa gris a la vista**
  // deja un patio de cemento en la punta y la torre se lee como un bloque; el casquete la cierra.
  p.cornice(cx - tw - 0.05, tw0 - 0.05, cx + tw + 0.05, tw1 + 0.05, z0 + tH, 1, CABILDO_WALL);
  p.hip(cx - tw - 0.08, tw0 - 0.08, cx + tw + 0.08, tw1 + 0.08, z0 + tH + 1, 2.6, CABILDO_TILE);
  p.flag(cx, (tw0 + tw1) / 2, z0 + tH + 3, 7);

  p.shadow(x0, y0, x1, y1);
}

/** Paints el Cabildo on the lot the camera sees: 3x2. */
export function paintCabildo(vw: number, vh: number): { px: Pixels; ax: number; ay: number; smoke: [number, number][] } {
  const p = penRect(vw, vh, CABILDO_MAX_Z);
  paintCabildoOn(p, vw, vh);
  return { px: p.px, ax: p.ax, ay: p.ay, smoke: p.smoke };
}

const cabildoCache = new Map<string, Sprite>();

/** El Cabildo as a sprite, keyed by the shape of the lot the camera sees. */
export function cabildoPixelSprite(vw: number, vh: number): Sprite {
  const key = `${vw}x${vh}`;
  let sprite = cabildoCache.get(key);
  if (!sprite) {
    sprite = spriteOf(paintCabildo(vw, vh));
    cabildoCache.set(key, sprite);
  }
  return sprite;
}

const PLANETARIO_MAX_Z = 40;

/** La cal del basamento y del plato. */
const DRUM_WHITE: Ramp = [hex('#fdfaf2'), hex('#f5efe2'), hex('#ded6c4')];
/** La cúpula: chapa perforada, gris plomo. Es lo más oscuro de la ciudad a propósito. */
const DOME_DARK: [RGB, RGB, RGB] = [hex('#6d7075'), hex('#55585d'), hex('#3d4045')];
/** El vidrio del plato: apenas azulado y muy claro, porque lo que se ve a través es el cielo. */
const SAUCER_GLASS: Ramp = [hex('#d8e4e8'), hex('#b9cdd6'), hex('#96b1bd')];
/** El vidrio del volumen de abajo: más hondo, en sombra. */
const BASE_GLASS: Ramp = [hex('#5d7f8d'), hex('#4a6a78'), hex('#3a5663')];
/** La carpintería: hierro claro, que es lo que dibuja la estructura circular. */
const MULLION = hex('#f4efe2');
/** El parque del lote. */
const PARK: Ramp = ramp('#79a95f');

/**
 * El Planetario (3x3): **una cúpula oscura sobre un plato de vidrio que vuela, con cuatro patas**. La
 * cúpula es de chapa perforada y va oscura —es lo único oscuro de la ciudad y por eso se reconoce desde
 * lejos—, el plato es una franja de vidrio con la carpintería a la vista que **vuela más ancho que el
 * cuerpo**, y abajo no hay muro: hay un volumen de vidrio en sombra y cuatro tensores de hormigón que
 * entran desde el parque y sostienen el plato. Sin las patas y sin el vuelo del plato, el edificio es un
 * tambor con una tapa, que es lo que era.
 */
function paintPlanetarioOn(p: Pen, vw: number, vh: number): void {
  const L = Math.max(vw, vh);
  const W = Math.min(vw, vh);
  const cx = L / 2;
  const cy = W / 2;

  // El parque del lote y el camino de entrada.
  p.poly([p.P(0.04, 0.04), p.P(L - 0.04, 0.04), p.P(L - 0.04, W - 0.04), p.P(0.04, W - 0.04)], (x, y) =>
    noise(x, y, 21) > 0.88 ? shade(PARK[1], 1.1) : PARK[1],
  );
  p.poly([p.P(L - 0.05, cy - 0.42), p.P(L - 0.05, cy + 0.42), p.P(cx + 0.42, cy - 0.42), p.P(cx + 0.42, cy + 0.42)], (x, y) =>
    bayer(x, y) < 0.3 ? shade(CONCRETE[1], 1.12) : CONCRETE[1],
  );

  // Los árboles van **antes** del edificio: pintados después, la copa del que está detrás se le sube
  // encima de la cúpula y parece un árbol plantado en el plato.
  p.tree(0.34, W - 0.36);
  p.tree(L - 0.36, W - 0.34);
  p.tree(L - 0.3, 0.3);
  p.tree(0.3, 0.32);

  const r = 17; // el radio del plato: vuela dos píxeles por lado sobre la cúpula
  const discZ = 9; // dónde apoya el plato
  const discH = 5;
  const domeRx = r - 3;
  const domeRy = 17; // alto del domo sobre el plato
  const lipRy = 4; // cuánto baja el arco de apoyo en el medio

  /** Un cilindro: el cuerpo columna por columna, con la carpintería y los filos si se piden. */
  const cyl = (z0: number, rad: number, h: number, base: Ramp, mullion: RGB | null = null, rim: RGB | null = null, top = false) => {
    const [bx, by] = p.P(cx, cy, z0);
    const ix = Math.round(bx);
    const iy = Math.round(by);
    const ry = Math.max(1, Math.round(rad * 0.5));
    for (let d = -rad; d <= rad; d++) {
      const e = Math.round(Math.sqrt(Math.max(0, 1 - (d / rad) ** 2)) * ry);
      const lit = d < -rad * 0.45 ? base[0] : d > rad * 0.5 ? base[2] : base[1];
      p.px.rect(ix + d, iy - h - e, 1, h + 2 * e, lit);
      // La carpintería del plato: los parantes son la estructura circular.
      if (mullion && Math.abs(d) % 4 === 1) p.px.rect(ix + d, iy - h - e, 1, h + 2 * e, mullion);
      // Los filos de cal: el de arriba hace que el plato vuele y el de abajo que tenga canto.
      if (rim) {
        p.px.set(ix + d, iy - h - e, rim);
        // El canto de abajo va en el vidrio oscuro y no en cal: con los dos filos blancos el plato es
        // una cáscara de huevo.
        p.px.set(ix + d, iy + e - 1, shade(SAUCER_GLASS[2], 0.86));
      }
    }
    if (top) {
      for (let d = -ry; d <= ry; d++) {
        const w = Math.round(Math.sqrt(Math.max(0, 1 - (d / ry) ** 2)) * rad);
        // La terraza: piso de piedra, no cal. Blanca, la mitad de arriba del plato es una banda blanca.
        // La terraza va en gris medio y no en cal: es un piso a la sombra del domo, y si es claro se come
        // la franja de vidrio.
        p.px.rect(ix - w, iy - h - d, w * 2, 1, d < 0 ? shade(DRUM_WHITE[2], 0.76) : shade(DRUM_WHITE[2], 0.66));
      }
    }
    return { ix, iy, ry };
  };

  const [gx0, gy0] = p.P(cx, cy, 0);
  const gx = Math.round(gx0);
  const gy = Math.round(gy0);

  /**
   * Una pata: el tensor de hormigón que entra desde el parque y agarra el plato por abajo. Son cuatro y
   * arrancan **más lejos que el plato** y suben: es lo que hace que el plato vuele. De un píxel no se
   * leen, así que van de tres.
   */
  const leg = (deg: number, hondo: boolean) => {
    const a = (deg * Math.PI) / 180;
    const out = r + 7;
    const x0 = gx + out * Math.cos(a);
    const y0 = gy + (out * Math.sin(a)) / 2;
    const x1 = gx + (r - 4) * Math.cos(a);
    const y1 = gy + ((r - 4) * Math.sin(a)) / 2 - discZ + 1;
    const c0 = hondo ? shade(CONCRETE[2], 0.84) : CONCRETE[1];
    const c1 = hondo ? shade(CONCRETE[1], 0.92) : shade(CONCRETE[0], 1.06);
    // De cuatro píxeles: de tres se leen como un cable y no como un tensor de hormigón.
    for (let i = 0; i < 4; i++) p.px.line([x0 + i, y0], [x1 + i, y1], i === 1 ? c1 : c0);
  };

  // Las de atrás primero, que el plato y el volumen de abajo las tapan.
  leg(215, true);
  leg(325, true);
  // El volumen de vidrio en sombra, abajo del plato y entre las patas.
  cyl(0, r - 7, discZ, BASE_GLASS);
  // Las de adelante, que pasan por delante del volumen.
  leg(35, false);
  leg(145, false);

  // El plato: la franja de vidrio con la carpintería a la vista, los filos de cal y la terraza arriba.
  cyl(discZ, r, discH, SAUCER_GLASS, MULLION, DRUM_WHITE[0], true);

  // La cúpula: chapa perforada, oscura, y más ancha que alta porque es una esfera cortada por el plato.
  const [dx0, dy0] = p.P(cx, cy, discZ + discH);
  const dx = Math.round(dx0);
  const dy = Math.round(dy0);
  // La cúpula **no es media naranja**: es una esfera posada en el plato, y por eso tiene que ser más
  // alta que ancha y terminar en un **arco de apoyo** que baja en el medio. Con la base recta y media
  // bola de alto, la cúpula se lee como una tapa tirada sobre el plato.
  for (let k = -domeRy; k <= lipRy; k++) {
    const w =
      k <= 0
        ? Math.round(domeRx * Math.sqrt(Math.max(0, 1 - (k / domeRy) ** 2)))
        : Math.round(domeRx * Math.sqrt(Math.max(0, 1 - (k / lipRy) ** 2)));
    for (let d = -w; d <= w; d++) {
      const l = (-d / domeRx) * 0.5 + (-k / domeRy) * 0.55;
      const tone = l > 0.34 ? DOME_DARK[0] : l > -0.3 ? DOME_DARK[1] : DOME_DARK[2];
      const x = dx + d;
      const y = dy + k;
      // La malla: un punto más oscuro en damero. Es lo que hace que la cúpula se lea perforada y no
      // como una bola de plástico.
      p.px.set(x, y, (x + y) % 2 === 0 ? shade(tone, 0.9) : tone);
    }
  }
  // El mástil de la antena, sólo: las dos cajas blancas que tiene al pie del domo, a este tamaño, se
  // leen como dos ojos y el planetario pasa a tener cara.
  p.px.rect(dx, dy - domeRy - 4, 1, 5, shade(STEEL[1], 1.05));

  p.shadow(0.2, 0.2, L - 0.2, W - 0.2);
}

/** Paints el Planetario on the lot the camera sees: 3x3. */
export function paintPlanetario(vw: number, vh: number): { px: Pixels; ax: number; ay: number; smoke: [number, number][] } {
  const p = penRect(vw, vh, PLANETARIO_MAX_Z);
  paintPlanetarioOn(p, vw, vh);
  return { px: p.px, ax: p.ax, ay: p.ay, smoke: p.smoke };
}

const planetarioCache = new Map<string, Sprite>();

/** El Planetario as a sprite, keyed by the shape of the lot the camera sees. */
export function planetarioPixelSprite(vw: number, vh: number): Sprite {
  const key = `${vw}x${vh}`;
  let sprite = planetarioCache.get(key);
  if (!sprite) {
    sprite = spriteOf(paintPlanetario(vw, vh));
    planetarioCache.set(key, sprite);
  }
  return sprite;
}

const calvarioCache = new Map<string, Sprite>();

/** El Calvario as a sprite, keyed by the shape of the lot the camera sees. */
export function calvarioPixelSprite(vw: number, vh: number): Sprite {
  const key = `${vw}x${vh}`;
  let sprite = calvarioCache.get(key);
  if (!sprite) {
    sprite = spriteOf(paintCalvario(vw, vh));
    calvarioCache.set(key, sprite);
  }
  return sprite;
}

/** The same lot as a sprite the map can blit. Needs a DOM: call it from the game, not a test. */
const REGIMIENTO_MAX_Z = 46;

/** La cal del cuartel, con los tres tonos a mano: el 0,69 y el 0,59 automáticos dejan un crema grisáceo. */
const CUARTEL_WALL: Ramp = [hex('#f9f5ea'), hex('#ece6d4'), hex('#d2cab1')];
/** La teja verde: es lo que hace que un cuartel se lea como cuartel y no como una casa cualquiera. */
const CUARTEL_ROOF: Ramp = [hex('#84a578'), hex('#5f7d55'), hex('#48603f')];
/** La tierra apisonada del patio de armas. */
const PATIO: Ramp = [hex('#cdc0a2'), hex('#bbac8b'), hex('#a69571')];
/** El zinc del capuchón de la torre: contra el techo verde del fondo, un techo verde se pierde. */
const CUARTEL_CAP: Ramp = [hex('#7f868b'), hex('#626a6f'), hex('#4c5358')];
/** El oliva del camión. */
const OLIVA: Ramp = [hex('#7b8a6d'), hex('#67755b'), hex('#535f49')];

/**
 * El Regimiento (4x3): **dos cuadras de cal con techo de teja verde en ele, alrededor del patio de armas
 * vacío**, el mástil con la bandera en el medio, la torre de vigilancia sobre el portón y el muro del
 * perímetro. El patio vacío no es un lote sin terminar: es lo que el edificio **es**. Un cuartel es un
 * cerco con un campo adentro, así que se reconoce por la planta y no por la altura — es el único único
 * que se lee desde arriba.
 */
function paintRegimientoOn(p: Pen, vw: number, vh: number): void {
  const L = Math.max(vw, vh);
  const W = Math.min(vw, vh);
  const z0 = 2; // el zócalo de piedra
  const H = 14; // el alto de las cuadras: bajo, que es lo que son

  // El patio de armas. El lote entero es tierra apisonada, así que el piso lleva las manchas del uso:
  // liso se lee como una cancha de cemento, que es lo contrario de un cuartel.
  p.poly([p.P(0.03, 0.03), p.P(L - 0.03, 0.03), p.P(L - 0.03, W - 0.03), p.P(0.03, W - 0.03)], (x, y) => {
    const n = noise(x, y, 33);
    if (n > 0.9) return shade(PATIO[1], 1.1);
    if (n < 0.1) return shade(PATIO[1], 0.89);
    return PATIO[1];
  });

  /** La fila de ventanas de una cara de `w` píxeles: `n` huecos, cada uno con su dintel y su antepecho. */
  const windows = (w: number, n: number, door0: number | null): Patch[] => {
    const out: Patch[] = [];
    if (door0 !== null) out.push(door(door0, 4, 7));
    out.push({ t0: 0, t1: 99, k0: 0, k1: z0, c: shade(STONE_LIGHT[1], 0.9) });
    for (let i = 0; i < n; i++) {
      const t = Math.round((w / n) * (i + 0.5)) - 2;
      out.push({ t0: t - 1, t1: t + 4, k0: 4, k1: 5, c: shade(CUARTEL_WALL[1], 1.14) });
      out.push(pane(t, 5, 3, 4));
      out.push({ t0: t - 1, t1: t + 4, k0: 9, k1: 10, c: shade(CUARTEL_WALL[1], 0.84) });
    }
    return out;
  };

  /** Una cuadra: cal, zócalo de piedra, la fila de ventanas y el techo de teja a cuatro aguas. */
  const cuadra = (u0: number, v0: number, u1: number, v1: number, nf: number, ns: number, door0: number | null) => {
    const fw = Math.round((u1 - u0) * 16);
    const sw = Math.round((v1 - v0) * 16);
    p.box(u0, v0, u1, v1, z0, H - z0, CUARTEL_WALL, 'plain', windows(fw, nf, door0), windows(sw, ns, null));
    p.hip(u0 - 0.05, v0 - 0.05, u1 + 0.05, v1 + 0.05, H, 4, CUARTEL_ROOF);
  };

  // Las dos cuadras en ele, al fondo y a la izquierda: el patio queda abierto del lado de la cámara, que
  // es lo único que lo deja ver. La corta va primero porque la larga le pasa por delante.
  cuadra(0.16, 0.72, 0.72, W - 0.14, 1, 3, null);
  cuadra(0.16, 0.12, L - 0.16, 0.72, 5, 1, Math.round((L - 0.32) * 16) - 12);

  // El muro del perímetro, del lado de la cámara, con el portón sobre la calle. El portón va en el muro
  // de adelante y no debajo de la torre: puesto ahí, la torre lo tapaba y quedaba un hueco sin explicación.
  const GU0 = 1.3;
  const GU1 = 1.8;
  p.box(0.03, W - 0.1, GU0, W - 0.04, 0, 3, CUARTEL_WALL, 'plain');
  p.box(GU1, W - 0.1, L - 0.1, W - 0.04, 0, 3, CUARTEL_WALL, 'plain');
  p.box(L - 0.1, 0.03, L - 0.04, W - 0.04, 0, 3, CUARTEL_WALL, 'plain');
  // La hoja de reja del portón: en una pared de cal, un paño oscuro a la altura del muro se lee como
  // portón, y las varillas de la textura 'sheet' lo dicen sin dibujar una reja.
  p.box(GU0 + 0.02, W - 0.09, GU1 - 0.02, W - 0.05, 0, 3, [hex('#5f6660'), hex('#4b524c'), hex('#3c423d')], 'sheet');
  // Los dos pilares del portón, con su remate de piedra.
  for (const gu of [GU0 - 0.06, GU1]) {
    p.box(gu, W - 0.12, gu + 0.06, W - 0.02, 0, 8, CUARTEL_WALL, 'plain');
    p.box(gu - 0.02, W - 0.14, gu + 0.08, W - 0.0, 8, 1, STONE_LIGHT, 'plain');
  }

  // La torre de vigilancia: **es lo que hace cuartel al edificio**. Va alta —casi dos veces la cuadra—,
  // angosta y adelante, sobre el patio y no sobre el techo: contra la cal del fondo, una torre de cal no
  // tiene contorno y se lee como una caseta. Contra la tierra del patio, sí.
  const TU = L - 0.5;
  const TV = 1.85;
  const tw = 0.11;
  const TH = 30;
  p.box(TU - tw - 0.03, TV - tw - 0.03, TU + tw + 0.03, TV + tw + 0.03, 0, 2, STONE_LIGHT, 'plain');
  p.box(TU - tw, TV - tw, TU + tw, TV + tw, 2, TH - 2, CUARTEL_WALL, 'plain', [pane(1, 20, 2, 3), pane(1, 13, 2, 2)], [
    pane(1, 20, 2, 3),
  ]);
  // El balcón que vuela y la baranda: la silueta de la torre no puede ser un rectángulo.
  p.box(TU - tw - 0.07, TV - tw - 0.07, TU + tw + 0.07, TV + tw + 0.07, TH, 1, STONE_LIGHT, 'plain');
  p.px.wall(p.P(TU - tw - 0.07, TV + tw + 0.07, TH + 1), p.P(TU + tw + 0.07, TV + tw + 0.07, TH + 1), 1, () => shade(CUARTEL_WALL[2], 0.9));
  p.hip(TU - tw - 0.07, TV - tw - 0.07, TU + tw + 0.07, TV + tw + 0.07, TH + 1.6, 3, CUARTEL_CAP);
  {
    const [lx, ly] = p.P(TU, TV, TH + 6);
    p.px.rect(Math.round(lx), Math.round(ly) - 1, 1, 2, hex('#f2d98a'));
  }

  // El mástil en el medio del patio, con la bandera: es lo que se ve desde el otro lado de la ciudad.
  // Va adelante y no alto, para que la bandera quede contra la tierra del patio: contra la cal del fondo
  // el celeste y el blanco se lavan y la bandera parece pintada en la pared del cuartel.
  {
    const mu = L * 0.6;
    const mv = W * 0.73;
    const [mx, my] = p.P(mu, mv, 0);
    const ix = Math.round(mx);
    const iy = Math.round(my);
    p.px.rect(ix, iy - 22, 1, 22, shade(STEEL[1], 0.86));
    const ROWS = [FLAG[0], FLAG[0], FLAG[1], FLAG[1], FLAG[0], FLAG[0]];
    ROWS.forEach((c, k) => p.px.rect(ix + 1, iy - 22 + k, 7, 1, c));
    // La punta que ondula: sin esto la bandera es un rectángulo pegado al palo.
    p.px.set(ix + 8, iy - 21, FLAG[0]);
    p.px.set(ix + 8, iy - 18, FLAG[1]);
    p.px.set(ix + 4, iy - 20, hex('#d9b45c'));
    p.px.set(ix - 1, iy - 22, shade(STEEL[1], 1.15));
  }

  // El camión de la guarnición, estacionado contra la cuadra larga.
  {
    const tu = L - 1.05;
    const tv = 1.02;
    p.box(tu, tv, tu + 0.34, tv + 0.16, 0, 4, OLIVA, 'plain');
    p.box(tu + 0.34, tv + 0.03, tu + 0.5, tv + 0.15, 0, 3, OLIVA, 'plain', [pane(0, 1, 2, 2, GLASS_LIT)]);
    const [wx, wy] = p.P(tu + 0.1, tv + 0.16, 0);
    const [wx2, wy2] = p.P(tu + 0.42, tv + 0.16, 0);
    p.px.rect(Math.round(wx), Math.round(wy) - 1, 2, 2, LEG);
    p.px.rect(Math.round(wx2), Math.round(wy2) - 1, 2, 2, LEG);
  }

  // Las bolsas de arena del puesto de guardia, al lado del portón.
  for (const [su, sv] of [
    [GU1 + 0.5, W - 0.5],
    [GU1 + 0.66, W - 0.38],
  ]) {
    p.box(su - 0.14, sv - 0.11, su + 0.14, sv + 0.11, 0, 2, [hex('#dccfa8'), hex('#cdbe94'), hex('#b6a67c')], 'plain');
  }

  // Los árboles del perímetro, del lado de adentro: van antes que la sombra y después de todo, porque
  // plantados antes la copa del que está atrás se le sube encima de la torre.
  p.tree(0.42, W - 0.5);
  p.tree(L - 0.5, W - 0.28);
  p.tree(1.05, W - 0.34);

  p.shadow(0.03, 0.03, L - 0.03, W - 0.03);
}

/** Paints el Regimiento on the lot the camera sees: 4x3. */
export function paintRegimiento(vw: number, vh: number): { px: Pixels; ax: number; ay: number; smoke: [number, number][] } {
  const p = penRect(vw, vh, REGIMIENTO_MAX_Z);
  paintRegimientoOn(p, vw, vh);
  return { px: p.px, ax: p.ax, ay: p.ay, smoke: p.smoke };
}

const regimientoCache = new Map<string, Sprite>();

/** El Regimiento as a sprite, keyed by the shape of the lot the camera sees. */
export function regimientoPixelSprite(vw: number, vh: number): Sprite {
  const key = `${vw}x${vh}`;
  let sprite = regimientoCache.get(key);
  if (!sprite) {
    sprite = spriteOf(paintRegimiento(vw, vh));
    regimientoCache.set(key, sprite);
  }
  return sprite;
}

const SANTUARIO_MAX_Z = 64;

/**
 * El ladrillo del santuario, con los tres tonos a mano: los 0,69 y 0,59 automáticos dejan un ladrillo
 * casi negro, y una basílica de ladrillo a la vista tiene que ser **colorada**.
 */
const SANTUARIO_BRICK: Ramp = [hex('#c07a5c'), hex('#9c5a44'), hex('#7d4433')];
/**
 * La pizarra del techo de la nave. No es un capricho: con la teja, el techo, las torres y las agujas son
 * cuatro rojos casi iguales y el edificio se lee como un solo bulto marrón del que sobresale una punta
 * (la de la torre que da contra el cielo). La pizarra separa el techo del ladrillo y deja que las **dos**
 * agujas se vean.
 */
const SANTUARIO_SLATE: Ramp = [hex('#8d9195'), hex('#6f7378'), hex('#575b60')];
/** Las agujas, más oscuras que el cuerpo: si no, la torre y su punta son una sola masa. */
const SANTUARIO_SPIRE: Ramp = [hex('#8a4a38'), hex('#6f3a2b'), hex('#552a1e')];
/** El atrio: piedra clara, la misma de los cornisamientos. */
const ATRIO: Ramp = [hex('#cdc5b0'), hex('#bcb39e'), hex('#a69c86')];
/** El azul del rosetón y el oro de la campana. */
const ROSETON = hex('#3f5a72');
/** La madera de la puerta principal: oscura, pero cálida. */
const PUERTA = hex('#4a3a2c');
const CAMPANA = hex('#c9a24a');

/**
 * El Santuario (3x4): **la basílica de Luján**. Ladrillo a la vista, la nave larga con techo de pizarra,
 * y el frente con las **dos torres y sus agujas** y el rosetón en el medio. Las agujas son lo que lo
 * distingue de cualquier otra iglesia: el edificio termina en dos puntas y no en una cúpula, y esa
 * silueta se ve desde el otro lado de la ciudad.
 *
 * La nave corre **a lo hondo del lote y no a lo ancho**: el frente mira a la cámara y el techo se va
 * para atrás. Dibujada a lo ancho —como el Cabildo, que es una fachada y nada más— la nave es una franja
 * larga paralela a la pantalla, el techo se sube por detrás de la fachada y la torre de la derecha queda
 * adentro de su silueta: se lee una sola aguja contra el cielo y la otra desaparece contra la pizarra.
 */
function paintSantuarioOn(p: Pen, vw: number, vh: number): void {
  const U = vw;
  const V = vh;
  const z0 = 2; // el zócalo de piedra
  // La nave va baja y el frente alto, que es como es la basílica: la fachada le saca una cabeza al techo
  // de la nave, y así las agujas se recortan contra el cielo y no contra la pizarra.
  const NAVE_H = 14;
  const FACADE_H = 23;
  const fv = V - 0.22; // el plano del frente
  const fd = 0.5; // la profundidad del cuerpo del frente
  const tw = 0.5; // el ancho de cada torre
  // La fachada toma casi todo el ancho del lote: con las torres pegadas a los bordes, el paño del medio
  // queda ancho y el portal respira. Con las torres más adentro, las caras **laterales** de las torres se
  // comen la luz del portal y la puerta aparece corrida a la izquierda.
  const n0 = 0.16;
  const n1 = U - 0.16;
  // La nave es **más angosta que la fachada**: la fachada toma todo el lote y la nave se mete, que es lo
  // que hace una basílica. Además, con la nave del ancho de la fachada el techo le ganaba en altura a la
  // aguja de la torre de la derecha.
  const m0 = 0.36;
  const m1 = U - 0.36;
  const PC = U / 2;
  const UM = PC; // la cumbrera de la nave, en el eje

  // El atrio: la basílica se abre sobre una plaza de piedra, no sobre tierra.
  p.poly([p.P(0.03, 0.03), p.P(U - 0.03, 0.03), p.P(U - 0.03, V - 0.03), p.P(0.03, V - 0.03)], (x, y) => {
    const n = noise(x, y, 41);
    if (n > 0.9) return shade(ATRIO[1], 1.08);
    if (n < 0.12) return shade(ATRIO[1], 0.9);
    return ATRIO[1];
  });

  // La nave: el cuerpo largo de ladrillo. El techo va a dos aguas con la cumbrera a lo largo de la nave,
  // así que desde la cámara se ve **una sola falda**, la de la derecha: la otra mira para el otro lado.
  const nb = fv - fd;
  p.box(m0, 0.18, m1, nb, z0, NAVE_H - z0, SANTUARIO_BRICK, 'brick', [], [
    { t0: 0, t1: 99, k0: 0, k1: z0, c: ATRIO[2] },
  ]);
  // Las **dos** faldas del techo: la de la derecha, que da a la cámara, y la de la izquierda, que se ve
  // desde arriba y va más oscura. Con una sola falda la mitad de la planta queda con el techo de ladrillo
  // del cuerpo, que es lo que se ve si no se pinta: una ladera es una superficie inclinada, no una tapa.
  const ry = NAVE_H + 5;
  p.poly([p.P(UM, 0.14, ry), p.P(m1 + 0.05, 0.14, NAVE_H), p.P(m1 + 0.05, nb, NAVE_H), p.P(UM, nb, ry)], (_x, y) =>
    y % 3 === 0 ? shade(SANTUARIO_SLATE[0], 0.9) : SANTUARIO_SLATE[0],
  );
  p.poly([p.P(m0 - 0.05, 0.14, NAVE_H), p.P(UM, 0.14, ry), p.P(UM, nb, ry), p.P(m0 - 0.05, nb, NAVE_H)], (_x, y) =>
    y % 3 === 0 ? shade(SANTUARIO_SLATE[2], 0.92) : SANTUARIO_SLATE[2],
  );
  // La cumbrera, que de día es la línea más clara del techo.
  p.px.line(p.P(UM, 0.14, ry), p.P(UM, nb, ry), shade(SANTUARIO_SLATE[0], 1.25));
  // Los contrafuertes del costado que se ve.
  for (let k = 1; k <= 3; k++) {
    const v = ((nb - 0.18) * k) / 4 + 0.18;
    p.box(m1 - 0.02, v - 0.1, m1 + 0.06, v + 0.1, z0, 13, SANTUARIO_BRICK, 'brick');
  }

  // El frente: un cuerpo de ladrillo más alto que la nave, con el cornisamiento de piedra y las pilastras
  // de las puntas. El cornisamiento va **en el muro** y no como losa: una losa de piedra sobre toda la
  // planta es una bandeja gris apoyada en el techo.
  const fw = Math.round((n1 - n0) * 16);
  const kc = FACADE_H - z0;
  p.box(n0, nb, n1, fv, z0, kc, SANTUARIO_BRICK, 'brick', [
    { t0: 0, t1: 99, k0: 0, k1: z0, c: ATRIO[2] },
    { t0: 0, t1: 99, k0: kc - 2, k1: kc - 1, c: STONE_LIGHT[2] },
    { t0: 0, t1: 99, k0: kc - 1, k1: kc, c: STONE_LIGHT[1] },
    { t0: 0, t1: 4, k0: 0, k1: kc - 2, c: shade(SANTUARIO_BRICK[1], 1.12) },
    { t0: fw - 4, t1: fw, k0: 0, k1: kc - 2, c: shade(SANTUARIO_BRICK[1], 1.12) },
    { t0: 0, t1: 99, k0: 10, k1: 11, c: STONE_LIGHT[2] },
  ], [], shade(ATRIO[2], 0.8));

  // El portal: un arco de piedra con la puerta oscura adentro, y el escalón. La puerta va **antes** que el
  // marco en la lista: el primer parche que toca un píxel gana.
  const dw = 7;
  const dt = Math.round(fw / 2) - dw;
  const front: Patch[] = [];
  // La puerta, en umber y no en casi negro: a 1x un rectángulo negro es un agujero en el muro.
  for (let k = 0; k < 8; k++) front.push({ t0: dt + 2, t1: dt + dw * 2 - 2, k0: k, k1: k + 1, c: PUERTA });
  front.push({ t0: dt + 3, t1: dt + dw * 2 - 3, k0: 8, k1: 9, c: PUERTA });
  front.push({ t0: dt + 4, t1: dt + dw * 2 - 4, k0: 9, k1: 10, c: shade(PUERTA, 1.5) });
  for (let k = 0; k < 11; k++) front.push({ t0: dt, t1: dt + dw * 2, k0: k, k1: k + 1, c: k > 8 ? STONE_LIGHT[2] : STONE_LIGHT[1] });
  p.box(n0 + 0.04, fv - 0.02, n1 - 0.04, fv + 0.05, 0, 11, SANTUARIO_BRICK, 'brick', front);
  p.box(n0 + 0.2, fv + 0.03, n1 - 0.2, fv + 0.13, 0, 1, ATRIO, 'plain');

  /** Una torre: el cuerpo, el campanario con la campana, el cornisamiento, la aguja y la cruz. */
  const tower = (u0: number, u1: number) => {
    // La torre se apoya **en el plano del frente** y es poco profunda: su cara lateral se proyecta sobre el
    // paño del medio, y con una torre honda el portal queda pegado a la torre de la izquierda.
    const tv1 = fv + 0.07;
    const tv0 = tv1 - 0.26;
    const bw = Math.round((u1 - u0) * 16);
    const bt = Math.round(bw / 2) - 2;
    const bs = Math.round(((tv1 - tv0) * 16) / 2) - 2;
    // La campana va **antes** que el hueco: el primer parche que toca un píxel gana, y al revés el hueco
    // se come la campana y el campanario queda un agujero negro.
    p.box(u0, tv0, u1, tv1, z0, 31, SANTUARIO_BRICK, 'brick', [
      { t0: 0, t1: 99, k0: 0, k1: z0, c: ATRIO[2] },
      { t0: 0, t1: 99, k0: 29, k1: 31, c: STONE_LIGHT[1] },
      { t0: 0, t1: 99, k0: 20, k1: 21, c: STONE_LIGHT[2] },
      { t0: bt + 1, t1: bt + 3, k0: 23, k1: 25, c: CAMPANA },
      { t0: bt, t1: bt + 4, k0: 21, k1: 28, c: INSIDE },
    ], [
      { t0: 0, t1: 99, k0: 29, k1: 31, c: STONE_LIGHT[2] },
      { t0: bs + 1, t1: bs + 3, k0: 23, k1: 25, c: CAMPANA },
      { t0: bs, t1: bs + 4, k0: 21, k1: 28, c: shade(INSIDE, 1.25) },
    ]);
    // La aguja: una pirámide alta y filosa, que es la punta que se ve de lejos. Va más oscura que el
    // cuerpo de la torre, o la torre y su punta son la misma masa.
    p.hip(u0 + 0.02, tv0 + 0.02, u1 - 0.02, tv1 - 0.02, z0 + 31, 19, SANTUARIO_SPIRE);
    // La cruz arranca **en la punta de la aguja**, no dos píxeles arriba: colgada en el aire no es una cruz,
    // es un signo flotando sobre la torre.
    const [cx2, cy2] = p.P((u0 + u1) / 2, (tv0 + tv1) / 2, z0 + 50.4);
    const ix = Math.round(cx2);
    const iy = Math.round(cy2);
    p.px.rect(ix, iy - 5, 1, 6, hex('#4f4a43'));
    p.px.rect(ix - 1, iy - 4, 3, 1, hex('#4f4a43'));
  };
  tower(n0, n0 + tw);
  tower(n1 - tw, n1);

  // El rosetón, entre las torres y arriba del portal: una rueda de vidrio con el aro de piedra y los
  // radios. Es el otro detalle que dice basílica desde lejos.
  {
    const [rx, ry] = p.P(PC, fv, z0 + 15);
    const cx3 = Math.round(rx);
    const cy3 = Math.round(ry);
    p.px.blob(cx3, cy3, 4, 3.8, [shade(ROSETON, 1.35), ROSETON, shade(ROSETON, 0.7)], STONE_LIGHT[1], false);
    p.px.set(cx3, cy3 - 2, STONE_LIGHT[2]);
    p.px.set(cx3, cy3 + 2, STONE_LIGHT[2]);
    p.px.set(cx3 - 2, cy3, STONE_LIGHT[2]);
    p.px.set(cx3 + 2, cy3, STONE_LIGHT[2]);
  }

  // Los árboles, en el atrio y **afuera de la planta**: plantado adentro, el de atrás aparece arriba del
  // techo y parece un árbol que crece de la pizarra.
  p.tree(0.3, V - 0.16);
  p.tree(U - 0.3, V - 0.12);
  p.shadow(0.03, 0.03, U - 0.03, V - 0.03);
}

/** Paints el Santuario on the lot the camera sees: 3x4. */
export function paintSantuario(vw: number, vh: number): { px: Pixels; ax: number; ay: number; smoke: [number, number][] } {
  const p = penRect(vw, vh, SANTUARIO_MAX_Z);
  paintSantuarioOn(p, vw, vh);
  return { px: p.px, ax: p.ax, ay: p.ay, smoke: p.smoke };
}

const santuarioCache = new Map<string, Sprite>();

/** El Santuario as a sprite, keyed by the shape of the lot the camera sees. */
export function santuarioPixelSprite(vw: number, vh: number): Sprite {
  const key = `${vw}x${vh}`;
  let sprite = santuarioCache.get(key);
  if (!sprite) {
    sprite = spriteOf(paintSantuario(vw, vh));
    santuarioCache.set(key, sprite);
  }
  return sprite;
}

const SINDICATO_MAX_Z = 40;

/** El hormigón del sindicato, con los tres tonos a mano: el automático lo deja gris de oficina. */
const SINDICATO_WALL: Ramp = [hex('#e6dfd0'), hex('#d2cbbb'), hex('#b6ae9c')];
/** El rojo de la bandera y del estandarte: es lo único rojo del edificio y lo que lo nombra. */
const SINDICATO_RED = hex('#b23a2e');
/** El patio de cemento, que es donde el sindicato hace sus asambleas. */
const PATIO_SECO: Ramp = [hex('#c9c4b6'), hex('#b8b2a4'), hex('#a29c8f')];

/**
 * El Sindicato (3x2): **el salón de un pueblo obrero**, como el de los frigoríficos de Berisso. Un bloque
 * de hormigón bajo con el salón grande atrás, la faja de ventanas de las oficinas y el portón del salón en
 * el medio, con el estandarte rojo encima. Un sindicato es un edificio que **dice su nombre**: sin el
 * estandarte es una sede social cualquiera.
 */
function paintSindicatoOn(p: Pen, vw: number, vh: number): void {
  const U = vw;
  const V = vh;
  const z0 = 1;
  const SALON_H = 22; // el salón, adelante y bajo
  const OFI_H = 29; // las oficinas, atrás, que le sacan una cabeza
  const HA0 = 0.22;
  const HA1 = 1.06;
  const SA0 = 1.06;
  const SA1 = 1.68;

  // El patio de cemento, con las juntas de los paños: el piso tiene que ser una losa, no una mancha.
  p.poly([p.P(0.03, 0.03), p.P(U - 0.03, 0.03), p.P(U - 0.03, V - 0.03), p.P(0.03, V - 0.03)], (_x, y) =>
    y % 7 === 0 ? shade(PATIO_SECO[1], 0.92) : PATIO_SECO[1],
  );

  // Las oficinas, atrás y más altas: la faja de vidrio corre por toda la cara y es lo que se ve por encima
  // del salón. Una sola masa de hormigón no se lee; dos escalonadas sí.
  const ow = Math.round((U - 0.72) * 16);
  const ofi: Patch[] = [
    { t0: 0, t1: 99, k0: 0, k1: z0, c: PATIO_SECO[2] },
    { t0: 0, t1: 99, k0: OFI_H - z0 - 1, k1: OFI_H - z0, c: STONE_LIGHT[2] },
  ];
  // La faja tiene que quedar **por encima del techo del salón** o no se ve: lo único que asoma de las
  // oficinas son los últimos píxeles de su cara.
  ofi.push(...glazed(3, ow - 3, OFI_H - z0 - 5, 4, 4));
  p.box(0.36, HA0, U - 0.36, HA1, z0, OFI_H - z0, SINDICATO_WALL, 'plain', ofi, [
    { t0: 0, t1: 99, k0: 0, k1: z0, c: PATIO_SECO[2] },
    { t0: 0, t1: 99, k0: OFI_H - z0 - 1, k1: OFI_H - z0, c: STONE_LIGHT[2] },
  ]);
  p.parapet(0.36, HA0, U - 0.36, HA1, z0 + OFI_H - z0, 1, [ROOF_DECK, ROOF_DECK, shade(ROOF_DECK, 0.8)]);

  // El salón, adelante: el bloque ancho con el portón en el medio y la faja de ventanas altas.
  const fw = Math.round((U - 0.36) * 16);
  const salon: Patch[] = [
    { t0: 0, t1: 99, k0: 0, k1: z0, c: PATIO_SECO[2] },
    { t0: 0, t1: 99, k0: SALON_H - z0 - 1, k1: SALON_H - z0, c: STONE_LIGHT[1] },
  ];
  salon.push(...glazed(2, fw - 2, SALON_H - z0 - 6, 4, 5));
  p.box(0.18, SA0, U - 0.18, SA1, z0, SALON_H - z0, SINDICATO_WALL, 'plain', salon, salon, ROOF_DECK);
  p.parapet(0.18, SA0, U - 0.18, SA1, z0 + SALON_H - z0, 1, [ROOF_DECK, ROOF_DECK, shade(ROOF_DECK, 0.8)]);

  // El portón del salón: ancho, con el marco de piedra y el escalón. La puerta va en umber y no en negro:
  // a 1x un rectángulo negro es un agujero en la pared. **La puerta va primero en la lista**, porque el
  // primer parche que toca un píxel gana y el marco la tapaba entera.
  const dw = 7;
  const dt = Math.round(fw / 2) - dw;
  // El portón va en madera clara y con la junta de las dos hojas: a 1x un rectángulo oscuro es un agujero.
  const hoja = shade(PUERTA, 1.45);
  const doorP: Patch[] = [
    { t0: dt + 1, t1: dt + dw * 2 - 1, k0: 1, k1: 9, c: hoja },
    { t0: dt + dw - 1, t1: dt + dw + 1, k0: 1, k1: 9, c: shade(PUERTA, 1.05) },
    { t0: dt + 3, t1: dt + dw * 2 - 3, k0: 4, k1: 9, c: shade(hoja, 1.2) },
    { t0: dt, t1: dt + dw * 2, k0: 9, k1: 10, c: STONE_LIGHT[1] },
    { t0: dt, t1: dt + 1, k0: 0, k1: 10, c: STONE_LIGHT[1] },
    { t0: dt + dw * 2 - 1, t1: dt + dw * 2, k0: 0, k1: 10, c: STONE_LIGHT[2] },
  ];
  p.box(0.18, SA1, U - 0.18, SA1 + 0.06, 0, 10, SINDICATO_WALL, 'plain', doorP);
  p.box(0.18, SA1 + 0.02, U - 0.18, SA1 + 0.14, 0, 1, STONE_LIGHT, 'plain');

  // El estandarte rojo sobre el portón: un paño **pegado al muro**, así que sigue el ángulo de la fachada
  // como cualquier otro parche. Pintado con píxeles absolutos quedaba un cartel de frente, flotando.
  {
    const papel = hex('#f2efe6');
    const bw = 0.46; // media anchura del paño, en celdas
    const tw2 = Math.round(bw * 2 * 16); // el ancho de la cara, en píxeles
    p.box(
      U / 2 - bw,
      SA1 + 0.015,
      U / 2 + bw,
      SA1 + 0.085,
      z0 + 9,
      6,
      tone(SINDICATO_RED),
      'plain',
      [
        { t0: 0, t1: 99, k0: 0, k1: 1, c: shade(SINDICATO_RED, 0.72) },
        { t0: 0, t1: 99, k0: 1, k1: 2, c: SINDICATO_RED },
        { t0: 2, t1: tw2 - 2, k0: 2, k1: 4, c: papel },
        { t0: 0, t1: 99, k0: 4, k1: 5, c: SINDICATO_RED },
        { t0: 0, t1: 99, k0: 5, k1: 6, c: shade(SINDICATO_RED, 1.38) },
      ],
      // El canto del paño va rojo oscuro: en blanco se lee como una punta rara del cartel.
      [{ t0: 0, t1: 99, k0: 0, k1: 6, c: shade(SINDICATO_RED, 0.8) }],
    );
  }

  // La bandera roja sobre la azotea de las oficinas: el mástil y el paño, con el borde de arriba claro.
  {
    const [fx, fy] = p.P(U / 2, HA0 + 0.26, z0 + OFI_H + 1);
    const cx = Math.round(fx);
    const cy = Math.round(fy);
    p.px.rect(cx, cy - 10, 1, 10, LEG);
    for (let j = 0; j < 6; j++) p.px.rect(cx + 1, cy - 10 + j, j < 4 ? 5 : 3, 1, SINDICATO_RED);
    p.px.rect(cx + 1, cy - 10, 5, 1, shade(SINDICATO_RED, 1.45));
  }

  // El árbol del patio, adelante a la izquierda, y la sombra.
  p.tree(0.3, V - 0.12);
  p.shadow(0.03, 0.03, U - 0.03, V - 0.03);
}

/** Paints el Sindicato on the lot the camera sees: 3x2. */
export function paintSindicato(vw: number, vh: number): { px: Pixels; ax: number; ay: number; smoke: [number, number][] } {
  const p = penRect(vw, vh, SINDICATO_MAX_Z);
  paintSindicatoOn(p, vw, vh);
  return { px: p.px, ax: p.ax, ay: p.ay, smoke: p.smoke };
}

const sindicatoCache = new Map<string, Sprite>();

/** El Sindicato as a sprite, keyed by the shape of the lot the camera sees. */
export function sindicatoPixelSprite(vw: number, vh: number): Sprite {
  const key = `${vw}x${vh}`;
  let sprite = sindicatoCache.get(key);
  if (!sprite) {
    sprite = spriteOf(paintSindicato(vw, vh));
    sindicatoCache.set(key, sprite);
  }
  return sprite;
}

export function spriteOf(painted: { px: Pixels; ax: number; ay: number; smoke?: [number, number][]; attach?: [number, number] }): Sprite {
  return { canvas: painted.px.toCanvas(1), ax: painted.ax, ay: painted.ay, smoke: painted.smoke ?? [], attach: painted.attach };
}

export const residentialPixelSprite = (level: number, variant: number): Sprite => spriteOf(paintResidential(level, variant));
export const commercialPixelSprite = (level: number, variant: number): Sprite => spriteOf(paintCommercial(level, variant));
export const lotPixelSprite = (kind: LotKind, variant: number): Sprite => spriteOf(paintLot(kind, variant));
export const industrialPixelSprite = (level: number, variant: number): Sprite => spriteOf(paintIndustrial(level, variant));

/* ---------- El campo ---------- */

/**
 * El campo, dibujado desde las plantas de acopio de verdad.
 *
 * Las referencias no son el silo de tambo aislado de las estampillas: son la planta de acopio pampeana —
 * Eduardo Castex, Junín, San Pedro —, que es **dos cilindros de chapa galvanizada** con bandas horizontales,
 * una **torre de noria** más alta que ellos y la **cinta inclinada** que sube el grano. Sin la noria y la
 * cinta quedan dos latas paradas; con ellas se lee de un vistazo que ahí se acopia grano.
 *
 * El trigo del lote no se dibuja espiga por espiga: a 1× son franjas doradas separadas por el surco de
 * tierra, y el surco es lo que da la escala.
 */
const TIERRA = ramp('#7d5c38');
const TIERRA_SECA = hex('#96714a');
const TRIGO = ['#c9a227', '#e0b542', '#f2d472'].map(hex);
const TRIGO_SOMBRA = hex('#8f7420');
const CHAPA_SILO = ramp('#c8d0d8');
const CHAPA_VIEJA = ramp('#9aa4ae');
const TINGLADO = ramp('#7f9cba');

/**
 * El lote de cultivo: tierra arada en franjas y el trigo encima.
 *
 * Las franjas van en la dirección de la `u` porque el arado sigue la pendiente del lote en isométrico: al
 * revés, el dibujo se lee como una reja y no como un sembrado.
 */
function paintFarmLot(): { px: Pixels; ax: number; ay: number } {
  const p = penLot(2, 16);
  // El suelo del lote: tierra arada, con el borde en sombra para que se apoye y no flote.
  p.poly([p.P(0.04, 0.04), p.P(1.96, 0.04), p.P(1.96, 1.96), p.P(0.04, 1.96)], (x, y) => (bayer(x, y) < 0.5 ? TIERRA[1] : TIERRA[0]));
  p.px.line(p.P(0.04, 1.96), p.P(1.96, 1.96), TIERRA[0]);
  // El trigo en franjas anchas, no en puntos: a 1× lo que se lee es la banda dorada, no la espiga.
  for (let s = 0; s < 5; s++) {
    const v0 = 0.1 + s * 0.38;
    const v1 = v0 + 0.24;
    // La franja: el surco de tierra a los dos lados y el trigo en el medio.
    p.px.line(p.P(0.1, v0), p.P(1.9, v0), TIERRA_SECA);
    p.poly([p.P(0.1, v0 + 0.03), p.P(1.9, v0 + 0.03), p.P(1.9, v1 - 0.03), p.P(0.1, v1 - 0.03)], (x, y) => {
      // Rayas de espiga a lo largo: tres tonos que se alternan, así la franja tiene textura sin ser ruido.
      return TRIGO[[0, 1, 1, 2, 1, 0][(x + 2 * y) % 6]];
    });
    // El borde de la franja que da al sur queda en sombra, y el de arriba se ilumina.
    p.px.line(p.P(0.1, v1 - 0.03), p.P(1.9, v1 - 0.03), TRIGO_SOMBRA);
    p.px.line(p.P(0.1, v0 + 0.03), p.P(1.9, v0 + 0.03), TRIGO[2]);
  }
  return { px: p.px, ax: p.ax, ay: p.ay };
}

/**
 * El silo: la planta de acopio.
 *
 * En las referencias argentinas —la de Eduardo Castex, la de Junín— lo que se ve de lejos **no** es un
 * cilindro: es una **torre rectangular de chapa**, alta y angosta, con las virolas horizontales, y al lado
 * la **noria** todavía más alta, que es la que sube el grano. El cilindro a 1× se lee como una lata y no
 * dice nada; la torre con la noria dice "acá se acopia grano" desde el otro lado del mapa.
 */
function paintSilo(): { px: Pixels; ax: number; ay: number } {
  const p = penLot(2, 52);
  // La playa de maniobras: el silo no está en el pasto, está sobre un piso de tierra apisonada.
  p.poly([p.P(0.04, 0.04), p.P(1.96, 0.04), p.P(1.96, 1.96), p.P(0.04, 1.96)], (x, y) => (bayer(x, y) < 0.5 ? GRAVEL[1] : GRAVEL[2]));
  // Las virolas: una junta cada cuatro píxeles, que es lo que dice "chapa atornillada" y no "tanque liso".
  const virolas = (h: number): Patch[] => {
    const out: Patch[] = [];
    for (let k = 4; k < h; k += 4) out.push({ t0: 0, t1: 99, k0: k, k1: k + 1, c: shade(CHAPA_SILO[1], 0.84) });
    return out;
  };
  // La torre: alta y rectangular, con el techo a dos aguas bajo, que es el de la foto.
  const h = 34;
  p.box(0.14, 0.18, 1.5, 1.34, 0, h, CHAPA_SILO, 'plain', virolas(h), virolas(h), CHAPA_SILO[0]);
  p.gable(0.1, 0.14, 1.54, 1.38, h, 5, CHAPA_VIEJA, shade(CHAPA_VIEJA[1], 0.75), 'sheet');
  // La noria: más angosta y más alta que la torre, pegada al lado que da al fondo. Es el remate del dibujo.
  const hn = 46;
  p.box(1.12, 0.28, 1.46, 0.72, 0, hn, CHAPA_VIEJA, 'plain', virolas(hn), virolas(hn), CHAPA_VIEJA[0]);
  p.gable(1.1, 0.26, 1.48, 0.74, hn, 4, CHAPA_VIEJA, shade(CHAPA_VIEJA[1], 0.7), 'sheet');
  // La cabeza de la noria: la caja de mando con su tejadillo, siempre en otro tono para que se distinga.
  p.box(1.16, 0.32, 1.44, 0.68, hn + 4, 3, CHAPA_VIEJA, 'plain', [], [], hex('#b8962f'));
  // La puerta del pie y la escalera del costado: dan la escala de lo alto que es.
  p.box(0.3, 1.34, 0.52, 1.34, 0, 7, ramp('#5a4a3a'), 'plain');
  for (let k = 3; k < 30; k += 4) {
    const [ex, ey] = p.P(1.5, 1.1, k);
    p.px.rect(Math.round(ex) - 1, Math.round(ey), 3, 1, shade(CHAPA_SILO[1], 0.62));
  }
  p.px.line(p.P(1.5, 1.1, 1), p.P(1.5, 1.1, 30), shade(CHAPA_SILO[1], 0.5));
  return { px: p.px, ax: p.ax, ay: p.ay };
}

/**
 * La feria: el tinglado de chapa con el techo a dos aguas, abierto de un lado, y los cajones en la playa.
 *
 * Es un mercado de concentración, no un local: por eso es un galpón abierto con la mercadería a la vista y
 * no un edificio con puerta y vidriera. El techo azul es el de las referencias de Junín.
 */
function paintMarket(): { px: Pixels; ax: number; ay: number } {
  const p = penLot(3, 44);
  p.poly([p.P(0.04, 0.04), p.P(2.96, 0.04), p.P(2.96, 2.96), p.P(0.04, 2.96)], (x, y) => (bayer(x, y) < 0.5 ? GRAVEL[1] : GRAVEL[2]));
  const WALL = ramp('#cbbfa4');
  const VANO = ramp('#3d3630');
  // El galpón: pared baja de ladrillo con el frente abierto en dos vanos, y el techo de chapa a dos aguas.
  p.box(0.2, 0.2, 2.4, 1.7, 0, 16, WALL, 'brick');
  p.gable(0.14, 0.14, 2.46, 1.76, 16, 10, TINGLADO, shade(TINGLADO[1], 0.78), 'sheet');
  // Los vanos: van sobre la cara que da al frente y se pintan como cajas de altura distinta, no como
  // parches, para que la sombra del dintel quede donde va.
  for (const [u0, u1] of [
    [0.42, 1.18],
    [1.34, 2.12],
  ] as const) {
    p.box(u0, 1.7, u1, 1.7, 0, 11, VANO, 'plain');
    p.box(u0, 1.7, u1, 1.7, 11, 2, WALL, 'plain', [], [], shade(WALL[1], 0.8));
  }
  // Los cajones de la cosecha, apilados en la playa: dos filas y una torre de tres.
  const cajon = (u: number, v: number, alto: number): void => {
    const [bx, by] = p.P(u, v, alto);
    p.px.rect(Math.round(bx), Math.round(by) - 5, 7, 5, hex('#b98f52'));
    p.px.rect(Math.round(bx), Math.round(by) - 5, 7, 1, hex('#d8b878'));
    p.px.rect(Math.round(bx), Math.round(by) - 1, 7, 1, hex('#7a5a36'));
    p.px.rect(Math.round(bx) + 3, Math.round(by) - 4, 1, 3, hex('#8f6b3c'));
  };
  cajon(0.5, 2.5, 0);
  cajon(0.5, 2.5, 5);
  cajon(1.1, 2.6, 0);
  cajon(1.7, 2.5, 0);
  cajon(2.3, 2.6, 0);
  return { px: p.px, ax: p.ax, ay: p.ay };
}

const campoCache = new Map<string, Sprite>();

/** El sprite del lote de cultivo. */
export function farmPixelSprite(): Sprite {
  let sprite = campoCache.get('farm');
  if (!sprite) {
    sprite = spriteOf(paintFarmLot());
    campoCache.set('farm', sprite);
  }
  return sprite;
}

/** El sprite del silo. */
export function siloPixelSprite(): Sprite {
  let sprite = campoCache.get('silo');
  if (!sprite) {
    sprite = spriteOf(paintSilo());
    campoCache.set('silo', sprite);
  }
  return sprite;
}

/** El sprite de la feria. */
export function marketPixelSprite(): Sprite {
  let sprite = campoCache.get('market');
  if (!sprite) {
    sprite = spriteOf(paintMarket());
    campoCache.set('market', sprite);
  }
  return sprite;
}
