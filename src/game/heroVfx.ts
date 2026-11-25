/**
 * Per-hero signature effects, built on the particle system in vfx.ts.
 *
 *  - heroMuzzle / heroSlash   : weapon fire, one look per hero (called from the renderer's anim trigger)
 *  - heroAbilityVfx           : one-shot burst per ability fx tag (called from engine.processFxEvents)
 *  - heroAuraVfx              : continuous emitters while a timed ability is active (called per hero per frame)
 *  - hazardVfx / summonVfx / hookVfx : emitters for spell zones, summons and chain hooks (per frame)
 *
 * Purely cosmetic and driven by data the client already has, so solo and online look the same.
 */
import { chance, emit, rand } from './vfx';
import type { HazardZoneEntity, HeroEntity, HeroId, HookEntity, SummonEntity } from './types';

const TAU = Math.PI * 2;

// ---------- shared building blocks ----------
function burst(
  x: number, y: number, n: number, color: string,
  o: { speed?: [number, number]; life?: [number, number]; size?: [number, number]; grav?: number; drag?: number; kind?: 'spark' | 'ember' | 'wisp' | 'shard' | 'feather' | 'bubble' | 'drip'; up?: number; white?: number } = {}
): void {
  const [s0, s1] = o.speed ?? [100, 260];
  const [l0, l1] = o.life ?? [0.25, 0.5];
  const [z0, z1] = o.size ?? [1.6, 3];
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU);
    const sp = rand(s0, s1);
    emit({
      kind: o.kind ?? 'spark', x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up ?? 40),
      size: rand(z0, z1), life: rand(l0, l1),
      color: o.white && i % o.white === 0 ? '#FFFFFF' : color,
      grav: o.grav ?? 250, drag: o.drag ?? 2.2, spin: rand(-10, 10),
    });
  }
}

function flash(x: number, y: number, size: number, color: string, life = 0.18): void {
  emit({ kind: 'flash', x, y, size, life, color });
}
function shock(x: number, y: number, size: number, color: string, life = 0.32): void {
  emit({ kind: 'shock', x, y, size, life, color });
}
function rune(x: number, y: number, size: number, color: string, life = 0.5, spin = 4): void {
  emit({ kind: 'rune', x, y, size, life, color, spin });
}
function pillar(x: number, groundY: number, width: number, height: number, color: string, life = 0.6): void {
  emit({ kind: 'pillar', x, y: groundY, size: width, spin: height, life, color });
}
function bolt(x: number, y: number, tx: number, ty: number, color: string, width = 2.5, life = 0.14): void {
  emit({ kind: 'bolt', x, y, tx, ty, size: width, life, color });
}
function smoke(x: number, y: number, n: number, color: string, size: [number, number] = [6, 12]): void {
  for (let i = 0; i < n; i++) {
    emit({ kind: 'smoke', x: x + rand(-10, 10), y: y + rand(-8, 8), vx: rand(-50, 50), vy: rand(-80, -15), size: rand(size[0], size[1]), life: rand(0.5, 0.9), color, drag: 2 });
  }
}

// ---------- weapons ----------

