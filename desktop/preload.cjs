// Exposes a tiny, fixed API to the game page as window.solarDesktop (see src/platform.ts).
const { contextBridge, ipcRenderer } = require('electron');

const config = ipcRenderer.sendSync('desktop:config');

contextBridge.exposeInMainWorld('solarDesktop', {
  serverOrigin: config.serverOrigin,
  platform: config.platform,
  steamDeck: config.steamDeck,
  toggleFullscreen: () => ipcRenderer.send('desktop:toggle-fullscreen'),
  quit: () => ipcRenderer.send('desktop:quit'),
});
