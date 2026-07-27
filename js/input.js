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
//   left/right — step the spin state one notch: swiping against the
//                current rotation stops it, swiping again starts the
//                turn the other way; swiping with it is a no-op
//   up/down    — step the ship's speed level up or down
// Firing is not a control: the ship always auto-fires while alive.
export class Controls {
  constructor(input) {
    this.input = input;
    this.reset();
  }

  reset() {
    this.rotate = 0;      // -1 left, 0 none, 1 right
  }

  // Returns { rotate, speedDelta } for this frame.
  update() {
    const { input } = this;
    const spinStep =
      (input.pressed(Keys.RIGHT) ? 1 : 0) - (input.pressed(Keys.LEFT) ? 1 : 0);
    if (spinStep !== 0) {
      this.rotate = Math.max(-1, Math.min(1, this.rotate + spinStep));
    }
    return {
      rotate: this.rotate,
      speedDelta:
        (input.pressed(Keys.UP) ? 1 : 0) - (input.pressed(Keys.DOWN) ? 1 : 0),
    };
  }
}
