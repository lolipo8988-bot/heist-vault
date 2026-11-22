// Boot: wire the canvas, the input and the loop together. With ?shot=start|
// play|alarm|escape the game stages one fixed scene instead of playing,
// so screenshots are real renders of the game's own code.

import { CANVAS } from './config.js';
import { createGame, stepGame } from './game.js';
import { createInput, endFrame } from './input.js';
import { render } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
canvas.width = CANVAS.width;
canvas.height = CANVAS.height;

const ctx = canvas.getContext('2d');
const input = createInput(canvas);
const game = createGame();

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

window.__heist = { game, ready: false, shot };

if (shot) {
  stageShot(shot, game);
  render(ctx, game, game.time);
  window.__heist.ready = true;
} else {
  let last = performance.now();
  let elapsed = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;
    stepGame(game, dt, input);
    render(ctx, game, elapsed);
    endFrame(input);
    window.__heist.ready = true;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
