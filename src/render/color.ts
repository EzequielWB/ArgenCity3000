/** Color helpers working on "#rrggbb" and "rgb(r,g,b)" strings. */

export function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** Either format, so the result of a mix can go straight into another one. */
export function toRgb(color: string): [number, number, number] {
  return color.startsWith('#') ? hexToRgb(color) : (color.slice(4, -1).split(',').map(Number) as [number, number, number]);
}

export function rgb(r: number, g: number, b: number): string {
  const c = (x: number) => Math.max(0, Math.min(255, Math.round(x)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

/** Multiplies a color by f (f < 1 darkens, f > 1 lightens). */
export function shade(hex: string, f: number): string {
  const [r, g, b] = toRgb(hex);
  return rgb(r * f, g * f, b * f);
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = toRgb(a);
  const [r2, g2, b2] = toRgb(b);
  return rgb(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

export const PAL = {
  sand: '#dfcb94',
  grassLow: '#7da356',
  grassMid: '#749b4e',
  grassHigh: '#5e8340',
  /** Bare rock of the ranges, and the lighter stone of their crests. */
  rock: '#8f8b76',
  rockLight: '#b6b19d',
  earth: '#85623d',
  earthDark: '#61472d',
  water: '#3d85b0',
  waterDeep: '#37789e',
  foam: '#77b3d1',
  sidewalk: '#b9b6ad',
  asphalt: '#4d4f55',
  asphaltPaved: '#424449',
  asphaltBoulevard: '#3a3a3a',
  dirt: '#aa8956',
  /** The browns a dirt street alternates between, so no two neighbouring pieces match. */
  dirtShades: ['#aa8956', '#9c7248', '#92764a', '#ba9370'],
  dirtLight: '#c0af7f',
  dirtDark: '#92764a',
  dirtShadow: '#61472d',
  median: '#559148',
  lamp: '#ffd84a',
  marking: '#f7f6ea',
  concrete: '#a9a395',
  terracotta: '#c74625',
  brick: '#b6592a',
  brickDark: '#944822',
  glass: '#4e6476',
  glassDark: '#2b4761',
  door: '#5f3d25',
  chapa: '#9ea9af',
  chapaRust: '#9b6a54',
  zoneR: '#7cc06a',
  zoneC: '#6fb7e0',
  zoneI: '#e0b542',
  park: '#559148',
  parkDry: '#99ae39',
  path: '#d8c185',
  pathDry: '#c0af7f',
  pole: '#61472d',
  wire: '#2f2a26',
  smoke: '#d9d4cc',
} as const;
