import { TILE } from '../world/world';
import { GOVERNMENTS, GOVERNMENT_KINDS, LOANS, MAX_FUNDING, MAX_TAX, MIN_TAX, PARK, type GovernmentKind, type ServiceKind } from '../config';
import { averageTax } from '../sim/demand';
import type { ZoneKind } from '../world/world';
import { formatMoney, formatNumber } from '../core/format';
import type { Game } from '../game';
import { deserialize, serialize, type SaveData } from '../save/save';
import { SLOTS, deleteSlot, loadFromSlot, saveToSlot, slotInfo, type SlotId } from '../save/slots';
import { monthlyBudget, type BudgetReport } from '../sim/budget';
import { dateOf } from '../sim/calendar';
import { COAST_BOOST, factorOf, lockOf } from '../sim/effects';
import { loanEndLabel, loanInstalment, loanOwed, loanTotal } from '../sim/loans';
import { MILESTONES, unlockNames } from '../sim/milestones';
import { monthsToElection, nextElectionYear, type ApprovalFactor } from '../sim/politics';
import { toolInfo } from '../world/tools';
import { $, escapeHtml, toast } from './dom';
import { governmentCardsHtml } from './government';

let closeHook: (() => void) | null = null;

export function isModalOpen(): boolean {
  return !$('#modal').classList.contains('hidden');
}

/** Panels drawn as an object instead of the usual framed card: a ballot paper or a bronze plaque. */
export type ModalShape = 'boleta' | 'plaqueta';

export function openModal(html: string, onClose?: () => void, shape?: ModalShape): HTMLElement {
  const body = $('#modalBody');
  body.innerHTML = html;
  $('#modalCard').dataset.shape = shape ?? '';
  $('#modal').classList.remove('hidden');
  closeHook = onClose ?? null;
  $('#modalClose').focus();
  return body;
}

export function closeModal(): void {
  if (!isModalOpen()) return;
  $('#modal').classList.add('hidden');
  $('#modalBody').innerHTML = '';
  const hook = closeHook;
  closeHook = null;
  hook?.();
}

