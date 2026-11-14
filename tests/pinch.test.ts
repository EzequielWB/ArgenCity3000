import { describe, expect, it } from 'vitest';
import { PINCH_STEP, pinchStep } from '../src/input/controls';

describe('pinch zoom', () => {
  it('takes no step until the fingers have moved enough', () => {
    expect(pinchStep(100, 100)).toBe(0);
    expect(pinchStep(100, 100 * PINCH_STEP - 1)).toBe(0);
    expect(pinchStep(100, 100 / PINCH_STEP + 1)).toBe(0);
  });

  it('zooms in when the fingers spread and out when they close', () => {
    expect(pinchStep(100, 100 * PINCH_STEP + 1)).toBe(1);
    expect(pinchStep(100, 100 / PINCH_STEP - 1)).toBe(-1);
  });

  it('ignores a degenerate start', () => {
    expect(pinchStep(0, 50)).toBe(0);
  });
});
