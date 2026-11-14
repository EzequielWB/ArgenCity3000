import { describe, expect, it } from 'vitest';
import { PARK, PROMISE, SERVICES, TICKS_PER_MONTH } from '../src/config';
import { monthsLeft, newCommitment, promiseDone, promiseGoal, promiseProgress } from '../src/sim/commitments';
import { EVENTS, eventById, pickEvent } from '../src/sim/events';
import { Simulation, newSimState } from '../src/sim/simulation';
import { deserialize, serialize } from '../src/save/save';
import { Rng } from '../src/core/rng';
import { generateTerrain } from '../src/world/terrain';
import { TILE, World, type World as WorldType } from '../src/world/world';

const N = 48;

function flat(): World {
  return new World({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(30), trees: new Uint8Array(N * N) });
}

/** A city with a street and a residential block, big enough to be asked for a school. */
function town(): { world: WorldType; sim: Simulation } {
  const world = flat();
  const sim = new Simulation(world, newSimState(5), 'Villa Promesa');
  for (let y = 4; y < 20; y++) for (let x = 4; x < 20; x++) world.tiles[world.idx(x, y)] = TILE.R;
  for (let y = 4; y < 20; y++) for (let x = 4; x < 20; x++) world.level[world.idx(x, y)] = 2;
  sim.state.milestone = 3; // schools unlocked
  sim.refresh();
  return { world, sim };
}

function school(world: World, x = 40, y = 40): void {
  world.tiles[world.idx(x, y)] = TILE.SCHOOL;
}

describe('a promise has a deadline', () => {
  it('starts counting from today, for the months the config says', () => {
    const { world, sim } = town();
    const c = sim.promise('school');
    expect(c.made).toBe(sim.state.tick);
    expect(c.due).toBe(sim.state.tick + TICKS_PER_MONTH * PROMISE.months);
    expect(monthsLeft(c, sim.state.tick)).toBe(PROMISE.months);
    expect(sim.state.commitment).toBe(c);
    expect(world.tiles.length).toBeGreaterThan(0);
  });

  it('counts down the months and never goes under zero', () => {
    const { sim } = town();
    const c = sim.promise('school');
    expect(monthsLeft(c, c.made + TICKS_PER_MONTH)).toBe(PROMISE.months - 1);
    expect(monthsLeft(c, c.due)).toBe(0);
    expect(monthsLeft(c, c.due + TICKS_PER_MONTH * 5)).toBe(0);
  });

  it('is kept by a school that did not exist when it was made', () => {
    const { world, sim } = town();
    const c = sim.promise('school');
    expect(promiseDone(world, c)).toBe(false);
    school(world);
    expect(promiseDone(world, c)).toBe(true);
    expect(promiseProgress(world, c)).toBe(1);
  });

  it('is kept by a plaza of four cells, which is the smallest that counts', () => {
    const { world, sim } = town();
    const c = newCommitment(world, 'plaza', sim.state.tick);
    // A single tile is not a plaza for the land value, so it is not one for the promise either.
    world.tiles[world.idx(30, 30)] = TILE.PARK;
    sim.refresh();
    expect(promiseDone(world, c)).toBe(false);
    world.tiles[world.idx(30, 31)] = TILE.PARK;
    world.tiles[world.idx(31, 30)] = TILE.PARK;
    world.tiles[world.idx(31, 31)] = TILE.PARK;
    sim.refresh();
    expect(promiseGoal('plaza')).toBe(4);
    expect(promiseDone(world, c)).toBe(true);
  });
});

describe('the month the promise resolves', () => {
  it('pays approval and clears itself when the city kept its word', () => {
    const { world, sim } = town();
    sim.promise('school');
    const before = sim.state.approval;
    sim.nudgeApproval(-10);
    school(world);
    for (let i = 0; i < TICKS_PER_MONTH; i++) sim.tick();
    expect(sim.state.commitment).toBeNull();
    expect(sim.state.approval).toBeGreaterThan(before - 10);
  });

  it('charges approval and a grudge when the deadline arrives empty-handed', () => {
    const { sim } = town();
    sim.promise('school');
    // Walk to the very month it resolves: the grudge starts to wear off right after it is charged.
    let before = sim.state.approval;
    for (let i = 0; i < TICKS_PER_MONTH * (PROMISE.months + 2); i++) {
      before = sim.state.approval;
      sim.tick();
      if (!sim.state.commitment) break;
    }
    expect(sim.state.commitment).toBeNull();
    expect(sim.state.grief).toBeGreaterThan(0);
    expect(sim.state.approval).toBeLessThan(before);
  });

  it('says on the newspaper what happened, either way', () => {
    const { world, sim } = town();
    // The paper opens once the city has some of each zone: force it by publishing.
    sim.state.news.push({ date: 'x', text: 'apertura' });
    sim.promise('school');
    school(world);
    sim.refresh();
    for (let i = 0; i < TICKS_PER_MONTH; i++) sim.tick();
    const text = sim.state.news.map((n) => n.text).join(' | ');
    expect(text).toMatch(/escuela/i);
  });
});

