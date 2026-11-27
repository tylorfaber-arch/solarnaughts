/**
 * Solarnauts desktop app (Windows / macOS / Linux / Steam Deck).
 *
 * Serves the Vite build (staged into ./app-dist) from a private app:// origin and points online
 * play at the multiplayer server. Requests to app://…/api/* are forwarded to that server, so the
 * game's fetch('/api/…') calls work unchanged; the WebSocket uses window.solarDesktop.serverOrigin.
 *
 * Multiplayer server, in priority order:
 *   1. --server=https://host   (Steam: Properties → Launch Options)
 *   2. SOLARNAUTS_SERVER env var
 *   3. DEFAULT_SERVER below    ← change this when the game moves to its long-term servers
 */
const { app, BrowserWindow, Menu, ipcMain, net, protocol, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const DEFAULT_SERVER = 'https://solarnaughts.onrender.com';

const APP_SCHEME = 'app';
const APP_HOST = 'solarnauts';
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
const DIST_DIR = path.join(__dirname, 'app-dist');

function resolveServerOrigin() {
  const flag = process.argv.find((a) => a.startsWith('--server='));
  const raw = (flag ? flag.slice('--server='.length) : process.env.SOLARNAUTS_SERVER) || DEFAULT_SERVER;
  try {
    const u = new URL(raw);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.origin;
  } catch {
    // fall through
  }
  console.warn(`[solarnauts] ignoring invalid server "${raw}", using ${DEFAULT_SERVER}`);
  return DEFAULT_SERVER;
}

const SERVER_ORIGIN = resolveServerOrigin();
const IS_STEAM_DECK = process.env.SteamDeck === '1';
const LAUNCHED_BY_STEAM = Boolean(process.env.SteamGameId || process.env.SteamAppId || process.env.SteamEnv);

// --- Chromium switches (must be set before 'ready') ---------------------------------------------
// Games want the GPU even on drivers Chromium is cautious about (common on Linux).
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
// Steam's depot downloads don't keep the setuid bit on chrome-sandbox, and the Steam Linux Runtime
// container blocks the namespace fallback, so the renderer sandbox can't start there. The app only
// ever loads its own bundled files, so it runs without it when Steam launches it on Linux.
if (process.platform === 'linux' && LAUNCHED_BY_STEAM) {
  app.commandLine.appendSwitch('no-sandbox');
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true },
  },
]);

// --- Settings (window mode) ----------------------------------------------------------------------
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
  } catch {
    return {};
  }
}

function saveSettings(patch) {
  try {
    const next = { ...loadSettings(), ...patch };
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), JSON.stringify(next, null, 2));
  } catch (err) {
    console.warn('[solarnauts] could not save settings', err);
  }
}

// --- app:// handler -------------------------------------------------------------------------------
const API_HOP_HEADERS = new Set(['host', 'origin', 'referer', 'connection', 'content-length']);

async function handleAppRequest(request) {
  const url = new URL(request.url);

  // Online services (room list, voice lines…) live on the multiplayer server.
  if (url.pathname.startsWith('/api/')) {
    const headers = {};
    for (const [k, v] of request.headers) if (!API_HOP_HEADERS.has(k.toLowerCase())) headers[k] = v;
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    try {
      return await net.fetch(SERVER_ORIGIN + url.pathname + url.search, {
        method: request.method,
        headers,
        body: hasBody ? Buffer.from(await request.arrayBuffer()) : undefined,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Game server unreachable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // Everything else is a bundled file. Unknown paths fall back to index.html (single-page app).
  let rel;
  try {
    rel = decodeURIComponent(url.pathname);
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  let file = path.normalize(path.join(DIST_DIR, rel));
  if (file !== DIST_DIR && !file.startsWith(DIST_DIR + path.sep)) {
    return new Response('Forbidden', { status: 403 });
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(DIST_DIR, 'index.html');
  }
  return net.fetch(pathToFileURL(file).toString());
}

// --- Window ----------------------------------------------------------------------------------------
let win = null;

function setFullscreen(on) {
  if (!win) return;
  win.setFullScreen(on);
  saveSettings({ fullscreen: on });
}

function createWindow() {
  const settings = loadSettings();
  const startFullscreen = typeof settings.fullscreen === 'boolean' ? settings.fullscreen : IS_STEAM_DECK;

  win = new BrowserWindow({
    title: 'Solarnauts',
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    fullscreen: startFullscreen,
    backgroundColor: '#070910',
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, 'resources', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Music and sound start without waiting for a click (controller players may never click).
      autoplayPolicy: 'no-user-gesture-required',
      // Keep the online simulation and input stream running if the window loses focus.
      backgroundThrottling: false,
      spellcheck: false,
    },
  });

  win.once('ready-to-show', () => win.show());
  win.on('enter-full-screen', () => saveSettings({ fullscreen: true }));
  win.on('leave-full-screen', () => saveSettings({ fullscreen: false }));

  // F11 / Alt+Enter toggle fullscreen everywhere; Cmd+Ctrl+F is handled by macOS itself.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) {
      event.preventDefault();
      setFullscreen(!win.isFullScreen());
    }
  });

  // The game never navigates away; external links open in the system browser.
  win.webContents.on('will-navigate', (event, target) => {
    if (!target.startsWith(APP_ORIGIN + '/')) event.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('closed', () => {
    win = null;
  });

  win.loadURL(`${APP_ORIGIN}/index.html`);
}

// --- IPC (exposed to the game by preload.cjs) -----------------------------------------------------
ipcMain.on('desktop:config', (event) => {
  event.returnValue = {
    serverOrigin: SERVER_ORIGIN,
    platform: process.platform,
    steamDeck: IS_STEAM_DECK,
  };
});
ipcMain.on('desktop:toggle-fullscreen', () => setFullscreen(!(win && win.isFullScreen())));
ipcMain.on('desktop:quit', () => app.quit());

// --- Lifecycle -------------------------------------------------------------------------------------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(() => {
    protocol.handle(APP_SCHEME, handleAppRequest);

    // macOS keeps an app menu (Quit, copy/paste in text boxes); other platforms get none.
    if (process.platform === 'darwin') {
      Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]));
    } else {
      Menu.setApplicationMenu(null);
    }

    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => app.quit());
}
