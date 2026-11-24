import { useState } from 'react';
import { Check, Crown, Link2, RefreshCw, RotateCcw, Users } from 'lucide-react';
import { HERO_LIST, HERO_MAP } from '../game/heroes';
import type { HeroId, HudSnapshot, ScoreboardRow } from '../game/types';
import { RelicCorners } from './AbilityIcon';

function computeMvpId(rows: ScoreboardRow[]): string | null {
  if (rows.length === 0) return null;
  let best = rows[0];
  let bestScore = -1;
  for (const r of rows) {
    const score = r.kills * 35 + r.assists * 16 + r.droidKills * 2 + r.totalSolarEarned * 0.04 - r.deaths * 12;
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return best.id;
}

export function ScoreboardOverlay({ hud }: { hud: HudSnapshot }) {
  const blueTeam = hud.scoreboard.filter((r) => r.team === 'blue');
  const redTeam = hud.scoreboard.filter((r) => r.team === 'red');
  const mvpId = computeMvpId(hud.scoreboard);

  const renderTeam = (
    title: string,
    sub: string,
    colorClass: string,
    rows: typeof blueTeam
  ) => (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <div className={`font-display text-sm font-bold ${colorClass}`}>{title}</div>
        <span className="text-[11px] font-mono-num text-slate-400">{sub}</span>
      </div>
      <div className="rounded-xl border border-slate-800 overflow-hidden bg-[#070910]">
        <table className="w-full text-xs">
          <thead className="bg-[#101626] text-slate-400">
            <tr>
              <th className="text-left py-2 px-3 font-medium">Champion</th>
              <th className="text-right py-2 px-2 font-medium">K / D / A</th>
              <th className="text-right py-2 px-2 font-medium">Creeps</th>
              <th className="text-right py-2 px-2 font-medium">Relic</th>
              <th className="text-right py-2 px-3 font-medium">Forged</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {rows.map((r) => {
              const def = HERO_MAP[r.heroId];
              const isMvp = r.id === mvpId && (r.kills > 0 || r.assists > 0 || r.droidKills > 0);
              return (
                <tr key={r.id} className={r.isPlayer ? 'bg-amber-500/10' : ''}>
                  <td className="py-2 px-3 flex items-center gap-2">
                    <img
                      src={def.portrait}
                      alt={def.name}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded object-cover object-top border border-slate-700"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-semibold truncate ${
                            r.isPlayer ? 'text-amber-300' : 'text-white'
                          }`}
                        >
                          {r.name}
                        </span>
                        {isMvp && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {r.alive ? def.disciplineLabel : `Respawning in ${r.respawnTimer}s`}
                      </div>
                    </div>
                  </td>
                  <td className="text-right py-2 px-2 font-mono-num text-slate-200">
                    {r.kills}/{r.deaths}/{r.assists}
                  </td>
                  <td className="text-right py-2 px-2 font-mono-num text-slate-300">
                    {r.droidKills}
                  </td>
                  <td className="text-right py-2 px-2 font-mono-num text-amber-300">
                    {r.totalSolarEarned}
                  </td>
                  <td className="text-right py-2 px-3 font-mono-num text-emerald-300">
                    {r.upgradeCount}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-[#04060D]/72 p-4">
      <div className="relative relic-panel w-full max-w-[800px] rounded-2xl border border-amber-500/35 p-5 flex flex-col gap-4">
        <RelicCorners />
        <div className="flex items-baseline justify-between border-b border-slate-800 pb-3">
          <h2 className="font-display text-lg font-extrabold text-white">Cathedral Scoreboard</h2>
          <span className="text-xs font-mono-num text-slate-400">
            Sanctum {hud.blueKills} — {hud.redKills} Invasion · {hud.waveTierName}
          </span>
        </div>
        {renderTeam(
          'Sanctum Defenders',
          `Towers ${hud.blueTurretsAlive}/4 · Core ${
            hud.blueCoreShielded
              ? 'Shielded'
              : `${Math.round((hud.blueCoreHp / Math.max(1, hud.blueCoreMaxHp)) * 100)}%`
          }`,
          'text-sky-400',
          blueTeam
        )}
        {renderTeam(
          'Invasion Vanguard',
          `Towers ${hud.redTurretsAlive}/4 · Core ${
            hud.redCoreShielded
              ? 'Shielded'
              : `${Math.round((hud.redCoreHp / Math.max(1, hud.redCoreMaxHp)) * 100)}%`
          }`,
          'text-rose-400',
          redTeam
        )}
      </div>
    </div>
  );
}

interface PauseModalProps {
  hud: HudSnapshot;
  muted: boolean;
  musicMuted: boolean;
  onResume: () => void;
  onSwitchHero: (heroId: HeroId) => void;
  onToggleMute: () => void;
  onToggleMusic: () => void;
  onExitToTitle: () => void;
}

export function PauseModal({
  hud,
  muted,
  musicMuted,
  onResume,
  onSwitchHero,
  onToggleMute,
  onToggleMusic,
  onExitToTitle,
}: PauseModalProps) {
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const takenByOtherHumans = new Set<HeroId>(
    (hud.takenHumanHeroes ?? []).filter((id) => id !== hud.player.heroId)
  );

  const handleCopyInvite = () => {
    if (!hud.network.roomId) return;
    const url = `${window.location.origin}/?room=${encodeURIComponent(hud.network.roomId)}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedInvite(true);
    window.setTimeout(() => setCopiedInvite(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#04060D]/80 p-4">
      <div
        className={`relative relic-panel w-full ${
          pickerOpen ? 'max-w-[760px]' : 'max-w-[460px]'
        } max-h-[90vh] overflow-y-auto rounded-2xl border border-amber-500/35 p-6 flex flex-col gap-4 transition-all`}
      >
        <RelicCorners />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-extrabold text-white">
              {hud.network.mode === 'online' ? 'Match Menu' : 'Match Paused'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {hud.network.mode === 'online'
                ? `Live match in Room ${hud.network.roomId} continues in real time.`
                : 'Simulation paused. Resume anytime with Esc.'}
            </p>
          </div>
          {pickerOpen && (
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="text-xs font-semibold text-slate-400 hover:text-white px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-900/70 cursor-pointer"
            >
              Back
            </button>
          )}
        </div>

        {pickerOpen ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl bg-[#070910] border border-amber-500/25 px-3.5 py-2.5 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2">
              <span>
                Select a new Champion to redeploy immediately via <strong className="text-amber-300">Drop Pod</strong>.
              </span>
              <span className="text-emerald-300 font-semibold">
                100% Relic Refunded
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {HERO_LIST.map((hero) => {
                const isCurrent = hero.id === hud.player.heroId;
                const isTaken = takenByOtherHumans.has(hero.id);
                const disabled = isCurrent || isTaken;
                return (
                  <button
                    key={hero.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onSwitchHero(hero.id);
                      setPickerOpen(false);
                    }}
                    className={`group relative text-left rounded-xl overflow-hidden border transition-all ${
                      isCurrent
                        ? 'border-amber-400 bg-[#182136] cursor-default'
                        : isTaken
                          ? 'border-slate-800 bg-[#090C15] opacity-45 cursor-not-allowed'
                          : 'border-slate-800 bg-[#0B101D] hover:border-amber-400/80 hover:bg-[#131B2E] cursor-pointer'
                    }`}
                  >
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#070910]">
                      <img
                        src={hero.portrait}
                        alt={hero.name}
                        referrerPolicy="no-referrer"
                        className={`w-full h-full object-cover object-top ${
                          isTaken ? 'grayscale' : 'group-hover:scale-105 transition-transform'
                        }`}
                      />
                      <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#070910] to-transparent" />
                      {isCurrent && (
                        <div className="absolute inset-x-0 top-0 py-0.5 text-center bg-amber-500/90 text-[#070910] text-[10px] font-bold">
                          Current
                        </div>
                      )}
                      {isTaken && (
                        <div className="absolute inset-x-0 top-0 py-0.5 text-center bg-rose-950/90 border-b border-rose-500/50 text-rose-200 text-[10px] font-semibold">
                          Taken
                        </div>
                      )}
                    </div>
                    <div className="px-2 py-1.5">
                      <div className="font-display text-xs font-bold text-white truncate">
                        {hero.name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">{hero.role}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-xl bg-[#070910] border border-slate-800 p-3.5 text-xs text-slate-300 grid grid-cols-2 gap-y-1.5 gap-x-3">
              <span><strong className="text-white">A / D</strong> Move</span>
              <span><strong className="text-white">W / Space</strong> Jump & Pad Launch</span>
              <span><strong className="text-white">S</strong> Drop Through Glass</span>
              <span><strong className="text-white">LMB</strong> Primary Attack</span>
              <span><strong className="text-white">Q / RMB</strong> Skill 1</span>
              <span><strong className="text-white">E / Shift</strong> Skill 2</span>
              <span><strong className="text-white">B</strong> Talent Forge</span>
              <span><strong className="text-white">R</strong> Recall to Sanctum</span>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onResume}
                className="w-full py-2.5 px-4 rounded-xl font-display font-bold text-[#070910] bg-gradient-to-r from-amber-300 to-amber-400 hover:brightness-110 cursor-pointer"
              >
                Resume Match
              </button>

              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-sky-200 bg-[#0F1B30] hover:bg-[#172845] border border-sky-500/45 flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-sky-300" />
                <span>Switch Champion Mid-Game</span>
              </button>

              {hud.network.mode === 'online' && hud.network.roomId && (
                <button
                  type="button"
                  onClick={handleCopyInvite}
                  className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-amber-200 bg-[#121A2C] hover:bg-[#19253E] border border-amber-500/45 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {copiedInvite ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-300">Invite Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <Link2 className="w-4 h-4 text-amber-300" />
                      <span>Copy Friend Invite Link ({hud.network.roomId})</span>
                    </>
                  )}
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onToggleMute}
                  className="py-2.5 px-3 rounded-xl text-sm font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 cursor-pointer whitespace-nowrap"
                >
                  {muted ? 'Unmute Audio' : 'Mute Audio'}
                </button>
                <button
                  type="button"
                  onClick={onToggleMusic}
                  className="py-2.5 px-3 rounded-xl text-sm font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 cursor-pointer whitespace-nowrap"
                >
                  {musicMuted ? 'Music: Off' : 'Music: On'}
                </button>
              </div>

              <button
                type="button"
                onClick={onExitToTitle}
                className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-rose-300 bg-rose-950/40 hover:bg-rose-950/70 border border-rose-800/70 cursor-pointer"
              >
                Leave to Champion Select
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface EndMatchModalProps {
  hud: HudSnapshot;
  onRequeueToLobby: () => void;
  onPlayAgain: () => void;
  onChangeHero: () => void;
}

export function EndMatchModal({
  hud,
  onRequeueToLobby,
  onPlayAgain,
  onChangeHero,
}: EndMatchModalProps) {
  const victory = hud.phase === 'VICTORY';
  const isOnline = hud.network.mode === 'online' && Boolean(hud.network.roomId);
  const m = Math.floor(hud.matchTime / 60);
  const s = Math.floor(hud.matchTime % 60);
  const mvpId = computeMvpId(hud.scoreboard);

  const winningFaction =
    (victory && hud.player.team === 'blue') || (!victory && hud.player.team === 'red')
      ? 'Sanctum Defenders'
      : 'Invasion Vanguard';

  const sortedBoard = [...hud.scoreboard].sort((a, b) => {
    if (a.team !== b.team) return a.team === 'blue' ? -1 : 1;
    return b.kills * 3 + b.assists - (a.kills * 3 + a.assists);
  });

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#04060D]/82 backdrop-blur-[2px] p-4 transition-opacity duration-300">
      <div
        className={`relative relic-panel w-full max-w-[720px] max-h-[92vh] overflow-y-auto rounded-2xl border p-6 flex flex-col gap-5 shadow-2xl ${
          victory ? 'border-amber-400/60' : 'border-rose-500/50'
        }`}
      >
        <RelicCorners color={victory ? '#FBBF24' : '#F43F5E'} />

        {/* Decisive Match Outcome Header */}
        <div className="text-center pb-2 border-b border-slate-800/90">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            {winningFaction} Claim The Cathedral · {m}:{String(s).padStart(2, '0')}
          </div>
          <div
            className={`font-display text-5xl font-extrabold tracking-widest mt-1 ${
              victory ? 'text-amber-300' : 'text-rose-400'
            }`}
          >
            {victory ? 'VICTORY' : 'DEFEAT'}
          </div>
          <p className="text-sm text-slate-300 mt-1.5">
            {victory
              ? 'Enemy Ancient Core shattered! Choose when to re-queue for the next siege.'
              : 'Your Ancient Core fell. Regroup at Hero Select to counter-pick and re-queue.'}
          </p>
          <div className="mt-2.5 flex items-center justify-center gap-4 text-xs font-mono-num text-slate-400">
            <span className="text-sky-300">
              Sanctum {hud.blueKills} Kills · {hud.blueTurretsAlive}/4 Towers
            </span>
            <span aria-hidden="true">vs</span>
            <span className="text-rose-300">
              Invasion {hud.redKills} Kills · {hud.redTurretsAlive}/4 Towers
            </span>
          </div>
        </div>

        {/* Personal Highlights */}
        <div className="grid grid-cols-4 gap-2 text-center rounded-xl bg-[#070910] border border-slate-800 p-3.5">
          <div>
            <div className="text-[11px] text-slate-400">Match Time</div>
            <div className="font-mono-num text-base font-bold text-white">
              {m}:{String(s).padStart(2, '0')}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Your K/D/A</div>
            <div className="font-mono-num text-base font-bold text-sky-300">
              {hud.player.kills}/{hud.player.deaths}/{hud.player.assists}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Creeps</div>
            <div className="font-mono-num text-base font-bold text-emerald-300">
              {hud.player.droidKills}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Relic Forged</div>
            <div className="font-mono-num text-base font-bold text-amber-300">
              {hud.player.totalSolarSpent}
            </div>
          </div>
        </div>

        {/* Full 3v3 Final Match Standings & MVP */}
        {sortedBoard.length > 0 && (
          <div className="rounded-xl border border-slate-800 overflow-hidden bg-[#070910]">
            <table className="w-full text-xs">
              <thead className="bg-[#101626] text-slate-400">
                <tr>
                  <th className="text-left py-2 px-3 font-medium">Final Standings</th>
                  <th className="text-right py-2 px-2 font-medium">K/D/A</th>
                  <th className="text-right py-2 px-2 font-medium">Creeps</th>
                  <th className="text-right py-2 px-2 font-medium">Forged</th>
                  <th className="text-right py-2 px-3 font-medium">Relic</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {sortedBoard.map((r) => {
                  const def = HERO_MAP[r.heroId];
                  const isMvp = r.id === mvpId;
                  return (
                    <tr key={r.id} className={r.isPlayer ? 'bg-amber-500/10' : ''}>
                      <td className="py-1.5 px-3 flex items-center gap-2">
                        <span
                          className={`w-1 h-5 rounded-full shrink-0 ${
                            r.team === 'blue' ? 'bg-sky-400' : 'bg-rose-500'
                          }`}
                        />
                        <img
                          src={def.portrait}
                          alt={def.name}
                          referrerPolicy="no-referrer"
                          className="w-6 h-6 rounded object-cover object-top border border-slate-700"
                        />
                        <span
                          className={`font-semibold truncate ${
                            r.isPlayer ? 'text-amber-300' : 'text-slate-100'
                          }`}
                        >
                          {r.name}
                        </span>
                        <span className="text-[10.5px] text-slate-500 hidden sm:inline">
                          · {def.name}
                        </span>
                        {isMvp && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 shrink-0">
                            <Crown className="w-3 h-3" /> MVP
                          </span>
                        )}
                      </td>
                      <td className="text-right py-1.5 px-2 font-mono-num text-slate-200">
                        {r.kills}/{r.deaths}/{r.assists}
                      </td>
                      <td className="text-right py-1.5 px-2 font-mono-num text-slate-300">
                        {r.droidKills}
                      </td>
                      <td className="text-right py-1.5 px-2 font-mono-num text-emerald-300">
                        {r.upgradeCount}
                      </td>
                      <td className="text-right py-1.5 px-3 font-mono-num text-amber-300">
                        {r.totalSolarEarned}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Explicit Post-Match Actions (Never Auto-Starts) */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {isOnline ? (
              <button
                type="button"
                onClick={onRequeueToLobby}
                className="flex-1 py-3 px-4 rounded-xl font-display font-extrabold text-[#070910] bg-gradient-to-r from-amber-300 to-amber-400 hover:brightness-110 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Users className="w-4 h-4" />
                <span>Re-Queue Room ({hud.network.roomId}) → Hero Select</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onChangeHero}
                className="flex-1 py-3 px-4 rounded-xl font-display font-extrabold text-[#070910] bg-gradient-to-r from-amber-300 to-amber-400 hover:brightness-110 cursor-pointer whitespace-nowrap"
              >
                Back to Champion Select
              </button>
            )}

            <button
              type="button"
              onClick={onPlayAgain}
              className="py-3 px-4 rounded-xl text-sm font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4 text-amber-300" />
              <span>Instant Rematch</span>
            </button>
          </div>

          {isOnline && (
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-0.5">
              <span>
                Re-Queue returns everyone in <strong className="font-mono-num text-amber-300">{hud.network.roomId}</strong> to Hero Select for a fresh match.
              </span>
              <button
                type="button"
                onClick={onChangeHero}
                className="text-slate-400 hover:text-slate-200 underline cursor-pointer shrink-0 ml-3"
              >
                Leave Solo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

