import { describe, expect, it } from 'vitest';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { World, TILE } from '../src/world/world';
import { applyPlan, dragCells, planTool, type ToolId } from '../src/world/tools';
import { Traffic, computeTraffic } from '../src/render/traffic';

function flat(n = 16): Terrain {
  return { n, corners: new Uint8Array((n + 1) * (n + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(n * n) };
}

function build(w: World, tool: ToolId, ax: number, ay: number, bx = ax, by = ay) {
  applyPlan(w, planTool(w, tool, dragCells(tool, ax, ay, bx, by, 1, w.n)));
}

/** A ring of streets with a dead-end spur and a dense residential block. */
function town(): World {
  const w = new World(flat(24));
  build(w, 'road', 2, 2, 20, 2);
  build(w, 'road', 20, 2, 20, 12);
  build(w, 'road', 2, 12, 20, 12);
  build(w, 'road', 2, 2, 2, 12);
  build(w, 'road', 10, 12, 10, 18); // dead end
  build(w, 'zoneR', 3, 3, 19, 11);
  for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === TILE.R) w.level[i] = 4;
  return w;
}

describe('computeTraffic', () => {
  it('puts cars only on streets next to buildings, more with taller buildings, at most 3', () => {
    const w = new World(flat());
    build(w, 'road', 0, 5, 15, 5);
    build(w, 'zoneR', 0, 6, 4, 7);
    const t = new Uint8Array(16 * 16);
    computeTraffic(w, t);
    expect(Math.max(...t)).toBe(0);
    for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === TILE.R) w.level[i] = 4;
    computeTraffic(w, t);
    expect(t[w.idx(2, 5)]).toBe(3);
    expect(t[w.idx(14, 5)]).toBe(0);
    expect(t[w.idx(2, 6)]).toBe(0);
  });
});

describe('Traffic', () => {
  it('has no cars when no street has buildings around', () => {
    const w = new World(flat());
    build(w, 'road', 0, 5, 15, 5);
    const tr = new Traffic(w, 1);
    tr.refresh();
    for (let k = 0; k < 50; k++) tr.update(0.1);
    expect(tr.cars.length).toBe(0);
  });

  it('fills up to its target and never more than the cap', () => {
    const w = town();
    const tr = new Traffic(w, 1);
    tr.refresh();
    for (let k = 0; k < 200; k++) tr.update(0.05);
    expect(tr.cars.length).toBe(tr.target);
    expect(tr.target).toBeGreaterThan(0);
    expect(tr.target).toBeLessThanOrEqual(Traffic.MAX_CARS);
  });

  it('keeps every car on a street, moving between neighbouring street cells, dead ends included', () => {
    const w = town();
    const tr = new Traffic(w, 7);
    tr.refresh();
    for (let k = 0; k < 2000; k++) {
      tr.update(0.05);
      for (const c of tr.cars) {
        expect(w.tileAt(c.x, c.y)).toBe(TILE.ROAD);
        expect(w.tileAt(c.x + c.dx, c.y + c.dy)).toBe(TILE.ROAD);
        expect(Math.abs(c.dx) + Math.abs(c.dy)).toBe(1);
        expect(c.t).toBeGreaterThanOrEqual(0);
        expect(c.t).toBeLessThan(1);
      }
    }
  });

  it('moves smoothly: positions change by less than a cell per short step', () => {
    const w = town();
    const tr = new Traffic(w, 3);
    tr.refresh();
    for (let k = 0; k < 100; k++) tr.update(0.05);
    const before = new Map(tr.cars.map((c) => [c.id, tr.position(c)]));
    tr.update(0.05);
    for (const c of tr.cars) {
      const p = before.get(c.id);
      if (!p) continue;
      const q = tr.position(c);
      expect(Math.hypot(q[0] - p[0], q[1] - p[1])).toBeLessThan(0.5);
    }
  });

  it('removes cars from streets that were demolished', () => {
    const w = town();
    const tr = new Traffic(w, 5);
    tr.refresh();
    for (let k = 0; k < 100; k++) tr.update(0.05);
    expect(tr.cars.length).toBeGreaterThan(0);
    build(w, 'bulldoze', 0, 0, 23, 23);
    tr.refresh();
    tr.update(0.05);
    expect(tr.cars.length).toBe(0);
  });

  it('stands still when time does not advance', () => {
    const w = town();
    const tr = new Traffic(w, 5);
    tr.refresh();
    for (let k = 0; k < 100; k++) tr.update(0.05);
    const snap = JSON.stringify(tr.cars);
    tr.update(0);
    expect(JSON.stringify(tr.cars)).toBe(snap);
  });
});
