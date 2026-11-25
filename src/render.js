// Canvas drawing. All art is drawn with shapes at runtime (no sprite files).
// Heroes: Fizz (teal axolotl) and Fern (coral axolotl).
// Foes: Clank (wind-up tin beetle) and Wisp (drifting jelly).

import { TILE, COLS, ROWS } from './levels.js';
import { W, H, PW, PH, EW, EH, BR, levelOf } from './game.js';

export const HEROES = [
  { name: 'FIZZ', body: '#5fd6c8', belly: '#b9f2ea', gill: '#ff7aa8', rim: '#7fffe9' },
  { name: 'FERN', body: '#ff9e7a', belly: '#ffd9c7', gill: '#c86bff', rim: '#ffc27a' },
];

const FONT = '"Press Start 2P", ui-monospace, monospace';

function text(ctx, str, x, y, { size = 8, color = '#fff', align = 'left', shadow = true } = {}) {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  if (shadow) { ctx.fillStyle = '#000'; ctx.fillText(str, x + 1, y + 1); }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function ellipse(ctx, x, y, rx, ry, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------- level

let tileCache = { key: null, canvas: null };

function drawLevel(ctx, st) {
  const level = levelOf(st);
  const key = st.levelIndex % 1000;
  if (tileCache.key !== key) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const pal = level.palette;
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, pal.bg1);
    grad.addColorStop(1, pal.bg2);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    // Soft dotted backdrop.
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = 8; y < H; y += 24) for (let x = (y / 24) % 2 ? 8 : 20; x < W; x += 24) g.fillRect(x, y, 2, 2);
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const t = level.map[ty][tx];
        const x = tx * TILE, y = ty * TILE;
        if (t === '#') {
          g.fillStyle = pal.wallDark;
          g.fillRect(x, y, TILE, TILE);
          g.fillStyle = pal.wall;
          const off = ty % 2 ? 0 : 8;
          g.fillRect(x + 1, y + 1, 14, 6);
          g.fillRect(x + 1 + (off ? 0 : 0), y + 9, 6, 6);
          g.fillRect(x + 9, y + 9, 6, 6);
        } else if (t === '=') {
          g.fillStyle = pal.wallDark;
          g.fillRect(x, y, TILE, TILE);
          g.fillStyle = pal.wall;
          g.fillRect(x, y + 2, TILE, 10);
          g.fillStyle = pal.ledge;
          g.fillRect(x, y, TILE, 3);
          g.fillStyle = pal.wallDark;
          g.fillRect(x + 4, y + 6, 2, 2);
          g.fillRect(x + 11, y + 8, 2, 2);
        }
      }
    }
    tileCache = { key, canvas: c };
  }
  ctx.drawImage(tileCache.canvas, 0, 0);
}

// ---------------------------------------------------------------- characters

export function drawHero(ctx, slot, x, y, face, tick, { walking = false, blowing = false, alpha = 1, scale = 1 } = {}) {
  const c = HEROES[slot] || HEROES[0];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x + PW / 2, y + PH / 2 + 1);
  ctx.scale(face * scale, scale);
  const step = walking ? Math.floor(tick / 6) % 2 : 0;
  const wag = Math.sin(tick / 6) * 0.3;
  // tail
  ctx.save();
  ctx.translate(-6, 2);
  ctx.rotate(wag);
  ellipse(ctx, -3, 0, 5, 2.5, c.body);
  ctx.restore();
  // feet
  ctx.fillStyle = c.body;
  ctx.fillRect(-5, 5 - step, 3, 3);
  ctx.fillRect(2, 5 - (1 - step), 3, 3);
  // body + head
  ellipse(ctx, -1, 2, 7, 4.5, c.body);
  ellipse(ctx, 3, -2, 6.5, 5.5, c.body);
  ellipse(ctx, 3, 1, 4.5, 2.5, c.belly);
  // gills: three frilly stalks behind the head
  ctx.strokeStyle = c.gill;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (const [dy, len] of [[-6, 4], [-3, 5], [0, 4]]) {
    ctx.beginPath();
    ctx.moveTo(-1, dy + 1);
    ctx.lineTo(-1 - len, dy - 1 + Math.sin(tick / 8 + dy) * 0.8);
    ctx.stroke();
  }
  // eye + cheek
  ellipse(ctx, 5.5, -3.5, 2, 2, '#fff');
  ellipse(ctx, 6.2, -3.4, 1.1, 1.3, '#1a1030');
  ellipse(ctx, 6.5, -0.5, 1.4, 0.9, 'rgba(255,120,150,0.6)');
  // mouth
  if (blowing) {
    ellipse(ctx, 9, -0.5, 1.6, 1.6, '#1a1030');
  } else {
    ctx.strokeStyle = '#1a1030';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(7.5, -1.5, 1.6, 0.2, Math.PI * 0.8);
    ctx.stroke();
  }
  ctx.restore();
}

