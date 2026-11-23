import { HERO_MAP } from './heroes';
import { BASE_ZONES, JUMP_PADS, PLATFORMS, WORLD_H, WORLD_W } from './map';
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
  ctx.save();

  // 1. Storm-Torn Medieval Alien Invasion Sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
  skyGrad.addColorStop(0, '#050812');
  skyGrad.addColorStop(0.38, '#0D1426');
  skyGrad.addColorStop(0.76, '#1A1730');
  skyGrad.addColorStop(1, '#26192A');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height);

  const camX = state.camX + state.shakeX;
  const camY = state.camY + state.shakeY;

  // 2. Cosmic Slipstream Rift Tear & Fractured Eclipse Moon
  drawSkyRiftAndMoon(ctx, width, height, camX, state.time);

  // 3. Distant Rift Stars
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

  // 4. Hovering Alien Dreadnoughts & Escorts (slow parallax)
  drawAlienWarships(ctx, width, height, camX, state.time);

  // 5. Layered Shattered Gothic Cathedral Skyline (Sanctum Gold -> Crypt Emerald -> Invasion Crimson)
  drawCathedralSkyline(ctx, width, height, camX, state.time);

  // === ENTER WORLD SPACE ===
  ctx.save();
  ctx.translate(-Math.round(camX), -Math.round(camY));

  // 6. Biome-Differentiated Cathedral Interior, Crashed Alien Obelisk & Sunken Crypt Pit
  drawCathedralArchitecture(ctx, camX, width, state.time);

  // 7. Sanctum & Invasion Healing Altars
  drawBaseZone(ctx, BASE_ZONES.blue, state.time);
  drawBaseZone(ctx, BASE_ZONES.red, state.time);

  // 8. Platforms (Gothic Stone, Crenellated Battlements & Sanctuary Hard-Light Glass)
  for (const p of PLATFORMS) {
    if (p.x + p.w < camX - 100 || p.x > camX + width + 100) continue;
    drawPlatform(ctx, p, state.time);
  }

  // 9. Runic Gravity Jump Pads
  for (const jp of JUMP_PADS) {
    if (jp.x + jp.w < camX - 80 || jp.x > camX + width + 80) continue;
    drawJumpPad(ctx, jp, state.time);
  }

  // 10. Relic Essence Shards
  for (const sc of state.solarCubes) {
    if (sc.active) drawRelicShard(ctx, sc, state.time);
  }

  // 11. Neutral Crypt Spirits
  for (const creep of state.creeps) {
    if (creep.alive) drawCryptSpirit(ctx, creep, state.time);
  }

  // 12. Ancient Cores & 2-Tier Reliquary Towers
  const playerHero = state.heroes.find((h) => h.isPlayer);
  for (const core of state.cores) {
    drawAncientCore(ctx, core, state.time);
  }
  for (const turret of state.turrets) {
    drawReliquaryTower(ctx, turret, state.time, playerHero);
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
    drawDroid(ctx, d, state.time);
  }

  // 15. Active Abyssal Chain Hooks
  for (const hk of state.hooks) {
    drawChainHook(ctx, hk, state.time);
  }

  // 16. Champions (alive or descending in drop pods)
  for (const h of state.heroes) {
    if (h.inDropPod) {
      drawDropPodSequence(ctx, h, state.time);
    } else if (h.alive) {
      drawHero(ctx, h, state.time, state.localTeam);
    }
  }

  // 17. Active Holo-Seraph Rams & Orbiting Ancestral Skulls
  for (const s of state.summons) {
    if (s.kind !== 'totem') drawSummon(ctx, s, state.time);
  }

  // 18. Projectiles
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

  // 22. Tactical Aim Reticle
  if (playerHero && playerHero.alive && !playerHero.inDropPod) {
    drawCrosshair(ctx, state.mouseScreenX, state.mouseScreenY, HERO_MAP[playerHero.heroId].accentColor);
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
  time: number
): void {
  ctx.save();

  // 1. Vaulted Gothic Stone Columns Supporting the Top Cathedral Nave
  const pillarXs = [780, 1340, 1940, 2260, 3140, 3460, 4060, 4620];
  for (const px of pillarXs) {
    if (px < camX - 180 || px > camX + viewW + 180) continue;
    const isSanctum = px < WORLD_W / 2;
    const isCenter = px === 2260 || px === 3140;

    // Vaulted rib arch springing outward from top of column
    ctx.strokeStyle = '#1E2438';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(px - 22, 650);
    ctx.quadraticCurveTo(px - 75, 595, px - 125, 588);
    ctx.moveTo(px + 22, 650);
    ctx.quadraticCurveTo(px + 75, 595, px + 125, 588);
    ctx.stroke();

    // Column stone shaft
    const pGrad = ctx.createLinearGradient(px - 24, 0, px + 24, 0);
    pGrad.addColorStop(0, '#101421');
    pGrad.addColorStop(0.35, '#20263A');
    pGrad.addColorStop(0.75, '#171C2C');
    pGrad.addColorStop(1, '#0C0F19');
    ctx.fillStyle = pGrad;
    ctx.fillRect(px - 24, 578, 48, 382);
    ctx.strokeStyle = '#2B334D';
    ctx.lineWidth = 2;
    ctx.strokeRect(px - 24, 578, 48, 382);

    // Carved capital & plinth
    ctx.fillStyle = '#29314A';
    ctx.fillRect(px - 32, 578, 64, 16);
    ctx.fillRect(px - 32, 942, 64, 18);

    // Biome-specific inlays: Sanctum Gold Circuits vs Invasion Crimson-Cyan Crystals
    if (isCenter) {
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.42)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(px, 600);
      ctx.lineTo(px, 940);
      ctx.stroke();
    } else if (isSanctum) {
      // Engraved golden circuit & hanging cathedral banner
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.34)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, 600);
      ctx.lineTo(px, 940);
      ctx.stroke();

      // Swaying Sanctum Banner
      const sway = Math.sin(time * 2.2 + px * 0.01) * 4;
      ctx.fillStyle = '#1E3A8A';
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(px - 14, 622);
      ctx.lineTo(px + 14, 622);
      ctx.lineTo(px + 14 + sway, 720);
      ctx.lineTo(px + sway * 1.15, 742);
      ctx.lineTo(px - 14 + sway, 720);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Golden banner cross emblem
      ctx.fillStyle = '#FBBF24';
      ctx.fillRect(px - 2 + sway * 0.4, 646, 4, 34);
      ctx.fillRect(px - 8 + sway * 0.4, 656, 16, 4);

      // Flickering Wrought-Iron Wall Brazier
      drawWallBrazier(ctx, px, 845, '#F59E0B', '#FEF08A', time + px);
    } else {
      // Invasion Wing: Jagged Alien Obsidian Crystal Spire erupting through stone!
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px - 4, 605);
      ctx.lineTo(px + 5, 720);
      ctx.lineTo(px - 3, 830);
      ctx.lineTo(px + 4, 940);
      ctx.stroke();

      // Tattered Crimson Invasion Pennant
      const sway = Math.sin(time * 2.8 + px * 0.01) * 5;
      ctx.fillStyle = '#881337';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px - 14, 622);
      ctx.lineTo(px + 14, 622);
      ctx.lineTo(px + 12 + sway, 718);
      ctx.lineTo(px + 3 + sway, 696);
      ctx.lineTo(px - 5 + sway, 734);
      ctx.lineTo(px - 14 + sway, 704);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Protruding Alien Plasma Crystal Cluster
      ctx.fillStyle = '#1E1B4B';
      ctx.strokeStyle = '#F43F5E';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(px - 22, 920);
      ctx.lineTo(px - 42, 868);
      ctx.lineTo(px - 18, 882);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      drawWallBrazier(ctx, px, 845, '#F43F5E', '#38BDF8', time + px);
    }
  }

  // 2. Grand Shattered Rose Window & Crashed Alien Obelisk at World Center (x = 2700)
  const cx = WORLD_W / 2;
  if (cx > camX - 420 && cx < camX + viewW + 420) {
    // Vaulted Gothic Stone Arch framing the Rose Window
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

    // Glowing Stained-Glass Rose Mandala Petals
    ctx.save();
    ctx.translate(cx, 520);
    const petalColors = [
      'rgba(245, 158, 11, 0.18)',
      'rgba(56, 189, 248, 0.18)',
      'rgba(16, 185, 129, 0.18)',
      'rgba(244, 63, 94, 0.16)',
    ];
    for (let i = 0; i < 12; i++) {
      const a0 = (i * Math.PI * 2) / 12;
      const a1 = ((i + 1) * Math.PI * 2) / 12;
      ctx.fillStyle = petalColors[i % petalColors.length];
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 155, a0, a1);
      ctx.closePath();
      ctx.fill();
    }

    // Slowly Rotating Golden-Cyan Astrolabe Ring
    ctx.rotate(time * 0.1);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.32)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 155, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 108, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 34, Math.sin(a) * 34);
      ctx.lineTo(Math.cos(a) * 155, Math.sin(a) * 155);
      ctx.stroke();
    }
    ctx.restore();

    // Crashed Alien Monolith Obelisk pierced diagonally through the Cathedral Center!
    ctx.save();
    ctx.translate(cx + 150, 480);
    ctx.rotate(0.28);
    ctx.fillStyle = '#0C1222';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-26, -190);
    ctx.lineTo(0, -245);
    ctx.lineTo(26, -190);
    ctx.lineTo(34, 95);
    ctx.lineTo(-34, 95);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Pulsing alien monolith glyph core
    const monoGlow = 0.4 + 0.4 * Math.sin(time * 3);
    ctx.fillStyle = `rgba(56, 189, 248, ${monoGlow.toFixed(2)})`;
    ctx.fillRect(-5, -170, 10, 210);
    ctx.restore();
  }

  // 3. Sunken Primordial Crypt Pit (x = 2260..3140, y = 960..1120)
  if (3140 > camX - 80 && 2260 < camX + viewW + 80) {
    // Dark Catacomb Stone Backwall
    ctx.fillStyle = '#0A1415';
    ctx.fillRect(2260, 960, 880, 115);

    // Carved Crypt Arch Alcoves with Faint Skull Silhouettes
    for (let ax = 2365; ax <= 3025; ax += 110) {
      ctx.fillStyle = '#060C0E';
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
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

  // Left & Right Citadel Boundary Walls
  ctx.fillStyle = '#0C101C';
  ctx.fillRect(0, 0, 22, WORLD_H);
  ctx.fillRect(WORLD_W - 22, 0, 22, WORLD_H);
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
}

function drawBaseZone(
  ctx: CanvasRenderingContext2D,
  zone: { team: 'blue' | 'red'; x: number; y: number; w: number; h: number },
  time: number
): void {
  const isBlue = zone.team === 'blue';
  const primary = isBlue ? '#38BDF8' : '#F43F5E';
  const accent = isBlue ? '#F59E0B' : '#38BDF8';
  const bg = isBlue ? 'rgba(56, 189, 248, 0.08)' : 'rgba(244, 63, 94, 0.08)';
  ctx.save();

  ctx.fillStyle = bg;
  ctx.fillRect(zone.x, zone.y, zone.w, zone.h);

  const cx = zone.x + zone.w * 0.5;
  const cy = zone.y + 115;

  // Gothic Cathedral Altar Arch (Blue) or Alien Warp-Gate Frame (Red)
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 4;
  ctx.beginPath();
  if (isBlue) {
    ctx.arc(cx, cy + 20, 74, Math.PI, 0);
  } else {
    ctx.moveTo(cx - 72, zone.y + zone.h - 14);
    ctx.lineTo(cx - 54, cy - 35);
    ctx.lineTo(cx, cy - 66);
    ctx.lineTo(cx + 54, cy - 35);
    ctx.lineTo(cx + 72, zone.y + zone.h - 14);
  }
  ctx.stroke();

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

  // Floating Restoration Cross Sigil
  ctx.globalAlpha = 0.85;
  const bob = Math.sin(time * 3) * 4;
  ctx.fillStyle = '#10B981';
  ctx.fillRect(cx - 18, cy - 5 + bob, 36, 10);
  ctx.fillRect(cx - 5, cy - 18 + bob, 10, 36);

  ctx.globalAlpha = 0.92;
  ctx.font = '700 12px "Bricolage Grotesque", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = primary;
  ctx.fillText(isBlue ? 'SANCTUM HEALING ALTAR' : 'INVASION WARP ALTAR', cx, zone.y + 26);

  // Altar stone dais
  ctx.fillStyle = '#1E2438';
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.fillRect(cx - 64, zone.y + zone.h - 14, 128, 14);
  ctx.strokeRect(cx - 64, zone.y + zone.h - 14, 128, 14);
  ctx.restore();
}

function drawPlatform(
  ctx: CanvasRenderingContext2D,
  p: { x: number; y: number; w: number; h: number; oneWay: boolean; style: string },
  time: number
): void {
  ctx.save();
  const centerX = p.x + p.w * 0.5;
  const isCryptArea = Math.abs(centerX - WORLD_W / 2) < 520;
  const isInvasionSide = centerX > WORLD_W / 2 + 450;

  if (p.oneWay) {
    // Luminous Gothic-Alien Sanctuary Hard-Light Glass (drop-through signal)
    const grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
    if (isCryptArea) {
      grad.addColorStop(0, 'rgba(52, 211, 153, 0.72)');
      grad.addColorStop(0.55, 'rgba(56, 189, 248, 0.36)');
      grad.addColorStop(1, 'rgba(10, 20, 28, 0.65)');
    } else if (isInvasionSide) {
      grad.addColorStop(0, 'rgba(244, 63, 94, 0.65)');
      grad.addColorStop(0.55, 'rgba(56, 189, 248, 0.34)');
      grad.addColorStop(1, 'rgba(15, 23, 42, 0.68)');
    } else {
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.72)');
      grad.addColorStop(0.55, 'rgba(245, 158, 11, 0.36)');
      grad.addColorStop(1, 'rgba(15, 23, 42, 0.65)');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(p.x, p.y, p.w, p.h);

    // Gothic mullion support struts
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
    ctx.lineWidth = 1.6;
    for (let x = p.x + 48; x < p.x + p.w - 24; x += 72) {
      ctx.beginPath();
      ctx.moveTo(x, p.y);
      ctx.lineTo(x, p.y + p.h);
      ctx.stroke();
    }

    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.strokeRect(p.x, p.y, p.w, p.h);

    // Bright top walkable highlight
    ctx.fillStyle = isCryptArea ? '#A7F3D0' : '#FDE68A';
    ctx.fillRect(p.x + 2, p.y + 1, p.w - 4, 2.5);

    // Subtle animated drop-through chevron hints
    const chevAlpha = 0.4 + 0.25 * Math.sin(time * 3.5);
    ctx.strokeStyle = `rgba(224, 242, 254, ${chevAlpha.toFixed(2)})`;
    ctx.lineWidth = 1.5;
    for (let x = p.x + 36; x < p.x + p.w - 24; x += 72) {
      ctx.beginPath();
      ctx.moveTo(x - 5, p.y + 6);
      ctx.lineTo(x, p.y + 11.5);
      ctx.lineTo(x + 5, p.y + 6);
      ctx.stroke();
    }
  } else {
    // Weathered Gothic Cathedral Ashlar Stone & Alien Conduit Inlay
    const grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + Math.min(p.h, 96));
    if (isCryptArea) {
      grad.addColorStop(0, '#273A38');
      grad.addColorStop(0.28, '#1A2727');
      grad.addColorStop(1, '#0C1416');
    } else if (isInvasionSide) {
      grad.addColorStop(0, '#3B2F44');
      grad.addColorStop(0.26, '#261F31');
      grad.addColorStop(1, '#120F1B');
    } else {
      grad.addColorStop(0, '#3C445C');
      grad.addColorStop(0.26, '#262C3F');
      grad.addColorStop(1, '#121622');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(p.x, p.y, p.w, p.h);

    // Top carved stone cornice ledge
    ctx.fillStyle = isCryptArea ? '#3A5A53' : isInvasionSide ? '#524361' : '#535D7A';
    ctx.fillRect(p.x, p.y, p.w, 8);

    // Subtle top specular edge so walkable terrain pops sharply
    ctx.fillStyle = isCryptArea
      ? 'rgba(110, 231, 183, 0.35)'
      : isInvasionSide
        ? 'rgba(251, 113, 133, 0.32)'
        : 'rgba(253, 230, 138, 0.32)';
    ctx.fillRect(p.x, p.y, p.w, 2);

    // Ashlar masonry stone seams (staggered courses)
    ctx.strokeStyle = 'rgba(7, 9, 15, 0.5)';
    ctx.lineWidth = 1.6;
    for (let x = p.x + 52; x < p.x + p.w - 18; x += 68) {
      ctx.beginPath();
      ctx.moveTo(x, p.y + 8);
      ctx.lineTo(x, p.y + Math.min(p.h, 30));
      ctx.stroke();
    }
    if (p.h > 40) {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + 30);
      ctx.lineTo(p.x + p.w, p.y + 30);
      ctx.stroke();
      for (let x = p.x + 22; x < p.x + p.w - 18; x += 68) {
        ctx.beginPath();
        ctx.moveTo(x, p.y + 30);
        ctx.lineTo(x, p.y + Math.min(p.h, 58));
        ctx.stroke();
      }
    }

    // Glowing Alien-Gold / Crypt / Crimson Circuit Vein
    ctx.fillStyle = isCryptArea
      ? 'rgba(16, 185, 129, 0.48)'
      : isInvasionSide
        ? 'rgba(244, 63, 94, 0.45)'
        : 'rgba(245, 158, 11, 0.42)';
    ctx.fillRect(p.x + 10, p.y + 10, p.w - 20, 2.2);

    // Decorative crenellation dentils underneath top nave battlements
    if (p.style === 'battlement') {
      ctx.fillStyle = isInvasionSide ? '#20192A' : '#1E2436';
      for (let x = p.x + 14; x < p.x + p.w - 26; x += 44) {
        ctx.fillRect(x, p.y + p.h, 20, 7);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.6;
        ctx.strokeRect(x, p.y + p.h, 20, 7);
      }
    }

    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.strokeRect(p.x, p.y, p.w, p.h);
  }
  ctx.restore();
}

