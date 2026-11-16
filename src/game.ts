import type { Sound } from './audio/sound';
import { POWER_REACH, TICKS_PER_MONTH, type GovernmentKind } from './config';
import { formatMoney, formatNumber, settlementType } from './core/format';
import { toView, type Rotation } from './core/iso';
import { attachPointer, type PointerTarget } from './input/controls';
import { bubbleIcon } from './render/bubbles';
import { pickCell } from './render/geometry';
import { MapRenderer } from './render/mapRenderer';
import { Minimap } from './render/minimap';
import { View, startCameraCell, type Layer } from './render/view';
import type { SaveData } from './save/save';
import { saveToSlot } from './save/slots';
import { incomeFactor } from './sim/effects';
import { moodOf } from './sim/favor';
import { monthlyBudget, type BudgetReport } from './sim/budget';
import { dateLabel, dateOf, weekLabel } from './sim/calendar';
import { coastRefusal } from './sim/coast';
import { isUnlocked, nextMilestone, unlockNames } from './sim/milestones';
import { describeOutlook, placementNote, placementUpkeep } from './sim/outlook';
import { windOutput } from './sim/plants';
import { reachCells } from './sim/power';
import { transitBuses } from './sim/transit';
import { describeCell } from './sim/report';
import { Simulation } from './sim/simulation';
import { APPROVAL, nextElectionYear } from './sim/politics';
import { RUN_DRY_MONTHS, RUN_GOAL, RUN_MARKS, runOver } from './sim/roguelike';
import { openApproval, openElectionLost, openElectionWon, openEvent, openMilestone } from './ui/panels';
import { openRunOver, openUpgrades } from './ui/upgrades';
import { $, escapeHtml, toast } from './ui/dom';
import { Toolbar, lockNotice } from './ui/toolbar';
import { applyPlan, dragCells, footprintOfTool, isCoastTool, planTool, plantKindOfTool, routeRefusal, toolInfo, type Plan, type ToolId } from './world/tools';
import { busArea, busRefusal, busLineProblem } from './world/transport';
import { openBusLine } from './ui/busline';
import { UndoHistory } from './world/history';
import { World } from './world/world';
/** Repaint budget per frame, and lots painted per batch (see repaintChanges). */
const PATCH_BUDGET_MS = 5;
const PATCH_BATCH = 24;
/** Ticks per second for each speed: pause, slow, normal, fast. */
const SPEEDS = [0, 4, 10, 25];
const SPEED_LABELS = ['❚❚', '▶', '▶▶', '▶▶▶'];
const SPEED_NAMES = ['Pausa', 'Lento', 'Normal', 'Rápido'];
const LAYERS: { id: Layer; label: string }[] = [
  { id: 'none', label: 'Sin capa' },
  { id: 'power', label: 'Luz' },
  { id: 'traffic', label: 'Tránsito' },
  { id: 'pollution', label: 'Humo' },
  { id: 'landValue', label: 'Valor' },
  { id: 'crime', label: 'Delito' },
  { id: 'edu', label: 'Educación' },
  { id: 'health', label: 'Salud' },
  { id: 'fireCover', label: 'Bomberos' },
];
const PREVIEW_COLORS: Partial<Record<ToolId, string>> = {
  bulldoze: 'rgba(224,165,38,0.45)',
  bus: 'rgba(224,165,38,0.55)',
  roadDirt: 'rgba(160,124,82,0.6)',
  road: 'rgba(85,84,90,0.55)',
  roadPaved: 'rgba(60,59,66,0.6)',
  roadBoulevard: 'rgba(124,192,106,0.55)',
  line: 'rgba(255,228,120,0.8)',
  zoneR: 'rgba(124,192,106,0.55)',
  zoneC: 'rgba(111,183,224,0.55)',
  zoneI: 'rgba(224,181,66,0.55)',
  park: 'rgba(127,181,90,0.6)',
  plant: 'rgba(200,70,47,0.5)',
  plantGas: 'rgba(120,150,170,0.55)',
  plantWind: 'rgba(240,240,235,0.6)',
  school: 'rgba(80,150,230,0.55)',
  clinic: 'rgba(60,180,110,0.55)',
  hospital: 'rgba(60,180,110,0.55)',
  university: 'rgba(80,140,220,0.55)',
  police: 'rgba(63,95,138,0.6)',
  fire: 'rgba(200,50,40,0.55)',
  fishing: 'rgba(169,118,63,0.6)',
  promenade: 'rgba(214,205,187,0.65)',
  port: 'rgba(224,165,38,0.55)',
  resort: 'rgba(226,100,80,0.5)',
  lighthouse: 'rgba(240,240,235,0.65)',
};

