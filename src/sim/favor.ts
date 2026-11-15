/**
 * The favor of God, the extra measure of a theocracy: 0 to 100, it moves a few points a month towards what the
 * city deserves, the way the neighbours' approval does, but it weighs other things. Smoke, crime, torn-down
 * houses and usury anger Him; kept plazas, health posts and a clean cash please Him. Low, He sends
 * catastrophes; high, miracles (the simulation rolls them, see `Simulation.judgement`).
 */
import { CAPACITY, DEFAULT_TAX, type ZoneTaxes } from '../config';
import { TILE, type World } from '../world/world';
import { averageTax } from './demand';
import { demolitionPoints, type ApprovalFactor } from './politics';

export const FAVOR = {
  /** Favor of a brand-new city. */
  start: 60,
  /** Most points it moves in a month. */
  step: 3,
  /** Below this He is angry: a catastrophe may fall each month. */
  wrath: 35,
  /** Above this He is pleased: a miracle may come each month. */
  grace: 75,
  /** Smoke and crime (0 to 100) that He tolerates, like the neighbours. */
  tolerated: 10,
  /** Average tax rate from which He calls it usury. */
  usury: 12,
} as const;

export interface FavorInputs {
  taxes: ZoneTaxes;
  /** The cash is in the red. */
  crisis: boolean;
  /** Abandoned buildings. */
  abandoned: number;
  /** People affected by recent demolitions; see `demolitionPoints`. */
  grief: number;
  pop: number;
  /** Budget for green spaces, percent. */
  green: number;
}

export interface FavorReport {
  /** What the city deserves from above today, 0 to 100. */
  target: number;
  /** What pleases and what angers, strongest first. */
  factors: ApprovalFactor[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** What the city deserves from above today and why. Reads the smoke, crime and health layers. */
export function computeFavor(w: World, inp: FavorInputs): FavorReport {
  let residents = 0;
  let health = 0;
  let crime = 0;
  let smoke = 0;
  let built = 0;
  for (let i = 0; i < w.tiles.length; i++) {
    if (w.level[i] === 0) continue;
    built++;
    if (w.tiles[i] !== TILE.R || !w.isOccupied(i)) continue;
    const r = CAPACITY.R[w.level[i]];
    residents += r;
    health += w.health[i] * r;
    crime += w.crime[i] * r;
    smoke += w.pollution[i] * r;
  }
  const raw: [string, number][] = [];
  if (residents > 0) {
    const avg = (sum: number) => sum / residents;
    raw.push(['Humo y contaminación', -Math.min(15, Math.max(0, avg(smoke) - FAVOR.tolerated) * 0.3)]);
    raw.push(['Delito', -Math.min(12, Math.max(0, avg(crime) - FAVOR.tolerated) * 0.25)]);
    // A village is not asked for a hospital: the charity expected grows with the city.
    const expects = Math.min(1, inp.pop / 1000);
    raw.push(['Obras de caridad', expects * clamp((avg(health) - 35) / 65, -1, 1) * 8]);
  }
  if (built > 0) raw.push(['Edificios abandonados', -Math.min(10, (70 * inp.abandoned) / built)]);
  const tax = averageTax(inp.taxes);
  raw.push(['Usura', tax > FAVOR.usury ? -Math.min(12, (tax - FAVOR.usury) * 2) : 0]);
  raw.push(['Impuestos bajos', tax <= DEFAULT_TAX ? Math.min(6, DEFAULT_TAX - tax) : 0]);
  raw.push(['Demoliciones', -Math.min(15, demolitionPoints(inp.grief, inp.pop) * 1.5)]);
  raw.push(['Jardines y plazas', (10 * clamp(inp.green, 0, 120)) / 100]);
  raw.push(['Caja en rojo', inp.crisis ? -10 : 0]);
  const factors = raw.map(([label, v]) => ({ label, points: Math.round(v) })).filter((f) => f.points !== 0);
  factors.sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
  return { target: clamp(50 + factors.reduce((sum, f) => sum + f.points, 0), 0, 100), factors };
}

/** The favor a month later: it moves towards the target, at most `FAVOR.step` points. */
export function stepFavor(current: number, target: number): number {
  return clamp(current + clamp(target - current, -FAVOR.step, FAVOR.step), 0, 100);
}

export type Mood = 'wrath' | 'calm' | 'grace';

/** How He feels: angry under `FAVOR.wrath`, pleased over `FAVOR.grace`. */
export function moodOf(favor: number): Mood {
  return favor < FAVOR.wrath ? 'wrath' : favor > FAVOR.grace ? 'grace' : 'calm';
}

/** Chance (0 to 1) that something falls from above this month: nothing in the calm, more the further out He is. */
export function judgementChance(favor: number): number {
  const mood = moodOf(favor);
  if (mood === 'wrath') return 0.3 + 0.5 * ((FAVOR.wrath - favor) / FAVOR.wrath);
  if (mood === 'grace') return 0.25 + 0.25 * ((favor - FAVOR.grace) / (100 - FAVOR.grace));
  return 0;
}
