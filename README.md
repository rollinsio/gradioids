# Gradioids

A vector-style asteroid shooter for **Meta Ray-Ban Display glasses**, built as an
MRBD Web App: plain HTML/CSS/JS in a fixed 600×600 viewport, driven entirely by
the six key events the glasses deliver (arrows, Enter, Escape).

On the glasses' additive display, black renders as transparent — so the neon
line-art ships and rocks float over the real world, like the original vector
arcade cabinet escaped onto your face.

## Run locally

Any static server works; the desktop browser is the simulator:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

Controls (desktop = glasses):

| Key | Neural Band | In game |
| --- | --- | --- |
| ← / → | swipe left/right | turn one step that way (45° by default, tunable) |
| ↑ | swipe up | speed level +1 |
| ↓ | swipe down | speed level −1 |
| Enter | index pinch | select (menus) |
| Escape | middle pinch | pause / back |

The ship fires automatically — there is no fire button. Flight is a
stepped drive: the ship flies where it points at one of
`CFG.ship.maxSpeedLevel` speed levels (HUD pips bottom-left), easing
between levels and around turns. Everything is discrete swipes — no
held keys — because Neural Band gestures arrive as single key taps.

Steering is stepped the same way: a swipe banks `CFG.ship.turnStep`
radians and the ship sweeps through them at `CFG.ship.turnRate`, then
holds that heading. Swipe left twice and you have turned 90° left — the
ship never spins on its own, so you never have to swipe back to stop it.
Rapid swipes stack, capped at `CFG.ship.maxTurnQueue`.

## Tuning it on the glasses

CONTROLS — on the main menu, and on the pause menu so you can adjust
without ending a run — edits the feel knobs in place:

| Row | CFG field | Default |
| --- | --- | --- |
| TURN / SWIPE | `ship.turnStep` | 45° |
| TURN SPEED | `ship.turnRate` | 3.8 rad/s |
| TURN BANK | `ship.maxTurnQueue` | 180° |
| SPEED / LEVEL | `ship.speedStep` | 75 px/s |
| TOP SPEED | `ship.maxSpeedLevel` | 4 |
| ACCEL | `ship.accel` | 3.5/s |

↑↓ picks a row, ←→ adjusts it, Escape (middle pinch) backs out. Values
are written straight into `CFG` — a change made from pause is live the
moment you resume — and persist in `localStorage` under
`gradioids.settings`. RESET DEFAULTS restores what `js/config.js` says;
values that differ from stock stay bright in the list. To add a knob,
append an entry to `TUNABLES` in `js/settings.js`; the screen and its
storage pick it up with no other changes.

## Deploy to the glasses

1. Host this directory at a public **HTTPS** URL (GitHub Pages, Vercel, Netlify).
2. In the Meta AI app (v272+): enable Developer Mode, add the URL as a Web App.
3. The app appears at the bottom of the glasses' app grid — pin it and launch.

Docs: <https://wearables.developer.meta.com/docs/develop/webapps/>

## Project layout

```
index.html            600×600 canvas shell, MRBD meta tags
manifest.webmanifest  name + icon
js/config.js          all gameplay tuning knobs
js/input.js           key handling + hold/tap control schemes
js/entities.js        ship, asteroids, bullets, particles
js/settings.js        live-tunable knobs behind the CONTROLS screen
js/game.js            state machine (menu/controls/playing/paused/gameover)
js/main.js            rAF loop
test/sim.mjs          headless smoke test (node test/sim.mjs)
```

## Upgrades

Destroyed asteroids sometimes drop a pickup (chance and rarity weights in
`CFG.pickup`). Fly into it to collect:

| Pickup | Color | Effect |
| --- | --- | --- |
| ● (orb) | pink | Gradius-style option: trails the ship, auto-fires at the nearest rock at 1/4 the ship's rate. Up to `CFG.orb.max`. |
| M (missile) | orange | Arms a launcher: homing missiles that arc toward the nearest asteroid every `CFG.missile.cooldown` s. |
| S (spread) | green | Swaps the cannon for 3-shot volleys in a tight cone — more coverage, slower cadence. |
| N (nuke) | white | Very rare. Detonates on pickup: every asteroid on screen dies and pays its score. |

Pickups you already have maxed pay bonus points instead. Dying loses
everything (classic rules). All attributes live in `js/config.js` under
`orb`, `missile`, `spread`, and `pickup`.

## Roadmap

- More upgrade types (speed, shield) on the pickup system
- Hardware input tuning (turn rate, autofire cadence) once tested on glasses
- IMU head-tilt steering experiment (`DeviceOrientationEvent`)
- Submit to glassapps.io
