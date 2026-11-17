import { describe, expect, it } from 'vitest';
import { GOVERNMENT_UNIQUE_KINDS, GOVERNMENTS, ROAD_TIERS, UNIQUES, UNIQUE_BOOST_MAX, UNIQUE_KINDS, UNIQUE_RULES, UPKEEP } from '../src/config';
import { deserialize, serialize } from '../src/save/save';
import { monthlyBudget } from '../src/sim/budget';
import { isUnlocked, milestoneOfTool } from '../src/sim/milestones';
import { describeCell } from '../src/sim/report';
import { Simulation, newSimState } from '../src/sim/simulation';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { computeCrime, computeServices } from '../src/sim/fields';
import { zoneTile } from '../src/world/world';
import { UndoHistory } from '../src/world/history';
import { applyPlan, groupOfTool, planTool, footprintOfTool, isUniqueTool, uniqueKindOfTool, type ToolId } from '../src/world/tools';
import { countUniques, industrialJobs, uniqueApproval, uniqueBoost, uniqueFavor, uniqueFootprint, uniqueRefusal, uniqueUpkeep, uniqueWorks } from '../src/world/uniques';
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

/** Three shelves: `low` up to x = 8, `mid` from there, and `top` from x = 16. */
function shelves(low: number, mid: number, top: number, n = 32): Terrain {
  const s = n + 1;
  const corners = new Uint8Array(s * s).fill(low);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      if (x >= 16) corners[y * s + x] = top;
      else if (x >= 8) corners[y * s + x] = mid;
    }
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

  it('measures the calvario against the top of its own map', () => {
    // Con loma: arriba sí y abajo no, y el margen deja una banda donde elegir.
    const steep = city(hill(12));
    expect(uniqueRefusal(steep, 'calvario', uniqueFootprint('calvario', steep.n, 14, 10))).toBeNull();
    const below = uniqueRefusal(steep, 'calvario', uniqueFootprint('calvario', steep.n, 2, 10));
    expect(below).toMatch(/lo más alto del mapa/);
    expect(below).toContain(`cima está en 12`); // el número es el del mapa, no el de la regla
    // Y un mapa sin loma tiene la cima en el llano: el monumento entra, que era el pedido.
    const flatland = city();
    expect(uniqueRefusal(flatland, 'calvario', uniqueFootprint('calvario', flatland.n, 14, 10))).toBeNull();
    // El margen es lo que se promete: a cuatro niveles de la cima entra, a cinco no.
    const margin = UNIQUE_RULES.calvario.margin;
    const near = city(shelves(SEA_LEVEL + 1, 12 - margin, 12));
    expect(uniqueRefusal(near, 'calvario', uniqueFootprint('calvario', near.n, 9, 10))).toBeNull();
    const oneDown = city(shelves(SEA_LEVEL + 1, 12 - margin - 1, 12));
    expect(uniqueRefusal(oneDown, 'calvario', uniqueFootprint('calvario', oneDown.n, 9, 10))).toMatch(/lo más alto del mapa/);
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
    expect(card.lines.join(' ')).toMatch(/Suma 6 % al turismo/);
    expect(card.lines.join(' ')).toMatch(/uno solo por ciudad/);
    expect(card.lines.join(' ')).toMatch(/cualquier gobierno/);
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

describe('the uniques of each government', () => {
  it('gives every government exactly one, and only that government may build it', () => {
    const owners = GOVERNMENT_UNIQUE_KINDS.map((kind) => UNIQUES[kind].government);
    expect(owners).toEqual(['democracia', 'dictadura', 'tecnocracia', 'teocracia', 'comunismo']);
    for (const kind of UNIQUE_KINDS) expect(UNIQUES[kind].government).toBeUndefined();
    const w = city();
    for (const kind of GOVERNMENT_UNIQUE_KINDS) {
      const foot = uniqueFootprint(kind, w.n, 3, 7);
      const own = UNIQUES[kind].government!;
      const other = own === 'democracia' ? 'dictadura' : 'democracia';
      expect(uniqueRefusal(w, kind, foot, own) ?? '').not.toMatch(/es el único de/);
      expect(uniqueRefusal(w, kind, foot, other)).toMatch(new RegExp(`es el único de ${GOVERNMENTS[own].label.toLowerCase()}`));
      // Without a government to compare against (a plan built by hand) the rule does not guess.
      expect(uniqueRefusal(w, kind, foot) ?? '').not.toMatch(/es el único de/);
    }
  });

  it('asks the cabildo for a plaza, and refuses it on bare ground', () => {
    const bare = city();
    expect(uniqueRefusal(bare, 'cabildo', uniqueFootprint('cabildo', 32, 3, 7), 'democracia')).toMatch(/plaza enfrente/);
    const withSquare = withPlaza(city());
    expect(uniqueRefusal(withSquare, 'cabildo', uniqueFootprint('cabildo', 32, 3, 7), 'democracia')).toBeNull();
  });

  it('asks the regimiento for open ground, and refuses it in a built block', () => {
    const open = city();
    expect(uniqueRefusal(open, 'regimiento', uniqueFootprint('regimiento', 32, 6, 8), 'dictadura')).toBeNull();
    const built = city();
    // The whole block around is zoned, so there is no open ground left for the parade.
    for (let y = 5; y <= 18; y++) for (let x = 1; x <= 20; x++) built.setTile(x, y, zoneTile('R'));
    expect(uniqueRefusal(built, 'regimiento', uniqueFootprint('regimiento', 32, 6, 8), 'dictadura')).toMatch(/descampado/);
  });

  it('asks the planetario for a university near, and the santuario for water', () => {
    const w = city();
    expect(uniqueRefusal(w, 'planetario', uniqueFootprint('planetario', 32, 3, 7), 'tecnocracia')).toMatch(/universidad/);
    w.setTile(9, 9, TILE.UNIVERSITY);
    expect(uniqueRefusal(w, 'planetario', uniqueFootprint('planetario', 32, 3, 7), 'tecnocracia')).toBeNull();
    expect(uniqueRefusal(w, 'santuario', uniqueFootprint('santuario', 32, 3, 7), 'teocracia')).toMatch(/agua|costa/);
    const shore = new World(channel());
    expect(uniqueRefusal(shore, 'santuario', uniqueFootprint('santuario', 32, 6, 12), 'teocracia')).toBeNull();
  });

  it('asks the sindicato for factories around, and refuses it among houses', () => {
    const houses = city();
    for (let y = 5; y <= 14; y++) for (let x = 5; x <= 15; x++) houses.setTile(x, y, zoneTile('R'));
    expect(uniqueRefusal(houses, 'sindicato', uniqueFootprint('sindicato', 32, 6, 8), 'comunismo')).toMatch(/fábricas/);
    const works = city();
    for (let y = 5; y <= 14; y++) for (let x = 5; x <= 15; x++) works.setTile(x, y, zoneTile('I'));
    expect(uniqueRefusal(works, 'sindicato', uniqueFootprint('sindicato', 32, 6, 8), 'comunismo')).toBeNull();
  });

  it('pays approval with the cabildo, and doubles it in the month of the election', () => {
    const w = withPlaza(city());
    put(w, 'cabildo', 3, 7);
    expect(w.uniques).toHaveLength(1);
    expect(uniqueApproval(w, 3)).toBe(UNIQUES.cabildo.approval!.perMonth);
    expect(uniqueApproval(w, 9)).toBe(UNIQUES.cabildo.approval!.peak);
    // Without a street it does not work, so it pays nothing.
    const far = withPlaza(new World(flat()));
    far.powered.fill(1);
    put(far, 'cabildo', 3, 7);
    expect(far.uniques).toHaveLength(1);
    expect(uniqueWorks(far, far.uniques[0])).toBe(false);
    expect(uniqueApproval(far, 3)).toBe(0);
  });

  it('pays favor with the santuario, and more in April', () => {
    const w = new World(channel());
    w.powered.fill(1);
    for (let x = 0; x < w.n; x++) {
      w.setTile(x, 4, TILE.ROAD);
      w.setTile(x, 11, TILE.ROAD);
    }
    put(w, 'santuario', 6, 12);
    expect(w.uniques).toHaveLength(1);
    expect(uniqueFavor(w, 7)).toBe(UNIQUES.santuario.favor!.perMonth);
    expect(uniqueFavor(w, 4)).toBe(UNIQUES.santuario.favor!.peak);
  });

  it('takes crime out of the neighbourhood with the regimiento', () => {
    const info = UNIQUES.regimiento.crime!;
    const crime = (withGarrison: boolean): number => {
      const w = city();
      // The post goes first (it wants open ground round it), then the dense commerce grows next to it.
      if (withGarrison) put(w, 'regimiento', 2, 6);
      for (let y = 5; y <= 12; y++) {
        for (let x = 1; x <= 12; x++) {
          if (w.tiles[w.idx(x, y)] === TILE.UNIQUE) continue;
          w.setTile(x, y, zoneTile('C'));
          w.level[w.idx(x, y)] = 4;
        }
      }
      w.safety.fill(0);
      computeCrime(w, 5000);
      return w.crime[w.idx(6, 9)];
    };
    expect(crime(true)).toBeLessThan(crime(false) - info.shade / 2);
  });

  it('teaches around the planetario, as a school does', () => {
    // The sample lot is far from the campus on purpose, so what it reads is the planetario and not
    // the university that justified it.
    const edu = (withDome: boolean): number => {
      const w = city();
      w.setTile(9, 9, TILE.UNIVERSITY);
      if (withDome) put(w, 'planetario', 2, 6);
      computeServices(w);
      return w.edu[w.idx(1, 11)];
    };
    expect(edu(true)).toBeGreaterThan(edu(false));
  });

  it('brings tourists to the sindicato in proportion to the factories that work', () => {
    const w = city();
    // The factories have to be there for the union hall to be allowed in: that is its whole rule.
    const I = zoneTile('I');
    for (let y = 5; y <= 15; y++) {
      for (let x = 1; x <= 16; x++) {
        const inFoot = x >= 6 && x <= 8 && y >= 5 && y <= 6;
        if (inFoot) continue;
        w.setTile(x, y, I);
        w.level[w.idx(x, y)] = 3;
      }
    }
    put(w, 'sindicato', 6, 5);
    expect(w.uniques).toHaveLength(1);
    const jobs = industrialJobs(w);
    expect(jobs).toBeGreaterThan(0);
    expect(uniqueBoost(w, 6)).toBeCloseTo(Math.min(UNIQUES.sindicato.jobs!.max, jobs * UNIQUES.sindicato.jobs!.perJob), 6);
    // A city that grows past the ceiling does not add more than the monument is worth.
    w.level.fill(5);
    expect(industrialJobs(w)).toBeGreaterThan(jobs);
    expect(uniqueBoost(w, 6)).toBeCloseTo(UNIQUES.sindicato.jobs!.max, 6);
  });

  it('names the effect in its card', () => {
    const w = withPlaza(city());
    put(w, 'cabildo', 3, 7);
    expect(w.uniques).toHaveLength(1);
    const sim = new Simulation(w, newSimState(1, 'democracia'), 'X');
    const card = describeCell(w, sim, 3, 7);
    expect(card.title).toBe('El Cabildo');
    expect(card.lines.join(' ')).toMatch(/aprobación/);
    expect(card.lines.join(' ')).toMatch(/El único de democracia/);
  });
});
