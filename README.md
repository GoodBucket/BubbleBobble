# Fizz & Fern

An original single-screen arcade platformer for the browser. Two axolotls, **Fizz** and **Fern**,
blow bubbles to trap wind-up **Clank** beetles and drifting **Wisps**, then pop the bubbles to turn
them into treats. Clear every foe to finish the round.

All characters, art (drawn in code), levels, sounds and music in this repo are original.

## Play

No build step. Serve the folder with any static web server and open it:

```sh
npm start            # or: python3 -m http.server 8080
# then open http://localhost:8080
```

(Opening `index.html` straight from disk won't work, because browsers block ES modules on `file://`.)

It also works as-is on GitHub Pages: Settings → Pages → deploy from the `main` branch root.

## Controls

| | Xbox controller | Keyboard (1 player) |
|---|---|---|
| Move | Left stick / D-pad | ← → or A D |
| Jump | A | ↑, W or Z |
| Blow bubble | X, B, RB or RT | X, Space or F |
| Pause | Menu | Esc |
| Music on/off | | M |

**Same-screen 2 players:** Player 1 uses controller 1 or A/D, W to jump, Space to blow.
Player 2 uses controller 2 or the arrow keys, ↑ to jump, `/` or Enter to blow.

Browsers only reveal a controller after you press one of its buttons while the page is focused.

**Tips:** hold jump while landing on a bubble to bounce off it. Popping a cluster of trapped
bubbles at once scores a combo. Trapped foes break out angry if you leave them too long, and
after 30 seconds the whole round gets angry ("HURRY!").

## Online 2 players

1. Player 1 picks **HOST ONLINE GAME** and gets a 5-letter room code and an invite link.
2. Player 2 opens the link, or picks **JOIN ONLINE GAME** and types the code.

How it works: the host's browser runs the only copy of the game. The guest sends its controller
state to the host about 60 times a second, and the host sends back a snapshot of the game 30 times a
second, which the guest smooths between frames. The connection is a WebRTC data channel set up through
[PeerJS](https://peerjs.com/)'s free public broker, which is only used for the handshake. Gameplay
traffic goes straight between the two browsers.

Known limits of this first version:

- Some strict corporate or mobile networks block direct WebRTC connections. Fixing that needs a TURN
  relay server (for example from a hosting provider), passed into `new Peer(...)` in `src/net.js`.
- The guest sees the game about one snapshot behind the host. That is fine on a normal home
  connection; client-side prediction for the guest would be the next step if it ever feels laggy.

For development, add `?net=local` to the URL to connect two tabs in the same browser over a
`BroadcastChannel` instead of the internet.

## Code map

| File | What it does |
|---|---|
| `src/game.js` | The whole simulation: physics, bubbles, foes, scoring, rounds. Pure JS with JSON state, no DOM. |
| `src/levels.js` | Five hand-made rounds as ASCII maps. |
| `src/render.js` | Canvas drawing for the level, characters, HUD and title screen. |
| `src/input.js` | Keyboard and Gamepad API input. |
| `src/net.js` | Online host/join and snapshot packing. |
| `src/audio.js` | Synthesized sound effects and the music loop. |
| `src/main.js` | Menus, game loop and wiring. |

## Tests

```sh
npm test               # simulation tests in Node
npm run test:browser   # Playwright smoke test: 1P game plus an online host/guest session
```

`test:browser` needs Playwright with Chromium installed (`npm i -D playwright && npx playwright install chromium`).
