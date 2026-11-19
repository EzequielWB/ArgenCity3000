import { describe, expect, it } from 'vitest';
import { paintSantuario } from '../src/render/pixelArt';
import { UNIQUES } from '../src/config';

/**
 * El Santuario (3×4): **la basílica de Luján, que termina en dos puntas**. Ladrillo a la vista, la nave
 * larga con techo de pizarra yendo para atrás, y el frente con las dos torres y sus agujas, el rosetón en
 * el medio y el portal abajo.
 *
 * Lo que se prueba es la silueta y la planta: **dos** agujas que se recortan contra el cielo —no una
 * contra la pizarra del techo—, ladrillo separado de pizarra, y el rosetón entre las dos torres.
 */

type C = [number, number, number];

const a = paintSantuario(3, 4);

const at = (x: number, y: number): C | null => {
  if (x < 0 || y < 0 || x >= a.px.w || y >= a.px.h) return null;
  const i = (y * a.px.w + x) * 4;
  if (!a.px.data[i + 3]) return null;
  return [a.px.data[i], a.px.data[i + 1], a.px.data[i + 2]];
};

/** El ladrillo: rojo, cálido y oscuro. */
const isBrick = (r: number, g: number, b: number) => r > 100 && r > g + 25 && g > b - 5 && b < 130;
/** La pizarra: gris frío. */
const isSlate = (r: number, g: number, b: number) => Math.abs(r - b) < 22 && b >= r - 4 && r > 70 && r < 190 && Math.abs(r - g) < 14;
/** El vidrio del rosetón: azul. */
const isRose = (r: number, _g: number, b: number) => b > r + 30 && r < 110 && b > 95;
/** El oro de las campanas. */
const isGold = (r: number, g: number, b: number) => r > 175 && g > 135 && b < 125;
/** La madera del portal. */
const isDoor = (r: number, g: number, b: number) => r > 50 && r < 135 && r > g + 6 && g > b + 3 && b < 90;

function count(ok: (r: number, g: number, b: number) => boolean): { n: number; cx: number; cy: number } {
  let n = 0;
  let sx = 0;
  let sy = 0;
  for (let y = 0; y < a.px.h; y++) for (let x = 0; x < a.px.w; x++) {
    const c = at(x, y);
    if (!c || !ok(c[0], c[1], c[2])) continue;
    n++;
    sx += x;
    sy += y;
  }
  return { n, cx: n ? sx / n : 0, cy: n ? sy / n : 0 };
}

/** El píxel pintado más alto de una columna, y el más alto de pizarra. */
function colTop(x: number, ok: (r: number, g: number, b: number) => boolean = () => true): number {
  for (let y = 0; y < a.px.h; y++) {
    const c = at(x, y);
    if (c && ok(c[0], c[1], c[2])) return y;
  }
  return a.px.h;
}

/**
 * Las dos torres, cada una por su campana: el grupo de columnas con oro y su centro. La campana de la torre
 * se ve en las dos caras, así que el grupo es ancho y su centro cae sobre el eje de la torre.
 */
function towers(): { x: number; top: number }[] {
  const grupos: number[][] = [];
  for (let x = 0; x < a.px.w; x++) {
    let gold = false;
    for (let y = 0; y < a.px.h && !gold; y++) {
      const c = at(x, y);
      gold = !!c && isGold(c[0], c[1], c[2]);
    }
    if (!gold) continue;
    const g = grupos.at(-1);
    if (g && x - g[g.length - 1] <= 10) g.push(x);
    else grupos.push([x]);
  }
  return grupos.map((g) => {
    const x = Math.round(g.reduce((s, v) => s + v, 0) / g.length);
    return { x, top: colTop(x) };
  });
}

describe('el Santuario en píxel', () => {
  it('tiene dos torres, cada una con su campana', () => {
    const t = towers();
    expect(t.length).toBe(2);
    // Y las dos torres están a los lados del frente, no pegadas en el medio.
    expect(t[1].x - t[0].x).toBeGreaterThan(18);
  });

  it('las dos agujas se recortan contra el cielo, no contra el techo', () => {
    // Esta es la prueba que importa: con la nave dibujada a lo ancho, la aguja de la derecha queda adentro
    // de la silueta del techo y el edificio se lee con **una** punta. Se pide cielo despejado arriba de
    // cada aguja, que es lo que lo hace una basílica de dos torres.
    for (const { x: gx, top: tip } of towers()) {
      // La aguja sube por **encima del techo**: aunque no se recorte contra el cielo, tiene que pasar la
      // pizarra. Es la diferencia entre una basílica de dos torres y una torre con un techo al lado.
      const techo = colTop(gx, isSlate);
      expect(tip).toBeLessThan(techo - 3);
      // Y arriba de la punta no hay nada: cielo despejado.
      let sky = 0;
      for (let y = tip - 1; y >= 0 && !at(gx, y); y--) sky++;
      expect(sky).toBeGreaterThan(2);
      // Y la aguja es una aguja: angosta arriba y más ancha abajo. (Contar la fila entera no sirve: a esa
      // altura también está el techo, así que se mide la corrida alrededor de la columna de la torre.)
      // La aguja es una aguja: angosta arriba de todo y más ancha doce píxeles abajo.
      const runAt = (y: number): number => {
        let w = 1;
        for (let x = gx - 1; x >= 0 && at(x, y); x--) w++;
        for (let x = gx + 1; x < a.px.w && at(x, y); x++) w++;
        return w;
      };
      expect(runAt(tip + 14)).toBeGreaterThan(runAt(tip + 2));
    }
  });

  it('es de ladrillo a la vista con el techo de pizarra, y la pizarra va arriba', () => {
    const brick = count(isBrick);
    const slate = count(isSlate);
    expect(brick.n).toBeGreaterThan(1200);
    expect(slate.n).toBeGreaterThan(800);
    expect(slate.cy).toBeLessThan(brick.cy);
  });

  it('el rosetón es una rueda de vidrio entre las dos torres', () => {
    const rose = count(isRose);
    expect(rose.n).toBeGreaterThan(14);
    const t = towers();
    expect(rose.cx).toBeGreaterThan(t[0].x);
    expect(rose.cx).toBeLessThan(t[1].x);
    // Y va en el medio del frente, entre las dos torres.
    expect(Math.abs(rose.cx - (t[0].x + t[1].x) / 2)).toBeLessThan(12);
  });

  it('el portal es ancho: una basílica abre con una puerta grande', () => {
    let widest = 0;
    for (let y = Math.floor(a.px.h * 0.68); y < a.px.h; y++) {
      let run = 0;
      for (let x = 0; x <= a.px.w; x++) {
        const c = x < a.px.w ? at(x, y) : null;
        if (c && isDoor(c[0], c[1], c[2])) run++;
        else {
          widest = Math.max(widest, run);
          run = 0;
        }
      }
    }
    expect(widest).toBeGreaterThan(8);
  });

  it('la simulación no se toca', () => {
    expect([UNIQUES.santuario.cost, UNIQUES.santuario.upkeep]).toEqual([13000, 300]);
    expect([UNIQUES.santuario.w, UNIQUES.santuario.h]).toEqual([3, 4]);
    expect(UNIQUES.santuario.favor).toEqual({ perMonth: 2, peak: 4 });
  });
});
