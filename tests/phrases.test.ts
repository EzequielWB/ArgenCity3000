import { describe, expect, it } from 'vitest';
import { PHRASES, nextPhrase } from '../src/ui/phrases';

describe('filete phrases', () => {
  it('offers about fifteen different sayings', () => {
    expect(PHRASES.length).toBeGreaterThanOrEqual(15);
    expect(new Set(PHRASES).size).toBe(PHRASES.length);
    for (const p of PHRASES) expect(p.trim().length).toBeGreaterThan(8);
  });

  it('never shows the same phrase twice in a row', () => {
    for (let current = -1; current < PHRASES.length; current++)
      for (let r = 0; r < 1; r += 0.01) {
        const next = nextPhrase(current, PHRASES.length, () => r);
        expect(next).not.toBe(current);
        expect(next).toBeGreaterThanOrEqual(0);
        expect(next).toBeLessThan(PHRASES.length);
      }
  });

  it('can reach every other phrase from any one', () => {
    const seen = new Set<number>();
    for (let r = 0; r < 1; r += 0.01) seen.add(nextPhrase(3, 6, () => r));
    expect([...seen].sort()).toEqual([0, 1, 2, 4, 5]);
  });

  it('stays on the only phrase when there is one', () => {
    expect(nextPhrase(0, 1, () => 0.7)).toBe(0);
    expect(nextPhrase(-1, 1, () => 0.7)).toBe(0);
  });
});
