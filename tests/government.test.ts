import { describe, expect, it } from 'vitest';
import { GOVERNMENTS, TICKS_PER_MONTH } from '../src/config';
import { SAVE_VERSION, deserialize, serialize } from '../src/save/save';
import { governmentCardsHtml } from '../src/ui/government';
import { advanceMilestones } from '../src/sim/milestones';
import { electionDue, monthsToElection, nextElectionYear, stepApproval } from '../src/sim/politics';
import { DICTATOR_FOLLOWUPS, dictatorHeadline } from '../src/sim/mayor';
import { Simulation, newSimState } from '../src/sim/simulation';
import { SEA_LEVEL, generateTerrain } from '../src/world/terrain';
import { applyPlan, dragCells, planTool } from '../src/world/tools';
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

  it('attracts fewer people under a dictatorship or a technocracy, as a slower arrival and not as a cliff', () => {
    // The appetite of the city is the same: the government sets how fast the homes go up.
    const appetite = (government: 'democracia' | 'dictadura' | 'tecnocracia'): number => {
      const w = new World(generateTerrain(5, 32));
      return new Simulation(w, newSimState(5, government), 'Villa').appetite;
    };
    expect(appetite('dictadura')).toBe(appetite('democracia'));
    expect(GOVERNMENTS.dictadura.migration).toBeLessThan(GOVERNMENTS.tecnocracia.migration);
    // A town left to grow for years: fewer people under each, and none of them stuck at a few hundred.
    const grown = (government: 'democracia' | 'dictadura' | 'comunismo'): number => {
      const n = 40;
      const w = new World({ n, corners: new Uint8Array((n + 1) * (n + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(n * n) });
      const build = (tool: Parameters<typeof planTool>[1], ax: number, ay: number, bx = ax, by = ay) => applyPlan(w, planTool(w, tool, dragCells(tool, ax, ay, bx, by, 1, n)));
      for (const [x, y] of [[1, 1], [30, 1], [1, 30], [30, 30]] as const) build('plant', x, y);
      for (const y of [8, 20]) build('line', 0, y - 5, 39, y - 5), build('line', 0, y + 5, 39, y + 5), build('road', 0, y, 39, y);
      build('line', 5, 3, 5, 25);
      for (const y of [8, 20]) build('zoneR', 3, y + 1, 38, y + 4), build('zoneR', 3, y - 4, 38, y - 1);
      build('zoneC', 3, 13, 38, 15);
      build('zoneI', 3, 17, 38, 19);
      const sim = new Simulation(w, newSimState(3, government, 'P'), 'Villa');
      sim.state.cash = 10_000_000;
      for (let t = 0; t < TICKS_PER_MONTH * 5; t++) sim.tick();
      return sim.totals.pop;
    };
    const democracy = grown('democracia');
    expect(democracy).toBeGreaterThan(200);
    // Under the slower governments the town grows all the same (it used to stay at a few hundred): no cliff.
    expect(grown('dictadura')).toBeGreaterThan(democracy * 0.6);
    expect(grown('comunismo')).toBeGreaterThan(democracy * 0.6);
  });

  it('saves the form of government and the party, and older saves are democracies', () => {
    const w = new World(generateTerrain(5, 32));
    const sim = new Simulation(w, newSimState(5, 'dictadura', 'Partido del Conurbano'), 'Villa');
    const text = serialize({ name: 'Villa', seed: 5, world: w, sim: sim.state });
    const back = deserialize(text);
    expect(back.sim.government).toBe('dictadura');
    expect(back.sim.party).toBe('Partido del Conurbano');
    expect(SAVE_VERSION).toBe(19);

    const data = JSON.parse(text);
    data.version = 9;
    delete data.sim.government;
    delete data.sim.party;
    const old = deserialize(JSON.stringify(data));
    expect(old.sim.government).toBe('democracia');
    expect(old.sim.party).toBe('');
  });

  it('offers every form as a closed card, with its pros and cons inside, and opens only the one asked for', () => {
    const closed = governmentCardsHtml();
    expect(closed).not.toContain('open');
    expect(closed).not.toContain('aria-expanded="true"');
    expect(closed.match(/aria-expanded="false"/g)).toHaveLength(5);
    expect(closed.match(/<ul class="gov-list" hidden>/g)).toHaveLength(5);
    for (const id of ['democracia', 'dictadura', 'tecnocracia', 'teocracia', 'comunismo']) expect(closed).toContain(`data-gov="${id}"`);
    for (const kind of ['democracia', 'dictadura', 'tecnocracia'] as const) {
      for (const pro of GOVERNMENTS[kind].pros) expect(closed).toContain(pro);
      for (const con of GOVERNMENTS[kind].cons) expect(closed).toContain(con);
    }
    expect(closed).toContain('(recomendada)');
    const opened = governmentCardsHtml('dictadura');
    expect(opened.match(/aria-expanded="true"/g)).toHaveLength(1);
    expect(opened).toContain('class="gov-card open" data-gov="dictadura"');
    expect(opened.match(/<ul class="gov-list" hidden>/g)).toHaveLength(4);
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
    expect(sim.appetite).toBeCloseTo(before, 5); // the form of government changes how fast homes go up, not the appetite
  });

  it('rejects a save with a government nobody knows', () => {
    const w = new World(generateTerrain(5, 32));
    const sim = new Simulation(w, newSimState(5), 'Villa');
    const data = JSON.parse(serialize({ name: 'Villa', seed: 5, world: w, sim: sim.state }));
    data.sim.government = 'monarquia';
    expect(() => deserialize(JSON.stringify(data))).toThrow(/gobierno/i);
  });
});

