import { describe, expect, it } from 'vitest';
import { COAST, COAST_KINDS, FISHING_SALES, TICKS_PER_MONTH, TICKS_PER_WEEK, TOURISM, type CoastKind } from '../src/config';
import { SAVE_VERSION, deserialize, serialize, toBase64 } from '../src/save/save';
import { monthlyBudget } from '../src/sim/budget';
import { coastRefusal, coastWorks, countCoast, seasonOf, tourismFor } from '../src/sim/coast';
import { computeCongestion } from '../src/sim/congestion';
import { cityTotals } from '../src/sim/demand';
import { computeLandValue, computeParks, computePollution, computeRoadAccess } from '../src/sim/fields';
import { MILESTONES, isUnlocked, milestoneOfTool } from '../src/sim/milestones';
import { CitySnapshot, headlinesFor } from '../src/sim/news';
import { computeApproval, type ApprovalInputs } from '../src/sim/politics';
import { describeCell } from '../src/sim/report';
import { Simulation, newSimState } from '../src/sim/simulation';
import { TOOL_ICONS } from '../src/ui/icons';
import { lockNotice, toolPrice } from '../src/ui/toolbar';
import { UndoHistory } from '../src/world/history';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { TOOLS, TOOL_GROUPS, applyPlan, dragCells, groupOfTool, planTool, type ToolId } from '../src/world/tools';
import { MAX_TILE, TILE, World, coastOf, coastTile } from '../src/world/world';

const WATER = SEA_LEVEL - 1;

/**
 * Sea to the west (cells x 0..7). North half (y < 16): a sand column at x = 8 and land from x = 9.
 * South half: land from x = 8, with no sand at all (a bluff).
 */
/** Light everywhere: the light of the coast buildings has its own tests below. */
const lit = (w: World): World => (w.powered.fill(1), w.roadAccess.fill(1), w);

function shore(n = 32): Terrain {
  const s = n + 1;
  const corners = new Uint8Array(s * s);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const bluff = y >= 16;
      corners[y * s + x] = x <= 7 ? WATER : x === 8 && !bluff ? SEA_LEVEL : SEA_LEVEL + 2;
    }
  }
  return { n, corners, trees: new Uint8Array(n * n) };
}

function dry(n = 32): Terrain {
  const s = n + 1;
  return { n, corners: new Uint8Array(s * s).fill(SEA_LEVEL + 2), trees: new Uint8Array(n * n) };
}

const BEACH: [number, number] = [8, 5];
const BLUFF: [number, number] = [8, 20];

function plan(w: World, tool: ToolId, ax: number, ay: number, bx = ax, by = ay) {
  return planTool(w, tool, dragCells(tool, ax, ay, bx, by, 1, w.n));
}

function build(w: World, tool: ToolId, ax: number, ay: number, bx = ax, by = ay) {
  const p = plan(w, tool, ax, ay, bx, by);
  applyPlan(w, p);
  return p;
}

/** A world on the shore with a street that reaches the beach lots, so what stands there works. */
function streetWorld(): World {
  const w = lit(new World(shore()));
  build(w, 'road', 10, 3, 10, 12);
  computeRoadAccess(w);
  return w;
}

const COAST_TOOLS: CoastKind[] = ['fishing', 'promenade', 'port', 'resort', 'lighthouse'];

describe('the coast tools', () => {
  it('exist with the keys Z X V L F, one lot each and the closed prices of the spec', () => {
    const tools = COAST_TOOLS.map((id) => TOOLS.find((t) => t.id === id)!);
    expect(tools.map((t) => [t.id, t.key.toUpperCase(), t.shape])).toEqual([
      ['fishing', 'Z', 'point'],
      ['promenade', 'X', 'rect'],
      ['port', 'V', 'point'],
      ['resort', 'L', 'point'],
      ['lighthouse', 'F', 'point'],
    ]);
    expect(COAST_KINDS).toEqual(COAST_TOOLS);
    expect(COAST_TOOLS.map((k) => [COAST[k].cost, COAST[k].upkeep, COAST[k].jobs])).toEqual([
      [400, 30, 12],
      [25, 2, 0],
      [2500, 200, 40],
      [1800, 120, 30],
      [1500, 60, 0],
    ]);
    expect(FISHING_SALES).toBe(80);
    expect(COAST_TOOLS.map((k) => COAST[k].label)).toEqual(['Muelle de pescadores', 'Costanera', 'Puerto de carga', 'Balneario', 'Faro']);
  });

  it('use keys no other tool uses', () => {
    const keys = TOOLS.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const reserved of ['b', 'q', 'e', 'c', 'p', 'g', 'h', 'm', 'n', 'w', 'a', 's', 'd', ' ']) expect(keys).not.toContain(reserved);
  });

  it('form the Costa category, with every tool in exactly one category', () => {
    const coast = TOOL_GROUPS.find((g) => g.label === 'Costa')!;
    expect(coast.tools).toEqual(COAST_TOOLS);
    for (const t of COAST_TOOLS) expect(groupOfTool(t)).toBe(coast);
    const grouped = TOOL_GROUPS.flatMap((g) => g.tools);
    expect([...grouped].sort()).toEqual(TOOLS.map((t) => t.id).sort());
  });

  it('have an icon and a price in the toolbar', () => {
    for (const t of COAST_TOOLS) {
      expect(TOOL_ICONS[t]).toContain('<svg');
      expect(toolPrice(t)).toBe(COAST[t].cost);
    }
  });

  it('use consecutive tile ids after the firehouse, and the save accepts them', () => {
    expect(COAST_TOOLS.map((k) => coastTile(k))).toEqual([TILE.FISHING, TILE.PROMENADE, TILE.PORT, TILE.RESORT, TILE.LIGHTHOUSE]);
    expect([TILE.FISHING, TILE.PROMENADE, TILE.PORT, TILE.RESORT, TILE.LIGHTHOUSE]).toEqual([12, 13, 14, 15, 16]);
    expect(TILE.BUS).toBe(TILE.LIGHTHOUSE + 1);
    expect(TILE.AIRPORT).toBe(TILE.BUS + 1);
    expect(MAX_TILE).toBe(TILE.HARBOR);
    for (const k of COAST_TOOLS) expect(coastOf(coastTile(k))).toBe(k);
    expect(coastOf(TILE.FIREHOUSE)).toBeNull();
    expect(coastOf(TILE.EMPTY)).toBeNull();
  });
});

