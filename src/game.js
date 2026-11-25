// Pure game simulation. No DOM access here, so it runs the same in the
// browser, on an online host, and in Node for tests.
// The whole state is plain JSON so the online host can send it to the guest.

import { LEVELS, TILE, COLS, ROWS, PLAYER_SPAWNS } from './levels.js';

export const W = COLS * TILE; // 512
export const H = ROWS * TILE; // 384

const GRAVITY = 0.35;
const MAX_FALL = 5.5;
const WALK = 1.7;
const JUMP = -7.3;
export const PW = 14, PH = 15; // player box
export const EW = 14, EH = 15; // enemy box
export const BR = 11; // bubble radius
const SHOOT_TICKS = 16;
const SHOOT_SPEED = 5;
const BUBBLE_LIFE = 480;
const TRAP_LIFE = 420;
const HURRY_AT = 30 * 60;
const MAX_BUBBLES = 32;
const START_LIVES = 3;

export const NO_INPUT = Object.freeze({ left: false, right: false, jump: false, fire: false });

export function createGame(playerCount) {
  const st = {
    levelIndex: 0,
    loop: 0,
    tick: 0,
    levelTime: 0,
    phase: 'intro',
    phaseT: 90,
    hurry: false,
    nextId: 1,
    players: [],
    enemies: [],
    bubbles: [],
    fruits: [],
    popups: [],
    events: [],
  };
  for (let i = 0; i < playerCount; i++) {
    st.players.push({
      id: st.nextId++, slot: i, x: 0, y: 0, vx: 0, vy: 0, face: i === 0 ? 1 : -1,
      onGround: false, lives: START_LIVES, score: 0, dead: false, deadT: 0, inv: 0,
      fireCd: 0, blowT: 0, jumpHeld: false, fireHeld: false, out: false, walkT: 0,
    });
  }
  loadLevel(st, 0);
  return st;
}

export function levelOf(st) {
  return LEVELS[st.levelIndex % LEVELS.length];
}

function loadLevel(st, index) {
  st.levelIndex = index;
  st.loop = Math.floor(index / LEVELS.length);
  st.levelTime = 0;
  st.hurry = false;
  st.phase = 'intro';
  st.phaseT = 90;
  st.bubbles = [];
  st.fruits = [];
  st.popups = [];
  const level = levelOf(st);
  st.enemies = level.enemies.map(([type, tx, ty], i) => ({
    id: st.nextId++, type, x: tx * TILE + 1, y: ty * TILE + TILE - EH,
    vx: type === 'wisp' ? (i % 2 ? 1 : -1) : 0, vy: type === 'wisp' ? (i % 3 ? 0.8 : -0.8) : 0,
    face: tx < COLS / 2 ? 1 : -1, onGround: false, angry: false, jumpCd: 60,
  }));
  for (const p of st.players) spawnPlayer(p, 60);
}

function spawnPlayer(p, inv) {
  const s = PLAYER_SPAWNS[p.slot] || PLAYER_SPAWNS[0];
  p.x = s.x; p.y = s.y + TILE - PH;
  p.vx = 0; p.vy = 0; p.dead = false; p.deadT = 0; p.inv = inv;
  p.face = p.slot === 0 ? 1 : -1;
}

// ---------------------------------------------------------------- tiles

function tileAt(level, tx, ty) {
  if (ty < 0 || ty >= ROWS) return '.';
  if (tx < 0 || tx >= COLS) return '#';
  return level.map[ty][tx];
}

