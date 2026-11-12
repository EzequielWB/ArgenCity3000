import { fromView, unproject, type Rotation } from '../core/iso';
import { hash2 } from '../core/rng';
import { TILE, World } from '../world/world';
import { cellScreenCorners, type Pt } from './geometry';
import { bilinear } from './mapRenderer';

/** Cars per road cell (0–3), from the buildings around it. Purely visual. */
export function computeTraffic(w: World, out: Uint8Array): void {
  const n = w.n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      if (w.tiles[i] !== TILE.ROAD) {
        out[i] = 0;
        continue;
      }
      let levels = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < n && ny < n) levels += w.level[ny * n + nx];
        }
      }
      out[i] = Math.min(3, Math.round(levels / 7));
    }
  }
}

const CAR_COLORS = ['#c8392f', '#f4f0e6', '#2f63a6', '#3c8d4a', '#7d7f86', '#e0a526'];

/**
 * Draws moving cars on the visible road cells. Positions are a pure function of time,
 * so nothing needs to be simulated.
 */
export function drawTraffic(
  g: CanvasRenderingContext2D,
  w: World,
  rot: Rotation,
  traffic: Uint8Array,
  origin: Pt,
  visibleRect: [number, number, number, number],
  time: number,
): void {
  const n = w.n;
  const [x0, y0, x1, y1] = visibleRect;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [sx, sy] of [
    [x0, y0],
    [x1, y0],
    [x0, y1],
    [x1, y1],
  ]) {
    for (const h of [0, 14]) {
      const [px, py] = unproject(sx - origin[0], sy - origin[1], h);
      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
    }
  }
  const vx0 = Math.max(0, Math.floor(minX));
  const vy0 = Math.max(0, Math.floor(minY));
  const vx1 = Math.min(n - 1, Math.ceil(maxX));
  const vy1 = Math.min(n - 1, Math.ceil(maxY));
  const t = time / 1000;
  const isRoad = (vx: number, vy: number) => {
    if (vx < 0 || vy < 0 || vx >= n || vy >= n) return false;
    const [x, y] = fromView(vx, vy, rot, n);
    return w.tiles[w.idx(x, y)] === TILE.ROAD;
  };
  const hidesStreet = (vx: number, vy: number) => {
    if (vx >= n || vy >= n) return false;
    const [x, y] = fromView(vx, vy, rot, n);
    const i = w.idx(x, y);
    return w.tiles[i] === TILE.PLANT || w.level[i] >= 3;
  };

  for (let vy = vy0; vy <= vy1; vy++) {
    for (let vx = vx0; vx <= vx1; vx++) {
      const [x, y] = fromView(vx, vy, rot, n);
      const i = w.idx(x, y);
      const cars = traffic[i];
      if (!cars) continue;
      // Cars are drawn over the cached map, so skip streets hidden behind tall neighbours.
      if (hidesStreet(vx + 1, vy) || hidesStreet(vx, vy + 1) || hidesStreet(vx + 1, vy + 1)) continue;
      const alongU = isRoad(vx - 1, vy) || isRoad(vx + 1, vy);
      const alongV = isRoad(vx, vy - 1) || isRoad(vx, vy + 1);
      if (!alongU && !alongV) continue;
      const pts = cellScreenCorners(w, vx, vy, rot).map(([a, b]) => [a + origin[0], b + origin[1]] as Pt);
      for (let k = 0; k < cars; k++) {
        const seed = hash2(x * 7 + k, y * 13, 99);
        const useU = alongU && (!alongV || seed < 0.5);
        const forward = hash2(x, y + k, 5) < 0.5;
        const speed = 0.35 + seed * 0.3;
        let p = (t * speed + seed * 3) % 1;
        if (!forward) p = 1 - p;
        const lane = forward ? 0.38 : 0.62;
        const [cx, cy] = useU ? bilinear(pts, p, lane) : bilinear(pts, lane, p);
        const bus = seed > 0.9;
        const taxi = !bus && seed > 0.72;
        const body = bus ? '#e0a526' : taxi ? '#1f1611' : CAR_COLORS[Math.floor(seed * 97) % CAR_COLORS.length];
        const len = bus ? 3.4 : 2;
        // Direction of travel on screen: along u is (16, 8), along v is (-16, 8), scaled down.
        const dx = (useU ? 1 : -1) * len;
        const dy = len / 2;
        g.fillStyle = body;
        g.beginPath();
        g.moveTo(cx - dx, cy - dy - 1.5);
        g.lineTo(cx + dx, cy + dy - 1.5);
        g.lineTo(cx + dx, cy + dy + 0.3);
        g.lineTo(cx - dx, cy - dy + 0.3);
        g.closePath();
        g.fill();
        g.fillStyle = taxi ? '#f2c94c' : 'rgba(255,255,255,0.65)';
        g.fillRect(cx - 0.6, cy - 2.4, 1.2, 0.9);
      }
    }
  }
}
