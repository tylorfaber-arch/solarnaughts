// Cinematic Foley, Grand Symphonic Gothic-Cathedral Score & Voice Bus Engine

export type MusicMode = 'none' | 'menu' | 'battle' | 'tension';

const NOTE_FREQ: Record<string, number> = {
  G1: 49.0,
  A1: 55.0,
  Bb1: 58.27,
  C2: 65.41,
  Cs2: 69.3,
  D2: 73.42,
  Eb2: 77.78,
  E2: 82.41,
  F2: 87.31,
  Fs2: 92.5,
  G2: 98.0,
  Ab2: 103.83,
  A2: 110.0,
  Bb2: 116.54,
  B2: 123.47,
  C3: 130.81,
  Cs3: 138.59,
  D3: 146.83,
  Eb3: 155.56,
  E3: 164.81,
  F3: 174.61,
  Fs3: 185.0,
  G3: 196.0,
  Ab3: 207.65,
  A3: 220.0,
  Bb3: 233.08,
  B3: 246.94,
  C4: 261.63,
  Cs4: 277.18,
  D4: 293.66,
  Eb4: 311.13,
  E4: 329.63,
  F4: 349.23,
  Fs4: 369.99,
  G4: 392.0,
  Ab4: 415.3,
  A4: 440.0,
  Bb4: 466.16,
  B4: 493.88,
  C5: 523.25,
  Cs5: 554.37,
  D5: 587.33,
  Eb5: 622.25,
  E5: 659.25,
  F5: 698.46,
  Fs5: 739.99,
  G5: 783.99,
  A5: 880.0,
  Bb5: 932.33,
  C6: 1046.5,
  D6: 1174.66,
};

