import { CAPACITY, PLANT_CAPACITY, ROAD_REACH } from '../config';
import { formatNumber } from '../core/format';
import { SEA_LEVEL } from '../world/terrain';
import { TILE, World, zoneOf, type ZoneKind } from '../world/world';
import { levelCap } from './demand';
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
    return { title: water ? 'Puente' : 'Calle', lines: [height, w.powered[i] ? 'Lleva luz' : 'Sin red eléctrica'] };
  }
  if (water) {
    if (tile === TILE.LINE) return { title: 'Tendido eléctrico sobre el agua', lines: [w.powered[i] ? 'Con energía' : 'Sin energía'] };
    return { title: 'Río', lines: ['Agua. Se puede cruzar con calles (puentes) o con tendido eléctrico.'] };
  }
  if (tile === TILE.PLANT) {
    const p = sim.power;
    return {
      title: 'Usina térmica',
      lines: [`Capacidad: ${PLANT_CAPACITY} MW`, `Red de la ciudad: ${formatNumber(p.use)} de ${formatNumber(p.capacity)} MW`, `Contaminación local: ${w.pollution[i]}/100`],
      hint: p.shortage ? 'La red no da abasto: construí otra usina conectada.' : undefined,
    };
  }
  if (tile === TILE.LINE) return { title: 'Tendido eléctrico', lines: [height, w.powered[i] ? 'Con energía' : 'Sin energía'] };
  if (tile === TILE.PARK) return { title: 'Plaza', lines: [height, `Valor del suelo: ${w.landValue[i]}/100`], hint: 'Las plazas suben el valor del suelo alrededor.' };

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
    lines.push(height);
    return { title, lines, hint: growthHint(w, sim, i, zone, level) };
  }

  lines.push(height, `Valor del suelo: ${w.landValue[i]}/100`, `Contaminación: ${w.pollution[i]}/100`);
  return { title: w.terrain.trees[i] ? 'Arboleda' : 'Terreno libre', lines };
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
  if (!w.powered[i]) return sim.world.plants.length === 0 ? 'Falta luz: construí una usina.' : 'Falta luz: conectala a la red con calles, zonas o tendido.';
  if (!w.roadAccess[i]) return 'Falta una calle cerca para que llegue la gente.';
  if (sim.state.crisis) return 'Con la caja en rojo no se construye nada.';
  if (sim.demand[zone] <= 0) {
    return zone === 'R' ? 'No hay demanda de viviendas: hacen falta trabajos (comercio o industria).' : 'No hay demanda: hace falta más población.';
  }
  const cap = levelCap(zone, w.landValue[i], sim.totals.pop);
  if (level >= cap && level < 4) {
    return zone === 'I' ? 'Para crecer más necesita una ciudad más grande.' : 'Para crecer más necesita más valor del suelo (plazas, agua, menos humo) o más población.';
  }
  return undefined;
}
