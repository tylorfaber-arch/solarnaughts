/**
 * Controller navigation for every React menu (title screen, pause, talent forge, end screen),
 * without per-component code: D-pad / left stick moves a highlight between the buttons on screen
 * (spatially: "the nearest button to the right"), A clicks, B goes back, right stick scrolls.
 *
 * Only runs while padUi.menuActive is true; App.tsx flips it when a menu is up.
 * Mark the button that should be highlighted first with `data-pad-default`.
 * Screens can register back / start / X behaviour through padUi.actions.
 */
import { PAD, PadReader, padUi } from './gamepad';

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const REPEAT_DELAY = 0.34;
const REPEAT_EVERY = 0.11;

let current: HTMLElement | null = null;
let rescanTimer = 0;
let wasActive = false;
let skipFrame = false;
let held: { dir: string; t: number; next: number } | null = null;

function isTextField(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName !== 'INPUT') return false;
  const type = (el as HTMLInputElement).type;
  return !['button', 'submit', 'checkbox', 'radio', 'range', 'color', 'reset'].includes(type);
}

/** The outermost fixed overlay under the screen centre that has buttons (a modal), else the page. */
function activeScope(): HTMLElement {
  let n = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2) as HTMLElement | null;
  let found: HTMLElement | null = null;
  while (n && n !== document.body) {
    if (getComputedStyle(n).position === 'fixed' && n.querySelector(FOCUSABLE)) found = n;
    n = n.parentElement;
  }
  return found ?? document.body;
}

function candidates(): HTMLElement[] {
  const scope = activeScope();
  const out: HTMLElement[] = [];
  for (const el of scope.querySelectorAll<HTMLElement>(FOCUSABLE)) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.pointerEvents === 'none' || Number(cs.opacity) === 0) continue;
    // If it's on screen, make sure nothing is covering it (e.g. a page behind an overlay).
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    if (cx >= 0 && cy >= 0 && cx < window.innerWidth && cy < window.innerHeight) {
      const hit = document.elementFromPoint(cx, cy);
      if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) continue;
    }
    out.push(el);
  }
  return out;
}

function hover(el: HTMLElement | null, on: boolean, related: HTMLElement | null): void {
  if (!el) return;
  // React's onMouseEnter/onMouseLeave listen to mouseover/mouseout, so tooltips appear for the highlight too.
  el.dispatchEvent(new MouseEvent(on ? 'mouseover' : 'mouseout', { bubbles: true, relatedTarget: related }));
}

function setCurrent(el: HTMLElement | null): void {
  if (el === current) return;
  const prev = current;
  if (prev) {
    prev.classList.remove('pad-focus');
    hover(prev, false, el);
    if (document.activeElement === prev) prev.blur();
  }
  current = el;
  if (el) {
    el.classList.add('pad-focus');
    // Text boxes only take focus (and the keyboard) when A is pressed on them.
    if (!isTextField(el)) el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    hover(el, true, prev);
  }
}

function pickDefault(list: HTMLElement[]): HTMLElement | null {
  return list.find((el) => el.hasAttribute('data-pad-default')) ?? list[0] ?? null;
}

function move(dx: number, dy: number): void {
  const list = candidates();
  if (!current || !list.includes(current)) {
    setCurrent(pickDefault(list));
    return;
  }
  const r = current.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of list) {
    if (el === current) continue;
    const c = el.getBoundingClientRect();
    const ex = c.left + c.width / 2;
    const ey = c.top + c.height / 2;
    // distance along the pressed direction (edge to edge) and sideways overlap gap
    let along: number;
    let side: number;
    if (dx !== 0) {
      along = dx > 0 ? c.left - r.right : r.left - c.right;
      // must actually be past the current element's edge, not just its centre (wide buttons)
      if (dx > 0 ? ex < r.right - 4 && c.left < r.right - 8 : ex > r.left + 4 && c.right > r.left + 8) continue;
      side = Math.max(0, Math.max(r.top, c.top) - Math.min(r.bottom, c.bottom));
    } else {
      along = dy > 0 ? c.top - r.bottom : r.top - c.bottom;
      if (dy > 0 ? ey < r.bottom - 4 && c.top < r.bottom - 8 : ey > r.top + 4 && c.bottom > r.top + 8) continue;
      side = Math.max(0, Math.max(r.left, c.left) - Math.min(r.right, c.right));
    }
    // Stay within a cone of the pressed direction: far-off-axis elements aren't "to the right".
    if (side > Math.max(48, Math.max(0, along) * 1.2)) continue;
    const centreOff = dx !== 0 ? Math.abs(ey - cy) : Math.abs(ex - cx);
    const score = Math.max(0, along) + side * 3 + centreOff * 0.35;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  if (best) setCurrent(best);
}

