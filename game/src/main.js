// main.js — Bootstrap
import { state } from './state.js';
import { startLoop } from './gameLoop.js';
import { doClick } from './economy.js';
import { initGL, beginFrame, endFrame } from './renderer/glInit.js';
import { renderSkyline } from './renderer/skyline.js';
import { initUI, updateUI } from './ui/ui.js';

function update(dt) {
  state.totalTime += dt;
  state.credits += state.creditsPerSec * dt;
  state.energy += state.energyPerSec * dt;
  state.data += state.dataPerSec * dt;
}

function render(alpha, dt) {
  // --- WebGL scene ---
  beginFrame(state.totalTime);
  renderSkyline(state.totalTime);
  endFrame();

  // --- DOM UI ---
  updateUI();
}

function onClick() {
  doClick();
}

function boot() {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) {
    console.error('No canvas element found');
    return;
  }

  // Init WebGL
  try {
    initGL(canvas);
    console.log('WebGL initialized.');
  } catch (e) {
    console.error('WebGL init failed:', e);
    return;
  }

  canvas.addEventListener('click', onClick);

  // Init UI
  initUI();

  console.log('BladeClicker booting...');
  startLoop(update, render);
  console.log('Game loop started.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
