import { describe, expect, it } from 'vitest';
import { cornersFromElevation, dominantBearing, rasterLine4 } from '../scripts/mapgen/geo';
import { PRESETS, decodePreset, encodePreset, worldFromPreset, type MapPreset } from '../src/world/presets';
import { MAX_HEIGHT, SEA_LEVEL, isWaterCell } from '../src/world/terrain';
import { TILE, World } from '../src/world/world';
import { deserialize, serialize } from '../src/save/save';
import { newSimState } from '../src/sim/simulation';
import { monthlyBudget } from '../src/sim/budget';
import { UPKEEP } from '../src/config';
import { applyPlan, dragCells, planTool, type ToolId } from '../src/world/tools';
import { UndoHistory } from '../src/world/history';

function build(w: World, tool: ToolId, ax: number, ay: number, bx = ax, by = ay) {
  applyPlan(w, planTool(w, tool, dragCells(tool, ax, ay, bx, by, 1, w.n)));
}

describe('dominantBearing', () => {
  it('finds the angle of a rotated street grid, ignoring a few odd streets', () => {
    const segs: [number, number, number, number][] = [];
    const a = (37 * Math.PI) / 180;
    for (let k = 0; k < 10; k++) {
      const len = 100;
      segs.push([k * 10, 0, k * 10 + len * Math.cos(a), len * Math.sin(a)]);
      segs.push([0, k * 10, -len * Math.sin(a), k * 10 + len * Math.cos(a)]);
    }
    segs.push([0, 0, 30, 30], [5, 5, 40, 12]);
    const b = dominantBearing(segs);
    expect(Math.abs(b - 37)).toBeLessThanOrEqual(1);
  });
});

describe('rasterLine4', () => {
  it('joins the ends with cells that touch by a side, never only by a corner', () => {
    for (const [x0, y0, x1, y1] of [
      [0, 0, 3, 2],
      [5, 5, 0, 7],
      [2, 9, 2, 1],
      [0, 0, 4, 4],
    ]) {
      const cells = rasterLine4(x0, y0, x1, y1);
      expect(cells[0]).toEqual([x0, y0]);
      expect(cells[cells.length - 1]).toEqual([x1, y1]);
      for (let k = 1; k < cells.length; k++) {
        expect(Math.abs(cells[k][0] - cells[k - 1][0]) + Math.abs(cells[k][1] - cells[k - 1][1])).toBe(1);
      }
    }
  });
});

describe('cornersFromElevation', () => {
  /** A 6×6 map whose two right columns are sea, with land rising to the west. */
  function coast(seaLevelM: number, landFromM: number) {
    const n = 6;
    const s = n + 1;
    const elev = new Float32Array(s * s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) elev[y * s + x] = x >= 5 ? seaLevelM - 8 : landFromM + (4 - x) * 10;
    const water = new Uint8Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 4; x < n; x++) water[y * n + x] = 1;
    return { n, elev, water };
  }

  function check(corners: Uint8Array, n: number, water: Uint8Array) {
    const t = { n, corners, trees: new Uint8Array(n * n) };
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) expect(isWaterCell(t, x, y)).toBe(water[y * n + x] === 1);
    const s = n + 1;
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        expect(corners[y * s + x]).toBeGreaterThanOrEqual(SEA_LEVEL - 1);
        expect(corners[y * s + x]).toBeLessThanOrEqual(MAX_HEIGHT);
        if (x + 1 < s) expect(Math.abs(corners[y * s + x] - corners[y * s + x + 1])).toBeLessThanOrEqual(1);
        if (y + 1 < s) expect(Math.abs(corners[y * s + x] - corners[(y + 1) * s + x])).toBeLessThanOrEqual(1);
      }
    }
    return t;
  }

  it('keeps the sea exactly where it is and raises the land in steps of the given metres', () => {
    const { n, elev, water } = coast(0, 2);
    const corners = cornersFromElevation(elev, water, n, 10);
    check(corners, n, water);
    // 42 m above the sea at the west edge: 4 levels of 10 m.
    expect(corners[0]).toBe(SEA_LEVEL + 4);
  });

  it('measures heights from the water surface, so a lake in the hills is not a cliff', () => {
    const { n, elev, water } = coast(800, 802);
    const corners = cornersFromElevation(elev, water, n, 10);
    check(corners, n, water);
    expect(corners[0]).toBe(SEA_LEVEL + 4);
  });
});

function tinyPreset(): MapPreset {
  const n = 8;
  const s = n + 1;
  const corners = new Uint8Array(s * s).fill(SEA_LEVEL + 1);
  // The last two columns are water.
  for (let y = 0; y < s; y++) for (let x = 7; x < s; x++) corners[y * s + x] = SEA_LEVEL - 1;
  const trees = new Uint8Array(n * n);
  trees[2 * n + 3] = 2;
  trees[5 * n + 1] = 1;
  const roads = new Uint8Array(n * n);
  for (let x = 0; x < n; x++) roads[2 * n + x] = 1; // crosses the water: a bridge
  return { id: 'tiny', name: 'Pueblo chico', n, cellMeters: 20, corners, trees, roads, attribution: '© OpenStreetMap' };
}

