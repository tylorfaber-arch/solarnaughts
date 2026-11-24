class GameAudio {
  private ctx: AudioContext | null = null;
  private muted = false;
  private masterGain: GainNode | null = null;
  private dryBus: GainNode | null = null;
  private wetBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private lastHitConfirmAt = 0;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      const ctx = new AudioCtx();
      this.ctx = ctx;

      // Soft dynamics compressor so teamfights hit hard without clipping
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 18;
      compressor.ratio.value = 6;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.14;

      const master = ctx.createGain();
      master.gain.value = 0.34;
      this.masterGain = master;

      const dry = ctx.createGain();
      dry.gain.value = 0.92;
      this.dryBus = dry;

      // Subtle Gothic Cathedral stone-hall reverb impulse
      const convolver = ctx.createConvolver();
      convolver.buffer = this.buildCathedralImpulse(ctx, 0.55);
      const wet = ctx.createGain();
      wet.gain.value = 0.17;
      this.wetBus = wet;

      dry.connect(compressor);
      wet.connect(convolver);
      convolver.connect(compressor);
      compressor.connect(master);
      master.connect(ctx.destination);

      this.noiseBuffer = this.buildNoiseBuffer(ctx, 1.2);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private buildNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      // Blend crisp white + warm pink noise for organic impacts & whooshes
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.95 * b2 + white * 0.048;
      ch[i] = Math.max(-1, Math.min(1, white * 0.62 + (b0 + b1 + b2) * 0.38));
    }
    return buf;
  }

  private buildCathedralImpulse(ctx: AudioContext, seconds: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = buf.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const decay = Math.pow(1 - t, 2.7);
        const raw = (Math.random() * 2 - 1) * decay;
        lp = lp * 0.68 + raw * 0.32;
        ch[i] = lp;
      }
    }
    return buf;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.34, this.ctx.currentTime, 0.02);
    }
    return this.muted;
  }

  private jitter(base: number, pct = 0.045): number {
    return base * (1 + (Math.random() * 2 - 1) * pct);
  }

  private playTone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    volume = 0.3,
    delay = 0,
    options?: {
      filterFreq?: number;
      filterType?: BiquadFilterType;
      filterQ?: number;
      attack?: number;
      reverb?: number;
      detune?: number;
    }
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.dryBus || !this.wetBus) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), now);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }
    if (options?.detune) {
      osc.detune.setValueAtTime(options.detune, now);
    }

    const gain = ctx.createGain();
    const atk = Math.min(duration * 0.4, options?.attack ?? 0.008);
    gain.gain.setValueAtTime(0.0008, now);
    gain.gain.linearRampToValueAtTime(Math.max(0.001, volume), now + atk);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    let tail: AudioNode = osc;
    if (options?.filterFreq) {
      const flt = ctx.createBiquadFilter();
      flt.type = options.filterType ?? 'lowpass';
      flt.frequency.setValueAtTime(options.filterFreq, now);
      if (options.filterQ) flt.Q.value = options.filterQ;
      tail.connect(flt);
      tail = flt;
    }

    tail.connect(gain);
    gain.connect(this.dryBus);
    if ((options?.reverb ?? 0.35) > 0) {
      const revSend = ctx.createGain();
      revSend.gain.value = options?.reverb ?? 0.35;
      gain.connect(revSend);
      revSend.connect(this.wetBus);
    }

    osc.start(now);
    osc.stop(now + duration + 0.025);
  }

  private playNoise(
    duration: number,
    volume = 0.25,
    startFreq = 800,
    endFreq = 800,
    filterType: BiquadFilterType = 'bandpass',
    Q = 1.4,
    delay = 0,
    reverb = 0.25
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.dryBus || !this.wetBus || !this.noiseBuffer) return;

    const now = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(Math.max(40, startFreq), now);
    if (endFreq !== startFreq) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);
    }
    filter.Q.value = Q;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(Math.max(0.001, volume), now + Math.min(0.008, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.dryBus);
    if (reverb > 0) {
      const revSend = ctx.createGain();
      revSend.gain.value = reverb;
      gain.connect(revSend);
      revSend.connect(this.wetBus);
    }

    const maxOffset = Math.max(0, this.noiseBuffer.duration - duration - 0.05);
    src.start(now, Math.random() * maxOffset, duration + 0.02);
  }

  /* =========================================================================
     8 DISTINCT CHAMPION PRIMARY WEAPON SOUNDS
     ========================================================================= */

  // Vexia: Consecrated Rail-Crossbow (bowstring snap + electromagnetic rail crack)
  public shootRevolver(vol = 1): void {
    const f = this.jitter(640);
    this.playTone(f, 165, 0.11, 'sawtooth', 0.24 * vol, 0, { filterFreq: 2400, reverb: 0.35 });
    this.playTone(f * 2.1, f * 0.75, 0.06, 'triangle', 0.15 * vol, 0, { reverb: 0.2 });
    this.playNoise(0.08, 0.22 * vol, 2600, 720, 'bandpass', 1.8, 0, 0.2);
  }

  // Vorg: Void-Claw Sonic Slash (dual detuned resonant rip)
  public shootSonic(vol = 1): void {
    const f = this.jitter(780);
    this.playTone(f, 290, 0.11, 'sawtooth', 0.18 * vol, 0, { filterFreq: 1900, filterQ: 3.5, reverb: 0.4 });
    this.playTone(f * 1.06, 310, 0.1, 'triangle', 0.14 * vol, 0.01, { detune: 14, reverb: 0.35 });
    this.playNoise(0.09, 0.16 * vol, 1800, 540, 'bandpass', 2.2, 0, 0.25);
  }

  // Xylar: Hard-Light Plasma Daggers (razor-fast high-tech blade zip)
  public shootPlasmaDagger(vol = 1): void {
    const f = this.jitter(1180);
    this.playTone(f, 440, 0.075, 'triangle', 0.19 * vol, 0, { filterFreq: 3400, reverb: 0.3 });
    this.playTone(f * 1.5, 620, 0.055, 'sine', 0.14 * vol, 0.008, { reverb: 0.25 });
    this.playNoise(0.055, 0.14 * vol, 3600, 1400, 'highpass', 1.2, 0, 0.15);
  }

  // Bastion: Consecrated Siege Mortar (sub-bass cannon thump + brass clank)
  public shootMortar(vol = 1): void {
    const f = this.jitter(148);
    this.playTone(f, 38, 0.24, 'triangle', 0.42 * vol, 0, { filterFreq: 420, reverb: 0.5 });
    this.playTone(f * 1.9, 68, 0.14, 'sawtooth', 0.2 * vol, 0, { filterFreq: 760, reverb: 0.3 });
    this.playNoise(0.18, 0.3 * vol, 560, 140, 'lowpass', 1.1, 0, 0.45);
  }

  // Korak: Spirit Bio-Beam (ethereal flute harmonic shimmer)
  public shootBioBeam(vol = 1): void {
    const f = this.jitter(440);
    this.playTone(f, f * 1.48, 0.15, 'sine', 0.22 * vol, 0, { reverb: 0.55 });
    this.playTone(f * 1.5, f * 2.0, 0.12, 'triangle', 0.12 * vol, 0.025, { reverb: 0.5 });
  }

  // Caldris: Cyber-Necro Soul Rail (hollow digital-occult beam hum)
  public shootSoulRail(vol = 1): void {
    const f = this.jitter(380);
    this.playTone(f, 220, 0.16, 'sawtooth', 0.2 * vol, 0, { filterFreq: 1450, filterQ: 4, reverb: 0.55 });
    this.playTone(f * 2.02, 540, 0.13, 'sine', 0.14 * vol, 0.015, { detune: -18, reverb: 0.5 });
    this.playNoise(0.1, 0.14 * vol, 2200, 900, 'bandpass', 2.4, 0, 0.3);
  }

  // Marrow-Hook: Abyssal Cleaver Arc (heavy forged iron cleave + metallic ring)
  public shootCleaver(vol = 1): void {
    const f = this.jitter(195);
    this.playTone(f, 64, 0.16, 'sawtooth', 0.3 * vol, 0, { filterFreq: 980, reverb: 0.4 });
    this.playTone(1240, 760, 0.11, 'sine', 0.11 * vol, 0.01, { reverb: 0.55 });
    this.playNoise(0.14, 0.32 * vol, 1250, 320, 'bandpass', 1.3, 0, 0.3);
  }

  // Seraph: Radiant Light-Lance (chime harmonic + consecrated beam snap)
  public shootRadiant(vol = 1): void {
    const f = this.jitter(680);
    this.playTone(f, f * 1.45, 0.12, 'triangle', 0.22 * vol, 0, { reverb: 0.55 });
    this.playTone(f * 2.0, f * 1.2, 0.09, 'sine', 0.14 * vol, 0.015, { reverb: 0.5 });
    this.playNoise(0.06, 0.1 * vol, 3200, 1600, 'highpass', 1.0, 0, 0.2);
  }

  /* =========================================================================
     SIGNATURE ABILITY SOUNDS
     ========================================================================= */

  public hookLaunch(vol = 1): void {
    this.playTone(340, 125, 0.24, 'sawtooth', 0.28 * vol, 0, { filterFreq: 1600, reverb: 0.45 });
    // Forged iron chain links rattling out
    this.playNoise(0.22, 0.3 * vol, 2400, 950, 'bandpass', 2.6, 0, 0.35);
    this.playTone(1540, 1180, 0.06, 'square', 0.08 * vol, 0.03, { filterFreq: 2400 });
    this.playTone(1420, 1020, 0.06, 'square', 0.08 * vol, 0.09, { filterFreq: 2400 });
  }

  public hookLatch(vol = 1): void {
    // Heavy iron meat-hook CLANG + sub-bass yank
    this.playTone(170, 540, 0.11, 'sawtooth', 0.36 * vol, 0, { filterFreq: 1800, reverb: 0.5 });
    this.playTone(1320, 880, 0.18, 'triangle', 0.24 * vol, 0.01, { reverb: 0.65 });
    this.playTone(195, 58, 0.22, 'sine', 0.38 * vol, 0.04, { reverb: 0.4 });
    this.playNoise(0.14, 0.32 * vol, 1900, 620, 'bandpass', 2.0, 0, 0.35);
  }

  public blightRot(vol = 1): void {
    this.playTone(128, 78, 0.36, 'sawtooth', 0.24 * vol, 0, { filterFreq: 520, filterQ: 3.5, reverb: 0.45 });
    this.playNoise(0.32, 0.24 * vol, 480, 220, 'bandpass', 2.4, 0, 0.4);
  }

  public aegisPulse(vol = 1): void {
    // Cathedral golden bell & radiant shockwave
    this.playTone(523, 523, 0.34, 'sine', 0.28 * vol, 0, { reverb: 0.75 });
    this.playTone(784, 784, 0.3, 'triangle', 0.2 * vol, 0.03, { reverb: 0.7 });
    this.playTone(1046, 1568, 0.26, 'sine', 0.14 * vol, 0.06, { reverb: 0.75 });
  }

  public orbitalCharge(vol = 1): void {
    this.playTone(260, 1180, 0.78, 'sine', 0.26 * vol, 0, { reverb: 0.65 });
    this.playTone(390, 880, 0.72, 'triangle', 0.18 * vol, 0.05, { detune: 8, reverb: 0.6 });
    this.playNoise(0.55, 0.12 * vol, 600, 2800, 'bandpass', 3.0, 0.12, 0.4);
  }

  public cloakVanish(vol = 1): void {
    this.playTone(780, 210, 0.24, 'sine', 0.22 * vol, 0, { reverb: 0.6 });
    this.playNoise(0.22, 0.2 * vol, 3200, 700, 'bandpass', 1.8, 0, 0.45);
  }

  public vortexPull(vol = 1): void {
    this.playTone(380, 72, 0.42, 'sine', 0.32 * vol, 0, { reverb: 0.65 });
    this.playTone(190, 520, 0.34, 'triangle', 0.18 * vol, 0.05, { filterFreq: 1400, reverb: 0.55 });
    this.playNoise(0.3, 0.16 * vol, 1400, 280, 'bandpass', 2.6, 0, 0.5);
  }

  public throwDynamite(vol = 1): void {
    this.playTone(300, 620, 0.13, 'triangle', 0.22 * vol, 0, { reverb: 0.3 });
    this.playNoise(0.11, 0.12 * vol, 2600, 1800, 'highpass', 1.2, 0.02, 0.15);
  }

  public explosion(heavy = false, vol = 1): void {
    const dur = heavy ? 0.48 : 0.28;
    // Sub-bass shockwave punch
    this.playTone(heavy ? 115 : 155, 28, dur, 'sine', (heavy ? 0.52 : 0.36) * vol, 0, { reverb: 0.55 });
    // Gritty low-mid blast body
    this.playTone(heavy ? 140 : 190, 42, dur * 0.85, 'sawtooth', (heavy ? 0.28 : 0.2) * vol, 0, {
      filterFreq: heavy ? 460 : 680,
      reverb: 0.45,
    });
    // Debris roar + shrapnel crackle
    this.playNoise(dur, (heavy ? 0.46 : 0.32) * vol, heavy ? 780 : 1150, 120, 'lowpass', 1.0, 0, 0.55);
    if (heavy) {
      this.playNoise(0.22, 0.22 * vol, 2400, 700, 'bandpass', 1.6, 0.03, 0.4);
    }
  }

  public bullCharge(vol = 1): void {
    this.playTone(135, 210, 0.26, 'sawtooth', 0.28 * vol, 0, { filterFreq: 860, reverb: 0.5 });
    this.playTone(202, 145, 0.28, 'triangle', 0.22 * vol, 0.07, { reverb: 0.45 });
    this.playNoise(0.22, 0.18 * vol, 620, 260, 'bandpass', 1.5, 0.02, 0.35);
  }

  public hydroDash(vol = 1): void {
    this.playTone(280, 1120, 0.19, 'sawtooth', 0.24 * vol, 0, { filterFreq: 2400, reverb: 0.45 });
    this.playNoise(0.18, 0.24 * vol, 2400, 680, 'bandpass', 1.7, 0, 0.35);
  }

  public whirlpool(vol = 1): void {
    this.playTone(240, 560, 0.28, 'triangle', 0.24 * vol, 0, { filterFreq: 1600, reverb: 0.5 });
    this.playTone(540, 310, 0.28, 'sine', 0.2 * vol, 0.14, { reverb: 0.5 });
    this.playNoise(0.28, 0.16 * vol, 900, 1600, 'bandpass', 2.2, 0, 0.4);
  }

  public bite(vol = 1): void {
    this.playTone(260, 72, 0.16, 'sawtooth', 0.34 * vol, 0, { filterFreq: 1100, reverb: 0.35 });
    this.playTone(880, 220, 0.08, 'triangle', 0.18 * vol, 0, { reverb: 0.3 });
    this.playNoise(0.11, 0.28 * vol, 1400, 380, 'bandpass', 1.6, 0, 0.25);
  }

  public meltdownCharge(vol = 1): void {
    // Rising Gothic pipe-organ swell
    this.playTone(196, 588, 1.15, 'sawtooth', 0.18 * vol, 0, { filterFreq: 1200, reverb: 0.7 });
    this.playTone(294, 880, 1.1, 'triangle', 0.15 * vol, 0.05, { reverb: 0.7 });
  }

  public totemDeploy(vol = 1): void {
    this.playTone(392, 588, 0.16, 'sine', 0.25 * vol, 0, { reverb: 0.65 });
    this.playTone(588, 784, 0.22, 'triangle', 0.2 * vol, 0.08, { reverb: 0.65 });
  }

  public droneSpawn(vol = 1): void {
    this.playTone(494, 740, 0.12, 'triangle', 0.2 * vol, 0, { reverb: 0.55 });
    this.playTone(740, 988, 0.16, 'sine', 0.18 * vol, 0.06, { reverb: 0.6 });
  }

  public shootVenom(vol = 1): void {
    // Pneumatic brass needle hiss + acid dart zip
    const base = this.jitter(920, 0.06);
    this.playNoise(0.065, 0.18 * vol, 3200, 1400, 'bandpass', 2.4, 0, 0.2);
    this.playTone(base, base * 0.42, 0.075, 'triangle', 0.18 * vol, 0, { filterFreq: 2800, reverb: 0.2 });
    this.playTone(base * 1.45, base * 0.72, 0.055, 'sine', 0.1 * vol, 0.01, { reverb: 0.22 });
  }

  public shootPrism(vol = 1): void {
    // Crystalline solar prism lance chime + crisp plasma crack
    const base = this.jitter(1180, 0.05);
    this.playTone(base, base * 0.46, 0.1, 'sawtooth', 0.16 * vol, 0, { filterFreq: 3400, reverb: 0.35 });
    this.playTone(base * 1.5, base * 1.9, 0.11, 'sine', 0.14 * vol, 0, { reverb: 0.48 });
    this.playNoise(0.05, 0.14 * vol, 3600, 1600, 'bandpass', 2.0, 0, 0.18);
  }

  public plagueCloud(vol = 1): void {
    // Shattering censer glass + hissing caustic miasma release
    this.playNoise(0.09, 0.24 * vol, 4200, 1600, 'highpass', 1.4, 0, 0.42);
    this.playNoise(0.32, 0.22 * vol, 1400, 520, 'bandpass', 2.2, 0.04, 0.5);
    this.playTone(220, 118, 0.28, 'sawtooth', 0.18 * vol, 0.02, { filterFreq: 760, reverb: 0.45 });
  }

  public contagionBurst(vol = 1): void {
    // Sinister bio-pressure swell + venomous cathedral detonation
    this.playTone(130, 310, 0.14, 'sawtooth', 0.24 * vol, 0, { filterFreq: 1100, reverb: 0.55 });
    this.playTone(340, 74, 0.32, 'sine', 0.36 * vol, 0.08, { reverb: 0.55 });
    this.playNoise(0.28, 0.28 * vol, 1900, 420, 'bandpass', 1.9, 0.06, 0.52);
  }

  public solarFlare(vol = 1): void {
    // Blazing sundial gong + roaring solar ignition
    this.playTone(440, 660, 0.22, 'triangle', 0.24 * vol, 0, { reverb: 0.68 });
    this.playTone(660, 990, 0.28, 'sine', 0.18 * vol, 0.05, { reverb: 0.72 });
    this.playNoise(0.3, 0.26 * vol, 2100, 620, 'bandpass', 1.5, 0.03, 0.55);
  }

  public chronoBlink(vol = 1): void {
    // Shimmering reverse-time chime + crisp spatial snap
    this.playTone(520, 1560, 0.14, 'sine', 0.24 * vol, 0, { reverb: 0.65 });
    this.playTone(1040, 780, 0.18, 'triangle', 0.18 * vol, 0.04, { reverb: 0.68 });
    this.playNoise(0.12, 0.18 * vol, 2800, 900, 'bandpass', 2.2, 0, 0.35);
  }

  /* =========================================================================
     MOVEMENT, ECONOMY & MATCH MILESTONE SOUNDS
     ========================================================================= */

  public jump(doubleJump = false): void {
    if (doubleJump) {
      this.playTone(340, 660, 0.12, 'sine', 0.18, 0, { reverb: 0.4 });
      this.playNoise(0.08, 0.1, 1800, 3000, 'bandpass', 1.8, 0, 0.25);
    } else {
      this.playTone(185, 340, 0.09, 'sine', 0.16, 0, { reverb: 0.2 });
      this.playNoise(0.06, 0.08, 900, 420, 'lowpass', 1.0, 0, 0.15);
    }
  }

  public jumpPad(): void {
    // Resonant gravity-well gong + upward air-column surge
    this.playTone(220, 880, 0.28, 'triangle', 0.3, 0, { filterFreq: 2600, reverb: 0.6 });
    this.playTone(330, 1100, 0.24, 'sine', 0.2, 0.03, { reverb: 0.65 });
    this.playNoise(0.22, 0.18, 600, 2600, 'bandpass', 1.8, 0, 0.4);
  }

  public solarPickup(): void {
    const base = this.jitter(820, 0.03);
    this.playTone(base, base * 1.33, 0.09, 'sine', 0.2, 0, { reverb: 0.55 });
    this.playTone(base * 1.5, base * 1.88, 0.12, 'triangle', 0.15, 0.045, { reverb: 0.6 });
  }

  public upgradeBuy(isAscension = false): void {
    // Anvil strike + cathedral harmonic forge chord
    this.playNoise(0.08, 0.2, 2800, 1200, 'bandpass', 2.4, 0, 0.45);
    const notes = isAscension ? [523, 659, 784, 1046, 1318] : [523, 659, 784, 1046];
    notes.forEach((n, i) => {
      this.playTone(n, n, isAscension ? 0.28 : 0.18, 'triangle', 0.22, i * 0.065, { reverb: 0.72 });
      this.playTone(n * 0.5, n * 0.5, isAscension ? 0.3 : 0.2, 'sine', 0.12, i * 0.065, { reverb: 0.65 });
    });
  }

  public dropPodSlam(): void {
    this.playTone(135, 32, 0.38, 'sine', 0.5, 0, { reverb: 0.6 });
    this.playTone(170, 48, 0.28, 'sawtooth', 0.26, 0, { filterFreq: 520, reverb: 0.5 });
    this.playNoise(0.32, 0.4, 720, 140, 'lowpass', 1.0, 0, 0.55);
  }

  public hitConfirm(): void {
    const now = performance.now();
    if (now - this.lastHitConfirmAt < 48) return;
    this.lastHitConfirmAt = now;
    const f = this.jitter(760, 0.06);
    this.playTone(f, f * 0.68, 0.045, 'triangle', 0.14, 0, { filterFreq: 2600, reverb: 0.15 });
  }

  public killBanner(): void {
    // Dramatic cathedral horn + tolling victory chime
    this.playTone(220, 220, 0.32, 'sawtooth', 0.18, 0, { filterFreq: 900, reverb: 0.75 });
    this.playTone(440, 440, 0.16, 'triangle', 0.22, 0, { reverb: 0.65 });
    this.playTone(554, 554, 0.16, 'triangle', 0.22, 0.09, { reverb: 0.65 });
    this.playTone(659, 880, 0.34, 'triangle', 0.26, 0.18, { reverb: 0.8 });
  }

  public victory(): void {
    const chord = [523, 659, 784, 1046, 1318];
    chord.forEach((n, idx) => {
      this.playTone(n, n, 0.42, 'triangle', 0.24, idx * 0.11, { reverb: 0.8 });
      this.playTone(n * 0.5, n * 0.5, 0.46, 'sine', 0.14, idx * 0.11, { reverb: 0.75 });
    });
  }

  public defeat(): void {
    const notes = [392, 349, 311, 261];
    notes.forEach((n, idx) => {
      this.playTone(n, n * 0.96, 0.36, 'sawtooth', 0.18, idx * 0.16, { filterFreq: 820, reverb: 0.75 });
      this.playTone(n * 0.5, n * 0.49, 0.4, 'sine', 0.16, idx * 0.16, { reverb: 0.75 });
    });
  }
}

export const gameAudio = new GameAudio();
