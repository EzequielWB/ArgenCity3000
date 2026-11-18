import { describe, expect, it } from 'vitest';
import { paintFishing, paintLighthouseCell, paintPortCell, paintPromenade, paintResortCell } from '../src/render/pixelArt';

/**
 * The three buildings of the coast that were the last ones in canvas: the cargo port, the beach resort
 * and the lighthouse. Each one is a single lot that leans on the water, so the four low bits of its
 * variant are the sides of the cell that face the river.
 */

interface Art {
  px: { w: number; h: number; data: Uint8ClampedArray };
  ax: number;
  ay: number;
}

const SHADOW_ALPHA = 96;

const PORTS = [0, 1, 2, 4, 8, 5, 10, 3, 12];

const alpha = (a: Art, x: number, y: number) => a.px.data[(y * a.px.w + x) * 4 + 3];

/** Topmost row that has any paint, or the height of the canvas when it is empty. */
function topRow(a: Art): number {
  for (let y = 0; y < a.px.h; y++) for (let x = 0; x < a.px.w; x++) if (alpha(a, x, y)) return y;
  return a.px.h;
}

/** Pixels the building rises above its anchor, so two drawings compare as taller or shorter. */
const rises = (a: Art) => a.ay - topRow(a);

function countOpaque(a: Art): number {
  let n = 0;
  for (let i = 3; i < a.px.data.length; i += 4) if (a.px.data[i]) n++;
  return n;
}

/** The drawing, as a string, to tell two variants apart by what they paint. */
const drawing = (a: Art) => Array.from(a.px.data).join(',');

/** How many pixels the drawing has that satisfy a test on their colour. */
function countish(a: Art, ok: (r: number, g: number, b: number) => boolean, maxY = Infinity): number {
  let n = 0;
  for (let i = 0; i < a.px.data.length; i += 4) {
    if (!a.px.data[i + 3]) continue;
    if (Math.floor(i / 4 / a.px.w) >= maxY) continue;
    if (ok(a.px.data[i], a.px.data[i + 1], a.px.data[i + 2])) n++;
  }
  return n;
}

/** Yellow, the colour of the cranes and the awnings of the game. */
const yellow = (r: number, g: number, b: number) => r > 190 && g > 140 && b < 120;
/** The sand of the beach: warm, light, more red than blue. */
const sandish = (r: number, g: number, b: number) => r > 180 && g > 130 && b < 170 && r - b > 40;

const ART: [string, (mask: number) => Art][] = [
  ['puerto', paintPortCell],
  ['balneario', paintResortCell],
  ['faro', paintLighthouseCell],
];

for (const [name, paint] of ART) {
  describe(`el ${name} en píxel`, () => {
    it('pinta píxeles duros: opaco, vacío o la sombra negra', () => {
      for (const mask of PORTS) {
        const a = paint(mask);
        for (let i = 3; i < a.px.data.length; i += 4) {
          const al = a.px.data[i];
          if (al === 0 || al === 255) continue;
          const at = `${name} agua ${mask}, pixel ${(i - 3) / 4}`;
          expect(al, at).toBeLessThanOrEqual(SHADOW_ALPHA);
          expect([a.px.data[i - 3], a.px.data[i - 2], a.px.data[i - 1]], at).toEqual([0, 0, 0]);
        }
      }
    });

    it('mira al agua: cada lado mojado cambia el dibujo', () => {
      // The four sides alone have to give four different drawings, or the mask is not being used.
      const sides = [1, 2, 4, 8].map((mask) => drawing(paint(mask)));
      expect(new Set(sides).size).toBe(4);
      // And a lot with no water at all is not the same as one with water on its front-left edge.
      expect(drawing(paint(0))).not.toBe(drawing(paint(4)));
    });

    it('usa el lote entero y deja aire arriba', () => {
      const a = paint(1);
      // The sprite is a cell: the drawing has to use it and still be anchored inside the canvas.
      expect(countOpaque(a)).toBeGreaterThan(200);
      expect(a.ay).toBeGreaterThan(rises(a));
      expect(alpha(a, Math.round(a.ax), 0)).toBe(0);
    });
  });
}

