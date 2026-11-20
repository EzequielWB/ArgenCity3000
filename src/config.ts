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

/**
 * Geometry of the provincial route of generated maps, in cells: the strip is `width` lanes wide,
 * runs `inset` cells in from the border and stops `margin` cells short of both ends of that side.
 * One cell in and reaching both corners, so it reads as the road that passes outside the city.
 * `shoulder` is how many lots beside the strip are graded to the road's own height, on both sides,
 * so the first streets of the city start on level ground instead of on a slope. `clearance` is how
 * many lots of dry ground the route wants between the strip and any water: it picks its border by
 * that distance, so grading the road never has to bend a shore.
 */
export const ROUTE = { width: 4, inset: 1, margin: 0, shoulder: 1, clearance: 4 } as const;

/**
 * Forms of government the player picks when founding the city. `termYears` null means there are
 * never elections; `migration` scales how many people the city attracts; `grants` scales what the
 * Province pays at each milestone (0 = it pays nothing); `approvalCap` is the ceiling of the
 * neighbours' approval and `approvalStep` how far it moves in a month.
 */
export type GovernmentKind = 'democracia' | 'dictadura' | 'tecnocracia' | 'teocracia' | 'comunismo';

export interface Government {
  label: string;
  blurb: string;
  pros: readonly string[];
  cons: readonly string[];
  termYears: number | null;
  toWin: number;
  migration: number;
  grants: number;
  approvalCap: number;
  approvalStep: number;
  /** What each zone's taxes bring in, as a multiplier (1 = the usual). */
  taxIncome: { R: number; C: number; I: number };
  /** What the four public services cost to keep, as a multiplier. */
  serviceCost: number;
  /** Budget of schools and university below which this form of government will not go. */
  fundingFloor: number;
  /**
   * Aprobación por debajo de la cual la calle saca al Intendente, o null si no hay nada que lo saque.
   *
   * Es la contracara de no tener elecciones: la dictadura no pierde en octubre, pero se cae cualquier mes
   * en que el pueblo la odie lo suficiente. Las demás formas de gobierno no lo necesitan —la teocracia
   * pelea con el favor divino y el comunismo responde en el congreso—, así que queda en null.
   */
  overthrowBelow: number | null;
}

export const GOVERNMENT_KINDS: readonly GovernmentKind[] = ['democracia', 'dictadura', 'tecnocracia', 'teocracia', 'comunismo'];

