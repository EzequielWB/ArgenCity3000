import { describe, expect, it } from 'vitest';
import { paintPlanetario } from '../src/render/pixelArt';
import { UNIQUES } from '../src/config';

/**
 * El Planetario (3×3): el basamento de piedra, el **anillo de vidrio** con su carpintería, la galería, el
 * casquete y la linterna, en medio del parque. Lo que se prueba es la estructura: que la cúpula sea una
 * cúpula —redonda, más ancha que alta, con la fila más ancha abajo—, que el vidrio esté **entre** el
 * basamento y la cúpula, y que los parantes sean varios y verticales. No se prueba que haya tinta.
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

/** El casquete de chapa: un azul claro y pálido, más oscuro que la cal del basamento. */
const isDome = (r: number, g: number, b: number) => b > r + 12 && b > 150 && r > 150 && g > r;
/** El vidrio del anillo: azul hondo, mucho más oscuro que el casquete. */
const isGlass = (r: number, _g: number, b: number) => b > r + 25 && r < 140;
/** La carpintería: hierro claro, casi blanco. */
const isMullion = (r: number, g: number, b: number) => r > 225 && g > 218 && b > 200;
/** La galería: el hierro oscuro, azulado, y **no** el vidrio, que también es azul. */
const isGallery = (r: number, _g: number, b: number) => b > r + 8 && r < 135 && b < 130;
/** La cal del basamento: blanco cálido, con el azul por debajo del rojo. */
const isBase = (r: number, g: number, b: number) => r > 210 && g > 200 && b > 175 && b <= r;
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

const a = paintPlanetario(3, 3);
const dome = count(a, isDome);

describe('el Planetario en píxel', () => {
  it('la cúpula es una cúpula: más ancha que alta y con la fila más ancha abajo', () => {
    expect(dome.n).toBeGreaterThan(150);
    expect(dome.w).toBeGreaterThan(dome.h);
    // Una cúpula se reconoce por el perfil: arranca ancha en la base y se cierra en la punta. Un casquete
    // chato o una caja con el borde redondeado no cumplen las dos.
    const filas = widths(a, isDome, dome.minY, dome.maxY);
    expect(filas.length).toBeGreaterThan(5);
    const masAncha = filas.reduce((b, f) => (f[1] > b[1] ? f : b), filas[0]);
    expect(masAncha[0]).toBeGreaterThanOrEqual(dome.maxY - 3);
    expect(filas[0][1]).toBeLessThan(masAncha[1] * 0.55);
  });

  it('el anillo de vidrio está entre el basamento y la cúpula', () => {
    // La estructura circular de vidrio es lo que identifica al Planetario: el vidrio va **arriba del
    // basamento y abajo de la cúpula**, no al lado ni pegado al pasto.
    const glass = count(a, isGlass);
    const base = count(a, isBase);
    expect(glass.n).toBeGreaterThan(250);
    expect(glass.maxY).toBeLessThan(base.maxY);
    expect(glass.maxY).toBeGreaterThan(dome.maxY - 2);
    expect(glass.minY).toBeGreaterThan(dome.minY);
    expect(Math.abs(glass.w - dome.w)).toBeLessThan(5);
  });

  it('el anillo tiene carpintería: parantes verticales, varios', () => {
    // Sin parantes el anillo es un tambor pintado de azul. Se cuentan **columnas** con hierro claro y no
    // píxeles: lo que hace la estructura es la cantidad de parantes, no el área pintada.
    const glass = count(a, isGlass);
    const cols = new Set<number>();
    for (let x = glass.minX; x <= glass.maxX; x++) {
      let n = 0;
      for (let y = glass.minY; y <= glass.maxY; y++) {
        const c = at(a, x, y);
        if (c && isMullion(c[0], c[1], c[2])) n++;
      }
      if (n > 3) cols.add(x);
    }
    expect(cols.size).toBeGreaterThan(4);
  });

  it('la galería da la vuelta a la base de la cúpula', () => {
    // El anillo oscuro es **más ancho** que la cúpula y está a la altura de su base: es el balcón que
    // vuela, y sin él la cúpula se apoya en el vidrio sin apoyo.
    const ring = count(a, isGallery);
    expect(ring.n).toBeGreaterThan(40);
    expect(ring.w).toBeGreaterThan(dome.w);
    expect(Math.abs(ring.maxY - dome.maxY)).toBeLessThan(6);
  });

  it('la cúpula está centrada sobre el anillo, no al lado', () => {
    const glass = count(a, isGlass);
    expect(dome.minX).toBeGreaterThan(glass.minX);
    expect(dome.maxX).toBeLessThan(glass.maxX);
    const centro = (b: { minX: number; maxX: number }) => (b.minX + b.maxX) / 2;
    expect(Math.abs(centro(dome) - centro(glass))).toBeLessThan(2.5);
  });

  it('el parque lo rodea y tiene sus árboles', () => {
    // Un piso holgado: el tambor es ancho y come parque, pero el parque es todo el lote alrededor.
    expect(count(a, isPark).n).toBeGreaterThan(1000);
    // Los árboles, fuera del edificio: se cuentan los troncos, que es lo único que no se confunde con el
    // pasto —la copa del árbol y el parque son casi el mismo verde—.
    const glass = count(a, isGlass);
    let troncos = 0;
    for (let y = 0; y < a.px.h; y++) {
      for (let x = 0; x < a.px.w; x++) {
        const c = at(a, x, y);
        if (!c || !isTrunk(c[0], c[1], c[2])) continue;
        if (x < glass.minX - 2 || x > glass.maxX + 2) troncos++;
      }
    }
    expect(troncos).toBeGreaterThan(6);
  });

  it('la simulación no se toca', () => {
    expect([UNIQUES.planetario.cost, UNIQUES.planetario.upkeep]).toEqual([14000, 320]);
    expect([UNIQUES.planetario.w, UNIQUES.planetario.h]).toEqual([3, 3]);
  });
});
