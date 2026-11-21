import {
  MAX_LEVEL,
  BUS,
  BUS_COLORS,
  CAPACITY,
  HUBS,
  HUB_LEVELS,
  COAST,
  COAST_APPROVAL,
  ANGER,
  COAST_FIELDS,
  DEFAULT_TAX,
  FIRE_SAFE_COVER,
  FISHING_SALES,
  GOVERNMENTS,
  LINE_TIERS,
  PARK,
  PLANTS,
  PORT_TAX_BOOST,
  POWER_REACH,
  ROAD_REACH,
  ROAD_TIERS,
  SERVICE_SIZE,
  SERVICES,
  TRAFFIC,
  UNIQUES,
  UNIQUE_LIMIT,
  WIND,
  CROPS,
  MARKET_THROUGHPUT,
  SILO_CAPACITY,
  UPKEEP,
  type CoastKind,
  type ServiceKind,
  type UniqueKind,
} from '../config';
import { formatNumber } from '../core/format';
import { isUnlocked } from './milestones';
import { buildingIssues, type Issue } from './warnings';
import { SEA_LEVEL } from '../world/terrain';
import { facilityAt } from '../world/hubs';
import { uniqueFootprint, uniqueWorks } from '../world/uniques';
import { busColorOf, busNumberOf, streetNear } from '../world/transport';
import { roadTierSeen } from '../world/roads';
import { serviceAnchorIndex } from '../world/services';
import { TILE, World, coastOf, hubOf, serviceOf, zoneOf, type Unique, type ZoneKind } from '../world/world';
import { serviceUpkeep } from './budget';
import { MONTHS, MONTH_NAMES, dateOf } from './calendar';
import { farmStateOf, priceOf } from './campo';
import { campoBroken, storedTons } from '../world/farms';
import { coastWorks, seasonOf, tourismFor, type Season } from './coast';
import { HUMBLE, SERVICE_NEED, TAX_DEMAND_POINTS, isHoldout, levelCap } from './demand';
import { residentsServed, utilization } from './fields';
import { plantCapacity } from './plants';
import { transitFactor } from './transit';
import type { Cause, Simulation } from './simulation';

const NAMES: Record<ZoneKind, string[]> = {
  R: ['Lote residencial vacío', 'Casa de chapa', 'Casita', 'Chalet', 'PH', 'Torre de departamentos'],
  C: ['Lote comercial vacío', 'Kiosco', 'Almacén de barrio', 'Local comercial', 'Galería comercial', 'Edificio de oficinas'],
  I: ['Lote industrial vacío', 'Tinglado', 'Taller', 'Galpón', 'Fábrica', 'Planta industrial'],
};

export function buildingName(zone: ZoneKind, level: number, variant: number): string {
  if (zone === 'R' && level === 3 && variant % 2 === 1) return 'Casa chorizo';
  if (zone === 'C' && level === 1 && variant % 2 === 1) return 'Verdulería';
  return NAMES[zone][level];
}

export const SERVICE_NAMES: Record<ServiceKind, string> = {
  school: 'Escuela',
  clinic: 'Salita',
  police: 'Comisaría',
  fire: 'Cuartel de bomberos voluntarios',
  hospital: 'Hospital',
  university: 'Universidad',
};

const SERVICE_ROLE: Record<ServiceKind, string> = {
  school: 'Sin escuela cerca no se levantan torres ni oficinas.',
  clinic: 'Sin salita cerca las casas no pasan de chalet.',
  police: 'Baja el delito de los barrios que cubre.',
  fire: 'Los incendios dentro de su radio se apagan a tiempo.',
  hospital: 'Sin hospital cerca las casas más altas no se levantan. También hace de salita.',
  university: 'Sin universidad cerca los comercios y las fábricas más altos no se levantan. También hace de escuela.',
};

/** Coverage of every service on a cell, as report lines. */
function coverageLines(w: World, i: number): string[] {
  return [`Educación: ${w.edu[i]}/100 · Salud: ${w.health[i]}/100`, `Delito: ${w.crime[i]}/100 · Bomberos: ${w.fireCover[i]}/100`];
}

export interface CellReport {
  title: string;
  lines: string[];
  /** What the player could do about this cell, if anything. */
  hint?: string;
  /** The problems the bubble over the building stands for, each with what it means. */
  issues?: { issue: Issue; text: string }[];
}

