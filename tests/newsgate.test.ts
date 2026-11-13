import { describe, expect, it } from 'vitest';
import { World, TILE } from '../src/world/world';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { applyPlan, dragCells, planTool } from '../src/world/tools';
import { TICKS_PER_MONTH } from '../src/config';
import { builtBasicZones } from '../src/sim/news';
import { Simulation, newSimState } from '../src/sim/simulation';

function flat(n = 32): Terrain {
  const s = n + 1;
  return { n, corners: new Uint8Array(s * s).fill(SEA_LEVEL + 1), trees: new Uint8Array(n * n) };
}

function build(w: World, tool: Parameters<typeof planTool>[1], ax: number, ay: number, bx = ax, by = ay) {
  applyPlan(w, planTool(w, tool, dragCells(tool, ax, ay, bx, by, 1, w.n)));
}

/** A world with `r`, `c` and `i` built (level 1) lots of each basic zone. No power: nothing grows by itself. */
function city(r: number, c: number, i: number): World {
  const w = new World(flat());
  const kinds: [Parameters<typeof planTool>[1], number, number][] = [
    ['zoneR', 0, r],
    ['zoneC', 5, c],
    ['zoneI', 10, i],
  ];
  for (const [tool, y, count] of kinds) {
    for (let k = 0; k < count; k++) {
      build(w, tool, k, y);
      w.setLevel(w.idx(k, y), 1);
    }
  }
  return w;
}

const OPENING = /sale a la calle/;
const opening = (sim: Simulation) => sim.state.news.filter((n) => OPENING.test(n.text));
const months = (sim: Simulation, m: number) => {
  for (let t = 0; t < TICKS_PER_MONTH * m; t++) sim.tick();
};

describe('the newspaper explains the reach of the light', () => {
  it('tells the Intendente about lots that no building or plant lights, once the paper is open', () => {
    const w = city(3, 3, 3);
    build(w, 'plant', 20, 20);
    build(w, 'zoneR', 0, 20, 10, 21); // far from the plant and from every building
    const sim = new Simulation(w, newSimState(1), 'Villa Test');
    sim.state.news.push({ date: 'Ene 1990', text: 'x' }); // the paper is open
    months(sim, 1);
    expect(sim.state.news.some((n) => /hasta 3 lotes.*tendido eléctrico/.test(n.text))).toBe(true);
  });
});

