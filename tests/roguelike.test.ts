import { describe, expect, it } from 'vitest';
import { CAPACITY, DEFAULT_FUNDING, MAX_FUNDING, TICKS_PER_MONTH } from '../src/config';
import { deserialize, serialize } from '../src/save/save';
import { monthlyBudget } from '../src/sim/budget';
import { addBuilding, cityTotals } from '../src/sim/demand';
import { NO_MODS, RUN_DRY_MONTHS, RUN_GOAL, RUN_MARKS, UPGRADES, dueMark, newRun, openOffer, runMods, runOver, takeUpgrade, upgradeById } from '../src/sim/roguelike';
import { Simulation, newSimState } from '../src/sim/simulation';
import { upgradeCardsHtml } from '../src/ui/upgrades';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { TILE, World } from '../src/world/world';

function flat(n: number): Terrain {
  const s = n + 1;
  return { n, corners: new Uint8Array(s * s).fill(SEA_LEVEL + 1), trees: new Uint8Array(n * n) };
}

/**
 * A finished city of about `pop` residents, with the jobs and the public services the real rules ask
 * for, every zoned building at level 5. The economy of the million is what this is for.
 */
function cityOf(pop: number, n = 128): World {
  const w = new World(flat(n));
  let i = 0;
  for (const [tile, count] of [
    [TILE.R, Math.ceil(pop / CAPACITY.R[5])],
    [TILE.C, Math.ceil((pop * 0.15) / CAPACITY.C[5])],
    [TILE.I, Math.ceil((pop * 0.35) / CAPACITY.I[5])],
  ] as const) {
    for (let k = 0; k < count; k++, i++) {
      w.tiles[i] = tile;
      w.setLevel(i, 5);
    }
  }
  for (const [tile, capacity] of [
    [TILE.SCHOOL, 6000],
    [TILE.CLINIC, 6000],
    [TILE.POLICE, 8000],
    [TILE.FIREHOUSE, 10000],
    [TILE.HOSPITAL, 20000],
    [TILE.UNIVERSITY, 25000],
  ] as const) {
    for (let k = Math.ceil(pop / capacity); k > 0; k--, i++) w.tiles[i] = tile;
  }
  return w;
}

/** The budget of a city with a given set of knobs, at its best tax rate. */
const budgetWith = (w: World, tax: number, mods: typeof NO_MODS) =>
  monthlyBudget(w, tax, DEFAULT_FUNDING, null, 6, 100, 1, 100, 'democracia', 1, MAX_FUNDING, MAX_FUNDING, mods);