// Moves a box with gravity against walls and one-way ledges.
// Returns true if it bumped a wall horizontally.
function moveBody(level, b, w, h, gravity = GRAVITY) {
  let hitWall = false;
  b.x += b.vx;
  const rowTop = Math.floor(Math.max(b.y, 0) / TILE);
  const rowBot = Math.floor(Math.max(b.y + h - 1, 0) / TILE);
  if (b.vx > 0) {
    const tx = Math.floor((b.x + w - 1) / TILE);
    for (let ty = rowTop; ty <= rowBot; ty++) {
      if (tileAt(level, tx, ty) === '#') { b.x = tx * TILE - w; hitWall = true; break; }
    }
  } else if (b.vx < 0) {
    const tx = Math.floor(b.x / TILE);
    for (let ty = rowTop; ty <= rowBot; ty++) {
      if (tileAt(level, tx, ty) === '#') { b.x = (tx + 1) * TILE; hitWall = true; break; }
    }
  }
  // Never leave the arena sideways.
  if (b.x < TILE) { b.x = TILE; hitWall = true; }
  if (b.x > W - TILE - w) { b.x = W - TILE - w; hitWall = true; }

  b.vy = Math.min(b.vy + gravity, MAX_FALL);
  const prevBottom = b.y + h;
  const prevTop = b.y;
  b.y += b.vy;
  b.onGround = false;
  const x0 = Math.floor((b.x + 2) / TILE);
  const x1 = Math.floor((b.x + w - 3) / TILE);
  if (b.vy >= 0) {
    const newBottom = b.y + h;
    const r0 = Math.floor(prevBottom / TILE);
    const r1 = Math.floor(newBottom / TILE);
    outer: for (let r = r0; r <= r1; r++) {
      const top = r * TILE;
      if (prevBottom > top + 0.01 || newBottom < top) continue;
      for (let tx = x0; tx <= x1; tx++) {
        const t = tileAt(level, tx, r);
        if (t === '#' || t === '=') {
          b.y = top - h; b.vy = 0; b.onGround = true;
          break outer;
        }
      }
    }
  } else {
    const r = Math.floor(b.y / TILE);
    if (r >= 0 && Math.floor(prevTop / TILE) !== r) {
      for (let tx = x0; tx <= x1; tx++) {
        if (tileAt(level, tx, r) === '#') { b.y = (r + 1) * TILE; b.vy = 0; break; }
      }
    }
  }
  // Wrap vertically through the floor/ceiling gaps.
  if (b.y > H) b.y = -h + 1;
  else if (b.y < -h - 4) b.y = H - h - 1;
  return hitWall;
}

function overlap(a, aw, ah, b, bw, bh, shrink = 0) {
  return a.x + shrink < b.x + bw - shrink && a.x + aw - shrink > b.x + shrink &&
    a.y + shrink < b.y + bh - shrink && a.y + ah - shrink > b.y + shrink;
}

function boxHitsBubble(x, y, w, h, b, pad = 0) {
  const cx = Math.max(x, Math.min(b.x, x + w));
  const cy = Math.max(y, Math.min(b.y, y + h));
  const dx = b.x - cx, dy = b.y - cy;
  return dx * dx + dy * dy < (BR + pad) * (BR + pad);
}

function emit(st, name) { st.events.push(name); }

function popup(st, x, y, text) {
  st.popups.push({ id: st.nextId++, x, y, text: String(text), t: 50 });
}

// ---------------------------------------------------------------- step

// inputs: array indexed by player slot of {left,right,jump,fire}
export function step(st, inputs) {
  st.tick++;
  const level = levelOf(st);

  if (st.phase === 'gameover') { st.phaseT--; return; }

  if (st.phase === 'intro') {
    st.phaseT--;
    if (st.phaseT <= 0) st.phase = 'play';
  }

  for (const p of st.players) updatePlayer(st, level, p, inputs[p.slot] || NO_INPUT);
  if (st.phase !== 'intro') for (const e of st.enemies) updateEnemy(st, level, e);
  updateBubbles(st, level);
  updateFruits(st, level);
  collide(st);

  st.enemies = st.enemies.filter(e => !e.dead);
  st.bubbles = st.bubbles.filter(b => !b.dead);
  st.fruits = st.fruits.filter(f => !f.dead);
  for (const pu of st.popups) { pu.t--; pu.y -= 0.5; }
  st.popups = st.popups.filter(pu => pu.t > 0);

  if (st.phase === 'play') {
    st.levelTime++;
    if (st.levelTime === HURRY_AT && st.enemies.length) {
      st.hurry = true;
      for (const e of st.enemies) e.angry = true;
      emit(st, 'hurry');
      popup(st, W / 2 - 24, H / 2, 'HURRY!');
    }
    const trappedLeft = st.bubbles.some(b => b.trapped);
    if (!st.enemies.length && !trappedLeft) {
      st.phase = 'clear';
      st.phaseT = 210;
      emit(st, 'clear');
    }
  } else if (st.phase === 'clear') {
    st.phaseT--;
    if (st.phaseT <= 0) loadLevel(st, st.levelIndex + 1);
  }

  if (st.players.every(p => p.out)) {
    st.phase = 'gameover';
    st.phaseT = 300;
    emit(st, 'gameover');
  }
}

