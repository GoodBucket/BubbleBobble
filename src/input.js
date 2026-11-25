// Keyboard + Gamepad API (Xbox / standard mapping) input.

const keys = new Set();
// Keys pressed since the last tick, so a very quick tap is never missed.
const tapped = new Set();
const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);

addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement) return;
  keys.add(e.code);
  tapped.add(e.code);
  if (GAME_KEYS.has(e.code)) e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

// Left-hand and right-hand keyboard sets so two people can share a keyboard.
export const KEYSETS = {
  left: { left: ['KeyA'], right: ['KeyD'], jump: ['KeyW'], fire: ['Space', 'KeyF'] },
  right: { left: ['ArrowLeft'], right: ['ArrowRight'], jump: ['ArrowUp'], fire: ['Slash', 'Enter', 'Numpad0', 'ShiftRight'] },
  solo: {
    left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
    jump: ['ArrowUp', 'KeyW', 'KeyZ'], fire: ['KeyX', 'Space', 'KeyF'],
  },
};

const down = list => list.some(k => keys.has(k) || tapped.has(k));

// Call once at the end of every simulation tick.
export function endTick() { tapped.clear(); }

export function connectedPads() {
  const pads = navigator.getGamepads ? [...navigator.getGamepads()] : [];
  return pads.filter(p => p && p.connected);
}

// Standard mapping (Xbox): 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 8 View, 9 Menu, 12-15 d-pad.
function readPad(pad) {
  const b = i => !!(pad.buttons[i] && pad.buttons[i].pressed);
  const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
  return {
    left: ax < -0.4 || b(14),
    right: ax > 0.4 || b(15),
    up: ay < -0.5 || b(12),
    down: ay > 0.5 || b(13),
    jump: b(0),
    fire: b(2) || b(1) || b(5) || b(7),
    confirm: b(0) || b(9),
    cancel: b(1),
    start: b(9),
  };
}

// source: { keys: 'left'|'right'|'solo'|null, pad: number|'any'|null }
export function readPlayer(source) {
  const out = { left: false, right: false, jump: false, fire: false, start: false };
  if (source.keys) {
    const k = KEYSETS[source.keys];
    out.left = down(k.left); out.right = down(k.right);
    out.jump = down(k.jump); out.fire = down(k.fire);
  }
  const pads = connectedPads();
  const list = source.pad === 'any' ? pads : source.pad != null && pads[source.pad] ? [pads[source.pad]] : [];
  for (const pad of list) {
    const p = readPad(pad);
    out.left ||= p.left; out.right ||= p.right; out.jump ||= p.jump; out.fire ||= p.fire; out.start ||= p.start;
  }
  return out;
}

// Menu input from every keyboard key set and every pad, with edge detection.
let prevMenu = {};
export function readMenu() {
  const now = {
    up: down(['ArrowUp', 'KeyW']),
    down: down(['ArrowDown', 'KeyS']),
    confirm: down(['Enter', 'Space', 'KeyZ']),
    cancel: down(['Escape', 'Backspace']),
    pause: down(['Escape', 'KeyP']),
    music: down(['KeyM']),
  };
  for (const pad of connectedPads()) {
    const p = readPad(pad);
    now.up ||= p.up; now.down ||= p.down; now.confirm ||= p.confirm; now.cancel ||= p.cancel; now.pause ||= p.start;
  }
  const pressed = {};
  for (const k in now) pressed[k] = now[k] && !prevMenu[k];
  prevMenu = now;
  return pressed;
}