/** Ranged/caster/heavy weapon fire. (x, y) = muzzle, angle = aim. */
export function heroMuzzle(heroId: HeroId, x: number, y: number, angle: number): void {
  const fwd = (sp: number, spread = 0.4) => {
    const a = angle + rand(-spread, spread);
    return { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp };
  };
  switch (heroId) {
    case 'seraph': // holy glaive: gold flash, white feathers drift off the muzzle
      flash(x, y, 34, '#FDE68A', 0.12);
      for (let i = 0; i < 3; i++) emit({ kind: 'feather', x, y, ...fwd(rand(40, 90), 1.2), size: rand(2.5, 3.5), life: rand(0.4, 0.7), color: '#FEF3C7', grav: 30, drag: 2.5, spin: rand(-6, 6) });
      for (let i = 0; i < 3; i++) emit({ kind: 'spark', x, y, ...fwd(rand(160, 300), 0.25), size: 1.6, life: 0.15, color: '#FFFFFF', drag: 5 });
      break;
    case 'vexia': // rail crossbow: tight red streak + recoil sparks, crisp and fast
      flash(x, y, 26, '#F43F5E', 0.08);
      for (let i = 0; i < 5; i++) emit({ kind: 'spark', x, y, ...fwd(rand(260, 420), 0.12), size: rand(1.2, 2), life: rand(0.08, 0.16), color: i ? '#FDA4AF' : '#FFFFFF', drag: 6 });
      break;
    case 'vorg': // eldritch bolts: void shards scatter from the hand
      flash(x, y, 26, '#A855F7', 0.1);
      for (let i = 0; i < 3; i++) emit({ kind: 'shard', x, y, ...fwd(rand(80, 180), 0.8), size: rand(2, 3.5), life: rand(0.15, 0.3), color: '#C084FC', drag: 4, spin: rand(-14, 14) });
      break;
    case 'korak': // hex-mender: green spirit wisps curl off the staff
      flash(x, y, 32, '#4ADE80', 0.14);
      for (let i = 0; i < 4; i++) emit({ kind: 'wisp', x, y, ...fwd(rand(40, 110), 1), size: rand(2.5, 4.5), life: rand(0.3, 0.5), color: '#86EFAC', drag: 3 });
      break;
    case 'caldris': // soul-rail: teal ring kicks out from the focus + lightning flicker
      flash(x, y, 38, '#2DD4BF', 0.14);
      shock(x, y, 22, '#5EEAD4', 0.18);
      bolt(x, y, x + Math.cos(angle) * 26 + rand(-6, 6), y + Math.sin(angle) * 26 + rand(-6, 6), '#99F6E4', 1.5, 0.08);
      break;
    case 'vespra': // venom dart: puff of toxic mist + droplets
      flash(x, y, 24, '#84CC16', 0.1);
      for (let i = 0; i < 2; i++) emit({ kind: 'smoke', x, y, ...fwd(rand(20, 60), 0.8), size: rand(4, 7), life: rand(0.4, 0.6), color: '#3F6212', drag: 3 });
      for (let i = 0; i < 3; i++) emit({ kind: 'drip', x, y, ...fwd(rand(80, 160), 0.6), size: 2, life: 0.4, color: '#A3E635', grav: 500 });
      break;
    case 'vale': // prism lance: refracted rainbow-ish glints
      flash(x, y, 30, '#FDE047', 0.1);
      for (const c of ['#FDE047', '#38BDF8', '#F0ABFC']) emit({ kind: 'spark', x, y, ...fwd(rand(180, 300), 0.5), size: 1.8, life: 0.16, color: c, drag: 5 });
      break;
    case 'bastion': // censer mortar: fiery belch + heavy smoke
      flash(x, y, 50, '#FB923C', 0.14);
      for (let i = 0; i < 8; i++) emit({ kind: 'ember', x, y, ...fwd(rand(100, 240), 0.5), size: rand(1.6, 3), life: rand(0.25, 0.5), color: i % 3 ? '#FB923C' : '#FDE047', grav: 300, drag: 2 });
      for (let i = 0; i < 4; i++) emit({ kind: 'smoke', x, y, ...fwd(rand(40, 90), 0.6), size: rand(7, 12), life: rand(0.5, 0.8), color: '#52525B', drag: 2.5 });
      break;
    default:
      flash(x, y, 28, '#FFFFFF', 0.1);
  }
}

