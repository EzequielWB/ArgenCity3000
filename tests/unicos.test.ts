import { describe, expect, it } from 'vitest';
import { ROAD_TIERS, UNIQUES, UNIQUE_BOOST_MAX, UNIQUE_KINDS, UNIQUE_RULES, UPKEEP } from '../src/config';
import { deserialize, serialize } from '../src/save/save';
import { monthlyBudget } from '../src/sim/budget';
import { isUnlocked, milestoneOfTool } from '../src/sim/milestones';
import { describeCell } from '../src/sim/report';
import { Simulation, newSimState } from '../src/sim/simulation';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { UndoHistory } from '../src/world/history';
import { applyPlan, groupOfTool, planTool, footprintOfTool, isUniqueTool, uniqueKindOfTool, type ToolId } from '../src/world/tools';
import { countUniques, uniqueBoost, uniqueFootprint, uniqueRefusal, uniqueUpkeep, uniqueWorks } from '../src/world/uniques';
import { TILE, World } from '../src/world/world';

/** Flat land at `height`, with a street along y = 4 from x = 0 to x = n - 1. */
function flat(n = 32, height = SEA_LEVEL + 1): Terrain {
  const s = n + 1;
  return { n, corners: new Uint8Array(s * s).fill(height), trees: new Uint8Array(n * n) };
}

function city(terrain: Terrain = flat()): World {
  const w = new World(terrain);
  w.powered.fill(1);
  for (let x = 0; x < w.n; x++) w.setTile(x, 4, TILE.ROAD);
  return w;
}

/** A channel of water four lots wide, from y = 8 to y = 18, with dry land all round it. */
function channel(n = 32): Terrain {
  const s = n + 1;
  const corners = new Uint8Array(s * s).fill(SEA_LEVEL + 1);
  for (let y = 8; y <= 18; y++) for (let x = 10; x <= 13; x++) corners[y * s + x] = SEA_LEVEL - 1;
  return { n, corners, trees: new Uint8Array(n * n) };
}

/** A hill: everything west of x = 12 is low, the rest climbs to `top`. */
function hill(top = 12, n = 32): Terrain {
  const s = n + 1;
  const corners = new Uint8Array(s * s).fill(SEA_LEVEL + 1);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) if (x >= 12) corners[y * s + x] = top;
  return { n, corners, trees: new Uint8Array(n * n) };
}

const put = (w: World, tool: ToolId, x: number, y: number) => {
  const plan = planTool(w, tool, [[x, y]]);
  applyPlan(w, plan);
  return plan;
};

/** A plaza big enough for the obelisco, one lot away from the street at y = 4. */
function withPlaza(w: World): World {
  for (let y = 5; y <= 10; y++) for (let x = 1; x <= 6; x++) w.setTile(x, y, TILE.PARK);
  return w;
}

describe('the category of the uniques', () => {
  it('is a category of its own with the five monuments', () => {
    expect(groupOfTool('obelisco').id).toBe('uniques');
    expect(groupOfTool('estadio').label).toBe('Únicos');
    for (const kind of UNIQUE_KINDS) {
      expect(isUniqueTool(kind)).toBe(true);
      expect(uniqueKindOfTool(kind)).toBe(kind);
    }
    expect(isUniqueTool('park')).toBe(false);
    expect(uniqueKindOfTool('park')).toBeNull();
  });

  it('keeps the footprints the player asked for', () => {
    expect([UNIQUES.obelisco.w, UNIQUES.obelisco.h]).toEqual([2, 2]);
    expect([UNIQUES.calvario.w, UNIQUES.calvario.h]).toEqual([3, 6]);
    expect([UNIQUES.puente.w, UNIQUES.puente.h]).toEqual([2, 6]);
    expect([UNIQUES.teatro.w, UNIQUES.teatro.h]).toEqual([3, 3]);
    expect([UNIQUES.estadio.w, UNIQUES.estadio.h]).toEqual([4, 4]);
    for (const kind of UNIQUE_KINDS) {
      const cells = footprintOfTool(kind, 32, 5, 5);
      expect(cells).toHaveLength(UNIQUES[kind].w * UNIQUES[kind].h);
      // The anchor is the top-left lot, and the footprint never leaves the map.
      expect(cells).toContainEqual([5, 5]);
      const corner = footprintOfTool(kind, 32, 31, 31)!;
      expect(corner).toHaveLength(UNIQUES[kind].w * UNIQUES[kind].h);
      for (const [x, y] of corner) {
        expect(x).toBeLessThan(32);
        expect(y).toBeLessThan(32);
      }
    }
  });
});

