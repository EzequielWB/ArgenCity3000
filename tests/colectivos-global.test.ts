import { describe, expect, it } from 'vitest';
import { BUS } from '../src/config';
import { applyTransit } from '../src/sim/transit';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { TILE, World } from '../src/world/world';
import { busFootprint } from '../src/world/tools';
import { packBusLine } from '../src/world/transport';

function flat(n = 48): Terrain {
  const s = n + 1;
  return { n, corners: new Uint8Array(s * s).fill(SEA_LEVEL + 1), trees: new Uint8Array(n * n) };
}

function road(w: World, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) w.setTile(x, y, TILE.ROAD);
}

/** Ocho torres al oeste de una calle larga por y = 10 y una fábrica al este: calle saturada. */
function commuterTown(): World {
  const w = new World(flat());
  road(w, 0, 10, 30, 10);
  for (let x = 0; x < 8; x++) w.setTile(x, 9, TILE.R, 5);
  w.setTile(30, 9, TILE.I, 2);
  return w;
}

function depot(w: World, x: number, y: number, number = 60): void {
  for (const [cx, cy] of busFootprint(w.n, x, y)) {
    w.setTile(cx, cy, TILE.BUS);
    w.busLine[w.idx(cx, cy)] = packBusLine(0, number);
  }
}

function loaded(w: World, perCell: number): Float32Array {
  const load = new Float32Array(w.n * w.n);
  for (let i = 0; i < load.length; i++) if (w.tiles[i] === TILE.ROAD) load[i] = perCell;
  return load;
}

describe('el alivio de los colectivos es global', () => {
  it('alivia calles lejos de la cochera, también en la esquina opuesta', () => {
    const w = new World(flat());
    road(w, 0, 10, 40, 10);
    depot(w, 2, 8); // cochera al oeste
    const load = new Float32Array(w.n * w.n);
    load[w.idx(40, 10)] = 1000; // la única calle cargada está a 38 lotes, afuera de cualquier rombo viejo
    applyTransit(w, load, 100);
    expect(load[w.idx(40, 10)]).toBeCloseTo(500, 5);
  });

  it('la población pone el techo: mil vecinos y diez líneas alivian menos de una línea entera', () => {
    const w = commuterTown();
    depot(w, 15, 8);
    const residents = 1280; // 8 torres de nivel 5
    const ceiling = residents * BUS.share;
    const tenLines = loaded(w, 9000);
    // Un presupuesto de 500 % y diez líneas no pasan del techo de la población.
    const taken = applyTransit(w, tenLines, 500, residents).taken;
    expect(taken).toBeCloseTo(ceiling, 5);
    expect(taken).toBeLessThan(BUS.trips); // menos que UNA línea sin techo
  });

  it('dos líneas alivian el doble que una cuando el techo no actúa', () => {
    const w = commuterTown();
    depot(w, 15, 8, 60);
    const one = applyTransit(w, loaded(w, 9000), 100).taken;
    depot(w, 14, 8, 61);
    const two = applyTransit(w, loaded(w, 9000), 100).taken;
    expect(two).toBeCloseTo(2 * one, 5);
  });

  it('el alivio baja cada calle por el mismo porcentaje, no un número fijo', () => {
    const w = commuterTown();
    depot(w, 15, 8);
    const load = loaded(w, 9000);
    const total = Array.from(load).reduce((a, b) => a + b, 0);
    const relief = Math.min(BUS.trips, 1280 * BUS.share);
    const expectedKeep = 1 - relief / total;
    applyTransit(w, load, 100, 1280);
    for (let i = 0; i < load.length; i++) {
      if (w.tiles[i] !== TILE.ROAD) continue;
      expect(load[i]).toBeCloseTo(9000 * expectedKeep, 1);
    }
  });
});
