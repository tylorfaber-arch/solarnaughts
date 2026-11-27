/**
 * Where the game is running: in a normal browser (served by server.ts) or inside the desktop app
 * (Electron, see desktop/). The desktop app serves the game from a local app:// origin, so anything
 * that needs the online server (WebSocket, invite links) asks here instead of using window.location.
 * Plain fetch('/api/...') calls keep working on desktop: the app forwards them to the server.
 */

export interface DesktopBridge {
  /** e.g. "https://solarnaughts.onrender.com" */
  serverOrigin: string;
  platform: 'linux' | 'darwin' | 'win32' | string;
  /** true when launched by Steam on a Steam Deck (gaming mode or desktop mode) */
  steamDeck: boolean;
  toggleFullscreen(): void;
  quit(): void;
}

declare global {
  interface Window {
    solarDesktop?: DesktopBridge;
  }
}

export const desktop: DesktopBridge | null = typeof window !== 'undefined' ? window.solarDesktop ?? null : null;
export const isDesktop = desktop !== null;

/** Origin of the multiplayer server (no trailing slash). */
export function serverOrigin(): string {
  return desktop?.serverOrigin ?? window.location.origin;
}

/** WebSocket endpoint of the multiplayer server. */
export function serverWsUrl(): string {
  const url = new URL(serverOrigin());
  const proto = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${url.host}/ws`;
}

/** Shareable link that opens a room in the browser version. */
export function roomInviteUrl(roomId: string): string {
  return `${serverOrigin()}/?room=${encodeURIComponent(roomId)}`;
}
