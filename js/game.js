import { CFG } from './config.js';
import { Input, Controls, Keys } from './input.js';
import { Ship, Asteroid, Bullet, Missile, Orb, Pickup, collides, explosion, rand } from './entities.js';
import { Music } from './audio.js';

const HISCORE_KEY = 'gradioids.hiscore';

export class Game {
  constructor(canvas) {
    this.ctx = canvas.getContext('2d');
    this.input = new Input();
    this.controls = new Controls(this.input);
    this.music = new Music(CFG.audio.music);
    this.hiscore = Number(localStorage.getItem(HISCORE_KEY)) || 0;
    this.state = 'menu';
    this.menuIndex = 0;
    this.time = 0;
  }

  // ---- run state -----------------------------------------------------

  newGame() {
    this.ship = new Ship();
    this.asteroids = [];
    this.bullets = [];
    this.particles = [];
    this.orbs = [];
    this.pickups = [];
    this.missiles = [];
    this.shipTrail = [];
    this.hasMissiles = false;
    this.hasSpread = false;
    this.score = 0;
    this.lives = CFG.ship.lives;
    this.wave = 0;
    this.fireCooldown = 0;
    this.missileCooldown = 0;
    this.nukeFlash = 0;
    this.respawnTimer = 0;
    this.waveTimer = 0;
    this.newHiscore = false;
    this.controls.reset();
    this.startWave();
    this.music.play();
    this.state = 'playing';
  }

  addScore(points) {
    this.score += points;
    if (this.score > this.hiscore) {
      this.hiscore = this.score;
      this.newHiscore = true;
      try {
        localStorage.setItem(HISCORE_KEY, String(this.hiscore));
      } catch { /* non-fatal */ }
    }
  }

  startWave() {
    this.wave += 1;
    const count = Math.min(
      CFG.wave.baseCount + (this.wave - 1) * CFG.wave.perWave,
      CFG.wave.maxCount
    );
    for (let i = 0; i < count; i++) {
      let x, y;
      do {
        x = rand(0, CFG.W);
        y = rand(0, CFG.H);
      } while (Math.hypot(x - CFG.W / 2, y - CFG.H / 2) < CFG.wave.safeRadius);
      this.asteroids.push(new Asteroid(CFG.asteroidTiers.length - 1, x, y));
    }
  }

  destroyAsteroid(hit) {
    this.asteroids.splice(this.asteroids.indexOf(hit), 1);
    this.asteroids.push(...hit.split());
    this.addScore(hit.score);
    if (Math.random() < CFG.pickup.dropChance) {
      this.pickups.push(new Pickup(hit.x, hit.y, this.choosePickupType()));
    }
    explosion(this.particles, hit.x, hit.y, CFG.colors.asteroid);
  }

  choosePickupType() {
    const weights = CFG.pickup.weights;
    let total = 0;
    for (const type in weights) total += weights[type];
    let r = Math.random() * total;
    for (const [type, w] of Object.entries(weights)) {
      r -= w;
      if (r <= 0) return type;
    }
    return 'orb';
  }

  collectPickup(pickup) {
    switch (pickup.type) {
      case 'orb':
        if (this.orbs.length < CFG.orb.max) {
          this.orbs.push(new Orb(this.orbs.length, this.ship.x, this.ship.y));
        } else {
          this.addScore(CFG.pickup.surplusScore);
        }
        break;
      case 'missile':
        if (this.hasMissiles) this.addScore(CFG.pickup.surplusScore);
        else this.hasMissiles = true;
        break;
      case 'spread':
        if (this.hasSpread) this.addScore(CFG.pickup.surplusScore);
        else this.hasSpread = true;
        break;
      case 'nuke':
        this.detonateNuke();
        break;
    }
  }

  // Clears the level outright: every rock pays its score, nothing
  // splits, nothing drops — just the flash and the wave-clear timer.
  detonateNuke() {
    for (const a of this.asteroids) {
      this.addScore(a.score);
      explosion(this.particles, a.x, a.y, CFG.colors.asteroid);
    }
    this.asteroids = [];
    this.nukeFlash = 0.6;
  }

