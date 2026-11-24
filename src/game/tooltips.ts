import { canForgeTalent, computeHeroStats, HERO_MAP } from './heroes';
import type { ComputedHeroStats, HeroId, SkillRowKey, TalentAspect, UpgradeNode } from './types';

export interface TooltipStatLine {
  label: string;
  value: string;
  highlight?: 'gold' | 'emerald' | 'sky' | 'rose' | 'neutral';
}

export interface AbilityTooltipData {
  name: string;
  keyLabel: string;
  cooldownText: string;
  description: string;
  aspectColor: string;
  disciplineTag: string;
  stats: TooltipStatLine[];
  forgedUpgrades: Array<{
    name: string;
    rank: number;
    maxRank: number;
    perRankText: string;
    aspect: TalentAspect;
  }>;
  availableUpgrades: Array<{
    name: string;
    perRankText: string;
    aspect: TalentAspect;
    cost: number;
  }>;
}

export interface UpgradeTooltipData {
  node: UpgradeNode;
  rank: number;
  maxRank: number;
  maxed: boolean;
  canAfford: boolean;
  rowLocked: boolean;
  isOverclock: boolean;
  cost: number;
  deltas: Array<{ label: string; before: string; after: string }>;
  totalEffectSummary: string;
}

export const ASPECT_META: Record<
  TalentAspect,
  { label: string; color: string; border: string; bg: string }
> = {
  sacred: {
    label: 'Sacred',
    color: '#FBBF24',
    border: 'border-amber-400/70',
    bg: 'bg-amber-950/30',
  },
  primordial: {
    label: 'Primordial',
    color: '#34D399',
    border: 'border-emerald-400/70',
    bg: 'bg-emerald-950/30',
  },
  cyber: {
    label: 'Xeno-Tech',
    color: '#38BDF8',
    border: 'border-sky-400/70',
    bg: 'bg-sky-950/30',
  },
};

