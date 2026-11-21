/**
 * Los vecinos: que el reclamo sea el del lote que se va a ir, que el nombre no cambie de una mirada a la
 * otra y que el tope de cuatro tarjetas cuente bien el resto.
 */
import { describe, expect, it } from 'vitest';
import { TICKS_PER_MONTH, VECINOS } from '../src/config';
import { gripCode, gripOfCause, gripOfCode, vecinoOf, vecinosCount, vecinosReport } from '../src/sim/vecinos';
import { GRIPES } from '../src/sim/vecinos';
import { TILE, World } from '../src/world/world';
import { generateMap } from '../src/world/mapkinds';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { applyPlan, dragCells, planTool, type ToolId } from '../src/world/tools';
import { Simulation, newSimState } from '../src/sim/simulation';
import { moreLine, timeAgo, vecinosButtonLabel, vecinosHtml } from '../src/ui/vecinos';

const KINDS = { health: true, crime: true, school: true };
const NONE = { health: false, crime: false, school: false };

/** Un mundo de 24×24 con casas sin luz en las celdas que se pidan. */
function city(): World {
  const w = new World(generateMap(7, 24, 'plain'));
  for (let i = 0; i < w.n * w.n; i++) {
    w.tiles[i] = TILE.R;
    w.level[i] = 2;
    w.powered[i] = 1;
    w.roadAccess[i] = 1;
    w.crime[i] = 0;
    w.jam[i] = 0;
    w.pollution[i] = 0;
  }
  return w;
}

/** Un lote sin luz con enojo y meses de queja. */
function dark(w: World, x: number, y: number, anger: number, months = 3): number {
  const i = w.idx(x, y);
  w.powered[i] = 0;
  w.anger[i] = anger;
  w.troubleMonths[i] = months;
  w.troubleWhat[i] = gripCode('power');
  return i;
}

describe('el vecino de un lote', () => {
  it('es el mismo siempre: sale de la celda y la semilla, no del azar de la partida', () => {
    const a = vecinoOf(12, 20, 42);
    const b = vecinoOf(12, 20, 42);
    expect(a).toEqual(b);
    expect(a.name.length).toBeGreaterThan(4);
    expect(vecinosReport(city(), KINDS, 42)).toEqual(vecinosReport(city(), KINDS, 42));
  });

  it('tiene las tres formas de un barrio: Doña, Don y la familia', () => {
    const names = new Set<string>();
    for (let x = 0; x < 24; x++) for (let y = 0; y < 24; y++) names.add(vecinoOf(x, y, 5).name.split(' ')[0]);
    expect(names).toContain('Doña');
    expect(names).toContain('Don');
    expect([...names].some((n) => n === 'La')).toBe(true);
  });
});

describe('las quejas', () => {
  it('no reclama por lo que no lo va a echar: la crisis y la casa de al lado quedan afuera', () => {
    expect(gripOfCause('crisis')).toBeNull();
    expect(gripOfCause('vacant')).toBeNull();
    expect(gripOfCause('power')).toBe('power');
  });

  it('sólo entra el lote que ya está enojado: lo flojo no gasta una tarjeta', () => {
    const w = city();
    dark(w, 2, 2, VECINOS.angerMin - 1);
    expect(vecinosReport(w, KINDS, 1).list).toHaveLength(0);
    dark(w, 2, 2, VECINOS.angerMin);
    expect(vecinosReport(w, KINDS, 1).list).toHaveLength(1);
  });

  it('dice el problema que la simulación marca, y hace cuánto que lo tiene', () => {
    const w = city();
    dark(w, 4, 4, 30, 8);
    const [c] = vecinosReport(w, KINDS, 1).list;
    expect(c.grip).toBe('power');
    expect(c.months).toBe(8);
    expect(c.text).toMatch(/luz/i);
    expect(c.who.name).toBe(vecinoOf(4, 4, 1).name);
  });

  it('lista cuatro y cuenta el resto agrupado por problema', () => {
    const w = city();
    for (let k = 0; k < 10; k++) dark(w, 2 + k, 2, 20 + k);
    const r = vecinosReport(w, KINDS, 1);
    expect(r.list).toHaveLength(VECINOS.listed);
    expect(r.more).toHaveLength(1);
    expect(r.more[0]).toMatchObject({ grip: 'power', count: 10 - VECINOS.listed });
    expect(r.more[0].label).toMatch(/luz/);
    expect(r.total).toBe(10);
    // La primera es la más enojada: la lista es una prioridad, no un muestreo.
    expect(r.list[0].anger).toBe(29);
  });

  it('un problema de servicio no reclama: eso se paga en aprobación', () => {
    const w = city();
    const i = w.idx(6, 6);
    w.health[i] = 0; // sin sala cerca
    w.anger[i] = 0;
    w.troubleMonths[i] = 4;
    w.troubleWhat[i] = gripCode('power');
    expect(vecinosReport(w, KINDS, 1).list).toHaveLength(0);
  });
});

