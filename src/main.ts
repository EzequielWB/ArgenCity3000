import './ui/style.css';
import { Sound, browserAudio, browserStorage } from './audio/sound';
import { MAP_SIZES, PLAYABLE_SIZES, type GovernmentKind, type MapSizeId } from './config';
import { hashString } from './core/rng';
import { Game } from './game';
import { paintTerrainPreview } from './render/minimap';
import type { SaveData } from './save/save';
import { pickMayorName } from './sim/mayor';
import { newSimState } from './sim/simulation';
import { $, toast } from './ui/dom';
import { governmentCardsHtml } from './ui/government';
import { installOrnaments } from './ui/filete';
import { PHRASES, nextPhrase } from './ui/phrases';
import { closeModal, initModal, isModalOpen, openBudget, openHelp, openSaves } from './ui/panels';
import { MAP_KINDS, generateMap, type MapKind } from './world/mapkinds';
import type { Terrain } from './world/terrain';
import { TOOLS } from './world/tools';
import { PRESETS, loadPreset, worldFromPreset, type MapPreset } from './world/presets';
import { addRoute } from './world/route';
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

const SIZE_LABELS: readonly (readonly [MapSizeId, string])[] = [
  ['small', 'Chico'],
  ['medium', 'Mediano'],
  ['large', 'Grande'],
];

let game: Game | null = null;
const sound = new Sound(browserAudio, browserStorage());
installOrnaments();

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
/** The real-place map picked on the start screen, once loaded; null for an invented map. */
let preset: MapPreset | null = null;
const presetCache = new Map<string, MapPreset>();

/** The invented map chosen on the start screen: its kind and its size in cells per side. */
function pickedTerrain(seed: number): Terrain {
  const kind = $<HTMLSelectElement>('#startKind').value as MapKind;
  const size = MAP_SIZES[$<HTMLSelectElement>('#startSize').value as MapSizeId];
  return generateMap(seed, size, kind);
}

function refreshPreview(): void {
  clearTimeout(previewTimer);
  previewTimer = window.setTimeout(() => {
    const canvas = $<HTMLCanvasElement>('#startMap');
    if (preset) {
      const p = preset;
      paintTerrainPreview(canvas, { n: p.n, corners: p.corners, trees: p.trees }, $<HTMLInputElement>('#startStreets').checked ? p.roads : undefined);
    } else paintTerrainPreview(canvas, pickedTerrain(parseSeed($<HTMLInputElement>('#startSeed').value)));
  }, 120);
}

async function pickMap(id: string): Promise<void> {
  const real = id !== '';
  $('#seedField').classList.toggle('hidden', real);
  $('#kindFields').classList.toggle('hidden', real);
  $('#kindNote').classList.toggle('hidden', real);
  $('#streetsField').classList.toggle('hidden', !real);
  $('#mapNote').classList.toggle('hidden', !real);
  $<HTMLButtonElement>('#startNew').disabled = real;
  preset = null;
  if (!real) return refreshPreview();
  const info = PRESETS.find((p) => p.id === id)!;
  $('#mapNote').textContent = `${info.blurb} Cargando…`;
  try {
    let p = presetCache.get(id);
    if (!p) {
      p = await loadPreset(id);
      presetCache.set(id, p);
    }
    if ($<HTMLSelectElement>('#startMapKind').value !== id) return; // the player picked another one meanwhile
    preset = p;
    $('#mapNote').textContent = `${info.blurb} ${p.attribution}`;
    $<HTMLInputElement>('#startName').value = p.name;
    $<HTMLButtonElement>('#startNew').disabled = false;
    refreshPreview();
  } catch (err) {
    toast((err as Error).message, true);
    $<HTMLSelectElement>('#startMapKind').value = '';
    void pickMap('');
  }
}

function showKindNote(): void {
  const kind = $<HTMLSelectElement>('#startKind').value;
  $('#kindNote').textContent = MAP_KINDS.find((k) => k.id === kind)?.blurb ?? '';
}

function showStart(): void {
  game?.destroy();
  game = null;
  closeModal();
  $('#app').classList.add('hidden');
  $('#start').classList.remove('hidden');
  const name = $<HTMLInputElement>('#startName');
  name.value = CITY_NAMES[Math.floor(Math.random() * CITY_NAMES.length)];
  $<HTMLInputElement>('#startMayor').value = pickMayorName();
  $<HTMLInputElement>('#startSeed').value = String(randomSeed());
  $<HTMLSelectElement>('#startMapKind').value = '';
  showKindNote(); // the kind and size picked last time stay selected
  void pickMap('');
  name.focus();
  name.select();
}

function launch(data: SaveData): void {
  game?.destroy();
  $('#start').classList.add('hidden');
  $('#app').classList.remove('hidden');
  game = new Game(data, { isModalOpen, sound, leave: showStart });
  if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;
  if (data.sim.tick === 0) {
    const streets = data.world.route.some((v) => v) ? 'una calle que salga de la ruta (3)' : 'unas calles (3)';
    toast(data.mayor ? `¡Arranca la gestión de ${data.mayor}! Empezá por una usina (9) y ${streets}.` : `¡Bienvenido, Intendente! Empezá por una usina (9) y ${streets}.`);
  }
  else toast(`Partida cargada: ${data.name}`);
}

