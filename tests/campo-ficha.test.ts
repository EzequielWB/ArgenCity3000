import { describe, expect, it } from 'vitest';
import { CROPS, MARKET_THROUGHPUT, SILO_CAPACITY, TICKS_PER_MONTH, UPKEEP } from '../src/config';
import { describeCell } from '../src/sim/report';
import { Simulation, newSimState } from '../src/sim/simulation';
import { SEA_LEVEL } from '../src/world/terrain';
import { applyPlan, dragCells, planTool } from '../src/world/tools';
import { World } from '../src/world/world';

const N = 32;
const TONS = CROPS.trigo.tons;

function mundo(): { w: World; sim: Simulation } {
  const w = new World({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(N * N) });
  const plan = (tool: Parameters<typeof planTool>[1], ax: number, ay: number) =>
    applyPlan(w, planTool(w, tool, dragCells(tool, ax, ay, ax, ay, 1, N)));
  plan('farm', 2, 2);
  plan('silo', 10, 2);
  plan('market', 16, 2);
  return { w, sim: new Simulation(w, newSimState(3, 'democracia'), 'Villa Trigal') };
}

/** La ficha del lote, en el mes que se pida. */
function ficha(w: World, sim: Simulation, x: number, y: number, mes: number) {
  const estado = sim.state;
  const antes = estado.tick;
  estado.tick = (mes - 1) * TICKS_PER_MONTH;
  const r = describeCell(w, sim, x, y);
  estado.tick = antes;
  return r;
}

describe('la ficha del lote de trigo', () => {
  it('dice cuánto rinde al año y en qué mes se cosecha, en vez de llamarlo terreno libre', () => {
    const { w, sim } = mundo();
    const r = ficha(w, sim, 2, 2, 7);
    expect(r.title.toLowerCase()).toContain('trigo');
    const texto = r.lines.join(' ');
    expect(texto).toContain(`${TONS} toneladas`);
    expect(texto).toContain('diciembre');
  });

  it('dice en qué anda el lote según el mes, igual que el dibujo', () => {
    const { w, sim } = mundo();
    expect(ficha(w, sim, 2, 2, 5).lines.join(' ')).toContain('arado');
    expect(ficha(w, sim, 2, 2, 8).lines.join(' ')).toContain('en pie');
    expect(ficha(w, sim, 2, 2, 2).lines.join(' ')).toContain('rastrojo');
  });

  it('avisa cuando no hay silo: la cosecha se pierde', () => {
    const w = new World({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(N * N) });
    applyPlan(w, planTool(w, 'farm', dragCells('farm', 2, 2, 2, 2, 1, N)));
    const sim = new Simulation(w, newSimState(3, 'democracia'), 'X');
    expect(ficha(w, sim, 2, 2, 7).hint).toContain('silo');
  });

  it('avisa cuando no hay feria: el trigo no se convierte en plata', () => {
    const w = new World({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(N * N) });
    applyPlan(w, planTool(w, 'farm', dragCells('farm', 2, 2, 2, 2, 1, N)));
    applyPlan(w, planTool(w, 'silo', dragCells('silo', 10, 2, 10, 2, 1, N)));
    const sim = new Simulation(w, newSimState(3, 'democracia'), 'X');
    expect(ficha(w, sim, 2, 2, 7).hint).toContain('feria');
  });

  it('con la cadena completa no avisa nada', () => {
    const { w, sim } = mundo();
    expect(ficha(w, sim, 2, 2, 7).hint).toBeUndefined();
  });
});

describe('la ficha del silo', () => {
  it('dice cuánto guarda, cuánto tiene y cuánto sale mantenerlo', () => {
    const { w, sim } = mundo();
    w.silos[0]!.tons = 60;
    const texto = ficha(w, sim, 10, 2, 7).lines.join(' ');
    expect(texto).toContain(`60 de ${SILO_CAPACITY}`);
    expect(texto).toContain(`$${UPKEEP.silo}`);
  });

  it('avisa cuando está lleno y la cosecha no va a entrar', () => {
    const { w, sim } = mundo();
    w.silos[0]!.tons = SILO_CAPACITY;
    expect(ficha(w, sim, 10, 2, 7).hint).toContain('lleno');
  });
});

describe('la ficha de la feria', () => {
  it('dice el precio del trigo del mes, el tope de venta y el mantenimiento', () => {
    const { w, sim } = mundo();
    const r = ficha(w, sim, 16, 2, 12);
    const texto = r.lines.join(' ');
    expect(r.title).toContain('Feria');
    expect(texto).toContain(`${MARKET_THROUGHPUT} toneladas por mes`);
    expect(texto).toContain(`$${UPKEEP.market}`);
    expect(texto).toContain('$120');
  });

  it('el precio que muestra es el del mes, no uno fijo', () => {
    const { w, sim } = mundo();
    const diciembre = ficha(w, sim, 16, 2, 12).lines.join(' ');
    const junio = ficha(w, sim, 16, 2, 6).lines.join(' ');
    expect(diciembre).toContain('$120');
    expect(junio).toContain('$180');
  });

  it('sin silos avisa que no hay de dónde vender', () => {
    const w = new World({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(N * N) });
    applyPlan(w, planTool(w, 'market', dragCells('market', 16, 2, 16, 2, 1, N)));
    const sim = new Simulation(w, newSimState(3, 'democracia'), 'X');
    expect(ficha(w, sim, 16, 2, 7).hint).toContain('silo');
  });
});
