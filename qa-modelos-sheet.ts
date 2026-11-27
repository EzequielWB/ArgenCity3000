/** Ficha de modelos (desechable): hoja de contacto + escenas de conexión + auditoría de sangrado.
 * La sirve `npm run dev` en /qa-modelos.html. Todo el dibujo va en coordenadas de zoom (z). */
import {
  residentialPixelSprite,
  commercialPixelSprite,
  industrialPixelSprite,
  farmPixelSprite,
  siloPixelSprite,
  marketPixelSprite,
  servicePixelSprite,
  plantPixelSprite,
  polePixelSprite,
  treePixelSprite,
  coastPixelSprite,
  hubPixelSprite,
  busDepotPixelSprite,
  plazaPixelSprite,
} from './src/render/pixelArt';
import { buildingSprite, abandonedBuildingSprite, burningBuildingSprite, uniqueSprite, routeSignSpriteFor } from './src/render/sprites';
import { carPixelSprite, boatPixelSprite, planePixelSprite } from './src/render/vehicleArt';
import { BUS_COLORS, SERVICE_SIZE, UNIQUES, FARM_SIZE, SILO_SIZE, MARKET_SIZE, PLANT_SIZE, BUS_SIZE, HUBS } from './src/config';
import type { ServiceKind, UniqueKind, CoastKind, PlantKind, HubKind } from './src/config';
import type { Sprite } from './src/render/sprites';
import type { HubView } from './src/render/pixelArt';

const Z = 2; // zoom de toda la ficha

interface Item {
  label: string;
  sp: Sprite;
  w?: number; // huella en celdas de vista
  h?: number;
}

