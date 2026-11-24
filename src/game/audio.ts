// Cinematic Foley & Procedural Gothic-Sci-Fi Music Engine (Zero 8-bit/Retro Beeps)

export type MusicMode = 'none' | 'menu' | 'battle' | 'tension';

const NOTE_FREQ: Record<string, number> = {
  D2: 73.42,
  E2: 82.41,
  F2: 87.31,
  G2: 98.0,
  A2: 110.0,
  Bb2: 116.54,
  B2: 123.47,
  C3: 130.81,
  Cs3: 138.59,
  D3: 146.83,
  E3: 164.81,
  F3: 174.61,
  Fs3: 185.0,
  G3: 196.0,
  A3: 220.0,
  Bb3: 233.08,
  C4: 261.63,
  Cs4: 277.18,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  Fs4: 369.99,
  G4: 392.0,
  A4: 440.0,
  Bb4: 466.16,
  C5: 523.25,
  Cs5: 554.37,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  Fs5: 739.99,
  G5: 783.99,
  A5: 880.0,
};

function makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const samples = 1024;
  const buffer = new ArrayBuffer(samples * 4);
  const curve = new Float32Array(buffer);
  const deg = Math.PI / 180;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

class GameAudio {
  private ctx: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbSend: GainNode | null = null;

  private whiteNoise: AudioBuffer | null = null;
  private pinkNoise: AudioBuffer | null = null;
  private brownNoise: AudioBuffer | null = null;
  private softClipCurve: Float32Array<ArrayBuffer> = makeDistortionCurve(18);
  private hardClipCurve: Float32Array<ArrayBuffer> = makeDistortionCurve(55);

  private muted = false;
  private musicMuted = false;
  private lastShotTime = 0;
  private lastHitTime = 0;

  // Procedural Music Engine State
  private musicMode: MusicMode = 'none';
  private schedulerId: number | null = null;
  private nextStepTime = 0;
  private stepIndex = 0;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      const ctx = new AudioCtx();
      this.ctx = ctx;

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.knee.value = 18;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.14;
      compressor.connect(ctx.destination);

      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = 0.9;
      this.sfxBus.connect(compressor);

      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = this.musicMuted ? 0 : 0.34;
      this.musicBus.connect(compressor);

      // Synthetic stereo Cathedral Reverb impulse (1.45s lush gothic hall)
      this.reverbNode = ctx.createConvolver();
      this.reverbNode.buffer = this.buildCathedralImpulse(ctx, 1.45, 2.8);
      this.reverbSend = ctx.createGain();
      this.reverbSend.gain.value = 0.32;
      this.reverbSend.connect(this.reverbNode);
      this.reverbNode.connect(compressor);

