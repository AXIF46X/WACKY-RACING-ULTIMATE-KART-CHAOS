// ============================================================================
// WACKY RACING — 100% procedural cartoon audio (WebAudio, zero assets)
// ============================================================================

type OscKind = OscillatorType;

class AudioManClass {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  sfxGain: GainNode | null = null;
  musicGain: GainNode | null = null;
  engineOsc: OscillatorNode | null = null;
  engineOsc2: OscillatorNode | null = null;
  engineGain: GainNode | null = null;
  driftSrc: AudioBufferSourceNode | null = null;
  driftGain: GainNode | null = null;
  boostSrc: AudioBufferSourceNode | null = null;
  boostGain: GainNode | null = null;
  musicTimer: ReturnType<typeof setInterval> | null = null;
  musicMode: "none" | "menu" | "race" | "podium" = "none";
  musicStep = 0;
  nextNoteTime = 0;
  voicePitch = 1.0;
  musicOn = true;
  sfxOn = true;

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.35;
      this.musicGain.connect(this.master);
    } catch {
      return false;
    }
    return true;
  }

  setMusicOn(on: boolean) {
    this.musicOn = on;
    if (this.musicGain && this.ctx) this.musicGain.gain.setTargetAtTime(on ? 0.35 : 0, this.ctx.currentTime, 0.1);
  }
  setSfxOn(on: boolean) {
    this.sfxOn = on;
    if (this.sfxGain && this.ctx) this.sfxGain.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05);
  }
  setMusicVol(v: number) {
    if (this.musicGain && this.ctx) this.musicGain.gain.setTargetAtTime(this.musicOn ? v * 0.35 : 0, this.ctx.currentTime, 0.1);
  }
  setSfxVol(v: number) {
    if (this.sfxGain && this.ctx) this.sfxGain.gain.setTargetAtTime(this.sfxOn ? v * 0.9 : 0, this.ctx.currentTime, 0.05);
  }

  // --- primitive synth helpers ---------------------------------------------
  private blip(freq: number, dur: number, type: OscKind = "square", vol = 0.25, sweepTo?: number, when = 0) {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, freq * this.voicePitch), t);
    if (sweepTo !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo * this.voicePitch), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, filterFreq = 1200, vol = 0.3, sweepTo?: number, when = 0, q = 1) {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(filterFreq, t);
    if (sweepTo !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(60, sweepTo), t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.sfxGain);
    src.start(t);
  }

  // --- engine loop ----------------------------------------------------------
  startEngine() {
    if (!this.ensure() || !this.ctx || !this.sfxGain || this.engineOsc) return;
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineGain = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 900;
    this.engineOsc.type = "sawtooth";
    this.engineOsc2.type = "square";
    this.engineOsc.frequency.value = 60;
    this.engineOsc2.frequency.value = 31;
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(f);
    this.engineOsc2.connect(f);
    f.connect(this.engineGain).connect(this.sfxGain);
    this.engineOsc.start();
    this.engineOsc2.start();
  }

  setEngine(rpm: number, throttle: number) {
    if (!this.ctx || !this.engineOsc || !this.engineOsc2 || !this.engineGain) return;
    const t = this.ctx.currentTime;
    const base = 55 + rpm * 165;
    this.engineOsc.frequency.setTargetAtTime(base, t, 0.06);
    this.engineOsc2.frequency.setTargetAtTime(base * 0.5, t, 0.06);
    this.engineGain.gain.setTargetAtTime(0.028 + throttle * 0.035 + rpm * 0.02, t, 0.1);
  }

  stopEngine() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    try {
      this.engineGain?.gain.setTargetAtTime(0, t, 0.15);
      const o1 = this.engineOsc, o2 = this.engineOsc2;
      setTimeout(() => { try { o1?.stop(); o2?.stop(); } catch { /*noop*/ } }, 500);
    } catch { /*noop*/ }
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.stopDrift();
    this.stopBoost();
  }

  // --- drift screech --------------------------------------------------------
  startDrift() {
    if (!this.ensure() || !this.ctx || !this.sfxGain || this.driftSrc) return;
    const len = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.driftSrc = this.ctx.createBufferSource();
    this.driftSrc.buffer = buf;
    this.driftSrc.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 2400;
    f.Q.value = 2;
    this.driftGain = this.ctx.createGain();
    this.driftGain.gain.value = 0.0;
    this.driftGain.gain.setTargetAtTime(0.05, this.ctx.currentTime, 0.1);
    this.driftSrc.connect(f).connect(this.driftGain).connect(this.sfxGain);
    this.driftSrc.start();
  }
  stopDrift() {
    if (!this.ctx || !this.driftSrc) return;
    try {
      this.driftGain?.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      const s = this.driftSrc;
      setTimeout(() => { try { s.stop(); } catch { /*noop*/ } }, 300);
    } catch { /*noop*/ }
    this.driftSrc = null;
    this.driftGain = null;
  }

  startBoost() {
    if (!this.ensure() || !this.ctx || !this.sfxGain || this.boostSrc) return;
    const len = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.boostSrc = this.ctx.createBufferSource();
    this.boostSrc.buffer = buf;
    this.boostSrc.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 500;
    this.boostGain = this.ctx.createGain();
    this.boostGain.gain.value = 0;
    this.boostGain.gain.setTargetAtTime(0.14, this.ctx.currentTime, 0.15);
    this.boostSrc.connect(f).connect(this.boostGain).connect(this.sfxGain);
    this.boostSrc.start();
    this.noise(0.5, 300, 0.35, 3000);
  }
  stopBoost() {
    if (!this.ctx || !this.boostSrc) return;
    try {
      this.boostGain?.gain.setTargetAtTime(0, this.ctx.currentTime, 0.12);
      const s = this.boostSrc;
      setTimeout(() => { try { s.stop(); } catch { /*noop*/ } }, 400);
    } catch { /*noop*/ }
    this.boostSrc = null;
    this.boostGain = null;
  }

  // --- one-shot SFX (original cartoon sounds) --------------------------------
  click() { this.ensure(); this.blip(720, 0.06, "square", 0.12, 900); }
  hoverBlip() { if (!this.ctx) return; this.blip(500, 0.04, "sine", 0.05, 620); }
  countBeep(final: boolean) {
    this.ensure();
    if (final) { this.blip(660, 0.5, "square", 0.3); this.blip(880, 0.5, "sawtooth", 0.2, undefined, 0.02); }
    else this.blip(440, 0.18, "square", 0.25);
  }
  go() { this.blip(523, 0.12, "square", 0.25); this.blip(659, 0.12, "square", 0.25, undefined, 0.1); this.blip(784, 0.4, "square", 0.3, undefined, 0.2); }
  pickup() { this.blip(500, 0.05, "square", 0.2, 700); this.blip(800, 0.05, "square", 0.18, 1000, 0.05); }
  rouletteTick() { if (!this.ctx) return; this.blip(950 + Math.random() * 150, 0.03, "square", 0.07); }
  itemGot() { this.blip(392, 0.08, "square", 0.2); this.blip(523, 0.08, "square", 0.2, undefined, 0.08); this.blip(659, 0.15, "square", 0.22, undefined, 0.16); }
  coinChime() { this.blip(1320, 0.07, "sine", 0.16, 1760); this.blip(1760, 0.12, "sine", 0.12, undefined, 0.05); }
  splat() { this.noise(0.18, 700, 0.35, 200, 0, 2); this.blip(500, 0.22, "sine", 0.25, 90); }
  slip() { this.blip(800, 0.35, "sine", 0.3, 150); this.noise(0.2, 1800, 0.15, 500); }
  bump() { this.noise(0.09, 350, 0.3, 120, 0, 1.5); this.blip(140, 0.12, "triangle", 0.3, 60); }
  crash() { this.noise(0.3, 500, 0.4, 100, 0, 1); this.blip(220, 0.3, "sawtooth", 0.25, 50); this.blip(180, 0.25, "square", 0.2, 45, 0.05); }
  boing() { this.blip(180, 0.35, "sine", 0.35, 900); this.blip(120, 0.28, "triangle", 0.2, 500, 0.02); }
  lap() { this.blip(600, 0.1, "square", 0.22); this.blip(800, 0.18, "square", 0.22, undefined, 0.09); }
  wrongway() { this.blip(300, 0.15, "square", 0.2, 240); this.blip(240, 0.2, "square", 0.2, 200, 0.14); }
  cluck() {
    this.ensure();
    for (let i = 0; i < 4; i++) this.blip(700 + Math.random() * 300, 0.06, "square", 0.22, 250, i * 0.075);
    this.blip(400, 0.15, "sawtooth", 0.15, 150, 0.32);
  }
  freezeZap() { this.noise(0.4, 4000, 0.25, 500); this.blip(1200, 0.4, "sine", 0.2, 200); }
  punchSwing() { this.noise(0.12, 900, 0.25, 3000); }
  punchHit() { this.blip(100, 0.25, "square", 0.4, 40); this.noise(0.2, 800, 0.4, 150); }
  shieldOn() { this.blip(400, 0.3, "sine", 0.2, 1200); }
  shieldPop() { this.noise(0.15, 2500, 0.3, 800); this.blip(900, 0.15, "sine", 0.2, 300); }
  teleport() { this.blip(200, 0.4, "sawtooth", 0.25, 1800); this.noise(0.35, 300, 0.2, 5000, 0.05); }
  giantGrow() { this.blip(120, 0.5, "sawtooth", 0.3, 70); this.noise(0.4, 250, 0.25, 80); }
  magnetHum() { this.blip(220, 0.3, "sine", 0.15, 440); }
  reverseZap() { this.blip(800, 0.3, "square", 0.2, 100); this.blip(700, 0.25, "square", 0.15, 120, 0.1); }
  cheer() {
    this.ensure();
    for (let i = 0; i < 6; i++) this.noise(0.5, 800 + Math.random() * 1600, 0.1, undefined, i * 0.07, 3);
    this.blip(523, 0.1, "triangle", 0.15, undefined, 0.1);
    this.blip(659, 0.1, "triangle", 0.15, undefined, 0.22);
    this.blip(784, 0.3, "triangle", 0.18, undefined, 0.34);
  }
  aww() { this.blip(500, 0.4, "sine", 0.18, 240); this.blip(420, 0.4, "sine", 0.14, 200, 0.15); }
  horn(kind: string) {
    this.ensure();
    switch (kind) {
      case "clown": this.blip(320, 0.15, "square", 0.3, 380); this.blip(380, 0.18, "square", 0.3, 320, 0.15); break;
      case "quack": this.blip(500, 0.12, "sawtooth", 0.3, 280); this.blip(520, 0.15, "sawtooth", 0.3, 260, 0.13); break;
      case "fanfare": [523, 659, 784, 1047].forEach((f, i) => this.blip(f, 0.18, "square", 0.2, undefined, i * 0.12)); break;
      default: this.blip(600, 0.09, "square", 0.25, 750); this.blip(750, 0.09, "square", 0.25, 600, 0.09); this.blip(600, 0.15, "square", 0.22, 800, 0.18);
    }
  }
  victoryFanfare() {
    this.ensure();
    const seq = [523, 523, 523, 659, 784, 784, 1047, 0, 784, 1047];
    const times = [0, 0.12, 0.24, 0.36, 0.48, 0.72, 0.96, 1.2, 1.32, 1.5];
    seq.forEach((f, i) => { if (f > 0) this.blip(f, 0.22, "square", 0.22, undefined, times[i]); });
    [261, 329, 392].forEach((f, i) => this.blip(f, 0.4, "triangle", 0.15, undefined, i * 0.02 + 1.7));
  }
  wahWah() {
    this.ensure();
    [392, 370, 349, 233].forEach((f, i) => this.blip(f, i === 3 ? 0.6 : 0.25, "sawtooth", 0.18, f * 0.94, i * 0.28));
  }

  // --- tiny procedural music -------------------------------------------------
  startMusic(mode: "menu" | "race" | "podium") {
    if (!this.ensure() || !this.ctx) return;
    if (this.musicMode === mode && this.musicTimer) return;
    this.stopMusic();
    this.musicMode = mode;
    this.musicStep = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.musicTimer = setInterval(() => this.musicTick(), 90);
  }
  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.musicMode = "none";
  }

  private musicTick() {
    if (!this.ctx || !this.musicGain || !this.musicOn) return;
    const bpm = this.musicMode === "race" ? 138 : this.musicMode === "podium" ? 112 : 96;
    const spb = 60 / bpm / 2; // 8th notes
    while (this.nextNoteTime < this.ctx.currentTime + 0.3) {
      this.scheduleStep(this.musicStep, this.nextNoteTime);
      this.nextNoteTime += spb;
      this.musicStep = (this.musicStep + 1) % 64;
    }
  }

  private playMusicNote(freq: number, dur: number, type: OscKind, vol: number, t: number) {
    if (!this.ctx || !this.musicGain) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.musicGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private scheduleStep(step: number, t: number) {
    if (!this.ctx || !this.musicGain) return;
    const menuBass = [130.8, 130.8, 164.8, 130.8, 196, 196, 164.8, 146.8];
    const raceBass = [146.8, 146.8, 174.6, 146.8, 196, 220, 196, 164.8];
    const menuLead = [523, 0, 659, 0, 784, 659, 0, 523, 0, 659, 880, 0, 784, 0, 659, 0];
    const raceLead = [587, 0, 698, 587, 0, 880, 784, 0, 698, 0, 587, 698, 0, 784, 0, 0];
    const bass = this.musicMode === "race" ? raceBass : menuBass;
    const lead = this.musicMode === "race" ? raceLead : menuLead;
    if (step % 2 === 0) {
      const f = bass[(step / 2) % 8];
      this.playMusicNote(f, 0.16, "triangle", this.musicMode === "race" ? 0.3 : 0.26, t);
    }
    const l = lead[step % 16];
    if (l > 0 && (this.musicMode !== "menu" || step % 2 === 0)) {
      this.playMusicNote(l, 0.14, "square", this.musicMode === "race" ? 0.12 : 0.09, t);
    }
    // hats
    if (this.musicMode === "race" || step % 4 === 2) {
      const len = Math.floor(this.ctx.sampleRate * 0.03);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = 6000;
      const g = this.ctx.createGain();
      g.gain.value = this.musicMode === "race" ? 0.05 : 0.03;
      src.connect(f).connect(g).connect(this.musicGain);
      src.start(t);
    }
  }
}

export const AudioMan = new AudioManClass();
