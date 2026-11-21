import { describe, expect, it } from 'vitest';
import { CROPS, MARKET_THROUGHPUT, SILO_CAPACITY, TICKS_PER_MONTH } from '../src/config';
import { MERMA, PRICE_RANGE, harvestNews, previewHarvest, settleHarvest, spoil, tonsToSell, type SellOrder } from '../src/sim/campo';
import { Simulation, newSimState } from '../src/sim/simulation';
import { budgetTable } from '../src/ui/panels';
import type { BudgetReport } from '../src/sim/budget';
import { storedTons } from '../src/world/farms';
import { SEA_LEVEL } from '../src/world/terrain';
import { applyPlan, dragCells, planTool } from '../src/world/tools';
import { World } from '../src/world/world';

const N = 40;

const flat = (): World => new World({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(N * N) });

const HARVEST = CROPS.trigo.harvest;
const TONS = CROPS.trigo.tons;

/** El jugador que vende todo apenas puede: el default. */
const VENDER_SIEMPRE: SellOrder = { minPrice: 0, keepTons: 0 };

/** Un mundo con la cadena puesta: `farms` lotes, `silos` silos y `ferias` ferias, todo sobre tierra libre. */
function campo(farms: number, silos: number, ferias: number): World {
  const world = flat();
  const build = (tool: Parameters<typeof planTool>[1], ax: number, ay: number) =>
    applyPlan(world, planTool(world, tool, dragCells(tool, ax, ay, ax, ay, 1, N)));
  for (let k = 0; k < farms; k++) build('farm', 2 + (k % 6) * 3, 2 + Math.floor(k / 6) * 3);
  for (let k = 0; k < silos; k++) build('silo', 20 + k * 3, 2);
  for (let k = 0; k < ferias; k++) build('market', 20 + k * 4, 20);
  return world;
}

describe('la cosecha', () => {
  it('en el mes de cosecha el stock sube de golpe; en los otros once no', () => {
    const w = campo(3, 1, 0);
    // Con la feria en cero no se vende nada, así que el stock es pura cosecha.
    for (let m = 1; m <= 12; m++) {
      const before = storedTons(w);
      const r = settleHarvest(w, m, VENDER_SIEMPRE);
      if (m === HARVEST) {
        expect(r.grown, `mes ${m}`).toBe(3 * TONS);
        // La merma corre antes, así que lo que había guardado bajó un poco antes de sumar la cosecha.
        expect(storedTons(w)).toBe(spoil(before) + 3 * TONS);
      } else {
        expect(r.grown, `mes ${m}`).toBe(0);
        // Lo guardado sólo baja, por la merma.
        expect(storedTons(w), `mes ${m}`).toBeLessThanOrEqual(before);
      }
    }
  });

  it('sin silo la cosecha se pierde y se dice cuánto', () => {
    const w = campo(4, 0, 1);
    const r = settleHarvest(w, HARVEST, VENDER_SIEMPRE);
    expect(r.grown).toBe(4 * TONS);
    expect(r.lost).toBe(4 * TONS);
    expect(storedTons(w)).toBe(0);
    expect(r.sold).toBe(0);
    expect(r.income).toBe(0);
  });

  it('sin feria el campo produce y la ciudad no ve un peso', () => {
    const w = campo(4, 2, 0);
    const r = settleHarvest(w, HARVEST, VENDER_SIEMPRE);
    expect(storedTons(w)).toBe(4 * TONS);
    expect(r.sold).toBe(0);
    expect(r.income).toBe(0);
  });

  it('lo que no entra en los silos no se guarda y queda contado como perdido', () => {
    // Treinta lotes son 900 t y un silo guarda 200: entran 200 y el resto se pierde.
    const w = campo(30, 1, 0);
    const r = settleHarvest(w, HARVEST, VENDER_SIEMPRE);
    expect(r.grown).toBe(30 * TONS);
    expect(storedTons(w)).toBe(SILO_CAPACITY);
    expect(r.lost).toBe(30 * TONS - SILO_CAPACITY);
  });

  it('la feria no convierte más de lo que puede por mes', () => {
    const w = campo(4, 3, 1);
    w.silos[0]!.tons = SILO_CAPACITY;
    w.silos[1]!.tons = SILO_CAPACITY;
    w.silos[2]!.tons = SILO_CAPACITY;
    const r = settleHarvest(w, 2, VENDER_SIEMPRE);
    expect(r.sold).toBe(MARKET_THROUGHPUT);
    expect(r.income).toBe(MARKET_THROUGHPUT * r.price);
    // La merma del mes se comió su parte antes de vender: 600 llenos pierden 24 y el resto se vende.
    expect(storedTons(w)).toBe(3 * SILO_CAPACITY - r.spoiled - r.sold);
  });
});

