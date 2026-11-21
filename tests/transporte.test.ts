import { describe, expect, it } from 'vitest';
import { BUS, BUS_COLORS, MAX_BUS_NUMBER, MAX_FUNDING } from '../src/config';
import { Traffic } from '../src/render/traffic';
import { deserialize, serialize } from '../src/save/save';
import { monthlyBudget } from '../src/sim/budget';
import { computeCongestion } from '../src/sim/congestion';
import { isUnlocked } from '../src/sim/milestones';
import { describeCell } from '../src/sim/report';
import { Simulation, newSimState } from '../src/sim/simulation';
import { applyTransit, transitBuses, transitFactor, transitUpkeep } from '../src/sim/transit';
import { toolPrice } from '../src/ui/toolbar';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { UndoHistory } from '../src/world/history';
import { applyPlan, busFootprint, footprintOfTool, groupOfTool, planTool, toolInfo } from '../src/world/tools';
import { busArea, busColorOf, busLineProblem, busNumberOf, busRefusal, busStations, depotAt, freeBusNumber, packBusLine } from '../src/world/transport';
import { TILE, World } from '../src/world/world';

function flat(n = 16): Terrain {
  const s = n + 1;
  return { n, corners: new Uint8Array(s * s).fill(SEA_LEVEL + 1), trees: new Uint8Array(n * n) };
}

/** A depot of the given colour and number, with (x, y) as its anchor corner. */
function depot(w: World, x: number, y: number, color: number, number: number): void {
  for (const [cx, cy] of busFootprint(w.n, x, y)) {
    w.setTile(cx, cy, TILE.BUS);
    w.busLine[w.idx(cx, cy)] = packBusLine(color, number);
  }
}

/** Tears a depot down cell by cell, for the tests that work on the grid without the tool. */
function clearDepot(w: World, x: number, y: number): void {
  for (const [cx, cy] of busFootprint(w.n, x, y)) w.setTile(cx, cy, TILE.EMPTY);
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
    clearDepot(w, 3, 3);
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
    // Bulldozing any cell of the depot takes the whole block: half a cochera is not a cochera.
    const plan = planTool(w, 'bulldoze', [[6, 6]]);
    expect(plan.cells).toEqual(busFootprint(w.n, 5, 5));
    history.record(w, plan, 0);
    applyPlan(w, plan);
    expect(w.tiles[w.idx(5, 5)]).toBe(TILE.EMPTY);
    expect(w.tiles[w.idx(6, 6)]).toBe(TILE.EMPTY);
    expect(busStations(w)).toEqual([]);
    history.undo(w, 0);
    expect(w.tiles[w.idx(5, 5)]).toBe(TILE.BUS);
    expect(w.tiles[w.idx(6, 6)]).toBe(TILE.BUS);
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
    expect(() => deserialize(withBuses([[a, packBusLine(3, 7)], [a + 1, packBusLine(3, 7)]]))).toThrow(/mismo número/);
  });
});

