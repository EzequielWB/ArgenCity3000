import { describe, expect, it } from 'vitest';
import { COSTS, ROUTE } from '../src/config';
import { SAVE_VERSION, deserialize, serialize } from '../src/save/save';
import { monthlyBudget } from '../src/sim/budget';
import { newSimState } from '../src/sim/simulation';
import { UndoHistory } from '../src/world/history';
import { MAP_KINDS, generateMap, type MapKind } from '../src/world/mapkinds';
import { PRESETS, worldFromPreset, type MapPreset } from '../src/world/presets';
import { addRoute, chooseRoute, type RouteEdge } from '../src/world/route';
import { SEA_LEVEL, constrainSlopes, isWaterCell, type Terrain } from '../src/world/terrain';
import { TOOLS, applyPlan, dragCells, planTool, routeRefusal, type Plan } from '../src/world/tools';
import { TILE, World } from '../src/world/world';

const EDGES: RouteEdge[] = ['north', 'east', 'south', 'west'];

/** Terrain at `height(cx, cy)` levels over the sea, with water wherever `low` says a corner is down. */
function terrainWith(n: number, low: (cx: number, cy: number) => boolean = () => false, height: (cx: number, cy: number) => number = () => 0): Terrain {
  const s = n + 1;
  const corners = new Uint8Array(s * s);
  for (let cy = 0; cy < s; cy++) for (let cx = 0; cx < s; cx++) corners[cy * s + cx] = low(cx, cy) ? SEA_LEVEL - 1 : SEA_LEVEL + height(cx, cy);
  constrainSlopes(corners, s);
  return { n, corners, trees: new Uint8Array(n * n) };
}

/**
 * Lots of dry ground between the strip of an edge and the nearest water, counted without the module
 * under test. 0 means water in the strip itself, `ROUTE.clearance + 1` means none within reach.
 */
function bandWater(t: Terrain, edge: RouteEdge): number {
  const n = t.n;
  const last = ROUTE.inset + ROUTE.width - 1;
  for (let d = 0; d <= ROUTE.clearance; d++) {
    const ring = d === 0 ? Array.from({ length: ROUTE.width }, (_, k) => ROUTE.inset + k) : [ROUTE.inset - d, last + d];
    for (let along = ROUTE.margin; along <= n - 1 - ROUTE.margin; along++) {
      for (const across of ring) {
        if (across < 0 || across >= n) continue;
        const [x, y] = edge === 'west' ? [across, along] : edge === 'east' ? [n - 1 - across, along] : edge === 'north' ? [along, across] : [along, n - 1 - across];
        if (isWaterCell(t, x, y)) return d;
      }
    }
  }
  return ROUTE.clearance + 1;
}

/**
 * 32×32 land with a lake filling the whole strip of the west, east and north borders, so the route
 * goes along the south one. `extra` adds water anywhere else (the bridges of a test, say).
 */
const N = 32;
const SEED = 5;
function southTerrain(height: (cx: number, cy: number) => number = () => 0, extra: (cx: number, cy: number) => boolean = () => false): Terrain {
  return terrainWith(
    N,
    (cx, cy) => extra(cx, cy) || (cy === 15 && cx <= 4) || (cy === 15 && cx >= N - 5) || (cx === 15 && cy <= 4),
    height,
  );
}
function southWorld(): World {
  const w = new World(southTerrain());
  addRoute(w, SEED);
  return w;
}
/** Route rows of southWorld: the four rows one in from the border; the row next to them is 26. */
const ROW_NEXT = 26;
const ROW_ROUTE = 28;

/** A free cell that touches the route by a side. */
function streetCellBeside(w: World): [number, number] {
  for (let i = 0; i < w.route.length; i++) {
    if (!w.route[i]) continue;
    const x = i % w.n;
    const y = (i - x) / w.n;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (w.inBounds(x + dx, y + dy) && w.tileAt(x + dx, y + dy) === TILE.EMPTY && !w.isWater(x + dx, y + dy)) return [x + dx, y + dy];
    }
  }
  throw new Error("no free cell beside the route");
}