describe('la orden de venta', () => {
  it('con el mínimo alto el silo no vende un kilo', () => {
    const w = campo(2, 1, 1);
    w.silos[0]!.tons = 100;
    const r = settleHarvest(w, 2, { minPrice: PRICE_RANGE.high + 50, keepTons: 0 });
    expect(r.sold).toBe(0);
    expect(r.income).toBe(0);
    // No se vende, pero la merma igual corre: es lo que cuesta esperar un precio que no llega.
    expect(storedTons(w)).toBe(spoil(100));
  });

  it('con el mínimo bajo vende hasta la retención y se detiene justo ahí', () => {
    const w = campo(2, 1, 1);
    w.silos[0]!.tons = 100;
    // La merma del mes corre antes que la venta: de 100 quedan 96, se venden 26 y la retención de 70 se respeta.
    const r = settleHarvest(w, 2, { minPrice: 0, keepTons: 70 });
    expect(r.spoiled).toBe(4);
    expect(r.sold).toBe(26);
    expect(storedTons(w)).toBe(70);
  });

  it('la retención no puede ser más grande que la capacidad del silo', () => {
    // Si el jugador retiene 500 t y el silo guarda 200, la orden no vende nunca y la cosecha no entra: con la
    // merma, al silo lleno sólo le quedan ocho toneladas de lugar y el resto se pierde.
    const w = campo(2, 1, 1);
    w.silos[0]!.tons = SILO_CAPACITY;
    const r = settleHarvest(w, HARVEST, { minPrice: 0, keepTons: 500 });
    expect(r.spoiled).toBe(8);
    expect(r.sold).toBe(0);
    expect(r.lost).toBe(2 * TONS - (SILO_CAPACITY - 192));
  });
});

describe('guardar cuesta', () => {
  it('doce meses en el máximo dejan menos stock por la merma', () => {
    let stock = 1000;
    for (let k = 0; k < 12; k++) stock = spoil(stock);
    expect(stock).toBeLessThan(700);
    expect(stock).toBeGreaterThan(500);
  });

  it('aguantar doce meses cobra menos que vender en el pico, y el stock termina menor', () => {
    // El que vendió en junio: un pico de $180 la tonelada, con la feria trabajando un solo mes.
    const w = campo(4, 3, 1);
    for (const s of w.silos) s.tons = SILO_CAPACITY;
    const junio = settleHarvest(w, 6, VENDER_SIEMPRE);
    expect(junio.price).toBe(PRICE_RANGE.high);
    expect(junio.income).toBeGreaterThan(0);
    // El que pidió el cielo: doce meses sin vender, y la merma comiéndose el stock mes a mes.
    const w2 = campo(4, 3, 1);
    for (const s of w2.silos) s.tons = SILO_CAPACITY;
    let cobrado = 0;
    for (let m = 1; m <= 12; m++) cobrado += settleHarvest(w2, m, { minPrice: 99999, keepTons: 0 }).income;
    expect(cobrado).toBe(0);
    expect(cobrado).toBeLessThan(junio.income);
    // Y el stock que le queda es menor que el que tenía: la merma sola alcanza para castigar la espera.
    expect(storedTons(w2)).toBeLessThan(3 * SILO_CAPACITY);
  });
});

