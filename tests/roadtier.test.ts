import { describe, expect, it } from 'vitest';
import { COSTS, DIRT, ROAD_TIERS, roadRank, weakerRoad } from '../src/config';
import { computeCrime, computeLandValue } from '../src/sim/fields';
import { MapRenderer } from '../src/render/mapRenderer';
import { KIND, analyzeRoads, boulevardMedian, centreMark, kindOf, tierOf } from '../src/render/avenue';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { SAVE_VERSION, deserialize, serialize, toBase64 } from '../src/save/save';
import { isUnlocked } from '../src/sim/milestones';
import { Simulation, newSimState } from '../src/sim/simulation';
import { generateTerrain } from '../src/world/terrain';
import { applyPlan, dragCells, planTool, routeRefusal, type ToolId } from '../src/world/tools';
import { TILE, World } from '../src/world/world';
import { toolPrice } from '../src/ui/toolbar';

function city(): { world: World; sim: Simulation } {
  const world = new World(generateTerrain(11, 32));
  const sim = new Simulation(world, newSimState(11), 'Villa Calidades');
  const b = (t: Parameters<typeof planTool>[1], ax: number, ay: number, bx = ax, by = ay) =>
    applyPlan(world, planTool(world, t, dragCells(t, ax, ay, bx, by, 1, 32)));
  b('plant', 2, 2);
  b('road', 1, 5, 20, 5);
  b('zoneR', 2, 6, 10, 8);
  return { world, sim };
}

function saved(): Record<string, unknown> {
  const { world, sim } = city();
  return JSON.parse(serialize({ name: 'X', seed: 11, world, sim: sim.state }));
}

describe('street quality', () => {
  it('starts every street on asphalt and every other cell at zero', () => {
    const { world } = city();
    const streets = Array.from(world.tiles).filter((t) => t === TILE.ROAD).length;
    expect(streets).toBeGreaterThan(0);
    expect(Array.from(world.roadTier).every((v) => v === 0)).toBe(true);
  });

  it('keeps the quality of every street cell through a save', () => {
    const { world, sim } = city();
    for (let i = 0; i < world.roadTier.length; i++) {
      if (world.tiles[i] === TILE.ROAD) world.roadTier[i] = i % 3;
    }
    const back = deserialize(serialize({ name: 'X', seed: 11, world, sim: sim.state }));
    expect(Array.from(back.world.roadTier)).toEqual(Array.from(world.roadTier));
    expect(SAVE_VERSION).toBe(20);
  });

  it('opens a save from the version before the qualities as all asphalt', () => {
    const data = saved();
    data.version = 8;
    delete data.roadTier;
    const back = deserialize(JSON.stringify(data));
    expect(Array.from(back.world.roadTier).every((v) => v === 0)).toBe(true);
  });

  it('rejects a quality grid that does not cover the map', () => {
    const data = saved();
    data.roadTier = toBase64(new Uint8Array(10));
    expect(() => deserialize(JSON.stringify(data))).toThrow(/calidad/i);
  });

  it('rejects a quality that does not exist', () => {
    const data = saved();
    const { world } = city();
    const grid = new Uint8Array(world.n * world.n);
    grid[grid.length - 1] = ROAD_TIERS.length;
    data.roadTier = toBase64(grid);
    expect(() => deserialize(JSON.stringify(data))).toThrow(/calidad/i);
  });

  it('rejects a quality on a cell that is not a street', () => {
    const data = saved();
    const { world } = city();
    const grid = new Uint8Array(world.n * world.n);
    const empty = Array.from(world.tiles).findIndex((t) => t === TILE.EMPTY);
    grid[empty] = 1;
    data.roadTier = toBase64(grid);
    expect(() => deserialize(JSON.stringify(data))).toThrow(/calidad/i);
  });

  it('forgets the quality of a street that is no longer a street', () => {
    const { world } = city();
    world.roadTier[world.idx(5, 5)] = 2;
    world.setTile(5, 5, TILE.EMPTY);
    expect(world.roadTier[world.idx(5, 5)]).toBe(0);
  });
});

