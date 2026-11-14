/**
 * Estimated congestion. No car is simulated: every home sends its residents to the nearest
 * commerce and the nearest industry along the streets (split by each one's share of the city's
 * jobs), and what passes over a street is compared with what the street can carry. Streets laid
 * side by side form an avenue, which carries as many times more as it has lanes.
 */
import { CAPACITY, COAST, ROAD_REACH, TRAFFIC } from '../config';
import { TILE, type World } from '../world/world';
import { coastWorks } from './coast';

export interface CongestionReport {
  /** Residents who commute: those whose home opens onto a street, in a city with jobs. */
  trips: number;
  /** Highest load of a street, in percent of its capacity (capped at 255). */
  worst: number;
  /** Share of the commuters (0 to 1) whose way to work crosses a saturated street. */
  jammedShare: number;
}

/** Lanes counted across an avenue; wider blocks of asphalt carry no more. */
const MAX_LANES = 8;

/** For every cell within ROAD_REACH steps of a street, the index of its nearest street cell (or -1). */
function nearestStreet(w: World): Int32Array {
  const n = w.n;
  const origin = new Int32Array(n * n).fill(-1);
  const dist = new Uint8Array(n * n);
  const queue = new Int32Array(n * n);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < n * n; i++) {
    if (w.tiles[i] === TILE.ROAD) {
      origin[i] = i;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const i = queue[head++];
    if (dist[i] >= ROAD_REACH) continue;
    const x = i % n;
    for (const j of [x > 0 ? i - 1 : -1, x < n - 1 ? i + 1 : -1, i - n, i + n]) {
      if (j < 0 || j >= n * n || origin[j] >= 0) continue;
      origin[j] = origin[i];
      dist[j] = dist[i] + 1;
      queue[tail++] = j;
    }
  }
  return origin;
}

/**
 * Sends `share` of the residents waiting at each street cell (`sources`) to the nearest cell of
 * `sinks` along the streets, and returns what passes over every street cell plus the visiting
 * order (sinks first) and each cell's next step, for a second pass over the same routes.
 */
function route(w: World, sources: Float32Array, sinks: Uint8Array, share: number): { load: Float32Array; order: Int32Array; count: number; next: Int32Array } {
  const n = w.n;
  const load = new Float32Array(n * n);
  const next = new Int32Array(n * n).fill(-1);
  const seen = new Uint8Array(n * n);
  const order = new Int32Array(n * n);
  let count = 0;
  for (let i = 0; i < n * n; i++) {
    if (sinks[i]) {
      seen[i] = 1;
      order[count++] = i;
    }
  }
  for (let head = 0; head < count; head++) {
    const i = order[head];
    const x = i % n;
    for (const j of [x > 0 ? i - 1 : -1, x < n - 1 ? i + 1 : -1, i - n, i + n]) {
      if (j < 0 || j >= n * n || seen[j] || w.tiles[j] !== TILE.ROAD) continue;
      seen[j] = 1;
      next[j] = i;
      order[count++] = j;
    }
  }
  // Farthest cells first: each one hands what it carries to its next step towards the jobs.
  for (let k = count - 1; k >= 0; k--) {
    const i = order[k];
    load[i] += sources[i] * share;
    if (next[i] >= 0) load[next[i]] += load[i];
  }
  return { load, order, count, next };
}

/**
 * Fills `w.traffic` (load of every street cell, in percent of its capacity) and `w.jam` (the
 * traffic of the street each lot opens onto) and returns the city-wide summary.
 */
