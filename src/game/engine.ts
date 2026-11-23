import { gameAudio } from './audio';
import { computeHeroStats, HERO_MAP } from './heroes';
import { BASE_ZONES, GRAVITY, JUMP_PADS, PLATFORMS, WORLD_H, WORLD_W } from './map';
import type {
  ClientToServerMessage,
  MatchMode,
  PlayerInputPacket,
  ServerToClientMessage,
  SimFxEvent,
  WorldSnapshot,
} from './netTypes';
import { renderArena } from './renderer';
import { ArenaSimulation } from './sim';
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

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private rafId: number | null = null;
  private lastTs = 0;
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

  // Local client-side prediction timers for online mode
  private predCoyote = 0;
  private predJumpBuffer = 0;
  private predJumpsLeft = 2;
  private predDropThrough = 0;
  private predHoverFuel = 1;

  constructor(
    canvas: HTMLCanvasElement,
    config: EngineLaunchConfig,
    onHudUpdate: (snapshot: HudSnapshot) => void
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not initialize 2D rendering context.');
    this.ctx = context;
    this.onHudUpdate = onHudUpdate;

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
    this.particles = [];
    this.floatingTexts = [];
    this.camX = Math.max(0, p.dropPodX - this.canvas.width * 0.5);
    this.camY = Math.max(0, Math.min(WORLD_H - this.canvas.height, 260));
  }

  private connectOnline(): void {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    this.ws = ws;
    this.wsConnected = false;

    ws.addEventListener('open', () => {
      this.wsConnected = true;
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
        this.applyServerSnapshot(msg.snapshot, true);
        const me = this.mirrorHeroes.get(this.playerEntityId);
        if (me) {
          this.camX = Math.max(0, me.x - this.canvas.width * 0.5);
          this.camY = Math.max(0, Math.min(WORLD_H - this.canvas.height, 260));
        }
        this.emitHud();
      } else if (msg.type === 'state') {
        this.applyServerSnapshot(msg.snapshot, false);
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

    ws.addEventListener('close', () => {
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
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      if (this.mode === 'solo') {
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
    if (this.mode === 'solo') {
      this.initSolo(playerHeroId, difficulty);
      this.emitHud();
    } else if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const msg: ClientToServerMessage = { type: 'restart', heroId: playerHeroId };
      this.ws.send(JSON.stringify(msg));
    }
  }

  public triggerRecall(): void {
    this.queuedRecall = true;
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
    if (e.repeat) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
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

    this.mouseWorldX = this.mouseScreenX + this.camX;
    this.mouseWorldY = this.mouseScreenY + this.camY;
    const aimAngle = Math.atan2(this.mouseWorldY - playerY, this.mouseWorldX - playerX);

    return {
      seq: ++this.inputSeq,
      moveDir,
      wantJump: this.queuedJump,
      holdingJump: this.heldKeys.has('Space') || this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp'),
      wantDrop: this.queuedDrop,
      wantPrimary: this.mouseDownLeft,
      wantSkill1: this.queuedSkill1,
      wantSkill2: this.queuedSkill2,
      wantRecall: this.queuedRecall,
      aimAngle: Math.round(aimAngle * 100) / 100,
      aimWorldX: Math.round(this.mouseWorldX),
      aimWorldY: Math.round(this.mouseWorldY),
    };
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
    this.phase = this.localSim.phase;
    this.renderTime = this.localSim.matchTime;
    this.waveTier = this.localSim.waveTier;
    this.waveTierName = this.localSim.waveTierName;
    this.processFxEvents(this.localSim.drainFx());

    this.updateEffects(dt);
    if (player) this.updateCamera(player, dt);
    this.updateShake(dt);

    this.clearEdgeTriggers();
  }

  // === ONLINE TWITCHY UPDATE ===
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

      this.inputSendTimer -= dt;
      if (hasEdge || inputKey !== this.lastSentInputKey || this.inputSendTimer <= 0) {
        this.inputSendTimer = 0.032;
        this.lastSentInputKey = inputKey;
        const msg: ClientToServerMessage = { type: 'input', input: pkt };
        this.ws.send(JSON.stringify(msg));
      }

      this.predictLocalHero(me, pkt, dt);
    }

    for (const h of this.mirrorHeroes.values()) {
      h.squashX += (1 - h.squashX) * Math.min(1, dt * 14);
      h.squashY += (1 - h.squashY) * Math.min(1, dt * 14);
      if (h.id === this.playerEntityId) continue;
      if (h.alive && !h.inDropPod && !h.hookedById) {
        h.x += h.vx * dt;
        h.y += h.vy * dt;
        if (Math.abs(h.vx) > 25 && h.grounded) h.walkCycle += dt * Math.abs(h.vx) * 0.015;
      } else if (h.inDropPod) {
        h.dropPodY = Math.min(960 - h.h / 2, h.dropPodY + 420 * dt);
        h.y = h.dropPodY;
      }
    }

    for (const d of this.mirrorDroids.values()) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (Math.abs(d.vx) > 10) d.walkCycle += dt * 4;
    }

    for (const p of this.mirrorProjectiles.values()) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    this.updateEffects(dt);
    if (me) this.updateCamera(me, dt);
    this.updateShake(dt);
    this.clearEdgeTriggers();
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

    const def = HERO_MAP[h.heroId];
    const stats = computeHeroStats(h.heroId, h.upgrades, h.bonusMaxHp);
    const maxJumps = def.maxJumps + stats.extraJumps;
    const slowMult = h.slowTimer > 0 ? 0.58 : 1;
    const spinMult = h.spinTimer > 0 ? stats.skill2SpeedMult : 1;
    const meltMult = h.meltdownTimer > 0 ? stats.skill2SpeedMult : 1;
    const cloakMult = h.cloakTimer > 0 ? stats.skill2SpeedMult : 1;
    const rotMult = h.rotTimer > 0 ? stats.skill2SpeedMult : 1;
    const targetVx = pkt.moveDir * stats.moveSpeed * slowMult * spinMult * meltMult * cloakMult * rotMult;
    const accel = h.grounded ? 2600 : 1750;

    if (pkt.moveDir !== 0) {
      h.vx += Math.sign(targetVx - h.vx) * Math.min(Math.abs(targetVx - h.vx), accel * dt);
      h.walkCycle += dt * Math.abs(h.vx) * 0.015;
    } else {
      const decel = h.grounded ? 2400 : 700;
      if (Math.abs(h.vx) <= decel * dt) h.vx = 0;
      else h.vx -= Math.sign(h.vx) * decel * dt;
    }

    this.predDropThrough = Math.max(0, this.predDropThrough - dt);
    if (pkt.wantJump) this.predJumpBuffer = 0.12;
    else this.predJumpBuffer = Math.max(0, this.predJumpBuffer - dt);

    if (h.grounded) {
      this.predCoyote = 0.11;
      this.predJumpsLeft = maxJumps;
      this.predHoverFuel = 1;
    } else {
      this.predCoyote = Math.max(0, this.predCoyote - dt);
    }

    if (this.predJumpBuffer > 0) {
      if (this.predCoyote > 0) {
        h.vy = -stats.jumpForce;
        h.grounded = false;
        this.predCoyote = 0;
        this.predJumpBuffer = 0;
        this.predJumpsLeft = Math.max(0, maxJumps - 1);
        h.squashX = 0.82;
        h.squashY = 1.24;
      } else if (this.predJumpsLeft > 0) {
        h.vy = -stats.jumpForce * 0.92;
        this.predJumpsLeft -= 1;
        this.predJumpBuffer = 0;
        h.squashX = 0.84;
        h.squashY = 1.2;
      }
    }

    if (pkt.wantDrop && h.grounded) {
      this.predDropThrough = 0.24;
      h.grounded = false;
      h.y += 4;
    }

    h.isHovering = false;
    let gravScale = 1;
    if (def.canHover && !h.grounded && pkt.holdingJump && h.vy > -120 && (stats.infiniteHover || this.predHoverFuel > 0)) {
      h.isHovering = true;
      if (!stats.infiniteHover) {
        this.predHoverFuel = Math.max(0, this.predHoverFuel - dt * 0.45);
      }
      gravScale = def.hoverGravityScale;
      if (h.vy > 45) h.vy = 45;
    }

    h.vy = Math.min(920, h.vy + GRAVITY * gravScale * dt);

    h.x += h.vx * dt;
    h.x = Math.max(26 + h.w / 2, Math.min(WORLD_W - 26 - h.w / 2, h.x));
    const prevBottom = h.y + h.h / 2;
    h.y += h.vy * dt;
    h.grounded = false;
    const newBottom = h.y + h.h / 2;
    const halfW = h.w / 2;
    for (const p of PLATFORMS) {
      if (!(h.x + halfW > p.x && h.x - halfW < p.x + p.w)) continue;
      if (p.oneWay) {
        if (this.predDropThrough > 0) continue;
        if (h.vy >= 0 && prevBottom <= p.y + 8 && newBottom >= p.y) {
          h.y = p.y - h.h / 2;
          h.vy = 0;
          h.grounded = true;
        }
      } else {
        if (h.vy >= 0 && prevBottom <= p.y + 14 && newBottom >= p.y) {
          h.y = p.y - h.h / 2;
          h.vy = 0;
          h.grounded = true;
        } else if (h.vy < 0 && h.y - h.h / 2 < p.y + p.h && prevBottom > p.y + p.h) {
          h.y = p.y + p.h + h.h / 2;
          h.vy = 0;
        }
      }
    }

    for (const jp of JUMP_PADS) {
      if (
        h.x + h.w * 0.4 > jp.x &&
        h.x - h.w * 0.4 < jp.x + jp.w &&
        h.y + h.h / 2 >= jp.y - 6 &&
        h.y + h.h / 2 <= jp.y + 22 &&
        h.vy >= -80
      ) {
        h.vy = jp.vy;
        h.vx = jp.vx + pkt.moveDir * 140;
        h.grounded = false;
      }
    }
  }

  private applyServerSnapshot(snap: WorldSnapshot, hardReset: boolean): void {
    this.latestSnapshot = snap;
    this.renderTime = snap.matchTime;
    this.waveTier = snap.waveTier;
    this.waveTierName = snap.waveTierName;
    this.blueKills = snap.blueKills;
    this.redKills = snap.redKills;
    this.onlineHumanCount = snap.humanCount;
    this.banner = snap.banner;

    if (snap.phase === 'VICTORY' || snap.phase === 'DEFEAT') {
      const blueWon = snap.phase === 'VICTORY';
      this.phase = (this.playerTeam === 'blue') === blueWon ? 'VICTORY' : 'DEFEAT';
    } else {
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
        existing.recoilTimer = sh.recoilTimer;
        existing.kills = sh.kills;
        existing.deaths = sh.deaths;
        existing.assists = sh.assists;
        existing.droidKills = sh.droidKills;

        if (isMe) {
          const err = Math.hypot(sh.x - existing.x, sh.y - existing.y);
          if (err > 68 || sh.dashTimer > 0 || sh.hookedById || !sh.alive || sh.inDropPod) {
            existing.x = sh.x;
            existing.y = sh.y;
            existing.vx = sh.vx;
            existing.vy = sh.vy;
            existing.grounded = sh.grounded;
          } else if (err > 5) {
            existing.x += (sh.x - existing.x) * 0.35;
            existing.y += (sh.y - existing.y) * 0.35;
            existing.grounded = sh.grounded;
          }
          if (sh.inDropPod) {
            existing.dropPodX += (sh.dropPodX - existing.dropPodX) * 0.4;
            existing.dropPodY += (sh.dropPodY - existing.dropPodY) * 0.5;
          }
        } else {
          const err = Math.hypot(sh.x - existing.x, sh.y - existing.y);
          if (err > 95 || sh.hookedById) {
            existing.x = sh.x;
            existing.y = sh.y;
          } else {
            existing.x += (sh.x - existing.x) * 0.55;
            existing.y += (sh.y - existing.y) * 0.55;
          }
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
      if (!seenHeroIds.has(id)) this.mirrorHeroes.delete(id);
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
        });
      } else {
        ex.x += (sd.x - ex.x) * 0.6;
        ex.y += (sd.y - ex.y) * 0.6;
        ex.vx = sd.vx;
        ex.vy = sd.vy;
        ex.hp = sd.hp;
        ex.tier = sd.tier;
        ex.facing = sd.facing;
        ex.hitFlashTimer = sd.hitFlashTimer;
      }
    }
    for (const id of this.mirrorDroids.keys()) {
      if (!seenDroids.has(id)) this.mirrorDroids.delete(id);
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

    for (const ev of events) {
      if (ev.kind === 'shoot') {
        if (ev.ownerId === this.playerEntityId) {
          if (ev.heroId === 'marrow') gameAudio.shootCleaver();
          else if (ev.heroId === 'seraph') gameAudio.shootRadiant();
          else if (ev.heroId === 'vexia') gameAudio.shootRevolver();
          else if (ev.heroId === 'vorg' || ev.heroId === 'xylar') gameAudio.shootSonic();
          else if (ev.heroId === 'bastion') gameAudio.shootMortar();
          else gameAudio.shootBioBeam();
        }
      } else if (ev.kind === 'ability') {
        const mine = ev.ownerId === this.playerEntityId;
        if (ev.tag === 'hook') {
          this.spawnParticles(ev.x, ev.y, '#94A3B8', 8, 150, 'spark');
          if (mine || isNear(ev.x, ev.y, 650)) gameAudio.hookLaunch();
        } else if (ev.tag === 'hook_hit') {
          this.spawnParticles(ev.x, ev.y, '#34D399', 18, 240, 'spark');
          if (mine || isNear(ev.x, ev.y, 700)) {
            gameAudio.hookLatch();
            this.hitstopTimer = 0.04;
            this.addShake(8);
          }
        } else if (ev.tag === 'rot') {
          this.spawnParticles(ev.x, ev.y, '#10B981', 16, 160, 'circle');
          if (mine) gameAudio.blightRot();
        } else if (ev.tag === 'spear' && mine) {
          gameAudio.shootRadiant();
        } else if (ev.tag === 'aegis') {
          this.spawnParticles(ev.x, ev.y, '#FBBF24', 18, 220, 'spark');
          if (mine || isNear(ev.x, ev.y)) gameAudio.totemDeploy();
        } else if (ev.tag === 'vortex') {
          this.spawnParticles(ev.x, ev.y, '#818CF8', 14, 180, 'spark');
          if (mine || isNear(ev.x, ev.y)) gameAudio.vortexPull();
        } else if (ev.tag === 'cloak') {
          this.spawnParticles(ev.x, ev.y, '#38BDF8', 12, 160, 'circle');
          if (mine) gameAudio.cloakVanish();
        } else if (ev.tag === 'orbital') {
          this.spawnRing(ev.x, ev.y, 110, '#2DD4BF');
          if (mine || isNear(ev.x, ev.y, 750)) gameAudio.orbitalCharge();
        } else if (ev.tag === 'undead') {
          this.spawnParticles(ev.x, ev.y, '#2DD4BF', 16, 170, 'spark');
          if (mine) gameAudio.droneSpawn();
        } else if (ev.tag === 'dynamite' && mine) gameAudio.throwDynamite();
        else if (ev.tag === 'bull') {
          this.spawnParticles(ev.x, ev.y, '#38BDF8', 14, 180, 'spark');
          if (mine) gameAudio.bullCharge();
        } else if (ev.tag === 'dash') {
          this.spawnParticles(ev.x, ev.y, '#A855F7', 14, 210, 'spark');
          if (mine) gameAudio.hydroDash();
        } else if (ev.tag === 'spin' && mine) gameAudio.whirlpool();
        else if (ev.tag === 'bite') {
          this.spawnParticles(ev.x, ev.y, '#FBBF24', 14, 180, 'spark');
          if (mine) {
            gameAudio.bite();
            this.addShake(5);
          }
        } else if (ev.tag === 'meltdown' && (mine || isNear(ev.x, ev.y))) gameAudio.meltdownCharge();
        else if (ev.tag === 'totem' && mine) gameAudio.totemDeploy();
        else if (ev.tag === 'drone' && mine) gameAudio.droneSpawn();
      } else if (ev.kind === 'explosion') {
        this.spawnRing(ev.x, ev.y, ev.radius, ev.color);
        this.spawnParticles(ev.x, ev.y, '#FDE047', ev.heavy ? 24 : 12, ev.heavy ? 320 : 210, 'spark');
        this.spawnParticles(ev.x, ev.y, ev.color, ev.heavy ? 16 : 8, 180, 'circle');
        if (ev.ownerId === this.playerEntityId || isNear(ev.x, ev.y, 720)) {
          gameAudio.explosion(ev.heavy);
          if (ev.heavy) {
            this.hitstopTimer = 0.05;
            this.addShake(11);
          } else if (ev.ownerId === this.playerEntityId) {
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
        this.spawnParticles(ev.x, ev.y, '#FBBF24', 18, 220, 'spark');
        if (ev.heroEntityId === this.playerEntityId) gameAudio.upgradeBuy();
      } else if (ev.kind === 'jump') {
        if (ev.doubleJump) this.spawnParticles(ev.x, ev.y, ev.color, 6, 110, 'circle');
        if (ev.heroEntityId === this.playerEntityId) gameAudio.jump(ev.doubleJump);
      } else if (ev.kind === 'jumppad') {
        this.spawnParticles(ev.x, ev.y, ev.color, 12, 180, 'spark');
        if (ev.heroEntityId === this.playerEntityId) gameAudio.jumpPad();
      } else if (ev.kind === 'dropSlam') {
        this.spawnParticles(ev.x, ev.y, '#F59E0B', 20, 240, 'spark');
        this.spawnParticles(ev.x, ev.y, '#94A3B8', 10, 140, 'circle');
        if (ev.heroEntityId === this.playerEntityId) {
          gameAudio.dropPodSlam();
          this.addShake(9);
        }
      } else if (ev.kind === 'kill') {
        this.spawnParticles(ev.x, ev.y, '#F59E0B', 24, 260, 'spark');
        this.spawnParticles(ev.x, ev.y, ev.team === 'blue' ? '#38BDF8' : '#F43F5E', 16, 200, 'square');
        this.spawnRing(ev.x, ev.y, 72, '#FBBF24');
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
        if (ev.winner === this.playerTeam) gameAudio.victory();
        else gameAudio.defeat();
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
    const vw = this.canvas.width;
    const vh = this.canvas.height;
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

    renderArena(this.ctx, this.canvas.width, this.canvas.height, {
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
    });
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
    const affordableUpgrades = def.upgrades.filter(
      (u) => (player.upgrades[u.id] ?? 0) < u.maxRank && player.solar >= u.cost
    ).length;

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
      minimap,
      scoreboard,
    });
  }
}