const R = ROAD_TIERS;
const ROAD_TOOLS = ['road', 'roadPaved', 'roadBoulevard'] as const;

/** A plan for a straight drag of `tool` from a to b, on a fresh generated map. */
function drag(w: World, tool: ToolId, ax: number, ay: number, bx = ax, by = ay) {
  return planTool(w, tool, dragCells(tool, ax, ay, bx, by, 1, w.n));
}

describe('building and upgrading street qualities', () => {
  it('builds each quality directly, at its own price', () => {
    const w = new World(generateTerrain(11, 32));
    const wide = drag(w, 'roadBoulevard', 5, 5, 7, 5);
    expect(wide.cost).toBe(R[2].cost * 3);
    applyPlan(w, wide);
    expect([5, 6, 7].map((x) => w.roadTier[w.idx(x, 5)])).toEqual([2, 2, 2]);
    expect(drag(w, 'roadPaved', 5, 8, 7, 8).cost).toBe(R[1].cost * 3);
  });

  it('upgrades a street in place and charges only the difference', () => {
    const w = new World(generateTerrain(11, 32));
    applyPlan(w, drag(w, 'road', 5, 5, 7, 5));
    const up = drag(w, 'roadBoulevard', 5, 5, 7, 5);
    expect(up.cost).toBe((R[2].cost - R[0].cost) * 3);
    applyPlan(w, up);
    expect([5, 6, 7].map((x) => w.roadTier[w.idx(x, 5)])).toEqual([2, 2, 2]);
    expect([5, 6, 7].every((x) => w.tiles[w.idx(x, 5)] === TILE.ROAD)).toBe(true);
  });

  it('never downgrades and never pays back', () => {
    const w = new World(generateTerrain(11, 32));
    applyPlan(w, drag(w, 'roadBoulevard', 5, 5, 7, 5));
    for (const tool of ROAD_TOOLS) {
      const same = drag(w, tool, 5, 5, 7, 5);
      expect(same.cells).toEqual([]);
      expect(same.cost).toBe(0);
    }
    expect(w.roadTier[w.idx(6, 5)]).toBe(2);
  });

  it('upgrades without demolishing: the street keeps its inherited flag', () => {
    const w = new World(generateTerrain(11, 32));
    applyPlan(w, drag(w, 'road', 5, 5, 7, 5));
    w.inherited[w.idx(6, 5)] = 1;
    applyPlan(w, drag(w, 'roadPaved', 5, 5, 7, 5));
    expect(w.inherited[w.idx(6, 5)]).toBe(1);
    expect(w.roadTier[w.idx(6, 5)]).toBe(1);
  });

  it('charges the bridge plus the quality above asphalt', () => {
    const w = new World(generateTerrain(7, 48));
    let cell: [number, number] | null = null;
    for (let y = 1; y < w.n - 1 && !cell; y++) {
      for (let x = 1; x < w.n - 1 && !cell; x++) {
        if (w.isWater(x, y) && planTool(w, 'road', [[x, y]]).cost === COSTS.bridge) cell = [x, y];
      }
    }
    expect(cell).not.toBeNull();
    const [x, y] = cell as [number, number];
    expect(planTool(w, 'road', [[x, y]]).cost).toBe(COSTS.bridge);
    expect(planTool(w, 'roadPaved', [[x, y]]).cost).toBe(COSTS.bridge + R[1].cost - R[0].cost);
    expect(planTool(w, 'roadBoulevard', [[x, y]]).cost).toBe(COSTS.bridge + R[2].cost - R[0].cost);
  });

  it('leaves the provincial route alone with all three tools', () => {
    const w = new World(generateTerrain(11, 32));
    w.tiles[w.idx(5, 5)] = TILE.ROAD;
    w.route[w.idx(5, 5)] = 1;
    for (const tool of ROAD_TOOLS) {
      expect(routeRefusal(w, tool, 5, 5)).toMatch(/ruta provincial/i);
      expect(drag(w, tool, 5, 5).cells).toEqual([]);
    }
    expect(w.roadTier[w.idx(5, 5)]).toBe(0);
  });

  it('offers the three qualities from the first milestone, at their prices', () => {
    for (const tool of ROAD_TOOLS) expect(isUnlocked(tool, 0)).toBe(true);
    expect(ROAD_TOOLS.map((t) => toolPrice(t))).toEqual([R[0].cost, R[1].cost, R[2].cost]);
  });
});

