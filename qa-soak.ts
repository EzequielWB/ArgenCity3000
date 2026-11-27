/**
 * QA headless — soak de 100 años: propagación de errores numéricos (NaN/Infinity/drift),
 * determinismo por semilla y rendimiento de la simulación.
 *
 * Dos instancias idénticas (misma semilla, mismas acciones) corren 100 años; cada mes se escanea
 * el estado en busca de valores no finitos, y cada mes se comparan instancia A y B campo por campo.
 * La ciudad usa el layout de bandas probado de `scripts/balance-probe.ts` para llegar sana y en
 * régimen: los lotes vacíos no llevan la luz, así que el crecimiento tiene que arrancar pegado a
 * la usina y encadenar edificio a edificio.
 *
 * Correr: npx vite-node qa-soak.ts [años=100]
 */
import { World, TILE } from './src/world/world';
import { SEA_LEVEL } from './src/world/terrain';
import { applyPlan, dragCells, planTool, type ToolId } from './src/world/tools';
import { Simulation, newSimState } from './src/sim/simulation';
import { TICKS_PER_MONTH, type ServiceKind } from './src/config';

declare const process: { argv: string[] };

const YEARS = Number(process.argv[2] ?? 100);
const N = 64;

/** Ciudad de bandas, idéntica en las dos instancias: el schedule no mira el estado. */
function makeCity(seed: number): { w: World; sim: Simulation; plantX: number; row: number; rows: number; pending: { kind: ServiceKind; minPop: number; x: number; y: number }[] } {
  const w = new World({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(N * N) });
  const sim = new Simulation(w, newSimState(seed), `Soak${seed}`);
  const b = (t: ToolId, ax: number, ay: number, bx = ax, by = ay) => {
    const p = planTool(w, t, dragCells(t, ax, ay, bx, by, 1, N));
    if (p.cells.length && sim.spend(p.cost)) applyPlan(w, p);
  };
  // Franja de usinas arriba; los servicios entran por umbral de población (como balance-probe).
  b('plant', 6, 20);
  // Campo chico a la derecha, conectado a la última fila de calles.
  b('road', 46, 46, 62, 46);
  b('silo', 48, 47);
  b('farm', 48, 42, 49, 43);
  b('farm', 51, 42, 52, 43);
  b('farm', 54, 42, 55, 43);
  b('market', 57, 43);
  sim.setCampoRisk(50);
  sim.state.order = { minPrice: 0, keepTons: 0 };
  sim.setTax(9);

  let plantX = 10;
  let row = 22;
  let rows = 0;
  const road = (t: ToolId, ax: number, ay: number, bx: number, by: number): void => {
    const p = planTool(w, t, dragCells(t, ax, ay, bx, by, 1, N));
    if (p.cells.length && sim.spend(p.cost)) applyPlan(w, p);
  };
  const pending: { kind: ServiceKind; minPop: number; x: number; y: number }[] = [];
  const addRow = (): void => {
    if (rows === 0) {
      road('road', 4, row, 5, row);
      road('road', 7, row, 60, row);
      road('line', 6, row, 6, row + 2);
      road('line', 4, row + 3, 60, row + 3);
    } else road('roadPaved', 4, row, 60, row);
    road('roadPaved', 4, row + 6, 60, row + 6);
    for (let x = 4; x <= 60; x += 12) {
      if (rows === 0) {
        road('road', x, row, x, row + 2);
        road('road', x, row + 4, x, row + 6);
      } else road('roadPaved', x, row, x, row + 6);
    }
    const kinds: ToolId[] = ['zoneR', 'zoneR', 'zoneC', 'zoneR', 'zoneI'];
    kinds.forEach((k, j) => b(k, 5 + j * 12, row + 1, 15 + j * 12, row + 5));
    b('park', 58, row + 2, 59, row + 3);
    if (rows % 2 === 0) {
      const plan: [ServiceKind, number, number][] = [['school', 500, 10], ['clinic', 900, 22], ['fire', 1500, 34], ['police', 2500, 46]];
      plan.forEach(([k, minPop, x]) => pending.push({ kind: k, minPop, x, y: row + (rows === 0 ? 2 : 3) }));
    }
    rows++;
    row += 6;
  };
  addRow();
  return { w, sim, plantX, row, rows, pending };
}

interface City {
  w: World;
  sim: Simulation;
  plantX: number;
  row: number;
  rows: number;
  pending: { kind: ServiceKind; minPop: number; x: number; y: number }[];
}

