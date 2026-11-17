/**
 * What a shop grows on. It used to ask for a school at its own door, like a house; now it asks for a
 * city with schools in it, because that is what gives it educated customers. The house keeps asking
 * for the school next door.
 */
import { describe, expect, it } from 'vitest';
import { CAPACITY } from '../src/config';
import { educatedShare, levelCap } from '../src/sim/demand';
import { Simulation, newSimState } from '../src/sim/simulation';
import { applyPlan, dragCells, planTool, type ToolId } from '../src/world/tools';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { TILE, World } from '../src/world/world';

function flat(n = 40): Terrain {
  const s = n + 1;
  return { n, corners: new Uint8Array(s * s).fill(SEA_LEVEL + 1), trees: new Uint8Array(n * n) };
}

/** A city of homes at one level, each with the education coverage asked for. */
function city(levels: { edu: number; level: number }[]): World {
  const w = new World(flat());
  levels.forEach(({ edu, level }, k) => {
    const i = w.idx(4 + k, 6);
    w.setTile(i % w.n, Math.floor(i / w.n), TILE.R);
    w.level[i] = level;
    w.edu[i] = edu;
  });
  return w;
}

describe('the educated people of the city', () => {
  it('counts residents, not lots, and only those with a school in reach', () => {
    const w = city([
      { edu: 100, level: 4 },
      { edu: 100, level: 2 },
      { edu: 0, level: 1 },
    ]);
    const people = CAPACITY.R[4] + CAPACITY.R[2] + CAPACITY.R[1];
    expect(educatedShare(w)).toBeCloseTo((100 * (CAPACITY.R[4] + CAPACITY.R[2])) / people, 5);
    // Una ciudad sin casas no tiene gente educada, y no se divide por cero.
    expect(educatedShare(new World(flat()))).toBe(0);
  });

  it('reaches the simulation, once per fields pass', () => {
    const build = (w: World, tool: ToolId, ax: number, ay: number, bx = ax, by = ay) => applyPlan(w, planTool(w, tool, dragCells(tool, ax, ay, bx, by, 1, w.n)));
    const w = new World(flat());
    build(w, 'plant', 2, 2);
    build(w, 'road', 2, 8, 20, 8);
    build(w, 'school', 4, 4); // pegada a la usina: sin luz no hay cobertura que contar
    build(w, 'zoneR', 4, 5, 14, 6);
    for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === TILE.R) w.level[i] = 2;
    const sim = new Simulation(w, newSimState(1), 'Villa Escuela');
    // La escuela que entra en el barrio se ve en el número de la ciudad.
    expect(sim.schooled).toBeGreaterThan(50);
    build(w, 'bulldoze', 4, 4);
    sim.refresh();
    expect(sim.schooled).toBe(0);
  });
});

describe('a shop grows on the city, not on its own block', () => {
  const services = { edu: 0, health: 100 };

  it('goes all the way up with no school of its own when the city is schooled', () => {
    // El lote del comercio no tiene escuela cerca: lo que lo deja crecer es la ciudad.
    expect(levelCap('C', 100, 50_000, { ...services, educated: 0 })).toBe(4);
    expect(levelCap('C', 100, 50_000, { ...services, educated: 100 })).toBe(5);
  });

  it('stays put with a school across the street when nobody in the city is schooled', () => {
    expect(levelCap('C', 100, 50_000, { edu: 100, health: 100, educated: 0 })).toBe(4);
    expect(levelCap('C', 100, 50_000, { edu: 100, health: 100 })).toBe(5);
  });

  it('does not change the house, which still wants the school next door', () => {
    expect(levelCap('R', 100, 50_000, { ...services })).toBe(4);
    expect(levelCap('R', 100, 50_000, { edu: 100, health: 100 })).toBe(5);
    // Y la gente educada de la ciudad no le sirve de nada: la escuela tiene que estar en su lote.
    expect(levelCap('R', 100, 50_000, { ...services, educated: 100 })).toBe(4);
  });

  it('keeps the university of the tallest shops and factories', () => {
    expect(levelCap('C', 100, 50_000, { edu: 100, health: 100, educated: 100 }, )).toBe(5);
    expect(levelCap('C', 100, 50_000, { edu: 100, health: 100, educated: 100, university: 0 })).toBe(4);
    expect(levelCap('I', 100, 50_000, { edu: 0, health: 100, university: 0 })).toBe(4);
  });
});
