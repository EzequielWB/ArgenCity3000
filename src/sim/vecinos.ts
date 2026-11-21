/**
 * Los vecinos: las quejas de la ciudad con nombre, dirección y tiempo.
 *
 * No simula personas. Lee lo que el juego ya sabe de cada lote —`buildingIssues` para el problema,
 * `world.anger` para cuánto lo está sufriendo, `world.troubleMonths` para hace cuánto— y le pone una voz.
 * La regla que ordena todo: **el vecino que reclama es el que se va a ir**. Por eso las quejas que entran
 * son las mismas que suben el enojo (`unrest`), y la falta de salud o de escuela queda afuera: esa se paga
 * en aprobación, no en abandono.
 *
 * El nombre sale de `hash2(x, y, seed)`, que no toca el `rng` de la partida: el vecino de una manzana es el
 * mismo si el jugador recarga, y abrir el panel no cambia el rumbo de la simulación.
 */
import { VECINOS } from '../config';
import { hash2 } from '../core/rng';
import type { World } from '../world/world';
import { buildingIssues, type Unlocked } from './warnings';

/** Los problemas por los que un vecino reclama: los mismos que suben el enojo y vacían el lote. */
export const GRIPES = ['power', 'road', 'jam', 'crime', 'smoke'] as const;
export type Gripe = (typeof GRIPES)[number];

/** El orden de la lista cuando hay que elegir: primero lo que más rápido hace irse a la gente. */
const WEIGHT: Record<Gripe, number> = { power: 5, road: 5, crime: 4, smoke: 3, jam: 2 };

/** La queja de una tarjeta, según lo que está mal. Dos por problema: la variedad sin inflar el archivo. */
const SAYS: Record<Gripe, readonly [string, string]> = {
  power: [
    'La luz se corta todas las noches. Los chicos estudian con velas.',
    'Sin luz, la comida se echa a perder en la heladera y no hay con qué reponerla.',
  ],
  road: [
    'No hay calle. Cuando llueve el barro nos llega a las rodillas.',
    'Acá no llega ni el basurero: lo tenemos que sacar nosotros.',
  ],
  jam: ['Estamos dos horas para salir del barrio.', 'La bocina no para ni de noche.'],
  crime: ['Ya nos robaron tres veces en la esquina.', 'Nadie deja el auto en la calle.'],
  smoke: [
    'La fábrica tira humo todo el día y no podemos abrir las ventanas.',
    'El olor no se va ni con las ventanas cerradas.',
  ],
};

/** Cómo se nombra el problema cuando hay que contarlos de a muchos. */
const MANY: Record<Gripe, string> = {
  power: 'el mismo problema de la luz',
  road: 'la misma calle sin abrir',
  jam: 'el mismo atasco',
  crime: 'la misma inseguridad',
  smoke: 'el mismo humo',
};

/** Lo que dice el vecino cuando el problema se resolvió. */
const THANKS: Record<Gripe, string> = {
  power: 'Nos llegó la luz. Los chicos volvieron a estudiar con la lámpara.',
  road: 'Ya nos abrieron la calle: el colectivo entra hasta la esquina.',
  jam: 'Se destrabó la avenida. Ahora salgo del barrio en diez minutos.',
  crime: 'Con la comisaría en la esquina, se puede volver caminando.',
  smoke: 'Se terminó el humo: volvimos a tender la ropa afuera.',
};