const STALL_LABELS = { shortage: 'apagones', taxes: 'impuestos altos', blight: 'abandono', stopped: 'la ciudad está frenada' } as const;

/** Tools that show a coverage layer while they are picked: each service shows what it covers, the plants and the line show the light, the street shows the traffic. */
const TOOL_LAYERS: Partial<Record<ToolId, Layer>> = { school: 'edu', clinic: 'health', police: 'crime', fire: 'fireCover', hospital: 'health', university: 'edu', plant: 'power', plantGas: 'power', plantWind: 'power', line: 'power', bus: 'traffic', roadDirt: 'traffic', road: 'traffic', roadPaved: 'traffic', roadBoulevard: 'traffic' };

export interface GameHooks {
  isModalOpen(): boolean;
  /** Leaves the city for the start screen. */
  leave(): void;
  /** Starts a fresh city on the same map, for a new roguelike run. */
  restart(): void;
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
  /** The player's character, or an empty string when the save predates it. */
  readonly mayor: string;
  readonly seed: number;

  tool: ToolId = 'query';
  private layerBeforeTool: Layer = 'none';
  speed = 2;
  private speedBeforeEvent = 2;
  /** A brand-new city waits, paused, for the player's first work. */
  private waitingForFirstWork = false;

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
  private toolbar: Toolbar;
  /** Milestone the toolbar and the goal were last drawn for (-1 = never). */
  private shownMilestone = -1;
  /** Highest milestone the player has already seen the plaque of. */
  private announcedMilestone: number;
  /** Elections already announced to the player: won ones, and whether the lost one was shown. */
  private shownTerms: number;
  private shownLost: boolean;
  /** How the run ended, once it is shown: the window is not opened twice. */
  private shownRunOver: 'ganada' | 'eleccion' | 'caja' | null = null;
  /** Fires already announced with the siren. */
  private firesHeard = 0;

