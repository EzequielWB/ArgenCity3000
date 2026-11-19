import { describe, expect, it } from 'vitest';
import { paintRegimiento } from '../src/render/pixelArt';
import { UNIQUES } from '../src/config';

/**
 * El Regimiento (4×3): **un cerco con un campo adentro**. Es el único único que se lee desde arriba, así
 * que lo que se prueba es la planta: que el patio de armas esté abierto y sea grande, que las cuadras lo
 * cierren en ele dejándolo abierto del lado de la cámara, que la torre sobresalga con su capuchón y que la
 * bandera esté en el medio. No se prueba que haya tinta.
 */

type C = [number, number, number];

const a = paintRegimiento(4, 3);

const at = (x: number, y: number): C | null => {
  if (x < 0 || y < 0 || x >= a.px.w || y >= a.px.h) return null;
  const i = (y * a.px.w + x) * 4;
  if (!a.px.data[i + 3]) return null;
  return [a.px.data[i], a.px.data[i + 1], a.px.data[i + 2]];
};

/** La cal y la piedra de las cuadras: claro y cálido. */
const isCal = (r: number, g: number, b: number) => r > 205 && g > 195 && b > 168 && r >= g && g >= b && r - b < 62;
/** La teja verde: verde apagado, no el verde saturado de las copas de los árboles. */
const isRoof = (r: number, g: number, b: number) => g - r > 18 && g - b < 56 && g > 90 && g < 200;
/** La tierra apisonada del patio. */
const isDirt = (r: number, _g: number, b: number) => r >= 160 && r <= 214 && b < 173 && r - b >= 28 && r - b <= 72;
/** El zinc del capuchón de la torre: gris frío, más oscuro que la cal. */
const isZinc = (r: number, g: number, b: number) => r >= 70 && r <= 138 && b - r >= 8 && b - r <= 17 && Math.abs(g - r) < 13;
/** El celeste de la bandera. */
const isFlag = (r: number, g: number, b: number) => b > 190 && b - r > 85 && g > 150;
const isWhite = (r: number, g: number, b: number) => r > 228 && g > 226 && b > 214;
const isTrunk = (r: number, g: number, b: number) => r > 55 && r < 145 && r > g + 16 && g > b + 8;
const isOlive = (r: number, g: number, b: number) => Math.abs(g - r) < 22 && g - b > 22 && r > 98 && r < 145 && g < 152;

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
  return { n, minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1, cx: Math.round(sx / n), cy: Math.round(sy / n) };
}

const dirt = box(isDirt);
const roof = box(isRoof);
const cal = box(isCal);
const zinc = box(isZinc);
const flag = box(isFlag);

/**
 * La fila más ancha del capuchón. Se mide la corrida **más larga** de zinc de cada fila y no la distancia
 * entre la primera y la última: así el mástil de la bandera, que es de un gris parecido, no cuenta como
 * capuchón. El capuchón es una pieza maciza; un cable de un píxel no es un capuchón.
 */
function capRow(): { y: number; w: number; cx: number } {
  let best = { y: 0, w: 0, cx: 0 };
  for (let y = 0; y < a.px.h; y++) {
    let run = 0;
    let start = 0;
    for (let x = 0; x <= a.px.w; x++) {
      const c = x < a.px.w ? at(x, y) : null;
      if (c && isZinc(c[0], c[1], c[2])) {
        if (run === 0) start = x;
        run++;
      } else {
        if (run > best.w) best = { y, w: run, cx: Math.round(start + (run - 1) / 2) };
        run = 0;
      }
    }
  }
  return best;
}