/** What each bubble means, with the numbers of the lot. */
function issueText(w: World, i: number, issue: Issue): string {
  if (issue === 'power') return 'Sin luz: el edificio no recibe electricidad, no funciona y no crece.';
  if (issue === 'road') return `Sin calle: no llega ningún camino hasta acá (hace falta una calle a ${ROAD_REACH} lotes o menos). Sin calle no vive ni trabaja nadie.`;
  if (issue === 'jam') return `Calle saturada (${w.jam[i]} % de su capacidad): el lote crece despacio y el suelo vale menos. Ensanchá la calle, mejorala o abrí otro camino.`;
  if (issue === 'school') return `Sin escuela cerca (educación ${w.edu[i]}/100): no se levantan torres ni oficinas por encima de este nivel. Hace falta una escuela con luz cerca.`;
  if (issue === 'empty') return 'Abandonado: nadie vive ni trabaja acá, no paga impuestos y baja el valor del suelo de alrededor.';
  if (issue === 'dry') return `Plaza descuidada (cuidado ${w.parkCare[i]}/100): se ve seca y baja el valor del suelo. Subí el presupuesto de espacios verdes.`;
  if (issue === 'crime') return `Mucho delito (${w.crime[i]}/100): los vecinos se van y baja el valor del suelo. Una comisaría con luz cerca lo baja.`;
  if (issue === 'health') return `No llega la salud (${w.health[i]}/100): las casas no pasan de chalet. Hace falta una salita con luz cerca.`;
  return `Mucho humo (${w.pollution[i]}/100): las casas pierden vecinos. Alejá las usinas y las fábricas de acá, o poné una plaza cerca para que lo limpie.`;
}

/** Everything the "Consulta" tool shows about a cell, and what the bubble over the building means when it has one. */
export function describeCell(w: World, sim: Simulation, x: number, y: number): CellReport {
  const report = describeBase(w, sim, x, y);
  const i = w.idx(x, y);
  const m = sim.state.milestone;
  const issues = buildingIssues(w, i, { health: isUnlocked('clinic', m), crime: isUnlocked('police', m), school: isUnlocked('school', m) });
  return issues.length ? { ...report, issues: issues.map((issue) => ({ issue, text: issueText(w, i, issue) })) } : report;
}

