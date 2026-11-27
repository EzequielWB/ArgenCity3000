import { describe, expect, it } from 'vitest';
import { PLANTS, PLANT_KINDS } from '../src/config';
import { TILE as T, World } from '../src/world/world';
import { generateMap } from '../src/world/mapkinds';
import { applyPlan, dragCells, planTool } from '../src/world/tools';
import { Simulation, newSimState } from '../src/sim/simulation';
import { computePower } from '../src/sim/power';
import { paintCoalPlant, paintNuclearPlant } from '../src/render/pixelArt';
import { serialize, deserialize } from '../src/save/save';
import { milestoneOfTool } from '../src/sim/milestones';

describe('usina nuclear', () => {
  it('es una usina de nivel mayor: rinde cuatro térmicas y no contamina', () => {
    expect(PLANT_KINDS).toContain('nuclear');
    expect(PLANTS.nuclear.capacity).toBe(PLANTS.coal.capacity * 4);
    expect(PLANTS.nuclear.smoke).toBe(0);
    expect(PLANTS.nuclear.cost).toBeGreaterThan(PLANTS.gas.cost * 3);
  });

  it('se construye con la herramienta y entra en la red eléctrica', () => {
    const w = new World(generateMap(3, 40, 'plain'));
    const sim = new Simulation(w, newSimState(3), 'Villa');
    const p = planTool(w, 'plantNuclear', dragCells('plantNuclear', 10, 20, 10, 20, 1, 40));
    expect(p.cells.length).toBeGreaterThan(0);
    expect(sim.spend(p.cost)).toBe(true);
    applyPlan(w, p);
    expect(w.plants[0].kind).toBe('nuclear');
    // 2400 MW alimentan más de 90 fábricas de nivel 5: la capacidad está en el reporte.
    const report = computePower(w, 100);
    expect(report.capacity).toBe(PLANTS.nuclear.capacity);
    // consume puestos de la red como cualquier usina: el edificio de al lado prende
    w.tiles[w.idx(14, 20)] = T.I;
    w.level[w.idx(14, 20)] = 5;
    computePower(w, 100);
    expect(w.powered[w.idx(14, 20)]).toBe(1);
  });

  it('se desbloquea con Gran ciudad, no antes', () => {
    const granCiudad = 5; // índice del hito de 5.000 vecinos
    expect(milestoneOfTool('plantNuclear')).toBe(granCiudad);
    expect(milestoneOfTool('plantWind')).toBe(granCiudad - 1); // la eólico entra antes
  });

  it('tiene pintura propia, distinta de la térmica', () => {
    const nuclear = paintNuclearPlant();
    const coal = paintCoalPlant();
    expect(nuclear.px.h).toBeGreaterThan(coal.px.h); // las torres pasan la chimenea
    // Sobre el pedazo que comparten cambia un cuarto del lienzo: es otra obra, no un retoque.
    const w = Math.min(nuclear.px.w, coal.px.w);
    const h = Math.min(nuclear.px.h, coal.px.h);
    let diff = 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const a = nuclear.px.data[(y * nuclear.px.w + x) * 4];
        const b = coal.px.data[(y * coal.px.w + x) * 4];
        if (a !== b) diff++;
      }
    expect(diff).toBeGreaterThan((w * h) / 4);
  });

  it('viaja en el guardado y vuelve', () => {
    const w = new World(generateMap(3, 40, 'plain'));
    const sim = new Simulation(w, newSimState(3), 'Villa');
    const p = planTool(w, 'plantNuclear', dragCells('plantNuclear', 10, 20, 10, 20, 1, 40));
    sim.spend(p.cost);
    applyPlan(w, p);
    const back = deserialize(serialize({ name: 'X', seed: 3, world: w, sim: sim.state }));
    expect(back.world.plants[0].kind).toBe('nuclear');
  });
});
