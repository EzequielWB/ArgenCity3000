/**
 * El desplegable de la radio: que la fila diga quién llama, cuántos vecinos representa, hace cuánto, qué
 * enojo tiene y a dónde lleva el botón; que el agradecimiento sea una cita sin sello; y que sin llamados no
 * invente filas.
 */
import { describe, expect, it } from 'vitest';
import { VECINOS } from '../src/config';
import { gripCode, vecinoOf, vecinosReport } from '../src/sim/vecinos';
import { timeAgo, vecinosHtml } from '../src/ui/vecinos';
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

describe('el desplegable', () => {
  it('el tiempo se dice como lo dice la gente', () => {
    expect(timeAgo(1)).toBe('hace un mes');
    expect(timeAgo(3)).toBe('hace 3 meses');
    expect(timeAgo(12)).toBe('hace un año');
    expect(timeAgo(14)).toBe('hace un año y 2 meses');
    expect(timeAgo(25)).toBe('hace 2 años y 1 mes');
    expect(timeAgo(255)).toBe('hace más de veinte años');
  });

  it('una fila lleva el nombre, el barrio, el tiempo, la cita y el enojo', () => {
    const w = city();
    dark(w, 4, 4, 78, 8);
    const html = vecinosHtml(vecinosReport(w, KINDS, 1));
    // El nombre va sin el tratamiento: la radio no dice «Don Osvaldo», dice «Osvaldo».
    const name = vecinoOf(4, 4, 1).name.replace(/^(Doña|Don) /, '');
    expect(html).toContain(name);
    expect(html).toMatch(/hace 8 meses/);
    expect(html).toMatch(/78 %/);
    expect(html).toMatch(/data-go="\d+"/);
    // La cita va entre comillas y en bastardilla.
    expect(html).toMatch(/class="callo-say">«/);
  });

  it('cuenta los vecinos del barrio, y dice «uno solo» cuando es una casa', () => {
    const w = city();
    dark(w, 4, 4, 78);
    expect(vecinosHtml(vecinosReport(w, KINDS, 1))).toContain('uno solo');
    for (let k = 1; k < 4; k++) dark(w, 4 + k, 4, 78);
    expect(vecinosHtml(vecinosReport(w, KINDS, 1))).toContain('4 vecinos');
  });

  it('la cabecera cuenta los lotes y los barrios por separado', () => {
    const w = city();
    for (let k = 0; k < 3; k++) dark(w, 2 + k, 2, 40); // un barrio de tres
    dark(w, 10, 10, 40); // y una casa sola
    const html = vecinosHtml(vecinosReport(w, KINDS, 1));
    expect(html).toContain('4 vecinos · 2 barrios');
  });

  it('avisa cuántos barrios quedaron afuera cuando hay más de los que entran', () => {
    const w = city();
    for (let k = 0; k < VECINOS.listed + 2; k++) dark(w, 1 + k * 3, 1, 30 + k);
    const html = vecinosHtml(vecinosReport(w, KINDS, 1));
    expect(html).toContain('Y 2 barrios más, menos enojados.');
  });

  it('sin llamados lo dice, no inventa filas y deja la regla del sistema', () => {
    const html = vecinosHtml(vecinosReport(city(), KINDS, 1));
    expect(html).toMatch(/No llama nadie/);
    expect(html).toContain('nadie llama');
    expect(html).not.toMatch(/data-go=/);
    expect(html).not.toMatch(/drop-rest/);
  });

  it('el agradecimiento es una cita sola, sin la etiqueta «resuelto»', () => {
    const w = city();
    dark(w, 2, 2, 50); // hay una queja viva, así que el desplegable entra por la rama completa
    const i = w.idx(6, 6);
    w.fixedMonths[i] = 0;
    w.troubleWhat[i] = gripCode('crime');
    const html = vecinosHtml(vecinosReport(w, KINDS, 1));
    expect(html).toContain('callo-done');
    expect(html).toMatch(/comisaría/);
    expect(html).not.toMatch(/resuelto/i);
  });
});
