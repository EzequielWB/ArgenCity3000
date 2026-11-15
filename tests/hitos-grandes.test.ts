import { describe, expect, it } from 'vitest';
import { settlementType } from '../src/core/format';
import { INITIAL_CASH } from '../src/config';
import { headlinesFor, type CitySnapshot } from '../src/sim/news';
import { MILESTONES, advanceMilestones, isUnlocked, milestoneForPop, milestoneOfTool, nextMilestone } from '../src/sim/milestones';

const base: CitySnapshot = {
  pop: 0,
  buildings: 0,
  plants: 0,
  shortage: false,
  crisis: false,
  taxes: { R: 7, C: 7, I: 7 },
  funding: { school: 100, clinic: 100, police: 100, fire: 100, hospital: 100, university: 100 },
  green: 100,
  grief: 0,
  month: 1,
  year: 1990,
  cash: 1000,
  abandoned: 0,
  loan: null,
  ports: 0,
  resorts: 0,
};

describe('the ladder of milestones', () => {
  it('now climbs to 200.000', () => {
    expect(MILESTONES.map((m) => m.pop).slice(-3)).toEqual([50000, 100000, 200000]);
    expect(MILESTONES.map((m) => m.name).slice(-3)).toEqual(['Gran metrópolis', 'Megaciudad', 'Área metropolitana']);
    expect(nextMilestone(MILESTONES.length - 1)).toBeNull();
  });

  it('reaches the new ones with the population, and pays each one once', () => {
    expect(milestoneForPop(49999)).toBe(MILESTONES.length - 4);
    expect(milestoneForPop(50000)).toBe(MILESTONES.length - 3);
    expect(milestoneForPop(199999)).toBe(MILESTONES.length - 2);
    expect(milestoneForPop(200000)).toBe(MILESTONES.length - 1);

    const state = { milestone: MILESTONES.length - 4, cash: 0 };
    const reached = advanceMilestones(state, 200000);
    expect(reached.map((m) => m.name)).toEqual(['Gran metrópolis', 'Megaciudad', 'Área metropolitana']);
    expect(state.cash).toBe(50000 + 80000 + 120000);
    expect(advanceMilestones(state, 250000)).toEqual([]);
  });

  it('pays more at every step', () => {
    for (let k = 2; k < MILESTONES.length; k++) expect(MILESTONES[k].grant).toBeGreaterThan(MILESTONES[k - 1].grant);
  });

  it('leaves the tools where they were: appending does not move an index', () => {
    // Every tool still hangs from the milestone it had before the three new ones.
    const expected: [string, number][] = [['clinic', 1], ['school', 2], ['port', 3], ['plantWind', 4], ['lighthouse', 5]];
    for (const [tool, index] of expected) expect(milestoneOfTool(tool as never)).toBe(index);
    expect(isUnlocked('lighthouse' as never, 5)).toBe(true);
    expect(isUnlocked('lighthouse' as never, 4)).toBe(false);
    // And a city that sits at the old ceiling keeps its tools.
    expect(isUnlocked('plantWind' as never, milestoneForPop(25000))).toBe(true);
  });
});

describe('how the city is called', () => {
  it('climbs one name per shelf', () => {
    expect(settlementType(49999)).toBe('metrópolis');
    expect(settlementType(50000)).toBe('gran metrópolis');
    expect(settlementType(99999)).toBe('gran metrópolis');
    expect(settlementType(100000)).toBe('megaciudad');
    expect(settlementType(199999)).toBe('megaciudad');
    expect(settlementType(200000)).toBe('área metropolitana');
    expect(settlementType(500000)).toBe('área metropolitana');
  });
});

describe('the newspaper', () => {
  it('announces the top milestone once', () => {
    const crossed = headlinesFor({ ...base, pop: 199999 }, { ...base, pop: 200001 }, 'Villa Test');
    expect(crossed.some((l) => l.includes('200.000'))).toBe(true);
    const quiet = headlinesFor({ ...base, pop: 200001 }, { ...base, pop: 200500 }, 'Villa Test');
    expect(quiet.some((l) => l.includes('200.000'))).toBe(false);
  });

  it('grades the article of the new names', () => {
    const up = (from: number, to: number) =>
      headlinesFor({ ...base, pop: from }, { ...base, pop: to }, 'X').join(' ');
    expect(up(49000, 51000)).toContain('ya es una gran metrópolis');
    expect(up(99000, 101000)).toContain('ya es una megaciudad');
    expect(up(199000, 201000)).toContain('ya es un área metropolitana');
  });
});

describe('a saved game at the new ceiling', () => {
  it('opens with its milestone and its money', () => {
    const state = { milestone: MILESTONES.length - 1, cash: INITIAL_CASH };
    expect(advanceMilestones(state, 250000)).toEqual([]);
    expect(state.milestone).toBe(MILESTONES.length - 1);
  });
});
