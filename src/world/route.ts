/**
 * The provincial route of generated maps: a strip of ordinary road that enters along one border,
 * cannot be touched and costs nothing. Streets can only start from it (see `planTool`). Real-place
 * maps and saves from before it have no route and no restriction. Pure functions of the world.
 */
import { ROUTE } from '../config';
import { hash2 } from '../core/rng';
import { liftSlopes, routeShoulder } from './leveling';
import { SEA_LEVEL, constrainSlopes, isWaterCell, type Terrain } from './terrain';
import { TILE, type World } from './world';

export type RouteEdge = 'north' | 'east' | 'south' | 'west';

const EDGES: readonly RouteEdge[] = ['north', 'east', 'south', 'west'];

export interface RouteChoice {
  edge: RouteEdge;
  /** The cells of the strip, in world coordinates. */
  cells: [number, number][];
  /** How many of them are water: the stretches the route crosses on a bridge. */
  bridges: number;
}

/** Cell at `across` cells in from the border of `edge` and `along` cells from the corner. */
function edgeCell(n: number, edge: RouteEdge, across: number, along: number): [number, number] {
  if (edge === 'west') return [across, along];
  if (edge === 'east') return [n - 1 - across, along];
  if (edge === 'north') return [along, across];
  return [along, n - 1 - across];
}

/**
 * How many lots of dry ground an edge can keep between its strip and the nearest water, counting up
 * to `ROUTE.clearance`: the strip itself is 0, one lot beside it is 1, and a border with no water
 * within reach is `ROUTE.clearance + 1`. Water in the strip scores 0 because there the road has to
 * cross on a bridge.
 */
function waterClearance(t: Terrain, edge: RouteEdge): number {
  const last = ROUTE.inset + ROUTE.width - 1;
  for (let d = 0; d <= ROUTE.clearance; d++) {
    // The strip at distance 0, then the two lots that sit `d` away from it, one on each side.
    const ring = d === 0 ? Array.from({ length: ROUTE.width }, (_, k) => ROUTE.inset + k) : [ROUTE.inset - d, last + d];
    for (let along = ROUTE.margin; along <= t.n - 1 - ROUTE.margin; along++) {
      for (const across of ring) {
        if (across < 0 || across >= t.n) continue;
        const [x, y] = edgeCell(t.n, edge, across, along);
        if (isWaterCell(t, x, y)) return d;
      }
    }
  }
  return ROUTE.clearance + 1;
}

/** Water cells in the strip itself: the stretches the road would cross on a bridge. */
function stripWater(t: Terrain, edge: RouteEdge): number {
  let count = 0;
  for (let along = ROUTE.margin; along <= t.n - 1 - ROUTE.margin; along++) {
    for (let k = 0; k < ROUTE.width; k++) {
      const [x, y] = edgeCell(t.n, edge, ROUTE.inset + k, along);
      if (isWaterCell(t, x, y)) count++;
    }
  }
  return count;
}

/**
 * Picks the border for the route: the one that keeps the most dry ground between its strip and the
 * water, so a border with a lake three lots away loses against one with the lake four lots away and
 * grading the road and its shoulder never has to bend a shore. Borders with the same clearance are
 * told apart by how much water the strip itself would have to cross, which is what keeps the route
 * off the sea of a coastal map, and then by the seed.
 */
export function chooseRoute(terrain: Terrain, seed: number): RouteChoice {
  const clear = EDGES.map((e) => waterClearance(terrain, e));
  const cross = EDGES.map((e) => stripWater(terrain, e));
  const bestClear = Math.max(...clear);
  const bestCross = Math.min(...EDGES.map((_, k) => (clear[k] === bestClear ? cross[k] : Infinity)));
  const tied = EDGES.filter((_, k) => clear[k] === bestClear && cross[k] === bestCross);
  const edge = tied[Math.floor(hash2(17, 29, seed) * tied.length)];
  const cells: [number, number][] = [];
  for (let along = ROUTE.margin; along <= terrain.n - 1 - ROUTE.margin; along++) {
    for (let k = 0; k < ROUTE.width; k++) cells.push(edgeCell(terrain.n, edge, ROUTE.inset + k, along));
  }
  return { edge, cells, bridges: cells.filter(([x, y]) => isWaterCell(terrain, x, y)).length };
}

