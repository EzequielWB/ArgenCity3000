import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TUTORIAL_GOAL, TUTORIAL_HELP, TUTORIAL_STEPS, tutorialSteps } from '../src/ui/tutorial';

describe('the mini tutorial', () => {
  it('has the goal and four steps in order: street, power, zones, budget', () => {
    expect(TUTORIAL_GOAL.length).toBeGreaterThan(40);
    expect(TUTORIAL_STEPS.map((s) => s.image)).toEqual(['calle.webp', 'usina.webp', 'zonas.webp', 'presupuesto.webp']);
  });

  it('gives every step a title, a short text and a picture that exists', () => {
    for (const s of TUTORIAL_STEPS) {
      expect(s.title.length).toBeGreaterThan(5);
      expect(s.text.length).toBeGreaterThan(40);
      expect(s.text.length).toBeLessThan(420);
      expect(s.alt.length).toBeGreaterThan(20);
      expect(existsSync(`public/tutorial/${s.image}`)).toBe(true);
    }
  });

  it('tells the first street for the map at hand: a real city has no provincial route', () => {
    // Un mapa real es un recorte de una ciudad: ya trae sus calles y no tiene ruta provincial.
    expect(tutorialSteps(true)).toBe(TUTORIAL_STEPS);
    const real = tutorialSteps(false);
    expect(real.map((s) => s.image)).toEqual(TUTORIAL_STEPS.map((s) => s.image));
    expect(real[0].text).toMatch(/no hay ruta provincial/);
    expect(real[0].text).toMatch(/calles/);
    expect(real[0].text).not.toMatch(/desde la ruta provincial/);
    expect(real[0].text.length).toBeLessThan(420);
    expect(real.slice(1)).toEqual(TUTORIAL_STEPS.slice(1));
  });

  it('closes by pointing at the Help button', () => {
    expect(TUTORIAL_HELP).toMatch(/Ayuda/);
  });
});
