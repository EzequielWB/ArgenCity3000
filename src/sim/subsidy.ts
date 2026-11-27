/**
 * El subsidio provincial. Cuando la caja municipal baja de `SUBSIDY.trigger`, la Provincia ofrece
 * `SUBSIDY.amount` una sola vez por partida: se ofrece, se cobra o se rechaza, y nunca vuelve
 * (`subsidy` queda marcado, en el save). Es un salvavidas para un intendente nuevo, no una renta.
 */
import { SUBSIDY } from '../config';
import type { SimState } from './simulation';

/** True when the telegram has not been sent yet and the cash is under the trigger. */
export function subsidyDue(s: SimState): boolean {
  return !s.subsidy && s.cash < SUBSIDY.trigger;
}

/** The telegram was sent, whatever the answer: it never comes back. */
export function markSubsidyOffered(s: SimState): void {
  s.subsidy = true;
}

/**
 * Accepts the subsidy: `SUBSIDY.amount` into the coffers. The first call pays and marks; any later
 * call is refused and pays nothing, so the money can never be taken twice.
 */
export function takeSubsidy(s: SimState): number {
  if (!subsidyDue(s)) return 0;
  markSubsidyOffered(s);
  s.cash += SUBSIDY.amount;
  return SUBSIDY.amount;
}