function describeBase(w: World, sim: Simulation, x: number, y: number): CellReport {
  const i = w.idx(x, y);
  const tile = w.tiles[i];
  const level = w.level[i];
  const [, max] = w.minMax(x, y);
  const water = w.isWater(x, y);
  const lines: string[] = [];
  const height = `Altura: ${Math.max(0, max - SEA_LEVEL) * 5} m sobre el río`;
  const zone = zoneOf(tile);

  if (tile === TILE.ROAD && w.route[i]) {
    return {
      title: 'Ruta provincial',
      lines: [
        'No se puede tocar: la topadora y las demás obras la respetan',
        'No cuesta nada: no paga mantenimiento',
        'Por acá llegan los vecinos nuevos',
        'La ruta y el lote de cada lado están a la misma altura',
      ],
    };
  }
  if (tile === TILE.ROAD) {
    // La calidad que se informa es la que se ve: la de la calzada más débil de la cuadra, que es la que el
    // mapa dibuja y la que el tránsito cuenta. Leer el dato de la celda suelta decía «Bulevar» sobre una
    // calzada que se veía de tierra (ver `world/roads.ts`).
    const tier = ROAD_TIERS[roadTierSeen(w, x, y)];
    return {
      title: water ? 'Puente' : 'Calle',
      lines: [height, `Calidad: ${tier.label}`, `Tránsito: ${w.traffic[i]} % de su capacidad`, w.powered[i] ? 'Con luz (la calle no lleva la luz)' : 'Sin luz (la calle no lleva la luz)'],
      hint:
        w.traffic[i] > 100
          ? 'Calle saturada: mejorá su calidad con pavimento reforzado o bulevar, poné otra calle pegada para hacerla avenida, o abrí otro camino entre las casas y el trabajo.'
          : undefined,
    };
  }
  if (water) {
    if (tile === TILE.LINE) return { title: `${LINE_TIERS[w.lineTier[i]].label} sobre el agua`, lines: [w.powered[i] ? 'Con energía' : 'Sin energía', `Alumbra hasta ${LINE_TIERS[w.lineTier[i]].reach} lotes a su alrededor`] };
    // A monument over the water (the puente) gets its own card before the river's.
    const over = tile === TILE.UNIQUE ? w.uniqueAt(x, y) : undefined;
    if (over) return describeUnique(w, over, sim);
    return { title: 'Río', lines: ['Agua. Se puede cruzar con calles (puentes) o con tendido eléctrico.'] };
  }
  // A monument on land (the obelisco, the calvario, the teatro, the estadio).
  const monument = tile === TILE.UNIQUE ? w.uniqueAt(x, y) : undefined;
  if (monument) return describeUnique(w, monument, sim);
  if (tile === TILE.PLANT) {
    const p = sim.power;
    const plant = w.plantAt(x, y);
    const kind = plant?.kind ?? 'coal';
    const capacity = plant ? plantCapacity(w, plant) : PLANTS[kind].capacity;
    return {
      title: PLANTS[kind].label,
      lines: [
        kind === 'wind' ? `Capacidad: ${capacity} MW de ${WIND.max} posibles (rinde más en lomas y cerca del agua)` : `Capacidad: ${capacity} MW`,
        `Mantenimiento: $${formatNumber(PLANTS[kind].upkeep)} por mes`,
        `Alumbra hasta ${POWER_REACH} lotes a su alrededor`,
        // Los MW se leen en el orden en que el jugador piensa: lo que se pide y lo que hay. Cuando falta,
        // el número del faltante es lo que explica los edificios a oscuras sin mandarlo a adivinar.
        p.shortage
          ? `Red de la ciudad: pide ${formatNumber(p.use)} MW y hay ${formatNumber(p.capacity)} · faltan ${formatNumber(Math.max(0, p.use - p.capacity))} MW`
          : `Red de la ciudad: ${formatNumber(p.use)} de ${formatNumber(p.capacity)} MW, alcanza`,
        `Contaminación local: ${w.pollution[i]}/100`,
      ],
      hint: p.shortage
        ? 'La red no da abasto: los edificios más lejanos de la usina se quedan sin luz. Construí otra usina conectada o subí el presupuesto de usinas.'
        : undefined,
    };
  }
  if (tile === TILE.LINE) return { title: LINE_TIERS[w.lineTier[i]].label, lines: [height, w.powered[i] ? 'Con energía' : 'Sin energía', `Alumbra hasta ${LINE_TIERS[w.lineTier[i]].reach} lotes a su alrededor`, `Mantenimiento: $${formatNumber(LINE_TIERS[w.lineTier[i]].upkeep)} por mes`] };
  const service = serviceOf(tile);
  if (service) {
    const info = SERVICES[service];
    // The building, not the lot: every lot of a hospital reports the hospital, from its anchor.
    const at = serviceAnchorIndex(w, i);
    const lots = SERVICE_SIZE[service] > 1 ? [`Ocupa ${SERVICE_SIZE[service]}×${SERVICE_SIZE[service]} lotes`] : [];
    return {
      title: SERVICE_NAMES[service],
      lines: [
        w.powered[at] ? 'Con luz' : 'Sin luz: no atiende a nadie',
        `Radio: ${info.radius} lotes`,
        `Atiende a ${formatNumber(w.powered[at] ? residentsServed(w, at, service) : 0)} de ${formatNumber(info.capacity)} vecinos`,
        `Mantenimiento: $${formatNumber(Math.round((serviceUpkeep(service, utilization(w, at, service)) * sim.state.funding[service]) / 100))} por mes`,
        ...lots,
        SERVICE_ROLE[service],
      ],
      hint: w.powered[at] ? undefined : noLightHint(sim, at, 'la'),
    };
  }
  const hubKind = hubOf(tile);
  if (hubKind) {
    const facility = facilityAt(w, x, y);
    const info = HUBS[hubKind];
    const level = facility?.level ?? 1;
    const pieces = facility?.pieces.length ?? 1;
    const needed = level < 3 ? HUB_LEVELS[hubKind][level] - pieces : 0;
    const works = facility?.works ?? false;
    const why = !streetNear(w, x, y) ? `sin calle a ${ROAD_REACH} lotes o menos` : facility && !facility.lit ? 'sin electricidad: no le llega luz o la red no alcanza' : 'ya no toca el agua';
    const lines = [
      height,
      `${pieces} pieza${pieces === 1 ? '' : 's'} pegada${pieces === 1 ? '' : 's'}`,
      works ? `Da ${info.jobs[level - 1]} empleos comerciales y entran $${formatNumber(info.income[level - 1])} por mes` : `No funciona: ${why}`,
      `Consume ${formatNumber(info.power[level - 1])} MW de electricidad`,
      `Mantenimiento: $${formatNumber(info.upkeep * pieces)} por mes`,
    ];
    if (info.noiseRadius > 0) lines.push(`Ruido: baja el valor del suelo hasta ${info.noiseRadius} lotes a la redonda`);
    return {
      title: info.names[level - 1],
      lines,
      hint: needed > 0 ? `Pegá ${needed} pieza${needed === 1 ? '' : 's'} más y pasa a ser ${info.names[level]}.` : undefined,
    };
  }
  if (tile === TILE.BUS) {
    const works = streetNear(w, x, y);
    const color = BUS_COLORS[busColorOf(w.busLine[i])].name.toLowerCase();
    return {
      title: `Línea ${busNumberOf(w.busLine[i])} (${color})`,
      lines: [
        height,
        `Cubre ${BUS.radius} lotes a la redonda`,
        `Sus colectivos se llevan ${formatNumber(Math.round(BUS.trips * transitFactor(sim.state.transport)))} viajeros de las calles de su área, repartidos según lo que carga cada una; dos líneas se llevan el doble, pero una avenida muy cargada sigue cargada`,
        `Presupuesto de transporte: ${sim.state.transport} %${sim.state.transport < 100 ? ' (pasan menos colectivos)' : sim.state.transport > 100 ? ' (pasan más colectivos)' : ''}`,
        `Mantenimiento: $${formatNumber(Math.round(BUS.upkeep * transitFactor(sim.state.transport)))} por mes`,
        works ? 'Con calle cerca: los colectivos andan' : `Sin calle a ${ROAD_REACH} lotes o menos: no funciona`,
      ],
      hint: works ? undefined : 'Sin una calle cerca no sale ningún colectivo: trazá una calle al lado de la cochera.',
    };
  }
  const coast = coastOf(tile);
  if (coast) return describeCoast(w, sim, i, coast);
  if (tile === TILE.FARM) return describeFarm(w, sim);
  if (tile === TILE.SILO) return describeSilo(w, x, y);
  if (tile === TILE.MARKET) return describeMarket(w, sim);
  if (tile === TILE.PARK) {
    const area = w.parkArea[i];
    const care = w.parkCare[i];
    const lines = [height, `Mancha de plaza: ${formatNumber(area)} celda${area === 1 ? '' : 's'}`, `Valor del suelo: ${w.landValue[i]}/100`];
    if (area >= PARK.minArea) lines.push(`Mantenimiento: ${care} % (${care >= PARK.care ? 'la Provincia la cuida' : 'descuidada'})`);
    return {
      title: 'Plaza',
      lines,
      hint:
        area < PARK.minArea
          ? `Una plaza de ${formatNumber(area)} celda${area === 1 ? '' : 's'} no alcanza: recién desde ${PARK.minArea} celdas sube el valor del suelo alrededor.`
          : care >= PARK.care
            ? 'Las plazas suben el valor del suelo alrededor, y cuanto más grande es la mancha, más lejos llega.'
            : `Descuidada: baja el valor del suelo alrededor. Subí el presupuesto de espacios verdes (hoy al ${care} %).`,
    };
  }

  if (zone && level > 0 && w.fire[i]) {
    return {
      title: `${buildingName(zone, level, w.variant[i])} en llamas`,
      lines: [`Bomberos: ${w.fireCover[i]}/100`],
      hint:
        w.fireCover[i] >= FIRE_SAFE_COVER
          ? 'Los bomberos voluntarios ya están trabajando.'
          : 'No hay bomberos cerca: se va a quemar entero y puede pasar a los vecinos. Construí un cuartel de bomberos.',
    };
  }

  if (zone && level > 0 && w.abandoned[i]) {
    lines.push('Nadie vive ni trabaja acá: no paga impuestos y baja el valor del suelo de alrededor');
    lines.push(w.powered[i] ? 'Con luz' : 'Sin luz');
    lines.push(w.roadAccess[i] ? 'Tiene calle cerca' : `Sin calle a menos de ${ROAD_REACH} lotes`);
    lines.push(`Delito: ${w.crime[i]}/100`, `Contaminación: ${w.pollution[i]}/100`);
    return { title: `${buildingName(zone, level, w.variant[i])} abandonado`, lines, hint: abandonHint(w, sim, i, zone) };
  }

  if (zone) {
    const title = buildingName(zone, level, w.variant[i]);
    if (level > 0) {
      const amount = CAPACITY[zone][level];
      lines.push(zone === 'R' ? `${amount} vecinos` : `${amount} puestos de trabajo`);
    }
    lines.push(w.powered[i] ? 'Con luz' : 'Sin luz');
    lines.push(w.roadAccess[i] ? 'Tiene calle cerca' : `Sin calle a menos de ${ROAD_REACH} lotes`);
    lines.push(`Valor del suelo: ${w.landValue[i]}/100`);
    lines.push(`Contaminación: ${w.pollution[i]}/100`);
    lines.push(...coverageLines(w, i));
    lines.push(height);
    // The neighbours' patience, in the same months the simulation runs: what the player needs to know
    // is how long the building has left, not a hidden dice roll.
    const { rise, worst } = sim.unrest(i, zone);
    if (w.anger[i] > 0 || rise > 0) {
      const months = rise > 0 ? Math.ceil((100 - w.anger[i]) / Math.min(ANGER.cap, rise)) : 0;
      lines.push(`Enojo del barrio: ${w.anger[i]} %${rise > 0 ? ` · se vacía en ~${months} meses` : ' · bajando'}`);
    }
    const holdout = level === HUMBLE && isHoldout(w.variant[i]) ? 'Su dueño no piensa mejorarla: solo cambia si la demolés.' : undefined;
    const advice = w.anger[i] >= ANGER_WARN && worst ? VACANCY_ADVICE[worst] : undefined;
    return { title, lines, hint: holdout ?? advice ?? growthHint(w, sim, i, zone, level) };
  }

  lines.push(height, `Valor del suelo: ${w.landValue[i]}/100`, `Contaminación: ${w.pollution[i]}/100`);
  return { title: w.terrain.trees[i] ? 'Arboleda' : 'Terreno libre', lines };
}

