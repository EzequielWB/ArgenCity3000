/**
 * Estimated congestion. No car is simulated: every home sends its residents to commerce and
 * industry along the streets, and what passes over a street is compared with what the street can
 * carry. Streets laid side by side form an avenue, which carries as many times more as it has
 * lanes. The bus lines carry a number of commuters out of the streets of their area (see
 * `transit.ts`).
 *
 * El reparto (TRAFFIC.split): cada lote manda sus viajeros a los comercios por **grupos de
 * destinos** (round-robin por índice, que reparte en el espacio) con peso inverso al cuadrado de
 * la distancia — con un solo destino el resultado es el de la ruta única de antes. Y un lote con
 * dos calles empatadas como salida reparte entre ellas: la avenida paralela deja de estar muerta.
 */
import { fundingCondition } from './condition';
import { CAPACITY, COAST, ROAD_REACH, ROAD_TIERS, TRAFFIC, weakerRoad, type RoadTier } from '../config';
import { TILE, type World } from '../world/world';
import { coastWorks } from './coast';
import { applyTransit } from './transit';

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

/** Los cuatro vecinos de una celda (−1 en los bordes): una sola definición para todos los recorridos. */
function neighborsOf(w: World, i: number): number[] {
  const n = w.n;
  const x = i % n;
  return [x > 0 ? i - 1 : -1, x < n - 1 ? i + 1 : -1, i - n, i + n];
}

/** For every cell within ROAD_REACH steps of a street, its distance to the nearest one (or -1). */
function streetDist(w: World): Int32Array {
  const n = w.n;
  const dist = new Int32Array(n * n).fill(-1);
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
    for (const j of neighborsOf(w, i)) {
      if (j < 0 || j >= n * n || dist[j] >= 0) continue;
      dist[j] = dist[i] + 1;
      queue[tail++] = j;
    }
  }
  return dist;
}

/**
 * Las calles empatadas como salida de un lote: los vecinos un paso más cerca de la calle, y si el
 * vecino no es asfalto, la salida de ese vecino (la cadena pasa por los lotes de al lado, como el
 * viejo `origin` del inundado). Empate = misma distancia mínima: el lote reparte entre todas.
 */
function gatewaysOf(w: World, dist: Int32Array, i: number): number[] {
  const d = dist[i];
  if (d <= 0) return [];
  const out = new Set<number>();
  const walk = (j: number, steps: number): void => {
    if (w.tiles[j] === TILE.ROAD) {
      out.add(j);
      return;
    }
    if (steps <= 1) return;
    for (const k of neighborsOf(w, j)) {
      if (k < 0 || dist[k] !== dist[j] - 1) continue;
      walk(k, steps - 1);
    }
  };
  for (const j of neighborsOf(w, i)) {
    if (j < 0 || j >= w.n * w.n || dist[j] !== d - 1) continue;
    walk(j, d);
  }
  return [...out];
}

/** A routing group: the load that crossed every street cell of the city, cells ordered by their distance to the group's destinations. */
interface Route {
  load: Float32Array;
  order: Int32Array;
  count: number;
  dist: Int32Array;
}

