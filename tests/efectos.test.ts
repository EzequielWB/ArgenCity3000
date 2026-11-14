import { describe, expect, it } from 'vitest';
import { MAX_FUNDING, TICKS_PER_MONTH } from '../src/config';
import { COAST_WORN, FREEZE, INDUSTRY_BOOM, INDUSTRY_FROZEN, NO_BLACKOUT, coolOf, lockOf, tickEffects } from '../src/sim/effects';
import { computeLandValue } from '../src/sim/fields';
import { monthlyBudget } from '../src/sim/budget';
import { Simulation, newSimState } from '../src/sim/simulation';
import { deserialize, serialize } from '../src/save/save';
import { generateTerrain } from '../src/world/terrain';
import { applyPlan, dragCells, planTool } from '../src/world/tools';
import { TILE, World, type World as WorldType } from '../src/world/world';

const N = 40;

function flat(): World {
  return new World({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(30), trees: new Uint8Array(N * N) });
}

/** A city with a street, a line and a residential block that grows when it is ticked. */
function town(): { world: WorldType; sim: Simulation } {
  const world = flat();
  for (let x = 4; x < 20; x++) world.tiles[world.idx(x, 10)] = TILE.ROAD;
  for (let x = 4; x < 20; x++) world.tiles[world.idx(x, 12)] = TILE.LINE;
  for (let y = 11; y < 16; y++) for (let x = 5; x < 20; x++) world.tiles[world.idx(x, y)] = TILE.R;
  world.tiles[world.idx(18, 13)] = TILE.I;
  world.tiles[world.idx(18, 14)] = TILE.I;
  const sim = new Simulation(world, newSimState(3), 'Villa Efecto');
  return { world, sim };
}

const built = (w: World): number => w.level.reduce((n, v) => n + (v > 0 ? 1 : 0), 0);

/** A town with light, a street and homes: it grows by itself when it is ticked. */
function growing(): { world: WorldType; sim: Simulation } {
  const world = flat();
  const build = (tool: Parameters<typeof planTool>[1], ax: number, ay: number, bx = ax, by = ay) =>
    applyPlan(world, planTool(world, tool, dragCells(tool, ax, ay, bx, by, 1, N)));
  build('plant', 0, 1);
  build('road', 0, 3, 31, 3);
  build('zoneR', 2, 4, 16, 6);
  return { world, sim: new Simulation(world, newSimState(3), 'Villa Efecto') };
}

/** Homes on one side and one big workshop on the other: the industrial demand lands mid-range. */
function mixed(): Simulation {
  const { world, sim } = growing();
  let workshop = 0;
  for (let i = 0; i < world.tiles.length; i++) {
    if (world.tiles[i] === TILE.R) world.level[i] = 2;
    if (world.tiles[i] === TILE.I && !workshop) {
      workshop = i;
      world.level[i] = 4;
    }
  }
  world.tiles[workshop] = TILE.EMPTY;
  // A workshop of its own, on the far side of the street, with its level and its light.
  const cell = world.idx(28, 5);
  world.tiles[cell] = TILE.I;
  world.level[cell] = 4;
  sim.refresh();
  return sim;
}

describe('an effect lasts the months it says', () => {
  it('counts down on its own and disappears', () => {
    const { sim } = town();
    sim.effect('algo', 2);
    expect(sim.hasEffect('algo')).toBe(true);
    for (let i = 0; i < TICKS_PER_MONTH; i++) sim.tick();
    expect(sim.hasEffect('algo')).toBe(true); // one month left
    for (let i = 0; i < TICKS_PER_MONTH; i++) sim.tick();
    expect(sim.hasEffect('algo')).toBe(false);
    expect(sim.state.effects).toEqual({});
  });

  it('extends but never shortens', () => {
    const { sim } = town();
    sim.effect('algo', 5);
    sim.effect('algo', 2);
    expect(sim.state.effects.algo).toBe(5);
    sim.effect('algo', 9);
    expect(sim.state.effects.algo).toBe(9);
  });

  it('ignores a zero-month effect', () => {
    const { sim } = town();
    sim.effect('algo', 0);
    expect(sim.hasEffect('algo')).toBe(false);
  });

  it('drops the ones that hit zero, one by one', () => {
    const effects = { a: 1, b: 3 };
    tickEffects(effects);
    expect(effects).toEqual({ b: 2 });
  });
});

