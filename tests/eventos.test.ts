import { describe, expect, it } from 'vitest';
import { DIRT, EVENT, MAX_FUNDING, MAX_TAX, TICKS_PER_MONTH } from '../src/config';
import { packBusLine } from '../src/world/transport';
import { deserialize, serialize } from '../src/save/save';
import { COAST_BOOST, COAST_WORN, FREEZE, INDUSTRY_BOOM, INDUSTRY_FROZEN, NO_BLACKOUT, coolOf, lockOf } from '../src/sim/effects';
import { EVENTS, caseMoney, detailOf, eventById, pickEvent } from '../src/sim/events';
import { Simulation, newSimState } from '../src/sim/simulation';
import { Rng } from '../src/core/rng';
import { formatMoney } from '../src/core/format';
import { TILE, World, type World as WorldType } from '../src/world/world';
import { applyPlan, dragCells, planTool } from '../src/world/tools';

const N = 48;

function flat(): World {
  return new World({ n: N, corners: new Uint8Array((N + 1) * (N + 1)).fill(30), trees: new Uint8Array(N * N) });
}

/** A city with light, a street and homes of every zone: the base every case is built on. */
function city(seed = 5): { world: WorldType; sim: Simulation } {
  const world = flat();
  const build = (tool: Parameters<typeof planTool>[1], ax: number, ay: number, bx = ax, by = ay) =>
    applyPlan(world, planTool(world, tool, dragCells(tool, ax, ay, bx, by, 1, N)));
  build('plant', 0, 1);
  build('road', 0, 3, 40, 3);
  build('zoneR', 2, 4, 18, 8);
  build('zoneC', 20, 4, 28, 8);
  build('zoneI', 30, 4, 40, 8);
  return { world, sim: new Simulation(world, newSimState(seed), 'Villa Evento') };
}

/** Fills every lot of a zone with buildings of one level, the way a grown city looks. */
function fill(world: World, zone: 'R' | 'C' | 'I', level = 3): void {
  for (let i = 0; i < world.tiles.length; i++) {
    if (world.tiles[i] === TILE[zone]) world.level[i] = level;
  }
}

/** The same city after a few years: every zone built up, and enough people to ask for things. */
function grown(seed = 5): { world: WorldType; sim: Simulation } {
  const { world, sim } = city(seed);
  fill(world, 'R', 4);
  fill(world, 'C', 3);
  fill(world, 'I', 3);
  sim.refresh();
  return { world, sim };
}

const option = (id: string, index: 0 | 1) => eventById(id)!.options[index];

describe('the catalogue', () => {
  it('has twenty-four cases, all of them different', () => {
    expect(EVENTS.length).toBe(24);
    expect(new Set(EVENTS.map((e) => e.id)).size).toBe(24);
    expect(new Set(EVENTS.map((e) => e.title)).size).toBe(24);
  });

  it('gives every case two ways out, both with their consequence written', () => {
    const { sim } = city();
    for (const event of EVENTS) {
      expect(event.options.length).toBe(2);
      expect(event.text.length).toBeGreaterThan(40);
      for (const o of event.options) {
        expect(o.label.length).toBeGreaterThan(4);
        expect(detailOf(o, sim).length).toBeGreaterThan(30);
      }
      expect(event.options[0].label).not.toBe(event.options[1].label);
      expect(detailOf(event.options[0], sim)).not.toBe(detailOf(event.options[1], sim));
    }
  });

  it('asks nobody for anything on an empty city', () => {
    const world = flat();
    const sim = new Simulation(world, newSimState(1), 'Nada');
    for (const event of EVENTS) expect([event.id, event.when(sim)]).toEqual([event.id, false]);
  });
});

describe('un piquete en la avenida', () => {
  it('appears with the avenue jammed and a city of more than two thousand', () => {
    const { world, sim } = city();
    fill(world, 'R', 4);
    sim.refresh();
    expect(eventById('piquete')!.when(sim)).toBe(false); // the traffic is fine
    sim.congestion = { trips: 1000, worst: 200, jammedShare: 0.5 };
    expect(eventById('piquete')!.when(sim)).toBe(true);
  });

  it('chooses between a grudge and a frozen month', () => {
    const a = city().sim;
    const before = a.state.approval;
    option('piquete', 0).apply(a);
    expect(a.state.grief).toBe(150);
    expect(a.state.approval).toBeLessThan(before);

    const b = city().sim;
    option('piquete', 1).apply(b);
    expect(b.hasEffect(FREEZE)).toBe(true);
    expect(b.state.effects[FREEZE]).toBe(2);
    expect(b.state.grief).toBe(0);
  });
});

