/**
 * Renders a piece of a real city through the game's own renderer, so the street and the plaza can be
 * judged where they live and not only as loose sprites. The board asks for the families it wants
 * with the same query parameter the game reads: open `arte.html?pixel=todo`.
 */
import { DIRT } from '../src/config';
import { CHUNK_PAD } from '../src/render/chunks';
import { MapRenderer } from '../src/render/mapRenderer';
import { generateTerrain } from '../src/world/terrain';
import { applyPlan, dragCells, planTool } from '../src/world/tools';
import { Traffic, drawTraffic } from '../src/render/traffic';
import { Vessels, drawBoats, drawPlanes } from '../src/render/vessels';
import { TILE, World } from '../src/world/world';

declare const document: any;

/** A block of streets with a plaza in the middle, and the plans the tools turned down. */
function city(): { world: World; refused: string[] } {
  const n = 18;
  const world = new World(generateTerrain(7, n));
  // A plan the tools refuse (water, a taken lot, no street) is a silent no-op, and a sheet that is missing
  // a building looks like a bug in the art: the refusals are said out loud in the title.
  const refused: string[] = [];
  const plan = (tool: any, ax: number, ay: number, bx = ax, by = ay) => {
    const plan = planTool(world, tool, dragCells(tool, ax, ay, bx, by, 1, n));
    if (plan.cells.length === 0) refused.push(`${tool}@${ax},${ay}`);
    applyPlan(world, plan);
  };
  plan('road', 2, 5, 15, 5);
  plan('road', 2, 10, 15, 10);
  // The avenue stops a block short of the airport: a road through the ports would cut the two pieces
  // of the airport apart, which is the seam this sheet is about.
  plan('road', 5, 2, 5, 11);
  plan('road', 11, 2, 11, 14);
  plan('roadPaved', 12, 5, 15, 5);
  // A bus depot: 2x2, with the line the planner hands out on its own.
  plan('bus', 12, 6);
  // One coal plant on the free corner, to see it stand next to the streets.
  plan('plant', 9, 12);
  // An airport of two pieces: they are painted as one facility, so the seam has to disappear here.
  plan('airport', 2, 12);
  plan('airport', 5, 12);
  // A run of each quality, side by side: the wooden line every three lots, the concrete one every five.
  plan('line', 15, 2, 15, 9);
  plan('lineConcrete', 16, 2, 16, 9);
  // One of each service along the avenue, to see the six in the street they belong to. The hospital and
  // the university take 3x3 lots, so they go on the corners where a block fits.
  plan('school', 6, 2);
  plan('clinic', 7, 2);
  plan('police', 8, 2);
  plan('fire', 9, 2);
  plan('hospital', 2, 2);
  plan('university', 2, 6);
  // The plaza is set straight on the grid: the tool checks road access and would leave a fringe.
  for (let y = 7; y <= 9; y++) for (let x = 7; x <= 9; x++) world.tiles[y * n + x] = TILE.PARK;
  // The dirt street is set on the grid after every plan: the sheet is about the look, not the rules,
  // and a later plan recomputes the quality of the cells around the ones it touches.
  for (let x = 2; x <= 15; x++) world.roadTier[10 * n + x] = DIRT;
  // A plaza on a slope reads as broken tiles, so the block is levelled: this is a sheet to judge the
  // art, not a place to study relief.
  const level = world.terrain.corners[2 * (n + 1) + 2] + 1;
  for (let y = 0; y <= n; y++) {
    for (let x = 0; x <= n; x++) world.terrain.corners[y * (n + 1) + x] = level;
  }
  return { world, refused };
}