describe('unlocking the coast tools', () => {
  it('opens each one at the milestone of the spec, and keeps them locked before', () => {
    const at = (k: CoastKind) => MILESTONES[milestoneOfTool(k)];
    expect([at('fishing'), at('promenade'), at('port'), at('resort'), at('lighthouse')].map((m) => [m.name, m.pop])).toEqual([
      ['Caserío', 100],
      ['Pueblo', 200],
      ['Ciudad', 1000],
      ['Ciudad', 1000],
      ['Gran ciudad', 5000],
    ]);
    for (const k of COAST_TOOLS) {
      expect(isUnlocked(k, milestoneOfTool(k) - 1)).toBe(false);
      expect(isUnlocked(k, milestoneOfTool(k))).toBe(true);
    }
  });

  it('tells the player when a locked tool opens', () => {
    expect(lockNotice('lighthouse')).toContain('Gran ciudad');
    expect(lockNotice('fishing')).toContain('Caserío');
  });
});

describe('where the coast buildings go', () => {
  it('puts a fishing dock and a port on a beach lot next to the water, and charges the price', () => {
    const w = lit(new World(shore()));
    for (const k of ['fishing', 'port'] as const) {
      const p = plan(w, k, ...BEACH);
      expect(p.cells).toEqual([BEACH]);
      expect(p.cost).toBe(COAST[k].cost);
    }
  });

  it('accepts a bluff lot that touches the water for everything but the resort', () => {
    const w = lit(new World(shore()));
    for (const k of ['fishing', 'port', 'lighthouse'] as const) expect(plan(w, k, ...BLUFF).cells).toEqual([BLUFF]);
    expect(plan(w, 'promenade', ...BLUFF).cells).toEqual([BLUFF]);
    expect(plan(w, 'resort', ...BLUFF).cells).toEqual([]);
  });

  it('puts the resort only on sand next to the water', () => {
    const w = lit(new World(shore()));
    const p = plan(w, 'resort', ...BEACH);
    expect(p.cells).toEqual([BEACH]);
    expect(p.cost).toBe(COAST.resort.cost);
    expect(plan(w, 'resort', 9, 5).cells).toEqual([]); // land behind the sand: not touching the water
  });

  it('refuses inland lots, water and lots that are taken', () => {
    const w = lit(new World(shore()));
    for (const k of ['fishing', 'promenade', 'port', 'resort', 'lighthouse'] as const) {
      expect(plan(w, k, 20, 5).cells).toEqual([]);
      expect(plan(w, k, 3, 5).cells).toEqual([]);
    }
    build(w, 'road', 8, 5);
    expect(plan(w, 'port', 8, 5).cells).toEqual([]);
    build(w, 'fishing', 8, 8);
    expect(plan(w, 'port', 8, 8).cells).toEqual([]);
  });

  it('counts "next to the water" with the 8 neighbours, diagonal ones included', () => {
    const n = 32;
    const s = n + 1;
    const corners = new Uint8Array(s * s).fill(SEA_LEVEL + 2);
    // Four low corners make a lake of 3 x 3 cells, (9..11, 9..11).
    for (const [cx, cy] of [
      [10, 10],
      [11, 10],
      [10, 11],
      [11, 11],
    ])
      corners[cy * s + cx] = WATER;
    const w = lit(new World({ n, corners, trees: new Uint8Array(n * n) }));
    expect(w.isWater(11, 11)).toBe(true);
    expect(w.isWater(12, 12)).toBe(false);
    expect(plan(w, 'port', 12, 12).cells).toEqual([[12, 12]]); // touches the lake only at a corner
    expect(plan(w, 'port', 12, 10).cells).toEqual([[12, 10]]);
    expect(plan(w, 'port', 13, 13).cells).toEqual([]);
  });

  it('drags the promenade like the plaza, keeping only the lots on the coast', () => {
    const w = lit(new World(shore()));
    const along = plan(w, 'promenade', 8, 3, 8, 6);
    expect(along.cells).toHaveLength(4);
    expect(along.cost).toBe(4 * COAST.promenade.cost);
    const across = plan(w, 'promenade', 8, 3, 11, 3);
    expect(across.cells).toEqual([[8, 3]]);
    expect(across.cost).toBe(COAST.promenade.cost);
  });

  it('puts the lighthouse on land within 2 lots of the water, one per city', () => {
    const w = lit(new World(shore()));
    expect(plan(w, 'lighthouse', 9, 5).cells).toEqual([[9, 5]]);
    expect(plan(w, 'lighthouse', 10, 5).cells).toEqual([]); // 3 lots from the water
    const first = build(w, 'lighthouse', 9, 5);
    expect(first.cost).toBe(COAST.lighthouse.cost);
    expect(countCoast(w).lighthouse).toBe(1);
    expect(plan(w, 'lighthouse', 9, 20).cells).toEqual([]);
    // Demolishing it frees the place for another.
    build(w, 'bulldoze', 9, 5);
    expect(plan(w, 'lighthouse', 9, 20).cells).toEqual([[9, 20]]);
  });

  it('places nothing on a map without water', () => {
    const w = lit(new World(dry()));
    for (const k of COAST_TOOLS) expect(plan(w, k, 10, 10).cells).toEqual([]);
  });

  it('does not level the ground, light the lot or clear the neighbours', () => {
    const w = lit(new World(shore()));
    const before = w.terrain.corners.slice();
    w.terrain.trees[w.idx(...BEACH)] = 2;
    const net = w.networkVersion;
    for (const k of ['fishing', 'port'] as const) build(w, k, BEACH[0], BEACH[1] + (k === 'port' ? 2 : 0));
    build(w, 'resort', 8, 9);
    expect(w.terrain.corners).toEqual(before);
    expect(w.networkVersion).toBeGreaterThan(net);
    expect(w.level[w.idx(...BEACH)]).toBe(0);
    expect(w.terrain.trees[w.idx(...BEACH)]).toBe(0); // the building took the lot of the tree
  });

  it('writes its tile, and the tile of a zoned lot without building is free to build on', () => {
    const w = lit(new World(shore()));
    w.setTile(8, 5, TILE.R, 0);
    build(w, 'fishing', 8, 5);
    expect(w.tileAt(8, 5)).toBe(TILE.FISHING);
    build(w, 'resort', 8, 7);
    expect(w.tileAt(8, 7)).toBe(TILE.RESORT);
  });

  it('keeps the old tools exactly as they were', () => {
    const w = lit(new World(shore()));
    expect(plan(w, 'park', 20, 5).cells).toEqual([[20, 5]]);
    expect(plan(w, 'school', 20, 5).cells).toEqual([[20, 5]]);
    expect(plan(w, 'plant', 20, 5).cells).toHaveLength(4);
  });
});

