import { describe, expect, it } from 'vitest';
import {
  CHUNK_PAD,
  CHUNK_SIZE,
  chunkId,
  chunkMayHaveContent,
  chunkRect,
  chunksIntersecting,
  expandRect,
  makeGrid,
  paddedRect,
  pickEvictions,
  renderOrder,
  shouldRender,
  splitRect,
  visibleRect,
  type ContentShape,
} from '../src/render/chunks';

describe('chunk grid geometry', () => {
  const grid = makeGrid(1300, 700, 512);

  it('covers the whole canvas with whole chunks, the last row and column being smaller', () => {
    expect(grid.cols).toBe(3);
    expect(grid.rows).toBe(2);
    expect(chunkRect(grid, chunkId(grid, 0, 0))).toEqual({ x0: 0, y0: 0, x1: 512, y1: 512 });
    expect(chunkRect(grid, chunkId(grid, 2, 1))).toEqual({ x0: 1024, y0: 512, x1: 1300, y1: 700 });
  });

  it('uses a chunk size phones can draw as one canvas', () => {
    expect(CHUNK_SIZE).toBeLessThanOrEqual(2048);
    expect(CHUNK_SIZE).toBeGreaterThan(0);
    expect(makeGrid(100, 100).size).toBe(CHUNK_SIZE);
  });

  it('finds the chunks a rectangle touches, in row-major order', () => {
    expect(chunksIntersecting(grid, { x0: 500, y0: 500, x1: 530, y1: 520 })).toEqual([0, 1, 3, 4]);
    expect(chunksIntersecting(grid, { x0: 10, y0: 10, x1: 20, y1: 20 })).toEqual([0]);
  });

  it('treats rectangles as half-open: touching a border does not count', () => {
    expect(chunksIntersecting(grid, { x0: 0, y0: 0, x1: 512, y1: 512 })).toEqual([0]);
    expect(chunksIntersecting(grid, { x0: 512, y0: 0, x1: 600, y1: 10 })).toEqual([1]);
  });

  it('clamps at the edges of the canvas and ignores what lies outside', () => {
    expect(chunksIntersecting(grid, { x0: -900, y0: -900, x1: 5000, y1: 5000 })).toEqual([0, 1, 2, 3, 4, 5]);
    expect(chunksIntersecting(grid, { x0: -50, y0: -50, x1: -1, y1: 20 })).toEqual([]);
    expect(chunksIntersecting(grid, { x0: 1300, y0: 0, x1: 1400, y1: 20 })).toEqual([]);
    expect(chunksIntersecting(grid, { x0: 10, y0: 10, x1: 10, y1: 20 })).toEqual([]);
  });

  it('splits a rectangle into one clipped piece per chunk it touches', () => {
    const pieces = splitRect(grid, { x0: 500, y0: 500, x1: 530, y1: 520 });
    expect(pieces.map((p) => p.id)).toEqual([0, 1, 3, 4]);
    expect(pieces[0].rect).toEqual({ x0: 500, y0: 500, x1: 512, y1: 512 });
    expect(pieces[1].rect).toEqual({ x0: 512, y0: 500, x1: 530, y1: 512 });
    expect(pieces[2].rect).toEqual({ x0: 500, y0: 512, x1: 512, y1: 520 });
    expect(pieces[3].rect).toEqual({ x0: 512, y0: 512, x1: 530, y1: 520 });
    // The pieces tile the rectangle exactly.
    const area = pieces.reduce((s, p) => s + (p.rect.x1 - p.rect.x0) * (p.rect.y1 - p.rect.y0), 0);
    expect(area).toBe(30 * 20);
  });

  it('maps a sprite that overhangs into the neighbour chunks to every chunk it touches', () => {
    // A 70 x 120 sprite that straddles the vertical border at x = 1024 and the horizontal one at y = 512.
    const sprite = { x0: 1000 - 35, y0: 540 - 120, x1: 1000 + 35, y1: 540 };
    expect(chunksIntersecting(grid, sprite)).toEqual([1, 2, 4, 5]);
  });

  it('gives each chunk canvas a margin, so a polygon cut by a chunk edge keeps its true edges inside', () => {
    expect(CHUNK_PAD).toBeGreaterThanOrEqual(16);
    expect(paddedRect(grid, chunkId(grid, 1, 0), 16)).toEqual({ x0: 496, y0: -16, x1: 1040, y1: 528 });
    expect(paddedRect(grid, chunkId(grid, 2, 1), 16)).toEqual({ x0: 1008, y0: 496, x1: 1316, y1: 716 });
  });

  it('with a margin, an area also reaches the chunks whose margin it falls in', () => {
    // Pixels near x = 510 belong to chunk 0 but are inside the margin of chunk 1 as well.
    const edge = { x0: 505, y0: 100, x1: 510, y1: 110 };
    expect(chunksIntersecting(grid, edge)).toEqual([0]);
    expect(chunksIntersecting(grid, edge, 16)).toEqual([0, 1]);
    // And it does not reach farther than the margin.
    expect(chunksIntersecting(grid, { x0: 400, y0: 100, x1: 450, y1: 110 }, 16)).toEqual([0]);
    expect(chunksIntersecting(grid, { x0: 1300, y0: 0, x1: 1310, y1: 20 }, 16)).toEqual([2]);
  });

  it('with a margin, splits an area into pieces clipped to each chunk canvas', () => {
    const pieces = splitRect(grid, { x0: 505, y0: 100, x1: 510, y1: 110 }, 16);
    expect(pieces).toEqual([
      { id: 0, rect: { x0: 505, y0: 100, x1: 510, y1: 110 } },
      { id: 1, rect: { x0: 505, y0: 100, x1: 510, y1: 110 } },
    ]);
    const wide = splitRect(grid, { x0: 400, y0: 400, x1: 600, y1: 600 }, 16);
    expect(wide.map((p) => p.id)).toEqual([0, 1, 3, 4]);
    expect(wide[0].rect).toEqual({ x0: 400, y0: 400, x1: 528, y1: 528 });
    expect(wide[3].rect).toEqual({ x0: 496, y0: 496, x1: 600, y1: 600 });
  });

  it('expands and measures the visible rectangle of a camera', () => {
    const r = visibleRect(1000, 600, 2, 800, 400);
    expect(r).toEqual({ x0: 800, y0: 500, x1: 1200, y1: 700 });
    expect(expandRect(r, 10, 20)).toEqual({ x0: 790, y0: 480, x1: 1210, y1: 720 });
    expect(visibleRect(0, 0, 0.25, 100, 100)).toEqual({ x0: -200, y0: -200, x1: 200, y1: 200 });
  });
});

