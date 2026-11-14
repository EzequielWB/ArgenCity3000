import { EVENT, MAX_FUNDING, MAX_TAX, SERVICES, TICKS_PER_MONTH } from '../config';
import type { Rng } from '../core/rng';
import { TILE, type World, zoneOf } from '../world/world';
import { dateOf } from './calendar';
import { countSchools } from './commitments';
import { COAST_BOOST, COAST_WORN, FREEZE, INDUSTRY_BOOM, INDUSTRY_FROZEN, NO_BLACKOUT, coolOf, lockOf } from './effects';
import { waterDistance } from './fields';
import { isUnlocked } from './milestones';
import { monthsToElection } from './politics';
import type { Simulation } from './simulation';

/** One of the two things the Intendente can do about an event. */
export interface EventOption {
  /** The button, in the imperative: what the Intendente does. */
  label: string;
  /** The consequence, in plain words, right under the label: no numbers to decode. */
  detail: string;
  /** What it does to the city. */
  apply: (sim: Simulation) => void;
}

/** A case that shows up in the middle of the game and asks for a decision, with two ways out. */
export interface CityEvent {
  id: string;
  title: string;
  text: string;
  /** Only fires when this holds: the case has to be about *this* city. */
  when: (sim: Simulation) => boolean;
  options: readonly [EventOption, EventOption];
}

/** How far from the water a spill, a flood or a drowned seafront still counts. */
const SHORE = 6;

/** Plain average of a per-cell measure over the buildings that are standing. */
function averageOf(w: World, field: Uint8Array): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < field.length; i++) {
    if (w.level[i] > 0 && !w.abandoned[i]) {
      sum += field[i];
      n++;
    }
  }
  return n === 0 ? 0 : sum / n;
}

const smokeOf = (w: World): number => averageOf(w, w.pollution);
const crimeOf = (w: World): number => averageOf(w, w.crime);

/** Lots of a zone with something built on them. */
function lotsOf(w: World, zone: 'R' | 'C' | 'I'): number {
  let n = 0;
  for (let i = 0; i < w.tiles.length; i++) if (zoneOf(w.tiles[i]) === zone && w.level[i] > 0) n++;
  return n;
}

/** Coverage of a service over the homes of the city, in percent. */
function coverageOf(w: World, field: Uint8Array): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < field.length; i++) {
    if (w.tiles[i] === TILE.R && w.level[i] > 0 && !w.abandoned[i]) {
      sum += field[i];
      n++;
    }
  }
  return n === 0 ? 100 : sum / n;
}

/** Cells of the biggest plaza in the city (0 when there is none). */
function largestPark(w: World): number {
  let best = 0;
  for (let i = 0; i < w.parkArea.length; i++) if (w.parkArea[i] > best) best = w.parkArea[i];
  return best;
}

const COAST_TILES = [TILE.PROMENADE, TILE.RESORT, TILE.PORT, TILE.FISHING, TILE.LIGHTHOUSE];

/** True when the city has anything built on the water: the coast is part of its life. */
function coastBuilt(w: World): boolean {
  return COAST_TILES.some((t) => w.tiles.includes(t));
}

/** The industrial building that smokes the most and still stands next to the water, or -1. */
function dirtiestNearWater(w: World): number {
  const water = waterDistance(w);
  let worst = -1;
  let smoke = 0;
  for (let i = 0; i < w.tiles.length; i++) {
    if (zoneOf(w.tiles[i]) !== 'I' || w.level[i] === 0 || w.abandoned[i] || water[i] > SHORE) continue;
    if (w.pollution[i] > smoke) (smoke = w.pollution[i]), (worst = i);
  }
  return worst;
}

/** Homes and shops on the first row of the water, the ones a flood takes first. */
function firstRow(w: World, limit: number): number[] {
  const water = waterDistance(w);
  const cells: number[] = [];
  for (let i = 0; i < w.tiles.length && cells.length < limit; i++) {
    if (w.level[i] === 0 || w.abandoned[i] || water[i] > 1) continue;
    if (zoneOf(w.tiles[i])) cells.push(i);
  }
  return cells;
}

/** Schools the city should have for its population, at the rate one school covers. */
function schoolsNeeded(pop: number): number {
  return Math.ceil(pop / SERVICES.school.capacity);
}

