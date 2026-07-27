import { CFG } from './config.js';

// Background music. Playback must be started from a user-gesture
// handler (browser autoplay rules), and the Audio API may be missing
// entirely (Node tests, exotic devices) — every method is safe to
// call regardless.
export class Music {
  constructor(src) {
    this.el = typeof Audio !== 'undefined' ? new Audio(src) : null;
    if (this.el) {
      this.el.loop = true;
      this.el.volume = CFG.audio.musicVolume;
    }
  }

  play() {
    if (this.el) this.el.play().catch(() => { /* autoplay blocked or unsupported */ });
  }

  pause() {
    if (this.el) this.el.pause();
  }

  stop() {
    if (this.el) {
      this.el.pause();
      this.el.currentTime = 0;
    }
  }
}
