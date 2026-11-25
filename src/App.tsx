import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { EndMatchModal, PauseModal, ScoreboardOverlay } from './components/MatchOverlays';
import { SkillTreeModal } from './components/SkillTreeModal';
import { TitleScreen } from './components/TitleScreen';
import { gameAudio } from './game/audio';
import { GameEngine, type EngineLaunchConfig } from './game/engine';
import type { MatchMode } from './game/netTypes';
import { ensureArenaArtLoaded } from './game/sprites';
import type { Difficulty, HeroId, HudSnapshot, Team } from './game/types';

function readInitialLobbyFromUrl(): { roomCode: string; teamPref: 'auto' | Team } {
  const params = new URLSearchParams(window.location.search);
  const rawRoom = params.get('room');
  const cleanRoom = rawRoom ? rawRoom.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12) : '';
  const rawTeam = params.get('team');
  const teamPref: 'auto' | Team = rawTeam === 'blue' || rawTeam === 'red' ? rawTeam : 'auto';
  return {
    roomCode: cleanRoom.length >= 2 ? cleanRoom : 'SANCTUM-1',
    teamPref,
  };
}

export default function App() {
  const initialLobby = useRef(readInitialLobbyFromUrl()).current;

  const [selectedHero, setSelectedHero] = useState<HeroId>('marrow');
  const [difficulty, setDifficulty] = useState<Difficulty>('standard');
  const [mode, setMode] = useState<MatchMode>('online');
  const [roomCode, setRoomCode] = useState(initialLobby.roomCode);
  const [playerName, setPlayerName] = useState('Champion');
  const [teamPref, setTeamPref] = useState<'auto' | Team>(initialLobby.teamPref);
  const [lobbyNotice, setLobbyNotice] = useState<string | null>(null);

  const [launchConfig, setLaunchConfig] = useState<EngineLaunchConfig | null>(null);

  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [pauseMenuOpen, setPauseMenuOpen] = useState(false);
  const [tabHeld, setTabHeld] = useState(false);
  const [muted, setMuted] = useState(() => gameAudio.isMuted());
  const [musicMuted, setMusicMuted] = useState(() => gameAudio.isMusicMuted());
  const [connectSlow, setConnectSlow] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // Unlock Web Audio and run Title Screen Cathedral Theme on first user gesture
  useEffect(() => {
    const unlock = () => {
      gameAudio.unlock();
      if (!launchConfig) {
        gameAudio.setMusicMode('menu');
      }
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    if (!launchConfig) {
      gameAudio.setMusicMode('menu');
    }
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [launchConfig]);

  useEffect(() => {
    if (!launchConfig || launchConfig.mode !== 'online' || hud) {
      setConnectSlow(false);
      return;
    }
    const timer = window.setTimeout(() => setConnectSlow(true), 4500);
    return () => window.clearTimeout(timer);
  }, [launchConfig, hud]);

  // Preload & process inked hero/tower/cathedral art while user is on Champion Select
  useEffect(() => {
    ensureArenaArtLoaded();
  }, []);

  const handleReturnToLobby = useCallback((returnedRoomId: string, reason: string) => {
    setShopOpen(false);
    setPauseMenuOpen(false);
    setTabHeld(false);
    setHud(null);
    if (returnedRoomId) {
      setRoomCode(returnedRoomId);
    }
    setLobbyNotice(reason || `Room ${returnedRoomId} ready for re-queue. Pick your Champion!`);
    setLaunchConfig(null);
  }, []);

  // Mount & manage the 60fps GameEngine inside isolated canvas ref
  useEffect(() => {
    if (!launchConfig || !canvasRef.current) return;
    const canvas = canvasRef.current;

    // Backing resolution is managed by the engine every frame (static cap + dynamic resolution),
    // so this only seeds a sensible initial size.
    const resize = () => {
      canvas.width = Math.min(window.innerWidth, 1920);
      canvas.height = Math.min(window.innerHeight, 1080);
    };
    resize();
    window.addEventListener('resize', resize);

    const engine = new GameEngine(
      canvas,
      launchConfig,
      (snapshot) => {
        setHud(snapshot);
      },
      handleReturnToLobby
    );
    engineRef.current = engine;
    engine.start();

    return () => {
      window.removeEventListener('resize', resize);
      engine.destroy();
      engineRef.current = null;
    };
  }, [launchConfig, handleReturnToLobby]);

  // Keep selectedHero synced if server confirms a mid-game hero switch
  useEffect(() => {
    if (hud?.player.heroId && hud.player.heroId !== selectedHero) {
      setSelectedHero(hud.player.heroId);
    }
  }, [hud?.player.heroId, selectedHero]);

  // Global in-match hotkeys (B = Skill Tree, Tab = Scoreboard, Esc = Pause / Close Modal)
  useEffect(() => {
    if (!launchConfig) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        setTabHeld(true);
        return;
      }
      if (e.repeat) return;

      if (e.code === 'KeyB') {
        e.preventDefault();
        setPauseMenuOpen(false);
        setShopOpen((prev) => !prev);
      } else if (e.code === 'Escape') {
        e.preventDefault();
        setShopOpen((wasOpen) => {
          if (wasOpen) return false;
          setPauseMenuOpen((prevPause) => {
            const next = !prevPause;
            engineRef.current?.setPaused(next);
            return next;
          });
          return false;
        });
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        setTabHeld(false);
      }
    };

    const onBlur = () => setTabHeld(false);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [launchConfig]);

  const handleStartGame = useCallback((cfg: EngineLaunchConfig) => {
    setLobbyNotice(null);
    setHud(null);
    setShopOpen(false);
    setPauseMenuOpen(false);
    setTabHeld(false);
    if (cfg.roomId) setRoomCode(cfg.roomId.toUpperCase());
    setLaunchConfig(cfg);
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted(gameAudio.toggleMute());
  }, []);

  const handleToggleMusic = useCallback(() => {
    setMusicMuted(gameAudio.toggleMusicMute());
  }, []);

  const handleTogglePause = useCallback(() => {
    setShopOpen(false);
    setPauseMenuOpen((prev) => {
      const next = !prev;
      engineRef.current?.setPaused(next);
      return next;
    });
  }, []);

  const handleResume = useCallback(() => {
    setPauseMenuOpen(false);
    engineRef.current?.setPaused(false);
  }, []);

  const handleSwitchHero = useCallback((heroId: HeroId) => {
    engineRef.current?.switchPlayerHero(heroId);
    setPauseMenuOpen(false);
    engineRef.current?.setPaused(false);
  }, []);

  const handleExitToTitle = useCallback(() => {
    setShopOpen(false);
    setPauseMenuOpen(false);
    setTabHeld(false);
    setHud(null);
    setLaunchConfig(null);
  }, []);

  const handleRequeueToLobby = useCallback(() => {
    setShopOpen(false);
    setPauseMenuOpen(false);
    setTabHeld(false);
    if (engineRef.current) {
      engineRef.current.requeueToLobby();
    } else {
      handleExitToTitle();
    }
  }, [handleExitToTitle]);

  const handlePlayAgain = useCallback(() => {
    setShopOpen(false);
    setPauseMenuOpen(false);
    engineRef.current?.restartMatch(selectedHero, difficulty);
  }, [selectedHero, difficulty]);

  const handleBuyUpgrade = useCallback((upgradeId: string) => {
    engineRef.current?.purchasePlayerUpgrade(upgradeId);
  }, []);

  const handleRecall = useCallback(() => {
    engineRef.current?.triggerRecall();
  }, []);

  if (!launchConfig) {
    return (
      <TitleScreen
        selectedHero={selectedHero}
        onSelectHero={setSelectedHero}
        difficulty={difficulty}
        onSelectDifficulty={setDifficulty}
        mode={mode}
        onSelectMode={setMode}
        roomCode={roomCode}
        onChangeRoomCode={setRoomCode}
        playerName={playerName}
        onChangePlayerName={setPlayerName}
        teamPref={teamPref}
        onChangeTeamPref={setTeamPref}
        lobbyNotice={lobbyNotice}
        onStartGame={handleStartGame}
      />
    );
  }

  const isFinished = hud?.phase === 'VICTORY' || hud?.phase === 'DEFEAT';
  const endCinematicActive = Boolean(isFinished && hud?.endCinematic?.active);
  const showEndModal = Boolean(isFinished && (!hud?.endCinematic || hud.endCinematic.completed));

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0A101D]">
      {/* Isolated 60fps Game Canvas */}
      <canvas
        ref={canvasRef}
        className={`block w-full h-full ${shopOpen || pauseMenuOpen || isFinished ? 'cursor-default' : 'cursor-none'}`}
      />

      {/* Connecting State for Online Mode */}
      {!hud && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#0A101D]/90">
          <div className="px-6 py-5 rounded-xl bg-[#0D1526] border border-slate-700 text-center max-w-sm">
            <div className="font-display text-lg font-bold text-amber-300">
              {launchConfig.mode === 'online'
                ? `Connecting to Room ${launchConfig.roomId ?? 'SANCTUM-1'}...`
                : 'Preparing Drop Pods...'}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {connectSlow
                ? 'Room WebSocket is taking longer than expected.'
                : 'Syncing 60Hz arena state'}
            </div>
            {connectSlow && launchConfig.mode === 'online' && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleStartGame({
                      mode: 'solo',
                      heroId: launchConfig.heroId,
                      difficulty: launchConfig.difficulty,
                      playerName: launchConfig.playerName,
                    })
                  }
                  className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display text-xs font-bold uppercase tracking-wider cursor-pointer transition"
                >
                  Play Solo Skirmish
                </button>
                <button
                  type="button"
                  onClick={handleExitToTitle}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-display text-xs font-bold uppercase tracking-wider cursor-pointer transition"
                >
                  Back to Lobby
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Perimeter Low-Occlusion HUD (hidden during widescreen Victory/Defeat cinematic) */}
      {hud && !endCinematicActive && !showEndModal && (
        <GameHud
          hud={hud}
          muted={muted}
          musicMuted={musicMuted}
          shopOpen={shopOpen}
          onToggleShop={() => {
            setPauseMenuOpen(false);
            setShopOpen((p) => !p);
          }}
          onToggleMute={handleToggleMute}
          onToggleMusic={handleToggleMusic}
          onTogglePause={handleTogglePause}
          onRecall={handleRecall}
        />
      )}

      {/* Skill Tree Upgrade Shop Modal [B] */}
      {hud && shopOpen && !isFinished && (
        <SkillTreeModal
          hud={hud}
          onBuyUpgrade={handleBuyUpgrade}
          onClose={() => setShopOpen(false)}
        />
      )}

      {/* Hold-Tab Scoreboard */}
      {hud && tabHeld && !shopOpen && !pauseMenuOpen && !isFinished && (
        <ScoreboardOverlay hud={hud} />
      )}

      {/* Pause / Match Menu [Esc] */}
      {hud && pauseMenuOpen && !isFinished && (
        <PauseModal
          hud={hud}
          muted={muted}
          musicMuted={musicMuted}
          onResume={handleResume}
          onSwitchHero={handleSwitchHero}
          onToggleMute={handleToggleMute}
          onToggleMusic={handleToggleMusic}
          onExitToTitle={handleExitToTitle}
        />
      )}

      {/* Victory / Defeat Modal (Reveals after Cinematic Fanfare & Never Auto-Restarts) */}
      {hud && showEndModal && (
        <EndMatchModal
          hud={hud}
          onRequeueToLobby={handleRequeueToLobby}
          onPlayAgain={handlePlayAgain}
          onChangeHero={handleExitToTitle}
        />
      )}
    </div>
  );
}