const ASAMBLEA: CityEvent = {
  id: 'asamblea-escuela',
  title: 'El barrio se organiza',
  text: 'Una asamblea vecinal junta firmas para que la ciudad construya la escuela del barrio. Prometen cortar la calle si no hay respuesta.',
  when: (sim) =>
    isUnlocked('school', sim.state.milestone) &&
    countSchools(sim.world) < schoolsNeeded(sim.totals.pop) &&
    sim.totals.pop > 1200,
  options: [
    {
      label: 'Prometer la escuela',
      detail: 'La ciudad se compromete a levantarla: si no está en un año, el barrio se lo toma a mal.',
      apply: (sim) => sim.promise('school'),
    },
    {
      label: 'Dar vueltas',
      detail: 'Ni obra ni promesa. Los vecinos se lo anotan y la aprobación baja ahora.',
      apply: (sim) => sim.nudgeApproval(-6),
    },
  ],
};

const PIQUETE: CityEvent = {
  id: 'piquete',
  title: 'Piquete en la avenida',
  text: 'Un gremio corta la avenida principal. Los camiones no llegan al puerto y los colectivos hacen dos horas.',
  when: (sim) => sim.congestion.jammedShare > 0.35 && sim.totals.pop > 2000,
  options: [
    {
      label: 'Mandar la policía',
      detail: 'El corte se levanta en el día, pero los que estaban en la calle se lo anotan: la aprobación baja unos meses.',
      apply: (sim) => {
        sim.state.grief += 150;
        sim.nudgeApproval(-4);
      },
    },
    {
      label: 'Aguantar el corte',
      detail: 'Nadie se enoja, pero los camiones no llegan: dos meses sin que se levante nada nuevo.',
      apply: (sim) => sim.effect(FREEZE, 2),
    },
  ],
};

const PROVINCIA: CityEvent = {
  id: 'provincia',
  title: 'La Provincia pone la plata',
  text: 'La Gobernación ofrece veinte mil pesos para el hospital, pero quiere que la ciudad se haga cargo del doble de insumos.',
  when: (sim) =>
    !sim.hasEffect(coolOf('provincia')) &&
    sim.totals.pop > 1000 &&
    (sim.state.cash < 5000 || (sim.state.lastBudget?.balance ?? 0) < 0),
  options: [
    {
      label: 'Aceptar la plata',
      detail: 'Entran $20.000 ahora. Salud queda clavada en 120 % por dos años: no la podés bajar aunque la caja reviente.',
      apply: (sim) => {
        sim.state.cash += 20000;
        sim.setFunding('clinic', 120);
        sim.effect(lockOf('clinic'), 24);
      },
    },
    {
      label: 'Rechazarla',
      detail: 'La caja sigue igual y nadie firma nada, pero la Provincia no vuelve a ofrecer nada en un año.',
      apply: (sim) => sim.effect(coolOf('provincia'), 12),
    },
  ],
};

const DERRAME: CityEvent = {
  id: 'derrame',
  title: 'Derrame en el arroyo',
  text: 'Una fábrica del barrio sur vuelca combustible en el arroyo que cruza el distrito. El agua se ve negra.',
  when: (sim) => lotsOf(sim.world, 'I') > 20 && smokeOf(sim.world) > 25 && dirtiestNearWater(sim.world) >= 0,
  options: [
    {
      label: 'Clausurarla',
      detail: 'La fábrica más humeante cerca del agua queda abandonada: baja el humo y se pierden sus empleos.',
      apply: (sim) => {
        const cell = dirtiestNearWater(sim.world);
        if (cell >= 0) sim.abandonBuilding(cell);
        sim.nudgeApproval(4);
      },
    },
    {
      label: 'Multarla y que siga',
      detail: 'Entran $8.000. La fábrica sigue trabajando y el humo no baja.',
      apply: (sim) => {
        sim.state.cash += 8000;
        sim.nudgeApproval(-3);
      },
    },
  ],
};

