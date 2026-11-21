/** The roguelike windows: the three cards on the table, and the end of the run. */
import { CITY_GOAL } from '../config';
import { formatNumber } from '../core/format';
import type { Game } from '../game';
import { dateLabel } from '../sim/calendar';
import { RUN_PICKS, markOf, pickedUpgrades, upgradeById, type RunState, type Upgrade } from '../sim/roguelike';
import { escapeHtml } from './dom';
import { closeModal, lockModal, openModal } from './panels';

/** The knobs of the cost of running the city, whose name the player has no reason to know. */
const ADMIN_KNOBS = new Set(['admin', 'adminCurve']);

/**
 * What the administration is, said every time a card talks about it: sueldos, oficinas y trámites, o
 * sea lo que cuesta hacer andar la Municipalidad, y que crece con la ciudad. Va sin el número de
 * hoy: el número cambia solo y una explicación que envejece no sirve para decidir.
 */
const ADMIN_NOTE =
  'La administración es lo que cuesta hacer andar la Municipalidad: los sueldos, las oficinas y los trámites. No es una obra ni un servicio de la ciudad, y cada habitante nuevo la encarece un poco.';

/** Whether a card touches the administration, by its knobs or by its text. */
function speaksOfAdmin(upgrade: Upgrade): boolean {
  if (/administraci/i.test(upgrade.blurb)) return true;
  return upgrade.stages.some((stage) => Object.keys(stage.mods).some((key) => ADMIN_KNOBS.has(key)));
}

/** The line a card gets when it moves the administration: always the same explanation, never a price. */
function noteFor(upgrade: Upgrade): string | null {
  return speaksOfAdmin(upgrade) ? ADMIN_NOTE : null;
}

/** The three cards of a draft, as markup: the name, what it does, and the note when it is about the administration. */
export function upgradeCardsHtml(offer: readonly string[]): string {
  return offer
    .map((id) => {
      const u = upgradeById(id);
      if (!u) return '';
      const note = noteFor(u);
      return `<button type="button" data-upgrade="${u.id}"><b>${escapeHtml(u.label)}</b><span>${escapeHtml(u.blurb)}</span>${note ? `<span class="up-note">${escapeHtml(note)}</span>` : ''}</button>`;
    })
    .join('');
}

/** What was already taken, oldest first: the run's own diary, so a card can be judged against it. */
function chosenHtml(run: RunState): string {
  if (run.picks.length === 0) return '';
  const picks = pickedUpgrades(run);
  return `<div class="run-chosen"><h3>Lo que ya elegiste</h3><ul class="run-picks">${picks
    .map((p) => `<li>${escapeHtml(p.label)}${p.outcome ? ` — ${escapeHtml(p.outcome)}` : ''}</li>`)
    .join('')}</ul></div>`;
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
    <div class="event-options">${upgradeCardsHtml(run.offer)}</div>
    ${chosenHtml(run)}
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
  ganada: { title: 'Medio millón', line: 'La ciudad llegó a los 500.000 habitantes. Ganaste la run.' },
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
 * How the city went, for a classic game: there is no run and no upgrades to list, so the summary is the
 * city itself. `lines` comes from the caller because the numbers live in the simulation, not in a panel.
 */
function citySummaryHtml(lines: readonly [string, string][], tick: number): string {
  return `<h3>La ciudad</h3>
    <ul class="run-picks">${lines.map(([k, v]) => `<li>${escapeHtml(k)}: <strong>${escapeHtml(v)}</strong></li>`).join('')}</ul>
    <p><small>${escapeHtml(dateLabel(tick))}</small></p>`;
}

/**
 * The end of a game, won or lost. In a run it cannot be dismissed: the only ways out leave the city behind.
 * A classic win can be dismissed, because winning should not take the city away from a player who wants to
 * keep looking at it.
 */
export function endScreenHtml(reason: keyof typeof ENDINGS, classic: boolean, summary: string): string {
  const end = ENDINGS[reason];
  // «Ganaste la run» sólo vale en una run: en el clásico la palabra no significa nada para el jugador.
  const line = classic && reason === 'ganada' ? `La ciudad llegó a los ${formatNumber(CITY_GOAL)} habitantes. Ganaste la partida.` : end.line;
  return `<p class="event-kicker">${classic ? 'Fin de la partida' : 'Fin de la run'}${reason === 'ganada' ? ' · ganada' : ''}</p>
    <h2>${end.title}</h2>
    <p>${line}</p>
    ${summary}
    <div class="row">${
      classic
        ? `<button id="endKeep" class="primary" type="button">Seguir mirando</button><button id="endMenu" type="button">Volver al menú</button>`
        : `<button id="runAgain" class="primary" type="button">Reiniciar el mismo mapa</button><button id="runMenu" type="button">Volver al menú</button>`
    }</div>`;
}

export function openEndScreen(
  game: Game,
  reason: keyof typeof ENDINGS,
  onMenu: () => void,
  onRestart: () => void,
  cityLines?: readonly [string, string][],
  /** Classic only: what to do when the player chooses to keep looking at the city. */
  onKeep?: () => void,
): void {
  const run = game.sim.state.run;
  const classic = !run;
  const tick = game.sim.state.tick;
  const summary = run ? summaryHtml(run, tick) : citySummaryHtml(cityLines ?? [], tick);
  const body = openModal(endScreenHtml(reason, classic, summary), undefined, reason === 'ganada' ? 'plaqueta' : undefined);
  if (classic) {
    body.querySelector('#endKeep')!.addEventListener('click', () => {
      closeModal();
      onKeep?.();
    });
    body.querySelector('#endMenu')!.addEventListener('click', onMenu);
    return;
  }
  lockModal();
  body.querySelector('#runAgain')!.addEventListener('click', onRestart);
  body.querySelector('#runMenu')!.addEventListener('click', onMenu);
}
