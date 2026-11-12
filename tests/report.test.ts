import { describe, expect, it } from 'vitest';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { World } from '../src/world/world';
import { applyPlan, dragCells, planTool } from '../src/world/tools';
import { Simulation, newSimState } from '../src/sim/simulation';
import { buildingName, describeCell } from '../src/sim/report';

function flat(n = 16, waterFromX = n): Terrain {
  const s = n + 1;
  const corners = new Uint8Array(s * s);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) corners[y * s + x] = x >= waterFromX ? SEA_LEVEL - 1 : SEA_LEVEL + 1;
  return { n, corners, trees: new Uint8Array(n * n) };
}

function setup(waterFromX = 16) {
  const w = new World(flat(16, waterFromX));
  const sim = new Simulation(w, newSimState(1), 'X');
  const b = (t: Parameters<typeof planTool>[1], ax: number, ay: number, bx = ax, by = ay) =>
    applyPlan(w, planTool(w, t, dragCells(t, ax, ay, bx, by, 1, 16)));
  return { w, sim, b };
}

describe('buildingName', () => {
  it('names every level of every zone, and empty lots', () => {
    expect(buildingName('R', 0, 0)).toBe('Lote residencial vacío');
    expect(buildingName('R', 1, 0)).toBe('Casita');
    expect(buildingName('R', 4, 0)).toBe('Torre de departamentos');
    expect(buildingName('C', 1, 0)).toBe('Kiosco');
    expect(buildingName('C', 4, 0)).toBe('Edificio de oficinas');
    expect(buildingName('I', 1, 0)).toBe('Taller');
    expect(buildingName('I', 4, 0)).toBe('Planta industrial');
  });
});

describe('describeCell', () => {
  it('explains why an empty lot does not grow: no power and no street', () => {
    const { w, sim, b } = setup();
    b('zoneR', 8, 8);
    sim.refresh();
    const r = describeCell(w, sim, 8, 8);
    expect(r.title).toBe('Lote residencial vacío');
    expect(r.lines.join(' ')).toMatch(/Sin luz/);
    expect(r.hint).toMatch(/usina|luz/i);
  });

  it('asks for a street when the lot has power but no road access', () => {
    const { w, sim, b } = setup();
    b('plant', 0, 0);
    b('zoneR', 2, 0, 12, 0);
    sim.refresh();
    const r = describeCell(w, sim, 12, 0);
    expect(r.lines.join(' ')).toMatch(/Con luz/);
    expect(r.hint).toMatch(/calle/i);
  });

  it('describes water, roads, bridges and plants', () => {
    const { w, sim, b } = setup(12);
    b('road', 10, 3, 13, 3);
    b('plant', 2, 6);
    sim.refresh();
    expect(describeCell(w, sim, 14, 9).title).toBe('Río');
    expect(describeCell(w, sim, 10, 3).title).toBe('Calle');
    expect(describeCell(w, sim, 13, 3).title).toBe('Puente');
    const plant = describeCell(w, sim, 3, 7);
    expect(plant.title).toBe('Usina térmica');
    expect(plant.lines.join(' ')).toMatch(/600/);
  });

  it('explains why a building was abandoned', () => {
    const { w, sim, b } = setup();
    b('zoneR', 5, 5);
    w.level[w.idx(5, 5)] = 2;
    w.abandoned[w.idx(5, 5)] = 1;
    sim.refresh();
    const r = describeCell(w, sim, 5, 5);
    expect(r.title).toMatch(/abandonad/);
    expect(r.hint).toMatch(/falta luz/);
  });

  it('describes a service building, its coverage and whether it has power', () => {
    const { w, sim, b } = setup();
    b('school', 8, 8);
    sim.refresh();
    const off = describeCell(w, sim, 8, 8);
    expect(off.title).toBe('Escuela');
    expect(off.lines.join(' ')).toMatch(/Sin luz/);
    expect(off.hint).toMatch(/luz/);
    b('plant', 0, 0);
    b('road', 2, 0, 2, 8);
    b('road', 3, 8, 7, 8);
    sim.refresh();
    const on = describeCell(w, sim, 8, 8);
    expect(on.lines.join(' ')).toMatch(/Con luz/);
    expect(on.lines.join(' ')).toMatch(/Radio: 11 lotes/);
    expect(on.lines.join(' ')).toMatch(/6\.000 vecinos/);
  });

  it('shows the coverage of every service on a lot', () => {
    const { w, sim, b } = setup();
    b('zoneR', 5, 5);
    w.level[w.idx(5, 5)] = 1;
    sim.refresh();
    const text = describeCell(w, sim, 5, 5).lines.join(' ');
    expect(text).toMatch(/Educación: 0\/100/);
    expect(text).toMatch(/Salud: 0\/100/);
    expect(text).toMatch(/Delito: \d+\/100/);
  });

  it('says a burning building needs firefighters', () => {
    const { w, sim, b } = setup();
    b('zoneR', 5, 5);
    w.level[w.idx(5, 5)] = 2;
    w.fire[w.idx(5, 5)] = 40;
    sim.refresh();
    const r = describeCell(w, sim, 5, 5);
    expect(r.title).toMatch(/en llamas/);
    expect(r.hint).toMatch(/bomberos/i);
  });

  it('asks for a clinic, then a school, when they are what holds homes back', () => {
    const { w, sim, b } = setup();
    b('plant', 0, 0);
    b('road', 2, 0, 2, 10);
    b('zoneR', 3, 5);
    const i = w.idx(3, 5);
    w.level[i] = 2;
    sim.refresh();
    const rich = () => {
      w.landValue[i] = 100;
      sim.totals.pop = 50000;
      sim.demand.R = 50;
    };
    rich();
    expect(describeCell(w, sim, 3, 5).hint).toMatch(/salita/i);
    w.health[i] = 100;
    w.level[i] = 3;
    rich();
    expect(describeCell(w, sim, 3, 5).hint).toMatch(/escuela/i);
  });

  it('reports residents of a built lot', () => {
    const { w, sim, b } = setup();
    b('zoneR', 5, 5);
    w.level[w.idx(5, 5)] = 2;
    sim.refresh();
    const r = describeCell(w, sim, 5, 5);
    expect(r.lines.join(' ')).toMatch(/20 vecinos/);
  });
});