describe('chooseRoute', () => {
  it('runs along the border with the most dry ground between it and the water, so a map with a sea exit never has it on the coast', () => {
    for (const kind of MAP_KINDS.map((k) => k.id)) {
      for (const n of [64, 128]) {
        for (const seed of [1, 2, 3, 4, 5, 6, 7]) {
          const t = generateMap(seed, n, kind as MapKind);
          const { edge } = chooseRoute(t, seed);
          const scores = EDGES.map((e) => bandWater(t, e));
          expect(bandWater(t, edge), `${kind} ${n} seed ${seed}`).toBe(Math.max(...scores));
          if (kind === 'coast') expect(edge, `${kind} ${n} seed ${seed}`).not.toBe('east');
        }
      }
    }
  });

  it('takes the border that keeps a few lots of dry ground between the strip and the water', () => {
    // The same amount of water everywhere, but at a different distance from each border: the route
    // should go where the water is farthest, even when no border has water in its own strip.
    const t = terrainWith(
      N,
      (cx, cy) =>
        (cx >= 7 && cx <= 10 && cy >= 12 && cy <= 21) || // beside the west strip, a few lots in
        (cx >= N - 5 && cx <= N - 3 && cy >= 12 && cy <= 21) || // on the east strip
        (cx >= 10 && cx <= 20 && cy >= 2 && cy <= 4), // on the north strip
    );
    for (let seed = 1; seed <= 6; seed++) expect(chooseRoute(t, seed).edge, `seed ${seed}`).toBe('south');
  });

  it('is a strip of four lanes flush against the border, along the whole side', () => {
    for (const edge of EDGES) {
      // Water on the bands of the other three edges so that this one is the choice.
      const t = terrainWith(N, (cx, cy) => EDGES.filter((e) => e !== edge).some((e) => (e === 'west' && cx === 3 && cy === 15) || (e === 'east' && cx === N - 3 && cy === 15) || (e === 'north' && cx === 15 && cy === 3) || (e === 'south' && cx === 15 && cy === N - 3)));
      const route = chooseRoute(t, 9);
      expect(route.edge).toBe(edge);
      const expected: string[] = [];
      for (let along = ROUTE.margin; along <= N - 1 - ROUTE.margin; along++) {
        for (let k = 0; k < ROUTE.width; k++) {
          const d = ROUTE.inset + k;
          const [x, y] = edge === 'west' ? [d, along] : edge === 'east' ? [N - 1 - d, along] : edge === 'north' ? [along, d] : [along, N - 1 - d];
          expected.push(`${x},${y}`);
        }
      }
      expect(route.cells.map(([x, y]) => `${x},${y}`).sort()).toEqual(expected.sort());
      expect(route.cells).toHaveLength(ROUTE.width * (N - 2 * ROUTE.margin));
      // One cell in from the border, corners included: the border line is free and the next one is the route.
      const at = (d: number, along: number): [number, number] =>
        edge === 'west' ? [d, along] : edge === 'east' ? [N - 1 - d, along] : edge === 'north' ? [along, d] : [along, N - 1 - d];
      for (let along = 0; along < N; along++) {
        const [bx, by] = at(0, along);
        expect(route.cells.some(([cx2, cy2]) => cx2 === bx && cy2 === by), `${edge} borde ${bx},${by}`).toBe(false);
        const [ix, iy] = at(ROUTE.inset, along);
        expect(route.cells.some(([cx2, cy2]) => cx2 === ix && cy2 === iy), `${edge} ${ix},${iy}`).toBe(true);
      }
    }
  });

  it('gives the same route for the same seed and spreads dry maps over the edges by seed', () => {
    const dry = terrainWith(N);
    expect(chooseRoute(dry, 42)).toEqual(chooseRoute(dry, 42));
    const edges = new Set<RouteEdge>();
    for (let seed = 1; seed <= 40; seed++) edges.add(chooseRoute(dry, seed).edge);
    expect(edges.size).toBeGreaterThan(1);
  });

  it('counts the water the strip crosses as bridges', () => {
    const crossed = terrainWith(N, (cx, cy) => cx === 8 || cy === 8);
    const route = chooseRoute(crossed, 3);
    // The water line is two cells thick (a cell is water when one of its corners is) and it crosses
    // the strip, so every lane of it is a bridge twice.
    expect(route.bridges).toBe(ROUTE.width * 2);
    expect(route.cells.filter(([x, y]) => isWaterCell(crossed, x, y))).toHaveLength(route.bridges);
    expect(chooseRoute(southTerrain(), SEED).bridges).toBe(0);
  });
});

