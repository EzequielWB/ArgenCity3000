import { describe, expect, it } from 'vitest';
import { paintSindicato } from '../src/render/pixelArt';
import { UNIQUES } from '../src/config';

/**
 * El Sindicato (3×2): **el salón de un pueblo obrero**, como los de los frigoríficos de Berisso. Lo que lo
 * nombra no es la masa de hormigón —una sede social cualquiera tiene la misma— sino el portón ancho con el
 * estandarte rojo encima y la bandera en la azotea. Eso es lo que se prueba, más las dos alturas: el salón
 * adelante y las oficinas atrás, que son las que hacen que el edificio tenga perfil y no sea un galpón.
 */

type C = [number, number, number];

const a = paintSindicato(3, 2);

const at = (x: number, y: number): C | null => {
  if (x < 0 || y < 0 || x >= a.px.w || y >= a.px.h) return null;
  const i = (y * a.px.w + x) * 4;
  if (!a.px.data[i + 3]) return null;
  return [a.px.data[i], a.px.data[i + 1], a.px.data[i + 2]];
};

/** El hormigón de las paredes: claro, cálido y apenas más oscuro que el blanco de la piedra. */
const isWall = (r: number, g: number, b: number) => r > 170 && r <= 245 && r >= g && g >= b && r - b < 48 && r - b > 12;
/** El rojo del estandarte y de la bandera: saturado, no un ladrillo. */
const isRed = (r: number, g: number, b: number) => r > 140 && r - g > 70 && r - b > 90;
/** El vidrio azulado de las fajas. */
const isGlass = (r: number, g: number, b: number) => b > r + 20 && b > 90 && b < 215 && g > r;
/** La madera clara del portón. El `b > 55` es lo que la separa del tronco del árbol: sin eso el árbol se
 * cuenta como puerta y el portón parece estar tres píxeles más arriba de donde está. */
const isDoor = (r: number, g: number, b: number) => r > 95 && r < 175 && r - g > 10 && r - b > 28 && g > b && b > 55;

