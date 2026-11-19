/**
 * Assembles `arte.html`: every family of the pixel art, level by level, on the board the game draws
 * with, plus a city block drawn by the renderer itself.
 *
 * Run with `npm run arte`, from the project root. The page carries its own copy of the sprite code,
 * so it opens by double click, with no server; run the script again after touching
 * `src/render/pixelArt.ts`. Nothing here is part of the game.
 */
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';

// The project has no @types/node on purpose, so the one Node global this script needs is declared
// here: the bundle's imports resolve against the project root.
declare const process: { cwd(): string };

const entry = `
import './scripts/board-city';
import { residentialPixelSprite, commercialPixelSprite, industrialPixelSprite, lotPixelSprite, lotSize, paintPlaza, coastPixelSprite, busDepotPixelSprite, plantPixelSprite, paintHub, polePixelSprite, servicePixelSprite, treePixelSprite } from './src/render/pixelArt';
import { boatPixelSprite, carPixelSprite, planePixelSprite } from './src/render/vehicleArt';
import type { CoastKind, HubKind, ServiceKind } from './src/config';

const NEW = { R: residentialPixelSprite, C: commercialPixelSprite, I: industrialPixelSprite };
const K = 3;
const W = 220;
const H = 420;
const GROUND = 360;

/** The lot: one cell of grass, a 32 x 16 diamond with its top corner on the sprite anchor. */
function lot(g, cx, ground, k) {
  g.beginPath();
  g.moveTo(cx, ground);
  g.lineTo(cx + 16 * k, ground + 8 * k);
  g.lineTo(cx, ground + 16 * k);
  g.lineTo(cx - 16 * k, ground + 8 * k);
  g.closePath();
  g.fillStyle = '#749b4e';
  g.fill();
  g.strokeStyle = '#5e8340';
  g.lineWidth = 1;
  g.stroke();
}

/** The ground of a lot n cells a side: a 32n x 16n diamond. */
function lotBig(g, cx, ground, k, n) {
  g.beginPath();
  g.moveTo(cx, ground);
  g.lineTo(cx + 16 * n * k, ground + 8 * n * k);
  g.lineTo(cx, ground + 16 * n * k);
  g.lineTo(cx - 16 * n * k, ground + 8 * n * k);
  g.closePath();
  g.fillStyle = '#749b4e';
  g.fill();
  g.strokeStyle = '#5e8340';
  g.lineWidth = 1;
  g.stroke();
}

/** Draws a sprite so its anchor lands on (cx, ground). */
function place(g, s, cx, ground, k) {
  g.imageSmoothingEnabled = false;
  g.drawImage(s.canvas, Math.round(cx - s.ax * k), Math.round(ground - s.ay * k), s.canvas.width * k, s.canvas.height * k);
}

/** A plaza tile as a sprite, so the board places it with the same anchor the game uses. */
function plazaSprite(variant, look, mask) {
  const p = paintPlaza(variant, look, mask);
  return { canvas: p.px.toCanvas(1), ax: p.ax, ay: p.ay };
}

/** The mask of a cell of a block: which of its four edges touch another plaza of the same block. */
function blockMask(i, j, n) {
  let mask = 0;
  if (j > 0) mask |= 1;
  if (i < n - 1) mask |= 2;
  if (j < n - 1) mask |= 4;
  if (i > 0) mask |= 8;
  return mask;
}

for (const el of Array.from(document.querySelectorAll('canvas[data-plazablock]'))) {
  const n = 3;
  const k = 2;
  const look = el.dataset.plazablock === 'dry' ? 'neglected' : 'bare';
  const w = 96 * k + 16;
  const h = 14 * k + 48 * k + 10 * k;
  el.width = w;
  el.height = h;
  const g = el.getContext('2d');
  const cx0 = w / 2;
  const top = 14 * k;
  for (let sum = 0; sum <= 2 * (n - 1); sum++) {
    for (let i = 0; i < n; i++) {
      const j = sum - i;
      if (j < 0 || j >= n) continue;
      const cx = cx0 + 16 * k * (i - j);
      const cy = top + 8 * k * (i + j);
      place(g, plazaSprite((i * 5 + j * 3) % 8, look, blockMask(i, j, n)), cx, cy, k);
    }
  }
}

for (const el of Array.from(document.querySelectorAll('canvas[data-plazatile]'))) {
  const variant = Number(el.dataset.variant);
  const look = el.dataset.look || 'bare';
  const mask = el.dataset.mask ? Number(el.dataset.mask) : 15;
  const k = 4;
  el.width = 32 * k + 32;
  el.height = 16 * k + 22 * k;
  const g = el.getContext('2d');
  g.clearRect(0, 0, el.width, el.height);
  place(g, plazaSprite(variant, look, mask), el.width / 2, 16 * k, k);
}

for (const el of Array.from(document.querySelectorAll('canvas[data-coast]'))) {
  const kind = String(el.dataset.coast) as CoastKind;
  const variant = Number(el.dataset.variant || 0);
  const k = Number(el.dataset.k || 3);
  // The lighthouse is three times taller than a cell: the canvas is the size of the drawing, not of a lot.
  const sprite = coastPixelSprite(kind, variant);
  el.width = sprite.canvas.width * k;
  el.height = sprite.canvas.height * k;
  el.style.width = el.width + 'px';
  el.style.height = el.height + 'px';
  const g = el.getContext('2d');
  g.clearRect(0, 0, el.width, el.height);
  place(g, sprite, el.width / 2, sprite.ay * k, k);
}

for (const el of Array.from(document.querySelectorAll('canvas[data-plant]'))) {
  const kind = el.dataset.plant;
  const k = Number(el.dataset.k || 3);
  el.width = 76 * k;
  el.height = 100 * k;
  const g = el.getContext('2d');
  g.clearRect(0, 0, el.width, el.height);
  place(g, plantPixelSprite(kind), el.width / 2, 62 * k, k);
}

for (const el of Array.from(document.querySelectorAll('canvas[data-service]'))) {
  const kind = String(el.dataset.service) as ServiceKind;
  const k = Number(el.dataset.k || 3);
  // The hospital and the university take 3x3 lots, so the canvas is the size of their own drawing and
  // not a cell: asking the sprite keeps the two rows of the section honest.
  const sprite = servicePixelSprite(kind);
  el.width = sprite.canvas.width * k;
  el.height = sprite.canvas.height * k;
  el.style.width = el.width + 'px';
  el.style.height = el.height + 'px';
  const g = el.getContext('2d');
  g.clearRect(0, 0, el.width, el.height);
  // The ground line goes where the sprite's anchor is, so a 3x3 drawing is not clipped at the top.
  place(g, sprite, el.width / 2, sprite.ay * k, k);
}

for (const el of Array.from(document.querySelectorAll('canvas[data-tree]'))) {
  const [kind, variant] = String(el.dataset.tree).split(':').map(Number);
  const k = Number(el.dataset.k || 3);
  const sprite = treePixelSprite(kind, variant);
  el.width = sprite.canvas.width * k;
  el.height = sprite.canvas.height * k;
  el.style.width = el.width + 'px';
  el.style.height = el.height + 'px';
  const g = el.getContext('2d');
  g.clearRect(0, 0, el.width, el.height);
  place(g, sprite, el.width / 2, sprite.ay * k, k);
}

for (const el of Array.from(document.querySelectorAll('canvas[data-pole]'))) {
  const [tier, variant] = String(el.dataset.pole || '0:0').split(':').map(Number);
  const k = Number(el.dataset.k || 4);
  const sprite = polePixelSprite(tier, variant);
  el.width = sprite.canvas.width * k;
  el.height = sprite.canvas.height * k;
  el.style.width = el.width + 'px';
  el.style.height = el.height + 'px';
  const g = el.getContext('2d');
  g.clearRect(0, 0, el.width, el.height);
  place(g, sprite, el.width / 2, sprite.ay * k, k);
}

for (const el of Array.from(document.querySelectorAll('canvas[data-veh]'))) {
  const [kind, color, dir] = String(el.dataset.veh || 'car:0:0').split(':');
  const k = Number(el.dataset.k || 8);
  const heading = Number(dir) as 0 | 1 | 2 | 3;
  const sprite =
    kind === 'tour' || kind === 'fishing' || kind === 'cruise'
      ? boatPixelSprite(kind, heading)
      : kind === 'plane'
        ? planePixelSprite(Number(color || 3), heading)
        : carPixelSprite(kind as 'car' | 'taxi' | 'bus', Number(color), heading);
  el.width = sprite.canvas.width * k;
  el.height = sprite.canvas.height * k;
  el.style.width = el.width + 'px';
  el.style.height = el.height + 'px';
  const g = el.getContext('2d');
  g.clearRect(0, 0, el.width, el.height);
  place(g, sprite, el.width / 2, sprite.ay * k, k);
}

for (const el of Array.from(document.querySelectorAll('canvas[data-hub]'))) {
  const [kind, level, fw, fh, side] = String(el.dataset.hub).split(':');
  const k = Number(el.dataset.k || 2);
  const art = paintHub(kind as HubKind, Number(level), Number(fw), Number(fh), Number(side || 0));
  el.width = art.px.w * k;
  el.height = art.px.h * k;
  const g = el.getContext('2d');
  g.clearRect(0, 0, el.width, el.height);
  g.imageSmoothingEnabled = false;
  g.drawImage(art.px.toCanvas(k), 0, 0);
}

for (const el of Array.from(document.querySelectorAll('canvas[data-depot]'))) {
  const color = Number(el.dataset.depot || 0);
  const k = Number(el.dataset.k || 3);
  el.width = 74 * k;
  el.height = 64 * k;
  const g = el.getContext('2d');
  g.clearRect(0, 0, el.width, el.height);
  place(g, busDepotPixelSprite(color), el.width / 2, 24 * k, k);
}

for (const el of Array.from(document.querySelectorAll('canvas[data-sheet]'))) {
  const zone = el.dataset.sheet;
  const CW = 92;
  const CH = 172;
  const SG = 138;
  el.width = CW * 5;
  el.height = CH;
  const g = el.getContext('2d');
  for (let i = 0; i < 5; i++) {
    const cx = i * CW + CW / 2;
    lot(g, cx, SG, 2);
    place(g, NEW[zone](i + 1, 0), cx, SG, 2);
  }
}

for (const el of Array.from(document.querySelectorAll('canvas[data-level]'))) {
  const zone = el.dataset.zone;
  const level = Number(el.dataset.level);
  const variant = Number(el.dataset.variant);
  el.width = 112;
  el.height = H;
  const g = el.getContext('2d');
  g.clearRect(0, 0, 112, H);
  lot(g, 56, GROUND, K);
  place(g, NEW[zone](level, variant), 56, GROUND, K);
}

for (const el of Array.from(document.querySelectorAll('canvas[data-lot]'))) {
  const kind = el.dataset.lot;
  const variant = Number(el.dataset.variant);
  const n = lotSize(kind);
  const k = n === 3 ? 2 : 3;
  el.width = 240;
  el.height = 320;
  const g = el.getContext('2d');
  g.clearRect(0, 0, 240, 320);
  lotBig(g, 120, 220, k, n);
  place(g, lotPixelSprite(kind, variant), 120, 220, k);
}
`;