describe('which chunks can hold anything', () => {
  // A 128 x 128 map: diamond of half-width 2048 and half-height 1024 centred at (2072, 216 + 1024).
  const shape: ContentShape = { originX: 2072, originY: 216, halfW: 2048, halfH: 1024, wide: 70, up: 216, down: 10 };
  const grid = makeGrid(4144, 2408, 512);
  const has = (cx: number, cy: number) => chunkMayHaveContent(shape, chunkRect(grid, chunkId(grid, cx, cy)));

  it('skips the corners of the canvas, outside the diamond of the map', () => {
    expect(has(0, 0)).toBe(false);
    expect(has(grid.cols - 1, 0)).toBe(false);
    expect(has(0, grid.rows - 1)).toBe(false);
    expect(has(grid.cols - 1, grid.rows - 1)).toBe(false);
  });

  it('keeps every chunk that touches the diamond', () => {
    expect(has(4, 2)).toBe(true);
    expect(has(0, 2)).toBe(true);
    expect(has(8, 2)).toBe(true);
    expect(has(4, 0)).toBe(true);
    expect(has(4, 4)).toBe(true);
  });

  it('counts the room above the map for tall sprites', () => {
    // A chunk just above the top corner can still hold the top of a tall building.
    const above = { x0: 2000, y0: 216 - 200, x1: 2100, y1: 216 - 100 };
    expect(chunkMayHaveContent(shape, above)).toBe(true);
    const wayAbove = { x0: 2000, y0: -300, x1: 2100, y1: 216 - 230 };
    expect(chunkMayHaveContent(shape, wayAbove)).toBe(false);
  });
});