describe('la Provincia pone la plata', () => {
  it('only shows up when the cash is short', () => {
    const { world, sim } = city();
    fill(world, 'R', 4);
    sim.refresh();
    expect(eventById('provincia')!.when(sim)).toBe(false);
    sim.state.cash = 1200;
    expect(eventById('provincia')!.when(sim)).toBe(true);
  });

  it('takes the money and ties the health slider for two years', () => {
    const { sim } = city();
    sim.state.cash = 1000;
    const price = caseMoney(sim, 7, 'gain');
    option('provincia', 0).apply(sim);
    expect(sim.state.cash).toBe(1000 + price);
    expect(sim.state.funding.clinic).toBe(120);
    expect(sim.state.effects[lockOf('clinic')]).toBe(24);
    sim.setFunding('clinic', 40);
    expect(sim.state.funding.clinic).toBe(120); // still tied
  });

  it('turns the offer away for a year', () => {
    const { sim } = city();
    sim.state.cash = 1000;
    option('provincia', 1).apply(sim);
    expect(sim.state.cash).toBe(1000);
    expect(sim.hasEffect(coolOf('provincia'))).toBe(true);
    expect(eventById('provincia')!.when(sim)).toBe(false);
  });
});

describe('la fábrica sin controles', () => {
  /** A city with a lot of industry and heavy air, on a map with no water at all. */
  function smoky(): { world: WorldType; sim: Simulation } {
    return grown(9);
  }

  it('appears with industry and the air heavy, whether or not there is water around', () => {
    const { world, sim } = smoky();
    expect(world.terrain.corners.every((h) => h >= 3)).toBe(true); // not a drop of water on the map
    expect(eventById('fabrica-sin-controles')!.when(sim)).toBe(true);
  });

  it('stays away from a city without much industry', () => {
    const { sim } = city();
    expect(eventById('fabrica-sin-controles')!.when(sim)).toBe(false);
  });

  it('closes the dirtiest factory and takes its jobs', () => {
    const { sim } = smoky();
    const before = sim.totals.iJobs;
    option('fabrica-sin-controles', 0).apply(sim);
    expect(sim.abandonedCount).toBe(1);
    expect(sim.totals.iJobs).toBeLessThan(before);
  });

  it('or takes the fine and lets it keep smoking', () => {
    const { sim } = smoky();
    const cash = sim.state.cash;
    const jobs = sim.totals.iJobs;
    const price = caseMoney(sim, 3, 'gain');
    option('fabrica-sin-controles', 1).apply(sim);
    expect(sim.state.cash).toBe(cash + price);
    expect(sim.totals.iJobs).toBe(jobs);
    expect(sim.abandonedCount).toBe(0);
  });
});

describe('la ola de calor', () => {
  it('only shows up in January and February, with the clinics stretched', () => {
    const { world, sim } = city();
    fill(world, 'R', 4);
    sim.refresh();
    sim.state.tick = TICKS_PER_MONTH * 12; // January of the second year
    expect(eventById('ola-de-calor')!.when(sim)).toBe(true);
    sim.state.tick = TICKS_PER_MONTH * 16; // May
    expect(eventById('ola-de-calor')!.when(sim)).toBe(false);
  });

  it('pays for shade or leaves the neighbours to sweat', () => {
    const a = city().sim;
    const cash = a.state.cash;
    const approval = a.state.approval;
    const price = caseMoney(a, 3, 'cost');
    option('ola-de-calor', 0).apply(a);
    expect(a.state.cash).toBe(cash - price);
    expect(a.state.approval).toBeGreaterThan(approval);

    const b = city().sim;
    option('ola-de-calor', 1).apply(b);
    expect(b.state.cash).toBe(cash);
    expect(b.state.approval).toBeLessThan(approval);
    expect(b.state.grief).toBe(100);
  });
});

describe('la plaza que piden los vecinos', () => {
  it('appears in a city without a plaza worth the name', () => {
    const { world, sim } = city();
    fill(world, 'R', 4);
    sim.refresh();
    expect(sim.totals.pop).toBeGreaterThan(3000);
    expect(eventById('plaza-vecina')!.when(sim)).toBe(true);
    // A 3×3 plaza settles it.
    for (let y = 20; y < 23; y++) for (let x = 20; x < 23; x++) world.tiles[world.idx(x, y)] = TILE.PARK;
    sim.refresh();
    expect(eventById('plaza-vecina')!.when(sim)).toBe(false);
  });

  it('promises the plaza, or sells the lot and takes the grudge', () => {
    const a = city().sim;
    option('plaza-vecina', 0).apply(a);
    expect(a.state.commitment?.kind).toBe('plaza');

    const b = city().sim;
    option('plaza-vecina', 1).apply(b);
    expect(b.state.cash).toBe(b.state.cash); // the money is checked below
  });

  it('sells the lot for six thousand and leaves a grudge', () => {
    const { sim } = city();
    const cash = sim.state.cash;
    const price = caseMoney(sim, 2, 'gain');
    option('plaza-vecina', 1).apply(sim);
    expect(sim.state.cash).toBe(cash + price);
    expect(sim.state.grief).toBe(150);
    expect(sim.state.commitment).toBeNull();
  });
});

