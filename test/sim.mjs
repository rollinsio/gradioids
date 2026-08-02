// Headless smoke test: drive the Game through real frames with a
// stubbed DOM and assert orb pickup/follow/fire behavior.
globalThis.window = { addEventListener: () => {} };
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
};

const ctxStub = new Proxy({}, {
  get: () => () => {},
  set: () => true,
});
const canvasStub = { getContext: () => ctxStub };

const { Game } = await import('../js/game.js');
const { Pickup, Asteroid } = await import('../js/entities.js');
const { CFG } = await import('../js/config.js');

const game = new Game(canvasStub);
game.newGame();
const dt = 1 / 60;

let failures = 0;
const check = (label, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (!ok) failures++;
};

// Make the ship invulnerable and parked far from asteroids for determinism.
game.ship.invuln = 1e9;

// 1. Ship auto-fires with no input.
for (let i = 0; i < 30; i++) game.update(dt);
check('ship auto-fires with no input', game.bullets.length > 0);

// 2. Collecting a pickup grants an orb.
game.pickups.push(new Pickup(game.ship.x, game.ship.y, 'orb'));
game.update(dt);
check('pickup collection grants an orb', game.orbs.length === 1);

// 3. Orb fires at 1/4 of the ship rate.
game.bullets = [];
let shipShots = 0;
let orbShots = 0;
for (let i = 0; i < 240; i++) { // 4 seconds
  game.update(dt);
  shipShots += game.bullets.filter((b) => !b.fromOrb).length;
  orbShots += game.bullets.filter((b) => b.fromOrb).length;
  game.bullets = []; // count fresh spawns only, ignore the on-screen cap
}
const ratio = orbShots / shipShots;
check(`orb fires at ~1/4 ship rate (ship ${shipShots}, orb ${orbShots})`,
  ratio > 0.18 && ratio < 0.35);

// 4. Orb trails behind the ship.
const orb = game.orbs[0];
const dist = Math.hypot(orb.x - game.ship.x, orb.y - game.ship.y);
check(`orb stays near the ship when parked (d=${dist.toFixed(1)})`, dist < 50);

// 5. Max orbs, then surplus pickups become points.
game.pickups.push(new Pickup(game.ship.x, game.ship.y, 'orb'));
game.update(dt);
game.pickups.push(new Pickup(game.ship.x, game.ship.y, 'orb'));
game.update(dt);
check('orbs capped at CFG.orb.max', game.orbs.length === CFG.orb.max);
// Isolate scoring for this frame: park rocks far from the ship and
// clear in-flight shots so no asteroid kill can add points.
game.asteroids.forEach((a) => { a.x = 550; a.y = 550; a.vx = 0; a.vy = 0; });
game.bullets = [];
const before = game.score;
game.pickups.push(new Pickup(game.ship.x, game.ship.y, 'orb'));
game.update(dt);
check('surplus pickup pays bonus points',
  game.score === before + CFG.pickup.surplusScore && game.orbs.length === CFG.orb.max);

// 5b. Spread pickup: volleys of CFG.spread.count in a tight cone, slower.
game.pickups.push(new Pickup(game.ship.x, game.ship.y, 'spread'));
game.update(dt);
check('spread pickup arms the spread cannon', game.hasSpread === true);
game.bullets = [];
game.fireCooldown = 0;
game.update(dt);
const volleyShots = game.bullets.filter((b) => !b.fromOrb);
check(`spread fires ${CFG.spread.count} bullets per volley (got ${volleyShots.length})`,
  volleyShots.length === CFG.spread.count);
const angles = volleyShots.map((b) => Math.atan2(b.vy - game.ship.vy, b.vx - game.ship.vx));
const arc = Math.max(...angles) - Math.min(...angles);
const wantArc = (CFG.spread.count - 1) * CFG.spread.angleStep;
check(`spread cone spans ~${wantArc.toFixed(2)} rad (got ${arc.toFixed(2)})`,
  Math.abs(arc - wantArc) < 0.02);
check('spread volleys are slower than the plain cannon',
  game.fireCooldown === CFG.bullet.cooldown * CFG.spread.cooldownMult);

