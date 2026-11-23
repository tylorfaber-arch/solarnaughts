import type { BaseZone, JumpPad, Platform } from './types.ts';

// Extended 2-tier tower Cathedral & Primordial Crypt Arena (15-20 min pacing)
export const WORLD_W = 5400;
export const WORLD_H = 1160;
export const GRAVITY = 1320;

export const BASE_ZONES: Record<'blue' | 'red', BaseZone> = {
  blue: {
    team: 'blue',
    x: 20,
    y: 680,
    w: 330,
    h: 280,
    spawnX: 185,
    spawnY: 900,
  },
  red: {
    team: 'red',
    x: WORLD_W - 350,
    y: 680,
    w: 330,
    h: 280,
    spawnX: WORLD_W - 185,
    spawnY: 900,
  },
};

export const PLATFORMS: Platform[] = [
  // Bottom Lane Stone Floors (Left Citadel Wing, Sunken Primordial Crypt Pit, Right Citadel Wing)
  { id: 'ground_left', x: 0, y: 960, w: 2260, h: 200, oneWay: false, style: 'stone' },
  { id: 'ground_crypt_pit', x: 2260, y: 1065, w: 880, h: 110, oneWay: false, style: 'stone' },
  { id: 'ground_right', x: 3140, y: 960, w: 2260, h: 200, oneWay: false, style: 'stone' },

  // Golden-Cyan Holographic Sanctuary Drop-Through Bridge over the Primordial Crypt
  { id: 'bot_crypt_bridge', x: 2260, y: 960, w: 880, h: 18, oneWay: true, style: 'sanctuary_glass' },

  // Base Loft Steps
  { id: 'blue_base_step', x: 380, y: 780, w: 230, h: 18, oneWay: true, style: 'sanctuary_glass' },
  { id: 'red_base_step', x: WORLD_W - 610, y: 780, w: 230, h: 18, oneWay: true, style: 'sanctuary_glass' },

  // Heavy-Friendly Stepping Stones (Bottom -> Mid -> Top Nave, <= 98px vertical gaps!)
  { id: 'step_blue_low', x: 800, y: 864, w: 140, h: 14, oneWay: true, style: 'sanctuary_glass' },
  { id: 'step_blue_high', x: 1150, y: 672, w: 145, h: 14, oneWay: true, style: 'sanctuary_glass' },
  { id: 'step_center_low_l', x: 2360, y: 866, w: 145, h: 14, oneWay: true, style: 'sanctuary_glass' },
  { id: 'step_center_low_r', x: 2895, y: 866, w: 145, h: 14, oneWay: true, style: 'sanctuary_glass' },
  { id: 'step_center_high_l', x: 2360, y: 674, w: 145, h: 14, oneWay: true, style: 'sanctuary_glass' },
  { id: 'step_center_high_r', x: 2895, y: 674, w: 145, h: 14, oneWay: true, style: 'sanctuary_glass' },
  { id: 'step_red_high', x: WORLD_W - 1295, y: 672, w: 145, h: 14, oneWay: true, style: 'sanctuary_glass' },
  { id: 'step_red_low', x: WORLD_W - 940, y: 864, w: 140, h: 14, oneWay: true, style: 'sanctuary_glass' },

  // Top Lane Cathedral Nave Battlements (Solid stone decks under towers + One-way glass hatches above jump pads!)
  { id: 'top_blue_pad_hatch', x: 640, y: 575, w: 300, h: 18, oneWay: true, style: 'sanctuary_glass' },
  { id: 'top_left_inner', x: 940, y: 575, w: 480, h: 28, oneWay: false, style: 'battlement' },
  { id: 'top_blue_mid_hatch', x: 1420, y: 575, w: 260, h: 18, oneWay: true, style: 'sanctuary_glass' },
  { id: 'top_left_outer', x: 1680, y: 575, w: 580, h: 28, oneWay: false, style: 'battlement' },
  { id: 'top_mid_glass', x: 2260, y: 575, w: 880, h: 18, oneWay: true, style: 'sanctuary_glass' },
  { id: 'top_right_outer', x: 3140, y: 575, w: 580, h: 28, oneWay: false, style: 'battlement' },
  { id: 'top_red_mid_hatch', x: 3720, y: 575, w: 260, h: 18, oneWay: true, style: 'sanctuary_glass' },
  { id: 'top_right_inner', x: 3980, y: 575, w: 480, h: 28, oneWay: false, style: 'battlement' },
  { id: 'top_red_pad_hatch', x: 4460, y: 575, w: 300, h: 18, oneWay: true, style: 'sanctuary_glass' },

  // Mid-Height Gothic Alcoves (Connecting Bottom & Top Lanes along both tower tiers)
  { id: 'mid_blue_inner', x: 930, y: 770, w: 220, h: 18, oneWay: true, style: 'sanctuary_glass' },
  { id: 'mid_blue_outer', x: 1660, y: 770, w: 240, h: 18, oneWay: true, style: 'sanctuary_glass' },
  { id: 'mid_center_altar', x: 2520, y: 775, w: 360, h: 18, oneWay: true, style: 'sanctuary_glass' },
  { id: 'mid_red_outer', x: WORLD_W - 1900, y: 770, w: 240, h: 18, oneWay: true, style: 'sanctuary_glass' },
  { id: 'mid_red_inner', x: WORLD_W - 1150, y: 770, w: 220, h: 18, oneWay: true, style: 'sanctuary_glass' },

  // Heavy-Friendly Upper Steps (Top Nave y=575 -> Rafters y=375 / 345)
  { id: 'step_rafter_blue', x: 1210, y: 476, w: 155, h: 14, oneWay: true, style: 'sanctuary_glass' },
  { id: 'step_rafter_mid_l', x: 2255, y: 468, w: 155, h: 14, oneWay: true, style: 'sanctuary_glass' },
  { id: 'step_rafter_mid_r', x: 2990, y: 468, w: 155, h: 14, oneWay: true, style: 'sanctuary_glass' },
  { id: 'step_rafter_red', x: WORLD_W - 1365, y: 476, w: 155, h: 14, oneWay: true, style: 'sanctuary_glass' },

  // High Stained-Glass Cathedral Rafters (Flank, Hook Ambush & Relic Routes!)
  { id: 'rafter_blue', x: 1380, y: 375, w: 380, h: 16, oneWay: true, style: 'sanctuary_glass' },
  { id: 'rafter_center', x: 2420, y: 360, w: 560, h: 18, oneWay: true, style: 'sanctuary_glass' },
  { id: 'rafter_red', x: WORLD_W - 1760, y: 375, w: 380, h: 16, oneWay: true, style: 'sanctuary_glass' },
];