export const GOVERNMENTS: Record<GovernmentKind, Government> = {
  democracia: {
    label: 'Democracia',
    blurb: 'La forma de siempre: el Intendente se juega el cargo cada cuatro años.',
    pros: ['La Provincia gira los subsidios de cada hito', 'Llega toda la gente que quiere venir'],
    cons: ['Elecciones cada 4 años: hace falta el 50 % para seguir'],
    termYears: 4,
    toWin: 50,
    migration: 1,
    grants: 1,
    approvalCap: 100,
    approvalStep: 4,
    taxIncome: { R: 1, C: 1, I: 1 },
    serviceCost: 1,
    fundingFloor: 0,
    overthrowBelow: null,
  },
  dictadura: {
    label: 'Dictadura',
    blurb: 'Nadie te vota: el cargo es tuyo y no hay octubre que lo discuta.',
    pros: ['No hay elecciones: nunca perdés el poder', 'La ciudad crece con la plata que hacés vos'],
    cons: ['Llega un 20 % menos de gente nueva', 'La Provincia no gira subsidios', 'La aprobación no pasa de 60', 'Si la aprobación baja del 20 %, la calle te saca del gobierno'],
    termYears: null,
    toWin: 0,
    migration: 0.8,
    grants: 0,
    approvalCap: 60,
    approvalStep: 4,
    taxIncome: { R: 1, C: 1, I: 1 },
    serviceCost: 1,
    fundingFloor: 0,
    overthrowBelow: 20,
  },
  tecnocracia: {
    label: 'Tecnocracia',
    blurb: 'Gobierna el que sabe: mandatos de seis años y una ciudad que cobra y gasta como una empresa.',
    pros: [
      'Sin evasión: los tres impuestos rinden un 10 % más',
      'Administración técnica: los servicios cuestan un 10 % menos de mantener',
      'La educación no se toca: escuelas y universidad nunca bajan del 80 %',
      'La Provincia gira los subsidios de cada hito',
    ],
    cons: [
      'Elecciones cada 6 años: hace falta el 50 % para seguir',
      'La aprobación se mueve la mitad de rápido: si la ciudad se enoja, tardás en recuperarla',
      'Llega un 5 % menos de gente nueva',
      'El piso de educación se paga igual con la caja en rojo',
    ],
    termYears: 6,
    toWin: 50,
    migration: 0.95,
    grants: 1,
    approvalCap: 100,
    approvalStep: 2,
    taxIncome: { R: 1.1, C: 1.1, I: 1.1 },
    serviceCost: 0.9,
    fundingFloor: 80,
    overthrowBelow: null,
  },
  teocracia: {
    label: 'Teocracia',
    blurb: 'Gobierna la fe: no hay elecciones, pero hay que tener contento al de arriba.',
    pros: ['No hay elecciones: nunca perdés el poder', 'Con el favor divino alto llegan milagros: más ingresos, vecinos que vuelven, trabajo', 'La Iglesia aporta la mitad de los subsidios de cada hito'],
    cons: ['Con el favor divino bajo caen catástrofes: rayos, plagas, sequías, revueltas', 'El favor baja con el humo, el delito, las demoliciones, la usura y la caja en rojo', 'Llega un 10 % menos de gente nueva y la aprobación de los vecinos no pasa de 80'],
    termYears: null,
    toWin: 0,
    migration: 0.9,
    grants: 0.5,
    approvalCap: 80,
    approvalStep: 4,
    taxIncome: { R: 1, C: 1, I: 1 },
    serviceCost: 1,
    fundingFloor: 0,
    overthrowBelow: null,
  },
  comunismo: {
    label: 'Comunismo',
    blurb: 'Planifica el Estado: servicios baratos, fábricas a pleno y un plan cada cinco años.',
    pros: ['Los servicios cuestan un 30 % menos de mantener', 'Las fábricas pagan un 25 % más de impuestos', 'La aprobación casi no se mueve: los vecinos no se enojan de un mes al otro', 'Cada 5 años un plan: cumplirlo da plata y aprobación'],
    cons: ['Los comercios pagan la mitad de impuestos', 'Llega un 25 % menos de gente nueva', 'La Provincia no gira subsidios', 'Si no cumplís el plan, el pueblo se enoja', 'Congreso del Partido cada 5 años: hace falta el 55 % para seguir'],
    termYears: 5,
    toWin: 55,
    migration: 0.75,
    grants: 0,
    approvalCap: 100,
    approvalStep: 1,
    taxIncome: { R: 1, C: 0.5, I: 1.25 },
    serviceCost: 0.7,
    fundingFloor: 0,
    overthrowBelow: null,
  },
};

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

/**
 * Quality of every street cell, in the order the player can build them. `capacity` multiplies the
 * lanes a cell carries (see `sim/congestion.ts`); a band of streets carries by its weakest cell.
 * The index is what `World.roadTier` and the save store, so the first one has to stay asphalt and
 * dirt, the worst of all, goes last: compare qualities with `roadRank`, never the raw index.
 */
export const ROAD_TIERS = [
  { label: 'Asfalto', cost: 10, upkeep: 1, capacity: 1 },
  { label: 'Pavimento reforzado', cost: 30, upkeep: 3, capacity: 1.6 },
  { label: 'Bulevar', cost: 75, upkeep: 8, capacity: 1.8 },
  { label: 'Calle de tierra', cost: 3, upkeep: 0.5, capacity: 0.5 },
] as const;

/** Index into `ROAD_TIERS`: 0 asphalt, 1 reinforced pavement, 2 boulevard, 3 dirt. */
export type RoadTier = 0 | 1 | 2 | 3;
export const MAX_ROAD_TIER = ROAD_TIERS.length - 1;
export const ASPHALT: RoadTier = 0;
export const DIRT: RoadTier = 3;

/** Where a tier stands in quality, worst first: dirt, asphalt, reinforced pavement, boulevard. */
export const roadRank = (tier: number): number => (tier === DIRT ? -1 : tier);

/** The worse of two tiers: a band of streets is as good as its weakest cell. */
export const weakerRoad = (a: RoadTier, b: RoadTier): RoadTier => (roadRank(b) < roadRank(a) ? b : a);

/** How far the boulevard's lamps reach, and how much crime they take out there. */
export const BOULEVARD = { radius: 2, crime: 12 } as const;

/**
 * The two lines of the grid, in the order the player can build them. `reach` is how far a pole passes the
 * light on — a disc of `reach` lots, and also the spacing a run of poles is laid out with — so the
 * concrete line covers three times the ground of the wooden one with the same number of poles. The index
 * is what `World.lineTier` and the save store, and the first one is the wooden line of always: never
 * compare the raw index, use `lineRank`.
 */
