/**
 * How thick a plaza is planted. A plaza on its own always has its tree; inside a block only the
 * cells of a checkerboard do, so a 2×2 block carries 2 trees instead of 4 and a 3×3 carries 5
 * instead of 9. The rule lives on its own (and takes the neighbourhood as a question) so it can be
 * tested without a canvas.
 */
export function parkTreeHere(x: number, y: number, isPark: (x: number, y: number) => boolean): boolean {
  const alone = !isPark(x - 1, y) && !isPark(x + 1, y) && !isPark(x, y - 1) && !isPark(x, y + 1);
  return alone || ((x + y) & 1) === 0;
}
