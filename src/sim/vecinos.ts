/**
 * Los vecinos: los llamados a la radio del barrio.
 *
 * No simula personas. Lee lo que el juego ya sabe de cada lote —`buildingIssues` para el problema,
 * `world.anger` para cuánto lo está sufriendo, `world.troubleMonths` para hace cuánto— y le pone una voz.
 * Dos reglas ordenan todo:
 *
 * 1. **El vecino que reclama es el que se va a ir.** Entran sólo las causas que suben el enojo (`unrest`);
 *    la falta de salud o de escuela queda afuera porque esa se paga en aprobación, no en abandono.
 * 2. **El que llama es el barrio, no el lote.** Las casas con el mismo problema que se tocan son un solo
 *    llamado; el portavoz es la más enojada del grupo. Con sesenta lotes sin luz, el panel mostraría
 *    sesenta quejas iguales — y el jugador las arregla con una sola obra.
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

/**
 * Cuánto duele cada problema, en meses de enojo. Ordena la lista cuando hay que elegir; el agrupado por
 * barrio lo usa para nada, porque cada llamado ya trae su propio enojo.
 */
export const WEIGHT: Record<Gripe, number> = { power: 5, road: 5, crime: 4, smoke: 3, jam: 2 };

/**
 * El escalón de indignación. Los cortes no son estéticos: caen donde el juego ya cambia de comportamiento,
 * así la frase que el vecino dice y el número que muestra el panel cuentan la misma historia.
 */
export type Heat = 'aguanta' | 'duele' | 'reproche' | 'seVa';

/** Abajo de 35 el barrio aguanta; arriba de 85 el lote ya está en cuenta regresiva. */
export function heatOf(anger: number): Heat {
  if (anger >= 85) return 'seVa';
  if (anger >= 60) return 'reproche';
  if (anger >= 35) return 'duele';
  return 'aguanta';
}

/**
 * Lo que dice el portavoz de cada llamado. Cuatro escalones por problema, dos frases por escalón: dos barrios
 * con el mismo problema y el mismo enojo no dicen lo mismo, y el mismo barrio empeora de boca a medida que
 * el enojo sube.
 */
const SAYS: Record<Gripe, Record<Heat, readonly [string, string]>> = {
  power: {
    aguanta: [
      'La luz se corta a la noche. Ya ni prendemos la tele.',
      'Cada tanto se va la luz un rato. Molesta, pero se aguanta.',
    ],
    duele: [
      'Otra noche a oscuras. Los chicos hacen la tarea con una vela.',
      'Se nos arruinó la comida de la heladera. Otra vez.',
    ],
    reproche: [
      'Pagamos las tasas todos los meses para esto. ¿A quién le rendís cuentas?',
      'Toda la cuadra tiene luz menos nosotros. Alguien se olvidó de este barrio.',
    ],
    seVa: [
      'Cuando el barrio quede vacío vas a venir a preguntar qué pasó.',
      'O nos das luz o nos vamos. Y ya estamos haciendo las valijas.',
    ],
  },
  road: {
    aguanta: ['Cuando llueve, el barro nos llega a las rodillas.', 'No hay vereda. Los chicos juegan en la tierra.'],
    duele: [
      'Acá no entra ni el colectivo. Caminamos hasta la ruta.',
      'La basura no la pasa nadie: la tenemos que llevar nosotros.',
    ],
    reproche: [
      'Somos vecinos de verdad, no un número en un mapa. Abrí la calle.',
      'Hace meses que pedimos la calle y nadie nos contesta.',
    ],
    seVa: [
      'Si no abrís esta calle, el barrio se vacía. Ya se fueron dos familias.',
      'Nos cansamos. La semana que viene empiezo a cargar el camión.',
    ],
  },
  jam: {
    aguanta: ['La avenida no se mueve. Una hora para salir del barrio.', 'A la mañana se arma una cola que no termina más.'],
    duele: ['La bocina no para ni de noche. No se puede dormir.', 'El colectivo tarda cuarenta minutos en pasar.'],
    reproche: [
      'Pago el auto con el laburo y lo uso para estar dos horas parado.',
      'El barrio creció y la avenida quedó igual de chica.',
    ],
    seVa: [
      'Esto no es tránsito, es un estacionamiento. Y nosotros pagando.',
      'Si no destrabás la avenida, me voy a vivir del otro lado.',
    ],
  },
  crime: {
    aguanta: ['No se puede volver caminando de noche.', 'Da miedo dejar el portón abierto.'],
    duele: [
      'Ya nos robaron dos veces en la esquina. Nadie deja el auto en la calle.',
      'A mi hija la siguieron dos cuadras. No la dejamos salir sola.',
    ],
    reproche: [
      'Acá no hay comisaría y todos lo saben. Hacemos la vista gorda o nos matamos.',
      'Pedimos una comisaría hace dos años y seguimos esperando.',
    ],
    seVa: [
      'Mis viejos no salen más. Si esto sigue así, esta cuadra se vacía.',
      'El que puede se va. El que no, se encierra.',
    ],
  },
  smoke: {
    aguanta: ['La fábrica tira humo todo el día. No podemos tender la ropa.', 'Hay un olor raro en el barrio desde que abrieron.'],
    duele: [
      'Los chicos tosen todo el invierno. El olor no se va ni cerrando las ventanas.',
      'Se nos mancha la ropa tendida y no hay cómo sacarlo.',
    ],
    reproche: [
      'Vendimos todo para venir acá y ahora no se puede ni respirar.',
      'El humo nos entra en la casa. Esto no es un barrio, es un tacho.',
    ],
    seVa: ['O se llevan la fábrica o nos llevamos nosotros.', 'No criamos a los chicos para que respiren esto. Nos vamos.'],
  },
};

