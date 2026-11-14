import { describe, expect, it } from 'vitest';
import { TICKS_PER_MONTH } from '../src/config';
import { deserialize, serialize } from '../src/save/save';
import { APPROVAL, computeApproval, electionDue, monthsToElection, nextElectionYear, stepApproval, type ApprovalInputs } from '../src/sim/politics';
import { Simulation, newSimState } from '../src/sim/simulation';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { TILE, World } from '../src/world/world';

function flat(n = 32): Terrain {
  const s = n + 1;
  return { n, corners: new Uint8Array(s * s).fill(SEA_LEVEL + 1), trees: new Uint8Array(n * n) };
}

/** 2.000 residents in lit towers with just-acceptable services, and jobs for all of them. */
function town(): World {
  const w = new World(flat());
  for (let k = 0; k < 13; k++) {
    w.setTile(k, 5, TILE.R, 4);
    w.setTile(k, 7, TILE.I, 4);
  }
  w.powered.fill(1);
  w.health.fill(APPROVAL.fairCoverage);
  w.edu.fill(APPROVAL.fairCoverage);
  w.landValue.fill(APPROVAL.fairLandValue);
  return w;
}

const calm: ApprovalInputs = { taxes: { R: 7, C: 7, I: 7 }, crisis: false, jammedShare: 0, abandoned: 0, pop: 13 * 160, jobs: 13 * 120, growth: 0 };
const points = (w: World, over: Partial<ApprovalInputs> = {}) => computeApproval(w, { ...calm, ...over }).target;

describe('approval', () => {
  it('is 50 in an empty city and in a town where nothing stands out', () => {
    expect(computeApproval(new World(flat()), { ...calm, pop: 0, jobs: 0 })).toEqual({ target: 50, factors: [] });
    expect(points(town())).toBe(50);
  });

  it('goes up with good services, low taxes and valuable land', () => {
    const w = town();
    w.health.fill(100);
    expect(points(w)).toBeGreaterThan(50);
    const e = town();
    e.edu.fill(100);
    expect(points(e)).toBeGreaterThan(50);
    expect(points(town(), { taxes: { R: 4, C: 4, I: 4 } })).toBeGreaterThan(50);
    const v = town();
    v.landValue.fill(80);
    expect(points(v)).toBeGreaterThan(50);
    const growing = computeApproval(town(), { ...calm, growth: 0.25 });
    expect(growing.target).toBeGreaterThan(50);
    expect(growing.factors).toEqual([{ label: 'Progreso', points: growing.target - 50 }]);
  });

  it('goes down with each thing the neighbours complain about, and names it', () => {
    const cases: [string, (w: World) => Partial<ApprovalInputs>][] = [
      ['Impuestos', () => ({ taxes: { R: 12, C: 12, I: 12 } })],
      ['Caja en rojo', () => ({ crisis: true })],
      ['Tránsito', () => ({ jammedShare: 0.8 })],
      ['Edificios abandonados', () => ({ abandoned: 10 })],
      ['Falta de trabajo', () => ({ jobs: 200 })],
      ['Progreso', () => ({ growth: -0.2 })],
      ['Apagones', (w) => (w.powered.fill(0), {})],
      ['Delito', (w) => (w.crime.fill(60), {})],
      ['Humo', (w) => (w.pollution.fill(60), {})],
      ['Salud', (w) => (w.health.fill(0), {})],
      ['Educación', (w) => (w.edu.fill(0), {})],
    ];
    for (const [label, change] of cases) {
      const w = town();
      const report = computeApproval(w, { ...calm, ...change(w) });
      expect(report.target, label).toBeLessThan(50);
      const factor = report.factors.find((f) => f.label === label);
      expect(factor, label).toBeDefined();
      expect(factor!.points, label).toBeLessThan(0);
    }
  });

  it('forgives a little crime and a little smoke', () => {
    const w = town();
    w.crime.fill(APPROVAL.tolerated);
    w.pollution.fill(APPROVAL.tolerated);
    expect(points(w)).toBe(50);
  });

  it('asks little of the services of a very small city and stays between 0 and 100', () => {
    const w = town();
    w.health.fill(0);
    w.edu.fill(0);
    expect(points(w, { pop: 60 })).toBeGreaterThan(points(w));
    w.powered.fill(0);
    w.crime.fill(100);
    w.pollution.fill(100);
    const worst = points(w, { taxes: { R: 20, C: 20, I: 20 }, crisis: true, jammedShare: 1, abandoned: 26, jobs: 0 });
    expect(worst).toBeGreaterThanOrEqual(0);
    expect(worst).toBeLessThan(15);
  });

  it('moves towards its target a few points per month', () => {
    expect(stepApproval(50, 90)).toBe(50 + APPROVAL.step);
    expect(stepApproval(50, 10)).toBe(50 - APPROVAL.step);
    expect(stepApproval(50, 52)).toBe(52);
    expect(stepApproval(50, 50)).toBe(50);
  });
});

