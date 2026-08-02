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
| ← / → | swipe left/right | turn one step that way (45° by default, tunable); **hold to keep turning** (keyboard only) |
| ↑ | swipe up | speed level +1 |
| ↓ | swipe down | speed level −1 |
| Enter | index pinch | select (menus) |
| Escape | middle pinch | pause / back |

The ship fires automatically — there is no fire button. Flight is a
stepped drive: the ship flies where it points at one of
`CFG.ship.maxSpeedLevel` speed levels (HUD pips bottom-left), easing
between levels and around turns. On the glasses every input is a
discrete swipe, because Neural Band gestures arrive as single key taps.

Steering is stepped the same way: a swipe banks `CFG.ship.turnStep`
radians and the ship sweeps through them, then holds that heading.
Swipe left twice and you have turned 90° left — the ship never spins on
its own, so you never have to swipe back to stop it. Rapid swipes
stack, capped at `CFG.ship.maxTurnQueue`.

The sweep eases out rather than stopping dead: what is left of the turn
decays with time constant `CFG.ship.turnDrift`, so the ship comes off a
swipe hard and coasts the last few degrees into place. `turnRate` caps
how fast it can rotate at all, which is what a stack of swipes hits
first — they turn flat out, then drift in. At stock values a single
45° swipe is 90% turned in ~0.35s and fully settled by ~0.9s;
`turnDrift = 0` removes the tail and restores a hard stop.

### Holding a key on the web

On a real keyboard, holding ← or → turns the ship continuously at
`turnRate` for as long as it is down, and releasing drifts out of the
turn. Tapping still steps, so both schemes are live at once.

The two are told apart by `KeyboardEvent.repeat` — the OS auto-repeat
flag, i.e. the browser stating that a key is physically held. A
discrete tap cannot produce one, so the glasses can never fall into the
held mode by accident; that is why this is gated on the repeat flag
rather than on a "key was down for N ms" timer, which a slow gesture
could trip. Nothing about the Meta input path changes.

A hold takes over from banked swipe steps rather than adding to them,
so holding never turns faster than `turnRate`. Releasing hands the
sweep exactly the angle it would coast through decelerating from
`turnRate` with time constant `turnDrift`, so letting go of a hold
drifts out the same way the end of a swipe does.

Speed stays tap-only in both schemes — auto-repeat on ↑ would slam the
ship to full throttle in a couple of frames. On the CONTROLS screen,
holding ←→ runs a value up or down at a throttled rate, while row
selection stays tap-only.

## Tuning it on the glasses

CONTROLS — on the main menu, and on the pause menu so you can adjust
without ending a run — edits the feel knobs in place:

| Row | CFG field | Default |
| --- | --- | --- |
| TURN / SWIPE | `ship.turnStep` | 45° |
| TURN SPEED | `ship.turnRate` | 3.8 rad/s |
| TURN DRIFT | `ship.turnDrift` | 0.15 s |
| TURN BANK | `ship.maxTurnQueue` | 180° |
| SPEED / LEVEL | `ship.speedStep` | 37.5 m/s |
| TOP SPEED | `ship.maxSpeedLevel` | 4 |
| ACCEL | `ship.accel` | 3.5/s |
| ZAP RANGE | `lightning.range` | 45 m |
| CHAIN RANGE | `lightning.chainRange` | 30 m |

↑↓ picks a row, ←→ adjusts it, Escape (middle pinch) backs out. Values
are written straight into `CFG` — a change made from pause is live the
moment you resume — and persist in `localStorage` under
`gradioids.settings`. RESET DEFAULTS restores what `js/config.js` says;
values that differ from stock stay bright in the list. To add a knob,
append an entry to `TUNABLES` in `js/settings.js`; the screen and its
storage pick it up with no other changes.

## Scale

**1 metre = 2 pixels.** The playfield is 300 m across (and wraps), the
ship is about 12 m nose to tail, asteroids run 13 m to 44 m wide, and
top speed is 150 m/s.

Nothing was dimensioned until chain lightning needed a range you could
reason about — "a 45 m arc" means something, "a 90 px arc" does not.
Every distance and speed in `js/config.js` is now authored through
`m()` / `mps()`, and the pixel values they produce are exactly the ones
that were hand-tuned before the scale existed: naming what the numbers
already meant, not changing them (`test/sim.mjs` asserts this). Rendering
still works in pixels — the scale is an authoring and display unit, not
a second coordinate system.

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
js/input.js           key handling; tap steps + keyboard-only holds
js/entities.js        ship, asteroids, bullets, bolts, particles
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
| L (lightning) | pale blue | Chain lightning, below. |
| N (nuke) | white | Very rare. Detonates on pickup: every asteroid on screen dies and pays its score. |

Pickups you already have maxed pay bonus points instead. Dying loses
everything (classic rules). All attributes live in `js/config.js` under
`orb`, `missile`, `spread`, `lightning`, and `pickup`.

### Chain lightning

Every `CFG.lightning.cooldown` seconds the ship arcs to the nearest rock
within **45 m**, then hops rock to rock within **30 m**, up to
`maxTargets` links. Everything the arc touches is destroyed, splitting
and paying out exactly as if it had been shot.

The two ranges are the whole balance. The arc is short — 45 m against a
300 m field — so you have to fly into the cluster to use it, and the
chain hop is shorter still, so long chains only exist in packs. Range is
measured to the rock's *edge*, which makes a 44 m boulder easier to
catch than a pebble at the same centre distance. A strike that finds
nothing in range costs no cooldown and retries the next frame.

Like the orb and missile targeting, it ignores screen wrap: a rock just
across the seam reads as far away and is skipped, rather than the bolt
drawing a line back across the whole field.

## Roadmap

- More upgrade types (speed, shield) on the pickup system
- Hardware input tuning (turn rate, autofire cadence) once tested on glasses
- IMU head-tilt steering experiment (`DeviceOrientationEvent`)
- Submit to glassapps.io