describe('one of each per city', () => {
  it('refuses the second obelisco in words that name the building', () => {
    const w = withPlaza(city());
    const first = put(w, 'obelisco', 3, 7);
    expect(first.cells).toHaveLength(4);
    expect(first.cost).toBe(UNIQUES.obelisco.cost);
    const again = planTool(w, 'obelisco', [[3, 7]]);
    expect(again.cells).toEqual([]);
    expect(again.cost).toBe(0);
    expect(uniqueRefusal(w, 'obelisco', uniqueFootprint('obelisco', w.n, 3, 7))).toMatch(/Obelisco: ya hay uno en la ciudad/);
  });

  it('bills the upkeep of every monument, working or not', () => {
    const w = withPlaza(city());
    put(w, 'obelisco', 3, 7);
    expect(uniqueUpkeep(w)).toBe(UNIQUES.obelisco.upkeep);
    // Without a street, the monument is not worth a visit, but it is still kept.
    const isolated = withPlaza(new World(flat()));
    put(isolated, 'obelisco', 3, 11);
    expect(uniqueWorks(isolated, isolated.uniques[0])).toBe(false);
    expect(uniqueUpkeep(isolated)).toBe(UNIQUES.obelisco.upkeep);
  });

  it('comes down whole with the bulldozer', () => {
    const w = withPlaza(city());
    put(w, 'obelisco', 3, 7);
    const plan = planTool(w, 'bulldoze', [[3, 7]]);
    expect(plan.cells).toHaveLength(4);
    applyPlan(w, plan);
    expect(w.uniques).toHaveLength(0);
    for (let y = 7; y <= 8; y++) for (let x = 3; x <= 4; x++) expect(w.tileAt(x, y)).toBe(TILE.EMPTY);
  });
});

describe('where each one may stand', () => {
  it('asks for a big enough plaza around the obelisco', () => {
    const bare = city();
    const foot = uniqueFootprint('obelisco', bare.n, 3, 7);
    expect(uniqueRefusal(bare, 'obelisco', foot)).toMatch(/necesita 8 lotes de plaza/);
    const w = withPlaza(city());
    expect(uniqueRefusal(w, 'obelisco', foot)).toBeNull();
    // A plaza of only a few lots is a garden, not the esplanade of a monument.
    const small = city();
    for (let x = 3; x <= 4; x++) for (let y = 11; y <= 12; y++) small.setTile(x, y, TILE.PARK);
    expect(uniqueRefusal(small, 'obelisco', foot)).toMatch(/lotes de plaza/);
  });

  it('puts the calvario up on a hill and nowhere else', () => {
    const low = city();
    expect(uniqueRefusal(low, 'calvario', uniqueFootprint('calvario', low.n, 14, 10))).toMatch(/en lo alto de una loma/);
    const high = city(hill(UNIQUE_RULES.calvario.height));
    expect(uniqueRefusal(high, 'calvario', uniqueFootprint('calvario', high.n, 14, 10))).toBeNull();
  });

  it('wants the puente over the water, with one end on land', () => {
    const w = city(channel());
    // Across the channel, from bank to bank: the real crossing.
    const across = uniqueFootprint('puente', w.n, 10, 7);
    expect(uniqueRefusal(w, 'puente', across)).toBeNull();
    expect(planTool(w, 'puente', [[10, 7]]).cells).toHaveLength(12);
    // On dry land it is not a bridge.
    expect(uniqueRefusal(w, 'puente', uniqueFootprint('puente', w.n, 3, 10))).toMatch(/tiene que ir sobre el agua/);
    // Water with no bank at either end is open water, not a crossing.
    const open = uniqueFootprint('puente', w.n, 10, 12);
    expect(uniqueRefusal(w, 'puente', open)).toMatch(/una de las dos puntas tiene que llegar a tierra/);
  });

  it('builds the puente over the water and keeps its lots wet', () => {
    const w = city(channel());
    const plan = put(w, 'puente', 10, 7);
    expect(plan.cost).toBe(UNIQUES.puente.cost);
    expect(w.uniques[0].kind).toBe('puente');
    for (const [x, y] of uniqueFootprint('puente', w.n, 10, 7)) {
      expect(w.tileAt(x, y)).toBe(TILE.UNIQUE);
      expect(w.isWater(x, y)).toBe(true);
    }
  });

  it('asks for a rich enough neighbourhood around the teatro', () => {
    const w = city();
    const foot = uniqueFootprint('teatro', w.n, 3, 7);
    expect(uniqueRefusal(w, 'teatro', foot)).toMatch(/valor del suelo de 45 o más/);
    // The neighbours' land value is a layer the simulation keeps: raise it and the theatre fits.
    for (const i of w.landValue.keys()) w.landValue[i] = 70;
    expect(uniqueRefusal(w, 'teatro', foot)).toBeNull();
  });

  it('asks for a boulevard within reach of the estadio', () => {
    const w = city();
    const foot = uniqueFootprint('estadio', w.n, 2, 8);
    expect(uniqueRefusal(w, 'estadio', foot)).toMatch(/necesita un bulevar a 6 lotes o menos/);
    for (let x = 0; x < w.n; x++) w.roadTier[w.idx(x, 4)] = 2; // the boulevard tier
    expect(uniqueRefusal(w, 'estadio', foot)).toBeNull();
    // A paved street is not a boulevard, however good it is.
    for (let x = 0; x < w.n; x++) w.roadTier[w.idx(x, 4)] = 1;
    expect(uniqueRefusal(w, 'estadio', foot)).toMatch(/bulevar/);
    expect(ROAD_TIERS[2].label).toBe('Bulevar');
  });
});