/**
 * Grades the ground under the route: the whole strip ends up at one height, the average of its
 * corners rounded up, so the roadbed is flat along its length and across its lanes. The lots on
 * both sides of it, `ROUTE.shoulder` of them, are graded to that same height: the city that starts
 * from the route starts on level ground, with no step to climb at the first street. Past the
 * shoulder the map goes on as it always did, filled up or cut down to meet the strip like an
 * embankment, and every corner the grading touched is frozen so those passes cannot undo it.
 * Cells over water are left alone: a bridge crosses the river, it does not fill it, and a lot that
 * touches a shore keeps its own height for the same reason.
 */
export function gradeRoute(w: World, cells: readonly [number, number][]): void {
  const n = w.n;
  const s = n + 1;
  const c = w.terrain.corners;
  const corners: number[] = [];
  const frozen = new Uint8Array(s * s);
  const wet = (x: number, y: number) => isWaterCell(w.terrain, x, y);
  const cornersOf = (x: number, y: number) => [y * s + x, y * s + x + 1, (y + 1) * s + x, (y + 1) * s + x + 1];
  // Corners of any wet cell stay put: grading the road must not fill a lake or raise a shore.
  const shore = new Uint8Array(s * s);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!wet(x, y)) continue;
      for (const j of cornersOf(x, y)) shore[j] = frozen[j] = 1;
    }
  }
  const onRoute = new Uint8Array(n * n);
  for (const [x, y] of cells) {
    onRoute[y * n + x] = 1;
    const k = cornersOf(x, y);
    for (const j of k) frozen[j] = 1;
    if (!wet(x, y)) corners.push(...k);
  }
  if (corners.length === 0) return;
  let sum = 0;
  for (const j of corners) sum += c[j];
  const target = Math.max(SEA_LEVEL + 1, Math.ceil(sum / corners.length));
  for (const j of corners) c[j] = target;
  // The shoulder: every dry lot within `ROUTE.shoulder` of a lane, at the height of the roadbed.
  const band: [number, number][] = [];
  const shoulder = routeShoulder(w);
  for (let i = 0; i < n * n; i++) {
    if (!shoulder[i] || onRoute[i]) continue;
    const x = i % n;
    const y = (i - x) / n;
    const k = cornersOf(x, y);
    // A lot that reaches the water is left to the embankment: freezing it flat would build a wall on the shore.
    if (wet(x, y) || k.some((j) => shore[j])) continue;
    for (const j of k) {
      c[j] = target;
      frozen[j] = 1;
    }
    band.push([x, y]);
  }
  // The rest of the map meets the strip at one level per cell: below it is filled, above it is cut.
  liftSlopes(c, s, frozen);
  constrainSlopes(c, s, frozen);
  for (const [x, y] of cells) w.markDirty(w.idx(x, y));
  for (const [x, y] of band) w.markDirty(w.idx(x, y));
}

/** Builds the route of a new generated world: road on the strip (a bridge over water), marked as route. */
export function addRoute(w: World, seed: number): RouteChoice {
  const choice = chooseRoute(w.terrain, seed);
  for (const [x, y] of choice.cells) {
    const i = w.idx(x, y);
    w.setTile(x, y, TILE.ROAD);
    w.terrain.trees[i] = 0;
    w.route[i] = 1;
  }
  gradeRoute(w, choice.cells);
  w.bumpNetwork();
  return choice;
}

const reached = new WeakMap<World, { version: number; connected: Uint8Array | null }>();

/**
 * 1 on every street cell reachable from the route over street cells, the route included; null
 * when the world has no route. Kept until the network changes, because the tools ask on every
 * mouse move.
 */
export function connectedToRoute(w: World): Uint8Array | null {
  const hit = reached.get(w);
  if (hit && hit.version === w.networkVersion) return hit.connected;
  const n = w.n;
  let connected: Uint8Array | null = null;
  const queue: number[] = [];
  for (let i = 0; i < w.route.length; i++) {
    if (!w.route[i] || w.tiles[i] !== TILE.ROAD) continue;
    connected ??= new Uint8Array(n * n);
    connected[i] = 1;
    queue.push(i);
  }
  while (connected && queue.length) {
    const i = queue.pop()!;
    const x = i % n;
    for (const j of [x > 0 ? i - 1 : -1, x < n - 1 ? i + 1 : -1, i >= n ? i - n : -1, i < n * n - n ? i + n : -1]) {
      if (j >= 0 && !connected[j] && w.tiles[j] === TILE.ROAD) {
        connected[j] = 1;
        queue.push(j);
      }
    }
  }
  reached.set(w, { version: w.networkVersion, connected });
  return connected;
}
