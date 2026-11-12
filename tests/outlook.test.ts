import { describe, expect, it } from 'vitest';
import { FIXED_SHARE, SERVICES, TICKS_PER_MONTH } from '../src/config';
import type { BudgetReport } from '../src/sim/budget';
import {
  describeOutlook,
  formatBalance,
  placementUpkeep,
  runwayHeadline,
  runwayMonths,
  servicesCostHeadline,
  serviceUpkeepRange,
} from '../src/sim/outlook';
import { Simulation, newSimState } from '../src/sim/simulation';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { applyPlan, dragCells, planTool, type ToolId } from '../src/world/tools';
import { World } from '../src/world/world';

function report(over: Partial<BudgetReport> = {}): BudgetReport {
  const b = { taxR: 0, taxC: 0, taxI: 0, roads: 0, lines: 0, parks: 0, plants: 0, services: 0, schools: 0, clinics: 0, police: 0, firefighters: 0, income: 0, expenses: 0, balance: 0, ...over };
  b.income = b.taxR + b.taxC + b.taxI;
  b.expenses = b.roads + b.lines + b.parks + b.plants + b.services + b.schools + b.clinics + b.police + b.firefighters;
  b.balance = b.income - b.expenses;
  return b;
}

describe('formatBalance', () => {
  it('writes the sign and thousands separators the Argentine way', () => {
    expect(formatBalance(420)).toBe('+$420/mes');
    expect(formatBalance(-1172)).toBe('-$1.172/mes');
    expect(formatBalance(0)).toBe('+$0/mes');
    expect(formatBalance(12345)).toBe('+$12.345/mes');
  });
});

describe('runwayMonths', () => {
  it('is the months the cash lasts at a negative balance, rounded down', () => {
    expect(runwayMonths(20000, -1172)).toBe(17);
    expect(runwayMonths(1000, -1000)).toBe(1);
    expect(runwayMonths(999, -1000)).toBe(0);
  });

  it('does not exist when the balance is zero or positive', () => {
    expect(runwayMonths(5000, 0)).toBeNull();
    expect(runwayMonths(5000, 420)).toBeNull();
  });

  it('is zero when the cash is already negative', () => {
    expect(runwayMonths(-300, -100)).toBe(0);
  });
});

describe('describeOutlook', () => {
  const losing = (loss: number) => report({ roads: loss }); // income 0
  it('shows a positive balance in green, with no runway', () => {
    const o = describeOutlook(report({ taxR: 900, roads: 480 }), 30000);
    expect(o.balanceText).toBe('+$420/mes');
    expect(o.balanceTone).toBe('good');
    expect(o.runwayText).toBeNull();
    expect(o.runwayTone).toBeNull();
    expect(o.tooltip).not.toMatch(/alcanza para/);
  });

  it('shows a negative balance in red, and says nothing about the runway when the cash lasts a year or more', () => {
    for (const cash of [12000, 20000, 1_000_000]) {
      const o = describeOutlook(losing(1000), cash);
      expect(o.balanceText).toBe('-$1.000/mes');
      expect(o.balanceTone).toBe('bad');
      expect(o.runwayText).toBeNull();
    }
    expect(describeOutlook(losing(1000), 20000).tooltip).toMatch(/alcanza para 20 meses/);
  });

  it('puts the runway next to the balance below 12 months: amber from 6 to 11, red below 6', () => {
    expect(describeOutlook(losing(1000), 11999)).toMatchObject({ runwayText: 'caja para 11 meses', runwayTone: 'warn' });
    expect(describeOutlook(losing(1000), 6000)).toMatchObject({ runwayText: 'caja para 6 meses', runwayTone: 'warn' });
    expect(describeOutlook(losing(1000), 5999)).toMatchObject({ runwayText: 'caja para 5 meses', runwayTone: 'bad' });
    expect(describeOutlook(losing(1000), 1000)).toMatchObject({ runwayText: 'caja para 1 mes', runwayTone: 'bad' });
    expect(describeOutlook(losing(1000), 400)).toMatchObject({ runwayText: 'la caja no llega a fin de mes', runwayTone: 'bad' });
  });

  it('says plainly that the cash is already negative', () => {
    const o = describeOutlook(losing(100), -50);
    expect(o.runwayText).toBe('caja en rojo');
    expect(o.runwayTone).toBe('bad');
    expect(o.tooltip).toMatch(/caja ya está en rojo/);
    // even with a positive balance the cash is still in the red until it recovers
    expect(describeOutlook(report({ taxR: 500 }), -50).runwayText).toBe('caja en rojo');
  });

  it('lists income, expenses and the big lines in the tooltip', () => {
    const b = report({ taxR: 300, taxC: 100, taxI: 50, roads: 200, plants: 350, services: 90, schools: 120, clinics: 80, police: 60, firefighters: 40 });
    const t = describeOutlook(b, 9000).tooltip;
    expect(t).toContain('Ingresos: $450');
    expect(t).toContain('Gastos: $940');
    expect(t).toContain('Saldo: -$490');
    expect(t).toMatch(/Servicios públicos: \$300/);
    expect(t).toMatch(/Administración: \$90/);
    expect(t).toMatch(/Usinas: \$350/);
    expect(t).toMatch(/Calles[^\n]*: \$200/);
  });
});

