import { describe, expect, it } from 'vitest';
import { World, TILE } from '../src/world/world';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { applyPlan, dragCells, planTool } from '../src/world/tools';
import { CAPACITY, INITIAL_CASH, PLANT_CAPACITY, POWER_USE, TICKS_PER_MONTH } from '../src/config';
import { dateLabel, dateOf } from '../src/sim/calendar';
import { computePower } from '../src/sim/power';
import { computeRoadAccess, computeParks, computePollution, computeLandValue } from '../src/sim/fields';
import { cityTotals, computeDemand } from '../src/sim/demand';
import { monthlyBudget } from '../src/sim/budget';
import { headlinesFor, type CitySnapshot } from '../src/sim/news';
import { MILESTONES } from '../src/sim/milestones';
import { Simulation, newSimState } from '../src/sim/simulation';

function flat(n = 32, waterFromX = n): Terrain {
  const s = n + 1;
  const corners = new Uint8Array(s * s);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) corners[y * s + x] = x >= waterFromX ? SEA_LEVEL - 1 : SEA_LEVEL + 1;
  return { n, corners, trees: new Uint8Array(n * n) };
}

function build(w: World, tool: Parameters<typeof planTool>[1], ax: number, ay: number, bx = ax, by = ay) {
  applyPlan(w, planTool(w, tool, dragCells(tool, ax, ay, bx, by, 1, w.n)));
}

describe('calendar', () => {
  it('starts in Ene 1990 and advances one month every TICKS_PER_MONTH ticks', () => {
    expect(dateLabel(0)).toBe('Ene 1990');
    expect(dateLabel(TICKS_PER_MONTH - 1)).toBe('Ene 1990');
    expect(dateLabel(TICKS_PER_MONTH)).toBe('Feb 1990');
    expect(dateLabel(TICKS_PER_MONTH * 12)).toBe('Ene 1991');
    expect(dateOf(TICKS_PER_MONTH * 14)).toEqual({ month: 3, year: 1991 });
  });
});

describe('computePower', () => {
  it('powers zones next to a power line from a plant, but not those only joined to it by a road', () => {
    const w = new World(flat());
    build(w, 'plant', 0, 0);
    build(w, 'line', 2, 0, 5, 0);
    build(w, 'road', 6, 0, 6, 9);
    build(w, 'zoneR', 5, 1); // next to the line
    build(w, 'zoneR', 7, 6); // on the road, out of the reach of the line: roads carry no light
    build(w, 'zoneR', 20, 20); // isolated
    const r = computePower(w);
    expect(r.capacity).toBe(PLANT_CAPACITY);
    expect(w.powered[w.idx(5, 1)]).toBe(1);
    expect(w.powered[w.idx(7, 6)]).toBe(0);
    expect(w.powered[w.idx(20, 20)]).toBe(0);
  });

  it('browns out buildings beyond the plant capacity', () => {
    const w = new World(flat());
    build(w, 'plant', 0, 0);
    build(w, 'zoneI', 2, 0, 31, 31);
    for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === TILE.I) w.level[i] = 4;
    const r = computePower(w);
    expect(r.use).toBeGreaterThan(r.capacity);
    expect(r.shortage).toBe(true);
    let powered = 0;
    for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === TILE.I && w.powered[i]) powered++;
    expect(powered).toBe(Math.floor(PLANT_CAPACITY / (4 * POWER_USE.I)));
  });
});

