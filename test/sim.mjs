// Headless smoke test: drive the Game through real frames with a
// stubbed DOM and assert orb pickup/follow/fire behavior.
globalThis.window = { addEventListener: () => {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

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
game.pickups.push(new Pickup(game.ship.x, game.ship.y));
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
game.pickups.push(new Pickup(game.ship.x, game.ship.y));
game.update(dt);
game.pickups.push(new Pickup(game.ship.x, game.ship.y));
game.update(dt);
check('orbs capped at CFG.orb.max', game.orbs.length === CFG.orb.max);
// Isolate scoring for this frame: park rocks far from the ship and
// clear in-flight shots so no asteroid kill can add points.
game.asteroids.forEach((a) => { a.x = 550; a.y = 550; a.vx = 0; a.vy = 0; });
game.bullets = [];
const before = game.score;
game.pickups.push(new Pickup(game.ship.x, game.ship.y));
game.update(dt);
check('surplus pickup pays bonus points',
  game.score === before + CFG.orb.surplusScore && game.orbs.length === CFG.orb.max);

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

// 7. Long random run: no crashes across deaths, waves, respawns.
game.newGame();
for (let i = 0; i < 60 * 60; i++) game.update(dt); // 1 minute
check('60s unattended run completes without error', true);

process.exit(failures ? 1 : 0);
