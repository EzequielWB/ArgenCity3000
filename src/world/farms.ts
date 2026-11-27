/**
 * El campo en el mundo: dónde está cada lote, cada silo y cada feria.
 *
 * Como las usinas y los únicos, cada pieza es una entrada de lista con su esquina de arriba a la izquierda, y
 * las celdas que ocupa llevan el tile que le corresponde. El stock no vive en el lote sino en los silos: un
 * lote produce y entrega, y lo que espera para venderse está en el silo, que es lo que se llena.
 */
import { FARM_SIZE, MARKET_SIZE, MARKET_THROUGHPUT, ROAD_REACH, SILO_CAPACITY, SILO_SIZE } from '../config';
import { TILE, type Farm, type Market, type Silo, type World } from './world';

export type Cell = [number, number];

/**
 * Lo mínimo que hace falta para mover toneladas: un mundo entero sirve, y también una **copia** de los silos.
 *
 * El panel de presupuesto tiene que pronosticar la cosecha del mes sin comerse el stock del jugador, así que
 * el cierre del mes corre sobre un clon y estas funciones no distinguen uno de otro. Mover el reparto a un
 * parámetro estructural es lo que evita tener dos reglas —una para el mundo y otra para el pronóstico— que
 * se desincronizan al primer cambio.
 */
export interface Silos {
  silos: Silo[];
}

export interface Markets {
  markets: Market[];
}

/** Lo mínimo para saber si la cadena está cortada: los lotes, los silos y las ferias. */
export interface Campo {
  farms: Farm[];
  silos: Silo[];
  markets: Market[];
}

/**
 * Qué le falta a la cadena para que el campo sirva: `'silo'`, `'feria'` o nada.
 *
 * Es una sola pregunta y no dos porque el aviso del mapa es uno solo: la estaca dice "acá hay un problema" y
 * el panel del campo dice cuál. Devuelve `null` en una ciudad sin campo, donde no hay cadena que cortar.
 */
export function campoBroken(w: World): 'silo' | 'feria' | 'camino' | null {
  if (w.farms.length === 0 && w.silos.length === 0 && w.markets.length === 0) return null;
  if (w.farms.length > 0 && w.silos.length === 0) return 'silo';
  if (w.markets.length === 0 && (w.farms.length > 0 || storedTons(w) > 0)) return 'feria';
  // El camión es el último eslabón: con silo y feria puestos, sin camino igual no llega nada.
  if (w.farms.length > 0 && farmServida(w).some((s) => !s)) return 'camino';
  return null;
}

/**
 * Las celdas que ocupa una pieza anclada en (x, y): siempre `size * size`, y el ancla **se corre hacia
 * adentro** si la pieza no entra, como la de una usina, un depósito o un servicio.
 *
 * Recortar en vez de correr era un bug caro: la feria puesta en la esquina pisaba una sola celda y se cobraba
 * los $600 enteros, y el dibujo de 3×3 quedaba colgado fuera del mapa. Con el ancla corrida, el plano que
 * devuelve `planTool` tiene las nueve celdas o se rechaza entero.
 */
function footprint(n: number, x: number, y: number, size: number): Cell[] {
  const fx = Math.min(Math.max(x, 0), n - size);
  const fy = Math.min(Math.max(y, 0), n - size);
  const cells: Cell[] = [];
  for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) cells.push([fx + dx, fy + dy]);
  return cells;
}

export const farmFootprint = (n: number, x: number, y: number): Cell[] => footprint(n, x, y, FARM_SIZE);
export const siloFootprint = (n: number, x: number, y: number): Cell[] => footprint(n, x, y, SILO_SIZE);
export const marketFootprint = (n: number, x: number, y: number): Cell[] => footprint(n, x, y, MARKET_SIZE);

/** El lote de cultivo que pisa la celda, o null. */
export function farmAt(w: World, x: number, y: number): Farm | null {
  return w.farms.find((f) => x >= f.x && x < f.x + FARM_SIZE && y >= f.y && y < f.y + FARM_SIZE) ?? null;
}

/** El silo que pisa la celda, o null. */
export function siloAt(w: World, x: number, y: number): Silo | null {
  return w.silos.find((s) => x >= s.x && x < s.x + SILO_SIZE && y >= s.y && y < s.y + SILO_SIZE) ?? null;
}

/** La feria que pisa la celda, o null. */
export function marketAt(w: World, x: number, y: number): Market | null {
  return w.markets.find((m) => x >= m.x && x < m.x + MARKET_SIZE && y >= m.y && y < m.y + MARKET_SIZE) ?? null;
}

/** Las toneladas guardadas en toda la ciudad. */
export function storedTons(w: Silos): number {
  return w.silos.reduce((sum, s) => sum + Math.max(0, s.tons), 0);
}

/** Cuánto entra en total: sin silos no se guarda nada, y sin lugar la cosecha se pierde. */
export function siloRoom(w: Silos): number {
  return w.silos.length * SILO_CAPACITY;
}

/** Toneladas que la ciudad puede convertir en pesos por mes: lo que suman sus ferias. */
export function marketRoom(w: Markets): number {
  return w.markets.length * MARKET_THROUGHPUT;
}

/**
 * Las calles por las que puede andar el camión: las que llegan, por calle, a alguna feria.
 *
 * El camión carga en la feria o en el silo —la cadena entera— y sale por las calles que los tocan; una
 * calle suelta que no une nada con la cadena no sirve, por larga que sea. Es un BFS sobre celdas de calle
 * sembrado con las que tocan cada pieza, el mismo idioma que el `roadAccess` de los lotes.
 */