// 5c. Missile pickup: homing missiles launch and steer toward rocks.
game.pickups.push(new Pickup(game.ship.x, game.ship.y, 'missile'));
game.update(dt);
check('missile pickup arms the launcher', game.hasMissiles === true);
game.missileCooldown = 0;
game.update(dt);
check('missiles launch automatically', game.missiles.length > 0);
const missile = game.missiles[0];
const rockTarget = game.asteroids[0];
const before5c = Math.hypot(rockTarget.x - missile.x, rockTarget.y - missile.y);
for (let i = 0; i < 30; i++) game.update(dt); // 0.5s of homing
const tracked = game.missiles[0];
const after5c = tracked
  ? Math.hypot(rockTarget.x - tracked.x, rockTarget.y - tracked.y)
  : 0; // already hit something — good enough
check('missile closes on the nearest asteroid', after5c < before5c);

// 5c-bis. Lightning pickup: the arc chains rock to rock and kills what
// it touches. Rocks are placed by hand so the geometry is exact.
const M = CFG.scale.pxPerM;
game.bullets = [];
game.missiles = [];
game.hasMissiles = false;      // keep missiles out of the kill accounting
game.pickups.push(new Pickup(game.ship.x, game.ship.y, 'lightning'));
game.update(dt);
check('lightning pickup arms the emitter', game.hasLightning === true);

// A line of rocks: one just inside ship range, two more one hop apart,
// and a fourth stranded past the chain range.
// Clears everything else in flight so only the arc can kill a rock.
const layout = (specs) => {
  game.bullets = [];
  game.missiles = [];
  game.pickups = [];
  game.asteroids = specs.map(([dx, dy]) => {
    const a = new Asteroid(0, game.ship.x + dx, game.ship.y + dy);
    a.vx = 0;
    a.vy = 0;
    return a;
  });
};
const zap = CFG.lightning.range / M;         // in metres
const hop = CFG.lightning.chainRange / M;
layout([[zap * M, 0], [(zap + hop * 0.8) * M, 0], [(zap + hop * 1.6) * M, 0]]);
game.bolts = [];
game.lightningCooldown = 0;
const chainScore = game.score;
game.update(dt);
check('every rock in the chain pays out',
  game.score >= chainScore + 3 * CFG.asteroidTiers[0].score);
check('a strike destroys the whole chain it reaches',
  game.asteroids.filter((a) => a.tier === 0).length === 0);
check('one bolt is drawn per link', game.bolts.length === 3);
check('the strike goes on cooldown once it lands',
  game.lightningCooldown === CFG.lightning.cooldown);

// Out of range: nothing struck, and no cooldown spent on the whiff.
layout([[(zap + 20) * M, 0]]);
game.bolts = [];
game.lightningCooldown = 0;
game.update(dt);
check('a rock beyond zap range is not struck', game.asteroids.length === 1);
check('a whiffed strike costs no cooldown', game.lightningCooldown <= 0);

// In ship range, but the next rock is past the chain hop.
layout([[zap * M, 0], [(zap + hop + 10) * M, 0]]);
game.bolts = [];
game.lightningCooldown = 0;
game.update(dt);
check('the chain stops at a gap wider than the hop',
  game.asteroids.length === 1 && game.bolts.length === 1);

// A dense pack: the chain is capped at maxTargets even with more in reach.
layout(Array.from({ length: CFG.lightning.maxTargets + 3 },
  (_, i) => [(20 + i * 8) * M, 0]));
game.bolts = [];
game.lightningCooldown = 0;
const packed = game.asteroids.length;
game.update(dt);
check(`the chain is capped at ${CFG.lightning.maxTargets} links`,
  game.bolts.length === CFG.lightning.maxTargets
  && game.asteroids.length === packed - CFG.lightning.maxTargets);

// Bolts are cosmetic and clear themselves.
for (let i = 0; i < Math.ceil(CFG.lightning.boltLife / dt) + 2; i++) game.update(dt);
check('bolts expire', game.bolts.length === 0);

// Splitting mid-chain must not let the arc hop to the fresh children.
layout([]);
const big = new Asteroid(2, game.ship.x + zap * M * 0.5, game.ship.y);
big.vx = 0;
big.vy = 0;
game.asteroids = [big];
game.bolts = [];
game.lightningCooldown = 0;
game.update(dt);
check('a split rock does not feed its own children to the arc',
  game.bolts.length === 1);