export const LINE_TIERS = [
  { label: 'Tendido de madera', cost: 5, upkeep: 0.3, reach: 3 },
  { label: 'Tendido de hormigón', cost: 18, upkeep: 1, reach: 5 },
] as const;

export type LineTier = 0 | 1;
export const MAX_LINE_TIER = LINE_TIERS.length - 1;
export const WOODEN_LINE: LineTier = 0;

/** How far the light reaches around a cell of the grid of that quality. */
export const lineReach = (tier: number): number => LINE_TIERS[Math.max(0, Math.min(MAX_LINE_TIER, tier))].reach;

/** Where a line stands in quality, worst first: the wooden one is the one of always. */
export const lineRank = (tier: number): number => Math.max(0, Math.min(MAX_LINE_TIER, tier));

/** The reach of the wooden line, for the places that talk about "the grid" without a world at hand. */
export const LINE_REACH = LINE_TIERS[WOODEN_LINE].reach;

export const COSTS = {
  road: ROAD_TIERS[ASPHALT].cost,
  bridge: 60, 
  line: LINE_TIERS[WOODEN_LINE].cost,
  zone: 5,
  park: 20,
  plant: 3000,
  bulldoze: 2,
  bulldozeLevel: 10,
  bulldozePlant: 200,
} as const;

/** Monthly upkeep. */
export const UPKEEP = {
  road: ROAD_TIERS[ASPHALT].upkeep,
  bridge: 4,
  line: LINE_TIERS[WOODEN_LINE].upkeep,
  /** Per cell of plaza, at the "Espacios verdes" budget in full. A 4×4 costs $80 a month. */
  park: 5,
  plant: 260,
  /**
   * Administration per resident. Raised from 0.06 when service upkeep started to depend on use
   * (S22): the long-run cash no longer piled up once the early deficit was gone. It costs a
   * young city almost nothing (a few pesos at 500 residents) and a big one a lot.
   */
  servicesPerResident: 0.1,
  /** Population at which the cost per resident of municipal services doubles. */
  servicesScale: 14000,
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
  gas: { label: 'Usina a gas', cost: 5500, upkeep: 400, capacity: 600, smoke: 18, smokeRadius: 4 },
  wind: { label: 'Parque eólico', cost: 4500, upkeep: 110, capacity: 400, smoke: 0, smokeRadius: 0 },
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
 * A power-line cell passes it on with the reach of its own quality (`LINE_TIERS`): a line carries the
 * light over any distance (and over water) and lights the lots along its way.
 */
export const POWER_REACH = 3;

export const MAX_LEVEL = 5;
/** Residents (R) or jobs (C, I) per building level, index = level. Level 1 is the humble one: a tin-roof house, a kiosk, a shed. */
export const CAPACITY = {
  R: [0, 3, 6, 20, 60, 160],
  C: [0, 2, 4, 12, 40, 100],
  I: [0, 3, 6, 20, 50, 120],
} as const;
/**
 * What the neighbours make of a demolition. Tearing down a home, a shop, a factory or a public
 * work leaves a grudge that costs approval for the following months and then wears off.
 *
 * The people affected count squared (`gravity * grief² / max(floor, pop)`): throwing one family out
 * is an annoyance and throwing a whole block out is a scandal, and the paper sells it that way. A
 * linear count made ten towers in a big city cost about what a shed costs, which is not what the
 * street says. Part of the points lands the same day (`shock`); the rest is the grudge that keeps
 * the approval down while it lasts.
 */
export const DEMOLITION = {
  /** People affected per resident left without a roof. */
  resident: 1,
  /** People affected per job lost: a job hurts less than a roof. */
  job: 0.5,
  /** A public work torn down (a service or a coast building). */
  work: 200,
  /** A power plant torn down. */
  plant: 250,
  /** Points of approval per affected person squared, over the population that matters for this. */
  gravity: 2.2,
  /** Population under which a demolition is felt as if the city had this many people. */
  floor: 300,
  /** Most points the grudge can take away at once. */
  max: 35,
  /** Most of those points that land the same day, before the monthly step: the news breaks today. */
  shock: 20,
  /** Share of the grudge that survives each month: about three months of bad mood, not a year. */
  keep: 0.5,
} as const;

/**
 * Events with a decision, and the promises they can leave behind. A promise has a deadline in
 * months, is checked every month against the world, and pays or costs approval when it resolves.
 */
export const PROMISE = {
  /** Months the neighbours give the Intendente to keep it. */
  months: 12,
  /** Approval points won the month it is kept. */
  kept: 8,
  /** Approval points lost the month it falls due unkept... */
  broken: 10,
  /** ...and how much the neighbours resent it, as a demolition would (see `DEMOLITION`). */
  grief: 200,
} as const;

/** How often an event with a decision can show up. */
export const EVENT = {
  /** Months the city has to live before the first one: the founding is not interrupted. */
  firstAt: 12,
  /** Months between two events. */
  gap: 16,
  /**
   * Chance per month of one showing up, once the gap has passed. The wait is `gap + 1 / chance`
   * months, so the two moved together to halve it: 8 + 3.3 with the old numbers, 16 + 6.7 now.
   */
  chance: 0.15,
  /** An event that showed up cannot show up again until this many other events have. */
  cooldown: 3,
  /** A strike (teachers, bus drivers) only comes when its budget has been cut below this percent. */
  strikeBelow: 80,
} as const;

/** Power units consumed per building level. */
export const POWER_USE = { R: 2, C: 3, I: 5 } as const;

/** The first four are the services of a village; the hospital and the university are the second level, for the tallest buildings. */
export type ServiceKind = 'school' | 'clinic' | 'police' | 'fire' | 'hospital' | 'university';
export const SERVICE_KINDS: readonly ServiceKind[] = ['school', 'clinic', 'police', 'fire', 'hospital', 'university'];

/**
 * Plazas. A patch of plaza only pays off from `minArea` cells up, so a 2×2 or a 1×3 does something
 * and a single tile is an ornament that still costs. Bigger patch, wider field; the budget for
 * green spaces decides whether it gives value or takes it away.
 */
export const PARK = {
  /** Cells below this carry no amenity at all. */
  minArea: 3,
  /** Amenity at the centre of the smallest plaza that counts, with the budget in full. */
  value: 4,
  /** Radius of the amenity field for that smallest plaza; it grows with the size of the patch. */
  radius: 3,
  /** Care at which a plaza neither gives nor takes value. */
  care: 50,
  /** Land value the neighbours lose around a plaza nobody looks after. */
  neglect: 8,
  /** Smoke a kept cell of a plaza eats, with the budget in full: the same shape as its amenity. */
  clean: 5,
} as const;

/** Smoke a single tree cell eats, and how far it reaches. A wooded hill breathes cleaner than a bald one. */
export const TREE_CLEAN = { strength: 3, radius: 1 } as const;

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
  // Second level: dear to build and to keep, with a wider reach. Without them the tallest buildings do not go up (see `levelCap`).
  hospital: { cost: 5000, upkeep: 700, radius: 15, capacity: 20000, power: 25 },
  university: { cost: 6000, upkeep: 800, radius: 16, capacity: 25000, power: 30 },
};

