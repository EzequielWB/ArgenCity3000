/** Interface mock-up: fills in the pixel ornaments and the sample map, and switches the colour scheme. */
import { corner, divider, ribbon, toUrl } from './filete';
import { CHOSEN } from './main-styles';
import { drawScene } from './scene';

const root = document.documentElement;
root.style.setProperty('--corner', `url(${toUrl(corner())})`);
root.style.setProperty('--divider', `url(${toUrl(divider())})`);
root.style.setProperty('--ribbon', `url(${toUrl(ribbon())})`);

// The sample map: the chosen style, at 1x; CSS scales it with hard pixels to cover the map area.
const scene = drawScene(CHOSEN);
const map = scene.toCanvas(1);
map.id = 'mapCanvas';
const mapBox = document.querySelector<HTMLElement>('#map')!;
mapBox.prepend(map);

/** Scales the map by a whole number of pixels, the smallest one that covers the map area. */
function fitMap(): void {
  const scale = Math.max(2, Math.ceil(Math.max(mapBox.clientWidth / scene.w, mapBox.clientHeight / scene.h)));
  map.style.width = `${scene.w * scale}px`;
  map.style.height = `${scene.h * scale}px`;
}
new ResizeObserver(fitMap).observe(mapBox);
fitMap();

// Option switches: each group sets one data attribute of the body.
document.querySelectorAll<HTMLButtonElement>('[data-set]').forEach((b) =>
  b.addEventListener('click', () => {
    const key = b.dataset.set!;
    document.body.dataset[key] = b.dataset.value;
    document.querySelectorAll(`[data-set="${key}"]`).forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
  }),
);

// Full screen: the mock-up fills the tab, as the game would.
const fullBtn = document.querySelector<HTMLButtonElement>('#fullBtn')!;
const setFull = (on: boolean) => {
  document.body.classList.toggle('full', on);
  fullBtn.textContent = on ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa';
};
fullBtn.addEventListener('click', () => setFull(!document.body.classList.contains('full')));
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') setFull(false);
});

// Category buttons open their tools, one at a time.
document.querySelectorAll<HTMLButtonElement>('.cat').forEach((b) =>
  b.addEventListener('click', () => {
    const open = b.getAttribute('aria-expanded') === 'true';
    document.querySelectorAll('.cat').forEach((o) => o.setAttribute('aria-expanded', 'false'));
    b.setAttribute('aria-expanded', String(!open));
  }),
);

const PHRASES = [
  'Intendente que madruga, inaugura dos veces',
  'Donde hay asfalto, hay esperanza',
  'Mi ciudad no será grande, pero tiene plaza',
  'El que apura la obra, la paga dos veces',
  'Sin luz no hay tango',
];
let phrase = 0;
const phraseEl = document.querySelector('#phrase')!;
const nextPhrase = () => {
  phraseEl.textContent = `“${PHRASES[phrase++ % PHRASES.length]}”`;
};
nextPhrase();
phraseEl.addEventListener('click', nextPhrase);
