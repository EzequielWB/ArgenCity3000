import { describe, expect, it } from 'vitest';
import { START_YEAR, TICKS_PER_MONTH, TICKS_PER_WEEK } from '../src/config';
import { Rng } from '../src/core/rng';
import { CELEBRATED_PER_YEAR, HOLIDAYS, celebratedHolidayOf, celebratedHolidays, holidayOf } from '../src/sim/calendar';
import { FIESTA } from '../src/sim/effects';
import { HOLIDAY_EVENTS, eventById, eventOfMonth, holidayEventOf } from '../src/sim/events';
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

  it('celebrates exactly three a year', () => {
    for (const year of [1990, 1991, 1995, 2000, 2007, 2014]) {
      const year3 = celebratedHolidays(year);
      expect(year3.length).toBe(CELEBRATED_PER_YEAR);
      expect(new Set(year3.map((h) => h.month)).size).toBe(CELEBRATED_PER_YEAR);
      // The same year always celebrates the same three: a saved game replays them.
      expect(celebratedHolidays(year).map((h) => h.month)).toEqual(year3.map((h) => h.month));
      for (const h of year3) expect(celebratedHolidayOf(year, h.month)).toBe(h);
    }
  });

  it('changes the three from year to year', () => {
    const sets = new Set<string>();
    for (let year = 1990; year < 2010; year++) sets.add(celebratedHolidays(year).map((h) => h.month).join(','));
    expect(sets.size).toBeGreaterThan(1);
  });
});

describe('el caso del feriado', () => {
  it('gives every holiday three ways out', () => {
    expect(HOLIDAY_EVENTS.length).toBe(HOLIDAYS.length);
    for (const event of HOLIDAY_EVENTS) {
      expect(event.options.length).toBe(3);
      expect(event.text.length).toBeGreaterThan(40);
      expect(new Set(event.options.map((o) => o.label)).size).toBe(3);
      expect(new Set(event.options.map((o) => o.detail)).size).toBe(3);
      for (const o of event.options) expect(o.detail.length).toBeGreaterThan(30);
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

  it('can be answered with the third option', () => {
    const sim = simAt(1995, 5);
    sim.state.pendingEvent = holidayEventOf(5)!.id;
    const before = sim.state.approval;
    sim.answerEvent(2);
    expect(sim.state.pendingEvent).toBe(null);
    expect(sim.state.approval).toBe(before - 5);
  });
});

describe('la fecha fija', () => {
  it('shows up in the month it falls, whatever the dice say', () => {
    // A year whose May is celebrated, and one whose May is not.
    if (celebratedHolidayOf(1995, 5)) {
      const sim = simAt(1995, 5);
      for (let k = 0; k < 40; k++) expect(eventOfMonth(sim, new Rng(k + 1))?.kind).toBe('feriado');
    }
    const quiet = [1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999].find((y) => holidayOf(5) && !celebratedHolidayOf(y, 5))!;
    const sim = simAt(quiet, 5);
    for (let k = 0; k < 40; k++) expect(eventOfMonth(sim, new Rng(k + 1))?.kind).not.toBe('feriado');
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