describe('el precio responde a lo que la ciudad vende', () => {
  it('vender deja presión, y la presión ablanda el precio del mismo mes', () => {
    // La estacionalidad manda: febrero vale menos que marzo. Así que la presión no se prueba comparando dos
    // meses seguidos (el calendario la taparía), sino el mismo mes con y sin la venta de antes.
    const w = campo(4, 3, 1);
    for (const s of w.silos) s.tons = SILO_CAPACITY;
    const r1 = settleHarvest(w, 2, VENDER_SIEMPRE);
    expect(r1.sold).toBeGreaterThan(0);
    expect(w.farmPressure).toBeGreaterThan(0);
    const limpio = campo(4, 3, 1);
    for (const s of limpio.silos) s.tons = SILO_CAPACITY;
    const r2 = settleHarvest(w, 2, VENDER_SIEMPRE);
    const r3 = settleHarvest(limpio, 2, VENDER_SIEMPRE);
    expect(r2.price).toBeLessThan(r3.price);
  });

  it('la presión se va sola: sin ventas, vuelve cerca de cero', () => {
    const w = campo(0, 1, 0);
    w.farmPressure = 2000;
    for (let m = 1; m <= 12; m++) settleHarvest(w, m, VENDER_SIEMPRE);
    expect(w.farmPressure).toBeLessThan(50);
  });
});

describe('la plata del campo en el presupuesto', () => {
  const pueblo = (): Simulation => {
    const world = campo(4, 2, 1);
    const sim = new Simulation(world, newSimState(3, 'democracia'), 'Villa Trigal');
    sim.report('Nota de color: el Intendente inauguró una plaza.');
    return sim;
  };

  it('la cosecha de diciembre entra a la caja como ingreso del mes', () => {
    const sim = pueblo();
    // Once meses hasta noviembre, con la caja anotada.
    for (let k = 0; k < 11 * TICKS_PER_MONTH; k++) sim.tick();
    expect(sim.world.farms.length).toBe(4);
    // Diciembre: al cerrar el mes se cosecha y la feria vende.
    for (let k = 0; k < TICKS_PER_MONTH; k++) sim.tick();
    expect(sim.state.harvest).not.toBeNull();
    expect(sim.state.harvest!.grown).toBeGreaterThan(0);
    expect(sim.state.harvest!.sold).toBeGreaterThan(0);
    expect(sim.state.lastBudget!.farmIncome).toBe(sim.state.harvest!.income);
    expect(sim.state.lastBudget!.farmIncome).toBeGreaterThan(0);
  });

  it('el balance del mes cierra con el ingreso del campo adentro', () => {
    const sim = pueblo();
    for (let k = 0; k < 12 * TICKS_PER_MONTH; k++) sim.tick();
    const b = sim.state.lastBudget!;
    const income = b.taxR + b.taxC + b.taxI + b.hubIncome + b.coastIncome + b.uniqueIncome + b.farmIncome;
    const expenses = b.roads + b.lines + b.parks + b.plants + b.services + b.schools + b.clinics + b.police + b.firefighters + b.hospitals + b.universities + b.loan + b.transport + b.hubs + b.coast + b.uniques + b.farmUpkeep;
    expect(income - expenses).toBe(b.balance);
  });
});

describe('la orden se guarda', () => {
  it('el jugador fija los dos umbrales y sobreviven al guardado', () => {
    const sim = new Simulation(campo(2, 1, 1), newSimState(3, 'democracia'), 'Villa Trigal');
    sim.setSellOrder({ minPrice: 150, keepTons: 40 });
    expect(sim.state.order).toEqual({ minPrice: 150, keepTons: 40 });
  });

  it('la merma es la del módulo, no la del que llama', () => {
    // 100 t con la merma del 4 % pierden 4, y el resultado se redondea.
    expect(spoil(100)).toBe(96);
    expect(spoil(0)).toBe(0);
    expect(spoil(25)).toBe(24);
    expect(MERMA).toBe(0.04);
  });

  it('tonsToSell nunca devuelve más que el stock', () => {
    expect(tonsToSell(10, 180, { minPrice: 0, keepTons: 0 }, 999)).toBe(10);
    expect(tonsToSell(10, 180, { minPrice: 0, keepTons: 10 }, 999)).toBe(0);
  });
});