function updatePlayer(st, level, p, inp) {
  if (p.out) return;
  if (p.dead) {
    p.deadT--;
    p.vy = Math.min(p.vy + 0.2, 3);
    p.y += p.vy;
    if (p.deadT <= 0) {
      if (p.lives > 0) spawnPlayer(p, 120);
      else p.out = true;
    }
    return;
  }
  if (p.inv > 0) p.inv--;
  if (p.fireCd > 0) p.fireCd--;
  if (p.blowT > 0) p.blowT--;

  const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  p.vx = dir * WALK;
  if (dir) { p.face = dir; p.walkT++; } else p.walkT = 0;

  if (inp.jump && !p.jumpHeld && p.onGround) {
    p.vy = JUMP;
    emit(st, 'jump');
  }
  // Hold jump while falling onto a floating bubble to bounce off it.
  if (inp.jump && p.vy > 0 && !p.onGround) {
    for (const b of st.bubbles) {
      if (b.dead || b.age < SHOOT_TICKS) continue;
      const feet = p.y + PH;
      if (Math.abs(p.x + PW / 2 - b.x) < BR + 3 && feet > b.y - BR - 4 && feet < b.y) {
        p.vy = JUMP * 0.9;
        emit(st, 'boing');
        break;
      }
    }
  }
  p.jumpHeld = inp.jump;

  if (inp.fire && !p.fireHeld && p.fireCd <= 0 && st.bubbles.length < MAX_BUBBLES && st.phase !== 'intro') {
    const bx = p.x + PW / 2 + p.face * 10;
    st.bubbles.push({
      id: st.nextId++, owner: p.slot, x: bx, y: p.y + PH / 2 - 1, vx: p.face * SHOOT_SPEED, vy: 0,
      age: 0, life: BUBBLE_LIFE, trapped: null, dead: false,
    });
    p.fireCd = 14;
    p.blowT = 10;
    emit(st, 'blow');
  }
  p.fireHeld = inp.fire;

  moveBody(level, p, PW, PH);
}

