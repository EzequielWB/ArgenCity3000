import { describe, expect, it } from 'vitest';
import { paintPuente } from '../src/render/pixelArt';
import { UNIQUES } from '../src/config';

/**
 * El Puente Transbordador (2×6): dos torres de celosía sobre sus muros de piedra, la viga alta entre
 * ellas y la barca colgada sobre el agua. Lo que se prueba es que el acero esté cargado en las dos
 * puntas —las torres— y que igual cruce el medio —la viga—, que la barca cuelgue por encima del río y
 * que el río esté ahí. No se prueba que haya tinta gris.
 */

interface Art {
  px: { w: number; h: number; data: Uint8ClampedArray };
  ax: number;
  ay: number;
}

const isSteel = (r: number, g: number, b: number) => Math.abs(r - g) < 16 && Math.abs(g - b) < 18 && r > 80 && r < 200;
const isWater = (r: number, g: number, b: number) => b > r + 20 && g > r + 15 && b > 90;
const isRed = (r: number, g: number, b: number) => r > 120 && g < 95 && b < 90;

/** The pixels of a colour in a column band, with their count and the rows they touch. */
function band(a: Art, x0: number, x1: number, ok: (r: number, g: number, b: number) => boolean) {
  let n = 0;
  let first = a.px.h;
  let last = -1;
  let minX = a.px.w;
  let maxX = -1;
  for (let y = 0; y < a.px.h; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * a.px.w + x) * 4;
      if (!a.px.data[i + 3] || !ok(a.px.data[i], a.px.data[i + 1], a.px.data[i + 2])) continue;
      n++;
      first = Math.min(first, y);
      last = Math.max(last, y);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
  }
  return { n, first, last, minX, maxX };
}

const whole = (a: Art, ok: (r: number, g: number, b: number) => boolean) => band(a, 0, a.px.w, ok);

describe('el Puente Transbordador en píxel', () => {
  const a = paintPuente(UNIQUES.puente.w, UNIQUES.puente.h);
  const third = Math.floor(a.px.w / 3);

  it('el acero está cargado en las dos puntas: ahí están las torres', () => {
    const left = band(a, 0, third, isSteel).n;
    const middle = band(a, third, 2 * third, isSteel).n;
    const right = band(a, 2 * third, a.px.w, isSteel).n;
    // Una torre es una columna de acero de cuarenta y siete píxeles por cada pata; en el medio, en
    // cambio, sólo pasa la viga. Con las torres en el medio las dos puntas quedarían vacías.
    expect(left).toBeGreaterThan(middle * 1.6);
    expect(right).toBeGreaterThan(middle * 1.6);
  });

  it('la viga cruza el río de punta a punta', () => {
    // El tablero alto es una viga llena —no una celosía de alambre, que se lee como una escalera
    // colgada— y tiene que llegar de una torre a la otra: cientos de píxeles en el tramo del medio y un
    // ancho que cruza el lote entero.
    const middle = band(a, third, 2 * third, isSteel);
    expect(middle.n).toBeGreaterThan(150);
    const steel = whole(a, isSteel);
    expect(steel.maxX - steel.minX).toBeGreaterThan(90);
  });

  it('la barca cuelga sobre el agua y no está posada en el río', () => {
    const red = whole(a, isRed);
    const water = whole(a, isWater);
    // El hierro rojo de la barca se ve, en el tramo del medio, y por encima de la línea del agua: una
    // barca apoyada en el río es una barcaza, y no es lo que este puente hace.
    expect(red.n).toBeGreaterThan(25);
    expect(red.minX).toBeGreaterThan(third);
    expect(red.last).toBeLessThan(water.last - 6);
  });

  it('el río pasa por debajo, entre los dos muros de piedra', () => {
    const water = whole(a, isWater);
    expect(water.n).toBeGreaterThan(250);
    // Una franja de agua que cruza el lote, no dos charcos en las puntas.
    expect(water.maxX - water.minX).toBeGreaterThan(60);
  });

  it('se dibuja igual de grande en las dos orientaciones del lote', () => {
    const b = paintPuente(UNIQUES.puente.h, UNIQUES.puente.w);
    // El lote es el mismo rectángulo visto de dos maneras: el lienzo no cambia de tamaño.
    expect([b.px.w, b.px.h]).toEqual([a.px.w, a.px.h]);
    // Y el dibujo no es el mismo espejado sin más: el puente se pinta para cada orientación.
    expect(Array.from(b.px.data).join(',')).not.toBe(Array.from(a.px.data).join(','));
    const t = Math.floor(b.px.w / 3);
    const middle = band(b, t, 2 * t, isSteel).n;
    expect(band(b, 0, t, isSteel).n).toBeGreaterThan(middle * 1.4);
    expect(band(b, 2 * t, b.px.w, isSteel).n).toBeGreaterThan(middle * 1.4);
  });

  it('la simulación no se toca', () => {
    expect([UNIQUES.puente.cost, UNIQUES.puente.upkeep]).toEqual([14000, 300]);
    expect([UNIQUES.puente.w, UNIQUES.puente.h]).toEqual([2, 6]);
  });
});
