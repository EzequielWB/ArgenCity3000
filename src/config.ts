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
 */
export const ROUTE = { width: 4, inset: 1, margin: 0 } as const;

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
  },
  dictadura: {
    label: 'Dictadura',
    blurb: 'Nadie te vota: el cargo es tuyo y no hay octubre que lo discuta.',
    pros: ['No hay elecciones: nunca perdés el poder', 'La ciudad crece con la plata que hacés vos'],
    cons: ['Llega un 20 % menos de gente nueva', 'La Provincia no gira subsidios', 'La aprobación no pasa de 60'],
    termYears: null,
    toWin: 0,
    migration: 0.8,
    grants: 0,
    approvalCap: 60,
    approvalStep: 4,
    taxIncome: { R: 1, C: 1, I: 1 },
    serviceCost: 1,
  },
  tecnocracia: {
    label: 'Tecnocracia',
    blurb: 'Gobierna el que sabe: mandatos largos y la mitad de la opinión en juego.',
    pros: ['Elecciones cada 6 años', 'La Provincia gira los subsidios de cada hito'],
    cons: ['La aprobación se mueve la mitad de rápido: si la ciudad se enoja, tardás en recuperarla', 'Llega un 5 % menos de gente nueva'],
    termYears: 6,
    toWin: 50,
    migration: 0.95,
    grants: 1,
    approvalCap: 100,
    approvalStep: 2,
    taxIncome: { R: 1, C: 1, I: 1 },
    serviceCost: 1,
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
  },
  comunismo: {
    label: 'Comunismo',
    blurb: 'Planifica el Estado: servicios baratos, fábricas a pleno y un plan cada cinco años.',
    pros: ['Los servicios cuestan un 30 % menos de mantener', 'Las fábricas pagan un 25 % más de impuestos', 'La aprobación casi no se mueve: los vecinos no se enojan de un mes al otro', 'Cada 5 años un plan: cumplirlo da plata y aprobación'],
    cons: ['Los comercios pagan la mitad de impuestos', 'Llega un 25 % menos de gente nueva', 'La Provincia no gira subsidios', 'Si no cumplís el plan, el pueblo se enoja', 'Congreso del Partido cada 5 años: hace falta el 40 % para seguir'],
    termYears: 5,
    toWin: 40,
    migration: 0.75,
    grants: 0,
    approvalCap: 100,
    approvalStep: 1,
    taxIncome: { R: 1, C: 0.5, I: 1.25 },
    serviceCost: 0.7,
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

export const COSTS = {
  road: ROAD_TIERS[ASPHALT].cost,
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
  road: ROAD_TIERS[ASPHALT].upkeep,
  bridge: 4,
  line: 0.3,
  /** Per cell of plaza, at the "Espacios verdes" budget in full. A 4×4 costs $80 a month. */
  park: 5,
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
 * `weight / max(floor, pop)` turns the people affected into points: a town of 300 notices one
 * house, a metropolis of 200.000 needs a whole avenue.
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
  /** Points of approval per affected person, over the population that matters for this. */
  weight: 250,
  /** Population under which a demolition is felt as if the city had this many people. */
  floor: 1000,
  /** Most points the grudge can take away at once. */
  max: 15,
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
  gap: 8,
  /** Chance per month of one showing up, once the gap has passed. */
  chance: 0.3,
  /** An event that showed up cannot show up again until this many other events have. */
  cooldown: 3,
  /** A strike (teachers, bus drivers) only comes when its budget has been cut below this percent. */
  strikeBelow: 80,
} as const;

/** Power units consumed per building level. */
export const POWER_USE = { R: 2, C: 3, I: 5 } as const;

export type ServiceKind = 'school' | 'clinic' | 'police' | 'fire';
export const SERVICE_KINDS: readonly ServiceKind[] = ['school', 'clinic', 'police', 'fire'];

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
} as const;

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

/**
 * Public transport. A bus line is a depot on one lot that takes load off the streets around it:
 * every street within `radius` lots (Manhattan distance) carries `relief` less, and several lines
 * add up, never past `maxRelief`. It needs a street within ROAD_REACH to be built. `buses` of the
 * line run on the streets of its area.
 */
export const BUS = { label: 'Línea de colectivos', cost: 900, upkeep: 90, radius: 9, relief: 0.35, maxRelief: 0.6, buses: 3 } as const;
/**
 * The commercial hubs of the transport category: an airport and a harbour for walks and cruises. A
 * piece takes `w`×`h` lots, always the same way round, and pieces that share an edge are one
 * facility whose level is how many pieces it has (`HUB_LEVELS`: the pieces each level asks for).
 * Per level (1 to 3) a working facility gives `jobs` commercial jobs and `income` pesos a month; each
 * piece costs `cost` and `upkeep` a month. The airport is loud: it takes `noise` points of land value
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
    upkeep: 450,
    jobs: [20, 80, 300],
    income: [250, 900, 2800],
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
    upkeep: 280,
    jobs: [15, 60, 200],
    income: [150, 600, 1800],
    power: [25, 70, 160],
    names: ['Muelle de paseos', 'Puerto', 'Puerto con cruceros'],
    noise: [0, 0, 0],
    noiseRadius: 0,
  },
};
/** Pieces side by side that a facility needs to reach level 1, 2 and 3. */
export const HUB_LEVELS: Record<HubKind, readonly number[]> = { airport: [1, 2, 4], harbor: [1, 2, 3] };

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
 * Buildings of the coast, one lot each. A dock, a port and a resort work (give jobs and income)
 * only with a street within `ROAD_REACH`; the promenade and the lighthouse need nothing. `jobs`
 * are industrial for the dock and the port and commercial for the resort. None of them needs
 * light, and none levels the ground.
 */
export type CoastKind = 'fishing' | 'promenade' | 'port' | 'resort' | 'lighthouse';
export const COAST_KINDS: readonly CoastKind[] = ['fishing', 'promenade', 'port', 'resort', 'lighthouse'];
export const COAST: Record<CoastKind, { label: string; cost: number; upkeep: number; jobs: number }> = {
  fishing: { label: 'Muelle de pescadores', cost: 400, upkeep: 30, jobs: 12 },
  promenade: { label: 'Costanera', cost: 25, upkeep: 2, jobs: 0 },
  port: { label: 'Puerto de carga', cost: 2500, upkeep: 200, jobs: 40 },
  resort: { label: 'Balneario', cost: 1800, upkeep: 120, jobs: 30 },
  lighthouse: { label: 'Faro', cost: 1500, upkeep: 60, jobs: 0 },
};

/** Fish sold by a working dock each month. */
export const FISHING_SALES = 80;

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

/** Each working port adds `perPort` to the industrial taxes, up to `max` in all. */
export const PORT_TAX_BOOST = { perPort: 0.15, max: 0.45 } as const;

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
