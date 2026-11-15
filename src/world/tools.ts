import { ASPHALT, BUS, COAST, COSTS, DIRT, PLANTS, PLANT_SIZE, ROAD_TIERS, SERVICES, roadRank, type CoastKind, type PlantKind, type RoadTier, type ServiceKind } from '../config';
import { coastFits } from '../sim/coast';
import { levelBlocks } from './leveling';
import { connectedToRoute } from './route';
import { busRefusal, freeBusNumber, packBusLine } from './transport';
import { TILE, World, coastTile, serviceTile, zoneOf, zoneTile, type ZoneKind } from './world';

export type ToolId = 'query' | 'bulldoze' | 'bus' | 'roadDirt' | 'road' | 'roadPaved' | 'roadBoulevard' | 'line' | 'zoneR' | 'zoneC' | 'zoneI' | 'park' | 'plant' | 'plantGas' | 'plantWind' | ServiceKind | CoastKind;

export type ToolShape = 'point' | 'line' | 'rect' | 'anchor';

export interface ToolInfo {
  id: ToolId;
  label: string;
  key: string;
  shape: ToolShape;
  help: string;
}

export const TOOLS: readonly ToolInfo[] = [
  { id: 'query', label: 'Consulta', key: '1', shape: 'point', help: 'Clic en el mapa para ver la ficha del lote.' },
  { id: 'bulldoze', label: 'Topadora', key: '2', shape: 'rect', help: 'Arrastrá para demoler. Se paga por lote.' },
  { id: 'roadDirt', label: 'Calle de tierra', key: '0', shape: 'line', help: 'La calle más barata y la peor de todas: aguanta la mitad del tránsito que el asfalto y no se puede hacer sobre el agua. Arrastrá asfalto encima para mejorarla pagando la diferencia.' },
  { id: 'road', label: 'Calle de asfalto', key: '3', shape: 'line', help: 'Arrastrá para trazar. Sobre el agua se hace puente.' },
  { id: 'roadPaved', label: 'Pavimento reforzado', key: 'r', shape: 'line', help: 'Calle de asfalto más resistente: entra un 60 % más de tránsito, cuesta más mantener y marca el medio con lucecitas amarillas. Arrastrá sobre una calle para mejorarla pagando la diferencia.' },
  { id: 'roadBoulevard', label: 'Bulevar', key: 't', shape: 'line', help: 'La calle de más capacidad, con cantero de cemento en el medio y farolas que bajan el delito alrededor. Arrastrá sobre una calle para mejorarla pagando la diferencia.' },
  { id: 'line', label: 'Tendido eléctrico', key: '4', shape: 'line', help: 'Lleva la luz por terrenos vacíos y sobre el agua.' },
  { id: 'zoneR', label: 'Residencial', key: '5', shape: 'rect', help: 'Zona para viviendas. Necesita luz y calle cerca.' },
  { id: 'zoneC', label: 'Comercial', key: '6', shape: 'rect', help: 'Zona para comercios y oficinas.' },
  { id: 'zoneI', label: 'Industrial', key: '7', shape: 'rect', help: 'Zona para talleres y fábricas. Contamina.' },
  {
    id: 'park',
    label: 'Plaza',
    key: '8',
    shape: 'rect',
    // Three cells is the smallest plaza that lifts the land value; the bigger the patch, the further it reaches.
    help: 'Desde 3 celdas sube el valor del suelo alrededor, y cuanto más grande, más lejos llega. Si el presupuesto de espacios verdes baja del 50 %, la plaza se descuida y lo baja.',
  },
  { id: 'plant', label: 'Usina a carbón', key: '9', shape: 'anchor', help: 'Usina térmica de 2×2. Barata, pero contamina mucho.' },
  { id: 'plantGas', label: 'Usina a gas', key: 'j', shape: 'anchor', help: 'Usina de 2×2. Más cara de construir y de mantener, casi no contamina.' },
  { id: 'plantWind', label: 'Parque eólico', key: 'k', shape: 'anchor', help: 'Molinos de 2×2. No contaminan y cuestan poco de mantener; rinden más en lo alto de una loma y cerca del agua.' },
  { id: 'school', label: 'Escuela', key: 'y', shape: 'point', help: 'Educación: sin escuela no se levantan torres ni oficinas.' },
  { id: 'clinic', label: 'Salita', key: 'u', shape: 'point', help: 'Salud: sin salita las casas no pasan de chalet.' },
  { id: 'police', label: 'Comisaría', key: 'i', shape: 'point', help: 'Seguridad: baja el delito en los barrios densos.' },
  { id: 'fire', label: 'Bomberos', key: 'o', shape: 'point', help: 'Cuartel de bomberos voluntarios: apaga incendios.' },
  { id: 'fishing', label: COAST.fishing.label, key: 'z', shape: 'point', help: 'Sobre la costa. Con una calle cerca da 12 empleos industriales y vende pescado.' },
  { id: 'promenade', label: COAST.promenade.label, key: 'x', shape: 'rect', help: 'Paseo sobre la costa, se arrastra como la plaza. Sube el valor del suelo y la aprobación.' },
  { id: 'port', label: COAST.port.label, key: 'v', shape: 'point', help: 'Sobre la costa. Con una calle cerca da 40 empleos industriales y sube los impuestos de las fábricas; contamina.' },
  { id: 'resort', label: COAST.resort.label, key: 'l', shape: 'point', help: 'En la playa. Con una calle cerca da 30 empleos y mucho turismo en verano.' },
  { id: 'bus', label: BUS.label, key: 'ñ', shape: 'point', help: 'A 3 lotes o menos de una calle. Alivia el tránsito de las calles a su alrededor y se ven los colectivos andar. Al colocarla elegís el color y el número de la línea.' },
  { id: 'lighthouse', label: COAST.lighthouse.label, key: 'f', shape: 'point', help: 'Uno solo por ciudad, a 2 lotes o menos del agua. Suma aprobación y valor del suelo.' },
];

