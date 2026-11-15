import { START_YEAR, TICKS_PER_MONTH, TICKS_PER_WEEK, WEEKS_PER_MONTH } from '../config';
import { hash2 } from '../core/rng';

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

/** A holiday the town keeps. The game has months and weeks, not days, so a holiday is a month. */
export interface Holiday {
  month: number;
  name: string;
  /** What the town does that month, for the paper and for the window. */
  what: string;
}

/**
 * The national holidays of the calendar, one per month at most so two cases never land on the same
 * window. Carnival is pinned to February even though the real one moves with Easter (see the feature
 * document). The memorial dates (24 de Marzo, 2 de Abril) are deliberately out: a holiday here pays
 * approval and money, and those are not dates for a bonus.
 */
export const HOLIDAYS: readonly Holiday[] = [
  { month: 1, name: 'Año Nuevo', what: 'los fuegos artificiales' },
  { month: 2, name: 'Carnaval', what: 'las murgas' },
  { month: 5, name: '25 de Mayo', what: 'el locro del 25' },
  { month: 6, name: '20 de Junio', what: 'el acto de la bandera' },
  { month: 7, name: '9 de Julio', what: 'el desfile' },
  { month: 12, name: 'Navidad', what: 'el arbolito' },
];

/** The holiday of a month, or null: there is never more than one. */
export const holidayOf = (month: number): Holiday | null => HOLIDAYS.find((h) => h.month === month) ?? null;

/** How many holidays a year are celebrated with a decision. The rest are only announced. */
export const CELEBRATED_PER_YEAR = 3;

/**
 * The holidays of `year` that ask the Intendente for a decision: three of them, chosen from the year
 * itself, so a saved game always plays the same three and nothing has to be kept in the save file.
 * Returned in calendar order.
 */
export function celebratedHolidays(year: number): readonly Holiday[] {
  return [...HOLIDAYS]
    .sort((a, b) => hash2(year, a.month, 7) - hash2(year, b.month, 7))
    .slice(0, CELEBRATED_PER_YEAR)
    .sort((a, b) => a.month - b.month);
}

/** The holiday of `month` that `year` celebrates, or null when that month's holiday is only announced. */
export const celebratedHolidayOf = (year: number, month: number): Holiday | null => celebratedHolidays(year).find((h) => h.month === month) ?? null;
