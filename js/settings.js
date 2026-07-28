import { CFG } from './config.js';

const STORE_KEY = 'gradioids.settings';
const DEG = Math.PI / 180;

const roundTo = (v, decimals) => Number(v.toFixed(decimals));

// The knobs the CONTROLS screen exposes. Each one reads and writes CFG
// in display units (degrees, px/s, levels) so the screen never has to
// know that the game thinks in radians. `step` is also the grid the
// value snaps to, and every default below already sits on that grid.
export const TUNABLES = [
  {
    key: 'turnStep',
    label: 'TURN / SWIPE',
    unit: '°',
    min: 5, max: 90, step: 5, decimals: 0,
    read: () => CFG.ship.turnStep / DEG,
    apply: (v) => { CFG.ship.turnStep = v * DEG; },
  },
  {
    key: 'turnRate',
    label: 'TURN SPEED',
    unit: ' rad/s',
    min: 1, max: 10, step: 0.2, decimals: 1,
    read: () => CFG.ship.turnRate,
    apply: (v) => { CFG.ship.turnRate = v; },
  },
  {
    key: 'turnBank',
    label: 'TURN BANK',
    unit: '°',
    min: 45, max: 720, step: 15, decimals: 0,
    read: () => CFG.ship.maxTurnQueue / DEG,
    apply: (v) => { CFG.ship.maxTurnQueue = v * DEG; },
  },
  {
    key: 'speedStep',
    label: 'SPEED / LEVEL',
    unit: ' px/s',
    min: 25, max: 200, step: 5, decimals: 0,
    read: () => CFG.ship.speedStep,
    apply: (v) => { CFG.ship.speedStep = v; },
  },
  {
    key: 'maxSpeedLevel',
    label: 'TOP SPEED',
    unit: '',
    min: 1, max: 8, step: 1, decimals: 0,
    read: () => CFG.ship.maxSpeedLevel,
    apply: (v) => { CFG.ship.maxSpeedLevel = v; },
  },
  {
    key: 'accel',
    label: 'ACCEL',
    unit: '/s',
    min: 0.5, max: 10, step: 0.5, decimals: 1,
    read: () => CFG.ship.accel,
    apply: (v) => { CFG.ship.accel = v; },
  },
];

// Snapshotted at import, before any Settings instance can write to CFG,
// so config.js stays the one source of truth for what "default" means.
export const DEFAULTS = Object.freeze(
  Object.fromEntries(TUNABLES.map((t) => [t.key, roundTo(t.read(), t.decimals)]))
);

// Live tuning: values are written straight into CFG, which the ship
// reads every frame, so an adjustment is felt on the next one. They
// also persist in localStorage, because the whole point is to find a
// feel on the glasses and keep it.
export class Settings {
  constructor() {
    this.defaults = { ...DEFAULTS };
    this.values = { ...this.defaults };
    this.load();
    this.applyAll();
  }

  clamp(t, v) {
    const snapped = Math.round(v / t.step) * t.step;
    return roundTo(Math.max(t.min, Math.min(t.max, snapped)), t.decimals);
  }

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      for (const t of TUNABLES) {
        const v = saved[t.key];
        if (typeof v === 'number' && Number.isFinite(v)) {
          this.values[t.key] = this.clamp(t, v);
        }
      }
    } catch { /* corrupt or unavailable storage: keep the defaults */ }
  }

  save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.values));
    } catch { /* non-fatal */ }
  }

  applyAll() {
    for (const t of TUNABLES) t.apply(this.values[t.key]);
  }

  // dir is +1 (right swipe) or -1 (left swipe).
  adjust(t, dir) {
    this.values[t.key] = this.clamp(t, this.values[t.key] + dir * t.step);
    t.apply(this.values[t.key]);
    this.save();
  }

  reset() {
    this.values = { ...this.defaults };
    this.applyAll();
    this.save();
  }

  isDefault(t) {
    return this.values[t.key] === this.defaults[t.key];
  }

  display(t) {
    return `${this.values[t.key].toFixed(t.decimals)}${t.unit}`;
  }
}