describe('the tourism of the monuments', () => {
  function withObelisco(): World {
    const w = withPlaza(city());
    put(w, 'obelisco', 3, 7);
    return w;
  }

  it('adds a share of the tourism, more in season', () => {
    const w = withObelisco();
    expect(uniqueBoost(w)).toBeCloseTo(UNIQUES.obelisco.boost, 5);
    expect(uniqueBoost(w, 6)).toBeCloseTo(UNIQUES.obelisco.boost, 5);
    expect(uniqueBoost(w, 12)).toBeCloseTo(UNIQUES.obelisco.peak, 5);
    expect(uniqueBoost(w, 1)).toBeCloseTo(UNIQUES.obelisco.peak, 5);
  });

  it('gives nothing when nobody can get there', () => {
    const w = withPlaza(new World(flat()));
    put(w, 'obelisco', 3, 7);
    expect(uniqueBoost(w, 6)).toBe(0);
  });

  it('never passes the ceiling, however many are built', () => {
    // The five of them on the street, all worth a visit: in September their shares add up to more
    // than the ceiling, and the ceiling is what the city pays.
    const w = withPlaza(city());
    const spots: { kind: (typeof UNIQUE_KINDS)[number]; x: number; y: number }[] = [
      { kind: 'obelisco', x: 1, y: 5 },
      { kind: 'teatro', x: 4, y: 5 },
      { kind: 'calvario', x: 8, y: 5 },
      { kind: 'estadio', x: 12, y: 5 },
      { kind: 'puente', x: 18, y: 5 },
    ];
    w.uniques = spots.map(({ kind, x, y }) => ({ kind, x, y }));
    for (const { kind, x, y } of spots) for (const [cx, cy] of uniqueFootprint(kind, w.n, x, y)) w.setTile(cx, cy, TILE.UNIQUE);
    const raw = spots.reduce((sum, { kind }) => sum + (UNIQUES[kind].peakMonths.includes(9) ? UNIQUES[kind].peak : UNIQUES[kind].boost), 0);
    expect(raw).toBeGreaterThan(UNIQUE_BOOST_MAX);
    expect(uniqueBoost(w, 9)).toBe(UNIQUE_BOOST_MAX);
    expect(countUniques(w)).toEqual({ built: 5, working: 5 });
    // In a quiet month the shares are the plain ones, and they fit under the ceiling.
    expect(uniqueBoost(w, 2)).toBeCloseTo(spots.reduce((sum, { kind }) => sum + UNIQUES[kind].boost, 0), 5);
  });

  it('lands on its own line of the budget, over the coast and the hubs', () => {
    const w = withObelisco();
    const plain = withPlaza(city());
    const withBoost = monthlyBudget(w, 7, undefined, null, 6);
    const without = monthlyBudget(plain, 7, undefined, null, 6);
    const tourism = withBoost.coastIncome + withBoost.hubIncome;
    expect(tourism).toBe(0); // an empty city brings no tourism at all
    expect(withBoost.uniqueIncome).toBe(0);
    expect(withBoost.uniques).toBe(UNIQUES.obelisco.upkeep);
    // The monument takes four plaza lots: its upkeep comes in and their upkeep goes out.
    expect(withBoost.expenses - without.expenses).toBe(UNIQUES.obelisco.upkeep - 4 * UPKEEP.park);
  });
});

