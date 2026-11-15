import { describe, expect, it } from 'vitest';
import { CAPACITY, DEMOLITION, TICKS_PER_MONTH } from '../src/config';
import { headlinesFor, type CitySnapshot } from '../src/sim/news';
import { computeApproval, demolitionPoints } from '../src/sim/politics';
import { Simulation, newSimState } from '../src/sim/simulation';
import { deserialize, serialize } from '../src/save/save';
import { generateTerrain } from '../src/world/terrain';
import { TILE, World } from '../src/world/world';

const N = 32;

function flat(): World {
  return new World({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(30), trees: new Uint8Array(N * N) });
}

/** A world with a strip of built lots of the given zone and level, plus one of each special thing. */
function city(): { world: World; sim: Simulation } {
  const world = new World(generateTerrain(5, N));
  for (let x = 2; x < 12; x++) world.tiles[world.idx(x, 5)] = TILE.R;
  for (let x = 2; x < 8; x++) world.tiles[world.idx(x, 8)] = TILE.C;
  for (let x = 2; x < 8; x++) world.tiles[world.idx(x, 10)] = TILE.I;
  world.tiles[world.idx(20, 5)] = TILE.SCHOOL;
  world.tiles[world.idx(20, 8)] = TILE.PROMENADE;
  world.tiles[world.idx(24, 12)] = TILE.PLANT;
  world.tiles[world.idx(24, 13)] = TILE.PLANT;
  world.tiles[world.idx(25, 12)] = TILE.PLANT;
  world.tiles[world.idx(25, 13)] = TILE.PLANT;
  world.plants.push({ kind: 'coal', x: 24, y: 12 } as never);
  world.level[world.idx(2, 5)] = 4; // 60 residents
  world.level[world.idx(3, 5)] = 3; // 20 residents
  world.level[world.idx(2, 8)] = 3; // 12 jobs
  world.level[world.idx(2, 10)] = 4; // 50 jobs
  const sim = new Simulation(world, newSimState(5), 'Villa Obra');
  return { world, sim };
}

describe('what a demolition costs in people', () => {
  it('counts every resident of a home torn down', () => {
    const { sim } = city();
    expect(sim.noteDemolition([[2, 5]])).toBe(CAPACITY.R[4] * DEMOLITION.resident);
  });

  it('counts jobs at half, because a job hurts less than a roof', () => {
    const { sim } = city();
    expect(sim.noteDemolition([[2, 8]])).toBe(CAPACITY.C[3] * DEMOLITION.job);
    expect(sim.noteDemolition([[2, 10]])).toBe(CAPACITY.I[4] * DEMOLITION.job);
  });

  it('counts a public work or a plant as one big hit, however many cells it has', () => {
    const { sim } = city();
    expect(sim.noteDemolition([[20, 5]])).toBe(DEMOLITION.work); // a school
    expect(sim.noteDemolition([[20, 8]])).toBe(DEMOLITION.work); // the promenade
    // The plant covers four cells and must count once.
    expect(sim.noteDemolition([[24, 12], [25, 12], [24, 13], [25, 13]])).toBe(DEMOLITION.plant);
  });

  it('counts nothing for empty lots, ruins and fires', () => {
    const { world, sim } = city();
    world.level[world.idx(4, 5)] = 0; // an empty zoned lot
    expect(sim.noteDemolition([[4, 5]])).toBe(0);
    world.level[world.idx(5, 5)] = 3;
    world.abandoned[world.idx(5, 5)] = 1; // a ruin
    expect(sim.noteDemolition([[5, 5]])).toBe(0);
    world.level[world.idx(6, 5)] = 3;
    world.fire[world.idx(6, 5)] = 1; // on fire
    expect(sim.noteDemolition([[6, 5]])).toBe(0);
    expect(sim.noteDemolition([[10, 10]])).toBe(0); // plain ground
    expect(sim.state.grief).toBe(0);
  });

  it('adds up over several demolitions', () => {
    const { sim } = city();
    sim.noteDemolition([[2, 5]]);
    sim.noteDemolition([[3, 5]]);
    expect(sim.state.grief).toBe(CAPACITY.R[4] + CAPACITY.R[3]);
  });
});

