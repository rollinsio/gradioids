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
| ← / → | swipe left/right | step the spin: against the turn stops, again reverses |
| ↑ | swipe up | speed level +1 |
| ↓ | swipe down | speed level −1 |
| Enter | index pinch | select (menus) |
| Escape | middle pinch | pause / back |

The ship fires automatically — there is no fire button. Flight is a
stepped drive: the ship flies where it points at one of
`CFG.ship.maxSpeedLevel` speed levels (HUD pips bottom-left), easing
between levels and around turns. Everything is discrete swipes — no
held keys — because Neural Band gestures arrive as single key taps.

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
js/game.js            state machine (menu/settings/playing/paused/gameover)
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
