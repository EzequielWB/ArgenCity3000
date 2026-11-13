/**
 * Pixel "fileteado" ornaments for the interface: a corner (volute, acanthus leaves, a flower and
 * beads), a divider and a ribbon. Drawn at 1x; the stylesheet scales them up by whole pixels.
 */
import { Pixels, hex, shade, type Pt, type RGB } from '../render/pixel';

const GOLD = hex('#e0a526');
const GOLD_LIGHT = hex('#ffe08a');
const GOLD_DARK = hex('#8f5f12');
const RED = hex('#c9342c');
const RED_LIGHT = hex('#f0705c');
const GREEN = hex('#2f8a4a');
const GREEN_LIGHT = hex('#7fd08a');
const CELESTE = hex('#74acdf');
const WHITE = hex('#f6f2e8');
const YELLOW = hex('#f6b40e');

/** A gold stroke with a highlight above and a shade below, like a brush line with volume. */
function stroke(px: Pixels, pts: Pt[]): void {
  for (let i = 0; i + 1 < pts.length; i++) px.line([pts[i][0], pts[i][1] + 1], [pts[i + 1][0], pts[i + 1][1] + 1], GOLD_DARK);
  for (let i = 0; i + 1 < pts.length; i++) px.line(pts[i], pts[i + 1], GOLD);
  for (let i = 0; i + 1 < pts.length; i += 2) px.set(Math.round(pts[i][0]), Math.round(pts[i][1]) - 1, GOLD_LIGHT);
}

function spiral(cx: number, cy: number, turns: number, grow: number, start = 0, dir = 1): Pt[] {
  const pts: Pt[] = [];
  for (let a = 0; a <= turns * Math.PI * 2; a += 0.22) {
    const r = 1 + a * grow;
    pts.push([cx + Math.cos(start + a * dir) * r, cy + Math.sin(start + a * dir) * r]);
  }
  return pts;
}

/** A leaf from `a` to its tip `b`, `w` pixels wide at the belly, lit on one side. */
function leaf(px: Pixels, a: Pt, b: Pt, w: number, c: RGB, light: RGB): void {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  const mid: Pt = [a[0] + dx * 0.4, a[1] + dy * 0.4];
  const l: Pt = [mid[0] + nx * w, mid[1] + ny * w];
  const r: Pt = [mid[0] - nx * w, mid[1] - ny * w];
  px.poly([a, l, b], () => light);
  px.poly([a, b, r], () => c);
  px.line(a, b, shade(c, 0.6));
}

function flower(px: Pixels, cx: number, cy: number, petal: RGB, r = 3): void {
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k * Math.PI * 2) / 5;
    const x = Math.round(cx + Math.cos(a) * r);
    const y = Math.round(cy + Math.sin(a) * r);
    px.rect(x - 1, y - 1, 3, 3, petal);
    px.set(x - 1, y - 1, WHITE);
  }
  px.rect(cx - 1, cy - 1, 3, 3, YELLOW);
}

function bead(px: Pixels, x: number, y: number, c: RGB = GOLD): void {
  px.rect(x - 1, y - 1, 3, 3, c);
  px.set(x - 1, y - 1, GOLD_LIGHT);
  px.set(x + 1, y + 1, GOLD_DARK);
}

/** Top-left corner ornament; mirror it with CSS for the other three corners. */
export function corner(size = 56): Pixels {
  const px = new Pixels(size, size);
  // The two rails of the frame, ending in beads.
  stroke(px, [
    [3, size - 4],
    [3, 16],
  ]);
  stroke(px, [
    [16, 3],
    [size - 4, 3],
  ]);
  bead(px, 3, size - 3);
  bead(px, size - 3, 3);
  // The big volute in the corner and a small one curling back along each rail.
  stroke(px, spiral(14, 14, 1.6, 1.05, Math.PI * 0.75));
  stroke(px, spiral(30, 9, 0.9, 0.75, Math.PI, -1));
  stroke(px, spiral(9, 30, 0.9, 0.75, Math.PI / 2, 1));
  // Acanthus leaves growing out of the volute.
  leaf(px, [22, 20], [38, 30], 4, RED, RED_LIGHT);
  leaf(px, [20, 22], [30, 38], 4, RED, RED_LIGHT);
  leaf(px, [24, 24], [36, 40], 3, GREEN, GREEN_LIGHT);
  leaf(px, [36, 8], [48, 12], 3, GREEN, GREEN_LIGHT);
  leaf(px, [8, 36], [12, 48], 3, GREEN, GREEN_LIGHT);
  flower(px, 14, 14, CELESTE, 3);
  bead(px, 42, 44, RED);
  return px;
}

/** A symmetrical flourish: a flower between two volutes and two tapering lines. */
export function divider(width = 120): Pixels {
  const h = 15;
  const px = new Pixels(width, h);
  const c = Math.floor(width / 2);
  for (const side of [-1, 1]) {
    stroke(px, spiral(c + side * 13, 7, 0.8, 0.8, side > 0 ? Math.PI : 0, side));
    stroke(px, [
      [c + side * 20, 8],
      [c + side * (width / 2 - 6), 8],
    ]);
    leaf(px, [c + side * 8, 7], [c + side * 22, 3], 2, GREEN, GREEN_LIGHT);
    bead(px, c + side * (width / 2 - 4), 8);
  }
  flower(px, c, 7, CELESTE, 3);
  return px;
}

/** A celeste and white ribbon with folded ends, for the city name. */
export function ribbon(width = 150): Pixels {
  const h = 22;
  const px = new Pixels(width, h);
  const fold = 12;
  // Folded tails, darker and a little lower.
  for (const x0 of [0, width - fold]) {
    px.rect(x0, 6, fold, 14, shade(CELESTE, 0.6));
    px.rect(x0, 10, fold, 5, shade(WHITE, 0.7));
    for (let k = 0; k < 6; k++) {
      // V-shaped notch at the outer end.
      const x = x0 === 0 ? k : width - 1 - k;
      px.rect(x, 12 - (5 - k), 1, 1 + (5 - k) * 2, [0, 0, 0]);
    }
  }
  px.rect(fold - 3, 1, width - 2 * (fold - 3), 18, CELESTE);
  px.rect(fold - 3, 7, width - 2 * (fold - 3), 6, WHITE);
  px.rect(fold - 3, 1, width - 2 * (fold - 3), 1, shade(CELESTE, 1.25));
  px.rect(fold - 3, 18, width - 2 * (fold - 3), 1, shade(CELESTE, 0.65));
  return px;
}

/** A pixel-art image as a data URL, with pure black made transparent. */
export function toUrl(px: Pixels): string {
  const c = document.createElement('canvas');
  c.width = px.w;
  c.height = px.h;
  const data = new Uint8ClampedArray(px.data);
  for (let i = 0; i < data.length; i += 4) if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0) data[i + 3] = 0;
  c.getContext('2d')!.putImageData(new ImageData(data, px.w, px.h), 0, 0);
  return c.toDataURL('image/png');
}

/** Draws the ornaments once and hands them to the stylesheet as `--corner`, `--divider` and `--ribbon`. */
export function installOrnaments(root: HTMLElement = document.documentElement): void {
  root.style.setProperty('--corner', `url(${toUrl(corner())})`);
  root.style.setProperty('--divider', `url(${toUrl(divider())})`);
  root.style.setProperty('--ribbon', `url(${toUrl(ribbon())})`);
}
