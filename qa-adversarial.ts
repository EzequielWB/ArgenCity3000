/**
 * QA headless — pruebas adversariales: exploits y casos borde de la simulación.
 *
 * 1. Red eléctrica: patrones de postes (madera/hormigón, alternados) que maximicen lotes iluminados
 *    por peso gastado (instalación + 24 meses de mantenimiento), y postes sueltos sin conexión.
 * 2. Colectivos: cochera pegada a una calle aislada de la red — ¿el alivio global (techo 35 %) se
 *    activa igual que con una cochera bien conectada?
 * 3. Avenidas y tránsito: ¿un bulevar con un solo carril débil (tierra) limita la avenida completa?
 * 4. Deshacer (Ctrl+Z): reembolsos dentro/fuera de la ventana, conservación de plata y restauración
 *    exacta del terreno en bordes de agua.
 *
 * Correr: npx vite-node qa-adversarial.ts
 */
import { World, TILE, zoneOf } from './src/world/world';
import { SEA_LEVEL } from './src/world/terrain';
import { applyPlan, dragCells, planTool, type ToolId } from './src/world/tools';
import { UndoHistory } from './src/world/history';
import { Simulation, newSimState } from './src/sim/simulation';
import { LINE_TIERS, TICKS_PER_MONTH, type ServiceKind } from './src/config';
import { applyTransit } from './src/sim/transit';
import { computeCongestion } from './src/sim/congestion';

const N = 64;

const flatWorld = (): World =>
  new World({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(N * N) });

