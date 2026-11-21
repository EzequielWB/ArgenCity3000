/**
 * El panel de los vecinos: que la tarjeta diga nombre, dirección, tiempo y enojo, que el resto se cuente y
 * que sin quejas no invente nada.
 */
import { describe, expect, it } from 'vitest';
import { VECINOS } from '../src/config';
import { gripCode, vecinoOf, vecinosReport } from '../src/sim/vecinos';
import { moreLine, timeAgo, vecinosButtonLabel, vecinosHtml } from '../src/ui/vecinos';
import { TILE, World } from '../src/world/world';
import { generateMap } from '../src/world/mapkinds';

const KINDS = { health: true, crime: true, school: true };

/** Un mundo de 24×24 con casas sin luz en las celdas que se pidan. */
function city(): World {
  const w = new World(generateMap(7, 24, 'plain'));
  for (let i = 0; i < w.n * w.n; i++) {
    w.tiles[i] = TILE.R;
    w.level[i] = 2;
    w.powered[i] = 1;
    w.roadAccess[i] = 1;
  }
  return w;
}

function dark(w: World, x: number, y: number, anger: number, months = 3): number {
  const i = w.idx(x, y);
  w.powered[i] = 0;
  w.anger[i] = anger;
  w.troubleMonths[i] = months;
  w.troubleWhat[i] = gripCode('power');
  return i;
}

describe('el panel', () => {
  it('el tiempo se dice como lo dice la gente', () => {
    expect(timeAgo(1)).toBe('hace un mes');
    expect(timeAgo(3)).toBe('hace 3 meses');
    expect(timeAgo(12)).toBe('hace un año');
    expect(timeAgo(14)).toBe('hace un año y 2 meses');
    expect(timeAgo(25)).toBe('hace 2 años y 1 mes');
    expect(timeAgo(255)).toBe('hace más de veinte años');
  });

  it('el resto se cuenta con su problema, y en singular cuando es uno', () => {
    expect(moreLine([])).toBe('');
    expect(moreLine([{ grip: 'power', count: 1, label: 'el mismo problema de la luz' }])).toMatch(/un vecino/);
    const many = moreLine([{ grip: 'power', count: 27, label: 'el mismo problema de la luz' }]);
    expect(many).toMatch(/27<\/b> vecinos más/);
    expect(many).toMatch(/el mismo problema de la luz/);
  });

  it('una tarjeta lleva nombre, dirección, tiempo, queja y enojo', () => {
    const w = city();
    dark(w, 4, 4, 78, 8);
    const html = vecinosHtml(vecinosReport(w, KINDS, 1));
    expect(html).toContain(vecinoOf(4, 4, 1).name);
    expect(html).toMatch(/Manzana 8 · lote 1/);
    expect(html).toMatch(/hace 8 meses/);
    expect(html).toMatch(/luz/i);
    expect(html).toMatch(/78 %/);
    expect(html).toMatch(/data-go="\d+"/);
  });

  it('sin quejas lo dice y no inventa tarjetas', () => {
    const html = vecinosHtml(vecinosReport(city(), KINDS, 1));
    expect(html).toMatch(/Nadie se está quejando/);
    expect(html).not.toMatch(/data-go=/);
  });

  it('el agradecimiento va aparte, con su sello', () => {
    const w = city();
    dark(w, 2, 2, 50); // hay una queja viva, así que el panel entra por la rama completa
    const i = w.idx(6, 6);
    w.fixedMonths[i] = 0;
    w.troubleWhat[i] = gripCode('crime');
    const html = vecinosHtml(vecinosReport(w, KINDS, 1));
    expect(html).toMatch(/Se arregló/);
    expect(html).toMatch(/resuelto/);
    expect(html).toMatch(/comisaría/);
  });

  it('el botón lleva el número sólo cuando hay alguien quejándose', () => {
    expect(vecinosButtonLabel(0)).toBe('Los vecinos');
    expect(vecinosButtonLabel(3)).toBe('Los vecinos (3)');
  });
});
