// Dev-only ability/weapon effects showcase. Open /fx-preview.html
// Every hero loops: primary fire x3 -> Q -> E, with that hero's real signature effects,
// auras (timers) and spell zones, so effects can be judged without playing a match.
import { ArenaSimulation } from '../game/sim';
import { drawHero } from '../game/renderer';
import { ensureArenaArtLoaded } from '../game/sprites';
import { vfxBeginFrame, vfxDrawParticles, vfxDrawTrails, vfxTrackProjectile } from '../game/vfx';
import { getHurtboxes } from '../game/hitboxes';
import { hazardVfx, heroAbilityVfx, heroAuraVfx, type AbilityTag } from '../game/heroVfx';
import type { HazardZoneEntity, HeroEntity, HeroId, ProjectileEntity } from '../game/types';

const HEROES: HeroId[] = ['marrow', 'seraph', 'korak', 'vorg', 'bastion', 'vexia', 'xylar', 'caldris', 'vespra', 'vale'];
const PROJ: Record<HeroId, ProjectileEntity['kind']> = {
  marrow: 'cleaver', seraph: 'revolver', korak: 'biobeam', vorg: 'sonic', bastion: 'mortar',
  vexia: 'revolver', xylar: 'dagger', caldris: 'soul_orb', vespra: 'venom_dart', vale: 'prism_lance',
};
const PROJ_COLOR: Record<HeroId, string> = {
  marrow: '#10B981', seraph: '#FBBF24', korak: '#4ADE80', vorg: '#A855F7', bastion: '#F59E0B',
  vexia: '#F43F5E', xylar: '#38BDF8', caldris: '#2DD4BF', vespra: '#84CC16', vale: '#FDE047',
};
// [Q tag, E tag, which timer E turns on, hazard spawned by Q/E]
const KIT: Record<HeroId, { q: AbilityTag; e: AbilityTag; eTimer?: keyof HeroEntity; hazard?: HazardZoneEntity['kind']; hazardOn?: 'q' | 'e'; qFollow?: AbilityTag }> = {
  marrow: { q: 'hook', qFollow: 'hook_hit', e: 'rot', eTimer: 'rotTimer' },
  seraph: { q: 'spear', e: 'aegis' },
  korak: { q: 'totem', e: 'drone' },
  vorg: { q: 'dash', e: 'spin', eTimer: 'spinTimer' },
  bastion: { q: 'bite', e: 'meltdown', eTimer: 'meltdownTimer' },
  vexia: { q: 'dynamite', e: 'bull' },
  xylar: { q: 'vortex', e: 'cloak', eTimer: 'cloakTimer', hazard: 'singularity', hazardOn: 'q' },
  caldris: { q: 'orbital', e: 'undead', hazard: 'orbital_smite', hazardOn: 'q' },
  vespra: { q: 'censer', e: 'contagion', hazard: 'plague_cloud', hazardOn: 'q' },
  vale: { q: 'flare', e: 'blink', eTimer: 'hasteTimer', hazard: 'solar_flare', hazardOn: 'q' },
};

const canvas = document.getElementById('c') as HTMLCanvasElement;
canvas.width = 1500; canvas.height = 760;
const ctx = canvas.getContext('2d')!;
const ui = document.getElementById('ui')!;
let slow = 1;
const slowBtn = document.createElement('button');
const lbl = () => (slowBtn.textContent = `speed x${slow}`);
slowBtn.onclick = () => { slow = slow === 1 ? 0.25 : 1; lbl(); };
lbl(); ui.append(slowBtn);
const phaseLbl = document.createElement('span'); phaseLbl.style.padding = '4px 8px'; ui.append(phaseLbl);

const ONLY = new URLSearchParams(location.search).get('only') as HeroId | null;
const SCALE = ONLY ? 3.2 : 1.25;
const SHOW_HB = new URLSearchParams(location.search).has('hitboxes');
// ?still freezes the loop so sprites can be compared with their boxes
const STILL = new URLSearchParams(location.search).has('still');
const sim = new ArenaSimulation('marrow', 'standard', true);
const tmpl = sim.heroes[0];
const cols = 5;
const cw = canvas.width / SCALE / cols;
const ch = canvas.height / SCALE / 2;
const heroes: HeroEntity[] = (ONLY ? [ONLY] : HEROES).map((id, i) => ({
  ...tmpl, id: `fx_${id}`, heroId: id, name: id, team: 'blue', isPlayer: false,
  x: ONLY ? canvas.width / SCALE / 2 : (i % cols) * cw + cw * 0.3,
  y: ONLY ? canvas.height / SCALE * 0.55 : Math.floor(i / cols) * ch + ch * 0.62,
  vx: 0, vy: 0, grounded: true, facing: 1, aimAngle: -0.08, inDropPod: false, alive: true,
  recallTimer: 0, dashTimer: 0, spinTimer: 0, cloakTimer: 0, rotTimer: 0, hasteTimer: 0, meltdownTimer: 0, meltdownMaxTimer: 2.75,
  hitFlashTimer: 0, recoilTimer: 0, skill1Cd: 0, skill2Cd: 0, walkCycle: 0, squashX: 1, squashY: 1, hp: tmpl.maxHp,
}));
const projectiles: (ProjectileEntity & { born: number })[] = [];
const hazards: (HazardZoneEntity & { born: number })[] = [];
let pid = 0;