/** Breadth-first from the group's destinations over the roads: distance and visiting order. */
function bfsFromSinks(w: World, sinks: Uint8Array): { order: Int32Array; count: number; dist: Int32Array } {
  const n = w.n;
  const size = n * n;
  const dist = new Int32Array(size).fill(-1);
  const order = new Int32Array(size);
  const queue = new Int32Array(size);
  let count = 0;
  let head = 0;
  let tail = 0;
  for (let i = 0; i < size; i++) {
    if (sinks[i]) {
      dist[i] = 0;
      order[count++] = i;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const i = queue[head++];
    for (const j of neighborsOf(w, i)) {
      if (j < 0 || j >= size || dist[j] >= 0 || w.tiles[j] !== TILE.ROAD) continue;
      dist[j] = dist[i] + 1;
      order[count++] = j;
      queue[tail++] = j;
    }
  }
  return { order, count, dist };
}

/**
 * Sends `share` of the residents waiting at each street cell to the group's destinations, split by
 * proximity (inverse square of the distance, normalized per cell). Every cell hands what it
 * carries to ALL its neighbours one step closer to the destinations: equal-length alternatives
 * share the flow. Returns one Route per group, for the traffic and the jam pass.
 */
function splitRoutes(w: World, sources: Float32Array, sinks: Uint8Array, share: number): Route[] {
  const n = w.n;
  const size = n * n;
  const groups: Uint8Array[] = [];
  for (let g = 0; g < TRAFFIC.split; g++) groups.push(new Uint8Array(size));
  let seq = 0;
  for (let i = 0; i < size; i++) if (sinks[i]) groups[(seq++) % TRAFFIC.split][i] = 1;

  const routes: Route[] = [];
  for (const group of groups) {
    const { order, count, dist } = bfsFromSinks(w, group);
    routes.push({ load: new Float32Array(size), order, count, dist });
  }
  // Peso de cada grupo en cada celda: 1/dist², normalizado entre los grupos que llegan.
  const wsum = new Float32Array(size);
  for (const r of routes) {
    for (let k = 0; k < r.count; k++) {
      const d = r.dist[r.order[k]];
      wsum[r.order[k]] += d === 0 ? 1 : 1 / (d * d);
    }
  }
  for (const r of routes) {
    // Farthest cells first: each one hands what it carries to every step closer to the jobs.
    for (let k = r.count - 1; k >= 0; k--) {
      const i = r.order[k];
      const d = r.dist[i];
      if (sources[i] > 0) {
        const weight = (d === 0 ? 1 : 1 / (d * d)) / wsum[i];
        r.load[i] += sources[i] * share * weight;
      }
      if (d === 0) continue; // arrived: the jam pass collects it here
      let outs = 0;
      for (const j of neighborsOf(w, i)) if (j >= 0 && j < size && r.dist[j] === d - 1) outs++;
      if (outs === 0) continue;
      const each = r.load[i] / outs;
      for (const j of neighborsOf(w, i)) {
        if (j >= 0 && j < size && r.dist[j] === d - 1) r.load[j] += each;
      }
    }
  }
  return routes;
}

/**
 * Fills `w.traffic` (load of every street cell, in percent of its capacity) and `w.jam` (the
 * traffic of the street each lot opens onto) and returns the city-wide summary.
 */
/** How well the streets are kept, as a multiplier of what they carry (see `fundingCondition`). */
export const roadCondition = fundingCondition;

export function computeCongestion(w: World, transport = 100, roads = 100): CongestionReport {
  const n = w.n;
  const size = n * n;
  w.traffic.fill(0);
  w.jam.fill(0);
  const streetD = streetDist(w);
  const sources = new Float32Array(size);
  const sinksC = new Uint8Array(size);
  const sinksI = new Uint8Array(size);
  let trips = 0;
  let cJobs = 0;
  let iJobs = 0;
  for (let i = 0; i < size; i++) {
    if (streetD[i] < 0) continue;
    const tile = w.tiles[i];
    // A working port is a place of work for the industry's share of the commuters.
    if (tile === TILE.PORT && coastWorks(w, i)) {
      for (const o of gatewaysOf(w, streetD, i)) sinksI[o] = 1;
      iJobs += COAST.port.jobs;
      continue;
    }
    if (!w.isOccupied(i)) continue;
    const gates = gatewaysOf(w, streetD, i);
    if (gates.length === 0) continue;
    if (tile === TILE.R) {
      for (const o of gates) sources[o] += CAPACITY.R[w.level[i]] / gates.length;
      trips += CAPACITY.R[w.level[i]];
    } else if (tile === TILE.C) {
      for (const o of gates) sinksC[o] = 1;
      cJobs += CAPACITY.C[w.level[i]];
    } else if (tile === TILE.I) {
      for (const o of gates) sinksI[o] = 1;
      iJobs += CAPACITY.I[w.level[i]];
    }
  }
  const jobs = cJobs + iJobs;
  if (jobs === 0 || trips === 0) return { trips: 0, worst: 0, jammedShare: 0 };

  const routes = [...splitRoutes(w, sources, sinksC, cJobs / jobs), ...splitRoutes(w, sources, sinksI, iJobs / jobs)];
  const raw = new Float32Array(size);
  for (const r of routes) for (let i = 0; i < size; i++) raw[i] += r.load[i];
  // The buses of the lines take the fleet's trips off the whole city's streets, capped by the population.
  applyTransit(w, raw, transport, trips);

  const condition = roadCondition(roads);
  // Capacity: the lanes of the avenue a cell belongs to, each one carrying what its quality says.
  // A cell's street runs along its longer run of asphalt; its lanes are the cells beside it that
  // run the same way, and the band carries by its weakest cell.
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
    let tier = w.roadTier[i] as RoadTier;
    for (const dir of [-across, across]) {
      let j = i + dir;
      while (lanes < MAX_LANES && isRoad(j) && (alongX || sameRow(j, i)) && runsAlong(j)) {
        lanes++;
        carried += raw[j];
        tier = weakerRoad(tier, w.roadTier[j] as RoadTier);
        j += dir;
      }
    }
    const capacity = lanes * TRAFFIC.laneCapacity * ROAD_TIERS[tier].capacity * condition;
    const pct = Math.min(255, Math.round((100 * carried) / capacity));
    w.traffic[i] = pct;
    if (pct > 100) saturated[i] = 1;
    if (pct > worst) worst = pct;
  }
  // El tránsito que siente cada lote: la peor de sus salidas (las empatadas incluidas).
  for (let i = 0; i < size; i++) {
    if (w.tiles[i] === TILE.ROAD) {
      w.jam[i] = w.traffic[i];
      continue;
    }
    if (streetD[i] < 0) continue;
    let jam = 0;
    for (const o of gatewaysOf(w, streetD, i)) if (w.traffic[o] > jam) jam = w.traffic[o];
    w.jam[i] = jam;
  }

  // Second pass over the same routes: what crosses a saturated cell arrives jammed.
  let jammed = 0;
  for (const r of routes) {
    const stuck = new Float32Array(size);
    for (let k = r.count - 1; k >= 0; k--) {
      const i = r.order[k];
      const here = saturated[i] ? r.load[i] : stuck[i];
      if (r.dist[i] === 0) jammed += here;
      else {
        let outs = 0;
        for (const j of neighborsOf(w, i)) if (j >= 0 && j < size && r.dist[j] === r.dist[i] - 1) outs++;
        if (outs === 0) continue;
        const each = here / outs;
        for (const j of neighborsOf(w, i)) {
          if (j >= 0 && j < size && r.dist[j] === r.dist[i] - 1) stuck[j] += each;
        }
      }
    }
  }
  return { trips, worst, jammedShare: Math.min(1, jammed / trips) };
}

/** How much a lot grows (1 = as usual) given the traffic of the street it opens onto. */
export function jamGrowthFactor(jam: number): number {
  if (jam <= TRAFFIC.slowFrom) return 1;
  return Math.max(TRAFFIC.slowest, 1 - (jam - TRAFFIC.slowFrom) / 150);
}
