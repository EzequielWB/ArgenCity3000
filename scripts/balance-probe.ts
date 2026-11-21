/**
 * Headless balance check: builds a small grid city, then plays like a reasonable player for
 * 15 years and prints a yearly summary. The player adds a plant on blackouts and more zones
 * when lots run out (or homes are wanted and none are free), builds each public service once the city is big enough to need it, and
 * looks after the budget: with the cash running out it raises taxes (up to 9 %) and then
 * trims police and fire funding; with money to spare it undoes those cuts; and when nobody
 * wants to move in it lowers taxes again.
 * Run with `npm run probe`.
 */
import { World, TILE } from '../src/world/world';
import { generateTerrain } from '../src/world/terrain';
import { applyPlan, dragCells, planTool, type ToolId } from '../src/world/tools';
import { Simulation, newSimState } from '../src/sim/simulation';
import { COSTS, DEFAULT_TAX, SERVICES, SILO_CAPACITY, TICKS_PER_MONTH, type ServiceKind } from '../src/config';

declare const process: { env: Record<string, string | undefined> };

/**
 * Las palancas del probe, para poder comparar sin mover la vara de todos los días.
 *
 * `BOT=avenidas` le enseña al jugador automático lo que el probe clásico no sabía: el tránsito. Sin eso la
 * ciudad se satura al 178 %, la mitad de las calles quedan atascadas y la aprobación se hunde en «Tránsito
 * −12», así que el probe mide el agujero del bot y no el balance del juego. `CAMPO=1` le suma la cadena del
 * trigo, que hasta ahora el bot nunca construía y por eso el campo no aparecía en ninguna medición.
 */
const AVENIDAS = !!process.env['BOT'];
const CAMPO = !!process.env['CAMPO'];

const N = 128;
const w = new World(generateTerrain(7, N));
const sim = new Simulation(w, newSimState(7), 'Prueba');
const build = (t: ToolId, ax: number, ay: number, bx = ax, by = ay) => {
  const p = planTool(w, t, dragCells(t, ax, ay, bx, by, 1, N));
  if (p.cells.length && sim.spend(p.cost)) applyPlan(w, p);
};

/** Population at which the player builds each service, and where it goes in its row. */
const SERVICE_PLAN: [ServiceKind, number, number][] = [
  ['clinic', 500, 10],
  ['school', 900, 22],
  ['fire', 1500, 46],
  ['police', 2500, 34],
];
const pending: { kind: ServiceKind; minPop: number; x: number; y: number }[] = [];

// A grid of blocks: streets every 6 cells, R/C/I bands, a plaza per row.
let plantX = 6;
build('plant', plantX, 20);
plantX += 3;
let row = 22;
let rows = 0;
const addRow = () => {
  // Roads carry no light (S25): a building lights 3 lots around it, so homes alone would stop growing
  // (no jobs) before their light reached the shops and factories farther along the row. The first row
  // therefore gets a power line through the middle (a gap in the road marks where the plant's link
  // crosses it, and the cross streets leave a gap for the line); later rows are lit by the row above.
  if (rows === 0) {
    build('road', 4, row, 5, row);
    build('road', 7, row, 64, row);
    build('line', 6, row, 6, row + 2);
    build('line', 4, row + 3, 64, row + 3);
  } else build(AVENIDAS ? 'roadPaved' : 'road', 4, row, 64, row);
  build(AVENIDAS ? 'roadPaved' : 'road', 4, row + 6, 64, row + 6);
  for (let x = 4; x <= 64; x += 12) {
    if (rows === 0) {
      build('road', x, row, x, row + 2);
      build('road', x, row + 4, x, row + 6);
    } else build('road', x, row, x, row + 6);
  }
  const kind: ToolId[] = ['zoneR', 'zoneR', 'zoneC', 'zoneR', 'zoneI'];
  kind.forEach((k, j) => build(k, 5 + j * 12, row + 1, 15 + j * 12, row + 5));
  build('park', 52, row + 2, 53, row + 3);
  // Every other row reserves a lot for each service (each covers about two rows around it).
  if (rows % 2 === 0) for (const [k, minPop, x] of SERVICE_PLAN) pending.push({ kind: k, minPop, x, y: row + (rows === 0 ? 2 : 3) });
  rows++;
  row += 6;
};
addRow();

function buildServices(): void {
  for (let k = 0; k < pending.length; k++) {
    const s = pending[k];
    if (sim.totals.pop < s.minPop || sim.state.cash < SERVICES[s.kind].cost + 2000) continue;
    build('bulldoze', s.x, s.y);
    build(s.kind, s.x, s.y);
    pending.splice(k--, 1);
  }
}

/** El campo, si `CAMPO=1`: silo antes que feria, y un lote por vez mientras haya caja. */
function buildCampo(): void {
  if (!CAMPO) return;
  const caja = sim.state.cash;
  // Un silo cada diez lotes: la cosecha de un solo mes son las toneladas del lote y el silo aguanta diez
  // cosechas, así que con menos silos la mitad del trigo se pierde en el lote.
  const silos = Math.ceil(w.farms.length / 10);
  if (w.silos.length < silos && caja > COSTS.silo + 4000) return void build('silo', 66 + w.silos.length * 3, 22);
  // La feria va lejos de la fila de silos: pegada, el silo que seguía no entraba, `build` fallaba en silencio
  // y el bot se quedaba en 21 lotes para siempre.
  if (w.markets.length === 0 && caja > COSTS.market + 4000) return void build('market', 68, 46);
  // Hasta 48 lotes: es lo que la feria necesita para no estar de adorno, así que el probe mide el campo **a
  // pleno** y no un adorno de ocho lotes.
  if (w.farms.length < 48 && caja > COSTS.farm + 4000) {
    const k = w.farms.length;
    build('farm', 68 + (k % 8) * 3, 28 + Math.floor(k / 8) * 3);
  }
}

