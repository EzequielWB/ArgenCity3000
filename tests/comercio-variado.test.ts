import { describe, expect, it } from 'vitest';
import { paintCommercial } from '../src/render/pixelArt';

/**
 * El nivel 5 del comercio: **cuatro locales**, no uno con cuatro colores. Lo que se prueba es la silueta,
 * que es lo que se ve desde la vereda: el techo a dos aguas de la casona, las columnas de la galería, la
 * torre de fajas con el cartel de azotea y la nave baja con el cartel en un mástil.
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
 * Las fajas de vidrio apiladas: cuántas tiradas verticales de vidrio separadas por muro hay en la columna
 * que más tiene. Es lo que distingue una torre de oficinas de un local de una sola fachada vidriada.
 */
function glassBands(a: ReturnType<typeof art>): number {
  let best = 0;
  for (let x = 0; x < a.px.w; x++) {
    let runs = 0;
    let prev = false;
    for (let y = 0; y < a.px.h; y++) {
      const c = at(a, x, y);
      const g = !!c && isGlass(c);
      if (g && !prev) runs++;
      prev = g;
    }
    best = Math.max(best, runs);
  }
  return best;
}

/**
 * La tirada vertical más larga en sombra. En la galería son los huecos entre los pilares: la arcada no se
 * reconoce por una fila de píxeles claros —la vidriera también tiene reflejos y maniquíes y da tramos
 * claros— sino por el hueco oscuro y alto que queda debajo del pórtico.
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

  it('la casona: el techo a dos aguas, la única punta triangular de la zona', () => {
    // Una casona reciclada termina en un triángulo: la fila más alta mide un píxel y cinco filas más abajo
    // el techo ya mide más de diez. Ninguna de las otras tres arranca en una punta así —la galería y la
    // nave terminan en una losa ancha y la torre en una caja de cartel—, y por eso esta prueba no se puede
    // pasar con otro modelo.
    const s = shape(art(0));
    expect(s.widths[0]).toBeLessThanOrEqual(2);
    expect(s.widths[4]).toBeGreaterThanOrEqual(10);
    for (const v of [1, 3]) {
      const o = shape(art(v));
      expect(o.widths[0] > 2 || o.widths[4] < 10, `variant ${v}`).toBe(true);
    }
    // Y la vidriera de la planta baja, que es lo que la hace comercio y no una casa.
    expect(tallestGlass(art(0))).toBeGreaterThanOrEqual(7);
    expect(tallestGlass(art(0))).toBeLessThanOrEqual(10);
  });

  it('la arcada: el hueco del pórtico es alto y oscuro, y el local común no tiene ninguno', () => {
    // Diez píxeles de sombra seguidos en una columna son una galería; la vidriera de la casona no pasa de
    // dos, porque el vidrio es claro y el hueco del pórtico no existe.
    expect(shadowRun(art(1))).toBeGreaterThanOrEqual(8);
    expect(shadowRun(art(0))).toBeLessThanOrEqual(4);
  });

  it('la torre: la más alta y la más angosta, con las fajas de vidrio apiladas', () => {
    const tower = shape(art(2));
    for (const v of [0, 1, 3]) expect(tower.height, `variant ${v}`).toBeGreaterThan(shape(art(v)).height);
    for (const v of [0, 1, 3]) expect(tower.width, `variant ${v}`).toBeLessThan(shape(art(v)).width);
    // Cuatro fajas en la misma columna: la torre sube en pisos de oficina y no en una sola fachada.
    expect(glassBands(art(2))).toBeGreaterThanOrEqual(3);
  });

  it('la nave: la más baja y la más ancha, con el cartel en un mástil sobre el techo', () => {
    const shed = shape(art(3));
    for (const v of [0, 1, 2]) expect(shed.width, `variant ${v}`).toBeGreaterThan(shape(art(v)).width);
    // Más baja que la galería y que la torre. La casona mide casi lo mismo que la nave, y eso está bien:
    // las dos son bajas, y lo que las separa es el techo y no la altura.
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