function drawJumpPad(
  ctx: CanvasRenderingContext2D,
  jp: { x: number; y: number; w: number; color: string },
  time: number
): void {
  ctx.save();
  const cx = jp.x + jp.w / 2;

  // Vertical soft gravity well beam
  const bGrad = ctx.createLinearGradient(0, jp.y, 0, jp.y - 68);
  bGrad.addColorStop(0, `${jp.color}38`);
  bGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bGrad;
  ctx.fillRect(jp.x + 8, jp.y - 68, jp.w - 16, 68);

  // Rising runic gravity chevrons
  for (let i = 0; i < 3; i++) {
    const phase = (time * 2.5 + i * 0.33) % 1;
    const cy = jp.y - 8 - phase * 54;
    ctx.strokeStyle = jp.color;
    ctx.globalAlpha = (1 - phase) * 0.9;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 17, cy + 7);
    ctx.lineTo(cx, cy - 3);
    ctx.lineTo(cx + 17, cy + 7);
    ctx.stroke();
  }

  // Carved stone-and-alloy gravity pad base
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#1B2234';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.roundRect(jp.x, jp.y, jp.w, 16, [6, 6, 0, 0]);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(jp.x + 3, jp.y + 10, jp.w - 6, 3);
  ctx.fillStyle = jp.color;
  ctx.fillRect(jp.x + 8, jp.y + 2, jp.w - 16, 5);
  ctx.restore();
}

