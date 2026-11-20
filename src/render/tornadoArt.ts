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

/** Los grises del embudo, de la boca de arriba a la base: casi negro, porque un tornado no es blanco. */
const FUNNEL = ['#2f3138', '#41444d', '#565a65', '#6e7380', '#878d9b'];
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
 * El embudo. Un cono angosto abajo y ancho arriba, pintado renglón por renglón.
 *
 * Lo que lo hace leer como algo que gira son las **bandas diagonales**: unas franjas más claras que suben
 * de un lado al otro mientras el tiempo corre. Sin ellas el cono es un triángulo gris; con el degradé de
 * tono por renglón y sin bandas, era una escalera.
 */
function funnel(g: CanvasRenderingContext2D, base: Pt, height: number, top: number, bottom: number, time: number): void {
  const spin = time * 0.02;
  const tilt = Math.sin(time * 0.0007) * 2;
  for (let k = 0; k < height; k++) {
    const t = k / height;
    // Se abre hacia arriba y se apoya angosto en el suelo, con el radio ondulado: un tornado no es un cono
    // de geometría, tiene panza y cintura.
    const waver = 1 + 0.16 * Math.sin(k * 0.62 + spin * 1.7);
    const half = ((bottom + (top - bottom) * t * t) / 2) * waver;
    const y = Math.round(base.y - height + k);
    // La silueta ondea: el embudo se inclina para un lado y para el otro mientras gira.
    const cx = base.x + tilt * (1 - t) + Math.sin(k * 0.34 + spin) * (0.8 + 2 * t);
    const x0 = Math.round(cx - half);
    const w = Math.max(2, Math.round(half * 2));
    // El cuerpo, de un gris medio que se aclara con la altura.
    const body = Math.min(FUNNEL.length - 1, 1 + Math.floor(t * 2));
    g.fillStyle = FUNNEL[body];
    g.fillRect(x0, y, w, 1);
    // Las bandas que suben por el cono: lo que hace que se lea el giro. Anchas y contrastadas, porque a un
    // píxel una banda suave no se ve.
    if (w > 4) {
      const at = (((k - Math.round(spin * 14)) % 10) + 10) % 10;
      if (at < 3) {
        g.fillStyle = FUNNEL[Math.min(FUNNEL.length - 1, body + 3)];
        g.fillRect(x0 + 1, y, w - 2, 1);
      }
    }
    // Los bordes: la cara que se va, oscura; la que viene, clara.
    g.fillStyle = FUNNEL[0];
    g.fillRect(x0, y, 1, 1);
    g.fillStyle = FUNNEL[Math.min(FUNNEL.length - 1, body + 2)];
    g.fillRect(x0 + w - 1, y, 1, 1);
  }
  // Los brazos de polvo que el embudo arrastra a los costados: dos arcos claros que se abren hacia afuera.
  for (const side of [-1, 1]) {
    for (let k = 0; k < 6; k++) {
      const t = k / 6;
      const r = 6 + t * 11;
      const a = time * 0.0016 * side + t * 1.1;
      g.globalAlpha = 0.5 * (1 - t);
      g.fillStyle = DUST[1 + (k % 2)];
      g.fillRect(Math.round(base.x + Math.cos(a) * r * side), Math.round(base.y - 2 - Math.sin(a) * r * 0.35), 2, 1);
    }
  }
  g.globalAlpha = 1;
}

/** La sombra y el polvo de la base: sin esto el embudo parece pegado sobre el mapa, no apoyado. */
function dust(g: CanvasRenderingContext2D, base: Pt, time: number): void {
  // La sombra, primero: una mancha oscura y ancha que ancla el embudo al suelo.
  g.globalAlpha = 0.3;
  g.fillStyle = '#1d2418';
  g.beginPath();
  g.ellipse(base.x, base.y + 1, 13, 6, 0, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  for (let k = 0; k < 3; k++) {
    const p = (time * 0.0012 + k * 0.33) % 1;
    const r = 2 + p * 9;
    const cx = base.x + Math.sin(k * 2.1 + time * 0.001) * (3 + p * 7);
    const cy = base.y - 1 - p * 3;
    g.fillStyle = DUST[Math.min(DUST.length - 1, Math.floor(p * DUST.length))];
    g.globalAlpha = (1 - p) * 0.55;
    g.beginPath();
    g.ellipse(cx, cy, r, r * 0.45, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

/** El tornado sobre el mapa, con el embudo y el polvo. `time` es el reloj del render, en milisegundos. */
export function drawTornado(g: CanvasRenderingContext2D, run: TornadoRun | null, w: World, map: MapRenderer, time: number): void {
  if (!run) return;
  const base = headOf(w, map, run);
  // Alto del embudo: dos lotes y medio. Más alto que el hospital de la ciudad y no lo tapa: un tornado se
  // ve, no se confunde con la arquitectura.
  const height = 42;
  // **El ancho se ve.** Es lo que el impuesto promedio decide y el jugador tiene que poder leerlo de un
  // vistazo: el tornado de la ciudad que no cobra entra gordo y el de la que cobra entra por una línea.
  const top = 12 + run.width * 4.5;
  const bottom = 3.5 + run.width * 1.4;
  dust(g, base, time);
  funnel(g, base, height, top, bottom, time);
}
