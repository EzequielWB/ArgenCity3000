import { describe, expect, it } from 'vitest';
import { CAR_BOX, planOverdraw, type CarSpot } from '../src/render/traffic';
import type { PlacedSprite } from '../src/render/mapRenderer';

/** A sprite of the given size whose anchor sits at (ax, ay) on screen. */
function placed(ax: number, ay: number, width: number, height: number): PlacedSprite {
  return { ax, ay, sprite: { canvas: { width, height } as HTMLCanvasElement, ax: width / 2, ay: height - 4, smoke: [] } };
}

describe('planOverdraw', () => {
  const n = 40;

  it('redraws, clipped to the car, every later object that overlaps the car, in drawing order', () => {
    // A house just in front of the car and a tower further in front, both covering its spot.
    const house = placed(100, 104, 36, 30);
    const tower = placed(100, 140, 36, 110);
    const far = placed(400, 400, 36, 30);
    // The tower stands 7 cells down the car's diagonal: tall sprites reach that far.
    const objects = new Map<string, PlacedSprite>([
      ['5,6', house],
      ['12,12', tower],
      ['30,30', far],
    ]);
    const map = { objectAt: (vx: number, vy: number) => objects.get(`${vx},${vy}`) ?? null };
    const car: CarSpot = { id: 1, vx: 5, vy: 5, sx: 100, sy: 95 };
    const [op] = planOverdraw([car], map, n);
    expect(op.car).toBe(car);
    expect(op.objects).toEqual([house, tower]);
    expect(op.clip).toEqual({ x0: 100 - CAR_BOX.side, x1: 100 + CAR_BOX.side, y0: 95 - CAR_BOX.up, y1: 95 + CAR_BOX.down });
  });

  it('leaves out objects drawn before the car and objects that do not reach it', () => {
    const behind = placed(100, 90, 36, 30);
    const beside = placed(160, 110, 36, 30);
    const objects = new Map<string, PlacedSprite>([
      ['5,4', behind],
      ['9,6', beside],
    ]);
    const map = { objectAt: (vx: number, vy: number) => objects.get(`${vx},${vy}`) ?? null };
    const [op] = planOverdraw([{ id: 1, vx: 5, vy: 5, sx: 100, sy: 95 }], map, n);
    expect(op.objects).toEqual([]);
  });

  it('orders the cars from back to front', () => {
    const map = { objectAt: () => null };
    const ops = planOverdraw(
      [
        { id: 1, vx: 3, vy: 9, sx: 0, sy: 0 },
        { id: 2, vx: 7, vy: 2, sx: 0, sy: 0 },
      ],
      map,
      n,
    );
    expect(ops.map((o) => o.car.id)).toEqual([2, 1]);
  });
});
