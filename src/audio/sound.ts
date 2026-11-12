/**
 * City sounds made with the Web Audio API, without audio files: a low city hum and traffic
 * noise that follow the size of the city, the odd horn and bird, and short effects for the
 * player's actions. Browsers only allow audio after a user gesture, so nothing is created
 * until `unlock` is called from one.
 */

export type Sfx = 'build' | 'bulldoze' | 'deny' | 'undo' | 'news' | 'fire';

export interface AmbienceInput {
  pop: number;
  /** Cars currently on screen. */
  cars: number;
  /** False while paused or behind a dialog. */
  running: boolean;
}

export interface AmbienceMix {
  hum: number;
  traffic: number;
  birds: number;
}

/** Target level (0–1) of each ambient layer. */
export function ambienceMix({ pop, cars, running }: AmbienceInput): AmbienceMix {
  if (pop <= 0) return { hum: 0, traffic: 0, birds: 0 };
  const size = Math.min(1, Math.sqrt(pop / 20000));
  return {
    hum: (0.25 + 0.75 * size) * (running ? 1 : 0.4),
    traffic: running ? Math.min(1, cars / 150) : 0,
    birds: running ? Math.max(0, 1 - pop / 4000) * 0.8 : 0,
  };
}

const MUTED_KEY = 'argencity3000/muted';

export function loadMuted(storage: Storage | null): boolean {
  try {
    return storage?.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveMuted(storage: Storage | null, muted: boolean): void {
  try {
    storage?.setItem(MUTED_KEY, muted ? '1' : '0');
  } catch {
    // Remembering the choice is a convenience; the toggle still works for this session.
  }
}

export function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function browserAudio(): AudioContext | null {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

const MASTER = 0.6;
/** Seconds between two fire sirens, so a burning block does not wail non-stop. */
const SIREN_GAP = 12;

type Wave = 'sine' | 'square' | 'sawtooth' | 'triangle';

export class Sound {
  muted: boolean;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private hum: GainNode | null = null;
  private traffic: GainNode | null = null;
  private lastSiren = -Infinity;

  constructor(
    private makeContext: () => AudioContext | null,
    private storage: Storage | null,
  ) {
    this.muted = loadMuted(storage);
  }

  /** Call from a user gesture: creates the audio graph the first time, resumes it afterwards. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    let ctx: AudioContext | null = null;
    try {
      ctx = this.makeContext();
    } catch {
      ctx = null;
    }
    if (!ctx) return;
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : MASTER;
    this.master.connect(ctx.destination);
    this.noise = brownNoise(ctx, 3);
    this.hum = this.loop('lowpass', 260, 0.7);
    this.traffic = this.loop('bandpass', 700, 0.6);
  }

  /** Flips mute, remembers it, and returns the new state. */
  toggle(): boolean {
    this.muted = !this.muted;
    saveMuted(this.storage, this.muted);
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : MASTER, this.ctx.currentTime, 0.05);
    return this.muted;
  }

  /** Follows the city with the ambient layers; `dt` is the seconds since the last call. */
  update(input: AmbienceInput, dt: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.hum || !this.traffic) return;
    const mix = ambienceMix(input);
    this.hum.gain.setTargetAtTime(mix.hum * 0.5, ctx.currentTime, 0.8);
    this.traffic.gain.setTargetAtTime(mix.traffic * 0.22, ctx.currentTime, 0.8);
    if (this.muted) return;
    if (Math.random() < mix.traffic * 0.08 * dt) this.horn();
    if (Math.random() < mix.birds * 0.5 * dt) this.chirp();
  }

  play(sfx: Sfx): void {
    if (!this.ctx || this.muted) return;
    switch (sfx) {
      case 'build':
        this.burst(0, 0.07, 'lowpass', 1400, 600, 0.5);
        this.tone(0, 0.12, 'sine', 0.6, 170, 90);
        break;
      case 'bulldoze':
        this.burst(0, 0.45, 'lowpass', 900, 150, 0.7);
        this.tone(0, 0.4, 'sawtooth', 0.12, 70, 45);
        break;
      case 'deny':
        this.tone(0, 0.09, 'square', 0.1, 150);
        this.tone(0.12, 0.12, 'square', 0.1, 120);
        break;
      case 'undo':
        this.tone(0, 0.14, 'triangle', 0.25, 660, 330);
        break;
      case 'news':
        this.tone(0, 0.5, 'sine', 0.16, 1046);
        this.tone(0.12, 0.6, 'sine', 0.1, 1568);
        break;
      case 'fire': {
        const now = this.ctx.currentTime;
        if (now - this.lastSiren < SIREN_GAP) return;
        this.lastSiren = now;
        this.siren();
        break;
      }
    }
  }

  // ---------------------------------------------------------------- building blocks

  /** A looping noise layer through a filter, starting silent. */
  private loop(type: BiquadFilterType, freq: number, q: number): GainNode {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    src.start();
    return gain;
  }

  /** A short tone with a quick attack and an exponential decay, optionally gliding to `to`. */
  private tone(at: number, dur: number, wave: Wave, vol: number, from: number, to = from): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(from, t);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** A burst of filtered noise whose filter sweeps from `f0` to `f1`. */
  private burst(at: number, dur: number, type: BiquadFilterType, f0: number, f1: number, vol: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(f0, t);
    filter.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    src.start(t, Math.random() * 2);
    src.stop(t + dur + 0.05);
  }

  /** A car horn far away: two detuned square waves, muffled; sometimes a double honk. */
  private horn(): void {
    const double = Math.random() < 0.4;
    for (const at of double ? [0, 0.28] : [0]) {
      for (const f of [370, 466]) this.muffled(at, 0.18, f, 0.035);
    }
  }

  private muffled(at: number, dur: number, freq: number, vol: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, t);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1600;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.02);
    gain.gain.setValueAtTime(vol, t + dur - 0.03);
    gain.gain.linearRampToValueAtTime(0.0001, t + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** A small bird: two or three quick upward whistles. */
  private chirp(): void {
    const n = 2 + Math.floor(Math.random() * 2);
    const base = 2600 + Math.random() * 900;
    for (let k = 0; k < n; k++) this.tone(k * 0.11, 0.07, 'sine', 0.035, base, base * 1.35);
  }

  /** A fire engine siren in the distance. */
  private siren(): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(650, t);
    for (let k = 0; k < 4; k++) {
      osc.frequency.linearRampToValueAtTime(k % 2 ? 650 : 950, t + 0.4 * (k + 1));
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.09, t + 0.2);
    gain.gain.setValueAtTime(0.09, t + 1.3);
    gain.gain.linearRampToValueAtTime(0.0001, t + 1.6);
    osc.connect(gain);
    gain.connect(this.master!);
    osc.start(t);
    osc.stop(t + 1.65);
  }
}

/** Brown noise (deep, like distant traffic) of `seconds` length. */
function brownNoise(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = last * 3.5;
  }
  return buffer;
}
