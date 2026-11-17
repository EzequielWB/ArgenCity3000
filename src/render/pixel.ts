/**
 * Pixel painter for the interface ornaments and the style lab: everything is drawn at 1x on a
 * pixel buffer with no anti-aliasing, and the page scales it up with nearest-neighbour. Geometry
 * is the game's 2:1 isometric tile (32 x 16 px).
 */

export type RGB = [number, number, number];

export function hex(c: string): RGB {
  const v = parseInt(c.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function shade(c: RGB, f: number): RGB {
  return [Math.min(255, Math.round(c[0] * f)), Math.min(255, Math.round(c[1] * f)), Math.min(255, Math.round(c[2] * f))];
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
}

/** Deterministic noise in [0, 1) for a pixel or a cell. */
export function noise(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Ordered-dither threshold in [0, 1) for a pixel. */
export const bayer = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

export type Pt = [number, number];
export type Paint = (x: number, y: number) => RGB | null;
/** Colour of a wall pixel: `t` pixels along the wall from its left end, `k` pixels above its foot. */
export type WallPaint = (t: number, k: number, x: number, y: number) => RGB | null;

export class Pixels {
  readonly data: Uint8ClampedArray;
  /** When set, every colour is snapped to its nearest entry (a limited palette). */
  palette: RGB[] | null = null;
  private snapCache = new Map<number, RGB>();

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  private snap(c: RGB): RGB {
    if (!this.palette) return c;
    const key = (c[0] << 16) | (c[1] << 8) | c[2];
    let best = this.snapCache.get(key);
    if (best) return best;
    let d = Infinity;
    best = c;
    for (const p of this.palette) {
      const e = (p[0] - c[0]) ** 2 * 0.3 + (p[1] - c[1]) ** 2 * 0.59 + (p[2] - c[2]) ** 2 * 0.11;
      if (e < d) {
        d = e;
        best = p;
      }
    }
    this.snapCache.set(key, best);
    return best;
  }

  set(x: number, y: number, c: RGB | null): void {
    if (!c || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const s = this.snap(c);
    const i = (y * this.w + x) * 4;
    this.data[i] = s[0];
    this.data[i + 1] = s[1];
    this.data[i + 2] = s[2];
    this.data[i + 3] = 255;
  }

  /** Filled convex or concave polygon, sampled at pixel centres (no anti-aliasing). */
  poly(pts: Pt[], paint: Paint): void {
    this.fill(pts, (x, y) => this.set(x, y, paint(x, y)));
  }

  /**
   * Fills the polygon with a shadow: black at partial alpha, which the canvas blends with whatever
   * the map drew underneath, so the same sprite works over grass, dirt or pavement. It never paints
   * over a pixel that is already opaque.
   */
  shadow(pts: Pt[], alpha: number): void {
    const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
    this.fill(pts, (x, y) => {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      const i = (y * this.w + x) * 4;
      if (this.data[i + 3]) return;
      this.data[i] = 0;
      this.data[i + 1] = 0;
      this.data[i + 2] = 0;
      this.data[i + 3] = a;
    });
  }

  /** Scanline fill: the pixels inside the polygon, handed to `put`. */
  private fill(pts: Pt[], put: (x: number, y: number) => void): void {
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of pts) {
      y0 = Math.min(y0, p[1]);
      y1 = Math.max(y1, p[1]);
    }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const yc = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const q = pts[(i + 1) % pts.length];
        if (p[1] <= yc !== q[1] <= yc) xs.push(p[0] + ((yc - p[1]) / (q[1] - p[1])) * (q[0] - p[0]));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) put(x, y);
      }
    }
  }

  line(a: Pt, b: Pt, c: RGB): void {
    let x0 = Math.round(a[0]);
    let y0 = Math.round(a[1]);
    const x1 = Math.round(b[0]);
    const y1 = Math.round(b[1]);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** A wall standing on the segment a → b (its foot), `height` pixels tall, painted column by column. */
  wall(a: Pt, b: Pt, height: number, paint: WallPaint): void {
    const ax = Math.round(a[0]);
    const bx = Math.round(b[0]);
    const n = Math.abs(bx - ax);
    const dir = bx >= ax ? 1 : -1;
    for (let t = 0; t < n; t++) {
      const x = ax + t * dir + (dir < 0 ? -1 : 0);
      const yb = Math.round(a[1] + ((t + 0.5) / n) * (b[1] - a[1]));
      for (let k = 0; k < height; k++) this.set(x, yb - 1 - k, paint(t, k, x, yb - 1 - k));
    }
  }

  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  /** Shaded blob (tree crowns, bushes): lit from the upper left, darker towards the lower right. */
  blob(cx: number, cy: number, rx: number, ry: number, tones: [RGB, RGB, RGB], outline: RGB | null, dither: boolean): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        const d = dx * dx + dy * dy;
        if (d > 1) continue;
        if (outline && d > 1 - 1.6 / Math.min(rx, ry)) {
          this.set(x, y, outline);
          continue;
        }
        let light = 0.5 - (dx + dy * 1.3) * 0.45;
        if (dither) light += (bayer(x, y) - 0.5) * 0.5;
        else light += (noise(x, y, 7) - 0.5) * 0.25;
        this.set(x, y, light > 0.66 ? tones[0] : light > 0.33 ? tones[1] : tones[2]);
      }
    }
  }

  toCanvas(scale: number): HTMLCanvasElement {
    const small = document.createElement('canvas');
    small.width = this.w;
    small.height = this.h;
    small.getContext('2d')!.putImageData(new ImageData(this.data, this.w, this.h), 0, 0);
    const big = document.createElement('canvas');
    big.width = this.w * scale;
    big.height = this.h * scale;
    const g = big.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.drawImage(small, 0, 0, big.width, big.height);
    return big;
  }
}