const CALOR: CityEvent = {
  id: 'ola-de-calor',
  title: 'Ola de calor',
  text: 'Tres semanas arriba de 38 grados. Las salitas están al límite y en los barrios sin plaza no hay dónde esperar la noche.',
  when: (sim) => {
    const month = dateOf(sim.state.tick).month;
    return (month === 1 || month === 2) && sim.totals.pop > 1500 && coverageOf(sim.world, sim.world.health) < 60;
  },
  options: [
    {
      label: 'Abrir paradores con agua',
      detail: 'Cuestan $9.000 el verano, pero hay agua y sombra: la aprobación sube.',
      apply: (sim) => {
        sim.state.cash -= 9000;
        sim.nudgeApproval(6);
      },
    },
    {
      label: 'Que se aguante',
      detail: 'No se gasta nada. Baja la aprobación y el barrio se lo toma a mal.',
      apply: (sim) => {
        sim.nudgeApproval(-8);
        sim.state.grief += 100;
      },
    },
  ],
};

const PLAZA: CityEvent = {
  id: 'plaza-vecina',
  title: 'Vecinos piden una plaza',
  text: 'Una asamblea pide que el baldío de la esquina sea plaza. Al lado hay un inversor que quiere levantar un depósito.',
  when: (sim) => sim.totals.pop > 3000 && largestPark(sim.world) < 9,
  options: [
    {
      label: 'Ceder el terreno',
      detail: 'Te comprometés a plantar un 2×2 en un año: si está, sube la aprobación y el valor del suelo; si no, la baja el doble.',
      apply: (sim) => sim.promise('plaza'),
    },
    {
      label: 'Venderlo al inversor',
      detail: 'Entran $6.000 y llegan empleos. El barrio se queda con el enojo de la asamblea.',
      apply: (sim) => {
        sim.state.cash += 6000;
        sim.state.grief += 150;
      },
    },
  ],
};

const ROBOS: CityEvent = {
  id: 'ola-de-robos',
  title: 'Ola de robos',
  text: 'Tres noches seguidas de entraderas en el centro. Los comerciantes amenazan con bajar las persianas.',
  when: (sim) =>
    !sim.hasEffect(coolOf('ola-de-robos')) &&
    sim.totals.pop > 2000 &&
    crimeOf(sim.world) > 30 &&
    sim.state.funding.police < MAX_FUNDING,
  options: [
    {
      label: 'Reforzar el patrullaje',
      detail: 'Comisarías al 120 % durante un año: mientras no las bajes, la ola no vuelve.',
      apply: (sim) => {
        sim.setFunding('police', MAX_FUNDING);
        sim.effect(coolOf('ola-de-robos'), 12);
      },
    },
    {
      label: 'Campaña de prevención',
      detail: 'Cuestan $4.000 en folletos y alarmas. Sube la aprobación; el delito sigue igual.',
      apply: (sim) => {
        sim.state.cash -= 4000;
        sim.nudgeApproval(5);
      },
    },
  ],
};

const CURTIEMBRE: CityEvent = {
  id: 'curtiembre',
  title: 'Una fábrica quiere instalarse',
  text: 'Una curtiembre ofrece ochenta empleos si le cedés dos manzanas cerca del arroyo. Los vecinos ya juntan firmas en contra.',
  when: (sim) => sim.demand.I > 60 && sim.totals.pop > sim.totals.iJobs,
  options: [
    {
      label: 'Cederle el terreno',
      detail: 'Paga $4.000 por el terreno. Llegan los empleos y el humo: un año de industria a full y vecinos quejándose.',
      apply: (sim) => {
        sim.state.cash += 4000;
        sim.effect(INDUSTRY_BOOM, 12);
        sim.state.grief += 150;
        sim.nudgeApproval(-2);
      },
    },
    {
      label: 'Rechazarla',
      detail: 'La demanda industrial se enfría seis meses, pero el barrio lo agradece.',
      apply: (sim) => {
        sim.effect(INDUSTRY_FROZEN, 6);
        sim.nudgeApproval(4);
      },
    },
  ],
};

