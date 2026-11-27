import { describe, expect, it } from 'vitest';
import { SUBSIDY } from '../src/config';
import { markSubsidyOffered, subsidyDue, takeSubsidy } from '../src/sim/subsidy';
import { newSimState, Simulation } from '../src/sim/simulation';
import { deserialize, serialize } from '../src/save/save';
import { SEA_LEVEL, type Terrain } from '../src/world/terrain';
import { World } from '../src/world/world';

describe('el subsidio provincial', () => {
  it('se ofrece solo con la caja abajo de 5.000 y sin marca previa', () => {
    const s = newSimState(1);
    expect(SUBSIDY).toMatchObject({ trigger: 5000, amount: 15000 });
    s.cash = SUBSIDY.trigger;
    expect(subsidyDue(s)).toBe(false); // en 5.000 exactos todavía alcanza
    s.cash = SUBSIDY.trigger - 1;
    expect(subsidyDue(s)).toBe(true);
    markSubsidyOffered(s);
    expect(subsidyDue(s)).toBe(false); // ya se ofreció: nunca más, ni siquiera más abajo
  });

  it('cobra 15.000 una sola vez: después del cobro no vuelve a ofrecerse', () => {
    const s = newSimState(1);
    s.cash = 1200;
    const got = takeSubsidy(s);
    expect(got).toBe(SUBSIDY.amount);
    expect(s.cash).toBe(1200 + SUBSIDY.amount);
    expect(subsidyDue(s)).toBe(false);
    // Un segundo cobro no existe: la marca ya está y due vuelve a false.
    expect(takeSubsidy(s)).toBe(0);
    expect(s.cash).toBe(1200 + SUBSIDY.amount);
  });

  it('queda en el save: un save viejo sin el campo arranca sin haber cobrado', () => {
    const w = new World({ n: 8, corners: new Uint8Array(81).fill(SEA_LEVEL + 1), trees: new Uint8Array(64) } as Terrain);
    const sim = new Simulation(w, newSimState(1), 'X');
    sim.state.cash = 1200; // caja en rojo, como el d�a del telegrama
    expect(takeSubsidy(sim.state)).toBe(SUBSIDY.amount);
    const text = serialize({ name: 'X', seed: 1, world: w, sim: sim.state });
    expect(deserialize(text).sim.subsidy).toBe(true);
    const old = JSON.parse(text);
    delete old.sim.subsidy;
    expect(deserialize(JSON.stringify(old)).sim.subsidy).toBe(false);
    old.sim.subsidy = 'sí';
    expect(() => deserialize(JSON.stringify(old))).toThrow(/subsidio/);
  });
});
