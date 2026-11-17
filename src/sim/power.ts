import { HUBS, LINE_TIERS, POWER_REACH, POWER_USE, SERVICES } from '../config';
import { hubFacilities } from '../world/hubs';
import { serviceBlocksOf, serviceFootprint } from '../world/services';
import { TILE, World, coastOf, hubOf, serviceOf, zoneOf } from '../world/world';
import { fundingCondition } from './condition';
import { plantCapacity } from './plants';
import { NO_MODS, type RunMods } from './roguelike';

export interface PowerReport {
  capacity: number;
  /** Power the buildings connected to a plant ask for. */
  use: number;
  /** True when some connected building is left in the dark. */
  shortage: boolean;
}

export function buildingPowerUse(tile: number, level: number): number {
  const z = zoneOf(tile);
  return z && level > 0 ? POWER_USE[z] * level : 0;
}

/** Power a cell asks for right now: empty and abandoned buildings ask for nothing. */
export function powerNeed(w: World, i: number): number {
  const service = serviceOf(w.tiles[i]);
  if (service) return SERVICES[service].power;
  return w.isOccupied(i) ? buildingPowerUse(w.tiles[i], w.level[i]) : 0;
}

/**
 * What the airports and harbours ask for: the facility of its level, shared by its pieces, each one asking on its own first lot.
 * The bigger the facility, the more it takes: an international airport is half a coal plant.
 */
/**
 * What the services ask for. A building on nine lots asks once, on its anchor, and the rest of its lots
 * ask for nothing: the alternative is a hospital that draws nine hospitals worth of light.
 */
function servicePowerNeeded(w: World): Map<number, number> {
  const need = new Map<number, number>();
  for (const b of serviceBlocksOf(w).blocks) {
    if (b.size === 1) continue;
    for (const [x, y] of serviceFootprint(b.kind, w.n, b.x, b.y)) need.set(w.idx(x, y), 0);
    need.set(w.idx(b.x, b.y), SERVICES[b.kind].power);
  }
  return need;
}

/** A service is lit as a whole: one building cannot have a dark corner while the rest works. */
function spreadServicePower(w: World): void {
  for (const b of serviceBlocksOf(w).blocks) {
    if (b.size === 1) continue;
    const on = w.powered[w.idx(b.x, b.y)];
    for (const [x, y] of serviceFootprint(b.kind, w.n, b.x, b.y)) w.powered[w.idx(x, y)] = on;
  }
}

function hubPowerNeeds(w: World): Map<number, number> {
  const needs = new Map<number, number>();
  for (const f of hubFacilities(w)) {
    const each = Math.ceil(HUBS[f.kind].power[f.level - 1] / f.pieces.length);
    for (const p of f.pieces) needs.set(w.idx(p.x, p.y), each);
  }
  return needs;
}

/** The cells of a disc of the given radius around a cell, as dx/dy pairs (the centre excluded). */
function discOffsets(reach: number): { dx: Int8Array; dy: Int8Array } {
  const dx: number[] = [];
  const dy: number[] = [];
  for (let y = -reach; y <= reach; y++) {
    for (let x = -reach; x <= reach; x++) {
      if ((x || y) && x * x + y * y <= reach * reach) {
        dx.push(x);
        dy.push(y);
      }
    }
  }
  return { dx: Int8Array.from(dx), dy: Int8Array.from(dy) };
}

const BUILDING_DISC = discOffsets(POWER_REACH);
/** One disc per quality of grid: the concrete line lights five lots around each pole instead of three. */
const LINE_DISCS = LINE_TIERS.map((t) => discOffsets(t.reach));

/**
 * The lots that relays standing on `cells` would light with the given reach: every cell of the
 * map inside the disc of one of them, without the cells themselves. For the placement preview.
 */
