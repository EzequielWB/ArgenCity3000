/**
 * Los trucos de la versión local: que cambien lo que dicen cambiar y que lo hagan sobre el mundo de verdad,
 * no sobre una cifra que después el juego pisa.
 */
import { describe, expect, it } from 'vitest';
import { MAX_FUNDING, MAX_LEVEL } from '../src/config';
import { Simulation, newSimState } from '../src/sim/simulation';
import { clearGripes, giveCash, maxApproval, maxServices, raisePopulation, CHEATS } from '../src/ui/cheats';
import { generateMap } from '../src/world/mapkinds';
import { TILE, World } from '../src/world/world';

/** Una ciudad de lotes residenciales de nivel 2, con luz y calle, para que el truco tenga dónde crecer. */
function city(n = 24): { world: World; sim: Simulation } {
  const world = new World(generateMap(7, n, 'plain'));
  for (let i = 0; i < world.n * world.n; i++) {
    world.tiles[i] = TILE.R;
    world.level[i] = 2;
    world.powered[i] = 1;
    world.roadAccess[i] = 1;
  }
  const sim = new Simulation(world, newSimState(7), 'Prueba');
  sim.refresh();
  return { world, sim };
}

describe('los trucos de la versión local', () => {
  it('la plata entra en la caja que el juego muestra', () => {
    const { sim } = city();
    const before = sim.state.cash;
    giveCash(sim);
    expect(sim.state.cash).toBe(before + 100_000);
  });

  it('los vecinos son edificios que crecen, no un número suelto: la población sube y los niveles también', () => {
    const game = city();
    const before = game.sim.totals.pop;
    const levels = [...game.world.level];
    raisePopulation(game);
    expect(game.sim.totals.pop).toBeGreaterThan(before);
    expect([...game.world.level].some((l, i) => l > levels[i])).toBe(true);
  });

  it('suma alrededor de mil y no ocho mil: sube de a un lote y corta al llegar', () => {
    const game = city();
    const before = game.sim.totals.pop;
    const gained = game.sim.totals.pop - before + 0; // la ciudad arranca sin recalcular
    raisePopulation(game, 1000);
    const real = game.sim.totals.pop - (before + gained);
    // El último lote puede pasarse un poco; lo que no puede es llevarse la ciudad entera por delante.
    expect(real).toBeGreaterThanOrEqual(1000);
    expect(real).toBeLessThan(3000);
  });

  it('no pasa el techo de nivel aunque le pidan más habitantes de los que entran', () => {
    const game = city();
    raisePopulation(game, 10_000_000);
    expect(Math.max(...game.world.level)).toBeLessThanOrEqual(MAX_LEVEL);
  });

  it('la aprobación queda en la barra, que es lo que el jugador mira', () => {
    const { sim } = city();
    sim.state.approval = 12;
    maxApproval(sim);
    expect(sim.state.approval).toBe(100);
  });

  it('eliminar quejas borra el enojo, los meses de problema y el abandono, y también el duelo', () => {
    const game = city();
    const w = game.world;
    w.anger[5] = 90;
    w.troubleMonths[5] = 9;
    w.abandoned[5] = 1;
    game.sim.state.grief = 400;
    clearGripes(game);
    expect(w.anger.every((v) => v === 0)).toBe(true);
    expect(w.troubleMonths.every((v) => v === 0)).toBe(true);
    expect(w.abandoned.every((v) => v === 0)).toBe(true);
    expect(game.sim.state.grief).toBe(0);
  });

  it('servicios al mango pone todos los presupuestos y baja los impuestos a cero', () => {
    const { sim } = city();
    sim.state.green = 10;
    sim.state.roads = 20;
    sim.state.taxes = { R: 9, C: 9, I: 9 };
    maxServices(sim);
    expect(Object.values(sim.state.funding).every((v) => v === MAX_FUNDING)).toBe(true);
    expect([sim.state.green, sim.state.transport, sim.state.roads, sim.state.plants]).toEqual([
      MAX_FUNDING,
      MAX_FUNDING,
      MAX_FUNDING,
      MAX_FUNDING,
    ]);
    expect(sim.state.taxes).toEqual({ R: 0, C: 0, I: 0 });
  });

  it('los atajos son Shift+1 a Shift+5, sin repetir tecla', () => {
    expect(CHEATS.map((c) => c.key)).toEqual(['1', '2', '3', '4', '5']);
  });
});
