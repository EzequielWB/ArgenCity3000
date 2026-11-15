/** The little bubbles over a building that has a problem (see `buildingIssues`): a disc with a drawing of the trouble. */
import type { Issue } from '../sim/warnings';

const DISC: Record<Issue, string> = {
  power: '#c8392f',
  crime: '#33384f',
  health: '#f4f0e6',
  smoke: '#6b707a',
};

/** Draws the bubble of `issue` centred on (cx, cy), 9 px across. */
export function drawBubble(g: CanvasRenderingContext2D, issue: Issue, cx: number, cy: number): void {
  g.fillStyle = DISC[issue];
  g.beginPath();
  g.arc(cx, cy, 4.8, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.lineWidth = 0.8;
  g.stroke();
  if (issue === 'power') bolt(g, cx, cy);
  else if (issue === 'crime') masked(g, cx, cy);
  else if (issue === 'health') cross(g, cx, cy);
  else cloud(g, cx, cy);
}

/** A yellow lightning bolt. */
function bolt(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  g.fillStyle = '#ffd84a';
  g.beginPath();
  g.moveTo(cx + 0.8, cy - 3.2);
  g.lineTo(cx - 1.8, cy + 0.6);
  g.lineTo(cx - 0.1, cy + 0.6);
  g.lineTo(cx - 0.8, cy + 3.2);
  g.lineTo(cx + 1.8, cy - 0.6);
  g.lineTo(cx + 0.1, cy - 0.6);
  g.closePath();
  g.fill();
}

/** A head in a balaclava: dark wool, a strip of skin for the eyes, and the shoulders. */
function masked(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  g.fillStyle = '#0d0e14';
  g.beginPath();
  g.arc(cx, cy - 0.9, 2.2, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(cx, cy + 3.4, 3.2, 2, 0, Math.PI, 0);
  g.fill();
  g.fillStyle = '#e8c9a0';
  g.fillRect(cx - 1.6, cy - 1.5, 3.2, 1);
}

/** A red cross, the sign of a health post. */
function cross(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  g.fillStyle = '#d23a32';
  g.fillRect(cx - 1, cy - 3, 2, 6);
  g.fillRect(cx - 3, cy - 1, 6, 2);
}

/** A little cloud of smoke. */
function cloud(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  g.fillStyle = '#e9e9ee';
  g.beginPath();
  g.arc(cx - 1.4, cy + 0.4, 1.6, 0, Math.PI * 2);
  g.arc(cx + 0.4, cy - 0.8, 1.9, 0, Math.PI * 2);
  g.arc(cx + 1.8, cy + 0.5, 1.4, 0, Math.PI * 2);
  g.fill();
  g.fillRect(cx - 2.8, cy + 0.4, 5.6, 1.4);
}
