import { describe, expect, it } from 'vitest';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { World, TILE } from '../src/world/world';
import { applyPlan, dragCells, planTool, type ToolId } from '../src/world/tools';
import { UndoHistory } from '../src/world/history';

function flat(n = 16): Terrain {
  return { n, corners: new Uint8Array((n + 1) * (n + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(n * n) };
}

function act(w: World, h: UndoHistory, tool: ToolId, ax: number, ay: number, bx = ax, by = ay, tick = 0) {
  const plan = planTool(w, tool, dragCells(tool, ax, ay, bx, by, 1, w.n));
  h.record(w, plan, tick);
  applyPlan(w, plan);
  return plan;
}

describe('UndoHistory', () => {
  it('undoes a road, restoring the trees it cleared and returning its cost', () => {
    const w = new World(flat());
    const h = new UndoHistory();
    w.terrain.trees[w.idx(3, 3)] = 2;
    const plan = act(w, h, 'road', 1, 3, 5, 3);
    const undone = h.undo(w, 10);
    expect(undone?.refund).toBe(plan.cost);
    expect(undone?.tool).toBe('road');
    for (let x = 1; x <= 5; x++) expect(w.tileAt(x, 3)).toBe(TILE.EMPTY);
    expect(w.terrain.trees[w.idx(3, 3)]).toBe(2);
  });

  it('brings back a demolished building with its level and variant', () => {
    const w = new World(flat());
    const h = new UndoHistory();
    act(w, h, 'zoneC', 4, 4);
    const i = w.idx(4, 4);
    w.level[i] = 3;
    w.variant[i] = 77;
    act(w, h, 'bulldoze', 4, 4);
    expect(w.tiles[i]).toBe(TILE.EMPTY);
    h.undo(w, 0);
    expect(w.tiles[i]).toBe(TILE.C);
    expect(w.level[i]).toBe(3);
    expect(w.variant[i]).toBe(77);
  });

  it('brings back a demolished power plant', () => {
    const w = new World(flat());
    const h = new UndoHistory();
    act(w, h, 'plant', 2, 2);
    act(w, h, 'bulldoze', 3, 3);
    expect(w.plants).toEqual([]);
    h.undo(w, 0);
    expect(w.plants).toEqual([{ x: 2, y: 2, kind: 'coal' }]);
    expect(w.tileAt(3, 3)).toBe(TILE.PLANT);
    h.undo(w, 0);
    expect(w.plants).toEqual([]);
    expect(w.tileAt(2, 2)).toBe(TILE.EMPTY);
  });

  it('undoes in reverse order and reports nothing when empty', () => {
    const w = new World(flat());
    const h = new UndoHistory();
    act(w, h, 'road', 0, 0, 4, 0);
    act(w, h, 'zoneR', 0, 1, 4, 1);
    expect(h.undo(w, 0)?.tool).toBe('zoneR');
    expect(w.tileAt(2, 0)).toBe(TILE.ROAD);
    expect(h.undo(w, 0)?.tool).toBe('road');
    expect(h.undo(w, 0)).toBeNull();
  });

  it('marks undone cells dirty and bumps the power network', () => {
    const w = new World(flat());
    const h = new UndoHistory();
    act(w, h, 'road', 0, 0, 1, 0);
    w.takeDirty();
    const v = w.networkVersion;
    h.undo(w, 0);
    expect(w.networkVersion).toBeGreaterThan(v);
    expect(w.takeDirty().sort((a, b) => a - b)).toEqual([0, 1]);
  });

  it('gives back everything within a month, and half after that', () => {
    const w = new World(flat());
    const h = new UndoHistory();
    const a = act(w, h, 'road', 0, 0, 3, 0, 0);
    const b = act(w, h, 'road', 0, 2, 3, 2, 0);
    expect(h.undo(w, UndoHistory.FULL_REFUND_TICKS + 1)?.refund).toBe(Math.floor(b.cost / 2));
    expect(h.undo(w, UndoHistory.FULL_REFUND_TICKS)?.refund).toBe(a.cost);
  });

  it('refuses to undo actions older than a year of game time', () => {
    const w = new World(flat());
    const h = new UndoHistory();
    act(w, h, 'road', 0, 0, 3, 0, 0);
    expect(h.undo(w, UndoHistory.MAX_AGE_TICKS + 1)).toBeNull();
    expect(w.tileAt(1, 0)).toBe(TILE.ROAD);
  });

  it('ignores actions that changed nothing', () => {
    const w = new World(flat());
    const h = new UndoHistory();
    act(w, h, 'bulldoze', 5, 5);
    expect(h.size).toBe(0);
  });
});
