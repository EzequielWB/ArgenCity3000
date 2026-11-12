export function $<T extends HTMLElement = HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing element ${selector}`);
  return el;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Short message at the top of the map. */
export function toast(text: string, bad = false): void {
  const box = document.querySelector('#toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = `toast${bad ? ' bad' : ''}`;
  el.textContent = text;
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild!.remove();
  setTimeout(() => el.remove(), bad ? 3200 : 2400);
}
