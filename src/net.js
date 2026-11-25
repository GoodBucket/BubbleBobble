// Online two-player transport.
//
// Model: the host's browser runs the only copy of the simulation. The guest sends
// its controller state to the host, and the host streams back game snapshots.
// That keeps both screens in agreement without lockstep determinism.
//
// Transport: WebRTC data channel via PeerJS (its free public broker only does the
// initial handshake; gameplay traffic goes peer-to-peer). For development,
// add ?net=local to the URL to use a BroadcastChannel between two tabs instead.

const ID_PREFIX = 'fizzfern-v1-';
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function makeRoomCode() {
  let s = '';
  for (let i = 0; i < 5; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

export function normalizeCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function useLocal() {
  return new URLSearchParams(location.search).get('net') === 'local';
}

// A connection exposes: send(obj), close(), and the callbacks onData, onClose.
class Link {
  constructor() { this.onData = () => {}; this.onClose = () => {}; this.closed = false; }
}

// ---------------------------------------------------------------- PeerJS

function needPeer() {
  if (typeof window.Peer !== 'function') {
    throw new Error('Online play needs the PeerJS script, which did not load. Check your connection.');
  }
}

export function host(code, onGuest, onError) {
  if (useLocal()) return localHost(code, onGuest);
  needPeer();
  const peer = new window.Peer(ID_PREFIX + code, { debug: 1 });
  peer.on('error', err => onError(err.type === 'unavailable-id' ? new Error('That room code is taken, try again.') : err));
  peer.on('connection', conn => {
    conn.on('open', () => {
      const link = wrapConn(conn);
      onGuest(link);
    });
  });
  return { close: () => peer.destroy() };
}

export function join(code, onOpen, onError) {
  if (useLocal()) return localJoin(code, onOpen);
  needPeer();
  const peer = new window.Peer({ debug: 1 });
  let opened = false;
  const timer = setTimeout(() => { if (!opened) onError(new Error('Could not reach that room. Check the code and that the host is waiting.')); }, 15000);
  peer.on('error', err => onError(err.type === 'peer-unavailable' ? new Error(`No game found with code ${code}.`) : err));
  peer.on('open', () => {
    const conn = peer.connect(ID_PREFIX + code, { reliable: true, serialization: 'json' });
    conn.on('open', () => {
      opened = true;
      clearTimeout(timer);
      onOpen(wrapConn(conn));
    });
  });
  return { close: () => { clearTimeout(timer); peer.destroy(); } };
}

function wrapConn(conn) {
  const link = new Link();
  conn.on('data', d => link.onData(d));
  const closed = () => { if (!link.closed) { link.closed = true; link.onClose(); } };
  conn.on('close', closed);
  conn.on('error', closed);
  link.send = obj => { if (conn.open) conn.send(obj); };
  link.close = () => conn.close();
  return link;
}

// ---------------------------------------------------------------- local test transport

function localLink(chan, me, other) {
  const link = new Link();
  chan.onmessage = e => {
    if (e.data.to !== me) return;
    if (e.data.bye) { link.closed = true; link.onClose(); return; }
    link.onData(e.data.msg);
  };
  link.send = msg => chan.postMessage({ to: other, msg });
  link.close = () => { chan.postMessage({ to: other, bye: true }); chan.close(); };
  return link;
}

function localHost(code, onGuest) {
  const chan = new BroadcastChannel(ID_PREFIX + code);
  chan.onmessage = e => {
    if (e.data.hello) {
      chan.postMessage({ welcome: true });
      onGuest(localLink(chan, 'host', 'guest'));
    }
  };
  return { close: () => chan.close() };
}

function localJoin(code, onOpen) {
  const chan = new BroadcastChannel(ID_PREFIX + code);
  chan.onmessage = e => { if (e.data.welcome) onOpen(localLink(chan, 'guest', 'host')); };
  chan.postMessage({ hello: true });
  return { close: () => chan.close() };
}

// ---------------------------------------------------------------- snapshots

// Round floats so snapshots stay small.
export function packState(st, events) {
  return JSON.parse(JSON.stringify({ ...st, events }, (k, v) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 10) / 10 : v)));
}

// Smooth the guest's view between two 30 Hz snapshots.
export function lerpState(prev, cur, a) {
  if (!prev || prev.levelIndex !== cur.levelIndex) return cur;
  const mix = (listA, listB) => {
    const byId = new Map(listA.map(o => [o.id, o]));
    return listB.map(o => {
      const p = byId.get(o.id);
      if (!p || Math.abs(p.x - o.x) > 40 || Math.abs(p.y - o.y) > 40) return o;
      return { ...o, x: p.x + (o.x - p.x) * a, y: p.y + (o.y - p.y) * a };
    });
  };
  return {
    ...cur,
    players: mix(prev.players, cur.players),
    enemies: mix(prev.enemies, cur.enemies),
    bubbles: mix(prev.bubbles, cur.bubbles),
    fruits: mix(prev.fruits, cur.fruits),
  };
}