/** Las acciones del jugador, iguales en ambas instancias. */
function step(c: City, monthsDone: number): void {
  const { w, sim } = c;
  const build = (t: ToolId, ax: number, ay: number, bx = ax, by = ay): void => {
    const p = planTool(w, t, dragCells(t, ax, ay, bx, by, 1, N));
    if (p.cells.length && sim.spend(p.cost)) applyPlan(w, p);
  };
  // Usina nueva con margen angosto (o en apagón), en la franja de arriba.
  if ((sim.power.shortage || (sim.power.capacity > 0 && sim.power.use > sim.power.capacity * 0.75)) && sim.state.cash > 4000) {
    build('plant', c.plantX, 20);
    c.plantX += 3;
  }
  // Abandonados despejados: hasta 5 por mes si la caja alcanza.
  let cleared = 0;
  for (let i = 0; i < w.abandoned.length && cleared < 5; i++) {
    if (!w.abandoned[i] || w.level[i] === 0 || sim.state.cash < 2000) continue;
    build('bulldoze', i % N, (i - (i % N)) / N);
    cleared++;
  }
  // Servicios cuando la población los pide.
  for (let k = 0; k < c.pending.length; k++) {
    const s = c.pending[k];
    if (sim.totals.pop < s.minPop || sim.state.cash < 4000) continue;
    build('bulldoze', s.x, s.y);
    build(s.kind, s.x, s.y);
    c.pending.splice(k--, 1);
  }
  // Presupuesto: la misma receta de balance-probe, más el crédito chico cuando la caja baja.
  const b0 = sim.state.lastBudget;
  const st = sim.state;
  if (b0) {
    if (b0.balance < 0 && st.cash < 8000) {
      if (st.taxes.R < 9) sim.setTax(st.taxes.R + 1);
      else for (const k of ['police', 'fire'] as const) sim.setFunding(k, Math.max(50, st.funding[k] - 10));
    } else if (b0.balance > 1500 && st.cash > 20000) {
      if (st.funding.police < 100 || st.funding.fire < 100) for (const k of ['police', 'fire'] as const) sim.setFunding(k, Math.min(100, st.funding[k] + 10));
      
    }
    if (!st.loan && st.cash < 8000 && b0.balance > -1500) sim.takeLoan(0);
  }
  // Una banda cada dos años, sólo si la caja la aguanta (schedule + estado idénticos en A y B).
  if (monthsDone % 24 === 23 && c.row < N - 8 && st.cash > 20000 + Math.max(0, -(b0?.balance ?? 0)) * 12 && sim.congestion.worst < 60) {
    const y0 = c.row;
    if (c.rows === 0) { /* la primera ya está */ }
    build('roadPaved', 4, y0, 60, y0);
    build('roadPaved', 4, y0 + 6, 60, y0 + 6);
    for (let x = 4; x <= 60; x += 12) build('roadPaved', x, y0, x, y0 + 6);
    const kinds: ToolId[] = ['zoneR', 'zoneR', 'zoneC', 'zoneR', 'zoneI'];
    kinds.forEach((k, j) => build(k, 5 + j * 12, y0 + 1, 15 + j * 12, y0 + 5));
    build('park', 58, y0 + 2, 59, y0 + 3);
    const plan: [ServiceKind, number, number][] = [['school', 500, 10], ['clinic', 900, 22], ['fire', 1500, 34], ['police', 2500, 46]];
    plan.forEach(([k, minPop, x]) => c.pending.push({ kind: k, minPop, x, y: y0 + 3 }));
    c.rows++;
    c.row += 6;
  }
}

const isBad = (v: unknown): boolean => typeof v === 'number' && !Number.isFinite(v);

/** Escanea los números vivos del estado; devuelve la descripción del primer valor no finito. */
function scan(sim: Simulation, w: World): string | null {
  const s = sim.state;
  const scalars: [string, unknown][] = [
    ['cash', s.cash], ['approval', s.approval], ['favor', s.favor], ['grief', s.grief], ['dry', s.dry],
    ['tick', s.tick], ['rngState', s.rngState],
    ['power.use', sim.power.use], ['power.capacity', sim.power.capacity],
    ['congestion.worst', sim.congestion.worst], ['congestion.jammedShare', sim.congestion.jammedShare],
    ['demand.R', sim.demand.R], ['demand.C', sim.demand.C], ['demand.I', sim.demand.I],
    ['totals.pop', sim.totals.pop], ['totals.jobs', sim.totals.jobs], ['totals.residents', sim.totals.residents],
    ['abandonedCount', sim.abandonedCount],
  ];
  for (const [name, v] of scalars) if (isBad(v)) return `${name} = ${String(v)}`;
  const b = s.lastBudget;
  if (b) {
    for (const k of Object.keys(b) as (keyof typeof b)[]) {
      if (isBad(b[k])) return `lastBudget.${String(k)} = ${String(b[k])}`;
    }
  }
  const arrays: [string, ArrayLike<number>][] = [
    ['landValue', w.landValue], ['pollution', w.pollution], ['crime', w.crime], ['edu', w.edu],
    ['health', w.health], ['traffic', w.traffic], ['jam', w.jam], ['fireCover', w.fireCover],
    ['level', w.level], ['powered', w.powered as unknown as ArrayLike<number>],
  ];
  for (const [name, arr] of arrays) {
    for (let i = 0; i < arr.length; i++) {
      if (isBad(arr[i])) return `${name}[${i}] = ${String(arr[i])}`;
    }
  }
  return null;
}

