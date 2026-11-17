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
import { TILE, World } from '../src/world/world';

declare const document: any;

/** A block of streets with a plaza in the middle. */
function city(): World {
  const n = 18;
  const world = new World(generateTerrain(7, n));
  const plan = (tool: any, ax: number, ay: number, bx = ax, by = ay) =>
    applyPlan(world, planTool(world, tool, dragCells(tool, ax, ay, bx, by, 1, n)));
  plan('road', 2, 5, 15, 5);
  plan('road', 2, 10, 15, 10);
  plan('road', 5, 2, 5, 14);
  plan('road', 11, 2, 11, 14);
  plan('roadPaved', 12, 5, 15, 5);
  // A bus depot: 2x2, with the line the planner hands out on its own.
  plan('bus', 12, 6);
  // One coal plant on the free corner, to see it stand next to the streets.
  plan('plant', 9, 12);
  // An airport of two pieces: they are painted as one facility, so the seam has to disappear here.
  plan('airport', 2, 12);
  plan('airport', 5, 12);
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
  return world;
}

for (const el of Array.from(document.querySelectorAll('canvas[data-city]')) as any[]) {
  const world = city();
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
  const top = Math.round(Math.min(...corners.map((c) => c[1]))) - 80;
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
}
