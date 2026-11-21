/**
 * The player's character, the Intendente: the names the start screen draws from and the
 * pieces of text that carry the name. An empty name (a save from before the name existed, or
 * a player who cleared the field) leaves every text as it always was.
 */

import { GOVERNMENTS, type GovernmentKind } from '../config';
import { formatMoney } from '../core/format';

/** Names the start screen draws from; short enough for the name field (32 characters). */
export const MAYOR_NAMES: readonly string[] = [
  'Norma Quiroga',
  'Elbio Fernández',
  'Mirta Sosa',
  'Oscar Benítez',
  'Graciela Ferreyra',
  'Rubén Aguirre',
  'Alicia Montenegro',
  'Hugo Paredes',
];

/** A name from the list; `random` returns a number in [0, 1). */
export function pickMayorName(random: () => number = Math.random): string {
  return MAYOR_NAMES[Math.min(MAYOR_NAMES.length - 1, Math.floor(random() * MAYOR_NAMES.length))];
}

/** "Intendente", or "Intendente Norma Quiroga" when the player gave a name. */
export function intendente(mayor: string): string {
  const name = mayor.trim();
  return name ? `Intendente ${name}` : 'Intendente';
}

export function foundingHeadline(city: string, mayor: string, party = '', government: GovernmentKind = 'democracia'): string {
  const who = party ? `${intendente(mayor)}, por el partido ${party}` : intendente(mayor);
  const base = `Se funda ${city}: el ${who} promete calles, luz y progreso`;
  const under = government === 'comunismo' ? 'el comunismo' : `una ${GOVERNMENTS[government].label.toLowerCase()}`;
  const aside = government === 'democracia' ? '' : ` La ciudad arranca bajo ${under}.`;
  return aside ? `${base}.${aside}` : base;
}

/** A poll before the election. */
export function pollHeadline(left: number, approval: number, mayor: string): string {
  return `Encuesta a ${left} meses de las urnas: el ${approval} % aprueba la gestión del ${intendente(mayor)}`;
}

/**
 * The election result. The win with a name uses "renueva el mandato", which reads the same for
 * any name (the Spanish for "re-elected" changes with gender and the Intendente's does not have to).
 */
export function electionHeadline(year: number, approval: number, won: boolean, mayor: string): string {
  const name = mayor.trim();
  if (won) {
    return name
      ? `Elecciones ${year}: ${name} renueva el mandato con el ${approval} % de los votos`
      : `Elecciones ${year}: el Intendente fue reelecto con el ${approval} % de los votos`;
  }
  return `Elecciones ${year}: el ${intendente(mayor)} perdió con el ${approval} % de los votos y deja la Municipalidad`;
}

/**
 * The "election" of a dictatorship: the calendar keeps its October, and the paper keeps publishing.
 * It is a joke with teeth — the vote count is a formality and the rivals are missing — because that
 * is what the regime is.
 */
export function dictatorHeadline(year: number, party: string, mayor: string): string {
  const winner = party ? `El partido ${party}` : `El ${intendente(mayor)}`;
  return `Acto eleccionario ${year}: ${winner} gana por amplia mayoría, después de que sus contrincantes desaparecieran`;
}

/**
 * Quién pone la plata de un hito, con el monto que **este** gobierno cobra de verdad.
 *
 * La dictadura y el comunismo no reciben un peso de la Provincia: decir que "la Provincia gira" un subsidio
 * que no llega es mentirle al jugador en el titular del diario y en el globo del próximo hito. Y el monto
 * tampoco es el nominal: la teocracia cobra la mitad, así que el número que se anuncia es la mitad del que
 * figura en la tabla de hitos.
 */
export function grantLine(government: GovernmentKind, grant: number): string {
  const paid = Math.round(grant * GOVERNMENTS[government].grants);
  if (paid <= 0) return government === 'dictadura' ? 'la Provincia no gira nada: lo paga el pueblo' : 'la Provincia no gira nada';
  const from = government === 'teocracia' ? 'la Iglesia' : 'la Provincia';
  return `${from} gira ${formatMoney(paid)}`;
}

/** El titular de un hito alcanzado: lo que se abrió y quién puso la plata (o quién no puso nada). */
export function milestoneHeadline(city: string, name: string, opens: string, government: GovernmentKind, grant: number): string {
  const line = grantLine(government, grant);
  return `${city} ya es ${name}: ${opens ? `se habilita ${opens} y ` : ''}${line}`;
}

/**
 * El día que se habilita el campo. Va en su propia línea y no dentro del titular del hito: en Ciudad pujante
 * entran siete cosas a la vez y el campo quedaba séptimo, detrás del puerto y la universidad. La segunda mitad
 * es la que importa —el jugador tiene que saber que el lote solo no cobra nada—.
 */
export const campoHeadline = (city: string): string =>
  `${city} ya puede sembrar: habilitaron los lotes de trigo, pero sin silo la cosecha se pierde y sin feria no se cobra`;

/** October under a theocracy: nobody votes, the city goes to Mass. */
export const misaHeadline = (year: number): string => `Misa mayor ${year}: la ciudad entera acompaña al Intendente en procesión y le agradece al cielo`;

/** What the paper publishes the day after that act: the second line is always worse than the first. */
export const DICTATOR_FOLLOWUPS: readonly string[] = [
  'Hallaron tres cuerpos en el río, aguas abajo de la costanera: la Policía dice que no tienen relación con el acto',
  'El principal opositor se fue del país y avisó que no piensa volver: su casa quedó vacía esa misma noche',
  'La comisaría informó que no hay denuncias por desapariciones: nadie denunció nada',
  'Un auto sin patente fue visto frente a la casa del concejal que pidió recuento; no se lo volvió a ver',
  'El diario aclara que las elecciones no estaban en el calendario, pero el acto se hizo igual y salió bien',
  'Los veedores internacionales felicitaron al gobierno y se retiraron antes del escrutinio',
];