export function truckNetwork(w: World): Uint8Array {
  return truckFlow(w).on;
}

/** La red del camión y, para cada calle de la red, cuántas cuadras la separan de la cadena (0 en las que
 *  la tocan). Es lo que usan las camionetas para saber hacia dónde avanzar (ver `render/trucks.ts`). */
export function truckFlow(w: World): { on: Uint8Array; dist: Int16Array } {
  const n = w.n;
  const on = new Uint8Array(n * n);
  const dist = new Int16Array(n * n).fill(-1);
  const queue = new Int32Array(n * n);
  let tail = 0;
  const seed = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= n || y >= n) return;
    const i = y * n + x;
    if (w.tiles[i] !== TILE.ROAD || on[i]) return;
    on[i] = 1;
    dist[i] = 0;
    queue[tail++] = i;
  };
  for (const market of w.markets) {
    for (let dy = -1; dy <= MARKET_SIZE; dy++) for (let dx = -1; dx <= MARKET_SIZE; dx++) seed(market.x + dx, market.y + dy);
  }
  for (const silo of w.silos) {
    for (let dy = -1; dy <= SILO_SIZE; dy++) for (let dx = -1; dx <= SILO_SIZE; dx++) seed(silo.x + dx, silo.y + dy);
  }
  for (let head = 0; head < tail; head++) {
    const i = queue[head];
    const x = i % n;
    const y = (i - x) / n;
    for (const j of [x > 0 ? i - 1 : -1, x < n - 1 ? i + 1 : -1, y > 0 ? i - n : -1, y < n - 1 ? i + n : -1]) {
      if (j >= 0 && w.tiles[j] === TILE.ROAD && !on[j]) {
        on[j] = 1;
        dist[j] = dist[i] + 1;
        queue[tail++] = j;
      }
    }
  }
  return { on, dist };
}

/**
 * Qué lotes traen su cosecha: el camión sale del lote y encuentra, en hasta `ROAD_REACH` pasos, una calle
 * de la red del camión. Devuelve un booleano por lote, en el orden de `w.farms`. Cada lote camina solo:
 * el alcance de uno no le roba celdas al otro.
 */
export function farmServida(w: World, network?: Uint8Array): boolean[] {
  const net = network ?? truckNetwork(w);
  const n = w.n;
  const out = w.farms.map((farm) => {
    const dist = new Int16Array(n * n).fill(-1);
    const queue = new Int32Array(n * n);
    let tail = 0;
    for (let dy = 0; dy < FARM_SIZE; dy++) {
      for (let dx = 0; dx < FARM_SIZE; dx++) {
        const i = (farm.y + dy) * n + (farm.x + dx);
        dist[i] = 0;
        queue[tail++] = i;
      }
    }
    for (let head = 0; head < tail; head++) {
      const i = queue[head];
      if (w.tiles[i] === TILE.ROAD && net[i]) return true; // el camión llegó
      if (dist[i] >= ROAD_REACH) continue;
      const x = i % n;
      const y = (i - x) / n;
      for (const j of [x > 0 ? i - 1 : -1, x < n - 1 ? i + 1 : -1, y > 0 ? i - n : -1, y < n - 1 ? i + n : -1]) {
        if (j >= 0 && dist[j] < 0) {
          dist[j] = dist[i] + 1;
          queue[tail++] = j;
        }
      }
    }
    return false;
  });
  // Los lotes pegados se llegan caminando por el campo: la servidumbre se contagia por la cadena de
  // lotes contiguos (borde o esquina) hasta punto fijo. El camión carga en el lote que toca la calle;
  // el resto del arreo va a pie.
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < w.farms.length; i++) {
      if (out[i]) continue;
      const f = w.farms[i];
      for (let j = 0; j < w.farms.length; j++) {
        if (j === i || !out[j]) continue;
        const g = w.farms[j];
        if (f.x + FARM_SIZE + 1 >= g.x && g.x + FARM_SIZE + 1 >= f.x && f.y + FARM_SIZE + 1 >= g.y && g.y + FARM_SIZE + 1 >= f.y) {
          out[i] = true;
          changed = true;
          break;
        }
      }
    }
  }
  return out;
}

/**
 * Guarda `tons` toneladas en los silos, de a una, y devuelve **lo que no entró**.
 *
 * Lo que no entra no se tira en silencio: el que llama decide si se pierde (no hay dónde guardarlo) o si se
 * avisa. Reparte desde el primer silo con lugar para que el stock quede parejo y la merma no castigue siempre
 * al mismo.
 */
export function storeTons(w: Silos, tons: number): number {
  let left = Math.max(0, tons);
  for (const silo of w.silos) {
    if (left <= 0) break;
    const room = SILO_CAPACITY - Math.max(0, silo.tons);
    if (room <= 0) continue;
    const put = Math.min(room, left);
    silo.tons += put;
    left -= put;
  }
  return left;
}

/**
 * Saca `tons` toneladas de los silos, de a una, y devuelve **lo que sacó**.
 *
 * Vacía el primer silo que tiene carga antes de pasar al siguiente, al revés que `storeTons`: así el stock
 * que queda arriba de todo sigue siendo igual de viejo y la merma no castiga a un silo distinto cada mes.
 */
export function takeTons(w: Silos, tons: number): number {
  let left = Math.max(0, tons);
  let took = 0;
  for (const silo of w.silos) {
    if (left <= 0) break;
    const have = Math.max(0, silo.tons);
    if (have <= 0) continue;
    const out = Math.min(have, left);
    silo.tons -= out;
    took += out;
    left -= out;
  }
  return took;
}