/**
 * Lots a service building takes on each side. The hospital and the university are one big building
 * and not a pile of clinics: they take 3x3 lots, and the block is one building for the coverage, the
 * upkeep, the power and the demolition (see `world/services.ts`).
 */
export const SERVICE_SIZE: Record<ServiceKind, number> = { school: 1, clinic: 1, police: 1, fire: 1, hospital: 3, university: 3 };

/**
 * Share of a service's upkeep that is paid whether or not anybody uses it. The rest grows with
 * the share of its capacity in use: upkeep x (FIXED_SHARE + (1 - FIXED_SHARE) x utilization).
 */
export const FIXED_SHARE = 0.25;

/**
 * Municipal loans, for when the cash is in the red: the city gets `amount` at once and pays it back
 * in `months` equal instalments. `rate` is the share charged on top, so the whole term returns
 * `amount x (1 + rate)`: taking 25.000 over 36 months at 0.45 returns 36.250 in 36 payments of 1.007.
 * One at a time.
 */
export const LOANS = [
  { label: 'Crédito chico', amount: 10000, months: 24, rate: 0.3 },
  { label: 'Crédito mediano', amount: 25000, months: 36, rate: 0.45 },
  { label: 'Crédito grande', amount: 50000, months: 48, rate: 0.6 },
] as const;

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
export const DEFAULT_FUNDING: Readonly<ServiceFunding> = { school: 100, clinic: 100, police: 100, fire: 100, hospital: 100, university: 100 };
export const MAX_FUNDING = 120;

/** Fire coverage at which firefighters put a fire out before the building is lost. */
export const FIRE_SAFE_COVER = 50;