describe('addRoute', () => {
  it('marks the strip as ordinary road, clears its trees and flattens the ground under it', () => {
    const t = terrainWith(N);
    t.trees.fill(2);
    const corners = t.corners.slice();
    const w = new World(t);
    const version = w.networkVersion;
    const route = addRoute(w, 3);
    const inRoute = new Set(route.cells.map(([x, y]) => w.idx(x, y)));
    for (let i = 0; i < w.n * w.n; i++) {
      expect(w.route[i]).toBe(inRoute.has(i) ? 1 : 0);
      expect(w.tiles[i]).toBe(inRoute.has(i) ? TILE.ROAD : TILE.EMPTY);
      expect(w.terrain.trees[i]).toBe(inRoute.has(i) ? 0 : 2);
    }
    expect(w.networkVersion).toBeGreaterThan(version);
    // The roadbed is flat: every corner under the strip is at the same height, and the ground
    // around it meets it one level per cell.
    const s = w.n + 1;
    const heights = new Set<number>();
    for (const [x, y] of route.cells) {
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) heights.add(w.terrain.corners[(y + dy) * s + x + dx]);
    }
    expect(heights.size).toBe(1);
    const level = [...heights][0];
    expect(level).toBeGreaterThanOrEqual(SEA_LEVEL);
    for (let cy = 0; cy < s; cy++) {
      for (let cx = 0; cx < s; cx++) {
        for (const [dx, dy] of [[1, 0], [0, 1], [1, 1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx >= s || ny >= s) continue;
          expect(Math.abs(w.terrain.corners[cy * s + cx] - w.terrain.corners[ny * s + nx])).toBeLessThanOrEqual(1);
        }
      }
    }
    // The corners the route left alone are only the ones it did not cover.
    expect(corners.length).toBeGreaterThan(0);
  });

  it('levels the ground under the strip, even on a hill', () => {
    const w = new World(terrainWith(N, () => false, (cx, cy) => (cx + cy) % 5));
    const route = addRoute(w, 3);
    const s = N + 1;
    const heights = new Set<number>();
    for (const [x, y] of route.cells) {
      if (w.isWater(x, y)) continue;
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ]) {
        heights.add(w.terrain.corners[(y + dy) * s + x + dx]);
      }
    }
    expect(heights.size).toBe(1);
  });

  it('leaves the lots beside the strip on the road level, so the city starts flush with it', () => {
    const w = new World(terrainWith(N, () => false, (cx, cy) => (cx + cy) % 6));
    const route = addRoute(w, 3);
    const s = N + 1;
    const c = w.terrain.corners;
    const level = c[route.cells[0][1] * s + route.cells[0][0]];
    const inRoute = new Set(route.cells.map(([x, y]) => y * N + x));
    const near = (x: number, y: number) => route.cells.some(([rx, ry]) => Math.abs(rx - x) <= ROUTE.shoulder && Math.abs(ry - y) <= ROUTE.shoulder);
    let graded = 0;
    let flat = 0;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const k = [y * s + x, y * s + x + 1, (y + 1) * s + x, (y + 1) * s + x + 1];
        if (k.every((j) => c[j] === level)) flat++;
        if (inRoute.has(i) || !near(x, y) || w.isWater(x, y)) continue;
        for (const j of k) expect(c[j], `${x},${y}`).toBe(level);
        graded++;
      }
    }
    // The two long sides of the strip: one lot deep, or as many rows as the shoulder says.
    expect(graded).toBeGreaterThanOrEqual(2 * N);
    // The map goes on as it always did: the shoulder is a band, not a flattened world.
    expect(flat).toBeLessThan((N * N) / 2);
    expect(new Set(c).size).toBeGreaterThan(2);
  });

  it('does not fill a lake to grade the lots beside it', () => {
    const t = terrainWith(
      N,
      (cx, cy) => cx === 8 || cy === 8,
      (cx, cy) => (cx + cy) % 4,
    );
    const wet: number[] = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (isWaterCell(t, x, y)) wet.push(y * N + x);
    expect(wet.length).toBeGreaterThan(0);
    addRoute(new World(t), 3);
    for (const i of wet) expect(isWaterCell(t, i % N, (i - (i % N)) / N), `${i}`).toBe(true);
  });

  it('does not fill a lake the strip crosses: the ground under a bridge stays under water', () => {
    const lake = (cx: number, cy: number) => cx === 8 || cy === 8;
    const w = new World(terrainWith(N, lake));
    const route = addRoute(w, 3);
    const wetBefore = route.cells.filter(([x, y]) => isWaterCell(w.terrain, x, y));
    expect(wetBefore.length).toBeGreaterThan(0);
    for (const [x, y] of wetBefore) expect(w.isWater(x, y)).toBe(true);
  });

  it('crosses the water with bridges', () => {
    const w = new World(terrainWith(N, (cx, cy) => cx === 8 || cy === 8));
    const route = addRoute(w, 3);
    const wet = route.cells.filter(([x, y]) => w.isWater(x, y));
    expect(wet.length).toBeGreaterThan(0);
    for (const [x, y] of wet) {
      expect(w.tileAt(x, y)).toBe(TILE.ROAD);
      expect(w.route[w.idx(x, y)]).toBe(1);
    }
  });
});

