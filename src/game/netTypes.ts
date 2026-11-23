import type {
  AnnouncerBanner,
  Difficulty,
  GamePhase,
  HeroId,
  KillFeedEntry,
  ProjectileEntity,
  Team,
} from './types.ts';

export type MatchMode = 'solo' | 'online';

export interface PlayerInputPacket {
  seq: number;
  moveDir: -1 | 0 | 1;
  wantJump: boolean;
  holdingJump: boolean;
  wantDrop: boolean;
  wantPrimary: boolean;
  wantSkill1: boolean;
  wantSkill2: boolean;
  wantRecall: boolean;
  aimAngle: number;
  aimWorldX: number;
  aimWorldY: number;
}

export interface RoomSummary {
  roomId: string;
  humans: number;
  maxHumans: number;
  matchTime: number;
  difficulty: Difficulty;
  phase: GamePhase;
  takenHeroes: HeroId[];
}

export type SimFxEvent =
  | { kind: 'shoot'; heroId: HeroId; x: number; y: number; ownerId: string }
  | {
      kind: 'ability';
      tag:
        | 'dynamite'
        | 'bull'
        | 'dash'
        | 'spin'
        | 'bite'
        | 'meltdown'
        | 'totem'
        | 'drone'
        | 'hook'
        | 'hook_hit'
        | 'rot'
        | 'spear'
        | 'aegis'
        | 'vortex'
        | 'cloak'
        | 'orbital'
        | 'undead';
      x: number;
      y: number;
      ownerId: string;
    }
  | { kind: 'explosion'; x: number; y: number; radius: number; color: string; heavy: boolean; ownerId: string }
  | { kind: 'hit'; x: number; y: number; color: string; ownerId: string }
  | { kind: 'solar'; x: number; y: number; amount: number; heroEntityId: string }
  | { kind: 'upgrade'; x: number; y: number; heroEntityId: string }
  | { kind: 'jump'; x: number; y: number; doubleJump: boolean; color: string; heroEntityId: string }
  | { kind: 'jumppad'; x: number; y: number; color: string; heroEntityId: string }
  | { kind: 'dropSlam'; x: number; y: number; heroEntityId: string }
  | { kind: 'kill'; x: number; y: number; team: Team; killerId: string | null; victimId: string }
  | { kind: 'ring'; x: number; y: number; radius: number; color: string }
  | { kind: 'text'; x: number; y: number; text: string; color: string; scale: number; targetId?: string }
  | { kind: 'victory'; winner: Team };

export interface NetHeroSnapshot {
  id: string;
  heroId: HeroId;
  name: string;
  team: Team;
  isHuman: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  aimAngle: number;
  hp: number;
  maxHp: number;
  bonusMaxHp: number;
  shield: number;
  solar: number;
  totalSolarEarned: number;
  totalSolarSpent: number;
  upgrades: Record<string, number>;
  grounded: boolean;
  isHovering: boolean;
  primaryCd: number;
  skill1Cd: number;
  skill2Cd: number;
  alive: boolean;
  respawnTimer: number;
  inDropPod: boolean;
  dropPodX: number;
  dropPodY: number;
  dropPodSolars: Array<{ x: number; y: number; collected: boolean; value: number }>;
  recallTimer: number;
  stunTimer: number;
  slowTimer: number;
  hitFlashTimer: number;
  dashTimer: number;
  spinTimer: number;
  rotTimer: number;
  cloakTimer: number;
  cloakCritReady: boolean;
  meltdownTimer: number;
  meltdownMaxTimer: number;
  hookedById: string | null;
  recoilTimer: number;
  walkCycle: number;
  kills: number;
  deaths: number;
  assists: number;
  droidKills: number;
  lastAckSeq: number;
}

export interface NetDroidSnapshot {
  id: string;
  team: Team;
  lane: 'top' | 'bot';
  tier: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  facing: 1 | -1;
  hitFlashTimer: number;
  walkCycle: number;
}

export interface NetTurretSnapshot {
  id: string;
  team: Team;
  lane: 'top' | 'bot';
  tier: 'outer' | 'inner';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  shielded: boolean;
  aimAngle: number;
  hitFlashTimer: number;
}

export interface NetCoreSnapshot {
  id: string;
  team: Team;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  shielded: boolean;
  hitFlashTimer: number;
}

export interface NetCreepSnapshot {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  hitFlashTimer: number;
  bobPhase: number;
}

export interface NetSolarSnapshot {
  id: string;
  x: number;
  y: number;
  value: number;
  active: boolean;
  bobPhase: number;
}

export interface NetProjectileSnapshot {
  id: string;
  ownerId: string;
  team: Team;
  kind: ProjectileEntity['kind'];
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

export interface NetSummonSnapshot {
  id: string;
  ownerId: string;
  team: Team;
  kind: 'bull' | 'totem' | 'drone';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  life: number;
  maxLife: number;
  radius: number;
  facing: 1 | -1;
  hitFlashTimer: number;
}

export interface NetHookSnapshot {
  id: string;
  ownerId: string;
  team: Team;
  x: number;
  y: number;
  startX: number;
  startY: number;
  state: 'extending' | 'retracting';
  latchedTargetId: string | null;
}

export interface NetHazardSnapshot {
  id: string;
  ownerId: string;
  team: Team;
  kind: 'orbital_smite' | 'singularity';
  x: number;
  y: number;
  radius: number;
  timer: number;
  maxTimer: number;
  triggered: boolean;
  color: string;
}

export interface WorldSnapshot {
  tick: number;
  serverTime: number;
  phase: GamePhase;
  matchTime: number;
  waveTier: number;
  waveTierName: string;
  blueKills: number;
  redKills: number;
  humanCount: number;
  banner: AnnouncerBanner | null;
  killFeed: KillFeedEntry[];
  heroes: NetHeroSnapshot[];
  droids: NetDroidSnapshot[];
  turrets: NetTurretSnapshot[];
  cores: NetCoreSnapshot[];
  creeps: NetCreepSnapshot[];
  solarCubes: NetSolarSnapshot[];
  projectiles: NetProjectileSnapshot[];
  summons: NetSummonSnapshot[];
  hooks: NetHookSnapshot[];
  hazards: NetHazardSnapshot[];
  fx: SimFxEvent[];
}

export type ClientToServerMessage =
  | {
      type: 'join';
      roomId: string;
      heroId: HeroId;
      playerName: string;
      difficulty: Difficulty;
      preferredTeam?: Team;
    }
  | {
      type: 'input';
      input: PlayerInputPacket;
    }
  | {
      type: 'buy_upgrade';
      upgradeId: string;
    }
  | {
      type: 'restart';
      heroId: HeroId;
    }
  | {
      type: 'switch_hero';
      heroId: HeroId;
    }
  | {
      type: 'requeue_lobby';
    }
  | {
      type: 'ping';
      clientTime: number;
    };

export type ServerToClientMessage =
  | {
      type: 'joined';
      roomId: string;
      playerEntityId: string;
      assignedHeroId: HeroId;
      team: Team;
      snapshot: WorldSnapshot;
    }
  | {
      type: 'state';
      snapshot: WorldSnapshot;
    }
  | {
      type: 'return_to_lobby';
      roomId: string;
      reason: string;
    }
  | {
      type: 'pong';
      clientTime: number;
      serverTime: number;
    }
  | {
      type: 'error';
      message: string;
    };
