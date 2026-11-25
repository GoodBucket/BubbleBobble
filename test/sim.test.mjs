// Headless checks for the simulation: run with `node test/sim.test.mjs`.
import assert from 'node:assert/strict';
import { LEVELS, COLS, ROWS } from '../src/levels.js';
import { createGame, step, NO_INPUT } from '../src/game.js';

for (const [i, l] of LEVELS.entries()) {
  assert.equal(l.map.length, ROWS, `level ${i} rows`);
  l.map.forEach((r, y) => assert.equal(r.length, COLS, `level ${i} row ${y}: "${r}"`));
}

// Players land on the floor and enemies settle on ledges.
let st = createGame(2);
for (let t = 0; t < 120; t++) step(st, [NO_INPUT, NO_INPUT]);
for (const p of st.players) assert.ok(p.onGround || p.dead, 'player should stand on floor');

// A bubble blown straight at an enemy traps it.
st = createGame(1);
for (let t = 0; t < 100; t++) step(st, [NO_INPUT]);
const p = st.players[0];
st.enemies = [{ id: 999, type: 'clank', x: p.x + 40, y: p.y, vx: 0, vy: 0, face: -1, onGround: true, angry: false, jumpCd: 999 }];
step(st, [{ ...NO_INPUT, fire: true }]);
for (let t = 0; t < 10; t++) step(st, [NO_INPUT]);
assert.equal(st.enemies.length, 0, 'enemy should be trapped');
assert.ok(st.bubbles.some(b => b.trapped === 'clank'), 'trapped bubble exists');

// Popping the trapped bubble drops fruit; with no enemies left the round clears.
const b = st.bubbles.find(b => b.trapped);
b.x = p.x + 7; b.y = p.y + 7;
step(st, [NO_INPUT]);
assert.equal(st.fruits.length, 1, 'fruit dropped');
assert.equal(st.phase, 'clear');
for (let t = 0; t < 400; t++) step(st, [NO_INPUT]);
assert.equal(st.levelIndex, 1, 'advanced to next round');

// Fuzz: random play through every level never throws and stays JSON-safe.
for (let lvl = 0; lvl < LEVELS.length; lvl++) {
  st = createGame(2);
  st.levelIndex = lvl;
  for (let t = 0; t < 6000; t++) {
    const rnd = () => ({ left: Math.random() < 0.3, right: Math.random() < 0.3, jump: Math.random() < 0.2, fire: Math.random() < 0.3 });
    step(st, [rnd(), rnd()]);
    st.events.length = 0;
    for (const e of [...st.players, ...st.enemies]) {
      assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y), 'finite position');
    }
    if (st.phase === 'gameover') break;
  }
  JSON.parse(JSON.stringify(st));
}
console.log('all simulation tests passed');
