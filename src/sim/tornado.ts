/**
 * El tornado: el recorrido, el ancho y el avance, puras funciones del estado.
 *
 * Vive aparte de la simulación porque es lo único de los desastres que necesita **dibujarse**: el embudo
 * tiene que estar en algún lado mientras cruza, y ese lado lo leen los dos, el que destruye y el que pinta.
 * Si el recorrido se calculara de nuevo en el render, el dibujo y el daño se desincronizarían.
 */
import { DESASTRE, MAX_TAX, TICKS_PER_MONTH } from '../config';
import type { Rng } from '../core/rng';
import { averageTax } from './demand';
import type { ZoneTaxes } from '../config';

export interface TornadoRun {
  /** Cruza por las columnas (de borde a borde en x) o por las filas. */
  horizontal: boolean;
  /** La columna o fila por la que entra, ya en el mapa. */
  fixed: number;
  /** +1 si cruza de 0 a n-1, -1 al revés. */
  dir: 1 | -1;
  /** La celda del eje que está pisando ahora, de 0 a n-1. */
  step: number;
  /**
   * Cuánto se corrió de costado. Un tornado no va por una línea perfecta: cada tres celdas se mueve una,
   * y el recorrido queda torcido como el de uno de verdad.
   */
  off: number;
  /** El ancho en celdas, que decide el impuesto promedio de la ciudad. */
  width: number;
}

/**
 * El ancho del tornado según lo que la ciudad cobra, en celdas.
 *
 * Con los impuestos por el piso el tornado entra ancho y se lleva media ciudad; con los impuestos al tope
 * entra angosto y pasa por una línea. La idea —que el usuario pidió así— es que quien cobra para el pueblo
 * tiene con qué mirar el cielo, aunque los meteorólogos no existan como edificio: la ciudad que se paga
 * cara se entera y se prepara, y la que se paga barata se entera cuando ya pasó.
 */
export function tornadoWidthFor(taxes: ZoneTaxes): number {
  const t = Math.max(0, Math.min(1, averageTax(taxes) / MAX_TAX));
  const { wide, narrow } = DESASTRE.tornadoWidth;
  return Math.round(wide + (narrow - wide) * t);
}

/** Un tornado nuevo, entrando por un borde al azar. */
export function newTornado(n: number, width: number, rng: Rng): TornadoRun {
  const dir: 1 | -1 = rng.chance(0.5) ? 1 : -1;
  return { horizontal: rng.chance(0.5), fixed: rng.int(n), dir, step: 0, off: 0, width };
}

/** La celda del eje que el tornado pisa en este paso. */
export function tornadoHeadOf(run: TornadoRun, n: number): number {
  return run.dir > 0 ? run.step : n - 1 - run.step;
}

/** Las celdas que el tornado está pisando ahora: el ancho, alrededor de su cabeza. */
export function tornadoCellsOf(run: TornadoRun, n: number): [number, number][] {
  const head = tornadoHeadOf(run, n);
  const half = Math.floor(run.width / 2);
  const out: [number, number][] = [];
  for (let d = -half; d <= half; d++) {
    const across = run.fixed + run.off + d;
    if (across < 0 || across >= n) continue;
    out.push(run.horizontal ? [head, across] : [across, head]);
  }
  return out;
}

/**
 * Si el tornado puede pasar este mes. Mientras `DESASTRE.tornadoEnabled` siga en `false` la respuesta es
 * no, por más años que tenga la ciudad: el desastre está parado y no se puede disparar ni esperando.
 *
 * El `enabled` se puede pasar a mano para los tests y para cuando se vuelva a prender sin depender de una
 * constante que se lee en el import.
 */
export function tornadoAllowedAt(tick: number, enabled: boolean = DESASTRE.tornadoEnabled): boolean {
  if (!enabled) return false;
  return tick >= TICKS_PER_MONTH * DESASTRE.firstAt;
}

/** Un paso más: la cabeza avanza una celda y, cada tres, el recorrido se corre de costado. */
export function advanceTornado(run: TornadoRun, rng: Rng): void {
  run.step++;
  if (run.step % 3 === 0) run.off = Math.max(-2, Math.min(2, run.off + (rng.chance(0.5) ? 1 : -1)));
}

/** Ya salió por el otro lado. */
export function tornadoDone(run: TornadoRun, n: number): boolean {
  return run.step >= n;
}