describe('why a coast building is refused', () => {
  it('says it has to be on the coast on a map without water, and on any inland lot', () => {
    const none = lit(new World(dry()));
    const inland = lit(new World(shore()));
    for (const k of COAST_TOOLS) {
      expect(coastRefusal(none, k, 10, 10)).toMatch(/costa/i);
      expect(coastRefusal(none, k, 10, 10)).toMatch(/no tiene agua/i);
    }
    for (const k of ['fishing', 'promenade', 'port'] as const) expect(coastRefusal(inland, k, 20, 5)).toMatch(/costa/i);
    expect(coastRefusal(inland, 'port', 3, 5)).toMatch(/tierra/i);
  });

  it('asks for sand at the resort and for the water within 2 lots at the lighthouse', () => {
    const w = lit(new World(shore()));
    expect(coastRefusal(w, 'resort', ...BLUFF)).toMatch(/playa/i);
    expect(coastRefusal(w, 'lighthouse', 20, 5)).toMatch(/2 lotes/);
  });

  it('says there is already a lighthouse', () => {
    const w = lit(new World(shore()));
    build(w, 'lighthouse', 9, 5);
    expect(coastRefusal(w, 'lighthouse', 9, 8)).toMatch(/un solo faro/i);
  });

  it('says nothing about lots that are fine, or only taken', () => {
    const w = lit(new World(shore()));
    expect(coastRefusal(w, 'port', ...BEACH)).toBeNull();
    build(w, 'road', 8, 8);
    expect(coastRefusal(w, 'port', 8, 8)).toBeNull();
  });
});

describe('a coast building at work', () => {
  it('works with a street within 3 lots, and only then (fishing dock, port, resort)', () => {
    const w = lit(new World(shore()));
    build(w, 'fishing', 8, 5);
    build(w, 'port', 8, 8);
    build(w, 'resort', 8, 11);
    computeRoadAccess(w);
    for (const y of [5, 8, 11]) expect(coastWorks(w, w.idx(8, y))).toBe(false);
    build(w, 'road', 10, 3, 10, 12);
    computeRoadAccess(w);
    for (const y of [5, 8, 11]) expect(coastWorks(w, w.idx(8, y))).toBe(true);
  });

  it('needs a street and light for every building of the coast, the promenade and the lighthouse included', () => {
    const w = lit(new World(shore()));
    build(w, 'promenade', 8, 5);
    build(w, 'lighthouse', 9, 8);
    computeRoadAccess(w); // no street at all
    expect(coastWorks(w, w.idx(8, 5))).toBe(false);
    expect(coastWorks(w, w.idx(9, 8))).toBe(false);
    build(w, 'road', 10, 3, 10, 12);
    computeRoadAccess(w);
    expect(coastWorks(w, w.idx(8, 5))).toBe(true);
    expect(coastWorks(w, w.idx(9, 8))).toBe(true);
    w.powered.fill(0); // a street but no light
    expect(coastWorks(w, w.idx(8, 5))).toBe(false);
    expect(coastWorks(w, w.idx(9, 8))).toBe(false);
  });

  it('is false for a lot with no coast building', () => {
    const w = streetWorld();
    expect(coastWorks(w, w.idx(20, 20))).toBe(false);
  });
});

