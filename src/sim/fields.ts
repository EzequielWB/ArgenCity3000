import { BOULEVARD, CAPACITY, COAST_FIELDS, DEFAULT_FUNDING, PARK, PLANTS, ROAD_REACH, SERVICES, TRAFFIC, type ServiceFunding, type ServiceKind } from '../config';
import { SEA_LEVEL } from '../world/terrain';
import { TILE, World, serviceOf } from '../world/world';
import { coastWorks } from './coast';

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

/**
 * How much the boulevard lamps reach each cell: 1 on a boulevard cell, fading to 0 at the edge of
 * `BOULEVARD.radius`. Where boulevards overlap it stays at 1: two rows of lamps are not twice the light.
 */
function lampField(w: World): Float32Array {
  const n = w.n;
  const lamps = new Float32Array(n * n);
  if (!w.roadTier.includes(2)) return lamps;
  for (let i = 0; i < n * n; i++) {
    if (w.tiles[i] === TILE.ROAD && w.roadTier[i] === 2) splat(lamps, n, i % n, Math.floor(i / n), BOULEVARD.radius, 1);
  }
  return lamps;
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

/**
 * What one cell of a plaza adds, or takes away. A patch smaller than `PARK.minArea` is an ornament
 * and does nothing. A patch that counts spreads further the bigger it is, and its value follows the
 * budget for green spaces: at 100 % it gives all it can, at `PARK.care` it gives nothing, below that
 * it loses the neighbours' value as an abandoned building would.
 */
function splatPark(w: World, amenities: Float32Array, blight: Float32Array, i: number): void {
  const area = w.parkArea[i];
  if (area < PARK.minArea) return;
  const mood = (w.parkCare[i] - PARK.care) / (100 - PARK.care);
  if (mood === 0) return;
  const x = i % w.n;
  const y = (i - x) / w.n;
  const radius = Math.min(8, PARK.radius + Math.floor(Math.log2(area)));
  if (mood > 0) {
    const size = Math.min(2.5, 0.4 + Math.log2(area + 1) / 2);
    splat(amenities, w.n, x, y, radius, PARK.value * size * mood);
  } else splat(blight, w.n, x, y, radius, PARK.neglect * -mood);
}

/** Industry, working ports and power plants pollute their surroundings, each kind of plant in its own measure. */
export function computePollution(w: World): void {
  const n = w.n;
  const acc = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) {
    if (w.tiles[i] === TILE.I && w.level[i] > 0) {
      splat(acc, n, i % n, Math.floor(i / n), 4, 10 * w.level[i]);
    } else if (w.tiles[i] === TILE.PORT && coastWorks(w, i)) {
      splat(acc, n, i % n, Math.floor(i / n), COAST_FIELDS.portSmoke.radius, COAST_FIELDS.portSmoke.strength);
    }
  }
  for (const p of w.plants) {
    const { smoke, smokeRadius } = PLANTS[p.kind];
    if (smoke > 0) splat(acc, n, p.x, p.y, smokeRadius, smoke);
  }
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

function coverageField(w: World, kind: ServiceKind): Uint8Array {
  return kind === 'school' ? w.edu : kind === 'clinic' ? w.health : kind === 'police' ? w.safety : w.fireCover;
}

/**
 * Residents inside the radius of the service at cell `i`: the people of the occupied homes
 * (built, not abandoned, not burning) within reach. Coverage (`computeServices`) and upkeep
 * (`monthlyBudget`) both read this, so what a service covers and what it costs agree.
 */
export function residentsServed(w: World, i: number, kind: ServiceKind): number {
  const n = w.n;
  const { radius } = SERVICES[kind];
  const cx = i % n;
  const cy = (i - cx) / n;
  const r2 = radius * radius;
  let residents = 0;
  for (let y = Math.max(0, cy - radius); y <= Math.min(n - 1, cy + radius); y++) {
    for (let x = Math.max(0, cx - radius); x <= Math.min(n - 1, cx + radius); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > r2) continue;
      const j = y * n + x;
      if (w.tiles[j] === TILE.R && w.isOccupied(j)) residents += CAPACITY.R[w.level[j]];
    }
  }
  return residents;
}

/** Share of a service's capacity in use, from 0 to 1. */
export function utilization(w: World, i: number, kind: ServiceKind): number {
  return Math.min(1, residentsServed(w, i, kind) / SERVICES[kind].capacity);
}

/**
 * Coverage of every public service. A powered service covers a disc of its radius, fading a
 * little towards the edge; if more residents live in the disc than it can serve, its
 * coverage drops in proportion. Overlapping services of the same kind add up to 100.
 * `funding` scales each kind's coverage (a school funded at 50 % covers half as well).
 */
