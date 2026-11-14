import { describe, expect, it } from 'vitest';
import { parkTreeHere } from '../src/render/park';

/** A world of `cells` plaza blocks, each `w`×`h` cells, laid out along x. */
function plaza(w: number, h: number): { isPark: (x: number, y: number) => boolean; trees: number } {
  const isPark = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
  let trees = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (parkTreeHere(x, y, isPark)) trees++;
  return { isPark, trees };
}

describe('how thick a plaza is planted', () => {
  it('gives a plaza on its own its tree, wherever it stands', () => {
    for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1], [7, 3], [40, 91]]) {
      expect(parkTreeHere(x, y, () => false)).toBe(true);
    }
  });

  it('plants a 2×2 with 2 trees instead of 4', () => {
    const { isPark, trees } = plaza(2, 2);
    expect(trees).toBe(2);
    // and they sit on a diagonal, not side by side
    expect(parkTreeHere(0, 0, isPark)).toBe(true);
    expect(parkTreeHere(1, 1, isPark)).toBe(true);
  });

  it('plants a 3×3 with 5 instead of 9', () => {
    expect(plaza(3, 3).trees).toBe(5);
  });

  it('keeps the count near half as the plaza grows', () => {
    expect(plaza(4, 4).trees).toBe(8);
    expect(plaza(5, 5).trees).toBe(13);
    const big = plaza(10, 10).trees;
    expect(big).toBeGreaterThanOrEqual(45);
    expect(big).toBeLessThanOrEqual(55);
  });

  it('leaves half a two-cell walk without a tree', () => {
    expect(plaza(2, 1).trees).toBe(1);
    expect(plaza(1, 3).trees).toBe(2);
  });
});
