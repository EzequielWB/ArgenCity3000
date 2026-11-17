import { describe, expect, it } from 'vitest';
import { CAPACITY, DEFAULT_FUNDING, MAX_FUNDING, SERVICE_SIZE, TICKS_PER_MONTH } from '../src/config';
import { deserialize, serialize } from '../src/save/save';
import { monthlyBudget } from '../src/sim/budget';
import { addBuilding, cityTotals } from '../src/sim/demand';
import { NO_MODS, RUN_DRY_MONTHS, RUN_GOAL, RUN_MARKS, RUN_PICKS, markOf, type RunMods, UPGRADES, dueMark, newRun, openOffer, runMods, runOver, takeUpgrade, upgradeById } from '../src/sim/roguelike';
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
  // The hospital and the university take `SERVICE_SIZE` lots on each side, so the plan has to take them
  // too: packing services lot by lot builds a plan the game itself cannot produce any more.
  let x = i % n;
  let y = Math.floor(i / n);
  for (const [kind, tile, capacity] of [
    ['school', TILE.SCHOOL, 6000],
    ['clinic', TILE.CLINIC, 6000],
    ['police', TILE.POLICE, 8000],
    ['fire', TILE.FIREHOUSE, 10000],
    ['hospital', TILE.HOSPITAL, 20000],
    ['university', TILE.UNIVERSITY, 25000],
  ] as const) {
    const size = SERVICE_SIZE[kind];
    for (let k = Math.ceil(pop / capacity); k > 0; k--) {
      if (x + size > n) {
        x = 0;
        y += size;
      }
      for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) w.tiles[(y + dy) * n + x + dx] = tile;
      x += size;
    }
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

  it('el mazo da la vuelta: ninguna carta queda enterrada y ninguna se repite sola', () => {
    // Lo que se ofrece y no se toma va al fondo del mazo, no se pierde: en ocho sorteos de tres
    // (veinticuatro lugares para veintidós cartas) el mazo tiene que haber pasado entero.
    for (let seed = 1; seed <= 20; seed++) {
      const run = newRun(seed);
      const shown = new Set<string>(run.offer!);
      const declined = run.offer!.slice(1);
      let cameBack = 0;
      for (let k = 0; k < 12; k++) {
        openOffer(run);
        for (const id of run.offer!) shown.add(id);
        if (run.offer!.some((id) => declined.includes(id))) cameBack++;
      }
      expect(shown.size).toBe(UPGRADES.length); // todas salieron: ninguna quedó abajo para siempre
      expect(new Set(run.seen).size).toBe(run.seen.length); // el mazo no se repite a sí mismo
      expect(cameBack).toBeGreaterThan(0); // y lo que declinaste volvió
    }
  });

  it('ninguna carta es gratis: todas dan algo y todas cobran algo', () => {
    // La regla del jugador: "todas tienen que tener algo bueno y algo malo". Un `bien` por perilla es
    // el sentido en el que el número mejora; lo que no es ni mejor ni peor es el valor neutro.
    const bien: Record<keyof RunMods, (v: number) => boolean> = {
      density: (v) => v > 1,
      jobs: (v) => v > 1,
      admin: (v) => v < 1,
      adminCurve: (v) => v < 1,
      land: (v) => v > 0,
      power: (v) => v > 1,
      growth: (v) => v > 1,
      migration: (v) => v > 1,
      income: (v) => v > 1,
      serviceCost: (v) => v < 1,
    };
    for (const u of UPGRADES) {
      // Las dos que se sortean no tienen números fijos: su mitad mala la decide la tirada.
      if (u.gamble) continue;
      let da = false;
      let cobra = false;
      for (const stage of u.stages) {
        for (const [k, v] of Object.entries(stage.mods) as [keyof RunMods, number][]) {
          if (bien[k](v)) da = true;
          else if (v !== NO_MODS[k]) cobra = true;
        }
      }
      expect({ id: u.id, da, cobra }).toEqual({ id: u.id, da: true, cobra: true });
    }
  });

  it('arranca con una carta en la mano, y una mejora tomada no vuelve a salir', () => {
    const run = newRun(7);
    const taken = new Set<string>();
    expect(run.next).toBe(-1);
    expect(markOf(run)).toBe(0);
    expect(dueMark(run, 0)).toBeNull(); // la carta de apertura no es una marca
    for (let k = 0; k < RUN_PICKS; k++) {
      expect(run.offer).toHaveLength(3);
      for (const id of run.offer!) expect(taken.has(id)).toBe(false);
      const pick = run.offer![0];
      expect(takeUpgrade(run, pick, 0)).not.toBeNull();
      expect(takeUpgrade(run, pick, 0)).toBeNull(); // the table is empty now
      taken.add(pick);
      expect(run.next).toBe(k);
      openOffer(run);
    }
    expect(taken.size).toBe(RUN_PICKS);
    expect(dueMark(run, RUN_GOAL)).toBeNull();
    expect(RUN_MARKS[RUN_MARKS.length - 1]).toBeLessThan(RUN_GOAL);
  });

  it('una semilla cuesta ahora y paga después', () => {
    const run = newRun(3);
    openOffer(run);
    run.offer = ['zona-franca'];
    expect(takeUpgrade(run, 'zona-franca', 0)).not.toBeNull();
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
    expect(sim.applyUpgrade('torres')).not.toBeNull();
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

  it('se gana al llegar a la meta', () => {
    const w = cityOf(RUN_GOAL);
    const sim = new Simulation(w, newSimState(1, 'democracia', '', newRun(1)), 'Villa Millón');
    expect(sim.totals.pop).toBe(RUN_GOAL);
    // Taking a card re-reads the city and checks the goal, which is the same door the month uses.
    sim.state.run!.offer = ['catastro'];
    expect(sim.applyUpgrade('catastro')).not.toBeNull();
    expect(sim.state.run!.wonAt).not.toBeNull();
  });

  it('la primera carta se juega antes de fundar, y no tapa la marca', () => {
    const w = cityOf(RUN_MARKS[0], 64);
    const run = newRun(1);
    const sim = new Simulation(w, newSimState(1, 'democracia', '', run), 'Villa Pueblo');
    expect(sim.totals.pop).toBeGreaterThanOrEqual(RUN_MARKS[0]);
    // La carta de apertura ya está en la mesa; hasta que se responde, la marca 500 no se reparte.
    expect(run.offer).toHaveLength(3);
    const opening = [...run.offer!];
    sim.tick();
    expect(run.offer).toEqual(opening);
    // Tomada la carta, la misma marca entra en el acto.
    expect(sim.applyUpgrade(opening[0])).not.toBeNull();
    expect(run.picks).toHaveLength(1);
    expect(run.next).toBe(0);
    expect(run.offer).toHaveLength(3);
    expect(run.offer).not.toEqual(opening);
  });

  it('la meta cierra la cuenta con el stack de mejoras', () => {
    const w = cityOf(RUN_GOAL);
    const sim = new Simulation(w, newSimState(1, 'democracia', '', newRun(1)), 'Villa Millón');
    // Las cuatro reformas administrativas del pool (0,5 × 0,55 × 0,5 × 0,45) y lo que las acompaña.
    const stack = { ...NO_MODS, adminCurve: 0.062, admin: 0.95, income: 1.15, serviceCost: 0.8, land: 12 };
    const b = budgetWith(w, 12, stack);
    expect(sim.totals.pop).toBe(RUN_GOAL);
    expect(b.balance).toBeGreaterThan(0);
    // Y sin las reformas, la misma población no se paga: la meta es de las mejoras, no del mapa.
    expect(budgetWith(w, 12, NO_MODS).balance).toBeLessThan(0);
  });

  it('guarda la run, y una partida de la versión anterior abre como clásica', () => {
    const w = cityOf(1000, 64);
    const sim = new Simulation(w, newSimState(1, 'democracia', '', newRun(1)), 'Villa Run');
    sim.state.run!.offer = ['torres'];
    expect(sim.applyUpgrade('torres')).not.toBeNull();
    const text = serialize({ name: 'Villa Run', seed: 1, world: w, sim: sim.state });
    expect(deserialize(text).sim.run).toEqual(sim.state.run);

    // Una run que todavía no respondió su carta de apertura la guarda también.
    const fresh = new Simulation(w, newSimState(1, 'democracia', '', newRun(4)), 'Villa Nueva');
    const freshText = serialize({ name: 'Villa Nueva', seed: 4, world: w, sim: fresh.state });
    const loaded = deserialize(freshText).sim.run!;
    expect(loaded.next).toBe(-1);
    expect(loaded.offer).toEqual(fresh.state.run!.offer);

    // A run saved before the deck existed opens with an empty one, not with a broken game.
    const noDeck = JSON.parse(text);
    delete noDeck.sim.run.seen;
    expect(deserialize(JSON.stringify(noDeck)).sim.run!.seen).toEqual([]);

    const old = JSON.parse(text);
    old.version = 17;
    delete old.sim.run;
    expect(deserialize(JSON.stringify(old)).sim.run).toBeNull();
  });

  it('el 50/50 duplica una cosa y reduce otra, nunca la misma', () => {
    const outcomes = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const run = newRun(seed);
      run.offer = ['cincuenta-cincuenta'];
      const r = takeUpgrade(run, 'cincuenta-cincuenta', 0)!;
      expect(r.outcome).toMatch(/^50\/50: /);
      expect(r.outcome).toContain('×2');
      expect(r.outcome).toContain('÷2');
      // Dos de las tres cosas se mueven, y la población va por la densidad.
      const moved = [r.cash, r.approval, run.picks[0].mods?.density].filter((v) => v !== undefined && v !== 1);
      expect(moved).toHaveLength(2);
      for (const v of moved) expect([0.5, 2]).toContain(v);
      outcomes.add(r.outcome!);
    }
    expect(outcomes.size).toBeGreaterThan(3); // el sorteo cambia con el seed
  });

  it('todo o nada triplica o parte a la mitad, y nunca las dos', () => {
    const outcomes = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const run = newRun(seed);
      run.offer = ['todo-o-nada'];
      const r = takeUpgrade(run, 'todo-o-nada', 0)!;
      expect(r.outcome).toMatch(/^Todo o nada: /);
      const tripled = r.outcome!.includes('×3');
      expect(tripled !== r.outcome!.includes('÷2')).toBe(true);
      for (const v of [r.cash, r.approval, run.picks[0].mods?.density ?? 1]) expect([0.5, 1, 3]).toContain(v);
      outcomes.add(r.outcome!);
    }
    expect(outcomes.size).toBeGreaterThan(3);
  });

  it('una carta de azar mueve la plata, la aprobación y la población de verdad', () => {
    const w = new World(flat(32));
    for (let i = 0; i < 4; i++) {
      w.tiles[i] = TILE.R;
      w.setLevel(i, 5);
    }
    // The same fresh run rolls the same thing here and in the simulation below.
    const probe = newRun(5);
    probe.offer = ['todo-o-nada'];
    const rolled = takeUpgrade(probe, 'todo-o-nada', 0)!;

    const sim = new Simulation(w, newSimState(1, 'democracia', '', newRun(5)), 'Villa Azar');
    const cash = sim.state.cash;
    const approval = sim.state.approval;
    expect(sim.totals.pop).toBe(4 * CAPACITY.R[5]);
    sim.state.run!.offer = ['todo-o-nada'];
    const result = sim.applyUpgrade('todo-o-nada')!;
    expect(result.outcome).toBe(rolled.outcome);
    expect(sim.state.cash).toBe(Math.round(cash * rolled.cash));
    expect(sim.state.approval).toBe(Math.max(0, Math.min(100, Math.round(approval * rolled.approval))));
    const density = rolled.outcome!.includes('Población') ? (rolled.outcome!.includes('÷2') ? 0.5 : 3) : 1;
    expect(sim.totals.pop).toBe(4 * Math.round(CAPACITY.R[5] * density));
  });

  it('una población partida a la mitad vale la mitad de habitantes al cargar', () => {
    const w = new World(flat(32));
    for (let i = 0; i < 4; i++) {
      w.tiles[i] = TILE.R;
      w.setLevel(i, 5);
    }
    const sim = new Simulation(w, newSimState(1, 'democracia', '', newRun(1)), 'Villa Mitad');
    const before = sim.totals.pop;
    sim.state.run!.picks.push({ id: 'cincuenta-cincuenta', at: 0, mods: { density: 0.5 }, outcome: '50/50: Plata ×2 · Población ÷2' });
    sim.refresh();
    expect(sim.totals.pop).toBe(before / 2);
  });

  it('baraja las cartas: la buena no sale siempre primera', () => {
    const first = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const run = newRun(seed);
      openOffer(run);
      first.add(upgradeById(run.offer![0])!.kind);
    }
    expect(first.size).toBe(3); // las tres clases pasaron por el primer lugar
  });

  it('cada carta dice su nombre y qué hace, sin contarte de qué clase es', () => {
    const html = upgradeCardsHtml(['torres', 'altura', 'zona-franca', 'no-existe']);
    expect(html.match(/data-upgrade=/g)).toHaveLength(3);
    expect(html).toContain('Torres de propiedad horizontal');
    for (const label of ['Solo buena', 'Con costo', 'A futuro']) expect(html).not.toContain(label);
    expect(html).not.toContain('no-existe');
  });

  it('la administración se explica siempre, y nunca con el costo de hoy', () => {
    // Cada carta que habla de la administración la explica, en sus dos formas: por lo que mueve
    // (`red`, `ramal`) y por lo que dice (`descentralizacion`). El precio de hoy no va: cambia solo.
    const html = upgradeCardsHtml(['descentralizacion', 'red', 'ramal', 'torres']);
    expect(html.match(/up-note/g)).toHaveLength(3); // las tres que la tocan, y sólo ellas
    expect(html).toContain('los sueldos, las oficinas y los trámites');
    expect(html).not.toMatch(/\$/); // ni un solo importe: la explicación no envejece
    expect(html).not.toContain('te cuesta hoy');
  });

  it('el pool es coherente: ids únicos y toda clase tiene cartas', () => {
    expect(new Set(UPGRADES.map((u) => u.id)).size).toBe(UPGRADES.length);
    for (const kind of ['leve', 'mixta', 'semilla'] as const) expect(UPGRADES.filter((u) => u.kind === kind).length).toBeGreaterThan(3);
    for (const u of UPGRADES) expect(u.stages.length > 0 || u.gamble !== undefined).toBe(true);
  });
});
