/** Style lab page: the scene in each style listed in `STYLES`. */
import { STYLES } from './main-styles';
import { drawScene } from './scene';

function render(scale: number): void {
  const root = document.querySelector('#lab')!;
  root.innerHTML = '';
  for (const st of STYLES) {
    const section = document.createElement('section');
    section.innerHTML = `<h2>${st.name}</h2><p>${st.desc}</p>`;
    const canvas = drawScene(st).toCanvas(scale);
    canvas.style.background = st.sky;
    canvas.id = `scene${st.id}`;
    section.appendChild(canvas);
    root.appendChild(section);
  }
}

let scale = 3;
document.querySelectorAll<HTMLButtonElement>('[data-scale]').forEach((b) =>
  b.addEventListener('click', () => {
    scale = Number(b.dataset.scale);
    document.querySelectorAll('[data-scale]').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
    render(scale);
  }),
);
render(scale);
