/**
 * Milestones: population goals that unlock tools and bring a grant from the Province. A milestone
 * once reached is never lost, even if the city shrinks.
 */
import type { ToolId } from '../world/tools';

export interface Milestone {
  /** Residents needed. */
  pop: number;
  name: string;
  /** One-time grant in pesos. */
  grant: number;
  unlocks: readonly ToolId[];
}

export const MILESTONES: readonly Milestone[] = [
  { pop: 0, name: 'Paraje', grant: 0, unlocks: ['query', 'bulldoze', 'road', 'line', 'zoneR', 'zoneC', 'zoneI', 'park', 'plant'] },
  { pop: 100, name: 'Caserío', grant: 1500, unlocks: ['clinic', 'fire'] },
  { pop: 200, name: 'Pueblo', grant: 2500, unlocks: ['school', 'police'] },
  { pop: 1000, name: 'Ciudad', grant: 5000, unlocks: ['plantGas'] },
  { pop: 2500, name: 'Ciudad pujante', grant: 8000, unlocks: ['plantWind'] },
  { pop: 5000, name: 'Gran ciudad', grant: 12000, unlocks: [] },
  { pop: 25000, name: 'Metrópolis', grant: 30000, unlocks: [] },
];

/** Index of the milestone that unlocks a tool. */
export function milestoneOfTool(tool: ToolId): number {
  return MILESTONES.findIndex((m) => m.unlocks.includes(tool));
}

/** True when a city that reached milestone `reached` (an index) may use the tool. */
export function isUnlocked(tool: ToolId, reached: number): boolean {
  return milestoneOfTool(tool) <= reached;
}

/** The milestone after the one reached, or null at the last. */
export function nextMilestone(reached: number): Milestone | null {
  return MILESTONES[reached + 1] ?? null;
}

/** Index of the highest milestone a population reaches. */
export function milestoneForPop(pop: number): number {
  let k = 0;
  while (k + 1 < MILESTONES.length && MILESTONES[k + 1].pop <= pop) k++;
  return k;
}

/**
 * Moves the city to every milestone its population has reached, paying each grant, and returns
 * the ones just reached (none most months). Never moves back.
 */
export function advanceMilestones(state: { milestone: number; cash: number }, pop: number): Milestone[] {
  const reached: Milestone[] = [];
  for (let next = nextMilestone(state.milestone); next && pop >= next.pop; next = nextMilestone(state.milestone)) {
    state.milestone++;
    state.cash += next.grant;
    reached.push(next);
  }
  return reached;
}

/** What a milestone opens up, in words: "Salita y Bomberos", or '' when it unlocks nothing. */
export function unlockNames(m: Milestone, label: (tool: ToolId) => string): string {
  const names = m.unlocks.map(label);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}
