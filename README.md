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
| ← / → | swipe left/right | toggle rotation (same again stops, opposite reverses) |
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

Destroyed asteroids sometimes drop a pink pickup. Fly into it to gain an
**orb** — a Gradius-style option that trails behind the ship and auto-fires
at the nearest asteroid at 1/4 of the ship's fire rate. Up to
`CFG.orb.max` orbs; extra pickups pay bonus points. Dying loses all orbs
(classic rules). Every attribute is tunable in `js/config.js` under `orb`.

## Roadmap

- More upgrade types (speed, double shot, shield) on the pickup system
- Hardware input tuning (turn rate, autofire cadence) once tested on glasses
- IMU head-tilt steering experiment (`DeviceOrientationEvent`)
- Submit to glassapps.io
