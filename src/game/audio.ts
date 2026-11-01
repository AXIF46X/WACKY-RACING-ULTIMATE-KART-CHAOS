// ============================================================================
// Procedural audio — 100% synthesized WebAudio: SFX + chiptune music sequencer.
// No audio files. Safe to import on the server (everything is lazy + guarded).
// ============================================================================

type MusicMode = "menu" | "race" | "off";

class AudioManClass {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private musicOn = true;
  private sfxOn = true;
  private musicMode: MusicMode = "off";
  private seqTimer: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  /** Create/resume the AudioContext. Must be called from a user gesture. */
  ensure(): void {
    if (typeof window === "undefined") return;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.9;
        this.master.connect(this.ctx.destination);
        this.sfxBus = this.ctx.createGain();
        this.sfxBus.gain.value = this.sfxOn ? 1 : 0;
        this.sfxBus.connect(this.master);
        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = this.musicOn ? 0.5 : 0;
        this.musicBus.connect(this.master);
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === "running";
  }

  setMusicOn(on: boolean): void {
    this.musicOn = on;
    if (this.musicBus && this.ctx) this.musicBus.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.05);
  }

  setSfxOn(on: boolean): void {
    this.sfxOn = on;
    if (this.sfxBus && this.ctx) this.sfxBus.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05);
  }

  // ------------------------------------------------------------------
  // SFX
  // ------------------------------------------------------------------

  private env(gain: GainNode, t0: number, peak: number, dur: number): void {
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }

  private tone(freq: number, dur: number, type: OscillatorType, peak = 0.25, slideTo?: number, delay = 0): void {
    if (!this.ctx || !this.sfxBus || !this.sfxOn) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    this.env(g, t0, peak, dur);
    osc.connect(g).connect(this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, peak = 0.2, filterFreq = 1200, delay = 0): void {
    if (!this.ctx || !this.sfxBus || !this.sfxOn) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    this.env(g, t0, peak, dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t0);
  }

  sfx(name: string): void {
    if (!this.ctx || !this.sfxOn) return;
    switch (name) {
      case "click": this.tone(660, 0.07, "square", 0.15); break;
      case "coin": this.tone(990, 0.08, "square", 0.2); this.tone(1320, 0.14, "square", 0.2, undefined, 0.06); break;
      case "pickup": this.tone(520, 0.09, "triangle", 0.25, 780); this.tone(780, 0.12, "triangle", 0.22, 1040, 0.07); break;
      case "boost": this.noise(0.5, 0.3, 2400); this.tone(180, 0.45, "sawtooth", 0.22, 620); break;
      case "hit": this.noise(0.25, 0.35, 700); this.tone(120, 0.25, "square", 0.25, 60); break;
      case "spinout": this.tone(500, 0.5, "sawtooth", 0.22, 90); this.tone(300, 0.5, "square", 0.15, 70, 0.1); break;
      case "splash": this.noise(0.35, 0.3, 900); break;
      case "freeze": this.tone(1200, 0.3, "sine", 0.2, 300); this.tone(900, 0.35, "sine", 0.18, 200, 0.08); break;
      case "count": this.tone(440, 0.12, "square", 0.25); break;
      case "go": this.tone(880, 0.35, "square", 0.3); this.tone(1320, 0.3, "square", 0.2, undefined, 0.05); break;
      case "finish": [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, "square", 0.24, undefined, i * 0.13)); break;
      case "fanfare": [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.3, "triangle", 0.26, undefined, i * 0.1)); break;
      case "drift": this.noise(0.12, 0.12, 1800); break;
      case "land": this.noise(0.15, 0.3, 500); this.tone(90, 0.15, "sine", 0.3, 50); break;
      case "yeet": this.tone(300, 0.7, "sawtooth", 0.28, 1400); this.noise(0.5, 0.2, 2000, 0.05); break;
      case "chicken": this.tone(700, 0.12, "square", 0.22, 900); this.tone(650, 0.12, "square", 0.2, 850, 0.1); this.tone(600, 0.18, "square", 0.2, 780, 0.2); break;
      case "explosion": this.noise(0.6, 0.4, 500); this.tone(80, 0.5, "sawtooth", 0.3, 40); break;
      case "shield": this.tone(600, 0.25, "sine", 0.22, 1200); break;
      case "shrink": this.tone(800, 0.4, "sine", 0.2, 200); break;
      case "grow": this.tone(200, 0.4, "sine", 0.22, 800); break;
      case "teleport": this.tone(1400, 0.2, "sine", 0.2, 300); this.tone(300, 0.25, "sine", 0.18, 1400, 0.12); break;
      case "error": this.tone(220, 0.18, "square", 0.2, 180); this.tone(180, 0.25, "square", 0.2, 140, 0.15); break;
      case "buy": this.tone(784, 0.1, "square", 0.22); this.tone(1047, 0.2, "square", 0.22, undefined, 0.08); break;
      case "equip": this.tone(520, 0.1, "triangle", 0.22, 700); break;
      case "lap": this.tone(660, 0.12, "square", 0.22); this.tone(880, 0.18, "square", 0.22, undefined, 0.1); break;
      case "wrongway": this.tone(300, 0.15, "square", 0.2, 350); break;
      case "rumble": this.noise(0.8, 0.25, 300); break;
      default: this.tone(440, 0.1, "square", 0.15); break;
    }
  }

  click(): void { this.sfx("click"); }

  honk(id = "honk"): void {
    if (!this.ctx || !this.sfxOn) return;
    switch (id) {
      case "squeak": this.tone(1400, 0.15, "square", 0.25, 1900); break;
      case "airhorn": this.tone(233, 0.5, "sawtooth", 0.3); this.tone(311, 0.5, "sawtooth", 0.3); break;
      case "duck": this.tone(500, 0.12, "square", 0.28, 700); this.tone(450, 0.15, "square", 0.25, 600, 0.12); break;
      case "trumpet": [262, 330, 392].forEach((f, i) => this.tone(f, 0.25, "sawtooth", 0.2, undefined, i * 0.09)); break;
      case "kazoo": this.tone(220, 0.6, "sawtooth", 0.25, 190); this.noise(0.6, 0.12, 800); break;
      default: this.tone(392, 0.25, "square", 0.3); this.tone(523, 0.25, "square", 0.25, undefined, 0.05); break;
    }
  }

  // ------------------------------------------------------------------
  // Engine hum (continuous, driven by the game loop)
  // ------------------------------------------------------------------

  setEngine(rpm: number | null): void {
    if (!this.ctx || !this.sfxOn) { this.stopEngine(); return; }
    try {
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = "sawtooth";
        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = "lowpass";
        this.engineFilter.frequency.value = 500;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        this.engineOsc.connect(this.engineFilter).connect(this.engineGain).connect(this.sfxBus ?? this.master!);
        this.engineOsc.start();
      }
      const osc = this.engineOsc, filter = this.engineFilter, gain = this.engineGain;
      if (!osc || !filter || !gain) return;
      if (rpm === null) {
        gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        return;
      }
      const f = 55 + rpm * 160;
      osc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.06);
      filter.frequency.setTargetAtTime(300 + rpm * 1400, this.ctx.currentTime, 0.08);
      gain.gain.setTargetAtTime(0.05 + rpm * 0.06, this.ctx.currentTime, 0.08);
    } catch { /* ignore */ }
  }

  private stopEngine(): void {
    if (this.ctx && this.engineGain) this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
  }

  // ------------------------------------------------------------------
  // Music sequencer (lookahead scheduler, chiptune)
  // ------------------------------------------------------------------

  startMusic(mode: MusicMode): void {
    if (mode === this.musicMode && this.seqTimer) return;
    this.stopMusic();
    this.musicMode = mode;
    if (mode === "off" || !this.ctx) return;
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.06;
    this.seqTimer = setInterval(() => this.schedule(), 90);
  }

  stopMusic(): void {
    this.musicMode = "off";
    if (this.seqTimer) { clearInterval(this.seqTimer); this.seqTimer = null; }
    this.setEngine(null);
  }

  private schedule(): void {
    if (!this.ctx || !this.musicBus || this.musicMode === "off") return;
    const stepDur = this.musicMode === "race" ? 0.16 : 0.24;
    while (this.nextNoteTime < this.ctx.currentTime + 0.25) {
      this.playStep(this.step, this.nextNoteTime, stepDur);
      this.nextNoteTime += stepDur;
      this.step++;
    }
  }

  private note(freq: number, t: number, dur: number, type: OscillatorType, peak: number, bus: GainNode): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    this.env(g, t, peak, dur);
    osc.connect(g).connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private playStep(step: number, t: number, dur: number): void {
    if (!this.ctx || !this.musicBus) return;
    if (!this.musicOn) return;
    const race = this.musicMode === "race";
    // chord loop (Am F C G vibes) — midi numbers
    const chords: number[][] = race
      ? [[45, 57, 60], [41, 53, 57], [48, 60, 64], [43, 55, 59]]
      : [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]];
    const bar = Math.floor(step / (race ? 8 : 4)) % chords.length;
    const chord = chords[bar];
    const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    if (step % (race ? 8 : 4) === 0) {
      chord.forEach((m) => this.note(mtof(m - 12), t, dur * 3.4, "triangle", race ? 0.16 : 0.12, this.musicBus!));
    }
    // bass
    if (step % 2 === 0) this.note(mtof(chord[0] - 24), t, dur * 0.9, "square", race ? 0.1 : 0.07, this.musicBus!);
    // lead arpeggio
    const arp = [0, 1, 2, 1];
    const lead = chord[arp[step % 4] % chord.length] + 12;
    if (race || step % 2 === 0) this.note(mtof(lead), t, dur * 0.85, "square", race ? 0.07 : 0.05, this.musicBus!);
    // hats / noise tick
    if (race && step % 2 === 1) {
      const len = Math.floor(this.ctx.sampleRate * 0.03);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = "highpass"; f.frequency.value = 6000;
      const g = this.ctx.createGain();
      this.env(g, t, 0.05, 0.03);
      src.connect(f).connect(g).connect(this.musicBus);
      src.start(t);
    }
  }
}

export const AudioMan = new AudioManClass();
