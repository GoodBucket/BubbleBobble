// Tiny synthesized sound effects and an original chiptune loop (Web Audio, no files).

let ctx = null;
let master = null;
let musicGain = null;
let musicOn = true;
let musicTimer = null;
let nextNoteTime = 0;
let stepIndex = 0;

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = musicOn ? 0.18 : 0;
    musicGain.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function tone(freq, dur, { type = 'square', vol = 0.25, slide = 0, at = 0, dest = null } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(dest || master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, vol = 0.2) {
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  g.gain.value = vol;
  src.buffer = buf;
  src.connect(g).connect(master);
  src.start();
}

const SFX = {
  jump: () => tone(330, 0.12, { slide: 330, vol: 0.12 }),
  blow: () => tone(620, 0.08, { type: 'triangle', slide: -250, vol: 0.2 }),
  trap: () => { tone(520, 0.08, { vol: 0.15 }); tone(780, 0.12, { vol: 0.15, at: 0.07 }); },
  pop: () => { noise(0.06, 0.18); tone(900, 0.05, { type: 'triangle', vol: 0.12 }); },
  fizz: () => noise(0.05, 0.06),
  boing: () => tone(220, 0.15, { type: 'triangle', slide: 440, vol: 0.2 }),
  fruit: () => [0, 4, 7, 12].forEach((n, i) => tone(523 * 2 ** (n / 12), 0.08, { at: i * 0.04, vol: 0.12 })),
  combo: () => [0, 7, 12, 19].forEach((n, i) => tone(440 * 2 ** (n / 12), 0.1, { at: i * 0.05, vol: 0.12 })),
  escape: () => tone(300, 0.25, { type: 'sawtooth', slide: -150, vol: 0.1 }),
  die: () => tone(500, 0.6, { type: 'sawtooth', slide: -420, vol: 0.18 }),
  hurry: () => [0, 0.18, 0.36].forEach(at => tone(880, 0.12, { at, vol: 0.12 })),
  clear: () => [0, 4, 7, 12, 7, 12, 16].forEach((n, i) => tone(392 * 2 ** (n / 12), 0.14, { at: i * 0.09, vol: 0.14 })),
  gameover: () => [12, 7, 3, 0].forEach((n, i) => tone(330 * 2 ** (n / 12), 0.3, { type: 'triangle', at: i * 0.25, vol: 0.2 })),
  select: () => tone(660, 0.06, { vol: 0.12 }),
  move: () => tone(440, 0.04, { vol: 0.08 }),
};

export function playSfx(name) {
  if (SFX[name]) SFX[name]();
}

// ---------------------------------------------------------------- music
// An original 32-step loop in C major. Numbers are semitones above C4; null is a rest.
const LEAD = [
  7, null, 9, 12, null, 9, 7, 4, 5, null, 4, 2, 4, null, null, null,
  7, null, 9, 12, null, 14, 16, 14, 12, null, 9, 7, 9, null, 12, null,
];
const BASS = [0, 0, 7, 7, 5, 5, 7, 7, 0, 0, 7, 7, 5, 5, 2, 7]; // one per two steps, around C3
const STEP = 60 / 150 / 2; // eighth notes at 150 bpm

function scheduleMusic() {
  if (!ctx) return;
  while (nextNoteTime < ctx.currentTime + 0.15) {
    const at = nextNoteTime - ctx.currentTime;
    const n = LEAD[stepIndex % LEAD.length];
    if (n != null) tone(261.6 * 2 ** (n / 12), STEP * 0.9, { type: 'square', vol: 0.12, at, dest: musicGain });
    if (stepIndex % 2 === 0) {
      const b = BASS[(stepIndex / 2) % BASS.length];
      tone(130.8 * 2 ** (b / 12), STEP * 1.6, { type: 'triangle', vol: 0.3, at, dest: musicGain });
    }
    nextNoteTime += STEP;
    stepIndex++;
  }
}

export function startMusic() {
  if (!ctx || musicTimer) return;
  nextNoteTime = ctx.currentTime + 0.05;
  stepIndex = 0;
  musicTimer = setInterval(scheduleMusic, 50);
}

export function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = null;
}

export function toggleMusic() {
  musicOn = !musicOn;
  if (musicGain) musicGain.gain.value = musicOn ? 0.18 : 0;
  return musicOn;
}
