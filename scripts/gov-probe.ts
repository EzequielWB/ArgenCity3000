/**
 * Government balance probe: one planned city, played the same way under every form of government,
 * reporting how far it grows, whether it reaches 150.000 residents and whether it loses the power.
 *
 * The plan comes from the rules, not from intuition:
 * - Bands five lots deep with a street above and below: `ROAD_REACH` is 3, so a lot further than
 *   three cells from a street has no road access and abandons at 0,4 % a tick (`simulation.ts:727`).
 * - Homes, shops and factories interleaved: every trip goes to the nearest job, so a mixed band
 *   keeps commutes short and the load spread (`congestion.ts:48`).
 * - A plaza every 24 cells: land value starts at 25 and takes up to +30 from green spaces
 *   (`fields.ts:318`), and a level-4 lot needs 29 (`demand.ts:95`).
 * - The plants in a strip along the top edge, touching the first band. Only a building passes the
 *   light on (`power.ts:86`), so a plant out in an empty field lights nothing and the city never
 *   starts. From there the light travels through the built lots.
 *
 * The player buys, each month, in this order: power, abandoned buildings, services, next band.
 *
 * Run: `npx vite-node scripts/gov-probe.ts [years] [--only=<gov>] [--seed=<n>] [--diag]`
 */
import { TILE, World } from '../src/world/world';
import { generateTerrain } from '../src/world/terrain';
import { applyPlan, dragCells, planTool, type ToolId } from '../src/world/tools';
import { Simulation, newSimState } from '../src/sim/simulation';
import { DEFAULT_TAX, GOVERNMENTS, TICKS_PER_MONTH, type GovernmentKind, type ServiceKind } from '../src/config';

/** Node's argv, read the way every script in this folder reads it. */
const env = (globalThis as unknown as { process: { argv: string[] } }).process;


const N = 128;
const TARGET_POP = 150_000;
/** A city of 150k needs this much a month to pay for forty plants and the services that hold it. */
const TAX = 9;
const GOVS: GovernmentKind[] = ['democracia', 'dictadura', 'tecnocracia', 'teocracia', 'comunismo'];

/** Lots deep in a band: three cells from the street above, two from the one below. */
const DEPTH = 5;
const PITCH = 6;
/** Rows kept for the power plants, touching the first band: a plant is 2x2 and its light reaches 3. */
const PLANT_ROWS = 2;
/** Vertical streets, so the load has more than one way across. */
const VERTICALS = [1, 25, 49, 73, 97, 121];

/**
 * Bands run in a four-beat pattern: industry, homes, homes, a strip left empty as a buffer.
 * Every working factory and plant splats smoke over four cells (`fields.ts:90`), ten points a
 * level, and land value loses 0,7 a point of it: a level-4 factory next to a house takes the house
 * under the 29 the fourth level needs (`demand.ts:95`). The empty band is the distance, and it
 * costs nothing.
 */
const PATTERN = ['industry', 'home', 'home', 'buffer'] as const;

/** Homes and shops in a home band: `targetC` asks for shops worth about 0,6 of the homes. */
const HOME_CYCLE: ('R' | 'C')[] = ['R', 'R', 'R', 'R', 'R', 'C', 'C', 'C'];

const ZONE_TOOL: Record<'R' | 'C' | 'I', ToolId> = { R: 'zoneR', C: 'zoneC', I: 'zoneI' };

/**
 * One service per this many residents, from the population the game unlocks it at. It is denser
 * than `SERVICES[kind].capacity` on purpose: coverage fades towards the edge and drops in
 * proportion when the disc holds more people than the service takes (`fields.ts:205`).
 */
const SERVICE_PLAN: [ServiceKind, number, number][] = [
  ['school', 3000, 100],
  ['clinic', 3000, 100],
  ['fire', 8000, 500],
  ['police', 6000, 200],
  ['hospital', 15000, 2500],
  ['university', 18000, 2500],
];

