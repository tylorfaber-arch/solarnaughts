import { HERO_MAP } from './heroes';
import { BASE_ZONES, JUMP_PADS, PLATFORMS, WORLD_H, WORLD_W } from './map';
import { ensureArenaArtLoaded, type ArenaArtAssets, type ProcessedSprite } from './sprites';
import { drawGlow, vfxBeginFrame, vfxCastBurst, vfxDrawParticles, vfxDrawTrails, vfxMuzzle, vfxTrackProjectile } from './vfx';
import type {
  CoreDrillEntity,
  DroidEntity,
  FloatingText,
  HazardZoneEntity,
  HeroEntity,
  HookEntity,
  NeutralCreepEntity,
  Particle,
  ProjectileEntity,
  SolarCubeEntity,
  SummonEntity,
  Team,
  TurretEntity,
} from './types';

export interface EndCinematicRenderState {
  active: boolean;
  completed: boolean;
  winner: Team;
  localWon: boolean;
  elapsed: number;
  duration: number;
  canSkip: boolean;
  coreX: number;
  coreY: number;
}

export interface RenderState {
  time: number;
  localTeam: Team;
  camX: number;
  camY: number;
  shakeX: number;
  shakeY: number;
  mouseScreenX: number;
  mouseScreenY: number;
  mouseWorldX: number;
  mouseWorldY: number;
  heroes: HeroEntity[];
  droids: DroidEntity[];
  turrets: TurretEntity[];
  cores: CoreDrillEntity[];
  creeps: NeutralCreepEntity[];
  solarCubes: SolarCubeEntity[];
  projectiles: ProjectileEntity[];
  summons: SummonEntity[];
  hooks: HookEntity[];
  hazards: HazardZoneEntity[];
  particles: Particle[];
  floatingTexts: FloatingText[];
  endCinematic?: EndCinematicRenderState | null;
}

const INK = '#07090F';

const STARS = Array.from({ length: 110 }, (_, i) => {
  const seed = (i * 9301 + 49297) % 233280;
  const seed2 = (seed * 9301 + 49297) % 233280;
  return {
    x: (seed / 233280) * 3400,
    y: (seed2 / 233280) * 560,
    r: i % 7 === 0 ? 2.2 : i % 2 === 0 ? 1.3 : 0.8,
    twinkle: (i * 1.43) % (Math.PI * 2),
  };
});

const AMBIENT_MOTES = Array.from({ length: 46 }, (_, i) => ({
  baseX: ((i * 397 + 120) % (WORLD_W - 240)) + 120,
  baseY: 240 + ((i * 193) % 790),
  speed: 14 + (i % 5) * 6,
  phase: (i * 1.7) % (Math.PI * 2),
  size: 1.5 + (i % 3) * 0.85,
}));

export function renderArena(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: RenderState
): void {
  const art = ensureArenaArtLoaded(ctx);
  vfxBeginFrame(state.time);
  ctx.save();

  const camX = state.camX + state.shakeX;
  const camY = state.camY + state.shakeY;

  // 1. Painted 3-Biome Gothic-Alien Cathedral Parallax Backdrop (matches Champion Select art)
  const drewPaintedBg = drawPaintedCathedralBackdrop(ctx, width, height, camX, camY, state.time, art);
  if (!drewPaintedBg) {
    // Fallback procedural vista for the first few milliseconds before images decode
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#050812');
    skyGrad.addColorStop(0.38, '#0D1426');
    skyGrad.addColorStop(0.76, '#1A1730');
    skyGrad.addColorStop(1, '#26192A');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    drawSkyRiftAndMoon(ctx, width, height, camX, state.time);
    for (let i = 0; i < STARS.length; i++) {
      const s = STARS[i];
      const sx = (((s.x - camX * 0.05) % (width + 120)) + (width + 120)) % (width + 120) - 60;
      const sy = s.y * (height / 860);
      const alpha = 0.3 + 0.5 * Math.sin(state.time * 2.0 + s.twinkle);
      ctx.fillStyle = `rgba(226, 238, 255, ${alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    drawAlienWarships(ctx, width, height, camX, state.time);
    drawCathedralSkyline(ctx, width, height, camX, state.time);
  }

  // === ENTER WORLD SPACE ===
  ctx.save();
  ctx.translate(-Math.round(camX), -Math.round(camY));

  // 6. Biome-Differentiated Cathedral Interior Columns, Wall Braziers & Crypt Pit
  drawCathedralArchitecture(ctx, camX, width, state.time, art);
  drawCathedralSunbeams(ctx, camX, width, state.time);

  // 7. Sanctum & Invasion Healing Altars
  drawBaseZone(ctx, BASE_ZONES.blue, state.time, art);
  drawBaseZone(ctx, BASE_ZONES.red, state.time, art);

  // 8. Platforms (Carved Gothic Ashlar Stone & Ornate Stained-Glass Iron Catwalks)
  for (const p of PLATFORMS) {
    if (p.x + p.w < camX - 100 || p.x > camX + width + 100) continue;
    drawPlatform(ctx, p, state.time, art);
  }

  // 9. Runic Gravity Jump Pads
  const playerHero = state.heroes.find((h) => h.isPlayer);
  for (const jp of JUMP_PADS) {
    if (jp.x + jp.w < camX - 80 || jp.x > camX + width + 80) continue;
    drawJumpPad(ctx, jp, state.time, playerHero, art.jumpPad);
  }

  // 10. Relic Essence Shards
  for (const sc of state.solarCubes) {
    if (sc.active) drawRelicShard(ctx, sc, state.time, art.relicShard);
  }

  // 11. Neutral Crypt Spirits
  for (const creep of state.creeps) {
    if (creep.alive) drawCryptSpirit(ctx, creep, state.time, art.cryptSpirit);
  }

  // 12. Ancient Cores & 2-Tier Reliquary Towers
  for (const core of state.cores) {
    drawAncientCore(ctx, core, state.time, art.core, state.endCinematic ?? null);
  }
  for (const turret of state.turrets) {
    drawReliquaryTower(ctx, turret, state.time, playerHero, art.tower);
  }

  // 13. Ground Hazards & Totem Auras
  for (const hz of state.hazards) {
    drawHazardZone(ctx, hz, state.time);
  }
  for (const s of state.summons) {
    if (s.kind === 'totem') drawSummon(ctx, s, state.time);
  }

  // 14. Escalating Lane Creeps & Bone-Borgs
  for (const d of state.droids) {
    if (d.x < camX - 100 || d.x > camX + width + 100) continue;
    drawDroid(ctx, d, state.time, art.trooper, art.boneBorg);
  }

  // 15. Active Abyssal Chain Hooks
  for (const hk of state.hooks) {
    drawChainHook(ctx, hk, state.time);
  }

  // 16. Champions (alive or descending in drop pods)
  for (const h of state.heroes) {
    if (h.inDropPod) {
      drawDropPodSequence(ctx, h, state.time, art);
    } else if (h.alive) {
      drawHero(ctx, h, state.time, state.localTeam, art.heroes[h.heroId], state.endCinematic ?? null);
    }
  }

  // 17. Active Holo-Seraph Rams & Orbiting Ancestral Skulls
  for (const s of state.summons) {
    if (s.kind !== 'totem') drawSummon(ctx, s, state.time);
  }

  // 18. Projectiles
  for (const proj of state.projectiles) vfxTrackProjectile(proj);
  vfxDrawTrails(ctx);
  for (const proj of state.projectiles) {
    drawProjectile(ctx, proj, state.time);
  }

  // 19. Subtle Ambient Cathedral Embers & Crypt Spores
  drawAmbientMotes(ctx, camX, width, state.time);

  // 20. Combat Particles
  for (const pt of state.particles) {
    const t = Math.max(0, pt.life / pt.maxLife);
    ctx.save();
    ctx.globalAlpha = t;
    if (pt.shape === 'ring') {
      ctx.strokeStyle = pt.color;
      ctx.lineWidth = 3 * t + 1;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * (1.85 - t * 0.85), 0, Math.PI * 2);
      ctx.stroke();
    } else if (pt.shape === 'square') {
      ctx.fillStyle = pt.color;
      ctx.translate(pt.x, pt.y);
      ctx.rotate(t * 4);
      ctx.fillRect(-pt.size * 0.5, -pt.size * 0.5, pt.size, pt.size);
    } else if (pt.shape === 'spark') {
      ctx.strokeStyle = pt.color;
      ctx.lineWidth = Math.max(1.5, pt.size * 0.45);
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x - pt.vx * 0.038, pt.y - pt.vy * 0.038);
      ctx.stroke();
    } else {
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, Math.max(1, pt.size * t), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 20b. Additive light VFX (impacts, muzzle flashes, cast flares, embers, smoke)
  vfxDrawParticles(ctx);

  // 21. Floating Combat Numbers
  for (const ft of state.floatingTexts) {
    const t = Math.max(0, ft.life / ft.maxLife);
    ctx.save();
    ctx.globalAlpha = Math.min(1, t * 1.6);
    ctx.font = `800 ${Math.round(14 * ft.scale)}px "Bricolage Grotesque", sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = INK;
    ctx.strokeText(ft.text, ft.x, ft.y);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }

  ctx.restore();
  // === EXIT WORLD SPACE ===

  // 21b. Subtle Cathedral Edge Vignette (frames combat & sharpens HUD corner contrast)
  const vig = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    Math.min(width, height) * 0.36,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.72
  );
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(4, 6, 13, 0.42)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);

  // 22. Tactical Aim Reticle (hidden during cinematic Victory/Defeat sequence)
  if (!state.endCinematic?.active && playerHero && playerHero.alive && !playerHero.inDropPod) {
    drawCrosshair(ctx, state.mouseScreenX, state.mouseScreenY, HERO_MAP[playerHero.heroId].accentColor);
  }

  // 23. Cinematic Victory / Defeat Widescreen Sequence Overlay
  if (state.endCinematic && (state.endCinematic.active || state.endCinematic.completed)) {
    drawEndCinematicOverlay(ctx, width, height, state.endCinematic, state.time);
  }

  ctx.restore();
}

function drawPaintedCathedralBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  camX: number,
  camY: number,
  time: number,
  art: ArenaArtAssets
): boolean {
  const { bgSanctum, bgCrypt, bgInvasion } = art;
  if (!bgSanctum && !bgCrypt && !bgInvasion) return false;

  // Normalized camera position across the 5400px cathedral (0 = Sanctum, 0.5 = Crypt, 1 = Invasion)
  const maxCamX = Math.max(1, WORLD_W - width);
  const maxCamY = Math.max(1, WORLD_H - height);
  const t = Math.max(0, Math.min(1, camX / maxCamX));
  const ty = Math.max(0, Math.min(1, camY / maxCamY));

  // Smooth 3-biome cross-fade weights across Sanctum (left), Primordial Crypt (center), Invasion (right)
  const wSanctum = Math.max(0, Math.min(1, 1 - Math.max(0, (t - 0.16) / 0.28)));
  const wInvasion = Math.max(0, Math.min(1, (t - 0.56) / 0.28));
  const wCrypt = Math.max(0, Math.min(1, 1 - Math.abs(t - 0.5) / 0.38));

  const drawCover = (img: HTMLImageElement | null, alpha: number, parallaxX: number) => {
    if (!img || alpha <= 0.01) return;
    const overscan = 1.22;
    const imgAspect = img.naturalWidth / Math.max(1, img.naturalHeight);
    const viewAspect = width / Math.max(1, height);
    let drawW: number;
    let drawH: number;
    if (viewAspect > imgAspect) {
      drawW = width * overscan;
      drawH = drawW / imgAspect;
    } else {
      drawH = height * overscan;
      drawW = drawH * imgAspect;
    }
    const maxPanX = Math.max(0, drawW - width);
    const maxPanY = Math.max(0, drawH - height);
    const dx = -maxPanX * parallaxX;
    const dy = -maxPanY * (0.24 + ty * 0.52);
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(img, dx, dy, drawW, drawH);
    ctx.restore();
  };

  ctx.fillStyle = '#060912';
  ctx.fillRect(0, 0, width, height);

  // Layer the 3 painted cathedral vistas with seamless cross-fades & 2D parallax depth
  drawCover(bgCrypt ?? bgSanctum ?? bgInvasion, 1, t);
  if (wSanctum > 0.01) drawCover(bgSanctum, wSanctum, t * 0.9);
  if (wCrypt > 0.01 && bgCrypt) drawCover(bgCrypt, wCrypt, t);
  if (wInvasion > 0.01) drawCover(bgInvasion, wInvasion, Math.min(1, 0.1 + t * 0.9));

  // Balanced atmospheric depth glaze: vivid painted cathedral above, crisp silhouette readability below
  const glaze = ctx.createLinearGradient(0, 0, 0, height);
  glaze.addColorStop(0, 'rgba(5, 8, 16, 0.16)');
  glaze.addColorStop(0.48, 'rgba(7, 11, 20, 0.27)');
  glaze.addColorStop(1, 'rgba(6, 9, 16, 0.42)');
  ctx.fillStyle = glaze;
  ctx.fillRect(0, 0, width, height);

  // Subtle biome color atmosphere pulse
  const pulse = 0.04 + 0.02 * Math.sin(time * 1.4);
  if (wSanctum > 0.25) {
    ctx.fillStyle = `rgba(245, 158, 11, ${(pulse * wSanctum).toFixed(3)})`;
    ctx.fillRect(0, 0, width, height);
  } else if (wInvasion > 0.25) {
    ctx.fillStyle = `rgba(244, 63, 94, ${(pulse * wInvasion).toFixed(3)})`;
    ctx.fillRect(0, 0, width, height);
  }
  return true;
}