export const JUMP_PADS: JumpPad[] = [
  // Base Launchers (well ahead of Ancient Cores, directly beneath one-way Top Nave hatches)
  { id: 'jp_blue_base', x: 705, y: 944, w: 68, vx: 95, vy: -1060, color: '#38BDF8' },
  { id: 'jp_red_base', x: WORLD_W - 773, y: 944, w: 68, vx: -95, vy: -1060, color: '#F43F5E' },
  // Mid-Lane Launchers (directly beneath one-way Top Nave hatches, full Top Nave clearance)
  { id: 'jp_blue_mid', x: 1518, y: 944, w: 64, vx: 25, vy: -1060, color: '#38BDF8' },
  { id: 'jp_red_mid', x: WORLD_W - 1582, y: 944, w: 64, vx: -25, vy: -1060, color: '#F43F5E' },
  // Sunken Primordial Crypt Launchers -> High Center Nave
  { id: 'jp_crypt_l', x: 2330, y: 1049, w: 64, vx: 65, vy: -1025, color: '#10B981' },
  { id: 'jp_crypt_r', x: 3006, y: 1049, w: 64, vx: -65, vy: -1025, color: '#10B981' },
  // Top-Nave Upper Launchers -> Very Top Cathedral Rafters (Heavy-Hero Express Access!)
  { id: 'jp_top_blue_rafter', x: 1295, y: 559, w: 64, vx: 145, vy: -820, color: '#F59E0B' },
  { id: 'jp_top_mid_l', x: 2150, y: 559, w: 64, vx: 210, vy: -840, color: '#F59E0B' },
  { id: 'jp_top_mid_r', x: WORLD_W - 2214, y: 559, w: 64, vx: -210, vy: -840, color: '#F59E0B' },
  { id: 'jp_top_red_rafter', x: WORLD_W - 1359, y: 559, w: 64, vx: -145, vy: -820, color: '#F59E0B' },
];