describe('map presets', () => {
  it('round-trip through their file format', () => {
    const p = tinyPreset();
    const back = decodePreset(encodePreset(p));
    expect(back.name).toBe('Pueblo chico');
    expect(Array.from(back.corners)).toEqual(Array.from(p.corners));
    expect(Array.from(back.trees)).toEqual(Array.from(p.trees));
    expect(Array.from(back.roads)).toEqual(Array.from(p.roads));
  });

  it('reject broken files', () => {
    const good = JSON.parse(encodePreset(tinyPreset()));
    expect(() => decodePreset('no')).toThrow();
    expect(() => decodePreset(JSON.stringify({ ...good, version: 99 }))).toThrow(/versión/);
    expect(() => decodePreset(JSON.stringify({ ...good, n: 9 }))).toThrow();
    const roads = tinyPreset();
    roads.roads[0] = 7;
    expect(() => decodePreset(encodePreset(roads))).toThrow();
  });

  it('build only the geography, or the geography with its streets', () => {
    const p = tinyPreset();
    const bare = worldFromPreset(p, false);
    expect(Array.from(bare.tiles).every((t) => t === TILE.EMPTY)).toBe(true);
    expect(bare.terrain.trees[2 * 8 + 3]).toBe(2);
    expect(Array.from(bare.terrain.corners)).toEqual(Array.from(p.corners));

    const streets = worldFromPreset(p, true);
    for (let x = 0; x < 8; x++) expect(streets.tileAt(x, 2)).toBe(TILE.ROAD);
    expect(streets.isWater(7, 2)).toBe(true);
    expect(streets.terrain.trees[2 * 8 + 3]).toBe(0);
    expect(streets.terrain.trees[5 * 8 + 1]).toBe(1);
    // The preset itself is not changed by building a world from it.
    expect(p.trees[2 * 8 + 3]).toBe(2);
    const save = deserialize(serialize({ name: 'Pueblo chico', seed: 1, world: streets, sim: newSimState(1) }));
    expect(save.world.tileAt(3, 2)).toBe(TILE.ROAD);
  });

  it('charge the streets that come with the map only once buildings use them', () => {
    const w = worldFromPreset(tinyPreset(), true);
    expect(w.inherited[w.idx(3, 2)]).toBe(1);
    expect(monthlyBudget(w, 7).roads).toBe(0);
    // A house two lots away from the street: the cells of the street within reach start costing.
    build(w, 'zoneR', 3, 4);
    w.level[w.idx(3, 4)] = 1;
    const used = monthlyBudget(w, 7).roads;
    expect(used).toBeGreaterThan(0);
    expect(used).toBeLessThan(8 * UPKEEP.bridge);
    // Streets the player builds cost from the start, as always.
    const own = new World(worldFromPreset(tinyPreset(), false).terrain);
    build(own, 'road', 0, 2, 5, 2);
    expect(monthlyBudget(own, 7).roads).toBe(6 * UPKEEP.road);
  });

  it('turn an inherited street into the player own street when it is rebuilt, and undo brings it back', () => {
    const w = worldFromPreset(tinyPreset(), true);
    const history = new UndoHistory();
    const bulldoze = planTool(w, 'bulldoze', [[3, 2]]);
    history.record(w, bulldoze, 0);
    applyPlan(w, bulldoze);
    expect(w.inherited[w.idx(3, 2)]).toBe(0);
    history.undo(w, 0);
    expect(w.tileAt(3, 2)).toBe(TILE.ROAD);
    expect(w.inherited[w.idx(3, 2)]).toBe(1);
    applyPlan(w, planTool(w, 'bulldoze', [[3, 2]]));
    applyPlan(w, planTool(w, 'road', [[3, 2]]));
    expect(w.inherited[w.idx(3, 2)]).toBe(0);
  });

  it('keep the inherited streets in saves, and older saves have none', () => {
    const w = worldFromPreset(tinyPreset(), true);
    const text = serialize({ name: 'X', seed: 1, world: w, sim: newSimState(1) });
    expect(Array.from(deserialize(text).world.inherited)).toEqual(Array.from(w.inherited));
    const old = JSON.parse(text);
    old.version = 2;
    delete old.inherited;
    expect(Array.from(deserialize(JSON.stringify(old)).world.inherited).every((v) => v === 0)).toBe(true);
  });

  it('ship every listed map as a valid file with land, water and streets', () => {
    const files = import.meta.glob('../public/maps/*.json', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    expect(PRESETS.length).toBeGreaterThan(0);
    for (const info of PRESETS) {
      const file = files[`../public/maps/${info.id}.json`];
      expect(file, `falta public/maps/${info.id}.json`).toBeTypeOf('string');
      const p = decodePreset(file);
      expect(p.n).toBe(128);
      let land = 0;
      let wet = 0;
      const t = { n: p.n, corners: p.corners, trees: p.trees };
      for (let y = 0; y < p.n; y++) for (let x = 0; x < p.n; x++) (isWaterCell(t, x, y) ? wet++ : land++);
      expect(land).toBeGreaterThan(p.n * p.n * 0.3);
      expect(wet).toBeGreaterThan(0);
      expect(p.roads.reduce((a, b) => a + b, 0)).toBeGreaterThan(500);
      expect(p.attribution).toMatch(/OpenStreetMap/);
    }
  });
});
