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

// Turns raw key state into flight controls under two schemes:
//
// 'hold' — controls are active while the key is held, like a keyboard.
//          Works if pinch-and-hold delivers clean keydown/keyup pairs.
// 'tap'  — each press toggles the control (tap left = start rotating
//          left, tap again = stop). A fallback in case held gestures
//          feel bad or don't repeat reliably on hardware.
//
// Both schemes are kept until we can test on the glasses. Firing is
// not a control: the ship always auto-fires while it's alive.
export class Controls {
  constructor(input, settings) {
    this.input = input;
    this.settings = settings;
    this.reset();
  }

  reset() {
    this.rotate = 0;      // -1 left, 0 none, 1 right
    this.thrust = false;
  }

  // Returns { rotate, thrust } for this frame.
  update() {
    const { input, settings } = this;
    if (settings.scheme === 'tap') {
      if (input.pressed(Keys.LEFT)) this.rotate = this.rotate === -1 ? 0 : -1;
      if (input.pressed(Keys.RIGHT)) this.rotate = this.rotate === 1 ? 0 : 1;
      if (input.pressed(Keys.UP)) this.thrust = !this.thrust;
      if (input.pressed(Keys.DOWN)) {
        // Panic button: stop rotating and thrusting.
        this.rotate = 0;
        this.thrust = false;
      }
      return { rotate: this.rotate, thrust: this.thrust };
    }

    // 'hold' scheme
    const left = input.held(Keys.LEFT);
    const right = input.held(Keys.RIGHT);
    return {
      rotate: left === right ? 0 : left ? -1 : 1,
      thrust: input.held(Keys.UP),
    };
  }
}
