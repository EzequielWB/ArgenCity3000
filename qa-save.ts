/**
 * QA headless — serialización y carga de estado en medio de eventos activos.
 *
 * Escenarios:
 * 1. Guardar y restaurar con préstamo activo, stock en silos, cosecha por venir y un evento
 *    pendiente en el papel: la partida restaurada tiene que continuar EXACTAMENTE como la
 *    original (determinismo por semilla), mes a mes.
 * 2. Guardar y restaurar con un incendio en curso: la ciudad tiene que quemarse igual en ambas.
 * 3. Incendio grande (foco que los bomberos no apagan): la marca `bigFire` viaja en el save desde la
 *    versión 22; se comprueba que el foco restaurado quema igual que el original.
 *
 * Correr: npx vite-node qa-save.ts
 */
import { World } from './src/world/world';
import { SEA_LEVEL } from './src/world/terrain';
import { applyPlan, dragCells, planTool, type ToolId } from './src/world/tools';
import { Simulation, newSimState } from './src/sim/simulation';
import { TICKS_PER_MONTH } from './src/config';
import { deserialize, serialize } from './src/save/save';

const N = 64;

/** Ciudad con campo, préstamo y densidad: sin cuartel de bomberos para que prenda algo. */
function makeCity(seed: number): { w: World; sim: Simulation } {
  const w = new World({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(N * N) });
  const sim = new Simulation(w, newSimState(seed), `Guardada${seed}`);
  const b = (t: ToolId, ax: number, ay: number, bx = ax, by = ay) => {
    const p = planTool(w, t, dragCells(t, ax, ay, bx, by, 1, N));
    if (p.cells.length && sim.spend(p.cost)) applyPlan(w, p);
  };
  b('plant', 6, 20);
  b('road', 46, 46, 62, 46);
  b('silo', 48, 47);
  b('farm', 48, 42, 49, 43);
  b('farm', 51, 42, 52, 43);
  b('farm', 54, 42, 55, 43);
  b('market', 57, 43);
  sim.setCampoRisk(50);
  // Orden de venta retención: deja stock esperando el precio de invierno (merma activa).
  sim.state.order = { minPrice: 160, keepTons: 0 };
  sim.takeLoan(1);
  sim.setTax(9);
  let row = 22;
  let rows = 0;
  const addRow = (): void => {
    if (rows === 0) {
      b('road', 4, row, 5, row);
      b('road', 7, row, 60, row);
      b('line', 6, row, 6, row + 2);
      b('line', 4, row + 3, 60, row + 3);
    } else b('road', 4, row, 60, row);
    b('road', 4, row + 6, 60, row + 6);
    for (let x = 4; x <= 60; x += 12) {
      if (rows === 0) {
        b('road', x, row, x, row + 2);
        b('road', x, row + 4, x, row + 6);
      } else b('road', x, row, x, row + 6);
    }
    const kinds: ToolId[] = ['zoneR', 'zoneR', 'zoneC', 'zoneR', 'zoneI'];
    kinds.forEach((k, j) => b(k, 5 + j * 12, row + 1, 15 + j * 12, row + 5));
    rows++;
    row += 6;
  };
  addRow();
  addRow();
  return { w, sim };
}

const month = (sim: Simulation): void => {
  for (let t = 0; t < TICKS_PER_MONTH; t++) sim.tick();
};

