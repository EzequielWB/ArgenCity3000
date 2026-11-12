/**
 * Headless balance check: builds a small grid city, then plays like a reasonable player for
 * 15 years and prints a yearly summary. The player adds a plant on blackouts and more zones
 * when lots run out, builds each public service once the city is big enough to need it, and
 * looks after the budget: with the cash running out it raises taxes (up to 9 %) and then
 * trims police and fire funding; with money to spare it undoes those cuts; and when nobody
 * wants to move in it lowers taxes again.
 * Run with `npm run probe`.
 */
import { World, TILE } from '../src/world/world';
import { generateTerrain } from '../src/world/terrain';
import { applyPlan, dragCells, planTool, type ToolId } from '../src/world/tools';
import { Simulation, newSimState } from '../src/sim/simulation';
import { DEFAULT_TAX, SERVICES, TICKS_PER_MONTH, type ServiceKind } from '../src/config';

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
  build('road', 4, row, 64, row);
  build('road', 4, row + 6, 64, row + 6);
  for (let x = 4; x <= 64; x += 12) build('road', x, row, x, row + 6);
  const kind: ToolId[] = ['zoneR', 'zoneR', 'zoneC', 'zoneR', 'zoneI'];
  kind.forEach((k, j) => build(k, 5 + j * 12, row + 1, 15 + j * 12, row + 5));
  build('park', 52, row + 2, 53, row + 3);
  // Every other row reserves a lot for each service (each covers about two rows around it).
  if (rows % 2 === 0) for (const [k, minPop, x] of SERVICE_PLAN) pending.push({ kind: k, minPop, x, y: row + 3 });
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

for (let year = 1; year <= 15; year++) {
  for (let m = 0; m < 12; m++) {
    for (let i = 0; i < TICKS_PER_MONTH; i++) sim.tick();
    if (sim.power.shortage && sim.state.cash > 4000) {
      build('plant', plantX, 20);
      plantX += 3;
    }
    buildServices();
    manageBudget();
    let free = 0;
    for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] >= TILE.R && w.tiles[i] <= TILE.I && w.level[i] === 0) free++;
    if (free < 40 && sim.state.cash > 3000 && row < 100) addRow();
  }
  const levels = [0, 0, 0, 0, 0];
  for (let i = 0; i < w.level.length; i++) if (w.level[i]) levels[w.level[i]]++;
  const b = sim.state.lastBudget!;
  const f = sim.state.funding;
  console.log(
    `año ${year}: pop ${sim.totals.pop} caja ${sim.state.cash} saldo ${b.balance}/mes servicios ${b.schools + b.clinics + b.police + b.firefighters} tasa ${sim.state.taxes.R} % policía/bomberos ${f.police}/${f.fire} % usinas ${w.plants.length} niveles ${levels.slice(1).join('/')} abandonados ${sim.abandonedCount} incendios ${sim.stats.firesStarted}/${sim.stats.buildingsBurned}`,
  );
}
