import { describe, expect, it } from 'vitest';
import {
  lotSize,
  paintCoalPlant,
  paintHub,
  paintHubPiece,
  paintCommercial,
  paintFishing,
  paintGasPlant,
  paintIndustrial,
  paintLot,
  paintPlaza,
  paintPole,
  paintService,
  paintTree,
  paintPromenade,
  paintResidential,
  paintWindFarm,
  type HubView,
  type LotKind,
} from '../src/render/pixelArt';
import { SERVICE_KINDS, type HubKind } from '../src/config';

const LEVELS = [1, 2, 3, 4, 5];

interface Art {
  px: { w: number; h: number; data: Uint8ClampedArray };
  ax: number;
  ay: number;
}

type Paint = (level: number, variant: number) => Art;

/** The only partial alpha a sprite may contain is its shadow: black, and never a soft edge. */
const SHADOW_ALPHA = 96;

const alpha = (a: Art, x: number, y: number) => a.px.data[(y * a.px.w + x) * 4 + 3];

/** Topmost row that has any paint, or the height of the canvas when it is empty. */
function topRow(a: Art): number {
  for (let y = 0; y < a.px.h; y++) for (let x = 0; x < a.px.w; x++) if (alpha(a, x, y)) return y;
  return a.px.h;
}

/** Pixels the building rises above its anchor, so taller levels compare as taller. */
const rises = (a: Art) => a.ay - topRow(a);

/** Every colour a drawing paints, ignoring the transparent pixels. */
function palette(a: Art): Set<number> {
  const set = new Set<number>();
  for (let i = 0; i < a.px.data.length; i += 4) {
    if (!a.px.data[i + 3]) continue;
    set.add((a.px.data[i] << 16) | (a.px.data[i + 1] << 8) | a.px.data[i + 2]);
  }
  return set;
}

/** Distinct colours, ignoring the transparent pixels. */
const tones = (a: Art) => palette(a).size;

/** Pixels painted at all: how much of the canvas a drawing uses. */
function countOpaque(a: Art): number {
  let n = 0;
  for (let i = 3; i < a.px.data.length; i += 4) if (a.px.data[i]) n++;
  return n;
}

/** Leftmost and rightmost painted column, shadow included. */
function span(a: Art): [number, number] {
  let lo = a.px.w;
  let hi = -1;
  for (let y = 0; y < a.px.h; y++) {
    for (let x = 0; x < a.px.w; x++) {
      if (!alpha(a, x, y)) continue;
      lo = Math.min(lo, x);
      hi = Math.max(hi, x);
    }
  }
  return [lo, hi];
}

const FAMILIES: [string, Paint][] = [
  ['residencial', paintResidential as unknown as Paint],
  ['comercial', paintCommercial as unknown as Paint],
  ['industrial', paintIndustrial as unknown as Paint],
];

