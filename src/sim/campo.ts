/**
 * El campo: el calendario, el precio y las cuentas del silo, como funciones puras.
 *
 * Vive aparte de la simulación por la misma razón que `sim/tornado.ts`: lo que el jugador decide se explica
 * en el panel y lo que el mes cobra se resuelve en el cierre, y si cada lado hiciera su cuenta el panel
 * prometería una cosa y el presupuesto pagaría otra.
 *
 * El corte 1 tiene un solo cultivo. Maíz y soja son la misma pieza con otra fila en `CROPS`; el tambo no,
 * porque produce todos los meses y no tiene pico — ése va por su lado.
 */

/** Los cultivos que el jugador puede sembrar. */
export type CropKind = 'trigo';

export interface Crop {
  label: string;
  /** Mes de siembra (1 a 12). */
  sow: number;
  /** Mes de cosecha (1 a 12). Es el mes en que entra todo el stock del año. */
  harvest: number;
  /** Toneladas que entrega un lote de 2×2 en su cosecha. */
  tons: number;
}

/**
 * La tabla de cultivos.
 *
 * El trigo es el del corte 1: siembra en mayo, cosecha en diciembre. Las toneladas son el punto de partida y
 * se calibran en T5 contra `npm run probe`: un lote de 2×2 rinde hoy $3.600 al año contra los $2.952 de una
 * manzana de torres — parecido, y el campo no paga luz ni agua, así que si el probe muestra que conviene
 * llenar el mapa de trigo, baja acá y no en el precio.
 */
export const CROPS: Record<CropKind, Crop> = {
  trigo: { label: 'Trigo', sow: 5, harvest: 12, tons: 30 },
};

/**
 * El precio de la tonelada, en pesos, entre la cosecha y el invierno.
 *
 * **El precio tiene forma.** Cae en cosecha porque todos venden y sube en invierno porque nadie tiene nada.
 * Si fuera ruido, vender sería una lotería y el silo un adorno caro; con forma, guardar es una apuesta que se
 * puede pensar.
 */
export const PRICE_RANGE = { low: 120, high: 180 } as const;

/**
 * Lo que se estropea por mes de espera.
 *
 * Es lo que evita que la orden de venta sea obvia: sin merma, pedir el precio máximo y no vender nunca sería
 * la jugada ganadora, y el silo dejaría de ser una decisión. Con 4 % mensual, doce meses se comen casi el
 * 40 % del stock: esperar sigue conviniendo si la diferencia de precio es grande, y deja de convenir si no.
 */
export const MERMA = 0.04;

/**
 * La oferta: cuánto ablanda el precio lo que la ciudad ya volcó al mercado.
 *
 * `saturate` son las toneladas que saturan el mercado local y `drop` cuánto cae el precio con el mercado
 * saturado. `keep` es la parte de esa presión que sobrevive al mes siguiente: sin decaimiento, un diciembre
 * de volquete castigaría para siempre y el jugador no tendría cómo recuperarse.
 *
 * La presión se cuenta por tonelada **con la venta incluida**: el que vuelca cobra el mercado que él mismo
 * ablandó, y ahí está la razón de ser del silo. Con la presión del mes anterior, volcar todo de una vez
 * cobraría el precio tranquilo y repartir no tendría ninguna ventaja.
 */
export const PRICE_OFFER = { saturate: 2000, drop: 0.45, keep: 0.5 } as const;

/** La presión de oferta que deja el mes que viene: lo que había, con su decaimiento, más lo vendido. */
export function nextPressure(prev: number, sold: number): number {
  return Math.max(0, Math.max(0, prev) * PRICE_OFFER.keep + Math.max(0, sold));
}

/** ¿Este mes es el de la cosecha? El `month` va de 1 a 12, como `dateOf`. */
export function harvestMonth(month: number): boolean {
  const crop = CROPS.trigo;
  return wrapMonth(month) === crop.harvest;
}

/** El mes traído al 1..12, para que un tick raro no rompa la cuenta. */
function wrapMonth(month: number): number {
  return ((Math.floor(month) - 1) % 12 + 12) % 12 + 1;
}

/**
 * El precio de la tonelada en un mes.
 *
 * Una sola onda sobre el año: el piso en el mes de cosecha y el techo justo al revés, medio año después. La
 * curva es continua a propósito —el precio de julio está entre el de junio y el de agosto— porque un salto
 * haría que el jugador vendiera siempre el mismo mes y el resto del calendario no existiera.
 */
export function priceOf(month: number, pressure = 0): number {
  const peak = wrapMonth(CROPS.trigo.harvest + 6);
  const t = Math.cos((2 * Math.PI * (wrapMonth(month) - peak)) / 12);
  const half = (PRICE_RANGE.high - PRICE_RANGE.low) / 2;
  const quieto = PRICE_RANGE.low + half * (t + 1);
  // La oferta ablanda el precio, con techo: por más que se vuelque todo, la tonelada no vale cero.
  const relief = Math.min(1, Math.max(0, pressure / PRICE_OFFER.saturate));
  return Math.max(1, Math.round(quieto * (1 - PRICE_OFFER.drop * relief)));
}

/** Los doce precios del año, de enero a diciembre. Es lo que el panel dibuja. */
export function priceTable(pressure = 0): number[] {
  return Array.from({ length: 12 }, (_, k) => priceOf(k + 1, pressure));
}

/**
 * La orden de venta que fija el jugador.
 *
 * No es un botón: son dos umbrales y el sistema los ejecuta. `minPrice` es "no vendas por debajo de esto" y
 * `keepTons` es "nunca bajes de acá". Es el mismo idioma que el resto del juego, donde el jugador fija un
 * umbral y la simulación lo obedece sola.
 */
export interface SellOrder {
  /** Precio por tonelada a partir del cual se vende. */
  minPrice: number;
  /** Toneladas que no se tocan aunque el precio sea bueno. */
  keepTons: number;
}

/**
 * Cuántas toneladas vende la feria este mes.
 *
 * Tres topes, y el menor manda: el precio tiene que llegar al mínimo, la retención deja un piso de stock, y
 * la feria no convierte más de lo que puede. Sin feria (`capacity` en 0) no se vende nada: el campo produce
 * y la ciudad no ve un peso.
 */
export function tonsToSell(stock: number, price: number, order: SellOrder, capacity: number): number {
  if (stock <= 0 || capacity <= 0) return 0;
  if (price < order.minPrice) return 0;
  const sellable = stock - Math.max(0, order.keepTons);
  return Math.max(0, Math.min(sellable, capacity));
}

/** El stock que queda después de un mes de espera: la merma se come un porcentaje. */
export function spoil(tons: number): number {
  if (tons <= 0) return 0;
  return tons - Math.round(tons * MERMA);
}
