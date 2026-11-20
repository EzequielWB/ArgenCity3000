import { describe, expect, it } from 'vitest';
import { COSTS, FARM_SIZE, MARKET_SIZE, SILO_SIZE } from '../src/config';
import { SEA_LEVEL } from '../src/world/terrain';
import { TOOL_GROUPS, TOOLS, applyPlan, dragCells, footprintOfTool, planTool } from '../src/world/tools';
import { TILE, World } from '../src/world/world';

const N = 40;

const flat = (): World => new World({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(N * N) });

/** Coloca una pieza del campo y devuelve su plan, sin aplicarlo. */
function plan(w: World, tool: Parameters<typeof planTool>[1], ax: number, ay: number) {
  return planTool(w, tool, dragCells(tool, ax, ay, ax, ay, 1, N));
}

const poner = (w: World, tool: Parameters<typeof planTool>[1], ax: number, ay: number): void => applyPlan(w, plan(w, tool, ax, ay));

const celdasDe = (w: World, tile: number): number => {
  let k = 0;
  for (const t of w.tiles) if (t === tile) k++;
  return k;
};

describe('colocar el campo', () => {
  it('el lote es 2×2 y ocupa las cuatro celdas', () => {
    const w = flat();
    poner(w, 'farm', 5, 5);
    expect(w.farms).toEqual([{ x: 5, y: 5, crop: 'trigo' }]);
    expect(celdasDe(w, TILE.FARM)).toBe(FARM_SIZE * FARM_SIZE);
    expect(w.tiles[w.idx(6, 6)]).toBe(TILE.FARM);
  });

  it('el silo es 2×2 y la feria 3×3', () => {
    const w = flat();
    poner(w, 'silo', 3, 3);
    poner(w, 'market', 10, 3);
    expect(celdasDe(w, TILE.SILO)).toBe(SILO_SIZE * SILO_SIZE);
    expect(celdasDe(w, TILE.MARKET)).toBe(MARKET_SIZE * MARKET_SIZE);
    expect(w.silos[0].tons).toBe(0);
    expect(w.markets).toEqual([{ x: 10, y: 3 }]);
  });

  it('cada pieza cuesta lo que dice el catálogo', () => {
    expect(plan(flat(), 'farm', 4, 4).cost).toBe(COSTS.farm);
    expect(plan(flat(), 'silo', 4, 4).cost).toBe(COSTS.silo);
    expect(plan(flat(), 'market', 4, 4).cost).toBe(COSTS.market);
  });

  it('no se coloca sobre el agua', () => {
    const w = flat();
    // Una laguna de 4×4 en el medio del terreno seco.
    for (let y = 4; y < 8; y++) for (let x = 4; x < 8; x++) w.terrain.corners[(y) * (N + 1) + x] = SEA_LEVEL - 2;
    expect(plan(w, 'farm', 5, 5).cells).toEqual([]);
    expect(plan(w, 'silo', 5, 5).cells).toEqual([]);
    expect(plan(w, 'market', 5, 5).cells).toEqual([]);
  });

  it('no se coloca sobre algo construido', () => {
    const w = flat();
    w.setTile(6, 6, TILE.R, 2);
    // El lote de (5,5) pisaría (6,6): no entra.
    expect(plan(w, 'farm', 5, 5).cells).toEqual([]);
    // Corrido una celda, sí.
    expect(plan(w, 'farm', 7, 7).cells.length).toBe(FARM_SIZE * FARM_SIZE);
  });

  it('el lote no pide tendido ni calle para colocarse', () => {
    // Es la mitad del argumento de S1: si el campo pidiera luz, el jugador lo pondría pegado al tendido y el
    // alejamiento no saldría del juego. La otra mitad —que produzca sin acceso— se prueba con la cosecha.
    const w = flat();
    const p = plan(w, 'farm', 20, 20);
    expect(p.cells.length).toBe(FARM_SIZE * FARM_SIZE);
    let luzCerca = false;
    for (const t of w.tiles) if (t === TILE.LINE || t === TILE.ROAD) luzCerca = true;
    expect(luzCerca).toBe(false);
  });

  it('las tres piezas se pueden tocar entre sí', () => {
    // Un lote contra un silo contra una feria: la cadena se arma en el mapa sin calle en el medio.
    const w = flat();
    poner(w, 'farm', 4, 4);
    poner(w, 'silo', 6, 4);
    poner(w, 'market', 8, 4);
    expect([w.farms.length, w.silos.length, w.markets.length]).toEqual([1, 1, 1]);
  });
});

describe('demoler el campo', () => {
  it('un lote se va entero con una sola celda demolida', () => {
    const w = flat();
    poner(w, 'farm', 5, 5);
    poner(w, 'bulldoze', 5, 5);
    expect(w.farms).toEqual([]);
    expect(celdasDe(w, TILE.FARM)).toBe(0);
  });

  it('demoler un silo tira lo que tenía adentro', () => {
    // Si la carga sobreviviera al silo, el stock de la ciudad no cerraría con lo que hay en el mapa.
    const w = flat();
    poner(w, 'silo', 5, 5);
    w.silos[0].tons = 80;
    poner(w, 'bulldoze', 6, 6);
    expect(w.silos).toEqual([]);
  });

  it('demoler una feria la saca del mapa', () => {
    const w = flat();
    poner(w, 'market', 5, 5);
    poner(w, 'bulldoze', 7, 7);
    expect(w.markets).toEqual([]);
  });
});

describe('las herramientas del campo en la barra', () => {
  it('están en la barra, con su grupo y su tecla', () => {
    const grupo = TOOL_GROUPS.find((g) => g.id === 'campo');
    expect(grupo?.tools).toEqual(['farm', 'silo', 'market']);
    for (const id of ['farm', 'silo', 'market'] as const) {
      const info = TOOLS.find((t) => t.id === id);
      expect(info, `${id} no está en la barra`).toBeDefined();
      expect(info!.shape).toBe('anchor');
      expect(info!.key.length).toBe(1);
    }
  });

  it('las tres teclas son distintas de todas las demás', () => {
    const keys = TOOLS.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('el recuadro de la herramienta es el de la pieza', () => {
    expect(footprintOfTool('farm', N, 5, 5)?.length).toBe(FARM_SIZE * FARM_SIZE);
    expect(footprintOfTool('silo', N, 5, 5)?.length).toBe(SILO_SIZE * SILO_SIZE);
    expect(footprintOfTool('market', N, 5, 5)?.length).toBe(MARKET_SIZE * MARKET_SIZE);
    expect(footprintOfTool('zoneR', N, 5, 5)).toBeNull();
  });
});