function drawClank(ctx, x, y, face, tick, angry) {
  ctx.save();
  ctx.translate(x + EW / 2, y + EH / 2 + 1);
  ctx.scale(face, 1);
  const shell = angry ? '#ff5a5a' : '#9aa7d8';
  const dark = angry ? '#a52a2a' : '#5b6698';
  const step = Math.floor(tick / 5) % 2;
  // legs
  ctx.fillStyle = '#2b2b3d';
  for (const lx of [-5, 0, 5]) ctx.fillRect(lx - 1, 3 + (((lx / 5) & 1) ^ step), 2, 4);
  // shell dome
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.arc(0, 3, 8, Math.PI, 0); ctx.fill();
  ctx.fillStyle = shell;
  ctx.beginPath(); ctx.arc(0, 3, 6.5, Math.PI, 0); ctx.fill();
  ctx.fillStyle = dark;
  ctx.fillRect(-8, 2, 16, 2);
  for (const rx of [-4, 0, 4]) ctx.fillRect(rx, -2, 1, 1);
  // wind-up key spinning on top
  const k = Math.cos(tick / 4);
  ctx.fillStyle = '#e8c35a';
  ctx.fillRect(-1, -9, 2, 4);
  ctx.fillRect(-4 * Math.abs(k) - 0.5, -11, 8 * Math.abs(k) + 1, 3);
  // face visor
  ellipse(ctx, 6, 1, 3, 2.5, '#2b2b3d');
  ellipse(ctx, 7, 0.5, 1, 1, angry ? '#ffe14a' : '#7fffe9');
  ctx.restore();
}

function drawWisp(ctx, x, y, face, tick, angry) {
  ctx.save();
  ctx.translate(x + EW / 2, y + EH / 2);
  const col = angry ? '#ff6b6b' : '#a78bfa';
  const light = angry ? '#ffc0c0' : '#ddd0ff';
  const bob = Math.sin(tick / 10) * 1.5;
  ctx.translate(0, bob);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(0, -1, 7, Math.PI, 0);
  // wavy skirt
  for (let i = 0; i <= 4; i++) {
    const sx = 7 - i * 3.5;
    ctx.lineTo(sx, 5 + ((i + Math.floor(tick / 8)) % 2 ? 2 : 0));
  }
  ctx.closePath();
  ctx.fill();
  ellipse(ctx, -2, -4, 2.5, 1.5, light);
  const ex = face * 1.5;
  ellipse(ctx, -2.5 + ex, 0, 1.6, 2, '#1a1030');
  ellipse(ctx, 2.5 + ex, 0, 1.6, 2, '#1a1030');
  ctx.restore();
}

function drawEnemy(ctx, e, tick) {
  if (e.type === 'wisp') drawWisp(ctx, e.x, e.y, e.face, tick + e.id * 7, e.angry);
  else drawClank(ctx, e.x, e.y, e.face, tick + e.id * 7, e.angry);
}

function drawBubble(ctx, b, tick) {
  const rim = HEROES[b.owner] ? HEROES[b.owner].rim : '#fff';
  const ending = b.age > 16 && b.life < 120 && Math.floor(tick / 6) % 2;
  const r = b.age < 16 ? BR * (0.5 + b.age / 32) : BR;
  if (b.trapped) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.scale(0.8, 0.8);
    const fake = { type: b.trapped, x: -EW / 2, y: -EH / 2 - 1, face: Math.sin(tick / 30) > 0 ? 1 : -1, id: b.id, angry: b.angry || ending };
    drawEnemy(ctx, fake, tick);
    ctx.restore();
  }
  ctx.fillStyle = b.trapped ? 'rgba(255,255,255,0.12)' : 'rgba(180,255,245,0.18)';
  ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = ending ? '#ff6b6b' : rim;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ellipse(ctx, b.x - r * 0.4, b.y - r * 0.45, r * 0.25, r * 0.18, 'rgba(255,255,255,0.85)');
}

