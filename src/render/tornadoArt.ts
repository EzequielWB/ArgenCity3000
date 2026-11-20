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
const BODY = ['#33363e', '#4b4f5b', '#636875', '#7d8492'];
/** El contorno: sin él el embudo no se separa del pasto. */
const EDGE = '#1b1d23';
/** La nube que lo pare, del borde iluminado de arriba a la panza en sombra. */
const CLOUD = ['#2a2d35', '#3a3e48', '#4c515c', '#656a76'];
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
 * El radio del embudo a la altura `t` (0 en el suelo, 1 en la nube), en fracción de la boca.
 *
 * La forma es la de un tornado y no la de una seta: **ancho arriba** donde se funde con la nube, una
 * **cintura** fina arriba del polvo, y el **remolino** que se vuelve a abrir en el suelo. Al revés —fino
 * arriba, ancho abajo— el dibujo es un hongo atómico por más que tenga contorno y bandas.
 */
function radiusAt(t: number): number {
  // Punta fina, apertura pareja hacia la nube y una cintura apenas marcada. El ancho del remolino de abajo
  // lo pone el polvo, no el cono: si el cono se abre en el suelo, la figura es un pedestal.
  const open = 0.34 + 0.66 * Math.pow(t, 1.7) - 0.2 * Math.sin(Math.PI * t);
  return Math.max(0.18, open);
}

/**
 * El embudo, de abajo hacia arriba: el cono, el polvo de la base y la nube que lo pare.
 *
 * Lo que lo hace legible a un píxel, y eran las cuatro cosas que faltaban: la **silueta de doble curva**,
 * el **contorno oscuro** de un píxel a cada lado, las **bandas diagonales** que suben girando —sin ellas es
 * una columna gris— y la **nube de tres lóbulos con la panza rasgada** encima. Sin la nube, por más cono que
 * haya, la figura es un embudo de laboratorio.
 */
function funnel(g: CanvasRenderingContext2D, base: Pt, height: number, mouth: number, time: number): void {
  const cloudH = Math.max(6, Math.round(height * 0.1));
  const bodyH = height - cloudH + 10; // el cono sube diez píxeles dentro de la nube: así la atraviesa
  const spin = time * 0.01;
  const rMax = Math.max(4, mouth);

  // 1. La nube, primero: el embudo se pinta encima y la cruza. Si la nube fuera después, su panza quedaría
  // como una línea recta sobre el cono y la figura entera se leería como un hongo con tallo.
  cloud(g, base, bodyH, cloudH, rMax, time, base.x + Math.sin(spin * 0.6 + 1.9) * rMax * 0.34);

  // 2. El cono.
  for (let k = 0; k < bodyH; k++) {
    // `k` cuenta desde la boca hacia abajo; `t` al revés, de 0 en la punta a 1 en la nube.
    const t = 1 - k / (bodyH - 1);
    const r = rMax * radiusAt(t);
    // El doblado: la columna no baja derecha, se mece. Es media lectura del dibujo.
    const cx = base.x + Math.sin(spin * 0.6 + t * 1.9) * rMax * 0.34 * t;
    const y = Math.round(base.y - bodyH + k);
    const w = Math.max(3, Math.round(r * 2) + 1);
    const x0 = Math.round(cx - w / 2);
    // La banda clara: sube en espiral, así que en cada fila cae en otro lado. Es el giro.
    const band = cx + Math.sin(t * 7.5 + spin * 2.4) * r * 0.72;
    const bandW = Math.max(1, r * 0.5);
    for (let i = 0; i < w; i++) {
      const nx = w === 1 ? 0 : (i / (w - 1)) * 2 - 1;
      // La cara del cilindro: el centro mira a la cámara y los bordes se van.
      let tone = 0.2 + 0.8 * Math.cos(nx * Math.PI * 0.5);
      if (Math.abs(x0 + i - band) < bandW) tone = 1;
      // Estrías: por dentro del cilindro, bandas más oscuras que giran con la clara.
      else if (Math.sin(t * 16 + spin * 3.1 + nx * 1.2) > 0.72) tone = Math.max(0, tone - 0.4);
      const idx = Math.max(0, Math.min(BODY.length - 1, Math.round(tone * (BODY.length - 1))));
      g.fillStyle = BODY[idx];
      g.fillRect(x0 + i, y, 1, 1);
    }
    // El contorno sólo hasta donde la nube lo tapa: arriba el embudo se funde con ella.
    if (y > base.y - bodyH + cloudH * 0.4) {
      g.fillStyle = EDGE;
      g.fillRect(x0 - 1, y, 1, 1);
      g.fillRect(x0 + w, y, 1, 1);
    }
  }

  // 3. El polvo de la base: un remolino achatado y ancho que ancla el embudo al suelo. Sin esto el cono
  // termina en una punta seca y el dibujo parece un embudo de cocina.
  const dustW = Math.round(rMax * 2.9);
  for (let k = 0; k < 7; k++) {
    const t = k / 6;
    // La primera fila es más corta que la segunda: si la base es la más ancha, el polvo arranca con una
    // barra recta sobre el pasto y se lee como una tabla.
    const base0 = k === 0 ? 0.8 : 1;
    const w = Math.round(dustW * base0 * (1 - t * 0.5) + Math.sin(k * 2.2 + time * 0.004) * 2);
    const x0 = Math.round(base.x - w / 2 + Math.sin(k * 1.7 + time * 0.002) * 2.5);
    g.fillStyle = DUST[Math.min(DUST.length - 1, 2 - Math.floor(t * 2.4))];
    g.fillRect(x0, Math.round(base.y - k), w, 1);
  }
  // Las volutas: dos brazos de polvo que suben enroscándose a los costados de la punta. Sin ellos el
  // remolino es una franja plana en el piso y el embudo parece apoyado como un clavo.
  const spin2 = Math.sin(time * 0.003);
  for (const side of [-1, 1]) {
    const bx = base.x + side * (rMax * 0.72 + spin2 * 2);
    for (let k = 0; k < 5; k++) {
      const w = Math.max(1, 4 - Math.floor(k / 2));
      const x = Math.round(bx + side * (k * 1.4 + 1) - (side < 0 ? w : 0));
      g.fillStyle = DUST[Math.min(DUST.length - 1, 2 - Math.floor(k / 3))];
      g.fillRect(x, Math.round(base.y - 1 - k), w, 1);
    }
  }
}