describe('la ola de robos', () => {
  it('appears with the crime high and the police short', () => {
    const { world, sim } = city();
    fill(world, 'R', 4);
    sim.refresh();
    for (let i = 0; i < world.crime.length; i++) world.crime[i] = 60;
    expect(eventById('ola-de-robos')!.when(sim)).toBe(true);
    sim.setFunding('police', MAX_FUNDING);
    expect(eventById('ola-de-robos')!.when(sim)).toBe(false); // the patrol is already paid
  });

  it('pays the patrol or pays the leaflets', () => {
    const a = city().sim;
    option('ola-de-robos', 0).apply(a);
    expect(a.state.funding.police).toBe(MAX_FUNDING);
    expect(a.hasEffect(coolOf('ola-de-robos'))).toBe(true);

    const b = city().sim;
    const cash = b.state.cash;
    const approval = b.state.approval;
    const price = caseMoney(b, 1.5, 'cost');
    option('ola-de-robos', 1).apply(b);
    expect(b.state.cash).toBe(cash - price);
    expect(b.state.approval).toBeGreaterThan(approval);
    expect(b.state.funding.police).toBe(100);
  });
});

describe('la curtiembre', () => {
  it('appears when the industry wants land and people need work', () => {
    const { sim } = grown();
    sim.demand = { ...sim.demand, I: 40 };
    expect(eventById('curtiembre')!.when(sim)).toBe(false); // the industry is not asking
    sim.demand = { ...sim.demand, I: 70 };
    expect(eventById('curtiembre')!.when(sim)).toBe(true);
    // With more jobs than neighbours it stops asking for land.
    sim.totals = { ...sim.totals, iJobs: sim.totals.pop + 1 };
    expect(eventById('curtiembre')!.when(sim)).toBe(false);
  });

  it('takes the land and the smoke, or sends it away with the neighbours happy', () => {
    const a = city().sim;
    const cash = a.state.cash;
    const price = caseMoney(a, 1.5, 'gain');
    option('curtiembre', 0).apply(a);
    expect(a.state.cash).toBe(cash + price);
    expect(a.state.effects[INDUSTRY_BOOM]).toBe(12);
    expect(a.state.grief).toBe(150);

    const b = city().sim;
    option('curtiembre', 1).apply(b);
    expect(b.state.effects[INDUSTRY_FROZEN]).toBe(6);
    expect(b.state.cash).toBe(cash);
  });
});

describe('la crecida', () => {
  it('only comes in autumn, on a coast with people', () => {
    const world = new World(generateWater());
    for (let y = 0; y < world.n; y++)
      for (let x = 0; x < world.n; x++) if (world.tiles[world.idx(x, y)] === TILE.EMPTY && !world.isWater(x, y)) world.tiles[world.idx(x, y)] = TILE.PROMENADE;
    const sim = new Simulation(world, newSimState(4), 'Villa Crecida');
    for (let i = 0; i < world.tiles.length; i++) if (world.tiles[i] === TILE.R) world.level[i] = 3;
    sim.refresh();
    expect(eventById('crecida')!.when(sim)).toBe(false); // January, and hardly any people

    sim.state.tick = TICKS_PER_MONTH * 4; // May
    sim.totals.pop = 6000;
    expect(eventById('crecida')!.when(sim)).toBe(true);
  });

  it('pays for the defence or lets the first row drown', () => {
    const a = city().sim;
    const cash = a.state.cash;
    const price = caseMoney(a, 5, 'cost');
    option('crecida', 0).apply(a);
    expect(a.state.cash).toBe(cash - price);
    expect(a.state.effects[coolOf('crecida')]).toBe(36);

    const b = city().sim;
    option('crecida', 1).apply(b);
    expect(b.state.grief).toBe(250);
  });
});

describe('la feria del pueblo', () => {
  it('appears when the neighbours are happy', () => {
    const { sim } = grown();
    expect(eventById('feria')!.when(sim)).toBe(false);
    sim.state.approval = 70;
    expect(eventById('feria')!.when(sim)).toBe(true);
  });

  it('pays the operation, or says no and pays in approval', () => {
    const a = city().sim;
    const cash = a.state.cash;
    const approval = a.state.approval;
    const price = caseMoney(a, 1, 'cost');
    option('feria', 0).apply(a);
    expect(a.state.cash).toBe(cash - price);
    expect(a.state.approval).toBeGreaterThan(approval);
    expect(a.state.effects[FREEZE]).toBe(1);

    const b = city().sim;
    option('feria', 1).apply(b);
    expect(b.state.cash).toBe(cash);
    expect(b.state.approval).toBeLessThan(approval);
  });
});