interface Family {
  zone: 'R' | 'C' | 'I';
  title: string;
  intro: string;
  levels: [number, string, string][];
}

const FAMILIES: Family[] = [
  {
    zone: 'R',
    title: 'Residencial',
    intro: 'Del ladrillo y la chapa a la torre, con una identidad por nivel.',
    levels: [
      [1, 'Casa humilde', 'Ladrillo a la vista, chapa y caño de estufa.'],
      [2, 'Casa de familia', 'Chalet de tejas, chimenea, porche y jardín con cerco.'],
      [3, 'Casa chorizo', 'Ancha y baja: cornisa, rejas, garage y azotea con pérgola.'],
      [4, 'Edificio de renta', 'Ladrillo a la vista, local con toldo y balcones por piso.'],
      [5, 'Torre', 'Cuatro modelos: podio y fuste, escalones, torre con ala baja y franjas verticales.'],
    ],
  },
  {
    zone: 'C',
    title: 'Comercial',
    intro: 'Cada nivel es un rubro distinto, no un local genérico que crece.',
    levels: [
      [1, 'Kiosco', 'Ventanilla de servicio, mostrador iluminado, toldo y un cajón afuera.'],
      [2, 'Verdulería', 'Abierta a la calle, toldo verde, cajones de fruta y pizarra.'],
      [3, 'Peluquería', 'Vidriera ancha, banda de chapa y el poste de barbero en la esquina.'],
      [4, 'Bar', 'Planta baja de madera con ventanas cálidas y mesas en la vereda.'],
      [5, 'Local de ropa', 'Dos vidrieras con maniquíes y cartel vertical en la esquina.'],
    ],
  },
  {
    zone: 'I',
    title: 'Industrial',
    intro: 'Cada nivel es un rubro distinto, y las chimeneas declaran humo.',
    levels: [
      [1, 'Taller de chapa', 'Galpón de chapa con portón, tanque y un cajón afuera.'],
      [2, 'Taller metalúrgico', 'Ladrillo, rejas en la ventana y la primera chimenea humeando.'],
      [3, 'Fábrica de ladrillo', 'Dos naves, techo en diente de sierra, silo y contenedores.'],
      [4, 'Planta de hormigón', 'Bloque de hormigón, chimenea alta, silo y acopio de áridos.'],
      [5, 'Gran planta', 'Dos naves, dos chimeneas, silos y sala de máquinas en la azotea.'],
    ],
  },
];

