import type { Sound } from './audio/sound';
import { POWER_REACH, TICKS_PER_MONTH } from './config';
import { formatMoney, formatNumber, settlementType } from './core/format';
import { toView, type Rotation } from './core/iso';
import { attachPointer, type PointerTarget } from './input/controls';
import { pickCell } from './render/geometry';
import { MapRenderer } from './render/mapRenderer';
import { Minimap } from './render/minimap';
import { View, type Layer } from './render/view';
import type { SaveData } from './save/save';
import { saveToSlot } from './save/slots';
import { monthlyBudget, type BudgetReport } from './sim/budget';
import { dateLabel, weekLabel } from './sim/calendar';
import { describeOutlook, placementNote, placementUpkeep } from './sim/outlook';
import { reachCells } from './sim/power';
import { describeCell } from './sim/report';
import { Simulation } from './sim/simulation';
import { TOOL_ICONS } from './ui/icons';
import { $, escapeHtml, toast } from './ui/dom';
import { applyPlan, dragCells, planTool, plantFootprint, toolInfo, TOOLS, type ToolId } from './world/tools';
import { UndoHistory } from './world/history';
import { World } from './world/world';

/** Ticks per second for each speed: pause, slow, normal, fast. */
const SPEEDS = [0, 4, 10, 30];
const SPEED_LABELS = ['❚❚', '▶', '▶▶', '▶▶▶'];
const SPEED_NAMES = ['Pausa', 'Lento', 'Normal', 'Rápido'];
const LAYERS: { id: Layer; label: string }[] = [
  { id: 'none', label: 'Sin capa' },
  { id: 'power', label: 'Luz' },
  { id: 'pollution', label: 'Humo' },
  { id: 'landValue', label: 'Valor' },
  { id: 'crime', label: 'Delito' },
  { id: 'edu', label: 'Educación' },
  { id: 'health', label: 'Salud' },
  { id: 'fireCover', label: 'Bomberos' },
];
const PREVIEW_COLORS: Partial<Record<ToolId, string>> = {
  bulldoze: 'rgba(224,165,38,0.45)',
  road: 'rgba(85,84,90,0.55)',
  line: 'rgba(255,216,74,0.45)',
  zoneR: 'rgba(124,192,106,0.55)',
  zoneC: 'rgba(111,183,224,0.55)',
  zoneI: 'rgba(224,181,66,0.55)',
  park: 'rgba(127,181,90,0.6)',
  plant: 'rgba(200,70,47,0.5)',
  school: 'rgba(80,150,230,0.55)',
  clinic: 'rgba(60,180,110,0.55)',
  police: 'rgba(63,95,138,0.6)',
  fire: 'rgba(200,50,40,0.55)',
};

/** Tools that show a coverage layer while they are picked: each service shows what it covers, the plant and the line show the light. */
const TOOL_LAYERS: Partial<Record<ToolId, Layer>> = { school: 'edu', clinic: 'health', police: 'crime', fire: 'fireCover', plant: 'power', line: 'power' };

export interface GameHooks {
  isModalOpen(): boolean;
  sound: Sound;
}

/** One running city: simulation, rendering, input and HUD. */
export class Game implements PointerTarget {
  readonly world: World;
  readonly sim: Simulation;
  readonly map: MapRenderer;
  readonly view: View;
  readonly minimap: Minimap;
  readonly name: string;
  readonly seed: number;

  tool: ToolId = 'query';
  block = 1;
  private layerBeforeTool: Layer = 'none';
  speed = 2;

  private history = new UndoHistory();
  private dragFrom: [number, number] | null = null;
  private dragTo: [number, number] | null = null;
  private mouse: [number, number] | null = null;
  private queried: [number, number] | null = null;
  private acc = 0;
  private last = 0;
  private lastHud = 0;
  private lastMinimap = 0;
  private minimapDirty = true;
  private raf = 0;
  private detach: () => void;
  private shownNews = '';
  /** The month's estimated budget shown in the top bar: recomputed a few times per second and after edits. */
  private outlookBudget: BudgetReport | null = null;
  private outlookAt = 0;
  private keyboardPan = { x: 0, y: 0 };
  /** Fires already announced with the siren. */
  private firesHeard = 0;

