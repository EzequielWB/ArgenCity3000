/**
 * Probe del tránsito en metrópoli: una grilla de avenidas de 2 cada dos cuadras (la del
 * intendente que se queja), torres nivel 5 en todos lados, y comercios/industrias repartidos.
 * Pinta el mapa a mano (el probe mide la simulación, no la mano del jugador) y compara
 * escenarios de palancas para decidir dónde aflojar.
 *
 *   npx vite-node scripts/probe-transito.ts
 */
import { World, TILE } from '../src/world/world';
import { generateMap } from '../src/world/mapkinds';
import { addRoute } from '../src/world/route';
import { computeCongestion } from '../src/sim/congestion';
import { computePower } from '../src/sim/power';
import { TRAFFIC } from '../src/config';
import { packBusLine } from '../src/world/transport';

const N = 128;
const world = new World(generateMap(42, N, 'coast'));
addRoute(world, 42);

// Avenidas de 2 de ancho cada dos cuadras (período 12) y cuadras de 4 lotes entre ellas:
// x = 0..1 avenida, 2..5 cuadra, 6..9 cuadra, 10..11 avenida, y lo mismo en filas.
declare const process: { env: Record<string, string | undefined> };
const PERIODO = Number(process.env['PERIODO'] ?? 12);
const TIER = Number(process.env['TIER'] ?? 2);
const isAvenue = (c: number): boolean => c % PERIODO < 2;
for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    if (world.route[world.idx(x, y)]) continue;
    if (isAvenue(x) || isAvenue(y)) {
      world.setTile(x, y, TILE.ROAD);
      world.roadTier[world.idx(x, y)] = TIER;
    }
  }
}
// Zonas nivel 5 en todas las cuadras: R / C / I intercaladas por bloque.
for (let by = 0; by < N; by++) {
  for (let bx = 0; bx < N; bx++) {
    if (isAvenue(bx) || isAvenue(by)) continue;
    const i = world.idx(bx, by);
    if (world.tiles[i] === TILE.ROAD) continue;
    const block = Math.floor(bx / 6) + Math.floor(by / 6) * 3;
    const kind = block % 3;
    world.setTile(bx, by, kind === 0 ? TILE.R : kind === 1 ? TILE.C : TILE.I, 5);
  }
}
computePower(world, 100);

// Una flota de colectivos: cocheras de 2×2 repartidas por la ciudad, sobre tierra pegada a avenida.
let depots = 0;
for (let by = 3; by < N - 3 && depots < 40; by += 16) {
  for (let bx = 3; bx < N - 3 && depots < 40; bx += 16) {
    const i0 = world.idx(bx, by);
    if (world.tiles[i0] === TILE.ROAD) continue;
    const line = packBusLine(depots % 10, depots + 1);
    world.setTile(bx, by, TILE.BUS);
    world.setTile(bx + 1, by, TILE.BUS);
    world.setTile(bx, by + 1, TILE.BUS);
    world.setTile(bx + 1, by + 1, TILE.BUS);
    world.busLine[world.idx(bx, by)] = line;
    world.busLine[world.idx(bx + 1, by)] = line;
    world.busLine[world.idx(bx, by + 1)] = line;
    world.busLine[world.idx(bx + 1, by + 1)] = line;
    depots++;
  }
}

const count = (t: number): number => {
  let n = 0;
  for (let i = 0; i < N * N; i++) if (world.tiles[i] === t) n++;
  return n;
};

const report = (label: string, transport: number, roads = 100): void => {
  const r = computeCongestion(world, transport, roads);
  let cells = 0;
  let j60 = 0;
  let j90 = 0;
  let j120 = 0;
  for (let i = 0; i < N * N; i++) {
    if (world.tiles[i] !== TILE.ROAD) continue;
    cells++;
    if (world.traffic[i] > 60) j60++;
    if (world.traffic[i] > 90) j90++;
    if (world.traffic[i] > 120) j120++;
  }
  console.log(`${label}`);
  console.log(`  viajeros=${r.trips} peor=${Math.round(r.worst)}% atascados=${Math.round(r.jammedShare * 100)}%`);
  console.log(`  celdas=${cells} >60%=${j60} (${Math.round((j60 / cells) * 100)}%) >90%=${j90} (${Math.round((j90 / cells) * 100)}%) >120%=${j120}`);
};

let tsum = 0; for (let i = 0; i < N*N; i++) if (world.tiles[i] === TILE.ROAD) tsum += world.roadTier[i];
console.log(`tierSum=${tsum} calles=${count(TILE.ROAD)} torres=${count(TILE.R)} comercios=${count(TILE.C)} industrias=${count(TILE.I)} laneCapacity=${TRAFFIC.laneCapacity}`);
report('SIN colectivos (transporte 0):', 0);
report('Colectivos al 100% (físico):', 100);
report('Colectivos al 120%:', 120);
