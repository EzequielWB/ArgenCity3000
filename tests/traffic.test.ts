import { describe, expect, it } from 'vitest';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { World, TILE } from '../src/world/world';
import { applyPlan, dragCells, planTool } from '../src/world/tools';
import { computeTraffic } from '../src/render/traffic';

function flat(n = 16): Terrain {
  return { n, corners: new Uint8Array((n + 1) * (n + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(n * n) };
}

describe('computeTraffic', () => {
  it('puts cars only on streets next to buildings, more with taller buildings, at most 3', () => {
    const w = new World(flat());
    applyPlan(w, planTool(w, 'road', dragCells('road', 0, 5, 15, 5, 1, 16)));
    applyPlan(w, planTool(w, 'zoneR', dragCells('zoneR', 0, 6, 4, 7, 1, 16)));
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