      this.buildNoiseBuffers(ctx);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
    if (this.musicMode !== 'none' && !this.musicMuted && this.schedulerId === null) {
      this.startScheduler();
    }
  }

  private buildNoiseBuffers(ctx: AudioContext): void {
    const len = Math.floor(ctx.sampleRate * 1.5);
    const white = ctx.createBuffer(1, len, ctx.sampleRate);
    const pink = ctx.createBuffer(1, len, ctx.sampleRate);
    const brown = ctx.createBuffer(1, len, ctx.sampleRate);

    const wData = white.getChannelData(0);
    const pData = pink.getChannelData(0);
    const bData = brown.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    let lastOut = 0;
    for (let i = 0; i < len; i++) {
      const n = Math.random() * 2 - 1;
      wData[i] = n;

      // Voss-McCartney pink approximation
      b0 = 0.99886 * b0 + n * 0.0555179;
      b1 = 0.99332 * b1 + n * 0.0750759;
      b2 = 0.96900 * b2 + n * 0.1538520;
      b3 = 0.86650 * b3 + n * 0.3104856;
      b4 = 0.55000 * b4 + n * 0.5329522;
      b5 = -0.7616 * b5 - n * 0.0168980;
      pData[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + b3 + b4 + b5 + b6 + n * 0.5362) * 0.11));
      b6 = n * 0.115926;

      // Brown noise (warm rumble)
      lastOut = (lastOut + 0.028 * n) / 1.028;
      bData[i] = Math.max(-1, Math.min(1, lastOut * 3.1));
    }

    this.whiteNoise = white;
    this.pinkNoise = pink;
    this.brownNoise = brown;
  }

  private buildCathedralImpulse(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * duration);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < length; i++) {
        const t = i / length;
        const env = Math.pow(1 - t, decay);
        const raw = (Math.random() * 2 - 1) * env;
        // Soft low-pass damping so reverb sounds like warm stone, not metallic fizz
        lp = lp * 0.72 + raw * 0.28;
        data[i] = lp * 0.7;
      }
    }
    return impulse;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopScheduler();
      if (this.musicBus && this.ctx) {
        this.musicBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
      }
      if (this.sfxBus && this.ctx) {
        this.sfxBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
      }
    } else {
      const ctx = this.ensureContext();
      if (ctx && this.sfxBus) {
        this.sfxBus.gain.setTargetAtTime(0.9, ctx.currentTime, 0.04);
      }
      if (ctx && this.musicBus) {
        this.musicBus.gain.setTargetAtTime(this.musicMuted ? 0 : 0.34, ctx.currentTime, 0.08);
      }
      if (this.musicMode !== 'none' && !this.musicMuted) {
        this.startScheduler();
      }
    }
    return this.muted;
  }

  public isMusicMuted(): boolean {
    return this.musicMuted;
  }

  public toggleMusicMute(): boolean {
    this.musicMuted = !this.musicMuted;
    if (this.musicMuted) {
      this.stopScheduler();
      if (this.musicBus && this.ctx) {
        this.musicBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.06);
      }
    } else if (!this.muted) {
      const ctx = this.ensureContext();
      if (ctx && this.musicBus) {
        this.musicBus.gain.setTargetAtTime(0.34, ctx.currentTime, 0.08);
      }
      if (this.musicMode !== 'none') {
        this.startScheduler();
      }
    }
    return this.musicMuted;
  }

  // === MODERN FOLEY SYNTHESIS PRIMITIVES ===

  private playFilteredNoise(
    color: 'white' | 'pink' | 'brown',
    duration: number,
    volume: number,
    filterType: BiquadFilterType,
    freqStart: number,
    freqEnd?: number,
    q = 1.2,
    delay = 0,
    attack = 0.004,
    reverbAmt = 0
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const buf =
      color === 'white' ? this.whiteNoise : color === 'pink' ? this.pinkNoise : this.brownNoise;
    if (!buf) return;

    const start = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    // Randomize buffer offset so consecutive impacts never sound phase-identical
    const maxOffset = Math.max(0.01, buf.duration - duration - 0.05);
    const offset = Math.random() * maxOffset;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(Math.max(30, freqStart), start);
    if (freqEnd !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), start + duration);
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + Math.min(attack, duration * 0.4));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);

    if (reverbAmt > 0 && this.reverbSend) {
      const wet = ctx.createGain();
      wet.gain.value = reverbAmt;
      gain.connect(wet);
      wet.connect(this.reverbSend);
    }

    src.start(start, offset, duration + 0.02);
    src.stop(start + duration + 0.03);
  }

  private playSubPunch(
    startFreq: number,
    endFreq: number,
    duration: number,
    volume: number,
    delay = 0,
    saturate = false
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const start = ctx.currentTime + delay;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    if (saturate) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = this.softClipCurve;
      osc.connect(shaper);
      shaper.connect(gain);
    } else {
      osc.connect(gain);
    }
    gain.connect(this.sfxBus);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private playFMVoice(
    carrierFreq: number,
    carrierEndFreq: number,
    modFreq: number,
    modIndex: number,
    duration: number,
    volume: number,
    delay = 0,
    filterCut = 4200,
    reverbAmt = 0.08,
    drive: 'none' | 'soft' | 'hard' = 'none'
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const start = ctx.currentTime + delay;

    const carrier = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(Math.max(25, carrierFreq), start);
    if (carrierEndFreq !== carrierFreq) {
      carrier.frequency.exponentialRampToValueAtTime(Math.max(25, carrierEndFreq), start + duration);
    }

    mod.type = 'sine';
    mod.frequency.setValueAtTime(Math.max(15, modFreq), start);
    modGain.gain.setValueAtTime(modIndex, start);
    modGain.gain.exponentialRampToValueAtTime(Math.max(1, modIndex * 0.15), start + duration);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterCut, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(180, filterCut * 0.35), start + duration);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    mod.connect(modGain);
    modGain.connect(carrier.frequency);

    if (drive !== 'none') {
      const shaper = ctx.createWaveShaper();
      shaper.curve = drive === 'hard' ? this.hardClipCurve : this.softClipCurve;
      carrier.connect(shaper);
      shaper.connect(filter);
    } else {
      carrier.connect(filter);
    }
    filter.connect(gain);
    gain.connect(this.sfxBus);

    if (reverbAmt > 0 && this.reverbSend) {
      const wet = ctx.createGain();
      wet.gain.value = reverbAmt;
      gain.connect(wet);
      wet.connect(this.reverbSend);
    }

    mod.start(start);
    carrier.start(start);
    mod.stop(start + duration + 0.03);
    carrier.stop(start + duration + 0.03);
  }

  private playFilteredSynth(
    freqs: number[],
    type: OscillatorType,
    duration: number,
    volume: number,
    filterStart: number,
    filterEnd: number,
    delay = 0,
    attack = 0.012,
    reverbAmt = 0.15,
    dest?: GainNode
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const start = ctx.currentTime + delay;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 1.6;
    filter.frequency.setValueAtTime(Math.max(80, filterStart), start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, filterEnd), start + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + Math.min(attack, duration * 0.45));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    for (const f of freqs) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(f, start);
      osc.connect(filter);
      osc.start(start);
      osc.stop(start + duration + 0.04);
    }

    filter.connect(gain);
    gain.connect(dest ?? this.sfxBus);

    if (reverbAmt > 0 && this.reverbSend) {
      const wet = ctx.createGain();
      wet.gain.value = reverbAmt;
      gain.connect(wet);
      wet.connect(this.reverbSend);
    }
  }

  // === MOVEMENT, PICKUPS & PROGRESSION (ZERO MARIO CHIRPS) ===

  public jump(isDouble = false): void {
    if (isDouble) {
      // Sleek pneumatic air-dash / arcane thruster puff
      this.playFilteredNoise('pink', 0.13, 0.16, 'bandpass', 1800, 620, 1.4, 0, 0.006, 0.1);
      this.playSubPunch(125, 48, 0.075, 0.14, 0, false);
      this.playFMVoice(520, 410, 1040, 140, 0.09, 0.04, 0.01, 2200, 0.14);
    } else {
      // Grounded boot kick + cloth rush (organic foley, NO upward sine boing!)
      this.playSubPunch(102, 42, 0.065, 0.18, 0, false);
      this.playFilteredNoise('pink', 0.09, 0.14, 'bandpass', 540, 1180, 1.1, 0, 0.005);
    }
  }

  public jumpPad(): void {
    // Gravity-catapult pneumatic release + arcane resonance
    this.playSubPunch(135, 36, 0.24, 0.28, 0, true);
    this.playFilteredNoise('pink', 0.28, 0.22, 'bandpass', 320, 2600, 1.8, 0, 0.01, 0.2);
    this.playFMVoice(220, 440, 330, 220, 0.26, 0.09, 0.02, 2600, 0.22);
  }

  public dropPodSlam(): void {
    // Seismic drop-pod crater impact + metallic hull ring + stone debris
    this.playSubPunch(118, 24, 0.42, 0.42, 0, true);
    this.playFilteredNoise('brown', 0.36, 0.34, 'lowpass', 920, 140, 0.8, 0, 0.003, 0.18);
    this.playFilteredNoise('white', 0.18, 0.18, 'bandpass', 2200, 700, 1.5, 0.01, 0.003, 0.14);
    this.playFMVoice(185, 130, 492, 380, 0.26, 0.12, 0, 2400, 0.22, 'soft');
  }

  public solarPickup(): void {
    // Crystalline cathedral relic chime (inharmonic glass partials + airy sparkle, NOT a Mario coin!)
    const j = (Math.random() - 0.5) * 40;
    this.playFMVoice(1046 + j, 1046 + j, 2886, 420, 0.22, 0.085, 0, 5200, 0.28);
    this.playFMVoice(1568 + j, 1568 + j, 3760, 260, 0.28, 0.065, 0.035, 5800, 0.32);
    this.playFilteredNoise('white', 0.08, 0.04, 'highpass', 5500, 8200, 1.0, 0, 0.005, 0.18);
  }

  public upgradeBuy(isAscension = false): void {
    // Gothic reliquary anvil forge strike + warm organ chord
    this.playFMVoice(340, 328, 938, 620, 0.34, 0.14, 0, 4600, 0.26, 'soft');
    this.playFilteredNoise('white', 0.11, 0.12, 'bandpass', 3400, 1800, 2.0, 0, 0.002, 0.15);
    this.playFilteredSynth(
      [NOTE_FREQ.D3, NOTE_FREQ.A3, NOTE_FREQ.D4],
      'sawtooth',
      0.38,
      0.11,
      1900,
      580,
      0.04,
      0.012,
      0.28
    );
    if (isAscension) {
      this.playFilteredSynth(
        [NOTE_FREQ.Fs4, NOTE_FREQ.A4, NOTE_FREQ.D5],
        'sawtooth',
        0.72,
        0.13,
        3400,
        900,
        0.11,
        0.02,
        0.42
      );
      this.playSubPunch(92, 38, 0.32, 0.24, 0.05, true);
    }
  }

  public recallStart(): void {
    // Resonant cathedral teleport choir hum
    this.playFilteredSynth(
      [NOTE_FREQ.D3, NOTE_FREQ.A3, NOTE_FREQ.E4, NOTE_FREQ.A4],
      'sawtooth',
      0.65,
      0.09,
      620,
      2400,
      0,
      0.12,
      0.4
    );
    this.playFilteredNoise('pink', 0.45, 0.08, 'bandpass', 900, 2600, 2.5, 0, 0.08, 0.28);
  }

  // === WEAPONS & PRIMARY ATTACKS (DISTANCE-ATTENUATED FOLEY) ===

  private canPlayShot(minGap = 45): boolean {
    const now = performance.now();
    if (now - this.lastShotTime < minGap) return false;
    this.lastShotTime = now;
    return true;
  }

  public shootCleaver(vol = 1): void {
    if (!this.canPlayShot(50)) return;
    // Heavy butcher cleaver air-cleave + gritty steel whoosh
    this.playFilteredNoise('pink', 0.16, 0.24 * vol, 'bandpass', 1200, 340, 1.4, 0, 0.004, 0.1);
    this.playSubPunch(120, 40, 0.12, 0.22 * vol, 0, true);
    this.playFMVoice(260, 120, 680, 420, 0.14, 0.1 * vol, 0, 3200, 0.1, 'soft');
  }

  public shootRadiant(vol = 1): void {
    if (!this.canPlayShot(45)) return;
    // Hard-light seraph glaive pulse: bright crystalline snap + airy jet shimmer
    this.playFilteredNoise('white', 0.09, 0.15 * vol, 'bandpass', 3600, 1400, 2.0, 0, 0.002, 0.14);
    this.playFMVoice(680, 420, 1360, 360, 0.12, 0.1 * vol, 0, 4400, 0.2);
    this.playSubPunch(155, 62, 0.07, 0.13 * vol, 0, false);
  }

  public shootRevolver(vol = 1): void {
    if (!this.canPlayShot(45)) return;
    // Snappy rail-crossbow bolt crack: mechanical latch + bowstring twang + punch
    this.playSubPunch(170, 52, 0.07, 0.2 * vol, 0, true);
    this.playFilteredNoise('white', 0.065, 0.2 * vol, 'bandpass', 2800, 900, 1.4, 0, 0.002);
    this.playFMVoice(440, 210, 1320, 520, 0.085, 0.11 * vol, 0, 3600, 0.08, 'soft');
  }

  public shootSonic(vol = 1): void {
    if (!this.canPlayShot(50)) return;
    // Eldritch void claw rend: dark resonant whoosh + bass slice
    this.playSubPunch(145, 58, 0.11, 0.18 * vol, 0, false);
    this.playFMVoice(310, 220, 465, 340, 0.13, 0.1 * vol, 0, 2200, 0.2);
    this.playFilteredNoise('pink', 0.1, 0.14 * vol, 'bandpass', 1500, 520, 2.0, 0, 0.004, 0.14);
  }

  public shootPlasmaDagger(vol = 1): void {
    if (!this.canPlayShot(42)) return;
    // Razor plasma wrist-blade whip: high-velocity steel hiss + plasma snap
    this.playFilteredNoise('white', 0.09, 0.18 * vol, 'bandpass', 3800, 1100, 1.8, 0, 0.002, 0.12);
    this.playFMVoice(560, 250, 1420, 480, 0.095, 0.1 * vol, 0, 4600, 0.12, 'soft');
  }

  public shootMortar(vol = 1): void {
    if (!this.canPlayShot(70)) return;
    // Heavy sanctum mortar cannon thoomp + brass shell resonance
    this.playSubPunch(135, 34, 0.22, 0.34 * vol, 0, true);
    this.playFilteredNoise('brown', 0.2, 0.26 * vol, 'lowpass', 1100, 220, 0.9, 0, 0.003, 0.14);
    this.playFMVoice(240, 115, 380, 420, 0.16, 0.12 * vol, 0, 1900, 0.14, 'hard');
  }

  public shootSoulRail(vol = 1): void {
    if (!this.canPlayShot(45)) return;
    // Tethered soul-rail crystal discharge: resonant harmonic rail crack
    this.playFMVoice(520, 440, 1040, 320, 0.13, 0.095 * vol, 0, 3800, 0.24);
    this.playFilteredNoise('pink', 0.1, 0.11 * vol, 'bandpass', 2400, 1200, 2.4, 0, 0.004, 0.18);
    this.playSubPunch(140, 58, 0.08, 0.13 * vol, 0, false);
  }

  public shootVenom(vol = 1): void {
    if (!this.canPlayShot(45)) return;
    // Pressurized alchemical needle hiss + caustic snap
    this.playFilteredNoise('white', 0.08, 0.16 * vol, 'bandpass', 3600, 1400, 2.4, 0, 0.002, 0.08);
    this.playFMVoice(520, 240, 1180, 380, 0.09, 0.085 * vol, 0, 3200, 0.1);
  }

  public shootPrism(vol = 1): void {
    if (!this.canPlayShot(45)) return;
    // Focused solar-prism lance crack + harmonic glass resonance
    this.playFilteredNoise('white', 0.075, 0.15 * vol, 'bandpass', 4200, 1800, 2.2, 0, 0.002, 0.14);
    this.playFMVoice(740, 480, 1480, 420, 0.12, 0.095 * vol, 0, 4800, 0.2);
    this.playSubPunch(150, 60, 0.06, 0.12 * vol, 0, false);
  }

  public shootBioBeam(vol = 1): void {
    if (!this.canPlayShot(45)) return;
    // Occult skull-staff tether hum (crystalline resonant shimmer, NOT a Mario chirp)
    this.playFMVoice(490, 540, 740, 190, 0.12, 0.08 * vol, 0, 3200, 0.22);
    this.playFilteredNoise('pink', 0.1, 0.08 * vol, 'bandpass', 2200, 3000, 2.8, 0, 0.01, 0.18);
  }

  // === CHAMPION ABILITIES ===

  public hookLaunch(vol = 1): void {
    // Heavy iron chain whip + metallic rattle
    this.playFilteredNoise('white', 0.18, 0.18 * vol, 'bandpass', 2400, 1100, 1.8, 0, 0.004, 0.12);
    this.playFMVoice(410, 260, 1180, 720, 0.14, 0.12 * vol, 0, 4200, 0.12, 'soft');
    this.playFMVoice(340, 210, 960, 580, 0.12, 0.1 * vol, 0.07, 3600, 0.12, 'soft');
  }

  public hookLatch(vol = 1): void {
    // Visceral iron meat-hook clamp + bass crunch
    this.playSubPunch(125, 38, 0.15, 0.3 * vol, 0, true);
    this.playFMVoice(560, 280, 1480, 950, 0.18, 0.18 * vol, 0, 4800, 0.18, 'hard');
    this.playFilteredNoise('white', 0.09, 0.2 * vol, 'bandpass', 3200, 1200, 1.5, 0, 0.002);
  }

  public blightRot(vol = 1): void {
    // Pressurized steam furnace vent + toxic cloud hiss
    this.playFilteredNoise('brown', 0.34, 0.24 * vol, 'bandpass', 720, 260, 1.5, 0, 0.012, 0.18);
    this.playSubPunch(96, 36, 0.22, 0.22 * vol, 0, true);
  }

  public aegisPulse(vol = 1): void {
    // Radiant cathedral shield chime + protective golden wave
    this.playFilteredSynth(
      [NOTE_FREQ.D3, NOTE_FREQ.A3, NOTE_FREQ.D4, NOTE_FREQ.Fs4],
      'sawtooth',
      0.42,
      0.11 * vol,
      2400,
      760,
      0,
      0.015,
      0.34
    );
    this.playFMVoice(880, 880, 2240, 320, 0.32, 0.09 * vol, 0, 4800, 0.3);
  }

  public vortexPull(vol = 1): void {
    // Deep gravity-well warp collapse
    this.playSubPunch(72, 26, 0.45, 0.34 * vol, 0, true);
    this.playFilteredSynth([98, 147, 196], 'sawtooth', 0.42, 0.11 * vol, 1800, 220, 0, 0.02, 0.34);
    this.playFilteredNoise('pink', 0.38, 0.16 * vol, 'bandpass', 1400, 240, 2.6, 0, 0.015, 0.24);
  }

  public cloakVanish(vol = 1): void {
    // Spectral whisper vanish
    this.playFilteredNoise('pink', 0.28, 0.18 * vol, 'bandpass', 2800, 420, 2.4, 0, 0.012, 0.28);
    this.playFMVoice(680, 240, 1020, 220, 0.24, 0.08 * vol, 0, 2800, 0.28);
  }

  public orbitalCharge(vol = 1): void {
    // Rising orbital soul-spire resonance beam
    this.playFilteredSynth([146.8, 220, 293.6], 'sawtooth', 0.52, 0.12 * vol, 420, 2800, 0, 0.04, 0.34);
    this.playFilteredNoise('pink', 0.44, 0.16 * vol, 'bandpass', 640, 2600, 2.2, 0, 0.04, 0.24);
  }

  public droneSpawn(vol = 1): void {
    // Spectral skull summon rattle + harmonic hum
    this.playFMVoice(440, 620, 880, 280, 0.22, 0.09 * vol, 0, 3600, 0.24);
    this.playFilteredNoise('pink', 0.16, 0.12 * vol, 'bandpass', 1600, 2800, 2.0, 0, 0.008, 0.2);
  }

  public throwDynamite(vol = 1): void {
    // Arcing fuse toss whoosh + burning spark sizzle
    this.playFilteredNoise('pink', 0.14, 0.16 * vol, 'bandpass', 1200, 2400, 1.6, 0, 0.005);
    this.playFilteredNoise('white', 0.18, 0.09 * vol, 'highpass', 4800, 6200, 1.2, 0.04, 0.01);
  }

  public bullCharge(vol = 1): void {
    // Radiant seraph ram war-horn + rushing wings
    this.playFilteredSynth(
      [NOTE_FREQ.D3, NOTE_FREQ.A3, NOTE_FREQ.D4],
      'sawtooth',
      0.34,
      0.13 * vol,
      900,
      2600,
      0,
      0.025,
      0.28
    );
    this.playFilteredNoise('pink', 0.3, 0.18 * vol, 'bandpass', 800, 2200, 1.5, 0, 0.02, 0.16);
    this.playSubPunch(105, 42, 0.22, 0.24 * vol, 0, true);
  }

  public hydroDash(vol = 1): void {
    // High-velocity shadow lunge whoosh + sub snap
    this.playSubPunch(130, 44, 0.14, 0.22 * vol, 0, true);
    this.playFilteredNoise('pink', 0.22, 0.22 * vol, 'bandpass', 2600, 520, 1.6, 0, 0.004, 0.16);
  }

  public whirlpool(vol = 1): void {
    // Spinning eldritch maelstrom vortex roar
    this.playFilteredNoise('brown', 0.42, 0.24 * vol, 'bandpass', 480, 1450, 2.0, 0, 0.02, 0.26);
    this.playFMVoice(185, 290, 370, 380, 0.38, 0.11 * vol, 0, 2400, 0.24, 'soft');
  }

  public bite(vol = 1): void {
    // Heavy sanctum jaw/hammer crush impact
    this.playSubPunch(115, 32, 0.18, 0.32 * vol, 0, true);
    this.playFMVoice(320, 130, 890, 640, 0.16, 0.14 * vol, 0, 3200, 0.14, 'hard');
    this.playFilteredNoise('white', 0.1, 0.18 * vol, 'bandpass', 2200, 650, 1.3, 0, 0.002);
  }

  public meltdownCharge(vol = 1): void {
    // Rising furnace turbine pressure swell
    this.playFilteredSynth([110, 165, 220], 'sawtooth', 0.48, 0.13 * vol, 260, 2400, 0, 0.05, 0.22);
    this.playFilteredNoise('brown', 0.46, 0.18 * vol, 'bandpass', 280, 1400, 1.8, 0, 0.05, 0.16);
  }

  public totemDeploy(vol = 1): void {
    // Warm cathedral organ blessing + stone totem thud
    this.playSubPunch(98, 38, 0.16, 0.22 * vol, 0, false);
    this.playFilteredSynth(
      [NOTE_FREQ.D3, NOTE_FREQ.F3, NOTE_FREQ.A3, NOTE_FREQ.D4],
      'sawtooth',
      0.52,
      0.095 * vol,
      1400,
      620,
      0.02,
      0.04,
      0.38
    );
    this.playFMVoice(880, 880, 2240, 280, 0.34, 0.075 * vol, 0.04, 4600, 0.32);
  }

  public plagueCloud(vol = 1): void {
    // Swinging brass censer + shattering toxin vial + caustic cloud hiss
    this.playFMVoice(380, 195, 990, 560, 0.2, 0.12 * vol, 0, 3600, 0.22, 'soft');
    this.playFilteredNoise('pink', 0.26, 0.2 * vol, 'bandpass', 1600, 480, 1.5, 0.03, 0.008, 0.2);
    this.playSubPunch(105, 42, 0.16, 0.2 * vol, 0.02, false);
  }

  public contagionBurst(vol = 1): void {
    // Caustic plague rupture detonation + crackling acid sizzle
    this.playSubPunch(102, 30, 0.3, 0.32 * vol, 0, true);
    this.playFilteredNoise('white', 0.32, 0.24 * vol, 'bandpass', 2400, 620, 1.4, 0, 0.004, 0.24);
    this.playFMVoice(260, 110, 610, 520, 0.28, 0.14 * vol, 0, 2600, 0.24, 'hard');
  }

  public solarFlare(vol = 1): void {
    // Spinning golden solar chakram launch + bright brass chime
    this.playFilteredNoise('pink', 0.24, 0.18 * vol, 'bandpass', 2200, 920, 2.8, 0, 0.006, 0.2);
    this.playFMVoice(620, 410, 1550, 480, 0.22, 0.11 * vol, 0, 4400, 0.24);
    this.playSubPunch(130, 54, 0.12, 0.18 * vol, 0, false);
  }

  public chronoBlink(vol = 1): void {
    // Time-warp clockwork chime + forward warp whoosh
    this.playFilteredNoise('pink', 0.26, 0.18 * vol, 'bandpass', 620, 3200, 2.2, 0, 0.01, 0.24);
    this.playFMVoice(587, 880, 1174, 340, 0.24, 0.1 * vol, 0, 4800, 0.28);
    this.playFMVoice(880, 1174, 1760, 280, 0.28, 0.085 * vol, 0.06, 5400, 0.32);
  }

  public explosion(heavy = false, vol = 1): void {
    // Cinematic concussive blast: sub crater + crackling debris + fiery roar
    const dur = heavy ? 0.52 : 0.32;
    this.playSubPunch(heavy ? 116 : 108, heavy ? 20 : 28, dur, (heavy ? 0.46 : 0.32) * vol, 0, true);
    this.playFilteredNoise('brown', dur, (heavy ? 0.38 : 0.26) * vol, 'lowpass', heavy ? 1600 : 1200, 130, 0.75, 0, 0.003, 0.24);
    this.playFilteredNoise('white', dur * 0.55, (heavy ? 0.22 : 0.15) * vol, 'bandpass', 2600, 520, 1.2, 0.01, 0.003, 0.18);
    if (heavy) {
      this.playFMVoice(220, 68, 590, 820, 0.4, 0.16 * vol, 0, 3200, 0.28, 'hard');
    }
  }

  public hitConfirm(heavy = false): void {
    const now = performance.now();
    if (now - this.lastHitTime < 34) return;
    this.lastHitTime = now;
    // Tactile armor/flesh impact punch (zero bleep!)
    this.playSubPunch(heavy ? 118 : 138, 38, heavy ? 0.12 : 0.075, heavy ? 0.28 : 0.16, 0, true);
    this.playFilteredNoise('pink', heavy ? 0.11 : 0.065, heavy ? 0.22 : 0.14, 'bandpass', heavy ? 1400 : 1900, 480, 1.2, 0, 0.002);
  }

  // === OBJECTIVES & ANNOUNCEMENTS ===

  public killBanner(): void {
    // Dramatic war-drum strike + dark Gothic brass fifth stab
    this.playSubPunch(96, 30, 0.28, 0.34, 0, true);
    this.playFilteredSynth(
      [NOTE_FREQ.D3, NOTE_FREQ.A3, NOTE_FREQ.D4],
      'sawtooth',
      0.42,
      0.13,
      2600,
      720,
      0.01,
      0.01,
      0.34
    );
    this.playFMVoice(587, 587, 1480, 380, 0.38, 0.08, 0.04, 4600, 0.32);
  }

  public turretDown(): void {
    // Collapsing stone reliquary tower + cathedral bell toll
    this.playSubPunch(94, 20, 0.56, 0.44, 0, true);
    this.playFilteredNoise('brown', 0.54, 0.38, 'lowpass', 1200, 120, 0.7, 0, 0.004, 0.28);
    this.playFMVoice(293.66, 289, 810, 620, 0.75, 0.14, 0.05, 3400, 0.42, 'soft');
  }

  public towerShot(): void {
    // Distant sanctum laser bolt crack
    this.playSubPunch(120, 44, 0.11, 0.14, 0, false);
    this.playFMVoice(390, 180, 780, 320, 0.12, 0.085, 0, 2600, 0.14);
  }

  public creepKill(): void {
    // Shattering spirit wisp chime
    this.playFilteredNoise('white', 0.14, 0.1, 'bandpass', 3200, 1200, 2.0, 0, 0.004, 0.22);
    this.playFMVoice(784, 587, 1920, 340, 0.2, 0.075, 0, 4200, 0.26);
  }

  // === CINEMATIC VICTORY FANFARE & DEFEAT REQUIEM ===

  public victory(): void {
    this.playVictoryFanfare();
  }

  public defeat(): void {
    this.playDefeatRequiem();
  }

  public playVictoryFanfare(): void {
    // Stop battle soundtrack so the Victory Fanfare owns the entire soundstage
    this.setMusicMode('none');
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;

    // 1. Shattering Core shockwave boom + triumphant war-drum roll
    this.playSubPunch(108, 22, 0.65, 0.44, 0, true);
    this.playFilteredNoise('brown', 0.55, 0.34, 'lowpass', 1500, 140, 0.7, 0, 0.004, 0.34);

    // Snare/war-drum pickup roll leading into the brass fanfare
    const rollTimes = [0.22, 0.34, 0.44, 0.52, 0.59, 0.65];
    rollTimes.forEach((t, idx) => {
      this.playSubPunch(92 + idx * 4, 38, 0.12, 0.16 + idx * 0.025, t, true);
      this.playFilteredNoise('pink', 0.09, 0.11 + idx * 0.015, 'bandpass', 1400, 540, 1.2, t, 0.003, 0.16);
    });

    // 2. Majestic Gothic Brass & Pipe Organ Fanfare in D Major (0.72s -> 3.4s)
    // Melody: D4 -> A4 -> F#4 -> A4 -> D5 (held radiant resolution!)
    const fanfareCalls: Array<{ delay: number; dur: number; notes: number[]; cut: number }> = [
      { delay: 0.72, dur: 0.34, notes: [NOTE_FREQ.D3, NOTE_FREQ.A3, NOTE_FREQ.D4], cut: 2400 },
      { delay: 1.06, dur: 0.3, notes: [NOTE_FREQ.A3, NOTE_FREQ.E4, NOTE_FREQ.A4], cut: 2800 },
      { delay: 1.36, dur: 0.32, notes: [NOTE_FREQ.Fs3, NOTE_FREQ.D4, NOTE_FREQ.Fs4], cut: 2600 },
      { delay: 1.68, dur: 0.34, notes: [NOTE_FREQ.A3, NOTE_FREQ.E4, NOTE_FREQ.A4], cut: 3100 },
      // Grand Final D Major Cathedral Chord (D2 + D3 + A3 + D4 + F#4 + A4 + D5)
      {
        delay: 2.04,
        dur: 2.15,
        notes: [
          NOTE_FREQ.D2,
          NOTE_FREQ.D3,
          NOTE_FREQ.A3,
          NOTE_FREQ.D4,
          NOTE_FREQ.Fs4,
          NOTE_FREQ.A4,
          NOTE_FREQ.D5,
        ],
        cut: 3800,
      },
    ];

    for (const call of fanfareCalls) {
      // Rich detuned orchestral brass layer
      this.playFilteredSynth(call.notes, 'sawtooth', call.dur, 0.125, call.cut, call.cut * 0.38, call.delay, 0.028, 0.45);
      // Slight chorus detune for huge cathedral ensemble width
      this.playFilteredSynth(
        call.notes.map((f) => f * 1.0045),
        'sawtooth',
        call.dur,
        0.085,
        call.cut * 0.85,
        call.cut * 0.32,
        call.delay + 0.01,
        0.04,
        0.48
      );
    }

    // 3. Celebratory Cathedral Bell Chimes & Cymbal Wash on the final chord (2.04s)
    this.playSubPunch(84, 28, 0.55, 0.34, 2.04, true);
    this.playFMVoice(NOTE_FREQ.D5, NOTE_FREQ.D5, NOTE_FREQ.D5 * 2.756, 480, 1.65, 0.11, 2.04, 5200, 0.52);
    this.playFMVoice(NOTE_FREQ.A5, NOTE_FREQ.A5, NOTE_FREQ.A5 * 2.756, 360, 1.4, 0.075, 2.22, 5800, 0.55);
    this.playFilteredNoise('white', 1.35, 0.14, 'highpass', 3800, 6200, 0.8, 2.04, 0.03, 0.42);
  }

  public playDefeatRequiem(): void {
    // Stop battle soundtrack so the solemn Defeat Requiem owns the moment
    this.setMusicMode('none');
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;

    // 1. Core collapse seismic quake
    this.playSubPunch(92, 18, 0.82, 0.44, 0, true);
    this.playFilteredNoise('brown', 0.78, 0.36, 'lowpass', 980, 95, 0.7, 0, 0.005, 0.36);

    // 2. Heavy Bronze Cathedral Funeral Bell Tolls (inharmonic FM bell partials)
    this.playFMVoice(NOTE_FREQ.D3, NOTE_FREQ.D3 * 0.992, NOTE_FREQ.D3 * 2.76, 620, 1.9, 0.16, 0.35, 2600, 0.55);
    this.playFMVoice(NOTE_FREQ.A2, NOTE_FREQ.A2 * 0.99, NOTE_FREQ.A2 * 2.76, 520, 2.1, 0.15, 1.65, 2100, 0.58);

    // 3. Solemn Descending Minor Pipe-Organ & Dark Brass Dirge (Dm -> C -> Bb -> Dm)
    const dirgeChords: Array<{ delay: number; dur: number; notes: number[] }> = [
      { delay: 0.45, dur: 0.78, notes: [NOTE_FREQ.D2, NOTE_FREQ.D3, NOTE_FREQ.F3, NOTE_FREQ.A3, NOTE_FREQ.D4] },
      { delay: 1.18, dur: 0.74, notes: [NOTE_FREQ.C3, NOTE_FREQ.E3, NOTE_FREQ.G3, NOTE_FREQ.C4] },
      { delay: 1.88, dur: 0.76, notes: [NOTE_FREQ.Bb2, NOTE_FREQ.D3, NOTE_FREQ.F3, NOTE_FREQ.Bb3] },
      { delay: 2.55, dur: 1.65, notes: [NOTE_FREQ.D2, NOTE_FREQ.A2, NOTE_FREQ.D3, NOTE_FREQ.F3, NOTE_FREQ.A3] },
    ];

    for (const ch of dirgeChords) {
      this.playFilteredSynth(ch.notes, 'sawtooth', ch.dur, 0.11, 1350, 340, ch.delay, 0.06, 0.5);
      this.playFilteredSynth(
        ch.notes.map((f) => f * 0.996),
        'triangle',
        ch.dur,
        0.09,
        980,
        280,
        ch.delay + 0.02,
        0.08,
        0.48
      );
    }
  }

  // === DYNAMIC PROCEDURAL GOTHIC-SCI-FI SOUNDTRACK ===

  public setMusicMode(mode: MusicMode): void {
    if (this.musicMode === mode) return;
    const prev = this.musicMode;
    this.musicMode = mode;

    if (mode === 'none') {
      this.stopScheduler();
      if (this.musicBus && this.ctx) {
        this.musicBus.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.16);
      }
      return;
    }

    // Only reset phrase position when entering music from silence or switching menu <-> match
    if (prev === 'none' || prev === 'menu' || mode === 'menu') {
      this.stepIndex = 0;
    }

    if (this.muted || this.musicMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (this.musicBus) {
      const targetVol = mode === 'menu' ? 0.3 : mode === 'tension' ? 0.38 : 0.34;
      this.musicBus.gain.setTargetAtTime(targetVol, ctx.currentTime, 0.25);
    }

    if (this.schedulerId === null) {
      this.startScheduler();
    }
  }

  private startScheduler(): void {
    if (this.schedulerId !== null || typeof window === 'undefined') return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    this.nextStepTime = ctx.currentTime + 0.08;
    this.schedulerId = window.setInterval(() => this.tickMusicScheduler(), 55);
  }

  private stopScheduler(): void {
    if (this.schedulerId !== null) {
      clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
  }

  private tickMusicScheduler(): void {
    if (this.muted || this.musicMuted || this.musicMode === 'none') {
      this.stopScheduler();
      return;
    }
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;

    const bpm = this.musicMode === 'menu' ? 84 : this.musicMode === 'tension' ? 128 : 120;
    const sixteenth = 60 / bpm / 4;
    const lookahead = 0.16;

    // Catch up cleanly if browser tab was backgrounded
    if (this.nextStepTime < ctx.currentTime - 0.25) {
      this.nextStepTime = ctx.currentTime + 0.05;
    }

    while (this.nextStepTime < ctx.currentTime + lookahead) {
      if (this.musicMode === 'menu') {
        this.scheduleMenuStep(this.stepIndex, this.nextStepTime, sixteenth);
      } else {
        this.scheduleBattleStep(this.stepIndex, this.nextStepTime, sixteenth, this.musicMode === 'tension');
      }
      this.nextStepTime += sixteenth;
      this.stepIndex = (this.stepIndex + 1) % 128; // 8-bar loop (16 steps per bar)
    }
  }

  private scheduleMenuStep(step: number, time: number, sixteenth: number): void {
    const bar = Math.floor(step / 16); // 0..7
    const beatStep = step % 16;

    // Cathedral progression: Dm -> Bb -> Gm -> A7 (2 bars each or 1 bar each)
    const chords: Array<{ bass: number; pad: number[]; arp: number[] }> = [
      { bass: NOTE_FREQ.D2, pad: [NOTE_FREQ.D3, NOTE_FREQ.F3, NOTE_FREQ.A3], arp: [NOTE_FREQ.D4, NOTE_FREQ.F4, NOTE_FREQ.A4, NOTE_FREQ.D5] },
      { bass: NOTE_FREQ.D2, pad: [NOTE_FREQ.D3, NOTE_FREQ.F3, NOTE_FREQ.A3], arp: [NOTE_FREQ.A4, NOTE_FREQ.F4, NOTE_FREQ.E4, NOTE_FREQ.D4] },
      { bass: NOTE_FREQ.Bb2, pad: [NOTE_FREQ.Bb2, NOTE_FREQ.D3, NOTE_FREQ.F3], arp: [NOTE_FREQ.Bb3, NOTE_FREQ.D4, NOTE_FREQ.F4, NOTE_FREQ.A4] },
      { bass: NOTE_FREQ.C3, pad: [NOTE_FREQ.C3, NOTE_FREQ.E3, NOTE_FREQ.G3], arp: [NOTE_FREQ.C4, NOTE_FREQ.E4, NOTE_FREQ.G4, NOTE_FREQ.C5] },
      { bass: NOTE_FREQ.D2, pad: [NOTE_FREQ.D3, NOTE_FREQ.F3, NOTE_FREQ.A3], arp: [NOTE_FREQ.D4, NOTE_FREQ.A4, NOTE_FREQ.F4, NOTE_FREQ.E4] },
      { bass: NOTE_FREQ.G2, pad: [NOTE_FREQ.G2, NOTE_FREQ.Bb2, NOTE_FREQ.D3], arp: [NOTE_FREQ.G4, NOTE_FREQ.D4, NOTE_FREQ.Bb4, NOTE_FREQ.A4] },
      { bass: NOTE_FREQ.Bb2, pad: [NOTE_FREQ.Bb2, NOTE_FREQ.D3, NOTE_FREQ.F3], arp: [NOTE_FREQ.F4, NOTE_FREQ.D4, NOTE_FREQ.A4, NOTE_FREQ.G4] },
      { bass: NOTE_FREQ.A2, pad: [NOTE_FREQ.A2, NOTE_FREQ.Cs3, NOTE_FREQ.E3], arp: [NOTE_FREQ.E4, NOTE_FREQ.A4, NOTE_FREQ.Cs5, NOTE_FREQ.A4] },
    ];
    const ch = chords[bar % chords.length];

    // Lush cathedral choir/organ pad on beat 1 of each bar
    if (beatStep === 0) {
      this.musicPad(ch.pad, time, sixteenth * 15.8, 0.14, 980);
      this.musicBass(ch.bass, time, sixteenth * 14, 0.16, 260);
    }

    // Subtle deep cathedral pulse on beat 1 and beat 3
    if (beatStep === 0 || beatStep === 10) {
      this.musicKick(time, beatStep === 0 ? 0.22 : 0.13);
    }

    // Delicate crystalline relic harp arpeggio on eighth/dotted notes
    if (beatStep === 0 || beatStep === 4 || beatStep === 8 || beatStep === 12) {
      const note = ch.arp[(beatStep / 4) % ch.arp.length];
      this.musicPluck(note, time, sixteenth * 3.8, 0.085);
    }
  }

  private scheduleBattleStep(step: number, time: number, sixteenth: number, tension: boolean): void {
    const bar = Math.floor(step / 16); // 0..7
    const s = step % 16;

    // 8-bar heroic Gothic-Sci-Fi Arena progression (Dm - Bb - C - Am | Dm - Gm - Bb - A7)
    const prog = [
      { root: NOTE_FREQ.D2, fifth: NOTE_FREQ.A2, chord: [NOTE_FREQ.D3, NOTE_FREQ.F3, NOTE_FREQ.A3] },
      { root: NOTE_FREQ.Bb2, fifth: NOTE_FREQ.F2, chord: [NOTE_FREQ.Bb2, NOTE_FREQ.D3, NOTE_FREQ.F3] },
      { root: NOTE_FREQ.C3, fifth: NOTE_FREQ.G2, chord: [NOTE_FREQ.C3, NOTE_FREQ.E3, NOTE_FREQ.G3] },
      { root: NOTE_FREQ.A2, fifth: NOTE_FREQ.E2, chord: [NOTE_FREQ.A2, NOTE_FREQ.C3, NOTE_FREQ.E3] },
      { root: NOTE_FREQ.D2, fifth: NOTE_FREQ.A2, chord: [NOTE_FREQ.D3, NOTE_FREQ.F3, NOTE_FREQ.A3] },
      { root: NOTE_FREQ.G2, fifth: NOTE_FREQ.D2, chord: [NOTE_FREQ.G2, NOTE_FREQ.Bb2, NOTE_FREQ.D3] },
      { root: NOTE_FREQ.Bb2, fifth: NOTE_FREQ.F2, chord: [NOTE_FREQ.Bb2, NOTE_FREQ.D3, NOTE_FREQ.F3] },
      { root: NOTE_FREQ.A2, fifth: NOTE_FREQ.E2, chord: [NOTE_FREQ.A2, NOTE_FREQ.Cs3, NOTE_FREQ.E3] },
    ];
    const barData = prog[bar % prog.length];

    // 1. War-Drum & Sci-Fi Arena Percussion
    const kickPattern = tension
      ? [0, 3, 6, 8, 10, 14]
      : [0, 6, 8, 14];
    if (kickPattern.includes(s)) {
      this.musicKick(time, s === 0 || s === 8 ? 0.34 : 0.24);
    }
    if (s === 4 || s === 12) {
      this.musicSnare(time, tension ? 0.24 : 0.19);
    }
    // Crisp hi-hat groove (16ths in tension, offbeat 8ths + ghost 16ths in battle)
    if (tension ? s % 2 === 0 || s === 15 : s % 2 === 0) {
      this.musicHat(time, s % 4 === 2 ? 0.085 : 0.042);
    }
    // Bar 4 & 8 tom turnaround fill
    if ((bar === 3 || bar === 7) && (s === 13 || s === 14 || s === 15)) {
      this.musicKick(time, 0.26, 130 - (s - 13) * 22);
    }

    // 2. Driving Dark Synth-Bass Ostinato (galloping eighth/sixteenth pulse)
    if (s % 2 === 0) {
      const octUp = s === 6 || s === 14 ? 2 : 1;
      const bassNote = s === 10 ? barData.fifth : barData.root * octUp;
      this.musicBass(bassNote, time, sixteenth * 1.75, tension ? 0.23 : 0.2, tension ? 780 : 580);
    }

    // 3. Gothic Cathedral Pipe-Organ / Dark Brass Chords
    if (s === 0) {
      this.musicPad(barData.chord, time, sixteenth * 14.5, tension ? 0.15 : 0.125, tension ? 1800 : 1280);
    } else if (tension && s === 8) {
      // Rhythmic brass swell on beat 3 during tension
      this.musicPad(barData.chord.map((f) => f * 2), time, sixteenth * 5.5, 0.085, 2200);
    }

    // 4. Heroic Arena Lead Motif (Bars 0–3: rhythmic crystalline arpeggio; Bars 4–7: soaring Gothic-Brass melody!)
    if (bar < 4) {
      const arpNotes = [
        barData.chord[0] * 2,
        barData.chord[1] * 2,
        barData.chord[2] * 2,
        barData.chord[1] * 2,
      ];
      if (s === 0 || s === 3 || s === 6 || s === 8 || s === 11 || s === 14) {
        const idx = (s === 0 ? 0 : s === 3 ? 1 : s === 6 ? 2 : s === 8 ? 3 : s === 11 ? 2 : 1);
        this.musicPluck(arpNotes[idx], time, sixteenth * 2.2, 0.09);
      }
    } else {
      // Heroic theme across bars 4..7 (D minor heroic hook)
      const motifByBar: Record<number, Record<number, { n: number; len: number }>> = {
        4: {
          0: { n: NOTE_FREQ.D4, len: 3 },
          3: { n: NOTE_FREQ.F4, len: 3 },
          6: { n: NOTE_FREQ.A4, len: 4 },
          10: { n: NOTE_FREQ.G4, len: 2 },
          12: { n: NOTE_FREQ.F4, len: 4 },
        },
        5: {
          0: { n: NOTE_FREQ.G4, len: 3 },
          3: { n: NOTE_FREQ.Bb4, len: 3 },
          6: { n: NOTE_FREQ.A4, len: 4 },
          10: { n: NOTE_FREQ.G4, len: 2 },
          12: { n: NOTE_FREQ.D4, len: 4 },
        },
        6: {
          0: { n: NOTE_FREQ.F4, len: 3 },
          3: { n: NOTE_FREQ.A4, len: 3 },
          6: { n: NOTE_FREQ.D5, len: 6 },
          12: { n: NOTE_FREQ.C5, len: 4 },
        },
        7: {
          0: { n: NOTE_FREQ.A4, len: 6 },
          6: { n: NOTE_FREQ.G4, len: 2 },
          8: { n: NOTE_FREQ.A4, len: 4 },
          12: { n: NOTE_FREQ.Cs5, len: 4 },
        },
      };
      const hit = motifByBar[bar]?.[s];
      if (hit) {
        this.musicLead(hit.n, time, sixteenth * hit.len * 0.95, tension ? 0.13 : 0.11);
      }
    }
  }

  // === MUSIC ENGINE INSTRUMENT VOICES (ROUTED TO musicBus) ===

  private musicKick(time: number, vol: number, startHz = 112): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startHz, time);
    osc.frequency.exponentialRampToValueAtTime(34, time + 0.14);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.19);

    osc.connect(g);
    g.connect(this.musicBus);
    osc.start(time);
    osc.stop(time + 0.21);
  }

  private musicSnare(time: number, vol: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus || !this.pinkNoise) return;

    // Punchy drum body
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(195, time);
    osc.frequency.exponentialRampToValueAtTime(105, time + 0.07);
    const og = ctx.createGain();
    og.gain.setValueAtTime(vol * 0.7, time);
    og.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);
    osc.connect(og);
    og.connect(this.musicBus);
    osc.start(time);
    osc.stop(time + 0.1);

    // Filtered noise snare snap
    const src = ctx.createBufferSource();
    src.buffer = this.pinkNoise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1900, time);
    bp.Q.value = 0.9;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vol, time);
    ng.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(this.musicBus);
    src.start(time, Math.random() * 0.5, 0.16);
    src.stop(time + 0.17);
  }

  private musicHat(time: number, vol: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus || !this.whiteNoise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.whiteNoise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(6800, time);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.048);
    src.connect(hp);
    hp.connect(g);
    g.connect(this.musicBus);
    src.start(time, Math.random() * 0.6, 0.055);
    src.stop(time + 0.06);
  }

  private musicBass(freq: number, time: number, dur: number, vol: number, cutoff: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 2.2;
    lp.frequency.setValueAtTime(cutoff, time);
    lp.frequency.exponentialRampToValueAtTime(Math.max(120, cutoff * 0.35), time + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    osc.connect(lp);
    lp.connect(g);
    g.connect(this.musicBus);
    osc.start(time);
    osc.stop(time + dur + 0.03);
  }

  private musicPad(freqs: number[], time: number, dur: number, vol: number, cutoff: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.8;
    lp.frequency.setValueAtTime(cutoff * 0.7, time);
    lp.frequency.linearRampToValueAtTime(cutoff, time + dur * 0.35);
    lp.frequency.exponentialRampToValueAtTime(Math.max(240, cutoff * 0.45), time + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vol, time + Math.min(0.18, dur * 0.25));
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    for (const f of freqs) {
      const o1 = ctx.createOscillator();
      o1.type = 'sawtooth';
      o1.frequency.setValueAtTime(f, time);
      o1.connect(lp);
      o1.start(time);
      o1.stop(time + dur + 0.04);

      const o2 = ctx.createOscillator();
      o2.type = 'triangle';
      o2.frequency.setValueAtTime(f * 1.004, time);
      o2.connect(lp);
      o2.start(time);
      o2.stop(time + dur + 0.04);
    }

    lp.connect(g);
    g.connect(this.musicBus);
    if (this.reverbSend) {
      const wet = ctx.createGain();
      wet.gain.value = 0.26;
      g.connect(wet);
      wet.connect(this.reverbSend);
    }
  }

  private musicPluck(freq: number, time: number, dur: number, vol: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const carrier = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modG = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();

    carrier.type = 'triangle';
    carrier.frequency.setValueAtTime(freq, time);
    mod.type = 'sine';
    mod.frequency.setValueAtTime(freq * 2, time);
    modG.gain.setValueAtTime(freq * 0.85, time);
    modG.gain.exponentialRampToValueAtTime(1, time + dur * 0.6);

    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3600, time);
    lp.frequency.exponentialRampToValueAtTime(720, time + dur);

    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    mod.connect(modG);
    modG.connect(carrier.frequency);
    carrier.connect(lp);
    lp.connect(g);
    g.connect(this.musicBus);

    if (this.reverbSend) {
      const wet = ctx.createGain();
      wet.gain.value = 0.28;
      g.connect(wet);
      wet.connect(this.reverbSend);
    }

    mod.start(time);
    carrier.start(time);
    mod.stop(time + dur + 0.03);
    carrier.stop(time + dur + 0.03);
  }

  private musicLead(freq: number, time: number, dur: number, vol: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 1.8;
    lp.frequency.setValueAtTime(2800, time);
    lp.frequency.exponentialRampToValueAtTime(920, time + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.setValueAtTime(freq, time);

    const o2 = ctx.createOscillator();
    o2.type = 'sawtooth';
    o2.frequency.setValueAtTime(freq * 1.005, time);

    o1.connect(lp);
    o2.connect(lp);
    lp.connect(g);
    g.connect(this.musicBus);

    if (this.reverbSend) {
      const wet = ctx.createGain();
      wet.gain.value = 0.34;
      g.connect(wet);
      wet.connect(this.reverbSend);
    }

    o1.start(time);
    o2.start(time);
    o1.stop(time + dur + 0.04);
    o2.stop(time + dur + 0.04);
  }
}

export const gameAudio = new GameAudio();
