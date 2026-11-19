import { describe, expect, it } from 'vitest';
import { paintPuente } from '../src/render/pixelArt';
import { UNIQUES } from '../src/config';

/**
 * El Puente Transbordador Nicolás Avellaneda (2×6): dos torres de celosía sobre sus pilas de piedra y
 * la viga alta entre ellas. Lo que se prueba es que las torres sean las únicas columnas que suben y
 * bajan, que la viga cruce el tramo sin un hueco y que pase por encima del agua.
 *
 * **No se prueba que haya tinta gris.** El acero es un gris frío y la piedra de las pilas un gris
 * cálido: con un predicado flojo la piedra entraba como acero y media docena de estas pruebas pasaban
 * contando mampostería. Por eso acá el acero pide el azul por encima del rojo.
 */

interface Art {
  px: { w: number; h: number; data: Uint8ClampedArray };
  ax: number;
  ay: number;
}

const isSteel = (r: number, g: number, b: number) => b > r + 8 && b > g && r > 70 && r < 200;
const isWater = (r: number, g: number, b: number) => b > r + 20 && g > r + 15 && b > 90;
const isRed = (r: number, g: number, b: number) => r > 120 && g < 95 && b < 90;

const hit = (a: Art, x: number, y: number, ok: (r: number, g: number, b: number) => boolean) => {
  const i = (y * a.px.w + x) * 4;
  return a.px.data[i + 3] > 0 && ok(a.px.data[i], a.px.data[i + 1], a.px.data[i + 2]);
};

/** The pixels of a colour in a column band, with their count and the rows they touch. */
function band(a: Art, x0: number, x1: number, ok: (r: number, g: number, b: number) => boolean) {
  let n = 0;
  let first = a.px.h;
  let last = -1;
  let minX = a.px.w;
  let maxX = -1;
  for (let y = 0; y < a.px.h; y++) {
    for (let x = x0; x < x1; x++) {
      if (!hit(a, x, y, ok)) continue;
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

/** The columns with steel, and how tall a run of steel each one has. */
function columns(a: Art, ok: (r: number, g: number, b: number) => boolean) {
  const cols: { x: number; top: number; bottom: number; n: number }[] = [];
  for (let x = 0; x < a.px.w; x++) {
    let top = -1;
    let bottom = -1;
    let n = 0;
    for (let y = 0; y < a.px.h; y++) {
      if (!hit(a, x, y, ok)) continue;
      if (top < 0) top = y;
      bottom = y;
      n++;
    }
    if (top >= 0) cols.push({ x, top, bottom, n });
  }
  return cols;
}

/** The runs of columns that satisfy a test, as [first, last] pairs. */
function clusters<T extends { x: number }>(items: T[], keep: (c: T) => boolean): [number, number][] {
  const out: [number, number][] = [];
  let last = -2;
  for (const c of items) {
    if (!keep(c)) continue;
    if (c.x === last + 1) out[out.length - 1][1] = c.x;
    else out.push([c.x, c.x]);
    last = c.x;
  }
  return out;
}

describe('el Puente Transbordador en píxel', () => {
  const a = paintPuente(UNIQUES.puente.w, UNIQUES.puente.h);
  const cols = columns(a, isSteel);
  /** Una columna alta es una pata de torre: la viga cruza, no baja. */
  const legs = (c: { top: number; bottom: number }) => c.bottom - c.top >= 30;

  it('las torres son las únicas columnas que suben y bajan', () => {
    // Dos torres separadas: cada una es un portal de dos patas, y entre las dos la viga cruza sin bajar
    // al agua. Si las torres estuvieran en el medio, la viga no tendría de dónde colgar.
    const towers = clusters(cols, legs);
    expect(towers.length).toBe(2);
    expect(towers[1][0] - towers[0][1]).toBeGreaterThan(40);
    // Y cada torre tiene un ancho de portal, no de poste.
    for (const [x0, x1] of towers) expect(x1 - x0).toBeGreaterThan(12);
  });

  it('la viga cruza el tramo entero, sin un hueco', () => {
    // El tablero alto es una viga llena —no una celosía de alambre, que se lee como una escalera
    // colgada— y tiene que llegar de una torre a la otra: acero en todas las columnas del medio y un
    // ancho que cruza el lote entero.
    const steel = whole(a, isSteel);
    expect(steel.maxX - steel.minX).toBeGreaterThan(90);
    expect(cols.length).toBe(steel.maxX - steel.minX + 1);
    // Canto de viga, no de alambre: en el tramo limpio cada columna lleva varios píxeles de acero.
    const span = cols.filter((c) => !legs(c));
    expect(span.length).toBeGreaterThan(40);
    // Canto de viga: casi todas las columnas del tramo llevan varios píxeles de acero apilados. En las
    // dos puntas la viga se angosta contra la torre, y ahí alcanza con que el acero siga estando.
    const solid = span.filter((c) => c.n >= 5).length;
    expect(solid / span.length).toBeGreaterThan(0.85);
  });

  it('la viga pasa por encima del agua', () => {
    // El tramo del medio: el acero más bajo queda por arriba de la línea del agua. Un puente apoyado en
    // el río es un puente bajo, y este cruza.
    const middle = band(a, 52, 76, isSteel);
    const water = band(a, 52, 76, isWater);
    expect(middle.n).toBeGreaterThan(150);
    expect(middle.last).toBeLessThan(water.first);
  });

  it('el río pasa por debajo, entre las dos pilas', () => {
    const water = whole(a, isWater);
    expect(water.n).toBeGreaterThan(250);
    // Una franja de agua que cruza el lote, no dos charcos en las puntas.
    expect(water.maxX - water.minX).toBeGreaterThan(60);
  });

  it('la barca roja y blanca se fue: queda la forma del puente', () => {
    // El pedido fue explícito: *"no hace falta que tenga esa cosa roja y blanca en el medio, con que
    // tenga la forma del puente estamos"*. Se mide que no vuelva.
    expect(whole(a, isRed).n).toBe(0);
  });

  it('se dibuja igual de grande en las dos orientaciones del lote', () => {
    const b = paintPuente(UNIQUES.puente.h, UNIQUES.puente.w);
    // El lote es el mismo rectángulo visto de dos maneras: el lienzo no cambia de tamaño.
    expect([b.px.w, b.px.h]).toEqual([a.px.w, a.px.h]);
    // Y el dibujo no es el mismo espejado sin más: el puente se pinta para cada orientación.
    expect(Array.from(b.px.data).join(',')).not.toBe(Array.from(a.px.data).join(','));
    // Las dos torres están en las dos orientaciones.
    expect(clusters(columns(b, isSteel), legs).length).toBe(2);
  });

  it('la simulación no se toca', () => {
    expect([UNIQUES.puente.cost, UNIQUES.puente.upkeep]).toEqual([14000, 300]);
    expect([UNIQUES.puente.w, UNIQUES.puente.h]).toEqual([2, 6]);
  });
});