/** The first row of the canvas that has any paint in it. */
function firstRow(a: Art): number {
  for (let y = 0; y < a.px.h; y++) {
    for (let x = 0; x < a.px.w; x++) if (a.px.data[(y * a.px.w + x) * 4 + 3]) return y;
  }
  return -1;
}

describe('lo que dice cada uno de un vistazo', () => {
  it('el puerto es la grúa amarilla sobre los contenedores', () => {
    const port = paintPortCell(1);
    // The crane of the game is the same yellow the harbour pieces use, and it is the highest thing: the
    // first row with paint in it is the beam, so the yellow is at the top and not only around the yard.
    expect(countish(port, yellow)).toBeGreaterThan(18);
    // The crane is the highest thing on the lot: the first four rows with paint in them are its beam.
    expect(countish(port, yellow, firstRow(port) + 4)).toBeGreaterThan(3);
    // The containers are the colours of the companies, so the yard is not one flat mass. Three of the
    // four colours carry the front row; the fourth company is stacked behind and only peeks over, so it
    // counts for less — that is the drawing, and the test says so instead of asking for four equal parts.
    expect(countish(port, (r, g, b) => r > 150 && g < 110 && b < 100)).toBeGreaterThan(14); // rojo
    expect(countish(port, (r, _g, b) => b > 120 && b > r + 30)).toBeGreaterThan(10); // azul
    expect(countish(port, (r, g) => g > 110 && g > r + 30)).toBeGreaterThan(3); // verde
    // And the seams between the boxes: a stack of one colour without them reads as a single pillar.
    expect(countish(port, (r, g, b) => r < 60 && g < 60 && b < 60)).toBeGreaterThan(30);
  });

  it('el balneario tiene arena, toldo a rayas y sombrillas', () => {
    const beach = paintResortCell(1);
    // The sand covers the lot: it is the colour that repeats the most in the drawing.
    expect(countish(beach, sandish)).toBeGreaterThan(120);
    // The awning and the parasols: the red of the cloth and the white of the stripes next to it.
    expect(countish(beach, (r, g, b) => r > 170 && g < 110 && b < 100)).toBeGreaterThan(10);
    expect(countish(beach, (r, g, b) => r > 225 && g > 225 && b > 215)).toBeGreaterThan(25);
  });

  it('el faro es lo más alto de la costa, y sus franjas se ven', () => {
    const lighthouse = paintLighthouseCell(1);
    const beach = paintResortCell(1);
    const port = paintPortCell(1);
    expect(rises(lighthouse)).toBeGreaterThan(2 * rises(beach));
    expect(rises(lighthouse)).toBeGreaterThan(rises(port));
    // The tower alone is five bands of red and cream, drawn row by row.
    expect(countish(lighthouse, (r, g, b) => r > 150 && g < 100 && b < 90)).toBeGreaterThan(120); // rojo
    expect(countish(lighthouse, (r, g, b) => r > 225 && g > 225 && b > 210)).toBeGreaterThan(120); // crema
    // And the light is on: the lantern and its beams are the only warm yellow up there.
    expect(countish(lighthouse, (r, g, b) => r > 240 && g > 200 && b < 190)).toBeGreaterThan(20);
  });
});

describe('las piezas que ya estaban', () => {
  it('la rambla y el muelle siguen siendo otra cosa que el puerto', () => {
    const promenade = paintPromenade(1);
    const pier = paintFishing(1);
    const port = paintPortCell(1);
    expect(drawing(promenade)).not.toBe(drawing(port));
    expect(drawing(pier)).not.toBe(drawing(port));
    // The pier is short and flat next to the lighthouse: the coast is not all the same height.
    expect(rises(pier)).toBeLessThan(rises(paintLighthouseCell(1)) / 3);
  });
});
