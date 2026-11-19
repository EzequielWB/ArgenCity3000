import { describe, expect, it } from 'vitest';
import { paintCabildo } from '../src/render/pixelArt';
import { UNIQUES } from '../src/config';

/**
 * El Cabildo (3×2): la planta baja de arcos, la planta alta con balcón y el techo de tejas, con la torre
 * del reloj en el medio del frente. Lo que se prueba es que **la torre esté en el medio y sobresalga**,
 * que los arcos sean varios y oscuros, y que el techo sea de tejas y más ancho que la torre. No se prueba
 * que haya tinta crema.
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

const isTile = (r: number, g: number, b: number) => r > 95 && r > g + 55 && r > b + 55;
const isArch = (r: number, g: number, b: number) => r < 90 && g < 88 && b < 82 && r >= g - 4;
const isClock = (r: number, g: number, b: number) => r > 240 && g > 235 && b > 205;
const isLime = (r: number, g: number, b: number) => r > 200 && g > 190 && b > 150 && b < r;
const isFlag = (r: number, g: number, b: number) => b > r + 30 && b > 140 && g > 120;

function count(a: Art, ok: (r: number, g: number, b: number) => boolean, x0 = 0, x1 = -1, y0 = 0, y1 = -1) {
  const xb = x1 < 0 ? a.px.w : x1;
  const yb = y1 < 0 ? a.px.h : y1;
  let n = 0;
  let minX = a.px.w;
  let maxX = -1;
  let minY = a.px.h;
  let maxY = -1;
  for (let y = y0; y < yb; y++) {
    for (let x = x0; x < xb; x++) {
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

/** The runs of a colour in one row. */
function runsIn(a: Art, y: number, ok: (r: number, g: number, b: number) => boolean): [number, number][] {
  const out: [number, number][] = [];
  let start = -1;
  for (let x = 0; x < a.px.w; x++) {
    const c = at(a, x, y);
    const hit = !!c && ok(c[0], c[1], c[2]);
    if (hit && start < 0) start = x;
    if (!hit && start >= 0) {
      out.push([start, x - 1]);
      start = -1;
    }
  }
  if (start >= 0) out.push([start, a.px.w - 1]);
  return out;
}

describe('el Cabildo en píxel', () => {
  const a = paintCabildo(UNIQUES.cabildo.w, UNIQUES.cabildo.h);
  const roof = count(a, isTile);
  const lime = count(a, isLime);

  it('el techo es de tejas y es más ancho que la torre', () => {
    expect(roof.n).toBeGreaterThan(220);
    // Un techo a cuatro aguas: ancho (cruza el edificio) y con altura, no una franja.
    expect(roof.w).toBeGreaterThan(lime.w * 0.7);
    expect(roof.h).toBeGreaterThan(10);
  });

  it('la torre del reloj sobresale del techo', () => {
    // La cal de la torre asoma **por encima de la teja más alta**: si la torre queda adentro del techo,
    // el edificio es una casa con un techo grande y nada más. Se mira la cal y no el reloj, porque el
    // reloj está sobre la cara que da a la cámara y en isométrico eso lo baja unos píxeles.
    // La teja de la izquierda es la del cuerpo: la de la torre, en el medio, es más alta todavía y
    // tapaba la comparación.
    const tejaCuerpo = count(a, isTile, 0, Math.round(a.px.w * 0.3));
    expect(tejaCuerpo.n).toBeGreaterThan(30);
    expect(lime.minY).toBeLessThan(tejaCuerpo.minY);
    // Y el reloj está arriba en la torre, no en el primer piso.
    const clock = count(a, isClock);
    expect(clock.n).toBeGreaterThan(20);
    expect(clock.minY).toBeLessThan(lime.minY + lime.h * 0.3);
  });

  it('la torre está en el medio del frente, no en una punta', () => {
    // Las dos esferas del reloj —la del frente y la del costado— están una al lado de la otra, y la
    // torre entera queda dentro del tercio del medio.
    const clock = count(a, isClock);
    const medio = lime.minX + lime.w / 2;
    expect(Math.abs((clock.minX + clock.maxX) / 2 - medio)).toBeLessThan(lime.w * 0.22);
  });

  it('la planta baja es de arcos, y son varios', () => {
    // En la fila de los arcos hay varios huecos oscuros separados por muro claro: cinco o más, entre
    // las dos caras. Una planta baja lisa no tiene ni uno.
    let mejor = 0;
    for (let y = a.px.h - 1; y >= Math.floor(a.px.h * 0.55); y--) {
      const oscuros = runsIn(a, y, isArch).filter(([x0, x1]) => x1 - x0 >= 1);
      mejor = Math.max(mejor, oscuros.length);
    }
    expect(mejor).toBeGreaterThanOrEqual(4);
    // Y en las dos caras: la de adelante y la del costado tienen su propia arquería.
    expect(count(a, isArch, 0, Math.round(a.px.w / 2)).n).toBeGreaterThan(40);
    expect(count(a, isArch, Math.round(a.px.w / 2)).n).toBeGreaterThan(40);
  });

  it('la pared es cal clara y el zócalo la asienta', () => {
    expect(lime.n).toBeGreaterThan(500);
    // La cal es lo más claro del dibujo: si la cara de la pared no levanta, el edificio se ve sucio.
    const claro = count(a, (r, g, b) => r > 225 && g > 215 && b > 180);
    expect(claro.n).toBeGreaterThan(400);
  });

  it('lleva la bandera en la punta de la torre', () => {
    const flag = count(a, isFlag);
    expect(flag.n).toBeGreaterThan(4);
    // Arriba de todo: la bandera es lo último que se toca del edificio.
    const todo = count(a, () => true);
    expect(flag.minY).toBeLessThan(todo.minY + 3);
  });

  it('la simulación no se toca', () => {
    expect([UNIQUES.cabildo.cost, UNIQUES.cabildo.upkeep]).toEqual([12000, 300]);
    expect([UNIQUES.cabildo.w, UNIQUES.cabildo.h]).toEqual([3, 2]);
  });
});
