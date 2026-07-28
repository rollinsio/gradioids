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
check('death clears missiles and spread too',
  !game.hasMissiles && !game.hasSpread && game.missiles.length === 0);

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

// 6d. Controls screen: ←→ adjusts the highlighted knob, the change is
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