describe('la tecnocracia', () => {
  it('se juega el cargo cada seis años y con la mitad de la aprobación', () => {
    expect(GOVERNMENTS.tecnocracia.termYears).toBe(6);
    expect(GOVERNMENTS.tecnocracia.toWin).toBe(50);
    // The same bar as a democracy, but the term is longer.
    expect(GOVERNMENTS.democracia.toWin).toBe(50);
    expect(GOVERNMENTS.democracia.termYears).toBe(4);
  });
});

describe('la dictadura', () => {
  /** A dictatorship about to close the month that ends October 1993, when a democracy would vote. */
  function october(): Simulation {
    const world = new World(generateTerrain(5, 32));
    const sim = new Simulation(world, newSimState(5, 'dictadura'), 'Villa Nadie');
    sim.state.party = 'Orden y Progreso';
    sim.state.tick = 46 * TICKS_PER_MONTH - 1;
    return sim;
  }

  it('no anuncia votación: no hay ninguna', () => {
    expect(nextElectionYear(0, 'dictadura')).toBeNull();
    expect(monthsToElection(0, 'dictadura')).toBeNull();
  });

  it('igual publica su acto eleccionario, con los contrincantes desaparecidos', () => {
    const sim = october();
    sim.tick();
    const texts = sim.state.news.map((n) => n.text);
    expect(texts.some((t) => /Acto eleccionario 1993: El partido Orden y Progreso gana por amplia mayoría/.test(t))).toBe(true);
    expect(texts.some((t) => /después de que sus contrincantes desaparecieran/.test(t))).toBe(true);
    // And the day after, the second line: always worse than the first.
    expect(texts.some((t) => /cuerpos|casa quedó vacía|denuncias|auto sin patente|veedores/.test(t))).toBe(true);
    // Nobody was re-elected because nobody voted.
    expect(sim.state.terms).toBe(0);
    expect(sim.state.lostElection).toBe(false);
  });

  it('no lo publica en un octubre cualquiera', () => {
    const sim = october();
    sim.state.tick -= TICKS_PER_MONTH * 12; // a year earlier
    sim.tick();
    expect(sim.state.news.every((n) => !/Acto eleccionario/.test(n.text))).toBe(true);
  });

  it('nombra al Intendente cuando la partida no tiene partido', () => {
    expect(dictatorHeadline(1993, '', 'Norma Quiroga')).toMatch(/Intendente Norma Quiroga gana por amplia mayoría/);
    for (const line of DICTATOR_FOLLOWUPS) expect(line.length).toBeGreaterThan(50);
  });
});
