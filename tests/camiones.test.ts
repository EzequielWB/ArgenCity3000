import { describe, expect, it } from 'vitest';
import { CROPS } from '../src/config';
import { roadVehicle, truckVehicle, type Heading } from '../src/render/vehicleArt';
import { Trucks } from '../src/render/trucks';
import { truckNetwork } from '../src/world/farms';
import { TILE, World } from '../src/world/world';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { applyPlan, dragCells, planTool } from '../src/world/tools';

const N = 32;
const HARVEST = CROPS.trigo.harvest;

const flat = (): Terrain => ({ n: N + 1, corners: new Uint8Array((N + 1) * (N + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(N * N) });

/** El campo de la ficha de prueba: lotes, silo, feria y la calle que los une. */
function campo(farms: number, calle = true): World {
  const w = new World(flat());
  const plan = (tool: Parameters<typeof planTool>[1], ax: number, ay: number, bx = ax, by = ay) =>
    applyPlan(w, planTool(w, tool, dragCells(tool, ax, ay, bx, by, 1, N)));
  for (let k = 0; k < farms; k++) plan('farm', 2 + k * 3, 2);
  plan('silo', 20, 2);
  plan('market', 24, 2);
  if (calle) {
    for (let r = 0; r < Math.ceil(farms / 10); r++) plan('road', 1, 4 + r * 3, 19, 4 + r * 3);
    plan('road', 19, 5, 19, 3);
    plan('road', 19, 3, 26, 3);
  }
  return w;
}

const opaque = (px: { data: Uint8ClampedArray }): number => {
  let n = 0;
  for (let i = 3; i < px.data.length; i += 4) if (px.data[i]) n++;
  return n;
};

describe('la camioneta en pixel', () => {
  it('se dibuja distinta para cada rumbo, pinta algo y no es un auto', () => {
    const drawn = [0, 1, 2, 3].map((d) => Array.from(truckVehicle(d as Heading).px.data).join(','));
    expect(new Set(drawn).size).toBe(4);
    expect(Array.from(truckVehicle(0 as Heading).px.data).join(',')).not.toBe(Array.from(roadVehicle('car', 0, 0).px.data).join(','));
    for (const d of [0, 1, 2, 3] as const) expect(opaque(truckVehicle(d).px)).toBeGreaterThan(20);
  });
});

describe('las camionetas del campo', () => {
  it('sólo andan en el mes de cosecha, y una por lote servido', () => {
    const w = campo(2);
    const t = new Trucks(w, 5);
    t.refresh(7);
    expect(t.list).toHaveLength(0);
    t.refresh(HARVEST);
    expect(t.list.length).toBeGreaterThanOrEqual(2);
  });

  it('cada camioneta arranca en la calle junto a su lote, dentro de la red del camión', () => {
    const w = campo(2);
    const t = new Trucks(w, 5);
    t.refresh(HARVEST);
    const net = truckNetwork(w);
    expect(t.list).toHaveLength(2);
    for (const c of t.list) {
      expect(w.tiles[w.idx(c.x, c.y)]).toBe(TILE.ROAD);
      expect(net[w.idx(c.x, c.y)]).toBe(1);
    }
  });

  it('van a la cadena y vuelven al lote, siempre por la red', () => {
    const w = campo(2);
    const t = new Trucks(w, 5);
    t.refresh(HARVEST);
    const net = truckNetwork(w);
    const at = (c: { x: number; y: number }) => t.dist[w.idx(c.x, c.y)];
    const start = t.list[0]!;
    const homeDist = at(start);
    expect(homeDist).toBeGreaterThan(0);
    // Avanza hasta la cadena: la distancia baja hasta cero.
    for (let k = 0; k < 2000 && at(t.list[0]!) !== 0; k++) t.update(0.1);
    expect(at(t.list[0]!)).toBe(0);
    // Y vuelve hacia su lote: el ciclo de ida y vuelta la trae a casa y nunca la suelta de la red.
    let lejos = 0;
    for (let k = 0; k < 2000; k++) {
      t.update(0.1);
      lejos = Math.max(lejos, at(t.list[0]!));
    }
    expect(lejos).toBe(homeDist);
    expect(net[w.idx(t.list[0]!.x, t.list[0]!.y)]).toBe(1);
  });

  it('sin camino no hay camionetas, aunque sea cosecha', () => {
    const w = campo(2, false);
    const t = new Trucks(w, 5);
    t.refresh(HARVEST);
    expect(t.list).toHaveLength(0);
  });
});
