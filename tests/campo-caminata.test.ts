/**
 * A2 · S7: los lotes pegados se llegan caminando por el campo.
 *
 * "No necesitaría tanta calle para llegar al lote": un lote contiguo (borde o esquina) a un lote
 * servido queda servido, y la servidumbre se propaga por la cadena de lotes. El lote suelto lejos de
 * la calle sigue sin servir.
 */
import { describe, expect, it } from 'vitest';
import { farmServida, truckNetwork } from '../src/world/farms';
import { World, TILE } from '../src/world/world';

const N = 40;
const world = (): World => new World({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(4), trees: new Uint8Array(N * N) });

/** Feria 3×3 en (10,10), calle en x=9 (y 10..12) que la toca, y cuatro lotes en cadena hacia el oeste. */
function campoEnCadena(): World {
  const w = world();
  w.setTile(9, 10, TILE.ROAD);
  w.setTile(9, 11, TILE.ROAD);
  w.setTile(9, 12, TILE.ROAD);
  w.markets.push({ x: 10, y: 10 });
  // Lote A: al lado de la calle (2 cuadras). B: pegado a A, 4 cuadras de la calle —solo por caminata—.
  // C: pegado a B en diagonal. D: suelto, sin nadie cerca.
  w.farms.push({ x: 6, y: 10, crop: 'trigo' }, { x: 4, y: 10, crop: 'trigo' }, { x: 2, y: 8, crop: 'trigo' }, { x: 2, y: 2, crop: 'trigo' });
  return w;
}

describe('farmServida caminando entre lotes', () => {
  it('el lote pegado a un lote servido queda servido aunque la calle quede lejos', () => {
    const w = campoEnCadena();
    const s = farmServida(w);
    expect(s[0]).toBe(true); // A: tiene la calle al lado
    expect(s[1]).toBe(true); // B: pegado a A
    expect(s[2]).toBe(true); // C: pegado a B en diagonal
  });

  it('el lote suelto sin cadena no se sirve', () => {
    const w = campoEnCadena();
    expect(farmServida(w)[3]).toBe(false);
  });

  it('sin lote servido que contagie, la cadena no inventa servidumbre', () => {
    const w = campoEnCadena();
    w.farms = w.farms.filter((_, k) => k !== 0); // sin A, B y C quedan colgados
    const s = farmServida(w);
    expect(s[0]).toBe(false);
    expect(s[1]).toBe(false);
  });

  it('la red del camión no cambia: la calle suelta lejos de la feria no entra', () => {
    const w = campoEnCadena();
    w.setTile(2, 20, TILE.ROAD);
    const net = truckNetwork(w);
    expect(net[20 * N + 2]).toBe(0);
  });
});