describe('jobs of the coast buildings', () => {
  it('counts industrial jobs for the dock and the port, commercial for the resort, and none while they are idle', () => {
    const w = lit(new World(shore()));
    build(w, 'fishing', 8, 5);
    build(w, 'port', 8, 8);
    build(w, 'resort', 8, 11);
    computeRoadAccess(w);
    expect(cityTotals(w)).toEqual({ pop: 0, cJobs: 0, iJobs: 0 });
    build(w, 'road', 10, 3, 10, 12);
    computeRoadAccess(w);
    expect(cityTotals(w)).toEqual({ pop: 0, cJobs: COAST.resort.jobs, iJobs: COAST.fishing.jobs + COAST.port.jobs });
    expect([COAST.fishing.jobs, COAST.port.jobs, COAST.resort.jobs]).toEqual([12, 40, 30]);
  });

  it('gives no jobs for a promenade or a lighthouse', () => {
    const w = streetWorld();
    build(w, 'promenade', 8, 5, 8, 8);
    build(w, 'lighthouse', 9, 10);
    expect(cityTotals(w)).toEqual({ pop: 0, cJobs: 0, iJobs: 0 });
  });

  it('feeds the simulation totals, which a refresh keeps in step with the street', () => {
    const w = streetWorld();
    build(w, 'port', 8, 8);
    build(w, 'plant', 11, 8); // the light of the port
    const sim = new Simulation(w, newSimState(1), 'X');
    expect(sim.totals.iJobs).toBe(COAST.port.jobs);
    build(w, 'road', 8, 6, 8, 7); // does not matter: the lot already works
    sim.tick();
    expect(sim.totals.iJobs).toBe(COAST.port.jobs);
  });
});

describe('the budget of the coast', () => {
  const LINES = (b: ReturnType<typeof monthlyBudget>) => [b.coast, b.coastIncome];

  it('has the two new lines at zero in a city without coast buildings, and the rest as it was', () => {
    const w = streetWorld();
    const b = monthlyBudget(w, 7);
    expect(LINES(b)).toEqual([0, 0]);
    expect(b.expenses).toBe(b.roads + b.lines + b.parks + b.plants + b.services + b.schools + b.clinics + b.police + b.firefighters + b.loan);
    expect(b.income).toBe(b.taxR + b.taxC + b.taxI);
    expect(monthlyBudget(w, 7, undefined, null, 12)).toEqual(b);
  });

  it('charges the upkeep of every coast building, working or not, as the Costa expense', () => {
    const w = lit(new World(shore()));
    build(w, 'fishing', 8, 5);
    build(w, 'port', 8, 8);
    build(w, 'promenade', 8, 11, 8, 12);
    build(w, 'lighthouse', 9, 14);
    computeRoadAccess(w);
    const b = monthlyBudget(w, 7);
    const upkeep = COAST.fishing.upkeep + COAST.port.upkeep + 2 * COAST.promenade.upkeep + COAST.lighthouse.upkeep;
    expect(upkeep).toBe(30 + 200 + 4 + 60);
    expect(b.coast).toBe(upkeep);
    expect(b.expenses).toBe(b.roads + b.lines + b.parks + b.plants + b.services + b.schools + b.clinics + b.police + b.firefighters + b.loan + b.coast);
    expect(b.balance).toBe(b.income - b.expenses);
  });

  it('earns the fish sales of a working dock only', () => {
    const w = lit(new World(shore()));
    build(w, 'fishing', 8, 5);
    computeRoadAccess(w);
    expect(monthlyBudget(w, 7).coastIncome).toBe(0);
    build(w, 'road', 10, 3, 10, 12);
    computeRoadAccess(w);
    const b = monthlyBudget(w, 7);
    expect(b.coastIncome).toBe(FISHING_SALES);
    expect(b.income).toBe(b.taxR + b.taxC + b.taxI + b.coastIncome);
    expect(b.balance).toBe(b.income - b.expenses);
  });

  it('boosts the industrial taxes 15 % per working port, up to 45 %', () => {
    const industrial = (ports: number, withRoad = true): number => {
      const w = lit(new World(shore()));
      for (let k = 0; k < 6; k++) w.setTile(20 + k, 5, TILE.I, 5);
      if (withRoad) build(w, 'road', 10, 3, 10, 30);
      for (let k = 0; k < ports; k++) build(w, 'port', 8, 3 + 2 * k);
      computeRoadAccess(w);
      return monthlyBudget(w, 10).taxI;
    };
    const jobs = (ports: number) => 6 * 120 + ports * COAST.port.jobs;
    const expected = (ports: number) => Math.round(jobs(ports) * 10 * 0.075 * (1 + Math.min(0.45, 0.15 * ports)));
    expect(industrial(0)).toBe(Math.round(jobs(0) * 10 * 0.075));
    expect(industrial(1)).toBe(expected(1));
    expect(industrial(2)).toBe(expected(2));
    expect(industrial(3)).toBe(expected(3));
    // The fourth port brings its jobs but no more boost.
    expect(industrial(4)).toBe(Math.round(jobs(4) * 10 * 0.075 * 1.45));
    expect(industrial(1)).toBeGreaterThan(industrial(0));
    // A port with no street does nothing: no jobs and no boost.
    expect(industrial(2, false)).toBe(industrial(0));
  });

  it('earns tourism in the resort only while it works, by the season of the month asked', () => {
    const w = lit(new World(shore()));
    build(w, 'resort', 8, 5);
    computeRoadAccess(w);
    expect(monthlyBudget(w, 7, undefined, null, 1).coastIncome).toBe(0);
    build(w, 'road', 10, 3, 10, 12);
    computeRoadAccess(w);
    const income = (month?: number) => monthlyBudget(w, 7, undefined, null, month).coastIncome;
    for (const m of [12, 1, 2]) expect(income(m)).toBe(450);
    for (const m of [11, 3]) expect(income(m)).toBe(120);
    for (const m of [4, 5, 6, 7, 8, 9, 10]) expect(income(m)).toBe(20);
    // With no month: the average of the year, (3 x 450 + 2 x 120 + 7 x 20) / 12.
    expect(income()).toBe(Math.round((3 * 450 + 2 * 120 + 7 * 20) / 12));
    expect(income()).toBe(144);
    expect([TOURISM.peak, TOURISM.shoulder, TOURISM.low]).toEqual([450, 120, 20]);
  });

  it('knows the seasons of the southern hemisphere', () => {
    expect([12, 1, 2].map(seasonOf)).toEqual(['peak', 'peak', 'peak']);
    expect([11, 3].map(seasonOf)).toEqual(['shoulder', 'shoulder']);
    expect([4, 5, 6, 7, 8, 9, 10].map(seasonOf)).toEqual(Array(7).fill('low'));
    expect([12, 11, 7].map(tourismFor)).toEqual([450, 120, 20]);
  });

  it('adds the tourism of several resorts', () => {
    const w = lit(new World(shore()));
    build(w, 'road', 10, 3, 10, 12);
    build(w, 'resort', 8, 5);
    build(w, 'resort', 8, 8);
    computeRoadAccess(w);
    expect(monthlyBudget(w, 7, undefined, null, 1).coastIncome).toBe(900);
  });

  it('keeps the loan instalment line working beside the new ones', () => {
    const w = streetWorld();
    build(w, 'port', 8, 5);
    computeRoadAccess(w);
    const b = monthlyBudget(w, 7, undefined, { kind: 0, paid: 0 }, 6);
    expect(b.loan).toBeGreaterThan(0);
    expect(b.coast).toBe(COAST.port.upkeep);
  });
});