/** The card of a unique building: what it adds to the tourism of the city and what it asks for. */
/** What the monument does, in one line: the shared five add tourism, the government ones their own measure. */
function uniqueEffect(kind: UniqueKind): string {
  const info = UNIQUES[kind];
  const share = Math.round(info.boost * 100);
  const peak = Math.round(info.peak * 100);
  if (info.approval) return `Suma ${info.approval.perMonth} puntos de aprobación por mes, y ${info.approval.peak} en ${info.peakMonths.map((m) => MONTHS[m - 1]).join(', ')}`;
  if (info.crime) return `Baja el delito de los lotes a ${info.crime.radius} lotes o menos`;
  if (info.edu) return `Da educación a los lotes a ${info.edu.radius} lotes o menos, como una escuela`;
  if (info.favor) return `Suma ${info.favor.perMonth} puntos de favor por mes, y ${info.favor.peak} en ${info.peakMonths.map((m) => MONTHS[m - 1]).join(', ')}`;
  if (info.jobs) return `Suma turismo en proporción a los puestos de trabajo industriales, hasta ${Math.round(info.jobs.max * 100)} %`;
  return info.peakMonths.length ? `Suma ${share} % al turismo, y ${peak} % en ${info.peakMonths.map((m) => MONTHS[m - 1]).join(', ')}` : `Suma ${share} % al turismo de la ciudad`;
}