describe('fields', () => {
  it('gives road access within reach only', () => {
    const w = new World(flat());
    build(w, 'road', 0, 10, 31, 10);
    computeRoadAccess(w);
    expect(w.roadAccess[w.idx(5, 13)]).toBe(1);
    expect(w.roadAccess[w.idx(5, 14)]).toBe(0);
  });

  it('spreads pollution from industry and lowers land value', () => {
    const w = new World(flat());
    build(w, 'zoneI', 10, 10);
    w.level[w.idx(10, 10)] = 4;
    computePollution(w);
    computeLandValue(w);
    expect(w.pollution[w.idx(11, 10)]).toBeGreaterThan(0);
    expect(w.pollution[w.idx(30, 30)]).toBe(0);
    expect(w.landValue[w.idx(11, 10)]).toBeLessThan(w.landValue[w.idx(30, 30)]);
  });

  it('raises land value near water and parks', () => {
    const w = new World(flat(32, 28));
    // A plaza counts from three cells up: a single tile is an ornament.
    build(w, 'park', 5, 4, 5, 6);
    computePollution(w);
    computeParks(w, 100);
    computeLandValue(w);
    const base = w.landValue[w.idx(15, 20)];
    expect(w.landValue[w.idx(26, 20)]).toBeGreaterThan(base);
    expect(w.landValue[w.idx(5, 5)]).toBeGreaterThan(base);
  });

  it('leaves a single plaza tile without any effect', () => {
    const w = new World(flat(32, 28));
    build(w, 'park', 5, 5);
    computePollution(w);
    computeParks(w, 100);
    computeLandValue(w);
    expect(w.parkArea[w.idx(5, 5)]).toBe(1);
    expect(w.landValue[w.idx(5, 5)]).toBe(w.landValue[w.idx(15, 20)]);
  });
});