describe('the growth brake', () => {
  it('raises no building at all while it runs', () => {
    const { world, sim } = town();
    sim.effect(FREEZE, 2);
    for (let i = 0; i < TICKS_PER_MONTH * 2; i++) sim.tick();
    expect(built(world)).toBe(0);
  });

  it('lets the city grow again once it is over', () => {
    // The same city twice, same seed: the only difference is the three months it could not build.
    const braked = growing();
    const free = growing();
    braked.sim.effect(FREEZE, 3);
    for (let i = 0; i < TICKS_PER_MONTH * 3; i++) {
      braked.sim.tick();
      free.sim.tick();
    }
    expect(built(braked.world)).toBe(0);
    expect(built(free.world)).toBeGreaterThan(0);
    // The brake is over: the city picks up where it left off.
    for (let i = 0; i < TICKS_PER_MONTH * 3; i++) braked.sim.tick();
    expect(built(braked.world)).toBeGreaterThan(0);
  });
});

describe('the industry runs hot or cold', () => {
  it('halves the industrial demand while frozen', () => {
    const { sim } = town();
    const before = sim.demand.I;
    sim.effect(INDUSTRY_FROZEN, 6);
    sim.refresh();
    expect(sim.demand.I).toBeLessThan(before);
    expect(sim.demand.I).toBe(Math.round(before * 0.5));
  });

  it('raises it while booming, and the two together multiply', () => {
    const sim = mixed();
    const before = sim.demand.I;
    expect(before).toBeGreaterThan(10);
    expect(before).toBeLessThan(80);
    sim.effect(INDUSTRY_BOOM, 6);
    sim.refresh();
    expect(sim.demand.I).toBe(Math.round(before * 1.4));
    sim.effect(INDUSTRY_FROZEN, 6);
    sim.refresh();
    expect(sim.demand.I).toBe(Math.round(before * 1.4 * 0.5));
  });

  it('leaves the other zones alone', () => {
    const { sim } = town();
    const before = { ...sim.demand };
    sim.effect(INDUSTRY_FROZEN, 6);
    sim.refresh();
    expect(sim.demand.R).toBe(before.R);
    expect(sim.demand.C).toBe(before.C);
  });
});

describe('the coast', () => {
  const coast = () => {
    const world = new World(generateTerrain(11, 32));
    // A resort on the shore earns by tourism; land next to the water is worth more.
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const i = world.idx(x, y);
        if (world.isWater(x, y)) continue;
        const nearWater = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => world.isWater(x + dx, y + dy));
        if (nearWater && world.tiles[i] === TILE.EMPTY) {
          world.tiles[i] = TILE.RESORT;
          break;
        }
      }
    }
    return world;
  };

  it('earns half again with the season boost', () => {
    const w = coast();
    const plain = monthlyBudget(w, 7, undefined, null, 0, 100);
    const boosted = monthlyBudget(w, 7, undefined, null, 0, 100, 1.5);
    expect(boosted.coastIncome).toBe(plain.coastIncome * 1.5);
  });

  it('loses value next to the water when the seafront wears out', () => {
    const w = coast();
    computeLandValue(w);
    let best = 0;
    let cell = 0;
    for (let i = 0; i < w.landValue.length; i++) if (w.landValue[i] > best) (best = w.landValue[i]), (cell = i);
    computeLandValue(w, COAST_WORN === 'coastWorn' ? 0.4 : 1);
    expect(w.landValue[cell]).toBeLessThan(best);
  });
});

describe('power bought from the Province', () => {
  it('covers a shortage for as long as the deal lasts', () => {
    const { world, sim } = town();
    // A city that asks for more than it has: no plants at all, so anything built is in the dark.
    expect(world.plants.length).toBe(0);
    sim.refresh();
    sim.effect(NO_BLACKOUT, 3);
    sim.refresh();
    expect(sim.power.shortage).toBe(false);
  });
});