function describeUnique(w: World, u: Unique, sim: Simulation): CellReport {
  const info = UNIQUES[u.kind];
  const upkeep = `Mantenimiento: $${formatNumber(info.upkeep)} por mes`;
  const size = `${info.w}×${info.h} lotes · uno de cada uno, y ${UNIQUE_LIMIT} en total`;
  const owner = info.government ? `El único de ${GOVERNMENTS[info.government].label.toLowerCase()}` : 'Lo puede construir cualquier gobierno';
  if (!uniqueWorks(w, u)) {
    const noStreet = !uniqueFootprint(u.kind, w.n, u.x, u.y).some(([x, y]) => streetNear(w, x, y));
    return {
      title: info.label,
      lines: [noStreet ? `Sin calle a menos de ${ROAD_REACH} lotes: no lo visita nadie` : 'Sin luz: no funciona', size, upkeep],
      hint: noStreet ? 'Un edificio único sólo rinde si una calle llega hasta él: trazá una calle cerca.' : noLightHint(sim, w.idx(u.x, u.y), 'lo'),
    };
  }
  return { title: info.label, lines: [uniqueEffect(u.kind), owner, size, upkeep] };
}

const SEASON_NAMES: Record<Season, string> = { peak: 'Temporada alta (verano)', shoulder: 'Entretemporada', low: 'Temporada baja' };

