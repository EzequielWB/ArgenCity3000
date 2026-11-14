import { PLANT_SIZE } from '../config';
import { fromView, project, unproject, type Rotation } from '../core/iso';
import { MAX_HEIGHT, SEA_LEVEL, cornerAt } from '../world/terrain';
import { TILE, World, serviceOf } from '../world/world';

export type Pt = [number, number];

/** Heights of a view cell's corners in view order: top, right, bottom, left. */
export function viewCornerHeights(w: World, vx: number, vy: number, rot: Rotation): [number, number, number, number] {
  const s = w.n + 1;
  const h = (cx: number, cy: number) => {
    const [x, y] = fromView(cx, cy, rot, s);
    return cornerAt(w.terrain, x, y);
  };
  return [h(vx, vy), h(vx + 1, vy), h(vx + 1, vy + 1), h(vx, vy + 1)];
}

/** True when the cell is drawn as a flat platform (buildings, plants) instead of following the terrain. */
export function isPlatform(w: World, i: number): boolean {
  const t = w.tiles[i];
  return t === TILE.PLANT || serviceOf(t) !== null || (w.level[i] > 0 && t >= TILE.R && t <= TILE.I);
}

/** How high a bridge deck rides above the sea, in levels. */
export const DECK_HEIGHT = 0.75;

/**
 * Heights used to draw the cell's surface: water is flat at sea level, building lots are
 * levelled at their highest corner, everything else follows the terrain. A bridge is one flat
 * deck, the whole span at the same height: a deck that slopes leaves the water showing between
 * its cells, and its sides are closed by the renderer with the faces of the deck.
 */
export function surfaceHeights(w: World, vx: number, vy: number, rot: Rotation): [number, number, number, number] {
  const hs = viewCornerHeights(w, vx, vy, rot);
  const [x, y] = fromView(vx, vy, rot, w.n);
  const i = w.idx(x, y);
  if (w.isWater(x, y)) {
    const deck = w.tiles[i] === TILE.ROAD ? SEA_LEVEL + DECK_HEIGHT : SEA_LEVEL;
    return [deck, deck, deck, deck];
  }
  if (w.tiles[i] === TILE.PLANT) {
    const p = w.plantAt(x, y);
    if (p) {
      const m = plantHeight(w, p.x, p.y);
      return [m, m, m, m];
    }
  }
  if (isPlatform(w, i)) {
    const m = Math.max(...hs);
    return [m, m, m, m];
  }
  return hs;
}

/** A power plant sits on one platform levelled at the highest corner of its whole footprint. */
export function plantHeight(w: World, px: number, py: number): number {
  let m = 0;
  for (let y = py; y <= py + PLANT_SIZE; y++) for (let x = px; x <= px + PLANT_SIZE; x++) m = Math.max(m, cornerAt(w.terrain, x, y));
  return m;
}

/** Screen corners (relative to the map origin) of a view cell's surface: top, right, bottom, left. */
export function cellScreenCorners(w: World, vx: number, vy: number, rot: Rotation): [Pt, Pt, Pt, Pt] {
  const [ht, hr, hb, hl] = surfaceHeights(w, vx, vy, rot);
  return [project(vx, vy, ht), project(vx + 1, vy, hr), project(vx + 1, vy + 1, hb), project(vx, vy + 1, hl)];
}

export function pointInPolygon(px: number, py: number, poly: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Picks the world cell whose visible surface is under the screen point (relative to the
 * map origin). Among all cells whose surface contains the point, the front-most one wins,
 * because it is drawn last. Returns null outside the map.
 */
export function pickCell(w: World, sx: number, sy: number, rot: Rotation): [number, number] | null {
  let best: [number, number] | null = null;
  let bestDepth = -1;
  const tried = new Set<number>();
  for (let h = MAX_HEIGHT + 1; h >= SEA_LEVEL - 1; h--) {
    const [px, py] = unproject(sx, sy, h);
    const cx = Math.floor(px);
    const cy = Math.floor(py);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const vx = cx + dx;
        const vy = cy + dy;
        if (vx < 0 || vy < 0 || vx >= w.n || vy >= w.n) continue;
        const key = vy * w.n + vx;
        if (tried.has(key)) continue;
        tried.add(key);
        if (vx + vy <= bestDepth) continue;
        if (pointInPolygon(sx, sy, cellScreenCorners(w, vx, vy, rot))) {
          best = [vx, vy];
          bestDepth = vx + vy;
        }
      }
    }
  }
  return best ? fromView(best[0], best[1], rot, w.n) : null;
}
