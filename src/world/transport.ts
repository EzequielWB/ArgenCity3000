/**
 * Bus lines. A line lives in the cell of its depot (`World.busLine`): the colour in the high bits,
 * the number (1 to 999) in the low ten. Nothing else is stored, so a demolished depot frees its
 * number by itself.
 */
import { BUS, BUS_COLORS, MAX_BUS_NUMBER, ROAD_REACH } from '../config';
import { TILE, type World } from './world';

const NUMBER_BITS = 10;
const NUMBER_MASK = (1 << NUMBER_BITS) - 1;

export const packBusLine = (color: number, number: number): number => (color << NUMBER_BITS) | number;
export const busColorOf = (line: number): number => line >> NUMBER_BITS;
export const busNumberOf = (line: number): number => line & NUMBER_MASK;

export interface BusStation {
  i: number;
  x: number;
  y: number;
  line: number;
  color: number;
  number: number;
}

/** Every bus depot of the city, in cell order. */
export function busStations(w: World): BusStation[] {
  const out: BusStation[] = [];
  for (let i = 0; i < w.tiles.length; i++) {
    if (w.tiles[i] !== TILE.BUS) continue;
    const line = w.busLine[i];
    out.push({ i, x: i % w.n, y: Math.floor(i / w.n), line, color: busColorOf(line), number: busNumberOf(line) });
  }
  return out;
}

/** Why a line (colour and number packed) cannot be had by the depot at `cell`, or null when it can. `cell` is left out of the count of numbers in use. */
export function busLineProblem(w: World, line: number, cell = -1): string | null {
  const color = busColorOf(line);
  const number = busNumberOf(line);
  if (color < 0 || color >= BUS_COLORS.length) return 'Elegí uno de los colores';
  if (number < 1 || number > MAX_BUS_NUMBER) return `El número tiene que ser de 1 a ${MAX_BUS_NUMBER}`;
  if (busStations(w).some((s) => s.i !== cell && s.number === number)) return `Ya hay una línea ${number}`;
  return null;
}

/** The lowest number no line uses yet, or 0 when all of them are taken. */
export function freeBusNumber(w: World): number {
  const used = new Set(busStations(w).map((s) => s.number));
  for (let k = 1; k <= MAX_BUS_NUMBER; k++) if (!used.has(k)) return k;
  return 0;
}

/** True when a street is within ROAD_REACH of the lot (Manhattan distance): the depot needs it to send its buses out. */
export function streetNear(w: World, x: number, y: number): boolean {
  for (let dy = -ROAD_REACH; dy <= ROAD_REACH; dy++) {
    for (let dx = -ROAD_REACH; dx <= ROAD_REACH; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > ROAD_REACH || !w.inBounds(x + dx, y + dy)) continue;
      if (w.tileAt(x + dx, y + dy) === TILE.ROAD) return true;
    }
  }
  return false;
}

/** Why a bus depot cannot go on a lot, or null when it can (a lot that is merely taken is not a reason given here). */
export function busRefusal(w: World, x: number, y: number): string | null {
  if (w.isWater(x, y)) return `${BUS.label}: tiene que estar en tierra`;
  if (!streetNear(w, x, y)) return `${BUS.label}: tiene que estar a ${ROAD_REACH} lotes o menos de una calle`;
  return null;
}

/** The lots a depot at (x, y) covers: the diamond of `BUS.radius` lots around it, kept inside the map. */
export function busArea(n: number, x: number, y: number): [number, number][] {
  const out: [number, number][] = [];
  for (let dy = -BUS.radius; dy <= BUS.radius; dy++) {
    for (let dx = -BUS.radius; dx <= BUS.radius; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > BUS.radius) continue;
      const cx = x + dx;
      const cy = y + dy;
      if (cx >= 0 && cy >= 0 && cx < n && cy < n) out.push([cx, cy]);
    }
  }
  return out;
}
