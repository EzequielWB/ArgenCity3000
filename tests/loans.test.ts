import { describe, expect, it } from 'vitest';
import { DEFAULT_FUNDING, DEFAULT_TAX, LOANS, TICKS_PER_MONTH, TICKS_PER_WEEK } from '../src/config';
import { monthlyBudget } from '../src/sim/budget';
import { dateLabel } from '../src/sim/calendar';
import { loanEndLabel, loanInstalment, loanOwed, loanPaidOff, loanTotal, type Loan } from '../src/sim/loans';
import { Simulation, newSimState } from '../src/sim/simulation';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { applyPlan, dragCells, planTool } from '../src/world/tools';
import { World } from '../src/world/world';

const KINDS = LOANS.map((_, kind) => kind);
const fresh = (kind: number): Loan => ({ kind, paid: 0 });

function flat(n = 32): Terrain {
  const s = n + 1;
  return { n, corners: new Uint8Array(s * s).fill(SEA_LEVEL + 1), trees: new Uint8Array(n * n) };
}

function build(w: World, tool: Parameters<typeof planTool>[1], ax: number, ay: number, bx = ax, by = ay) {
  applyPlan(w, planTool(w, tool, dragCells(tool, ax, ay, bx, by, 1, w.n)));
}

/** Streets and a plant only: it never grows, so its budget is the same every month. */
function staticCity(roads: number): World {
  const w = new World(flat());
  build(w, 'plant', 20, 20);
  build(w, 'road', 0, 3, roads - 1, 3);
  return w;
}

describe('municipal loans', () => {
  it('pays back the amount plus the rate over the whole term', () => {
    expect(KINDS.map((k) => loanTotal(fresh(k)))).toEqual([13000, 36250, 80000]);
    for (const kind of KINDS) expect(loanTotal(fresh(kind))).toBe(Math.round(LOANS[kind].amount * (1 + LOANS[kind].rate)));
  });

  it('splits the total into equal instalments that add up exactly', () => {
    for (const kind of KINDS) {
      const months = LOANS[kind].months;
      const parts: number[] = [];
      for (let paid = 0; paid < months; paid++) parts.push(loanInstalment({ kind, paid }));
      expect(parts.reduce((a, b) => a + b, 0)).toBe(loanTotal(fresh(kind)));
      for (const p of parts) expect(Math.abs(p - loanTotal(fresh(kind)) / months)).toBeLessThanOrEqual(1);
    }
  });

  it('charges the instalment the panel advertises', () => {
    expect(KINDS.map((k) => loanInstalment(fresh(k)))).toEqual([542, 1007, 1667]);
  });

  it('owes less every month and nothing at the end', () => {
    const kind = 1;
    const months = LOANS[kind].months;
    let last = loanOwed(fresh(kind));
    expect(last).toBe(loanTotal(fresh(kind)));
    for (let paid = 1; paid <= months; paid++) {
      const owed = loanOwed({ kind, paid });
      expect(owed).toBeLessThan(last);
      last = owed;
    }
    expect(loanOwed({ kind, paid: months })).toBe(0);
  });

  it('is paid off exactly at the end of the term', () => {
    const months = LOANS[1].months;
    expect(loanPaidOff({ kind: 1, paid: months - 1 })).toBe(false);
    expect(loanPaidOff({ kind: 1, paid: months })).toBe(true);
  });

  it('names the month of the last instalment, and the term never moves', () => {
    // 24 instalments from Ene 1990 land between the end of Ene 1990 and the end of Dic 1991
    expect(loanEndLabel(fresh(0), 0)).toBe('Dic 1991');
    expect(loanEndLabel({ kind: 0, paid: 12 }, TICKS_PER_MONTH * 12)).toBe('Dic 1991');
    expect(loanEndLabel({ kind: 0, paid: 23 }, TICKS_PER_MONTH * 23)).toBe('Dic 1991');
    expect(loanEndLabel(fresh(0), TICKS_PER_MONTH * 12)).toBe('Dic 1992');
    // the same month as the calendar's own label for that tick
    expect(loanEndLabel(fresh(0), 0)).toBe(dateLabel(TICKS_PER_MONTH * 23));
  });
});

