import { describe, expect, it } from 'vitest';
import { World, TILE } from '../src/world/world';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { applyPlan, dragCells, planTool } from '../src/world/tools';
import { COSTS, LINE_REACH } from '../src/config';

/** Flat land at height h with optional water columns (x >= waterFromX). */
function flatTerrain(n: number, waterFromX = n): Terrain {
  const s = n + 1;
  const corners = new Uint8Array(s * s);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) corners[y * s + x] = x > waterFromX ? SEA_LEVEL - 1 : SEA_LEVEL + 1;
  // Make columns from waterFromX fully water: every corner of those cells must be < SEA_LEVEL at least once.
  for (let y = 0; y < s; y++) for (let x = waterFromX; x < s; x++) corners[y * s + x] = SEA_LEVEL - 1;
  return { n, corners, trees: new Uint8Array(n * n) };
}

function world(n = 16, waterFromX = n): World {
  return new World(flatTerrain(n, waterFromX));
}

describe('dragCells', () => {
  it('traces an L-shaped path for line tools, longest axis first', () => {
    const cells = dragCells('road', 1, 1, 4, 2, 1, 16);
    expect(cells).toEqual([
      [1, 1],
      [2, 1],
      [3, 1],
      [4, 1],
      [4, 2],
    ]);
  });

  it('fills a rectangle for area tools and snaps it to the block size', () => {
    expect(dragCells('zoneR', 1, 1, 2, 1, 1, 16)).toHaveLength(2);
    const snapped = dragCells('zoneR', 1, 1, 2, 1, 4, 16);
    expect(snapped).toHaveLength(16); // snapped to the 4×4 block [0..3]×[0..3]
    expect(snapped[0]).toEqual([0, 0]);
  });

  it('clamps to the map', () => {
    const cells = dragCells('zoneR', 14, 14, 20, 20, 4, 16);
    for (const [x, y] of cells) {
      expect(x).toBeLessThan(16);
      expect(y).toBeLessThan(16);
    }
  });

  it('returns the anchor only for the power plant', () => {
    expect(dragCells('plant', 3, 3, 9, 9, 1, 16)).toEqual([[9, 9]]);
  });
});

