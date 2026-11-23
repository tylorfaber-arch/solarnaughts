export type HeroId =
  | 'seraph'
  | 'korak'
  | 'vorg'
  | 'bastion'
  | 'marrow'
  | 'vexia'
  | 'xylar'
  | 'caldris';

export type Team = 'blue' | 'red';
export type Difficulty = 'casual' | 'standard' | 'veteran';
export type GamePhase = 'TITLE' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'DEFEAT';
export type SkillRowKey = 'primary' | 'skill1' | 'skill2' | 'utility';
export type TalentAspect = 'sacred' | 'primordial' | 'cyber';

export interface UpgradeNode {
  id: string;
  row: SkillRowKey;
  aspect: TalentAspect;
  archetype: string;
  name: string;
  cost: number;
  maxRank: number;
  summary: string;
  perRankText: string;
  capstoneText: string;
  icon: 'damage' | 'speed' | 'burst' | 'shield' | 'heal' | 'solar' | 'cooldown' | 'range' | 'special';
}

export interface AbilityMeta {
  name: string;
  keyLabel: string;
  description: string;
  cooldown: number;
  icon:
    | 'gun'
    | 'dynamite'
    | 'bull'
    | 'burst'
    | 'dash'
    | 'spin'
    | 'mortar'
    | 'bite'
    | 'meltdown'
    | 'beam'
    | 'totem'
    | 'drone'
    | 'hook'
    | 'rot'
    | 'spear'
    | 'aegis'
    | 'vortex'
    | 'cloak'
    | 'orbital'
    | 'undead';
}

export interface HeroDefinition {
  id: HeroId;
  name: string;
  codename: string;
  faction: 'Sacred Order' | 'Primordial Pact' | 'Xeno-Tech Legion';
  purity: 'purist' | 'hybrid';
  disciplineLabel: string;
  craftSummary: string;
  role: string;
  mobilityLabel: string;
  portrait: string;
  accentColor: string;
  secondaryColor: string;
  baseHp: number;
  baseSpeed: number;
  jumpForce: number;
  maxJumps: number;
  canHover: boolean;
  hoverGravityScale: number;
  width: number;
  height: number;
  primary: AbilityMeta;
  skill1: AbilityMeta;
  skill2: AbilityMeta;
  upgrades: UpgradeNode[];
}

export interface ComputedHeroStats {
  maxHp: number;
  moveSpeed: number;
  jumpForce: number;
  primaryDamage: number;
  primaryCooldown: number;
  primaryRange: number;
  primaryProjectileSpeed: number;
  primarySplash: number;
  primaryPierce: boolean;
  primaryBonusRocket: boolean;
  primaryHeal: number;
  primaryHealSolar: number;
  skill1Damage: number;
  skill1Cooldown: number;
  skill1Radius: number;
  skill1Range: number;
  skill1ExtraCount: number;
  skill1Stun: number;
  skill1Slow: number;
  skill1Heal: number;
  skill1ShieldAfter: number;
  skill1Duration: number;
  skill1DashSpeed: number;
  skill1PermanentHpGain: number;
  skill2Damage: number;
  skill2Cooldown: number;
  skill2Radius: number;
  skill2Duration: number;
  skill2Armor: number;
  skill2SelfDamageRatio: number;
  skill2SpeedMult: number;
  skill2ExplodeOnEnd: boolean;
  skill2SummonHp: number;
  skill2Knockback: number;
  skill2HealAlly: number;
  passiveSolarPerSec: number;
  hpRegenPerSec: number;
  lifestealRatio: number;
  extraJumps: number;
  infiniteHover: boolean;
  flatArmor: number;
  towerDamageMult: number;
  capstones: Record<string, boolean>;
}

export interface Platform {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  oneWay: boolean;
  style: 'stone' | 'sanctuary_glass' | 'battlement';
}

export interface JumpPad {
  id: string;
  x: number;
  y: number;
  w: number;
  vx: number;
  vy: number;
  color: string;
}

export interface BaseZone {
  team: Team;
  x: number;
  y: number;
  w: number;
  h: number;
  spawnX: number;
  spawnY: number;
}

export interface DropPodSolar {
  x: number;
  y: number;
  collected: boolean;
  value: number;
}

export interface HookEntity {
  id: string;
  ownerId: string;
  team: Team;
  x: number;
  y: number;
  vx: number;
  vy: number;
  startX: number;
  startY: number;
  maxRange: number;
  damage: number;
  stunDuration: number;
  state: 'extending' | 'retracting';
  latchedTargetId: string | null;
  latchedTargetKind: 'hero' | 'droid' | null;
}

export interface HazardZoneEntity {
  id: string;
  ownerId: string;
  team: Team;
  kind: 'orbital_smite' | 'singularity';
  x: number;
  y: number;
  radius: number;
  damage: number;
  timer: number;
  maxTimer: number;
  tickTimer: number;
  triggered: boolean;
  color: string;
  stunDuration: number;
}

