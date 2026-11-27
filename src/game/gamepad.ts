/**
 * Controller support (Xbox / PlayStation / Switch Pro / Steam Deck via Steam Input).
 *
 * Uses the browser Gamepad API with the "standard" button layout, which is what Chromium/Electron
 * reports for every common controller and what Steam Input presents on the Steam Deck.
 *
 * Each consumer (gameplay, menu navigation) owns its own PadReader so press edges are never stolen
 * by another reader. `padUi` is the shared switch that says whether the menus own the controller
 * right now (title screen, pause, talent forge, end of match) or the match does.
 */

/** Standard-mapping button indices. */
export const PAD = {
  A: 0, // bottom face  (Cross)
  B: 1, // right face   (Circle)
  X: 2, // left face    (Square)
  Y: 3, // top face     (Triangle)
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  VIEW: 8, // Back / Select / Share
  MENU: 9, // Start / Options
  LS: 10,
  RS: 11,
  UP: 12,
  DOWN: 13,
  LEFT: 14,
  RIGHT: 15,
} as const;

export interface PadFrame {
  /** left stick after radial deadzone, -1..1 */
  lx: number;
  ly: number;
  /** right stick after radial deadzone, -1..1 */
  rx: number;
  ry: number;
  /** analog trigger values 0..1 */
  lt: number;
  rt: number;
  /** buttons held this frame */
  held: boolean[];
  /** buttons that went down since this reader's previous poll */
  pressed: boolean[];
  /** buttons that went up since this reader's previous poll */
  released: boolean[];
  /** any stick, trigger or button moved meaningfully this poll */
  active: boolean;
}

const STICK_DEADZONE = 0.22;
const TRIGGER_ON = 0.3;
const BUTTON_COUNT = 17;

function radial(x: number, y: number): [number, number] {
  const mag = Math.hypot(x, y);
  if (mag < STICK_DEADZONE) return [0, 0];
  const scaled = Math.min(1, (mag - STICK_DEADZONE) / (1 - STICK_DEADZONE));
  return [(x / mag) * scaled, (y / mag) * scaled];
}

/** The controller the player is using: the most recently active connected pad. */
function pickGamepad(): Gamepad | null {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
  let best: Gamepad | null = null;
  for (const gp of navigator.getGamepads()) {
    if (!gp || !gp.connected) continue;
    if (!best || gp.timestamp > best.timestamp) best = gp;
  }
  return best;
}

export function isGamepadConnected(): boolean {
  return pickGamepad() !== null;
}

export class PadReader {
  private prev: boolean[] = new Array(BUTTON_COUNT).fill(false);
  private prevAxes = [0, 0, 0, 0];

  /** Read the controller once. Returns null when none is connected. */
  poll(): PadFrame | null {
    const gp = pickGamepad();
    if (!gp) {
      this.prev.fill(false);
      return null;
    }
    const held: boolean[] = new Array(BUTTON_COUNT).fill(false);
    for (let i = 0; i < BUTTON_COUNT; i++) {
      const b = gp.buttons[i];
      if (!b) continue;
      held[i] = i === PAD.LT || i === PAD.RT ? b.value > TRIGGER_ON || b.pressed : b.pressed;
    }
    const [lx, ly] = radial(gp.axes[0] ?? 0, gp.axes[1] ?? 0);
    const [rx, ry] = radial(gp.axes[2] ?? 0, gp.axes[3] ?? 0);
    const pressed = held.map((h, i) => h && !this.prev[i]);
    const released = held.map((h, i) => !h && this.prev[i]);
    const axes = [lx, ly, rx, ry];
    const active =
      pressed.some(Boolean) || held.some(Boolean) || axes.some((a, i) => Math.abs(a) > 0.3 || Math.abs(a - this.prevAxes[i]) > 0.25);
    this.prev = held;
    this.prevAxes = axes;
    return {
      lx,
      ly,
      rx,
      ry,
      lt: gp.buttons[PAD.LT]?.value ?? 0,
      rt: gp.buttons[PAD.RT]?.value ?? 0,
      held,
      pressed,
      released,
      active,
    };
  }

  /** Forget held state (e.g. when control passes between menus and gameplay) so nothing double-fires. */
  resync(): void {
    const gp = pickGamepad();
    for (let i = 0; i < BUTTON_COUNT; i++) {
      const b = gp?.buttons[i];
      this.prev[i] = !!b && (b.pressed || b.value > TRIGGER_ON);
    }
  }
}

/** Shared controller ownership + "which input did the player touch last" for button prompts. */
type Device = 'keyboard' | 'gamepad';

class PadUi {
  /** true while a menu/overlay is on screen and should receive controller input */
  menuActive = true;
  /** Per-screen controller actions while a menu is active (set by App.tsx). */
  actions: { back?: () => void; start?: () => void; x?: () => void } = {};
  private device: Device = 'keyboard';
  private listeners = new Set<(d: Device) => void>();

  get lastDevice(): Device {
    return this.device;
  }

  setLastDevice(d: Device): void {
    if (d === this.device) return;
    this.device = d;
    document.documentElement.classList.toggle('pad-mode', d === 'gamepad');
    for (const fn of this.listeners) fn(d);
  }

  subscribe(fn: (d: Device) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export const padUi = new PadUi();

if (typeof window !== 'undefined') {
  // Any real keyboard / mouse use switches prompts back to keyboard glyphs.
  const toKeyboard = (e: Event) => {
    if (e.isTrusted) padUi.setLastDevice('keyboard');
  };
  window.addEventListener('keydown', toKeyboard, true);
  window.addEventListener('mousedown', toKeyboard, true);
  window.addEventListener(
    'mousemove',
    (e) => {
      if (e.isTrusted && (Math.abs(e.movementX) > 3 || Math.abs(e.movementY) > 3)) padUi.setLastDevice('keyboard');
    },
    true
  );
}
