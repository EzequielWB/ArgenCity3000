/**
 * Ceiling probe: builds a finished ~150k city by hand (level 5, lit, serviced) and lets it run
 * under every form of government, to find out whether the game can HOLD a good city at all.
 * It does not play: no growth skill is involved, so a collapse here is the game's ceiling, not a
 * bad player. Run with `npx vite-node scripts/ceiling-probe.ts [months] [--only=<gov>]`.
 */
import { World, TILE } from '../src/world/world';
import { SEA_LEVEL } from '../src/world/terrain';
import { applyPlan, dragCells, planTool, type ToolId } from '../src/world/tools';
import { Simulation, newSimState } from '../src/sim/simulation';
import { TICKS_PER_MONTH, type GovernmentKind, type ServiceKind } from '../src/config';

/** Node's argv, read the way every script in this folder reads it. */
const env = (globalThis as unknown as { process: { argv: string[] } }).process;


const N = 128;
const GOVS: GovernmentKind[] = ['democracia', 'dictadura', 'tecnocracia', 'teocracia', 'comunismo'];

/** Zone mix per 20 lots: 12 homes, 3 shops, 5 factories. */
const CYCLE: ('R' | 'C' | 'I')[] = [...Array(12).fill('R'), ...Array(3).fill('C'), ...Array(5).fill('I')] as const;

/** What a city of ~150k needs of each service: 150.000 / capacity, rounded up. */
const SERVICE_MIX: [ServiceKind, number][] = [
  ['school', 25],
  ['clinic', 25],
  ['police', 19],
  ['fire', 15],
  ['hospital', 8],
  ['university', 6],
];

/** 150k at level 5 asks for ~23.700 MW and a coal plant makes 600, so 42 gas plants with a margin. */
const PLANTS = 42;
/** Road, two rows of plants, two of services, three of lots, road. */
const BAND = 8;
const PITCH = 9;
const BANDS = 5;
const VROADS = [1, 12, 23, 34, 45, 56, 67, 78, 89, 100, 111, 122];

interface Report {
  government: GovernmentKind;
  pop0: number;
  pop12: number;
  pop24: number;
  abandoned: number;
  power: string;
  income: number;
  expenses: number;
  balance: number;
  approval: number;
  stall: string;
  lost: boolean;
}

