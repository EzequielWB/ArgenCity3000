import { describe, expect, it } from 'vitest';
import { describeCell } from '../src/sim/report';
import { Simulation, newSimState } from '../src/sim/simulation';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { TILE, World } from '../src/world/world';

function flat(n = 32): Terrain {
  const s = n + 1;
  return { n, corners: new Uint8Array(s * s).fill(SEA_LEVEL + 1), trees: new Uint8Array(n * n) };
}

/** A plant, a street and one empty lot of each zone, all lit and on the street. */
function town(): World {
  const w = new World(flat());
  for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) w.setTile(4 + dx, 4 + dy, TILE.PLANT);
  w.plants.push({ x: 4, y: 4, kind: 'coal' });
  for (let x = 0; x < 20; x++) w.setTile(x, 7, TILE.ROAD);
  w.setTile(4, 6, TILE.R);
  w.setTile(5, 6, TILE.C);
  w.setTile(6, 6, TILE.I);
  return w;
}

const hintAt = (w: World, sim: Simulation, x: number) => describeCell(w, sim, x, 6).hint ?? '';

describe('why the city stopped growing', () => {
  it('reports nothing while the city attracts people', () => {
    const sim = new Simulation(town(), newSimState(1), 'Prueba');
    expect(sim.stall).toBeNull();
    expect(sim.stallText()).toBeNull();
  });

  it('blames high taxes in the lot card, instead of sending the lot to wait for jobs', () => {
    const w = town();
    for (let x = 8; x < 20; x++) w.setTile(x, 8, TILE.R, 2); // 72 residents and no jobs: little pull left
    const sim = new Simulation(w, newSimState(1), 'Prueba');
    sim.setTax(20);
    expect(sim.stall).toBe('taxes');
    expect(sim.stallText()).toMatch(/impuestos/i);
    expect(sim.demand.R).toBeLessThanOrEqual(0);
    expect(hintAt(w, sim, 4)).toMatch(/impuestos/i);
    expect(hintAt(w, sim, 4)).not.toMatch(/trabajos/i);
  });

  it('blames blackouts when the plant cannot keep up', () => {
    const w = town();
    for (let x = 8; x < 20; x++) for (const y of [5, 6, 8]) w.setTile(x, y, TILE.I, 5); // 36 factories × 20 MW
    const sim = new Simulation(w, newSimState(1), 'Prueba');
    expect(sim.power.shortage).toBe(true);
    expect(sim.stall).toBe('shortage');
    expect(sim.stallText()).toMatch(/apagones/i);
  });

  it('blames abandonment when too many buildings stand empty', () => {
    const w = town();
    for (let x = 8; x < 20; x++) for (const y of [6, 8]) w.setTile(x, y, TILE.R, 2); // 24 homes
    for (let x = 8; x < 12; x++) w.abandoned[w.idx(x, 6)] = 1; // 4 of them empty: over 5 %
    const sim = new Simulation(w, newSimState(1), 'Prueba');
    expect(sim.stall).toBe('blight');
    expect(sim.stallText()).toMatch(/abandonad/i);
  });

  it('blames the tax of one zone when only that zone is taxed out of demand', () => {
    const w = town();
    w.setTile(8, 6, TILE.C, 2);
    w.setTile(9, 6, TILE.C, 2); // 8 commerce jobs: a little demand left at the usual tax
    const sim = new Simulation(w, newSimState(1), 'Prueba');
    sim.setTax(20, 'C'); // the average stays at 9 or less only if the others are low
    sim.setTax(3, 'R');
    sim.setTax(3, 'I');
    expect(sim.stall).toBeNull();
    expect(sim.demand.C).toBeLessThanOrEqual(0);
    expect(hintAt(w, sim, 5)).toMatch(/impuesto comercial.*20 %/i);
  });
});