export function initModal(): void {
  $('#modalClose').addEventListener('click', closeModal);
  $('#modal').addEventListener('pointerdown', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
}

// ---------------------------------------------------------------- budget

const ZONE_ROWS: [ZoneKind, string][] = [
  ['R', 'Residencial'],
  ['C', 'Comercial'],
  ['I', 'Industrial'],
];
const SERVICE_ROWS: [ServiceKind, string][] = [
  ['school', 'Escuelas'],
  ['clinic', 'Salitas'],
  ['police', 'Comisarías'],
  ['fire', 'Bomberos'],
];

function money(v: number, sign = false): string {
  const cls = sign ? (v >= 0 ? 'pos' : 'neg') : '';
  return `<span class="${cls}">${sign && v > 0 ? '+' : ''}${formatMoney(v)}</span>`;
}

function budgetTable(b: BudgetReport): string {
  const row = (label: string, v: number, cls = '') => `<tr class="${cls}"><td>${label}</td><td>${money(v)}</td></tr>`;
  return `<div class="planilla"><table class="budget">
    ${row('Impuestos residenciales', b.taxR)}
    ${row('Impuestos comerciales', b.taxC)}
    ${row('Impuestos industriales', b.taxI)}
    ${row('Pesca y turismo', b.coastIncome)}
    ${row('Total ingresos', b.income, 'total')}
    ${row('Calles y puentes', b.roads)}
    ${row('Tendido eléctrico', b.lines)}
    ${row('Espacios verdes', b.parks)}
    ${row('Usinas', b.plants)}
    ${row('Escuelas', b.schools)}
    ${row('Salitas', b.clinics)}
    ${row('Comisarías', b.police)}
    ${row('Bomberos voluntarios', b.firefighters)}
    ${row('Costa', b.coast)}
    ${row('Transporte', b.transport)}
    ${row('Cuota del crédito', b.loan)}
    ${row('Administración municipal', b.services)}
    ${row('Total gastos', b.expenses, 'total')}
    <tr class="total"><td>Saldo del mes</td><td>${money(b.balance, true)}</td></tr>
  </table></div>`;
}

export function openBudget(game: Game): void {
  const sim = game.sim;
  const body = openModal(`
    <h2>Presupuesto municipal</h2>
    <div class="budget-grid">
      <section>
        <h3>Este mes (estimado)</h3>
        <div id="budgetNow"></div>
      </section>
      <section>
        <h3>Impuestos por zona</h3>
        ${ZONE_ROWS.map(
          ([z, label]) =>
            `<div class="tax"><label for="tax${z}">${label}</label><input type="range" id="tax${z}" data-tax="${z}" min="${MIN_TAX}" max="${MAX_TAX}" step="1" value="${sim.state.taxes[z]}"><output>${sim.state.taxes[z]} %</output></div>`,
        ).join('')}
        <p id="taxNote"></p>
        <h3>Presupuesto de servicios</h3>
        ${SERVICE_ROWS.map(
          ([k, label]) =>
            `<div class="tax"><label for="fund${k}">${label}</label><input type="range" id="fund${k}" data-fund="${k}" min="0" max="${MAX_FUNDING}" step="10" value="${sim.state.funding[k]}"><output>${sim.state.funding[k]} %</output></div>`,
        ).join('')}
        <div class="tax"><label for="fundgreen">Espacios verdes</label><input type="range" id="fundgreen" data-green="1" min="0" max="${MAX_FUNDING}" step="10" value="${sim.state.green}"><output>${sim.state.green} %</output></div>
        <p><small>Un servicio al 50 % cuesta la mitad y cubre la mitad. Por encima del 100 % atiende a más vecinos. Los espacios verdes son distintos: por debajo del ${PARK.care} % estos se descuidan, bajan el valor del suelo alrededor y quitan aprobación.</small></p>
        <p class="locked-note hidden" id="lockNote"></p>
        <h3>Caja y energía</h3>
        <p>Caja: <strong>${money(sim.state.cash)}</strong><br>
        Saldo anual estimado: <strong id="yearly"></strong><br>
        Energía: ${formatNumber(sim.power.use)} de ${formatNumber(sim.power.capacity)} MW (${game.world.plants.length} usina${game.world.plants.length === 1 ? '' : 's'})</p>
        <h3>Créditos</h3>
        <div id="loans"></div>
        <h3>Historia</h3>
        <canvas class="chart" id="chart" width="560" height="200" aria-label="Población y caja por mes"></canvas>
        <p><small><span class="key pop" aria-hidden="true"></span> población · <span class="key cash" aria-hidden="true"></span> caja</small></p>
      </section>
    </div>
    ${sim.state.lastBudget ? `<h3>Mes pasado</h3>${budgetTable(sim.state.lastBudget)}` : ''}
  `);
  const refresh = () => {
    const boost = factorOf(sim.state.effects, COAST_BOOST);
    const b = monthlyBudget(game.world, sim.state.taxes, sim.state.funding, sim.state.loan, dateOf(sim.state.tick).month, sim.state.green, boost, sim.state.transport);
    $('#budgetNow').innerHTML = budgetTable(b);
    // The year is the average of the seasons, not the month in course.
    $('#yearly').innerHTML = money(monthlyBudget(game.world, sim.state.taxes, sim.state.funding, sim.state.loan, undefined, sim.state.green, boost, sim.state.transport).balance * 12, true);
    const d = sim.demand;
    const avg = averageTax(sim.state.taxes);
    const demand = `Demanda: residencial ${d.R} · comercial ${d.C} · industrial ${d.I}.`;
    $('#taxNote').textContent =
      avg > 9
        ? `Impuestos altos: entra más plata, pero baja la demanda y la ciudad deja de atraer gente nueva. ${demand}`
        : avg < 5
          ? `Impuestos bajos: la ciudad crece más rápido pero entra menos plata. ${demand}`
          : `Cada impuesto mueve la demanda de su zona. ${demand}`;
    renderLoans();
    // Rewired on every redraw: `renderLoans` replaces the buttons it just drew.
    body.querySelectorAll<HTMLButtonElement>('button[data-loan]').forEach((btn) =>
      btn.addEventListener('click', () => {
        if (sim.takeLoan(Number(btn.dataset.loan))) refresh();
      }),
    );
    body.querySelector<HTMLButtonElement>('#payOff')?.addEventListener('click', () => {
      if (sim.payOffLoan()) refresh();
    });
  };
  /**
   * The offers while nothing is owed, and the running loan otherwise. Taking one or cancelling the
   * rest redraws the panel, so the budget above it never shows a stale instalment.
   */
  const renderLoans = () => {
    const loan = sim.state.loan;
    if (!loan) {
      const offer = (kind: number) => {
        const l = LOANS[kind];
        const fresh = { kind, paid: 0 };
        return `<button type="button" class="loan" data-loan="${kind}">
          <strong>${l.label}</strong>
          <span>${money(l.amount)} ahora</span>
          <span>${l.months} cuotas de ${money(loanInstalment(fresh))}</span>
          <span>Devolvés ${money(loanTotal(fresh))}</span>
        </button>`;
      };
      $('#loans').innerHTML = `<p><small>Cuando la caja no alcance, un crédito entra de una y se devuelve en cuotas fijas que se descuentan solas cada mes. Uno por vez.</small></p>
        <div class="loans">${LOANS.map((_, kind) => offer(kind)).join('')}</div>`;
      return;
    }
    const l = LOANS[loan.kind];
    const owed = loanOwed(loan);
    const short = owed > sim.state.cash;
    $('#loans').innerHTML = `<p><strong>${l.label} en curso.</strong> Recibiste ${money(l.amount)} y devolvés ${money(loanTotal(loan))}.
      Van ${loan.paid} de ${l.months} cuotas; la última cae en <strong>${loanEndLabel(loan, sim.state.tick)}</strong>.</p>
      <p>Te queda por pagar ${money(owed)}.${short ? ` <small>No alcanza la caja: tenés ${money(sim.state.cash)}.</small>` : ''}</p>
      <button type="button" class="loan" id="payOff"${short ? ' disabled' : ''}>Cancelar el resto (${money(owed)})</button>`;
  };
  body.querySelectorAll<HTMLInputElement>('input[data-tax]').forEach((input) =>
    input.addEventListener('input', () => {
      const z = input.dataset.tax as ZoneKind;
      sim.setTax(Number(input.value), z);
      input.nextElementSibling!.textContent = `${sim.state.taxes[z]} %`;
      refresh();
    }),
  );
  // A slider the Province tied to a deal cannot be moved: it is drawn dead, and the panel says why.
  const tied: string[] = [];
  for (const input of body.querySelectorAll<HTMLInputElement>('input[data-green], input[data-fund]')) {
    const key = input.dataset.green ? 'green' : (input.dataset.fund as ServiceKind);
    const months = sim.state.effects[lockOf(key)] ?? 0;
    if (!months) continue;
    input.disabled = true;
    input.parentElement!.classList.add('locked');
    input.title = `No lo podés mover: quedan ${months === 1 ? 'un mes' : `${months} meses`} de compromiso.`;
    const label = input.parentElement!.querySelector('label')!.textContent;
    tied.push(`${label} no se puede mover: ${months === 1 ? 'un mes' : `${months} meses`} de compromiso`);
  }
  const lockNote = body.querySelector<HTMLElement>('#lockNote');
  if (lockNote && tied.length > 0) {
    lockNote.classList.remove('hidden');
    lockNote.textContent = `${tied.join('. ')}.`;
  }
  const green = body.querySelector<HTMLInputElement>('input[data-green]');
  green?.addEventListener('input', () => {
    sim.setGreen(Number(green.value));
    green.nextElementSibling!.textContent = `${sim.state.green} %`;
    // The plazas change their ground and lose their trees, so the map itself has to be painted again.
    const parks: number[] = [];
    for (let i = 0; i < game.world.tiles.length; i++) if (game.world.tiles[i] === TILE.PARK) parks.push(i);
    game.map.update(parks);
    game.view.invalidateLayer();
    refresh();
  });
  body.querySelectorAll<HTMLInputElement>('input[data-fund]').forEach((input) =>
    input.addEventListener('input', () => {
      const k = input.dataset.fund as ServiceKind;
      sim.setFunding(k, Number(input.value));
      input.nextElementSibling!.textContent = `${sim.state.funding[k]} %`;
      game.view.invalidateLayer();
      refresh();
    }),
  );
  refresh();
  drawHistory(body.querySelector<HTMLCanvasElement>('#chart')!, sim.state.history);
}

function drawHistory(c: HTMLCanvasElement, history: { pop: number; cash: number }[]): void {
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, c.width, c.height);
  if (history.length < 2) {
    g.fillStyle = '#c9b79a';
    g.font = "22px 'Chakra Petch', sans-serif";
    g.fillText('Todavía no pasó ni un mes', 20, 100);
    return;
  }
  const line = (values: number[], color: string) => {
    const min = Math.min(0, ...values);
    const max = Math.max(1, ...values);
    g.strokeStyle = color;
    g.lineWidth = 3;
    g.beginPath();
    values.forEach((v, k) => {
      const x = 10 + (k / (values.length - 1)) * (c.width - 20);
      const y = c.height - 10 - ((v - min) / (max - min)) * (c.height - 20);
      if (k === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    });
    g.stroke();
  };
  line(
    history.map((h) => h.cash),
    '#e0a526',
  );
  line(
    history.map((h) => h.pop),
    '#9fdc8a',
  );
}

// ---------------------------------------------------------------- approval

function factorRows(factors: readonly ApprovalFactor[]): string {
  if (factors.length === 0) return '<p>Nada para destacar: ni quejas ni aplausos.</p>';
  return `<table class="factors">${factors
    .map((f) => `<tr><td>${escapeHtml(f.label)}</td><td class="${f.points > 0 ? 'pos' : 'neg'}">${f.points > 0 ? '+' : ''}${f.points}</td></tr>`)
    .join('')}</table>`;
}

/**
 * The founding window: it opens as soon as the city does, because there is no city without a
 * party and a way of governing. The name is mandatory, so the window comes back if it is closed.
 */
export function openGovernment(game: Game): void {
  const state = game.sim.state;
  // While the papers are unsigned there is no way out: the close button is not an option.
  $('#modalClose').classList.add('hidden');
  const body = openModal(
    `<h2>Quién gobierna ${escapeHtml(game.name)}</h2>
    <p class="gov-lede">Antes de mover un ladrillo, los vecinos quieren saber quién firma. Ponele el nombre a tu partido y elegí cómo se gobierna.</p>
    <label class="gov-party">Nombre del partido
      <input id="govParty" maxlength="32" autocomplete="off" value="${escapeHtml(state.party)}" />
    </label>
    <div class="gov-grid" role="radiogroup" aria-label="Forma de gobierno">${governmentCardsHtml(state.government)}</div>
    <div class="row"><button id="govTake" class="primary" type="button" disabled>Asumir el cargo</button></div>
    <p class="gov-hint bad" id="govHint">El nombre del partido es obligatorio.</p>`,
    () => {
      // Closing the window without signing is not an option: it opens again.
      if (!game.sim.state.party) openGovernment(game);
    },
  );
  const input = body.querySelector<HTMLInputElement>('#govParty')!;
  const take = body.querySelector<HTMLButtonElement>('#govTake')!;
  const hint = body.querySelector<HTMLElement>('#govHint')!;
  const refresh = (): void => {
    const filled = input.value.trim().length > 0;
    take.disabled = !filled;
    hint.classList.toggle('bad', !filled);
    hint.textContent = filled ? 'Así va a figurar en El Diario del Conurbano.' : 'El nombre del partido es obligatorio.';
  };
  input.addEventListener('input', refresh);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !take.disabled) take.click();
  });
  take.addEventListener('click', () => {
    const party = input.value.trim().slice(0, 32);
    if (!party) return;
    const picked = body.querySelector<HTMLInputElement>('input[name="govPick"]:checked');
    const government = (picked?.value as GovernmentKind | undefined) ?? 'democracia';
    if (!GOVERNMENT_KINDS.includes(government)) return;
    game.found(government, party);
    $('#modalClose').classList.remove('hidden');
    closeModal();
  });
  refresh();
  input.focus();
}

