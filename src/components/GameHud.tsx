import { useState } from 'react';
import { Volume2, VolumeX, Pause, Copy, Check } from 'lucide-react';
import { HERO_MAP } from '../game/heroes';
import {
  ASPECT_META,
  buildAbilityTooltip,
  buildUpgradeTooltip,
} from '../game/tooltips';
import type { HudSnapshot } from '../game/types';
import { AbilitySvgIcon, SolarCrystalIcon, UpgradeSvgIcon } from './AbilityIcon';
import { AbilityTooltipCard, SimpleTooltipCard, UpgradeTooltipCard } from './TooltipCard';

interface GameHudProps {
  hud: HudSnapshot;
  muted: boolean;
  shopOpen: boolean;
  onToggleShop: () => void;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onRecall: () => void;
}

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function GameHud({
  hud,
  muted,
  shopOpen,
  onToggleShop,
  onToggleMute,
  onTogglePause,
  onRecall,
}: GameHudProps) {
  const [copiedRoom, setCopiedRoom] = useState(false);
  const [hoveredAbility, setHoveredAbility] = useState<'primary' | 'skill1' | 'skill2' | null>(null);
  const [hoveredForgedId, setHoveredForgedId] = useState<string | null>(null);
  const [hoveredUtil, setHoveredUtil] = useState<'relic' | 'forge' | 'recall' | null>(null);

  const heroDef = HERO_MAP[hud.player.heroId];
  const hpPct = Math.max(0, Math.min(100, (hud.player.hp / Math.max(1, hud.player.maxHp)) * 100));

  const copyRoomCode = () => {
    if (!hud.network.roomId) return;
    const url = `${window.location.origin}/?room=${encodeURIComponent(hud.network.roomId)}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedRoom(true);
    window.setTimeout(() => setCopiedRoom(false), 1800);
  };

  const abilities = [
    {
      slot: 'primary' as const,
      meta: heroDef.primary,
      cd: hud.player.primaryCd,
      maxCd: hud.player.primaryMaxCd,
      extraLabel: null as string | null,
    },
    {
      slot: 'skill1' as const,
      meta: heroDef.skill1,
      cd: hud.player.skill1Cd,
      maxCd: hud.player.skill1MaxCd,
      extraLabel: null as string | null,
    },
    {
      slot: 'skill2' as const,
      meta: heroDef.skill2,
      cd: hud.player.skill2Cd,
      maxCd: hud.player.skill2MaxCd,
      extraLabel:
        hud.player.heroId === 'korak'
          ? hud.player.droneCount >= 3
            ? 'LAUNCH'
            : `${hud.player.droneCount}/3`
          : null,
    },
  ];

  // Purchased Talent Items for quick HUD inspection
  const forgedNodes = heroDef.upgrades.filter((u) => (hud.player.upgrades[u.id] ?? 0) > 0);
  const hoveredForgedNode = hoveredForgedId
    ? forgedNodes.find((u) => u.id === hoveredForgedId) ?? null
    : null;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-4">
      {/* TOP BAR ROW */}
      <div className="flex items-start justify-between gap-3">
        {/* Top Left: Online Room Info or K/D/A */}
        <div className="pointer-events-auto flex items-center gap-3 px-3 py-1.5 rounded-lg bg-[#0A0E1A]/94 border border-slate-700/80 text-xs">
          {hud.network.mode === 'online' ? (
            <>
              <span
                className={`w-2 h-2 rounded-full ${
                  hud.network.connected ? 'bg-emerald-400' : 'bg-rose-500'
                }`}
                title={hud.network.connected ? 'WebSocket Connected' : 'Disconnected'}
              />
              <button
                type="button"
                onClick={copyRoomCode}
                className="flex items-center gap-1.5 font-mono-num font-bold text-amber-300 hover:text-amber-200 cursor-pointer"
                title="Copy Friend Invite Link"
              >
                <span>{copiedRoom ? 'Invite Copied!' : `Room ${hud.network.roomId ?? '...'}`}</span>
                {copiedRoom ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3 text-slate-400" />
                )}
              </button>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="font-mono-num text-slate-300">{hud.network.humanCount}/6 Live</span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span
                className={`font-mono-num ${
                  hud.network.pingMs <= 50
                    ? 'text-emerald-400'
                    : hud.network.pingMs <= 110
                      ? 'text-amber-300'
                      : 'text-rose-400'
                }`}
              >
                {hud.network.pingMs > 0 ? `${hud.network.pingMs} ms` : '-- ms'}
              </span>
            </>
          ) : (
            <span className="text-slate-300 font-mono-num">
              K/D/A{' '}
              <strong className="text-white">
                {hud.player.kills}/{hud.player.deaths}/{hud.player.assists}
              </strong>
              <span className="text-slate-600 mx-1.5">·</span>
              Creeps <strong className="text-white">{hud.player.droidKills}</strong>
            </span>
          )}
        </div>

        {/* Top Center: Compact Match Strip (4 Towers/Team · Escalating Wave Tier · Clock) */}
        <div className="flex items-center gap-4 px-4 py-1.5 rounded-lg bg-[#0A0E1A]/95 border border-amber-500/35">
          {/* Sanctum (Blue) */}
          <div className="flex items-center gap-2.5">
            <div className="text-right">
              <div className="text-[11px] font-semibold text-sky-400">
                Sanctum{' '}
                {hud.blueCoreShielded
                  ? 'Shielded'
                  : `Core ${Math.round((hud.blueCoreHp / hud.blueCoreMaxHp) * 100)}%`}
              </div>
              <div className="text-[11px] font-mono-num text-slate-400">
                Towers {hud.blueTurretsAlive}/4
              </div>
            </div>
            <span className="font-display text-xl font-extrabold font-mono-num text-sky-300 min-w-[22px] text-center">
              {hud.blueKills}
            </span>
          </div>

          <div className="px-3 py-0.5 border-x border-slate-700/80 text-center">
            <div className="font-mono-num text-sm font-bold text-white leading-tight">
              {formatClock(hud.matchTime)}
            </div>
            <div
              className={`text-[10px] font-semibold leading-tight mt-0.5 whitespace-nowrap ${
                hud.waveTier >= 5
                  ? 'text-rose-400'
                  : hud.waveTier >= 3
                    ? 'text-amber-300'
                    : 'text-slate-400'
              }`}
            >
              {hud.waveTierName}
            </div>
          </div>

          {/* Invasion (Red) */}
          <div className="flex items-center gap-2.5">
            <span className="font-display text-xl font-extrabold font-mono-num text-rose-400 min-w-[22px] text-center">
              {hud.redKills}
            </span>
            <div className="text-left">
              <div className="text-[11px] font-semibold text-rose-400">
                Invasion{' '}
                {hud.redCoreShielded
                  ? 'Shielded'
                  : `Core ${Math.round((hud.redCoreHp / hud.redCoreMaxHp) * 100)}%`}
              </div>
              <div className="text-[11px] font-mono-num text-slate-400">
                Towers {hud.redTurretsAlive}/4
              </div>
            </div>
          </div>
        </div>

        {/* Top Right: Audio & Pause */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            className="w-9 h-9 rounded-lg bg-[#0A0E1A]/94 border border-slate-700/80 hover:border-slate-500 flex items-center justify-center text-slate-200 cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onTogglePause}
            aria-label="Pause menu"
            className="w-9 h-9 rounded-lg bg-[#0A0E1A]/94 border border-slate-700/80 hover:border-slate-500 flex items-center justify-center text-slate-200 cursor-pointer"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* CENTER ANNOUNCER BANNER */}
      <div className="flex flex-col items-center justify-start flex-1 pt-4">
        {hud.banner && (
          <div
            className={`px-5 py-2 rounded-lg border text-center bg-[#0A0E1A]/95 ${
              hud.banner.tone === 'gold'
                ? 'border-amber-400/80'
                : hud.banner.tone === 'blue'
                  ? 'border-sky-400/80'
                  : hud.banner.tone === 'emerald'
                    ? 'border-emerald-400/80'
                    : 'border-rose-500/80'
            }`}
          >
            <div
              className={`font-display text-base font-extrabold tracking-wide ${
                hud.banner.tone === 'gold'
                  ? 'text-amber-300'
                  : hud.banner.tone === 'blue'
                    ? 'text-sky-300'
                    : hud.banner.tone === 'emerald'
                      ? 'text-emerald-300'
                      : 'text-rose-400'
              }`}
            >
              {hud.banner.title}
            </div>
            <div className="text-xs text-slate-200">{hud.banner.subtitle}</div>
          </div>
        )}

        {!hud.player.alive && hud.phase === 'PLAYING' && (
          <div className="mt-8 px-6 py-3 rounded-xl bg-[#0A0E1A]/95 border border-rose-500/60 text-center">
            <div className="font-display text-lg font-extrabold text-rose-400">
              Fallen — Drop Pod Charging
            </div>
            <div className="font-mono-num text-sm text-slate-200 mt-0.5">
              Deploying in {hud.player.respawnTimer}s · Press B to forge Talents
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM HUD ROW */}
      <div className="flex items-end justify-between gap-3">
        {/* Bottom Left: Active Forged Items Strip + Player Card */}
        <div className="pointer-events-auto relative flex flex-col gap-1.5">
          {/* Forged Talents / Items Inventory Strip (Hoverable for instant tooltips!) */}
          {forgedNodes.length > 0 && (
            <div className="relative flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0A0E1A]/92 border border-slate-800/90 w-fit max-w-[300px] flex-wrap">
              {forgedNodes.map((node) => {
                const rank = hud.player.upgrades[node.id] ?? 0;
                const asp = ASPECT_META[node.aspect];
                return (
                  <div
                    key={node.id}
                    onMouseEnter={() => setHoveredForgedId(node.id)}
                    onMouseLeave={() => setHoveredForgedId((prev) => (prev === node.id ? null : prev))}
                    className={`relative w-7 h-7 rounded-md border ${asp.border} bg-[#111829] flex items-center justify-center cursor-help transition-transform hover:scale-110`}
                    style={{ color: asp.color }}
                  >
                    <UpgradeSvgIcon icon={node.icon} className="w-3.5 h-3.5" />
                    <span className="absolute -bottom-0.5 -right-0.5 px-1 rounded-xs bg-[#070A12] border border-slate-700 font-mono-num text-[9px] font-bold text-white leading-tight">
                      {rank}
                    </span>
                  </div>
                );
              })}

              {/* Anchored Forged Item Tooltip */}
              {hoveredForgedNode && (
                <div className="absolute left-0 bottom-full mb-2 z-50">
                  <UpgradeTooltipCard
                    data={buildUpgradeTooltip(
                      hud.player.heroId,
                      hoveredForgedNode,
                      hud.player.upgrades,
                      hud.player.solar
                    )}
                  />
                </div>
              )}
            </div>
          )}

          {/* Player Card */}
          <div className="relative flex items-center gap-3 p-2.5 rounded-xl bg-[#0A0E1A]/95 border border-slate-700/80">
            <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-amber-500/45 shrink-0 bg-[#070A12]">
              <img
                src={heroDef.portrait}
                alt={heroDef.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-top"
              />
              <div
                className="absolute bottom-0 inset-x-0 h-1"
                style={{ backgroundColor: hud.player.team === 'blue' ? '#38BDF8' : '#F43F5E' }}
              />
            </div>

            <div className="flex flex-col gap-1.5 min-w-[198px]">
              <div>
                <div className="flex items-baseline justify-between text-xs mb-0.5">
                  <span className="font-display font-bold text-white truncate max-w-[118px]">
                    {heroDef.name}
                  </span>
                  <span className="font-mono-num text-[11px] text-emerald-300 font-semibold">
                    {hud.player.hp}/{hud.player.maxHp} HP
                  </span>
                </div>
                <div className="w-full h-2.5 rounded bg-slate-900 overflow-hidden border border-slate-700">
                  <div
                    className="h-full bg-emerald-500 transition-[width] duration-75"
                    style={{ width: `${hpPct}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div
                  onMouseEnter={() => setHoveredUtil('relic')}
                  onMouseLeave={() => setHoveredUtil((prev) => (prev === 'relic' ? null : prev))}
                  className="flex items-center gap-1 font-mono-num text-sm font-bold text-amber-300 cursor-help"
                >
                  <SolarCrystalIcon className="w-4 h-4" />
                  <span>{hud.player.solar}</span>
                </div>

                <button
                  type="button"
                  onClick={onToggleShop}
                  onMouseEnter={() => setHoveredUtil('forge')}
                  onMouseLeave={() => setHoveredUtil((prev) => (prev === 'forge' ? null : prev))}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    shopOpen
                      ? 'bg-amber-400 text-[#070A12]'
                      : hud.player.affordableUpgrades > 0
                        ? 'bg-amber-500/20 border border-amber-400 text-amber-300 hover:bg-amber-500/30'
                        : 'bg-slate-800 border border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  Talents [B]
                  {hud.player.affordableUpgrades > 0 && !shopOpen
                    ? ` · ${hud.player.affordableUpgrades}`
                    : ''}
                </button>

                <button
                  type="button"
                  onClick={onRecall}
                  onMouseEnter={() => setHoveredUtil('recall')}
                  onMouseLeave={() => setHoveredUtil((prev) => (prev === 'recall' ? null : prev))}
                  disabled={hud.player.inBase || !hud.player.alive}
                  className="px-2 py-1 rounded-md text-xs font-medium bg-slate-800 border border-slate-700 text-sky-300 hover:border-sky-400 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                >
                  {hud.player.recallTimer > 0
                    ? `${hud.player.recallTimer.toFixed(1)}s`
                    : 'Recall [R]'}
                </button>
              </div>
            </div>

            {/* Utility Button Tooltips */}
            {hoveredUtil === 'relic' && (
              <div className="absolute left-0 bottom-full mb-2 z-50">
                <SimpleTooltipCard
                  title="Relic Essence"
                  lines={[
                    { label: 'Current Balance', value: `${hud.player.solar}`, accent: 'gold' },
                    {
                      label: 'Passive Flow',
                      value: `+${hud.player.stats.passiveSolarPerSec.toFixed(1)}/s`,
                      accent: 'gold',
                    },
                    {
                      label: 'Health Regen',
                      value: `+${hud.player.stats.hpRegenPerSec.toFixed(1)} HP/s`,
                      accent: 'emerald',
                    },
                    { label: 'Total Forged', value: `${hud.player.totalSolarSpent}` },
                  ]}
                />
              </div>
            )}

            {hoveredUtil === 'forge' && (
              <div className="absolute left-0 bottom-full mb-2 z-50">
                <SimpleTooltipCard
                  title="Talent Forge [B]"
                  lines={[
                    { label: 'Spend Relic Essence anywhere on the map to upgrade skills.' },
                    {
                      label: 'Affordable Nodes',
                      value: `${hud.player.affordableUpgrades}`,
                      accent: 'gold',
                    },
                  ]}
                />
              </div>
            )}

            {hoveredUtil === 'recall' && (
              <div className="absolute left-0 bottom-full mb-2 z-50">
                <SimpleTooltipCard
                  title="Sanctum Recall [R]"
                  lines={[
                    { label: 'Channels for 2.2s to teleport back to your Healing Altar.' },
                    { label: 'Canceled if you move or take enemy damage.', accent: 'sky' },
                  ]}
                />
              </div>
            )}
          </div>
        </div>

        {/* Bottom Center: 3-Slot Interactive Ability Bar with Instant Live Hover Tooltips */}
        <div className="pointer-events-auto relative flex items-center gap-2 p-2 rounded-xl bg-[#0A0E1A]/95 border border-amber-500/35">
          {abilities.map((ab) => {
            const onCd = ab.cd > 0.05;
            const cdPct = onCd ? Math.min(100, (ab.cd / Math.max(0.1, ab.maxCd)) * 100) : 0;
            const isHovered = hoveredAbility === ab.slot;
            const rowUpgradesCount = heroDef.upgrades
              .filter((u) => u.row === ab.slot)
              .reduce((acc, u) => acc + (hud.player.upgrades[u.id] ?? 0), 0);

            return (
              <div
                key={ab.meta.name}
                onMouseEnter={() => setHoveredAbility(ab.slot)}
                onMouseLeave={() => setHoveredAbility((prev) => (prev === ab.slot ? null : prev))}
                className={`relative w-15 h-15 rounded-lg border transition-all flex flex-col items-center justify-center overflow-hidden cursor-help ${
                  isHovered
                    ? 'border-amber-400 bg-[#18223A] scale-[1.04]'
                    : 'border-slate-700 bg-[#111829]'
                }`}
              >
                {onCd && (
                  <div
                    className="absolute inset-x-0 bottom-0 bg-[#050810]/85"
                    style={{ height: `${cdPct}%` }}
                  />
                )}
                <div
                  className="relative z-10"
                  style={{ color: onCd ? '#64748B' : heroDef.accentColor }}
                >
                  <AbilitySvgIcon icon={ab.meta.icon} className="w-5 h-5" />
                </div>
                <span className="relative z-10 text-[10px] font-mono-num text-slate-200 font-semibold mt-0.5">
                  {onCd ? `${ab.cd.toFixed(1)}s` : ab.extraLabel ?? ab.meta.keyLabel.split(' ')[0]}
                </span>

                {/* Upgrade rank dots along top edge of ability slot */}
                {rowUpgradesCount > 0 && (
                  <div className="absolute top-1 inset-x-1 flex justify-center gap-0.5 z-10">
                    {Array.from({ length: Math.min(5, rowUpgradesCount) }).map((_, i) => (
                      <span key={i} className="w-1.5 h-1 rounded-xs bg-amber-400" />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Anchored Ability Hover Tooltip */}
          {hoveredAbility && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50">
              <AbilityTooltipCard
                mode="hud"
                data={buildAbilityTooltip(
                  hud.player.heroId,
                  hoveredAbility,
                  hud.player.stats,
                  hud.player.upgrades
                )}
              />
            </div>
          )}
        </div>

        {/* Bottom Right: Extended 2-Tier Cathedral Minimap */}
        <div className="hidden sm:flex flex-col p-2 rounded-xl bg-[#0A0E1A]/95 border border-slate-700/80">
          <div className="relative w-[228px] h-[74px] rounded bg-[#070A12] border border-slate-800 overflow-hidden">
            {/* Top Nave + Bottom Lane + Primordial Crypt Pit lines */}
            <div className="absolute left-[12%] right-[12%] top-[50%] h-[2px] bg-slate-700/70" />
            <div className="absolute left-0 right-0 top-[82%] h-[2px] bg-slate-600/80" />
            <div className="absolute left-[42%] right-[42%] top-[88%] h-[3px] bg-emerald-600/60" />

            {hud.minimap.map((blip, i) => {
              if (!blip.alive) return null;
              const left = `${(blip.x * 100).toFixed(1)}%`;
              const top = `${(blip.y * 100).toFixed(1)}%`;

              if (blip.kind === 'core') {
                return (
                  <div
                    key={i}
                    style={{ left, top }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-xs border border-black ${
                      blip.team === 'blue' ? 'bg-sky-400' : 'bg-rose-500'
                    }`}
                  />
                );
              }
              if (blip.kind === 'turret') {
                return (
                  <div
                    key={i}
                    style={{ left, top }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 w-2 h-2 border border-black ${
                      blip.team === 'blue' ? 'bg-sky-300' : 'bg-rose-400'
                    }`}
                  />
                );
              }
              if (blip.kind === 'droid') {
                return (
                  <div
                    key={i}
                    style={{ left, top }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full ${
                      blip.team === 'blue' ? 'bg-sky-200/80' : 'bg-rose-300/80'
                    }`}
                  />
                );
              }
              if (blip.kind === 'player') {
                return (
                  <div
                    key={i}
                    style={{ left, top }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rotate-45 bg-amber-300 border border-black z-10"
                  />
                );
              }
              return (
                <div
                  key={i}
                  style={{ left, top }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-black ${
                    blip.team === 'blue' ? 'bg-sky-400' : 'bg-rose-500'
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
