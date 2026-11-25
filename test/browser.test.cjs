// Browser smoke test: node test/browser.test.cjs [screenshot-dir]
// Serves the repo through Playwright request routing (no web server needed),
// plays a few seconds of 1P, then hosts and joins an online game between two
// tabs using the ?net=local BroadcastChannel transport.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'http://fizzfern.test';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const shots = process.argv[2];

async function route(ctx) {
  await ctx.route(`${ORIGIN}/**`, r => {
    const p = new URL(r.request().url()).pathname;
    const file = path.join(ROOT, p === '/' ? 'index.html' : p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) return r.fulfill({ status: 404, body: 'nf' });
    r.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
  });
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  await route(ctx);
  const errors = [];
  const watch = (page, who) => page.on('pageerror', e => errors.push(`${who}: ${e.message}`));
  const shot = async (page, name) => shots && page.screenshot({ path: path.join(shots, name) });

  const page = await ctx.newPage();
  watch(page, 'host');
  await page.goto(`${ORIGIN}/?net=local`);
  await page.waitForTimeout(1500);
  await shot(page, 'title.png');

  await page.keyboard.press('Enter'); // 1 PLAYER
  await page.waitForTimeout(1800);
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(300); await page.keyboard.up('ArrowRight');
  for (let i = 0; i < 6; i++) { await page.keyboard.press('KeyX'); await page.waitForTimeout(200); }
  await shot(page, 'solo.png');
  const solo = await page.evaluate(() => {
    const g = window.__fizzfern.game;
    return { scene: window.__fizzfern.scene, phase: g.phase, bubbles: g.bubbles.length, x: g.players[0].x };
  });
  console.log('solo', JSON.stringify(solo));
  if (solo.scene !== 'game' || solo.bubbles === 0) throw new Error('1P game did not run');

  await page.evaluate(() => { window.__fizzfern.scene = 'title'; window.__fizzfern.game = null; window.__fizzfern.menuIndex = 2; });
  await page.keyboard.press('Enter'); // HOST ONLINE GAME
  await page.waitForTimeout(400);
  const invite = await page.inputValue('#host-link');
  console.log('invite', invite);
  await shot(page, 'host-wait.png');

  const guest = await ctx.newPage();
  watch(guest, 'guest');
  await guest.goto(invite);
  await guest.waitForTimeout(2200);
  await guest.keyboard.down('ArrowLeft'); await guest.waitForTimeout(400); await guest.keyboard.up('ArrowLeft');
  await guest.keyboard.press('KeyX');
  await guest.waitForTimeout(400);
  await shot(guest, 'guest.png');
  await shot(page, 'host-game.png');

  const host = await page.evaluate(() => { const a = window.__fizzfern; return { scene: a.scene, mode: a.mode, p2x: a.game.players[1].x, bubbles: a.game.bubbles.map(b => b.owner) }; });
  const g = await guest.evaluate(() => { const a = window.__fizzfern; return { scene: a.scene, mode: a.mode, snap: !!a.snapCur, p2x: a.snapCur && a.snapCur.players[1].x }; });
  console.log('host', JSON.stringify(host));
  console.log('guest', JSON.stringify(g));
  if (host.mode !== 'host' || g.mode !== 'guest' || !g.snap) throw new Error('online session did not connect');
  if (!host.bubbles.includes(1)) throw new Error('guest input did not reach the host');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('browser test passed');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
