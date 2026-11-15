import { fromBase64, toBase64 } from '../save/save';
import { MAX_HEIGHT, type Terrain } from './terrain';
import { applyPlan, planTool, type Cell } from './tools';
import { World } from './world';

/**
 * Maps made from real places (elevation and OpenStreetMap), baked ahead of time by
 * `npm run bake-maps` into `public/maps/<id>.json` and loaded when the player picks one.
 */
export const PRESET_VERSION = 1;

export interface PresetInfo {
  id: string;
  name: string;
  /** One line for the start screen. */
  blurb: string;
}

export const PRESETS: readonly PresetInfo[] = [
  { id: 'mar-del-plata', name: 'Mar del Plata', blurb: 'El centro, la Perla y la costa hasta el puerto.' },
  { id: 'buenos-aires', name: 'Buenos Aires', blurb: 'El centro y el puerto, frente al Río de la Plata.' },
  { id: 'rosario', name: 'Rosario', blurb: 'La barranca sobre el Paraná y el centro de la ciudad.' },
  { id: 'cordoba', name: 'Córdoba', blurb: 'El centro y el río Suquía que cruza la ciudad.' },
  { id: 'mendoza', name: 'Mendoza', blurb: 'La ciudad al pie de la precordillera, en pendiente.' },
  { id: 'bariloche', name: 'Bariloche', blurb: 'La costa del Nahuel Huapi, con la montaña detrás.' },
  { id: 'ushuaia', name: 'Ushuaia', blurb: 'La bahía sobre el canal Beagle, con los cerros atrás.' },
  { id: 'tandil', name: 'Tandil', blurb: 'El centro con sus cuatro avenidas, el dique del Fuerte y las sierras.' },
];

export interface MapPreset {
  id: string;
  name: string;
  n: number;
  /** Size of a cell on the ground, in metres. */
  cellMeters: number;
  corners: Uint8Array;
  trees: Uint8Array;
  /** 1 where the real map has a street. */
  roads: Uint8Array;
  attribution: string;
}

export function encodePreset(p: MapPreset): string {
  return JSON.stringify({
    version: PRESET_VERSION,
    id: p.id,
    name: p.name,
    n: p.n,
    cellMeters: p.cellMeters,
    attribution: p.attribution,
    corners: toBase64(p.corners),
    trees: toBase64(p.trees),
    roads: toBase64(p.roads),
  });
}

export function decodePreset(text: string): MapPreset {
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(text);
  } catch {
    throw new Error('El mapa no se pudo leer');
  }
  if (!d || typeof d !== 'object') throw new Error('El mapa no se pudo leer');
  if (d.version !== PRESET_VERSION) throw new Error('El mapa es de otra versión del juego');
  const n = d.n;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 8 || n > 512 || n % 8 !== 0) throw new Error('El mapa tiene un tamaño imposible');
  for (const k of ['id', 'name', 'attribution'] as const) if (typeof d[k] !== 'string') throw new Error('Al mapa le faltan datos');
  const where = 'el mapa';
  return {
    id: d.id as string,
    name: d.name as string,
    n,
    cellMeters: typeof d.cellMeters === 'number' ? d.cellMeters : 0,
    attribution: d.attribution as string,
    corners: fromBase64(d.corners, (n + 1) ** 2, MAX_HEIGHT, 'El terreno', where),
    trees: fromBase64(d.trees, n * n, 4, 'La arboleda', where),
    roads: fromBase64(d.roads, n * n, 1, 'Las calles', where),
  };
}

/** A new world on the preset's land; with `withStreets`, its real streets are already built. */
export function worldFromPreset(p: MapPreset, withStreets: boolean): World {
  const terrain: Terrain = { n: p.n, corners: p.corners.slice(), trees: p.trees.slice() };
  const w = new World(terrain);
  if (withStreets) {
    const cells: Cell[] = [];
    for (let i = 0; i < p.roads.length; i++) if (p.roads[i]) cells.push([i % p.n, Math.floor(i / p.n)]);
    const plan = planTool(w, 'road', cells);
    applyPlan(w, plan);
    for (const [x, y] of plan.cells) w.inherited[w.idx(x, y)] = 1;
  }
  return w;
}

export async function loadPreset(id: string): Promise<MapPreset> {
  const res = await fetch(`maps/${id}.json`);
  if (!res.ok) throw new Error('No se pudo cargar el mapa');
  return decodePreset(await res.text());
}
