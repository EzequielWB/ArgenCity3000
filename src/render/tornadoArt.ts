/**
 * El tornado dibujado: el embudo que cruza el mapa y se lleva lo que toca.
 *
 * No va en el caché de chunks —se mueve y no es parte del terreno—, así que se pinta como los autos y los
 * barcos: arriba de todo, en cada frame, con el transform de la cámara. El recorrido lo da `sim/tornado.ts`,
 * el mismo módulo que decide qué se destruye, así que lo que se ve es exactamente lo que se lleva.
 *
 * La figura no es una silueta rellena sino una **pila de anillos**: cada uno es un disco con la cara de
 * arriba blanca, el canto en sombra y el borde oscuro. Leídos en columna, los anillos son el embudo; leídos
 * de a uno, son las vueltas del aire. Es lo que hace que se entienda de un vistazo y lo que se puede mover.
 */
import { project, toView } from '../core/iso';
import { tornadoCellsOf, type TornadoRun } from '../sim/tornado';
import type { World } from '../world/world';
import { heightAt } from './traffic';
import type { MapRenderer } from './mapRenderer';

/** La cara de arriba de cada anillo: lo que la luz toca de frente. */
const LIGHT = '#fbfdff';
/** El canto iluminado, un tono abajo. */
const MID = '#dde4ee';
/** El canto en penumbra. */
const SHADE = '#a9b5c6';
/** La sombra que cada anillo le deja al de abajo. */
const DARK = '#67728a';
/** El contorno: sin él, en blanco, el tornado se deshilacha contra el pasto. */
const EDGE = '#252b36';
/** El polvo de la base. */
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

/** Un disco de la pila: la cara de arriba blanca, el canto en sombra y el borde oscuro a los costados. */
function ring(g: CanvasRenderingContext2D, cx: number, y: number, half: number, tone: number): void {
  const w = Math.round(half * 2) + 2;
  const x0 = Math.round(cx - w / 2);
  const body = tone > 0.72 ? LIGHT : tone > 0.42 ? MID : SHADE;
  g.fillStyle = body;
  g.fillRect(x0, y, w, 2);
  g.fillStyle = LIGHT;
  g.fillRect(x0 + 1, y, w - 2, 1);
  g.fillStyle = SHADE;
  g.fillRect(x0 + 1, y + 2, w - 2, 1);
  g.fillStyle = DARK;
  g.fillRect(x0 + 2, y + 3, Math.max(1, w - 4), 1);
  g.fillStyle = EDGE;
  g.fillRect(x0, y, 1, 3);
  g.fillRect(x0 + w - 1, y, 1, 3);
}

/**
 * La boca: una elipse vista desde abajo, con el interior en sombra. Es el rasgo que dice "embudo": si la
 * punta de arriba se cierra, la pila de anillos es un árbol de Navidad.
 */
function mouthOf(g: CanvasRenderingContext2D, cx: number, y: number, half: number): void {
  const rx = Math.round(half * 0.96);
  const ry = Math.max(2, Math.round(half * 0.26));
  for (let k = -ry; k <= ry; k++) {
    const d = k / ry;
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - d * d)));
    if (w <= 0) continue;
    const yy = y + k;
    // Arriba el borde recibe la luz; el fondo es el hueco oscuro por donde baja el aire.
    g.fillStyle = k <= -ry + 1 ? LIGHT : k >= ry - 1 ? SHADE : k < 0 ? DARK : MID;
    g.fillRect(Math.round(cx - w), yy, w * 2 + 1, 1);
    if (k > -ry + 1) {
      g.fillStyle = DARK;
      g.fillRect(Math.round(cx - w) - 1, yy, 1, 1);
      g.fillRect(Math.round(cx + w) + 1, yy, 1, 1);
    }
  }
}

/**
 * El embudo: la pila de anillos, de la boca a la punta.
 *
 * El giro se ve porque cada anillo está **corrido** respecto del de arriba y del de abajo: el desfase es una
 * onda que viaja con el tiempo, así que la columna se retuerce y los anillos parecen subir. Un desplazamiento
 * parejo sería una columna quieta.
 */
function funnel(g: CanvasRenderingContext2D, base: Pt, height: number, mouth: number, time: number): void {
  const spin = time * 0.0042;
  const rMax = Math.max(4, mouth);
  // Los anillos se tocan: el paso es el alto de un anillo y medio, así la pila es un cuerpo y no una
  // escalera de barras flotantes.
  const rings = Math.round(height / 3.2);
  const gap = height / rings;
  const yTop = base.y - height;

  // De arriba hacia abajo: el anillo que sigue es más angosto y queda delante, así el contorno de cada uno
  // sobrevive en vez de quedar tapado por el cuerpo del de arriba.
  for (let i = 0; i < rings; i++) {
    const t = i / (rings - 1);
    // El ancho baja de la boca a la punta y se abre un poco en el suelo, donde el remolino agarra aire.
    // Cóncava: el vaso de arriba se mantiene ancho y la punta se afina rápido. Lineal da un triángulo.
    const r = rMax * (1 - 0.9 * Math.pow(t, 1.4)) * (1 + 0.14 * Math.sin(Math.PI * t));
    const sway = Math.sin(t * 5.4 + spin * 2.1) * rMax * 0.5 * t;
    const y = Math.round(yTop + i * gap + Math.sin(t * 5.2 + spin * 3.3) * 1.4);
    ring(g, base.x + sway, y, r, 1 - t * 0.5);
  }

  // La boca va última, arriba de todo.
  mouthOf(g, base.x + Math.sin(spin * 2.1) * rMax * 0.32, Math.round(yTop) - 1, rMax);
}

/** La sombra y el polvo de la base: sin esto el embudo parece pegado sobre el mapa, no apoyado. */
function dust(g: CanvasRenderingContext2D, base: Pt, rMax: number, time: number): void {
  g.globalAlpha = 0.26;
  g.fillStyle = '#1d2418';
  g.beginPath();
  g.ellipse(base.x, base.y + 1, 11, 4.5, 0, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  // El polvo que levanta la punta: un montículo bajo con dos volutas que trepan.
  const dustW = Math.round(rMax * 1.1);
  for (let k = 0; k < 4; k++) {
    const t = k / 3;
    const w = Math.round(dustW * (k === 0 ? 0.84 : 1 - t * 0.5) + Math.sin(k * 2.2 + time * 0.004) * 2);
    const x0 = Math.round(base.x - w / 2 + Math.sin(k * 1.7 + time * 0.002) * 2);
    g.fillStyle = DUST[Math.min(DUST.length - 1, 2 - Math.floor(t * 2))];
    g.fillRect(x0, Math.round(base.y - k), w, 1);
  }
}

/** El tornado sobre el mapa, con el embudo y el polvo. `time` es el reloj del render, en milisegundos. */
export function drawTornado(g: CanvasRenderingContext2D, run: TornadoRun | null, w: World, map: MapRenderer, time: number): Pt | null {
  if (!run) return null;
  const base = headOf(w, map, run);
  // Dos lotes y medio de alto: más que el hospital de la ciudad, para que se vea venir.
  const height = 78;
  // **El ancho se ve.** Lo decide el impuesto promedio: el tornado de la ciudad que cobra entra por una
  // línea y el de la que no cobra entra ancho.
  const mouth = 8 + run.width * 2.6;
  dust(g, base, mouth, time);
  funnel(g, base, height, mouth, time);
  return base;
}
