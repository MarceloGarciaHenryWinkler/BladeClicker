// main.js — Bootstrap
import { state } from './state.js';
import { startLoop } from './gameLoop.js';
import { doClick, formatNum } from './economy.js';
import {
  initGL, beginFrame, endFrame, pushQuad,
  width, height,
} from './renderer/glInit.js';

function update(dt) {
  state.totalTime += dt;
  state.credits += state.creditsPerSec * dt;
  state.energy += state.energyPerSec * dt;
  state.data += state.dataPerSec * dt;
}

function render(alpha, dt) {
  // --- WebGL scene ---
  beginFrame();

  // Phase 3 test: draw some colored rectangles as proof of life
  // Ground plane
  pushQuad(-width / 2, height * 0.7, width, height * 0.3, 0.02, 0.02, 0.06, 1.0);

  // Test buildings (will be replaced by procedural skyline in Phase 4)
  const t = state.totalTime;
  for (let i = 0; i < 12; i++) {
    const bw = 30 + Math.sin(i * 3.7) * 20;
    const bh = 80 + Math.sin(i * 2.3) * 60;
    const bx = -width / 2 + i * (width / 12) + 10;
    const by = height * 0.7 - bh;
    // Slight color variation
    const hue = 0.55 + Math.sin(i * 1.1) * 0.1;
    const pulse = 0.3 + Math.sin(t * 0.5 + i) * 0.05;
    pushQuad(bx, by, bw, bh, hue * 0.15, pulse * 0.2, hue * 0.4, 1.0);

    // A few lit windows
    for (let wy = 0; wy < bh - 8; wy += 12) {
      for (let wx = 4; wx < bw - 6; wx += 10) {
        const lit = Math.sin(i * 7.1 + wx * 3.3 + wy * 2.7 + t * 0.3) > 0.3;
        if (lit) {
          pushQuad(bx + wx, by + wy + 4, 5, 6, 0.0, 0.9, 0.8, 0.7);
        }
      }
    }
  }

  endFrame();

  // --- HUD (DOM) ---
  const hud = document.getElementById('hud');
  if (!hud) return;

  let text = `Credits: ${formatNum(state.credits)}`;
  text += ` (${formatNum(state.creditsPerSec)}/s)`;
  if (state.energyUnlocked) text += ` | Energy: ${formatNum(state.energy)}`;
  if (state.dataUnlocked) text += ` | Data: ${formatNum(state.data)}`;
  text += ` | Clicks: ${state.totalClicks}`;
  hud.textContent = text;
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

  console.log('BladeClicker booting...');
  startLoop(update, render);
  console.log('Game loop started.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