const CRECIDA: CityEvent = {
  id: 'crecida',
  title: 'El río crece',
  text: 'Llueve una semana entera y el río se lleva la costanera. No hay defensa y el agua ya llega a las primeras cuadras.',
  when: (sim) => {
    const month = dateOf(sim.state.tick).month;
    return month >= 3 && month <= 5 && coastBuilt(sim.world) && sim.totals.pop > 5000;
  },
  options: [
    {
      label: 'Hacer la obra de defensa',
      detail: 'Cuestan $15.000. Se salva todo y la costa queda protegida tres años.',
      apply: (sim) => {
        sim.state.cash -= 15000;
        sim.effect(coolOf('crecida'), 36);
      },
    },
    {
      label: 'Dejar que pase',
      detail: 'No cuesta nada. Las casas de la primera fila del agua quedan vacías y el barrio se enoja.',
      apply: (sim) => {
        for (const cell of firstRow(sim.world, 24)) sim.abandonBuilding(cell);
        sim.state.grief += 250;
      },
    },
  ],
};

const FERIA: CityEvent = {
  id: 'feria',
  title: 'Feria del pueblo',
  text: 'Los vecinos quieren una feria de tres días en la plaza central. Va a venir gente de todos lados, y también sus autos.',
  when: (sim) => sim.state.approval > 55 && sim.totals.pop > 1000,
  options: [
    {
      label: 'Pagar el operativo',
      detail: 'Cuestan $2.500 de vallas y baños. Sube la aprobación, pero un mes de tránsito trabado.',
      apply: (sim) => {
        sim.state.cash -= 2500;
        sim.nudgeApproval(6);
        sim.effect(FREEZE, 1);
      },
    },
    {
      label: 'Negarla',
      detail: 'No se gasta ni se traba nada, y los organizadores se lo toman a mal: la aprobación baja.',
      apply: (sim) => sim.nudgeApproval(-5),
    },
  ],
};

const USINA: CityEvent = {
  id: 'corte-de-usina',
  title: 'Corte en la usina',
  text: 'Se para un transformador y la usina no da abasto. Media ciudad está a oscuras y los comercios pierden la mercadería.',
  when: (sim) => sim.totals.pop > 1500 && (sim.power.shortage || (sim.power.capacity > 0 && sim.power.use > sim.power.capacity * 0.9)),
  options: [
    {
      label: 'Comprarle luz a la Provincia',
      detail: 'Cuestan $18.000 tres meses de luz comprada: no hay cortes ni la ciudad se frena.',
      apply: (sim) => {
        sim.state.cash -= 18000;
        sim.effect(NO_BLACKOUT, 3);
      },
    },
    {
      label: 'Racionar',
      detail: 'No cuesta nada. Un mes de cortes por turnos: baja la aprobación y no se levanta nada nuevo.',
      apply: (sim) => {
        sim.nudgeApproval(-8);
        sim.effect(FREEZE, 1);
      },
    },
  ],
};

const COIMA: CityEvent = {
  id: 'coima',
  title: 'Coima en la obra',
  text: 'Un inspector ofrece aprobar la pavimentación sin revisar nada a cambio de cinco mil pesos. La mitad del barrio ya lo sabe.',
  when: (sim) => {
    const left = monthsToElection(sim.state.tick, sim.state.government);
    const nearElection = left !== null && left <= 12;
    // There has to be work going on: a city that stopped growing is not paving anything.
    const h = sim.state.history;
    const growing = h.length >= 2 && h[h.length - 1].pop > h[h.length - 2].pop;
    return sim.state.cash > 20000 && sim.totals.pop > 800 && growing && !nearElection;
  },
  options: [
    {
      label: 'Denunciarlo',
      detail: 'Sube la aprobación y sale en el diario, pero la obra se frena un mes.',
      apply: (sim) => {
        sim.nudgeApproval(6);
        sim.effect(FREEZE, 1);
        sim.report('El Intendente denunció una coima en la obra: la pavimentación se frena un mes');
      },
    },
    {
      label: 'Taparlo',
      detail: 'Entran $5.000. Con tres de diez chances sale a la luz, y si sale la aprobación se hunde seis meses.',
      apply: (sim) => {
        sim.state.cash += 5000;
        if (!sim.chance(0.3)) return;
        sim.nudgeApproval(-12);
        sim.state.grief += 200;
        sim.report('Salió a la luz la coima en la obra: el barrio no perdona al Intendente');
      },
    },
  ],
};

