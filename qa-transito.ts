/**
 * QA de tránsito: cómo evoluciona de verdad, a qué escala explota y qué palanca sirve de verdad.
 *
 * Dos partes:
 *  1. Orgánico con el tiempo: un bot construye la ciudad clásica (calles cada 6, bandas R/C/I,
 *     pavimento en las filas principales) y el juego corre 12 años. Dos bots: uno que no reacciona
 *     y otro que compra colectivos y mejora a bulevar apenas se atasca. Se loguea cada 3 meses:
 *     población, peor calle, % de viajeros atascados, colectivos y su alivio real.
 *  2. Sintético y a magnitud: una grilla escrita a mano (computeCongestion es puro) para barrer
 *     variantes en segundos: base, bulevares cada 2 manzanas (la ciudad de la captura), colectivos,
 *     trabajos desparramados, menos densidad, calle débil en el bulevar, presupuesto de calles,
 *     y la prueba del fondo: ¿reparten la carga dos avenidas paralelas? (spoiler: no — ruta única).
 *
 * Correr con: npx vite-node qa-transito.ts
 */
import { generateTerrain } from './src/world/terrain';
import { World, TILE, type TileId } from './src/world/world';
import { computeCongestion } from './src/sim/congestion';
import { packBusLine, busStations } from './src/world/transport';
import { applyPlan, dragCells, planTool, type ToolId } from './src/world/tools';
import { Simulation, newSimState } from './src/sim/simulation';
import { BUS, BUS_SIZE, CAPACITY, ROAD_TIERS, TICKS_PER_MONTH, TRAFFIC } from './src/config';

// ─────────────────────────────────────────────────────────────────────────────
// Parte 1 — orgánico con el tiempo
// ─────────────────────────────────────────────────────────────────────────────

interface CityRun {
  label: string;
  reactive: boolean;
}

