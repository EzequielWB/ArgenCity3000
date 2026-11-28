/**
 * El tránsito de la metrópoli: los colectivos pesan (una línea lleva 1.500 viajeros), las calles
 * aguantan más (1.350 por carril), y la radio sugiere — sin ordenar — mejores calles u otro
 * transporte cuando el barrio no puede salir. specs de `odd/tasks/transito-de-metropoli.md`.
 */
import { describe, expect, it } from 'vitest';
import { BUS, TRAFFIC } from '../src/config';
import { gripCode, vecinosReport } from '../src/sim/vecinos';
import { vecinosHtml } from '../src/ui/vecinos';
import { TILE, World } from '../src/world/world';
import { generateMap } from '../src/world/mapkinds';

const KINDS = { health: true, crime: true, school: true };

describe('las palancas de la metrópoli', () => {
  it('una línea de colectivos lleva 1.500 viajeros', () => {
    expect(BUS.trips).toBe(1500);
  });

  it('un carril de calle aguanta 1.350 viajeros antes de saturar', () => {
    expect(TRAFFIC.laneCapacity).toBe(1350);
  });
});

describe('la nota sutil de la radio', () => {
  it('cuando el barrio no puede salir, la radio sugiere mejores calles u otro transporte', () => {
    const w = new World(generateMap(7, 24, 'plain'));
    for (let i = 0; i < w.n * w.n; i++) {
      w.tiles[i] = TILE.R;
      w.level[i] = 2;
      w.powered[i] = 1;
      w.roadAccess[i] = 1;
    }
    // La queja vive en el estado vivo: la calle del lote tiene que estar arriba del umbral
    // (slowFrom + margen), no alcanza con el troubleWhat.
    const i = w.idx(4, 4);
    w.anger[i] = 78;
    w.troubleMonths[i] = 3;
    w.troubleWhat[i] = gripCode('jam');
    w.jam[i] = 255;
    const html = vecinosHtml(vecinosReport(w, KINDS, 1));
    expect(html).toMatch(/mejores calles|medios de transporte/);
  });

  it('sin quejas de tránsito, la radio no mete la nota', () => {
    const w = new World(generateMap(7, 24, 'plain'));
    for (let i = 0; i < w.n * w.n; i++) {
      w.tiles[i] = TILE.R;
      w.level[i] = 2;
      w.powered[i] = 1;
      w.roadAccess[i] = 1;
    }
    // Queja real de delito (no un desplegable vacío): la nota no aparece igual.
    const i = w.idx(4, 4);
    w.anger[i] = 78;
    w.troubleMonths[i] = 3;
    w.troubleWhat[i] = gripCode('crime');
    w.crime[i] = 80;
    expect(vecinosHtml(vecinosReport(w, KINDS, 1))).not.toMatch(/medios de transporte/);
  });
});
