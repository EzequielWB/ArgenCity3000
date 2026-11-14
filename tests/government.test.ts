import { describe, expect, it } from 'vitest';
import { GOVERNMENTS, TICKS_PER_MONTH } from '../src/config';
import { SAVE_VERSION, deserialize, serialize } from '../src/save/save';
import { governmentCardsHtml } from '../src/ui/government';
import { advanceMilestones } from '../src/sim/milestones';
import { electionDue, monthsToElection, nextElectionYear, stepApproval } from '../src/sim/politics';
import { Simulation, newSimState } from '../src/sim/simulation';
import { generateTerrain } from '../src/world/terrain';
import { World } from '../src/world/world';

/** The first tick after the end of a month, counted from January 1990. */
const afterMonth = (month: number) => (month + 1) * TICKS_PER_MONTH;

describe('forms of government', () => {
  it('holds elections when its own term says so, and a dictatorship holds none', () => {
    // October 1993 ends month 45, October 1995 ends month 69.
    expect(electionDue(afterMonth(45), 'democracia')).toBe(true);
    expect(electionDue(afterMonth(45), 'tecnocracia')).toBe(false);
    expect(electionDue(afterMonth(69), 'democracia')).toBe(false);
    expect(electionDue(afterMonth(69), 'tecnocracia')).toBe(true);
    for (const month of [45, 69, 100, 200]) expect(electionDue(afterMonth(month), 'dictadura')).toBe(false);
  });

  it('counts the months to the next election, and none when there are none', () => {
    expect(monthsToElection(0, 'democracia')).toBe(46);
    expect(nextElectionYear(0, 'democracia')).toBe(1993);
    expect(nextElectionYear(0, 'tecnocracia')).toBe(1995);
    expect(monthsToElection(0, 'dictadura')).toBeNull();
    expect(nextElectionYear(0, 'dictadura')).toBeNull();
  });

  it('keeps the approval under the ceiling of the government and moves it at its own pace', () => {
    expect(stepApproval(58, 100, 'dictadura')).toBe(60);
    expect(stepApproval(60, 100, 'dictadura')).toBe(60);
    expect(stepApproval(60, 100, 'democracia')).toBe(64);
    expect(stepApproval(40, 100, 'tecnocracia')).toBe(42);
    expect(stepApproval(40, 100, 'democracia')).toBe(44);
  });

  it('pays the milestones what the government gets from the Province', () => {
    const state = { milestone: 0, cash: 0 };
    const reached = advanceMilestones(state, 120, GOVERNMENTS.dictadura.grants);
    expect(reached.map((m) => m.name)).toEqual(['Caserío']);
    expect(state.milestone).toBe(1);
    expect(state.cash).toBe(0);
    const paid = { milestone: 0, cash: 0 };
    advanceMilestones(paid, 120, GOVERNMENTS.democracia.grants);
    expect(paid.cash).toBe(GOVERNMENTS.democracia.grants * 1500);
  });

  it('attracts fewer people under a dictatorship or a technocracy', () => {
    const appetite = (government: 'democracia' | 'dictadura' | 'tecnocracia'): number => {
      const w = new World(generateTerrain(5, 32));
      const sim = new Simulation(w, newSimState(5, government), 'Villa');
      return sim.appetite;
    };
    const base = appetite('democracia');
    expect(appetite('dictadura')).toBeCloseTo(base * 0.8, 5);
    expect(appetite('tecnocracia')).toBeCloseTo(base * 0.95, 5);
  });

  it('saves the form of government and the party, and older saves are democracies', () => {
    const w = new World(generateTerrain(5, 32));
    const sim = new Simulation(w, newSimState(5, 'dictadura', 'Partido del Conurbano'), 'Villa');
    const text = serialize({ name: 'Villa', seed: 5, world: w, sim: sim.state });
    const back = deserialize(text);
    expect(back.sim.government).toBe('dictadura');
    expect(back.sim.party).toBe('Partido del Conurbano');
    expect(SAVE_VERSION).toBe(10);

    const data = JSON.parse(text);
    data.version = 9;
    delete data.sim.government;
    delete data.sim.party;
    const old = deserialize(JSON.stringify(data));
    expect(old.sim.government).toBe('democracia');
    expect(old.sim.party).toBe('');
  });

  it('offers the three forms with their pros and cons, and marks the one in force', () => {
    expect(governmentCardsHtml('dictadura')).toContain('value="dictadura" checked');
    expect(governmentCardsHtml('dictadura').match(/checked/g)).toHaveLength(1);
    const html = governmentCardsHtml();
    for (const id of ['democracia', 'dictadura', 'tecnocracia']) expect(html).toContain(`value="${id}"`);
    expect(html).toContain('value="democracia" checked');
    expect(html.match(/checked/g)).toHaveLength(1);
    for (const kind of ['democracia', 'dictadura', 'tecnocracia'] as const) {
      for (const pro of GOVERNMENTS[kind].pros) expect(html).toContain(pro);
      for (const con of GOVERNMENTS[kind].cons) expect(html).toContain(con);
    }
    expect(html).toContain('(recomendada)');
  });

  it('signs the founding: party, form of government and one headline, not two', () => {
    const w = new World(generateTerrain(5, 32));
    const sim = new Simulation(w, newSimState(5), 'Villa', 'Norma Quiroga');
    expect(sim.state.party).toBe('');
    expect(sim.state.news[0].text).not.toContain('partido');
    const before = sim.appetite;

    sim.found('dictadura', 'Partido del Conurbano');
    expect(sim.state.government).toBe('dictadura');
    expect(sim.state.party).toBe('Partido del Conurbano');
    expect(sim.state.news).toHaveLength(1);
    expect(sim.state.news[0].text).toContain('Partido del Conurbano');
    expect(sim.state.news[0].text).toContain('dictadura');
    expect(sim.appetite).toBeCloseTo(before * GOVERNMENTS.dictadura.migration, 5);
  });

  it('rejects a save with a government nobody knows', () => {
    const w = new World(generateTerrain(5, 32));
    const sim = new Simulation(w, newSimState(5), 'Villa');
    const data = JSON.parse(serialize({ name: 'Villa', seed: 5, world: w, sim: sim.state }));
    data.sim.government = 'monarquia';
    expect(() => deserialize(JSON.stringify(data))).toThrow(/gobierno/i);
  });
});