describe('what to render each frame', () => {
  const grid = makeGrid(2048, 1024, 512); // 4 x 2
  const never = () => false;

  it('renders the visible chunks that are missing, nearest to the focus first', () => {
    const order = renderOrder(grid, [0, 1, 2, 3], [], never, [1900, 100]);
    expect(order.map((o) => o.id)).toEqual([3, 2, 1, 0]);
    expect(order.every((o) => o.visible)).toBe(true);
  });

  it('leaves out the chunks that are already drawn', () => {
    const order = renderOrder(grid, [0, 1, 2, 3], [], (id) => id === 1 || id === 2, [0, 0]);
    expect(order.map((o) => o.id)).toEqual([0, 3]);
  });

  it('puts the chunks beside the view after the visible ones', () => {
    const order = renderOrder(grid, [0, 1], [2, 5], never, [0, 0]);
    expect(order).toEqual([
      { id: 0, visible: true },
      { id: 1, visible: true },
      { id: 5, visible: false },
      { id: 2, visible: false },
    ]);
  });

  it('is empty when everything is drawn', () => {
    expect(renderOrder(grid, [0, 1], [2], () => true, [0, 0])).toEqual([]);
  });
});

describe('frame budget', () => {
  it('always renders one visible chunk, however slow', () => {
    expect(shouldRender({ rendered: 0, elapsed: 0, lastCost: 0, limit: 30, mustHave: true })).toBe(true);
    expect(shouldRender({ rendered: 0, elapsed: 500, lastCost: 0, limit: 30, mustHave: true })).toBe(true);
  });

  it('stops when the next chunk is expected to overrun the budget', () => {
    expect(shouldRender({ rendered: 1, elapsed: 20, lastCost: 20, limit: 30, mustHave: true })).toBe(false);
    expect(shouldRender({ rendered: 1, elapsed: 8, lastCost: 8, limit: 30, mustHave: true })).toBe(true);
    expect(shouldRender({ rendered: 3, elapsed: 30, lastCost: 10, limit: 30, mustHave: true })).toBe(false);
  });

  it('does not force a chunk that is only prefetched', () => {
    expect(shouldRender({ rendered: 0, elapsed: 31, lastCost: 0, limit: 30, mustHave: false })).toBe(false);
    expect(shouldRender({ rendered: 0, elapsed: 2, lastCost: 0, limit: 30, mustHave: false })).toBe(true);
  });
});

describe('least recently used eviction', () => {
  const entries = [
    { id: 1, lastUsed: 5 },
    { id: 2, lastUsed: 1 },
    { id: 3, lastUsed: 9 },
    { id: 4, lastUsed: 3 },
  ];

  it('evicts nothing while under the limit', () => {
    expect(pickEvictions(entries, new Set(), 4)).toEqual([]);
    expect(pickEvictions(entries, new Set(), 10)).toEqual([]);
  });

  it('drops the oldest first until the limit is met', () => {
    expect(pickEvictions(entries, new Set(), 3)).toEqual([2]);
    expect(pickEvictions(entries, new Set(), 2)).toEqual([2, 4]);
    expect(pickEvictions(entries, new Set(), 0)).toEqual([2, 4, 1, 3]);
  });

  it('never drops a chunk that is in view, even over the limit', () => {
    expect(pickEvictions(entries, new Set([2, 4]), 1)).toEqual([1, 3]);
    expect(pickEvictions(entries, new Set([1, 2, 3, 4]), 1)).toEqual([]);
  });
});
