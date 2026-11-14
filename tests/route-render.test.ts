import { describe, expect, it } from 'vitest';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { TILE, World } from '../src/world/world';
import { Simulation, newSimState } from '../src/sim/simulation';
import { describeCell } from '../src/sim/report';
import { Traffic, computeTraffic } from '../src/render/traffic';
import { isRouteCentre, routeSigns } from '../src/render/avenue';
import { startCameraCell } from '../src/render/view';

const N = 24;

function flat(n = N): Terrain {
  return { n, corners: new Uint8Array((n + 1) * (n + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(n * n) };
}

/** Marks a rectangle of road cells as the provincial route. */
function strip(w: World, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      w.tiles[w.idx(x, y)] = TILE.ROAD;
      w.route[w.idx(x, y)] = 1;
    }
  }
}

function road(w: World, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) w.tiles[w.idx(x, y)] = TILE.ROAD;
}

/** A two-lane band along the top edge, one street coming down from it and a dense block beside the street. */
function town(withRoute: boolean): World {
  const w = new World(flat());
  if (withRoute) strip(w, 0, 1, N - 1, 2);
  else road(w, 0, 1, N - 1, 2);
  road(w, 10, 3, 10, 18);
  for (let y = 4; y <= 12; y++) {
    for (let x = 11; x <= 14; x++) {
      w.tiles[w.idx(x, y)] = TILE.R;
      w.level[w.idx(x, y)] = 4;
    }
  }
  return w;
}

describe('Traffic with a provincial route', () => {
  it('spawns the cars only on the route cells, and they then drive into the streets', () => {
    const w = town(true);
    const tr = new Traffic(w, 3);
    tr.refresh();
    expect(tr.target).toBeGreaterThan(0);
    tr.update(0.001);
    expect(tr.cars.length).toBeGreaterThan(0);
    for (const c of tr.cars) expect(w.route[w.idx(c.x, c.y)]).toBe(1);

    let offRoute = false;
    for (let k = 0; k < 600; k++) {
      tr.update(0.05);
      for (const c of tr.cars) {
        expect(w.tileAt(c.x, c.y)).toBe(TILE.ROAD);
        if (!w.route[w.idx(c.x, c.y)]) offRoute = true;
      }
    }
    expect(offRoute).toBe(true);
  });

  it('keeps the same number of cars it would have without a route (the density decides)', () => {
    const withRoute = new Traffic(town(true), 3);
    const without = new Traffic(town(false), 3);
    withRoute.refresh();
    without.refresh();
    expect(withRoute.target).toBe(without.target);
  });

  it('spawns on the busy streets as always when the map has no route', () => {
    const w = town(false);
    const density = new Uint8Array(N * N);
    computeTraffic(w, density);
    const tr = new Traffic(w, 3);
    tr.refresh();
    tr.update(0.001);
    expect(tr.cars.length).toBeGreaterThan(0);
    for (const c of tr.cars) expect(density[w.idx(c.x, c.y)]).toBeGreaterThan(0);
  });
});

describe('describeCell on the provincial route', () => {
  it('says what the route is: untouchable, free, and where the new neighbours arrive', () => {
    const w = town(true);
    const sim = new Simulation(w, newSimState(1), 'X');
    sim.refresh();
    const r = describeCell(w, sim, 5, 1);
    expect(r.title).toBe('Ruta provincial');
    const text = r.lines.join(' ');
    expect(text).toMatch(/no se puede tocar/i);
    expect(text).toMatch(/no cuesta nada/i);
    expect(text).toMatch(/vecinos/i);
  });

  it('keeps the card of an ordinary street as it was', () => {
    const w = town(true);
    const sim = new Simulation(w, newSimState(1), 'X');
    sim.refresh();
    const r = describeCell(w, sim, 10, 8);
    expect(r.title).toBe('Calle');
    expect(r.lines.join(' ')).toMatch(/Tránsito/);
  });

  it('calls a route cell over water a route too, not a bridge', () => {
    const t = flat();
    for (let y = 0; y <= 4; y++) for (let x = 0; x <= N; x++) t.corners[y * (N + 1) + x] = SEA_LEVEL - 1;
    const w = new World(t);
    strip(w, 0, 1, N - 1, 2);
    expect(w.isWater(3, 2)).toBe(true);
    const sim = new Simulation(w, newSimState(1), 'X');
    expect(describeCell(w, sim, 3, 2).title).toBe('Ruta provincial');
  });
});

