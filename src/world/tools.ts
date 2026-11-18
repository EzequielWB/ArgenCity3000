import { ALL_UNIQUE_KINDS, ASPHALT, BUS, COAST, COSTS, DIRT, GOVERNMENT_UNIQUES, GOVERNMENT_UNIQUE_KINDS, GOVERNMENTS, HUBS, LINE_TIERS, PLANTS, PLANT_SIZE, ROAD_TIERS, SERVICES, UNIQUES, UNIQUE_RULES, lineRank, roadRank, type CoastKind, type GovernmentKind, type HubKind, type LineTier, type PlantKind, type RoadTier, type ServiceKind, type UniqueKind } from '../config';
import { coastFits } from '../sim/coast';
import { levelBlocks } from './leveling';
import { connectedToRoute } from './route';
import { serviceAt, serviceFootprint } from './services';
import { depotAt, freeBusNumber, packBusLine } from './transport';
import { hubFootprint, hubRefusal, markHubsDirty } from './hubs';
import { uniqueFootprint, uniqueRefusal } from './uniques';
import { TILE, World, coastTile, hubOf, hubTile, serviceOf, serviceTile, zoneOf, zoneTile, type ZoneKind } from './world';

export type ToolId = 'query' | 'bulldoze' | 'bus' | 'airport' | 'harbor' | 'roadDirt' | 'road' | 'roadPaved' | 'roadBoulevard' | 'line' | 'lineConcrete' | 'zoneR' | 'zoneC' | 'zoneI' | 'park' | 'plant' | 'plantGas' | 'plantWind' | ServiceKind | CoastKind | UniqueKind;

export type ToolShape = 'point' | 'line' | 'rect' | 'anchor';

export interface ToolInfo {
  id: ToolId;
  label: string;
  key: string;
  shape: ToolShape;
  help: string;
}

const percent = (share: number): string => `${Math.round(share * 100)} %`;
const UNIQUE_PLAZA = UNIQUE_RULES.obelisco.plazaCells;
const UNIQUE_TEATRO = UNIQUE_RULES.teatro.value;
const UNIQUE_ESTADIO = UNIQUE_RULES.estadio.boulevard;
const CABILDO_GOB = GOVERNMENTS.democracia.label.toLowerCase();
const REGIMIENTO_GOB = GOVERNMENTS.dictadura.label.toLowerCase();
const PLANETARIO_GOB = GOVERNMENTS.tecnocracia.label.toLowerCase();
const SANTUARIO_GOB = GOVERNMENTS.teocracia.label.toLowerCase();
const SINDICATO_GOB = GOVERNMENTS.comunismo.label.toLowerCase();
const SANTUARIO_RULE = UNIQUE_RULES.santuario.water;
const REGIMIENTO_RULE = UNIQUE_RULES.regimiento.openCells;
const SINDICATO_RULE = UNIQUE_RULES.sindicato.industryCells;
const PLANETARIO_RULE = UNIQUE_RULES.planetario.reach;
const CABILDO_RULE = UNIQUE_RULES.cabildo.plazaCells;

