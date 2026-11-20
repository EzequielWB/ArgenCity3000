import { describe, expect, it } from 'vitest';
import { BANKRUPT_MONTHS, GOVERNMENT_KINDS, TICKS_PER_MONTH, type GovernmentKind } from '../src/config';
import { Simulation, newSimState } from '../src/sim/simulation';
import { SEA_LEVEL } from '../src/world/terrain';
import { applyPlan, dragCells, planTool } from '../src/world/tools';
import { World } from '../src/world/world';

const N = 40;

const flat = (): World => new World({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(N * N) });

/** Un pueblo con luz y casas, con el diario abierto, bajo el gobierno que se pida. */
function pueblo(government: GovernmentKind = 'democracia'): Simulation {
  const world = flat();
  const build = (tool: Parameters<typeof planTool>[1], ax: number, ay: number, bx = ax, by = ay) =>
    applyPlan(world, planTool(world, tool, dragCells(tool, ax, ay, bx, by, 1, N)));
  build('plant', 0, 1);
  build('road', 0, 3, 31, 3);
  build('zoneR', 2, 4, 16, 8);
  const sim = new Simulation(world, newSimState(3, government), 'Villa Quebrada');
  sim.report('Nota de color: el Intendente inauguró una plaza.');
  return sim;
}

const months = (sim: Simulation, n: number): void => {
  for (let k = 0; k < n * TICKS_PER_MONTH; k++) sim.tick();
};

/**
 * Deja la caja en rojo justo antes de cada cierre de mes, para que el mes cuente como mes en rojo sin que la
 * ciudad tenga que estar fundida de verdad. `n` meses, uno por uno.
 */
const mesesEnRojo = (sim: Simulation, n: number): void => {
  for (let k = 0; k < n; k++) {
    // Ocho ticks antes del cierre: el sueldo del mes ya se pagó y la caja sigue en rojo al terminar.
    for (let t = 0; t < TICKS_PER_MONTH - 8; t++) sim.tick();
    sim.state.cash = -1;
    for (let t = 0; t < 8; t++) sim.tick();
  }
};

describe('la quiebra', () => {
  it('un año en rojo y la Provincia interviene el municipio', () => {
    const sim = pueblo();
    mesesEnRojo(sim, BANKRUPT_MONTHS - 1);
    expect(sim.state.lostElection).toBe(false);
    mesesEnRojo(sim, 1);
    expect(sim.state.lostElection).toBe(true);
  });

  it('el diario dice intervención, no elección', () => {
    const sim = pueblo();
    mesesEnRojo(sim, BANKRUPT_MONTHS);
    const titular = sim.state.news.find((n) => /intervin/i.test(n.text));
    expect(titular).toBeDefined();
    expect(titular!.text).toMatch(/caja en rojo/i);
    expect(titular!.text).toMatch(/modo libre/i);
    expect(sim.state.news.some((n) => /elecciones/i.test(n.text))).toBe(false);
  });

  it('un mes en negro devuelve la cuenta a cero', () => {
    const sim = pueblo();
    mesesEnRojo(sim, BANKRUPT_MONTHS - 1);
    expect(sim.state.dry).toBe(BANKRUPT_MONTHS - 1);
    // Un mes con plata: la cuenta se borra y el año vuelve a empezar.
    sim.state.cash = 50_000;
    months(sim, 1);
    expect(sim.state.dry).toBe(0);
    expect(sim.state.lostElection).toBe(false);
  });

  it('vale para todos los gobiernos', () => {
    // La plata no distingue quién gobierna: al que no puede pagar los sueldos no lo salva ni la fe ni el
    // Partido. Cada uno con su nombre de gobierno, la misma regla.
    for (const government of GOVERNMENT_KINDS) {
      const sim = pueblo(government);
      mesesEnRojo(sim, BANKRUPT_MONTHS);
      expect(sim.state.lostElection, `${government} no quebró`).toBe(true);
    }
  });

  it('no hay una segunda intervención sobre una partida ya perdida', () => {
    const sim = pueblo();
    mesesEnRojo(sim, BANKRUPT_MONTHS);
    const intervenciones = sim.state.news.filter((n) => /intervin/i.test(n.text)).length;
    mesesEnRojo(sim, 3);
    expect(sim.state.news.filter((n) => /intervin/i.test(n.text)).length).toBe(intervenciones);
  });

  it('una ciudad que gasta más de lo que entra no llega a los doce meses', () => {
    // El caso real: la caja sangra todos los meses sin que nadie la rellene. No hace falta forzarla.
    const sim = pueblo();
    sim.state.cash = 1;
    for (let k = 0; k < BANKRUPT_MONTHS && !sim.state.lostElection; k++) months(sim, 1);
    expect(sim.state.lostElection).toBe(true);
    expect(sim.state.dry).toBeGreaterThanOrEqual(BANKRUPT_MONTHS);
  });
});
