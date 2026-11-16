/** The roguelike windows: the three cards on the table, and the end of the run. */
import { formatNumber } from '../core/format';
import type { Game } from '../game';
import { dateLabel } from '../sim/calendar';
import { KIND_LABEL, RUN_GOAL, RUN_MARKS, pickedUpgrades, upgradeById, type RunState } from '../sim/roguelike';
import { escapeHtml } from './dom';
import { closeModal, lockModal, openModal } from './panels';

/** The three cards of a draft, as markup: the class, the name and what it does. */
export function upgradeCardsHtml(offer: readonly string[]): string {
  return offer
    .map((id) => {
      const u = upgradeById(id);
      if (!u) return '';
      return `<button type="button" data-upgrade="${u.id}"><b>${escapeHtml(u.label)}</b><span class="up-kind up-${u.kind}">${KIND_LABEL[u.kind]}</span><span>${escapeHtml(u.blurb)}</span></button>`;
    })
    .join('');
}

/** The draft of a mark: one of three cards, and no way out without choosing. */
export function openUpgrades(game: Game): void {
  const run = game.sim.state.run;
  if (!run || !run.offer) return;
  const mark = RUN_MARKS[run.next] ?? RUN_GOAL;
  const body = openModal(
    `<p class="event-kicker">Mejora ${run.picks.length + 1} de ${RUN_MARKS.length}</p>
    <h2>${formatNumber(mark)} habitantes</h2>
    <p>La ciudad cruzó la marca. Elegí una mejora: la que dejes, se pierde.</p>
    <div class="event-options">${upgradeCardsHtml(run.offer)}</div>
    <p><small>El tiempo está en pausa hasta que elijas.</small></p>`,
  );
  lockModal();
  body.querySelectorAll<HTMLButtonElement>('button[data-upgrade]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const id = btn.dataset.upgrade;
      closeModal();
      if (id) game.takeUpgrade(id);
    }),
  );
}

const ENDINGS = {
  ganada: { title: 'Un millón', line: 'La ciudad llegó al millón de habitantes. Ganaste la run.' },
  eleccion: { title: 'Lo echó el voto', line: 'Perdiste la elección y el mandato se terminó: la run se pierde con el poder.' },
  caja: { title: 'Dos años en rojo', line: 'La caja pasó 24 meses seguidos en rojo. La Provincia intervino la municipalidad.' },
} as const;

/** How the run went: the upgrades taken, in order, and the date it ended. */
function summaryHtml(run: RunState, tick: number): string {
  const picks = pickedUpgrades(run);
  return `<h3>Las mejoras de la run</h3>
    ${
      picks.length
        ? `<ul class="run-picks">${picks.map((p) => `<li><span class="up-kind up-${p.kind}">${KIND_LABEL[p.kind]}</span> ${escapeHtml(p.label)}</li>`).join('')}</ul>`
        : '<p>No llegaste a elegir ninguna.</p>'
    }
    <p><small>${picks.length} de ${RUN_MARKS.length} mejoras · ${escapeHtml(dateLabel(tick))}</small></p>`;
}

/**
 * The end of the run, won or lost. It cannot be dismissed: the only ways out leave this city behind,
 * either for the start screen or for a fresh run on the same map.
 */
export function openRunOver(game: Game, reason: keyof typeof ENDINGS, onMenu: () => void, onRestart: () => void): void {
  const run = game.sim.state.run;
  if (!run) return;
  const end = ENDINGS[reason];
  const body = openModal(
    `<p class="event-kicker">Fin de la run${reason === 'ganada' ? ' · ganada' : ''}</p>
    <h2>${end.title}</h2>
    <p>${end.line}</p>
    ${summaryHtml(run, game.sim.state.tick)}
    <div class="row"><button id="runAgain" class="primary" type="button">Reiniciar el mismo mapa</button><button id="runMenu" type="button">Volver al menú</button></div>`,
    undefined,
    reason === 'ganada' ? 'plaqueta' : undefined,
  );
  lockModal();
  body.querySelector('#runAgain')!.addEventListener('click', onRestart);
  body.querySelector('#runMenu')!.addEventListener('click', onMenu);
}
