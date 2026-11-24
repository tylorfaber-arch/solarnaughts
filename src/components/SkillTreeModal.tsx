import { useState } from 'react';
import { Lock, X } from 'lucide-react';
import {
  ASCENSION_INFUSIONS,
  canForgeAscension,
  canForgeTalent,
  getAscensionTotalStacks,
  getForgedRowStatus,
  getTalentForgeCost,
  HERO_MAP,
} from '../game/heroes';
import {
  buildAbilityTooltip,
  buildUpgradeTooltip,
  getRowAbilitySlot,
} from '../game/tooltips';
import type { HudSnapshot, SkillRowKey, TalentAspect, UpgradeNode } from '../game/types';
import { AbilitySvgIcon, RelicCorners, SolarCrystalIcon, UpgradeSvgIcon } from './AbilityIcon';
import { AbilityTooltipCard, UpgradeTooltipCard } from './TooltipCard';

interface SkillTreeModalProps {
  hud: HudSnapshot;
  onBuyUpgrade: (upgradeId: string) => void;
  onClose: () => void;
}

const ROW_ORDER: Array<{ key: SkillRowKey; subtitle: string }> = [
  { key: 'primary', subtitle: 'Primary · LMB' },
  { key: 'skill1', subtitle: 'Skill 1 · Q / RMB' },
  { key: 'skill2', subtitle: 'Skill 2 · E / Shift' },
  { key: 'utility', subtitle: 'Vessel & Relic Utility' },
];

const ASPECT_STYLE: Record<
  TalentAspect,
  { label: string; color: string; border: string; bgActive: string; dot: string }
> = {
  sacred: {
    label: 'Sacred',
    color: '#FBBF24',
    border: 'border-amber-400/75',
    bgActive: 'bg-amber-950/25',
    dot: 'bg-amber-400',
  },
  primordial: {
    label: 'Primordial',
    color: '#34D399',
    border: 'border-emerald-400/75',
    bgActive: 'bg-emerald-950/25',
    dot: 'bg-emerald-400',
  },
  cyber: {
    label: 'Xeno-Tech',
    color: '#38BDF8',
    border: 'border-sky-400/75',
    bgActive: 'bg-sky-950/25',
    dot: 'bg-sky-400',
  },
};

type HoverTarget =
  | { kind: 'upgrade'; node: UpgradeNode; rect: DOMRect }
  | { kind: 'ability'; slot: 'primary' | 'skill1' | 'skill2'; rect: DOMRect }
  | null;

function computePopoverStyle(rect: DOMRect): { left: number; top: number } {
  const tipW = 324;
  const tipH = 320;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = rect.left + rect.width / 2 - tipW / 2;
  left = Math.max(12, Math.min(vw - tipW - 12, left));

  // Prefer above the element; flip below if too close to top of viewport
  let top = rect.top - tipH - 10;
  if (top < 12) {
    top = Math.min(vh - tipH - 12, rect.bottom + 10);
  }
  return { left, top };
}

