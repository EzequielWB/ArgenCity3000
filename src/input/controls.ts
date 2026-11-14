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

type Mode = 'idle' | 'pan' | 'paint' | 'click-or-pan' | 'pinch';

const CLICK_TOLERANCE = 5;
/** How much the fingers must spread (or close) from the last step to move the view one zoom level. */
export const PINCH_STEP = 1.35;

/** The zoom step (1 in, -1 out, 0 none yet) for two fingers that went from `ref` to `dist` pixels apart. */
export function pinchStep(ref: number, dist: number): number {
  if (ref <= 0) return 0;
  const ratio = dist / ref;
  return ratio >= PINCH_STEP ? 1 : ratio <= 1 / PINCH_STEP ? -1 : 0;
}

/** Mouse/touch handling: left paints (or clicks/pans with Consulta), right or middle pans, wheel zooms; two fingers pan and pinch-zoom. */
export function attachPointer(canvas: HTMLCanvasElement, target: PointerTarget): () => void {
  let mode: Mode = 'idle';
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let pointer = -1;
  const touches = new Map<number, [number, number]>();
  let pinchRef = 0;
  let pinchMid: [number, number] = [0, 0];

  const pair = (): { dist: number; mid: [number, number] } => {
    const [a, b] = [...touches.values()];
    return { dist: Math.hypot(a[0] - b[0], a[1] - b[1]), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
  };

  const pos = (e: PointerEvent | WheelEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const down = (e: PointerEvent) => {
    if (pointer !== -1 && e.pointerId !== pointer) return;
    const [mx, my] = pos(e);
    if (e.pointerType === 'touch') touches.set(e.pointerId, [mx, my]);
    if (touches.size === 2) {
      // The second finger turns a stroke or a tap into a pinch: nothing gets built.
      if (mode === 'paint') target.dragCancel();
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.remove('panning');
      mode = 'pinch';
      ({ dist: pinchRef, mid: pinchMid } = pair());
      e.preventDefault();
      return;
    }
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
    if (touches.has(e.pointerId)) touches.set(e.pointerId, [mx, my]);
    if (mode === 'pinch') {
      if (touches.size < 2) return;
      const { dist, mid } = pair();
      target.pan(mid[0] - pinchMid[0], mid[1] - pinchMid[1]);
      pinchMid = mid;
      const dir = pinchStep(pinchRef, dist);
      if (dir) {
        target.zoom(dir, mid[0], mid[1]);
        pinchRef = dist;
      }
      return;
    }
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
    touches.delete(e.pointerId);
    if (mode === 'pinch') {
      // The finger left over does nothing until it is lifted too.
      if (touches.size < 2) {
        mode = 'idle';
        pointer = -1;
      }
      return;
    }
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
    touches.delete(e.pointerId);
    if (mode === 'pinch') {
      if (touches.size < 2) {
        mode = 'idle';
        pointer = -1;
      }
      return;
    }
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
