/**
 * QA headless — deuda municipal y subsidio provincial.
 *
 * Preguntas:
 * 1. ¿Los 3 créditos ($10k/$25k/$50k) se pagan exactamente lo que dice `loanTotal`, mes a mes,
 *    y la cuota descontada en `monthlyBudget()` arranca o cierra el crédito en el mes justo?
 * 2. ¿La refinanciación en cadena (crédito → se termina → otro crédito) se sostiene para siempre
 *    o la caja termina en intervención (12 meses en rojo)? ¿Hay algún déficit con el que tomar
 *    créditos RENTE?
 * 3. ¿El subsidio provincial ($15.000 al bajar de $5.000) es una sola vez por partida, sin doble cobro?
 *
 * Correr: npx vite-node qa-deuda.ts
 */
import { World } from './src/world/world';
import { SEA_LEVEL } from './src/world/terrain';
import { applyPlan, dragCells, planTool, type ToolId } from './src/world/tools';
import { Simulation, newSimState, type SimState } from './src/sim/simulation';
import { BANKRUPT_MONTHS, LOANS, MIN_TAX, TICKS_PER_MONTH } from './src/config';
import { loanTotal } from './src/sim/loans';
import { SUBSIDY } from './src/config';
import { subsidyDue, takeSubsidy } from './src/sim/subsidy';

const N = 48;

/** Ciudad en déficit estructural: impuestos en el mínimo, gastos fijos (usina, calles) y cero ingresos. */
function deficitCity(seed: number, tax = MIN_TAX): { w: World; sim: Simulation } {
  const w = new World({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(N * N) });
  const sim = new Simulation(w, newSimState(seed), `Deuda${seed}`);
  const b = (t: ToolId, ax: number, ay: number, bx = ax, by = ay) => {
    const p = planTool(w, t, dragCells(t, ax, ay, bx, by, 1, N));
    if (p.cells.length && sim.spend(p.cost)) applyPlan(w, p);
  };
  b('plant', 2, 2);
  b('road', 1, 5, 40, 5);
  b('road', 1, 11, 40, 11);
  b('zoneR', 2, 6, 20, 10);
  b('zoneC', 22, 6, 30, 10);
  b('zoneI', 22, 12, 34, 16);
  // Dos escuelas y una clínica: sueldo fijo todos los meses con poca población, déficit hondo.
  b('school', 34, 6);
  b('school', 38, 6);
  b('clinic', 34, 12);
  sim.setTax(tax);
  return { w, sim };
}

const runMonths = (sim: Simulation, months: number): void => {
  for (let m = 0; m < months; m++) for (let t = 0; t < TICKS_PER_MONTH; t++) sim.tick();
};

console.log('=== 1. MECÁNICA DE LOS TRES CRÉDITOS (ciudad en déficit estructural) ===');
for (let kind = 0; kind < LOANS.length; kind++) {
  const { w, sim } = deficitCity(7);
  runMonths(sim, 6); // asentar el déficit
  const deficit = sim.state.lastBudget?.balance ?? 0;
  const before = sim.state.cash;
  const ok = sim.takeLoan(kind);
  const after = sim.state.cash;
  let paid = 0;
  for (let m = 0; m < LOANS[kind].months; m++) {
    runMonths(sim, 1);
    paid += sim.state.lastBudget?.loan ?? 0;
  }
  const loanStillOpen = sim.state.loan !== null;
  // Dos meses más: después del plazo no debe quedar cuota colgando.
  runMonths(sim, 2);
  const paidExtra = (sim.state.lastBudget?.loan ?? 0) > 0;
  const expectedCash = after - loanTotal({ kind, paid: 0 }) + (deficit - 0) * LOANS[kind].months;
  console.log(
    `crédito ${kind} ($${LOANS[kind].amount}, ${LOANS[kind].months} cuotas, tasa ${LOANS[kind].rate}): tomado=${ok} · caja ${before}→${after} (+$${after - before}) · ` +
      `déficit de base ${deficit}/mes · pagado en ${LOANS[kind].months} cuotas: $${paid} (total declarado $${loanTotal({ kind, paid: 0 })}) · ` +
      `caja final $${sim.state.cash} (proyectada $${expectedCash}, sin contar el redondeo de cuotas) · ` +
      `cuotas pagadas de más: ${paidExtra ? 'SÍ (bug)' : 'no'} · crédito sigue abierto al terminar: ${loanStillOpen ? 'SÍ (bug)' : 'no'}`,
  );
}

