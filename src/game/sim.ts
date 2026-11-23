import { computeHeroStats, HERO_LIST, HERO_MAP } from './heroes.ts';
import {
  BASE_ZONES,
  CORE_SPOTS,
  GRAVITY,
  INITIAL_TURRET_SPOTS,
  JUMP_PADS,
  NEUTRAL_CREEP_SPOTS,
  PLATFORMS,
  SOLAR_CUBE_SPOTS,
  WORLD_H,
  WORLD_W,
} from './map.ts';
import type {
  PlayerInputPacket,
  SimFxEvent,
  WorldSnapshot,
} from './netTypes.ts';
import type {
  AnnouncerBanner,
  CoreDrillEntity,
  Difficulty,
  DroidEntity,
  GamePhase,
  HazardZoneEntity,
  HeroEntity,
  HeroId,
  HookEntity,
  NeutralCreepEntity,
  ProjectileEntity,
  SolarCubeEntity,
  SummonEntity,
  Team,
  TurretEntity,
} from './types.ts';

let simUidCounter = 1;
const nextId = (prefix: string) => `${prefix}_${simUidCounter++}`;

export interface HumanInputState extends PlayerInputPacket {
  queuedJump: boolean;
  queuedDrop: boolean;
  queuedSkill1: boolean;
  queuedSkill2: boolean;
  queuedRecall: boolean;
}

interface WaveTierConfig {
  tier: number;
  name: string;
  startSec: number;
  countPerLane: number;
  hp: number;
  damage: number;
}

// Escalating 6-tier waves guarantee a decisive 15-20 minute match finish
const WAVE_TIERS: WaveTierConfig[] = [
  { tier: 1, name: 'Tier I · Initiates', startSec: 0, countPerLane: 1, hp: 115, damage: 12 },
  { tier: 2, name: 'Tier II · Zealots', startSec: 150, countPerLane: 2, hp: 170, damage: 16 },
  { tier: 3, name: 'Tier III · Siege Vanguard', startSec: 300, countPerLane: 2, hp: 255, damage: 23 },
  { tier: 4, name: 'Tier IV · Sanctum Breakers', startSec: 480, countPerLane: 3, hp: 365, damage: 32 },
  { tier: 5, name: 'Tier V · Void Juggernauts', startSec: 690, countPerLane: 3, hp: 520, damage: 44 },
  { tier: 6, name: 'Tier VI · Cataclysm Horde', startSec: 900, countPerLane: 4, hp: 740, damage: 62 },
];

export class ArenaSimulation {
  public tick = 0;
  public phase: GamePhase = 'PLAYING';
  public difficulty: Difficulty = 'standard';
  public matchTime = 0;
  public waveTimer = 2.0;
  public waveTier = 1;
  public waveTierName = WAVE_TIERS[0].name;
  public blueKills = 0;
  public redKills = 0;
  public firstBloodAwarded = false;
  public bannerIdCounter = 1;
  public banner: AnnouncerBanner | null = null;

  public heroes: HeroEntity[] = [];
  public droids: DroidEntity[] = [];
  public turrets: TurretEntity[] = [];
  public cores: CoreDrillEntity[] = [];
  public creeps: NeutralCreepEntity[] = [];
  public solarCubes: SolarCubeEntity[] = [];
  public projectiles: ProjectileEntity[] = [];
  public summons: SummonEntity[] = [];
  public hooks: HookEntity[] = [];
  public hazards: HazardZoneEntity[] = [];

  public humanIds = new Set<string>();
  public humanInputs = new Map<string, HumanInputState>();
  public ackSeqByHero = new Map<string, number>();

  private pendingFx: SimFxEvent[] = [];

  constructor(initialHeroId: HeroId = 'marrow', difficulty: Difficulty = 'standard', soloPlayer = true) {
    this.initMatch(initialHeroId, difficulty, soloPlayer);
  }

  public getHumanTakenHeroes(): HeroId[] {
    const out: HeroId[] = [];
    for (const h of this.heroes) {
      if (this.humanIds.has(h.id)) {
        out.push(h.heroId);
      }
    }
    return out;
  }

  private getWaveConfig(): WaveTierConfig {
    let chosen = WAVE_TIERS[0];
    for (const cfg of WAVE_TIERS) {
      if (this.matchTime >= cfg.startSec) {
        chosen = cfg;
      }
    }
    // Beyond 15 minutes, add extra overtime scaling every minute so games always close out before 20 min
    if (this.matchTime > 900) {
      const extraMins = Math.floor((this.matchTime - 900) / 60);
      return {
        ...chosen,
        hp: chosen.hp + extraMins * 110,
        damage: chosen.damage + extraMins * 10,
      };
    }
    return chosen;
  }

  public initMatch(playerHeroId: HeroId, difficulty: Difficulty, soloPlayer = true): void {
    this.tick = 0;
    this.phase = 'PLAYING';
    this.difficulty = difficulty;
    this.matchTime = 0;
    this.waveTimer = 2.0;
    this.waveTier = 1;
    this.waveTierName = WAVE_TIERS[0].name;
    this.blueKills = 0;
    this.redKills = 0;
    this.firstBloodAwarded = false;
    this.banner = null;
    this.pendingFx = [];

    this.heroes = [];
    this.droids = [];
    this.projectiles = [];
    this.summons = [];
    this.hooks = [];
    this.hazards = [];
    this.humanIds.clear();
    this.humanInputs.clear();
    this.ackSeqByHero.clear();

    this.turrets = INITIAL_TURRET_SPOTS.map((sp) => {
      const isInner = sp.tier === 'inner';
      const maxHp = isInner ? 1250 : 950;
      return {
        id: sp.id,
        team: sp.team,
        lane: sp.lane,
        tier: sp.tier,
        x: sp.x,
        y: sp.y,
        w: isInner ? 72 : 64,
        h: isInner ? 112 : 98,
        hp: maxHp,
        maxHp,
        alive: true,
        shielded: isInner,
        attackCd: 0.4,
        aimAngle: sp.team === 'blue' ? 0 : Math.PI,
        hitFlashTimer: 0,
        range: 365,
      };
    });

    this.cores = [
      {
        id: 'core_blue',
        team: 'blue',
        x: CORE_SPOTS.blue.x,
        y: CORE_SPOTS.blue.y,
        w: 118,
        h: 164,
        hp: 2200,
        maxHp: 2200,
        shielded: true,
        hitFlashTimer: 0,
        pulsePhase: 0,
      },
      {
        id: 'core_red',
        team: 'red',
        x: CORE_SPOTS.red.x,
        y: CORE_SPOTS.red.y,
        w: 118,
        h: 164,
        hp: 2200,
        maxHp: 2200,
        shielded: true,
        hitFlashTimer: 0,
        pulsePhase: 0,
      },
    ];

    this.creeps = NEUTRAL_CREEP_SPOTS.map((sp, i) => ({
      id: sp.id,
      homeX: sp.x,
      homeY: sp.y,
      x: sp.x,
      y: sp.y,
      hp: 60,
      maxHp: 60,
      alive: true,
      respawnTimer: 0,
      hitFlashTimer: 0,
      bobPhase: i * 1.4,
    }));

    this.solarCubes = SOLAR_CUBE_SPOTS.map((sp, i) => ({
      id: `solar_${i}`,
      x: sp.x,
      y: sp.y,
      value: sp.value,
      active: true,
      respawnTimer: 0,
      bobPhase: i * 0.8,
    }));

    // Zero duplicate champions: pick 5 unique bots from the remaining 7 champions
    const pool = HERO_LIST.map((h) => h.id).filter((id) => id !== playerHeroId);
    // Deterministic-ish shuffle for lively varied matchups
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }

    const blueAllies = [pool[0], pool[1]];
    const redEnemies = [pool[2], pool[3], pool[4]];

    const p0 = this.createHero(
      playerHeroId,
      'blue',
      soloPlayer,
      'bot',
      soloPlayer ? `${HERO_MAP[playerHeroId].name} (You)` : HERO_MAP[playerHeroId].name
    );
    this.heroes.push(p0);
    this.heroes.push(this.createHero(blueAllies[0], 'blue', false, 'top'));
    this.heroes.push(this.createHero(blueAllies[1], 'blue', false, 'bot'));

    this.heroes.push(this.createHero(redEnemies[0], 'red', false, 'top'));
    this.heroes.push(this.createHero(redEnemies[1], 'red', false, 'bot'));
    this.heroes.push(this.createHero(redEnemies[2], 'red', false, 'top'));

    if (soloPlayer) {
      this.humanIds.add(p0.id);
      this.startDropPod(p0);
    }

