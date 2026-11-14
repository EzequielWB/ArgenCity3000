import { LINE_REACH } from '../config';
import { TILE, World, serviceOf, zoneOf } from '../world/world';

/** What a cell is to a cable: another pole, something the cable cannot cross, or plain ground. */
export type WireCell = 'line' | 'blocked' | 'clear';

/**
 * What stands on a cell, as far as the power line cares. A pole is another pole; a building, a
 * plant or a public service is in the way (the light reaches across it, it is what relays, but the
 * cable does not run through it); anything else — ground, road, plaza, water — the cable crosses.
 */
export function wireCell(w: World, x: number, y: number): WireCell {
  const i = w.idx(x, y);
  const tile = w.tiles[i];
  if (tile === TILE.LINE) return 'line';
  if (tile === TILE.PLANT || serviceOf(tile) || (zoneOf(tile) && w.level[i] > 0)) return 'blocked';
  return 'clear';
}

export interface WireTarget {
  /** The view cell of the pole at the other end. */
  vx: number;
  vy: number;
  /** Cells between the two poles, 1 when they stand side by side. */
  distance: number;
}

/**
 * The poles this one hangs a cable to. A power line lights everything within `LINE_REACH` cells, so
 * poles two or three cells apart are one and the same grid: the cable spans the gap.
 *
 * Only the two sides that face the back of the picture are walked, the ones already painted when
 * this pole is drawn. That way every pair of poles is drawn exactly once — by the one in front —
 * and no chunk painted later covers the cable. `cell` answers with the view cell's `WireCell`.
 */
export function wireTargets(vx: number, vy: number, n: number, cell: (vx: number, vy: number) => WireCell): WireTarget[] {
  const out: WireTarget[] = [];
  for (const [dx, dy] of [
    [-1, 0],
    [0, -1],
  ]) {
    for (let d = 1; d <= LINE_REACH; d++) {
      const nx = vx + dx * d;
      const ny = vy + dy * d;
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) break;
      const what = cell(nx, ny);
      if (what === 'line') {
        out.push({ vx: nx, vy: ny, distance: d });
        break;
      }
      if (what === 'blocked') break;
    }
  }
  return out;
}