const FRUIT_ART = [
  // plum
  (ctx) => { ellipse(ctx, 6, 7, 5, 5, '#8e44ad'); ellipse(ctx, 4.5, 5, 1.5, 1.2, '#d7a6f0'); ctx.fillStyle = '#3c9b3c'; ctx.fillRect(6, 0, 3, 2); },
  // star cookie
  (ctx) => { ctx.fillStyle = '#e0a458'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 2.8 : 6; ctx.lineTo(6 + Math.cos(a) * r, 6.5 + Math.sin(a) * r); } ctx.fill(); ellipse(ctx, 6, 6.5, 1, 1, '#7b4a1e'); },
  // sugar mushroom
  (ctx) => { ctx.fillStyle = '#fff2d6'; ctx.fillRect(4, 6, 4, 6); ctx.fillStyle = '#ff5d73'; ctx.beginPath(); ctx.arc(6, 6, 6, Math.PI, 0); ctx.fill(); ellipse(ctx, 3.5, 3.5, 1, 1, '#fff'); ellipse(ctx, 8, 2.5, 1, 1, '#fff'); },
  // lemon drop
  (ctx) => { ellipse(ctx, 6, 6.5, 6, 4.5, '#ffe14a'); ellipse(ctx, 4, 5, 1.5, 1, '#fffbe0'); },
  // jelly cube
  (ctx) => { ctx.fillStyle = '#35d07f'; ctx.fillRect(1, 3, 10, 9); ctx.fillStyle = '#a8f5cb'; ctx.fillRect(2, 4, 3, 2); },
  // gem
  (ctx) => { ctx.fillStyle = '#4fc3f7'; ctx.beginPath(); ctx.moveTo(6, 12); ctx.lineTo(0, 4); ctx.lineTo(3, 0); ctx.lineTo(9, 0); ctx.lineTo(12, 4); ctx.fill(); ctx.fillStyle = '#d6f4ff'; ctx.fillRect(3, 2, 3, 2); },
];

function drawFruit(ctx, f, tick) {
  if (f.t > 480 && Math.floor(tick / 4) % 2) return;
  ctx.save();
  ctx.translate(f.x, f.y);
  FRUIT_ART[f.kind % FRUIT_ART.length](ctx);
  ctx.restore();
}

// ---------------------------------------------------------------- frame

export function drawGame(ctx, st, { localSlots = [], netLabel = '' } = {}) {
  const tick = st.tick;
  drawLevel(ctx, st);
  for (const f of st.fruits) drawFruit(ctx, f, tick);
  for (const e of st.enemies) drawEnemy(ctx, e, tick);
  for (const p of st.players) {
    if (p.out) continue;
    if (p.dead) {
      ctx.save();
      ctx.translate(p.x + PW / 2, p.y + PH / 2);
      ctx.rotate(tick / 4);
      ctx.translate(-(p.x + PW / 2), -(p.y + PH / 2));
      drawHero(ctx, p.slot, p.x, p.y, p.face, tick, { alpha: 0.8 });
      ctx.restore();
      continue;
    }
    const flicker = p.inv > 0 && Math.floor(tick / 3) % 2;
    drawHero(ctx, p.slot, p.x, p.y, p.face, tick, { walking: p.walkT > 0 && p.onGround, blowing: p.blowT > 0, alpha: flicker ? 0.35 : 1 });
  }
  for (const b of st.bubbles) drawBubble(ctx, b, tick);
  for (const pu of st.popups) text(ctx, pu.text, pu.x, pu.y, { size: 8, color: '#ffe14a' });

  // HUD on the top wall row
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, TILE);
  st.players.forEach((p, i) => {
    const hero = HEROES[p.slot];
    const x = i === 0 ? 6 : W - 6;
    const align = i === 0 ? 'left' : 'right';
    const you = localSlots.length && localSlots.length < st.players.length && localSlots.includes(p.slot) ? ' (YOU)' : '';
    const label = p.out ? `${hero.name}${you} OUT` : `${hero.name}${you} ${String(p.score).padStart(6, '0')}`;
    text(ctx, label, x, 4, { size: 8, color: hero.rim, align });
    // lives as small hearts under the HUD
    for (let l = 0; l < Math.max(0, p.lives); l++) {
      const hx = i === 0 ? 8 + l * 10 : W - 16 - l * 10;
      ctx.fillStyle = '#ff5d73';
      ctx.beginPath(); ctx.arc(hx + 2, H - 10, 2.2, 0, Math.PI * 2); ctx.arc(hx + 6, H - 10, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(hx, H - 9.5); ctx.lineTo(hx + 4, H - 5); ctx.lineTo(hx + 8, H - 9.5); ctx.fill();
    }
  });
  text(ctx, `ROUND ${st.levelIndex + 1}`, W / 2, 4, { size: 8, align: 'center', color: '#fff' });
  if (netLabel) text(ctx, netLabel, W / 2, H - 12, { size: 6, align: 'center', color: '#9ff' });

  if (st.phase === 'intro') {
    banner(ctx, `ROUND ${st.levelIndex + 1}`, levelOf(st).name.toUpperCase());
  } else if (st.phase === 'clear') {
    banner(ctx, 'ROUND CLEAR!', 'grab the treats');
  } else if (st.phase === 'gameover') {
    banner(ctx, 'GAME OVER', `best ${Math.max(...st.players.map(p => p.score))}`);
  }
  if (st.hurry && st.phase === 'play' && st.levelTime % 60 < 30) text(ctx, 'HURRY!', W / 2, 22, { size: 8, align: 'center', color: '#ff6b6b' });
}