/** What the neighbours think and why, when they vote, and who governs. */
export function openApproval(game: Game): void {
  const s = game.sim.state;
  const gov = GOVERNMENTS[s.government];
  const report = game.sim.approval;
  const trend = report.target > s.approval ? 'está subiendo' : report.target < s.approval ? 'está bajando' : 'se mantiene';
  const who = s.party ? `Partido ${escapeHtml(s.party)} · ${gov.label}` : gov.label;
  const vote = s.lostElection
    ? '<p>Perdiste las últimas elecciones: la ciudad sigue en <strong>modo libre</strong>, sin más votaciones.</p>'
    : gov.termYears === null
      ? `<p>Gobierno de facto: <strong>no hay elecciones</strong> y la aprobación no pasa del ${gov.approvalCap} %.</p>`
      : `<p>Próximas elecciones: <strong>octubre de ${nextElectionYear(s.tick, s.government)}</strong> (faltan ${monthsToElection(s.tick, s.government)} meses). Hace falta el ${gov.toWin} % para seguir.${s.terms ? ` Mandatos ganados: ${s.terms}.` : ''}</p>`;
  openModal(`
    <h2>Aprobación de los vecinos</h2>
    <p class="gov-tag"><small>${who}</small></p>
    <p>Hoy te aprueba el <strong>${s.approval} %</strong>. Por cómo está la ciudad, ${trend} hacia el <strong>${report.target} %</strong> (se mueve hasta ${gov.approvalStep} puntos por mes).</p>
    ${vote}
    <p>Y no es solo para las elecciones: cuanto más te aprueban los vecinos, más gente quiere venir a vivir y más rápido crece la ciudad. Si un gobierno tiene techo de aprobación, tiene el mismo techo para crecer.</p>
    <h3>Qué suma y qué resta</h3>
    <p><small>Se parte de 50 puntos. Las plazas que nadie mantiene también restan: una ciudad con los espacios verdes abandonados se ve descuidada, igual que una con edificios en ruinas. Y demoler algo construido enoja a los desalojados: se nota unos meses y después se olvida.</small></p>
    ${factorRows(report.factors)}
  `);
}