function city(government: GovernmentKind, months: number, level: number): Report {
  const w = new World({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(N * N) });
  const build = (t: ToolId, ax: number, ay: number, bx = ax, by = ay) =>
    applyPlan(w, planTool(w, t, dragCells(t, ax, ay, bx, by, 1, N)));
  const isVRoad = (x: number) => VROADS.includes(x);

  let plantsLeft = PLANTS;
  // Round-robin, so the hospitals and universities that unlock the tallest buildings reach every band.
  const services: ServiceKind[] = [];
  const left = new Map(SERVICE_MIX);
  while ([...left.values()].some((n) => n > 0)) {
    for (const [kind, n] of left) {
      if (n > 0) {
        services.push(kind);
        left.set(kind, n - 1);
      }
    }
  }
  let serviceAt = 0;

  let zoneAt = 0;
  for (let b = 0; b < BANDS; b++) {
    const y0 = 2 + b * PITCH;
    build('road', 1, y0, 126, y0);
    build('road', 1, y0 + BAND, 126, y0 + BAND);
    for (const x of VROADS) build('road', x, y0, x, y0 + BAND);

    // One plant every 13 cells under the road, its 2x2 taking the two rows there.
    for (let x = 2; x < 122 && plantsLeft > 0; x += 13) {
      if (isVRoad(x) || isVRoad(x + 1)) continue;
      build('plantGas', x, y0 + 1);
      plantsLeft--;
    }
    // Services on the two rows under the plants, one every 11 cells.
    for (const y of [y0 + 3, y0 + 4]) {
      for (let x = 2; x < 122; x += 11) {
        if (isVRoad(x)) continue;
        const kind = services[serviceAt++];
        if (!kind) break;
        build(kind, x, y);
      }
    }
    // Homes, shops and factories on the three rows under the services.
    for (const y of [y0 + 5, y0 + 6, y0 + 7]) {
      for (let x = 2; x < 126; x++) {
        if (isVRoad(x)) continue;
        const kind = CYCLE[zoneAt++ % CYCLE.length];
        build(kind === 'R' ? 'zoneR' : kind === 'C' ? 'zoneC' : 'zoneI', x, y);
      }
    }
  }

  const sim = new Simulation(w, newSimState(1, government), 'Prueba');
  sim.state.cash = 40_000_000;
  if (env.argv.includes('--debug')) {
    const count = (t: number) => w.tiles.reduce((n, v) => n + (v === t ? 1 : 0), 0);
    console.log(`R ${count(TILE.R)} C ${count(TILE.C)} I ${count(TILE.I)} plantas ${count(TILE.PLANT)} servicios ${serviceAt}`);
  }
  for (let i = 0; i < w.tiles.length; i++) {
    const t = w.tiles[i];
    if (t === TILE.R || t === TILE.C || t === TILE.I) w.level[i] = level;
  }
  sim.refresh();
  const pop0 = sim.totals.pop;
  if (env.argv.includes('--debug')) console.log(`  ini: ${diagnose(w, sim)}`);

  let pop12 = 0;
  for (let m = 1; m <= months; m++) {
    for (let k = 0; k < TICKS_PER_MONTH; k++) sim.tick();
    if (m === Math.min(12, months)) pop12 = sim.totals.pop;
  }
  if (env.argv.includes('--debug')) console.log(`  fin: ${diagnose(w, sim)}`);

  return {
    government,
    pop0,
    pop12,
    pop24: sim.totals.pop,
    abandoned: sim.abandonedCount,
    power: `${sim.power.use}/${sim.power.capacity}${sim.power.shortage ? ' FALTA' : ''}`,
    income: Math.round(sim.state.lastBudget?.income ?? 0),
    expenses: Math.round(sim.state.lastBudget?.expenses ?? 0),
    balance: sim.state.lastBudget ? Math.round(sim.state.lastBudget.balance) : 0,
    approval: sim.state.approval,
    stall: sim.stall ?? '-',
    lost: sim.state.lostElection,
  };
}

/** What the city can stand right now: the constraint that caps the levels, in order. */
function diagnose(w: World, sim: Simulation): string {
  const stat = (a: Uint8Array) => {
    let min = 255;
    let sum = 0;
    let n = 0;
    for (let i = 0; i < a.length; i++) {
      if (w.level[i] === 0) continue;
      min = Math.min(min, a[i]);
      sum += a[i];
      n++;
    }
    return n ? `${min}/${Math.round(sum / n)}` : '-';
  };
  return `valor del suelo min/prom ${stat(w.landValue)} edu ${stat(w.edu)} salud ${stat(w.health)} hospital ${stat(w.hospital)} univ ${stat(w.university)} transito ${sim.congestion.worst}% atascado ${Math.round(sim.congestion.jammedShare * 100)}%`;
}

const months = Number(env.argv[2] ?? 24);
const level = Number(env.argv.find((a: string) => a.startsWith('--level='))?.slice(8) ?? 5);
const only = env.argv.find((a: string) => a.startsWith('--only='))?.slice(7) as GovernmentKind | undefined;
const pad = (v: string | number, w: number) => String(v).padStart(w);
const rows = (only ? [only] : GOVS).map((g) => city(g, months, level));

console.log(`\n ciudad terminada, ${months} meses, sin jugar (plata regalada)\n`);
console.log('gobierno      pop ini    año 1    año 2  abandon  luz           ingresos   gastos   saldo  aprob  freno    perdió');
for (const r of rows) {
  console.log(
    `${r.government.padEnd(13)}${pad(r.pop0, 8)}${pad(r.pop12, 9)}${pad(r.pop24, 9)}${pad(r.abandoned, 9)}  ${r.power.padEnd(12)}${pad(r.income, 9)}${pad(r.expenses, 9)}${pad(r.balance, 8)}${pad(`${r.approval}%`, 7)}  ${r.stall.padEnd(8)}${r.lost ? 'SÍ' : 'no'}`,
  );
}
