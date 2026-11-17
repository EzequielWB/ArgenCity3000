/**
 * Which sprite families are drawn with the new pixel art.
 *
 * With no parameter every finished family is on, so the game looks the way the pass intends. The
 * switch stays a query parameter instead of a code edit, so both looks can be compared on the same
 * build: `?pixel=off` goes back to the art of always, and `?pixel=residencial`, `?pixel=comercial`,
 * `?pixel=industrial`, `?pixel=plazas`, `?pixel=calles`, `?pixel=tierra`, `?pixel=costa`, `?pixel=transporte`, `?pixel=energia` or
 * `?pixel=todo` draw only the families named, so one piece can be judged on its own. Families can be
 * combined with commas.
 *
 * Outside a browser (tests, tools) nothing is switched on: the painters need a canvas.
 */
export type ArtFamily =
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'plazas'
  | 'calles'
  | 'tierra'
  | 'costa'
  | 'transporte'
  | 'energia';

const PARAM = 'pixel';

/** The families asked for on the page. `null` means "no parameter", which is every family. */
function requested(): Set<string> | null {
  if (typeof location === 'undefined') return new Set(['off']);
  const raw = new URLSearchParams(location.search).get(PARAM) ?? '';
  if (!raw.trim()) return null;
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

const asked = requested();

/** `true` when this family is drawn with the new pixel art. */
export function pixelArt(family: ArtFamily): boolean {
  if (asked === null) return true;
  if (asked.has('off') || asked.has('nada')) return false;
  return asked.has(family) || asked.has('todo') || asked.has('all');
}