for (const el of Array.from(document.querySelectorAll('canvas[data-city]')) as any[]) {
  const { world, refused } = city();
  const map = new MapRenderer(world);
  // The band analysis (which is what decides the quality of every street) is built on a redraw.
  map.redrawAll();
  const view = { x0: 0, y0: 0, x1: map.width, y1: map.height };
  // The crop covers the block of streets, and the plaza cells are checked to be inside it.
  let ax = 2;
  let ay = 2;
  let bx = 15;
  let by = 14;
  let parks = 0;
  world.tiles.forEach((t: number, i: number) => {
    if (t !== TILE.PARK) return;
    parks++;
    const x = i % world.n;
    const y = Math.floor(i / world.n);
    ax = Math.min(ax, x);
    ay = Math.min(ay, y);
    bx = Math.max(bx, x);
    by = Math.max(by, y);
  });
  if (parks !== 9) document.title = 'ojo: ' + parks + ' celdas de plaza';
  else if (refused.length > 0) document.title = 'sin lugar: ' + refused.join(' ');
  // Chunks are drawn inside a time budget, so keep asking until the whole view is ready. The first
  // pass is not optional: pending() starts at zero because nothing has been looked at yet.
  for (let k = 0; k < 60; k++) {
    map.ensure(view, [map.width / 2, map.height / 2], 600, false);
    if (map.pending() === 0) break;
  }
  // Only the city matters: crop to the cells asked for in data-crop, or to the whole block.
  const m = Number(el.dataset.crop || 0.5);
  const corners = [
    map.toCache(ax - m, ay - m, 0),
    map.toCache(bx + m, ay - m, 0),
    map.toCache(ax - m, by + m, 0),
    map.toCache(bx + m, by + m, 0),
  ];
  const left = Math.round(Math.min(...corners.map((c) => c[0]))) - 24;
  // Room above for the tallest thing in the block: the hospital is 54 px over its lots, plus its block.
  const top = Math.round(Math.min(...corners.map((c) => c[1]))) - 130;
  const right = Math.round(Math.max(...corners.map((c) => c[0]))) + 24;
  const bottom = Math.round(Math.max(...corners.map((c) => c[1]))) + 24;
  const k = Number(el.dataset.k || 2);
  el.width = Math.round((right - left) * k);
  el.height = Math.round((bottom - top) * k);
  const g = el.getContext('2d');
  g.scale(k, k);
  g.translate(-left, -top);
  map.forEachChunk(view, (canvas: any, x0: number, y0: number) => {
    g.drawImage(canvas, x0 - CHUNK_PAD, y0 - CHUNK_PAD);
  });
  // The vehicles on the street, with the renderer's own traffic pass: this is the sheet where they are
  // judged, because a car alone at 8x says little about how it reads among the buildings.
  // Where to put them: a piece of the runway, and a water cell inside the crop.
  const pieces: [number, number][] = [];
  let water: [number, number] | null = null;
  world.tiles.forEach((t: number, i: number) => {
    const x = i % world.n;
    const y = Math.floor(i / world.n);
    if (t === TILE.AIRPORT && ax <= x && x <= bx && ay <= y && y <= by) pieces.push([x, y]);
    if (!water && world.isWater(x, y) && ax - 2 <= x && x <= bx + 2 && ay - 2 <= y && y <= by + 2) water = [x, y];
  });
  const runway = pieces.sort((p, q) => p[1] - q[1] || p[0] - q[0])[0] ?? [ax, ay];
  const traffic = new Traffic(world, 7);
  const street: [number, number, number, number][] = [
    // [cell x, cell y, dx, dy]: a car parked on each heading of the two streets of the block.
    [4, 5, 1, 0],
    [9, 5, -1, 0],
    [12, 5, 1, 0],
    [6, 10, 0, 1],
    [11, 10, 0, -1],
    [3, 10, 1, 0],
  ];
  street.forEach(([x, y, dx, dy], i) => {
    traffic.cars.push({
      id: i,
      x,
      y,
      dx,
      dy,
      t: 0.35 + (i % 3) * 0.2,
      speed: 1,
      kind: i === 2 ? 'taxi' : 'car',
      color: i % 7,
      age: 100,
      life: 200,
    });
  });
  drawTraffic(g, traffic, map, [view.x0, view.y0, view.x1, view.y1]);
  // A plane of the airport and a boat of the port, so the sheet shows them where they live.
  const vessels = new Vessels(world, 3);
  // The facilities of the sheet are not working, so no plane or boat is born by itself: the sheet puts
  // two planes on the runway and a boat on the water, one per quality of drawing, and that is what it shows.
  vessels.planes.set('k1', { x: runway[0], y: runway[1], level: 1, phase: 'takeoff', t: 2, dir: 1, far: 40 });
  vessels.planes.set('k2', { x: runway[0], y: runway[1], level: 5, phase: 'out', t: 6, dir: 1, far: 40 });
  if (water) vessels.boats.set('b1', { x: water[0], y: water[1], dx: 1, dy: 0, t: 0.5, speed: 1, home: water, kind: 'cruise', roam: 20 });
  drawBoats(g, vessels, map, [view.x0, view.y0, view.x1, view.y1]);
  drawPlanes(g, vessels, map, [view.x0, view.y0, view.x1, view.y1]);
}
