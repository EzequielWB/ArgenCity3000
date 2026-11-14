import { describe, expect, it } from 'vitest';
import { CAPACITY, ROAD_TIERS, TRAFFIC } from '../src/config';
import { computeCongestion, jamGrowthFactor } from '../src/sim/congestion';
import { computeLandValue } from '../src/sim/fields';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { TILE, World } from '../src/world/world';

function flat(n = 48): Terrain {
  const s = n + 1;
  return { n, corners: new Uint8Array(s * s).fill(SEA_LEVEL + 1), trees: new Uint8Array(n * n) };
}

function road(w: World, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) w.setTile(x, y, TILE.ROAD);
}

/** Eight towers (1.280 residents) at the west end of a street along y = 10 and one factory at its east end. */
function commuterTown(lanes = 1): World {
  const w = new World(flat());
  road(w, 0, 10, 30, 10 + lanes - 1);
  for (let x = 0; x < 8; x++) w.setTile(x, 9, TILE.R, 5);
  w.setTile(30, 9, TILE.I, 2);
  return w;
}

const residents = 8 * CAPACITY.R[5];

describe('estimated congestion', () => {
  it('loads every street cell between the homes and the jobs with the residents that pass', () => {
    const w = commuterTown();
    const report = computeCongestion(w);
    const expected = Math.round((100 * residents) / TRAFFIC.laneCapacity);
    expect(expected).toBeGreaterThan(100); // the fixture saturates a single street
    for (let x = 8; x < 30; x++) expect(w.traffic[w.idx(x, 10)]).toBe(expected);
    // The first homes add up along the way: one tower's residents at the first cell.
    expect(w.traffic[w.idx(0, 10)]).toBe(Math.round((100 * CAPACITY.R[5]) / TRAFFIC.laneCapacity));
    expect(report.worst).toBe(expected);
    expect(report.trips).toBe(residents);
    expect(report.jammedShare).toBeGreaterThan(0.5);
    // Lots feel the traffic of the street they open onto; land far from any street feels none.
    expect(w.jam[w.idx(7, 9)]).toBe(expected);
    expect(w.jam[w.idx(20, 30)]).toBe(0);
  });

  it('multiplies what one lane carries by the quality of the street', () => {
    for (const tier of [0, 1, 2] as const) {
      const w = commuterTown(1);
      for (let x = 0; x <= 30; x++) w.roadTier[w.idx(x, 10)] = tier;
      computeCongestion(w);
      expect(w.traffic[w.idx(15, 10)]).toBe(Math.round((100 * residents) / (TRAFFIC.laneCapacity * ROAD_TIERS[tier].capacity)));
    }
  });

  it('counts a band by its weakest cell, so a boulevard next to asphalt carries like asphalt', () => {
    const asphalt = commuterTown(2);
    const mixed = commuterTown(2);
    mixed.roadTier[mixed.idx(15, 11)] = 2;
    computeCongestion(asphalt);
    computeCongestion(mixed);
    expect(mixed.traffic[mixed.idx(15, 10)]).toBe(asphalt.traffic[asphalt.idx(15, 10)]);
    expect(mixed.traffic[mixed.idx(15, 11)]).toBe(asphalt.traffic[asphalt.idx(15, 11)]);
  });

  it('lets a pair of boulevards carry two 1.8 lanes worth', () => {
    const w = commuterTown(2);
    for (let x = 0; x <= 30; x++) {
      w.roadTier[w.idx(x, 10)] = 2;
      w.roadTier[w.idx(x, 11)] = 2;
    }
    computeCongestion(w);
    expect(w.traffic[w.idx(15, 10)]).toBe(Math.round((100 * residents) / (2 * TRAFFIC.laneCapacity * ROAD_TIERS[2].capacity)));
  });

  it('lets an avenue carry more: the same commuters on two lanes are half the congestion', () => {
    const one = commuterTown(1);
    const two = commuterTown(2);
    computeCongestion(one);
    const report = computeCongestion(two);
    const half = Math.round((100 * residents) / (2 * TRAFFIC.laneCapacity));
    expect(two.traffic[two.idx(15, 10)]).toBe(half);
    expect(two.traffic[two.idx(15, 11)]).toBe(half);
    expect(half).toBeLessThan(one.traffic[one.idx(15, 10)]);
    expect(report.jammedShare).toBe(0);
  });

  it('counts a crossing of two plain streets as one lane, not as an avenue', () => {
    const w = commuterTown();
    road(w, 15, 0, 15, 25); // a street crossing the commuter one
    computeCongestion(w);
    expect(w.traffic[w.idx(15, 10)]).toBe(Math.round((100 * residents) / TRAFFIC.laneCapacity));
    expect(w.traffic[w.idx(15, 3)]).toBe(0); // nobody commutes along the crossing street
  });

  it('carries nobody without jobs, with abandoned homes, or with homes next to their jobs', () => {
    const jobless = commuterTown();
    jobless.setTile(30, 9, TILE.EMPTY);
    expect(computeCongestion(jobless).trips).toBe(0);
    expect(jobless.traffic[jobless.idx(15, 10)]).toBe(0);

    const empty = commuterTown();
    for (let x = 0; x < 8; x++) empty.abandoned[empty.idx(x, 9)] = 1;
    computeCongestion(empty);
    expect(empty.traffic[empty.idx(15, 10)]).toBe(0);

    const mixed = commuterTown();
    for (let x = 0; x < 8; x++) mixed.setTile(x, 11, TILE.I, 2); // a workshop across the street from every tower
    mixed.setTile(30, 9, TILE.EMPTY);
    computeCongestion(mixed);
    expect(mixed.traffic[mixed.idx(15, 10)]).toBe(0);
  });

  it('splits the commuters between commerce and industry by their share of the jobs', () => {
    const w = commuterTown();
    w.setTile(0, 11, TILE.C, 5); // 100 commerce jobs right at the homes; 6 industry jobs far east
    computeCongestion(w);
    const toIndustry = residents * (CAPACITY.I[2] / (CAPACITY.I[2] + CAPACITY.C[5]));
    expect(w.traffic[w.idx(20, 10)]).toBe(Math.round((100 * toIndustry) / TRAFFIC.laneCapacity));
  });

  it('lowers the land value along a saturated street and slows the growth there', () => {
    const jammed = commuterTown(1);
    const wide = commuterTown(3);
    computeCongestion(jammed);
    computeCongestion(wide);
    computeLandValue(jammed);
    computeLandValue(wide);
    expect(jammed.landValue[jammed.idx(20, 9)]).toBeLessThan(wide.landValue[wide.idx(20, 9)]);
    expect(jamGrowthFactor(0)).toBe(1);
    expect(jamGrowthFactor(TRAFFIC.slowFrom)).toBe(1);
    expect(jamGrowthFactor(150)).toBeLessThan(1);
    expect(jamGrowthFactor(255)).toBeGreaterThanOrEqual(TRAFFIC.slowest);
  });
});