/** Every tool of the game, government uniques included: what `TOOLS` shows depends on `GOVERNMENT_UNIQUES`. */
const ALL_TOOLS: readonly ToolInfo[] = [
  { id: 'query', label: 'Consulta', key: '1', shape: 'point', help: 'Clic en el mapa para ver la ficha del lote.' },
  { id: 'bulldoze', label: 'Topadora', key: '2', shape: 'rect', help: 'Arrastrá para demoler. Se paga por lote.' },
  { id: 'roadDirt', label: 'Calle de tierra', key: '0', shape: 'line', help: 'La calle más barata y la peor de todas: aguanta la mitad del tránsito que el asfalto y no se puede hacer sobre el agua. Arrastrá asfalto encima para mejorarla pagando la diferencia.' },
  { id: 'road', label: 'Calle de asfalto', key: '3', shape: 'line', help: 'Arrastrá para trazar. Sobre el agua se hace puente.' },
  { id: 'roadPaved', label: 'Pavimento reforzado', key: 'r', shape: 'line', help: 'Calle de asfalto más resistente: entra un 60 % más de tránsito, cuesta más mantener y marca el medio con lucecitas amarillas. Arrastrá sobre una calle para mejorarla pagando la diferencia.' },
  { id: 'roadBoulevard', label: 'Bulevar', key: 't', shape: 'line', help: 'La calle de más capacidad, con cantero de cemento en el medio y farolas que bajan el delito alrededor. Arrastrá sobre una calle para mejorarla pagando la diferencia.' },
  { id: 'line', label: LINE_TIERS[0].label, key: '4', shape: 'line', help: 'Lleva la luz por terrenos vacíos y sobre el agua. Es el de madera: alumbra 3 lotes a la redonda y un poste cada 3 lotes.' },
  { id: 'lineConcrete', label: LINE_TIERS[1].label, key: '|', shape: 'line', help: 'El tendido que llega más lejos: alumbra 5 lotes a la redonda y un poste cada 5, así que cubre casi el triple con los mismos postes. Más caro de construir y de mantener. Arrastralo sobre el de madera para mejorarlo pagando la diferencia.' },
  { id: 'zoneR', label: 'Residencial', key: '5', shape: 'rect', help: 'Zona para viviendas. Necesita luz y calle cerca.' },
  { id: 'zoneC', label: 'Comercial', key: '6', shape: 'rect', help: 'Zona para comercios y oficinas.' },
  { id: 'zoneI', label: 'Industrial', key: '7', shape: 'rect', help: 'Zona para talleres y fábricas. Contamina.' },
  {
    id: 'park',
    label: 'Plaza',
    key: '8',
    shape: 'rect',
    // Three cells is the smallest plaza that lifts the land value; the bigger the patch, the further it reaches.
    help: 'Desde 3 celdas sube el valor del suelo alrededor y limpia el humo de las fábricas: cuanto más grande, más lejos llega. Si el presupuesto de espacios verdes baja del 50 %, la plaza se descuida y no hace ninguna de las dos cosas.',
  },
  { id: 'plant', label: 'Usina a carbón', key: '9', shape: 'anchor', help: 'Usina térmica de 2×2. Barata, pero contamina mucho.' },
  { id: 'plantGas', label: 'Usina a gas', key: 'j', shape: 'anchor', help: 'Usina de 2×2. Más cara de construir y de mantener, casi no contamina.' },
  { id: 'plantWind', label: 'Parque eólico', key: 'k', shape: 'anchor', help: 'Molinos de 2×2. No contaminan y cuestan poco de mantener; rinden más en lo alto de una loma y cerca del agua.' },
  { id: 'school', label: 'Escuela', key: 'y', shape: 'point', help: 'Educación: sin escuela no se levantan torres ni oficinas.' },
  { id: 'clinic', label: 'Salita', key: 'u', shape: 'point', help: 'Salud: sin salita las casas no pasan de chalet.' },
  { id: 'police', label: 'Comisaría', key: 'i', shape: 'point', help: 'Seguridad: baja el delito en los barrios densos.' },
  { id: 'fire', label: 'Bomberos', key: 'o', shape: 'point', help: 'Cuartel de bomberos voluntarios: apaga incendios.' },
  { id: 'hospital', label: 'Hospital', key: ';', shape: 'point', help: 'Salud de segundo nivel, de radio grande: sin hospital las casas más altas no se levantan. También hace de salita. Caro de construir y de mantener.' },
  { id: 'university', label: 'Universidad', key: '-', shape: 'point', help: 'Educación de segundo nivel, de radio grande: sin universidad los comercios y las fábricas más altos no se levantan. También hace de escuela. Caro de construir y de mantener.' },
  { id: 'fishing', label: COAST.fishing.label, key: 'z', shape: 'point', help: 'Sobre la costa. Con calle cerca y luz da 12 empleos industriales y vende pescado.' },
  { id: 'promenade', label: COAST.promenade.label, key: 'x', shape: 'rect', help: 'Paseo sobre la costa, se arrastra como la plaza. Con calle cerca y luz sube el valor del suelo y la aprobación.' },
  { id: 'port', label: COAST.port.label, key: 'v', shape: 'point', help: 'Sobre la costa. Con calle cerca y luz da 40 empleos industriales y sube los impuestos de las fábricas; contamina.' },
  { id: 'resort', label: COAST.resort.label, key: 'l', shape: 'point', help: 'En la playa. Con calle cerca y luz da 30 empleos y mucho turismo en verano.' },
  { id: 'bus', label: BUS.label, key: 'ñ', shape: 'point', help: 'Ocupa una cochera de 2×2 lotes de tierra, pero solo funciona con una calle a 3 lotes o menos. Alivia el tránsito de las calles a su alrededor y se ven los colectivos andar. Al colocarla elegís el color y el número de la línea.' },
  { id: 'harbor', label: HUBS.harbor.label, key: '.', shape: 'anchor', help: 'Una pieza de 2×2 pegada al agua: un muelle con un barco de paseos. Funciona con una calle a 3 lotes o menos de alguna pieza y con luz: consume mucha electricidad, más cuanto más grande. Si ponés otra pegada es un puerto más grande, y con tres o más hay cruceros. Da empleos y turismo.' },
  { id: 'airport', label: HUBS.airport.label, key: ',', shape: 'anchor', help: 'Una pieza de 3×2 en tierra: un hangar con uno o dos aviones. Funciona con una calle a 3 lotes o menos de alguna pieza y con luz: consume mucha electricidad, más cuanto más grande. Con otra pegada es un aeródromo y con cuatro o más, un aeropuerto internacional. Da empleos y turismo, pero hace ruido: baja el valor del suelo alrededor.' },
  { id: 'lighthouse', label: COAST.lighthouse.label, key: 'f', shape: 'point', help: 'Uno solo por ciudad, a 2 lotes o menos del agua. Con calle cerca y luz suma aprobación y valor del suelo.' },
  { id: 'obelisco', label: UNIQUES.obelisco.label, key: '/', shape: 'anchor', help: `Uno solo por ciudad, de 2×2, en el medio de una plaza: necesita ${UNIQUE_PLAZA} lotes de plaza a 2 lotes o menos. Con calle cerca suma ${percent(UNIQUES.obelisco.boost)} al turismo de la ciudad, y ${percent(UNIQUES.obelisco.peak)} en verano.` },
  { id: 'calvario', label: UNIQUES.calvario.label, key: '[', shape: 'anchor', help: `Uno solo por ciudad, de 3×6, en lo más alto del mapa: tiene que estar a ${UNIQUE_RULES.calvario.margin} niveles o menos de la cima que tenga este mapa, así que siempre hay un rango donde entra. Con calle cerca suma ${percent(UNIQUES.calvario.boost)} al turismo, y ${percent(UNIQUES.calvario.peak)} en septiembre, cuando sube la peregrinación.` },
  { id: 'puente', label: UNIQUES.puente.label, key: ']', shape: 'anchor', help: `Uno solo por ciudad, de 2×6, todo sobre el agua con una punta en tierra. Con calle cerca suma ${percent(UNIQUES.puente.boost)} al turismo de la ciudad.` },
  { id: 'teatro', label: UNIQUES.teatro.label, key: ':', shape: 'anchor', help: `Uno solo por ciudad, de 3×3, en un barrio de valor del suelo ${UNIQUE_TEATRO} o más. Con calle cerca suma ${percent(UNIQUES.teatro.boost)} al turismo, y ${percent(UNIQUES.teatro.peak)} de abril a agosto, la temporada de funciones.` },
  { id: 'estadio', label: UNIQUES.estadio.label, key: '*', shape: 'anchor', help: `Uno solo por ciudad, de 4×4, con un bulevar a ${UNIQUE_ESTADIO} lotes o menos. Con calle cerca suma ${percent(UNIQUES.estadio.boost)} al turismo, y ${percent(UNIQUES.estadio.peak)} de marzo a noviembre, cuando hay torneo.` },
  { id: 'cabildo', label: UNIQUES.cabildo.label, key: '{', shape: 'anchor', help: `El único de ${CABILDO_GOB}, de 3×2, con una plaza enfrente: ${CABILDO_RULE} lotes de plaza a ${UNIQUE_RULES.cabildo.reach} lotes o menos. Con calle cerca suma ${UNIQUES.cabildo.approval!.perMonth} puntos de aprobación por mes, y ${UNIQUES.cabildo.approval!.peak} en septiembre, el mes de la elección.` },
  { id: 'regimiento', label: UNIQUES.regimiento.label, key: '}', shape: 'anchor', help: `El único de ${REGIMIENTO_GOB}, de 4×3, en descampado: ${REGIMIENTO_RULE} lotes libres a ${UNIQUE_RULES.regimiento.reach} lotes o menos. Con calle cerca baja el delito de los lotes de alrededor.` },
  { id: 'planetario', label: UNIQUES.planetario.label, key: '?', shape: 'anchor', help: `El único de ${PLANETARIO_GOB}, de 3×3, a ${PLANETARIO_RULE} lotes o menos de una universidad. Con calle cerca da educación a los lotes de alrededor, como una escuela.` },
  { id: 'santuario', label: UNIQUES.santuario.label, key: "'", shape: 'anchor', help: `El único de ${SANTUARIO_GOB}, de 3×4, a ${SANTUARIO_RULE} lotes o menos del agua. Con calle cerca suma ${UNIQUES.santuario.favor!.perMonth} puntos de favor por mes, y ${UNIQUES.santuario.favor!.peak} en abril, la peregrinación.` },
  { id: 'sindicato', label: UNIQUES.sindicato.label, key: '\\', shape: 'anchor', help: `El único de ${SINDICATO_GOB}, de 3×2, entre las fábricas: ${SINDICATO_RULE} lotes industriales a ${UNIQUE_RULES.sindicato.reach} lotes o menos. Con calle cerca suma turismo en proporción a los puestos de trabajo industriales de la ciudad.` },
];

