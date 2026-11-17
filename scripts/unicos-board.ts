/**
 * Assembles `edificios-unicos.html`: one page with the five unique buildings drawn on a board, to
 * look at the art and the numbers together without starting a game.
 *
 * Run with `npm run board`, from the project root (the sprite imports resolve against it). The
 * page carries its own copy of the sprite code, so it opens by double click, with no server; run
 * the script again after touching `src/render/sprites.ts`.
 */
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';

// The project has no @types/node on purpose, so the one Node global this script needs is declared
// here: the bundle's imports resolve against the project root.
declare const process: { cwd(): string };

/** Paints one sprite into its card, on a grass gradient, as large as the card allows. */
const entry = `
import { uniqueSprite } from './src/render/sprites';
import { UNIQUES } from './src/config';

const W = 620;
const H = 560;

for (const el of Array.from(document.querySelectorAll('canvas[data-kind]'))) {
  const kind = el.dataset.kind;
  const { w, h } = UNIQUES[kind];
  const s = uniqueSprite(kind, w, h);
  el.width = W;
  el.height = H;
  const g = el.getContext('2d');
  const sky = g.createRadialGradient(W / 2, H * 0.42, 60, W / 2, H * 0.55, W * 0.72);
  sky.addColorStop(0, '#8cb96b');
  sky.addColorStop(0.65, '#6f9a52');
  sky.addColorStop(1, '#4f7440');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  const padX = 36;
  const padBottom = 26;
  const k = Math.min((W - padX * 2) / s.canvas.width, (H - padBottom - 16) / s.canvas.height, 3.2);
  const dw = s.canvas.width * k;
  const dh = s.canvas.height * k;
  g.imageSmoothingEnabled = false;
  g.drawImage(s.canvas, (W - dw) / 2, H - padBottom - dh, dw, dh);
  // The size, the price and the upkeep come from the config, so the board cannot drift from the game.
  const size = el.closest('figure') && el.closest('figure').querySelector('.size');
  if (size) {
    const money = (n) => '$' + Math.round(n).toLocaleString('es-AR');
    size.textContent =
      w + 'x' + h + ' - ' + money(UNIQUES[kind].cost) + ' - ' + money(UNIQUES[kind].upkeep) + '/mes';
  }
}
`;

