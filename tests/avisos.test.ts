import { describe, expect, it } from 'vitest';
import { milestoneOfTool } from '../src/sim/milestones';
import { describeCell } from '../src/sim/report';
import { Simulation, newSimState } from '../src/sim/simulation';
import { BUBBLE_MASS, buildingIssues, capBubbleItems, type Issue } from '../src/sim/warnings';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { TILE, World } from '../src/world/world';

function flat(n = 16): Terrain {
  const s = n + 1;
  return { n, corners: new Uint8Array(s * s).fill(SEA_LEVEL + 1), trees: new Uint8Array(n * n) };
}

const all = { health: true, crime: true, school: true };
const none = { health: false, crime: false, school: false };

/** A lit home with a clinic near, safe and clean, on lot (3, 3): the starting point of each case. */
function home(tile: number = TILE.R): { w: World; i: number } {
  const w = new World(flat());
  w.setTile(3, 3, tile, 2);
  const i = w.idx(3, 3);
  w.powered[i] = 1;
  w.roadAccess[i] = 1;
  w.health[i] = 80;
  return { w, i };
}

describe('the bubbles over a building', () => {
  it('shows nothing for a healthy building, or for land with nothing built', () => {
    const { w, i } = home();
    expect(buildingIssues(w, i, all)).toEqual([]);
    expect(buildingIssues(w, w.idx(5, 5), all)).toEqual([]);
  });

  it('shows only the dark when there is no light, whatever else is wrong', () => {
    const { w, i } = home();
    w.powered[i] = 0;
    w.crime[i] = 90;
    expect(buildingIssues(w, i, all)).toEqual(['power']);
  });

  it('shows crime, the lack of a health post and smoke in a home, in that order', () => {
    const { w, i } = home();
    w.crime[i] = 61;
    w.health[i] = 10;
    w.pollution[i] = 71;
    expect(buildingIssues(w, i, all)).toEqual(['crime', 'health', 'smoke']);
    w.crime[i] = 60;
    w.pollution[i] = 70;
    expect(buildingIssues(w, i, all)).toEqual(['health']);
  });

  it('does not warn about a service the player cannot build yet', () => {
    const { w, i } = home();
    w.crime[i] = 90;
    w.health[i] = 0;
    expect(buildingIssues(w, i, none)).toEqual([]);
  });

  it('asks a factory for nothing but light and a shop for nothing but safety', () => {
    const f = home(TILE.I);
    f.w.crime[f.i] = 90;
    f.w.health[f.i] = 0;
    f.w.pollution[f.i] = 90;
    expect(buildingIssues(f.w, f.i, all)).toEqual([]);
    const s = home(TILE.C);
    s.w.crime[s.i] = 90;
    s.w.health[s.i] = 0;
    expect(buildingIssues(s.w, s.i, all)).toEqual(['crime']);
  });

  it('asks for a street when none reaches the building, after the light and before the rest', () => {
    const { w, i } = home();
    w.roadAccess[i] = 0;
    w.crime[i] = 90;
    expect(buildingIssues(w, i, all)).toEqual(['road', 'crime']);
    w.powered[i] = 0;
    expect(buildingIssues(w, i, all)).toEqual(['power']);
  });

  it('asks the buildings of the coast for light and a street, and the services for neither street', () => {
    const w = new World(flat());
    w.setTile(3, 3, TILE.FISHING);
    const i = w.idx(3, 3);
    expect(buildingIssues(w, i, all)).toEqual(['power']);
    w.powered[i] = 1;
    expect(buildingIssues(w, i, all)).toEqual(['road']);
    w.roadAccess[i] = 1;
    expect(buildingIssues(w, i, all)).toEqual([]);
    w.setTile(5, 5, TILE.SCHOOL);
    w.powered[w.idx(5, 5)] = 1;
    expect(buildingIssues(w, w.idx(5, 5), all)).toEqual([]);
  });

  it('warns of a street so full that the lot grows slowly', () => {
    const { w, i } = home();
    w.jam[i] = 120;
    expect(buildingIssues(w, i, all)).toEqual([]);
    w.jam[i] = 121;
    expect(buildingIssues(w, i, all)).toEqual(['jam']);
  });

  it('warns of a home or a shop that cannot grow for lack of a school, not of a factory', () => {
    const { w, i } = home();
    w.level[i] = 3;
    w.fireCover[i] = 90;
    w.edu[i] = 5;
    expect(buildingIssues(w, i, all)).toEqual(['school']);
    expect(buildingIssues(w, i, { ...all, school: false })).toEqual([]);
    const f = home(TILE.I);
    f.w.level[f.i] = 3;
    f.w.fireCover[f.i] = 90;
    f.w.edu[f.i] = 5;
    expect(buildingIssues(f.w, f.i, all)).toEqual([]);
  });

  it('shows an abandoned building as empty, and a plaza nobody keeps as dry', () => {
    const { w, i } = home();
    w.abandoned[i] = 1;
    w.crime[i] = 90;
    expect(buildingIssues(w, i, all)).toEqual(['empty']);
    const p = new World(flat());
    for (let x = 4; x < 7; x++) p.setTile(x, 4, TILE.PARK);
    const j = p.idx(5, 4);
    p.parkArea[j] = 3;
    p.parkCare[j] = 90;
    expect(buildingIssues(p, j, all)).toEqual([]);
    p.parkCare[j] = 10;
    expect(buildingIssues(p, j, all)).toEqual(['dry']);
    p.parkArea[j] = 1; // a lone cell of park is not a plaza
    expect(buildingIssues(p, j, all)).toEqual([]);
  });

  it('leaves a burning building to the firefighters', () => {
    const { w, i } = home();
    w.powered[i] = 0;
    w.fire[i] = 1;
    expect(buildingIssues(w, i, all)).toEqual([]);
  });
});

