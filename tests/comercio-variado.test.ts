import { describe, expect, it } from 'vitest';
import { paintCommercial } from '../src/render/pixelArt';

/**
 * El nivel 5 del comercio: **cuatro locales**, no uno con cuatro colores. Lo que se prueba es lo que se ve
 * desde la vereda — la vidriera de piso a techo, la arcada, el ventanal de dos plantas y el cartel
 * parante de la nave baja —, medido en el dibujo y no contando tinta.
 *
 * Las variantes 0 a 3 son los cuatro modelos; de la 4 a la 7 se repiten con otra pared y otro cartel.
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

/** La tirada de vidrio más larga en una columna: es la altura del paño que da a la calle. */
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

interface Shape {
  height: number;
  width: number;
  /** La fila más alta con algo, por columna: la mediana dice dónde está el cuerpo del edificio. */
  medianTop: number;
  top: number;
  y0: number;
  y1: number;
}

function shape(a: ReturnType<typeof art>): Shape {
  const widths: number[] = [];
  const tops: number[] = [];
  let y0 = -1;
  let y1 = -1;
  for (let y = 0; y < a.px.h; y++) {
    let mn = a.px.w;
    let mx = -1;
    for (let x = 0; x < a.px.w; x++) {
      if (!at(a, x, y)) continue;
      mn = Math.min(mn, x);
      mx = Math.max(mx, x);
    }
    if (mx < 0) continue;
    if (y0 < 0) y0 = y;
    y1 = y;
    widths.push(mx - mn + 1);
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
    height: y1 - y0 + 1,
    width: Math.max(...widths),
    medianTop: tops[Math.floor(tops.length / 2)],
    top: tops[0],
    y0,
    y1,
  };
}

/**
 * La tirada vertical más larga en sombra. En la galería son los huecos entre los pilares: la arcada no se
 * reconoce por una fila de píxeles claros —la vidriera del modelo 0 también tiene reflejos y maniquíes y
 * da tramos claros— sino por el **hueco oscuro y alto** que queda debajo del pórtico. Un edificio sin
 * galería no tiene ningún hueco de esa altura: su planta baja es vidrio, que es claro.
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

  it('la vidriera: la planta baja entera de vidrio, de la vereda a la banda', () => {
    // El paño de la vidriera mide entre siete y diez píxeles de alto. Menos, es un ventanal; más, es el
    // ventanal de dos plantas del modelo 2, y entonces los dos modelos se leerían iguales.
    const glass = tallestGlass(art(0));
    expect(glass).toBeGreaterThanOrEqual(7);
    expect(glass).toBeLessThanOrEqual(10);
  });

  it('la arcada: el hueco del pórtico es alto y oscuro, y el local común no tiene ninguno', () => {
    // Diez píxeles de sombra seguidos en una columna son una galería; la vidriera del modelo 0 no pasa de
    // dos, porque el vidrio es claro y el hueco del pórtico no existe.
    expect(shadowRun(art(1))).toBeGreaterThanOrEqual(8);
    expect(shadowRun(art(0))).toBeLessThanOrEqual(4);
  });

  it('el ventanal: un paño de dos plantas, más alto que cualquier otro vidrio de la zona', () => {
    // El modelo moderno se reconoce por el vidrio que atraviesa dos pisos. Se compara contra el de la
    // vidriera común: si midieran lo mismo, el ventanal no sería una doble altura.
    const atrium = tallestGlass(art(2));
    expect(atrium).toBeGreaterThanOrEqual(14);
    expect(atrium).toBeGreaterThan(tallestGlass(art(0)) + 4);
  });

  it('la nave: la más baja y la más ancha, con el cartel en un mástil sobre el techo', () => {
    const shed = shape(art(3));
    for (const v of [0, 1, 2]) {
      expect(shed.height, `variant ${v}`).toBeLessThan(shape(art(v)).height);
      expect(shed.width, `variant ${v}`).toBeGreaterThan(shape(art(v)).width);
    }
    // El mástil: en alguna columna la punta del dibujo está muy por encima del cuerpo del edificio. Es el
    // cartel parante, lo único de la zona que se ve desde la otra cuadra.
    expect(shed.medianTop - shed.top).toBeGreaterThan(6);
    // Los otros tres no tienen nada así: su borde de arriba es la losa y es parejo.
    for (const v of [0, 1, 2]) expect(shape(art(v)).medianTop - shape(art(v)).top, `variant ${v}`).toBeLessThan(5);
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