describe('the card of a monument', () => {
  it('says what it adds and what it asks for', () => {
    const w = withPlaza(city());
    put(w, 'obelisco', 3, 7);
    const sim = new Simulation(w, newSimState(1), 'X');
    sim.refresh();
    const card = describeCell(w, sim, 3, 7);
    expect(card.title).toBe('Obelisco');
    expect(card.lines.join(' ')).toMatch(/Sumando 6 % al turismo/);
    expect(card.lines.join(' ')).toMatch(/uno solo por ciudad/);
  });

  it('says so when no street reaches it', () => {
    const w = withPlaza(new World(flat()));
    put(w, 'obelisco', 3, 7);
    const sim = new Simulation(w, newSimState(1), 'X');
    sim.refresh();
    const card = describeCell(w, sim, 3, 7);
    expect(card.lines.join(' ')).toMatch(/Sin calle/);
    expect(card.hint).toMatch(/traza\u00e1 una calle|cerca/);
  });
});

describe('milestones, saving and undo', () => {
  it('opens each monument at a milestone', () => {
    for (const kind of UNIQUE_KINDS) {
      const at = milestoneOfTool(kind);
      expect(at).toBeGreaterThan(0);
      expect(isUnlocked(kind, 0)).toBe(false);
      expect(isUnlocked(kind, at)).toBe(true);
    }
  });

  it('saves the monument with its footprint and reads it back', () => {
    const w = withPlaza(city());
    put(w, 'obelisco', 3, 7);
    const text = serialize({ name: 'Prueba', seed: 1, world: w, sim: newSimState(1) });
    const back = deserialize(text);
    expect(back.world.uniques).toEqual([{ x: 3, y: 7, kind: 'obelisco' }]);
    expect(back.world.tileAt(3, 7)).toBe(TILE.UNIQUE);
  });

  it('refuses a save with two of the same or a monument off the map', () => {
    const w = withPlaza(city());
    put(w, 'obelisco', 3, 7);
    const data = JSON.parse(serialize({ name: 'Prueba', seed: 1, world: w, sim: newSimState(1) }));
    data.uniques = [
      { x: 3, y: 11, kind: 'obelisco' },
      { x: 5, y: 11, kind: 'obelisco' },
    ];
    expect(() => deserialize(JSON.stringify(data))).toThrow();
    data.uniques = [{ x: 31, y: 31, kind: 'estadio' }];
    expect(() => deserialize(JSON.stringify(data))).toThrow();
  });

  it('reads a save from before the monuments with none', () => {
    const w = withPlaza(city());
    const data = JSON.parse(serialize({ name: 'Prueba', seed: 1, world: w, sim: newSimState(1) }));
    data.version = 19;
    delete data.uniques;
    const back = deserialize(JSON.stringify(data));
    expect(back.world.uniques).toEqual([]);
  });

  it('gives the monument back when the move is undone', () => {
    const w = withPlaza(city());
    const history = new UndoHistory();
    const plan = planTool(w, 'obelisco', [[3, 7]]);
    history.record(w, plan, 0);
    applyPlan(w, plan);
    expect(w.uniques).toHaveLength(1);
    const undone = history.undo(w, 0);
    expect(undone?.refund).toBe(plan.cost);
    expect(w.uniques).toHaveLength(0);
    expect(w.tileAt(3, 7)).toBe(TILE.PARK);
  });
});