/** Melee strike (Marrow, Xylar). (x, y) = hero centre. */
export function heroSlash(heroId: HeroId, x: number, y: number, angle: number, crit = false): void {
  const hx = x + Math.cos(angle) * 34;
  const hy = y + Math.sin(angle) * 26 - 4;
  if (heroId === 'marrow') {
    // Butcher cleave: plague-green gore spray + rust sparks flung along the arc
    flash(hx, hy, 40, '#34D399', 0.12);
    for (let i = 0; i < 7; i++) {
      const a = angle + rand(-0.9, 0.9);
      const sp = rand(140, 280);
      emit({ kind: 'drip', x: hx, y: hy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, size: rand(1.8, 3), life: rand(0.35, 0.6), color: i % 3 ? '#4ADE80' : '#B91C1C', grav: 700 });
    }
    for (let i = 0; i < 4; i++) {
      const a = angle + rand(-0.6, 0.6);
      emit({ kind: 'spark', x: hx, y: hy, vx: Math.cos(a) * 320, vy: Math.sin(a) * 320, size: 1.6, life: 0.14, color: '#FDBA74', drag: 5 });
    }
  } else {
    // Xylar: hard-light afterimage blades in a fan, gold if the ambush crit fires
    const c = crit ? '#FDE047' : '#22D3EE';
    flash(hx, hy, crit ? 54 : 30, c, crit ? 0.2 : 0.1);
    for (let i = 0; i < 5; i++) {
      const a = angle + (i - 2) * 0.28;
      emit({ kind: 'shard', x: x + Math.cos(a) * 24, y: y + Math.sin(a) * 20 - 4, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, size: 3, life: 0.16, color: c, drag: 6, spin: 0 });
    }
    if (crit) {
      shock(hx, hy, 50, '#FDE047');
      burst(hx, hy, 14, '#FDE047', { speed: [160, 340], white: 3 });
    }
  }
}

// ---------- abilities (one-shot, from sim fx events) ----------

export type AbilityTag =
  | 'dynamite' | 'bull' | 'dash' | 'spin' | 'bite' | 'meltdown' | 'totem' | 'drone' | 'hook' | 'hook_hit'
  | 'rot' | 'spear' | 'aegis' | 'vortex' | 'cloak' | 'orbital' | 'undead' | 'censer' | 'contagion' | 'flare' | 'blink';

/**
 * One-shot burst when an ability fires. `owner` (if known) supplies aim/facing so
 * directional effects point the right way.
 */