/** The ballot paper of an election night: the share of the votes, the bar it had to clear, and the stamp. */
function ballot(game: Game, stamp: string, won: boolean, rest: string): string {
  const s = game.sim.state;
  const gov = GOVERNMENTS[s.government];
  return `<div class="boleta${won ? '' : ' lost'}">
    <div class="band"></div>
    <h2 class="lista">Elecciones ${dateOf(s.tick).year} · Lista 3000</h2>
    <p>${game.mayor ? `${escapeHtml(game.mayor)}, ` : ''}Intendente de ${escapeHtml(game.name)}</p>
    <div class="num">${s.approval} %</div>
    <div class="votes" role="img" aria-label="${s.approval} % de los votos; hacía falta el ${gov.toWin} %"><i style="width:${s.approval}%"></i><b style="left:${gov.toWin}%"></b></div>
    <div class="stamp">${stamp}</div>
    ${rest}
  </div>`;
}

/** The night of a won election: the ballot with its stamp. Closing it goes back to the city. */
export function openElectionWon(game: Game): void {
  const s = game.sim.state;
  const body = openModal(
    ballot(
      game,
      'Reelecto',
      true,
      `<p>Hacía falta el ${GOVERNMENTS[s.government].toWin} %. Próxima votación: octubre de ${nextElectionYear(s.tick, s.government)}.${s.terms > 1 ? ` Mandatos ganados: ${s.terms}.` : ''}</p>
      <div class="row"><button id="wonStay" class="primary" type="button">Seguir gobernando</button></div>`,
    ),
    undefined,
    'boleta',
  );
  body.querySelector('#wonStay')!.addEventListener('click', closeModal);
}

