import { describe, expect, it } from 'vitest';
import { MAX_FUNDING } from '../src/config';
import { deserialize, serialize } from '../src/save/save';
import { monthlyBudget } from '../src/sim/budget';
import { roadCondition } from '../src/sim/congestion';
import { Simulation, newSimState } from '../src/sim/simulation';
import { applyPlan, dragCells, planTool } from '../src/world/tools';
import { TILE, World } from '../src/world/world';

const N = 40;

/** A lit town with a long street of homes on one side and workshops on the other: the street carries real traffic. */
function town(): { world: World; sim: Simulation } {
  const world = new World({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(3), trees: new Uint8Array(N * N) });
  const build = (tool: Parameters<typeof planTool>[1], ax: number, ay: number, bx = ax, by = ay) =>
    applyPlan(world, planTool(world, tool, dragCells(tool, ax, ay, bx, by, 1, N)));
  build('plant', 0, 1);
  build('road', 0, 3, 31, 3);
  build('zoneR', 2, 4, 14, 6);
  build('zoneI', 16, 4, 20, 6);
  for (let i = 0; i < world.tiles.length; i++) if (world.tiles[i] === TILE.R || world.tiles[i] === TILE.I) world.level[i] = 3;
  const sim = new Simulation(world, newSimState(3), 'Villa Calle');
  sim.refresh();
  return { world, sim };
}

const worst = (w: World): number => w.traffic.reduce((m, v) => Math.max(m, v), 0);

describe('the budget for the streets', () => {
  it('carries what the quality says at 100 %, three quarters at 50 %, half with none, and a little more above', () => {
    expect(roadCondition(100)).toBe(1);
    expect(roadCondition(50)).toBe(0.75);
    expect(roadCondition(0)).toBe(0.5);
    expect(roadCondition(120)).toBeCloseTo(1.1, 5);
    expect(roadCondition(-5)).toBe(0.5);
  });

  it('makes the traffic worse the less is spent, and better the more', () => {
    const { world, sim } = town();
    expect(sim.state.roads).toBe(100);
    const usual = worst(world);
    expect(usual).toBeGreaterThan(0);
    sim.setRoads(0);
    expect(worst(world)).toBeGreaterThan(usual);
    sim.setRoads(50);
    const half = worst(world);
    expect(half).toBeGreaterThan(usual);
    sim.setRoads(120);
    expect(worst(world)).toBeLessThan(usual);
    expect(half).toBeLessThan(usual * 2);
  });

  it('keeps the setting between 0 and the maximum', () => {
    const { sim } = town();
    sim.setRoads(-20);
    expect(sim.state.roads).toBe(0);
    sim.setRoads(999);
    expect(sim.state.roads).toBe(MAX_FUNDING);
  });

  it('costs what the streets cost in proportion, and saves when it is cut', () => {
    const { world } = town();
    const full = monthlyBudget(world, 7).roads;
    expect(full).toBeGreaterThan(0);
    const args = [undefined, 100, 1, 100, 'democracia', 1] as const;
    expect(monthlyBudget(world, 7, undefined, null, ...args, 50).roads).toBe(Math.round(full / 2));
    expect(monthlyBudget(world, 7, undefined, null, ...args, 0).roads).toBe(0);
    expect(monthlyBudget(world, 7, undefined, null, ...args, 120).roads).toBe(Math.round(full * 1.2));
  });

  it('is saved, and older saves have the budget in full', () => {
    const { world, sim } = town();
    sim.setRoads(40);
    expect(deserialize(serialize({ name: 'X', seed: 1, world, sim: sim.state })).sim.roads).toBe(40);
    const old = JSON.parse(serialize({ name: 'X', seed: 1, world, sim: sim.state }));
    delete old.sim.roads;
    expect(deserialize(JSON.stringify(old)).sim.roads).toBe(100);
    old.sim.roads = 500;
    expect(() => deserialize(JSON.stringify(old))).toThrow(/presupuesto de calles/);
  });
});
