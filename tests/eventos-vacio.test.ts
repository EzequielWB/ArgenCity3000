import { describe, expect, it } from 'vitest';
import { EVENT, TICKS_PER_MONTH } from '../src/config';
import { eventOfMonth } from '../src/sim/events';
import { Simulation, newSimState } from '../src/sim/simulation';
import { TILE, World } from '../src/world/world';
import { generateMap } from '../src/world/mapkinds';
import { Rng } from '../src/core/rng';

/** Un mundo con casas suficientes para pasar el umbral de población. */
function cityWith(houses: number): World {
  const w = new World(generateMap(11, 30));
  let painted = 0;
  for (let i = 0; i < w.tiles.length && painted < houses; i++) {
    if (w.tiles[i] !== TILE.EMPTY) continue;
    w.tiles[i] = TILE.R;
    w.level[i] = 5;
    painted++;
  }
  return w;
}

const simOf = (w: World) => new Simulation(w, newSimState(11, 'democracia', 'Partido', null), 'Villa', '');
/** El tick del primer mes que ya pasa el `firstAt` de los eventos. */
const afterFirstAt = () => TICKS_PER_MONTH * EVENT.firstAt;

describe('una ciudad sin vecinos no tiene eventos', () => {
  /**
   * S1: el feriado entra por calendario, no por el pool de eventos, así que se salteaba el gate de
   * `pickEvent`. Con el reloj en el mes doce, una ciudad vacía recibía «Año Nuevo en el pueblo».
   */
  it('el feriado no salta con la ciudad vacía', () => {
    const sim = simOf(new World(generateMap(11, 30)));
    sim.state.tick = afterFirstAt();
    expect(sim.totals.pop).toBe(0);
    expect(eventOfMonth(sim, new Rng(1))).toBeNull();
  });

  it('tampoco en treinta meses de ciudad vacía', () => {
    const sim = simOf(new World(generateMap(11, 30)));
    const vistos: string[] = [];
    for (let t = 0; t < 30 * TICKS_PER_MONTH; t++) {
      sim.tick();
      const ev = sim.openEvent();
      if (ev) {
        vistos.push(ev.id);
        sim.answerEvent(0);
      }
    }
    expect(vistos).toEqual([]);
  });

  /** El gate no rompe lo que ya andaba: con gente y el mes cumplido, el feriado sigue apareciendo. */
  it('con vecinos el feriado vuelve', () => {
    const sim = simOf(cityWith(20));
    sim.state.tick = afterFirstAt();
    expect(sim.totals.pop).toBeGreaterThanOrEqual(EVENT.minPop);
    expect(eventOfMonth(sim, new Rng(1))?.id).toMatch(/^feriado-/);
  });

  /** El umbral es el de los eventos, no el de los hitos: un caserío ya tiene vecinos que festejan. */
  it('el umbral es el que declara la config', () => {
    expect(EVENT.minPop).toBeGreaterThan(0);
    expect(EVENT.minPop).toBeLessThanOrEqual(100);
  });
});
