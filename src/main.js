import { createGame, step, W, H, NO_INPUT } from './game.js';
import { readPlayer, readMenu, connectedPads, endTick } from './input.js';
import { drawGame, drawTitle, drawMessage } from './render.js';
import { unlockAudio, playSfx, startMusic, stopMusic, toggleMusic } from './audio.js';
import * as net from './net.js';

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
canvas.width = W;
canvas.height = H;

const overlay = document.getElementById('overlay');
const joinForm = document.getElementById('join-form');
const joinInput = document.getElementById('join-code');
const hostBox = document.getElementById('host-box');
const hostLink = document.getElementById('host-link');
const copyBtn = document.getElementById('copy-link');

addEventListener('keydown', unlockAudio);
addEventListener('pointerdown', unlockAudio);

let best = 0;
try { best = Number(localStorage.getItem('fizzfern.best')) || 0; } catch { /* storage unavailable */ }

const app = {
  scene: 'title',
  menuIndex: 0,
  tick: 0,
  mode: null, // 'solo' | 'local2' | 'host' | 'guest'
  game: null,
  paused: false,
  link: null,
  session: null,
  remoteInput: { ...NO_INPUT },
  pendingEvents: [],
  snapPrev: null,
  snapCur: null,
  snapAt: 0,
  lastSentInput: '',
  message: [],
  roomCode: '',
};

const MENU = [
  { label: '1 PLAYER', action: () => startLocal('solo') },
  { label: '2 PLAYERS - SAME SCREEN', action: () => startLocal('local2') },
  { label: 'HOST ONLINE GAME', action: () => startHost() },
  { label: 'JOIN ONLINE GAME', action: () => showJoin() },
];

// ---------------------------------------------------------------- scenes

function toTitle(msg) {
  stopMusic();
  closeNet();
  hideOverlay();
  app.scene = msg ? 'message' : 'title';
  app.message = msg || [];
  app.game = null;
  app.paused = false;
}

function startLocal(mode) {
  app.mode = mode;
  app.game = createGame(mode === 'solo' ? 1 : 2);
  app.scene = 'game';
  app.paused = false;
  startMusic();
}

function startHost() {
  app.roomCode = net.makeRoomCode();
  app.scene = 'hostwait';
  const url = new URL(location.href);
  url.searchParams.set('join', app.roomCode);
  hostLink.value = url.toString();
  showOverlay(hostBox);
  try {
    app.session = net.host(app.roomCode, link => {
      hideOverlay();
      app.link = link;
      app.mode = 'host';
      app.game = createGame(2);
      app.remoteInput = { ...NO_INPUT };
      app.pendingEvents = [];
      app.scene = 'game';
      link.onData = d => { if (d && d.t === 'i') app.remoteInput = d.i; };
      link.onClose = () => {
        if (app.game) {
          const p2 = app.game.players[1];
          if (p2 && !p2.out) { p2.out = true; app.game.popups.push({ id: -1, x: W / 2 - 60, y: H / 2, text: 'FERN LEFT THE GAME', t: 120 }); }
        }
        app.link = null;
      };
      startMusic();
    }, err => toTitle(['COULD NOT HOST', String(err.message || err), 'press any button']));
  } catch (err) {
    toTitle(['ONLINE PLAY UNAVAILABLE', String(err.message || err), 'press any button']);
  }
}

function showJoin(prefill = '') {
  app.scene = 'joinform';
  joinInput.value = prefill;
  showOverlay(joinForm);
  setTimeout(() => joinInput.focus(), 0);
}

function startJoin(code) {
  code = net.normalizeCode(code);
  if (!code) return;
  hideOverlay();
  app.scene = 'joining';
  app.roomCode = code;
  try {
    app.session = net.join(code, link => {
      app.link = link;
      app.mode = 'guest';
      app.scene = 'game';
      app.snapPrev = app.snapCur = null;
      link.onData = d => {
        if (!d || d.t !== 's') return;
        app.snapPrev = app.snapCur;
        app.snapCur = d.s;
        app.snapAt = performance.now();
        for (const e of d.s.events || []) playSfx(e);
      };
      link.onClose = () => toTitle(['DISCONNECTED', 'the host ended the game', 'press any button']);
      startMusic();
    }, err => toTitle(['COULD NOT JOIN', String(err.message || err), 'press any button']));
  } catch (err) {
    toTitle(['ONLINE PLAY UNAVAILABLE', String(err.message || err), 'press any button']);
  }
}

function closeNet() {
  try { app.link && app.link.close(); } catch { /* already closed */ }
  try { app.session && app.session.close(); } catch { /* already closed */ }
  app.link = null;
  app.session = null;
}

function showOverlay(el) {
  overlay.hidden = false;
  for (const c of overlay.children) c.hidden = c !== el;
}
function hideOverlay() { overlay.hidden = true; }

joinForm.addEventListener('submit', e => { e.preventDefault(); startJoin(joinInput.value); });
document.getElementById('join-cancel').addEventListener('click', () => toTitle());
document.getElementById('host-cancel').addEventListener('click', () => toTitle());
copyBtn.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(hostLink.value); copyBtn.textContent = 'Copied!'; }
  catch { hostLink.select(); copyBtn.textContent = 'Press Ctrl+C'; }
  setTimeout(() => { copyBtn.textContent = 'Copy link'; }, 1500);
});

// ---------------------------------------------------------------- per-tick logic

function localInputs() {
  if (app.mode === 'solo') return [readPlayer({ keys: 'solo', pad: 'any' })];
  if (app.mode === 'local2') return [readPlayer({ keys: 'left', pad: 0 }), readPlayer({ keys: 'right', pad: 1 })];
  return [readPlayer({ keys: 'solo', pad: 'any' })];
}