export function computeServices(w: World, funding: Readonly<ServiceFunding> = DEFAULT_FUNDING): void {
  const n = w.n;
  w.edu.fill(0);
  w.health.fill(0);
  w.safety.fill(0);
  w.fireCover.fill(0);
  for (let i = 0; i < n * n; i++) {
    const kind = serviceOf(w.tiles[i]);
    if (!kind || !w.powered[i] || funding[kind] <= 0) continue;
    const { radius, capacity } = SERVICES[kind];
    const cx = i % n;
    const cy = (i - cx) / n;
    const r2 = radius * radius;
    const residents = residentsServed(w, i, kind);
    const efficiency = Math.min(1, capacity / Math.max(1, residents)) * (funding[kind] / 100);
    const field = coverageField(w, kind);
    for (let y = Math.max(0, cy - radius); y <= Math.min(n - 1, cy + radius); y++) {
      for (let x = Math.max(0, cx - radius); x <= Math.min(n - 1, cx + radius); x++) {
        const d2 = (x - cx) ** 2 + (y - cy) ** 2;
        if (d2 > r2) continue;
        const v = Math.round(100 * efficiency * (1 - (0.35 * Math.sqrt(d2)) / radius));
        const j = y * n + x;
        field[j] = Math.min(100, field[j] + v);
      }
    }
  }
}

/**
 * Crime grows with how dense the neighbourhood is (commerce counts a bit more) and with the
 * size of the city; police coverage takes most of it away. Needs services first.
 */
export function computeCrime(w: World, pop: number): void {
  const n = w.n;
  const lamps = lampField(w);
  const cityFactor = Math.min(1, pop / 2500);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let density = 0;
      for (let dy = -2; dy <= 2; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= n) continue;
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= n) continue;
          const j = ny * n + nx;
          if (!w.isOccupied(j)) continue;
          density += w.level[j] * (w.tiles[j] === TILE.C ? 1.3 : 1);
        }
      }
      const i = y * n + x;
      const raw = density * cityFactor;
      const shade = BOULEVARD.crime * Math.min(1, lamps[i]);
      w.crime[i] = clamp100(Math.max(0, raw * (1 - (0.85 * w.safety[i]) / 100) - shade));
    }
  }
}

/** Land value: views of the water, plazas, promenades, lighthouses, trees and height add; pollution, crime and a saturated street subtract. The lamps of a boulevard buy no value here; what they are worth shows in its crime. Needs pollution, crime and congestion first. */
/**
 * Fills `parkArea` (how many cells the plaza patch of each cell has) and `parkCare` (how well that
 * patch is kept, 0-100, straight from the budget for green spaces). Plazas are 4-connected: a 2x2
 * block or a 1x3 walk is one patch, two plazas that only touch at a corner are two.
 */
export function computeParks(w: World, green: number): void {
  const n = w.n;
  const care = Math.max(0, Math.min(100, Math.round(green)));
  w.parkArea.fill(0);
  w.parkCare.fill(0);
  const queue = new Int32Array(n * n);
  for (let i = 0; i < n * n; i++) {
    if (w.tiles[i] !== TILE.PARK || w.parkArea[i] !== 0) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = i;
    w.parkArea[i] = 1; // in the patch; the real size is written once the walk is over
    while (head < tail) {
      const c = queue[head++];
      const x = c % n;
      const y = (c - x) / n;
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        const j = ny * n + nx;
        if (w.tiles[j] !== TILE.PARK || w.parkArea[j] !== 0) continue;
        w.parkArea[j] = 1;
        queue[tail++] = j;
      }
    }
    for (let k = 0; k < tail; k++) {
      w.parkArea[queue[k]] = tail;
      w.parkCare[queue[k]] = care;
    }
  }
}

/**
 * Land value of every cell. `coast` scales the bonus for being close to the water: an event can
 * leave the seafront falling apart without touching anything else.
 */
export function computeLandValue(w: World, coast = 1): void {
  const n = w.n;
  const water = waterDistance(w);
  const amenities = new Float32Array(n * n);
  const blight = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) {
    const t = w.tiles[i];
    if (t === TILE.PARK) splatPark(w, amenities, blight, i);
    else if (t === TILE.PROMENADE) splat(amenities, n, i % n, Math.floor(i / n), COAST_FIELDS.promenadeValue.radius, COAST_FIELDS.promenadeValue.strength);
    else if (t === TILE.LIGHTHOUSE) splat(amenities, n, i % n, Math.floor(i / n), COAST_FIELDS.lighthouseValue.radius, COAST_FIELDS.lighthouseValue.strength);
    if (w.abandoned[i] && w.level[i] > 0) splat(blight, n, i % n, Math.floor(i / n), 2, 8);
  }
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      let v = 25;
      if (water[i] > 0 && water[i] < 6) v += (6 - water[i]) * 5 * coast;
      v += Math.min(30, amenities[i]);
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
      v += (w.edu[i] + w.health[i]) * 0.08;
      v -= w.crime[i] * 0.35;
      v -= Math.max(0, w.jam[i] - TRAFFIC.valueFrom) * TRAFFIC.valuePerPoint;
      w.landValue[i] = clamp100(v);
    }
  }
}