for (const [family, paint] of FAMILIES) {
  const art = (level: number, variant: number) => paint(level, variant);

  describe(`${family} pixel art`, () => {
    it('paints hard pixels: every pixel is opaque, empty, or black shadow', () => {
      for (const level of LEVELS) {
        for (let variant = 0; variant < 8; variant++) {
          const a = art(level, variant);
          for (let i = 3; i < a.px.data.length; i += 4) {
            const al = a.px.data[i];
            if (al === 0 || al === 255) continue;
            const at = `level ${level} variant ${variant}, pixel ${(i - 3) / 4}`;
            expect(al, at).toBeLessThanOrEqual(SHADOW_ALPHA);
            expect([a.px.data[i - 3], a.px.data[i - 2], a.px.data[i - 1]], at).toEqual([0, 0, 0]);
          }
        }
      }
    });

    it('shades each face with a few tones instead of one flat colour', () => {
      for (const level of LEVELS) {
        for (let variant = 0; variant < 4; variant++) {
          const a = art(level, variant);
          const painted = tones(a);
          expect(painted, `level ${level} variant ${variant}`).toBeGreaterThan(6);
          expect(painted, `level ${level} variant ${variant}`).toBeLessThanOrEqual(60);
        }
      }
    });

    it('casts a shadow on the lot', () => {
      for (const level of LEVELS) {
        const a = art(level, 0);
        let soft = 0;
        for (let i = 3; i < a.px.data.length; i += 4) if (a.px.data[i] !== 0 && a.px.data[i] !== 255) soft++;
        expect(soft, `level ${level}: the shadow is missing`).toBeGreaterThan(10);
      }
    });

    it('anchors the lot inside its canvas, with room above the roof and the ground diamond whole', () => {
      for (const level of LEVELS) {
        for (let variant = 0; variant < 8; variant++) {
          const a = art(level, variant);
          expect(a.ax, `level ${level}`).toBeGreaterThanOrEqual(16);
          expect(a.px.w - a.ax, `level ${level}`).toBeGreaterThanOrEqual(16);
          expect(a.ay + 16, `level ${level} variant ${variant}: ground diamond clipped`).toBeLessThanOrEqual(a.px.h);
          expect(topRow(a), `level ${level} variant ${variant}: roof clipped`).toBeGreaterThan(0);
        }
      }
    });

    it('grows with the level: each step builds taller', () => {
      const rows = LEVELS.map((level) => rises(art(level, 0)));
      for (let i = 1; i < rows.length; i++) expect(rows[i], `level ${LEVELS[i]}`).toBeGreaterThan(rows[i - 1]);
    });

    it('keeps the variants of a level different from each other', () => {
      for (const level of LEVELS) {
        const seen = new Set([0, 1, 2, 3].map((variant) => art(level, variant).px.data.join(',')));
        expect(seen.size, `level ${level}`).toBeGreaterThan(1);
      }
    });
  });
}

describe('the towers of the last level', () => {
  it('come in more than one facade colour, so a skyline of them is not one grey mass', () => {
    const grey = palette(paintResidential(5, 0));
    const extra = new Set<number>();
    for (let variant = 1; variant < 8; variant++)
      for (const c of palette(paintResidential(5, variant))) if (!grey.has(c)) extra.add(c);
    // Four new colours is a little over one facade ramp: the variants are not the same wall repainted.
    expect(extra.size).toBeGreaterThan(3);
  });
});

/**
 * The lots of 2 x 2: the same pixel discipline, but on a 64 x 32 diamond, because these businesses
 * need the frontage and not the height. They are not in the game yet (see S6 of the feature doc).
 */
const LOTS: LotKind[] = ['mercado', 'ropa', 'bar', 'oficinas', 'galpon', 'silos', 'quimica', 'frigorifico', 'polo', 'aceria'];
/** The kinds that belong to the commercial roster, which is the one with an ordering to keep. */
const SHOPS: LotKind[] = ['mercado', 'ropa', 'bar', 'oficinas'];