const SEQUIA: CityEvent = {
  id: 'sequia',
  title: 'Se viene la sequía',
  text: 'La seca arruina la cosecha y el campo deja de comprar. Las fábricas de la ciudad empiezan a producir menos.',
  when: (sim) => sim.totals.iJobs > 500 && sim.totals.pop > 3000,
  options: [
    {
      label: 'Subsidiar la producción',
      detail: 'Cuestan $12.000 tres meses de subsidio: la industria aguanta.',
      apply: (sim) => {
        sim.state.cash -= 12000;
        sim.effect(INDUSTRY_BOOM, 3);
      },
    },
    {
      label: 'Que el mercado decida',
      detail: 'No cuesta nada. La demanda industrial cae seis meses y con ella los empleos.',
      apply: (sim) => sim.effect(INDUSTRY_FROZEN, 6),
    },
  ],
};

const HUMO: CityEvent = {
  id: 'humo',
  title: 'Los vecinos no quieren humo',
  text: 'El barrio norte presenta un informe con los casos de tos del invierno y pide que las fábricas pongan filtros.',
  when: (sim) => smokeOf(sim.world) > 20 && sim.totals.pop > 5000,
  options: [
    {
      label: 'Exigir filtros',
      detail: 'Los impuestos industriales suben dos puntos: entra más plata y la industria se enfría un año.',
      apply: (sim) => {
        sim.setTax(Math.min(MAX_TAX, sim.state.taxes.I + 2), 'I');
        sim.effect(INDUSTRY_FROZEN, 12);
        sim.nudgeApproval(5);
      },
    },
    {
      label: 'Ignorarlos',
      detail: 'Nada cambia y el barrio se queja tres meses.',
      apply: (sim) => {
        sim.nudgeApproval(-6);
        sim.state.grief += 120;
      },
    },
  ],
};

const TEMPORADA: CityEvent = {
  id: 'temporada',
  title: 'Temporada en la costanera',
  text: 'Se viene un verano enorme y los balnearios no dan abasto. La costanera se rompe con tanta gente y los puesteros piden mano.',
  when: (sim) => dateOf(sim.state.tick).month === 12 && coastBuilt(sim.world) && sim.totals.pop > 500,
  options: [
    {
      label: 'Invertir en la temporada',
      detail: 'Cuestan $5.000 de mantenimiento y guardavidas. La costa rinde la mitad más todo el verano y la aprobación sube.',
      apply: (sim) => {
        sim.state.cash -= 5000;
        sim.effect(COAST_BOOST, 3);
        sim.nudgeApproval(4);
      },
    },
    {
      label: 'Dejar como está',
      detail: 'No cuesta nada y la temporada rinde lo normal, pero la costanera se gasta: dos años de suelo barato junto al agua.',
      apply: (sim) => sim.effect(COAST_WORN, 24),
    },
  ],
};

/** The catalogue, in no particular order: `pickEvent` rolls among the ones the city deserves. */
export const EVENTS: readonly CityEvent[] = [
  PIQUETE,
  PROVINCIA,
  DERRAME,
  CALOR,
  PLAZA,
  ROBOS,
  CURTIEMBRE,
  CRECIDA,
  FERIA,
  USINA,
  ASAMBLEA,
  COIMA,
  SEQUIA,
  HUMO,
  TEMPORADA,
];

export function eventById(id: string): CityEvent | undefined {
  return EVENTS.find((e) => e.id === id);
}

/**
 * The event that shows up this month, or null. Never two at once, never while a promise is being
 * watched (the city has enough to answer for), never in the first year, never sooner than
 * `EVENT.gap` after the last one, and never one that is still cooling down. The roll comes from the
 * simulation's own seeded rng, so a saved game replays the same.
 */
export function pickEvent(sim: Simulation, rng: Rng): CityEvent | null {
  const s = sim.state;
  if (s.pendingEvent || s.commitment) return null;
  if (s.tick < TICKS_PER_MONTH * EVENT.firstAt) return null;
  if (s.tick - s.lastEvent < TICKS_PER_MONTH * EVENT.gap) return null;
  if (!rng.chance(EVENT.chance)) return null;
  const candidates = EVENTS.filter((e) => !sim.hasEffect(coolOf(e.id)) && e.when(sim));
  return candidates.length > 0 ? rng.pick(candidates) : null;
}