export function computeCongestion(w: World): CongestionReport {
  const n = w.n;
  const size = n * n;
  w.traffic.fill(0);
  w.jam.fill(0);
  const origin = nearestStreet(w);
  const sources = new Float32Array(size);
  const sinksC = new Uint8Array(size);
  const sinksI = new Uint8Array(size);
  let trips = 0;
  let cJobs = 0;
  let iJobs = 0;
  for (let i = 0; i < size; i++) {
    const o = origin[i];
    if (o < 0) continue;
    const tile = w.tiles[i];
    // A working port is a place of work for the industry's share of the commuters.
    if (tile === TILE.PORT && coastWorks(w, i)) {
      sinksI[o] = 1;
      iJobs += COAST.port.jobs;
      continue;
    }
    if (!w.isOccupied(i)) continue;
    if (tile === TILE.R) {
      sources[o] += CAPACITY.R[w.level[i]];
      trips += CAPACITY.R[w.level[i]];
    } else if (tile === TILE.C) {
      sinksC[o] = 1;
      cJobs += CAPACITY.C[w.level[i]];
    } else if (tile === TILE.I) {
      sinksI[o] = 1;
      iJobs += CAPACITY.I[w.level[i]];
    }
  }
  const jobs = cJobs + iJobs;
  if (jobs === 0 || trips === 0) return { trips: 0, worst: 0, jammedShare: 0 };

  const routes = [route(w, sources, sinksC, cJobs / jobs), route(w, sources, sinksI, iJobs / jobs)];
  const raw = new Float32Array(size);
  for (const r of routes) for (let i = 0; i < size; i++) raw[i] += r.load[i];

  // Capacity: the lanes of the avenue a cell belongs to. A cell's street runs along its longer
  // run of asphalt; its lanes are the cells beside it that run the same way.
  const isRoad = (j: number) => j >= 0 && j < size && w.tiles[j] === TILE.ROAD;
  // Length of the run of asphalt through each cell, along x and along y (one sweep each).
  const runX = new Uint16Array(size);
  const runY = new Uint16Array(size);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; ) {
      let e = x;
      while (e < n && w.tiles[y * n + e] === TILE.ROAD) e++;
      for (let k = x; k < e; k++) runX[y * n + k] = e - x;
      x = Math.max(e, x + 1);
    }
  }
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; ) {
      let e = y;
      while (e < n && w.tiles[e * n + x] === TILE.ROAD) e++;
      for (let k = y; k < e; k++) runY[k * n + x] = e - y;
      y = Math.max(e, y + 1);
    }
  }
  let worst = 0;
  const saturated = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    if (w.tiles[i] !== TILE.ROAD) continue;
    const alongX = runX[i] >= runY[i];
    const along = alongX ? 1 : n;
    const across = alongX ? n : 1;
    const sameRow = (a: number, b: number) => Math.floor(a / n) === Math.floor(b / n);
    const runsAlong = (j: number) => (isRoad(j - along) && (!alongX || sameRow(j, j - along))) || (isRoad(j + along) && (!alongX || sameRow(j, j + along)));
    let lanes = 1;
    let carried = raw[i];
    for (const dir of [-across, across]) {
      let j = i + dir;
      while (lanes < MAX_LANES && isRoad(j) && (alongX || sameRow(j, i)) && runsAlong(j)) {
        lanes++;
        carried += raw[j];
        j += dir;
      }
    }
    const pct = Math.min(255, Math.round((100 * carried) / (lanes * TRAFFIC.laneCapacity)));
    w.traffic[i] = pct;
    if (pct > 100) saturated[i] = 1;
    if (pct > worst) worst = pct;
  }
  for (let i = 0; i < size; i++) if (origin[i] >= 0) w.jam[i] = w.traffic[origin[i]];

  // Second pass over the same routes: what crosses a saturated cell arrives jammed.
  let jammed = 0;
  for (const r of routes) {
    const stuck = new Float32Array(size);
    for (let k = r.count - 1; k >= 0; k--) {
      const i = r.order[k];
      const here = saturated[i] ? r.load[i] : stuck[i];
      if (r.next[i] >= 0) stuck[r.next[i]] += here;
      else jammed += here;
    }
  }
  return { trips, worst, jammedShare: Math.min(1, jammed / trips) };
}

/** How much a lot grows (1 = as usual) given the traffic of the street it opens onto. */
export function jamGrowthFactor(jam: number): number {
  if (jam <= TRAFFIC.slowFrom) return 1;
  return Math.max(TRAFFIC.slowest, 1 - (jam - TRAFFIC.slowFrom) / 150);
}
