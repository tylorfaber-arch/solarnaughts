// Dev-only animation preview: draws heroes large with scripted states so you can
// judge idle / run / jump / attack / cast / hurt in isolation. Open /anim-preview.html
import { ArenaSimulation } from '../game/sim';
import { drawHero } from '../game/renderer';
import { ensureArenaArtLoaded } from '../game/sprites';
import { vfxBeginFrame, vfxDrawParticles } from '../game/vfx';
import type { HeroEntity, HeroId } from '../game/types';

const HEROES: HeroId[] = ['marrow','seraph','korak','vorg','bastion','vexia','xylar','caldris','vespra','vale'];
const STATES = ['idle','run','jump','attack','attack-spam','cast1','cast2','hurt','run+attack'] as const;
type S = typeof STATES[number];

const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const ui = document.getElementById('ui')!;
const params = new URLSearchParams(location.search);
let heroId = (params.get('hero') as HeroId) || 'marrow';
let slow = Number(params.get('slow') || 1);
let frozen: number | null = null;

const sel = document.createElement('select');
HEROES.forEach((h) => { const o = document.createElement('option'); o.value = o.textContent = h; sel.append(o); });
sel.value = heroId; sel.onchange = () => { heroId = sel.value as HeroId; build(); };
ui.append(sel);
const slowBtn = document.createElement('button');
const setSlowLabel = () => (slowBtn.textContent = `speed x${slow}`);
slowBtn.onclick = () => { slow = slow === 1 ? 0.25 : slow === 0.25 ? 0.1 : 1; setSlowLabel(); };
setSlowLabel(); ui.append(slowBtn);
(window as any).__freeze = (t: number | null) => (frozen = t);

let heroes: { s: S; h: HeroEntity }[] = [];
function build() {
  const sim = new ArenaSimulation(heroId, 'standard', true);
  const tmpl = sim.heroes.find((h) => h.heroId === heroId) ?? sim.heroes[0];
  heroes = STATES.map((s, i) => {
    const h: HeroEntity = { ...tmpl, id: `preview_${i}`, heroId, team: 'blue', isPlayer: false,
      x: 0, y: 0, vx: 0, vy: 0, grounded: true, facing: 1, aimAngle: 0, inDropPod: false, alive: true,
      recallTimer: 0, dashTimer: 0, spinTimer: 0, cloakTimer: 0, hitFlashTimer: 0, recoilTimer: 0,
      skill1Cd: 0, skill2Cd: 0, walkCycle: 0, squashX: 1, squashY: 1, hp: tmpl.maxHp };
    return { s, h };
  });
}
build();

let t = 0;
let last = performance.now();
function frame(now: number) {
  const realDt = Math.min(0.05, (now - last) / 1000); last = now;
  const dt = realDt * slow;
  if (frozen === null) t += dt;
  const time = frozen ?? t;
  const art = ensureArenaArtLoaded(ctx);
  ctx.fillStyle = '#1a1d27'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  vfxBeginFrame(time);
  const cols = 5, cw = canvas.width / cols, ch = canvas.height / 2;
  heroes.forEach(({ s, h }, i) => {
    // scripted inputs per state (mirrors what sim.ts sets)
    const cyc = time % 1.2;
    h.vx = 0; h.vy = 0; h.grounded = true;
    if (s === 'run' || s === 'run+attack') { h.vx = 230; h.walkCycle += dt * 230 * 0.015; }
    if (s === 'jump') { const p = time % 1.4; h.grounded = p > 1.0; h.vy = p < 0.5 ? -400 : 300; }
    const fireEvery = s === 'attack-spam' ? 0.18 : 0.6;
    if (s === 'attack' || s === 'attack-spam' || s === 'run+attack') {
      h.recoilTimer = Math.max(0, h.recoilTimer - dt);
      if ((h as any)._nextShot === undefined || time >= (h as any)._nextShot) { h.recoilTimer = 0.1; h.primaryShotCounter += 1; (h as any)._nextShot = time + fireEvery; }
    }
    if (s === 'cast1') { h.skill1Cd = Math.max(0, h.skill1Cd - dt); if (cyc < dt) h.skill1Cd = 5; }
    if (s === 'cast2') { h.skill2Cd = Math.max(0, h.skill2Cd - dt); if (cyc < dt) h.skill2Cd = 8; }
    if (s === 'hurt') { h.hitFlashTimer = Math.max(0, h.hitFlashTimer - dt); if (cyc < dt) { h.hp -= 10; h.hitFlashTimer = 0.12; if (h.hp < 50) h.hp = h.maxHp; } }
    const ox = (i % cols) * cw + cw / 2, oy = Math.floor(i / cols) * ch + ch * 0.62;
    // heroes live in world coords (canvas / 2) so the shared VFX particles line up with them
    h.x = ox / 2; h.y = oy / 2;
    ctx.save(); ctx.scale(2, 2);
    ctx.strokeStyle = '#334'; ctx.beginPath(); ctx.moveTo(h.x - 60, h.y + h.h / 2 + 2); ctx.lineTo(h.x + 60, h.y + h.h / 2 + 2); ctx.stroke();
    drawHero(ctx, h, time, 'blue', art.heroes[h.heroId], null);
    ctx.restore();
    ctx.fillStyle = '#9ad'; ctx.fillText(s, ox - cw / 2 + 8, Math.floor(i / cols) * ch + 16);
  });
  ctx.save(); ctx.scale(2, 2); vfxDrawParticles(ctx); ctx.restore();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

