import { describe, expect, it } from 'vitest';
import { PARK, UPKEEP } from '../src/config';
import { monthlyBudget } from '../src/sim/budget';
import { headlinesFor, type CitySnapshot } from '../src/sim/news';
import { computeLandValue, computeParks, computePollution } from '../src/sim/fields';
import { Simulation, newSimState } from '../src/sim/simulation';
import { deserialize, serialize } from '../src/save/save';
import { generateTerrain } from '../src/world/terrain';
import { TILE, World } from '../src/world/world';

function flat(n = 40) {
  return { n, corners: new Uint8Array((n + 1) * (n + 1)).fill(30), trees: new Uint8Array(n * n) };
}

/** The land value of the centre of a plaza patch `cw`×`ch` built at (10, 10), and how far it reaches. */
function plaza(cw: number, ch: number, green = 100): { centre: number; bonus: number; covered: number; base: number; plain: World } {
  const w = new World(flat());
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) w.tiles[w.idx(10 + x, 10 + y)] = TILE.PARK;
  computePollution(w);
  computeParks(w, green);
  computeLandValue(w);
  const plain = new World(flat());
  computeParks(plain, green);
  computeLandValue(plain);
  const base = plain.landValue[plain.idx(30, 30)];
  const centre = w.landValue[w.idx(10 + Math.floor(cw / 2), 10 + Math.floor(ch / 2))];
  let covered = 0;
  for (let i = 0; i < w.n * w.n; i++) if (w.landValue[i] - plain.landValue[i] >= 5) covered++;
  return { centre, bonus: centre - base, covered, base, plain: w };
}

describe('a plaza needs to be a plaza', () => {
  it('does nothing at one or two cells', () => {
    expect(plaza(1, 1).bonus).toBe(0);
    expect(plaza(1, 2).bonus).toBe(0);
    expect(plaza(2, 1).bonus).toBe(0);
  });

  it('starts paying at three cells: the 2×2 and the 1×3 of the request', () => {
    expect(plaza(1, 3).bonus).toBeGreaterThan(0);
    expect(plaza(2, 2).bonus).toBeGreaterThan(plaza(1, 3).bonus);
  });
});

describe('the bigger the plaza, the more it is worth', () => {
  it('grows with the patch, both in force and in reach', () => {
    const small = plaza(2, 2);
    const mid = plaza(3, 3);
    const big = plaza(4, 4);
    expect(mid.bonus).toBeGreaterThan(small.bonus);
    expect(mid.covered).toBeGreaterThan(small.covered);
    expect(big.covered).toBeGreaterThan(mid.covered);
  });

  it('never passes the ceiling the land value already had', () => {
    // The amenity sum of a cell is capped at +30, however big the park is.
    expect(plaza(10, 10).bonus).toBeLessThanOrEqual(30);
    expect(plaza(10, 10).bonus).toBe(plaza(6, 6).bonus);
  });
});

describe('the budget for green spaces decides how well they are kept', () => {
  it('gives everything at 100, nothing at the care line, and takes away below it', () => {
    expect(plaza(2, 2, 100).bonus).toBeGreaterThan(0);
    expect(plaza(2, 2, PARK.care).bonus).toBe(0);
    expect(plaza(2, 2, 25).bonus).toBeLessThan(0);
    expect(plaza(2, 2, 0).bonus).toBeLessThan(plaza(2, 2, 25).bonus);
  });

  it('hurts as an abandoned building does, not more than the amenity it gave', () => {
    const good = plaza(3, 3, 100);
    const bad = plaza(3, 3, 0);
    expect(-bad.bonus).toBeLessThanOrEqual(30);
    expect(-bad.bonus).toBeLessThanOrEqual(Math.abs(good.bonus) + 30);
  });
});

describe('how a patch is measured', () => {
  it('walks the cells that touch by the side', () => {
    const w = new World(flat());
    for (const [x, y] of [[5, 5], [6, 5], [5, 6], [6, 6]]) w.tiles[w.idx(x, y)] = TILE.PARK; // 2×2
    for (const [x, y] of [[20, 5], [22, 5]]) w.tiles[w.idx(x, y)] = TILE.PARK; // two tiles apart
    w.tiles[w.idx(30, 5)] = TILE.PARK;
    w.tiles[w.idx(31, 6)] = TILE.PARK; // touches only at the corner
    computeParks(w, 100);
    expect(w.parkArea[w.idx(5, 5)]).toBe(4);
    expect(w.parkArea[w.idx(6, 6)]).toBe(4);
    for (const [x, y] of [[20, 5], [22, 5], [30, 5], [31, 6]]) expect(w.parkArea[w.idx(x, y)]).toBe(1);
  });

  it('counts an L as one patch of three', () => {
    const w = new World(flat());
    for (const [x, y] of [[5, 5], [6, 5], [5, 6]]) w.tiles[w.idx(x, y)] = TILE.PARK;
    computeParks(w, 80);
    expect(w.parkArea[w.idx(6, 5)]).toBe(3);
    expect(w.parkCare[w.idx(5, 6)]).toBe(80);
  });
});

