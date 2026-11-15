import { describe, expect, it } from 'vitest';
import { DEFAULT_FUNDING, MAX_LEVEL, SERVICES, SERVICE_KINDS } from '../src/config';
import { deserialize, serialize } from '../src/save/save';
import { monthlyBudget } from '../src/sim/budget';
import { SERVICE_NEED, levelCap } from '../src/sim/demand';
import { computePower } from '../src/sim/power';
import { computeServices } from '../src/sim/fields';
import { isUnlocked, milestoneOfTool } from '../src/sim/milestones';
import { describeCell } from '../src/sim/report';
import { Simulation, newSimState } from '../src/sim/simulation';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { TOOL_GROUPS, applyPlan, dragCells, planTool, type ToolId } from '../src/world/tools';
import { TILE, World, serviceOf, serviceTile } from '../src/world/world';

const N = 40;
const flat = (): Terrain => ({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(SEA_LEVEL + 1), trees: new Uint8Array(N * N) });

function build(w: World, tool: ToolId, ax: number, ay: number, bx = ax, by = ay): void {
  applyPlan(w, planTool(w, tool, dragCells(tool, ax, ay, bx, by, 1, N)));
}

/** A lit block of homes with a street, and the given service placed in the middle of it. */
function blockWith(tool: ToolId | null): World {
  const w = new World(flat());
  build(w, 'plant', 0, 11); // next to the homes, which carry the light on
  build(w, 'plant', 0, 13);
  build(w, 'road', 2, 10, 36, 10);
  build(w, 'zoneR', 3, 11, 36, 14);
  build(w, 'zoneC', 3, 6, 36, 8);
  if (tool) build(w, tool, 20, 16);
  for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === TILE.R) w.level[i] = 3;
  computePower(w);
  computeServices(w);
  return w;
}

describe('the second-level services', () => {
  it('are two more services, dearer and wider than the first four, with their own tiles and tools', () => {
    expect(SERVICE_KINDS).toEqual(expect.arrayContaining(['hospital', 'university']));
    for (const kind of ['hospital', 'university'] as const) {
      expect(SERVICES[kind].cost).toBeGreaterThan(SERVICES.school.cost);
      expect(SERVICES[kind].upkeep).toBeGreaterThan(SERVICES.school.upkeep);
      expect(SERVICES[kind].radius).toBeGreaterThan(SERVICES.school.radius);
      expect(DEFAULT_FUNDING[kind]).toBe(100);
      expect(serviceOf(serviceTile(kind))).toBe(kind);
    }
    expect(TOOL_GROUPS.find((g) => g.label === 'Servicios')?.tools).toEqual(expect.arrayContaining(['hospital', 'university']));
  });

  it('open with the milestone of a thriving city, not before', () => {
    const at = milestoneOfTool('hospital');
    expect(at).toBe(milestoneOfTool('university'));
    expect(isUnlocked('hospital', at - 1)).toBe(false);
    expect(isUnlocked('university', at)).toBe(true);
    expect(at).toBeGreaterThan(milestoneOfTool('school'));
  });

  it('cover a wide area, and also do what a clinic and a school do', () => {
    const hospital = blockWith('hospital');
    const i = hospital.idx(30, 12);
    expect(hospital.hospital[i]).toBeGreaterThan(0);
    expect(hospital.health[i]).toBeGreaterThan(0);
    expect(hospital.university[i]).toBe(0);
    const university = blockWith('university');
    expect(university.university[i]).toBeGreaterThan(0);
    expect(university.edu[i]).toBeGreaterThan(0);
    expect(university.hospital[i]).toBe(0);
    const none = blockWith(null);
    expect([none.hospital[i], none.university[i], none.health[i], none.edu[i]]).toEqual([0, 0, 0, 0]);
  });

  it('are what the tallest buildings ask for: homes a hospital, shops and factories a university', () => {
    const all = { edu: 100, health: 100 };
    // A big, valuable city, with every first-level service.
    const top = (zone: 'R' | 'C' | 'I', extra: { hospital?: number; university?: number }) => levelCap(zone, 100, 100000, { ...all, ...extra });
    expect(top('R', {})).toBe(MAX_LEVEL);
    expect(top('R', { hospital: 0 })).toBe(MAX_LEVEL - 1);
    expect(top('R', { hospital: SERVICE_NEED })).toBe(MAX_LEVEL);
    expect(top('C', { university: 0 })).toBe(MAX_LEVEL - 1);
    expect(top('I', { university: 0 })).toBe(MAX_LEVEL - 1);
    expect(top('I', { hospital: 0 })).toBe(MAX_LEVEL); // a factory has no use for a hospital
  });

  it('cost their upkeep in the budget, with a line each, and obey their own slider', () => {
    const w = blockWith('hospital');
    build(w, 'university', 24, 16);
    const full = monthlyBudget(w, 7);
    expect(full.hospitals).toBeGreaterThan(0);
    expect(full.universities).toBeGreaterThan(0);
    const cut = monthlyBudget(w, 7, { ...DEFAULT_FUNDING, hospital: 50 });
    expect(cut.hospitals).toBe(Math.round(full.hospitals / 2));
    expect(cut.universities).toBe(full.universities);
    expect(full.expenses).toBeGreaterThanOrEqual(full.hospitals + full.universities);
  });

  it('say on their card what they are for, and the lot says what it lacks', () => {
    const w = blockWith('hospital');
    const sim = new Simulation(w, newSimState(1), 'X');
    sim.refresh();
    const card = describeCell(w, sim, 20, 16);
    expect(card.title).toBe('Hospital');
    expect(card.lines.join(' ')).toMatch(/casas más altas/);
  });

  it('are saved with the city, and an older save has them funded in full', () => {
    const w = blockWith('university');
    const sim = new Simulation(w, newSimState(1), 'X');
    const back = deserialize(serialize({ name: 'X', seed: 1, world: w, sim: sim.state }));
    expect(back.world.tileAt(20, 16)).toBe(TILE.UNIVERSITY);
    const old = JSON.parse(serialize({ name: 'X', seed: 1, world: w, sim: sim.state }));
    delete old.sim.funding.hospital;
    delete old.sim.funding.university;
    const opened = deserialize(JSON.stringify(old));
    expect(opened.sim.funding.hospital).toBe(100);
    expect(opened.sim.funding.university).toBe(100);
    // The last budget of an older city has no lines for them either: they count as zero.
    sim.state.lastBudget = monthlyBudget(w, 7);
    const older = JSON.parse(serialize({ name: 'X', seed: 1, world: w, sim: sim.state }));
    delete older.sim.lastBudget.hospitals;
    delete older.sim.lastBudget.universities;
    expect(deserialize(JSON.stringify(older)).sim.lastBudget?.hospitals).toBe(0);
  });
});

