// All gameplay tuning lives here so it can be adjusted quickly
// once we feel the Neural Band input on real hardware.
export const CFG = {
  W: 600,
  H: 600,

  ship: {
    radius: 12,
    // Steering defaults. These are the values the CONTROLS screen
    // resets to; live tuning overwrites them in place (js/settings.js).
    turnStep: Math.PI / 4,   // rad added per swipe (45° = 1/8 of a turn)
    maxTurnQueue: Math.PI,   // rad of un-swept turn a swipe flurry can bank
    turnRate: 3.8,        // rad/s while sweeping toward the queued angle
    speedStep: 75,        // px/s per speed level
    maxSpeedLevel: 4,     // up-swipes past this do nothing
    accel: 3.5,           // 1/s exponential approach to the target speed
    invulnTime: 2.5,      // s of spawn protection
    respawnDelay: 1.2,    // s between death and respawn
    lives: 3,
  },

  bullet: {
    radius: 2,
    speed: 430,           // px/s (ship velocity is added)
    life: 1.05,           // s before a bullet expires
    max: 6,               // bullets allowed on screen; must exceed
                          // life/cooldown or continuous fire stutters
    cooldown: 0.2,        // s between shots
  },

  orb: {
    radius: 6,
    max: 3,
    cooldown: 0.8,        // 4× the ship's cooldown — orbs fire at 1/4 rate
    trailDelay: 0.18,     // s of ship-trail each orb lags behind the previous
  },

  missile: {
    radius: 3,
    speed: 300,           // px/s
    turnRate: 4.0,        // rad/s homing turn toward the nearest asteroid
    life: 3.0,            // s before a missile expires
    cooldown: 1.5,        // s between launches
  },

  spread: {
    count: 3,             // bullets per volley
    angleStep: 0.17,      // rad between volley bullets — a tight cone
    cooldownMult: 2,      // volley cooldown = bullet.cooldown × this (slower)
  },

  pickup: {
    dropChance: 0.14,     // chance a destroyed asteroid drops a pickup
    life: 9,              // s before an uncollected pickup fades
    radius: 9,
    surplusScore: 500,    // points for a pickup you already have maxed
    // Relative drop weights — nuke is very rare by design.
    weights: { orb: 10, missile: 5, spread: 5, nuke: 1 },
  },

  // Tier 0 = small … tier 2 = large. Large asteroids split into
  // two mediums, mediums into two smalls.
  asteroidTiers: [
    { radius: 13, score: 100, speed: [80, 150] },
    { radius: 26, score: 50, speed: [55, 110] },
    { radius: 44, score: 20, speed: [30, 75] },
  ],

  wave: {
    baseCount: 3,         // large asteroids in wave 1
    perWave: 1,           // extra large asteroid per wave
    maxCount: 8,
    safeRadius: 140,      // no asteroid spawns this close to the ship
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
    nuke: '#ffffff',
    pickup: '#ff6ec7',
    text: '#e8f4ff',
    dim: '#7aa0b8',
    accent: '#00d4ff',
    danger: '#ff5d5d',
  },
};