const diff = (a: unknown, b: unknown, path: string, out: string[]): void => {
  if (out.length >= 5) return;
  if (typeof a === 'number' && typeof b === 'number') {
    if (a !== b) out.push(`${path}: ${a} vs ${b}`);
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) { out.push(`${path}.length: ${a.length} vs ${b.length}`); return; }
    for (let k = 0; k < a.length; k++) diff(a[k], b[k], `${path}[${k}]`, out);
    return;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
    for (const k of keys) diff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`, out);
    return;
  }
  if (a !== b) out.push(`${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
};

/** Los primeros campos en los que dos estados difieren, con sus valores. */
const stateDiff = (simA: Simulation, wA: World, simB: Simulation, wB: World): string[] => {
  const out: string[] = [];
  diff(JSON.parse(describe(simA, wA)), JSON.parse(describe(simB, wB)), 'estado', out);
  return out;
};

const describe = (sim: Simulation, w: World): string =>
  JSON.stringify({
    cash: sim.state.cash, tick: sim.state.tick, approval: sim.state.approval, favor: sim.state.favor,
    loan: sim.state.loan, subsidy: sim.state.subsidy, harvest: sim.state.harvest,
    news: sim.state.news.length, rng: sim.state.rngState, pendingEvent: sim.state.pendingEvent,
    level: Array.from(w.level), tiles: Array.from(w.tiles), fire: Array.from(w.fire), variant: Array.from(w.variant),
    silos: w.silos.map((s) => Math.round(s.tons * 1000) / 1000),
    stats: { burned: sim.stats.buildingsBurned, started: sim.stats.firesStarted, saved: sim.stats.firesSaved },
  });

console.log('=== 1. GUARDAR CON PRÉSTAMO + STOCK EN SILOS + EVENTO PENDIENTE, Y CONTINUAR 24 MESES ===');
{
  const { w, sim } = makeCity(7);
  // Llegar a régimen: cinco años, con el préstamo corriendo y stock en silos.
  for (let m = 0; m < 60; m++) month(sim);
  // Un evento en el papel, como cuando el jugador guarda con el telegrama sin responder.
  sim.state.pendingEvent = 'paro-de-colectivos';
  const text = serialize({ name: 'Guardada7', seed: 7, world: w, sim: sim.state });
  const back = deserialize(text);
  const resumed = new Simulation(back.world, back.sim, 'Guardada7');

  // Comparar el estado recién cargado con el original.
  const mismatches: string[] = [];
  if (resumed.state.cash !== sim.state.cash) mismatches.push(`cash ${resumed.state.cash} vs ${sim.state.cash}`);
  if (resumed.state.loan?.paid !== sim.state.loan?.paid) mismatches.push(`loan.paid ${resumed.state.loan?.paid} vs ${sim.state.loan?.paid}`);
  const silos = w.silos.map((s) => s.tons);
  back.world.silos.forEach((s, k) => {
    if (s.tons !== silos[k]) mismatches.push(`silo[${k}] ${s.tons} vs ${silos[k]}`);
  });
  console.log(`estado cargado idéntico: ${mismatches.length === 0 ? 'SÍ' : 'NO → ' + mismatches.join(', ')}`);

  // Continuar 24 meses en paralelo, diciendo QUÉ campo diverge primero.
  let diverged: string | null = null;
  for (let m = 0; m < 24; m++) {
    month(sim);
    month(resumed);
    if (!diverged) {
      const out = stateDiff(resumed, back.world, sim, w);
      if (out.length) diverged = `mes ${m + 1}: ${out.join(' · ')}`;
    }
  }
  console.log(`24 meses después idénticos: ${diverged ? `NO → ${diverged}` : 'SÍ (caja, aprobación, cosecha, préstamo, grillas y silos)'}`);
  console.log(`caja original $${sim.state.cash} · restaurada $${resumed.state.cash} · tick ${sim.state.tick}/${resumed.state.tick}`);
}

console.log('\n=== 2. GUARDAR CON INCENDIO EN CURSO Y CONTINUAR ===');
{
  // Ciudad densa sin bomberos: se deja prender algo y se guarda con el fuego vivo.
  const { w, sim } = makeCity(7);
  for (let m = 0; m < 60; m++) month(sim);
  // Tick a tick hasta un fuego vivo: dentro del mes hay un tick en que la celda está ardiendo.
  let guard = 60 * TICKS_PER_MONTH;
  let burning = 0;
  while (guard-- > 0) {
    sim.tick();
    burning = Array.from(w.fire).filter((v) => v > 0).length;
    if (burning > 0) break;
  }
  if (burning === 0) {
    console.log('no prendió nada en 60 años: escenario no disponible esta semilla');
  } else {
    const text = serialize({ name: 'Guardada7', seed: 7, world: w, sim: sim.state });
    const back = deserialize(text);
    const resumed = new Simulation(back.world, back.sim, 'Guardada7');
    // Continuar 24 meses tick a tick en paralelo (mismo ritmo que la original).
    let diverged: string | null = null;
    for (let m = 0; m < 24; m++) {
      month(sim);
      month(resumed);
      if (!diverged) {
        const out = stateDiff(resumed, back.world, sim, w);
        if (out.length) diverged = `mes ${m + 1}: ${out.join(' · ')}`;
      }
    }
    console.log(`fuegos vivos al guardar: ${burning} celdas · continuó idéntico 24 meses: ${diverged ? `NO → ${diverged}` : 'SÍ'}`);
    console.log(`quemados original ${sim.stats.buildingsBurned} · restaurada ${resumed.stats.buildingsBurned} (las estadísticas viajan en el guardado) · apagados a tiempo ${sim.stats.firesSaved}/${resumed.stats.firesSaved}`);
  }
}

console.log('\n=== 3. INCENDIO GRANDE: el foco que los bomberos no apagan, ¿sobrevive a un guardado? ===');
{
  const { w, sim } = makeCity(7);
  for (let m = 0; m < 60; m++) month(sim);
  // Inyectar un foco grande: un edificio denso cualquiera, con la marca interna `bigFire`.
  const interior = sim as unknown as { ignite(i: number): void; state: { bigFire: number[] } };
  let target = -1;
  for (let i = 0; i < w.tiles.length; i++) {
    // El foco tiene que tener un vecino ocupado: el cuartel entra en las celdas de al lado.
    if (w.level[i] >= 3 && !w.fire[i] && [i + 1, i - 1, i + N, i - N].some((j) => j > 0 && j < w.tiles.length && w.level[j] > 0)) { target = i; break; }
  }
  if (target < 0) {
    console.log('sin edificio denso para prender: escenario no disponible');
  } else {
    // Efecto determinista: un cuartel de bomberos REAL cubriendo la celda. La original (foco
    // grande) la deja en ruinas; la restaurada (que perdió la marca y quedó como fuego común) la
    // salva: la cobertura aplica sólo a fuegos comunes.
    const tx = target % N;
    const ty = (target - tx) / N;
    const build = (t: ToolId, ax: number, ay: number): void => {
      const p = planTool(w, t, dragCells(t, ax, ay, ax, ay, 1, N));
      if (p.cells.length && sim.spend(p.cost)) applyPlan(w, p);
    };
    for (let dy = -1; dy <= 1; dy++) for (let dx = 2; dx <= 4; dx++) build('bulldoze', tx + dx, ty + dy);
    build('fire', tx + 3, ty);
    // El foco se inyecta DESPUÉS del cuartel, y el guardado va con el fuego ya encendido.
    w.fireCover[target] = 0;
    interior.ignite(target);
    interior.state.bigFire.push(target);
    const text = serialize({ name: 'Guardada7', seed: 7, world: w, sim: sim.state });
    const back = deserialize(text);
    const resumed = new Simulation(back.world, back.sim, 'Guardada7');
    const resumedBig = back.sim.bigFire;
    console.log(`foco grande en celda ${target} (edificio nivel ${w.level[target]}), cuartel de bomberos cubriendo:`);
    console.log(`  original conserva la marca bigFire: ${interior.state.bigFire.includes(target) ? 'SÍ' : 'no'}`);
    console.log(`  restaurada la tiene: ${resumedBig.includes(target) ? 'SÍ' : 'NO — al cargar, el foco grande se vuelve un incendio común'}`);
    for (let m = 0; m < 12; m++) { month(sim); month(resumed); }
    console.log(`  12 meses después: original nivel ${w.level[target]} (0 = se quemó) · restaurada ${back.world.level[target]} (nivel ${back.world.level[target]} = ${back.world.level[target] > 0 ? 'SALVADA por los bomberos' : 'se quemó igual'})`);
    console.log(`  apagados a tiempo: original ${sim.stats.firesSaved} · restaurada ${resumed.stats.firesSaved}`);
    console.log(`  ${w.level[target] === 0 && back.world.level[target] === 0 ? '→ CORRECTO: el foco grande sobrevive al guardado y se quema igual' : '→ revisar: el resultado del fuego difiere entre original y restaurada'}`);
  }
}
