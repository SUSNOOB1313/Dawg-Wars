# 🐕 Dawg Wars — Ghost Town Shotgun Showdown

A free-for-all 3D shotgun battle royale. You're a dog with a pump shotgun and a
seriously springy set of legs, dropped into a western ghost town with 15 outlaw
dogs. They're armed the same as you, and they're not just after you — they'll
gun each other down too. Be the last dog standing.

Runs entirely in the browser — desktop and mobile, nothing to install.

## Play

```bash
npm install
npm run dev
```

Open the printed local URL on your computer, or on your phone (same Wi-Fi,
use `npm run dev -- --host` to expose it on your LAN).

Build a static production bundle with `npm run build` (outputs to `dist/`,
deployable to any static host — Netlify, Vercel, GitHub Pages, S3, etc.) and
preview it locally with `npm run preview`.

## Controls

**Desktop**
- `W` / `S` — walk forward / back
- `A` / `D` — turn left / right (tank-style; there's no strafe, turning *is*
  aiming since the shotgun always points where you're facing)
- `Space` — bounce (dogs jump *high*)
- Left click (hold or tap) — fire

**Mobile / touch**
- Left thumb-stick — push up/down to walk, left/right to turn
- `JUMP` button — bounce
- `FIRE` button — shoot

Touch controls appear automatically on touch/coarse-pointer devices; keyboard
controls are used everywhere else.

## The rules

- 16 dogs enter (you + 15 bots), all free-for-all — nobody is on your team.
- Everyone carries a pump shotgun that takes **1.5 seconds** to reload after
  every shot. Everyone can take **6 hits** before going down — any blast that
  lands at least one pellet costs exactly one hit, shown as 6 HP pips, so it's
  always predictable regardless of range or spread.
- Every landed hit sends the target flying backward with real knockback —
  stacking hits from multiple attackers launches you even further.
- Jumping is exaggerated — dogs bounce *really* high, useful for dodging or
  just being a good dog.
- A bot notices anyone who comes within **20m**. If it's not already fighting,
  it'll turn and engage. If it's already in a fight, a new arrival only draws
  its attention if the bot actually turns enough to see them — so you can
  sometimes slip past a duel in progress, or get caught in the crossfire if
  you wander into view.
- When a bot is fighting multiple threats, it keeps tabs on all of them and
  targets whichever is currently closest/most dangerous.
- Placement is decided by survival order among all 16 combatants: last one
  standing is 1st place, first one eliminated is last place.
- Coins are awarded at the end of every match based on placement:
  - 🥇 1st place — **+15 coins**
  - 🥈 2nd place — **+10 coins**
  - 🥉 3rd place — **+5 coins**
  - 💀 Last place — **−1 coin**
  - Everywhere in between — no change
  - Your coin balance persists in the browser (`localStorage`) and **can go
    negative** if you keep finishing last.

## How it's built

Plain [Three.js](https://threejs.org/) (WebGL) via [Vite](https://vitejs.dev/),
no game engine, no external art/audio assets — everything is generated at
runtime:

- **Art style** — a bright, cel-shaded toy/party-game look (chibi round dogs,
  candy-colored buildings, `MeshToonMaterial` + a shared quantized gradient
  ramp for banded cartoon shading everywhere) rather than photoreal desert
  grit.
- **Models** — the dog (and its shotgun) is built procedurally out of
  primitives in `src/game/DogModel.js`: a big bouncy egg-shaped body, floppy
  ears, big dot eyes, white mitten paws gripping the shotgun out front, and
  stub legs. The whole body squashes/stretches for jumps and landings.
- **Textures** — wood planks, sand, dirt road, roofing, the sky gradient (with
  painted clouds) and the toon shading ramp are all drawn onto `<canvas>` at
  load time (`src/game/Textures.js`), so the game has zero binary image
  dependencies and works fully offline once loaded.
- **Sound** — gunfire, reload clacks, hit yelps, jump yips, coin chimes and
  death thuds are synthesized with the Web Audio API (`src/game/AudioSynth.js`),
  zero audio files.
- **World** — the ghost town (candy-colored saloon-style buildings, a
  windmill, cacti, fences, a dirt main street) is procedurally laid out in
  `src/game/Town.js`, which also returns simple AABB colliders used for both
  movement collision and shotgun/vision line-of-sight blocking.
- **Combat** — `src/game/Weapon.js` fires a 9-pellet shotgun cone per trigger
  pull with per-pellet ray tests (sphere hitboxes + AABB wall blocking) and
  range-based damage falloff. Health is a clean 6-hit counter rather than a
  raw damage total — any blast that lands costs exactly one hit — while the
  falloff value still scales how hard that hit's knockback impulse is.
- **Bot AI** — `src/game/Bot.js` is a small state machine (wander ↔ combat)
  with radius + vision-cone detection, threat tracking/expiry, target
  leading based on estimated velocity, strafing/kiting to a preferred range,
  and turn-rate-limited aiming (so they're dangerous, not aimbots).
- **Economy** — `src/game/Economy.js` handles the placement → coin-reward
  table and persists the running balance in `localStorage`.

## Project structure

```
index.html            HUD / menu markup
src/main.js            entry point
src/style.css           all UI styling (desktop + mobile + safe-area aware)
src/game/
  Constants.js          tuning knobs (speeds, damage, reload time, rewards…)
  Textures.js            procedural canvas textures
  DogModel.js             procedural dog + shotgun mesh
  Town.js                  ghost town generator + colliders
  Character.js              shared movement/physics/combat base class
  Player.js                  player controller + third-person camera
  Bot.js                      bot AI state machine
  Weapon.js                    shotgun pellet raycasting + damage falloff
  Input.js                      keyboard + touch-joystick input
  AudioSynth.js                  procedural sound effects
  Economy.js                      coin balance + placement rewards
  UI.js                             HUD/menu DOM bindings
  Game.js                            orchestrates everything, the main loop
```
