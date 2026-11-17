/**
 * The unique buildings. Each kind may stand once in the city, on a footprint that is not rotated
 * (`UNIQUES`), and only where its own rule allows it: the obelisco in a plaza big enough, the
 * calvario on the hill, the puente over water, the teatro in a street the neighbours already value,
 * the estadio next to a boulevard because the crowd has to get there. A monument pays no fixed rent:
 * it adds a share of the tourism of the whole city, with a season of its own (`uniqueBoost`).
 */
import { roadRank, UNIQUES, UNIQUE_BOOST_MAX, UNIQUE_RULES, type UniqueKind } from '../config';
import { TILE, type Unique, type World } from './world';
import { streetNear } from './transport';

export type Cell = [number, number];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The lots a unique anchored (top-left) at (x, y) covers, kept inside the map. */
export function uniqueFootprint(kind: UniqueKind, n: number, x: number, y: number): Cell[] {
  const { w, h } = UNIQUES[kind];
  const fx = clamp(x, 0, n - w);
  const fy = clamp(y, 0, n - h);
  const cells: Cell[] = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) cells.push([fx + dx, fy + dy]);
  return cells;
}

/** The uniques of a kind standing in the city: never more than one is built, but a save may hold an old one. */
export function uniquesOf(w: World, kind: UniqueKind): Unique[] {
  return w.uniques.filter((u) => u.kind === kind);
}

/** The lots around a footprint (the footprint's own lots excluded), each once, for the rules that read the neighbourhood. */
function ringAround(w: World, cells: readonly Cell[], reach: number): number[] {
  const own = new Set(cells.map(([x, y]) => w.idx(x, y)));
  const seen = new Set<number>();
  for (const [cx, cy] of cells) {
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (!w.inBounds(x, y)) continue;
        const i = w.idx(x, y);
        if (!own.has(i)) seen.add(i);
      }
    }
  }
  return [...seen];
}

/** The highest corner of a footprint, in terrain levels: the calvario goes up on the hill. */
function footprintHeight(w: World, cells: readonly Cell[]): number {
  let high = 0;
  for (const [x, y] of cells) high = Math.max(high, w.minMax(x, y)[1]);
  return high;
}

/** Average land value of the lots around a footprint (the footprint's own lots excluded). */
function landValueAround(w: World, cells: readonly Cell[], reach: number): number {
  const ring = ringAround(w, cells, reach);
  if (ring.length === 0) return 0;
  return ring.reduce((sum, i) => sum + w.landValue[i], 0) / ring.length;
}

/** True when a street of at least the given quality runs within `reach` lots (Manhattan) of the footprint. */
function qualityStreetNear(w: World, cells: readonly Cell[], want: number, reach: number): boolean {
  for (const [cx, cy] of cells) {
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > reach) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (!w.inBounds(x, y)) continue;
        const i = w.idx(x, y);
        if (w.tiles[i] === TILE.ROAD && roadRank(w.roadTier[i]) >= want) return true;
      }
    }
  }
  return false;
}

/** True when at least one of the two short ends of the footprint (its piers) reaches dry land. */
function endOnLand(w: World, kind: UniqueKind, cells: readonly Cell[]): boolean {
  const { w: fw, h: fh } = UNIQUES[kind];
  const [x0, y0] = cells[0];
  const land = (x: number, y: number) => w.inBounds(x, y) && !w.isWater(x, y);
  if (fh >= fw) {
    for (let dx = 0; dx < fw; dx++) if (land(x0 + dx, y0 - 1) || land(x0 + dx, y0 + fh)) return true;
    return false;
  }
  for (let dy = 0; dy < fh; dy++) if (land(x0 - 1, y0 + dy) || land(x0 + fw, y0 + dy)) return true;
  return false;
}

/**
 * Why the monument cannot stand on these lots, in words for the player, or null when the place is
 * right. Lots that are merely taken are not a reason given here.
 */
export function uniqueRefusal(w: World, kind: UniqueKind, cells: readonly Cell[]): string | null {
  const { label } = UNIQUES[kind];
  if (uniquesOf(w, kind).length > 0) return `${label}: ya hay uno en la ciudad, y no puede haber más`;
  if (kind === 'puente') {
    if (!cells.every(([x, y]) => w.isWater(x, y))) return `${label}: tiene que ir sobre el agua, de orilla a orilla`;
    if (!endOnLand(w, kind, cells)) return `${label}: una de las dos puntas tiene que llegar a tierra`;
    return null;
  }
  if (cells.some(([x, y]) => w.isWater(x, y))) return `${label}: tiene que estar en tierra`;
  switch (kind) {
    case 'obelisco': {
      const { plazaCells, reach } = UNIQUE_RULES.obelisco;
      const around = ringAround(w, cells, reach).filter((i) => w.tiles[i] === TILE.PARK).length;
      return around >= plazaCells ? null : `${label}: necesita ${plazaCells} lotes de plaza a ${reach} lotes o menos (hay ${around})`;
    }
    case 'calvario': {
      const high = footprintHeight(w, cells);
      return high >= UNIQUE_RULES.calvario.height ? null : `${label}: tiene que ir en lo alto de una loma de ${UNIQUE_RULES.calvario.height} niveles o más`;
    }
    case 'teatro': {
      const { value, reach } = UNIQUE_RULES.teatro;
      const around = landValueAround(w, cells, reach);
      return around >= value ? null : `${label}: el barrio tiene que estar bien: valor del suelo de ${value} o más alrededor (hay ${Math.round(around)})`;
    }
    case 'estadio': {
      const { boulevard } = UNIQUE_RULES.estadio;
      // Tier 2 is the bulevar (see `ROAD_TIERS`): the crowd needs the street of most capacity.
      const want = roadRank(2);
      return qualityStreetNear(w, cells, want, boulevard) ? null : `${label}: necesita un bulevar a ${boulevard} lotes o menos`;
    }
  }
  return null;
}

/**
 * Whether a monument is worth visiting: a street has to reach it, or nobody gets there. It asks for
 * no light and gives none: it is a building of stone and steel, not a service.
 */
export function uniqueWorks(w: World, u: Unique): boolean {
  return uniqueFootprint(u.kind, w.n, u.x, u.y).some(([x, y]) => streetNear(w, x, y));
}

/**
 * What the uniques add to the tourism of the city this month, as a share: the plain `boost` of each
 * working monument, `peak` instead in its own months, capped at `UNIQUE_BOOST_MAX`. `month` is 1 to
 * 12, the same as the seasons of the resorts.
 */
export function uniqueBoost(w: World, month?: number): number {
  let boost = 0;
  for (const u of w.uniques) {
    if (!uniqueWorks(w, u)) continue;
    const info = UNIQUES[u.kind];
    const inSeason = month !== undefined && info.peakMonths.includes(month);
    boost += inSeason ? info.peak : info.boost;
  }
  return Math.min(UNIQUE_BOOST_MAX, boost);
}

/** Monthly upkeep of every unique standing in the city, working or not: what is built is kept. */
export function uniqueUpkeep(w: World): number {
  return w.uniques.reduce((sum, u) => sum + UNIQUES[u.kind].upkeep, 0);
}

/** How many uniques stand in the city, and how many of them work. */
export function countUniques(w: World): { built: number; working: number } {
  let working = 0;
  for (const u of w.uniques) if (uniqueWorks(w, u)) working++;
  return { built: w.uniques.length, working };
}
