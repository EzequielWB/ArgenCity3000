import { describe, expect, it } from 'vitest';
import { CROPS, MERMA, PRICE_RANGE, harvestMonth, priceOf, priceTable, spoil, tonsToSell, type SellOrder } from '../src/sim/campo';

const orden = (minPrice: number, keepTons: number): SellOrder => ({ minPrice, keepTons });

describe('el calendario del campo', () => {
  it('el trigo se cosecha en diciembre y en ningún otro mes', () => {
    const meses = Array.from({ length: 12 }, (_, k) => harvestMonth(k + 1));
    expect(CROPS.trigo.harvest).toBe(12);
    expect(meses.filter(Boolean)).toEqual([true]);
    expect(harvestMonth(CROPS.trigo.harvest)).toBe(true);
  });

  it('la siembra es antes de la cosecha, en el mismo año del ciclo', () => {
    expect(CROPS.trigo.sow).toBeLessThan(CROPS.trigo.harvest);
  });
});

describe('el precio del trigo', () => {
  it('toca el piso en cosecha y el techo en invierno', () => {
    // Es la forma que hace que el silo sirva: todos venden en diciembre, nadie tiene nada en junio.
    expect(priceOf(12)).toBe(PRICE_RANGE.low);
    expect(priceOf(6)).toBe(PRICE_RANGE.high);
    expect(PRICE_RANGE.low).toBe(120);
    expect(PRICE_RANGE.high).toBe(180);
  });

  it('sube de la cosecha al invierno y baja del invierno a la cosecha, sin serrucho', () => {
    const p = priceTable();
    const sube = p.slice(11).concat(p.slice(0, 6)); // diciembre → junio
    const baja = p.slice(5); // junio → diciembre, sin cruzar el año
    for (let k = 1; k < sube.length; k++) expect(sube[k], `sube en el mes ${k}`).toBeGreaterThan(sube[k - 1]);
    for (let k = 1; k < baja.length; k++) expect(baja[k], `baja en el mes ${k}`).toBeLessThan(baja[k - 1]);
  });

  it('el precio de un mes no depende de cuándo se pregunta', () => {
    // La curva es del calendario, no del estado: si dependiera del tick, dos partidas con el mismo mes
    // pagarían distinto y el jugador no podría aprender el ciclo.
    expect(priceTable()).toEqual(Array.from({ length: 12 }, (_, k) => priceOf(k + 1)));
  });
});

describe('la orden de venta', () => {
  it('con el precio por debajo del mínimo no vende un kilo', () => {
    expect(tonsToSell(200, 119, orden(150, 0), 120)).toBe(0);
  });

  it('con el precio justo en el mínimo vende', () => {
    expect(tonsToSell(200, 150, orden(150, 0), 120)).toBeGreaterThan(0);
  });

  it('nunca baja de la retención', () => {
    // 200 toneladas, 50 que no se tocan: hay 150 vendibles.
    expect(tonsToSell(200, 180, orden(150, 50), 500)).toBe(150);
    // Con stock por debajo de la retención no hay nada para vender, por más que el precio sea bueno.
    expect(tonsToSell(30, 180, orden(0, 50), 500)).toBe(0);
  });

  it('la feria no convierte más de lo que puede', () => {
    expect(tonsToSell(200, 180, orden(0, 0), 120)).toBe(120);
  });

  it('sin feria no se vende nada', () => {
    expect(tonsToSell(200, 180, orden(0, 0), 0)).toBe(0);
  });
});

describe('la merma', () => {
  it('se come un porcentaje del stock', () => {
    expect(MERMA).toBeGreaterThan(0);
    expect(spoil(1000)).toBe(1000 - Math.round(1000 * MERMA));
  });

  it('no inventa toneladas ni devuelve negativos', () => {
    expect(spoil(0)).toBe(0);
    expect(spoil(1)).toBeGreaterThanOrEqual(0);
    expect(spoil(-5)).toBe(0);
  });

  it('doce meses esperando dejan menos de lo que había, aunque no se venda nada', () => {
    // El criterio de aceptación de S6: guardar cuesta. Si esperar fuera gratis, la orden óptima sería
    // pedir el máximo y no vender nunca.
    let stock = 1000;
    for (let m = 0; m < 12; m++) stock = spoil(stock);
    expect(stock).toBeLessThan(1000);
    expect(stock).toBeGreaterThan(500);
  });
});
