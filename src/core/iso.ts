/** Isometric metrics: a cell is a 2:1 diamond; each height level lifts it by HEIGHT_STEP px. */
export const TILE_W = 32;
export const TILE_H = 16;
export const HEIGHT_STEP = 8;

export type Rotation = 0 | 1 | 2 | 3;

/**
 * Maps world grid coordinates to view coordinates for a square grid of `size` points.
 * Use size = n for cells and size = n + 1 for cell corners.
 */
export function toView(x: number, y: number, rot: Rotation, size: number): [number, number] {
  switch (rot) {
    case 0:
      return [x, y];
    case 1:
      return [size - 1 - y, x];
    case 2:
      return [size - 1 - x, size - 1 - y];
    case 3:
      return [y, size - 1 - x];
  }
}

export function fromView(vx: number, vy: number, rot: Rotation, size: number): [number, number] {
  switch (rot) {
    case 0:
      return [vx, vy];
    case 1:
      return [vy, size - 1 - vx];
    case 2:
      return [size - 1 - vx, size - 1 - vy];
    case 3:
      return [size - 1 - vy, vx];
  }
}

/** Rotates a world direction vector into view space. */
export function rotateDir(dx: number, dy: number, rot: Rotation): [number, number] {
  switch (rot) {
    case 0:
      return [dx, dy];
    case 1:
      return [0 - dy, dx];
    case 2:
      return [0 - dx, 0 - dy];
    case 3:
      return [dy, 0 - dx];
  }
}

/** View-space point (px, py) at height h → screen offset relative to the map origin. */
export function project(px: number, py: number, h: number): [number, number] {
  return [((px - py) * TILE_W) / 2, ((px + py) * TILE_H) / 2 - h * HEIGHT_STEP];
}

/** Inverse of `project` on the horizontal plane at height h. */
export function unproject(sx: number, sy: number, h: number): [number, number] {
  const a = sx / (TILE_W / 2);
  const b = (sy + h * HEIGHT_STEP) / (TILE_H / 2);
  return [(a + b) / 2, (b - a) / 2];
}
