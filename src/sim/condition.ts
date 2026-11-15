/**
 * How well something is kept for what is spent on it, as a multiplier of what it gives: with the budget in full
 * it gives what it should, at half three quarters, with none only half, and a budget above the standard gives a
 * little more, up to a tenth. The streets (what they carry) and the power plants (what they generate) share it.
 */
export function fundingCondition(funding: number): number {
  const f = Math.max(0, funding);
  return Math.min(1.1, 0.5 + (0.5 * Math.min(f, 100)) / 100 + (0.1 * Math.max(0, f - 100)) / 20);
}
