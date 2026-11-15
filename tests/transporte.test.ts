import { describe, expect, it } from 'vitest';
import { BUS, BUS_COLORS, MAX_BUS_NUMBER } from '../src/config';
import { deserialize, serialize } from '../src/save/save';
import { monthlyBudget } from '../src/sim/budget';
import { computeCongestion } from '../src/sim/congestion';
import { isUnlocked } from '../src/sim/milestones';
import { newSimState } from '../src/sim/simulation';
import { transitRelief } from '../src/sim/transit';
import { toolPrice } from '../src/ui/toolbar';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { UndoHistory } from '../src/world/history';
import { applyPlan, groupOfTool, planTool, toolInfo } from '../src/world/tools';
import { busArea, busColorOf, busLineProblem, busNumberOf, busRefusal, busStations, freeBusNumber, packBusLine } from '../src/world/transport';
import { TILE, World } from '../src/world/world';

function flat(n = 16): Terrain {
  const s = n + 1;
  return { n, corners: new Uint8Array(s * s).fill(SEA_LEVEL + 1), trees: new Uint8Array(n * n) };
}

/** A depot of the given colour and number at (x, y). */
function depot(w: World, x: number, y: number, color: number, number: number): void {
  w.setTile(x, y, TILE.BUS);
  w.busLine[w.idx(x, y)] = packBusLine(color, number);
}

describe('a bus line in a cell', () => {
  it('keeps its colour and its number, whichever they are', () => {
    for (let color = 0; color < BUS_COLORS.length; color++) {
      for (const number of [1, 7, 148, MAX_BUS_NUMBER]) {
        const line = packBusLine(color, number);
        expect(busColorOf(line)).toBe(color);
        expect(busNumberOf(line)).toBe(number);
        expect(line).toBeGreaterThan(0);
      }
    }
  });

  it('has ten colours, all different', () => {
    expect(BUS_COLORS).toHaveLength(10);
    expect(new Set(BUS_COLORS.map((c) => c.hex)).size).toBe(10);
    expect(new Set(BUS_COLORS.map((c) => c.name)).size).toBe(10);
  });

  it('is lost with the depot: demolishing frees the number', () => {
    const w = new World(flat());
    depot(w, 3, 3, 2, 60);
    expect(busStations(w).map((s) => s.number)).toEqual([60]);
    w.setTile(3, 3, TILE.EMPTY);
    expect(busStations(w)).toEqual([]);
    expect(w.busLine[w.idx(3, 3)]).toBe(0);
  });
});

describe('the number of a line', () => {
  it('goes from 1 to 999 and cannot be repeated', () => {
    const w = new World(flat());
    depot(w, 2, 2, 0, 60);
    expect(busLineProblem(w, packBusLine(1, 61))).toBeNull();
    expect(busLineProblem(w, packBusLine(1, 999))).toBeNull();
    expect(busLineProblem(w, packBusLine(1, 0))).toMatch(/1 a 999/);
    expect(busLineProblem(w, packBusLine(1, 1000))).toMatch(/1 a 999/);
    expect(busLineProblem(w, packBusLine(1, 60))).toMatch(/Ya hay una línea 60/);
    // The colour may repeat; the depot itself does not count against its own number.
    expect(busLineProblem(w, packBusLine(0, 60), w.idx(2, 2))).toBeNull();
    expect(busLineProblem(w, packBusLine(BUS_COLORS.length, 5))).toMatch(/color/);
  });

  it('proposes the lowest one that is free', () => {
    const w = new World(flat());
    expect(freeBusNumber(w)).toBe(1);
    depot(w, 1, 1, 0, 1);
    depot(w, 2, 1, 0, 2);
    depot(w, 3, 1, 0, 4);
    expect(freeBusNumber(w)).toBe(3);
  });
});

