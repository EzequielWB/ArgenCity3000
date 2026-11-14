import { describe, expect, it } from 'vitest';
import { LINE_REACH } from '../src/config';
import { wireCell, wireTargets, type WireCell } from '../src/render/wire';
import { TILE, World } from '../src/world/world';

const N = 32;

function flat(): World {
  return new World({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(30), trees: new Uint8Array(N * N) });
}

/** A board of plain ground with whatever the test wants on it: `L` a pole, `B` a building. */
function board(rows: string[]): (vx: number, vy: number) => WireCell {
  const map = new Map<string, WireCell>();
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === 'L') map.set(`${x},${y}`, 'line');
      else if (ch === 'B') map.set(`${x},${y}`, 'blocked');
    }),
  );
  return (vx, vy) => map.get(`${vx},${vy}`) ?? 'clear';
}

const at = (vx: number, vy: number, cell: (vx: number, vy: number) => WireCell) =>
  wireTargets(vx, vy, N, cell)
    .map((t) => `${t.vx},${t.vy}:${t.distance}`)
    .sort();

describe('where the cables go', () => {
  it('hangs one to the pole on each side it paints', () => {
    const cell = board([
      '.L.',
      'L.L',
      '.L.',
    ]);
    // The two sides behind the pole in the picture, so this one reaches up and left.
    expect(at(1, 1, cell)).toEqual(['0,1:1', '1,0:1']);
  });

  it('spans the gap while the next pole is within reach', () => {
    for (let gap = 0; gap < LINE_REACH; gap++) {
      const cell = board([`L${'.'.repeat(gap)}L`]);
      const front = gap + 1;
      expect(at(front, 0, cell)).toEqual([`0,0:${front}`]);
    }
  });

  it('leaves the cable in the air when the next pole is out of reach', () => {
    expect(at(LINE_REACH + 1, 0, board([`L${'.'.repeat(LINE_REACH)}L`]))).toEqual([]);
  });

  it('stops at the nearest pole, not at every one in reach', () => {
    expect(at(4, 0, board(['L.L.L']))).toEqual(['2,0:2']);
    expect(at(3, 0, board(['L..L']))).toEqual(['0,0:3']);
  });

  it('does not run a cable through a building', () => {
    expect(at(2, 0, board(['LB.L']))).toEqual([]);
    expect(at(3, 0, board(['LB.L']))).toEqual([]);
  });

  it('crosses ground, road, plaza and water', () => {
    const w = flat();
    for (let x = 0; x < N; x++) w.tiles[w.idx(x, 1)] = TILE.ROAD;
    for (let x = 0; x < N; x++) w.tiles[w.idx(x, 2)] = TILE.PARK;
    expect(wireCell(w, 1, 1)).toBe('clear');
    expect(wireCell(w, 1, 2)).toBe('clear');
    w.tiles[w.idx(0, 0)] = TILE.LINE;
    w.tiles[w.idx(3, 0)] = TILE.LINE;
    expect(at(3, 0, (vx, vy) => wireCell(w, vx, vy))).toEqual(['0,0:3']);
  });

  it('calls a plant, a service and a built lot in the way', () => {
    const w = flat();
    w.tiles[w.idx(1, 0)] = TILE.PLANT;
    w.tiles[w.idx(2, 0)] = TILE.SCHOOL;
    w.tiles[w.idx(3, 0)] = TILE.R;
    w.level[w.idx(3, 0)] = 2;
    expect(wireCell(w, 1, 0)).toBe('blocked');
    expect(wireCell(w, 2, 0)).toBe('blocked');
    expect(wireCell(w, 3, 0)).toBe('blocked');
    // A zoned lot with nothing built on it is still just ground.
    w.tiles[w.idx(3, 3)] = TILE.R;
    expect(wireCell(w, 3, 3)).toBe('clear');
  });

  it('draws every pair of poles once', () => {
    // The invariant that keeps the wires from doubling up: of two poles, only the one in front
    // hangs the cable.
    const cell = board(['L..L']);
    expect([at(0, 0, cell).length, at(3, 0, cell).length]).toEqual([0, 1]);
  });

  it('walks off the board without falling over', () => {
    expect(at(9, 0, board(['........LL']))).toEqual(['8,0:1']);
    expect(at(0, 0, board(['........LL']))).toEqual([]);
    expect(wireTargets(0, 0, 0, board(['L']))).toEqual([]);
  });
});

describe('the cable follows the light', () => {
  it('reaches exactly as far as the power line does', () => {
    // One number for both: if the reach grows, the cable grows with it.
    expect(LINE_REACH).toBe(3);
    expect(at(LINE_REACH, 0, board([`L${'.'.repeat(LINE_REACH - 1)}L`]))).toEqual([[`0,0:${LINE_REACH}`][0]]);
  });
});
