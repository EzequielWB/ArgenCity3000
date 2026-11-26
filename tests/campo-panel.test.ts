import { describe, expect, it } from 'vitest';
import { MARKET_THROUGHPUT, SILO_CAPACITY, TICKS_PER_MONTH, UPKEEP } from '../src/config';
import { campoStatusHtml, lastHarvestHtml, priceStripHtml } from '../src/ui/campo';
import { campoBroken } from '../src/world/farms';
import { deserialize, serialize } from '../src/save/save';
import { Simulation, newSimState } from '../src/sim/simulation';
import { SEA_LEVEL } from '../src/world/terrain';
import { applyPlan, dragCells, planTool } from '../src/world/tools';
import { World } from '../src/world/world';

const N = 32;

function campo(farms: number, silos: number, ferias: number, calle = true): World {
  const w = new World({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(N * N) });
  const plan = (tool: Parameters<typeof planTool>[1], ax: number, ay: number, bx = ax, by = ay) =>
    applyPlan(w, planTool(w, tool, dragCells(tool, ax, ay, bx, by, 1, N)));
  for (let k = 0; k < farms; k++) plan('farm', 2 + k * 3, 2);
  for (let k = 0; k < silos; k++) plan('silo', 20, 2 + k * 3);
  for (let k = 0; k < ferias; k++) plan('market', 24, 20 + k * 4);
  if (calle) {
    // Una calle por fila de lotes, unida con la cadena por x=19: sin camino el camión no llega.
    const filas = Math.ceil(farms / 10);
    for (let r = 0; r < filas; r++) plan('road', 1, 4 + r * 3, 19, 4 + r * 3);
    plan('road', 19, 5, 19, 19);
    plan('road', 19, 20, 23, 20);
  }
  return w;
}

describe('el estado de la cadena', () => {
  it('cuenta lotes, silos y ferias, con lo que hay guardado y lo que entra', () => {
    const w = campo(4, 1, 1);
    w.silos[0]!.tons = 40;
    const html = campoStatusHtml(w);
    expect(html).toContain('4 lotes');
    expect(html).toContain(`40 de ${SILO_CAPACITY} t`);
    expect(html).toContain(`${MARKET_THROUGHPUT} t por mes`);
  });

  it('el mantenimiento que muestra el panel es el que se cobra', () => {
    const w = campo(4, 1, 1);
    const html = campoStatusHtml(w);
    expect(html).toContain(`$${UPKEEP.silo + UPKEEP.market + 4 * UPKEEP.farm}`);
  });
});

describe('el recibo del último cierre, en una línea', () => {
  it('dice el mes, lo cosechado, lo vendido y a qué precio', () => {
    const html = lastHarvestHtml({ month: 12, price: 120, grown: 12, soy: 0, climate: 1, unreached: 0, lost: 0, spoiled: 0, sold: 12, income: 1440 });
    expect(html).toContain('Diciembre');
    expect(html).toContain('12 t cosechadas');
    expect(html).toContain('12 vendidas a $ 120');
  });

  it('dice el clima y el camino cuando el año los castigó', () => {
    const html = lastHarvestHtml({ month: 12, price: 120, grown: 4, soy: 8, climate: 0.5, unreached: 8, lost: 0, spoiled: 0, sold: 4, income: 480 });
    expect(html).toContain('la sequía');
    expect(html).toContain('sin camino');
  });

  it('sin cierres todavía, lo dice', () => {
    expect(lastHarvestHtml(null)).toContain('Todavía');
  });
});