  update(dt) {
    this.time += dt;
    switch (this.state) {
      case 'menu': this.updateMenu(); break;
      case 'playing': this.updatePlaying(dt); break;
      case 'paused': this.updatePaused(); break;
      case 'gameover': this.updateGameover(); break;
    }
    this.input.endFrame();
  }

  // ---- menus ---------------------------------------------------------

  menuNav(length) {
    if (this.input.pressed(Keys.UP)) {
      this.menuIndex = (this.menuIndex + length - 1) % length;
    }
    if (this.input.pressed(Keys.DOWN)) {
      this.menuIndex = (this.menuIndex + 1) % length;
    }
  }

  updateMenu() {
    if (this.input.pressed(Keys.SELECT)) this.newGame();
  }

  updatePaused() {
    this.menuNav(3);
    if (this.input.pressed(Keys.BACK)) {
      this.state = 'playing';
      this.music.play();
      return;
    }
    if (this.input.pressed(Keys.SELECT)) {
      if (this.menuIndex === 0) {
        this.state = 'playing';
        this.music.play();
      } else if (this.menuIndex === 1) {
        this.newGame();
      } else {
        this.state = 'menu';
        this.menuIndex = 0;
        this.music.stop();
      }
    }
  }

  updateGameover() {
    if (this.input.pressed(Keys.SELECT) || this.input.pressed(Keys.BACK)) {
      this.state = 'menu';
      this.menuIndex = 0;
    }
  }

  // ---- gameplay ------------------------------------------------------

  updatePlaying(dt) {
    if (this.input.pressed(Keys.BACK)) {
      this.state = 'paused';
      this.menuIndex = 0;
      this.music.pause();
      return;
    }

    const shipAlive = this.respawnTimer <= 0;
    const c = shipAlive ? this.controls.update() : { rotate: 0, speedDelta: 0 };

    if (shipAlive) {
      if (c.speedDelta !== 0) {
        this.ship.speedLevel = Math.max(0, Math.min(
          CFG.ship.maxSpeedLevel, this.ship.speedLevel + c.speedDelta));
      }
      this.ship.update(dt, c);
      this.shipTrail.push({ t: this.time, x: this.ship.x, y: this.ship.y });
      const maxDelay = (CFG.orb.max + 1) * CFG.orb.trailDelay;
      while (this.shipTrail.length && this.shipTrail[0].t < this.time - maxDelay) {
        this.shipTrail.shift();
      }
      this.fireCooldown -= dt;
      // The ship's cannon is fully automatic — no fire button. The
      // on-screen cap only counts the ship's own shots, not orb shots,
      // and scales with the volley size so spread doesn't choke itself.
      const shipShots = this.bullets.reduce((n, b) => n + (b.fromOrb ? 0 : 1), 0);
      const volley = this.hasSpread ? CFG.spread.count : 1;
      if (this.fireCooldown <= 0 && shipShots < CFG.bullet.max * volley) {
        if (this.hasSpread) {
          const mid = (CFG.spread.count - 1) / 2;
          for (let i = 0; i < CFG.spread.count; i++) {
            this.bullets.push(
              Bullet.fromShip(this.ship, (i - mid) * CFG.spread.angleStep));
          }
          this.fireCooldown = CFG.bullet.cooldown * CFG.spread.cooldownMult;
        } else {
          this.bullets.push(Bullet.fromShip(this.ship));
          this.fireCooldown = CFG.bullet.cooldown;
        }
      }
      this.missileCooldown -= dt;
      if (this.hasMissiles && this.missileCooldown <= 0 && this.asteroids.length > 0) {
        this.missiles.push(new Missile(this.ship.x, this.ship.y, this.ship.angle));
        this.missileCooldown = CFG.missile.cooldown;
      }
      for (const orb of this.orbs) {
        orb.follow(this.shipTrail, this.time);
        orb.cooldown -= dt;
        if (orb.cooldown <= 0 && this.asteroids.length > 0) {
          const target = orb.nearestTarget(this.asteroids);
          const angle = Math.atan2(target.y - orb.y, target.x - orb.x);
          const shot = new Bullet(orb.x, orb.y, angle);
          shot.fromOrb = true;
          this.bullets.push(shot);
          orb.cooldown = CFG.orb.cooldown;
        }
      }
    } else {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.ship.reset();
        this.controls.reset();
      }
    }

