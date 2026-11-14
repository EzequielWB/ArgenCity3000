import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TUTORIAL_GOAL, TUTORIAL_HELP, TUTORIAL_STEPS } from '../src/ui/tutorial';

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

  it('closes by pointing at the Help button', () => {
    expect(TUTORIAL_HELP).toMatch(/Ayuda/);
  });
});