export interface Report {
  government: GovernmentKind;
  peakPop: number;
  year150k: number | null;
  years: number;
  lost: boolean;
  terms: number;
  approval: number;
  cash: number;
  abandoned: number;
}

function play(government: GovernmentKind, years: number, diag: boolean, seed: number): Report {
  const w = new World(generateTerrain(seed, N));
  const sim = new Simulation(w, newSimState(seed, government), 'Prueba');

  const spent = { band: 0, plant: 0, service: 0, bulldoze: 0 };
  let bucket: keyof typeof spent = 'band';

  /** Builds a plan if the city can pay for it. */
  const buy = (t: ToolId, ax: number, ay: number, bx = ax, by = ay): boolean => {
    const p = planTool(w, t, dragCells(t, ax, ay, bx, by, 1, N));
    if (!p.cells.length || !sim.spend(p.cost)) return false;
    applyPlan(w, p);
    spent[bucket] += p.cost;
    return true;
  };

  // The plan: the bands, the plant strip and the slots kept for services.
  const bands: number[] = [];
  for (let y0 = PLANT_ROWS; y0 + DEPTH < N; y0 += PITCH) bands.push(y0);
  const plantSlots: [number, number][] = [];
  for (let x = 0; x + 1 < N; x += 2) plantSlots.push([x, 0]);
  const serviceSlots: [number, number][] = [];
  const servicesBuilt: Record<ServiceKind, number> = { school: 0, clinic: 0, police: 0, fire: 0, hospital: 0, university: 0 };
  let nextBand = 0;
  let nextPlant = 0;
  let nextService = 0;
  let zoneSeed = 0;

  const buildBand = (y0: number, beat: (typeof PATTERN)[number]): void => {
    buy('road', 1, y0, N - 2, y0);
    for (const x of VERTICALS) buy('road', x, y0, x, y0 + DEPTH - 1);
    // A power line along the bottom of every band. Without it the light hangs off the buildings
    // themselves, and the first lot the bulldozer clears takes the whole network down with it.
    buy('line', 2, y0 + DEPTH, N - 3, y0 + DEPTH);
    if (beat === 'buffer') {
      // Empty land carries no light: the line of this band needs a way down to the next one.
      buy('line', 2, y0 + 1, 2, y0 + DEPTH);
      buy('line', 63, y0 + 1, 63, y0 + DEPTH);
      return;
    }
    if (beat === 'home') {
      for (let x = 4; x + 1 < N - 2; x += 24) buy('park', x, y0 + 2, x + 1, y0 + 3);
    }
    for (let y = y0 + 1; y <= y0 + DEPTH - 1; y++) {
      for (let x = 2; x < N - 2; x++) {
        if (VERTICALS.includes(x)) continue;
        if (beat === 'industry') {
          buy('zoneI', x, y);
          continue;
        }
        const plazaX = 4 + 24 * Math.floor((x - 4) / 24);
        if (y >= y0 + 2 && y <= y0 + 3 && x >= plazaX && x <= plazaX + 1) continue; // the plaza
        if (y === y0 + 1 && (x - 12) % 24 === 0) continue; // a slot kept for a service
        buy(ZONE_TOOL[HOME_CYCLE[zoneSeed++ % HOME_CYCLE.length]], x, y);
      }
    }
    if (beat === 'home') for (let x = 12; x < N - 2; x += 24) serviceSlots.push([x, y0 + 1]);
  };

  /** Another plant as soon as the light is close to running out, or already has. */
  const needPower = (): void => {
    const { shortage, use, capacity } = sim.power;
    // The same headroom the band gate asks for: a plant built only on shortage leaves the city at
    // ninety-something percent of the light, with the money to grow and nowhere to put it.
    if (!shortage && capacity > 0 && use < capacity * 0.75) return;
    const slot = plantSlots[nextPlant];
    if (!slot) return;
    bucket = 'plant';
    if (buy('plant', slot[0], slot[1])) nextPlant++;
    bucket = 'band';
  };

  /** An abandoned building is the worst thing for the neighbours' mood: clear what the city can afford. */
  const clearAbandoned = (): void => {
    let done = 0;
    for (let i = 0; i < w.abandoned.length && done < 8; i++) {
      if (!w.abandoned[i] || w.level[i] === 0) continue;
      const x = i % N;
      bucket = 'bulldoze';
      if (buy('bulldoze', x, (i - x) / N)) done++;
      bucket = 'band';
    }
  };

  /** One service per the residents the plan asks for, spread over the slots kept in every band. */
  const needServices = (): void => {
    const pop = sim.totals.pop;
    for (const [kind, per, from] of SERVICE_PLAN) {
      const need = pop < from ? 0 : Math.ceil(pop / per);
      while (servicesBuilt[kind] < need) {
        if (!serviceSlots.length) return;
        const slot = serviceSlots[nextService++ % serviceSlots.length];
        bucket = 'service';
        const ok = buy(kind, slot[0], slot[1]);
        bucket = 'band';
        if (!ok) return;
        servicesBuilt[kind]++;
      }
    }
  };

  /**
   * Taxes: low enough to please the neighbours (each point under the default is worth 2,5 points of
   * approval, `politics.ts:100`) and raised only when the till runs dry. From 10 % the city stops
   * attracting people, so it never goes there.
   */
  const manageBudget = (): void => {
    const s = sim.state;
    const balance = s.lastBudget?.balance ?? 0;
    if (balance < 0 && s.cash < 6000 && s.taxes.R < 10) sim.setTax(s.taxes.R + 1);
    else if (balance > 2000 && s.cash > 20000 && s.taxes.R > 9) sim.setTax(s.taxes.R - 1);
    // The credit is what carries a young city over the hump: at level 2 the light costs seven times
    // what it costs at level 4, and the till is at breakeven exactly when the towers are due.
    if (!s.loan && s.cash < 6000 && balance > -1500) sim.takeLoan(0);
  };

  /**
   * A band takes about two years to fill and bleeds while it does, so the city only lays another one
   * with a year of deficit in the till on top of a floor. Going into the red stops the growth
   * altogether (`simulation.ts:699`), and that is the death the previous player died.
   */
  const canBuild = (): boolean => {
    const balance = sim.state.lastBudget?.balance ?? 0;
    // A band without power is a band that abandons, and a plant for it costs 3.000: keep headroom.
    if (sim.power.capacity > 0 && sim.power.use > sim.power.capacity * 0.75) return false;
    return sim.state.cash > 8000 + Math.max(0, -balance) * 6;
  };

  sim.setTax(TAX);

  let peakPop = 0;
  let year150k: number | null = null;
  for (let year = 1; year <= years; year++) {
    for (let month = 0; month < 12; month++) {
      for (let k = 0; k < TICKS_PER_MONTH; k++) sim.tick();
      needPower();
      clearAbandoned();
      needServices();
      // The first three bands are the seed: industry, homes, homes. Without them there is nobody to pay for anything.
      if ((nextBand < 3 || canBuild()) && nextBand < bands.length) {
        buildBand(bands[nextBand], PATTERN[nextBand % PATTERN.length]);
        nextBand++;
      }
      manageBudget();
    }
    peakPop = Math.max(peakPop, sim.totals.pop);
    if (year150k === null && sim.totals.pop >= TARGET_POP) year150k = year;
    if (diag) {
      let occ = 0, lit = 0, acc = 0, lv = 0, value = 0, smoke = 0, crime = 0, edu = 0, health = 0, zero = 0;
      let rOcc = 0, rValue = 0, rSmoke = 0, rLow = 0;
      for (let i = 0; i < w.tiles.length; i++) {
        if (!w.isOccupied(i)) continue;
        occ++;
        lv += w.level[i];
        if (w.powered[i]) lit++;
        if (w.roadAccess[i]) acc++;
        value += w.landValue[i];
        smoke += w.pollution[i];
        crime += w.crime[i];
        edu += w.edu[i];
        health += w.health[i];
        if (w.landValue[i] < 29) zero++;
        if (w.tiles[i] === TILE.R) {
          rOcc++;
          rValue += w.landValue[i];
          rSmoke += w.pollution[i];
          if (w.landValue[i] < 29) rLow++;
        }
      }
      const avg = (v: number) => (occ ? Math.round(v / occ) : 0);
      const rAvg = (v: number) => (rOcc ? Math.round(v / rOcc) : 0);
      console.log(`  lotes: ${occ} nivel ${occ ? (lv / occ).toFixed(1) : 0} | casas ${rOcc}: valor ${rAvg(rValue)} (bajo 29: ${rLow}), humo ${rAvg(rSmoke)} | todo: valor ${avg(value)} humo ${avg(smoke)} delito ${avg(crime)} edu ${avg(edu)} salud ${avg(health)} | abandonados ${sim.abandonedCount}`);
    }
    if (diag && (year <= 3 || year % 5 === 0)) {
      const bb = sim.state.lastBudget;
      if (bb) console.log(`  plata año ${year}: ingreso ${bb.income} (R ${bb.taxR} C ${bb.taxC} I ${bb.taxI}) gasto ${bb.expenses} (caminos ${bb.roads} luz ${bb.plants} admin ${bb.services} esc ${bb.schools} cli ${bb.clinics} pol ${bb.police} bom ${bb.firefighters} hosp ${bb.hospitals} univ ${bb.universities})`);
    }
    if (diag) {
      const b = sim.state.lastBudget;
      console.log(
        `  ${government} año ${year}: pop ${sim.totals.pop} bandas ${nextBand}/${bands.length} dem ${sim.demand.R}/${sim.demand.C}/${sim.demand.I} luz ${sim.power.use}/${sim.power.capacity}${sim.power.shortage ? ' FALTA' : ''} tránsito ${sim.congestion.worst}% atasc ${Math.round(sim.congestion.jammedShare * 100)}% caja ${sim.state.cash} saldo ${b?.balance ?? 0} tasa ${sim.state.taxes.R} aprob ${sim.state.approval}${sim.state.lostElection ? ' PERDIÓ' : ''} gastado ${JSON.stringify(spent)}`,
      );
    }
  }

  return {
    government,
    peakPop,
    year150k,
    years,
    lost: sim.state.lostElection,
    terms: sim.state.terms,
    approval: sim.state.approval,
    cash: sim.state.cash,
    abandoned: sim.abandonedCount,
  };
}

const years = Number(env.argv[2] ?? 50);
const diag = env.argv.includes('--diag');
const seed = Number(env.argv.find((a: string) => a.startsWith('--seed='))?.slice(7) ?? 7);
const only = env.argv.find((a: string) => a.startsWith('--only='))?.slice(7) as GovernmentKind | undefined;
const pad = (v: string | number, w: number) => String(v).padStart(w);

const rows: Report[] = [];
for (const government of only ? [only] : GOVS) {
  if (diag) console.log(`\n== ${GOVERNMENTS[government].label} (tasa inicial ${DEFAULT_TAX})`);
  rows.push(play(government, years, diag, seed));
}

console.log('\ngobierno      pico pob  150k  perdió  mandatos  aprob  caja      abandonados');
for (const r of rows) {
  console.log(
    `${r.government.padEnd(13)}${pad(r.peakPop, 9)}${pad(r.year150k ? `año ${r.year150k}` : 'NO', 7)}${pad(r.lost ? 'SÍ' : 'no', 8)}${pad(r.terms, 10)}${pad(`${r.approval}%`, 7)}${pad(Math.round(r.cash), 10)}${pad(r.abandoned, 13)}`,
  );
}
