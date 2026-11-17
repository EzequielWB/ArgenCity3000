import type { ServiceKind } from '../config';

/**
 * Temporary effects, in months. Absent or zero means off, so a city without events behaves exactly
 * as one from before they existed. They are read by the systems that already own each number: the
 * growth loop, the demand, the coast, the land value, the light and the budget sliders.
 */
export type Effects = Record<string, number>;

/** No building is raised while it runs (see `Simulation.grow`). */
export const FREEZE = 'freeze';
/** The industry stops buying and hiring: demand falls to half. */
export const INDUSTRY_FROZEN = 'industryFrozen';
/** The industry is booming: demand climbs half again. */
export const INDUSTRY_BOOM = 'industryBoom';
/** The coast earns half again (see `monthlyBudget`). */
export const COAST_BOOST = 'coastBoost';
/** A drought, a plague of locusts: everything the city earns is a fifth less (see `incomeFactor`). */
export const DROUGHT = 'sequia';
/** A miracle of the faithful: everything the city earns is a fifth more. */
export const MIRACLE = 'milagro';
/** The seafront is falling apart: the land next to the water is worth much less. */
export const COAST_WORN = 'coastWorn';
/** The city bought power from the Province: no blackouts while it lasts. */
export const NO_BLACKOUT = 'noBlackout';
/** The town is celebrating: everything it earns is a quarter more while it lasts (see `incomeFactor`). */
export const FIESTA = 'fiesta';

/** A budget slider that cannot be moved: the Province put a condition, or the money came tied. */
export const lockOf = (kind: ServiceKind | 'green'): string => `lock:${kind}`;

/** An event that cannot come back before it expires (see `pickEvent`). */
export const coolOf = (eventId: string): string => `cool:${eventId}`;

/** How much each effect multiplies its number. Effects not listed move nothing by themselves. */
export const EFFECT_FACTOR: Record<string, number> = {
  [INDUSTRY_FROZEN]: 0.5,
  [INDUSTRY_BOOM]: 1.4,
  [COAST_BOOST]: 1.5,
  [COAST_WORN]: 0.4,
  [DROUGHT]: 0.8,
  [MIRACLE]: 1.2,
  [FIESTA]: 1.25,
};

/** What the city earns, as a multiplier: the drought, the miracles of a theocracy and the holidays. */
export const incomeFactor = (effects: Readonly<Effects>): number => factorOf(effects, DROUGHT, MIRACLE, FIESTA);

/** Multiplier of `key` over the effects that are on, or 1 when none of them is. */
export function factorOf(effects: Readonly<Effects>, ...keys: string[]): number {
  let f = 1;
  for (const k of keys) if ((effects[k] ?? 0) > 0) f *= EFFECT_FACTOR[k] ?? 1;
  return f;
}

/** One month of every effect: each loses one, and the ones that reach zero are gone. */
export function tickEffects(effects: Effects): void {
  for (const [k, months] of Object.entries(effects)) {
    if (months > 1) effects[k] = months - 1;
    else delete effects[k];
  }
}