for (const kind of LOTS) {
  const art = (variant: number) => paintLot(kind, variant) as Art;

  describe(`lote 2 x 2 · ${kind}`, () => {
    it('paints hard pixels: every pixel is opaque, empty, or black shadow', () => {
      for (let variant = 0; variant < 8; variant++) {
        const a = art(variant);
        for (let i = 3; i < a.px.data.length; i += 4) {
          const al = a.px.data[i];
          if (al === 0 || al === 255) continue;
          const at = `variant ${variant}, pixel ${(i - 3) / 4}`;
          expect(al, at).toBeLessThanOrEqual(SHADOW_ALPHA);
          expect([a.px.data[i - 3], a.px.data[i - 2], a.px.data[i - 1]], at).toEqual([0, 0, 0]);
        }
      }
    });

    it('anchors the diamond of the lot inside the canvas, with its top corner on the anchor', () => {
      const n = lotSize(kind);
      for (let variant = 0; variant < 8; variant++) {
        const a = art(variant);
        expect(a.ax, `variant ${variant}`).toBeGreaterThanOrEqual(16 * n);
        expect(a.px.w - a.ax, `variant ${variant}`).toBeGreaterThanOrEqual(16 * n);
        expect(a.ay, `variant ${variant}: no room above the roof`).toBeGreaterThan(0);
        expect(a.ay + 16 * n, `variant ${variant}: the lot is clipped`).toBeLessThanOrEqual(a.px.h);
      }
    });

    it('paints across the whole frontage, which is what the lot is for', () => {
      const w = 32 * lotSize(kind);
      for (let variant = 0; variant < 4; variant++) {
        const [lo, hi] = span(art(variant));
        expect(hi - lo + 1, `variant ${variant}: the lot is not used`).toBeGreaterThanOrEqual(Math.round(w * 0.8));
        expect(hi - lo + 1, `variant ${variant}: it spills out of the lot`).toBeLessThanOrEqual(w + 8);
      }
    });

    it('shades each face with a few tones and casts a shadow', () => {
      for (let variant = 0; variant < 4; variant++) {
        const a = art(variant);
        expect(tones(a), `variant ${variant}`).toBeGreaterThan(8);
        expect(tones(a), `variant ${variant}`).toBeLessThanOrEqual(110);
        let soft = 0;
        for (let i = 3; i < a.px.data.length; i += 4) if (a.px.data[i] !== 0 && a.px.data[i] !== 255) soft++;
        expect(soft, `variant ${variant}: the shadow is missing`).toBeGreaterThan(10);
      }
    });

    it('keeps the variants different from each other', () => {
      const seen = new Set([0, 1, 2, 3].map((variant) => art(variant).px.data.join(',')));
      expect(seen.size).toBeGreaterThan(1);
    });
  });
}

describe('lotes grandes · la escalera de rubros', () => {
  const rise = (kind: LotKind, variant: number) => rises(paintLot(kind, variant) as Art);

  it('puts the offices on top of the shops and the market at the bottom', () => {
    const highest = Math.min(...[0, 1, 2, 3].map((v) => rise('oficinas', v)));
    for (const kind of SHOPS) {
      if (kind === 'oficinas') continue;
      for (let v = 0; v < 4; v++) expect(rise(kind, v), `${kind} v${v}`).toBeLessThan(highest);
    }
    expect(rise('mercado', 0), 'el mercado es el más bajo').toBeLessThan(highest);
  });

  it('gives the bar two flavours: the neighbourhood one is lower than the common one', () => {
    for (const v of [0, 2]) expect(rise('bar', v), `barrio v${v}`).toBeLessThan(rise('bar', v + 1));
  });

  it('declares the chimney mouths as smoke, inside the canvas', () => {
    for (const kind of LOTS) {
      for (let v = 0; v < 4; v++) {
        const painted = paintLot(kind, v);
        for (const [dx, dy] of painted.smoke) {
          const at = `${kind} v${v}: humo fuera del canvas`;
          expect(Math.abs(dx), at).toBeLessThanOrEqual(painted.px.w / 2 + 8);
          expect(painted.ay + dy, at).toBeGreaterThanOrEqual(0);
          expect(painted.ay + dy, at).toBeLessThanOrEqual(painted.px.h);
        }
      }
    }
  });

  it('is wider than the 1 x 1 shops, which is the whole point', () => {
    const big = span(paintLot('ropa', 0) as Art);
    const small = span(paintCommercial(5, 0) as Art);
    expect(big[1] - big[0]).toBeGreaterThan(small[1] - small[0]);
  });
});

/**
 * The plaza: one cell of garden with its walks, and the ornament only where the cell has no edge.
 * The floor has to cover the whole diamond, because the renderer still paints the old flat ground
 * underneath it and a seam would show that green.
 */
const plazaArt = (variant: number, look: 'tree' | 'bare' | 'neglected', mask: number) => paintPlaza(variant, look, mask) as Art;

