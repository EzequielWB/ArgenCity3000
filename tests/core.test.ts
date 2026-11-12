import { describe, expect, it } from 'vitest';
import { Rng, hashString } from '../src/core/rng';
import {
  HEIGHT_STEP,
  TILE_H,
  TILE_W,
  fromView,
  project,
  rotateDir,
  toView,
  unproject,
  type Rotation,
} from '../src/core/iso';

describe('Rng', () => {
  it('is deterministic for the same seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 50; i++) expect(a.next()).toBe(b.next());
  });

  it('produces different sequences for different seeds', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const sa = Array.from({ length: 5 }, () => a.next());
    const sb = Array.from({ length: 5 }, () => b.next());
    expect(sa).not.toEqual(sb);
  });

  it('keeps next() in [0,1) and int(n) in [0,n)', () => {
    const r = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      const k = r.int(5);
      expect(Number.isInteger(k)).toBe(true);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThan(5);
    }
  });

  it('can resume from a saved state', () => {
    const a = new Rng(99);
    a.next();
    const b = new Rng(0);
    b.state = a.state;
    expect(b.next()).toBe(a.next());
  });

  it('hashes strings to stable unsigned integers', () => {
    expect(hashString('Quilmes')).toBe(hashString('Quilmes'));
    expect(hashString('Quilmes')).not.toBe(hashString('Lanús'));
    expect(hashString('x')).toBeGreaterThanOrEqual(0);
  });
});

describe('iso', () => {
  const rotations: Rotation[] = [0, 1, 2, 3];

  it('toView and fromView are inverse for every rotation', () => {
    for (const rot of rotations) {
      for (const [x, y] of [
        [0, 0],
        [5, 9],
        [127, 0],
        [64, 127],
      ]) {
        const [vx, vy] = toView(x, y, rot, 128);
        expect(vx).toBeGreaterThanOrEqual(0);
        expect(vy).toBeLessThan(128);
        expect(fromView(vx, vy, rot, 128)).toEqual([x, y]);
      }
    }
  });

  it('rotation 0 is the identity and four quarter turns compose to identity', () => {
    expect(toView(3, 4, 0, 10)).toEqual([3, 4]);
    let p: [number, number] = [3, 4];
    for (let i = 0; i < 4; i++) p = toView(p[0], p[1], 1, 10);
    expect(p).toEqual([3, 4]);
  });

  it('projects with a 2:1 diamond and lifts by height', () => {
    expect(project(0, 0, 0)).toEqual([0, 0]);
    expect(project(1, 0, 0)).toEqual([TILE_W / 2, TILE_H / 2]);
    expect(project(0, 1, 0)).toEqual([-TILE_W / 2, TILE_H / 2]);
    expect(project(0, 0, 2)).toEqual([0, -2 * HEIGHT_STEP]);
  });

  it('unproject inverts project at a given height', () => {
    const [sx, sy] = project(12.5, 40.25, 3);
    const [px, py] = unproject(sx, sy, 3);
    expect(px).toBeCloseTo(12.5);
    expect(py).toBeCloseTo(40.25);
  });

  it('rotates grid directions consistently with toView', () => {
    // A step east in the world must be the same step in view space as rotating the direction.
    for (const rot of rotations) {
      const [ax, ay] = toView(5, 5, rot, 20);
      const [bx, by] = toView(6, 5, rot, 20);
      expect(rotateDir(1, 0, rot)).toEqual([bx - ax, by - ay]);
    }
  });
});
