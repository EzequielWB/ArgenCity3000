/**
 * The toolbar: five categories that open a flyout with their tools, plus undo, block size, the
 * layers and the view controls. It only draws and reports clicks; the game decides what happens.
 */
import { BUS, COAST, COSTS, HUBS, PLANTS, ROAD_TIERS, SERVICES } from '../config';
import { formatMoney, formatNumber } from '../core/format';
import type { Layer } from '../render/view';
import { MILESTONES, isUnlocked, milestoneOfTool } from '../sim/milestones';
import { TOOL_GROUPS, groupOfTool, isCoastTool, isServiceTool, plantKindOfTool, roadTierOfTool, toolInfo, type ToolGroup, type ToolId } from '../world/tools';
import { escapeHtml } from './dom';
import { TOOL_ICONS } from './icons';

/** What one lot or one building of a tool costs, or null when the tool is free. */
export function toolPrice(tool: ToolId): number | null {
  const plant = plantKindOfTool(tool);
  if (plant) return PLANTS[plant].cost;
  const tier = roadTierOfTool(tool);
  if (tier !== null) return ROAD_TIERS[tier].cost;
  if (isServiceTool(tool)) return SERVICES[tool].cost;
  if (isCoastTool(tool)) return COAST[tool].cost;
  switch (tool) {
    case 'bus':
      return BUS.cost;
    case 'airport':
    case 'harbor':
      return HUBS[tool].cost;
    case 'line':
      return COSTS.line;
    case 'park':
      return COSTS.park;
    case 'bulldoze':
      return COSTS.bulldoze;
    case 'zoneR':
    case 'zoneC':
    case 'zoneI':
      return COSTS.zone;
    default:
      return null;
  }
}

/** Why a locked tool cannot be used yet. */
export function lockNotice(tool: ToolId): string {
  const m = MILESTONES[milestoneOfTool(tool)];
  return `${toolInfo(tool).label}: se habilita cuando la ciudad sea ${m.name} (${formatNumber(m.pop)} habitantes)`;
}

const pixelIcon = (rects: string) => `<svg viewBox="0 0 10 10" aria-hidden="true">${rects}</svg>`;
const px = (x: number, y: number, w: number, h: number, fill: string) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;

/** Pixel pictograms of the categories: a magnifier, a street with a pole, four zones, a school with its flag, a plant, a lighthouse on the shore. */
const GROUP_ICONS: Record<ToolGroup['id'], string> = {
  query: pixelIcon(px(3, 1, 4, 4, '#bcd3ee') + px(4, 2, 2, 2, '#1f4f8a') + px(6, 5, 1, 1, '#e0a526') + px(7, 6, 1, 1, '#e0a526') + px(8, 7, 1, 2, '#e0a526')),
  network: pixelIcon(px(0, 4, 10, 3, '#5a5560') + px(1, 5, 2, 1, '#f6f2e8') + px(5, 5, 2, 1, '#f6f2e8') + px(7, 0, 1, 4, '#6b4a2e') + px(5, 1, 5, 1, '#ffd84a')),
  zones: pixelIcon(px(0, 1, 4, 4, '#7cc06a') + px(5, 1, 4, 4, '#6fb7e0') + px(0, 6, 4, 3, '#e0b542') + px(5, 6, 4, 3, '#8e6cc2')),
  services: pixelIcon(
    px(1, 4, 8, 5, '#f4f0e6') + px(0, 3, 10, 1, '#b4532f') + px(4, 5, 2, 4, '#2f9a55') + px(3, 6, 4, 2, '#2f9a55') + px(2, 0, 1, 3, '#d9d4cc') + px(3, 0, 3, 1, '#74acdf'),
  ),
  plants: pixelIcon(
    px(1, 5, 8, 4, '#b36a45') + px(2, 0, 2, 5, '#c8462f') + px(2, 2, 2, 1, '#f6f2e8') + px(6, 3, 1, 2, '#ffd84a') + px(5, 5, 2, 1, '#ffd84a') + px(5, 6, 1, 2, '#ffd84a'),
  ),
  transport: pixelIcon(
    px(0, 3, 10, 5, '#c8392f') + px(0, 3, 10, 1, '#e8c0b8') + px(1, 4, 2, 2, '#9fd3ee') + px(4, 4, 2, 2, '#9fd3ee') + px(7, 4, 2, 2, '#9fd3ee') + px(0, 7, 10, 1, '#7a1f19') + px(1, 8, 2, 2, '#1f1611') + px(7, 8, 2, 2, '#1f1611'),
  ),
  coast: pixelIcon(
    px(0, 6, 10, 3, '#4f8fb0') + px(0, 9, 10, 1, '#e2cc94') + px(1, 7, 2, 1, '#cfe6ec') + px(6, 8, 3, 1, '#cfe6ec') + px(4, 1, 2, 5, '#f6f2e8') + px(4, 2, 2, 1, '#c8392f') + px(4, 4, 2, 1, '#c8392f') + px(4, 0, 2, 1, '#ffd84a'),
  ),
};

