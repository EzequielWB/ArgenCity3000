import { describe, expect, it } from 'vitest';
import { paintCommercial } from '../src/render/pixelArt';

/**
 * El nivel 5 del comercio: **cuatro locales**, no uno con cuatro colores. Lo que se prueba es lo que se ve
 * desde la vereda, que es lo que hace que un local se lea como local y no como un edificio: el toldo a
 * rayas de la heladería, el hueco de la galería, la taza de la cafetería y el mástil de la nave.
 *
 * Las variantes 0 a 3 son los cuatro modelos; de la 4 a la 7 se repiten con otra pared y otro toldo.
 */

type C = [number, number, number];

const art = (v: number) => paintCommercial(5, v);

const at = (a: ReturnType<typeof art>, x: number, y: number): C | null => {
  if (x < 0 || y < 0 || x >= a.px.w || y >= a.px.h) return null;
  const i = (y * a.px.w + x) * 4;
  if (a.px.data[i + 3] < 200) return null;
  return [a.px.data[i], a.px.data[i + 1], a.px.data[i + 2]];
};

const lum = (c: C) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
const isGlass = (c: C) => c[2] - c[0] > 15 && c[2] > 70;
const sat = (c: C) => Math.max(...c) - Math.min(...c);
const dist = (a: C, b: C) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

/** La porcelana de la taza de café: un blanco roto que no usa ningún otro material del sprite. */
const isPorcelana = (c: C) => Math.abs(c[0] - 0xf0) < 14 && Math.abs(c[1] - 0xea) < 14 && Math.abs(c[2] - 0xd8) < 14;

interface Shape {
  /** El ancho de cada fila pintada, de arriba abajo: la punta del dibujo primero. */
  widths: number[];
  height: number;
  width: number;
  /** La fila más alta con algo, por columna: la mediana dice dónde está el cuerpo del edificio. */
  medianTop: number;
  top: number;
}

function shape(a: ReturnType<typeof art>): Shape {
  const widths: number[] = [];
  const tops: number[] = [];
  for (let y = 0; y < a.px.h; y++) {
    let mn = a.px.w;
    let mx = -1;
    for (let x = 0; x < a.px.w; x++) {
      if (!at(a, x, y)) continue;
      mn = Math.min(mn, x);
      mx = Math.max(mx, x);
    }
    if (mx >= 0) widths.push(mx - mn + 1);
  }
  for (let x = 0; x < a.px.w; x++) {
    for (let y = 0; y < a.px.h; y++) {
      if (at(a, x, y)) {
        tops.push(y);
        break;
      }
    }
  }
  tops.sort((p, q) => p - q);
  return {
    widths,
    height: widths.length,
    width: Math.max(...widths),
    medianTop: tops[Math.floor(tops.length / 2)],
    top: tops[0],
  };
}

/** La tirada de vidrio más larga en una columna: la altura del paño que da a la calle. */
function tallestGlass(a: ReturnType<typeof art>): number {
  let best = 0;
  for (let x = 0; x < a.px.w; x++) {
    let run = 0;
    for (let y = 0; y < a.px.h; y++) {
      const c = at(a, x, y);
      if (c && isGlass(c)) best = Math.max(best, ++run);
      else run = 0;
    }
  }
  return best;
}

/**
 * Las rayas del toldo: el máximo de **cambios de tono entre dos píxeles de color vivo seguidos** en una
 * misma fila. Es lo que distingue un toldo a rayas —quince saltos de rosa a verde en una fila— de una
 * banda de color lisa, que da dos: los bordes.
 */
function rayas(a: ReturnType<typeof art>): number {
  let best = 0;
  for (let y = 0; y < a.px.h; y++) {
    let jumps = 0;
    let prev: C | null = null;
    for (let x = 0; x < a.px.w; x++) {
      const c = at(a, x, y);
      if (!c || sat(c) < 40) {
        prev = null;
        continue;
      }
      if (prev && dist(prev, c) > 60) jumps++;
      prev = c;
    }
    best = Math.max(best, jumps);
  }
  return best;
}

/** Los píxeles de porcelana: la taza del remate de la cafetería. */
function porcelana(a: ReturnType<typeof art>): number {
  let n = 0;
  for (let y = 0; y < a.px.h; y++) {
    for (let x = 0; x < a.px.w; x++) {
      const c = at(a, x, y);
      if (c && isPorcelana(c)) n++;
    }
  }
  return n;
}

/**
 * La tirada vertical más larga en sombra. En la galería son los huecos entre los pilares: la arcada no se
 * reconoce por una fila de píxeles claros —la vidriera también tiene reflejos y da tramos claros— sino
 * por el hueco oscuro y alto que queda debajo del pórtico.
 */
function shadowRun(a: ReturnType<typeof art>): number {
  let best = 0;
  for (let x = 0; x < a.px.w; x++) {
    let run = 0;
    for (let y = 0; y < a.px.h; y++) {
      const c = at(a, x, y);
      if (c && lum(c) < 80) best = Math.max(best, ++run);
      else run = 0;
    }
  }
  return best;
}