export function heroAbilityVfx(tag: AbilityTag, x: number, y: number, owner?: HeroEntity): void {
  const aim = owner?.aimAngle ?? 0;
  const feet = y + (owner ? owner.h / 2 : 20);
  switch (tag) {
    // Marrow
    case 'hook':
      flash(x + Math.cos(aim) * 20, y + Math.sin(aim) * 20, 30, '#94A3B8', 0.12);
      burst(x + Math.cos(aim) * 20, y + Math.sin(aim) * 20, 8, '#CBD5E1', { speed: [120, 240] });
      break;
    case 'hook_hit':
      flash(x, y, 60, '#34D399', 0.2);
      shock(x, y, 60, '#34D399');
      burst(x, y, 16, '#4ADE80', { kind: 'drip', speed: [120, 260], grav: 650, white: 4 });
      break;
    case 'rot':
      shock(x, feet, 90, '#10B981', 0.45);
      smoke(x, y, 8, '#14532D', [8, 14]);
      burst(x, y, 12, '#34D399', { kind: 'bubble', speed: [30, 90], grav: -60, life: [0.6, 1], size: [3, 6] });
      break;
    // Seraph
    case 'spear':
      pillar(x, feet, 14, 180, '#FDE68A', 0.35);
      flash(x, y, 50, '#FBBF24', 0.18);
      burst(x, y, 8, '#FEF3C7', { kind: 'feather', speed: [40, 110], grav: 40, life: [0.6, 1], size: [2.5, 4] });
      break;
    case 'aegis':
      pillar(x, feet, 30, 320, '#FDE68A', 0.7);
      shock(x, y, 120, '#FBBF24', 0.5);
      rune(x, y, 70, '#FDE047', 0.8, 2);
      burst(x, y - 60, 18, '#FEF3C7', { kind: 'feather', speed: [60, 160], grav: 60, life: [0.8, 1.3], size: [3, 4.5], up: 80 });
      break;
    // Korak
    case 'totem':
      shock(x, feet, 70, '#4ADE80', 0.45);
      for (let i = 0; i < 14; i++) emit({ kind: 'wisp', x: x + rand(-26, 26), y: feet - rand(0, 10), vx: rand(-20, 20), vy: rand(-180, -80), size: rand(3, 6), life: rand(0.5, 0.9), color: i % 3 ? '#4ADE80' : '#BBF7D0', drag: 1.5 });
      break;
    case 'drone': // Ancestral Skulls (Korak) / generic summon
      flash(x, y - 20, 46, '#86EFAC', 0.2);
      burst(x, y - 20, 12, '#4ADE80', { kind: 'wisp', speed: [50, 140], grav: -40, life: [0.4, 0.7], size: [3, 5] });
      break;
    // Vorg
    case 'dash': {
      // Rift tear: the space he left implodes, shards fly along the path
      flash(x, y, 50, '#A855F7', 0.18);
      shock(x, y, 50, '#C084FC', 0.25);
      for (let i = 0; i < 12; i++) {
        const d = rand(0, 120);
        emit({ kind: 'shard', x: x + Math.cos(aim) * d, y: y + Math.sin(aim) * d, vx: rand(-60, 60), vy: rand(-60, 60), size: rand(2.5, 4.5), life: rand(0.3, 0.5), color: i % 3 ? '#A855F7' : '#E9D5FF', drag: 3, spin: rand(-14, 14) });
      }
      bolt(x, y, x + Math.cos(aim) * 120, y + Math.sin(aim) * 120, '#C084FC', 2.5, 0.18);
      break;
    }
    case 'spin':
      shock(x, y, 100, '#A855F7', 0.4);
      rune(x, y, 60, '#C084FC', 0.6, 8);
      break;
    // Bastion
    case 'bite': {
      const fx = x + (owner?.facing ?? 1) * 40;
      flash(fx, y, 50, '#FBBF24', 0.16);
      shock(fx, y, 44, '#FDE047', 0.25);
      burst(fx, y, 14, '#FDE047', { speed: [150, 320], white: 3 });
      break;
    }
    case 'meltdown':
      rune(x, feet, 80, '#FBBF24', 1.0, 1.5);
      shock(x, y, 70, '#F59E0B', 0.4);
      break;
    // Vexia
    case 'dynamite':
      flash(x, y, 30, '#F97316', 0.12);
      burst(x, y, 8, '#FDE047', { speed: [100, 220], life: [0.15, 0.3] });
      break;
    case 'bull':
      flash(x, y, 60, '#38BDF8', 0.2);
      shock(x, feet, 70, '#38BDF8', 0.35);
      for (let i = 0; i < 10; i++) emit({ kind: 'spark', x: x + rand(-30, 30), y: y + rand(-30, 30), vx: 0, vy: rand(-140, -60), size: 1.6, life: rand(0.2, 0.4), color: '#7DD3FC', drag: 2 });
      break;
    // Xylar
    case 'vortex':
      flash(x, y, 40, '#818CF8', 0.15);
      break;
    case 'cloak':
      // Light bends away: glints spray out and fade, a ring collapses inward
      shock(x, y, 60, '#38BDF8', 0.3);
      for (let i = 0; i < 16; i++) {
        const a = rand(0, TAU);
        emit({ kind: 'shard', x: x + Math.cos(a) * 26, y: y + Math.sin(a) * 30, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, size: rand(1.5, 3), life: rand(0.3, 0.6), color: i % 2 ? '#38BDF8' : '#E0F2FE', drag: 3, spin: rand(-8, 8) });
      }
      break;
    // Caldris
    case 'orbital':
      rune(x, y, 50, '#2DD4BF', 0.9, 3);
      break;
    case 'undead':
      shock(x, feet, 80, '#2DD4BF', 0.4);
      smoke(x, feet - 10, 6, '#134E4A');
      for (let i = 0; i < 12; i++) emit({ kind: 'wisp', x: x + rand(-40, 40), y: feet - rand(0, 6), vx: rand(-15, 15), vy: rand(-160, -70), size: rand(3, 5), life: rand(0.5, 0.8), color: i % 3 ? '#2DD4BF' : '#CCFBF1', drag: 1.5 });
      break;
    // Vespra
    case 'censer':
      flash(x, y, 30, '#84CC16', 0.12);
      break;
    case 'contagion':
      flash(x, y, 90, '#84CC16', 0.25);
      shock(x, y, 140, '#A3E635', 0.45);
      shock(x, y, 90, '#4D7C0F', 0.35);
      burst(x, y, 20, '#A3E635', { kind: 'bubble', speed: [80, 220], grav: -30, life: [0.5, 0.9], size: [3, 7] });
      smoke(x, y, 8, '#365314', [8, 16]);
      break;
    // Vale
    case 'flare':
      flash(x, y, 36, '#FBBF24', 0.12);
      break;
    case 'blink': {
      // Solar afterimage explodes where she was; streak of light toward where she went
      flash(x, y, 70, '#FDE047', 0.22);
      shock(x, y, 70, '#FBBF24', 0.35);
      burst(x, y, 16, '#FDE047', { speed: [140, 300], white: 3 });
      const tx = owner ? owner.x : x + Math.cos(aim) * 150;
      const ty = owner ? owner.y : y + Math.sin(aim) * 150;
      for (let i = 0; i < 10; i++) {
        const f = i / 10;
        emit({ kind: 'ember', x: x + (tx - x) * f, y: y + (ty - y) * f, vx: rand(-20, 20), vy: rand(-30, 10), size: rand(2, 3.5), life: rand(0.25, 0.45), color: '#FDE047', drag: 2 });
      }
      break;
    }
  }
}

