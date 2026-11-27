/**
 * A1 · S6: el sprite del campo se apoya en el suelo de su esquina de atrás.
 *
 * El ancla del sprite es la esquina de atrás del recuadro (`toCache(minVx, minVy, h)`), así que `h`
 * tiene que ser la altura del terreno en ESA esquina. `hubHeight` usa el máximo de todo el footprint:
 * en una pendiente que sube hacia adelante el sprite flota —lo tapan el suelo de las celdas de
 * adelante y la banda del diario—. `padHeight` es la altura de la esquina de anclaje.
 */
import { describe, expect, it } from 'vitest';
import { FARM_SIZE, MARKET_SIZE, SILO_SIZE } from '../src/config';
import { hubHeight, padHeight } from '../src/render/geometry';
import { World, TILE } from '../src/world/world';

const N = 16;
const flat = (h: number): World => new World({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(h), trees: new Uint8Array(N * N) });

describe('padHeight', () => {
  it('en llano coincide con la altura del terreno', () => {
    expect(padHeight(flat(5), 4, 4, FARM_SIZE)).toBe(5);
  });

  it('ancla en la esquina de atrás aunque el frente del lote suba', () => {
    // Lote 2x2 en (4,4): la esquina de atrás a 3, las de adelante a 9.
    const w = flat(9);
    const s = w.n + 1;
    w.terrain.corners[4 * s + 4] = 3;
    expect(hubHeight(w, 4, 4, FARM_SIZE, FARM_SIZE)).toBe(9); // así flota
    expect(padHeight(w, 4, 4, FARM_SIZE)).toBe(3); // así se apoya
  });

  it('sirve para el silo y la feria', () => {
    const w = flat(4);
    expect(padHeight(w, 3, 3, SILO_SIZE)).toBe(4);
    expect(padHeight(w, 2, 2, MARKET_SIZE)).toBe(4);
  });

  it('el tile bajo el lote no cambia el ancla (es terreno, no pieza)', () => {
    const w = flat(4);
    w.setTile(5, 5, TILE.FARM);
    expect(padHeight(w, 4, 4, FARM_SIZE)).toBe(4);
  });
});
