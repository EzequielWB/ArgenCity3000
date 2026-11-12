import { START_YEAR, TICKS_PER_MONTH } from '../config';

export const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** In-game date as a pure function of the tick count. Months are 1-based. */
export function dateOf(tick: number): { month: number; year: number } {
  const months = Math.floor(tick / TICKS_PER_MONTH);
  return { month: (months % 12) + 1, year: START_YEAR + Math.floor(months / 12) };
}

export function dateLabel(tick: number): string {
  const { month, year } = dateOf(tick);
  return `${MONTHS[month - 1]} ${year}`;
}