const page = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>ARGENCITY 3000 - Edificios unicos</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 18px 20px 26px;
        background: #14181c;
        color: #e9e6df;
        font-family: ui-sans-serif, system-ui, sans-serif;
      }
      h1 { font-size: 19px; margin: 0 0 2px; letter-spacing: 0.02em; }
      p.sub { margin: 0 0 18px; color: #9aa2a8; font-size: 12.5px; max-width: 62ch; }
      .grid { display: grid; gap: 8px 10px; grid-template-columns: repeat(6, 1fr); }
      .grid > figure { grid-column: span 2; min-width: 0; }
      .grid > figure.wide { grid-column: span 3; }
      @media (max-width: 760px) {
        .grid { grid-template-columns: repeat(2, 1fr); }
        .grid > figure { grid-column: span 1; }
        .grid > figure.wide { grid-column: span 2; }
      }
      figure { margin: 0; padding: 8px 8px 10px; border-radius: 10px; background: #1b2026; overflow: hidden; }
      canvas { display: block; width: 100%; height: auto; image-rendering: auto; }
      figcaption { margin-top: 6px; }
      .name { font-size: 13.5px; font-weight: 700; }
      .meta { font-size: 11.5px; color: #8e979e; margin-top: 3px; line-height: 1.45; }
      .tour { color: #d8b24a; }
      .pending { grid-column: span 6; margin-top: 6px; color: #8e979e; font-size: 12px; line-height: 1.6; }
      .pending b { color: #c9cdd1; }
    </style>
  </head>
  <body>
    <h1>Edificios unicos</h1>
    <p class="sub">
      Uno por ciudad. Los cinco primeros los puede construir cualquier gobierno y multiplican el
      turismo que ya entra; los cinco de abajo son uno por gobierno y pagan en su propia medida.
    </p>
    <div class="grid">
      <figure>
        <canvas data-kind="obelisco"></canvas>
        <figcaption>
          <div class="name">Obelisco</div>
          <div class="meta"><span class="size"></span><br />En una plaza de 8 lotes o mas<br /><span class="tour">Turismo +6 %, +8 % en diciembre y enero</span></div>
        </figcaption>
      </figure>
      <figure>
        <canvas data-kind="teatro"></canvas>
        <figcaption>
          <div class="name">Teatro</div>
          <div class="meta"><span class="size"></span><br />Valor del suelo 45 o mas alrededor<br /><span class="tour">Turismo +5 %, +10 % de abril a agosto</span></div>
        </figcaption>
      </figure>
      <figure>
        <canvas data-kind="estadio"></canvas>
        <figcaption>
          <div class="name">Estadio</div>
          <div class="meta"><span class="size"></span><br />Sobre un bulevar, a 6 lotes o menos<br /><span class="tour">Turismo +8 %, +12 % de marzo a noviembre</span></div>
        </figcaption>
      </figure>
      <figure class="wide">
        <canvas data-kind="calvario"></canvas>
        <figcaption>
          <div class="name">El Calvario</div>
          <div class="meta"><span class="size"></span><br />En una loma de altura 10 o mas<br /><span class="tour">Turismo +2 %, +18 % en septiembre</span></div>
        </figcaption>
      </figure>
      <figure class="wide">
        <canvas data-kind="puente"></canvas>
        <figcaption>
          <div class="name">Puente Transbordador</div>
          <div class="meta"><span class="size"></span><br />Sobre el agua, con una punta en tierra<br /><span class="tour">Turismo +5 %, todo el ano</span></div>
        </figcaption>
      </figure>
      <h2>Los de gobierno</h2>
      <p class="sub">
        Uno por forma de gobierno: la ciudad fundada como democracia puede construir el Cabildo y no el
        Regimiento. Cada uno paga en una medida distinta, no en turismo.
      </p>
      <figure>
        <canvas data-kind="cabildo"></canvas>
        <figcaption>
          <div class="name">El Cabildo</div>
          <div class="meta"><span class="size"></span><br />Democracia - plaza enfrente, 6 lotes a 3 o menos<br /><span class="tour">Aprobacion +2 por mes, +4 en septiembre (la eleccion)</span></div>
        </figcaption>
      </figure>
      <figure class="wide">
        <canvas data-kind="regimiento"></canvas>
        <figcaption>
          <div class="name">El Regimiento</div>
          <div class="meta"><span class="size"></span><br />Dictadura - descampado, 12 lotes libres a 4 o menos<br /><span class="tour">Baja el delito a 7 lotes o menos</span></div>
        </figcaption>
      </figure>
      <figure>
        <canvas data-kind="planetario"></canvas>
        <figcaption>
          <div class="name">El Planetario</div>
          <div class="meta"><span class="size"></span><br />Tecnocracia - universidad a 8 lotes o menos<br /><span class="tour">Educacion 70 a 9 lotes o menos (capa Edu)</span></div>
        </figcaption>
      </figure>
      <figure class="wide">
        <canvas data-kind="santuario"></canvas>
        <figcaption>
          <div class="name">El Santuario</div>
          <div class="meta"><span class="size"></span><br />Teocracia - agua a 4 lotes o menos<br /><span class="tour">Favor +2 por mes, +4 en abril (la peregrinacion)</span></div>
        </figcaption>
      </figure>
      <figure>
        <canvas data-kind="sindicato"></canvas>
        <figcaption>
          <div class="name">El Sindicato</div>
          <div class="meta"><span class="size"></span><br />Comunismo - 10 lotes industriales a 4 o menos<br /><span class="tour">Turismo segun los puestos industriales, hasta +16 %</span></div>
        </figcaption>
      </figure>
    </div>
    <script>/*BUNDLE*/</script>
  </body>
</html>
`;

const bundled = await build({
  stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true,
  minify: true,
  format: 'iife',
  write: false,
  logLevel: 'warning',
});

const js = bundled.outputFiles[0].text;
writeFileSync('edificios-unicos.html', page.replace('/*BUNDLE*/', js));
console.log(`edificios-unicos.html escrito (${Math.round(js.length / 1024)} kB de sprites)`);
