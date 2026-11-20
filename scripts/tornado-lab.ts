/**
 * `tornado-lab.html`: el embudo del tornado solo, en poses y anchos, para juzgarlo sin la ciudad encima.
 * Nada de esto es parte del juego.
 */
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';

declare const process: { cwd(): string };

const POSES = [
  { t: 0, w: 1 },
  { t: 900, w: 1 },
  { t: 1800, w: 3 },
  { t: 2700, w: 3 },
  { t: 3600, w: 6 },
  { t: 4500, w: 6 },
];

const cells = POSES.map((p) => `<canvas data-t="${p.t}" data-w="${p.w}"></canvas>`).join('\n');

const entry = `
import { SEA_LEVEL } from './src/world/terrain';
import { World } from './src/world/world';
import { MapRenderer } from './src/render/mapRenderer';
import { drawTornado } from './src/render/tornadoArt';

const N = 20;
const world = new World({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(N * N) });
const map = new MapRenderer(world);
const K = 5;
const CW = 190;
const CH = 190;
const centreX = map.originX;
const centreY = map.originY + N * 8;

for (const el of document.querySelectorAll('canvas')) {
  const time = Number(el.dataset.t);
  const width = Number(el.dataset.w);
  el.width = CW * K;
  el.height = CH * K;
  const g = el.getContext('2d');
  // El pasto del mapa, con una calle cruzando: el fondo real contra el que se lo mira.
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#749b4e';
  g.fillRect(0, 0, el.width, el.height);
  g.setTransform(K, 0, 0, K, 0, 0);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = i % 2 ? '#6d9249' : '#7ba153';
    g.fillRect((i * 37) % CW, (i * 61) % CH, 6, 3);
  }
  // setTransform toma la traslacion en pixeles del canvas, no en unidades de usuario: va en dos pasos.
  g.setTransform(K, 0, 0, K, 0, 0);
  g.translate(CW / 2 - 360, CH * 0.68 - (448 - centreY + centreY));
  try {
    const at = drawTornado(g, { horizontal: false, fixed: 10, dir: 1, step: 9, off: 0, width }, world, map, time);
    document.title = 'base=' + JSON.stringify(at) + ' o=' + map.originX + ',' + map.originY;
  } catch (e) {
    document.title = 'ERR ' + (e && e.message);
  }
}
`;

const bundled = await build({
  stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true,
  minify: true,
  format: 'iife',
  write: false,
  logLevel: 'warning',
});

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>tornado lab</title>
<style>
  body { margin: 0; background: #101318; display: grid; grid-template-columns: repeat(3, 400px); gap: 8px; padding: 8px; }
  canvas { width: 400px; height: 400px; image-rendering: pixelated; border-radius: 6px; }
</style></head>
<body>
${cells}
<script>${bundled.outputFiles[0].text}</script>
</body></html>`;

writeFileSync('tornado-lab.html', html);
