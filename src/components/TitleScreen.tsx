import { useEffect, useMemo, useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { computeHeroStats, HERO_LIST, KEY_ART_URL } from '../game/heroes';
import { buildAbilityTooltip } from '../game/tooltips';
import type { MatchMode, RoomSummary } from '../game/netTypes';
import type { Difficulty, HeroId, Team } from '../game/types';
import { AbilitySvgIcon, SolarnautsLogo } from './AbilityIcon';
import { AbilityTooltipCard } from './TooltipCard';

interface TitleScreenProps {
  selectedHero: HeroId;
  onSelectHero: (id: HeroId) => void;
  difficulty: Difficulty;
  onSelectDifficulty: (d: Difficulty) => void;
  onStartGame: (opts: {
    mode: MatchMode;
    heroId: HeroId;
    difficulty: Difficulty;
    roomId?: string;
    playerName?: string;
    preferredTeam?: Team;
  }) => void;
}

export function TitleScreen({
  selectedHero,
  onSelectHero,
  difficulty,
  onSelectDifficulty,
  onStartGame,
}: TitleScreenProps) {
  const initialInvite = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const rawRoom = params.get('room');
    const cleanRoom = rawRoom ? rawRoom.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12) : '';
    const rawTeam = params.get('team');
    const team: 'auto' | Team = rawTeam === 'blue' || rawTeam === 'red' ? rawTeam : 'auto';
    return { room: cleanRoom.length >= 2 ? cleanRoom : '', team };
  }, []);

  const [mode, setMode] = useState<MatchMode>('online');
  const [purityFilter, setPurityFilter] = useState<'all' | 'purist' | 'hybrid'>('all');
  const [roomCode, setRoomCode] = useState(initialInvite.room || 'SANCTUM-1');
  const [playerName, setPlayerName] = useState('Champion');
  const [teamPref, setTeamPref] = useState<'auto' | Team>(initialInvite.team);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  const [hoveredAbility, setHoveredAbility] = useState<{
    slot: 'primary' | 'skill1' | 'skill2';
    rect: DOMRect;
  } | null>(null);

  const handleCopyInvite = () => {
    const clean = roomCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12) || 'SANCTUM-1';
    const url = `${window.location.origin}/?room=${encodeURIComponent(clean)}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedInvite(true);
    window.setTimeout(() => setCopiedInvite(false), 1800);
  };

  const activeHero = HERO_LIST.find((h) => h.id === selectedHero) ?? HERO_LIST[0];
  const activeBaseStats = useMemo(() => computeHeroStats(activeHero.id, {}), [activeHero.id]);
  const visibleHeroes =
    purityFilter === 'all' ? HERO_LIST : HERO_LIST.filter((h) => h.purity === purityFilter);

  const matchingRoom = rooms.find((r) => r.roomId === (roomCode.trim().toUpperCase() || 'SANCTUM-1'));
  const takenInRoom = new Set<HeroId>(matchingRoom?.takenHeroes ?? []);

  useEffect(() => {
    let active = true;
    const fetchRooms = async () => {
      try {
        const res = await fetch('/api/rooms');
        if (!res.ok) return;
        const data = (await res.json()) as { rooms?: RoomSummary[] };
        if (active && Array.isArray(data.rooms)) {
          setRooms(data.rooms);
        }
      } catch {
        // Ignore transient network errors
      }
    };
    fetchRooms();
    const id = window.setInterval(fetchRooms, 3500);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const handleLaunch = (overrideRoom?: string) => {
    onStartGame({
      mode,
      heroId: selectedHero,
      difficulty,
      roomId: overrideRoom ?? (roomCode.trim() || 'SANCTUM-1'),
      playerName: playerName.trim() || 'Champion',
      preferredTeam: teamPref === 'auto' ? undefined : teamPref,
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Enter') {
        e.preventDefault();
        handleLaunch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#070A12] text-slate-100 flex flex-col justify-between">
      {/* Full-Bleed Medieval-Alien Cathedral Key Art Backdrop */}
      {!imgErrors.keyart ? (
        <img
          src={KEY_ART_URL}
          alt="Shattered cathedral battlements under alien warship invasion"
          referrerPolicy="no-referrer"
          onError={() => setImgErrors((prev) => ({ ...prev, keyart: true }))}
          className="absolute inset-0 w-full h-full object-cover object-right opacity-80"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#070A14] via-[#13182A] to-[#23192C]" />
      )}

      {/* High-Contrast Scrim */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#070A12] via-[#070A12]/90 to-[#070A12]/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#070A12]/95 via-transparent to-[#070A12]/45" />

      {/* Main Selection Layout */}
      <div className="relative z-10 flex-1 flex flex-col justify-center px-6 lg:px-12 py-4 max-w-[1440px] w-full mx-auto overflow-y-auto">
        <div className="mb-3.5">
          <SolarnautsLogo className="w-[310px] sm:w-[375px] h-auto" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Left Column (8 cols): 8-Champion Roster + Purist/Hybrid Filter + Kit Breakdown */}
          <div className="lg:col-span-8 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-baseline gap-2.5">
                <h2 className="font-display text-lg font-bold tracking-tight text-white">
                  Choose Your Champion
                </h2>
                <span className="text-xs text-slate-400">
                  8 Unique Heroes · Zero Duplicates in 3v3
                </span>
              </div>

              {/* Interactive Purist / Hybrid Filter */}
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#0A0F1C] border border-slate-800 text-xs">
                {(
                  [
                    { key: 'all', label: 'All (8)' },
                    { key: 'purist', label: 'Purists (4)' },
                    { key: 'hybrid', label: 'Hybrids (4)' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setPurityFilter(tab.key)}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      purityFilter === tab.key
                        ? 'bg-[#1A243B] text-amber-300'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4x2 Portrait Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {visibleHeroes.map((hero) => {
                const isSelected = hero.id === selectedHero;
                const isTaken = mode === 'online' && takenInRoom.has(hero.id);
                return (
                  <button
                    key={hero.id}
                    type="button"
                    onClick={() => onSelectHero(hero.id)}
                    className={`group text-left rounded-xl overflow-hidden border transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                      isSelected
                        ? 'border-amber-400 bg-[#141C2E] scale-[1.015] shadow-lg shadow-amber-500/15'
                        : 'border-slate-800 bg-[#0C1220]/90 hover:border-slate-600'
                    }`}
                  >
                    <div className="relative aspect-[16/11] w-full overflow-hidden bg-[#090D18]">
                      {!imgErrors[hero.id] ? (
                        <img
                          src={hero.portrait}
                          alt={hero.name}
                          referrerPolicy="no-referrer"
                          onError={() => setImgErrors((prev) => ({ ...prev, [hero.id]: true }))}
                          className={`w-full h-full object-cover object-top transition-transform duration-200 group-hover:scale-105 ${
                            isTaken ? 'opacity-45 grayscale' : ''
                          }`}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-display text-xl font-extrabold text-amber-400">
                          {hero.name.slice(0, 2)}
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#090D18] to-transparent" />
                      {isTaken && (
                        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-rose-950/90 border border-rose-500/60 text-[10px] font-bold text-rose-300">
                          IN MATCH
                        </div>
                      )}
                      <div
                        className="absolute bottom-0 inset-x-0 h-[3px]"
                        style={{ backgroundColor: isSelected ? hero.accentColor : 'transparent' }}
                      />
                    </div>
                    <div className="px-2.5 py-1.5">
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="font-display text-xs font-bold text-white truncate">
                          {hero.name}
                        </span>
                        <span
                          className={`text-[10px] font-semibold shrink-0 ${
                            hero.purity === 'purist' ? 'text-amber-300' : 'text-sky-300'
                          }`}
                        >
                          {hero.purity === 'purist' ? 'Purist' : 'Hybrid'}
                        </span>
                      </div>
                      <div className="text-[10.5px] text-slate-400 truncate">{hero.role}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Champion Discipline & Ability Breakdown */}
            <div className="rounded-xl border border-slate-800 bg-[#0B111E]/95 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2.5 border-b border-slate-800/90">
                <div>
                  <div className="flex items-baseline gap-2.5 flex-wrap">
                    <h3 className="font-display text-xl font-extrabold text-white">
                      {activeHero.name}
                    </h3>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: activeHero.purity === 'purist' ? '#FBBF24' : '#38BDF8' }}
                    >
                      {activeHero.disciplineLabel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{activeHero.craftSummary}</p>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <span style={{ color: activeHero.accentColor }}>{activeHero.mobilityLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num text-slate-200">{activeHero.baseHp} HP</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
                {(
                  [
                    { slot: 'primary' as const, ab: activeHero.primary },
                    { slot: 'skill1' as const, ab: activeHero.skill1 },
                    { slot: 'skill2' as const, ab: activeHero.skill2 },
                  ] as const
                ).map(({ slot, ab }) => (
                  <div
                    key={ab.name}
                    onMouseEnter={(e) =>
                      setHoveredAbility({ slot, rect: e.currentTarget.getBoundingClientRect() })
                    }
                    onMouseLeave={() =>
                      setHoveredAbility((prev) => (prev?.slot === slot ? null : prev))
                    }
                    className="flex flex-col gap-1 p-2 -m-2 rounded-lg hover:bg-slate-800/45 transition-colors cursor-help"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border border-slate-700 bg-[#121A2C]"
                        style={{ color: activeHero.accentColor }}
                      >
                        <AbilitySvgIcon icon={ab.icon} className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{ab.name}</div>
                        <div className="text-[11px] font-mono-num text-slate-400">
                          {ab.keyLabel} · {ab.cooldown}s
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-300/90 leading-snug">{ab.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column (4 cols): Match Launch Panel (Online Arena / Solo vs Bots) */}
          <div className="lg:col-span-4 flex flex-col justify-between rounded-xl border border-slate-800 bg-[#0B111E]/95 p-5 gap-4">
            <div className="flex flex-col gap-3.5">
              <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#070A12] border border-slate-800">
                <button
                  type="button"
                  onClick={() => setMode('online')}
                  className={`py-2 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    mode === 'online'
                      ? 'bg-[#192338] text-amber-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Online Arena (3v3)
                </button>
                <button
                  type="button"
                  onClick={() => setMode('solo')}
                  className={`py-2 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    mode === 'solo'
                      ? 'bg-[#192338] text-amber-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Solo vs Bots
                </button>
              </div>

              <div className="text-xs text-slate-400 leading-relaxed">
                2-tier Reliquary Towers per lane guarding the Ancient Core. Escalating 6-tier creep waves push toward a decisive 15–20 minute finish.
              </div>

              {mode === 'online' ? (
                <div className="flex flex-col gap-3">
                  {initialInvite.room && (
                    <div className="px-3 py-2 rounded-lg bg-emerald-950/35 border border-emerald-500/45 text-xs text-emerald-200">
                      Invite detected for Room <strong className="font-mono-num text-amber-300">{initialInvite.room}</strong> — pick your Champion & side, then click Enter.
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-slate-400">Callsign</span>
                      <input
                        type="text"
                        maxLength={16}
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        placeholder="Champion"
                        className="rounded-lg bg-[#070A12] border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-slate-400">Room Code</span>
                      <input
                        type="text"
                        maxLength={12}
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                        placeholder="SANCTUM-1"
                        className="rounded-lg bg-[#070A12] border border-slate-700 px-3 py-2 text-sm font-mono-num uppercase text-amber-300 focus:outline-none focus:border-amber-400"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyInvite}
                    className="w-full py-2 px-3 rounded-lg bg-[#11192B] hover:bg-[#172238] border border-amber-500/40 text-xs font-semibold text-amber-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    {copiedInvite ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Invite Link Copied — Send to Friend!</span>
                      </>
                    ) : (
                      <>
                        <Link2 className="w-3.5 h-3.5 text-amber-300" />
                        <span>Copy Friend Invite Link ({roomCode.trim() || 'SANCTUM-1'})</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-400">Faction Side</span>
                    <div className="flex items-center gap-1 p-1 rounded-lg bg-[#070A12] border border-slate-800">
                      {(['auto', 'blue', 'red'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTeamPref(t)}
                          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                            teamPref === t
                              ? t === 'blue'
                                ? 'bg-sky-500/25 text-sky-300'
                                : t === 'red'
                                  ? 'bg-rose-500/25 text-rose-300'
                                  : 'bg-[#192338] text-white'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {t === 'auto' ? 'Auto' : t === 'blue' ? 'Sanctum' : 'Invasion'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Active Live Rooms */}
                  <div className="border-t border-slate-800 pt-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-slate-400">Live Rooms</span>
                      <span className="text-[11px] font-mono-num text-slate-500">{rooms.length} active</span>
                    </div>
                    {rooms.length === 0 ? (
                      <div className="text-xs text-slate-500 py-1.5">
                        Launch to open <span className="font-mono-num text-slate-300">{roomCode || 'SANCTUM-1'}</span> (60Hz WebSocket, bots fill empty seats).
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5 max-h-24 overflow-y-auto">
                        {rooms.map((r) => (
                          <button
                            key={r.roomId}
                            type="button"
                            onClick={() => {
                              setRoomCode(r.roomId);
                              handleLaunch(r.roomId);
                            }}
                            className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#070A12] border border-slate-800 hover:border-amber-400/60 text-xs transition-colors cursor-pointer"
                          >
                            <span className="font-mono-num font-bold text-amber-300">{r.roomId}</span>
                            <span className="text-slate-400 font-mono-num">
                              {r.humans}/{r.maxHumans} · {Math.floor(r.matchTime / 60)}:{String(r.matchTime % 60).padStart(2, '0')}
                            </span>
                            <span className="text-sky-300 font-semibold">Join</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-slate-400">Bot Difficulty</span>
                  <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-[#070A12] border border-slate-800">
                    {(['casual', 'standard', 'veteran'] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => onSelectDifficulty(d)}
                        className={`py-2 px-2 rounded-md text-xs font-semibold capitalize transition-colors cursor-pointer ${
                          difficulty === d
                            ? 'bg-[#192338] text-amber-300'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleLaunch()}
              className="w-full py-3.5 px-6 rounded-xl font-display text-base font-extrabold tracking-wide text-[#070A12] bg-gradient-to-r from-amber-400 via-amber-300 to-orange-400 hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer shadow-lg shadow-amber-500/20 whitespace-nowrap"
            >
              {mode === 'online' ? `Enter ${roomCode || 'SANCTUM-1'}` : 'Enter Cathedral Arena'}
            </button>
          </div>
        </div>
      </div>

      {/* Single Flat PC Control Bar */}
      <footer className="relative z-10 px-8 py-2.5 border-t border-slate-800/70 bg-[#070A12]/90">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span>
            <strong className="text-slate-200">A/D</strong> Move ·{' '}
            <strong className="text-slate-200">W/Space</strong> Jump/Hover ·{' '}
            <strong className="text-slate-200">S</strong> Drop ·{' '}
            <strong className="text-slate-200">LMB</strong> Primary ·{' '}
            <strong className="text-slate-200">Q/RMB</strong> Skill 1 ·{' '}
            <strong className="text-slate-200">E/Shift</strong> Skill 2 ·{' '}
            <strong className="text-slate-200">B</strong> Talent Forge ·{' '}
            <strong className="text-slate-200">R</strong> Recall ·{' '}
            <strong className="text-slate-200">Tab</strong> Stats
          </span>
          <span className="text-slate-500">Press Enter to Deploy</span>
        </div>
      </footer>
      {/* Viewport-clamped Ability Tooltip on Champion Select */}
      {hoveredAbility && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: `${Math.max(
              12,
              Math.min(
                window.innerWidth - 322,
                hoveredAbility.rect.left + hoveredAbility.rect.width / 2 - 155
              )
            )}px`,
            top: `${Math.max(12, hoveredAbility.rect.top - 255)}px`,
          }}
        >
          <AbilityTooltipCard
            mode="select"
            data={buildAbilityTooltip(activeHero.id, hoveredAbility.slot, activeBaseStats, {})}
          />
        </div>
      )}
    </div>
  );
}
