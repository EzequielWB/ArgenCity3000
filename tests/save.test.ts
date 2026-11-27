import { describe, expect, it } from 'vitest';
import { LOANS, TICKS_PER_MONTH } from '../src/config';
import { generateTerrain } from '../src/world/terrain';
import { World, TILE, zoneOf } from '../src/world/world';
import { applyPlan, dragCells, planTool } from '../src/world/tools';
import { Simulation, newSimState } from '../src/sim/simulation';
import { SAVE_VERSION, deserialize, serialize } from '../src/save/save';

function city(): { world: World; sim: Simulation } {
  const world = new World(generateTerrain(11, 32));
  const sim = new Simulation(world, newSimState(11), 'Villa Guardada');
  const b = (t: Parameters<typeof planTool>[1], ax: number, ay: number, bx = ax, by = ay) =>
    applyPlan(world, planTool(world, t, dragCells(t, ax, ay, bx, by, 1, 32)));
  b('plant', 2, 2);
  b('road', 1, 5, 20, 5);
  b('zoneR', 2, 6, 10, 8);
  b('line', 22, 5, 25, 5);
  for (let i = 0; i < 400; i++) sim.tick();
  return { world, sim };
}

describe('save', () => {
  it('round-trips the city, the simulation and the terrain', () => {
    const { world, sim } = city();
    const text = serialize({ name: 'Villa Guardada', seed: 11, world, sim: sim.state });
    const back = deserialize(text);
    expect(back.name).toBe('Villa Guardada');
    expect(back.seed).toBe(11);
    expect(Array.from(back.world.tiles)).toEqual(Array.from(world.tiles));
    expect(Array.from(back.world.level)).toEqual(Array.from(world.level));
    expect(Array.from(back.world.variant)).toEqual(Array.from(world.variant));
    expect(Array.from(back.world.terrain.corners)).toEqual(Array.from(world.terrain.corners));
    expect(Array.from(back.world.terrain.trees)).toEqual(Array.from(world.terrain.trees));
    expect(back.world.plants).toEqual(world.plants);
    expect(back.sim).toEqual(sim.state);
  });

  it('continues exactly like the original after loading', () => {
    const { world, sim } = city();
    const back = deserialize(serialize({ name: 'X', seed: 11, world, sim: sim.state }));
    const resumed = new Simulation(back.world, back.sim, 'X');
    for (let i = 0; i < 200; i++) {
      sim.tick();
      resumed.tick();
    }
    expect(Array.from(resumed.world.level)).toEqual(Array.from(world.level));
    expect(resumed.state.cash).toBe(sim.state.cash);
  });

  it('rejects text that is not a save', () => {
    expect(() => deserialize('hola')).toThrow(/partida/i);
    expect(() => deserialize('{}')).toThrow(/partida/i);
  });

  it('rejects other versions', () => {
    const { world, sim } = city();
    const data = JSON.parse(serialize({ name: 'X', seed: 1, world, sim: sim.state }));
    data.version = SAVE_VERSION + 1;
    expect(() => deserialize(JSON.stringify(data))).toThrow(/versión/i);
  });

  it('rejects impossible content', () => {
    const { world, sim } = city();
    const good = JSON.parse(serialize({ name: 'X', seed: 1, world, sim: sim.state }));

    const badPlant = structuredClone(good);
    badPlant.plants = [{ x: 999, y: 0 }];
    expect(() => deserialize(JSON.stringify(badPlant))).toThrow();

    const badCash = structuredClone(good);
    badCash.sim.cash = 'mucha';
    expect(() => deserialize(JSON.stringify(badCash))).toThrow();

    const badTiles = structuredClone(good);
    badTiles.tiles = badTiles.tiles.slice(0, 10);
    expect(() => deserialize(JSON.stringify(badTiles))).toThrow();

    // A plant entry whose cells are not plant tiles.
    const ghost = structuredClone(good);
    const w2 = deserialize(JSON.stringify(good)).world;
    for (let i = 0; i < w2.tiles.length; i++) if (w2.tiles[i] === TILE.PLANT) w2.tiles[i] = TILE.EMPTY;
    ghost.tiles = serializeBytes(w2.tiles);
    expect(() => deserialize(JSON.stringify(ghost))).toThrow();
  });

  it('keeps the big-fire mark, so a covered big fire burns down the same after loading', () => {
    const { world, sim } = city();
    // Un edificio denso con un cuartel de bomberos cubriéndolo: un fuego común se apaga, uno grande arde.
    applyPlan(world, planTool(world, 'fire', dragCells('fire', 2, 20, 2, 20, 1, 32)));
    let target = -1;
    for (let i = 0; i < world.tiles.length; i++) {
      if (zoneOf(world.tiles[i]) === 'R' && world.level[i] > 0 && !world.fire[i]) {
        world.level[i] = 3; // un edificio crecido: el que puede arder
        (sim as unknown as { ignite(i: number): void }).ignite(i);
        (sim as unknown as { state: { bigFire: number[] } }).state.bigFire.push(i);
        target = i;
        break;
      }
    }
    expect(target).toBeGreaterThanOrEqual(0);
    const back = deserialize(serialize({ name: 'X', seed: 11, world, sim: sim.state }));
    const resumed = new Simulation(back.world, back.sim, 'X');
    expect(back.sim.bigFire).toContain(target);
    // Con la marca, ambas partidas queman el edificio: la cobertura no lo salva.
    for (let i = 0; i < 3 * TICKS_PER_MONTH; i++) {
      sim.tick();
      resumed.tick();
    }
    expect(world.level[target]).toBe(0);
    expect(back.world.level[target]).toBe(0);
  });

  it('carries the fire counters, and an old save opens with them at zero', () => {
    const { world, sim } = city();
    for (let i = 0; i < world.tiles.length; i++) {
      if (zoneOf(world.tiles[i]) === 'R' && world.level[i] > 0) {
        world.level[i] = 3;
        (sim as unknown as { ignite(i: number): void }).ignite(i);
        break;
      }
    }
    expect(sim.stats.firesStarted).toBeGreaterThan(0);
    const back = deserialize(serialize({ name: 'X', seed: 11, world, sim: sim.state }));
    expect(back.sim.fireStats).toEqual({ firesStarted: sim.stats.firesStarted, firesSaved: sim.stats.firesSaved, buildingsBurned: sim.stats.buildingsBurned });

    // Un save de la versión anterior no trae las cuentas: abre en cero sin romper.
    const old = JSON.parse(serialize({ name: 'X', seed: 11, world, sim: sim.state })) as { sim: Record<string, unknown> };
    delete old.sim.fireStats;
    delete old.sim.bigFire;
    const legacy = deserialize(JSON.stringify(old));
    expect(legacy.sim.fireStats).toEqual({ firesStarted: 0, firesSaved: 0, buildingsBurned: 0 });
    expect(legacy.sim.bigFire).toEqual([]);
  });
});