export function isServiceTool(tool: ToolId): tool is ServiceKind {
  return tool === 'school' || tool === 'clinic' || tool === 'police' || tool === 'fire' || tool === 'hospital' || tool === 'university';
}

export function isCoastTool(tool: ToolId): tool is CoastKind {
  return tool === 'fishing' || tool === 'promenade' || tool === 'port' || tool === 'resort' || tool === 'lighthouse';
}

export function isUniqueTool(tool: ToolId): tool is UniqueKind {
  return (ALL_UNIQUE_KINDS as readonly string[]).includes(tool);
}

/** True when the tool is the unique of another form of government: it is not an option in this city. */
export function isForeignUnique(tool: ToolId, government: GovernmentKind): boolean {
  const kind = uniqueKindOfTool(tool);
  if (!kind) return false;
  const own = UNIQUES[kind].government;
  return own !== undefined && own !== government;
}

const PLANT_TOOLS: Partial<Record<ToolId, PlantKind>> = { plant: 'coal', plantGas: 'gas', plantWind: 'wind' };

/** The kind of power plant a tool builds, or null for any other tool. */
export function plantKindOfTool(tool: ToolId): PlantKind | null {
  return PLANT_TOOLS[tool] ?? null;
}

/** The kind of airport or harbour piece a tool builds, or null for any other tool. */
export function hubKindOfTool(tool: ToolId): HubKind | null {
  return tool === 'airport' || tool === 'harbor' ? tool : null;
}

