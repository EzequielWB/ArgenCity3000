import { describe, expect, it } from 'vitest';
import { CROPS } from '../src/config';
import { paintFarm } from '../src/render/pixelArt';
import { farmStateOf } from '../src/sim/campo';

interface Art {
  px: { w: number; h: number; data: Uint8ClampedArray };
  ax: number;
  ay: number;
}

/**
 * Los tests de arte cuentan estructura, no miran: un sprite es una grilla de píxeles y lo que se puede
 * afirmar de ella es qué colores aparecen, cuántos y dónde.
 */
function colors(s: Art): Map<number, number> {
  const d = s.px.data;
  const map = new Map<number, number>();
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

const tones = (s: Art): number => colors(s).size;

const root = (c: number) => [c >> 16, (c >> 8) & 255, c & 255];
/** Cuánta pintura es dorada (trigo): el rojo manda sobre el azul y el verde está arriba del azul. */
const dorado = (s: Art): number => {
  let k = 0;
  for (const [c, n] of colors(s)) {
    const [r, g, b] = root(c);
    if (r > 140 && g > 100 && b < 130 && r > b + 40) k += n;
  }
  return k;
};

describe('el lote sabe en qué mes está', () => {
  it('el trigo está crecido de junio a noviembre', () => {
    for (const mes of [6, 7, 8, 9, 10, 11]) expect(farmStateOf(mes), `mes ${mes}`).toBe('crecido');
  });

  it('en mayo se sembró y todavía no hay nada: el lote está arado', () => {
    expect(farmStateOf(CROPS.trigo.sow)).toBe('arado');
  });

  it('después de la cosecha queda el rastrojo, de diciembre a abril', () => {
    for (const mes of [12, 1, 2, 3, 4]) expect(farmStateOf(mes), `mes ${mes}`).toBe('rastrojo');
  });

  it('no hay mes del año sin estado', () => {
    for (let m = 1; m <= 12; m++) expect(['crecido', 'arado', 'rastrojo']).toContain(farmStateOf(m));
  });
});

describe('el lote se dibuja distinto según el estado', () => {
  it('crecido tiene mucho más dorado que arado: el trigo se ve', () => {
    const crecido = dorado(paintFarm('crecido', false));
    const arado = dorado(paintFarm('arado', false));
    expect(crecido).toBeGreaterThan(arado * 3);
  });

  it('el rastrojo conserva algo de paja pero bastante menos que el trigo en pie', () => {
    const crecido = dorado(paintFarm('crecido', false));
    const rastrojo = dorado(paintFarm('rastrojo', false));
    expect(rastrojo).toBeGreaterThan(0);
    expect(rastrojo).toBeLessThan(crecido * 0.8);
  });

  it('arado y rastrojo no son el mismo dibujo', () => {
    expect(tones(paintFarm('arado', false))).not.toBe(tones(paintFarm('rastrojo', false)));
  });

  it('el mismo estado pinta exactamente lo mismo dos veces', () => {
    const a = paintFarm('crecido', false);
    const b = paintFarm('crecido', false);
    expect(Array.from(a.px.data)).toEqual(Array.from(b.px.data));
  });
});

describe('el lote avisa cuando la cadena está cortada', () => {
  it('con el aviso puesto el lote gana píxeles que antes no tenía', () => {
    const limpio = colors(paintFarm('crecido', false));
    const aviso = colors(paintFarm('crecido', true));
    let nuevos = 0;
    for (const [c, n] of aviso) if (!limpio.has(c)) nuevos += n;
    expect(nuevos).toBeGreaterThan(6);
  });

  it('el aviso se ve igual de bien en los tres estados', () => {
    for (const estado of ['crecido', 'arado', 'rastrojo'] as const) {
      const limpio = colors(paintFarm(estado, false));
      const aviso = colors(paintFarm(estado, true));
      let nuevos = 0;
      for (const [c, n] of aviso) if (!limpio.has(c)) nuevos += n;
      expect(nuevos, estado).toBeGreaterThan(6);
    }
  });
});