describe('undoing a demolition', () => {
  it('brings the depot back with its colour and its number', () => {
    const w = new World(flat());
    depot(w, 5, 5, 6, 148);
    const history = new UndoHistory();
    const plan = planTool(w, 'bulldoze', [[5, 5]]);
    expect(plan.cells).toEqual([[5, 5]]);
    history.record(w, plan, 0);
    applyPlan(w, plan);
    expect(w.tiles[w.idx(5, 5)]).toBe(TILE.EMPTY);
    history.undo(w, 0);
    expect(w.tiles[w.idx(5, 5)]).toBe(TILE.BUS);
    expect(busStations(w)).toMatchObject([{ color: 6, number: 148 }]);
  });
});

describe('saving the lines', () => {
  const saved = (w: World) => JSON.parse(serialize({ name: 'X', seed: 1, world: w, sim: newSimState(1) })) as Record<string, unknown>;

  it('round-trips every depot with its colour and number', () => {
    const w = new World(flat());
    depot(w, 4, 4, 3, 7);
    depot(w, 9, 2, 9, 999);
    const back = deserialize(JSON.stringify(saved(w))).world;
    expect(busStations(back).map((s) => [s.x, s.y, s.color, s.number])).toEqual([
      [9, 2, 9, 999],
      [4, 4, 3, 7],
    ]);
  });

  it('refuses a number repeated, a number out of range and a line off its depot', () => {
    const w = new World(flat());
    depot(w, 4, 4, 3, 7);
    depot(w, 9, 2, 1, 8);
    const [a, b] = [w.idx(4, 4), w.idx(9, 2)];
    const withBuses = (buses: unknown) => JSON.stringify({ ...saved(w), buses });
    expect(() => deserialize(withBuses([[a, packBusLine(3, 7)], [b, packBusLine(1, 7)]]))).toThrow(/repetida/);
    expect(() => deserialize(withBuses([[a, packBusLine(3, 7)], [b, packBusLine(1, 1000)]]))).toThrow(/inválida/);
    expect(() => deserialize(withBuses([[a, packBusLine(3, 7)], [b, packBusLine(1, 8)], [w.idx(0, 0), 5]]))).toThrow(/cochera/);
    expect(() => deserialize(withBuses([[a, packBusLine(3, 7)]]))).toThrow(/no coinciden/);
  });
});

describe('placing a bus line', () => {
  /** A street along the row y = 5 and, besides it, free land. */
  function withStreet(): World {
    const w = new World(flat());
    for (let x = 0; x < 16; x++) w.setTile(x, 5, TILE.ROAD);
    return w;
  }

  it('is a one-lot tool of its own category, paid at the price of a line, and open from the first big city', () => {
    expect(toolInfo('bus').shape).toBe('point');
    expect(groupOfTool('bus').label).toBe('Transportes');
    expect(toolPrice('bus')).toBe(BUS.cost);
    expect(isUnlocked('bus', 2)).toBe(false);
    expect(isUnlocked('bus', 3)).toBe(true);
  });

  it('goes on a free lot with a street within three lots, and costs what a line costs', () => {
    const w = withStreet();
    expect(planTool(w, 'bus', [[4, 8]])).toMatchObject({ cells: [[4, 8]], cost: BUS.cost });
    expect(busRefusal(w, 4, 8)).toBeNull();
  });

  it('is refused far from a street, on a taken lot and on water, with a reason when the place is the problem', () => {
    const w = withStreet();
    expect(planTool(w, 'bus', [[4, 10]]).cells).toEqual([]);
    expect(busRefusal(w, 4, 10)).toMatch(/3 lotes o menos de una calle/);
    expect(planTool(w, 'bus', [[4, 5]]).cells).toEqual([]);
    const lake = new World({ n: 16, corners: new Uint8Array(17 * 17).fill(SEA_LEVEL - 1), trees: new Uint8Array(256) });
    expect(planTool(lake, 'bus', [[4, 4]]).cells).toEqual([]);
    expect(busRefusal(lake, 4, 4)).toMatch(/en tierra/);
  });

  it('builds the depot with the line it was given, or with a free number when none is given', () => {
    const w = withStreet();
    const plan = planTool(w, 'bus', [[4, 7]]);
    applyPlan(w, { ...plan, line: packBusLine(5, 148) });
    expect(busStations(w)).toMatchObject([{ x: 4, y: 7, color: 5, number: 148 }]);
    applyPlan(w, planTool(w, 'bus', [[8, 7]]));
    expect(busStations(w).map((s) => s.number)).toEqual([148, 1]);
  });

  it('covers a diamond of lots around it, inside the map', () => {
    const area = busArea(16, 0, 0);
    expect(area).toContainEqual([0, 0]);
    expect(area).toContainEqual([BUS.radius, 0]);
    expect(area).not.toContainEqual([BUS.radius, 1]);
    expect(area.every(([x, y]) => x >= 0 && y >= 0 && x < 16 && y < 16)).toBe(true);
  });
});