/**
 * Los desastres que pasan sin pedir permiso: el incendio grande y el tornado.
 *
 * No son eventos con decisión —esos entran por `EVENT` y piden que el Intendente elija—: son cosas que
 * ocurren, se anuncian en el diario y el jugador se arregla con lo que tiene. Por eso tienen su propia
 * chance, mucho más baja, y su propio ritmo.
 */
export const DESASTRE = {
  /** Vecinos que se prenden a la vez en un incendio grande. */
  focos: 4,
  /** Radio del barrio que se prende, en lotes. */
  radio: 4,
  /** Chance por mes de un incendio grande: uno cada ocho años, y sólo en una ciudad de verdad. */
  fireChance: 0.01,
  /** Meses entre dos incendios grandes. */
  fireGap: 36,
  /** Habitantes a partir de los cuales la ciudad puede tener uno. */
  fireFrom: 1500,
  /** Meses que la ciudad tiene que vivir antes del primer tornado: diez años. */
  firstAt: 120,
  /**
   * Chance por mes de que pase un tornado. Uno cada cien años, en promedio: el usuario lo pidió así
   * —"pasa muy poco"—. No es un evento de gestión, es el día que se lleva el barrio.
   */
  tornadoChance: 1 / 1200,
  /**
   * El ancho del tornado, en celdas. No es fijo: lo decide el impuesto promedio de la ciudad (ver
   * `tornadoWidthFor`). Con los impuestos por el piso entra ancho, con los impuestos al tope entra angosto.
   */
  tornadoWidth: { wide: 6, narrow: 1 },
  /**
   * Distancia, en celdas al centro del mapa, a la que la alarma del tornado suena: más lejos no se oye, y
   * el susto sin sonido no se siente.
   */
  tornadoAlarmAt: 10,
} as const;

/**
 * La vida útil de una usina: a los 50 años empieza a decaer y en diez años más entrega la mitad.
 *
 * Nunca llega a cero. Una usina que se apaga sola deja al jugador con la ciudad a oscuras y sin forma de
 * salir; una que rinde la mitad le deja el tiempo de construir la nueva.
 */
export const PLANT_LIFE = { full: 600, decay: 120, floor: 0.5 } as const;

/**
 * Estimated congestion (see sim/congestion.ts). `laneCapacity` is how many commuting residents
 * one lane of street carries before it saturates (100 %). A lot on a street loaded above
 * `valueFrom` percent loses `valuePerPoint` of land value per point, and above `slowFrom` it
 * grows more slowly, down to `slowest` of its usual pace.
 */
export const TRAFFIC = { laneCapacity: 1200, valueFrom: 60, valuePerPoint: 0.3, slowFrom: 90, slowest: 0.25 } as const;

/** A street is "saturada" from this much load on: slow traffic and, with time, an empty building. */
export const JAM_CROWDED = TRAFFIC.slowFrom + 30;

/** Crime level at which a home starts losing its owner, and above which a vacant one is not taken again. */
export const CRIME_ABANDON = 60;

/**
 * How long the neighbours put up with each complaint before they leave. Every occupied lot carries an
 * anger from 0 to 100: it climbs each month while something is wrong and falls once it is fixed, and
 * at 100 the owner leaves. One complaint takes about two years to empty a lot; the block that already
 * lost its neighbours goes much faster, which is how neglect spreads.
 */
export const ANGER = {
  /** Per month, for a lot without light or without a street. */
  served: 4,
  crisis: 3,
  crime: 3,
  smoke: 3,
  jam: 2,
  /** Per abandoned building within two lots, up to `vacantMax` of them. */
  vacant: 2,
  vacantMax: 4,
  /** Most anger a lot can gain in one month, however many things are wrong at once. */
  cap: 10,
  /** What it forgives each month once nothing is wrong any more. */
  forgive: 10,
} as const;

/** A zone needs a road within this many cells (Manhattan distance). */
export const ROAD_REACH = 3;

/**
 * Public transport. A bus line is a depot on one lot whose buses take `trips` commuters off the
 * streets within `radius` lots (Manhattan distance), spread over them in proportion to what each
 * one carries. It is a number of people, not a percentage: five lines together carry five times
 * that, which is a lot but is still a number, so an avenue loaded above it stays loaded. It needs a
 * street within ROAD_REACH to work, and `buses` of the line run on it.
 */
