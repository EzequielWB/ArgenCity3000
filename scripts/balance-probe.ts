/**
 * Headless balance check: builds a small grid city, then plays like a simple player for
 * 15 years (adds a plant on blackouts, more zones when lots run out) and prints a yearly summary.
 * Run with `npm run probe`.
 */
import { World, TILE } from '../src/world/world';
import { generateTerrain } from '../src/world/terrain';
import { applyPlan, dragCells, planTool, type ToolId } from '../src/world/tools';
import { Simulation, newSimState } from '../src/sim/simulation';
import { TICKS_PER_MONTH } from '../src/config';

const N = 128;
const w = new World(generateTerrain(7, N));
const sim = new Simulation(w, newSimState(7), 'Prueba');
const build = (t: ToolId, ax: number, ay: number, bx = ax, by = ay) => {
  const p = planTool(w, t, dragCells(t, ax, ay, bx, by, 1, N));
  if (p.cells.length && sim.spend(p.cost)) applyPlan(w, p);
};

// A grid of blocks: streets every 6 cells, R/C/I bands, a plaza per row.
let plantX = 6;
build('plant', plantX, 20);
plantX += 3;
let row = 22;
const addRow = () => {
  build('road', 4, row, 64, row);
  build('road', 4, row + 6, 64, row + 6);
  for (let x = 4; x <= 64; x += 12) build('road', x, row, x, row + 6);
  const kind: ToolId[] = ['zoneR', 'zoneR', 'zoneC', 'zoneR', 'zoneI'];
  kind.forEach((k, j) => build(k, 5 + j * 12, row + 1, 15 + j * 12, row + 5));
  build('park', 52, row + 2, 53, row + 3);
  row += 6;
};
addRow();

for (let year = 1; year <= 15; year++) {
  for (let m = 0; m < 12; m++) {
    for (let i = 0; i < TICKS_PER_MONTH; i++) sim.tick();
    if (sim.power.shortage && sim.state.cash > 4000) {
      build('plant', plantX, 20);
      plantX += 3;
    }
    let free = 0;
    for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] >= TILE.R && w.tiles[i] <= TILE.I && w.level[i] === 0) free++;
    if (free < 40 && sim.state.cash > 3000 && row < 100) addRow();
  }
  const levels = [0, 0, 0, 0, 0];
  for (let i = 0; i < w.level.length; i++) if (w.level[i]) levels[w.level[i]]++;
  const b = sim.state.lastBudget!;
  console.log(
    `año ${year}: pop ${sim.totals.pop} C ${sim.totals.cJobs} I ${sim.totals.iJobs} caja ${sim.state.cash} saldo ${b.balance}/mes usinas ${w.plants.length} niveles ${levels.slice(1).join('/')} demanda ${JSON.stringify(sim.demand)}`,
  );
}
