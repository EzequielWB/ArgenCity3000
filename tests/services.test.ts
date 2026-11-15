import { describe, expect, it } from 'vitest';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { World, TILE } from '../src/world/world';
import { applyPlan, dragCells, planTool, type ToolId } from '../src/world/tools';
import { FIXED_SHARE, SERVICES, TICKS_PER_MONTH } from '../src/config';
import { computePower } from '../src/sim/power';
import { computeCrime, computeLandValue, computePollution, computeServices, residentsServed } from '../src/sim/fields';
import { cityTotals, levelCap } from '../src/sim/demand';
import { monthlyBudget } from '../src/sim/budget';
import { Simulation, newSimState } from '../src/sim/simulation';
import { deserialize, serialize } from '../src/save/save';

function flat(n = 40, waterFromX = n): Terrain {
  const s = n + 1;
  const corners = new Uint8Array(s * s);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) corners[y * s + x] = x >= waterFromX ? SEA_LEVEL - 1 : SEA_LEVEL + 1;
  return { n, corners, trees: new Uint8Array(n * n) };
}

function build(w: World, tool: ToolId, ax: number, ay: number, bx = ax, by = ay) {
  applyPlan(w, planTool(w, tool, dragCells(tool, ax, ay, bx, by, 1, w.n)));
}

/** Replaces whatever stands on a cell with a new building. */
function place(w: World, tool: ToolId, x: number, y: number) {
  build(w, 'bulldoze', x, y);
  build(w, tool, x, y);
}

/** A dense, powered residential grid of the given level. */
function denseCity(level: number): World {
  const w = new World(flat());
  for (let y = 0; y < 40; y += 2) build(w, 'plant', 0, y);
  for (let y = 9; y < 40; y += 5) build(w, 'road', 2, y, 39, y);
  build(w, 'road', 2, 0, 2, 39);
  for (let y = 10; y < 40; y += 5) build(w, 'zoneR', 3, y, 39, y + 3);
  for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === TILE.R) w.level[i] = level;
  return w;
}

function fields(w: World) {
  computePower(w);
  computeServices(w);
  computePollution(w);
  computeCrime(w, cityTotals(w).pop);
  computeLandValue(w);
}

describe('service buildings', () => {
  it('are built on free land for their price, never on water or occupied lots', () => {
    const w = new World(flat(20, 15));
    const plan = planTool(w, 'school', [[4, 4]]);
    expect(plan.cells).toEqual([[4, 4]]);
    expect(plan.cost).toBe(SERVICES.school.cost);
    applyPlan(w, plan);
    expect(w.tileAt(4, 4)).toBe(TILE.SCHOOL);
    expect(planTool(w, 'clinic', [[4, 4]]).cells).toHaveLength(0);
    expect(planTool(w, 'police', [[17, 4]]).cells).toHaveLength(0);
    for (const t of ['clinic', 'police', 'fire'] as const) {
      applyPlan(w, planTool(w, t, [[6, 6 + ['clinic', 'police', 'fire'].indexOf(t)]]));
    }
    expect(w.tileAt(6, 6)).toBe(TILE.CLINIC);
    expect(w.tileAt(6, 7)).toBe(TILE.POLICE);
    expect(w.tileAt(6, 8)).toBe(TILE.FIREHOUSE);
  });

  it('cover a radius only while powered, and less when crowded', () => {
    const w = new World(flat());
    build(w, 'plant', 0, 0);
    build(w, 'line', 2, 0, 2, 20); // roads carry no light
    build(w, 'school', 3, 10);
    fields(w);
    const r = SERVICES.school.radius;
    expect(w.edu[w.idx(3, 10)]).toBe(100);
    expect(w.edu[w.idx(3 + r - 1, 10)]).toBeGreaterThan(0);
    expect(w.edu[w.idx(3 + r + 2, 10)]).toBe(0);

    build(w, 'bulldoze', 0, 0);
    fields(w);
    expect(w.edu[w.idx(3, 10)]).toBe(0);

    const crowded = denseCity(5);
    place(crowded, 'school', 20, 22);
    fields(crowded);
    expect(crowded.edu[crowded.idx(20, 22)]).toBeGreaterThan(0);
    expect(crowded.edu[crowded.idx(20, 22)]).toBeLessThan(100);
  });

  it('police lowers crime in a dense city, and a small town has little crime', () => {
    const dense = denseCity(5);
    fields(dense);
    const before = dense.crime[dense.idx(20, 21)];
    expect(before).toBeGreaterThan(50);
    for (const [x, y] of [[18, 21], [22, 21], [20, 23], [20, 18]]) place(dense, 'police', x, y);
    fields(dense);
    expect(dense.crime[dense.idx(20, 21)]).toBeLessThan(before / 2);

    const town = new World(flat());
    build(town, 'zoneR', 3, 3, 6, 6);
    for (let i = 0; i < town.tiles.length; i++) if (town.tiles[i] === TILE.R) town.level[i] = 2;
    fields(town);
    expect(Math.max(...town.crime)).toBeLessThan(10);
  });

  it('education and health raise land value, crime lowers it', () => {
    const w = denseCity(3);
    fields(w);
    const plain = w.landValue[w.idx(20, 21)];
    place(w, 'school', 20, 18);
    place(w, 'clinic', 21, 18);
    place(w, 'police', 22, 18);
    fields(w);
    expect(w.landValue[w.idx(20, 21)]).toBeGreaterThan(plain);
  });
});

