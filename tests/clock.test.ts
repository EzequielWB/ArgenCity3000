import { describe, expect, it } from 'vitest';
import { World } from '../src/world/world';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { applyPlan, dragCells, planTool } from '../src/world/tools';
import { TICKS_PER_MONTH, TICKS_PER_WEEK, WEEKS_PER_MONTH } from '../src/config';
import { cumulativeShare, dateLabel, weekLabel, weekOf } from '../src/sim/calendar';
import { monthlyBudget } from '../src/sim/budget';
import { MILESTONES } from '../src/sim/milestones';
import { Simulation, newSimState } from '../src/sim/simulation';

function flat(n = 32): Terrain {
  const s = n + 1;
  return { n, corners: new Uint8Array(s * s).fill(SEA_LEVEL + 1), trees: new Uint8Array(n * n) };
}

function build(w: World, tool: Parameters<typeof planTool>[1], ax: number, ay: number, bx = ax, by = ay) {
  applyPlan(w, planTool(w, tool, dragCells(tool, ax, ay, bx, by, 1, w.n)));
}

/** Streets and a plant only: it never grows, so its budget is the same every week. */
function staticCity(roads: number): World {
  const w = new World(flat());
  build(w, 'plant', 20, 20);
  build(w, 'road', 0, 3, roads - 1, 3);
  return w;
}

/** A small growing city with income (home, shop and workshop zones around a street and a plant). */
function growingCity(): World {
  const w = new World(flat());
  build(w, 'plant', 0, 1);
  build(w, 'road', 0, 3, 31, 3);
  build(w, 'zoneR', 2, 4, 14, 5);
  build(w, 'zoneC', 15, 4, 21, 5);
  build(w, 'zoneI', 22, 4, 31, 6);
  return w;
}

/** Cash after every week for `weeks` weeks, starting from the initial cash. */
function weeklyCash(sim: Simulation, weeks: number): number[] {
  const out = [sim.state.cash];
  for (let k = 0; k < weeks; k++) {
    for (let t = 0; t < TICKS_PER_WEEK; t++) sim.tick();
    out.push(sim.state.cash);
  }
  return out;
}

describe('the calendar by weeks', () => {
  it('has 4 weeks of 15 ticks in a 60-tick month', () => {
    expect(TICKS_PER_WEEK).toBe(15);
    expect(WEEKS_PER_MONTH).toBe(4);
    expect(TICKS_PER_WEEK * WEEKS_PER_MONTH).toBe(TICKS_PER_MONTH);
    expect(TICKS_PER_MONTH).toBe(60);
  });

  it('numbers the week 1 to 4 inside each month', () => {
    expect([0, 14, 15, 29, 30, 44, 45, 59, 60, 75].map(weekOf)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 1, 2]);
  });

  it('labels the week and the month, across month and year boundaries', () => {
    expect(weekLabel(0)).toBe('Sem 1 · Ene 1990');
    expect(weekLabel(14)).toBe('Sem 1 · Ene 1990');
    expect(weekLabel(15)).toBe('Sem 2 · Ene 1990');
    expect(weekLabel(59)).toBe('Sem 4 · Ene 1990');
    expect(weekLabel(60)).toBe('Sem 1 · Feb 1990');
    expect(weekLabel(TICKS_PER_MONTH * 12 - 1)).toBe('Sem 4 · Dic 1990');
    expect(weekLabel(TICKS_PER_MONTH * 12)).toBe('Sem 1 · Ene 1991');
    expect(weekLabel(TICKS_PER_MONTH * 12 + 2 * TICKS_PER_WEEK)).toBe('Sem 3 · Ene 1991');
  });

  it('keeps the month-level label for the newspaper and the save slots', () => {
    expect(dateLabel(0)).toBe('Ene 1990');
    expect(dateLabel(59)).toBe('Ene 1990');
    expect(dateLabel(60)).toBe('Feb 1990');
  });
});

