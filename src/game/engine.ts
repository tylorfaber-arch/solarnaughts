import { gameAudio } from './audio';
import { gameVoices } from './voices';
import {
  ASCENSION_INFUSIONS,
  canForgeAscension,
  canForgeTalent,
  computeHeroStats,
  HERO_MAP,
} from './heroes';
import { BASE_ZONES, GRAVITY, JUMP_PADS, PLATFORMS, WORLD_H, WORLD_W } from './map';
import type {
  ClientToServerMessage,
  MatchMode,
  PlayerInputPacket,
  ServerToClientMessage,
  SimFxEvent,
  WorldSnapshot,
} from './netTypes';
import { renderArena, type EndCinematicRenderState } from './renderer';
import { heroAbilityVfx } from './heroVfx';
import { ArenaSimulation } from './sim';
import { serverWsUrl } from '../platform';
import { PAD, PadReader, padUi, type PadFrame } from './gamepad';
import type {
  CoreDrillEntity,
  Difficulty,
  DroidEntity,
  FloatingText,
  GamePhase,
  HazardZoneEntity,
  HeroEntity,
  HeroId,
  HookEntity,
  HudSnapshot,
  MinimapBlip,
  NeutralCreepEntity,
  Particle,
  ProjectileEntity,
  ScoreboardRow,
  SolarCubeEntity,
  SummonEntity,
  Team,
  TurretEntity,
} from './types';

export interface EngineLaunchConfig {
  mode: MatchMode;
  heroId: HeroId;
  difficulty: Difficulty;
  roomId?: string;
  playerName?: string;
  preferredTeam?: Team;
}