describe('la tira de precios del año', () => {
  const precios = (html: string): number[] => [...html.matchAll(/data-precio="(\d+)"/g)].map((m) => Number(m[1]));

  it('tiene las doce barras, marca el mes que corre y el de cosecha', () => {
    const html = priceStripHtml(7, 0);
    expect(precios(html)).toHaveLength(12);
    expect(html).toContain('ahora');
    expect(html).toContain('cosecha');
  });

  it('la barra más alta es la de invierno y la más baja la de cosecha', () => {
    const ps = precios(priceStripHtml(7, 0));
    expect(Math.max(...ps)).toBe(ps[5]);
    expect(Math.min(...ps)).toBe(ps[11]);
  });

  it('la presión de oferta baja los precios de la tira', () => {
    // 2000 toneladas volcadas es el punto de saturación: el mercado paga menos en todos los meses.
    const limpio = precios(priceStripHtml(7, 0));
    const cargado = precios(priceStripHtml(7, 2000));
    for (let i = 0; i < 12; i++) expect(cargado[i], `mes ${i + 1}`).toBeLessThan(limpio[i]);
  });

  it('los sellos usan su propia clase, no la chapa de la top bar', () => {
    const html = priceStripHtml(12, 7);
    expect(html).toContain('campo-tag');
    expect(html).not.toMatch(/class="tag[ "]/);
  });
});

describe('la orden y el perfil deciden la venta', () => {
  it('la orden se redondea y no acepta negativos', () => {
    const sim = new Simulation(campo(1, 1, 1), newSimState(3, 'democracia'), 'X');
    sim.setSellOrder({ minPrice: 120.7, keepTons: -5 });
    expect(sim.state.order).toEqual({ minPrice: 121, keepTons: 0 });
  });

  it('el perfil se redondea y no se va de rango', () => {
    const sim = new Simulation(campo(1, 1, 1), newSimState(3, 'democracia'), 'X');
    sim.setCampoRisk(150.6);
    expect(sim.state.campoRisk).toBe(100);
    sim.setCampoRisk(-5);
    expect(sim.state.campoRisk).toBe(0);
    sim.setCampoRisk(33.4);
    expect(sim.state.campoRisk).toBe(33);
  });

  it('la orden sobrevive el guardado y el cierre del mes la respeta', () => {
    const sim = new Simulation(campo(4, 1, 1), newSimState(3, 'democracia'), 'Villa Trigal');
    sim.setSellOrder({ minPrice: 175, keepTons: 0 });
    for (let k = 0; k < 12 * TICKS_PER_MONTH; k++) sim.tick();
    expect(sim.state.harvest!.sold).toBe(0);
    expect(sim.state.order).toEqual({ minPrice: 175, keepTons: 0 });
  });

  it('el perfil sobrevive el guardado', () => {
    const sim = new Simulation(campo(1, 1, 1), newSimState(3, 'democracia'), 'Villa Trigal');
    sim.setCampoRisk(60);
    const back = deserialize(serialize({ name: 'V', seed: 3, mayor: '', world: sim.world, sim: sim.state }));
    expect(back.sim.campoRisk).toBe(60);
  });
});

describe('qué le falta a la cadena', () => {
  it('sin campo no falta nada', () => {
    expect(campoBroken(campo(0, 0, 0))).toBeNull();
  });

  it('con lotes y sin silo, falta el silo', () => {
    expect(campoBroken(campo(4, 0, 1))).toBe('silo');
  });

  it('con lotes y sin feria, falta la feria', () => {
    expect(campoBroken(campo(4, 1, 0))).toBe('feria');
  });

  it('con trigo guardado y sin feria, también falta la feria', () => {
    const w = campo(0, 1, 0);
    w.silos[0]!.tons = 50;
    expect(campoBroken(w)).toBe('feria');
  });

  it('la cadena completa no debe nada', () => {
    expect(campoBroken(campo(4, 1, 1))).toBeNull();
  });

  it('con la cadena puesta pero sin camino, falta el camino', () => {
    expect(campoBroken(campo(4, 1, 1, false))).toBe('camino');
  });

  it('el silo sin feria y sin lotes ni trigo no es un problema todavía', () => {
    expect(campoBroken(campo(0, 1, 0))).toBeNull();
  });
});