describe('the weekly money with a resort', () => {
  /** A static city (a street and a resort): nothing grows, so the season is the only thing that moves. */
  function resortCity(month: number): Simulation {
    const w = lit(new World(shore()));
    build(w, 'road', 10, 3, 10, 12);
    build(w, 'resort', 8, 5);
    build(w, 'plant', 11, 5); // the light of the resort
    const state = newSimState(1);
    state.tick = (month - 1) * TICKS_PER_MONTH;
    return new Simulation(w, state, 'X');
  }

  /** Cash after every tick of the month, from the first one. */
  function playMonth(sim: Simulation): { before: number; weekly: number[]; after: number } {
    const before = sim.state.cash;
    const weekly: number[] = [];
    for (let t = 1; t <= TICKS_PER_MONTH; t++) {
      sim.tick();
      if (t % TICKS_PER_WEEK === 0) weekly.push(sim.state.cash);
    }
    return { before, weekly, after: sim.state.cash };
  }

  it('adds the four weeks of a summer month up to its balance, tourism included', () => {
    const sim = resortCity(1);
    const { before, weekly, after } = playMonth(sim);
    const b = sim.state.lastBudget!;
    expect(b.coastIncome).toBe(450);
    expect(after - before).toBe(b.balance);
    expect(weekly).toHaveLength(4);
    expect(weekly[3]).toBe(after);
    // Every week collected something: the money did not wait for the end of the month.
    expect(weekly[0]).not.toBe(before);
  });

  it('adds the four weeks of a winter month up to its own, smaller balance', () => {
    const summer = resortCity(1);
    const winter = resortCity(7);
    const s = playMonth(summer);
    const w = playMonth(winter);
    expect(winter.state.lastBudget!.coastIncome).toBe(20);
    expect(w.after - w.before).toBe(winter.state.lastBudget!.balance);
    expect(summer.state.lastBudget!.balance - winter.state.lastBudget!.balance).toBe(450 - 20);
    expect(s.after - s.before).toBeGreaterThan(w.after - w.before);
  });

  it('settles the last week of a month with the season of the month that just ended', () => {
    // The tick has moved to the next month when the month closes: November (120) closes into December (450).
    const november = resortCity(11);
    playMonth(november);
    expect(november.state.lastBudget!.coastIncome).toBe(120);
    // February (450) closes into March (120).
    const february = resortCity(2);
    const f = playMonth(february);
    expect(february.state.lastBudget!.coastIncome).toBe(450);
    expect(f.after - f.before).toBe(february.state.lastBudget!.balance);
    // December closes into January: the year changes.
    const december = resortCity(12);
    const d = playMonth(december);
    expect(december.state.lastBudget!.coastIncome).toBe(450);
    expect(d.after - d.before).toBe(december.state.lastBudget!.balance);
  });

  it('collects the weeks of a month with the month in course (the first week of a changing month)', () => {
    // First week of December: 1/4 of December's balance, not November's.
    const sim = resortCity(12);
    const before = sim.state.cash;
    for (let t = 0; t < TICKS_PER_WEEK; t++) sim.tick();
    const december = monthlyBudget(sim.world, sim.state.taxes, sim.state.funding, sim.state.loan, 12).balance;
    expect(sim.state.cash - before).toBe(Math.round(december / 4));
  });

  it('opens a game saved in the middle of a month without paying its weeks again', () => {
    const sim = resortCity(1);
    const start = sim.state.cash;
    for (let t = 0; t < 2 * TICKS_PER_WEEK; t++) sim.tick();
    const back = deserialize(serialize({ name: 'X', seed: 1, world: sim.world, sim: sim.state }));
    const resumed = new Simulation(back.world, back.sim, 'X');
    for (let t = 0; t < 2 * TICKS_PER_WEEK; t++) resumed.tick();
    expect(resumed.state.lastBudget!.coastIncome).toBe(450);
    expect(resumed.state.cash - start).toBe(resumed.state.lastBudget!.balance);
  });
});

