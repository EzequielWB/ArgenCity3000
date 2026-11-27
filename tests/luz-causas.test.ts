import { describe, expect, it } from 'vitest';
import { POWER_REACH } from '../src/config';
import { TILE as T, World } from '../src/world/world';
import { generateMap } from '../src/world/mapkinds';
import { Simulation, newSimState } from '../src/sim/simulation';
import { computePower } from '../src/sim/power';
import { describeCell } from '../src/sim/report';

/** Un mapa liso, una usina térmica (600 MW) en (10,20) y las casas industriales que se pidan en la fila. */
function plantAndRow(count: number): { w: World; spots: [number, number][] } {
  const w = new World(generateMap(3, 40, 'plain'));
  w.plants.push({ kind: 'coal', x: 10, y: 20 });
  for (const [x, y] of [
    [10, 20],
    [11, 20],
    [10, 21],
    [11, 21],
  ])
    w.tiles[w.idx(x, y)] = T.PLANT;
  const spots: [number, number][] = [];
  for (let k = 0; k < count; k++) {
    const x = 13 + k;
    if (x >= 39) break;
    // Industrial nivel 5: 25 MW por lote, así una hilera corta ya satura la usina.
    w.tiles[w.idx(x, 20)] = T.I;
    w.level[w.idx(x, 20)] = 5;
    spots.push([x, 20]);
  }
  return { w, spots };
}

const simOf = (w: World, funding = 100) => {
  const sim = new Simulation(w, newSimState(3, 'democracia', 'Partido', null), 'Villa', '');
  sim.power = computePower(w, funding);
  return sim;
};

describe('por qué un edificio no tiene luz', () => {
  /**
   * S2: el caso que reportó el jugador. La usina sobra en capacidad y sin embargo el edificio está a
   * oscuras, porque no está en ninguna red. Antes el consultar usaba la bandera global `shortage` y, si
   * cualquier red del mapa estaba corta, mandaba a construir otra usina aunque el problema fuera el tendido.
   */
  it('dice que no llega el tendido, no que falte capacidad', () => {
    const w = new World(generateMap(3, 40, 'plain'));
    w.plants.push({ kind: 'coal', x: 10, y: 20 });
    for (const [x, y] of [
      [10, 20],
      [11, 20],
      [10, 21],
      [11, 21],
    ])
      w.tiles[w.idx(x, y)] = T.PLANT;
    // Un solo edificio, lejísimos: no hay cadena de relays que llegue hasta él.
    w.tiles[w.idx(35, 5)] = T.I;
    w.level[w.idx(35, 5)] = 5;
    const sim = simOf(w);
    expect(sim.power.shortage).toBe(false);
    const card = describeCell(w, sim, 35, 5);
    expect(card.hint).toMatch(/no le llega el tendido/i);
    expect(card.hint).not.toMatch(/no da abasto/i);
    expect(card.hint).toContain(String(POWER_REACH));
  });

  /** S4: dos islas aisladas. La del edificio apagado está corta, pero a la ciudad, en total, le
   * sobra energía (la captura del jugador: "pide 11.800 y hay 12.785 · faltan 0"). El consultar
   * tiene que hablar de LA RED de la celda y proponer tendido, no solo otra usina. */
  it('distingue la isla corta del total de la ciudad', () => {
    const w = new World(generateMap(3, 40, 'plain'));
    // Isla A: una térmica saturada por la hilera de fábricas.
    w.plants.push({ kind: 'coal', x: 10, y: 20 });
    for (const [x, y] of [[10, 20], [11, 20], [10, 21], [11, 21]]) w.tiles[w.idx(x, y)] = T.PLANT;
    for (let k = 0; k < 26; k++) {
      const x = 13 + k;
      if (x >= 39) break;
      w.tiles[w.idx(x, 20)] = T.I;
      w.level[w.idx(x, 20)] = 5;
    }
    // Isla B: una térmica propia sin demanda: acá sobra todo.
    w.plants.push({ kind: 'coal', x: 5, y: 35 });
    for (const [x, y] of [[5, 35], [6, 35], [5, 36], [6, 36]]) w.tiles[w.idx(x, y)] = T.PLANT;
    const sim = simOf(w);
    expect(sim.power.capacity).toBeGreaterThan(sim.power.use); // a la ciudad le sobra
    expect(sim.power.shortage).toBe(true); // pero esta red está corta
    const apagada = [...Array(26).keys()].map((k) => 13 + k).find((x) => !w.powered[w.idx(x, 20)]);
    expect(apagada).toBeDefined();
    const card = describeCell(w, sim, apagada!, 20);
    expect(card.hint).toMatch(/tu red/i); // los números son de la red, no de la ciudad
    expect(card.hint).toContain('650'); // lo que pide la isla A
    expect(card.hint).toContain('600'); // lo que tiene
    expect(card.hint).toContain('550'); // el sobrante de las otras redes
    expect(card.hint).not.toMatch(/faltan 0/i);
    expect(card.hint).toMatch(/tendido/i); // la salida es conectar, y también sirve otra usina acá
  });

  /** Con red y capacidad corta, la causa es la otra, y el consultar da los números. */
  it('dice que la red no da abasto, con los megavatios', () => {
    const { w, spots } = plantAndRow(26);
    // Presupuesto de usinas al 40 %: la planta rinde 420 MW y la hilera pide más.
    const sim = simOf(w, 40);
    expect(sim.power.shortage).toBe(true);
    const apagada = spots.find(([x, y]) => !w.powered[w.idx(x, y)]);
    expect(apagada).toBeDefined();
    const card = describeCell(w, sim, apagada![0], apagada![1]);
    expect(card.hint).toMatch(/no da abasto/i);
    expect(card.hint).toContain('MW');
    expect(card.hint).not.toMatch(/no le llega el tendido/i);
  });

  /** Sin una sola usina no hay nada que explicar: lo que falta es la usina. */
  it('sin usinas manda a construir una', () => {
    const w = new World(generateMap(3, 40, 'plain'));
    w.tiles[w.idx(35, 5)] = T.I;
    w.level[w.idx(35, 5)] = 5;
    const sim = simOf(w);
    expect(describeCell(w, sim, 35, 5).hint).toMatch(/ninguna usina.*construí una/i);
  });

  /**
   * S3: el reparto no cambió. Con déficit se apaga por orden de cercanía y los últimos son los más
   * lejanos de la usina, que es lo que promete el código.
   */
  it('el reparto sigue apagando a los más lejanos', () => {
    const { w, spots } = plantAndRow(26);
    computePower(w, 40);
    const luces = spots.filter(([x, y]) => w.powered[w.idx(x, y)]);
    const apagadas = spots.filter(([x, y]) => !w.powered[w.idx(x, y)]);
    expect(luces.length).toBeGreaterThan(0);
    expect(apagadas.length).toBeGreaterThan(0);
    // Una sola hilera: el más lejano encendido está más cerca que el más cercano apagado.
    expect(Math.min(...apagadas.map(([x]) => x))).toBeGreaterThan(Math.max(...luces.map(([x]) => x)));
  });
});
