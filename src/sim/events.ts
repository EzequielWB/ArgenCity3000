import { DIRT, EVENT, MAX_FUNDING, MAX_TAX, SERVICES, TICKS_PER_MONTH, WEEKS_PER_MONTH } from '../config';
import type { Rng } from '../core/rng';
import { busStations } from '../world/transport';
import { TILE, type World, zoneOf } from '../world/world';
import { HOLIDAYS, celebratedHolidayOf, dateOf, type Holiday } from './calendar';
import { countSchools } from './commitments';
import { COAST_BOOST, COAST_WORN, FIESTA, FREEZE, INDUSTRY_BOOM, INDUSTRY_FROZEN, NO_BLACKOUT, coolOf, lockOf } from './effects';
import { waterDistance } from './fields';
import { isUnlocked } from './milestones';
import { monthsToElection } from './politics';
import type { Simulation } from './simulation';

/**
 * A case charges and pays in weeks of what the city collects, not in pesos. The fixed amounts these
 * cases used to carry were measured to be two years of income for a town of five thousand and half
 * a day for a city of a hundred thousand: the same decision was a catastrophe or a rounding error.
 * Four weeks to the month, and a floor so a town that has not collected anything yet still pays.
 */
const WEEK_FLOOR = 500;

/** What `weeks` weeks of this city's income are worth. */
export function weeksOfIncome(sim: Simulation, weeks: number): number {
  const income = sim.state.lastBudget?.income ?? 0;
  return Math.max(WEEK_FLOOR, Math.round(income / WEEKS_PER_MONTH)) * weeks;
}

/** One of the ways out of an event: usually two, three on a holiday. */
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
  /** Set on a holiday: it has a fixed date, and the window says so. */
  kind?: 'feriado';
  /** Only fires when this holds: the case has to be about *this* city. */
  when: (sim: Simulation) => boolean;
  options: readonly EventOption[];
}

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

