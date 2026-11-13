/** What each kind of power plant gives and costs. Pure functions of the world. */
import { PLANTS, PLANT_SIZE, WIND } from '../config';
import type { Plant, World } from '../world/world';

/**
 * Output in MW of a wind farm whose footprint starts at (x, y). The wind is caught by what stands
 * out: the highest point of the footprint is compared with the average height of the land around
 * it, and open water nearby adds a fixed bonus (see `WIND`).
 */
export function windOutput(w: World, x: number, y: number): number {
  let top = 0;
  for (let dy = 0; dy < PLANT_SIZE; dy++) {
    for (let dx = 0; dx < PLANT_SIZE; dx++) {
      if (w.inBounds(x + dx, y + dy)) top = Math.max(top, w.minMax(x + dx, y + dy)[1]);
    }
  }
  let sum = 0;
  let land = 0;
  let water = false;
  const r = WIND.radius;
  for (let cy = y - r; cy < y + PLANT_SIZE + r; cy++) {
    for (let cx = x - r; cx < x + PLANT_SIZE + r; cx++) {
      if (!w.inBounds(cx, cy)) continue;
      if (w.isWater(cx, cy)) water = true;
      else {
        sum += w.minMax(cx, cy)[1];
        land++;
      }
    }
  }
  const prominence = land ? top - sum / land : 0;
  const mw = WIND.base + prominence * WIND.perLevel + (water ? WIND.coast : 0);
  return Math.round(Math.max(WIND.min, Math.min(WIND.max, mw)));
}

/** Output in MW of a plant where it stands. */
export function plantCapacity(w: World, p: Plant): number {
  return p.kind === 'wind' ? windOutput(w, p.x, p.y) : PLANTS[p.kind].capacity;
}

/** Monthly upkeep of every plant of the city. */
export function plantsUpkeep(w: World): number {
  let total = 0;
  for (const p of w.plants) total += PLANTS[p.kind].upkeep;
  return total;
}
