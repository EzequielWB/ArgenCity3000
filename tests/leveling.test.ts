import { describe, expect, it } from 'vitest';
import { SEA_LEVEL, generateTerrain, isWaterCell, smoothCorners, type Terrain } from '../src/world/terrain';
import { applyPlan, dragCells, planTool, type ToolId } from '../src/world/tools';
import { UndoHistory } from '../src/world/history';
import { World } from '../src/world/world';
import { deserialize, serialize } from '../src/save/save';
import { newSimState } from '../src/sim/simulation';

function terrain(n: number, height: (x: number, y: number) => number): Terrain {
  const s = n + 1;
  const corners = new Uint8Array(s * s);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) corners[y * s + x] = height(x, y);
  return { n, corners, trees: new Uint8Array(n * n) };
}

function waterMap(t: Terrain): boolean[] {
  const out: boolean[] = [];
  for (let y = 0; y < t.n; y++) for (let x = 0; x < t.n; x++) out.push(isWaterCell(t, x, y));
  return out;
}

function maxStep(c: Uint8Array, s: number): number {
  let m = 0;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
        [1, 1],
        [1, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= s || ny >= s) continue;
        m = Math.max(m, Math.abs(c[y * s + x] - c[ny * s + nx]));
      }
    }
  }
  return m;
}

/** Corners strictly higher (or lower) than all 8 neighbours: a lone bump or pit on land. */
function loneBumps(t: Terrain): number {
  const s = t.n + 1;
  let k = 0;
  for (let y = 1; y < s - 1; y++) {
    for (let x = 1; x < s - 1; x++) {
      const h = t.corners[y * s + x];
      if (h < SEA_LEVEL) continue;
      let above = true;
      let below = true;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const v = t.corners[(y + dy) * s + x + dx];
        if (v >= h) above = false;
        if (v <= h) below = false;
      }
      if (above || below) k++;
    }
  }
  return k;
}

describe('A: smoothCorners', () => {
  it('flattens a lone bump and keeps a long slope', () => {
    const bump = terrain(8, (x, y) => (x === 4 && y === 4 ? SEA_LEVEL + 2 : SEA_LEVEL + 1));
    smoothCorners(bump.corners, 9);
    expect(new Set(bump.corners)).toEqual(new Set([SEA_LEVEL + 1]));

    const ramp = terrain(12, (x) => SEA_LEVEL + Math.floor(x / 2));
    const before = Array.from(ramp.corners);
    smoothCorners(ramp.corners, 13);
    expect(Math.max(...ramp.corners)).toBe(Math.max(...before));
    expect(Math.min(...ramp.corners)).toBe(Math.min(...before));
  });

  it('never moves a shore: water stays water, land stays land, slopes stay within one level', () => {
    for (const seed of [1, 7, 42]) {
      const t = generateTerrain(seed, 64);
      const before = waterMap(t);
      smoothCorners(t.corners, 65);
      expect(waterMap(t)).toEqual(before);
      expect(maxStep(t.corners, 65)).toBeLessThanOrEqual(1);
    }
  });

  it('leaves generated maps without lone bumps', () => {
    for (const seed of [1, 7, 42, 99]) expect(loneBumps(generateTerrain(seed, 64))).toBe(0);
  });
});

