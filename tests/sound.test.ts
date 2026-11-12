import { describe, expect, it } from 'vitest';
import { Sound, ambienceMix, loadMuted, saveMuted } from '../src/audio/sound';

/** Minimal stand-in for the Web Audio API that counts the nodes created. */
function fakeContext() {
  const created: string[] = [];
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime() {},
    cancelScheduledValues() {},
  });
  const node = (kind: string) => {
    created.push(kind);
    return {
      gain: param(),
      frequency: param(),
      Q: param(),
      type: '',
      buffer: null,
      loop: false,
      connect() {},
      disconnect() {},
      start() {},
      stop() {},
    };
  };
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    state: 'running',
    destination: {},
    resume: () => Promise.resolve(),
    createGain: () => node('gain'),
    createOscillator: () => node('osc'),
    createBiquadFilter: () => node('filter'),
    createBufferSource: () => node('source'),
    createBuffer: (_c: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
  };
  return { ctx: ctx as unknown as AudioContext, created };
}

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() {
      return m.size;
    },
  };
}

describe('ambienceMix', () => {
  it('is silent without a city', () => {
    expect(ambienceMix({ pop: 0, cars: 0, running: true })).toEqual({ hum: 0, traffic: 0, birds: 0 });
  });

  it('grows the city hum and traffic with the city, and birds fade out', () => {
    const town = ambienceMix({ pop: 300, cars: 5, running: true });
    const city = ambienceMix({ pop: 20000, cars: 150, running: true });
    expect(city.hum).toBeGreaterThan(town.hum);
    expect(city.traffic).toBeGreaterThan(town.traffic);
    expect(town.birds).toBeGreaterThan(0);
    expect(city.birds).toBe(0);
    for (const v of [...Object.values(town), ...Object.values(city)]) expect(v).toBeLessThanOrEqual(1);
  });

  it('keeps only a low hum while paused', () => {
    const running = ambienceMix({ pop: 5000, cars: 80, running: true });
    const paused = ambienceMix({ pop: 5000, cars: 80, running: false });
    expect(paused.traffic).toBe(0);
    expect(paused.birds).toBe(0);
    expect(paused.hum).toBeGreaterThan(0);
    expect(paused.hum).toBeLessThan(running.hum);
  });
});

describe('mute preference', () => {
  it('is remembered', () => {
    const s = memoryStorage();
    expect(loadMuted(s)).toBe(false);
    saveMuted(s, true);
    expect(loadMuted(s)).toBe(true);
    saveMuted(s, false);
    expect(loadMuted(s)).toBe(false);
  });

  it('survives a browser that blocks storage', () => {
    const blocked = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    expect(loadMuted(blocked)).toBe(false);
    expect(() => saveMuted(blocked, true)).not.toThrow();
    expect(loadMuted(null)).toBe(false);
  });
});

describe('Sound', () => {
  it('does nothing, without failing, when the browser has no audio', () => {
    const sound = new Sound(() => null, memoryStorage());
    sound.unlock();
    expect(() => {
      sound.play('build');
      sound.update({ pop: 5000, cars: 50, running: true }, 0.5);
      sound.toggle();
    }).not.toThrow();
  });

  it('plays effects only after the first gesture and only when not muted', () => {
    const { ctx, created } = fakeContext();
    const storage = memoryStorage();
    const sound = new Sound(() => ctx, storage);
    sound.play('build');
    expect(created).toHaveLength(0);
    sound.unlock();
    const base = created.length;
    sound.play('build');
    expect(created.length).toBeGreaterThan(base);

    expect(sound.toggle()).toBe(true);
    expect(sound.muted).toBe(true);
    expect(loadMuted(storage)).toBe(true);
    const muted = created.length;
    sound.play('bulldoze');
    sound.play('news');
    expect(created.length).toBe(muted);
  });

  it('starts muted when the player muted it last time', () => {
    const storage = memoryStorage();
    saveMuted(storage, true);
    expect(new Sound(() => null, storage).muted).toBe(true);
  });
});
