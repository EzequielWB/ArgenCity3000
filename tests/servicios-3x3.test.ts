import { describe, expect, it } from 'vitest';
import { DEFAULT_FUNDING, SERVICE_SIZE, SERVICES } from '../src/config';
import { deserialize, serialize } from '../src/save/save';
import { monthlyBudget, serviceUpkeep } from '../src/sim/budget';
import { computeServices, residentsServed, utilization } from '../src/sim/fields';
import { computePower } from '../src/sim/power';
import { Simulation, newSimState } from '../src/sim/simulation';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { applyPlan, dragCells, planTool } from '../src/world/tools';
import { serviceAt, serviceBlocks, serviceFootprint } from '../src/world/services';
import { toView } from '../src/core/iso';
import { TILE, World } from '../src/world/world';

const N = 40;
const flat = (): Terrain => ({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(N * N) });

/** A world that plans and applies a tool, the way the game does. */
function build(w: World, tool: any, ax: number, ay: number, bx = ax, by = ay) {
  const plan = planTool(w, tool, dragCells(tool, ax, ay, bx, by, 1, N));
  applyPlan(w, plan);
  return plan;
}

/** A block of homes with a street and a power plant, so a hospital there is lit and has customers. */
function city(extra?: (w: World) => void): World {
  const w = new World(flat());
  build(w, 'plant', 0, 11);
  build(w, 'road', 2, 10, 36, 10);
  build(w, 'zoneR', 3, 11, 36, 14);
  for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === TILE.R) w.level[i] = 3;
  extra?.(w);
  return w;
}

const count = (w: World, tile: number) => w.tiles.reduce((sum, t) => sum + (t === tile ? 1 : 0), 0);

