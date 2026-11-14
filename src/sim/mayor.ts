/**
 * The player's character, the Intendente: the names the start screen draws from and the
 * pieces of text that carry the name. An empty name (a save from before the name existed, or
 * a player who cleared the field) leaves every text as it always was.
 */

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

export function foundingHeadline(city: string, mayor: string): string {
  return `Se funda ${city}: el ${intendente(mayor)} promete calles, luz y progreso`;
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