export function reachCells(n: number, cells: readonly (readonly [number, number])[], reach: number): [number, number][] {
  const disc = reach === POWER_REACH ? BUILDING_DISC : discOffsets(reach);
  const own = new Set(cells.map(([x, y]) => y * n + x));
  const seen = new Set<number>();
  const out: [number, number][] = [];
  for (const [x, y] of cells) {
    for (let k = 0; k < disc.dx.length; k++) {
      const nx = x + disc.dx[k];
      const ny = y + disc.dy[k];
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      const j = ny * n + nx;
      if (own.has(j) || seen.has(j)) continue;
      seen.add(j);
      out.push([nx, ny]);
    }
  }
  return out;
}

/**
 * True for the cells that pass the light on: plants, power-line cells, services, zone buildings and
 * every kind of built facility — the pieces of an airport or a harbour, and the ones on the coast
 * (abandoned and burning buildings too, so that an abandonment or a fire does not switch off a
 * chain; they stop only when the building is gone). A facility is one building drawn over several
 * lots, so its pieces pass the light between them: one line reaching one piece lights the whole
 * thing instead of the player having to fence it in. Roads, parks, empty land and lots without a
 * building only receive light.
 */
export function isRelay(w: World, i: number): boolean {
  const tile = w.tiles[i];
  if (tile === TILE.PLANT || tile === TILE.LINE) return true;
  if (zoneOf(tile)) return w.level[i] > 0;
  if (hubOf(tile) || coastOf(tile)) return true;
  return serviceOf(tile) !== null;
}

/**
 * Lights the map from each plant. A relay lights every cell inside its reach (a disc of
 * POWER_REACH lots, or the reach of the pole's own quality), whatever is on it; a lit cell passes the
 * light on only if it is a relay itself (see `isRelay`), so roads carry nothing and the light
 * travels over distance only through buildings or a power line. Buildings take power in BFS order
 * until the network runs out (a dark building still relays: connectivity does not depend on
 * capacity); cells that ask for nothing are lit when the network has spare capacity.
 */
export function computePower(w: World, plantsFunding = 100, mods: RunMods = NO_MODS): PowerReport {
  const n = w.n;
  const powered = w.powered;
  powered.fill(0);
  const visited = new Uint8Array(n * n);
  let capacity = 0;
  let use = 0;
  let shortage = false;
  const queue = new Int32Array(n * n);
  const hubNeed = hubPowerNeeds(w);
  const serviceNeed = servicePowerNeeded(w);
  const needOf = (i: number) => hubNeed.get(i) ?? serviceNeed.get(i) ?? powerNeed(w, i);

  for (const plant of w.plants) {
    const start = w.idx(plant.x, plant.y);
    if (visited[start]) continue;
    // Collect one network.
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    while (head < tail) {
      const i = queue[head++];
      if (!isRelay(w, i)) continue;
      const x = i % n;
      const y = (i - x) / n;
      const disc = w.tiles[i] === TILE.LINE ? LINE_DISCS[w.lineTier[i]] : BUILDING_DISC;
      for (let k = 0; k < disc.dx.length; k++) {
        const nx = x + disc.dx[k];
        const ny = y + disc.dy[k];
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        const j = ny * n + nx;
        if (visited[j]) continue;
        visited[j] = 1;
        queue[tail++] = j;
      }
    }
    let cap = 0;
    const seenPlants = new Set<object>();
    for (let k = 0; k < tail; k++) {
      const i = queue[k];
      if (w.tiles[i] === TILE.PLANT) {
        const p = w.plantAt(i % n, Math.floor(i / n));
        if (p && !seenPlants.has(p)) {
          seenPlants.add(p);
          cap += Math.round(plantCapacity(w, p) * fundingCondition(plantsFunding) * mods.power);
        }
      }
    }
    let remaining = cap;
    let netUse = 0;
    for (let k = 0; k < tail; k++) {
      const i = queue[k];
      const need = needOf(i);
      if (need === 0) continue;
      netUse += need;
      if (need <= remaining) {
        remaining -= need;
        powered[i] = 1;
      } else {
        shortage = true;
      }
    }
    for (let k = 0; k < tail; k++) {
      const i = queue[k];
      if (needOf(i) === 0) powered[i] = remaining > 0 ? 1 : 0;
    }
    capacity += cap;
    use += netUse;
  }
  spreadServicePower(w);
  return { capacity, use, shortage };
}
