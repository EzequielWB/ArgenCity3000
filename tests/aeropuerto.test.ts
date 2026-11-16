import { describe, expect, it } from 'vitest';
import { HUB_LEVELS, HUBS } from '../src/config';
import { deserialize, serialize } from '../src/save/save';
import { isUnlocked } from '../src/sim/milestones';
import { monthlyBudget } from '../src/sim/budget';
import { cityTotals } from '../src/sim/demand';
import { computeLandValue } from '../src/sim/fields';
import { hubIncome, hubJobs, hubUpkeep } from '../src/sim/hubs';
import { computePower } from '../src/sim/power';
import { describeCell } from '../src/sim/report';
import { Simulation, newSimState } from '../src/sim/simulation';
import { toolPrice } from '../src/ui/toolbar';
import { UndoHistory } from '../src/world/history';
import { facilityAt, hubFacilities, hubFootprint, hubLevel, hubRefusal } from '../src/world/hubs';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { applyPlan, footprintOfTool, groupOfTool, planTool, toolInfo, type ToolId } from '../src/world/tools';
import { TILE, World } from '../src/world/world';

/** Land everywhere, except water from x = 20 on. */
function shore(n = 32): Terrain {
  const s = n + 1;
  const corners = new Uint8Array(s * s).fill(SEA_LEVEL + 1);
  for (let y = 0; y < s; y++) for (let x = 20; x < s; x++) corners[y * s + x] = SEA_LEVEL - 1;
  return { n, corners, trees: new Uint8Array(n * n) };
}

/** A street along y = 10, from x = 0 to x = 19. */
function city(): World {
  const w = new World(shore());
  w.powered.fill(1); // lit everywhere: the light is tested on its own below
  for (let x = 0; x < 20; x++) w.setTile(x, 10, TILE.ROAD);
  return w;
}

const put = (w: World, tool: ToolId, x: number, y: number) => {
  const plan = planTool(w, tool, [[x, y]]);
  applyPlan(w, plan);
  return plan;
};

describe('the airport and the harbour as tools', () => {
  it('are one-piece tools of the Transportes category, with a price and a milestone', () => {
    for (const tool of ['airport', 'harbor'] as const) {
      expect(toolInfo(tool).shape).toBe('anchor');
      expect(groupOfTool(tool).label).toBe('Transportes');
      expect(toolPrice(tool)).toBe(HUBS[tool].cost);
    }
    expect(isUnlocked('harbor', 3)).toBe(false);
    expect(isUnlocked('harbor', 4)).toBe(true);
    expect(isUnlocked('airport', 4)).toBe(false);
    expect(isUnlocked('airport', 5)).toBe(true);
  });

  it('cover 3×2 and 2×2 lots, always the same way round, kept inside the map', () => {
    expect(hubFootprint('airport', 32, 5, 5)).toHaveLength(6);
    expect(hubFootprint('harbor', 32, 5, 5)).toHaveLength(4);
    const cells = hubFootprint('airport', 32, 5, 5);
    expect(new Set(cells.map(([x]) => x)).size).toBe(3);
    expect(new Set(cells.map(([, y]) => y)).size).toBe(2);
    expect(hubFootprint('airport', 32, 31, 31).every(([x, y]) => x < 32 && y < 32)).toBe(true);
    expect(footprintOfTool('airport', 32, 5, 5)).toEqual(cells);
    expect(footprintOfTool('road', 32, 5, 5)).toBeNull();
  });
});

describe('placing a piece', () => {
  it('takes the whole footprint of free land with a street within three lots', () => {
    const w = city();
    const plan = planTool(w, 'airport', [[5, 12]]);
    expect(plan.cells).toHaveLength(6);
    expect(plan.cost).toBe(HUBS.airport.cost);
    applyPlan(w, plan);
    expect(plan.cells.every(([x, y]) => w.tileAt(x, y) === TILE.AIRPORT)).toBe(true);
    expect(w.hubs).toEqual([{ x: 5, y: 12, kind: 'airport' }]);
    expect(w.hubAt(7, 13)).toBe(w.hubs[0]);
    expect(w.hubAt(8, 13)).toBeUndefined();
  });

  it('goes anywhere on land, even far from a street, but is refused over a taken lot, on water and, for a harbour, away from the water', () => {
    const w = city();
    expect(planTool(w, 'airport', [[5, 20]]).cells).toHaveLength(6); // no street near: it can be built
    expect(hubRefusal(w, 'airport', hubFootprint('airport', 32, 5, 20))).toBeNull();
    expect(planTool(w, 'airport', [[5, 9]]).cells).toEqual([]); // over the street
    put(w, 'airport', 5, 12);
    expect(planTool(w, 'airport', [[6, 12]]).cells).toEqual([]); // over a piece
    expect(planTool(w, 'harbor', [[10, 12]]).cells).toEqual([]); // inland
    expect(hubRefusal(w, 'harbor', hubFootprint('harbor', 32, 10, 12))).toMatch(/agua/);
    expect(planTool(w, 'airport', [[18, 12]]).cells).toEqual([]); // half in the water
    expect(hubRefusal(w, 'airport', hubFootprint('airport', 32, 18, 12))).toMatch(/en tierra/);
  });

  it('puts a harbour on the shore, with the street near', () => {
    const w = city();
    const plan = planTool(w, 'harbor', [[17, 12]]); // x = 17..18, the water starts at x = 19
    expect(plan.cells).toHaveLength(4);
    expect(plan.cost).toBe(HUBS.harbor.cost);
  });
});

