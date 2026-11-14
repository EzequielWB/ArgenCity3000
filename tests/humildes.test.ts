import { describe, expect, it } from 'vitest';
import { CAPACITY, MAX_LEVEL, TICKS_PER_MONTH } from '../src/config';
import { EARLY_CITY, HOLDOUT_SHARE, HUMBLE, isHoldout, levelCap, spawnLevel } from '../src/sim/demand';
import { buildingName } from '../src/sim/report';
import { Simulation, newSimState } from '../src/sim/simulation';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { applyPlan, dragCells, planTool } from '../src/world/tools';
import { World } from '../src/world/world';

describe('the humble level', () => {
  it('is the lowest of every zone: it holds fewer people than the next level and has its own name', () => {
    expect(HUMBLE).toBe(1);
    for (const zone of ['R', 'C', 'I'] as const) {
      expect(CAPACITY[zone]).toHaveLength(MAX_LEVEL + 1);
      expect(CAPACITY[zone][HUMBLE]).toBeGreaterThan(0);
      expect(CAPACITY[zone][HUMBLE]).toBeLessThan(CAPACITY[zone][HUMBLE + 1]);
      const names = Array.from({ length: MAX_LEVEL }, (_, k) => buildingName(zone, k + 1, 0));
      expect(new Set(names).size).toBe(MAX_LEVEL);
    }
  });

  it('is never what a lot is capped at', () => {
    for (const zone of ['R', 'C', 'I'] as const) for (const pop of [0, 100, 1000, 50000]) expect(levelCap(zone, 0, pop, { edu: 0, health: 0 })).toBeGreaterThan(HUMBLE);
  });
});

describe('where a new building is born', () => {
  it('is humble in a small city', () => {
    for (const cap of [2, 3, 5]) expect(spawnLevel(EARLY_CITY - 1, cap)).toBe(HUMBLE);
  });

  it('is one level below the cap in a grown city, and never above it', () => {
    expect(spawnLevel(50000, 5)).toBe(4);
    expect(spawnLevel(50000, 3)).toBe(2);
    expect(spawnLevel(50000, 2)).toBe(HUMBLE);
    for (const cap of [2, 3, 4, 5]) expect(spawnLevel(EARLY_CITY, cap)).toBeLessThanOrEqual(cap);
  });
});

describe('the humble buildings that never improve', () => {
  it('are a share of them, the same every time for the same building', () => {
    const holdouts = Array.from({ length: 256 }, (_, v) => isHoldout(v)).filter(Boolean).length / 256;
    expect(holdouts).toBeGreaterThan(HOLDOUT_SHARE - 0.1);
    expect(holdouts).toBeLessThan(HOLDOUT_SHARE + 0.1);
    expect(isHoldout(77)).toBe(isHoldout(77));
  });
});

function flat(n = 32): Terrain {
  const s = n + 1;
  return { n, corners: new Uint8Array(s * s).fill(SEA_LEVEL + 1), trees: new Uint8Array(n * n) };
}

function build(w: World, tool: Parameters<typeof planTool>[1], ax: number, ay: number, bx = ax, by = ay) {
  applyPlan(w, planTool(w, tool, dragCells(tool, ax, ay, bx, by, 1, w.n)));
}

/** A powered city with streets and lots of every zone, where there is demand for more. */
function starterCity(): World {
  const w = new World(flat());
  build(w, 'plant', 0, 1);
  build(w, 'road', 0, 3, 31, 3);
  build(w, 'road', 0, 9, 31, 9);
  build(w, 'line', 0, 4, 0, 6);
  build(w, 'line', 1, 6, 31, 6);
  build(w, 'zoneR', 2, 4, 20, 5);
  build(w, 'zoneR', 2, 7, 20, 8);
  build(w, 'zoneI', 22, 4, 31, 8);
  build(w, 'zoneC', 2, 10, 20, 11);
  return w;
}

describe('a growing city', () => {
  it('leaves a humble holdout as it is while the humble houses around it improve', () => {
    const w = starterCity();
    const stays = Array.from({ length: 256 }, (_, v) => v).find((v) => isHoldout(v))!;
    const grows = Array.from({ length: 256 }, (_, v) => v).find((v) => !isHoldout(v))!;
    const [a, b] = [w.idx(3, 4), w.idx(4, 4)];
    w.level[a] = HUMBLE;
    w.variant[a] = stays;
    w.level[b] = HUMBLE;
    w.variant[b] = grows;
    const sim = new Simulation(w, newSimState(5), 'X');
    for (let i = 0; i < TICKS_PER_MONTH * 24; i++) sim.tick();
    expect(w.level[a]).toBe(HUMBLE);
    expect(w.level[b]).toBeGreaterThan(HUMBLE);
    expect(sim.totals.pop).toBeGreaterThan(EARLY_CITY);
  });
});
