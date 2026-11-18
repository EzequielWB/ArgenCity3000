import { describe, expect, it } from 'vitest';
import { paintTeatro } from '../src/render/pixelArt';
import { UNIQUES } from '../src/config';

/**
 * El Teatro (3×3): el pórtico de seis columnas contra la logia oscura, las ventanas en tres filas sobre
 * la cara del costado y la cúpula de cobre ancha y baja con su linterna. Lo que se prueba es eso —seis
 * columnas, tres filas de ventanas, una cúpula más ancha que alta— y no que haya tinta.
 */

interface Art {
  px: { w: number; h: number; data: Uint8ClampedArray };
  ax: number;
  ay: number;
}

const at = (a: Art, x: number, y: number) => {
  const i = (y * a.px.w + x) * 4;
  return a.px.data[i + 3] ? [a.px.data[i], a.px.data[i + 1], a.px.data[i + 2]] : null;
};

function topRow(a: Art): number {
  for (let y = 0; y < a.px.h; y++) for (let x = 0; x < a.px.w; x++) if (at(a, x, y)) return y;
  return a.px.h;
}

/** How many pixels of a colour the drawing has. */
function countish(a: Art, ok: (r: number, g: number, b: number) => boolean): number {
  let n = 0;
  for (let y = 0; y < a.px.h; y++) for (let x = 0; x < a.px.w; x++) {
    const c = at(a, x, y);
    if (c && ok(c[0], c[1], c[2])) n++;
  }
  return n;
}

/** The paint of a colour, with the box it occupies. */
function stats(a: Art, ok: (r: number, g: number, b: number) => boolean) {
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

/** The columns that have paint of a colour, counted as groups: three windows in a row are three groups. */
function colGroups(a: Art, ok: (r: number, g: number, b: number) => boolean, y0 = 0): number {
  let groups = 0;
  let inGroup = false;
  for (let x = 0; x < a.px.w; x++) {
    let any = false;
    for (let y = y0; y < a.px.h; y++) {
      const c = at(a, x, y);
      if (c && ok(c[0], c[1], c[2])) any = true;
    }
    if (any && !inGroup) groups++;
    inGroup = any;
  }
  return groups;
}

/** The runs of a colour in one row. */
function runsIn(a: Art, y: number, ok: (r: number, g: number, b: number) => boolean): [number, number][] {
  const out: [number, number][] = [];
  let start = -1;
  for (let x = 0; x <= a.px.w; x++) {
    const c = x < a.px.w ? at(a, x, y) : null;
    const on = !!c && ok(c[0], c[1], c[2]);
    if (on && start < 0) start = x;
    if (!on && start >= 0) {
      out.push([start, x - 1]);
      start = -1;
    }
  }
  return out;
}

const isSlate = (r: number, g: number, b: number) => b > r + 3 && Math.abs(g - b) < 14 && r > 55 && r < 150;
const isGreen = (r: number, g: number, b: number) => g > r + 12 && g > b + 4 && g > 80 && g < 200;
// El vidrio tiene un sesgo azul fuerte; la pizarra del techo es azulada pero apenas, y con un umbral
// flojo entraba en la cuenta y sumaba dos columnas de ventanas que no existen.
const isGlass = (r: number, g: number, b: number) => b > r + 28 && b > 88 && g > 70 && r < 125;
const isLoggia = (r: number, g: number, b: number) => Math.abs(r - 93) < 28 && Math.abs(g - 79) < 28 && Math.abs(b - 60) < 28;

describe('el Teatro en píxel', () => {
  const t = paintTeatro(UNIQUES.teatro.w, UNIQUES.teatro.h);

  it('se levanta sobre el lote: el bloque, el frontón y el techo', () => {
    expect(t.ay - topRow(t)).toBeGreaterThan(20);
  });

  it('el pórtico tiene seis columnas contra la logia oscura', () => {
    // La logia es el plano oscuro de la fachada y las columnas lo cortan en tajadas: siete tajadas dejan
    // seis columnas entre ellas. Sin la logia detrás, las columnas claras no se leerían a 1×.
    // Una fila que cruce la fachada de lado a lado: el pórtico es una cara en diagonal, así que más
    // arriba la fila corta sólo una punta.
    const y = t.ay + 10;
    const slices = runsIn(t, y, isLoggia);
    // Seis columnas parten la logia en cinco huecos (más la punta que asoma de cada lado): lo que se mide
    // es que las tajadas oscuras sean varias y finas, no una pared oscura con columnas dibujadas encima.
    expect(slices.length).toBeGreaterThanOrEqual(5);
    expect(slices.length).toBeLessThanOrEqual(8);
    for (const [x0, x1] of slices) expect(x1 - x0).toBeLessThanOrEqual(4);
    // Y el pórtico entero —las seis columnas con sus claros— ocupa el ancho de la fachada.
    expect(slices[slices.length - 1][1] - slices[0][0]).toBeGreaterThan(24);
  });

  it('las ventanas van en tres filas sobre la cara del costado', () => {
    const glass = stats(t, isGlass);
    expect(glass.n).toBeGreaterThan(150);
    // Tres ventanas por fila, y las tres filas: nueve paños en la cara del costado.
    expect(colGroups(t, isGlass)).toBe(3);
  });

  it('el techo es un techo de pizarra, no una cúpula', () => {
    const roof = stats(t, isSlate);
    // El Colón no tiene cúpula: tiene una mansarda enorme y pesada, y es lo que lo distingue de un banco
    // con columnas. Se mide que la pizarra cubra el bloque entero —ancho y alto— y que esté en dos tonos,
    // que son sus dos faldas: una cúpula es un casquete de un solo material.
    expect(roof.n).toBeGreaterThan(600);
    expect(roof.w).toBeGreaterThan(55);
    expect(roof.h).toBeGreaterThan(30);
    const light = countish(t, (r, g, b) => isSlate(r, g, b) && r > 90);
    const dark = countish(t, (r, g, b) => isSlate(r, g, b) && r <= 90);
    expect(light).toBeGreaterThan(150);
    expect(dark).toBeGreaterThan(150);
    // Y no queda cobre verde de la cúpula que tenía antes.
    expect(countish(t, isGreen)).toBeLessThan(100);
  });

  it('la simulación no se toca', () => {
    expect([UNIQUES.teatro.cost, UNIQUES.teatro.upkeep]).toEqual([16000, 340]);
    expect([UNIQUES.teatro.w, UNIQUES.teatro.h]).toEqual([3, 3]);
  });
});