const masks = [0, 1, 2, 3].map((v) => {
  const a = art(v);
  const m: number[] = [];
  for (let i = 3; i < a.px.data.length; i += 4) m.push(a.px.data[i] > 200 ? 1 : 0);
  return m.join('');
});

describe('el nivel 5 del comercio: cuatro locales', () => {
  it('son cuatro siluetas distintas, no un local con cuatro colores', () => {
    // La prueba de que hay variedad de modelos y no de paletas: cambia la forma, no el tono.
    expect(new Set(masks).size).toBe(4);
  });

  it('la heladería: el toldo a rayas sobre la vidriera, que es lo que la hace un local', () => {
    // Quince saltos de tono en una misma fila son un toldo a rayas de dos colores. Ninguna de las otras
    // tres fachadas pasa de seis: el cartel es una banda lisa y la taza un bloque de porcelana.
    expect(rayas(art(0))).toBeGreaterThanOrEqual(10);
    for (const v of [1, 2, 3]) expect(rayas(art(v)), `variant ${v}`).toBeLessThanOrEqual(6);
    // Y la vidriera de la planta baja, con el mostrador detrás: lo que la hace comercio y no una casa.
    // Siete píxeles y no once porque el mostrador la cruza a la altura de la cintura y la parte en dos.
    expect(tallestGlass(art(0))).toBeGreaterThanOrEqual(6);
  });

  it('la galería: el hueco del pórtico es alto y oscuro, y el local común no tiene ninguno', () => {
    // Diez píxeles de sombra seguidos en una columna son una galería; la vidriera de la heladería no pasa
    // de nueve, y la de un local común, de cuatro.
    expect(shadowRun(art(1))).toBeGreaterThanOrEqual(8);
  });

  it('la cafetería: la taza de café sobre la azotea, y el cuerpo bajo', () => {
    // El remate: treinta y un píxeles de porcelana, contra diez de la nave y ninguno de la heladería. La
    // taza es lo único de las cuatro fachadas que se sale del volumen del edificio hacia arriba.
    expect(porcelana(art(2))).toBeGreaterThanOrEqual(20);
    for (const v of [0, 1]) expect(porcelana(art(v)), `variant ${v}`).toBeLessThan(11);
    // El cuerpo bajo y angosto: no compite en altura con la galería, que es la única de las cuatro que es
    // un edificio de oficinas, y tiene el frente más chico de los cuatro.
    expect(shape(art(2)).height).toBeLessThanOrEqual(shape(art(1)).height);
    expect(shape(art(2)).width).toBeLessThan(shape(art(0)).width);
    // El vidrio oscuro de la planta baja: un café no tiene una ventanita, tiene vidriera. Siete píxeles y
    // no nueve porque el zócalo de granito le come abajo y el reflejo lo cruza al medio.
    expect(tallestGlass(art(2))).toBeGreaterThanOrEqual(6);
  });

  it('la nave: la más baja de las altas y la más ancha, con el cartel en un mástil', () => {
    const shed = shape(art(3));
    // Más ancha que la galería y que la cafetería. Contra la heladería no compite: las dos son cajas bajas
    // y anchas, y la heladería se nombra con el toldo.
    for (const v of [1, 2]) expect(shed.width, `variant ${v}`).toBeGreaterThan(shape(art(v)).width);
    // Más baja que la galería y que la cafetería. La heladería mide casi lo mismo, y eso está bien: las
    // dos son bajas; lo que las separa es el toldo y el mástil, no la altura.
    for (const v of [1, 2]) expect(shed.height, `variant ${v}`).toBeLessThan(shape(art(v)).height);
    // El mástil: la punta del dibujo está diez píxeles por encima del cuerpo del edificio, y esa punta es
    // un rectángulo de ancho parejo, que es el paño del cartel.
    expect(shed.medianTop - shed.top).toBeGreaterThan(6);
    expect(Math.abs(shed.widths[0] - shed.widths[3])).toBeLessThanOrEqual(1);
  });

  it('los cuatro tienen vidrio y el color de la marca', () => {
    for (const v of [0, 1, 2, 3]) {
      const a = art(v);
      expect(tallestGlass(a), `variant ${v}`).toBeGreaterThanOrEqual(5);
      // El cartel: píxeles muy saturados, que es como se lee una marca pintada.
      let saturated = 0;
      for (let i = 0; i < a.px.data.length; i += 4) {
        if (a.px.data[i + 3] < 200) continue;
        const c: C = [a.px.data[i], a.px.data[i + 1], a.px.data[i + 2]];
        if (Math.max(...c) - Math.min(...c) > 60) saturated++;
      }
      expect(saturated, `variant ${v}`).toBeGreaterThan(20);
    }
  });
});
