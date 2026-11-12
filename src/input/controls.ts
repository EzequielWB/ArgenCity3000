/** What the game needs from pointer input. Screen coordinates are CSS pixels relative to the canvas. */
export interface PointerTarget {
  /** True when the active tool paints by dragging (not the query tool). */
  isPainting(): boolean;
  hover(mx: number, my: number): void;
  leave(): void;
  dragStart(mx: number, my: number): void;
  dragMove(mx: number, my: number): void;
  dragEnd(): void;
  dragCancel(): void;
  click(mx: number, my: number): void;
  pan(dx: number, dy: number): void;
  zoom(dir: number, mx: number, my: number): void;
}

type Mode = 'idle' | 'pan' | 'paint' | 'click-or-pan';

const CLICK_TOLERANCE = 5;

/** Mouse/touch handling: left paints (or clicks/pans with Consulta), right or middle pans, wheel zooms. */
export function attachPointer(canvas: HTMLCanvasElement, target: PointerTarget): () => void {
  let mode: Mode = 'idle';
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let pointer = -1;

  const pos = (e: PointerEvent | WheelEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const down = (e: PointerEvent) => {
    if (pointer !== -1 && e.pointerId !== pointer) return;
    const [mx, my] = pos(e);
    if (mode === 'paint' && e.button !== 0) {
      target.dragCancel();
      mode = 'idle';
      return;
    }
    pointer = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    startX = lastX = mx;
    startY = lastY = my;
    if (e.button === 1 || e.button === 2) {
      mode = 'pan';
      canvas.classList.add('panning');
    } else if (e.button === 0) {
      if (target.isPainting()) {
        mode = 'paint';
        target.dragStart(mx, my);
      } else mode = 'click-or-pan';
    }
    e.preventDefault();
  };

  const move = (e: PointerEvent) => {
    const [mx, my] = pos(e);
    if (mode === 'idle') {
      target.hover(mx, my);
      return;
    }
    if (e.pointerId !== pointer) return;
    if (mode === 'click-or-pan' && Math.hypot(mx - startX, my - startY) > CLICK_TOLERANCE) {
      mode = 'pan';
      canvas.classList.add('panning');
    }
    if (mode === 'pan') target.pan(mx - lastX, my - lastY);
    else if (mode === 'paint') target.dragMove(mx, my);
    lastX = mx;
    lastY = my;
  };

  const up = (e: PointerEvent) => {
    if (e.pointerId !== pointer) return;
    const [mx, my] = pos(e);
    if (mode === 'paint') target.dragEnd();
    else if (mode === 'click-or-pan') target.click(mx, my);
    mode = 'idle';
    pointer = -1;
    canvas.classList.remove('panning');
    target.hover(mx, my);
  };

  const cancel = (e: PointerEvent) => {
    if (e.pointerId !== pointer) return;
    if (mode === 'paint') target.dragCancel();
    mode = 'idle';
    pointer = -1;
    canvas.classList.remove('panning');
  };

  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    const [mx, my] = pos(e);
    target.zoom(e.deltaY < 0 ? 1 : -1, mx, my);
  };

  const leave = () => {
    if (mode === 'idle') target.leave();
  };
  const menu = (e: Event) => e.preventDefault();

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('pointerleave', leave);
  canvas.addEventListener('wheel', wheel, { passive: false });
  canvas.addEventListener('contextmenu', menu);
  return () => {
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', cancel);
    canvas.removeEventListener('pointerleave', leave);
    canvas.removeEventListener('wheel', wheel);
    canvas.removeEventListener('contextmenu', menu);
  };
}