describe('smoke, land value and approval', () => {
  it('lets a working port smoke with strength 25 over a radius of 4, and an idle one not', () => {
    const w = streetWorld();
    build(w, 'port', 8, 5);
    computeRoadAccess(w);
    computePollution(w);
    expect(w.pollution[w.idx(8, 5)]).toBe(25);
    expect(w.pollution[w.idx(8, 9)]).toBe(5); // 4 lots away: the edge of the smoke
    expect(w.pollution[w.idx(8, 10)]).toBe(0);
    const idle = lit(new World(shore()));
    build(idle, 'port', 8, 5);
    computeRoadAccess(idle);
    computePollution(idle);
    expect(idle.pollution[idle.idx(8, 5)]).toBe(0);
  });

  const valueWith = (tool: ToolId, x: number, y: number, probe: [number, number]) => {
    const base = lit(new World(shore()));
    computeParks(base, 100);
    computeLandValue(base);
    const w = lit(new World(shore()));
    build(w, tool, x, y);
    computeParks(w, 100);
    computeLandValue(w);
    return w.landValue[w.idx(...probe)] - base.landValue[base.idx(...probe)];
  };
  /** The same measurement around a plaza patch of `cw`×`ch` cells, which is what counts. */
  const patchValue = (cw: number, ch: number, x: number, y: number, probe: [number, number]) => {
    const base = lit(new World(shore()));
    computeParks(base, 100);
    computeLandValue(base);
    const w = lit(new World(shore()));
    for (let k = 0; k < ch; k++) for (let j = 0; j < cw; j++) build(w, 'park', x + j, y + k);
    computeParks(w, 100);
    computeLandValue(w);
    return w.landValue[w.idx(...probe)] - base.landValue[base.idx(...probe)];
  };

  it('raises the land value like a plaza but stronger: 20 over a radius of 4 against 14', () => {
    expect(valueWith('promenade', 8, 5, [8, 5])).toBeGreaterThanOrEqual(19);
    expect(valueWith('promenade', 8, 5, [8, 5])).toBeLessThanOrEqual(21);
    // A plaza needs three cells to count at all, and then it gives 14 at its centre.
    expect(patchValue(1, 3, 8, 4, [8, 5])).toBeGreaterThanOrEqual(13);
    expect(patchValue(1, 3, 8, 4, [8, 5])).toBeLessThanOrEqual(15);
    expect(valueWith('park', 8, 5, [8, 5])).toBe(0);
    expect(valueWith('promenade', 8, 5, [8, 9])).toBeGreaterThan(0); // 4 lots away
    expect(valueWith('promenade', 8, 5, [8, 10])).toBe(0);
    expect(valueWith('promenade', 8, 5, [8, 7])).toBeGreaterThan(patchValue(1, 3, 8, 4, [8, 7]));
  });

  it('raises the land value around a lighthouse, 12 over a radius of 6', () => {
    const center = valueWith('lighthouse', 9, 5, [9, 5]);
    expect(center).toBeGreaterThanOrEqual(11);
    expect(center).toBeLessThanOrEqual(13);
    expect(valueWith('lighthouse', 9, 5, [9, 11])).toBeGreaterThan(0); // 6 lots away
    expect(valueWith('lighthouse', 9, 5, [9, 12])).toBe(0);
  });

  const calm: ApprovalInputs = { taxes: { R: 7, C: 7, I: 7 }, crisis: false, jammedShare: 0, abandoned: 0, pop: 0, jobs: 0, growth: 0 };
  const factor = (w: World, label: string) => computeApproval(w, calm).factors.find((f) => f.label === label);

  it('gives the Costanera factor 1 point per 8 promenade lots, up to 5', () => {
    const lots = (count: number) => {
      const w = lit(new World(shore()));
      for (let k = 0; k < count; k++) w.setTile(8 + (k % 3), Math.floor(k / 3), TILE.PROMENADE);
      return w;
    };
    expect(factor(lots(7), 'Costanera')).toBeUndefined();
    expect(factor(lots(8), 'Costanera')?.points).toBe(1);
    expect(factor(lots(16), 'Costanera')?.points).toBe(2);
    expect(factor(lots(47), 'Costanera')?.points).toBe(5);
    expect(factor(lots(48), 'Costanera')?.points).toBe(5);
    expect(computeApproval(lots(8), calm).target).toBe(51);
  });

  it('gives the Faro factor 3 points', () => {
    const w = lit(new World(shore()));
    expect(factor(w, 'Faro')).toBeUndefined();
    w.setTile(9, 5, TILE.LIGHTHOUSE);
    expect(factor(w, 'Faro')?.points).toBe(3);
    expect(computeApproval(w, calm).target).toBe(53);
  });

  it('leaves the approval of a city without coast as it was', () => {
    const w = lit(new World(shore()));
    expect(computeApproval(w, calm)).toEqual({ target: 50, factors: [] });
  });
});

