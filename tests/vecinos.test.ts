/**
 * Los vecinos: que el que llame sea el barrio y no el lote, que el portavoz sea el más enojado, que la voz
 * suba con el enojo sin repetirse de barrio en barrio y que el nombre no cambie de una mirada a la otra.
 */
import { describe, expect, it } from 'vitest';
import { TICKS_PER_MONTH, VECINOS } from '../src/config';
import {
  GRIPES,
  gripCode,
  gripOfCause,
  gripOfCode,
  heatOf,
  vecinoOf,
  vecinosCount,
  vecinosReport,
} from '../src/sim/vecinos';
import { TILE, World } from '../src/world/world';
import { generateMap } from '../src/world/mapkinds';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { applyPlan, dragCells, planTool, type ToolId } from '../src/world/tools';
import { Simulation, newSimState } from '../src/sim/simulation';
import { countLabel, radioLine, sinceLabel, timeAgo, vecinosHtml } from '../src/ui/vecinos';

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

describe('las quejas', () => {
  it('no reclama por lo que no lo va a echar: la crisis y la casa de al lado quedan afuera', () => {
    expect(gripOfCause('crisis')).toBeNull();
    expect(gripOfCause('vacant')).toBeNull();
    expect(gripOfCause('power')).toBe('power');
  });

  it('sólo entra el lote que ya está enojado: lo flojo no gasta una fila', () => {
    const w = city();
    dark(w, 2, 2, VECINOS.angerMin - 1);
    expect(vecinosReport(w, KINDS, 1).calls).toHaveLength(0);
    dark(w, 2, 2, VECINOS.angerMin);
    expect(vecinosReport(w, KINDS, 1).calls).toHaveLength(1);
  });

  it('dice el problema que la simulación marca, y hace cuánto que lo tiene', () => {
    const w = city();
    dark(w, 4, 4, 30, 8);
    const [c] = vecinosReport(w, KINDS, 1).calls;
    expect(c.grip).toBe('power');
    expect(c.months).toBe(8);
    expect(c.say).toMatch(/luz|oscuras|heladera/i);
    expect(c.who.name).toBe(vecinoOf(4, 4, 1).name);
  });

  it('un problema de servicio no reclama: eso se paga en aprobación', () => {
    const w = city();
    const i = w.idx(6, 6);
    w.health[i] = 0; // sin sala cerca
    w.anger[i] = 0;
    w.troubleMonths[i] = 4;
    w.troubleWhat[i] = gripCode('power');
    expect(vecinosReport(w, KINDS, 1).calls).toHaveLength(0);
  });
});

describe('el barrio que llama', () => {
  it('diez casas pegadas con el mismo problema son un solo llamado', () => {
    const w = city();
    for (let k = 0; k < 10; k++) dark(w, 2 + k, 2, 20 + k);
    const r = vecinosReport(w, KINDS, 1);
    expect(r.calls).toHaveLength(1);
    expect(r.calls[0].count).toBe(10);
    expect(r.total).toBe(10);
    expect(r.groups).toBe(1);
  });

  it('dos manchones separados son dos llamados, aunque el problema sea el mismo', () => {
    const w = city();
    for (let k = 0; k < 4; k++) dark(w, 2 + k, 2, 30);
    for (let k = 0; k < 6; k++) dark(w, 2 + k, 10, 60);
    const r = vecinosReport(w, KINDS, 1);
    expect(r.calls).toHaveLength(2);
    expect(r.calls.map((c) => c.count).sort()).toEqual([4, 6]);
  });

  it('la diagonal de la esquina también es el mismo barrio', () => {
    const w = city();
    dark(w, 4, 4, 40);
    dark(w, 5, 5, 41);
    expect(vecinosReport(w, KINDS, 1).calls).toHaveLength(1);
    expect(vecinosReport(w, KINDS, 1).calls[0].count).toBe(2);
  });

  it('el portavoz es el más enojado del grupo, no el primero del recorrido', () => {
    const w = city();
    dark(w, 2, 2, 20);
    dark(w, 3, 2, 21);
    const lead = dark(w, 4, 2, 90);
    const [c] = vecinosReport(w, KINDS, 1).calls;
    expect(c.i).toBe(lead);
    expect(c.anger).toBe(90);
    expect(c.x).toBe(4);
  });

  it('a igual enojo habla el que hace más meses que aguanta', () => {
    const w = city();
    dark(w, 2, 2, 50, 2);
    const old = dark(w, 3, 2, 50, 9);
    expect(vecinosReport(w, KINDS, 1).calls[0].i).toBe(old);
  });

  it('lista cinco y cuenta los barrios que quedaron afuera', () => {
    const w = city();
    // Ocho barrios de un lote, separados de a dos celdas, con enojo creciente.
    for (let k = 0; k < 8; k++) dark(w, 1 + k * 3, 1, 20 + k * 5);
    const r = vecinosReport(w, KINDS, 1);
    expect(r.calls).toHaveLength(VECINOS.listed);
    expect(r.groups).toBe(8);
    expect(r.total).toBe(8);
    // La primera es la más enojada: la lista es una prioridad, no un muestreo.
    expect(r.calls[0].anger).toBe(55);
    expect(r.calls.map((c) => c.anger)).toEqual([...r.calls.map((c) => c.anger)].sort((a, b) => b - a));
  });
});