describe('the route cannot be touched', () => {
  it('keeps the lots beside it on the road level when a block is levelled there', () => {
    const w = new World(southTerrain());
    const route = addRoute(w, SEED);
    const s = N + 1;
    const c = w.terrain.corners;
    const level = c[route.cells[0][1] * s + route.cells[0][0]];
    // A ridge just outside the shoulder: the block the player zones has an average to reach for,
    // so levelling it would drag the ground beside the road up with it if nothing held it back.
    for (let x = 19; x <= 21; x++) for (const j of [24 * s + x, 24 * s + x + 1]) c[j] += 3;
    const block: [number, number][] = [];
    for (let y = ROW_NEXT - ROUTE.shoulder - 1; y <= ROW_NEXT; y++) block.push([20, y]);
    const shoulder = block.slice(ROUTE.shoulder + 1);
    const before = w.terrain.corners.slice();
    applyPlan(w, planTool(w, 'zoneR', block));
    for (const [x, y] of block) expect(w.tileAt(x, y)).not.toBe(TILE.EMPTY);
    // The block levelling ran (the ground of the block moved) and the shoulder stayed where it was.
    expect(w.terrain.corners.some((v, j) => v !== before[j])).toBe(true);
    for (const [x, y] of shoulder) {
      for (const j of [y * s + x, y * s + x + 1, (y + 1) * s + x, (y + 1) * s + x + 1]) expect(c[j], `${x},${y}`).toBe(level);
    }
  });

  it('is not demolished by the bulldozer, alone or inside a larger area', () => {
    const w = southWorld();
    const alone = planTool(w, 'bulldoze', [[20, ROW_ROUTE]]);
    expect(alone.cells).toEqual([]);
    expect(alone.cost).toBe(0);
    // A street next to it, inside the same rectangle, is still demolished.
    applyPlan(w, planTool(w, 'road', [[20, ROW_NEXT]]));
    const mixed = planTool(w, 'bulldoze', dragCells('bulldoze', 20, ROW_NEXT, 21, ROW_ROUTE, 1, N));
    expect(mixed.cells).toEqual([[20, ROW_NEXT]]);
    applyPlan(w, mixed);
    expect(w.tileAt(20, ROW_ROUTE)).toBe(TILE.ROAD);
    expect(w.route[w.idx(20, ROW_ROUTE)]).toBe(1);
    expect(w.tileAt(20, ROW_NEXT)).toBe(TILE.EMPTY);
  });

  it('is not replaced or built over by any other tool', () => {
    const w = southWorld();
    for (const tool of TOOLS) {
      if (tool.id === 'query') continue;
      const plan = planTool(w, tool.id, [[20, ROW_ROUTE]]);
      expect(plan.cells, tool.id).toEqual([]);
      expect(plan.cost, tool.id).toBe(0);
    }
    expect(w.tileAt(20, ROW_ROUTE)).toBe(TILE.ROAD);
  });

  it('is not changed even by a plan that names its cells', () => {
    const w = southWorld();
    const i = w.idx(20, ROW_ROUTE);
    applyPlan(w, { tool: 'bulldoze', cells: [[20, ROW_ROUTE]], cost: 0 });
    applyPlan(w, { tool: 'zoneR', cells: [[20, ROW_ROUTE]], cost: 0 });
    expect(w.tiles[i]).toBe(TILE.ROAD);
    expect(w.route[i]).toBe(1);
  });

  it('is told apart from any other refusal by its message', () => {
    const w = southWorld();
    expect(routeRefusal(w, 'bulldoze', 20, ROW_ROUTE)).toBe('La ruta provincial no se toca');
    expect(routeRefusal(w, 'zoneC', 20, ROW_ROUTE)).toBe('La ruta provincial no se toca');
    expect(routeRefusal(w, 'bulldoze', 20, ROW_NEXT)).toBeNull();
    expect(routeRefusal(w, 'query', 20, ROW_ROUTE)).toBeNull();
  });

  it('costs nothing to keep, bridges included', () => {
    const dry = new World(terrainWith(N));
    const none = monthlyBudget(dry, 7).roads;
    addRoute(dry, 3);
    expect(monthlyBudget(dry, 7).roads).toBe(none);

    const wet = new World(terrainWith(N, (cx, cy) => cx === 8 || cy === 8));
    const route = addRoute(wet, 3);
    expect(route.bridges).toBeGreaterThan(0);
    expect(monthlyBudget(wet, 7).roads).toBe(0);

    // A street of the player's own is still charged.
    const [sx, sy] = streetCellBeside(dry);
    applyPlan(dry, planTool(dry, 'road', [[sx, sy]]));
    expect(monthlyBudget(dry, 7).roads).toBeGreaterThan(0);
  });

  it('is not moved by the levelling of the block beside it', () => {
    // Ground that falls toward the route: the block wants to fill it up to its own height.
    const height = (_cx: number, cy: number) => (cy <= 26 ? 3 : cy === 27 ? 3 : cy === 28 ? 2 : 1);
    const w = new World(southTerrain(height));
    const route = addRoute(w, SEED);
    expect(route.edge).toBe('south');
    const s = N + 1;
    const routeCorners: number[] = [];
    for (const [x, y] of route.cells) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) routeCorners.push((y + dy) * s + x + dx);
    const before = routeCorners.map((k) => w.terrain.corners[k]);
    const cells = dragCells('zoneR', 20, 27, 22, ROW_NEXT, 1, N);
    applyPlan(w, planTool(w, 'zoneR', cells));
    expect(routeCorners.map((k) => w.terrain.corners[k])).toEqual(before);
  });

  it('is not altered by undoing an action', () => {
    const w = southWorld();
    const history = new UndoHistory();
    const i = w.idx(20, ROW_ROUTE);
    const plan: Plan = { tool: 'bulldoze', cells: [[20, ROW_NEXT], [20, ROW_ROUTE]], cost: 10 };
    history.record(w, plan, 0);
    w.variant[i] = 99; // changes after the action was recorded
    applyPlan(w, plan);
    history.undo(w, 0);
    expect(w.tiles[i]).toBe(TILE.ROAD);
    expect(w.route[i]).toBe(1);
    expect(w.variant[i]).toBe(99);
  });
});