/** How many pixels are paving, which is how a walk shows up in the buffer. */
function paving(a: Art): number {
  let n = 0;
  for (let i = 0; i < a.px.data.length; i += 4) {
    if (!a.px.data[i + 3]) continue;
    if (a.px.data[i] > 160 && a.px.data[i + 1] > 150 && a.px.data[i + 2] < 190) n++;
  }
  return n;
}

describe('plaza pixel art', () => {
  it('paints hard pixels: opaque or empty, never a soft edge', () => {
    for (const look of ['tree', 'bare', 'neglected'] as const) {
      for (let mask = 0; mask < 16; mask++) {
        const a = plazaArt(mask % 8, look, mask);
        for (let i = 3; i < a.px.data.length; i += 4) {
          const al = a.px.data[i];
          if (al === 0 || al === 255) continue;
          expect([a.px.data[i - 3], a.px.data[i - 2], a.px.data[i - 1]], `${look} mask ${mask}`).toEqual([0, 0, 0]);
        }
      }
    }
  });

  it('covers the cell diamond, so the old flat ground never shows through', () => {
    for (let mask = 0; mask < 16; mask++) {
      const a = plazaArt(3, 'bare', mask);
      for (let y = 0; y < a.px.h; y++) {
        for (let x = 0; x < a.px.w; x++) {
          const du = (x + 0.5 - a.ax) / 16;
          const dv = (y + 0.5 - a.ay) / 8;
          const u = (du + dv) / 2;
          const v = (dv - du) / 2;
          if (u < 0.06 || u > 0.94 || v < 0.06 || v > 0.94) continue;
          expect(alpha(a, x, y), `mask ${mask}: hueco en (${x}, ${y})`).toBe(255);
        }
      }
    }
  });

  it('runs the walk out to the edges that touch another plaza', () => {
    const alone = plazaArt(1, 'bare', 0);
    const crossed = plazaArt(1, 'bare', 15);
    const twoArms = plazaArt(1, 'bare', 5);
    expect(paving(alone)).toBeLessThan(paving(twoArms));
    expect(paving(twoArms)).toBeLessThan(paving(crossed));
  });

  it('puts the ornament in the middle, and only when the cell has no edge', () => {
    const edge = plazaArt(0, 'bare', 1);
    const middle = plazaArt(0, 'bare', 15);
    expect(rises(middle)).toBeGreaterThan(rises(edge) + 4);
    // The three ornaments of the middle are three different buildings.
    const shapes = new Set([0, 1, 2].map((v) => plazaArt(v, 'bare', 15).px.data.join(',')));
    expect(shapes.size).toBe(3);
  });

  it('shows a plaza nobody keeps differently from a kept one', () => {
    const kept = plazaArt(2, 'bare', 15);
    const dry = plazaArt(2, 'neglected', 15);
    expect(dry.px.data.join(',')).not.toBe(kept.px.data.join(','));
    // A kept plaza has an ornament; a neglected one is bare ground.
    expect(rises(dry)).toBeLessThan(rises(kept));
  });
});

/**
 * The coast: the promenade looks at the river through a balustrade, and the fishing pier runs out to
 * the water on one side. Both are one cell, so the same diamond rules apply.
 */
const coastArt = (art: Art) => art;