function activate(): void {
  const list = candidates();
  if (!current || !list.includes(current)) {
    setCurrent(pickDefault(list));
    return;
  }
  if (isTextField(current)) {
    // Typing on Steam Deck: Steam + X opens the on-screen keyboard.
    current.focus();
    current.select?.();
    return;
  }
  if (current instanceof HTMLSelectElement) {
    current.selectedIndex = (current.selectedIndex + 1) % Math.max(1, current.options.length);
    current.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  current.click();
}

function back(): void {
  if (isTextField(document.activeElement)) {
    (document.activeElement as HTMLElement).blur();
    return;
  }
  padUi.actions.back?.();
}

function scrollBy(amount: number): void {
  let n: HTMLElement | null = current ?? activeScope();
  while (n && n !== document.body) {
    const cs = getComputedStyle(n);
    if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && n.scrollHeight > n.clientHeight + 2) {
      n.scrollBy({ top: amount });
      return;
    }
    n = n.parentElement;
  }
  document.scrollingElement?.scrollBy({ top: amount });
}

function directionOf(f: { lx: number; ly: number; held: boolean[] }): string | null {
  if (f.held[PAD.UP]) return 'up';
  if (f.held[PAD.DOWN]) return 'down';
  if (f.held[PAD.LEFT]) return 'left';
  if (f.held[PAD.RIGHT]) return 'right';
  if (Math.hypot(f.lx, f.ly) < 0.5) return null;
  if (Math.abs(f.lx) > Math.abs(f.ly)) return f.lx > 0 ? 'right' : 'left';
  return f.ly > 0 ? 'down' : 'up';
}

const DIRS: Record<string, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export function startGamepadMenuNav(): void {
  const reader = new PadReader();
  let last = performance.now();

  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    requestAnimationFrame(frame);

    if (!padUi.menuActive) {
      if (wasActive) {
        setCurrent(null);
        wasActive = false;
      }
      return;
    }
    if (!wasActive) {
      // Control just came back from gameplay: ignore whatever is still held (e.g. the X that opened the forge).
      wasActive = true;
      reader.resync();
      skipFrame = true;
      held = null;
    }
    const f = reader.poll();
    if (!f) return;
    if (skipFrame) {
      skipFrame = false;
      return;
    }
    const wasPad = padUi.lastDevice === 'gamepad';
    if (f.active) padUi.setLastDevice('gamepad');
    if (!wasPad && padUi.lastDevice === 'gamepad') {
      // First touch of the controller just shows where the highlight is.
      setCurrent(pickDefault(candidates()));
      held = directionOf(f) ? { dir: directionOf(f)!, t: 0, next: REPEAT_DELAY } : null;
      return;
    }
    if (padUi.lastDevice !== 'gamepad') {
      if (current) setCurrent(null);
      return;
    }

    // Keep a highlight on screen as menus open, close and re-render.
    rescanTimer -= dt;
    if (rescanTimer <= 0) {
      rescanTimer = 0.15;
      if (!current || !current.isConnected || !candidates().includes(current)) {
        if (current && !current.isConnected) current = null;
        setCurrent(pickDefault(candidates()));
      }
    }

    // While typing in a text box, only B (leave the box) is handled.
    if (isTextField(document.activeElement) && document.activeElement !== current) {
      setCurrent(document.activeElement as HTMLElement);
    }
    const typing = isTextField(document.activeElement);

    if (f.pressed[PAD.B]) back();
    if (typing) return;

    const dir = directionOf(f);
    if (!dir) {
      held = null;
    } else if (!held || held.dir !== dir) {
      held = { dir, t: 0, next: REPEAT_DELAY };
      move(...DIRS[dir]);
    } else {
      held.t += dt;
      if (held.t >= held.next) {
        held.next += REPEAT_EVERY;
        move(...DIRS[dir]);
      }
    }

    if (f.pressed[PAD.A]) activate();
    if (f.pressed[PAD.MENU]) {
      if (padUi.actions.start) padUi.actions.start();
      else candidates().find((el) => el.hasAttribute('data-pad-default'))?.click();
    }
    if (f.pressed[PAD.X]) padUi.actions.x?.();
    if (Math.abs(f.ry) > 0.15) scrollBy(f.ry * 900 * dt);
  };
  requestAnimationFrame(frame);
}
