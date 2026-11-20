import { describe, expect, it } from 'vitest';
import { DESASTRE, PLANT_LIFE, TICKS_PER_MONTH } from '../src/config';
import { ageFactor, plantCapacity } from '../src/sim/plants';
import { Simulation, newSimState } from '../src/sim/simulation';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { TILE, World, type World as WorldType } from '../src/world/world';

/** Llano, `height` niveles sobre el mar. */
function flat(n = 20, height = 1): Terrain {
  const s = n + 1;
  return { n, corners: new Uint8Array(s * s).fill(SEA_LEVEL + height), trees: new Uint8Array(n * n) };
}

/** Un barrio de casas de nivel 3 en todo el mapa, con la luz y la calle puestas. */
function barrio(coverage = 100): { w: WorldType; sim: Simulation } {
  const w = new World(flat(20));
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) w.tiles[w.idx(x, y)] = TILE.R;
  }
  for (let i = 0; i < w.level.length; i++) {
    w.level[i] = 3;
    w.variant[i] = i % 8;
    w.powered[i] = 1;
    w.roadAccess[i] = 1;
  }
  const sim = new Simulation(w, newSimState(3), 'Villa Desastre');
  // La cobertura se escribe **después** de crear la simulación: el constructor recalcula los servicios y
  // pisa lo que hubiera. Sin cuarteles, la ciudad quedaría sin bomberos y el test no probaría nada.
  w.fireCover.fill(coverage);
  return { w, sim };
}

type Internals = {
  ignite(i: number): void;
  igniteGrande(i: number): void;
  burn(): void;
  incendioGrande(): void;
  tornado(): void;
};

const inner = (sim: Simulation): Internals => sim as unknown as Internals;

/** Corre el fuego hasta que se apaga o se pierde, sin dejar que el mes cambie nada. */
function arde(sim: Simulation, i: number): void {
  const sim2 = inner(sim);
  for (let k = 0; k < 300 && sim.world.fire[i] > 0; k++) sim2.burn();
}

const standing = (w: WorldType): number => w.level.reduce((n, v) => n + (v > 0 ? 1 : 0), 0);

/** El aviso de la usina vieja, contado en el diario. */
const avisoUsina = (sim: Simulation): number => sim.state.news.filter((n) => /cumplió .* años/i.test(n.text)).length;

/** Una usina de carbón en (x, y), con su terreno y la edad que se quiera. */
function ponerUsina(w: WorldType, x: number, y: number, extra: { age?: number; warned?: boolean } = {}): void {
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const i = w.idx(x + dx, y + dy);
      w.tiles[i] = TILE.PLANT;
      // El terreno de la usina no es zona, así que la casa que había ahí ya no está.
      w.level[i] = 0;
      w.abandoned[i] = 0;
    }
  }
  w.plants.push({ x, y, kind: 'coal', ...extra });
}

describe('el incendio grande', () => {
  it('se lleva el edificio aunque los bomberos lo tengan cubierto', () => {
    const { w, sim } = barrio(100);
    const i = w.idx(6, 6);
    inner(sim).igniteGrande(i);
    expect(w.fire[i]).toBeGreaterThan(0);
    // Mientras arde, la casa sigue en pie: el fuego todavía no terminó.
    expect(w.level[i]).toBe(3);
    arde(sim, i);
    expect(w.fire[i]).toBe(0);
    expect(w.level[i]).toBe(0);
  });

  it('deja que la cobertura apague los fuegos que se prenden al lado', () => {
    const { w, sim } = barrio(100);
    const i = w.idx(6, 6);
    const j = w.idx(7, 6);
    inner(sim).ignite(j);
    expect(w.fire[j]).toBe(20);
    arde(sim, j);
    // La casa del vecino se salvó: es el incendio de siempre y los bomberos llegaron.
    expect(w.level[j]).toBe(3);
    expect(sim.stats.firesSaved).toBeGreaterThan(0);
    expect(w.level[i]).toBe(3);
  });

  it('prende varios focos a la vez en un barrio y no toca el resto de la ciudad', () => {
    const { w, sim } = barrio(100);
    inner(sim).incendioGrande();
    const burning = Array.from(w.fire).filter((f) => f > 0).length;
    expect(burning).toBeGreaterThan(1);
    expect(burning).toBeLessThanOrEqual(DESASTRE.focos);
    // Los focos están juntos: el incendio grande es de un barrio, no de toda la ciudad.
    const xs = [];
    for (let i = 0; i < w.fire.length; i++) if (w.fire[i] > 0) xs.push(i % w.n);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(DESASTRE.radio * 2);
  });

  it('anuncia el incendio en el diario', () => {
    const { sim } = barrio(100);
    inner(sim).incendioGrande();
    expect(sim.state.news.map((n) => n.text).join(' ')).toMatch(/incendio grande/i);
  });
});