const VOWEL_FORMANTS: Record<'ah' | 'ooh' | 'eh', [number, number, number]> = {
  ah: [720, 1120, 2450],
  ooh: [310, 860, 2240],
  eh: [520, 1840, 2520],
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
  private musicDuckGain: GainNode | null = null;
  private voiceBus: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbSend: GainNode | null = null;
  private activeVoiceSource: AudioBufferSourceNode | null = null;
  private activeVoiceResolve: (() => void) | null = null;

  private whiteNoise: AudioBuffer | null = null;
  private pinkNoise: AudioBuffer | null = null;
  private brownNoise: AudioBuffer | null = null;
  private softClipCurve: Float32Array<ArrayBuffer> = makeDistortionCurve(18);
  private hardClipCurve: Float32Array<ArrayBuffer> = makeDistortionCurve(55);
  private brassWarmCurve: Float32Array<ArrayBuffer> = makeDistortionCurve(11);

  private muted = false;
  private musicMuted = false;
  private voicesMuted = false;
  private musicDucked = false;
  private lastShotTime = 0;
  private lastHitTime = 0;

  // Grand Symphonic Music Engine State
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
      compressor.threshold.value = -13;
      compressor.knee.value = 18;
      compressor.ratio.value = 4.5;
      compressor.attack.value = 0.005;
      compressor.release.value = 0.16;
      compressor.connect(ctx.destination);

      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = 0.88;
      this.sfxBus.connect(compressor);

      // Music flows through musicBus -> musicDuckGain -> master compressor
      this.musicDuckGain = ctx.createGain();
      this.musicDuckGain.gain.value = this.musicDucked ? 0.36 : 1.0;
      this.musicDuckGain.connect(compressor);

      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = this.musicMuted ? 0 : this.getTargetMusicVolume(this.musicMode);
      this.musicBus.connect(this.musicDuckGain);

      // Lush 2.65s Stereo Cathedral Hall Convolution Reverb (early reflections + stone tail)
      this.reverbNode = ctx.createConvolver();
      this.reverbNode.buffer = this.buildCathedralImpulse(ctx, 2.65, 2.35);
      this.reverbSend = ctx.createGain();
      this.reverbSend.gain.value = 0.36;
      this.reverbSend.connect(this.reverbNode);
      this.reverbNode.connect(compressor);

      // Dedicated Voice Bus: crisp speech clarity + gentle presence shelf + cathedral touch
      this.voiceBus = ctx.createGain();
      this.voiceBus.gain.value = this.voicesMuted ? 0 : 1.05;
      const voiceHp = ctx.createBiquadFilter();
      voiceHp.type = 'highpass';
      voiceHp.frequency.value = 85;
      const voicePresence = ctx.createBiquadFilter();
      voicePresence.type = 'peaking';
      voicePresence.frequency.value = 2850;
      voicePresence.Q.value = 0.9;
      voicePresence.gain.value = 2.4;

      this.voiceBus.connect(voiceHp);
      voiceHp.connect(voicePresence);
      voicePresence.connect(compressor);

      this.buildNoiseBuffers(ctx);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getTargetMusicVolume(mode: MusicMode): number {
    if (mode === 'menu') return 0.36;
    if (mode === 'tension') return 0.42;
    if (mode === 'battle') return 0.38;
    return 0.0001;
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
    const sr = ctx.sampleRate;
    const length = Math.floor(sr * duration);
    const impulse = ctx.createBuffer(2, length, sr);
    const earlyTaps = [
      { ms: 18, gain: 0.42 },
      { ms: 34, gain: 0.32 },
      { ms: 58, gain: 0.24 },
      { ms: 89, gain: 0.18 },
      { ms: 126, gain: 0.12 },
    ];

    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < length; i++) {
        const t = i / length;
        const preDelay = i < sr * 0.014 ? 0.15 : 1.0;
        const env = Math.pow(1 - t, decay) * preDelay;
        const raw = (Math.random() * 2 - 1) * env;
        // Progressive high-frequency absorption as sound bounces off gothic stone arches
        const damp = 0.66 + t * 0.26;
        lp = lp * damp + raw * (1 - damp);
        data[i] = lp * 0.68;
      }
      // Subtle stereo-offset early reflections for cavernous spatial depth
      for (const tap of earlyTaps) {
        const idx = Math.floor(((tap.ms + (ch === 1 ? 4.5 : 0)) / 1000) * sr);
        if (idx < length) {
          data[idx] += (ch === 0 ? 1 : -1) * tap.gain * 0.45;
        }
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
      this.stopCurrentVoice();
      if (this.musicBus && this.ctx) {
        this.musicBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
      }
      if (this.sfxBus && this.ctx) {
        this.sfxBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
      }
      if (this.voiceBus && this.ctx) {
        this.voiceBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
      }
    } else {
      const ctx = this.ensureContext();
      if (ctx && this.sfxBus) {
        this.sfxBus.gain.setTargetAtTime(0.88, ctx.currentTime, 0.04);
      }
      if (ctx && this.voiceBus) {
        this.voiceBus.gain.setTargetAtTime(this.voicesMuted ? 0 : 1.05, ctx.currentTime, 0.04);
      }
      if (ctx && this.musicBus) {
        this.musicBus.gain.setTargetAtTime(
          this.musicMuted ? 0 : this.getTargetMusicVolume(this.musicMode),
          ctx.currentTime,
          0.08
        );
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
        this.musicBus.gain.setTargetAtTime(
          this.getTargetMusicVolume(this.musicMode),
          ctx.currentTime,
          0.08
        );
      }
      if (this.musicMode !== 'none') {
        this.startScheduler();
      }
    }
    return this.musicMuted;
  }

  public isVoicesMuted(): boolean {
    return this.voicesMuted;
  }

  public toggleVoicesMute(): boolean {
    this.voicesMuted = !this.voicesMuted;
    if (this.voicesMuted) {
      this.stopCurrentVoice();
      if (this.voiceBus && this.ctx) {
        this.voiceBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
      }
    } else if (!this.muted) {
      const ctx = this.ensureContext();
      if (ctx && this.voiceBus) {
        this.voiceBus.gain.setTargetAtTime(1.05, ctx.currentTime, 0.05);
      }
    }
    return this.voicesMuted;
  }

  public duckMusic(ducked: boolean): void {
    this.musicDucked = ducked;
    if (this.musicDuckGain && this.ctx) {
      const target = ducked ? 0.36 : 1.0;
      const tau = ducked ? 0.07 : 0.32;
      this.musicDuckGain.gain.setTargetAtTime(target, this.ctx.currentTime, tau);
    }
  }

  public stopCurrentVoice(): void {
    if (this.activeVoiceSource) {
      try {
        this.activeVoiceSource.onended = null;
        this.activeVoiceSource.stop();
      } catch {
        // Ignore already-stopped source
      }
      this.activeVoiceSource = null;
    }
    if (this.activeVoiceResolve) {
      const fn = this.activeVoiceResolve;
      this.activeVoiceResolve = null;
      fn();
    }
    this.duckMusic(false);
  }

  public async playVoiceWavBuffer(
    wavData: ArrayBuffer,
    opts?: { isAnnouncer?: boolean }
  ): Promise<void> {
    if (this.muted || this.voicesMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.voiceBus) return;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return;
      }
    }

    // Clone buffer because decodeAudioData detaches the passed ArrayBuffer
    const decoded = await ctx.decodeAudioData(wavData.slice(0));

    // Preempt any currently speaking voice line cleanly
    this.stopCurrentVoice();

    return new Promise<void>((resolve) => {
      if (this.muted || this.voicesMuted || !this.ctx || !this.voiceBus) {
        resolve();
        return;
      }

      const src = this.ctx.createBufferSource();
      src.buffer = decoded;

      const clipGain = this.ctx.createGain();
      clipGain.gain.value = opts?.isAnnouncer ? 1.15 : 1.0;

      src.connect(clipGain);
      clipGain.connect(this.voiceBus);

      // Cathedral hall send (richer reverb on the Cathedral Herald, subtle room polish on champions)
      if (this.reverbSend) {
        const wet = this.ctx.createGain();
        wet.gain.value = opts?.isAnnouncer ? 0.34 : 0.13;
        clipGain.connect(wet);
        wet.connect(this.reverbSend);
      }

      this.activeVoiceSource = src;
      this.activeVoiceResolve = resolve;
      this.duckMusic(true);

      src.onended = () => {
        if (this.activeVoiceSource === src) {
          this.activeVoiceSource = null;
          this.activeVoiceResolve = null;
          this.duckMusic(false);
        }
        resolve();
      };

      src.start();
    });
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

  // === CINEMATIC VICTORY FANFARE & DEFEAT REQUIEM (SYMPHONIC CATHEDRAL EDITION) ===

  public victory(): void {
    this.playVictoryFanfare();
  }

  public defeat(): void {
    this.playDefeatRequiem();
  }

  public playVictoryFanfare(): void {
    this.setMusicMode('none');
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;

    // 1. Core shatter shockwave + rapid orchestral Timpani & Snare crescendo roll
    this.playSubPunch(108, 22, 0.7, 0.44, 0, true);
    this.playFilteredNoise('brown', 0.62, 0.34, 'lowpass', 1500, 140, 0.7, 0, 0.004, 0.38);

    const rollSteps = [0.22, 0.33, 0.43, 0.51, 0.58, 0.64, 0.69];
    rollSteps.forEach((t, idx) => {
      this.orchTimpani(NOTE_FREQ.A1, now + t, 0.24 + idx * 0.03, 0.38, this.sfxBus!);
      this.orchSnare(now + t, 0.12 + idx * 0.025, true, this.sfxBus!);
    });

    // 2. Heroic French Horn & Trumpet Fanfare in D Major (D4 -> A4 -> F#4 -> A4 -> D5!)
    const calls: Array<{ delay: number; dur: number; melody: number; harmony: number[] }> = [
      { delay: 0.74, dur: 0.34, melody: NOTE_FREQ.D4, harmony: [NOTE_FREQ.D3, NOTE_FREQ.A3] },
      { delay: 1.08, dur: 0.30, melody: NOTE_FREQ.A4, harmony: [NOTE_FREQ.A3, NOTE_FREQ.E4] },
      { delay: 1.38, dur: 0.32, melody: NOTE_FREQ.Fs4, harmony: [NOTE_FREQ.D3, NOTE_FREQ.A3] },
      { delay: 1.70, dur: 0.34, melody: NOTE_FREQ.A4, harmony: [NOTE_FREQ.A3, NOTE_FREQ.E4] },
    ];
    for (const c of calls) {
      this.orchBrass(c.melody, now + c.delay, c.dur, 0.24, 0.12, this.sfxBus);
      this.orchBrass(c.melody * 0.5, now + c.delay, c.dur, 0.16, -0.18, this.sfxBus);
      this.orchPipeOrgan(c.harmony, now + c.delay, c.dur + 0.08, 0.11, 2200, this.sfxBus);
    }

    // 3. Monumental Final D-Major Cathedral Tutti (Pipe Organ + Formant Choir + Strings + Brass + Bells)
    const finale = now + 2.06;
    this.orchTimpani(NOTE_FREQ.D2, finale, 0.48, 0.85, this.sfxBus);
    this.orchCymbal(finale, 0.24, 2.1, this.sfxBus);
    this.orchPipeOrgan(
      [NOTE_FREQ.D2, NOTE_FREQ.D3, NOTE_FREQ.A3, NOTE_FREQ.D4, NOTE_FREQ.Fs4],
      finale,
      2.55,
      0.19,
      3400,
      this.sfxBus
    );
    this.orchChoir(
      [NOTE_FREQ.D4, NOTE_FREQ.Fs4, NOTE_FREQ.A4, NOTE_FREQ.D5],
      finale + 0.04,
      2.6,
      0.24,
      'ah',
      this.sfxBus
    );
    this.orchBrass(NOTE_FREQ.D5, finale, 2.25, 0.22, 0.15, this.sfxBus);
    this.orchBrass(NOTE_FREQ.A4, finale, 2.25, 0.17, -0.22, this.sfxBus);
    this.orchStringLegato(NOTE_FREQ.Fs5, finale + 0.06, 2.4, 0.14, 0.28, this.sfxBus);
    this.orchTubularBell(NOTE_FREQ.D5, finale, 0.22, 2.4, -0.25, this.sfxBus);
    this.orchTubularBell(NOTE_FREQ.A5, finale + 0.26, 0.16, 2.1, 0.25, this.sfxBus);
  }

  public playDefeatRequiem(): void {
    this.setMusicMode('none');
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;

    // 1. Seismic core collapse
    this.playSubPunch(92, 18, 0.85, 0.44, 0, true);
    this.playFilteredNoise('brown', 0.82, 0.36, 'lowpass', 980, 95, 0.7, 0, 0.005, 0.42);

    // 2. Heavy Bronze Funeral Cathedral Bells
    this.orchTubularBell(NOTE_FREQ.D3, now + 0.32, 0.28, 2.6, -0.2, this.sfxBus);
    this.orchTubularBell(NOTE_FREQ.A2, now + 1.62, 0.26, 2.8, 0.2, this.sfxBus);

    // 3. Solemn Descending Minor Pipe-Organ & Mourning Choir Dirge (Dm -> C -> Bb -> Dm)
    const dirge: Array<{ delay: number; dur: number; organ: number[]; choir: number[]; timp: number }> = [
      {
        delay: 0.42,
        dur: 0.82,
        organ: [NOTE_FREQ.D2, NOTE_FREQ.D3, NOTE_FREQ.F3, NOTE_FREQ.A3],
        choir: [NOTE_FREQ.D4, NOTE_FREQ.F4, NOTE_FREQ.A4],
        timp: NOTE_FREQ.D2,
      },
      {
        delay: 1.22,
        dur: 0.78,
        organ: [NOTE_FREQ.C2, NOTE_FREQ.C3, NOTE_FREQ.E3, NOTE_FREQ.G3],
        choir: [NOTE_FREQ.C4, NOTE_FREQ.E4, NOTE_FREQ.G4],
        timp: NOTE_FREQ.C2,
      },
      {
        delay: 1.98,
        dur: 0.78,
        organ: [NOTE_FREQ.Bb1, NOTE_FREQ.Bb2, NOTE_FREQ.D3, NOTE_FREQ.F3],
        choir: [NOTE_FREQ.Bb3, NOTE_FREQ.D4, NOTE_FREQ.F4],
        timp: NOTE_FREQ.Bb1,
      },
      {
        delay: 2.74,
        dur: 1.85,
        organ: [NOTE_FREQ.D2, NOTE_FREQ.A2, NOTE_FREQ.D3, NOTE_FREQ.F3],
        choir: [NOTE_FREQ.D4, NOTE_FREQ.F4, NOTE_FREQ.A3],
        timp: NOTE_FREQ.D2,
      },
    ];

    for (const d of dirge) {
      this.orchTimpani(d.timp, now + d.delay, 0.3, 0.65, this.sfxBus);
      this.orchPipeOrgan(d.organ, now + d.delay, d.dur, 0.16, 1380, this.sfxBus);
      this.orchChoir(d.choir, now + d.delay + 0.04, d.dur + 0.18, 0.22, 'ooh', this.sfxBus);
    }
  }

  // === GRAND SYMPHONIC GOTHIC-CATHEDRAL SOUNDTRACK ENGINE ===

  public setMusicMode(mode: MusicMode): void {
    if (this.musicMode === mode) return;
    const prev = this.musicMode;
    this.musicMode = mode;

    if (mode === 'none') {
      this.stopScheduler();
      if (this.musicBus && this.ctx) {
        this.musicBus.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.18);
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
      this.musicBus.gain.setTargetAtTime(this.getTargetMusicVolume(mode), ctx.currentTime, 0.28);
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
    this.schedulerId = window.setInterval(() => this.tickMusicScheduler(), 50);
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

    const bpm = this.musicMode === 'menu' ? 76 : this.musicMode === 'tension' ? 134 : 124;
    const sixteenth = 60 / bpm / 4;
    const lookahead = 0.18;

    if (this.nextStepTime < ctx.currentTime - 0.3) {
      this.nextStepTime = ctx.currentTime + 0.05;
    }

    const totalSteps = this.musicMode === 'menu' ? 256 : this.musicMode === 'tension' ? 256 : 512;

    while (this.nextStepTime < ctx.currentTime + lookahead) {
      const wrappedStep = this.stepIndex % totalSteps;
      if (this.musicMode === 'menu') {
        this.scheduleMenuOverture(wrappedStep, this.nextStepTime, sixteenth);
      } else if (this.musicMode === 'tension') {
        this.scheduleTensionReckoning(wrappedStep, this.nextStepTime, sixteenth);
      } else {
        this.scheduleBattleSymphony(wrappedStep, this.nextStepTime, sixteenth);
      }
      this.nextStepTime += sixteenth;
      this.stepIndex = (this.stepIndex + 1) % 512;
    }
  }

  /**
   * MENU OVERTURE: "Cathedral of the Shattered Sun" (76 BPM, 16-bar 2-section symphonic score)
   * Bars 0..7: Sanctum Awakening — Pipe Organ, Harp filigree, Tubular Bells, rising Formant Choir
   * Bars 8..15: March of the Champions — Sweeping Bowed Strings theme, French Horn counterpoint, Timpani
   */
  private scheduleMenuOverture(step: number, time: number, sixteenth: number): void {
    const bar = Math.floor(step / 16); // 0..15
    const s = step % 16;

    const chords: Array<{
      bass: number;
      organ: number[];
      choir: number[];
      arp: number[];
      vowel: 'ah' | 'ooh' | 'eh';
    }> = [
      // Section A (Bars 0-7): Dm -> Bb -> Gm -> A7 | Dm -> C -> Bb -> A7
      { bass: NOTE_FREQ.D2, organ: [NOTE_FREQ.D2, NOTE_FREQ.A2, NOTE_FREQ.D3, NOTE_FREQ.F3], choir: [NOTE_FREQ.D4, NOTE_FREQ.F4, NOTE_FREQ.A4], arp: [NOTE_FREQ.D4, NOTE_FREQ.A4, NOTE_FREQ.F4, NOTE_FREQ.D5, NOTE_FREQ.A4, NOTE_FREQ.F4, NOTE_FREQ.E4, NOTE_FREQ.D4], vowel: 'ooh' },
      { bass: NOTE_FREQ.Bb1, organ: [NOTE_FREQ.Bb1, NOTE_FREQ.F2, NOTE_FREQ.Bb2, NOTE_FREQ.D3], choir: [NOTE_FREQ.D4, NOTE_FREQ.F4, NOTE_FREQ.Bb4], arp: [NOTE_FREQ.Bb3, NOTE_FREQ.F4, NOTE_FREQ.D4, NOTE_FREQ.Bb4, NOTE_FREQ.A4, NOTE_FREQ.F4, NOTE_FREQ.D4, NOTE_FREQ.F4], vowel: 'ooh' },
      { bass: NOTE_FREQ.G1, organ: [NOTE_FREQ.G1, NOTE_FREQ.D2, NOTE_FREQ.G2, NOTE_FREQ.Bb2], choir: [NOTE_FREQ.D4, NOTE_FREQ.G4, NOTE_FREQ.Bb4], arp: [NOTE_FREQ.G3, NOTE_FREQ.D4, NOTE_FREQ.Bb4, NOTE_FREQ.G4, NOTE_FREQ.A4, NOTE_FREQ.G4, NOTE_FREQ.F4, NOTE_FREQ.D4], vowel: 'ooh' },
      { bass: NOTE_FREQ.A1, organ: [NOTE_FREQ.A1, NOTE_FREQ.E2, NOTE_FREQ.A2, NOTE_FREQ.Cs3], choir: [NOTE_FREQ.Cs4, NOTE_FREQ.E4, NOTE_FREQ.A4], arp: [NOTE_FREQ.A3, NOTE_FREQ.E4, NOTE_FREQ.A4, NOTE_FREQ.Cs5, NOTE_FREQ.A4, NOTE_FREQ.G4, NOTE_FREQ.E4, NOTE_FREQ.Cs4], vowel: 'ah' },

      { bass: NOTE_FREQ.D2, organ: [NOTE_FREQ.D2, NOTE_FREQ.A2, NOTE_FREQ.D3, NOTE_FREQ.F3], choir: [NOTE_FREQ.D4, NOTE_FREQ.F4, NOTE_FREQ.A4], arp: [NOTE_FREQ.D4, NOTE_FREQ.F4, NOTE_FREQ.A4, NOTE_FREQ.D5, NOTE_FREQ.F5, NOTE_FREQ.D5, NOTE_FREQ.A4, NOTE_FREQ.F4], vowel: 'ah' },
      { bass: NOTE_FREQ.C2, organ: [NOTE_FREQ.C2, NOTE_FREQ.G2, NOTE_FREQ.C3, NOTE_FREQ.E3], choir: [NOTE_FREQ.C4, NOTE_FREQ.E4, NOTE_FREQ.G4], arp: [NOTE_FREQ.C4, NOTE_FREQ.G4, NOTE_FREQ.E4, NOTE_FREQ.C5, NOTE_FREQ.G4, NOTE_FREQ.E4, NOTE_FREQ.D4, NOTE_FREQ.C4], vowel: 'ah' },
      { bass: NOTE_FREQ.Bb1, organ: [NOTE_FREQ.Bb1, NOTE_FREQ.F2, NOTE_FREQ.Bb2, NOTE_FREQ.D3], choir: [NOTE_FREQ.D4, NOTE_FREQ.F4, NOTE_FREQ.Bb4], arp: [NOTE_FREQ.Bb3, NOTE_FREQ.D4, NOTE_FREQ.F4, NOTE_FREQ.A4, NOTE_FREQ.Bb4, NOTE_FREQ.A4, NOTE_FREQ.F4, NOTE_FREQ.D4], vowel: 'ah' },
      { bass: NOTE_FREQ.A1, organ: [NOTE_FREQ.A1, NOTE_FREQ.E2, NOTE_FREQ.A2, NOTE_FREQ.Cs3], choir: [NOTE_FREQ.E4, NOTE_FREQ.A4, NOTE_FREQ.Cs5], arp: [NOTE_FREQ.A3, NOTE_FREQ.E4, NOTE_FREQ.A4, NOTE_FREQ.Cs5, NOTE_FREQ.E5, NOTE_FREQ.Cs5, NOTE_FREQ.A4, NOTE_FREQ.E4], vowel: 'ah' },

      // Section B (Bars 8-15): Grand Heroic Swell — Dm -> F -> C -> Gm | Bb -> C -> Dm -> A7 (Coronation)
      { bass: NOTE_FREQ.D2, organ: [NOTE_FREQ.D2, NOTE_FREQ.A2, NOTE_FREQ.D3, NOTE_FREQ.F3, NOTE_FREQ.A3], choir: [NOTE_FREQ.D4, NOTE_FREQ.F4, NOTE_FREQ.A4, NOTE_FREQ.D5], arp: [NOTE_FREQ.D4, NOTE_FREQ.A4, NOTE_FREQ.D5, NOTE_FREQ.F5, NOTE_FREQ.D5, NOTE_FREQ.A4, NOTE_FREQ.F4, NOTE_FREQ.A4], vowel: 'ah' },
      { bass: NOTE_FREQ.F2, organ: [NOTE_FREQ.F2, NOTE_FREQ.C3, NOTE_FREQ.F3, NOTE_FREQ.A3], choir: [NOTE_FREQ.C4, NOTE_FREQ.F4, NOTE_FREQ.A4, NOTE_FREQ.C5], arp: [NOTE_FREQ.F4, NOTE_FREQ.A4, NOTE_FREQ.C5, NOTE_FREQ.F5, NOTE_FREQ.C5, NOTE_FREQ.A4, NOTE_FREQ.F4, NOTE_FREQ.C4], vowel: 'ah' },
      { bass: NOTE_FREQ.C2, organ: [NOTE_FREQ.C2, NOTE_FREQ.G2, NOTE_FREQ.C3, NOTE_FREQ.E3, NOTE_FREQ.G3], choir: [NOTE_FREQ.C4, NOTE_FREQ.E4, NOTE_FREQ.G4, NOTE_FREQ.C5], arp: [NOTE_FREQ.C4, NOTE_FREQ.G4, NOTE_FREQ.C5, NOTE_FREQ.E5, NOTE_FREQ.C5, NOTE_FREQ.G4, NOTE_FREQ.E4, NOTE_FREQ.G4], vowel: 'ah' },
      { bass: NOTE_FREQ.G1, organ: [NOTE_FREQ.G1, NOTE_FREQ.D2, NOTE_FREQ.G2, NOTE_FREQ.Bb2, NOTE_FREQ.D3], choir: [NOTE_FREQ.D4, NOTE_FREQ.G4, NOTE_FREQ.Bb4], arp: [NOTE_FREQ.G3, NOTE_FREQ.Bb3, NOTE_FREQ.D4, NOTE_FREQ.G4, NOTE_FREQ.Bb4, NOTE_FREQ.G4, NOTE_FREQ.D4, NOTE_FREQ.Bb3], vowel: 'ooh' },

      { bass: NOTE_FREQ.Bb1, organ: [NOTE_FREQ.Bb1, NOTE_FREQ.F2, NOTE_FREQ.Bb2, NOTE_FREQ.D3, NOTE_FREQ.F3], choir: [NOTE_FREQ.D4, NOTE_FREQ.F4, NOTE_FREQ.Bb4, NOTE_FREQ.D5], arp: [NOTE_FREQ.Bb3, NOTE_FREQ.F4, NOTE_FREQ.Bb4, NOTE_FREQ.D5, NOTE_FREQ.F5, NOTE_FREQ.D5, NOTE_FREQ.Bb4, NOTE_FREQ.F4], vowel: 'ah' },
      { bass: NOTE_FREQ.C2, organ: [NOTE_FREQ.C2, NOTE_FREQ.G2, NOTE_FREQ.C3, NOTE_FREQ.E3, NOTE_FREQ.G3], choir: [NOTE_FREQ.E4, NOTE_FREQ.G4, NOTE_FREQ.C5, NOTE_FREQ.E5], arp: [NOTE_FREQ.C4, NOTE_FREQ.G4, NOTE_FREQ.C5, NOTE_FREQ.E5, NOTE_FREQ.G5, NOTE_FREQ.E5, NOTE_FREQ.C5, NOTE_FREQ.G4], vowel: 'ah' },
      { bass: NOTE_FREQ.D2, organ: [NOTE_FREQ.D2, NOTE_FREQ.A2, NOTE_FREQ.D3, NOTE_FREQ.F3, NOTE_FREQ.A3], choir: [NOTE_FREQ.D4, NOTE_FREQ.F4, NOTE_FREQ.A4, NOTE_FREQ.D5], arp: [NOTE_FREQ.D4, NOTE_FREQ.A4, NOTE_FREQ.D5, NOTE_FREQ.F5, NOTE_FREQ.A5, NOTE_FREQ.F5, NOTE_FREQ.D5, NOTE_FREQ.A4], vowel: 'ah' },
      { bass: NOTE_FREQ.A1, organ: [NOTE_FREQ.A1, NOTE_FREQ.E2, NOTE_FREQ.A2, NOTE_FREQ.Cs3, NOTE_FREQ.E3], choir: [NOTE_FREQ.E4, NOTE_FREQ.A4, NOTE_FREQ.Cs5], arp: [NOTE_FREQ.A3, NOTE_FREQ.E4, NOTE_FREQ.A4, NOTE_FREQ.Cs5, NOTE_FREQ.E5, NOTE_FREQ.Cs5, NOTE_FREQ.A4, NOTE_FREQ.E4], vowel: 'ooh' },
    ];
    const ch = chords[bar];
    const inGrand = bar >= 8;

    // 1. Grand Cathedral Pipe Organ + Formant Choir foundation on beat 1
    if (s === 0) {
      this.orchPipeOrgan(ch.organ, time, sixteenth * 16.4, inGrand ? 0.13 : 0.105, inGrand ? 2100 : 1350);
      if (bar >= 2) {
        this.orchChoir(ch.choir, time + 0.04, sixteenth * 15.8, inGrand ? 0.175 : 0.125, ch.vowel);
      }
      // Deep Contrabass bowed pedal
      this.orchStringLegato(ch.bass * 2, time, sixteenth * 15.5, inGrand ? 0.13 : 0.095, -0.35);
    }

    // 2. Cathedral Tubular Bells on structural arrivals
    if (s === 0 && (bar === 0 || bar === 4 || bar === 8 || bar === 12 || bar === 14)) {
      const bellNote = bar === 12 ? NOTE_FREQ.Bb4 : bar === 14 ? NOTE_FREQ.D5 : NOTE_FREQ.D4;
      this.orchTubularBell(bellNote, time, inGrand ? 0.125 : 0.095, 2.8, bar % 4 === 0 ? -0.32 : 0.32);
    }
    if (s === 0 && (bar === 8 || bar === 14)) {
      this.orchCymbal(time, 0.13, 2.4);
    }

    // 3. Arcane Harp arpeggio flowing across 8th notes
    if (s % 2 === 0) {
      const arpNote = ch.arp[(s / 2) % ch.arp.length];
      const pan = ((s / 2) % 2 === 0 ? -0.28 : 0.28);
      this.orchHarp(arpNote, time, sixteenth * 3.8, inGrand ? 0.08 : 0.068, pan);
    }

    // 4. Majestic Timpani Heartbeat & Rolls (builds through Section B)
    if (bar >= 4 && s === 0) {
      this.orchTimpani(ch.bass, time, inGrand ? 0.28 : 0.17, 0.65);
    }
    if (inGrand && (s === 8 || s === 12)) {
      this.orchTimpani(ch.bass, time, s === 8 ? 0.19 : 0.14, 0.45);
    }
    if ((bar === 7 || bar === 15) && (s === 12 || s === 13 || s === 14 || s === 15)) {
      this.orchTimpani(ch.bass, time, 0.12 + (s - 12) * 0.045, 0.25);
    }

    // 5. Soaring Legato Violins & French Horn Melody in Section B (Bars 8-15)
    if (inGrand) {
      const violinTheme: Record<number, Record<number, { n: number; len: number }>> = {
        8: { 0: { n: NOTE_FREQ.A4, len: 6 }, 6: { n: NOTE_FREQ.D5, len: 6 }, 12: { n: NOTE_FREQ.F5, len: 4 } },
        9: { 0: { n: NOTE_FREQ.E5, len: 4 }, 4: { n: NOTE_FREQ.F5, len: 4 }, 8: { n: NOTE_FREQ.C5, len: 8 } },
        10: { 0: { n: NOTE_FREQ.G5, len: 6 }, 6: { n: NOTE_FREQ.F5, len: 4 }, 10: { n: NOTE_FREQ.E5, len: 6 } },
        11: { 0: { n: NOTE_FREQ.D5, len: 8 }, 8: { n: NOTE_FREQ.Bb4, len: 4 }, 12: { n: NOTE_FREQ.A4, len: 4 } },
        12: { 0: { n: NOTE_FREQ.D5, len: 6 }, 6: { n: NOTE_FREQ.F5, len: 6 }, 12: { n: NOTE_FREQ.Bb5, len: 4 } },
        13: { 0: { n: NOTE_FREQ.A5, len: 6 }, 6: { n: NOTE_FREQ.G5, len: 4 }, 10: { n: NOTE_FREQ.E5, len: 6 } },
        14: { 0: { n: NOTE_FREQ.F5, len: 8 }, 8: { n: NOTE_FREQ.A5, len: 8 } },
        15: { 0: { n: NOTE_FREQ.E5, len: 10 }, 10: { n: NOTE_FREQ.Cs5, len: 6 } },
      };
      const vNote = violinTheme[bar]?.[s];
      if (vNote) {
        this.orchStringLegato(vNote.n, time, sixteenth * vNote.len * 1.04, 0.145, 0.22);
      }

      // Noble French Horn counter-calls
      const hornCalls: Record<number, Record<number, { n: number; len: number }>> = {
        8: { 0: { n: NOTE_FREQ.D4, len: 8 }, 8: { n: NOTE_FREQ.F4, len: 8 } },
        10: { 0: { n: NOTE_FREQ.E4, len: 8 }, 8: { n: NOTE_FREQ.C4, len: 8 } },
        12: { 0: { n: NOTE_FREQ.F4, len: 6 }, 6: { n: NOTE_FREQ.D4, len: 6 }, 12: { n: NOTE_FREQ.F4, len: 4 } },
        14: { 0: { n: NOTE_FREQ.D4, len: 8 }, 8: { n: NOTE_FREQ.A4, len: 8 } },
      };
      const hNote = hornCalls[bar]?.[s];
      if (hNote) {
        this.orchBrass(hNote.n, time, sixteenth * hNote.len * 0.98, 0.125, -0.26);
      }
    }
  }

  /**
   * BATTLE SYMPHONY: "Siege of the Reliquary" (124 BPM, 32-bar / 512-step 4-movement orchestral epic)
   * Movement I  (Bars  0..7): Gathering Storm (Dm) — Driving Spiccato Strings, War Drums, Pipe Organ
   * Movement II (Bars  8..15): Heroic Vanguard (Dm) — Soaring French Horn & Brass Main Theme, Marching Snares
   * Movement III(Bars 16..23): Cathedral Crusade (Modulation to G minor -> Eb -> F -> A7) — Towering Choir, Violins & Bells
   * Movement IV (Bars 24..31): Symphonic Tutti Finale (Dm) — Full Orchestra + Choir + Brass Climax + Anvil Strikes
   */
  private scheduleBattleSymphony(step: number, time: number, sixteenth: number): void {
    const bar = Math.floor(step / 16); // 0..31
    const s = step % 16;
    const movement = Math.floor(bar / 8); // 0, 1, 2, 3
    const mBar = bar % 8;

    type BarHarmony = {
      root: number;
      fifth: number;
      organ: number[];
      choir: number[];
      spiccato: number[];
      vowel: 'ah' | 'ooh' | 'eh';
    };

    const dmSuite: BarHarmony[] = [
      { root: NOTE_FREQ.D2, fifth: NOTE_FREQ.A2, organ: [NOTE_FREQ.D2, NOTE_FREQ.A2, NOTE_FREQ.D3, NOTE_FREQ.F3], choir: [NOTE_FREQ.D4, NOTE_FREQ.F4, NOTE_FREQ.A4], spiccato: [NOTE_FREQ.D3, NOTE_FREQ.F3, NOTE_FREQ.A3, NOTE_FREQ.D4], vowel: 'ah' },
      { root: NOTE_FREQ.Bb1, fifth: NOTE_FREQ.F2, organ: [NOTE_FREQ.Bb1, NOTE_FREQ.F2, NOTE_FREQ.Bb2, NOTE_FREQ.D3], choir: [NOTE_FREQ.D4, NOTE_FREQ.F4, NOTE_FREQ.Bb4], spiccato: [NOTE_FREQ.Bb2, NOTE_FREQ.D3, NOTE_FREQ.F3, NOTE_FREQ.Bb3], vowel: 'ah' },
      { root: NOTE_FREQ.C2, fifth: NOTE_FREQ.G2, organ: [NOTE_FREQ.C2, NOTE_FREQ.G2, NOTE_FREQ.C3, NOTE_FREQ.E3], choir: [NOTE_FREQ.C4, NOTE_FREQ.E4, NOTE_FREQ.G4], spiccato: [NOTE_FREQ.C3, NOTE_FREQ.E3, NOTE_FREQ.G3, NOTE_FREQ.C4], vowel: 'eh' },
      { root: NOTE_FREQ.A1, fifth: NOTE_FREQ.E2, organ: [NOTE_FREQ.A1, NOTE_FREQ.E2, NOTE_FREQ.A2, NOTE_FREQ.C3], choir: [NOTE_FREQ.C4, NOTE_FREQ.E4, NOTE_FREQ.A4], spiccato: [NOTE_FREQ.A2, NOTE_FREQ.C3, NOTE_FREQ.E3, NOTE_FREQ.A3], vowel: 'ooh' },
      { root: NOTE_FREQ.D2, fifth: NOTE_FREQ.A2, organ: [NOTE_FREQ.D2, NOTE_FREQ.A2, NOTE_FREQ.D3, NOTE_FREQ.F3], choir: [NOTE_FREQ.D4, NOTE_FREQ.F4, NOTE_FREQ.A4], spiccato: [NOTE_FREQ.D3, NOTE_FREQ.F3, NOTE_FREQ.A3, NOTE_FREQ.D4], vowel: 'ah' },
      { root: NOTE_FREQ.G1, fifth: NOTE_FREQ.D2, organ: [NOTE_FREQ.G1, NOTE_FREQ.D2, NOTE_FREQ.G2, NOTE_FREQ.Bb2], choir: [NOTE_FREQ.D4, NOTE_FREQ.G4, NOTE_FREQ.Bb4], spiccato: [NOTE_FREQ.G2, NOTE_FREQ.Bb2, NOTE_FREQ.D3, NOTE_FREQ.G3], vowel: 'ah' },
      { root: NOTE_FREQ.Bb1, fifth: NOTE_FREQ.F2, organ: [NOTE_FREQ.Bb1, NOTE_FREQ.F2, NOTE_FREQ.Bb2, NOTE_FREQ.D3], choir: [NOTE_FREQ.F4, NOTE_FREQ.Bb4, NOTE_FREQ.D5], spiccato: [NOTE_FREQ.Bb2, NOTE_FREQ.D3, NOTE_FREQ.F3, NOTE_FREQ.Bb3], vowel: 'ah' },
      { root: NOTE_FREQ.A1, fifth: NOTE_FREQ.E2, organ: [NOTE_FREQ.A1, NOTE_FREQ.E2, NOTE_FREQ.A2, NOTE_FREQ.Cs3], choir: [NOTE_FREQ.E4, NOTE_FREQ.A4, NOTE_FREQ.Cs5], spiccato: [NOTE_FREQ.A2, NOTE_FREQ.Cs3, NOTE_FREQ.E3, NOTE_FREQ.A3], vowel: 'eh' },
    ];

    // Movement III Modulation: G minor -> Eb -> F -> Dm | Gm -> Eb -> Bb -> A7 (lifts back to Dm!)
    const gmCrusade: BarHarmony[] = [
      { root: NOTE_FREQ.G1, fifth: NOTE_FREQ.D2, organ: [NOTE_FREQ.G1, NOTE_FREQ.D2, NOTE_FREQ.G2, NOTE_FREQ.Bb2], choir: [NOTE_FREQ.G4, NOTE_FREQ.Bb4, NOTE_FREQ.D5], spiccato: [NOTE_FREQ.G3, NOTE_FREQ.Bb3, NOTE_FREQ.D4, NOTE_FREQ.G4], vowel: 'ah' },
      { root: NOTE_FREQ.Eb2, fifth: NOTE_FREQ.Bb2, organ: [NOTE_FREQ.Eb2, NOTE_FREQ.Bb2, NOTE_FREQ.Eb3, NOTE_FREQ.G3], choir: [NOTE_FREQ.G4, NOTE_FREQ.Bb4, NOTE_FREQ.Eb5], spiccato: [NOTE_FREQ.Eb3, NOTE_FREQ.G3, NOTE_FREQ.Bb3, NOTE_FREQ.Eb4], vowel: 'ah' },
      { root: NOTE_FREQ.F2, fifth: NOTE_FREQ.C3, organ: [NOTE_FREQ.F2, NOTE_FREQ.C3, NOTE_FREQ.F3, NOTE_FREQ.A3], choir: [NOTE_FREQ.F4, NOTE_FREQ.A4, NOTE_FREQ.C5], spiccato: [NOTE_FREQ.F3, NOTE_FREQ.A3, NOTE_FREQ.C4, NOTE_FREQ.F4], vowel: 'ah' },
      { root: NOTE_FREQ.D2, fifth: NOTE_FREQ.A2, organ: [NOTE_FREQ.D2, NOTE_FREQ.A2, NOTE_FREQ.D3, NOTE_FREQ.F3], choir: [NOTE_FREQ.F4, NOTE_FREQ.A4, NOTE_FREQ.D5], spiccato: [NOTE_FREQ.D3, NOTE_FREQ.F3, NOTE_FREQ.A3, NOTE_FREQ.D4], vowel: 'ooh' },
      { root: NOTE_FREQ.G1, fifth: NOTE_FREQ.D2, organ: [NOTE_FREQ.G1, NOTE_FREQ.D2, NOTE_FREQ.G2, NOTE_FREQ.Bb2], choir: [NOTE_FREQ.G4, NOTE_FREQ.Bb4, NOTE_FREQ.D5], spiccato: [NOTE_FREQ.G3, NOTE_FREQ.Bb3, NOTE_FREQ.D4, NOTE_FREQ.G4], vowel: 'ah' },
      { root: NOTE_FREQ.Eb2, fifth: NOTE_FREQ.Bb2, organ: [NOTE_FREQ.Eb2, NOTE_FREQ.Bb2, NOTE_FREQ.Eb3, NOTE_FREQ.G3], choir: [NOTE_FREQ.G4, NOTE_FREQ.Bb4, NOTE_FREQ.Eb5], spiccato: [NOTE_FREQ.Eb3, NOTE_FREQ.G3, NOTE_FREQ.Bb3, NOTE_FREQ.Eb4], vowel: 'ah' },
      { root: NOTE_FREQ.Bb1, fifth: NOTE_FREQ.F2, organ: [NOTE_FREQ.Bb1, NOTE_FREQ.F2, NOTE_FREQ.Bb2, NOTE_FREQ.D3], choir: [NOTE_FREQ.F4, NOTE_FREQ.Bb4, NOTE_FREQ.D5], spiccato: [NOTE_FREQ.Bb2, NOTE_FREQ.D3, NOTE_FREQ.F3, NOTE_FREQ.Bb3], vowel: 'ah' },
      { root: NOTE_FREQ.A1, fifth: NOTE_FREQ.E2, organ: [NOTE_FREQ.A1, NOTE_FREQ.E2, NOTE_FREQ.A2, NOTE_FREQ.Cs3], choir: [NOTE_FREQ.E4, NOTE_FREQ.A4, NOTE_FREQ.Cs5], spiccato: [NOTE_FREQ.A2, NOTE_FREQ.Cs3, NOTE_FREQ.E3, NOTE_FREQ.A3], vowel: 'eh' },
    ];

    const h = movement === 2 ? gmCrusade[mBar] : dmSuite[mBar];

    // 1. CINEMATIC WAR PERCUSSION (Taiko + Tuned Timpani + Marching Snare + Cymbals + Anvil)
    const taikoHits = movement === 3 ? [0, 3, 6, 8, 10, 14] : [0, 6, 8, 14];
    if (taikoHits.includes(s)) {
      this.orchTaiko(time, s === 0 || s === 8 ? 0.36 : 0.23, s === 0 ? 96 : 112);
    }
    if (s === 0 || (movement >= 2 && s === 10)) {
      this.orchTimpani(h.root, time, s === 0 ? 0.3 : 0.2, 0.45);
    }
    // Marching orchestral snare groove
    if (s === 4 || s === 12) {
      this.orchSnare(time, movement >= 1 ? 0.21 : 0.14, false);
    } else if (movement >= 1 && (s === 7 || s === 11 || s === 15)) {
      this.orchSnare(time, 0.08, true); // crisp ghost cadence
    }
    // Dramatic bar-end Timpani + Snare crescendo turnarounds
    if ((mBar === 3 || mBar === 7) && s >= 12) {
      this.orchTimpani(s === 15 ? h.fifth : h.root, time, 0.16 + (s - 12) * 0.05, 0.22);
      if (s >= 13) this.orchSnare(time, 0.12 + (s - 13) * 0.04, true);
    }
    // Crash cymbals at movement entries & phrase peaks
    if (s === 0 && (mBar === 0 || (mBar === 4 && movement >= 1))) {
      this.orchCymbal(time, movement === 3 ? 0.2 : 0.14, 1.9);
    }
    // Gothic Iron Anvil strikes in Crusade & Finale movements
    if (movement >= 2 && (s === 4 || (movement === 3 && s === 12))) {
      this.orchAnvil(time, movement === 3 ? 0.095 : 0.065, s === 4 ? -0.35 : 0.35);
    }

    // 2. DRIVING 16TH-NOTE SPICCATO STRING OSTINATO (Hollywood epic momentum!)
    const spiccPattern = [0, 1, 2, 1, 3, 2, 1, 2, 0, 1, 2, 3, 2, 1, 2, 1];
    const playSpicc =
      movement === 0 ? s % 2 === 0 || s === 3 || s === 11 : true;
    if (playSpicc) {
      const spFreq = h.spiccato[spiccPattern[s]];
      const accent = s % 4 === 0 ? 1.25 : s % 2 === 0 ? 0.92 : 0.68;
      this.orchSpiccato(
        spFreq,
        time,
        sixteenth * 1.15,
        (movement === 3 ? 0.115 : 0.095) * accent,
        s % 2 === 0 ? -0.32 : 0.32
      );
    }

    // 3. DEEP CONTRABASS & LOW BRASS FOUNDATION
    if (s === 0 || s === 8) {
      const lowFreq = s === 8 && mBar % 2 === 1 ? h.fifth : h.root;
      this.orchLowBass(lowFreq, time, sixteenth * 7.6, movement === 3 ? 0.21 : 0.175);
    }

    // 4. GRAND CATHEDRAL PIPE ORGAN + FORMANT CHOIR
    if (s === 0) {
      this.orchPipeOrgan(
        h.organ,
        time,
        sixteenth * 15.6,
        movement === 3 ? 0.13 : 0.105,
        movement >= 2 ? 2250 : 1550
      );
      if (movement >= 2 || (movement === 1 && mBar >= 4)) {
        this.orchChoir(
          h.choir,
          time + 0.02,
          sixteenth * 15.2,
          movement === 3 ? 0.2 : 0.165,
          h.vowel
        );
      }
    }

    // Cathedral Bell toll in Crusade & Finale
    if (s === 0 && movement >= 2 && mBar % 2 === 0) {
      this.orchTubularBell(h.root * 4, time, 0.1, 2.2, mBar % 4 === 0 ? -0.38 : 0.38);
    }

    // 5. SOARING MELODIC THEMES PER MOVEMENT
    if (movement === 0) {
      // Movement I: Arcane Harp & Cello anticipation motif
      if (s === 0 || s === 3 || s === 6 || s === 8 || s === 11 || s === 14) {
        const idx = s === 0 ? 0 : s === 3 ? 1 : s === 6 ? 2 : s === 8 ? 3 : s === 11 ? 2 : 1;
        this.orchHarp(h.spiccato[idx] * 2, time, sixteenth * 2.6, 0.082, idx % 2 === 0 ? -0.25 : 0.25);
      }
    } else if (movement === 1 || movement === 3) {
      // Movement II & IV: HEROIC FRENCH HORN & BRASS ANTHEM (plus Octave Violins in Movement IV!)
      const heroicTheme: Record<number, Record<number, { n: number; len: number }>> = {
        0: { 0: { n: NOTE_FREQ.D4, len: 3 }, 3: { n: NOTE_FREQ.F4, len: 3 }, 6: { n: NOTE_FREQ.A4, len: 6 }, 12: { n: NOTE_FREQ.G4, len: 4 } },
        1: { 0: { n: NOTE_FREQ.F4, len: 6 }, 6: { n: NOTE_FREQ.D4, len: 4 }, 10: { n: NOTE_FREQ.F4, len: 6 } },
        2: { 0: { n: NOTE_FREQ.G4, len: 3 }, 3: { n: NOTE_FREQ.A4, len: 3 }, 6: { n: NOTE_FREQ.C5, len: 6 }, 12: { n: NOTE_FREQ.G4, len: 4 } },
        3: { 0: { n: NOTE_FREQ.A4, len: 10 }, 10: { n: NOTE_FREQ.G4, len: 2 }, 12: { n: NOTE_FREQ.E4, len: 4 } },
        4: { 0: { n: NOTE_FREQ.D4, len: 3 }, 3: { n: NOTE_FREQ.F4, len: 3 }, 6: { n: NOTE_FREQ.A4, len: 4 }, 10: { n: NOTE_FREQ.D5, len: 6 } },
        5: { 0: { n: NOTE_FREQ.Bb4, len: 6 }, 6: { n: NOTE_FREQ.A4, len: 4 }, 10: { n: NOTE_FREQ.G4, len: 6 } },
        6: { 0: { n: NOTE_FREQ.F4, len: 3 }, 3: { n: NOTE_FREQ.A4, len: 3 }, 6: { n: NOTE_FREQ.D5, len: 6 }, 12: { n: NOTE_FREQ.C5, len: 4 } },
        7: { 0: { n: NOTE_FREQ.A4, len: 6 }, 6: { n: NOTE_FREQ.G4, len: 2 }, 8: { n: NOTE_FREQ.A4, len: 4 }, 12: { n: NOTE_FREQ.Cs5, len: 4 } },
      };
      const hit = heroicTheme[mBar]?.[s];
      if (hit) {
        this.orchBrass(hit.n, time, sixteenth * hit.len * 0.96, movement === 3 ? 0.19 : 0.165, 0.15);
        if (movement === 3) {
          // Soaring high octave violins double the brass in the Finale!
          this.orchStringLegato(hit.n * 2, time, sixteenth * hit.len * 1.05, 0.115, -0.22);
        }
      }
    } else if (movement === 2) {
      // Movement III: CATHEDRAL CRUSADE — Sweeping Violin melody in G minor + Brass counter-stabs
      const crusadeTheme: Record<number, Record<number, { n: number; len: number }>> = {
        0: { 0: { n: NOTE_FREQ.G5, len: 6 }, 6: { n: NOTE_FREQ.F5, len: 4 }, 10: { n: NOTE_FREQ.D5, len: 6 } },
        1: { 0: { n: NOTE_FREQ.Eb5, len: 6 }, 6: { n: NOTE_FREQ.G5, len: 6 }, 12: { n: NOTE_FREQ.F5, len: 4 } },
        2: { 0: { n: NOTE_FREQ.A5, len: 8 }, 8: { n: NOTE_FREQ.F5, len: 4 }, 12: { n: NOTE_FREQ.C5, len: 4 } },
        3: { 0: { n: NOTE_FREQ.D5, len: 12 }, 12: { n: NOTE_FREQ.F5, len: 4 } },
        4: { 0: { n: NOTE_FREQ.G5, len: 4 }, 4: { n: NOTE_FREQ.A5, len: 4 }, 8: { n: NOTE_FREQ.Bb5, len: 8 } },
        5: { 0: { n: NOTE_FREQ.G5, len: 6 }, 6: { n: NOTE_FREQ.F5, len: 4 }, 10: { n: NOTE_FREQ.Eb5, len: 6 } },
        6: { 0: { n: NOTE_FREQ.F5, len: 6 }, 6: { n: NOTE_FREQ.D5, len: 6 }, 12: { n: NOTE_FREQ.Bb4, len: 4 } },
        7: { 0: { n: NOTE_FREQ.E5, len: 8 }, 8: { n: NOTE_FREQ.Cs5, len: 8 } },
      };
      const vHit = crusadeTheme[mBar]?.[s];
      if (vHit) {
        this.orchStringLegato(vHit.n, time, sixteenth * vHit.len * 1.06, 0.145, 0.24);
      }
      if (s === 0 || s === 10) {
        this.orchBrass(h.root * 2, time, sixteenth * 3.2, 0.13, -0.2);
      }
    }
  }

  /**
   * TENSION OVERDRIVE: "Final Reckoning" (134 BPM, 16-bar high-stakes siege score)
   * Plays when an Ancient Core's shield drops or Wave Tier V+ arrives.
   */
  private scheduleTensionReckoning(step: number, time: number, sixteenth: number): void {
    const bar = Math.floor(step / 16); // 0..15
    const s = step % 16;

    const tensionProg = [
      { root: NOTE_FREQ.D2, organ: [NOTE_FREQ.D2, NOTE_FREQ.A2, NOTE_FREQ.D3, NOTE_FREQ.F3], choir: [NOTE_FREQ.D4, NOTE_FREQ.F4, NOTE_FREQ.A4, NOTE_FREQ.D5], spicc: [NOTE_FREQ.D3, NOTE_FREQ.F3, NOTE_FREQ.A3, NOTE_FREQ.D4] },
      { root: NOTE_FREQ.Eb2, organ: [NOTE_FREQ.Eb2, NOTE_FREQ.Bb2, NOTE_FREQ.Eb3, NOTE_FREQ.G3], choir: [NOTE_FREQ.Eb4, NOTE_FREQ.G4, NOTE_FREQ.Bb4, NOTE_FREQ.Eb5], spicc: [NOTE_FREQ.Eb3, NOTE_FREQ.G3, NOTE_FREQ.Bb3, NOTE_FREQ.Eb4] },
      { root: NOTE_FREQ.C2, organ: [NOTE_FREQ.C2, NOTE_FREQ.G2, NOTE_FREQ.C3, NOTE_FREQ.E3], choir: [NOTE_FREQ.C4, NOTE_FREQ.E4, NOTE_FREQ.G4, NOTE_FREQ.C5], spicc: [NOTE_FREQ.C3, NOTE_FREQ.E3, NOTE_FREQ.G3, NOTE_FREQ.C4] },
      { root: NOTE_FREQ.A1, organ: [NOTE_FREQ.A1, NOTE_FREQ.E2, NOTE_FREQ.A2, NOTE_FREQ.Cs3], choir: [NOTE_FREQ.E4, NOTE_FREQ.A4, NOTE_FREQ.Cs5], spicc: [NOTE_FREQ.A2, NOTE_FREQ.Cs3, NOTE_FREQ.E3, NOTE_FREQ.A3] },
    ];
    const h = tensionProg[bar % 4];

    // Relentless double-time Taiko + Timpani + Snare + Anvil siege rhythm
    if (s === 0 || s === 3 || s === 6 || s === 8 || s === 11 || s === 14) {
      this.orchTaiko(time, s === 0 || s === 8 ? 0.38 : 0.25, s === 0 ? 94 : 114);
    }
    if (s === 0 || s === 6 || s === 12) {
      this.orchTimpani(h.root, time, s === 0 ? 0.32 : 0.22, 0.38);
    }
    if (s === 4 || s === 12) {
      this.orchSnare(time, 0.24, false);
      this.orchAnvil(time, 0.095, s === 4 ? -0.36 : 0.36);
    } else if (s % 2 === 1) {
      this.orchSnare(time, 0.075, true);
    }
    if (s === 0 && bar % 4 === 0) {
      this.orchCymbal(time, 0.22, 1.9);
      this.orchTubularBell(NOTE_FREQ.D4, time, 0.12, 2.2, 0.28);
    }

    // Relentless 16th-note spiccato strings
    const spFreq = h.spicc[s % 4] * (s >= 8 ? 2 : 1);
    this.orchSpiccato(spFreq, time, sixteenth * 1.05, s % 4 === 0 ? 0.13 : 0.09, s % 2 === 0 ? -0.35 : 0.35);

    // Urgent Choir & Pipe Organ half-bar stabs
    if (s === 0 || s === 8) {
      this.orchLowBass(h.root, time, sixteenth * 7.2, 0.22);
      this.orchPipeOrgan(h.organ, time, sixteenth * 7.6, 0.125, 2500);
      this.orchChoir(h.choir, time, sixteenth * 7.4, 0.19, s === 0 ? 'ah' : 'eh');
    }

    // Blazing Brass Battle Call
    const callNotes = [NOTE_FREQ.D5, NOTE_FREQ.F5, NOTE_FREQ.Eb5, NOTE_FREQ.Cs5];
    if (s === 0 || s === 3 || s === 6 || s === 10) {
      const baseN = callNotes[bar % 4];
      const n = s === 3 ? baseN * 1.122 : s === 6 ? baseN * 1.25 : s === 10 ? baseN * 0.89 : baseN;
      this.orchBrass(n, time, sixteenth * 2.6, 0.18, s % 2 === 0 ? 0.22 : -0.22);
    }
  }

  // === SYMPHONIC ORCHESTRAL INSTRUMENT VOICES ===

  private connectWithPan(
    node: AudioNode,
    pan: number,
    dest: GainNode,
    reverbAmt = 0
  ): void {
    const ctx = this.ctx!;
    let out: AudioNode = node;
    if (typeof ctx.createStereoPanner === 'function' && pan !== 0) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-0.85, Math.min(0.85, pan));
      node.connect(panner);
      out = panner;
    }
    out.connect(dest);
    if (reverbAmt > 0 && this.reverbSend) {
      const wet = ctx.createGain();
      wet.gain.value = reverbAmt;
      out.connect(wet);
      wet.connect(this.reverbSend);
    }
  }

  /** Grand Cathedral Pipe Organ (16' Sub + 8' Principal + 4' Octave + 2 2/3' Nazard stops) */
  private orchPipeOrgan(
    freqs: number[],
    time: number,
    dur: number,
    vol: number,
    cutoff: number,
    dest?: GainNode
  ): void {
    const ctx = this.ctx;
    const target = dest ?? this.musicBus;
    if (!ctx || !target) return;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.75;
    lp.frequency.setValueAtTime(cutoff * 0.72, time);
    lp.frequency.linearRampToValueAtTime(cutoff, time + Math.min(0.28, dur * 0.3));
    lp.frequency.exponentialRampToValueAtTime(Math.max(280, cutoff * 0.55), time + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vol, time + Math.min(0.11, dur * 0.18));
    g.gain.setValueAtTime(vol * 0.92, time + Math.max(0.12, dur * 0.82));
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    freqs.forEach((f, idx) => {
      // 8' Principal (rich sawtooth)
      const p8 = ctx.createOscillator();
      p8.type = 'sawtooth';
      p8.frequency.setValueAtTime(f * (idx % 2 === 0 ? 0.9985 : 1.0018), time);
      p8.connect(lp);
      p8.start(time);
      p8.stop(time + dur + 0.05);

      // 4' Octave stop (warm triangle, gives bright cathedral pipe sheen)
      const p4 = ctx.createOscillator();
      p4.type = 'triangle';
      p4.frequency.setValueAtTime(f * 2.002, time);
      const p4g = ctx.createGain();
      p4g.gain.value = 0.42;
      p4.connect(p4g);
      p4g.connect(lp);
      p4.start(time);
      p4.stop(time + dur + 0.05);

      // 2 2/3' Nazard/Quint harmonic on root & fifth for unmistakable Gothic pipe timbre
      if (idx === 0 || idx === 1) {
        const quint = ctx.createOscillator();
        quint.type = 'sine';
        quint.frequency.setValueAtTime(f * 3, time);
        const qg = ctx.createGain();
        qg.gain.value = 0.16;
        quint.connect(qg);
        qg.connect(lp);
        quint.start(time);
        quint.stop(time + dur + 0.05);
      }
    });

    lp.connect(g);
    this.connectWithPan(g, 0, target, 0.48);
  }

  /** Real Formant-Filtered Cathedral Choir (detuned sawtooth chorus through 3 vowel bandpass formants) */
  private orchChoir(
    freqs: number[],
    time: number,
    dur: number,
    vol: number,
    vowel: 'ah' | 'ooh' | 'eh',
    dest?: GainNode
  ): void {
    const ctx = this.ctx;
    const target = dest ?? this.musicBus;
    if (!ctx || !target) return;

    const [f1, f2, f3] = VOWEL_FORMANTS[vowel];
    const sourceBus = ctx.createGain();
    sourceBus.gain.value = 1 / Math.max(1.5, Math.sqrt(freqs.length));

    // Gentle human vocal vibrato (5.3 Hz)
    const vib = ctx.createOscillator();
    vib.type = 'sine';
    vib.frequency.setValueAtTime(5.3, time);
    const vibGain = ctx.createGain();
    vibGain.gain.setValueAtTime(0.001, time);
    vibGain.gain.linearRampToValueAtTime(3.2, time + Math.min(0.45, dur * 0.4));
    vib.connect(vibGain);
    vib.start(time);
    vib.stop(time + dur + 0.08);

    for (const f of freqs) {
      for (const detune of [-7, 6.5]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, time);
        osc.detune.setValueAtTime(detune, time);
        vibGain.connect(osc.frequency);
        osc.connect(sourceBus);
        osc.start(time);
        osc.stop(time + dur + 0.08);
      }
    }

    const outGain = ctx.createGain();
    outGain.gain.setValueAtTime(0.0001, time);
    outGain.gain.linearRampToValueAtTime(vol, time + Math.min(0.28, dur * 0.32));
    outGain.gain.setValueAtTime(vol * 0.9, time + Math.max(0.3, dur * 0.76));
    outGain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    // 3 parallel vocal tract formant resonators
    const formants: Array<{ freq: number; q: number; gain: number }> = [
      { freq: f1, q: 4.5, gain: 0.95 },
      { freq: f2, q: 6.2, gain: 0.65 },
      { freq: f3, q: 7.5, gain: 0.28 },
    ];
    for (const fm of formants) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(fm.freq, time);
      bp.Q.value = fm.q;
      const fg = ctx.createGain();
      fg.gain.value = fm.gain;
      sourceBus.connect(bp);
      bp.connect(fg);
      fg.connect(outGain);
    }

    this.connectWithPan(outGain, 0, target, 0.58);
  }

  /** Sweeping Bowed Legato Symphonic Strings with warm vibrato */
  private orchStringLegato(
    freq: number,
    time: number,
    dur: number,
    vol: number,
    pan = 0,
    dest?: GainNode
  ): void {
    const ctx = this.ctx;
    const target = dest ?? this.musicBus;
    if (!ctx || !target) return;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 1.1;
    lp.frequency.setValueAtTime(Math.min(3400, freq * 3.8), time);
    lp.frequency.linearRampToValueAtTime(Math.min(4600, freq * 5.2), time + dur * 0.45);
    lp.frequency.exponentialRampToValueAtTime(Math.max(420, freq * 2.2), time + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vol, time + Math.min(0.16, dur * 0.28));
    g.gain.setValueAtTime(vol * 0.88, time + Math.max(0.18, dur * 0.78));
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    const vib = ctx.createOscillator();
    vib.type = 'sine';
    vib.frequency.setValueAtTime(5.6, time);
    const vibG = ctx.createGain();
    vibG.gain.setValueAtTime(0.001, time);
    vibG.gain.linearRampToValueAtTime(freq * 0.006, time + Math.min(0.28, dur * 0.4));
    vib.connect(vibG);
    vib.start(time);
    vib.stop(time + dur + 0.05);

    for (const det of [-8, 0, 8.5]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);
      osc.detune.setValueAtTime(det, time);
      vibG.connect(osc.frequency);
      osc.connect(lp);
      osc.start(time);
      osc.stop(time + dur + 0.05);
    }

    lp.connect(g);
    this.connectWithPan(g, pan, target, 0.44);
  }

  /** Crisp Short-Bowed 16th-Note Spiccato Strings (epic orchestral battle momentum) */
  private orchSpiccato(freq: number, time: number, dur: number, vol: number, pan = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;

    const bp = ctx.createBiquadFilter();
    bp.type = 'lowpass';
    bp.Q.value = 1.6;
    bp.frequency.setValueAtTime(Math.min(3600, freq * 5.2), time);
    bp.frequency.exponentialRampToValueAtTime(Math.max(360, freq * 1.9), time + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.014);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    for (const det of [-5.5, 5.5]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);
      osc.detune.setValueAtTime(det, time);
      osc.connect(bp);
      osc.start(time);
      osc.stop(time + dur + 0.02);
    }

    bp.connect(g);
    this.connectWithPan(g, pan, this.musicBus, 0.24);
  }

  /** Heroic French Horn & Orchestral Brass Ensemble (warm saturation + brass attack flare) */
  private orchBrass(
    freq: number,
    time: number,
    dur: number,
    vol: number,
    pan = 0,
    dest?: GainNode
  ): void {
    const ctx = this.ctx;
    const target = dest ?? this.musicBus;
    if (!ctx || !target) return;

    const shaper = ctx.createWaveShaper();
    shaper.curve = this.brassWarmCurve;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 1.9;
    // Characteristic brass flare: filter blooms open on attack, then settles warmly
    lp.frequency.setValueAtTime(Math.max(320, freq * 1.3), time);
    lp.frequency.exponentialRampToValueAtTime(Math.min(4200, freq * 6.5), time + Math.min(0.085, dur * 0.25));
    lp.frequency.exponentialRampToValueAtTime(Math.max(480, freq * 2.4), time + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.032);
    g.gain.setValueAtTime(vol * 0.85, time + Math.max(0.05, dur * 0.72));
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    for (const det of [-6, 5.5]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);
      osc.detune.setValueAtTime(det, time);
      osc.connect(shaper);
      osc.start(time);
      osc.stop(time + dur + 0.04);
    }

    shaper.connect(lp);
    lp.connect(g);
    this.connectWithPan(g, pan, target, 0.42);
  }

  /** Deep Contrabass & Tuba Foundation */
  private orchLowBass(freq: number, time: number, dur: number, vol: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 1.4;
    lp.frequency.setValueAtTime(420, time);
    lp.frequency.exponentialRampToValueAtTime(160, time + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.setValueAtTime(freq, time);
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(freq, time);

    saw.connect(lp);
    sub.connect(lp);
    lp.connect(g);
    g.connect(this.musicBus);

    saw.start(time);
    sub.start(time);
    saw.stop(time + dur + 0.03);
    sub.stop(time + dur + 0.03);
  }

  /** Tuned Orchestral Timpani matching chord roots */
  private orchTimpani(
    rootFreq: number,
    time: number,
    vol: number,
    dur = 0.55,
    dest?: GainNode
  ): void {
    const ctx = this.ctx;
    const target = dest ?? this.musicBus;
    if (!ctx || !target) return;

    const baseHz = Math.max(55, Math.min(140, rootFreq));
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseHz * 1.42, time);
    osc.frequency.exponentialRampToValueAtTime(baseHz, time + 0.065);
    osc.frequency.exponentialRampToValueAtTime(baseHz * 0.96, time + dur);

    // Kettle drum overtone membrane
    const ov = ctx.createOscillator();
    ov.type = 'triangle';
    ov.frequency.setValueAtTime(baseHz * 1.98, time);
    ov.frequency.exponentialRampToValueAtTime(baseHz * 1.5, time + dur * 0.5);
    const ovg = ctx.createGain();
    ovg.gain.setValueAtTime(vol * 0.28, time);
    ovg.gain.exponentialRampToValueAtTime(0.0001, time + dur * 0.45);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    osc.connect(g);
    ov.connect(ovg);
    ovg.connect(g);
    this.connectWithPan(g, -0.18, target, 0.34);

    osc.start(time);
    ov.start(time);
    osc.stop(time + dur + 0.03);
    ov.stop(time + dur + 0.03);
  }

  /** Deep Cinematic Taiko War Drum */
  private orchTaiko(time: number, vol: number, startHz = 104): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startHz, time);
    osc.frequency.exponentialRampToValueAtTime(34, time + 0.16);

    const shaper = ctx.createWaveShaper();
    shaper.curve = this.softClipCurve;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.25);

    osc.connect(shaper);
    shaper.connect(g);
    this.connectWithPan(g, 0, this.musicBus, 0.22);
    osc.start(time);
    osc.stop(time + 0.27);

    // Drumhead slap transient
    if (this.brownNoise) {
      const src = ctx.createBufferSource();
      src.buffer = this.brownNoise;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(420, time);
      bp.Q.value = 1.0;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(vol * 0.45, time);
      ng.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
      src.connect(bp);
      bp.connect(ng);
      ng.connect(this.musicBus);
      src.start(time, Math.random() * 0.6, 0.1);
      src.stop(time + 0.11);
    }
  }

  /** Orchestral Marching Snare */
  private orchSnare(time: number, vol: number, ghost = false, dest?: GainNode): void {
    const ctx = this.ctx;
    const target = dest ?? this.musicBus;
    if (!ctx || !target || !this.pinkNoise) return;

    const dur = ghost ? 0.075 : 0.16;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(215, time);
    osc.frequency.exponentialRampToValueAtTime(118, time + 0.055);
    const og = ctx.createGain();
    og.gain.setValueAtTime(vol * 0.55, time);
    og.gain.exponentialRampToValueAtTime(0.0001, time + dur * 0.6);
    osc.connect(og);
    og.connect(target);
    osc.start(time);
    osc.stop(time + dur);

    const src = ctx.createBufferSource();
    src.buffer = this.pinkNoise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2200, time);
    bp.Q.value = 0.85;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vol, time);
    ng.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(bp);
    bp.connect(ng);
    this.connectWithPan(ng, 0.14, target, ghost ? 0.12 : 0.28);
    src.start(time, Math.random() * 0.6, dur + 0.02);
    src.stop(time + dur + 0.03);
  }

  /** Shimmering Orchestral Crash Cymbal */
  private orchCymbal(time: number, vol: number, dur = 1.9, dest?: GainNode): void {
    const ctx = this.ctx;
    const target = dest ?? this.musicBus;
    if (!ctx || !target || !this.whiteNoise) return;

    const src = ctx.createBufferSource();
    src.buffer = this.whiteNoise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(4200, time);
    const pk = ctx.createBiquadFilter();
    pk.type = 'peaking';
    pk.frequency.setValueAtTime(7600, time);
    pk.gain.value = 4;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    src.connect(hp);
    hp.connect(pk);
    pk.connect(g);
    this.connectWithPan(g, 0.2, target, 0.45);
    src.start(time, Math.random() * 0.2, Math.min(1.45, dur));
    src.stop(time + Math.min(1.48, dur));
  }

  /** Metallic Cathedral Anvil Strike */
  private orchAnvil(time: number, vol: number, pan = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const partials = [1180, 1790, 2640, 3890];
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.42);

    partials.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, time);
      const pg = ctx.createGain();
      pg.gain.value = 1 / (idx + 1);
      osc.connect(pg);
      pg.connect(g);
      osc.start(time);
      osc.stop(time + 0.45);
    });
    this.connectWithPan(g, pan, this.musicBus, 0.42);
  }

  /** FM Tubular Cathedral Bell (inharmonic bronze strike + cathedral bloom) */
  private orchTubularBell(
    freq: number,
    time: number,
    vol: number,
    dur = 2.4,
    pan = 0,
    dest?: GainNode
  ): void {
    const ctx = this.ctx;
    const target = dest ?? this.musicBus;
    if (!ctx || !target) return;

    const carrier = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modG = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();

    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(freq, time);
    mod.type = 'sine';
    mod.frequency.setValueAtTime(freq * 2.756, time); // true tubular bell overtone ratio
    modG.gain.setValueAtTime(freq * 1.9, time);
    modG.gain.exponentialRampToValueAtTime(2, time + dur * 0.55);

    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(5200, time);
    lp.frequency.exponentialRampToValueAtTime(980, time + dur);

    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    mod.connect(modG);
    modG.connect(carrier.frequency);
    carrier.connect(lp);
    lp.connect(g);
    this.connectWithPan(g, pan, target, 0.58);

    mod.start(time);
    carrier.start(time);
    mod.stop(time + dur + 0.04);
    carrier.stop(time + dur + 0.04);
  }

  /** Shimmering Concert Arcane Harp */
  private orchHarp(freq: number, time: number, dur: number, vol: number, pan = 0): void {
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
    modG.gain.setValueAtTime(freq * 0.72, time);
    modG.gain.exponentialRampToValueAtTime(1, time + dur * 0.45);

    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(4200, time);
    lp.frequency.exponentialRampToValueAtTime(840, time + dur);

    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    mod.connect(modG);
    modG.connect(carrier.frequency);
    carrier.connect(lp);
    lp.connect(g);
    this.connectWithPan(g, pan, this.musicBus, 0.42);

    mod.start(time);
    carrier.start(time);
    mod.stop(time + dur + 0.03);
    carrier.stop(time + dur + 0.03);
  }
}

export const gameAudio = new GameAudio();
