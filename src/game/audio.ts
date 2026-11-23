class GameAudio {
  private ctx: AudioContext | null = null;
  private muted = false;
  private masterGain: GainNode | null = null;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.24;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.24, this.ctx.currentTime, 0.02);
    }
    return this.muted;
  }

  private playTone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    volume = 0.35,
    delay = 0
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private playNoise(duration: number, volume = 0.28, highpass = 240): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const sampleCount = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = highpass;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start();
  }

  public shootRevolver(): void {
    this.playTone(540, 150, 0.11, 'sawtooth', 0.28);
    this.playNoise(0.07, 0.16, 1200);
  }

  public shootSonic(): void {
    this.playTone(860, 420, 0.08, 'triangle', 0.24);
  }

  public shootMortar(): void {
    this.playTone(170, 55, 0.18, 'square', 0.34);
    this.playNoise(0.14, 0.24, 340);
  }

  public shootBioBeam(): void {
    this.playTone(460, 690, 0.13, 'sine', 0.24);
    this.playTone(690, 920, 0.1, 'triangle', 0.12, 0.03);
  }

  public shootCleaver(): void {
    this.playTone(210, 75, 0.14, 'sawtooth', 0.34);
    this.playNoise(0.11, 0.28, 620);
  }

  public shootRadiant(): void {
    this.playTone(720, 1080, 0.1, 'triangle', 0.22);
    this.playTone(520, 260, 0.1, 'sawtooth', 0.16, 0.02);
  }

  public hookLaunch(): void {
    this.playTone(340, 120, 0.22, 'sawtooth', 0.36);
    this.playNoise(0.18, 0.32, 1400);
  }

  public hookLatch(): void {
    this.playTone(180, 520, 0.14, 'square', 0.42);
    this.playTone(520, 140, 0.18, 'sawtooth', 0.35, 0.06);
  }

  public blightRot(): void {
    this.playTone(140, 95, 0.3, 'sawtooth', 0.24);
    this.playNoise(0.24, 0.2, 320);
  }

  public orbitalCharge(): void {
    this.playTone(300, 1260, 0.72, 'sine', 0.28);
    this.playTone(450, 900, 0.65, 'triangle', 0.18, 0.06);
  }

  public cloakVanish(): void {
    this.playTone(640, 220, 0.2, 'sine', 0.22);
    this.playNoise(0.14, 0.15, 1800);
  }

  public vortexPull(): void {
    this.playTone(420, 90, 0.35, 'sine', 0.3);
    this.playTone(180, 480, 0.3, 'triangle', 0.2, 0.06);
  }

  public throwDynamite(): void {
    this.playTone(320, 580, 0.12, 'triangle', 0.25);
  }

  public explosion(heavy = false): void {
    this.playTone(heavy ? 110 : 160, 32, heavy ? 0.42 : 0.26, 'sawtooth', heavy ? 0.55 : 0.38);
    this.playNoise(heavy ? 0.4 : 0.24, heavy ? 0.45 : 0.3, heavy ? 200 : 420);
  }

  public bullCharge(): void {
    this.playTone(140, 220, 0.22, 'sawtooth', 0.32);
    this.playTone(210, 130, 0.24, 'square', 0.22, 0.08);
  }

  public hydroDash(): void {
    this.playTone(300, 1180, 0.18, 'sawtooth', 0.28);
    this.playNoise(0.14, 0.2, 1600);
  }

  public whirlpool(): void {
    this.playTone(260, 520, 0.25, 'triangle', 0.24);
    this.playTone(520, 340, 0.25, 'sine', 0.2, 0.15);
  }

  public bite(): void {
    this.playTone(280, 90, 0.14, 'sawtooth', 0.36);
    this.playNoise(0.1, 0.25, 700);
  }

  public meltdownCharge(): void {
    this.playTone(220, 740, 1.15, 'sawtooth', 0.24);
  }

  public totemDeploy(): void {
    this.playTone(440, 660, 0.14, 'sine', 0.26);
    this.playTone(660, 880, 0.18, 'triangle', 0.22, 0.08);
  }

  public droneSpawn(): void {
    this.playTone(520, 780, 0.1, 'triangle', 0.22);
    this.playTone(780, 1040, 0.12, 'sine', 0.18, 0.06);
  }

  public jump(doubleJump = false): void {
    this.playTone(doubleJump ? 340 : 220, doubleJump ? 580 : 390, 0.09, 'sine', 0.18);
  }

  public jumpPad(): void {
    this.playTone(240, 780, 0.24, 'triangle', 0.32);
    this.playTone(360, 980, 0.2, 'sine', 0.2, 0.04);
  }

  public solarPickup(): void {
    this.playTone(780, 1180, 0.09, 'sine', 0.22);
    this.playTone(1040, 1480, 0.1, 'triangle', 0.18, 0.045);
  }

  public upgradeBuy(): void {
    this.playTone(523, 523, 0.09, 'triangle', 0.26, 0);
    this.playTone(659, 659, 0.09, 'triangle', 0.26, 0.07);
    this.playTone(784, 1046, 0.18, 'triangle', 0.3, 0.14);
  }

  public dropPodSlam(): void {
    this.playTone(130, 38, 0.32, 'sawtooth', 0.45);
    this.playNoise(0.26, 0.38, 280);
  }

  public hitConfirm(): void {
    this.playTone(620, 420, 0.05, 'square', 0.12);
  }

  public killBanner(): void {
    this.playTone(440, 440, 0.1, 'sawtooth', 0.25, 0);
    this.playTone(554, 554, 0.1, 'sawtooth', 0.25, 0.09);
    this.playTone(659, 880, 0.24, 'triangle', 0.3, 0.18);
  }

  public victory(): void {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, idx) => {
      this.playTone(n, n, 0.22, 'triangle', 0.3, idx * 0.11);
    });
  }

  public defeat(): void {
    const notes = [392, 349, 311, 261];
    notes.forEach((n, idx) => {
      this.playTone(n, n * 0.96, 0.28, 'sawtooth', 0.24, idx * 0.14);
    });
  }
}

export const gameAudio = new GameAudio();