describe('el agradecimiento', () => {
  it('aparece cuando el problema se fue, y dice por qué', () => {
    const w = city();
    const i = w.idx(8, 8);
    w.troubleMonths[i] = 0;
    w.fixedMonths[i] = 1;
    w.troubleWhat[i] = gripCode('road');
    const [t] = vecinosReport(w, KINDS, 1).thanks;
    expect(t.grip).toBe('road');
    expect(t.months).toBe(1);
    expect(t.text).toMatch(/calle/i);
    expect(vecinosReport(w, KINDS, 1).list).toHaveLength(0);
  });

  it('se olvida a los tres meses', () => {
    const w = city();
    const i = w.idx(8, 8);
    w.troubleMonths[i] = 0;
    w.fixedMonths[i] = VECINOS.thanksFor;
    w.troubleWhat[i] = gripCode('smoke');
    expect(vecinosReport(w, KINDS, 1).thanks).toHaveLength(1);
    w.fixedMonths[i] = VECINOS.thanksFor + 1;
    expect(vecinosReport(w, KINDS, 1).thanks).toHaveLength(0);
  });

  it('un lote que nunca tuvo nada mal no agradece nada', () => {
    expect(vecinosReport(city(), KINDS, 1).thanks).toHaveLength(0);
  });
});

describe('los códigos de byte', () => {
  it('van y vuelven para cada problema', () => {
    for (const grip of GRIPES) expect(gripOfCode(gripCode(grip))).toBe(grip);
    expect(gripOfCode(0)).toBeNull();
    expect(gripOfCode(9)).toBeNull();
  });

  it('el contador del menú es el mismo que el del panel', () => {
    const w = city();
    for (let k = 0; k < 3; k++) dark(w, 2 + k, 2, 40);
    expect(vecinosCount(w)).toBe(3);
    expect(vecinosReport(w, KINDS, 1).total).toBe(3);
    // Sin servicios desbloqueados igual cuenta: el reclamo no depende de la comisaría.
    expect(vecinosReport(w, NONE, 1).list).toHaveLength(3);
  });
});

describe('los meses de queja', () => {
  function flat(n = 32): Terrain {
    return { n, corners: new Uint8Array((n + 1) * (n + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(n * n) };
  }

  function build(w: World, tool: ToolId, ax: number, ay: number, bx = ax, by = ay) {
    applyPlan(w, planTool(w, tool, dragCells(tool, ax, ay, bx, by, 1, w.n)));
  }

  it('el mundo los cuenta solo, y se acuerda de qué era el problema cuando se arregla', () => {
    const w = new World(flat());
    build(w, 'plant', 0, 0);
    build(w, 'road', 2, 12, 20, 12);
    build(w, 'zoneR', 10, 10);
    const i = w.idx(10, 10);
    w.level[i] = 3;
    const sim = new Simulation(w, newSimState(5), 'X');
    // Lejos de la usina y sin tendido: el problema es la luz, y la calle la tiene.
    sim.tick();
    expect(w.powered[i]).toBe(0);
    expect(sim.unrest(i, 'R').worst).toBe('power');
    for (let t = 0; t < TICKS_PER_MONTH * 3; t++) sim.tick();
    expect(w.troubleMonths[i]).toBe(3);
    expect(gripOfCode(w.troubleWhat[i])).toBe('power');
    expect(w.fixedMonths[i]).toBe(-1);

    // Se tiende la luz hasta el lote: al mes siguiente la queja se convierte en agradecimiento.
    build(w, 'line', 0, 2, 0, 10);
    build(w, 'line', 1, 10, 7, 10);
    for (let t = 0; t < TICKS_PER_MONTH * 2; t++) sim.tick();
    expect(w.powered[i]).toBe(1);
    expect(w.troubleMonths[i]).toBe(0);
    // Acaba de arreglarse: el contador de agradecimiento arranca y no se pasa de la ventana del panel.
    expect(w.fixedMonths[i]).toBeGreaterThanOrEqual(0);
    expect(w.fixedMonths[i]).toBeLessThanOrEqual(VECINOS.thanksFor);
    // El problema se olvida pero no se borra: es lo que el agradecimiento nombra.
    expect(gripOfCode(w.troubleWhat[i])).toBe('power');
    expect(vecinosReport(w, KINDS, 5).thanks.map((t) => t.grip)).toContain('power');
    expect(vecinosReport(w, KINDS, 5).list.map((c) => c.i)).not.toContain(i);
  });
});

describe('los meses cuentan el problema que hay, no los que pasaron', () => {
  function flat(n = 32): Terrain {
    return { n, corners: new Uint8Array((n + 1) * (n + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(n * n) };
  }

  it('cuando el problema cambia, el contador arranca de nuevo', () => {
    const w = new World(flat());
    const build = (tool: ToolId, ax: number, ay: number, bx = ax, by = ay) =>
      applyPlan(w, planTool(w, tool, dragCells(tool, ax, ay, bx, by, 1, w.n)));
    build('plant', 0, 0);
    build('road', 2, 12, 20, 12);
    build('zoneR', 10, 10);
    const i = w.idx(10, 10);
    w.level[i] = 3;
    const sim = new Simulation(w, newSimState(5), 'X');
    for (let t = 0; t < TICKS_PER_MONTH * 4; t++) sim.tick();
    expect(gripOfCode(w.troubleWhat[i])).toBe('power');
    expect(w.troubleMonths[i]).toBe(4);

    // Se le da la luz y se le saca la calle: el problema es otro, y los meses son otros.
    build('line', 0, 2, 0, 10);
    build('line', 1, 10, 7, 10);
    build('bulldoze', 2, 12, 20, 12);
    for (let t = 0; t < TICKS_PER_MONTH; t++) sim.tick();
    expect(w.powered[i]).toBe(1);
    expect(gripOfCode(w.troubleWhat[i])).toBe('road');
    expect(w.troubleMonths[i]).toBe(1);
  });
});