describe('el tornado', () => {
  it('cruza el mapa y deja el camino destruido', () => {
    const { w, sim } = barrio(100);
    const antes = standing(w);
    inner(sim).tornado();
    expect(standing(w)).toBeLessThan(antes);
    // Tocó los dos bordes del eje por el que entró: no se quedó en un rincón.
    const cols = new Set<number>();
    const rows = new Set<number>();
    for (let i = 0; i < w.level.length; i++) {
      if (w.level[i] === 0) {
        cols.add(i % w.n);
        rows.add(Math.floor(i / w.n));
      }
    }
    const spread = Math.max(Math.max(...cols) - Math.min(...cols), Math.max(...rows) - Math.min(...rows));
    expect(spread).toBeGreaterThanOrEqual(w.n - 3);
  });

  it('no lo frena la cobertura de bomberos: pasa igual con la ciudad cubierta al cien', () => {
    const corrida = (cover: number): number => {
      const { w, sim } = barrio(cover);
      inner(sim).tornado();
      return w.level.filter((l) => l === 0).length;
    };
    // La misma semilla da el mismo tornado: lo único que cambia entre las dos es la cobertura.
    expect(corrida(100)).toBe(corrida(0));
    expect(corrida(100)).toBeGreaterThan(0);
  });

  it('no arranca en los primeros diez años', () => {
    const { sim } = barrio();
    sim.state.tick = TICKS_PER_MONTH * (DESASTRE.firstAt - 1);
    expect(sim.tornadoAllowed()).toBe(false);
    sim.state.tick = TICKS_PER_MONTH * (DESASTRE.firstAt + 1);
    expect(sim.tornadoAllowed()).toBe(true);
  });

  it('pasa muy poco: una chance mensual muy por debajo de la de los eventos comunes', () => {
    expect(DESASTRE.tornadoChance).toBeLessThan(0.005);
    // En años: una vez cada doscientos, en promedio.
    expect(1 / (DESASTRE.tornadoChance * 12)).toBeGreaterThan(100);
  });

  it('anuncia el tornado en el diario', () => {
    const { sim } = barrio();
    inner(sim).tornado();
    expect(sim.state.news.map((n) => n.text).join(' ')).toMatch(/tornado/i);
  });
});

describe('la usina que se pone vieja', () => {
  const plant = (age?: number) => ({ x: 4, y: 4, kind: 'coal' as const, age });

  it('entrega toda su capacidad mientras es nueva', () => {
    const w = new World(flat(32));
    expect(plantCapacity(w, plant(0))).toBe(600);
    expect(plantCapacity(w, plant(PLANT_LIFE.full))).toBe(600);
    // Una partida vieja no trae edad escrita: la usina es nueva y rinde entera.
    expect(plantCapacity(w, plant(undefined))).toBe(600);
  });

  it('a los sesenta años entrega la mitad, y de ahí no baja', () => {
    const w = new World(flat(32));
    expect(plantCapacity(w, plant(PLANT_LIFE.full + PLANT_LIFE.decay))).toBe(300);
    expect(plantCapacity(w, plant(5000))).toBe(300);
    expect(ageFactor(5000)).toBe(PLANT_LIFE.floor);
  });

  it('decae de a poco, no de golpe', () => {
    const w = new World(flat(32));
    const medio = PLANT_LIFE.full + PLANT_LIFE.decay / 2;
    const cap = plantCapacity(w, plant(medio));
    expect(cap).toBeLessThan(600);
    expect(cap).toBeGreaterThan(300);
  });

  it('la eólica también envejece', () => {
    const w = new World(flat(32));
    const nueva = plantCapacity(w, { x: 4, y: 4, kind: 'wind', age: 0 });
    const vieja = plantCapacity(w, { x: 4, y: 4, kind: 'wind', age: 5000 });
    expect(vieja).toBeLessThan(nueva);
    expect(vieja).toBe(Math.round(nueva * PLANT_LIFE.floor));
  });

  it('cumple los años que pasa la ciudad, y avisa una sola vez', () => {
    const { w, sim } = barrio();
    ponerUsina(w, 0, 0);
    const months = (sim as unknown as { endOfMonth(): void }).endOfMonth.bind(sim);
    w.plants[0].age = PLANT_LIFE.full - 1;
    months();
    expect(w.plants[0].age).toBe(PLANT_LIFE.full);
    expect(avisoUsina(sim)).toBe(0);
    months();
    expect(avisoUsina(sim)).toBe(1);
    months();
    expect(avisoUsina(sim)).toBe(1);
  });
});

describe('la usina guardada', () => {
  it('sigue en pie con su edad y con el aviso dado', async () => {
    const { serialize, deserialize } = await import('../src/save/save');
    const { w, sim } = barrio();
    ponerUsina(w, 0, 0, { age: 700, warned: true });
    const back = deserialize(serialize({ name: 'Villa Desastre', seed: 3, world: w, sim: sim.state }));
    expect(back.world.plants[0]).toMatchObject({ x: 0, y: 0, kind: 'coal', age: 700, warned: true });
  });
});
