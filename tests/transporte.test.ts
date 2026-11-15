import { describe, expect, it } from 'vitest';
import { BUS_COLORS, MAX_BUS_NUMBER } from '../src/config';
import { deserialize, serialize } from '../src/save/save';
import { newSimState } from '../src/sim/simulation';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { UndoHistory } from '../src/world/history';
import { applyPlan, planTool } from '../src/world/tools';
import { busColorOf, busLineProblem, busNumberOf, busStations, freeBusNumber, packBusLine } from '../src/world/transport';
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
