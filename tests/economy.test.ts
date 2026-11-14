import { describe, expect, it } from 'vitest';
import { DEFAULT_FUNDING, FIXED_SHARE, MAX_FUNDING, MAX_TAX, SERVICES, TICKS_PER_MONTH, type ServiceKind } from '../src/config';
import { SAVE_VERSION, deserialize, serialize } from '../src/save/save';
import { monthlyBudget } from '../src/sim/budget';
import { computeDemand } from '../src/sim/demand';
import { computeServices, residentsServed } from '../src/sim/fields';
import { headlinesFor, type CitySnapshot } from '../src/sim/news';
import { computePower } from '../src/sim/power';
import { Simulation, newSimState } from '../src/sim/simulation';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { applyPlan, dragCells, planTool, type ToolId } from '../src/world/tools';
import { TILE, World } from '../src/world/world';

function flat(n = 32): Terrain {
  const s = n + 1;
  return { n, corners: new Uint8Array(s * s).fill(SEA_LEVEL + 1), trees: new Uint8Array(n * n) };
}

function build(w: World, tool: ToolId, ax: number, ay: number, bx = ax, by = ay) {
  applyPlan(w, planTool(w, tool, dragCells(tool, ax, ay, bx, by, 1, w.n)));
}

/** A small powered town with homes, shops and workshops, and one of each service. */
function town(): World {
  const w = new World(flat());
  build(w, 'plant', 0, 0);
  build(w, 'road', 2, 0, 2, 31);
  build(w, 'zoneR', 3, 0, 10, 9);
  build(w, 'zoneC', 3, 10, 10, 14);
  build(w, 'zoneI', 3, 15, 10, 20);
  for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] >= TILE.R && w.tiles[i] <= TILE.I) w.level[i] = 2;
  // Next to the zones, which carry the power.
  build(w, 'school', 11, 5);
  build(w, 'clinic', 11, 7);
  build(w, 'police', 11, 9);
  build(w, 'fire', 11, 11);
  return w;
}

const even = (v: number) => ({ R: v, C: v, I: v });
const fullFunding = { ...DEFAULT_FUNDING };

describe('taxes per zone', () => {
  it('move only the demand of their own zone', () => {
    const t = { pop: 1000, cJobs: 200, iJobs: 300 };
    const base = computeDemand(t, even(7));
    const pricey = computeDemand(t, { R: 7, C: 15, I: 7 });
    expect(pricey.C).toBeLessThan(base.C);
    expect(pricey.R).toBe(base.R);
    expect(pricey.I).toBe(base.I);
  });

  it('collect from their own zone only', () => {
    const w = town();
    const base = monthlyBudget(w, even(7), fullFunding);
    const r = monthlyBudget(w, { R: 14, C: 7, I: 7 }, fullFunding);
    expect(r.taxR).toBeGreaterThan(base.taxR);
    expect(r.taxC).toBe(base.taxC);
    expect(r.taxI).toBe(base.taxI);
    expect(r.income).toBe(r.taxR + r.taxC + r.taxI);
  });

  it('can be set one zone at a time, or all at once, within the limits', () => {
    const sim = new Simulation(new World(flat()), newSimState(1), 'X');
    sim.setTax(12, 'C');
    expect(sim.state.taxes).toEqual({ R: 7, C: 12, I: 7 });
    sim.setTax(99, 'I');
    expect(sim.state.taxes.I).toBe(MAX_TAX);
    sim.setTax(4);
    expect(sim.state.taxes).toEqual(even(4));
  });
});

/** The upkeep a service of the town costs at `percent` funding: its use-based cost times the funding share. */
function upkeepAt(w: World, kind: ServiceKind, x: number, y: number, percent: number): number {
  const use = Math.min(1, residentsServed(w, w.idx(x, y), kind) / SERVICES[kind].capacity);
  return Math.round((SERVICES[kind].upkeep * (FIXED_SHARE + (1 - FIXED_SHARE) * use) * percent) / 100);
}