// ---------- continuous auras while timed abilities are active ----------

/** Called once per hero per frame. Emits at a fixed rate per second while effects are active. */
export function heroAuraVfx(h: HeroEntity, time: number): void {
  if (!h.alive || h.inDropPod) return;
  const feet = h.y + h.h / 2;

  // Marrow Blight Furnace: plague bubbles + low rot smoke
  if (h.rotTimer > 0) {
    if (chance(26)) emit({ kind: 'bubble', x: h.x + rand(-60, 60), y: feet - rand(0, 20), vx: rand(-10, 10), vy: rand(-70, -30), size: rand(2.5, 5), life: rand(0.6, 1), color: '#34D399', grav: -20 });
    if (chance(8)) emit({ kind: 'smoke', x: h.x + rand(-50, 50), y: feet - 6, vx: rand(-20, 20), vy: rand(-30, -10), size: rand(10, 16), life: rand(0.8, 1.2), color: '#14532D', drag: 1 });
  }
  // Vorg Soul Maelstrom: soulfire orbits him
  if (h.spinTimer > 0) {
    for (let k = 0; k < 2; k++) {
      if (!chance(40)) continue;
      const a = time * 14 + rand(0, TAU);
      const r = rand(30, 80);
      emit({ kind: k ? 'shard' : 'ember', x: h.x + Math.cos(a) * r, y: h.y + Math.sin(a) * r * 0.7, vx: -Math.sin(a) * 220, vy: Math.cos(a) * 160, size: rand(2, 3.5), life: rand(0.18, 0.32), color: k ? '#C084FC' : '#E9D5FF', drag: 4, spin: rand(-12, 12) });
    }
  }
  // Vorg rift dash: torn-space shards left in his wake
  if (h.dashTimer > 0 && h.heroId === 'vorg' && chance(60)) {
    emit({ kind: 'shard', x: h.x + rand(-10, 10), y: h.y + rand(-20, 20), vx: rand(-30, 30), vy: rand(-30, 30), size: rand(2.5, 4), life: rand(0.25, 0.4), color: '#A855F7', drag: 3, spin: rand(-10, 10) });
  }
  // Bastion Divine Reckoning: holy motes converge as the charge builds
  if (h.meltdownTimer > 0 && h.meltdownMaxTimer > 0) {
    const prog = 1 - h.meltdownTimer / h.meltdownMaxTimer;
    if (chance(20 + prog * 50)) {
      const a = rand(0, TAU);
      const r = rand(90, 160);
      const life = rand(0.35, 0.55);
      emit({ kind: 'ember', x: h.x + Math.cos(a) * r, y: h.y + Math.sin(a) * r, vx: (-Math.cos(a) * r) / life, vy: (-Math.sin(a) * r) / life, size: rand(1.8, 3.2), life, color: Math.random() < 0.3 ? '#FFFFFF' : '#FDE047' });
    }
    if (chance(4 + prog * 10)) bolt(h.x + rand(-20, 20), h.y - rand(20, 50), h.x + rand(-60, 60), h.y + rand(-60, 30), '#FDE047', 1.6, 0.08);
  }
  // Xylar cloak: faint glints only (stays readable but subtle)
  if (h.cloakTimer > 0 && chance(6)) {
    emit({ kind: 'spark', x: h.x + rand(-14, 14), y: h.y + rand(-24, 24), vx: 0, vy: -20, size: 1.2, life: 0.25, color: '#BAE6FD' });
  }
  // Vale Chrono Haste: golden time-motes trail behind her
  if (h.hasteTimer > 0 && chance(30)) {
    emit({ kind: 'ember', x: h.x + rand(-12, 12), y: h.y + rand(-26, 26), vx: -h.vx * 0.2 + rand(-15, 15), vy: rand(-30, 0), size: rand(1.6, 2.8), life: rand(0.3, 0.5), color: Math.random() < 0.5 ? '#FDE047' : '#38BDF8', drag: 2 });
  }
  // Recall: motes rise around the hero
  if (h.recallTimer > 0 && chance(14)) {
    emit({ kind: 'ember', x: h.x + rand(-22, 22), y: feet - rand(0, 10), vx: 0, vy: rand(-140, -70), size: rand(1.6, 2.6), life: rand(0.5, 0.8), color: '#7DD3FC', drag: 1 });
  }
}

