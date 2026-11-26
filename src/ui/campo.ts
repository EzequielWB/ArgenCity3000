/**
 * El campo como texto: el estado de la cadena, el recibo y la tira de precios del año.
 *
 * El panel es corto a propósito: las decisiones son los sliders (el perfil y la orden de venta, que arma
 * `openFarm` en `panels.ts`) y lo que acá se muestra es una línea por cosa. Todo markup puro, para
 * poder probarlo sin DOM; acá no se toca el mundo.
 */
import { CROPS, UPKEEP } from '../config';
import { formatMoney, formatNumber } from '../core/format';
import { climateWord, priceTable, type HarvestReport } from '../sim/campo';
import { marketRoom, siloRoom, storedTons } from '../world/farms';
import type { World } from '../world/world';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** Qué tiene la ciudad: los lotes que producen, los silos que guardan y las ferias que venden. */
export function campoStatusHtml(w: World): string {
  const guardado = storedTons(w);
  const capacidad = siloRoom(w);
  const upkeep = w.farms.length * UPKEEP.farm + w.silos.length * UPKEEP.silo + w.markets.length * UPKEEP.market;
  const silos = w.silos.length === 0
    ? '<strong>Sin silos</strong>: lo que se cosecha se pierde en el lote.'
    : `${w.silos.length} ${w.silos.length === 1 ? 'silo' : 'silos'} con <strong>${formatNumber(guardado)} de ${formatNumber(capacidad)} t</strong>.`;
  const ferias = w.markets.length === 0
    ? '<strong>Sin feria</strong>: el trigo no se convierte en plata.'
    : `${w.markets.length} ${w.markets.length === 1 ? 'feria' : 'ferias'}: hasta ${formatNumber(marketRoom(w))} t por mes.`;
  return `<p>${w.farms.length} ${w.farms.length === 1 ? 'lote' : 'lotes'}. ${silos} ${ferias}</p>
    <p><small>Mantener todo cuesta <strong>$${formatNumber(upkeep)}</strong> por mes, se venda o no.</small></p>`;
}

/** El recibo del último cierre, en una línea: lo que el mes dejó, dicho sin rodeos. */
export function lastHarvestHtml(r: HarvestReport | null): string {
  if (!r) return '<p><small>Todavía no cerró un mes con el campo.</small></p>';
  const partes: string[] = [];
  if (r.grown > 0) partes.push(`${formatNumber(r.grown)} t cosechadas`);
  if (r.sold > 0) partes.push(`${formatNumber(r.sold)} vendidas a ${formatMoney(r.price)}`);
  if (r.unreached > 0) partes.push(`${formatNumber(r.unreached)} t se quedaron sin camino`);
  if (r.lost > 0) partes.push(`${formatNumber(r.lost)} t perdidas sin silo`);
  if (r.spoiled > 0) partes.push(`la merma se llevó ${formatNumber(r.spoiled)} t`);
  const clima = r.soy > 0 ? climateWord(r.climate) : null;
  if (clima) partes.push(clima);
  return `<p><strong>${MESES[r.month - 1]}</strong>: ${partes.join(' · ') || 'nada que contar'}.</p>`;
}

/**
 * La tira de precios del año: doce barras, la más alta en invierno y la más baja en cosecha.
 *
 * Reemplaza a la tabla de doce filas: lo que la decisión necesita es la forma del año, no sus doce números.
 * Cada barra lleva su precio en `data-precio`, para leerla sin DOM en los tests.
 */
export function priceStripHtml(month: number, pressure: number): string {
  const precios = priceTable(pressure);
  const max = Math.max(...precios);
  const cosecha = CROPS.trigo.harvest;
  const barras = precios
    .map((precio, i) => {
      const mes = i + 1;
      const sello = mes === cosecha ? '<span class="campo-tag cosecha">cosecha</span>' : mes === month ? '<span class="campo-tag ahora">ahora</span>' : '';
      return `<div class="campo-precio${mes === month ? ' now' : ''}" data-precio="${precio}" title="${MESES[i]}: ${formatMoney(precio)}">
        <div class="campo-barra" style="height:${Math.max(4, Math.round((precio / max) * 100))}%"></div>
        <small>${precio}</small>${sello ? `<span class="campo-sello">${sello}</span>` : ''}
      </div>`;
    })
    .join('');
  return `<div class="campo-tira">${barras}</div>`;
}
