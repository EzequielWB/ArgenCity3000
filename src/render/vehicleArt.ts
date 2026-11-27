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
const WAKE: RGB = hex('#cfe6ef');
const WING: RGB = hex('#c9ccd1');
const GLASS_DARK: RGB = hex('#2b3a4a');
const HEADLIGHT: RGB = hex('#f7e6a8');
const TAILLIGHT: RGB = hex('#c8392f');
const HULL_DARK: RGB = hex('#243044');
const DECK: RGB = hex('#d8cfb8');
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
  const p = rig(h + (bus ? 2 : 4), 16 * (len + wid) + 8);
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
  const sidePaint: WallPaint = (_t, k) => (k === 0 ? shade(body[1], 0.72) : bus && k === h - 1 ? body[1] : bus ? GLASS_DARK : body[1]);
  p.px.wall(side[0], side[1], h, sidePaint);
  for (const t of [0.14, 0.86]) {
    const [x, y] = along(side, t);
    p.px.rect(Math.round(x), Math.round(y) - 1, 1, 1, TYRE);
  }
  // The cap: the skirt at the bottom, the windshield above it, and a light at each end of the skirt.
  const capPaint: WallPaint = (_t, k) => (k === 0 ? body[2] : bus && faces.nose ? GLASS_DARK : body[1]);
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
    const cabU = cabFace(cab.faces.u);
    const cabV = cabFace(cab.faces.v);
    p.px.wall(cabU[0], cabU[1], 1, glass);
    p.px.wall(cabV[0], cabV[1], 1, glass);
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

/** Paints a boat: the hull on the water, the deck on it, and the wheelhouse or the funnel above. */
function paintBoat(kind: 'tour' | 'fishing' | 'cruise', dir: Heading): { px: Pixels; ax: number; ay: number } {
  const cruise = kind === 'cruise';
  const fishing = kind === 'fishing';
  const len = cruise ? 1.2 : fishing ? 0.55 : 0.65;
  const wid = cruise ? 0.46 : fishing ? 0.2 : 0.24;
  const hullH = cruise ? 3 : 2;
  const deckH = cruise ? 4 : 2;
  const p = rig(hullH + deckH + 5, 16 * (len + wid) + 12);
  const { corners, faces } = footprint(dir, len, wid);
  const at = (q: Pt, z = 0): Pt => p.P(q[0], q[1], z);
  const foot = (face: [Pt, Pt]): [Pt, Pt] => [at(face[0]), at(face[1])];
  // Its shadow on the water, a pixel below and to the left, like everything else.
  p.px.shadow(
    corners.map((q) => {
      const [x, y] = at(q, -0.5);
      return [x - 0.5, y + 1.5] as Pt;
    }),
    0.3,
  );
  // The wake: two pixels of foam behind the stern, which is what tells a boat moving from one parked.
  const [wx, wy] = along([at(corners[2], 0), at(corners[3], 0)], 0.5);
  p.px.rect(Math.round(wx), Math.round(wy) + 1, 2, 1, WAKE);
  p.px.rect(Math.round(wx) - 1, Math.round(wy) + 2, 2, 1, WAKE);
  // The hull: the work below the waterline dark, the freeboard white, and the deck on top.
  const cap = foot(faces.capIsU ? faces.u : faces.v);
  const side = foot(faces.capIsU ? faces.v : faces.u);
  const hull: WallPaint = (_t, k) => (k === 0 ? HULL_DARK : fishing && k === 1 ? RED_BAND : WHITE);
  p.px.wall(side[0], side[1], hullH, hull);
  p.px.wall(cap[0], cap[1], hullH, hull);
  if (cruise) {
    // The portholes along the hull, one every other pixel: without them the ship is a white slab.
    for (let t = 0.08; t < 0.92; t += 0.14) {
      const [x, y] = along(side, t);
      p.px.rect(Math.round(x), Math.round(y) - 1 - (hullH - 1), 1, 1, GLASS_DARK);
    }
  }
  p.px.poly(
    corners.map((q) => at(q, hullH)),
    () => DECK,
  );
  // What stands on the deck.
  const houseLen = cruise ? len * 0.7 : fishing ? wid * 1.4 : len * 0.5;
  const houseWid = cruise ? wid * 0.72 : wid * 0.8;
  const house = footprint(dir, houseLen, houseWid);
  if (fishing) {
    // The wheelhouse at the stern, a mast with its yellow flag, and a red band along the hull.
    const wf = footprint(dir, houseLen, houseWid);
    const wAt = (q: Pt): Pt => at(q, hullH);
    const wu = wf.faces.u.map(wAt);
    const wv = wf.faces.v.map(wAt);
    p.px.wall(wu[0], wu[1], 2, () => WHITE);
    p.px.wall(wv[0], wv[1], 2, () => WHITE);
    p.px.rect(Math.round(wAt(wf.corners[0])[0]), Math.round(wAt(wf.corners[0])[1]) - 1, 1, 1, GLASS_DARK);
    const [mx, my] = at(corners[0], hullH);
    p.px.rect(Math.round(mx), Math.round(my) - 6, 1, 6, MAST);
    p.px.rect(Math.round(mx) + 1, Math.round(my) - 6, 2, 1, FLAG);
  } else {
    // The cabin (a tour boat) or the two decks and the funnel (the cruise ship).
    const decks = cruise ? 2 : 1;
    for (let d = 0; d < decks; d++) {
      const z = hullH + d * 2;
      const inset = cruise ? footprint(dir, houseLen * (d === 0 ? 1 : 0.82), houseWid * (d === 0 ? 1 : 0.8)) : house;
      const zAt = (q: Pt): Pt => at(q, z);
      const glassRow: WallPaint = (_t, k) => (k === 0 ? WHITE : k === 1 ? GLASS_DARK : WHITE);
      const iu = inset.faces.u.map(zAt);
      const iv = inset.faces.v.map(zAt);
      p.px.wall(iu[0], iu[1], 2, glassRow);
      p.px.wall(iv[0], iv[1], 2, glassRow);
      p.px.poly(
        inset.corners.map((q) => zAt(q)),
        () => (cruise ? WHITE : RED_BAND),
      );
    }
    if (cruise) {
      // The funnel, red with a black mouth, over the middle of the top deck.
      const [fx, fy] = at(frame(dir)(0, 0), hullH + 4);
      p.px.rect(Math.round(fx) - 1, Math.round(fy) - 3, 3, 3, RED_BAND);
      p.px.rect(Math.round(fx) - 1, Math.round(fy) - 3, 3, 1, TYRE);
    } else {
      // The wheel of a tour boat and a row of portholes on the bow.
      const [fx, fy] = at(frame(dir)(len * 0.3, 0), hullH + 2);
      p.px.rect(Math.round(fx), Math.round(fy) - 1, 1, 1, GLASS_DARK);
    }
  }
  return { px: p.px, ax: p.ax, ay: p.ay };
}

