import { Game } from './game.js';

const canvas = document.getElementById('screen');
const game = new Game(canvas);

let last = performance.now();
function frame(now) {
  // Clamp dt so a backgrounded tab doesn't teleport everything on resume.
  const dt = Math.min((now - last) / 1000, 1 / 20);
  last = now;
  game.update(dt);
  game.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
