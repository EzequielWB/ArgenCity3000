import { describe, expect, it } from 'vitest';
import { TICKS_PER_MONTH } from '../src/config';
import { MAYOR_NAMES, foundingHeadline, intendente, pickMayorName, pollHeadline } from '../src/sim/mayor';
import { Simulation, newSimState } from '../src/sim/simulation';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { World } from '../src/world/world';

function flat(n = 32): Terrain {
  const s = n + 1;
  return { n, corners: new Uint8Array(s * s).fill(SEA_LEVEL + 1), trees: new Uint8Array(n * n) };
}

const months = (year: number, month: number) => ((year - 1990) * 12 + month - 1) * TICKS_PER_MONTH;

function runTo(sim: Simulation, tick: number): void {
  while (sim.state.tick < tick) sim.tick();
}

describe('the Intendente of a city', () => {
  it('is just "Intendente" with no name, and carries the name when there is one', () => {
    expect(intendente('')).toBe('Intendente');
    expect(intendente('   ')).toBe('Intendente');
    expect(intendente('Norma Quiroga')).toBe('Intendente Norma Quiroga');
    expect(intendente('  Hugo Paredes ')).toBe('Intendente Hugo Paredes');
  });

  it('draws names that fit the field, without repeats', () => {
    expect(MAYOR_NAMES.length).toBeGreaterThanOrEqual(8);
    expect(new Set(MAYOR_NAMES).size).toBe(MAYOR_NAMES.length);
    for (const n of MAYOR_NAMES) expect(n.length).toBeLessThanOrEqual(32);
    expect(pickMayorName(() => 0)).toBe(MAYOR_NAMES[0]);
    expect(pickMayorName(() => 0.999999)).toBe(MAYOR_NAMES[MAYOR_NAMES.length - 1]);
  });

  it('opens the founding headline with the name, or as before without it', () => {
    expect(foundingHeadline('Villa Gardel', '')).toBe('Se funda Villa Gardel: el Intendente promete calles, luz y progreso');
    expect(foundingHeadline('Villa Gardel', 'Norma Quiroga')).toBe('Se funda Villa Gardel: el Intendente Norma Quiroga promete calles, luz y progreso');
  });
});

describe('the name in the paper', () => {
  it('writes the founding headline with the name the player chose', () => {
    const sim = new Simulation(new World(flat()), newSimState(1), 'Villa Gardel', 'Norma Quiroga');
    expect(sim.state.news[0].text).toBe('Se funda Villa Gardel: el Intendente Norma Quiroga promete calles, luz y progreso');
    expect(sim.mayor).toBe('Norma Quiroga');
  });

  it('keeps the old headline when the save has no name', () => {
    const sim = new Simulation(new World(flat()), newSimState(1), 'Villa Gardel');
    expect(sim.state.news[0].text).toBe('Se funda Villa Gardel: el Intendente promete calles, luz y progreso');
  });

  it('puts the name in the polls and in the election results, in words that work for any name', () => {
    const sim = new Simulation(new World(flat()), newSimState(1), 'Prueba', 'Norma Quiroga');
    // The polls only run once the paper has opened, so their text is checked on its own.
    expect(pollHeadline(12, 54, 'Norma Quiroga')).toBe('Encuesta a 12 meses de las urnas: el 54 % aprueba la gestión del Intendente Norma Quiroga');
    expect(pollHeadline(6, 54, '')).toBe('Encuesta a 6 meses de las urnas: el 54 % aprueba la gestión del Intendente');
    runTo(sim, months(1993, 11));
    expect(sim.state.terms).toBe(1);
    expect(sim.state.news[0].text).toBe(`Elecciones 1993: Norma Quiroga renueva el mandato con el ${sim.state.approval} % de los votos`);

    const lost = new Simulation(new World(flat()), newSimState(1), 'Prueba', 'Hugo Paredes');
    runTo(lost, months(1993, 10));
    lost.state.approval = 30;
    runTo(lost, months(1993, 11));
    expect(lost.state.lostElection).toBe(true);
    expect(lost.state.news[0].text).toBe(`Elecciones 1993: el Intendente Hugo Paredes perdió con el ${lost.state.approval} % de los votos y deja la Municipalidad`);
    expect(lost.state.approval).toBeLessThan(50);
  });

  it('writes the election results as before when there is no name', () => {
    const sim = new Simulation(new World(flat()), newSimState(1), 'Prueba');
    runTo(sim, months(1993, 11));
    expect(sim.state.news[0].text).toMatch(/el Intendente fue reelecto/);
  });
});