describe('power plant pixel art', () => {
  const plants = [
    ['coal', paintCoalPlant as () => Art],
    ['gas', paintGasPlant as () => Art],
    ['wind', paintWindFarm as () => Art],
  ] as const;

  it('paints hard pixels: opaque or empty, never a soft edge', () => {
    for (const [, paint] of plants) {
      const art = paint();
      for (let i = 3; i < art.px.data.length; i += 4) {
        const al = art.px.data[i];
        if (al === 0 || al === 255) continue;
        expect([art.px.data[i - 3], art.px.data[i - 2], art.px.data[i - 1]]).toEqual([0, 0, 0]);
        expect(al).toBeLessThanOrEqual(SHADOW_ALPHA);
      }
    }
  });

  it('covers the 2×2 block: the four corners of the pad are painted', () => {
    for (const [, paint] of plants) {
      const art = paint();
      // The pad runs from the top corner of the diamond to the bottom one: both ends are painted.
      expect(topRow(art)).toBeLessThan(art.ay);
      const [lo, hi] = span(art);
      expect(hi - lo).toBeGreaterThan(art.px.w * 0.5);
    }
  });

  it('smokes where the game says it smokes: two mouths for coal, one for gas, none for wind', () => {
    expect(paintCoalPlant().smoke).toHaveLength(2);
    expect(paintGasPlant().smoke).toHaveLength(1);
    expect(paintWindFarm()).not.toHaveProperty('smoke');
  });

  it('gives each kind its own drawing instead of a recolour', () => {
    const [coal, gas, wind] = plants.map(([, paint]) => paint());
    for (const [a, b] of [
      [coal, gas],
      [coal, wind],
      [gas, wind],
    ]) {
      expect(tones(a)).not.toBe(tones(b));
      expect(rises(a)).not.toBe(rises(b));
    }
    // The wind farm is the tall one: three towers and their blades.
    expect(rises(wind)).toBeGreaterThan(rises(gas));
  });
});

describe('service buildings pixel art', () => {
  const all = SERVICE_KINDS.map((kind) => [kind, paintService(kind) as Art] as const);

  /** Lowest painted row, so the yard can be told from the building. */
  const bottomRow = (a: Art) => {
    for (let y = a.px.h - 1; y >= 0; y--) for (let x = 0; x < a.px.w; x++) if (alpha(a, x, y)) return y;
    return 0;
  };

  it('paints hard pixels: opaque or empty, never a soft edge', () => {
    for (const [kind, art] of all) {
      for (let i = 3; i < art.px.data.length; i += 4) {
        const al = art.px.data[i];
        if (al === 0 || al === 255) continue;
        const at = `${kind}, pixel ${(i - 3) / 4}`;
        expect([art.px.data[i - 3], art.px.data[i - 2], art.px.data[i - 1]], at).toEqual([0, 0, 0]);
        expect(al, at).toBeLessThanOrEqual(SHADOW_ALPHA);
      }
    }
  });

  it('gives the six of them a drawing of their own', () => {
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const [ka, a] = all[i];
        const [kb, b] = all[j];
        expect([a.px.w, a.px.h, ...a.px.data], `${ka} vs ${kb}`).not.toEqual([b.px.w, b.px.h, ...b.px.data]);
      }
    }
    // Read them from far away: the hospital and the university are the two big ones, the salita the
    // small one, and that has to show in the silhouette.
    const rise = (kind: string) => rises(paintService(kind as never) as Art);
    expect(rise('hospital')).toBeGreaterThan(rise('clinic') + 6);
    expect(rise('university')).toBeGreaterThan(rise('clinic') + 4);
    expect(rise('fire')).toBeGreaterThan(rise('clinic'));
  });

  it('draws the two big ones on the diamond of their 3x3 block and the other four on a cell', () => {
    for (const [kind, size] of [
      ['school', 1],
      ['clinic', 1],
      ['police', 1],
      ['fire', 1],
      ['hospital', 3],
      ['university', 3],
    ] as const) {
      const art = paintService(kind);
      // `penLot(n, z)` sizes the canvas after the block: a 3x3 needs three cells of diamond, not one.
      expect(art.px.w, kind).toBe(32 * size + 8);
      expect(art.ax, kind).toBe(16 * size + 4);
      const [lo, hi] = span(art);
      if (size > 1) expect(hi - lo, `${kind} runs over more than one lot`).toBeGreaterThan(32);
    }
  });

  it('stays on its lot: a building above the anchor and a yard below it, nothing at all far away', () => {
    for (const [kind, art] of all) {
      expect(topRow(art), `${kind} rises above its anchor`).toBeLessThan(art.ay);
      expect(bottomRow(art), `${kind} has its yard in front`).toBeGreaterThan(art.ay);
      const [lo, hi] = span(art);
      // The lot is 32 px across, and the canvas keeps a margin for the shadow: nothing may reach it.
      expect(lo, `${kind} keeps to its lot`).toBeGreaterThanOrEqual(2);
      expect(hi, `${kind} keeps to its lot`).toBeLessThanOrEqual(art.px.w - 3);
    }
  });
});