export function SkillTreeModal({ hud, onBuyUpgrade, onClose }: SkillTreeModalProps) {
  const [hoverTarget, setHoverTarget] = useState<HoverTarget>(null);
  const heroDef = HERO_MAP[hud.player.heroId];
  const stats = hud.player.stats;

  const getRowTitle = (key: SkillRowKey) => {
    if (key === 'primary') return heroDef.primary.name;
    if (key === 'skill1') return heroDef.skill1.name;
    if (key === 'skill2') return heroDef.skill2.name;
    return heroDef.purity === 'purist' ? 'Purist Mastery' : 'Augmented Vessel';
  };

  const getRowAbilityIcon = (key: SkillRowKey) => {
    if (key === 'primary') return heroDef.primary.icon;
    if (key === 'skill1') return heroDef.skill1.icon;
    if (key === 'skill2') return heroDef.skill2.icon;
    return null;
  };

  const getSkill1Readout = () => {
    if (hud.player.heroId === 'korak') return `${Math.round(stats.skill1Heal)} HP/pulse`;
    if (hud.player.heroId === 'marrow')
      return `${Math.round(stats.skill1Damage)} Dmg · ${Math.round(stats.skill1Range)}px`;
    return `${Math.round(stats.skill1Damage)} Dmg`;
  };

  const popoverPos = hoverTarget ? computePopoverStyle(hoverTarget.rect) : null;

  const { forgedRows, totalForged, overclockUnlocked, allTalentsMaxed } = getForgedRowStatus(
    hud.player.upgrades,
    hud.player.heroId
  );
  const nextForgeCost = getTalentForgeCost(hud.player.upgrades, hud.player.heroId);
  const totalAscStacks = getAscensionTotalStacks(hud.player.upgrades);

  const forgedList = heroDef.upgrades.filter((u) => (hud.player.upgrades[u.id] ?? 0) > 0);
  const activeAscensions = ASCENSION_INFUSIONS.filter((inf) => (hud.player.upgrades[inf.id] ?? 0) > 0);

  const ascensionSection = (
    <div
      className={`rounded-xl border p-4 flex flex-col gap-3 ${
        allTalentsMaxed
          ? 'border-amber-400/70 bg-gradient-to-br from-[#161C2F] via-[#101626] to-[#1A1610]'
          : overclockUnlocked
            ? 'border-amber-500/35 bg-[#0C1220]'
            : 'border-slate-800/80 bg-[#080B14]/80'
      }`}
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <h3 className="font-display text-sm font-bold text-amber-300">
            {allTalentsMaxed
              ? 'Ascension Reliquary · Full Build Reached'
              : 'Ascension Reliquary · Endless Relic Sinks'}
          </h3>
          <span className="text-xs text-slate-400">
            {overclockUnlocked
              ? 'Repeatable permanent infusions with instant combat & siege payoffs'
              : 'Unlocks after forging all 4 Core Rows'}
          </span>
        </div>
        <span className="font-mono-num text-[11px] font-semibold text-amber-300/90 whitespace-nowrap">
          {overclockUnlocked
            ? totalAscStacks > 0
              ? `${totalAscStacks} Infusion${totalAscStacks === 1 ? '' : 's'} Active`
              : 'Ready to Infuse'
            : `${forgedRows.size}/4 Rows Forged`}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {ASCENSION_INFUSIONS.map((inf) => {
          const check = canForgeAscension(
            hud.player.upgrades,
            hud.player.heroId,
            inf,
            hud.player.solar
          );
          const asp = ASPECT_STYLE[inf.aspect];
          const locked = check.reason === 'locked';

          return (
            <button
              key={inf.id}
              type="button"
              onClick={() => {
                if (check.allowed) onBuyUpgrade(inf.id);
              }}
              aria-disabled={!check.allowed}
              className={`text-left p-3 rounded-xl border transition-all flex flex-col justify-between gap-2 ${
                locked
                  ? 'border-slate-800/70 bg-[#070A12] opacity-50 cursor-not-allowed'
                  : check.allowed
                    ? `${asp.border} bg-[#131B2E] hover:bg-[#1B2742] cursor-pointer active:scale-[0.99]`
                    : 'border-slate-800/90 bg-[#0B101C] opacity-85 cursor-default'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-[#080B14] border border-slate-700"
                    style={{ color: asp.color }}
                  >
                    <UpgradeSvgIcon icon={inf.icon} className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="font-display text-xs font-bold text-white leading-tight truncate">
                      {inf.name}
                    </div>
                    <div className="text-[10px] font-semibold" style={{ color: asp.color }}>
                      Endless Stack
                    </div>
                  </div>
                </div>
                {check.stacks > 0 ? (
                  <span className="font-mono-num text-xs font-bold text-amber-300 shrink-0">
                    ×{check.stacks}
                  </span>
                ) : locked ? (
                  <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                ) : null}
              </div>

              <div className="flex flex-col gap-1">
                <p className="text-[11px] font-mono-num text-slate-200 leading-snug">
                  {inf.perStackText}
                </p>
                <p className="text-[10.5px] text-amber-200/90 leading-snug">
                  ★ {inf.instantBonusText}
                </p>
              </div>

              <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80 text-[11px]">
                <span className="text-slate-400">
                  {locked ? 'Forge 4 Rows' : 'Infuse Now'}
                </span>
                <span
                  className={`flex items-center gap-1 font-mono-num font-bold ${
                    check.allowed ? 'text-amber-300' : 'text-slate-500'
                  }`}
                >
                  <SolarCrystalIcon className="w-3.5 h-3.5" />
                  {check.cost}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#04060D]/82 p-4"
      onClick={onClose}
    >
      <div
        className="relative relic-panel w-full max-w-[1120px] max-h-[90vh] overflow-y-auto rounded-2xl border border-amber-500/35 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onScroll={() => setHoverTarget(null)}
      >
        <RelicCorners />
        {/* Obsidian & Gold Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-800/90 bg-gradient-to-r from-[#0E1322] via-[#0B101D] to-[#0D1626]">
          <div className="flex items-center gap-3.5">
            <img
              src={heroDef.portrait}
              alt={heroDef.name}
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-lg object-cover border border-amber-400/50"
            />
            <div>
              <div className="flex items-baseline gap-2.5 flex-wrap">
                <h2 className="font-display text-xl font-extrabold text-white">
                  {heroDef.name} · Talent Forge
                </h2>
                <span
                  className="text-xs font-semibold"
                  style={{ color: heroDef.purity === 'purist' ? '#FBBF24' : '#38BDF8' }}
                >
                  {heroDef.disciplineLabel}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {allTalentsMaxed ? (
                  <>
                    All 12 Talents forged — spend excess Relic on{' '}
                    <strong className="text-amber-300">Endless Ascension Infusions</strong> · Press{' '}
                    <span className="font-mono-num text-slate-200">B</span> to close
                  </>
                ) : (
                  <>
                    Choose <strong className="text-amber-300">1 high-impact Specialization per row</strong> — every pick activates its ★ Capstone immediately · Next Forge:{' '}
                    <span className="font-mono-num text-amber-300 font-semibold">{nextForgeCost} Relic</span> · Press{' '}
                    <span className="font-mono-num text-slate-200">B</span> to close
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#12192B] border border-amber-400/55">
              <SolarCrystalIcon className="w-4 h-4" />
              <span className="font-mono-num text-base font-bold text-amber-300">
                {hud.player.solar} Relic
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close talent forge"
              className="w-9 h-9 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body: Live Stats Sidebar + 4-Row Talent Lattice */}
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Left Rail */}
          <div className="lg:col-span-3 p-5 border-b lg:border-b-0 lg:border-r border-slate-800 bg-[#080B14] flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-3">
              <div className="text-xs font-semibold text-amber-300/90 tracking-wide">
                Live Combat Parameters
              </div>
              <div className="flex flex-col divide-y divide-slate-800/80 text-xs">
                <div className="py-2 flex justify-between">
                  <span className="text-slate-400">Max Health</span>
                  <span className="font-mono-num font-bold text-emerald-300">
                    {Math.round(stats.maxHp)}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-400">Move Speed</span>
                  <span className="font-mono-num font-bold text-white">
                    {Math.round(stats.moveSpeed)}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-400">Primary Dmg</span>
                  <span className="font-mono-num font-bold text-amber-300">
                    {Math.round(stats.primaryDamage)}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-400">Attack Rate</span>
                  <span className="font-mono-num font-bold text-white">
                    {(1 / Math.max(0.05, stats.primaryCooldown)).toFixed(1)}/s
                  </span>
                </div>
                <div className="py-2 flex justify-between gap-2">
                  <span className="text-slate-400">Skill 1</span>
                  <span className="font-mono-num font-bold text-sky-300 text-right">
                    {getSkill1Readout()}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-400">Skill 2</span>
                  <span className="font-mono-num font-bold text-sky-300">
                    {Math.round(stats.skill2Damage)} Power
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-400">Relic Flow</span>
                  <span className="font-mono-num font-bold text-amber-300">
                    +{stats.passiveSolarPerSec.toFixed(1)}/s
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-400">Relic Forged</span>
                  <span className="font-mono-num font-bold text-slate-200">
                    {hud.player.totalSolarSpent}
                  </span>
                </div>
              </div>
            </div>

            {/* Active Specializations & Overclock Status */}
            <div className="pt-3 border-t border-slate-800/90 flex flex-col gap-2 text-xs">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold text-amber-300/90">
                  {overclockUnlocked ? 'Overclock Unlocked' : 'Core Specializations'}
                </span>
                <span className="font-mono-num text-[11px] text-emerald-300 font-semibold">
                  {overclockUnlocked ? `${totalForged} Forged` : `${forgedRows.size}/4 Rows`}
                </span>
              </div>
              {forgedList.length === 0 ? (
                <div className="text-[11px] text-slate-500 leading-snug">
                  Pick 1 major talent per row (220 → 340 → 480 → 640 Relic). Forging all 4 rows unlocks late-game Overclock.
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {forgedList.map((u) => (
                    <div key={u.id} className="flex items-baseline justify-between gap-2 text-[11px]">
                      <span className="text-slate-100 font-medium truncate">★ {u.name}</span>
                      <span className="text-[10px] text-amber-300/90 shrink-0">{u.archetype}</span>
                    </div>
                  ))}
                  {activeAscensions.map((inf) => (
                    <div key={inf.id} className="flex items-baseline justify-between gap-2 text-[11px]">
                      <span className="text-amber-300 font-semibold truncate">◆ {inf.name}</span>
                      <span className="font-mono-num text-[10px] text-emerald-300 shrink-0">
                        ×{hud.player.upgrades[inf.id]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Aspect Legend */}
            <div className="pt-3 border-t border-slate-800/90 flex flex-col gap-1.5 text-[11px] text-slate-400">
              <div className="font-semibold text-slate-300 mb-0.5">Craft Disciplines</div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Sacred · Angelic & Consecrated</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Primordial · Occult & Spirit</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                <span>Xeno-Tech · Alien Science</span>
              </div>
            </div>
          </div>

          {/* Right Main Lattice: 4 Rows x 3 Nodes + Endless Ascension Reliquary */}
          <div className="lg:col-span-9 p-5 flex flex-col gap-4">
            {allTalentsMaxed && ascensionSection}
            {ROW_ORDER.map((row) => {
              const nodes = heroDef.upgrades.filter((u) => u.row === row.key);
              const abilitySlot = getRowAbilitySlot(row.key);
              const abilityIcon = getRowAbilityIcon(row.key);

              const rowHasChoice = forgedRows.has(row.key);

              return (
                <div key={row.key} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div
                      onMouseEnter={(e) => {
                        if (!abilitySlot) return;
                        setHoverTarget({
                          kind: 'ability',
                          slot: abilitySlot,
                          rect: e.currentTarget.getBoundingClientRect(),
                        });
                      }}
                      onMouseLeave={() =>
                        setHoverTarget((prev) =>
                          prev?.kind === 'ability' && prev.slot === abilitySlot ? null : prev
                        )
                      }
                      className={`inline-flex items-center gap-2 ${
                        abilitySlot ? 'cursor-help group' : ''
                      }`}
                    >
                      {abilityIcon && (
                        <span
                          className="w-6 h-6 rounded-md flex items-center justify-center border border-slate-700 bg-[#121A2C] group-hover:border-amber-400 transition-colors"
                          style={{ color: heroDef.accentColor }}
                        >
                          <AbilitySvgIcon icon={abilityIcon} className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <h3 className="font-display text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                        {getRowTitle(row.key)}
                      </h3>
                      <span className="text-xs text-slate-500">{row.subtitle}</span>
                    </div>

                    <span
                      className={`text-[11px] font-mono-num font-semibold ${
                        overclockUnlocked
                          ? 'text-sky-300'
                          : rowHasChoice
                            ? 'text-emerald-300'
                            : 'text-amber-300/90'
                      }`}
                    >
                      {overclockUnlocked
                        ? 'Overclock Open · 800 Relic'
                        : rowHasChoice
                          ? 'Specialization Chosen'
                          : `Choose 1 of 3 · ${nextForgeCost} Relic`}
                    </span>
                  </div>

                  <div className="relative">
                    {/* Horizontal Golden-Cyan Circuit Conduit Line (illuminates when forged) */}
                    <div
                      className={`hidden sm:block absolute left-8 right-8 top-1/2 -translate-y-1/2 h-[2px] pointer-events-none transition-opacity ${
                        rowHasChoice
                          ? 'bg-gradient-to-r from-amber-400/75 via-sky-400/75 to-emerald-400/75'
                          : 'bg-gradient-to-r from-amber-500/20 via-sky-400/25 to-emerald-400/20'
                      }`}
                    />

                    <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {nodes.map((node) => {
                        const owned = (hud.player.upgrades[node.id] ?? 0) >= node.maxRank;
                        const check = canForgeTalent(
                          hud.player.upgrades,
                          hud.player.heroId,
                          node,
                          hud.player.solar
                        );
                        const rowLocked = check.reason === 'row_locked';
                        const canForge = check.allowed;
                        const asp = ASPECT_STYLE[node.aspect];

                        return (
                          <button
                            key={node.id}
                            type="button"
                            onClick={() => {
                              if (canForge) onBuyUpgrade(node.id);
                            }}
                            onMouseEnter={(e) =>
                              setHoverTarget({
                                kind: 'upgrade',
                                node,
                                rect: e.currentTarget.getBoundingClientRect(),
                              })
                            }
                            onMouseLeave={() =>
                              setHoverTarget((prev) =>
                                prev?.kind === 'upgrade' && prev.node.id === node.id ? null : prev
                              )
                            }
                            aria-disabled={!canForge}
                            className={`text-left p-3 rounded-xl border transition-all flex flex-col justify-between gap-2 ${
                              owned
                                ? `${asp.border} ${asp.bgActive} shadow-md shadow-amber-500/10 cursor-help`
                                : rowLocked
                                  ? 'border-slate-800/70 bg-[#080B14]/85 opacity-45 hover:opacity-75 cursor-help'
                                  : canForge
                                    ? `${asp.border} bg-[#12192A] hover:bg-[#19233B] cursor-pointer active:scale-[0.99]`
                                    : 'border-slate-800/90 bg-[#0B101C] opacity-80 hover:opacity-100 hover:border-slate-600 cursor-help'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-[#080B14] border border-slate-700"
                                  style={{ color: asp.color }}
                                >
                                  <UpgradeSvgIcon icon={node.icon} className="w-4 h-4" />
                                </span>
                                <div className="min-w-0">
                                  <div className="font-display text-xs font-bold text-white leading-tight truncate">
                                    {node.name}
                                  </div>
                                  <div className="text-[10px] font-semibold flex items-center gap-1 truncate">
                                    <span style={{ color: asp.color }}>{asp.label}</span>
                                    <span className="text-slate-600" aria-hidden="true">·</span>
                                    <span className="text-slate-300 truncate">{node.archetype}</span>
                                  </div>
                                </div>
                              </div>

                              {owned ? (
                                <span
                                  className="text-[10px] font-bold shrink-0 pt-0.5"
                                  style={{ color: asp.color }}
                                >
                                  ★ ACTIVE
                                </span>
                              ) : rowLocked ? (
                                <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                              ) : null}
                            </div>

                            <div className="flex flex-col gap-1">
                              <p className="text-[11px] font-mono-num text-slate-200 leading-snug">
                                {node.perRankText}
                              </p>
                              <p
                                className={`text-[10.5px] leading-snug line-clamp-2 ${
                                  owned ? 'text-emerald-300 font-semibold' : 'text-amber-200/85'
                                }`}
                              >
                                ★ {node.capstoneText}
                              </p>
                            </div>

                            <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80 text-[11px]">
                              <span className="text-slate-400">
                                {owned
                                  ? 'Capstone Unlocked'
                                  : rowLocked
                                    ? 'Unlocks at Overclock'
                                    : check.isOverclock
                                      ? 'Overclock Forge'
                                      : 'Instant Capstone'}
                              </span>
                              {owned ? (
                                <span className="font-bold text-emerald-300">Forged</span>
                              ) : rowLocked ? (
                                <span className="font-mono-num text-slate-500">Locked</span>
                              ) : (
                                <span
                                  className={`flex items-center gap-1 font-mono-num font-bold ${
                                    canForge ? 'text-amber-300' : 'text-slate-500'
                                  }`}
                                >
                                  <SolarCrystalIcon className="w-3.5 h-3.5" />
                                  {check.cost}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
            {!allTalentsMaxed && ascensionSection}
          </div>
        </div>
      </div>

      {/* Viewport-Clamped Floating Tooltip (never clipped by modal scroll!) */}
      {hoverTarget && popoverPos && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: `${popoverPos.left}px`, top: `${popoverPos.top}px` }}
        >
          {hoverTarget.kind === 'upgrade' ? (
            <UpgradeTooltipCard
              data={buildUpgradeTooltip(
                hud.player.heroId,
                hoverTarget.node,
                hud.player.upgrades,
                hud.player.solar
              )}
            />
          ) : (
            <AbilityTooltipCard
              mode="hud"
              data={buildAbilityTooltip(
                hud.player.heroId,
                hoverTarget.slot,
                hud.player.stats,
                hud.player.upgrades
              )}
            />
          )}
        </div>
      )}
    </div>
  );
}
