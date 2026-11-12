/** Game balance and tuning constants. All money values are whole pesos. */

export const MAP_SIZE = 128;

/** Map sizes the player can pick, in cells per side. `small` is the historical size. */
export const MAP_SIZES = { small: 128, medium: 192, large: 256 } as const;
export type MapSizeId = keyof typeof MAP_SIZES;
/**
 * Sizes the renderer can draw within budget. The map is drawn into one canvas of
 * (n * 32 + 48) x (n * 16 + 360) pixels, plus a same-sized layer canvas. Measured in headless
 * Chrome (T18): 128 redraws in about 0.6 s, 192 in 1.3 to 1.5 s (21 M pixels, 162 MB) and 256
 * in 2.5 s (37 M pixels, 280 MB), over the 0.7 s budget. The terrain generators, saves and
 * simulation already handle every size, so a size joins this list once the renderer is chunked.
 */
export const PLAYABLE_SIZES: readonly MapSizeId[] = ['small'];

export const INITIAL_CASH = 30000;
export const DEFAULT_TAX = 7;
export const MIN_TAX = 0;
export const MAX_TAX = 20;

/** Simulation ticks per in-game month, and months per year. */
export const TICKS_PER_MONTH = 60;
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
  servicesPerResident: 0.06,
  /** Population at which the cost per resident of municipal services doubles. */
  servicesScale: 9000,
} as const;

/** Power plant output and footprint. */
export const PLANT_SIZE = 2;
export const PLANT_CAPACITY = 600;

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

/** A zone needs a road within this many cells (Manhattan distance). */
export const ROAD_REACH = 3;
