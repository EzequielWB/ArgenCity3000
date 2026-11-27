/**
 * El aviso de Dios, encima del mapa: el milagro en papel claro con oro (la aurora) y el castigo en
 * rojo hundido en bordó (la plaga). Vive en la columna de los avisos, junto a los toasts, entra
 * cayendo y se va solo: la noticia completa queda en el diario.
 */
import { escapeHtml } from './dom';

/** The sun of the miracle and the drought of the catastrophe, both drawn with the halo's own color. */
const ICONS = {
  good: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></svg>',
  bad: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M16 3a5 5 0 0 1-5 5H8a3 3 0 0 0 0 6h1l-3 7"/><circle cx="9" cy="20" r="1"/><circle cx="13" cy="6" r="1"/></svg>',
} as const;

/** How long the prompt stays on screen: it says more than a toast, so it gets more time. */
const DIVINE_MS = 6000;

/**
 * Shows one divine prompt. The headline (what came before the first `: `) becomes the title, in
 * Bungee: `Milagro en Villa Sin Nombre` up top and the rest underneath, like the mockup of
 * `odd/divino-mockups.html` (variant G2 for the miracle, M2 for the catastrophe).
 */
export function showDivine(text: string, kind: 'good' | 'bad'): void {
  const box = document.querySelector('#toasts');
  if (!box) return;
  const sep = text.indexOf(': ');
  const title = sep > 0 ? text.slice(0, sep) : text;
  const body = sep > 0 ? text.slice(sep + 2) : '';
  const el = document.createElement('div');
  el.className = `divine ${kind === 'good' ? 'g2' : 'm2'}`;
  el.innerHTML = `<span class="halo">${ICONS[kind]}</span><b class="tit">${escapeHtml(title)}</b><small>${escapeHtml(body)}</small>`;
  box.appendChild(el);
  setTimeout(() => el.remove(), DIVINE_MS);
}
