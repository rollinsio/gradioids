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
    this.repeatKeys = new Set();
    target.addEventListener('keydown', (e) => {
      if (!ALL_KEYS.has(e.key)) return;
      e.preventDefault();
      // e.repeat is the OS auto-repeat: the browser telling us a key is
      // physically being held. That is the one signal a discrete tap
      // can never produce, which is why continuous input keys off it
      // rather than off a hold timer — the glasses deliver taps, so
      // they can never fall into a held state by accident.
      if (e.repeat) this.repeatKeys.add(e.key);
      else this.edgeKeys.add(e.key);
      this.downKeys.add(e.key);
    });
    target.addEventListener('keyup', (e) => {
      this.downKeys.delete(e.key);
      this.repeatKeys.delete(e.key);
    });
    // If the page loses focus mid-hold we never see the keyup.
    window.addEventListener('blur', () => {
      this.downKeys.clear();
      this.repeatKeys.clear();
    });
  }

  held(key) {
    return this.downKeys.has(key);
  }

  pressed(key) {
    return this.edgeKeys.has(key);
  }

  // True from the first auto-repeat until the key is released — i.e.
  // "this key is being held down", as distinct from tapped.
  repeating(key) {
    return this.repeatKeys.has(key);
  }

  // Call once per frame after update logic has run. Repeat state is
  // deliberately not cleared here: it lives until the keyup.
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
//
// On a real keyboard there is a second mode on top of that: hold left
// or right and the ship turns continuously for as long as you hold it,
// which is what a desktop player expects. It is gated on OS key repeat
// (see Input), so it exists on the web and cannot occur on the glasses.
// Speed stays tap-only in both — auto-repeat would slam the ship to
// full throttle in a couple of frames.
export class Controls {
  constructor(input) {
    this.input = input;
    this.reset();
  }

  // Stateless between frames — the pending turn lives on the ship, which
  // sweeps through it at CFG.ship.turnRate. Kept so callers can flush
  // the scheme on respawn without knowing that.
  reset() {}

  // Returns { turn, hold, speedDelta } for this frame. turn counts
  // swipe steps (+1 per right swipe, -1 per left); hold is -1/0/+1 for
  // a key being held down, which overrides stepping while it lasts.
  // Holding both directions cancels out.
  update() {
    const { input } = this;
    return {
      turn:
        (input.pressed(Keys.RIGHT) ? 1 : 0) - (input.pressed(Keys.LEFT) ? 1 : 0),
      hold:
        (input.repeating(Keys.RIGHT) ? 1 : 0) - (input.repeating(Keys.LEFT) ? 1 : 0),
      speedDelta:
        (input.pressed(Keys.UP) ? 1 : 0) - (input.pressed(Keys.DOWN) ? 1 : 0),
    };
  }
}
