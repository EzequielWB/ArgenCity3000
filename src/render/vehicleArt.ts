/**
 * The vehicles of the map, in pixels.
 *
 * The cars, the buses, the boats, the cruise ship and the planes are the last things the game drew with
 * canvas strokes. On a map drawn with no smoothing they showed as soft smudges: an anti-aliased
 * parallelogram, one flat face, no wheels and no shadow. Here they are painted at 1x with the same pen as
 * the buildings, in lot units, so each one has a lit top, a side in shade and its shadow on the ground.
 *
 * A vehicle is drawn four times, one per heading, instead of being rotated: rotating a 1x sprite breaks
 * the pixel, and a car that drives away has to show its tail lights on the face the camera sees. Every
 * heading falls on an axis of (u, v), so one painter serves the four of them.
 */
import { BUS_COLORS, CAR_COLORS } from '../config';
import { hex, shade, Pixels, type Pt, type RGB, type WallPaint } from './pixel';
import { Pen, ramp, spriteOf, type Ramp } from './pixelArt';
import type { Sprite } from './sprites';

/** Heading of a vehicle in view coordinates, in the order `traffic` and `vessels` rotate their steps. */
export type Heading = 0 | 1 | 2 | 3;

/** The heading of a view-space step, for the sprite to pick. */
export function headingOf(dx: number, dy: number): Heading {
  if (dx > 0) return 0;
  if (dy > 0) return 1;
  if (dx < 0) return 2;
  return 3;
}

/**
 * The frame of a heading: a point `t` lots along the way the vehicle goes and `s` lots across it, turned
 * to (u, v) of the ground. Turning the frame is what gives the four headings one painter.
 */
function frame(dir: Heading): (t: number, s: number) => Pt {
  switch (dir) {
    case 0:
      return (t, s) => [t, s];
    case 1:
      return (t, s) => [-s, t];
    case 2:
      return (t, s) => [-t, -s];
    default:
      return (t, s) => [s, -t];
  }
}

/** A pen with just enough room for a vehicle `maxZ` px tall and `span` px wide, and for its shadow. */
function rig(maxZ: number, span: number): Pen {
  const w = Math.ceil(span) + 4;
  return new Pen(new Pixels(w, maxZ + Math.ceil(w / 4) + 6), Math.floor(w / 2), maxZ + 2);
}

/** The two faces of a footprint the camera sees, and which of them is the nose. */
interface Faces {
  /** The face at max u. */
  u: [Pt, Pt];
  /** The face at max v. */
  v: [Pt, Pt];
  /** For headings along u the visible cap is the one at max u; across it, the one at max v. */
  capIsU: boolean;
  /** Whether the visible cap is the nose (the vehicle drives towards the camera) or the tail. */
  nose: boolean;
}

/**
 * The four corners of a footprint, in lot units, and the faces the camera sees of it. The faces at max u
 * and max v are the visible ones in this projection, so which of them is the nose follows from the frame.
 */
function footprint(dir: Heading, len: number, wid: number): { corners: Pt[]; faces: Faces } {
  const put = frame(dir);
  const hl = len / 2;
  const hw = wid / 2;
  const corners = [put(hl, -hw), put(hl, hw), put(-hl, hw), put(-hl, -hw)];
  const umax = Math.max(...corners.map((q) => q[0]));
  const vmax = Math.max(...corners.map((q) => q[1]));
  const onU = corners.filter((q) => q[0] === umax);
  const onV = corners.filter((q) => q[1] === vmax);
  return { corners, faces: { u: [onU[0], onU[1]], v: [onV[0], onV[1]], capIsU: dir === 0 || dir === 2, nose: dir === 0 || dir === 1 } };
}

const TYRE: RGB = hex('#15141a');
const GLASS_DARK: RGB = hex('#2b3a4a');
const HEADLIGHT: RGB = hex('#f7e6a8');
const TAILLIGHT: RGB = hex('#c8392f');
const HULL_DARK: RGB = hex('#243044');
const HULL_TOP: RGB = hex('#e8e2d2');
const WATER_LINE: RGB = hex('#7fb6cb');
const RED_BAND: RGB = hex('#c8392f');
const WHITE: RGB = hex('#f4f0e6');
const MAST: RGB = hex('#4a4440');
const FLAG: RGB = hex('#f2c230');

/** A point a fraction `t` along a face, on the ground. */
const along = (foot: [Pt, Pt], t: number): Pt => [foot[0][0] + (foot[1][0] - foot[0][0]) * t, foot[0][1] + (foot[1][1] - foot[0][1]) * t];

/**
 * Paints a road vehicle: body, glass, lights and the shadow under it. A car is two pixels tall and a bus
 * three, so the glass is the row above the skirt and everything else is decided by that.
 */