describe('service funding', () => {
  it('costs its share of the upkeep', () => {
    const w = town();
    const half = monthlyBudget(w, even(7), { ...fullFunding, school: 50, police: 0 });
    expect(half.schools).toBe(upkeepAt(w, 'school', 11, 5, 50));
    expect(half.schools).toBeLessThan(Math.round(SERVICES.school.upkeep / 2));
    expect(half.police).toBe(0);
    expect(half.clinics).toBe(upkeepAt(w, 'clinic', 11, 7, 100));
    expect(half.expenses).toBe(half.roads + half.lines + half.parks + half.plants + half.services + half.schools + half.clinics + half.police + half.firefighters);
  });

  it('gives its share of the coverage', () => {
    const w = town();
    computePower(w);
    computeServices(w, fullFunding);
    const full = w.edu[w.idx(11, 5)];
    computeServices(w, { ...fullFunding, school: 50 });
    const half = w.edu[w.idx(11, 5)];
    computeServices(w, { ...fullFunding, school: 0 });
    expect(full).toBe(100);
    expect(half).toBe(50);
    expect(w.edu[w.idx(11, 5)]).toBe(0);
    expect(w.health[w.idx(11, 7)]).toBe(100);
  });

  it('is set per service and kept between 0 and the maximum', () => {
    const sim = new Simulation(town(), newSimState(1), 'X');
    sim.setFunding('fire', 60);
    expect(sim.state.funding.fire).toBe(60);
    sim.setFunding('school', 500);
    expect(sim.state.funding.school).toBe(MAX_FUNDING);
    sim.setFunding('clinic', -3);
    expect(sim.state.funding.clinic).toBe(0);
    // The coverage follows right away, without waiting for the monthly refresh.
    sim.setFunding('school', 0);
    expect(sim.world.edu[sim.world.idx(11, 5)]).toBe(0);
  });

  it('is charged at the end of the month', () => {
    const sim = new Simulation(town(), newSimState(1), 'X');
    sim.setFunding('school', 50);
    for (let i = 0; i < TICKS_PER_MONTH; i++) sim.tick();
    expect(sim.state.lastBudget!.schools).toBe(upkeepAt(sim.world, 'school', 11, 5, 50));
  });
});

describe('the newspaper', () => {
  const base: CitySnapshot = {
    pop: 100,
    buildings: 10,
    plants: 1,
    shortage: false,
    crisis: false,
    taxes: even(7),
    funding: { ...fullFunding },
    green: 100,
    month: 3,
    year: 1990,
    cash: 1000,
    abandoned: 0,
    loan: null,
    ports: 0,
    resorts: 0,
  };

  it('reports which tax went up or down', () => {
    expect(headlinesFor(base, { ...base, taxes: { R: 9, C: 7, I: 7 } }, 'X').join(' ')).toMatch(/residencial/i);
    expect(headlinesFor(base, { ...base, taxes: { R: 7, C: 7, I: 5 } }, 'X').join(' ')).toMatch(/industrial/i);
    expect(headlinesFor(base, base, 'X').join(' ')).not.toMatch(/impuesto/i);
  });

  it('reports deep cuts to a service', () => {
    expect(headlinesFor(base, { ...base, funding: { ...fullFunding, school: 40 } }, 'X').join(' ')).toMatch(/escuela/i);
    expect(headlinesFor(base, { ...base, funding: { ...fullFunding, school: 90 } }, 'X').join(' ')).not.toMatch(/escuela/i);
  });
});

describe('saves with the new economy', () => {
  it('round-trip taxes and funding', () => {
    const sim = new Simulation(town(), newSimState(1), 'X');
    sim.setTax(11, 'R');
    sim.setFunding('police', 80);
    const back = deserialize(serialize({ name: 'X', seed: 1, world: sim.world, sim: sim.state }));
    expect(back.sim.taxes).toEqual({ R: 11, C: 7, I: 7 });
    expect(back.sim.funding).toEqual({ ...fullFunding, police: 80 });
  });

  it('read older saves with one tax as the same tax for every zone and full funding', () => {
    const sim = new Simulation(town(), newSimState(1), 'X');
    const data = JSON.parse(serialize({ name: 'X', seed: 1, world: sim.world, sim: sim.state }));
    data.version = 2;
    delete data.sim.taxes;
    delete data.sim.funding;
    data.sim.tax = 12;
    const back = deserialize(JSON.stringify(data));
    expect(back.sim.taxes).toEqual(even(12));
    expect(back.sim.funding).toEqual(fullFunding);
  });

  it('reject impossible taxes or funding', () => {
    const sim = new Simulation(town(), newSimState(1), 'X');
    const good = JSON.parse(serialize({ name: 'X', seed: 1, world: sim.world, sim: sim.state }));
    expect(good.version).toBe(SAVE_VERSION);
    const bad1 = structuredClone(good);
    bad1.sim.taxes.C = 50;
    expect(() => deserialize(JSON.stringify(bad1))).toThrow(/impuestos/i);
    const bad2 = structuredClone(good);
    bad2.sim.funding.fire = 500;
    expect(() => deserialize(JSON.stringify(bad2))).toThrow(/presupuesto/i);
  });
});