export interface HeroEntity {
  id: string;
  heroId: HeroId;
  name: string;
  team: Team;
  isPlayer: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
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
  coyoteTimer: number;
  jumpBufferTimer: number;
  jumpsRemaining: number;
  dropThroughTimer: number;
  hoverFuel: number;
  isHovering: boolean;
  primaryCd: number;
  skill1Cd: number;
  skill2Cd: number;
  primaryShotCounter: number;
  alive: boolean;
  respawnTimer: number;
  inDropPod: boolean;
  dropPodY: number;
  dropPodX: number;
  dropPodSolars: DropPodSolar[];
  recallTimer: number;
  stunTimer: number;
  slowTimer: number;
  hitFlashTimer: number;
  invulnTimer: number;
  dashTimer: number;
  dashVx: number;
  dashVy: number;
  dashHitIds: Set<string>;
  spinTimer: number;
  spinTickTimer: number;
  rotTimer: number;
  rotTickTimer: number;
  cloakTimer: number;
  cloakCritReady: boolean;
  meltdownTimer: number;
  meltdownMaxTimer: number;
  hookedById: string | null;
  squashX: number;
  squashY: number;
  walkCycle: number;
  recoilTimer: number;
  kills: number;
  deaths: number;
  assists: number;
  droidKills: number;
  lastDamagedById: string | null;
  lastDamagedTimer: number;
  aiLane: 'top' | 'bot';
  aiState: 'lane' | 'push' | 'retreat' | 'collect' | 'defend';
  aiDecisionTimer: number;
  aiTargetX: number;
  aiTargetY: number;
  aiJumpCooldown: number;
}

export interface DroidEntity {
  id: string;
  team: Team;
  lane: 'top' | 'bot';
  tier: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  damage: number;
  attackCd: number;
  hitFlashTimer: number;
  walkCycle: number;
  grounded: boolean;
  facing: 1 | -1;
  slowTimer: number;
  stunTimer: number;
}

export interface TurretEntity {
  id: string;
  team: Team;
  lane: 'top' | 'bot';
  tier: 'outer' | 'inner';
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  shielded: boolean;
  attackCd: number;
  aimAngle: number;
  hitFlashTimer: number;
  range: number;
}

export interface CoreDrillEntity {
  id: string;
  team: Team;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  shielded: boolean;
  hitFlashTimer: number;
  pulsePhase: number;
}

export interface NeutralCreepEntity {
  id: string;
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  respawnTimer: number;
  hitFlashTimer: number;
  bobPhase: number;
}

export interface SolarCubeEntity {
  id: string;
  x: number;
  y: number;
  value: number;
  active: boolean;
  respawnTimer: number;
  bobPhase: number;
}

export interface ProjectileEntity {
  id: string;
  ownerId: string;
  team: Team;
  kind:
    | 'revolver'
    | 'dynamite'
    | 'sonic'
    | 'mortar'
    | 'missile'
    | 'biobeam'
    | 'drone_bolt'
    | 'drone_kamikaze'
    | 'droid_shot'
    | 'turret_shot'
    | 'spear'
    | 'cleaver'
    | 'dagger'
    | 'soul_orb'
    | 'singularity_orb';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  healAmount: number;
  healSolarBonus: number;
  splashRadius: number;
  gravity: number;
  bouncesLeft: number;
  pierce: boolean;
  hitIds: Set<string>;
  slowDuration: number;
  stunDuration: number;
  life: number;
  maxLife: number;
  color: string;
  lifestealRatio: number;
}

export interface SummonEntity {
  id: string;
  ownerId: string;
  team: Team;
  kind: 'bull' | 'totem' | 'drone';
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  life: number;
  maxLife: number;
  damage: number;
  radius: number;
  knockback: number;
  tickTimer: number;
  orbitAngle: number;
  orbitIndex: number;
  explodeOnEnd: boolean;
  facing: 1 | -1;
  hitFlashTimer: number;
  hitIds: Set<string>;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  gravity: number;
  shape: 'circle' | 'spark' | 'ring' | 'square';
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export interface AnnouncerBanner {
  id: number;
  title: string;
  subtitle: string;
  tone: 'gold' | 'blue' | 'red' | 'emerald';
  timer: number;
}

export interface MinimapBlip {
  x: number;
  y: number;
  team: Team | 'neutral';
  kind: 'player' | 'hero' | 'droid' | 'turret' | 'core';
  alive: boolean;
}

export interface ScoreboardRow {
  id: string;
  heroId: HeroId;
  name: string;
  team: Team;
  isPlayer: boolean;
  kills: number;
  deaths: number;
  assists: number;
  droidKills: number;
  totalSolarEarned: number;
  upgradeCount: number;
  alive: boolean;
  respawnTimer: number;
}

export interface HudSnapshot {
  phase: GamePhase;
  matchTime: number;
  waveTier: number;
  waveTierName: string;
  blueKills: number;
  redKills: number;
  blueTurretsAlive: number;
  redTurretsAlive: number;
  blueCoreHp: number;
  blueCoreMaxHp: number;
  blueCoreShielded: boolean;
  redCoreHp: number;
  redCoreMaxHp: number;
  redCoreShielded: boolean;
  player: {
    id: string;
    heroId: HeroId;
    team: Team;
    hp: number;
    maxHp: number;
    shield: number;
    solar: number;
    alive: boolean;
    respawnTimer: number;
    inDropPod: boolean;
    recallTimer: number;
    primaryCd: number;
    primaryMaxCd: number;
    skill1Cd: number;
    skill1MaxCd: number;
    skill2Cd: number;
    skill2MaxCd: number;
    upgrades: Record<string, number>;
    affordableUpgrades: number;
    stats: ComputedHeroStats;
    kills: number;
    deaths: number;
    assists: number;
    droidKills: number;
    totalSolarSpent: number;
    inBase: boolean;
    droneCount: number;
  };
  network: {
    mode: 'solo' | 'online';
    roomId: string | null;
    connected: boolean;
    pingMs: number;
    humanCount: number;
  };
  banner: AnnouncerBanner | null;
  minimap: MinimapBlip[];
  scoreboard: ScoreboardRow[];
}