describe('a piece far from any street', () => {
  it('stands there but does not work, and starts to work when a street comes within reach', () => {
    const w = city();
    put(w, 'airport', 5, 20);
    expect(w.hubs).toHaveLength(1);
    expect(hubFacilities(w)[0].works).toBe(false);
    expect(hubJobs(w)).toBe(0);
    for (let x = 0; x < 12; x++) w.setTile(x, 19, TILE.ROAD);
    expect(hubFacilities(w)[0].works).toBe(true);
    expect(hubJobs(w)).toBe(HUBS.airport.jobs[0]);
  });

  it('lets the second piece go where the first one was far from the street, and the facility works if any piece has one', () => {
    const w = city();
    put(w, 'airport', 2, 14); // too far from the street at y = 10
    put(w, 'airport', 2, 12); // close enough, and touching the first
    expect(hubFacilities(w)).toHaveLength(1);
    expect(hubFacilities(w)[0].works).toBe(true);
    expect(hubFacilities(w)[0].level).toBe(2);
  });
});

describe('tearing a piece down', () => {
  it('takes the whole piece with one lot of it, and leaves the others', () => {
    const w = city();
    put(w, 'airport', 2, 12);
    put(w, 'airport', 10, 12);
    const plan = planTool(w, 'bulldoze', [[3, 12]]);
    expect(plan.cells).toHaveLength(6);
    applyPlan(w, plan);
    expect(w.hubs).toEqual([{ x: 10, y: 12, kind: 'airport' }]);
    expect(w.tileAt(2, 12)).toBe(TILE.EMPTY);
    expect(w.tileAt(10, 12)).toBe(TILE.AIRPORT);
  });

  it('is undone with the piece, as it was', () => {
    const w = city();
    put(w, 'harbor', 17, 12);
    const history = new UndoHistory();
    const plan = planTool(w, 'bulldoze', [[18, 13]]);
    history.record(w, plan, 0);
    applyPlan(w, plan);
    expect(w.hubs).toEqual([]);
    history.undo(w, 0);
    expect(w.hubs).toEqual([{ x: 17, y: 12, kind: 'harbor' }]);
    expect(w.tileAt(18, 13)).toBe(TILE.HARBOR);
  });
});

describe('pieces side by side', () => {
  it('are one facility, and its level is how many pieces it has', () => {
    for (const kind of ['airport', 'harbor'] as const) {
      const need = HUB_LEVELS[kind];
      expect(hubLevel(kind, 1)).toBe(1);
      expect(hubLevel(kind, need[1])).toBe(2);
      expect(hubLevel(kind, need[2])).toBe(3);
      expect(hubLevel(kind, need[2] + 5)).toBe(3);
    }
    expect(hubLevel('airport', 3)).toBe(2); // two or three pieces are still an aerodrome
    expect(hubLevel('airport', 4)).toBe(3);
  });

  it('count only the ones that share an edge, of the same kind', () => {
    const w = city();
    put(w, 'airport', 2, 11);
    put(w, 'airport', 5, 11); // touches the first on the side
    put(w, 'airport', 5, 13); // touches the second below
    put(w, 'airport', 10, 11); // alone
    put(w, 'harbor', 17, 12);
    const facilities = hubFacilities(w);
    expect(facilities).toHaveLength(3);
    const big = facilities.find((f) => f.kind === 'airport' && f.pieces.length === 3)!;
    expect(big.level).toBe(2);
    expect(facilityAt(w, 4, 12)).toEqual(big);
    expect(facilityAt(w, 10, 11)!.level).toBe(1);
    expect(facilityAt(w, 17, 12)!.kind).toBe('harbor');
    expect(facilityAt(w, 0, 0)).toBeUndefined();
  });

  it('do not join when they only touch at a corner', () => {
    const w = city();
    put(w, 'airport', 2, 11);
    put(w, 'airport', 5, 13); // corner to corner
    expect(hubFacilities(w)).toHaveLength(2);
  });

  it('work only with a street near', () => {
    const w = city();
    put(w, 'airport', 2, 12);
    expect(hubFacilities(w)[0].works).toBe(true);
    for (let x = 0; x < 20; x++) w.setTile(x, 10, TILE.EMPTY);
    expect(hubFacilities(w)[0].works).toBe(false);
  });
});