console.log('\n=== 2. CADENA DE REFINANCIACIÓN: déficit hondo (impuestos 0 + 6 servicios), crédito chico siempre que se pueda ===');
{
  const { sim } = deficitCity(7);
  runMonths(sim, 6);
  let taken = 0;
  let redMonths = 0;
  let maxRed = 0;
  const curve: number[] = [];
  for (let m = 0; m < 240; m++) {
    if (!sim.state.loan && sim.state.cash < 6000) {
      if (sim.takeLoan(0)) taken++;
    }
    for (let t = 0; t < TICKS_PER_MONTH; t++) sim.tick();
    if (sim.state.cash < 0) redMonths++;
    maxRed = Math.max(maxRed, sim.state.dry);
    if (m % 24 === 0) curve.push(sim.state.cash);
    if (sim.state.lostElection) break;
  }
  const tail = sim.state.news.slice(-3).map((n) => `«${n.text ?? n}»`).join(' | ');
  console.log(`créditos tomados: ${taken} · meses en rojo: ${redMonths}/240 · racha roja máxima: ${maxRed} (interviene en ${BANKRUPT_MONTHS}) · ` +
    `intervención/derrota: ${sim.state.lostElection ? `SÍ al mes ${sim.state.tick / TICKS_PER_MONTH | 0} (el bucle no es infinito: el juego lo corta)` : 'no, la caja sobrevivió'} · caja final $${sim.state.cash}`);
  console.log(`caja por año: ${curve.join(' → ')}`);
  console.log(`últimas noticias: ${tail}`);
}

console.log('\n=== 2b. ¿Hay déficit con el que TOMAR CRÉDITOS RENTE? (mismo crédito, déficit variable) ===');
{
  // Un crédito $10k cuesta $13k en cuotas: mientras el déficit sin crédito sea D, cada ciclo de 24
  // meses deja la caja en −3000 − 24·D. Nunca renta: se mide para confirmarlo.
  for (const tax of [MIN_TAX, 1, 2, 3]) {
    const { sim } = deficitCity(7, tax);
    runMonths(sim, 6);
    const d0 = sim.state.lastBudget?.balance ?? 0;
    sim.takeLoan(0);
    runMonths(sim, LOANS[0].months);
    const projected = -3000 + 24 * d0;
    console.log(`tax ${tax}: déficit sin crédito ${d0}/mes → ciclo completo deja Δ$${projected} ${projected < 0 ? '(pierde)' : '(GANA: revisar)'}`);
  }
}

console.log('\n=== 3. SUBSIDIO PROVINCIAL: una sola vez por partida ===');
{
  const s: SimState = newSimState(1);
  console.log(`dispara con caja $${s.cash} (trigger $${SUBSIDY.trigger}): ${subsidyDue(s) ? 'SÍ' : 'no (esperado: la caja arranca arriba)'}`);
  s.cash = SUBSIDY.trigger - 1;
  console.log(`bajo el trigger: due=${subsidyDue(s)}`);
  const got = takeSubsidy(s);
  console.log(`1º cobro: +$${got} → caja $${s.cash}, marcado=${s.subsidy}`);
  const again = takeSubsidy(s);
  console.log(`2º cobro: +$${again} ${again === 0 ? '(correcto: no paga dos veces)' : '(BUG: cobró de nuevo)'}`);
  s.cash = 0;
  console.log(`caja en 0 otra vez: due=${subsidyDue(s)} ${subsidyDue(s) ? '(BUG: el telegrama vuelve a aparecer)' : '(correcto: no vuelve)'}`);
}
