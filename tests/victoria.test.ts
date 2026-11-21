import { describe, expect, it } from 'vitest';
import { CITY_GOAL } from '../src/config';
import { MILESTONES, advanceMilestones } from '../src/sim/milestones';
import { RUN_GOAL } from '../src/sim/roguelike';
import { endScreenHtml } from '../src/ui/upgrades';

describe('la meta del modo clásico', () => {
  /**
   * S1: una sola vara para las dos formas de jugar. Si el clásico y el roguelike no coinciden, el jugador
   * aprende dos finales distintos para la misma ciudad.
   */
  it('es medio millón de habitantes, y es la misma del roguelike', () => {
    expect(CITY_GOAL).toBe(500_000);
    expect(RUN_GOAL).toBe(CITY_GOAL);
  });

  /** S1: la meta es un hito más, el último, no un número suelto que nadie anuncia. */
  it('el último hito es la meta y se llama Medio millón', () => {
    const last = MILESTONES[MILESTONES.length - 1];
    expect(last.pop).toBe(CITY_GOAL);
    expect(last.name).toBe('Medio millón');
  });

  /** No queda nada por desbloquear cuando ya ganaste: el último hito no promete herramientas. */
  it('el último hito no desbloquea nada', () => {
    expect(MILESTONES[MILESTONES.length - 1].unlocks).toEqual([]);
  });

  it('una ciudad de medio millón llega al último hito', () => {
    const state = { milestone: 0, cash: 0 };
    advanceMilestones(state, CITY_GOAL, 1);
    expect(state.milestone).toBe(MILESTONES.length - 1);
  });

  it('una ciudad un habitante abajo todavía no', () => {
    const state = { milestone: 0, cash: 0 };
    advanceMilestones(state, CITY_GOAL - 1, 1);
    expect(state.milestone).toBe(MILESTONES.length - 2);
  });
});

describe('la pantalla de fin', () => {
  const summary = '<ul><li>Habitantes: 500.000</li></ul>';

  /**
   * S3: en el clásico ganar no te saca de la ciudad. El botón dice «Seguir mirando», y no existe el
   * «Reiniciar el mismo mapa» del roguelike, que ahí no significa nada.
   */
  it('en el clásico se puede seguir mirando la ciudad', () => {
    const html = endScreenHtml('ganada', true, summary);
    expect(html).toContain('Seguir mirando');
    expect(html).toContain('Fin de la partida');
    expect(html).not.toContain('Reiniciar el mismo mapa');
    // S4: sin run no hay mejoras que listar.
    expect(html).not.toMatch(/mejoras/i);
    expect(html).not.toMatch(/run/i);
  });

  /** El roguelike conserva su cierre: ahí sí la partida se termina y se puede reiniciar el mapa. */
  it('la run mantiene su cierre', () => {
    const html = endScreenHtml('ganada', false, '<h3>Las mejoras de la run</h3>');
    expect(html).toContain('Fin de la run');
    expect(html).toContain('Reiniciar el mismo mapa');
    expect(html).not.toContain('Seguir mirando');
  });

  /** La pantalla dice el número de la meta, no «la run»: el jugador del clásico nunca vio una run. */
  it('el clásico nombra la meta en habitantes', () => {
    expect(endScreenHtml('ganada', true, summary)).toContain('500.000 habitantes');
  });
});