/** The unique building a tool raises, or null for any other tool. */
export function uniqueKindOfTool(tool: ToolId): UniqueKind | null {
  return isUniqueTool(tool) ? tool : null;
}

export function toolInfo(id: ToolId): ToolInfo {
  return TOOLS.find((t) => t.id === id)!;
}

export interface ToolGroup {
  id: 'query' | 'network' | 'zones' | 'services' | 'plants' | 'coast' | 'transport' | 'uniques';
  label: string;
  tools: readonly ToolId[];
}

/** The toolbar's categories: every tool belongs to exactly one, in the order it is listed. */
const isGovernmentUniqueTool = (tool: ToolId): boolean => GOVERNMENT_UNIQUE_KINDS.includes(tool as UniqueKind);

/** The tools the game offers: the government uniques only when the package is switched on. */
export const TOOLS: readonly ToolInfo[] = GOVERNMENT_UNIQUES ? ALL_TOOLS : ALL_TOOLS.filter((t) => !isGovernmentUniqueTool(t.id));

export const TOOL_GROUPS: readonly ToolGroup[] = [
  { id: 'query', label: 'Consulta', tools: ['query', 'bulldoze'] },
  { id: 'network', label: 'Calles y luz', tools: ['roadDirt', 'road', 'roadPaved', 'roadBoulevard', 'line', 'lineConcrete'] },
  { id: 'zones', label: 'Zonas', tools: ['zoneR', 'zoneC', 'zoneI', 'park'] },
  { id: 'services', label: 'Servicios', tools: ['school', 'clinic', 'police', 'fire', 'hospital', 'university'] },
  { id: 'plants', label: 'Usinas', tools: ['plant', 'plantGas', 'plantWind'] },
  { id: 'coast', label: 'Costa', tools: ['fishing', 'promenade', 'port', 'resort', 'lighthouse'] },
  { id: 'transport', label: 'Transportes', tools: ['bus', 'harbor', 'airport'] },
  {
    id: 'uniques',
    label: 'Únicos',
    tools: GOVERNMENT_UNIQUES
      ? ['obelisco', 'calvario', 'puente', 'teatro', 'estadio', 'cabildo', 'regimiento', 'planetario', 'santuario', 'sindicato']
      : ['obelisco', 'calvario', 'puente', 'teatro', 'estadio'],
  },
];

export function groupOfTool(tool: ToolId): ToolGroup {
  return TOOL_GROUPS.find((g) => g.tools.includes(tool))!;
}

export type Cell = [number, number];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Cells covered by a drag from (ax, ay) to (bx, by), in world coordinates. */
export function dragCells(tool: ToolId, ax: number, ay: number, bx: number, by: number, block: number, n: number): Cell[] {
  const shape = toolInfo(tool).shape;
  if (shape === 'point' || shape === 'anchor') return [[bx, by]];
  if (shape === 'line') {
    // L-shaped path: walk the longer axis first, then turn.
    const cells: Cell[] = [];
    const walk = (fx: number, fy: number, tx: number, ty: number) => {
      let x = fx;
      let y = fy;
      cells.push([x, y]);
      while (x !== tx || y !== ty) {
        x += Math.sign(tx - x);
        y += Math.sign(ty - y);
        cells.push([x, y]);
      }
    };
    if (Math.abs(bx - ax) >= Math.abs(by - ay)) {
      walk(ax, ay, bx, ay);
      if (by !== ay) walk(bx, ay + Math.sign(by - ay), bx, by);
    } else {
      walk(ax, ay, ax, by);
      if (bx !== ax) walk(ax + Math.sign(bx - ax), by, bx, by);
    }
    return cells.filter(([x, y]) => x >= 0 && y >= 0 && x < n && y < n);
  }
  let x0 = Math.min(ax, bx);
  let x1 = Math.max(ax, bx);
  let y0 = Math.min(ay, by);
  let y1 = Math.max(ay, by);
  if (block > 1) {
    x0 = Math.floor(x0 / block) * block;
    y0 = Math.floor(y0 / block) * block;
    x1 = Math.floor(x1 / block) * block + block - 1;
    y1 = Math.floor(y1 / block) * block + block - 1;
  }
  x0 = clamp(x0, 0, n - 1);
  x1 = clamp(x1, 0, n - 1);
  y0 = clamp(y0, 0, n - 1);
  y1 = clamp(y1, 0, n - 1);
  const cells: Cell[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) cells.push([x, y]);
  return cells;
}