describe('la voz', () => {
  it('sube de escalón donde el juego ya cambia de comportamiento', () => {
    expect(heatOf(0)).toBe('aguanta');
    expect(heatOf(34)).toBe('aguanta');
    expect(heatOf(35)).toBe('duele');
    expect(heatOf(59)).toBe('duele');
    expect(heatOf(60)).toBe('reproche');
    expect(heatOf(84)).toBe('reproche');
    expect(heatOf(85)).toBe('seVa');
  });

  it('el mismo barrio no dice lo mismo cuando se enoja más', () => {
    const w = city();
    const i = dark(w, 4, 4, 20, 6);
    const calm = vecinosReport(w, KINDS, 1).calls[0];
    expect(calm.heat).toBe('aguanta');
    w.anger[i] = 90;
    const angry = vecinosReport(w, KINDS, 1).calls[0];
    expect(angry.heat).toBe('seVa');
    expect(angry.say).not.toBe(calm.say);
  });

  it('dos barrios con el mismo problema y el mismo enojo no dicen lo mismo', () => {
    const w = city();
    const said = new Set<string>();
    // Doce barrios de un lote, todos igual de enojados: el hash del portavoz tiene que repartir las frases.
    for (let k = 0; k < 12; k++) {
      dark(w, 1 + (k % 6) * 3, 1 + Math.floor(k / 6) * 4, 70);
      said.add(vecinosReport(w, KINDS, 1).calls[0].say);
    }
    for (let k = 0; k < 12; k++) dark(w, 1 + (k % 6) * 3, 1 + Math.floor(k / 6) * 4, 70);
    const r = vecinosReport(w, KINDS, 1);
    expect(new Set(r.calls.map((c) => c.say)).size).toBeGreaterThan(1);
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
    expect(vecinosReport(w, KINDS, 1).calls).toHaveLength(0);
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

  it('el panel lo muestra como una cita, sin la etiqueta «resuelto»', () => {
    const w = city();
    const i = w.idx(8, 8);
    w.troubleMonths[i] = 0;
    w.fixedMonths[i] = 0;
    w.troubleWhat[i] = gripCode('road');
    const html = vecinosHtml(vecinosReport(w, KINDS, 1));
    expect(html).toContain('callo-done');
    expect(html).not.toMatch(/resuelto/i);
  });
});

describe('los códigos de byte', () => {
  it('van y vuelven para cada problema', () => {
    for (const grip of GRIPES) expect(gripOfCode(gripCode(grip))).toBe(grip);
    expect(gripOfCode(0)).toBeNull();
    expect(gripOfCode(9)).toBeNull();
  });

  it('el contador de la radio es el mismo que el del desplegable', () => {
    const w = city();
    for (let k = 0; k < 3; k++) dark(w, 2 + k * 4, 2, 40);
    expect(vecinosCount(w)).toBe(3);
    expect(vecinosReport(w, KINDS, 1).total).toBe(3);
    // Sin servicios desbloqueados igual cuenta: el reclamo no depende de la comisaría.
    expect(vecinosReport(w, NONE, 1).calls).toHaveLength(3);
  });
});

describe('la pantalla de la radio', () => {
  it('cuenta en vecinos, y «uno solo» cuando el barrio es una casa', () => {
    expect(countLabel(1)).toBe('uno solo');
    expect(countLabel(30)).toBe('30 vecinos');
  });

  it('presenta al que llama antes de la cita, con el tiempo medido', () => {
    const w = city();
    dark(w, 4, 4, 70, 8);
    const [c] = vecinosReport(w, KINDS, 1).calls;
    const line = radioLine(c);
    expect(line).toContain(`—Nos llama ${c.who.radio}: «`);
    expect(line).toContain('Hace 8 meses que no tenemos luz');
    expect(line.endsWith('»')).toBe(true);
  });

  it('el tiempo se dice en palabras', () => {
    expect(sinceLabel(1)).toBe('Hace un mes');
    expect(sinceLabel(8)).toBe('Hace 8 meses');
    expect(timeAgo(255)).toBe('hace más de veinte años');
  });

  it('sin llamados la pantalla queda sin señal y el panel lo dice', () => {
    const html = vecinosHtml(vecinosReport(city(), KINDS, 1));
    expect(html).toContain('No llama nadie');
    expect(html).toContain('Los que llaman son los que están por irse.');
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
    expect(vecinosReport(w, KINDS, 5).calls.map((c) => c.i)).not.toContain(i);
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