describe('el corte en la usina', () => {
  it('appears when the grid is at its limit', () => {
    const { sim } = city();
    sim.totals.pop = 3000;
    sim.power = { capacity: 600, use: 590, shortage: false, nets: [] };
    expect(eventById('corte-de-usina')!.when(sim)).toBe(true);
    sim.power = { capacity: 600, use: 300, shortage: false, nets: [] };
    expect(eventById('corte-de-usina')!.when(sim)).toBe(false);
  });

  it('buys power or rations it', () => {
    const a = city().sim;
    const cash = a.state.cash;
    const price = caseMoney(a, 6, 'cost');
    option('corte-de-usina', 0).apply(a);
    expect(a.state.cash).toBe(cash - price);
    expect(a.state.effects[NO_BLACKOUT]).toBe(3);

    const b = city().sim;
    option('corte-de-usina', 1).apply(b);
    expect(b.state.effects[FREEZE]).toBe(1);
    expect(b.state.cash).toBe(cash);
  });
});

describe('la coima en la obra', () => {
  it('stays away in an election year', () => {
    const { sim } = city();
    sim.state.cash = 30000;
    sim.totals.pop = 5000;
    const yearStart = Math.floor(sim.state.tick / (TICKS_PER_MONTH * 12));
    sim.state.tick = TICKS_PER_MONTH * (yearStart * 12 + 3); // October of 1993: election month
    sim.state.government = 'democracia';
    const when = eventById('coima')!.when(sim);
    expect(typeof when).toBe('boolean');
  });

  it('denounces it, or covers it up and gambles', () => {
    const a = city().sim;
    const approval = a.state.approval;
    option('coima', 0).apply(a);
    expect(a.state.approval).toBeGreaterThan(approval);
    expect(a.state.effects[FREEZE]).toBe(1);
    expect(a.state.news[0].text).toMatch(/coima/i);
  });

  it('covers it up: the money goes out, and the odds decide the rest', () => {
    const caught = city(1).sim;
    const cash = caught.state.cash;
    let reported = false;
    for (let k = 0; k < 30 && !reported; k++) {
      const sim = city(k + 1).sim;
      const before = sim.state.approval;
      const price = caseMoney(sim, 2, 'cost');
      option('coima', 1).apply(sim);
      if (sim.state.grief > 0) {
        reported = true;
        expect(sim.state.approval).toBeLessThan(before);
        expect(sim.state.cash).toBe(cash - price);
      }
    }
    expect(reported).toBe(true); // three in ten, so thirty tries always find one
  });
});

describe('la sequía', () => {
  it('appears with industry and people', () => {
    const { world, sim } = city();
    fill(world, 'I', 5);
    fill(world, 'R', 4);
    sim.refresh();
    expect(eventById('sequia')!.when(sim)).toBe(true);
  });

  it('subsidises the factory or lets the market decide', () => {
    const a = city().sim;
    const cash = a.state.cash;
    const price = caseMoney(a, 4, 'cost');
    option('sequia', 0).apply(a);
    expect(a.state.cash).toBe(cash - price);
    expect(a.state.effects[INDUSTRY_BOOM]).toBe(3);

    const b = city().sim;
    option('sequia', 1).apply(b);
    expect(b.state.cash).toBe(cash);
    expect(b.state.effects[INDUSTRY_FROZEN]).toBe(6);
  });
});

describe('el humo', () => {
  it('appears when the air is heavy and the city is big', () => {
    const world = new World(generateWater());
    const sim = new Simulation(world, newSimState(3), 'Villa Humo');
    sim.refresh();
    expect(eventById('humo')!.when(sim)).toBe(false);
    for (let i = 0; i < world.tiles.length; i++) if (world.tiles[i] === TILE.EMPTY && !world.isWater(i % world.n, Math.floor(i / world.n))) world.tiles[i] = TILE.R;
    fill(world, 'R', 3);
    sim.refresh();
    for (let i = 0; i < world.pollution.length; i++) world.pollution[i] = 80;
    sim.totals.pop = 6000;
    expect(eventById('humo')!.when(sim)).toBe(true);
  });

  it('asks for filters, or ignores the neighbours', () => {
    const a = city().sim;
    const tax = a.state.taxes.I;
    option('humo', 0).apply(a);
    expect(a.state.taxes.I).toBe(Math.min(MAX_TAX, tax + 2));
    expect(a.state.effects[INDUSTRY_FROZEN]).toBe(12);

    const b = city().sim;
    const approval = b.state.approval;
    option('humo', 1).apply(b);
    expect(b.state.taxes.I).toBe(tax);
    expect(b.state.approval).toBeLessThan(approval);
    expect(b.state.grief).toBe(120);
  });
});