describe('demand', () => {
  it('counts residents and jobs per level', () => {
    const w = new World(flat());
    build(w, 'zoneR', 0, 0);
    build(w, 'zoneC', 1, 0);
    build(w, 'zoneI', 2, 0);
    w.level[w.idx(0, 0)] = 2;
    w.level[w.idx(1, 0)] = 3;
    w.level[w.idx(2, 0)] = 1;
    const t = cityTotals(w);
    expect(t.pop).toBe(CAPACITY.R[2]);
    expect(t.cJobs).toBe(CAPACITY.C[3]);
    expect(t.iJobs).toBe(CAPACITY.I[1]);
  });

  it('wants everything in an empty city and lowers demand with taxes', () => {
    const d = computeDemand({ pop: 0, cJobs: 0, iJobs: 0 }, 7);
    expect(d.R).toBeGreaterThan(50);
    expect(d.C).toBeGreaterThan(50);
    expect(d.I).toBeGreaterThan(50);
    const high = computeDemand({ pop: 0, cJobs: 0, iJobs: 0 }, 20);
    expect(high.R).toBeLessThan(d.R);
  });

  it('asks for jobs when there are many residents and few jobs', () => {
    const d = computeDemand({ pop: 2000, cJobs: 50, iJobs: 50 }, 7);
    expect(d.R).toBeLessThan(0);
    expect(d.I).toBeGreaterThan(50);
    expect(d.C).toBeGreaterThan(50);
  });

  it('stays within [-100, 100]', () => {
    for (const t of [
      { pop: 0, cJobs: 9999, iJobs: 9999 },
      { pop: 99999, cJobs: 0, iJobs: 0 },
    ]) {
      const d = computeDemand(t, 0);
      for (const v of [d.R, d.C, d.I]) {
        expect(v).toBeGreaterThanOrEqual(-100);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('monthlyBudget', () => {
  it('charges upkeep for roads and plants and collects no taxes from an empty city', () => {
    const w = new World(flat());
    build(w, 'plant', 0, 0);
    build(w, 'road', 3, 0, 12, 0);
    const b = monthlyBudget(w, 7);
    expect(b.income).toBe(0);
    expect(b.plants).toBeGreaterThan(0);
    expect(b.roads).toBeGreaterThan(0);
    expect(b.balance).toBe(b.income - b.expenses);
    expect(b.expenses).toBe(b.roads + b.lines + b.parks + b.plants + b.services);
  });

  it('charges municipal services that grow faster than the population', () => {
    const small = new World(flat());
    build(small, 'zoneR', 0, 0, 4, 4);
    for (let i = 0; i < small.tiles.length; i++) if (small.tiles[i] === TILE.R) small.level[i] = 1;
    const big = new World(flat());
    build(big, 'zoneR', 0, 0, 31, 31);
    for (let i = 0; i < big.tiles.length; i++) if (big.tiles[i] === TILE.R) big.level[i] = 4;
    const s = monthlyBudget(small, 7);
    const b = monthlyBudget(big, 7);
    const popSmall = cityTotals(small).pop;
    const popBig = cityTotals(big).pop;
    expect(s.services).toBeGreaterThan(0);
    expect(b.services / popBig).toBeGreaterThan(s.services / popSmall);
  });

  it('collects more with more residents and a higher rate', () => {
    const w = new World(flat());
    build(w, 'zoneR', 0, 0, 4, 4);
    for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === TILE.R) w.level[i] = 3;
    const low = monthlyBudget(w, 5);
    const high = monthlyBudget(w, 10);
    expect(low.taxR).toBeGreaterThan(0);
    expect(high.taxR).toBeGreaterThan(low.taxR);
    expect(Number.isInteger(high.taxR)).toBe(true);
  });
});

describe('headlinesFor', () => {
  const base: CitySnapshot = {
    pop: 0,
    buildings: 0,
    plants: 0,
    shortage: false,
    crisis: false,
    taxes: { R: 7, C: 7, I: 7 },
    funding: { school: 100, clinic: 100, police: 100, fire: 100 },
    green: 100,
    month: 1,
    year: 1990,
    cash: 1000,
    abandoned: 0,
    loan: null,
    ports: 0,
    resorts: 0,
  };

  it('announces the first plant and the first residents', () => {
    const lines = headlinesFor(base, { ...base, plants: 1, pop: 6, buildings: 1 }, 'Villa Test');
    expect(lines.some((l) => l.includes('usina'))).toBe(true);
    expect(lines.some((l) => l.includes('vecinos'))).toBe(true);
  });

  it('announces population milestones once', () => {
    const a = headlinesFor({ ...base, pop: 90 }, { ...base, pop: 120 }, 'X');
    expect(a.some((l) => l.includes('100'))).toBe(true);
    const b = headlinesFor({ ...base, pop: 120 }, { ...base, pop: 130 }, 'X');
    expect(b.some((l) => l.includes('100'))).toBe(false);
  });

  it('reports blackouts, the cash crisis and their end', () => {
    expect(headlinesFor(base, { ...base, shortage: true }, 'X').length).toBeGreaterThan(0);
    expect(headlinesFor({ ...base, shortage: true }, base, 'X').length).toBeGreaterThan(0);
    expect(headlinesFor(base, { ...base, crisis: true }, 'X').length).toBeGreaterThan(0);
    expect(headlinesFor({ ...base, crisis: true }, base, 'X').length).toBeGreaterThan(0);
  });

  it('summarises the year in January', () => {
    const lines = headlinesFor({ ...base, month: 12 }, { ...base, month: 1, year: 1991, pop: 500 }, 'X');
    expect(lines.some((l) => l.includes('1990'))).toBe(true);
  });

  it('reports a wave of abandonment and the recovery', () => {
    expect(headlinesFor({ ...base, abandoned: 4 }, { ...base, abandoned: 12 }, 'X').some((l) => l.includes('abandono'))).toBe(true);
    expect(headlinesFor({ ...base, abandoned: 12 }, { ...base, abandoned: 2 }, 'X').some((l) => l.includes('Vuelven'))).toBe(true);
  });

  it('reports taking a loan and finishing it, and stays quiet while it runs', () => {
    const taken = headlinesFor(base, { ...base, loan: 1 }, 'X').join(' ');
    expect(taken).toMatch(/crédito/i);
    expect(taken).toMatch(/\$ 25\.000/); // what the middle loan hands over
    expect(headlinesFor({ ...base, loan: 1 }, base, 'X').join(' ')).toMatch(/crédito/i);
    expect(headlinesFor({ ...base, loan: 1 }, { ...base, loan: 1 }, 'X').join(' ')).not.toMatch(/crédito/i);
    // Paying one off and taking another in the same month is two pieces of news.
    const swapped = headlinesFor({ ...base, loan: 1 }, { ...base, loan: 2 }, 'X').join(' ');
    expect(swapped).toMatch(/terminó de pagar/i);
    expect(swapped).toMatch(/\$ 50\.000/);
  });

  it('says nothing when nothing changed', () => {
    expect(headlinesFor(base, base, 'X')).toEqual([]);
  });
});

describe('Simulation', () => {
  function starterCity(): World {
    const w = new World(flat());
    build(w, 'plant', 0, 1);
    build(w, 'road', 0, 3, 31, 3);
    build(w, 'road', 0, 9, 31, 9);
    // Roads carry no light: a power line runs from the plant along the middle row between the zones.
    build(w, 'line', 0, 4, 0, 6);
    build(w, 'line', 1, 6, 31, 6);
    build(w, 'zoneR', 2, 4, 20, 5);
    build(w, 'zoneR', 2, 7, 20, 8);
    build(w, 'zoneI', 22, 4, 31, 8);
    build(w, 'zoneC', 2, 10, 20, 11);
    return w;
  }

  it('always starts a new city with the initial cash in Ene 1990', () => {
    const s = newSimState(1);
    expect(s.cash).toBe(INITIAL_CASH);
    expect(dateLabel(s.tick)).toBe('Ene 1990');
  });

  it('grows a connected, powered city', () => {
    const w = starterCity();
    const sim = new Simulation(w, newSimState(5), 'Villa Test');
    for (let i = 0; i < TICKS_PER_MONTH * 12; i++) sim.tick();
    const t = cityTotals(w);
    expect(t.pop).toBeGreaterThan(100);
    expect(t.iJobs).toBeGreaterThan(0);
    expect(t.cJobs).toBeGreaterThan(0);
  });

  it('is deterministic for the same seed and layout', () => {
    const a = new Simulation(starterCity(), newSimState(5), 'A');
    const b = new Simulation(starterCity(), newSimState(5), 'A');
    for (let i = 0; i < 500; i++) {
      a.tick();
      b.tick();
    }
    expect(Array.from(a.world.level)).toEqual(Array.from(b.world.level));
    expect(a.state.cash).toBe(b.state.cash);
  });

  it('never grows zones without power', () => {
    const w = new World(flat());
    build(w, 'road', 0, 3, 31, 3);
    build(w, 'zoneR', 2, 4, 20, 5);
    const sim = new Simulation(w, newSimState(5), 'X');
    for (let i = 0; i < 600; i++) sim.tick();
    expect(cityTotals(w).pop).toBe(0);
  });

  it('settles the budget every month', () => {
    const w = starterCity();
    const sim = new Simulation(w, newSimState(5), 'X');
    const before = sim.state.cash;
    for (let i = 0; i < TICKS_PER_MONTH; i++) sim.tick();
    expect(sim.state.lastBudget).not.toBeNull();
    // A milestone reached during the month pays its grant on top of the budget.
    const grants = MILESTONES.slice(1, sim.state.milestone + 1).reduce((sum, m) => sum + m.grant, 0);
    expect(sim.state.cash).toBe(before + sim.state.lastBudget!.balance + grants);
  });

  it('refuses to spend more than the cash available', () => {
    const sim = new Simulation(starterCity(), newSimState(5), 'X');
    sim.state.cash = 100;
    expect(sim.spend(150)).toBe(false);
    expect(sim.state.cash).toBe(100);
    expect(sim.spend(60)).toBe(true);
    expect(sim.state.cash).toBe(40);
  });

  it('freezes growth while the cash is negative and resumes after it recovers', () => {
    const w = starterCity();
    const sim = new Simulation(w, newSimState(5), 'X');
    sim.state.cash = -5000;
    for (let i = 0; i < TICKS_PER_MONTH * 2; i++) sim.tick();
    expect(sim.state.crisis).toBe(true);
    expect(cityTotals(w).pop).toBe(0);
    sim.state.cash = 50000;
    for (let i = 0; i < TICKS_PER_MONTH * 6; i++) sim.tick();
    expect(sim.state.crisis).toBe(false);
    expect(cityTotals(w).pop).toBeGreaterThan(0);
  });

  it('publishes headlines in the newspaper', () => {
    const sim = new Simulation(starterCity(), newSimState(5), 'Villa Test');
    for (let i = 0; i < TICKS_PER_MONTH * 6; i++) sim.tick();
    expect(sim.state.news.length).toBeGreaterThan(0);
    expect(sim.state.news[0].date).toMatch(/\d{4}$/);
  });
});
