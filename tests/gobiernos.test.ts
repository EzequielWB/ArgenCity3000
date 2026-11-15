import { describe, expect, it } from 'vitest';
import { GOVERNMENTS, GOVERNMENT_KINDS, TICKS_PER_MONTH } from '../src/config';
import { deserialize, serialize } from '../src/save/save';
import { monthlyBudget } from '../src/sim/budget';
import { DROUGHT, MIRACLE, incomeFactor } from '../src/sim/effects';
import { FAVOR, computeFavor, judgementChance, moodOf, stepFavor } from '../src/sim/favor';
import { PLAN, newPlan, planMonthsLeft, planPremium } from '../src/sim/plan';
import { stepApproval } from '../src/sim/politics';
import { Simulation, newSimState } from '../src/sim/simulation';
import { SEA_LEVEL } from '../src/world/terrain';
import { applyPlan, dragCells, planTool } from '../src/world/tools';
import { TILE, World } from '../src/world/world';

const N = 40;

const flat = (): World => new World({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(N * N) });

/** A lit town with homes and a few workshops, the cash well filled, under the given government. */
function town(government: 'democracia' | 'teocracia' | 'comunismo'): { world: World; sim: Simulation } {
  const world = flat();
  const build = (tool: Parameters<typeof planTool>[1], ax: number, ay: number, bx = ax, by = ay) =>
    applyPlan(world, planTool(world, tool, dragCells(tool, ax, ay, bx, by, 1, N)));
  build('plant', 0, 1);
  build('road', 0, 3, 31, 3);
  build('zoneR', 2, 4, 16, 8);
  build('zoneC', 18, 4, 24, 5);
  build('zoneI', 18, 7, 24, 8);
  const sim = new Simulation(world, newSimState(3, government), 'Villa Fe');
  sim.state.cash = 5_000_000;
  for (let i = 0; i < world.tiles.length; i++) if (world.tiles[i] === TILE.R || world.tiles[i] === TILE.C || world.tiles[i] === TILE.I) world.level[i] = 2;
  sim.refresh();
  return { world, sim };
}

const months = (sim: Simulation, n: number): void => {
  for (let k = 0; k < n * TICKS_PER_MONTH; k++) sim.tick();
};
const CATASTROPHE = /rayos|Plaga|Sequía|Revuelta/;
const MIRACLES = /Milagro|Bendición|Procesión multitudinaria/;

describe('the new forms of government', () => {
  it('are offered with their pros and cons, and the old ones keep the usual numbers', () => {
    expect(GOVERNMENT_KINDS).toContain('teocracia');
    expect(GOVERNMENT_KINDS).toContain('comunismo');
    for (const id of GOVERNMENT_KINDS) {
      expect(GOVERNMENTS[id].pros.length).toBeGreaterThan(0);
      expect(GOVERNMENTS[id].cons.length).toBeGreaterThan(0);
    }
    for (const id of ['democracia', 'dictadura', 'tecnocracia'] as const) {
      expect(GOVERNMENTS[id].taxIncome).toEqual({ R: 1, C: 1, I: 1 });
      expect(GOVERNMENTS[id].serviceCost).toBe(1);
    }
  });

  it('has a theocracy with no elections whose people never pass 80, and a communism with a congress every 5 years', () => {
    expect(GOVERNMENTS.teocracia.termYears).toBeNull();
    expect(stepApproval(79, 100, 'teocracia')).toBe(80);
    expect(GOVERNMENTS.comunismo.termYears).toBe(5);
    expect(GOVERNMENTS.comunismo.toWin).toBe(40);
    expect(stepApproval(50, 100, 'comunismo')).toBe(51); // it barely moves
  });
});

describe('the favor of God', () => {
  it('starts at 60 under a theocracy, and moves at most 3 points a month towards what the city deserves', () => {
    expect(newSimState(1, 'teocracia').favor).toBe(FAVOR.start);
    expect(stepFavor(60, 100)).toBe(63);
    expect(stepFavor(60, 0)).toBe(57);
    expect(stepFavor(60, 61)).toBe(61);
    expect(stepFavor(99, 100)).toBe(100);
  });

  it('is angry under 35, pleased over 75, and sends nothing in between', () => {
    expect(moodOf(34)).toBe('wrath');
    expect(moodOf(35)).toBe('calm');
    expect(moodOf(75)).toBe('calm');
    expect(moodOf(76)).toBe('grace');
    expect(judgementChance(50)).toBe(0);
    expect(judgementChance(0)).toBeGreaterThan(judgementChance(30));
    expect(judgementChance(100)).toBeGreaterThan(judgementChance(80));
  });

  it('goes down with smoke, crime, usury and a cash in the red, and up with kept plazas', () => {
    const { world, sim } = town('teocracia');
    const inputs = { taxes: sim.state.taxes, crisis: false, abandoned: 0, grief: 0, pop: sim.totals.pop, green: 100 };
    const clean = computeFavor(world, inputs).target;
    for (let i = 0; i < world.tiles.length; i++) if (world.tiles[i] === TILE.R) (world.pollution[i] = 90), (world.crime[i] = 90);
    expect(computeFavor(world, inputs).target).toBeLessThan(clean);
    for (let i = 0; i < world.tiles.length; i++) (world.pollution[i] = 0), (world.crime[i] = 0);
    expect(computeFavor(world, { ...inputs, taxes: { R: 20, C: 20, I: 20 } }).target).toBeLessThan(clean);
    expect(computeFavor(world, { ...inputs, crisis: true }).target).toBeLessThan(clean);
    expect(computeFavor(world, { ...inputs, green: 0 }).target).toBeLessThan(clean);
  });

  it('sends catastrophes when He is angry, and they reach the city', () => {
    const { sim } = town('teocracia');
    sim.state.favor = 5;
    months(sim, 6);
    expect(sim.state.news.some((n) => CATASTROPHE.test(n.text))).toBe(true);
  });

  it('sends miracles when He is pleased', () => {
    const { sim } = town('teocracia');
    sim.state.favor = 98;
    months(sim, 6);
    expect(sim.state.news.some((n) => MIRACLES.test(n.text))).toBe(true);
  });

  it('is of no concern to any other form of government', () => {
    const { sim } = town('democracia');
    sim.state.favor = 5;
    months(sim, 6);
    expect(sim.state.news.some((n) => CATASTROPHE.test(n.text) || MIRACLES.test(n.text))).toBe(false);
    expect(sim.state.favor).toBe(5);
  });

  it('makes the drought a third poorer and the miracle a fifth richer', () => {
    const { world } = town('teocracia');
    const usual = monthlyBudget(world, 7).income;
    expect(usual).toBeGreaterThan(0);
    expect(incomeFactor({ [DROUGHT]: 2 })).toBe(0.7);
    expect(incomeFactor({ [MIRACLE]: 2 })).toBe(1.2);
    expect(incomeFactor({})).toBe(1);
    expect(monthlyBudget(world, 7, undefined, null, undefined, 100, 1, 100, 'democracia', 0.7).income).toBeLessThan(usual);
    expect(monthlyBudget(world, 7, undefined, null, undefined, 100, 1, 100, 'democracia', 1.2).income).toBeGreaterThan(usual);
  });
});

