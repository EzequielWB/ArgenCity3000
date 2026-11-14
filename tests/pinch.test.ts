import { describe, expect, it } from 'vitest';
import { PINCH_STEP, attachPointer, pinchStep, type PointerTarget } from '../src/input/controls';

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

/** A canvas that only does what `attachPointer` asks of it, and a target that records what it is told. */
function fakeCanvas() {
  const handlers = new Map<string, (e: unknown) => void>();
  const canvas = {
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    setPointerCapture: () => {},
    classList: { add: () => {}, remove: () => {} },
    addEventListener: (type: string, fn: (e: unknown) => void) => void handlers.set(type, fn),
    removeEventListener: () => {},
  };
  const fire = (type: string, id: number, x: number, y: number) =>
    handlers.get(type)!({ pointerId: id, pointerType: 'touch', button: 0, clientX: x, clientY: y, preventDefault: () => {} });
  return { canvas: canvas as unknown as HTMLCanvasElement, fire };
}

function recordingTarget(painting: boolean) {
  const calls: string[] = [];
  const target: PointerTarget = {
    isPainting: () => painting,
    hover: () => {},
    leave: () => {},
    dragStart: () => calls.push('dragStart'),
    dragMove: () => calls.push('dragMove'),
    dragEnd: () => calls.push('dragEnd'),
    dragCancel: () => calls.push('dragCancel'),
    click: () => calls.push('click'),
    pan: () => calls.push('pan'),
    zoom: (dir) => calls.push(`zoom ${dir}`),
  };
  return { target, calls };
}

describe('two fingers on the map', () => {
  it('zoom in when they spread and out when they close, wherever the first finger went down', () => {
    for (const painting of [false, true]) {
      const { canvas, fire } = fakeCanvas();
      const { target, calls } = recordingTarget(painting);
      attachPointer(canvas, target);
      fire('pointerdown', 1, 150, 300);
      fire('pointerdown', 2, 250, 300);
      for (let k = 1; k <= 8; k++) {
        fire('pointermove', 1, 150 - k * 10, 300);
        fire('pointermove', 2, 250 + k * 10, 300);
      }
      expect(calls).toContain('zoom 1');
      fire('pointerup', 1, 70, 300);
      fire('pointerup', 2, 330, 300);
      fire('pointerdown', 3, 70, 300);
      fire('pointerdown', 4, 330, 300);
      for (let k = 1; k <= 8; k++) {
        fire('pointermove', 3, 70 + k * 10, 300);
        fire('pointermove', 4, 330 - k * 10, 300);
      }
      expect(calls).toContain('zoom -1');
    }
  });

  it('cancel a stroke in progress and build nothing', () => {
    const { canvas, fire } = fakeCanvas();
    const { target, calls } = recordingTarget(true);
    attachPointer(canvas, target);
    fire('pointerdown', 1, 150, 300);
    fire('pointerdown', 2, 250, 300);
    fire('pointerup', 2, 250, 300);
    fire('pointerup', 1, 150, 300);
    expect(calls).toEqual(['dragStart', 'dragCancel']);
  });

  it('leave a single finger as it was: it paints, or taps', () => {
    const paint = fakeCanvas();
    const painter = recordingTarget(true);
    attachPointer(paint.canvas, painter.target);
    paint.fire('pointerdown', 1, 100, 100);
    paint.fire('pointermove', 1, 130, 100);
    paint.fire('pointerup', 1, 130, 100);
    expect(painter.calls).toEqual(['dragStart', 'dragMove', 'dragEnd']);

    const tap = fakeCanvas();
    const query = recordingTarget(false);
    attachPointer(tap.canvas, query.target);
    tap.fire('pointerdown', 1, 100, 100);
    tap.fire('pointerup', 1, 100, 100);
    expect(query.calls).toEqual(['click']);
  });
});
