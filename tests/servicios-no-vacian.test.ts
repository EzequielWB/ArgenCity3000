import { describe, expect, it } from 'vitest';
import { TICKS_PER_MONTH } from '../src/config';
import { computeApproval } from '../src/sim/politics';
import { Simulation, newSimState } from '../src/sim/simulation';
import { buildingIssues } from '../src/sim/warnings';
import { SEA_LEVEL } from '../src/world/terrain';
import { applyPlan, dragCells, planTool } from '../src/world/tools';
import { TILE, World } from '../src/world/world';

const N = 24;
const TODO = { health: true, crime: true, school: true };

/**
 * Un lote residencial de nivel 3 con luz de verdad: usina pegada al tendido, tendido pegado al lote y
 * una calle al lado. No alcanza con escribir `w.powered = 1`: cada tick recalcula el campo desde la red.
 */
function barrio(): { w: World; sim: Simulation; i: number } {
  const w = new World({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(N * N) });
  const plan = (tool: Parameters<typeof planTool>[1], ax: number, ay: number, bx = ax, by = ay) =>
    applyPlan(w, planTool(w, tool, dragCells(tool, ax, ay, bx, by, 1, N)));
  plan('plant', 0, 0);
  plan('line', 0, 2, 8, 2);
  plan('road', 0, 3, 8, 3);
  const i = w.idx(4, 4);
  w.tiles[i] = TILE.R;
  w.level[i] = 3;
  const sim = new Simulation(w, newSimState(4, 'democracia'), 'Villa Falta');
  sim.state.milestone = 99;
  // Los servicios se apagan después de la simulación, que es la que los recalcula.
  w.health[i] = 100;
  w.edu[i] = 100;
  w.crime[i] = 0;
  w.pollution[i] = 0;
  w.jam[i] = 0;
  w.landValue[i] = 60;
  return { w, sim, i };
}

/** Una ciudad con población para que los servicios importen: en un paraje nadie espera hospital. */
const POP = 1000;

/**
 * La decisión que costó dos mediciones y un colapso de la ciudad entera.
 *
 * La burbuja del lote muestra «sin clínica» y «sin escuela», y esas dos quejas **no** gastan la
 * paciencia del que vive ahí. El enojo de este juego es por falla —luz, calle, crimen, humo, tráfico,
 * caja en rojo—, no por cobertura parcial: una escuela cubre un radio y una ciudad grande siempre tiene
 * barrios afuera. Hacerlas enojar vaciaba todas las casas aunque el jugador hiciera todo bien: medido,
 * 0 habitantes en el año 11 con el peso literal y en el año 15 con un tercio del peso.
 *
 * El costo de no atenderlas ya está donde corresponde: la aprobación. Si alguien vuelve a agregar
 * `health` o `school` a `unrest`, estos tests tienen que romperse.
 */
describe('la falta de salita y escuela no vacía la casa', () => {
  it('la queja se ve, pero no gasta paciencia', () => {
    const { w, sim, i } = barrio();
    expect(w.powered[i]).toBe(1);
    w.health[i] = 0;
    w.edu[i] = 0;
    // El jugador la ve: es lo que hace que no atenderla sea una decisión y no un descuido.
    expect(buildingIssues(w, i, TODO)).toEqual(expect.arrayContaining(['health', 'school']));
    // Pero el que vive ahí no se va por eso.
    expect(sim.unrest(i, 'R')).toEqual({ rise: 0, worst: null });
  });

  it('un lote sin servicios no acumula enojo en dos años', () => {
    const { w, sim, i } = barrio();
    w.health[i] = 0;
    w.edu[i] = 0;
    for (let t = 0; t < TICKS_PER_MONTH * 24; t++) {
      sim.tick();
      w.health[i] = 0;
      w.edu[i] = 0;
    }
    expect(w.powered[i]).toBe(1);
    expect(w.anger[i]).toBe(0);
    expect(w.abandoned[i]).toBe(0);
    expect(w.level[i]).toBeGreaterThan(0);
  });

  it('y el costo se paga en aprobación, que es donde tiene que doler', () => {
    const { w, sim, i } = barrio();
    const conServicios = computeApproval(w, {
      taxes: sim.state.taxes,
      crisis: false,
      jammedShare: 0,
      abandoned: 0,
      grief: 0,
      pop: POP,
      jobs: POP / 2,
      growth: 0,
    });
    w.health[i] = 0;
    w.edu[i] = 0;
    const sinServicios = computeApproval(w, {
      taxes: sim.state.taxes,
      crisis: false,
      jammedShare: 0,
      abandoned: 0,
      grief: 0,
      pop: POP,
      jobs: POP / 2,
      growth: 0,
    });
    expect(sinServicios.target).toBeLessThan(conServicios.target);
    const salud = sinServicios.factors.find((f) => f.label === 'Salud')!;
    const educacion = sinServicios.factors.find((f) => f.label === 'Educación')!;
    expect(salud.points).toBeLessThan(0);
    expect(educacion.points).toBeLessThan(0);
  });
});