/** The card of a building of the coast: what it does, whether it works and, if not, why. */
function describeCoast(w: World, sim: Simulation, i: number, kind: CoastKind): CellReport {
  const info = COAST[kind];
  const upkeep = `Mantenimiento: $${formatNumber(info.upkeep)} por mes`;
  const works = coastWorks(w, i);
  if (!works) {
    // Every building of the coast needs a street near and light: it says which of the two is missing.
    const noStreet = !w.roadAccess[i];
    return {
      title: info.label,
      lines: [noStreet ? 'Sin calle cerca: no funciona' : 'Sin luz: no funciona', upkeep],
      hint: noStreet ? `Sin una calle a menos de ${ROAD_REACH} lotes no da trabajo ni rinde nada. Trazá una calle que llegue hasta acá.` : noLightHint(sim, i, 'la'),
    };
  }
  const lines: string[] = [];
  switch (kind) {
    case 'fishing':
      lines.push(`Funcionando: ${info.jobs} puestos de trabajo industriales`, `Ventas de pescado: $${formatNumber(FISHING_SALES)} por mes`);
      break;
    case 'port':
      lines.push(
        `Funcionando: ${info.jobs} puestos de trabajo industriales`,
        `Los impuestos industriales rinden un ${Math.round(PORT_TAX_BOOST.perPort * 100)} % más por puerto, hasta ${Math.round(PORT_TAX_BOOST.max * 100)} %`,
        `Contaminación local: ${w.pollution[i]}/100`,
      );
      break;
    case 'resort': {
      const month = dateOf(sim.state.tick).month;
      lines.push(`Funcionando: ${info.jobs} puestos de trabajo comerciales`, `${SEASON_NAMES[seasonOf(month)]}: turismo de $${formatNumber(tourismFor(month))} por mes`);
      break;
    }
    case 'promenade':
      lines.push(
        `Valor del suelo: ${w.landValue[i]}/100`,
        `Sube el valor del suelo hasta ${COAST_FIELDS.promenadeValue.radius} lotes a la redonda`,
        `Suma a la aprobación: 1 punto cada ${COAST_APPROVAL.promenadeLots} lotes de costanera, hasta ${COAST_APPROVAL.promenadeMax}`,
      );
      break;
    case 'lighthouse':
      lines.push(`Suma ${COAST_APPROVAL.lighthouse} puntos a la aprobación de los vecinos`, `Sube el valor del suelo hasta ${COAST_FIELDS.lighthouseValue.radius} lotes a la redonda`);
      break;
  }
  lines.push(upkeep);
  return { title: info.label, lines };
}

/**
 * Qué hacer con una celda sin luz. Son tres causas distintas y el jugador necesita saber cuál le tocó:
 * que no haya usina, que el tendido no llegue hasta acá, o que la red exista pero no dé abasto. La bandera
 * `shortage` es de toda la ciudad —con una red corta en cualquier lado marcaba todas las celdas— así que
 * la causa se lee de `powerNet` / `powerShort`, que son por celda.
 */
function noLightHint(sim: Simulation, i: number, pronoun: 'lo' | 'la'): string {
  const w = sim.world;
  if (w.plants.length === 0) return 'No hay ninguna usina: construí una.';
  if (!w.powerNet[i] || !w.powerShort[i]) {
    // Fuera de toda red, o en una red con capacidad de sobra: lo que falta es el tendido, no la corriente.
    // El estado ya lo dice la lista de la tarjeta («Sin luz»), así que acá va la causa y la salida.
    return `No le llega el tendido: acerca${pronoun} a la usina o a otro edificio con luz (alcance de ${POWER_REACH} lotes), o tendé un tendido eléctrico.`;
  }
  const { use, capacity } = sim.power;
  const falta = Math.max(0, use - capacity);
  return `La red no da abasto: la ciudad pide ${formatNumber(use)} MW y hay ${formatNumber(capacity)} · faltan ${formatNumber(falta)} MW. Hace falta otra usina conectada.`;
}