describe('levelCap with services', () => {
  it('needs a clinic to go past the chalet and a school to go past the PH', () => {
    expect(levelCap('R', 100, 50000, { edu: 0, health: 0 })).toBe(3);
    expect(levelCap('R', 100, 50000, { edu: 0, health: 100 })).toBe(4);
    expect(levelCap('R', 100, 50000, { edu: 100, health: 100 })).toBe(5);
    expect(levelCap('C', 100, 50000, { edu: 0, health: 0 })).toBe(4);
    expect(levelCap('C', 100, 50000, { edu: 100, health: 0 })).toBe(5);
    expect(levelCap('I', 100, 50000, { edu: 0, health: 0 })).toBe(5);
  });
});

/** The four services in the middle of a field of homes of the given level: they all serve the same people. */
function servicesAmongHomes(level: number, funding?: Parameters<typeof monthlyBudget>[2]) {
  const w = new World(flat());
  build(w, 'zoneR', 14, 14, 26, 26);
  for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === TILE.R) w.level[i] = level;
  const cells = { school: [19, 20], clinic: [20, 20], police: [21, 20], fire: [22, 20] } as const;
  for (const [kind, [x, y]] of Object.entries(cells)) place(w, kind as 'school' | 'clinic' | 'police' | 'fire', x, y);
  return { w, cells, budget: monthlyBudget(w, 7, funding) };
}

describe('budget with services', () => {
  it('charges an unused service only its fixed share of the upkeep, and adds it to the expenses', () => {
    const w = new World(flat());
    build(w, 'school', 3, 3);
    build(w, 'school', 3, 5);
    build(w, 'clinic', 5, 3);
    build(w, 'police', 7, 3);
    build(w, 'fire', 9, 3);
    expect(FIXED_SHARE).toBe(0.25);
    const b = monthlyBudget(w, 7); // no field was computed first, and nobody lives nearby
    expect(b.schools).toBe(Math.round(2 * SERVICES.school.upkeep * FIXED_SHARE));
    expect(b.clinics).toBe(Math.round(SERVICES.clinic.upkeep * FIXED_SHARE));
    expect(b.police).toBe(Math.round(SERVICES.police.upkeep * FIXED_SHARE));
    expect(b.firefighters).toBe(Math.round(SERVICES.fire.upkeep * FIXED_SHARE));
    expect(b.expenses).toBe(b.roads + b.lines + b.parks + b.plants + b.services + b.schools + b.clinics + b.police + b.firefighters);
  });

  it('charges the whole upkeep to a service used to its capacity', () => {
    const { w, cells, budget } = servicesAmongHomes(5);
    for (const kind of ['school', 'clinic', 'police', 'fire'] as const) {
      const [x, y] = cells[kind];
      expect(residentsServed(w, w.idx(x, y), kind)).toBeGreaterThanOrEqual(SERVICES[kind].capacity);
    }
    expect(budget.schools).toBe(SERVICES.school.upkeep);
    expect(budget.clinics).toBe(SERVICES.clinic.upkeep);
    expect(budget.police).toBe(SERVICES.police.upkeep);
    expect(budget.firefighters).toBe(SERVICES.fire.upkeep);
  });

  it('puts the funding share on top of the use-based cost', () => {
    const { budget: full } = servicesAmongHomes(5);
    const { budget: cut } = servicesAmongHomes(5, { school: 50, clinic: 0, police: 120, fire: 100, hospital: 100, university: 100 });
    expect(cut.schools).toBe(Math.round(full.schools * 0.5));
    expect(cut.clinics).toBe(0);
    expect(cut.police).toBe(Math.round(full.police * 1.2));
    expect(cut.firefighters).toBe(full.firefighters);
    // a partly used service funded at 50 % costs half of its partly used cost
    const half = servicesAmongHomes(2);
    const halfCut = servicesAmongHomes(2, { school: 50, clinic: 100, police: 100, fire: 100, hospital: 100, university: 100 });
    expect(halfCut.budget.schools).toBe(Math.round(half.budget.schools / 2));
  });

  it('grows with the residents the service attends, by the documented formula', () => {
    const costs = [1, 2, 3].map((level) => {
      const { w, cells, budget } = servicesAmongHomes(level);
      const served = residentsServed(w, w.idx(...cells.school), 'school');
      const use = Math.min(1, served / SERVICES.school.capacity);
      expect(budget.schools).toBe(Math.round(SERVICES.school.upkeep * (FIXED_SHARE + (1 - FIXED_SHARE) * use)));
      return budget.schools;
    });
    expect(costs[0]).toBeGreaterThan(Math.round(SERVICES.school.upkeep * FIXED_SHARE));
    expect(costs[1]).toBeGreaterThan(costs[0]);
    expect(costs[2]).toBeGreaterThan(costs[1]);
    expect(costs[2]).toBeLessThanOrEqual(SERVICES.school.upkeep);
  });
});