describe('the streets to a working port', () => {
  function village(withPort: boolean, withStreet = true): World {
    const w = lit(new World(shore()));
    build(w, 'road', 10, 7, 20, 7);
    for (const x of [15, 16]) w.setTile(x, 6, TILE.R, 4);
    if (withPort) build(w, 'port', 8, withStreet ? 7 : 25);
    computeRoadAccess(w);
    return w;
  }

  it('is a place of work for the commuters: the street to it carries them', () => {
    const w = village(true);
    const report = computeCongestion(w);
    expect(report.trips).toBe(120);
    expect(w.traffic[w.idx(12, 7)]).toBeGreaterThan(0);
    expect(w.traffic[w.idx(19, 7)]).toBe(0); // away from the port, nobody passes
  });

  it('leaves a city with no jobs without trips, as before', () => {
    const w = village(false);
    expect(computeCongestion(w)).toEqual({ trips: 0, worst: 0, jammedShare: 0 });
  });

  it('is no destination when it has no street near', () => {
    const w = village(true, false);
    expect(computeCongestion(w)).toEqual({ trips: 0, worst: 0, jammedShare: 0 });
  });
});

describe('saving the coast', () => {
  const save = (w: World, sim = newSimState(1)) => JSON.parse(serialize({ name: 'X', seed: 1, world: w, sim }));

  it('writes the current format, which is 7 or later because 7 introduced the coast tiles', () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(7);
    expect(save(lit(new World(shore()))).version).toBe(SAVE_VERSION);
  });

  it('round-trips every coast tile', () => {
    const w = lit(new World(shore()));
    build(w, 'fishing', 8, 3);
    build(w, 'promenade', 8, 5, 8, 6);
    build(w, 'port', 8, 8);
    build(w, 'resort', 8, 10);
    build(w, 'lighthouse', 9, 13);
    const back = deserialize(JSON.stringify(save(w)));
    expect(Array.from(back.world.tiles)).toEqual(Array.from(w.tiles));
    expect(countCoast(back.world)).toEqual({ fishing: 1, promenade: 2, port: 1, resort: 1, lighthouse: 1 });
  });

  it('still opens the saves of formats 1 to 6', () => {
    for (let version = 1; version <= 6; version++) {
      const data = save(lit(new World(shore())));
      data.version = version;
      if (version < 6) delete data.mayor;
      if (version === 1) {
        delete data.abandoned;
        delete data.fire;
      }
      if (version < 3) delete data.inherited;
      if (version < 5) delete data.sim.loan;
      if (version < 4) {
        delete data.sim.milestone;
        delete data.sim.approval;
        delete data.sim.terms;
        delete data.sim.lostElection;
      }
      expect(() => deserialize(JSON.stringify(data))).not.toThrow();
    }
  });

  it('refuses a tile id past the lighthouse', () => {
    const data = save(lit(new World(shore())));
    const bytes = new Uint8Array(32 * 32);
    bytes[0] = MAX_TILE + 1;
    data.tiles = toBase64(bytes);
    expect(() => deserialize(JSON.stringify(data))).toThrow(/valores imposibles/);
  });

  it('keeps the coast lines of the last budget, and counts them as zero in an older one', () => {
    const w = streetWorld();
    build(w, 'port', 8, 5);
    computeRoadAccess(w);
    const sim = newSimState(1);
    sim.lastBudget = monthlyBudget(w, 7, undefined, null, 1);
    expect(sim.lastBudget.coast).toBe(COAST.port.upkeep);
    const data = save(w, sim);
    expect(deserialize(JSON.stringify(data)).sim.lastBudget).toEqual(sim.lastBudget);
    delete data.sim.lastBudget.coast;
    delete data.sim.lastBudget.coastIncome;
    const old = deserialize(JSON.stringify(data)).sim.lastBudget!;
    expect([old.coast, old.coastIncome]).toEqual([0, 0]);
  });
});

describe('undoing a coast building', () => {
  function act(w: World, h: UndoHistory, tool: ToolId, ax: number, ay: number, bx = ax, by = ay, tick = 0) {
    const p = plan(w, tool, ax, ay, bx, by);
    h.record(w, p, tick);
    applyPlan(w, p);
    return p;
  }

  it('gives back the lot, the tree and the whole price for each tool', () => {
    for (const [tool, x, y] of [
      ['fishing', 8, 5],
      ['port', 8, 6],
      ['resort', 8, 7],
      ['lighthouse', 9, 8],
    ] as [CoastKind, number, number][]) {
      const w = lit(new World(shore()));
      const h = new UndoHistory();
      w.terrain.trees[w.idx(x, y)] = 3;
      const p = act(w, h, tool, x, y);
      expect(w.tileAt(x, y)).toBe(coastTile(tool));
      const undone = h.undo(w, 10);
      expect(undone).toEqual({ tool, refund: COAST[tool].cost });
      expect(p.cost).toBe(COAST[tool].cost);
      expect(w.tileAt(x, y)).toBe(TILE.EMPTY);
      expect(w.terrain.trees[w.idx(x, y)]).toBe(3);
    }
  });

  it('undoes a dragged promenade as one action and lets the lighthouse be built again', () => {
    const w = lit(new World(shore()));
    const h = new UndoHistory();
    const p = act(w, h, 'promenade', 8, 3, 8, 6);
    expect(p.cells).toHaveLength(4);
    expect(h.undo(w, 10)?.refund).toBe(4 * COAST.promenade.cost);
    for (let y = 3; y <= 6; y++) expect(w.tileAt(8, y)).toBe(TILE.EMPTY);
    act(w, h, 'lighthouse', 9, 5);
    h.undo(w, 10);
    expect(plan(w, 'lighthouse', 9, 20).cells).toEqual([[9, 20]]);
  });
});