/** The night of a lost election: what went wrong, and the choice to go on in free mode or leave. */
export function openElectionLost(game: Game, onLeave: () => void): void {
  const gov = GOVERNMENTS[game.sim.state.government];
  const complaints = game.sim.approval.factors.filter((f) => f.points < 0).slice(0, 4);
  const body = openModal(
    ballot(
      game,
      'No reelecto',
      false,
      `<p>Hacía falta el ${gov.toWin} %: los vecinos votaron y no te acompañaron.</p>
      ${complaints.length ? `<h3>De qué se quejaban</h3>${factorRows(complaints)}` : ''}
      <p>Podés seguir construyendo la ciudad en modo libre (ya no habrá elecciones) o volver al inicio y fundar otra.</p>
      <div class="row"><button id="lostStay" class="primary" type="button">Seguir en modo libre</button><button id="lostLeave" type="button">Volver al inicio</button></div>`,
    ),
    undefined,
    'boleta',
  );
  body.querySelector('#lostStay')!.addEventListener('click', closeModal);
  body.querySelector('#lostLeave')!.addEventListener('click', () => {
    closeModal();
    onLeave();
  });
}

// ---------------------------------------------------------------- milestone

const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** The bronze plaque of a reached milestone (an index of MILESTONES): its name, the grant and what it opens. */
export function openMilestone(game: Game, reached: number): void {
  const m = MILESTONES[reached];
  const { month, year } = dateOf(game.sim.state.tick);
  const opens = unlockNames(m, (t) => toolInfo(t).label);
  const screws = ['tl', 'tr', 'bl', 'br'].map((c) => `<i class="screw ${c}"></i>`).join('');
  const body = openModal(
    `<div class="plaqueta">${screws}
      <p>${escapeHtml(game.name)} alcanzó la categoría de</p>
      <h2>${escapeHtml(m.name)}</h2>
      <p>con ${formatNumber(m.pop)} habitantes · ${MONTH_NAMES[month - 1]} de ${year}</p>
      <p>La Provincia gira ${formatMoney(m.grant)}</p>
      ${opens ? `<p>Se habilita: ${escapeHtml(opens)}</p>` : ''}
      <div class="row"><button id="plaqueOk" class="primary" type="button">Seguir construyendo</button></div>
    </div>`,
    undefined,
    'plaqueta',
  );
  body.querySelector('#plaqueOk')!.addEventListener('click', closeModal);
}

// ---------------------------------------------------------------- saves

const SLOT_NAMES: Record<SlotId, string> = { '1': 'Ranura 1', '2': 'Ranura 2', '3': 'Ranura 3', auto: 'Autoguardado' };