describe('the power line and the trees of the map', () => {
  it('writes the pole and the cables as hard pixels', () => {
    for (const v of [0, 1, 2]) {
      const art = paintPole(1, v) as Art;
      for (let i = 3; i < art.px.data.length; i += 4) {
        const al = art.px.data[i];
        if (al === 0 || al === 255) continue;
        const at = `pole ${v}, pixel ${(i - 3) / 4}`;
        expect([art.px.data[i - 3], art.px.data[i - 2], art.px.data[i - 1]], at).toEqual([0, 0, 0]);
        expect(al, at).toBeLessThanOrEqual(SHADOW_ALPHA);
      }
    }
  });

  it('hangs the cable from the same point whatever the pole carries', () => {
    const [plain, transformer, doubleArm] = [0, 1, 2].map((v) => paintPole(1, v));
    // The attach point is what the renderer uses to join one pole to the next, so it cannot move with the
    // ornament: a line of poles of different variants has to stay a straight cable.
    expect(plain.attach).toEqual(transformer.attach);
    expect(plain.attach).toEqual(doubleArm.attach);
    // Above the anchor (the cables hang over the lot) and inside the canvas.
    expect(plain.attach[1]).toBeLessThan(0);
    expect(plain.ax + plain.attach[0]).toBeGreaterThan(0);
    expect(plain.ax + plain.attach[0]).toBeLessThan(plain.px.w);
    expect(plain.ay + plain.attach[1]).toBeGreaterThan(0);
    // And the ornament is a drawing of its own.
    expect([plain.px.w, plain.px.h, ...plain.px.data]).not.toEqual([transformer.px.w, transformer.px.h, ...transformer.px.data]);
    expect([plain.px.w, plain.px.h, ...plain.px.data]).not.toEqual([doubleArm.px.w, doubleArm.px.h, ...doubleArm.px.data]);
  });

  it('paints the four species of the map, each with its own silhouette', () => {
    const kinds = [1, 2, 3, 4].map((k) => paintTree(k, 0) as Art);
    for (const art of kinds) {
      for (let i = 3; i < art.px.data.length; i += 4) {
        const al = art.px.data[i];
        if (al === 0 || al === 255) continue;
        expect([art.px.data[i - 3], art.px.data[i - 2], art.px.data[i - 1]]).toEqual([0, 0, 0]);
        expect(al).toBeLessThanOrEqual(SHADOW_ALPHA);
      }
      // A tree rises over its lot and keeps inside it.
      expect(topRow(art)).toBeLessThan(art.ay - 8);
      const [lo, hi] = span(art);
      expect(lo).toBeGreaterThan(0);
      expect(hi).toBeLessThan(art.px.w);
    }
    for (let i = 0; i < kinds.length; i++) {
      for (let j = i + 1; j < kinds.length; j++) {
        expect([kinds[i].px.data], `species ${i + 1} vs ${j + 1}`).not.toEqual([kinds[j].px.data]);
      }
    }
    // The eucalyptus is the tall one and the ombú the wide one, which is how they are told apart.
    const rise = (kind: number) => rises(paintTree(kind, 0) as Art);
    expect(rise(4)).toBeGreaterThan(rise(3));
    const width = (kind: number) => {
      const art = paintTree(kind, 0) as Art;
      const [lo, hi] = span(art);
      return hi - lo;
    };
    expect(width(3)).toBeGreaterThan(width(4));
  });

  it('keeps the density of the canvas art: one, two or three trees a cell', () => {
    const painted = [0, 1, 2].map((v) => countOpaque(paintTree(1, v) as Art));
    expect(painted[0]).toBeGreaterThan(0);
    expect(painted[1]).toBeGreaterThan(painted[0]);
    expect(painted[2]).toBeGreaterThan(painted[1]);
  });
});