describe('the newspaper of the coast', () => {
  const base: CitySnapshot = {
    pop: 100,
    buildings: 10,
    plants: 1,
    shortage: false,
    crisis: false,
    taxes: { R: 7, C: 7, I: 7 },
    funding: { school: 100, clinic: 100, police: 100, fire: 100 },
    green: 100,
    grief: 0,
    month: 5,
    year: 1990,
    cash: 1000,
    abandoned: 0,
    loan: null,
    ports: 0,
    resorts: 0,
  };
  const text = (prev: CitySnapshot, next: CitySnapshot) => headlinesFor(prev, next, 'Villa Test').join(' | ');

  it('announces the first port, once', () => {
    expect(text(base, { ...base, ports: 1 })).toMatch(/puerto/i);
    expect(text({ ...base, ports: 1 }, { ...base, ports: 2 })).not.toMatch(/puerto/i);
    expect(text(base, base)).not.toMatch(/puerto/i);
  });

  it('announces the start of the season in December, only with a resort', () => {
    expect(text({ ...base, month: 11, resorts: 1 }, { ...base, month: 12, resorts: 1 })).toMatch(/temporada/i);
    expect(text({ ...base, month: 11 }, { ...base, month: 12 })).not.toMatch(/temporada/i);
    expect(text({ ...base, month: 5, resorts: 1 }, { ...base, month: 6, resorts: 1 })).not.toMatch(/temporada/i);
  });

  it('announces the low season in March, only with a resort', () => {
    expect(text({ ...base, month: 2, resorts: 1 }, { ...base, month: 3, resorts: 1 })).toMatch(/temporada/i);
    expect(text({ ...base, month: 2 }, { ...base, month: 3 })).not.toMatch(/temporada/i);
  });

  it('keeps the usual headlines apart', () => {
    expect(text(base, { ...base, pop: 600 })).not.toMatch(/puerto|temporada/i);
  });

  it('reaches the paper of a running city only when the paper is open', () => {
    // A city with no paper: a resort and the December start leave no headline in the news.
    const w = lit(new World(shore()));
    build(w, 'road', 10, 3, 10, 12);
    build(w, 'resort', 8, 5);
    const state = newSimState(1);
    state.tick = 10 * TICKS_PER_MONTH;
    const sim = new Simulation(w, state, 'X');
    for (let t = 0; t < TICKS_PER_MONTH; t++) sim.tick();
    expect(sim.state.news.map((n) => n.text).join(' ')).not.toMatch(/temporada/i);
  });
});

describe('the info card of the coast', () => {
  function city(): Simulation {
    const w = lit(new World(shore()));
    build(w, 'road', 10, 3, 10, 12);
    build(w, 'fishing', 8, 3);
    build(w, 'promenade', 8, 5);
    build(w, 'port', 8, 7);
    build(w, 'resort', 8, 9);
    build(w, 'lighthouse', 9, 13);
    build(w, 'port', 8, 28); // far from every street
    const sim = new Simulation(w, newSimState(1), 'X');
    w.powered.fill(1); // the card only reads the light: it is lit everywhere here
    return sim;
  }
  const card = (sim: Simulation, x: number, y: number) => {
    const r = describeCell(sim.world, sim, x, y);
    return `${r.title} | ${r.lines.join(' | ')} | ${r.hint ?? ''}`;
  };

  it('says what each building is, what it does and that it works', () => {
    const sim = city();
    expect(card(sim, 8, 3)).toMatch(/Muelle de pescadores.*12 puestos.*\$80/);
    expect(card(sim, 8, 5)).toMatch(/Costanera.*valor del suelo/i);
    expect(card(sim, 8, 7)).toMatch(/Puerto de carga.*40 puestos.*15 %/);
    expect(card(sim, 8, 9)).toMatch(/Balneario.*30 puestos/);
    expect(card(sim, 9, 13)).toMatch(/Faro.*3 puntos/i);
  });

  it('says why a building does not work', () => {
    const sim = city();
    const idle = card(sim, 8, 28);
    expect(idle).toMatch(/Puerto de carga/);
    expect(idle).toMatch(/Sin calle cerca: no funciona/);
    expect(idle).not.toMatch(/40 puestos/);
  });

  it('shows the season and the tourism income at the resort', () => {
    const sim = city();
    expect(card(sim, 8, 9)).toMatch(/Temporada alta.*\$450/); // January, the first month of the game
    sim.state.tick = 6 * TICKS_PER_MONTH;
    expect(card(sim, 8, 9)).toMatch(/Temporada baja.*\$20/);
    sim.state.tick = 2 * TICKS_PER_MONTH;
    expect(card(sim, 8, 9)).toMatch(/Entretemporada.*\$120/);
  });
});