function chosenGovernment(): GovernmentKind {
  const picked = document.querySelector<HTMLInputElement>('input[name="startGov"]:checked');
  return (picked?.value as GovernmentKind | undefined) ?? 'democracia';
}

function chosenParty(): string {
  return $<HTMLInputElement>('#startParty').value.trim().slice(0, 32);
}

function startNew(): void {
  const name = $<HTMLInputElement>('#startName').value.trim() || 'Villa Sin Nombre';
  const mayor = $<HTMLInputElement>('#startMayor').value.trim();
  if ($<HTMLSelectElement>('#startMapKind').value !== '') {
    if (!preset) return; // still loading
    const seed = hashString(preset.id) % 1_000_000_000;
    launch({ name, seed, mayor, world: worldFromPreset(preset, $<HTMLInputElement>('#startStreets').checked), sim: newSimState(seed, chosenGovernment(), chosenParty()) });
    return;
  }
  const seed = parseSeed($<HTMLInputElement>('#startSeed').value);
  const world = new World(pickedTerrain(seed));
  addRoute(world, seed);
  launch({ name, seed, mayor, world, sim: newSimState(seed, chosenGovernment(), chosenParty()) });
}

$('#startReroll').addEventListener('click', () => {
  $<HTMLInputElement>('#startSeed').value = String(randomSeed());
  refreshPreview();
});
$('#startSeed').addEventListener('input', refreshPreview);
const mapKind = $<HTMLSelectElement>('#startMapKind');
for (const p of PRESETS) mapKind.add(new Option(`${p.name} (mapa real)`, p.id));
mapKind.addEventListener('change', () => void pickMap(mapKind.value));
const kindSelect = $<HTMLSelectElement>('#startKind');
for (const k of MAP_KINDS) kindSelect.add(new Option(k.label, k.id));
const sizeSelect = $<HTMLSelectElement>('#startSize');
for (const [id, label] of SIZE_LABELS) {
  const playable = PLAYABLE_SIZES.includes(id);
  const cells = `${MAP_SIZES[id]} × ${MAP_SIZES[id]}`;
  const option = new Option(playable ? `${label} (${cells})` : `${label} (${cells}) · pronto`, id);
  option.disabled = !playable;
  sizeSelect.add(option);
}
kindSelect.addEventListener('change', () => {
  showKindNote();
  refreshPreview();
});
sizeSelect.addEventListener('change', refreshPreview);
$('#startStreets').addEventListener('change', refreshPreview);
$('#startGovernment').innerHTML = governmentCardsHtml();
$('#startNew').addEventListener('click', startNew);
$('#startLoad').addEventListener('click', () => openSaves(null, launch));
$('#startName').addEventListener('keydown', (e) => {
  if ((e as KeyboardEvent).key === 'Enter') startNew();
});

// ---------------------------------------------------------------- top bar

$('#btnBudget').addEventListener('click', () => game && openBudget(game));
$('#btnSave').addEventListener('click', () => game && openSaves(game, launch));
$('#btnHelp').addEventListener('click', openHelp);

function showSound(): void {
  const b = $('#btnSound');
  b.textContent = sound.muted ? 'Sin sonido' : 'Sonido';
  b.setAttribute('aria-pressed', String(!sound.muted));
}
function toggleSound(): void {
  sound.unlock();
  toast(sound.toggle() ? 'Sonido apagado' : 'Sonido encendido');
  showSound();
}
$('#btnSound').addEventListener('click', toggleSound);
showSound();
// Browsers only start audio after a gesture: the first click or key does it.
for (const type of ['pointerdown', 'keydown'] as const) window.addEventListener(type, () => sound.unlock(), { capture: true });
$('#btnMenu').addEventListener('click', () => {
  if (confirm('¿Volver al inicio? Lo que no guardaste se pierde.')) showStart();
});
initModal();

// ---------------------------------------------------------------- filete phrases

/** Shows a phrase on a button; a click brings another one. Returns the function that changes it. */
function bindPhrase(button: HTMLElement): () => void {
  let shown = -1;
  const change = () => {
    shown = nextPhrase(shown, PHRASES.length);
    button.textContent = `“${PHRASES[shown]}”`;
  };
  change();
  button.addEventListener('click', change);
  return change;
}
bindPhrase($('#startPhrase'));
// The one at the foot of the map also changes by itself now and then.
window.setInterval(bindPhrase($('#phrase')), 45_000);

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
    case 'm':
      toggleSound();
      break;
    case 'n':
      $('#app').classList.toggle('no-news');
      game.view.resize();
      break;
    case 'Escape':
      // The open tool list goes first; with none open, Esc cancels the drag and closes the card.
      if (game.closeFlyout()) break;
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