describe('the grudge in points of approval', () => {
  it('is nothing without demolitions', () => {
    expect(demolitionPoints(0, 5000)).toBe(0);
  });

  it('grows with the people affected and shrinks with the size of the city', () => {
    const oneHome = CAPACITY.R[3]; // 20
    const avenue = 12 * CAPACITY.R[3]; // 240, twelve homes
    expect(demolitionPoints(oneHome, 300)).toBeGreaterThan(demolitionPoints(oneHome, 50000));
    expect(demolitionPoints(avenue, 5000)).toBeGreaterThan(demolitionPoints(avenue, 50000));
    // The examples of the design: a village feels one house, a metropolis shrugs.
    expect(Math.round(demolitionPoints(oneHome, 300))).toBe(5);
    expect(Math.round(demolitionPoints(avenue, 5000))).toBe(12);
    expect(Math.round(demolitionPoints(avenue, 50000))).toBe(1);
  });

  it('never takes more than the cap', () => {
    expect(demolitionPoints(1e6, 100)).toBe(DEMOLITION.max);
  });

  it('shows up in the approval and goes away with it', () => {
    const base = {
      taxes: { R: 7, C: 7, I: 7 },
      crisis: false,
      jammedShare: 0,
      abandoned: 0,
      pop: 5000,
      jobs: 2500,
      growth: 0,
    };
    const calm = computeApproval(flat(), { ...base });
    const angry = computeApproval(flat(), { ...base, grief: 240 });
    expect(calm.factors.some((f) => f.label === 'Demoliciones')).toBe(false);
    const factor = angry.factors.find((f) => f.label === 'Demoliciones');
    expect(factor?.points).toBe(-Math.round(demolitionPoints(240, 5000)));
    expect(angry.target).toBeLessThan(calm.target);
  });
});

describe('the grudge wears off', () => {
  it('shrinks month by month and ends up at zero', () => {
    const { sim } = city();
    sim.noteDemolition([[2, 5]]); // 80 people
    const start = sim.state.grief;
    expect(start).toBeGreaterThan(1);
    const seen: number[] = [];
    for (let month = 0; month < 8; month++) {
      for (let t = 0; t < TICKS_PER_MONTH; t++) sim.tick();
      seen.push(sim.state.grief);
    }
    // Down every month until it is gone.
    expect(seen[0]).toBeLessThan(start);
    expect(seen[seen.length - 1]).toBe(0);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeLessThanOrEqual(seen[i - 1]);
  });
});

describe('the paper reports it', () => {
  const base: CitySnapshot = {
    pop: 5000,
    buildings: 400,
    plants: 1,
    shortage: false,
    crisis: false,
    taxes: { R: 7, C: 7, I: 7 },
    funding: { school: 100, clinic: 100, police: 100, fire: 100, hospital: 100, university: 100 },
    green: 100,
    grief: 0,
    month: 6,
    year: 1995,
    cash: 20000,
    abandoned: 0,
    loan: null,
    ports: 0,
    resorts: 0,
  };

  it('names the demolitions when the grudge gets loud, and when it fades', () => {
    const loud = headlinesFor(base, { ...base, grief: 240 }, 'Villa Obra').join(' | ');
    expect(loud).toMatch(/demoliciones/i);
    const faded = headlinesFor({ ...base, grief: 240 }, { ...base, grief: 0 }, 'Villa Obra').join(' | ');
    expect(faded).toMatch(/reclamos por las demoliciones/i);
  });

  it('stays quiet while nothing is going on', () => {
    expect(headlinesFor(base, base, 'Villa Obra').join(' ')).not.toMatch(/demolicion/i);
  });
});

describe('the grudge travels with the save', () => {
  const world = new World(generateTerrain(3, 24));
  const sim = new Simulation(world, newSimState(3), 'Villa Obra');

  it('keeps the number', () => {
    sim.state.grief = 130;
    expect(deserialize(serialize({ name: 'Villa Obra', seed: 3, world, sim: sim.state })).sim.grief).toBe(130);
  });

  it('opens an older save with nobody upset', () => {
    const text = JSON.parse(serialize({ name: 'Villa Obra', seed: 3, world, sim: sim.state }));
    text.version = 11;
    delete text.sim.grief;
    expect(deserialize(JSON.stringify(text)).sim.grief).toBe(0);
  });

  it('refuses a number that makes no sense', () => {
    const text = JSON.parse(serialize({ name: 'Villa Obra', seed: 3, world, sim: sim.state }));
    text.sim.grief = -5;
    expect(() => deserialize(JSON.stringify(text))).toThrow(/demoliciones/i);
  });
});
