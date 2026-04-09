// gameLoop.js — Fixed-timestep game loop
const TICK_RATE = 1000 / 20; // 20 ticks per second
let accumulator = 0;
let lastFrame = 0;
let updateFn = null;
let renderFn = null;

function frame(timestamp) {
  if (lastFrame === 0) lastFrame = timestamp;
  const delta = Math.min(timestamp - lastFrame, 200); // cap to avoid spiral
  lastFrame = timestamp;
  accumulator += delta;

  while (accumulator >= TICK_RATE) {
    if (updateFn) updateFn(TICK_RATE / 1000);
    accumulator -= TICK_RATE;
  }

  const alpha = accumulator / TICK_RATE;
  if (renderFn) renderFn(alpha, delta / 1000);

  requestAnimationFrame(frame);
}

export function startLoop(onUpdate, onRender) {
  updateFn = onUpdate;
  renderFn = onRender;
  lastFrame = 0;
  accumulator = 0;
  requestAnimationFrame(frame);
}