const LAYERS_FLYOUT = 'layers';

export interface ToolbarActions {
  setTool(tool: ToolId): void;
  setBlock(block: number): void;
  setLayer(layer: Layer): void;
  undo(): void;
  rotate(dir: number): void;
  zoom(dir: number): void;
}

export class Toolbar {
  private opened: string | null = null;

  constructor(
    private bar: HTMLElement,
    private flyout: HTMLElement,
    private layers: readonly { id: Layer; label: string }[],
    private actions: ToolbarActions,
  ) {
    const cats = TOOL_GROUPS.map(
      (g) =>
        `<button class="cat" type="button" data-fly="${g.id}" aria-expanded="false" aria-controls="flyout" title="${escapeHtml(`${g.label}: ${g.tools.map((t) => toolInfo(t).label).join(', ')}`)}">${GROUP_ICONS[g.id]}<span>${escapeHtml(g.label)}</span></button>`,
    ).join('');
    const blocks = [1, 2, 4]
      .map((b) => `<button type="button" data-block="${b}" aria-pressed="false" title="Bloque de ${b}×${b} para zonas, plazas y topadora (B)">${b}×${b}</button>`)
      .join('');
    bar.innerHTML = `${cats}
      <button type="button" data-act="undo" title="Deshacer la última obra (Ctrl+Z)">Deshacer</button>
      <div class="group-label" id="blockLabel">Bloque</div>
      <div class="seg" role="group" aria-labelledby="blockLabel">${blocks}</div>
      <div class="group-label" id="layerLabel">Capa</div>
      <button type="button" data-fly="${LAYERS_FLYOUT}" aria-expanded="false" aria-controls="flyout" aria-describedby="layerLabel" title="Elegir la capa que se ve sobre el mapa (C pasa a la siguiente)"><span id="layerName"></span></button>
      <div class="group-label" id="viewLabel">Vista</div>
      <div class="seg view" role="group" aria-labelledby="viewLabel">
        <button type="button" data-act="rotl" title="Rotar a la izquierda (Q)" aria-label="Rotar a la izquierda">⟲</button>
        <button type="button" data-act="rotr" title="Rotar a la derecha (E)" aria-label="Rotar a la derecha">⟳</button>
        <button type="button" data-act="zin" title="Acercar (+)" aria-label="Acercar">＋</button>
        <button type="button" data-act="zout" title="Alejar (−)" aria-label="Alejar">−</button>
      </div>`;

    const toolRow = (t: ToolId) => {
      const info = toolInfo(t);
      return `<button class="tool" type="button" data-tool="${t}" aria-pressed="false">${TOOL_ICONS[t]}<kbd>${info.key.toUpperCase()}</kbd><span class="name">${escapeHtml(info.label)}</span><span class="price"></span></button>`;
    };
    const panels = TOOL_GROUPS.map((g) => `<div class="fly" data-panel="${g.id}" hidden><h3 class="filete">${escapeHtml(g.label)}</h3>${g.tools.map(toolRow).join('')}</div>`);
    const layerRows = layers.map((l) => `<button class="tool layer" type="button" data-layer="${l.id}" aria-pressed="false"><span class="name">${escapeHtml(l.label)}</span></button>`);
    panels.push(`<div class="fly" data-panel="${LAYERS_FLYOUT}" hidden><h3 class="filete">Capas</h3>${layerRows.join('')}</div>`);
    flyout.innerHTML = panels.join('');

    bar.addEventListener('click', this.onBarClick);
    flyout.addEventListener('click', this.onFlyoutClick);
    document.addEventListener('pointerdown', this.onOutside);
  }