describe('el diario cuenta la cosecha', () => {
  it('la nota dice cuánto se cosechó, cuánto se vendió y a qué precio', () => {
    const r = { month: 12, price: 120, grown: 120, lost: 0, spoiled: 0, sold: 120, income: 14400 };
    const line = harvestNews(r)!;
    expect(line).toContain('120 toneladas de trigo');
    expect(line).toContain('vendió 120 a $120');
    expect(line).toContain('14.400');
  });

  it('avisa cuando la cosecha no entró y cuando la merma se llevó su parte', () => {
    const line = harvestNews({ month: 12, price: 120, grown: 300, lost: 100, spoiled: 8, sold: 0, income: 0 })!;
    expect(line).toContain('100 se perdieron');
    expect(line).toContain('la merma se llevó 8');
  });

  it('un mes sin campo, sin venta y sin merma no es noticia', () => {
    expect(harvestNews({ month: 3, price: 150, grown: 0, lost: 0, spoiled: 0, sold: 0, income: 0 })).toBeNull();
  });

  it('en el cierre de diciembre la noticia está en el diario', () => {
    const sim = new Simulation(campo(4, 2, 1), newSimState(3, 'democracia'), 'Villa Trigal');
    sim.report('Nota de color.');
    for (let k = 0; k < 12 * TICKS_PER_MONTH; k++) sim.tick();
    expect(sim.state.news.some((n) => n.text.startsWith('El campo:'))).toBe(true);
  });
});

describe('el panel pronostica sin cobrar', () => {
  it('el pronóstico es el mismo número que después se cobra', () => {
    const w = campo(4, 2, 1);
    w.silos[0]!.tons = 50;
    const dicho = previewHarvest(w, 12, { minPrice: 0, keepTons: 0 });
    const cobrado = settleHarvest(w, 12, { minPrice: 0, keepTons: 0 });
    expect(dicho).toEqual(cobrado);
  });

  it('mirar el pronóstico no gasta stock ni mueve el precio del mercado', () => {
    const w = campo(4, 2, 1);
    w.silos[0]!.tons = 100;
    w.farmPressure = 0.3;
    const antes = w.silos.map((s) => s.tons);
    previewHarvest(w, 12, { minPrice: 0, keepTons: 0 });
    previewHarvest(w, 6, { minPrice: 100, keepTons: 40 });
    expect(w.silos.map((s) => s.tons)).toEqual(antes);
    expect(w.farmPressure).toBe(0.3);
  });

  it('pronosticar dos veces seguidas da lo mismo: la primera no dejó basura', () => {
    const w = campo(2, 1, 1);
    const a = previewHarvest(w, 12, { minPrice: 0, keepTons: 0 });
    const b = previewHarvest(w, 12, { minPrice: 0, keepTons: 0 });
    expect(a).toEqual(b);
  });
});

describe('la planilla del presupuesto', () => {
  const base = (farm: { farmIncome: number; farmUpkeep: number }): BudgetReport => ({
    taxR: 100, taxC: 0, taxI: 0, roads: 0, lines: 0, parks: 0, plants: 0, services: 0,
    schools: 0, clinics: 0, police: 0, firefighters: 0, hospitals: 0, universities: 0,
    loan: 0, coast: 0, transport: 0, hubs: 0, hubIncome: 0, coastIncome: 0,
    uniques: 0, uniqueIncome: 0, ...farm,
    income: 100 + farm.farmIncome, expenses: farm.farmUpkeep, balance: 100 + farm.farmIncome - farm.farmUpkeep,
  });

  it('cuando hay campo, la cosecha entra en los ingresos y su mantenimiento en los gastos', () => {
    const html = budgetTable(base({ farmIncome: 14400, farmUpkeep: 100 }));
    expect(html).toContain('Cosecha');
    expect(html).toContain('14.400');
    expect(html).toContain('Silos y feria');
  });

  it('sin campo la planilla no gana dos filas en cero', () => {
    const html = budgetTable(base({ farmIncome: 0, farmUpkeep: 0 }));
    expect(html).not.toContain('Cosecha');
  });

  it('con silos pero sin cosecha la fila del gasto ya está y la del ingreso dice cero', () => {
    const html = budgetTable(base({ farmIncome: 0, farmUpkeep: 15 }));
    expect(html).toContain('Silos y feria');
    expect(html).toMatch(/Cosecha<\/td><td><span class="">\$ 0<\/span>/);
  });
});
