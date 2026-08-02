import { CFG } from './config.js';

const TAU = Math.PI * 2;

// An eased turn approaches its heading asymptotically, so it needs a
// floor to actually land on it. ~0.1° — below anything you could see.
const TURN_SETTLE = 0.002;

export function rand(min, max) {
  return min + Math.random() * (max - min);
}

export function wrapPosition(e, margin) {
  const m = margin;
  if (e.x < -m) e.x += CFG.W + m * 2;
  if (e.x > CFG.W + m) e.x -= CFG.W + m * 2;
  if (e.y < -m) e.y += CFG.H + m * 2;
  if (e.y > CFG.H + m) e.y -= CFG.H + m * 2;
}

export function collides(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = a.radius + b.radius;
  return dx * dx + dy * dy < r * r;
}

export class Ship {
  constructor() {
    this.radius = CFG.ship.radius;
    this.reset();
  }

  reset() {
    this.x = CFG.W / 2;
    this.y = CFG.H / 2;
    this.vx = 0;
    this.vy = 0;
    this.angle = -Math.PI / 2;
    this.turnQueue = 0;   // rad of swiped-but-not-yet-swept turn
    this.speedLevel = 0;
    this.invuln = CFG.ship.invulnTime;
    this.thrusting = false;
  }

  // Stepped drive: the ship flies where it points at speedLevel *
  // speedStep, easing toward that velocity so turns and speed changes
  // feel smooth rather than instant.
  //
  // Steering is stepped too: each swipe banks turnStep radians and the
  // ship sweeps through them at turnRate, so it comes to rest pointing
  // where you aimed it instead of spinning until you swipe back.
  //
  // The sweep eases out rather than stopping dead: what is left of the
  // turn decays with time constant turnDrift, so the ship comes off a
  // swipe fast and coasts the last few degrees. turnRate still caps how
  // fast it can rotate, which is what a stack of swipes runs into
  // first — they turn flat out, then drift into the final heading.
  // turnDrift = 0 disables the tail and restores a hard stop.
  update(dt, controls) {
    const c = CFG.ship;
    this.turnQueue += (controls.turn || 0) * c.turnStep;
    this.turnQueue = Math.max(-c.maxTurnQueue, Math.min(c.maxTurnQueue, this.turnQueue));
    const left = Math.abs(this.turnQueue);
    if (left > 0) {
      const eased = c.turnDrift > 0
        ? left * (1 - Math.exp(-dt / c.turnDrift))
        : left;
      // Snap up the remainder once the tail is imperceptible, so the
      // turn terminates instead of chasing the asymptote forever.
      let sweep = Math.min(eased, c.turnRate * dt);
      if (left - sweep < TURN_SETTLE) sweep = left;
      const step = Math.sign(this.turnQueue) * sweep;
      this.angle += step;
      this.turnQueue -= step;
    }
    this.thrusting = this.speedLevel > 0;
    const targetSpeed = this.speedLevel * c.speedStep;
    const tx = Math.cos(this.angle) * targetSpeed;
    const ty = Math.sin(this.angle) * targetSpeed;
    const k = 1 - Math.exp(-c.accel * dt);
    this.vx += (tx - this.vx) * k;
    this.vy += (ty - this.vy) * k;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    wrapPosition(this, this.radius);
    if (this.invuln > 0) this.invuln -= dt;
  }

  draw(ctx, t) {
    // Blink while invulnerable.
    if (this.invuln > 0 && Math.floor(t * 8) % 2 === 0) return;
    const { x, y, angle } = this;
    const r = this.radius;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = CFG.colors.ship;
    ctx.lineWidth = 2;
    ctx.shadowColor = CFG.colors.ship;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(r * 1.3, 0);
    ctx.lineTo(-r * 0.9, r * 0.8);
    ctx.lineTo(-r * 0.5, 0);
    ctx.lineTo(-r * 0.9, -r * 0.8);
    ctx.closePath();
    ctx.stroke();
    if (this.thrusting && Math.floor(t * 20) % 2 === 0) {
      ctx.strokeStyle = CFG.colors.thrust;
      ctx.shadowColor = CFG.colors.thrust;
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, r * 0.4);
      ctx.lineTo(-r * 1.6, 0);
      ctx.lineTo(-r * 0.7, -r * 0.4);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export class Asteroid {
  constructor(tier, x, y) {
    const spec = CFG.asteroidTiers[tier];
    this.tier = tier;
    this.radius = spec.radius;
    this.score = spec.score;
    this.x = x;
    this.y = y;
    const speed = rand(spec.speed[0], spec.speed[1]);
    const dir = rand(0, TAU);
    this.vx = Math.cos(dir) * speed;
    this.vy = Math.sin(dir) * speed;
    this.angle = rand(0, TAU);
    this.spin = rand(-1.2, 1.2);
    // Jagged polygon outline, fixed at creation.
    const n = 9 + tier * 2;
    this.points = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * TAU;
      const rr = this.radius * rand(0.72, 1.18);
      return [Math.cos(a) * rr, Math.sin(a) * rr];
    });
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.angle += this.spin * dt;
    wrapPosition(this, this.radius);
  }

