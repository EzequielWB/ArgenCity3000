import { describe, expect, it } from 'vitest';
import { PLANTS, PLANT_KINDS, PLANT_SHAPES } from '../src/config';
import { TILE as T, World } from '../src/world/world';
import { generateMap } from '../src/world/mapkinds';
import { applyPlan, planTool } from '../src/world/tools';
import { Simulation, newSimState } from '../src/sim/simulation';
import { computePower } from '../src/sim/power';
import { paintCoalPlant, paintNuclearPlant } from '../src/render/pixelArt';
import { serialize, deserialize } from '../src/save/save';
import { milestoneOfTool } from '../src/sim/milestones';

describe('usina nuclear', () => {
  it('es la usina de nivel mayor: 4×6, rinde dieciséis térmicas y cuesta una fortuna', () => {
    expect(PLANT_KINDS).toContain('nuclear');
    expect(PLANT_SHAPES.nuclear).toEqual({ w: 4, h: 6 });
    expect(PLANT_SHAPES.coal).toEqual({ w: 2, h: 2 });
    expect(PLANTS.nuclear.capacity).toBe(5500);
    expect(PLANTS.nuclear.smoke).toBe(0);
    expect(PLANTS.nuclear.cost).toBeGreaterThan(PLANTS.gas.cost * 8);
    expect(PLANTS.nuclear.upkeep).toBeGreaterThan(PLANTS.gas.upkeep * 9);
  });

  it('se construye con la herramienta, ocupa 4×6 y entra en la red eléctrica', () => {
    const w = new World(generateMap(3, 40, 'plain'));
    const sim = new Simulation(w, newSimState(3), 'Villa');
    // Un predio seco de 4×6: el 'plain' lleva agua y la huella entera tiene que caer en tierra.
    let origen: [number, number] | null = null;
    for (let y = 0; y < 34 && !origen; y++)
      for (let x = 0; x < 36 && !origen; x++) {
        const prueba = planTool(w, 'plantNuclear', [[x, y]]);
        if (prueba.cells.length === 24) origen = [x, y];
      }
    expect(origen).not.toBeNull();
    const p = planTool(w, 'plantNuclear', [origen!]);
    expect(p.cells.length).toBe(24); // la huella 4×6 entera
    sim.state.cash += 80000; // la nuclear cuesta más que el arranque de la ciudad
    expect(sim.spend(p.cost)).toBe(true);
    applyPlan(w, p);
    expect(w.plants[0].kind).toBe('nuclear');
    const [ox, oy] = origen!;
    for (const [x, y] of [[ox, oy], [ox + 3, oy], [ox, oy + 5], [ox + 3, oy + 5]]) expect(w.tileAt(x, y)).toBe(T.PLANT);
    // 5500 MW alimentan más de 200 fábricas de nivel 5: la capacidad está en el reporte.
    const report = computePower(w, 100);
    expect(report.capacity).toBe(PLANTS.nuclear.capacity);
    // consume puestos de la red como cualquier usina: un galpón pegado al predio prende
    w.tiles[w.idx(ox + 5, oy)] = T.I;
    w.level[w.idx(ox + 5, oy)] = 5;
    computePower(w, 100);
    expect(w.powered[w.idx(ox + 5, oy)]).toBe(1);
  });

  it('se desbloquea en Metrópolis, no antes', () => {
    const metropolis = 6; // índice del hito de 25.000 vecinos, el primero de 15 mil hacia arriba
    expect(milestoneOfTool('plantNuclear')).toBe(metropolis);
    expect(milestoneOfTool('plantWind')).toBe(4); // la eólico entra mucho antes
  });

  it('tiene pintura propia, distinta de la térmica, en las dos orientaciones', () => {
    const nuclear = paintNuclearPlant(4, 6);
    const girada = paintNuclearPlant(6, 4);
    const coal = paintCoalPlant();
    expect(nuclear.px.w).toBeGreaterThan(coal.px.w);
    expect(girada.px.w).toBe(nuclear.px.w); // el rectángulo girado ocupa lo mismo
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
    let origen: [number, number] | null = null;
    for (let y = 0; y < 34 && !origen; y++)
      for (let x = 0; x < 36 && !origen; x++) {
        const prueba = planTool(w, 'plantNuclear', [[x, y]]);
        if (prueba.cells.length === 24) origen = [x, y];
      }
    const p = planTool(w, 'plantNuclear', [origen!]);
    sim.state.cash += 80000;
    sim.spend(p.cost);
    applyPlan(w, p);
    const back = deserialize(serialize({ name: 'X', seed: 3, world: w, sim: sim.state }));
    expect(back.world.plants[0].kind).toBe('nuclear');
  });
});