// 2 Sets of Towers per Lane (4 per team = 8 Towers Total!)
export const INITIAL_TURRET_SPOTS = [
  // Blue Inner Towers (shielded until lane's Outer Tower falls)
  { id: 'blue_top_inner', team: 'blue' as const, lane: 'top' as const, tier: 'inner' as const, x: 1120, y: 575 },
  { id: 'blue_bot_inner', team: 'blue' as const, lane: 'bot' as const, tier: 'inner' as const, x: 1120, y: 960 },
  // Blue Outer Towers (frontline)
  { id: 'blue_top_outer', team: 'blue' as const, lane: 'top' as const, tier: 'outer' as const, x: 1940, y: 575 },
  { id: 'blue_bot_outer', team: 'blue' as const, lane: 'bot' as const, tier: 'outer' as const, x: 1940, y: 960 },

  // Red Outer Towers (frontline)
  { id: 'red_top_outer', team: 'red' as const, lane: 'top' as const, tier: 'outer' as const, x: WORLD_W - 1940, y: 575 },
  { id: 'red_bot_outer', team: 'red' as const, lane: 'bot' as const, tier: 'outer' as const, x: WORLD_W - 1940, y: 960 },
  // Red Inner Towers (shielded until lane's Outer Tower falls)
  { id: 'red_top_inner', team: 'red' as const, lane: 'top' as const, tier: 'inner' as const, x: WORLD_W - 1120, y: 575 },
  { id: 'red_bot_inner', team: 'red' as const, lane: 'bot' as const, tier: 'inner' as const, x: WORLD_W - 1120, y: 960 },
];

export const CORE_SPOTS = {
  blue: { x: 500, y: 960 },
  red: { x: WORLD_W - 500, y: 960 },
};

export const NEUTRAL_CREEP_SPOTS = [
  { id: 'spirit_crypt_l', x: 2520, y: 1044 },
  { id: 'spirit_crypt_r', x: 2880, y: 1044 },
  { id: 'spirit_rafter_c', x: 2700, y: 340 },
  { id: 'spirit_blue_alcove', x: 1780, y: 750 },
  { id: 'spirit_red_alcove', x: WORLD_W - 1780, y: 750 },
];

export const SOLAR_CUBE_SPOTS: Array<{ x: number; y: number; value: number }> = [
  // Primordial Crypt floor
  { x: 2630, y: 1020, value: 14 },
  { x: 2700, y: 1014, value: 20 },
  { x: 2770, y: 1020, value: 14 },
  // Center Altar
  { x: 2640, y: 730, value: 14 },
  { x: 2760, y: 730, value: 14 },
  // Top Nave Center
  { x: 2620, y: 530, value: 14 },
  { x: 2700, y: 520, value: 18 },
  { x: 2780, y: 530, value: 14 },
  // Upper Stained-Glass Rafters
  { x: 1570, y: 330, value: 18 },
  { x: 2620, y: 315, value: 18 },
  { x: 2780, y: 315, value: 18 },
  { x: WORLD_W - 1570, y: 330, value: 18 },
  // Mid Alcoves
  { x: 1040, y: 725, value: 12 },
  { x: 1780, y: 725, value: 12 },
  { x: WORLD_W - 1780, y: 725, value: 12 },
  { x: WORLD_W - 1040, y: 725, value: 12 },
];