function flat(n = 48): Terrain {
  const s = n + 1;
  return { n, corners: new Uint8Array(s * s).fill(SEA_LEVEL + 1), trees: new Uint8Array(n * n) };
}

/** A dense block of homes facing a street along y = 10, with all of it one quality. */
function litTown(tier: 0 | 2): World {
  const w = new World(flat());
  for (let x = 10; x <= 30; x++) w.setTile(x, 10, TILE.ROAD);
  for (let y = 7; y <= 9; y++) for (let x = 11; x <= 29; x++) w.setTile(x, y, TILE.R, 4);
  if (tier) for (let x = 10; x <= 30; x++) w.roadTier[w.idx(x, 10)] = tier;
  return w;
}

describe('what the boulevard lamps are worth', () => {
  it('lowers the crime within their reach and leaves the rest alone', () => {
    const dark = litTown(0);
    const lit = litTown(2);
    computeCrime(dark, 2500);
    computeCrime(lit, 2500);
    expect(dark.crime[dark.idx(20, 9)]).toBeGreaterThan(0);
    expect(lit.crime[lit.idx(20, 9)]).toBeLessThan(dark.crime[dark.idx(20, 9)]);
    expect(lit.crime[lit.idx(20, 6)]).toBe(dark.crime[dark.idx(20, 6)]);
  });

  it('buys no land value: only the crime they take out shows', () => {
    const dark = litTown(0);
    const lit = litTown(2);
    computeLandValue(dark);
    computeLandValue(lit);
    expect(lit.landValue[lit.idx(20, 9)]).toBe(dark.landValue[dark.idx(20, 9)]);
  });
});

describe('the concrete median of a boulevard', () => {
  it('is one pixel on the boundary between the ways of an even band', () => {
    expect(boulevardMedian(2, 0)).toBe('boundary');
    expect(boulevardMedian(2, 1)).toBe('none');
    expect(boulevardMedian(4, 1)).toBe('boundary');
    expect(boulevardMedian(4, 2)).toBe('none');
  });

  it('runs through the middle of the middle lane of an odd band, and of a single street', () => {
    expect(boulevardMedian(1, 0)).toBe('through');
    expect(boulevardMedian(3, 1)).toBe('through');
    expect(boulevardMedian(3, 0)).toBe('none');
    expect(boulevardMedian(5, 2)).toBe('through');
    expect(boulevardMedian(5, 1)).toBe('none');
  });
});

describe('how each quality marks the middle of the street', () => {
  it('is the plain marking on asphalt, the raised yellow markers on reinforced pavement and concrete on a boulevard', () => {
    expect(centreMark(0)).toBe('plain');
    expect(centreMark(1)).toBe('lights');
    expect(centreMark(2)).toBe('concrete');
  });
});

describe('the map redraws a street that was only upgraded', () => {
  it('recomputes the band of the cell, which is where the quality is drawn from', () => {
    const w = new World(generateTerrain(11, 32));
    for (let x = 6; x <= 12; x++) w.setTile(x, 8, TILE.ROAD);
    const map = new MapRenderer(w);
    map.redrawAll();
    const bands = () => (map as unknown as { bands: Uint16Array }).bands;
    expect(tierOf(bands()[w.idx(9, 8)])).toBe(0);

    applyPlan(w, planTool(w, 'roadPaved', [[9, 8]]));
    map.update(w.takeDirty());
    expect(tierOf(bands()[w.idx(9, 8)])).toBe(1);
    // The streets beside it keep their own quality.
    expect(tierOf(bands()[w.idx(10, 8)])).toBe(0);
  });
});

