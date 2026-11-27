import { roomInviteUrl } from '../platform';
import { usePadMode } from './usePadMode';
import { useState } from 'react';
import {
  Volume2,
  VolumeX,
  Music,
  Mic,
  MicOff,
  Megaphone,
  Pause,
  Copy,
  Check,
  Swords,
  Shield,
  Flame,
} from 'lucide-react';
import { ASCENSION_INFUSIONS, HERO_MAP } from '../game/heroes';
import { JUMP_PADS, WORLD_H, WORLD_W } from '../game/map';
import {
  ASPECT_META,
  buildAbilityTooltip,
  buildUpgradeTooltip,
} from '../game/tooltips';
import type { HudSnapshot } from '../game/types';
import type { ActiveVoiceSubtitle } from '../game/voices';
import { AbilitySvgIcon, RelicCorners, SolarCrystalIcon, UpgradeSvgIcon } from './AbilityIcon';
import { AbilityTooltipCard, SimpleTooltipCard, UpgradeTooltipCard } from './TooltipCard';

interface GameHudProps {
  hud: HudSnapshot;
  muted: boolean;
  musicMuted: boolean;
  voicesMuted: boolean;
  activeSubtitle: ActiveVoiceSubtitle | null;
  shopOpen: boolean;
  onToggleShop: () => void;
  onToggleMute: () => void;
  onToggleMusic: () => void;
  onToggleVoices: () => void;
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
  musicMuted,
  voicesMuted,
  activeSubtitle,
  shopOpen,
  onToggleShop,
  onToggleMute,
  onToggleMusic,
  onToggleVoices,
  onTogglePause,
  onRecall,
}: GameHudProps) {
  const padMode = usePadMode();
  const PAD_SLOT_LABEL: Record<string, string> = { primary: 'RT', skill1: 'LB', skill2: 'RB' };
  const [copiedRoom, setCopiedRoom] = useState(false);
  const [hoveredAbility, setHoveredAbility] = useState<'primary' | 'skill1' | 'skill2' | null>(
    null
  );
  const [hoveredForgedId, setHoveredForgedId] = useState<string | null>(null);
  const [hoveredUtil, setHoveredUtil] = useState<'relic' | 'forge' | 'recall' | null>(null);

  const heroDef = HERO_MAP[hud.player.heroId];
  const hpPct = Math.max(0, Math.min(100, (hud.player.hp / Math.max(1, hud.player.maxHp)) * 100));
  const shieldPct = Math.max(
    0,
    Math.min(100, (hud.player.shield / Math.max(1, hud.player.maxHp)) * 100)
  );
  const lowHp = hud.player.alive && hpPct < 30;

  const blueCorePct = Math.max(
    0,
    Math.min(100, Math.round((hud.blueCoreHp / Math.max(1, hud.blueCoreMaxHp)) * 100))
  );
  const redCorePct = Math.max(
    0,
    Math.min(100, Math.round((hud.redCoreHp / Math.max(1, hud.redCoreMaxHp)) * 100))
  );

  const blueTowers = (hud.turretStatus ?? []).filter((t) => t.team === 'blue');
  const redTowers = (hud.turretStatus ?? []).filter((t) => t.team === 'red');

  const copyRoomCode = () => {
    if (!hud.network.roomId) return;
    const url = roomInviteUrl(hud.network.roomId);
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

  // Purchased Talent Items & Endgame Ascension Infusions for quick HUD inspection
  const forgedNodes = heroDef.upgrades.filter((u) => (hud.player.upgrades[u.id] ?? 0) > 0);
  const activeAscensions = ASCENSION_INFUSIONS.filter((inf) => (hud.player.upgrades[inf.id] ?? 0) > 0);
  const hoveredForgedNode = hoveredForgedId
    ? forgedNodes.find((u) => u.id === hoveredForgedId) ?? null
    : null;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-4">
      {/* TOP BAR ROW */}
      <div className="flex items-start justify-between gap-3">
        {/* Top Left: Online Room Info or K/D/A */}
        <div className="pointer-events-auto flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#080B14]/94 border border-slate-700/80 text-xs">
          {hud.network.mode === 'online' ? (
            <>
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  hud.network.connected ? 'bg-emerald-400' : 'bg-rose-500'
                }`}
                title={hud.network.connected ? 'WebSocket Connected' : 'Reconnecting'}
              />
              <button
                type="button"
                onClick={copyRoomCode}
                className="flex items-center gap-1.5 font-mono-num font-bold text-amber-300 hover:text-amber-200 cursor-pointer whitespace-nowrap"
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
              <span className="font-mono-num text-slate-300 whitespace-nowrap">
                {hud.network.connected ? `${hud.network.humanCount}/6 Live` : 'Reconnecting'}
              </span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span
                className={`font-mono-num whitespace-nowrap ${
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
            <span className="text-slate-300 font-mono-num whitespace-nowrap">
              K/D/A{' '}
              <strong className="text-white">
                {hud.player.kills}/{hud.player.deaths}/{hud.player.assists}
              </strong>
              <span className="text-slate-600 mx-1.5">·</span>
              Creeps <strong className="text-white">{hud.player.droidKills}</strong>
            </span>
          )}
        </div>

        {/* Top Center: Engraved Cathedral Match Plaque (4-Tower Pips · Core Bar · Wave Tier) */}
        <div className="relative relic-panel flex items-center gap-4 px-5 py-1.5 rounded-xl border border-amber-500/35">
          <RelicCorners />

          {/* Sanctum (Blue) */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end gap-1 min-w-[102px]">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-300">
                {hud.blueCoreShielded && <Shield className="w-3 h-3 text-sky-400" />}
                <span>
                  Sanctum {hud.blueCoreShielded ? 'Shielded' : `${blueCorePct}%`}
                </span>
              </div>
              {/* 4-Tower Diamond Pips + Core Integrity Bar */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1" title={`Sanctum Towers ${hud.blueTurretsAlive}/4`}>
                  {(blueTowers.length === 4
                    ? blueTowers
                    : Array.from({ length: 4 }, (_, i) => ({
                        alive: i < hud.blueTurretsAlive,
                      }))
                  ).map((t, idx) => (
                    <span
                      key={idx}
                      className={`w-2 h-2 rotate-45 border ${
                        t.alive
                          ? 'bg-sky-400 border-sky-200'
                          : 'bg-slate-900 border-slate-700 opacity-50'
                      }`}
                    />
                  ))}
                </div>
                <div className="w-12 h-1.5 rounded-full bg-slate-900 overflow-hidden border border-slate-700">
                  <div
                    className="h-full bg-sky-400 transition-[width] duration-150"
                    style={{ width: `${blueCorePct}%` }}
                  />
                </div>
              </div>
            </div>
            <span className="font-display text-2xl font-extrabold font-mono-num text-sky-300 min-w-[24px] text-center">
              {hud.blueKills}
            </span>
          </div>

          {/* Center Clock & Escalating Wave Tier */}
          <div className="px-3.5 py-0.5 border-x border-amber-500/20 text-center">
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
          <div className="flex items-center gap-3">
            <span className="font-display text-2xl font-extrabold font-mono-num text-rose-400 min-w-[24px] text-center">
              {hud.redKills}
            </span>
            <div className="flex flex-col items-start gap-1 min-w-[102px]">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-400">
                <span>
                  Invasion {hud.redCoreShielded ? 'Shielded' : `${redCorePct}%`}
                </span>
                {hud.redCoreShielded && <Shield className="w-3 h-3 text-rose-400" />}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-12 h-1.5 rounded-full bg-slate-900 overflow-hidden border border-slate-700">
                  <div
                    className="h-full bg-rose-500 transition-[width] duration-150"
                    style={{ width: `${redCorePct}%` }}
                  />
                </div>
                <div className="flex items-center gap-1" title={`Invasion Towers ${hud.redTurretsAlive}/4`}>
                  {(redTowers.length === 4
                    ? redTowers
                    : Array.from({ length: 4 }, (_, i) => ({
                        alive: i < hud.redTurretsAlive,
                      }))
                  ).map((t, idx) => (
                    <span
                      key={idx}
                      className={`w-2 h-2 rotate-45 border ${
                        t.alive
                          ? 'bg-rose-400 border-rose-200'
                          : 'bg-slate-900 border-slate-700 opacity-50'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Right: Audio/Pause Controls + Live Kill Feed */}
        <div className="flex flex-col items-end gap-2">
          <div className="pointer-events-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleMusic}
              aria-label={musicMuted ? 'Unmute music' : 'Mute music'}
              title={musicMuted ? 'Music Off' : 'Music On'}
              className="relative w-9 h-9 rounded-lg bg-[#080B14]/94 border border-slate-700/80 hover:border-amber-400/60 flex items-center justify-center text-slate-200 cursor-pointer transition-colors"
            >
              <Music className={`w-4 h-4 ${musicMuted || muted ? 'text-slate-500' : 'text-amber-300'}`} />
              {(musicMuted || muted) && (
                <span className="pointer-events-none absolute w-5 h-0.5 bg-rose-400 rotate-45 rounded" />
              )}
            </button>
            <button
              type="button"
              onClick={onToggleVoices}
              aria-label={voicesMuted ? 'Unmute voices' : 'Mute voices'}
              title={voicesMuted ? 'Voices Off' : 'Voices On'}
              className="w-9 h-9 rounded-lg bg-[#080B14]/94 border border-slate-700/80 hover:border-amber-400/60 flex items-center justify-center text-slate-200 cursor-pointer transition-colors"
            >
              {voicesMuted || muted ? (
                <MicOff className="w-4 h-4 text-rose-400" />
              ) : (
                <Mic className="w-4 h-4 text-amber-300" />
              )}
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              title={muted ? 'Master Audio Muted' : 'Master Audio On'}
              className="w-9 h-9 rounded-lg bg-[#080B14]/94 border border-slate-700/80 hover:border-amber-400/60 flex items-center justify-center text-slate-200 cursor-pointer transition-colors"
            >
              {muted ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={onTogglePause}
              aria-label="Match menu"
              className="w-9 h-9 rounded-lg bg-[#080B14]/94 border border-slate-700/80 hover:border-amber-400/60 flex items-center justify-center text-slate-200 cursor-pointer transition-colors"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>

          {/* LIVE AUTHORITATIVE KILL FEED */}
          {hud.killFeed && hud.killFeed.length > 0 && (
            <div
              className="flex flex-col items-end gap-1.5 w-[275px] sm:w-[310px]"
              aria-live="polite"
            >
              {hud.killFeed.map((entry) => {
                const fadeOpacity = entry.timer < 1.2 ? Math.max(0.15, entry.timer / 1.2) : 1;
                const killerDef = entry.killerHeroId ? HERO_MAP[entry.killerHeroId] : null;
                const victimDef = entry.victimHeroId ? HERO_MAP[entry.victimHeroId] : null;
                const isTower = entry.kind === 'tower';

                return (
                  <div
                    key={entry.id}
                    style={{ opacity: fadeOpacity }}
                    className={`flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#080B14]/92 border text-[11px] shadow-lg transition-opacity duration-150 ${
                      isTower
                        ? 'border-amber-400/55'
                        : entry.killerTeam === 'blue'
                          ? 'border-sky-500/40'
                          : 'border-rose-500/40'
                    }`}
                  >
                    {/* Killer Portrait & Name */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      {killerDef && (
                        <img
                          src={killerDef.portrait}
                          alt={killerDef.name}
                          referrerPolicy="no-referrer"
                          className={`w-5 h-5 rounded object-cover object-top shrink-0 border ${
                            entry.killerTeam === 'blue' ? 'border-sky-400' : 'border-rose-400'
                          }`}
                        />
                      )}
                      <span
                        className={`font-semibold truncate max-w-[92px] ${
                          entry.killerTeam === 'blue' ? 'text-sky-300' : 'text-rose-300'
                        }`}
                      >
                        {entry.killerName}
                      </span>
                      {entry.assistCount && entry.assistCount > 0 ? (
                        <span className="font-mono-num text-[10px] text-amber-300/90 shrink-0">
                          +{entry.assistCount}
                        </span>
                      ) : null}
                    </div>

                    {/* Action Icon (Crossed Swords for Hero Kill, Flame for Tower Shattered) */}
                    <span className="shrink-0 text-amber-400">
                      {isTower ? (
                        <Flame className="w-3.5 h-3.5" />
                      ) : (
                        <Swords className="w-3.5 h-3.5" />
                      )}
                    </span>

                    {/* Victim Portrait & Name */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      {victimDef && (
                        <img
                          src={victimDef.portrait}
                          alt={victimDef.name}
                          referrerPolicy="no-referrer"
                          className={`w-5 h-5 rounded object-cover object-top shrink-0 border opacity-80 grayscale-[35%] ${
                            entry.victimTeam === 'blue' ? 'border-sky-400' : 'border-rose-400'
                          }`}
                        />
                      )}
                      <span
                        className={`font-semibold truncate max-w-[100px] ${
                          isTower
                            ? 'text-amber-200'
                            : entry.victimTeam === 'blue'
                              ? 'text-sky-300/90'
                              : 'text-rose-300/90'
                        }`}
                      >
                        {entry.victimName}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* CENTER CATHEDRAL PROCLAMATION BANNER */}
      <div className="flex flex-col items-center justify-start flex-1 pt-4">
        {hud.banner && (
          <div
            className={`relative relic-panel px-7 py-2.5 rounded-xl border text-center ${
              hud.banner.tone === 'gold'
                ? 'border-amber-400/75'
                : hud.banner.tone === 'blue'
                  ? 'border-sky-400/75'
                  : hud.banner.tone === 'emerald'
                    ? 'border-emerald-400/75'
                    : 'border-rose-500/75'
            }`}
          >
            <RelicCorners
              color={
                hud.banner.tone === 'gold'
                  ? '#FBBF24'
                  : hud.banner.tone === 'blue'
                    ? '#38BDF8'
                    : hud.banner.tone === 'emerald'
                      ? '#34D399'
                      : '#F43F5E'
              }
            />
            <div
              className={`font-display text-base sm:text-lg font-extrabold tracking-wider ${
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
            <div className="text-xs text-slate-200 mt-0.5">{hud.banner.subtitle}</div>
          </div>
        )}

        {!hud.player.alive && hud.phase === 'PLAYING' && (
          <div className="relative relic-panel mt-8 px-6 py-3 rounded-xl border border-rose-500/60 text-center">
            <RelicCorners color="#F43F5E" />
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
        {/* Bottom Left: Active Forged Items Strip + Champion Unit Frame */}
        <div className="pointer-events-auto relative flex flex-col gap-1.5">
          {/* Forged Talents & Ascension Infusions Strip */}
          {(forgedNodes.length > 0 || activeAscensions.length > 0) && (
            <div className="relative flex items-center gap-1 px-2 py-1 rounded-lg bg-[#080B14]/94 border border-slate-800/90 w-fit max-w-[332px] flex-wrap">
              {forgedNodes.map((node) => {
                const rank = hud.player.upgrades[node.id] ?? 0;
                const maxed = rank >= node.maxRank;
                const asp = ASPECT_META[node.aspect];
                return (
                  <div
                    key={node.id}
                    onMouseEnter={() => setHoveredForgedId(node.id)}
                    onMouseLeave={() =>
                      setHoveredForgedId((prev) => (prev === node.id ? null : prev))
                    }
                    className={`relative w-7 h-7 rounded-md border ${asp.border} ${
                      maxed ? 'bg-amber-950/35' : 'bg-[#111829]'
                    } flex items-center justify-center cursor-help transition-transform hover:scale-110`}
                    style={{ color: asp.color }}
                  >
                    <UpgradeSvgIcon icon={node.icon} className="w-3.5 h-3.5" />
                    <span className="absolute -bottom-0.5 -right-0.5 px-0.5 rounded-xs bg-[#070910] border border-amber-500/50 text-[8.5px] font-bold text-amber-300 leading-tight">
                      {maxed ? '★' : rank}
                    </span>
                  </div>
                );
              })}
              {activeAscensions.map((inf) => {
                const stacks = hud.player.upgrades[inf.id] ?? 0;
                const asp = ASPECT_META[inf.aspect];
                return (
                  <div
                    key={inf.id}
                    title={`${inf.name} ×${stacks}: ${inf.perStackText}`}
                    className={`relative w-7 h-7 rounded-md border ${asp.border} bg-amber-950/45 flex items-center justify-center cursor-help`}
                    style={{ color: asp.color }}
                  >
                    <UpgradeSvgIcon icon={inf.icon} className="w-3.5 h-3.5" />
                    <span className="absolute -bottom-0.5 -right-0.5 px-0.5 rounded-xs bg-[#070910] border border-amber-400 text-[8.5px] font-mono-num font-bold text-amber-300 leading-tight">
                      ×{stacks}
                    </span>
                  </div>
                );
              })}

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

          {/* Champion Unit Frame */}
          <div
            className={`relative relic-panel flex items-center gap-3 p-2.5 rounded-xl border transition-colors ${
              lowHp ? 'border-rose-500/85' : 'border-amber-500/30'
            }`}
          >
            <RelicCorners color={lowHp ? '#F43F5E' : '#D9A441'} />

            <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-amber-500/50 shrink-0 bg-[#070910]">
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

            <div className="flex flex-col gap-1.5 min-w-[208px]">
              <div>
                <div className="flex items-baseline justify-between text-xs mb-0.5">
                  <span className="font-display font-bold text-white truncate max-w-[118px]">
                    {heroDef.name}
                  </span>
                  <span
                    className={`font-mono-num text-[11px] font-semibold ${
                      lowHp ? 'text-rose-400' : 'text-emerald-300'
                    }`}
                  >
                    {hud.player.hp}/{hud.player.maxHp}
                    {hud.player.shield > 0 ? ` (+${hud.player.shield})` : ' HP'}
                  </span>
                </div>
                <div className="relative w-full h-2.5 rounded bg-slate-900 overflow-hidden border border-slate-700">
                  <div
                    className={`h-full transition-[width] duration-75 ${
                      lowHp ? 'bg-rose-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${hpPct}%` }}
                  />
                  {shieldPct > 0 && (
                    <div
                      className="absolute inset-y-0 left-0 bg-sky-400/55 border-r border-sky-200 transition-[width] duration-75"
                      style={{ width: `${Math.min(100, shieldPct)}%` }}
                    />
                  )}
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
                      ? 'bg-amber-400 text-[#070910]'
                      : hud.player.affordableUpgrades > 0
                        ? 'bg-amber-500/20 border border-amber-400 text-amber-300 hover:bg-amber-500/30'
                        : 'bg-slate-800/90 border border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  {padMode ? 'Talents [X]' : 'Talents [B]'}
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
                  className="px-2 py-1 rounded-md text-xs font-medium bg-slate-800/90 border border-slate-700 text-sky-300 hover:border-sky-400 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                >
                  {hud.player.recallTimer > 0
                    ? `${hud.player.recallTimer.toFixed(1)}s`
                    : padMode
                      ? 'Recall [Y]'
                      : 'Recall [R]'}
                </button>
              </div>
            </div>

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

        {/* Bottom Center: Sculpted 3-Slot Ability Dock */}
        <div className="pointer-events-auto relative relic-panel flex items-center gap-2.5 px-3 py-2 rounded-xl border border-amber-500/35">
          <RelicCorners />
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
                className={`relative w-15 h-15 rounded-lg border transition-all duration-150 flex flex-col items-center justify-center overflow-hidden cursor-help ${
                  isHovered
                    ? 'border-amber-400 bg-[#18223A] scale-[1.04]'
                    : onCd
                      ? 'border-slate-800 bg-[#0A0F1C]'
                      : 'border-slate-600/90 bg-[#121A2D]'
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
                <span
                  className={`relative z-10 text-[10px] font-mono-num font-semibold mt-0.5 ${
                    onCd ? 'text-amber-300' : 'text-slate-200'
                  }`}
                >
                  {onCd ? `${ab.cd.toFixed(1)}s` : ab.extraLabel ?? (padMode ? PAD_SLOT_LABEL[ab.slot] : ab.meta.keyLabel.split(' ')[0])}
                </span>

                {/* Upgrade rank pips along top edge of ability slot */}
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

          {/* Low-Occlusion Champion & Cathedral Herald Voice Subtitle Strip */}
          {!hoveredAbility && activeSubtitle && !activeSubtitle.loading && (
            <div
              className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 z-40 w-max max-w-[420px]"
              aria-live="polite"
            >
              <div
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#070A14]/92 border border-slate-700/85 shadow-xl"
                style={{ borderLeftWidth: '3px', borderLeftColor: activeSubtitle.accentColor }}
              >
                {activeSubtitle.portrait ? (
                  <img
                    src={activeSubtitle.portrait}
                    alt={activeSubtitle.speakerName}
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded object-cover object-top border border-slate-600 shrink-0"
                  />
                ) : (
                  <span className="w-7 h-7 rounded bg-amber-500/15 border border-amber-400/45 flex items-center justify-center shrink-0 text-amber-300">
                    <Megaphone className="w-3.5 h-3.5" />
                  </span>
                )}
                <div className="min-w-0">
                  <div
                    className="font-display text-[10px] font-bold uppercase tracking-wider leading-tight"
                    style={{ color: activeSubtitle.accentColor }}
                  >
                    {activeSubtitle.speakerName}
                  </div>
                  <div className="text-xs text-slate-100 italic leading-snug">
                    &ldquo;{activeSubtitle.text}&rdquo;
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Right: Tactical Cathedral Minimap with Live Camera Viewport */}
        <div className="hidden sm:flex relative relic-panel flex-col p-2 rounded-xl border border-amber-500/30">
          <RelicCorners />
          <div className="relative w-[240px] h-[78px] rounded bg-[#070910] border border-slate-800 overflow-hidden">
            {/* Subtle Faction & Crypt Zone Wash */}
            <div className="absolute inset-y-0 left-0 w-[34%] bg-sky-500/5" />
            <div className="absolute inset-y-0 left-[34%] right-[34%] bg-emerald-500/5" />
            <div className="absolute inset-y-0 right-0 w-[34%] bg-rose-500/5" />

            {/* Top Nave + Bottom Lane + Primordial Crypt Pit lines */}
            <div className="absolute left-[11%] right-[11%] top-[49%] h-[2px] bg-slate-700/75" />
            <div className="absolute left-0 right-0 top-[82%] h-[2px] bg-slate-600/85" />
            <div className="absolute left-[41%] right-[41%] top-[89%] h-[3px] bg-emerald-500/60" />

            {/* Subtle Zone Labels */}
            <span className="absolute left-1.5 top-1 text-[8px] font-mono-num text-slate-500 tracking-wider">
              NAVE
            </span>
            <span className="absolute left-1/2 -translate-x-1/2 bottom-0.5 text-[8px] font-mono-num text-emerald-500/70 tracking-wider">
              CRYPT
            </span>

            {/* Jump Pad Markers */}
            {JUMP_PADS.map((jp, idx) => (
              <div
                key={`jp_${idx}`}
                style={{
                  left: `${(((jp.x + jp.w * 0.5) / WORLD_W) * 100).toFixed(1)}%`,
                  top: `${((jp.y / WORLD_H) * 100).toFixed(1)}%`,
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-amber-400/55"
              />
            ))}

            {/* Live Camera Viewport Box */}
            {hud.minimapViewport && (
              <div
                style={{
                  left: `${(hud.minimapViewport.x * 100).toFixed(1)}%`,
                  top: `${(hud.minimapViewport.y * 100).toFixed(1)}%`,
                  width: `${(hud.minimapViewport.w * 100).toFixed(1)}%`,
                  height: `${(hud.minimapViewport.h * 100).toFixed(1)}%`,
                }}
                className="absolute border border-amber-200/45 bg-amber-200/5 pointer-events-none"
              />
            )}

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