/** The lots a one-piece tool (a power plant, an airport, a harbour or a unique) placed at (x, y) would cover, or null for any other tool. */
export function footprintOfTool(tool: ToolId, n: number, x: number, y: number): Cell[] | null {
  if (plantKindOfTool(tool)) return plantFootprint(n, x, y);
  const hub = hubKindOfTool(tool);
  if (hub) return hubFootprint(hub, n, x, y);
  if (tool === 'bus') return busFootprint(n, x, y);
  if (isServiceTool(tool)) return serviceFootprint(tool, n, x, y);
  const unique = uniqueKindOfTool(tool);
  return unique ? uniqueFootprint(unique, n, x, y) : null;
}

/** The cells of a bus depot whose anchor is the lot clicked: a `BUS.size`×`BUS.size` block, kept inside the map. */
export function busFootprint(n: number, x: number, y: number): Cell[] {
  const fx = clamp(x, 0, n - BUS.size);
  const fy = clamp(y, 0, n - BUS.size);
  const foot: Cell[] = [];
  for (let dy = 0; dy < BUS.size; dy++) for (let dx = 0; dx < BUS.size; dx++) foot.push([fx + dx, fy + dy]);
  return foot;
}

/** The 2×2 cells a power plant placed at (x, y) would cover, kept inside the map. */
export function plantFootprint(n: number, x: number, y: number): Cell[] {
  const fx = clamp(x, 0, n - PLANT_SIZE);
  const fy = clamp(y, 0, n - PLANT_SIZE);
  const foot: Cell[] = [];
  for (let dy = 0; dy < PLANT_SIZE; dy++) for (let dx = 0; dx < PLANT_SIZE; dx++) foot.push([fx + dx, fy + dy]);
  return foot;
}

export interface Plan {
  tool: ToolId;
  /** For a bus depot: the line (colour and number, see `world/transport.ts`) it is built with. */
  line?: number;
  /** Cells the action will actually change. */
  cells: Cell[];
  cost: number;
}

/** The quality of street a tool builds, or null for any other tool. */
export function roadTierOfTool(tool: ToolId): RoadTier | null {
  if (tool === 'roadDirt') return DIRT;
  if (tool === 'road') return 0;
  if (tool === 'roadPaved') return 1;
  if (tool === 'roadBoulevard') return 2;
  return null;
}

export function isRoadTool(tool: ToolId): boolean {
  return roadTierOfTool(tool) !== null;
}

/** The quality of grid a tool builds, or null for any other tool. */
export function lineTierOfTool(tool: ToolId): LineTier | null {
  if (tool === 'line') return 0;
  if (tool === 'lineConcrete') return 1;
  return null;
}

function zoneKindOfTool(tool: ToolId): ZoneKind | null {
  if (tool === 'zoneR') return 'R';
  if (tool === 'zoneC') return 'C';
  if (tool === 'zoneI') return 'I';
  return null;
}

/** An empty lot: nothing built, or a zone without a building yet. */
function isFreeLot(w: World, x: number, y: number): boolean {
  const i = w.idx(x, y);
  const t = w.tiles[i];
  return t === TILE.EMPTY || (zoneOf(t) !== null && w.level[i] === 0);
}

/**
 * A lot where a monument may go: empty like any other, or a lot of plaza — the obelisco stands in
 * the middle of the plaza and takes its place (`UNIQUE_RULES.obelisco` asks for the plaza around it).
 */
function isFreeForUnique(w: World, x: number, y: number): boolean {
  return isFreeLot(w, x, y) || w.tiles[w.idx(x, y)] === TILE.PARK;
}

const ROUTE_UNTOUCHABLE = 'La ruta provincial no se toca';
const STREETS_FROM_ROUTE = 'La calle tiene que salir de la ruta o de otra calle';