describe('placement text', () => {
  it('gives each service the range of its monthly upkeep', () => {
    for (const kind of ['school', 'clinic', 'police', 'fire'] as const) {
      const r = serviceUpkeepRange(kind);
      expect(r.min).toBe(Math.round(SERVICES[kind].upkeep * FIXED_SHARE));
      expect(r.max).toBe(SERVICES[kind].upkeep);
    }
  });

  it('shows the minimum upkeep for services and the fixed one for the plant', () => {
    expect(placementUpkeep('school')).toBe(`mantenimiento desde $ ${Math.round(SERVICES.school.upkeep * FIXED_SHARE)}/mes`);
    expect(placementUpkeep('plant')).toBe('mantenimiento $ 350/mes');
    expect(placementUpkeep('road')).toBeNull();
    expect(placementUpkeep('zoneR')).toBeNull();
  });
});

describe('cause headlines', () => {
  it('warns how many months the cash lasts at a negative balance, when under a year', () => {
    expect(runwayHeadline(losingReport(1000), 7500)).toBe('A este ritmo la caja alcanza para 7 meses');
    expect(runwayHeadline(losingReport(1000), 1500)).toBe('A este ritmo la caja alcanza para 1 mes');
    expect(runwayHeadline(losingReport(1000), 12000)).toBeNull();
    expect(runwayHeadline(report({ taxR: 100 }), 100)).toBeNull(); // earning
    expect(runwayHeadline(losingReport(1000), -10)).toBeNull(); // the crisis headline covers this
  });

  it('says what the public services cost against what the neighbours pay, only when they weigh a third of the expenses and exceed the income', () => {
    const heavy = report({ taxR: 100, schools: 300, clinics: 200, police: 100, firefighters: 100, roads: 100 });
    expect(servicesCostHeadline(heavy)).toBe('Los servicios públicos cuestan $ 700 por mes y los vecinos aportan $ 100');
    // not a third of the expenses
    expect(servicesCostHeadline(report({ taxR: 100, schools: 300, roads: 800 }))).toBeNull();
    // the neighbours pay for them
    expect(servicesCostHeadline(report({ taxR: 900, schools: 300, clinics: 200, roads: 100 }))).toBeNull();
  });
});

function losingReport(loss: number): BudgetReport {
  return report({ roads: loss });
}

// ------------------------------------------------------------- the headlines in the paper

function flat(n = 32): Terrain {
  const s = n + 1;
  return { n, corners: new Uint8Array(s * s).fill(SEA_LEVEL + 1), trees: new Uint8Array(n * n) };
}

function build(w: World, tool: ToolId, ax: number, ay: number, bx = ax, by = ay) {
  applyPlan(w, planTool(w, tool, dragCells(tool, ax, ay, bx, by, 1, w.n)));
}

/** Two built lots of each basic zone (so the paper is open) and the four services, with no power: nothing grows. */
function townWithServices(): World {
  const w = new World(flat());
  build(w, 'road', 0, 8, 12, 8);
  for (const [tool, y] of [['zoneR', 0], ['zoneC', 2], ['zoneI', 4]] as const) {
    build(w, tool, 0, y, 1, y);
    for (let x = 0; x < 2; x++) w.setLevel(w.idx(x, y), 1);
  }
  build(w, 'school', 8, 0);
  build(w, 'clinic', 8, 2);
  build(w, 'police', 8, 4);
  build(w, 'fire', 8, 6);
  return w;
}

const text = (sim: Simulation, part: string) => sim.state.news.filter((n) => n.text.includes(part));
const month = (sim: Simulation, m = 1) => {
  for (let t = 0; t < TICKS_PER_MONTH * m; t++) sim.tick();
};

describe('the cause headlines in the newspaper', () => {
  it('warns about the runway once the paper is open, and again only after the cooldown', () => {
    const sim = new Simulation(townWithServices(), newSimState(1), 'Villa Test');
    sim.state.cash = 1500; // the balance is about -230 a month: six months of cash
    month(sim);
    expect(text(sim, 'A este ritmo la caja alcanza para')).toHaveLength(1);
    expect(text(sim, 'A este ritmo')[0].text).toMatch(/para [4-6] meses$/);
    sim.state.cash = 1500;
    month(sim, 2);
    expect(text(sim, 'A este ritmo')).toHaveLength(1);
    sim.state.cash = 1500;
    month(sim, 6);
    expect(text(sim, 'A este ritmo').length).toBeGreaterThanOrEqual(2);
  });

  it('does not warn while the cash lasts a year', () => {
    const sim = new Simulation(townWithServices(), newSimState(1), 'Villa Test');
    sim.state.cash = 100000;
    month(sim, 3);
    expect(text(sim, 'A este ritmo')).toHaveLength(0);
  });

  it('explains the cost of the services only after two bad months in a row', () => {
    const sim = new Simulation(townWithServices(), newSimState(1), 'Villa Test');
    sim.state.cash = 100000;
    month(sim);
    expect(text(sim, 'Los servicios públicos cuestan')).toHaveLength(0);
    month(sim);
    expect(text(sim, 'Los servicios públicos cuestan')).toHaveLength(1);
    expect(text(sim, 'Los servicios públicos cuestan')[0].text).toMatch(/cuestan \$ \d+ por mes y los vecinos aportan \$ \d+$/);
    month(sim, 2);
    expect(text(sim, 'Los servicios públicos cuestan')).toHaveLength(1); // cooldown
  });

  it('never writes them while the paper is closed', () => {
    const w = townWithServices();
    for (let i = 0; i < w.level.length; i++) w.setLevel(i, 0); // no built lots: the paper stays closed
    const sim = new Simulation(w, newSimState(1), 'Villa Test');
    sim.state.cash = 1500;
    month(sim, 4);
    expect(sim.state.news).toHaveLength(1);
  });
});