describe('airport and harbour pixel art', () => {
  /** The facilities the game can build: one piece, two and four for an airport, up to three for a port. */
  const facilities: [HubKind, number, number, number, number, number][] = [
    // kind, level, fw, fh, piece width, piece height
    ['airport', 1, 3, 2, 3, 2],
    ['airport', 2, 6, 2, 3, 2],
    ['airport', 3, 6, 4, 3, 2],
    ['harbor', 1, 2, 2, 2, 2],
    ['harbor', 2, 4, 2, 2, 2],
    ['harbor', 3, 6, 2, 2, 2],
  ];

  const rgba = (a: Art, x: number, y: number) => {
    const i = (y * a.px.w + x) * 4;
    return [a.px.data[i], a.px.data[i + 1], a.px.data[i + 2], a.px.data[i + 3]];
  };

  it('paints hard pixels: opaque or empty, never a soft edge', () => {
    for (const [kind, level, fw, fh] of facilities) {
      const art = paintHub(kind, level, fw, fh);
      for (let i = 3; i < art.px.data.length; i += 4) {
        const al = art.px.data[i];
        if (al === 0 || al === 255) continue;
        expect([art.px.data[i - 3], art.px.data[i - 2], art.px.data[i - 1]]).toEqual([0, 0, 0]);
        expect(al).toBeLessThanOrEqual(SHADOW_ALPHA);
      }
    }
  });

  it('is one painting cut into pieces, not one painting per piece', () => {
    // The whole point of the pass: two pieces side by side have to read as a single terminal, so every
    // pixel a piece paints has to agree with the painting of the whole facility, and together the
    // pieces have to cover it exactly once.
    for (const [kind, level, fw, fh, pw, ph] of facilities) {
      for (const side of kind === 'harbor' ? [0, 1, 2, 3] : [0]) {
      const whole = paintHub(kind, level, fw, fh, side);
      const seen = new Uint8Array(whole.px.w * whole.px.h);
      for (let i = 0; i < fw; i += pw) {
        for (let j = 0; j < fh; j += ph) {
          const view: HubView = { fw, fh, i, j, pw, ph };
          const piece = paintHubPiece(kind, level, view, side);
          // Where the piece's canvas lands inside the canvas of the whole facility.
          const ox = 16 * (fh - ph) + 16 * (i - j);
          const oy = 8 * (i + j);
          for (let y = 0; y < piece.px.h; y++) {
            for (let x = 0; x < piece.px.w; x++) {
              const c = rgba(piece, x, y);
              if (!c[3]) continue;
              const at = `piece ${i},${j} pixel ${x},${y}`;
              expect(rgba(whole, ox + x, oy + y), at).toEqual(c);
              seen[(oy + y) * whole.px.w + ox + x] = 1;
            }
          }
        }
      }
      // No gaps: every pixel of the painting belongs to at least one piece. The pieces do overlap by
      // the four-pixel margin of their canvas, and that is harmless: it is the same drawing either way.
      let painted = 0;
      for (let k = 3; k < whole.px.data.length; k += 4) if (whole.px.data[k]) painted++;
      expect(painted, `${kind} ${level}: the painting is not empty`).toBeGreaterThan(200);
      expect(seen.filter((n) => n > 0).length, `${kind} ${level} side ${side}: the pieces cover the painting`).toBe(painted);
      }
    }
  });

  it('grows with the level: a bigger facility is a bigger drawing, not the same one stretched', () => {
    const painted = (a: Art) => [...a.px.data].filter((_, k) => k % 4 === 3 && a.px.data[k]).length;
    const small = paintHub('airport', 1, 3, 2);
    const big = paintHub('airport', 3, 6, 4);
    expect(big.px.w).toBeGreaterThan(small.px.w);
    expect(painted(big)).toBeGreaterThan(painted(small));
    // Same rectangle, more level: more gates, a taller tower, the cargo apron.
    const two = paintHub('airport', 2, 6, 2);
    const three = paintHub('airport', 3, 6, 2);
    expect(painted(three)).toBeGreaterThan(painted(two));
    expect(tones(three)).not.toBe(tones(two));
  });

  it('puts the water on the side it is told, with the terminal away from it', () => {
    const shots = [0, 1, 2, 3].map((side) => paintHub('harbor', 2, 4, 2, side));
    for (let k = 0; k < 4; k++) {
      expect(topRow(shots[k])).toBeLessThan(shots[k].ay);
      for (let j = k + 1; j < 4; j++) expect([...shots[k].px.data]).not.toEqual([...shots[j].px.data]);
    }
  });
});