function manageBudget(): void {
  const b = sim.state.lastBudget;
  if (!b) return;
  const st = sim.state;
  if (b.balance < 0 && st.cash < 8000) {
    if (st.taxes.R < 9) sim.setTax(st.taxes.R + 1);
    else for (const k of ['police', 'fire'] as const) sim.setFunding(k, Math.max(50, st.funding[k] - 10));
  } else if (b.balance > 1500 && st.cash > 20000) {
    if (st.funding.police < 100 || st.funding.fire < 100) for (const k of ['police', 'fire'] as const) sim.setFunding(k, Math.min(100, st.funding[k] + 10));
    else if (st.taxes.R > DEFAULT_TAX) sim.setTax(st.taxes.R - 1);
  } else if (b.balance >= 0 && st.cash > 5000 && sim.demand.R < 10 && st.taxes.R > DEFAULT_TAX) {
    // Nobody wants to move in: taxes are scaring people away.
    sim.setTax(st.taxes.R - 1);
  }
}

/**
 * El año del campo, sumado mes a mes.
 *
 * Un promedio de quince años no sirve para juzgar la rentabilidad: el bot empieza con cero lotes y llega a la
 * cadena completa recién en el año cuatro, así que el promedio mezcla el arranque con el régimen. Lo que hay que
 * mirar es **un año entero en régimen**, con las toneladas, el precio que se cobró y lo que se perdió.
 */
const campoYear = { grown: 0, sold: 0, lost: 0, spoiled: 0, income: 0 };
let cajaAlEmpezar = 0;

for (let year = 1; year <= 15; year++) {
  cajaAlEmpezar = sim.state.cash;
  campoYear.grown = campoYear.sold = campoYear.lost = campoYear.spoiled = campoYear.income = 0;
  for (let m = 0; m < 12; m++) {
    for (let i = 0; i < TICKS_PER_MONTH; i++) sim.tick();
    if (sim.power.shortage && sim.state.cash > 4000) {
      build('plant', plantX, 20);
      plantX += 3;
    }
    buildServices();
    buildCampo();
    if (CAMPO && sim.state.harvest) {
      const r = sim.state.harvest;
      campoYear.grown += r.grown;
      campoYear.sold += r.sold;
      campoYear.lost += r.lost;
      campoYear.spoiled += r.spoiled;
      campoYear.income += r.income;
    }
    manageBudget();
    // Zone more land when lots run out, or when homes are wanted and no free home lot is left
    // (free commerce and industry lots alone must not hide that).
    let free = 0;
    let freeHomes = 0;
    for (let i = 0; i < w.tiles.length; i++) {
      if (w.tiles[i] < TILE.R || w.tiles[i] > TILE.I || w.level[i] !== 0) continue;
      free++;
      if (w.tiles[i] === TILE.R) freeHomes++;
    }
    if ((free < 40 || (sim.demand.R > 20 && freeHomes < 12)) && sim.state.cash > 3000 && row < 100) addRow();
  }
  const levels = [0, 0, 0, 0, 0];
  for (let i = 0; i < w.level.length; i++) if (w.level[i]) levels[w.level[i]]++;
  const b = sim.state.lastBudget!;
  const f = sim.state.funding;
  console.log(
    `año ${year}: pop ${sim.totals.pop} caja ${sim.state.cash} saldo ${b.balance}/mes ing ${b.income} gasto ${b.expenses} campo ${b.farmIncome} servicios ${b.schools + b.clinics + b.police + b.firefighters} tasa ${sim.state.taxes.R} % policía/bomberos ${f.police}/${f.fire} % usinas ${w.plants.length} niveles ${levels.slice(1).join('/')} abandonados ${sim.abandonedCount} incendios ${sim.stats.firesStarted}/${sim.stats.buildingsBurned} tránsito peor ${sim.congestion.worst} % atascados ${Math.round(sim.congestion.jammedShare * 100)} % aprobación ${sim.state.approval} % (merece ${sim.approval.target}) mandatos ${sim.state.terms}${sim.state.lostElection ? ' PERDIÓ' : ''} hito ${sim.state.milestone}`,
  );
  // Con `FACTORES=1` el probe dice además **por qué** merece esa aprobación: sin esto, un 22 % es un
  // número sin causa y no se sabe si el culpable es el tránsito, los servicios o los impuestos.
  if (CAMPO) {
    const k = campoYear;
    const porTonelada = k.sold > 0 ? Math.round(k.income / k.sold) : 0;
    console.log(
      `  campo: ${w.farms.length} lotes · ${w.silos.length} silos (${w.silos.length * SILO_CAPACITY} t) · ${w.markets.length} feria(s) · ` +
        `cosecha ${k.grown} t · vendió ${k.sold} t a $${porTonelada} promedio · perdió ${k.lost} t por falta de silo · merma ${k.spoiled} t · ` +
        `ingreso $${k.income}/año · caja ${cajaAlEmpezar} → ${sim.state.cash}`,
    );
  }
  if (process.env['FACTORES']) {
    console.log(`  factores: ${sim.approval.factors.map((f) => `${f.label} ${f.points > 0 ? '+' : ''}${f.points}`).join(' · ')}`);
    console.log(`  tránsito: peor ${sim.congestion.worst} % · atascados ${Math.round(sim.congestion.jammedShare * 100)} % · transporte ${b.transport}/mes · abandonados ${sim.abandonedCount}`);
  }
}
