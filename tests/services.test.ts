import { describe, expect, it } from 'vitest';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { World, TILE } from '../src/world/world';
import { applyPlan, dragCells, planTool, type ToolId } from '../src/world/tools';
import { SERVICES, TICKS_PER_MONTH } from '../src/config';
import { computePower } from '../src/sim/power';
import { computeCrime, computeLandValue, computePollution, computeServices } from '../src/sim/fields';
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
    build(w, 'road', 2, 0, 2, 20);
    build(w, 'school', 3, 10);
    fields(w);
    const r = SERVICES.school.radius;
    expect(w.edu[w.idx(3, 10)]).toBe(100);
    expect(w.edu[w.idx(3 + r - 1, 10)]).toBeGreaterThan(0);
    expect(w.edu[w.idx(3 + r + 2, 10)]).toBe(0);

    build(w, 'bulldoze', 0, 0);
    fields(w);
    expect(w.edu[w.idx(3, 10)]).toBe(0);

    const crowded = denseCity(4);
    place(crowded, 'school', 20, 22);
    fields(crowded);
    expect(crowded.edu[crowded.idx(20, 22)]).toBeGreaterThan(0);
    expect(crowded.edu[crowded.idx(20, 22)]).toBeLessThan(100);
  });

  it('police lowers crime in a dense city, and a small town has little crime', () => {
    const dense = denseCity(4);
    fields(dense);
    const before = dense.crime[dense.idx(20, 21)];
    expect(before).toBeGreaterThan(50);
    for (const [x, y] of [[18, 21], [22, 21], [20, 23], [20, 18]]) place(dense, 'police', x, y);
    fields(dense);
    expect(dense.crime[dense.idx(20, 21)]).toBeLessThan(before / 2);

    const town = new World(flat());
    build(town, 'zoneR', 3, 3, 6, 6);
    for (let i = 0; i < town.tiles.length; i++) if (town.tiles[i] === TILE.R) town.level[i] = 1;
    fields(town);
    expect(Math.max(...town.crime)).toBeLessThan(10);
  });

  it('education and health raise land value, crime lowers it', () => {
    const w = denseCity(2);
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
  it('needs health for the third level and education for the fourth', () => {
    expect(levelCap('R', 100, 50000, { edu: 0, health: 0 })).toBe(2);
    expect(levelCap('R', 100, 50000, { edu: 0, health: 100 })).toBe(3);
    expect(levelCap('R', 100, 50000, { edu: 100, health: 100 })).toBe(4);
    expect(levelCap('C', 100, 50000, { edu: 0, health: 0 })).toBe(3);
    expect(levelCap('C', 100, 50000, { edu: 100, health: 0 })).toBe(4);
    expect(levelCap('I', 100, 50000, { edu: 0, health: 0 })).toBe(4);
  });
});

describe('budget with services', () => {
  it('charges each service type its upkeep and adds it to the expenses', () => {
    const w = new World(flat());
    build(w, 'school', 3, 3);
    build(w, 'school', 3, 5);
    build(w, 'clinic', 5, 3);
    build(w, 'police', 7, 3);
    build(w, 'fire', 9, 3);
    const b = monthlyBudget(w, 7);
    expect(b.schools).toBe(2 * SERVICES.school.upkeep);
    expect(b.clinics).toBe(SERVICES.clinic.upkeep);
    expect(b.police).toBe(SERVICES.police.upkeep);
    expect(b.firefighters).toBe(SERVICES.fire.upkeep);
    expect(b.expenses).toBe(b.roads + b.lines + b.parks + b.plants + b.services + b.schools + b.clinics + b.police + b.firefighters);
  });
});

describe('fires', () => {
  function run(cover: boolean): Simulation {
    const w = denseCity(3);
    if (cover) for (const x of [8, 20, 32]) for (const y of [12, 22, 32]) place(w, 'fire', x, y);
    const sim = new Simulation(w, newSimState(9), 'X');
    sim.state.cash = 10_000_000;
    for (let i = 0; i < TICKS_PER_MONTH * 60; i++) sim.tick();
    return sim;
  }

  it('burn down buildings in a dense city without firefighters', () => {
    const sim = run(false);
    expect(sim.stats.firesStarted).toBeGreaterThan(0);
    expect(sim.stats.buildingsBurned).toBeGreaterThan(0);
    expect(sim.state.news.some((n) => n.text.includes('Incendio'))).toBe(true);
  });

  it('are mostly put out when fire stations cover the city', () => {
    const uncovered = run(false);
    const covered = run(true);
    expect(covered.stats.firesSaved).toBeGreaterThan(0);
    expect(covered.stats.buildingsBurned).toBeLessThan(uncovered.stats.buildingsBurned / 3);
  });
});

describe('save with services', () => {
  it('round-trips service buildings and fires', () => {
    const w = denseCity(2);
    place(w, 'school', 20, 10);
    w.fire[w.idx(5, 11)] = 40;
    const sim = new Simulation(w, newSimState(1), 'X');
    const back = deserialize(serialize({ name: 'X', seed: 1, world: w, sim: sim.state }));
    expect(back.world.tileAt(20, 10)).toBe(TILE.SCHOOL);
    expect(back.world.fire[w.idx(5, 11)]).toBe(40);
  });

  it('loads budgets saved before services existed, with those lines at zero', () => {
    const w = denseCity(2);
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
