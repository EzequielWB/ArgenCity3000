import { describe, expect, it } from 'vitest';
import { isUnlocked, milestoneOfTool, MILESTONES } from '../src/sim/milestones';

const CAMPO = ['farm', 'silo', 'market'] as const;

describe('el campo se desbloquea en Ciudad pujante', () => {
  it('a los 2.500 habitantes, no antes', () => {
    const hito = MILESTONES.findIndex((m) => m.unlocks.includes('farm'));
    expect(MILESTONES[hito]!.pop).toBe(2500);
    expect(MILESTONES[hito]!.name).toBe('Ciudad pujante');
  });

  it('con 2.499 habitantes todavía no se puede construir ninguno de los tres', () => {
    for (const tool of CAMPO) {
      expect(isUnlocked(tool, milestoneOfTool('zoneR'))).toBe(false);
      expect(isUnlocked(tool, 3)).toBe(false);
    }
  });

  it('los tres entran juntos al mismo hito, porque una pieza sola es una trampa', () => {
    const hitos = CAMPO.map((t) => milestoneOfTool(t));
    expect(new Set(hitos).size).toBe(1);
    for (const tool of CAMPO) expect(isUnlocked(tool, 4)).toBe(true);
  });

  it('ningún otro hito se quedó sin herramientas por el cambio', () => {
    // El campo estaba en Caserío: ese hito se queda con la salita, los bomberos y la pesca.
    const caserio = MILESTONES[1]!;
    expect(caserio.pop).toBe(100);
    expect(caserio.unlocks).toEqual(['clinic', 'fire', 'fishing']);
  });
});
