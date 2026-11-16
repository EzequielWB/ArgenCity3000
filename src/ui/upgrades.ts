/** The roguelike windows: the three cards on the table, and the end of the run. */
import { formatMoney, formatNumber } from '../core/format';
import type { Game } from '../game';
import { dateLabel } from '../sim/calendar';
import { RUN_PICKS, markOf, pickedUpgrades, upgradeById, type RunState, type Upgrade } from '../sim/roguelike';
import type { Simulation } from '../sim/simulation';
import { escapeHtml } from './dom';
import { closeModal, lockModal, openModal } from './panels';

/** The knobs of the cost of running the city, whose name the player has no reason to know. */
const ADMIN_KNOBS = new Set(['admin', 'adminCurve']);

/**
 * The line a card gets when it moves the administration: what that line is, and what it costs today.
 * Without it, "la administración crece con la ciudad" is a number with no face.
 */
function noteFor(upgrade: Upgrade, sim: Simulation): string | null {
  const admin = upgrade.stages.some((stage) => Object.keys(stage.mods).some((key) => ADMIN_KNOBS.has(key)));
  const cost = sim.state.lastBudget?.services ?? 0;
  if (!admin || cost <= 0) return null;
  return `La administración (sueldos, oficinas y trámites) te cuesta hoy ${formatMoney(cost)} por mes, y cada habitante nuevo sale más caro que el anterior.`;
}

/** The three cards of a draft, as markup: the name, what it does, and the line in today's pesos. */
export function upgradeCardsHtml(offer: readonly string[], sim: Simulation): string {
  return offer
    .map((id) => {
      const u = upgradeById(id);
      if (!u) return '';
      const note = noteFor(u, sim);
      return `<button type="button" data-upgrade="${u.id}"><b>${escapeHtml(u.label)}</b><span>${escapeHtml(u.blurb)}</span>${note ? `<span class="up-note">${escapeHtml(note)}</span>` : ''}</button>`;
    })
    .join('');
}

/** The draft of a mark: one of three cards, and no way out without choosing. */
export function openUpgrades(game: Game): void {
  const run = game.sim.state.run;
  if (!run || !run.offer) return;
  const mark = markOf(run);
  const body = openModal(
    `<p class="event-kicker">Mejora ${run.picks.length + 1} de ${RUN_PICKS}</p>
    <h2>${mark > 0 ? `${formatNumber(mark)} habitantes` : 'Antes de fundar'}</h2>
    <p>${
      mark > 0
        ? 'La ciudad cruzó la marca. Elegí una mejora: la que dejes vuelve al mazo y puede salir más adelante.'
        : 'La ciudad arranca con una mejora a mano. Elegí una: la que dejes vuelve al mazo y puede salir más adelante.'
    }</p>
    <div class="event-options">${upgradeCardsHtml(run.offer, game.sim)}</div>
    <p><small>El tiempo está en pausa hasta que elijas.</small></p>`,
    undefined,
    'mejora',
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
        ? `<ul class="run-picks">${picks.map((p) => `<li>${escapeHtml(p.label)}${p.outcome ? ` — ${escapeHtml(p.outcome)}` : ''}</li>`).join('')}</ul>`
        : '<p>No llegaste a elegir ninguna.</p>'
    }
    <p><small>${picks.length} de ${RUN_PICKS} mejoras · ${escapeHtml(dateLabel(tick))}</small></p>`;
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
