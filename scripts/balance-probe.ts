import { World } from '../src/world/world';
import { generateTerrain } from '../src/world/terrain';
import { applyPlan, dragCells, planTool, type ToolId } from '../src/world/tools';
import { Simulation, newSimState } from '../src/sim/simulation';
import { TICKS_PER_MONTH } from '../src/config';
const w = new World(generateTerrain(7, 128));
const sim = new Simulation(w, newSimState(7), 'Prueba');
const b = (t: ToolId, ax: number, ay: number, bx = ax, by = ay) => { const p = planTool(w, t, dragCells(t, ax, ay, bx, by, 1, 128)); if (sim.spend(p.cost)) applyPlan(w, p); };
b('plant', 20, 20);
for (let y = 22; y <= 62; y += 6) b('road', 10, y, 60, y);
b('road', 10, 22, 10, 62); b('road', 60, 22, 60, 62);
b('zoneR', 11, 23, 40, 27); b('zoneR', 11, 29, 40, 33); b('zoneR', 11, 35, 40, 39);
b('zoneC', 11, 41, 40, 45); b('zoneI', 42, 23, 59, 39);
console.log('cash after build', sim.state.cash);
for (let m = 1; m <= 60; m++) { for (let i = 0; i < TICKS_PER_MONTH; i++) sim.tick(); if (m % 6 === 0) console.log(m, JSON.stringify(sim.totals), 'cash', sim.state.cash, 'bal', sim.state.lastBudget!.balance, 'dem', JSON.stringify(sim.demand), 'pw', JSON.stringify(sim.power)); }
console.log(sim.state.news.slice(0, 12).map(n => n.date + ' ' + n.text).join('\n'));