/** Max pixels the canvas draws at full quality; bigger windows are upscaled by the browser. */
const MAX_RENDER_PIXELS = 1920 * 1080 * 0.8;

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private onReturnToLobby?: (roomId: string, reason: string) => void;
  private rafId: number | null = null;
  private lastTs = 0;

  // --- Dynamic resolution (keeps busy fights at 60fps on slower / software-rendered machines) ---
  /** Fraction of the static-capped resolution actually rendered. 1 = full sharpness. */
  private dynScale = 1;
  private perfTime = 0;
  private perfFrames = 0;
  private perfCooldown = 0;
  /** Seconds until we are allowed to try sharpening again (grows after each failed attempt). */
  private sharpenBlockedFor = 0;
  private sharpenBackoff = 8;
  /** Seconds left in which a drop counts as "the last sharpen step failed". */
  private sharpenTrial = 0;
  private wasHidden = false;
  private fpsMeterTime = 0;
  private fpsMeterFrames = 0;
  private fpsMeterValue = 0;
  /** ?fps shows a small frame-rate / render-scale readout in the corner. */
  private readonly showFps = typeof location !== 'undefined' && new URLSearchParams(location.search).has('fps');
  /** ?scale=0.75 forces a fixed render scale (dynamic resolution off); ?scale=1 forces full res. */
  private readonly forcedScale: number | null = (() => {
    if (typeof location === 'undefined') return null;
    const v = Number(new URLSearchParams(location.search).get('scale'));
    return v > 0 && v <= 1 ? v : null;
  })();
  private hudEmitTimer = 0;

  private mode: MatchMode;
  private heroId: HeroId;
  private difficulty: Difficulty;
  private roomId: string | null = null;
  private playerName: string;
  private preferredTeam?: Team;

  // Solo simulation
  private localSim: ArenaSimulation | null = null;

  // Online multiplayer client state
  private ws: WebSocket | null = null;
  private wsConnected = false;
  private pingMs = 0;
  private pingIntervalId: number | null = null;
  private reconnectTimerId: number | null = null;
  private destroyed = false;
  private inputSendTimer = 0;
  private inputSeq = 0;
  private lastSentInputKey = '';
  private playerEntityId = '';
  private playerTeam: Team = 'blue';
  private onlineHumanCount = 1;
  private latestSnapshot: WorldSnapshot | null = null;

  // Renderable mirror state (used in online mode with prediction & interpolation)
  private renderTime = 0;
  private waveTier = 1;
  private waveTierName = 'Tier I · Initiates';
  private phase: GamePhase = 'PLAYING';
  private blueKills = 0;
  private redKills = 0;
  private banner: WorldSnapshot['banner'] = null;
  private killFeed: WorldSnapshot['killFeed'] = [];
  private mirrorHeroes = new Map<string, HeroEntity>();
  private mirrorDroids = new Map<string, DroidEntity>();
  private mirrorTurrets = new Map<string, TurretEntity>();
  private mirrorCores = new Map<string, CoreDrillEntity>();
  private mirrorCreeps = new Map<string, NeutralCreepEntity>();
  private mirrorSolars = new Map<string, SolarCubeEntity>();
  private mirrorProjectiles = new Map<string, ProjectileEntity>();
  private mirrorSummons = new Map<string, SummonEntity>();
  private mirrorHooks = new Map<string, HookEntity>();
  private mirrorHazards = new Map<string, HazardZoneEntity>();

  // Visual juice (always local 60fps!)
  private hitstopTimer = 0;
  private shakeMag = 0;
  private shakeX = 0;
  private shakeY = 0;
  private camX = 0;
  private camY = 0;
  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];
  private endCinematic: (EndCinematicRenderState & { burstStage: number }) | null = null;

  // Voice line milestone trackers
  private firstBloodAnnounced = false;
  private coreExposedAnnounced = false;
  private prevAliveTurrets = -1;
  private voiceTimers: number[] = [];

  // Input state
  private heldKeys = new Set<string>();
  private mouseDownLeft = false;
  private mouseScreenX = 640;
  private mouseScreenY = 360;
  private mouseWorldX = 640;
  private mouseWorldY = 360;
  private queuedJump = false;
  private queuedDrop = false;
  private queuedSkill1 = false;
  private queuedSkill2 = false;
  private queuedRecall = false;

  // Controller state (see gamepad.ts). Aim is a direction + distance from the hero.
  private pad = new PadReader();
  private padFrame: PadFrame | null = null;
  private padWasMenu = true;
  private padStickDown = false;
  private padAimDirX = 1;
  private padAimDirY = 0;
  private padAimDist = 320;

  // Local client-side prediction & reconciliation state for online mode
  private predCoyote = 0;
  private predJumpBuffer = 0;
  private predJumpsLeft = 2;
  private predDropThrough = 0;
  private predHoverFuel = 1;
  private pendingInputs: Array<{ seq: number; dt: number; pkt: PlayerInputPacket }> = [];
  private remoteHeroTargets = new Map<string, { x: number; y: number; vx: number; vy: number }>();
  private remoteDroidTargets = new Map<string, { x: number; y: number; vx: number; vy: number }>();

  constructor(
    canvas: HTMLCanvasElement,
    config: EngineLaunchConfig,
    onHudUpdate: (snapshot: HudSnapshot) => void,
    onReturnToLobby?: (roomId: string, reason: string) => void
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not initialize 2D rendering context.');
    this.ctx = context;
    this.onHudUpdate = onHudUpdate;
    this.onReturnToLobby = onReturnToLobby;

    this.mode = config.mode;
    this.heroId = config.heroId;
    this.difficulty = config.difficulty;
    this.roomId = config.roomId ?? null;
    this.playerName = config.playerName || 'Champion';
    this.preferredTeam = config.preferredTeam;

    if (this.mode === 'solo') {
      this.initSolo(this.heroId, this.difficulty);
    } else {
      this.connectOnline();
    }

    this.bindInputs();
  }

  private initSolo(heroId: HeroId, difficulty: Difficulty): void {
    this.localSim = new ArenaSimulation(heroId, difficulty, true);
    const p = this.localSim.heroes.find((h) => h.isPlayer)!;
    this.playerEntityId = p.id;
    this.playerTeam = p.team;
    this.phase = 'PLAYING';
    this.endCinematic = null;
    this.particles = [];
    this.floatingTexts = [];
    this.camX = Math.max(0, p.dropPodX - this.viewW * 0.5);
    this.camY = Math.max(0, Math.min(WORLD_H - this.viewH, 260));
    this.resetVoiceMilestones();
    gameAudio.setMusicMode('battle');
    gameVoices.prefetchHeroVoices(heroId);
    this.scheduleVoice(350, () => {
      gameVoices.playAnnouncerLine('match_start', { force: true });
    });
  }

  private resetVoiceMilestones(): void {
    this.clearVoiceTimers();
    this.firstBloodAnnounced = false;
    this.coreExposedAnnounced = false;
    this.prevAliveTurrets = -1;
  }

  private scheduleVoice(delayMs: number, fn: () => void): void {
    const id = window.setTimeout(() => {
      this.voiceTimers = this.voiceTimers.filter((t) => t !== id);
      if (!this.destroyed) fn();
    }, delayMs);
    this.voiceTimers.push(id);
  }

  private clearVoiceTimers(): void {
    for (const id of this.voiceTimers) {
      window.clearTimeout(id);
    }
    this.voiceTimers = [];
  }

  private connectOnline(): void {
    if (this.destroyed) return;
    if (this.pingIntervalId !== null) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
    if (this.ws) {
      const oldWs = this.ws;
      this.ws = null;
      try {
        oldWs.close();
      } catch {
        // Ignore close errors on stale socket
      }
    }

    const ws = new WebSocket(serverWsUrl());
    this.ws = ws;
    this.wsConnected = false;

    ws.addEventListener('open', () => {
      if (this.ws !== ws || this.destroyed) {
        try {
          ws.close();
        } catch {
          // Ignore
        }
        return;
      }
      this.wsConnected = true;
      this.pendingInputs = [];
      const joinMsg: ClientToServerMessage = {
        type: 'join',
        roomId: this.roomId || 'SANCTUM-1',
        heroId: this.heroId,
        playerName: this.playerName,
        difficulty: this.difficulty,
        preferredTeam: this.preferredTeam,
      };
      ws.send(JSON.stringify(joinMsg));
      this.sendPing();
      this.pingIntervalId = window.setInterval(() => this.sendPing(), 2000);
    });

    ws.addEventListener('message', (ev) => {
      if (this.ws !== ws || this.destroyed) return;
      let msg: ServerToClientMessage;
      try {
        msg = JSON.parse(String(ev.data)) as ServerToClientMessage;
      } catch {
        return;
      }

      if (msg.type === 'pong') {
        this.pingMs = Math.max(1, Math.round(Date.now() - msg.clientTime));
      } else if (msg.type === 'joined') {
        this.roomId = msg.roomId;
        this.playerEntityId = msg.playerEntityId;
        this.heroId = msg.assignedHeroId;
        this.playerTeam = msg.team;
        this.pendingInputs = [];
        this.remoteHeroTargets.clear();
        this.remoteDroidTargets.clear();
        this.applyServerSnapshot(msg.snapshot, true);
        const me = this.mirrorHeroes.get(this.playerEntityId);
        if (me) {
          this.camX = Math.max(0, me.x - this.viewW * 0.5);
          this.camY = Math.max(0, Math.min(WORLD_H - this.viewH, 260));
        }
        if (this.phase === 'PLAYING') {
          gameAudio.setMusicMode('battle');
          this.resetVoiceMilestones();
          gameVoices.prefetchHeroVoices(this.heroId);
          if ((msg.snapshot.matchTime ?? 0) < 15) {
            this.scheduleVoice(350, () => {
              gameVoices.playAnnouncerLine('match_start', { force: true });
            });
          } else {
            this.scheduleVoice(250, () => {
              gameVoices.playChampionLine(this.heroId, 'spawn');
            });
          }
        }
        this.emitHud();
      } else if (msg.type === 'state') {
        this.applyServerSnapshot(msg.snapshot, false);
      } else if (msg.type === 'return_to_lobby') {
        this.destroyed = true;
        this.onReturnToLobby?.(msg.roomId, msg.reason);
      } else if (msg.type === 'error') {
        this.banner = {
          id: Date.now(),
          title: 'SANCTUM NOTICE',
          subtitle: msg.message,
          tone: 'red',
          timer: 4,
        };
        this.emitHud();
      }
    });

    ws.addEventListener('error', () => {
      if (this.ws !== ws || this.destroyed) return;
      // Close event handles clean reconnect
    });

    ws.addEventListener('close', () => {
      if (this.ws !== ws) return;
      this.wsConnected = false;
      if (this.pingIntervalId !== null) {
        clearInterval(this.pingIntervalId);
        this.pingIntervalId = null;
      }
      this.emitHud();
      if (!this.destroyed && this.mode === 'online' && this.reconnectTimerId === null) {
        this.reconnectTimerId = window.setTimeout(() => {
          this.reconnectTimerId = null;
          if (!this.destroyed && this.mode === 'online') {
            this.connectOnline();
          }
        }, 1500);
      }
    });
  }

  private sendPing(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const msg: ClientToServerMessage = { type: 'ping', clientTime: Date.now() };
      this.ws.send(JSON.stringify(msg));
    }
  }

  public start(): void {
    if (this.rafId !== null) return;
    this.lastTs = performance.now();
    const tick = (ts: number) => {
      const rawDt = (ts - this.lastTs) / 1000;
      this.lastTs = ts;
      this.updateRenderResolution(rawDt);
      this.pollGamepad();
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      if (this.phase === 'VICTORY' || this.phase === 'DEFEAT') {
        // Pause gameplay flow cleanly while running the Victory/Defeat cinematic!
        this.updateEndCinematic(dt);
      } else if (this.mode === 'solo') {
        if (this.phase === 'PLAYING') {
          this.updateSolo(dt);
        }
      } else {
        this.updateOnline(dt);
      }

      this.render();

      this.hudEmitTimer -= dt;
      if (this.hudEmitTimer <= 0) {
        this.hudEmitTimer = 0.075;
        this.emitHud();
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  public destroy(): void {
    this.destroyed = true;
    this.clearVoiceTimers();
    gameVoices.stop();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.pingIntervalId !== null) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
    if (this.reconnectTimerId !== null) {
      clearTimeout(this.reconnectTimerId);
      this.reconnectTimerId = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.unbindInputs();
  }

  public setPaused(paused: boolean): void {
    if (this.phase === 'VICTORY' || this.phase === 'DEFEAT') return;
    if (this.mode === 'solo') {
      this.phase = paused ? 'PAUSED' : 'PLAYING';
      if (paused) this.clearHeldInputs();
      this.emitHud();
    } else {
      if (paused) this.clearHeldInputs();
    }
  }

  public restartMatch(playerHeroId: HeroId, difficulty: Difficulty): void {
    this.heroId = playerHeroId;
    this.difficulty = difficulty;
    this.endCinematic = null;
    if (this.mode === 'solo') {
      this.initSolo(playerHeroId, difficulty);
      this.emitHud();
    } else if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const msg: ClientToServerMessage = { type: 'restart', heroId: playerHeroId };
      this.ws.send(JSON.stringify(msg));
    }
  }

  public skipEndCinematic(): void {
    if (!this.endCinematic || !this.endCinematic.active || !this.endCinematic.canSkip) return;
    this.endCinematic.active = false;
    this.endCinematic.completed = true;
    this.endCinematic.elapsed = this.endCinematic.duration;
    this.emitHud();
  }

  public switchPlayerHero(nextHeroId: HeroId): boolean {
    if (this.mode === 'solo' && this.localSim) {
      const switched = this.localSim.switchHumanHero(this.playerEntityId, nextHeroId);
      if (switched) {
        this.heroId = switched.assignedHeroId;
        this.phase = 'PLAYING';
        this.processFxEvents(this.localSim.drainFx());
        this.emitHud();
        return true;
      }
      return false;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const msg: ClientToServerMessage = { type: 'switch_hero', heroId: nextHeroId };
      this.ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  public requeueToLobby(): void {
    if (this.mode === 'online' && this.ws && this.ws.readyState === WebSocket.OPEN) {
      const msg: ClientToServerMessage = { type: 'requeue_lobby' };
      this.ws.send(JSON.stringify(msg));
    } else {
      this.onReturnToLobby?.(this.roomId ?? '', '');
    }
  }

  public triggerRecall(): void {
    this.queuedRecall = true;
    const me = this.getLocalPlayerHero();
    if (me && me.alive && !me.inDropPod) {
      gameVoices.playChampionLine(me.heroId, 'recall', { chance: 0.75 });
    }
  }

  public purchasePlayerUpgrade(upgradeId: string): boolean {
    if (this.mode === 'solo' && this.localSim) {
      const ok = this.localSim.buyUpgradeForHero(this.playerEntityId, upgradeId);
      if (ok) {
        this.processFxEvents(this.localSim.drainFx());
        this.emitHud();
      }
      return ok;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const msg: ClientToServerMessage = { type: 'buy_upgrade', upgradeId };
      this.ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  // === INPUT HANDLING ===
  private handleKeyDown = (e: KeyboardEvent) => {
    gameAudio.unlock();
    if (e.repeat) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    if (this.endCinematic?.active && this.endCinematic.canSkip && (e.code === 'Space' || e.code === 'Enter')) {
      this.skipEndCinematic();
      return;
    }
    this.heldKeys.add(e.code);

    if (this.phase !== 'PLAYING') return;
    if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') this.queuedJump = true;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') this.queuedDrop = true;
    if (e.code === 'KeyQ') this.queuedSkill1 = true;
    if (e.code === 'KeyE' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.queuedSkill2 = true;
    if (e.code === 'KeyR') this.queuedRecall = true;
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.heldKeys.delete(e.code);
  };

  private handleMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseScreenX = e.clientX - rect.left;
    this.mouseScreenY = e.clientY - rect.top;
  };

  private handleMouseDown = (e: MouseEvent) => {
    gameAudio.unlock();
    if (this.endCinematic?.active && this.endCinematic.canSkip) {
      this.skipEndCinematic();
      return;
    }
    if (this.phase !== 'PLAYING') return;
    if (e.button === 0) this.mouseDownLeft = true;
    else if (e.button === 2) this.queuedSkill1 = true;
  };

  private handleMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouseDownLeft = false;
  };

  private handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private clearHeldInputs = () => {
    this.heldKeys.clear();
    this.mouseDownLeft = false;
    this.padFrame = null;
  };

  private bindInputs(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.clearHeldInputs);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    this.canvas.addEventListener('contextmenu', this.handleContextMenu);
  }

  private unbindInputs(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.clearHeldInputs);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
  }

  private sampleInputPacket(playerX: number, playerY: number): PlayerInputPacket {
    let moveDir: -1 | 0 | 1 = 0;
    if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) moveDir = -1;
    if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) moveDir = moveDir === -1 ? 0 : 1;

    const pad = this.padFrame;
    if (pad && moveDir === 0) {
      if (pad.lx < -0.35 || pad.held[PAD.LEFT]) moveDir = -1;
      else if (pad.lx > 0.35 || pad.held[PAD.RIGHT]) moveDir = 1;
    }

    if (padUi.lastDevice === 'gamepad') {
      this.updatePadAim(playerX, playerY, pad);
    } else {
      this.mouseWorldX = this.mouseScreenX + this.camX;
      this.mouseWorldY = this.mouseScreenY + this.camY;
    }
    const aimAngle = Math.atan2(this.mouseWorldY - playerY, this.mouseWorldX - playerX);

    return {
      seq: ++this.inputSeq,
      moveDir,
      wantJump: this.queuedJump,
      holdingJump:
        this.heldKeys.has('Space') || this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp') || !!pad?.held[PAD.A],
      wantDrop: this.queuedDrop,
      wantPrimary: this.mouseDownLeft || !!pad?.held[PAD.RT],
      wantSkill1: this.queuedSkill1,
      wantSkill2: this.queuedSkill2,
      wantRecall: this.queuedRecall,
      aimAngle: Math.round(aimAngle * 100) / 100,
      aimWorldX: Math.round(this.mouseWorldX),
      aimWorldY: Math.round(this.mouseWorldY),
    };
  }

  // === CONTROLLER ===
  /**
   * Reads the controller once per frame. Menus own it while padUi.menuActive (title, pause,
   * talent forge, end screen); the first frame after a menu closes only resyncs, so the A press
   * that clicked "Resume" doesn't also jump.
   */
  private pollGamepad(): void {
    if (padUi.menuActive) {
      this.padFrame = null;
      this.padWasMenu = true;
      return;
    }
    if (this.padWasMenu) {
      this.pad.resync();
      this.padWasMenu = false;
      this.padFrame = null;
      return;
    }
    const f = this.pad.poll();
    this.padFrame = f;
    if (!f) return;
    if (f.active) padUi.setLastDevice('gamepad');

    if (this.endCinematic?.active && this.endCinematic.canSkip && (f.pressed[PAD.A] || f.pressed[PAD.MENU])) {
      this.skipEndCinematic();
      return;
    }
    // Menu-level actions are routed through the same keyboard shortcuts App.tsx already handles.
    if (f.pressed[PAD.MENU]) this.synthKey('Escape');
    if (f.pressed[PAD.X]) this.synthKey('KeyB');
    if (f.pressed[PAD.VIEW]) this.synthKey('Tab', 'keydown');
    if (f.released[PAD.VIEW]) this.synthKey('Tab', 'keyup');

    if (this.phase !== 'PLAYING') return;
    if (f.pressed[PAD.A]) this.queuedJump = true;
    const stickDown = f.ly > 0.7 && Math.abs(f.lx) < 0.6;
    if (f.pressed[PAD.B] || f.pressed[PAD.DOWN] || (stickDown && !this.padStickDown)) this.queuedDrop = true;
    this.padStickDown = stickDown;
    if (f.pressed[PAD.LB] || f.pressed[PAD.LT]) this.queuedSkill1 = true;
    if (f.pressed[PAD.RB]) this.queuedSkill2 = true;
    if (f.pressed[PAD.Y]) this.queuedRecall = true;
  }

  private synthKey(code: string, type: 'keydown' | 'keyup' | 'tap' = 'tap'): void {
    if (type !== 'keyup') window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
    if (type !== 'keydown') window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
  }

  /**
   * Right stick aims (direction + how far, for cursor-targeted skills). When the stick is released
   * the last aim is kept relative to the hero. Light aim assist: if an enemy champion is close to
   * the stick direction, the aim point snaps onto them.
   */
  private updatePadAim(playerX: number, playerY: number, pad: PadFrame | null): void {
    if (pad) {
      const mag = Math.hypot(pad.rx, pad.ry);
      if (mag > 0.25) {
        this.padAimDirX = pad.rx / mag;
        this.padAimDirY = pad.ry / mag;
        this.padAimDist = 170 + Math.min(1, mag) * 330;
      } else if (Math.abs(pad.lx) > 0.35) {
        // No right-stick input: face where you're running, keep the vertical aim.
        const sx = Math.sign(pad.lx);
        if (Math.sign(this.padAimDirX) !== sx) this.padAimDirX = -this.padAimDirX || sx;
      }
    }
    let ax = playerX + this.padAimDirX * this.padAimDist;
    let ay = playerY + this.padAimDirY * this.padAimDist;

    const heroes = this.mode === 'solo' && this.localSim ? this.localSim.heroes : this.mirrorHeroes.values();
    let bestScore = Infinity;
    for (const h of heroes) {
      if (!h.alive || h.team === this.playerTeam || h.inDropPod) continue;
      const dx = h.x - playerX;
      const dy = h.y - playerY;
      const d = Math.hypot(dx, dy);
      if (d < 1 || d > 820) continue;
      const cos = (dx * this.padAimDirX + dy * this.padAimDirY) / d;
      if (cos < 0.965) continue; // ~15 degree cone
      const score = d * (2 - cos);
      if (score < bestScore) {
        bestScore = score;
        ax = h.x;
        ay = h.y;
      }
    }
    this.mouseWorldX = ax;
    this.mouseWorldY = ay;
    this.mouseScreenX = ax - this.camX;
    this.mouseScreenY = ay - this.camY;
  }

  private rumble(strength: number, ms: number): void {
    if (padUi.lastDevice !== 'gamepad' || typeof navigator === 'undefined' || !navigator.getGamepads) return;
    for (const gp of navigator.getGamepads()) {
      const act = gp?.vibrationActuator as
        | { playEffect?: (t: string, p: Record<string, number>) => Promise<unknown> }
        | undefined;
      act?.playEffect?.('dual-rumble', {
        duration: ms,
        strongMagnitude: Math.min(1, strength),
        weakMagnitude: Math.min(1, strength * 0.7),
      })?.catch(() => {});
    }
  }

  // === SOLO UPDATE ===
  private updateSolo(dt: number): void {
    if (!this.localSim) return;

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.updateShake(dt);
      return;
    }

    const player = this.localSim.heroes.find((h) => h.id === this.playerEntityId);
    if (player) {
      const pkt = this.sampleInputPacket(player.x, player.y);
      this.localSim.setHumanInput(player.id, pkt);
    }

    this.localSim.step(dt);
    const nextPhase = this.localSim.phase;
    this.phase = nextPhase;
    this.renderTime = this.localSim.matchTime;
    this.waveTier = this.localSim.waveTier;
    this.waveTierName = this.localSim.waveTierName;
    this.processFxEvents(this.localSim.drainFx());

    if (nextPhase === 'VICTORY' || nextPhase === 'DEFEAT') {
      const winner: Team = nextPhase === 'VICTORY' ? 'blue' : 'red';
      this.startEndCinematic(winner);
      this.clearEdgeTriggers();
      return;
    }

    this.syncDynamicMusic(this.localSim.cores);
    this.updateEffects(dt);
    if (player) this.updateCamera(player, dt);
    this.updateShake(dt);

    this.clearEdgeTriggers();
  }

  private syncDynamicMusic(cores: CoreDrillEntity[]): void {
    if (this.phase !== 'PLAYING') return;
    const anyCoreExposed = cores.some((c) => !c.shielded);
    gameAudio.setMusicMode(this.waveTier >= 5 || anyCoreExposed ? 'tension' : 'battle');

    // Announcer cues for Reliquary Towers falling & Ancient Core shield dropping
    const turrets =
      this.mode === 'solo' && this.localSim
        ? this.localSim.turrets
        : Array.from(this.mirrorTurrets.values());
    const aliveTurrets = turrets.filter((t) => t.alive).length;
    if (this.prevAliveTurrets >= 0 && aliveTurrets < this.prevAliveTurrets) {
      gameVoices.playAnnouncerLine('tower_down');
    }
    this.prevAliveTurrets = aliveTurrets;

    if (anyCoreExposed && !this.coreExposedAnnounced) {
      this.coreExposedAnnounced = true;
      gameVoices.playAnnouncerLine('core_exposed');
    }
  }

  private startEndCinematic(winner: Team): void {
    if (this.endCinematic) return;
    const cores = this.mode === 'solo' && this.localSim ? this.localSim.cores : Array.from(this.mirrorCores.values());
    const shatteredCore = cores.find((c) => c.team !== winner) ?? cores[0];
    const coreX = shatteredCore ? shatteredCore.x : WORLD_W * 0.5;
    const coreY = shatteredCore ? shatteredCore.y : 900;
    const localWon = winner === this.playerTeam;

    this.clearHeldInputs();
    this.clearVoiceTimers();
    this.endCinematic = {
      active: true,
      completed: false,
      winner,
      localWon,
      elapsed: 0,
      duration: 3.85,
      canSkip: false,
      coreX,
      coreY,
      burstStage: 0,
    };

    if (localWon) gameAudio.playVictoryFanfare();
    else gameAudio.playDefeatRequiem();

    // Herald decree + Champion's victory/defeat closing remark
    const playerHero = this.getLocalPlayerHero();
    const championId = playerHero?.heroId ?? this.heroId;
    this.scheduleVoice(850, () => {
      gameVoices.playAnnouncerLine(localWon ? 'victory' : 'defeat', { force: true });
    });
    this.scheduleVoice(3650, () => {
      gameVoices.playChampionLine(championId, localWon ? 'victory' : 'defeat', { force: true });
    });

    // Opening Core Shatter Detonation
    this.addShake(19);
    this.spawnRing(coreX, coreY - 110, 185, localWon ? '#FEF08A' : '#F43F5E');
    this.spawnRing(coreX, coreY - 110, 125, '#FFFFFF');
    this.spawnParticles(coreX, coreY - 110, localWon ? '#FBBF24' : '#F43F5E', 38, 360, 'spark');
    this.spawnParticles(coreX, coreY - 110, winner === 'blue' ? '#38BDF8' : '#FB7185', 26, 280, 'square');
    this.emitHud();
  }

  private updateEndCinematic(dt: number): void {
    if (!this.endCinematic) {
      const winner: Team =
        this.phase === 'VICTORY' ? this.playerTeam : this.playerTeam === 'blue' ? 'red' : 'blue';
      this.startEndCinematic(winner);
      if (!this.endCinematic) return;
    }

    const cin = this.endCinematic;
    // Slow-motion ambient animation time (lets particles, shatter rays & hero celebrations breathe while sim is paused)
    this.renderTime += dt * 0.68;

    // Smooth cinematic camera glide onto the shattered Ancient Core
    const vw = this.viewW;
    const vh = this.viewH;
    const targetX = Math.max(0, Math.min(Math.max(0, WORLD_W - vw), cin.coreX - vw * 0.5));
    const targetY = Math.max(0, Math.min(Math.max(0, WORLD_H - vh), cin.coreY - 125 - vh * 0.5));
    const camLerp = Math.min(1, dt * 3.4);
    this.camX += (targetX - this.camX) * camLerp;
    this.camY += (targetY - this.camY) * camLerp;

    if (cin.active) {
      cin.elapsed += dt;
      cin.canSkip = cin.elapsed >= 1.1;

      // Choreographed slow-motion chain explosions along the collapsing Core
      const burstTimes = [0.34, 0.78, 1.32, 1.95];
      if (cin.burstStage < burstTimes.length && cin.elapsed >= burstTimes[cin.burstStage]) {
        const stage = cin.burstStage;
        cin.burstStage++;
        const ox = (stage % 2 === 0 ? -1 : 1) * (26 + stage * 12);
        const oy = -70 - stage * 28;
        const primaryCol = cin.localWon ? '#FBBF24' : '#F43F5E';
        const secondaryCol = cin.winner === 'blue' ? '#38BDF8' : '#FB7185';
        this.addShake(13 - stage * 2);
        this.spawnRing(cin.coreX + ox, cin.coreY + oy, 130 + stage * 24, primaryCol);
        this.spawnParticles(cin.coreX + ox, cin.coreY + oy, primaryCol, 24, 300, 'spark');
        this.spawnParticles(cin.coreX + ox, cin.coreY + oy, secondaryCol, 18, 220, 'square');
      }

      if (cin.elapsed >= cin.duration) {
        cin.active = false;
        cin.completed = true;
        this.emitHud();
      }
    }

    this.updateEffects(dt * 0.65);
    this.updateShake(dt);
  }

  // === ONLINE 60FPS PREDICTED + RECONCILED UPDATE ===
  private updateOnline(dt: number): void {
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.updateShake(dt);
      return;
    }

    this.renderTime += dt;
    const me = this.mirrorHeroes.get(this.playerEntityId);

    if (me && this.ws && this.ws.readyState === WebSocket.OPEN && this.phase === 'PLAYING') {
      const pkt = this.sampleInputPacket(me.x, me.y);
      const inputKey = `${pkt.moveDir}|${pkt.holdingJump ? 1 : 0}|${pkt.wantPrimary ? 1 : 0}|${Math.round(pkt.aimAngle * 16)}`;
      const hasEdge = pkt.wantJump || pkt.wantDrop || pkt.wantSkill1 || pkt.wantSkill2 || pkt.wantRecall;
      const isActivelyMoving = pkt.moveDir !== 0 || !me.grounded || me.inDropPod || Math.abs(me.vx) > 4;

      this.inputSendTimer -= dt;
      const shouldSend = hasEdge || isActivelyMoving || inputKey !== this.lastSentInputKey || this.inputSendTimer <= 0;
      if (shouldSend) {
        this.inputSendTimer = isActivelyMoving ? 0.016 : 0.08;
        this.lastSentInputKey = inputKey;
        const msg: ClientToServerMessage = { type: 'input', input: pkt };
        this.ws.send(JSON.stringify(msg));
      }

      if (me.alive && !me.inDropPod && !me.hookedById && me.stunTimer <= 0 && me.dashTimer <= 0) {
        this.pendingInputs.push({ seq: pkt.seq, dt, pkt });
        if (this.pendingInputs.length > 75) {
          this.pendingInputs.splice(0, this.pendingInputs.length - 75);
        }
      } else {
        this.pendingInputs.length = 0;
      }

      this.predictLocalHero(me, pkt, dt);
    }

    const remoteBlend = Math.min(1, dt * 18);
    for (const h of this.mirrorHeroes.values()) {
      h.squashX += (1 - h.squashX) * Math.min(1, dt * 14);
      h.squashY += (1 - h.squashY) * Math.min(1, dt * 14);
      if (h.id === this.playerEntityId) continue;
      if (h.alive && !h.inDropPod && !h.hookedById) {
        const tgt = this.remoteHeroTargets.get(h.id);
        if (tgt) {
          tgt.x += tgt.vx * dt;
          tgt.y += tgt.vy * dt;
          h.x += (tgt.x - h.x) * remoteBlend;
          h.y += (tgt.y - h.y) * remoteBlend;
        } else {
          h.x += h.vx * dt;
          h.y += h.vy * dt;
        }
        if (Math.abs(h.vx) > 25 && h.grounded) h.walkCycle += dt * Math.abs(h.vx) * 0.015;
      } else if (h.inDropPod) {
        h.dropPodY = Math.min(960 - h.h / 2, h.dropPodY + 420 * dt);
        h.y = h.dropPodY;
      }
    }

    for (const d of this.mirrorDroids.values()) {
      const tgt = this.remoteDroidTargets.get(d.id);
      if (tgt) {
        tgt.x += tgt.vx * dt;
        tgt.y += tgt.vy * dt;
        d.x += (tgt.x - d.x) * remoteBlend;
        d.y += (tgt.y - d.y) * remoteBlend;
      } else {
        d.x += d.vx * dt;
        d.y += d.vy * dt;
      }
      if (Math.abs(d.vx) > 10) d.walkCycle += dt * 4;
    }

    for (const p of this.mirrorProjectiles.values()) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    this.syncDynamicMusic(Array.from(this.mirrorCores.values()));
    this.updateEffects(dt);
    if (me) this.updateCamera(me, dt);
    this.updateShake(dt);
    this.clearEdgeTriggers();
  }

  private stepLocalHeroPhysics(
    kin: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      grounded: boolean;
      coyote: number;
      jumpBuffer: number;
      jumpsLeft: number;
      dropThrough: number;
      hoverFuel: number;
      isHovering: boolean;
    },
    h: HeroEntity,
    pkt: PlayerInputPacket,
    dt: number,
    applyVisualSquash: boolean
  ): void {
    const def = HERO_MAP[h.heroId];
    const stats = computeHeroStats(h.heroId, h.upgrades, h.bonusMaxHp);
    const maxJumps = def.maxJumps + stats.extraJumps;
    const slowMult = h.slowTimer > 0 ? 0.58 : 1;
    const spinMult = h.spinTimer > 0 ? stats.skill2SpeedMult : 1;
    const meltMult = h.meltdownTimer > 0 ? stats.skill2SpeedMult : 1;
    const cloakMult = h.cloakTimer > 0 ? stats.skill2SpeedMult : 1;
    const rotMult = h.rotTimer > 0 ? stats.skill2SpeedMult : 1;
    const hasteMult = h.hasteTimer > 0 ? stats.skill2SpeedMult : 1;
    const targetVx = pkt.moveDir * stats.moveSpeed * slowMult * spinMult * meltMult * cloakMult * rotMult * hasteMult;
    const accel = kin.grounded ? 2600 : 1750;

    if (pkt.moveDir !== 0) {
      kin.vx += Math.sign(targetVx - kin.vx) * Math.min(Math.abs(targetVx - kin.vx), accel * dt);
      if (applyVisualSquash) h.walkCycle += dt * Math.abs(kin.vx) * 0.015;
    } else {
      const decel = kin.grounded ? 2400 : 700;
      if (Math.abs(kin.vx) <= decel * dt) kin.vx = 0;
      else kin.vx -= Math.sign(kin.vx) * decel * dt;
    }

    kin.dropThrough = Math.max(0, kin.dropThrough - dt);
    if (pkt.wantJump) kin.jumpBuffer = 0.12;
    else kin.jumpBuffer = Math.max(0, kin.jumpBuffer - dt);

    if (kin.grounded) {
      kin.coyote = 0.11;
      kin.jumpsLeft = maxJumps;
      kin.hoverFuel = 1;
    } else {
      kin.coyote = Math.max(0, kin.coyote - dt);
    }

    if (kin.jumpBuffer > 0) {
      const activePad = JUMP_PADS.find(
        (jp) =>
          kin.x + h.w * 0.45 > jp.x &&
          kin.x - h.w * 0.45 < jp.x + jp.w &&
          kin.y + h.h / 2 >= jp.y - 12 &&
          kin.y + h.h / 2 <= jp.y + 26
      );
      if (activePad) {
        kin.vy = activePad.vy;
        kin.vx = activePad.vx + pkt.moveDir * 140;
        kin.grounded = false;
        kin.coyote = 0;
        kin.jumpBuffer = 0;
        kin.jumpsLeft = Math.max(1, maxJumps - 1);
        if (applyVisualSquash) {
          h.squashX = 0.76;
          h.squashY = 1.32;
        }
      } else if (kin.coyote > 0) {
        kin.vy = -stats.jumpForce;
        kin.grounded = false;
        kin.coyote = 0;
        kin.jumpBuffer = 0;
        kin.jumpsLeft = Math.max(0, maxJumps - 1);
        if (applyVisualSquash) {
          h.squashX = 0.82;
          h.squashY = 1.24;
        }
      } else if (kin.jumpsLeft > 0) {
        kin.vy = -stats.jumpForce * 0.92;
        kin.jumpsLeft -= 1;
        kin.jumpBuffer = 0;
        if (applyVisualSquash) {
          h.squashX = 0.84;
          h.squashY = 1.2;
        }
      }
    }

    if (pkt.wantDrop && kin.grounded) {
      kin.dropThrough = 0.24;
      kin.grounded = false;
      kin.y += 4;
    }

    kin.isHovering = false;
    let gravScale = 1;
    if (def.canHover && !kin.grounded && pkt.holdingJump && kin.vy > -120 && (stats.infiniteHover || kin.hoverFuel > 0)) {
      kin.isHovering = true;
      if (!stats.infiniteHover) {
        kin.hoverFuel = Math.max(0, kin.hoverFuel - dt * 0.45);
      }
      gravScale = def.hoverGravityScale;
      if (kin.vy > 45) kin.vy = 45;
    }

    kin.vy = Math.min(920, kin.vy + GRAVITY * gravScale * dt);

    const prevX = kin.x;
    const prevBottom = kin.y + h.h / 2;
    const halfW = h.w / 2;

    kin.x += kin.vx * dt;
    kin.x = Math.max(26 + halfW, Math.min(WORLD_W - 26 - halfW, kin.x));

    // Mirror crypt pit side walls so client prediction never clips under ground_left/ground_right
    if (prevBottom > 966 && prevX >= 2260 - halfW && prevX <= 3140 + halfW) {
      if (kin.x - halfW < 2260) {
        kin.x = 2260 + halfW;
        if (kin.vx < 0) kin.vx = 0;
      } else if (kin.x + halfW > 3140) {
        kin.x = 3140 - halfW;
        if (kin.vx > 0) kin.vx = 0;
      }
    }

    kin.y += kin.vy * dt;
    kin.grounded = false;
    const newBottom = kin.y + h.h / 2;
    for (const p of PLATFORMS) {
      if (!(kin.x + halfW > p.x && kin.x - halfW < p.x + p.w)) continue;
      if (p.oneWay) {
        if (kin.dropThrough > 0) continue;
        if (kin.vy >= 0 && prevBottom <= p.y + 8 && newBottom >= p.y) {
          kin.y = p.y - h.h / 2;
          kin.vy = 0;
          kin.grounded = true;
        }
      } else {
        if (kin.vy >= 0 && prevBottom <= p.y + 14 && newBottom >= p.y) {
          kin.y = p.y - h.h / 2;
          kin.vy = 0;
          kin.grounded = true;
        } else if (kin.vy < 0 && kin.y - h.h / 2 < p.y + p.h && prevBottom > p.y + p.h) {
          kin.y = p.y + p.h + h.h / 2;
          kin.vy = 0;
        }
      }
    }

    // Hard solid bottom ground guarantee matching server physics
    const floorY = kin.x >= 2260 && kin.x <= 3140 ? 1065 : 960;
    if (kin.y + h.h / 2 > floorY) {
      kin.y = floorY - h.h / 2;
      if (kin.vy > 0) kin.vy = 0;
      kin.grounded = true;
    }
  }

  private predictLocalHero(h: HeroEntity, pkt: PlayerInputPacket, dt: number): void {
    if (!h.alive || h.hookedById) return;
    h.aimAngle = pkt.aimAngle;
    h.facing = Math.cos(pkt.aimAngle) >= 0 ? 1 : -1;

    if (h.inDropPod) {
      const base = BASE_ZONES[h.team];
      const minX = h.team === 'blue' ? 45 : base.x - 90;
      const maxX = h.team === 'blue' ? base.x + base.w + 90 : WORLD_W - 45;
      h.dropPodX = Math.max(minX, Math.min(maxX, h.dropPodX + pkt.moveDir * 350 * dt));
      h.dropPodY = Math.min(960 - h.h / 2, h.dropPodY + 420 * dt);
      h.x = h.dropPodX;
      h.y = h.dropPodY;
      return;
    }

    if (h.stunTimer > 0 || h.dashTimer > 0) {
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      return;
    }

    const kin = {
      x: h.x,
      y: h.y,
      vx: h.vx,
      vy: h.vy,
      grounded: h.grounded,
      coyote: this.predCoyote,
      jumpBuffer: this.predJumpBuffer,
      jumpsLeft: this.predJumpsLeft,
      dropThrough: this.predDropThrough,
      hoverFuel: this.predHoverFuel,
      isHovering: h.isHovering,
    };

    this.stepLocalHeroPhysics(kin, h, pkt, dt, true);

    h.x = kin.x;
    h.y = kin.y;
    h.vx = kin.vx;
    h.vy = kin.vy;
    h.grounded = kin.grounded;
    h.isHovering = kin.isHovering;
    this.predCoyote = kin.coyote;
    this.predJumpBuffer = kin.jumpBuffer;
    this.predJumpsLeft = kin.jumpsLeft;
    this.predDropThrough = kin.dropThrough;
    this.predHoverFuel = kin.hoverFuel;
  }

  private applyServerSnapshot(snap: WorldSnapshot, hardReset: boolean): void {
    this.latestSnapshot = snap;
    if (hardReset || Math.abs(snap.matchTime - this.renderTime) > 0.6) {
      this.renderTime = snap.matchTime;
    } else {
      // Smoothly phase-lock renderTime so visual oscillators never jump backward every 33ms
      this.renderTime += (snap.matchTime - this.renderTime) * 0.12;
    }
    this.waveTier = snap.waveTier;
    this.waveTierName = snap.waveTierName;
    this.blueKills = snap.blueKills;
    this.redKills = snap.redKills;
    this.onlineHumanCount = snap.humanCount;
    this.banner = snap.banner;
    this.killFeed = snap.killFeed ?? [];

    if (snap.phase === 'VICTORY' || snap.phase === 'DEFEAT') {
      const blueWon = snap.phase === 'VICTORY';
      const winner: Team = blueWon ? 'blue' : 'red';
      this.phase = (this.playerTeam === 'blue') === blueWon ? 'VICTORY' : 'DEFEAT';
      this.startEndCinematic(winner);
    } else {
      if (this.phase === 'VICTORY' || this.phase === 'DEFEAT') {
        this.endCinematic = null;
        gameAudio.setMusicMode('battle');
      }
      this.phase = snap.phase;
    }

    // Heroes reconciliation & interpolation
    const seenHeroIds = new Set<string>();
    for (const sh of snap.heroes) {
      seenHeroIds.add(sh.id);
      const def = HERO_MAP[sh.heroId];
      const existing = this.mirrorHeroes.get(sh.id);
      const isMe = sh.id === this.playerEntityId;

      if (!existing || hardReset) {
        this.mirrorHeroes.set(sh.id, {
          id: sh.id,
          heroId: sh.heroId,
          name: isMe ? `${sh.name} (You)` : sh.name,
          team: sh.team,
          isPlayer: isMe,
          x: sh.x,
          y: sh.y,
          vx: sh.vx,
          vy: sh.vy,
          w: def.width,
          h: def.height,
          facing: sh.facing,
          aimAngle: sh.aimAngle,
          hp: sh.hp,
          maxHp: sh.maxHp,
          bonusMaxHp: sh.bonusMaxHp,
          shield: sh.shield,
          solar: sh.solar,
          totalSolarEarned: sh.totalSolarEarned,
          totalSolarSpent: sh.totalSolarSpent,
          upgrades: { ...sh.upgrades },
          grounded: sh.grounded,
          coyoteTimer: 0,
          jumpBufferTimer: 0,
          jumpsRemaining: def.maxJumps,
          dropThroughTimer: 0,
          hoverFuel: 1,
          isHovering: sh.isHovering,
          primaryCd: sh.primaryCd,
          skill1Cd: sh.skill1Cd,
          skill2Cd: sh.skill2Cd,
          primaryShotCounter: 0,
          alive: sh.alive,
          respawnTimer: sh.respawnTimer,
          inDropPod: sh.inDropPod,
          dropPodX: sh.dropPodX,
          dropPodY: sh.dropPodY,
          dropPodSolars: sh.dropPodSolars,
          recallTimer: sh.recallTimer,
          stunTimer: sh.stunTimer,
          slowTimer: sh.slowTimer,
          hitFlashTimer: sh.hitFlashTimer,
          invulnTimer: 0,
          dashTimer: sh.dashTimer,
          dashVx: 0,
          dashVy: 0,
          dashHitIds: new Set(),
          spinTimer: sh.spinTimer,
          spinTickTimer: 0,
          rotTimer: sh.rotTimer,
          rotTickTimer: 0,
          cloakTimer: sh.cloakTimer,
          cloakCritReady: sh.cloakCritReady,
          meltdownTimer: sh.meltdownTimer,
          meltdownMaxTimer: sh.meltdownMaxTimer,
          hookedById: sh.hookedById,
          venomStacks: sh.venomStacks ?? 0,
          venomTimer: sh.venomTimer ?? 0,
          venomDps: 0,
          venomOwnerId: null,
          venomTickTimer: 0.4,
          burnTimer: sh.burnTimer ?? 0,
          burnDps: 0,
          burnOwnerId: null,
          burnTickTimer: 0.4,
          hasteTimer: sh.hasteTimer ?? 0,
          squashX: 1,
          squashY: 1,
          walkCycle: sh.walkCycle,
          recoilTimer: sh.recoilTimer,
          kills: sh.kills,
          deaths: sh.deaths,
          assists: sh.assists,
          droidKills: sh.droidKills,
          lastDamagedById: null,
          lastDamagedTimer: 0,
          aiLane: 'bot',
          aiState: 'lane',
          aiDecisionTimer: 0,
          aiTargetX: sh.x,
          aiTargetY: sh.y,
          aiJumpCooldown: 0,
        });
      } else {
        existing.heroId = sh.heroId;
        existing.name = isMe ? `${sh.name} (You)` : sh.name;
        existing.team = sh.team;
        existing.isPlayer = isMe;
        existing.w = def.width;
        existing.h = def.height;
        existing.hp = sh.hp;
        existing.maxHp = sh.maxHp;
        existing.bonusMaxHp = sh.bonusMaxHp;
        existing.shield = sh.shield;
        existing.solar = sh.solar;
        existing.totalSolarEarned = sh.totalSolarEarned;
        existing.totalSolarSpent = sh.totalSolarSpent;
        existing.upgrades = { ...sh.upgrades };
        existing.primaryCd = sh.primaryCd;
        existing.skill1Cd = sh.skill1Cd;
        existing.skill2Cd = sh.skill2Cd;
        existing.alive = sh.alive;
        existing.respawnTimer = sh.respawnTimer;
        existing.inDropPod = sh.inDropPod;
        existing.dropPodSolars = sh.dropPodSolars;
        existing.recallTimer = sh.recallTimer;
        existing.stunTimer = sh.stunTimer;
        existing.slowTimer = sh.slowTimer;
        existing.hitFlashTimer = sh.hitFlashTimer;
        existing.dashTimer = sh.dashTimer;
        existing.spinTimer = sh.spinTimer;
        existing.rotTimer = sh.rotTimer;
        existing.cloakTimer = sh.cloakTimer;
        existing.cloakCritReady = sh.cloakCritReady;
        existing.meltdownTimer = sh.meltdownTimer;
        existing.meltdownMaxTimer = sh.meltdownMaxTimer;
        existing.hookedById = sh.hookedById;
        existing.venomStacks = sh.venomStacks ?? 0;
        existing.venomTimer = sh.venomTimer ?? 0;
        existing.burnTimer = sh.burnTimer ?? 0;
        existing.hasteTimer = sh.hasteTimer ?? 0;
        existing.recoilTimer = sh.recoilTimer;
        existing.kills = sh.kills;
        existing.deaths = sh.deaths;
        existing.assists = sh.assists;
        existing.droidKills = sh.droidKills;

        if (isMe) {
          // Prune acknowledged inputs using server's lastAckSeq
          if (sh.lastAckSeq > 0) {
            while (this.pendingInputs.length > 0 && this.pendingInputs[0].seq <= sh.lastAckSeq) {
              this.pendingInputs.shift();
            }
          }

          if (sh.inDropPod) {
            this.pendingInputs.length = 0;
            const podErr = Math.hypot(sh.dropPodX - existing.dropPodX, sh.dropPodY - existing.dropPodY);
            if (podErr > 120) {
              existing.dropPodX = sh.dropPodX;
              existing.dropPodY = sh.dropPodY;
            } else {
              existing.dropPodX += (sh.dropPodX - existing.dropPodX) * 0.28;
              existing.dropPodY += (sh.dropPodY - existing.dropPodY) * 0.28;
            }
            existing.x = existing.dropPodX;
            existing.y = existing.dropPodY;
            existing.vx = sh.vx;
            existing.vy = sh.vy;
            existing.grounded = false;
          } else if (sh.dashTimer > 0 || sh.hookedById || !sh.alive || sh.stunTimer > 0) {
            this.pendingInputs.length = 0;
            existing.x = sh.x;
            existing.y = sh.y;
            existing.vx = sh.vx;
            existing.vy = sh.vy;
            existing.grounded = sh.grounded;
          } else {
            // Replay unacknowledged inputs on top of authoritative server state
            const stats = computeHeroStats(existing.heroId, existing.upgrades, existing.bonusMaxHp);
            const rec = {
              x: sh.x,
              y: sh.y,
              vx: sh.vx,
              vy: sh.vy,
              grounded: sh.grounded,
              coyote: sh.grounded ? 0.11 : this.predCoyote,
              jumpBuffer: 0,
              jumpsLeft: sh.grounded ? def.maxJumps + stats.extraJumps : this.predJumpsLeft,
              dropThrough: this.predDropThrough,
              hoverFuel: sh.grounded ? 1 : this.predHoverFuel,
              isHovering: sh.isHovering,
            };
            for (const entry of this.pendingInputs) {
              this.stepLocalHeroPhysics(rec, existing, entry.pkt, entry.dt, false);
            }

            const err = Math.hypot(rec.x - existing.x, rec.y - existing.y);
            if (err > 120) {
              existing.x = rec.x;
              existing.y = rec.y;
              existing.vx = rec.vx;
              existing.vy = rec.vy;
              existing.grounded = rec.grounded;
            } else if (err > 4) {
              existing.x += (rec.x - existing.x) * 0.22;
              existing.y += (rec.y - existing.y) * 0.22;
              if (err > 28) {
                existing.vx += (rec.vx - existing.vx) * 0.3;
                existing.vy += (rec.vy - existing.vy) * 0.3;
                existing.grounded = rec.grounded;
              }
            }
          }
        } else {
          const err = Math.hypot(sh.x - existing.x, sh.y - existing.y);
          if (err > 140 || sh.hookedById) {
            existing.x = sh.x;
            existing.y = sh.y;
          }
          this.remoteHeroTargets.set(sh.id, { x: sh.x, y: sh.y, vx: sh.vx, vy: sh.vy });
          existing.vx = sh.vx;
          existing.vy = sh.vy;
          existing.facing = sh.facing;
          existing.aimAngle = sh.aimAngle;
          existing.grounded = sh.grounded;
          existing.isHovering = sh.isHovering;
          existing.dropPodX = sh.dropPodX;
          existing.dropPodY = sh.dropPodY;
        }
      }
    }
    for (const id of this.mirrorHeroes.keys()) {
      if (!seenHeroIds.has(id)) {
        this.mirrorHeroes.delete(id);
        this.remoteHeroTargets.delete(id);
      }
    }

    // Droids
    const seenDroids = new Set<string>();
    for (const sd of snap.droids) {
      seenDroids.add(sd.id);
      const ex = this.mirrorDroids.get(sd.id);
      if (!ex) {
        this.mirrorDroids.set(sd.id, {
          ...sd,
          w: sd.tier >= 5 ? 30 : 26,
          h: sd.tier >= 5 ? 36 : 32,
          damage: 14,
          attackCd: 0,
          grounded: true,
          slowTimer: 0,
          stunTimer: 0,
          venomStacks: sd.venomStacks ?? 0,
          venomTimer: (sd.venomStacks ?? 0) > 0 ? 2 : 0,
          venomDps: 0,
          venomOwnerId: null,
          venomTickTimer: 0.4,
          burnTimer: sd.burnTimer ?? 0,
          burnDps: 0,
          burnOwnerId: null,
          burnTickTimer: 0.4,
        });
        this.remoteDroidTargets.set(sd.id, { x: sd.x, y: sd.y, vx: sd.vx, vy: sd.vy });
      } else {
        const err = Math.hypot(sd.x - ex.x, sd.y - ex.y);
        if (err > 120) {
          ex.x = sd.x;
          ex.y = sd.y;
        }
        this.remoteDroidTargets.set(sd.id, { x: sd.x, y: sd.y, vx: sd.vx, vy: sd.vy });
        ex.vx = sd.vx;
        ex.vy = sd.vy;
        ex.hp = sd.hp;
        ex.tier = sd.tier;
        ex.facing = sd.facing;
        ex.hitFlashTimer = sd.hitFlashTimer;
        ex.venomStacks = sd.venomStacks ?? 0;
        ex.venomTimer = (sd.venomStacks ?? 0) > 0 ? 2 : 0;
        ex.burnTimer = sd.burnTimer ?? 0;
      }
    }
    for (const id of this.mirrorDroids.keys()) {
      if (!seenDroids.has(id)) {
        this.mirrorDroids.delete(id);
        this.remoteDroidTargets.delete(id);
      }
    }

    // Turrets
    this.mirrorTurrets.clear();
    for (const st of snap.turrets) {
      this.mirrorTurrets.set(st.id, {
        ...st,
        w: st.tier === 'inner' ? 72 : 64,
        h: st.tier === 'inner' ? 112 : 98,
        attackCd: 0,
        range: 365,
      });
    }

    // Cores
    this.mirrorCores.clear();
    for (const sc of snap.cores) {
      this.mirrorCores.set(sc.id, { ...sc, w: 118, h: 164, pulsePhase: 0 });
    }

    // Creeps
    this.mirrorCreeps.clear();
    for (const cr of snap.creeps) {
      this.mirrorCreeps.set(cr.id, { ...cr, homeX: cr.x, homeY: cr.y, respawnTimer: 0 });
    }

    // Solar Cubes
    this.mirrorSolars.clear();
    for (const s of snap.solarCubes) {
      this.mirrorSolars.set(s.id, { ...s, respawnTimer: 0 });
    }

    // Projectiles
    const seenProj = new Set<string>();
    for (const sp of snap.projectiles) {
      seenProj.add(sp.id);
      const ex = this.mirrorProjectiles.get(sp.id);
      if (!ex) {
        this.mirrorProjectiles.set(sp.id, {
          ...sp,
          damage: 0,
          healAmount: 0,
          healSolarBonus: 0,
          splashRadius: 0,
          gravity: 0,
          bouncesLeft: 0,
          pierce: false,
          hitIds: new Set(),
          slowDuration: 0,
          stunDuration: 0,
          life: 1,
          maxLife: 1,
          lifestealRatio: 0,
        });
      } else {
        ex.x += (sp.x - ex.x) * 0.65;
        ex.y += (sp.y - ex.y) * 0.65;
        ex.vx = sp.vx;
        ex.vy = sp.vy;
      }
    }
    for (const id of this.mirrorProjectiles.keys()) {
      if (!seenProj.has(id)) this.mirrorProjectiles.delete(id);
    }

    // Summons
    this.mirrorSummons.clear();
    for (const ss of snap.summons) {
      this.mirrorSummons.set(ss.id, {
        ...ss,
        vx: 0,
        vy: 0,
        w: ss.kind === 'bull' ? 54 : 28,
        h: ss.kind === 'bull' ? 40 : 38,
        damage: 0,
        knockback: 0,
        tickTimer: 0,
        orbitAngle: 0,
        orbitIndex: 0,
        explodeOnEnd: false,
        hitIds: new Set(),
      });
    }

    // Hooks
    this.mirrorHooks.clear();
    for (const hk of snap.hooks) {
      this.mirrorHooks.set(hk.id, {
        ...hk,
        vx: 0,
        vy: 0,
        maxRange: 700,
        damage: 0,
        stunDuration: 0,
        latchedTargetKind: null,
      });
    }

    // Hazards
    this.mirrorHazards.clear();
    for (const hz of snap.hazards) {
      this.mirrorHazards.set(hz.id, {
        ...hz,
        damage: 0,
        tickTimer: 0,
        stunDuration: 0,
      });
    }

    if (snap.fx.length > 0) {
      this.processFxEvents(snap.fx);
    }
  }

  // === FX EVENT PROCESSOR ===
  private processFxEvents(events: SimFxEvent[]): void {
    const me = this.getLocalPlayerHero();
    const isNear = (x: number, y: number, d = 680) => !me || Math.hypot(me.x - x, me.y - y) < d;
    const distVol = (x: number, y: number, mine: boolean, maxDist = 780): number => {
      if (mine) return 1;
      if (!me) return 0.45;
      const d = Math.hypot(me.x - x, me.y - y);
      if (d >= maxDist) return 0;
      return Math.max(0.18, (1 - d / maxDist) * 0.52);
    };

    for (const ev of events) {
      if (ev.kind === 'shoot') {
        const mine = ev.ownerId === this.playerEntityId;
        const vol = distVol(ev.x, ev.y, mine, 680);
        if (vol > 0) {
          if (ev.heroId === 'marrow') gameAudio.shootCleaver(vol);
          else if (ev.heroId === 'seraph') gameAudio.shootRadiant(vol);
          else if (ev.heroId === 'vexia') gameAudio.shootRevolver(vol);
          else if (ev.heroId === 'vorg') gameAudio.shootSonic(vol);
          else if (ev.heroId === 'xylar') gameAudio.shootPlasmaDagger(vol);
          else if (ev.heroId === 'bastion') gameAudio.shootMortar(vol);
          else if (ev.heroId === 'caldris') gameAudio.shootSoulRail(vol);
          else if (ev.heroId === 'vespra') gameAudio.shootVenom(vol);
          else if (ev.heroId === 'vale') gameAudio.shootPrism(vol);
          else gameAudio.shootBioBeam(vol);
        }
      } else if (ev.kind === 'ability') {
        const mine = ev.ownerId === this.playerEntityId;
        heroAbilityVfx(ev.tag, ev.x, ev.y, this.getHeroById(ev.ownerId));
        const vol = distVol(ev.x, ev.y, mine, 820);
        if (ev.tag === 'hook') {
          this.spawnParticles(ev.x, ev.y, '#94A3B8', 8, 150, 'spark');
          if (vol > 0) gameAudio.hookLaunch(vol);
        } else if (ev.tag === 'hook_hit') {
          this.spawnParticles(ev.x, ev.y, '#34D399', 18, 240, 'spark');
          if (vol > 0) {
            gameAudio.hookLatch(vol);
            if (mine || isNear(ev.x, ev.y, 460)) {
              this.hitstopTimer = 0.04;
              this.addShake(mine ? 8 : 4.5);
            }
          }
        } else if (ev.tag === 'rot') {
          this.spawnParticles(ev.x, ev.y, '#10B981', 16, 160, 'circle');
          if (vol > 0) gameAudio.blightRot(vol);
        } else if (ev.tag === 'spear' && vol > 0) {
          gameAudio.shootRadiant(vol);
        } else if (ev.tag === 'aegis') {
          this.spawnParticles(ev.x, ev.y, '#FBBF24', 18, 220, 'spark');
          if (vol > 0) gameAudio.aegisPulse(vol);
        } else if (ev.tag === 'vortex') {
          this.spawnParticles(ev.x, ev.y, '#818CF8', 14, 180, 'spark');
          if (vol > 0) gameAudio.vortexPull(vol);
        } else if (ev.tag === 'cloak') {
          this.spawnParticles(ev.x, ev.y, '#38BDF8', 12, 160, 'circle');
          if (vol > 0) gameAudio.cloakVanish(vol);
        } else if (ev.tag === 'orbital') {
          this.spawnRing(ev.x, ev.y, 110, '#2DD4BF');
          if (vol > 0) gameAudio.orbitalCharge(vol);
        } else if (ev.tag === 'undead') {
          this.spawnParticles(ev.x, ev.y, '#2DD4BF', 16, 170, 'spark');
          if (vol > 0) gameAudio.droneSpawn(vol);
        } else if (ev.tag === 'dynamite' && vol > 0) {
          gameAudio.throwDynamite(vol);
        } else if (ev.tag === 'bull') {
          this.spawnParticles(ev.x, ev.y, '#38BDF8', 14, 180, 'spark');
          if (vol > 0) gameAudio.bullCharge(vol);
        } else if (ev.tag === 'dash') {
          this.spawnParticles(ev.x, ev.y, '#A855F7', 14, 210, 'spark');
          if (vol > 0) gameAudio.hydroDash(vol);
        } else if (ev.tag === 'spin' && vol > 0) {
          gameAudio.whirlpool(vol);
        } else if (ev.tag === 'bite') {
          this.spawnParticles(ev.x, ev.y, '#FBBF24', 14, 180, 'spark');
          if (vol > 0) {
            gameAudio.bite(vol);
            if (mine) this.addShake(5);
          }
        } else if (ev.tag === 'meltdown' && vol > 0) {
          gameAudio.meltdownCharge(vol);
        } else if (ev.tag === 'totem' && vol > 0) {
          gameAudio.totemDeploy(vol);
        } else if (ev.tag === 'drone' && vol > 0) {
          gameAudio.droneSpawn(vol);
        } else if (ev.tag === 'censer') {
          this.spawnParticles(ev.x, ev.y, '#84CC16', 14, 175, 'circle');
          if (vol > 0) gameAudio.plagueCloud(vol);
        } else if (ev.tag === 'contagion') {
          this.spawnParticles(ev.x, ev.y, '#A3E635', 22, 260, 'spark');
          this.spawnParticles(ev.x, ev.y, '#10B981', 12, 160, 'circle');
          if (vol > 0) {
            gameAudio.contagionBurst(vol);
            if (mine) this.addShake(6.5);
          }
        } else if (ev.tag === 'flare') {
          this.spawnParticles(ev.x, ev.y, '#F59E0B', 16, 200, 'spark');
          if (vol > 0) gameAudio.solarFlare(vol);
        } else if (ev.tag === 'blink') {
          this.spawnParticles(ev.x, ev.y, '#38BDF8', 18, 230, 'spark');
          this.spawnParticles(ev.x, ev.y, '#FDE047', 10, 170, 'circle');
          if (vol > 0) {
            gameAudio.chronoBlink(vol);
            if (mine) this.addShake(4.5);
          }
        }

        // Champion ability voice quips for the local player (throttled cleanly by VoiceManager)
        if (mine) {
          const hero = this.getLocalPlayerHero();
          if (hero) {
            const skill1Tags = new Set([
              'hook_hit',
              'spear',
              'totem',
              'dash',
              'bite',
              'dynamite',
              'vortex',
              'orbital',
              'censer',
              'flare',
            ]);
            const skill2Tags = new Set([
              'rot',
              'aegis',
              'drone',
              'spin',
              'meltdown',
              'bull',
              'cloak',
              'undead',
              'contagion',
              'blink',
            ]);
            if (skill1Tags.has(ev.tag)) {
              gameVoices.playChampionLine(hero.heroId, 'skill1', {
                chance: ev.tag === 'hook_hit' ? 0.85 : 0.55,
              });
            } else if (skill2Tags.has(ev.tag)) {
              gameVoices.playChampionLine(hero.heroId, 'skill2', { chance: 0.55 });
            }
          }
        }
      } else if (ev.kind === 'explosion') {
        this.spawnRing(ev.x, ev.y, ev.radius, ev.color);
        this.spawnParticles(ev.x, ev.y, '#FDE047', ev.heavy ? 24 : 12, ev.heavy ? 320 : 210, 'spark');
        this.spawnParticles(ev.x, ev.y, ev.color, ev.heavy ? 16 : 8, 180, 'circle');
        const mine = ev.ownerId === this.playerEntityId;
        const vol = distVol(ev.x, ev.y, mine, 860);
        if (vol > 0) {
          gameAudio.explosion(ev.heavy, vol);
          if (ev.heavy) {
            this.hitstopTimer = 0.05;
            this.addShake(mine ? 11 : 6.5);
          } else if (mine) {
            this.addShake(5.5);
          }
        }
      } else if (ev.kind === 'hit') {
        this.spawnParticles(ev.x, ev.y, ev.color, 6, 130, 'spark');
        if (ev.ownerId === this.playerEntityId) gameAudio.hitConfirm();
      } else if (ev.kind === 'solar') {
        this.spawnParticles(ev.x, ev.y, '#FBBF24', 8, 130, 'spark');
        if (ev.heroEntityId === this.playerEntityId) {
          gameAudio.solarPickup();
          this.spawnText(ev.x, ev.y, `+${ev.amount} Relic`, '#FBBF24', 0.95);
        }
      } else if (ev.kind === 'upgrade') {
        this.spawnRing(ev.x, ev.y, 76, '#FBBF24');
        this.spawnParticles(ev.x, ev.y, '#FBBF24', 22, 240, 'spark');
        this.spawnParticles(ev.x, ev.y, '#FEF08A', 10, 160, 'circle');
        if (ev.heroEntityId === this.playerEntityId) {
          const hero = this.getLocalPlayerHero();
          const hasAsc = Boolean(
            hero &&
              ((hero.upgrades['asc_wrath'] ?? 0) > 0 ||
                (hero.upgrades['asc_titan'] ?? 0) > 0 ||
                (hero.upgrades['asc_alacrity'] ?? 0) > 0 ||
                (hero.upgrades['asc_siege'] ?? 0) > 0)
          );
          gameAudio.upgradeBuy(hasAsc);
          if (hero) {
            gameVoices.playChampionLine(hero.heroId, 'upgrade', { chance: 0.65 });
          }
        }
      } else if (ev.kind === 'jump') {
        this.spawnParticles(
          ev.x,
          ev.y,
          ev.doubleJump ? ev.color : '#CBD5E1',
          ev.doubleJump ? 9 : 5,
          ev.doubleJump ? 130 : 80,
          'circle'
        );
        if (ev.doubleJump) this.spawnRing(ev.x, ev.y, 34, ev.color);
        if (ev.heroEntityId === this.playerEntityId) gameAudio.jump(ev.doubleJump);
      } else if (ev.kind === 'jumppad') {
        this.spawnRing(ev.x, ev.y, 58, ev.color);
        this.spawnParticles(ev.x, ev.y, ev.color, 16, 220, 'spark');
        this.spawnParticles(ev.x, ev.y, '#FEF08A', 8, 160, 'circle');
        if (ev.heroEntityId === this.playerEntityId) gameAudio.jumpPad();
      } else if (ev.kind === 'dropSlam') {
        this.spawnRing(ev.x, ev.y, 88, '#F59E0B');
        this.spawnParticles(ev.x, ev.y, '#F59E0B', 24, 260, 'spark');
        this.spawnParticles(ev.x, ev.y, '#94A3B8', 12, 160, 'circle');
        if (ev.heroEntityId === this.playerEntityId) {
          gameAudio.dropPodSlam();
          this.addShake(9);
          const hero = this.getLocalPlayerHero();
          if (hero) {
            gameVoices.playChampionLine(hero.heroId, 'spawn');
          }
        }
      } else if (ev.kind === 'kill') {
        this.spawnParticles(ev.x, ev.y, '#F59E0B', 24, 260, 'spark');
        this.spawnParticles(ev.x, ev.y, ev.team === 'blue' ? '#38BDF8' : '#F43F5E', 16, 200, 'square');
        this.spawnRing(ev.x, ev.y, 72, '#FBBF24');
        if (!this.firstBloodAnnounced) {
          this.firstBloodAnnounced = true;
          gameVoices.playAnnouncerLine('first_blood');
        } else if (ev.killerId === this.playerEntityId) {
          const hero = this.getLocalPlayerHero();
          if (hero) {
            gameVoices.playChampionLine(hero.heroId, 'kill');
          }
        }
        if (ev.killerId === this.playerEntityId || ev.victimId === this.playerEntityId) {
          gameAudio.killBanner();
          this.hitstopTimer = 0.055;
          this.addShake(11);
        }
      } else if (ev.kind === 'ring') {
        this.spawnRing(ev.x, ev.y, ev.radius, ev.color);
      } else if (ev.kind === 'text') {
        if (!ev.targetId || ev.targetId === this.playerEntityId) {
          if (isNear(ev.x, ev.y, 720)) {
            this.spawnText(ev.x, ev.y, ev.text, ev.color, ev.scale);
          }
        }
      } else if (ev.kind === 'victory') {
        this.startEndCinematic(ev.winner);
        this.clearHeldInputs();
      }
    }
  }

  private clearEdgeTriggers(): void {
    this.queuedJump = false;
    this.queuedDrop = false;
    this.queuedSkill1 = false;
    this.queuedSkill2 = false;
    this.queuedRecall = false;
  }

  /**
   * Sizes the canvas backing store: static cap (~1.6 MP) x dynamic scale. Every second, if the
   * game averaged under ~55fps the resolution drops a step (down to 55%); after a quiet period at
   * a solid 60 it tries one step sharper, backing off longer each time that fails. The visible
   * world area never changes — only how many pixels are drawn to show it.
   */
  private updateRenderResolution(rawDt: number): void {
    const cw = this.canvas.clientWidth;
    const ch = this.canvas.clientHeight;
    if (!cw || !ch) return;

    // A hidden/backgrounded tab is throttled by the browser: those frame times say nothing about
    // how fast the game can render, so never let them lower the resolution.
    const hidden = typeof document !== 'undefined' && document.hidden;
    if (hidden) {
      this.perfTime = 0;
      this.perfFrames = 0;
      this.wasHidden = true;
    } else if (this.wasHidden) {
      // Back in focus: settle for a moment, then allow sharpening again right away
      this.wasHidden = false;
      this.perfCooldown = 1;
      this.sharpenBlockedFor = 0;
      this.sharpenBackoff = 8;
    }
    this.fpsMeterTime += rawDt;
    this.fpsMeterFrames += 1;
    if (this.fpsMeterTime >= 0.5) {
      this.fpsMeterValue = this.fpsMeterFrames / this.fpsMeterTime;
      this.fpsMeterTime = 0;
      this.fpsMeterFrames = 0;
    }

    if (!hidden && this.forcedScale === null && rawDt > 0 && rawDt < 0.25) {
      this.perfTime += rawDt;
      this.perfFrames += 1;
      this.sharpenBlockedFor = Math.max(0, this.sharpenBlockedFor - rawDt);
      this.sharpenTrial = Math.max(0, this.sharpenTrial - rawDt);
      if (this.perfTime >= 1) {
        const fps = this.perfFrames / this.perfTime;
        this.perfTime = 0;
        this.perfFrames = 0;
        if (this.perfCooldown > 0) {
          this.perfCooldown -= 1; // let the new resolution settle before judging it
        } else if (fps < 55 && this.dynScale > 0.55) {
          const sharpenFailed = this.sharpenTrial > 0;
          this.sharpenTrial = 0;
          this.dynScale = Math.max(0.55, Math.round((this.dynScale - 0.1) * 100) / 100);
          this.perfCooldown = 1;
          // Couldn't hold 60 here: wait longer before trying to sharpen again
          this.sharpenBlockedFor = this.sharpenBackoff;
          if (sharpenFailed) this.sharpenBackoff = Math.min(120, this.sharpenBackoff * 2);
        } else if (fps >= 58.5 && this.dynScale < 1 && this.sharpenBlockedFor <= 0) {
          this.dynScale = Math.min(1, Math.round((this.dynScale + 0.1) * 100) / 100);
          this.perfCooldown = 1;
          this.sharpenBlockedFor = 3;
          this.sharpenTrial = 5;
        }
      }
    }

    const staticCap = Math.min(1, Math.sqrt(MAX_RENDER_PIXELS / (cw * ch)));
    const scale = staticCap * (this.forcedScale ?? this.dynScale);
    const w = Math.max(1, Math.round(cw * scale));
    const h = Math.max(1, Math.round(ch * scale));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  /** Current render scale (backing px per CSS px), for debugging / a future graphics menu. */
  public getRenderScale(): number {
    return this.canvas.width / this.viewW;
  }

  /** Visible area in CSS pixels. The canvas backing store may be smaller (see App.tsx resize). */
  private get viewW(): number {
    return this.canvas.clientWidth || this.canvas.width;
  }
  private get viewH(): number {
    return this.canvas.clientHeight || this.canvas.height;
  }

  private getHeroById(id: string): HeroEntity | undefined {
    if (this.mode === 'solo' && this.localSim) return this.localSim.heroes.find((h) => h.id === id);
    return this.mirrorHeroes.get(id);
  }

  private getLocalPlayerHero(): HeroEntity | undefined {
    if (this.mode === 'solo' && this.localSim) {
      return this.localSim.heroes.find((h) => h.id === this.playerEntityId);
    }
    return this.mirrorHeroes.get(this.playerEntityId);
  }

  private spawnParticles(
    x: number,
    y: number,
    color: string,
    count: number,
    speed: number,
    shape: Particle['shape']
  ): void {
    if (this.particles.length > 260) return;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.3 + Math.random() * 0.7) * speed;
      const life = 0.22 + Math.random() * 0.34;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        size: 3 + Math.random() * 4.5,
        color,
        life,
        maxLife: life,
        gravity: shape === 'spark' ? 420 : 120,
        shape,
      });
    }
  }

  private spawnRing(x: number, y: number, radius: number, color: string): void {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      size: radius * 0.65,
      color,
      life: 0.26,
      maxLife: 0.26,
      gravity: 0,
      shape: 'ring',
    });
  }

  private spawnText(x: number, y: number, text: string, color: string, scale = 1): void {
    this.floatingTexts.push({
      x,
      y,
      vy: -52,
      text,
      color,
      life: 0.85,
      maxLife: 0.85,
      scale,
    });
  }

  private updateEffects(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      pt.vy += pt.gravity * dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.y += ft.vy * dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  private addShake(mag: number): void {
    this.shakeMag = Math.min(20, Math.max(this.shakeMag, mag));
    if (mag >= 4) this.rumble(mag / 14, 70 + mag * 9);
  }

  private updateShake(dt: number): void {
    if (this.shakeMag > 0.2) {
      this.shakeX = (Math.random() - 0.5) * 2 * this.shakeMag;
      this.shakeY = (Math.random() - 0.5) * 2 * this.shakeMag;
      this.shakeMag *= Math.pow(0.015, dt);
    } else {
      this.shakeMag = 0;
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  private updateCamera(player: HeroEntity, dt: number): void {
    const vw = this.viewW;
    const vh = this.viewH;
    const lookAheadX = player.alive && !player.inDropPod ? Math.cos(player.aimAngle) * 78 : 0;
    const targetX = player.x + lookAheadX - vw * 0.5;
    const targetY = player.y - vh * 0.52;

    const clampedX = Math.max(0, Math.min(Math.max(0, WORLD_W - vw), targetX));
    const clampedY = Math.max(0, Math.min(Math.max(0, WORLD_H - vh), targetY));

    const lerp = Math.min(1, dt * 8.5);
    this.camX += (clampedX - this.camX) * lerp;
    this.camY += (clampedY - this.camY) * lerp;
  }

  private render(): void {
    const heroes = this.mode === 'solo' && this.localSim ? this.localSim.heroes : Array.from(this.mirrorHeroes.values());
    const droids = this.mode === 'solo' && this.localSim ? this.localSim.droids : Array.from(this.mirrorDroids.values());
    const turrets = this.mode === 'solo' && this.localSim ? this.localSim.turrets : Array.from(this.mirrorTurrets.values());
    const cores = this.mode === 'solo' && this.localSim ? this.localSim.cores : Array.from(this.mirrorCores.values());
    const creeps = this.mode === 'solo' && this.localSim ? this.localSim.creeps : Array.from(this.mirrorCreeps.values());
    const solarCubes = this.mode === 'solo' && this.localSim ? this.localSim.solarCubes : Array.from(this.mirrorSolars.values());
    const projectiles = this.mode === 'solo' && this.localSim ? this.localSim.projectiles : Array.from(this.mirrorProjectiles.values());
    const summons = this.mode === 'solo' && this.localSim ? this.localSim.summons : Array.from(this.mirrorSummons.values());
    const hooks = this.mode === 'solo' && this.localSim ? this.localSim.hooks : Array.from(this.mirrorHooks.values());
    const hazards = this.mode === 'solo' && this.localSim ? this.localSim.hazards : Array.from(this.mirrorHazards.values());

    const renderScale = this.canvas.width / this.viewW;
    this.ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    renderArena(this.ctx, this.viewW, this.viewH, {
      time: this.renderTime,
      localTeam: this.playerTeam,
      camX: this.camX,
      camY: this.camY,
      shakeX: this.shakeX,
      shakeY: this.shakeY,
      mouseScreenX: this.mouseScreenX,
      mouseScreenY: this.mouseScreenY,
      mouseWorldX: this.mouseWorldX,
      mouseWorldY: this.mouseWorldY,
      heroes,
      droids,
      turrets,
      cores,
      creeps,
      solarCubes,
      projectiles,
      summons,
      hooks,
      hazards,
      particles: this.particles,
      floatingTexts: this.floatingTexts,
      endCinematic: this.endCinematic,
    });
    if (this.showFps) {
      const label = `${Math.round(this.fpsMeterValue)} fps  ·  render ${Math.round(renderScale * 100)}%  ·  ${this.canvas.width}x${this.canvas.height}`;
      this.ctx.save();
      this.ctx.font = '600 12px "JetBrains Mono", monospace';
      this.ctx.fillStyle = 'rgba(0,0,0,0.6)';
      this.ctx.fillRect(12, 44, this.ctx.measureText(label).width + 16, 22);
      this.ctx.fillStyle = this.fpsMeterValue >= 55 ? '#4ADE80' : this.fpsMeterValue >= 40 ? '#FDE047' : '#F87171';
      this.ctx.fillText(label, 20, 60);
      this.ctx.restore();
    }
  }

  private emitHud(): void {
    const heroes = this.mode === 'solo' && this.localSim ? this.localSim.heroes : Array.from(this.mirrorHeroes.values());
    const droids = this.mode === 'solo' && this.localSim ? this.localSim.droids : Array.from(this.mirrorDroids.values());
    const turrets = this.mode === 'solo' && this.localSim ? this.localSim.turrets : Array.from(this.mirrorTurrets.values());
    const cores = this.mode === 'solo' && this.localSim ? this.localSim.cores : Array.from(this.mirrorCores.values());
    const summons = this.mode === 'solo' && this.localSim ? this.localSim.summons : Array.from(this.mirrorSummons.values());

    const player = heroes.find((h) => h.id === this.playerEntityId);
    const blueCore = cores.find((c) => c.team === 'blue');
    const redCore = cores.find((c) => c.team === 'red');
    if (!player || !blueCore || !redCore) return;

    const stats = computeHeroStats(player.heroId, player.upgrades, player.bonusMaxHp);
    const def = HERO_MAP[player.heroId];
    const affordableTalents = def.upgrades.filter(
      (u) => canForgeTalent(player.upgrades, player.heroId, u, player.solar).allowed
    ).length;
    const affordableAscensions = ASCENSION_INFUSIONS.filter(
      (inf) => canForgeAscension(player.upgrades, player.heroId, inf, player.solar).allowed
    ).length;
    const affordableUpgrades = affordableTalents + affordableAscensions;
    const takenHumanHeroes: HeroId[] =
      this.mode === 'solo' && this.localSim
        ? this.localSim.getHumanTakenHeroes()
        : (this.latestSnapshot?.heroes ?? [])
            .filter((sh) => sh.isHuman && sh.id !== this.playerEntityId)
            .map((sh) => sh.heroId);

    const minimap: MinimapBlip[] = [
      ...cores.map((c) => ({ x: c.x / WORLD_W, y: (c.y - 60) / WORLD_H, team: c.team, kind: 'core' as const, alive: c.hp > 0 })),
      ...turrets.map((t) => ({ x: t.x / WORLD_W, y: (t.y - 45) / WORLD_H, team: t.team, kind: 'turret' as const, alive: t.alive })),
      ...droids.map((d) => ({ x: d.x / WORLD_W, y: d.y / WORLD_H, team: d.team, kind: 'droid' as const, alive: true })),
      ...heroes
        .filter((h) => h.team === this.playerTeam || h.cloakTimer <= 0)
        .map((h) => ({
          x: h.x / WORLD_W,
          y: h.y / WORLD_H,
          team: h.team,
          kind: h.id === this.playerEntityId ? ('player' as const) : ('hero' as const),
          alive: h.alive,
        })),
    ];

    const scoreboard: ScoreboardRow[] = heroes.map((h) => ({
      id: h.id,
      heroId: h.heroId,
      name: h.name,
      team: h.team,
      isPlayer: h.id === this.playerEntityId,
      kills: h.kills,
      deaths: h.deaths,
      assists: h.assists,
      droidKills: h.droidKills,
      totalSolarEarned: Math.floor(h.totalSolarEarned),
      upgradeCount: Object.values(h.upgrades).reduce((a, b) => a + b, 0),
      alive: h.alive,
      respawnTimer: Math.ceil(h.respawnTimer),
    }));

    const base = BASE_ZONES[player.team];
    const inBase =
      player.x >= base.x && player.x <= base.x + base.w && player.y >= base.y && player.y <= base.y + base.h;
    const droneCount = summons.filter((s) => s.ownerId === player.id && s.kind === 'drone').length;

    this.onHudUpdate({
      phase: this.phase,
      matchTime: this.mode === 'solo' && this.localSim ? this.localSim.matchTime : this.latestSnapshot?.matchTime ?? this.renderTime,
      waveTier: this.mode === 'solo' && this.localSim ? this.localSim.waveTier : this.waveTier,
      waveTierName: this.mode === 'solo' && this.localSim ? this.localSim.waveTierName : this.waveTierName,
      blueKills: this.mode === 'solo' && this.localSim ? this.localSim.blueKills : this.blueKills,
      redKills: this.mode === 'solo' && this.localSim ? this.localSim.redKills : this.redKills,
      blueTurretsAlive: turrets.filter((t) => t.team === 'blue' && t.alive).length,
      redTurretsAlive: turrets.filter((t) => t.team === 'red' && t.alive).length,
      blueCoreHp: Math.ceil(blueCore.hp),
      blueCoreMaxHp: blueCore.maxHp,
      blueCoreShielded: blueCore.shielded,
      redCoreHp: Math.ceil(redCore.hp),
      redCoreMaxHp: redCore.maxHp,
      redCoreShielded: redCore.shielded,
      player: {
        id: player.id,
        heroId: player.heroId,
        team: player.team,
        hp: Math.ceil(player.hp),
        maxHp: Math.ceil(player.maxHp),
        shield: Math.ceil(player.shield),
        solar: Math.floor(player.solar),
        alive: player.alive,
        respawnTimer: Math.ceil(player.respawnTimer),
        inDropPod: player.inDropPod,
        recallTimer: player.recallTimer,
        primaryCd: player.primaryCd,
        primaryMaxCd: stats.primaryCooldown,
        skill1Cd: player.skill1Cd,
        skill1MaxCd: stats.skill1Cooldown,
        skill2Cd: player.skill2Cd,
        skill2MaxCd: stats.skill2Cooldown,
        upgrades: { ...player.upgrades },
        affordableUpgrades,
        stats,
        kills: player.kills,
        deaths: player.deaths,
        assists: player.assists,
        droidKills: player.droidKills,
        totalSolarSpent: Math.floor(player.totalSolarSpent),
        inBase,
        droneCount,
      },
      network: {
        mode: this.mode,
        roomId: this.roomId,
        connected: this.mode === 'solo' ? true : this.wsConnected,
        pingMs: this.pingMs,
        humanCount: this.mode === 'solo' ? 1 : this.onlineHumanCount,
      },
      banner: this.mode === 'solo' && this.localSim ? this.localSim.banner : this.banner,
      killFeed: this.mode === 'solo' && this.localSim ? this.localSim.killFeed.map((k) => ({ ...k })) : this.killFeed,
      minimap,
      minimapViewport: {
        x: Math.max(0, Math.min(1, this.camX / WORLD_W)),
        y: Math.max(0, Math.min(1, this.camY / WORLD_H)),
        w: Math.max(0.08, Math.min(1, (this.canvas.clientWidth || 1280) / WORLD_W)),
        h: Math.max(0.15, Math.min(1, (this.canvas.clientHeight || 720) / WORLD_H)),
      },
      turretStatus: turrets.map((t) => ({
        team: t.team,
        lane: t.lane,
        tier: t.tier,
        alive: t.alive,
      })),
      takenHumanHeroes,
      scoreboard,
      endCinematic: this.endCinematic
        ? {
            active: this.endCinematic.active,
            completed: this.endCinematic.completed,
            winner: this.endCinematic.winner,
            elapsed: this.endCinematic.elapsed,
            duration: this.endCinematic.duration,
            canSkip: this.endCinematic.canSkip,
          }
        : null,
    });
  }
}
