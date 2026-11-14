import { SEA_LEVEL, constrainSlopes } from './terrain';
import { World, serviceOf, zoneOf } from './world';

/** Most a single levelling may raise or lower a corner, so a block on a hill does not flatten the hill. */
export const MAX_LEVELING_STEP = 2;

/** Lots that make up a block: zoned lots and public services. */
function isBlockTile(tile: number): boolean {
  return zoneOf(tile) !== null || serviceOf(tile) !== null;
}

/**
 * Raises corners (except frozen ones) until none is more than one level below a neighbour:
 * the mirror of `constrainSlopes`, which only lowers. Monotone, so it terminates.
 */
function liftSlopes(h: Uint8Array, s: number, frozen: Uint8Array): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      for (let k = 0; k < s * s; k++) {
        const i = pass === 0 ? k : s * s - 1 - k;
        if (frozen[i]) continue;
        const x = i % s;
        const y = (i - x) / s;
        let need = h[i];
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= s) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            if ((dx === 0 && dy === 0) || nx < 0 || nx >= s) continue;
            need = Math.max(need, h[ny * s + nx] - 1);
          }
        }
        if (need > h[i]) {
          h[i] = need;
          changed = true;
        }
      }
    }
  }
}

/**
 * Levels the blocks that contain the given cells. A block is the lots joined side by side
 * (zones and services, so it ends at streets); each becomes flat at its average height rounded
 * up, so blocks are filled rather than dug and keep their views (land value counts height), with
 * every corner moving at most MAX_LEVELING_STEP levels. Corners touching water never move,
 * so shores stay put, and so do the corners under the provincial route. Slopes are constrained
 * afterwards, and every lot whose ground moved is marked for redrawing.
 */
export function levelBlocks(w: World, cells: readonly [number, number][]): void {
  const n = w.n;
  const s = n + 1;
  const c = w.terrain.corners;
  const before = c.slice();
  const cornersOf = (i: number) => {
    const x = i % n;
    const y = (i - x) / n;
    return [y * s + x, y * s + x + 1, (y + 1) * s + x, (y + 1) * s + x + 1];
  };
  const frozen = new Uint8Array(s * s);
  for (let i = 0; i < n * n; i++) {
    const k = cornersOf(i);
    if (w.route[i] || Math.min(c[k[0]], c[k[1]], c[k[2]], c[k[3]]) < SEA_LEVEL) for (const j of k) frozen[j] = 1;
  }

  const seen = new Uint8Array(n * n);
  for (const [sx, sy] of cells) {
    const start = sy * n + sx;
    if (seen[start] || !isBlockTile(w.tiles[start])) continue;
    const block: number[] = [];
    const queue = [start];
    seen[start] = 1;
    while (queue.length) {
      const i = queue.pop()!;
      block.push(i);
      const x = i % n;
      const y = (i - x) / n;
      for (const j of [x > 0 ? i - 1 : -1, x < n - 1 ? i + 1 : -1, y > 0 ? i - n : -1, y < n - 1 ? i + n : -1]) {
        if (j >= 0 && !seen[j] && isBlockTile(w.tiles[j])) {
          seen[j] = 1;
          queue.push(j);
        }
      }
    }
    const corners = new Set<number>();
    for (const i of block) for (const k of cornersOf(i)) if (!frozen[k]) corners.add(k);
    if (corners.size === 0) continue;
    let sum = 0;
    for (const k of corners) sum += c[k];
    const target = Math.max(SEA_LEVEL, Math.ceil(sum / corners.size));
    for (const k of corners) c[k] = Math.max(c[k] - MAX_LEVELING_STEP, Math.min(c[k] + MAX_LEVELING_STEP, target));
  }
  // A filled block raises the ground around it as an embankment instead of being cut back.
  liftSlopes(c, s, frozen);
  constrainSlopes(c, s);

  for (let k = 0; k < s * s; k++) {
    if (c[k] === before[k]) continue;
    const x = k % s;
    const y = (k - x) / s;
    for (const [cx, cy] of [
      [x - 1, y - 1],
      [x, y - 1],
      [x - 1, y],
      [x, y],
    ]) {
      if (cx >= 0 && cy >= 0 && cx < n && cy < n) w.markDirty(cy * n + cx);
    }
  }
}