describe('a slider nobody can move', () => {
  it('refuses the change while the lock runs, and takes it after', () => {
    const { sim } = town();
    sim.setFunding('clinic', 120);
    sim.effect(lockOf('clinic'), 2);
    sim.setFunding('clinic', 40);
    expect(sim.state.funding.clinic).toBe(120);
    sim.effect(lockOf('green'), 1);
    sim.setGreen(20);
    expect(sim.state.green).toBe(100);
    for (let i = 0; i < TICKS_PER_MONTH * 2; i++) sim.tick();
    sim.setFunding('clinic', 40);
    expect(sim.state.funding.clinic).toBe(40);
    expect(MAX_FUNDING).toBe(120);
  });
});

describe('abandoning a building by hand', () => {
  it('empties it and takes its people with it', () => {
    const { world, sim } = town();
    for (let i = 0; i < world.tiles.length; i++) if (world.tiles[i] === TILE.I) world.level[i] = 3;
    sim.refresh();
    const before = sim.totals.iJobs;
    const cell = world.idx(18, 13);
    sim.abandonBuilding(cell);
    expect(world.abandoned[cell]).toBe(1);
    expect(sim.totals.iJobs).toBeLessThan(before);
    expect(sim.abandonedCount).toBe(1);
  });

  it('does nothing on an empty cell', () => {
    const { world, sim } = town();
    sim.abandonBuilding(world.idx(0, 0));
    expect(world.abandoned[world.idx(0, 0)]).toBe(0);
    expect(sim.abandonedCount).toBe(0);
  });
});

describe('dice and headlines', () => {
  it('chance uses the game dice and stays inside its bounds', () => {
    const { sim } = town();
    expect(sim.chance(0)).toBe(false);
    expect(sim.chance(1)).toBe(true);
    let hits = 0;
    for (let i = 0; i < 200; i++) if (sim.chance(0.3)) hits++;
    expect(hits).toBeGreaterThan(20);
    expect(hits).toBeLessThan(140);
  });

  it('report publishes in the paper at once', () => {
    const { sim } = town();
    sim.report('Se cerró la calle');
    expect(sim.state.news[0].text).toBe('Se cerró la calle');
  });
});

describe('the effects travel with the save', () => {
  it('keeps them month by month', () => {
    const world = new World(generateTerrain(5, 24));
    const sim = new Simulation(world, newSimState(5), 'Villa Efecto');
    sim.effect(INDUSTRY_FROZEN, 6);
    sim.effect(coolOf('piquete'), 4);
    const back = deserialize(serialize({ name: 'Villa Efecto', seed: 5, world, sim: sim.state }));
    expect(back.sim.effects).toEqual({ industryFrozen: 6, 'cool:piquete': 4 });
  });

  it('opens an older save with none', () => {
    const world = new World(generateTerrain(5, 24));
    const sim = new Simulation(world, newSimState(5), 'Villa Efecto');
    const text = JSON.parse(serialize({ name: 'Villa Efecto', seed: 5, world, sim: sim.state }));
    text.version = 13;
    delete text.sim.effects;
    expect(deserialize(JSON.stringify(text)).sim.effects).toEqual({});
  });

  it('refuses effects that make no sense', () => {
    const world = new World(generateTerrain(5, 24));
    const sim = new Simulation(world, newSimState(5), 'Villa Efecto');
    const text = JSON.parse(serialize({ name: 'Villa Efecto', seed: 5, world, sim: sim.state }));
    text.sim.effects = { freeze: -3 };
    expect(() => deserialize(JSON.stringify(text))).toThrow(/efectos/i);
    text.sim.effects = { freeze: 5, '': 2 };
    expect(() => deserialize(JSON.stringify(text))).toThrow(/efectos/i);
  });
});

describe('the brake explains itself', () => {
  it('says on the HUD why nobody new arrives while it lasts', () => {
    const { sim } = growing();
    sim.effect(FREEZE, 1);
    sim.refresh();
    expect(sim.stall).toBe('stopped');
    expect(sim.stallText()).toMatch(/frenada/i);
  });
});
