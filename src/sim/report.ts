import { CAPACITY, FIRE_SAFE_COVER, PLANTS, POWER_REACH, ROAD_REACH, SERVICES, WIND, type ServiceKind } from '../config';
import { formatNumber } from '../core/format';
import { SEA_LEVEL } from '../world/terrain';
import { TILE, World, serviceOf, zoneOf, type ZoneKind } from '../world/world';
import { serviceUpkeep } from './budget';
import { SERVICE_NEED, levelCap } from './demand';
import { residentsServed, utilization } from './fields';
import { plantCapacity } from './plants';
import type { Simulation } from './simulation';

const NAMES: Record<ZoneKind, string[]> = {
  R: ['Lote residencial vacío', 'Casita', 'Chalet', 'PH', 'Torre de departamentos'],
  C: ['Lote comercial vacío', 'Kiosco', 'Almacén de barrio', 'Galería comercial', 'Edificio de oficinas'],
  I: ['Lote industrial vacío', 'Taller', 'Galpón', 'Fábrica', 'Planta industrial'],
};

export function buildingName(zone: ZoneKind, level: number, variant: number): string {
  if (zone === 'R' && level === 2 && variant % 2 === 1) return 'Casa chorizo';
  return NAMES[zone][level];
}

export const SERVICE_NAMES: Record<ServiceKind, string> = {
  school: 'Escuela',
  clinic: 'Salita',
  police: 'Comisaría',
  fire: 'Cuartel de bomberos voluntarios',
};

const SERVICE_ROLE: Record<ServiceKind, string> = {
  school: 'Sin escuela cerca no se levantan torres ni oficinas.',
  clinic: 'Sin salita cerca las casas no pasan de chalet.',
  police: 'Baja el delito de los barrios que cubre.',
  fire: 'Los incendios dentro de su radio se apagan a tiempo.',
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
}

/** Everything the "Consulta" tool shows about a cell. */
export function describeCell(w: World, sim: Simulation, x: number, y: number): CellReport {
  const i = w.idx(x, y);
  const tile = w.tiles[i];
  const level = w.level[i];
  const [, max] = w.minMax(x, y);
  const water = w.isWater(x, y);
  const lines: string[] = [];
  const height = `Altura: ${Math.max(0, max - SEA_LEVEL) * 5} m sobre el río`;
  const zone = zoneOf(tile);

  if (tile === TILE.ROAD) {
    return { title: water ? 'Puente' : 'Calle', lines: [height, w.powered[i] ? 'Con luz (la calle no lleva la luz)' : 'Sin luz (la calle no lleva la luz)'] };
  }
  if (water) {
    if (tile === TILE.LINE) return { title: 'Tendido eléctrico sobre el agua', lines: [w.powered[i] ? 'Con energía' : 'Sin energía', 'Lleva la luz de celda en celda'] };
    return { title: 'Río', lines: ['Agua. Se puede cruzar con calles (puentes) o con tendido eléctrico.'] };
  }
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
        `Alumbra hasta ${POWER_REACH} lotes a su alrededor`, `Red de la ciudad: ${formatNumber(p.use)} de ${formatNumber(p.capacity)} MW`, `Contaminación local: ${w.pollution[i]}/100`,
      ],
      hint: p.shortage ? 'La red no da abasto: construí otra usina conectada.' : undefined,
    };
  }
  if (tile === TILE.LINE) return { title: 'Tendido eléctrico', lines: [height, w.powered[i] ? 'Con energía' : 'Sin energía', 'Lleva la luz de celda en celda'] };
  const service = serviceOf(tile);
  if (service) {
    const info = SERVICES[service];
    return {
      title: SERVICE_NAMES[service],
      lines: [
        w.powered[i] ? 'Con luz' : 'Sin luz: no atiende a nadie',
        `Radio: ${info.radius} lotes`,
        `Atiende a ${formatNumber(w.powered[i] ? residentsServed(w, i, service) : 0)} de ${formatNumber(info.capacity)} vecinos`,
        `Mantenimiento: $${formatNumber(Math.round((serviceUpkeep(service, utilization(w, i, service)) * sim.state.funding[service]) / 100))} por mes`,
        SERVICE_ROLE[service],
      ],
      hint: w.powered[i] ? undefined : noLightHint(sim, 'Necesita luz', 'la'),
    };
  }
  if (tile === TILE.PARK) return { title: 'Plaza', lines: [height, `Valor del suelo: ${w.landValue[i]}/100`], hint: 'Las plazas suben el valor del suelo alrededor.' };

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
    lines.push('Nadie vive ni trabaja acá: no paga tasas y baja el valor del suelo de alrededor');
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
    return { title, lines, hint: growthHint(w, sim, i, zone, level) };
  }

  lines.push(height, `Valor del suelo: ${w.landValue[i]}/100`, `Contaminación: ${w.pollution[i]}/100`);
  return { title: w.terrain.trees[i] ? 'Arboleda' : 'Terreno libre', lines };
}

/** What to do about a cell with no light: it must be within the reach of the plant or of a lit building, or get a power line. */
function noLightHint(sim: Simulation, lead: string, pronoun: 'lo' | 'la'): string {
  if (sim.world.plants.length === 0) return `${lead}: construí una usina.`;
  const near = `acerca${pronoun} a la usina o a un edificio con luz (alcance de ${POWER_REACH} lotes), o tendé un tendido eléctrico`;
  return sim.power.shortage ? `${lead}: ${near}; o la usina no da abasto, y hace falta otra.` : `${lead}: ${near}.`;
}

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

function growthHint(w: World, sim: Simulation, i: number, zone: ZoneKind, level: number): string | undefined {
  if (!w.powered[i]) return noLightHint(sim, 'Sin luz', 'lo');
  if (!w.roadAccess[i]) return 'Falta una calle cerca para que llegue la gente.';
  if (sim.state.crisis) return 'Con la caja en rojo no se construye nada.';
  if (sim.demand[zone] <= 0) {
    return zone === 'R' ? 'No hay demanda de viviendas: hacen falta trabajos (comercio o industria).' : 'No hay demanda: hace falta más población.';
  }
  const cap = levelCap(zone, w.landValue[i], sim.totals.pop, { edu: w.edu[i], health: w.health[i] });
  if (level >= cap && level < 4) {
    if (levelCap(zone, w.landValue[i], sim.totals.pop) > cap) {
      if (zone === 'R' && cap < 3 && w.health[i] < SERVICE_NEED) return 'Para pasar de chalet necesita una salita cerca (con luz).';
      return 'Para crecer más necesita una escuela cerca (con luz).';
    }
    return zone === 'I' ? 'Para crecer más necesita una ciudad más grande.' : 'Para crecer más necesita más valor del suelo (plazas, agua, menos humo) o más población.';
  }
  return undefined;
}