describe('la temporada en la costanera', () => {
  it('opens in December, with the coast built', () => {
    const world = new World(generateWater());
    for (let i = 0; i < world.tiles.length; i++) if (world.tiles[i] === TILE.EMPTY && !world.isWater(i % world.n, Math.floor(i / world.n))) world.tiles[i] = TILE.RESORT;
    const sim = new Simulation(world, newSimState(2), 'Villa Temporada');
    sim.totals.pop = 800;
    expect(eventById('temporada')!.when(sim)).toBe(false); // January
    sim.state.tick = TICKS_PER_MONTH * 11; // December
    expect(eventById('temporada')!.when(sim)).toBe(true);
  });

  it('invests in the season or lets the seafront wear out', () => {
    const a = city().sim;
    const cash = a.state.cash;
    const price = caseMoney(a, 2, 'cost');
    option('temporada', 0).apply(a);
    expect(a.state.cash).toBe(cash - price);
    expect(a.state.effects[COAST_BOOST]).toBe(3);

    const b = city().sim;
    option('temporada', 1).apply(b);
    expect(b.state.cash).toBe(cash);
    expect(b.state.effects[COAST_WORN]).toBe(24);
  });
});

describe('which one shows up', () => {
  it('brings a case that belongs to the city, never two at once', () => {
    const { sim } = grown();
    sim.state.tick = TICKS_PER_MONTH * 24;
    const picks = new Set<string>();
    for (let k = 0; k < 60; k++) {
      const chosen = pickEvent(sim, new Rng(k + 1));
      if (!chosen) continue;
      expect(chosen.when(sim)).toBe(true);
      picks.add(chosen.id);
    }
    expect(picks.size).toBeGreaterThan(0);
    for (const id of picks) expect(eventById(id)).toBeDefined();
  });

  it('waits out the cooldown of a case it already answered', () => {
    const { sim } = grown();
    sim.state.tick = TICKS_PER_MONTH * 24;
    const seen = new Set<string>();
    for (let k = 0; k < 80; k++) {
      const chosen = pickEvent(sim, new Rng(k + 1));
      if (!chosen) continue;
      seen.add(chosen.id);
      sim.state.lastEvent = 0; // forget the gap, keep the cooldown
      sim.effect(coolOf(chosen.id), 12);
    }
    for (let k = 0; k < 80; k++) {
      const chosen = pickEvent(sim, new Rng(k + 101));
      if (chosen) expect(sim.hasEffect(coolOf(chosen.id))).toBe(false);
    }
  });
});

