import { COSTS, PLANTS, PLANT_SIZE, SERVICES, type PlantKind, type ServiceKind } from '../config';
import { levelBlocks } from './leveling';
import { TILE, World, serviceTile, zoneOf, zoneTile, type ZoneKind } from './world';

export type ToolId = 'query' | 'bulldoze' | 'road' | 'line' | 'zoneR' | 'zoneC' | 'zoneI' | 'park' | 'plant' | 'plantGas' | 'plantWind' | ServiceKind;

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
  { id: 'road', label: 'Calle', key: '3', shape: 'line', help: 'Arrastrá para trazar. Sobre el agua se hace puente.' },
  { id: 'line', label: 'Tendido eléctrico', key: '4', shape: 'line', help: 'Lleva la luz por terrenos vacíos y sobre el agua.' },
  { id: 'zoneR', label: 'Residencial', key: '5', shape: 'rect', help: 'Zona para viviendas. Necesita luz y calle cerca.' },
  { id: 'zoneC', label: 'Comercial', key: '6', shape: 'rect', help: 'Zona para comercios y oficinas.' },
  { id: 'zoneI', label: 'Industrial', key: '7', shape: 'rect', help: 'Zona para talleres y fábricas. Contamina.' },
  { id: 'park', label: 'Plaza', key: '8', shape: 'rect', help: 'Sube el valor del suelo alrededor.' },
  { id: 'plant', label: 'Usina a carbón', key: '9', shape: 'anchor', help: 'Usina térmica de 2×2. Barata, pero contamina mucho.' },
  { id: 'plantGas', label: 'Usina a gas', key: 'j', shape: 'anchor', help: 'Usina de 2×2. Más cara de construir y de mantener, casi no contamina.' },
  { id: 'plantWind', label: 'Parque eólico', key: 'k', shape: 'anchor', help: 'Molinos de 2×2. No contaminan y cuestan poco de mantener; rinden más en lo alto de una loma y cerca del agua.' },
  { id: 'school', label: 'Escuela', key: 'y', shape: 'point', help: 'Educación: sin escuela no se levantan torres ni oficinas.' },
  { id: 'clinic', label: 'Salita', key: 'u', shape: 'point', help: 'Salud: sin salita las casas no pasan de chalet.' },
  { id: 'police', label: 'Comisaría', key: 'i', shape: 'point', help: 'Seguridad: baja el delito en los barrios densos.' },
  { id: 'fire', label: 'Bomberos', key: 'o', shape: 'point', help: 'Cuartel de bomberos voluntarios: apaga incendios.' },
];

export function isServiceTool(tool: ToolId): tool is ServiceKind {
  return tool === 'school' || tool === 'clinic' || tool === 'police' || tool === 'fire';
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
  id: 'query' | 'network' | 'zones' | 'services' | 'plants';
  label: string;
  tools: readonly ToolId[];
}

/** The toolbar's categories: every tool belongs to exactly one, in the order it is listed. */
export const TOOL_GROUPS: readonly ToolGroup[] = [
  { id: 'query', label: 'Consulta', tools: ['query', 'bulldoze'] },
  { id: 'network', label: 'Calles y luz', tools: ['road', 'line'] },
  { id: 'zones', label: 'Zonas', tools: ['zoneR', 'zoneC', 'zoneI', 'park'] },
  { id: 'services', label: 'Servicios', tools: ['school', 'clinic', 'police', 'fire'] },
  { id: 'plants', label: 'Usinas', tools: ['plant', 'plantGas', 'plantWind'] },
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
  /** Cells the action will actually change. */
  cells: Cell[];
  cost: number;
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

/** Works out which cells the tool will change and what it costs, without changing anything. */
export function planTool(w: World, tool: ToolId, cells: Cell[]): Plan {
  const out: Cell[] = [];
  let cost = 0;
  const seen = new Set<number>();
  const plantsSeen = new Set<object>();
  const zone = zoneKindOfTool(tool);
  const plantKind = plantKindOfTool(tool);

  if (plantKind) {
    const [ax, ay] = cells[0] ?? [-1, -1];
    const foot = plantFootprint(w.n, ax, ay);
    const ok = foot.every(([x, y]) => w.inBounds(x, y) && !w.isWater(x, y) && isFreeLot(w, x, y));
    return ok ? { tool, cells: foot, cost: PLANTS[plantKind].cost } : { tool, cells: [], cost: 0 };
  }

  for (const [x, y] of cells) {
    if (!w.inBounds(x, y)) continue;
    const i = w.idx(x, y);
    if (seen.has(i)) continue;
    seen.add(i);
    const t = w.tiles[i];
    const water = w.isWater(x, y);
    switch (tool) {
      case 'road':
        if (t === TILE.ROAD) break;
        if (isFreeLot(w, x, y) || t === TILE.LINE) {
          out.push([x, y]);
          cost += water ? COSTS.bridge : COSTS.road;
        }
        break;
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
        if (isServiceTool(tool)) {
          if (!water && isFreeLot(w, x, y)) {
            out.push([x, y]);
            cost += SERVICES[tool].cost;
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
  for (const [x, y] of plan.cells) {
    const i = w.idx(x, y);
    switch (plan.tool) {
      case 'road':
        w.setTile(x, y, TILE.ROAD);
        w.terrain.trees[i] = 0;
        break;
      case 'line':
        w.setTile(x, y, TILE.LINE);
        w.terrain.trees[i] = 0;
        break;
      case 'park':
        w.setTile(x, y, TILE.PARK);
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
