import { describe, expect, it } from 'vitest';
import { paintPlanetario } from '../src/render/pixelArt';
import { UNIQUES } from '../src/config';

/**
 * El Planetario (3×3): el tambor blanco, la cúpula, la galería que la rodea y el parque. Lo que se
 * prueba es que **la cúpula sea una cúpula** —redonda, más ancha que alta y con la fila más ancha abajo,
 * que es lo que la distingue de una caja o de un casquete— y que el tambor sea más ancho que la cúpula.
 */

interface Art {
  px: { w: number; h: number; data: Uint8ClampedArray };
  ax: number;
  ay: number;
}

const at = (a: Art, x: number, y: number): [number, number, number] | null => {
  if (x < 0 || y < 0 || x >= a.px.w || y >= a.px.h) return null;
  const i = (y * a.px.w + x) * 4;
  if (!a.px.data[i + 3]) return null;
  return [a.px.data[i], a.px.data[i + 1], a.px.data[i + 2]];
};

/** La chapa de la cúpula: un gris azulado claro, más oscuro que la cal del tambor. */
const isDome = (r: number, g: number, b: number) => b > r + 12 && b > 140 && g > r && r > 140;
/** La cal del tambor: blanco cálido, con el azul por debajo del rojo. */
const isDrum = (r: number, g: number, b: number) => r > 210 && g > 200 && b > 175 && b <= r;
/** La galería: el hierro oscuro, azulado. */
const isGallery = (r: number, _g: number, b: number) => b > r + 8 && r < 135;
const isPark = (r: number, g: number, b: number) => g > r + 18 && g > b + 25 && g > 80;
/** El tronco: madera oscura. La copa no sirve para contarlos, es casi el mismo verde que el pasto. */
const isTrunk = (r: number, g: number, b: number) => r > 55 && r < 145 && r > g + 16 && g > b + 8;

function count(a: Art, ok: (r: number, g: number, b: number) => boolean) {
  let n = 0;
  let minX = a.px.w;
  let maxX = -1;
  let minY = a.px.h;
  let maxY = -1;
  for (let y = 0; y < a.px.h; y++) {
    for (let x = 0; x < a.px.w; x++) {
      const c = at(a, x, y);
      if (!c || !ok(c[0], c[1], c[2])) continue;
      n++;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  return { n, minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** The width of the painted pixels of a colour in each row, top to bottom. */
function widths(a: Art, ok: (r: number, g: number, b: number) => boolean, y0: number, y1: number): [number, number][] {
  const out: [number, number][] = [];
  for (let y = y0; y <= y1; y++) {
    let f = -1;
    let l = -1;
    for (let x = 0; x < a.px.w; x++) {
      const c = at(a, x, y);
      if (!c || !ok(c[0], c[1], c[2])) continue;
      if (f < 0) f = x;
      l = x;
    }
    if (f >= 0) out.push([y, l - f + 1]);
  }
  return out;
}

describe('el Planetario en píxel', () => {
  const a = paintPlanetario(UNIQUES.planetario.w, UNIQUES.planetario.h);
  const dome = count(a, isDome);
  const drum = count(a, isDrum);

  it('la cúpula es una cúpula: más ancha que alta y con la fila más ancha abajo', () => {
    expect(dome.n).toBeGreaterThan(150);
    expect(dome.w).toBeGreaterThan(dome.h);
    // Redonda de verdad: la fila más ancha es la de abajo, y la de arriba es angosta. Un casquete chato
    // o una caja con el borde redondeado no cumplen las dos.
    const filas = widths(a, isDome, dome.minY, dome.maxY);
    expect(filas.length).toBeGreaterThan(5);
    const masAncha = filas.reduce((b, f) => (f[1] > b[1] ? f : b), filas[0]);
    expect(masAncha[0]).toBeGreaterThanOrEqual(dome.maxY - 3);
    expect(filas[0][1]).toBeLessThan(masAncha[1] * 0.55);
  });

  it('el tambor es más ancho que la cúpula, y blanco', () => {
    expect(drum.n).toBeGreaterThan(300);
    expect(drum.w).toBeGreaterThan(dome.w);
    // El tambor baja hasta el parque: su altura es mayor que la de la cúpula.
    expect(drum.h).toBeGreaterThan(dome.h);
  });

  it('la galería da la vuelta a la base de la cúpula', () => {
    // El anillo oscuro es **más ancho** que la cúpula y está a la altura de su base: es el balcón que
    // vuela, y sin él la cúpula se apoya en el tambor sin apoyo.
    const ring = count(a, isGallery);
    expect(ring.n).toBeGreaterThan(40);
    expect(ring.w).toBeGreaterThan(dome.w);
    expect(Math.abs(ring.maxY - dome.maxY)).toBeLessThan(6);
  });

  it('la cúpula está centrada sobre el tambor, no al lado', () => {
    // La cúpula entra entera dentro del ancho del tambor y los dos centros coinciden. Al lado o corrida
    // sería otra cosa; el tambor de abajo es el que la sostiene.
    expect(dome.minX).toBeGreaterThan(drum.minX);
    expect(dome.maxX).toBeLessThan(drum.maxX);
    const centro = (b: { minX: number; maxX: number }) => (b.minX + b.maxX) / 2;
    expect(Math.abs(centro(dome) - centro(drum))).toBeLessThan(2.5);
  });

  it('el parque lo rodea y tiene sus árboles', () => {
    // Un piso holgado: el tambor es ancho y come parque, pero el parque es todo el lote alrededor.
    expect(count(a, isPark).n).toBeGreaterThan(1000);
    // Los árboles, fuera del edificio: se cuentan los troncos, que es lo único que no se confunde con el
    // pasto —la copa del árbol y el parque son casi el mismo verde—.
    let troncos = 0;
    for (let y = 0; y < a.px.h; y++) {
      for (let x = 0; x < a.px.w; x++) {
        const c = at(a, x, y);
        if (!c || !isTrunk(c[0], c[1], c[2])) continue;
        if (x < drum.minX - 2 || x > drum.maxX + 2) troncos++;
      }
    }
    expect(troncos).toBeGreaterThan(6);
  });

  it('la simulación no se toca', () => {
    expect([UNIQUES.planetario.cost, UNIQUES.planetario.upkeep]).toEqual([14000, 320]);
    expect([UNIQUES.planetario.w, UNIQUES.planetario.h]).toEqual([3, 3]);
  });
});