// Hand the nuke test below a fresh field, well clear of the ship.
game.hasLightning = false;
layout([[240, 240], [-240, 240], [240, -240]]);

// 5d. Nuke pickup clears the level and pays every rock's score.
game.bullets = [];
game.missiles = [];
const rockScore = game.asteroids.reduce((n, a) => n + a.score, 0);
check('nuke test has rocks to clear', game.asteroids.length > 0);
const beforeNuke = game.score;
game.pickups.push(new Pickup(game.ship.x, game.ship.y, 'nuke'));
game.update(dt);
check('nuke clears every asteroid', game.asteroids.length === 0);
check('nuke pays each asteroid score',
  game.score === beforeNuke + rockScore);

// 6. Death clears orbs. Drop a fresh LARGE asteroid on the ship: even
// if same-frame bullets destroy it, its split children occupy the same
// spot, so the ship collision is guaranteed.
game.bullets = [];
game.ship.invuln = 0;
const rock = new Asteroid(CFG.asteroidTiers.length - 1, game.ship.x, game.ship.y);
rock.vx = 0;
rock.vy = 0;
game.asteroids.push(rock);
game.update(dt);
check('death clears orbs (Gradius rules)', game.orbs.length === 0);
check('death clears missiles, spread and lightning too',
  !game.hasMissiles && !game.hasSpread && !game.hasLightning
  && game.missiles.length === 0 && game.bolts.length === 0);

// 6-bis. The metre scale. Every distance and speed is authored in
// metres now; these are the pixel values they have to still produce,
// i.e. exactly what was hand-tuned before the scale existed.
const { PX_PER_M, m: metres, mps: metresPerSec, toM } = await import('../js/config.js');
check('1 m is 2 px and the field is 300 m across',
  PX_PER_M === 2 && CFG.scale.fieldM === 300 && metres(1) === 2 && metresPerSec(1) === 2);
check('metres round-trip', toM(metres(37.5)) === 37.5);
const asPx = {
  'ship radius': [CFG.ship.radius, 12],
  'ship speed step': [CFG.ship.speedStep, 75],
  'bullet speed': [CFG.bullet.speed, 430],
  'missile speed': [CFG.missile.speed, 300],
  'small asteroid': [CFG.asteroidTiers[0].radius, 13],
  'large asteroid': [CFG.asteroidTiers[2].radius, 44],
  'wave safe radius': [CFG.wave.safeRadius, 140],
  'zap range': [CFG.lightning.range, 90],
  'chain range': [CFG.lightning.chainRange, 60],
};
const drifted = Object.entries(asPx).filter(([, [got, want]]) => got !== want);
check(`the scale did not move any tuned pixel value${drifted.length ? ` (${drifted.map(([k, [g, w]]) => `${k} ${g}≠${w}`).join(', ')})` : ''}`,
  drifted.length === 0);

// 6b. Steering is per-swipe, not a latched spin: each swipe reports one
// turn step and nothing carries over to the next frame.
const { Controls } = await import('../js/input.js');
const fakeInput = {
  keys: new Set(),
  pressed(k) { return this.keys.has(k); },
};
const ctl = new Controls(fakeInput);
fakeInput.keys = new Set(['ArrowRight']);
check('right swipe reports one right step', ctl.update().turn === 1);
fakeInput.keys = new Set();
check('no swipe means no turn (the ship does not spin on)', ctl.update().turn === 0);
fakeInput.keys = new Set(['ArrowLeft']);
check('left swipe reports one left step', ctl.update().turn === -1);
fakeInput.keys = new Set(['ArrowLeft']);
check('a second left swipe turns left again', ctl.update().turn === -1);

// 6c. The ship sweeps through exactly turnStep radians per swipe and
// then holds its new heading.
const { Ship } = await import('../js/entities.js');
const ship = new Ship();
const startAngle = ship.angle;
ship.update(dt, { turn: -1, speedDelta: 0 });
for (let i = 0; i < 120; i++) ship.update(dt, { turn: 0, speedDelta: 0 });
const swept = ship.angle - startAngle;
check(`one left swipe turns ${CFG.ship.turnStep.toFixed(3)} rad left (got ${swept.toFixed(3)})`,
  Math.abs(swept + CFG.ship.turnStep) < 1e-9);