/** Paints a plane: fuselage, swept wings, tail and windows, all seen from above. */
function paintPlane(level: number, dir: Heading): { px: Pixels; ax: number; ay: number } {
  const len = 0.5 + 0.14 * Math.max(1, Math.min(5, level));
  const wid = len * 0.28;
  const span = len * 1.9;
  const p = rig(10, 16 * (span + len) + 12);
  const { corners, faces } = footprint(dir, len, wid);
  const at = (q: Pt, z = 0): Pt => p.P(q[0], q[1], z);
  const foot = (face: [Pt, Pt]): [Pt, Pt] => [at(face[0]), at(face[1])];
  // The wings, swept a little, one pixel thick: they cross the fuselage.
  const wing = footprint(dir, len * 0.34, span);
  const wingBack = frame(dir)(-len * 0.16, 0);
  const wq = wing.corners.map((q) => at([q[0] + wingBack[0], q[1] + wingBack[1]], 1));
  p.px.poly(wq, () => WING);
  // The fuselage, white with a dark belly, and the cockpit at the nose.
  const cap = foot(faces.capIsU ? faces.u : faces.v);
  const side = foot(faces.capIsU ? faces.v : faces.u);
  p.px.wall(side[0], side[1], 2, (_t, k) => (k === 0 ? shade(WHITE, 0.7) : WHITE));
  p.px.wall(cap[0], cap[1], 2, () => GLASS_DARK);
  p.px.poly(
    corners.map((q) => at(q, 2)),
    () => WHITE,
  );
  // The tail fin: a pixel standing up at the stern, and a stabiliser across it.
  const tail = footprint(dir, len * 0.16, wid * 2.6);
  const back = frame(dir)(-len * 0.42, 0);
  const tq = tail.corners.map((q) => at([q[0] + back[0], q[1] + back[1]], 2));
  p.px.poly(tq, () => WING);
  const fin = at([back[0], back[1]], 4);
  p.px.rect(Math.round(fin[0]), Math.round(fin[1]), 1, 2, RED_BAND);
  // The windows along the side of the fuselage.
  for (let t = 0.3; t < 0.85; t += 0.22) {
    const [x, y] = along(side, t);
    p.px.rect(Math.round(x), Math.round(y) - 1, 1, 1, GLASS_DARK);
  }
  return { px: p.px, ax: p.ax, ay: p.ay };
}

