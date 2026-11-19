import { describe, expect, it } from 'vitest';
import { paintCalvario } from '../src/render/pixelArt';
import { UNIQUES, UNIQUE_RULES } from '../src/config';

/**
 * El Calvario, el único edificio que pinta su propio terreno. Desde que es el Calvario de Tandil lo que
 * manda es **el eje**: una escalinata recta que sube el cerro y una cruz alta al final del camino. La
 * versión anterior era una loma redonda con la escalinata en zigzag y las cruces de costado, y a un píxel
 * eso se leía como una loma con un palo.
 *
 * Se dibuja en las dos orientaciones del lote —3×6 y 6×3—, así que lo que se prueba es que en las dos
 * esté el camino, que suba y que la cruz lo remate.
 */

interface Art {
  px: { w: number; h: number; data: Uint8ClampedArray };
  ax: number;
  ay: number;
}

const SHADOW_ALPHA = 96;

const pixel = (a: Art, x: number, y: number) => {
  const i = (y * a.px.w + x) * 4;
  return [a.px.data[i], a.px.data[i + 1], a.px.data[i + 2]] as [number, number, number];
};
const alpha = (a: Art, x: number, y: number) => a.px.data[(y * a.px.w + x) * 4 + 3];

/** Topmost row that has any paint. */
function topRow(a: Art): number {
  for (let y = 0; y < a.px.h; y++) for (let x = 0; x < a.px.w; x++) if (alpha(a, x, y)) return y;
  return a.px.h;
}

/** Las columnas que tienen pintura en la franja de arriba del dibujo: el remate del monumento. */
function topColumns(a: Art, rows: number): [number, number] {
  const top = topRow(a);
  let mn = a.px.w;
  let mx = -1;
  for (let y = top; y < top + rows; y++) {
    for (let x = 0; x < a.px.w; x++) {
      if (!alpha(a, x, y)) continue;
      mn = Math.min(mn, x);
      mx = Math.max(mx, x);
    }
  }
  return [mn, mx];
}

const rises = (a: Art) => a.ay - topRow(a);

const drawing = (a: Art) => Array.from(a.px.data).join(',');

/** How many pixels the drawing has that satisfy a test on their colour, between two rows. */
function countish(a: Art, ok: (r: number, g: number, b: number) => boolean, minY = 0, maxY = Infinity): number {
  let n = 0;
  for (let i = 0; i < a.px.data.length; i += 4) {
    if (!a.px.data[i + 3]) continue;
    const row = Math.floor(i / 4 / a.px.w);
    if (row < minY || row >= maxY) continue;
    if (ok(a.px.data[i], a.px.data[i + 1], a.px.data[i + 2])) n++;
  }
  return n;
}

/** Green: the hill and the wood, which is most of the drawing. */
const green = (r: number, g: number, b: number) => g > r + 14 && g > b + 14;
/** El verde oscuro del ciprés: más oscuro que cualquier pasto del cerro. */
const cypressGreen = (r: number, g: number, b: number) => g > r + 10 && g < 110 && b < g;

/**
 * La piedra del camino. Es **lo más claro del lote** y ahora lo único blanco: la escalinata y el atrio van
 * en `PATH` (`#efe9d9`) y el cerro en verde, que es el contraste que hace que el corredor se lea desde
 * lejos, como en la foto del cerro de verdad.
 */
const path = (r: number, g: number, b: number) => r > 215 && g > 210 && b > 190 && r - b > 12 && r - b < 40;
/** La contrahuella del peldaño: la misma piedra, en sombra. */
const stepShade = (r: number, g: number, b: number) => r > 150 && r < 215 && g > 145 && g < 205 && b > 130 && b < 195 && r - b > 10;

const BOTH: [string, number, number][] = [
  ['3×6', 3, 6],
  ['6×3', 6, 3],
];

