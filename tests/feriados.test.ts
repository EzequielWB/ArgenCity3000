import { describe, expect, it } from 'vitest';
import { START_YEAR, TICKS_PER_MONTH, TICKS_PER_WEEK } from '../src/config';
import { Rng } from '../src/core/rng';
import { CELEBRATED_PER_YEAR, HOLIDAYS, celebratedHolidayOf, celebratedHolidays, holidayOf, isCelebrationYear } from '../src/sim/calendar';
import { FIESTA } from '../src/sim/effects';
import { HOLIDAY_EVENTS, detailOf, eventById, eventOfMonth, holidayEventOf } from '../src/sim/events';
import { headlinesFor, type CitySnapshot } from '../src/sim/news';
import { Simulation, newSimState } from '../src/sim/simulation';
import { World } from '../src/world/world';

const N = 16;
const flat = () => new World({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(30), trees: new Uint8Array(N * N) });

/** Tick of the first week of a month of a year, counted from the founding. */
const tickOf = (year: number, month: number, week = 0) => ((year - START_YEAR) * 12 + month - 1) * TICKS_PER_MONTH + week * TICKS_PER_WEEK;

function simAt(year: number, month: number): Simulation {
  const sim = new Simulation(flat(), newSimState(3), 'Villa Feriado');
  sim.state.tick = tickOf(year, month);
  return sim;
}

/** A quiet month of a quiet city, for the paper. */
function snap(month: number): CitySnapshot {
  return {
    pop: 900,
    buildings: 30,
    plants: 1,
    shortage: false,
    crisis: false,
    taxes: { R: 7, C: 7, I: 7 },
    funding: { school: 100, clinic: 100, police: 100, fire: 100, hospital: 100, university: 100 },
    green: 100,
    grief: 0,
    month,
    year: 1990,
    cash: 5000,
    abandoned: 0,
    loan: null,
    ports: 0,
    resorts: 0,
  };
}

describe('la tabla de feriados', () => {
  it('has one holiday per month at most', () => {
    const months = HOLIDAYS.map((h) => h.month);
    expect(new Set(months).size).toBe(months.length);
    for (const h of HOLIDAYS) {
      expect(h.month).toBeGreaterThanOrEqual(1);
      expect(h.month).toBeLessThanOrEqual(12);
      expect(h.name.length).toBeGreaterThan(3);
      expect(holidayOf(h.month)).toBe(h);
    }
  });

  it('leaves the memorial dates out', () => {
    expect(HOLIDAYS.map((h) => h.name)).not.toContain('24 de Marzo');
    expect(HOLIDAYS.map((h) => h.name)).not.toContain('2 de Abril');
  });

  it('is an opportunity every two or three years, not a chore every year', () => {
    const years: number[] = [];
    for (let year = 1990; year < 2060; year++) if (isCelebrationYear(year)) years.push(year);
    expect(years.length).toBeGreaterThan(15);
    expect(years.length).toBeLessThan(36); // a third of the years, more or less
    // Never two years running, never more than three years in between.
    for (let k = 1; k < years.length; k++) {
      const gap = years[k] - years[k - 1];
      expect(gap).toBeGreaterThanOrEqual(2);
      expect(gap).toBeLessThanOrEqual(3);
    }
  });

  it('asks for a decision on one holiday, and only in a year that celebrates', () => {
    for (const year of [1990, 1991, 1995, 2000, 2007, 2014, 2025, 2040]) {
      const chosen = celebratedHolidays(year);
      expect(chosen.length).toBe(isCelebrationYear(year) ? CELEBRATED_PER_YEAR : 0);
      // The same year always celebrates the same one: a saved game replays it.
      expect(celebratedHolidays(year).map((h) => h.month)).toEqual(chosen.map((h) => h.month));
      for (const h of chosen) expect(celebratedHolidayOf(year, h.month)).toBe(h);
    }
  });

  it('does not always pick the same holiday', () => {
    const months = new Set<number>();
    for (let year = 1990; year < 2060; year++) for (const h of celebratedHolidays(year)) months.add(h.month);
    expect(months.size).toBeGreaterThan(2);
  });
});