describe('el Regimiento en píxel', () => {
  it('el patio de armas es el espacio: grande y abierto en el medio', () => {
    // Un cuartel es casi todo piso. Si el patio no es la superficie más grande, el edificio es otra cosa.
    expect(dirt.n).toBeGreaterThan(1200);
    expect(dirt.n).toBeGreaterThan(roof.n);
    let open = 0;
    let tot = 0;
    for (let y = dirt.cy - 5; y <= dirt.cy + 5; y++) {
      for (let x = dirt.cx - 5; x <= dirt.cx + 5; x++) {
        tot++;
        const c = at(x, y);
        if (c && isDirt(c[0], c[1], c[2])) open++;
      }
    }
    // El centro del patio está vacío: es un patio de armas, no un terreno con cosas.
    expect(open / tot).toBeGreaterThan(0.85);
  });

  it('las cuadras lo cierran en ele y lo dejan abierto del lado de la cámara', () => {
    expect(roof.n).toBeGreaterThan(800);
    expect(cal.n).toBeGreaterThan(800);
    // La ele: el techo se pasa del patio por arriba, por la izquierda y por la derecha...
    expect(roof.minY).toBeLessThan(dirt.minY - 8);
    expect(roof.minX).toBeLessThan(dirt.minX - 4);
    expect(roof.maxX).toBeGreaterThan(dirt.maxX + 4);
    // ...y no lo cierra por abajo: si el techo bajara más que el patio, el patio no se vería y el
    // edificio sería un cuartel cerrado, que desde arriba es una caja con un pozo adentro.
    expect(roof.maxY).toBeLessThan(dirt.maxY);
  });

  it('la torre es una columna de cal alta, con el capuchón de zinc', () => {
    const cap = capRow();
    expect(zinc.n).toBeGreaterThan(20);
    expect(cap.w).toBeGreaterThan(3);
    // La columna: desde abajo del capuchón y del balcón, cal sin cortes hacia el patio.
    let y = cap.y + 1;
    while (y < a.px.h - 1) {
      const c = at(cap.cx, y);
      if (c && isCal(c[0], c[1], c[2])) break;
      y++;
    }
    let shaft = 0;
    while (y + shaft < a.px.h) {
      const c = at(cap.cx, y + shaft);
      if (!c || !isCal(c[0], c[1], c[2])) break;
      shaft++;
    }
    expect(shaft).toBeGreaterThan(16);
    // Y la torre está sobre el patio, no sobre el techo: así se recorta contra la tierra.
    expect(cap.cx).toBeGreaterThan(dirt.minX);
    expect(cap.cx).toBeLessThan(dirt.maxX);
  });

  it('la bandera tiene sus tres franjas y su mástil hasta el piso', () => {
    expect(flag.n).toBeGreaterThan(20);
    // Dos franjas celestes separadas por la blanca: una bandera de un solo color es un trapo.
    const blues: number[] = [];
    for (let y = flag.minY; y <= flag.maxY; y++) {
      let n = 0;
      let w = 0;
      for (let x = flag.minX; x <= flag.maxX; x++) {
        const c = at(x, y);
        if (!c) continue;
        if (isFlag(c[0], c[1], c[2])) n++;
        if (isWhite(c[0], c[1], c[2])) w++;
      }
      blues.push(n > w ? 1 : 0);
    }
    const tramos = blues.join('').replace(/0+/g, ' ').trim().split(' ').filter(Boolean).length;
    expect(tramos).toBe(2);
    // El mástil baja hasta el piso y la bandera cuelga de arriba, no flota.
    let mast = 0;
    for (let y = flag.maxY + 1; y < a.px.h; y++) {
      const c = at(flag.minX - 1, y);
      if (c && c[0] < 160 && c[1] < 160) mast++;
    }
    expect(mast).toBeGreaterThan(10);
  });

  it('el muro del perímetro corre por el frente', () => {
    // El cerco es lo que hace recinto: sin él el patio es un descampado con dos cuadras.
    expect(box(isCal, a.px.h - 14).n).toBeGreaterThan(15);
  });

  it('los árboles y el camión están', () => {
    expect(box(isTrunk).n).toBeGreaterThan(20);
    expect(box(isOlive).n).toBeGreaterThan(25);
  });

  it('la simulación no se toca', () => {
    expect([UNIQUES.regimiento.cost, UNIQUES.regimiento.upkeep]).toEqual([9000, 260]);
    expect([UNIQUES.regimiento.w, UNIQUES.regimiento.h]).toEqual([4, 3]);
    expect(UNIQUES.regimiento.crime).toEqual({ radius: 7, shade: 22 });
  });
});
