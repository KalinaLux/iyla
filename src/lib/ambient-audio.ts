// Ambient audio generator for Reconnect sessions.
//
// Uses the Web Audio API to synthesize calming ambient textures procedurally
// so no external audio assets are required. All generators are designed to
// loop indefinitely and fade in/out smoothly. The module gracefully no-ops
// when AudioContext is unavailable (SSR, older browsers, etc).
//
// Public API:
//   startAmbientSound(name)   — start the named sound (stops any previous)
//   stopAmbientSound()        — fade out and release resources
//   setAmbientVolume(0..1)    — master volume
//   getAmbientVolume()        — current master volume
//   getAmbientPlaying()       — currently playing sound name or null
//   AMBIENT_SOUND_NAMES       — list of supported names

export type AmbientSoundName =
  | 'silence'
  | 'rain'
  | 'ocean'
  | 'fireplace'
  | 'white_noise'
  | 'pink_noise'
  | 'brown_noise'
  | 'om_tone'
  | 'heartbeat'
  | 'nature'
  | 'music';

export const AMBIENT_SOUND_NAMES: AmbientSoundName[] = [
  'silence',
  'rain',
  'ocean',
  'fireplace',
  'white_noise',
  'pink_noise',
  'brown_noise',
  'om_tone',
  'heartbeat',
  'nature',
  'music',
];

type Cleanup = () => void;

interface ActiveSound {
  name: AmbientSoundName;
  out: GainNode;
  cleanups: Cleanup[];
}

class AmbientAudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private active: ActiveSound | null = null;
  private volume = 0.5;

  /** Lazily construct the AudioContext. Returns null when unavailable. */
  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === 'undefined') return null;
    const AC: typeof AudioContext | undefined =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      return this.ctx;
    } catch {
      return null;
    }
  }

  private createNoiseBuffer(
    ctx: AudioContext,
    type: 'white' | 'pink' | 'brown',
  ): AudioBuffer {
    const length = 2 * ctx.sampleRate; // 2 seconds, looped
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    if (type === 'white') {
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    } else if (type === 'pink') {
      // Paul Kellet's refined pink noise algorithm.
      let b0 = 0,
        b1 = 0,
        b2 = 0,
        b3 = 0,
        b4 = 0,
        b5 = 0,
        b6 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        data[i] =
          (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    } else {
      // Brown noise via integrated white noise.
      let last = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      }
    }
    return buffer;
  }

  private makeNoiseSource(
    ctx: AudioContext,
    type: 'white' | 'pink' | 'brown',
  ): AudioBufferSourceNode {
    const src = ctx.createBufferSource();
    src.buffer = this.createNoiseBuffer(ctx, type);
    src.loop = true;
    return src;
  }

  /** Start a named sound. Returns false when audio is unavailable. */
  start(name: AmbientSoundName): boolean {
    // Stop any previous sound first (respects fade-out).
    this.stop();

    if (name === 'silence') return true;

    const ctx = this.ensureContext();
    if (!ctx || !this.master) return false;

    // Resume context if it was suspended by autoplay policy. The caller is
    // expected to invoke this in response to a user gesture.
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {
        /* ignore */
      });
    }

    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.master);
    // Gentle fade-in so sessions start calmly.
    out.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.2);

    const cleanups: Cleanup[] = [];

    const safeStop = (node: { stop: () => void }) => {
      try {
        node.stop();
      } catch {
        /* already stopped */
      }
    };

    switch (name) {
      case 'rain': {
        const noise = this.makeNoiseSource(ctx, 'pink');
        const band = ctx.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.value = 1400;
        band.Q.value = 0.6;
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 0.15;
        lfoGain.gain.value = 420;
        lfo.connect(lfoGain).connect(band.frequency);
        const gain = ctx.createGain();
        gain.gain.value = 0.9;
        noise.connect(band).connect(gain).connect(out);
        noise.start();
        lfo.start();
        cleanups.push(() => {
          safeStop(noise);
          safeStop(lfo);
        });
        break;
      }
      case 'ocean': {
        const noise = this.makeNoiseSource(ctx, 'pink');
        const low = ctx.createBiquadFilter();
        low.type = 'lowpass';
        low.frequency.value = 650;
        low.Q.value = 1.1;
        const freqLfo = ctx.createOscillator();
        const freqLfoGain = ctx.createGain();
        freqLfo.frequency.value = 0.09;
        freqLfoGain.gain.value = 350;
        freqLfo.connect(freqLfoGain).connect(low.frequency);
        const amp = ctx.createGain();
        amp.gain.value = 0.6;
        const ampLfo = ctx.createOscillator();
        const ampLfoGain = ctx.createGain();
        ampLfo.frequency.value = 0.09;
        ampLfoGain.gain.value = 0.35;
        ampLfo.connect(ampLfoGain).connect(amp.gain);
        noise.connect(low).connect(amp).connect(out);
        noise.start();
        freqLfo.start();
        ampLfo.start();
        cleanups.push(() => {
          safeStop(noise);
          safeStop(freqLfo);
          safeStop(ampLfo);
        });
        break;
      }
      case 'fireplace': {
        const noise = this.makeNoiseSource(ctx, 'brown');
        const low = ctx.createBiquadFilter();
        low.type = 'lowpass';
        low.frequency.value = 520;
        const body = ctx.createGain();
        body.gain.value = 1.1;
        noise.connect(low).connect(body).connect(out);
        noise.start();

        // Random crackle pulses (short high-frequency pops).
        let running = true;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const scheduleCrackle = () => {
          if (!running) return;
          const t = ctx.currentTime + 0.02;
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          const hp = ctx.createBiquadFilter();
          hp.type = 'highpass';
          hp.frequency.value = 1800;
          osc.type = 'square';
          osc.frequency.value = 2000 + Math.random() * 4000;
          const peak = 0.08 + Math.random() * 0.1;
          const dur = 0.04 + Math.random() * 0.09;
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(peak, t + 0.005);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          osc.connect(hp).connect(g).connect(out);
          osc.start(t);
          osc.stop(t + dur + 0.05);
          timer = setTimeout(scheduleCrackle, 180 + Math.random() * 1300);
        };
        scheduleCrackle();

        cleanups.push(() => {
          running = false;
          if (timer) clearTimeout(timer);
          safeStop(noise);
        });
        break;
      }
      case 'white_noise': {
        const noise = this.makeNoiseSource(ctx, 'white');
        const g = ctx.createGain();
        g.gain.value = 0.4;
        noise.connect(g).connect(out);
        noise.start();
        cleanups.push(() => safeStop(noise));
        break;
      }
      case 'pink_noise': {
        const noise = this.makeNoiseSource(ctx, 'pink');
        const g = ctx.createGain();
        g.gain.value = 0.75;
        noise.connect(g).connect(out);
        noise.start();
        cleanups.push(() => safeStop(noise));
        break;
      }
      case 'brown_noise': {
        const noise = this.makeNoiseSource(ctx, 'brown');
        const g = ctx.createGain();
        g.gain.value = 0.95;
        noise.connect(g).connect(out);
        noise.start();
        cleanups.push(() => safeStop(noise));
        break;
      }
      case 'om_tone': {
        // 136.1 Hz is often cited as the "resonant frequency of earth"
        // (Cosmic Om). Layer a sub-octave and octave with a slow chorus LFO.
        const f = 136.1;
        const osc1 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.value = f;
        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = f * 2;
        const osc3 = ctx.createOscillator();
        osc3.type = 'sine';
        osc3.frequency.value = f * 0.5;

        const chorusLfo = ctx.createOscillator();
        chorusLfo.frequency.value = 0.35;
        const chorusGain = ctx.createGain();
        chorusGain.gain.value = 0.9;
        chorusLfo.connect(chorusGain).connect(osc2.frequency);

        const mix = ctx.createGain();
        mix.gain.value = 0.35;
        osc1.connect(mix);
        osc2.connect(mix);
        osc3.connect(mix);
        mix.connect(out);

        osc1.start();
        osc2.start();
        osc3.start();
        chorusLfo.start();
        cleanups.push(() => {
          safeStop(osc1);
          safeStop(osc2);
          safeStop(osc3);
          safeStop(chorusLfo);
        });
        break;
      }
      case 'heartbeat': {
        // Low-pass filtered sine thump scheduled on a lub-dub pattern at 72 bpm.
        const bpm = 72;
        const interval = 60 / bpm;
        let running = true;
        let timer: ReturnType<typeof setTimeout> | null = null;

        const beat = (time: number, peak: number) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 120;
          osc.type = 'sine';
          osc.frequency.setValueAtTime(80, time);
          osc.frequency.exponentialRampToValueAtTime(40, time + 0.16);
          g.gain.setValueAtTime(0, time);
          g.gain.linearRampToValueAtTime(peak, time + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);
          osc.connect(lp).connect(g).connect(out);
          osc.start(time);
          osc.stop(time + 0.35);
        };

        const schedule = () => {
          if (!running) return;
          const t = ctx.currentTime + 0.02;
          beat(t, 0.85);
          beat(t + 0.28, 0.6);
          timer = setTimeout(schedule, interval * 1000);
        };
        schedule();

        cleanups.push(() => {
          running = false;
          if (timer) clearTimeout(timer);
        });
        break;
      }
      case 'nature': {
        // Gentle low-pass pink noise (wind) + occasional bird-like chirps.
        const noise = this.makeNoiseSource(ctx, 'pink');
        const low = ctx.createBiquadFilter();
        low.type = 'lowpass';
        low.frequency.value = 1800;
        const g = ctx.createGain();
        g.gain.value = 0.3;
        noise.connect(low).connect(g).connect(out);
        noise.start();

        let running = true;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const chirp = () => {
          if (!running) return;
          const t = ctx.currentTime + 0.05;
          const osc = ctx.createOscillator();
          const cg = ctx.createGain();
          osc.type = 'sine';
          const f0 = 2400 + Math.random() * 1600;
          osc.frequency.setValueAtTime(f0, t);
          osc.frequency.exponentialRampToValueAtTime(
            f0 * (0.65 + Math.random() * 0.4),
            t + 0.22,
          );
          cg.gain.setValueAtTime(0, t);
          cg.gain.linearRampToValueAtTime(0.14, t + 0.04);
          cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
          osc.connect(cg).connect(out);
          osc.start(t);
          osc.stop(t + 0.3);
          timer = setTimeout(chirp, 900 + Math.random() * 3600);
        };
        timer = setTimeout(chirp, 1800);

        cleanups.push(() => {
          running = false;
          if (timer) clearTimeout(timer);
          safeStop(noise);
        });
        break;
      }
      case 'music': {
        // Soft harmonic pad: a gentle drone stack with amplitude modulation.
        const freqs = [220, 277.18, 329.63, 440]; // A3, C#4, E4, A4
        const oscs = freqs.map((freq) => {
          const o = ctx.createOscillator();
          o.type = 'sine';
          o.frequency.value = freq;
          return o;
        });
        const mix = ctx.createGain();
        mix.gain.value = 0.09;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.1;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.04;
        lfo.connect(lfoGain).connect(mix.gain);
        oscs.forEach((o) => o.connect(mix));
        mix.connect(out);
        oscs.forEach((o) => o.start());
        lfo.start();
        cleanups.push(() => {
          oscs.forEach(safeStop);
          safeStop(lfo);
        });
        break;
      }
      default:
        // Unknown name — treat as silence.
        return true;
    }

    this.active = { name, out, cleanups };
    return true;
  }

  stop(): void {
    const active = this.active;
    if (!active || !this.ctx) return;
    const ctx = this.ctx;
    const { out, cleanups } = active;
    this.active = null;
    try {
      const now = ctx.currentTime;
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(out.gain.value, now);
      out.gain.linearRampToValueAtTime(0, now + 0.3);
    } catch {
      /* ignore */
    }
    // Let the fade-out play out before tearing down sources.
    setTimeout(() => {
      cleanups.forEach((fn) => {
        try {
          fn();
        } catch {
          /* ignore */
        }
      });
      try {
        out.disconnect();
      } catch {
        /* ignore */
      }
    }, 420);
  }

  setVolume(v: number): void {
    const clamped = Math.max(0, Math.min(1, v));
    this.volume = clamped;
    if (!this.master || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(clamped, now + 0.1);
    } catch {
      /* ignore */
    }
  }

  getVolume(): number {
    return this.volume;
  }

  getPlaying(): AmbientSoundName | null {
    return this.active?.name ?? null;
  }
}

const engine = new AmbientAudioEngine();

export function startAmbientSound(name: string): boolean {
  if (!AMBIENT_SOUND_NAMES.includes(name as AmbientSoundName)) {
    return false;
  }
  return engine.start(name as AmbientSoundName);
}

export function stopAmbientSound(): void {
  engine.stop();
}

export function setAmbientVolume(v: number): void {
  engine.setVolume(v);
}

export function getAmbientVolume(): number {
  return engine.getVolume();
}

export function getAmbientPlaying(): AmbientSoundName | null {
  return engine.getPlaying();
}

export function isAmbientAudioSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext,
  );
}