const NOMBRES_F = [
  'Rosa', 'Marta', 'Alicia', 'Norma', 'Elsa', 'Mirta', 'Graciela', 'Silvia', 'Mónica', 'Susana',
  'Liliana', 'Claudia', 'Andrea', 'Carolina', 'Romina', 'Vanesa', 'Lucía', 'Camila', 'Micaela', 'Florencia',
];
const NOMBRES_M = [
  'Osvaldo', 'Jorge', 'Alberto', 'Carlos', 'Raúl', 'Mario', 'Oscar', 'Héctor', 'Rubén', 'Marcelo',
  'Gustavo', 'Daniel', 'Sergio', 'Pablo', 'Diego', 'Hernán', 'Martín', 'Sebastián', 'Lucas', 'Matías',
];
const APELLIDOS = [
  'Medina', 'Peralta', 'Quiroga', 'Ferreyra', 'González', 'Rodríguez', 'Fernández', 'López', 'Martínez',
  'Gómez', 'Sosa', 'Benítez', 'Acosta', 'Aguirre', 'Álvarez', 'Cáceres', 'Duarte', 'Escobar', 'Figueroa',
  'Giménez', 'Ledesma', 'Maidana', 'Núñez', 'Ojeda', 'Paredes', 'Ramírez', 'Salvatierra', 'Toledo', 'Vera',
  'Zalazar',
];

/** Quién vive en el lote: un nombre, y las iniciales para la cara de la tarjeta. */
export interface Vecino {
  name: string;
  initials: string;
}

/**
 * El vecino de una celda. Depende sólo de la celda y de la semilla de la partida: nadie se muda porque el
 * jugador miró el panel. Tres formas, para que un barrio no parezca un formulario: Doña, Don y la familia.
 */
export function vecinoOf(x: number, y: number, seed: number): Vecino {
  const apellido = APELLIDOS[Math.floor(hash2(x, y, seed ^ 0x1f) * APELLIDOS.length)];
  const kind = hash2(x, y, seed ^ 0x51);
  if (kind < VECINOS.familyShare) return { name: `La familia ${apellido}`, initials: apellido.slice(0, 1) };
  if (kind < VECINOS.familyShare + (1 - VECINOS.familyShare) / 2) {
    const nombre = NOMBRES_F[Math.floor(hash2(x, y, seed ^ 0x2b) * NOMBRES_F.length)];
    return { name: `Doña ${nombre} ${apellido}`, initials: nombre.slice(0, 1) + apellido.slice(0, 1) };
  }
  const nombre = NOMBRES_M[Math.floor(hash2(x, y, seed ^ 0x2b) * NOMBRES_M.length)];
  return { name: `Don ${nombre} ${apellido}`, initials: nombre.slice(0, 1) + apellido.slice(0, 1) };
}

/** La manzana de una celda, contando de a cuatro lotes por lado, y el lote dentro de ella. */
export function addressOf(w: World, x: number, y: number): { block: number; lot: number } {
  const cols = Math.ceil(w.n / 4);
  return {
    block: Math.floor(y / 4) * cols + Math.floor(x / 4) + 1,
    lot: (y % 4) * 4 + (x % 4) + 1,
  };
}

/** El código de byte con el que el mundo recuerda qué problema tenía un lote. */
export function gripCode(g: Gripe): number {
  return GRIPES.indexOf(g) + 1;
}

export function gripOfCode(code: number): Gripe | null {
  return code > 0 && code <= GRIPES.length ? GRIPES[code - 1] : null;
}

/**
 * La queja que corresponde a lo que la simulación llama `Cause`. `crisis`, `vacant` y todo lo que no sea un
 * problema del lote devuelven `null`: un vecino no reclama por el rumbo del país ni por la casa de al lado.
 */
export function gripOfCause(cause: string | null): Gripe | null {
  return cause !== null && (GRIPES as readonly string[]).includes(cause) ? (cause as Gripe) : null;
}

/** Un reclamo con todo lo que la tarjeta necesita para no tener que volver a mirar el mundo. */
export interface Complaint {
  i: number;
  x: number;
  y: number;
  grip: Gripe;
  who: Vecino;
  block: number;
  lot: number;
  anger: number;
  /** Meses que lleva con el problema: el «hace ocho meses», medido. */
  months: number;
  text: string;
}

/** Un agradecimiento: el lote que se arregló y hace cuánto. */
export interface Thanks {
  i: number;
  x: number;
  y: number;
  who: Vecino;
  block: number;
  lot: number;
  grip: Gripe;
  months: number;
  text: string;
}