function nearestPlayer(st, e) {
  let best = null, bd = Infinity;
  for (const p of st.players) {
    if (p.out || p.dead) continue;
    const d = Math.abs(p.x - e.x) + Math.abs(p.y - e.y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

function updateEnemy(st, level, e) {
  const speedUp = 1 + Math.min(st.loop, 3) * 0.15;
  const angry = e.angry ? 1.6 : 1;
  if (e.type === 'wisp') {
    const s = 0.9 * angry * speedUp;
    e.x += Math.sign(e.vx || 1) * s;
    e.y += Math.sign(e.vy || 1) * s * 0.75;
    if (e.x < TILE) { e.x = TILE; e.vx = 1; }
    if (e.x > W - TILE - EW) { e.x = W - TILE - EW; e.vx = -1; }
    if (e.y < TILE * 2) { e.y = TILE * 2; e.vy = 1; }
    if (e.y > H - TILE - EH) { e.y = H - TILE - EH; e.vy = -1; }
    e.face = e.vx >= 0 ? 1 : -1;
    return;
  }
  // clank: a wind-up walker
  const target = nearestPlayer(st, e);
  if (e.jumpCd > 0) e.jumpCd--;
  if (e.onGround && target) {
    if (target.y < e.y - 24 && e.jumpCd <= 0 && Math.random() < 0.02) {
      e.vy = JUMP;
      e.jumpCd = 90;
    } else if (Math.abs(target.y - e.y) < 12 && Math.random() < 0.02) {
      e.face = target.x > e.x ? 1 : -1;
    } else if (Math.random() < 0.003) {
      e.face = -e.face;
    }
  }
  e.vx = e.face * 0.95 * angry * speedUp;
  if (moveBody(level, e, EW, EH)) e.face = -e.face;
}

function updateBubbles(st, level) {
  const topY = TILE + BR + 2;
  for (const b of st.bubbles) {
    if (b.dead) continue;
    b.age++;
    if (b.age < SHOOT_TICKS) {
      b.x += b.vx;
      if (b.x - BR < TILE || b.x + BR > W - TILE || tileAt(level, Math.floor((b.x + Math.sign(b.vx) * BR) / TILE), Math.floor(b.y / TILE)) === '#') {
        b.x -= b.vx;
        b.age = SHOOT_TICKS;
      }
      // Trap the first enemy the bubble touches.
      for (const e of st.enemies) {
        if (e.dead) continue;
        if (boxHitsBubble(e.x, e.y, EW, EH, b, 1)) {
          e.dead = true;
          b.trapped = e.type;
          b.angry = e.angry;
          b.life = TRAP_LIFE;
          b.age = SHOOT_TICKS;
          emit(st, 'trap');
          break;
        }
      }
      continue;
    }
    // Floating phase: drift up to the ceiling, then toward the middle.
    if (b.y > topY) b.y -= b.trapped ? 0.5 : 0.65;
    else b.y = topY + Math.sin((st.tick + b.id * 13) / 20) * 1.5;
    const pull = b.y <= topY + 4 ? 0.35 : 0.08;
    const mid = W / 2;
    if (Math.abs(b.x - mid) > 2) b.x += Math.sign(mid - b.x) * pull;
    b.x = Math.max(TILE + BR, Math.min(W - TILE - BR, b.x));
    b.life--;
    if (b.life <= 0) {
      b.dead = true;
      if (b.trapped) {
        st.enemies.push({
          id: st.nextId++, type: b.trapped, x: b.x - EW / 2, y: b.y - EH / 2,
          vx: Math.random() < 0.5 ? -1 : 1, vy: 1, face: 1, onGround: false, angry: true, jumpCd: 30,
        });
        emit(st, 'escape');
      } else {
        emit(st, 'fizz');
      }
    }
  }
  // Bubbles gently push each other apart so a cluster stays readable.
  const bs = st.bubbles;
  for (let i = 0; i < bs.length; i++) {
    for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i], c = bs[j];
      if (a.dead || c.dead || a.age < SHOOT_TICKS || c.age < SHOOT_TICKS) continue;
      const dx = c.x - a.x, dy = c.y - a.y;
      const d2 = dx * dx + dy * dy;
      const min = BR * 2 - 2;
      if (d2 < min * min) {
        const d = Math.sqrt(d2) || 0.01;
        const push = (min - d) * 0.25;
        const nx = d2 ? dx / d : (i % 2 ? 1 : -1);
        a.x -= nx * push; c.x += nx * push;
        if (dy) { a.y -= (dy / d) * push * 0.5; c.y += (dy / d) * push * 0.5; }
      }
    }
  }
}

const FRUIT_KINDS = 6;

function popBubble(st, b, player, combo) {
  if (b.dead) return;
  b.dead = true;
  emit(st, 'pop');
  if (b.trapped) {
    combo.kills++;
    const value = Math.min(500 * 2 ** (combo.kills - 1), 8000);
    player.score += 100;
    st.fruits.push({
      id: st.nextId++, x: b.x - 6, y: b.y - 6, vx: (Math.random() * 2.5 + 1) * (Math.random() < 0.5 ? -1 : 1),
      vy: -5, kind: (st.levelIndex + combo.kills + st.fruits.length) % FRUIT_KINDS, value, t: 0, onGround: false, dead: false,
    });
  } else {
    player.score += 10;
  }
  // Touching bubbles pop together.
  for (const o of st.bubbles) {
    if (o.dead || o.age < SHOOT_TICKS) continue;
    const dx = o.x - b.x, dy = o.y - b.y;
    if (dx * dx + dy * dy < (BR * 2 + 3) ** 2) popBubble(st, o, player, combo);
  }
}

function updateFruits(st, level) {
  for (const f of st.fruits) {
    f.t++;
    if (!f.onGround) {
      if (moveBody(level, f, 12, 12, 0.3)) f.vx = -f.vx;
      if (f.onGround) f.vx = 0;
    }
    if (f.t > 600) f.dead = true;
  }
}

function collide(st) {
  for (const p of st.players) {
    if (p.out || p.dead) continue;
    // Pop bubbles by touching them.
    for (const b of st.bubbles) {
      if (b.dead) continue;
      if (b.age < SHOOT_TICKS) continue;
      if (!boxHitsBubble(p.x, p.y, PW, PH, b, -1)) continue;
      // Landing on top of a bubble while holding jump is a bounce, not a pop.
      if (p.vy < 0 && p.y + PH < b.y) continue;
      const combo = { kills: 0 };
      popBubble(st, b, p, combo);
      if (combo.kills > 1) {
        popup(st, b.x - 20, b.y, `${combo.kills}x COMBO`);
        emit(st, 'combo');
      }
    }
    for (const f of st.fruits) {
      if (f.dead || f.t < 20) continue;
      if (overlap(p, PW, PH, f, 12, 12)) {
        f.dead = true;
        p.score += f.value;
        popup(st, f.x, f.y, f.value);
        emit(st, 'fruit');
      }
    }
    if (p.inv > 0) continue;
    for (const e of st.enemies) {
      if (e.dead) continue;
      if (overlap(p, PW, PH, e, EW, EH, 3)) {
        p.dead = true;
        p.deadT = 90;
        p.vy = -4;
        p.lives--;
        emit(st, 'die');
        break;
      }
    }
  }
}
