import { describe, expect, it } from 'vitest';
import { paintCalvario } from '../src/render/pixelArt';
import { UNIQUES, UNIQUE_RULES } from '../src/config';

/**
 * El Calvario, el primer edificio único en píxel y el único que pinta su propio terreno: la loma, la
 * escalinata del Vía Crucis y el monte alrededor. Se dibuja en las dos orientaciones del lote —3×6 y
 * 6×3—, así que lo que se prueba es que en las dos esté todo y que la escalinata suba.
 */

interface Art {
  px: { w: number; h: number; data: Uint8ClampedArray };
  ax: number;
  ay: number;
}

const SHADOW_ALPHA = 96;

const alpha = (a: Art, x: number, y: number) => a.px.data[(y * a.px.w + x) * 4 + 3];

/** Topmost row that has any paint. */
function topRow(a: Art): number {
  for (let y = 0; y < a.px.h; y++) for (let x = 0; x < a.px.w; x++) if (alpha(a, x, y)) return y;
  return a.px.h;
}

const rises = (a: Art) => a.ay - topRow(a);

const drawing = (a: Art) => Array.from(a.px.data).join(',');

/** How many pixels the drawing has that satisfy a test on their colour, between two rows. */
function countish(a: Art, ok: (r: number, g: number, b: number) => boolean, minY = 0, maxY = Infinity): number {
  let n = 0;
  for (let i = 0; i < a.px.data.length; i += 4) {
    if (!a.px.data[i + 3]) continue;
    const row = Math.floor(i / 4 / a.px.w);
    if (row < minY || row >= maxY) continue;
    if (ok(a.px.data[i], a.px.data[i + 1], a.px.data[i + 2])) n++;
  }
  return n;
}

/** Green: the hill and the wood, which is most of the drawing. */
const green = (r: number, g: number, b: number) => g > r + 14 && g > b + 14;
/** The stone of the stair and the esplanade: light and neutral, the only pale grey of the lot. */
const stone = (r: number, g: number, b: number) => r > 150 && Math.abs(r - g) < 22 && Math.abs(g - b) < 26 && b > 120;
/** The wood of the crosses: brown, dark and warm. */
const wood = (r: number, g: number, b: number) => r > 60 && r < 150 && g < r - 8 && b < g - 4;

const BOTH: [string, number, number][] = [
  ['3×6', 3, 6],
  ['6×3', 6, 3],
];

describe('el Calvario en píxel', () => {
  it('es píxel duro, y la única transparencia es la sombra', () => {
    for (const [, vw, vh] of BOTH) {
      const a = paintCalvario(vw, vh);
      for (let i = 3; i < a.px.data.length; i += 4) {
        if (a.px.data[i] > 0 && a.px.data[i] < 255) expect(a.px.data[i]).toBeLessThanOrEqual(SHADOW_ALPHA);
      }
      // Las sombras que hay son las que tiran los árboles sobre el pasto, y son la única transparencia
      // parcial del dibujo: el lote no lleva la suya porque el pasto lo cubre entero.
      let shadow = 0;
      for (let i = 3; i < a.px.data.length; i += 4) if (a.px.data[i] > 0 && a.px.data[i] < 255) shadow++;
      expect(shadow).toBeGreaterThan(10);
    }
  });

  it('se dibuja igual de grande en las dos orientaciones del lote', () => {
    const a = paintCalvario(3, 6);
    const b = paintCalvario(6, 3);
    // El lote es el mismo rectángulo visto de dos maneras: el lienzo no cambia de tamaño. El ancla sí se
    // mueve, porque cuelga del lado corto, y esa diferencia es justo la que coloca el sprite en su celda.
    expect([b.px.w, b.px.h]).toEqual([a.px.w, a.px.h]);
    expect(b.ax).toBe(a.ax - 16 * (6 - 3));
    expect(b.ay).toBe(a.ay);
    // Y el dibujo no es el mismo espejado sin más: la loma se pinta para cada orientación.
    expect(drawing(a)).not.toBe(drawing(b));
    expect(rises(a)).toBeGreaterThan(40);
    expect(rises(b)).toBeGreaterThan(40);
  });

  it('la loma ocupa el lote y el monte la cubre', () => {
    const a = paintCalvario(3, 6);
    // La loma y el monte son el grueso del dibujo, no un detalle encima de un lote vacío.
    expect(countish(a, green)).toBeGreaterThan(2500);
    // El monte: las copas oscuras de los pinos y eucaliptos, repartidas en la base y en la ladera.
    expect(countish(a, (r, g, b) => g > r + 10 && g < 120 && b < g)).toBeGreaterThan(120);
  });

  it('la escalinata sube la ladera de punta a punta', () => {
    const a = paintCalvario(3, 6);
    // La piedra de la escalinata y la esplanada: el único gris claro del lote, y buena parte del dibujo.
    const steps = countish(a, stone);
    expect(steps).toBeGreaterThan(100);
    // Un solo peldaño no sería una escalinata: los peldaños tienen que aparecer a lo largo de toda la
    // altura de la loma, desde el pie hasta la cresta, y ser varios y no uno.
    const rows: number[] = [];
    for (let y = 0; y < a.px.h; y++) if (countish(a, stone, y, y + 1) > 0) rows.push(y);
    expect(rows.length).toBeGreaterThan(10);
    expect(rows[rows.length - 1] - rows[0]).toBeGreaterThan(40);
  });

  it('las tres cruces están en la cresta, por encima de la loma', () => {
    const a = paintCalvario(3, 6);
    const top = topRow(a);
    // Las cruces son lo más alto del lote: el madero aparece en la franja de arriba del dibujo.
    expect(countish(a, wood, top, top + 34)).toBeGreaterThan(60);
    // Y son tres: los dos brazos laterales se separan del palo mayor.
    let columns = 0;
    for (let x = 0; x < a.px.w; x++) {
      if (countish(a, wood, top, top + 34) === 0) break;
      let has = false;
      for (let y = top; y < top + 34 && !has; y++) {
        if (alpha(a, x, y) && wood(a.px.data[(y * a.px.w + x) * 4], a.px.data[(y * a.px.w + x) * 4 + 1], a.px.data[(y * a.px.w + x) * 4 + 2])) has = true;
      }
      if (has) columns++;
    }
    expect(columns).toBeGreaterThan(5);
  });

  it('la simulación del Calvario no cambia', () => {
    // El pase es de arte: el costo, el mantenimiento, el turismo y la regla de altura siguen igual.
    const u = UNIQUES.calvario;
    expect([u.w, u.h]).toEqual([3, 6]);
    expect([u.cost, u.upkeep]).toEqual([12000, 220]);
    expect([u.boost, u.peak]).toEqual([0.02, 0.18]);
    expect(u.peakMonths).toEqual([9]);
    expect(UNIQUE_RULES.calvario.margin).toBe(4);
  });
});