/** Ciudad viva: bandas R/C/I con calles pavimentadas, usinas con margen y servicios por umbral. */
function aliveCity(seed: number, roadTier: 'road' | 'roadPaved', weakRow = -1, weakCell: ToolId = 'roadDirt'): { w: World; sim: Simulation } {
  const w = flatWorld();
  const sim = new Simulation(w, newSimState(seed), `Adv${seed}`);
  const b = (t: ToolId, ax: number, ay: number, bx = ax, by = ay): boolean => {
    const p = planTool(w, t, dragCells(t, ax, ay, bx, by, 1, N));
    if (p.cells.length && sim.spend(p.cost)) {
      applyPlan(w, p);
      return true;
    }
    return false;
  };
  b('plant', 6, 20);
  let plantX = 10;
  let row = 22;
  let rows = 0;
  const pending: { kind: ServiceKind; minPop: number; x: number; y: number }[] = [];
  const addRow = (): void => {
    if (rows === 0) {
      b('road', 4, row, 5, row);
      b('road', 7, row, 60, row);
      b('line', 6, row, 6, row + 2);
      b('line', 4, row + 3, 60, row + 3);
    } else {
      // La avenida de prueba: una fila horizontal que puede llevar un carril débil.
      for (let x = 4; x <= 60; x++) b(x === 20 && row === weakRow ? weakCell : roadTier, x, row);
      for (let x = 4; x <= 60; x++) b(x === 20 && row === weakRow ? weakCell : roadTier, x, row + 6);
    }
    for (let x = 4; x <= 60; x += 12) {
      if (rows === 0) {
        b('road', x, row, x, row + 2);
        b('road', x, row + 4, x, row + 6);
      } else {
        for (let y = row; y <= row + 6; y++) b(x === 20 && row === weakRow ? weakCell : roadTier, x, y);
      }
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
  const months = (m: number): void => {
    for (let k = 0; k < m; k++) {
      for (let t = 0; t < TICKS_PER_MONTH; t++) sim.tick();
      if (sim.power.shortage || (sim.power.capacity > 0 && sim.power.use > sim.power.capacity * 0.75)) {
        if (sim.state.cash > 4000) {
          b('plant', plantX, 20);
          plantX += 3;
        }
      }
      for (let j = 0; j < pending.length; j++) {
        const s = pending[j];
        if (sim.totals.pop < s.minPop || sim.state.cash < 4000) continue;
        b('bulldoze', s.x, s.y);
        b(s.kind, s.x, s.y);
        pending.splice(j--, 1);
      }
      if (k % 6 === 5 && row < N - 8 && sim.state.cash > 15000 && sim.congestion.worst < 90) addRow();
      if (sim.state.lastBudget && sim.state.lastBudget.balance < 0 && sim.state.cash < 8000) {
        if (sim.state.taxes.R < 9) sim.setTax(sim.state.taxes.R + 1);
        else if (!sim.state.loan && sim.state.cash < 4000) sim.takeLoan(0);
      }
    }
  };
  months(12);
  return { w, sim };
}

console.log('=== 1. RED ELÉCTRICA: ¿qué patrón de postes ilumina más por peso? ===');
{
  const row = 12;
  const patterns: { name: string; posts: [number, number][] }[] = [];
  const posts = (every: number, tier: ToolId): [number, number][] => {
    const out: [number, number][] = [];
    for (let x = 5; x <= 46; x += every) out.push([x, tier === 'lineConcrete' ? row - 1 : row]);
    return out;
  };
  patterns.push({ name: 'sin tendido', posts: [] });
  patterns.push({ name: 'madera continua', posts: posts(1, 'line') });
  patterns.push({ name: 'madera cada 4 (alcance 3)', posts: posts(4, 'line') });
  patterns.push({ name: 'madera cada 3 (encadena)', posts: posts(3, 'line') });
  patterns.push({ name: 'hormigón cada 9 (alcance 5)', posts: posts(9, 'lineConcrete') });
  patterns.push({ name: 'hormigón cada 5 (encadena)', posts: posts(5, 'lineConcrete') });
  {
    const mix = [...posts(4, 'line'), ...posts(9, 'lineConcrete')];
    patterns.push({ name: 'mixto madera c/4 + hormigón c/9', posts: mix });
  }
  for (const pat of patterns) {
    const w = flatWorld();
    const sim = new Simulation(w, newSimState(7), 'Luz');
    const b = (t: ToolId, ax: number, ay: number, bx = ax, by = ay): boolean => {
      const p = planTool(w, t, dragCells(t, ax, ay, bx, by, 1, N));
      if (p.cells.length && sim.spend(p.cost)) {
        applyPlan(w, p);
        return true;
      }
      return false;
    };
    // Usina pegada al primer pedazo de zonas: la luz arranca ahí y el tendido lleva el resto.
    b('plant', 2, 13);
    b('road', 6, 15, 45, 15);
    for (let x = 6; x <= 45; x += 8) b('zoneR', x, 14, x + 3, 14);
    let install = 0;
    for (const [x, y] of pat.posts) {
      const t: ToolId = y === row ? 'line' : 'lineConcrete';
      const p = planTool(w, t, dragCells(t, x, y, x, y, 1, N));
      if (p.cells.length && sim.spend(p.cost)) {
        applyPlan(w, p);
        install += p.cost;
      }
    }
    for (let m = 0; m < 6; m++) for (let t = 0; t < TICKS_PER_MONTH; t++) sim.tick();
    let lit = 0;
    for (let i = 0; i < w.tiles.length; i++) if (zoneOf(w.tiles[i]) === 'R' && w.level[i] > 0 && w.powered[i]) lit++;
    const upkeep = Math.round(pat.posts.reduce((sum, [, y]) => sum + LINE_TIERS[y === row ? 0 : 1].upkeep, 0) * 24);
    const cost = install + upkeep;
    console.log(`${pat.name.padEnd(32)} postes ${String(pat.posts.length).padStart(3)} · costo $${String(cost).padStart(6)} · lotes encendidos ${String(lit).padStart(3)} · lotes por $100: ${cost > 0 ? ((lit / cost) * 100).toFixed(2) : '—'}`);
  }
  // Exploit: ¿un poste suelto, sin conexión a ninguna usina, enciende algo?
  {
    const w = flatWorld();
    const sim = new Simulation(w, newSimState(7), 'Luz');
    const b = (t: ToolId, ax: number, ay: number): boolean => {
      const p = planTool(w, t, dragCells(t, ax, ay, ax, ay, 1, N));
      if (p.cells.length && sim.spend(p.cost)) {
        applyPlan(w, p);
        return true;
      }
      return false;
    };
    b('zoneR', 20, 20, 27, 21);
    b('line', 22, 18);
    for (let m = 0; m < 6; m++) for (let t = 0; t < TICKS_PER_MONTH; t++) sim.tick();
    let lit = 0;
    for (let i = 0; i < w.tiles.length; i++) if (zoneOf(w.tiles[i]) === 'R' && w.level[i] > 0 && w.powered[i]) lit++;
    console.log(`\nEXPLOIT poste suelto sin usina en todo el mapa: lotes encendidos ${lit} ${lit === 0 ? '→ no hay luz gratis (correcto)' : '→ LUZ GRATIS: BUG'}`);
    // Tendido suelto lejos de la única usina.
    const w2 = flatWorld();
    const sim2 = new Simulation(w2, newSimState(7), 'Luz2');
    const b2 = (t: ToolId, ax: number, ay: number, bx = ax, by = ay): boolean => {
      const p = planTool(w2, t, dragCells(t, ax, ay, bx, by, 1, N));
      if (p.cells.length && sim2.spend(p.cost)) {
        applyPlan(w2, p);
        return true;
      }
      return false;
    };
    b2('plant', 2, 2);
    b2('zoneR', 30, 30, 37, 31);
    b2('line', 32, 28, 35, 28);
    for (let m = 0; m < 6; m++) for (let t = 0; t < TICKS_PER_MONTH; t++) sim2.tick();
    let lit2 = 0;
    for (let i = 0; i < w2.tiles.length; i++) if (zoneOf(w2.tiles[i]) === 'R' && w2.level[i] > 0 && w2.powered[i]) lit2++;
    console.log(`EXPLOIT tendido suelto a 28 celdas de la única usina: lotes encendidos ${lit2} ${lit2 === 0 ? '→ el tendido no electrifica aire (correcto)' : '→ LUZ SIN RED: BUG'}`);
  }
}

console.log('\n=== 2. COLECTIVOS: cochera pegada a una calle aislada de la red ===');
{
  const probe = (where: 'red' | 'aislada' | 'pegada'): { taken: number; idle: number; trips: number; worst: number } => {
    const { w, sim } = aliveCity(7, 'road');
    const b = (t: ToolId, ax: number, ay: number): boolean => {
      const p = planTool(w, t, dragCells(t, ax, ay, ax, ay, 1, N));
      if (p.cells.length && sim.spend(p.cost)) {
        applyPlan(w, p);
        return true;
      }
      return false;
    };
    if (where === 'red') {
      b('bus', 30, 30); // cochera pegada a la grilla
    } else if (where === 'pegada') {
      // Cochera en el baldío con UNA celda de asfalto pegada a la puerta: ¿cuenta como atendida?
      b('road', 60, 60); // UNA celda de asfalto al lado de la puerta, desconectada de la red
      b('bus', 61, 60);
    } else {
      b('road', 62, 62); // UNA celda de asfalto en la esquina, lejos de la red
      b('bus', 61, 61);
    }
    const rep = computeCongestion(w, 100, 100);
    const load = new Float32Array(w.traffic);
    const { taken, idle } = applyTransit(w, load, 100, sim.totals.residents);
    return { taken: Math.round(taken), idle: Math.round(idle), trips: rep.trips, worst: rep.worst };
  };
  const a = probe('red');
  const pegada = probe('pegada');
  const b = probe('aislada');
  console.log(`viajeros en la ciudad: ${a.trips} · tránsito peor ${a.worst}%`);
  console.log(`cochera en la red:            alivio ${a.taken} viajeros · ociosa ${a.idle}`);
  console.log(`cochera + 1 celda pegada:     alivio ${pegada.taken} viajeros · ociosa ${pegada.idle}`);
  console.log(`cochera + 1 celda diagonal:   alivio ${b.taken} viajeros · ociosa ${b.idle}`);
  console.log(pegada.taken > 0
    ? '→ CONFIRMADO EXPLOIT: $10 de asfalto suelto pegado a la cochera activa el alivio del 35 % a toda la ciudad'
    : '→ la cochera con calle suelta no entrega alivio (correcto)');
}

console.log('\n=== 3. AVENIDAS: ¿un carril débil limita la avenida completa? ===');
{
  // Escenario sintético: casas densas al norte, fábricas densas al sur, y la única forma de cruzar
  // es la avenida de 3 carriles (entran por x=10/22, salen por x=34). La variante B pone UNA celda
  // de tierra en el carril medio. computeCongestion es puro: los niveles se escriben a mano.
  const run = (name: string, dirtAt: boolean): { worst: number; jam: number; trips: number } => {
    const w = flatWorld();
    const row = (t: number, y: number, x0 = 1, x1 = 46): void => {
      for (let x = x0; x <= x1; x++) w.tiles[y * N + x] = t;
    };
    row(TILE.ROAD, 10);
    row(TILE.ROAD, 19);
    for (const x of [10, 22]) for (let y = 10; y <= 12; y++) w.tiles[y * N + x] = TILE.ROAD;
    for (let y = 15; y <= 19; y++) w.tiles[y * N + 34] = TILE.ROAD;
    if (dirtAt) w.roadTier[15 * N + 22] = 3; // la única celda débil, en la columna más cargada
    // Casas al norte (y 7-9), fábricas al sur (y 16-18), nivel 4.
    for (let y = 7; y <= 9; y++) for (let x = 2; x <= 45; x++) { w.tiles[y * N + x] = TILE.R; w.level[y * N + x] = 2; }
    for (let y = 20; y <= 22; y++) for (let x = 2; x <= 45; x++) { w.tiles[y * N + x] = TILE.I; w.level[y * N + x] = 2; }
    for (let y = 13; y <= 15; y++) for (let x = 1; x <= 46; x++) w.tiles[y * N + x] = TILE.ROAD; // repongo la avenida
    const rep = computeCongestion(w, 100, 100);
    console.log(`${name.padEnd(34)} peor calle ${rep.worst}% · atascados ${Math.round(rep.jammedShare * 100)}% · viajeros ${rep.trips}`);
    return { worst: rep.worst, jam: Math.round(rep.jammedShare * 100), trips: rep.trips };
  };
  const full = run('bulevar 3 carriles continuo', false);
  const dirt = run('bulevar + 1 celda de tierra', true);
  console.log(dirt.jam > 0 && dirt.worst > full.worst
    ? `→ CONFIRMADO: una celda de tierra en el carril medio lleva la avenida de ${full.worst}% a ${dirt.worst}% — la banda rinde como su peor celda`
    : `→ revisar: continuo ${full.worst}% vs con tierra ${dirt.worst}%`);
}

console.log('\n=== 4. DESHACER (Ctrl+Z): reembolsos, conservación de plata y terreno ===');
{
  const w = flatWorld();
  // Costa: agua a un costado (columnas 0-2 bajo el nivel del mar).
  const corners = w.terrain.corners;
  for (let y = 0; y <= N; y++) for (let x = 0; x <= 3; x++) corners[y * (N + 1) + x] = SEA_LEVEL - 2;
  const baseline = corners.slice();
  const sim = new Simulation(w, newSimState(7), 'Deshacer');
  const history = new UndoHistory();
  const spent: number[] = [];
  const b = (t: ToolId, ax: number, ay: number, bx = ax, by = ay): void => {
    const p = planTool(w, t, dragCells(t, ax, ay, bx, by, 1, N));
    if (!p.cells.length) return;
    history.record(w, p, sim.state.tick);
    if (sim.spend(p.cost)) {
      applyPlan(w, p);
      spent.push(p.cost);
    }
  };
  const cashBefore = sim.state.cash;

  b('zoneR', 4, 10, 8, 12); // zonificar junto a la costa empareja el terreno
  const moved = Array.from(w.terrain.corners).filter((v, k) => v !== baseline[k]).length;
  console.log(`zonificar cambió celdas de terreno: ${moved}`);

  const undo1 = history.undo(w, sim.state.tick);
  if (undo1) sim.state.cash += undo1.refund;
  console.log(`undo inmediato: reembolso $${undo1?.refund} de $${spent.at(-1)} (${undo1?.refund === spent.at(-1) ? 'COMPLETO ✓' : 'parcial'})`);
  const restored = Array.from(w.terrain.corners).filter((v, k) => v !== baseline[k]).length;
  console.log(`terreno restaurado tras undo: ${restored === 0 ? 'idéntico al original ✓' : `${restored} celdas distintas: BUG`}`);

  // Segunda acción, deshacerla dos meses después: reembolso a la mitad.
  b('zoneR', 12, 10, 14, 12);
  const cost2 = spent.at(-1)!;
  for (let m = 0; m < 2; m++) for (let t = 0; t < TICKS_PER_MONTH; t++) sim.tick();
  const undo2 = history.undo(w, sim.state.tick);
  if (undo2) sim.state.cash += undo2.refund;
  console.log(`undo a los 2 meses: reembolso $${undo2?.refund} de $${cost2} (esperado la mitad: $${Math.floor(cost2 / 2)}) ${undo2?.refund === Math.floor(cost2 / 2) ? '✓' : 'revisar'}`);

  // Expiración: una acción vieja no se deshace y limpia el historial.
  b('zoneR', 18, 10, 20, 12);
  for (let m = 0; m < 13; m++) for (let t = 0; t < TICKS_PER_MONTH; t++) sim.tick();
  const undo3 = history.undo(w, sim.state.tick);
  console.log(`undo a los 13 meses: ${undo3 === null ? 'nada que deshacer ✓ (la ventana vence)' : 'todavía deshace: BUG de ventana'}`);

  const net = cashBefore - sim.state.cash;
  const totalSpent = spent.reduce((a, c) => a + c, 0);
  const totalRefund = (undo1?.refund ?? 0) + (undo2?.refund ?? 0) + (undo3?.refund ?? 0);
  console.log(`plata: gastado $${totalSpent} − reembolsado $${totalRefund} = $${totalSpent - totalRefund} · caja bajó $${net} · ${totalSpent - totalRefund === net ? 'conservación exacta ✓' : 'DESBALANCE: BUG'}`);
}
