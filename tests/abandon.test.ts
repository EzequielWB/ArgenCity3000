import { describe, expect, it } from 'vitest';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { World, TILE } from '../src/world/world';
import { applyPlan, dragCells, planTool, type ToolId } from '../src/world/tools';
import { ANGER, CAPACITY, TICKS_PER_MONTH } from '../src/config';
import { cityTotals, computeDemand } from '../src/sim/demand';
import { computePower } from '../src/sim/power';
import { computeLandValue, computePollution } from '../src/sim/fields';
import { Simulation, newSimState } from '../src/sim/simulation';
import { deserialize, serialize } from '../src/save/save';
import { describeCell } from '../src/sim/report';

function flat(n = 32): Terrain {
  return { n, corners: new Uint8Array((n + 1) * (n + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(n * n) };
}

function build(w: World, tool: ToolId, ax: number, ay: number, bx = ax, by = ay) {
  applyPlan(w, planTool(w, tool, dragCells(tool, ax, ay, bx, by, 1, w.n)));
}

function starter(): World {
  const w = new World(flat());
  build(w, 'plant', 0, 1);
  build(w, 'road', 0, 3, 31, 3);
  build(w, 'road', 0, 9, 31, 9);
  // Roads carry no light: a power line runs from the plant along the middle row between the zones.
  build(w, 'line', 0, 4, 0, 6);
  build(w, 'line', 1, 6, 31, 6);
  build(w, 'zoneR', 2, 4, 20, 5);
  build(w, 'zoneR', 2, 7, 20, 8);
  build(w, 'zoneI', 22, 4, 31, 8);
  build(w, 'zoneC', 2, 10, 20, 11);
  return w;
}

const countAbandoned = (w: World) => w.abandoned.reduce((a, b) => a + b, 0);

describe('abandoned buildings', () => {
  it('house nobody: no residents, no jobs, no power use', () => {
    const w = new World(flat());
    build(w, 'plant', 0, 0);
    build(w, 'zoneR', 2, 0, 3, 0);
    w.level[w.idx(2, 0)] = 3;
    w.level[w.idx(3, 0)] = 3;
    w.abandoned[w.idx(3, 0)] = 1;
    expect(cityTotals(w).pop).toBe(CAPACITY.R[3]);
    expect(computePower(w).use).toBe(computePower(new World(flat())).use + 3 * 2);
  });

  it('lower the land value around them', () => {
    const w = new World(flat());
    build(w, 'zoneR', 10, 10);
    w.level[w.idx(10, 10)] = 2;
    computePollution(w);
    computeLandValue(w);
    const before = w.landValue[w.idx(11, 10)];
    w.abandoned[w.idx(10, 10)] = 1;
    computeLandValue(w);
    expect(w.landValue[w.idx(11, 10)]).toBeLessThan(before);
  });

  it('are cleared by the bulldozer', () => {
    const w = new World(flat());
    build(w, 'zoneR', 4, 4);
    w.level[w.idx(4, 4)] = 2;
    w.abandoned[w.idx(4, 4)] = 1;
    build(w, 'bulldoze', 4, 4);
    expect(w.abandoned[w.idx(4, 4)]).toBe(0);
  });

  it('take months to empty a street after the power goes out, not days', () => {
    const w = starter();
    const sim = new Simulation(w, newSimState(5), 'X');
    for (let i = 0; i < TICKS_PER_MONTH * 24; i++) sim.tick();
    let built = 0;
    for (let i = 0; i < w.tiles.length; i++) if (w.level[i] > 0 && !w.abandoned[i]) built++;
    build(w, 'bulldoze', 0, 1);
    for (let i = 0; i < TICKS_PER_MONTH * 2; i++) sim.tick();
    expect(countAbandoned(w)).toBeLessThan(built / 3);
  });

  it('an unanswered complaint costs about two years of patience, not a month', () => {
    const w = starter();
    const sim = new Simulation(w, newSimState(5), 'X');
    for (let i = 0; i < TICKS_PER_MONTH * 24; i++) sim.tick();
    const i = w.idx(4, 4);
    expect(w.level[i]).toBeGreaterThan(0);
    expect(sim.unrest(i, 'R')).toEqual({ rise: 0, worst: null });
    // Lo único que falla es la luz de ese lote: el enojo sube de a un paso por mes.
    const light = sim.unrest(i, 'R').rise;
    w.powered[i] = 0;
    const { rise, worst } = sim.unrest(i, 'R');
    expect(light).toBe(0);
    expect(worst).toBe('power');
    // De 24 a 36 meses: el jugador tiene dos años largos para reaccionar.
    expect(Math.ceil(100 / Math.min(10, rise))).toBeGreaterThanOrEqual(24);
    expect(Math.ceil(100 / Math.min(10, rise))).toBeLessThanOrEqual(36);
  });

  it('two years without what they ask for empty the street, and the light brings the neighbours back', () => {
    const w = starter();
    const sim = new Simulation(w, newSimState(5), 'X');
    for (let i = 0; i < TICKS_PER_MONTH * 24; i++) sim.tick();
    const pop = cityTotals(w).pop;
    expect(pop).toBeGreaterThan(200);
    build(w, 'bulldoze', 0, 1);
    for (let i = 0; i < TICKS_PER_MONTH * 26; i++) sim.tick();
    const abandoned = countAbandoned(w);
    expect(abandoned).toBeGreaterThan(10);
    expect(cityTotals(w).pop).toBeLessThan(pop);
    // Buildings stay standing (level kept) while abandoned.
    for (let i = 0; i < w.tiles.length; i++) if (w.abandoned[i]) expect(w.level[i]).toBeGreaterThan(0);
    build(w, 'plant', 0, 1);
    for (let i = 0; i < TICKS_PER_MONTH * 18; i++) sim.tick();
    expect(countAbandoned(w)).toBeLessThan(abandoned);
  });
});

describe('the patience of the neighbours', () => {
  /** A city that has grown for two years, with its light and its streets. */
  function grown(): { w: World; sim: Simulation } {
    const w = starter();
    const sim = new Simulation(w, newSimState(5), 'X');
    for (let i = 0; i < TICKS_PER_MONTH * 24; i++) sim.tick();
    return { w, sim };
  }

  it('grows for every complaint that nobody answers, and only with them', () => {
    const { w, sim } = grown();
    const i = w.idx(4, 4);
    expect(w.level[i]).toBeGreaterThan(0);
    expect(sim.unrest(i, 'R')).toEqual({ rise: 0, worst: null });
    // El humo en una vivienda gasta paciencia; en una fábrica no.
    w.pollution[i] = 90;
    expect(sim.unrest(i, 'R')).toEqual({ rise: ANGER.smoke, worst: 'smoke' });
    expect(sim.unrest(i, 'I').rise).toBe(0);
    w.pollution[i] = 0;
    // La calle saturada también.
    w.jam[i] = 255;
    expect(sim.unrest(i, 'R')).toEqual({ rise: ANGER.jam, worst: 'jam' });
  });

  it('is worn down by the buildings that already emptied next door', () => {
    const { w, sim } = grown();
    const home = w.idx(4, 4);
    const next = w.idx(5, 4);
    expect(w.level[next]).toBeGreaterThan(0);
    expect(sim.unrest(home, 'R')).toEqual({ rise: 0, worst: null });
    sim.abandonBuilding(next);
    sim.refresh();
    expect(sim.unrest(home, 'R')).toEqual({ rise: ANGER.vacant, worst: 'vacant' });
    // Mientras el enojo es bajo la ficha sigue hablando de crecer; cuando pasa el umbral, dice qué
    // está vaciando el barrio: el vacío de al lado no se arregla con luz, se arregla demoliendo.
    expect(describeCell(w, sim, 4, 4).hint).not.toContain('demolé');
    w.anger[home] = 60;
    expect(describeCell(w, sim, 4, 4).hint).toContain('demolé los que quedaron vacíos');
  });

  it('is forgiven once what was wrong is fixed, and nobody has to leave', () => {
    const { w, sim } = grown();
    const i = w.idx(4, 4);
    w.anger[i] = 80;
    // Un mes sin nada malo: se le resta lo que perdona por mes.
    for (let k = 0; k < TICKS_PER_MONTH; k++) sim.tick();
    expect(w.anger[i]).toBe(80 - ANGER.forgive);
    for (let k = 0; k < TICKS_PER_MONTH * 10; k++) sim.tick();
    expect(w.anger[i]).toBe(0);
    expect(w.abandoned[i]).toBe(0);
  });

  it('says on the card how angry the block is and how long the building has', () => {
    const { w, sim } = grown();
    const i = w.idx(4, 4);
    w.anger[i] = 48;
    w.powered[i] = 0;
    const card = describeCell(w, sim, 4, 4);
    expect(card.lines.join(' | ')).toContain(`Enojo del barrio: 48 % · se vacía en ~${Math.ceil((100 - 48) / ANGER.served)} meses`);
    // Arriba del umbral, la ficha deja de aconsejar cómo crecer y dice qué lo está vaciando.
    w.anger[i] = 60;
    expect(describeCell(w, sim, 4, 4).hint).toBe('Sin luz no hay casa que aguante: que la luz llegue acá antes de que se vacíe.');
  });

  it('travels with the save and comes back with the city', () => {
    const { w, sim } = grown();
    w.anger[w.idx(4, 4)] = 55;
    const back = deserialize(serialize({ name: 'X', seed: 5, world: w, sim: sim.state }));
    expect(back.world.anger[w.idx(4, 4)]).toBe(55);
  });
});

describe('conditional growth appetite', () => {
  it('a city without the extra appetite wants less', () => {
    const t = { pop: 1000, cJobs: 170, iJobs: 380 };
    const boom = computeDemand(t, 7, 1.1);
    const flatDemand = computeDemand(t, 7, 1);
    expect(flatDemand.R).toBeLessThan(boom.R);
    expect(flatDemand.C).toBeLessThan(boom.C);
    expect(flatDemand.I).toBeLessThan(boom.I);
  });

  it('turns the appetite off during blackouts and with high taxes', () => {
    const w = new World(flat());
    build(w, 'plant', 0, 0);
    build(w, 'zoneI', 2, 0, 31, 31);
    for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === TILE.I) w.level[i] = 4;
    const sim = new Simulation(w, newSimState(1), 'X');
    expect(sim.power.shortage).toBe(true);
    expect(sim.appetite).toBe(1);

    const ok = new Simulation(new World(flat()), newSimState(1), 'Y');
    expect(ok.appetite).toBeGreaterThan(1);
    ok.setTax(12); // taxes fade the appetite from 9 % and switch it off at 15 %
    expect(ok.appetite).toBeGreaterThan(1);
    expect(ok.appetite).toBeLessThan(sim.appetite + 1);
    ok.setTax(16);
    expect(ok.appetite).toBe(1);
  });
});

describe('save with abandoned buildings', () => {
  it('round-trips the abandoned flags', () => {
    const w = starter();
    w.level[w.idx(3, 4)] = 2;
    w.abandoned[w.idx(3, 4)] = 1;
    const sim = new Simulation(w, newSimState(1), 'X');
    const back = deserialize(serialize({ name: 'X', seed: 1, world: w, sim: sim.state }));
    expect(back.world.abandoned[w.idx(3, 4)]).toBe(1);
  });

  it('still loads saves from the first version', () => {
    const w = starter();
    const sim = new Simulation(w, newSimState(1), 'X');
    const data = JSON.parse(serialize({ name: 'X', seed: 1, world: w, sim: sim.state }));
    data.version = 1;
    delete data.abandoned;
    delete data.fire;
    if (data.sim.lastBudget) delete data.sim.lastBudget.services;
    const back = deserialize(JSON.stringify(data));
    expect(Array.from(back.world.tiles)).toEqual(Array.from(w.tiles));
    expect(countAbandoned(back.world)).toBe(0);
  });
});