const settled = ship.angle;
for (let i = 0; i < 120; i++) ship.update(dt, { turn: 0, speedDelta: 0 });
check('heading holds steady with no further swipes', ship.angle === settled);
ship.update(dt, { turn: -1, speedDelta: 0 });
ship.update(dt, { turn: -1, speedDelta: 0 });
for (let i = 0; i < 120; i++) ship.update(dt, { turn: 0, speedDelta: 0 });
check('two swipes stack into two steps',
  Math.abs((ship.angle - settled) + 2 * CFG.ship.turnStep) < 1e-9);
// A swipe flurry is capped so the ship can never bank a runaway spin.
const flurry = new Ship();
const flurryStart = flurry.angle;
for (let i = 0; i < 60; i++) flurry.update(dt, { turn: 1, speedDelta: 0 });
for (let i = 0; i < 600; i++) flurry.update(dt, { turn: 0, speedDelta: 0 });
check(`swipe flurry banks at most ${CFG.ship.maxTurnQueue.toFixed(2)} rad`,
  flurry.angle - flurryStart <= CFG.ship.maxTurnQueue + 60 * dt * CFG.ship.turnRate + 1e-9);

// 6d. Drift: the sweep eases out instead of stopping dead, and still
// lands on exactly the angle the swipe asked for.
const sweepSteps = (ship, frames = 400) => {
  const steps = [];
  for (let i = 0; i < frames && ship.turnQueue !== 0; i++) {
    const before = ship.angle;
    ship.update(dt, { turn: 0, speedDelta: 0 });
    steps.push(ship.angle - before);
  }
  return steps;
};

const drifter = new Ship();
const driftStart = drifter.angle;
drifter.update(dt, { turn: 1, speedDelta: 0 });
const driftSteps = sweepSteps(drifter);
check('an eased turn settles in finite time', drifter.turnQueue === 0);
check('a drifting swipe still lands exactly turnStep away',
  Math.abs((drifter.angle - driftStart) - CFG.ship.turnStep) < 1e-9);
// Ignore the last entry: that is the settle snap, not part of the curve.
const curve = driftSteps.slice(0, -1);
check('the turn decelerates the whole way through',
  curve.every((s, i) => i === 0 || s <= curve[i - 1] + 1e-12));
check(`the tail is far slower than the launch (${curve[0].toFixed(4)} → ${curve.at(-1).toFixed(4)} rad/frame)`,
  curve.at(-1) < curve[0] / 4);

// With drift off it is the old hard stop: flat out, then nothing.
const driftDefault = CFG.ship.turnDrift;
CFG.ship.turnDrift = 0;
const hardStop = new Ship();
hardStop.update(dt, { turn: 1, speedDelta: 0 });
const hardSteps = sweepSteps(hardStop).slice(0, -1);
check('turn drift 0 restores a constant-rate sweep',
  hardSteps.every((s) => Math.abs(s - CFG.ship.turnRate * dt) < 1e-12));
check('a hard-stop turn is shorter than a drifting one',
  hardSteps.length < curve.length);
CFG.ship.turnDrift = driftDefault;

// turnRate still caps the rotation, so stacked swipes turn flat out
// before they drift in.
const stacked = new Ship();
for (let i = 0; i < 4; i++) stacked.update(dt, { turn: 1, speedDelta: 0 });
const stackedSteps = sweepSteps(stacked);
check(`turn rate still caps a stacked turn at ${CFG.ship.turnRate} rad/s`,
  Math.max(...stackedSteps) <= CFG.ship.turnRate * dt + 1e-12);
check('a stacked turn starts at the cap',
  Math.abs(stackedSteps[0] - CFG.ship.turnRate * dt) < 1e-12);

// 6e. Controls screen: ←→ adjusts the highlighted knob, the change is
// live in CFG, it persists, and RESET DEFAULTS puts it back.
const { TUNABLES, DEFAULTS } = await import('../js/settings.js');
const turnKnob = TUNABLES.find((t) => t.key === 'turnStep');
const press = (key) => {
  game.input.edgeKeys = new Set(key ? [key] : []);
  game.update(dt);
};