describe('B: zoning levels the block', () => {
  /** Land rising one level every two cells to the east, with a street along the west edge. */
  function slope(): World {
    const w = new World(terrain(24, (x) => SEA_LEVEL + 1 + Math.floor(x / 3)));
    applyPlan(w, planTool(w, 'road', dragCells('road', 0, 0, 0, 23, 1, 24)));
    return w;
  }
  const build = (w: World, tool: ToolId, ax: number, ay: number, bx: number, by: number) =>
    applyPlan(w, planTool(w, tool, dragCells(tool, ax, ay, bx, by, 1, w.n)));

  function flatCells(w: World, x0: number, y0: number, x1: number, y1: number): Set<number> {
    const s = w.n + 1;
    const c = w.terrain.corners;
    const heights = new Set<number>();
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const h = [c[y * s + x], c[y * s + x + 1], c[(y + 1) * s + x], c[(y + 1) * s + x + 1]];
        expect(new Set(h).size, `lote ${x},${y}`).toBe(1);
        heights.add(h[0]);
      }
    }
    return heights;
  }

  it('makes every lot of a small block flat at one height', () => {
    const w = slope();
    build(w, 'zoneR', 1, 2, 4, 5);
    expect(flatCells(w, 1, 2, 4, 5).size).toBe(1);
    expect(maxStep(w.terrain.corners, 25)).toBeLessThanOrEqual(1);
  });

  it('levels a whole block when it grows, services included', () => {
    const w = slope();
    build(w, 'zoneR', 1, 2, 3, 5);
    build(w, 'zoneC', 4, 2, 5, 5);
    build(w, 'school', 1, 6, 1, 6);
    const heights = flatCells(w, 1, 2, 5, 5);
    expect(heights.size).toBe(1);
  });

  it('moves no corner more than two levels, so big hills are not removed', () => {
    const w = new World(terrain(24, (x) => SEA_LEVEL + Math.min(9, x)));
    const before = w.terrain.corners.slice();
    build(w, 'zoneR', 0, 0, 12, 3);
    for (let i = 0; i < before.length; i++) expect(Math.abs(w.terrain.corners[i] - before[i])).toBeLessThanOrEqual(2);
  });

  it('never touches the shore', () => {
    const w = new World(terrain(16, (x) => (x >= 12 ? SEA_LEVEL - 1 : SEA_LEVEL + 1 + (x % 2))));
    const before = waterMap(w.terrain);
    build(w, 'zoneR', 6, 2, 11, 6);
    expect(waterMap(w.terrain)).toEqual(before);
    const s = 17;
    for (let y = 0; y < s; y++) expect(w.terrain.corners[y * s + 12]).toBeLessThanOrEqual(SEA_LEVEL);
  });

  it('leaves flat land, streets and the bulldozer alone', () => {
    const flat = new World(terrain(12, () => SEA_LEVEL + 2));
    const before = flat.terrain.corners.slice();
    build(flat, 'zoneR', 2, 2, 6, 6);
    expect(Array.from(flat.terrain.corners)).toEqual(Array.from(before));

    const w = slope();
    const hill = w.terrain.corners.slice();
    build(w, 'road', 5, 0, 5, 20);
    build(w, 'bulldoze', 0, 3, 0, 6);
    expect(Array.from(w.terrain.corners)).toEqual(Array.from(hill));
  });

  it('is undone together with the zoning, and kept in saves', () => {
    const w = slope();
    const before = w.terrain.corners.slice();
    const history = new UndoHistory();
    const plan = planTool(w, 'zoneR', dragCells('zoneR', 1, 2, 4, 5, 1, w.n));
    history.record(w, plan, 0);
    applyPlan(w, plan);
    expect(Array.from(w.terrain.corners)).not.toEqual(Array.from(before));
    const saved = deserialize(serialize({ name: 'X', seed: 1, world: w, sim: newSimState(1) }));
    expect(Array.from(saved.world.terrain.corners)).toEqual(Array.from(w.terrain.corners));
    history.undo(w, 0);
    expect(Array.from(w.terrain.corners)).toEqual(Array.from(before));
  });

  it('redraws every lot whose ground moved', () => {
    const w = slope();
    w.takeDirty();
    const before = w.terrain.corners.slice();
    build(w, 'zoneR', 1, 2, 4, 5);
    const dirty = new Set(w.takeDirty());
    const s = 25;
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 24; x++) {
        const moved = [y * s + x, y * s + x + 1, (y + 1) * s + x, (y + 1) * s + x + 1].some((k) => w.terrain.corners[k] !== before[k]);
        if (moved) expect(dirty.has(w.idx(x, y)), `lote ${x},${y}`).toBe(true);
      }
    }
  });
});
