import { CAPACITY } from '../config';
import { dateLabel } from '../sim/calendar';
import { deserialize, serialize, type SaveData } from './save';

export type SlotId = '1' | '2' | '3' | 'auto';
export const SLOTS: SlotId[] = ['1', '2', '3', 'auto'];

const key = (slot: SlotId) => `argencity3000/slot/${slot}`;

export interface SlotInfo {
  slot: SlotId;
  name: string;
  date: string;
  pop: number;
  savedAt: string;
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Light summary of a slot without building the whole world. */
export function slotInfo(slot: SlotId): SlotInfo | null {
  const raw = storage()?.getItem(key(slot));
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    const levels = atob(d.level);
    const tiles = atob(d.tiles);
    let pop = 0;
    for (let i = 0; i < tiles.length; i++) if (tiles.charCodeAt(i) === 3) pop += CAPACITY.R[levels.charCodeAt(i)] ?? 0;
    return { slot, name: String(d.name), date: dateLabel(Number(d.sim?.tick) || 0), pop, savedAt: String(d.savedAt ?? '') };
  } catch {
    return { slot, name: 'Partida dañada', date: '—', pop: 0, savedAt: '' };
  }
}

export function saveToSlot(slot: SlotId, data: SaveData): void {
  const s = storage();
  if (!s) throw new Error('El navegador no permite guardar partidas');
  try {
    s.setItem(key(slot), serialize(data));
  } catch {
    throw new Error('No hay espacio para guardar la partida');
  }
}

export function loadFromSlot(slot: SlotId): SaveData {
  const raw = storage()?.getItem(key(slot));
  if (!raw) throw new Error('Esa ranura está vacía');
  return deserialize(raw);
}

export function deleteSlot(slot: SlotId): void {
  storage()?.removeItem(key(slot));
}