describe('el caso del feriado', () => {
  it('gives every holiday three ways out', () => {
    expect(HOLIDAY_EVENTS.length).toBe(HOLIDAYS.length);
    const sim = simAt(START_YEAR, 1);
    for (const event of HOLIDAY_EVENTS) {
      expect(event.options.length).toBe(3);
      expect(event.text.length).toBeGreaterThan(40);
      expect(new Set(event.options.map((o) => o.label)).size).toBe(3);
      expect(new Set(event.options.map((o) => detailOf(o, sim))).size).toBe(3);
      for (const o of event.options) expect(detailOf(o, sim).length).toBeGreaterThan(30);
    }
  });

  it('says it is a holiday, and finds it by the id a saved game keeps', () => {
    for (const h of HOLIDAYS) {
      const event = holidayEventOf(h.month)!;
      expect(event.kind).toBe('feriado');
      expect(eventById(event.id)).toBe(event);
    }
  });

  it('charges 2,5 times as much for the big one', () => {
    const cash = 100000;
    const big = simAt(1995, 1);
    big.state.cash = cash;
    const event = holidayEventOf(5)!;
    event.options[0].apply(big);
    const spentBig = cash - big.state.cash;
    const medium = simAt(1995, 1);
    medium.state.cash = cash;
    event.options[1].apply(medium);
    const spentMedium = cash - medium.state.cash;
    expect(spentBig).toBe(spentMedium * 2.5);
  });

  it('leaves the town spending, and the big one also stops the works', () => {
    const sim = simAt(1995, 1);
    sim.state.cash = 100000;
    holidayEventOf(5)!.options[0].apply(sim);
    expect(sim.hasEffect(FIESTA)).toBe(true);
    expect(sim.hasEffect('freeze')).toBe(true);
    const medium = simAt(1995, 1);
    medium.state.cash = 100000;
    holidayEventOf(5)!.options[1].apply(medium);
    expect(medium.hasEffect(FIESTA)).toBe(true);
    expect(medium.hasEffect('freeze')).toBe(false);
  });

  it('can be answered with the third option, which is the cheap one and costs face', () => {
    const sim = simAt(1995, 5);
    sim.state.pendingEvent = holidayEventOf(5)!.id;
    const before = sim.state.approval;
    sim.answerEvent(2);
    expect(sim.state.pendingEvent).toBe(null);
    expect(sim.state.approval).toBe(before - 3);
  });

  it('pays the two that cost money with more than the one that costs nothing takes away', () => {
    const before = simAt(1995, 5).state.approval;
    const after = [0, 1].map((index) => {
      const sim = simAt(1995, 5);
      sim.state.cash = 100000;
      holidayEventOf(5)!.options[index].apply(sim);
      return sim.state.approval - before;
    });
    expect(after[0]).toBeGreaterThan(after[1]); // the big one moves more than the act
    expect(after[1]).toBeGreaterThan(3); // and the act alone moves more than the free way out takes
  });
});

describe('la fecha fija', () => {
  it('shows up in the month it falls, whatever the dice say', () => {
    // The first celebration the game runs into, wherever it falls.
    // Not the founding year: no case shows up before the first year is over.
    const years = Array.from({ length: 40 }, (_, k) => 1990 + 2 + k);
    const year = years.find((y) => isCelebrationYear(y))!;
    const holiday = celebratedHolidays(year)[0];
    const sim = simAt(year, holiday.month);
    for (let k = 0; k < 40; k++) expect(eventOfMonth(sim, new Rng(k + 1))?.id).toBe(holidayEventOf(holiday.month)!.id);

    // Any other year with the same holiday is only the announcement.
    const quiet = years.find((y) => !isCelebrationYear(y))!;
    const calm = simAt(quiet, holiday.month);
    for (let k = 0; k < 40; k++) expect(eventOfMonth(calm, new Rng(k + 1))?.kind).not.toBe('feriado');
  });

  it('waits while there is another case pending', () => {
    const sim = simAt(1995, 5);
    sim.state.pendingEvent = 'piquete';
    expect(eventOfMonth(sim, new Rng(1))).toBe(null);
  });
});

describe('el diario', () => {
  it('announces every holiday, celebrated or not', () => {
    for (const h of HOLIDAYS) {
      const lines = headlinesFor(snap(h.month - 1 || 12), snap(h.month), 'Villa Feriado');
      expect(lines.join(' | ')).toContain(h.name);
    }
  });

  it('does not announce a holiday in a month without one', () => {
    const quiet = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].find((m) => !holidayOf(m))!;
    const lines = headlinesFor(snap(quiet - 1 || 12), snap(quiet), 'Villa Feriado');
    expect(lines.join(' | ')).not.toMatch(/feriado|Feriado/);
  });
});