describe('weekly money', () => {
  it('splits any monthly balance into four weekly amounts that add up exactly', () => {
    for (const balance of [0, 1, -1, 2, 3, 5, -5, 7, -7, 357, -357, 1001, -1172, 99999, -100001]) {
      const parts = [1, 2, 3, 4].map((week) => cumulativeShare(balance, week) - cumulativeShare(balance, week - 1));
      expect(parts.reduce((a, b) => a + b, 0)).toBe(balance);
      for (const p of parts) expect(Math.abs(p - balance / 4)).toBeLessThanOrEqual(1);
    }
    expect(cumulativeShare(-1172, 0)).toBe(0);
  });

  it('moves the cash once a week, and the four weeks add up to the monthly balance (odd, negative)', () => {
    const w = staticCity(7);
    const sim = new Simulation(w, newSimState(1), 'X');
    const balance = monthlyBudget(w, sim.state.taxes, sim.state.funding).balance;
    expect(balance % 2).not.toBe(0);
    expect(balance).toBeLessThan(0);
    const cash = weeklyCash(sim, 4);
    const deltas = cash.slice(1).map((c, k) => c - cash[k]);
    expect(deltas.every((d) => d !== 0)).toBe(true);
    for (const d of deltas) expect(Math.abs(d - balance / 4)).toBeLessThanOrEqual(1);
    expect(deltas.reduce((a, b) => a + b, 0)).toBe(balance);
    expect(sim.state.lastBudget!.balance).toBe(balance);
  });

  it('does not touch the cash between weekly settlements', () => {
    const sim = new Simulation(staticCity(7), newSimState(1), 'X');
    const start = sim.state.cash;
    for (let t = 0; t < TICKS_PER_WEEK - 1; t++) sim.tick();
    expect(sim.state.cash).toBe(start);
    sim.tick();
    expect(sim.state.cash).not.toBe(start);
  });

  it('gives a month the same cash as the old monthly settlement (even and odd balances)', () => {
    for (const roads of [6, 7, 12, 13]) {
      const w = staticCity(roads);
      const sim = new Simulation(w, newSimState(1), 'X');
      const old = sim.state.cash + monthlyBudget(w, sim.state.taxes, sim.state.funding).balance;
      for (let t = 0; t < TICKS_PER_MONTH; t++) sim.tick();
      expect(sim.state.cash).toBe(old);
    }
  });

  it('adds up to lastBudget.balance each month even while the city grows and earns', () => {
    const sim = new Simulation(growingCity(), newSimState(5), 'X');
    sim.state.cash = 1_000_000;
    for (let month = 0; month < 6; month++) {
      const before = sim.state.cash;
      const reached = sim.state.milestone;
      const cash = weeklyCash(sim, 4);
      // A milestone reached during the month pays its grant on top of the budget.
      const grants = MILESTONES.slice(reached + 1, sim.state.milestone + 1).reduce((sum, m) => sum + m.grant, 0);
      expect(sim.state.cash - before).toBe(sim.state.lastBudget!.balance + grants);
      expect(cash).toHaveLength(5);
    }
    expect(sim.totals.pop).toBeGreaterThan(0);
  });

  it('shows the last budget only once the 4th week closes', () => {
    const sim = new Simulation(staticCity(7), newSimState(1), 'X');
    for (let t = 0; t < TICKS_PER_MONTH - 1; t++) sim.tick();
    expect(sim.state.lastBudget).toBeNull();
    sim.tick();
    expect(sim.state.lastBudget).not.toBeNull();
  });

  it('settles correctly in a game saved in the middle of a month', () => {
    const w = staticCity(7);
    const state = newSimState(1);
    state.tick = TICKS_PER_WEEK * 2; // two weeks into the month, as a loaded save would be
    const sim = new Simulation(w, state, 'X');
    const balance = monthlyBudget(w, sim.state.taxes, sim.state.funding).balance;
    const before = sim.state.cash;
    for (let t = 0; t < TICKS_PER_WEEK * 2; t++) sim.tick(); // weeks 3 and 4
    expect(sim.state.cash - before).toBe(cumulativeShare(balance, 4) - cumulativeShare(balance, 2));
    // the next full month pays exactly one balance
    const next = sim.state.cash;
    for (let t = 0; t < TICKS_PER_MONTH; t++) sim.tick();
    expect(sim.state.cash - next).toBe(balance);
  });

  it('puts the city in crisis as soon as a weekly payment leaves the cash negative', () => {
    const sim = new Simulation(staticCity(7), newSimState(1), 'X');
    sim.state.cash = 10;
    for (let t = 0; t < TICKS_PER_WEEK; t++) sim.tick();
    expect(sim.state.cash).toBeLessThan(0);
    expect(sim.state.crisis).toBe(true);
  });
});

describe('what stays monthly', () => {
  it('rolls fires and the history chart once per month', () => {
    const sim = new Simulation(growingCity(), newSimState(5), 'X');
    let fireRolls = 0;
    const internals = sim as unknown as { igniteFires(): void };
    const igniteFires = internals.igniteFires.bind(sim);
    internals.igniteFires = () => {
      fireRolls++;
      igniteFires();
    };
    for (let m = 1; m <= 3; m++) {
      for (let t = 0; t < TICKS_PER_MONTH; t++) {
        sim.tick();
        if (t % TICKS_PER_WEEK === TICKS_PER_WEEK - 1 && t < TICKS_PER_MONTH - 1) {
          expect(sim.state.history).toHaveLength(m - 1); // no history entry at the end of a week
          expect(fireRolls).toBe(m - 1);
        }
      }
      expect(sim.state.history).toHaveLength(m);
      expect(fireRolls).toBe(m);
    }
  });

  it('writes the newspaper date at month level', () => {
    const sim = new Simulation(growingCity(), newSimState(5), 'X');
    for (let t = 0; t < TICKS_PER_MONTH * 2; t++) sim.tick();
    for (const item of sim.state.news) expect(item.date).toMatch(/^[A-Z][a-z]{2} \d{4}$/);
  });
});
