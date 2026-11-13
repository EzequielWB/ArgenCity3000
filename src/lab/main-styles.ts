/** Candidate art directions for the style lab, and the one that was chosen. */
import { hex, type RGB } from '../render/pixel';
import type { Style } from './scene';

const h = (list: string[]): RGB[] => list.map(hex);

const BARRIO: Style = {
  id: 'A',
  name: 'A · Barrio',
  desc: 'Colores cálidos y vivos, contorno oscuro en edificios y árboles. Lectura rápida, aire de dibujo.',
  outline: hex('#3a2418'),
  dither: false,
  palette: null,
  sky: '#f3dfb8',
  grass: [hex('#6fae3c'), hex('#8cc94e'), hex('#4f8a2c')],
  water: [hex('#2f86c8'), hex('#7cc4ee')],
  sand: hex('#e6cf8f'),
  earth: hex('#a8703f'),
  asphalt: hex('#5a5560'),
  walk: hex('#cfc5b2'),
  dirt: hex('#b98a55'),
  walls: h(['#f2b9a8', '#f3dd8a', '#a9d6ea', '#f4efe2', '#bfe0b0']),
  roofTile: hex('#c9482c'),
  brick: hex('#d0683a'),
  mortar: hex('#e9c9a8'),
  sheet: hex('#9fb0b8'),
  concrete: hex('#bdb6a8'),
  glass: hex('#2b4a6b'),
  wood: hex('#6b3f22'),
  shutter: hex('#2f7a4a'),
  trunk: hex('#6b4a2e'),
  leaves: { jacaranda: hex('#9a6fd6'), tipa: hex('#a9c93e'), borracho: hex('#4f9a48'), eucalipto: hex('#7fa58a'), ombu: hex('#3f7f38'), alamo: hex('#5fa03c') },
};

const URBANA: Style = {
  ...BARRIO,
  id: 'B',
  name: 'B · Urbana',
  desc: 'Paleta sobria y apagada, sin contornos: el volumen sale de las sombras. Más seria, más "maqueta".',
  outline: null,
  sky: '#d9d6cc',
  grass: [hex('#7a9461'), hex('#8ea673'), hex('#647d50')],
  water: [hex('#4f7f9c'), hex('#86aec2')],
  sand: hex('#d8cba6'),
  earth: hex('#8f7458'),
  asphalt: hex('#4d4f55'),
  walk: hex('#b9b6ad'),
  dirt: hex('#a08a68'),
  walls: h(['#d6b7a6', '#d9c9a0', '#c0c9cf', '#efe9dc', '#c3cfb4']),
  roofTile: hex('#a8523c'),
  brick: hex('#b8704c'),
  mortar: hex('#d9c4ac'),
  sheet: hex('#8d979c'),
  concrete: hex('#aaa69c'),
  glass: hex('#35485a'),
  wood: hex('#5a4332'),
  shutter: hex('#4a6a58'),
  trunk: hex('#5c4a3a'),
  leaves: { jacaranda: hex('#8c7ab8'), tipa: hex('#9aa85a'), borracho: hex('#5f8a58'), eucalipto: hex('#869a8c'), ombu: hex('#4f7048'), alamo: hex('#6f8f50') },
};

const TRAMADO: Style = {
  ...BARRIO,
  id: 'C',
  name: 'C · Tramado',
  desc: 'Solo 28 colores y mucho tramado (puntitos alternados) para las sombras y las texturas. El más "de época".',
  dither: true,
  outline: hex('#1b1b2a'),
  sky: '#e9c9a8',
  palette: h([
    '#1b1b2a', '#3b2f2f', '#6b3f22', '#a8703f', '#d0683a', '#e9c9a8', '#f4efe2', '#c9482c',
    '#f3c84a', '#8cc94e', '#5a9a34', '#2f5f2a', '#2f86c8', '#1f4f8a', '#7cc4ee', '#9a6fd6',
    '#5a5560', '#9fb0b8', '#c9bfae', '#e87fa8', '#74acdf', '#6f5aa8', '#86907a', '#b98a55',
    '#f2b9a8', '#f3dd8a', '#a9d6ea', '#bfe0b0',
  ]),
};

/** Pushes a colour away from its grey: 1 leaves it as it is, more than 1 makes it more vivid. */
function saturate(c: RGB, k: number): RGB {
  const grey = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(grey + (v - grey) * k)));
  return [ch(c[0]), ch(c[1]), ch(c[2])];
}

/** A copy of a style with every colour saturated by `k`. */
function vivid(st: Style, k: number, id: string, name: string, desc: string): Style {
  const one = (c: RGB) => saturate(c, k);
  const many = <T extends RGB[]>(list: T) => list.map(one) as T;
  const leaves = Object.fromEntries(Object.entries(st.leaves).map(([key, c]) => [key, one(c)])) as Style['leaves'];
  return {
    ...st,
    id,
    name,
    desc,
    grass: many(st.grass),
    water: many(st.water),
    walls: many(st.walls),
    sand: one(st.sand),
    earth: one(st.earth),
    dirt: one(st.dirt),
    roofTile: one(st.roofTile),
    brick: one(st.brick),
    mortar: one(st.mortar),
    shutter: one(st.shutter),
    wood: one(st.wood),
    trunk: one(st.trunk),
    glass: one(st.glass),
    leaves,
  };
}

// Chosen direction (2026-11-13): B with 50 % more saturation. Asphalt, pavement, sheet metal and
// concrete stay grey on purpose, so the colour of the rest stands out.
export const STYLES = [vivid(URBANA, 1.5, 'B', 'B · Urbana, 50 % más saturada (elegida)', 'La dirección elegida: sin contornos, volumen por sombras, colores un 50 % más vivos que el B original.')];
void [BARRIO, TRAMADO];

/** The direction the user chose: B with 50 % more saturation. */
export const CHOSEN = STYLES[0]; // kept for reference: the other two directions of round 1