describe('the 2×2 depot', () => {
  it('is one station and one upkeep, whichever of its four cells you ask about', () => {
    const w = new World(flat());
    depot(w, 4, 4, 2, 12);
    expect(busStations(w)).toMatchObject([{ x: 4, y: 4, color: 2, number: 12 }]);
    for (const [x, y] of busFootprint(w.n, 4, 4)) expect(depotAt(w, x, y)).toEqual({ x: 4, y: 4, line: packBusLine(2, 12) });
    expect(depotAt(w, 6, 4)).toBeNull();
    expect(transitUpkeep(w)).toBe(BUS.upkeep);
  });

  it('announces the whole block in the preview, not the lot under the cursor', () => {
    expect(footprintOfTool('bus', 16, 4, 4)).toEqual(busFootprint(16, 4, 4));
  });

  it('refuses a block that would overlap another depot or hang off the map', () => {
    const w = new World(flat(16));
    applyPlan(w, planTool(w, 'bus', [[4, 4]]));
    expect(planTool(w, 'bus', [[5, 5]]).cells).toEqual([]);
    expect(planTool(w, 'bus', [[7, 4]]).cells).toEqual(busFootprint(16, 7, 4));
    // The last column cannot start a block that runs off the map: it clamps back inside.
    expect(planTool(w, 'bus', [[15, 8]]).cells).toEqual(busFootprint(16, 15, 8));
    expect(busFootprint(16, 15, 8)).toEqual([
      [14, 8],
      [15, 8],
      [14, 9],
      [15, 9],
    ]);
  });

  it('grows to its four cells when it is loaded from an older save', () => {
    const w = new World(flat());
    depot(w, 4, 4, 3, 7);
    const data = JSON.parse(serialize({ name: 'X', seed: 1, world: w, sim: newSimState(1) })) as Record<string, unknown>;
    expect((data.buses as unknown[]).length).toBe(1); // one entry per depot, at its anchor
    const back = deserialize(JSON.stringify(data)).world;
    for (const [x, y] of busFootprint(back.n, 4, 4)) expect(back.tiles[back.idx(x, y)]).toBe(TILE.BUS);
    expect(busStations(back)).toMatchObject([{ x: 4, y: 4, color: 3, number: 7 }]);
  });

  it('refuses a save whose depot has no ground left for its block', () => {
    const w = new World(flat());
    // The depot saved when a cochera was one lot wide, with the rest of its block now a street.
    for (const [x, y] of busFootprint(w.n, 4, 4)) w.setTile(x, y, TILE.ROAD);
    w.setTile(4, 4, TILE.BUS);
    w.busLine[w.idx(4, 4)] = packBusLine(3, 7);
    const broken = JSON.parse(serialize({ name: 'X', seed: 1, world: w, sim: newSimState(1) })) as Record<string, unknown>;
    broken.buses = [[w.idx(4, 4), packBusLine(3, 7)]];
    expect(() => deserialize(JSON.stringify(broken))).toThrow(/lugar/);
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
    // The depot is a block of four lots, charged once.
    expect(planTool(w, 'bus', [[4, 8]])).toMatchObject({ cells: busFootprint(16, 4, 8), cost: BUS.cost });
    expect(busRefusal(w, 4, 8)).toBeNull();
  });

  it('goes on any land, even far from a street (it only works with one), but not on a taken lot or on water', () => {
    const w = withStreet();
    expect(planTool(w, 'bus', [[4, 10]]).cells).toEqual(busFootprint(16, 4, 10));
    expect(busRefusal(w, 4, 10)).toBeNull();
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

/** The same load on every street cell of the map, for the tests that work on the load without a city. */
function loaded(w: World, perCell: number): Float32Array {
  const load = new Float32Array(w.n * w.n);
  for (let i = 0; i < load.length; i++) if (w.tiles[i] === TILE.ROAD) load[i] = perCell;
  return load;
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

  it('takes its commuters off the streets of its area, and only of those', () => {
    const w = commuterTown();
    computeCongestion(w);
    // Los puntos de control están fuera del rombo de `BUS.radius` medido desde el depósito (15, 8):
    // x=0 queda a 17 lotes y x=28 a 15, los dos más lejos que el alcance de la línea.
    const [outsideWest, middle, outsideEast] = [at(w, 0), at(w, 15), at(w, 28)];
    expect(middle).toBeGreaterThan(outsideWest); // the first towers' share has not joined the street yet
    depot(w, 15, 8, 0, 60); // two lots from the street, `BUS.radius` lots of reach
    computeCongestion(w);
    expect(at(w, 15)).toBeLessThan(middle);
    expect(at(w, 9)).toBeLessThan(middle); // inside the diamond
    expect(at(w, 0)).toBe(outsideWest); // outside it
    expect(at(w, 28)).toBe(outsideEast);
  });

  it('takes the same people off every street it serves, whatever that street is carrying', () => {
    const w = commuterTown();
    depot(w, 15, 8, 0, 60);
    const i = w.idx(15, 10);
    for (const perCell of [600, 900, 2000]) {
      const load = loaded(w, perCell);
      applyTransit(w, load, 100);
      // Cada celda baja exactamente los viajeros de la línea, no un porcentaje de lo que tenía.
      expect(load[i]).toBeCloseTo(perCell - BUS.trips, 5);
    }
    // Por eso el alivio relativo se cae cuando la calle carga más: 500 de 600 no es 500 de 2.000.
    const share = (perCell: number) => BUS.trips / perCell;
    expect(share(2000)).toBeLessThan(share(600));
  });

  it('adds up where lines overlap, and only a load smaller than the buses is taken whole', () => {
    const w = commuterTown();
    const streetsOf = (x: number, y: number) => busArea(w.n, x, y).filter(([cx, cy]) => w.tiles[w.idx(cx, cy)] === TILE.ROAD).length;
    depot(w, 15, 8, 0, 60);
    const one = loaded(w, 2000);
    expect(applyTransit(w, one, 100).taken).toBeCloseTo(BUS.trips * streetsOf(15, 8), 5);
    depot(w, 14, 8, 1, 61);
    const two = loaded(w, 2000);
    // Dos líneas se llevan los viajeros de las dos áreas: los mismos por celda, sumados.
    expect(applyTransit(w, two, 100).taken).toBeCloseTo(BUS.trips * (streetsOf(15, 8) + streetsOf(14, 8)), 5);
    // Una calle con menos carga que los colectivos se queda en cero, y la línea queda ociosa.
    const thin = loaded(w, 4);
    const result = applyTransit(w, thin, 100);
    expect(Math.min(...Array.from(thin))).toBe(0);
    expect(result.idle).toBeGreaterThan(result.taken);
  });

  it('five lines in the same area are five times the buses, not a jam that disappears', () => {
    const w = commuterTown();
    // Veinticuatro torres: la calle carga muy por encima de lo que llevan cinco líneas juntas.
    for (let x = 8; x < 20; x++) w.setTile(x, 9, TILE.R, 5);
    w.setTile(30, 9, TILE.I, 5);
    expect(computeCongestion(w).worst).toBeGreaterThan(100);
    for (const x of [12, 15, 18, 21, 24]) depot(w, x, 7, 0, 60 + x);
    expect(computeCongestion(w).worst).toBeGreaterThan(100);
  });

  it('do nothing when no street comes within reach of the depot', () => {
    const w = commuterTown();
    computeCongestion(w);
    const base = at(w, 15);
    depot(w, 15, 20, 0, 60); // ten lots from the street
    expect(applyTransit(w, loaded(w, 100), 100).taken).toBe(0);
    expect(applyTransit(w, loaded(w, 100), 100).idle).toBeCloseTo(BUS.trips, 5); // los colectivos quedan guardados
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

describe('the buses on the street', () => {
  /** A long street along y = 10 and, beside it, a depot of the given line. */
  function lineCity(): World {
    const w = new World(flat(48));
    road(w, 0, 10, 40, 10);
    depot(w, 20, 8, 3, 60);
    return w;
  }

  it('are as many as the line has, of its colour, and drive on streets of its area only', () => {
    const w = lineCity();
    const traffic = new Traffic(w, 7);
    traffic.refresh();
    traffic.update(0.1);
    const buses = traffic.cars.filter((c) => c.kind === 'bus');
    expect(buses).toHaveLength(BUS.buses);
    for (let step = 0; step < 400; step++) {
      traffic.update(0.25);
      for (const c of traffic.cars.filter((b) => b.kind === 'bus')) {
        expect(c.color).toBe(3);
        expect(w.tileAt(c.x, c.y)).toBe(TILE.ROAD);
        expect(Math.abs(c.x - 20) + Math.abs(c.y - 8)).toBeLessThanOrEqual(BUS.radius);
      }
    }
    expect(traffic.cars.filter((c) => c.kind === 'bus')).toHaveLength(BUS.buses);
  });

  it('leave with their depot, and there is no bus without a line', () => {
    const w = lineCity();
    const traffic = new Traffic(w, 7);
    traffic.refresh();
    for (let step = 0; step < 50; step++) traffic.update(0.25);
    clearDepot(w, 20, 8);
    traffic.refresh();
    traffic.update(0.1);
    expect(traffic.cars.filter((c) => c.kind === 'bus')).toHaveLength(0);
    // With houses along the street there is traffic, and none of its cars is a bus: only lines have buses.
    for (let x = 2; x < 38; x++) w.setTile(x, 9, TILE.R, 4);
    traffic.refresh();
    for (let step = 0; step < 200; step++) traffic.update(0.25);
    expect(traffic.cars.length).toBeGreaterThan(0);
    expect(traffic.cars.some((c) => c.kind === 'bus')).toBe(false);
  });

  it('take the colour of the line of each depot', () => {
    const w = lineCity();
    depot(w, 8, 8, 7, 61);
    const traffic = new Traffic(w, 3);
    traffic.refresh();
    traffic.update(0.1);
    const byColor = (color: number) => traffic.cars.filter((c) => c.kind === 'bus' && c.color === color).length;
    expect(byColor(3)).toBe(BUS.buses);
    expect(byColor(7)).toBe(BUS.buses);
  });
});

describe('the card of a bus depot', () => {
  it('names the line, says what it does, and warns when no street is in reach', () => {
    const w = new World(flat(16));
    road(w, 0, 5, 15, 5);
    depot(w, 4, 7, 1, 148);
    const sim = new Simulation(w, newSimState(1), 'X');
    sim.refresh();
    const ok = describeCell(w, sim, 4, 7);
    expect(ok.title).toBe('Línea 148 (azul)');
    expect(ok.lines.join(' ')).toContain(`Cubre ${BUS.radius} lotes`);
    expect(ok.lines.join(' ')).toMatch(/\$90 por mes/);
    expect(ok.hint).toBeUndefined();

    depot(w, 12, 13, 0, 7);
    const lost = describeCell(w, sim, 12, 13);
    expect(lost.title).toBe('Línea 7 (rojo)');
    expect(lost.lines.join(' ')).toMatch(/no funciona/);
    expect(lost.hint).toMatch(/calle/);
  });
});

describe('the budget for transport', () => {
  const at = (w: World, x: number) => w.traffic[w.idx(x, 10)];

  it('sets the frequency: all of what a line does at 100 %, half at 50 %, nothing at 0 %, a bit more at 120 %', () => {
    expect(transitFactor(100)).toBe(1);
    expect(transitFactor(50)).toBe(0.5);
    expect(transitFactor(0)).toBe(0);
    expect(transitFactor(500)).toBe(MAX_FUNDING / 100); // there is a ceiling
    const w = commuterTown();
    depot(w, 15, 8, 0, 60);
    // La tripulación de una línea: siete celdas de calle en su área por los viajeros de cada una.
    const perCell = (funding: number) => {
      const base = 900;
      const load = loaded(w, base);
      applyTransit(w, load, funding);
      return base - load[w.idx(15, 10)];
    };
    expect(perCell(100)).toBeCloseTo(BUS.trips, 5);
    expect(perCell(50)).toBeCloseTo(BUS.trips / 2, 5);
    expect(perCell(0)).toBe(0);
    expect(perCell(120)).toBeGreaterThan(perCell(100));
  });

  it('leaves more traffic on the street the less is spent', () => {
    const w = commuterTown();
    depot(w, 15, 8, 0, 60);
    computeCongestion(w, 100);
    const full = at(w, 15);
    computeCongestion(w, 50);
    const half = at(w, 15);
    computeCongestion(w, 0);
    const none = at(w, 15);
    expect(full).toBeLessThan(half);
    expect(half).toBeLessThan(none);
    // Y más presupuesto es más viajeros: cinco líneas al 120 % se llevan más que cinco al 100 %.
    for (const d of [[16, 8], [17, 8], [14, 8], [13, 8]] as const) depot(w, d[0], d[1], 0, 70 + d[0]);
    const five = applyTransit(w, loaded(w, 9000), 120).taken;
    expect(five).toBeGreaterThan(5 * BUS.trips);
  });

  it('costs the same share of the upkeep', () => {
    const w = commuterTown();
    depot(w, 15, 8, 0, 60);
    depot(w, 14, 8, 1, 61);
    const cost = (funding: number) => monthlyBudget(w, 7, undefined, null, undefined, 100, 1, funding).transport;
    expect(cost(100)).toBe(2 * BUS.upkeep);
    expect(cost(50)).toBe(BUS.upkeep);
    expect(cost(0)).toBe(0);
    expect(transitUpkeep(w, 120)).toBe(Math.round(2 * BUS.upkeep * 1.2));
  });

  it('sends more buses to the street the more is spent, and none at the bottom', () => {
    expect(transitBuses(100)).toBe(BUS.buses);
    expect(transitBuses(120)).toBeGreaterThan(transitBuses(100));
    expect(transitBuses(50)).toBeLessThan(transitBuses(100));
    expect(transitBuses(0)).toBe(0);
  });

  it('is set in the simulation, kept inside its limits, and takes effect at once', () => {
    const w = commuterTown();
    depot(w, 15, 8, 0, 60);
    const sim = new Simulation(w, newSimState(1), 'X');
    sim.refresh();
    expect(sim.state.transport).toBe(100);
    const full = at(w, 15);
    sim.setTransport(40);
    expect(sim.state.transport).toBe(40);
    expect(at(w, 15)).toBeGreaterThan(full);
    sim.setTransport(900);
    expect(sim.state.transport).toBe(MAX_FUNDING);
    sim.setTransport(-5);
    expect(sim.state.transport).toBe(0);
  });

  it('is saved with the game, an older save runs at 100 %, and an impossible value is refused', () => {
    const w = new World(flat());
    const sim = new Simulation(w, newSimState(1), 'X');
    sim.setTransport(65);
    const text = serialize({ name: 'X', seed: 1, world: w, sim: sim.state });
    expect(deserialize(text).sim.transport).toBe(65);
    const old = JSON.parse(text);
    delete old.sim.transport;
    expect(deserialize(JSON.stringify(old)).sim.transport).toBe(100);
    old.sim.transport = MAX_FUNDING + 1;
    expect(() => deserialize(JSON.stringify(old))).toThrow(/transporte/);
  });
});

describe('the frequency on the street and on the card', () => {
  function lineCity(): World {
    const w = new World(flat(48));
    road(w, 0, 10, 40, 10);
    depot(w, 20, 8, 3, 60);
    return w;
  }

  it('is the number of buses of each line: fewer when the budget falls, more when it grows, none at zero', () => {
    const w = lineCity();
    const traffic = new Traffic(w, 7);
    const buses = () => traffic.cars.filter((c) => c.kind === 'bus').length;
    for (const funding of [100, 60, 0, 120, 100]) {
      traffic.busesPerLine = transitBuses(funding);
      traffic.refresh();
      traffic.update(0.1);
      expect(buses()).toBe(transitBuses(funding));
    }
  });

  it('tells on the card what the line does at the budget it has', () => {
    const w = new World(flat(16));
    road(w, 0, 5, 15, 5);
    depot(w, 4, 7, 1, 148);
    const sim = new Simulation(w, newSimState(1), 'X');
    sim.refresh();
    // La ficha dice viajeros, no porcentajes, porque es lo que la línea hace.
    expect(describeCell(w, sim, 4, 7).lines.join(' ')).toMatch(/se llevan 500 viajeros.*Presupuesto de transporte: 100 %.*\$90 por mes/);
    sim.setTransport(50);
    const half = describeCell(w, sim, 4, 7).lines.join(' ');
    expect(half).toMatch(/se llevan 250 viajeros/);
    expect(half).toMatch(/50 % \(pasan menos colectivos\)/);
    expect(half).toMatch(/\$45 por mes/);
  });
});