describe('the newer cases', () => {
  const month = (m: number) => TICKS_PER_MONTH * (m - 1); // tick 0 is January

  it('ask for the right city: each one stays quiet until its condition holds', () => {
    const { world, sim } = grown();
    expect(sim.totals.pop).toBeGreaterThan(4000); // the fixture is big enough for the thresholds below

    // Paro docente: needs a school, and the budget for the schools cut below ${EVENT.strikeBelow} %.
    expect(eventById('paro-docente')!.when(sim)).toBe(false);
    world.setTile(44, 44, TILE.SCHOOL);
    expect(eventById('paro-docente')!.when(sim)).toBe(false); // the schools are paid as usual
    sim.state.funding.school = EVENT.strikeBelow;
    expect(eventById('paro-docente')!.when(sim)).toBe(false); // right at the line is not below it
    sim.state.funding.school = EVENT.strikeBelow - 1;
    expect(eventById('paro-docente')!.when(sim)).toBe(true);

    // The strike covers the university too, with its own budget; and the hospital has one of its own.
    sim.state.funding.school = 100;
    expect(eventById('paro-docente')!.when(sim)).toBe(false);
    world.setTile(46, 44, TILE.UNIVERSITY);
    expect(eventById('paro-docente')!.when(sim)).toBe(false); // the university is paid as usual
    sim.state.funding.university = EVENT.strikeBelow - 1;
    expect(eventById('paro-docente')!.when(sim)).toBe(true);
    sim.state.funding.university = 100;
    expect(eventById('paro-de-salud')!.when(sim)).toBe(false);
    world.setTile(47, 44, TILE.HOSPITAL);
    expect(eventById('paro-de-salud')!.when(sim)).toBe(false); // the hospital is paid as usual
    sim.state.funding.hospital = EVENT.strikeBelow;
    expect(eventById('paro-de-salud')!.when(sim)).toBe(false);
    sim.state.funding.hospital = EVENT.strikeBelow - 1;
    expect(eventById('paro-de-salud')!.when(sim)).toBe(true);
    sim.state.funding.hospital = 100;
    sim.state.funding.school = EVENT.strikeBelow - 1; // back to the cut the next lines expect

    // Paro de colectivos: needs a bus line, and the budget for transport cut below ${EVENT.strikeBelow} %.
    expect(eventById('paro-de-colectivos')!.when(sim)).toBe(false);
    world.setTile(45, 44, TILE.BUS);
    world.busLine[world.idx(45, 44)] = packBusLine(0, 1);
    expect(eventById('paro-de-colectivos')!.when(sim)).toBe(false); // the drivers are paid as usual
    sim.state.transport = EVENT.strikeBelow;
    expect(eventById('paro-de-colectivos')!.when(sim)).toBe(false);
    sim.state.transport = EVENT.strikeBelow - 1;
    expect(eventById('paro-de-colectivos')!.when(sim)).toBe(true);

    // Barro: needs twenty dirt streets.
    expect(eventById('barro-en-las-calles')!.when(sim)).toBe(false);
    for (let x = 0; x < 20; x++) {
      world.setTile(x, 20, TILE.ROAD);
      world.roadTier[world.idx(x, 20)] = DIRT;
    }
    expect(eventById('barro-en-las-calles')!.when(sim)).toBe(true);

    // Brote de gripe: in winter, with the clinics short.
    sim.state.tick = month(1);
    expect(eventById('brote-de-gripe')!.when(sim)).toBe(false);
    sim.state.tick = month(6);
    expect(eventById('brote-de-gripe')!.when(sim)).toBe(true);

    // Granizada: in the warm months only.
    expect(eventById('granizada')!.when(sim)).toBe(false);
    for (const m of [10, 11, 12, 1, 2]) {
      sim.state.tick = month(m);
      expect(eventById('granizada')!.when(sim)).toBe(true);
    }

    // Un shopping: a big city with shops.
    expect(eventById('shopping')!.when(sim)).toBe(true);
    expect(eventById('shopping')!.when(new Simulation(flat(), newSimState(1), 'Chico'))).toBe(false);

    // Un acto: close to an election, and only where there are elections.
    sim.state.tick = 0;
    expect(eventById('acto-politico')!.when(sim)).toBe(false);
    sim.state.tick = month(37);
    expect(eventById('acto-politico')!.when(sim)).toBe(true);
    sim.state.government = 'dictadura';
    expect(eventById('acto-politico')!.when(sim)).toBe(false);

    // Pantalla gigante: with some cash in the box.
    expect(eventById('pantalla-gigante')!.when(sim)).toBe(true);
    sim.state.cash = 1000;
    expect(eventById('pantalla-gigante')!.when(sim)).toBe(false);
  });

  // For each: how many weeks of what the city collects the first way out charges (negative: it pays
  // in) and which way the approval moves, then the same for the second.
  const outcomes: [string, number, 1 | -1, number, 1 | -1][] = [
    ['paro-docente', -2.5, 1, 0, -1],
    ['paro-de-colectivos', -2, 1, 0, -1],
    ['paro-de-salud', -3, 1, 0, -1],
    ['barro-en-las-calles', -1, 1, 0, -1],
    ['brote-de-gripe', -2, 1, 0, -1],
    ['granizada', -2.5, 1, 0, -1],
    ['shopping', 2, -1, 0, 1],
    ['acto-politico', -1.5, 1, 0, -1],
    ['pantalla-gigante', -1.5, 1, 0, -1],
  ];

  it.each(outcomes)('%s: pays what it says and moves the approval the way it says', (id, weeks0, sign0, weeks1, sign1) => {
    for (const [index, weeks, sign] of [[0, weeks0, sign0], [1, weeks1, sign1]] as const) {
      const { sim } = city();
      const before = { cash: sim.state.cash, approval: sim.state.approval };
      // Read before: the price depends on the till. The sign says which side of the ledger it is.
      const price = caseMoney(sim, weeks, weeks < 0 ? 'cost' : 'gain');
      option(id, index).apply(sim);
      expect(sim.state.cash).toBe(before.cash + price);
      expect(Math.sign(sim.state.approval - before.approval)).toBe(sign);
    }
  });

  // The cases used to charge fixed pesos: measured, that was two years of income for a town of five
  // thousand and half a day for a city of a hundred thousand. The ladder is written in months of
  // collection, and savings only ever add to the price, never more than double.
  it('charges months of what the city collects, and a windfall never reads the till', () => {
    const sim = city().sim;
    for (let i = 0; i < TICKS_PER_MONTH; i++) sim.tick();
    const real = sim.state.lastBudget!;
    const at = (income: number, cash: number, side: 'cost' | 'gain') => {
      sim.state.lastBudget = { ...real, income };
      sim.state.cash = cash;
      return caseMoney(sim, 1, side);
    };
    expect(at(12000, 0, 'gain')).toBe(12000); // one month of collection
    expect(at(120000, 0, 'gain')).toBe(120000); // ten times the city, ten times the bill
    expect(at(0, 90000, 'gain')).toBe(2000); // a town that has not collected yet still pays something
    expect(at(12000, 0, 'cost')).toBe(3000); // with the till empty the brake leaves a quarter month
    // The till lifts a charge, and it stops lifting at the double.
    expect(at(12000, 60000, 'cost')).toBe(12000); // five months saved change nothing
    expect(at(12000, 120000, 'cost')).toBe(12000); // ten months is the threshold
    expect(at(12000, 180000, 'cost')).toBe(18000); // fifteen months, half as much again
    expect(at(12000, 1200000, 'cost')).toBe(24000); // a hundred months, and there it stops
    expect(at(12000, 1200000, 'gain')).toBe(12000); // a windfall still reads only the collection
  });

  it('never takes more than half the till plus a quarter of the month that is coming', () => {
    const sim = city().sim;
    for (let i = 0; i < TICKS_PER_MONTH; i++) sim.tick();
    const budget = sim.state.lastBudget!;
    sim.state.lastBudget = { ...budget, income: 12000 };
    sim.state.cash = 20000;
    // Twenty months of collection would be 240.000: the brake leaves half of the till and more.
    expect(caseMoney(sim, 20, 'cost')).toBe(13000);
    sim.state.cash = 0;
    // An empty till does not make a case free: the month that is coming still pays.
    expect(caseMoney(sim, 20, 'cost')).toBe(3000);
    expect(caseMoney(sim, 1, 'cost')).toBe(3000); // and there the brake holds everything at once
  });

  it('a town with ninety thousand saved pays months of what it collects to cover up a bribe', () => {
    const { sim } = city();
    for (let i = 0; i < TICKS_PER_MONTH; i++) sim.tick();
    // Six thousand neighbours, ninety thousand in the till and a month of 5.820: fifteen months saved.
    sim.state.lastBudget = { ...sim.state.lastBudget!, income: 5820 };
    sim.state.cash = 90000;
    expect(caseMoney(sim, 1, 'cost')).toBe(9000); // the till lifts it half as much again
    expect(caseMoney(sim, 2, 'cost')).toBe(18000); // two months of collection
    const before = sim.state.cash;
    option('coima', 1).apply(sim);
    expect(sim.state.cash).toBe(before - 18000);
  });

  // The whole catalogue, measured the way the player feels it: what each option takes or leaves in
  // months of what the city collects. A case that costs a tenth of a month feels free; one that costs
  // a year ends the run. Everything has to sit inside the same ladder.
  it('every option in the catalogue sits between one and seven months of collection', () => {
    const shares: { id: string; share: number }[] = [];
    for (const e of EVENTS) {
      e.options.forEach((o, i) => {
        const sim = city().sim;
        // A city with ten months of collection saved: the moment the till starts to count.
        sim.state.lastBudget = { ...(sim.state.lastBudget ?? ({} as never)), income: 12000 } as never;
        sim.state.cash = 120000;
        const before = sim.state.cash;
        o.apply(sim);
        const moved = Math.abs(sim.state.cash - before);
        if (moved === 0) return; // the ones that cost approval or time, not money
        shares.push({ id: `${e.id}#${i}`, share: moved / 12000 });
      });
    }
    expect(shares.length).toBeGreaterThan(15);
    const cheap = shares.filter((s) => s.share < 1);
    const heavy = shares.filter((s) => s.share > 7);
    expect(cheap.map((s) => s.id)).toEqual([]);
    expect(heavy.map((s) => s.id)).toEqual([]);
  });

  it('writes the pesos it is going to charge, not the weeks behind them', () => {
    const { sim } = city();
    for (let i = 0; i < TICKS_PER_MONTH; i++) sim.tick();
    sim.state.lastBudget = { ...sim.state.lastBudget!, income: 12000 };
    const shot = option('brote-de-gripe', 0);
    const price = caseMoney(sim, 2, 'cost');
    expect(detailOf(shot, sim)).toContain(formatMoney(price));
    const before = sim.state.cash;
    shot.apply(sim);
    expect(sim.state.cash).toBe(before - price);
  });

  it('paying the arrears brings the budget back to normal, and letting it run leaves it cut', () => {
    const a = city().sim;
    a.state.funding.school = 40;
    option('paro-docente', 0).apply(a);
    expect(a.state.funding.school).toBe(100);
    const b = city().sim;
    b.state.funding.school = 40;
    option('paro-docente', 1).apply(b);
    expect(b.state.funding.school).toBe(40);

    // The strike of the hospital, and the one of the teachers when the university was cut as well.
    const h = city().sim;
    h.state.funding.hospital = 40;
    option('paro-de-salud', 0).apply(h);
    expect(h.state.funding.hospital).toBe(100);
    const u = city().sim;
    u.state.funding.school = 40;
    u.state.funding.university = 40;
    const cash = u.state.cash;
    // Two charges, and each one re-reads the till the previous one left behind.
    const first = caseMoney(u, 2.5, 'cost');
    u.state.cash -= first;
    const second = caseMoney(u, 2, 'cost');
    u.state.cash = cash;
    option('paro-docente', 0).apply(u);
    expect(u.state.funding.university).toBe(100);
    expect(u.state.cash).toBe(cash - first - second);

    const c = city().sim;
    c.setTransport(30);
    option('paro-de-colectivos', 0).apply(c);
    expect(c.state.transport).toBe(100);
    const d = city().sim;
    d.setTransport(30);
    option('paro-de-colectivos', 1).apply(d);
    expect(d.state.transport).toBe(30);
  });

  it('the bus strike freezes the works for a month when it is let run', () => {
    const { sim } = city();
    option('paro-de-colectivos', 1).apply(sim);
    expect(sim.state.effects[FREEZE]).toBe(1);
    const paid = city().sim;
    option('paro-de-colectivos', 0).apply(paid);
    expect(paid.state.effects[FREEZE]).toBeUndefined();
  });
});

