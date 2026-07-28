// The glasses OS translates Neural Band pinches/swipes and the temple
// touch strip into plain keyboard events, so this is the entire
// hardware interface: six keys.
export const Keys = {
  UP: 'ArrowUp',
  DOWN: 'ArrowDown',
  LEFT: 'ArrowLeft',
  RIGHT: 'ArrowRight',
  SELECT: 'Enter',
  BACK: 'Escape',
};

const ALL_KEYS = new Set(Object.values(Keys));

export class Input {
  constructor(target = window) {
    this.downKeys = new Set();
    this.edgeKeys = new Set();
    target.addEventListener('keydown', (e) => {
      if (!ALL_KEYS.has(e.key)) return;
      e.preventDefault();
      if (!e.repeat) this.edgeKeys.add(e.key);
      this.downKeys.add(e.key);
    });
    target.addEventListener('keyup', (e) => {
      this.downKeys.delete(e.key);
    });
    // If the page loses focus mid-hold we never see the keyup.
    window.addEventListener('blur', () => this.downKeys.clear());
  }

  held(key) {
    return this.downKeys.has(key);
  }

  pressed(key) {
    return this.edgeKeys.has(key);
  }

  // Call once per frame after update logic has run.
  endFrame() {
    this.edgeKeys.clear();
  }
}

// Discrete swipe controls, matched to how the Neural Band delivers
// input (single key taps, no holds):
//   left/right — turn the ship by CFG.ship.turnStep, once per swipe;
//                the ship never spins on its own, so a swipe left
//                always means "point a bit further left"
//   up/down    — step the ship's speed level up or down
// Firing is not a control: the ship always auto-fires while alive.
export class Controls {
  constructor(input) {
    this.input = input;
    this.reset();
  }

  // Stateless between frames — the pending turn lives on the ship, which
  // sweeps through it at CFG.ship.turnRate. Kept so callers can flush
  // the scheme on respawn without knowing that.
  reset() {}

  // Returns { turn, speedDelta } for this frame, where turn counts swipe
  // steps: +1 per right swipe, -1 per left.
  update() {
    const { input } = this;
    return {
      turn:
        (input.pressed(Keys.RIGHT) ? 1 : 0) - (input.pressed(Keys.LEFT) ? 1 : 0),
      speedDelta:
        (input.pressed(Keys.UP) ? 1 : 0) - (input.pressed(Keys.DOWN) ? 1 : 0),
    };
  }
}
