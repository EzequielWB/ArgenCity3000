/**
 * Airports and harbours. A piece is a block of `HUBS[kind].w`×`h` lots, always the same way round;
 * pieces of one kind that share an edge are one facility, and its level is how many pieces it has
 * (`HUB_LEVELS`). Like the plants, a piece is a list entry (`World.hubs`) with its anchor.
 */
import { HUB_LEVELS, HUBS, ROAD_REACH, type HubKind } from '../config';
import { streetNear } from './transport';
import type { Hub, World } from './world';

export type Cell = [number, number];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The lots a piece anchored (top-left) at (x, y) covers, kept inside the map. */
export function hubFootprint(kind: HubKind, n: number, x: number, y: number): Cell[] {
  const { w, h } = HUBS[kind];
  const fx = clamp(x, 0, n - w);
  const fy = clamp(y, 0, n - h);
  const cells: Cell[] = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) cells.push([fx + dx, fy + dy]);
  return cells;
}

/** True when a lot of the cells has water on one of its four sides. */
function touchesWater(w: World, cells: readonly Cell[]): boolean {
  return cells.some(([x, y]) =>
    (
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const
    ).some(([dx, dy]) => w.inBounds(x + dx, y + dy) && w.isWater(x + dx, y + dy)),
  );
}

/** Why a piece cannot stand on these lots, or null when the place is right (a lot that is merely taken is not a reason given here). */
export function hubRefusal(w: World, kind: HubKind, cells: readonly Cell[]): string | null {
  const label = HUBS[kind].label;
  if (cells.some(([x, y]) => w.isWater(x, y))) return `${label}: tiene que estar en tierra`;
  if (!cells.some(([x, y]) => streetNear(w, x, y))) return `${label}: tiene que tener una calle a ${ROAD_REACH} lotes o menos`;
  if (kind === 'harbor' && !touchesWater(w, cells)) return 'El puerto tiene que estar pegado al agua';
  return null;
}

/** The level a facility of `pieces` pieces has: 1, 2 or 3. */
export function hubLevel(kind: HubKind, pieces: number): number {
  const need = HUB_LEVELS[kind];
  let level = 1;
  for (let k = 0; k < need.length; k++) if (pieces >= need[k]) level = k + 1;
  return level;
}

/** True when two pieces share part of an edge. */
function touching(a: Hub, b: Hub): boolean {
  const [aw, ah] = [HUBS[a.kind].w, HUBS[a.kind].h];
  const [bw, bh] = [HUBS[b.kind].w, HUBS[b.kind].h];
  const overlapX = a.x < b.x + bw && b.x < a.x + aw;
  const overlapY = a.y < b.y + bh && b.y < a.y + ah;
  return (overlapY && (a.x + aw === b.x || b.x + bw === a.x)) || (overlapX && (a.y + ah === b.y || b.y + bh === a.y));
}

export interface HubFacility {
  kind: HubKind;
  pieces: Hub[];
  level: number;
  /** Whether it works: a street within reach of one of its pieces and, for a harbour, water at one of them. */
  works: boolean;
}

/** The facilities of the city: its pieces, grouped by kind and by the edges they share. */
export function hubFacilities(w: World): HubFacility[] {
  const hubs = w.hubs;
  const group = hubs.map((_, i) => i);
  const find = (i: number): number => (group[i] === i ? i : (group[i] = find(group[i])));
  for (let i = 0; i < hubs.length; i++) {
    for (let j = i + 1; j < hubs.length; j++) if (hubs[i].kind === hubs[j].kind && touching(hubs[i], hubs[j])) group[find(j)] = find(i);
  }
  const byRoot = new Map<number, Hub[]>();
  hubs.forEach((h, i) => byRoot.set(find(i), [...(byRoot.get(find(i)) ?? []), h]));
  return [...byRoot.values()].map((pieces) => {
    const kind = pieces[0].kind;
    const feet = pieces.map((p) => hubFootprint(kind, w.n, p.x, p.y));
    const street = feet.some((f) => f.some(([x, y]) => streetNear(w, x, y)));
    const water = kind !== 'harbor' || feet.some((f) => touchesWater(w, f));
    return { kind, pieces, level: hubLevel(kind, pieces.length), works: street && water };
  });
}

/** Asks for every lot of every piece to be drawn again: a piece that joins or leaves changes the level, and so the drawing, of its neighbours. */
export function markHubsDirty(w: World): void {
  for (const h of w.hubs) for (const [x, y] of hubFootprint(h.kind, w.n, h.x, h.y)) w.markDirty(w.idx(x, y));
}

/** The facility that has a piece on the lot, or undefined. */
export function facilityAt(w: World, x: number, y: number): HubFacility | undefined {
  const piece = w.hubAt(x, y);
  return piece ? hubFacilities(w).find((f) => f.pieces.includes(piece)) : undefined;
}