function drawCathedralSunbeams(
  ctx: CanvasRenderingContext2D,
  camX: number,
  viewW: number,
  time: number
): void {
  ctx.save();
  const beams = [
    { x: 960, w: 135, col: 'rgba(251, 191, 36, 0.055)' },
    { x: 1740, w: 120, col: 'rgba(56, 189, 248, 0.05)' },
    { x: 2700, w: 170, col: 'rgba(52, 211, 153, 0.055)' },
    { x: 3660, w: 120, col: 'rgba(244, 63, 94, 0.05)' },
    { x: 4440, w: 135, col: 'rgba(192, 132, 252, 0.05)' },
  ];
  for (let i = 0; i < beams.length; i++) {
    const b = beams[i];
    if (b.x + 280 < camX || b.x - 160 > camX + viewW) continue;
    const sway = Math.sin(time * 0.6 + i * 1.4) * 12;
    const g = ctx.createLinearGradient(b.x, 90, b.x + 150, 960);
    g.addColorStop(0, b.col);
    g.addColorStop(0.75, b.col);
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(b.x - b.w * 0.45 + sway, 90);
    ctx.lineTo(b.x + b.w * 0.45 + sway, 90);
    ctx.lineTo(b.x + b.w * 1.15 + 160 + sway, 960);
    ctx.lineTo(b.x - b.w * 0.15 + 160 + sway, 960);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/* =========================================================================
   PARALLAX SKY, ALIEN INVASION FLEET & SHATTERED CATHEDRAL VISTA
   ========================================================================= */

function drawSkyRiftAndMoon(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  camX: number,
  time: number
): void {
  ctx.save();
  // Alien Invasion Slipstream Nebula Band diagonal across upper sky
  const riftX = width * 0.52 - camX * 0.035;
  const riftGrad = ctx.createRadialGradient(riftX, height * 0.16, 18, riftX, height * 0.16, 360);
  riftGrad.addColorStop(0, 'rgba(56, 189, 248, 0.22)');
  riftGrad.addColorStop(0.45, 'rgba(139, 92, 246, 0.12)');
  riftGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = riftGrad;
  ctx.fillRect(0, 0, width, height * 0.65);

  // Fractured Eclipse Moon with Golden Halo
  const moonX = width * 0.72 - camX * 0.04;
  const moonY = height * 0.19;
  const moonHalo = ctx.createRadialGradient(moonX, moonY, 34, moonX, moonY, 130);
  moonHalo.addColorStop(0, 'rgba(245, 158, 11, 0.28)');
  moonHalo.addColorStop(0.55, 'rgba(244, 63, 94, 0.1)');
  moonHalo.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = moonHalo;
  ctx.beginPath();
  ctx.arc(moonX, moonY, 130, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FEF3C7';
  ctx.beginPath();
  ctx.arc(moonX, moonY, 44, 0, Math.PI * 2);
  ctx.fill();

  // Eclipse shadow disc carving a dramatic crescent
  ctx.fillStyle = '#090D1C';
  ctx.beginPath();
  ctx.arc(moonX - 14, moonY - 6, 40, 0, Math.PI * 2);
  ctx.fill();

  // Faint alien orbital ring cutting past the moon
  ctx.strokeStyle = `rgba(56, 189, 248, ${(0.22 + 0.08 * Math.sin(time * 1.4)).toFixed(2)})`;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(moonX, moonY, 92, 18, -0.24, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawAlienWarships(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  camX: number,
  time: number
): void {
  ctx.save();
  const ships = [
    { bx: 360, by: 102, scale: 1.15, col: '#38BDF8', sweepDir: 1 },
    { bx: 1040, by: 76, scale: 0.92, col: '#10B981', sweepDir: -1 },
    { bx: 1780, by: 112, scale: 1.38, col: '#F43F5E', sweepDir: 1 },
  ];

  for (const sh of ships) {
    const sx = sh.bx - camX * 0.1;
    const sy = sh.by + Math.sin(time * 0.85 + sh.bx) * 5;
    if (sx < -320 || sx > width + 320) continue;

    // Sweeping Volumetric Alien Searchlight Beam
    const sway = Math.sin(time * 0.45 * sh.sweepDir + sh.bx) * 55;
    const beamGrad = ctx.createLinearGradient(sx, sy + 18, sx + sway, height);
    beamGrad.addColorStop(0, `${sh.col}2E`);
    beamGrad.addColorStop(0.65, `${sh.col}0D`);
    beamGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(sx - 18 * sh.scale, sy + 14);
    ctx.lineTo(sx + 18 * sh.scale, sy + 14);
    ctx.lineTo(sx + sway + 82 * sh.scale, height);
    ctx.lineTo(sx + sway - 82 * sh.scale, height);
    ctx.closePath();
    ctx.fill();

    // Upper Command Spire
    ctx.fillStyle = '#090F1E';
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(sx - 34 * sh.scale, sy - 18 * sh.scale);
    ctx.lineTo(sx - 12 * sh.scale, sy - 42 * sh.scale);
    ctx.lineTo(sx + 12 * sh.scale, sy - 42 * sh.scale);
    ctx.lineTo(sx + 34 * sh.scale, sy - 18 * sh.scale);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Main Faceted Alien Dreadnought Hull
    ctx.fillStyle = '#0B1224';
    ctx.beginPath();
    ctx.moveTo(sx - 128 * sh.scale, sy + 2);
    ctx.lineTo(sx - 56 * sh.scale, sy - 22 * sh.scale);
    ctx.lineTo(sx + 56 * sh.scale, sy - 22 * sh.scale);
    ctx.lineTo(sx + 128 * sh.scale, sy + 2);
    ctx.lineTo(sx + 72 * sh.scale, sy + 20 * sh.scale);
    ctx.lineTo(sx + 16 * sh.scale, sy + 28 * sh.scale);
    ctx.lineTo(sx - 16 * sh.scale, sy + 28 * sh.scale);
    ctx.lineTo(sx - 72 * sh.scale, sy + 20 * sh.scale);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing Reactor Conduits & Underside Tractor Core
    const pulse = 0.45 + 0.4 * Math.sin(time * 2.6 + sh.bx);
    ctx.fillStyle = sh.col;
    ctx.globalAlpha = pulse;
    ctx.fillRect(sx - 54 * sh.scale, sy - 3, 108 * sh.scale, 3.5);
    ctx.beginPath();
    ctx.arc(sx, sy + 16 * sh.scale, 7 * sh.scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Patrolling Escort Frigate Silhouette
    const ex = sx + Math.cos(time * 0.7 + sh.bx) * 145 * sh.scale;
    const ey = sy + 36 + Math.sin(time * 1.4 + sh.bx) * 7;
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.moveTo(ex - 20, ey);
    ctx.lineTo(ex, ey - 6);
    ctx.lineTo(ex + 20, ey);
    ctx.lineTo(ex, ey + 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = sh.col;
    ctx.fillRect(ex - 6, ey - 1, 12, 2);
  }
  ctx.restore();
}

function drawCathedralSkyline(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  camX: number,
  time: number
): void {
  ctx.save();

  // Far Ruined Spires Layer (0.14 parallax)
  const farOff = -(camX * 0.14);
  for (let i = 0; i < 20; i++) {
    const bx = farOff + i * 260;
    if (bx < -280 || bx > width + 120) continue;
    const bh = 250 + ((i * 89) % 160);
    ctx.fillStyle = '#0A0E1B';
    ctx.beginPath();
    ctx.moveTo(bx, height);
    ctx.lineTo(bx, height - bh);
    ctx.lineTo(bx + 26, height - bh - 24);
    ctx.lineTo(bx + 50, height - bh - 88);
    ctx.lineTo(bx + 74, height - bh - 24);
    ctx.lineTo(bx + 100, height - bh);
    ctx.lineTo(bx + 100, height);
    ctx.closePath();
    ctx.fill();
  }

  // Mid Gothic Cathedral Arches & Biome-Tinted Stained Glass (0.24 parallax)
  const midOff = -(camX * 0.24);
  for (let i = 0; i < 16; i++) {
    const bx = midOff + i * 310;
    if (bx < -320 || bx > width + 140) continue;
    const bh = 215 + ((i * 67) % 120);

    // Cathedral stone wall + flying buttress silhouette
    ctx.fillStyle = '#111626';
    ctx.beginPath();
    ctx.moveTo(bx, height);
    ctx.lineTo(bx, height - bh);
    ctx.lineTo(bx + 62, height - bh - 64);
    ctx.lineTo(bx + 124, height - bh);
    ctx.lineTo(bx + 124, height);
    ctx.closePath();
    ctx.fill();

    // Flying buttress arch connecting towers
    ctx.strokeStyle = '#182036';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(bx + 122, height - bh + 44);
    ctx.quadraticCurveTo(bx + 185, height - bh + 6, bx + 240, height - bh + 95);
    ctx.stroke();

    // Glowing Gothic Lancet Stained Glass (shifts from Sanctum Amber -> Crypt Emerald -> Invasion Crimson)
    const glow = 0.2 + 0.08 * Math.sin(time * 1.9 + i);
    const col =
      i < 5
        ? `rgba(245, 158, 11, ${glow.toFixed(2)})`
        : i < 10
          ? `rgba(16, 185, 129, ${glow.toFixed(2)})`
          : `rgba(244, 63, 94, ${glow.toFixed(2)})`;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(bx + 62, height - bh + 22, 18, Math.PI, 0);
    ctx.lineTo(bx + 80, height - bh + 92);
    ctx.lineTo(bx + 44, height - bh + 92);
    ctx.closePath();
    ctx.fill();

    // Lancet tracery crossbars
    ctx.strokeStyle = '#0D1221';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx + 62, height - bh + 4);
    ctx.lineTo(bx + 62, height - bh + 92);
    ctx.moveTo(bx + 44, height - bh + 46);
    ctx.lineTo(bx + 80, height - bh + 46);
    ctx.stroke();
  }
  ctx.restore();
}

/* =========================================================================
   WORLD ARCHITECTURE: SANCTUM WING, CRASHED OBELISK, PRIMORDIAL CRYPT, INVASION WING
   ========================================================================= */

function drawCathedralArchitecture(
  ctx: CanvasRenderingContext2D,
  camX: number,
  viewW: number,
  time: number,
  art: ArenaArtAssets
): void {
  ctx.save();

  // 1. Vaulted Gothic Stone Columns Supporting the Top Cathedral Nave (aligned strictly under solid stone decks, clear of jump-pad hatches)
  const pillarXs = [990, 1370, 1940, 2260, 3140, 3460, 4030, 4410];
  for (const px of pillarXs) {
    if (px < camX - 200 || px > camX + viewW + 200) continue;
    const isSanctum = px < WORLD_W / 2;
    const isCenter = px === 2260 || px === 3140;

    if (art.cathedralPillar) {
      // Hand-inked carved Gothic cathedral column spanning Top Nave -> Bottom Floor
      const pillarH = 392;
      const pillarW = pillarH * art.cathedralPillar.aspect;
      const mirror = isSanctum ? 1 : -1;

      ctx.save();
      ctx.globalAlpha = 0.86;
      ctx.translate(px, 574);
      ctx.scale(mirror, 1);
      ctx.drawImage(art.cathedralPillar.canvas, -pillarW / 2, 0, pillarW, pillarH);
      ctx.restore();

      // Live flickering torchlight aura on the pillar's wrought-iron sconce
      const torchX = px + mirror * pillarW * 0.34;
      const torchY = 574 + pillarH * 0.44;
      const flicker = 0.78 + 0.22 * Math.sin(time * 9.5 + px);
      const torchCol = isCenter ? '#34D399' : isSanctum ? '#F59E0B' : '#F43F5E';
      const tGlow = ctx.createRadialGradient(torchX, torchY, 4, torchX, torchY, 64 * flicker);
      tGlow.addColorStop(0, `${torchCol}55`);
      tGlow.addColorStop(0.5, `${torchCol}1C`);
      tGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = tGlow;
      ctx.beginPath();
      ctx.arc(torchX, torchY, 64 * flicker, 0, Math.PI * 2);
      ctx.fill();

      // Subtle swaying faction pennant on outer nave columns for territory clarity
      if (!isCenter) {
        const sway = Math.sin(time * 2.3 + px * 0.01) * 4;
        ctx.save();
        ctx.globalAlpha = 0.85;
        if (isSanctum) {
          ctx.fillStyle = '#1E3A8A';
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(px - 14, 678);
          ctx.lineTo(px + 14, 678);
          ctx.lineTo(px + 14 + sway, 766);
          ctx.lineTo(px + sway * 1.15, 788);
          ctx.lineTo(px - 14 + sway, 766);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#FBBF24';
          ctx.fillRect(px - 2 + sway * 0.4, 700, 4, 30);
          ctx.fillRect(px - 8 + sway * 0.4, 709, 16, 4);
        } else {
          ctx.fillStyle = '#881337';
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(px - 14, 678);
          ctx.lineTo(px + 14, 678);
          ctx.lineTo(px + 12 + sway, 766);
          ctx.lineTo(px + 3 + sway, 746);
          ctx.lineTo(px - 5 + sway, 782);
          ctx.lineTo(px - 14 + sway, 754);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }
    } else {
      // Fallback column before image decode
      if (art.stonePattern) {
        ctx.fillStyle = art.stonePattern;
        ctx.fillRect(px - 24, 578, 48, 382);
      }
      const pGrad = ctx.createLinearGradient(px - 24, 0, px + 24, 0);
      pGrad.addColorStop(0, 'rgba(10, 13, 24, 0.78)');
      pGrad.addColorStop(0.5, 'rgba(26, 32, 48, 0.42)');
      pGrad.addColorStop(1, 'rgba(8, 10, 18, 0.85)');
      ctx.fillStyle = pGrad;
      ctx.fillRect(px - 24, 578, 48, 382);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.6;
      ctx.strokeRect(px - 24, 578, 48, 382);
      drawWallBrazier(
        ctx,
        px,
        845,
        isSanctum ? '#F59E0B' : '#F43F5E',
        isSanctum ? '#FEF08A' : '#38BDF8',
        time + px
      );
    }
  }

  // 2. Center Cathedral Focus (when painted Crypt vista is loaded, let its hand-painted Rose Window
  //    & Crashed Obelisk shine unobstructed with only a subtle animated arcane shimmer!)
  const cx = WORLD_W / 2;
  if (cx > camX - 420 && cx < camX + viewW + 420) {
    if (art.bgCrypt) {
      ctx.save();
      ctx.translate(cx, 510);
      ctx.rotate(time * 0.08);
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.14)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 148, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.beginPath();
      ctx.arc(0, 0, 102, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else {
      // Procedural Rose Window fallback before painted backdrop finishes decoding
      ctx.fillStyle = '#121625';
      ctx.strokeStyle = '#2A334E';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, 540, 260, Math.PI, 0);
      ctx.lineTo(cx + 260, 575);
      ctx.lineTo(cx - 260, 575);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  // 3. Sunken Primordial Crypt Pit (x = 2260..3140, y = 960..1120)
  if (3140 > camX - 80 && 2260 < camX + viewW + 80) {
    // Textured Catacomb Stone Backwall
    if (art.stonePattern) {
      ctx.fillStyle = art.stonePattern;
      ctx.fillRect(2260, 960, 880, 115);
      ctx.fillStyle = 'rgba(6, 22, 22, 0.72)';
      ctx.fillRect(2260, 960, 880, 115);
    } else {
      ctx.fillStyle = '#0A1415';
      ctx.fillRect(2260, 960, 880, 115);
    }

    // Carved Crypt Arch Alcoves with Faint Skull Silhouettes
    for (let ax = 2365; ax <= 3025; ax += 110) {
      ctx.fillStyle = 'rgba(4, 10, 12, 0.85)';
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.28)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(ax, 1012, 22, Math.PI, 0);
      ctx.lineTo(ax + 22, 1064);
      ctx.lineTo(ax - 22, 1064);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Tiny glowing primordial eyes inside alcove
      ctx.fillStyle = 'rgba(52, 211, 153, 0.42)';
      ctx.fillRect(ax - 6, 1015, 3, 3);
      ctx.fillRect(ax + 3, 1015, 3, 3);
    }

    // Hanging Gnarled Emerald Roots & Vines from underside of bridge
    ctx.strokeStyle = '#065F46';
    ctx.lineWidth = 2.6;
    for (let vx = 2295; vx <= 3105; vx += 62) {
      const sway = Math.sin(time * 1.8 + vx * 0.04) * 5;
      const len = 26 + ((vx * 13) % 34);
      ctx.beginPath();
      ctx.moveTo(vx, 976);
      ctx.quadraticCurveTo(vx + sway, 976 + len * 0.5, vx + sway * 1.4, 976 + len);
      ctx.stroke();
      ctx.fillStyle = 'rgba(52, 211, 153, 0.65)';
      ctx.beginPath();
      ctx.arc(vx + sway * 1.4, 976 + len, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rising Primordial Emerald Mist
    const cryptGrad = ctx.createLinearGradient(0, 945, 0, 1085);
    cryptGrad.addColorStop(0, 'rgba(16, 185, 129, 0)');
    cryptGrad.addColorStop(0.55, 'rgba(16, 185, 129, 0.16)');
    cryptGrad.addColorStop(1, 'rgba(6, 78, 59, 0.48)');
    ctx.fillStyle = cryptGrad;
    ctx.fillRect(2260, 945, 880, 140);

    // Pulsing Primordial Rune Motes along pit floor
    ctx.fillStyle = 'rgba(52, 211, 153, 0.5)';
    for (let rx = 2310; rx <= 3090; rx += 78) {
      const bob = Math.sin(time * 2.4 + rx * 0.03) * 5;
      ctx.beginPath();
      ctx.arc(rx, 1046 + bob, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Left & Right Citadel Boundary Walls (Ashlar Stone Masonry)
  if (art.stonePattern) {
    ctx.fillStyle = art.stonePattern;
    ctx.fillRect(0, 0, 24, WORLD_H);
    ctx.fillRect(WORLD_W - 24, 0, 24, WORLD_H);
    ctx.fillStyle = 'rgba(8, 10, 18, 0.55)';
    ctx.fillRect(0, 0, 24, WORLD_H);
    ctx.fillRect(WORLD_W - 24, 0, 24, WORLD_H);
  } else {
    ctx.fillStyle = '#0C101C';
    ctx.fillRect(0, 0, 24, WORLD_H);
    ctx.fillRect(WORLD_W - 24, 0, 24, WORLD_H);
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(24, 0);
  ctx.lineTo(24, WORLD_H);
  ctx.moveTo(WORLD_W - 24, 0);
  ctx.lineTo(WORLD_W - 24, WORLD_H);
  ctx.stroke();
  ctx.restore();
}

function drawWallBrazier(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  outerCol: string,
  innerCol: string,
  seed: number
): void {
  const flicker = 0.75 + 0.25 * Math.sin(seed * 9.5);
  const glow = ctx.createRadialGradient(x, y - 6, 4, x, y - 6, 54 * flicker);
  glow.addColorStop(0, `${outerCol}44`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y - 6, 54 * flicker, 0, Math.PI * 2);
  ctx.fill();

  // Iron bowl
  ctx.fillStyle = '#1E293B';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(x - 10, y);
  ctx.lineTo(x + 10, y);
  ctx.lineTo(x + 6, y + 8);
  ctx.lineTo(x - 6, y + 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Flame tongue
  ctx.fillStyle = outerCol;
  ctx.beginPath();
  ctx.moveTo(x - 7, y);
  ctx.quadraticCurveTo(x - 2, y - 14 * flicker, x, y - 18 * flicker);
  ctx.quadraticCurveTo(x + 2, y - 14 * flicker, x + 7, y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = innerCol;
  ctx.beginPath();
  ctx.arc(x, y - 5, 3.5 * flicker, 0, Math.PI * 2);
  ctx.fill();

  // Rising flickering torch embers
  for (let i = 0; i < 2; i++) {
    const p = (seed * 0.72 + i * 0.5) % 1;
    const ex = x + Math.sin(seed * 4 + i * 3.1) * (5 + p * 7);
    const ey = y - 10 - p * 34;
    ctx.fillStyle = innerCol;
    ctx.globalAlpha = (1 - p) * 0.8;
    ctx.beginPath();
    ctx.arc(ex, ey, 1.8 * (1 - p * 0.4), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawBaseZone(
  ctx: CanvasRenderingContext2D,
  zone: { team: 'blue' | 'red'; x: number; y: number; w: number; h: number },
  time: number,
  art: ArenaArtAssets
): void {
  const isBlue = zone.team === 'blue';
  const primary = isBlue ? '#38BDF8' : '#F43F5E';
  const accent = isBlue ? '#F59E0B' : '#38BDF8';
  const bg = isBlue ? 'rgba(56, 189, 248, 0.07)' : 'rgba(244, 63, 94, 0.07)';
  ctx.save();

  ctx.fillStyle = bg;
  ctx.fillRect(zone.x, zone.y, zone.w, zone.h);

  const cx = zone.x + zone.w * 0.5;
  const floorY = zone.y + zone.h;

  if (art.healingAltar) {
    const drawH = 252;
    const drawW = drawH * art.healingAltar.aspect;

    // Live emerald-gold restoration glow pulsing from the altar chalice
    const glowPulse = 0.72 + 0.28 * Math.sin(time * 3.2);
    const chaliceGlow = ctx.createRadialGradient(
      cx,
      floorY - drawH * 0.42,
      10,
      cx,
      floorY - drawH * 0.42,
      96 * glowPulse
    );
    chaliceGlow.addColorStop(0, 'rgba(52, 211, 153, 0.36)');
    chaliceGlow.addColorStop(0.55, isBlue ? 'rgba(56, 189, 248, 0.14)' : 'rgba(244, 63, 94, 0.14)');
    chaliceGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = chaliceGlow;
    ctx.beginPath();
    ctx.arc(cx, floorY - drawH * 0.42, 96 * glowPulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.drawImage(art.healingAltar.canvas, cx - drawW / 2, floorY - drawH + 4, drawW, drawH);
  } else {
    const cy = zone.y + 115;
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy + 20, 74, Math.PI, 0);
    ctx.stroke();
    ctx.globalAlpha = 0.85;
    const bob = Math.sin(time * 3) * 4;
    ctx.fillStyle = '#10B981';
    ctx.fillRect(cx - 18, cy - 5 + bob, 36, 10);
    ctx.fillRect(cx - 5, cy - 18 + bob, 10, 36);
  }

  // Ascending restorative emerald-gold motes above the Healing Altar
  for (let i = 0; i < 6; i++) {
    const p = (time * 0.42 + i * 0.17) % 1;
    const mx = cx + Math.sin(time * 1.8 + i * 2.1) * 48;
    const my = floorY - 24 - p * 175;
    ctx.fillStyle = i % 2 === 0 ? '#34D399' : '#FDE68A';
    ctx.globalAlpha = Math.sin(p * Math.PI) * 0.72;
    ctx.beginPath();
    ctx.arc(mx, my, 2.2 + (i % 2) * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Sanctified barrier energy gate
  const gateX = isBlue ? zone.x + zone.w : zone.x;
  const pulse = 0.55 + 0.35 * Math.sin(time * 4);
  ctx.strokeStyle = primary;
  ctx.globalAlpha = pulse;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(gateX, zone.y);
  ctx.lineTo(gateX, zone.y + zone.h);
  ctx.stroke();

  ctx.globalAlpha = 0.94;
  ctx.font = '700 12px "Bricolage Grotesque", sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  const label = isBlue ? 'SANCTUM HEALING ALTAR' : 'INVASION WARP ALTAR';
  ctx.strokeText(label, cx, zone.y + 20);
  ctx.fillStyle = primary;
  ctx.fillText(label, cx, zone.y + 20);
  ctx.restore();
}

function drawPlatform(
  ctx: CanvasRenderingContext2D,
  p: { x: number; y: number; w: number; h: number; oneWay: boolean; style: string },
  time: number,
  art: ArenaArtAssets
): void {
  ctx.save();
  const centerX = p.x + p.w * 0.5;
  const isCryptArea = Math.abs(centerX - WORLD_W / 2) < 520;
  const isInvasionSide = centerX > WORLD_W / 2 + 450;

  if (p.oneWay) {
    if (art.platformGlassBridge) {
      // Hand-Inked Ornate Wrought-Iron & Glowing Stained-Glass Catwalk Bridge
      const sprite = art.platformGlassBridge;
      const bridgeH = p.h >= 16 ? 56 : 46;
      const topY = p.y - bridgeH * 0.34; // Align flat walkable iron deck rail exactly with p.y

      if (p.w <= 250) {
        ctx.drawImage(sprite.canvas, p.x - 4, topY, p.w + 8, bridgeH);
      } else {
        // Seamlessly tile the central ornate iron/stained-glass span across wide bridges
        const trimX = Math.round(sprite.width * 0.065);
        const midSrcW = sprite.width - trimX * 2;
        const tileW = Math.max(120, Math.round(bridgeH * (midSrcW / sprite.height)));
        ctx.save();
        ctx.beginPath();
        ctx.rect(p.x - 3, topY - 4, p.w + 6, bridgeH + 8);
        ctx.clip();
        for (let tx = p.x - 3; tx < p.x + p.w + 3; tx += tileW) {
          ctx.drawImage(
            sprite.canvas,
            trimX,
            0,
            midSrcW,
            sprite.height,
            tx,
            topY,
            tileW + 1,
            bridgeH
          );
        }
        ctx.restore();
      }

      // Crisp luminous walkable line + subtle drop-through chevron hints
      ctx.fillStyle = isCryptArea
        ? 'rgba(110, 231, 183, 0.72)'
        : isInvasionSide
          ? 'rgba(251, 113, 133, 0.65)'
          : 'rgba(253, 230, 138, 0.72)';
      ctx.fillRect(p.x + 2, p.y, p.w - 4, 2.2);

      const chevAlpha = 0.42 + 0.26 * Math.sin(time * 3.5);
      ctx.strokeStyle = isCryptArea
        ? `rgba(110, 231, 183, ${chevAlpha.toFixed(2)})`
        : isInvasionSide
          ? `rgba(251, 113, 133, ${chevAlpha.toFixed(2)})`
          : `rgba(186, 230, 253, ${chevAlpha.toFixed(2)})`;
      ctx.lineWidth = 1.6;
      for (let x = p.x + 42; x < p.x + p.w - 28; x += 84) {
        ctx.beginPath();
        ctx.moveTo(x - 4.5, p.y + 6);
        ctx.lineTo(x, p.y + 11);
        ctx.lineTo(x + 4.5, p.y + 6);
        ctx.stroke();
      }
    } else {
      // Fallback translucent glass strip before image decode
      const grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
      grad.addColorStop(0, isCryptArea ? 'rgba(52, 211, 153, 0.78)' : 'rgba(56, 189, 248, 0.76)');
      grad.addColorStop(1, 'rgba(12, 18, 34, 0.72)');
      ctx.fillStyle = grad;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.8;
      ctx.strokeRect(p.x, p.y, p.w, p.h);
    }
  } else {
    // Solid Stone Floor or Top-Nave Carved Battlement Bridge
    const isBattlement = p.style === 'battlement';

    if (isBattlement && art.platformStoneLedge) {
      // Elevated Top Nave: full sculpted Gothic flagstone deck + hanging carved stone corbel arches!
      const sprite = art.platformStoneLedge;
      const drawH = 60;
      const tileW = Math.max(140, Math.round(drawH * sprite.aspect));
      ctx.save();
      ctx.beginPath();
      ctx.rect(p.x, p.y - 5, p.w, drawH + 8);
      ctx.clip();
      for (let tx = p.x; tx < p.x + p.w; tx += tileW) {
        ctx.drawImage(sprite.canvas, tx, p.y - 4, tileW + 1, drawH);
      }
      // Subtle biome color glaze so Sanctum & Invasion wings stay atmospherically unified
      ctx.fillStyle = isCryptArea
        ? 'rgba(16, 185, 129, 0.08)'
        : isInvasionSide
          ? 'rgba(244, 63, 94, 0.09)'
          : 'rgba(56, 189, 248, 0.06)';
      ctx.fillRect(p.x, p.y - 4, p.w, 30);
      ctx.restore();

      // Crisp walkable highlight line & inked stone end caps
      ctx.fillStyle = isCryptArea
        ? 'rgba(110, 231, 183, 0.65)'
        : isInvasionSide
          ? 'rgba(251, 113, 133, 0.58)'
          : 'rgba(253, 230, 138, 0.62)';
      ctx.fillRect(p.x + 1, p.y, p.w - 2, 2.2);

      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 3);
      ctx.lineTo(p.x, p.y + p.h + 12);
      ctx.moveTo(p.x + p.w, p.y - 3);
      ctx.lineTo(p.x + p.w, p.y + p.h + 12);
      ctx.stroke();
    } else {
      // Deep Ground Floors: Tiled Carved Ashlar Substructure + Sculpted Flagstone-and-Gold Top Deck
      if (art.stonePattern) {
        ctx.save();
        ctx.fillStyle = art.stonePattern;
        ctx.fillRect(p.x, p.y, p.w, p.h);
        const glaze = ctx.createLinearGradient(p.x, p.y, p.x, p.y + Math.min(p.h, 130));
        if (isCryptArea) {
          glaze.addColorStop(0, 'rgba(16, 62, 54, 0.34)');
          glaze.addColorStop(0.45, 'rgba(10, 30, 32, 0.46)');
          glaze.addColorStop(1, 'rgba(5, 11, 14, 0.85)');
        } else if (isInvasionSide) {
          glaze.addColorStop(0, 'rgba(68, 22, 44, 0.34)');
          glaze.addColorStop(0.45, 'rgba(28, 14, 34, 0.48)');
          glaze.addColorStop(1, 'rgba(10, 7, 16, 0.86)');
        } else {
          glaze.addColorStop(0, 'rgba(34, 44, 68, 0.28)');
          glaze.addColorStop(0.45, 'rgba(16, 22, 38, 0.46)');
          glaze.addColorStop(1, 'rgba(8, 11, 20, 0.86)');
        }
        ctx.fillStyle = glaze;
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.restore();
      } else {
        const grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + Math.min(p.h, 96));
        grad.addColorStop(0, isCryptArea ? '#273A38' : isInvasionSide ? '#3B2F44' : '#3C445C');
        grad.addColorStop(1, '#121622');
        ctx.fillStyle = grad;
        ctx.fillRect(p.x, p.y, p.w, p.h);
      }

      // Sculpted beveled flagstone & antique gold filigree top cornice strip
      if (art.platformStoneLedge) {
        const sprite = art.platformStoneLedge;
        const capSrcH = Math.round(sprite.height * 0.54);
        const capDrawH = 34;
        const tileW = Math.max(120, Math.round(capDrawH * (sprite.width / capSrcH)));
        ctx.save();
        ctx.beginPath();
        ctx.rect(p.x, p.y - 4, p.w, capDrawH + 4);
        ctx.clip();
        for (let tx = p.x; tx < p.x + p.w; tx += tileW) {
          ctx.drawImage(
            sprite.canvas,
            0,
            0,
            sprite.width,
            capSrcH,
            tx,
            p.y - 4,
            tileW + 1,
            capDrawH
          );
        }
        ctx.restore();
      }

      // Crisp walkable top rim light so feet contact line reads instantly
      ctx.fillStyle = isCryptArea
        ? 'rgba(110, 231, 183, 0.65)'
        : isInvasionSide
          ? 'rgba(251, 113, 133, 0.55)'
          : 'rgba(253, 230, 138, 0.62)';
      ctx.fillRect(p.x, p.y, p.w, 2.4);

      ctx.strokeStyle = INK;
      ctx.lineWidth = 3.2;
      ctx.strokeRect(p.x, p.y, p.w, p.h);
    }
  }
  ctx.restore();
}

function drawJumpPad(
  ctx: CanvasRenderingContext2D,
  jp: { x: number; y: number; w: number; color: string },
  time: number,
  playerHero?: HeroEntity,
  sprite?: ProcessedSprite | null
): void {
  const playerOver =
    Boolean(playerHero && playerHero.alive && !playerHero.inDropPod) &&
    playerHero!.x + playerHero!.w * 0.45 > jp.x &&
    playerHero!.x - playerHero!.w * 0.45 < jp.x + jp.w &&
    playerHero!.y + playerHero!.h / 2 >= jp.y - 16 &&
    playerHero!.y + playerHero!.h / 2 <= jp.y + 28;

  ctx.save();
  const cx = jp.x + jp.w / 2;

  // Vertical soft gravity well beam (intensifies when player stands ready on pad)
  const beamH = playerOver ? 88 : 64;
  const bGrad = ctx.createLinearGradient(0, jp.y, 0, jp.y - beamH);
  bGrad.addColorStop(0, playerOver ? `${jp.color}78` : `${jp.color}36`);
  bGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bGrad;
  ctx.fillRect(jp.x + 8, jp.y - beamH, jp.w - 16, beamH);

  // Rising vertical updraft air streaks inside gravity well
  ctx.strokeStyle = playerOver ? '#FEF08A' : jp.color;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) {
    const sp = (time * (playerOver ? 3.8 : 2.2) + i * 0.27) % 1;
    const sx = jp.x + 14 + ((i * 23) % Math.max(18, jp.w - 28));
    const sy = jp.y - 4 - sp * (beamH - 12);
    ctx.globalAlpha = (1 - sp) * (playerOver ? 0.85 : 0.45);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx, sy - 14);
    ctx.stroke();
  }

  // Expanding concentric launch ripples when player is primed on pad
  if (playerOver) {
    for (let i = 0; i < 2; i++) {
      const rp = (time * 2.4 + i * 0.5) % 1;
      ctx.strokeStyle = '#FDE047';
      ctx.globalAlpha = (1 - rp) * 0.78;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, jp.y + 2, 16 + rp * (jp.w * 0.56), 4 + rp * 8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Rising runic gravity chevrons
  for (let i = 0; i < 3; i++) {
    const phase = (time * (playerOver ? 3.2 : 2.1) + i * 0.33) % 1;
    const cy = jp.y - 10 - phase * (playerOver ? 68 : 52);
    ctx.strokeStyle = playerOver ? '#FDE047' : jp.color;
    ctx.globalAlpha = (1 - phase) * (playerOver ? 1 : 0.78);
    ctx.lineWidth = playerOver ? 3.4 : 2.6;
    ctx.beginPath();
    ctx.moveTo(cx - 17, cy + 7);
    ctx.lineTo(cx, cy - 3);
    ctx.lineTo(cx + 17, cy + 7);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  if (sprite) {
    // Hand-inked carved stone & brass winged runic jump pad dais
    const drawW = jp.w + 34;
    const drawH = drawW / sprite.aspect;
    const bottomY = jp.y + 18;
    ctx.drawImage(sprite.canvas, cx - drawW / 2, bottomY - drawH, drawW, drawH);

    // Live pulsing faction/biome rune core shimmer on top of the dais
    const coreGlow = ctx.createRadialGradient(cx, jp.y + 2, 2, cx, jp.y + 2, 22);
    coreGlow.addColorStop(0, playerOver ? '#FEF08A' : jp.color);
    coreGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = playerOver ? 0.9 : 0.55 + 0.25 * Math.sin(time * 5);
    ctx.fillStyle = coreGlow;
    ctx.beginPath();
    ctx.arc(cx, jp.y + 2, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    ctx.fillStyle = '#1B2234';
    ctx.strokeStyle = playerOver ? '#FDE047' : INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.roundRect(jp.x, jp.y, jp.w, 16, [6, 6, 0, 0]);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = playerOver ? '#FDE047' : jp.color;
    ctx.fillRect(jp.x + 8, jp.y + 2, jp.w - 16, 5);
  }

  if (playerOver) {
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(7, 9, 16, 0.92)';
    ctx.beginPath();
    ctx.roundRect(cx - 34, jp.y - 36, 68, 17, 4);
    ctx.fill();
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#FDE047';
    ctx.fillText('JUMP [W]', cx, jp.y - 24);
  }
  ctx.restore();
}

function drawRelicShard(
  ctx: CanvasRenderingContext2D,
  sc: SolarCubeEntity,
  time: number,
  sprite?: ProcessedSprite | null
): void {
  const bob = Math.sin(time * 3.4 + sc.bobPhase) * 5;
  const x = sc.x;
  const y = sc.y + bob;
  const r = sc.value >= 16 ? 12 : 9.5;

  ctx.save();
  const aura = ctx.createRadialGradient(x, y, 3, x, y, r + 14);
  aura.addColorStop(0, 'rgba(251, 191, 36, 0.42)');
  aura.addColorStop(1, 'rgba(245, 158, 11, 0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(x, y, r + 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(x, y);
  ctx.rotate(Math.sin(time * 2.2 + sc.bobPhase) * 0.14);

  if (sprite) {
    const drawH = sc.value >= 16 ? 38 : 30;
    const drawW = drawH * sprite.aspect;
    ctx.drawImage(sprite.canvas, -drawW / 2, -drawH / 2, drawW, drawH);
  } else {
    ctx.fillStyle = '#F59E0B';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.85, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.85, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Rotating 4-point star crystal glint + orbiting relic dust
  const glint = 0.55 + 0.45 * Math.sin(time * 5.2 + sc.bobPhase);
  ctx.save();
  ctx.rotate(time * 1.6 + sc.bobPhase);
  ctx.fillStyle = `rgba(254, 249, 195, ${(0.85 * glint).toFixed(2)})`;
  const glLen = (sc.value >= 16 ? 9 : 7) * glint;
  ctx.beginPath();
  ctx.moveTo(0, -glLen);
  ctx.lineTo(1.8, -1.8);
  ctx.lineTo(glLen, 0);
  ctx.lineTo(1.8, 1.8);
  ctx.lineTo(0, glLen);
  ctx.lineTo(-1.8, 1.8);
  ctx.lineTo(-glLen, 0);
  ctx.lineTo(-1.8, -1.8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  for (let i = 0; i < 2; i++) {
    const oa = time * 2.8 + sc.bobPhase + i * Math.PI;
    ctx.fillStyle = '#FDE68A';
    ctx.globalAlpha = 0.72;
    ctx.beginPath();
    ctx.arc(Math.cos(oa) * (r + 5), Math.sin(oa) * (r * 0.55), 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCryptSpirit(
  ctx: CanvasRenderingContext2D,
  c: NeutralCreepEntity,
  time: number,
  sprite: ProcessedSprite | null
): void {
  const bob = Math.sin(time * 4 + c.bobPhase) * 4.5;
  ctx.save();
  ctx.translate(c.x, c.y + bob);

  // Soft spectral jade aura
  const aura = ctx.createRadialGradient(0, 0, 6, 0, 0, 36);
  aura.addColorStop(0, 'rgba(16, 185, 129, 0.38)');
  aura.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, 36, 0, Math.PI * 2);
  ctx.fill();

  // Orbiting spectral soul wisps trailing beneath spirit
  for (let i = 0; i < 3; i++) {
    const wa = time * 3.1 + c.bobPhase + (i * Math.PI * 2) / 3;
    const wx = Math.cos(wa) * 21;
    const wy = 10 + Math.sin(wa * 1.4) * 9;
    ctx.fillStyle = i === 0 ? '#6EE7B7' : '#34D399';
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.arc(wx, wy, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (sprite) {
    const drawH = 62;
    const drawW = drawH * sprite.aspect;
    ctx.save();
    ctx.rotate(Math.sin(time * 3 + c.bobPhase) * 0.06);
    ctx.drawImage(sprite.canvas, -drawW / 2, -drawH / 2 - 4, drawW, drawH);
    if (c.hitFlashTimer > 0) {
      ctx.globalAlpha = 0.72;
      ctx.drawImage(sprite.flashCanvas, -drawW / 2, -drawH / 2 - 4, drawW, drawH);
    }
    ctx.restore();
  } else {
    ctx.fillStyle = c.hitFlashTimer > 0 ? '#FFFFFF' : '#10B981';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, -2, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  if (c.hp < c.maxHp) {
    drawCompactBar(ctx, 0, -39, 38, 5, c.hp / c.maxHp, '#34D399');
  }
  ctx.restore();
}

/* =========================================================================
   2-TIER RELIQUARY TOWERS & ANCIENT CORES
   ========================================================================= */

function drawReliquaryTower(
  ctx: CanvasRenderingContext2D,
  t: TurretEntity,
  time: number,
  playerHero?: HeroEntity,
  sprite?: ProcessedSprite | null
): void {
  const isBlue = t.team === 'blue';
  const isInner = t.tier === 'inner';
  const teamCol = isBlue ? '#38BDF8' : '#F43F5E';

  ctx.save();
  if (!t.alive) {
    // Crumbled gothic ruin plinth + smoldering ash wisps
    ctx.fillStyle = '#1E2332';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(t.x - 36, t.y);
    ctx.lineTo(t.x - 24, t.y - 28);
    ctx.lineTo(t.x - 4, t.y - 16);
    ctx.lineTo(t.x + 12, t.y - 24);
    ctx.lineTo(t.x + 34, t.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const sp = (time * 0.45 + i * 0.33 + t.x * 0.01) % 1;
      const sx = t.x - 14 + i * 14 + Math.sin(time * 1.8 + i) * 6;
      const sy = t.y - 22 - sp * 46;
      ctx.fillStyle = i === 1 ? 'rgba(251, 146, 60, 0.55)' : 'rgba(148, 163, 184, 0.25)';
      ctx.globalAlpha = 1 - sp;
      ctx.beginPath();
      ctx.arc(sx, sy, i === 1 ? 2.2 : 5 + sp * 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  // Range warning circle when player approaches enemy tower
  if (playerHero && playerHero.alive && playerHero.team !== t.team) {
    const dist = Math.hypot(playerHero.x - t.x, playerHero.y - (t.y - 52));
    if (dist < t.range + 150) {
      ctx.save();
      ctx.strokeStyle = dist < t.range ? 'rgba(244, 63, 94, 0.48)' : 'rgba(244, 63, 94, 0.16)';
      ctx.setLineDash([8, 8]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(t.x, t.y - 52, t.range, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  const h = isInner ? 168 : 142;
  const headY = t.y - h * 0.84;

  // Faction ambient energy glow behind stained glass & spire
  const towerGlow = ctx.createRadialGradient(t.x, t.y - h * 0.5, 10, t.x, t.y - h * 0.5, isInner ? 82 : 68);
  towerGlow.addColorStop(0, isBlue ? 'rgba(56, 189, 248, 0.34)' : 'rgba(244, 63, 94, 0.36)');
  towerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = towerGlow;
  ctx.beginPath();
  ctx.arc(t.x, t.y - h * 0.5, isInner ? 82 : 68, 0, Math.PI * 2);
  ctx.fill();

  if (sprite) {
    const drawW = h * sprite.aspect;
    ctx.drawImage(sprite.canvas, t.x - drawW / 2, t.y - h + 4, drawW, h);
    if (t.hitFlashTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.65;
      ctx.drawImage(sprite.flashCanvas, t.x - drawW / 2, t.y - h + 4, drawW, h);
      ctx.restore();
    }

    // Faction stained-glass radiance overlay + plinth banner strip for instant Blue vs Red clarity
    const pulse = 0.6 + 0.3 * Math.sin(time * 4.5);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const orbGrad = ctx.createRadialGradient(t.x, headY, 2, t.x, headY, isInner ? 26 : 21);
    orbGrad.addColorStop(0, '#FFFFFF');
    orbGrad.addColorStop(0.35, teamCol);
    orbGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = pulse;
    ctx.fillStyle = orbGrad;
    ctx.beginPath();
    ctx.arc(t.x, headY, isInner ? 26 : 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Faction base collar bar so ally vs enemy tower is unmistakable
    ctx.fillStyle = teamCol;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.fillRect(t.x - drawW * 0.34, t.y - 7, drawW * 0.68, 6);
    ctx.strokeRect(t.x - drawW * 0.34, t.y - 7, drawW * 0.68, 6);
  } else {
    const baseW = isInner ? 40 : 34;
    ctx.fillStyle = t.hitFlashTimer > 0 ? '#FFFFFF' : isBlue ? '#242B40' : '#2D1E30';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(t.x - baseW, t.y);
    ctx.lineTo(t.x - baseW * 0.72, t.y - h * 0.75);
    ctx.lineTo(t.x + baseW * 0.72, t.y - h * 0.75);
    ctx.lineTo(t.x + baseW, t.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Spinning carved rune halo around spire head
  ctx.save();
  ctx.translate(t.x, headY);
  ctx.rotate(time * (isInner ? -1.4 : 1.1));
  ctx.strokeStyle = isBlue ? 'rgba(56, 189, 248, 0.55)' : 'rgba(244, 63, 94, 0.55)';
  ctx.lineWidth = 1.8;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.arc(0, 0, isInner ? 28 : 22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Inner Tower Orbiting Golden Astrolabe Ring
  if (isInner) {
    ctx.save();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.ellipse(t.x, headY, 38, 11, Math.sin(time * 1.4) * 0.35, 0, Math.PI * 2);
    ctx.stroke();
    const oa = time * 2.6;
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(t.x + Math.cos(oa) * 38, headY + Math.sin(oa) * 11, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Damage state smoke & crackling sparks when tower HP drops below 50%
  const hpRatio = t.hp / t.maxHp;
  if (!t.shielded && hpRatio < 0.55) {
    const count = hpRatio < 0.28 ? 5 : 3;
    for (let i = 0; i < count; i++) {
      const p = (time * (hpRatio < 0.28 ? 1.15 : 0.72) + i * (1 / count) + t.x * 0.01) % 1;
      const sx = t.x + Math.sin(time * 3 + i * 2.1) * 18;
      const sy = t.y - h * (0.28 + (i % 3) * 0.2) - p * 44;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(30, 41, 59, 0.6)' : '#F97316';
      ctx.globalAlpha = (1 - p) * (i % 2 === 0 ? 0.65 : 0.92);
      ctx.beginPath();
      ctx.arc(sx, sy, i % 2 === 0 ? 5 + p * 7 : 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Subtle arcane aiming pointer + faint targeting beam at crystal reliquary focus
  ctx.save();
  ctx.translate(t.x, headY);
  ctx.rotate(t.aimAngle);
  if (t.attackCd > 0.45) {
    ctx.strokeStyle = isBlue ? 'rgba(56, 189, 248, 0.28)' : 'rgba(244, 63, 94, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(26, 0);
    ctx.lineTo(135, 0);
    ctx.stroke();
  }
  ctx.fillStyle = teamCol;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(28, 0);
  ctx.lineTo(15, -5.5);
  ctx.lineTo(18, 0);
  ctx.lineTo(15, 5.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Inner Tower Protective Barrier Dome with rotating runic shield arcs
  if (t.shielded) {
    ctx.save();
    ctx.strokeStyle = '#FBBF24';
    ctx.fillStyle = 'rgba(251, 191, 36, 0.1)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(t.x, t.y - h * 0.48, 78, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const a = time * 1.1 + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(t.x, t.y - h * 0.48, 82, a, a + 0.72);
      ctx.stroke();
    }

    ctx.font = '700 10px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FDE68A';
    ctx.fillText('SHIELDED (DESTROY OUTER)', t.x, t.y - h - 14);
    ctx.restore();
  } else {
    drawCompactBar(
      ctx,
      t.x,
      t.y - h - 14,
      82,
      8,
      hpRatio,
      teamCol,
      `${isInner ? 'INNER' : 'OUTER'} ${Math.ceil(t.hp)}`
    );
  }
  ctx.restore();
}

function drawAncientCore(
  ctx: CanvasRenderingContext2D,
  core: CoreDrillEntity,
  time: number,
  sprite?: ProcessedSprite | null,
  endCinematic?: EndCinematicRenderState | null
): void {
  const isBlue = core.team === 'blue';
  const teamCol = isBlue ? '#38BDF8' : '#F43F5E';
  const coreH = 228;
  const heartY = core.y - coreH * 0.53;
  const isShattered = core.hp <= 0;

  ctx.save();

  // Shattered Core Breach Sequence when hp <= 0 (Cinematic Collapse!)
  if (isShattered) {
    const shatterT = endCinematic ? Math.min(1, endCinematic.elapsed / 1.45) : 1;
    const collapseDrop = shatterT * 28;
    const jitterX = shatterT < 0.85 ? Math.sin(time * 62) * (1 - shatterT) * 7 : 0;

    // Blinding Core Breach Light Shafts erupting skyward
    const rayAlpha = 0.25 + 0.35 * Math.sin(time * 5.2);
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI * 0.88 + (i / 5) * Math.PI * 0.76 + Math.sin(time * 1.4 + i) * 0.05;
      ctx.save();
      ctx.translate(core.x, heartY + 12);
      ctx.rotate(a);
      const rg = ctx.createLinearGradient(0, 0, 260 + shatterT * 140, 0);
      rg.addColorStop(0, `rgba(254, 240, 138, ${(rayAlpha * 0.95).toFixed(2)})`);
      rg.addColorStop(0.45, isBlue ? 'rgba(56, 189, 248, 0.34)' : 'rgba(244, 63, 94, 0.36)');
      rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(260 + shatterT * 140, -34);
      ctx.lineTo(260 + shatterT * 140, 34);
      ctx.lineTo(0, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Sinking/splitting Core ruin silhouette
    if (sprite) {
      const drawW = coreH * sprite.aspect;
      ctx.save();
      ctx.globalAlpha = Math.max(0.32, 1 - shatterT * 0.55);
      // Left cracked half tilting outward
      ctx.save();
      ctx.translate(core.x - 10 * shatterT + jitterX, core.y + collapseDrop);
      ctx.rotate(-0.14 * shatterT);
      ctx.beginPath();
      ctx.rect(-drawW, -coreH - 20, drawW, coreH + 30);
      ctx.clip();
      ctx.drawImage(sprite.canvas, -drawW / 2, -coreH + 5, drawW, coreH);
      ctx.restore();
      // Right cracked half tilting outward
      ctx.save();
      ctx.translate(core.x + 10 * shatterT - jitterX, core.y + collapseDrop);
      ctx.rotate(0.14 * shatterT);
      ctx.beginPath();
      ctx.rect(0, -coreH - 20, drawW, coreH + 30);
      ctx.clip();
      ctx.drawImage(sprite.canvas, -drawW / 2, -coreH + 5, drawW, coreH);
      ctx.restore();
      ctx.restore();
    }

    // Glowing crater fissure & shockwave rings
    const craterGlow = ctx.createRadialGradient(core.x, core.y - 18, 10, core.x, core.y - 18, 155);
    craterGlow.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    craterGlow.addColorStop(0.32, 'rgba(251, 191, 36, 0.55)');
    craterGlow.addColorStop(0.68, isBlue ? 'rgba(56, 189, 248, 0.25)' : 'rgba(244, 63, 94, 0.28)');
    craterGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = craterGlow;
    ctx.beginPath();
    ctx.arc(core.x, core.y - 18, 155, 0, Math.PI * 2);
    ctx.fill();

    // Expanding crystal fracture ring
    const ringPhase = (time * 1.15) % 1;
    ctx.strokeStyle = `rgba(254, 240, 138, ${(1 - ringPhase).toFixed(2)})`;
    ctx.lineWidth = 4 * (1 - ringPhase) + 1;
    ctx.beginPath();
    ctx.arc(core.x, heartY + 12, 32 + ringPhase * 150, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
    return;
  }

  // Monumental ambient sanctum radiance behind the Core
  const glow = ctx.createRadialGradient(core.x, heartY, 16, core.x, heartY, 130);
  glow.addColorStop(0, isBlue ? 'rgba(56, 189, 248, 0.35)' : 'rgba(244, 63, 94, 0.36)');
  glow.addColorStop(0.55, 'rgba(245, 158, 11, 0.14)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(core.x, heartY, 130, 0, Math.PI * 2);
  ctx.fill();

  if (sprite) {
    const drawW = coreH * sprite.aspect;
    ctx.drawImage(sprite.canvas, core.x - drawW / 2, core.y - coreH + 5, drawW, coreH);
    if (core.hitFlashTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.65;
      ctx.drawImage(sprite.flashCanvas, core.x - drawW / 2, core.y - coreH + 5, drawW, coreH);
      ctx.restore();
    }

    // Faction banner base trim
    ctx.fillStyle = teamCol;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.fillRect(core.x - drawW * 0.36, core.y - 10, drawW * 0.72, 8);
    ctx.strokeRect(core.x - drawW * 0.36, core.y - 10, drawW * 0.72, 8);
  } else {
    ctx.fillStyle = core.hitFlashTimer > 0 ? '#FFFFFF' : isBlue ? '#192136' : '#261729';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(core.x - 64, core.y);
    ctx.lineTo(core.x - 50, core.y - 138);
    ctx.lineTo(core.x, core.y - 178);
    ctx.lineTo(core.x + 50, core.y - 138);
    ctx.lineTo(core.x + 64, core.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Ascending Cathedral Beacon Beam pulsing skyward from Core
  const beaconW = 34 + Math.sin(time * 2.8) * 6;
  const beaconGrad = ctx.createLinearGradient(core.x - beaconW, 0, core.x + beaconW, 0);
  beaconGrad.addColorStop(0, 'rgba(0,0,0,0)');
  beaconGrad.addColorStop(0.5, isBlue ? 'rgba(56, 189, 248, 0.16)' : 'rgba(244, 63, 94, 0.16)');
  beaconGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = beaconGrad;
  ctx.fillRect(core.x - beaconW, 0, beaconW * 2, heartY);

  // Dual Counter-Rotating Golden & Faction Astrolabe Rings + Orbiting Gemstone Nodes
  const bob = Math.sin(time * 3.2) * 4;
  const a1 = time * 0.65;
  const a2 = -time * 0.85;
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.ellipse(core.x, heartY + bob, 56, 17, a1, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = teamCol;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.ellipse(core.x, heartY + bob, 50, 15, a2, 0, Math.PI * 2);
  ctx.stroke();

  // Orbiting glowing astrolabe gemstones
  for (let i = 0; i < 2; i++) {
    const theta = time * 2.2 + i * Math.PI;
    const lx = Math.cos(theta) * 56;
    const ly = Math.sin(theta) * 17;
    const rx = lx * Math.cos(a1) - ly * Math.sin(a1);
    const ry = lx * Math.sin(a1) + ly * Math.cos(a1);
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(core.x + rx, heartY + bob + ry, 3.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Crackle sparks & rising smoke when Core HP < 55%
  const coreRatio = core.hp / core.maxHp;
  if (!core.shielded && coreRatio < 0.55) {
    const count = coreRatio < 0.25 ? 7 : 4;
    for (let i = 0; i < count; i++) {
      const p = (time * 1.1 + i * (1 / count)) % 1;
      const sx = core.x + Math.sin(time * 4 + i * 1.9) * 32;
      const sy = heartY + 20 - p * 85;
      ctx.fillStyle = i % 2 === 0 ? '#FB923C' : '#FEF08A';
      ctx.globalAlpha = 1 - p;
      ctx.beginPath();
      ctx.arc(sx, sy, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  if (core.shielded) {
    const pulse = 0.55 + 0.3 * Math.sin(time * 4);
    ctx.strokeStyle = teamCol;
    ctx.fillStyle = isBlue ? 'rgba(56, 189, 248, 0.14)' : 'rgba(244, 63, 94, 0.14)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(core.x, heartY + 12, 114, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = pulse;
    ctx.stroke();

    // Rotating segmented barrier arcs
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = '#FDE68A';
    ctx.lineWidth = 2.8;
    for (let i = 0; i < 4; i++) {
      const sa = -time * 0.9 + (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.arc(core.x, heartY + 12, 119, sa, sa + 0.55);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText('SHIELDED — DESTROY AN INNER TOWER', core.x, core.y - coreH - 14);
  } else {
    drawCompactBar(
      ctx,
      core.x,
      core.y - coreH - 14,
      138,
      11,
      coreRatio,
      teamCol,
      `ANCIENT CORE ${Math.ceil(core.hp)}`
    );
  }
  ctx.restore();
}

/* =========================================================================
   HAZARDS, CHAIN HOOK & EVOLVING TIERED LANE CREEPS / BONE-BORGS
   ========================================================================= */

function drawHazardZone(ctx: CanvasRenderingContext2D, hz: HazardZoneEntity, time: number): void {
  ctx.save();
  if (hz.kind === 'orbital_smite') {
    const progress = hz.triggered ? 1 : Math.max(0, 1 - hz.timer / hz.maxTimer);
    if (hz.triggered) {
      const grad = ctx.createLinearGradient(hz.x - hz.radius, 0, hz.x + hz.radius, 0);
      grad.addColorStop(0, 'rgba(45, 212, 191, 0)');
      grad.addColorStop(0.22, 'rgba(45, 212, 191, 0.82)');
      grad.addColorStop(0.5, 'rgba(240, 253, 250, 0.98)');
      grad.addColorStop(0.78, 'rgba(45, 212, 191, 0.82)');
      grad.addColorStop(1, 'rgba(45, 212, 191, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(hz.x - hz.radius, 0, hz.radius * 2, hz.y + 40);

      // Ground impact shockwave ring
      ctx.strokeStyle = '#CCFBF1';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.ellipse(hz.x, hz.y, hz.radius * 1.08, hz.radius * 0.28, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(45, 212, 191, 0.55)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(hz.x, 0);
      ctx.lineTo(hz.x, hz.y);
      ctx.stroke();

      ctx.fillStyle = `rgba(45, 212, 191, ${(0.08 + progress * 0.26).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(hz.x, hz.y, hz.radius * progress, 0, Math.PI * 2);
      ctx.fill();

      // Rotating orbital lock reticle brackets
      ctx.save();
      ctx.translate(hz.x, hz.y);
      ctx.rotate(time * 3.2);
      ctx.strokeStyle = '#2DD4BF';
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, hz.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  } else if (hz.kind === 'singularity') {
    ctx.translate(hz.x, hz.y);
    const grad = ctx.createRadialGradient(0, 0, 8, 0, 0, hz.radius);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.96)');
    grad.addColorStop(0.35, 'rgba(129, 140, 248, 0.45)');
    grad.addColorStop(0.75, 'rgba(56, 189, 248, 0.16)');
    grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, hz.radius, 0, Math.PI * 2);
    ctx.fill();

    // Inward-spiraling gravity debris streaks
    for (let i = 0; i < 6; i++) {
      const p = (time * 1.4 + i * 0.17) % 1;
      const dist = (1 - p) * hz.radius * 0.92;
      const a = i * 1.05 - time * 5.2 - p * 2.2;
      ctx.fillStyle = i % 2 === 0 ? '#A5B4FC' : '#38BDF8';
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.85;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * dist, Math.sin(a) * dist, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.rotate(-time * 6.5);
    ctx.strokeStyle = '#818CF8';
    ctx.lineWidth = 2.8;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.arc(0, 0, hz.radius * (0.35 + (i % 2) * 0.32), a, a + 1.15);
      ctx.stroke();
    }
    ctx.fillStyle = '#020617';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (hz.kind === 'plague_cloud') {
    // Plague-Cantor Vespra's lingering Miasma Censer toxic cloud
    ctx.translate(hz.x, hz.y);
    const fade = Math.min(1, hz.timer * 1.6);
    ctx.globalAlpha = fade;
    const mGrad = ctx.createRadialGradient(0, 0, 14, 0, 0, hz.radius);
    mGrad.addColorStop(0, 'rgba(132, 204, 22, 0.42)');
    mGrad.addColorStop(0.58, 'rgba(16, 185, 129, 0.24)');
    mGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = mGrad;
    ctx.beginPath();
    ctx.arc(0, 0, hz.radius, 0, Math.PI * 2);
    ctx.fill();

    // Swirling layered venom mist lobes
    for (let i = 0; i < 5; i++) {
      const a = time * (i % 2 === 0 ? 0.9 : -0.7) + (i * Math.PI * 2) / 5;
      const dist = hz.radius * 0.38;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(132, 204, 22, 0.16)' : 'rgba(5, 150, 105, 0.18)';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * dist, Math.sin(a) * dist * 0.68, hz.radius * 0.36, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rising bursting acid bubbles
    for (let i = 0; i < 7; i++) {
      const bp = (time * 1.1 + i * 0.145) % 1;
      const bx = Math.cos(i * 2.4 + hz.x * 0.02) * hz.radius * 0.65;
      const by = hz.radius * 0.35 - bp * hz.radius * 0.95;
      ctx.strokeStyle = '#BEF264';
      ctx.fillStyle = 'rgba(132, 204, 22, 0.35)';
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = fade * (1 - bp) * 0.9;
      ctx.beginPath();
      ctx.arc(bx, by, 3 + bp * 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Occult rotating dashed perimeter ring
    ctx.globalAlpha = fade * 0.85;
    ctx.strokeStyle = hz.team === 'blue' ? '#84CC16' : '#A3E635';
    ctx.lineWidth = 2.6;
    ctx.setLineDash([10, 7]);
    ctx.beginPath();
    ctx.arc(0, 0, hz.radius, time * 1.4, time * 1.4 + Math.PI * 2);
    ctx.stroke();
  } else if (hz.kind === 'solar_flare') {
    // Solarion Vale's Sundial Flare radiant conflagration ring
    ctx.translate(hz.x, hz.y);
    const fade = Math.min(1, hz.timer * 1.8);
    ctx.globalAlpha = fade;
    const sGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, hz.radius);
    sGrad.addColorStop(0, 'rgba(254, 240, 138, 0.48)');
    sGrad.addColorStop(0.55, 'rgba(245, 158, 11, 0.28)');
    sGrad.addColorStop(0.85, 'rgba(56, 189, 248, 0.16)');
    sGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = sGrad;
    ctx.beginPath();
    ctx.arc(0, 0, hz.radius, 0, Math.PI * 2);
    ctx.fill();

    // Rotating sundial clockwork spokes & concentric brass-gold rings
    ctx.save();
    ctx.rotate(time * 2.2);
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.78)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, hz.radius * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const sa = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(sa) * 16, Math.sin(sa) * 16);
      ctx.lineTo(Math.cos(sa) * hz.radius * 0.94, Math.sin(sa) * hz.radius * 0.94);
      ctx.stroke();
    }
    ctx.restore();

    // Flickering outer solar flame tongues
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, hz.radius, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = -time * 2.8 + (i * Math.PI) / 4;
      const flicker = 0.75 + 0.35 * Math.sin(time * 14 + i * 1.7);
      ctx.fillStyle = i % 2 === 0 ? '#FEF08A' : '#38BDF8';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * hz.radius * 0.95, Math.sin(a) * hz.radius * 0.95, 4.2 * flicker, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawChainHook(ctx: CanvasRenderingContext2D, hk: HookEntity, time: number): void {
  ctx.save();
  const dx = hk.x - hk.startX;
  const dy = hk.y - hk.startY;
  const dist = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);

  // Energy pulse running down chain links
  const pulsePos = (time * 4.5) % 1;

  // Heavy forged iron links
  const linkStep = 17;
  const steps = Math.max(1, Math.floor(dist / linkStep));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lx = hk.startX + dx * t;
    const ly = hk.startY + dy * t;
    const nearPulse = Math.abs(t - pulsePos) < 0.14;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(angle);
    ctx.strokeStyle = nearPulse ? '#34D399' : i % 2 === 0 ? '#E2E8F0' : '#64748B';
    ctx.fillStyle = '#0F172A';
    ctx.lineWidth = nearPulse ? 3.2 : 2.8;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Barbed Abyssal Cyber-Claw Head
  ctx.translate(hk.x, hk.y);
  ctx.rotate(angle);
  if (hk.latchedTargetId) {
    ctx.strokeStyle = '#6EE7B7';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, 22 + Math.sin(time * 24) * 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = hk.latchedTargetId ? '#34D399' : '#CBD5E1';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-4, -17);
  ctx.lineTo(3, -5);
  ctx.lineTo(-11, -5);
  ctx.lineTo(-11, 5);
  ctx.lineTo(3, 5);
  ctx.lineTo(-4, 17);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#10B981';
  ctx.beginPath();
  ctx.arc(3, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDroid(
  ctx: CanvasRenderingContext2D,
  d: DroidEntity,
  time: number,
  trooperSprite: ProcessedSprite | null,
  boneBorgSprite: ProcessedSprite | null
): void {
  const isBlue = d.team === 'blue';
  const isBoneBorg = d.id.startsWith('borg_');
  const primary = isBoneBorg ? '#2DD4BF' : isBlue ? '#38BDF8' : '#F43F5E';
  const scale = d.tier >= 5 ? 1.24 : d.tier >= 3 ? 1.1 : 1;
  const isMoving = Math.abs(d.vx) > 8;
  const stridePhase = d.walkCycle * 1.35;
  const strideBob = isMoving ? Math.abs(Math.sin(stridePhase)) * 2.4 : 0;
  const strideRock = isMoving ? Math.sin(stridePhase) * 0.032 : 0;
  const f = d.facing;

  ctx.save();
  ctx.translate(d.x, d.y);

  // Team ground ring so Blue vs Red waves read instantaneously
  ctx.fillStyle = isBoneBorg
    ? 'rgba(45, 212, 191, 0.28)'
    : isBlue
      ? 'rgba(56, 189, 248, 0.34)'
      : 'rgba(244, 63, 94, 0.36)';
  ctx.beginPath();
  ctx.ellipse(0, 17, 17 * scale, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  const activeSprite = isBoneBorg ? boneBorgSprite : trooperSprite;
  const firingKick = d.attackCd > 0.72 ? -0.09 : 0;
  const drawH = (isBoneBorg ? 52 : 54) * scale;

  if (activeSprite) {
    const drawW = drawH * activeSprite.aspect;

    ctx.save();
    ctx.translate(0, 18 - strideBob);
    ctx.scale(f, 1);
    ctx.rotate(strideRock + firingKick);

    ctx.drawImage(activeSprite.canvas, -drawW / 2, -drawH, drawW, drawH);
    if (d.hitFlashTimer > 0) {
      ctx.globalAlpha = 0.72;
      ctx.drawImage(activeSprite.flashCanvas, -drawW / 2, -drawH, drawW, drawH);
      ctx.globalAlpha = 1;
    }

    // Faction shoulder pennant / visor glow indicator + muzzle flash when firing
    if (!isBoneBorg) {
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.arc(drawW * 0.06, -drawH * 0.76, 3.2 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    if (d.attackCd > 0.74) {
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(drawW * 0.42, -drawH * 0.45, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Tier 5+ Radiant Golden Halo Crown above elite cathedral troopers
    if (!isBoneBorg && d.tier >= 5) {
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(0, 14 - drawH - strideBob, 12, 3.8, 0, 0, Math.PI * 2);
      ctx.stroke();
      const sa = time * 4.2;
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(Math.cos(sa) * 12, 14 - drawH - strideBob + Math.sin(sa) * 3.8, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Instant fallback before image decode finishes
    ctx.save();
    ctx.scale(scale, scale);
    ctx.fillStyle = d.hitFlashTimer > 0 ? '#FFFFFF' : isBlue ? '#1E293B' : '#2A1829';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-13, -15, 26, 25, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = primary;
    ctx.fillRect(-13, -13, 26, 6);
    ctx.restore();
  }

  // Droid Status FX: Venom DoT bubbles, Solar Burn flames, Slow ring
  if (d.slowTimer > 0) {
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, 16, 18 * scale, 5.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (d.venomStacks > 0) {
    for (let i = 0; i < Math.min(3, d.venomStacks); i++) {
      const vp = (time * 2.1 + i * 0.34 + d.x * 0.01) % 1;
      ctx.fillStyle = '#84CC16';
      ctx.globalAlpha = 1 - vp;
      ctx.beginPath();
      ctx.arc((i - 1) * 9, 8 - vp * 38, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (d.burnTimer > 0) {
    for (let i = 0; i < 2; i++) {
      const fp = (time * 3.2 + i * 0.5 + d.x * 0.01) % 1;
      ctx.fillStyle = i === 0 ? '#FBBF24' : '#F97316';
      ctx.globalAlpha = 1 - fp;
      ctx.beginPath();
      ctx.arc((i === 0 ? -7 : 7), 4 - fp * 34, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  const barY = activeSprite ? 8 - drawH : -28;
  if (d.hp < d.maxHp || d.venomStacks > 0 || d.burnTimer > 0) {
    drawCompactBar(ctx, 0, barY, 34, 4.5, d.hp / d.maxHp, primary);
    if (d.venomStacks > 0) {
      ctx.font = '800 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#BEF264';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.strokeText(`×${d.venomStacks}`, 20, barY + 5);
      ctx.fillText(`×${d.venomStacks}`, 20, barY + 5);
    }
  }
  ctx.restore();
}

function drawDropPodSequence(
  ctx: CanvasRenderingContext2D,
  h: HeroEntity,
  time: number,
  art: ArenaArtAssets
): void {
  for (const s of h.dropPodSolars) {
    if (s.collected) continue;
    ctx.save();
    if (art.relicShard) {
      const shH = 28;
      const shW = shH * art.relicShard.aspect;
      ctx.drawImage(art.relicShard.canvas, s.x - shW / 2, s.y - shH / 2, shW, shH);
    } else {
      ctx.fillStyle = '#F59E0B';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - 9);
      ctx.lineTo(s.x + 8, s.y);
      ctx.lineTo(s.x, s.y + 9);
      ctx.lineTo(s.x - 8, s.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.save();
  ctx.translate(h.dropPodX, h.dropPodY);
  const flameH = 54 + Math.sin(time * 40) * 12;
  const fGrad = ctx.createLinearGradient(0, -18, 0, -flameH - 34);
  fGrad.addColorStop(0, '#FEF08A');
  fGrad.addColorStop(0.5, '#F97316');
  fGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
  ctx.fillStyle = fGrad;
  ctx.beginPath();
  ctx.moveTo(-22, -20);
  ctx.lineTo(0, -flameH - 34);
  ctx.lineTo(22, -20);
  ctx.closePath();
  ctx.fill();

  // Twin side vernier flame plumes
  for (const side of [-1, 1]) {
    ctx.fillStyle = 'rgba(253, 224, 71, 0.72)';
    ctx.beginPath();
    ctx.moveTo(side * 20, -8);
    ctx.lineTo(side * 30, -34 - Math.sin(time * 48 + side) * 6);
    ctx.lineTo(side * 12, -16);
    ctx.closePath();
    ctx.fill();
  }

  // Fiery atmospheric re-entry bow shockwave cone below nose
  ctx.strokeStyle = 'rgba(253, 224, 71, 0.78)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 14, 34, 0.25, Math.PI - 0.25);
  ctx.stroke();

  if (art.dropPod) {
    const podH = 78;
    const podW = podH * art.dropPod.aspect;
    ctx.shadowColor = h.team === 'blue' ? 'rgba(56, 189, 248, 0.55)' : 'rgba(244, 63, 94, 0.55)';
    ctx.shadowBlur = 12;
    ctx.drawImage(art.dropPod.canvas, -podW / 2, -podH / 2, podW, podH);
    ctx.shadowBlur = 0;
  } else {
    // Fallback Cathedral Reliquary Drop Pod
    ctx.fillStyle = h.team === 'blue' ? '#1E3A8A' : '#881337';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-22, -16);
    ctx.lineTo(22, -16);
    ctx.lineTo(15, 22);
    ctx.lineTo(-15, 22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  if (h.isPlayer) {
    ctx.font = '800 12px "Bricolage Grotesque", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FDE68A';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.strokeText('STEER A / D FOR RELIC SHARDS', 0, -64);
    ctx.fillText('STEER A / D FOR RELIC SHARDS', 0, -64);
  }
  ctx.restore();
}

/* =========================================================================
   CHAMPION RENDERER + 8 HAND-CRAFTED ARTICULATED 2D CHARACTER RIGS
   ========================================================================= */

const HERO_SPRITE_HEIGHT: Record<HeroEntity['heroId'], number> = {
  marrow: 92,
  seraph: 94,
  korak: 90,
  vorg: 84,
  bastion: 94,
  vexia: 84,
  xylar: 82,
  caldris: 92,
  vespra: 88,
  vale: 90,
};

// === AWESOMENAUTS-STYLE HERO ANIMATION STATE MACHINE ===
type HeroAnimAction =
  | 'idle'
  | 'run'
  | 'jump_rise'
  | 'jump_fall'
  | 'land'
  | 'attack'
  | 'cast1'
  | 'cast2'
  | 'hurt'
  | 'recall'
  | 'victory'
  | 'defeat';

interface HeroAnimState {
  lastTime: number;
  prevGrounded: boolean;
  prevHp: number;
  prevSkill1Cd: number;
  prevSkill2Cd: number;
  prevRecoil: number;
  landTimer: number;
  attackTimer: number;
  attackDur: number;
  lastShotAt: number;
  attackSwingSign: 1 | -1;
  castTimer: number;
  castDur: number;
  castSlot: 1 | 2;
  hurtTimer: number;
  action: HeroAnimAction;
}

const heroAnimMap = new Map<string, HeroAnimState>();

function updateHeroAnimState(
  h: HeroEntity,
  time: number,
  endCinematic?: EndCinematicRenderState | null
): HeroAnimState {
  let st = heroAnimMap.get(h.id);
  if (!st) {
    st = {
      lastTime: time,
      prevGrounded: h.grounded,
      prevHp: h.hp,
      prevSkill1Cd: h.skill1Cd,
      prevSkill2Cd: h.skill2Cd,
      prevRecoil: h.recoilTimer,
      landTimer: 0,
      attackTimer: 0,
      attackDur: 0.26,
      lastShotAt: -10,
      attackSwingSign: 1,
      castTimer: 0,
      castDur: 0.34,
      castSlot: 1,
      hurtTimer: 0,
      action: 'idle',
    };
    heroAnimMap.set(h.id, st);
  }

  const dt = Math.max(0, Math.min(0.08, time - st.lastTime));
  st.lastTime = time;

  // Detect landing impact transition (airborne -> grounded)
  if (!st.prevGrounded && h.grounded) {
    st.landTimer = 0.2;
  }
  st.prevGrounded = h.grounded;

  // Detect Skill 1 / Skill 2 casts (cooldown only ever jumps UP when a skill is used)
  if (h.skill1Cd > st.prevSkill1Cd + 0.25) {
    st.castDur = 0.34;
    st.castTimer = st.castDur;
    st.castSlot = 1;
    vfxCastBurst(h.x, h.y - 6, HERO_MAP[h.heroId]?.accentColor ?? '#FFFFFF', 1);
  } else if (h.skill2Cd > st.prevSkill2Cd + 0.25) {
    st.castDur = 0.38;
    st.castTimer = st.castDur;
    st.castSlot = 2;
    vfxCastBurst(h.x, h.y - 6, HERO_MAP[h.heroId]?.accentColor ?? '#FFFFFF', 2);
  }
  st.prevSkill1Cd = h.skill1Cd;
  st.prevSkill2Cd = h.skill2Cd;

  // Detect primary attack: recoilTimer only ever rises when a shot fires, so any rise is a new shot.
  // The animation length adapts to fire rate so rapid-fire heroes complete a full (shorter) cycle per
  // shot instead of restarting mid-swing every frame-ish, which is what made sustained fire jitter.
  if (h.recoilTimer > st.prevRecoil + 0.001) {
    const interval = time - st.lastShotAt;
    st.lastShotAt = time;
    st.attackDur = Math.max(0.12, Math.min(0.26, interval * 0.92));
    st.attackTimer = st.attackDur;
    st.attackSwingSign = st.attackSwingSign === 1 ? -1 : 1;
    const style = HERO_ATTACK_STYLE[h.heroId] ?? 'ranged';
    if (style !== 'melee') {
      vfxMuzzle(
        h.x + Math.cos(h.aimAngle) * 26,
        h.y + Math.sin(h.aimAngle) * 20 - 2,
        h.aimAngle,
        HERO_MAP[h.heroId]?.accentColor ?? '#FFFFFF',
        style === 'heavy'
      );
    }
  }
  st.prevRecoil = h.recoilTimer;

  // Detect damage hurt flinch
  if (h.hp < st.prevHp - 1 || (h.hitFlashTimer > 0.08 && st.hurtTimer <= 0.02)) {
    st.hurtTimer = 0.2;
  }
  st.prevHp = h.hp;

  // Tick down transient animation timers
  st.landTimer = Math.max(0, st.landTimer - dt);
  st.attackTimer = Math.max(0, st.attackTimer - dt);
  st.castTimer = Math.max(0, st.castTimer - dt);
  st.hurtTimer = Math.max(0, st.hurtTimer - dt);

  // Resolve active animation state by priority
  if (endCinematic && (endCinematic.active || endCinematic.completed)) {
    st.action = h.team === endCinematic.winner ? 'victory' : 'defeat';
  } else if (h.recallTimer > 0) {
    st.action = 'recall';
  } else if (st.castTimer > 0 || h.dashTimer > 0 || h.spinTimer > 0) {
    st.action = st.castSlot === 2 || h.spinTimer > 0 ? 'cast2' : 'cast1';
  } else if (st.attackTimer > 0) {
    st.action = 'attack';
  } else if (st.hurtTimer > 0.08) {
    st.action = 'hurt';
  } else if (!h.grounded) {
    st.action = h.vy < 40 ? 'jump_rise' : 'jump_fall';
  } else if (st.landTimer > 0.04) {
    st.action = 'land';
  } else if (Math.abs(h.vx) > 22) {
    st.action = 'run';
  } else {
    st.action = 'idle';
  }

  return st;
}

/**
 * Draws an animated hero-specific backpiece (flapping hard-light wings, billowing cloaks,
 * rotating sundial rings, cathedral halos) behind the articulated sprite rig.
 */
function drawHeroAnimatedBackpiece(
  ctx: CanvasRenderingContext2D,
  h: HeroEntity,
  anim: HeroAnimState,
  time: number,
  phaseSeed: number,
  spriteH: number,
  moveRatio: number
): void {
  const flapBoost = !h.grounded ? 2.4 : moveRatio > 0.2 ? 1.5 : 1.0;

  if (h.heroId === 'seraph') {
    // Flapping Radiant Hard-Light Seraph Wings!
    const wingFlap = Math.sin(time * 7.5 * flapBoost + phaseSeed) * (h.isHovering ? 0.52 : 0.28);
    ctx.save();
    ctx.translate(-h.facing * 8, -spriteH * 0.56);
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(h.facing, 1);
      ctx.rotate(side * (0.28 + wingFlap) - 0.12);
      ctx.fillStyle = side === 1 ? 'rgba(56, 189, 248, 0.55)' : 'rgba(251, 191, 36, 0.48)';
      ctx.strokeStyle = '#E0F2FE';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-24, -18 * side, -38, -6 * side);
      ctx.quadraticCurveTo(-24, 5 * side, -6, 6 * side);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  } else if (h.heroId === 'vorg' || h.heroId === 'vexia' || h.heroId === 'vespra') {
    // Billowing Cloth / Plague Cloak reacting dynamically to horizontal speed & fall velocity!
    const cloakCol =
      h.heroId === 'vorg'
        ? 'rgba(126, 34, 206, 0.65)'
        : h.heroId === 'vexia'
          ? 'rgba(159, 18, 57, 0.62)'
          : 'rgba(63, 98, 18, 0.66)';
    const trimCol =
      h.heroId === 'vorg' ? '#C084FC' : h.heroId === 'vexia' ? '#FDA4AF' : '#A3E635';
    const wind = moveRatio * 18 + (!h.grounded ? Math.max(-10, Math.min(18, h.vy * 0.03)) : 0);
    const wave = Math.sin(time * (6 + moveRatio * 8) + phaseSeed) * (4 + moveRatio * 5);

    ctx.save();
    ctx.translate(0, -spriteH * 0.62);
    ctx.scale(h.facing, 1);
    ctx.fillStyle = cloakCol;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.quadraticCurveTo(-18 - wind * 0.6, 18 + wave * 0.5, -26 - wind, 40 - wind * 0.35 + wave);
    ctx.lineTo(-10 - wind * 0.55, 44 - wind * 0.25 - wave * 0.5);
    ctx.quadraticCurveTo(-4, 22, 4, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = trimCol;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-26 - wind, 40 - wind * 0.35 + wave);
    ctx.lineTo(-10 - wind * 0.55, 44 - wind * 0.25 - wave * 0.5);
    ctx.stroke();
    ctx.restore();
  } else if (h.heroId === 'vale') {
    // Rotating Golden-Cyan Sundial Chrono Halo
    ctx.save();
    ctx.translate(0, -spriteH * 0.58);
    ctx.rotate(time * (h.hasteTimer > 0 ? 4.8 : 1.5));
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.78)';
    ctx.lineWidth = 2.4;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, 31, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      ctx.fillStyle = i % 2 === 0 ? '#FEF08A' : '#38BDF8';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 31, Math.sin(a) * 31, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (h.heroId === 'bastion') {
    // Radiant Cathedral Relic Crown Halo behind Brother Bastion
    ctx.save();
    ctx.translate(0, -spriteH * 0.66);
    ctx.rotate(time * 0.55);
    ctx.strokeStyle = anim.action === 'victory' ? '#FEF08A' : 'rgba(245, 158, 11, 0.7)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 24, Math.sin(a) * 24);
      ctx.lineTo(Math.cos(a) * 32, Math.sin(a) * 32);
      ctx.stroke();
    }
    ctx.restore();
  } else if (h.heroId === 'marrow') {
    // Twin Blight Furnace Steam Exhaust Plumes
    const ep = (time * 1.9 + phaseSeed) % 1;
    ctx.save();
    ctx.fillStyle = h.rotTimer > 0 ? '#10B981' : '#34D399';
    ctx.globalAlpha = (1 - ep) * 0.72;
    ctx.beginPath();
    ctx.arc(-h.facing * 14 + Math.sin(time * 5) * 5, -spriteH * 0.68 - ep * 34, 4 + ep * 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (h.heroId === 'korak' || h.heroId === 'caldris') {
    // Orbiting Spectral Motes / Soul-Lattice Halo
    ctx.save();
    const col = h.heroId === 'korak' ? '#34D399' : '#2DD4BF';
    for (let i = 0; i < 3; i++) {
      const ka = time * 2.8 + phaseSeed + (i * Math.PI * 2) / 3;
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.78;
      ctx.beginPath();
      ctx.arc(Math.cos(ka) * 29, -spriteH * 0.52 + Math.sin(ka * 1.3) * 14, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

type AttackStyle = 'melee' | 'ranged' | 'heavy' | 'caster';
const HERO_ATTACK_STYLE: Record<HeroEntity['heroId'], AttackStyle> = {
  marrow: 'melee',
  xylar: 'melee',
  bastion: 'heavy',
  korak: 'caster',
  caldris: 'caster',
  seraph: 'ranged',
  vorg: 'ranged',
  vexia: 'ranged',
  vespra: 'ranged',
  vale: 'ranged',
};

/** Normalised 0..1 attack / cast progress using the duration the trigger actually set. */
function attackProgress(anim: HeroAnimState): number {
  return anim.attackTimer > 0 ? 1 - anim.attackTimer / anim.attackDur : 0;
}
function castProgress(anim: HeroAnimState): number {
  return anim.castTimer > 0 ? 1 - anim.castTimer / anim.castDur : 0;
}

/**
 * Attack / cast VFX drawn over the hero. The painted sprite already holds its weapon, so this
 * draws only energy effects (slash crescents, muzzle flashes, cast glyphs) — never a second weapon.
 * Origin is the hero centre (h.x, h.y); effects sit where sim.ts spawns projectiles (cos*22, sin*18-2).
 */
function drawHeroAttackVfx(
  ctx: CanvasRenderingContext2D,
  h: HeroEntity,
  anim: HeroAnimState,
  time: number,
  accentColor: string
): void {
  if (anim.action === 'victory' || anim.action === 'defeat') return;
  const style = HERO_ATTACK_STYLE[h.heroId] ?? 'ranged';
  const aim = h.aimAngle;
  const cos = Math.cos(aim);
  const sin = Math.sin(aim);
  const mx = cos * 26;
  const my = sin * 20 - 2;

  if (anim.attackTimer > 0) {
    const p = attackProgress(anim);
    ctx.save();
    if (style === 'melee') {
      // Sweeping crescent: the arc's leading edge travels across the swing, tail fades behind it
      const strike = Math.max(0, Math.min(1, (p - 0.15) / 0.45));
      if (strike > 0 && p < 0.85) {
        const ease = 1 - Math.pow(1 - strike, 3);
        const span = 2.2;
        const dir = anim.attackSwingSign * (Math.cos(aim) < 0 ? -1 : 1);
        const start = aim - (span / 2) * dir;
        const head = start + span * ease * dir;
        const tail = start + span * Math.max(0, ease - 0.55) * dir;
        const r = h.heroId === 'marrow' ? 44 : 34;
        const fade = p < 0.6 ? 1 : 1 - (p - 0.6) / 0.25;
        const col =
          h.heroId === 'marrow' ? '#34D399' : h.cloakCritReady ? '#FDE047' : '#38BDF8';
        ctx.globalAlpha = 0.9 * fade;
        ctx.strokeStyle = col;
        ctx.lineCap = 'round';
        ctx.lineWidth = h.heroId === 'marrow' ? 9 : 6;
        ctx.shadowColor = col;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(cos * 4, sin * 4 - 4, r, Math.min(tail, head), Math.max(tail, head));
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(cos * 4, sin * 4 - 4, r - 3, Math.min(tail, head), Math.max(tail, head));
        ctx.stroke();
      }
    } else {
      // Muzzle flash: bright, front-loaded, gone by 40% of the cycle (ranged reads as a snap, not a swing)
      const flash = p < 0.4 ? 1 - p / 0.4 : 0;
      if (flash > 0) {
        const size = style === 'heavy' ? 1.6 : style === 'caster' ? 1.25 : 1;
        ctx.translate(mx, my);
        ctx.rotate(aim);
        ctx.globalAlpha = flash;
        ctx.shadowColor = accentColor;
        ctx.shadowBlur = 16;
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.moveTo(-2, 0);
        ctx.lineTo(10 * size, -7 * size * flash);
        ctx.lineTo((18 + 10 * flash) * size, 0);
        ctx.lineTo(10 * size, 7 * size * flash);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(2, 0, (3 + 4 * flash) * size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  if (anim.castTimer > 0) {
    const p = castProgress(anim);
    ctx.save();
    if (anim.castSlot === 1) {
      // Skill 1: gathering sparks converge on the hand, then burst outward on release (p > 0.45)
      ctx.translate(mx, my);
      if (p < 0.45) {
        const g = p / 0.45;
        for (let i = 0; i < 6; i++) {
          const ang = i * 1.047 + time * 7;
          const rr = 26 * (1 - g) + 4;
          ctx.globalAlpha = 0.5 + 0.5 * g;
          ctx.fillStyle = i % 2 ? '#FFFFFF' : accentColor;
          ctx.beginPath();
          ctx.arc(Math.cos(ang) * rr, Math.sin(ang) * rr, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        const r = (p - 0.45) / 0.55;
        ctx.globalAlpha = 1 - r;
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 4 * (1 - r) + 1;
        ctx.beginPath();
        ctx.arc(0, 0, 6 + r * 30, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      // Skill 2: rune circle under the feet that spins up and flares
      const pulse = Math.sin(p * Math.PI);
      ctx.translate(0, h.h / 2);
      ctx.scale(1, 0.32);
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 3;
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, 30 + pulse * 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, 20 + pulse * 10, time * 5, time * 5 + Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function drawHero(
  ctx: CanvasRenderingContext2D,
  h: HeroEntity,
  time: number,
  localTeam: Team,
  sprite?: ProcessedSprite,
  endCinematic?: EndCinematicRenderState | null
): void {
  const def = HERO_MAP[h.heroId];
  const isBlue = h.team === 'blue';
  const teamCol = isBlue ? '#38BDF8' : '#F43F5E';

  // Phase Cloak invisibility handling
  const isCloaked = h.cloakTimer > 0;
  const isEnemy = h.team !== localTeam;
  if (isCloaked && isEnemy) {
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(h.x, h.y, 16, 22, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const anim = updateHeroAnimState(h, time, endCinematic);

  ctx.save();
  ctx.translate(h.x, h.y);
  if (isCloaked) {
    ctx.globalAlpha = 0.45;
  }

  // Team ground contact shadow + landing dust ring
  const airScale = h.grounded ? 1 : 0.74;
  ctx.save();
  ctx.fillStyle = isBlue ? 'rgba(56, 189, 248, 0.34)' : 'rgba(244, 63, 94, 0.36)';
  ctx.beginPath();
  ctx.ellipse(0, h.h / 2 - 1, h.w * 0.78 * airScale, 7.5 * airScale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = teamCol;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  if (h.isPlayer) {
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.92)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(0, h.h / 2 - 1, h.w * 0.96 * airScale, 9.5 * airScale, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Landing impact dust puff ring!
  if (anim.landTimer > 0) {
    const lp = 1 - anim.landTimer / 0.2;
    ctx.strokeStyle = `rgba(226, 232, 240, ${(0.75 * (1 - lp)).toFixed(2)})`;
    ctx.lineWidth = 3 * (1 - lp) + 1;
    ctx.beginPath();
    ctx.ellipse(0, h.h / 2, h.w * (0.7 + lp * 0.95), 7 + lp * 4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Rhythmic sprint footstep dust puffs right beneath boots!
  if (anim.action === 'run' && h.grounded) {
    const stepWave = Math.abs(Math.sin(h.walkCycle * 2.4));
    if (stepWave < 0.25) {
      ctx.fillStyle = 'rgba(203, 213, 225, 0.48)';
      ctx.beginPath();
      ctx.arc(-h.facing * 14, h.h / 2 - 2, 4.5 * (1 - stepWave * 3), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Slow debuff ground frost ring
  if (h.slowTimer > 0) {
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2.2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.ellipse(0, h.h / 2 - 1, h.w * 1.05, 11, 0, time * 3, time * 3 + Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Marrow-Hook Blight Furnace toxic rot cloud!
  if (h.rotTimer > 0) {
    ctx.save();
    const rotR = 122;
    const rGrad = ctx.createRadialGradient(0, 0, 14, 0, 0, rotR);
    rGrad.addColorStop(0, 'rgba(16, 185, 129, 0.38)');
    rGrad.addColorStop(0.68, 'rgba(5, 150, 105, 0.2)');
    rGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = rGrad;
    ctx.beginPath();
    ctx.arc(0, 0, rotR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#34D399';
    ctx.lineWidth = 2.6;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, rotR, time * 2.2, time * 2.2 + Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Brother Bastion Divine Reckoning Telegraph!
  if (h.meltdownTimer > 0 && h.meltdownMaxTimer > 0) {
    const progress = 1 - h.meltdownTimer / h.meltdownMaxTimer;
    const rad = 168;
    ctx.save();
    ctx.fillStyle = `rgba(251, 191, 36, ${(0.12 + progress * 0.28).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(0, 0, rad * progress, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 3.5;
    ctx.setLineDash([10, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Vorg Soul Maelstrom Vortex!
  if (h.spinTimer > 0) {
    ctx.save();
    ctx.rotate(time * 16);
    const spinGrad = ctx.createRadialGradient(0, 0, 12, 0, 0, 90);
    spinGrad.addColorStop(0, 'rgba(168, 85, 247, 0.58)');
    spinGrad.addColorStop(0.7, 'rgba(192, 132, 252, 0.25)');
    spinGrad.addColorStop(1, 'rgba(168, 85, 247, 0)');
    ctx.fillStyle = spinGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 90, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#D8B4FE';
    ctx.lineWidth = 3.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, 32 + i * 18, i * 2, i * 2 + Math.PI * 1.15);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Recall beam + ground magic circle & ascending light ribbons
  if (h.recallTimer > 0) {
    const pct = 1 - h.recallTimer / 2.2;
    ctx.save();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
    ctx.fillRect(-18, -240, 36, 265);
    ctx.strokeStyle = '#7DD3FC';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(0, h.h / 2 - 2, 34, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.arc(0, 0, 38, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const rp = (time * 1.6 + i * 0.33) % 1;
      const rx = Math.cos(time * 6 + i * 2.1) * 20;
      const ry = h.h / 2 - rp * 180;
      ctx.fillStyle = '#BAE6FD';
      ctx.globalAlpha = 1 - rp;
      ctx.beginPath();
      ctx.arc(rx, ry, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Skill Cast Surge Halo Ring
  if (anim.castTimer > 0) {
    const cp = castProgress(anim);
    ctx.save();
    ctx.strokeStyle = def.accentColor;
    ctx.globalAlpha = (1 - cp) * 0.85;
    ctx.lineWidth = 3.2 * (1 - cp) + 1;
    ctx.beginPath();
    ctx.arc(0, -10, 22 + cp * 36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Victory Celebration Golden Sparkles during end cinematic!
  if (anim.action === 'victory') {
    ctx.save();
    for (let i = 0; i < 4; i++) {
      const sp = (time * 1.8 + i * 0.25) % 1;
      const sx = Math.cos(time * 3 + i * 1.6) * 28;
      const sy = h.h / 2 - sp * 95;
      ctx.fillStyle = i % 2 === 0 ? '#FEF08A' : '#38BDF8';
      ctx.globalAlpha = 1 - sp;
      ctx.beginPath();
      ctx.arc(sx, sy, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Hand-Inked Multi-Part Articulated Awesomenauts Champion Rig
  const spriteH = HERO_SPRITE_HEIGHT[h.heroId] ?? 86;
  const phaseSeed = (h.id.charCodeAt(h.id.length - 1) || 0) * 1.37;
  if (sprite) {
    const drawW = spriteH * sprite.aspect;
    const moveRatio = Math.min(1, Math.abs(h.vx) / 230);
    const isFloatingHero = sprite.rig?.isFloating ?? (h.heroId === 'korak' || h.heroId === 'caldris');

    // Compute Awesomenauts Multi-Joint Keyframe Pose
    const stridePhase = h.walkCycle * 2.4;
    const strideSin = Math.sin(stridePhase);
    const strideCos = Math.cos(stridePhase);
    const strideBounce = Math.abs(strideSin);

    let rootLift = 0;
    let rootScaleX = h.squashX;
    let rootScaleY = h.squashY;
    let backLegRot = 0;
    let frontLegRot = 0;
    let backLegLift = 0;
    let frontLegLift = 0;
    let torsoRot = 0;
    let torsoShiftX = 0;
    let torsoShiftY = 0;
    let headRot = 0;
    let headShiftY = 0;

    // 1. Base locomotion pose (Idle / Run / Jump / Fall / Land / Recall / Victory / Defeat)
    if (anim.action === 'victory') {
      const hop = Math.abs(Math.sin(time * 6.4 + phaseSeed));
      rootLift = hop * 14;
      rootScaleX *= 1 - hop * 0.06;
      rootScaleY *= 1 + hop * 0.08;
      frontLegRot = -0.32 * hop;
      backLegRot = 0.28 * hop;
      torsoRot = -0.09 - hop * 0.06;
      headRot = -0.14 + Math.sin(time * 9) * 0.06;
    } else if (anim.action === 'defeat') {
      // Slumped defeated kneel/collapse
      rootLift = -6;
      rootScaleX *= 1.07;
      rootScaleY *= 0.88;
      frontLegRot = 0.34;
      backLegRot = -0.22;
      torsoRot = 0.24;
      torsoShiftY = 5;
      headRot = 0.32;
      headShiftY = 3;
    } else if (anim.action === 'recall') {
      // Levitating arcane channel
      rootLift = 11 + Math.sin(time * 5.2 + phaseSeed) * 4;
      frontLegRot = 0.18;
      backLegRot = -0.18;
      torsoRot = -0.06;
      headRot = -0.16;
    } else if (!h.grounded) {
      if (h.vy < 40) {
        // Jump Ascent: knees tucked, stretched upward silhouette
        rootScaleX *= 0.92;
        rootScaleY *= 1.1;
        frontLegRot = -0.46;
        frontLegLift = 5;
        backLegRot = 0.34;
        torsoRot = 0.08 * moveRatio;
        headRot = -0.1;
      } else {
        // Jump Fall: splayed legs bracing for landing
        rootScaleX *= 0.96;
        rootScaleY *= 1.05;
        frontLegRot = 0.26;
        backLegRot = -0.34;
        torsoRot = -0.06;
        headRot = 0.1;
      }
    } else if (anim.action === 'land') {
      // Snappy Landing Squash Crouch
      const lp = anim.landTimer / 0.2;
      rootScaleX *= 1 + lp * 0.16;
      rootScaleY *= 1 - lp * 0.16;
      frontLegRot = 0.24 * lp;
      backLegRot = -0.24 * lp;
      torsoRot = 0.12 * lp;
      torsoShiftY = 3 * lp;
    } else if (anim.action === 'run') {
      if (isFloatingHero) {
        // Gliding forward rush with flowing trailing robe hems
        rootLift = 6 + Math.sin(time * 4.5 + phaseSeed) * 4;
        torsoRot = 0.16 * moveRatio;
        backLegRot = 0.32 * moveRatio + Math.sin(time * 8) * 0.08;
        frontLegRot = 0.2 * moveRatio + Math.cos(time * 8) * 0.07;
        headRot = -0.08 * moveRatio;
      } else {
        // Full Awesomenauts Bipedal Sprint Cycle!
        rootLift = strideBounce * 6.5 * moveRatio;
        frontLegRot = strideSin * 0.56 * moveRatio;
        backLegRot = -strideSin * 0.56 * moveRatio;
        frontLegLift = Math.max(0, strideCos) * 5.5 * moveRatio;
        backLegLift = Math.max(0, -strideCos) * 5.5 * moveRatio;
        torsoRot = 0.14 * moveRatio + strideSin * 0.055 * moveRatio;
        torsoShiftY = (1 - strideBounce) * 2.2 * moveRatio;
        headRot = -0.09 * moveRatio - strideSin * 0.04 * moveRatio;
      }
    } else {
      // Layered Idle Breathing (chest expands, head lags smoothly behind)
      const breath = Math.sin(time * 2.9 + phaseSeed);
      const breathLag = Math.sin(time * 2.9 + phaseSeed - 0.55);
      rootLift = isFloatingHero ? 6 + breath * 4.5 : 0;
      rootScaleX *= 1 - breath * 0.022;
      rootScaleY *= 1 + breath * 0.026;
      torsoShiftY = -breath * 1.4;
      headShiftY = -breathLag * 1.6;
      headRot = breathLag * 0.035;
      if (isFloatingHero) {
        backLegRot = Math.sin(time * 3.4 + phaseSeed) * 0.1;
        frontLegRot = Math.cos(time * 3.1 + phaseSeed) * 0.08;
      }
    }

    // 2. Additive combat motion. The painted sprite has its arms/weapon baked in, so instead of
    //    rotating the sliced torso band (which tears at the waist seam) we move the WHOLE body:
    //    a shear that leans the upper body while the feet stay planted, a small lunge, and
    //    squash/stretch. Timing: anticipation -> snap -> recover, on the duration the trigger set.
    let bodyLean = 0; // + leans toward facing direction, pivoting at the feet
    let lungeX = 0;
    const aimFwd = Math.cos(h.aimAngle) * h.facing >= 0 ? 1 : -1;
    const atkStyle = HERO_ATTACK_STYLE[h.heroId] ?? 'ranged';
    const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

    if (anim.attackTimer > 0) {
      const ap = attackProgress(anim);
      if (atkStyle === 'melee') {
        // Big wind-up, hard forward slash, slow settle
        if (ap < 0.2) {
          const w = easeOut(ap / 0.2);
          bodyLean -= 0.16 * w * aimFwd;
          lungeX -= 3 * w * aimFwd;
          rootScaleX *= 1 + 0.05 * w;
          rootScaleY *= 1 - 0.05 * w;
        } else if (ap < 0.45) {
          const k = easeOut((ap - 0.2) / 0.25);
          bodyLean += (-0.16 + 0.42 * k) * aimFwd;
          lungeX += (-3 + 12 * k) * aimFwd;
          rootScaleX *= 1 - 0.06 * k;
          rootScaleY *= 1 + 0.06 * k;
        } else {
          const r = easeOut((ap - 0.45) / 0.55);
          bodyLean += 0.26 * (1 - r) * aimFwd;
          lungeX += 9 * (1 - r) * aimFwd;
        }
      } else {
        // Ranged: tiny brace, then recoil kicks the body BACK from the shot and springs home
        const kick = atkStyle === 'heavy' ? 1.8 : atkStyle === 'caster' ? 1.2 : 1;
        if (ap < 0.12) {
          const w = ap / 0.12;
          bodyLean += 0.05 * w * aimFwd * kick;
        } else {
          const r = (ap - 0.12) / 0.88;
          const spring = Math.sin(r * Math.PI) * (1 - r * 0.5);
          bodyLean -= 0.12 * spring * aimFwd * kick;
          lungeX -= 4 * spring * aimFwd * kick;
          rootScaleX *= 1 + 0.035 * spring * kick;
          rootScaleY *= 1 - 0.035 * spring * kick;
        }
      }
    }

    if (anim.castTimer > 0) {
      const cp = castProgress(anim);
      if (anim.castSlot === 1) {
        // Gather (crouch back) then thrust forward on release
        if (cp < 0.45) {
          const g = easeOut(cp / 0.45);
          bodyLean -= 0.12 * g * aimFwd;
          rootScaleX *= 1 + 0.06 * g;
          rootScaleY *= 1 - 0.07 * g;
        } else {
          const r = (cp - 0.45) / 0.55;
          const thrust = Math.sin(Math.min(1, r * 1.6) * Math.PI * 0.5) * (1 - r);
          bodyLean += (0.28 * thrust - 0.12 * (1 - Math.min(1, r * 3))) * aimFwd;
          lungeX += 8 * thrust * aimFwd;
          rootScaleX *= 1 - 0.05 * thrust;
          rootScaleY *= 1 + 0.07 * thrust;
        }
      } else {
        // Skill 2: squat, then rise up and stretch tall as the power releases
        if (cp < 0.35) {
          const g = easeOut(cp / 0.35);
          rootScaleX *= 1 + 0.1 * g;
          rootScaleY *= 1 - 0.1 * g;
        } else {
          const r = (cp - 0.35) / 0.65;
          const up = Math.sin(Math.min(1, r * 1.4) * Math.PI * 0.5) * (1 - r * 0.6);
          rootLift += 10 * up;
          rootScaleX *= 1 - 0.06 * up;
          rootScaleY *= 1 + 0.1 * up;
        }
      }
    }

    if (anim.hurtTimer > 0) {
      // Knocked back: lean away from facing, quick squash
      const hpct = easeOut(anim.hurtTimer / 0.2);
      bodyLean -= 0.2 * hpct;
      lungeX -= 5 * hpct;
      rootScaleX *= 1 + 0.05 * hpct;
      rootScaleY *= 1 - 0.05 * hpct;
      headRot -= 0.12 * hpct;
    }

    // Subtle vertical aim tracking on head so champion looks toward their reticle!
    if (anim.action !== 'victory' && anim.action !== 'defeat') {
      const aimVertical = Math.sin(h.aimAngle);
      headRot += Math.max(-0.22, Math.min(0.22, aimVertical * 0.24));
    }

    // Hover jet aura
    if (h.isHovering || h.heroId === 'caldris') {
      ctx.save();
      ctx.fillStyle = h.heroId === 'caldris' ? 'rgba(45, 212, 191, 0.36)' : 'rgba(56, 189, 248, 0.36)';
      ctx.beginPath();
      ctx.ellipse(0, h.h / 2 - 2, 24, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (h.cloakCritReady) {
      ctx.save();
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.82)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, -6, 36 + Math.sin(time * 10) * 2.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (h.hasteTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2.4;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(0, -10, 38, time * 6, time * 6 + Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (h.dashTimer > 0) {
      ctx.save();
      ctx.strokeStyle = def.accentColor;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, -6, 34 + Math.sin(time * 24) * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Translucent motion afterimages during dashes, Chrono Haste, or jump-pad launches
    const speedMag = Math.hypot(h.vx, h.vy);
    if (h.dashTimer > 0 || h.hasteTimer > 0 || speedMag > 460) {
      for (let g = 2; g >= 1; g--) {
        ctx.save();
        ctx.globalAlpha = (isCloaked ? 0.14 : 0.24) / g;
        ctx.translate(-h.vx * 0.022 * g, h.h / 2 + 2 - rootLift - h.vy * 0.018 * g);
        ctx.scale(h.facing, 1);
        ctx.drawImage(sprite.canvas, -drawW / 2, -spriteH, drawW, spriteH);
        ctx.restore();
      }
    }

    // Layer 1: Animated Hero Backpiece (wings, billowing cloaks, halos)
    ctx.save();
    ctx.translate(0, h.h / 2 + 2 - rootLift);
    drawHeroAnimatedBackpiece(ctx, h, anim, time, phaseSeed, spriteH, moveRatio);
    ctx.restore();

    // Layer 2: Multi-Part Articulated Inked Puppet (Back Leg -> Front Leg -> Torso -> Head)
    const meltdownFlash = h.meltdownTimer > 0 && Math.floor(time * 16) % 2 === 0;
    const flashAlpha = h.hitFlashTimer > 0 ? 0.72 : meltdownFlash ? 0.42 : 0;

    ctx.save();
    ctx.translate(0, h.h / 2 + 2 - rootLift);
    ctx.scale(rootScaleX * h.facing, rootScaleY);
    ctx.translate(lungeX, 0);
    // Shear pivots at the feet (y = 0): upper body leans, boots stay planted on the ground
    if (bodyLean !== 0) ctx.transform(1, 0, -bodyLean, 1, 0, 0);
    if (anim.castTimer > 0) {
      // Charge glow in the hero's accent colour while casting
      const glow = Math.sin(castProgress(anim) * Math.PI);
      ctx.shadowColor = def.accentColor;
      ctx.shadowBlur = 10 + 18 * glow;
    } else {
      ctx.shadowColor = isEnemy ? 'rgba(244, 63, 94, 0.55)' : 'rgba(56, 189, 248, 0.48)';
      ctx.shadowBlur = h.isPlayer ? 12 : 9;
    }

    const rig = sprite.rig;
    if (rig) {
      const waistPivotY = -spriteH * (1 - rig.waistRatio);
      const neckPivotY = -spriteH * (1 - rig.headRatio);

      // 2a. Rear Leg / Back Robe Hem pivoting around hip joint
      ctx.save();
      ctx.translate(-drawW * 0.04, waistPivotY - backLegLift);
      ctx.rotate(backLegRot);
      ctx.drawImage(rig.backLegCanvas, -drawW / 2 + drawW * 0.04, -spriteH - waistPivotY, drawW, spriteH);
      if (flashAlpha > 0) {
        ctx.globalAlpha = flashAlpha;
        ctx.drawImage(rig.backLegFlash, -drawW / 2 + drawW * 0.04, -spriteH - waistPivotY, drawW, spriteH);
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      // 2b. Front Leg / Front Robe Hem pivoting around hip joint
      ctx.save();
      ctx.translate(drawW * 0.04, waistPivotY - frontLegLift);
      ctx.rotate(frontLegRot);
      ctx.drawImage(rig.frontLegCanvas, -drawW / 2 - drawW * 0.04, -spriteH - waistPivotY, drawW, spriteH);
      if (flashAlpha > 0) {
        ctx.globalAlpha = flashAlpha;
        ctx.drawImage(rig.frontLegFlash, -drawW / 2 - drawW * 0.04, -spriteH - waistPivotY, drawW, spriteH);
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      // 2c. Upper Torso & Shoulders pivoting around waist joint
      ctx.save();
      ctx.translate(torsoShiftX, waistPivotY + torsoShiftY);
      ctx.rotate(torsoRot);
      ctx.drawImage(rig.torsoCanvas, -drawW / 2, -spriteH - waistPivotY, drawW, spriteH);
      if (flashAlpha > 0) {
        ctx.globalAlpha = flashAlpha;
        ctx.drawImage(rig.torsoFlash, -drawW / 2, -spriteH - waistPivotY, drawW, spriteH);
        ctx.globalAlpha = 1;
      }

      // 2d. Head / Helmet nested cleanly on top of Torso (follows torso lean + tracks aim!)
      ctx.save();
      ctx.translate(0, neckPivotY - waistPivotY + headShiftY);
      ctx.rotate(headRot);
      ctx.drawImage(rig.headCanvas, -drawW / 2, -spriteH - neckPivotY, drawW, spriteH);
      if (flashAlpha > 0) {
        ctx.globalAlpha = flashAlpha;
        ctx.drawImage(rig.headFlash, -drawW / 2, -spriteH - neckPivotY, drawW, spriteH);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      ctx.restore();
    } else {
      ctx.rotate(torsoRot);
      ctx.drawImage(sprite.canvas, -drawW / 2 + torsoShiftX, -spriteH, drawW, spriteH);
      if (flashAlpha > 0) {
        ctx.globalAlpha = flashAlpha;
        ctx.drawImage(sprite.flashCanvas, -drawW / 2 + torsoShiftX, -spriteH, drawW, spriteH);
        ctx.globalAlpha = 1;
      }
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    // Layer 3: Dedicated 360°-Aimed Animated Foreground Weapon Rig + Slash/Muzzle VFX
    drawHeroAttackVfx(ctx, h, anim, time, def.accentColor);

    // Precision 360-degree Aim Direction Pip for the local player (hidden during end cinematic)
    if (h.isPlayer && !endCinematic?.active) {
      ctx.save();
      ctx.translate(0, -8);
      ctx.rotate(h.aimAngle);
      ctx.fillStyle = def.accentColor;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(46, 0);
      ctx.lineTo(37, -5);
      ctx.lineTo(39, 0);
      ctx.lineTo(37, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  } else {
    // Seamless fallback while sprite decodes
    ctx.save();
    const breathe = h.grounded && Math.abs(h.vx) < 20 ? Math.sin(time * 2.8 + phaseSeed) * 0.02 : 0;
    ctx.scale(h.squashX - breathe, h.squashY + breathe);
    const flash = h.hitFlashTimer > 0;
    const stride = Math.abs(h.vx) > 25 && h.grounded ? Math.sin(h.walkCycle * 2.2) * 6 : 0;

    switch (h.heroId) {
      case 'marrow':
        drawMarrowBody(ctx, h, flash, teamCol, stride, time);
        break;
      case 'seraph':
        drawSeraphBody(ctx, h, flash, teamCol, stride, time);
        break;
      case 'korak':
        drawKorakBody(ctx, h, flash, teamCol, time);
        break;
      case 'vorg':
        drawVorgBody(ctx, h, flash, teamCol, stride, time);
        break;
      case 'bastion':
        drawBastionBody(ctx, h, flash, teamCol, stride, time);
        break;
      case 'vexia':
        drawVexiaBody(ctx, h, flash, teamCol, stride, time);
        break;
      case 'xylar':
        drawXylarBody(ctx, h, flash, teamCol, stride, time);
        break;
      case 'caldris':
        drawCaldrisBody(ctx, h, flash, teamCol, time);
        break;
      case 'vespra':
        drawVespraBody(ctx, h, flash, teamCol, stride, time);
        break;
      case 'vale':
        drawValeBody(ctx, h, flash, teamCol, stride, time);
        break;
    }
    ctx.restore();
  }

  // Active Status Effect Animations: Venom DoT Bubbles & Solar Burn Flames
  if (h.venomStacks > 0) {
    ctx.save();
    const drops = Math.min(5, h.venomStacks + 1);
    for (let i = 0; i < drops; i++) {
      const vp = (time * 1.9 + i * (1 / drops) + phaseSeed) % 1;
      const vx = Math.sin(time * 4 + i * 2.2) * 20;
      const vy = 16 - vp * (spriteH * 0.88);
      ctx.fillStyle = i % 2 === 0 ? '#84CC16' : '#BEF264';
      ctx.globalAlpha = (1 - vp) * 0.9;
      ctx.beginPath();
      ctx.arc(vx, vy, 3.2 + (i % 2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  if (h.burnTimer > 0) {
    ctx.save();
    for (let i = 0; i < 4; i++) {
      const fp = (time * 2.8 + i * 0.25 + phaseSeed) % 1;
      const fx = Math.cos(time * 5 + i * 1.7) * 18;
      const fy = 12 - fp * (spriteH * 0.85);
      ctx.fillStyle = i % 2 === 0 ? '#FBBF24' : '#F97316';
      ctx.globalAlpha = (1 - fp) * 0.92;
      ctx.beginPath();
      ctx.moveTo(fx, fy - 5);
      ctx.lineTo(fx + 3.5, fy + 2);
      ctx.lineTo(fx - 3.5, fy + 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Active Shield Halo (rotating runic barrier arcs)
  if (h.shield > 1) {
    ctx.save();
    const sr = Math.max(h.w, h.h) * 0.78;
    ctx.strokeStyle = 'rgba(103, 232, 249, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -10, sr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#67E8F9';
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const a = time * 2.6 + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(0, -10, sr + 2, a, a + 0.85);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Endgame Ascension Crown (orbiting golden relic diamonds scaling with Ascension Infusions!)
  const ascStacks =
    (h.upgrades['asc_wrath'] ?? 0) +
    (h.upgrades['asc_titan'] ?? 0) +
    (h.upgrades['asc_alacrity'] ?? 0) +
    (h.upgrades['asc_siege'] ?? 0);
  if (ascStacks > 0) {
    const gems = Math.min(5, ascStacks);
    const crownY = h.h / 2 - spriteH - 2;
    ctx.save();
    for (let i = 0; i < gems; i++) {
      const a = time * 2.4 + (i * Math.PI * 2) / gems;
      const gx = Math.cos(a) * 22;
      const gy = crownY + Math.sin(a) * 5;
      ctx.fillStyle = '#FBBF24';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(gx, gy - 4.5);
      ctx.lineTo(gx + 3.5, gy);
      ctx.lineTo(gx, gy + 4.5);
      ctx.lineTo(gx - 3.5, gy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  // Stun stars
  if (h.stunTimer > 0) {
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const a = time * 8 + (i * Math.PI * 2) / 3;
      ctx.fillStyle = '#FDE047';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 20, h.h / 2 - spriteH - 12 + Math.sin(a) * 4, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.globalAlpha = 1;
  const barY = sprite ? h.h / 2 - spriteH - 16 : -h.h / 2 - 26;
  drawHeroOverheadHud(ctx, h, barY, teamCol, def.accentColor);
  ctx.restore();
}

// 1. MARROW-HOOK (Hybrid · Primordial × Cyber — Pudge-Style Executioner)
function drawMarrowBody(
  ctx: CanvasRenderingContext2D,
  h: HeroEntity,
  flash: boolean,
  teamCol: string,
  stride: number,
  time: number
): void {
  const f = h.facing;

  // Pneumatic Chain Winch Spool mounted behind off-shoulder
  ctx.save();
  ctx.translate(-f * 17, -14);
  ctx.fillStyle = '#334155';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.stroke();
  // Exhaust chimney venting toxic fumes
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(-3, -15, 6, 9);
  ctx.strokeStyle = INK;
  ctx.strokeRect(-3, -15, 6, 9);
  const puff = (time * 3) % 1;
  ctx.fillStyle = `rgba(52, 211, 153, ${(0.7 - puff * 0.7).toFixed(2)})`;
  ctx.beginPath();
  ctx.arc(-f * 3 * puff, -18 - puff * 14, 3 + puff * 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Heavy Iron Butcher Boots
  ctx.fillStyle = '#18181B';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.roundRect(-16 + stride * 0.55, 11, 13, 16, 3);
  ctx.roundRect(3 - stride * 0.55, 11, 13, 16, 3);
  ctx.fill();
  ctx.stroke();
  // Toe iron caps
  ctx.fillStyle = '#52525B';
  ctx.fillRect(-16 + stride * 0.55, 22, 13, 5);
  ctx.fillRect(3 - stride * 0.55, 22, 13, 5);

  // Hulking Stitched-Hide & Iron Executioner Torso
  ctx.fillStyle = flash ? '#FFFFFF' : '#3F3F46';
  ctx.beginPath();
  ctx.moveTo(-22, -16);
  ctx.lineTo(22, -16);
  ctx.lineTo(24, 10);
  ctx.lineTo(16, 17);
  ctx.lineTo(-16, 17);
  ctx.lineTo(-24, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Leather butcher apron flap & stitching
  ctx.fillStyle = flash ? '#FFFFFF' : '#292524';
  ctx.beginPath();
  ctx.moveTo(-14, 6);
  ctx.lineTo(14, 6);
  ctx.lineTo(11, 21);
  ctx.lineTo(-11, 21);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Glowing Ribbed Blight Furnace Boiler in Gut
  const glow = h.rotTimer > 0 ? '#6EE7B7' : '#10B981';
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(f * 2, 1, 10.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Iron furnace grate bars
  ctx.strokeStyle = '#064E3B';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(f * 2 - 8, -2);
  ctx.lineTo(f * 2 + 8, -2);
  ctx.moveTo(f * 2 - 8, 4);
  ctx.lineTo(f * 2 + 8, 4);
  ctx.stroke();

  // Bone-Spiked Iron Shoulder Pauldrons + Team Band
  ctx.fillStyle = '#52525B';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(-18, -12, 9.5, 0, Math.PI * 2);
  ctx.arc(18, -12, 9.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Bone spikes
  ctx.fillStyle = '#FEF3C7';
  ctx.beginPath();
  ctx.moveTo(-22, -18);
  ctx.lineTo(-28, -28);
  ctx.lineTo(-15, -20);
  ctx.closePath();
  ctx.moveTo(22, -18);
  ctx.lineTo(28, -28);
  ctx.lineTo(15, -20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = teamCol;
  ctx.fillRect(-19, -15, 38, 4.5);

  // Iron Executioner Skull-Grille Mask
  ctx.fillStyle = flash ? '#FFFFFF' : '#52525B';
  ctx.beginPath();
  ctx.roundRect(-12, -32, 24, 21, 7);
  ctx.fill();
  ctx.stroke();
  // Glowing emerald butcher eye slit
  ctx.fillStyle = '#34D399';
  ctx.fillRect(f > 0 ? 0 : -10, -25, 10, 4.5);
  // Mask breathing rivets
  ctx.fillStyle = '#18181B';
  ctx.fillRect(f > 0 ? 2 : -8, -17, 6, 3);

  // Brutal Serrated Plasma Cleaver Arm
  ctx.save();
  ctx.translate(f * 6, -2);
  ctx.rotate(h.aimAngle);
  const swing = h.recoilTimer > 0 ? 0.65 * f : 0;
  ctx.rotate(swing);
  // Heavy hilt & butcher cleaver blade
  ctx.fillStyle = '#78350F';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.fillRect(4, -3, 12, 6);
  ctx.strokeRect(4, -3, 12, 6);
  ctx.fillStyle = '#CBD5E1';
  ctx.beginPath();
  ctx.moveTo(14, -10);
  ctx.lineTo(39, -12);
  ctx.lineTo(42, 4);
  ctx.lineTo(14, 9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Superheated emerald plasma cutting edge
  ctx.fillStyle = '#10B981';
  ctx.fillRect(15, 4, 26, 4.5);
  ctx.fillStyle = '#ECFDF5';
  ctx.fillRect(17, 5.5, 22, 1.8);
  ctx.restore();
}

// 2. SERAPH-9 (Hybrid · Sacred × Cyber — Winged Cyber-Seraph)
function drawSeraphBody(
  ctx: CanvasRenderingContext2D,
  h: HeroEntity,
  flash: boolean,
  teamCol: string,
  stride: number,
  time: number
): void {
  const f = h.facing;
  const wingFlap = Math.sin(time * (h.isHovering ? 18 : 5.5)) * (h.isHovering ? 7 : 3.5);

  // 3-Tier Articulated Hard-Light Plasma Wings!
  for (const side of [-1, 1]) {
    ctx.save();
    for (let tier = 0; tier < 3; tier++) {
      const spanX = (36 - tier * 6) * side;
      const spanY = -24 + tier * 10 + wingFlap * (1 - tier * 0.2);
      ctx.fillStyle = tier === 0 ? 'rgba(56, 189, 248, 0.85)' : 'rgba(125, 211, 252, 0.58)';
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(side * 6, -8 + tier * 4);
      ctx.lineTo(spanX, spanY);
      ctx.lineTo(spanX * 0.68, spanY + 11);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  // Flowing Crimson-Gold Seraphic Tabard
  const capeSway = -h.vx * 0.025 + Math.sin(time * 5) * 2.5;
  ctx.fillStyle = '#9F1239';
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-7, 6);
  ctx.lineTo(7, 6);
  ctx.lineTo(9 + capeSway, 24);
  ctx.lineTo(capeSway, 28);
  ctx.lineTo(-9 + capeSway, 24);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Gilded Greaves
  ctx.fillStyle = '#E2E8F0';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.3;
  ctx.fillRect(-10 + stride * 0.5, 11, 7, 13);
  ctx.strokeRect(-10 + stride * 0.5, 11, 7, 13);
  ctx.fillRect(3 - stride * 0.5, 11, 7, 13);
  ctx.strokeRect(3 - stride * 0.5, 11, 7, 13);

  // Ivory & Gold Cathedral Cyber-Cuirass
  ctx.fillStyle = flash ? '#FFFFFF' : '#F8FAFC';
  ctx.beginPath();
  ctx.moveTo(-14, -13);
  ctx.lineTo(14, -13);
  ctx.lineTo(11, 13);
  ctx.lineTo(-11, 13);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Gilded shoulder wings & cyan chest core
  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(-15, -14, 30, 5);
  ctx.fillStyle = teamCol;
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(6, 0);
  ctx.lineTo(0, 7);
  ctx.lineTo(-6, 0);
  ctx.closePath();
  ctx.fill();

  // Winged Cyber-Helm + Floating Segmented Golden Halo
  ctx.fillStyle = flash ? '#FFFFFF' : '#F1F5F9';
  ctx.beginPath();
  ctx.arc(0, -21, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Helm crest plume
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.moveTo(-f * 4, -29);
  ctx.lineTo(-f * 14, -36);
  ctx.lineTo(-f * 8, -23);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Glowing cyan angelic visor
  ctx.fillStyle = '#38BDF8';
  ctx.fillRect(f > 0 ? 1 : -9, -23, 8, 4);

  // Rotating Golden Cyber-Halo
  ctx.save();
  ctx.translate(0, -35 + Math.sin(time * 4) * 1.5);
  ctx.strokeStyle = '#FBBF24';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 4.2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.arc(Math.cos(time * 4) * 14, Math.sin(time * 4) * 4.2, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Radiant Glaive Lance with Spinning Emitter Ring
  ctx.save();
  ctx.translate(0, -2);
  ctx.rotate(h.aimAngle);
  const kick = h.recoilTimer > 0 ? -5 : 0;
  ctx.fillStyle = '#D97706';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.fillRect(4 + kick, -2.5, 26, 5);
  ctx.strokeRect(4 + kick, -2.5, 26, 5);
  // Hard-light spearhead
  ctx.fillStyle = '#38BDF8';
  ctx.beginPath();
  ctx.moveTo(28 + kick, -7);
  ctx.lineTo(46 + kick, 0);
  ctx.lineTo(28 + kick, 7);
  ctx.lineTo(32 + kick, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.arc(28 + kick, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 3. KORAK (Purist · Pure Primordial Witch Doctor — Zero Tech!)
function drawKorakBody(
  ctx: CanvasRenderingContext2D,
  h: HeroEntity,
  flash: boolean,
  teamCol: string,
  time: number
): void {
  const f = h.facing;
  const hover = Math.sin(time * 4.2) * 3.5;
  ctx.translate(0, hover);

  // Swirling Primordial Mist beneath floating robes
  ctx.fillStyle = 'rgba(16, 185, 129, 0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 22, 16, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tattered Feathered Swamp Shaman Robes
  const robeSway = -h.vx * 0.02;
  ctx.fillStyle = flash ? '#FFFFFF' : '#065F46';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-18 + robeSway, 21);
  ctx.lineTo(-12, -13);
  ctx.lineTo(12, -13);
  ctx.lineTo(18 + robeSway, 21);
  ctx.lineTo(8 + robeSway, 16);
  ctx.lineTo(0 + robeSway, 23);
  ctx.lineTo(-8 + robeSway, 16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Layered Moss-Feather Mantle + Bone Bead Necklace
  ctx.fillStyle = '#047857';
  ctx.beginPath();
  ctx.moveTo(-16, -4);
  ctx.lineTo(-11, -14);
  ctx.lineTo(11, -14);
  ctx.lineTo(16, -4);
  ctx.lineTo(0, 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = teamCol;
  ctx.fillRect(-10, 4, 20, 4);

  // Bone bead necklace dots
  ctx.fillStyle = '#FEF3C7';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.arc(i * 4, -7 + Math.abs(i) * 1.2, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Carved Ivory Skull Mask
  ctx.fillStyle = flash ? '#FFFFFF' : '#FEF3C7';
  ctx.beginPath();
  ctx.ellipse(0, -19, 11.5, 12.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Tribal jaw markings & glowing jade spirit eyes
  ctx.fillStyle = '#064E3B';
  ctx.fillRect(f * 3 - 5, -13, 10, 3);
  ctx.fillStyle = '#34D399';
  ctx.beginPath();
  ctx.arc(f * 4 - 3.5, -20, 2.8, 0, Math.PI * 2);
  ctx.arc(f * 4 + 3.5, -20, 2.8, 0, Math.PI * 2);
  ctx.fill();

  // Branching Stag Antlers with Hanging Bone Fetishes
  ctx.strokeStyle = '#E7E5E4';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-8, -26);
  ctx.lineTo(-16, -38);
  ctx.lineTo(-22, -35);
  ctx.moveTo(-13, -34);
  ctx.lineTo(-11, -43);
  ctx.moveTo(8, -26);
  ctx.lineTo(16, -38);
  ctx.lineTo(22, -35);
  ctx.moveTo(13, -34);
  ctx.lineTo(11, -43);
  ctx.stroke();

  // Hanging jade charm bead on antler
  ctx.fillStyle = '#34D399';
  ctx.beginPath();
  ctx.arc(-18, -30 + Math.sin(time * 5) * 1.5, 2.6, 0, Math.PI * 2);
  ctx.arc(18, -30 + Math.cos(time * 5) * 1.5, 2.6, 0, Math.PI * 2);
  ctx.fill();

  // Gnarled Wood & Skull Spirit Staff
  ctx.save();
  ctx.translate(0, -2);
  ctx.rotate(h.aimAngle);
  ctx.fillStyle = '#78350F';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(6, -3);
  ctx.lineTo(27, -2);
  ctx.lineTo(27, 2.5);
  ctx.lineTo(6, 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Cradled Jade Spirit Orb
  ctx.fillStyle = 'rgba(52, 211, 153, 0.35)';
  ctx.beginPath();
  ctx.arc(32, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#34D399';
  ctx.beginPath();
  ctx.arc(32, 0, 6.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ECFDF5';
  ctx.beginPath();
  ctx.arc(30, -2, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 4. VORG (Purist · Pure Occult Warlock — Zero Tech!)
function drawVorgBody(
  ctx: CanvasRenderingContext2D,
  h: HeroEntity,
  flash: boolean,
  teamCol: string,
  stride: number,
  time: number
): void {
  const f = h.facing;
  const trail = -h.vx * 0.032;

  // Billowing Jagged Void-Violet Warlock Cloak Tails
  ctx.fillStyle = '#2E1065';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.3;
  ctx.beginPath();
  ctx.moveTo(-f * 6, -12);
  ctx.lineTo(-f * 24 + trail, 8);
  ctx.lineTo(-f * 16 + trail, 18);
  ctx.lineTo(-f * 8 + trail * 0.5, 11);
  ctx.lineTo(0, 18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Agile Crouched Warlock Boots
  ctx.fillStyle = '#1E1B4B';
  ctx.fillRect(-10 + stride * 0.75, 9, 8, 13);
  ctx.strokeRect(-10 + stride * 0.75, 9, 8, 13);
  ctx.fillRect(2 - stride * 0.75, 9, 8, 13);
  ctx.strokeRect(2 - stride * 0.75, 9, 8, 13);

  // Occult Robed Torso with Runic Trim
  ctx.fillStyle = flash ? '#FFFFFF' : '#4C1D95';
  ctx.beginPath();
  ctx.roundRect(-13, -11, 26, 23, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = teamCol;
  ctx.fillRect(-9, -3, 18, 4);
  ctx.strokeStyle = '#C084FC';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-10, 7);
  ctx.lineTo(10, 7);
  ctx.stroke();

  // Deep Pointed Occult Cowl + Twin Burning Amethyst Eyes
  ctx.fillStyle = flash ? '#FFFFFF' : '#1E103C';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-14, -8);
  ctx.lineTo(-f * 4, -33);
  ctx.lineTo(14, -8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Glowing Amethyst Eyes inside dark hood shadow
  ctx.fillStyle = '#E879F9';
  ctx.beginPath();
  ctx.arc(f * 3 - 2.5, -16, 2.2, 0, Math.PI * 2);
  ctx.arc(f * 3 + 3.5, -16, 2.2, 0, Math.PI * 2);
  ctx.fill();

  // Curved Floating Abyssal Pact-Horn Sigil above hood
  ctx.strokeStyle = '#C084FC';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(0, -34, 8, 0.25, Math.PI - 0.25);
  ctx.stroke();

  // Orbiting mini eldritch rune sparks
  const rA = time * 4.5;
  ctx.fillStyle = '#D8B4FE';
  ctx.beginPath();
  ctx.arc(Math.cos(rA) * 19, -8 + Math.sin(rA) * 5, 2.5, 0, Math.PI * 2);
  ctx.arc(Math.cos(rA + Math.PI) * 19, -8 + Math.sin(rA + Math.PI) * 5, 2.5, 0, Math.PI * 2);
  ctx.fill();

  if (h.dashTimer > 0) {
    ctx.strokeStyle = '#E879F9';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -2, 25 + Math.sin(time * 30) * 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Crackling Eldritch Pact Focus Hand
  ctx.save();
  ctx.rotate(h.aimAngle);
  ctx.fillStyle = 'rgba(168, 85, 247, 0.42)';
  ctx.beginPath();
  ctx.arc(21, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#A855F7';
  ctx.beginPath();
  ctx.arc(21, 0, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#F5D0FE';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

// 5. BROTHER BASTION (Purist · Pure Sacred Templar — Zero Tech!)
function drawBastionBody(
  ctx: CanvasRenderingContext2D,
  h: HeroEntity,
  flash: boolean,
  teamCol: string,
  stride: number,
  time: number
): void {
  const f = h.facing;

  // Radiant Sunburst Iron Halo Bolted to Backplate
  ctx.save();
  ctx.translate(0, -16);
  const rayCol = h.meltdownTimer > 0 ? '#FEF08A' : '#D97706';
  ctx.strokeStyle = rayCol;
  ctx.lineWidth = 2.6;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * 0.88 + (i * Math.PI * 0.76) / 6;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 16, Math.sin(a) * 16);
    ctx.lineTo(Math.cos(a) * 28, Math.sin(a) * 28);
    ctx.stroke();
  }
  ctx.restore();

  // Heavy Iron Greaves
  ctx.fillStyle = '#334155';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.8;
  ctx.fillRect(-16 + stride * 0.5, 11, 13, 15);
  ctx.strokeRect(-16 + stride * 0.5, 11, 13, 15);
  ctx.fillRect(3 - stride * 0.5, 11, 13, 15);
  ctx.strokeRect(3 - stride * 0.5, 11, 13, 15);

  // Towering Vaulted Templar Reliquary Plate
  const bodyColor = flash
    ? '#FFFFFF'
    : h.meltdownTimer > 0 && Math.floor(time * 16) % 2 === 0
      ? '#FEF08A'
      : '#B45309';
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.roundRect(-21, -18, 42, 33, 8);
  ctx.fill();
  ctx.stroke();

  // Vaulted Cathedral Pauldrons
  ctx.fillStyle = '#D97706';
  ctx.beginPath();
  ctx.arc(-19, -13, 9.5, Math.PI * 0.6, Math.PI * 2.1);
  ctx.arc(19, -13, 9.5, -Math.PI * 0.1, Math.PI * 1.4);
  ctx.fill();
  ctx.stroke();

  // Stained-Glass Cathedral Cross on Chest + Tabard
  ctx.fillStyle = '#FEF08A';
  ctx.fillRect(-4, -13, 8, 22);
  ctx.fillRect(-11, -7, 22, 6);

  ctx.fillStyle = teamCol;
  ctx.fillRect(-17, 8, 34, 4.5);

  // Iconic Crusader Bucket Great-Helm
  ctx.fillStyle = flash ? '#FFFFFF' : '#E2E8F0';
  ctx.beginPath();
  ctx.roundRect(-12, -34, 24, 20, 4);
  ctx.fill();
  ctx.stroke();
  // Gold cross face-guard
  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(f > 0 ? 1 : -5, -34, 4, 20);
  // Glowing faith visor slit
  ctx.fillStyle = '#FEF08A';
  ctx.fillRect(f > 0 ? -2 : -10, -26, 12, 4);

  // Heavy Flaming Censer Mortar Cannon
  ctx.save();
  ctx.translate(0, -2);
  ctx.rotate(h.aimAngle);
  const kick = h.recoilTimer > 0 ? -5 : 0;
  ctx.fillStyle = '#D97706';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.fillRect(8 + kick, -6, 22, 12);
  ctx.strokeRect(8 + kick, -6, 22, 12);
  // Ornate burning censer sphere
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.arc(34 + kick, 0, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.arc(34 + kick, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 6. SISTER VEXIA (Hybrid · Sacred × Cyber — Xeno-Inquisitor)
function drawVexiaBody(
  ctx: CanvasRenderingContext2D,
  h: HeroEntity,
  flash: boolean,
  teamCol: string,
  stride: number,
  time: number
): void {
  const f = h.facing;
  const coatTrail = -h.vx * 0.03 + Math.sin(time * 6) * 2;

  // Billowing Crimson-Lined Obsidian Inquisitor Trench-Coat Tail
  ctx.fillStyle = '#4C0519';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-f * 6, -6);
  ctx.lineTo(-f * 22 + coatTrail, 20);
  ctx.lineTo(-f * 6 + coatTrail * 0.6, 22);
  ctx.lineTo(4, 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Agile Inquisitor Boots
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(-10 + stride * 0.65, 10, 8, 13);
  ctx.strokeRect(-10 + stride * 0.65, 10, 8, 13);
  ctx.fillRect(2 - stride * 0.65, 10, 8, 13);
  ctx.strokeRect(2 - stride * 0.65, 10, 8, 13);

  // Crimson & Gold Inquisitor Coat Torso
  ctx.fillStyle = flash ? '#FFFFFF' : '#9F1239';
  ctx.beginPath();
  ctx.roundRect(-13, -11, 26, 23, 6);
  ctx.fill();
  ctx.stroke();

  // Silver purity belt & team sash
  ctx.fillStyle = '#CBD5E1';
  ctx.fillRect(-13, 4, 26, 3.5);
  ctx.fillStyle = teamCol;
  ctx.fillRect(-10, -4, 20, 4);

  // Head + Cyan Cyber-Ocular Monocle
  ctx.fillStyle = flash ? '#FFFFFF' : '#F3C6A5';
  ctx.beginPath();
  ctx.arc(0, -17, 9.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38BDF8';
  ctx.beginPath();
  ctx.arc(f * 4.5, -18, 3.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#E0F2FE';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Iconic Tall Buckled Wide-Brimmed Witch-Hunter Hat
  ctx.fillStyle = '#18181B';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.ellipse(0, -24, 20, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-11, -24);
  ctx.lineTo(-3, -41);
  ctx.lineTo(5, -41);
  ctx.lineTo(11, -24);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Golden buckle band
  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(-9, -29, 18, 3.5);

  // Alien-Forged Double-Limbed Rail-Crossbow
  ctx.save();
  ctx.translate(0, -1);
  ctx.rotate(h.aimAngle);
  const kick = h.recoilTimer > 0 ? -4 : 0;
  ctx.fillStyle = '#CBD5E1';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.fillRect(7 + kick, -3.5, 24, 7);
  ctx.strokeRect(7 + kick, -3.5, 24, 7);
  // Swept alien bow limbs + glowing cyan plasma string
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(22 + kick, -14);
  ctx.lineTo(30 + kick, 0);
  ctx.lineTo(22 + kick, 14);
  ctx.stroke();
  ctx.strokeStyle = '#BAE6FD';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(22 + kick, -14);
  ctx.lineTo(14 + kick, 0);
  ctx.lineTo(22 + kick, 14);
  ctx.stroke();
  ctx.restore();
}

// 7. XYLAR (Purist · Pure Cyber-Alien Infiltrator — Pure Alien Tech!)
function drawXylarBody(
  ctx: CanvasRenderingContext2D,
  h: HeroEntity,
  flash: boolean,
  teamCol: string,
  stride: number,
  time: number
): void {
  const f = h.facing;

  // Translucent Dorsal Phase-Fins along Back
  ctx.fillStyle = 'rgba(56, 189, 248, 0.32)';
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-f * 9, -10);
  ctx.lineTo(-f * 23, -22 + Math.sin(time * 9) * 2);
  ctx.lineTo(-f * 15, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Digitigrade Alien Bio-Chitin Legs
  ctx.fillStyle = '#0F172A';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.3;
  ctx.fillRect(-9 + stride * 0.8, 9, 7, 13);
  ctx.strokeRect(-9 + stride * 0.8, 9, 7, 13);
  ctx.fillRect(2 - stride * 0.8, 9, 7, 13);
  ctx.strokeRect(2 - stride * 0.8, 9, 7, 13);

  // Sculpted Obsidian Exoskeleton with Glowing Cyan Vein Lines
  ctx.fillStyle = flash ? '#FFFFFF' : '#1E293B';
  ctx.beginPath();
  ctx.moveTo(-12, -11);
  ctx.lineTo(12, -11);
  ctx.lineTo(9, 11);
  ctx.lineTo(-9, 11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = teamCol;
  ctx.fillRect(-8, -5, 16, 3.8);
  // Bioluminescent vein ribs
  ctx.fillStyle = '#38BDF8';
  ctx.fillRect(-5, 2, 10, 2);

  // Swept Elongated Alien Predator Crest-Helm
  ctx.fillStyle = flash ? '#FFFFFF' : '#0F172A';
  ctx.beginPath();
  ctx.ellipse(-f * 2, -19, 14, 9, -f * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Triple Alien Sensor Optics
  ctx.fillStyle = h.cloakCritReady ? '#FDE047' : '#38BDF8';
  ctx.beginPath();
  ctx.arc(f * 6, -20, 2.3, 0, Math.PI * 2);
  ctx.arc(f * 2, -17, 1.8, 0, Math.PI * 2);
  ctx.arc(f * 7, -16, 1.6, 0, Math.PI * 2);
  ctx.fill();

  // Curved Twin Hard-Light Plasma Wrist-Daggers (Flare Gold when Ambush Crit Ready!)
  ctx.save();
  ctx.rotate(h.aimAngle);
  const slash = h.recoilTimer > 0 ? 0.35 : 0;
  ctx.rotate(slash);
  const bladeCol = h.cloakCritReady ? '#FDE047' : '#38BDF8';
  ctx.fillStyle = bladeCol;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(10, -9);
  ctx.lineTo(33, -4);
  ctx.lineTo(14, -1.5);
  ctx.closePath();
  ctx.moveTo(10, 1.5);
  ctx.lineTo(33, 4);
  ctx.lineTo(10, 9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// 8. ARCH-LICH CALDRIS (Hybrid · Primordial × Cyber — Cyber-Necromancer)
function drawCaldrisBody(
  ctx: CanvasRenderingContext2D,
  h: HeroEntity,
  flash: boolean,
  teamCol: string,
  time: number
): void {
  const f = h.facing;
  const hover = Math.sin(time * 4) * 3.8;
  ctx.translate(0, hover);

  // Dual Anti-Grav Hover Propulsion Rings
  ctx.fillStyle = 'rgba(45, 212, 191, 0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 24, 17, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2DD4BF';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 20, 12, 3.5, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Armored Gothic-Chrome Mantle & Spire-Skirt
  ctx.fillStyle = flash ? '#FFFFFF' : '#1E293B';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-17, 19);
  ctx.lineTo(-14, -13);
  ctx.lineTo(14, -13);
  ctx.lineTo(17, 19);
  ctx.lineTo(7, 14);
  ctx.lineTo(0, 20);
  ctx.lineTo(-7, 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Glowing Spectral Ribcage Breastplate
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(-8, -9, 16, 17);
  ctx.fillStyle = '#2DD4BF';
  ctx.fillRect(-6, -7, 12, 2.5);
  ctx.fillRect(-5, -2, 10, 2.5);
  ctx.fillRect(-4, 3, 8, 2.5);

  ctx.fillStyle = teamCol;
  ctx.fillRect(-13, -13, 26, 4);

  // Spiked Steel Shoulder Pauldrons
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.moveTo(-12, -13);
  ctx.lineTo(-23, -20);
  ctx.lineTo(-15, -5);
  ctx.closePath();
  ctx.moveTo(12, -13);
  ctx.lineTo(23, -20);
  ctx.lineTo(15, -5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Horned Cyber-Lich Skull Head
  ctx.fillStyle = flash ? '#FFFFFF' : '#CBD5E1';
  ctx.beginPath();
  ctx.arc(0, -20, 10.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Glowing Teal Cyber-Optic Eye Socket
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(f > 0 ? 0 : -9, -23, 9, 5);
  ctx.fillStyle = '#2DD4BF';
  ctx.beginPath();
  ctx.arc(f > 0 ? 5 : -5, -20.5, 2.4, 0, Math.PI * 2);
  ctx.fill();

  // Orbital Uplink Crown Antennae (Crackling with Satellite Telemetry)
  ctx.strokeStyle = '#2DD4BF';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-9, -27);
  ctx.lineTo(-13, -38);
  ctx.moveTo(0, -30);
  ctx.lineTo(0, -42);
  ctx.moveTo(9, -27);
  ctx.lineTo(13, -38);
  ctx.stroke();
  ctx.fillStyle = '#A7F3D0';
  ctx.beginPath();
  ctx.arc(0, -42, 2.5 + Math.sin(time * 10) * 0.8, 0, Math.PI * 2);
  ctx.fill();

  // Floating Tethered Soul-Rail Crystal Focus
  ctx.save();
  ctx.rotate(h.aimAngle);
  ctx.strokeStyle = 'rgba(45, 212, 191, 0.55)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(24, 0);
  ctx.stroke();
  ctx.fillStyle = '#2DD4BF';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(31, 0);
  ctx.lineTo(24, -7);
  ctx.lineTo(17, 0);
  ctx.lineTo(24, 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// 9. PLAGUE-CANTOR VESPRA (Hybrid · Primordial × Occult — DoT Venom Specialist)
function drawVespraBody(
  ctx: CanvasRenderingContext2D,
  h: HeroEntity,
  flash: boolean,
  teamCol: string,
  stride: number,
  time: number
): void {
  const f = h.facing;
  const sway = -h.vx * 0.02 + Math.sin(time * 4.5) * 2;
  ctx.fillStyle = flash ? '#FFFFFF' : '#1E293B';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-15 + sway, 22);
  ctx.lineTo(-11, -12);
  ctx.lineTo(11, -12);
  ctx.lineTo(15 + sway, 22);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Plague doctor beak mask & emerald visor lenses
  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.moveTo(-8, -20);
  ctx.lineTo(f * 16, -15);
  ctx.lineTo(-4, -12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#84CC16';
  ctx.beginPath();
  ctx.arc(f * 3, -18, 2.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = teamCol;
  ctx.fillRect(-10, -4, 20, 4);

  // Brass toxic censer staff
  ctx.save();
  ctx.rotate(h.aimAngle);
  ctx.fillStyle = '#D97706';
  ctx.fillRect(4 + stride * 0.1, -2.5, 22, 5);
  ctx.fillStyle = '#84CC16';
  ctx.beginPath();
  ctx.arc(28, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// 10. SOLARION VALE (Hybrid · Sacred × Cyber — Astral Chronomancer)
function drawValeBody(
  ctx: CanvasRenderingContext2D,
  h: HeroEntity,
  flash: boolean,
  teamCol: string,
  stride: number,
  time: number
): void {
  const f = h.facing;
  // Rotating golden sundial halo
  ctx.save();
  ctx.translate(0, -16);
  ctx.rotate(time * 2);
  ctx.strokeStyle = '#FBBF24';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = flash ? '#FFFFFF' : '#F8FAFC';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.roundRect(-12, -12, 24, 26, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = teamCol;
  ctx.fillRect(-10, -3, 20, 4);

  // Hooded astral helmet
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.arc(0, -20, 9.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#38BDF8';
  ctx.fillRect(f > 0 ? 1 : -8, -22, 7, 4);

  // Prism lance focus
  ctx.save();
  ctx.rotate(h.aimAngle);
  ctx.fillStyle = '#FBBF24';
  ctx.beginPath();
  ctx.moveTo(36, 0);
  ctx.lineTo(14 + stride * 0.1, -6);
  ctx.lineTo(18 + stride * 0.1, 0);
  ctx.lineTo(14 + stride * 0.1, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/* =========================================================================
   OVERHEAD HUD, SUMMONS, PROJECTILES, AMBIENT MOTES & CROSSHAIR
   ========================================================================= */

function drawHeroOverheadHud(
  ctx: CanvasRenderingContext2D,
  h: HeroEntity,
  y: number,
  teamCol: string,
  accentColor: string
): void {
  const barW = h.isPlayer ? 58 : 50;
  const barH = h.isPlayer ? 7 : 6;
  const ratio = Math.max(0, Math.min(1, h.hp / h.maxHp));

  ctx.fillStyle = 'rgba(7, 9, 15, 0.9)';
  ctx.fillRect(-barW / 2 - 1, y - 1, barW + 2, barH + 2);
  ctx.fillStyle = h.isPlayer ? '#38BDF8' : teamCol;
  ctx.fillRect(-barW / 2, y, barW * ratio, barH);

  if (h.shield > 0) {
    const sRatio = Math.min(1, h.shield / h.maxHp);
    ctx.fillStyle = '#67E8F9';
    ctx.fillRect(-barW / 2, y - 2.5, barW * sRatio, 2.5);
  }

  // Active DoT badges beside overhead HP bar (Venom stacks & Solar Burn)
  let badgeX = barW / 2 + 5;
  if (h.venomStacks > 0) {
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#BEF264';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    const vText = `×${h.venomStacks}`;
    ctx.strokeText(vText, badgeX, y + barH + 1);
    ctx.fillText(vText, badgeX, y + barH + 1);
    badgeX += 18;
  }
  if (h.burnTimer > 0) {
    ctx.fillStyle = '#FBBF24';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(badgeX + 4, y - 1);
    ctx.lineTo(badgeX + 8, y + barH + 1);
    ctx.lineTo(badgeX, y + barH + 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  if (h.isPlayer) {
    ctx.fillStyle = '#FBBF24';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y - 5);
    ctx.lineTo(-6, y - 13);
    ctx.lineTo(6, y - 13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.font = '700 10px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = h.team === 'blue' ? '#BAE6FD' : '#FECDD3';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.strokeText(h.name.split(' ')[0], 0, y - 4);
    ctx.fillText(h.name.split(' ')[0], 0, y - 4);
  }

  ctx.fillStyle = accentColor;
  ctx.fillRect(-barW / 2 - 5, y, 3, barH);
}

function drawSummon(ctx: CanvasRenderingContext2D, s: SummonEntity, time: number): void {
  const isBlue = s.team === 'blue';
  const teamCol = isBlue ? '#38BDF8' : '#F43F5E';

  ctx.save();
  ctx.translate(s.x, s.y);

  if (s.kind === 'bull') {
    // Holo-Seraph Charger Ram with galloping energy legs & forward ram shock-cone
    const gallop = Math.sin(time * 22);
    ctx.globalAlpha = 0.92;
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-14, 12);
    ctx.lineTo(-18 + gallop * 8, 22);
    ctx.moveTo(12, 12);
    ctx.lineTo(16 - gallop * 8, 22);
    ctx.stroke();

    ctx.fillStyle =
      s.hitFlashTimer > 0
        ? '#FFFFFF'
        : isBlue
          ? 'rgba(56, 189, 248, 0.72)'
          : 'rgba(244, 63, 94, 0.76)';
    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.roundRect(-26, -18 + Math.abs(gallop) * 2.5, 52, 32, 10);
    ctx.fill();
    ctx.stroke();

    // Swept hard-light wings & forward ramming shock cone
    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.moveTo(s.facing * 20, -14);
    ctx.lineTo(s.facing * 38, -24);
    ctx.lineTo(s.facing * 30, -2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(254, 240, 138, 0.65)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(s.facing * 18, 0, 26, s.facing > 0 ? -0.9 : Math.PI - 0.9, s.facing > 0 ? 0.9 : Math.PI + 0.9);
    ctx.stroke();

    drawCompactBar(ctx, 0, -29, 46, 5, s.hp / s.maxHp, teamCol);
  } else if (s.kind === 'totem') {
    // Korak's Skull Spirit Totem + Expanding Primordial Healing Wave Ring
    const pulse = 0.5 + 0.5 * Math.sin(time * 5);
    const wave = (time * 1.15) % 1;
    ctx.fillStyle = isBlue ? 'rgba(16, 185, 129, 0.14)' : 'rgba(244, 63, 94, 0.12)';
    ctx.strokeStyle = isBlue ? '#34D399' : '#FB7185';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, s.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.55 + pulse * 0.35;
    ctx.stroke();

    // Expanding healing pulse ring
    ctx.globalAlpha = (1 - wave) * 0.7;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 18 + wave * (s.radius - 18), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Carved Bone Totem Pillar with glowing spirit eyes
    ctx.fillStyle = s.hitFlashTimer > 0 ? '#FFFFFF' : '#FEF3C7';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-12, -20, 24, 38, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#10B981';
    ctx.fillRect(-6, -11, 4, 4);
    ctx.fillRect(2, -11, 4, 4);
    drawCompactBar(ctx, 0, -30, 38, 4, s.life / s.maxLife, '#34D399');
  } else if (s.kind === 'drone') {
    // Korak's Orbiting Ancestral Spirit Skull + spectral trail
    ctx.fillStyle = 'rgba(52, 211, 153, 0.32)';
    ctx.beginPath();
    ctx.arc(0, 0, 14 + Math.sin(time * 9) * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FEF3C7';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#34D399';
    ctx.fillRect(-4.5, -2.5, 3, 3.5);
    ctx.fillRect(1.5, -2.5, 3, 3.5);
  }

  ctx.restore();
}

function drawProjectile(ctx: CanvasRenderingContext2D, p: ProjectileEntity, time: number): void {
  ctx.save();
  ctx.translate(p.x, p.y);
  // Pulsing light halo so every projectile reads as energy, not a flat shape
  drawGlow(ctx, 0, 0, Math.max(14, p.radius * 2.4) * (1 + Math.sin(time * 30 + p.x * 0.05) * 0.08), p.color || '#FFFFFF', 0.75);
  const angle = Math.atan2(p.vy, p.vx);

  if (p.kind === 'cleaver') {
    ctx.rotate(angle);
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, -1.15, 1.15);
    ctx.stroke();
    ctx.strokeStyle = '#ECFDF5';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(2, 0, p.radius - 3, -0.95, 0.95);
    ctx.stroke();
  } else if (p.kind === 'venom_dart') {
    // Plague-Cantor Vespra's Venom Needle Dart with toxic comet tail
    ctx.rotate(angle);
    const tGrad = ctx.createLinearGradient(-28, 0, 12, 0);
    tGrad.addColorStop(0, 'rgba(132, 204, 22, 0)');
    tGrad.addColorStop(1, 'rgba(132, 204, 22, 0.85)');
    ctx.strokeStyle = tGrad;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(-26, 0);
    ctx.lineTo(10, 0);
    ctx.stroke();

    ctx.fillStyle = '#84CC16';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(-6, -4.5);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-6, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ECFCCB';
    ctx.fillRect(-1, -1.3, 9, 2.6);
  } else if (p.kind === 'censer_bomb') {
    // Spinning brass-and-emerald fuming Miasma Censer flask
    ctx.rotate(time * 10);
    ctx.fillStyle = 'rgba(132, 204, 22, 0.32)';
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#B45309';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#84CC16';
    ctx.beginPath();
    ctx.arc(0, 0, p.radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === 'prism_lance') {
    // Solarion Vale's golden-cyan Prism Lance beam bolt
    ctx.rotate(angle);
    const lGrad = ctx.createLinearGradient(-34, 0, 18, 0);
    lGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
    lGrad.addColorStop(0.55, 'rgba(251, 191, 36, 0.78)');
    lGrad.addColorStop(1, '#FEF08A');
    ctx.strokeStyle = lGrad;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-34, 0);
    ctx.lineTo(18, 0);
    ctx.stroke();

    ctx.fillStyle = '#FBBF24';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-4, -5.5);
    ctx.lineTo(0, 0);
    ctx.lineTo(-4, 5.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-2, -1.6, 15, 3.2);
  } else if (p.kind === 'solar_disc') {
    // Spinning golden sundial astrolabe disc
    ctx.rotate(time * 14);
    ctx.fillStyle = 'rgba(251, 191, 36, 0.34)';
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FBBF24';
    ctx.fillStyle = '#FEF08A';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#0284C7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-p.radius, 0);
    ctx.lineTo(p.radius, 0);
    ctx.moveTo(0, -p.radius);
    ctx.lineTo(0, p.radius);
    ctx.stroke();
  } else if (p.kind === 'spear') {
    ctx.rotate(angle);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-34, 0);
    ctx.lineTo(-10, 0);
    ctx.stroke();
    ctx.fillStyle = '#FBBF24';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(24, 0);
    ctx.lineTo(-14, -7.5);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-14, 7.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#BAE6FD';
    ctx.fillRect(-4, -2, 16, 4);
  } else if (p.kind === 'soul_orb' || p.kind === 'singularity_orb') {
    ctx.fillStyle = `${p.color}44`;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 6 + Math.sin(time * 16) * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.color;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-2, -2, p.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === 'dynamite') {
    ctx.rotate(time * 12);
    ctx.fillStyle = '#F43F5E';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.fillRect(-8, -4.5, 16, 9);
    ctx.strokeRect(-8, -4.5, 16, 9);
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(10, -4, 4.2 + Math.sin(time * 32) * 1.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === 'biobeam') {
    ctx.rotate(angle);
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 3, -0.95, 0.95);
    ctx.stroke();
    ctx.strokeStyle = '#ECFDF5';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(2, 0, p.radius - 1, -0.7, 0.7);
    ctx.stroke();
  } else if (p.kind === 'mortar' || p.kind === 'missile' || p.kind === 'drone_kamikaze') {
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(251, 146, 60, 0.45)';
    ctx.beginPath();
    ctx.moveTo(-p.radius, -4);
    ctx.lineTo(-p.radius - 16, 0);
    ctx.lineTo(-p.radius, 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = p.color;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.radius + 3.5, p.radius * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(-p.radius, 0, 3.8, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.rotate(angle);
    // Subtle luminous velocity comet tail on bolts/shots
    ctx.strokeStyle = `${p.color}66`;
    ctx.lineWidth = Math.max(2.2, p.radius * 0.75);
    ctx.beginPath();
    ctx.moveTo(-p.radius * 3.2, 0);
    ctx.lineTo(0, 0);
    ctx.stroke();

    ctx.fillStyle = p.color;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(-p.radius * 1.45, -p.radius * 0.65, p.radius * 2.9, p.radius * 1.3, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-p.radius * 0.6, -p.radius * 0.25, p.radius * 1.2, p.radius * 0.5);
  }
  ctx.restore();
}

function drawAmbientMotes(
  ctx: CanvasRenderingContext2D,
  camX: number,
  viewW: number,
  time: number
): void {
  ctx.save();
  for (let i = 0; i < AMBIENT_MOTES.length; i++) {
    const m = AMBIENT_MOTES[i];
    const mx = m.baseX + Math.sin(time * 0.6 + m.phase) * 28;
    if (mx < camX - 30 || mx > camX + viewW + 30) continue;
    const my = m.baseY - ((time * m.speed + m.phase * 40) % 240);
    const alpha = 0.22 + 0.22 * Math.sin(time * 2.4 + m.phase);
    const isCrypt = Math.abs(mx - WORLD_W / 2) < 520;
    const isRight = mx > WORLD_W / 2 + 520;
    ctx.fillStyle = isCrypt
      ? `rgba(52, 211, 153, ${alpha.toFixed(2)})`
      : isRight
        ? `rgba(251, 113, 133, ${alpha.toFixed(2)})`
        : `rgba(251, 191, 36, ${alpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(mx, my, m.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCompactBar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  color: string,
  label?: string
): void {
  const clamped = Math.max(0, Math.min(1, ratio));
  ctx.fillStyle = 'rgba(7, 9, 15, 0.9)';
  ctx.fillRect(cx - w / 2 - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = color;
  ctx.fillRect(cx - w / 2, y, w * clamped, h);

  if (label) {
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.strokeText(label, cx, y - 4);
    ctx.fillText(label, cx, y - 4);
  }
}

function drawCrosshair(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.moveTo(-16, 0);
  ctx.lineTo(-6, 0);
  ctx.moveTo(6, 0);
  ctx.lineTo(16, 0);
  ctx.moveTo(0, -16);
  ctx.lineTo(0, -6);
  ctx.moveTo(0, 6);
  ctx.lineTo(0, 16);
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(0, 0, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEndCinematicOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cin: EndCinematicRenderState,
  time: number
): void {
  const t = cin.elapsed;
  const isWin = cin.localWon;

  ctx.save();

  // 1. Initial Core Shatter Impact Flash (0.0s -> 0.48s)
  if (t < 0.5) {
    const flash = Math.pow(1 - t / 0.5, 2.2);
    ctx.fillStyle = isWin
      ? `rgba(254, 249, 195, ${(flash * 0.62).toFixed(2)})`
      : `rgba(244, 63, 94, ${(flash * 0.48).toFixed(2)})`;
    ctx.fillRect(0, 0, width, height);
  }

  // 2. Atmospheric Cathedral Mood Wash (Golden Sanctum Glow vs Crimson Ash Desaturation)
  const moodAlpha = Math.min(1, t / 0.9);
  const wash = ctx.createRadialGradient(
    width * 0.5,
    height * 0.46,
    Math.min(width, height) * 0.14,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.72
  );
  if (isWin) {
    wash.addColorStop(0, `rgba(251, 191, 36, ${(0.1 * moodAlpha).toFixed(2)})`);
    wash.addColorStop(0.55, `rgba(14, 116, 144, ${(0.12 * moodAlpha).toFixed(2)})`);
    wash.addColorStop(1, `rgba(5, 8, 18, ${(0.62 * moodAlpha).toFixed(2)})`);
  } else {
    wash.addColorStop(0, `rgba(136, 19, 55, ${(0.14 * moodAlpha).toFixed(2)})`);
    wash.addColorStop(0.55, `rgba(30, 12, 22, ${(0.34 * moodAlpha).toFixed(2)})`);
    wash.addColorStop(1, `rgba(4, 5, 11, ${(0.76 * moodAlpha).toFixed(2)})`);
  }
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);

  // 3. Rising Golden Embers (Victory) or Drifting Crimson Ash (Defeat)
  const emberCount = 26;
  for (let i = 0; i < emberCount; i++) {
    const seed = (i * 2654435761) % 1000;
    const xBase = ((seed / 1000) * width + Math.sin(time * 0.9 + i) * 32 + width) % width;
    const speed = 38 + (i % 5) * 18;
    const yPos = isWin
      ? height - (((time * speed + seed) % (height + 80)) - 40)
      : ((time * speed * 0.65 + seed) % (height + 80)) - 40;
    const sz = 2 + (i % 3) * 1.4;
    ctx.fillStyle = isWin
      ? i % 3 === 0
        ? '#FEF08A'
        : '#F59E0B'
      : i % 3 === 0
        ? '#FB7185'
        : '#64748B';
    ctx.globalAlpha = (0.35 + 0.45 * Math.sin(time * 3 + i)) * moodAlpha;
    ctx.beginPath();
    ctx.arc(xBase, yPos, sz, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 4. Sliding Widescreen Gothic Cinema Letterbox Bars (0.0s -> 0.55s)
  const barEase = 1 - Math.pow(1 - Math.min(1, t / 0.55), 3);
  const barH = Math.round(Math.max(52, height * 0.11) * barEase);
  ctx.fillStyle = '#05070E';
  ctx.fillRect(0, 0, width, barH);
  ctx.fillRect(0, height - barH, width, barH);

  // Gilded / Crimson trim lines along letterbox borders
  const trimGrad = ctx.createLinearGradient(0, 0, width, 0);
  trimGrad.addColorStop(0, 'rgba(0,0,0,0)');
  trimGrad.addColorStop(0.2, isWin ? '#F59E0B' : '#E11D48');
  trimGrad.addColorStop(0.5, isWin ? '#FEF08A' : '#FDA4AF');
  trimGrad.addColorStop(0.8, isWin ? '#F59E0B' : '#E11D48');
  trimGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = trimGrad;
  ctx.fillRect(0, barH - 2, width, 2);
  ctx.fillRect(0, height - barH, width, 2);

  // 5. Dramatic Center Gothic Crest + Proclamation Banner Reveal (active during 0.85s -> end; dimmed once modal opens)
  if (t > 0.72 && !cin.completed) {
    const rev = Math.min(1, (t - 0.72) / 0.55);
    const spring = 1 + Math.sin(rev * Math.PI) * 0.08 * (1 - rev);
    const bannerAlpha = Math.min(1, rev * 1.4);
    const cx = width * 0.5;
    const cy = height * 0.44;

    ctx.save();
    ctx.globalAlpha = bannerAlpha;
    ctx.translate(cx, cy);
    ctx.scale(0.84 + 0.16 * rev * spring, 0.84 + 0.16 * rev * spring);

    // Radiant sunburst / fractured halo behind crest
    ctx.save();
    ctx.rotate(time * (isWin ? 0.22 : -0.08));
    for (let i = 0; i < 12; i++) {
      ctx.rotate((Math.PI * 2) / 12);
      const rg = ctx.createLinearGradient(0, 0, 210, 0);
      rg.addColorStop(0, isWin ? 'rgba(251, 191, 36, 0.32)' : 'rgba(225, 29, 72, 0.24)');
      rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(210, -24);
      ctx.lineTo(210, 24);
      ctx.lineTo(0, 6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Ornate Gothic Diamond Crest
    ctx.save();
    ctx.translate(0, -76);
    ctx.fillStyle = isWin ? '#0F172A' : '#180A12';
    ctx.strokeStyle = isWin ? '#F59E0B' : '#F43F5E';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(30, 0);
    ctx.lineTo(0, 34);
    ctx.lineTo(-30, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner emblem rune (Golden Sunburst Star for Victory, Fractured Core Shard for Defeat)
    ctx.fillStyle = isWin ? '#FEF08A' : '#FB7185';
    ctx.beginPath();
    if (isWin) {
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const r = i % 2 === 0 ? 18 : 7;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.moveTo(-4, -18);
      ctx.lineTo(10, -4);
      ctx.lineTo(2, 2);
      ctx.lineTo(9, 16);
      ctx.lineTo(-10, 4);
      ctx.lineTo(-2, -3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Sweeping dark-velvet ribbon plate behind title
    const ribbonW = Math.min(width * 0.72, 620) * Math.min(1, (t - 0.72) / 0.42);
    const ribGrad = ctx.createLinearGradient(-ribbonW / 2, 0, ribbonW / 2, 0);
    ribGrad.addColorStop(0, 'rgba(6, 9, 18, 0)');
    ribGrad.addColorStop(0.18, 'rgba(6, 9, 18, 0.88)');
    ribGrad.addColorStop(0.82, 'rgba(6, 9, 18, 0.88)');
    ribGrad.addColorStop(1, 'rgba(6, 9, 18, 0)');
    ctx.fillStyle = ribGrad;
    ctx.fillRect(-ribbonW / 2, -46, ribbonW, 96);

    // Metallic Proclamation Typography
    const title = isWin ? 'VICTORY' : 'DEFEAT';
    const fontSize = Math.round(Math.min(76, Math.max(46, width * 0.062)));
    ctx.font = `900 ${fontSize}px "Cinzel", "Bricolage Grotesque", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#05070F';
    ctx.strokeText(title, 0, -4);

    const textGrad = ctx.createLinearGradient(0, -fontSize * 0.5, 0, fontSize * 0.45);
    if (isWin) {
      textGrad.addColorStop(0, '#FEF9C3');
      textGrad.addColorStop(0.48, '#FBBF24');
      textGrad.addColorStop(1, '#B45309');
    } else {
      textGrad.addColorStop(0, '#FFE4E6');
      textGrad.addColorStop(0.5, '#F43F5E');
      textGrad.addColorStop(1, '#881337');
    }
    ctx.fillStyle = textGrad;
    ctx.fillText(title, 0, -4);

    // Subtitle line
    const subtitle = isWin
      ? cin.winner === 'blue'
        ? 'THE INVASION CORE HAS BEEN SHATTERED'
        : 'THE SANCTUM CORE HAS BEEN SHATTERED'
      : 'YOUR ANCIENT CORE HAS COLLAPSED';
    ctx.font = `700 13px "Space Grotesk", sans-serif`;
    ctx.fillStyle = isWin ? '#FDE68A' : '#FDA4AF';
    ctx.fillText(subtitle, 0, 34);

    ctx.restore();
  }

  // 6. Clean Skip Prompt inside bottom letterbox bar once canSkip is active
  if (cin.active && cin.canSkip && !cin.completed) {
    const promptAlpha = Math.min(1, (t - 1.1) / 0.4) * (0.65 + 0.25 * Math.sin(time * 4));
    ctx.save();
    ctx.globalAlpha = Math.max(0, promptAlpha);
    ctx.font = `600 11px "Space Grotesk", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#CBD5E1';
    ctx.fillText('CLICK OR PRESS SPACE FOR MATCH STANDINGS', width * 0.5, height - barH * 0.5);
    ctx.restore();
  }

  ctx.restore();
}