describe('the newspaper opens late', () => {
  it('always starts with the founding headline, even in an empty city', () => {
    const sim = new Simulation(new World(flat()), newSimState(1), 'Villa Test');
    expect(sim.state.news).toHaveLength(1);
    expect(sim.state.news[0].text).toContain('Se funda Villa Test');
  });

  it('writes nothing besides the founding headline with no built lots at all', () => {
    const w = new World(flat());
    build(w, 'zoneR', 0, 0, 5, 3); // zoned but nothing built: the "no power" hint would fire if the paper were open
    const sim = new Simulation(w, newSimState(1), 'Villa Test');
    months(sim, 8);
    expect(sim.state.news).toHaveLength(1);
  });

  it.each([
    [1, 1, 1],
    [2, 2, 1],
    [2, 1, 2],
    [1, 2, 2],
    [5, 5, 0],
  ])('stays silent with %i homes, %i shops and %i workshops', (r, c, i) => {
    const sim = new Simulation(city(r, c, i), newSimState(1), 'Villa Test');
    months(sim, 8);
    expect(sim.state.news).toHaveLength(1);
    expect(sim.state.hints).toEqual({}); // advice cooldowns do not start while the paper is closed
  });

  it('counts only built, non-burning lots of each basic zone', () => {
    const w = city(2, 2, 2);
    expect(builtBasicZones(w)).toEqual({ R: 2, C: 2, I: 2 });
    w.fire[w.idx(0, 10)] = 30; // burning: does not count
    w.setLevel(w.idx(1, 5), 0); // zoned but empty: does not count
    w.abandoned[w.idx(0, 0)] = 1; // empty of people but still built: counts
    expect(builtBasicZones(w)).toEqual({ R: 2, C: 1, I: 1 });
    build(w, 'park', 20, 20); // other tiles never count
    expect(builtBasicZones(w)).toEqual({ R: 2, C: 1, I: 1 });
  });

  it('opens at the end of the month in which there are two of each, with one opening headline', () => {
    const sim = new Simulation(city(2, 2, 2), newSimState(1), 'Villa Test');
    months(sim, 1);
    expect(opening(sim)).toHaveLength(1);
    expect(opening(sim)[0].text).toContain('Villa Test');
    expect(sim.state.news.length).toBeGreaterThan(1);
    months(sim, 12);
    expect(opening(sim)).toHaveLength(1);
  });

  it('opens the month the second building of the last kind goes up', () => {
    const w = city(3, 3, 1);
    const sim = new Simulation(w, newSimState(1), 'Villa Test');
    months(sim, 2);
    expect(sim.state.news).toHaveLength(1);
    build(w, 'zoneI', 1, 10);
    w.setLevel(w.idx(1, 10), 1);
    months(sim, 1);
    expect(opening(sim)).toHaveLength(1);
  });

  it('stays open after the buildings burn down: the paper cannot go silent again', () => {
    const w = city(2, 2, 2);
    const sim = new Simulation(w, newSimState(1), 'Villa Test');
    months(sim, 1);
    expect(opening(sim)).toHaveLength(1);
    for (let i = 0; i < w.level.length; i++) w.setLevel(i, 0);
    const before = sim.state.news.length;
    months(sim, 8); // the "no power" advice comes back after its cooldown
    expect(sim.state.news.length).toBeGreaterThan(before);
    expect(opening(sim)).toHaveLength(1);
  });

  it('keeps fire headlines out of the paper until it opens', () => {
    const w = city(1, 1, 1);
    for (let i = 0; i < w.level.length; i++) if (w.tiles[i] === TILE.I && w.level[i] > 0) w.level[i] = 2;
    const sim = new Simulation(w, newSimState(1), 'Villa Test');
    const ignite = (sim as unknown as { ignite(i: number): void }).ignite.bind(sim);
    ignite(w.idx(0, 10));
    expect(sim.state.news).toHaveLength(1);
    expect(sim.stats.firesStarted).toBe(1); // the fire itself still happens

    const open = city(2, 2, 2);
    for (let i = 0; i < open.level.length; i++) if (open.tiles[i] === TILE.I) open.level[i] = 2;
    const sim2 = new Simulation(open, newSimState(1), 'Villa Test');
    months(sim2, 1);
    const n = sim2.state.news.length;
    (sim2 as unknown as { ignite(i: number): void }).ignite(open.idx(0, 10));
    expect(sim2.state.news.length).toBe(n + 1);
    expect(sim2.state.news[0].text).toContain('ncendio');
  });

  it('treats a saved game with several headlines as an open paper', () => {
    const w = new World(flat());
    build(w, 'zoneR', 0, 0, 5, 3);
    const state = newSimState(1);
    state.tick = TICKS_PER_MONTH * 5;
    state.news = [
      { date: 'May 1990', text: 'Una noticia' },
      { date: 'Feb 1990', text: 'Otra noticia' },
      { date: 'Ene 1990', text: 'Se funda Villa Test: el Intendente promete calles, luz y progreso' },
    ];
    const sim = new Simulation(w, state, 'Villa Test');
    months(sim, 1);
    expect(sim.state.news.length).toBeGreaterThan(3); // the "no power" advice made it into the paper
    expect(opening(sim)).toHaveLength(0); // and no opening headline is added
  });

  it('does not write a founding headline when loading a started game with no news', () => {
    const state = newSimState(1);
    state.tick = TICKS_PER_MONTH * 3;
    const sim = new Simulation(new World(flat()), state, 'Villa Test');
    expect(sim.state.news).toHaveLength(0);
  });
});