/** Cells whose side touches (x, y). */
function sideNeighbours(w: World, x: number, y: number): number[] {
  const out: number[] = [];
  if (x > 0) out.push(w.idx(x - 1, y));
  if (x < w.n - 1) out.push(w.idx(x + 1, y));
  if (y > 0) out.push(w.idx(x, y - 1));
  if (y < w.n - 1) out.push(w.idx(x, y + 1));
  return out;
}

/** Why the tool cannot work on a cell because of the provincial route, in words for the player, or null. */
export function routeRefusal(w: World, tool: ToolId, x: number, y: number): string | null {
  if (tool === 'query' || !w.inBounds(x, y)) return null;
  if (w.route[w.idx(x, y)]) return ROUTE_UNTOUCHABLE;
  if (!isRoadTool(tool)) return null;
  const connected = connectedToRoute(w);
  if (!connected) return null;
  const t = w.tiles[w.idx(x, y)];
  if (!(isFreeLot(w, x, y) || t === TILE.LINE)) return null;
  return sideNeighbours(w, x, y).some((j) => connected[j]) ? null : STREETS_FROM_ROUTE;
}

/** Works out which cells the tool will change and what it costs, without changing anything. */
export function planTool(w: World, tool: ToolId, cells: Cell[]): Plan {
  const out: Cell[] = [];
  let cost = 0;
  const seen = new Set<number>();
  const plantsSeen = new Set<object>();
  const zone = zoneKindOfTool(tool);
  const plantKind = plantKindOfTool(tool);
  const tier = roadTierOfTool(tool);
  const lineTier = lineTierOfTool(tool);
  // With a route, a street is only accepted next to a street that comes from it, or to the cell accepted before it.
  const connected = tier !== null ? connectedToRoute(w) : null;
  let previous = -1;
  // Last pole of a power line, so the run spends its reach instead of standing a pole on every cell.
  let poleX = -1;
  let poleY = -1;

  if (plantKind) {
    const [ax, ay] = cells[0] ?? [-1, -1];
    const foot = plantFootprint(w.n, ax, ay);
    const ok = foot.every(([x, y]) => w.inBounds(x, y) && !w.isWater(x, y) && !w.route[w.idx(x, y)] && isFreeLot(w, x, y));
    return ok ? { tool, cells: foot, cost: PLANTS[plantKind].cost } : { tool, cells: [], cost: 0 };
  }

  if (tool === 'bus') {
    const [ax, ay] = cells[0] ?? [-1, -1];
    const foot = busFootprint(w.n, ax, ay);
    const ok = foot.every(([x, y]) => w.inBounds(x, y) && !w.route[w.idx(x, y)] && isFreeLot(w, x, y) && !w.isWater(x, y));
    return ok ? { tool, cells: foot, cost: BUS.cost } : { tool, cells: [], cost: 0 };
  }

  if (isServiceTool(tool)) {
    // A service is one building, however many lots it takes: the block goes up whole or not at all.
    const [ax, ay] = cells[0] ?? [-1, -1];
    const foot = serviceFootprint(tool, w.n, ax, ay);
    const ok = foot.every(([x, y]) => w.inBounds(x, y) && !w.isWater(x, y) && !w.route[w.idx(x, y)] && isFreeLot(w, x, y));
    return ok ? { tool, cells: foot, cost: SERVICES[tool].cost } : { tool, cells: [], cost: 0 };
  }

  const hubKind = hubKindOfTool(tool);
  if (hubKind) {
    const [ax, ay] = cells[0] ?? [-1, -1];
    const foot = hubFootprint(hubKind, w.n, ax, ay);
    const ok = foot.every(([x, y]) => !w.route[w.idx(x, y)] && isFreeLot(w, x, y)) && hubRefusal(w, hubKind, foot) === null;
    return ok ? { tool, cells: foot, cost: HUBS[hubKind].cost } : { tool, cells: [], cost: 0 };
  }

  const uniqueKind = uniqueKindOfTool(tool);
  if (uniqueKind) {
    const [ax, ay] = cells[0] ?? [-1, -1];
    const foot = uniqueFootprint(uniqueKind, w.n, ax, ay);
    const ok =
      foot.every(([x, y]) => w.inBounds(x, y) && !w.route[w.idx(x, y)] && isFreeForUnique(w, x, y)) && uniqueRefusal(w, uniqueKind, foot) === null;
    return ok ? { tool, cells: foot, cost: UNIQUES[uniqueKind].cost } : { tool, cells: [], cost: 0 };
  }

  for (const [x, y] of cells) {
    if (!w.inBounds(x, y)) continue;
    const i = w.idx(x, y);
    if (seen.has(i)) continue;
    seen.add(i);
    if (w.route[i]) continue;
    const t = w.tiles[i];
    const water = w.isWater(x, y);
    // A better street over an existing one is an upgrade in place: only the difference is charged.
    if (tier !== null && t === TILE.ROAD) {
      const was = w.roadTier[i] as RoadTier;
      if (roadRank(tier) > roadRank(was)) {
        out.push([x, y]);
        cost += ROAD_TIERS[tier].cost - ROAD_TIERS[was].cost;
      }
      continue;
    }
    if (tier !== null) {
      if (water && tier === DIRT) continue;
      if (isFreeLot(w, x, y) || t === TILE.LINE) {
        if (connected && !sideNeighbours(w, x, y).some((j) => connected[j] || j === previous)) continue;
        out.push([x, y]);
        previous = i;
        // A bridge is a surcharge: asphalt on water still costs exactly COSTS.bridge.
        cost += water ? COSTS.bridge + ROAD_TIERS[tier].cost - ROAD_TIERS[ASPHALT].cost : ROAD_TIERS[tier].cost;
      }
      continue;
    }
    switch (tool) {
      case 'line':
      case 'lineConcrete': {
        const want = lineTier!;
        if (t === TILE.LINE) {
          // A better grid over an existing one is an upgrade in place: only the difference is charged, and
          // the worse one over the better does nothing at all (the line is never torn down to a worse one).
          // Either way the pole is there, so the rest of the run measures its spacing from it.
          const was = w.lineTier[i] as LineTier;
          if (lineRank(want) > lineRank(was)) {
            out.push([x, y]);
            cost += LINE_TIERS[want].cost - LINE_TIERS[was].cost;
          }
          poleX = x;
          poleY = y;
          break;
        }
        // One pole every `reach` cells: it lights that far, so a long run costs that much less.
        const reach = LINE_TIERS[want].reach;
        if (t === TILE.EMPTY && (poleX < 0 || (x - poleX) ** 2 + (y - poleY) ** 2 >= reach ** 2)) {
          out.push([x, y]);
          cost += LINE_TIERS[want].cost;
          poleX = x;
          poleY = y;
        }
        break;
      }
      case 'park':
        if (!water && isFreeLot(w, x, y)) {
          out.push([x, y]);
          cost += COSTS.park;
        }
        break;
      case 'bulldoze': {
        if (t === TILE.PLANT) {
          const p = w.plantAt(x, y);
          if (!p || plantsSeen.has(p)) break;
          plantsSeen.add(p);
          for (let dy = 0; dy < PLANT_SIZE; dy++) {
            for (let dx = 0; dx < PLANT_SIZE; dx++) {
              seen.add(w.idx(p.x + dx, p.y + dy));
              out.push([p.x + dx, p.y + dy]);
            }
          }
          cost += COSTS.bulldozePlant;
        } else if (hubOf(t)) {
          // A piece of an airport or a harbour comes down whole, like a power plant.
          const p = w.hubAt(x, y);
          if (!p || plantsSeen.has(p)) break;
          plantsSeen.add(p);
          for (const [cx, cy] of hubFootprint(p.kind, w.n, p.x, p.y)) {
            seen.add(w.idx(cx, cy));
            out.push([cx, cy]);
          }
          cost += COSTS.bulldozePlant;
        } else if (t === TILE.BUS) {
          // A depot comes down whole: half a cochera is not a cochera.
          const depot = depotAt(w, x, y);
          if (!depot || plantsSeen.has(depot)) break;
          plantsSeen.add(depot);
          for (const [cx, cy] of busFootprint(w.n, depot.x, depot.y)) {
            seen.add(w.idx(cx, cy));
            out.push([cx, cy]);
          }
          cost += COSTS.bulldozePlant;
        } else if (serviceOf(t)) {
          // A hospital is one building on nine lots: three quarters of a hospital is not a hospital.
          const block = serviceAt(w, x, y);
          if (!block || plantsSeen.has(block)) break;
          plantsSeen.add(block);
          for (const [cx, cy] of serviceFootprint(block.kind, w.n, block.x, block.y)) {
            seen.add(w.idx(cx, cy));
            out.push([cx, cy]);
          }
          cost += COSTS.bulldozePlant;
        } else if (t === TILE.UNIQUE) {
          // A monument comes down whole too: nobody tears an obelisco down half way.
          const u = w.uniqueAt(x, y);
          if (!u || plantsSeen.has(u)) break;
          plantsSeen.add(u);
          for (const [cx, cy] of uniqueFootprint(u.kind, w.n, u.x, u.y)) {
            seen.add(w.idx(cx, cy));
            out.push([cx, cy]);
          }
          cost += COSTS.bulldozePlant;
        } else if (t !== TILE.EMPTY || w.terrain.trees[i]) {
          out.push([x, y]);
          cost += COSTS.bulldoze + w.level[i] * COSTS.bulldozeLevel;
        }
        break;
      }
      default:
        if (isCoastTool(tool)) {
          // One lighthouse per city: the first valid lot of the plan is the only one.
          if (tool === 'lighthouse' && out.length > 0) break;
          if (isFreeLot(w, x, y) && coastFits(w, tool, x, y)) {
            out.push([x, y]);
            cost += COAST[tool].cost;
          }
          break;
        }
        if (zone && !water && isFreeLot(w, x, y) && t !== zoneTile(zone)) {
          out.push([x, y]);
          cost += COSTS.zone;
        }
    }
  }
  return { tool, cells: out, cost };
}

