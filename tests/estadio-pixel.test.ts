import { describe, expect, it } from 'vitest';
import { paintEstadio } from '../src/render/pixelArt';
import { UNIQUES } from '../src/config';

/**
 * El Estadio (4×4): la cancha en el medio, las tribunas alrededor y las cuatro torres de luz. Lo que se
 * prueba es que **la cancha esté adentro y rodeada**, que las gradas se vean como gradas —escalones, no
 * una pared lisa— y que las torres de luz sean tres. No se prueba que haya tinta dorada.
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

const isPitch = (r: number, g: number, b: number) => g > r + 18 && g > b + 18 && g > 60 && g < 190;
const isGold = (r: number, g: number, b: number) => r > 120 && r > b + 45 && g > b + 25 && g < r + 10;
const isLine = (r: number, g: number, b: number) => r > 205 && g > 200 && b > 185;
// El filo de la parrilla, con un color que no usa nadie más: con un umbral flojo, el filo iluminado de
// cada grada entraba en la cuenta y una fila de 40 píxeles daba seis "torres".
const isLamp = (r: number, g: number, b: number) => r > 248 && g > 235 && b > 150 && b < 215;
const isCrowd = (r: number, g: number, b: number) => (r > 150 && g < 95 && b < 95) || (b > 110 && b > r + 40 && r < 90);

function count(a: Art, ok: (r: number, g: number, b: number) => boolean, x0 = 0, x1 = -1, y0 = 0, y1 = -1) {
  const xa = x0;
  const xb = x1 < 0 ? a.px.w : x1;
  const ya = y0;
  const yb = y1 < 0 ? a.px.h : y1;
  let n = 0;
  let minX = a.px.w;
  let maxX = -1;
  let minY = a.px.h;
  let maxY = -1;
  for (let y = ya; y < yb; y++) {
    for (let x = xa; x < xb; x++) {
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

describe('el Estadio en píxel', () => {
  const a = paintEstadio(UNIQUES.estadio.w, UNIQUES.estadio.h);
  const pitch = count(a, isPitch);

  it('la cancha está adentro del estadio, no en el borde', () => {
    expect(pitch.n).toBeGreaterThan(250);
    expect(pitch.minX).toBeGreaterThan(8);
    expect(pitch.minY).toBeGreaterThan(8);
    expect(pitch.maxX).toBeLessThan(a.px.w - 8);
  });

  it('las tribunas rodean la cancha por los cuatro lados', () => {
    // Una tribuna de cada lado: hay dorado arriba, abajo, a la izquierda y a la derecha de la cancha.
    const arriba = count(a, isGold, 0, a.px.w, 0, pitch.minY).n;
    const abajo = count(a, isGold, 0, a.px.w, pitch.maxY + 1, a.px.h).n;
    const izquierda = count(a, isGold, 0, pitch.minX, 0, a.px.h).n;
    const derecha = count(a, isGold, pitch.maxX + 1, a.px.w, 0, a.px.h).n;
    for (const n of [arriba, abajo, izquierda, derecha]) expect(n).toBeGreaterThan(120);
  });

  it('las gradas se ven como escalones y no como una pared', () => {
    // Una columna que atraviesa la tribuna del fondo tiene que cambiar de tono varias veces: la
    // contrahuella en sombra y el asiento en luz. Una pared lisa no cambia nunca.
    let best = 0;
    for (let x = Math.round(a.px.w * 0.35); x < a.px.w * 0.65; x++) {
      let cambios = 0;
      let prev = false;
      for (let y = 0; y < a.px.h; y++) {
        const c = at(a, x, y);
        const gold = !!c && isGold(c[0], c[1], c[2]);
        if (gold && !prev) cambios++;
        prev = gold;
      }
      best = Math.max(best, cambios);
    }
    expect(best).toBeGreaterThan(4);
  });

  it('la cancha tiene sus líneas y su círculo', () => {
    const lineas = count(a, isLine, pitch.minX, pitch.maxX + 1, pitch.minY, pitch.maxY + 1);
    expect(lineas.n).toBeGreaterThan(40);
    expect(lineas.w).toBeGreaterThan(pitch.w * 0.6);
  });

  it('hay tres torres de luz, y la gente se ve', () => {
    // La parrilla encendida está en tres puntos separados: las tres esquinas de la herradura. La
    // cuarta no existe porque la cuarta esquina es la abierta, y además su mástil cruzaría la cancha.
    // Se agrupa en dos dimensiones, porque dos torres pueden caer en la misma columna.
    const dark = (r: number, g: number, b: number) => r < 80 && g < 80 && b < 85;
    const heads: [number, number][] = [];
    for (let y = 0; y < a.px.h; y++) {
      for (let x = 0; x < a.px.w; x++) {
        const c = at(a, x, y);
        if (!c || !isLamp(c[0], c[1], c[2])) continue;
        if (!heads.some(([hx, hy]) => Math.hypot(hx - x, hy - y) < 9)) heads.push([x, y]);
      }
    }
    expect(heads.length).toBe(3);
    expect(count(a, isCrowd).n).toBeGreaterThan(25);
    expect(count(a, dark).n).toBeGreaterThan(20);
  });

  it('la simulación no se toca', () => {
    expect([UNIQUES.estadio.cost, UNIQUES.estadio.upkeep]).toEqual([18000, 420]);
    expect([UNIQUES.estadio.w, UNIQUES.estadio.h]).toEqual([4, 4]);
  });
});