describe('the hospital and the university take 3x3 lots', () => {
  it('the two of them are three lots wide and the other four stay at one', () => {
    expect(SERVICE_SIZE.hospital).toBe(3);
    expect(SERVICE_SIZE.university).toBe(3);
    for (const kind of ['school', 'clinic', 'police', 'fire'] as const) expect(SERVICE_SIZE[kind]).toBe(1);
    // The tile decides the block: nine lots of the same kind, rebuilt from the plan and not from a list.
    const w = city((x) => build(x, 'hospital', 20, 16));
    expect(count(w, TILE.HOSPITAL)).toBe(9);
    expect(serviceBlocks(w.tiles, w.n)).toEqual([{ kind: 'hospital', x: 20, y: 16, size: 3 }]);
    // Every lot of the block points at the same building, and a lot outside it points at none.
    for (const [x, y] of serviceFootprint('hospital', w.n, 20, 16)) {
      const block = serviceAt(w, x, y);
      expect([block?.kind, block?.x, block?.y]).toEqual(['hospital', 20, 16]);
    }
    expect(serviceAt(w, 19, 16)).toBeNull();
    expect(serviceAt(w, 20, 19)).toBeNull();
  });

  it('are one building for the upkeep: nine lots pay one hospital a month', () => {
    const w = city((x) => build(x, 'hospital', 20, 16));
    const budget = monthlyBudget(w, 7);
    const one = Math.round((serviceUpkeep('hospital', utilization(w, w.idx(20, 16), 'hospital')) * DEFAULT_FUNDING.hospital) / 100);
    expect(budget.hospitals).toBe(one);
    // Nine lots each paying their own upkeep is what this rule is against: at the flat share alone that
    // would be more than the whole upkeep of a hospital.
    expect(budget.hospitals).toBeLessThanOrEqual(SERVICES.hospital.upkeep);
  });

  it('are one building for the coverage: one disc, centred on the anchor and not on any of its lots', () => {
    const w = city((x) => build(x, 'hospital', 20, 16));
    computePower(w);
    computeServices(w);
    // The same distance on either side of the anchor has to cover the same: a disc per lot would lean
    // the coverage towards whichever lot was drawn last.
    const west = w.hospital[w.idx(20 - 5, 16)];
    const east = w.hospital[w.idx(20 + 5, 16)];
    const north = w.hospital[w.idx(20, 16 - 5)];
    const south = w.hospital[w.idx(20, 16 + 5)];
    expect(west).toBeGreaterThan(0);
    expect([east, north, south]).toEqual([west, west, west]);
    // And the disc belongs to the anchor: a disc centred on the front corner would serve a different
    // number of neighbours, because the homes are all on one side.
    expect(residentsServed(w, w.idx(20, 16), 'hospital')).not.toBe(residentsServed(w, w.idx(22, 18), 'hospital'));
  });

  it('are one building for the light: the block asks once and is lit as a whole', () => {
    const without = city();
    const withHospital = city((x) => build(x, 'hospital', 20, 16));
    // The city is the same on both sides of the difference, so what the hospital asks for is the delta.
    expect(computePower(withHospital).use - computePower(without).use).toBe(SERVICES.hospital.power);
    for (const [x, y] of serviceFootprint('hospital', withHospital.n, 20, 16)) expect(withHospital.powered[withHospital.idx(x, y)]).toBe(1);
  });

  it('go up whole or not at all, and are charged once', () => {
    const w = city();
    const plan = planTool(w, 'hospital', dragCells('hospital', 20, 16, 20, 16, 1, N));
    expect(plan.cells.length).toBe(9);
    expect(plan.cost).toBe(SERVICES.hospital.cost);
    // One lot taken in the middle of the block and the hospital does not go up at all.
    build(w, 'school', 21, 17);
    const blocked = planTool(w, 'hospital', dragCells('hospital', 20, 16, 20, 16, 1, N));
    expect(blocked.cells).toEqual([]);
    expect(blocked.cost).toBe(0);
    // The small services are still one lot each.
    const school = planTool(w, 'clinic', dragCells('clinic', 30, 16, 30, 16, 1, N));
    expect(school.cells.length).toBe(1);
  });

  it('come down whole: a corner lot is not a hospital to demolish', () => {
    const w = city((x) => build(x, 'hospital', 20, 16));
    const plan = planTool(w, 'bulldoze', dragCells('bulldoze', 22, 18, 22, 18, 1, N));
    expect(plan.cells.length).toBe(9);
    applyPlan(w, plan);
    expect(count(w, TILE.HOSPITAL)).toBe(0);
    expect(serviceBlocks(w.tiles, w.n)).toEqual([]);
  });

  it('keeps the one sprite in front of the block, and the front lot turns with the camera', () => {
    const w = city((x) => build(x, 'hospital', 20, 16));
    const foot = serviceFootprint('hospital', w.n, 20, 16);
    for (const rot of [0, 1, 2, 3] as const) {
      const seen = foot.map(([x, y]) => toView(x, y, rot, w.n));
      const fx = Math.max(...seen.map((c) => c[0]));
      const fy = Math.max(...seen.map((c) => c[1]));
      // Exactly one lot of the block is the one in front: the drawing happens there and nowhere else.
      expect(seen.filter((c) => c[0] === fx && c[1] === fy).length).toBe(1);
    }
  });

  it('opens an old city by growing the single lot it was saved with', () => {
    const w = city();
    // A save from when the hospital was one lot: only the anchor, the rest of the block free.
    w.setTile(20, 16, TILE.HOSPITAL);
    const sim = new Simulation(w, newSimState(1), 'X');
    const text = serialize({ name: 'X', seed: 1, world: w, sim: sim.state });
    const opened = deserialize(text);
    expect(count(opened.world, TILE.HOSPITAL)).toBe(9);
    expect(serviceBlocks(opened.world.tiles, opened.world.n).map((b) => [b.x, b.y])).toEqual([[20, 16]]);
  });

  it('says out loud when an old city has no room for the block', () => {
    const w = city();
    w.setTile(20, 16, TILE.HOSPITAL);
    // The ground the hospital needs is taken: the city cannot open half a hospital.
    w.setTile(21, 17, TILE.SCHOOL);
    const sim = new Simulation(w, newSimState(1), 'X');
    const text = serialize({ name: 'X', seed: 1, world: w, sim: sim.state });
    expect(() => deserialize(text)).toThrow(/Hospital: no tiene lugar para su lote de 3×3/);
  });
});
