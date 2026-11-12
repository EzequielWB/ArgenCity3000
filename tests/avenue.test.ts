import { describe, expect, it } from 'vitest';
import { KIND, MAX_BAND, analyzeRoads, indexOf, kindOf, laneLine, widthOf } from '../src/render/avenue';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { TILE, World } from '../src/world/world';
import { applyPlan, dragCells, planTool } from '../src/world/tools';

/** Builds a picture from rows of text: '#' is a road cell, anything else is not. */
function picture(rows: string[], n = Math.max(rows.length, ...rows.map((r) => r.length))) {
  const road = new Uint8Array(n * n);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') road[y * n + x] = 1;
  });
  const codes = analyzeRoads((x, y) => x >= 0 && y >= 0 && x < n && y < n && road[y * n + x] === 1, n);
  return {
    n,
    kind: (x: number, y: number) => kindOf(codes[y * n + x]),
    width: (x: number, y: number) => widthOf(codes[y * n + x]),
    index: (x: number, y: number) => indexOf(codes[y * n + x]),
    code: (x: number, y: number) => codes[y * n + x],
  };
}

function flat(n: number, waterFromX = n): Terrain {
  const s = n + 1;
  const corners = new Uint8Array(s * s);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) corners[y * s + x] = x >= waterFromX ? SEA_LEVEL - 1 : SEA_LEVEL + 1;
  return { n, corners, trees: new Uint8Array(n * n) };
}

describe('single streets keep their ordinary look', () => {
  it('marks every cell of 1-wide streets, crossings, dead ends and corners as plain', () => {
    const rows = [
      '..#.......',
      '..#.......',
      '######....',
      '..#..#....',
      '..#..#....',
      '.....#####',
    ];
    const p = picture(rows);
    for (let y = 0; y < p.n; y++) {
      for (let x = 0; x < p.n; x++) {
        expect(p.kind(x, y), `(${x},${y})`).toBe(rows[y]?.[x] === '#' ? KIND.PLAIN : KIND.NONE);
      }
    }
  });

  it('treats a street next to nothing as having no band info', () => {
    const p = picture(['#']);
    expect(p.kind(0, 0)).toBe(KIND.PLAIN);
    expect(p.width(0, 0)).toBe(0);
    expect(p.index(0, 0)).toBe(0);
  });
});

describe('bands of contiguous streets', () => {
  it('numbers the lanes of 2-, 3- and 4-wide bands along x', () => {
    for (const width of [2, 3, 4]) {
      const rows = ['........', ...Array.from({ length: width }, () => '.######.'), '........'];
      const p = picture(rows);
      for (let k = 0; k < width; k++) {
        for (let x = 1; x <= 6; x++) {
          expect(p.kind(x, 1 + k), `w${width} (${x},${1 + k})`).toBe(KIND.BAND_X);
          expect(p.width(x, 1 + k)).toBe(width);
          expect(p.index(x, 1 + k)).toBe(k);
        }
      }
    }
  });

  it('numbers the lanes of 2-, 3- and 4-wide bands along y', () => {
    for (const width of [2, 3, 4]) {
      const row = '.' + '#'.repeat(width) + '.';
      const p = picture(Array.from({ length: 8 }, (_, y) => (y === 0 || y === 7 ? '.'.repeat(width + 2) : row)));
      for (let k = 0; k < width; k++) {
        for (let y = 1; y <= 6; y++) {
          expect(p.kind(1 + k, y), `w${width} (${1 + k},${y})`).toBe(KIND.BAND_Y);
          expect(p.width(1 + k, y)).toBe(width);
          expect(p.index(1 + k, y)).toBe(k);
        }
      }
    }
  });

  it('keeps counting lanes up to the maximum and calls anything wider a blob', () => {
    const rowsOf = (w: number) => Array.from({ length: w }, () => '#'.repeat(w + 8));
    const ok = picture(rowsOf(MAX_BAND), MAX_BAND + 8);
    expect(ok.kind(10, 3)).toBe(KIND.BAND_X);
    expect(ok.width(10, 3)).toBe(MAX_BAND);
    const wide = picture(rowsOf(MAX_BAND + 1), MAX_BAND + 9);
    expect(wide.kind(10, 3)).toBe(KIND.BLOB);
  });

  it('a band that touches the edge of the map is still a band', () => {
    const p = picture(['######', '######', '......']);
    expect(p.kind(0, 0)).toBe(KIND.BAND_X);
    expect(p.index(0, 0)).toBe(0);
    expect(p.index(5, 1)).toBe(1);
    expect(p.width(3, 1)).toBe(2);
  });

  it('keeps the band through its dead end', () => {
    const p = picture(['........', '.####...', '.####...', '........']);
    for (const x of [1, 4]) {
      expect(p.kind(x, 1)).toBe(KIND.BAND_X);
      expect(p.kind(x, 2)).toBe(KIND.BAND_X);
    }
  });
});

