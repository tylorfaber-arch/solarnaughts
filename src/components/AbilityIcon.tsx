import type { AbilityMeta, UpgradeNode } from '../game/types';

export function RelicCorners({ color = '#D9A441' }: { color?: string }) {
  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1.5 left-1.5 w-2.5 h-2.5 border-t border-l opacity-65"
        style={{ borderColor: color }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1.5 right-1.5 w-2.5 h-2.5 border-t border-r opacity-65"
        style={{ borderColor: color }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-1.5 left-1.5 w-2.5 h-2.5 border-b border-l opacity-65"
        style={{ borderColor: color }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-1.5 right-1.5 w-2.5 h-2.5 border-b border-r opacity-65"
        style={{ borderColor: color }}
      />
    </>
  );
}

export function SolarnautsLogo({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 470 76"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Solarnauts"
    >
      {/* Gothic Astrolabe & Consecrated Alien Reliquary Crest */}
      <g transform="translate(2, 3)">
        <polygon
          points="35,2 66,19 66,52 35,69 4,52 4,19"
          fill="#090D18"
          stroke="url(#crestRim)"
          strokeWidth="2.6"
        />
        <polygon
          points="35,7 60,21 60,50 35,64 10,50 10,21"
          fill="none"
          stroke="rgba(251, 191, 36, 0.28)"
          strokeWidth="1"
        />
        <circle cx="35" cy="35.5" r="20.5" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="4 3.5" />
        {/* Cathedral Spear-Cross & Solar Diamond */}
        <path d="M35 8 L35 63 M14 35.5 L56 35.5" stroke="rgba(251, 191, 36, 0.45)" strokeWidth="1.4" />
        <polygon
          points="35,11 50,35.5 35,60 20,35.5"
          fill="url(#solarWordGrad)"
          stroke="#070910"
          strokeWidth="2.4"
        />
        <polygon points="35,19 42.5,35.5 35,49 27.5,35.5" fill="#FEF9C3" />
      </g>

      {/* Engraved Cathedral Serif Wordmark */}
      <text
        x="84"
        y="47"
        fill="#070910"
        stroke="#070910"
        strokeWidth="8"
        strokeLinejoin="round"
        style={{
          fontFamily: "'Cinzel', Georgia, serif",
          fontWeight: 800,
          fontSize: '42px',
          letterSpacing: '0.04em',
        }}
      >
        SOLARNAUTS
      </text>
      <text
        x="84"
        y="47"
        fill="url(#solarWordGrad)"
        style={{
          fontFamily: "'Cinzel', Georgia, serif",
          fontWeight: 800,
          fontSize: '42px',
          letterSpacing: '0.04em',
        }}
      >
        SOLARNAUTS
      </text>

      {/* Hairline Gilded Rule + Clean Craft Subtitle */}
      <line x1="86" y1="55" x2="438" y2="55" stroke="url(#ruleGrad)" strokeWidth="1.2" />
      <text
        x="86"
        y="69"
        fill="#CBD5E1"
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 500,
          fontSize: '11.5px',
          letterSpacing: '0.08em',
        }}
      >
        Sacred · Primordial · Xeno-Tech Arena
      </text>

      <defs>
        <linearGradient id="solarWordGrad" x1="84" y1="10" x2="84" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FEF3C7" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
        <linearGradient id="crestRim" x1="4" y1="2" x2="66" y2="69" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="55%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>
        <linearGradient id="ruleGrad" x1="86" y1="55" x2="438" y2="55" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.85" />
          <stop offset="50%" stopColor="#38BDF8" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function SolarCrystalIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <polygon points="12,2 21,12 12,22 3,12" fill="#F59E0B" stroke="#07090F" strokeWidth="2" />
      <polygon points="12,5.5 16.5,12 12,17 7.5,12" fill="#FEF08A" />
    </svg>
  );
}

