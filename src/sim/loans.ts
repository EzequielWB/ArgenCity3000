/**
 * Municipal loans: the city takes a fixed amount when the cash is in the red and pays it back in
 * equal monthly instalments over a fixed term, interest included. The state is only which loan and
 * how many instalments were paid; the amount, the term and the instalments come from `LOANS`, so a
 * save never carries a money figure that could disagree with the config. Pure functions.
 */
import { LOANS, TICKS_PER_MONTH } from '../config';
import { cumulativeShareOf, dateLabel } from './calendar';

export interface Loan {
  /** Index in `LOANS`. */
  kind: number;
  /** Instalments already paid, 0 to the term. */
  paid: number;
}

/** Total to pay back over the whole term, interest included. */
export function loanTotal(loan: Loan): number {
  const { amount, rate } = LOANS[loan.kind];
  return Math.round(amount * (1 + rate));
}

/** What is still owed after `paid` instalments: exactly the instalments left to pay. */
export function loanOwed(loan: Loan): number {
  return loanTotal(loan) - cumulativeShareOf(loanTotal(loan), loan.paid, LOANS[loan.kind].months);
}

/** The instalment that follows the `paid` ones. Consecutive instalments add up to `loanTotal`. */
export function loanInstalment(loan: Loan): number {
  const months = LOANS[loan.kind].months;
  const total = loanTotal(loan);
  return cumulativeShareOf(total, loan.paid + 1, months) - cumulativeShareOf(total, loan.paid, months);
}

/** True once every instalment was paid: the simulation drops the loan then. */
export function loanPaidOff(loan: Loan): boolean {
  return loan.paid >= LOANS[loan.kind].months;
}

/** Month the last instalment lands in, counted from `tick`. The term never moves. */
export function loanEndLabel(loan: Loan, tick: number): string {
  return dateLabel(tick + (LOANS[loan.kind].months - loan.paid - 1) * TICKS_PER_MONTH);
}
