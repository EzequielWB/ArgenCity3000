/**
 * El botón "Descargar local" del inicio: guarda el juego como PWA en el teléfono.
 *
 * En Android (y en la compu) el navegador avisa con `beforeinstallprompt` y el botón pide el
 * instalador de Chrome. En iPhone no existe ese aviso: la única vía es el menú Compartir, y ahí
 * el botón da la instrucción en vez de fingir. `whatIfNoPrompt` es la parte pura de esa decisión,
 * para poder probarla sin navegador.
 */

export type InstallEvent = {
  prompt(): Promise<void>;
};

/** The message the button shows when there is nothing to prompt: an instruction, never a lie. */
export function whatIfNoPrompt(ua: string): string {
  return /iphone|ipad|ipod/i.test(ua)
    ? 'En iPhone: botón Compartir → Agregar a pantalla de inicio'
    : 'Para instalar hace falta HTTPS (o localhost): el aviso del navegador no salió';
}

/** Wires the button to the browser's install prompt, and to the honest fallback when there is none. */
export function bindInstallButton(button: HTMLElement, prompt: (e: InstallEvent) => void, notify: (text: string) => void): void {
  let deferred: InstallEvent | null = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as unknown as InstallEvent;
  });
  button.addEventListener('click', () => {
    if (deferred) {
      const e = deferred;
      deferred = null;
      void prompt(e);
    } else {
      notify(whatIfNoPrompt(navigator.userAgent));
    }
  });
}