  constructor(data: SaveData, private hooks: GameHooks) {
    this.world = data.world;
    this.name = data.name;
    this.seed = data.seed;
    this.sim = new Simulation(this.world, data.sim, data.name);
    this.map = new MapRenderer(this.world);
    this.map.redrawAll();
    this.world.takeDirty();
    this.view = new View($<HTMLCanvasElement>('#game'), this.map, this.world);
    this.minimap = new Minimap($<HTMLCanvasElement>('#minimap'), this.world);
    this.detach = attachPointer(this.view.canvas, this);
    this.buildToolbar();
    this.buildSpeed();
    this.startCamera();
    $('#cityName').textContent = this.name;
    this.updateHud(true);
    window.addEventListener('resize', this.onResize);
    $<HTMLCanvasElement>('#minimap').addEventListener('pointerdown', this.onMinimap);
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy(): void {
    this.hooks.sound.update({ pop: 0, cars: 0, running: false }, 0);
    cancelAnimationFrame(this.raf);
    this.detach();
    window.removeEventListener('resize', this.onResize);
    $<HTMLCanvasElement>('#minimap').removeEventListener('pointerdown', this.onMinimap);
    this.closeInfo();
  }

  saveData(): SaveData {
    return { name: this.name, seed: this.seed, world: this.world, sim: this.sim.state };
  }

  // ---------------------------------------------------------------- loop

  private frame = (t: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(250, t - (this.last || t));
    this.last = t;
    if (this.keyboardPan.x || this.keyboardPan.y) {
      this.view.pan(-this.keyboardPan.x * dt * 0.9, -this.keyboardPan.y * dt * 0.9);
      this.minimapDirty = true;
    }
    const running = SPEEDS[this.speed] > 0 && !this.hooks.isModalOpen();
    this.view.traffic.update(running ? (dt / 1000) * (this.speed === 3 ? 1.6 : 1) : 0);
    if (running) {
      this.acc += (dt * SPEEDS[this.speed]) / 1000;
      const steps = Math.min(8, Math.floor(this.acc));
      this.acc = steps === 8 ? 0 : this.acc - steps;
      for (let k = 0; k < steps; k++) {
        const month = Math.floor(this.sim.state.tick / TICKS_PER_MONTH);
        this.sim.tick();
        if (Math.floor(this.sim.state.tick / TICKS_PER_MONTH) !== month) this.onNewMonth();
      }
    }
    const dirty = this.world.takeDirty();
    if (dirty.length) {
      this.map.update(dirty);
      this.minimapDirty = true;
    }
    this.view.render(t);
    if (t - this.lastHud > 250) {
      const since = this.lastHud ? (t - this.lastHud) / 1000 : 0;
      this.lastHud = t;
      this.updateHud(false);
      this.updateSound(running, since);
    }
    if (this.minimapDirty && t - this.lastMinimap > 700) {
      this.lastMinimap = t;
      this.minimapDirty = false;
      this.drawMinimap();
    }
  };

  private updateSound(running: boolean, dt: number): void {
    const sound = this.hooks.sound;
    sound.update({ pop: this.sim.totals.pop, cars: this.view.traffic.cars.length, running }, dt);
    if (this.sim.stats.firesStarted > this.firesHeard) sound.play('fire');
    this.firesHeard = this.sim.stats.firesStarted;
  }

  private onNewMonth(): void {
    this.view.invalidateLayer();
    this.view.refreshTraffic();
    if (this.sim.state.tick % (TICKS_PER_MONTH * 12) === 0) {
      try {
        saveToSlot('auto', this.saveData());
        toast(`Autoguardado: ${dateLabel(this.sim.state.tick)}`);
      } catch {
        // Autosave is a convenience; a full storage must not stop the game.
      }
    }
  }

  private onResize = () => {
    this.view.resize();
  };

  private startCamera(): void {
    // Start looking at the middle of the land, away from the river.
    const n = this.world.n;
    let best: [number, number] = [Math.floor(n / 2), Math.floor(n / 2)];
    for (let x = Math.floor(n * 0.4); x >= 0; x--) {
      if (!this.world.isWater(x, Math.floor(n / 2))) {
        best = [x, Math.floor(n / 2)];
        break;
      }
    }
    this.view.centreOn(best[0], best[1]);
  }

  // ---------------------------------------------------------------- tools

  setTool(tool: ToolId): void {
    // Some tools show the layer they feed; leaving them for one that shows none restores the player's layer.
    const shown = TOOL_LAYERS[tool];
    if (shown) {
      if (!TOOL_LAYERS[this.tool]) this.layerBeforeTool = this.view.layer;
      this.setLayer(shown);
    } else if (TOOL_LAYERS[this.tool]) this.setLayer(this.layerBeforeTool);
    this.tool = tool;
    this.dragCancel();
    document.querySelectorAll<HTMLButtonElement>('#toolbar .tool').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === tool)));
    if (this.mouse) this.hover(...this.mouse);
    this.updateStatus();
  }

  setBlock(block: number): void {
    this.block = block;
    document.querySelectorAll<HTMLButtonElement>('#toolbar [data-block]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.block) === block)));
    if (this.mouse) this.hover(...this.mouse);
  }

  cycleBlock(): void {
    this.setBlock(this.block === 1 ? 2 : this.block === 2 ? 4 : 1);
  }

  setLayer(layer: Layer): void {
    this.view.setLayer(layer);
    document.querySelectorAll<HTMLButtonElement>('#toolbar [data-layer]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.layer === layer)));
  }

  cycleLayer(): void {
    const k = LAYERS.findIndex((l) => l.id === this.view.layer);
    this.setLayer(LAYERS[(k + 1) % LAYERS.length].id);
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    document.querySelectorAll<HTMLButtonElement>('#speed button').forEach((b, k) => b.setAttribute('aria-pressed', String(k === speed)));
  }

  togglePause(): void {
    this.setSpeed(this.speed === 0 ? 2 : 0);
  }

  rotate(dir: number): void {
    const [cx, cy] = this.view.centreCell();
    this.map.setRotation(((this.map.rot + dir + 4) % 4) as Rotation);
    this.world.takeDirty();
    this.view.centreOn(cx, cy);
    this.view.invalidateLayer();
    this.minimapDirty = true;
    this.lastMinimap = 0;
  }

  setKeyboardPan(x: number, y: number): void {
    this.keyboardPan = { x, y };
  }

  // ---------------------------------------------------------------- pointer

  private pick(mx: number, my: number): [number, number] | null {
    const [sx, sy] = this.view.screenToMap(mx, my);
    return pickCell(this.world, sx, sy, this.map.rot);
  }

  isPainting(): boolean {
    return this.tool !== 'query';
  }

  hover(mx: number, my: number): void {
    this.mouse = [mx, my];
    const cell = this.pick(mx, my);
    this.view.hover = cell;
    if (this.dragFrom) return;
    if (cell && this.isPainting()) this.showPreview(cell, cell, mx, my);
    else {
      this.view.preview = null;
      this.hideTooltip();
    }
    this.updateStatus();
  }

  leave(): void {
    this.mouse = null;
    this.view.hover = null;
    if (!this.dragFrom) this.view.preview = null;
    this.hideTooltip();
  }

  dragStart(mx: number, my: number): void {
    const cell = this.pick(mx, my);
    if (!cell) return;
    this.dragFrom = cell;
    this.dragTo = cell;
    this.showPreview(cell, cell, mx, my);
  }

  dragMove(mx: number, my: number): void {
    this.mouse = [mx, my];
    if (!this.dragFrom) return;
    const cell = this.pick(mx, my);
    if (cell) this.dragTo = cell;
    this.view.hover = cell;
    this.showPreview(this.dragFrom, this.dragTo!, mx, my);
  }

  dragEnd(): void {
    if (!this.dragFrom || !this.dragTo) return this.dragCancel();
    const plan = planTool(this.world, this.tool, this.cellsFor(this.dragFrom, this.dragTo));
    this.dragFrom = null;
    this.dragTo = null;
    this.view.preview = null;
    this.hideTooltip();
    if (plan.cells.length === 0) {
      this.hooks.sound.play('deny');
      toast(this.tool === 'bulldoze' ? 'No hay nada para demoler ahí' : 'No se puede construir ahí', true);
      return;
    }
    if (!this.sim.spend(plan.cost)) {
      this.hooks.sound.play('deny');
      toast(`No alcanza la plata: hace falta ${formatMoney(plan.cost)}`, true);
      return;
    }
    this.history.record(this.world, plan, this.sim.state.tick);
    applyPlan(this.world, plan);
    this.hooks.sound.play(this.tool === 'bulldoze' ? 'bulldoze' : 'build');
    this.afterEdit();
  }

  /** Reverts the latest construction or demolition and gives the money back. */
  undo(): void {
    this.dragCancel();
    const r = this.history.undo(this.world, this.sim.state.tick);
    if (!r) {
      this.hooks.sound.play('deny');
      toast('No hay nada reciente para deshacer', true);
      return;
    }
    this.hooks.sound.play('undo');
    this.sim.state.cash += r.refund;
    this.afterEdit();
    toast(`Deshecho: ${toolInfo(r.tool).label}${r.refund ? ` (se devolvieron ${formatMoney(r.refund)})` : ''}`);
  }

  private afterEdit(): void {
    this.outlookAt = 0;
    this.sim.refresh();
    this.view.invalidateLayer();
    this.view.refreshTraffic();
    this.minimapDirty = true;
    this.updateHud(false);
    if (this.mouse) this.hover(...this.mouse);
  }

  dragCancel(): void {
    this.dragFrom = null;
    this.dragTo = null;
    this.view.preview = null;
    this.hideTooltip();
  }

  click(mx: number, my: number): void {
    const cell = this.pick(mx, my);
    if (!cell) return this.closeInfo();
    this.queried = cell;
    this.renderInfo();
  }

  pan(dx: number, dy: number): void {
    this.view.pan(dx, dy);
    this.minimapDirty = true;
  }

  zoom(dir: number, mx: number, my: number): void {
    this.view.zoomStep(dir, mx, my);
    this.minimapDirty = true;
  }

  private cellsFor(a: [number, number], b: [number, number]): [number, number][] {
    return dragCells(this.tool, a[0], a[1], b[0], b[1], this.block, this.world.n);
  }

  private showPreview(a: [number, number], b: [number, number], mx: number, my: number): void {
    const cells = this.cellsFor(a, b);
    const plan = planTool(this.world, this.tool, cells);
    const shown = this.tool === 'plant' ? plantFootprint(this.world.n, b[0], b[1]) : cells;
    this.view.preview = {
      cells: shown,
      valid: new Set(plan.cells.map(([x, y]) => this.world.idx(x, y))),
      color: PREVIEW_COLORS[this.tool] ?? 'rgba(255,255,255,0.4)',
      halo: this.tool === 'plant' ? reachCells(this.world.n, shown, POWER_REACH) : undefined,
    };
    const tip = $('#tooltip');
    tip.classList.remove('hidden');
    tip.style.left = `${mx}px`;
    tip.style.top = `${my}px`;
    if (plan.cells.length === 0) {
      tip.textContent = this.tool === 'bulldoze' ? 'Nada para demoler' : 'No se puede acá';
      tip.classList.add('bad');
    } else if (plan.cost > this.sim.state.cash) {
      tip.textContent = `${formatMoney(plan.cost)} · no alcanza`;
      tip.classList.add('bad');
    } else {
      const upkeep = placementUpkeep(this.tool);
      const note = placementNote(this.tool);
      tip.textContent = `${formatMoney(plan.cost)}${plan.cells.length > 1 ? ` · ${plan.cells.length} lotes` : ''}${upkeep ? ` · ${upkeep}` : ''}${note ? ` · ${note}` : ''}`;
      tip.classList.remove('bad');
    }
  }

  private hideTooltip(): void {
    $('#tooltip').classList.add('hidden');
  }

  private onMinimap = (e: PointerEvent) => {
    const c = e.currentTarget as HTMLCanvasElement;
    const r = c.getBoundingClientRect();
    const cell = this.minimap.pixelToWorld(((e.clientX - r.left) * c.width) / r.width, ((e.clientY - r.top) * c.height) / r.height, this.map.rot);
    if (cell) {
      this.view.centreOn(cell[0], cell[1]);
      this.minimapDirty = true;
      this.lastMinimap = 0;
    }
  };

  private drawMinimap(): void {
    const corners: [number, number][] = [
      [0, 0],
      [this.view.width, 0],
      [this.view.width, this.view.height],
      [0, this.view.height],
    ];
    const viewport = corners.map(([mx, my]) => {
      const [sx, sy] = this.view.screenToMap(mx, my);
      // Project onto the plane at a typical land height.
      const a = sx / 16;
      const b = (sy + 4 * 8) / 8;
      return [(a + b) / 2, (b - a) / 2] as [number, number];
    });
    this.minimap.draw(this.map.rot, viewport);
  }

  // ---------------------------------------------------------------- HUD

  private buildToolbar(): void {
    const bar = $('#toolbar');
    const tools = TOOLS.map(
      (t) =>
        `<button class="tool" data-tool="${t.id}" title="${escapeHtml(t.label)} (${t.key}) — ${escapeHtml(t.help)}" aria-label="${escapeHtml(t.label)}" aria-pressed="${t.id === this.tool}">${TOOL_ICONS[t.id]}<kbd>${t.key}</kbd></button>`,
    ).join('');
    const blocks = [1, 2, 4]
      .map((b) => `<button class="small" data-block="${b}" aria-pressed="${b === this.block}" title="Bloque de ${b}×${b} para zonas, plazas y topadora (B)">${b}×${b}</button>`)
      .join('');
    const layers = LAYERS.map(
      (l) => `<button class="small" data-layer="${l.id}" aria-pressed="${l.id === 'none'}" title="Capa: ${l.label} (C)">${l.label}</button>`,
    ).join('');
    bar.innerHTML = `${tools}<button class="small" data-act="undo" title="Deshacer la última obra (Ctrl+Z)">↶ Deshacer</button><hr><div class="group-label">Bloque</div>${blocks}<hr><div class="group-label">Capas</div>${layers}<hr>
      <button class="small" data-act="rotl" title="Rotar a la izquierda (Q)">⟲ Rotar</button>
      <button class="small" data-act="rotr" title="Rotar a la derecha (E)">Rotar ⟳</button>
      <button class="small" data-act="zin" title="Acercar (+)">＋ Zoom</button>
      <button class="small" data-act="zout" title="Alejar (−)">− Zoom</button>`;
    bar.onclick = (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      if (b.dataset.tool) this.setTool(b.dataset.tool as ToolId);
      else if (b.dataset.block) this.setBlock(Number(b.dataset.block));
      else if (b.dataset.layer) this.setLayer(b.dataset.layer as Layer);
      else if (b.dataset.act === 'undo') this.undo();
      else if (b.dataset.act === 'rotl') this.rotate(-1);
      else if (b.dataset.act === 'rotr') this.rotate(1);
      else if (b.dataset.act === 'zin') this.zoom(1, this.view.width / 2, this.view.height / 2);
      else if (b.dataset.act === 'zout') this.zoom(-1, this.view.width / 2, this.view.height / 2);
    };
  }

  private buildSpeed(): void {
    const box = $('#speed');
    box.innerHTML = SPEED_LABELS.map(
      (l, k) => `<button title="${SPEED_NAMES[k]}${k === 0 ? ' (Espacio)' : ''}" aria-label="${SPEED_NAMES[k]}" aria-pressed="${k === this.speed}">${l}</button>`,
    ).join('');
    box.querySelectorAll('button').forEach((b, k) => b.addEventListener('click', () => this.setSpeed(k)));
  }

  private updateStatus(): void {
    const t = toolInfo(this.tool);
    $('#statusTool').textContent = `${t.label}: ${t.help}`;
    const cell = this.view.hover;
    if (!cell) {
      $('#statusCell').textContent = '';
      return;
    }
    const r = describeCell(this.world, this.sim, cell[0], cell[1]);
    $('#statusCell').textContent = `${r.title} · ${r.lines.slice(0, 2).join(' · ')}`;
  }

  updateHud(force: boolean): void {
    const s = this.sim.state;
    $('#date').textContent = weekLabel(s.tick);
    const cash = $('#cash');
    cash.textContent = formatMoney(s.cash);
    cash.classList.toggle('neg', s.cash < 0);
    this.updateOutlook(force);
    $('#pop').textContent = formatNumber(this.sim.totals.pop);
    $('#cityType').textContent = settlementType(this.sim.totals.pop);
    const bars = document.querySelectorAll<HTMLElement>('#rci .bar i');
    const d = [this.sim.demand.R, this.sim.demand.C, this.sim.demand.I];
    bars.forEach((el, k) => {
      const v = d[k];
      el.style.height = `${Math.abs(v) / 2}%`;
      el.style.top = v >= 0 ? `${50 - v / 2}%` : '50%';
      el.style.opacity = v >= 0 ? '1' : '0.45';
    });
    $('#rci').title = `Demanda — Residencial: ${d[0]} · Comercial: ${d[1]} · Industrial: ${d[2]}`;
    $('#newsDate').textContent = `${this.name} · ${dateLabel(s.tick)}`;
    const head = s.news[0] ? s.news[0].date + s.news[0].text + s.news.length : '';
    if (force || head !== this.shownNews) {
      const fresh = !force && this.shownNews !== '';
      this.shownNews = head;
      if (fresh) this.hooks.sound.play('news');
      $('#news').innerHTML = s.news
        .map((n, k) => `<li class="${k === 0 && fresh ? 'fresh' : ''}"><time>${escapeHtml(n.date)}</time>${escapeHtml(n.text)}</li>`)
        .join('');
    }
    if (this.queried) this.renderInfo();
    if (force) this.updateStatus();
  }

  /** Estimated monthly balance next to the cash, with how long the cash lasts when it is short. */
  private updateOutlook(force: boolean): void {
    const s = this.sim.state;
    const now = performance.now();
    if (force || !this.outlookBudget || now - this.outlookAt > 400) {
      this.outlookBudget = monthlyBudget(this.world, s.taxes, s.funding);
      this.outlookAt = now;
    }
    const o = describeOutlook(this.outlookBudget, s.cash);
    const text = $('#balanceText');
    text.textContent = o.balanceText;
    text.className = `tone-${o.balanceTone}`;
    const runway = $('#runway');
    runway.textContent = o.runwayText ? ` · ${o.runwayText}` : '';
    runway.className = o.runwayTone ? `tone-${o.runwayTone}` : '';
    $('#balance').title = o.tooltip;
  }

  private renderInfo(): void {
    if (!this.queried) return;
    const [x, y] = this.queried;
    const r = describeCell(this.world, this.sim, x, y);
    const card = $('#info');
    card.classList.remove('hidden');
    card.innerHTML = `<button class="close" aria-label="Cerrar">✕</button><h3>${escapeHtml(r.title)}</h3><ul>${r.lines
      .map((l) => `<li>${escapeHtml(l)}</li>`)
      .join('')}</ul>${r.hint ? `<p class="hint">${escapeHtml(r.hint)}</p>` : ''}`;
    card.querySelector('.close')!.addEventListener('click', () => this.closeInfo());
  }

  /** Screen position (CSS px, relative to the canvas) of the centre of a world cell. */
  screenOfCell(x: number, y: number): [number, number] {
    const [vx, vy] = toView(x, y, this.map.rot, this.world.n);
    const [cx, cy] = this.map.toCache(vx + 0.5, vy + 0.5, this.world.minMax(x, y)[1]);
    const z = this.view.cam.zoom;
    return [(cx - this.view.cam.x) * z + this.view.width / 2, (cy - this.view.cam.y) * z + this.view.height / 2];
  }

  closeInfo(): void {
    this.queried = null;
    $('#info').classList.add('hidden');
  }
}