export interface VecinosReport {
  list: Complaint[];
  /** Lo que quedó afuera de la lista, agrupado por problema. */
  more: { grip: Gripe; count: number; label: string }[];
  thanks: Thanks[];
  /** Cuántos lotes tienen algo mal ahora mismo, listados o no. */
  total: number;
}

/**
 * El informe del panel. Recorre la ciudad entera, se queda con los lotes que tienen un problema de los que
 * vacían y con enojo suficiente, ordena por lo que más apura una mudanza y corta en `VECINOS.listed`.
 */
export function vecinosReport(w: World, kinds: Unlocked, seed: number): VecinosReport {
  const complaints: Complaint[] = [];
  const thanks: Thanks[] = [];
  const counts = new Map<Gripe, number>();

  for (let i = 0; i < w.level.length; i++) {
    if (w.level[i] === 0 || w.abandoned[i] || w.fire[i]) continue;
    const x = i % w.n;
    const y = Math.floor(i / w.n);
    const { block, lot } = addressOf(w, x, y);
    if (w.troubleMonths[i] === 0) {
      // Sin problema ahora: puede ser un agradecimiento reciente.
      const fixed = w.fixedMonths[i];
      const grip = gripOfCode(w.troubleWhat[i]);
      if (grip && fixed >= 0 && fixed <= VECINOS.thanksFor) {
        thanks.push({ i, x, y, who: vecinoOf(x, y, seed), block, lot, grip, months: fixed, text: THANKS[grip] });
      }
      continue;
    }
    const grip = issueGrip(w, i, kinds);
    if (!grip) continue;
    if (w.anger[i] < VECINOS.angerMin) continue;
    counts.set(grip, (counts.get(grip) ?? 0) + 1);
    complaints.push({
      i,
      x,
      y,
      grip,
      who: vecinoOf(x, y, seed),
      block,
      lot,
      anger: w.anger[i],
      months: w.troubleMonths[i],
      text: '',
    });
  }

  const total = complaints.length;
  const sorted = complaints.sort(
    (a, b) => b.anger * WEIGHT[b.grip] - a.anger * WEIGHT[a.grip] || b.months - a.months || a.i - b.i,
  );
  const list = sorted.slice(0, VECINOS.listed);
  // La frase alterna según el lugar en la lista: con cuarenta quejas del mismo problema, dos frases elegidas
  // por hash caen repetidas y el panel parece un formulario.
  list.forEach((c, k) => (c.text = SAYS[c.grip][k % 2]));
  const more = [...counts.entries()]
    .map(([grip, count]) => ({
      grip,
      count: count - list.filter((c) => c.grip === grip).length,
      label: MANY[grip],
    }))
    .filter((m) => m.count > 0)
    .sort((a, b) => b.count - a.count);

  // El agradecimiento más nuevo primero: el que acaba de ver arreglado es el que más importa.
  thanks.sort((a, b) => a.months - b.months || a.i - b.i);
  // Dos vecinos agradeciendo con la misma frase es peor que uno solo.
  const unique: Thanks[] = [];
  for (const t of thanks) if (!unique.some((u) => u.text === t.text)) unique.push(t);
  return { list, more, thanks: unique.slice(0, VECINOS.thanksListed), total };
}

/** El problema del lote que un vecino nombraría, si es de los que lo hacen irse. */
function issueGrip(w: World, i: number, kinds: Unlocked): Gripe | null {
  for (const issue of buildingIssues(w, i, kinds)) {
    const grip = gripOfCause(issue);
    if (grip) return grip;
  }
  return null;
}

/** Cuántos lotes reclaman ahora: el número del botón del menú. */
export function vecinosCount(w: World): number {
  let n = 0;
  for (let i = 0; i < w.troubleMonths.length; i++) if (w.troubleMonths[i] > 0 && w.anger[i] >= VECINOS.angerMin) n++;
  return n;
}
