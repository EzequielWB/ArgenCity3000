import { describe, expect, it } from 'vitest';
import { FARM_SIZE, MARKET_SIZE, SILO_CAPACITY, SILO_SIZE } from '../src/config';
import { deserialize, fromBase64, serialize, toBase64 } from '../src/save/save';
import { newSimState } from '../src/sim/simulation';
import { SEA_LEVEL } from '../src/world/terrain';
import { marketAt, siloAt, siloRoom, storedTons, storeTons } from '../src/world/farms';
import { TILE, World } from '../src/world/world';
import { CROPS, MERMA, PRICE_OFFER, PRICE_RANGE, harvestMonth, nextPressure, priceOf, priceTable, spoil, tonsToSell, type SellOrder } from '../src/sim/campo';

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
    // La forma es del calendario: dos partidas con el mismo mes y la misma oferta pagan lo mismo, y el
    // jugador puede aprender el ciclo.
    expect(priceTable()).toEqual(Array.from({ length: 12 }, (_, k) => priceOf(k + 1)));
  });
});

describe('la oferta', () => {
  it('volcar mucho ablanda el precio del mismo mes', () => {
    const tranquilo = priceOf(6, 0);
    const cargado = priceOf(6, PRICE_OFFER.saturate);
    expect(cargado).toBeLessThan(tranquilo);
    expect(cargado).toBeGreaterThanOrEqual(Math.round(PRICE_RANGE.high * (1 - PRICE_OFFER.drop)) - 1);
  });

  it('la presión se acumula y decae sola', () => {
    // Vender 500 este mes suma; un mes sin vender la deja caer, no la congela.
    const uno = nextPressure(0, 500);
    expect(uno).toBe(500);
    expect(nextPressure(uno, 0)).toBeLessThan(uno);
    expect(nextPressure(uno, 0)).toBeGreaterThan(0);
  });

  it('la presión no es para siempre: dos años sin vender limpian el mercado', () => {
    let p = nextPressure(0, 5000);
    for (let k = 0; k < 24; k++) p = nextPressure(p, 0);
    expect(priceOf(6, p)).toBe(priceOf(6, 0));
  });

  it('por más oferta que haya, la tonelada no vale cero ni menos', () => {
    expect(priceOf(12, 1_000_000)).toBeGreaterThan(0);
  });

  it('vender repartido paga más que volcarlo todo de una vez', () => {
    // El criterio de aceptación de S4, y la razón de ser del silo: 900 toneladas cobran más en tres meses
    // de 300 que en uno solo. El precio de la venta incluye la venta misma —el que vuelca cobra el mercado
    // que él mismo ablandó—, así que el volcador no cobra el precio tranquilo de diciembre.
    const deUna = 900 * priceOf(12, nextPressure(0, 900));
    let presion = 0;
    let repartido = 0;
    for (const mes of [12, 1, 2]) {
      presion = nextPressure(presion, 300);
      repartido += 300 * priceOf(mes, presion);
    }
    expect(repartido).toBeGreaterThan(deUna);
  });

  it('el que vuelca cobra el mercado que él mismo ablandó', () => {
    // 900 de una sola vez pagan menos por tonelada que las primeras 300, aunque sea el mismo diciembre.
    const dia = priceOf(12, nextPressure(0, 300));
    const volcado = priceOf(12, nextPressure(0, 900));
    expect(volcado).toBeLessThan(dia);
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

const N = 40;

/** Un campo con un lote, un silo y una feria puestos a mano: T3 trae la colocación, acá se prueba el estado. */
function conCampo(): World {
  const w = new World({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(N * N) });
  const paint = (x: number, y: number, size: number, tile: number): void => {
    for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) w.tiles[(y + dy) * N + x + dx] = tile;
  };
  paint(4, 4, FARM_SIZE, TILE.FARM);
  paint(10, 4, SILO_SIZE, TILE.SILO);
  paint(16, 4, MARKET_SIZE, TILE.MARKET);
  w.farms.push({ x: 4, y: 4, crop: 'trigo' });
  w.silos.push({ x: 10, y: 4, tons: 120 });
  w.markets.push({ x: 16, y: 4 });
  w.farmPressure = 340;
  return w;
}

describe('el campo en el mundo', () => {
  it('encuentra cada pieza por la celda que pisa', () => {
    const w = conCampo();
    expect(w.farms.length).toBe(1);
    expect(w.silos.length).toBe(1);
    expect(w.markets.length).toBe(1);
    expect(siloAt(w, 11, 5)?.tons).toBe(120);
    expect(siloAt(w, 12, 5)).toBeNull();
    expect(marketAt(w, 18, 6)).not.toBeNull();
  });

  it('un lote de 2×2 ocupa cuatro celdas, no una', () => {
    // La regla de S1: el tamaño es lo que empuja el campo afuera. Si el lote fuera de una celda, el jugador
    // lo pondría entre dos casas y el alejamiento dejaría de existir.
    const w = conCampo();
    let celdas = 0;
    for (const t of w.tiles) if (t === TILE.FARM) celdas++;
    expect(celdas).toBe(FARM_SIZE * FARM_SIZE);
  });

  it('el stock es lo que suman los silos, y el lugar lo que suman sus capacidades', () => {
    const w = conCampo();
    expect(storedTons(w)).toBe(120);
    expect(siloRoom(w)).toBe(SILO_CAPACITY);
  });

  it('guardar más de lo que entra no pierde en silencio: devuelve lo que no entró', () => {
    const w = conCampo();
    const sobro = storeTons(w, 500);
    expect(w.silos[0].tons).toBe(SILO_CAPACITY);
    expect(sobro).toBe(500 - (SILO_CAPACITY - 120));
  });

  it('sin silos no entra nada y todo sobra', () => {
    const w = conCampo();
    w.silos = [];
    expect(storeTons(w, 100)).toBe(100);
    expect(storedTons(w)).toBe(0);
  });
});

describe('el campo en el guardado', () => {
  it('vuelve igual: lote, silo, feria, carga y presión de oferta', () => {
    const w = conCampo();
    const back = deserialize(serialize({ name: 'Campo', seed: 1, world: w, sim: newSimState(1) })).world;
    expect(back.farms).toEqual(w.farms);
    expect(back.silos).toEqual(w.silos);
    expect(back.markets).toEqual(w.markets);
    expect(back.farmPressure).toBe(340);
  });

  it('una ciudad guardada antes del campo carga con el campo vacío', () => {
    // El archivo crece, no se rompe: sacar las claves es lo que ve el guardado viejo.
    const w = conCampo();
    const data = JSON.parse(serialize({ name: 'Viejo', seed: 1, world: w, sim: newSimState(1) })) as Record<string, unknown>;
    delete data.farms;
    delete data.silos;
    delete data.markets;
    delete data.farmPressure;
    const back = deserialize(JSON.stringify(data)).world;
    expect(back.farms).toEqual([]);
    expect(back.silos).toEqual([]);
    expect(back.markets).toEqual([]);
    expect(back.farmPressure).toBe(0);
  });

  it('un lote sin sus cuatro celdas se rechaza', () => {
    const w = conCampo();
    const data = JSON.parse(serialize({ name: 'Roto', seed: 1, world: w, sim: newSimState(1) })) as Record<string, unknown>;
    // Se borra una celda del plano: el lote queda con tres y el archivo no cierra.
    const raw = fromBase64(data.tiles, N * N, 255, 'el plano');
    raw[4 * N + 5] = TILE.EMPTY;
    data.tiles = toBase64(raw);
    expect(() => deserialize(JSON.stringify(data))).toThrow(/cultivo|plano/i);
  });

  it('un silo con más carga de la que entra se rechaza', () => {
    const w = conCampo();
    w.silos[0].tons = SILO_CAPACITY + 1;
    expect(() => deserialize(serialize({ name: 'Roto', seed: 1, world: w, sim: newSimState(1) }))).toThrow(/silo/i);
  });
});
