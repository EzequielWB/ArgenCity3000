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
  servicesPerResident: 0.08,
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

/** A zone needs a road within this many cells (Manhattan distance). */
export const ROAD_REACH = 3;