describe('what green spaces cost', () => {
  it('charges the budget share of the upkeep per cell', () => {
    const w = new World(flat());
    for (let x = 5; x < 8; x++) for (let y = 5; y < 8; y++) w.tiles[w.idx(x, y)] = TILE.PARK; // 9 cells
    const full = monthlyBudget(w, 7, undefined, null, undefined, 100);
    const half = monthlyBudget(w, 7, undefined, null, undefined, 50);
    const none = monthlyBudget(w, 7, undefined, null, undefined, 0);
    expect(full.parks).toBe(9 * UPKEEP.park);
    expect(half.parks).toBe(Math.round(9 * UPKEEP.park * 0.5));
    expect(none.parks).toBe(0);
  });
});

describe('the budget travels with the save', () => {
  const world = new World(generateTerrain(3, 24));
  const sim = new Simulation(world, newSimState(3), 'Villa Verde');

  it('keeps the share it was set to', () => {
    sim.state.green = 70;
    const back = deserialize(serialize({ name: 'Villa Verde', seed: 3, world, sim: sim.state }));
    expect(back.sim.green).toBe(70);
  });

  it('opens an older save with the plazas well kept', () => {
    const text = JSON.parse(serialize({ name: 'Villa Verde', seed: 3, world, sim: sim.state }));
    text.version = 10;
    delete text.sim.green;
    expect(deserialize(JSON.stringify(text)).sim.green).toBe(100);
  });

  it('refuses an impossible share', () => {
    const text = JSON.parse(serialize({ name: 'Villa Verde', seed: 3, world, sim: sim.state }));
    text.sim.green = 400;
    expect(() => deserialize(JSON.stringify(text))).toThrow(/espacios verdes/i);
  });

  it('starts a new city with the plazas kept', () => {
    expect(newSimState(1).green).toBe(100);
  });
});

describe('a neglected plaza shows in the paper', () => {
  const base: CitySnapshot = {
    pop: 5000,
    buildings: 400,
    plants: 2,
    shortage: false,
    crisis: false,
    taxes: { R: 7, C: 7, I: 7 },
    funding: { school: 100, clinic: 100, police: 100, fire: 100 },
    green: 100,
    month: 6,
    year: 1995,
    cash: 20000,
    abandoned: 3,
    loan: null,
    ports: 0,
    resorts: 0,
  };

  it('reports a cut that leaves the plazas untended, and the day they come back', () => {
    const cut = headlinesFor(base, { ...base, green: 20 }, 'Villa Verde').join(' | ');
    expect(cut).toMatch(/[Pp]lazas descuidadas/);
    const back = headlinesFor({ ...base, green: 20 }, { ...base, green: 100 }, 'Villa Verde').join(' | ');
    expect(back).toMatch(/[Pp]lazas/);
  });

  it('stays quiet when the budget stays on the same side of the line', () => {
    expect(headlinesFor(base, { ...base, green: 90 }, 'Villa Verde').join(' ')).not.toMatch(/plaza/i);
    expect(headlinesFor({ ...base, green: 20 }, { ...base, green: 10 }, 'Villa Verde').join(' ')).not.toMatch(/plaza/i);
  });
});

describe('moving the budget repaints the plazas at once', () => {
  const world = new World(flat(28));
  const sim = new Simulation(world, newSimState(9), 'Villa Verde');
  for (let y = 8; y < 11; y++) for (let x = 8; x < 11; x++) world.tiles[world.idx(x, y)] = TILE.PARK;
  const next = world.idx(12, 10); // two cells away from the plaza

  it('lowers the land value when the plazas stop being kept', () => {
    sim.setGreen(100);
    const kept = world.landValue[next];
    sim.setGreen(0);
    expect(world.landValue[next]).toBeLessThan(kept);
    sim.setGreen(50);
    expect(world.landValue[next]).toBeLessThan(kept);
    sim.setGreen(100);
    expect(world.landValue[next]).toBe(kept);
  });

  it('clamps the share to what the other budgets allow', () => {
    sim.setGreen(500);
    expect(sim.state.green).toBe(120);
    sim.setGreen(-10);
    expect(sim.state.green).toBe(0);
  });
});
