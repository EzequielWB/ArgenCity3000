import { PLANT_SIZE } from '../config';
import { fromView, project, unproject, type Rotation } from '../core/iso';
import { MAX_HEIGHT, SEA_LEVEL, cornerAt } from '../world/terrain';
import { TILE, World, hubOf, serviceOf } from '../world/world';

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
  return t === TILE.PLANT || t === TILE.UNIQUE || serviceOf(t) !== null || hubOf(t) !== null || (w.level[i] > 0 && t >= TILE.R && t <= TILE.I);
}

/** Least a bridge deck rides above the sea, in levels, when its banks are lower than that. */
export const DECK_HEIGHT = 0.75;

const decks = new WeakMap<World, { version: number; heights: Map<number, number> }>();

/** True on a street cell over water. */
function isBridge(w: World, x: number, y: number): boolean {
  return w.inBounds(x, y) && w.tiles[w.idx(x, y)] === TILE.ROAD && w.isWater(x, y);
}

/**
 * Height of the deck a bridge cell belongs to: the whole span rides at the height of the higher
 * bank, so the deck meets the land at its ends instead of hanging above one of them, and never
 * dips below its clearance over the water. Kept until the street network changes.
 */
export function bridgeDeckHeight(w: World, x: number, y: number): number {
  let cache = decks.get(w);
  if (!cache || cache.version !== w.networkVersion) {
    cache = { version: w.networkVersion, heights: new Map() };
    decks.set(w, cache);
  }
  const i = w.idx(x, y);
  const hit = cache.heights.get(i);
  if (hit !== undefined) return hit;

  let deck = SEA_LEVEL + DECK_HEIGHT;
  const t = w.terrain;
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as [number, number][]) {
    // Walk the span to its end, and land the deck on the bank it finds there.
    let cx = x + dx;
    let cy = y + dy;
    let steps = 0;
    while (isBridge(w, cx, cy) && steps++ < 1024) {
      cx += dx;
      cy += dy;
    }
    if (!w.inBounds(cx, cy) || w.isWater(cx, cy)) continue;
    // The two corners of the bank cell on the edge the bridge touches.
    const edge =
      dx > 0
        ? [cornerAt(t, cx, cy), cornerAt(t, cx, cy + 1)]
        : dx < 0
          ? [cornerAt(t, cx + 1, cy), cornerAt(t, cx + 1, cy + 1)]
          : dy > 0
            ? [cornerAt(t, cx, cy), cornerAt(t, cx + 1, cy)]
            : [cornerAt(t, cx, cy + 1), cornerAt(t, cx + 1, cy + 1)];
    deck = Math.max(deck, (edge[0] + edge[1]) / 2);
  }
  cache.heights.set(i, deck);
  return deck;
}

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
    const deck = w.tiles[i] === TILE.ROAD ? bridgeDeckHeight(w, x, y) : SEA_LEVEL;
    return [deck, deck, deck, deck];
  }
  if (w.tiles[i] === TILE.ROAD) {
    // The street cell where a bridge meets the land is the rise up to the deck: the two corners
    // of its side facing the water go up to the deck, and the road climbs there instead of
    // stepping off it. The corners on the other side do not move, so the ground around it does
    // not shift and its neighbours keep meeting it.
    const n = w.n;
    const out: [number, number, number, number] = [hs[0], hs[1], hs[2], hs[3]];
    const rise = (nvx: number, nvy: number, c1: number, c2: number): void => {
      if (nvx < 0 || nvy < 0 || nvx >= n || nvy >= n) return;
      const [bx, by] = fromView(nvx, nvy, rot, n);
      if (w.tiles[w.idx(bx, by)] !== TILE.ROAD || !w.isWater(bx, by)) return;
      const deck = bridgeDeckHeight(w, bx, by);
      out[c1] = Math.max(out[c1], deck);
      out[c2] = Math.max(out[c2], deck);
    };
    rise(vx, vy - 1, 0, 1);
    rise(vx + 1, vy, 1, 2);
    rise(vx, vy + 1, 3, 2);
    rise(vx - 1, vy, 0, 3);
    return out;
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

/** A piece of an airport or a harbour sits on a platform levelled at the highest corner of its whole footprint. */
export function hubHeight(w: World, px: number, py: number, fw: number, fh: number): number {
  let m = 0;
  for (let y = py; y <= py + fh; y++) for (let x = px; x <= px + fw; x++) m = Math.max(m, cornerAt(w.terrain, x, y));
  return m;
}

/**
 * El campo (lote, silo, feria) se apoya en el suelo de la esquina donde ancla su sprite: la esquina de
 * atrás del recuadro. Las piezas de la ciudad se dibujan sobre suelo nivelado, donde el máximo del
 * footprint y esta esquina coinciden; el campo no nivela su suelo, así que en una pendiente que sube
 * hacia adelante el máximo lo haría flotar y las celdas de adelante taparían su base.
 */
export function padHeight(w: World, px: number, py: number, _size: number): number {
  return cornerAt(w.terrain, px, py);
}

/**
 * A unique building sits on the highest corner of its footprint like a plant, but never below the
 * water: the puente stands over the river, whose bed is a level under the surface.
 */
export function uniqueHeight(w: World, px: number, py: number, fw: number, fh: number): number {
  return Math.max(SEA_LEVEL, hubHeight(w, px, py, fw, fh));
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