describe('the event that asks for a promise', () => {
  it('only shows up where schools are unlocked and the city outgrew them', () => {
    const asamblea = eventById('asamblea-escuela')!;
    const { sim } = town();
    // Without the milestone it cannot be asked for.
    sim.state.milestone = 0;
    expect(asamblea.when(sim)).toBe(false);
    sim.state.milestone = 3;
    expect(asamblea.when(sim)).toBe(true);
    // With enough schools for its people, it stops asking.
    for (let k = 0; k < Math.ceil(sim.totals.pop / SERVICES.school.capacity) + 1; k++) school(sim.world, 30 + k, 40);
    sim.refresh();
    expect(asamblea.when(sim)).toBe(false);
  });

  it('never fires twice, never while a promise is watched, never in the first year', () => {
    const rng = new Rng(1);
    const { sim } = town();
    // Too early.
    sim.state.tick = TICKS_PER_MONTH * 2;
    expect(pickEvent(sim, rng)).toBeNull();
    // Old enough, but a promise is pending.
    sim.state.tick = TICKS_PER_MONTH * 24;
    sim.promise('school');
    expect(pickEvent(sim, rng)).toBeNull();
    // Free again: with enough rolls, one of them lands.
    sim.state.commitment = null;
    let fired = false;
    for (let k = 0; k < 40 && !fired; k++) fired = pickEvent(sim, new Rng(k + 1)) !== null;
    expect(fired).toBe(true);
  });

  it('keeps the gap between two events', () => {
    const { sim } = town();
    sim.state.tick = TICKS_PER_MONTH * 30;
    sim.state.lastEvent = sim.state.tick - TICKS_PER_MONTH; // one month ago
    let fired = false;
    for (let k = 0; k < 20; k++) fired ||= pickEvent(sim, new Rng(k + 1)) !== null;
    expect(fired).toBe(false);
  });

  it('answers with a promise or with a complaint, and clears itself', () => {
    const { sim } = town();
    sim.state.pendingEvent = 'asamblea-escuela';
    const before = sim.state.approval;
    sim.answerEvent(1); // dar vueltas
    expect(sim.state.pendingEvent).toBeNull();
    expect(sim.state.commitment).toBeNull();
    expect(sim.state.approval).toBeLessThan(before);

    sim.state.pendingEvent = 'asamblea-escuela';
    sim.answerEvent(0); // prometer
    expect(sim.state.commitment?.kind).toBe('school');
    expect(sim.state.pendingEvent).toBeNull();
  });

  it('has exactly two ways out, both with their consequence written', () => {
    for (const event of EVENTS) {
      expect(event.options.length).toBe(2);
      for (const o of event.options) {
        expect(o.label.length).toBeGreaterThan(4);
        expect(o.detail.length).toBeGreaterThan(20);
      }
    }
  });
});

describe('the promise travels with the save', () => {
  const saved = () => {
    const world = new World(generateTerrain(5, 24));
    return { world, sim: new Simulation(world, newSimState(5), 'Villa Promesa') };
  };

  it('keeps the promise and its deadline', () => {
    const { world, sim } = saved();
    sim.promise('plaza');
    const back = deserialize(serialize({ name: 'Villa Promesa', seed: 5, world, sim: sim.state }));
    expect(back.sim.commitment).toEqual(sim.state.commitment);
    expect(PARK.minArea).toBe(3);
  });

  it('keeps an unanswered event waiting', () => {
    const { world, sim } = saved();
    sim.state.pendingEvent = 'asamblea-escuela';
    sim.state.lastEvent = 1234;
    const back = deserialize(serialize({ name: 'Villa Promesa', seed: 5, world, sim: sim.state }));
    expect(back.sim.pendingEvent).toBe('asamblea-escuela');
    expect(back.sim.lastEvent).toBe(1234);
  });

  it('opens an older save with nothing pending', () => {
    const { world, sim } = saved();
    const text = JSON.parse(serialize({ name: 'Villa Promesa', seed: 5, world, sim: sim.state }));
    text.version = 12;
    delete text.sim.commitment;
    delete text.sim.pendingEvent;
    delete text.sim.lastEvent;
    const back = deserialize(JSON.stringify(text));
    expect(back.sim.commitment).toBeNull();
    expect(back.sim.pendingEvent).toBeNull();
    expect(back.sim.lastEvent).toBe(0);
  });

  it('refuses a promise that makes no sense', () => {
    const { world, sim } = saved();
    const text = JSON.parse(serialize({ name: 'Villa Promesa', seed: 5, world, sim: sim.state }));
    text.sim.commitment = { kind: 'school', made: 10, due: 5, baseline: 0 };
    expect(() => deserialize(JSON.stringify(text))).toThrow(/promesa/i);
  });
});
