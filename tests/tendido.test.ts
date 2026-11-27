import { describe, expect, it } from 'vitest';
import { LINE_REACH, LINE_TIERS, MAX_LINE_TIER, lineRank, lineReach } from '../src/config';
import { paintPole, poleAttach } from '../src/render/pixelArt';
import { wireTargets } from '../src/render/wire';
import { SAVE_VERSION, deserialize, serialize, toBase64 } from '../src/save/save';
import { monthlyBudget } from '../src/sim/budget';
import { computePower } from '../src/sim/power';
import { Simulation, newSimState } from '../src/sim/simulation';
import { isUnlocked } from '../src/sim/milestones';
import { placementNote, placementUpkeep } from '../src/sim/outlook';
import { toolPrice } from '../src/ui/toolbar';
import { generateTerrain } from '../src/world/terrain';
import { applyPlan, dragCells, lineTierOfTool, planTool } from '../src/world/tools';
import { TILE, World } from '../src/world/world';

const N = 24;
const WOOD = LINE_TIERS[0].reach;
const CONCRETE = LINE_TIERS[1].reach;

/** A city on generated ground, with a street along the third row so the line has road access all the way. */
function city(): World {
  const world = new World(generateTerrain(5, N));
  applyPlan(world, planTool(world, 'road', dragCells('road', 1, 2, 20, 2, N, N)));
  return world;
}

const build = (world: World, tool: 'line' | 'lineConcrete', ax: number, ay: number, bx: number, by: number) =>
  applyPlan(world, planTool(world, tool, dragCells(tool, ax, ay, bx, by, world.n, world.n)));

const poles = (world: World): number[] => Array.from(world.tiles).flatMap((t, i) => (t === TILE.LINE ? [i] : []));

describe('the two qualities of the grid', () => {
  it('has the wooden line first, and it is the line of always', () => {
    expect(LINE_TIERS[0].reach).toBe(3);
    expect(LINE_TIERS[1].reach).toBe(5);
    expect(LINE_REACH).toBe(LINE_TIERS[0].reach);
    expect(MAX_LINE_TIER).toBe(1);
    expect(LINE_TIERS[1].cost).toBeGreaterThan(LINE_TIERS[0].cost);
    expect(LINE_TIERS[1].upkeep).toBeGreaterThan(LINE_TIERS[0].upkeep);
  });

  it('clamps a quality that does not exist to the nearest one', () => {
    expect(lineReach(-3)).toBe(WOOD);
    expect(lineReach(99)).toBe(CONCRETE);
    expect(lineRank(-3)).toBe(0);
    expect(lineRank(99)).toBe(1);
    expect(lineTierOfTool('line')).toBe(0);
    expect(lineTierOfTool('lineConcrete')).toBe(1);
    expect(lineTierOfTool('road')).toBe(null);
  });
});

describe('the reach of each line', () => {
  it('lights four lots away from a concrete pole and not from a wooden one', () => {
    const lit = (tier: 0 | 1): boolean => {
      const world = new World(generateTerrain(5, N));
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) world.setTile(1 + dx, 1 + dy, TILE.PLANT);
      world.plants.push({ kind: 'coal', x: 1, y: 1 });
      // The pole, lit by the plant, and a house four lots to its right: a wooden pole cannot reach it.
      world.setTile(4, 3, TILE.LINE);
      world.lineTier[world.idx(4, 3)] = tier;
      world.setTile(8, 3, TILE.R, 1);
      computePower(world);
      expect(world.powered[world.idx(4, 3)]).toBe(1);
      return world.powered[world.idx(8, 3)] === 1;
    };
    expect(lit(0)).toBe(false);
    expect(lit(1)).toBe(true);
  });

  it('lays fewer poles on the same run the better the line is', () => {
    const wooden = city();
    build(wooden, 'line', 2, 3, 19, 3);
    const concrete = city();
    build(concrete, 'lineConcrete', 2, 3, 19, 3);
    // Eighteen lots of run: one pole every three with wood, one every five with concrete.
    expect(poles(wooden).length).toBe(6);
    expect(poles(concrete).length).toBe(4);
  });

  it('spans five cells with a cable and three with the wooden one', () => {
    const cell = (vx: number, vy: number) =>
      (vx === 13 && vy < 12 && 12 - vy === 5 ? 'line' : 'clear') as 'line' | 'clear';
    // Five cells up is a pole for the concrete line and nothing at all for the wooden one.
    expect(wireTargets(13, 12, N, cell, lineReach(1)).map((t) => t.distance)).toEqual([5]);
    expect(wireTargets(13, 12, N, cell, lineReach(0))).toEqual([]);
  });
});

