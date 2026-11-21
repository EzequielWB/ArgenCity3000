/**
 * El panel de los vecinos como texto: la lista de reclamos y los agradecimientos.
 *
 * Markup puro, como las tarjetas de campo y de gobierno, para poder probarlo sin DOM. `openVecinos`
 * (`panels.ts`) le pone el envoltorio y el botón de «Ir»; acá no se toca el mundo.
 */
import { formatNumber } from '../core/format';
import type { Complaint, Gripe, Thanks, VecinosReport } from '../sim/vecinos';

/** Hace cuánto, en palabras. A los 21 años el contador de meses se satura y se dice de otra forma. */
export function timeAgo(months: number): string {
  if (months >= 255) return 'hace más de veinte años';
  if (months <= 0) return 'este mes';
  if (months === 1) return 'hace un mes';
  if (months < 12) return `hace ${months} meses`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const head = years === 1 ? 'hace un año' : `hace ${years} años`;
  return rest === 0 ? head : `${head} y ${rest} ${rest === 1 ? 'mes' : 'meses'}`;
}

/** El color de la barra de enojo: verde hasta que se pone feo, después ámbar y rojo. */
function angerColor(anger: number): string {
  if (anger >= 60) return '#c9342c';
  if (anger >= 30) return '#e0a526';
  return '#7cc06a';
}

function complaintHtml(c: Complaint): string {
  return `
    <li class="vec" data-cell="${c.i}">
      <span class="vec-face" aria-hidden="true">${c.who.initials}</span>
      <div class="vec-body">
        <div class="vec-name">${c.who.name}</div>
        <div class="vec-addr">Manzana ${c.block} · lote ${c.lot} · ${timeAgo(c.months)}</div>
        <p class="vec-say">${c.text}</p>
        <div class="vec-foot">
          <span class="vec-anger" title="Enojo del barrio">Enojo
            <i class="vec-bar"><b style="width:${c.anger}%;background:${angerColor(c.anger)}"></b></i>
            ${c.anger} %</span>
          <button type="button" class="vec-go" data-go="${c.i}">Ir</button>
        </div>
      </div>
    </li>`;
}

function thanksHtml(t: Thanks): string {
  return `
    <li class="vec vec-done">
      <span class="vec-face" aria-hidden="true">${t.who.initials}</span>
      <div class="vec-body">
        <p class="vec-say">«${t.text}»</p>
        <div class="vec-addr">${t.who.name} · manzana ${t.block} · ${timeAgo(t.months)} <span class="vec-stamp">resuelto</span></div>
      </div>
    </li>`;
}

/** La línea de los que no entraron: cuántos son y de qué se quejan. */
export function moreLine(more: VecinosReport['more']): string {
  if (more.length === 0) return '';
  const total = more.reduce((n, m) => n + m.count, 0);
  const head = total === 1 ? 'Y <b>un vecino</b> más' : `Y <b>${formatNumber(total)}</b> vecinos más`;
  // Con una sola causa la frase no repite el número: «Y 61 vecinos más con el mismo problema de la luz».
  if (more.length === 1) return `<p class="vec-more">${head} con ${more[0].label}.</p>`;
  const parts = more.map((m) => `<b>${formatNumber(m.count)}</b> con ${m.label}`);
  return `<p class="vec-more">${head}: ${parts.join(', ')}.</p>`;
}

/**
 * El cuerpo del panel. El orden de la lista es el que trae el informe —el más enojado primero—, así que la
 * primera tarjeta es la que el jugador tiene que atender si quiere que el barrio no se vacíe.
 */
export function vecinosHtml(report: VecinosReport): string {
  if (report.list.length === 0) {
    const done = report.thanks.length > 0 ? `<ul class="vec-list">${report.thanks.map(thanksHtml).join('')}</ul>` : '';
    const quiet = '<p class="vec-empty">Nadie se está quejando. Por ahora.</p>';
    return `<h2>Los vecinos</h2><p class="vec-lede">Lo que le pasa a la ciudad, contado por quien lo vive.</p>${quiet}${done}`;
  }
  const more = moreLine(report.more);
  const thanks = report.thanks.length > 0 ? `<h3>Se arregló</h3><ul class="vec-list">${report.thanks.map(thanksHtml).join('')}</ul>` : '';
  return `
    <h2>Los vecinos</h2>
    <p class="vec-lede">Lo que le pasa a la ciudad, contado por quien lo vive. El que reclama es el que se
    está por ir: si no lo atendés, el barrio se vacía.</p>
    <ul class="vec-list">${report.list.map(complaintHtml).join('')}</ul>
    ${more}
    ${thanks}`;
}

/** Lo que dice el botón del menú. Con reclamos, el número va a la vista. */
export function vecinosButtonLabel(count: number): string {
  return count > 0 ? `Los vecinos (${count})` : 'Los vecinos';
}

export type { Gripe };