    this.pushBanner(
      'SANCTUM BREACH INITIATED',
      'Destroy Outer & Inner Reliquary Towers to shatter the Ancient Core',
      'gold',
      3.8
    );
  }

  public addHumanPlayer(
    requestedHeroId: HeroId,
    playerName: string,
    preferredTeam?: Team
  ): { hero: HeroEntity; assignedHeroId: HeroId } | null {
    const blueHumans = this.heroes.filter((h) => h.team === 'blue' && this.humanIds.has(h.id)).length;
    const redHumans = this.heroes.filter((h) => h.team === 'red' && this.humanIds.has(h.id)).length;

    let chosenTeam: Team = blueHumans <= redHumans ? 'blue' : 'red';
    if (preferredTeam) {
      const prefCount = preferredTeam === 'blue' ? blueHumans : redHumans;
      if (prefCount < 3) chosenTeam = preferredTeam;
    }

    const botSlot =
      this.heroes.find((h) => h.team === chosenTeam && !this.humanIds.has(h.id)) ??
      this.heroes.find((h) => !this.humanIds.has(h.id));

    if (!botSlot) return null;

    // Enforce zero duplicate champions across all 6 players!
    const humanTaken = new Set<HeroId>(this.getHumanTakenHeroes());
    let assignedHeroId: HeroId = requestedHeroId;

    if (humanTaken.has(requestedHeroId)) {
      // Another human already locked this champion; assign an unused champion from the 8-hero pool
      const allUsed = new Set<HeroId>(this.heroes.map((h) => h.heroId));
      const freeHero =
        HERO_LIST.find((h) => !allUsed.has(h.id))?.id ??
        HERO_LIST.find((h) => !humanTaken.has(h.id))?.id ??
        requestedHeroId;
      assignedHeroId = freeHero;
    }

    // If another bot currently holds assignedHeroId, swap that bot onto a spare unused champion!
    const conflictingBot = this.heroes.find(
      (h) => h.id !== botSlot.id && !this.humanIds.has(h.id) && h.heroId === assignedHeroId
    );
    if (conflictingBot) {
      const usedSet = new Set<HeroId>(this.heroes.map((h) => h.heroId));
      usedSet.add(assignedHeroId);
      const spare = HERO_LIST.find((h) => !usedSet.has(h.id))?.id;
      if (spare) {
        this.reconfigureHeroSlot(conflictingBot, spare, `${HERO_MAP[spare].name} (Bot)`);
      }
    }

    const def = HERO_MAP[assignedHeroId];
    this.reconfigureHeroSlot(botSlot, assignedHeroId, playerName.trim().slice(0, 16) || def.name);
    botSlot.isPlayer = false;
    botSlot.solar = Math.max(130, Math.floor(botSlot.solar));
    botSlot.totalSolarEarned = Math.max(botSlot.totalSolarEarned, botSlot.solar);
    botSlot.totalSolarSpent = 0;
    botSlot.kills = 0;
    botSlot.deaths = 0;
    botSlot.assists = 0;
    botSlot.droidKills = 0;

    this.humanIds.add(botSlot.id);
    this.ackSeqByHero.set(botSlot.id, 0);
    this.startDropPod(botSlot);

    this.pushBanner(
      `${botSlot.name.toUpperCase()} DESCENDED`,
      `Joined ${botSlot.team === 'blue' ? 'Sanctum (Blue)' : 'Invasion (Red)'} as ${def.name}`,
      botSlot.team,
      2.6
    );
    return { hero: botSlot, assignedHeroId };
  }

  private reconfigureHeroSlot(slot: HeroEntity, heroId: HeroId, name: string): void {
    const def = HERO_MAP[heroId];
    const stats = computeHeroStats(heroId, {}, 0);
    slot.heroId = heroId;
    slot.name = name;
    slot.w = def.width;
    slot.h = def.height;
    slot.upgrades = {};
    slot.bonusMaxHp = 0;
    slot.maxHp = stats.maxHp;
    slot.hp = stats.maxHp;
    slot.shield = 0;
    slot.rotTimer = 0;
    slot.cloakTimer = 0;
    slot.cloakCritReady = false;
    slot.hookedById = null;
    slot.meltdownTimer = 0;
    slot.spinTimer = 0;
    slot.dashTimer = 0;
  }

  public removeHumanPlayer(heroEntityId: string): void {
    this.humanIds.delete(heroEntityId);
    this.humanInputs.delete(heroEntityId);
    this.ackSeqByHero.delete(heroEntityId);
    const hero = this.heroes.find((h) => h.id === heroEntityId);
    if (hero) {
      hero.name = `${HERO_MAP[hero.heroId].name} (Bot)`;
    }
  }

  public setHumanInput(heroEntityId: string, packet: PlayerInputPacket): void {
    const existing = this.humanInputs.get(heroEntityId);
    const clampedMove = packet.moveDir < 0 ? -1 : packet.moveDir > 0 ? 1 : 0;
    const safeAim = Number.isFinite(packet.aimAngle) ? packet.aimAngle : 0;
    const safeAimX = Number.isFinite(packet.aimWorldX) ? packet.aimWorldX : WORLD_W / 2;
    const safeAimY = Number.isFinite(packet.aimWorldY) ? packet.aimWorldY : 700;

    this.humanInputs.set(heroEntityId, {
      seq: packet.seq,
      moveDir: clampedMove,
      wantJump: packet.wantJump,
      holdingJump: packet.holdingJump,
      wantDrop: packet.wantDrop,
      wantPrimary: packet.wantPrimary,
      wantSkill1: packet.wantSkill1,
      wantSkill2: packet.wantSkill2,
      wantRecall: packet.wantRecall,
      aimAngle: safeAim,
      aimWorldX: safeAimX,
      aimWorldY: safeAimY,
      queuedJump: (existing?.queuedJump ?? false) || packet.wantJump,
      queuedDrop: (existing?.queuedDrop ?? false) || packet.wantDrop,
      queuedSkill1: (existing?.queuedSkill1 ?? false) || packet.wantSkill1,
      queuedSkill2: (existing?.queuedSkill2 ?? false) || packet.wantSkill2,
      queuedRecall: (existing?.queuedRecall ?? false) || packet.wantRecall,
    });
  }

  public buyUpgradeForHero(heroEntityId: string, upgradeId: string): boolean {
    const hero = this.heroes.find((h) => h.id === heroEntityId);
    if (!hero) return false;
    const def = HERO_MAP[hero.heroId];
    const node = def.upgrades.find((u) => u.id === upgradeId);
    if (!node) return false;
    const curRank = hero.upgrades[upgradeId] ?? 0;
    if (curRank >= node.maxRank) return false;
    if (hero.solar < node.cost) return false;

    const prevStats = computeHeroStats(hero.heroId, hero.upgrades, hero.bonusMaxHp);
    hero.solar -= node.cost;
    hero.totalSolarSpent += node.cost;
    hero.upgrades[upgradeId] = curRank + 1;
    const nextStats = computeHeroStats(hero.heroId, hero.upgrades, hero.bonusMaxHp);
    const hpGain = Math.max(0, nextStats.maxHp - prevStats.maxHp);
    hero.maxHp = nextStats.maxHp;
    hero.hp = Math.min(hero.maxHp, hero.hp + hpGain);

    this.emitFx({ kind: 'upgrade', x: hero.x, y: hero.y, heroEntityId: hero.id });
    this.emitFx({
      kind: 'text',
      x: hero.x,
      y: hero.y - 44,
      text: `${node.name.toUpperCase()} FORGED!`,
      color: '#FDE047',
      scale: 1.08,
      targetId: hero.id,
    });
    return true;
  }

  public drainFx(): SimFxEvent[] {
    if (this.pendingFx.length === 0) return [];
    const copy = this.pendingFx;
    this.pendingFx = [];
    return copy;
  }

  private emitFx(ev: SimFxEvent): void {
    this.pendingFx.push(ev);
  }

  public buildSnapshot(includeFx = true): WorldSnapshot {
    return {
      tick: this.tick,
      serverTime: Date.now(),
      phase: this.phase,
      matchTime: this.matchTime,
      waveTier: this.waveTier,
      waveTierName: this.waveTierName,
      blueKills: this.blueKills,
      redKills: this.redKills,
      humanCount: this.humanIds.size,
      banner: this.banner ? { ...this.banner } : null,
      heroes: this.heroes.map((h) => ({
        id: h.id,
        heroId: h.heroId,
        name: h.name,
        team: h.team,
        isHuman: this.humanIds.has(h.id),
        x: Math.round(h.x * 10) / 10,
        y: Math.round(h.y * 10) / 10,
        vx: Math.round(h.vx),
        vy: Math.round(h.vy),
        facing: h.facing,
        aimAngle: Math.round(h.aimAngle * 100) / 100,
        hp: Math.ceil(h.hp),
        maxHp: Math.ceil(h.maxHp),
        bonusMaxHp: h.bonusMaxHp,
        shield: Math.ceil(h.shield),
        solar: Math.floor(h.solar),
        totalSolarEarned: Math.floor(h.totalSolarEarned),
        totalSolarSpent: Math.floor(h.totalSolarSpent),
        upgrades: { ...h.upgrades },
        grounded: h.grounded,
        isHovering: h.isHovering,
        primaryCd: Math.round(h.primaryCd * 100) / 100,
        skill1Cd: Math.round(h.skill1Cd * 100) / 100,
        skill2Cd: Math.round(h.skill2Cd * 100) / 100,
        alive: h.alive,
        respawnTimer: Math.ceil(h.respawnTimer),
        inDropPod: h.inDropPod,
        dropPodX: Math.round(h.dropPodX),
        dropPodY: Math.round(h.dropPodY),
        dropPodSolars: h.inDropPod ? h.dropPodSolars : [],
        recallTimer: Math.round(h.recallTimer * 100) / 100,
        stunTimer: Math.round(h.stunTimer * 100) / 100,
        slowTimer: Math.round(h.slowTimer * 100) / 100,
        hitFlashTimer: Math.round(h.hitFlashTimer * 100) / 100,
        dashTimer: Math.round(h.dashTimer * 100) / 100,
        spinTimer: Math.round(h.spinTimer * 100) / 100,
        rotTimer: Math.round(h.rotTimer * 100) / 100,
        cloakTimer: Math.round(h.cloakTimer * 100) / 100,
        cloakCritReady: h.cloakCritReady,
        meltdownTimer: Math.round(h.meltdownTimer * 100) / 100,
        meltdownMaxTimer: h.meltdownMaxTimer,
        hookedById: h.hookedById,
        recoilTimer: Math.round(h.recoilTimer * 100) / 100,
        walkCycle: Math.round(h.walkCycle * 100) / 100,
        kills: h.kills,
        deaths: h.deaths,
        assists: h.assists,
        droidKills: h.droidKills,
        lastAckSeq: this.ackSeqByHero.get(h.id) ?? 0,
      })),
      droids: this.droids.map((d) => ({
        id: d.id,
        team: d.team,
        lane: d.lane,
        tier: d.tier,
        x: Math.round(d.x),
        y: Math.round(d.y),
        vx: Math.round(d.vx),
        vy: Math.round(d.vy),
        hp: Math.ceil(d.hp),
        maxHp: d.maxHp,
        facing: d.facing,
        hitFlashTimer: Math.round(d.hitFlashTimer * 100) / 100,
        walkCycle: Math.round(d.walkCycle * 10) / 10,
      })),
      turrets: this.turrets.map((t) => ({
        id: t.id,
        team: t.team,
        lane: t.lane,
        tier: t.tier,
        x: t.x,
        y: t.y,
        hp: Math.ceil(t.hp),
        maxHp: t.maxHp,
        alive: t.alive,
        shielded: t.shielded,
        aimAngle: Math.round(t.aimAngle * 100) / 100,
        hitFlashTimer: Math.round(t.hitFlashTimer * 100) / 100,
      })),
      cores: this.cores.map((c) => ({
        id: c.id,
        team: c.team,
        x: c.x,
        y: c.y,
        hp: Math.ceil(c.hp),
        maxHp: c.maxHp,
        shielded: c.shielded,
        hitFlashTimer: Math.round(c.hitFlashTimer * 100) / 100,
      })),
      creeps: this.creeps.map((c) => ({
        id: c.id,
        x: Math.round(c.x),
        y: Math.round(c.y),
        hp: Math.ceil(c.hp),
        maxHp: c.maxHp,
        alive: c.alive,
        hitFlashTimer: Math.round(c.hitFlashTimer * 100) / 100,
        bobPhase: c.bobPhase,
      })),
      solarCubes: this.solarCubes.map((sc) => ({
        id: sc.id,
        x: sc.x,
        y: sc.y,
        value: sc.value,
        active: sc.active,
        bobPhase: sc.bobPhase,
      })),
      projectiles: this.projectiles.map((p) => ({
        id: p.id,
        ownerId: p.ownerId,
        team: p.team,
        kind: p.kind,
        x: Math.round(p.x),
        y: Math.round(p.y),
        vx: Math.round(p.vx),
        vy: Math.round(p.vy),
        radius: p.radius,
        color: p.color,
      })),
      summons: this.summons.map((s) => ({
        id: s.id,
        ownerId: s.ownerId,
        team: s.team,
        kind: s.kind,
        x: Math.round(s.x),
        y: Math.round(s.y),
        hp: Math.ceil(s.hp),
        maxHp: s.maxHp,
        life: Math.round(s.life * 10) / 10,
        maxLife: s.maxLife,
        radius: s.radius,
        facing: s.facing,
        hitFlashTimer: Math.round(s.hitFlashTimer * 100) / 100,
      })),
      hooks: this.hooks.map((hk) => ({
        id: hk.id,
        ownerId: hk.ownerId,
        team: hk.team,
        x: Math.round(hk.x),
        y: Math.round(hk.y),
        startX: Math.round(hk.startX),
        startY: Math.round(hk.startY),
        state: hk.state,
        latchedTargetId: hk.latchedTargetId,
      })),
      hazards: this.hazards.map((hz) => ({
        id: hz.id,
        ownerId: hz.ownerId,
        team: hz.team,
        kind: hz.kind,
        x: Math.round(hz.x),
        y: Math.round(hz.y),
        radius: hz.radius,
        timer: Math.round(hz.timer * 100) / 100,
        maxTimer: hz.maxTimer,
        triggered: hz.triggered,
        color: hz.color,
      })),
      fx: includeFx ? this.drainFx() : [],
    };
  }

  public step(dt: number): void {
    if (this.phase !== 'PLAYING') return;
    this.tick += 1;
    this.matchTime += dt;

    if (this.banner) {
      this.banner.timer -= dt;
      if (this.banner.timer <= 0) this.banner = null;
    }

    const waveCfg = this.getWaveConfig();
    if (waveCfg.tier > this.waveTier) {
      this.waveTier = waveCfg.tier;
      this.waveTierName = waveCfg.name;
      this.pushBanner(
        `CREEP ESCALATION · ${waveCfg.name.toUpperCase()}`,
        `${waveCfg.countPerLane} troopers per lane (${waveCfg.hp} HP) surging forward!`,
        waveCfg.tier >= 5 ? 'red' : 'gold',
        3.5
      );
    }

    this.waveTimer -= dt;
    if (this.waveTimer <= 0) {
      this.waveTimer = 16.0;
      this.spawnDroidWave(waveCfg);
    }

    for (const h of this.heroes) {
      this.updateHero(h, dt);
    }

    this.updateHooks(dt);
    this.updateHazards(dt);
    this.updateDroids(dt);
    this.updateTurretsAndCores(dt);
    this.updateMapObjects(dt);
    this.updateSummons(dt);
    this.updateProjectiles(dt);
  }

  private createHero(
    heroId: HeroId,
    team: Team,
    isPlayer: boolean,
    lane: 'top' | 'bot',
    customName?: string
  ): HeroEntity {
    const def = HERO_MAP[heroId];
    const base = BASE_ZONES[team];
    const stats = computeHeroStats(heroId, {}, 0);
    return {
      id: nextId(isPlayer ? 'player' : `champ_${team}`),
      heroId,
      name: customName ?? def.name,
      team,
      isPlayer,
      x: base.spawnX + (team === 'blue' ? 22 : -22) * (lane === 'top' ? 1 : -1),
      y: base.spawnY,
      vx: 0,
      vy: 0,
      w: def.width,
      h: def.height,
      facing: team === 'blue' ? 1 : -1,
      aimAngle: team === 'blue' ? 0 : Math.PI,
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      bonusMaxHp: 0,
      shield: 0,
      solar: 135,
      totalSolarEarned: 135,
      totalSolarSpent: 0,
      upgrades: {},
      grounded: false,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      jumpsRemaining: def.maxJumps,
      dropThroughTimer: 0,
      hoverFuel: 1,
      isHovering: false,
      primaryCd: 0,
      skill1Cd: 0,
      skill2Cd: 0,
      primaryShotCounter: 0,
      alive: true,
      respawnTimer: 0,
      inDropPod: false,
      dropPodX: base.spawnX,
      dropPodY: 60,
      dropPodSolars: [],
      recallTimer: 0,
      stunTimer: 0,
      slowTimer: 0,
      hitFlashTimer: 0,
      invulnTimer: 0,
      dashTimer: 0,
      dashVx: 0,
      dashVy: 0,
      dashHitIds: new Set<string>(),
      spinTimer: 0,
      spinTickTimer: 0,
      rotTimer: 0,
      rotTickTimer: 0,
      cloakTimer: 0,
      cloakCritReady: false,
      meltdownTimer: 0,
      meltdownMaxTimer: 0,
      hookedById: null,
      squashX: 1,
      squashY: 1,
      walkCycle: 0,
      recoilTimer: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      droidKills: 0,
      lastDamagedById: null,
      lastDamagedTimer: 0,
      aiLane: lane,
      aiState: 'lane',
      aiDecisionTimer: Math.random() * 0.4,
      aiTargetX: base.spawnX,
      aiTargetY: base.spawnY,
      aiJumpCooldown: 0,
    };
  }

  private startDropPod(h: HeroEntity): void {
    const base = BASE_ZONES[h.team];
    h.alive = true;
    h.hp = h.maxHp;
    h.shield = 0;
    h.inDropPod = true;
    h.dropPodX = base.spawnX;
    h.dropPodY = 70;
    h.x = base.spawnX;
    h.y = 70;
    h.vx = 0;
    h.vy = 0;
    h.recallTimer = 0;
    h.stunTimer = 0;
    h.slowTimer = 0;
    h.dashTimer = 0;
    h.spinTimer = 0;
    h.rotTimer = 0;
    h.cloakTimer = 0;
    h.cloakCritReady = false;
    h.meltdownTimer = 0;
    h.hookedById = null;
    const isHuman = this.humanIds.has(h.id);
    h.dropPodSolars = isHuman
      ? Array.from({ length: 7 }, (_, i) => ({
          x: base.spawnX + Math.sin(i * 1.4) * 95,
          y: 230 + i * 94,
          collected: false,
          value: 9,
        }))
      : [];
  }

  private pushBanner(
    title: string,
    subtitle: string,
    tone: 'gold' | 'blue' | 'red' | 'emerald',
    duration = 3.0
  ): void {
    this.banner = {
      id: this.bannerIdCounter++,
      title,
      subtitle,
      tone,
      timer: duration,
    };
  }

  private spawnDroidWave(cfg: WaveTierConfig): void {
    const lanes: Array<'top' | 'bot'> = ['top', 'bot'];
    // Hard cap total droids to prevent performance bloat in extreme stalemates
    if (this.droids.length > 42) return;

    for (const team of ['blue', 'red'] as Team[]) {
      const baseX = team === 'blue' ? 660 : WORLD_W - 660;
      const dir = team === 'blue' ? 1 : -1;
      for (const lane of lanes) {
        const y = lane === 'top' ? 548 : 932;
        for (let i = 0; i < cfg.countPerLane; i++) {
          this.droids.push({
            id: nextId(`droid_${team}`),
            team,
            lane,
            tier: cfg.tier,
            x: baseX + dir * (i * 34 + (lane === 'top' ? 40 : 0)),
            y,
            vx: 0,
            vy: 0,
            w: cfg.tier >= 5 ? 30 : 26,
            h: cfg.tier >= 5 ? 36 : 32,
            hp: cfg.hp,
            maxHp: cfg.hp,
            damage: cfg.damage,
            attackCd: 0.35 + i * 0.12,
            hitFlashTimer: 0,
            walkCycle: Math.random() * 6,
            grounded: true,
            facing: dir as 1 | -1,
            slowTimer: 0,
            stunTimer: 0,
          });
        }
      }
    }
  }

  private updateHero(h: HeroEntity, dt: number): void {
    const stats = computeHeroStats(h.heroId, h.upgrades, h.bonusMaxHp);
    h.maxHp = stats.maxHp;

    if (!h.alive) {
      h.respawnTimer -= dt;
      if (h.respawnTimer <= 0) {
        this.startDropPod(h);
      }
      return;
    }

    const passiveGain = stats.passiveSolarPerSec * dt;
    h.solar += passiveGain;
    h.totalSolarEarned += passiveGain;

    h.primaryCd = Math.max(0, h.primaryCd - dt);
    h.skill1Cd = Math.max(0, h.skill1Cd - dt);
    h.skill2Cd = Math.max(0, h.skill2Cd - dt);
    h.hitFlashTimer = Math.max(0, h.hitFlashTimer - dt);
    h.invulnTimer = Math.max(0, h.invulnTimer - dt);
    h.stunTimer = Math.max(0, h.stunTimer - dt);
    h.slowTimer = Math.max(0, h.slowTimer - dt);
    h.dropThroughTimer = Math.max(0, h.dropThroughTimer - dt);
    h.recoilTimer = Math.max(0, h.recoilTimer - dt);
    h.lastDamagedTimer = Math.max(0, h.lastDamagedTimer - dt);
    if (h.lastDamagedTimer <= 0) h.lastDamagedById = null;

    if (h.cloakTimer > 0) {
      h.cloakTimer = Math.max(0, h.cloakTimer - dt);
      if (h.cloakTimer <= 0) {
        h.cloakCritReady = false;
      }
    }

    h.squashX += (1 - h.squashX) * Math.min(1, dt * 14);
    h.squashY += (1 - h.squashY) * Math.min(1, dt * 14);

    const isHuman = this.humanIds.has(h.id);
    const input = isHuman ? this.humanInputs.get(h.id) : undefined;
    if (input) {
      this.ackSeqByHero.set(h.id, input.seq);
    }

    // Drop pod descent
    if (h.inDropPod) {
      const base = BASE_ZONES[h.team];
      const dropSpeed = isHuman ? 420 : 580;
      h.dropPodY += dropSpeed * dt;
      if (isHuman && input) {
        const minX = h.team === 'blue' ? 45 : base.x - 90;
        const maxX = h.team === 'blue' ? base.x + base.w + 90 : WORLD_W - 45;
        h.dropPodX = Math.max(minX, Math.min(maxX, h.dropPodX + input.moveDir * 350 * dt));
        for (const nugget of h.dropPodSolars) {
          if (!nugget.collected && Math.hypot(nugget.x - h.dropPodX, nugget.y - h.dropPodY) < 38) {
            nugget.collected = true;
            this.grantSolar(h, nugget.value, nugget.x, nugget.y);
          }
        }
      }
      h.x = h.dropPodX;
      h.y = h.dropPodY;

      if (h.dropPodY >= 960 - h.h / 2) {
        h.inDropPod = false;
        h.y = 960 - h.h / 2;
        h.x = Math.max(52, Math.min(WORLD_W - 52, h.dropPodX));
        h.grounded = true;
        h.squashX = 1.32;
        h.squashY = 0.72;
        this.emitFx({ kind: 'dropSlam', x: h.x, y: 958, heroEntityId: h.id });
      }
      if (input) {
        input.queuedJump = false;
        input.queuedDrop = false;
        input.queuedSkill1 = false;
        input.queuedSkill2 = false;
        input.queuedRecall = false;
      }
      return;
    }

    // If currently being reeled in by Marrow-Hook's Abyssal Chain, yield physics to updateHooks
    if (h.hookedById) {
      if (input) {
        input.queuedJump = false;
        input.queuedDrop = false;
        input.queuedSkill1 = false;
        input.queuedSkill2 = false;
        input.queuedRecall = false;
      }
      return;
    }

    const inOwnBase = this.isInBase(h.x, h.y, h.team);
    let baseRegen = stats.hpRegenPerSec;
    if (stats.capstones['kr_u1'] && h.hp < h.maxHp * 0.45) {
      baseRegen *= 3;
    }
    if (stats.capstones['bs_u3'] && h.lastDamagedTimer <= 2) {
      baseRegen *= 3;
    }
    const healRate = inOwnBase ? 105 : baseRegen;
    if (h.hp < h.maxHp) {
      h.hp = Math.min(h.maxHp, h.hp + healRate * dt);
    }

    // Xylar Phase Regeneration capstone: +22 HP/s while cloaked
    if (stats.capstones['xy_e2'] && h.cloakTimer > 0 && h.hp < h.maxHp) {
      h.hp = Math.min(h.maxHp, h.hp + 22 * dt);
    }

    // Seraph-9 Martyr's Aura capstone: pulse +14 HP every 2.5s to nearby injured allies
    if (stats.capstones['sr_u2'] && this.tick % 150 === 0) {
      let pulsed = false;
      for (const ally of this.heroes) {
        if (!ally.alive || ally.inDropPod || ally.team !== h.team || ally.id === h.id) continue;
        if (ally.hp < ally.maxHp && Math.hypot(ally.x - h.x, ally.y - h.y) <= 265) {
          this.healHero(ally, 14);
          pulsed = true;
        }
      }
      if (pulsed) {
        this.emitFx({ kind: 'ring', x: h.x, y: h.y, radius: 130, color: '#FBBF24' });
      }
    }

    const enemyTeam: Team = h.team === 'blue' ? 'red' : 'blue';
    if (this.isInBase(h.x, h.y, enemyTeam)) {
      this.applyDamageToHero(h, 65 * dt, null);
      h.vx = h.team === 'blue' ? -440 : 440;
    }

    if (h.recallTimer > 0) {
      h.recallTimer -= dt;
      if (Math.abs(h.vx) > 40 || h.stunTimer > 0) {
        h.recallTimer = 0;
      } else if (h.recallTimer <= 0) {
        const base = BASE_ZONES[h.team];
        this.emitFx({ kind: 'ring', x: h.x, y: h.y, radius: 54, color: '#38BDF8' });
        h.x = base.spawnX;
        h.y = base.spawnY;
        h.vx = 0;
        h.vy = 0;
        h.hp = h.maxHp;
        this.emitFx({ kind: 'upgrade', x: h.x, y: h.y, heroEntityId: h.id });
        this.emitFx({
          kind: 'text',
          x: h.x,
          y: h.y - 40,
          text: 'RECALLED TO SANCTUM',
          color: '#7DD3FC',
          scale: 1,
          targetId: h.id,
        });
      }
    }

    // Brother Bastion Divine Reckoning channel
    if (h.meltdownTimer > 0) {
      h.meltdownTimer -= dt;
      if (h.meltdownTimer <= 0) {
        this.detonateMeltdown(h, stats);
      }
    }

    // Vorg Soul Maelstrom spin
    if (h.spinTimer > 0) {
      h.spinTimer -= dt;
      h.spinTickTimer -= dt;
      if (h.spinTickTimer <= 0) {
        h.spinTickTimer = 0.22;
        const slowDur = stats.capstones['vg_e2'] ? 0.6 : 0;
        const dealt = this.dealAreaDamage(h, h.x, h.y, stats.skill2Radius, stats.skill2Damage, slowDur, 0, '#A855F7', false);
        if (stats.capstones['vg_e1'] && dealt > 0) {
          this.healHero(h, dealt * 0.3);
        }
      }
    }

    // Marrow-Hook Blight Furnace rot aura
    if (h.rotTimer > 0) {
      h.rotTimer -= dt;
      h.rotTickTimer -= dt;
      if (h.rotTickTimer <= 0) {
        h.rotTickTimer = 0.26;
        const dealt = this.dealAreaDamage(h, h.x, h.y, stats.skill2Radius, stats.skill2Damage, 0.55, 0, '#10B981', false);
        if (stats.capstones['mh_e1'] && dealt > 0) {
          this.healHero(h, dealt * 0.35);
        }
      }
      if (h.rotTimer <= 0 && stats.skill2ExplodeOnEnd) {
        this.dealAreaDamage(h, h.x, h.y, stats.skill2Radius + 38, 65, 0.9, 0.45, '#34D399', true);
        this.emitFx({
          kind: 'explosion',
          x: h.x,
          y: h.y,
          radius: stats.skill2Radius + 38,
          color: '#10B981',
          heavy: true,
          ownerId: h.id,
        });
      }
    }

    // Vorg Rift Phase Dash
    if (h.dashTimer > 0) {
      h.dashTimer -= dt;
      h.vx = h.dashVx;
      h.vy = h.dashVy;
      for (const other of this.heroes) {
        if (!other.alive || other.inDropPod || other.team === h.team || h.dashHitIds.has(other.id)) continue;
        if (Math.hypot(other.x - h.x, other.y - h.y) < 62) {
          h.dashHitIds.add(other.id);
          const executeBonus = stats.capstones['vg_q1'] && other.hp < other.maxHp * 0.45 ? 60 : 0;
          this.applyDamageToHero(other, stats.skill1Damage + executeBonus, h);
          other.stunTimer = Math.max(other.stunTimer, stats.skill1Stun);
          this.emitFx({
            kind: 'text',
            x: other.x,
            y: other.y - 36,
            text: executeBonus > 0 ? 'RIFT EXECUTE!' : 'RIFT STUN!',
            color: executeBonus > 0 ? '#F43F5E' : '#C084FC',
            scale: executeBonus > 0 ? 1.2 : 1.05,
          });
          this.emitFx({ kind: 'hit', x: other.x, y: other.y, color: '#A855F7', ownerId: h.id });
        }
      }
      for (const d of this.droids) {
        if (d.team === h.team || h.dashHitIds.has(d.id)) continue;
        if (Math.hypot(d.x - h.x, d.y - h.y) < 58) {
          h.dashHitIds.add(d.id);
          this.damageDroid(d, stats.skill1Damage, h);
          d.stunTimer = Math.max(d.stunTimer, stats.skill1Stun);
        }
      }
      if (h.dashTimer <= 0) {
        h.vx *= 0.35;
        h.vy *= 0.35;
        if (stats.skill1ShieldAfter > 0) {
          h.shield = Math.max(h.shield, stats.skill1ShieldAfter);
        }
        if (stats.capstones['vg_q2']) {
          this.dealAreaDamage(h, h.x, h.y, 78, 42, 0.55, 0, '#A855F7', false);
          this.emitFx({ kind: 'explosion', x: h.x, y: h.y, radius: 78, color: '#A855F7', heavy: false, ownerId: h.id });
        }
      }
    }

    let moveDir = 0;
    let wantJump = false;
    let holdingJump = false;
    let wantDrop = false;
    let wantPrimary = false;
    let wantSkill1 = false;
    let wantSkill2 = false;
    let wantRecall = false;
    let aimWorldX = h.x + Math.cos(h.aimAngle) * 320;
    let aimWorldY = h.y + Math.sin(h.aimAngle) * 320;

    if (isHuman) {
      if (input) {
        moveDir = input.moveDir;
        wantJump = input.queuedJump;
        holdingJump = input.holdingJump;
        wantDrop = input.queuedDrop;
        wantPrimary = input.wantPrimary;
        wantSkill1 = input.queuedSkill1;
        wantSkill2 = input.queuedSkill2;
        wantRecall = input.queuedRecall;
        h.aimAngle = input.aimAngle;
        aimWorldX = input.aimWorldX;
        aimWorldY = input.aimWorldY;
        h.facing = Math.cos(h.aimAngle) >= 0 ? 1 : -1;

        input.queuedJump = false;
        input.queuedDrop = false;
        input.queuedSkill1 = false;
        input.queuedSkill2 = false;
        input.queuedRecall = false;
      }
    } else {
      const ai = this.computeBotControls(h, stats, dt);
      moveDir = ai.moveDir;
      wantJump = ai.wantJump;
      holdingJump = ai.holdingJump;
      wantDrop = ai.wantDrop;
      wantPrimary = ai.wantPrimary;
      wantSkill1 = ai.wantSkill1;
      wantSkill2 = ai.wantSkill2;
      aimWorldX = ai.aimWorldX;
      aimWorldY = ai.aimWorldY;
    }

    if (h.stunTimer > 0) {
      moveDir = 0;
      wantJump = false;
      holdingJump = false;
      wantPrimary = false;
      wantSkill1 = false;
      wantSkill2 = false;
    }

    if (wantRecall && h.grounded && h.recallTimer <= 0 && !inOwnBase) {
      h.recallTimer = 2.2;
      h.vx = 0;
      this.emitFx({
        kind: 'text',
        x: h.x,
        y: h.y - 36,
        text: 'RECALLING...',
        color: '#38BDF8',
        scale: 0.95,
        targetId: h.id,
      });
    }

    const def = HERO_MAP[h.heroId];
    const maxJumps = def.maxJumps + stats.extraJumps;
    if (h.dashTimer <= 0) {
      const slowMult = h.slowTimer > 0 ? 0.58 : 1;
      const spinMult = h.spinTimer > 0 ? stats.skill2SpeedMult : 1;
      const meltMult = h.meltdownTimer > 0 ? stats.skill2SpeedMult : 1;
      const cloakMult = h.cloakTimer > 0 ? stats.skill2SpeedMult : 1;
      const rotMult = h.rotTimer > 0 ? stats.skill2SpeedMult : 1;
      const targetVx = moveDir * stats.moveSpeed * slowMult * spinMult * meltMult * cloakMult * rotMult;
      const accel = h.grounded ? 2600 : 1750;
      if (moveDir !== 0) {
        h.vx += Math.sign(targetVx - h.vx) * Math.min(Math.abs(targetVx - h.vx), accel * dt);
        h.walkCycle += dt * Math.abs(h.vx) * 0.015;
      } else {
        const decel = h.grounded ? 2400 : 700;
        if (Math.abs(h.vx) <= decel * dt) h.vx = 0;
        else h.vx -= Math.sign(h.vx) * decel * dt;
      }

      if (wantJump) h.jumpBufferTimer = 0.12;
      else h.jumpBufferTimer = Math.max(0, h.jumpBufferTimer - dt);

      if (h.grounded) {
        h.coyoteTimer = 0.11;
        h.jumpsRemaining = maxJumps;
        h.hoverFuel = 1;
      } else {
        h.coyoteTimer = Math.max(0, h.coyoteTimer - dt);
      }

      if (h.jumpBufferTimer > 0) {
        if (h.coyoteTimer > 0) {
          h.vy = -stats.jumpForce;
          h.grounded = false;
          h.coyoteTimer = 0;
          h.jumpBufferTimer = 0;
          h.jumpsRemaining = Math.max(0, maxJumps - 1);
          h.squashX = 0.82;
          h.squashY = 1.24;
          this.emitFx({ kind: 'jump', x: h.x, y: h.y + h.h / 2, doubleJump: false, color: def.accentColor, heroEntityId: h.id });
        } else if (h.jumpsRemaining > 0) {
          h.vy = -stats.jumpForce * 0.92;
          h.jumpsRemaining -= 1;
          h.jumpBufferTimer = 0;
          h.squashX = 0.84;
          h.squashY = 1.2;
          this.emitFx({ kind: 'jump', x: h.x, y: h.y + h.h / 2, doubleJump: true, color: def.accentColor, heroEntityId: h.id });
        }
      }

      if (wantDrop && h.grounded) {
        h.dropThroughTimer = 0.24;
        h.grounded = false;
        h.y += 4;
      }

      h.isHovering = false;
      let gravScale = 1;
      if (def.canHover && !h.grounded && holdingJump && h.vy > -120 && (stats.infiniteHover || h.hoverFuel > 0)) {
        h.isHovering = true;
        if (!stats.infiniteHover) {
          h.hoverFuel = Math.max(0, h.hoverFuel - dt * 0.45);
        }
        gravScale = def.hoverGravityScale;
        if (h.vy > 45) h.vy = 45;
      }

      h.vy = Math.min(920, h.vy + GRAVITY * gravScale * dt);
    }

    this.moveAndCollide(h, dt);

    for (const jp of JUMP_PADS) {
      if (
        h.x + h.w * 0.4 > jp.x &&
        h.x - h.w * 0.4 < jp.x + jp.w &&
        h.y + h.h / 2 >= jp.y - 6 &&
        h.y + h.h / 2 <= jp.y + 22 &&
        h.vy >= -80
      ) {
        h.vy = jp.vy;
        h.vx = jp.vx + moveDir * 140;
        h.grounded = false;
        h.jumpsRemaining = Math.max(1, maxJumps - 1);
        h.squashX = 0.76;
        h.squashY = 1.32;
        this.emitFx({ kind: 'jumppad', x: jp.x + jp.w / 2, y: jp.y, color: jp.color, heroEntityId: h.id });
      }
    }

    if (wantPrimary && h.primaryCd <= 0 && h.spinTimer <= 0 && h.dashTimer <= 0) {
      this.castPrimary(h, stats);
    }
    if (wantSkill1 && h.skill1Cd <= 0 && h.dashTimer <= 0) {
      this.castSkill1(h, stats, aimWorldX, aimWorldY);
    }
    if (wantSkill2 && h.skill2Cd <= 0 && h.dashTimer <= 0) {
      this.castSkill2(h, stats);
    }
  }

  public moveAndCollide(
    ent: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      w: number;
      h: number;
      grounded: boolean;
      dropThroughTimer?: number;
      squashX?: number;
      squashY?: number;
    },
    dt: number
  ): void {
    const wasGrounded = ent.grounded;
    ent.x += ent.vx * dt;
    ent.x = Math.max(26 + ent.w / 2, Math.min(WORLD_W - 26 - ent.w / 2, ent.x));

    const prevBottom = ent.y + ent.h / 2;
    ent.y += ent.vy * dt;
    ent.grounded = false;

    const newBottom = ent.y + ent.h / 2;
    const halfW = ent.w / 2;

    for (const p of PLATFORMS) {
      const overlapX = ent.x + halfW > p.x && ent.x - halfW < p.x + p.w;
      if (!overlapX) continue;

      if (p.oneWay) {
        if ((ent.dropThroughTimer ?? 0) > 0) continue;
        if (ent.vy >= 0 && prevBottom <= p.y + 8 && newBottom >= p.y) {
          ent.y = p.y - ent.h / 2;
          if (!wasGrounded && ent.vy > 220 && ent.squashX !== undefined && ent.squashY !== undefined) {
            ent.squashX = 1.2;
            ent.squashY = 0.82;
          }
          ent.vy = 0;
          ent.grounded = true;
        }
      } else {
        if (ent.vy >= 0 && prevBottom <= p.y + 14 && newBottom >= p.y) {
          ent.y = p.y - ent.h / 2;
          if (!wasGrounded && ent.vy > 220 && ent.squashX !== undefined && ent.squashY !== undefined) {
            ent.squashX = 1.22;
            ent.squashY = 0.8;
          }
          ent.vy = 0;
          ent.grounded = true;
        } else if (ent.vy < 0 && ent.y - ent.h / 2 < p.y + p.h && prevBottom > p.y + p.h) {
          ent.y = p.y + p.h + ent.h / 2;
          ent.vy = 0;
        }
      }
    }

    if (ent.y < 30) {
      ent.y = 30;
      if (ent.vy < 0) ent.vy = 0;
    }
  }

  private castPrimary(h: HeroEntity, stats: ReturnType<typeof computeHeroStats>): void {
    h.primaryCd = stats.primaryCooldown;
    h.recoilTimer = 0.1;
    h.primaryShotCounter += 1;
    const cos = Math.cos(h.aimAngle);
    const sin = Math.sin(h.aimAngle);
    const spawnX = h.x + cos * 22;
    const spawnY = h.y + sin * 18 - 2;

    // Xylar Phase Cloak ambush crit consumption
    let bonusDmg = 0;
    if (h.heroId === 'xylar' && h.cloakCritReady) {
      h.cloakCritReady = false;
      h.cloakTimer = 0;
      bonusDmg = stats.skill2Damage;
      this.emitFx({ kind: 'text', x: h.x, y: h.y - 44, text: 'PHASE STRIKE!', color: '#38BDF8', scale: 1.15 });
    }

    this.emitFx({ kind: 'shoot', heroId: h.heroId, x: spawnX, y: spawnY, ownerId: h.id });

    if (h.heroId === 'marrow') {
      // Sweeping piercing plasma cleaver slash
      const shockCleave = Boolean(stats.capstones['mh_p3'] && h.primaryShotCounter % 3 === 0);
      const reach = stats.primaryRange + (shockCleave ? 90 : 0);
      this.projectiles.push({
        id: nextId('proj'),
        ownerId: h.id,
        team: h.team,
        kind: 'cleaver',
        x: h.x + cos * 32,
        y: h.y + sin * 22,
        vx: cos * stats.primaryProjectileSpeed,
        vy: sin * stats.primaryProjectileSpeed,
        radius: shockCleave ? 38 : 28,
        damage: stats.primaryDamage,
        healAmount: 0,
        healSolarBonus: 0,
        splashRadius: 0,
        gravity: 0,
        bouncesLeft: 0,
        pierce: true,
        hitIds: new Set<string>(),
        slowDuration: stats.capstones['mh_p1'] ? 0.8 : 0,
        stunDuration: 0,
        life: reach / stats.primaryProjectileSpeed,
        maxLife: reach / stats.primaryProjectileSpeed,
        color: shockCleave ? '#FDE047' : '#34D399',
        lifestealRatio: stats.lifestealRatio,
      });
    } else if (h.heroId === 'seraph') {
      const fanVolley = Boolean(stats.capstones['sr_p1'] && h.primaryShotCounter % 3 === 0);
      const offsets = fanVolley ? [-0.11, 0, 0.11] : [0];
      for (const off of offsets) {
        const a = h.aimAngle + off;
        this.projectiles.push({
          id: nextId('proj'),
          ownerId: h.id,
          team: h.team,
          kind: 'revolver',
          x: spawnX,
          y: spawnY,
          vx: Math.cos(a) * stats.primaryProjectileSpeed,
          vy: Math.sin(a) * stats.primaryProjectileSpeed,
          radius: fanVolley ? 7.5 : 6.5,
          damage: stats.primaryDamage,
          healAmount: stats.primaryHeal,
          healSolarBonus: 0,
          splashRadius: 0,
          gravity: 0,
          bouncesLeft: 0,
          pierce: stats.primaryPierce,
          hitIds: new Set<string>(),
          slowDuration: stats.capstones['sr_p3'] ? 0.6 : 0,
          stunDuration: 0,
          life: stats.primaryRange / stats.primaryProjectileSpeed,
          maxLife: stats.primaryRange / stats.primaryProjectileSpeed,
          color: stats.primaryHeal > 0 ? '#34D399' : '#FBBF24',
          lifestealRatio: 0,
        });
      }
    } else if (h.heroId === 'korak') {
      this.projectiles.push({
        id: nextId('proj'),
        ownerId: h.id,
        team: h.team,
        kind: 'biobeam',
        x: spawnX,
        y: spawnY,
        vx: cos * stats.primaryProjectileSpeed,
        vy: sin * stats.primaryProjectileSpeed,
        radius: 13,
        damage: stats.primaryDamage,
        healAmount: stats.primaryHeal,
        healSolarBonus: stats.primaryHealSolar,
        splashRadius: 0,
        gravity: 0,
        bouncesLeft: 0,
        pierce: true,
        hitIds: new Set<string>(),
        slowDuration: stats.capstones['kr_p2'] ? 0.85 : 0,
        stunDuration: 0,
        life: stats.primaryRange / stats.primaryProjectileSpeed,
        maxLife: stats.primaryRange / stats.primaryProjectileSpeed,
        color: '#34D399',
        lifestealRatio: 0,
      });
    } else if (h.heroId === 'vorg') {
      const twin = Boolean(stats.capstones['vg_p1']);
      const splashBolt = Boolean(stats.capstones['vg_p2'] && h.primaryShotCounter % 5 === 0);
      const offsets = twin ? [-7, 7] : [0];
      const perpX = -sin;
      const perpY = cos;
      for (const off of offsets) {
        const spread = (Math.random() - 0.5) * 0.05;
        this.projectiles.push({
          id: nextId('proj'),
          ownerId: h.id,
          team: h.team,
          kind: 'sonic',
          x: spawnX + perpX * off,
          y: spawnY + perpY * off,
          vx: Math.cos(h.aimAngle + spread) * stats.primaryProjectileSpeed,
          vy: Math.sin(h.aimAngle + spread) * stats.primaryProjectileSpeed,
          radius: splashBolt ? 8 : 5.5,
          damage: twin ? Math.round(stats.primaryDamage * 0.72) : stats.primaryDamage,
          healAmount: 0,
          healSolarBonus: 0,
          splashRadius: splashBolt ? 56 : 0,
          gravity: 0,
          bouncesLeft: 0,
          pierce: false,
          hitIds: new Set<string>(),
          slowDuration: 0,
          stunDuration: 0,
          life: stats.primaryRange / stats.primaryProjectileSpeed,
          maxLife: stats.primaryRange / stats.primaryProjectileSpeed,
          color: splashBolt ? '#F472B6' : '#A855F7',
          lifestealRatio: stats.lifestealRatio,
        });
      }
    } else if (h.heroId === 'bastion') {
      const barrage = Boolean(stats.capstones['bs_p1']);
      const shells = barrage ? [1, 0.82] : [1];
      for (let idx = 0; idx < shells.length; idx++) {
        const spdMult = shells[idx];
        this.projectiles.push({
          id: nextId('proj'),
          ownerId: h.id,
          team: h.team,
          kind: 'mortar',
          x: spawnX,
          y: spawnY - idx * 6,
          vx: cos * stats.primaryProjectileSpeed * spdMult,
          vy: sin * stats.primaryProjectileSpeed * spdMult - (155 + idx * 55),
          radius: 9,
          damage: barrage ? Math.round(stats.primaryDamage * 0.72) : stats.primaryDamage,
          healAmount: 0,
          healSolarBonus: 0,
          splashRadius: stats.primarySplash,
          gravity: 780,
          bouncesLeft: stats.capstones['bs_p2'] ? 2 : 1,
          pierce: false,
          hitIds: new Set<string>(),
          slowDuration: stats.skill1Slow,
          stunDuration: 0,
          life: 1.55,
          maxLife: 1.55,
          color: '#FBBF24',
          lifestealRatio: 0,
        });
      }
    } else if (h.heroId === 'vexia') {
      const shockBolt = Boolean(stats.capstones['vx_p2'] && h.primaryShotCounter % 3 === 0);
      this.projectiles.push({
        id: nextId('proj'),
        ownerId: h.id,
        team: h.team,
        kind: 'revolver',
        x: spawnX,
        y: spawnY,
        vx: cos * stats.primaryProjectileSpeed,
        vy: sin * stats.primaryProjectileSpeed,
        radius: shockBolt ? 8 : 6,
        damage: stats.primaryDamage + (shockBolt ? 22 : 0),
        healAmount: 0,
        healSolarBonus: 0,
        splashRadius: 0,
        gravity: 0,
        bouncesLeft: 0,
        pierce: stats.primaryPierce,
        hitIds: new Set<string>(),
        slowDuration: shockBolt ? 0.65 : 0,
        stunDuration: 0,
        life: stats.primaryRange / stats.primaryProjectileSpeed,
        maxLife: stats.primaryRange / stats.primaryProjectileSpeed,
        color: shockBolt ? '#FDE047' : '#38BDF8',
        lifestealRatio: 0,
      });
      if (stats.primaryBonusRocket && h.primaryShotCounter % 4 === 0) {
        this.projectiles.push({
          id: nextId('proj'),
          ownerId: h.id,
          team: h.team,
          kind: 'missile',
          x: h.x,
          y: h.y - 22,
          vx: cos * 760,
          vy: sin * 760,
          radius: 7.5,
          damage: 34,
          healAmount: 0,
          healSolarBonus: 0,
          splashRadius: 56,
          gravity: 0,
          bouncesLeft: 0,
          pierce: false,
          hitIds: new Set<string>(),
          slowDuration: 0,
          stunDuration: 0,
          life: 0.95,
          maxLife: 0.95,
          color: '#F43F5E',
          lifestealRatio: 0,
        });
      }
    } else if (h.heroId === 'xylar') {
      const twinDaggers = Boolean(stats.capstones['xy_p1']);
      const angles = twinDaggers ? [-0.04, 0.04] : [(Math.random() - 0.5) * 0.05];
      angles.forEach((off, idx) => {
        const isCritBlade = bonusDmg > 0 && idx === 0;
        this.projectiles.push({
          id: nextId('proj'),
          ownerId: h.id,
          team: h.team,
          kind: 'dagger',
          x: spawnX,
          y: spawnY + (twinDaggers ? (idx === 0 ? -5 : 5) : 0),
          vx: Math.cos(h.aimAngle + off) * stats.primaryProjectileSpeed,
          vy: Math.sin(h.aimAngle + off) * stats.primaryProjectileSpeed,
          radius: isCritBlade ? 10 : 5.5,
          damage: (twinDaggers ? Math.round(stats.primaryDamage * 0.72) : stats.primaryDamage) + (isCritBlade ? bonusDmg : 0),
          healAmount: 0,
          healSolarBonus: 0,
          splashRadius: isCritBlade ? 48 : 0,
          gravity: 0,
          bouncesLeft: 0,
          pierce: stats.primaryPierce,
          hitIds: new Set<string>(),
          slowDuration: isCritBlade ? 0.8 : 0,
          stunDuration: isCritBlade && stats.capstones['xy_e1'] ? 0.75 : 0,
          life: stats.primaryRange / stats.primaryProjectileSpeed,
          maxLife: stats.primaryRange / stats.primaryProjectileSpeed,
          color: isCritBlade ? '#FDE047' : '#38BDF8',
          lifestealRatio: stats.lifestealRatio,
        });
      });
    } else if (h.heroId === 'caldris') {
      this.projectiles.push({
        id: nextId('proj'),
        ownerId: h.id,
        team: h.team,
        kind: 'soul_orb',
        x: spawnX,
        y: spawnY,
        vx: cos * stats.primaryProjectileSpeed,
        vy: sin * stats.primaryProjectileSpeed,
        radius: 13,
        damage: stats.primaryDamage,
        healAmount: 0,
        healSolarBonus: 0,
        splashRadius: 0,
        gravity: 0,
        bouncesLeft: 0,
        pierce: true,
        hitIds: new Set<string>(),
        slowDuration: stats.skill1Slow,
        stunDuration: 0,
        life: stats.primaryRange / stats.primaryProjectileSpeed,
        maxLife: stats.primaryRange / stats.primaryProjectileSpeed,
        color: '#2DD4BF',
        lifestealRatio: stats.lifestealRatio,
      });
    }
  }

  private castSkill1(
    h: HeroEntity,
    stats: ReturnType<typeof computeHeroStats>,
    aimWorldX: number,
    aimWorldY: number
  ): void {
    h.skill1Cd = stats.skill1Cooldown;
    const cos = Math.cos(h.aimAngle);
    const sin = Math.sin(h.aimAngle);

    if (h.heroId === 'marrow') {
      // Abyssal Chain Hook! (Pudge-style across platforms!)
      // Clear any stale hook owned by this hero
      this.hooks = this.hooks.filter((hk) => hk.ownerId !== h.id);
      const hookLaunchSpeed = stats.capstones['mh_q1'] ? 980 * 1.35 : 980;
      this.hooks.push({
        id: nextId('hook'),
        ownerId: h.id,
        team: h.team,
        x: h.x + cos * 24,
        y: h.y + sin * 20,
        vx: cos * hookLaunchSpeed,
        vy: sin * hookLaunchSpeed,
        startX: h.x,
        startY: h.y,
        maxRange: stats.skill1Range,
        damage: stats.skill1Damage,
        stunDuration: stats.skill1Stun,
        state: 'extending',
        latchedTargetId: null,
        latchedTargetKind: null,
      });
      this.emitFx({ kind: 'ability', tag: 'hook', x: h.x, y: h.y, ownerId: h.id });
    } else if (h.heroId === 'seraph') {
      // Judgment Spear (1 or 2)
      const count = 1 + stats.skill1ExtraCount;
      for (let i = 0; i < count; i++) {
        const offset = count === 1 ? 0 : (i === 0 ? -0.09 : 0.09);
        const a = h.aimAngle + offset;
        this.projectiles.push({
          id: nextId('spear'),
          ownerId: h.id,
          team: h.team,
          kind: 'spear',
          x: h.x + Math.cos(a) * 26,
          y: h.y + Math.sin(a) * 22,
          vx: Math.cos(a) * 940,
          vy: Math.sin(a) * 940,
          radius: 10,
          damage: count > 1 ? Math.round(stats.skill1Damage * 0.78) : stats.skill1Damage,
          healAmount: 0,
          healSolarBonus: 0,
          splashRadius: stats.skill1Radius,
          gravity: 0,
          bouncesLeft: 0,
          pierce: false,
          hitIds: new Set<string>(),
          slowDuration: 0,
          stunDuration: stats.skill1Stun,
          life: 0.92,
          maxLife: 0.92,
          color: '#FBBF24',
          lifestealRatio: 0,
        });
      }
      this.emitFx({ kind: 'ability', tag: 'spear', x: h.x, y: h.y, ownerId: h.id });
    } else if (h.heroId === 'korak') {
      // Skull Spirit Totem
      this.summons = this.summons.filter((s) => !(s.ownerId === h.id && s.kind === 'totem'));
      this.summons.push({
        id: nextId('totem'),
        ownerId: h.id,
        team: h.team,
        kind: 'totem',
        x: h.x + h.facing * 26,
        y: h.y + 4,
        vx: 0,
        vy: 0,
        w: 28,
        h: 38,
        hp: 135,
        maxHp: 135,
        life: stats.skill1Duration,
        maxLife: stats.skill1Duration,
        damage: stats.skill1Damage,
        radius: stats.skill1Radius,
        knockback: stats.skill1Heal,
        tickTimer: 0.25,
        orbitAngle: 0,
        orbitIndex: 0,
        explodeOnEnd: Boolean(stats.capstones['kr_q3']),
        facing: h.facing,
        hitFlashTimer: 0,
        hitIds: new Set<string>(),
      });
      this.emitFx({ kind: 'ring', x: h.x + h.facing * 26, y: h.y + 4, radius: 52, color: '#34D399' });
      this.emitFx({ kind: 'ability', tag: 'totem', x: h.x, y: h.y, ownerId: h.id });
    } else if (h.heroId === 'vorg') {
      // Rift Phase Dash
      h.dashTimer = 0.22;
      h.invulnTimer = 0.3;
      h.dashVx = cos * stats.skill1DashSpeed;
      h.dashVy = sin * stats.skill1DashSpeed * 0.85;
      h.dashHitIds.clear();
      h.squashX = 1.35;
      h.squashY = 0.74;
      this.emitFx({ kind: 'ability', tag: 'dash', x: h.x, y: h.y, ownerId: h.id });
    } else if (h.heroId === 'bastion') {
      // Sanctified Clamp
      const biteX = h.x + h.facing * 46;
      const biteY = h.y;
      this.emitFx({ kind: 'ring', x: biteX, y: biteY, radius: stats.skill1Radius * 0.9, color: '#FBBF24' });
      this.emitFx({ kind: 'ability', tag: 'bite', x: biteX, y: biteY, ownerId: h.id });
      let hitAnything = false;
      let hitHero = false;
      let killedEnemy = false;
      let killedHero = false;

      for (const other of this.heroes) {
        if (!other.alive || other.inDropPod || other.team === h.team) continue;
        if (Math.hypot(other.x - biteX, other.y - biteY) <= stats.skill1Radius) {
          hitAnything = true;
          hitHero = true;
          const wasAlive = other.alive;
          this.applyDamageToHero(other, stats.skill1Damage, h);
          other.slowTimer = Math.max(other.slowTimer, 0.7);
          if (stats.capstones['bs_q2']) {
            other.stunTimer = Math.max(other.stunTimer, 0.65);
          }
          if (wasAlive && !other.alive) {
            killedEnemy = true;
            killedHero = true;
          }
        }
      }
      for (const d of this.droids) {
        if (d.team === h.team) continue;
        if (Math.hypot(d.x - biteX, d.y - biteY) <= stats.skill1Radius) {
          hitAnything = true;
          const hpBefore = d.hp;
          this.damageDroid(d, stats.skill1Damage, h);
          if (hpBefore > 0 && d.hp <= 0) killedEnemy = true;
        }
      }
      for (const c of this.creeps) {
        if (!c.alive) continue;
        if (Math.hypot(c.x - biteX, c.y - biteY) <= stats.skill1Radius) {
          hitAnything = true;
          const wasAlive = c.alive;
          this.damageCreep(c, stats.skill1Damage, h);
          if (wasAlive && !c.alive) killedEnemy = true;
        }
      }

      if (hitAnything) {
        this.healHero(h, stats.skill1Heal);
        if (hitHero && stats.capstones['bs_q2']) {
          h.shield = Math.max(h.shield, 55);
        }
        if (killedEnemy && stats.skill1PermanentHpGain > 0) {
          const stackGain = stats.skill1PermanentHpGain + (killedHero && stats.capstones['bs_q1'] ? 16 : 0);
          h.bonusMaxHp += stackGain;
          h.maxHp += stackGain;
          h.hp += stackGain;
          if (stats.capstones['bs_q1']) {
            this.grantSolar(h, 25, h.x, h.y - 26);
          }
          this.emitFx({
            kind: 'text',
            x: h.x,
            y: h.y - 52,
            text: `+${stackGain} PERM HP`,
            color: '#FDE047',
            scale: 1.05,
          });
        }
      }
    } else if (h.heroId === 'vexia') {
      // Brimstone Cluster Bombs
      const total = 1 + stats.skill1ExtraCount;
      for (let i = 0; i < total; i++) {
        const offsetAngle = total === 1 ? 0 : (i - 1) * 0.2;
        const a = h.aimAngle + offsetAngle;
        this.projectiles.push({
          id: nextId('dyn'),
          ownerId: h.id,
          team: h.team,
          kind: 'dynamite',
          x: h.x + Math.cos(a) * 18,
          y: h.y - 6,
          vx: Math.cos(a) * 470,
          vy: Math.sin(a) * 470 - 210,
          radius: 9,
          damage: total > 1 ? Math.round(stats.skill1Damage * 0.72) : stats.skill1Damage,
          healAmount: 0,
          healSolarBonus: 0,
          splashRadius: stats.skill1Radius,
          gravity: 960,
          bouncesLeft: 2,
          pierce: false,
          hitIds: new Set<string>(),
          slowDuration: 0,
          stunDuration: stats.skill1Stun,
          life: 1.45,
          maxLife: 1.45,
          color: '#F43F5E',
          lifestealRatio: 0,
        });
      }
      if (stats.capstones['vx_q3']) {
        h.vx = -cos * 340;
        h.vy = -250;
        h.grounded = false;
        h.shield = Math.max(h.shield, 45);
      }
      this.emitFx({ kind: 'ability', tag: 'dynamite', x: h.x, y: h.y, ownerId: h.id });
    } else if (h.heroId === 'xylar') {
      // Gravity Singularity orb -> deploys pulling black-hole HazardZone
      if (stats.capstones['xy_q3']) {
        h.shield = Math.max(h.shield, 55);
      }
      this.projectiles.push({
        id: nextId('sing'),
        ownerId: h.id,
        team: h.team,
        kind: 'singularity_orb',
        x: h.x + cos * 22,
        y: h.y + sin * 18,
        vx: cos * 660,
        vy: sin * 660,
        radius: 11,
        damage: stats.skill1Damage,
        healAmount: 0,
        healSolarBonus: 0,
        splashRadius: stats.skill1Radius,
        gravity: 0,
        bouncesLeft: 0,
        pierce: false,
        hitIds: new Set<string>(),
        slowDuration: stats.skill1Duration, // carry vortex duration
        stunDuration: 0,
        life: 0.62,
        maxLife: 0.62,
        color: '#818CF8',
        lifestealRatio: 0,
      });
      this.emitFx({ kind: 'ability', tag: 'vortex', x: h.x, y: h.y, ownerId: h.id });
    } else if (h.heroId === 'caldris') {
      // Orbital Smite Pillar locked at cursor (max range 760px)
      const dx = aimWorldX - h.x;
      const dy = aimWorldY - h.y;
      const dist = Math.hypot(dx, dy);
      const maxDist = 760;
      const tx = dist > maxDist ? h.x + (dx / dist) * maxDist : aimWorldX;
      const ty = dist > maxDist ? h.y + (dy / dist) * maxDist : aimWorldY;
      const lockTime = stats.capstones['cd_q3'] ? 0.52 : 0.85;
      this.hazards.push({
        id: nextId('orb'),
        ownerId: h.id,
        team: h.team,
        kind: 'orbital_smite',
        x: Math.max(80, Math.min(WORLD_W - 80, tx)),
        y: Math.max(120, Math.min(1040, ty)),
        radius: stats.skill1Radius,
        damage: stats.skill1Damage,
        timer: lockTime,
        maxTimer: lockTime,
        tickTimer: 0,
        triggered: false,
        color: '#2DD4BF',
        stunDuration: stats.skill1Stun,
      });
      this.emitFx({ kind: 'ability', tag: 'orbital', x: tx, y: ty, ownerId: h.id });
    }
  }

  private castSkill2(h: HeroEntity, stats: ReturnType<typeof computeHeroStats>): void {
    h.skill2Cd = stats.skill2Cooldown;

    if (h.heroId === 'marrow') {
      // Blight Furnace toxic rot aura
      h.rotTimer = stats.skill2Duration;
      h.rotTickTimer = 0.05;
      this.emitFx({ kind: 'ring', x: h.x, y: h.y, radius: stats.skill2Radius, color: '#10B981' });
      this.emitFx({ kind: 'ability', tag: 'rot', x: h.x, y: h.y, ownerId: h.id });
    } else if (h.heroId === 'seraph') {
      // Aegis Descent
      h.shield = Math.max(h.shield, stats.skill2SummonHp);
      for (const ally of this.heroes) {
        if (!ally.alive || ally.inDropPod || ally.team !== h.team) continue;
        if (Math.hypot(ally.x - h.x, ally.y - h.y) <= stats.skill2Radius + 40) {
          this.healHero(ally, stats.skill2HealAlly);
          if (stats.capstones['sr_e1'] && ally.id !== h.id) {
            ally.shield = Math.max(ally.shield, 90);
          }
        }
      }
      const aegisStun = stats.capstones['sr_e2'] ? 0.65 : 0.2;
      this.dealAreaDamage(h, h.x, h.y, stats.skill2Radius, stats.skill2Damage, 0.5, aegisStun, '#FBBF24', true);
      if (stats.capstones['sr_e3']) {
        h.skill1Cd = 0;
      }
      // Knockback enemies away
      for (const other of this.heroes) {
        if (!other.alive || other.inDropPod || other.team === h.team) continue;
        const d = Math.hypot(other.x - h.x, other.y - h.y);
        if (d <= stats.skill2Radius) {
          const dir = other.x >= h.x ? 1 : -1;
          other.vx = dir * stats.skill2Knockback;
          other.vy = -260;
        }
      }
      this.emitFx({ kind: 'ring', x: h.x, y: h.y, radius: stats.skill2Radius, color: '#FBBF24' });
      this.emitFx({ kind: 'ability', tag: 'aegis', x: h.x, y: h.y, ownerId: h.id });
    } else if (h.heroId === 'korak') {
      // Ancestral Spirit Skulls (orbiting drones; launch at 3)
      const mySkulls = this.summons.filter((s) => s.ownerId === h.id && s.kind === 'drone');
      if (stats.skill2SummonHp > 0) {
        h.shield = Math.max(h.shield, stats.skill2SummonHp);
      }
      if (mySkulls.length >= 3) {
        const cos = Math.cos(h.aimAngle);
        const sin = Math.sin(h.aimAngle);
        mySkulls.forEach((d, idx) => {
          const spread = (idx - 1) * 0.14;
          const a = h.aimAngle + spread;
          this.projectiles.push({
            id: nextId('skull_volley'),
            ownerId: h.id,
            team: h.team,
            kind: 'drone_kamikaze',
            x: d.x + cos * 8,
            y: d.y + sin * 8,
            vx: Math.cos(a) * 740,
            vy: Math.sin(a) * 740,
            radius: 10,
            damage: Math.round(stats.skill2Damage * 1.45),
            healAmount: 0,
            healSolarBonus: 0,
            splashRadius: 68,
            gravity: 0,
            bouncesLeft: 0,
            pierce: false,
            hitIds: new Set<string>(),
            slowDuration: 0.7,
            stunDuration: stats.capstones['kr_e1'] ? 0.45 : 0,
            life: 1.0,
            maxLife: 1.0,
            color: '#34D399',
            lifestealRatio: 0,
          });
        });
        this.summons = this.summons.filter((s) => !(s.ownerId === h.id && s.kind === 'drone'));
        if (stats.capstones['kr_e3']) {
          this.summons.push({
            id: nextId('skull'),
            ownerId: h.id,
            team: h.team,
            kind: 'drone',
            x: h.x,
            y: h.y - 36,
            vx: 0,
            vy: 0,
            w: 18,
            h: 18,
            hp: 55,
            maxHp: 55,
            life: 45,
            maxLife: 45,
            damage: stats.skill2Damage,
            radius: 260,
            knockback: 0,
            tickTimer: 0.45,
            orbitAngle: 0,
            orbitIndex: 0,
            explodeOnEnd: false,
            facing: h.facing,
            hitFlashTimer: 0,
            hitIds: new Set<string>(),
          });
        }
        this.emitFx({ kind: 'ability', tag: 'drone', x: h.x, y: h.y, ownerId: h.id });
      } else {
        this.summons.push({
          id: nextId('skull'),
          ownerId: h.id,
          team: h.team,
          kind: 'drone',
          x: h.x,
          y: h.y - 36,
          vx: 0,
          vy: 0,
          w: 18,
          h: 18,
          hp: 55,
          maxHp: 55,
          life: 45,
          maxLife: 45,
          damage: stats.skill2Damage,
          radius: 260,
          knockback: 0,
          tickTimer: 0.45,
          orbitAngle: (mySkulls.length * Math.PI * 2) / 3,
          orbitIndex: mySkulls.length,
          explodeOnEnd: false,
          facing: h.facing,
          hitFlashTimer: 0,
          hitIds: new Set<string>(),
        });
        this.emitFx({ kind: 'ability', tag: 'drone', x: h.x, y: h.y - 30, ownerId: h.id });
      }
    } else if (h.heroId === 'vorg') {
      // Soul Maelstrom
      h.spinTimer = stats.skill2Duration;
      h.spinTickTimer = 0.05;
      if (stats.capstones['vg_e3']) {
        h.shield = Math.max(h.shield, 75);
      }
      this.emitFx({ kind: 'ring', x: h.x, y: h.y, radius: stats.skill2Radius, color: '#A855F7' });
      this.emitFx({ kind: 'ability', tag: 'spin', x: h.x, y: h.y, ownerId: h.id });
    } else if (h.heroId === 'bastion') {
      // Divine Reckoning
      h.meltdownTimer = stats.skill2Duration;
      h.meltdownMaxTimer = stats.skill2Duration;
      if (stats.capstones['bs_e2']) {
        h.shield = Math.max(h.shield, 120);
      }
      this.emitFx({ kind: 'text', x: h.x, y: h.y - 46, text: 'DIVINE RECKONING!', color: '#FDE047', scale: 1.1 });
      this.emitFx({ kind: 'ability', tag: 'meltdown', x: h.x, y: h.y, ownerId: h.id });
    } else if (h.heroId === 'vexia') {
      // Holo-Seraph Ram
      const bullLife = stats.capstones['vx_e1'] ? 7.0 : 4.5;
      if (stats.capstones['vx_e3']) {
        h.shield = Math.max(h.shield, 55);
        h.skill1Cd = Math.max(0, h.skill1Cd - 2.0);
      }
      this.summons.push({
        id: nextId('bull'),
        ownerId: h.id,
        team: h.team,
        kind: 'bull',
        x: h.x + h.facing * 38,
        y: h.y,
        vx: h.facing * 275,
        vy: 0,
        w: 54,
        h: 40,
        hp: stats.skill2SummonHp,
        maxHp: stats.skill2SummonHp,
        life: bullLife,
        maxLife: bullLife,
        damage: stats.skill2Damage,
        radius: 56,
        knockback: stats.skill2Knockback,
        tickTimer: 0,
        orbitAngle: 0,
        orbitIndex: 0,
        explodeOnEnd: stats.skill2ExplodeOnEnd,
        facing: h.facing,
        hitFlashTimer: 0,
        hitIds: new Set<string>(),
      });
      this.emitFx({ kind: 'ability', tag: 'bull', x: h.x + h.facing * 32, y: h.y, ownerId: h.id });
    } else if (h.heroId === 'xylar') {
      // Phase-Shift Cloak
      h.cloakTimer = stats.skill2Duration;
      h.cloakCritReady = true;
      if (stats.skill2SummonHp > 0) {
        h.shield = Math.max(h.shield, stats.skill2SummonHp);
      }
      this.emitFx({ kind: 'ring', x: h.x, y: h.y, radius: 52, color: '#38BDF8' });
      this.emitFx({ kind: 'ability', tag: 'cloak', x: h.x, y: h.y, ownerId: h.id });
    } else if (h.heroId === 'caldris') {
      // Bone-Borg Guard: summons 2 (or 3/4) allied lane troopers + phylactery shield
      h.shield = Math.max(h.shield, stats.skill2HealAlly);
      if (stats.capstones['cd_e2']) {
        this.healHero(h, 55);
      }
      const count = 2 + stats.skill1ExtraCount;
      const lane: 'top' | 'bot' = h.y < 740 ? 'top' : 'bot';
      const borgTier = stats.capstones['cd_e1'] ? 5 : Math.max(this.waveTier, 3);
      for (let i = 0; i < count; i++) {
        this.droids.push({
          id: nextId(`borg_${h.team}`),
          team: h.team,
          lane,
          tier: borgTier,
          x: Math.max(80, Math.min(WORLD_W - 80, h.x + h.facing * (28 + i * 28))),
          y: h.y - 6,
          vx: 0,
          vy: 0,
          w: borgTier >= 5 ? 30 : 26,
          h: borgTier >= 5 ? 36 : 32,
          hp: stats.skill2SummonHp,
          maxHp: stats.skill2SummonHp,
          damage: stats.skill2Damage,
          attackCd: 0.25,
          hitFlashTimer: 0,
          walkCycle: i * 1.5,
          grounded: false,
          facing: h.facing,
          slowTimer: 0,
          stunTimer: 0,
        });
      }
      this.emitFx({ kind: 'ring', x: h.x, y: h.y, radius: 74, color: '#2DD4BF' });
      this.emitFx({ kind: 'ability', tag: 'undead', x: h.x, y: h.y, ownerId: h.id });
    }
  }

  private detonateMeltdown(h: HeroEntity, stats: ReturnType<typeof computeHeroStats>): void {
    this.dealAreaDamage(h, h.x, h.y, stats.skill2Radius, stats.skill2Damage, 0.8, 0.55, '#FBBF24', true);
    if (stats.capstones['bs_e1']) {
      for (const ally of this.heroes) {
        if (!ally.alive || ally.inDropPod || ally.team !== h.team) continue;
        if (Math.hypot(ally.x - h.x, ally.y - h.y) <= stats.skill2Radius + 40) {
          this.healHero(ally, 70);
        }
      }
    }
    this.emitFx({
      kind: 'explosion',
      x: h.x,
      y: h.y,
      radius: stats.skill2Radius,
      color: '#FBBF24',
      heavy: true,
      ownerId: h.id,
    });
  }

  private updateHooks(dt: number): void {
    for (let i = this.hooks.length - 1; i >= 0; i--) {
      const hk = this.hooks[i];
      const owner = this.heroes.find((h) => h.id === hk.ownerId);
      if (!owner || !owner.alive || owner.inDropPod) {
        this.releaseHookTarget(hk);
        this.hooks.splice(i, 1);
        continue;
      }

      // Anchor tail continuously to Marrow-Hook's body
      hk.startX = owner.x;
      hk.startY = owner.y - 4;

      if (hk.state === 'extending') {
        hk.x += hk.vx * dt;
        hk.y += hk.vy * dt;

        // Check enemy champions first (prioritize champions!)
        let hitHero: HeroEntity | null = null;
        for (const other of this.heroes) {
          if (!other.alive || other.inDropPod || other.team === hk.team) continue;
          if (Math.hypot(other.x - hk.x, other.y - hk.y) <= 34) {
            hitHero = other;
            break;
          }
        }

        if (hitHero) {
          hk.state = 'retracting';
          hk.latchedTargetId = hitHero.id;
          hk.latchedTargetKind = 'hero';
          hitHero.hookedById = owner.id;
          hitHero.recallTimer = 0;
          hitHero.dashTimer = 0;
          hitHero.stunTimer = Math.max(hitHero.stunTimer, hk.stunDuration);
          this.applyDamageToHero(hitHero, hk.damage, owner);
          const ownerStats = computeHeroStats(owner.heroId, owner.upgrades, owner.bonusMaxHp);
          if (ownerStats.capstones['mh_q2']) {
            owner.rotTimer = Math.max(owner.rotTimer, 2.2);
            owner.rotTickTimer = 0.05;
          }
          if (ownerStats.capstones['mh_q3']) {
            owner.skill1Cd *= 0.55;
          }
          this.emitFx({ kind: 'ability', tag: 'hook_hit', x: hitHero.x, y: hitHero.y, ownerId: owner.id });
          this.emitFx({ kind: 'text', x: hitHero.x, y: hitHero.y - 42, text: 'HOOKED!', color: '#34D399', scale: 1.25 });
          this.emitFx({ kind: 'ring', x: hitHero.x, y: hitHero.y, radius: 44, color: '#10B981' });
        } else {
          // Check enemy droids
          let hitDroid: DroidEntity | null = null;
          for (const d of this.droids) {
            if (d.team === hk.team) continue;
            if (Math.hypot(d.x - hk.x, d.y - hk.y) <= 28) {
              hitDroid = d;
              break;
            }
          }
          if (hitDroid) {
            hk.state = 'retracting';
            hk.latchedTargetId = hitDroid.id;
            hk.latchedTargetKind = 'droid';
            this.damageDroid(hitDroid, hk.damage, owner);
            this.emitFx({ kind: 'ability', tag: 'hook_hit', x: hitDroid.x, y: hitDroid.y, ownerId: owner.id });
          } else {
            const dist = Math.hypot(hk.x - hk.startX, hk.y - hk.startY);
            if (dist >= hk.maxRange || hk.x < 30 || hk.x > WORLD_W - 30 || hk.y < 30 || hk.y > WORLD_H - 30) {
              hk.state = 'retracting';
            }
          }
        }
      } else {
        // Retracting smoothly back to Marrow-Hook
        const dx = hk.startX - hk.x;
        const dy = hk.startY - hk.y;
        const dist = Math.hypot(dx, dy);
        const ownerStats = computeHeroStats(owner.heroId, owner.upgrades, owner.bonusMaxHp);
        const pullSpeed = ownerStats.capstones['mh_q1'] ? 1120 * 1.3 : 1120;
        if (dist <= 52) {
          this.releaseHookTarget(hk);
          this.hooks.splice(i, 1);
          continue;
        }
        hk.x += (dx / dist) * pullSpeed * dt;
        hk.y += (dy / dist) * pullSpeed * dt;

        // Drag latched victim along with the claw!
        if (hk.latchedTargetId && hk.latchedTargetKind === 'hero') {
          const victim = this.heroes.find((h) => h.id === hk.latchedTargetId);
          if (victim && victim.alive && !victim.inDropPod) {
            victim.x = hk.x;
            victim.y = hk.y;
            victim.vx = 0;
            victim.vy = 0;
          } else {
            hk.latchedTargetId = null;
          }
        } else if (hk.latchedTargetId && hk.latchedTargetKind === 'droid') {
          const d = this.droids.find((dr) => dr.id === hk.latchedTargetId);
          if (d && d.hp > 0) {
            d.x = hk.x;
            d.y = hk.y;
            d.vx = 0;
            d.vy = 0;
          } else {
            hk.latchedTargetId = null;
          }
        }
      }
    }
  }

  private releaseHookTarget(hk: HookEntity): void {
    if (hk.latchedTargetId && hk.latchedTargetKind === 'hero') {
      const victim = this.heroes.find((h) => h.id === hk.latchedTargetId);
      if (victim) {
        victim.hookedById = null;
        victim.vx = 0;
        victim.vy = -80;
      }
    }
  }

  private updateHazards(dt: number): void {
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const hz = this.hazards[i];
      const owner = this.heroes.find((h) => h.id === hz.ownerId) ?? null;
      const ownerStats = owner ? computeHeroStats(owner.heroId, owner.upgrades, owner.bonusMaxHp) : null;

      if (hz.kind === 'orbital_smite') {
        hz.timer -= dt;
        if (hz.timer <= 0 && !hz.triggered) {
          hz.triggered = true;
          const dealt = this.dealAreaDamage(
            owner,
            hz.x,
            hz.y,
            hz.radius,
            hz.damage,
            0.7,
            hz.stunDuration,
            hz.color,
            true
          );
          if (owner && ownerStats && ownerStats.lifestealRatio > 0 && dealt > 0) {
            this.healHero(owner, dealt * Math.min(0.3, ownerStats.lifestealRatio));
          }
          // Caldris cd_q1 capstone: schedule 2nd aftershock beam 0.65s later (once only)
          if (owner && ownerStats?.capstones['cd_q1'] && !hz.id.startsWith('orb_after_')) {
            this.hazards.push({
              id: nextId('orb_after'),
              ownerId: hz.ownerId,
              team: hz.team,
              kind: 'orbital_smite',
              x: hz.x,
              y: hz.y,
              radius: Math.round(hz.radius * 0.9),
              damage: Math.round(hz.damage * 0.65),
              timer: 0.65,
              maxTimer: 0.65,
              tickTimer: 0,
              triggered: false,
              color: '#C084FC',
              stunDuration: 0.35,
            });
          }
          // Caldris cd_q2 capstone: spawn a Bone-Borg directly at the scorched blast site
          if (owner && ownerStats?.capstones['cd_q2'] && !hz.id.startsWith('orb_after_')) {
            const lane: 'top' | 'bot' = hz.y < 740 ? 'top' : 'bot';
            const borgTier = ownerStats.capstones['cd_e1'] ? 5 : Math.max(this.waveTier, 3);
            this.droids.push({
              id: nextId(`borg_${owner.team}`),
              team: owner.team,
              lane,
              tier: borgTier,
              x: hz.x,
              y: Math.min(930, hz.y),
              vx: 0,
              vy: 0,
              w: borgTier >= 5 ? 30 : 26,
              h: borgTier >= 5 ? 36 : 32,
              hp: ownerStats.skill2SummonHp,
              maxHp: ownerStats.skill2SummonHp,
              damage: ownerStats.skill2Damage,
              attackCd: 0.25,
              hitFlashTimer: 0,
              walkCycle: 0,
              grounded: false,
              facing: owner.team === 'blue' ? 1 : -1,
              slowTimer: 0,
              stunTimer: 0,
            });
          }
          this.emitFx({
            kind: 'explosion',
            x: hz.x,
            y: hz.y,
            radius: hz.radius,
            color: hz.color,
            heavy: true,
            ownerId: hz.ownerId,
          });
          hz.timer = 0.28; // keep beam visible briefly after detonation
        } else if (hz.triggered && hz.timer <= 0) {
          this.hazards.splice(i, 1);
        }
      } else if (hz.kind === 'singularity') {
        hz.timer -= dt;
        hz.tickTimer -= dt;
        const pullScale = ownerStats?.capstones['xy_q2'] ? 1.6 : 1;

        // Pull enemies smoothly toward the black-hole center!
        for (const other of this.heroes) {
          if (!other.alive || other.inDropPod || other.team === hz.team) continue;
          const dx = hz.x - other.x;
          const dy = hz.y - other.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 14 && dist <= hz.radius + 25) {
            const pull = 390 * pullScale * dt;
            other.x += (dx / dist) * pull;
            other.y += (dy / dist) * pull * 0.7;
            other.slowTimer = Math.max(other.slowTimer, 0.4);
          }
        }
        for (const d of this.droids) {
          if (d.team === hz.team) continue;
          const dx = hz.x - d.x;
          const dist = Math.abs(dx);
          if (dist > 10 && dist <= hz.radius + 20) {
            d.x += Math.sign(dx) * 240 * pullScale * dt;
          }
        }

        if (hz.tickTimer <= 0) {
          hz.tickTimer = 0.34;
          this.dealAreaDamage(owner, hz.x, hz.y, hz.radius, hz.damage, 0.65, 0, hz.color, false);
        }
        if (hz.timer <= 0) {
          // Xylar xy_q1 capstone: Event Horizon Collapse implosion on expiry
          if (ownerStats?.capstones['xy_q1']) {
            this.dealAreaDamage(owner, hz.x, hz.y, hz.radius + 18, 70, 0.6, 0.6, '#818CF8', false);
            this.emitFx({
              kind: 'explosion',
              x: hz.x,
              y: hz.y,
              radius: hz.radius + 18,
              color: '#818CF8',
              heavy: true,
              ownerId: hz.ownerId,
            });
          }
          this.hazards.splice(i, 1);
        }
      }
    }
  }

  private updateDroids(dt: number): void {
    for (let i = this.droids.length - 1; i >= 0; i--) {
      const d = this.droids[i];
      if (d.hp <= 0) {
        this.droids.splice(i, 1);
        continue;
      }
      d.hitFlashTimer = Math.max(0, d.hitFlashTimer - dt);
      d.attackCd = Math.max(0, d.attackCd - dt);
      d.slowTimer = Math.max(0, d.slowTimer - dt);
      d.stunTimer = Math.max(0, d.stunTimer - dt);

      const dir: 1 | -1 = d.team === 'blue' ? 1 : -1;
      d.facing = dir;

      let targetX = -1;
      let targetY = -1;
      let bestDist = 245;

      for (const other of this.droids) {
        if (other.team === d.team || other.hp <= 0) continue;
        const dist = Math.hypot(other.x - d.x, other.y - d.y);
        if (dist < bestDist && Math.abs(other.y - d.y) < 110) {
          bestDist = dist;
          targetX = other.x;
          targetY = other.y;
        }
      }
      for (const t of this.turrets) {
        if (!t.alive || t.team === d.team || t.shielded) continue;
        const dist = Math.hypot(t.x - d.x, t.y - 44 - d.y);
        if (dist < bestDist && Math.abs(t.y - 44 - d.y) < 130) {
          bestDist = dist;
          targetX = t.x;
          targetY = t.y - 44;
        }
      }
      for (const c of this.cores) {
        if (c.team === d.team || c.shielded) continue;
        const dist = Math.hypot(c.x - d.x, c.y - 72 - d.y);
        if (dist < bestDist + 50 && Math.abs(c.y - 72 - d.y) < 170) {
          bestDist = dist;
          targetX = c.x;
          targetY = c.y - 72;
        }
      }
      for (const h of this.heroes) {
        if (!h.alive || h.inDropPod || h.team === d.team || h.cloakTimer > 0) continue;
        const dist = Math.hypot(h.x - d.x, h.y - d.y);
        if (dist < bestDist && Math.abs(h.y - d.y) < 110) {
          bestDist = dist;
          targetX = h.x;
          targetY = h.y;
        }
      }

      if (d.stunTimer > 0) {
        d.vx = 0;
      } else if (targetX >= 0) {
        d.vx = 0;
        if (d.attackCd <= 0) {
          d.attackCd = 0.85;
          const angle = Math.atan2(targetY - d.y, targetX - d.x);
          this.projectiles.push({
            id: nextId('dp'),
            ownerId: d.id,
            team: d.team,
            kind: 'droid_shot',
            x: d.x + Math.cos(angle) * 14,
            y: d.y - 4,
            vx: Math.cos(angle) * 540,
            vy: Math.sin(angle) * 540,
            radius: 4.5,
            damage: d.damage,
            healAmount: 0,
            healSolarBonus: 0,
            splashRadius: 0,
            gravity: 0,
            bouncesLeft: 0,
            pierce: false,
            hitIds: new Set<string>(),
            slowDuration: 0,
            stunDuration: 0,
            life: 0.58,
            maxLife: 0.58,
            color: d.team === 'blue' ? '#38BDF8' : '#FB7185',
            lifestealRatio: 0,
          });
        }
      } else {
        const spd = (d.tier >= 4 ? 112 : 96) * (d.slowTimer > 0 ? 0.55 : 1);
        d.vx = dir * spd;
        d.walkCycle += dt * 7;
      }

      d.vy = Math.min(820, d.vy + GRAVITY * dt);
      this.moveAndCollide(d, dt);

      // Keep top-lane droids dropping toward enemy core once past enemy inner tower
      if (d.lane === 'top') {
        if ((d.team === 'blue' && d.x > WORLD_W - 650) || (d.team === 'red' && d.x < 650)) {
          d.lane = 'bot';
        }
      }
    }
  }

  private updateTurretsAndCores(dt: number): void {
    // Update 2-tier shield logic:
    // Inner turret is shielded until same-team same-lane Outer turret is destroyed.
    for (const t of this.turrets) {
      if (!t.alive) continue;
      t.hitFlashTimer = Math.max(0, t.hitFlashTimer - dt);
      t.attackCd = Math.max(0, t.attackCd - dt);

      if (t.tier === 'inner') {
        const outerAlive = this.turrets.some(
          (o) => o.team === t.team && o.lane === t.lane && o.tier === 'outer' && o.alive
        );
        const wasShielded = t.shielded;
        t.shielded = outerAlive;
        if (wasShielded && !t.shielded) {
          this.pushBanner(
            `${t.team === 'blue' ? 'SANCTUM' : 'INVASION'} INNER TOWER EXPOSED!`,
            `${t.lane.toUpperCase()} lane Inner Reliquary barrier shattered!`,
            t.team === 'blue' ? 'red' : 'blue',
            3.0
          );
        }
      }

      // Target enemy droids first, then summons, then visible heroes
      let targetX = -1;
      let targetY = -1;
      let bestDist = t.range;

      for (const d of this.droids) {
        if (d.team === t.team || d.hp <= 0) continue;
        const dist = Math.hypot(d.x - t.x, d.y - (t.y - 52));
        if (dist < bestDist) {
          bestDist = dist;
          targetX = d.x;
          targetY = d.y;
        }
      }
      if (targetX < 0) {
        for (const s of this.summons) {
          if (s.team === t.team || s.kind === 'drone') continue;
          const dist = Math.hypot(s.x - t.x, s.y - (t.y - 52));
          if (dist < bestDist) {
            bestDist = dist;
            targetX = s.x;
            targetY = s.y;
          }
        }
      }
      if (targetX < 0) {
        for (const h of this.heroes) {
          if (!h.alive || h.inDropPod || h.team === t.team || h.cloakTimer > 0) continue;
          const dist = Math.hypot(h.x - t.x, h.y - (t.y - 52));
          if (dist < bestDist) {
            bestDist = dist;
            targetX = h.x;
            targetY = h.y;
          }
        }
      }

      if (targetX >= 0) {
        t.aimAngle = Math.atan2(targetY - (t.y - 58), targetX - t.x);
        if (t.attackCd <= 0) {
          t.attackCd = 0.78;
          this.projectiles.push({
            id: nextId('tp'),
            ownerId: t.id,
            team: t.team,
            kind: 'turret_shot',
            x: t.x + Math.cos(t.aimAngle) * 30,
            y: t.y - 58 + Math.sin(t.aimAngle) * 26,
            vx: Math.cos(t.aimAngle) * 690,
            vy: Math.sin(t.aimAngle) * 690,
            radius: 7,
            damage: t.tier === 'inner' ? 30 : 24,
            healAmount: 0,
            healSolarBonus: 0,
            splashRadius: 0,
            gravity: 0,
            bouncesLeft: 0,
            pierce: false,
            hitIds: new Set<string>(),
            slowDuration: 0,
            stunDuration: 0,
            life: 0.75,
            maxLife: 0.75,
            color: t.team === 'blue' ? '#38BDF8' : '#FB7185',
            lifestealRatio: 0,
          });
        }
      }
    }

    // Core is shielded while BOTH Inner Towers of that team are still standing
    for (const c of this.cores) {
      c.hitFlashTimer = Math.max(0, c.hitFlashTimer - dt);
      c.pulsePhase += dt * 3;
      const innerAliveCount = this.turrets.filter(
        (t) => t.team === c.team && t.tier === 'inner' && t.alive
      ).length;
      const wasShielded = c.shielded;
      c.shielded = innerAliveCount >= 2;
      if (wasShielded && !c.shielded) {
        this.pushBanner(
          `${c.team === 'blue' ? 'SANCTUM' : 'INVASION'} ANCIENT CORE EXPOSED!`,
          'Barrier collapsed — push now to shatter the Ancient Core!',
          c.team === 'blue' ? 'red' : 'emerald',
          3.8
        );
      }
    }
  }

  private updateMapObjects(dt: number): void {
    for (const sc of this.solarCubes) {
      sc.bobPhase += dt * 3;
      if (!sc.active) {
        sc.respawnTimer -= dt;
        if (sc.respawnTimer <= 0) sc.active = true;
        continue;
      }
      for (const h of this.heroes) {
        if (!h.alive || h.inDropPod) continue;
        if (Math.hypot(h.x - sc.x, h.y - sc.y) < 34) {
          sc.active = false;
          sc.respawnTimer = 20;
          this.grantSolar(h, sc.value, sc.x, sc.y);
          break;
        }
      }
    }

    for (const c of this.creeps) {
      c.bobPhase += dt * 2.4;
      c.hitFlashTimer = Math.max(0, c.hitFlashTimer - dt);
      if (!c.alive) {
        c.respawnTimer -= dt;
        if (c.respawnTimer <= 0) {
          c.alive = true;
          c.hp = c.maxHp;
        }
      } else {
        c.x = c.homeX + Math.sin(c.bobPhase) * 22;
        c.y = c.homeY + Math.cos(c.bobPhase * 1.4) * 5;
      }
    }
  }

  private updateSummons(dt: number): void {
    for (let i = this.summons.length - 1; i >= 0; i--) {
      const s = this.summons[i];
      s.life -= dt;
      s.hitFlashTimer = Math.max(0, s.hitFlashTimer - dt);
      const owner = this.heroes.find((h) => h.id === s.ownerId) ?? null;
      const ownerStats = owner ? computeHeroStats(owner.heroId, owner.upgrades, owner.bonusMaxHp) : null;

      if (s.hp <= 0 || s.life <= 0) {
        if (s.explodeOnEnd && s.kind === 'bull') {
          this.dealAreaDamage(owner, s.x, s.y, 134, 95, 0.5, 0.45, '#F43F5E', true);
          this.emitFx({ kind: 'explosion', x: s.x, y: s.y, radius: 134, color: '#F43F5E', heavy: true, ownerId: s.ownerId });
        } else if (s.explodeOnEnd && s.kind === 'totem') {
          // Korak kr_q3 capstone: Totem end burst (+70 ally heal & 55 enemy dmg)
          for (const ally of this.heroes) {
            if (!ally.alive || ally.inDropPod || ally.team !== s.team) continue;
            if (Math.hypot(ally.x - s.x, ally.y - s.y) <= s.radius + 20) {
              this.healHero(ally, 70);
            }
          }
          this.dealAreaDamage(owner, s.x, s.y, s.radius, 55, 0.8, 0, '#34D399', false);
          this.emitFx({ kind: 'explosion', x: s.x, y: s.y, radius: s.radius, color: '#34D399', heavy: true, ownerId: s.ownerId });
        }
        this.summons.splice(i, 1);
        continue;
      }

      if (s.kind === 'bull') {
        s.vy = Math.min(800, s.vy + GRAVITY * dt);
        this.moveAndCollide({ ...s, grounded: false }, dt);
        s.x += s.vx * dt;
        // Snap onto ground beneath it
        for (const p of PLATFORMS) {
          if (s.x > p.x && s.x < p.x + p.w && s.y + s.h / 2 >= p.y - 6 && s.y + s.h / 2 <= p.y + 22) {
            s.y = p.y - s.h / 2;
            s.vy = 0;
          }
        }

        s.tickTimer -= dt;
        if (s.tickTimer <= 0) {
          s.tickTimer = 0.25;
          for (const h of this.heroes) {
            if (!h.alive || h.inDropPod || h.team === s.team) continue;
            if (Math.hypot(h.x - s.x, h.y - s.y) < 52) {
              this.applyDamageToHero(h, s.damage, owner);
              h.vx = s.facing * s.knockback;
              h.vy = -220;
            }
          }
          for (const d of this.droids) {
            if (d.team === s.team) continue;
            if (Math.hypot(d.x - s.x, d.y - s.y) < 48) {
              this.damageDroid(d, s.damage, owner);
            }
          }
          const siegeMult = ownerStats?.capstones['vx_e1'] ? 2.0 : 1.0;
          for (const t of this.turrets) {
            if (!t.alive || t.team === s.team || t.shielded) continue;
            if (Math.hypot(t.x - s.x, t.y - 45 - s.y) < 58) {
              this.damageTurret(t, s.damage * siegeMult, owner);
              s.hp -= 35;
            }
          }
          for (const c of this.cores) {
            if (c.team === s.team || c.shielded) continue;
            if (Math.hypot(c.x - s.x, c.y - 72 - s.y) < 74) {
              this.damageCore(c, s.damage * siegeMult, owner);
              s.hp -= 35;
            }
          }
        }
      } else if (s.kind === 'totem') {
        s.tickTimer -= dt;
        if (s.tickTimer <= 0) {
          s.tickTimer = 0.65;
          for (const ally of this.heroes) {
            if (!ally.alive || ally.inDropPod || ally.team !== s.team) continue;
            if (Math.hypot(ally.x - s.x, ally.y - s.y) <= s.radius) {
              this.healHero(ally, s.knockback);
              if (ownerStats?.capstones['kr_q1']) {
                ally.shield = Math.min(240, ally.shield + 22);
              }
            }
          }
          const curseSlow = Math.max(0.85, ownerStats?.skill1Slow ?? 0.85);
          if (s.damage > 0) {
            this.dealAreaDamage(owner, s.x, s.y, s.radius, s.damage, curseSlow, 0, '#34D399', false);
          } else {
            for (const other of this.heroes) {
              if (!other.alive || other.inDropPod || other.team === s.team) continue;
              if (Math.hypot(other.x - s.x, other.y - s.y) <= s.radius) {
                other.slowTimer = Math.max(other.slowTimer, curseSlow);
              }
            }
          }
          this.emitFx({ kind: 'ring', x: s.x, y: s.y, radius: s.radius * 0.88, color: '#34D399' });
        }
      } else if (s.kind === 'drone') {
        if (!owner || !owner.alive || owner.inDropPod) {
          this.summons.splice(i, 1);
          continue;
        }
        s.orbitAngle += dt * 3.1;
        s.x = owner.x + Math.cos(s.orbitAngle) * 44;
        s.y = owner.y - 16 + Math.sin(s.orbitAngle) * 26;
        s.tickTimer -= dt;
        if (s.tickTimer <= 0) {
          s.tickTimer = ownerStats?.capstones['kr_e1'] ? 0.48 : 0.95;
          let tx = -1;
          let ty = -1;
          let best = s.radius;
          for (const h of this.heroes) {
            if (!h.alive || h.inDropPod || h.team === s.team || h.cloakTimer > 0) continue;
            const d = Math.hypot(h.x - s.x, h.y - s.y);
            if (d < best) {
              best = d;
              tx = h.x;
              ty = h.y;
            }
          }
          if (tx < 0) {
            for (const dr of this.droids) {
              if (dr.team === s.team) continue;
              const d = Math.hypot(dr.x - s.x, dr.y - s.y);
              if (d < best) {
                best = d;
                tx = dr.x;
                ty = dr.y;
              }
            }
          }
          if (tx >= 0) {
            const a = Math.atan2(ty - s.y, tx - s.x);
            this.projectiles.push({
              id: nextId('sk_bolt'),
              ownerId: s.ownerId,
              team: s.team,
              kind: 'drone_bolt',
              x: s.x,
              y: s.y,
              vx: Math.cos(a) * 650,
              vy: Math.sin(a) * 650,
              radius: 5,
              damage: Math.round(s.damage * 0.52),
              healAmount: 0,
              healSolarBonus: 0,
              splashRadius: 0,
              gravity: 0,
              bouncesLeft: 0,
              pierce: false,
              hitIds: new Set<string>(),
              slowDuration: 0,
              stunDuration: 0,
              life: 0.55,
              maxLife: 0.55,
              color: '#A78BFA',
              lifestealRatio: 0,
            });
          }
        }
      }
    }
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const owner = this.heroes.find((h) => h.id === p.ownerId) ?? null;
      const ownerStats = owner ? computeHeroStats(owner.heroId, owner.upgrades, owner.bonusMaxHp) : null;

      if (p.life <= 0 || p.x < 10 || p.x > WORLD_W - 10 || p.y > WORLD_H + 40) {
        if (p.kind === 'singularity_orb') {
          this.spawnSingularity(p);
        } else if (p.kind === 'soul_orb' && ownerStats?.capstones['cd_p1']) {
          this.dealAreaDamage(owner, p.x, p.y, 75, Math.round(p.damage * 1.1), p.slowDuration, 0, '#2DD4BF', false);
          this.emitFx({ kind: 'explosion', x: p.x, y: p.y, radius: 75, color: '#2DD4BF', heavy: false, ownerId: p.ownerId });
        } else if (p.splashRadius > 0 && (p.kind === 'dynamite' || p.kind === 'mortar' || p.kind === 'spear')) {
          this.detonateProjectile(p, owner);
        }
        this.projectiles.splice(i, 1);
        continue;
      }

      // Platform collision for solid ground/battlements
      let hitSolid = false;
      for (const plat of PLATFORMS) {
        if (plat.oneWay) continue;
        if (
          p.x + p.radius > plat.x &&
          p.x - p.radius < plat.x + plat.w &&
          p.y + p.radius > plat.y &&
          p.y - p.radius < plat.y + plat.h
        ) {
          if (p.bouncesLeft > 0) {
            p.bouncesLeft -= 1;
            p.vy = -Math.abs(p.vy) * 0.54;
            p.vx *= 0.78;
            p.y = plat.y - p.radius - 1;
          } else {
            hitSolid = true;
          }
          break;
        }
      }

      if (hitSolid && p.kind !== 'cleaver' && p.kind !== 'soul_orb' && p.kind !== 'biobeam') {
        if (p.kind === 'singularity_orb') {
          this.spawnSingularity(p);
        } else if (p.splashRadius > 0) {
          this.detonateProjectile(p, owner);
        }
        this.projectiles.splice(i, 1);
        continue;
      }

      // Allied heal check (Korak Hex-Mender & Seraph-9 Merciful Light)
      if (p.healAmount > 0) {
        for (const ally of this.heroes) {
          if (!ally.alive || ally.inDropPod || ally.team !== p.team || ally.id === p.ownerId) continue;
          if (p.hitIds.has(`heal_${ally.id}`)) continue;
          if (Math.hypot(ally.x - p.x, ally.y - p.y) <= p.radius + 22) {
            p.hitIds.add(`heal_${ally.id}`);
            const healed = this.healHero(ally, p.healAmount);
            if (ownerStats?.capstones['sr_p2'] && p.kind === 'revolver') {
              ally.shield = Math.min(240, ally.shield + 20);
            }
            if (ownerStats?.capstones['kr_p1'] && p.kind === 'biobeam') {
              ally.shield = Math.min(240, ally.shield + 26);
            }
            if (owner && ownerStats?.capstones['kr_p3'] && p.kind === 'biobeam') {
              this.healHero(owner, p.healAmount * 0.5);
            }
            if (owner && ownerStats?.capstones['kr_u3']) {
              owner.skill1Cd = Math.max(0, owner.skill1Cd - 0.4);
              owner.skill2Cd = Math.max(0, owner.skill2Cd - 0.4);
            }
            if (healed > 0 && owner && p.healSolarBonus > 0) {
              this.grantSolar(owner, p.healSolarBonus, ally.x, ally.y - 16);
            }
          }
        }
      }

      // Caldris cd_p2 capstone: Soul-Rail Orb repairs allied Bone-Borgs & creeps (+26 HP)
      if (p.kind === 'soul_orb' && ownerStats?.capstones['cd_p2']) {
        for (const d of this.droids) {
          if (d.team !== p.team || d.hp <= 0 || d.hp >= d.maxHp || p.hitIds.has(`rep_${d.id}`)) continue;
          if (Math.hypot(d.x - p.x, d.y - p.y) <= p.radius + 20) {
            p.hitIds.add(`rep_${d.id}`);
            d.hp = Math.min(d.maxHp, d.hp + 26);
            this.emitFx({ kind: 'text', x: d.x, y: d.y - 24, text: '+26', color: '#2DD4BF', scale: 0.85 });
          }
        }
      }

      let consumed = false;

      // Enemy Heroes
      for (const h of this.heroes) {
        if (!h.alive || h.inDropPod || h.team === p.team || p.hitIds.has(h.id)) continue;
        if (Math.hypot(h.x - p.x, h.y - p.y) <= p.radius + Math.max(h.w, h.h) * 0.45) {
          p.hitIds.add(h.id);
          if (p.kind === 'singularity_orb') {
            this.spawnSingularity(p);
            consumed = true;
            break;
          }
          if (p.splashRadius > 0) {
            this.detonateProjectile(p, owner);
            consumed = true;
            break;
          }
          this.applyDamageToHero(h, p.damage, owner);
          if (p.slowDuration > 0) h.slowTimer = Math.max(h.slowTimer, p.slowDuration);
          if (p.stunDuration > 0) h.stunTimer = Math.max(h.stunTimer, p.stunDuration);
          if (owner && ownerStats?.capstones['mh_p2'] && p.kind === 'cleaver') {
            owner.shield = Math.min(240, owner.shield + 30);
          }
          if (owner && ownerStats?.capstones['xy_p3'] && p.kind === 'dagger') {
            owner.skill1Cd = Math.max(0, owner.skill1Cd - 0.15);
          }
          if (owner && p.lifestealRatio > 0) {
            const leech = p.damage * p.lifestealRatio;
            const actual = this.healHero(owner, leech);
            if (ownerStats?.capstones['vg_p3'] && leech > actual) {
              owner.shield = Math.min(85, owner.shield + (leech - actual));
            }
          }
          this.emitFx({ kind: 'hit', x: p.x, y: p.y, color: p.color, ownerId: p.ownerId });
          if (!p.pierce) {
            consumed = true;
            break;
          }
        }
      }
      if (consumed) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // Enemy Droids
      for (const d of this.droids) {
        if (d.team === p.team || d.hp <= 0 || p.hitIds.has(d.id)) continue;
        if (Math.hypot(d.x - p.x, d.y - p.y) <= p.radius + 18) {
          p.hitIds.add(d.id);
          if (p.kind === 'singularity_orb') {
            this.spawnSingularity(p);
            consumed = true;
            break;
          }
          if (p.splashRadius > 0) {
            this.detonateProjectile(p, owner);
            consumed = true;
            break;
          }
          this.damageDroid(d, p.damage, owner);
          if (p.slowDuration > 0) d.slowTimer = Math.max(d.slowTimer, p.slowDuration);
          if (owner && ownerStats?.capstones['xy_p3'] && p.kind === 'dagger') {
            owner.skill1Cd = Math.max(0, owner.skill1Cd - 0.15);
          }
          if (owner && p.lifestealRatio > 0) {
            const leech = p.damage * p.lifestealRatio * 0.5;
            const actual = this.healHero(owner, leech);
            if (ownerStats?.capstones['vg_p3'] && leech > actual) {
              owner.shield = Math.min(85, owner.shield + (leech - actual));
            }
          }
          this.emitFx({ kind: 'hit', x: p.x, y: p.y, color: p.color, ownerId: p.ownerId });
          if (!p.pierce) {
            consumed = true;
            break;
          }
        }
      }
      if (consumed) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // Enemy Summons
      for (const s of this.summons) {
        if (s.team === p.team || s.kind === 'drone' || p.hitIds.has(s.id)) continue;
        if (Math.hypot(s.x - p.x, s.y - p.y) <= p.radius + 22) {
          p.hitIds.add(s.id);
          s.hp -= p.damage;
          s.hitFlashTimer = 0.1;
          if (!p.pierce) {
            consumed = true;
            break;
          }
        }
      }
      if (consumed) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // Neutral Creeps (heroes only)
      if (owner) {
        for (const c of this.creeps) {
          if (!c.alive || p.hitIds.has(c.id)) continue;
          if (Math.hypot(c.x - p.x, c.y - p.y) <= p.radius + 20) {
            p.hitIds.add(c.id);
            this.damageCreep(c, p.damage, owner);
            if (!p.pierce) {
              consumed = true;
              break;
            }
          }
        }
      }
      if (consumed) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // Enemy Turrets
      for (const t of this.turrets) {
        if (!t.alive || t.team === p.team || p.hitIds.has(t.id)) continue;
        if (Math.abs(p.x - t.x) <= t.w * 0.52 + p.radius && p.y >= t.y - t.h && p.y <= t.y) {
          p.hitIds.add(t.id);
          if (p.splashRadius > 0) {
            this.detonateProjectile(p, owner);
          } else {
            this.damageTurret(t, p.damage, owner);
          }
          consumed = true;
          break;
        }
      }
      if (consumed) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // Enemy Core
      for (const c of this.cores) {
        if (c.team === p.team || p.hitIds.has(c.id)) continue;
        if (Math.abs(p.x - c.x) <= c.w * 0.52 + p.radius && p.y >= c.y - c.h && p.y <= c.y) {
          p.hitIds.add(c.id);
          if (p.splashRadius > 0) {
            this.detonateProjectile(p, owner);
          } else {
            this.damageCore(c, p.damage, owner);
          }
          consumed = true;
          break;
        }
      }
      if (consumed) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  private spawnSingularity(p: ProjectileEntity): void {
    this.hazards.push({
      id: nextId('vortex'),
      ownerId: p.ownerId,
      team: p.team,
      kind: 'singularity',
      x: p.x,
      y: p.y,
      radius: p.splashRadius,
      damage: p.damage,
      timer: Math.max(1.8, p.slowDuration),
      maxTimer: Math.max(1.8, p.slowDuration),
      tickTimer: 0.12,
      triggered: false,
      color: '#818CF8',
      stunDuration: 0,
    });
    this.emitFx({ kind: 'ring', x: p.x, y: p.y, radius: p.splashRadius, color: '#818CF8' });
  }

  private detonateProjectile(p: ProjectileEntity, owner: HeroEntity | null): void {
    const ownerStats = owner ? computeHeroStats(owner.heroId, owner.upgrades, owner.bonusMaxHp) : null;
    const structureBonus = p.kind === 'dynamite' && ownerStats?.capstones['vx_q2'] ? 1.25 : 1.0;
    this.dealAreaDamage(
      owner,
      p.x,
      p.y,
      p.splashRadius,
      p.damage,
      p.slowDuration,
      p.stunDuration,
      p.color,
      true,
      structureBonus
    );

    // Seraph-9 sr_q2 capstone: Beacon of Grace spear detonation heals & shields nearby allies
    if (p.kind === 'spear' && owner && ownerStats?.capstones['sr_q2']) {
      for (const ally of this.heroes) {
        if (!ally.alive || ally.inDropPod || ally.team !== owner.team) continue;
        if (Math.hypot(ally.x - p.x, ally.y - p.y) <= p.splashRadius + 40) {
          this.healHero(ally, 65);
          ally.shield = Math.max(ally.shield, 45);
        }
      }
      this.emitFx({ kind: 'ring', x: p.x, y: p.y, radius: p.splashRadius + 24, color: '#34D399' });
    }

    // Seraph-9 sr_q3 capstone: Pinning Consecration launches victims skyward
    if (p.kind === 'spear' && owner && ownerStats?.capstones['sr_q3']) {
      for (const other of this.heroes) {
        if (!other.alive || other.inDropPod || other.team === owner.team) continue;
        if (Math.hypot(other.x - p.x, other.y - p.y) <= p.splashRadius + 16) {
          other.vy = -340;
          other.grounded = false;
        }
      }
    }

    // Brother Bastion bs_p3 capstone: Consecrated Balm mortar splashes heal nearby allies
    if (p.kind === 'mortar' && owner && ownerStats?.capstones['bs_p3']) {
      for (const ally of this.heroes) {
        if (!ally.alive || ally.inDropPod || ally.team !== owner.team) continue;
        if (Math.hypot(ally.x - p.x, ally.y - p.y) <= p.splashRadius + 24) {
          this.healHero(ally, 16);
        }
      }
    }

    this.emitFx({
      kind: 'explosion',
      x: p.x,
      y: p.y,
      radius: p.splashRadius,
      color: p.color,
      heavy: p.splashRadius >= 75,
      ownerId: p.ownerId,
    });
  }

  private dealAreaDamage(
    attacker: HeroEntity | null,
    x: number,
    y: number,
    radius: number,
    damage: number,
    slowDuration: number,
    stunDuration: number,
    color: string,
    hitStructures: boolean,
    structureMult = 1
  ): number {
    const team = attacker?.team;
    let totalDealt = 0;
    for (const h of this.heroes) {
      if (!h.alive || h.inDropPod || (team && h.team === team)) continue;
      if (Math.hypot(h.x - x, h.y - y) <= radius + 14) {
        this.applyDamageToHero(h, damage, attacker);
        totalDealt += damage;
        if (slowDuration > 0) h.slowTimer = Math.max(h.slowTimer, slowDuration);
        if (stunDuration > 0) h.stunTimer = Math.max(h.stunTimer, stunDuration);
        this.emitFx({ kind: 'hit', x: h.x, y: h.y, color, ownerId: attacker?.id ?? '' });
      }
    }
    for (const d of this.droids) {
      if (d.hp <= 0 || (team && d.team === team)) continue;
      if (Math.hypot(d.x - x, d.y - y) <= radius + 12) {
        this.damageDroid(d, damage, attacker);
        totalDealt += damage * 0.5;
        if (slowDuration > 0) d.slowTimer = Math.max(d.slowTimer, slowDuration);
      }
    }
    if (attacker) {
      for (const c of this.creeps) {
        if (!c.alive) continue;
        if (Math.hypot(c.x - x, c.y - y) <= radius + 14) {
          this.damageCreep(c, damage, attacker);
        }
      }
    }
    if (hitStructures) {
      for (const t of this.turrets) {
        if (!t.alive || (team && t.team === team)) continue;
        if (Math.hypot(t.x - x, t.y - 48 - y) <= radius + 34) {
          this.damageTurret(t, damage * 0.72 * structureMult, attacker);
        }
      }
      for (const c of this.cores) {
        if (team && c.team === team) continue;
        if (Math.hypot(c.x - x, c.y - 76 - y) <= radius + 54) {
          this.damageCore(c, damage * 0.72 * structureMult, attacker);
        }
      }
    }
    return totalDealt;
  }

  private applyDamageToHero(target: HeroEntity, rawDamage: number, attacker: HeroEntity | null): void {
    if (!target.alive || target.inDropPod || target.invulnTimer > 0) return;
    const stats = computeHeroStats(target.heroId, target.upgrades, target.bonusMaxHp);
    let armor = stats.flatArmor;
    if (target.meltdownTimer > 0 || target.spinTimer > 0 || target.rotTimer > 0) {
      armor += stats.skill2Armor;
    }
    // Korak kr_e2 capstone: +10% DR per orbiting skull (up to 30%)
    if (stats.capstones['kr_e2']) {
      const skullCount = this.summons.filter((s) => s.ownerId === target.id && s.kind === 'drone').length;
      armor += Math.min(0.3, skullCount * 0.1);
    }
    // Caldris cd_u1 capstone: +12% flat Necro Armor whenever an allied Bone-Borg is alive
    if (stats.capstones['cd_u1']) {
      const hasBorg = this.droids.some((d) => d.team === target.team && d.hp > 0 && d.id.startsWith('borg_'));
      if (hasBorg) armor += 0.12;
    }
    armor = Math.min(0.78, armor);
    let dmg = Math.max(1, rawDamage * (1 - armor));

    if (target.shield > 0) {
      const absorbed = Math.min(target.shield, dmg);
      target.shield -= absorbed;
      dmg -= absorbed;
    }

    target.hp -= dmg;
    target.hitFlashTimer = 0.14;
    target.recallTimer = 0;
    if (attacker) {
      target.lastDamagedById = attacker.id;
      target.lastDamagedTimer = 6;
    }

    if (target.hp <= 0) {
      target.alive = false;
      target.hp = 0;
      target.deaths += 1;
      target.hookedById = null;
      target.rotTimer = 0;
      target.cloakTimer = 0;
      target.meltdownTimer = 0;
      target.spinTimer = 0;
      target.respawnTimer = Math.min(18, 6 + Math.floor(this.matchTime / 90));

      const killer =
        attacker ??
        (target.lastDamagedById ? this.heroes.find((h) => h.id === target.lastDamagedById) ?? null : null);

      if (killer && killer.team !== target.team) {
        killer.kills += 1;
        this.grantSolar(killer, 75, target.x, target.y - 12);
        if (killer.team === 'blue') this.blueKills += 1;
        else this.redKills += 1;

        // Per-hero on-kill Capstones
        const killerStats = computeHeroStats(killer.heroId, killer.upgrades, killer.bonusMaxHp);
        if (killerStats.capstones['mh_u1']) {
          killer.bonusMaxHp += 25;
          killer.maxHp += 25;
          killer.hp += 25;
          this.emitFx({ kind: 'text', x: killer.x, y: killer.y - 48, text: '+25 PERM HP', color: '#34D399', scale: 1.05 });
        }
        if (killerStats.capstones['sr_u3']) {
          this.healHero(killer, killer.maxHp * 0.25);
          killer.skill1Cd = Math.max(0, killer.skill1Cd - 3.0);
          killer.skill2Cd = Math.max(0, killer.skill2Cd - 3.0);
        }
        if (killerStats.capstones['vg_q3']) {
          killer.skill1Cd = 0;
        }
        if (killerStats.capstones['vg_u2']) {
          this.healHero(killer, 90);
        }
        if (killerStats.capstones['vx_u2']) {
          killer.shield = Math.max(killer.shield, 80);
          this.grantSolar(killer, 30, killer.x, killer.y - 26);
        }
        if (killerStats.capstones['xy_e3']) {
          killer.skill2Cd = 0;
        }
        if (killerStats.capstones['xy_u3']) {
          this.grantSolar(killer, 45, killer.x, killer.y - 26);
        }

        for (const ally of this.heroes) {
          if (ally.team === killer.team && ally.id !== killer.id && ally.alive && Math.hypot(ally.x - target.x, ally.y - target.y) < 420) {
            ally.assists += 1;
            this.grantSolar(ally, 35, ally.x, ally.y - 18);
          }
        }

        if (!this.firstBloodAwarded) {
          this.firstBloodAwarded = true;
          this.pushBanner(
            'FIRST BLOOD!',
            `${killer.name} struck down ${target.name} (+75 Relic)`,
            killer.team,
            3.0
          );
        }
      } else {
        if (target.team === 'blue') this.redKills += 1;
        else this.blueKills += 1;
      }

      this.emitFx({
        kind: 'kill',
        x: target.x,
        y: target.y,
        team: target.team,
        killerId: killer?.id ?? null,
        victimId: target.id,
      });
    }
  }

  private damageDroid(d: DroidEntity, dmg: number, attacker: HeroEntity | null): void {
    d.hp -= dmg;
    d.hitFlashTimer = 0.1;
    if (d.hp <= 0 && attacker) {
      attacker.droidKills += 1;
      this.grantSolar(attacker, 16 + d.tier * 2, d.x, d.y - 10);
      const aStats = computeHeroStats(attacker.heroId, attacker.upgrades, attacker.bonusMaxHp);
      if (aStats.capstones['mh_u3']) {
        this.healHero(attacker, 18);
      }
      if (aStats.capstones['vg_u3']) {
        attacker.skill1Cd = Math.max(0, attacker.skill1Cd - 0.35);
        attacker.skill2Cd = Math.max(0, attacker.skill2Cd - 0.35);
      }
      if (aStats.capstones['cd_u3']) {
        attacker.skill1Cd = Math.max(0, attacker.skill1Cd - 0.45);
      }
    }
  }

  private damageCreep(c: NeutralCreepEntity, dmg: number, attacker: HeroEntity): void {
    c.hp -= dmg;
    c.hitFlashTimer = 0.12;
    if (c.hp <= 0 && c.alive) {
      c.alive = false;
      c.respawnTimer = 26;
      this.healHero(attacker, 55);
      this.grantSolar(attacker, 28, c.x, c.y - 10);
      this.emitFx({ kind: 'text', x: c.x, y: c.y - 26, text: '+55 HP · +28 RELIC', color: '#34D399', scale: 1 });
    }
  }

  private damageTurret(t: TurretEntity, dmg: number, attacker: HeroEntity | null): void {
    if (!t.alive) return;
    if (t.shielded) {
      this.emitFx({ kind: 'text', x: t.x, y: t.y - t.h - 14, text: 'SHIELDED', color: '#38BDF8', scale: 0.9 });
      return;
    }
    const mult = attacker ? computeHeroStats(attacker.heroId, attacker.upgrades, attacker.bonusMaxHp).towerDamageMult : 1;
    t.hp -= dmg * mult;
    t.hitFlashTimer = 0.12;
    if (t.hp <= 0) {
      t.alive = false;
      t.hp = 0;
      const winningTeam: Team = t.team === 'blue' ? 'red' : 'blue';
      for (const h of this.heroes) {
        if (h.team === winningTeam) {
          this.grantSolar(h, t.tier === 'inner' ? 110 : 80, h.x, h.y - 24);
        }
      }
      this.emitFx({ kind: 'explosion', x: t.x, y: t.y - 50, radius: 135, color: '#F59E0B', heavy: true, ownerId: attacker?.id ?? '' });
      this.pushBanner(
        `${t.lane.toUpperCase()} ${t.tier.toUpperCase()} TOWER SHATTERED!`,
        `${winningTeam === 'blue' ? 'Sanctum' : 'Invasion'} claims +${t.tier === 'inner' ? 110 : 80} Relic team bounty!`,
        winningTeam,
        3.2
      );
    }
  }

  private damageCore(c: CoreDrillEntity, dmg: number, attacker: HeroEntity | null): void {
    if (c.shielded) {
      this.emitFx({ kind: 'text', x: c.x, y: c.y - c.h - 16, text: 'DESTROY AN INNER TOWER FIRST', color: '#38BDF8', scale: 0.95 });
      return;
    }
    const mult = attacker ? computeHeroStats(attacker.heroId, attacker.upgrades, attacker.bonusMaxHp).towerDamageMult : 1;
    c.hp = Math.max(0, c.hp - dmg * mult);
    c.hitFlashTimer = 0.12;
    if (c.hp <= 0 && this.phase === 'PLAYING') {
      const winner: Team = c.team === 'blue' ? 'red' : 'blue';
      this.phase = winner === 'blue' ? 'VICTORY' : 'DEFEAT';
      this.emitFx({ kind: 'explosion', x: c.x, y: c.y - 70, radius: 220, color: '#F59E0B', heavy: true, ownerId: attacker?.id ?? '' });
      this.emitFx({ kind: 'victory', winner });
      this.pushBanner(
        winner === 'blue' ? 'SANCTUM TRIUMPHS!' : 'CITADEL FALLEN!',
        'The Ancient Core has shattered!',
        winner === 'blue' ? 'gold' : 'red',
        6.0
      );
    }
  }

  private healHero(h: HeroEntity, amount: number): number {
    if (!h.alive || amount <= 0) return 0;
    const before = h.hp;
    h.hp = Math.min(h.maxHp, h.hp + amount);
    const actual = h.hp - before;
    if (actual >= 8) {
      this.emitFx({ kind: 'text', x: h.x, y: h.y - 34, text: `+${Math.round(actual)}`, color: '#34D399', scale: 0.92 });
    }
    return actual;
  }

  private grantSolar(h: HeroEntity, amount: number, x: number, y: number): void {
    h.solar += amount;
    h.totalSolarEarned += amount;
    this.emitFx({ kind: 'solar', x, y, amount, heroEntityId: h.id });
  }

  public isInBase(x: number, y: number, team: Team): boolean {
    const b = BASE_ZONES[team];
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h + 40;
  }

  private computeBotControls(
    h: HeroEntity,
    stats: ReturnType<typeof computeHeroStats>,
    dt: number
  ): {
    moveDir: -1 | 0 | 1;
    wantJump: boolean;
    holdingJump: boolean;
    wantDrop: boolean;
    wantPrimary: boolean;
    wantSkill1: boolean;
    wantSkill2: boolean;
    aimWorldX: number;
    aimWorldY: number;
  } {
    h.aiDecisionTimer -= dt;
    h.aiJumpCooldown = Math.max(0, h.aiJumpCooldown - dt);

    // Bots buy upgrades smartly when they have enough Relic Essence
    if (h.aiDecisionTimer <= 0) {
      h.aiDecisionTimer = this.difficulty === 'veteran' ? 0.32 : this.difficulty === 'standard' ? 0.5 : 0.78;
      const def = HERO_MAP[h.heroId];
      const affordable = def.upgrades.filter(
        (u) => (h.upgrades[u.id] ?? 0) < u.maxRank && h.solar >= u.cost
      );
      if (affordable.length > 0 && Math.random() < 0.72) {
        const pick = affordable[Math.floor(Math.random() * affordable.length)];
        this.buyUpgradeForHero(h.id, pick.id);
      }

      if (h.hp < h.maxHp * 0.34) {
        h.aiState = 'retreat';
      } else if (h.hp > h.maxHp * 0.76 && h.aiState === 'retreat') {
        h.aiState = 'lane';
      }
    }

    const base = BASE_ZONES[h.team];
    const dir: 1 | -1 = h.team === 'blue' ? 1 : -1;
    const laneY = h.aiLane === 'top' ? 540 : 925;

    let moveDir: -1 | 0 | 1 = 0;
    let wantJump = false;
    let holdingJump = false;
    let wantDrop = false;
    let wantPrimary = false;
    let wantSkill1 = false;
    let wantSkill2 = false;
    let aimWorldX = h.x + dir * 320;
    let aimWorldY = h.y;

    // Find closest combat target
    let targetX = -1;
    let targetY = -1;
    let targetIsHero = false;
    let bestDist = 560;

    for (const other of this.heroes) {
      if (!other.alive || other.inDropPod || other.team === h.team || other.cloakTimer > 0) continue;
      const d = Math.hypot(other.x - h.x, other.y - h.y);
      if (d < bestDist) {
        bestDist = d;
        targetX = other.x;
        targetY = other.y;
        targetIsHero = true;
      }
    }

    if (targetX < 0) {
      for (const dr of this.droids) {
        if (dr.team === h.team || dr.hp <= 0) continue;
        const d = Math.hypot(dr.x - h.x, dr.y - h.y);
        if (d < bestDist) {
          bestDist = d;
          targetX = dr.x;
          targetY = dr.y;
        }
      }
    }

    if (targetX < 0) {
      for (const t of this.turrets) {
        if (!t.alive || t.team === h.team || t.shielded) continue;
        const d = Math.hypot(t.x - h.x, t.y - 48 - h.y);
        if (d < 460) {
          bestDist = d;
          targetX = t.x;
          targetY = t.y - 48;
        }
      }
    }

    if (targetX < 0) {
      for (const c of this.cores) {
        if (c.team === h.team || c.shielded) continue;
        const d = Math.hypot(c.x - h.x, c.y - 72 - h.y);
        if (d < 480) {
          bestDist = d;
          targetX = c.x;
          targetY = c.y - 72;
        }
      }
    }

    if (h.aiState === 'retreat') {
      const dx = base.spawnX - h.x;
      moveDir = Math.abs(dx) > 40 ? (Math.sign(dx) as -1 | 1) : 0;
      if (h.y > 970 && h.aiJumpCooldown <= 0) {
        wantJump = true;
        h.aiJumpCooldown = 0.8;
      }
    } else if (targetX >= 0) {
      aimWorldX = targetX;
      aimWorldY = targetY;
      h.aimAngle = Math.atan2(targetY - h.y, targetX - h.x);
      h.facing = Math.cos(h.aimAngle) >= 0 ? 1 : -1;

      const idealDist = h.heroId === 'marrow' || h.heroId === 'bastion' || h.heroId === 'xylar' ? 115 : 270;
      if (bestDist > idealDist + 50) {
        moveDir = targetX > h.x ? 1 : -1;
      } else if (bestDist < idealDist - 60 && h.heroId !== 'marrow' && h.heroId !== 'bastion') {
        moveDir = targetX > h.x ? -1 : 1;
      }

      if (bestDist <= stats.primaryRange + 45) {
        wantPrimary = true;
      }

      // Smart Skill 1 triggers per hero
      if (h.skill1Cd <= 0) {
        if (h.heroId === 'marrow' && targetIsHero && bestDist > 180 && bestDist < stats.skill1Range * 0.88) {
          wantSkill1 = true;
        } else if (h.heroId === 'caldris' && bestDist < 620) {
          wantSkill1 = true;
        } else if (h.heroId === 'bastion' && bestDist < 105) {
          wantSkill1 = true;
        } else if (h.heroId === 'korak' && bestDist < 320) {
          wantSkill1 = true;
        } else if (bestDist < 420 && h.heroId !== 'marrow' && h.heroId !== 'bastion') {
          wantSkill1 = true;
        }
      }

      // Smart Skill 2 triggers
      if (h.skill2Cd <= 0) {
        if (h.heroId === 'marrow' && bestDist < 145) wantSkill2 = true;
        else if (h.heroId === 'vorg' && bestDist < 120) wantSkill2 = true;
        else if (h.heroId === 'bastion' && bestDist < 160) wantSkill2 = true;
        else if (h.heroId === 'seraph' && (bestDist < 165 || h.hp < h.maxHp * 0.6)) wantSkill2 = true;
        else if (h.heroId === 'xylar' && targetIsHero && bestDist < 290) wantSkill2 = true;
        else if (h.heroId === 'vexia' || h.heroId === 'korak' || h.heroId === 'caldris') wantSkill2 = true;
      }

      if (targetY < h.y - 90 && h.aiJumpCooldown <= 0) {
        wantJump = true;
        holdingJump = true;
        h.aiJumpCooldown = 0.9;
      } else if (targetY > h.y + 120 && h.grounded) {
        wantDrop = true;
      }
    } else {
      // March down assigned lane toward enemy core
      const enemyCoreX = h.team === 'blue' ? CORE_SPOTS.red.x : CORE_SPOTS.blue.x;
      moveDir = enemyCoreX > h.x ? 1 : -1;
      h.aimAngle = moveDir > 0 ? 0 : Math.PI;
      h.facing = moveDir;

      if (h.y > laneY + 80 && h.aiJumpCooldown <= 0) {
        wantJump = true;
        holdingJump = true;
        h.aiJumpCooldown = 1.1;
      } else if (h.y < laneY - 120 && h.grounded) {
        wantDrop = true;
      }
    }

    // Never stand inside enemy turret range without allied droids!
    for (const t of this.turrets) {
      if (!t.alive || t.team === h.team) continue;
      if (Math.hypot(h.x - t.x, h.y - (t.y - 40)) < t.range - 10) {
        const allyDroidTank = this.droids.some(
          (d) => d.team === h.team && Math.hypot(d.x - t.x, d.y - (t.y - 40)) < t.range
        );
        if (!allyDroidTank) {
          moveDir = h.team === 'blue' ? -1 : 1;
        }
      }
    }

    return {
      moveDir,
      wantJump,
      holdingJump,
      wantDrop,
      wantPrimary,
      wantSkill1,
      wantSkill2,
      aimWorldX,
      aimWorldY,
    };
  }
}
