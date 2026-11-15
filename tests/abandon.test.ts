import { describe, expect, it } from 'vitest';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { World, TILE } from '../src/world/world';
import { applyPlan, dragCells, planTool, type ToolId } from '../src/world/tools';
import { CAPACITY, TICKS_PER_MONTH } from '../src/config';
import { cityTotals, computeDemand } from '../src/sim/demand';
import { computePower } from '../src/sim/power';
import { computeLandValue, computePollution } from '../src/sim/fields';
import { Simulation, newSimState } from '../src/sim/simulation';
import { deserialize, serialize } from '../src/save/save';

function flat(n = 32): Terrain {
  return { n, corners: new Uint8Array((n + 1) * (n + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(n * n) };
}

function build(w: World, tool: ToolId, ax: number, ay: number, bx = ax, by = ay) {
  applyPlan(w, planTool(w, tool, dragCells(tool, ax, ay, bx, by, 1, w.n)));
}

function starter(): World {
  const w = new World(flat());
  build(w, 'plant', 0, 1);
  build(w, 'road', 0, 3, 31, 3);
  build(w, 'road', 0, 9, 31, 9);
  // Roads carry no light: a power line runs from the plant along the middle row between the zones.
  build(w, 'line', 0, 4, 0, 6);
  build(w, 'line', 1, 6, 31, 6);
  build(w, 'zoneR', 2, 4, 20, 5);
  build(w, 'zoneR', 2, 7, 20, 8);
  build(w, 'zoneI', 22, 4, 31, 8);
  build(w, 'zoneC', 2, 10, 20, 11);
  return w;
}

const countAbandoned = (w: World) => w.abandoned.reduce((a, b) => a + b, 0);

describe('abandoned buildings', () => {
  it('house nobody: no residents, no jobs, no power use', () => {
    const w = new World(flat());
    build(w, 'plant', 0, 0);
    build(w, 'zoneR', 2, 0, 3, 0);
    w.level[w.idx(2, 0)] = 3;
    w.level[w.idx(3, 0)] = 3;
    w.abandoned[w.idx(3, 0)] = 1;
    expect(cityTotals(w).pop).toBe(CAPACITY.R[3]);
    expect(computePower(w).use).toBe(computePower(new World(flat())).use + 3 * 2);
  });

  it('lower the land value around them', () => {
    const w = new World(flat());
    build(w, 'zoneR', 10, 10);
    w.level[w.idx(10, 10)] = 2;
    computePollution(w);
    computeLandValue(w);
    const before = w.landValue[w.idx(11, 10)];
    w.abandoned[w.idx(10, 10)] = 1;
    computeLandValue(w);
    expect(w.landValue[w.idx(11, 10)]).toBeLessThan(before);
  });

  it('are cleared by the bulldozer', () => {
    const w = new World(flat());
    build(w, 'zoneR', 4, 4);
    w.level[w.idx(4, 4)] = 2;
    w.abandoned[w.idx(4, 4)] = 1;
    build(w, 'bulldoze', 4, 4);
    expect(w.abandoned[w.idx(4, 4)]).toBe(0);
  });

  it('appear when a grown city loses its power, and come back when power returns', () => {
    const w = starter();
    const sim = new Simulation(w, newSimState(5), 'X');
    for (let i = 0; i < TICKS_PER_MONTH * 24; i++) sim.tick();
    const pop = cityTotals(w).pop;
    expect(pop).toBeGreaterThan(200);
    build(w, 'bulldoze', 0, 1);
    for (let i = 0; i < TICKS_PER_MONTH * 12; i++) sim.tick();
    const abandoned = countAbandoned(w);
    expect(abandoned).toBeGreaterThan(10);
    expect(cityTotals(w).pop).toBeLessThan(pop);
    // Buildings stay standing (level kept) while abandoned.
    for (let i = 0; i < w.tiles.length; i++) if (w.abandoned[i]) expect(w.level[i]).toBeGreaterThan(0);
    build(w, 'plant', 0, 1);
    for (let i = 0; i < TICKS_PER_MONTH * 18; i++) sim.tick();
    expect(countAbandoned(w)).toBeLessThan(abandoned);
  });
});

describe('conditional growth appetite', () => {
  it('a city without the extra appetite wants less', () => {
    const t = { pop: 1000, cJobs: 170, iJobs: 380 };
    const boom = computeDemand(t, 7, 1.1);
    const flatDemand = computeDemand(t, 7, 1);
    expect(flatDemand.R).toBeLessThan(boom.R);
    expect(flatDemand.C).toBeLessThan(boom.C);
    expect(flatDemand.I).toBeLessThan(boom.I);
  });

  it('turns the appetite off during blackouts and with high taxes', () => {
    const w = new World(flat());
    build(w, 'plant', 0, 0);
    build(w, 'zoneI', 2, 0, 31, 31);
    for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === TILE.I) w.level[i] = 4;
    const sim = new Simulation(w, newSimState(1), 'X');
    expect(sim.power.shortage).toBe(true);
    expect(sim.appetite).toBe(1);

    const ok = new Simulation(new World(flat()), newSimState(1), 'Y');
    expect(ok.appetite).toBeGreaterThan(1);
    ok.setTax(12); // taxes fade the appetite from 9 % and switch it off at 15 %
    expect(ok.appetite).toBeGreaterThan(1);
    expect(ok.appetite).toBeLessThan(sim.appetite + 1);
    ok.setTax(16);
    expect(ok.appetite).toBe(1);
  });
});

describe('save with abandoned buildings', () => {
  it('round-trips the abandoned flags', () => {
    const w = starter();
    w.level[w.idx(3, 4)] = 2;
    w.abandoned[w.idx(3, 4)] = 1;
    const sim = new Simulation(w, newSimState(1), 'X');
    const back = deserialize(serialize({ name: 'X', seed: 1, world: w, sim: sim.state }));
    expect(back.world.abandoned[w.idx(3, 4)]).toBe(1);
  });

  it('still loads saves from the first version', () => {
    const w = starter();
    const sim = new Simulation(w, newSimState(1), 'X');
    const data = JSON.parse(serialize({ name: 'X', seed: 1, world: w, sim: sim.state }));
    data.version = 1;
    delete data.abandoned;
    delete data.fire;
    if (data.sim.lastBudget) delete data.sim.lastBudget.services;
    const back = deserialize(JSON.stringify(data));
    expect(Array.from(back.world.tiles)).toEqual(Array.from(w.tiles));
    expect(countAbandoned(back.world)).toBe(0);
  });
});