function drawRelicShard(ctx: CanvasRenderingContext2D, sc: SolarCubeEntity, time: number): void {
  const bob = Math.sin(time * 3.4 + sc.bobPhase) * 5;
  const x = sc.x;
  const y = sc.y + bob;
  const r = sc.value >= 16 ? 12 : 9.5;

  ctx.save();
  ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
  ctx.beginPath();
  ctx.arc(x, y, r + 6.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(x, y);
  ctx.rotate(Math.sin(time * 2 + sc.bobPhase) * 0.14);
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

  ctx.fillStyle = '#FEF3C7';
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.62);
  ctx.lineTo(r * 0.36, -r * 0.08);
  ctx.lineTo(0, r * 0.24);
  ctx.lineTo(-r * 0.36, -r * 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCryptSpirit(ctx: CanvasRenderingContext2D, c: NeutralCreepEntity, time: number): void {
  const bob = Math.sin(time * 4 + c.bobPhase) * 4;
  ctx.save();
  ctx.translate(c.x, c.y + bob);

  // Orbiting emerald spirit wisps
  ctx.fillStyle = 'rgba(16, 185, 129, 0.28)';
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.fill();

  // Flowing wisp tail
  ctx.fillStyle = '#059669';
  ctx.beginPath();
  ctx.moveTo(-10, 4);
  ctx.quadraticCurveTo(Math.sin(time * 6 + c.bobPhase) * 6, 18, 0, 21);
  ctx.quadraticCurveTo(-Math.sin(time * 6 + c.bobPhase) * 4, 16, 10, 4);
  ctx.closePath();
  ctx.fill();

  // Luminous Primordial Spirit Core
  ctx.fillStyle = c.hitFlashTimer > 0 ? '#FFFFFF' : '#10B981';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(0, -2, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Horned mini-spirit ears
  ctx.fillStyle = '#34D399';
  ctx.beginPath();
  ctx.moveTo(-9, -10);
  ctx.lineTo(-14, -20);
  ctx.lineTo(-3, -13);
  ctx.closePath();
  ctx.moveTo(9, -10);
  ctx.lineTo(14, -20);
  ctx.lineTo(3, -13);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Healing cross sigil inside spirit
  ctx.fillStyle = '#ECFDF5';
  ctx.fillRect(-5, -4, 10, 4);
  ctx.fillRect(-2, -7, 4, 10);

  if (c.hp < c.maxHp) {
    drawCompactBar(ctx, 0, -27, 36, 5, c.hp / c.maxHp, '#34D399');
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
  playerHero?: HeroEntity
): void {
  const isBlue = t.team === 'blue';
  const isInner = t.tier === 'inner';
  const teamCol = isBlue ? '#38BDF8' : '#F43F5E';
  const trimCol = isBlue ? '#F59E0B' : '#FB7185';

  ctx.save();
  if (!t.alive) {
    // Crumbled gothic ruin plinth
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

  const h = isInner ? 110 : 90;
  const baseW = isInner ? 40 : 34;

  // Inner Reliquary Winged Buttress Fins
  if (isInner) {
    ctx.fillStyle = isBlue ? '#1E293B' : '#2D192B';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(t.x - baseW * 0.72, t.y - h * 0.25);
    ctx.lineTo(t.x - baseW * 1.28, t.y - h * 0.76);
    ctx.lineTo(t.x - baseW * 0.65, t.y - h * 0.85);
    ctx.closePath();
    ctx.moveTo(t.x + baseW * 0.72, t.y - h * 0.25);
    ctx.lineTo(t.x + baseW * 1.28, t.y - h * 0.76);
    ctx.lineTo(t.x + baseW * 0.65, t.y - h * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Stepped Gothic Stone Obelisk Pedestal
  ctx.fillStyle = t.hitFlashTimer > 0 ? '#FFFFFF' : isBlue ? '#242B40' : '#2D1E30';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(t.x - baseW, t.y);
  ctx.lineTo(t.x - baseW * 0.72, t.y - h);
  ctx.lineTo(t.x + baseW * 0.72, t.y - h);
  ctx.lineTo(t.x + baseW, t.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Arched Stained-Glass Energy Slit on Tower Body
  ctx.fillStyle = teamCol;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(t.x, t.y - h * 0.56, 8, Math.PI, 0);
  ctx.lineTo(t.x + 8, t.y - 20);
  ctx.lineTo(t.x - 8, t.y - 20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Gold filigree collar
  ctx.fillStyle = trimCol;
  ctx.fillRect(t.x - baseW * 0.78, t.y - h + 4, baseW * 1.56, 6);
  ctx.strokeRect(t.x - baseW * 0.78, t.y - h + 4, baseW * 1.56, 6);

  // Rotating Reliquary Crystal Cannon Head
  const headY = t.y - h - 12;

  // Inner Tower Orbiting Golden Astrolabe Ring
  if (isInner) {
    ctx.save();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(t.x, headY, 34, 10, Math.sin(time * 1.2) * 0.35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(t.x, headY);
  ctx.rotate(t.aimAngle);
  ctx.fillStyle = '#475569';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.fillRect(10, -7.5, 36, 15);
  ctx.strokeRect(10, -7.5, 36, 15);
  ctx.fillStyle = trimCol;
  ctx.fillRect(14, -7.5, 6, 15);
  ctx.fillStyle = teamCol;
  ctx.fillRect(36, -4.5, 10, 9);
  ctx.restore();

  // Reliquary Halo Core
  ctx.fillStyle = t.hitFlashTimer > 0 ? '#FFFFFF' : '#334155';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(t.x, headY, isInner ? 24 : 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const glow = 0.7 + 0.3 * Math.sin(time * 5);
  ctx.fillStyle = teamCol;
  ctx.globalAlpha = glow;
  ctx.beginPath();
  ctx.arc(t.x, headY, isInner ? 11 : 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Inner Tower Protective Barrier Dome while Outer Tower stands
  if (t.shielded) {
    ctx.save();
    ctx.strokeStyle = '#FBBF24';
    ctx.fillStyle = 'rgba(251, 191, 36, 0.1)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(t.x, t.y - h * 0.52, 66, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = '700 10px "Bricolage Grotesque", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FDE68A';
    ctx.fillText('SHIELDED (DESTROY OUTER)', t.x, t.y - h - 46);
    ctx.restore();
  } else {
    drawCompactBar(
      ctx,
      t.x,
      t.y - h - 46,
      78,
      8,
      t.hp / t.maxHp,
      teamCol,
      `${isInner ? 'INNER' : 'OUTER'} ${Math.ceil(t.hp)}`
    );
  }
  ctx.restore();
}

function drawAncientCore(ctx: CanvasRenderingContext2D, core: CoreDrillEntity, time: number): void {
  const isBlue = core.team === 'blue';
  const teamCol = isBlue ? '#38BDF8' : '#F43F5E';

  ctx.save();
  // Monumental Cathedral-Alien Sanctum Spire
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

  // Side flying buttress arches
  ctx.fillStyle = '#121828';
  ctx.beginPath();
  ctx.moveTo(core.x - 64, core.y);
  ctx.lineTo(core.x - 86, core.y);
  ctx.lineTo(core.x - 54, core.y - 96);
  ctx.closePath();
  ctx.moveTo(core.x + 64, core.y);
  ctx.lineTo(core.x + 86, core.y);
  ctx.lineTo(core.x + 54, core.y - 96);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Dual Counter-Rotating Golden & Cyan Astrolabe Rings
  const bob = Math.sin(time * 3.2) * 5;
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(core.x, core.y - 88 + bob, 48, 16, time * 0.65, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = teamCol;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(core.x, core.y - 88 + bob, 44, 15, -time * 0.85, 0, Math.PI * 2);
  ctx.stroke();

  // Radiant Relic Heart Crystal
  ctx.fillStyle = '#F59E0B';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(core.x, core.y - 142 + bob);
  ctx.lineTo(core.x + 30, core.y - 88 + bob);
  ctx.lineTo(core.x, core.y - 34 + bob);
  ctx.lineTo(core.x - 30, core.y - 88 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.moveTo(core.x, core.y - 124 + bob);
  ctx.lineTo(core.x + 13, core.y - 88 + bob);
  ctx.lineTo(core.x, core.y - 52 + bob);
  ctx.lineTo(core.x - 13, core.y - 88 + bob);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = teamCol;
  ctx.fillRect(core.x - 54, core.y - 22, 108, 11);

  if (core.shielded) {
    const pulse = 0.5 + 0.3 * Math.sin(time * 4);
    ctx.strokeStyle = teamCol;
    ctx.fillStyle = isBlue ? 'rgba(56, 189, 248, 0.14)' : 'rgba(244, 63, 94, 0.14)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(core.x, core.y - 88, 98, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = pulse;
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.font = '700 11px "Bricolage Grotesque", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText('SHIELDED — DESTROY AN INNER TOWER', core.x, core.y - 196);
  } else {
    drawCompactBar(
      ctx,
      core.x,
      core.y - 196,
      132,
      11,
      core.hp / core.maxHp,
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
    } else {
      ctx.strokeStyle = 'rgba(45, 212, 191, 0.55)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(hz.x, 0);
      ctx.lineTo(hz.x, hz.y);
      ctx.stroke();

      ctx.fillStyle = `rgba(45, 212, 191, ${(0.08 + progress * 0.25).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(hz.x, hz.y, hz.radius * progress, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#2DD4BF';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(hz.x, hz.y, hz.radius, 0, Math.PI * 2);
      ctx.stroke();
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
  }
  ctx.restore();
}

function drawChainHook(ctx: CanvasRenderingContext2D, hk: HookEntity, _time: number): void {
  ctx.save();
  const dx = hk.x - hk.startX;
  const dy = hk.y - hk.startY;
  const dist = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);

  // Heavy forged iron links
  const linkStep = 17;
  const steps = Math.max(1, Math.floor(dist / linkStep));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lx = hk.startX + dx * t;
    const ly = hk.startY + dy * t;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(angle);
    ctx.strokeStyle = i % 2 === 0 ? '#E2E8F0' : '#64748B';
    ctx.fillStyle = '#0F172A';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Barbed Abyssal Cyber-Claw Head
  ctx.translate(hk.x, hk.y);
  ctx.rotate(angle);
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

function drawDroid(ctx: CanvasRenderingContext2D, d: DroidEntity, time: number): void {
  const isBlue = d.team === 'blue';
  const isBoneBorg = d.id.startsWith('borg_');
  const primary = isBoneBorg ? '#2DD4BF' : isBlue ? '#38BDF8' : '#F43F5E';
  const scale = d.tier >= 5 ? 1.22 : d.tier >= 3 ? 1.08 : 1;
  const bob = Math.sin(time * 10 + d.walkCycle) * 1.8;
  const f = d.facing;

  ctx.save();
  ctx.translate(d.x, d.y + bob);
  ctx.scale(scale, scale);

  if (isBoneBorg) {
    // Caldris's Chrome-Armored Skeletal Bone-Borg!
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.fillRect(-7, 7, 5, 11);
    ctx.fillRect(2, 7, 5, 11);

    // Chrome ribcage torso
    ctx.fillStyle = d.hitFlashTimer > 0 ? '#FFFFFF' : '#334155';
    ctx.beginPath();
    ctx.roundRect(-11, -11, 22, 20, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2DD4BF';
    ctx.fillRect(-6, -6, 12, 2.5);
    ctx.fillRect(-5, -1, 10, 2.5);
    ctx.fillRect(-4, 4, 8, 2.5);

    // Skeletal chrome skull
    ctx.fillStyle = d.hitFlashTimer > 0 ? '#FFFFFF' : '#E2E8F0';
    ctx.beginPath();
    ctx.arc(0, -17, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2DD4BF';
    ctx.fillRect(f > 0 ? 1 : -7, -19, 6, 3.5);

    // Necro-rifle
    ctx.fillStyle = '#64748B';
    ctx.fillRect(f > 0 ? 9 : -20, -2, 11, 5);
    ctx.strokeRect(f > 0 ? 9 : -20, -2, 11, 5);
  } else {
    // Evolving Cathedral / Invasion Lane Troopers (Tier 1..6)
    const armorCol =
      d.hitFlashTimer > 0
        ? '#FFFFFF'
        : d.tier >= 5
          ? isBlue
            ? '#B45309'
            : '#881337'
          : isBlue
            ? '#1E293B'
            : '#2A1829';
    const trimCol = d.tier >= 5 ? '#FBBF24' : d.tier >= 3 ? '#CBD5E1' : '#64748B';

    // Armored greave treads / legs
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-5, 12, 5.5, 0, Math.PI * 2);
    ctx.arc(5, 12, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Flowing mini faction cape
    ctx.fillStyle = isBlue ? '#1D4ED8' : '#9F1239';
    ctx.beginPath();
    ctx.moveTo(-f * 8, -11);
    ctx.lineTo(-f * 18, 9);
    ctx.lineTo(-f * 6, 11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Gothic armored torso
    ctx.fillStyle = armorCol;
    ctx.beginPath();
    ctx.roundRect(-13, -15, 26, 25, 6);
    ctx.fill();
    ctx.stroke();

    // Team pauldrons
    ctx.fillStyle = primary;
    ctx.fillRect(-13, -13, 26, 6);
    ctx.strokeRect(-13, -13, 26, 6);

    // Tier 3+ Knight Crest / Tier 5+ Radiant Halo Crown!
    if (d.tier >= 5) {
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(0, -25, 11, 3.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (d.tier >= 3) {
      ctx.fillStyle = trimCol;
      ctx.beginPath();
      ctx.moveTo(-6, -15);
      ctx.lineTo(0, -25);
      ctx.lineTo(6, -15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Glowing Visor Slit
    ctx.fillStyle = d.tier >= 5 ? '#FEF08A' : primary;
    ctx.fillRect(f > 0 ? 3 : -10, -7, 7, 4);

    // Halberd Blaster Lance
    ctx.fillStyle = trimCol;
    ctx.fillRect(f > 0 ? 11 : -22, -3, 11, 6);
    ctx.strokeRect(f > 0 ? 11 : -22, -3, 11, 6);
    ctx.fillStyle = primary;
    ctx.fillRect(f > 0 ? 19 : -22, -2, 3, 4);
  }

  if (d.hp < d.maxHp) {
    drawCompactBar(ctx, 0, -31, 32, 4, d.hp / d.maxHp, primary);
  }
  ctx.restore();
}

function drawDropPodSequence(ctx: CanvasRenderingContext2D, h: HeroEntity, time: number): void {
  for (const s of h.dropPodSolars) {
    if (s.collected) continue;
    ctx.save();
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
    ctx.restore();
  }

  ctx.save();
  ctx.translate(h.dropPodX, h.dropPodY);
  const flameH = 46 + Math.sin(time * 40) * 10;
  const fGrad = ctx.createLinearGradient(0, -10, 0, -flameH - 25);
  fGrad.addColorStop(0, '#FEF08A');
  fGrad.addColorStop(0.5, '#F97316');
  fGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
  ctx.fillStyle = fGrad;
  ctx.beginPath();
  ctx.moveTo(-20, -12);
  ctx.lineTo(0, -flameH - 25);
  ctx.lineTo(20, -12);
  ctx.closePath();
  ctx.fill();

  // Cathedral Reliquary Drop Pod
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

  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(-16, 12, 32, 6);
  ctx.fillStyle = '#BAE6FD';
  ctx.beginPath();
  ctx.arc(0, -2, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (h.isPlayer) {
    ctx.font = '800 12px "Bricolage Grotesque", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FDE68A';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.strokeText('STEER A / D FOR RELIC SHARDS', 0, -56);
    ctx.fillText('STEER A / D FOR RELIC SHARDS', 0, -56);
  }
  ctx.restore();
}

/* =========================================================================
   CHAMPION RENDERER + 8 HAND-CRAFTED ARTICULATED 2D CHARACTER RIGS
   ========================================================================= */

function drawHero(ctx: CanvasRenderingContext2D, h: HeroEntity, time: number, localTeam: Team): void {
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

  ctx.save();
  ctx.translate(h.x, h.y);
  if (isCloaked) {
    ctx.globalAlpha = 0.45;
  }

  // Team ground contact shadow & faction ring
  ctx.save();
  ctx.fillStyle = isBlue ? 'rgba(56, 189, 248, 0.28)' : 'rgba(244, 63, 94, 0.3)';
  ctx.beginPath();
  ctx.ellipse(0, h.h / 2 - 1, h.w * 0.68, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
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

  // Recall beam
  if (h.recallTimer > 0) {
    const pct = 1 - h.recallTimer / 2.2;
    ctx.save();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 36, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
    ctx.stroke();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
    ctx.fillRect(-16, -240, 32, 260);
    ctx.restore();
  }

  // Squash & stretch + Subtle idle breathing
  ctx.save();
  const breathe = h.grounded && Math.abs(h.vx) < 20 ? Math.sin(time * 3.6 + h.x) * 0.025 : 0;
  ctx.scale(h.squashX - breathe, h.squashY + breathe);
  const flash = h.hitFlashTimer > 0;
  const stride = Math.abs(h.vx) > 25 && h.grounded ? Math.sin(h.walkCycle * 12) * 7 : 0;

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
  }
  ctx.restore();

  // Active Shield Halo
  if (h.shield > 1) {
    ctx.strokeStyle = '#67E8F9';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, -2, Math.max(h.w, h.h) * 0.66, 0, Math.PI * 2);
    ctx.stroke();
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
      ctx.arc(Math.cos(a) * 18, -h.h / 2 - 14 + Math.sin(a) * 4, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.globalAlpha = 1;
  const barY = -h.h / 2 - 26;
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
    // Holo-Seraph Charger Ram
    ctx.globalAlpha = 0.92;
    ctx.fillStyle =
      s.hitFlashTimer > 0
        ? '#FFFFFF'
        : isBlue
          ? 'rgba(56, 189, 248, 0.72)'
          : 'rgba(244, 63, 94, 0.76)';
    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.roundRect(-26, -18, 52, 32, 10);
    ctx.fill();
    ctx.stroke();

    // Swept hard-light wings & ramming prow
    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.moveTo(s.facing * 20, -14);
    ctx.lineTo(s.facing * 38, -24);
    ctx.lineTo(s.facing * 30, -2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    drawCompactBar(ctx, 0, -29, 46, 5, s.hp / s.maxHp, teamCol);
  } else if (s.kind === 'totem') {
    // Korak's Skull Spirit Totem + Primordial Healing Ring
    const pulse = 0.5 + 0.5 * Math.sin(time * 5);
    ctx.fillStyle = isBlue ? 'rgba(16, 185, 129, 0.14)' : 'rgba(244, 63, 94, 0.12)';
    ctx.strokeStyle = isBlue ? '#34D399' : '#FB7185';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, s.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.55 + pulse * 0.35;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Carved Bone Totem Pillar with Stag Horns
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
    // Korak's Orbiting Ancestral Spirit Skull
    ctx.fillStyle = 'rgba(52, 211, 153, 0.3)';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
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

  if (p.kind === 'cleaver') {
    const angle = Math.atan2(p.vy, p.vx);
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
  } else if (p.kind === 'spear') {
    const angle = Math.atan2(p.vy, p.vx);
    ctx.rotate(angle);
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
    ctx.arc(0, 0, p.radius + 5, 0, Math.PI * 2);
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
    ctx.arc(10, -4, 4.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === 'biobeam') {
    const angle = Math.atan2(p.vy, p.vx);
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
    const angle = Math.atan2(p.vy, p.vx);
    ctx.rotate(angle);
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
    const angle = Math.atan2(p.vy, p.vx);
    ctx.rotate(angle);
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
