/**
 * El campo en el mundo: dónde está cada lote, cada silo y cada feria.
 *
 * Como las usinas y los únicos, cada pieza es una entrada de lista con su esquina de arriba a la izquierda, y
 * las celdas que ocupa llevan el tile que le corresponde. El stock no vive en el lote sino en los silos: un
 * lote produce y entrega, y lo que espera para venderse está en el silo, que es lo que se llena.
 */
import { FARM_SIZE, MARKET_SIZE, MARKET_THROUGHPUT, SILO_CAPACITY, SILO_SIZE } from '../config';
import type { Farm, Market, Silo, World } from './world';

export type Cell = [number, number];

/** Las celdas que ocupa una pieza anclada en (x, y), recortadas al mapa. */
function footprint(n: number, x: number, y: number, size: number): Cell[] {
  const cells: Cell[] = [];
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const cx = x + dx;
      const cy = y + dy;
      if (cx >= 0 && cx < n && cy >= 0 && cy < n) cells.push([cx, cy]);
    }
  }
  return cells;
}

export const farmFootprint = (n: number, x: number, y: number): Cell[] => footprint(n, x, y, FARM_SIZE);
export const siloFootprint = (n: number, x: number, y: number): Cell[] => footprint(n, x, y, SILO_SIZE);
export const marketFootprint = (n: number, x: number, y: number): Cell[] => footprint(n, x, y, MARKET_SIZE);

/** El lote de cultivo que pisa la celda, o null. */
export function farmAt(w: World, x: number, y: number): Farm | null {
  return w.farms.find((f) => x >= f.x && x < f.x + FARM_SIZE && y >= f.y && y < f.y + FARM_SIZE) ?? null;
}

/** El silo que pisa la celda, o null. */
export function siloAt(w: World, x: number, y: number): Silo | null {
  return w.silos.find((s) => x >= s.x && x < s.x + SILO_SIZE && y >= s.y && y < s.y + SILO_SIZE) ?? null;
}

/** La feria que pisa la celda, o null. */
export function marketAt(w: World, x: number, y: number): Market | null {
  return w.markets.find((m) => x >= m.x && x < m.x + MARKET_SIZE && y >= m.y && y < m.y + MARKET_SIZE) ?? null;
}

/** Las toneladas guardadas en toda la ciudad. */
export function storedTons(w: World): number {
  return w.silos.reduce((sum, s) => sum + Math.max(0, s.tons), 0);
}

/** Cuánto entra en total: sin silos no se guarda nada, y sin lugar la cosecha se pierde. */
export function siloRoom(w: World): number {
  return w.silos.length * SILO_CAPACITY;
}

/** Toneladas que la ciudad puede convertir en pesos por mes: lo que suman sus ferias. */
export function marketRoom(w: World): number {
  return w.markets.length * MARKET_THROUGHPUT;
}

/**
 * Guarda `tons` toneladas en los silos, de a una, y devuelve **lo que no entró**.
 *
 * Lo que no entra no se tira en silencio: el que llama decide si se pierde (no hay dónde guardarlo) o si se
 * avisa. Reparte desde el primer silo con lugar para que el stock quede parejo y la merma no castigue siempre
 * al mismo.
 */
export function storeTons(w: World, tons: number): number {
  let left = Math.max(0, tons);
  for (const silo of w.silos) {
    if (left <= 0) break;
    const room = SILO_CAPACITY - Math.max(0, silo.tons);
    if (room <= 0) continue;
    const put = Math.min(room, left);
    silo.tons += put;
    left -= put;
  }
  return left;
}
