import { MAX_FUNDING, MAX_TAX, MIN_TAX, type ServiceKind } from '../config';
import { averageTax } from '../sim/demand';
import type { ZoneKind } from '../world/world';
import { formatMoney, formatNumber } from '../core/format';
import type { Game } from '../game';
import { deserialize, serialize, type SaveData } from '../save/save';
import { SLOTS, deleteSlot, loadFromSlot, saveToSlot, slotInfo, type SlotId } from '../save/slots';
import { monthlyBudget, type BudgetReport } from '../sim/budget';
import { APPROVAL, monthsToElection, nextElectionYear, type ApprovalFactor } from '../sim/politics';
import { $, escapeHtml, toast } from './dom';

let closeHook: (() => void) | null = null;

export function isModalOpen(): boolean {
  return !$('#modal').classList.contains('hidden');
}

export function openModal(html: string, onClose?: () => void): HTMLElement {
  const body = $('#modalBody');
  body.innerHTML = html;
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
  return `<table class="budget">
    ${row('Tasas residenciales', b.taxR)}
    ${row('Tasas comerciales', b.taxC)}
    ${row('Tasas industriales', b.taxI)}
    ${row('Total ingresos', b.income, 'total')}
    ${row('Calles y puentes', b.roads)}
    ${row('Tendido eléctrico', b.lines)}
    ${row('Plazas', b.parks)}
    ${row('Usinas', b.plants)}
    ${row('Escuelas', b.schools)}
    ${row('Salitas', b.clinics)}
    ${row('Comisarías', b.police)}
    ${row('Bomberos voluntarios', b.firefighters)}
    ${row('Administración municipal', b.services)}
    ${row('Total gastos', b.expenses, 'total')}
    <tr class="total"><td>Saldo del mes</td><td>${money(b.balance, true)}</td></tr>
  </table>`;
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
        <h3>Tasas por zona</h3>
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
        <p><small>Un servicio al 50 % cuesta la mitad y cubre la mitad. Por encima del 100 % atiende a más vecinos.</small></p>
        <h3>Caja y energía</h3>
        <p>Caja: <strong>${money(sim.state.cash)}</strong><br>
        Saldo anual estimado: <strong id="yearly"></strong><br>
        Energía: ${formatNumber(sim.power.use)} de ${formatNumber(sim.power.capacity)} MW (${game.world.plants.length} usina${game.world.plants.length === 1 ? '' : 's'})</p>
        <h3>Historia</h3>
        <canvas class="chart" id="chart" width="560" height="200" aria-label="Población y caja por mes"></canvas>
        <p><small><span style="color:#9fdc8a">━</span> población · <span style="color:#e0a526">━</span> caja</small></p>
      </section>
    </div>
    ${sim.state.lastBudget ? `<h3>Mes pasado</h3>${budgetTable(sim.state.lastBudget)}` : ''}
  `);
  const refresh = () => {
    const b = monthlyBudget(game.world, sim.state.taxes, sim.state.funding);
    $('#budgetNow').innerHTML = budgetTable(b);
    $('#yearly').innerHTML = money(b.balance * 12, true);
    const d = sim.demand;
    const avg = averageTax(sim.state.taxes);
    const demand = `Demanda: residencial ${d.R} · comercial ${d.C} · industrial ${d.I}.`;
    $('#taxNote').textContent =
      avg > 9
        ? `Tasas altas: entra más plata, pero baja la demanda y la ciudad deja de atraer gente nueva. ${demand}`
        : avg < 5
          ? `Tasas bajas: la ciudad crece más rápido pero entra menos plata. ${demand}`
          : `Cada tasa mueve la demanda de su zona. ${demand}`;
  };
  body.querySelectorAll<HTMLInputElement>('input[data-tax]').forEach((input) =>
    input.addEventListener('input', () => {
      const z = input.dataset.tax as ZoneKind;
      sim.setTax(Number(input.value), z);
      input.nextElementSibling!.textContent = `${sim.state.taxes[z]} %`;
      refresh();
    }),
  );
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
    g.font = '22px sans-serif';
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

/** What the neighbours think and why, and when they vote. */
export function openApproval(game: Game): void {
  const s = game.sim.state;
  const report = game.sim.approval;
  const trend = report.target > s.approval ? 'está subiendo' : report.target < s.approval ? 'está bajando' : 'se mantiene';
  const vote = s.lostElection
    ? '<p>Perdiste las últimas elecciones: la ciudad sigue en <strong>modo libre</strong>, sin más votaciones.</p>'
    : `<p>Próximas elecciones: <strong>octubre de ${nextElectionYear(s.tick)}</strong> (faltan ${monthsToElection(s.tick)} meses). Hace falta el ${APPROVAL.toWin} % para seguir.${s.terms ? ` Mandatos ganados: ${s.terms}.` : ''}</p>`;
  openModal(`
    <h2>Aprobación de los vecinos</h2>
    <p>Hoy te aprueba el <strong>${s.approval} %</strong>. Por cómo está la ciudad, ${trend} hacia el <strong>${report.target} %</strong> (se mueve hasta ${APPROVAL.step} puntos por mes).</p>
    ${vote}
    <h3>Qué suma y qué resta</h3>
    <p><small>Se parte de 50 puntos.</small></p>
    ${factorRows(report.factors)}
  `);
}

/** The night of a lost election: what went wrong, and the choice to go on in free mode or leave. */
export function openElectionLost(game: Game, onLeave: () => void): void {
  const s = game.sim.state;
  const complaints = game.sim.approval.factors.filter((f) => f.points < 0).slice(0, 4);
  const body = openModal(`
    <h2>Perdiste las elecciones</h2>
    <p>Los vecinos de ${escapeHtml(game.name)} votaron y solo el <strong>${s.approval} %</strong> te acompañó. Hacía falta el ${APPROVAL.toWin} %.</p>
    ${complaints.length ? `<h3>De qué se quejaban</h3>${factorRows(complaints)}` : ''}
    <p>Podés seguir construyendo la ciudad en modo libre (ya no habrá elecciones) o volver al inicio y fundar otra.</p>
    <div class="row"><button id="lostStay" class="primary" type="button">Seguir en modo libre</button><button id="lostLeave" type="button">Volver al inicio</button></div>
  `);
  body.querySelector('#lostStay')!.addEventListener('click', closeModal);
  body.querySelector('#lostLeave')!.addEventListener('click', () => {
    closeModal();
    onLeave();
  });
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
      <li><strong>Construí una usina</strong> (tecla 9). Sin luz no se levanta ni una casita.</li>
      <li><strong>Trazá calles</strong> (3) arrastrando. Los lotes necesitan una calle a 3 lotes o menos.
        Si ponés calles pegadas una al lado de la otra, forman una <strong>avenida</strong> con más carriles cuanto más ancha sea, y aguanta más tránsito.</li>
      <li><strong>Zonificá</strong> residencial (5), comercial (6) e industrial (7) pegado a las calles. Al zonificar, la manzana se nivela sola y las calles hacen de rampa.
        La usina y cada edificio con luz alumbran hasta 3 lotes a su alrededor; para llevar la luz más lejos hace falta el tendido eléctrico (4). Las calles no llevan luz.</li>
      <li><strong>Mirá la demanda</strong> (barras R C I arriba): la gente viene si hay trabajo, y el comercio y la industria siguen a la gente.</li>
      <li><strong>Cuidá la caja.</strong> Cada semana cobrás tasas y pagás mantenimiento. Al lado de la Caja ves el saldo estimado del mes y, si la caja no va a durar un año, cuántos meses alcanza. Con la caja en rojo no se construye nada y los vecinos empiezan a irse. Los servicios públicos cuestan una parte fija (el 25 %) y el resto según cuántos vecinos atienden.
        En el <strong>Presupuesto</strong> (P) ponés una tasa para cada zona (cada una mueve solo la demanda de su zona) y decidís cuánto financiar cada servicio:
        al 50 % cuesta la mitad y cubre la mitad.</li>
      <li><strong>Plazas</strong> (8), agua y árboles suben el valor del suelo y dejan crecer edificios más altos. La industria contamina: alejala de las casas.</li>
      <li>Si una usina no da abasto, aparecen rayos rojos sobre los edificios sin luz: hacé otra. Hay tres: <strong>a carbón</strong> (9), barata y con mucho humo; <strong>a gas</strong> (J), más cara y casi sin humo; y el <strong>parque eólico</strong> (K), sin humo y barato de mantener, que rinde más en lo alto de una loma y cerca del agua.</li>
      <li><strong>Servicios públicos</strong> (necesitan luz y cubren un radio): sin <strong>salita</strong> (U) las casas no pasan de chalet, y sin
        <strong>escuela</strong> (Y) no hay torres ni oficinas. La <strong>comisaría</strong> (I) baja el delito de los barrios densos y los
        <strong>bomberos</strong> (O) apagan los incendios antes de que se pierda el edificio. Al elegirlos se ve la capa de cobertura.</li>
      <li><strong>Tránsito.</strong> Cada vecino va a trabajar al comercio y a la industria más cercanos por las calles. Si pasa más gente de la que la calle aguanta, se satura (rojo en la capa Tránsito): baja el valor del suelo, los lotes crecen despacio y los vecinos se quejan. Se arregla con avenidas, con más caminos o acercando el trabajo a las casas.</li>
      <li><strong>Aprobación y elecciones.</strong> Arriba ves qué porcentaje de los vecinos te aprueba (clic para el detalle). Suman la salud, la educación, las tasas bajas y los barrios lindos; restan el delito, el humo, los apagones, el tránsito, el abandono, la falta de trabajo, las tasas altas y la caja en rojo. En octubre cada 4 años (la primera vez en 1993) hay elecciones: con 50 % o más seguís; si perdés, la ciudad queda en modo libre.</li>
      <li><strong>Hitos.</strong> Debajo de la población está el próximo hito. Al llegar, la Provincia gira plata y se habilitan edificios: salita y bomberos con 100 habitantes, escuela y comisaría con 200, usina a gas con 1.000 y parque eólico con 2.500.</li>
      <li>Un edificio sin luz, sin calle, con mucho delito o con la caja en rojo puede quedar <strong>abandonado</strong>: no paga y baja el valor de alrededor.</li>
    </ol>
    <h3>Controles</h3>
    <div class="help-grid">
      <span><kbd>1</kbd>–<kbd>9</kbd> herramientas · <kbd>Y</kbd> <kbd>U</kbd> <kbd>I</kbd> <kbd>O</kbd> servicios</span>
      <span><kbd>B</kbd> tamaño de bloque</span>
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
    <p><small>Mapas reales: calles, agua y parques © colaboradores de OpenStreetMap (ODbL); relieve de Terrain Tiles (Mapzen y AWS, con datos de SRTM y otros).</small></p>
  `);
}
