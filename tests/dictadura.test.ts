import { describe, expect, it } from 'vitest';
import { GOVERNMENTS, TICKS_PER_MONTH } from '../src/config';
import { grantLine } from '../src/sim/mayor';
import { Simulation, newSimState } from '../src/sim/simulation';
import { SEA_LEVEL } from '../src/world/terrain';
import { applyPlan, dragCells, planTool } from '../src/world/tools';
import { TILE, World } from '../src/world/world';

const N = 40;

const flat = (): World => new World({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(N * N) });

/** Un pueblo con luz, casas y talleres, con la caja llena y el diario abierto, bajo el gobierno que se pida. */
function pueblo(government: 'democracia' | 'dictadura' | 'teocracia' | 'comunismo' = 'dictadura'): { world: World; sim: Simulation } {
  const world = flat();
  const build = (tool: Parameters<typeof planTool>[1], ax: number, ay: number, bx = ax, by = ay) =>
    applyPlan(world, planTool(world, tool, dragCells(tool, ax, ay, bx, by, 1, N)));
  build('plant', 0, 1);
  build('road', 0, 3, 31, 3);
  build('zoneR', 2, 4, 16, 8);
  build('zoneC', 18, 4, 24, 5);
  build('zoneI', 18, 7, 24, 8);
  const sim = new Simulation(world, newSimState(3, government), 'Villa Golpe');
  sim.state.cash = 5_000_000;
  for (let i = 0; i < world.tiles.length; i++) if (world.tiles[i] === TILE.R || world.tiles[i] === TILE.C || world.tiles[i] === TILE.I) world.level[i] = 2;
  sim.refresh();
  return { world, sim };
}

const dictadura = () => pueblo('dictadura');

const months = (sim: Simulation, n: number): void => {
  for (let k = 0; k < n * TICKS_PER_MONTH; k++) sim.tick();
};

describe('la dictadura', () => {
  it('no cae mientras la gente la aguante', () => {
    const { sim } = dictadura();
    sim.state.approval = 40;
    months(sim, 12);
    expect(sim.state.lostElection).toBe(false);
  });

  it('se cae sola cuando la aprobación baja del 20 %', () => {
    const { sim } = dictadura();
    // El pueblo la odia y no hay octubre que la salve: no hay elecciones, pero hay gente en la calle.
    sim.state.approval = 0;
    sim.state.lostElection = false;
    months(sim, 1);
    expect(sim.state.approval).toBeLessThan(GOVERNMENTS.dictadura.overthrowBelow!);
    expect(sim.state.lostElection).toBe(true);
  });

  it('el diario cuenta el golpe, no una elección', () => {
    const { sim } = dictadura();
    sim.state.approval = 0;
    months(sim, 1);
    const diario = sim.state.news.map((n) => n.text).join(' ');
    expect(diario).toMatch(/derroc|golpe|salió del gobierno|lo sacó/i);
  });

  it('es la única forma de gobierno que se cae por aprobación baja', () => {
    // La teocracia pelea con el favor divino y el comunismo con el congreso: ninguna se cae por esto.
    for (const gov of ['democracia', 'tecnocracia', 'teocracia', 'comunismo'] as const) {
      expect(GOVERNMENTS[gov].overthrowBelow).toBeNull();
    }
    expect(GOVERNMENTS.dictadura.overthrowBelow).toBe(20);
  });

  it('con la partida ya perdida no hay un segundo golpe', () => {
    const { sim } = dictadura();
    sim.state.lostElection = true;
    sim.state.approval = 1;
    months(sim, 2);
    const golpes = sim.state.news.filter((n) => /tomó la Municipalidad/i.test(n.text));
    expect(golpes).toHaveLength(0);
  });
});

describe('la plata de los hitos', () => {
  /** Un pueblo de cada forma de gobierno, con la población del último hito y el diario abierto. */
  function enHito(government: 'democracia' | 'dictadura' | 'teocracia' | 'comunismo'): Simulation {
    const { sim } = pueblo(government);
    sim.state.tick = TICKS_PER_MONTH * 2;
    // El diario abre cuando tiene más de una nota: la de fundación sola no cuenta.
    sim.report('Nota de color: el verano llegó temprano');
    sim.totals.pop = 250_000;
    (sim as unknown as { reachMilestones(): void }).reachMilestones();
    return sim;
  }

  const diario = (sim: Simulation): string => sim.state.news.map((n) => n.text).join(' ');

  it('en dictadura no se anuncia plata de la Provincia que no llega', () => {
    const texto = diario(enHito('dictadura'));
    expect(texto).not.toMatch(/Provincia gira/);
    expect(texto).toMatch(/la Provincia no gira nada/);
  });

  it('en democracia la Provincia sí gira, y el monto es el del hito', () => {
    const texto = diario(enHito('democracia'));
    expect(texto).toMatch(/la Provincia gira/);
  });

  it('en teocracia pone la Iglesia, y pone la mitad', () => {
    const texto = diario(enHito('teocracia'));
    expect(texto).toMatch(/la Iglesia gira/);
    expect(texto).not.toMatch(/la Provincia gira/);
    expect(grantLine('teocracia', 4000)).toMatch(/2\.000/);
    expect(grantLine('democracia', 4000)).toMatch(/4\.000/);
  });

  it('el globo del próximo hito tampoco miente', () => {
    expect(grantLine('dictadura', 4000)).toBe('la Provincia no gira nada: lo paga el pueblo');
    expect(grantLine('comunismo', 4000)).toBe('la Provincia no gira nada');
  });
});
