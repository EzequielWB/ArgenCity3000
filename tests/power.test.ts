import { describe, expect, it } from 'vitest';
import { LINE_REACH, PLANT_CAPACITY, POWER_REACH, POWER_USE } from '../src/config';
import { computePower, reachCells } from '../src/sim/power';
import { Simulation, newSimState } from '../src/sim/simulation';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { TILE, World } from '../src/world/world';

function flat(n = 64, waterFromX = n): Terrain {
  const s = n + 1;
  const corners = new Uint8Array(s * s);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) corners[y * s + x] = x >= waterFromX ? SEA_LEVEL - 1 : SEA_LEVEL + 1;
  return { n, corners, trees: new Uint8Array(n * n) };
}

function plant(w: World, x: number, y: number): void {
  for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) w.setTile(x + dx, y + dy, TILE.PLANT);
  w.plants.push({ x, y, kind: 'coal' });
}

/** A built house (level 1). */
function house(w: World, x: number, y: number, level = 1): void {
  w.setTile(x, y, TILE.R, level);
}

/** A zoned lot with no building. */
function lot(w: World, x: number, y: number, tile: number = TILE.R): void {
  w.setTile(x, y, tile, 0);
}

function lit(w: World, x: number, y: number): boolean {
  return w.powered[w.idx(x, y)] === 1;
}

