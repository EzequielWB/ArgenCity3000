/**
 * El tornado dibujado: el embudo que cruza el mapa y se lleva lo que toca.
 *
 * No va en el caché de chunks —se mueve y no es parte del terreno—, así que se pinta como los autos y los
 * barcos: arriba de todo, en cada frame, con el transform de la cámara. El recorrido lo da `sim/tornado.ts`,
 * el mismo módulo que decide qué se destruye, así que lo que se ve es exactamente lo que se lleva.
 */
import { project, toView } from '../core/iso';
import { tornadoCellsOf, type TornadoRun } from '../sim/tornado';
import type { World } from '../world/world';
import { heightAt } from './traffic';
import type { MapRenderer } from './mapRenderer';

/** Los tonos del cuerpo, del borde en sombra al centro iluminado. */
const BODY = ['#33363e', '#484c57', '#5f646f', '#79808d'];
/** El contorno: sin él el embudo no se separa del pasto. */
const EDGE = '#1e2026';
/** La nube de arriba, que es lo que hace que la figura se lea como un tornado y no como una torre. */
const CLOUD = ['#26282f', '#31343c', '#41454f', '#565a66'];
/** El polvo que levanta al tocar el suelo. */
const DUST = ['#8f7a5c', '#b09b7a', '#d3c3a4'];

interface Pt {
  x: number;
  y: number;
}

/** Dónde está el embudo en pantalla: la cabeza de la celda que está pisando. */
function headOf(w: World, map: MapRenderer, run: TornadoRun): Pt {
  const cells = tornadoCellsOf(run, w.n);
  const [cx, cy] = cells[Math.floor(cells.length / 2)] ?? [0, 0];
  const rot = map.rot;
  const n = w.n;
  const [vx, vy] = toView(cx + 0.5, cy + 0.5, rot, n + 1);
  const cvx = Math.min(n - 1, Math.max(0, Math.floor(vx)));
  const cvy = Math.min(n - 1, Math.max(0, Math.floor(vy)));
  const [ox, oy] = project(vx, vy, heightAt(w, rot, cvx, cvy, vx - cvx, vy - cvy));
  return { x: ox + map.originX, y: oy + map.originY };
}

/**
 * El embudo, de abajo hacia arriba: el polvo, el cono y la nube que lo pare.
 *
 * Cuatro cosas lo hacen legible a un píxel, y eran las cuatro que faltaban: los **lados lisos** —un ancho
 * que crece parejo, porque cualquier ondulación se lee como escalones y el resultado parece una pila de
 * platos—, el **contorno oscuro** de un píxel a cada lado, la **banda clara** que sube girando, y la **nube**
 * encima. Sin la nube, por más cono que haya, la figura es un embudo de laboratorio.
 */
