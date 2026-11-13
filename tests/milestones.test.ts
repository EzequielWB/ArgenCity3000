import { describe, expect, it } from 'vitest';
import { INITIAL_CASH, TICKS_PER_MONTH } from '../src/config';
import { deserialize, serialize } from '../src/save/save';
import { MILESTONES, advanceMilestones, isUnlocked, milestoneOfTool, nextMilestone } from '../src/sim/milestones';
import { Simulation, newSimState } from '../src/sim/simulation';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { TOOLS } from '../src/world/tools';
import { TILE, World } from '../src/world/world';

function flat(n = 32): Terrain {
  const s = n + 1;
  return { n, corners: new Uint8Array(s * s).fill(SEA_LEVEL + 1), trees: new Uint8Array(n * n) };
}

describe('milestones', () => {
  it('starts with the basics and unlocks every other tool at some milestone', () => {
    for (const tool of ['query', 'bulldoze', 'road', 'line', 'zoneR', 'zoneC', 'zoneI', 'park', 'plant'] as const) expect(isUnlocked(tool, 0)).toBe(true);
    for (const tool of ['school', 'clinic', 'police', 'fire', 'plantGas', 'plantWind'] as const) {
      expect(isUnlocked(tool, 0)).toBe(false);
      const at = milestoneOfTool(tool);
      expect(at).toBeGreaterThan(0);
      expect(isUnlocked(tool, at)).toBe(true);
      expect(isUnlocked(tool, at - 1)).toBe(false);
    }
    // No tool is left without a milestone, and populations only go up.
    for (const t of TOOLS) expect(milestoneOfTool(t.id)).toBeGreaterThanOrEqual(0);
    for (let k = 1; k < MILESTONES.length; k++) expect(MILESTONES[k].pop).toBeGreaterThan(MILESTONES[k - 1].pop);
    expect(MILESTONES[0].pop).toBe(0);
  });

  it('pays each grant once when the population gets there, and never goes back', () => {
    const s = newSimState(1);
    expect(s.milestone).toBe(0);
    expect(advanceMilestones(s, MILESTONES[1].pop - 1)).toEqual([]);
    expect(s.cash).toBe(INITIAL_CASH);
    const reached = advanceMilestones(s, MILESTONES[2].pop); // jumps two at once
    expect(reached.map((m) => m.name)).toEqual([MILESTONES[1].name, MILESTONES[2].name]);
    expect(s.milestone).toBe(2);
    expect(s.cash).toBe(INITIAL_CASH + MILESTONES[1].grant + MILESTONES[2].grant);
    expect(advanceMilestones(s, 0)).toEqual([]); // the city shrank: nothing is taken back
    expect(s.milestone).toBe(2);
    expect(advanceMilestones(s, MILESTONES[2].pop)).toEqual([]); // and nothing is paid twice
    expect(s.cash).toBe(INITIAL_CASH + MILESTONES[1].grant + MILESTONES[2].grant);
    expect(nextMilestone(2)).toBe(MILESTONES[3]);
    expect(nextMilestone(MILESTONES.length - 1)).toBeNull();
  });

  it('is checked by the simulation at the end of the month', () => {
    const w = new World(flat());
    for (let x = 0; x < 20; x++) w.setTile(x, 5, TILE.R, 3); // 1.200 residents, more than the second milestone asks
    const sim = new Simulation(w, newSimState(1), 'Prueba');
    for (let k = 0; k < TICKS_PER_MONTH; k++) sim.tick();
    expect(sim.state.milestone).toBeGreaterThanOrEqual(2);
  });

  it('saves the milestone, and works it out from the history for older saves', () => {
    const w = new World(flat());
    const s = newSimState(1);
    s.milestone = 3;
    const text = serialize({ name: 'Prueba', seed: 1, world: w, sim: s });
    expect(deserialize(text).sim.milestone).toBe(3);
    const old = JSON.parse(text);
    old.version = 3;
    delete old.sim.milestone;
    old.sim.history = [{ pop: 10, cash: 5 }, { pop: MILESTONES[2].pop + 5, cash: 5 }, { pop: 20, cash: 5 }];
    expect(deserialize(JSON.stringify(old)).sim.milestone).toBe(2);
    const bad = JSON.parse(text);
    bad.sim.milestone = 99;
    expect(() => deserialize(JSON.stringify(bad))).toThrow('El hito de la partida es inválido');
  });
});
