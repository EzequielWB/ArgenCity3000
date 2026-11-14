/** Sayings in the manner of the ones painted on buses and carts, about running a town. */
export const PHRASES: readonly string[] = [
  'Intendente que madruga, inaugura dos veces',
  'Donde hay asfalto, hay esperanza',
  'Mi ciudad no será grande, pero tiene plaza',
  'El que apura la obra, la paga dos veces',
  'Sin luz no hay tango',
  'Calle sin bache, vecino sin queja',
  'La caja en rojo no corta cintas',
  'Primero la usina, después el discurso',
  'Plaza chica, corazón grande',
  'Quien zonifica con apuro, demuele con paciencia',
  'Al humo, mandalo lejos de la ropa tendida',
  'Impuesto alto, vereda vacía',
  'Lo que no cubre la salita, lo cuenta el diario',
  'Octubre no perdona al que se olvidó del barrio',
  'Más vale un semáforo a tiempo que una avenida tarde',
  'El vecino no pide mucho: luz, calle y que lo saluden',
];

/**
 * Index of the phrase to show after `current` (-1 when none is showing): any other one, picked
 * with `random`, so the same phrase never comes up twice in a row.
 */
export function nextPhrase(current: number, count: number, random: () => number = Math.random): number {
  if (count <= 1) return 0;
  if (current < 0 || current >= count) return Math.min(count - 1, Math.floor(random() * count));
  const step = 1 + Math.min(count - 2, Math.floor(random() * (count - 1)));
  return (current + step) % count;
}