// ---------- spell zones, summons, hooks ----------

const triggeredHazards = new Set<string>();

export function hazardVfx(hz: HazardZoneEntity, time: number): void {
  switch (hz.kind) {
    case 'singularity': {
      // Matter spirals into the black hole
      for (let k = 0; k < 2; k++) {
        if (!chance(45)) continue;
        const a = rand(0, TAU);
        const r = hz.radius * rand(0.7, 1.05);
        const life = rand(0.4, 0.6);
        const tangential = 0.9;
        emit({
          kind: k ? 'spark' : 'ember', x: hz.x + Math.cos(a) * r, y: hz.y + Math.sin(a) * r,
          vx: (-Math.cos(a) * r) / life - Math.sin(a) * r * tangential, vy: (-Math.sin(a) * r) / life + Math.cos(a) * r * tangential,
          size: rand(1.5, 2.8), life, color: k ? '#C7D2FE' : '#818CF8', drag: 0.5,
        });
      }
      break;
    }
    case 'orbital_smite': {
      if (!hz.triggered) {
        // Uplink: thin targeting beam flickers down onto the reticle
        if (chance(30)) pillar(hz.x, hz.y + hz.radius * 0.3, 3, 600, '#5EEAD4', 0.08);
        if (chance(10)) emit({ kind: 'spark', x: hz.x + rand(-hz.radius, hz.radius), y: hz.y + rand(-10, 10), vx: 0, vy: rand(-60, -20), size: 1.4, life: 0.3, color: '#99F6E4' });
      } else {
        if (!triggeredHazards.has(hz.id)) {
          // The strike: huge sky pillar, flash, lightning forks, debris
          triggeredHazards.add(hz.id);
          pillar(hz.x, hz.y + hz.radius * 0.4, hz.radius * 0.7, 900, '#2DD4BF', 0.55);
          flash(hz.x, hz.y, hz.radius * 2.2, '#5EEAD4', 0.3);
          shock(hz.x, hz.y, hz.radius * 1.6, '#2DD4BF', 0.4);
          for (let i = 0; i < 5; i++) bolt(hz.x + rand(-10, 10), hz.y - rand(150, 400), hz.x + rand(-hz.radius, hz.radius), hz.y + rand(-10, 20), '#99F6E4', 2.4, 0.2);
          burst(hz.x, hz.y, 26, '#5EEAD4', { speed: [180, 420], white: 3, up: 120 });
          smoke(hz.x, hz.y, 8, '#134E4A', [10, 18]);
        }
        if (chance(30)) bolt(hz.x + rand(-hz.radius * 0.3, hz.radius * 0.3), hz.y - rand(100, 300), hz.x + rand(-hz.radius * 0.5, hz.radius * 0.5), hz.y, '#CCFBF1', 1.6, 0.07);
      }
      break;
    }
    case 'plague_cloud':
      if (chance(22)) emit({ kind: 'bubble', x: hz.x + rand(-hz.radius, hz.radius) * 0.8, y: hz.y + rand(-hz.radius, hz.radius) * 0.5, vx: rand(-10, 10), vy: rand(-40, -15), size: rand(2.5, 5), life: rand(0.6, 1), color: '#A3E635', grav: -15 });
      if (chance(10)) emit({ kind: 'smoke', x: hz.x + rand(-hz.radius, hz.radius) * 0.8, y: hz.y + rand(-hz.radius, hz.radius) * 0.4, vx: rand(-15, 15), vy: rand(-20, -5), size: rand(12, 20), life: rand(0.9, 1.4), color: '#365314', drag: 1 });
      break;
    case 'solar_flare': {
      // Ring of fire: embers lick upward around the circumference
      for (let k = 0; k < 2; k++) {
        if (!chance(30)) continue;
        const a = rand(0, TAU);
        emit({ kind: 'ember', x: hz.x + Math.cos(a) * hz.radius, y: hz.y + Math.sin(a) * hz.radius * 0.45, vx: rand(-15, 15), vy: rand(-140, -60), size: rand(1.8, 3.2), life: rand(0.3, 0.55), color: Math.random() < 0.35 ? '#FDE047' : '#F97316', drag: 1.5 });
      }
      break;
    }
  }
  if (triggeredHazards.size > 64) triggeredHazards.clear();
}