describe('what a facility gives the city', () => {
  it('gives the jobs and the income of its level, and counts the jobs as commerce', () => {
    const w = city();
    put(w, 'airport', 2, 11);
    expect(hubJobs(w)).toBe(HUBS.airport.jobs[0]);
    expect(hubIncome(w)).toBe(HUBS.airport.income[0]);
    expect(cityTotals(w).cJobs).toBe(HUBS.airport.jobs[0]);
    put(w, 'airport', 5, 11); // two pieces: an aerodrome
    expect(hubJobs(w)).toBe(HUBS.airport.jobs[1]);
    expect(hubIncome(w)).toBe(HUBS.airport.income[1]);
    put(w, 'airport', 8, 11);
    put(w, 'airport', 11, 11); // four pieces: international
    expect(hubJobs(w)).toBe(HUBS.airport.jobs[2]);
    put(w, 'harbor', 17, 12);
    expect(hubJobs(w)).toBe(HUBS.airport.jobs[2] + HUBS.harbor.jobs[0]);
    expect(hubIncome(w)).toBe(HUBS.airport.income[2] + HUBS.harbor.income[0]);
  });

  it('gives nothing when no street is near, but still costs its upkeep', () => {
    const w = city();
    put(w, 'airport', 2, 11);
    put(w, 'airport', 5, 11);
    for (let x = 0; x < 20; x++) w.setTile(x, 10, TILE.EMPTY);
    expect(hubJobs(w)).toBe(0);
    expect(hubIncome(w)).toBe(0);
    expect(hubUpkeep(w)).toBe(2 * HUBS.airport.upkeep);
  });

  it('shows in the budget: the upkeep of every piece and the income of the facility', () => {
    const w = city();
    put(w, 'airport', 2, 11);
    put(w, 'airport', 5, 11);
    put(w, 'harbor', 17, 12);
    const b = monthlyBudget(w, 7);
    expect(b.hubs).toBe(2 * HUBS.airport.upkeep + HUBS.harbor.upkeep);
    expect(b.hubIncome).toBe(HUBS.airport.income[1] + HUBS.harbor.income[0]);
    const without = monthlyBudget(new World(shore()), 7);
    expect(b.balance - without.balance).toBe(b.hubIncome - b.hubs + (b.taxC - without.taxC) - (b.roads - without.roads));
  });

  it('makes noise only when it is an airport that works: the lots around lose value', () => {
    const w = city();
    for (let y = 18; y < 32; y++) for (let x = 0; x < 20; x++) w.setTile(x, y, TILE.EMPTY);
    computeLandValue(w);
    const quiet = w.landValue[w.idx(4, 13)];
    const farQuiet = w.landValue[w.idx(4, 28)];
    put(w, 'airport', 2, 11);
    computeLandValue(w);
    expect(w.landValue[w.idx(4, 13)]).toBeLessThan(quiet);
    expect(w.landValue[w.idx(4, 28)]).toBe(farQuiet); // far away: not touched
    for (let x = 0; x < 20; x++) w.setTile(x, 10, TILE.EMPTY); // no street: it does not work, it is not loud
    computeLandValue(w);
    expect(w.landValue[w.idx(4, 13)]).toBe(quiet);
    const harbour = city();
    computeLandValue(harbour);
    const before = harbour.landValue[harbour.idx(16, 13)];
    put(harbour, 'harbor', 17, 12);
    computeLandValue(harbour);
    expect(harbour.landValue[harbour.idx(16, 13)]).toBe(before);
  });
});

describe('the card of a piece', () => {
  it('names the level, says what it gives, and tells how many pieces more make the next one', () => {
    const w = city();
    put(w, 'airport', 2, 11);
    const sim = new Simulation(w, newSimState(1), 'X');
    sim.refresh();
    const one = describeCell(w, sim, 3, 11);
    expect(one.title).toBe('Hangar');
    expect(one.lines.join(' ')).toMatch(/1 pieza pegada/);
    expect(one.lines.join(' ')).toMatch(/Ruido/);
    expect(one.hint).toMatch(/Pegá 1 pieza más.*Aeródromo/);

    put(w, 'airport', 5, 11);
    sim.refresh();
    expect(describeCell(w, sim, 3, 11).title).toBe('Aeródromo');
    expect(describeCell(w, sim, 3, 11).hint).toMatch(/Pegá 2 piezas más.*Aeropuerto internacional/);

    put(w, 'harbor', 17, 12);
    sim.refresh();
    const dock = describeCell(w, sim, 17, 12);
    expect(dock.title).toBe('Muelle de paseos');
    expect(dock.lines.join(' ')).not.toMatch(/Ruido/);
  });

  it('warns when it does not work', () => {
    const w = city();
    put(w, 'harbor', 17, 12);
    for (let x = 0; x < 20; x++) w.setTile(x, 10, TILE.EMPTY);
    const sim = new Simulation(w, newSimState(1), 'X');
    sim.refresh();
    expect(describeCell(w, sim, 17, 12).lines.join(' ')).toMatch(/No funciona: sin calle/);
  });
});

