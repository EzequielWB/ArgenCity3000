/**
 * Which sprite families are drawn with the new pixel art.
 *
 * With no parameter every finished family is on, so the game looks the way the pass intends. The
 * switch stays a query parameter instead of a code edit, so both looks can be compared on the same
 * build: `?pixel=off` goes back to the art of always, and `?pixel=residencial`, `?pixel=comercial`,
 * `?pixel=industrial`, `?pixel=plazas`, `?pixel=calles`, `?pixel=tierra`, `?pixel=costa`, `?pixel=transporte`,
 * `?pixel=energia`, `?pixel=servicios`, `?pixel=arboles`, `?pixel=vehiculos` or
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
  | 'energia'
  | 'servicios'
  | 'arboles'
  | 'vehiculos';

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

/**
 * `off` on the page is not a list of families but the master switch already down: the families are
 * then all of them, waiting, so the button that brings the layer back does not have to choose.
 */
const switchedOff = asked !== null && (asked.has('off') || asked.has('nada'));
const families = switchedOff ? null : asked;

/**
 * The master switch of the whole layer: the button of the menu turns it off and on without a
 * reload, because reloading would throw away the city that is not saved. It starts from the page,
 * so `?pixel=off` opens with the layer already out, and the button brings it back from there.
 */
let master = !switchedOff;

/** Whether the layer is being drawn right now. */
export function pixelLayerOn(): boolean {
  return master;
}

export function setPixelLayer(on: boolean): void {
  master = on;
}

/** Takes the layer out, or puts it back. Returns the new state, for the button that calls it. */
export function togglePixelLayer(): boolean {
  master = !master;
  return master;
}

/** `true` when this family is drawn with the new pixel art. */
export function pixelArt(family: ArtFamily): boolean {
  if (!master) return false;
  if (families === null) return true;
  return families.has(family) || families.has('todo') || families.has('all');
}