/** The industrial building that smokes the most and still stands, wherever it is, or -1. */
function dirtiestFactory(w: World): number {
  let worst = -1;
  let smoke = 0;
  for (let i = 0; i < w.tiles.length; i++) {
    if (zoneOf(w.tiles[i]) !== 'I' || w.level[i] === 0 || w.abandoned[i]) continue;
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
      detail: 'Entra lo que la ciudad recauda en siete semanas. Salud queda clavada en 120 % por dos años: no la podés bajar aunque la caja reviente.',
      apply: (sim) => {
        sim.state.cash += weeksOfIncome(sim, 7);
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

const FABRICA: CityEvent = {
  id: 'fabrica-sin-controles',
  title: 'Una fábrica sin controles',
  text: 'Una inspección sorpresa encuentra una fábrica trabajando sin las normas de seguridad al día. Pierde humo, el barrio se queja de los olores y los obreros dicen que no hay ni matafuegos.',
  when: (sim) => lotsOf(sim.world, 'I') > 20 && smokeOf(sim.world) > 25 && dirtiestFactory(sim.world) >= 0,
  options: [
    {
      label: 'Clausurarla',
      detail: 'La fábrica que más contamina queda abandonada: baja el humo y se pierden sus empleos.',
      apply: (sim) => {
        const cell = dirtiestFactory(sim.world);
        if (cell >= 0) sim.abandonBuilding(cell);
        sim.nudgeApproval(4);
      },
    },
    {
      label: 'Multarla y que siga',
      detail: 'Entran tres semanas de recaudación. La fábrica sigue sin controles: trabaja igual y el humo no baja.',
      apply: (sim) => {
        sim.state.cash += weeksOfIncome(sim, 3);
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
      detail: 'Cuestan tres semanas de recaudación, pero hay agua y sombra: la aprobación sube.',
      apply: (sim) => {
        sim.state.cash -= weeksOfIncome(sim, 3);
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
      detail: 'Entran dos semanas de recaudación y llegan empleos. El barrio se queda con el enojo de la asamblea.',
      apply: (sim) => {
        sim.state.cash += weeksOfIncome(sim, 2);
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
      detail: 'Cuestan una semana y media de recaudación, en folletos y alarmas. Sube la aprobación; el delito sigue igual.',
      apply: (sim) => {
        sim.state.cash -= weeksOfIncome(sim, 1.5);
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
      detail: 'Paga una semana y media de recaudación por el terreno. Llegan los empleos y el humo: un año de industria a full y vecinos quejándose.',
      apply: (sim) => {
        sim.state.cash += weeksOfIncome(sim, 1.5);
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
      detail: 'Cuestan cinco semanas de recaudación. Se salva todo y la costa queda protegida tres años.',
      apply: (sim) => {
        sim.state.cash -= weeksOfIncome(sim, 5);
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
      detail: 'Cuesta una semana de recaudación, en vallas y baños. Sube la aprobación, pero un mes de tránsito trabado.',
      apply: (sim) => {
        sim.state.cash -= weeksOfIncome(sim, 1);
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
      detail: 'Cuestan seis semanas de recaudación: tres meses de luz comprada, no hay cortes ni la ciudad se frena.',
      apply: (sim) => {
        sim.state.cash -= weeksOfIncome(sim, 6);
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
      detail: 'Entran dos semanas de recaudación. Con tres de diez chances sale a la luz, y si sale la aprobación se hunde seis meses.',
      apply: (sim) => {
        sim.state.cash += weeksOfIncome(sim, 2);
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
      detail: 'Cuestan cuatro semanas de recaudación: tres meses de subsidio, la industria aguanta.',
      apply: (sim) => {
        sim.state.cash -= weeksOfIncome(sim, 4);
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
      detail: 'Cuestan dos semanas de recaudación, en mantenimiento y guardavidas. La costa rinde la mitad más todo el verano y la aprobación sube.',
      apply: (sim) => {
        sim.state.cash -= weeksOfIncome(sim, 2);
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

/** Street cells of the lowest quality, the ones the mud takes first. */
function dirtStreets(w: World): number {
  let n = 0;
  for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === TILE.ROAD && w.roadTier[i] === DIRT) n++;
  return n;
}

/** Buildings of one kind on the map. */
function countTile(w: World, tile: number): number {
  let n = 0;
  for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === tile) n++;
  return n;
}

/** True in the months of the given list (1 = January). */
const inMonths = (sim: Simulation, months: readonly number[]): boolean => months.includes(dateOf(sim.state.tick).month);

const PARO_DOCENTE: CityEvent = {
  id: 'paro-docente',
  title: 'Paro docente',
  text: 'Los docentes paran tres días: con el presupuesto de las escuelas y de la universidad recortado, los sueldos no alcanzan. Las aulas quedan vacías y los padres no saben con quién dejar a los chicos.',
  when: (sim) =>
    sim.totals.pop > 1500 &&
    ((countSchools(sim.world) > 0 && sim.state.funding.school < EVENT.strikeBelow) || (countTile(sim.world, TILE.UNIVERSITY) > 0 && sim.state.funding.university < EVENT.strikeBelow)),
  options: [
    {
      label: 'Pagar lo adeudado',
      detail: 'Cuestan dos semanas y media de recaudación, el doble si la universidad también está recortada, y los presupuestos vuelven al 100 %. Vuelven las clases y los docentes lo reconocen: sube la aprobación.',
      apply: (sim) => {
        sim.state.cash -= weeksOfIncome(sim, 2.5);
        sim.setFunding('school', 100);
        // The university is paid too when its budget was the one that was cut.
        if (sim.state.funding.university < EVENT.strikeBelow) {
          sim.state.cash -= weeksOfIncome(sim, 2);
          sim.setFunding('university', 100);
        }
        sim.nudgeApproval(4);
      },
    },
    {
      label: 'Descontar los días',
      detail: 'No cuesta nada, pero el paro se alarga y las familias se enojan: baja la aprobación.',
      apply: (sim) => sim.nudgeApproval(-7),
    },
  ],
};

/** The doctors of the hospital stop when its budget is cut: the second-level service has its own strike. */
const PARO_SALUD: CityEvent = {
  id: 'paro-de-salud',
  title: 'Paro en el hospital',
  text: 'Los médicos y las enfermeras del hospital paran: con el presupuesto recortado, los sueldos no alcanzan y faltan insumos. Solo atienden urgencias y las salas se llenan de gente esperando.',
  when: (sim) => countTile(sim.world, TILE.HOSPITAL) > 0 && sim.totals.pop > 1500 && sim.state.funding.hospital < EVENT.strikeBelow,
  options: [
    {
      label: 'Pagar lo adeudado',
      detail: 'Cuestan tres semanas de recaudación y el presupuesto del hospital vuelve al 100 %. Se normaliza la atención y el personal lo reconoce: sube la aprobación.',
      apply: (sim) => {
        sim.state.cash -= weeksOfIncome(sim, 3);
        sim.setFunding('hospital', 100);
        sim.nudgeApproval(4);
      },
    },
    {
      label: 'Esperar que se cansen',
      detail: 'No cuesta nada, pero el hospital sigue a medias y los vecinos se enojan: baja la aprobación.',
      apply: (sim) => sim.nudgeApproval(-7),
    },
  ],
};

const PARO_COLECTIVOS: CityEvent = {
  id: 'paro-de-colectivos',
  title: 'Paro de colectivos',
  text: 'Los choferes de las líneas de colectivos paran: con el presupuesto de transporte recortado, los sueldos llegan tarde. Nadie llega al centro y los comercios abren con las persianas a medias.',
  when: (sim) => busStations(sim.world).length > 0 && sim.totals.pop > 1500 && sim.state.transport < EVENT.strikeBelow,
  options: [
    {
      label: 'Pagar el atraso',
      detail: 'Cuestan dos semanas de recaudación y el presupuesto de transporte vuelve al 100 %. Los colectivos vuelven a la calle y la gente lo agradece: sube la aprobación.',
      apply: (sim) => {
        sim.state.cash -= weeksOfIncome(sim, 2);
        sim.setTransport(100);
        sim.nudgeApproval(3);
      },
    },
    {
      label: 'Dejarlos parar',
      detail: 'No cuesta nada. Un mes sin que se levante nada nuevo, porque nadie llega a las obras, y baja la aprobación.',
      apply: (sim) => {
        sim.nudgeApproval(-5);
        sim.effect(FREEZE, 1);
      },
    },
  ],
};

const BARRO: CityEvent = {
  id: 'barro-en-las-calles',
  title: 'Barro en las calles',
  text: 'Llovió dos días seguidos y las calles de tierra son un pantano. Los remises no entran y los chicos llegan a la escuela embarrados hasta las rodillas.',
  when: (sim) => dirtStreets(sim.world) >= 20 && sim.totals.pop > 600,
  options: [
    {
      label: 'Mandar la niveladora',
      detail: 'Cuesta una semana de recaudación, en combustible y horas de máquina. Se arreglan las calles y los vecinos lo valoran: sube la aprobación.',
      apply: (sim) => {
        sim.state.cash -= weeksOfIncome(sim, 1);
        sim.nudgeApproval(4);
      },
    },
    {
      label: 'Esperar a que seque',
      detail: 'No cuesta nada, pero los vecinos pasan una semana en el barro y se lo anotan: baja la aprobación.',
      apply: (sim) => sim.nudgeApproval(-5),
    },
  ],
};

const BROTE: CityEvent = {
  id: 'brote-de-gripe',
  title: 'Brote de gripe',
  text: 'Un brote de gripe llena las guardias. Las salitas no dan abasto y los vecinos hacen cola desde la madrugada.',
  when: (sim) => inMonths(sim, [5, 6, 7, 8]) && sim.totals.pop > 2500 && coverageOf(sim.world, sim.world.health) < 70,
  options: [
    {
      label: 'Campaña de vacunación',
      detail: 'Cuestan dos semanas de recaudación, en vacunas y carpas sanitarias. Se contiene el brote y sube la aprobación.',
      apply: (sim) => {
        sim.state.cash -= weeksOfIncome(sim, 2);
        sim.nudgeApproval(5);
      },
    },
    {
      label: 'Que se atiendan como puedan',
      detail: 'No cuesta nada. El brote se extiende y los vecinos no lo perdonan: baja la aprobación.',
      apply: (sim) => sim.nudgeApproval(-7),
    },
  ],
};

const GRANIZADA: CityEvent = {
  id: 'granizada',
  title: 'Granizada',
  text: 'Una tormenta de granizo rompe techos, vidrios y autos en media ciudad. Los vecinos salen a la calle a ver qué se salvó.',
  when: (sim) => inMonths(sim, [10, 11, 12, 1, 2]) && sim.totals.pop > 1500,
  options: [
    {
      label: 'Ayudar a los afectados',
      detail: 'Cuestan dos semanas y media de recaudación, en chapas y vidrios. Los barrios se levantan rápido y sube la aprobación.',
      apply: (sim) => {
        sim.state.cash -= weeksOfIncome(sim, 2.5);
        sim.nudgeApproval(4);
      },
    },
    {
      label: 'Que cada uno se arregle',
      detail: 'No cuesta nada, pero muchos se sienten abandonados: baja la aprobación.',
      apply: (sim) => sim.nudgeApproval(-5),
    },
  ],
};

const SHOPPING: CityEvent = {
  id: 'shopping',
  title: 'Un shopping en el centro',
  text: 'Una cadena quiere levantar un shopping en el centro. Promete empleos y obras, pero los comerciantes de toda la vida ya juntan firmas en contra.',
  when: (sim) => sim.totals.pop > 4000 && lotsOf(sim.world, 'C') > 15,
  options: [
    {
      label: 'Aprobarlo',
      detail: 'Entran dos semanas de recaudación por el terreno y la ciudad suena a progreso, pero los comerciantes se enojan: baja un poco la aprobación.',
      apply: (sim) => {
        sim.state.cash += weeksOfIncome(sim, 2);
        sim.nudgeApproval(-3);
      },
    },
    {
      label: 'Frenarlo',
      detail: 'No entra nada y se pierden las obras que prometía, pero el comercio de barrio lo agradece: sube la aprobación.',
      apply: (sim) => sim.nudgeApproval(4),
    },
  ],
};

const ACTO: CityEvent = {
  id: 'acto-politico',
  title: 'Un acto en la plaza',
  text: 'Se acercan las elecciones y el partido te propone un acto grande en la plaza: choripán, bombos y banderas. Los candidatos de enfrente ya alquilaron el escenario.',
  when: (sim) => {
    const left = monthsToElection(sim.state.tick, sim.state.government);
    return left !== null && left <= 18 && sim.state.approval < 75 && sim.totals.pop > 1000 && sim.state.cash > 6000;
  },
  options: [
    {
      label: 'Hacer el acto',
      detail: 'Cuestan una semana y media de recaudación, en escenario y choripanes. Se llena la plaza y sube bastante la aprobación.',
      apply: (sim) => {
        sim.state.cash -= weeksOfIncome(sim, 1.5);
        sim.nudgeApproval(7);
      },
    },
    {
      label: 'Guardar la plata',
      detail: 'No se gasta nada, pero la oposición se queda con la plaza: baja un poco la aprobación.',
      apply: (sim) => sim.nudgeApproval(-3),
    },
  ],
};

const PANTALLA: CityEvent = {
  id: 'pantalla-gigante',
  title: 'Pantalla gigante en la plaza',
  text: 'La Selección juega un partido importante y los vecinos piden una pantalla gigante en la plaza para verlo juntos. Nadie quiere quedarse afuera.',
  when: (sim) => sim.totals.pop > 1000 && sim.state.cash > 5000,
  options: [
    {
      label: 'Instalar la pantalla',
      detail: 'Cuestan una semana y media de recaudación, en alquiler y sonido. La plaza explota con cada gol y sube la aprobación.',
      apply: (sim) => {
        sim.state.cash -= weeksOfIncome(sim, 1.5);
        sim.nudgeApproval(6);
      },
    },
    {
      label: 'Que lo vean en casa',
      detail: 'No se gasta nada, pero los que querían salir a gritar el gol se lo toman a mal: baja un poco la aprobación.',
      apply: (sim) => sim.nudgeApproval(-2),
    },
  ],
};

/** The catalogue, in no particular order: `pickEvent` rolls among the ones the city deserves. */

/** What a holiday costs and what it gives back. The big one is two and a half times the act. */
const FESTEJO = { grande: 2.5, acto: 1 } as const;

/**
 * A holiday as a case: three ways out, the two that pay and the one that only costs face. The big
 * one also stops the works for a month, which is the production the Intendente puts in.
 */
function holidayEvent(h: Holiday): CityEvent {
  return {
    id: `feriado-${h.month}`,
    kind: 'feriado',
    title: `${h.name} en el pueblo`,
    text: `Llega ${h.name} y el barrio espera ${h.what}. Como Intendente hay que decidir cuánto se pone, sabiendo que la caja no es la misma todos los meses.`,
    when: () => true,
    options: [
      {
        label: 'Festejarlo a lo grande',
        detail: 'Cuestan dos semanas y media de recaudación y un mes sin obra. La aprobación sube y el pueblo gasta dos meses.',
        apply: (sim) => {
          sim.state.cash -= weeksOfIncome(sim, FESTEJO.grande);
          sim.nudgeApproval(6);
          sim.effect(FIESTA, 2);
          sim.effect(FREEZE, 1);
        },
      },
      {
        label: 'Un acto en la plaza',
        detail: 'Cuesta una semana de recaudación. La aprobación sube un poco y el pueblo gasta un mes.',
        apply: (sim) => {
          sim.state.cash -= weeksOfIncome(sim, FESTEJO.acto);
          sim.nudgeApproval(3);
          sim.effect(FIESTA, 1);
        },
      },
      {
        label: 'Que pase nomás',
        detail: 'No se gasta nada, y el barrio lo nota: la aprobación baja.',
        apply: (sim) => sim.nudgeApproval(-5),
      },
    ],
  };
}

/** The six holidays as cases, in calendar order. */
export const HOLIDAY_EVENTS: readonly CityEvent[] = HOLIDAYS.map(holidayEvent);

/** The case of the holiday of `month`, or null when that month has none. */
export const holidayEventOf = (month: number): CityEvent | null => HOLIDAY_EVENTS.find((e) => e.id === `feriado-${month}`) ?? null;

export const EVENTS: readonly CityEvent[] = [
  PIQUETE,
  PROVINCIA,
  FABRICA,
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
  PARO_DOCENTE,
  PARO_COLECTIVOS,
  PARO_SALUD,
  BARRO,
  BROTE,
  GRANIZADA,
  SHOPPING,
  ACTO,
  PANTALLA,
];

export function eventById(id: string): CityEvent | undefined {
  return EVENTS.find((e) => e.id === id) ?? HOLIDAY_EVENTS.find((e) => e.id === id);
}

/**
 * The event that shows up this month, or null. Never two at once, never while a promise is being
 * watched (the city has enough to answer for), never in the first year, never sooner than
 * `EVENT.gap` after the last one, never one that is still cooling down, and never one of the last
 * `EVENT.cooldown` that showed up: it has to wait for that many others first. The roll comes from the
 * simulation's own seeded rng, so a saved game replays the same.
 */
/**
 * The case of this month: the holiday when the month has one, or whatever the roll brings. The roll
 * happens even on a holiday, because the growth loop shares the simulation's dice and skipping a
 * throw would reshuffle the whole city. A month that cannot have a case (a promise being watched, a
 * window still open, the first year) rolls nothing, exactly as before.
 */
export function eventOfMonth(sim: Simulation, rng: Rng): CityEvent | null {
  const rolled = pickEvent(sim, rng);
  const s = sim.state;
  if (s.tick < TICKS_PER_MONTH * EVENT.firstAt) return null;
  const { month, year } = dateOf(s.tick);
  return celebratedHolidayOf(year, month) ? holidayEventOf(month) : rolled;
}

export function pickEvent(sim: Simulation, rng: Rng): CityEvent | null {
  const s = sim.state;
  if (s.pendingEvent || s.commitment) return null;
  if (s.tick < TICKS_PER_MONTH * EVENT.firstAt) return null;
  if (s.tick - s.lastEvent < TICKS_PER_MONTH * EVENT.gap) return null;
  if (!rng.chance(EVENT.chance)) return null;
  const candidates = EVENTS.filter((e) => !s.recentEvents.includes(e.id) && !sim.hasEffect(coolOf(e.id)) && e.when(sim));
  return candidates.length > 0 ? rng.pick(candidates) : null;
}