describe('startCameraCell', () => {
  it('looks at the middle of the land, away from the river, when there is no route', () => {
    const w = new World(flat());
    expect(startCameraCell(w)).toEqual([Math.floor(N * 0.4), N / 2]);
    // Water on the row of the middle: the first dry cell going west.
    const t = flat();
    for (let x = 5; x < N; x++) t.corners[(N / 2) * (N + 1) + x] = SEA_LEVEL - 1;
    for (let x = 5; x < N; x++) t.corners[(N / 2 + 1) * (N + 1) + x] = SEA_LEVEL - 1;
    const river = new World(t);
    const [x, y] = startCameraCell(river);
    expect(y).toBe(N / 2);
    expect(river.isWater(x, y)).toBe(false);
    expect(x).toBeLessThan(Math.floor(N * 0.4) + 1);
  });

  it('looks at the middle of the route when there is one', () => {
    const w = new World(flat());
    strip(w, 0, 1, N - 1, 2);
    const [x, y] = startCameraCell(w);
    expect(w.route[w.idx(x, y)]).toBe(1);
    expect(Math.abs(x - (N - 1) / 2)).toBeLessThanOrEqual(1);

    const side = new World(flat());
    strip(side, N - 3, 3, N - 2, N - 4);
    const [sx, sy] = startCameraCell(side);
    expect(side.route[side.idx(sx, sy)]).toBe(1);
    expect(Math.abs(sy - (N - 1) / 2)).toBeLessThanOrEqual(1);
  });
});

describe('the lane lines of the route', () => {
  it('paints one solid yellow line down the middle and white dashes on the other boundaries', () => {
    expect(isRouteCentre(4, 0, 1)).toBe(false);
    expect(isRouteCentre(4, 1, 2)).toBe(true);
    expect(isRouteCentre(4, 2, 3)).toBe(false);
    expect(isRouteCentre(4, 2, 1)).toBe(true);
    expect(isRouteCentre(2, 0, 1)).toBe(true);
    expect(isRouteCentre(3, 0, 1)).toBe(false);
  });
});

describe('routeSigns', () => {
  it('puts a sign every 8 cells on the lane that faces the inside of the map', () => {
    const w = new World(flat());
    strip(w, 0, 1, N - 1, 2);
    const signs = routeSigns(w.route, N);
    const cells = [...signs.keys()].sort((a, b) => a - b);
    expect(cells).toEqual([4, 12, 20].map((x) => w.idx(x, 2)));
    for (const dir of signs.values()) expect(dir).toEqual([0, 1]);
  });

  it('works for a route along a side and on the far border', () => {
    const w = new World(flat());
    strip(w, N - 3, 0, N - 2, N - 1);
    const signs = routeSigns(w.route, N);
    expect([...signs.keys()].sort((a, b) => a - b)).toEqual([4, 12, 20].map((y) => w.idx(N - 3, y)));
    for (const dir of signs.values()) expect(dir).toEqual([-1, 0]);

    const bottom = new World(flat());
    strip(bottom, 0, N - 3, N - 1, N - 2);
    const b = routeSigns(bottom.route, N);
    expect([...b.keys()].sort((p, q) => p - q)).toEqual([4, 12, 20].map((x) => bottom.idx(x, N - 3)));
    for (const dir of b.values()) expect(dir).toEqual([0, -1]);
  });

  it('puts the signs on the innermost lane of a four-lane strip flush against the border', () => {
    const w = new World(flat());
    strip(w, 0, 0, N - 1, 3);
    const signs = routeSigns(w.route, N);
    expect([...signs.keys()].sort((a, b) => a - b)).toEqual([4, 12, 20].map((x) => w.idx(x, 3)));
    for (const dir of signs.values()) expect(dir).toEqual([0, 1]);
  });

  it('has no signs when the map has no route', () => {
    expect(routeSigns(new World(flat()).route, N).size).toBe(0);
  });
});
