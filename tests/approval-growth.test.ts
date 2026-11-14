import { describe, expect, it } from 'vitest';
import { GROWTH_APPETITE, computeDemand } from '../src/sim/demand';
import { GOVERNMENTS } from '../src/config';
import { APPROVAL, approvalAppetite, stepApproval } from '../src/sim/politics';
import { Simulation, newSimState } from '../src/sim/simulation';
import { generateTerrain } from '../src/world/terrain';
import { World } from '../src/world/world';

/** A city of the given form of government, with the neighbours' approval forced to `approval`. */
function cityWith(approval: number, government: 'democracia' | 'dictadura' | 'tecnocracia' = 'democracia'): Simulation {
  const sim = new Simulation(new World(generateTerrain(5, 32)), newSimState(5, government), 'Villa');
  sim.state.approval = approval;
  sim.refresh();
  return sim;
}

describe('approval scales the appetite for growth', () => {
  it('is neutral at the election line and runs from 0.75 to 1.25', () => {
    expect(approvalAppetite(APPROVAL.toWin)).toBeCloseTo(1, 10);
    expect(approvalAppetite(0)).toBeCloseTo(0.75, 10);
    expect(approvalAppetite(100)).toBeCloseTo(1.25, 10);
  });

  it('never leaves the band, not even with a broken number', () => {
    expect(approvalAppetite(-40)).toBeCloseTo(0.75, 10);
    expect(approvalAppetite(400)).toBeCloseTo(1.25, 10);
  });

  it('grows with every point of approval', () => {
    let last = -1;
    for (let approval = 0; approval <= 100; approval++) {
      const factor = approvalAppetite(approval);
      expect(factor).toBeGreaterThan(last);
      last = factor;
    }
  });

  it('makes a loved Intendente attract more people than a disliked one', () => {
    const loved = cityWith(90);
    const hated = cityWith(30);
    expect(loved.appetite).toBeCloseTo(GROWTH_APPETITE * approvalAppetite(90), 10);
    expect(hated.appetite).toBeCloseTo(GROWTH_APPETITE * approvalAppetite(30), 10);
    expect(loved.appetite).toBeGreaterThan(hated.appetite);
    // The demand for homes follows the appetite: a city at 90 % wants to be bigger than one at 30 %.
    const totals = { pop: 1000, cJobs: 170, iJobs: 380 };
    expect(computeDemand(totals, 7, loved.appetite).R).toBeGreaterThan(computeDemand(totals, 7, hated.appetite).R);
  });

  it('lets the ceiling of a form of government cap the mood too', () => {
    // A dictatorship never gets past 60, so it never gets past this appetite.
    const capped = stepApproval(95, 95, 'dictadura');
    expect(capped).toBe(GOVERNMENTS.dictadura.approvalCap);
    expect(approvalAppetite(capped)).toBeCloseTo(1.05, 10);
    expect(approvalAppetite(95)).toBeGreaterThan(approvalAppetite(capped));
    const sim = cityWith(60, 'dictadura');
    expect(sim.appetite).toBeCloseTo(GROWTH_APPETITE * GOVERNMENTS.dictadura.migration * 1.05, 10);
  });

  it('leaves the hard brakes alone: a stalled city does not grow on charm', () => {
    const sim = cityWith(100);
    expect(sim.appetite).toBeGreaterThan(1);
    sim.setTax(12);
    expect(sim.appetite).toBe(1);
  });
});
