/**
 * What is wrong with a building, for the little bubbles over the map: no light, crime around, no health
 * post near, smoke on the neighbourhood. The thresholds are the ones the simulation itself acts on
 * (abandonment, the need of a service), so a bubble is never shown for something that has no effect.
 */
import { PARK, TRAFFIC } from '../config';
import { TILE, World, coastOf, serviceOf, zoneOf } from '../world/world';
import { SERVICE_NEED } from './demand';

export type Issue = 'power' | 'road' | 'jam' | 'crime' | 'health' | 'school' | 'smoke' | 'empty' | 'dry';

/** The services the city has unlocked: the lack of one is not shown before the player can build it. */
export interface Unlocked {
  health: boolean;
  crime: boolean;
  school: boolean;
}

/** Crime above this makes homes and shops start to empty (see `abandonChance` in the simulation). */
export const CRIME_BUBBLE = 60;
/** The street of a lot is saturated this far over where the growth slows down (see `growthHint`). */
const JAM_MARGIN = 30;
/** Smoke above this makes homes lose their people. */
export const SMOKE_BUBBLE = 70;

/**
 * The problems of the building on cell `i`, most serious first. `kinds` says which services the city has
 * unlocked: a bubble for the health post or the police is not shown before the player can build them.
 * A building in the dark shows only that: the rest does not matter until the light is back. A building with
 * no street near it asks for one, for it brings no people or goods.
 */
export function buildingIssues(w: World, i: number, kinds: Unlocked): Issue[] {
  const tile = w.tiles[i];
  const service = serviceOf(tile) !== null;
  const coast = coastOf(tile) !== null;
  const zone = zoneOf(tile);
  // A plaza nobody keeps: it needs no light or street, only care.
  if (tile === TILE.PARK) return w.parkArea[i] >= PARK.minArea && w.parkCare[i] < PARK.care ? ['dry'] : [];
  if (!service && !coast && (!zone || w.level[i] === 0)) return [];
  if (w.fire[i]) return []; // a burning building needs the firefighters, not a bubble
  if (!w.powered[i]) return ['power'];
  // The coast buildings need a street too; the services do not.
  if (coast) return w.roadAccess[i] ? [] : ['road'];
  if (service || tile === TILE.EMPTY) return [];
  if (w.abandoned[i]) return ['empty'];
  const out: Issue[] = [];
  if (!w.roadAccess[i]) out.push('road');
  if (w.jam[i] > TRAFFIC.slowFrom + JAM_MARGIN) out.push('jam');
  if (kinds.crime && zone !== 'I' && w.crime[i] > CRIME_BUBBLE) out.push('crime');
  if (kinds.health && zone === 'R' && w.health[i] < SERVICE_NEED) out.push('health');
  // A home does not go past a PH without a school near. A shop asks for something else —educated
  // people, which the city has or does not (see `levelCap`)— and a school of its own would not fix it.
  if (kinds.school && zone === 'R' && w.level[i] >= 3 && w.edu[i] < SERVICE_NEED) out.push('school');
  if (zone === 'R' && w.pollution[i] > SMOKE_BUBBLE) out.push('smoke');
  return out;
}
