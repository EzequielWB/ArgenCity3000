import { ROAD_REACH } from '../config';
import { SEA_LEVEL } from '../world/terrain';
import { TILE, World } from '../world/world';

const clamp100 = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/** Multi-source BFS from road cells, limited to ROAD_REACH steps (Manhattan distance). */
export function computeRoadAccess(w: World): void {
  const n = w.n;
  const dist = new Int16Array(n * n).fill(-1);
  const queue = new Int32Array(n * n);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < n * n; i++) {
    if (w.tiles[i] === TILE.ROAD) {
      dist[i] = 0;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const i = queue[head++];
    if (dist[i] >= ROAD_REACH) continue;
    const x = i % n;
    const y = (i - x) / n;
    const next = [x > 0 ? i - 1 : -1, x < n - 1 ? i + 1 : -1, y > 0 ? i - n : -1, y < n - 1 ? i + n : -1];
    for (const j of next) {
      if (j < 0 || dist[j] >= 0) continue;
      dist[j] = dist[i] + 1;
      queue[tail++] = j;
    }
  }
  for (let i = 0; i < n * n; i++) w.roadAccess[i] = dist[i] >= 0 ? 1 : 0;
}

function splat(acc: Float32Array, n: number, cx: number, cy: number, radius: number, strength: number): void {
  for (let dy = -radius; dy <= radius; dy++) {
    const y = cy + dy;
    if (y < 0 || y >= n) continue;
    for (let dx = -radius; dx <= radius; dx++) {
      const x = cx + dx;
      if (x < 0 || x >= n) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      acc[y * n + x] += strength * (1 - d / (radius + 1));
    }
  }
}

/** Industry and power plants pollute their surroundings. */
export function computePollution(w: World): void {
  const n = w.n;
  const acc = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) {
    if (w.tiles[i] === TILE.I && w.level[i] > 0) {
      splat(acc, n, i % n, Math.floor(i / n), 4, 10 * w.level[i]);
    }
  }
  for (const p of w.plants) splat(acc, n, p.x, p.y, 6, 60);
  for (let i = 0; i < n * n; i++) w.pollution[i] = clamp100(acc[i]);
}

const waterDistCache = new WeakMap<Uint8Array, Uint8Array>();

/** Distance (capped at 6) from every cell to the nearest water cell. Terrain never changes, so it is cached. */
function waterDistance(w: World): Uint8Array {
  const cached = waterDistCache.get(w.terrain.corners);
  if (cached) return cached;
  const n = w.n;
  const CAP = 6;
  const dist = new Uint8Array(n * n).fill(CAP);
  const queue = new Int32Array(n * n);
  let head = 0;
  let tail = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (w.isWater(x, y)) {
        dist[y * n + x] = 0;
        queue[tail++] = y * n + x;
      }
    }
  }
  while (head < tail) {
    const i = queue[head++];
    if (dist[i] + 1 >= CAP) continue;
    const x = i % n;
    const y = (i - x) / n;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      const j = ny * n + nx;
      if (dist[j] > dist[i] + 1) {
        dist[j] = dist[i] + 1;
        queue[tail++] = j;
      }
    }
  }
  waterDistCache.set(w.terrain.corners, dist);
  return dist;
}

/** Land value: views of the water, plazas, trees and height add; pollution subtracts. Needs pollution first. */
export function computeLandValue(w: World): void {
  const n = w.n;
  const water = waterDistance(w);
  const parks = new Float32Array(n * n);
  const blight = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) {
    if (w.tiles[i] === TILE.PARK) splat(parks, n, i % n, Math.floor(i / n), 4, 14);
    if (w.abandoned[i] && w.level[i] > 0) splat(blight, n, i % n, Math.floor(i / n), 2, 8);
  }
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      let v = 25;
      if (water[i] > 0 && water[i] < 6) v += (6 - water[i]) * 5;
      v += Math.min(30, parks[i]);
      let trees = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < n && ny < n && w.terrain.trees[ny * n + nx]) trees++;
        }
      }
      v += Math.min(10, trees * 2);
      const [, max] = w.minMax(x, y);
      v += Math.max(0, max - SEA_LEVEL) * 1.5;
      v -= w.pollution[i] * 0.7;
      v -= Math.min(30, blight[i]);
      w.landValue[i] = clamp100(v);
    }
  }
}
