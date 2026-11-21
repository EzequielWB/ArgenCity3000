import { describe, expect, it } from 'vitest';
import { DIRT, MAX_BAND, ROAD_TIERS } from '../src/config';
import { TILE, World } from '../src/world/world';
import { generateMap } from '../src/world/mapkinds';
import { analyzeRoads, tierOf } from '../src/render/avenue';
import { applyPlan, dragCells, planTool } from '../src/world/tools';
import { Simulation, newSimState } from '../src/sim/simulation';
import { describeCell } from '../src/sim/report';

const N = 24;

/** Una avenida de `lanes` calzadas de tierra que corre a lo largo de y, desde y0 hasta y1. */
function avenue(lanes: number, tier: number = DIRT) {
  const w = new World(generateMap(5, N, 'plain'));
  for (let y = 5; y <= 18; y++) {
    for (let k = 0; k < lanes; k++) {
      const i = w.idx(10 + k, y);
      w.tiles[i] = TILE.ROAD;
      w.roadTier[i] = tier;
    }
  }
  return w;
}

/** El plan del jugador: arrastra de (ax,ay) a (bx,by) con una herramienta de calle. */
const planOf = (w: World, tool: 'road' | 'roadBoulevard' | 'roadDirt', ax: number, ay: number, bx: number, by: number) =>
  planTool(w, tool, dragCells(tool, ax, ay, bx, by, 1, N));

/** Lo que el render va a dibujar en una celda (el tier de la banda, que es el de su calzada más débil). */
const drawn = (w: World, x: number, y: number): number => {
  const codes = analyzeRoads((cx, cy) => w.tiles[cy * N + cx] === TILE.ROAD, N, (cx, cy) => w.roadTier[cy * N + cx] as 0 | 1 | 2 | 3);
  return tierOf(codes[w.idx(x, y)]);
};

describe('mejorar una avenida', () => {
  /**
   * S1: lo que reportó el jugador. Antes, arrastrar el bulevar por la calzada del medio dejaba las otras
   * dos en tierra y la banda seguía dibujándose de tierra: el dato decía «Bulevar» y el mapa, no.
   */
  it('mejora todas las calzadas de la cuadra de una vez', () => {
    const w = avenue(3);
    const plan = planOf(w, 'roadBoulevard', 11, 5, 11, 18);
    applyPlan(w, plan);
    for (const x of [10, 11, 12]) {
      expect(w.roadTier[w.idx(x, 10)]).toBe(2);
      expect(drawn(w, x, 10)).toBe(2);
    }
  });

  /** Y el costo es el de las tres calzadas: nadie mejora una avenida pagando una. */
  it('cobra cada calzada que mejora', () => {
    const w = avenue(3);
    const plan = planOf(w, 'roadBoulevard', 11, 5, 11, 18);
    const filas = 18 - 5 + 1;
    expect(plan.cells.length).toBe(filas * 3);
    expect(plan.cost).toBe(filas * 3 * (ROAD_TIERS[2].cost - ROAD_TIERS[DIRT].cost));
  });

  /**
   * S2: la sección nunca baja de calidad. Pintar asfalto sobre un bulevar no lo rompe, aunque el plan
   * informe que la calzada ya estaba mejor.
   */
  it('no degrada una calzada mejor', () => {
    const w = avenue(3, 2);
    applyPlan(w, planOf(w, 'road', 11, 5, 11, 18));
    for (const x of [10, 11, 12]) expect(w.roadTier[w.idx(x, 10)]).toBe(2);
  });

  /** S4: una calle de una sola calzada se comporta como siempre. */
  it('una calle suelta se mejora sola', () => {
    const w = avenue(1);
    applyPlan(w, planOf(w, 'roadBoulevard', 10, 5, 10, 18));
    expect(w.roadTier[w.idx(10, 10)]).toBe(2);
  });

  /** Una sección más ancha que `MAX_BAND` no se toca entera: es una playa de estacionamiento, no una calle. */
  it('no arrastra una sección absurdamente ancha', () => {
    const w = avenue(MAX_BAND + 2);
    applyPlan(w, planOf(w, 'roadBoulevard', 10, 5, 10, 18));
    expect(planCells(w)).toBeLessThanOrEqual(MAX_BAND);
  });

  /**
   * S3: el consultar y el dibujo no pueden contradecirse. Si un save viejo quedó con una avenida mezclada,
   * la tarjeta informa lo que se ve, no lo que dice la celda.
   */
  it('el consultar informa la calidad que se dibuja', () => {
    const w = avenue(3);
    // Un estado mezclado, como el de cualquier partida anterior a este arreglo.
    w.roadTier[w.idx(11, 10)] = 2;
    expect(drawn(w, 11, 10)).toBe(DIRT);
    const sim = new Simulation(w, newSimState(5), 'Villa');
    sim.refresh();
    const card = describeCell(w, sim, 11, 10);
    expect(card.lines.join(' ')).toContain(ROAD_TIERS[DIRT].label);
    expect(card.lines.join(' ')).not.toContain(ROAD_TIERS[2].label);
  });
});

/** Cuántas celdas distintas toca un plan de una calzada en una sección ancha. */
function planCells(w: World): number {
  return planOf(w, 'roadBoulevard', 10, 5, 10, 18).cells.length / (18 - 5 + 1);
}