describe('the band analysis with qualities', () => {
  const N = 12;

  it('reads an avenue by its weakest cell, and a lone street by its own quality', () => {
    const tiers = new Map<number, 0 | 1 | 2>();
    for (let x = 2; x <= 8; x++) {
      tiers.set(3 * N + x, 2);
      tiers.set(4 * N + x, 1);
    }
    const isRoad = (x: number, y: number) => y >= 3 && y <= 4 && x >= 2 && x <= 8;
    const codes = analyzeRoads(isRoad, N, (x, y) => tiers.get(y * N + x) ?? 0);
    const code = codes[3 * N + 5];
    expect(kindOf(code)).toBe(KIND.BAND_X);
    expect(tierOf(code)).toBe(1);
    expect(tierOf(codes[4 * N + 5])).toBe(1);
    // Without a tier accessor every street is asphalt, as before.
    expect(tierOf(analyzeRoads(isRoad, N)[3 * N + 5])).toBe(0);
    const lone = analyzeRoads((x, y) => x === 1 && y === 8, N, () => 2);
    expect(kindOf(lone[8 * N + 1])).toBe(KIND.PLAIN);
    expect(tierOf(lone[8 * N + 1])).toBe(2);
  });
});

describe('dirt streets', () => {
  it('are the worst quality of all: cheapest, weakest and cheapest to keep', () => {
    for (const t of [0, 1, 2] as const) {
      expect(roadRank(DIRT)).toBeLessThan(roadRank(t));
      expect(R[DIRT].cost).toBeLessThan(R[t].cost);
      expect(R[DIRT].upkeep).toBeLessThan(R[t].upkeep);
      expect(R[DIRT].capacity).toBeLessThan(R[t].capacity);
      expect(weakerRoad(t, DIRT)).toBe(DIRT);
      expect(weakerRoad(DIRT, t)).toBe(DIRT);
    }
    expect(weakerRoad(1, 2)).toBe(1);
  });

  it('are built at their own price and kept off the water', () => {
    const w = new World(generateTerrain(11, 32));
    const land = drag(w, 'roadDirt', 5, 5, 7, 5);
    expect(land.cost).toBe(R[DIRT].cost * 3);
    applyPlan(w, land);
    expect([5, 6, 7].map((x) => w.roadTier[w.idx(x, 5)])).toEqual([DIRT, DIRT, DIRT]);
    let wet: [number, number] | null = null;
    for (let y = 0; y < w.n && !wet; y++) for (let x = 0; x < w.n && !wet; x++) if (w.isWater(x, y) && !w.route[w.idx(x, y)]) wet = [x, y];
    expect(wet).not.toBeNull();
    expect(drag(w, 'roadDirt', wet![0], wet![1]).cells).toEqual([]);
  });

  it('are upgraded by any other quality for the difference, and never the other way round', () => {
    const w = new World(generateTerrain(11, 32));
    applyPlan(w, drag(w, 'roadDirt', 5, 5, 7, 5));
    const up = drag(w, 'road', 5, 5, 7, 5);
    expect(up.cost).toBe((R[0].cost - R[DIRT].cost) * 3);
    applyPlan(w, up);
    expect([5, 6, 7].map((x) => w.roadTier[w.idx(x, 5)])).toEqual([0, 0, 0]);
    expect(drag(w, 'roadDirt', 5, 5, 7, 5).cells).toEqual([]);
  });

  it('keep their quality through a save', () => {
    const { world, sim } = city();
    for (let i = 0; i < world.roadTier.length; i++) if (world.tiles[i] === TILE.ROAD) world.roadTier[i] = DIRT;
    const back = deserialize(serialize({ name: 'X', seed: 11, world, sim: sim.state }));
    expect(Array.from(back.world.roadTier)).toEqual(Array.from(world.roadTier));
  });

  it('are unlocked from the start', () => {
    expect(isUnlocked('roadDirt', 0)).toBe(true);
  });
});