function update() {
  app.tick++;
  const m = readMenu();
  if (m.music) toggleMusic();

  switch (app.scene) {
    case 'title': {
      if (m.up) { app.menuIndex = (app.menuIndex + MENU.length - 1) % MENU.length; playSfx('move'); }
      if (m.down) { app.menuIndex = (app.menuIndex + 1) % MENU.length; playSfx('move'); }
      if (m.confirm) { playSfx('select'); MENU[app.menuIndex].action(); }
      break;
    }
    case 'message':
      if (app.tick > 30 && (m.confirm || m.cancel)) toTitle();
      break;
    case 'hostwait':
    case 'joining':
      if (m.cancel) toTitle();
      break;
    case 'joinform':
      break;
    case 'game':
      updateGame(m);
      break;
  }
  endTick();
}

function updateGame(m) {
  if (app.mode === 'guest') {
    const i = localInputs()[0];
    const packed = { left: i.left, right: i.right, jump: i.jump, fire: i.fire };
    const key = JSON.stringify(packed);
    if (app.link && (key !== app.lastSentInput || app.tick % 10 === 0)) {
      app.link.send({ t: 'i', i: packed });
      app.lastSentInput = key;
    }
    if (m.cancel) toTitle();
    const s = app.snapCur;
    if (s && s.phase === 'gameover' && s.phaseT <= 5) finishGame(s);
    return;
  }

  const online = app.mode === 'host';
  if (!online && m.pause) app.paused = !app.paused;
  if (app.paused) {
    if (m.cancel && !m.pause) toTitle();
    return;
  }
  if (online && m.cancel) { toTitle(); return; }

  const inputs = localInputs();
  if (online) inputs[1] = app.remoteInput;
  const st = app.game;
  step(st, inputs);
  for (const e of st.events) playSfx(e);
  if (online) {
    app.pendingEvents.push(...st.events);
    if (st.tick % 2 === 0 && app.link) {
      app.link.send({ t: 's', s: net.packState(st, app.pendingEvents) });
      app.pendingEvents = [];
    }
  }
  st.events.length = 0;
  if (st.phase === 'gameover' && st.phaseT <= 0) finishGame(st);
}

function finishGame(st) {
  const top = Math.max(...st.players.map(p => p.score));
  if (top > best) {
    best = top;
    try { localStorage.setItem('fizzfern.best', String(best)); } catch { /* storage unavailable */ }
  }
  toTitle();
}

// ---------------------------------------------------------------- drawing

function padInfo() {
  const pads = connectedPads();
  if (!pads.length) return 'No controller yet: plug in an Xbox pad and press any button';
  return pads.map((p, i) => `Pad ${i + 1}: ${p.id.replace(/\(.*?\)/g, '').trim().slice(0, 30)}`).join('   ');
}

function render() {
  switch (app.scene) {
    case 'title':
    case 'joinform':
      drawTitle(ctx, app.tick, MENU, app.menuIndex, [
        padInfo(),
        'Pad: stick/d-pad move  A jump  X or B blow bubble  Menu pause',
        'Keys 1P: arrows/WASD move  Z/W/Up jump  X/Space bubble',
        'Keys 2P: P1 A D W + Space   P2 arrows + Up + / or Enter',
        `Best ${best}    M toggles music`,
      ]);
      break;
    case 'hostwait':
      drawMessage(ctx, app.tick, ['HOSTING ONLINE GAME', `ROOM CODE  ${app.roomCode}`, 'send the code or link to a friend', 'waiting for them to join']);
      break;
    case 'joining':
      drawMessage(ctx, app.tick, ['JOINING', `ROOM ${app.roomCode}`, 'connecting to host']);
      break;
    case 'message':
      drawMessage(ctx, app.tick, app.message);
      break;
    case 'game':
      if (app.mode === 'guest') {
        if (!app.snapCur) { drawMessage(ctx, app.tick, ['CONNECTED', 'waiting for the first frame']); break; }
        const a = Math.min(1, (performance.now() - app.snapAt) / (1000 / 30));
        drawGame(ctx, net.lerpState(app.snapPrev, app.snapCur, a), { localSlots: [1], netLabel: `ONLINE ROOM ${app.roomCode}` });
      } else {
        drawGame(ctx, app.game, {
          localSlots: app.mode === 'host' ? [0] : [0, 1],
          netLabel: app.mode === 'host' ? (app.link ? `ONLINE ROOM ${app.roomCode}` : 'FRIEND DISCONNECTED') : '',
        });
        if (app.paused) {
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(0, 0, W, H);
          ctx.font = '16px "Press Start 2P", monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#ffe14a';
          ctx.fillText('PAUSED', W / 2, H / 2 - 10);
          ctx.font = '8px "Press Start 2P", monospace';
          ctx.fillStyle = '#fff';
          ctx.fillText('Esc / Menu to resume    Backspace / B to quit', W / 2, H / 2 + 16);
        }
      }
      break;
  }
}

// ---------------------------------------------------------------- loop

const STEP_MS = 1000 / 60;
let last = performance.now();
let acc = 0;
function frame(now) {
  acc += Math.min(250, now - last);
  last = now;
  while (acc >= STEP_MS) { update(); acc -= STEP_MS; }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Shared link: ?join=CODE goes straight to joining.
const joinParam = new URLSearchParams(location.search).get('join');
if (joinParam) startJoin(joinParam);

// Debug hook for automated tests.
window.__fizzfern = app;
