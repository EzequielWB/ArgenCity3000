/**
 * Trucos de desarrollo: atajos para probar sin jugar una partida entera.
 *
 * Sólo existen en la versión local. `main.ts` los instala dentro de `import.meta.env.DEV`, así que el build
 * que se publica no los lleva ni como código muerto: Vite borra la rama entera.
 *
 * No inventan un mundo paralelo. Tocan lo que el juego ya usa —la caja, los niveles de los lotes, los
 * presupuestos, el enojo— y después piden `refresh()` para que los totales y la aprobación se recalculen como
 * en un mes cualquiera. Un truco que mostrara una cifra falsa no serviría para probar nada.
 */
import { MAX_FUNDING, MAX_LEVEL } from '../config';
import { cityTotals } from '../sim/demand';
import { zoneOf, type World } from '../world/world';
import type { Simulation } from '../sim/simulation';
import type { Game } from '../game';
import { toast } from './dom';

/** Lo mínimo que un truco necesita de una partida: así se puede probar sin levantar el juego entero. */
export type City = { world: World; sim: Simulation };

export type Cheat = {
  key: string;
  label: string;
  run: (game: Game) => string;
};

/** Cien mil de una: el sueldo de un mes bueno, para probar una compra grande. */
export function giveCash(sim: Simulation, amount = 100_000): string {
  sim.state.cash += amount;
  return `+$${amount.toLocaleString('es-AR')}`;
}

/**
 * Sube hasta sumar `target` habitantes, un nivel por lote y sin pasarse de largo.
 *
 * La población no es un número guardado: sale de los edificios, así que el truco hace crecer los edificios de
 * verdad. Subir una ciudad entera un nivel de una sumaba ocho mil vecinos de golpe; acá se corta al llegar.
 */
export function raisePopulation(game: City, target = 1000): string {
  const w = game.world;
  const sim = game.sim;
  const before = sim.totals.pop;
  // Se cuenta con la misma función que usa el juego después de cada lote: la tabla por nivel se queda corta
  // cuando la partida tiene mods de densidad, y contar sale más barato que refrescar la ciudad entera.
  for (let i = 0; i < w.tiles.length && cityTotals(w, sim.mods).pop - before < target; i++) {
    if (zoneOf(w.tiles[i]) !== 'R' || !w.isOccupied(i) || w.level[i] >= MAX_LEVEL) continue;
    w.level[i]++;
    w.markDirty(i);
  }
  sim.refresh();
  const gained = sim.totals.pop - before;
  return gained > 0 ? `+${gained.toLocaleString('es-AR')} vecinos` : 'no hay lotes donde crecer';
}

/** La barra de aprobación, al tope. El mes que viene vuelve a moverse sola hacia lo que la ciudad merece. */
export function maxApproval(sim: Simulation): string {
  sim.state.approval = 100;
  return 'Aprobación 100 %';
}

/** Borra el enojo de todos los lotes y el duelo por las demoliciones: la ciudad vuelve a estar en paz. */
export function clearGripes(game: City): string {
  const w: World = game.world;
  let lots = 0;
  for (let i = 0; i < w.tiles.length; i++) {
    if (w.anger[i] === 0 && w.troubleMonths[i] === 0 && w.abandoned[i] === 0) continue;
    w.anger[i] = 0;
    w.troubleMonths[i] = 0;
    w.abandoned[i] = 0;
    w.markDirty(i);
    lots++;
  }
  game.sim.state.grief = 0;
  game.sim.refresh();
  return lots > 0 ? `${lots} lotes sin quejas` : 'no había quejas';
}

/** Todos los presupuestos al máximo, que es lo que de verdad sube la aprobación. */
export function maxServices(sim: Simulation): string {
  const s = sim.state;
  for (const kind of Object.keys(s.funding) as (keyof typeof s.funding)[]) s.funding[kind] = MAX_FUNDING;
  s.green = MAX_FUNDING;
  s.transport = MAX_FUNDING;
  s.roads = MAX_FUNDING;
  s.plants = MAX_FUNDING;
  s.taxes = { ...s.taxes, R: 0, C: 0, I: 0 };
  sim.refresh();
  return 'Servicios al mango, impuestos en cero';
}

/** Los atajos, en el orden en que se muestran. */
export const CHEATS: readonly Cheat[] = [
  { key: '1', label: '+100k de plata', run: (g) => giveCash(g.sim) },
  { key: '2', label: '+1.000 vecinos', run: (g) => raisePopulation(g) },
  { key: '3', label: 'Aprobación al 100', run: (g) => maxApproval(g.sim) },
  { key: '4', label: 'Eliminar quejas', run: (g) => clearGripes(g) },
  { key: '5', label: 'Servicios al mango', run: (g) => maxServices(g.sim) },
];

/**
 * Escucha Shift + número y corre el truco. Devuelve la función para desengancharlo, que se llama al cambiar de
 * partida: si no, cada partida nueva sumaría otro oyente y un atajo correría dos veces.
 */
export function installCheats(game: Game): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (!e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target instanceof HTMLElement ? e.target : null;
    // Escribiendo el nombre de la ciudad, el 1 es un 1.
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    const digit = e.code.startsWith('Digit') ? e.code.slice(5) : e.code.startsWith('Numpad') ? e.code.slice(6) : '';
    const cheat = CHEATS.find((c) => c.key === digit);
    if (!cheat) return;
    e.preventDefault();
    toast(`Truco: ${cheat.run(game)}`);
    game.updateHud(true);
    game.refreshTraffic();
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}

/** Las teclas, para el cartel que las explica. */
export function cheatsHelp(): string {
  return CHEATS.map((c) => `Shift+${c.key} ${c.label}`).join(' · ');
}
