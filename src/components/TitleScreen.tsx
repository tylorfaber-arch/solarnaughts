import { useEffect, useMemo, useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { computeHeroStats, HERO_LIST, KEY_ART_URL } from '../game/heroes';
import { buildAbilityTooltip } from '../game/tooltips';
import type { MatchMode, RoomSummary } from '../game/netTypes';
import type { Difficulty, HeroId, Team } from '../game/types';
import { AbilitySvgIcon, RelicCorners, SolarnautsLogo } from './AbilityIcon';
import { AbilityTooltipCard } from './TooltipCard';

interface TitleScreenProps {
  selectedHero: HeroId;
  onSelectHero: (id: HeroId) => void;
  difficulty: Difficulty;
  onSelectDifficulty: (d: Difficulty) => void;
  mode: MatchMode;
  onSelectMode: (m: MatchMode) => void;
  roomCode: string;
  onChangeRoomCode: (code: string) => void;
  playerName: string;
  onChangePlayerName: (name: string) => void;
  teamPref: 'auto' | Team;
  onChangeTeamPref: (team: 'auto' | Team) => void;
  lobbyNotice?: string | null;
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
  mode,
  onSelectMode,
  roomCode,
  onChangeRoomCode,
  playerName,
  onChangePlayerName,
  teamPref,
  onChangeTeamPref,
  lobbyNotice,
  onStartGame,
}: TitleScreenProps) {
  const inviteRoomParam = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const rawRoom = params.get('room');
    const cleanRoom = rawRoom ? rawRoom.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12) : '';
    return cleanRoom.length >= 2 ? cleanRoom : '';
  }, []);

  const [purityFilter, setPurityFilter] = useState<'all' | 'purist' | 'hybrid'>('all');
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  const [hoveredAbility, setHoveredAbility] = useState<{
    slot: 'primary' | 'skill1' | 'skill2';
    rect: DOMRect;
  } | null>(null);

  const handleCopyInvite = () => {
    const clean =
      roomCode
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9-]/g, '')
        .slice(0, 12) || 'SANCTUM-1';
    const url = `${window.location.origin}/?room=${encodeURIComponent(clean)}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedInvite(true);
    window.setTimeout(() => setCopiedInvite(false), 1800);
  };

  const activeHero = HERO_LIST.find((h) => h.id === selectedHero) ?? HERO_LIST[0];
  const activeBaseStats = useMemo(() => computeHeroStats(activeHero.id, {}), [activeHero.id]);
  const signaturePaths = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of activeHero.upgrades) {
      counts.set(u.archetype, (counts.get(u.archetype) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);
  }, [activeHero]);

  const visibleHeroes =
    purityFilter === 'all' ? HERO_LIST : HERO_LIST.filter((h) => h.purity === purityFilter);

  const matchingRoom = rooms.find(
    (r) => r.roomId === (roomCode.trim().toUpperCase() || 'SANCTUM-1')
  );
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
    <div className="relative w-full h-full overflow-hidden bg-[#070910] text-slate-100 flex flex-col justify-between">
      {/* Full-Bleed Medieval-Alien Cathedral Key Art Backdrop */}
      {!imgErrors.keyart ? (
        <img
          src={KEY_ART_URL}
          alt="Shattered cathedral battlements under alien warship invasion"
          referrerPolicy="no-referrer"
          onError={() => setImgErrors((prev) => ({ ...prev, keyart: true }))}
          className="absolute inset-0 w-full h-full object-cover object-right opacity-75"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#070910] via-[#121628] to-[#23182A]" />
      )}

      {/* Measured Contrast Scrims */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#070910] via-[#070910]/90 to-[#070910]/45" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#070910] via-transparent to-[#070910]/55" />

      {/* Main Selection Layout */}
      <div className="relative z-10 flex-1 flex flex-col justify-center px-6 lg:px-12 py-4 max-w-[1440px] w-full mx-auto overflow-y-auto">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <SolarnautsLogo className="w-[310px] sm:w-[375px] h-auto" />
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 pb-1">
            <span>2-Tier Reliquary Towers</span>
            <span aria-hidden="true">·</span>
            <span>4 High-Impact Specializations + Overclock</span>
            <span aria-hidden="true">·</span>
            <span>10–15 Min Matches</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Left Column (8 cols): 8-Champion Roster + Spotlight Dossier */}
          <div className="lg:col-span-8 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-baseline gap-2.5">
                <h2 className="font-display text-lg font-bold text-white">Choose Your Champion</h2>
                <span className="text-xs text-slate-400">
                  10 Unique Heroes · No Duplicates in 3v3
                </span>
              </div>

              {/* Interactive Purist / Hybrid Filter */}
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#090D18] border border-slate-800 text-xs">
                {(
                  [
                    { key: 'all', label: 'All (10)' },
                    { key: 'purist', label: 'Purists (4)' },
                    { key: 'hybrid', label: 'Hybrids (6)' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setPurityFilter(tab.key)}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      purityFilter === tab.key
                        ? 'bg-[#192338] text-amber-300'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 5x2 Portrait Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {visibleHeroes.map((hero) => {
                const isSelected = hero.id === selectedHero;
                const isTaken = mode === 'online' && takenInRoom.has(hero.id);
                return (
                  <button
                    key={hero.id}
                    type="button"
                    onClick={() => onSelectHero(hero.id)}
                    className={`group relative text-left rounded-xl overflow-hidden border transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                      isSelected
                        ? 'border-amber-400/90 bg-[#141B2D] scale-[1.015] shadow-lg shadow-amber-500/15'
                        : 'border-slate-800/90 bg-[#0B101D]/92 hover:border-slate-600'
                    }`}
                  >
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#080B14]">
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
                      <div className="absolute inset-x-0 bottom-0 h-9 bg-gradient-to-t from-[#080B14] to-transparent" />
                      {isTaken && (
                        <div className="absolute inset-x-0 top-0 py-0.5 text-center bg-rose-950/90 border-b border-rose-500/50 text-[10px] font-semibold text-rose-200">
                          In Match
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

            {/* Selected Champion Spotlight Dossier */}
            <div className="relative relic-panel rounded-xl border border-amber-500/25 p-4">
              <RelicCorners color={activeHero.accentColor} />

              <div className="flex flex-col sm:flex-row gap-4 pb-3 border-b border-slate-800/90">
                {/* Large Framed Relic Portrait */}
                <div
                  className="relative w-20 h-24 sm:w-24 sm:h-24 rounded-lg overflow-hidden border shrink-0 bg-[#080B14]"
                  style={{ borderColor: `${activeHero.accentColor}88` }}
                >
                  {!imgErrors[activeHero.id] ? (
                    <img
                      src={activeHero.portrait}
                      alt={activeHero.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-display text-2xl font-extrabold text-amber-400">
                      {activeHero.name.slice(0, 2)}
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-[#080B14] to-transparent" />
                </div>

                {/* Champion Lore, Discipline, Stats & Playstyle Paths */}
                <div className="flex-1 min-w-0 flex flex-col justify-between gap-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
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

                    <div className="text-xs text-slate-300 flex items-center gap-2 font-mono-num">
                      <span style={{ color: activeHero.accentColor }}>
                        {activeHero.mobilityLabel}
                      </span>
                      <span className="text-slate-600" aria-hidden="true">·</span>
                      <span>{activeHero.baseHp} HP</span>
                      <span className="text-slate-600" aria-hidden="true">·</span>
                      <span>{activeHero.baseSpeed} Spd</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300/90 leading-relaxed">
                    {activeHero.craftSummary}
                  </p>

                  {/* Signature Talent Build Paths (Clean unboxed metadata) */}
                  <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-0.5">
                    <span className="font-semibold text-amber-300/90">Build Paths:</span>
                    {signaturePaths.map((pathName, i) => (
                      <span key={pathName} className="inline-flex items-center gap-2">
                        {i > 0 && <span className="text-slate-600" aria-hidden="true">·</span>}
                        <span className="text-slate-200">{pathName}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3 Interactive Ability Cards (Hover for live stat tooltips) */}
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
                        className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border border-slate-700/90 bg-[#0D1424]"
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

          {/* Right Column (4 cols): Match Launch Panel */}
          <div className="relative relic-panel lg:col-span-4 flex flex-col justify-between rounded-xl border border-amber-500/25 p-5 gap-4">
            <RelicCorners />

            <div className="flex flex-col gap-3.5">
              <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#070910] border border-slate-800">
                <button
                  type="button"
                  onClick={() => onSelectMode('online')}
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
                  onClick={() => onSelectMode('solo')}
                  className={`py-2 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    mode === 'solo'
                      ? 'bg-[#192338] text-amber-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Solo vs Bots
                </button>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Two sets of Reliquary Towers per lane defend each Ancient Core. Escalating 6-tier
                creep waves drive every match to a decisive finish.
              </p>

              {lobbyNotice && (
                <div className="px-3 py-2 rounded-lg bg-amber-950/40 border border-amber-400/50 text-xs text-amber-100">
                  {lobbyNotice}
                </div>
              )}

              {mode === 'online' ? (
                <div className="flex flex-col gap-3">
                  {inviteRoomParam && !lobbyNotice && (
                    <div className="px-3 py-2 rounded-lg bg-emerald-950/35 border border-emerald-500/45 text-xs text-emerald-200">
                      Invite active for Room{' '}
                      <strong className="font-mono-num text-amber-300">{inviteRoomParam}</strong>{' '}
                      — choose your Champion and click Enter.
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-slate-400">Callsign</span>
                      <input
                        type="text"
                        maxLength={16}
                        value={playerName}
                        onChange={(e) => onChangePlayerName(e.target.value)}
                        placeholder="Champion"
                        className="rounded-lg bg-[#070910] border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-slate-400">Room Code</span>
                      <input
                        type="text"
                        maxLength={12}
                        value={roomCode}
                        onChange={(e) => onChangeRoomCode(e.target.value.toUpperCase())}
                        placeholder="SANCTUM-1"
                        className="rounded-lg bg-[#070910] border border-slate-700 px-3 py-2 text-sm font-mono-num uppercase text-amber-300 focus:outline-none focus:border-amber-400"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyInvite}
                    className="w-full py-2 px-3 rounded-lg bg-[#101829] hover:bg-[#17233B] border border-amber-500/40 text-xs font-semibold text-amber-200 flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {copiedInvite ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Invite Link Copied — Send to Friend</span>
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
                    <div className="flex items-center gap-1 p-1 rounded-lg bg-[#070910] border border-slate-800">
                      {(['auto', 'blue', 'red'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => onChangeTeamPref(t)}
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
                      <span className="text-[11px] font-mono-num text-slate-500">
                        {rooms.length} active
                      </span>
                    </div>
                    {rooms.length === 0 ? (
                      <div className="text-xs text-slate-500 py-1.5">
                        Click Enter to open{' '}
                        <span className="font-mono-num text-slate-300">
                          {roomCode || 'SANCTUM-1'}
                        </span>{' '}
                        (bots fill empty seats).
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5 max-h-24 overflow-y-auto">
                        {rooms.map((r) => (
                          <button
                            key={r.roomId}
                            type="button"
                            onClick={() => {
                              onChangeRoomCode(r.roomId);
                              handleLaunch(r.roomId);
                            }}
                            className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#070910] border border-slate-800 hover:border-amber-400/60 text-xs transition-colors cursor-pointer"
                          >
                            <span className="font-mono-num font-bold text-amber-300">
                              {r.roomId}
                            </span>
                            <span className="text-slate-400 font-mono-num">
                              {r.humans}/{r.maxHumans} · {Math.floor(r.matchTime / 60)}:
                              {String(r.matchTime % 60).padStart(2, '0')}
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
                  <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-[#070910] border border-slate-800">
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
              className="w-full py-3.5 px-6 rounded-xl font-display text-base font-extrabold tracking-wider text-[#070910] bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer shadow-lg shadow-amber-500/20 whitespace-nowrap"
            >
              {mode === 'online' ? `Enter ${roomCode || 'SANCTUM-1'}` : 'Start Match'}
            </button>
          </div>
        </div>
      </div>

      {/* Single Flat PC Control Bar */}
      <footer className="relative z-10 px-8 py-2.5 border-t border-amber-500/15 bg-[#070910]/92">
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
          <span className="text-slate-500">Press Enter to Join</span>
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