describe('junctions and blobs', () => {
  it('draws a solid 3x3 block of road as a blob with no lanes', () => {
    const p = picture(['.....', '.###.', '.###.', '.###.', '.....']);
    for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++) expect(p.kind(x, y)).toBe(KIND.BLOB);
  });

  it('draws a 2x2 block as a blob', () => {
    const p = picture(['....', '.##.', '.##.', '....']);
    for (let y = 1; y <= 2; y++) for (let x = 1; x <= 2; x++) expect(p.kind(x, y)).toBe(KIND.BLOB);
  });

  it('opens a junction where a street leaves an avenue (T)', () => {
    const p = picture([
      '..............',
      '#############.',
      '#############.',
      '......#.......',
      '......#.......',
      '......#.......',
    ]);
    // The spur is an ordinary street.
    expect(p.kind(6, 3)).toBe(KIND.PLAIN);
    expect(p.kind(6, 5)).toBe(KIND.PLAIN);
    // The cells where it joins, and their neighbours along the avenue, carry no lane lines.
    for (const x of [5, 6, 7]) expect(p.kind(x, 1)).toBe(KIND.BLOB);
    for (const x of [5, 6, 7]) expect(p.kind(x, 2)).toBe(KIND.BLOB);
    // Away from it the avenue is intact.
    for (const x of [0, 1, 2, 3, 9, 10, 12]) {
      expect(p.kind(x, 1), `x=${x}`).toBe(KIND.BAND_X);
      expect(p.kind(x, 2)).toBe(KIND.BAND_X);
    }
  });

  it('opens a junction where a street crosses an avenue', () => {
    const p = picture([
      '......#.......',
      '......#.......',
      '#############.',
      '#############.',
      '......#.......',
      '......#.......',
    ]);
    for (const y of [2, 3]) {
      expect(p.kind(6, y)).toBe(KIND.BLOB);
      expect(p.kind(0, y)).toBe(KIND.BAND_X);
      expect(p.kind(12, y)).toBe(KIND.BAND_X);
    }
    for (const y of [0, 1, 4, 5]) expect(p.kind(6, y)).toBe(KIND.PLAIN);
  });

  it('crosses two avenues without lane lines at the crossing', () => {
    const n = 20;
    const rows = Array.from({ length: n }, (_, y) => (y === 9 || y === 10 ? '#'.repeat(n) : '.'.repeat(9) + '##' + '.'.repeat(9)));
    const p = picture(rows, n);
    for (const y of [9, 10]) for (const x of [9, 10]) expect(p.kind(x, y)).toBe(KIND.BLOB);
    expect(p.kind(3, 9)).toBe(KIND.BAND_X);
    expect(p.kind(9, 3)).toBe(KIND.BAND_Y);
    expect(p.index(10, 3)).toBe(1);
  });

  it('does not mistake an L-shaped avenue corner for a wide band', () => {
    const rows = ['##########', '##########', '##........', '##........', '##........', '##........'];
    const p = picture(rows);
    expect(p.kind(0, 0)).toBe(KIND.BLOB);
    expect(p.kind(1, 1)).toBe(KIND.BLOB);
    expect(p.kind(6, 0)).toBe(KIND.BAND_X);
    expect(p.kind(0, 5)).toBe(KIND.BAND_Y);
  });
});

describe('with a real world', () => {
  function build(w: World, ax: number, ay: number, bx: number, by: number) {
    applyPlan(w, planTool(w, 'road', dragCells('road', ax, ay, bx, by, 1, w.n)));
  }
  const roads = (w: World) => (x: number, y: number) => w.inBounds(x, y) && w.tileAt(x, y) === TILE.ROAD;

  it('turns streets built side by side into an avenue, and back when one is removed', () => {
    const w = new World(flat(16));
    build(w, 2, 5, 12, 5);
    expect(kindOf(analyzeRoads(roads(w), w.n)[w.idx(6, 5)])).toBe(KIND.PLAIN);
    build(w, 2, 6, 12, 6);
    build(w, 2, 7, 12, 7);
    const codes = analyzeRoads(roads(w), w.n);
    for (let k = 0; k < 3; k++) {
      const c = codes[w.idx(6, 5 + k)];
      expect([kindOf(c), widthOf(c), indexOf(c)]).toEqual([KIND.BAND_X, 3, k]);
    }
    applyPlan(w, planTool(w, 'bulldoze', dragCells('bulldoze', 2, 7, 12, 7, 1, w.n)));
    const after = analyzeRoads(roads(w), w.n);
    expect(widthOf(after[w.idx(6, 5)])).toBe(2);
  });

  it('treats a 2-wide bridge over water like any other avenue', () => {
    const w = new World(flat(16, 8));
    build(w, 3, 4, 13, 4);
    build(w, 3, 5, 13, 5);
    expect(w.isWater(10, 4)).toBe(true);
    expect(w.tileAt(10, 4)).toBe(TILE.ROAD);
    const codes = analyzeRoads(roads(w), w.n);
    for (const x of [4, 7, 10, 12]) {
      for (const y of [4, 5]) {
        const c = codes[w.idx(x, y)];
        expect([kindOf(c), widthOf(c), indexOf(c)]).toEqual([KIND.BAND_X, 2, y - 4]);
      }
    }
  });

  it('is deterministic and does not depend on call order', () => {
    const w = new World(flat(16));
    build(w, 2, 5, 12, 5);
    build(w, 2, 6, 12, 6);
    const a = analyzeRoads(roads(w), w.n);
    const b = analyzeRoads(roads(w), w.n);
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

describe('lane lines', () => {
  it('puts a double centre line in the middle of an even band', () => {
    expect(laneLine(2, 0)).toBe('double');
    expect([0, 1, 2].map((j) => laneLine(4, j))).toEqual(['dash', 'double', 'dash']);
    expect([0, 1, 2, 3, 4].map((j) => laneLine(6, j))).toEqual(['dash', 'dash', 'double', 'dash', 'dash']);
  });

  it('flanks the middle lane of an odd band with solid lines', () => {
    expect([0, 1].map((j) => laneLine(3, j))).toEqual(['solid', 'solid']);
    expect([0, 1, 2, 3].map((j) => laneLine(5, j))).toEqual(['dash', 'solid', 'solid', 'dash']);
  });
});
