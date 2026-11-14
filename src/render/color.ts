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
  sand: '#e2cc94',
  grassLow: '#a7b75a',
  grassMid: '#8fa64c',
  grassHigh: '#9a9450',
  /** Bare rock of the ranges, and the lighter stone of their crests. */
  rock: '#8f8b76',
  rockLight: '#b6b19d',
  earth: '#7a5236',
  earthDark: '#5a3a26',
  water: '#4f8fb0',
  waterDeep: '#3d7598',
  foam: '#cfe6ec',
  sidewalk: '#cbbfa8',
  asphalt: '#55545a',
  asphaltPaved: '#403f47',
  asphaltBoulevard: '#34333b',
  dirt: '#a07c52',
  /** The browns a dirt street alternates between, so no two neighbouring pieces match. */
  dirtShades: ['#a07c52', '#92704a', '#ad865a', '#86663f'],
  dirtLight: '#bf9764',
  dirtDark: '#7a5a38',
  dirtShadow: '#5f4328',
  median: '#5f8f4a',
  lamp: '#ffd84a',
  marking: '#f2e7b6',
  concrete: '#b9b2a4',
  terracotta: '#b4532f',
  brick: '#b36a45',
  brickDark: '#8f4f33',
  glass: '#7fb6cf',
  glassDark: '#3f6f86',
  door: '#5b3b26',
  chapa: '#9aa3a6',
  chapaRust: '#9b6a54',
  zoneR: '#7cc06a',
  zoneC: '#6fb7e0',
  zoneI: '#e0b542',
  park: '#7fb55a',
  parkDry: '#a8a05c',
  path: '#e3d2a6',
  pathDry: '#cdbd93',
  pole: '#6b4a2e',
  wire: '#2f2a26',
  smoke: '#d9d4cc',
} as const;