interface Box {
  n: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

function box(ok: (r: number, g: number, b: number) => boolean, y0 = 0, y1 = -1): Box {
  const last = y1 < 0 ? a.px.h - 1 : y1;
  let n = 0;
  let minX = a.px.w;
  let maxX = -1;
  let minY = a.px.h;
  let maxY = -1;
  let sx = 0;
  let sy = 0;
  for (let y = y0; y <= last; y++) {
    for (let x = 0; x < a.px.w; x++) {
      const c = at(x, y);
      if (!c || !ok(c[0], c[1], c[2])) continue;
      n++;
      sx += x;
      sy += y;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  if (!n) return { n, minX, maxX, minY, maxY, w: 0, h: 0, cx: -1, cy: -1 };
  return { n, minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1, cx: sx / n, cy: sy / n };
}

/**
 * Agrupa lo pintado en manchas verticales: filas con algo del color, pegadas si el hueco entre ellas es
 * chico. Sirve para separar el estandarte de la bandera, que son el mismo rojo en dos lugares.
 */
function blobs(ok: (r: number, g: number, b: number) => boolean, gap = 3): Box[] {
  const rows: number[] = [];
  for (let y = 0; y < a.px.h; y++) {
    for (let x = 0; x < a.px.w; x++) {
      const c = at(x, y);
      if (c && ok(c[0], c[1], c[2])) {
        rows.push(y);
        break;
      }
    }
  }
  const out: Box[] = [];
  let start = -1;
  let prev = -99;
  for (const y of rows) {
    if (y - prev > gap) {
      if (start >= 0) out.push(box(ok, start, prev));
      start = y;
    }
    prev = y;
  }
  if (start >= 0) out.push(box(ok, start, prev));
  return out;
}

/** La mediana de una lista de píxeles: sirve para comparar alturas sin que la bandera la mueva. */
const median = (v: number[]): number => {
  const s2 = [...v].sort((x, y) => x - y);
  return s2[Math.floor(s2.length / 2)];
};

describe('el Sindicato en píxel', () => {
  it('es un bloque de hormigón sobre el lote, con el patio de cemento adelante', () => {
    // La pared tiene que ser la superficie más grande del sprite: si el vidrio o el rojo ganan, el edificio
    // dejó de ser un edificio.
    const wall = box(isWall);
    expect(wall.n).toBeGreaterThan(900);
    expect(wall.w).toBeGreaterThan(50);
    expect(wall.h).toBeGreaterThan(40);
  });

  it('el portón es ancho, está en el medio y no es un agujero', () => {
    // A 1× un rectángulo oscuro se lee como un hueco en la pared: la madera tiene que ser **clara**.
    const door = box(isDoor);
    expect(door.w).toBeGreaterThan(9);
    expect(door.h).toBeGreaterThan(5);
    // La madera no es un tono oscuro: si el promedio baja de 90 es un pozo.
    let sum = 0;
    let n = 0;
    for (let y = door.minY; y <= door.maxY; y++) {
      for (let x = door.minX; x <= door.maxX; x++) {
        const c = at(x, y);
        if (c && isDoor(c[0], c[1], c[2])) {
          sum += c[0];
          n++;
        }
      }
    }
    expect(sum / n).toBeGreaterThan(95);
  });

  it('el estandarte rojo cuelga sobre el portón', () => {
    const reds = blobs(isRed);
    // Dos rojos: el estandarte abajo y la bandera arriba. Una sola mancha sería una de las dos cosas.
    expect(reds.length).toBe(2);
    const door = box(isDoor);
    const [bandera, estandarte] = reds;
    // El estandarte (el de abajo) es ancho y está justo arriba del portón, no en otra pared.
    expect(estandarte.w).toBeGreaterThan(11);
    expect(estandarte.minY).toBeLessThan(door.minY - 2);
    expect(Math.abs(estandarte.cx - door.cx)).toBeLessThan(5);
    // Y la bandera está más arriba que el estandarte: es la que corona el edificio.
    expect(bandera.maxY).toBeLessThan(estandarte.minY);
  });

  it('la bandera roja corona la azotea, con cielo arriba', () => {
    const [bandera] = blobs(isRed);
    expect(bandera.w).toBeGreaterThan(3);
    // En el mástil, arriba de la punta no hay nada pintado: la bandera se recorta contra el cielo.
    let x = Math.round(bandera.cx);
    if (!isRed(...(at(x, bandera.minY) ?? [0, 0, 0]))) x = bandera.minX;
    let sky = 0;
    for (let y = bandera.minY - 1; y >= 0 && !at(x, y); y--) sky++;
    expect(sky).toBeGreaterThan(2);
  });

  it('son dos masas a dos alturas, cada una con su faja de vidrio', () => {
    // Una sola masa de hormigón es un galpón. Lo que lo convierte en un edificio con perfil es que las
    // oficinas del fondo le saquen una cabeza al salón, y eso se ve en las columnas donde las dos fajas de
    // vidrio caen a distinta altura: la de arriba es la de las oficinas, la de abajo la del salón.
    const alturas: [number, number][] = [];
    for (let x = 0; x < a.px.w; x++) {
      const ys: number[] = [];
      for (let y = 0; y < a.px.h; y++) {
        const c = at(x, y);
        if (c && isGlass(c[0], c[1], c[2])) ys.push(y);
      }
      if (!ys.length) continue;
      // Las tiradas de vidrio de esta columna, cortadas donde el hueco es mayor a dos píxeles.
      const runs: number[][] = [[ys[0]]];
      for (const y of ys.slice(1)) {
        const last = runs[runs.length - 1];
        if (y - last[last.length - 1] > 2) runs.push([y]);
        else last.push(y);
      }
      if (runs.length >= 2) alturas.push([runs[0][0], runs[runs.length - 1][0]]);
    }
    expect(alturas.length).toBeGreaterThan(8);
    expect(median(alturas.map(([top2]) => top2))).toBeLessThan(median(alturas.map(([, bot]) => bot)) - 10);
    // Y el vidrio no es un ventanuco: es una faja larga.
    expect(box(isGlass).n).toBeGreaterThan(90);
  });

  it('la simulación no se toca', () => {
    expect([UNIQUES.sindicato.cost, UNIQUES.sindicato.upkeep]).toEqual([11000, 280]);
    expect([UNIQUES.sindicato.w, UNIQUES.sindicato.h]).toEqual([3, 2]);
    expect(UNIQUES.sindicato.jobs).toEqual({ perJob: 0.00025, max: 0.16 });
  });
});