/** Applies a plan produced by `planTool`. The caller is responsible for charging `plan.cost`. */
export function applyPlan(w: World, plan: Plan): void {
  if (plan.cells.length === 0) return;
  const zone = zoneKindOfTool(plan.tool);
  const plantKind = plantKindOfTool(plan.tool);
  const tier = roadTierOfTool(plan.tool);
  // The four cells of a depot share one line: drawing it per cell would number them separately.
  const busLine = plan.tool === 'bus' ? plan.line ?? packBusLine(0, freeBusNumber(w)) : 0;
  for (const [x, y] of plan.cells) {
    const i = w.idx(x, y);
    if (w.route[i]) continue;
    if (tier !== null) {
      // An upgrade keeps the cell as it is: same tile, same inherited flag, same trees.
      if (w.tiles[i] === TILE.ROAD) {
        w.roadTier[i] = tier;
        w.markDirty(i);
      } else {
        w.setTile(x, y, TILE.ROAD);
        w.roadTier[i] = tier;
        w.terrain.trees[i] = 0;
      }
      continue;
    }
    switch (plan.tool) {
      case 'line':
      case 'lineConcrete':
        // An upgrade keeps the cell as it is (same pole, same place) and only changes its quality.
        if (w.tiles[i] === TILE.LINE) {
          w.lineTier[i] = lineTierOfTool(plan.tool)!;
          w.markDirty(i);
        } else {
          w.setTile(x, y, TILE.LINE);
          w.lineTier[i] = lineTierOfTool(plan.tool)!;
          w.terrain.trees[i] = 0;
        }
        break;
      case 'park':
        w.setTile(x, y, TILE.PARK);
        break;
      case 'bus':
        w.setTile(x, y, TILE.BUS);
        w.busLine[i] = busLine;
        w.terrain.trees[i] = 0;
        break;
      case 'plant':
      case 'plantGas':
      case 'plantWind':
        w.setTile(x, y, TILE.PLANT);
        w.terrain.trees[i] = 0;
        break;
      case 'bulldoze':
        if (w.tiles[i] === TILE.PLANT) {
          w.plants = w.plants.filter((p) => p !== w.plantAt(x, y));
        }
        if (hubOf(w.tiles[i])) {
          const piece = w.hubAt(x, y);
          w.hubs = w.hubs.filter((h) => h !== piece);
        }
        if (w.tiles[i] === TILE.UNIQUE) {
          const monument = w.uniqueAt(x, y);
          w.uniques = w.uniques.filter((u) => u !== monument);
        }
        w.setTile(x, y, TILE.EMPTY);
        w.terrain.trees[i] = 0;
        break;
      default:
        if (isServiceTool(plan.tool)) {
          w.setTile(x, y, serviceTile(plan.tool));
          w.terrain.trees[i] = 0;
        } else if (hubKindOfTool(plan.tool)) {
          w.setTile(x, y, hubTile(hubKindOfTool(plan.tool)!));
          w.terrain.trees[i] = 0;
        } else if (uniqueKindOfTool(plan.tool)) {
          w.setTile(x, y, TILE.UNIQUE);
          w.terrain.trees[i] = 0;
        } else if (isCoastTool(plan.tool)) {
          w.setTile(x, y, coastTile(plan.tool));
          w.terrain.trees[i] = 0;
        } else if (zone) w.setTile(x, y, zoneTile(zone));
    }
  }
  if (plantKind) {
    const [x, y] = plan.cells[0];
    w.plants.push({ x, y, kind: plantKind });
  }
  const hubKind = hubKindOfTool(plan.tool);
  if (hubKind) {
    const [x, y] = plan.cells[0];
    w.hubs.push({ x, y, kind: hubKind });
  }
  const uniqueKind = uniqueKindOfTool(plan.tool);
  if (uniqueKind) {
    const [x, y] = plan.cells[0];
    w.uniques.push({ x, y, kind: uniqueKind });
  }
  // Zoning or placing a service levels the block it belongs to (see `levelBlocks`).
  if (zone || isServiceTool(plan.tool) || hubKind) levelBlocks(w, plan.cells);
  if (hubKind || plan.tool === 'bulldoze') markHubsDirty(w);
  w.bumpNetwork();
}