describe('the cap of bubbles when a problem is town-wide', () => {
  it('passes the list through while every problem fits under the cap', () => {
    const items = [{ i: 0, issues: ['power'] as Issue[] }, { i: 1, issues: ['crime'] as Issue[] }];
    expect(capBubbleItems(items, new Uint8Array(2))).toEqual(items);
  });

  it('keeps the angriest BUBBLE_MASS buildings for a problem over the cap, so the complaint is always seen', () => {
    const items = Array.from({ length: BUBBLE_MASS + 5 }, (_, i) => ({ i, issues: ['power'] as Issue[] }));
    const anger = new Uint8Array(BUBBLE_MASS + 5);
    anger[0] = 100;
    anger[BUBBLE_MASS + 4] = 90;
    const kept = capBubbleItems(items, anger);
    expect(kept.length).toBe(BUBBLE_MASS);
    expect(kept.some((it) => it.i === 0)).toBe(true);
    expect(kept.some((it) => it.i === BUBBLE_MASS + 4)).toBe(true);
  });

  it('a building past the cap still shows its other complaints', () => {
    const items = Array.from({ length: BUBBLE_MASS + 1 }, (_, i) => ({
      i,
      issues: (i === BUBBLE_MASS ? ['power', 'crime'] : ['power']) as Issue[],
    }));
    const kept = capBubbleItems(items, new Uint8Array(BUBBLE_MASS + 1));
    const last = kept.find((it) => it.i === BUBBLE_MASS);
    expect(last?.issues).toEqual(['crime']);
    expect(kept.filter((it) => it.issues.includes('power')).length).toBe(BUBBLE_MASS);
  });
});

describe('what the bubble means on the card of "Consulta"', () => {
  it('explains each problem of the building, with its numbers, and nothing for a healthy one', () => {
    const { w, i } = home();
    const sim = new Simulation(w, newSimState(1), 'X');
    sim.state.milestone = Math.max(milestoneOfTool('clinic'), milestoneOfTool('police'));
    w.powered[i] = 1;
    w.roadAccess[i] = 1;
    w.crime[i] = 75;
    w.health[i] = 5;
    const card = describeCell(w, sim, 3, 3);
    expect(card.issues?.map((m) => m.issue)).toEqual(['crime', 'health']);
    expect(card.issues?.[0].text).toMatch(/Mucho delito \(75\/100\)/);
    expect(card.issues?.[1].text).toMatch(/No llega la salud \(5\/100\)/);
    w.crime[i] = 0;
    w.health[i] = 90;
    expect(describeCell(w, sim, 3, 3).issues).toBeUndefined();
  });

  it('explains the dark on the card of a building without light', () => {
    const { w, i } = home();
    w.powered[i] = 0;
    const card = describeCell(w, new Simulation(w, newSimState(1), 'X'), 3, 3);
    expect(card.issues).toEqual([{ issue: 'power', text: expect.stringMatching(/^Sin luz/) }]);
  });
});
