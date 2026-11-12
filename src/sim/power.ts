import { PLANT_CAPACITY, POWER_USE } from '../config';
import { TILE, World, zoneOf } from '../world/world';

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

/**
 * Flood-fills each power network from its plants through every built cell (roads, lines,
 * zones, parks, plants). Buildings take power in BFS order until the network runs out;
 * empty lots count as powered only when their network has spare capacity.
 */
export function computePower(w: World): PowerReport {
  const n = w.n;
  const powered = w.powered;
  powered.fill(0);
  const visited = new Uint8Array(n * n);
  let capacity = 0;
  let use = 0;
  let shortage = false;
  const queue = new Int32Array(n * n);

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
      const x = i % n;
      const y = (i - x) / n;
      if (x > 0) tail = visit(i - 1, tail);
      if (x < n - 1) tail = visit(i + 1, tail);
      if (y > 0) tail = visit(i - n, tail);
      if (y < n - 1) tail = visit(i + n, tail);
    }
    let cap = 0;
    const seenPlants = new Set<object>();
    for (let k = 0; k < tail; k++) {
      const i = queue[k];
      if (w.tiles[i] === TILE.PLANT) {
        const p = w.plantAt(i % n, Math.floor(i / n));
        if (p && !seenPlants.has(p)) {
          seenPlants.add(p);
          cap += PLANT_CAPACITY;
        }
      }
    }
    let remaining = cap;
    let netUse = 0;
    for (let k = 0; k < tail; k++) {
      const i = queue[k];
      const need = buildingPowerUse(w.tiles[i], w.level[i]);
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
      if (buildingPowerUse(w.tiles[i], w.level[i]) === 0) powered[i] = remaining > 0 ? 1 : 0;
    }
    capacity += cap;
    use += netUse;
  }
  return { capacity, use, shortage };

  function visit(j: number, tail: number): number {
    if (visited[j] || w.tiles[j] === TILE.EMPTY) return tail;
    visited[j] = 1;
    queue[tail] = j;
    return tail + 1;
  }
}