describe('the instalment as a budget line', () => {
  const w = staticCity(7);
  const plain = monthlyBudget(w, DEFAULT_TAX, DEFAULT_FUNDING);

  it('adds the next instalment to the expenses and takes it off the month', () => {
    const b = monthlyBudget(w, DEFAULT_TAX, DEFAULT_FUNDING, { kind: 1, paid: 0 });
    expect(b.loan).toBe(1007);
    expect(b.income).toBe(plain.income);
    expect(b.expenses).toBe(plain.expenses + 1007);
    expect(b.balance).toBe(plain.balance - 1007);
  });

  it('charges nothing with no loan, nor once it is paid off', () => {
    expect(plain.loan).toBe(0);
    const done = monthlyBudget(w, DEFAULT_TAX, DEFAULT_FUNDING, { kind: 1, paid: LOANS[1].months });
    expect(done.loan).toBe(0);
    expect(done.balance).toBe(plain.balance);
  });

  it('charges the instalment that is left, and the term adds up to the total exactly', () => {
    const months = LOANS[1].months;
    const charged: number[] = [];
    for (let paid = 0; paid < months; paid++) charged.push(monthlyBudget(w, DEFAULT_TAX, DEFAULT_FUNDING, { kind: 1, paid }).loan);
    expect(charged.reduce((a, b) => a + b, 0)).toBe(loanTotal(fresh(1)));
    expect(charged).toEqual(Array.from({ length: months }, (_, paid) => loanInstalment({ kind: 1, paid })));
  });
});

describe('taking and paying a loan', () => {
  it('hands the amount over at once and starts the term', () => {
    const sim = new Simulation(staticCity(7), newSimState(1), 'X');
    const before = sim.state.cash;
    expect(sim.takeLoan(1)).toBe(true);
    expect(sim.state.cash).toBe(before + LOANS[1].amount);
    expect(sim.state.loan).toEqual({ kind: 1, paid: 0 });
  });

  it('allows only one at a time', () => {
    const sim = new Simulation(staticCity(7), newSimState(1), 'X');
    expect(sim.takeLoan(0)).toBe(true);
    const cash = sim.state.cash;
    expect(sim.takeLoan(2)).toBe(false);
    expect(sim.state.cash).toBe(cash);
    expect(sim.state.loan).toEqual({ kind: 0, paid: 0 });
  });

  it('charges the instalment every month and closes the loan at the end of the term', () => {
    const w = staticCity(7);
    const sim = new Simulation(w, newSimState(1), 'X');
    const base = monthlyBudget(w, sim.state.taxes, sim.state.funding).balance;
    const months = LOANS[0].months;
    const start = sim.state.cash;
    sim.takeLoan(0);
    for (let m = 1; m <= months; m++) {
      for (let t = 0; t < TICKS_PER_MONTH; t++) sim.tick();
      if (m < months) expect(sim.state.loan!.paid).toBe(m);
    }
    expect(sim.state.loan).toBeNull();
    // the amount handed over, plus the ordinary months, minus exactly the total of the loan
    expect(sim.state.cash - start).toBe(LOANS[0].amount + months * base - loanTotal(fresh(0)));
  });

  it('clears the rest of the debt in one payment, and stops charging', () => {
    const sim = new Simulation(staticCity(7), newSimState(1), 'X');
    sim.state.cash = 100000;
    sim.takeLoan(2);
    for (let t = 0; t < TICKS_PER_MONTH * 5; t++) sim.tick();
    const owed = loanOwed(sim.state.loan!);
    const before = sim.state.cash;
    expect(sim.payOffLoan()).toBe(true);
    expect(sim.state.loan).toBeNull();
    expect(sim.state.cash).toBe(before - owed);
    const after = sim.state.cash;
    for (let t = 0; t < TICKS_PER_MONTH; t++) sim.tick();
    expect(sim.state.cash - after).toBe(monthlyBudget(sim.world, sim.state.taxes, sim.state.funding).balance);
  });

  it('refuses to pay off more than the cash in hand, and with nothing owed', () => {
    const sim = new Simulation(staticCity(7), newSimState(1), 'X');
    expect(sim.payOffLoan()).toBe(false);
    sim.takeLoan(2);
    sim.state.cash = 10;
    expect(sim.payOffLoan()).toBe(false);
    expect(sim.state.loan).not.toBeNull();
    expect(sim.state.cash).toBe(10);
  });

  it('lifts the city out of the crisis it borrowed for', () => {
    const sim = new Simulation(staticCity(7), newSimState(1), 'X');
    sim.state.cash = 10;
    for (let t = 0; t < TICKS_PER_WEEK; t++) sim.tick();
    expect(sim.state.crisis).toBe(true);
    sim.takeLoan(0);
    expect(sim.state.cash).toBeGreaterThan(0);
    for (let t = 0; t < TICKS_PER_WEEK; t++) sim.tick();
    expect(sim.state.crisis).toBe(false);
  });
});
