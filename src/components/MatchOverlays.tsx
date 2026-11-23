import { useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { HERO_MAP } from '../game/heroes';
import type { HudSnapshot } from '../game/types';

export function ScoreboardOverlay({ hud }: { hud: HudSnapshot }) {
  const blueTeam = hud.scoreboard.filter((r) => r.team === 'blue');
  const redTeam = hud.scoreboard.filter((r) => r.team === 'red');

  const renderTeam = (title: string, colorClass: string, rows: typeof blueTeam) => (
    <div>
      <div className={`font-display text-sm font-bold mb-2 ${colorClass}`}>{title}</div>
      <div className="rounded-xl border border-slate-800 overflow-hidden bg-[#080B14]">
        <table className="w-full text-xs">
          <thead className="bg-[#101626] text-slate-400">
            <tr>
              <th className="text-left py-2 px-3 font-medium">Champion</th>
              <th className="text-right py-2 px-2 font-medium">K / D / A</th>
              <th className="text-right py-2 px-2 font-medium">Creeps</th>
              <th className="text-right py-2 px-2 font-medium">Relic</th>
              <th className="text-right py-2 px-3 font-medium">Talents</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {rows.map((r) => {
              const def = HERO_MAP[r.heroId];
              return (
                <tr key={r.id} className={r.isPlayer ? 'bg-amber-500/10' : ''}>
                  <td className="py-2 px-3 flex items-center gap-2">
                    <img
                      src={def.portrait}
                      alt={def.name}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded object-cover object-top border border-slate-700"
                    />
                    <div>
                      <div className={`font-semibold ${r.isPlayer ? 'text-amber-300' : 'text-white'}`}>
                        {r.name}
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
    <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-[#04060D]/70 p-4">
      <div className="w-full max-w-[780px] rounded-2xl bg-[#0A0E1A] border border-amber-500/35 p-5 flex flex-col gap-4">
        <div className="flex items-baseline justify-between border-b border-slate-800 pb-3">
          <h2 className="font-display text-lg font-extrabold text-white">Cathedral Scoreboard</h2>
          <span className="text-xs font-mono-num text-slate-400">
            Sanctum {hud.blueKills} — {hud.redKills} Invasion · {hud.waveTierName}
          </span>
        </div>
        {renderTeam('Sanctum Defenders (Blue)', 'text-sky-400', blueTeam)}
        {renderTeam('Invasion Vanguard (Red)', 'text-rose-400', redTeam)}
      </div>
    </div>
  );
}

interface PauseModalProps {
  hud: HudSnapshot;
  muted: boolean;
  onResume: () => void;
  onToggleMute: () => void;
  onExitToTitle: () => void;
}

export function PauseModal({
  hud,
  muted,
  onResume,
  onToggleMute,
  onExitToTitle,
}: PauseModalProps) {
  const [copiedInvite, setCopiedInvite] = useState(false);

  const handleCopyInvite = () => {
    if (!hud.network.roomId) return;
    const url = `${window.location.origin}/?room=${encodeURIComponent(hud.network.roomId)}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedInvite(true);
    window.setTimeout(() => setCopiedInvite(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#04060D]/80 p-4">
      <div className="w-full max-w-[440px] rounded-2xl bg-[#0A0E1A] border border-amber-500/35 p-6 flex flex-col gap-5">
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

        <div className="rounded-xl bg-[#070A12] border border-slate-800 p-3.5 text-xs text-slate-300 grid grid-cols-2 gap-y-1.5 gap-x-3">
          <span><strong className="text-white">A / D</strong> Move</span>
          <span><strong className="text-white">W / Space</strong> Jump & Hover</span>
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
            className="w-full py-2.5 px-4 rounded-xl font-display font-bold text-[#070A12] bg-amber-400 hover:bg-amber-300 cursor-pointer"
          >
            Resume Match
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
          <button
            type="button"
            onClick={onToggleMute}
            className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 cursor-pointer"
          >
            {muted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
          </button>
          <button
            type="button"
            onClick={onExitToTitle}
            className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-rose-300 bg-rose-950/40 hover:bg-rose-950/70 border border-rose-800/70 cursor-pointer"
          >
            Leave to Champion Select
          </button>
        </div>
      </div>
    </div>
  );
}

interface EndMatchModalProps {
  hud: HudSnapshot;
  onPlayAgain: () => void;
  onChangeHero: () => void;
}

export function EndMatchModal({ hud, onPlayAgain, onChangeHero }: EndMatchModalProps) {
  const victory = hud.phase === 'VICTORY';
  const m = Math.floor(hud.matchTime / 60);
  const s = Math.floor(hud.matchTime % 60);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#04060D]/84 p-4">
      <div className="w-full max-w-[540px] rounded-2xl bg-[#0A0E1A] border border-amber-500/40 p-6 flex flex-col gap-5">
        <div className="text-center">
          <div
            className={`font-display text-4xl font-extrabold tracking-tight ${
              victory ? 'text-amber-300' : 'text-rose-400'
            }`}
          >
            {victory ? 'VICTORY' : 'DEFEAT'}
          </div>
          <p className="text-sm text-slate-300 mt-1">
            {victory
              ? 'Enemy Ancient Core shattered! Your squad claims the Cathedral Citadel.'
              : 'Your Ancient Core fell. Regroup and counter-build in the Talent Forge.'}
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center rounded-xl bg-[#070A12] border border-slate-800 p-3.5">
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

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onPlayAgain}
            className="flex-1 py-3 px-4 rounded-xl font-display font-extrabold text-[#070A12] bg-amber-400 hover:bg-amber-300 cursor-pointer whitespace-nowrap"
          >
            Play Again
          </button>
          <button
            type="button"
            onClick={onChangeHero}
            className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 cursor-pointer whitespace-nowrap"
          >
            Change Champion
          </button>
        </div>
      </div>
    </div>
  );
}