/**
 * Paints the shadow a plane leaves on the runway: its own plan, flat on the ground and shifted the
 * same 3 by 2 the buildings shift theirs, so the sun keeps one direction over the whole map.
 */
function paintPlaneShadow(level: number, dir: Heading): { px: Pixels; ax: number; ay: number } {
  const len = 0.5 + 0.14 * Math.max(1, Math.min(5, level));
  const wid = len * 0.28;
  const span = len * 1.9;
  const p = rig(10, 16 * (span + len) + 12);
  const at = (q: Pt): Pt => {
    const [x, y] = p.P(q[0], q[1], 0);
    return [x + 3, y + 2];
  };
  p.px.shadow(
    footprint(dir, len, wid).corners.map(at),
    0.42,
  );
  const wing = footprint(dir, len * 0.34, span);
  const back = frame(dir)(-len * 0.16, 0);
  p.px.shadow(
    wing.corners.map((q) => at([q[0] + back[0], q[1] + back[1]])),
    0.42,
  );
  const tail = footprint(dir, len * 0.16, wid * 2.6);
  const tailBack = frame(dir)(-len * 0.42, 0);
  p.px.shadow(
    tail.corners.map((q) => at([q[0] + tailBack[0], q[1] + tailBack[1]])),
    0.42,
  );
  return { px: p.px, ax: p.ax, ay: p.ay };
}

const vehicleCache = new Map<string, Sprite>();

/** The sprite of a boat, cached by kind and heading. */
export function boatPixelSprite(kind: 'tour' | 'fishing' | 'cruise', dir: Heading): Sprite {
  const key = `boat:${kind}:${dir}`;
  let sprite = vehicleCache.get(key);
  if (!sprite) {
    sprite = spriteOf(paintBoat(kind, dir));
    vehicleCache.set(key, sprite);
  }
  return sprite;
}

/** The sprite of a plane, cached by the level of its airport and its heading. */
export function planePixelSprite(level: number, dir: Heading): Sprite {
  const key = `plane:${level}:${dir}`;
  let sprite = vehicleCache.get(key);
  if (!sprite) {
    sprite = spriteOf(paintPlane(level, dir));
    vehicleCache.set(key, sprite);
  }
  return sprite;
}

/** The shadow of a plane, cached the same way: it is drawn once on the runway, under the body. */
export function planeShadowSprite(level: number, dir: Heading): Sprite {
  const key = `planeShadow:${level}:${dir}`;
  let sprite = vehicleCache.get(key);
  if (!sprite) {
    sprite = spriteOf(paintPlaneShadow(level, dir));
    vehicleCache.set(key, sprite);
  }
  return sprite;
}

/** The painted form of a boat or a plane, for the tests and the sheet. */
export const boatArt = (kind: 'tour' | 'fishing' | 'cruise', dir: Heading) => paintBoat(kind, dir);
export const planeArt = (level: number, dir: Heading) => paintPlane(level, dir);
export const planeShadowArt = (level: number, dir: Heading) => paintPlaneShadow(level, dir);

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

/** El rojo de la lona y la madera del baulaje: el camión del campo se lee por ahí. */
const LONA_ROJA: RGB = hex('#b23a2e');
const BAULAJE: RGB = hex('#6e4a2f');

/**
 * El camión del chacarero, al estilo del país: cabina blanca de trompa chata, baulaje de madera con la
 * lona roja de la carga que baja del nivel de la cabina, y el conjunto más largo que un auto —un
 * camioncito de verdad, no un colectivo—. Dos volúmenes: la cabina adelante, la jaula atrás.
 */
