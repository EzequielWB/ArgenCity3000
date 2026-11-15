/**
 * What is wrong with a building, for the little bubbles over the map: no light, crime around, no health
 * post near, smoke on the neighbourhood. The thresholds are the ones the simulation itself acts on
 * (abandonment, the need of a service), so a bubble is never shown for something that has no effect.
 */
import { TILE, World, serviceOf, zoneOf } from '../world/world';
import { SERVICE_NEED } from './demand';

export type Issue = 'power' | 'crime' | 'health' | 'smoke';

/** Crime above this makes homes and shops start to empty (see `abandonChance` in the simulation). */
export const CRIME_BUBBLE = 60;
/** Smoke above this makes homes lose their people. */
export const SMOKE_BUBBLE = 70;

/**
 * The problems of the building on cell `i`, most serious first. `kinds` says which services the city has
 * unlocked: a bubble for the health post or the police is not shown before the player can build them.
 * A building in the dark shows only that: the rest does not matter until the light is back.
 */
export function buildingIssues(w: World, i: number, kinds: { health: boolean; crime: boolean }): Issue[] {
  const tile = w.tiles[i];
  const service = serviceOf(tile) !== null;
  const zone = zoneOf(tile);
  if (!service && (!zone || w.level[i] === 0)) return [];
  if (w.fire[i]) return []; // a burning building needs the firefighters, not a bubble
  if (!w.powered[i]) return ['power'];
  if (service || w.abandoned[i] || tile === TILE.EMPTY) return [];
  const out: Issue[] = [];
  if (kinds.crime && zone !== 'I' && w.crime[i] > CRIME_BUBBLE) out.push('crime');
  if (kinds.health && zone === 'R' && w.health[i] < SERVICE_NEED) out.push('health');
  if (zone === 'R' && w.pollution[i] > SMOKE_BUBBLE) out.push('smoke');
  return out;
}
