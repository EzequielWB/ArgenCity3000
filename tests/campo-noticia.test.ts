import { describe, expect, it } from 'vitest';
import { Simulation, newSimState } from '../src/sim/simulation';
import { SEA_LEVEL } from '../src/world/terrain';
import { World } from '../src/world/world';
import { advanceMilestones, MILESTONES } from '../src/sim/milestones';
import { campoHeadline, milestoneHeadline } from '../src/sim/mayor';

const N = 24;

function mundo(): World {
  return new World({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(N * N) });
}

/** La noticia que el diario publica al cruzar el hito del campo, armada como la arma la simulación. */
function noticiaDelCampo(ciudad: string, gobierno: 'democracia' | 'dictadura' = 'democracia'): string {
  const hito = MILESTONES.find((m) => m.unlocks.includes('farm'))!;
  const nombre = { farm: 'lote de trigo', silo: 'silo', market: 'feria' };
  const abre = hito.unlocks.filter((t) => t in nombre).map((t) => nombre[t as keyof typeof nombre]);
  return milestoneHeadline(ciudad, hito.name, `${abre.slice(0, -1).join(', ')} y ${abre.at(-1)}`, gobierno, hito.grant);
}

describe('la noticia del desbloqueo del campo', () => {
  it('el titular del hito nombra las tres piezas', () => {
    const linea = noticiaDelCampo('Villa Trigal');
    expect(linea).toContain('Ciudad pujante');
    expect(linea).toContain('lote de trigo');
    expect(linea).toContain('silo');
    expect(linea).toContain('feria');
    expect(linea).toContain('se habilita');
  });

  it('el campo tiene su propia línea, porque en el titular queda séptimo', () => {
    const linea = campoHeadline('Villa Trigal');
    expect(linea).toContain('Villa Trigal');
    expect(linea).toContain('sembrar');
    expect(linea).toContain('silo');
    expect(linea).toContain('feria');
    // La advertencia es lo que importa: un lote solo no cobra nada.
    expect(linea).toContain('sin silo la cosecha se pierde');
  });

  it('el hito se cruza a los 2.500 y trae el campo con él', () => {
    const w = mundo();
    const sim = new Simulation(w, newSimState(7, 'democracia'), 'Villa Trigal');
    expect(advanceMilestones(sim.state, 2499, 0).map((m) => m.name)).not.toContain('Ciudad pujante');
    const cruzados = advanceMilestones(sim.state, 2500, 0);
    const hito = cruzados.find((m) => m.name === 'Ciudad pujante')!;
    expect(hito).toBeDefined();
    expect(hito.unlocks).toContain('farm');
    // La condición que dispara la línea del diario es exactamente ésta.
    expect(hito.unlocks.includes('farm')).toBe(true);
  });
});
