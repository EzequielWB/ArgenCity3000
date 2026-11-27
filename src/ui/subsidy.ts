/**
 * El telegrama del subsidio provincial: cuando la caja baja de `SUBSIDY.trigger`, la Provincia
 * manda un telegrama de papel con un sello de goma que dice «único». Cobrarlo o no, se manda
 * una sola vez (see `sim/subsidy.ts`).
 */
import { SUBSIDY } from '../config';
import { formatMoney } from '../core/format';
import { takeSubsidy } from '../sim/subsidy';
import type { Game } from '../game';
import { escapeHtml, toast } from './dom';
import { closeModal, openModal } from './panels';

/** The telegram itself: letterhead, typewriter body, rubber stamp, and the two ways out. */
function telegramHtml(): string {
  const money = escapeHtml(formatMoney(SUBSIDY.amount));
  return `
    <div class="tg-head">
      <b>GOBIERNO DE LA PROVINCIA — MINISTERIO DE ASUNTOS MUNICIPALES</b>
      <span class="tg-num">TELEGRAMA<br>Nº 0047</span>
    </div>
    <div class="tg-stamp">SUBSIDIO<br>EXTRAORDINARIO<br>· ÚNICO ·</div>
    <p class="tg-body">
      SEÑOR INTENDENTE: SABEMOS DE SUS APUROS. LA PROVINCIA AUTORIZA UN SUBSIDIO DE
      <b class="tg-money">${money}</b> PARA LA COMODA MUNICIPAL. COBRAR UNA SOLA VEZ.
      QUEDA ASENTADO EN EL EXPEDIENTE. ATENTAMENTE, LA CASA DE CAMPO.
    </p>
    <div class="event-options">
      <button type="button" data-accept><b>Cobrar los ${money}</b></button>
      <button type="button" data-decline><b>Gracias, no lo necesito</b></button>
    </div>
    <p><small>Aceptarlo queda en el expediente: la Provincia te lo va a recordar.</small></p>
  `;
}

/** The telegram on screen. The caller has already checked `subsidyDue` and stopped the clock. */
export function openSubsidy(game: Game): void {
  const s = game.sim.state;
  const body = openModal(
    telegramHtml(),
    // Any way out (decline, the cross, a click outside) settles the offer: the flag goes in the save.
    () => {
      if (!s.subsidy) s.subsidy = true;
      game.afterEvent();
    },
    'telegrama',
  );
  body.querySelector('button[data-accept]')!.addEventListener('click', () => {
    const got = takeSubsidy(s);
    closeModal();
    if (got) toast(`Subsidio provincial cobrado: +${formatMoney(got)}`);
  });
  body.querySelector('button[data-decline]')!.addEventListener('click', () => closeModal());
}