    this.asteroids.forEach((a) => a.update(dt));
    this.bullets.forEach((b) => b.update(dt));
    this.missiles.forEach((m) => m.update(dt, this.asteroids));
    this.particles.forEach((p) => p.update(dt));
    this.pickups.forEach((p) => p.update(dt));
    this.bullets = this.bullets.filter((b) => !b.dead);
    this.missiles = this.missiles.filter((m) => !m.dead);
    this.particles = this.particles.filter((p) => !p.dead);
    this.pickups = this.pickups.filter((p) => !p.dead);
    if (this.nukeFlash > 0) this.nukeFlash -= dt;

    // Collect pickups.
    if (shipAlive) {
      for (const pickup of this.pickups) {
        if (!collides(this.ship, pickup)) continue;
        pickup.life = 0;
        this.collectPickup(pickup);
        const color =
          CFG.colors[pickup.type === 'orb' ? 'pickup' : pickup.type];
        explosion(this.particles, pickup.x, pickup.y, color, 8);
      }
      this.pickups = this.pickups.filter((p) => !p.dead);
    }

    // Bullets and missiles vs asteroids.
    for (const bullet of this.bullets) {
      const hit = this.asteroids.find((a) => collides(bullet, a));
      if (!hit) continue;
      bullet.life = 0;
      this.destroyAsteroid(hit);
    }
    this.bullets = this.bullets.filter((b) => !b.dead);
    for (const missile of this.missiles) {
      const hit = this.asteroids.find((a) => collides(missile, a));
      if (!hit) continue;
      missile.life = 0;
      this.destroyAsteroid(hit);
    }
    this.missiles = this.missiles.filter((m) => !m.dead);

    // Ship vs asteroids.
    if (shipAlive && this.ship.invuln <= 0) {
      const hit = this.asteroids.find((a) => collides(this.ship, a));
      if (hit) {
        explosion(this.particles, this.ship.x, this.ship.y, CFG.colors.ship, 24);
        this.orbs = [];       // classic Gradius rules: upgrades die with you
        this.shipTrail = [];
        this.missiles = [];
        this.hasMissiles = false;
        this.hasSpread = false;
        this.lives -= 1;
        if (this.lives <= 0) {
          this.state = 'gameover';
          this.music.stop();
          return;
        }
        this.respawnTimer = CFG.ship.respawnDelay;
      }
    }