function road(w: World, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) w.setTile(x, y, TILE.ROAD);
}

/** Eight towers at the west end of a street along y = 10 and a factory at its east end: a saturated street. */
function commuterTown(): World {
  const w = new World(flat(48));
  road(w, 0, 10, 30, 10);
  for (let x = 0; x < 8; x++) w.setTile(x, 9, TILE.R, 5);
  w.setTile(30, 9, TILE.I, 2);
  return w;
}

describe('what the bus lines do for the traffic', () => {
  const at = (w: World, x: number) => w.traffic[w.idx(x, 10)];

  it('take a share of the load off the streets of their area, and only of those', () => {
    const w = commuterTown();
    computeCongestion(w);
    const [outsideWest, middle, outsideEast] = [at(w, 5), at(w, 15), at(w, 28)];
    expect(middle).toBeGreaterThan(outsideWest); // the first towers' share has not joined the street yet
    depot(w, 15, 8, 0, 60); // two lots from the street, nine lots of reach
    computeCongestion(w);
    expect(Math.abs(at(w, 15) - middle * (1 - BUS.relief))).toBeLessThanOrEqual(1); // the percentages are rounded
    expect(at(w, 9)).toBeLessThan(middle); // inside the diamond
    expect(at(w, 5)).toBe(outsideWest); // outside it
    expect(at(w, 28)).toBe(outsideEast);
  });

  it('add up where lines overlap, but never take more than the cap', () => {
    const w = commuterTown();
    computeCongestion(w);
    const base = at(w, 15);
    depot(w, 15, 8, 0, 60);
    depot(w, 14, 8, 1, 61);
    expect(transitRelief(w)[w.idx(15, 10)]).toBeCloseTo(1 - (1 - BUS.relief) ** 2, 5);
    depot(w, 16, 8, 2, 62);
    depot(w, 17, 8, 3, 63);
    expect(transitRelief(w)[w.idx(15, 10)]).toBeCloseTo(BUS.maxRelief, 5);
    computeCongestion(w);
    expect(Math.abs(at(w, 15) - base * (1 - BUS.maxRelief))).toBeLessThanOrEqual(1);
  });

  it('do nothing when no street comes within reach of the depot', () => {
    const w = commuterTown();
    computeCongestion(w);
    const base = at(w, 15);
    depot(w, 15, 20, 0, 60); // ten lots from the street
    expect(transitRelief(w).every((r) => r === 0)).toBe(true);
    computeCongestion(w);
    expect(at(w, 15)).toBe(base);
  });

  it('can bring a saturated street under its capacity, so the street does not have to be widened', () => {
    const w = commuterTown();
    expect(computeCongestion(w).worst).toBeGreaterThan(100);
    depot(w, 12, 8, 0, 60); // covers the street from x = 5 to 19
    depot(w, 26, 8, 1, 61); // and from x = 19 to the end
    expect(computeCongestion(w).worst).toBeLessThan(100);
  });

  it('cost their upkeep each month, in a line of the budget of their own', () => {
    const w = commuterTown();
    const none = monthlyBudget(w, 7);
    depot(w, 15, 8, 0, 60);
    depot(w, 14, 8, 1, 61);
    const two = monthlyBudget(w, 7);
    expect(none.transport).toBe(0);
    expect(two.transport).toBe(2 * BUS.upkeep);
    expect(two.expenses - none.expenses).toBe(2 * BUS.upkeep);
  });
});