game.state = 'menu';
game.menuIndex = 1;
press('Enter');
check('menu opens the controls screen', game.state === 'controls');
check('controls screen starts on the first knob', game.controlsIndex === 0);

const stepBefore = game.settings.values.turnStep;
press('ArrowRight');
check(`right swipe raises turn/swipe by ${turnKnob.step}° (${stepBefore} → ${game.settings.values.turnStep})`,
  game.settings.values.turnStep === stepBefore + turnKnob.step);
check('the change is live in CFG',
  Math.abs(CFG.ship.turnStep - game.settings.values.turnStep * (Math.PI / 180)) < 1e-12);
press('ArrowLeft');
press('ArrowLeft');
check('left swipes lower it again', game.settings.values.turnStep === stepBefore - turnKnob.step);
check('the new value is saved', JSON.parse(store.get('gradioids.settings')).turnStep
  === stepBefore - turnKnob.step);

for (let i = 0; i < 40; i++) press('ArrowLeft');
check(`turn/swipe floors at ${turnKnob.min}°`, game.settings.values.turnStep === turnKnob.min);
for (let i = 0; i < 60; i++) press('ArrowRight');
check(`turn/swipe ceils at ${turnKnob.max}°`, game.settings.values.turnStep === turnKnob.max);
check('an off-default knob is flagged', game.settings.isDefault(turnKnob) === false);

// Lowering TOP SPEED has to pull an already-faster ship back down.
game.controlsIndex = TUNABLES.findIndex((t) => t.key === 'maxSpeedLevel');
for (let i = 0; i < 10; i++) press('ArrowLeft');
check('top speed floors at 1', CFG.ship.maxSpeedLevel === 1);
game.state = 'playing';
game.respawnTimer = 0;      // the death test above left one pending
game.ship.invuln = 1e9;
game.ship.speedLevel = 4;
game.update(dt);
check('lowering top speed clamps the flying ship', game.ship.speedLevel === 1);

// Back out, then reset everything from the pause menu route.
game.state = 'controls';
game.controlsIndex = TUNABLES.length;   // RESET DEFAULTS
press('Enter');
check('reset restores every default',
  TUNABLES.every((t) => game.settings.values[t.key] === DEFAULTS[t.key]));
check('reset is applied to CFG', CFG.ship.maxSpeedLevel === DEFAULTS.maxSpeedLevel
  && Math.abs(CFG.ship.turnStep - DEFAULTS.turnStep * (Math.PI / 180)) < 1e-12);
game.controlsIndex = TUNABLES.length + 1;   // BACK
game.controlsReturn = 'paused';
press('Enter');
check('BACK returns where the screen was opened from', game.state === 'paused');
game.state = 'controls';
press('Escape');
check('escape also backs out', game.state === 'paused');

// Saved values survive a reload.
game.settings.values.turnStep = 60;
game.settings.save();
const { Settings } = await import('../js/settings.js');
const reloaded = new Settings();
check('settings reload from storage', reloaded.values.turnStep === 60
  && Math.abs(CFG.ship.turnStep - 60 * (Math.PI / 180)) < 1e-12);
reloaded.reset();

// 7. Stepped drive: the ship cruises at speedLevel * speedStep.
game.newGame();
game.ship.invuln = 1e9;
game.asteroids.forEach((a) => { a.x = 550; a.y = 550; a.vx = 0; a.vy = 0; });
game.ship.speedLevel = 2;
for (let i = 0; i < 120; i++) game.update(dt); // 2s to settle
const speed = Math.hypot(game.ship.vx, game.ship.vy);
check(`ship cruises at level 2 = ${(2 * CFG.ship.speedStep)} px/s (got ${speed.toFixed(0)})`,
  Math.abs(speed - 2 * CFG.ship.speedStep) < 5);

// 8. Long random run: no crashes across deaths, waves, respawns.
game.newGame();
for (let i = 0; i < 60 * 60; i++) game.update(dt); // 1 minute
check('60s unattended run completes without error', true);

process.exit(failures ? 1 : 0);