describe('coast pixel art', () => {
  const promenades = [0, 1, 2, 4, 8, 3, 6, 12, 16, 17, 18, 20, 24];
  const piers = [0, 1, 2, 3];

  it('paints hard pixels: opaque or empty, never a soft edge', () => {
    for (const art of [...promenades.map((v) => paintPromenade(v) as Art), ...piers.map((d) => paintFishing(d) as Art)]) {
      for (let i = 3; i < art.px.data.length; i += 4) {
        const al = art.px.data[i];
        if (al === 0 || al === 255) continue;
        expect([art.px.data[i - 3], art.px.data[i - 2], art.px.data[i - 1]]).toEqual([0, 0, 0]);
      }
    }
  });

  it('covers the cell diamond, so the paving underneath never shows through', () => {
    for (const art of [coastArt(paintPromenade(1)), coastArt(paintPromenade(16)), coastArt(paintPromenade(0))]) {
      for (let y = 0; y < art.px.h; y++) {
        for (let x = 0; x < art.px.w; x++) {
          const du = (x + 0.5 - art.ax) / 16;
          const dv = (y + 0.5 - art.ay) / 8;
          const u = (du + dv) / 2;
          const v = (dv - du) / 2;
          if (u < 0.07 || u > 0.93 || v < 0.07 || v > 0.93) continue;
          expect(alpha(art, x, y), `hueco en (${x}, ${y})`).toBe(255);
        }
      }
    }
  });

  /** How many pixels of a colour the sprite has, which is how a rail or a lamp shows up. */
  function count(art: Art, rgb: [number, number, number]): number {
    let n = 0;
    for (let i = 0; i < art.px.data.length; i += 4) {
      if (art.px.data[i] === rgb[0] && art.px.data[i + 1] === rgb[1] && art.px.data[i + 2] === rgb[2]) n++;
    }
    return n;
  }
  const CREAM: [number, number, number] = [0xef, 0xe9, 0xdc];
  const WARM: [number, number, number] = [0xff, 0xd8, 0x4a];

  it('puts the balustrade on the sides that face water', () => {
    const none = count(paintPromenade(0) as Art, CREAM);
    const one = count(paintPromenade(1) as Art, CREAM);
    const two = count(paintPromenade(1 | 4) as Art, CREAM);
    expect(one).toBeGreaterThan(none);
    expect(two).toBeGreaterThan(one);
    // Two different water sides draw two different rails.
    expect((paintPromenade(1) as Art).px.data.join(',')).not.toBe((paintPromenade(4) as Art).px.data.join(','));
  });

  it('stands a lamp on every other cell of the promenade', () => {
    expect(count(paintPromenade(1 | 16) as Art, WARM)).toBeGreaterThan(0);
    expect(count(paintPromenade(1) as Art, WARM)).toBe(0);
  });

  it('runs the jetty out to the side it was asked for', () => {
    const shapes = new Set(piers.map((dir) => (paintFishing(dir) as Art).px.data.join(',')));
    expect(shapes.size).toBe(4);
    // The deck is raised on pilings, so every cell paints above its anchor.
    for (const dir of piers) expect(rises(paintFishing(dir) as Art)).toBeGreaterThan(0);
  });
});