describe('upgrading a line in place', () => {
  it('charges the difference, keeps the pole and changes only its quality', () => {
    const world = city();
    build(world, 'line', 2, 3, 19, 3);
    const before = poles(world);
    const plan = planTool(world, 'lineConcrete', dragCells('lineConcrete', 2, 3, 19, 3, N, N));
    // Every pole of the run is upgraded, and no new pole is planted in between.
    expect(plan.cells.length).toBe(before.length);
    expect(plan.cost).toBe(before.length * (LINE_TIERS[1].cost - LINE_TIERS[0].cost));
    applyPlan(world, plan);
    expect(poles(world)).toEqual(before);
    for (const i of before) expect(world.lineTier[i]).toBe(1);
  });

  it('never tears a concrete pole down to a wooden one', () => {
    const world = city();
    build(world, 'lineConcrete', 2, 3, 19, 3);
    const concrete = poles(world);
    applyPlan(world, planTool(world, 'line', dragCells('line', 2, 3, 19, 3, N, N)));
    for (const i of concrete) expect(world.lineTier[i]).toBe(1);
    for (const i of poles(world)) if (!concrete.includes(i)) expect(world.lineTier[i]).toBe(0);
  });

  it('counts the upkeep of each pole by its own quality', () => {
    const world = city();
    const sim = new Simulation(world, newSimState(7), 'Villa Tendido');
    const lines = () => monthlyBudget(world, sim.state.taxes, sim.state.funding, null, 1, 100, 1).lines;
    build(world, 'line', 2, 3, 19, 3);
    const wooden = lines();
    build(world, 'lineConcrete', 2, 3, 19, 3);
    const mixed = lines();
    const count = poles(world).length;
    expect(wooden).toBe(Math.round(count * LINE_TIERS[0].upkeep));
    expect(mixed).toBe(Math.round(count * LINE_TIERS[1].upkeep));
    expect(mixed).toBeGreaterThan(wooden);
  });
});

describe('saving the quality of the grid', () => {
  const saved = (): Record<string, unknown> => {
    const world = city();
    build(world, 'line', 2, 3, 12, 3);
    build(world, 'lineConcrete', 13, 3, 19, 3);
    const sim = new Simulation(world, newSimState(7), 'Guardada');
    return JSON.parse(serialize({ name: 'X', seed: 7, world, sim: sim.state }));
  };

  it('keeps the quality of every pole through a save', () => {
    const world = city();
    build(world, 'line', 2, 3, 12, 3);
    build(world, 'lineConcrete', 13, 3, 19, 3);
    const sim = new Simulation(world, newSimState(7), 'Guardada');
    const back = deserialize(serialize({ name: 'X', seed: 7, world, sim: sim.state }));
    expect(Array.from(back.world.lineTier)).toEqual(Array.from(world.lineTier));
    expect(Array.from(back.world.lineTier).some((v) => v === 1)).toBe(true);
    expect(SAVE_VERSION).toBe(22);
  });

  it('opens a save from the version before the qualities as all wood', () => {
    const data = saved();
    data.version = 20;
    delete data.lineTier;
    const back = deserialize(JSON.stringify(data));
    expect(Array.from(back.world.lineTier).every((v) => v === 0)).toBe(true);
  });

  it('refuses a quality on a cell that is not a pole', () => {
    const data = saved();
    const world = city();
    const grid = new Uint8Array(world.n * world.n);
    grid[0] = 1;
    data.lineTier = toBase64(grid);
    expect(() => deserialize(JSON.stringify(data))).toThrow(/tendido/i);
  });
});

describe('what the player is told', () => {
  it('charges each quality its own price and upkeep', () => {
    expect(toolPrice('line')).toBe(LINE_TIERS[0].cost);
    expect(toolPrice('lineConcrete')).toBe(LINE_TIERS[1].cost);
    expect(placementUpkeep('lineConcrete')).toBe('mantenimiento $ 1/mes');
    expect(placementNote('lineConcrete')).toContain('5');
    expect(placementNote('line')).toContain('3');
  });

  it('offers the improvement from the start, and money is the only gate', () => {
    expect(isUnlocked('lineConcrete', 0)).toBe(true);
    expect(LINE_TIERS[1].cost).toBeGreaterThan(LINE_TIERS[0].cost * 2);
  });
});

describe('the poles of each quality', () => {
  const countOpaque = (px: { data: Uint8ClampedArray }): number => {
    let n = 0;
    for (let i = 3; i < px.data.length; i += 4) if (px.data[i]) n++;
    return n;
  };

  it('draws two different poles, both in hard pixels', () => {
    for (const v of [0, 1, 2]) {
      const wood = paintPole(0, v);
      const concrete = paintPole(1, v);
      expect(countOpaque(wood.px)).toBeGreaterThan(20);
      expect(countOpaque(concrete.px)).toBeGreaterThan(20);
      expect(Array.from(wood.px.data)).not.toEqual(Array.from(concrete.px.data));
      // Only the shadow may be half transparent, and it is black.
      for (let i = 0; i < wood.px.data.length; i += 4) {
        const a = wood.px.data[i + 3];
        if (a === 0 || a === 255) continue;
        expect(a).toBeLessThanOrEqual(96);
        expect(wood.px.data[i]).toBe(0);
        expect(wood.px.data[i + 1]).toBe(0);
        expect(wood.px.data[i + 2]).toBe(0);
      }
    }
  });

  it('hangs the cables from the attach point each quality publishes', () => {
    for (const tier of [0, 1] as const) {
      for (const v of [0, 1, 2]) expect(poleAttach(tier)).toEqual(paintPole(tier, v).attach);
    }
    // The concrete pole is the taller one: its cables hang higher.
    expect(poleAttach(1)[1]).toBeLessThan(poleAttach(0)[1]);
  });
});