const CYCLE = 6; // seconds: fire 0-1.5, Q at 2, E at 3.8
let t = 0, last = performance.now();
const fired = new Set<string>();
function once(key: string, cond: boolean, fn: () => void) { if (cond && !fired.has(key)) { fired.add(key); fn(); } }

function frame(now: number) {
  const dt = STILL ? 0 : Math.min(0.05, (now - last) / 1000) * slow; last = now; t += dt;
  const loop = Math.floor(t / CYCLE), ct = t % CYCLE;
  phaseLbl.textContent = ct < 1.6 ? 'primary fire' : ct < 3.6 ? 'Q (skill 1)' : 'E (skill 2)';
  vfxBeginFrame(t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#14161f'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(SCALE, SCALE);
  const art = ensureArenaArtLoaded(ctx);

  heroes.forEach((h, i) => {
    const kit = KIT[h.heroId];
    const k = `${loop}_${i}`;
    // timers tick
    for (const key of ['recoilTimer', 'rotTimer', 'spinTimer', 'cloakTimer', 'hasteTimer', 'meltdownTimer', 'dashTimer', 'skill1Cd', 'skill2Cd'] as const) {
      (h as any)[key] = Math.max(0, (h as any)[key] - dt);
    }
    // primary x3
    [0.2, 0.7, 1.2].forEach((at, n) => once(`${k}_p${n}`, ct >= at, () => {
      h.recoilTimer = 0.1;
      const melee = h.heroId === 'marrow' || h.heroId === 'xylar';
      const sp = h.heroId === 'bastion' ? 420 : 700;
      projectiles.push({ ...({} as ProjectileEntity), id: `p${pid++}`, ownerId: h.id, team: 'blue', kind: PROJ[h.heroId],
        x: h.x + 26, y: h.y - 4, vx: Math.cos(h.aimAngle) * sp, vy: Math.sin(h.aimAngle) * sp - (h.heroId === 'bastion' ? 250 : 0),
        radius: h.heroId === 'caldris' ? 9 : melee ? 22 : 6, color: PROJ_COLOR[h.heroId], gravity: h.heroId === 'bastion' ? 900 : 0,
        hitIds: new Set(), life: melee ? 0.12 : 0.3, maxLife: 0.3, born: t } as any);
    }));
    // Q
    once(`${k}_q`, ct >= 2, () => {
      h.skill1Cd = 6;
      heroAbilityVfx(kit.q, h.x, h.y, h);
      if (kit.hazard && kit.hazardOn === 'q') {
        hazards.push({ id: `hz${pid++}`, ownerId: h.id, team: 'blue', kind: kit.hazard, x: h.x + 110, y: h.y + 10,
          radius: kit.hazard === 'singularity' ? 70 : 60, damage: 0, timer: 1.6, maxTimer: 1.6, tickTimer: 0,
          triggered: false, color: PROJ_COLOR[h.heroId], stunDuration: 0, born: t });
      }
    });
    if (kit.qFollow) once(`${k}_qf`, ct >= 2.35, () => heroAbilityVfx(kit.qFollow!, h.x + 120, h.y - 6, h));
    // E
    once(`${k}_e`, ct >= 3.8, () => {
      h.skill2Cd = 8;
      if (kit.eTimer) (h as any)[kit.eTimer] = kit.eTimer === 'meltdownTimer' ? 2.0 : 1.8;
      if (kit.eTimer === 'meltdownTimer') h.meltdownMaxTimer = 2.0;
      if (h.heroId === 'vorg') h.dashTimer = 0;
      heroAbilityVfx(kit.e, h.x, h.y, h);
    });
    // Bastion meltdown release
    once(`${k}_boom`, h.heroId === 'bastion' && ct >= 5.75, () => heroAbilityVfx('aegis', h.x, h.y, h));
    heroAuraVfx(h, t);
    drawHero(ctx, h, t, 'blue', art.heroes[h.heroId], null);
    ctx.fillStyle = '#9ad'; ctx.font = '11px monospace';
    ctx.fillText(`${h.heroId}  Q:${kit.q}  E:${kit.e}`, (i % cols) * cw + 6, Math.floor(i / cols) * ch + 14);
  });

  // hazards: orbital triggers halfway, others just live
  for (let i = hazards.length - 1; i >= 0; i--) {
    const hz = hazards[i];
    hz.timer -= dt;
    if (hz.kind === 'orbital_smite' && hz.timer < 0.85) hz.triggered = true;
    if (hz.timer <= 0) { hazards.splice(i, 1); continue; }
    ctx.strokeStyle = hz.color; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(hz.x, hz.y, hz.radius, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    hazardVfx(hz, t);
  }
  // projectiles: simple ballistic motion
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.life -= dt; p.vy += p.gravity * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.life <= 0) { projectiles.splice(i, 1); continue; }
    vfxTrackProjectile(p, heroes.find((h) => h.id === p.ownerId)?.heroId);
  }
  vfxDrawTrails(ctx);
  for (const p of projectiles) {
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, Math.min(6, p.radius * 0.6), 0, Math.PI * 2); ctx.fill();
  }
  vfxDrawParticles(ctx);
  if (SHOW_HB) {
    const ZC = { head: '#F43F5E', torso: '#FB923C', legs: '#FDE047' } as const;
    ctx.lineWidth = 1.2;
    for (const h of heroes) for (const b of getHurtboxes(h)) {
      ctx.strokeStyle = ZC[b.zone]; ctx.strokeRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
    }
  }
  if (fired.size > 4000) fired.clear();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
