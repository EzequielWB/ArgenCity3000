/**
 * Milestones: population goals that unlock tools and bring a grant from the Province. A milestone
 * once reached is never lost, even if the city shrinks.
 */
import { CITY_GOAL, GOVERNMENT_UNIQUES } from '../config';
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
  { pop: 0, name: 'Paraje', grant: 0, unlocks: ['query', 'bulldoze', 'roadDirt', 'road', 'roadPaved', 'roadBoulevard', 'line', 'lineConcrete', 'zoneR', 'zoneC', 'zoneI', 'park', 'plant'] },
  { pop: 100, name: 'Caserío', grant: 1500, unlocks: ['clinic', 'fire', 'fishing'] },
  { pop: 200, name: 'Pueblo', grant: 2500, unlocks: ['school', 'police', 'promenade'] },
  { pop: 1000, name: 'Ciudad', grant: 5000, unlocks: ['plantGas', 'port', 'resort', 'bus'] },
  // El campo entra entero o no entra: un lote sin silo ni feria produce y no cobra, y esa trampa no se le hace
  // a un jugador que recién arranca. Pero también pide plata y una decisión de dónde ponerlo, así que no entra
  // en Caserío: espera a que la ciudad tenga tamaño para que el campo sea parte de ella y no un atajo.
  { pop: 2500, name: 'Ciudad pujante', grant: 8000, unlocks: ['plantWind', 'harbor', 'hospital', 'university', 'farm', 'silo', 'market'] },
  { pop: 5000, name: 'Gran ciudad', grant: 12000, unlocks: ['lighthouse', 'airport', 'plantNuclear'] },
  {
    pop: 25000,
    name: 'Metrópolis',
    grant: 30000,
    unlocks: GOVERNMENT_UNIQUES
      ? ['obelisco', 'calvario', 'puente', 'teatro', 'estadio', 'cabildo', 'regimiento', 'planetario', 'santuario', 'sindicato']
      : ['obelisco', 'calvario', 'puente', 'teatro', 'estadio'],
  },
  { pop: 50000, name: 'Gran metrópolis', grant: 50000, unlocks: [] },
  { pop: 100000, name: 'Megaciudad', grant: 80000, unlocks: [] },
  { pop: 200000, name: 'Área metropolitana', grant: 120000, unlocks: [] },
  // La meta del modo clásico. Es un hito y no un número suelto para que la barra lo anuncie y el jugador
  // sepa desde el año uno a dónde va; ganar no desbloquea nada porque no queda nada después.
  { pop: CITY_GOAL, name: 'Medio millón', grant: 200000, unlocks: [] },
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
export function advanceMilestones(state: { milestone: number; cash: number }, pop: number, grants = 1): Milestone[] {
  const reached: Milestone[] = [];
  for (let next = nextMilestone(state.milestone); next && pop >= next.pop; next = nextMilestone(state.milestone)) {
    state.milestone++;
    // The milestone is reached either way; what the Province pays depends on the government.
    state.cash += Math.round(next.grant * grants);
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