/** Save/load dialog. `game` is null on the start screen (load only). */
export function openSaves(game: Game | null, onLoad: (data: SaveData) => void): void {
  const render = () => {
    const rows = SLOTS.map((slot) => {
      const info = slotInfo(slot);
      const meta = info
        ? `<strong>${escapeHtml(info.name)}</strong><small>${escapeHtml(info.date)} · ${formatNumber(info.pop)} habitantes${info.savedAt ? ` · guardada ${new Date(info.savedAt).toLocaleString('es-AR')}` : ''}</small>`
        : '<strong>Vacía</strong>';
      const canSave = game && slot !== 'auto';
      return `<div class="slot"><div class="meta"><small>${SLOT_NAMES[slot]}</small>${meta}</div>
        ${canSave ? `<button data-save="${slot}">Guardar acá</button>` : ''}
        ${info ? `<button data-load="${slot}" class="primary">Cargar</button><button data-del="${slot}" title="Borrar">Borrar</button>` : ''}</div>`;
    }).join('');
    const body = openModal(`
      <h2>${game ? 'Guardar o cargar' : 'Cargar partida'}</h2>
      <div class="slots">${rows}</div>
      <h3>Archivo</h3>
      <div class="row">
        ${game ? '<button id="exportFile">Descargar partida (.json)</button>' : ''}
        <label class="row"><button id="importBtn" type="button">Abrir archivo…</button><input id="importFile" type="file" accept=".json,application/json" class="hidden"></label>
      </div>
      <p><small>Las partidas se guardan en este navegador. Descargalas para no perderlas.</small></p>
    `);
    body.querySelectorAll<HTMLButtonElement>('[data-save]').forEach((b) =>
      b.addEventListener('click', () => {
        const slot = b.dataset.save as SlotId;
        if (slotInfo(slot) && !confirm('¿Pisar la partida guardada en esta ranura?')) return;
        try {
          saveToSlot(slot, game!.saveData());
          toast('Partida guardada');
          render();
        } catch (err) {
          toast((err as Error).message, true);
        }
      }),
    );
    body.querySelectorAll<HTMLButtonElement>('[data-load]').forEach((b) =>
      b.addEventListener('click', () => {
        if (game && !confirm('¿Cargar esa partida? Lo que no guardaste se pierde.')) return;
        try {
          const data = loadFromSlot(b.dataset.load as SlotId);
          closeModal();
          onLoad(data);
        } catch (err) {
          toast((err as Error).message, true);
        }
      }),
    );
    body.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((b) =>
      b.addEventListener('click', () => {
        if (!confirm('¿Borrar esta partida? No se puede deshacer.')) return;
        deleteSlot(b.dataset.del as SlotId);
        render();
      }),
    );
    body.querySelector('#exportFile')?.addEventListener('click', () => {
      const blob = new Blob([serialize(game!.saveData())], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${game!.name.replace(/[^\w\- áéíóúñÁÉÍÓÚÑ]/g, '').trim() || 'ciudad'}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    const file = body.querySelector<HTMLInputElement>('#importFile')!;
    body.querySelector('#importBtn')!.addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      if (!f) return;
      try {
        const data = deserialize(await f.text());
        closeModal();
        onLoad(data);
      } catch (err) {
        toast((err as Error).message, true);
      }
    });
  };
  render();
}

// ---------------------------------------------------------------- help

export function openHelp(): void {
  openModal(`
    <h2>Cómo se juega</h2>
    <ol class="steps">
      <li><strong>Construí una usina</strong> (tecla 9). Sin luz no se levanta ni una casita. El tiempo arranca en pausa: se pone en marcha con tu primera obra.</li>
      <li><strong>Trazá calles</strong> (3) arrastrando. Los lotes necesitan una calle a 3 lotes o menos.
        Si ponés calles pegadas una al lado de la otra, forman una <strong>avenida</strong> con más carriles cuanto más ancha sea, y aguanta más tránsito.
        Hay cuatro <strong>calidades</strong> y se eligen de una: calle de tierra (0), la más barata y la peor, que aguanta la mitad del tránsito del asfalto y no cruza el agua; asfalto (3), pavimento reforzado (R), que entra un 60 % más de tránsito y marca el medio con lucecitas amarillas,
        y bulevar (T), que entra un 80 % más: se dibuja con un cantero de cemento de un píxel en el medio del camino, angosto o ancho, y sus farolas bajan el delito alrededor.
        Arrastrá una calidad mejor sobre una calle y se mejora en el lugar: pagás solo la diferencia, sin demoler. Para bajar de calidad hay que demoler.</li>
      <li><strong>Zonificá</strong> residencial (5), comercial (6) e industrial (7) pegado a las calles. Al zonificar, la manzana se nivela sola y las calles hacen de rampa.
        La usina y cada edificio con luz alumbran hasta 3 lotes a su alrededor; para llevar la luz más lejos hace falta el tendido eléctrico (4), que también alumbra 3 lotes a su alrededor. Las calles no llevan luz.</li>
      <li><strong>Mirá la demanda</strong> (barras R C I arriba): la gente viene si hay trabajo, y el comercio y la industria siguen a la gente. Con apagones, con impuestos de más de 9 % en promedio o con muchos edificios abandonados la ciudad deja de atraer gente nueva y la demanda se queda en cero: al lado de las barras aparece el motivo.</li>
      <li><strong>Cuidá la caja.</strong> Cada semana cobrás impuestos y pagás mantenimiento. Al lado de la Caja ves el saldo estimado del mes y, si la caja no va a durar un año, cuántos meses alcanza. Con la caja en rojo no se construye nada y los vecinos empiezan a irse. Los servicios públicos cuestan una parte fija (el 25 %) y el resto según cuántos vecinos atienden.
        En el <strong>Presupuesto</strong> (P) ponés un impuesto para cada zona (cada una mueve solo la demanda de su zona) y decidís cuánto financiar cada servicio:
        al 50 % cuesta la mitad y cubre la mitad.
        Si la caja se queda sin resto, en el mismo panel podés <strong>pedir un crédito</strong>: entra la plata de una y se devuelve en cuotas fijas que se descuentan solas todos los meses. Uno por vez, y podés cancelar lo que queda cuando te sobre.</li>
      <li><strong>Plazas</strong> (8), agua y árboles suben el valor del suelo y dejan crecer edificios más altos. La industria contamina: alejala de las casas.</li>
      <li><strong>La costa.</strong> En la categoría Costa hay cinco obras de un lote que van pegadas al agua (un faro puede estar hasta a 2 lotes) y, salvo la costanera y el faro, funcionan solo con una calle a 3 lotes o menos; ninguna necesita luz.
        El <strong>muelle de pescadores</strong> (Z) da 12 empleos y vende pescado; la <strong>costanera</strong> (X) se arrastra como la plaza y sube el valor del suelo y la aprobación; el <strong>puerto de carga</strong> (V) da 40 empleos, hace rendir un 15 % más los impuestos industriales (hasta 45 %), contamina y carga las calles que llegan;
        el <strong>balneario</strong> (L) va sobre la arena y da turismo fuerte en verano (diciembre a febrero) y casi nada el resto del año; el <strong>faro</strong> (F) es uno solo por ciudad. En el Presupuesto, la costa tiene sus propias líneas.</li>
      <li>Si una usina no da abasto, aparecen rayos rojos sobre los edificios sin luz: hacé otra. Hay tres: <strong>a carbón</strong> (9), barata y con mucho humo; <strong>a gas</strong> (J), más cara y casi sin humo; y el <strong>parque eólico</strong> (K), sin humo y barato de mantener, que rinde más en lo alto de una loma y cerca del agua.</li>
      <li><strong>Servicios públicos</strong> (necesitan luz y cubren un radio): sin <strong>salita</strong> (U) las casas no pasan de chalet, y sin
        <strong>escuela</strong> (Y) no hay torres ni oficinas. La <strong>comisaría</strong> (I) baja el delito de los barrios densos y los
        <strong>bomberos</strong> (O) apagan los incendios antes de que se pierda el edificio. Al elegirlos se ve la capa de cobertura.</li>
      <li><strong>Casas, comercios y fábricas</strong> arrancan humildes (casa de chapa, kiosco o verdulería, tinglado). Con los años la mayoría mejora sola, pero algunas no: sus dueños no las tocan y quedan en pie al lado de los edificios nuevos. Si querés renovar, demolé la humilde: lo que se construya después nace acorde a lo que ya es la ciudad.</li>
      <li><strong>Tránsito.</strong> Cada vecino va a trabajar al comercio y a la industria más cercanos por las calles. Si pasa más gente de la que la calle aguanta, se satura (rojo en la capa Tránsito): baja el valor del suelo, los lotes crecen despacio y los vecinos se quejan. Se arregla con avenidas, con más caminos o acercando el trabajo a las casas.</li>
      <li><strong>Transportes</strong> (desde Ciudad, con 1.000 habitantes). Una <strong>línea de colectivos</strong> (Ñ) se pone a 3 lotes o menos de una calle: al colocarla elegís su color y un número que no puede repetirse. Alivia un 35 % del tránsito de las calles que quedan a 9 lotes a la redonda (varias líneas suman, hasta un 60 %) y se ven sus colectivos andar. Cuesta mantenerla cada mes, así que sirve para destrabar una calle sin ensancharla.</li>
      <li><strong>Aprobación y elecciones.</strong> Arriba ves qué porcentaje de los vecinos te aprueba (clic para el detalle). Suman la salud, la educación, los impuestos bajos, los barrios lindos y que la ciudad crezca; restan el delito, el humo, los apagones, el tránsito, el abandono, la falta de trabajo, los impuestos altos y la caja en rojo. En octubre cada 4 años (la primera vez en 1993) hay elecciones: con 50 % o más seguís; si perdés, la ciudad queda en modo libre. La forma de gobierno que elegís al entrar a la partida cambia la regla: la <strong>dictadura</strong> no tiene elecciones, pero atrae un 20 % menos de gente, no recibe subsidios de la Provincia y no pasa del 60 % de aprobación; la <strong>tecnocracia</strong> vota cada 6 años con el 50 %, pero la aprobación se mueve la mitad de rápido. La aprobación también decide cuánta gente quiere venir: cuanto más alta, más rápido crece la ciudad.</li>
      <li><strong>Hitos.</strong> Debajo de la población está el próximo hito. Al llegar, la Provincia gira plata y se habilitan edificios: salita y bomberos con 100 habitantes, escuela y comisaría con 200, usina a gas con 1.000 y parque eólico con 2.500. Sobre la costa: el muelle con 100 habitantes, la costanera con 200, el puerto y el balneario con 1.000 y el faro con 5.000.</li>
      <li>Un edificio sin luz, sin calle, con mucho delito o con la caja en rojo puede quedar <strong>abandonado</strong>: no paga y baja el valor de alrededor.</li>
    </ol>
    <h3>Controles</h3>
    <div class="help-grid">
      <span><kbd>1</kbd>–<kbd>9</kbd> herramientas · <kbd>Y</kbd> <kbd>U</kbd> <kbd>I</kbd> <kbd>O</kbd> servicios · <kbd>Z</kbd> <kbd>X</kbd> <kbd>V</kbd> <kbd>L</kbd> <kbd>F</kbd> costa</span>
      <span><kbd>3</kbd> <kbd>R</kbd> <kbd>T</kbd> calidades de calle · <kbd>B</kbd> tamaño de bloque</span>
      <span><kbd>Ctrl</kbd>+<kbd>Z</kbd> deshacer la última obra (devuelve todo dentro del mes, la mitad hasta un año)</span>
      <span>Arrastrar con clic izquierdo: construir</span>
      <span>Clic derecho o rueda apretada: mover el mapa</span>
      <span>Rueda: zoom · <kbd>+</kbd> <kbd>−</kbd></span>
      <span><kbd>Q</kbd> <kbd>E</kbd> rotar la vista</span>
      <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> o flechas: mover</span>
      <span><kbd>Espacio</kbd> pausa</span>
      <span><kbd>C</kbd> cambiar capa</span>
      <span><kbd>P</kbd> presupuesto · <kbd>G</kbd> partidas</span>
      <span><kbd>N</kbd> mostrar u ocultar el diario</span>
      <span><kbd>M</kbd> sonido sí o no</span>
      <span><kbd>Esc</kbd> cancelar o cerrar</span>
    </div>
    <p><small>Con la herramienta Consulta (1) un clic muestra la ficha del lote y por qué crece o no; arrastrando movés el mapa.</small></p>
    <p><small>El Diario del Conurbano sale a la calle recién cuando hay al menos dos viviendas, dos comercios y dos fábricas construidas; hasta entonces los avisos de plata están solo en la barra superior.</small></p>
    <p><small>Al fundar una ciudad inventada elegís el tipo de mapa: Con salida al mar (lomas suaves, un río ancho al este y un arroyo), Llanura (casi llano, con arroyo y laguna), Con gran relieve (cerros y valles por todo el mapa) o Sierras (cordones de montañas con valles anchos para construir). El tamaño puede ser Chico (128 × 128 lotes), Mediano (192) o Grande (256). Los mapas reales ignoran estas opciones.</small></p>
    <p><small>La <strong>ruta provincial</strong> es la calle de cuatro carriles, asfalto oscuro y guardarraíles, a un lote del borde de los mapas inventados (y de punta a punta, esquinas incluidas): se ve como la ruta que pasa por afuera de la ciudad, con una línea amarilla al medio, líneas blancas entre los carriles y un cartel verde "226" cada tanto. El terreno donde corre está nivelado. No se toca ni cuesta nada, y por ahí llega la gente nueva: las calles que trazás tienen que salir de ella. Los mapas reales no la tienen.</small></p>
    <p><small>Mapas reales: calles, agua y parques © colaboradores de OpenStreetMap (ODbL); relieve de Terrain Tiles (Mapzen y AWS, con datos de SRTM y otros).</small></p>
  `);
}

/**
 * The event of the month: what is going on, and the two ways out. The consequences are written on
 * the buttons — it is a decision, not a lottery — and it cannot be closed without choosing.
 */
export function openEvent(game: Game): void {
  const event = game.sim.openEvent();
  if (!event) return;
  const body = openModal(`
    <p class="event-kicker">Se cruza en la gestión</p>
    <h2>${escapeHtml(event.title)}</h2>
    <p>${escapeHtml(event.text)}</p>
    <div class="event-options">
      ${event.options
        .map(
          (o, k) =>
            `<button type="button" data-option="${k}"><b>${escapeHtml(o.label)}</b><span>${escapeHtml(o.detail)}</span></button>`,
        )
        .join('')}
    </div>
    <p><small>El tiempo está en pausa hasta que elijas.</small></p>
  `);
  body.querySelectorAll<HTMLButtonElement>('button[data-option]').forEach((btn) =>
    btn.addEventListener('click', () => {
      game.sim.answerEvent(Number(btn.dataset.option));
      closeModal();
      game.afterEvent();
    }),
  );
}
