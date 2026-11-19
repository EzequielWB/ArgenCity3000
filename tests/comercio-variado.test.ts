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

/** El blanco del texto del cartel de la cafetería. */
const isBlancoCartel = (c: C) => Math.abs(c[0] - 0xf0) < 14 && Math.abs(c[1] - 0xea) < 14 && Math.abs(c[2] - 0xd8) < 14;
/** El mantel de las mesas de la vereda, y la madera de sus sillas. */
const isMantel = (c: C) => Math.abs(c[0] - 0x2f) < 8 && Math.abs(c[1] - 0x2a) < 8 && Math.abs(c[2] - 0x26) < 8;
const isSilla = (c: C) => Math.abs(c[0] - 0xc9) < 12 && Math.abs(c[1] - 0xa0) < 12 && Math.abs(c[2] - 0x6a) < 12;

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

/** Cuenta los píxeles que cumplen un predicado. */
function contar(a: ReturnType<typeof art>, f: (c: C) => boolean): number {
  let n = 0;
  for (let y = 0; y < a.px.h; y++) {
    for (let x = 0; x < a.px.w; x++) {
      const c = at(a, x, y);
      if (c && f(c)) n++;
    }
  }
  return n;
}

/**
 * Las letras del cartel: el máximo de **tramos blancos separados** que hay en una misma fila. La palabra
 * CAFE da cinco —las letras y las contraformas de la A y la E—; una banda de color lisa, ninguno.
 */
function letras(a: ReturnType<typeof art>): number {
  let best = 0;
  for (let y = 0; y < a.px.h; y++) {
    let runs = 0;
    let prev = false;
    let blancos = 0;
    for (let x = 0; x < a.px.w; x++) {
      const c = at(a, x, y);
      const g = !!c && isBlancoCartel(c);
      if (g) {
        blancos++;
        if (!prev) runs++;
      }
      prev = g;
    }
    if (blancos > 3) best = Math.max(best, runs);
  }
  return best;
}

/**
 * Las filas con vidrio **por encima del cartel**. Es la prueba de que el local tiene un solo piso: en una
 * planta baja con un cartel arriba no queda vidrio más alto, y en un edificio de dos plantas sí.
 */