    // Wave cleared?
    if (this.asteroids.length === 0) {
      this.waveTimer += dt;
      if (this.waveTimer >= CFG.wave.clearDelay) {
        this.waveTimer = 0;
        this.startWave();
      }
    }
  }

  // ---- rendering -----------------------------------------------------

  render() {
    const { ctx } = this;
    ctx.clearRect(0, 0, CFG.W, CFG.H);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CFG.W, CFG.H);

    switch (this.state) {
      case 'menu': this.renderMenu(); break;
      case 'playing':
      case 'paused':
      case 'gameover':
        this.renderWorld();
        if (this.state === 'paused') this.renderPaused();
        if (this.state === 'gameover') this.renderGameover();
        break;
    }
  }

  text(str, x, y, { size = 20, color = CFG.colors.text, align = 'center', glow = 0 } = {}) {
    const { ctx } = this;
    ctx.save();
    ctx.font = `${size}px "Courier New", monospace`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    if (glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = glow;
    }
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  menuList(items, startY, gap = 44) {
    items.forEach((label, i) => {
      const selected = i === this.menuIndex;
      const y = startY + i * gap;
      this.text(label, CFG.W / 2, y, {
        size: 24,
        color: selected ? CFG.colors.accent : CFG.colors.dim,
        glow: selected ? 12 : 0,
      });
      if (selected) {
        this.text('▶', CFG.W / 2 - 140, y, { size: 20, color: CFG.colors.accent });
      }
    });
  }

  renderMenu() {
    this.text('GRADIOIDS', CFG.W / 2, 150, { size: 52, color: CFG.colors.accent, glow: 18 });
    this.text(`HIGH SCORE  ${this.hiscore}`, CFG.W / 2, 215, { size: 18, color: CFG.colors.dim });
    this.menuList(['START'], 320);
    this.text('swipe ←→ rotate · ↑↓ speed', CFG.W / 2, 490, { size: 16, color: CFG.colors.dim });
    this.text('your ship fires automatically', CFG.W / 2, 520, { size: 16, color: CFG.colors.dim });
  }

  renderWorld() {
    const { ctx } = this;
    this.particles.forEach((p) => p.draw(ctx));
    this.asteroids.forEach((a) => a.draw(ctx));
    this.pickups.forEach((p) => p.draw(ctx, this.time));
    this.bullets.forEach((b) => b.draw(ctx));
    this.missiles.forEach((m) => m.draw(ctx, this.time));
    if (this.state !== 'gameover' && this.respawnTimer <= 0) {
      this.orbs.forEach((o) => o.draw(ctx, this.time));
      this.ship.draw(ctx, this.time);
    }

    // HUD
    this.text(`${this.score}`, 16, 26, { size: 22, align: 'left', glow: 6 });
    this.text(`WAVE ${this.wave}`, CFG.W - 16, 26, { size: 18, align: 'right', color: CFG.colors.dim });
    for (let i = 0; i < this.lives; i++) {
      ctx.save();
      ctx.translate(24 + i * 24, 54);
      ctx.rotate(-Math.PI / 2);
      ctx.strokeStyle = CFG.colors.ship;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-6, 6);
      ctx.lineTo(-6, -6);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // Speed level pips bottom-left, active weapons bottom-right.
    if (this.respawnTimer <= 0) {
      for (let i = 0; i < CFG.ship.maxSpeedLevel; i++) {
        const filled = i < this.ship.speedLevel;
        ctx.fillStyle = filled ? CFG.colors.accent : 'rgba(122, 160, 184, 0.35)';
        ctx.fillRect(16 + i * 16, CFG.H - 24, 10, 12);
      }
      let wx = CFG.W - 22;
      if (this.hasSpread) {
        this.text('S', wx, CFG.H - 18, { size: 16, color: CFG.colors.spread, glow: 6 });
        wx -= 22;
      }
      if (this.hasMissiles) {
        this.text('M', wx, CFG.H - 18, { size: 16, color: CFG.colors.missile, glow: 6 });
      }
    }

    if (this.nukeFlash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${(this.nukeFlash / 0.6) * 0.8})`;
      ctx.fillRect(0, 0, CFG.W, CFG.H);
    }

    if (this.state === 'playing' && this.asteroids.length === 0) {
      this.text(`WAVE ${this.wave + 1}`, CFG.W / 2, CFG.H / 2 - 60, {
        size: 32, color: CFG.colors.accent, glow: 14,
      });
    }
  }

  renderPaused() {
    this.dimOverlay();
    this.text('PAUSED', CFG.W / 2, 160, { size: 36, color: CFG.colors.accent, glow: 12 });
    this.menuList(['RESUME', 'RESTART', 'EXIT TO MENU'], 270);
  }

  renderGameover() {
    this.dimOverlay();
    this.text('GAME OVER', CFG.W / 2, 200, { size: 44, color: CFG.colors.danger, glow: 16 });
    this.text(`SCORE  ${this.score}`, CFG.W / 2, 280, { size: 26 });
    if (this.newHiscore) {
      this.text('NEW HIGH SCORE!', CFG.W / 2, 325, { size: 20, color: CFG.colors.bullet, glow: 10 });
    } else {
      this.text(`HIGH  ${this.hiscore}`, CFG.W / 2, 325, { size: 18, color: CFG.colors.dim });
    }
    this.text('pinch to continue', CFG.W / 2, 430, { size: 16, color: CFG.colors.dim });
  }

  dimOverlay() {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, 0, CFG.W, CFG.H);
  }
}
