import { PARK, PROMISE, TICKS_PER_MONTH } from '../config';
import { TILE, type World } from '../world/world';

/** The things an Intendente can promise to the neighbours, each with a way of being measured. */
export type PromiseKind = 'school' | 'plaza';

/** A promise with a deadline: what was asked, how much time is left, and what the city had before. */
export interface Commitment {
  kind: PromiseKind;
  /** Tick at which the promise was made. */
  made: number;
  /** Tick at which it falls due. */
  due: number;
  /** What the city counted when the promise was made, so progress is measured against it. */
  baseline: number;
}

const KINDS: Record<PromiseKind, { what: string; done: string }> = {
  school: { what: 'construir una escuela', done: 'Levantaste la escuela prometida' },
  plaza: { what: 'plantar una plaza de 2×2 o más', done: 'Plantaste la plaza prometida' },
};

/** What the neighbours asked for, as a sentence. */
export function promiseWhat(kind: PromiseKind): string {
  return KINDS[kind].what;
}

/** How the promise is announced when it is kept. */
export function promiseKept(kind: PromiseKind): string {
  return KINDS[kind].done;
}

/** Cells of school built: one per school, since a school takes a single lot. */
export function countSchools(w: World): number {
  let n = 0;
  for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === TILE.SCHOOL) n++;
  return n;
}

/** Cells of plaza that count, as the land value counts them: only the patches of three or more. */
export function countParkCells(w: World): number {
  let n = 0;
  for (let i = 0; i < w.tiles.length; i++) if (w.parkArea[i] >= PARK.minArea) n++;
  return n;
}

/** What the city counts today for a promise of this kind. */
export function promiseBaseline(w: World, kind: PromiseKind): number {
  return kind === 'school' ? countSchools(w) : countParkCells(w);
}

/** New cells of the promised thing since the promise was made. */
export function promiseProgress(w: World, c: Commitment): number {
  return promiseBaseline(w, c.kind) - c.baseline;
}

/** What is still missing: one school, or at least the four cells of a 2×2 plaza. */
export function promiseGoal(kind: PromiseKind): number {
  return kind === 'school' ? 1 : 4;
}

export function promiseDone(w: World, c: Commitment): boolean {
  return promiseProgress(w, c) >= promiseGoal(c.kind);
}

/** Months from `tick` to the deadline, never under zero. */
export function monthsLeft(c: Commitment, tick: number): number {
  return Math.max(0, Math.ceil((c.due - tick) / TICKS_PER_MONTH));
}

/** A new promise of this kind, taking `PROMISE.months` from the current tick. */
export function newCommitment(w: World, kind: PromiseKind, tick: number): Commitment {
  return { kind, made: tick, due: tick + TICKS_PER_MONTH * PROMISE.months, baseline: promiseBaseline(w, kind) };
}