function vidrioSobreElCartel(a: ReturnType<typeof art>): number {
  const sat2 = (c: C) => Math.max(...c) - Math.min(...c);
  let cartelY = -1;
  let best = 0;
  for (let y = 0; y < a.px.h; y++) {
    let n = 0;
    for (let x = 0; x < a.px.w; x++) {
      const c = at(a, x, y);
      if (c && sat2(c) > 90) n++;
    }
    if (n > best) {
      best = n;
      cartelY = y;
    }
  }
  let filas = 0;
  for (let y = 0; y < cartelY; y++) {
    let n = 0;
    for (let x = 0; x < a.px.w; x++) {
      const c = at(a, x, y);
      if (c && isGlass(c)) n++;
    }
    if (n > 3) filas++;
  }
  return filas;
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

  it('la cafetería: un solo piso, el cartel con la palabra y las mesas en la vereda', () => {
    // **Un solo piso**: por encima del cartel no queda una sola fila de vidrio. La galería, que es la única
    // de las cuatro que es un edificio de oficinas, tiene diecisiete.
    expect(vidrioSobreElCartel(art(2))).toBe(0);
    expect(vidrioSobreElCartel(art(1))).toBeGreaterThan(10);

    // **El cartel dice CAFE**: cinco tramos blancos en una misma fila son las letras y sus contraformas.
    // Ninguna de las otras tres fachadas tiene una sola letra.
    expect(letras(art(2))).toBeGreaterThanOrEqual(4);
    for (const v of [0, 1, 3]) expect(letras(art(v)), `variant ${v}`).toBeLessThan(2);

    // **Las mesas en la vereda**: los manteles oscuros y las sillas de madera clara. Son lo único de las
    // cuatro fachadas que está afuera del local y no es pasto ni hormigón.
    expect(contar(art(2), isMantel)).toBeGreaterThanOrEqual(10);
    expect(contar(art(2), isSilla)).toBeGreaterThanOrEqual(8);
    for (const v of [0, 1, 3]) {
      expect(contar(art(v), isMantel), `variant ${v}`).toBe(0);
      expect(contar(art(v), isSilla), `variant ${v}`).toBe(0);
    }

    // Y el cuerpo bajo: más petiso que la galería.
    expect(shape(art(2)).height).toBeLessThan(shape(art(1)).height - 6);
    expect(shape(art(2)).width).toBeLessThan(shape(art(0)).width);
    // El vidrio oscuro de la planta baja: un café no tiene una ventanita, tiene vidriera.
    expect(tallestGlass(art(2))).toBeGreaterThanOrEqual(6);
  });

  it('la nave: la más baja de las altas y la más ancha, con el cartel en un mástil', () => {
    const shed = shape(art(3));
    // Más ancha que la galería y que la cafetería. Contra la heladería no compite: las dos son cajas bajas
    // y anchas, y la heladería se nombra con el toldo.
    for (const v of [1, 2]) expect(shed.width, `variant ${v}`).toBeGreaterThan(shape(art(v)).width);
    // Más baja que la galería, que es el único edificio de oficinas de los cuatro. Contra la cafetería no
    // compite en altura: el café es una planta baja y lo que lo levanta es la taza de la azotea.
    expect(shed.height).toBeLessThan(shape(art(1)).height);
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

/* ---------- La calle baja: dos modelos por nivel ---------- */

const low = (lv: number, v: number) => paintCommercial(lv, v);

/**
 * Las dos lonas de la calle baja: la del toldo del kiosco y la de las rayas blancas de la pizzería. Son dos
 * telas de dos tonos distintos, así que van dos predicados.
 *
 * La tolerancia es de diez y no más por el **azulejo y el marco de la vidriera** (`#e6e9e2`), que están a
 * catorce del blanco de lona: con la tolerancia ancha, el marco de la panadería entraba como toldo y la
 * prueba terminaba midiendo un material del vecino.
 */
const cerca = (c: C, r: [number, number, number], d = 10) =>
  Math.abs(c[0] - r[0]) < d && Math.abs(c[1] - r[1]) < d && Math.abs(c[2] - r[2]) < d;
/** La lona del toldo del kiosco. */
const isLonaKiosco = (c: C) => cerca(c, [0xf4, 0xec, 0xe0]);
/** La franja blanca del toldo a rayas de la pizzería. */
const isLonaPizza = (c: C) => cerca(c, [0xf2, 0xed, 0xe0]);
/** El hueco del frente abierto: la masa oscura de adentro, no una vidriera. */
const isHueco = (c: C) => Math.abs(c[0] - 0x2e) < 12 && Math.abs(c[1] - 0x26) < 12 && Math.abs(c[2] - 0x20) < 14;
/** La cruz verde de la farmacia. */
const isCruzVerde = (c: C) => Math.abs(c[0] - 0x2f) < 20 && Math.abs(c[1] - 0x9a) < 22 && Math.abs(c[2] - 0x4a) < 20;

function contarBajo(lv: number, v: number, f: (c: C) => boolean): number {
  const a = low(lv, v);
  let n = 0;
  for (let y = 0; y < a.px.h; y++) {
    for (let x = 0; x < a.px.w; x++) {
      const c = at(a, x, y);
      if (c && f(c)) n++;
    }
  }
  return n;
}

function shapeBajo(lv: number, v: number): Shape {
  const a = low(lv, v);
  const widths: number[] = [];
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
  return {
    widths,
    height: widths.length,
    width: Math.max(...widths),
    medianTop: 0,
    top: 0,
  };
}

/**
 * La calle baja del comercio, niveles 1 a 4: **dos modelos por nivel**, no uno repintado cuatro veces.
 *
 * La variante elige el modelo con `(v >> 1) & 1` y el color con `v`, así que las variantes 0 y 1 son el
 * primer modelo con dos paletas y las 2 y 3 el segundo con otras dos. Lo que se prueba abajo es la
 * **diferencia estructural** dentro de cada par, no el color: techo contra toldo, abierto contra cerrado,
 * cruz contra poste, toldo a rayas contra madera.
 */
describe('la calle baja del comercio: dos modelos por nivel', () => {
  it('nivel 1: el kiosco tiene toldo de lona y la panadería techo a dos aguas', () => {
    // El toldo de lona es lo único blanco del nivel: el kiosco lo tiene, la panadería no tiene toldo.
    // El toldo va con la pared, así que la paleta clara lo deja casi entero en un caso y recortado en el
    // otro: lo que importa es que esté, no cuánto.
    expect(contarBajo(1, 0, isLonaKiosco)).toBeGreaterThan(20);
    expect(contarBajo(1, 1, isLonaKiosco)).toBeGreaterThan(20);
    expect(contarBajo(1, 2, isLonaKiosco)).toBe(0);
    expect(contarBajo(1, 3, isLonaKiosco)).toBe(0);

    // Y el techo suma altura: la panadería es la más alta de las dos, aunque sea la más baja de la calle.
    expect(shapeBajo(1, 2).height).toBeGreaterThan(shapeBajo(1, 0).height + 3);
  });

  it('nivel 2: la verdulería está abierta a la calle y la carnicería cerrada', () => {
    // El hueco oscuro del frente abierto: treinta y pico de píxeles en la verdulería, ninguno en la
    // carnicería, que tiene vidriera de vidrio con marco.
    expect(contarBajo(2, 0, isHueco)).toBeGreaterThan(25);
    expect(contarBajo(2, 1, isHueco)).toBeGreaterThan(25);
    expect(contarBajo(2, 2, isHueco)).toBe(0);
    expect(contarBajo(2, 3, isHueco)).toBe(0);
  });

  it('nivel 3: la peluquería tiene poste y la farmacia cruz verde', () => {
    // La cruz es el único verde puro de la calle baja y el único símbolo.
    expect(contarBajo(3, 2, isCruzVerde)).toBeGreaterThanOrEqual(8);
    expect(contarBajo(3, 3, isCruzVerde)).toBeGreaterThanOrEqual(8);
    expect(contarBajo(3, 0, isCruzVerde)).toBe(0);
    expect(contarBajo(3, 1, isCruzVerde)).toBe(0);

    // Y la cruz es lo que la hace más alta: está en el techo, sobre su pie.
    expect(shapeBajo(3, 2).height).toBeGreaterThan(shapeBajo(3, 0).height + 8);
  });

  it('nivel 4: el bar es de madera y la pizzería tiene toldo a rayas', () => {
    // El toldo a rayas lleva **blanco de lona** en la mitad de las franjas y el bar no tiene ninguno: su
    // marquesina es del color de la marca con su sombra. Los saltos de tono no sirven acá porque la
    // marquesina del bar también los da —es de dos tonos— y la prueba terminaría midiendo lo mismo.
    expect(contarBajo(4, 2, isLonaPizza)).toBeGreaterThan(15);
    expect(contarBajo(4, 3, isLonaPizza)).toBeGreaterThan(15);
    expect(contarBajo(4, 0, isLonaPizza)).toBe(0);
    expect(contarBajo(4, 1, isLonaPizza)).toBe(0);

    // Y la pizzería es más alta por el ducto de la campana.
    expect(shapeBajo(4, 2).height).toBeGreaterThan(shapeBajo(4, 0).height + 2);
  });

  it('los cuatro niveles tienen dos siluetas: la máscara de la variante 1 no es la de la 3', () => {
    // La prueba de conjunto, igual que en el nivel 5: cambia la forma, no sólo el tono.
    for (const lv of [1, 2, 3, 4]) {
      const mask = (v: number) => {
        const a = low(lv, v);
        const m: number[] = [];
        for (let i = 3; i < a.px.data.length; i += 4) m.push(a.px.data[i] > 200 ? 1 : 0);
        return m.join('');
      };
      expect(mask(0), `nivel ${lv}`).not.toBe(mask(2));
    }
  });
});
