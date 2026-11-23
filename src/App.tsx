import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { EndMatchModal, PauseModal, ScoreboardOverlay } from './components/MatchOverlays';
import { SkillTreeModal } from './components/SkillTreeModal';
import { TitleScreen } from './components/TitleScreen';
import { gameAudio } from './game/audio';
import { GameEngine, type EngineLaunchConfig } from './game/engine';
import type { Difficulty, HeroId, HudSnapshot } from './game/types';

export default function App() {
  const [selectedHero, setSelectedHero] = useState<HeroId>('marrow');
  const [difficulty, setDifficulty] = useState<Difficulty>('standard');
  const [launchConfig, setLaunchConfig] = useState<EngineLaunchConfig | null>(null);

  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [pauseMenuOpen, setPauseMenuOpen] = useState(false);
  const [tabHeld, setTabHeld] = useState(false);
  const [muted, setMuted] = useState(() => gameAudio.isMuted());

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // Mount & manage the 60fps GameEngine inside isolated canvas ref
  useEffect(() => {
    if (!launchConfig || !canvasRef.current) return;
    const canvas = canvasRef.current;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const engine = new GameEngine(canvas, launchConfig, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;
    engine.start();

    return () => {
      window.removeEventListener('resize', resize);
      engine.destroy();
      engineRef.current = null;
    };
  }, [launchConfig]);

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
    setHud(null);
    setShopOpen(false);
    setPauseMenuOpen(false);
    setTabHeld(false);
    setLaunchConfig(cfg);
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted(gameAudio.toggleMute());
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

  const handleExitToTitle = useCallback(() => {
    setShopOpen(false);
    setPauseMenuOpen(false);
    setTabHeld(false);
    setHud(null);
    setLaunchConfig(null);
  }, []);

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
        onStartGame={handleStartGame}
      />
    );
  }

  const isFinished = hud?.phase === 'VICTORY' || hud?.phase === 'DEFEAT';

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
          <div className="px-6 py-4 rounded-xl bg-[#0D1526] border border-slate-700 text-center">
            <div className="font-display text-lg font-bold text-amber-300">
              {launchConfig.mode === 'online'
                ? `Connecting to Room ${launchConfig.roomId ?? 'ALPHA-1'}...`
                : 'Preparing Drop Pods...'}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Syncing 60Hz arena state
            </div>
          </div>
        </div>
      )}

      {/* Perimeter Low-Occlusion HUD */}
      {hud && (
        <GameHud
          hud={hud}
          muted={muted}
          shopOpen={shopOpen}
          onToggleShop={() => {
            setPauseMenuOpen(false);
            setShopOpen((p) => !p);
          }}
          onToggleMute={handleToggleMute}
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
          onResume={handleResume}
          onToggleMute={handleToggleMute}
          onExitToTitle={handleExitToTitle}
        />
      )}

      {/* Victory / Defeat Modal */}
      {hud && isFinished && (
        <EndMatchModal
          hud={hud}
          onPlayAgain={handlePlayAgain}
          onChangeHero={handleExitToTitle}
        />
      )}
    </div>
  );
}
