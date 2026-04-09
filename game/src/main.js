// main.js — Bootstrap
import { state } from './state.js';
import { startLoop } from './gameLoop.js';

function update(dt) {
  state.totalTime += dt;
  state.credits += state.creditsPerSec * dt;
  state.energy += state.energyPerSec * dt;
  state.data += state.dataPerSec * dt;
}

function render(alpha, dt) {
  // Phase 1: simple HUD to confirm loop works
  const hud = document.getElementById('hud');
  if (hud) {
    hud.textContent =
      `Credits: ${Math.floor(state.credits)} | ` +
      `Energy: ${Math.floor(state.energy)} | ` +
      `Data: ${Math.floor(state.data)} | ` +
      `Time: ${state.totalTime.toFixed(1)}s`;
  }
}

function onClick() {
  state.credits += state.creditsPerClick;
}

function boot() {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) {
    console.error('No canvas element found');
    return;
  }

  // Temp: click anywhere to earn credits
  canvas.addEventListener('click', onClick);

  console.log('BladeClicker booting...');
  startLoop(update, render);
  console.log('Game loop started.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
