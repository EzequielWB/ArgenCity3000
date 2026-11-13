import { START_YEAR, TICKS_PER_MONTH, TICKS_PER_WEEK, WEEKS_PER_MONTH } from '../config';

export const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** In-game date as a pure function of the tick count. Months are 1-based. */
export function dateOf(tick: number): { month: number; year: number } {
  const months = Math.floor(tick / TICKS_PER_MONTH);
  return { month: (months % 12) + 1, year: START_YEAR + Math.floor(months / 12) };
}

/** Month-level label ("Ene 1990"): used by the newspaper and the save slots. */
export function dateLabel(tick: number): string {
  const { month, year } = dateOf(tick);
  return `${MONTHS[month - 1]} ${year}`;
}

/** Week of the month, 1 to WEEKS_PER_MONTH. */
export function weekOf(tick: number): number {
  return (Math.floor(tick / TICKS_PER_WEEK) % WEEKS_PER_MONTH) + 1;
}

/** Week-level label ("Sem 2 · Ene 1990"): shown in the top bar. */
export function weekLabel(tick: number): string {
  return `Sem ${weekOf(tick)} · ${dateLabel(tick)}`;
}

/**
 * Cumulative part of an `amount` due after `done` of `steps` steps (0 to `steps`). Paying the
 * difference between consecutive values makes the steps add up to exactly `amount`, whatever the
 * rounding. The weekly settlement and the loan instalments are both this rule.
 */
export function cumulativeShareOf(amount: number, done: number, steps: number): number {
  return Math.round((amount * done) / steps) || 0; // `|| 0` turns -0 into 0
}

/** Cumulative part of a monthly `amount` due after `week` weeks (0 to WEEKS_PER_MONTH). */
export function cumulativeShare(amount: number, week: number): number {
  return cumulativeShareOf(amount, week, WEEKS_PER_MONTH);
}