/**
 * «Hace ocho meses que…»: lo que el portavoz pide, sin el tiempo. La pantalla del header arma la frase con
 * el tiempo medido del llamado, así lo que suena en la radio y lo que muestra el desplegable no se contradicen.
 */
export const NEED: Record<Gripe, string> = {
  power: 'no tenemos luz',
  road: 'no tenemos calle',
  jam: 'no se puede salir del barrio',
  crime: 'no se puede andar tranquilo',
  smoke: 'la fábrica nos llena de humo',
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

/** Quién vive en el lote: el nombre para la tarjeta y el nombre corto que usa la radio al presentarlo. */
export interface Vecino {
  name: string;
  initials: string;
  /** «Osvaldo» o «la flia. Quiroga»: lo que dice el presentador antes de la cita. */
  radio: string;
}

/**
 * El vecino de una celda. Depende sólo de la celda y de la semilla de la partida: nadie se muda porque el
 * jugador miró el panel. Tres formas, para que un barrio no parezca un formulario: Doña, Don y la familia.
 */
export function vecinoOf(x: number, y: number, seed: number): Vecino {
  const apellido = APELLIDOS[Math.floor(hash2(x, y, seed ^ 0x1f) * APELLIDOS.length)];
  const kind = hash2(x, y, seed ^ 0x51);
  if (kind < VECINOS.familyShare) {
    return { name: `La familia ${apellido}`, initials: apellido.slice(0, 1), radio: `la flia. ${apellido}` };
  }
  if (kind < VECINOS.familyShare + (1 - VECINOS.familyShare) / 2) {
    const nombre = NOMBRES_F[Math.floor(hash2(x, y, seed ^ 0x2b) * NOMBRES_F.length)];
    return { name: `Doña ${nombre} ${apellido}`, initials: nombre.slice(0, 1) + apellido.slice(0, 1), radio: nombre };
  }
  const nombre = NOMBRES_M[Math.floor(hash2(x, y, seed ^ 0x2b) * NOMBRES_M.length)];
  return { name: `Don ${nombre} ${apellido}`, initials: nombre.slice(0, 1) + apellido.slice(0, 1), radio: nombre };
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

/** Un llamado a la radio: el barrio entero, con la voz de su vecino más enojado. */
export interface Call {
  grip: Gripe;
  /** Cuántos lotes reclaman lo mismo y están pegados: el «30 vecinos». */
  count: number;
  /** El portavoz: el más enojado del grupo, el que está más cerca de irse. */
  who: Vecino;
  /** El lote del portavoz: a donde lleva `Ir`. */
  i: number;
  x: number;
  y: number;
  block: number;
  lot: number;
  /** El enojo del portavoz, que es el máximo del grupo: el del grupo no dice nada más. */
  anger: number;
  /** Los meses del portavoz con el problema. */
  months: number;
  heat: Heat;
  /** La cita, ya elegida entre las dos del escalón. */
  say: string;
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
  /** Los llamados, del más enojado al que menos, cortados en `VECINOS.listed`. */
  calls: Call[];
  thanks: Thanks[];
  /** Cuántos lotes reclaman ahora mismo, listados o no: el número del sticker. */
  total: number;
  /** Cuántos llamados hay en total, contando los que no entraron en la lista. */
  groups: number;
}

/**
 * El informe del panel. Recorre la ciudad entera, se queda con los lotes que tienen un problema de los que
 * vacían y con enojo suficiente, los agrupa por barrio y ordena los llamados por el enojo del portavoz.
 */
export function vecinosReport(w: World, kinds: Unlocked, seed: number): VecinosReport {
  const n = w.n;
  const len = w.level.length;
  // Primero, qué problema tiene cada lote que reclama. El agrupado necesita ver la grilla entera.
  const gripAt: (Gripe | null)[] = new Array(len).fill(null);
  const thanks: Thanks[] = [];
  let total = 0;

  for (let i = 0; i < len; i++) {
    if (w.level[i] === 0 || w.abandoned[i] || w.fire[i]) continue;
    const x = i % n;
    const y = Math.floor(i / n);
    if (w.troubleMonths[i] === 0) {
      // Sin problema ahora: puede ser un agradecimiento reciente.
      const fixed = w.fixedMonths[i];
      const grip = gripOfCode(w.troubleWhat[i]);
      if (grip && fixed >= 0 && fixed <= VECINOS.thanksFor) {
        const { block, lot } = addressOf(w, x, y);
        thanks.push({ i, x, y, who: vecinoOf(x, y, seed), block, lot, grip, months: fixed, text: THANKS[grip] });
      }
      continue;
    }
    const grip = issueGrip(w, i, kinds);
    if (!grip) continue;
    // El enojo es el mismo que usa `stepAnger` para decidir quién se va: el panel no inventa un umbral.
    if (w.anger[i] < VECINOS.angerMin) continue;
    gripAt[i] = grip;
    total++;
  }

  // Segundo, los llamados: cada manchón de lotes pegados con el mismo problema es un vecino que llama.
  const calls: Call[] = [];
  const seen = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    const grip = gripAt[i];
    if (!grip || seen[i]) continue;
    const stack = [i];
    seen[i] = 1;
    let lead = i;
    let count = 0;
    while (stack.length > 0) {
      const k = stack.pop() as number;
      count++;
      // El portavoz: el más enojado; a igual enojo, el que hace más meses que aguanta.
      if (w.anger[k] > w.anger[lead] || (w.anger[k] === w.anger[lead] && w.troubleMonths[k] > w.troubleMonths[lead])) {
        lead = k;
      }
      const kx = k % n;
      const ky = Math.floor(k / n);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = kx + dx;
          const ny = ky + dy;
          if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
          const j = ny * n + nx;
          if (seen[j] || gripAt[j] !== grip) continue;
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    const lx = lead % n;
    const ly = Math.floor(lead / n);
    const { block, lot } = addressOf(w, lx, ly);
    const anger = w.anger[lead];
    const heat = heatOf(anger);
    const say = SAYS[grip][heat][hash2(lx, ly, seed ^ 0x7c) < 0.5 ? 0 : 1];
    calls.push({
      grip,
      count,
      who: vecinoOf(lx, ly, seed),
      i: lead,
      x: lx,
      y: ly,
      block,
      lot,
      anger,
      months: w.troubleMonths[lead],
      heat,
      say,
    });
  }

  calls.sort((a, b) => b.anger - a.anger || b.count - a.count || b.months - a.months || a.i - b.i);

  // Tres barrios con el mismo problema y el mismo enojo caen juntos en la lista: elegir la frase por hash
  // los haría decir la misma en las tres filas. Se rota por par (problema, escalón) para que la repetición
  // no quede pegada, y el hash sólo decide por cuál de las dos se arranca.
  const turn = new Map<string, { start: number; nth: number }>();
  for (const c of calls) {
    const key = `${c.grip}|${c.heat}`;
    // La variante inicial la elige el hash del primer barrio del par; los siguientes alternan desde ahí.
    // Si cada uno eligiera su propio arranque, dos vecinos seguidos podían caer los dos en la misma frase.
    const slot = turn.get(key) ?? { start: hash2(c.x, c.y, seed ^ 0x7c) < 0.5 ? 0 : 1, nth: 0 };
    turn.set(key, { start: slot.start, nth: slot.nth + 1 });
    c.say = SAYS[c.grip][c.heat][(slot.start + slot.nth) % 2];
  }

  // El agradecimiento más nuevo primero: el que acaba de ver arreglado es el que más importa.
  thanks.sort((a, b) => a.months - b.months || a.i - b.i);
  // Dos vecinos agradeciendo con la misma frase es peor que uno solo.
  const uniqueThanks: Thanks[] = [];
  for (const t of thanks) if (!uniqueThanks.some((u) => u.text === t.text)) uniqueThanks.push(t);

  return {
    calls: calls.slice(0, VECINOS.listed),
    thanks: uniqueThanks.slice(0, VECINOS.thanksListed),
    total,
    groups: calls.length,
  };
}

/** El problema del lote que un vecino nombraría, si es de los que lo hacen irse. */
function issueGrip(w: World, i: number, kinds: Unlocked): Gripe | null {
  for (const issue of buildingIssues(w, i, kinds)) {
    const grip = gripOfCause(issue);
    if (grip) return grip;
  }
  return null;
}

/** Cuántos lotes reclaman ahora: el número del sticker de la radio. */
export function vecinosCount(w: World): number {
  let n = 0;
  for (let i = 0; i < w.troubleMonths.length; i++) if (w.troubleMonths[i] > 0 && w.anger[i] >= VECINOS.angerMin) n++;
  return n;
}
