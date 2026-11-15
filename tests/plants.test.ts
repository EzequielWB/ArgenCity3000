import { describe, expect, it } from 'vitest';
import { COSTS, PLANTS, PLANT_CAPACITY, UPKEEP, WIND } from '../src/config';
import { deserialize, serialize } from '../src/save/save';
import { monthlyBudget } from '../src/sim/budget';
import { computePollution } from '../src/sim/fields';
import { plantCapacity, windOutput } from '../src/sim/plants';
import { computePower } from '../src/sim/power';
import { newSimState } from '../src/sim/simulation';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { applyPlan, planTool, type ToolId } from '../src/world/tools';
import { World } from '../src/world/world';

/** Flat land `height` levels above the sea. */
function flat(n = 32, height = 1): Terrain {
  const s = n + 1;
  return { n, corners: new Uint8Array(s * s).fill(SEA_LEVEL + height), trees: new Uint8Array(n * n) };
}

function build(w: World, tool: ToolId, x: number, y: number): number {
  const plan = planTool(w, tool, [[x, y]]);
  applyPlan(w, plan);
  return plan.cost;
}

describe('power plant kinds', () => {
  it('keeps the coal plant as it was: price, output, upkeep and smoke', () => {
    const w = new World(flat());
    expect(build(w, 'plant', 4, 4)).toBe(COSTS.plant);
    expect(w.plants).toEqual([{ x: 4, y: 4, kind: 'coal' }]);
    expect(PLANTS.coal).toMatchObject({ cost: 3000, upkeep: 260, capacity: 600 });
    expect(computePower(w).capacity).toBe(PLANT_CAPACITY);
    expect(monthlyBudget(w, 7).plants).toBe(UPKEEP.plant);
    computePollution(w);
    expect(w.pollution[w.idx(4, 4)]).toBe(60);
  });

  it('builds a gas plant: dearer to build and run, same output, much less smoke', () => {
    const w = new World(flat());
    expect(build(w, 'plantGas', 4, 4)).toBe(PLANTS.gas.cost);
    expect(PLANTS.gas.cost).toBeGreaterThan(PLANTS.coal.cost);
    expect(w.plants).toEqual([{ x: 4, y: 4, kind: 'gas' }]);
    expect(computePower(w).capacity).toBe(PLANTS.gas.capacity);
    expect(monthlyBudget(w, 7).plants).toBe(PLANTS.gas.upkeep);
    expect(PLANTS.gas.upkeep).toBeGreaterThan(PLANTS.coal.upkeep);
    computePollution(w);
    const smoke = w.pollution[w.idx(4, 4)];
    expect(smoke).toBeGreaterThan(0);
    expect(smoke).toBeLessThan(30);
  });

  it('builds a wind farm with no smoke that gives its base output on open flat land, however high', () => {
    for (const height of [1, 6]) {
      const w = new World(flat(32, height));
      expect(build(w, 'plantWind', 12, 12)).toBe(PLANTS.wind.cost);
      expect(w.plants[0].kind).toBe('wind');
      expect(windOutput(w, 12, 12)).toBe(WIND.base);
      expect(computePower(w).capacity).toBe(WIND.base);
      expect(plantCapacity(w, w.plants[0])).toBe(WIND.base);
      computePollution(w);
      expect(w.pollution[w.idx(12, 12)]).toBe(0);
      expect(monthlyBudget(w, 7).plants).toBe(PLANTS.wind.upkeep);
    }
  });

  it('gives a wind farm more on a hilltop and by the water, less in a hollow, within its limits', () => {
    const hill = flat(32, 2);
    // A 2×2 mesa three levels above the plain (its 3×3 corners).
    for (let y = 12; y <= 14; y++) for (let x = 12; x <= 14; x++) hill.corners[y * 33 + x] = SEA_LEVEL + 5;
    const onHill = windOutput(new World(hill), 12, 12);
    expect(onHill).toBeGreaterThan(WIND.base + 2 * WIND.perLevel);
    expect(onHill).toBeLessThanOrEqual(WIND.max);

    const tall = flat(32, 2);
    for (let y = 12; y <= 14; y++) for (let x = 12; x <= 14; x++) tall.corners[y * 33 + x] = SEA_LEVEL + 9;
    expect(windOutput(new World(tall), 12, 12)).toBe(WIND.max);

    const hollow = flat(32, 8);
    for (let y = 12; y <= 14; y++) for (let x = 12; x <= 14; x++) hollow.corners[y * 33 + x] = SEA_LEVEL + 1;
    expect(windOutput(new World(hollow), 12, 12)).toBe(WIND.min);

    const shore = flat(32, 2);
    for (let y = 0; y < 33; y++) for (let x = 17; x < 33; x++) shore.corners[y * 33 + x] = SEA_LEVEL - 1;
    expect(windOutput(new World(shore), 12, 12)).toBe(WIND.base + WIND.coast);
  });

  it('adds up the upkeep and the output of plants of different kinds', () => {
    const w = new World(flat());
    build(w, 'plant', 2, 2);
    build(w, 'plantGas', 3, 5); // inside the light of the first: one network
    expect(monthlyBudget(w, 7).plants).toBe(PLANTS.coal.upkeep + PLANTS.gas.upkeep);
    expect(computePower(w).capacity).toBe(PLANTS.coal.capacity + PLANTS.gas.capacity);
  });

  it('saves and loads the kind of each plant, and reads plants without a kind as coal', () => {
    const w = new World(flat());
    build(w, 'plantGas', 2, 2);
    build(w, 'plantWind', 10, 10);
    const text = serialize({ name: 'Prueba', seed: 1, world: w, sim: newSimState(1) });
    expect(deserialize(text).world.plants).toEqual([
      { x: 2, y: 2, kind: 'gas' },
      { x: 10, y: 10, kind: 'wind' },
    ]);
    const old = JSON.parse(text);
    old.version = 3;
    old.plants = old.plants.map((p: { x: number; y: number }) => ({ x: p.x, y: p.y }));
    expect(deserialize(JSON.stringify(old)).world.plants.map((p) => p.kind)).toEqual(['coal', 'coal']);
    const bad = JSON.parse(text);
    bad.plants[0].kind = 'nuclear';
    expect(() => deserialize(JSON.stringify(bad))).toThrow('Hay una usina de un tipo desconocido');
  });
});
