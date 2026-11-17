import { TICKS_PER_MONTH } from '../config';
import type { Plan, ToolId } from './tools';
import { markHubsDirty } from './hubs';
import { World, type Hub, type Plant, type Unique } from './world';

interface CellBefore {
  i: number;
  tile: number;
  level: number;
  variant: number;
  tree: number;
  abandoned: number;
  inherited: number;
  fire: number;
  bus: number;
}

/** Puts back the terrain heights and redraws the lots whose ground moves. */
function restoreCorners(w: World, corners: Uint8Array): void {
  const n = w.n;
  const s = n + 1;
  const c = w.terrain.corners;
  for (let k = 0; k < s * s; k++) {
    if (c[k] === corners[k]) continue;
    c[k] = corners[k];
    const x = k % s;
    const y = (k - x) / s;
    for (const [cx, cy] of [
      [x - 1, y - 1],
      [x, y - 1],
      [x - 1, y],
      [x, y],
    ]) {
      if (cx >= 0 && cy >= 0 && cx < n && cy < n) w.markDirty(cy * n + cx);
    }
  }
}

interface Entry {
  tool: ToolId;
  cost: number;
  tick: number;
  cells: CellBefore[];
  plants: Plant[];
  hubs: Hub[];
  uniques: Unique[];
  /** Terrain before the action: zoning may level the ground around the cells it changes. */
  corners: Uint8Array;
}

export interface Undone {
  tool: ToolId;
  /** Money given back: the full cost within a month of the action, half after that. */
  refund: number;
}

/**
 * Remembers the state of the cells each action changes, so the action can be reverted
 * (and paid back) later. Only recent actions can be undone, and only the last month's
 * get a full refund, so undo fixes mistakes instead of becoming a free bank.
 */
export class UndoHistory {
  static readonly MAX_ENTRIES = 30;
  static readonly MAX_AGE_TICKS = TICKS_PER_MONTH * 12;
  /** Undoing within this window gives back everything; later only half. */
  static readonly FULL_REFUND_TICKS = TICKS_PER_MONTH;

  private entries: Entry[] = [];

  get size(): number {
    return this.entries.length;
  }

  /** Call right before `applyPlan(w, plan)`. */
  record(w: World, plan: Plan, tick: number): void {
    if (plan.cells.length === 0) return;
    const cells = plan.cells.map(([x, y]) => {
      const i = w.idx(x, y);
      return {
        i,
        tile: w.tiles[i],
        level: w.level[i],
        variant: w.variant[i],
        tree: w.terrain.trees[i],
        abandoned: w.abandoned[i],
        inherited: w.inherited[i],
        fire: w.fire[i],
        bus: w.busLine[i],
      };
    });
    this.entries.push({ tool: plan.tool, cost: plan.cost, tick, cells, plants: w.plants.map((p) => ({ ...p })), hubs: w.hubs.map((h) => ({ ...h })), uniques: w.uniques.map((u) => ({ ...u })), corners: w.terrain.corners.slice() });
    if (this.entries.length > UndoHistory.MAX_ENTRIES) this.entries.shift();
  }

  /** Reverts the latest action, or returns null when there is nothing recent to undo. */
  undo(w: World, now: number): Undone | null {
    const e = this.entries.pop();
    if (!e) return null;
    if (now - e.tick > UndoHistory.MAX_AGE_TICKS) {
      this.entries = [];
      return null;
    }
    for (const c of e.cells) {
      if (w.route[c.i]) continue; // the route is never part of what an action can give back
      const x = c.i % w.n;
      w.setTile(x, (c.i - x) / w.n, c.tile, c.level);
      w.variant[c.i] = c.variant;
      w.terrain.trees[c.i] = c.tree;
      w.abandoned[c.i] = c.abandoned;
      w.inherited[c.i] = c.inherited;
      w.fire[c.i] = c.fire;
      w.busLine[c.i] = c.bus;
    }
    w.plants = e.plants.map((p) => ({ ...p }));
    w.hubs = e.hubs.map((h) => ({ ...h }));
    w.uniques = e.uniques.map((u) => ({ ...u }));
    markHubsDirty(w);
    restoreCorners(w, e.corners);
    w.bumpNetwork();
    const age = now - e.tick;
    return { tool: e.tool, refund: age <= UndoHistory.FULL_REFUND_TICKS ? e.cost : Math.floor(e.cost / 2) };
  }

  clear(): void {
    this.entries = [];
  }
}
