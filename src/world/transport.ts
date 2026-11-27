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

/**
 * Every bus depot of the city, in cell order. A depot is a `BUS.size`×`BUS.size` block of cells that
 * all carry the same line, so the cells of one depot are one station: the anchor, the lowest index.
 */
export function busStations(w: World): BusStation[] {
  const out: BusStation[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < w.tiles.length; i++) {
    if (w.tiles[i] !== TILE.BUS) continue;
    const line = w.busLine[i];
    if (seen.has(line)) continue;
    seen.add(line);
    out.push({ i, x: i % w.n, y: Math.floor(i / w.n), line, color: busColorOf(line), number: busNumberOf(line) });
  }
  return out;
}

/** The depot that covers a cell: the corner its block starts at, and its line. Null when the cell has no depot. */
export function depotAt(w: World, x: number, y: number): { x: number; y: number; line: number } | null {
  const i = w.idx(x, y);
  if (w.tiles[i] !== TILE.BUS) return null;
  const line = w.busLine[i];
  let ax = x;
  let ay = y;
  // A block is only a couple of cells: whichever corner of the block this cell is, the anchor is one
  // step back in x, in y or both, and the cells beyond that corner belong to another depot.
  for (const [dx, dy] of [
    [-1, 0],
    [0, -1],
    [-1, -1],
  ]) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= w.n || ny >= w.n) continue;
    const j = w.idx(nx, ny);
    if (w.tiles[j] === TILE.BUS && w.busLine[j] === line) {
      ax = Math.min(ax, nx);
      ay = Math.min(ay, ny);
    }
  }
  return { x: ax, y: ay, line };
}

/** Why a line (colour and number packed) cannot be had by the depot at `cell`, or null when it can. The depot at `cell` is left out of the count of numbers in use. */
export function busLineProblem(w: World, line: number, cell = -1): string | null {
  const color = busColorOf(line);
  const number = busNumberOf(line);
  if (color < 0 || color >= BUS_COLORS.length) return 'Elegí uno de los colores';
  if (number < 1 || number > MAX_BUS_NUMBER) return `El número tiene que ser de 1 a ${MAX_BUS_NUMBER}`;
  // The depot being changed still carries its old line, so its own station has to be left out by line
  // and not by cell: the four cells of a depot are four cells of the same station.
  const own = cell >= 0 && w.tiles[cell] === TILE.BUS ? w.busLine[cell] : -1;
  if (busStations(w).some((s) => s.line !== line && s.line !== own && s.number === number)) return `Ya hay una línea ${number}`;
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

/** Why a bus depot cannot go on a lot, or null when it can (a lot that is merely taken is not a reason given here). A street is not needed to build it, only for its buses to run. */
export function busRefusal(w: World, x: number, y: number): string | null {
  return w.isWater(x, y) ? `${BUS.label}: tiene que estar en tierra` : null;
}