/** Hash barato de las grillas del mundo, para comparar determinismo año a año. */
function worldHash(w: World): string {
  const parts = [w.tiles, w.level, w.variant, w.terrain.corners, w.landValue, w.pollution];
  let h = 0x811c9dc5;
  for (const a of parts) {
    for (let i = 0; i < a.length; i++) {
      h ^= a[i];
      h = Math.imul(h, 0x01000193);
    }
  }
  return (h >>> 0).toString(16);
}

const A = makeCity(7) as City;
const B = makeCity(7) as City;
let firstBad: string | null = null;
let firstDiverge: string | null = null;
let monthsDone = 0;
let lastHashA = '';
let prevPop = 0;
const t0 = Date.now();

for (let year = 0; year < YEARS; year++) {
  for (let m = 0; m < 12; m++) {
    for (let t = 0; t < TICKS_PER_MONTH; t++) {
      A.sim.tick();
      B.sim.tick();
    }
    step(A, monthsDone);
    step(B, monthsDone);
    monthsDone++;
    if (!firstBad) {
      firstBad = scan(A.sim, A.w) ?? scan(B.sim, B.w);
      if (firstBad) console.log(`VALOR NO FINITO en año ${year} mes ${m + 1}: ${firstBad}`);
    }
    if (!firstDiverge) {
      const sa = A.sim.state, sb = B.sim.state;
      if (sa.cash !== sb.cash || sa.approval !== sb.approval || sa.tick !== sb.tick || sa.rngState !== sb.rngState || A.sim.totals.pop !== B.sim.totals.pop) {
        firstDiverge = `año ${year} mes ${m + 1}: A(cash ${sa.cash}, pop ${A.sim.totals.pop}) vs B(cash ${sb.cash}, pop ${B.sim.totals.pop})`;
        console.log(`DIVERGENCIA ${firstDiverge}`);
      }
    }
  }
  if (year % 5 === 0) {
    const h = worldHash(A.w);
    if (lastHashA && h !== worldHash(B.w)) console.log(`DIVERGENCIA de mundo en año ${year}`);
    lastHashA = h;
  }
  if (year < 5 || year % 10 === 0) {
    const s = A.sim.state;
    const b = s.lastBudget;
    const levels = [0, 0, 0, 0, 0];
    for (let i = 0; i < A.w.level.length; i++) if (A.w.level[i]) levels[Math.min(4, A.w.level[i])]++;
    console.log(`año ${year}: pop ${A.sim.totals.pop} caja ${s.cash} (drift ${s.cash % 1 !== 0 ? 'NO ENTERO: ' + s.cash : 'no'}) saldo ${b?.balance} aprob ${s.approval} tránsito ${A.sim.congestion.worst}% aband ${A.sim.abandonedCount} niveles ${levels.slice(1).join('/')} luz ${A.sim.power.use}/${A.sim.power.capacity}`);
    if (A.sim.totals.pop === 0 && prevPop > 0) {
      console.log('  COLAPSO — últimas noticias:');
      for (const n of s.news.slice(-6)) console.log(`   · ${typeof n === 'string' ? n : (n as { text?: string }).text}`);
      console.log(`  año virtual ${1990 + Math.floor(s.tick / TICKS_PER_MONTH / 12)} · elecciones perdidas ${s.lostElection} · mandatos ${s.terms} · tasa ${s.taxes.R} · financ. esc/cli/pol/bom ${s.funding.school}/${s.funding.clinic}/${s.funding.police}/${s.funding.fire} · transporte ${s.transport} · caminos ${s.roads} · luz ${s.plants}`);
    }
    prevPop = A.sim.totals.pop;
  }
}

const ms = Date.now() - t0;
console.log(`\n${YEARS} años × 2 instancias en ${ms} ms (${(ms / 2 / YEARS).toFixed(1)} ms/año, ${(ms / 2 / YEARS / 12).toFixed(2)} ms/mes, ${(ms / 2 / YEARS / 12 / TICKS_PER_MONTH * 1e6).toFixed(0)} µs/tick)`);
console.log(`población final ${A.sim.totals.pop} · niveles ocupados ${[0, 0, 0, 0, 0].map((_, l) => A.w.level.reduce((n, v) => n + (v === l + 1 ? 1 : 0), 0)).join('/')}`);
console.log(firstBad ? `RESULTADO: FALLA — ${firstBad}` : `RESULTADO: ${YEARS} años sin NaN/Infinity en estado, presupuesto ni indicadores`);
console.log(firstDiverge ? `RESULTADO: DETERMINISMO FALLA — ${firstDiverge}` : 'RESULTADO: determinismo exacto entre instancias (misma semilla → misma caja, misma población, mismo mundo)');
console.log(`hash final del mundo A: ${lastHashA || worldHash(A.w)} · igual al de B: ${worldHash(A.w) === worldHash(B.w) ? 'SÍ' : 'NO'} · caja final A $${A.sim.state.cash} · B $${B.sim.state.cash}`);
void TILE;