describe('roguelike', () => {
  it('no toca el modo clásico ni un número', () => {
    const w = cityOf(20000, 64);
    expect(cityTotals(w, NO_MODS)).toEqual(cityTotals(w));
    expect(budgetWith(w, 7, NO_MODS)).toEqual(monthlyBudget(w, 7, DEFAULT_FUNDING, null, 6, 100, 1, 100, 'democracia', 1, MAX_FUNDING, MAX_FUNDING));
  });

  it('sortea tres cartas distintas, una de cada clase, y las mismas para el mismo seed', () => {
    const a = newRun(42);
    openOffer(a);
    const b = newRun(42);
    openOffer(b);
    expect(a.offer).toEqual(b.offer);
    expect(a.offer).toHaveLength(3);
    expect(new Set(a.offer).size).toBe(3);
    expect(new Set(a.offer!.map((id) => upgradeById(id)!.kind)).size).toBe(3);
  });

  it('una mejora tomada no vuelve a salir, y cada toma avanza la marca', () => {
    const run = newRun(7);
    const taken = new Set<string>();
    for (let k = 0; k < RUN_MARKS.length; k++) {
      expect(dueMark(run, RUN_MARKS[run.next])).toBe(run.next);
      openOffer(run);
      for (const id of run.offer!) expect(taken.has(id)).toBe(false);
      const pick = run.offer![0];
      expect(takeUpgrade(run, pick, 0)).toBe(true);
      expect(takeUpgrade(run, pick, 0)).toBe(false); // the table is empty now
      taken.add(pick);
      expect(run.next).toBe(k + 1);
    }
    expect(taken.size).toBe(RUN_MARKS.length);
    expect(dueMark(run, RUN_GOAL)).toBeNull();
    expect(RUN_MARKS[RUN_MARKS.length - 1]).toBeLessThan(RUN_GOAL);
  });

  it('una semilla cuesta ahora y paga después', () => {
    const run = newRun(3);
    openOffer(run);
    run.offer = ['zona-franca'];
    expect(takeUpgrade(run, 'zona-franca', 0)).toBe(true);
    expect(runMods(run, 0).income).toBeCloseTo(0.75);
    expect(runMods(run, 47 * TICKS_PER_MONTH).income).toBeCloseTo(0.75);
    expect(runMods(run, 48 * TICKS_PER_MONTH).income).toBeCloseTo(0.75 * 1.7);
    expect(runMods(run, 48 * TICKS_PER_MONTH).jobs).toBeCloseTo(1.2);
  });

  it('la densidad multiplica la gente del edificio y descontar cancela la cuenta', () => {
    const t = { pop: 0, cJobs: 0, iJobs: 0 };
    const mods = { ...NO_MODS, density: 1.5 };
    addBuilding(t, TILE.R, 5, 1, mods);
    expect(t.pop).toBe(Math.round(CAPACITY.R[5] * 1.5));
    addBuilding(t, TILE.R, 5, -1, mods);
    expect(t.pop).toBe(0);
  });

  it('una mejora de densidad llena la ciudad en el acto', () => {
    const w = new World(flat(32));
    for (let i = 0; i < 4; i++) {
      w.tiles[i] = TILE.R;
      w.setLevel(i, 5);
    }
    const sim = new Simulation(w, newSimState(1, 'democracia', '', newRun(1)), 'Villa Run');
    expect(sim.totals.pop).toBe(4 * CAPACITY.R[5]);
    sim.state.run!.offer = ['torres'];
    expect(sim.applyUpgrade('torres')).toBe(true);
    expect(sim.totals.pop).toBe(4 * Math.round(CAPACITY.R[5] * 1.3));
  });

  it('la reforma administrativa mata el término cuadrático', () => {
    const w = cityOf(500000);
    const pop = cityTotals(w).pop;
    const plain = monthlyBudget(w, 7).services;
    const reformed = budgetWith(w, 7, { ...NO_MODS, adminCurve: 0 }).services;
    expect(reformed).toBe(Math.round(pop * 0.1));
    expect(plain).toBeGreaterThan(reformed * 3);
  });

  it('se pierde con la elección y con dos años seguidos en rojo', () => {
    const run = newRun(1);
    expect(runOver({ run, lostElection: false })).toBeNull();
    expect(runOver({ run, lostElection: true })).toBe('eleccion');
    run.dry = RUN_DRY_MONTHS - 1;
    expect(runOver({ run, lostElection: false })).toBeNull();
    run.dry = RUN_DRY_MONTHS;
    expect(runOver({ run, lostElection: false })).toBe('caja');
    run.wonAt = 10;
    expect(runOver({ run, lostElection: true })).toBe('ganada');
    expect(runOver({ run: null, lostElection: true })).toBeNull();
  });

  it('se gana al llegar al millón', () => {
    const w = cityOf(RUN_GOAL);
    const sim = new Simulation(w, newSimState(1, 'democracia', '', newRun(1)), 'Villa Millón');
    expect(sim.totals.pop).toBe(RUN_GOAL);
    // Taking a card re-reads the city and checks the goal, which is the same door the month uses.
    sim.state.run!.offer = ['catastro'];
    expect(sim.applyUpgrade('catastro')).toBe(true);
    expect(sim.state.run!.wonAt).not.toBeNull();
  });

  it('la marca abre el sorteo sola', () => {
    const w = cityOf(RUN_MARKS[0], 64);
    const sim = new Simulation(w, newSimState(1, 'democracia', '', newRun(1)), 'Villa Pueblo');
    expect(sim.totals.pop).toBeGreaterThanOrEqual(RUN_MARKS[0]);
    expect(sim.state.run!.offer).toBeNull();
    sim.tick();
    expect(sim.state.run!.offer).toHaveLength(3);
  });

  it('el millón cierra la cuenta con el stack de mejoras', () => {
    const w = cityOf(RUN_GOAL);
    const sim = new Simulation(w, newSimState(1, 'democracia', '', newRun(1)), 'Villa Millón');
    // Las cuatro reformas administrativas del pool (0,5 × 0,55 × 0,5 × 0,45) y lo que las acompaña.
    const stack = { ...NO_MODS, adminCurve: 0.062, admin: 0.95, income: 1.15, serviceCost: 0.8, land: 12 };
    const b = budgetWith(w, 12, stack);
    expect(sim.totals.pop).toBe(RUN_GOAL);
    expect(b.balance).toBeGreaterThan(0);
    // Y sin las reformas, el mismo millón no se paga: la meta es de las mejoras, no del mapa.
    expect(budgetWith(w, 12, NO_MODS).balance).toBeLessThan(0);
  });

  it('guarda la run, y una partida de la versión anterior abre como clásica', () => {
    const w = cityOf(1000, 64);
    const sim = new Simulation(w, newSimState(1, 'democracia', '', newRun(1)), 'Villa Run');
    sim.state.run!.offer = ['torres'];
    expect(sim.applyUpgrade('torres')).toBe(true);
    const text = serialize({ name: 'Villa Run', seed: 1, world: w, sim: sim.state });
    expect(deserialize(text).sim.run).toEqual(sim.state.run);

    const old = JSON.parse(text);
    old.version = 17;
    delete old.sim.run;
    expect(deserialize(JSON.stringify(old)).sim.run).toBeNull();
  });

  it('cada carta dice su clase, su nombre y qué hace', () => {
    const html = upgradeCardsHtml(['torres', 'altura', 'zona-franca', 'no-existe']);
    expect(html.match(/data-upgrade=/g)).toHaveLength(3);
    for (const label of ['Solo buena', 'Con costo', 'A futuro']) expect(html).toContain(label);
    expect(html).toContain('up-semilla');
    expect(html).not.toContain('no-existe');
  });

  it('el pool es coherente: ids únicos y toda clase tiene cartas', () => {
    expect(new Set(UPGRADES.map((u) => u.id)).size).toBe(UPGRADES.length);
    for (const kind of ['buena', 'mixta', 'semilla'] as const) expect(UPGRADES.filter((u) => u.kind === kind).length).toBeGreaterThan(3);
    for (const u of UPGRADES) expect(u.stages.length).toBeGreaterThan(0);
  });
});