export const BUS_SIZE = 2;
export const BUS = { label: 'Línea de colectivos', size: BUS_SIZE, cost: 900, upkeep: 90, radius: 9, trips: 500, buses: 3 } as const;
/**
 * The commercial hubs of the transport category: an airport and a harbour for walks and cruises. A
 * piece takes `w`×`h` lots, always the same way round, and pieces that share an edge are one
 * facility whose level is how many pieces it has (`HUB_LEVELS`: the pieces each level asks for).
 * Per level (1 to 3) a working facility gives `jobs` commercial jobs and `income` pesos a month; each
 * piece costs `cost` and `upkeep` a month. Measured, the old numbers paid for the whole facility in
 * nineteen months and then printed money: the airport took 1.270 pesos a month over its own upkeep and
 * the harbour 1.140 over nine months of payback. The income is now a notch lower and the upkeep a
 * notch higher, so a full facility takes about three years to pay for itself and a half-built one
 * loses money, which is what makes the tool a commitment instead of a printer. The airport is loud: it takes `noise` points of land value
 * off the lots within `noiseRadius`. The harbour has to touch the water; both need a street near.
 */
export type HubKind = 'airport' | 'harbor';
export const HUB_KINDS: readonly HubKind[] = ['airport', 'harbor'];
export const HUBS: Record<
  HubKind,
  { label: string; w: number; h: number; cost: number; upkeep: number; jobs: readonly number[]; income: readonly number[]; power: readonly number[]; names: readonly string[]; noise: readonly number[]; noiseRadius: number }
> = {
  airport: {
    label: 'Aeropuerto',
    w: 3,
    h: 2,
    cost: 6000,
    upkeep: 470,
    jobs: [20, 80, 300],
    income: [200, 720, 2300],
    power: [40, 120, 300],
    names: ['Hangar', 'Aeródromo', 'Aeropuerto internacional'],
    noise: [6, 12, 22],
    noiseRadius: 8,
  },
  harbor: {
    label: 'Puerto de paseos',
    w: 2,
    h: 2,
    cost: 3500,
    upkeep: 400,
    jobs: [15, 60, 200],
    income: [120, 480, 1350],
    power: [25, 70, 160],
    names: ['Muelle de paseos', 'Puerto', 'Puerto con cruceros'],
    noise: [0, 0, 0],
    noiseRadius: 0,
  },
};
/** Pieces side by side that a facility needs to reach level 1, 2 and 3. */
export const HUB_LEVELS: Record<HubKind, readonly number[]> = { airport: [1, 2, 4], harbor: [1, 2, 3] };

/** The seven colours of the cars of the street, the usual ones of a city street. */
export const CAR_COLORS = ['#c8392f', '#f4f0e6', '#2f63a6', '#3c8d4a', '#7d7f86', '#e0a526', '#6b3fa0'] as const;

/** Lines are told apart by a number of up to three digits, which no other line of the city has. */
export const MAX_BUS_NUMBER = 999;
/** The ten colours a line can wear, the usual ones of the buses. */
export const BUS_COLORS = [
  { name: 'Rojo', hex: '#c8392f' },
  { name: 'Azul', hex: '#2f63a6' },
  { name: 'Verde', hex: '#3c8d4a' },
  { name: 'Amarillo', hex: '#e0a526' },
  { name: 'Naranja', hex: '#e07a2f' },
  { name: 'Celeste', hex: '#6fb7e0' },
  { name: 'Blanco', hex: '#f4f0e6' },
  { name: 'Violeta', hex: '#6b3fa0' },
  { name: 'Bordó', hex: '#7a2f3a' },
  { name: 'Gris', hex: '#7d7f86' },
] as const;

/**
 * Buildings of the coast, one lot each. All of them need light and a street to work; the street
 * counts when it reaches the building or one of the coast buildings beside it, so a single street
 * serves the whole strip. `jobs` are industrial for the dock and the port and commercial for the
 * resort. None levels the ground.
 */
export type CoastKind = 'fishing' | 'promenade' | 'port' | 'resort' | 'lighthouse';
export const COAST_KINDS: readonly CoastKind[] = ['fishing', 'promenade', 'port', 'resort', 'lighthouse'];
export const COAST: Record<CoastKind, { label: string; cost: number; upkeep: number; jobs: number }> = {
  fishing: { label: 'Muelle de pescadores', cost: 400, upkeep: 45, jobs: 12 },
  promenade: { label: 'Costanera', cost: 25, upkeep: 2, jobs: 0 },
  port: { label: 'Puerto de carga', cost: 2500, upkeep: 200, jobs: 40 },
  resort: { label: 'Balneario', cost: 1800, upkeep: 145, jobs: 30 },
  lighthouse: { label: 'Faro', cost: 1500, upkeep: 60, jobs: 0 },
};

