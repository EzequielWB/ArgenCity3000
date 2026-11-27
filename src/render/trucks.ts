/**
 * Las camionetas del chacarero: en el mes de cosecha llevan la cosecha del lote hasta la cadena, por
 * las calles de la red del camión (ver `truckNetwork` en `world/farms.ts`), y vuelven al lote. Una por
 * lote servido, poco más de un puñado: el campo es chico y la fila de camionetas tiene que leerse como
 * el camión que es, no como otro tránsito.
 *
 * Cada camioneta guarda **su propio trazo** —la fila de celdas de calle desde su lote hasta la cadena,
 * siguiendo el flujo de `truckFlow`— y rebota sobre él. Derivar el paso de la distancia al vuelo no
 * alcanza: de vuelta a casa, una celda de la red puede no tener vecino más lejos de la cadena, y la
 * camioneta quedaría rebotando en seco.
 *
 * Puramente visual: la plata la paga `settleHarvest` con las mismas reglas (`farmServida` decide quién
 * cosecha); la camioneta recorre el camino que hace eso posible, así el jugador ve por qué su lote
 * cosecha y el del al lado no.
 */
import { CROPS, ROAD_REACH } from '../config';
import { project, rotateDir, toView } from '../core/iso';
import { Rng } from '../core/rng';
import { farmServida, truckFlow } from '../world/farms';
import { TILE, type World } from '../world/world';
import { heightAt } from './traffic';
import { headingOf, truckPixelSprite } from './vehicleArt';
import type { MapRenderer } from './mapRenderer';

export interface Truck {
  /** Su trazo: los índices de celda de calle desde su lote hasta la cadena. */
  path: number[];
  /** El tramo del trazo que recorre. */
  leg: number;
  /** `1` va hacia la cadena (tramo creciente), `-1` vuelve al lote. */
  go: 1 | -1;
  /** La celda en la que anda (coordenadas de mundo). */
  x: number;
  y: number;
  /** Paso hacia la celda siguiente del trazo. */
  dx: number;
  dy: number;
  /** Progreso entre el centro de (x, y) y el de la siguiente, en [0, 1). */
  t: number;
  speed: number;
}

const DIRS: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

/** Una camioneta por lote servido, como mucho: cien lotes no hacen cien camionetas. */
export const MAX_TRUCKS = 16;
const LANE = 0.17;

export class Trucks {
  list: Truck[] = [];
  /** Cuántas cuadras separan cada celda de la red de la cadena; 0 en las que la tocan. */
  dist = new Int16Array(0);
  private rng: Rng;

  constructor(
    readonly world: World,
    seed: number,
  ) {
    this.rng = new Rng(seed);
  }

  /** Arma (o desarma) la flota: se llama después de cada edición y en cada cambio de mes. */
  refresh(month: number): void {
    const w = this.world;
    if (month !== CROPS.trigo.harvest || w.farms.length === 0) {
      this.list = [];
      return;
    }
    const { on, dist } = truckFlow(w);
    if (!on.some((v) => v)) {
      this.list = [];
      return;
    }
    this.dist = dist;
    const servidas = farmServida(w, on);
    const list: Truck[] = [];
    w.farms.forEach((farm, k) => {
      if (!servidas[k] || list.length >= MAX_TRUCKS) return;
      const start = this.spawnOf(farm.x, farm.y, on);
      if (!start) return;
      const path = this.pathToChain(start, on);
      const i = path[0];
      const n = w.n;
      const x = i % n;
      const y = (i - x) / n;
      // Mirando el primer tramo del trazo, para que no aparezca parada sin rumbo.
      const first = path[1] ?? i;
      const fx = first % n;
      const fy = (first - fx) / n;
      list.push({ path, leg: 0, go: 1, x, y, dx: fx - x, dy: fy - y, t: this.rng.next() * 0.9, speed: 0.9 + this.rng.next() * 0.4 });
    });
    this.list = list;
  }

