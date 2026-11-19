import { describe, expect, it } from 'vitest';
import { paintPlanetario } from '../src/render/pixelArt';
import { UNIQUES } from '../src/config';

/**
 * El Planetario (3×3): **la cúpula oscura sobre el plato de vidrio que vuela, con las patas de hormigón**.
 * Lo que se prueba es la estructura, que es lo que lo identifica: que la cúpula sea oscura y redonda, que
 * el plato de vidrio sea más ancho que ella y con carpintería, que la cúpula esté centrada, y que las
 * patas lleguen al suelo de los dos lados. No se prueba que haya tinta.
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

/** La cúpula: gris plomo, casi neutro y oscuro. Es lo único oscuro del edificio. */
const isDome = (r: number, g: number, b: number) =>
  r < 130 && r > 48 && Math.abs(r - g) < 14 && b > r && b - r < 16 && Math.abs(g - b) < 18;
/** El vidrio del plato: claro y azulado. */
const isGlass = (r: number, _g: number, b: number) => b > r + 14 && b > 160;
/** La carpintería: hierro claro, casi blanco. */
const isMullion = (r: number, g: number, b: number) => r > 225 && g > 218 && b > 200;
/** El hormigón de las patas: gris cálido. */
const isConcrete = (r: number, g: number, b: number) => r > b + 12 && r > 95 && r < 215 && Math.abs(r - g) < 14;
const isPark = (r: number, g: number, b: number) => g > r + 18 && g > b + 25 && g > 80;
/** El tronco: madera oscura. La copa no sirve para contarlos, es casi el mismo verde que el pasto. */
const isTrunk = (r: number, g: number, b: number) => r > 55 && r < 145 && r > g + 16 && g > b + 8;

function count(a: Art, ok: (r: number, g: number, b: number) => boolean, y0 = 0, y1 = -1) {
  const last = y1 < 0 ? a.px.h - 1 : y1;
  let n = 0;
  let minX = a.px.w;
  let maxX = -1;
  let minY = a.px.h;
  let maxY = -1;
  for (let y = y0; y <= last; y++) {
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
const glass = count(a, isGlass);

describe('el Planetario en píxel', () => {
  it('la cúpula es oscura y redonda: más ancha que alta, con la fila más ancha abajo', () => {
    // Es lo único oscuro de la ciudad a propósito: la cúpula de chapa perforada se reconoce desde lejos
    // justamente por el valor. Una cúpula clara sería una tapa más.
    expect(dome.n).toBeGreaterThan(300);
    expect(dome.w).toBeGreaterThan(dome.h);
    const filas = widths(a, isDome, dome.minY, dome.maxY);
    expect(filas.length).toBeGreaterThan(8);
    const masAncha = filas.reduce((b, f) => (f[1] > b[1] ? f : b), filas[0]);
    expect(masAncha[0]).toBeGreaterThanOrEqual(dome.maxY - 4);
    expect(filas[0][1]).toBeLessThan(masAncha[1] * 0.55);
  });

  it('la cúpula está perforada: dos tonos alternados, no un relleno liso', () => {
    // La malla se pinta en damero. Un relleno de un solo tono ocupa la misma área y también pasaría un
    // conteo de píxeles; lo que distingue la chapa perforada es que hay **dos** tonos mezclados.
    const tones = new Set<string>();
    for (let y = dome.minY; y <= dome.maxY; y++) {
      for (let x = dome.minX; x <= dome.maxX; x++) {
        const c = at(a, x, y);
        if (c && isDome(c[0], c[1], c[2])) tones.add(c.join(','));
      }
    }
    expect(tones.size).toBeGreaterThan(4);
  });

  it('el plato de vidrio vuela: es más ancho que la cúpula y tiene carpintería', () => {
    // El plato es la otra mitad del edificio: vuela más ancho que la cúpula y la franja de vidrio se ve.
    // La franja es corta y la corta la carpintería: lo que importa es que esté, no cuánta.
    expect(glass.n).toBeGreaterThan(90);
    expect(glass.w).toBeGreaterThan(dome.w + 2);
    expect(glass.maxY).toBeGreaterThan(dome.maxY - 2);
    const cols = new Set<number>();
    for (let x = glass.minX; x <= glass.maxX; x++) {
      let n = 0;
      for (let y = glass.minY; y <= glass.maxY; y++) {
        const c = at(a, x, y);
        if (c && isMullion(c[0], c[1], c[2])) n++;
      }
      if (n > 3) cols.add(x);
    }
    expect(cols.size).toBeGreaterThan(6);
  });

  it('las patas de hormigón llegan al suelo de los dos lados', () => {
    // Sin las patas el plato flota. Se cuentan los píxeles de hormigón **de abajo del plato**, y se pide
    // que haya de los dos lados del edificio, que es lo que lo hace un apoyo y no una pata sola.
    const bajo = count(a, isConcrete, glass.maxY + 1);
    expect(bajo.n).toBeGreaterThan(30);
    let izq = 0;
    let der = 0;
    for (let y = glass.maxY + 1; y < a.px.h; y++) {
      for (let x = 0; x < a.px.w; x++) {
        const c = at(a, x, y);
        if (!c || !isConcrete(c[0], c[1], c[2])) continue;
        if (x < dome.minX) izq++;
        if (x > dome.maxX) der++;
      }
    }
    expect(izq).toBeGreaterThan(8);
    expect(der).toBeGreaterThan(8);
  });

  it('la cúpula está centrada sobre el plato, no al lado', () => {
    expect(dome.minX).toBeGreaterThan(glass.minX);
    expect(dome.maxX).toBeLessThan(glass.maxX);
    const centro = (b: { minX: number; maxX: number }) => (b.minX + b.maxX) / 2;
    expect(Math.abs(centro(dome) - centro(glass))).toBeLessThan(2.5);
  });

  it('el parque lo rodea y tiene sus árboles', () => {
    expect(count(a, isPark).n).toBeGreaterThan(1000);
    // Los árboles, fuera del edificio: se cuentan los troncos, que es lo único que no se confunde con el
    // pasto —la copa del árbol y el parque son casi el mismo verde—.
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