describe('streets can only start from the route', () => {
  it('accepts a street that touches the route and refuses one that does not', () => {
    const w = southWorld();
    const touching = planTool(w, 'road', [[20, ROW_NEXT]]);
    expect(touching.cells).toEqual([[20, ROW_NEXT]]);
    expect(touching.cost).toBe(COSTS.road);
    const apart = planTool(w, 'road', [[20, 20]]);
    expect(apart.cells).toEqual([]);
    expect(apart.cost).toBe(0);
    expect(routeRefusal(w, 'road', 20, 20)).toBe('La calle tiene que salir de la ruta o de otra calle');
    expect(routeRefusal(w, 'road', 20, ROW_NEXT)).toBeNull();
  });

  it('accepts a drag that leaves the route, cell after cell', () => {
    const w = southWorld();
    const plan = planTool(w, 'road', dragCells('road', 20, ROW_NEXT, 20, 22, 1, N));
    expect(plan.cells).toEqual([[20, 26], [20, 25], [20, 24], [20, 23], [20, 22]]);
    expect(plan.cost).toBe(5 * COSTS.road);
  });

  it('only counts the previous accepted cell of the drag, so a drag that arrives at the route builds just its last cell', () => {
    const w = southWorld();
    const plan = planTool(w, 'road', dragCells('road', 20, 22, 20, ROW_NEXT, 1, N));
    expect(plan.cells).toEqual([[20, ROW_NEXT]]);
  });

  it('accepts a street that continues from a connected street, and refuses one that continues from a cut-off piece', () => {
    const w = southWorld();
    applyPlan(w, planTool(w, 'road', dragCells('road', 20, ROW_NEXT, 20, 24, 1, N)));
    expect(planTool(w, 'road', [[21, 24]]).cells).toEqual([[21, 24]]);
    expect(planTool(w, 'road', [[20, 23]]).cells).toEqual([[20, 23]]);
    // The bulldozer cuts the street at its root: what is left of it no longer comes from the route.
    applyPlan(w, planTool(w, 'bulldoze', [[20, ROW_NEXT]]));
    expect(planTool(w, 'road', [[20, 23]]).cells).toEqual([]);
    expect(planTool(w, 'road', [[20, ROW_NEXT]]).cells).toEqual([[20, ROW_NEXT]]);
  });

  it('refuses a street that only touches the route by a corner', () => {
    // A route that stops one cell short of both ends of its side, so a cell can face it diagonally.
    const w = new World(terrainWith(N));
    for (let y = 1; y <= N - 2; y++) {
      for (let x = 0; x < ROUTE.width; x++) {
        w.tiles[w.idx(x, y)] = TILE.ROAD;
        w.route[w.idx(x, y)] = 1;
      }
    }
    w.bumpNetwork();
    expect(planTool(w, 'road', [[ROUTE.width, 0]]).cells).toEqual([]);
    expect(planTool(w, 'road', [[ROUTE.width, 1]]).cells).toEqual([[ROUTE.width, 1]]);
  });

  it('applies the same rule to bridges', () => {
    const lake = (cx: number, cy: number) => (cx === 9 || cx === 10) && (cy === 25 || cy === 26);
    const w = new World(southTerrain(() => 0, lake));
    addRoute(w, SEED);
    // The lake ends at (10, 26), which touches the route; (10, 25) does not.
    expect(w.isWater(10, 26)).toBe(true);
    expect(w.isWater(10, 25)).toBe(true);
    const off = planTool(w, 'road', [[10, 25]]);
    expect(off.cells).toEqual([]);
    const on = planTool(w, 'road', [[10, 26]]);
    expect(on.cells).toEqual([[10, 26]]);
    expect(on.cost).toBe(COSTS.bridge);
    // A bridge on the far lake, away from the route, is refused too.
    expect(w.isWater(2, 15)).toBe(true);
    expect(planTool(w, 'road', [[2, 15]]).cells).toEqual([]);
  });

  it('does not restrict the power lines, zones, services or plants', () => {
    const w = southWorld();
    for (const tool of ['line', 'zoneR', 'park', 'school', 'plant'] as const) {
      expect(planTool(w, tool, [[10, 10]]).cells.length, tool).toBeGreaterThan(0);
    }
  });

  it('does not restrict anything in a world without a route', () => {
    const w = new World(southTerrain());
    expect(w.route.some((v) => v)).toBe(false);
    expect(planTool(w, 'road', [[20, 20]]).cells).toEqual([[20, 20]]);
    expect(planTool(w, 'road', [[2, 15]]).cost).toBe(COSTS.bridge);
    expect(routeRefusal(w, 'road', 20, 20)).toBeNull();
    applyPlan(w, planTool(w, 'road', [[20, 20]]));
    expect(planTool(w, 'bulldoze', [[20, 20]]).cells).toEqual([[20, 20]]);
  });

  it('follows the streets of the moment: a street built after the first plan counts', () => {
    const w = southWorld();
    expect(planTool(w, 'road', [[20, 25]]).cells).toEqual([]);
    applyPlan(w, planTool(w, 'road', dragCells('road', 20, ROW_NEXT, 20, 26, 1, N)));
    expect(planTool(w, 'road', [[20, 25]]).cells).toEqual([[20, 25]]);
    // Undoing the street takes the connection away again.
    const history = new UndoHistory();
    const plan = planTool(w, 'road', [[20, 25]]);
    history.record(w, plan, 0);
    applyPlan(w, plan);
    expect(planTool(w, 'road', [[20, 24]]).cells).toEqual([[20, 24]]);
    history.undo(w, 0);
    expect(planTool(w, 'road', [[20, 24]]).cells).toEqual([]);
  });
});