export function buildAbilityTooltip(
  heroId: HeroId,
  slot: 'primary' | 'skill1' | 'skill2',
  stats: ComputedHeroStats,
  upgrades: Record<string, number>
): AbilityTooltipData {
  const def = HERO_MAP[heroId];
  const meta = slot === 'primary' ? def.primary : slot === 'skill1' ? def.skill1 : def.skill2;
  const rowNodes = def.upgrades.filter((u) => u.row === slot);

  const lines: TooltipStatLine[] = [];
  let cd = meta.cooldown;

  if (slot === 'primary') {
    cd = stats.primaryCooldown;
    lines.push({
      label: 'Damage',
      value: `${Math.round(stats.primaryDamage)}`,
      highlight: 'gold',
    });
    lines.push({
      label: 'Attack Speed',
      value: `${(1 / Math.max(0.05, stats.primaryCooldown)).toFixed(2)} / sec`,
      highlight: 'neutral',
    });
    lines.push({
      label: 'Range',
      value: `${Math.round(stats.primaryRange)} px`,
      highlight: 'sky',
    });
    if (stats.primaryDotDps > 0) {
      lines.push({
        label: heroId === 'vespra' ? 'Venom DoT / Stack' : 'Solar Burn DoT',
        value: `${stats.primaryDotDps.toFixed(1)}/s × ${stats.primaryDotDuration.toFixed(1)}s`,
        highlight: heroId === 'vespra' ? 'emerald' : 'gold',
      });
      if (heroId === 'vespra') {
        lines.push({
          label: 'Max 5× Stacks',
          value: `${Math.round(stats.primaryDotDps * 5)} DPS`,
          highlight: 'rose',
        });
      }
    }
    if (stats.primaryHeal > 0) {
      lines.push({
        label: 'Ally Heal',
        value: `+${Math.round(stats.primaryHeal)} HP`,
        highlight: 'emerald',
      });
    }
    if (stats.primaryHealSolar > 0) {
      lines.push({
        label: 'Heal Relic Bonus',
        value: `+${Math.round(stats.primaryHealSolar)} Relic`,
        highlight: 'gold',
      });
    }
    if (stats.primarySplash > 0) {
      lines.push({
        label: 'Splash Radius',
        value: `${Math.round(stats.primarySplash)} px`,
        highlight: 'rose',
      });
    }
    if (stats.primaryPierce) {
      lines.push({ label: 'Trait', value: 'Pierces Targets', highlight: 'sky' });
    }
    if (stats.primaryBonusRocket) {
      lines.push({ label: '4th Bolt', value: 'Homing Sacred Missile', highlight: 'gold' });
    }
    if (stats.lifestealRatio > 0 && heroId !== 'caldris') {
      lines.push({
        label: 'Lifesteal',
        value: `${Math.round(stats.lifestealRatio * 100)}%`,
        highlight: 'emerald',
      });
    }
    if ((heroId === 'bastion' || heroId === 'caldris') && stats.skill1Slow > 0) {
      lines.push({
        label: 'On-Hit Slow',
        value: `${stats.skill1Slow.toFixed(2)}s`,
        highlight: 'sky',
      });
    }
  } else if (slot === 'skill1') {
    cd = stats.skill1Cooldown;
    if (heroId === 'marrow') {
      lines.push({ label: 'Hook Damage', value: `${Math.round(stats.skill1Damage)}`, highlight: 'gold' });
      lines.push({ label: 'Chain Range', value: `${Math.round(stats.skill1Range)} px`, highlight: 'sky' });
      lines.push({ label: 'Pull Stun', value: `${stats.skill1Stun.toFixed(2)}s`, highlight: 'rose' });
      lines.push({ label: 'Geometry', value: 'Pierces Platforms', highlight: 'emerald' });
    } else if (heroId === 'seraph') {
      lines.push({ label: 'Spear Damage', value: `${Math.round(stats.skill1Damage)}`, highlight: 'gold' });
      lines.push({ label: 'Blast Radius', value: `${Math.round(stats.skill1Radius)} px`, highlight: 'sky' });
      lines.push({ label: 'Stun', value: `${stats.skill1Stun.toFixed(2)}s`, highlight: 'rose' });
      if (stats.skill1ExtraCount > 0) {
        lines.push({ label: 'Volley Count', value: `${1 + stats.skill1ExtraCount} Spears`, highlight: 'gold' });
      }
    } else if (heroId === 'korak') {
      lines.push({ label: 'Heal / Pulse', value: `+${Math.round(stats.skill1Heal)} HP`, highlight: 'emerald' });
      lines.push({ label: 'Aura Radius', value: `${Math.round(stats.skill1Radius)} px`, highlight: 'sky' });
      lines.push({ label: 'Duration', value: `${stats.skill1Duration.toFixed(1)}s`, highlight: 'neutral' });
      if (stats.skill1Damage > 0) {
        lines.push({ label: 'Hex Pulse Dmg', value: `${Math.round(stats.skill1Damage)}`, highlight: 'rose' });
      }
      lines.push({ label: 'Enemy Slow', value: `${stats.skill1Slow.toFixed(1)}s`, highlight: 'sky' });
    } else if (heroId === 'vorg') {
      lines.push({ label: 'Dash Damage', value: `${Math.round(stats.skill1Damage)}`, highlight: 'gold' });
      lines.push({ label: 'Stun', value: `${stats.skill1Stun.toFixed(2)}s`, highlight: 'rose' });
      if (stats.skill1ShieldAfter > 0) {
        lines.push({ label: 'Pact Shield', value: `+${Math.round(stats.skill1ShieldAfter)}`, highlight: 'sky' });
      }
    } else if (heroId === 'bastion') {
      lines.push({ label: 'Clamp Damage', value: `${Math.round(stats.skill1Damage)}`, highlight: 'gold' });
      lines.push({ label: 'Self Heal', value: `+${Math.round(stats.skill1Heal)} HP`, highlight: 'emerald' });
      if (stats.skill1PermanentHpGain > 0) {
        lines.push({
          label: 'On Kill Stack',
          value: `+${Math.round(stats.skill1PermanentHpGain)} Perm Max HP`,
          highlight: 'gold',
        });
      }
    } else if (heroId === 'vexia') {
      lines.push({ label: 'Bomb Damage', value: `${Math.round(stats.skill1Damage)}`, highlight: 'gold' });
      lines.push({ label: 'Blast Radius', value: `${Math.round(stats.skill1Radius)} px`, highlight: 'rose' });
      lines.push({ label: 'Charges', value: `${1 + stats.skill1ExtraCount}`, highlight: 'sky' });
    } else if (heroId === 'xylar') {
      lines.push({ label: 'Crush / Tick', value: `${Math.round(stats.skill1Damage)}`, highlight: 'gold' });
      lines.push({ label: 'Vortex Radius', value: `${Math.round(stats.skill1Radius)} px`, highlight: 'sky' });
      lines.push({ label: 'Duration', value: `${stats.skill1Duration.toFixed(1)}s`, highlight: 'neutral' });
      lines.push({ label: 'Control', value: 'Continuous Pull + Slow', highlight: 'emerald' });
    } else if (heroId === 'caldris') {
      lines.push({ label: 'Orbital Damage', value: `${Math.round(stats.skill1Damage)}`, highlight: 'gold' });
      lines.push({ label: 'Beam Radius', value: `${Math.round(stats.skill1Radius)} px`, highlight: 'sky' });
      lines.push({ label: 'Stun', value: `${stats.skill1Stun.toFixed(2)}s`, highlight: 'rose' });
      if (stats.lifestealRatio > 0) {
        lines.push({
          label: 'Soul Drain',
          value: `${Math.round(stats.lifestealRatio * 100)}% Heal`,
          highlight: 'emerald',
        });
      }
    } else if (heroId === 'vespra') {
      lines.push({ label: 'Cloud / Pulse', value: `${Math.round(stats.skill1Damage)} + Venom`, highlight: 'emerald' });
      lines.push({ label: 'Cloud Radius', value: `${Math.round(stats.skill1Radius)} px`, highlight: 'sky' });
      lines.push({ label: 'Duration', value: `${stats.skill1Duration.toFixed(1)}s`, highlight: 'neutral' });
      lines.push({ label: 'Enemy Slow', value: `${stats.skill1Slow.toFixed(1)}s`, highlight: 'sky' });
      if (stats.skill1Heal > 0) {
        lines.push({ label: 'Ally Heal/Pulse', value: `+${Math.round(stats.skill1Heal)} HP`, highlight: 'emerald' });
      }
    } else if (heroId === 'vale') {
      lines.push({ label: 'Scorch / Pulse', value: `${Math.round(stats.skill1Damage)} + Burn`, highlight: 'gold' });
      lines.push({ label: 'Flare Radius', value: `${Math.round(stats.skill1Radius)} px`, highlight: 'sky' });
      lines.push({ label: 'Duration', value: `${stats.skill1Duration.toFixed(1)}s`, highlight: 'neutral' });
      lines.push({ label: 'Siege Effect', value: 'Burns Towers & Cores', highlight: 'rose' });
    }
  } else {
    cd = stats.skill2Cooldown;
    if (heroId === 'marrow') {
      lines.push({ label: 'Rot / Tick', value: `${Math.round(stats.skill2Damage)}`, highlight: 'emerald' });
      lines.push({ label: 'Cloud Radius', value: `${Math.round(stats.skill2Radius)} px`, highlight: 'sky' });
      lines.push({ label: 'Duration', value: `${stats.skill2Duration.toFixed(1)}s`, highlight: 'neutral' });
      lines.push({ label: 'Bonus Armor', value: `${Math.round(stats.skill2Armor * 100)}%`, highlight: 'gold' });
      if (stats.skill2ExplodeOnEnd) {
        lines.push({ label: 'Plague Vent', value: 'Explodes on End', highlight: 'rose' });
      }
    } else if (heroId === 'seraph') {
      lines.push({ label: 'Shockwave Dmg', value: `${Math.round(stats.skill2Damage)}`, highlight: 'gold' });
      lines.push({ label: 'Aegis Shield', value: `+${Math.round(stats.skill2SummonHp)}`, highlight: 'sky' });
      lines.push({ label: 'Ally Heal', value: `+${Math.round(stats.skill2HealAlly)} HP`, highlight: 'emerald' });
      lines.push({ label: 'Radius', value: `${Math.round(stats.skill2Radius)} px`, highlight: 'neutral' });
    } else if (heroId === 'korak') {
      lines.push({ label: 'Skull Damage', value: `${Math.round(stats.skill2Damage)}`, highlight: 'gold' });
      lines.push({ label: 'Max Skulls', value: '3 (Recast Launches All)', highlight: 'emerald' });
      if (stats.skill2SummonHp > 0) {
        lines.push({ label: 'Cast Shield', value: `+${Math.round(stats.skill2SummonHp)}`, highlight: 'sky' });
      }
    } else if (heroId === 'vorg') {
      lines.push({ label: 'Vortex / Tick', value: `${Math.round(stats.skill2Damage)}`, highlight: 'gold' });
      lines.push({ label: 'Radius', value: `${Math.round(stats.skill2Radius)} px`, highlight: 'sky' });
      lines.push({ label: 'Duration', value: `${stats.skill2Duration.toFixed(1)}s`, highlight: 'neutral' });
      lines.push({ label: 'Bonus Armor', value: `${Math.round(stats.skill2Armor * 100)}%`, highlight: 'emerald' });
    } else if (heroId === 'bastion') {
      lines.push({ label: 'Nova Damage', value: `${Math.round(stats.skill2Damage)}`, highlight: 'rose' });
      lines.push({ label: 'Blast Radius', value: `${Math.round(stats.skill2Radius)} px`, highlight: 'gold' });
      lines.push({ label: 'Channel Time', value: `${stats.skill2Duration.toFixed(1)}s`, highlight: 'neutral' });
      lines.push({ label: 'Channel Armor', value: `${Math.round(stats.skill2Armor * 100)}%`, highlight: 'sky' });
    } else if (heroId === 'vexia') {
      lines.push({ label: 'Ram HP', value: `${Math.round(stats.skill2SummonHp)}`, highlight: 'sky' });
      lines.push({ label: 'Ram Damage', value: `${Math.round(stats.skill2Damage)}`, highlight: 'gold' });
      lines.push({
        label: 'End Effect',
        value: stats.skill2ExplodeOnEnd ? 'Holy Nova Detonation' : 'Heavy Lane Knockback',
        highlight: 'rose',
      });
    } else if (heroId === 'xylar') {
      lines.push({ label: 'Ambush Crit', value: `+${Math.round(stats.skill2Damage)} Bonus Dmg`, highlight: 'gold' });
      lines.push({ label: 'Stealth Dur', value: `${stats.skill2Duration.toFixed(1)}s`, highlight: 'sky' });
      lines.push({
        label: 'Move Boost',
        value: `+${Math.round((stats.skill2SpeedMult - 1) * 100)}%`,
        highlight: 'emerald',
      });
      if (stats.skill2SummonHp > 0) {
        lines.push({ label: 'Phase Shield', value: `+${Math.round(stats.skill2SummonHp)}`, highlight: 'sky' });
      }
    } else if (heroId === 'caldris') {
      lines.push({
        label: 'Summoned',
        value: `${2 + stats.skill1ExtraCount} Bone-Borgs`,
        highlight: 'emerald',
      });
      lines.push({ label: 'Bone-Borg HP', value: `${Math.round(stats.skill2SummonHp)}`, highlight: 'sky' });
      lines.push({ label: 'Borg Damage', value: `${Math.round(stats.skill2Damage)} / shot`, highlight: 'gold' });
      lines.push({ label: 'Self Shield', value: `+${Math.round(stats.skill2HealAlly)}`, highlight: 'sky' });
    } else if (heroId === 'vespra') {
      lines.push({ label: 'Burst / Stack', value: `${Math.round(stats.skill2Damage)} (max ${Math.round(stats.skill2Damage * 5)})`, highlight: 'rose' });
      lines.push({ label: 'Pulse Radius', value: `${Math.round(stats.skill2Radius)} px`, highlight: 'sky' });
      lines.push({ label: 'Heal / Stack', value: `+${Math.round(stats.skill2HealAlly)} HP`, highlight: 'emerald' });
      lines.push({ label: 'Contagion', value: 'Spreads Venom to Nearby Foes', highlight: 'gold' });
    } else if (heroId === 'vale') {
      lines.push({ label: 'Afterimage Dmg', value: `${Math.round(stats.skill2Damage)}`, highlight: 'gold' });
      lines.push({ label: 'Chrono Haste', value: `${stats.skill2Duration.toFixed(1)}s (+40% Fire)`, highlight: 'sky' });
      lines.push({ label: 'Blink Shield', value: `+${Math.round(stats.skill2SummonHp)}`, highlight: 'emerald' });
      lines.push({ label: 'Teleport', value: 'Instant Cursor Blink', highlight: 'neutral' });
    }
  }

  const forgedUpgrades = rowNodes
    .filter((u) => (upgrades[u.id] ?? 0) > 0)
    .map((u) => ({
      name: u.name,
      rank: upgrades[u.id] ?? 0,
      maxRank: u.maxRank,
      perRankText: u.perRankText,
      aspect: u.aspect,
    }));

  const availableUpgrades = rowNodes.map((u) => ({
    name: u.name,
    perRankText: u.perRankText,
    aspect: u.aspect,
    cost: u.cost,
  }));

  return {
    name: meta.name,
    keyLabel: meta.keyLabel,
    cooldownText: `${cd.toFixed(2).replace(/\.00$/, '')}s CD`,
    description: meta.description,
    aspectColor: def.accentColor,
    disciplineTag: def.disciplineLabel,
    stats: lines,
    forgedUpgrades,
    availableUpgrades,
  };
}