/** Sangrado del sprite fuera de su huella: [izquierda, derecha, abajo] en px de 1x (+ = se mete en el vecino). */
function auditOf(it: Item): [number, number, number] {
  const c = it.sp.canvas;
  const g = c.getContext('2d')!;
  const img = g.getImageData(0, 0, c.width, c.height).data;
  let minX = c.width, maxX = -1, maxY = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (img[(y * c.width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  const w = it.w ?? 1;
  const h = it.h ?? 1;
  const left = it.sp.ax - 16 * h - minX;
  const right = maxX - (it.sp.ax + 16 * w);
  const bottom = maxY - (it.sp.ay + 8 * (w + h));
  return [left, right, bottom];
}

function section(id: string, title: string, width: number, height: number): CanvasRenderingContext2D {
  const h1 = document.createElement('h2');
  h1.textContent = title;
  document.body.appendChild(h1);
  const canvas = document.createElement('canvas');
  canvas.id = id;
  canvas.width = width * Z;
  canvas.height = height * Z;
  document.body.appendChild(canvas);
  const g = canvas.getContext('2d')!;
  g.scale(Z, Z);
  g.imageSmoothingEnabled = false;
  return g;
}

/** Rombo de piso de una huella w×h con la punta arriba en (sx, sy), en coordenadas de 1x. */
function ground(g: CanvasRenderingContext2D, sx: number, sy: number, w: number, h: number, fill = '#2f4a2a'): void {
  g.beginPath();
  g.moveTo(sx, sy);
  g.lineTo(sx + 16 * w, sy + 8 * w);
  g.lineTo(sx + 16 * (w - h), sy + 8 * (w + h));
  g.lineTo(sx - 16 * h, sy + 8 * h);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.strokeStyle = '#4a6a3a';
  g.stroke();
}

/** Fila de items con piso, sprite (anclado a la punta), etiqueta y auditoría. */
function row(g: CanvasRenderingContext2D, items: Item[], y: number, x0: number, findings: string[]): void {
  let x = x0;
  for (const it of items) {
    const w = it.w ?? 1;
    const h = it.h ?? 1;
    const height = it.sp.canvas.height + 40;
    const sx = x + 16 * h; // punta del rombo (x del ancla)
    ground(g, sx, y, w, h);
    g.drawImage(it.sp.canvas, sx - it.sp.ax, y - it.sp.ay);
    const b = auditOf(it);
    if (b[0] > 2 || b[1] > 2 || b[2] > 2) findings.push(`${it.label}: izq ${b[0]} · der ${b[1]} · abajo ${b[2]} px`);
    g.fillStyle = '#cbd5e1';
    g.font = '9px monospace';
    g.textAlign = 'center';
    g.fillText(it.label, sx + (16 * w - 16 * h), y + 8 * (w + h) + 14, 32 * Math.max(w, h) + 20);
    x += 32 * Math.max(w, h) + 22;
    y = Math.max(y, 0); // la fila comparte la línea de piso
    void height;
  }
}

const findings: string[] = [];

function sheet(): void {
  // 1. zonas
  {
    const g = section('zonas', '1 · Zonas R / C / I, niveles 1 a 5, variantes y estados', 1290, 560);
    const items: Item[] = [];
    for (const [zone, fn] of [
      ['R', residentialPixelSprite],
      ['C', commercialPixelSprite],
      ['I', industrialPixelSprite],
    ] as const) {
      for (let lv = 1; lv <= 5; lv++) items.push({ label: `${zone}${lv}`, sp: fn(lv, 0) });
    }
    row(g, items, 140, 14, findings);
    const vr: Item[] = [];
    for (let v = 0; v < 8; v++) vr.push({ label: `R5v${v}`, sp: residentialPixelSprite(5, v) });
    row(g, vr, 300, 14, findings);
    const vrC: Item[] = [];
    for (let v = 0; v < 8; v++) vrC.push({ label: `C5v${v}`, sp: commercialPixelSprite(5, v) });
    row(g, vrC, 460, 14, findings);
  }
  // 1b. estados
  {
    const g = section('estados', '1b · Estados: ok, abandonada, en llamas', 640, 240);
    const st: Item[] = [
      { label: 'R3 ok', sp: buildingSprite('R', 3, 0) },
      { label: 'R3 abandonada', sp: abandonedBuildingSprite('R', 3, 0) },
      { label: 'R3 en llamas', sp: burningBuildingSprite('R', 3, 0) },
      { label: 'C4 abandonada', sp: abandonedBuildingSprite('C', 4, 0) },
    ];
    row(g, st, 140, 14, findings);
  }

  // 2. campo y comercios de barrio
  {
    const g = section('campo', '2 · Campo (estados), silo, feria, plazas y cartel de ruta', 1160, 300);
    const items: Item[] = [
      { label: 'arado', sp: farmPixelSprite('arado'), w: FARM_SIZE, h: FARM_SIZE },
      { label: 'crecido', sp: farmPixelSprite('crecido'), w: FARM_SIZE, h: FARM_SIZE },
      { label: 'rastrojo', sp: farmPixelSprite('rastrojo'), w: FARM_SIZE, h: FARM_SIZE },
      { label: 'silo', sp: siloPixelSprite(), w: SILO_SIZE, h: SILO_SIZE },
      { label: 'feria', sp: marketPixelSprite(), w: MARKET_SIZE, h: MARKET_SIZE },
      { label: 'plaza árbol', sp: plazaPixelSprite(0, 'tree', 0) },
      { label: 'plaza seca', sp: plazaPixelSprite(0, 'bare', 0) },
      { label: 'plaza abdonada', sp: plazaPixelSprite(0, 'neglected', 0) },
      { label: 'cartel ruta', sp: routeSignSpriteFor(1, 1) },
    ];
    row(g, items, 160, 14, findings);
  }

  // 3. servicios y usinas
  {
    const g = section('serv', '3 · Servicios (huella 1 y 3) y usinas (2×2)', 1300, 300);
    const items: Item[] = [];
    for (const k of ['school', 'clinic', 'police', 'fire', 'hospital', 'university'] as ServiceKind[]) {
      items.push({ label: k, sp: servicePixelSprite(k), w: SERVICE_SIZE[k], h: SERVICE_SIZE[k] });
    }
    for (const k of ['coal', 'gas', 'wind'] as PlantKind[]) items.push({ label: `usina ${k}`, sp: plantPixelSprite(k), w: PLANT_SIZE, h: PLANT_SIZE });
    row(g, items, 190, 14, findings);
  }

  // 4. depósitos, postes, árboles, costa
  {
    const g = section('varios', '4 · Depósitos de colectivo, postes, árboles y costa', 1450, 300);
    const items: Item[] = [];
    for (let c = 0; c < Math.min(6, BUS_COLORS.length); c++) items.push({ label: `depósito ${c}`, sp: busDepotPixelSprite(c), w: BUS_SIZE, h: BUS_SIZE });
    items.push({ label: 'poste madera', sp: polePixelSprite(0, 0) });
    items.push({ label: 'poste hormigón', sp: polePixelSprite(1, 0) });
    for (let k = 0; k < 4; k++) items.push({ label: `árbol ${k}`, sp: treePixelSprite(k, 0) });
    for (const k of ['fishing', 'promenade', 'port', 'resort', 'lighthouse'] as CoastKind[]) {
      items.push({ label: `costa ${k}`, sp: coastPixelSprite(k, 0) });
    }
    row(g, items, 190, 14, findings);
  }

  // 5. aeropuerto y puerto de paseos (instalación completa de nivel 1 y 2)
  {
    const g = section('hubs', '5 · Aeropuerto (3×2) y puerto de paseos (2×2), nivel 1 y 2', 760, 340);
    const items: Item[] = [];
    const view: HubView = { fw: 3, fh: 2, i: 0, j: 0, pw: 3, ph: 2 };
    for (const kind of ['airport', 'harbor'] as HubKind[]) {
      for (let lv = 1; lv <= 2; lv++) {
        const fw = HUBS[kind].w;
        const fh = HUBS[kind].h;
        items.push({ label: `${kind} n${lv}`, sp: hubPixelSprite(kind, lv, { ...view, fw, fh, pw: fw, ph: fh }), w: fw, h: fh });
      }
    }
    row(g, items, 240, 14, findings);
  }

  // 6. vehículos
  {
    const g = section('veh', '6 · Vehículos: auto/taxi/colectivo en 4 rumbos, lanchas, avión', 1240, 260);
    const items: Item[] = [];
    for (const kind of ['car', 'taxi', 'bus'] as const) {
      for (let dir = 0; dir < 4; dir++) items.push({ label: `${kind} ${dir}`, sp: carPixelSprite(kind, 3, dir) });
    }
    for (const kind of ['tour', 'fishing', 'cruise'] as const) items.push({ label: `lancha ${kind}`, sp: boatPixelSprite(kind, 0) });
    items.push({ label: 'avión n1', sp: planePixelSprite(1, 0) });
    items.push({ label: 'avión n2', sp: planePixelSprite(2, 0) });
    row(g, items, 150, 14, findings);
  }

  // 7. únicos con su huella marcada
  {
    const g = section('uniq', '7 · Únicos: dibujo sobre la huella real', 1290, 380);
    const items: Item[] = [];
    for (const k of Object.keys(UNIQUES) as UniqueKind[]) {
      const u = UNIQUES[k];
      items.push({ label: k, sp: uniqueSprite(k, u.w, u.h), w: u.w, h: u.h });
    }
    row(g, items, 280, 14, findings);
  }

  // 8. escenas de conexión
  {
    const g = section('escenas', '8 · Escenas de conexión: calle, campo, cochera, usina, hospital, cabildo', 1180, 560);
    const put = (sp: Sprite, x: number, y: number, ox: number, oy: number): void => {
      g.drawImage(sp.canvas, ox + (x - y) * 16 - sp.ax, oy + (x + y) * 8 - sp.ay);
    };
    const cell = (x: number, y: number, ox: number, oy: number, fill: string): void => {
      const sx = ox + (x - y) * 16;
      const sy = oy + (x + y) * 8;
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(sx + 16, sy + 8);
      g.lineTo(sx, sy + 16);
      g.lineTo(sx - 16, sy + 8);
      g.closePath();
      g.fillStyle = fill;
      g.fill();
      g.strokeStyle = '#00000022';
      g.stroke();
    };
    g.font = '11px monospace';
    g.fillStyle = '#cbd5e1';

    // a. calle con casas a los dos lados (veredas y puertas)
    g.fillText('a) casas contra la calle', 30, 30);
    for (let x = 0; x < 8; x++) {
      cell(x, 3, 30, 90, '#6b6b70');
      cell(x, 2, 30, 90, '#5d7a3a');
      cell(x, 4, 30, 90, '#5d7a3a');
    }
    for (let x = 0; x < 8; x++) {
      put(x < 3 ? residentialPixelSprite(1, x) : x < 6 ? residentialPixelSprite(3, x) : commercialPixelSprite(2, x), x, 2, 30, 90);
      put(residentialPixelSprite(2, x + 3), x, 4, 30, 90);
    }

    // b. campo: lote + silo + feria pegados
    g.fillText('b) lote 2×2 + silo 2×2 + feria 3×3 pegados', 420, 30);
    for (let y = 0; y < 3; y++) for (let x = 0; x < 2; x++) cell(x, y, 420, 150, '#8a7a44');
    for (let y = 0; y < 2; y++) for (let x = 2; x < 4; x++) cell(x, y, 420, 150, '#8a7a44');
    for (let y = 0; y < 3; y++) for (let x = 4; x < 7; x++) cell(x, y, 420, 150, '#8a7a44');
    put(farmPixelSprite('crecido'), 0, 0, 420, 150);
    put(siloPixelSprite(), 2, 0, 420, 150);
    put(marketPixelSprite(), 4, 0, 420, 150);

    // c. cochera con calle y vehículos encima
    g.fillText('c) cochera 2×2 + calle y vehículos', 30, 330);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 5; x++) cell(x, y, 30, 390, '#5d7a3a');
    for (let x = 0; x < 5; x++) cell(x, 2, 30, 390, '#6b6b70');
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) cell(x, y, 30, 390, '#6b6b70');
    put(busDepotPixelSprite(0), 0, 0, 30, 390);
    put(carPixelSprite('bus', 0, 0), 2, 2, 30, 390);
    put(carPixelSprite('car', 3, 0), 3, 2, 30, 390);

    // d. usina con postes y línea sobre la calle
    g.fillText('d) usina 2×2 + postes + línea', 480, 330);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) cell(x, y, 480, 390, '#5d7a3a');
    put(plantPixelSprite('coal'), 0, 0, 480, 390);
    for (let x = 0; x < 4; x++) {
      cell(x, 2, 480, 390, x === 1 ? '#7a6a3a' : '#6b6b70');
      if (x % 2 === 0) put(polePixelSprite(0, x), x, 2, 480, 390);
    }
    put(residentialPixelSprite(2, 1), 2, 3, 480, 390);

    // e. hospital 3×3 contra la calle
    g.fillText('e) hospital 3×3 + calle', 900, 330);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) cell(x, y, 900, 390, '#5d7a3a');
    for (let x = 0; x < 5; x++) cell(x, 3, 900, 390, '#6b6b70');
    put(servicePixelSprite('hospital'), 0, 0, 900, 390);
  }

  // 9. auditoría
  const pre = document.createElement('pre');
  pre.id = 'audit';
  pre.style.cssText = 'color:#e2e8f0;font:12px monospace;background:#0f1216;padding:12px;white-space:pre-wrap';
  pre.textContent = 'AUDITORÍA DE SANGRADO (px fuera de la huella; >2 reporta)\n' + (findings.length ? findings.join('\n') : 'sin sangrados fuera del margen');
  document.body.appendChild(pre);
}

void sheet();
