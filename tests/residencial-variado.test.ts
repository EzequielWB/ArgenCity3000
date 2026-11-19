import { describe, expect, it } from 'vitest';
import { paintResidential } from '../src/render/pixelArt';

/**
 * La torre del último nivel: **cuatro modelos**, no un modelo con ocho colores. Lo que se prueba es la
 * silueta, que es lo que se ve a 1× en el mapa: el podio que entra y sale, los tres escalones, el ala baja
 * y el prisma liso con las franjas verticales. Contar píxeles de tinta no diría nada de eso.
 *
 * Las cuatro variantes 0 a 3 son las cuatro modelos; de la 4 a la 7 se repiten con otra paleta.
 */

type C = [number, number, number];

const art = (v: number) => paintResidential(5, v);

/** El píxel opaco de la columna: la sombra del lote queda afuera, que si no el borde es la sombra. */
const at = (a: ReturnType<typeof art>, x: number, y: number): C | null => {
  if (x < 0 || y < 0 || x >= a.px.w || y >= a.px.h) return null;
  const i = (y * a.px.w + x) * 4;
  if (a.px.data[i + 3] < 200) return null;
  return [a.px.data[i], a.px.data[i + 1], a.px.data[i + 2]];
};

const median = (v: number[]): number => {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

interface Profile {
  /** Anchura y centro de cada fila pintada, de arriba abajo. */
  width: number[];
  cx: number[];
  /** La primera y la última fila con algo. */
  y0: number;
  y1: number;
}

function profile(a: ReturnType<typeof art>): Profile {
  const width: number[] = [];
  const cx: number[] = [];
  let y0 = -1;
  let y1 = -1;
  for (let y = 0; y < a.px.h; y++) {
    let mn = a.px.w;
    let mx = -1;
    for (let x = 0; x < a.px.w; x++) {
      if (!at(a, x, y)) continue;
      mn = Math.min(mn, x);
      mx = Math.max(mx, x);
    }
    if (mx < 0) continue;
    if (y0 < 0) y0 = y;
    y1 = y;
    width.push(mx - mn + 1);
    cx.push((mn + mx) / 2);
  }
  return { width, cx, y0, y1 };
}

/** Las bandas de arriba y de abajo del edificio: el fuste y el cuerpo bajo. */
const bands = (p: Profile) => {
  const n = p.width.length;
  return {
    top: p.width.slice(Math.round(n * 0.12), Math.round(n * 0.32)),
    low: p.width.slice(Math.round(n * 0.75), Math.round(n * 0.95)),
    cxTop: p.cx.slice(Math.round(n * 0.12), Math.round(n * 0.32)),
    cxLow: p.cx.slice(Math.round(n * 0.75), Math.round(n * 0.95)),
  };
};

/** Cuántas veces el fuste es más angosto que el cuerpo de abajo: 1 es un prisma, 0.35 una escalera. */
function slenderness(v: number): number {
  const b = bands(profile(art(v)));
  return median(b.top) / median(b.low);
}

/** Cuánto se corre el eje de la torre respecto del cuerpo de abajo, en píxeles. */
function offset(v: number): number {
  const b = bands(profile(art(v)));
  return Math.abs(median(b.cxTop) - median(b.cxLow));
}

/** Tiradas de vidrio en una fila: con franjas verticales hay varias, con una cinta horizontal una sola. */
function glassRuns(v: number, y: number): number {
  const a = art(v);
  const isGlass = (c: C) => c[2] > c[0] + 20 && c[2] > 90 && c[2] < 215;
  let n = 0;
  let prev = false;
  for (let x = 0; x < a.px.w; x++) {
    const c = at(a, x, y);
    const g = !!c && isGlass(c);
    if (g && !prev) n++;
    prev = g;
  }
  return n;
}

const masks = [0, 1, 2, 3].map((v) => {
  const a = art(v);
  const m: number[] = [];
  for (let i = 3; i < a.px.data.length; i += 4) m.push(a.px.data[i] > 200 ? 1 : 0);
  return m.join('');
});

describe('la torre del último nivel: cuatro modelos', () => {
  it('son cuatro siluetas distintas, no un modelo con cuatro colores', () => {
    // La prueba de que hay variedad de modelos y no de paletas: cambia la **forma**, no el tono.
    expect(new Set(masks).size).toBe(4);
  });

  it('el podio: el fuste se apoya en un basamento ancho, centrado', () => {
    // La torre clásica: dos plantas de basamento, el fuste esbelto encima y las dos caras en el eje.
    expect(slenderness(0)).toBeGreaterThan(0.6);
    expect(slenderness(0)).toBeLessThan(0.8);
    expect(offset(0)).toBeLessThan(2);
  });

  it('los escalones: el fuste no llega ni a la mitad del cuerpo bajo', () => {
    // Tres cuerpos que se achican en altura. Si el de arriba midiera la mitad, sería otra vez el podio.
    expect(slenderness(1)).toBeLessThan(0.5);
    expect(offset(1)).toBeLessThan(2);
  });

  it('la torre con ala baja: el fuste no está sobre el eje del ala', () => {
    // La ele se lee porque la torre va sobre la esquina del fondo y el ala cruza el frente: si estuvieran
    // una encima de la otra sería el modelo del podio.
    expect(offset(2)).toBeGreaterThan(3);
    expect(slenderness(2)).toBeLessThan(0.75);
  });

  it('el prisma de franjas verticales: liso de abajo arriba y con el vidrio en columnas', () => {
    // El prisma toma casi todo el lote, así que el fuste mide lo mismo que el zócalo.
    expect(slenderness(3)).toBeGreaterThan(0.85);
    // Y la fachada es una tabiquería: en una fila del fuste hay tres columnas de vidrio o más. Una cinta
    // horizontal da **una sola** tirada, y así se distingue la franja vertical de la cinta.
    const p = profile(art(3));
    const mid = p.y0 + Math.round((p.y1 - p.y0) * 0.45);
    expect(glassRuns(3, mid)).toBeGreaterThanOrEqual(3);
    expect(glassRuns(0, p.y0 + Math.round((p.y1 - p.y0) * 0.45))).toBeLessThanOrEqual(2);
  });

  it('los cuatro llevan su remate y ninguno repite la paleta del mismo modelo', () => {
    for (const v of [0, 1, 2, 3]) {
      const a = art(v);
      const p = profile(a);
      // Arriba de todo hay algo por encima del último piso: el tanque, la sala de máquinas o la antena.
      expect(p.y1 - p.y0, `variant ${v}`).toBeGreaterThan(40);
      // Y el mismo modelo con la otra paleta no trae los mismos colores.
      const palette = (k: number) => {
        const b = art(k);
        const set = new Set<string>();
        for (let i = 0; i < b.px.data.length; i += 4) {
          if (b.px.data[i + 3] < 200) continue;
          set.add(`${b.px.data[i]},${b.px.data[i + 1]},${b.px.data[i + 2]}`);
        }
        return set;
      };
      const a0 = palette(v);
      const a4 = palette(v + 4);
      expect([...a0].filter((c) => !a4.has(c)).length, `variant ${v} y ${v + 4}`).toBeGreaterThan(4);
    }
  });
});