  destroy(): void {
    this.close();
    this.bar.removeEventListener('click', this.onBarClick);
    this.flyout.removeEventListener('click', this.onFlyoutClick);
    document.removeEventListener('pointerdown', this.onOutside);
  }

  /** Marks the tool in use and its category, and puts the flyout away. */
  showTool(tool: ToolId): void {
    const group = groupOfTool(tool).id;
    this.bar.querySelectorAll<HTMLElement>('.cat').forEach((b) => b.classList.toggle('current', b.dataset.fly === group));
    this.flyout.querySelectorAll<HTMLElement>('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === tool)));
    this.close();
  }

  showBlock(block: number): void {
    this.bar.querySelectorAll<HTMLElement>('[data-block]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.block) === block)));
  }

  showLayer(layer: Layer): void {
    this.flyout.querySelectorAll<HTMLElement>('[data-layer]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.layer === layer)));
    this.bar.querySelector('#layerName')!.textContent = this.layers.find((l) => l.id === layer)?.label ?? '';
  }

  /** Greys the tools the city has not earned yet and says when each one opens. */
  showLocks(reached: number): void {
    this.flyout.querySelectorAll<HTMLElement>('[data-tool]').forEach((b) => {
      const tool = b.dataset.tool as ToolId;
      const info = toolInfo(tool);
      const locked = !isUnlocked(tool, reached);
      const m = MILESTONES[milestoneOfTool(tool)];
      const price = toolPrice(tool);
      b.classList.toggle('locked', locked);
      b.setAttribute('aria-disabled', String(locked));
      b.title = locked ? lockNotice(tool) : `${info.label} (${info.key.toUpperCase()}): ${info.help}`;
      b.querySelector('.price')!.textContent = locked ? `Población: ${formatNumber(m.pop)}` : price === null ? '' : formatMoney(price);
    });
  }

  isOpen(): boolean {
    return this.opened !== null;
  }

  close(): void {
    if (this.opened === null) return;
    const button = this.bar.querySelector<HTMLElement>(`[data-fly="${this.opened}"]`)!;
    const hadFocus = this.flyout.contains(document.activeElement);
    button.setAttribute('aria-expanded', 'false');
    this.flyout.querySelector<HTMLElement>(`[data-panel="${this.opened}"]`)!.hidden = true;
    this.flyout.classList.add('hidden');
    this.opened = null;
    if (hadFocus) button.focus();
  }

  private open(id: string, byKeyboard: boolean): void {
    this.close();
    const button = this.bar.querySelector<HTMLElement>(`[data-fly="${id}"]`)!;
    const panel = this.flyout.querySelector<HTMLElement>(`[data-panel="${id}"]`)!;
    button.setAttribute('aria-expanded', 'true');
    panel.hidden = false;
    this.flyout.classList.remove('hidden');
    this.opened = id;
    // Next to its button, but never past the bottom of the map.
    const stage = this.flyout.parentElement!.getBoundingClientRect();
    const top = button.getBoundingClientRect().top - stage.top;
    this.flyout.style.top = `${Math.max(6, Math.min(top, stage.height - this.flyout.offsetHeight - 6))}px`;
    if (byKeyboard) (panel.querySelector<HTMLElement>('[aria-pressed="true"]') ?? panel.querySelector<HTMLElement>('button'))?.focus();
  }

  private onBarClick = (e: MouseEvent) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    if (b.dataset.fly) {
      if (this.opened === b.dataset.fly) this.close();
      else this.open(b.dataset.fly, e.detail === 0);
    } else if (b.dataset.block) this.actions.setBlock(Number(b.dataset.block));
    else if (b.dataset.act === 'undo') this.actions.undo();
    else if (b.dataset.act === 'rotl') this.actions.rotate(-1);
    else if (b.dataset.act === 'rotr') this.actions.rotate(1);
    else if (b.dataset.act === 'zin') this.actions.zoom(1);
    else if (b.dataset.act === 'zout') this.actions.zoom(-1);
  };

  private onFlyoutClick = (e: MouseEvent) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    if (b.dataset.tool) this.actions.setTool(b.dataset.tool as ToolId);
    else if (b.dataset.layer) {
      this.actions.setLayer(b.dataset.layer as Layer);
      this.close();
    }
  };

  private onOutside = (e: PointerEvent) => {
    const target = e.target as Node;
    if (!this.bar.contains(target) && !this.flyout.contains(target)) this.close();
  };
}