describe('el Calvario en píxel', () => {
  it('es píxel duro, y la única transparencia es la sombra', () => {
    for (const [, vw, vh] of BOTH) {
      const a = paintCalvario(vw, vh);
      for (let i = 3; i < a.px.data.length; i += 4) {
        if (a.px.data[i] > 0 && a.px.data[i] < 255) expect(a.px.data[i]).toBeLessThanOrEqual(SHADOW_ALPHA);
      }
    }
  });

  it('se dibuja igual de grande en las dos orientaciones del lote', () => {
    const a = paintCalvario(3, 6);
    const b = paintCalvario(6, 3);
    // El lote es el mismo rectángulo visto de dos maneras: el lienzo no cambia de tamaño. El ancla sí se
    // mueve, porque cuelga del lado corto, y esa diferencia es justo la que coloca el sprite en su celda.
    expect([b.px.w, b.px.h]).toEqual([a.px.w, a.px.h]);
    expect(b.ax).toBe(a.ax - 16 * (6 - 3));
    expect(b.ay).toBe(a.ay);
    // Y el dibujo no es el mismo espejado sin más: la loma se pinta para cada orientación.
    expect(drawing(a)).not.toBe(drawing(b));
    // La loma más la cruz levantan el dibujo sobre la esquina del lote. La cruz sola mide veinticuatro
    // píxeles, así que el remate tiene que pasar de veinte por encima del ancla.
    expect(rises(a)).toBeGreaterThan(20);
    expect(rises(b)).toBeGreaterThan(20);
  });

  it('el cerro es verde y el camino de piedra, no una mancha gris', () => {
    const a = paintCalvario(3, 6);
    // La loma y el monte son el grueso del dibujo.
    expect(countish(a, green)).toBeGreaterThan(2500);
    // Los cipreses son el verde más oscuro del lote y están repartidos a los dos lados del camino.
    expect(countish(a, cypressGreen)).toBeGreaterThan(120);
    // Y la piedra del camino, que es el material que nombra al monumento, es una parte chica y clara.
    const pathPixels = countish(a, path);
    expect(pathPixels).toBeGreaterThan(400);
    expect(pathPixels).toBeLessThan(countish(a, green));
  });

  it('la escalinata sube de punta a punta, con peldaños y no con una rampa', () => {
    const a = paintCalvario(3, 6);
    // El camino aparece en filas de toda la altura del cerro: desde el pie hasta el atrio.
    const rows: number[] = [];
    for (let y = 0; y < a.px.h; y++) if (countish(a, path, y, y + 1) > 0) rows.push(y);
    expect(rows.length).toBeGreaterThan(24);
    expect(rows[rows.length - 1] - rows[0]).toBeGreaterThan(40);
    // Y los peldaños: sin la contrahuella en sombra el camino es una cinta lisa. Hay que encontrar muchas
    // filas donde el camino se corta en claro-oscuro-claro, no dos.
    let bandas = 0;
    for (let y = 1; y + 1 < a.px.h; y++) {
      if (countish(a, path, y - 1, y) > 2 && countish(a, stepShade, y, y + 1) > 2 && countish(a, path, y + 1, y + 2) > 2) bandas++;
    }
    expect(bandas).toBeGreaterThan(12);
  });

  it('la cruz está en el atrio y el atrio es lo más ancho del camino', () => {
    const a = paintCalvario(3, 6);
    // La fila con más piedra clara es la explanada del atrio: es la única parte del camino que se abre.
    let bestRow = 0;
    let best = 0;
    for (let y = 0; y < a.px.h; y++) {
      const n = countish(a, path, y, y + 1);
      if (n > best) {
        best = n;
        bestRow = y;
      }
    }
    expect(best).toBeGreaterThan(14);
    // Y la cruz se para encima: el remate del dibujo cae dentro del ancho de esa explanada. Con la cruz en
    // el medio del cerro, el píxel más alto quedaba fuera y el remate parecía apoyado en la ladera.
    const [tmn, tmx] = topColumns(a, 6);
    let amn = a.px.w;
    let amx = -1;
    for (let y = bestRow - 3; y <= bestRow + 1; y++) {
      for (let x = 0; x < a.px.w; x++) {
        if (!alpha(a, x, y)) continue;
        const [r, g, b] = pixel(a, x, y);
        if (!path(r, g, b) && !stepShade(r, g, b)) continue;
        amn = Math.min(amn, x);
        amx = Math.max(amx, x);
      }
    }
    expect(amn).toBeLessThanOrEqual(tmn + 2);
    expect(amx).toBeGreaterThanOrEqual(tmx - 2);
  });

  it('las estaciones del Vía Crucis están a los costados del camino', () => {
    const a = paintCalvario(3, 6);
    // Los nichos son el único blanco puro del lote, y van de a pares, uno por lado.
    const nichos = countish(a, (r, g, b) => r > 230 && g > 228 && b > 220);
    expect(nichos).toBeGreaterThan(20);
    let left = 0;
    let right = 0;
    for (let y = 0; y < a.px.h; y++) {
      for (let x = 0; x < a.px.w; x++) {
        if (!alpha(a, x, y)) continue;
        const [r, g, b] = pixel(a, x, y);
        if (!(r > 230 && g > 228 && b > 220)) continue;
        if (x < a.px.w / 2) left++;
        else right++;
      }
    }
    expect(left).toBeGreaterThan(4);
    expect(right).toBeGreaterThan(4);
  });

  it('la simulación del Calvario no cambia', () => {
    // El pase es de arte: el costo, el mantenimiento, el turismo y la regla de altura siguen igual.
    const u = UNIQUES.calvario;
    expect([u.w, u.h]).toEqual([3, 6]);
    expect([u.cost, u.upkeep]).toEqual([12000, 220]);
    expect([u.boost, u.peak]).toEqual([0.02, 0.18]);
    expect(u.peakMonths).toEqual([9]);
    expect(UNIQUE_RULES.calvario.margin).toBe(4);
  });
});