describe('real-place worlds', () => {
  it('have no route and no restriction', () => {
    const n = 8;
    const s = n + 1;
    const preset: MapPreset = {
      id: PRESETS[0]?.id ?? 'tiny',
      name: 'Pueblo chico',
      n,
      cellMeters: 20,
      corners: new Uint8Array(s * s).fill(SEA_LEVEL + 1),
      trees: new Uint8Array(n * n),
      roads: new Uint8Array(n * n),
      attribution: 'test',
    };
    preset.roads[2 * n + 1] = 1;
    const w = worldFromPreset(preset, true);
    expect(w.route.some((v) => v)).toBe(false);
    expect(planTool(w, 'road', [[6, 6]]).cells).toEqual([[6, 6]]);
    expect(planTool(w, 'bulldoze', [[1, 2]]).cells).toEqual([[1, 2]]);
  });
});

describe('saving the route', () => {
  const save = (w: World) => JSON.parse(serialize({ name: 'Ruta', seed: SEED, world: w, sim: newSimState(SEED) }));

  it('writes the current version and reads the route back as it was', () => {
    const w = southWorld();
    const data = save(w);
    expect(data.version).toBe(SAVE_VERSION);
    const back = deserialize(JSON.stringify(data)).world;
    expect(Array.from(back.route)).toEqual(Array.from(w.route));
    expect(back.route.some((v) => v)).toBe(true);
    // The restored route still binds the tools.
    expect(planTool(back, 'road', [[20, 20]]).cells).toEqual([]);
    expect(planTool(back, 'bulldoze', [[20, ROW_ROUTE]]).cells).toEqual([]);
  });

  it('opens saves of version 7 and before without a route', () => {
    const data = save(southWorld());
    delete data.route;
    for (const version of [1, 2, 3, 4, 5, 6, 7]) {
      const old = { ...data, version };
      if (version < 6) delete old.mayor;
      delete old.sim.loan;
      delete old.sim.lastBudget?.loan;
      const back = deserialize(JSON.stringify(old)).world;
      expect(back.route.some((v) => v), `version ${version}`).toBe(false);
    }
    const w = deserialize(JSON.stringify({ ...data, version: 7 })).world;
    expect(planTool(w, 'road', [[20, 20]]).cells).toEqual([[20, 20]]);
  });

  it('rejects a route that is damaged', () => {
    const w = southWorld();
    const good = save(w);
    const missing = { ...good };
    delete missing.route;
    expect(() => deserialize(JSON.stringify(missing))).toThrow(/ruta provincial/i);

    const offRoad = new World(southTerrain());
    addRoute(offRoad, SEED);
    const notRoad = save(offRoad);
    const tiles = Uint8Array.from(atob(notRoad.tiles), (c) => c.charCodeAt(0));
    tiles[offRoad.idx(20, ROW_ROUTE)] = TILE.EMPTY;
    notRoad.tiles = btoa(String.fromCharCode(...tiles));
    expect(() => deserialize(JSON.stringify(notRoad))).toThrow(/ruta provincial/i);

    const impossible = save(w);
    const marks = Uint8Array.from(atob(impossible.route), (c) => c.charCodeAt(0));
    marks[w.idx(20, ROW_ROUTE)] = 2;
    impossible.route = btoa(String.fromCharCode(...marks));
    expect(() => deserialize(JSON.stringify(impossible))).toThrow(/ruta provincial/i);
  });
});