interface LotGroup {
  id: string;
  title: string;
  note: string;
  lots: [string, string][];
}

const GROUPS: LotGroup[] = [
  {
    id: 'lotes-chicos',
    title: 'Comercio en 2 x 2',
    note: 'Rubros que no entran en una celda: en vez de cuatro locales de 1 x 1, un solo edificio que ocupa el lote entero y por eso puede ser ancho en lugar de alto. El bar alterna dos formas: las variantes pares son el bar de barrio y las impares el bar común.',
    lots: [
      ['mercado', 'Mercado'],
      ['ropa', 'Local de ropa'],
      ['bar', 'Bar'],
      ['oficinas', 'Oficinas'],
    ],
  },
  {
    id: 'lotes-industria',
    title: 'Industria en 2 x 2',
    note: 'El taller de una celda no tiene lugar para el patio, los silos ni las chimeneas. Con dos celdas por lado entra el rubro completo.',
    lots: [
      ['galpon', 'Galpón de depósito'],
      ['silos', 'Planta cerealera'],
      ['quimica', 'Planta química'],
      ['frigorifico', 'Frigorífico'],
    ],
  },
  {
    id: 'lotes-polo',
    title: 'Industria en 3 x 3',
    note: 'Los complejos: tres celdas por lado para el predio, las naves, los acopios y el patio de camiones.',
    lots: [
      ['polo', 'Polo industrial'],
      ['aceria', 'Acería'],
    ],
  },
];

