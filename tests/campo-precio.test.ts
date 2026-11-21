import { describe, expect, it } from 'vitest';
import { COSTS } from '../src/config';
import { toolPrice } from '../src/ui/toolbar';
import { TOOL_GROUPS, type ToolId } from '../src/world/tools';

describe('el precio de las herramientas del campo', () => {
  it('la barra dice lo que cuestan las tres piezas', () => {
    expect(toolPrice('farm')).toBe(COSTS.farm);
    expect(toolPrice('silo')).toBe(COSTS.silo);
    expect(toolPrice('market')).toBe(COSTS.market);
  });

  /**
   * El bug que esto previene: las tres piezas del campo se agregaron a la barra y el precio se quedó en
   * blanco, porque `toolPrice` no tenía casos para ellas y su `default` devuelve `null` —que la barra pinta
   * como un hueco vacío—. Ninguna herramienta que cuesta plata puede no tener precio: el jugador ve tres
   * botones sin número y no sabe si son gratis.
   */
  it('ninguna herramienta construible se queda sin precio', () => {
    const todas: ToolId[] = TOOL_GROUPS.flatMap((g) => g.tools);
    // Consulta es la única que no construye nada: es la lupa.
    const faltan = todas.filter((t) => t !== 'query' && toolPrice(t) === null);
    expect(faltan).toEqual([]);
  });
});
