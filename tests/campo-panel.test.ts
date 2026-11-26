import { describe, expect, it } from 'vitest';
import { CROPS, MARKET_THROUGHPUT, SILO_CAPACITY, TICKS_PER_MONTH, UPKEEP } from '../src/config';
import { campoStatusHtml, campoAdviceHtml, priceTableHtml } from '../src/ui/campo';
import { campoBroken } from '../src/world/farms';
import { Simulation, newSimState } from '../src/sim/simulation';
import { SEA_LEVEL } from '../src/world/terrain';
import { applyPlan, dragCells, planTool } from '../src/world/tools';
import { World } from '../src/world/world';

const N = 32;
const TONS = CROPS.trigo.tons;

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

const sinOrden = { minPrice: 0, keepTons: 0 };

describe('el estado de la cadena', () => {
  it('cuenta lotes, silos y ferias, con lo que hay guardado y lo que entra', () => {
    const w = campo(4, 1, 1);
    w.silos[0]!.tons = 40;
    const html = campoStatusHtml(w);
    expect(html).toContain('4 lotes');
    expect(html).toContain(`40 de ${SILO_CAPACITY} t`);
    expect(html).toContain(`${MARKET_THROUGHPUT} t por mes`);
  });

  it('avisa cuando hay trigo pero no hay dónde guardarlo', () => {
    const w = campo(4, 0, 1);
    expect(campoAdviceHtml(w, 7, sinOrden)).toContain('silo');
  });

  it('avisa cuando hay trigo guardado pero no hay quien lo venda', () => {
    const w = campo(4, 1, 0);
    w.silos[0]!.tons = 100;
    expect(campoAdviceHtml(w, 7, sinOrden)).toContain('feria');
  });

  it('compara aguantar hasta el pico contra lo que se come la merma', () => {
    const w = campo(4, 1, 1);
    const html = campoAdviceHtml(w, 12, sinOrden);
    // Seis meses de guarda al 4 %: 0.96^6 = 0.783, o sea la merma se lleva un 22 %.
    expect(html).toContain('Junio');
    expect(html).toContain('22');
  });

  it('sin campo no hay nada que avisar', () => {
    const w = campo(0, 0, 0);
    expect(campoAdviceHtml(w, 7, sinOrden)).toBe('');
  });

  it('dice cuánto entra este mes y a qué precio, y cuánto se vendería', () => {
    const w = campo(4, 1, 1);
    const html = campoAdviceHtml(w, 12, sinOrden);
    expect(html).toContain(`${4 * TONS} toneladas`);
    // Diciembre es el piso del año: vender lo que entra deja $120 por tonelada.
    expect(html).toMatch(/\$ 120/);
  });

  it('en un mes que no es de cosecha no promete toneladas', () => {
    const w = campo(4, 1, 1);
    expect(campoAdviceHtml(w, 7, sinOrden)).not.toContain('toneladas');
  });

  it('con la orden de no bajar de un precio alto, avisa que no se vende', () => {
    const w = campo(4, 1, 1);
    const html = campoAdviceHtml(w, 12, { minPrice: 170, keepTons: 0 });
    expect(html).toContain('no vende');
  });
});

describe('la tabla de precios del año', () => {
  it('tiene los doce meses, marca el que corre y el de cosecha', () => {
    const html = priceTableHtml(7, 0);
    for (const mes of ['Enero', 'Julio', 'Diciembre']) expect(html).toContain(mes);
    expect(html).toContain('ahora');
    expect(html).toContain('cosecha');
  });

  it('el precio más alto del año es el de invierno y el más bajo el de la cosecha', () => {
    const html = priceTableHtml(7, 0);
    const precios = [...html.matchAll(/\$ ?(\d+)/g)].map((m) => Number(m[1]));
    const junio = precios[5];
    const diciembre = precios[11];
    expect(junio).toBeGreaterThan(diciembre);
    expect(Math.max(...precios)).toBe(junio);
    expect(Math.min(...precios)).toBe(diciembre);
  });

  it('la presión de oferta baja los precios de la tabla', () => {
    // La presión se mide en toneladas volcadas, no en una fracción: 2000 es el punto de saturación, y ahí el
    // mercado paga poco más de la mitad en todos los meses, también en el piso de la estación.
    const limpio = [...priceTableHtml(7, 0).matchAll(/\$ ?(\d+)/g)].map((m) => Number(m[1]));
    const cargado = [...priceTableHtml(7, 2000).matchAll(/\$ ?(\d+)/g)].map((m) => Number(m[1]));
    for (let i = 0; i < 12; i++) expect(cargado[i], `mes ${i + 1}`).toBeLessThan(limpio[i]);
  });
});

describe('la orden decide la venta y se puede cambiar', () => {
  it('el panel usa la orden que el jugador fijó, no una propia', () => {
    const w = campo(4, 1, 1);
    const flojo = campoAdviceHtml(w, 12, { minPrice: 0, keepTons: 0 });
    const duro = campoAdviceHtml(w, 12, { minPrice: 200, keepTons: 0 });
    expect(flojo).not.toBe(duro);
  });

  it('la orden se redondea y no acepta negativos', () => {
    const sim = new Simulation(campo(1, 1, 1), newSimState(3, 'democracia'), 'X');
    sim.setSellOrder({ minPrice: 120.7, keepTons: -5 });
    expect(sim.state.order).toEqual({ minPrice: 121, keepTons: 0 });
  });

  it('la orden sobrevive el guardado y el cierre del mes la respeta', () => {
    const sim = new Simulation(campo(4, 1, 1), newSimState(3, 'democracia'), 'Villa Trigal');
    sim.setSellOrder({ minPrice: 175, keepTons: 0 });
    for (let k = 0; k < 12 * TICKS_PER_MONTH; k++) sim.tick();
    expect(sim.state.harvest!.sold).toBe(0);
    expect(sim.state.order).toEqual({ minPrice: 175, keepTons: 0 });
  });

  it('el mantenimiento que muestra el panel es el que se cobra', () => {
    const w = campo(4, 1, 1);
    const html = campoStatusHtml(w);
    expect(html).toContain(`$${UPKEEP.silo + UPKEEP.market}`);
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

  it('el silo sin feria y sin lotes ni trigo no es un problema todavía', () => {
    expect(campoBroken(campo(0, 1, 0))).toBeNull();
  });
});

describe('las clases del panel no pisan la barra de arriba', () => {
  /**
   * La chapa de la top bar usa `.tag` para sus etiquetas («Caja», «Población», «Aprobación»). Los sellos
   * del campo nacieron con la misma clase y su `border: 2px solid #000` se aplicó a las tres chapas, que
   * quedaron con un recuadro negro que nadie pidió. La clase es `campo-tag` y no puede volver a `tag`.
   */
  it('los sellos de la tabla de precios usan su propia clase', () => {
    const html = priceTableHtml(12, 7);
    expect(html).toContain('campo-tag');
    expect(html).not.toMatch(/class="tag[ "]/);
  });
});
