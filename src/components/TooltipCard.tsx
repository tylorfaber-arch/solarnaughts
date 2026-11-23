import type { AbilityTooltipData, UpgradeTooltipData } from '../game/tooltips';
import { ASPECT_META } from '../game/tooltips';
import { SolarCrystalIcon } from './AbilityIcon';

const HIGHLIGHT_CLASS: Record<string, string> = {
  gold: 'text-amber-300',
  emerald: 'text-emerald-300',
  sky: 'text-sky-300',
  rose: 'text-rose-300',
  neutral: 'text-slate-100',
};

export function AbilityTooltipCard({
  data,
  mode = 'hud',
}: {
  data: AbilityTooltipData;
  mode?: 'hud' | 'select';
}) {
  return (
    <div className="pointer-events-none w-[290px] sm:w-[310px] rounded-xl bg-[#070A14]/98 border border-amber-400/55 shadow-2xl shadow-black/80 p-3.5 text-left">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-800/90">
        <div className="min-w-0">
          <div className="font-display text-sm font-extrabold text-white leading-tight">
            {data.name}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
            <span className="font-mono-num font-semibold" style={{ color: data.aspectColor }}>
              {data.keyLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num text-slate-300">{data.cooldownText}</span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-slate-200/95 leading-snug mt-2">{data.description}</p>

      {/* Live Computed Stat Grid */}
      {data.stats.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-slate-800/90 grid grid-cols-2 gap-x-3 gap-y-1">
          {data.stats.map((st) => (
            <div key={st.label} className="flex items-baseline justify-between gap-1 text-[11px]">
              <span className="text-slate-400 truncate">{st.label}</span>
              <span
                className={`font-mono-num font-bold shrink-0 ${
                  HIGHLIGHT_CLASS[st.highlight ?? 'neutral']
                }`}
              >
                {st.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Forged Upgrades (In-Game HUD) or Available Talent Paths (Title Screen) */}
      {mode === 'hud' && data.forgedUpgrades.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-slate-800/90 flex flex-col gap-1">
          <div className="text-[10px] font-semibold text-amber-300/90">
            Forged Talents Active
          </div>
          {data.forgedUpgrades.map((u) => {
            const asp = ASPECT_META[u.aspect];
            return (
              <div key={u.name} className="flex items-baseline justify-between gap-2 text-[11px]">
                <span className="font-semibold truncate" style={{ color: asp.color }}>
                  ★ {u.name}
                </span>
                <span className="font-mono-num text-slate-300 shrink-0">{u.perRankText}</span>
              </div>
            );
          })}
        </div>
      )}

      {mode === 'select' && data.availableUpgrades.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-slate-800/90 flex flex-col gap-1">
          <div className="text-[10px] font-semibold text-slate-400">
            Forgeable Talent Nodes
          </div>
          {data.availableUpgrades.map((u) => {
            const asp = ASPECT_META[u.aspect];
            return (
              <div key={u.name} className="flex items-baseline justify-between gap-2 text-[11px]">
                <span className="font-semibold truncate" style={{ color: asp.color }}>
                  {u.name}
                </span>
                <span className="font-mono-num text-slate-300 shrink-0">{u.perRankText}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function UpgradeTooltipCard({ data }: { data: UpgradeTooltipData }) {
  const asp = ASPECT_META[data.node.aspect];

  return (
    <div
      className={`pointer-events-none w-[295px] sm:w-[320px] rounded-xl bg-[#070A14]/98 border ${asp.border} shadow-2xl shadow-black/85 p-3.5 text-left`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-800/90">
        <div className="min-w-0">
          <div className="font-display text-sm font-extrabold text-white leading-tight">
            {data.node.name}
          </div>
          <div className="text-[11px] mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold" style={{ color: asp.color }}>
              {asp.label}
            </span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="text-slate-200 font-semibold">{data.node.archetype}</span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="font-mono-num text-slate-300">
              {data.maxed ? 'Forged' : data.isOverclock ? 'Overclock' : 'Single Forge'}
            </span>
          </div>
        </div>

        <div className="shrink-0 text-right">
          {data.maxed ? (
            <span className="text-[11px] font-bold text-emerald-300">
              Active
            </span>
          ) : data.rowLocked ? (
            <span className="text-[11px] font-semibold text-slate-500">
              Row Locked
            </span>
          ) : (
            <span
              className={`flex items-center gap-1 font-mono-num text-xs font-bold ${
                data.canAfford ? 'text-amber-300' : 'text-rose-400'
              }`}
            >
              <SolarCrystalIcon className="w-3.5 h-3.5" />
              {data.cost}
            </span>
          )}
        </div>
      </div>

      {/* Lore & Mechanics Summary */}
      <p className="text-xs text-slate-200 leading-snug mt-2">{data.node.summary}</p>
      <div className="mt-1.5 text-[11px] font-mono-num font-semibold" style={{ color: asp.color }}>
        Stat Boost: {data.node.perRankText}
      </div>

      {/* Immediate Capstone Showcase */}
      <div
        className={`mt-2.5 rounded-lg p-2 border ${
          data.maxed
            ? 'bg-emerald-950/35 border-emerald-400/55'
            : 'bg-amber-950/20 border-amber-400/35'
        }`}
      >
        <div
          className={`text-[10.5px] font-bold tracking-wide ${
            data.maxed ? 'text-emerald-300' : 'text-amber-300'
          }`}
        >
          {data.maxed ? '★ Capstone Active' : '★ Instant Capstone Effect'}
        </div>
        <p className="text-[11px] text-slate-100 leading-snug mt-0.5">
          {data.node.capstoneText}
        </p>
      </div>

      {/* Live Forge Delta Preview */}
      {!data.maxed && data.deltas.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-slate-800/90 flex flex-col gap-1">
          <div className="text-[10px] font-semibold text-amber-300/90">
            Immediate Stat Upgrade
          </div>
          {data.deltas.map((d) => (
            <div key={d.label} className="flex items-baseline justify-between gap-2 text-[11px]">
              <span className="text-slate-400">{d.label}</span>
              <span className="font-mono-num">
                <span className="text-slate-400">{d.before}</span>
                <span className="text-slate-500 mx-1">→</span>
                <span className="font-bold text-emerald-300">{d.after}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Action Hint */}
      <div className="mt-2 pt-2 border-t border-slate-800/80 text-[10.5px] text-slate-400">
        {data.maxed
          ? 'Specialization forged and active in combat.'
          : data.rowLocked
            ? 'Row already specialized. Forge all 4 rows to unlock Overclock picks (800 Relic).'
            : data.canAfford
              ? `Click to forge immediately for ${data.cost} Relic Essence.`
              : `Need ${data.cost} Relic Essence to forge.`}
      </div>
    </div>
  );
}

export function SimpleTooltipCard({
  title,
  lines,
}: {
  title: string;
  lines: Array<{ label: string; value?: string; accent?: 'gold' | 'emerald' | 'sky' }>;
}) {
  return (
    <div className="pointer-events-none w-[235px] rounded-xl bg-[#070A14]/98 border border-slate-600/80 shadow-2xl shadow-black/85 p-3 text-left">
      <div className="font-display text-xs font-extrabold text-white pb-1.5 border-b border-slate-800/90">
        {title}
      </div>
      <div className="mt-1.5 flex flex-col gap-1">
        {lines.map((ln, idx) => (
          <div key={idx} className="flex items-baseline justify-between gap-2 text-[11px]">
            <span className="text-slate-300 leading-snug">{ln.label}</span>
            {ln.value && (
              <span
                className={`font-mono-num font-bold shrink-0 ${
                  ln.accent === 'gold'
                    ? 'text-amber-300'
                    : ln.accent === 'emerald'
                      ? 'text-emerald-300'
                      : ln.accent === 'sky'
                        ? 'text-sky-300'
                        : 'text-white'
                }`}
              >
                {ln.value}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
