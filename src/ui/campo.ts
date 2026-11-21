/**
 * El campo como texto: el estado de la cadena, el consejo del mes y la tabla de precios.
 *
 * Todo markup puro, como las tarjetas de gobierno, para poder probarlo sin DOM. El panel (`openFarm`, en
 * `panels.ts`) le pone los sliders de la orden y el envoltorio; acá no se toca el mundo.
 */
import { CROPS, UPKEEP } from '../config';
import { formatMoney, formatNumber } from '../core/format';
import { MERMA, harvestNews, previewHarvest, priceOf, priceTable, type HarvestReport, type SellOrder } from '../sim/campo';
import { marketRoom, siloRoom, storedTons } from '../world/farms';
import type { World } from '../world/world';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** Las toneladas que van a dar los lotes en `month`, sin mirar si entran en los silos. */
export function grownIn(w: World, month: number): number {
  let tons = 0;
  for (const farm of w.farms) if (CROPS[farm.crop].harvest === month) tons += CROPS[farm.crop].tons;
  return tons;
}

/** Qué tiene la ciudad: los lotes que producen, los silos que guardan y las ferias que venden. */
export function campoStatusHtml(w: World): string {
  const lotes = w.farms.length;
  const guardado = storedTons(w);
  const capacidad = siloRoom(w);
  const upkeep = w.silos.length * UPKEEP.silo + w.markets.length * UPKEEP.market;
  const silos = w.silos.length === 0
    ? '<strong>Sin silos</strong>: lo que se cosecha se pierde en el lote.'
    : `${w.silos.length} ${w.silos.length === 1 ? 'silo' : 'silos'} con <strong>${formatNumber(guardado)} de ${formatNumber(capacidad)} t</strong> guardadas.`;
  const ferias = w.markets.length === 0
    ? '<strong>Sin feria</strong>: el trigo no se convierte en plata.'
    : `${w.markets.length} ${w.markets.length === 1 ? 'feria' : 'ferias'}: hasta ${formatNumber(marketRoom(w))} t por mes.`;
  return `
    <p>${lotes} ${lotes === 1 ? 'lote' : 'lotes'} de trigo. ${silos}<br>${ferias}</p>
    <p class="campo-uptime"><small>Mantener los silos y las ferias cuesta <strong>$${formatNumber(upkeep)}</strong> por mes, se venda o no.</small></p>`;
}

/**
 * El consejo del mes: qué entra, a qué precio y qué haría la orden con eso.
 *
 * Habla de **este** mes y no del año: el campo cobra una vez y el jugador necesita saber si el mes que corre es
 * el que paga. Un pronóstico anual escondido en un panel mensual es la clase de número que el jugador
 * aprende a ignorar.
 */
export function campoAdviceHtml(w: World, month: number, order: SellOrder): string {
  if (w.farms.length === 0 && w.silos.length === 0 && w.markets.length === 0) return '';
  const avisos: string[] = [];
  // El consejo es el **cierre del mes** calculado sobre una copia: el número que el jugador lee moviendo el
  // slider es el que el juego le va a pagar, no una cuenta parecida hecha para el panel.
  const r = previewHarvest(w, month, order);
  const guardado = storedTons(w);

  if (r.grown > 0) avisos.push(`Este mes se cosechan <strong>${formatNumber(r.grown)} toneladas</strong> de trigo.`);
  if (r.lost > 0) avisos.push(`De eso, <strong>${formatNumber(r.lost)} se pierden</strong>: no hay silo que las aguante.`);
  if (r.sold > 0) {
    avisos.push(`La feria vende <strong>${formatNumber(r.sold)} toneladas</strong> a ${formatMoney(r.price)} la tonelada: entran ${formatMoney(r.income)}.`);
  } else if ((r.grown > 0 || guardado > 0) && marketRoom(w) > 0) {
    avisos.push(`Con la orden en ${formatMoney(order.minPrice)} y el trigo a ${formatMoney(r.price)}, <strong>no vende</strong>: espera a que suba.`);
  }
  // La decisión de la feature, dicha con los dos costos al lado: el pico del año y lo que se come la merma por
  // esperarlo. Un panel que sólo muestra el precio alto empuja a guardar sin decir el precio de guardar.
  const pico = ((CROPS.trigo.harvest + 6 - 1) % 12) + 1;
  const meses = (pico - month + 12) % 12;
  const queda = Math.round(Math.pow(1 - MERMA, meses) * 100);
  if (guardado + r.grown > 0 && meses > 0) {
    avisos.push(
      `Aguantar hasta ${MESES[pico - 1]} paga ${formatMoney(priceOf(pico, w.farmPressure))} la tonelada, pero en ${meses} ${meses === 1 ? 'mes' : 'meses'} la merma se lleva el <strong>${100 - queda} %</strong> de lo guardado.`,
    );
  }
  if (w.farms.length > 0 && w.silos.length === 0) avisos.push('Sin silo, cada cosecha se pierde entera: hay que construir al menos uno.');
  if (guardado > 0 && w.markets.length === 0) avisos.push('Hay trigo guardado y ninguna feria: sin feria no entra un peso.');
  return avisos.map((a) => `<p>${a}</p>`).join('');
}

/** Los doce precios del año, con el mes que corre y el de cosecha marcados. */
export function priceTableHtml(month: number, pressure: number): string {
  const precios = priceTable(pressure);
  const cosecha = CROPS.trigo.harvest;
  const filas = precios
    .map((precio, i) => {
      const mes = i + 1;
      const marcas = [mes === cosecha ? '<span class="campo-tag cosecha">cosecha</span>' : '', mes === month ? '<span class="campo-tag ahora">ahora</span>' : ''].join('');
      return `<tr class="${mes === month ? 'now' : ''}"><td>${MESES[i]}</td><td>${formatMoney(precio)}</td><td class="tags">${marcas}</td></tr>`;
    })
    .join('');
  return `<table class="budget precios"><thead><tr><th>Mes</th><th>La tonelada</th><th></th></tr></thead><tbody>${filas}</tbody></table>`;
}

/** El recibo del último cierre, o una línea que dice que todavía no hubo ninguno. */
export function lastHarvestHtml(r: HarvestReport | null): string {
  if (!r) return '<p><small>Todavía no cerró un mes con el campo.</small></p>';
  const nota = harvestNews(r);
  return nota ? `<p>${nota}</p>` : `<p><small>${MESES[r.month - 1]}: no hubo nada que contar. El trigo se cosecha en ${MESES[CROPS.trigo.harvest - 1]}.</small></p>`;
}