/**
 * Fish sold by a working dock each month. Measured, a dock paid for itself in six months and could be
 * strung along the whole coast, which made the cheapest building in the game the best investment in it:
 * fifty-five a month against a dearer upkeep leaves about twenty and a year and a half to pay back.
 */
export const FISHING_SALES = 55;

/**
 * Monthly tourism of a working resort. The southern summer (December to February) is the peak,
 * November and March are the shoulder and the rest of the year is quiet.
 */
export const TOURISM: { peak: number; shoulder: number; low: number; peakMonths: readonly number[]; shoulderMonths: readonly number[] } = {
  peak: 450,
  shoulder: 120,
  low: 20,
  peakMonths: [12, 1, 2],
  shoulderMonths: [11, 3],
};

/**
 * Each working port adds `perPort` to the industrial taxes, up to `max` in all. It was 0.15 and 0.45,
 * which measured as a fifth of the whole income of a mature city for three cells of coast and a
 * building that paid for itself in one month: the boost is a share of a base that grows, the price
 * does not.
 */
export const PORT_TAX_BOOST = { perPort: 0.05, max: 0.15 } as const;

/** A lighthouse may stand on land this close (in lots, any direction) to the water. */
export const LIGHTHOUSE_REACH = 2;

/** Spread of the coast buildings over the city: `radius` in lots, `strength` at the centre. */
export const COAST_FIELDS = {
  portSmoke: { radius: 4, strength: 25 },
  promenadeValue: { radius: 4, strength: 20 },
  lighthouseValue: { radius: 6, strength: 12 },
} as const;

/** Approval: one point per `promenadeLots` promenade lots up to `promenadeMax`, and `lighthouse` points for the lighthouse. */
export const COAST_APPROVAL = { promenadeLots: 8, promenadeMax: 5, lighthouse: 3 } as const;

/**
 * The unique buildings: monuments the city may raise once each, and only where the ground and the
 * neighbourhood suit them (see `world/uniques.ts`). They do not pay a fixed rent: each one adds a
 * share of the city's tourism — what the resorts, airports and harbours bring in — and has a season
 * of its own, so a monument grows with the city instead of dying of old age. Measured with the probe
 * of `odd/tasks/edificios-unicos.md`: five of them at their peak are a third of the tourism of a
 * mature city and cost about three years of upkeep to pay for themselves, like a full airport.
 */
/**
 * Switch of the package of government uniques (see `odd/tasks/edificios-unicos.md`, S11). With it at
 * false the five tools are out of `TOOLS` and out of the milestones, so the package can be taken out
 * of the game without touching anything else: nothing left behind is drawn, because nobody can build
 * them. Set it back to true and they come in again, art included.
 */
export const GOVERNMENT_UNIQUES = true;

export type UniqueKind = 'obelisco' | 'calvario' | 'puente' | 'teatro' | 'estadio' | 'cabildo' | 'regimiento' | 'planetario' | 'santuario' | 'sindicato';
/** The five any government may build, then the one each government owns (see `UNIQUES[kind].government`). */
export const UNIQUE_KINDS: readonly UniqueKind[] = ['obelisco', 'calvario', 'puente', 'teatro', 'estadio'];
export const GOVERNMENT_UNIQUE_KINDS: readonly UniqueKind[] = ['cabildo', 'regimiento', 'planetario', 'santuario', 'sindicato'];
export const ALL_UNIQUE_KINDS: readonly UniqueKind[] = [...UNIQUE_KINDS, ...GOVERNMENT_UNIQUE_KINDS];

/**
 * How many uniques a city may raise in a whole run: its own government's one and one of the shared
 * five. The rest of the list stays visible and refused.
 */
export const UNIQUE_LIMIT = 2;

export interface Unique {
  label: string;
  /** Footprint in lots, anchored at its top-left cell and never rotated, like an airport. */
  w: number;
  h: number;
  cost: number;
  upkeep: number;
  /** The only government that may build it. Absent on the five shared ones. */
  government?: GovernmentKind;
  /** Share of the tourism of the city this one adds. */
  boost: number;
  /** Share it adds instead of `boost` in the months of `peakMonths`. */
  peak: number;
  peakMonths: readonly number[];
  /** Points of approval it adds to the city each month, `peak` instead in its months (the cabildo). */
  approval?: { perMonth: number; peak: number };
  /** Crime it takes out of the lots around its footprint (the regimiento). */
  crime?: { radius: number; shade: number };
  /** Education it gives to the lots around its footprint, 0-100, like a school (the planetario). */
  edu?: { radius: number; strength: number };
  /** Points of favor it adds each month, `peak` instead in its months (the santuario). */
  favor?: { perMonth: number; peak: number };
  /** Tourism it adds for each industrial job of the city, up to `max` (the sindicato). */
  jobs?: { perJob: number; max: number };
}