/**
 * La nube que pare el embudo: una banda baja y deshilachada que apenas sobresale de la boca.
 *
 * Una masa redondeada encima del cono es un sombrero, y un sombrero sobre un tallo es un hongo: por eso la
 * nube no es más ancha que el cono por más de unos píxeles, y su borde de arriba no es un arco cerrado sino
 * tres lomas chicas con jirones sueltos. Lo que hace de tornado es la trompa, no la nube.
 */
function cloud(g: CanvasRenderingContext2D, base: Pt, bodyH: number, cloudH: number, rMax: number, time: number, cxTop: number): void {
  const cx = cxTop + Math.sin(time * 0.0007) * 2;
  const cy = base.y - bodyH - cloudH * 0.2;
  const halfW = Math.min(30, rMax + 7);
  for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
    const edge = Math.min(1, Math.abs(x - cx) / halfW);
    // Tres lomas: la del medio más alta, y las de los costados cayendo.
    const loma = cloudH * (0.86 * Math.cos(edge * Math.PI * 0.5) + 0.24 * Math.abs(Math.sin(x * 0.55 + time * 0.0006)));
    const up = Math.round(loma);
    if (up <= 0) continue;
    const down = Math.round(cloudH * (0.12 + 0.34 * edge));
    const from = cy - up;
    const to = cy + down;
    for (let y = Math.round(from); y <= Math.round(to); y++) {
      const f = (y - from) / Math.max(1, to - from);
      const tone = f < 0.26 ? CLOUD[3] : f < 0.52 ? CLOUD[2] : f < 0.78 ? CLOUD[1] : CLOUD[0];
      g.fillStyle = tone;
      g.fillRect(x, y, 1, 1);
    }
    // Los jirones: uno de cada tres píxeles del borde de arriba se escapa un renglón más, y la nube deja de
    // tener un contorno limpio contra el cielo.
    if ((x + Math.round(time / 120)) % 3 === 0) {
      g.fillStyle = CLOUD[2];
      g.fillRect(x, Math.round(from) - 1, 1, 1);
    }
  }
}

/** La sombra y el polvo de la base: sin esto el embudo parece pegado sobre el mapa, no apoyado. */
function dust(g: CanvasRenderingContext2D, base: Pt, time: number): void {
  g.globalAlpha = 0.26;
  g.fillStyle = '#1d2418';
  g.beginPath();
  g.ellipse(base.x, base.y + 1, 11, 4.5, 0, 0, Math.PI * 2);
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
  const height = 86;
  // **El ancho se ve.** Es lo que el impuesto promedio decide y el jugador tiene que poder leerlo de un
  // vistazo: el tornado de la ciudad que no cobra entra gordo y el de la que cobra entra por una línea.
  const mouth = 6 + run.width * 3.1;
  dust(g, base, time);
  funnel(g, base, height, mouth, time);
  return base;
}
