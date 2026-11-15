/** The little window that opens when a bus line is placed: its colour and its number, before anything is built. */
import { BUS, BUS_COLORS, MAX_BUS_NUMBER } from '../config';
import { formatMoney } from '../core/format';
import { busLineProblem, busStations, freeBusNumber, packBusLine } from '../world/transport';
import type { World } from '../world/world';
import { closeModal, openModal } from './panels';

/** Black or white text, whichever reads better on the colour of a line. */
function textOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
  return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? '#1b1410' : '#ffffff';
}

/**
 * Asks for the colour and the number of a new line at `cell`. `onConfirm` gets the packed line; closing the
 * window or pressing Cancelar builds nothing. The number cannot repeat that of another line of the city.
 */
export function openBusLine(w: World, cell: number, onConfirm: (line: number) => void): void {
  let color = busStations(w).length % BUS_COLORS.length;
  const suggested = freeBusNumber(w);
  const swatches = BUS_COLORS.map(
    (c, k) => `<button type="button" class="bus-swatch" role="radio" data-color="${k}" aria-checked="${k === color}" aria-label="${c.name}" title="${c.name}" style="--bus:${c.hex}"></button>`,
  ).join('');
  const body = openModal(`
    <h2>Nueva línea de colectivos</h2>
    <p class="bus-lede">Elegí el color y el número de la línea. El número no se puede repetir.</p>
    <div class="bus-colors" role="radiogroup" aria-label="Color de la línea">${swatches}</div>
    <div class="bus-row">
      <label class="bus-number">Número (1 a ${MAX_BUS_NUMBER})
        <input id="busNumber" inputmode="numeric" maxlength="3" autocomplete="off" value="${suggested || ''}" />
      </label>
      <span id="busBadge" class="bus-badge" aria-hidden="true"></span>
    </div>
    <p id="busHint" class="bus-hint"></p>
    <div class="row">
      <button id="busOk" class="primary" type="button">Construir por ${formatMoney(BUS.cost)}</button>
      <button id="busNo" type="button">Cancelar</button>
    </div>`);
  const input = body.querySelector<HTMLInputElement>('#busNumber')!;
  const ok = body.querySelector<HTMLButtonElement>('#busOk')!;
  const hint = body.querySelector<HTMLElement>('#busHint')!;
  const badge = body.querySelector<HTMLElement>('#busBadge')!;

  const refresh = (): void => {
    const digits = input.value.replace(/\D/g, '').slice(0, 3);
    if (digits !== input.value) input.value = digits;
    const number = Number(digits);
    const problem = digits === '' ? `Escribí un número de 1 a ${MAX_BUS_NUMBER}` : busLineProblem(w, packBusLine(color, number), cell);
    ok.disabled = problem !== null;
    hint.textContent = problem ?? `La línea ${number} cubre ${BUS.radius} lotes a la redonda.`;
    hint.classList.toggle('bad', problem !== null);
    const hex = BUS_COLORS[color].hex;
    badge.style.background = hex;
    badge.style.color = textOn(hex);
    badge.textContent = digits || '—';
  };

  body.querySelector('.bus-colors')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.bus-swatch');
    if (!b) return;
    color = Number(b.dataset.color);
    body.querySelectorAll('.bus-swatch').forEach((s) => s.setAttribute('aria-checked', String(s === b)));
    refresh();
  });
  input.addEventListener('input', refresh);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !ok.disabled) ok.click();
  });
  ok.addEventListener('click', () => {
    const line = packBusLine(color, Number(input.value));
    if (busLineProblem(w, line, cell) !== null) return;
    closeModal();
    onConfirm(line);
  });
  body.querySelector('#busNo')!.addEventListener('click', closeModal);
  refresh();
  input.focus();
  input.select();
}
