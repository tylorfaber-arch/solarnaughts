/**
 * Renderer-side visual effects: additive glow, projectile trails, in-flight emitters,
 * automatic impact bursts and spell-cast flares.
 *
 * Everything here is cosmetic and driven only by what the renderer already sees each frame
 * (projectile positions, hero anim triggers), so it works identically in solo and online play
 * and never touches the simulation.
 *
 * Frame flow (called from renderArena):
 *   vfxBeginFrame(time)            -> advance particles, detect projectiles that vanished (=> impact)
 *   vfxTrackProjectile(...)        -> per projectile, records trail + emits in-flight particles
 *   vfxDrawTrails / vfxDrawParticles -> drawn in world space with additive blending
 */
import type { ProjectileEntity } from './types';

// ---------- Glow sprite cache ----------
const glowCache = new Map<string, HTMLCanvasElement>();

/** Soft radial light sprite (white-hot core fading through `color`). Draw with 'lighter'. */
export function getGlow(color: string): HTMLCanvasElement {
  let c = glowCache.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, color);
  grad.addColorStop(0.5, withAlpha(color, 0.35));
  grad.addColorStop(1, withAlpha(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowCache.set(color, c);
  return c;
}

function withAlpha(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Draw an additive glow of radius r at (x, y). */
export function drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha = 1): void {
  if (r <= 0 || alpha <= 0) return;
  const prevOp = ctx.globalCompositeOperation;
  const prevA = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = prevA * Math.min(1, alpha);
  ctx.drawImage(getGlow(color), x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = prevA;
  ctx.globalCompositeOperation = prevOp;
}

// ---------- Particles ----------
type VfxKind = 'ember' | 'smoke' | 'spark' | 'flash' | 'shock' | 'wisp' | 'drip' | 'rune';

interface VfxParticle {
  kind: VfxKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  grav: number;
  drag: number;
  spin: number;
}

const MAX_PARTICLES = 700;
const particles: VfxParticle[] = [];

function emit(p: Partial<VfxParticle> & { kind: VfxKind; x: number; y: number; color: string }): void {
  if (particles.length >= MAX_PARTICLES) return;
  const life = p.life ?? 0.4;
  particles.push({
    vx: 0,
    vy: 0,
    size: 4,
    grav: 0,
    drag: 0,
    spin: 0,
    ...p,
    life,
    max: life,
  });
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

// ---------- Projectile style table ----------
interface ProjStyle {
  trail: string; // trail colour
  width: number; // trail head width
  length: number; // number of trail samples kept
  glow: number; // glow radius around the projectile
  impact: 'spark' | 'blast' | 'toxic' | 'holy' | 'void' | 'slash';
  emit?: 'embers' | 'smoke' | 'drip' | 'wisp' | 'sparkle';
}

function styleFor(p: ProjectileEntity): ProjStyle {
  switch (p.kind) {
    case 'cleaver':
      return { trail: '#34D399', width: 10, length: 6, glow: 26, impact: 'slash' };
    case 'dagger':
      return { trail: '#38BDF8', width: 4, length: 7, glow: 14, impact: 'slash' };
    case 'spear':
      return { trail: '#FBBF24', width: 6, length: 12, glow: 20, impact: 'holy', emit: 'sparkle' };
    case 'prism_lance':
      return { trail: '#FDE047', width: 6, length: 14, glow: 22, impact: 'holy', emit: 'sparkle' };
    case 'solar_disc':
      return { trail: '#FBBF24', width: 9, length: 10, glow: 30, impact: 'holy', emit: 'embers' };
    case 'venom_dart':
      return { trail: '#84CC16', width: 4, length: 12, glow: 14, impact: 'toxic', emit: 'drip' };
    case 'censer_bomb':
      return { trail: '#65A30D', width: 7, length: 12, glow: 24, impact: 'toxic', emit: 'smoke' };
    case 'soul_orb':
    case 'singularity_orb':
      return { trail: p.color || '#2DD4BF', width: p.radius * 1.6, length: 12, glow: p.radius * 3.2, impact: 'void', emit: 'wisp' };
    case 'mortar':
    case 'missile':
    case 'drone_kamikaze':
    case 'dynamite':
      return { trail: '#F97316', width: 7, length: 14, glow: 26, impact: 'blast', emit: 'smoke' };
    case 'sonic':
    case 'biobeam':
      return { trail: p.color || '#A855F7', width: 7, length: 8, glow: 22, impact: 'void' };
    default:
      return { trail: p.color || '#E2E8F0', width: Math.max(3, p.radius * 1.1), length: 8, glow: Math.max(12, p.radius * 2.6), impact: 'spark' };
  }
}

// ---------- Projectile tracking ----------
interface Track {
  pts: { x: number; y: number }[];
  style: ProjStyle;
  seenFrame: number;
  emitAcc: number;
  team: string;
}

const tracks = new Map<string, Track>();
let frame = 0;
let lastTime = 0;
let dt = 0;

/** Advance particles and resolve projectiles that disappeared last frame into impact bursts. */
export function vfxBeginFrame(time: number): void {
  dt = Math.max(0, Math.min(0.05, time - lastTime));
  if (time < lastTime) dt = 0; // new match / time reset
  lastTime = time;

  // Projectiles not seen last frame are gone => they hit something (or expired). Burst at last point.
  for (const [id, tr] of tracks) {
    if (tr.seenFrame < frame) {
      const last = tr.pts[tr.pts.length - 1];
      if (last && tr.seenFrame === frame - 1) spawnImpact(last.x, last.y, tr.style);
      tracks.delete(id);
    }
  }
  frame++;

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles[i] = particles[particles.length - 1];
      particles.pop();
      continue;
    }
    const d = Math.max(0, 1 - p.drag * dt);
    p.vx *= d;
    p.vy = p.vy * d + p.grav * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

/** Record a projectile's position this frame and emit its in-flight particles. */
export function vfxTrackProjectile(p: ProjectileEntity): void {
  let tr = tracks.get(p.id);
  if (!tr) {
    tr = { pts: [], style: styleFor(p), seenFrame: frame, emitAcc: 0, team: p.team };
    tracks.set(p.id, tr);
  }
  tr.seenFrame = frame;
  tr.pts.push({ x: p.x, y: p.y });
  if (tr.pts.length > tr.style.length) tr.pts.shift();

  const st = tr.style;
  if (!st.emit) return;
  tr.emitAcc += dt * 60;
  while (tr.emitAcc >= 1) {
    tr.emitAcc -= 1;
    const back = Math.atan2(-p.vy, -p.vx);
    switch (st.emit) {
      case 'smoke':
        emit({ kind: 'smoke', x: p.x + rand(-3, 3), y: p.y + rand(-3, 3), vx: Math.cos(back) * 30 + rand(-15, 15), vy: Math.sin(back) * 30 - 20, size: rand(5, 9), life: rand(0.45, 0.8), color: st.trail === '#65A30D' ? '#3F6212' : '#475569', drag: 1.5 });
        if (Math.random() < 0.6) emit({ kind: 'ember', x: p.x, y: p.y, vx: Math.cos(back + rand(-0.6, 0.6)) * rand(60, 140), vy: Math.sin(back + rand(-0.6, 0.6)) * rand(60, 140), size: rand(1.5, 3), life: rand(0.2, 0.45), color: st.trail, grav: 260, drag: 2 });
        break;
      case 'embers':
        emit({ kind: 'ember', x: p.x, y: p.y, vx: rand(-60, 60), vy: rand(-60, 30), size: rand(1.5, 3), life: rand(0.25, 0.5), color: st.trail, grav: 140, drag: 2 });
        break;
      case 'drip':
        if (Math.random() < 0.5) emit({ kind: 'drip', x: p.x, y: p.y, vx: p.vx * 0.1, vy: rand(0, 40), size: rand(1.5, 2.6), life: rand(0.3, 0.55), color: st.trail, grav: 520 });
        break;
      case 'wisp':
        emit({ kind: 'wisp', x: p.x + rand(-4, 4), y: p.y + rand(-4, 4), vx: Math.cos(back) * 40 + rand(-25, 25), vy: Math.sin(back) * 40 + rand(-25, 25), size: rand(3, 6), life: rand(0.3, 0.55), color: st.trail, drag: 3, spin: rand(-6, 6) });
        break;
      case 'sparkle':
        if (Math.random() < 0.55) emit({ kind: 'spark', x: p.x, y: p.y, vx: rand(-50, 50), vy: rand(-50, 50), size: rand(1.5, 2.5), life: rand(0.15, 0.3), color: '#FFFFFF', drag: 4 });
        break;
    }
  }
}

function spawnImpact(x: number, y: number, st: ProjStyle): void {
  const c = st.trail;
  const n = st.impact === 'blast' ? 1.8 : st.impact === 'slash' || st.impact === 'spark' ? 0.7 : 1;
  emit({ kind: 'flash', x, y, size: st.glow * (st.impact === 'blast' ? 2.6 : 1.6), life: 0.16, color: c });
  emit({ kind: 'shock', x, y, size: st.glow * (st.impact === 'blast' ? 2.2 : 1.2), life: 0.28, color: c });
  const sparks = Math.round(10 * n);
  for (let i = 0; i < sparks; i++) {
    const a = rand(0, Math.PI * 2);
    const sp = rand(120, 320) * (st.impact === 'blast' ? 1.3 : 1);
    emit({ kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, size: rand(1.6, 3), life: rand(0.18, 0.4), color: i % 3 === 0 ? '#FFFFFF' : c, grav: 380, drag: 2.5 });
  }
  if (st.impact === 'blast') {
    for (let i = 0; i < 8; i++) {
      emit({ kind: 'smoke', x: x + rand(-10, 10), y: y + rand(-10, 10), vx: rand(-60, 60), vy: rand(-90, -20), size: rand(9, 16), life: rand(0.6, 1.0), color: '#3F3F46', drag: 2 });
    }
  } else if (st.impact === 'toxic') {
    for (let i = 0; i < 6; i++) {
      emit({ kind: 'smoke', x: x + rand(-8, 8), y: y + rand(-8, 8), vx: rand(-40, 40), vy: rand(-50, -10), size: rand(6, 11), life: rand(0.5, 0.9), color: '#3F6212', drag: 2 });
      emit({ kind: 'drip', x, y, vx: rand(-110, 110), vy: rand(-160, -40), size: rand(1.8, 3), life: rand(0.4, 0.7), color: '#A3E635', grav: 600 });
    }
  } else if (st.impact === 'void') {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      emit({ kind: 'wisp', x: x + Math.cos(a) * 26, y: y + Math.sin(a) * 26, vx: -Math.cos(a) * 90, vy: -Math.sin(a) * 90, size: rand(3, 5), life: 0.3, color: c, spin: 8 });
    }
  } else if (st.impact === 'holy') {
    emit({ kind: 'rune', x, y, size: st.glow * 1.1, life: 0.35, color: c, spin: 4 });
  }
}

/** Light flare + particle burst when a hero casts a skill. Called from the anim trigger. */
export function vfxCastBurst(x: number, y: number, color: string, slot: 1 | 2): void {
  emit({ kind: 'flash', x, y, size: slot === 2 ? 70 : 50, life: 0.22, color });
  emit({ kind: 'shock', x, y: slot === 2 ? y + 20 : y, size: slot === 2 ? 70 : 46, life: 0.35, color });
  emit({ kind: 'rune', x, y: slot === 2 ? y + 30 : y, size: slot === 2 ? 46 : 30, life: 0.5, color, spin: slot === 2 ? 3 : -5 });
  const n = slot === 2 ? 22 : 14;
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    const sp = rand(80, 240);
    emit({ kind: i % 2 ? 'spark' : 'ember', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, size: rand(1.6, 3.2), life: rand(0.3, 0.6), color: i % 4 === 0 ? '#FFFFFF' : color, grav: 200, drag: 2.2 });
  }
}

/** Small light pop at a muzzle when a shot fires. */
export function vfxMuzzle(x: number, y: number, angle: number, color: string, heavy: boolean): void {
  emit({ kind: 'flash', x, y, size: heavy ? 46 : 28, life: 0.1, color });
  const n = heavy ? 8 : 4;
  for (let i = 0; i < n; i++) {
    const a = angle + rand(-0.45, 0.45);
    const sp = rand(140, 300);
    emit({ kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: rand(1.4, 2.4), life: rand(0.1, 0.22), color: i === 0 ? '#FFFFFF' : color, drag: 5 });
  }
  if (heavy) {
    for (let i = 0; i < 4; i++) emit({ kind: 'smoke', x, y, vx: Math.cos(angle) * rand(40, 90) + rand(-20, 20), vy: Math.sin(angle) * rand(40, 90) - 30, size: rand(7, 12), life: rand(0.5, 0.8), color: '#52525B', drag: 2.5 });
  }
}

// ---------- Drawing ----------

/** Tapered additive light ribbons behind every tracked projectile. Draw BEFORE projectile bodies. */
export function vfxDrawTrails(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const tr of tracks.values()) {
    const pts = tr.pts;
    if (pts.length < 2) continue;
    const st = tr.style;
    for (let i = 1; i < pts.length; i++) {
      const t = i / (pts.length - 1); // 0 tail -> 1 head
      ctx.globalAlpha = 0.15 + 0.6 * t;
      ctx.strokeStyle = st.trail;
      ctx.lineWidth = Math.max(1, st.width * t);
      ctx.beginPath();
      ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
      ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
    // hot white core on the front half
    const half = Math.floor(pts.length / 2);
    ctx.strokeStyle = '#FFFFFF';
    for (let i = Math.max(1, half); i < pts.length; i++) {
      const t = i / (pts.length - 1);
      ctx.globalAlpha = 0.5 * t;
      ctx.lineWidth = Math.max(0.8, st.width * 0.35 * t);
      ctx.beginPath();
      ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
      ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
    const head = pts[pts.length - 1];
    ctx.globalAlpha = 0.85;
    ctx.drawImage(getGlow(st.trail), head.x - st.glow, head.y - st.glow, st.glow * 2, st.glow * 2);
  }
  ctx.restore();
}

/** Draw all VFX particles. Smoke is drawn normally (it darkens); light is additive. */
export function vfxDrawParticles(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  // Pass 1: smoke (normal blending, underneath the light)
  for (const p of particles) {
    if (p.kind !== 'smoke') continue;
    const t = p.life / p.max;
    ctx.globalAlpha = 0.45 * t;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (1.8 - t * 0.8), 0, Math.PI * 2);
    ctx.fill();
  }
  // Pass 2: everything that emits light
  ctx.globalCompositeOperation = 'lighter';
  for (const p of particles) {
    if (p.kind === 'smoke') continue;
    const t = p.life / p.max;
    switch (p.kind) {
      case 'flash': {
        ctx.globalAlpha = t;
        const r = p.size * (1.2 - t * 0.4);
        ctx.drawImage(getGlow(p.color), p.x - r, p.y - r, r * 2, r * 2);
        break;
      }
      case 'shock': {
        const e = 1 - t;
        ctx.globalAlpha = t * 0.9;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1 + 5 * t;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.25 + e * 0.95), 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'rune': {
        const e = 1 - t;
        ctx.globalAlpha = Math.sin(t * Math.PI) * 0.9;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(e * p.spin);
        const r = p.size * (0.6 + e * 0.5);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          const a2 = ((k + 2) / 6) * Math.PI * 2;
          ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          ctx.lineTo(Math.cos(a2) * r, Math.sin(a2) * r);
        }
        ctx.stroke();
        ctx.restore();
        break;
      }
      case 'spark': {
        ctx.globalAlpha = t;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
        break;
      }
      default: {
        // ember / wisp / drip: soft glowing dot
        ctx.globalAlpha = t;
        const r = p.size * (p.kind === 'wisp' ? 2.6 : 2.2) * (0.5 + t * 0.5);
        ctx.drawImage(getGlow(p.color), p.x - r, p.y - r, r * 2, r * 2);
        break;
      }
    }
  }
  ctx.restore();
}

/** Reset all effect state (call when a new match starts if desired). */
export function vfxReset(): void {
  particles.length = 0;
  tracks.clear();
}