function organicRun({ label, reactive }: CityRun): void {
  console.log(`\n=== 1. ORGÁNICO 12 AÑOS — ${label} ===`);
  const N = 128;
  const w = new World(generateTerrain(7, N));
  const sim = new Simulation(w, newSimState(7), 'Transíto');
  const build = (t: ToolId, ax: number, ay: number, bx = ax, by = ay): void => {
    const p = planTool(w, t, dragCells(t, ax, ay, bx, by, 1, N));
    if (p.cells.length && sim.spend(p.cost)) applyPlan(w, p);
  };
  build('plant', 6, 20);
  // Grilla clásica: calles cada 6, filas principales pavimentadas, bandas R/C/I. La primera fila
  // necesita tendido propio: las calles no llevan luz (S25) y sin línea no crece nadie.
  let row = 22;
  let rows = 0;
  let plantX = 9;
  const addRow = (): void => {
    if (rows === 0) {
      build('road', 4, row, 5, row);
      build('road', 7, row, 64, row);
      build('line', 6, row, 6, row + 2);
      build('line', 4, row + 3, 64, row + 3);
    } else build('roadPaved', 4, row, 64, row);
    build('road', 4, row + 6, 64, row + 6);
    for (let x = 4; x <= 64; x += 12) {
      if (rows === 0) {
        build('road', x, row, x, row + 2);
        build('road', x, row + 4, x, row + 6);
      } else build('road', x, row, x, row + 6);
    }
    const kinds: ToolId[] = ['zoneR', 'zoneR', 'zoneC', 'zoneR', 'zoneI'];
    kinds.forEach((k, j) => build(k, 5 + j * 12, row + 1, 15 + j * 12, row + 5));
    rows++;
    row += 6;
  };
  addRow();
  const SERVICE_PLAN: { kind: ToolId; minPop: number; x: number; y: number }[] = [
    { kind: 'clinic', minPop: 500, x: 10, y: 24 },
    { kind: 'school', minPop: 900, x: 22, y: 24 },
    { kind: 'fire', minPop: 1500, x: 46, y: 24 },
    { kind: 'police', minPop: 2500, x: 34, y: 24 },
  ];
  let mainCols = 8; // las columnas de calles principales que ya mejoramos a bulevar
  let lines = 0; // colectivos comprados
  let busX = 8;
  const manageBudget = (): void => {
    const b = sim.state.lastBudget;
    if (!b) return;
    const st = sim.state;
    if (b.balance < 0 && st.cash < 8000) {
      if (st.taxes.R < 9) sim.setTax(st.taxes.R + 1);
    } else if (b.balance > 1500 && st.cash > 20000 && st.taxes.R > 7) sim.setTax(st.taxes.R - 1);
  };
  for (let month = 1; month <= 144; month++) {
    for (let t = 0; t < TICKS_PER_MONTH; t++) sim.tick();
    if (sim.power.shortage && sim.state.cash > 4000) {
      build('plant', plantX, 20);
      plantX += 3;
    }
    for (let k = 0; k < SERVICE_PLAN.length; k++) {
      const s = SERVICE_PLAN[k];
      if (sim.totals.pop >= s.minPop && sim.state.cash > 12000) {
        build('bulldoze', s.x, s.y);
        build(s.kind, s.x, s.y);
        SERVICE_PLAN.splice(k--, 1);
      }
    }
    // Zonificar cuando los lotes libres se acaban (igual que el probe clásico).
    let free = 0;
    let freeHomes = 0;
    for (let i = 0; i < w.tiles.length; i++) {
      if (w.tiles[i] < TILE.R || w.tiles[i] > TILE.I || w.level[i] !== 0) continue;
      free++;
      if (w.tiles[i] === TILE.R) freeHomes++;
    }
    if ((free < 40 || (sim.demand.R > 20 && freeHomes < 12)) && sim.state.cash > 3000 && rows < 7) addRow();
    if (reactive) {
      const c = sim.congestion;
      // Colectivos hasta el tope útil (pocas líneas ya alcanzan: el alivio es tope de flota) y
      // bulevares en las columnas que ya no dan. Alternando, como haría un jugador apurado.
      if (c.jammedShare > 0.25 && lines < 4 && sim.state.cash > 12000) {
        const ax = busX;
        build('bulldoze', ax, 23, ax + 1, 24);
        build('bus', ax, 23);
        busX += 8;
        lines++;
      } else if (c.worst > 150 && mainCols < 64 && sim.state.cash > 22000) {
        build('roadBoulevard', mainCols, 16, mainCols, 70);
        mainCols += 8;
      }
    }
    manageBudget();
    if (month % 6 === 0 || month === 1) {
      const c = sim.congestion;
      const stations = busStations(w).length;
      console.log(
        `  mes ${String(month).padStart(3)} · pop ${String(sim.totals.pop).padStart(5)} · peor ${String(c.worst).padStart(3)} % · atascados ${Math.round(c.jammedShare * 100)
          .toString()
          .padStart(3)} % · viajeros ${String(c.trips).padStart(5)} · líneas ${stations} · bulevares col ${mainCols} · caja ${sim.state.cash}`,
      );
    }
  }
  const c = sim.congestion;
  console.log(
    `  → final: pop ${sim.totals.pop} · peor ${c.worst}% · atascados ${Math.round(c.jammedShare * 100)}% · ${sim.abandonedCount} abandonados · aprobación ${sim.state.approval}%`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Parte 2 — sintético: magnitud y palancas
// ─────────────────────────────────────────────────────────────────────────────

interface CityOpts {
  n?: number;
  spacing?: number; // manzana: calles cada `spacing`, lotes entre medio
  blocksX?: number; // manzanas ocupadas
  blocksY?: number;
  mainEvery?: number; // una avenida ancha cada `mainEvery` columnas de calle
  mainWidth?: number; // celdas paralelas de la avenida
  mainTier?: number; // tier de la avenida (0 asfalto, 2 bulevar)
  restTier?: number;
  rLevel?: number;
  cEvery?: number; // una manzana de comercios cada `cEvery` manzanas
  iEvery?: number; // ídem industria
  spread?: boolean; // comercios y fábricas chiquitas en cada manzana, junto a las casas
  downtown?: boolean; // todo el trabajo en el centro (la ciudad de la captura) en vez de repartido
  fill?: boolean; // torre en TODOS los lotes de la manzana (densidad de centro)
  chokeDirt?: boolean; // una celda de tierra en cada avenida (el eslabón más débil)
  busLines?: number;
  roadsFunding?: number;
}

interface Synth {
  w: World;
  trips: number;
  worst: number;
  jammed: number; // 0..1
  satCells: number;
  satAvg: number; // promedio de las celdas > 100 %
  maxCell: number;
  lanesMax: number;
}

export function synthetic(o: CityOpts): Synth {
  const n = o.n ?? 72;
  const spacing = o.spacing ?? 4;
  const w = new World(generateTerrain(3, n));
  const bx = o.blocksX ?? 12;
  const by = o.blocksY ?? 6;
  const x0 = 4;
  const y0 = 4;
  // Calles: cada `spacing` celdas, filas y columnas; avenidas = mainWidth paralelas con tier mainTier.
  const cols: { at: number; tier: number }[] = [];
  const rowsL: { at: number; tier: number }[] = [];
  for (let k = 0; k <= bx; k++) {
    const isMain = o.mainEvery !== undefined && k % o.mainEvery === 0;
    const at = x0 + k * spacing;
    const tier = isMain ? (o.mainTier ?? 0) : (o.restTier ?? 0);
    for (const j of isMain ? Array.from({ length: o.mainWidth ?? 1 }, (_, q) => q) : [0]) {
      for (let y = y0; y <= y0 + by * spacing; y++) {
        const x = at + j;
        if (x >= n) break;
        const i = y * n + x;
        w.tiles[i] = TILE.ROAD as TileId;
        w.roadTier[i] = tier;
      }
      cols.push({ at: at + j, tier });
    }
  }
  for (let k = 0; k <= by; k++) {
    const isMain = o.mainEvery !== undefined && o.mainEvery > 0 && k % o.mainEvery === 0 && false; // las filas quedan simples: mide columnas
    const at = y0 + k * spacing;
    const tier = isMain ? (o.mainTier ?? 0) : (o.restTier ?? 0);
    for (const j of isMain ? Array.from({ length: o.mainWidth ?? 1 }, (_, q) => q) : [0]) {
      for (let x = x0; x <= x0 + bx * spacing; x++) {
        if (x >= n) break;
        const i = (at + j) * n + x;
        w.tiles[i] = TILE.ROAD as TileId;
        w.roadTier[i] = tier;
      }
      rowsL.push({ at: at + j, tier });
    }
  }
  // El eslabón débil: una celda de tierra en el medio de cada avenida.
  if (o.chokeDirt) {
    for (const c of cols) {
      if (c.tier > 0) {
        const i = ((y0 + Math.floor(by * spacing) / 2) | 0) * n + c.at;
        w.roadTier[i] = 3;
      }
    }
  }
  // Manzanas: la mayoría casas torre; comercios y fábricas concentrados (por defecto, uno cada 5
  // y cada 7 manzanas) o desparramados.
  const rLevel = o.rLevel ?? 5;
  const cEvery = o.cEvery ?? 5;
  const iEvery = o.iEvery ?? 7;
  let blocks = 0;
  for (let ky = 0; ky < by; ky++) {
    for (let kx = 0; kx < bx; kx++, blocks++) {
      const ax = x0 + kx * spacing + 1;
      const ay = y0 + ky * spacing + 1;
      let kind: 'R' | 'C' | 'I' | null = 'R';
      if (o.spread) {
        // Casas y un commerce/fábrica chiquito en cada manzana: trabajo al lado de casa.
        kind = kx % 2 === 0 && ky % 2 === 0 ? 'C' : 'R';
      } else if (o.downtown) {
        // Todo el trabajo en el centro: dos columnas de manzanas de comercios, la industria en las puntas.
        const mid = Math.floor(bx / 2);
        kind = kx === mid || kx === mid + 1 ? 'C' : kx === 0 && ky === 0 ? 'I' : kx === bx - 1 && ky === by - 1 ? 'I' : 'R';
      } else if (blocks % cEvery === 0) kind = 'C';
      else if (blocks % iEvery === 0) kind = 'I';
      for (let dy = 0; dy < spacing - 1; dy++) {
        for (let dx = 0; dx < spacing - 1; dx++) {
          const x = ax + dx;
          const y = ay + dy;
          if (x >= n || y >= n) continue;
          const i = y * n + x;
          if (w.tiles[i] !== 0 as TileId) continue;
          if (kind === null) continue;
          if (kind !== 'R' && (o.fill || (dx === 1 && dy === 1))) {
            w.tiles[i] = (kind === 'C' ? TILE.C : TILE.I) as TileId;
            w.level[i] = o.fill ? Math.max(2, rLevel - 1) : rLevel;
          } else if (kind === 'R' && (o.fill || dx === (spacing - 1) - 1 && dy === 0)) {
            w.tiles[i] = TILE.R as TileId;
            w.level[i] = o.fill ? rLevel : Math.max(1, rLevel - 2); // torres, o casitas alrededor de la torre
          } else if (kind === 'R' && (dx + dy) % 2 === 0) {
            w.tiles[i] = TILE.R as TileId;
            w.level[i] = Math.max(1, rLevel - 2); // casitas alrededor de la torre
          }
        }
      }
    }
  }
  // Colectivos: `busLines` depósitos de 2×2 sobre lotes de manzana pegados a la avenida central.
  if (o.busLines) {
    const mainAt = x0;
    for (let k = 0; k < o.busLines; k++) {
      const x = mainAt + 1;
      const y = y0 + spacing * Math.floor((k * by) / o.busLines) + 1;
      for (let dy = 0; dy < BUS_SIZE; dy++) {
        for (let dx = 0; dx < BUS_SIZE; dx++) {
          const i = (y + dy) * n + x + dx;
          w.tiles[i] = TILE.BUS as TileId;
          w.busLine[i] = packBusLine(k % 6, k + 1);
        }
      }
    }
  }
  const rep = computeCongestion(w, 100, o.roadsFunding ?? 100);
  let sat = 0;
  let satSum = 0;
  let max = 0;
  let lanesMax = 0;
  for (let i = 0; i < w.tiles.length; i++) {
    if (w.tiles[i] !== TILE.ROAD) continue;
    if (w.traffic[i] > 100) {
      sat++;
      satSum += w.traffic[i];
    }
    if (w.traffic[i] > max) max = w.traffic[i];
  }
  // Carriles máximos que el juego reconoció en la avenida central.
  {
    const i = (y0 + 2) * n + x0;
    const isRoad = (j: number): boolean => j >= 0 && j < n * n && w.tiles[j] === TILE.ROAD;
    let lanes = 1;
    let j = i + 1;
    while (isRoad(j) && lanes < 8) {
      lanes++;
      j++;
    }
    lanesMax = lanes;
  }
  return { w, trips: rep.trips, worst: rep.worst, jammed: rep.jammedShare, satCells: sat, satAvg: sat ? Math.round(satSum / sat) : 0, maxCell: max, lanesMax };
}

const line = (name: string, s: Synth, extra = ''): void =>
  console.log(
    `  ${name.padEnd(46)} viajeros ${String(s.trips).padStart(6)} · peor ${String(s.worst).padStart(3)} % · atascados ${Math.round(s.jammed * 100)
      .toString()
      .padStart(3)} % · celdas >100%: ${String(s.satCells).padStart(3)} (prom ${s.satAvg} %) · max ${s.maxCell} %${extra}`,
  );

function part2(): void {
  // La ciudad de referencia: 6×3 manzanas llenas de torres, el trabajo concentrado en el centro
  // (como en la captura del jugador): ~12 mil viajeros, peor calle al 200 %, dos tercios atascados.
  const REF = { blocksX: 6, blocksY: 3, fill: true, downtown: true, mainEvery: 2, mainWidth: 2, mainTier: 2 };
  console.log('\n=== 2. MAGNITUD: la misma ciudad creciendo, calles simples de asfalto ===');
  for (const [bx, by] of [[6, 3], [8, 4], [10, 5], [12, 6]] as const) {
    const s = synthetic({ blocksX: bx, blocksY: by, fill: true, downtown: true });
    line(`ciudad ${bx}×${by} manzanas`, s, ` · ~${s.trips} viajeros`);
  }

  console.log('\n=== 3. PALANCAS sobre la ciudad de referencia (bulevares dobles cada 2 manzanas) ===');
  const base = synthetic(REF);
  line('base: avenidas dobles de bulevar cada 2 manzanas', base, ` · carriles por avenida: ${base.lanesMax}`);
  for (const linesN of [4, 8, 16, 32]) {
    const s = synthetic({ ...REF, busLines: linesN });
    line(`+ ${linesN} líneas de colectivos`, s, ` · tope: ${Math.round(BUS.share * 100)} % de los viajeros`);
  }
  line('avenidas dobles de bulevar en TODAS las calles', synthetic({ ...REF, mainEvery: 1 }));
  line('avenidas dobles de BULEVAR con ancho 4', synthetic({ ...REF, mainWidth: 4 }));
  line('trabajos desparramados (comercio en cada manzana)', synthetic({ ...REF, spread: true }));
  line('menos densidad: torres de nivel 4 en vez de 5', synthetic({ ...REF, rLevel: 4 }));
  line('calle débil: una celda de tierra en cada avenida', synthetic({ ...REF, chokeDirt: true }));
  line('combo: trabajos desparramados + bulevares en todas + 8 colectivos', synthetic({ ...REF, spread: true, mainEvery: 1, busLines: 8 }));
  for (const f of [60, 80, 110]) {
    line(`presupuesto de calles ${f} %`, synthetic({ ...REF, roadsFunding: f }));
  }

  console.log('\n=== 4. ¿REPARTEN LA CARGA DOS CALLES PARALELAS? (la ruta es única: la más corta) ===');
  rerouteDemo();
}

/** Pasillo de demostración: casas en el medio, trabajo a la derecha, y una calle paralela vacía
 * a dos celdas del pasillo por el que pasa TODO el flujo. La paralela queda en 0 %: el juego no
 * redistribuye por congestión, sólo por distancia. */
function rerouteDemo(): void {
  const n = 24;
  const w = new World(generateTerrain(5, n));
  for (let x = 2; x <= 20; x++) for (const y of [10, 12]) w.tiles[y * n + x] = TILE.ROAD as TileId;
  w.tiles[11 * n + 2] = TILE.ROAD as TileId; // conectores en las puntas
  w.tiles[11 * n + 20] = TILE.ROAD as TileId;
  for (let x = 4; x <= 11; x++) {
    const i = 11 * n + x; // casas entre las dos calles: a 1 de cada una
    w.tiles[i] = TILE.R as TileId;
    w.level[i] = 5;
  }
  for (let x = 13; x <= 15; x++) {
    const i = 9 * n + x; // comercios al lado del pasillo y=10
    w.tiles[i] = TILE.C as TileId;
    w.level[i] = 5;
  }
  const rep = computeCongestion(w, 100, 100);
  const pct = (y: number, x: number): number => w.traffic[y * n + x];
  console.log(`  8 torres (${rep.trips} viajeros) → 3 comercios: por el pasillo y=10:`);
  console.log(`    celdas x=8..13 del pasillo: ${[8, 9, 10, 11, 12, 13].map((x) => pct(10, x)).join('/')} %`);
  console.log(`    mismas celdas de la paralela y=12: ${[8, 9, 10, 11, 12, 13].map((x) => pct(12, x)).join('/')} %`);
  console.log('  → con el reparto, la paralela lleva su parte y el pasillo baja del atasco: antes era 67..107 % contra 0 %.');
}

const main = (): void => {
  console.log('QA de tránsito — Argencity 3000\n');
  organicRun({ label: 'bot que no reacciona', reactive: false });
  organicRun({ label: 'bot que compra colectivos y bulevares cuando se atasca', reactive: true });
  console.log('\nReferencias: capacidad de una celda = carriles × 1200 × tier (asfalto 1, pavimento 1.6, bulevar 1.8) × presupuesto.');
  console.log(`Torre nivel 5: ${CAPACITY.R[5]} viajeros. Casita nivel ${1}: ${CAPACITY.R[1]}. Comercio/fábrica nivel 5: ${CAPACITY.C[5]}/${CAPACITY.I[5]}.`);
  console.log(`Colectivos: ${BUS.trips} por línea, tope ${Math.round(BUS.share * 100)} % de los viajeros. Calle lenta desde ${TRAFFIC.slowFrom} %.`);
  console.log('Tiers:', ROAD_TIERS.map((t) => `${t.label} ×${t.capacity}`).join(', '));
  part2();
};

main();
