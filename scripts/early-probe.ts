/**
 * Early-game economy probe. Builds the city a real player described (a plant, a few streets,
 * 5x16 + 4x10 homes, a little commerce, a workshop zone and ONE of each public service) and
 * follows its cash for 5 years with two kinds of player:
 *   - watching: never touches taxes or funding (shows what the city does on its own);
 *   - reacting: raises the tax up to 9 % and trims police and fire funding when the cash runs
 *     low, like the long-run probe does.
 * Prints a table per player and the month in which the cash first went negative.
 * Run with `npx vite-node scripts/early-probe.ts`.
 */
import { World } from '../src/world/world';
import { SEA_LEVEL } from '../src/world/terrain';
import { applyPlan, dragCells, planTool, type ToolId } from '../src/world/tools';
import { Simulation, newSimState } from '../src/sim/simulation';
import { DEFAULT_TAX, SERVICES, TICKS_PER_MONTH } from '../src/config';

const MONTHS = 60;
const SHOWN = [1, 2, 3, 6, 9, 12, 18, 24, 36, 48, 60];

type Player = 'watching' | 'reacting';

function reactTo(sim: Simulation): void {
  const b = sim.state.lastBudget;
  if (!b) return;
  const st = sim.state;
  if (b.balance < 0 && st.cash < 8000) {
    if (st.taxes.R < 9) sim.setTax(st.taxes.R + 1);
    else for (const k of ['police', 'fire'] as const) sim.setFunding(k, Math.max(50, st.funding[k] - 10));
  } else if (b.balance > 1500 && st.cash > 20000) {
    if (st.funding.police < 100 || st.funding.fire < 100) for (const k of ['police', 'fire'] as const) sim.setFunding(k, Math.min(100, st.funding[k] + 10));
    else if (st.taxes.R > DEFAULT_TAX) sim.setTax(st.taxes.R - 1);
  }
}

function run(withServices: boolean, player: Player): void {
  const n = 48;
  const s = n + 1;
  const w = new World({ n, corners: new Uint8Array(s * s).fill(SEA_LEVEL + 1), trees: new Uint8Array(n * n) });
  const sim = new Simulation(w, newSimState(3), 'Prueba');
  const b = (t: ToolId, ax: number, ay: number, bx = ax, by = ay) => {
    const p = planTool(w, t, dragCells(t, ax, ay, bx, by, 1, n));
    if (p.cells.length && sim.spend(p.cost)) applyPlan(w, p);
  };
  b('plant', 2, 3);
  // Roads carry no light (S25): the light reaches 3 lots from the plant and from every building,
  // so the jobs zones, farther than that from the homes, get a power line (x = 21 is the line, the
  // roads leave a gap where it crosses them), and another one runs down the west side of the homes.
  b('road', 4, 4, 20, 4);
  b('road', 22, 4, 30, 4);
  b('line', 4, 3, 21, 3);
  b('line', 21, 4, 21, 16);
  b('line', 4, 5, 4, 14);
  b('road', 5, 12, 20, 12);
  b('road', 22, 12, 30, 12);
  b('zoneR', 5, 5, 20, 8); // homes
  b('zoneR', 5, 13, 14, 16);
  b('zoneC', 22, 5, 27, 8); // a little commerce
  b('zoneI', 22, 13, 27, 16); // workshops
  if (withServices) {
    b('school', 28, 5);
    b('clinic', 28, 7);
    b('police', 28, 13);
    b('fire', 28, 15);
  }
  const cost = withServices ? Object.values(SERVICES).reduce((a, v) => a + v.cost, 0) : 0;
  const rows: string[] = [];
  let firstNegative = 0;
  for (let m = 1; m <= MONTHS; m++) {
    for (let i = 0; i < TICKS_PER_MONTH; i++) sim.tick();
    const bud = sim.state.lastBudget!;
    if (!firstNegative && sim.state.cash < 0) firstNegative = m;
    if (SHOWN.includes(m)) {
      const services = bud.schools + bud.clinics + bud.police + bud.firefighters;
      const runway = bud.balance < 0 ? ` (${Math.max(0, Math.floor(sim.state.cash / -bud.balance))} meses de caja)` : '';
      rows.push(
        `mes ${String(m).padStart(2)}: pop ${String(sim.totals.pop).padStart(4)} ingresos ${String(bud.income).padStart(5)} gastos ${String(bud.expenses).padStart(5)} (servicios públicos ${String(services).padStart(4)}) saldo ${String(bud.balance).padStart(6)} caja ${String(sim.state.cash).padStart(6)}${runway}`,
      );
    }
    if (player === 'reacting') reactTo(sim);
  }
  console.log(`\n== ${player}, ${withServices ? 'con los 4 servicios desde el principio' : 'sin servicios'} (obra de servicios: $${cost})`);
  console.log(rows.join('\n'));
  console.log(firstNegative ? `-> la caja pasó a negativo en el mes ${firstNegative}` : `-> la caja nunca fue negativa en ${MONTHS} meses (final ${sim.state.cash})`);
}

run(true, 'watching');
run(true, 'reacting');
run(false, 'watching');
