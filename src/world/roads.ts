/**
 * Las calles como cuadras, no como celdas. Una avenida son varias calzadas pegadas y el juego la trata
 * como una sola cosa: la capacidad de una banda es la de su calzada más débil (ver `sim/congestion.ts`)
 * y el mapa la dibuja entera con la calidad más baja (ver `render/avenue.ts`). Mejorar una calzada suelta
 * deja un estado que no existe en la calle real y que además no se ve: la banda sigue dibujándose como la
 * más débil. Este módulo da la sección transversal, que es la unidad de mejora.
 */
import { MAX_BAND, weakerRoad, type RoadTier } from '../config';
import { TILE, type World } from './world';

/** Largo del tramo continuo de calle que contiene (x, y), avanzando en la dirección (dx, dy). */
function run(w: World, x: number, y: number, dx: number, dy: number): number {
  let len = 0;
  for (const dir of [1, -1]) {
    let cx = x + dx * dir;
    let cy = y + dy * dir;
    while (w.inBounds(cx, cy) && w.tiles[w.idx(cx, cy)] === TILE.ROAD) {
      len++;
      cx += dx * dir;
      cy += dy * dir;
    }
  }
  return len + 1;
}

/**
 * La sección de la calle que corre a lo largo de (dx, dy): las celdas de al lado, transversales a la
 * cuadra. Es `null` cuando esa dirección no es la de una calle acá: la sección se pasa de `MAX_BAND`
 * o alguna de sus celdas corre para el otro lado. En un cruce los tramos se funden y una de las dos
 * candidatas miente —devolvería la calzada entera de la otra calle—; este chequeo es el que lo pesca.
 */
function sliceOf(w: World, x: number, y: number, along: [number, number]): [number, number][] | null {
  const across: [number, number] = [along[1], along[0]];
  if (run(w, x, y, across[0], across[1]) > MAX_BAND) return null;
  const cells: [number, number][] = [];
  // Se camina en las dos direcciones desde la celda, y se da vuelta el tramo para que salga en orden.
  const back: [number, number][] = [];
  for (const dir of [1, -1]) {
    const target = dir === 1 ? cells : back;
    let cx = x + across[0] * dir;
    let cy = y + across[1] * dir;
    while (w.inBounds(cx, cy) && w.tiles[w.idx(cx, cy)] === TILE.ROAD) {
      target.push([cx, cy]);
      cx += across[0] * dir;
      cy += across[1] * dir;
    }
  }
  const out: [number, number][] = [...back.reverse(), [x, y], ...cells];
  for (const [cx, cy] of out) {
    if (run(w, cx, cy, along[0], along[1]) < run(w, cx, cy, across[0], across[1])) return null;
  }
  return out;
}

/** El cuadro 2x2 de calle que contiene (x, y), o `null` si ninguno de los cuatro es todo calle. */
function blockOf2x2(w: World, x: number, y: number): [number, number][] | null {
  for (const [dx, dy] of [
    [0, 0],
    [-1, 0],
    [0, -1],
    [-1, -1],
  ] as const) {
    const ax = x + dx;
    const ay = y + dy;
    const cells: [number, number][] = [
      [ax, ay],
      [ax + 1, ay],
      [ax, ay + 1],
      [ax + 1, ay + 1],
    ];
    if (cells.every(([cx, cy]) => w.inBounds(cx, cy) && w.tiles[w.idx(cx, cy)] === TILE.ROAD)) return cells;
  }
  return null;
}

/**
 * Las calzadas que corren al lado de una celda de calle: el tramo continuo perpendicular a la cuadra.
 * El eje de la cuadra es su tramo más largo, igual que lee el mapa. En un cruce de verdad —donde las
 * dos secciones mienten— la celda pertenece a dos calles a la vez y se devuelve el cruce entero (el
 * cuadro 2x2): mejorarlo por partes dejaría una celda a mitad que el mapa dibuja con la más débil.
 * Una sección más ancha que `MAX_BAND` no es una calle (es una playa de estacionamiento) y se devuelve sola.
 */
export function crossSection(w: World, x: number, y: number): [number, number][] {
  if (w.tiles[w.idx(x, y)] !== TILE.ROAD) return [[x, y]];
  const hRun = run(w, x, y, 1, 0);
  const vRun = run(w, x, y, 0, 1);
  const hx = sliceOf(w, x, y, [1, 0]);
  const hy = sliceOf(w, x, y, [0, 1]);
  const slice = hx && hy ? (hRun >= vRun ? hx : hy) : (hx ?? hy);
  if (slice) return slice;
  if (hRun > MAX_BAND && vRun > MAX_BAND) return [[x, y]];
  return blockOf2x2(w, x, y) ?? [[x, y]];
}

/**
 * La calidad que se ve en una celda de calle: la de su calzada más débil, que es la que usa el mapa para
 * dibujarla y la que usa el tránsito para contarla. El consultar lee esto y no el dato crudo de la celda,
 * para no decir «Bulevar» sobre una calzada que se ve de tierra.
 */
export function roadTierSeen(w: World, x: number, y: number): RoadTier {
  const own = w.roadTier[w.idx(x, y)] as RoadTier;
  if (w.tiles[w.idx(x, y)] !== TILE.ROAD) return own;
  let tier = own;
  for (const [cx, cy] of crossSection(w, x, y)) tier = weakerRoad(tier, w.roadTier[w.idx(cx, cy)] as RoadTier);
  return tier;
}