describe('elections', () => {
  const months = (year: number, month: number) => ((year - 1990) * 12 + month - 1) * TICKS_PER_MONTH; // tick at the start of that month

  it('are held when October ends, every four years from 1993', () => {
    expect(electionDue(months(1993, 11))).toBe(true);
    expect(electionDue(months(1997, 11))).toBe(true);
    expect(electionDue(months(1993, 10))).toBe(false);
    expect(electionDue(months(1994, 11))).toBe(false);
    expect(electionDue(months(1990, 11))).toBe(false);
    expect(nextElectionYear(months(1990, 1))).toBe(1993);
    expect(nextElectionYear(months(1993, 10))).toBe(1993);
    expect(nextElectionYear(months(1993, 11))).toBe(1997);
    expect(monthsToElection(months(1993, 10))).toBe(1);
    expect(monthsToElection(months(1992, 11))).toBe(12);
  });

  function runTo(sim: Simulation, tick: number): void {
    while (sim.state.tick < tick) sim.tick();
  }

  it('re-elect an Intendente with half the neighbours behind him, and say so in the paper', () => {
    const sim = new Simulation(new World(flat()), newSimState(1), 'Prueba');
    runTo(sim, months(1993, 11));
    expect(sim.state.terms).toBe(1);
    expect(sim.state.lostElection).toBe(false);
    expect(sim.state.news[0].text).toMatch(/reelecto/);
    runTo(sim, months(1997, 11));
    expect(sim.state.terms).toBe(2);
  });

  it('are lost under 50, and after that the city goes on without elections', () => {
    const sim = new Simulation(new World(flat()), newSimState(1), 'Prueba');
    runTo(sim, months(1993, 10));
    sim.state.approval = 30;
    runTo(sim, months(1993, 11));
    expect(sim.state.lostElection).toBe(true);
    expect(sim.state.terms).toBe(0);
    expect(sim.state.news[0].text).toMatch(/perdió/);
    const news = sim.state.news.length;
    runTo(sim, months(1997, 11));
    expect(sim.state.terms).toBe(0);
    expect(sim.state.news.filter((n) => /Elecciones/.test(n.text)).length).toBe(1);
    expect(sim.state.news.length).toBeGreaterThanOrEqual(news);
  });

  it('saves approval and mandate, and gives older saves a fresh start', () => {
    const s = newSimState(1);
    expect(s.approval).toBe(APPROVAL.start);
    s.approval = 63;
    s.terms = 2;
    s.lostElection = true;
    const text = serialize({ name: 'Prueba', seed: 1, world: new World(flat()), sim: s });
    expect(deserialize(text).sim).toMatchObject({ approval: 63, terms: 2, lostElection: true });
    const old = JSON.parse(text);
    old.version = 3;
    delete old.sim.approval;
    delete old.sim.terms;
    delete old.sim.lostElection;
    expect(deserialize(JSON.stringify(old)).sim).toMatchObject({ approval: APPROVAL.start, terms: 0, lostElection: false });
    const bad = JSON.parse(text);
    bad.sim.approval = 140;
    expect(() => deserialize(JSON.stringify(bad))).toThrow('La aprobación de la partida es inválida');
    for (const [field, value] of [
      ['terms', -1],
      ['terms', 1.5],
      ['lostElection', 1],
    ] as const) {
      const broken = JSON.parse(text);
      broken.sim[field] = value;
      expect(() => deserialize(JSON.stringify(broken)), field).toThrow('El mandato de la partida es inválido');
    }
  });
});
