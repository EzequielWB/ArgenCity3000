/**
 * The five-year plan of communism: the Party asks for a number of industrial jobs by a date. Reaching it pays a
 * premium and the neighbours' applause; missing it costs approval. Pure: the simulation keeps the state.
 */
import { TICKS_PER_MONTH } from '../config';

export interface FivePlan {
  /** Industrial jobs the city has to have. */
  jobs: number;
  /** Tick at which the plan falls due. */
  due: number;
  /** Tick at which it was set. */
  start: number;
}

export const PLAN = {
  years: 5,
  /** The goal is the jobs of today times this, plus `extra`, never under `min`. */
  growth: 1.4,
  extra: 20,
  min: 40,
  /** Premium per job of the goal when it is met. */
  premiumPerJob: 150,
  /** Points of approval gained when it is met and lost when it is not. */
  kept: 8,
  broken: 10,
} as const;

/** A new plan from `tick`, with a goal that depends on how much industry the city has now. */
export function newPlan(tick: number, industrialJobs: number): FivePlan {
  return { jobs: Math.max(PLAN.min, Math.round(industrialJobs * PLAN.growth + PLAN.extra)), due: tick + PLAN.years * 12 * TICKS_PER_MONTH, start: tick };
}

/** Months to the deadline, never under zero. */
export function planMonthsLeft(plan: FivePlan, tick: number): number {
  return Math.max(0, Math.ceil((plan.due - tick) / TICKS_PER_MONTH));
}

/** The premium the Party pays for a plan that was met. */
export function planPremium(plan: FivePlan): number {
  return plan.jobs * PLAN.premiumPerJob;
}
