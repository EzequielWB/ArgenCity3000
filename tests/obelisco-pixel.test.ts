import { describe, expect, it } from 'vitest';
import { paintObelisco } from '../src/render/pixelArt';
import { UNIQUES } from '../src/config';

/**
 * El Obelisco (2×2): la plaza de la República con sus dos escalones y sus cuatro faroles, y el fuste de
 * cuatro caras planas que remata en el piramidión filoso. Lo que se prueba es la estructura del dibujo
 * —que el fuste sea recto, que tenga dos caras, que el piramidión se afine y que estén los cuatro
 * faroles—, no que haya tinta.
 */

interface Art {
  px: { w: number; h: number; data: Uint8ClampedArray };
  ax: number;
  ay: number;
}

const alpha = (a: Art, x: number, y: number) => a.px.data[(y * a.px.w + x) * 4 + 3];

function topRow(a: Art): number {
  for (let y = 0; y < a.px.h; y++) for (let x = 0; x < a.px.w; x++) if (alpha(a, x, y)) return y;
  return a.px.h;
}

const rises = (a: Art) => a.ay - topRow(a);

/** First and last painted column of a row. */
function runAt(a: Art, y: number): [number, number] {
  let first = -1;
  let last = -1;
  for (let x = 0; x < a.px.w; x++) {
    if (!alpha(a, x, y)) continue;
    if (first < 0) first = x;
    last = x;
  }
  return [first, last];
}

const paintedWidth = (a: Art, y: number) => {
  const [f, l] = runAt(a, y);
  return f < 0 ? 0 : l - f + 1;
};

/** Mean lightness of the painted pixels in a column band of a row. */
function meanLight(a: Art, y: number, x0: number, x1: number): number {
  let sum = 0;
  let n = 0;
  for (let x = x0; x < x1; x++) {
    if (!alpha(a, x, y)) continue;
    const i = (y * a.px.w + x) * 4;
    sum += a.px.data[i] * 0.3 + a.px.data[i + 1] * 0.59 + a.px.data[i + 2] * 0.11;
    n++;
  }
  return n ? sum / n : 0;
}

/** How many separate blobs of a colour the drawing has. */
function blobs(a: Art, ok: (r: number, g: number, b: number) => boolean): number {
  const seen = new Uint8Array(a.px.w * a.px.h);
  const on = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= a.px.w || y >= a.px.h) return false;
    const i = (y * a.px.w + x) * 4;
    return a.px.data[i + 3] > 0 && ok(a.px.data[i], a.px.data[i + 1], a.px.data[i + 2]);
  };
  let n = 0;
  for (let y = 0; y < a.px.h; y++) {
    for (let x = 0; x < a.px.w; x++) {
      if (seen[y * a.px.w + x] || !on(x, y)) continue;
      n++;
      const stack: [number, number][] = [[x, y]];
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        if (cx < 0 || cy < 0 || cx >= a.px.w || cy >= a.px.h) continue;
        const k = cy * a.px.w + cx;
        if (seen[k] || !on(cx, cy)) continue;
        seen[k] = 1;
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
    }
  }
  return n;
}

/** The lamp of the plaza: un amarillo muy saturado, que no aparece en ningún otro material. */
const lampish = (r: number, g: number, b: number) => r > 235 && g > 200 && b < 170;

describe('el Obelisco en píxel', () => {
  const ob = paintObelisco(UNIQUES.obelisco.w, UNIQUES.obelisco.h);

  it('es un remate vertical: el fuste y el piramidión levantan el dibujo sobre el lote', () => {
    // Setenta y píxeles de fuste más el piramidión: el obelisco es lo más alto que tiene la ciudad.
    expect(rises(ob)).toBeGreaterThan(90);
  });

  it('el fuste es recto: no se angosta de abajo arriba', () => {
    // Tres alturas sobre el fuste, medidas contra el ancla. La escalera de cajas que se angostaban
    // —el atajo obvio— da anchos distintos en cada una.
    const zs = [0.55, 0.45, 0.35];
    const widths = zs.map((k) => paintedWidth(ob, Math.round(ob.ay - rises(ob) * (1 - k))));
    for (const w of widths) expect(w).toBeGreaterThan(18);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(2);
  });

  it('el fuste tiene dos caras y la que da a la cámara es la iluminada', () => {
    // El ancla está en el vértice de las dos caras: a la izquierda la cara que toma la luz, a la
    // derecha la que queda en sombra. Con una sola cara el fuste es un rectángulo blanco.
    const y = Math.round(ob.ay - rises(ob) * 0.5);
    const mid = ob.ax;
    expect(meanLight(ob, y, mid - 10, mid)).toBeGreaterThan(meanLight(ob, y, mid + 1, mid + 11) + 8);
  });

  it('el piramidión se afina hasta la punta', () => {
    const top = topRow(ob);
    // El piramidión arranca donde termina el fuste y muere en la antena: dos o tres píxeles.
    // La punta es un píxel —la antena— y el piramidión se abre en cada fila que baja, hasta el fuste.
    expect(paintedWidth(ob, top)).toBe(1);
    const widths = [8, 12, 16, 18].map((k) => paintedWidth(ob, top + k));
    expect(widths[0]).toBeLessThanOrEqual(5);
    for (let i = 1; i < widths.length; i++) expect(widths[i]).toBeGreaterThan(widths[i - 1]);
    // Abajo de todo el piramidión empieza el fuste, y de ahí para abajo el ancho ya no cambia.
    expect(paintedWidth(ob, top + 30)).toBe(paintedWidth(ob, top + 70));
  });

  it('la plaza tiene sus faroles, y son los que se ven', () => {
    // Tres globos encendidos: los dos del costado y el de adelante. El cuarto farol de la plaza cae
    // justo detrás del fuste desde esta cámara, así que no se pinta —ni se cuenta.
    expect(blobs(ob, lampish)).toBe(3);
  });

  it('la plaza ocupa el lote de lado a lado', () => {
    // Los dos escalones llegan a las cuatro puntas del rombo: en el ecuador del lote el dibujo mide
    // los cuatro lados del rombo, no un cuadrado suelto en el medio.
    const y = ob.ay + 16;
    expect(paintedWidth(ob, y)).toBeGreaterThanOrEqual(58);
    expect(paintedWidth(ob, ob.ay - 8)).toBeLessThan(paintedWidth(ob, y));
  });

  it('la simulación no se toca', () => {
    // El pase de arte no cambia precios, mantenimiento ni medidas.
    expect([UNIQUES.obelisco.cost, UNIQUES.obelisco.upkeep]).toEqual([9000, 180]);
    expect([UNIQUES.obelisco.w, UNIQUES.obelisco.h]).toEqual([2, 2]);
  });
});
