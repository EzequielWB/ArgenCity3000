/** Ficha de la usina nuclear (desechable): la nuclear junto a sus hermanas, sobre su huella.
 * La sirve `npm run dev` en /qa-nuclear.html. Todo el dibujo va en coordenadas de zoom (z). */
import { plantPixelSprite } from './src/render/pixelArt';
import type { Sprite } from './src/render/sprites';
import type { PlantKind } from './src/config';

const Z = 3; // zoom de toda la ficha

function ground(g: CanvasRenderingContext2D, sx: number, sy: number, w: number, h: number, fill = '#2f4a2a'): void {
  g.beginPath();
  g.moveTo(sx, sy);
  g.lineTo(sx + 16 * w, sy + 8 * w);
  g.lineTo(sx + 16 * (w - h), sy + 8 * (w + h));
  g.lineTo(sx - 16 * h, sy + 8 * h);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.strokeStyle = '#4a6a3a';
  g.stroke();
}

function card(g: CanvasRenderingContext2D, kind: PlantKind, label: string, sub: string, x: number, y: number, size: number): void {
  const sp: Sprite = plantPixelSprite(kind);
  const sx = x + 16 * size; // punta del rombo de la huella
  ground(g, sx, y, size, size);
  g.drawImage(sp.canvas, sx - sp.ax, y - sp.ay);
  g.fillStyle = '#e2e8f0';
  g.font = 'bold 10px monospace';
  g.textAlign = 'center';
  g.fillText(label, sx + 16 * (size - size), y + 8 * (size + size) + 22, 160);
  g.fillStyle = '#94a3b8';
  g.font = '8px monospace';
  g.fillText(sub, x + 16, y + 8 * (size + size) + 34);
}

const g = (document.getElementById('hoja') as HTMLCanvasElement).getContext('2d')!;
g.scale(Z, Z);
g.imageSmoothingEnabled = false;
g.fillStyle = '#0f172a';
g.fillRect(0, 0, 340, 760);

card(g, 'nuclear', 'Usina nuclear', '3×3 · 6.000 MW · sin humo · Metrópolis', 30, 128, 3);
card(g, 'coal', 'Usina térmica', '2×2 · 600 MW · humo 60', 30, 388, 2);
card(g, 'gas', 'Usina a gas', '2×2 · 600 MW · humo 18', 30, 560, 2);