const lotGroup = (g: LotGroup) => `
      <h3>${g.title}</h3>
      <p class="note">${g.note}</p>
      ${g.lots
        .map(
          ([kind, name]) => `
        <p class="sub">${name}</p>
        <div class="row">
          ${[0, 1, 2, 3]
            .map(
              (variant) => `
          <figure>
            <canvas data-lot="${kind}" data-variant="${variant}"></canvas>
            <figcaption>variante ${variant}</figcaption>
          </figure>`,
            )
            .join('')}
        </div>`,
        )
        .join('')}`;

const lots = GROUPS.map(lotGroup).join('');

const sections = FAMILIES.map(
  (f) => `
      <section id="zona-${f.zone}">
        <h2>${f.title}</h2>
        <p class="note">${f.intro}</p>
        <div class="sheet">
          <canvas data-sheet="${f.zone}"></canvas>
          <p class="legend">De nivel 1 a 5, el mismo lote</p>
        </div>
        ${f.levels
          .map(
            ([level, name, note]) => `
        <h3>${level} · ${name}</h3>
        <p class="note">${note}</p>
        <div class="row">
          ${[0, 1, 2, 3]
            .map(
              (variant) => `
          <figure>
            <canvas data-zone="${f.zone}" data-level="${level}" data-variant="${variant}"></canvas>
            <figcaption>variante ${variant}</figcaption>
          </figure>`,
            )
            .join('')}
        </div>`,
          )
          .join('')}
      </section>`,
).join('');