const ZONE_TAX_NAME: Record<ZoneKind, string> = { R: 'residencial', C: 'comercial', I: 'industrial' };

function abandonHint(w: World, sim: Simulation, i: number, zone: ZoneKind): string {
  const why: string[] = [];
  if (!w.powered[i]) why.push('falta luz');
  if (!w.roadAccess[i]) why.push('falta una calle cerca');
  if (sim.state.crisis) why.push('la caja está en rojo');
  if (w.crime[i] > 60) why.push('hay mucho delito');
  if (zone === 'R' && w.pollution[i] > 70) why.push('hay mucho humo');
  if (sim.demand[zone] <= 0) why.push('no hay demanda');
  const cause = why.length ? `Se vació porque ${why.join(', ')}.` : 'Las condiciones ya mejoraron: de a poco puede volver a ocuparse.';
  return `${cause} Arreglalo para que vuelvan, o demolelo.`;
}

/** From this much anger the card stops giving growth advice and says what is emptying the lot. */
const ANGER_WARN = 30;

/** What to do about the complaint that is wearing the neighbours down the most. */
const VACANCY_ADVICE: Record<Cause, string> = {
  power: 'Sin luz no hay casa que aguante: que la luz llegue acá antes de que se vacíe.',
  road: 'Sin una calle cerca no llega nadie, y los que están se van: trazá una calle hasta acá.',
  crisis: 'Con la caja en rojo la paciencia del barrio se gasta rápido: equilibrá el presupuesto o se van.',
  crime: 'El delito le está gastando la paciencia: sumá comisarías cerca.',
  smoke: 'El humo de las fábricas les está gastando la paciencia: alejalas o poné una plaza al lado, que limpia el aire.',
  jam: 'La calle de acceso está saturada y los vecinos se cansan: ensanchala u abrí otro camino.',
  vacant: 'Los edificios vacíos de al lado se llevan puestos a los que están ocupados: demolé los que quedaron vacíos.',
};

function growthHint(w: World, sim: Simulation, i: number, zone: ZoneKind, level: number): string | undefined {
  if (!w.powered[i]) return noLightHint(sim, i, 'lo');
  if (!w.roadAccess[i]) return 'Falta una calle cerca para que llegue la gente.';
  if (sim.state.crisis) return 'Con la caja en rojo no se construye nada.';
  if (w.jam[i] > TRAFFIC.slowFrom + 30) return 'La calle de acceso está saturada y el lote crece despacio: ensanchala o abrí otro camino.';
  if (sim.demand[zone] <= 0) {
    // Say what really holds the city back before sending the lot to wait for the other zones.
    const stalled = sim.stallText();
    if (stalled) return stalled;
    const tax = sim.state.taxes[zone];
    if (tax > DEFAULT_TAX && sim.demand[zone] + (tax - DEFAULT_TAX) * TAX_DEMAND_POINTS > 0) {
      return `El impuesto ${ZONE_TAX_NAME[zone]} está en ${tax} %: bajalo en el Presupuesto para que vuelva la demanda.`;
    }
    return zone === 'R' ? 'No hay demanda de viviendas: hacen falta trabajos (comercio o industria).' : 'No hay demanda: hace falta más población.';
  }
  const services = { edu: w.edu[i], health: w.health[i], hospital: w.hospital[i], university: w.university[i], educated: sim.schooled };
  const cap = levelCap(zone, w.landValue[i], sim.totals.pop, services);
  if (level >= cap && level < MAX_LEVEL) {
    if (levelCap(zone, w.landValue[i], sim.totals.pop) > cap) {
      if (zone === 'R' && cap < 4 && w.health[i] < SERVICE_NEED) return 'Para pasar de chalet necesita una salita cerca (con luz).';
      if (zone === 'R' && w.hospital[i] < SERVICE_NEED && w.edu[i] >= SERVICE_NEED) return 'Para llegar al máximo necesita un hospital cerca (con luz).';
      // A shop is not asking for a school next door: it is asking for a city with schools in it.
      if (zone === 'C' && sim.schooled < SERVICE_NEED) {
        return `El comercio crece con gente educada, y sólo el ${Math.round(sim.schooled)} % de los vecinos tiene escuela cerca: hay que llevar la escuela a los barrios.`;
      }
      if (zone !== 'R' && w.university[i] < SERVICE_NEED) return 'Para llegar al máximo necesita una universidad cerca (con luz).';
      if (zone === 'R') return 'Para crecer más necesita una escuela cerca (con luz).';
    }
    return zone === 'I' ? 'Para crecer más necesita una ciudad más grande.' : 'Para crecer más necesita más valor del suelo (plazas, agua, menos humo) o más población.';
  }
  return undefined;
}

