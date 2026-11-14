import { EVENT, SERVICES, TICKS_PER_MONTH } from '../config';
import type { Rng } from '../core/rng';
import { isUnlocked } from './milestones';
import { countSchools } from './commitments';
import type { Simulation } from './simulation';

/** One of the two things the Intendente can do about an event. */
export interface EventOption {
  /** The button, in the imperative: what the Intendente does. */
  label: string;
  /** The consequence, in plain words, right under the label: no numbers to decode. */
  detail: string;
  /** What it does to the city. */
  apply: (sim: Simulation) => void;
}

/** A case that shows up in the middle of the game and asks for a decision, with two ways out. */
export interface CityEvent {
  id: string;
  title: string;
  text: string;
  /** Only fires when this holds: the case has to be about *this* city. */
  when: (sim: Simulation) => boolean;
  options: readonly [EventOption, EventOption];
}

/** Schools the city should have for its population, at the rate one school covers. */
function schoolsNeeded(pop: number): number {
  return Math.ceil(pop / SERVICES.school.capacity);
}

const ASAMBLEA: CityEvent = {
  id: 'asamblea-escuela',
  title: 'El barrio se organiza',
  text: 'Una asamblea vecinal junta firmas para que la ciudad construya la escuela del barrio. Prometen cortar la calle si no hay respuesta.',
  when: (sim) =>
    isUnlocked('school', sim.state.milestone) &&
    countSchools(sim.world) < schoolsNeeded(sim.totals.pop) &&
    sim.totals.pop > 1200,
  options: [
    {
      label: 'Prometer la escuela',
      detail: 'La ciudad se compromete a levantarla: si no está en un año, el barrio se lo toma a mal.',
      apply: (sim) => sim.promise('school'),
    },
    {
      label: 'Dar vueltas',
      detail: 'Ni obra ni promesa. Los vecinos se lo anotan y la aprobación baja ahora.',
      apply: (sim) => sim.nudgeApproval(-6),
    },
  ],
};

export const EVENTS: readonly CityEvent[] = [ASAMBLEA];

export function eventById(id: string): CityEvent | undefined {
  return EVENTS.find((e) => e.id === id);
}

/**
 * The event that shows up this month, or null. Never two at once, never while a promise is being
 * watched (the city has enough to answer for), never in the first year, and never sooner than
 * `EVENT.gap` after the last one. The roll comes from the simulation's own seeded rng, so a saved
 * game replays the same.
 */
export function pickEvent(sim: Simulation, rng: Rng): CityEvent | null {
  const s = sim.state;
  if (s.pendingEvent || s.commitment) return null;
  if (s.tick < TICKS_PER_MONTH * EVENT.firstAt) return null;
  if (s.tick - s.lastEvent < TICKS_PER_MONTH * EVENT.gap) return null;
  if (!rng.chance(EVENT.chance)) return null;
  const candidates = EVENTS.filter((e) => e.when(sim));
  return candidates.length > 0 ? rng.pick(candidates) : null;
}
