/** What each kind of power plant gives and costs. Pure functions of the world. */
import { PLANTS, PLANT_LIFE, WIND, plantSizeOf } from '../config';
import type { Plant, World } from '../world/world';

/**
 * Output in MW of a wind farm whose footprint starts at (x, y). The wind is caught by what stands
 * out: the highest point of the footprint is compared with the average height of the land around
 * it, and open water nearby adds a fixed bonus (see `WIND`).
 */
export function windOutput(w: World, x: number, y: number): number {
  let top = 0;
  for (let dy = 0; dy < plantSizeOf('wind'); dy++) {
    for (let dx = 0; dx < plantSizeOf('wind'); dx++) {
      if (w.inBounds(x + dx, y + dy)) top = Math.max(top, w.minMax(x + dx, y + dy)[1]);
    }
  }
  let sum = 0;
  let land = 0;
  let water = false;
  const r = WIND.radius;
  for (let cy = y - r; cy < y + plantSizeOf('wind') + r; cy++) {
    for (let cx = x - r; cx < x + plantSizeOf('wind') + r; cx++) {
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

/**
 * Qué tanto de su capacidad nominal entrega una usina de `age` meses de servicio.
 *
 * Entera mientras es nueva, y desde los cincuenta años cae de a poco hasta la mitad, donde se queda. No
 * baja a cero a propósito: una usina que se apaga sola deja la ciudad a oscuras y sin salida, y el punto
 * de la obsolescencia es que el jugador tenga que gastar, no que pierda la partida por no haber mirado
 * la edad de una máquina que compró hace cincuenta años.
 */
export function ageFactor(age: number): number {
  if (age <= PLANT_LIFE.full) return 1;
  const t = Math.min(1, (age - PLANT_LIFE.full) / PLANT_LIFE.decay);
  return 1 - (1 - PLANT_LIFE.floor) * t;
}

/** Output in MW of a plant where it stands: what its kind gives, less what its age took away. */
export function plantCapacity(w: World, p: Plant): number {
  const base = p.kind === 'wind' ? windOutput(w, p.x, p.y) : PLANTS[p.kind].capacity;
  return Math.max(0, Math.round(base * ageFactor(p.age ?? 0)));
}

/** Monthly upkeep of every plant of the city. */
export function plantsUpkeep(w: World): number {
  let total = 0;
  for (const p of w.plants) total += PLANTS[p.kind].upkeep;
  return total;
}