function banner(ctx, title, sub) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, H / 2 - 30, W, 56);
  text(ctx, title, W / 2, H / 2 - 20, { size: 16, align: 'center', color: '#ffe14a' });
  text(ctx, sub, W / 2, H / 2 + 6, { size: 8, align: 'center', color: '#fff' });
}

// ---------------------------------------------------------------- menus

export function drawTitle(ctx, tick, items, selected, info) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#141a3a');
  grad.addColorStop(1, '#3a2160');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // drifting bubbles
  for (let i = 0; i < 14; i++) {
    const x = (i * 71 + Math.sin(tick / 60 + i) * 20) % W;
    const y = H - ((tick * (0.3 + (i % 4) * 0.15) + i * 53) % (H + 40)) + 20;
    ctx.strokeStyle = 'rgba(160,255,240,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, 6 + (i % 3) * 3, 0, Math.PI * 2); ctx.stroke();
  }
  text(ctx, 'FIZZ & FERN', W / 2, 48, { size: 24, align: 'center', color: '#7fffe9' });
  text(ctx, 'a bubble-blowing axolotl adventure', W / 2, 84, { size: 8, align: 'center', color: '#ffc27a' });
  drawHero(ctx, 0, W / 2 - 60, 104, 1, tick, { walking: true, scale: 2 });
  drawHero(ctx, 1, W / 2 + 46, 104, -1, tick + 20, { walking: true, scale: 2 });

  items.forEach((item, i) => {
    const y = 150 + i * 22;
    const sel = i === selected;
    if (sel) {
      ctx.fillStyle = 'rgba(127,255,233,0.15)';
      ctx.fillRect(W / 2 - 150, y - 5, 300, 18);
      text(ctx, '>', W / 2 - 140, y, { size: 8, color: '#ffe14a' });
    }
    text(ctx, item.label, W / 2, y, { size: 8, align: 'center', color: sel ? '#ffe14a' : '#fff' });
  });
  info.forEach((line, i) => text(ctx, line, W / 2, 268 + i * 14, { size: 6, align: 'center', color: '#b8c4ff', shadow: false }));
}

export function drawMessage(ctx, tick, lines) {
  ctx.fillStyle = '#141a3a';
  ctx.fillRect(0, 0, W, H);
  lines.forEach((l, i) => {
    const big = i === 0;
    text(ctx, l, W / 2, 110 + (big ? 0 : 20 + i * 18), { size: big ? 12 : 8, align: 'center', color: big ? '#7fffe9' : '#fff' });
  });
  const dots = '.'.repeat(1 + (Math.floor(tick / 20) % 3));
  text(ctx, dots, W / 2, 300, { size: 8, align: 'center', color: '#ffe14a' });
}
