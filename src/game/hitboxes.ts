/**
 * Fighting-game style hurtboxes.
 *
 * Each hero has three boxes — HEAD, TORSO, LEGS — shaped to their drawn sprite, instead of one
 * circle around the physics centre. Attacks are tested with a *swept* check (the segment the
 * attack travelled this tick, thickened by its radius), so fast shots can't skip through a target
 * between ticks, and when several targets are in the path the FIRST one along it is hit.
 *
 * Shared by the simulation (authoritative hit detection, also on the server) and the renderer
 * (?hitboxes debug overlay), so what you see is exactly what is tested. No DOM access here.
 *
 * Coordinates: boxes are authored relative to the hero's FEET, facing right, in units of the
 * hero's drawn sprite height (HERO_SPRITE_HEIGHT), then mirrored by `facing` at runtime.
 */
import type { HeroEntity, HeroId } from './types';

/** Drawn sprite height in px (the renderer draws heroes at exactly this height). */
export const HERO_SPRITE_HEIGHT: Record<HeroId, number> = {
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

/** Floating heroes hover this many px above their feet when idle (matches renderer rootLift). */
const HOVER_LIFT: Partial<Record<HeroId, number>> = { korak: 6, caldris: 6 };

export type HurtZone = 'head' | 'torso' | 'legs';

/** Box in sprite-height units: x relative to centre (facing right), y measured UP from the feet. */
interface UnitBox {
  zone: HurtZone;
  x0: number;
  x1: number;
  yBottom: number;
  yTop: number;
}

/**
 * Body silhouettes measured from each sprite's opaque pixels (8th–92nd percentile per band),
 * then trimmed so weapons, wings and capes don't count as body. Tweak these to taste: the
 * ?hitboxes overlay shows the result live.
 *   head  = [x0, x1, top of head]      (bottom of head = neck)
 *   torso = [x0, x1, neck]             (bottom of torso = waist)
 *   legs  = [x0, x1, waist]            (bottom of legs = feet)
 */
const BODY: Record<HeroId, { head: [number, number, number]; torso: [number, number, number]; legs: [number, number, number] }> = {
  //               head x0,   x1,  top     torso x0,  x1, neck     legs x0,   x1, waist
  marrow:  { head: [-0.02, 0.17, 0.90], torso: [-0.20, 0.24, 0.72], legs: [-0.18, 0.20, 0.38] },
  seraph:  { head: [-0.10, 0.08, 0.92], torso: [-0.16, 0.16, 0.74], legs: [-0.14, 0.14, 0.40] },
  korak:   { head: [-0.08, 0.12, 0.90], torso: [-0.20, 0.16, 0.72], legs: [-0.18, 0.10, 0.42] },
  vorg:    { head: [-0.04, 0.16, 0.90], torso: [-0.20, 0.20, 0.72], legs: [-0.20, 0.18, 0.38] },
  bastion: { head: [-0.14, 0.04, 0.92], torso: [-0.24, 0.22, 0.73], legs: [-0.22, 0.10, 0.37] },
  vexia:   { head: [-0.10, 0.08, 0.92], torso: [-0.18, 0.16, 0.74], legs: [-0.18, 0.18, 0.40] },
  xylar:   { head: [-0.02, 0.16, 0.90], torso: [-0.18, 0.20, 0.73], legs: [-0.20, 0.20, 0.39] },
  caldris: { head: [-0.08, 0.12, 0.92], torso: [-0.20, 0.18, 0.73], legs: [-0.20, 0.08, 0.43] },
  vespra:  { head: [-0.12, 0.06, 0.91], torso: [-0.20, 0.20, 0.73], legs: [-0.20, 0.16, 0.39] },
  vale:    { head: [-0.14, 0.02, 0.92], torso: [-0.20, 0.20, 0.74], legs: [-0.22, 0.12, 0.40] },
};

const UNIT_BOXES: Record<HeroId, UnitBox[]> = Object.fromEntries(
  (Object.keys(BODY) as HeroId[]).map((id) => {
    const b = BODY[id];
    return [
      id,
      [
        { zone: 'head', x0: b.head[0], x1: b.head[1], yBottom: b.torso[2], yTop: b.head[2] },
        { zone: 'torso', x0: b.torso[0], x1: b.torso[1], yBottom: b.legs[2], yTop: b.torso[2] },
        { zone: 'legs', x0: b.legs[0], x1: b.legs[1], yBottom: 0, yTop: b.legs[2] },
      ],
    ];
  })
) as Record<HeroId, UnitBox[]>;

/** World-space hurtbox. */
export interface Hurtbox {
  zone: HurtZone;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

type HurtboxHero = Pick<HeroEntity, 'heroId' | 'x' | 'y' | 'h' | 'facing'>;

/** Current world-space hurtboxes for a hero (head, torso, legs). */
export function getHurtboxes(hero: HurtboxHero): Hurtbox[] {
  const H = HERO_SPRITE_HEIGHT[hero.heroId] ?? 88;
  // Renderer draws the sprite standing on y + h/2 + 2 (see drawHero)
  const feetY = hero.y + hero.h / 2 + 2 - (HOVER_LIFT[hero.heroId] ?? 0);
  const f = hero.facing >= 0 ? 1 : -1;
  return (UNIT_BOXES[hero.heroId] ?? UNIT_BOXES.marrow).map((b) => {
    const xa = hero.x + b.x0 * H * f;
    const xb = hero.x + b.x1 * H * f;
    return {
      zone: b.zone,
      left: Math.min(xa, xb),
      right: Math.max(xa, xb),
      top: feetY - b.yTop * H,
      bottom: feetY - b.yBottom * H,
    };
  });
}

/**
 * Swept circle vs axis-aligned box: does a circle of radius r moving from (ax, ay) to (bx, by)
 * touch the box? Returns the travel fraction t (0..1) of first contact, or null.
 * (Box expanded by r, then a slab test on the segment — exact for edges, slightly generous at corners.)
 */
export function sweepCircleBox(ax: number, ay: number, bx: number, by: number, r: number, box: Hurtbox): number | null {
  const left = box.left - r;
  const right = box.right + r;
  const top = box.top - r;
  const bottom = box.bottom + r;
  const dx = bx - ax;
  const dy = by - ay;
  let tMin = 0;
  let tMax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (ax < left || ax > right) return null;
  } else {
    let t1 = (left - ax) / dx;
    let t2 = (right - ax) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }
  if (Math.abs(dy) < 1e-9) {
    if (ay < top || ay > bottom) return null;
  } else {
    let t1 = (top - ay) / dy;
    let t2 = (bottom - ay) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }
  return tMin;
}

export interface HeroHit {
  t: number;
  zone: HurtZone;
  /** contact point (centre of the attack at first touch) — use for hit sparks */
  x: number;
  y: number;
}

/** First contact of a swept attack against a hero's hurtboxes, or null if it misses. */
export function sweepHero(hero: HurtboxHero, ax: number, ay: number, bx: number, by: number, r: number): HeroHit | null {
  let best: HeroHit | null = null;
  for (const box of getHurtboxes(hero)) {
    const t = sweepCircleBox(ax, ay, bx, by, r, box);
    if (t !== null && (!best || t < best.t)) {
      best = { t, zone: box.zone, x: ax + (bx - ax) * t, y: ay + (by - ay) * t };
    }
  }
  return best;
}
