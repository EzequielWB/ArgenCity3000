import { describe, expect, it } from 'vitest';
import { MAX_FUNDING, PLANTS } from '../src/config';
import { deserialize, serialize } from '../src/save/save';
import { monthlyBudget } from '../src/sim/budget';
import { fundingCondition } from '../src/sim/condition';
import { roadCondition } from '../src/sim/congestion';
import { Simulation, newSimState } from '../src/sim/simulation';
import { SEA_LEVEL } from '../src/world/terrain';
import { applyPlan, dragCells, planTool } from '../src/world/tools';
import { TILE, World } from '../src/world/world';

const N = 40;

/** One coal plant and a block of homes that asks for most of what it gives. */
function town(): { world: World; sim: Simulation } {
  const world = new World({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(N * N) });
  const build = (tool: Parameters<typeof planTool>[1], ax: number, ay: number, bx = ax, by = ay) =>
    applyPlan(world, planTool(world, tool, dragCells(tool, ax, ay, bx, by, 1, N)));
  build('plant', 0, 1);
  build('road', 0, 3, 31, 3);
  build('zoneR', 2, 4, 16, 8);
  for (let i = 0; i < world.tiles.length; i++) if (world.tiles[i] === TILE.R) world.level[i] = 3;
  const sim = new Simulation(world, newSimState(3), 'Villa Usina');
  sim.refresh();
  return { world, sim };
}

describe('the budget for the power plants', () => {
  it('shares its curve with the streets: half with none, the usual at 100 %, a tenth more at 120 %', () => {
    expect(fundingCondition(0)).toBe(0.5);
    expect(fundingCondition(100)).toBe(1);
    expect(fundingCondition(120)).toBeCloseTo(1.1, 5);
    expect(roadCondition(50)).toBe(fundingCondition(50));
  });

  it('makes the plants generate less the less is spent, and the city goes dark when it falls short', () => {
    const { sim } = town();
    expect(sim.state.plants).toBe(100);
    expect(sim.power.capacity).toBe(PLANTS.coal.capacity);
    expect(sim.power.use).toBeGreaterThan(PLANTS.coal.capacity / 2);
    expect(sim.power.shortage).toBe(false);
    sim.setPlants(0);
    expect(sim.power.capacity).toBe(PLANTS.coal.capacity / 2);
    expect(sim.power.shortage).toBe(true);
    sim.setPlants(120);
    expect(sim.power.capacity).toBeGreaterThan(PLANTS.coal.capacity);
  });

  it('costs the upkeep in proportion, and stays between 0 and the maximum', () => {
    const { world, sim } = town();
    const full = monthlyBudget(world, 7).plants;
    expect(full).toBe(PLANTS.coal.upkeep);
    const args = [undefined, 100, 1, 100, 'democracia', 1, 100] as const;
    expect(monthlyBudget(world, 7, undefined, null, ...args, 50).plants).toBe(full / 2);
    expect(monthlyBudget(world, 7, undefined, null, ...args, 0).plants).toBe(0);
    sim.setPlants(-5);
    expect(sim.state.plants).toBe(0);
    sim.setPlants(999);
    expect(sim.state.plants).toBe(MAX_FUNDING);
  });

  it('is saved, and an older save runs its plants at 100 %', () => {
    const { world, sim } = town();
    sim.setPlants(70);
    expect(deserialize(serialize({ name: 'X', seed: 1, world, sim: sim.state })).sim.plants).toBe(70);
    const old = JSON.parse(serialize({ name: 'X', seed: 1, world, sim: sim.state }));
    delete old.sim.plants;
    expect(deserialize(JSON.stringify(old)).sim.plants).toBe(100);
    old.sim.plants = 500;
    expect(() => deserialize(JSON.stringify(old))).toThrow(/presupuesto de usinas/);
  });
});