function funnel(g: CanvasRenderingContext2D, base: Pt, height: number, top: number, bottom: number, time: number): void {
  const cloudH = Math.round(height * 0.3);
  const bodyH = height - cloudH + 3; // el cono entra tres píxeles en la nube: así no hay costura
  const spin = time * 0.012;

  // 1. El cono. Se pinta primero: la nube lo tapa por arriba y el polvo lo tapa por abajo.
  for (let k = 0; k < bodyH; k++) {
    const t = k / bodyH;
    const half = bottom + (top - bottom) * Math.pow(t, 1.7);
    const y = Math.round(base.y - bodyH + k);
    const w = Math.max(3, Math.round(half * 2) + 1);
    const x0 = Math.round(base.x - w / 2);
    // La banda clara que sube serpenteando: es el giro.
    const bx = base.x + Math.sin(k * 0.34 + spin) * half * 0.55;
    for (let i = 0; i < w; i++) {
      const nx = w === 1 ? 0 : (i / (w - 1)) * 2 - 1;
      // La cara del cilindro: el centro mira a la cámara y los bordes se van.
      let tone = 0.15 + 0.85 * Math.cos(nx * Math.PI * 0.5);
      if (Math.abs(x0 + i - bx) < 1.6 + w * 0.08) tone = 1;
      const idx = Math.max(0, Math.min(BODY.length - 1, Math.round(tone * (BODY.length - 1))));
      g.fillStyle = BODY[idx];
      g.fillRect(x0 + i, y, 1, 1);
    }
    g.fillStyle = EDGE;
    g.fillRect(x0 - 1, y, 1, 1);
    g.fillRect(x0 + w, y, 1, 1);
  }

  // 2. El polvo de la base: un montón bajo y ancho que ancla el embudo al suelo. Sin esto el cono termina
  // en una punta seca y el dibujo parece un embudo de cocina.
  for (let k = 0; k < 7; k++) {
    const t = k / 6;
    const w = Math.round((bottom * 2 + 10) * (1 - t * 0.45) + Math.sin(k * 2.2 + time * 0.003) * 2);
    const x0 = Math.round(base.x - w / 2 + Math.sin(k * 1.7 + time * 0.002) * 2);
    g.fillStyle = DUST[Math.min(DUST.length - 1, 2 - Math.floor(t * 2))];
    g.fillRect(x0, Math.round(base.y - k), w, 1);
    g.fillStyle = EDGE;
    g.fillRect(x0 - 1, Math.round(base.y - k), 1, 1);
    g.fillRect(x0 + w, Math.round(base.y - k), 1, 1);
  }

  // 3. La nube. Más ancha que la boca del cono, redondeada y en dos tonos: el borde de arriba recibe la luz
  // y el resto queda en sombra. Es lo que dice "tornado" y no "columna".
  const cloudW = Math.round(top * 2 + 14);
  for (let k = 0; k < cloudH; k++) {
    const t = cloudH === 1 ? 0.5 : k / (cloudH - 1);
    // El ancho de una elipse: la masa se abre en el medio y se cierra en los dos bordes.
    const swell = Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.42) / 0.72, 2)));
    let w = Math.round(cloudW * swell);
    // Los tres lóbulos: la nube no es un óvalo prolijo.
    if (k === 1 || k === cloudH - 2) w = Math.round(w * 0.72);
    const x0 = Math.round(base.x - w / 2 + Math.sin(k * 0.7 + time * 0.0008) * 1.5);
    const y = Math.round(base.y - bodyH - cloudH + k + 3);
    g.fillStyle = t < 0.3 ? CLOUD[3] : t < 0.55 ? CLOUD[2] : CLOUD[1];
    g.fillRect(x0, y, w, 1);
    g.fillStyle = EDGE;
    g.fillRect(x0 - 1, y, 1, 1);
    g.fillRect(x0 + w, y, 1, 1);
  }
}

/** La sombra y el polvo de la base: sin esto el embudo parece pegado sobre el mapa, no apoyado. */
function dust(g: CanvasRenderingContext2D, base: Pt, time: number): void {
  g.globalAlpha = 0.32;
  g.fillStyle = '#1d2418';
  g.beginPath();
  g.ellipse(base.x, base.y + 1, 14, 6, 0, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  for (let k = 0; k < 4; k++) {
    const p = (time * 0.0012 + k * 0.25) % 1;
    const r = 2 + p * 10;
    const cx = base.x + Math.sin(k * 2.1 + time * 0.001) * (3 + p * 8);
    const cy = base.y - 1 - p * 4;
    g.fillStyle = DUST[Math.min(DUST.length - 1, Math.floor(p * DUST.length))];
    g.globalAlpha = (1 - p) * 0.6;
    g.beginPath();
    g.ellipse(cx, cy, r, r * 0.45, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

/** El tornado sobre el mapa, con el embudo y el polvo. `time` es el reloj del render, en milisegundos. */
export function drawTornado(g: CanvasRenderingContext2D, run: TornadoRun | null, w: World, map: MapRenderer, time: number): Pt | null {
  if (!run) return null;
  const base = headOf(w, map, run);
  // Alto del embudo: dos lotes y medio. Más alto que el hospital de la ciudad y no lo tapa: un tornado se
  // ve, no se confunde con la arquitectura.
  const height = 50;
  // **El ancho se ve.** Es lo que el impuesto promedio decide y el jugador tiene que poder leerlo de un
  // vistazo: el tornado de la ciudad que no cobra entra gordo y el de la que cobra entra por una línea.
  const top = 8 + run.width * 3.6;
  const bottom = 2.5 + run.width * 1.1;
  dust(g, base, time);
  funnel(g, base, height, top, bottom, time);
  return base;
}