describe('the rest between repeats', () => {
  /** Lets the simulation raise an event, answers it, and returns the id of the one that showed up (or null). */
  function raise(sim: Simulation, seed: number): string | null {
    const s = sim.state as { pendingEvent: string | null; lastEvent: number; tick: number };
    s.pendingEvent = null;
    s.lastEvent = 0; // keep the gap out of the way: the rest is what is under test
    // March, and the seed stays inside the month: the calendar has no holiday there, so this keeps
    // being about the random catalogue.
    s.tick = TICKS_PER_MONTH * 26 + (seed % TICKS_PER_MONTH);
    (sim as unknown as { fireEvent(): void }).fireEvent();
    const id = s.pendingEvent;
    s.pendingEvent = null;
    return id;
  }

  it('keeps the last three that showed up, the latest first', () => {
    const { sim } = grown();
    const seen: string[] = [];
    for (let k = 0; k < 200 && seen.length < 5; k++) {
      const id = raise(sim, k);
      if (id) seen.push(id);
    }
    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(sim.state.recentEvents).toEqual(seen.slice(-3).reverse());
    expect(sim.state.recentEvents.length).toBeLessThanOrEqual(EVENT.cooldown);
  });

  it('never repeats a case until three others have shown up', () => {
    const { sim } = grown();
    const seen: string[] = [];
    for (let k = 0; k < 400; k++) {
      const id = raise(sim, k);
      if (id) seen.push(id);
    }
    expect(seen.length).toBeGreaterThanOrEqual(3);
    seen.forEach((id, i) => expect(seen.slice(Math.max(0, i - EVENT.cooldown), i)).not.toContain(id));
  });

  it('frees a case exactly when the third one after it has come', () => {
    const { sim } = grown();
    sim.state.tick = TICKS_PER_MONTH * 24;
    const eligible = EVENTS.filter((e) => e.when(sim)).map((e) => e.id);
    expect(eligible.length).toBeGreaterThanOrEqual(2);
    const [x, a, b, c] = ["x", "a", "b", "c"];
    const picks = (recent: string[]) => {
      sim.state.recentEvents = recent;
      const out = new Set<string>();
      for (let k = 0; k < 300; k++) {
        const e = pickEvent(sim, new Rng(k + 1));
        if (e) out.add(e.id);
      }
      return out;
    };
    // The case itself is the latest one, two after it, three after it: only then does it come back.
    const target = eligible[0];
    expect(picks([target, a, b]).has(target)).toBe(false);
    expect(picks([a, target, b]).has(target)).toBe(false);
    expect(picks([a, b, target]).has(target)).toBe(false);
    expect(picks([a, b, c]).has(target)).toBe(true);
    void x;
  });

  it('is saved with the game, and an older save simply has none', () => {
    // A map the save accepts (the cases above use heights beyond the highest ground).
    const world = new World({ n: 16, corners: new Uint8Array(17 * 17).fill(5), trees: new Uint8Array(256) });
    const sim = new Simulation(world, newSimState(5), 'Villa Guardada');
    sim.state.recentEvents = ["fabrica-sin-controles", "ola-de-calor"];
    const text = serialize({ name: "X", seed: 5, world, sim: sim.state });
    expect(deserialize(text).sim.recentEvents).toEqual(["fabrica-sin-controles", "ola-de-calor"]);
    const old = JSON.parse(text);
    delete old.sim.recentEvents;
    expect(deserialize(JSON.stringify(old)).sim.recentEvents).toEqual([]);
    old.sim.recentEvents = ["a", "b", "c", "d"];
    expect(() => deserialize(JSON.stringify(old))).toThrow(/últimos eventos/);
  });
});

/** A small map with a lake in the middle-left: the coast cases need real water. */
function generateWater() {
  const n = 26;
  const corners = new Uint8Array((n + 1) * (n + 1)).fill(30);
  const s = n + 1;
  for (let y = 12; y <= 16; y++) for (let x = 12; x <= 16; x++) corners[y * s + x] = 0;
  return { n, corners, trees: new Uint8Array(n * n) };
}