describe('saving the airports and harbours', () => {
  const saved = (w: World) => JSON.parse(serialize({ name: 'X', seed: 1, world: w, sim: newSimState(1) })) as Record<string, unknown>;

  it('round-trips every piece', () => {
    const w = city();
    put(w, 'airport', 2, 11);
    put(w, 'airport', 5, 11);
    put(w, 'harbor', 17, 12);
    const back = deserialize(JSON.stringify(saved(w))).world;
    expect(back.hubs).toEqual(w.hubs);
    expect(hubFacilities(back).map((f) => f.level)).toEqual(hubFacilities(w).map((f) => f.level));
  });

  it('refuses a piece off its tiles, of an unknown kind, outside the map or on top of another', () => {
    const w = city();
    put(w, 'airport', 2, 12);
    const base = saved(w);
    const withHubs = (hubs: unknown) => JSON.stringify({ ...base, hubs });
    expect(() => deserialize(withHubs([{ x: 2, y: 12, kind: 'zeppelin' }]))).toThrow(/desconocido/);
    expect(() => deserialize(withHubs([{ x: 31, y: 12, kind: 'airport' }]))).toThrow(/fuera del mapa/);
    expect(() => deserialize(withHubs([{ x: 8, y: 12, kind: 'airport' }]))).toThrow(/sin terreno/);
    expect(() => deserialize(withHubs([{ x: 2, y: 12, kind: 'airport' }, { x: 3, y: 12, kind: 'airport' }]))).toThrow(/sin terreno/);
    expect(() => deserialize(withHubs([]))).toThrow(/no coinciden/);
  });
});

describe('the light of airports and harbours', () => {
  /** A city with no light given for free: only the plant lights things. */
  const dark = (): World => {
    const w = city();
    w.powered.fill(0);
    return w;
  };

  it('does not work in the dark, and asks for the power of its level once a plant lights it', () => {
    const w = dark();
    put(w, 'airport', 2, 11);
    expect(hubFacilities(w)[0].lit).toBe(false);
    expect(hubJobs(w)).toBe(0);
    put(w, 'plant', 5, 11);
    const report = computePower(w);
    expect(hubFacilities(w)[0].lit).toBe(true);
    expect(hubJobs(w)).toBe(HUBS.airport.jobs[0]);
    expect(report.use).toBe(HUBS.airport.power[0]);
  });

  it('passes the light between its own pieces, so one line lights the whole airport', () => {
    // El pedido del jugador: un aeropuerto no debería tener que estar rodeado de cables. Alcanza con
    // que la luz llegue a una de sus piezas y las demás la pasan, como cualquier edificio.
    const w = dark();
    put(w, 'plant', 0, 14);
    put(w, 'airport', 2, 11); // 3×2: de (2,11) a (4,12)
    // Una sola línea toca la esquina de la pieza de arriba, no las seis.
    w.setTile(2, 13, TILE.LINE);
    computePower(w);
    for (let y = 11; y <= 12; y++) for (let x = 2; x <= 4; x++) expect(w.powered[w.idx(x, y)]).toBe(1);
    expect(hubFacilities(w)[0].lit).toBe(true);
  });

  it('asks for more the bigger it is, shared among its pieces', () => {
    const w = dark();
    put(w, 'plant', 3, 8);
    put(w, 'airport', 2, 11);
    put(w, 'airport', 5, 11);
    expect(computePower(w).use).toBe(HUBS.airport.power[1]);
    expect(HUBS.airport.power[1]).toBeGreaterThan(HUBS.airport.power[0]);
    expect(HUBS.airport.power[2]).toBeGreaterThan(HUBS.airport.power[1]);
    expect(HUBS.harbor.power[2]).toBeGreaterThan(HUBS.harbor.power[0]);
  });

  it('says on its card what it consumes', () => {
    const w = dark();
    put(w, 'airport', 2, 11);
    put(w, 'plant', 5, 11);
    const sim = new Simulation(w, newSimState(1), 'X');
    sim.refresh();
    expect(describeCell(w, sim, 3, 11).lines.join(' ')).toMatch(/Consume 40 MW/);
  });
});