export function truckVehicle(dir: Heading): { px: Pixels; ax: number; ay: number } {
  const len = 0.8;
  const hw = 0.1;
  const CAB_H = 3;
  const BED_H = 2;
  const p = rig(CAB_H + 2, 16 * (len + 2 * hw) + 8);
  const put = frame(dir);
  const at = (q: Pt, z = 0): Pt => p.P(q[0], q[1], z);
  const capIsU = dir === 0 || dir === 2;
  const nose = dir === 0 || dir === 1;
  // Una caja dentro de la carrocería: esquinas y las dos caras que la cámara ve.
  const box = (t0: number, t1: number): { corners: Pt[]; cap: [Pt, Pt]; side: [Pt, Pt] } => {
    const cs = [put(t1, -hw), put(t1, hw), put(t0, hw), put(t0, -hw)];
    const umax = Math.max(...cs.map((q) => q[0]));
    const vmax = Math.max(...cs.map((q) => q[1]));
    const onU = cs.filter((q) => q[0] === umax);
    const onV = cs.filter((q) => q[1] === vmax);
    const cap = capIsU ? ([onU[0], onU[1]] as [Pt, Pt]) : ([onV[0], onV[1]] as [Pt, Pt]);
    const side = capIsU ? ([onV[0], onV[1]] as [Pt, Pt]) : ([onU[0], onU[1]] as [Pt, Pt]);
    return { corners: cs, cap, side };
  };
  const foot = (face: [Pt, Pt]): [Pt, Pt] => [at(face[0]), at(face[1])];
  // Sombra bajo la carrocería entera.
  p.px.shadow(
    [...box(-len / 2, len / 2).corners].map((q) => {
      const [x, y] = at(q, -0.5);
      return [x - 0.5, y + 1] as Pt;
    }),
    0.34,
  );
  // La jaula: falda de madera, lona roja encima y techo del toldo bajado del nivel de la cabina.
  // La de atrás siempre se dibuja antes: la cabina la tapa cuando el camión va de frente.
  const bed = box(-len / 2, len / 2 - 0.3);
  p.px.wall(...foot(bed.side), BED_H, (_t, k) => (k === 0 ? BAULAJE : shade(LONA_ROJA, 0.92)));
  p.px.poly(bed.corners.map((q) => at(q, BED_H)), () => shade(LONA_ROJA, 0.78));
  for (const t of [0.12, 0.5, 0.88]) {
    const [x, y] = along(foot(bed.side), t);
    p.px.rect(Math.round(x), Math.round(y) - 1, 1, 1, TYRE);
  }
  // El guardo trasero de la jaula: pilotos si se ve la cola de la jaula, madera si no.
  const tail = foot(bed.cap);
  for (const t of [0.1, 0.9]) {
    const [x, y] = along(tail, t);
    p.px.rect(Math.round(x), Math.round(y) - 1, 1, 1, !capIsU && !nose ? TAILLIGHT : BAULAJE);
  }
  // La cabina: blanca, parabrisas oscuro adelante (o vidrio trasero cuando se aleja) y faros abajo.
  const cab = box(len / 2 - 0.26, len / 2);
  p.px.wall(...foot(cab.side), CAB_H, (_t, k) => (k === CAB_H - 1 ? shade(WHITE, 0.9) : WHITE));
  p.px.wall(...foot(cab.cap), CAB_H, (_t, k) =>
    k === 0 ? shade(WHITE, 0.62) : nose ? GLASS_DARK : shade(WHITE, 0.86),
  );
  p.px.poly(cab.corners.map((q) => at(q, CAB_H)), () => WHITE);
  const [wx, wy] = along(foot(cab.side), 0.35);
  p.px.rect(Math.round(wx), Math.round(wy) - 1, 1, 1, TYRE);
  const capF = foot(cab.cap);
  for (const t of [0.14, 0.86]) {
    const [x, y] = along(capF, t);
    p.px.rect(Math.round(x), Math.round(y) - 1, 1, 1, nose ? HEADLIGHT : TAILLIGHT);
  }
  // El entrepaño entre cabina y jaula, para que se lea la unión de los dos volúmenes.
  const gap = box(len / 2 - 0.3, len / 2 - 0.26);
  p.px.wall(...foot(gap.cap), 1, () => shade(BAULAJE, 0.7));
  return { px: p.px, ax: p.ax, ay: p.ay };
}

/** La camioneta en sprite, una por rumbo, cacheada como sus pares. */
export function truckPixelSprite(dir: Heading): Sprite {
  const key = `truck:${dir}`;
  let sprite = vehicleCache.get(key);
  if (!sprite) {
    sprite = spriteOf(truckVehicle(dir));
    vehicleCache.set(key, sprite);
  }
  return sprite;
}