export function buildUpgradeTooltip(
  heroId: HeroId,
  node: UpgradeNode,
  upgrades: Record<string, number>,
  solar: number,
  bonusMaxHp = 0
): UpgradeTooltipData {
  const rank = upgrades[node.id] ?? 0;
  const maxed = rank >= node.maxRank;
  const checkForge = canForgeTalent(upgrades, heroId, node, solar);
  const canAfford = checkForge.allowed;
  const rowLocked = checkForge.reason === 'row_locked';

  const before = computeHeroStats(heroId, upgrades, bonusMaxHp);
  const nextRanks = maxed ? upgrades : { ...upgrades, [node.id]: 1 };
  const after = computeHeroStats(heroId, nextRanks, bonusMaxHp);

  const deltas: Array<{ label: string; before: string; after: string }> = [];
  const check = (
    label: string,
    a: number,
    b: number,
    fmt: (v: number) => string = (v) => `${Math.round(v)}`
  ) => {
    if (Math.abs(a - b) > 0.001) {
      deltas.push({ label, before: fmt(a), after: fmt(b) });
    }
  };

  check('Max Health', before.maxHp, after.maxHp, (v) => `${Math.round(v)} HP`);
  check('Move Speed', before.moveSpeed, after.moveSpeed, (v) => `${Math.round(v)}`);
  check('Jump Force', before.jumpForce, after.jumpForce, (v) => `${Math.round(v)}`);
  check('Primary Damage', before.primaryDamage, after.primaryDamage);
  check('DoT DPS', before.primaryDotDps, after.primaryDotDps, (v) => `${v.toFixed(1)}/s`);
  check('DoT Duration', before.primaryDotDuration, after.primaryDotDuration, (v) => `${v.toFixed(1)}s`);
  check(
    'Attack Rate',
    1 / Math.max(0.05, before.primaryCooldown),
    1 / Math.max(0.05, after.primaryCooldown),
    (v) => `${v.toFixed(2)}/s`
  );
  check('Primary Range', before.primaryRange, after.primaryRange, (v) => `${Math.round(v)} px`);
  check('Primary Splash', before.primarySplash, after.primarySplash, (v) => `${Math.round(v)} px`);
  check('Ally Heal', before.primaryHeal, after.primaryHeal, (v) => `+${Math.round(v)} HP`);
  check('Heal Relic', before.primaryHealSolar, after.primaryHealSolar, (v) => `+${Math.round(v)}`);
  check('Lifesteal', before.lifestealRatio * 100, after.lifestealRatio * 100, (v) => `${Math.round(v)}%`);

  check('Skill 1 Damage', before.skill1Damage, after.skill1Damage);
  check('Skill 1 Cooldown', before.skill1Cooldown, after.skill1Cooldown, (v) => `${v.toFixed(1)}s`);
  check('Skill 1 Radius', before.skill1Radius, after.skill1Radius, (v) => `${Math.round(v)} px`);
  check('Skill 1 Range', before.skill1Range, after.skill1Range, (v) => `${Math.round(v)} px`);
  check('Skill 1 Stun', before.skill1Stun, after.skill1Stun, (v) => `${v.toFixed(2)}s`);
  check('Slow Duration', before.skill1Slow, after.skill1Slow, (v) => `${v.toFixed(2)}s`);
  check('Skill 1 Heal', before.skill1Heal, after.skill1Heal, (v) => `+${Math.round(v)} HP`);
  check('Post-Skill Shield', before.skill1ShieldAfter, after.skill1ShieldAfter, (v) => `+${Math.round(v)}`);
  check('Skill 1 Duration', before.skill1Duration, after.skill1Duration, (v) => `${v.toFixed(1)}s`);
  check('Perm HP / Kill', before.skill1PermanentHpGain, after.skill1PermanentHpGain, (v) => `+${Math.round(v)}`);
  check('Extra Volley/Unit', before.skill1ExtraCount, after.skill1ExtraCount, (v) => `+${Math.round(v)}`);

  check('Skill 2 Power', before.skill2Damage, after.skill2Damage);
  check('Skill 2 Cooldown', before.skill2Cooldown, after.skill2Cooldown, (v) => `${v.toFixed(1)}s`);
  check('Skill 2 Radius', before.skill2Radius, after.skill2Radius, (v) => `${Math.round(v)} px`);
  check('Skill 2 Duration', before.skill2Duration, after.skill2Duration, (v) => `${v.toFixed(1)}s`);
  check('Skill 2 Armor', before.skill2Armor * 100, after.skill2Armor * 100, (v) => `${Math.round(v)}%`);
  check(
    'Skill 2 Speed',
    before.skill2SpeedMult * 100,
    after.skill2SpeedMult * 100,
    (v) => `${Math.round(v)}%`
  );
  check('Summon / Shield', before.skill2SummonHp, after.skill2SummonHp, (v) => `${Math.round(v)}`);
  check('Ally Heal / Ward', before.skill2HealAlly, after.skill2HealAlly, (v) => `+${Math.round(v)}`);

  check('Relic Flow', before.passiveSolarPerSec, after.passiveSolarPerSec, (v) => `+${v.toFixed(1)}/s`);
  check('HP Regen', before.hpRegenPerSec, after.hpRegenPerSec, (v) => `+${v.toFixed(1)}/s`);

  if (!before.primaryPierce && after.primaryPierce) {
    deltas.push({ label: 'Piercing', before: 'Off', after: 'Pierces Waves' });
  }
  if (!before.primaryBonusRocket && after.primaryBonusRocket) {
    deltas.push({ label: '4th Bolt', before: 'Standard', after: 'Homing Missile' });
  }
  if (!before.skill2ExplodeOnEnd && after.skill2ExplodeOnEnd) {
    deltas.push({ label: 'Finale Burst', before: 'Off', after: 'Nova Detonation' });
  }

  const totalEffectSummary = maxed
    ? `Active Specialization · ${node.perRankText}`
    : rowLocked
      ? 'Row already specialized — forge all 4 rows to unlock Overclock.'
      : `Single Forge (${checkForge.cost} Relic) · Instant Capstone + Stat Boost`;

  return {
    node,
    rank,
    maxRank: node.maxRank,
    maxed,
    canAfford,
    rowLocked,
    isOverclock: checkForge.isOverclock,
    cost: checkForge.cost,
    deltas,
    totalEffectSummary,
  };
}

export function getRowAbilitySlot(row: SkillRowKey): 'primary' | 'skill1' | 'skill2' | null {
  if (row === 'primary' || row === 'skill1' || row === 'skill2') return row;
  return null;
}
