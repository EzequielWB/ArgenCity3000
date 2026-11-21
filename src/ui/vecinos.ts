/**
 * El desplegable de la radio como texto: los llamados del barrio y los agradecimientos.
 *
 * Markup puro, como las tarjetas de campo y de gobierno, para poder probarlo sin DOM. `openVecinos`
 * (`panels.ts`) le pone el envoltorio y engancha los botones; acá no se toca el mundo.
 */
import { formatNumber } from '../core/format';
import { NEED, type Call, type VecinosReport } from '../sim/vecinos';

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

/** «Hace once meses»: para arrancar la frase de la cita en la pantalla de la radio. */
export function sinceLabel(months: number): string {
  const t = timeAgo(months);
  return t.startsWith('hace') ? `Hace${t.slice(4)}` : `Desde ${t}`;
}

/** El color de la barra de enojo: verde mientras aguanta, ámbar cuando duele, rojo cuando se va. */
export function angerColor(anger: number): string {
  if (anger >= 60) return '#c9342c';
  if (anger >= 30) return '#e0a526';
  return '#7cc06a';
}

/** «30 vecinos» y «uno solo»: el tamaño del barrio que hay detrás del llamado. */
export function countLabel(count: number): string {
  if (count === 1) return 'uno solo';
  return `${formatNumber(count)} vecinos`;
}

/** Un llamado: el nombre arriba con lo medido al costado, la cita abajo, y el enojo a la altura del nombre. */
function callHtml(c: Call): string {
  return `
    <li class="callo" data-cell="${c.i}">
      <div class="callo-head">
        <span class="callo-who">${c.who.name.replace(/^(Doña|Don) /, '')}</span>
        <span class="callo-meta">${countLabel(c.count)} · ${timeAgo(c.months)}</span>
        <i class="callo-bar"><b style="width:${c.anger}%;background:${angerColor(c.anger)}"></b></i>
        <span class="callo-pct" style="color:${angerColor(c.anger)}">${c.anger} %</span>
        <button type="button" class="callo-go" data-go="${c.i}">Ir</button>
      </div>
      <p class="callo-say">«${c.say}»</p>
    </li>`;
}

/** Lo que dice el presentador antes de la cita, y la cita. Una línea y media, no más. */
export function radioLine(c: Call): string {
  return `—Nos llama ${c.who.radio}: «${sinceLabel(c.months)} que ${NEED[c.grip]}.»`;
}

/** El agradecimiento: la cita sola, sin sello. La distinción la hace el color y el lugar. */
function thanksHtml(t: VecinosReport['thanks'][number]): string {
  return `<p class="callo-done">«${t.text}» — ${t.who.name.replace(/^(Doña|Don) /, '')}</p>`;
}

/**
 * El cuerpo del desplegable. El orden es el que trae el informe —el más enojado primero—, así que la primera
 * fila es la que el jugador tiene que atender si quiere que el barrio no se vacíe.
 */
export function vecinosHtml(report: VecinosReport): string {
  const thanks = report.thanks.map(thanksHtml).join('');
  if (report.calls.length === 0) {
    return `
      <div class="drop-head"><h2>Los vecinos</h2><span class="drop-count">nadie llama</span></div>
      <div class="drop-empty">
        <span class="drop-ico" aria-hidden="true">☎</span>
        <p>«No llama nadie. El barrio duerme tranquilo.»</p>
        <small>Los que llaman son los que están por irse.</small>
      </div>
      ${thanks}`;
  }
  const barrios = report.groups === 1 ? '1 barrio' : `${report.groups} barrios`;
  const rest = report.groups > report.calls.length
    ? `<p class="drop-rest">Y ${report.groups - report.calls.length} barrios más, menos enojados.</p>`
    : '';
  return `
    <div class="drop-head">
      <h2>Los vecinos</h2>
      <span class="drop-count">${formatNumber(report.total)} vecinos · ${barrios}</span>
    </div>
    <ul class="drop-list">${report.calls.map(callHtml).join('')}</ul>
    ${rest}
    ${thanks}`;
}
