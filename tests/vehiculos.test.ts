import { describe, expect, it } from 'vitest';
import { HUBS } from '../src/config';
import { Vessels, boatPosition, planeAt, planeFacing, takeoffAt, type Plane } from '../src/render/vessels';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { applyPlan, planTool, type ToolId } from '../src/world/tools';
import { TILE, World } from '../src/world/world';

/** Land everywhere, except water from x = 19 on (the first water lot). */
function shore(n = 40): Terrain {
  const s = n + 1;
  const corners = new Uint8Array(s * s).fill(SEA_LEVEL + 1);
  for (let y = 0; y < s; y++) for (let x = 20; x < s; x++) corners[y * s + x] = SEA_LEVEL - 1;
  return { n, corners, trees: new Uint8Array(n * n) };
}

function city(): World {
  const w = new World(shore());
  w.powered.fill(1);
  for (let x = 0; x < 20; x++) w.setTile(x, 10, TILE.ROAD);
  return w;
}

const put = (w: World, tool: ToolId, x: number, y: number) => applyPlan(w, planTool(w, tool, [[x, y]]));

describe('a take-off', () => {
  it('speeds up along the runway and climbs after it', () => {
    const start = takeoffAt(0);
    expect(start).toEqual({ along: 0, altitude: 0 });
    const end = takeoffAt(4);
    expect(end.altitude).toBeGreaterThan(20);
    let last = -1;
    for (let t = 0; t <= 4; t += 0.25) {
      const now = takeoffAt(t);
      expect(now.along).toBeGreaterThan(last); // never goes back
      last = now.along;
    }
    // On the ground for two seconds: it covers the runway and has not left it yet.
    expect(takeoffAt(2).along).toBeCloseTo(HUBS.airport.w, 5);
    expect(takeoffAt(2).altitude).toBe(0);
  });

  it('is played backwards by a landing, and the runway is on the side the drawing puts it', () => {
    const plane = (phase: 'takeoff' | 'landing', dir: 1 | -1): Plane => ({ x: 5, y: 12, level: 1, phase, t: 1, dir, far: 30 });
    const up = planeAt(plane('takeoff', 1), 0)!;
    const down = planeAt(plane('landing', 1), 0)!;
    expect(up.x).toBeLessThan(down.x); // one second in, a landing is further along than a take-off
    expect(planeAt(plane('takeoff', -1), 0)!.x).toBeGreaterThan(5 + HUBS.airport.w - 2); // the other way round
    expect(planeAt({ ...plane('takeoff', 1), phase: 'wait' }, 0)).toBeNull();
    expect(planeAt(plane('takeoff', 1), 0)!.y).toBeCloseTo(12.4, 5);
    expect(planeAt(plane('takeoff', 1), 2)!.y).toBeCloseTo(12 + HUBS.airport.h - 0.4, 5);
    expect(planeAt(plane('takeoff', 1), 1)!.y).toBeCloseTo(12 + HUBS.airport.h - 0.4, 5);
    expect(planeAt(plane('takeoff', 1), 3)!.y).toBeCloseTo(12.4, 5);
  });
});

describe('the planes of an airport', () => {
  it('are one for each level, only while it works', () => {
    const w = city();
    const v = new Vessels(w, 1);
    put(w, 'airport', 2, 11);
    v.refresh();
    expect(v.planes.size).toBe(1);
    put(w, 'airport', 5, 11);
    v.refresh();
    expect(v.planes.size).toBe(2);
    put(w, 'airport', 8, 11);
    put(w, 'airport', 11, 11);
    v.refresh();
    expect(v.planes.size).toBe(3);
    for (let x = 0; x < 20; x++) w.setTile(x, 10, TILE.EMPTY); // no street: it does not work
    v.refresh();
    expect(v.planes.size).toBe(0);
  });

  it('wait, take off, fly out of the map, come back, land and wait again', () => {
    const w = city();
    put(w, 'airport', 2, 11);
    const v = new Vessels(w, 3);
    v.refresh();
    const seen = new Set<string>();
    for (let step = 0; step < 900; step++) {
      v.update(0.1);
      for (const p of v.planes.values()) seen.add(p.phase);
    }
    expect([...seen].sort()).toEqual(['in', 'landing', 'out', 'takeoff', 'wait']);
  });

  it('points its nose at the runway when it comes back and lands, never backwards', () => {
    const out: Plane = { x: 5, y: 12, level: 1, phase: 'out', t: 1, dir: 1, far: 30 };
    expect(planeFacing(out, 0)).toBe(0); // flying east, nose east
    expect(planeFacing({ ...out, phase: 'in' }, 0)).toBe(2); // coming back, nose west
    expect(planeFacing({ ...out, phase: 'landing' }, 0)).toBe(2);
    const west: Plane = { ...out, dir: -1 };
    expect(planeFacing(west, 0)).toBe(2);
    expect(planeFacing({ ...west, phase: 'in' }, 0)).toBe(0);
  });

  it('leaves the map and comes back in from beyond it, fading only at the edge', () => {    const board: Plane = { x: 2, y: 11, level: 1, phase: 'out', t: 0, dir: 1, far: 30 };
    const start = planeAt(board, 0)!;
    expect(start.alpha).toBe(1); // it flies away in plain sight, it does not evaporate
    expect(start.altitude).toBeGreaterThan(20);
    // Near the edge it fades out, and by `far` it is gone.
    expect(planeAt({ ...board, t: (30 - 2 - 9) / 3 }, 0)!.alpha).toBeLessThan(0.5);
    expect(planeAt({ ...board, t: (30 - 9) / 3 }, 0)!.alpha).toBe(0);
    expect(planeAt({ ...board, t: (30 - 9) / 3 }, 0)!.x).toBeGreaterThanOrEqual(30);
    // The way back is the same picture backwards: it comes in from the edge, still faded.
    const back = { ...board, phase: 'in' as const, t: 0 };
    expect(planeAt(back, 0)!.alpha).toBe(0);
    expect(planeAt({ ...back, t: (30 - 9) / 3 }, 0)!.alpha).toBe(1);
  });
});