export function roadVehicle(kind: 'car' | 'taxi' | 'bus', color: number, dir: Heading): { px: Pixels; ax: number; ay: number } {
  const bus = kind === 'bus';
  const len = bus ? 0.56 : 0.3;
  const wid = bus ? 0.17 : 0.15;
  const h = bus ? 3 : 2;
  const p = rig(h + (bus ? 2 : 4), 32 * (len + wid));
  const body: Ramp =
    kind === 'taxi'
      ? ramp('#33303a')
      : bus
        ? ramp(BUS_COLORS[((color % BUS_COLORS.length) + BUS_COLORS.length) % BUS_COLORS.length].hex)
        : ramp(CAR_COLORS[((color % CAR_COLORS.length) + CAR_COLORS.length) % CAR_COLORS.length]);
  const { corners, faces } = footprint(dir, len, wid);
  const at = (q: Pt, z = 0): Pt => p.P(q[0], q[1], z);
  const foot = (face: [Pt, Pt]): [Pt, Pt] => [at(face[0]), at(face[1])];
  // The shadow, a pixel below, the same rule as the buildings.
  p.px.shadow(
    corners.map((q) => {
      const [x, y] = at(q, -0.5);
      return [x - 0.5, y + 1] as Pt;
    }),
    0.34,
  );
  const cap = foot(faces.capIsU ? faces.u : faces.v);
  const side = foot(faces.capIsU ? faces.v : faces.u);
  // The side: the skirt in shade, the band of windows, and the wheels at the bottom.
  // A bus carries its windows in the body itself; a car is a platform with a cabin on top, so its body is
  // all paint and the glass comes later. That cabin is what makes the car read at six pixels long.
  const sidePaint: WallPaint = (t, k) => (k === 0 ? shade(body[1], 0.72) : bus && k === h - 1 ? body[1] : bus ? GLASS_DARK : body[1]);
  p.px.wall(side[0], side[1], h, sidePaint);
  for (const t of [0.14, 0.86]) {
    const [x, y] = along(side, t);
    p.px.rect(Math.round(x), Math.round(y) - 1, 1, 1, TYRE);
  }
  // The cap: the skirt at the bottom, the windshield above it, and a light at each end of the skirt.
  const capPaint: WallPaint = (t, k) => (k === 0 ? body[2] : bus && faces.nose ? GLASS_DARK : body[1]);
  p.px.wall(cap[0], cap[1], h, capPaint);
  // A light at each end of the skirt, inset so it never lands past the face: one pixel of car is a lot.
  for (const t of [0.06, 0.94]) {
    const [x, y] = along(cap, t);
    p.px.rect(Math.round(x), Math.round(y) - 1, 1, 1, faces.nose ? HEADLIGHT : TAILLIGHT);
  }
  if (bus) {
    // The board over the windshield.
    const [mx, my] = along(cap, 0.5);
    p.px.rect(Math.round(mx) - 1, Math.round(my) - h, 3, 1, HEADLIGHT);
  }
  // The roof, lit; the taxi wears it yellow, which is how you tell it from a block away.
  const roof = kind === 'taxi' ? ramp('#e8bf3f')[0] : body[0];
  p.px.poly(
    corners.map((q) => at(q, h)),
    () => roof,
  );
  // The windshield and the rear window on the roof itself. The nose edge of the roof is the one between
  // the two corners at t = +len / 2.
  const edge = (i: number, j: number, z: number, c: RGB) => {
    const a = at(corners[i], z);
    const b = at(corners[j], z);
    p.px.line([a[0], a[1]], [b[0], b[1]], c);
  };
  if (bus) {
    edge(0, 1, h, GLASS_DARK);
    edge(3, 2, h, shade(body[1], 0.8));
  } else {
    // The cabin: a short box on the middle of the platform, glass on its sides and lit on top.
    const cab = footprint(dir, len * 0.54, wid * 0.84);
    const cz = h;
    const cabAt = (q: Pt): Pt => at(q, cz);
    const cabFace = (face: [Pt, Pt]): [Pt, Pt] => [cabAt(face[0]), cabAt(face[1])];
    const glass: WallPaint = () => GLASS_DARK;
    p.px.wall(...cabFace(cab.faces.u), 1, glass);
    p.px.wall(...cabFace(cab.faces.v), 1, glass);
    // The pillars: a pixel of body at the two corners of the windshield, so the glass is a window and not a hole.
    for (const q of cab.faces.u) {
      const [x, y] = cabAt(q);
      p.px.rect(Math.round(x), Math.round(y) - 1, 1, 1, body[1]);
    }
    p.px.poly(
      cab.corners.map((q) => cabAt(q)),
      () => body[0],
    );
  }
  if (kind === 'taxi') {
    const [cx, cy] = at(frame(dir)(0, 0), h + 2);
    p.px.rect(Math.round(cx) - 1, Math.round(cy), 2, 1, WHITE);
  }
  return { px: p.px, ax: p.ax, ay: p.ay };
}

const vehicleCache = new Map<string, Sprite>();

/** The sprite of a road vehicle, cached by kind, colour and heading. */
export function carPixelSprite(kind: 'car' | 'taxi' | 'bus', color: number, dir: Heading): Sprite {
  const key = `road:${kind}:${color}:${dir}`;
  let sprite = vehicleCache.get(key);
  if (!sprite) {
    sprite = spriteOf(roadVehicle(kind, color, dir));
    vehicleCache.set(key, sprite);
  }
  return sprite;
}