export function summonVfx(s: SummonEntity): void {
  if (s.kind === 'totem') {
    // Ancestral totem: spirit flame on top + healing motes rising around it
    if (chance(18)) emit({ kind: 'wisp', x: s.x + rand(-5, 5), y: s.y - s.h / 2, vx: rand(-10, 10), vy: rand(-70, -30), size: rand(2.5, 4.5), life: rand(0.4, 0.7), color: '#4ADE80', drag: 1.5 });
    if (chance(6)) emit({ kind: 'ember', x: s.x + rand(-60, 60), y: s.y + s.h / 2, vx: 0, vy: rand(-60, -30), size: 1.8, life: 0.8, color: '#BBF7D0' });
  } else if (s.kind === 'bull') {
    // Holo-ram: hologram scan sparks + dust kicked up behind
    if (chance(20)) emit({ kind: 'spark', x: s.x + rand(-s.w / 2, s.w / 2), y: s.y + rand(-s.h / 2, s.h / 2), vx: 0, vy: -40, size: 1.4, life: 0.2, color: '#7DD3FC' });
    if (Math.abs(s.vx) > 20 && chance(14)) emit({ kind: 'smoke', x: s.x - Math.sign(s.vx) * s.w * 0.4, y: s.y + s.h / 2 - 4, vx: -s.vx * 0.15, vy: rand(-30, -10), size: rand(5, 9), life: 0.5, color: '#64748B', drag: 2 });
  } else if (s.kind === 'drone') {
    if (chance(12)) emit({ kind: 'wisp', x: s.x, y: s.y, vx: rand(-15, 15), vy: rand(-15, 15), size: rand(2, 3.5), life: 0.4, color: '#86EFAC', drag: 2 });
  }
}

export function hookVfx(hk: HookEntity): void {
  // Barbed chain head throws sparks and trails green plague
  if (chance(40)) emit({ kind: 'spark', x: hk.x, y: hk.y, vx: -hk.vx * 0.15 + rand(-60, 60), vy: -hk.vy * 0.15 + rand(-60, 60), size: 1.5, life: 0.18, color: Math.random() < 0.5 ? '#CBD5E1' : '#FDBA74', drag: 3, grav: 200 });
  if (chance(16)) emit({ kind: 'drip', x: hk.x, y: hk.y, vx: 0, vy: 20, size: 1.8, life: 0.4, color: '#4ADE80', grav: 500 });
}