  constructor(data: SaveData, private hooks: GameHooks) {
    this.world = data.world;
    this.name = data.name;
    this.mayor = data.mayor ?? '';
    this.seed = data.seed;
    this.waitingForFirstWork = data.sim.tick === 0;
    this.speed = this.waitingForFirstWork ? 0 : 2;
    this.sim = new Simulation(this.world, data.sim, data.name, this.mayor);
    this.shownTerms = data.sim.terms;
    this.shownLost = data.sim.lostElection;
    this.announcedMilestone = data.sim.milestone;
    this.map = new MapRenderer(this.world);
    this.map.redrawAll();
    this.world.takeDirty();
    this.view = new View($<HTMLCanvasElement>('#game'), this.map, this.world);
    this.minimap = new Minimap($<HTMLCanvasElement>('#minimap'), this.world);
    this.detach = attachPointer(this.view.canvas, this);
    this.toolbar = new Toolbar($('#toolbar'), $('#flyout'), LAYERS, {
      setTool: (tool) => this.setTool(tool),
      setLayer: (layer) => this.setLayer(layer),
      undo: () => this.undo(),
      rotate: (dir) => this.rotate(dir),
      zoom: (dir) => this.zoom(dir, this.view.width / 2, this.view.height / 2),
    });
    this.toolbar.showTool(this.tool);
    this.toolbar.showLayer(this.view.layer);
    this.buildSpeed();
    this.startCamera();
    this.updateHud(true);
    window.addEventListener('resize', this.onResize);
    $<HTMLCanvasElement>('#minimap').addEventListener('pointerdown', this.onMinimap);
    $('#approvalBox').onclick = () => openApproval(this);
    // A saved game may have been left in the middle of an event: it is answered before anything else.
    if (this.sim.state.pendingEvent) {
      this.pauseForEvent();
    }
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy(): void {
    this.hooks.sound.update({ pop: 0, cars: 0, running: false }, 0);
    cancelAnimationFrame(this.raf);
    this.detach();
    this.toolbar.destroy();
    window.removeEventListener('resize', this.onResize);
    $<HTMLCanvasElement>('#minimap').removeEventListener('pointerdown', this.onMinimap);
    this.closeInfo();
  }

  saveData(): SaveData {
    return { name: this.name, seed: this.seed, mayor: this.mayor, world: this.world, sim: this.sim.state };
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
    this.view.vessels.update(running ? (dt / 1000) * (this.speed === 3 ? 1.6 : 1) : 0);
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
    this.repaintChanges();
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

  /** The lots that changed and are not painted yet: in a big city at full speed hundreds change every frame. */
  private pendingDirty = new Set<number>();

  /**
   * Paints the lots that changed, a batch at a time, until `PATCH_BUDGET_MS` is spent; the rest waits for the
   * next frame. What the player builds is a handful of lots and shows at once; the churn of a big city (levels
   * going up and down, buildings left empty) spreads over a few frames instead of freezing one.
   */
  private repaintChanges(): void {
    for (const i of this.world.takeDirty()) this.pendingDirty.add(i);
    const pending = this.pendingDirty;
    if (pending.size === 0) return;
    this.minimapDirty = true;
    // A whole block or a loaded game: the renderer redraws everything in view, there is nothing to spread.
    if (pending.size > 2500) {
      this.map.update([...pending]);
      pending.clear();
      return;
    }
    const start = performance.now();
    let batch: number[] = [];
    for (const i of pending) {
      pending.delete(i);
      batch.push(i);
      if (batch.length < PATCH_BATCH) continue;
      this.map.update(batch);
      batch = [];
      if (performance.now() - start > PATCH_BUDGET_MS) break;
    }
    if (batch.length > 0) this.map.update(batch);
  }

  private updateSound(running: boolean, dt: number): void {
    const sound = this.hooks.sound;
    sound.update({ pop: this.sim.totals.pop, cars: this.view.traffic.cars.length, running }, dt);
    if (this.sim.stats.firesStarted > this.firesHeard) sound.play('fire');
    this.firesHeard = this.sim.stats.firesStarted;
  }

  /** Recounts the traffic; the buses of the lines run as often as the budget for transport says. */
  refreshTraffic(): void {
    this.view.traffic.busesPerLine = transitBuses(this.sim.state.transport);
    this.view.refreshTraffic();
  }

  private onNewMonth(): void {
    this.view.invalidateLayer();
    this.refreshTraffic();
    // An event waits for an answer: the clock stops until the Intendente decides.
    if (this.sim.state.pendingEvent && !this.hooks.isModalOpen()) {
      this.pauseForEvent();
    }
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
    const [x, y] = startCameraCell(this.world);
    this.view.centreOn(x, y);
  }

  // ---------------------------------------------------------------- tools

  setTool(tool: ToolId): void {
    if (!isUnlocked(tool, this.sim.state.milestone)) {
      toast(lockNotice(tool), true);
      this.hooks.sound.play('deny');
      return;
    }
    // Some tools show the layer they feed; leaving them for one that shows none restores the player's layer.
    const shown = TOOL_LAYERS[tool];
    if (shown) {
      if (!TOOL_LAYERS[this.tool]) this.layerBeforeTool = this.view.layer;
      this.setLayer(shown);
    } else if (TOOL_LAYERS[this.tool]) this.setLayer(this.layerBeforeTool);
    this.tool = tool;
    this.dragCancel();
    this.toolbar.showTool(tool);
    if (this.mouse) this.hover(...this.mouse);
    this.updateStatus();
  }

  setLayer(layer: Layer): void {
    this.view.setLayer(layer);
    this.toolbar.showLayer(layer);
  }

  /** Puts the open tool list away; false when none was open. */
  closeFlyout(): boolean {
    const open = this.toolbar.isOpen();
    this.toolbar.close();
    return open;
  }

  cycleLayer(): void {
    const k = LAYERS.findIndex((l) => l.id === this.view.layer);
    this.setLayer(LAYERS[(k + 1) % LAYERS.length].id);
  }

  /** Signs the founding papers: the party, the form of government, and the city's first headline. */
  found(government: GovernmentKind, party: string): void {
    this.sim.found(government, party);
    this.updateHud(true);
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
    const target = this.dragTo;
    this.dragFrom = null;
    this.dragTo = null;
    this.view.preview = null;
    this.hideTooltip();
    if (plan.cells.length === 0) {
      this.hooks.sound.play('deny');
      toast(this.refusalAt(target) ?? (this.tool === 'bulldoze' ? 'No hay nada para demoler ahí' : 'No se puede construir ahí'), true);
      return;
    }
    // A bus line is asked for its colour and number first, and built when the window is confirmed.
    if (this.tool === 'bus') {
      openBusLine(this.world, this.world.idx(plan.cells[0][0], plan.cells[0][1]), (line) => this.build({ ...plan, line }));
      return;
    }
    this.build(plan);
  }

  /** Pays for a plan and builds it: the part of a drag that is the same for every tool. */
  private build(plan: Plan): void {
    if (plan.tool === 'bus' && (plan.line === undefined || busLineProblem(this.world, plan.line) !== null)) {
      this.hooks.sound.play('deny');
      toast('Esa línea ya no se puede construir', true);
      return;
    }
    if (!this.sim.spend(plan.cost)) {
      this.hooks.sound.play('deny');
      toast(`No alcanza la plata: hace falta ${formatMoney(plan.cost)}`, true);
      return;
    }
    this.history.record(this.world, plan, this.sim.state.tick);
    // Whatever the plan tears down is counted before the ground changes, and the neighbours hold it
    // against the Intendente for a few months. Undo does not pass through here, so it upsets nobody.
    const affected = this.sim.noteDemolition(plan.cells);
    applyPlan(this.world, plan);
    this.hooks.sound.play(plan.tool === 'bulldoze' ? 'bulldoze' : 'build');
    this.afterEdit();
    if (affected > 0) toast(`Demolición: ${formatNumber(Math.round(affected))} vecinos afectados`);
    if (this.waitingForFirstWork) {
      // The first work is the starting gun: the clock was holding for it.
      this.waitingForFirstWork = false;
      this.setSpeed(2);
      toast('Arranca el tiempo: la ciudad se pone en marcha');
    }
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

  /** Called when an event is answered: the answer may have moved money, approval or a promise. */
  /** The clock stops for the event and remembers its speed, to go back to it when the Intendente answers. */
  private pauseForEvent(): void {
    if (this.speed > 0) this.speedBeforeEvent = this.speed;
    this.setSpeed(0);
    openEvent(this);
  }

  afterEvent(): void {
    this.setSpeed(this.speedBeforeEvent);
    this.afterEdit();
  }

  private afterEdit(): void {
    this.outlookAt = 0;
    this.sim.refresh();
    this.view.invalidateLayer();
    this.refreshTraffic();
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

  /** Why the tool in hand cannot build on a cell (the route rules, or the coast ones), or null (a lot that is merely taken). */
  private refusalAt(cell: [number, number]): string | null {
    return routeRefusal(this.world, this.tool, cell[0], cell[1]) ?? (isCoastTool(this.tool) ? coastRefusal(this.world, this.tool, cell[0], cell[1]) : this.tool === 'bus' ? busRefusal(this.world, cell[0], cell[1]) : null);
  }

  private cellsFor(a: [number, number], b: [number, number]): [number, number][] {
    return dragCells(this.tool, a[0], a[1], b[0], b[1], 1, this.world.n);
  }

  private showPreview(a: [number, number], b: [number, number], mx: number, my: number): void {
    const cells = this.cellsFor(a, b);
    const plan = planTool(this.world, this.tool, cells);
    const plantKind = plantKindOfTool(this.tool);
    // A power line stands one pole every few cells: the ground in between is not a refusal, so the
    // preview paints only the poles instead of turning the whole drag red.
    const shown = footprintOfTool(this.tool, this.world.n, b[0], b[1]) ?? (this.tool === 'line' && plan.cells.length > 0 ? plan.cells : cells);
    this.view.preview = {
      cells: shown,
      valid: new Set(plan.cells.map(([x, y]) => this.world.idx(x, y))),
      color: PREVIEW_COLORS[this.tool] ?? 'rgba(255,255,255,0.4)',
      halo: plantKind ? reachCells(this.world.n, shown, POWER_REACH) : this.tool === 'bus' ? busArea(this.world.n, shown[0][0], shown[0][1]) : undefined,
    };
    const tip = $('#tooltip');
    tip.classList.remove('hidden');
    tip.style.left = `${mx}px`;
    tip.style.top = `${my}px`;
    if (plan.cells.length === 0) {
      tip.textContent = this.refusalAt(b) ?? (this.tool === 'bulldoze' ? 'Nada para demoler' : 'No se puede acá');
      tip.classList.add('bad');
    } else if (plan.cost > this.sim.state.cash) {
      tip.textContent = `${formatMoney(plan.cost)} · no alcanza`;
      tip.classList.add('bad');
    } else {
      const upkeep = placementUpkeep(this.tool);
      const reach = placementNote(this.tool);
      // A wind farm is worth what the land under it gives: say it before the player pays.
      const note = plantKind === 'wind' ? `rinde ${windOutput(this.world, shown[0][0], shown[0][1])} MW acá · ${reach}` : reach;
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
    // On a phone the box is narrow: from a million up the amount is shown in millions, the whole figure stays in the tooltip.
    const narrow = window.matchMedia('(max-width: 600px)').matches && Math.abs(s.cash) >= 1e6;
    cash.textContent = narrow ? `${s.cash < 0 ? '-' : ''}$ ${(Math.abs(s.cash) / 1e6).toFixed(Math.abs(s.cash) >= 1e8 ? 0 : 1).replace('.', ',')} M` : formatMoney(s.cash);
    cash.title = narrow ? formatMoney(s.cash) : '';
    cash.classList.toggle('neg', s.cash < 0);
    this.updateOutlook(force);
    $('#pop').textContent = formatNumber(this.sim.totals.pop);
    $('#cityType').textContent = ` · ${settlementType(this.sim.totals.pop)}`;
    // The run goes first: its draft owns the moment, ahead of the milestone plaque and the ballot.
    this.updateRun();
    this.updateMilestone();
    this.updateApproval();
    const bars = document.querySelectorAll<HTMLElement>('#rci .bar i');
    const d = [this.sim.demand.R, this.sim.demand.C, this.sim.demand.I];
    bars.forEach((el, k) => {
      const v = d[k];
      el.style.height = `${Math.abs(v) / 2}%`;
      el.style.top = v >= 0 ? `${50 - v / 2}%` : '50%';
      el.style.opacity = v >= 0 ? '1' : '0.45';
    });
    const stalled = this.sim.stallText();
    $('#rci').title = `Demanda — Residencial: ${d[0]} · Comercial: ${d[1]} · Industrial: ${d[2]}${stalled ? `
${stalled}` : ''}`;
    const stall = $('#stall');
    stall.classList.toggle('hidden', !stalled);
    if (stalled) {
      stall.textContent = `⚠ No llega gente nueva: ${STALL_LABELS[this.sim.stall!]}`;
      stall.title = stalled;
    }
    const promise = this.sim.commitmentText();
    const warning = $('#promise');
    warning.classList.toggle('hidden', !promise);
    if (promise) {
      warning.textContent = promise;
      warning.title = 'Una promesa hecha a los vecinos. Si no está para la fecha, se lo toman a mal.';
    }
    const cityAndMonth = `${this.name} · ${dateLabel(s.tick)}`;
    $('#ribbonText').textContent = cityAndMonth;
    $('#newsDate').textContent = cityAndMonth;
    const head = s.news[0] ? s.news[0].date + s.news[0].text + s.news.length : '';
    if (force || head !== this.shownNews) {
      const fresh = !force && this.shownNews !== '';
      this.shownNews = head;
      if (fresh) {
        this.hooks.sound.play('news');
        this.flagNews();
      }
      $('#news').innerHTML = s.news
        .map((n, k) => `<li class="${k === 0 && fresh ? 'fresh' : ''}"><time>${escapeHtml(n.date)}</time>${escapeHtml(n.text)}</li>`)
        .join('');
    }
    if (this.queried) this.renderInfo();
    if (force) this.updateStatus();
  }

  /** A yellow dot on the newspaper button of a phone for a new story, unless the paper was read a moment ago. */
  private flagNews(): void {
    const btn = $('#btnDiario');
    const quiet = Number(btn.dataset.quietUntil ?? 0);
    if (Date.now() >= quiet && !$('#app').classList.contains('diario-open')) btn.classList.add('unread');
  }

  /** Approval next to the population, the date of the next election, and the ballot of an election night. */
  private updateApproval(): void {
    const s = this.sim.state;
    const el = $('#approval');
    // Under a theocracy the plaque is the favor of God, in its own dress; the neighbours' approval goes under it.
    const divine = s.government === 'teocracia';
    const box = $('#approvalBox');
    box.classList.toggle('divino', divine);
    box.dataset.mood = divine ? moodOf(s.favor) : '';
    box.title = divine ? 'Aprobación divina: clic para ver el detalle' : 'Aprobación de los vecinos: clic para ver el detalle';
    $('#approvalTag').textContent = divine ? 'Aprobación divina' : 'Aprobación';
    el.textContent = `${divine ? s.favor : s.approval} %`;
    el.className = divine ? '' : s.approval >= APPROVAL.toWin ? 'tone-good' : s.approval >= APPROVAL.toWin - 10 ? 'tone-warn' : 'tone-bad';
    // Nobody votes under a dictatorship: the line under the approval goes away instead of lying.
    const vote = s.lostElection ? 'modo libre' : nextElectionYear(s.tick, s.government);
    const line = $('#election');
    line.textContent = divine ? `Vecinos ${s.approval} %` : vote === null ? '' : typeof vote === 'string' ? vote : s.government === 'comunismo' ? `congreso en oct ${vote}` : `vota en oct ${vote}`;
    line.classList.toggle('hidden', vote === null && !divine);
    // One panel at a time: a ballot waits for the plaque (or whatever is open) to be closed.
    if (this.hooks.isModalOpen()) return;
    if (s.terms > this.shownTerms) {
      this.shownTerms = s.terms;
      this.hooks.sound.play('news');
      openElectionWon(this);
    } else if (s.lostElection && !this.shownLost && !s.run) {
      // A run has its own closing window (see `updateRun`): it does not offer free mode.
      this.shownLost = true;
      openElectionLost(this, () => this.hooks.leave());
    }
  }

  /** The run's goal under the population: the draft, the countdown in the red, and the end of the run. */
  private updateRun(): void {
    const s = this.sim.state;
    const run = s.run;
    if (!run) return;
    const goal = $('#goal');
    goal.innerHTML = `→ <span class="goal-name">Un millón: </span>${formatNumber(RUN_GOAL)}${run.dry > 0 ? ` · <span class="tone-bad">rojo ${run.dry}/${RUN_DRY_MONTHS}</span>` : ''}`;
    goal.title = `Modo roguelike: ganás con ${formatNumber(RUN_GOAL)} habitantes. Mejoras elegidas: ${run.picks.length} de ${RUN_MARKS.length}.`;
    const over = runOver(s);
    if (over) {
      if (this.shownRunOver || this.hooks.isModalOpen()) return;
      this.shownRunOver = over;
      this.setSpeed(0);
      this.hooks.sound.play('news');
      openRunOver(this, over, () => this.hooks.leave(), () => this.hooks.restart());
      return;
    }
    // The draft stops the clock like an event does, and the clock goes back where it was when it is answered.
    if (run.offer && !this.hooks.isModalOpen()) {
      if (this.speed > 0) this.speedBeforeEvent = this.speed;
      this.setSpeed(0);
      this.hooks.sound.play('news');
      openUpgrades(this);
    }
  }

  /** Takes one of the three cards of a draft: the city changes at once and the clock goes back to its speed. */
  takeUpgrade(id: string): void {
    if (!this.sim.applyUpgrade(id)) return;
    this.setSpeed(this.speedBeforeEvent);
    this.afterEdit();
  }

  /** The next goal under the population, the locked tools, and the plaque when a milestone is reached. */
  private updateMilestone(): void {
    const reached = this.sim.state.milestone;
    // Several milestones reached at once show one plaque, for the highest.
    if (reached > this.announcedMilestone && !this.hooks.isModalOpen()) {
      this.announcedMilestone = reached;
      this.hooks.sound.play('news');
      openMilestone(this, reached);
    }
    if (reached === this.shownMilestone) return;
    const label = (t: ToolId) => toolInfo(t).label;
    this.shownMilestone = reached;
    const next = nextMilestone(reached);
    const goal = $('#goal');
    // A run has its own goal line, and `updateRun` writes it.
    if (!this.sim.state.run) {
      goal.innerHTML = next ? `→ <span class="goal-name">${escapeHtml(next.name)}: </span>${formatNumber(next.pop)}` : '';
    }
    if (next) {
      const opens = unlockNames(next, label);
      goal.title = `Próximo hito: ${next.name}, con ${formatNumber(next.pop)} habitantes. La Provincia gira ${formatMoney(next.grant)}${opens ? ` y se habilita ${opens}` : ''}.`;
    }
    this.view.bubbleKinds = { health: isUnlocked('clinic', reached), crime: isUnlocked('police', reached), school: isUnlocked('school', reached) };
    this.toolbar.showLocks(reached);
  }

  /** Estimated monthly balance next to the cash, with how long the cash lasts when it is short. */
  private updateOutlook(force: boolean): void {
    const s = this.sim.state;
    const now = performance.now();
    if (force || !this.outlookBudget || now - this.outlookAt > 400) {
      this.outlookBudget = monthlyBudget(this.world, s.taxes, s.funding, s.loan, dateOf(s.tick).month, s.green, 1, s.transport, s.government, incomeFactor(s.effects), s.roads, s.plants, this.sim.mods);
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
      .join('')}</ul>${(r.issues ?? []).map((m) => `<p class="issue"><img src="${bubbleIcon(m.issue)}" alt="" width="26" height="30">${escapeHtml(m.text)}</p>`).join('')}${r.hint ? `<p class="hint">${escapeHtml(r.hint)}</p>` : ''}`;
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
