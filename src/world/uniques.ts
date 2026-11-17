/**
 * The unique buildings. Each kind may stand once in the city, on a footprint that is not rotated
 * (`UNIQUES`), and only where its own rule allows it: the obelisco in a plaza big enough, the
 * calvario on the hill, the puente over water, the teatro in a street the neighbours already value,
 * the estadio next to a boulevard because the crowd has to get there. A monument pays no fixed rent:
 * it adds a share of the tourism of the whole city, with a season of its own (`uniqueBoost`).
 */
import { CAPACITY, GOVERNMENTS, roadRank, UNIQUES, UNIQUE_BOOST_MAX, UNIQUE_RULES, type GovernmentKind, type UniqueKind } from '../config';
import { TILE, zoneOf, type Unique, type World } from './world';
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

/** Plaza cells around a footprint: the square a civic building faces. */
function plazaAround(w: World, cells: readonly Cell[], reach: number): number {
  return ringAround(w, cells, reach).filter((i) => w.tiles[i] === TILE.PARK).length;
}

/** Lots around a footprint with nothing on them: no zone, no service, no plaza, no street, no water. */
function openAround(w: World, cells: readonly Cell[], reach: number): number {
  const n = w.n;
  return ringAround(w, cells, reach).filter((i) => {
    const x = i % n;
    const y = (i - x) / n;
    return w.tiles[i] === TILE.EMPTY && !w.isWater(x, y) && !w.route[i];
  }).length;
}

/** True when a university stands within `reach` lots (Manhattan) of the footprint. */
function universityNear(w: World, cells: readonly Cell[], reach: number): boolean {
  for (const [cx, cy] of cells) {
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > reach) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (w.inBounds(x, y) && w.tiles[w.idx(x, y)] === TILE.UNIVERSITY) return true;
      }
    }
  }
  return false;
}

/** True when water is within `reach` lots (Manhattan) of the footprint: the pilgrimage comes by the river. */
function waterNear(w: World, cells: readonly Cell[], reach: number): boolean {
  for (const [cx, cy] of cells) {
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > reach) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (w.inBounds(x, y) && w.isWater(x, y)) return true;
      }
    }
  }
  return false;
}