describe('planTool / applyPlan', () => {
  it('builds roads on land and charges per cell', () => {
    const w = world();
    const plan = planTool(w, 'road', dragCells('road', 0, 0, 3, 0, 1, 16));
    expect(plan.cells).toHaveLength(4);
    expect(plan.cost).toBe(4 * COSTS.road);
    applyPlan(w, plan);
    expect(w.tileAt(2, 0)).toBe(TILE.ROAD);
  });

  it('builds bridges over water at a higher price', () => {
    const w = world(16, 10);
    const plan = planTool(w, 'road', [[12, 3]]);
    expect(plan.cost).toBe(COSTS.bridge);
  });

  it('removes trees when building a road', () => {
    const w = world();
    w.terrain.trees[w.idx(1, 1)] = 2;
    applyPlan(w, planTool(w, 'road', [[1, 1]]));
    expect(w.terrain.trees[w.idx(1, 1)]).toBe(0);
  });

  it('does not zone water nor existing roads, and skips cells already in that zone', () => {
    const w = world(16, 10);
    applyPlan(w, planTool(w, 'road', [[0, 0]]));
    applyPlan(w, planTool(w, 'zoneR', [[1, 0]]));
    const plan = planTool(w, 'zoneR', [
      [0, 0],
      [1, 0],
      [2, 0],
      [12, 0],
    ]);
    expect(plan.cells).toEqual([[2, 0]]);
    expect(plan.cost).toBe(COSTS.zone);
  });

  it('rezones an empty lot but never a lot with a building', () => {
    const w = world();
    applyPlan(w, planTool(w, 'zoneR', [[1, 1], [2, 1]]));
    w.level[w.idx(2, 1)] = 2;
    const plan = planTool(w, 'zoneI', [[1, 1], [2, 1]]);
    expect(plan.cells).toEqual([[1, 1]]);
  });

  it('places a 2×2 power plant only on four free land cells', () => {
    const w = world(16, 10);
    const ok = planTool(w, 'plant', [[3, 3]]);
    expect(ok.cells).toHaveLength(4);
    expect(ok.cost).toBe(COSTS.plant);
    applyPlan(w, ok);
    expect(w.plants).toEqual([{ x: 3, y: 3, kind: 'coal' }]);
    expect(w.tileAt(4, 4)).toBe(TILE.PLANT);
    expect(planTool(w, 'plant', [[4, 4]]).cells).toHaveLength(0); // occupied
    expect(planTool(w, 'plant', [[9, 3]]).cells).toHaveLength(0); // touches water
  });

  it('bulldozes a whole power plant from any of its cells', () => {
    const w = world();
    applyPlan(w, planTool(w, 'plant', [[3, 3]]));
    const plan = planTool(w, 'bulldoze', [[4, 4]]);
    applyPlan(w, plan);
    expect(w.plants).toEqual([]);
    for (const [x, y] of [[3, 3], [4, 3], [3, 4], [4, 4]]) expect(w.tileAt(x, y)).toBe(TILE.EMPTY);
  });

  it('bulldozes buildings, roads and trees, and ignores empty ground', () => {
    const w = world();
    applyPlan(w, planTool(w, 'zoneC', [[1, 1]]));
    w.level[w.idx(1, 1)] = 3;
    w.terrain.trees[w.idx(2, 2)] = 1;
    const plan = planTool(w, 'bulldoze', [[1, 1], [2, 2], [5, 5]]);
    expect(plan.cells).toEqual([[1, 1], [2, 2]]);
    expect(plan.cost).toBe(COSTS.bulldoze + 3 * COSTS.bulldozeLevel + COSTS.bulldoze);
    applyPlan(w, plan);
    expect(w.tileAt(1, 1)).toBe(TILE.EMPTY);
    expect(w.level[w.idx(1, 1)]).toBe(0);
    expect(w.terrain.trees[w.idx(2, 2)]).toBe(0);
  });

  it('allows power lines over water but not over zones', () => {
    const w = world(16, 10);
    applyPlan(w, planTool(w, 'zoneR', [[1, 1]]));
    const plan = planTool(w, 'line', [[1, 1], [12, 1]]);
    expect(plan.cells).toEqual([[12, 1]]);
  });

  it('marks changed cells as dirty and bumps the network version', () => {
    const w = world();
    const v = w.networkVersion;
    w.takeDirty();
    applyPlan(w, planTool(w, 'road', [[0, 0], [1, 0]]));
    expect(w.networkVersion).toBeGreaterThan(v);
    expect(w.takeDirty().sort((a, b) => a - b)).toEqual([w.idx(0, 0), w.idx(1, 0)]);
    expect(w.takeDirty()).toEqual([]);
  });
});

describe('the power line spends its reach', () => {
  const run = (w: World, ax: number, ay: number, bx: number, by: number) => planTool(w, 'line', dragCells('line', ax, ay, bx, by, 1, 16));

  it('puts one pole every LINE_REACH cells of a straight run', () => {
    const plan = run(world(), 0, 2, 9, 2);
    expect(plan.cells).toEqual([
      [0, 2],
      [3, 2],
      [6, 2],
      [9, 2],
    ]);
    expect(plan.cost).toBe(4 * COSTS.line);
  });

  it('is a single pole when the whole run fits in the reach', () => {
    expect(run(world(), 0, 2, 2, 2).cells).toEqual([[0, 2]]);
  });

  it('never leaves two poles further apart than the reach', () => {
    const plan = run(world(), 0, 5, 19, 5);
    expect(plan.cells[0]).toEqual([0, 5]);
    for (let i = 1; i < plan.cells.length; i++) {
      const [ax, ay] = plan.cells[i - 1];
      const [bx, by] = plan.cells[i];
      expect(Math.hypot(bx - ax, by - ay)).toBeLessThanOrEqual(LINE_REACH);
    }
  });

  it('keeps the spacing when a cell in the middle cannot hold a pole', () => {
    // A zone at (1, 1) is not a pole, and it does not shift the next one.
    const w = world();
    applyPlan(w, planTool(w, 'zoneR', [[1, 1]]));
    expect(planTool(w, 'line', dragCells('line', 0, 1, 6, 1, 1, 16)).cells).toEqual([
      [0, 1],
      [3, 1],
      [6, 1],
    ]);
  });
});