export function isServiceTool(tool: ToolId): tool is ServiceKind {
  return tool === 'school' || tool === 'clinic' || tool === 'police' || tool === 'fire';
}

export function isCoastTool(tool: ToolId): tool is CoastKind {
  return tool === 'fishing' || tool === 'promenade' || tool === 'port' || tool === 'resort' || tool === 'lighthouse';
}

const PLANT_TOOLS: Partial<Record<ToolId, PlantKind>> = { plant: 'coal', plantGas: 'gas', plantWind: 'wind' };

/** The kind of power plant a tool builds, or null for any other tool. */
export function plantKindOfTool(tool: ToolId): PlantKind | null {
  return PLANT_TOOLS[tool] ?? null;
}

export function toolInfo(id: ToolId): ToolInfo {
  return TOOLS.find((t) => t.id === id)!;
}

export interface ToolGroup {
  id: 'query' | 'network' | 'zones' | 'services' | 'plants' | 'coast' | 'transport';
  label: string;
  tools: readonly ToolId[];
}

/** The toolbar's categories: every tool belongs to exactly one, in the order it is listed. */
export const TOOL_GROUPS: readonly ToolGroup[] = [
  { id: 'query', label: 'Consulta', tools: ['query', 'bulldoze'] },
  { id: 'network', label: 'Calles y luz', tools: ['roadDirt', 'road', 'roadPaved', 'roadBoulevard', 'line'] },
  { id: 'zones', label: 'Zonas', tools: ['zoneR', 'zoneC', 'zoneI', 'park'] },
  { id: 'services', label: 'Servicios', tools: ['school', 'clinic', 'police', 'fire'] },
  { id: 'plants', label: 'Usinas', tools: ['plant', 'plantGas', 'plantWind'] },
  { id: 'coast', label: 'Costa', tools: ['fishing', 'promenade', 'port', 'resort', 'lighthouse'] },
  { id: 'transport', label: 'Transportes', tools: ['bus'] },
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

const ROUTE_UNTOUCHABLE = 'La ruta provincial no se toca';
const STREETS_FROM_ROUTE = 'Las calles tienen que salir de la ruta';

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
  // With a route, a street is only accepted next to a street that comes from it, or to the cell accepted before it.
  const connected = tier !== null ? connectedToRoute(w) : null;
  let previous = -1;

  if (plantKind) {
    const [ax, ay] = cells[0] ?? [-1, -1];
    const foot = plantFootprint(w.n, ax, ay);
    const ok = foot.every(([x, y]) => w.inBounds(x, y) && !w.isWater(x, y) && !w.route[w.idx(x, y)] && isFreeLot(w, x, y));
    return ok ? { tool, cells: foot, cost: PLANTS[plantKind].cost } : { tool, cells: [], cost: 0 };
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
        if (t === TILE.EMPTY) {
          out.push([x, y]);
          cost += COSTS.line;
        }
        break;
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
        } else if (t !== TILE.EMPTY || w.terrain.trees[i]) {
          out.push([x, y]);
          cost += COSTS.bulldoze + w.level[i] * COSTS.bulldozeLevel;
        }
        break;
      }
      default:
        if (tool === 'bus') {
          if (isFreeLot(w, x, y) && busRefusal(w, x, y) === null) {
            out.push([x, y]);
            cost += BUS.cost;
          }
          break;
        }
        if (isServiceTool(tool)) {
          if (!water && isFreeLot(w, x, y)) {
            out.push([x, y]);
            cost += SERVICES[tool].cost;
          }
          break;
        }
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
        w.setTile(x, y, TILE.LINE);
        w.terrain.trees[i] = 0;
        break;
      case 'park':
        w.setTile(x, y, TILE.PARK);
        break;
      case 'bus':
        w.setTile(x, y, TILE.BUS);
        w.busLine[i] = plan.line ?? packBusLine(0, freeBusNumber(w));
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
        w.setTile(x, y, TILE.EMPTY);
        w.terrain.trees[i] = 0;
        break;
      default:
        if (isServiceTool(plan.tool)) {
          w.setTile(x, y, serviceTile(plan.tool));
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
  // Zoning or placing a service levels the block it belongs to (see `levelBlocks`).
  if (zone || isServiceTool(plan.tool)) levelBlocks(w, plan.cells);
  w.bumpNetwork();
}
