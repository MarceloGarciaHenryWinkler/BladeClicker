// main.js — Bootstrap
import { state } from './state.js';
import { startLoop } from './gameLoop.js';
import { doClick } from './economy.js';
import { initGL, beginFrame, endFrame } from './renderer/glInit.js';
import { renderSkyline } from './renderer/skyline.js';
import { initUI, updateUI, showOfflineReport } from './ui/ui.js';
import { initAudio, resumeAudio, playClick } from './audio/synth.js';
import { startAmbient, updateAmbient } from './audio/music.js';
import {
  loadGame, initSaveSystem, updateAutoSave,
  getOfflineReport, formatOfflineReport,
} from './systems/saveLoad.js';
import { initProgression, updateProgression } from './progression.js';

let audioStarted = false;

function ensureAudio() {
  if (audioStarted) return;
  audioStarted = true;
  initAudio();
  resumeAudio();
  startAmbient();
}

function update(dt) {
  state.totalTime += dt;
  state.credits += state.creditsPerSec * dt;
  state.energy += state.energyPerSec * dt;
  state.data += state.dataPerSec * dt;

  // Update ambient music (chord progression)
  if (audioStarted) updateAmbient(dt);

  // Milestones
  updateProgression();

  // Auto-save
  updateAutoSave(dt);
}

function render(alpha, dt) {
  // --- WebGL scene ---
  beginFrame(state.totalTime);
  renderSkyline(state.totalTime, dt);
  endFrame();

  // --- DOM UI ---
  updateUI();
}

function onClick() {
  ensureAudio();
  playClick();
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

  // Load saved game (before UI init so state is populated)
  const loaded = loadGame();
  if (loaded) console.log('Save loaded.');

  // Init progression (after load, before UI)
  initProgression();

  // Init UI
  initUI();

  // Show offline progress report if applicable
  const report = getOfflineReport();
  if (report) {
    const text = formatOfflineReport(report);
    if (text) showOfflineReport(text);
  }

  // Init save system (beforeunload, visibilitychange)
  initSaveSystem();

  // Start audio on any user interaction (needed for autoplay policy)
  document.addEventListener('click', ensureAudio, { once: true });
  document.addEventListener('keydown', ensureAudio, { once: true });

  console.log('BladeClicker booting...');
  startLoop(update, render);
  console.log('Game loop started.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