describe('light reach', () => {
  it('exposes the reach constants', () => {
    expect(POWER_REACH).toBe(3);
    expect(LINE_REACH).toBe(1);
  });

  it('roads do not conduct: a house at the far end of a long road stays dark', () => {
    const w = new World(flat());
    plant(w, 2, 2);
    for (let x = 4; x <= 40; x++) w.setTile(x, 3, TILE.ROAD);
    house(w, 41, 3);
    computePower(w);
    expect(lit(w, 41, 3)).toBe(false);
  });

  it('a road is lit when it is inside some relay reach, but does not pass the light on', () => {
    const w = new World(flat());
    plant(w, 2, 2);
    for (let x = 4; x <= 40; x++) w.setTile(x, 3, TILE.ROAD);
    computePower(w);
    expect(lit(w, 5, 3)).toBe(true);
    expect(lit(w, 20, 3)).toBe(false);
  });

  it('the plant lights lots within 3 of its footprint and not beyond (disc shape)', () => {
    const w = new World(flat());
    plant(w, 10, 10); // footprint 10..11 x 10..11
    // Empty lots receive the light but do not pass it on, so each probe is judged on its own.
    lot(w, 14, 10); // 3 from x=11
    lot(w, 15, 10); // 4 from x=11
    lot(w, 14, 13); // dx 3, dy 2 from (11,11): 9 + 4 = 13 > 9
    lot(w, 13, 13); // dx 2, dy 2 from (11,11): 8 <= 9
    lot(w, 14, 12); // dx 3, dy 1 from (11,11): 10 > 9
    computePower(w);
    expect(lit(w, 14, 10)).toBe(true);
    expect(lit(w, 15, 10)).toBe(false);
    expect(lit(w, 14, 13)).toBe(false);
    expect(lit(w, 13, 13)).toBe(true);
    expect(lit(w, 14, 12)).toBe(false);
  });

  it('a built building lights lots within 3 and not at 4', () => {
    const w = new World(flat());
    plant(w, 2, 2);
    house(w, 6, 2); // lit by the plant (dx 3 from x=3)
    house(w, 9, 2); // 3 from the first house
    house(w, 13, 2); // 4 from the second one
    computePower(w);
    expect(lit(w, 6, 2)).toBe(true);
    expect(lit(w, 9, 2)).toBe(true);
    expect(lit(w, 13, 2)).toBe(false);
  });

  it('an empty zoned lot does not relay: a strip of empty lots does not carry the light', () => {
    const w = new World(flat());
    plant(w, 2, 2);
    for (let x = 6; x <= 30; x++) lot(w, x, 2);
    house(w, 31, 2);
    computePower(w);
    expect(lit(w, 31, 2)).toBe(false);
    expect(lit(w, 6, 2)).toBe(true); // an empty lot can receive light
  });

  it('a chain of occupied buildings spaced 3 apart carries the light far from the plant', () => {
    const w = new World(flat());
    plant(w, 2, 2);
    for (let k = 1; k <= 10; k++) house(w, 3 + 3 * k, 2);
    computePower(w);
    expect(lit(w, 33, 2)).toBe(true);
  });

  it('a power line carries the light across 30 cells', () => {
    const w = new World(flat());
    plant(w, 2, 2);
    for (let x = 4; x <= 40; x++) w.setTile(x, 2, TILE.LINE);
    house(w, 41, 2);
    computePower(w);
    expect(lit(w, 41, 2)).toBe(true);
  });

  it('a power line crosses water', () => {
    const w = new World(flat(64, 12));
    plant(w, 2, 2);
    for (let x = 4; x <= 24; x++) w.setTile(x, 2, TILE.LINE); // water from x = 12
    house(w, 25, 2);
    computePower(w);
    expect(w.isWater(15, 2)).toBe(true);
    expect(lit(w, 25, 2)).toBe(true);
  });

  it('a line cell lights the lot next to it but not two cells away', () => {
    const w = new World(flat());
    plant(w, 2, 2);
    for (let x = 4; x <= 20; x++) w.setTile(x, 2, TILE.LINE);
    house(w, 20, 3);
    house(w, 12, 4);
    computePower(w);
    expect(lit(w, 20, 3)).toBe(true);
    expect(lit(w, 12, 4)).toBe(false);
  });

  it('a dark building (capacity shortage) still relays: everything behind it is still part of the network', () => {
    const w = new World(flat());
    plant(w, 2, 2);
    // A dense block of heavy industry near the plant eats the capacity first (BFS order).
    for (let k = 0; k < 25; k++) w.setTile(4 + (k % 5), 4 + Math.floor(k / 5), TILE.I, 4);
    // A chain of heavy buildings spaced 3 apart leads away from it, ending in a house.
    for (let x = 6; x <= 27; x += 3) w.setTile(x, 2, TILE.I, 4);
    house(w, 30, 2);
    const r = computePower(w);
    expect(r.shortage).toBe(true);
    expect(lit(w, 24, 2)).toBe(false); // dark by capacity...
    expect(r.use).toBe(25 * 4 * POWER_USE.I + 8 * 4 * POWER_USE.I + POWER_USE.R); // ...yet everything behind it was reached
  });

  it('capacity still limits the network and flags a shortage, taking power in BFS order', () => {
    const w = new World(flat());
    plant(w, 2, 2);
    for (let k = 0; k < 40; k++) w.setTile(4 + (k % 8), 4 + Math.floor(k / 8), TILE.I, 4);
    const r = computePower(w);
    expect(r.capacity).toBe(PLANT_CAPACITY);
    expect(r.shortage).toBe(true);
    let powered = 0;
    for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === TILE.I && w.powered[i]) powered++;
    expect(powered).toBe(Math.floor(PLANT_CAPACITY / (4 * POWER_USE.I)));
    // The ones nearest to the plant are served first.
    expect(lit(w, 4, 4)).toBe(true);
  });

  it('two plants joined by a chain of buildings share their capacity', () => {
    const w = new World(flat());
    plant(w, 2, 2);
    plant(w, 22, 2);
    for (const x of [6, 9, 12, 15, 18]) house(w, x, 2);
    const r = computePower(w);
    expect(r.capacity).toBe(2 * PLANT_CAPACITY);
  });

  it('two plants that cannot reach each other keep separate networks', () => {
    const w = new World(flat());
    plant(w, 2, 2);
    plant(w, 40, 2);
    house(w, 5, 2);
    house(w, 38, 2);
    expect(computePower(w).capacity).toBe(2 * PLANT_CAPACITY);
    // Each house sits in its own network: put heavy load on the first one only.
    for (let k = 0; k < 40; k++) w.setTile(3 + (k % 8), 8 + Math.floor(k / 8), TILE.I, 4);
    computePower(w);
    expect(lit(w, 38, 2)).toBe(true);
  });

  it('abandoned and burning buildings still relay; a demolished one does not', () => {
    const w = new World(flat());
    plant(w, 2, 2);
    house(w, 6, 2);
    house(w, 9, 2);
    house(w, 12, 2);
    w.abandoned[w.idx(9, 2)] = 1;
    computePower(w);
    expect(lit(w, 12, 2)).toBe(true);
    w.abandoned[w.idx(9, 2)] = 0;
    w.fire[w.idx(9, 2)] = 50;
    computePower(w);
    expect(lit(w, 12, 2)).toBe(true);
    w.fire[w.idx(9, 2)] = 0;
    w.level[w.idx(9, 2)] = 0; // burned down: an empty lot no longer relays
    computePower(w);
    expect(lit(w, 12, 2)).toBe(false);
    expect(lit(w, 6, 2)).toBe(true);
  });

  it('demolishing a middle building darkens the dependents after the recompute', () => {
    const w = new World(flat());
    plant(w, 2, 2);
    for (const x of [6, 9, 12, 15]) house(w, x, 2);
    computePower(w);
    expect(lit(w, 15, 2)).toBe(true);
    w.setTile(9, 2, TILE.EMPTY);
    computePower(w);
    expect(lit(w, 12, 2)).toBe(false);
    expect(lit(w, 15, 2)).toBe(false);
    expect(lit(w, 6, 2)).toBe(true);
  });

  it('parks receive light but do not relay it', () => {
    const w = new World(flat());
    plant(w, 2, 2);
    w.setTile(6, 2, TILE.PARK);
    house(w, 9, 2); // 3 from the park, 6 from the plant
    computePower(w);
    expect(lit(w, 6, 2)).toBe(true);
    expect(lit(w, 9, 2)).toBe(false);
  });

  it('services relay and need light', () => {
    const w = new World(flat());
    plant(w, 2, 2);
    w.setTile(6, 2, TILE.SCHOOL, 1);
    house(w, 9, 2);
    w.setTile(30, 30, TILE.CLINIC, 1); // out of reach
    computePower(w);
    expect(lit(w, 6, 2)).toBe(true);
    expect(lit(w, 9, 2)).toBe(true);
    expect(lit(w, 30, 30)).toBe(false);
  });

  it('empty land inside the reach counts as lit while the network has spare capacity', () => {
    const w = new World(flat());
    plant(w, 2, 2);
    computePower(w);
    expect(lit(w, 6, 2)).toBe(true);
    expect(lit(w, 20, 20)).toBe(false);
  });
});