/** Industrial lots around a footprint: the union hall stands among the factories. */
function industryAround(w: World, cells: readonly Cell[], reach: number): number {
  return ringAround(w, cells, reach).filter((i) => zoneOf(w.tiles[i]) === 'I').length;
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
export function uniqueRefusal(w: World, kind: UniqueKind, cells: readonly Cell[], government?: GovernmentKind): string | null {
  const { label } = UNIQUES[kind];
  if (uniquesOf(w, kind).length > 0) return `${label}: ya hay uno en la ciudad, y no puede haber más`;
  const own = UNIQUES[kind].government;
  if (own && government && own !== government) {
    return `${label}: es el único de ${GOVERNMENTS[own].label.toLowerCase()}, y esta ciudad es ${GOVERNMENTS[government].label.toLowerCase()}`;
  }
  if (kind === 'puente') {
    if (!cells.every(([x, y]) => w.isWater(x, y))) return `${label}: tiene que ir sobre el agua, de orilla a orilla`;
    if (!endOnLand(w, kind, cells)) return `${label}: una de las dos puntas tiene que llegar a tierra`;
    return null;
  }
  if (cells.some(([x, y]) => w.isWater(x, y))) return `${label}: tiene que estar en tierra`;
  switch (kind) {
    case 'obelisco': {
      const { plazaCells, reach } = UNIQUE_RULES.obelisco;
      const around = plazaAround(w, cells, reach);
      return around >= plazaCells ? null : `${label}: necesita ${plazaCells} lotes de plaza a ${reach} lotes o menos (hay ${around})`;
    }
    case 'cabildo': {
      const { plazaCells, reach } = UNIQUE_RULES.cabildo;
      const around = plazaAround(w, cells, reach);
      return around >= plazaCells ? null : `${label}: necesita una plaza enfrente, con ${plazaCells} lotes a ${reach} lotes o menos (hay ${around})`;
    }
    case 'regimiento': {
      const { openCells, reach } = UNIQUE_RULES.regimiento;
      const around = openAround(w, cells, reach);
      return around >= openCells ? null : `${label}: necesita descampado para desfilar, con ${openCells} lotes libres a ${reach} lotes o menos (hay ${around})`;
    }
    case 'planetario': {
      const { reach } = UNIQUE_RULES.planetario;
      return universityNear(w, cells, reach) ? null : `${label}: tiene que estar a ${reach} lotes o menos de una universidad`;
    }
    case 'santuario': {
      const { water } = UNIQUE_RULES.santuario;
      return waterNear(w, cells, water) ? null : `${label}: la peregrinación llega por el agua, así que tiene que estar a ${water} lotes o menos de la costa`;
    }
    case 'sindicato': {
      const { industryCells, reach } = UNIQUE_RULES.sindicato;
      const around = industryAround(w, cells, reach);
      return around >= industryCells ? null : `${label}: tiene que estar entre las fábricas, con ${industryCells} lotes industriales a ${reach} lotes o menos (hay ${around})`;
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
  let jobs = -1;
  for (const u of w.uniques) {
    if (!uniqueWorks(w, u)) continue;
    const info = UNIQUES[u.kind];
    const inSeason = month !== undefined && info.peakMonths.includes(month);
    boost += inSeason ? info.peak : info.boost;
    if (info.jobs) {
      // The sindicato brings visitors in proportion to the factories that work: it is not a fixed
      // rent, so a city that closes its industry loses the tours with it.
      jobs = jobs < 0 ? industrialJobs(w) : jobs;
      boost += Math.min(info.jobs.max, jobs * info.jobs.perJob);
    }
  }
  return Math.min(UNIQUE_BOOST_MAX, boost);
}

/** Monthly upkeep of every unique standing in the city, working or not: what is built is kept. */
export function uniqueUpkeep(w: World): number {
  return w.uniques.reduce((sum, u) => sum + UNIQUES[u.kind].upkeep, 0);
}

/**
 * The footprints of the uniques of a kind that work: the services that reach around a unique (the
 * regimiento's patrols, the planetario's classes) ask for them.
 */
export function uniqueSources(w: World, kind: UniqueKind): Cell[][] {
  return w.uniques.filter((u) => u.kind === kind && uniqueWorks(w, u)).map((u) => uniqueFootprint(kind, w.n, u.x, u.y));
}

/** Points of approval the cabildos add this month: `peak` in the months of their season (the election). */
export function uniqueApproval(w: World, month?: number): number {
  let total = 0;
  for (const u of w.uniques) {
    const info = UNIQUES[u.kind].approval;
    if (!info || !uniqueWorks(w, u)) continue;
    const peak = month !== undefined && UNIQUES[u.kind].peakMonths.includes(month);
    total += peak ? info.peak : info.perMonth;
  }
  return total;
}

/** Points of favor the santuarios add this month: `peak` in the months of their season (the pilgrimage). */
export function uniqueFavor(w: World, month?: number): number {
  let total = 0;
  for (const u of w.uniques) {
    const info = UNIQUES[u.kind].favor;
    if (!info || !uniqueWorks(w, u)) continue;
    const peak = month !== undefined && UNIQUES[u.kind].peakMonths.includes(month);
    total += peak ? info.peak : info.perMonth;
  }
  return total;
}

/**
 * Industrial jobs of the city: what the factories of zone I hold at their level. The sindicato turns
 * them into tourism, so it grows with the working city instead of with the calendar.
 */
export function industrialJobs(w: World): number {
  let jobs = 0;
  for (let i = 0; i < w.n * w.n; i++) {
    if (zoneOf(w.tiles[i]) !== 'I' || w.abandoned[i]) continue;
    jobs += CAPACITY.I[w.level[i]] ?? 0;
  }
  return jobs;
}

/** How many uniques stand in the city, and how many of them work. */
export function countUniques(w: World): { built: number; working: number } {
  let working = 0;
  for (const u of w.uniques) if (uniqueWorks(w, u)) working++;
  return { built: w.uniques.length, working };
}
