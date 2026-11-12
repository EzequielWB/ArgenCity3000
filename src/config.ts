/** Game balance and tuning constants. All money values are whole pesos. */

export const MAP_SIZE = 128;

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
  servicesPerResident: 0.05,
  /** Population at which the cost per resident of municipal services doubles. */
  servicesScale: 15000,
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
  school: { cost: 1500, upkeep: 120, radius: 11, capacity: 6000, power: 8 },
  clinic: { cost: 1200, upkeep: 100, radius: 11, capacity: 6000, power: 8 },
  police: { cost: 1000, upkeep: 90, radius: 10, capacity: 8000, power: 6 },
  fire: { cost: 1000, upkeep: 80, radius: 11, capacity: 10000, power: 6 },
};

/** Fire coverage at which firefighters put a fire out before the building is lost. */
export const FIRE_SAFE_COVER = 50;

/** A zone needs a road within this many cells (Manhattan distance). */
export const ROAD_REACH = 3;