describe('residentsServed', () => {
  it('counts only the occupied homes inside the radius', () => {
    const w = new World(flat());
    build(w, 'zoneR', 10, 10, 30, 30);
    build(w, 'zoneC', 10, 32, 30, 33);
    for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === TILE.R || w.tiles[i] === TILE.C) w.level[i] = 3;
    place(w, 'police', 20, 20);
    const at = w.idx(20, 20);
    const r = SERVICES.police.radius;
    let expected = 0;
    for (let y = 0; y < 40; y++) {
      for (let x = 0; x < 40; x++) {
        if ((x - 20) ** 2 + (y - 20) ** 2 <= r * r && w.tiles[w.idx(x, y)] === TILE.R) expected += 20;
      }
    }
    expect(residentsServed(w, at, 'police')).toBe(expected);
    // abandoned, burning and demolished homes are not there
    w.abandoned[w.idx(21, 20)] = 1;
    w.fire[w.idx(19, 20)] = 30;
    w.setLevel(w.idx(20, 21), 0);
    expect(residentsServed(w, at, 'police')).toBe(expected - 3 * 20);
  });

  it('is the same count the coverage drops by when the service is overcrowded', () => {
    const w = denseCity(5);
    place(w, 'school', 20, 12);
    fields(w);
    const at = w.idx(20, 12);
    const residents = residentsServed(w, at, 'school');
    expect(residents).toBeGreaterThan(SERVICES.school.capacity);
    expect(w.edu[at]).toBe(Math.round((100 * SERVICES.school.capacity) / residents));
  });
});

describe('fires', () => {
  /** News are capped at 50 entries, so `fireHeadlines` remembers whether any month ever carried one. */
  function run(cover: boolean, seed = 1): Simulation & { fireHeadlines: boolean } {
    const w = denseCity(4);
    if (cover) for (const x of [8, 20, 32]) for (const y of [12, 22, 32]) place(w, 'fire', x, y);
    // The newspaper only starts writing with two built lots of each basic zone.
    build(w, 'zoneC', 3, 5, 4, 5);
    build(w, 'zoneI', 3, 7, 4, 7);
    for (const y of [5, 7]) for (const x of [3, 4]) w.level[w.idx(x, y)] = 2;
    const sim = new Simulation(w, newSimState(seed), 'X');
    sim.state.cash = 10_000_000;
    let fireHeadlines = false;
    for (let i = 0; i < TICKS_PER_MONTH * 60; i++) {
      sim.tick();
      if (i % TICKS_PER_MONTH === 0) fireHeadlines ||= sim.state.news.some((n) => n.text.includes('ncendio'));
    }
    return Object.assign(sim, { fireHeadlines });
  }

  it('burn down buildings in a dense city without firefighters', () => {
    const sim = run(false);
    expect(sim.stats.firesStarted).toBeGreaterThan(0);
    expect(sim.stats.buildingsBurned).toBeGreaterThan(0);
    expect(sim.fireHeadlines).toBe(true);
  });

  it('are mostly put out when fire stations cover the city', () => {
    // Fires are rolled with dice: the sum of a few cities tells apart a city with stations from one without.
    const seeds = [1, 2, 3, 4];
    const sum = (cover: boolean, key: 'firesSaved' | 'buildingsBurned') => seeds.reduce((total, seed) => total + run(cover, seed).stats[key], 0);
    expect(sum(true, 'firesSaved')).toBeGreaterThan(0);
    expect(sum(true, 'buildingsBurned')).toBeLessThan(sum(false, 'buildingsBurned') / 3);
  });
});

describe('save with services', () => {
  it('round-trips service buildings and fires', () => {
    const w = denseCity(3);
    place(w, 'school', 20, 10);
    w.fire[w.idx(5, 11)] = 40;
    const sim = new Simulation(w, newSimState(1), 'X');
    const back = deserialize(serialize({ name: 'X', seed: 1, world: w, sim: sim.state }));
    expect(back.world.tileAt(20, 10)).toBe(TILE.SCHOOL);
    expect(back.world.fire[w.idx(5, 11)]).toBe(40);
  });

  it('loads budgets saved before services existed, with those lines at zero', () => {
    const w = denseCity(3);
    const sim = new Simulation(w, newSimState(1), 'X');
    for (let i = 0; i < TICKS_PER_MONTH; i++) sim.tick();
    const data = JSON.parse(serialize({ name: 'X', seed: 1, world: w, sim: sim.state }));
    expect(data.sim.lastBudget).not.toBeNull();
    for (const k of ['schools', 'clinics', 'police', 'firefighters']) delete data.sim.lastBudget[k];
    const back = deserialize(JSON.stringify(data));
    const b = back.sim.lastBudget!;
    expect([b.schools, b.clinics, b.police, b.firefighters]).toEqual([0, 0, 0, 0]);
    expect(b.expenses).toBe(sim.state.lastBudget!.expenses);
  });
});
