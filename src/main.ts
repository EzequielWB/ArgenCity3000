import './ui/style.css';
import { MAP_SIZE } from './config';
import { hashString } from './core/rng';
import { Game } from './game';
import { paintTerrainPreview } from './render/minimap';
import type { SaveData } from './save/save';
import { newSimState } from './sim/simulation';
import { $, toast } from './ui/dom';
import { closeModal, initModal, isModalOpen, openBudget, openHelp, openSaves } from './ui/panels';
import { generateTerrain } from './world/terrain';
import { TOOLS } from './world/tools';
import { World } from './world/world';

const CITY_NAMES = [
  'Villa Esperanza',
  'San Ombú del Plata',
  'Puerto Jacarandá',
  'Villa Mate Cocido',
  'Lomas de Gardelito',
  'Barrio Las Medialunas',
  'Villa Truco',
  'San Bandoneón',
  'Paraje El Asado',
  'Pampa Linda',
  'Villa Dulce de Leche',
  'General Alfajor',
];

let game: Game | null = null;

function randomSeed(): number {
  return 100000 + Math.floor(Math.random() * 900000);
}

function parseSeed(text: string): number {
  const t = text.trim();
  if (/^\d{1,9}$/.test(t)) return Number(t);
  return hashString(t || 'argencity') % 1_000_000_000;
}

// ---------------------------------------------------------------- start screen

let previewTimer = 0;
function refreshPreview(): void {
  clearTimeout(previewTimer);
  previewTimer = window.setTimeout(() => {
    paintTerrainPreview($<HTMLCanvasElement>('#startMap'), generateTerrain(parseSeed($<HTMLInputElement>('#startSeed').value), MAP_SIZE));
  }, 120);
}

function showStart(): void {
  game?.destroy();
  game = null;
  closeModal();
  $('#app').classList.add('hidden');
  $('#start').classList.remove('hidden');
  const name = $<HTMLInputElement>('#startName');
  name.value = CITY_NAMES[Math.floor(Math.random() * CITY_NAMES.length)];
  $<HTMLInputElement>('#startSeed').value = String(randomSeed());
  refreshPreview();
  name.focus();
  name.select();
}

function launch(data: SaveData): void {
  game?.destroy();
  $('#start').classList.add('hidden');
  $('#app').classList.remove('hidden');
  game = new Game(data, { isModalOpen });
  if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;
  if (data.sim.tick === 0) toast(`¡Bienvenido, Intendente! Empezá por una usina (9) y unas calles (3).`);
  else toast(`Partida cargada: ${data.name}`);
}

function startNew(): void {
  const name = $<HTMLInputElement>('#startName').value.trim() || 'Villa Sin Nombre';
  const seed = parseSeed($<HTMLInputElement>('#startSeed').value);
  const world = new World(generateTerrain(seed, MAP_SIZE));
  launch({ name, seed, world, sim: newSimState(seed) });
}

$('#startReroll').addEventListener('click', () => {
  $<HTMLInputElement>('#startSeed').value = String(randomSeed());
  refreshPreview();
});
$('#startSeed').addEventListener('input', refreshPreview);
$('#startNew').addEventListener('click', startNew);
$('#startLoad').addEventListener('click', () => openSaves(null, launch));
$('#startName').addEventListener('keydown', (e) => {
  if ((e as KeyboardEvent).key === 'Enter') startNew();
});

// ---------------------------------------------------------------- top bar

$('#btnBudget').addEventListener('click', () => game && openBudget(game));
$('#btnSave').addEventListener('click', () => game && openSaves(game, launch));
$('#btnHelp').addEventListener('click', openHelp);
$('#btnMenu').addEventListener('click', () => {
  if (confirm('¿Volver al inicio? Lo que no guardaste se pierde.')) showStart();
});
initModal();

// ---------------------------------------------------------------- keyboard

const panKeys: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  a: [-1, 0],
  d: [1, 0],
  w: [0, -1],
  s: [0, 1],
};
const held = new Set<string>();

function updatePan(): void {
  let x = 0;
  let y = 0;
  for (const k of held) {
    x += panKeys[k][0];
    y += panKeys[k][1];
  }
  game?.setKeyboardPan(x, y);
}

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (isModalOpen()) {
    if (e.key === 'Escape') closeModal();
    return;
  }
  if (!game) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    game.undo();
    e.preventDefault();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (panKeys[key]) {
    held.add(key);
    updatePan();
    e.preventDefault();
    return;
  }
  const tool = TOOLS.find((t) => t.key === key);
  if (tool) return game.setTool(tool.id);
  switch (key) {
    case 'b':
      game.cycleBlock();
      break;
    case 'q':
      game.rotate(-1);
      break;
    case 'e':
      game.rotate(1);
      break;
    case '+':
    case '=':
      game.zoom(1, game.view.width / 2, game.view.height / 2);
      break;
    case '-':
      game.zoom(-1, game.view.width / 2, game.view.height / 2);
      break;
    case ' ':
      game.togglePause();
      e.preventDefault();
      break;
    case 'c':
      game.cycleLayer();
      break;
    case 'p':
      openBudget(game);
      break;
    case 'g':
      openSaves(game, launch);
      break;
    case 'h':
      openHelp();
      break;
    case 'n':
      $('#app').classList.toggle('no-news');
      game.view.resize();
      break;
    case 'Escape':
      game.dragCancel();
      game.closeInfo();
      break;
  }
});

window.addEventListener('keyup', (e) => {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (held.delete(key)) updatePan();
});
window.addEventListener('blur', () => {
  held.clear();
  updatePan();
});

showStart();