export const UNIQUES: Record<UniqueKind, Unique> = {
  obelisco: { label: 'Obelisco', w: 2, h: 2, cost: 9000, upkeep: 180, boost: 0.06, peak: 0.08, peakMonths: [12, 1] },
  calvario: { label: 'El Calvario', w: 3, h: 6, cost: 12000, upkeep: 220, boost: 0.02, peak: 0.18, peakMonths: [9] },
  puente: { label: 'Puente Transbordador', w: 2, h: 6, cost: 14000, upkeep: 300, boost: 0.05, peak: 0.05, peakMonths: [] },
  teatro: { label: 'Teatro', w: 3, h: 3, cost: 16000, upkeep: 340, boost: 0.05, peak: 0.1, peakMonths: [4, 5, 6, 7, 8] },
  estadio: { label: 'Estadio', w: 4, h: 4, cost: 18000, upkeep: 420, boost: 0.08, peak: 0.12, peakMonths: [3, 4, 5, 6, 7, 8, 9, 10, 11] },
  // The one unique of each government. They cost less than the shared ones and pay in a measure of
  // their own: the cabildo in approval, the regimiento in quiet, the planetario in education, the
  // santuario in favor and the sindicato in the tourism its workers bring.
  cabildo: {
    label: 'El Cabildo',
    w: 3,
    h: 2,
    cost: 12000,
    upkeep: 300,
    government: 'democracia',
    boost: 0,
    peak: 0,
    peakMonths: [9],
    approval: { perMonth: 2, peak: 4 },
  },
  regimiento: {
    label: 'El Regimiento',
    w: 4,
    h: 3,
    cost: 9000,
    upkeep: 260,
    government: 'dictadura',
    boost: 0,
    peak: 0,
    peakMonths: [],
    crime: { radius: 7, shade: 22 },
  },
  planetario: {
    label: 'El Planetario',
    w: 3,
    h: 3,
    cost: 14000,
    upkeep: 320,
    government: 'tecnocracia',
    boost: 0,
    peak: 0,
    peakMonths: [],
    edu: { radius: 9, strength: 70 },
  },
  santuario: {
    label: 'El Santuario',
    w: 3,
    h: 4,
    cost: 13000,
    upkeep: 300,
    government: 'teocracia',
    boost: 0,
    peak: 0,
    peakMonths: [4],
    favor: { perMonth: 2, peak: 4 },
  },
  sindicato: {
    label: 'El Sindicato',
    w: 3,
    h: 2,
    cost: 11000,
    upkeep: 280,
    government: 'comunismo',
    boost: 0,
    peak: 0,
    peakMonths: [],
    jobs: { perJob: 0.00025, max: 0.16 },
  },
};

/**
 * Where each unique may stand. Every rule reads a layer the city already keeps, so the monument asks
 * for something the player can see and plan for instead of an arbitrary square of the map.
 */
export const UNIQUE_RULES = {
  /** The obelisco wants this many plaza cells within `reach` lots of its footprint (it stands in the plaza). */
  obelisco: { plazaCells: 8, reach: 2 },
  /**
   * The calvario goes up on the highest ground of *its own* map: the highest corner of its footprint
   * has to come within this many terrain levels of the map's top. A fixed height made it impossible
   * on the low maps; measured this way there is always a range to build in, and it is still the hill.
   */
  calvario: { margin: 4 },
  /** The land value the lots around the teatro must already have. */
  teatro: { value: 45, reach: 2 },
  /** The estadio wants a boulevard this near (Manhattan), because the crowd has to get there. */
  estadio: { boulevard: 6 },
  /** The cabildo is the seat of the government: it faces the plaza, so it wants a share of one near. */
  cabildo: { plazaCells: 6, reach: 3 },
  /** The regimiento wants open ground for the parade: this many lots with nothing built or zoned. */
  regimiento: { openCells: 12, reach: 4 },
  /** The planetario belongs to the university: it wants one within this many lots (Manhattan). */
  planetario: { reach: 8 },
  /** The santuario is a pilgrimage: it wants the water within this many lots. */
  santuario: { water: 4 },
  /** The sindicato stands with its workers: this many industrial lots within `reach`. */
  sindicato: { industryCells: 10, reach: 4 },
} as const;

/** Ceiling of what all the uniques together may add to tourism, so the shares can never run away. */
export const UNIQUE_BOOST_MAX = 0.35;