/** El nombre que el jugador lee para cada estado del lote; el mismo idioma que usa el dibujo. */
const FARM_STATE_TEXT: Record<string, string> = {
  arado: 'recién arado, sembrado este mes',
  crecido: 'con el trigo en pie',
  rastrojo: 'con el rastrojo de la cosecha pasada',
};

/**
 * La ficha del lote de trigo.
 *
 * Dice lo que el jugador necesita para decidir si le sirve: cuánto rinde al año, cuándo, en qué anda hoy, y
 * —lo más importante— si la cadena está cortada. Sin esto el lote se anunciaba como «Terreno libre», que es
 * la peor clase de mentira: la que hace dudar de si la pieza está puesta.
 */
function describeFarm(w: World, sim: Simulation): { title: string; lines: string[]; hint?: string } {
  const month = dateOf(sim.state.tick).month;
  const crop = CROPS.trigo;
  const roto = campoBroken(w);
  return {
    title: `Lote de ${crop.label.toLowerCase()}`,
    lines: [
      `Rinde ${crop.tons} toneladas por año`,
      `Se siembra en ${MONTH_NAMES[crop.sow - 1]} y se cosecha en ${MONTH_NAMES[crop.harvest - 1]}`,
      `Hoy está ${FARM_STATE_TEXT[farmStateOf(month)]}`,
      'No necesita luz, agua ni calle: lo que cuesta es la cadena',
      'No paga mantenimiento',
    ],
    hint:
      roto === 'silo'
        ? 'Sin un silo, cada cosecha se pierde en el lote: construí uno antes de diciembre.'
        : roto === 'feria'
          ? 'Sin una feria el trigo no se convierte en plata: el silo se llena y la cosecha siguiente no entra.'
          : undefined,
  };
}

/** La ficha del silo: lo que tiene, lo que le entra y lo que cuesta. */
function describeSilo(w: World, x: number, y: number): { title: string; lines: string[]; hint?: string } {
  const silo = w.siloAt(x, y);
  const tons = Math.round(Math.max(0, silo?.tons ?? 0));
  const lleno = tons >= SILO_CAPACITY;
  return {
    title: 'Silo de chapa',
    lines: [
      `Guarda ${formatNumber(tons)} de ${formatNumber(SILO_CAPACITY)} toneladas`,
      `Guarda en total la ciudad: ${formatNumber(storedTons(w))} toneladas en ${w.silos.length} silo${w.silos.length === 1 ? '' : 's'}`,
      `Mantenimiento: $${formatNumber(UPKEEP.silo)} por mes`,
      'El trigo guardado se estropea: la merma se lleva el 4 % por mes',
    ],
    hint: lleno
      ? 'Está lleno: la próxima cosecha que no entre se pierde en el lote. Hacé otro silo o vendé antes de diciembre.'
      : w.markets.length === 0
        ? 'Sin feria no hay quien compre: el trigo se queda acá y la merma se lo come.'
        : undefined,
  };
}

/** La ficha de la feria: el precio del mes, lo que puede vender y lo que cuesta. */
function describeMarket(w: World, sim: Simulation): { title: string; lines: string[]; hint?: string } {
  const month = dateOf(sim.state.tick).month;
  const price = priceOf(month, w.farmPressure);
  return {
    title: 'Feria de concentración',
    lines: [
      `Vende hasta ${formatNumber(MARKET_THROUGHPUT)} toneladas por mes`,
      `El trigo paga $${formatNumber(price)} la tonelada en ${MONTH_NAMES[month - 1]}`,
      `Tiene ${formatNumber(storedTons(w))} toneladas para vender`,
      `Mantenimiento: $${formatNumber(UPKEEP.market)} por mes`,
      'El precio se mueve con la estación y con lo que la ciudad vuelque al mercado',
    ],
    hint:
      w.silos.length === 0
        ? 'No hay ningún silo: sin dónde guardar, no llega trigo a la feria.'
        : storedTons(w) === 0
          ? 'No hay trigo guardado: esperá la cosecha de diciembre o construí más lotes.'
          : undefined,
  };
}