  /** La calle de la red más cercana al lote, en hasta `ROAD_REACH` pasos, o null. */
  private spawnOf(x: number, y: number, on: Uint8Array): number | null {
    let best: number | null = null;
    let bestDist = Infinity;
    const w = this.world;
    for (let dy = -ROAD_REACH; dy <= ROAD_REACH; dy++) {
      for (let dx = -ROAD_REACH; dx <= ROAD_REACH; dx++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d > ROAD_REACH || d >= bestDist) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (!w.inBounds(nx, ny)) continue;
        const i = w.idx(nx, ny);
        if (w.tiles[i] !== TILE.ROAD || on[i] !== 1) continue;
        best = i;
        bestDist = d;
      }
    }
    return best;
  }

  /** El trazo del lote a la cadena: camina la red bajando la distancia hasta llegar a una celda que toca. */
  private pathToChain(start: number, on: Uint8Array): number[] {
    const w = this.world;
    const n = w.n;
    const path = [start];
    let i = start;
    while (this.dist[i] > 0) {
      const x = i % n;
      const y = (i - x) / n;
      let next = -1;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!w.inBounds(nx, ny)) continue;
        const j = w.idx(nx, ny);
        if (on[j] === 1 && this.dist[j] === this.dist[i] - 1) {
          next = j;
          break;
        }
      }
      if (next < 0) break; // la red cambió debajo: el trazo queda hasta acá y el refresh lo repara
      path.push(next);
      i = next;
    }
    return path;
  }

  update(dt: number): void {
    if (dt <= 0) return;
    const w = this.world;
    const n = w.n;
    for (const c of this.list) {
      c.t += c.speed * dt;
      while (c.t >= 1) {
        c.t -= 1;
        let next = c.leg + c.go;
        if (next < 0 || next >= c.path.length) {
          // Fin del trazo: en la cadena da la vuelta y vuelve al lote (y viceversa).
          c.go = (c.go === 1 ? -1 : 1) as 1 | -1;
          next = c.leg + c.go;
        }
        if (next < 0 || next >= c.path.length) break;
        const j = c.path[next];
        const x = j % n;
        const y = (j - x) / n;
        c.dx = x - c.x;
        c.dy = y - c.y;
        c.x = x;
        c.y = y;
        c.leg = next;
      }
    }
  }
}

/** Posición continua de la camioneta (centros de celda en +0.5), por la derecha como los autos. */
function position(c: Truck): [number, number] {
  return [c.x + 0.5 + c.dx * c.t - c.dy * LANE, c.y + 0.5 + c.dy * c.t + c.dx * LANE];
}

/** Las camionetas, dibujadas sobre las calles que recorren. */
export function drawTrucks(g: CanvasRenderingContext2D, trucks: Trucks, map: MapRenderer, visible: [number, number, number, number]): void {
  const w = trucks.world;
  const n = w.n;
  const [x0, y0, x1, y1] = visible;
  for (const c of trucks.list) {
    const [px, py] = position(c);
    const [vx, vy] = toView(px, py, map.rot, n + 1);
    const cvx = Math.min(n - 1, Math.max(0, Math.floor(vx)));
    const cvy = Math.min(n - 1, Math.max(0, Math.floor(vy)));
    const h = heightAt(w, map.rot, cvx, cvy, vx - cvx, vy - cvy);
    const [ox, oy] = project(vx, vy, h);
    const sx = ox + map.originX;
    const sy = oy + map.originY;
    if (sx < x0 - 16 || sx > x1 + 16 || sy < y0 - 16 || sy > y1 + 16) continue;
    const [rdx, rdy] = rotateDir(c.dx, c.dy, map.rot);
    const sprite = truckPixelSprite(headingOf(rdx, rdy));
    g.drawImage(sprite.canvas, Math.round(sx - sprite.ax), Math.round(sy - sprite.ay));
  }
}