describe('communism', () => {
  it('makes the services 30 % cheaper, the factories 25 % richer and the shops half as rich', () => {
    const { world } = town('comunismo');
    const usual = monthlyBudget(world, 7);
    const red = monthlyBudget(world, 7, undefined, null, undefined, 100, 1, 100, 'comunismo');
    expect(red.taxC).toBe(Math.round(usual.taxC * 0.5));
    expect(red.taxI).toBeGreaterThan(usual.taxI);
    expect(red.taxR).toBe(usual.taxR);
    expect(red.schools + red.clinics + red.police + red.firefighters).toBeLessThanOrEqual(usual.schools + usual.clinics + usual.police + usual.firefighters);
  });

  it('sets a five-year plan with a goal that grows with the industry, and only communism has one', () => {
    expect(newSimState(1, 'comunismo').plan).toEqual(newPlan(0, 0));
    expect(newSimState(1, 'democracia').plan).toBeNull();
    expect(newPlan(0, 0).jobs).toBe(PLAN.min);
    expect(newPlan(0, 1000).jobs).toBeGreaterThan(newPlan(0, 100).jobs);
    expect(planMonthsLeft(newPlan(0, 0), 0)).toBe(PLAN.years * 12);
    expect(planPremium(newPlan(0, 0))).toBe(PLAN.min * PLAN.premiumPerJob);
  });

  it('pays the premium and the applause when the plan is met, and sets the next one', () => {
    const { sim } = town('comunismo');
    sim.state.plan = { jobs: 1, due: 10 ** 9, start: 0 };
    const approval = sim.state.approval;
    months(sim, 1);
    expect(sim.state.news.some((n) => /Plan quinquenal cumplido/.test(n.text))).toBe(true);
    expect(sim.state.news.some((n) => /premio de [$] 150/.test(n.text))).toBe(true);
    expect(sim.state.approval).toBeGreaterThan(approval);
    expect(sim.state.plan?.jobs).toBeGreaterThanOrEqual(PLAN.min);
    expect(sim.state.plan?.jobs).not.toBe(1);
  });

  it('takes the approval of the neighbours when the plan is not met by its date', () => {
    const { sim } = town('comunismo');
    sim.state.plan = { jobs: 10 ** 6, due: TICKS_PER_MONTH * 2, start: 0 };
    sim.state.approval = 70;
    months(sim, 3);
    expect(sim.state.news.some((n) => /plan quinquenal no se cumplió/.test(n.text))).toBe(true);
    expect(sim.state.approval).toBeLessThan(70);
    expect(sim.state.plan?.jobs).toBeLessThan(10 ** 6);
  });
});

describe('saving them', () => {
  const saved = (sim: Simulation, world: World) => deserialize(serialize({ name: 'X', seed: 1, world, sim: sim.state })).sim;

  it('keeps the favor and the plan, and older saves have neither', () => {
    const t = town('teocracia');
    t.sim.state.favor = 42;
    expect(saved(t.sim, t.world).favor).toBe(42);
    expect(saved(t.sim, t.world).government).toBe('teocracia');
    const c = town('comunismo');
    c.sim.state.plan = { jobs: 77, due: 5000, start: 100 };
    expect(saved(c.sim, c.world).plan).toEqual({ jobs: 77, due: 5000, start: 100 });
    const old = JSON.parse(serialize({ name: 'X', seed: 1, world: c.world, sim: c.sim.state }));
    old.version = 16;
    delete old.sim.favor;
    delete old.sim.plan;
    const back = deserialize(JSON.stringify(old)).sim;
    expect(back.favor).toBe(FAVOR.start);
    expect(back.plan).toBeNull();
  });

  it('refuses a favor or a plan that cannot be', () => {
    const t = town('teocracia');
    const bad = (patch: (s: Record<string, unknown>) => void) => {
      const d = JSON.parse(serialize({ name: 'X', seed: 1, world: t.world, sim: t.sim.state }));
      patch(d.sim);
      return () => deserialize(JSON.stringify(d));
    };
    expect(bad((s) => (s.favor = 101))).toThrow(/favor divino/);
    expect(bad((s) => (s.plan = { jobs: -1, due: 1, start: 0 }))).toThrow(/plan quinquenal/);
  });
});
