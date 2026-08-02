// All gameplay tuning lives here so it can be adjusted quickly
// once we feel the Neural Band input on real hardware.

// ---- scale ---------------------------------------------------------
// Nothing here was dimensioned until chain lightning needed a range you
// could reason about — "a 45 m arc" means something, "a 90 px arc" does
// not. One metre is two pixels, which makes the playfield 300 m across,
// the ship about 12 m nose to tail, and a large asteroid 44 m wide:
// arcade-scale, but a scale. Every distance and speed below is authored
// through m()/mps(), and the pixel values they produce are exactly the
// ones that were hand-tuned before the scale existed — this named what
// the numbers already meant rather than changing them.
export const PX_PER_M = 2;
export const m = (metres) => metres * PX_PER_M;
export const mps = (metresPerSecond) => metresPerSecond * PX_PER_M;
export const toM = (px) => px / PX_PER_M;

export const CFG = {
  W: 600,
  H: 600,

  scale: {
    pxPerM: PX_PER_M,
    fieldM: 600 / PX_PER_M,   // 300 m across, and it wraps
  },

  ship: {
    radius: m(6),         // ~12 m across the hull
    // Steering defaults. These are the values the CONTROLS screen
    // resets to; live tuning overwrites them in place (js/settings.js).
    turnStep: Math.PI / 4,   // rad added per swipe (45° = 1/8 of a turn)
    maxTurnQueue: Math.PI,   // rad of un-swept turn a swipe flurry can bank
    turnRate: 3.8,        // rad/s ceiling while sweeping toward the queued angle
    turnDrift: 0.15,      // s time constant the sweep eases out over; 0 = hard stop
    speedStep: mps(37.5), // per speed level, so level 4 is 150 m/s
    maxSpeedLevel: 4,     // up-swipes past this do nothing
    accel: 3.5,           // 1/s exponential approach to the target speed
    invulnTime: 2.5,      // s of spawn protection
    respawnDelay: 1.2,    // s between death and respawn
    lives: 3,
  },

  bullet: {
    radius: m(1),
    speed: mps(215),      // ship velocity is added on top
    life: 1.05,           // s before a bullet expires
    max: 6,               // bullets allowed on screen; must exceed
                          // life/cooldown or continuous fire stutters
    cooldown: 0.2,        // s between shots
  },

  orb: {
    radius: m(3),
    max: 3,
    cooldown: 0.8,        // 4× the ship's cooldown — orbs fire at 1/4 rate
    trailDelay: 0.18,     // s of ship-trail each orb lags behind the previous
  },

  missile: {
    radius: m(1.5),
    speed: mps(150),
    turnRate: 4.0,        // rad/s homing turn toward the nearest asteroid
    life: 3.0,            // s before a missile expires
    cooldown: 1.5,        // s between launches
  },

  // Chain lightning: the arc leaps from the ship to the nearest rock in
  // range, then rock to rock, and everything it touches dies. Ranges
  // are the whole balance — the arc is short enough that you have to
  // fly into the cluster, which is also where the rocks are.
  lightning: {
    range: m(45),         // ship → first rock, 15% of the field
    chainRange: m(30),    // rock → rock hop; shorter, so chains need packs
    maxTargets: 4,        // rocks one strike can take, first link included
    cooldown: 1.1,        // s between strikes, only spent when one lands
    boltLife: 0.2,        // s the arc stays on screen
    jitter: m(3),         // how far the bolt wanders off a straight line
  },

  spread: {
    count: 3,             // bullets per volley
    angleStep: 0.17,      // rad between volley bullets — a tight cone
    cooldownMult: 2,      // volley cooldown = bullet.cooldown × this (slower)
  },

  pickup: {
    dropChance: 0.14,     // chance a destroyed asteroid drops a pickup
    life: 9,              // s before an uncollected pickup fades
    radius: m(4.5),
    surplusScore: 500,    // points for a pickup you already have maxed
    // Relative drop weights — nuke is very rare by design.
    weights: { orb: 10, missile: 5, spread: 5, lightning: 4, nuke: 1 },
  },

  // Tier 0 = small … tier 2 = large. Large asteroids split into
  // two mediums, mediums into two smalls. 13 m to 44 m across.
  asteroidTiers: [
    { radius: m(6.5), score: 100, speed: [mps(40), mps(75)] },
    { radius: m(13), score: 50, speed: [mps(27.5), mps(55)] },
    { radius: m(22), score: 20, speed: [mps(15), mps(37.5)] },
  ],

  wave: {
    baseCount: 3,         // large asteroids in wave 1
    perWave: 1,           // extra large asteroid per wave
    maxCount: 8,
    safeRadius: m(70),    // no asteroid spawns this close to the ship
    clearDelay: 2.0,      // s pause between waves
  },

  audio: {
    music: 'assets/nebula-whip-run.mp3',
    musicVolume: 0.6,
  },

  // Additive display: black is transparent, so everything visible
  // must be bright and high-contrast.
  colors: {
    ship: '#00d4ff',
    thrust: '#ff9f1c',
    bullet: '#ffe066',
    asteroid: '#c9d8e8',
    orb: '#b18cff',
    missile: '#ffa94d',
    spread: '#7dff8a',
    lightning: '#bfe9ff',
    nuke: '#ffffff',
    pickup: '#ff6ec7',
    text: '#e8f4ff',
    dim: '#7aa0b8',
    accent: '#00d4ff',
    danger: '#ff5d5d',
  },
};