function serializeBytes(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

describe('the loan in the save', () => {
  it('round-trips a loan in progress, and goes on paying it the same', () => {
    const { world, sim } = city();
    sim.takeLoan(2);
    for (let i = 0; i < 200; i++) sim.tick();
    expect(sim.state.loan!.paid).toBeGreaterThan(0);
    const back = deserialize(serialize({ name: 'X', seed: 11, world, sim: sim.state }));
    expect(back.sim.loan).toEqual(sim.state.loan);
    const resumed = new Simulation(back.world, back.sim, 'X');
    for (let i = 0; i < 400; i++) {
      sim.tick();
      resumed.tick();
    }
    expect(resumed.state.loan).toEqual(sim.state.loan);
    expect(resumed.state.cash).toBe(sim.state.cash);
  });

  it('opens any readable version, which owes nothing and has no loan line in its budget', () => {
    const { world, sim } = city();
    const mayor = 'Norma Quiroga';
    // The version after this one is refused; see "rejects other versions".
    for (let version = 1; version <= SAVE_VERSION; version++) {
      const data = JSON.parse(serialize({ name: 'X', seed: 11, mayor, world, sim: sim.state }));
      data.version = version;
      delete data.sim.loan;
      delete data.sim.lastBudget.loan;
      if (version < 6) delete data.mayor; // the mayor's name arrived in version 6
      const back = deserialize(JSON.stringify(data));
      expect(back.sim.loan).toBeNull();
      expect(back.sim.lastBudget!.loan).toBe(0);
      expect(back.mayor).toBe(version < 6 ? '' : mayor);
    }
  });

  it('rejects an impossible loan', () => {
    const { world, sim } = city();
    sim.takeLoan(0);
    const good = JSON.parse(serialize({ name: 'X', seed: 11, world, sim: sim.state }));
    const impossible = [
      { kind: LOANS.length, paid: 0 },
      { kind: -1, paid: 0 },
      { kind: 0.5, paid: 0 },
      { kind: null, paid: 0 },
      { kind: true, paid: 0 },
      { kind: 0, paid: -1 },
      // Already paid off: the simulation would have dropped the loan at the end of that month.
      { kind: 0, paid: LOANS[0].months },
      { kind: 0, paid: 1.5 },
      { kind: 0, paid: null },
      { kind: 0, paid: '2' },
      { kind: 'uno', paid: 0 },
    ];
    for (const loan of impossible) {
      const data = structuredClone(good);
      data.sim.loan = loan;
      expect(() => deserialize(JSON.stringify(data))).toThrow(/crédito/i);
    }
  });
});

describe('the mayor in the save', () => {
  it('round-trips the name the player chose', () => {
    const { world, sim } = city();
    const text = serialize({ name: 'Villa Guardada', seed: 11, mayor: 'Norma Quiroga', world, sim: sim.state });
    expect(deserialize(text).mayor).toBe('Norma Quiroga');
  });

  it('opens a save from before the name, where the Intendente is simply the Intendente', () => {
    const { world, sim } = city();
    const data = JSON.parse(serialize({ name: 'X', seed: 11, world, sim: sim.state }));
    data.version = 5;
    delete data.mayor;
    expect(deserialize(JSON.stringify(data)).mayor).toBe('');
  });

  it('keeps a name of any shape from breaking the load', () => {
    const { world, sim } = city();
    const good = JSON.parse(serialize({ name: 'X', seed: 11, world, sim: sim.state }));
    // Name and city are free text: a long or non-text value is trimmed or dropped, never fatal.
    const long = structuredClone(good);
    long.mayor = 'x'.repeat(200);
    expect(deserialize(JSON.stringify(long)).mayor).toHaveLength(40);
    const notText = structuredClone(good);
    notText.mayor = 7;
    expect(deserialize(JSON.stringify(notText)).mayor).toBe('');
  });
});

