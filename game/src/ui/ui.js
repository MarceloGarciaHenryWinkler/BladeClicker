// ui.js — HUD and UI update orchestration
import { state } from '../state.js';
import { formatNum } from '../economy.js';
import { initPanels, updatePanels } from './panels.js';

let hudCredits, hudCps, hudEnergy, hudData, hudClicks;
let clickFeedbackPool = [];
const MAX_FEEDBACKS = 8;

export function initUI() {
  hudCredits = document.getElementById('hudCredits');
  hudCps = document.getElementById('hudCps');
  hudEnergy = document.getElementById('hudEnergy');
  hudData = document.getElementById('hudData');
  hudClicks = document.getElementById('hudClicks');

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

  initPanels();
}

export function updateUI() {
  // HUD currencies
  hudCredits.textContent = formatNum(state.credits);
  hudCps.textContent = formatNum(state.creditsPerSec) + '/s';

  hudEnergy.style.display = state.energyUnlocked ? 'flex' : 'none';
  hudData.style.display = state.dataUnlocked ? 'flex' : 'none';

  if (state.energyUnlocked) {
    hudEnergy.querySelector('.val').textContent = formatNum(state.energy);
  }
  if (state.dataUnlocked) {
    hudData.querySelector('.val').textContent = formatNum(state.data);
  }

  hudClicks.textContent = state.totalClicks;

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