const page = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>ArgenCity 3000 - Arte de las zonas</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 20px 22px 30px;
        background: #14181c;
        color: #e9e6df;
        font-family: ui-sans-serif, system-ui, sans-serif;
      }
      h1 { font-size: 19px; margin: 0 0 4px; letter-spacing: 0.02em; }
      h2 { font-size: 17px; margin: 26px 0 2px; color: #d8b24a; }
      h3 { font-size: 14px; margin: 18px 0 2px; }
      p.sub { margin: 0 0 6px; color: #9aa2a8; font-size: 12.5px; max-width: 78ch; line-height: 1.55; }
      code { background: #232a31; padding: 1px 5px; border-radius: 4px; color: #d8b24a; font-size: 12px; }
      .legend { margin: 6px 0 0; color: #c9cdd1; font-size: 12px; }
      .legend b { color: #d8b24a; }
      .note { margin: 0 0 8px; color: #8e979e; font-size: 12px; }
      .sheet { margin: 10px 0 4px; }
      .row { display: flex; gap: 10px; flex-wrap: wrap; }
      figure { margin: 0; padding: 4px 4px 8px; border-radius: 10px; background: #1b2026; text-align: center; }
      canvas { display: block; width: 220px; height: 420px; image-rendering: pixelated; }
      canvas[data-sheet] { width: 460px; height: 344px; }
      canvas[data-lot] { width: 240px; height: 320px; }
      canvas[data-plazablock] { width: 208px; height: 144px; }
      canvas[data-plazatile] { width: 160px; height: 152px; }
      canvas[data-city] { width: auto; height: auto; max-width: 100%; }
      canvas[data-coast] { display: block; }
      canvas[data-depot] { width: 222px; height: 192px; }
      canvas[data-plant] { width: 228px; height: 300px; }
      canvas[data-hub] { max-width: 100%; height: auto; }
      canvas[data-service] { display: block; }
      figcaption { margin-top: 4px; font-size: 11px; color: #8e979e; }
    </style>
  </head>
  <body>
    <h1>Arte de las zonas</h1>
    <p class="sub">
      Cada familia completa, nivel por nivel, sobre el mismo lote: es el arte que pinta el juego.
    </p>
    <p class="sub">
      Es el arte del juego: lo que pinta el mapa es exactamente esto.
    </p>
    ${sections}
    <section id="energia">
      <h2>Usinas</h2>
      <p class="note">
        Las tres usinas se dibujan sobre el bloque de 2×2 que ya ocupan. La térmica es la sucia: dos
        chimeneas sobre la casa de calderas, el carbón amontonado atrás y la cinta que lo sube al
        horno. La de gas quema limpio: dos esferas de gas, la nave de turbinas en vidrio y una
        chimenea flaca que casi no humea. El parque eólico no es un galpón sino un campo de molinos.
      </p>
      <div class="row">
        <figure>
          <canvas data-plant="coal" data-k="3"></canvas>
          <figcaption>térmica</figcaption>
        </figure>
        <figure>
          <canvas data-plant="gas" data-k="3"></canvas>
          <figcaption>a gas</figcaption>
        </figure>
        <figure>
          <canvas data-plant="wind" data-k="3"></canvas>
          <figcaption>parque eólico</figcaption>
        </figure>
      </div>
    </section>
    <section id="servicios">
      <h2>Servicios</h2>
      <p class="note">
        Ninguno tiene niveles. Los cuatro chicos ocupan una celda y son los que más aparecen en una
        ciudad, así que son los que más cantaban en arte viejo: la escuela por el mástil con la bandera y
        el patio con reja, la salita por la cruz verde, la comisaría por la baliza y el patrullero, y los
        bomberos por la torre de secado.
      </p>
      <h3>De una celda</h3>
      <div class="row">
        ${(
          [
            ['school', 'escuela'],
            ['clinic', 'salita'],
            ['police', 'comisaría'],
            ['fire', 'bomberos'],
          ] as const
        )
          .map(
            ([kind, name]) => `
          <figure>
            <canvas data-service="${kind}" data-k="3"></canvas>
            <figcaption>${name}</figcaption>
          </figure>`,
          )
          .join('')}
      </div>
      <h3>De 3×3</h3>
      <p class="note">
        El hospital y la universidad ocupan nueve lotes: un edificio así de grande no entra en una
        celda sin parecer un kiosco. Son <b>un</b> edificio para la cobertura, el mantenimiento, la luz y
        la demolición, y se dibujan una sola vez sobre todo el bloque. El hospital es la torre de
        internación con la helisuperficie, el ala de salas y la guardia con la ambulancia; la universidad
        es la barra de aulas, el claustro con su jardín y el pórtico de columnas con la torre del reloj.
      </p>
      <div class="row">
        ${(
          [
            ['hospital', 'hospital'],
            ['university', 'universidad'],
          ] as const
        )
          .map(
            ([kind, name]) => `
          <figure>
            <canvas data-service="${kind}" data-k="3"></canvas>
            <figcaption>${name}</figcaption>
          </figure>`,
          )
          .join('')}
      </div>
    </section>
    <section id="campo">
      <h2>El tendido y los árboles</h2>
      <p class="note">
        Las dos últimas piezas que estaban en canvas. El <b>tendido</b> es la otra mitad de la
        electricidad y tiene dos calidades. El de <b>madera</b> es el de siempre: poste bajo, torcido,
        cruceta de madera y dos aisladores de cerámica; alumbra tres lotes a la redonda y se planta cada
        tres. El de <b>hormigón</b> es la mejora: más alto, derecho, con su placa y su transformador, y
        llega a <b>cinco</b> lotes, así que cubre casi el triple con los mismos postes. Los cables se
        escriben con píxeles duros en vez del trazo suave de canvas pero conservan la misma curva, la
        misma caída y el mismo punto de enganche, y cada punta cuelga de la altura de su propio poste.
        La variante del lote decide el transformador o la cruceta doble.
      </p>
      <div class="row">
        <figure>
          <canvas data-pole="0:0" data-k="4"></canvas>
          <figcaption>madera</figcaption>
        </figure>
        <figure>
          <canvas data-pole="0:1" data-k="4"></canvas>
          <figcaption>madera, transformador</figcaption>
        </figure>
        <figure>
          <canvas data-pole="0:2" data-k="4"></canvas>
          <figcaption>madera, con rienda</figcaption>
        </figure>
        <figure>
          <canvas data-pole="1:0" data-k="4"></canvas>
          <figcaption>hormigón</figcaption>
        </figure>
        <figure>
          <canvas data-pole="1:1" data-k="4"></canvas>
          <figcaption>hormigón, transformador</figcaption>
        </figure>
        <figure>
          <canvas data-pole="1:2" data-k="4"></canvas>
          <figcaption>hormigón, cruceta doble</figcaption>
        </figure>
      </div>
      <p class="note">
        Los <b>árboles</b> sueltos del mapa son los del terreno, no los de las plazas. Son las cuatro
        especies de siempre y se distinguen por la silueta: el eucalipto alto y angosto, el ombú ancho y
        bajo, el palo borracho por su tronco hinchado y el jacarandá por la copa redonda y las flores
        caídas en el piso. La densidad también es la de siempre: de uno a tres por celda.
      </p>
      <div class="row">
        ${(
          [
            [1, 'jacarandá'],
            [2, 'palo borracho'],
            [3, 'ombú'],
            [4, 'eucalipto'],
          ] as const
        )
          .map(
            ([kind, name]) => `
          <figure>
            <canvas data-tree="${kind}:0" data-k="3"></canvas>
            <figcaption>${name}</figcaption>
          </figure>
          <figure>
            <canvas data-tree="${kind}:2" data-k="3"></canvas>
            <figcaption>${name}, variante</figcaption>
          </figure>`,
          )
          .join('')}
      </div>
    </section>
    <section id="vehiculos">
      <h2>Vehículos</h2>
      <p class="note">
        Lo último que quedaba en canvas, y lo que más cantaba: un auto son <b>4 x 2 píxeles</b> al lado de
        un lote de 32, y estaba dibujado con trazos suaves en una ciudad de píxel duro. Acá va con el mismo
        taller que todo lo demás, <b>en unidades de lote</b>, con el techo iluminado, el lateral en sombra,
        la banda de ventanillas, las ruedas y su sombra en el piso. Cada vehículo tiene sus <b>cuatro
        rumbos dibujados</b> —no rotados—, de izquierda a derecha: al frente y la cola cambia con el rumbo,
        así que el que se va muestra las luces traseras en la cara que la cámara ve.
      </p>
      <div class="row">
        ${['car', 'taxi', 'bus']
          .map(
            (kind) => `
          <figure class="veh">
            ${[0, 1, 2, 3]
              .map(
                (dir) => `<canvas data-veh="${kind}:2:${dir}" data-k="8"></canvas>`,
              )
              .join('')}
            <figcaption>${kind === 'car' ? 'auto' : kind === 'taxi' ? 'taxi' : 'colectivo'}</figcaption>
          </figure>`,
          )
          .join('')}
      </div>
      <p class="note">
        En el <b>agua</b> la forma la da la obra viva: el casco oscuro abajo, la obra muerta blanca arriba y
        la cubierta en el medio. El de pesca lleva su casilla y el mástil con la bandera; el de paseo, la
        cabina con la rueda; el <b>crucero</b> lleva dos puentes con ventanillas y la chimenea colorada. La
        estela de dos píxeles es lo que distingue uno navegando de uno parado.
      </p>
      <div class="row">
        ${[
          ['fishing', 'de pesca'],
          ['tour', 'de paseo'],
          ['cruise', 'crucero'],
        ]
          .map(
            ([kind, name]) => `
          <figure class="veh">
            ${[0, 1, 2, 3].map((dir) => `<canvas data-veh="${kind}:0:${dir}" data-k="5"></canvas>`).join('')}
            <figcaption>${name}</figcaption>
          </figure>`,
          )
          .join('')}
      </div>
      <p class="note">
        El <b>avión</b> se ve desde arriba, así que se lee por la silueta: el fuselaje blanco con la panza
        en sombra, las alas en flecha que lo cruzan, el estabilizador y la deriva de la cola, y la cabina
        oscura en la punta. El tamaño lo pone el nivel del aeropuerto, y abajo, en la pista, queda su
        sombra mientras sube.
      </p>
      <div class="row">
        ${[1, 3, 5]
          .map(
            (level) => `
          <figure class="veh">
            ${[0, 1, 2, 3].map((dir) => `<canvas data-veh="plane:${level}:${dir}" data-k="4"></canvas>`).join('')}
            <figcaption>avión, nivel ${level}</figcaption>
          </figure>`,
          )
          .join('')}
      </div>
    </section>
    <section id="transporte">
      <h2>Transporte</h2>
      <p class="note">
        El aeropuerto y el puerto no se dibujan por pieza: cada pieza es una <b>ventana</b> de un dibujo
        único de la instalación, así que dos piezas pegadas son una sola terminal y no dos galpones
        repetidos. El nivel es la cantidad de piezas pegadas, de modo que el dibujo crece con el
        rectángulo: más pista, más puertas, más contenedores.
      </p>
      <h3>Aeropuerto</h3>
      <div class="row">
        <figure>
          <canvas data-hub="airport:1:3:2" data-k="2"></canvas>
          <figcaption>una pieza: hangar y pista</figcaption>
        </figure>
        <figure>
          <canvas data-hub="airport:2:6:2" data-k="2"></canvas>
          <figcaption>dos piezas: aeródromo con terminal y torre</figcaption>
        </figure>
        <figure>
          <canvas data-hub="airport:3:6:4" data-k="4"></canvas>
          <figcaption>cuatro piezas: aeropuerto internacional</figcaption>
        </figure>
      </div>
      <h3>Puerto</h3>
      <div class="row">
        <figure>
          <canvas data-hub="harbor:1:2:2:0" data-k="2"></canvas>
          <figcaption>una pieza: muelle de paseos</figcaption>
        </figure>
        <figure>
          <canvas data-hub="harbor:2:4:2:1" data-k="2"></canvas>
          <figcaption>dos piezas: puerto con grúa</figcaption>
        </figure>
        <figure>
          <canvas data-hub="harbor:3:6:2:1" data-k="3"></canvas>
          <figcaption>tres piezas: puerto con cruceros</figcaption>
        </figure>
      </div>
    </section>
    <section id="colectivos">
      <h2>Colectivos</h2>
      <p class="note">
        La cochera es de 2×2 lotes: en una celda sola no entran el edificio, los tres colectivos de la
        línea y el patio. Es la única pieza del transporte que se reconoce por el color, así que está
        pintada en el color de la línea y el cartel del techo lo repite.
      </p>
      <div class="row">
        ${Array.from({ length: 10 }, (_, color) => `
          <figure>
            <canvas data-depot="${color}" data-k="3"></canvas>
            <figcaption>línea ${color}</figcaption>
          </figure>`).join('')}
      </div>
    </section>
    <section id="costa">
      <h2>Costa</h2>
      <p class="note">
        La rambla y el muelle son las dos piezas que se repiten celda por celda en toda la costa. La
        rambla pinta sus losas y levanta la baranda sobre los lados que dan al río, con banco, árbol,
        cantero y farol; el muelle es un entablonado sobre pilotes, con cajones en la punta seca y el
        bote amarrado del lado del agua.
      </p>
      <h3>Rambla</h3>
      <p class="note">Los cuatro bits bajos son los lados que dan al agua; el bit 16 pone el farol.</p>
      <div class="row">
        ${[1, 2, 4, 8, 5, 10, 3, 12, 1 | 16, 2 | 16, 4 | 16, 8 | 16]
          .map(
            (variant) => `
          <figure>
            <canvas data-coast="promenade" data-variant="${variant}"></canvas>
            <figcaption>${variant}</figcaption>
          </figure>`,
          )
          .join('')}
      </div>
      <h3>Muelle de pesca</h3>
      <p class="note">Los cuatro lados hacia donde puede salir el muelle.</p>
      <div class="row">
        ${[0, 1, 2, 3]
          .map(
            (dir) => `
          <figure>
            <canvas data-coast="fishing" data-variant="${dir}"></canvas>
            <figcaption>lado ${dir}</figcaption>
          </figure>`,
          )
          .join('')}
      </div>
      <h3>Puerto de carga</h3>
      <p class="note">
        Los contenedores apilados dicen qué es y la grúa pórtico le da la altura: dos patas, la viga y
        un contenedor colgado. El muelle de hormigón corre hasta los lados que dan al agua, con sus
        bolardos; cada dibujo es una máscara distinta.
      </p>
      <div class="row">
        ${[0, 1, 4, 5, 2, 8, 3, 12]
          .map(
            (variant) => `
          <figure>
            <canvas data-coast="port" data-variant="${variant}"></canvas>
            <figcaption>agua ${variant}</figcaption>
          </figure>`,
          )
          .join('')}
      </div>
      <h3>Balneario</h3>
      <p class="note">
        El bar de paja con el toldo a rayas sobre el mostrador, las sombrillas y las reposeras en la
        arena. La arena llega al agua con su espuma; el bar se queda de este lado.
      </p>
      <div class="row">
        ${[0, 1, 4, 5, 2, 8]
          .map(
            (variant) => `
          <figure>
            <canvas data-coast="resort" data-variant="${variant}"></canvas>
            <figcaption>agua ${variant}</figcaption>
          </figure>`,
          )
          .join('')}
      </div>
      <h3>Faro</h3>
      <p class="note">
        La torre a franjas, la galería, la luz encendida y su haz. Es lo más alto de la costa: se lee
        de lejos por la silueta, agarrado a la roca donde rompe el agua.
      </p>
      <div class="row">
        ${[0, 1, 4, 8]
          .map(
            (variant) => `
          <figure>
            <canvas data-coast="lighthouse" data-variant="${variant}"></canvas>
            <figcaption>agua ${variant}</figcaption>
          </figure>`,
          )
          .join('')}
      </div>
    </section>
    <section id="calle">
      <h2>La calle y la plaza, en el renderer de verdad</h2>
      <p class="note">
        Una manzana dibujada por el juego, no un sprite suelto: el piso de la plaza y el detalle de
        píxel de la calle —cordón, juntas de la vereda, sumideros y grano del asfalto—, tal como se
        ven en el mapa.
      </p>
      <div class="row">
        <figure>
          <canvas data-city data-k="3" data-crop="0.5"></canvas>
          <figcaption>manzana de calles y una plaza de 3 x 3</figcaption>
        </figure>
      </div>
    </section>
    <section id="plazas">
      <h2>Plazas</h2>
      <p class="note">
        El piso es una losa de celda completa que sabe con qué vecinos conecta, así que una plaza de
        varias celdas arma un recorrido continuo en vez de repetir el mismo cuadrado con una cruz. El
        ornamento va en las celdas interiores, que son las únicas sin borde.
      </p>
      <div class="row">
        <figure>
          <canvas data-plazablock="kept"></canvas>
          <figcaption>manzana de 3 x 3, cuidada</figcaption>
        </figure>
        <figure>
          <canvas data-plazablock="dry"></canvas>
          <figcaption>la misma, descuidada</figcaption>
        </figure>
      </div>
      <h3>Lo que puede ir en el medio</h3>
      <p class="note">
        Monumento, fuente y glorieta, uno por celda interior según la variante; las celdas del borde
        llevan bancos, árboles y faroles.
      </p>
      <div class="row">
        ${[0, 1, 2, 3, 4, 5, 6, 7]
          .map(
            (variant) => `
          <figure>
            <canvas data-plazatile data-variant="${variant}"></canvas>
            <figcaption>variante ${variant}</figcaption>
          </figure>`,
          )
          .join('')}
      </div>
      <div class="row">
        ${['tree', 'bare', 'neglected']
          .map(
            (look) => `
          <figure>
            <canvas data-plazatile data-variant="4" data-look="${look}" data-mask="3"></canvas>
            <figcaption>${look === 'tree' ? 'con árbol' : look === 'bare' ? 'borde, sin árbol' : 'descuido'}</figcaption>
          </figure>`,
          )
          .join('')}
      </div>
    </section>
    <section id="lotes">
      <h2>Lotes de varias celdas</h2>
      ${lots}
      <p class="note">
        Estos todavía no están en el juego: falta la regla que convierte cuatro celdas de comercio
        contiguas en un lote. El arte está listo y se engancha cuando exista el lote.
      </p>
    </section>
    <script>/*BUNDLE*/</script>
    <script>
      // solo=city, or the id of a section, leaves only that piece on the page, so the renderer's
      // output can be looked at whole instead of in a corner of a long sheet.
      const solo = new URLSearchParams(location.search).get('solo');
      if (solo) {
        addEventListener('load', () => {
          const keep = solo === 'city' ? document.querySelector('canvas[data-city]') : document.getElementById(solo);
          if (!keep) return;
          const body = document.body;
          while (body.firstChild) body.removeChild(body.firstChild);
          const box = document.createElement('div');
          box.style.padding = '12px';
          box.appendChild(keep);
          keep.style.width = 'auto';
          keep.style.height = 'auto';
          body.appendChild(box);
        });
      }
    </script>
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
writeFileSync('arte.html', // The bundle goes in through a function: as a string, `$&` and friends inside it would be read as
// replacement patterns and a stray `$&` would eat a slice of the page's own code.
page.replace('/*BUNDLE*/', () => js));
console.log(`arte.html escrito (${Math.round(js.length / 1024)} kB de sprites)`);