  split() {
    if (this.tier === 0) return [];
    return [
      new Asteroid(this.tier - 1, this.x, this.y),
      new Asteroid(this.tier - 1, this.x, this.y),
    ];
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = CFG.colors.asteroid;
    ctx.lineWidth = 2;
    ctx.shadowColor = CFG.colors.asteroid;
    ctx.shadowBlur = 5;
    ctx.beginPath();
    this.points.forEach(([px, py], i) => {
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

export class Bullet {
  constructor(x, y, angle, vx0 = 0, vy0 = 0) {
    const b = CFG.bullet;
    this.radius = b.radius;
    this.x = x;
    this.y = y;
    this.vx = vx0 + Math.cos(angle) * b.speed;
    this.vy = vy0 + Math.sin(angle) * b.speed;
    this.life = b.life;
  }

  static fromShip(ship, angleOffset = 0) {
    return new Bullet(
      ship.x + Math.cos(ship.angle) * ship.radius * 1.3,
      ship.y + Math.sin(ship.angle) * ship.radius * 1.3,
      ship.angle + angleOffset,
      ship.vx,
      ship.vy
    );
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    wrapPosition(this, this.radius);
  }

  get dead() {
    return this.life <= 0;
  }

  draw(ctx) {
    const color = this.fromOrb ? CFG.colors.orb : CFG.colors.bullet;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

// Homing missile: launched from the ship, steers toward the nearest
// asteroid at a limited turn rate so it arcs rather than snaps.
export class Missile {
  constructor(x, y, angle) {
    this.radius = CFG.missile.radius;
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.life = CFG.missile.life;
  }

  update(dt, asteroids) {
    const m = CFG.missile;
    let best = null;
    let bestD = Infinity;
    for (const a of asteroids) {
      const d = (a.x - this.x) ** 2 + (a.y - this.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    if (best) {
      const want = Math.atan2(best.y - this.y, best.x - this.x);
      let diff = want - this.angle;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      const maxTurn = m.turnRate * dt;
      this.angle += Math.max(-maxTurn, Math.min(maxTurn, diff));
    }
    this.x += Math.cos(this.angle) * m.speed * dt;
    this.y += Math.sin(this.angle) * m.speed * dt;
    this.life -= dt;
    wrapPosition(this, this.radius);
  }

  get dead() {
    return this.life <= 0;
  }

  draw(ctx, t) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = CFG.colors.missile;
    ctx.lineWidth = 2;
    ctx.shadowColor = CFG.colors.missile;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, 3);
    ctx.lineTo(-4, -3);
    ctx.closePath();
    ctx.stroke();
    if (Math.floor(t * 20) % 2 === 0) {
      ctx.strokeStyle = CFG.colors.thrust;
      ctx.shadowColor = CFG.colors.thrust;
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(-9, 0);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// One link of a chain lightning strike: a jagged path between two
// points that flashes and fades. Purely cosmetic — the damage is
// resolved the instant the strike is computed (see Game.strikeLightning).
export class Bolt {
  constructor(x1, y1, x2, y2) {
    this.life = CFG.lightning.boltLife;
    this.maxLife = this.life;
    // Fixed at birth rather than re-rolled per frame: a bolt that
    // re-jitters every frame reads as noise, not as a strike.
    const segments = 6;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;     // unit normal, to push points off the line
    const ny = dx / len;
    this.points = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      // Ends stay pinned to the ship and the rock; the middle wanders.
      const spread = Math.sin(t * Math.PI) * CFG.lightning.jitter;
      const off = rand(-spread, spread);
      this.points.push([x1 + dx * t + nx * off, y1 + dy * t + ny * off]);
    }
  }

  update(dt) {
    this.life -= dt;
  }

  get dead() {
    return this.life <= 0;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(this.life / this.maxLife, 0);
    ctx.strokeStyle = CFG.colors.lightning;
    ctx.shadowColor = CFG.colors.lightning;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    this.points.forEach(([px, py], i) => {
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    // Traced twice: a wide soft pass for the glow, a thin bright one
    // for the filament.
    ctx.lineWidth = 4;
    ctx.globalAlpha *= 0.35;
    ctx.stroke();
    ctx.globalAlpha = Math.max(this.life / this.maxLife, 0);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
}

// Short-lived line fragments for explosions.
export class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    const speed = rand(40, 180);
    const dir = rand(0, TAU);
    this.vx = Math.cos(dir) * speed;
    this.vy = Math.sin(dir) * speed;
    this.angle = rand(0, TAU);
    this.spin = rand(-6, 6);
    this.len = rand(3, 9);
    this.life = rand(0.35, 0.8);
    this.maxLife = this.life;
    this.color = color;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.angle += this.spin * dt;
    this.life -= dt;
  }

  get dead() {
    return this.life <= 0;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(this.life / this.maxLife, 0);
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-this.len / 2, 0);
    ctx.lineTo(this.len / 2, 0);
    ctx.stroke();
    ctx.restore();
  }
}

export function explosion(particles, x, y, color, count = 14) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y, color));
}

// Gradius-style option: trails the ship and auto-fires at the nearest
// asteroid, at a fraction of the ship's fire rate (CFG.orb.cooldown).
export class Orb {
  constructor(slot, x, y) {
    this.slot = slot;     // 0-based position in the trail
    this.radius = CFG.orb.radius;
    this.x = x;
    this.y = y;
    this.cooldown = 0;
  }

  // Sit where the ship was (slot+1)*trailDelay seconds ago. Samples
  // are per-frame, so nearest-sample is smooth enough — no interpolation,
  // which also avoids sweeping across the screen when the ship wraps.
  follow(trail, now) {
    const target = now - (this.slot + 1) * CFG.orb.trailDelay;
    for (let i = trail.length - 1; i >= 0; i--) {
      if (trail[i].t <= target) {
        this.x = trail[i].x;
        this.y = trail[i].y;
        return;
      }
    }
    if (trail.length) {
      this.x = trail[0].x;
      this.y = trail[0].y;
    }
  }

  nearestTarget(asteroids) {
    let best = null;
    let bestD = Infinity;
    for (const a of asteroids) {
      const d = (a.x - this.x) ** 2 + (a.y - this.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  }

  draw(ctx, t) {
    const pulse = 1 + 0.15 * Math.sin(t * 6 + this.slot * 2);
    ctx.save();
    ctx.strokeStyle = CFG.colors.orb;
    ctx.lineWidth = 2;
    ctx.shadowColor = CFG.colors.orb;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * pulse, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = CFG.colors.orb;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

// Visual identity for each pickup type: color key into CFG.colors
// plus the letter drawn inside the ring (orb keeps its plain dot).
const PICKUP_STYLE = {
  orb: { colorKey: 'pickup', letter: '' },
  missile: { colorKey: 'missile', letter: 'M' },
  spread: { colorKey: 'spread', letter: 'S' },
  lightning: { colorKey: 'lightning', letter: 'L' },
  nuke: { colorKey: 'nuke', letter: 'N' },
};

// Dropped by destroyed asteroids; fly into it to collect the upgrade.
export class Pickup {
  constructor(x, y, type = 'orb') {
    this.type = type;
    this.radius = CFG.pickup.radius;
    this.x = x;
    this.y = y;
    const dir = rand(0, TAU);
    const speed = rand(10, 30);
    this.vx = Math.cos(dir) * speed;
    this.vy = Math.sin(dir) * speed;
    this.life = CFG.pickup.life;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    wrapPosition(this, this.radius);
  }

  get dead() {
    return this.life <= 0;
  }

  draw(ctx, t) {
    // Blink during the final seconds before expiring.
    if (this.life < 2 && Math.floor(t * 6) % 2 === 0) return;
    const style = PICKUP_STYLE[this.type];
    const color = CFG.colors[style.colorKey];
    const pulse = 1 + 0.2 * Math.sin(t * 5);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * pulse, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = color;
    if (style.letter) {
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(style.letter, this.x, this.y + 1);
    } else {
      ctx.beginPath();
      ctx.arc(this.x, this.y, 3, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}