describe('light reach in the simulation', () => {
  /** A plant, a short chain of houses and plenty of spare capacity. */
  function city(): Simulation {
    const w = new World(flat());
    plant(w, 2, 2);
    for (let x = 4; x <= 20; x++) w.setTile(x, 4, TILE.ROAD);
    house(w, 6, 3);
    house(w, 9, 3);
    house(w, 12, 3);
    return new Simulation(w, newSimState(7), 'Test');
  }

  it('the light of the chain is there from the start', () => {
    const sim = city();
    expect(lit(sim.world, 12, 3)).toBe(true);
  });

  it('a fire that burns a house down darkens the ones that depended on it within a few ticks', () => {
    const sim = city();
    const w = sim.world;
    w.fire[w.idx(9, 3)] = 1; // the last tick of a fire nobody put out
    sim.refresh();
    sim.tick();
    expect(w.level[w.idx(9, 3)]).toBe(0);
    expect(sim.powerDirty).toBe(true);
    for (let k = 0; k < 3; k++) sim.tick(); // well before the periodic recompute of the 5th tick
    expect(sim.powerDirty).toBe(false);
    expect(lit(w, 12, 3)).toBe(false);
    expect(lit(w, 6, 3)).toBe(true);
  });

  it('a fire in progress does not switch off the chain', () => {
    const sim = city();
    const w = sim.world;
    w.fire[w.idx(9, 3)] = 90;
    sim.refresh();
    for (let k = 0; k < 10; k++) sim.tick();
    expect(w.level[w.idx(9, 3)]).toBeGreaterThan(0);
    expect(lit(w, 12, 3)).toBe(true);
  });

  it('an abandoned house keeps relaying', () => {
    const sim = city();
    const w = sim.world;
    w.abandoned[w.idx(9, 3)] = 1;
    sim.refresh();
    for (let k = 0; k < 10; k++) sim.tick();
    expect(lit(w, 12, 3)).toBe(true);
  });

  it('the lit area follows the growth: after any tick that leaves the network clean, it matches a fresh computation', () => {
    const w = new World(flat(48));
    plant(w, 2, 2);
    plant(w, 2, 8);
    for (let x = 4; x <= 44; x++) w.setTile(x, 5, TILE.ROAD);
    for (let x = 5; x <= 44; x++) {
      for (const y of [3, 4, 6, 7]) w.setTile(x, y, y < 5 ? TILE.R : TILE.C);
    }
    const sim = new Simulation(w, newSimState(11), 'Test');
    sim.state.cash = 1_000_000;
    sim.demand = { R: 100, C: 100, I: 100 };
    let built = 0;
    let checked = 0;
    for (let k = 0; k < 600; k++) {
      sim.tick();
      if (k % 25 === 0) sim.demand = { R: 100, C: 100, I: 100 };
      if (sim.powerDirty) continue;
      const mine = Uint8Array.from(w.powered);
      computePower(w);
      expect(Array.from(w.powered)).toEqual(Array.from(mine));
      checked++;
    }
    for (let i = 0; i < w.level.length; i++) if (w.level[i] > 0) built++;
    expect(built).toBeGreaterThan(20);
    expect(checked).toBeGreaterThan(50);
    // The city spread past the plant's own reach, building by building.
    let farthest = 0;
    for (let i = 0; i < w.level.length; i++) if (w.level[i] > 0) farthest = Math.max(farthest, i % w.n);
    expect(farthest).toBeGreaterThan(12);
  });
});

describe('reachCells', () => {
  it('lists the lots a plant would light around its footprint, without the footprint and inside the map', () => {
    const foot: [number, number][] = [
      [10, 10],
      [11, 10],
      [10, 11],
      [11, 11],
    ];
    const cells = reachCells(64, foot, POWER_REACH);
    const has = (x: number, y: number) => cells.some(([cx, cy]) => cx === x && cy === y);
    expect(has(10, 10)).toBe(false); // the footprint itself
    expect(has(7, 10)).toBe(true); // 3 lots to the left of the footprint
    expect(has(6, 10)).toBe(false); // 4 lots away
    expect(has(14, 11)).toBe(true);
    expect(has(8, 8)).toBe(true); // dx² + dy² = 8 from the corner
    expect(has(7, 7)).toBe(false); // 18 > 9
    expect(new Set(cells.map(([x, y]) => `${x},${y}`)).size).toBe(cells.length); // no repeats
  });

  it('stays inside the map at the border', () => {
    const cells = reachCells(16, [[0, 0]], POWER_REACH);
    expect(cells.every(([x, y]) => x >= 0 && y >= 0 && x < 16 && y < 16)).toBe(true);
    expect(cells.length).toBe(10); // the quarter disc of radius 3, without the centre
  });
});
