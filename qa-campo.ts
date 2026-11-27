/**
 * QA headless — cadena del campo (Lote → Silo → Feria).
 *
 * Pregunta: ¿la soja (risk 100) arruina la partida por sequías/plagas o acumula capital
 * desbalanceado, contra el trigo (risk 0) como apuesta tranquila? Y ¿conviene guardar para el
 * precio de invierno ($180) o vender en cosecha ($120) con la merma del 4 % mensual?
 *
 * El bot construye SOLO la cadena del campo (sin ciudad): eso mide el campo aislado, que es
 * también el caso extremo de explotación (dinero sin población que pagar servicios).
 *
 * Correr: npx vite-node qa-campo.ts [años=20]
 */
import { World } from './src/world/world';
import { SEA_LEVEL } from './src/world/terrain';
import { applyPlan, dragCells, planTool, type ToolId } from './src/world/tools';
import { Simulation, newSimState } from './src/sim/simulation';
import { CROPS, COSTS, TICKS_PER_MONTH } from './src/config';
import { climateMult, climateWord, priceTable } from './src/sim/campo';

declare const process: { argv: string[] };

const YEARS = Number(process.argv[2] ?? 20);
const SEEDS = [7, 40, 99];
const N = 64;

const CHAIN = { farms: 48, silos: 5, markets: 1 };

function buildChain(w: World, sim: Simulation): number {
  const b = (t: ToolId, ax: number, ay: number, bx = ax, by = ay) => {
    const p = planTool(w, t, dragCells(t, ax, ay, bx, by, 1, N));
    if (p.cells.length && sim.spend(p.cost)) {
      applyPlan(w, p);
      return p.cost;
    }
    return 0;
  };
  let spent = 0;
  // El camión necesita calle: una fila toca los silos y la primera fila de lotes (el resto llega
  // por la servidumbre entre lotes contiguos), y un tramo vertical baja hasta la feria.
  spent += b('road', 1, 3, 46, 3);
  spent += b('road', 45, 4, 45, 10);
  for (let k = 0; k < CHAIN.silos; k++) spent += b('silo', 2, 4 + k * 4);
  for (let k = 0; k < CHAIN.farms; k++) spent += b('farm', 8 + (k % 12) * 3, 4 + Math.floor(k / 12) * 3);
  for (let k = 0; k < CHAIN.markets; k++) spent += b('market', 46, 6);
  return spent;
}

interface YearStat { grown: number; sold: number; lost: number; spoiled: number; income: number; climate: string }

function run(risk: number, minPrice: number, seed: number): { yearly: YearStat[]; cash: number; spent: number } {
  // El clima del año sale del hash del NOMBRE de la ciudad (así lo hace la simulación), así que
  // cada corrida usa un nombre distinto para que las semillas traigan climas distintos.
  const cityName = `Campo${seed}`;
  const w = new World({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(N * N) });
  const sim = new Simulation(w, newSimState(seed), cityName);
  const spent = buildChain(w, sim);
  sim.setCampoRisk(risk);
  sim.state.order = { minPrice, keepTons: 0 };

  // El año del campo va de cosecha a cosecha (diciembre a noviembre): la producción del diciembre
  // es la del ciclo, y las ventas de los doce meses que la venden son su ingreso.
  const yearly: YearStat[] = [];
  for (let m = 0; m < 11; m++) for (let t = 0; t < TICKS_PER_MONTH; t++) sim.tick();
  for (let year = 0; year < YEARS; year++) {
    const cur: YearStat = { grown: 0, sold: 0, lost: 0, spoiled: 0, income: 0, climate: '' };
    for (let m = 0; m < 12; m++) {
      for (let t = 0; t < TICKS_PER_MONTH; t++) sim.tick();
      const r = sim.state.harvest;
      if (!r) continue;
      if (m === 0) {
        cur.grown = r.grown;
        cur.lost = r.lost;
        cur.climate = climateWord(r.climate) ?? 'lluvia';
      }
      cur.sold += r.sold;
      cur.spoiled += r.spoiled;
      cur.income += r.income;
    }
    yearly.push(cur);
  }
  return { yearly, cash: sim.state.cash, spent };
}

const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)] ?? 0;

console.log(`=== CADENA DEL CAMPO · ${YEARS} años · ${CHAIN.farms} lotes / ${CHAIN.silos} silos / ${CHAIN.markets} feria(s) ===`);
console.log(`costo de la cadena: farm $${COSTS.farm} silo $${COSTS.silo} market $${COSTS.market}`);
console.log(`trigo ${CROPS.trigo.tons} t/lote · soja ${CROPS.soja.tons} t/lote · cosecha ambos en mes ${CROPS.trigo.harvest}`);
console.log(`precio cosecha $${priceTable(0)[CROPS.trigo.harvest - 1]} → techo $${priceTable(0)[5]} (presión en 0); saturado: $${priceTable(2000)[5]}`);
console.log('precios por mes (presión 0):', priceTable(0).join(' '));

interface Verdict { risk: number; minPrice: number; avg: number; min: number; max: number; avgSpoiled: number; avgLost: number; profit: number; zeroYears: number }

const verdicts: Verdict[] = [];
for (const risk of [0, 50, 100]) {
  for (const minPrice of [0, 160]) {
    const runs = SEEDS.map((s) => run(risk, minPrice, s));
    const incomes = runs.map((r) => sum(r.yearly.map((y) => y.income)) / YEARS);
    const spoiled = runs.map((r) => sum(r.yearly.map((y) => y.spoiled)) / YEARS);
    const lost = runs.map((r) => sum(r.yearly.map((y) => y.lost)) / YEARS);
    const profits = runs.map((r) => (r.cash + r.spent) / YEARS);
    const zeroYears = Math.round(100 * sum(runs.map((r) => r.yearly.filter((y) => y.income === 0).length)) / sum(runs.map((r) => r.yearly.length)));
    const v: Verdict = {
      risk,
      minPrice,
      avg: Math.round(median(incomes)),
      min: Math.round(Math.min(...runs.flatMap((r) => r.yearly.map((y) => y.income)))),
      max: Math.round(Math.max(...runs.flatMap((r) => r.yearly.map((y) => y.income)))),
      avgSpoiled: Math.round(median(spoiled)),
      avgLost: Math.round(median(lost)),
      profit: Math.round(median(profits)),
      zeroYears,
    };
    verdicts.push(v);
    console.log(
      `risk ${String(risk).padStart(3)} minPrecio $${String(minPrice).padStart(3)} · ingreso medio $${v.avg}/año (peor año $${v.min}, mejor $${v.max}) · ` +
        `merma ${v.avgSpoiled} t/año · sin silo ${v.avgLost} t/año · ceros ${v.zeroYears}% de los años · ` +
        `caja neta (gastos pagados) $${v.profit}/año · caja final $${runs[0].cash}`,
    );
  }
}

// La apuesta arriesgada contra la tranquila, con la mejor orden de venta de cada una:
const t = verdicts.filter((v) => v.risk === 0 && v.minPrice === 160)[0];
const s = verdicts.filter((v) => v.risk === 100 && v.minPrice === 160)[0];
console.log(`\nVEREDICTO: trigo puro $${t.profit}/año neto vs soja pura $${s.profit}/año neto → soja/trigo = ${(s.profit / t.profit).toFixed(2)}x`);
console.log(`           la soja deja de entrar el ${s.zeroYears}% de los años (sequía/plaga)`);
