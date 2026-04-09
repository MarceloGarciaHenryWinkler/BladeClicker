// ui.js — HUD and UI update orchestration
import { state } from '../state.js';
import { formatNum } from '../economy.js';
import { initPanels, updatePanels } from './panels.js';
import { setMasterVolume } from '../audio/synth.js';
import { stopAmbient, startAmbient, isAmbientPlaying } from '../audio/music.js';
import { saveGame, deleteSave } from '../systems/saveLoad.js';
import { popNotification } from '../progression.js';

let hudCredits, hudCps, hudEnergy, hudData, hudClicks;
let hudEnergyVal, hudDataVal;
let clickFeedbackPool = [];
const MAX_FEEDBACKS = 8;
let milestoneTimer = 0;

export function initUI() {
  hudCredits = document.getElementById('hudCredits');
  hudCps = document.getElementById('hudCps');
  hudEnergy = document.getElementById('hudEnergy');
  hudData = document.getElementById('hudData');
  hudClicks = document.getElementById('hudClicks');
  hudEnergyVal = hudEnergy.querySelector('.val');
  hudDataVal = hudData.querySelector('.val');

  // Click feedback pool (reusable floating text elements)
  const container = document.getElementById('clickFeedback');
  for (let i = 0; i < MAX_FEEDBACKS; i++) {
    const el = document.createElement('div');
    el.className = 'click-float';
    el.style.display = 'none';
    container.appendChild(el);
    clickFeedbackPool.push({ el, active: false });
  }

  // Listen for clicks on canvas for feedback effect
  document.getElementById('gameCanvas').addEventListener('click', onCanvasClick);

  // Mute toggle
  const muteBtn = document.getElementById('muteBtn');
  let muted = false;
  muteBtn.addEventListener('click', () => {
    muted = !muted;
    muteBtn.classList.toggle('muted', muted);
    muteBtn.textContent = muted ? 'MUTE' : 'SND';
    setMasterVolume(muted ? 0 : 0.3);
    if (muted) {
      stopAmbient();
    } else if (!isAmbientPlaying()) {
      startAmbient();
    }
  });

  // Save button
  document.getElementById('saveBtn').addEventListener('click', () => {
    if (saveGame()) {
      showToast('Game saved.');
    }
  });

  // Reset button
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (confirm('Wipe all progress? This cannot be undone.')) {
      deleteSave();
      location.reload();
    }
  });

  initPanels();
}

export function updateUI() {
  // HUD currencies
  hudCredits.textContent = formatNum(state.credits);
  hudCps.textContent = formatNum(state.creditsPerSec) + '/s';

  hudEnergy.style.display = state.energyUnlocked ? 'flex' : 'none';
  hudData.style.display = state.dataUnlocked ? 'flex' : 'none';

  if (state.energyUnlocked) {
    hudEnergyVal.textContent = formatNum(state.energy);
  }
  if (state.dataUnlocked) {
    hudDataVal.textContent = formatNum(state.data);
  }

  hudClicks.textContent = state.totalClicks;

  // Milestone notifications (check every ~0.5s to avoid spam)
  milestoneTimer++;
  if (milestoneTimer >= 30) { // ~0.5s at 60fps
    milestoneTimer = 0;
    const note = popNotification();
    if (note) showMilestone(note);
  }

  // Panels
  updatePanels();
}

// --- Click feedback (floating +N text) ---
let feedbackIdx = 0;

function onCanvasClick(e) {
  const amount = state.creditsPerClick * state.clickMult;
  const fb = clickFeedbackPool[feedbackIdx % MAX_FEEDBACKS];
  feedbackIdx++;

  fb.el.textContent = '+' + formatNum(amount);
  fb.el.style.display = 'block';
  fb.el.style.left = e.clientX + 'px';
  fb.el.style.top = e.clientY + 'px';
  fb.el.classList.remove('animate');

  // Force reflow to restart animation
  void fb.el.offsetWidth;
  fb.el.classList.add('animate');

  setTimeout(() => {
    fb.el.style.display = 'none';
    fb.el.classList.remove('animate');
  }, 800);
}

// --- Offline report modal ---
export function showOfflineReport(text) {
  const overlay = document.getElementById('offlineOverlay');
  const msg = document.getElementById('offlineMsg');
  msg.textContent = text;
  overlay.style.display = 'flex';
  document.getElementById('offlineDismiss').addEventListener('click', () => {
    overlay.style.display = 'none';
  }, { once: true });
}

// --- Toast notification ---
function showToast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2000);
}

// --- Milestone notification ---
function showMilestone(text) {
  const el = document.getElementById('milestone');
  el.textContent = text;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3500);
}