export function AbilitySvgIcon({
  icon,
  className = 'w-5 h-5',
}: {
  icon: AbilityMeta['icon'];
  className?: string;
}) {
  switch (icon) {
    case 'hook':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20l9-9" />
          <path d="M13 11l3-6 5 1-3 5-5 0z" />
          <path d="M17 11l1 5-4 1" />
        </svg>
      );
    case 'rot':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M6 7c-2 2-2 8 0 10M18 7c2 2 2 8 0 10M8 4c2-1 6-1 8 0M8 20c2 1 6 1 8 0" />
        </svg>
      );
    case 'spear':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20L19 5" />
          <path d="M14 4l6 0 0 6-3-3-3-3z" />
        </svg>
      );
    case 'aegis':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l8 4v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7l8-4z" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      );
    case 'vortex':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="2.5" />
          <path d="M12 3a9 9 0 0 1 8.5 6M21 12a9 9 0 0 1-6 8.5M12 21a9 9 0 0 1-8.5-6M3 12a9 9 0 0 1 6-8.5" />
        </svg>
      );
    case 'cloak':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
          <path d="M3 3l18 18" />
        </svg>
      );
    case 'orbital':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v14" />
          <path d="M8 6l4-4 4 4" />
          <ellipse cx="12" cy="18" rx="8" ry="3.5" />
        </svg>
      );
    case 'undead':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="9" r="6" />
          <path d="M9 15v4h6v-4" />
          <circle cx="10" cy="9" r="1" fill="currentColor" />
          <circle cx="14" cy="9" r="1" fill="currentColor" />
        </svg>
      );
    case 'gun':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 10h13l4-2v5l-4-1H9l-2 6H4l1.5-5H3v-3z" />
          <circle cx="19" cy="10" r="1.5" fill="currentColor" />
        </svg>
      );
    case 'dynamite':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="10" width="12" height="7" rx="1.5" transform="rotate(-28 10 13.5)" />
          <path d="M15 8c2-2 4-2 5-4" />
          <path d="M19 3l1.5 1.5M20 7h2M17 2v2" />
        </svg>
      );
    case 'bull':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6c0 4 3 6 8 6s8-2 8-6" />
          <path d="M7 11l2 8h6l2-8" />
          <circle cx="10" cy="14" r="1" fill="currentColor" />
          <circle cx="14" cy="14" r="1" fill="currentColor" />
        </svg>
      );
    case 'burst':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12h6M14 7l6 5-6 5M9 7l5 5-5 5" />
        </svg>
      );
    case 'dash':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2L4 14h7l-1 8 10-12h-7l0-8z" />
        </svg>
      );
    case 'spin':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 8c4-3 12-3 16 0" />
          <path d="M6 13c3-2 9-2 12 0" />
          <path d="M9 18c2-1 4-1 6 0" />
          <path d="M12 4v16" opacity="0.45" />
        </svg>
      );
    case 'mortar':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="10" cy="14" r="6" />
          <path d="M14.5 9.5L19 5" />
          <path d="M17 3h4v4" />
        </svg>
      );
    case 'bite':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7l3 4 3-4 2 4 2-4 3 4 3-4" />
          <path d="M4 17l3-4 3 4 2-4 2 4 3-4 3 4" />
        </svg>
      );
    case 'meltdown':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3" />
        </svg>
      );
    case 'beam':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12h5" />
          <path d="M12 7a5 5 0 0 1 0 10" />
          <path d="M16 4a9 9 0 0 1 0 16" />
        </svg>
      );
    case 'totem':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <rect x="6" y="4" width="12" height="16" rx="3" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      );
    case 'drone':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <circle cx="5" cy="7" r="2.2" />
          <circle cx="19" cy="7" r="2.2" />
          <circle cx="12" cy="19" r="2.2" />
          <path d="M7 8.5l3 2M17 8.5l-3 2M12 15v2" />
        </svg>
      );
    case 'censer':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 3h6M10 3v4l-5 8a4 4 0 0 0 3.4 6h7.2a4 4 0 0 0 3.4-6l-5-8V3" />
          <circle cx="10" cy="15" r="1.2" fill="currentColor" />
          <circle cx="14" cy="17" r="1" fill="currentColor" />
          <path d="M7 13h10" opacity="0.6" />
        </svg>
      );
    case 'contagion':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 2v5M12 17v5M2 12h5M17 12h5M4.9 4.9l3.6 3.6M15.5 15.5l3.6 3.6M19.1 4.9l-3.6 3.6M8.5 15.5l-3.6 3.6" />
          <circle cx="12" cy="3" r="1.3" fill="currentColor" />
          <circle cx="21" cy="12" r="1.3" fill="currentColor" />
          <circle cx="3" cy="12" r="1.3" fill="currentColor" />
        </svg>
      );
    case 'flare':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22M4.8 4.8l2.5 2.5M16.7 16.7l2.5 2.5M19.2 4.8l-2.5 2.5M7.3 16.7l-2.5 2.5" />
        </svg>
      );
    case 'blink':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 17l5-5-5-5" opacity="0.45" />
          <path d="M10 17l5-5-5-5" opacity="0.75" />
          <path d="M16 17l5-5-5-5" />
          <circle cx="19" cy="5" r="1.5" fill="currentColor" />
        </svg>
      );
  }
}

export function UpgradeSvgIcon({
  icon,
  className = 'w-4 h-4',
}: {
  icon: UpgradeNode['icon'];
  className?: string;
}) {
  switch (icon) {
    case 'damage':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
          <path d="M13 19l6-6M16 16l4 4M19 21l2-2" />
        </svg>
      );
    case 'speed':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      );
    case 'burst':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15 9 22 9 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9 9 9 12 2" />
        </svg>
      );
    case 'shield':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l8 4v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7l8-4z" />
        </svg>
      );
    case 'heal':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case 'solar':
      return <SolarCrystalIcon className={className} />;
    case 'cooldown':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case 'range':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
      );
    case 'special':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3z" />
        </svg>
      );
  }
}
