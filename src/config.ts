/** Game balance and tuning constants. All money values are whole pesos. */

export const MAP_SIZE = 128;

/** Map sizes the player can pick, in cells per side. `small` is the historical size. */
export const MAP_SIZES = { small: 128, medium: 192, large: 256 } as const;
export type MapSizeId = keyof typeof MAP_SIZES;
/**
 * Sizes the renderer can draw within budget. The map is drawn in 512 x 512 px chunks, a few per
 * frame and only where they are on screen (see render/chunks.ts), so no canvas is bigger than
 * a phone can allocate. Measured in headless Chrome with software rendering: the first view
 * takes 0.25 to 0.3 s at 128, 192 and 256 (a single canvas needed 0.35, 0.63 and 1.15 s), a
 * rotation redraws the view in 0.25 to 0.35 s, panning and zooming keep every frame under 60 ms,
 * and the canvases hold 40 MB at 128, 64 MB at 192 and 75 to 117 MB at 256 (210 MB with an
 * overlay layer and the whole map in view; a single canvas pair was 80, 170 and 294 MB).
 */
export const PLAYABLE_SIZES: readonly MapSizeId[] = ['small', 'medium', 'large'];

export const INITIAL_CASH = 30000;
export const DEFAULT_TAX = 7;
export const MIN_TAX = 0;
export const MAX_TAX = 20;

/**
 * Simulation ticks per in-game week, weeks per month and ticks per month (a week takes 1.5 s at
 * the "Normal" speed). Money moves every week; everything else (headlines, fires, history,
 * growth appetite, yearly autosave) stays monthly.
 */
export const TICKS_PER_WEEK = 15;
export const WEEKS_PER_MONTH = 4;
export const TICKS_PER_MONTH = TICKS_PER_WEEK * WEEKS_PER_MONTH;
export const START_YEAR = 1990;

export const COSTS = {
  road: 10,
  bridge: 60,
  line: 5,
  zone: 5,
  park: 20,
  plant: 3000,
  bulldoze: 2,
  bulldozeLevel: 10,
  bulldozePlant: 200,
} as const;

/** Monthly upkeep. */
export const UPKEEP = {
  road: 1,
  bridge: 4,
  line: 0.3,
  park: 2,
  plant: 350,
  /**
   * Administration per resident. Raised from 0.06 when service upkeep started to depend on use
   * (S22): the long-run cash no longer piled up once the early deficit was gone. It costs a
   * young city almost nothing (a few pesos at 500 residents) and a big one a lot.
   */
  servicesPerResident: 0.1,
  /** Population at which the cost per resident of municipal services doubles. */
  servicesScale: 9000,
} as const;

/** Power plant footprint, and the output of the coal plant. */
export const PLANT_SIZE = 2;
export const PLANT_CAPACITY = 600;

/**
 * Kinds of power plant. Coal is the original one: cheap and dirty. Gas costs more to build and
 * to run and hardly smokes. A wind farm does not smoke and is cheap to run, but its output
 * depends on where it stands (see `WIND`): `capacity` is its best case.
 * `smoke` is the pollution at the plant and `smokeRadius` how far it spreads.
 */
export type PlantKind = 'coal' | 'gas' | 'wind';
export const PLANT_KINDS: readonly PlantKind[] = ['coal', 'gas', 'wind'];
export const PLANTS: Record<PlantKind, { label: string; cost: number; upkeep: number; capacity: number; smoke: number; smokeRadius: number }> = {
  coal: { label: 'Usina térmica', cost: COSTS.plant, upkeep: UPKEEP.plant, capacity: PLANT_CAPACITY, smoke: 60, smokeRadius: 6 },
  gas: { label: 'Usina a gas', cost: 5500, upkeep: 520, capacity: 600, smoke: 18, smokeRadius: 4 },
  wind: { label: 'Parque eólico', cost: 4500, upkeep: 140, capacity: 400, smoke: 0, smokeRadius: 0 },
};
/**
 * Wind farm output in MW: `base` on open flat land, plus `perLevel` for each level its site stands
 * above the average land within `radius` lots (minus as much in a hollow), plus `coast` when there
 * is water within that radius; never under `min` nor over `max`. Hilltops and shores pay.
 */
export const WIND = { base: 160, perLevel: 80, coast: 80, radius: 6, min: 80, max: PLANTS.wind.capacity } as const;

/**
 * How far the light reaches around a cell that passes it on, in lots (a disc: a lot is reached
 * when dx² + dy² <= reach², like the services). Plants, built zones and services pass the light
 * on with `POWER_REACH`; roads, parks, empty land and zoned lots without a building never do.
 * A power-line cell passes it on with `LINE_REACH`, the same distance: a line carries the light
 * over any distance (and over water) and lights the lots along its way.
 */
export const POWER_REACH = 3;
export const LINE_REACH = 3;

export const MAX_LEVEL = 4;
/** Residents (R) or jobs (C, I) per building level, index = level. */
export const CAPACITY = {
  R: [0, 6, 20, 60, 160],
  C: [0, 4, 12, 40, 100],
  I: [0, 6, 20, 50, 120],
} as const;
/** Power units consumed per building level. */
export const POWER_USE = { R: 2, C: 3, I: 5 } as const;

export type ServiceKind = 'school' | 'clinic' | 'police' | 'fire';
export const SERVICE_KINDS: readonly ServiceKind[] = ['school', 'clinic', 'police', 'fire'];

/**
 * Public services. Each covers the residents within `radius` cells; when more than
 * `capacity` residents live there, its coverage drops proportionally, and overlapping
 * services of the same kind add up (up to 100 %). They need power.
 */
export const SERVICES: Record<ServiceKind, { cost: number; upkeep: number; radius: number; capacity: number; power: number }> = {
  school: { cost: 1500, upkeep: 260, radius: 11, capacity: 6000, power: 8 },
  clinic: { cost: 1200, upkeep: 220, radius: 11, capacity: 6000, power: 8 },
  police: { cost: 1000, upkeep: 180, radius: 10, capacity: 8000, power: 6 },
  fire: { cost: 1000, upkeep: 160, radius: 11, capacity: 10000, power: 6 },
};

/**
 * Share of a service's upkeep that is paid whether or not anybody uses it. The rest grows with
 * the share of its capacity in use: upkeep x (FIXED_SHARE + (1 - FIXED_SHARE) x utilization).
 */
export const FIXED_SHARE = 0.25;

/** Municipal tax rate of each zone, in percent. */
export interface ZoneTaxes {
  R: number;
  C: number;
  I: number;
}

/**
 * Budget of each service, in percent of its standard upkeep. A service funded at X % costs
 * X % of its upkeep and gives X % of its coverage.
 */
export type ServiceFunding = Record<ServiceKind, number>;
export const DEFAULT_FUNDING: Readonly<ServiceFunding> = { school: 100, clinic: 100, police: 100, fire: 100 };
export const MAX_FUNDING = 120;

/** Fire coverage at which firefighters put a fire out before the building is lost. */
export const FIRE_SAFE_COVER = 50;

/**
 * Estimated congestion (see sim/congestion.ts). `laneCapacity` is how many commuting residents
 * one lane of street carries before it saturates (100 %). A lot on a street loaded above
 * `valueFrom` percent loses `valuePerPoint` of land value per point, and above `slowFrom` it
 * grows more slowly, down to `slowest` of its usual pace.
 */
export const TRAFFIC = { laneCapacity: 1200, valueFrom: 60, valuePerPoint: 0.3, slowFrom: 90, slowest: 0.25 } as const;

/** A zone needs a road within this many cells (Manhattan distance). */
export const ROAD_REACH = 3;
