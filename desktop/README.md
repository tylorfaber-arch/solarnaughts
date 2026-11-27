# Solarnauts desktop (Windows · macOS · Linux · Steam Deck)

Electron wrapper around the web build. The game itself still lives in `src/`; this folder only
packages it. Online play talks to the multiplayer server (see `DEFAULT_SERVER` in `main.cjs`).

## Run it locally

```bash
npm run desktop          # from the project root: builds the game, opens the desktop app
```

First time only: `cd desktop && npm install`.

## Build installers

```bash
npm run desktop:dist     # from the project root, builds for the OS you're on
```

Output lands in `desktop/release/`:

| OS      | For players / testing         | For Steam (upload the folder) |
|---------|-------------------------------|-------------------------------|
| Linux   | `Solarnauts-x.y.z.AppImage`   | `linux-unpacked/`             |
| Windows | `Solarnauts Setup x.y.z.exe`  | `win-unpacked/`               |
| macOS   | `Solarnauts-x.y.z-universal.dmg` | `mac-universal/`           |

Each OS has to be built on that OS. The **Desktop builds** GitHub Action does all three on every
push to `main` (or by hand from the Actions tab) and attaches them to the run as artifacts.

## Changing the server

- Permanently: edit `DEFAULT_SERVER` in `main.cjs`.
- Per launch: `--server=https://your.host` (Steam → Properties → Launch Options), or the
  `SOLARNAUTS_SERVER` environment variable.

## Controls on a controller

L-stick move · A jump/hover · B or down: drop · R-stick aim (with light aim assist) · RT primary ·
LB/LT skill 1 · RB skill 2 · X talent forge · Y recall · hold View: scoreboard · Start: pause.
Menus: D-pad/L-stick to move, A select, B back, R-stick scroll. Steam Deck: Steam + X opens the
on-screen keyboard for the name / room code boxes.

## Window

Starts windowed (fullscreen on Steam Deck). F11 or Alt+Enter toggles fullscreen; the choice is remembered.

## Before shipping on Steam

- Replace `resources/icon.png` (currently a crop of the title key art), 1024×1024 PNG.
- macOS: sign and notarize (Apple Developer account), otherwise macOS blocks the app.
- Windows: code signing is optional but avoids SmartScreen warnings.
- Steam features (achievements, overlay, lobbies, on-screen keyboard API) need a Steam App ID and
  the `steamworks.js` package. Not added yet.
- Fonts load from Google Fonts; offline players fall back to system fonts. Bundle them before release.