describe('the boats of a harbour', () => {
  it('are one for a walk, two, and two with a cruise ship in the biggest', () => {
    const w = city();
    const v = new Vessels(w, 1);
    put(w, 'harbor', 17, 11);
    v.refresh();
    expect([...v.boats.values()].map((b) => b.kind)).toEqual(['tour']);
    put(w, 'harbor', 17, 13);
    v.refresh();
    expect(v.boats.size).toBe(3);
    expect([...v.boats.values()].filter((b) => b.kind === 'cruise')).toHaveLength(1);
  });

  it('stay on the water, each in its own patch around the harbour, and keep sailing', () => {
    const w = city();
    put(w, 'harbor', 17, 11);
    put(w, 'harbor', 17, 13);
    const v = new Vessels(w, 5);
    v.refresh();
    const start = [...v.boats.values()].map(boatPosition);
    for (let step = 0; step < 2000; step++) {
      v.update(0.1);
      for (const b of v.boats.values()) {
        expect(w.isWater(b.x, b.y)).toBe(true);
        expect(Math.abs(b.x - b.home[0]) + Math.abs(b.y - b.home[1])).toBeLessThanOrEqual(b.roam + 1);
      }
    }
    // Not all of them on the same ring: each boat has its own patch of water.
    expect(new Set([...v.boats.values()].map((b) => b.roam)).size).toBeGreaterThan(1);
    expect([...v.boats.values()].map(boatPosition)).not.toEqual(start);
  });

  it('leave with their harbour, and the planes with their airport', () => {
    const w = city();
    put(w, 'harbor', 17, 12);
    put(w, 'airport', 2, 11);
    const v = new Vessels(w, 1);
    v.refresh();
    expect([v.boats.size, v.planes.size]).toEqual([1, 1]);
    applyPlan(w, planTool(w, 'bulldoze', [[18, 13]]));
    v.refresh();
    expect([v.boats.size, v.planes.size]).toEqual([0, 1]);
    applyPlan(w, planTool(w, 'bulldoze', [[3, 12]]));
    v.refresh();
    expect([v.boats.size, v.planes.size]).toEqual([0, 0]);
  });
});

describe('the fishing boats of a dock', () => {
  const dockWorld = (): World => {
    const w = city();
    w.roadAccess.fill(1);
    w.coastAccess.fill(1);
    put(w, 'fishing', 18, 12);
    return w;
  };

  it('are one for each working dock, and none for a dock that does not work', () => {
    const w = dockWorld();
    const v = new Vessels(w, 1);
    v.refresh();
    expect([...v.boats.values()].map((b) => b.kind)).toEqual(['fishing']);
    w.powered.fill(0); // no light: the dock stops and so does its boat
    v.refresh();
    expect(v.boats.size).toBe(0);
    w.powered.fill(1);
    w.roadAccess.fill(0); // no street
    w.coastAccess.fill(0);
    v.refresh();
    expect(v.boats.size).toBe(0);
  });

  it('sail on the water close to their dock, and go when it is demolished', () => {
    const w = dockWorld();
    const v = new Vessels(w, 3);
    v.refresh();
    for (let step = 0; step < 1500; step++) {
      v.update(0.1);
      for (const b of v.boats.values()) {
        expect(w.isWater(b.x, b.y)).toBe(true);
        expect(Math.abs(b.x - b.home[0]) + Math.abs(b.y - b.home[1])).toBeLessThanOrEqual(b.roam + 1);
      }
    }
    applyPlan(w, planTool(w, 'bulldoze', [[18, 12]]));
    v.refresh();
    expect(v.boats.size).toBe(0);
  });
});
