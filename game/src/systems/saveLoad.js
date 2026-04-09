// saveLoad.js — LocalStorage persistence + offline progress
import { state } from '../state.js';
import { recalcRates, formatNum } from '../economy.js';
import { UPGRADES } from './upgrades.js';

const SAVE_KEY = 'bladeclicker_save';
const SAVE_VERSION = 1;
const AUTO_SAVE_INTERVAL = 30; // seconds

// Fields to persist
const SAVE_FIELDS = [
  'credits', 'energy', 'data',
  'creditsPerClick', 'clickMult', 'totalClicks',
  'globalCpsMult', 'globalEpsMult', 'globalDpsMult',
  'buildings', 'purchasedUpgrades',
  'energyUnlocked', 'dataUnlocked',
  'totalTime',
];

let autoSaveTimer = 0;
let offlineReport = null;

export function saveGame() {
  const data = { _v: SAVE_VERSION, _t: Date.now() };
  for (const key of SAVE_FIELDS) {
    const val = state[key];
    // Deep copy objects/arrays to avoid reference issues
    if (typeof val === 'object' && val !== null) {
      data[key] = JSON.parse(JSON.stringify(val));
    } else {
      data[key] = val;
    }
  }

  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn('Save failed:', e);
    return false;
  }
}

export function loadGame() {
  let raw;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch (e) {
    console.warn('Load failed:', e);
    return false;
  }

  if (!raw) return false;

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.warn('Save data corrupt:', e);
    return false;
  }

  if (!data || data._v !== SAVE_VERSION) {
    console.warn('Save version mismatch, ignoring save');
    return false;
  }

  // Restore state fields
  for (const key of SAVE_FIELDS) {
    if (key in data) {
      if (typeof data[key] === 'object' && data[key] !== null) {
        state[key] = JSON.parse(JSON.stringify(data[key]));
      } else {
        state[key] = data[key];
      }
    }
  }

  // Re-apply upgrade effects
  // Reset derived values first so upgrades stack correctly
  state.creditsPerClick = 1;
  state.clickMult = 1;
  state.globalCpsMult = 1;
  state.globalEpsMult = 1;
  state.globalDpsMult = 1;
  state.energyUnlocked = false;
  state.dataUnlocked = false;

  const purchased = state.purchasedUpgrades.slice();
  state.purchasedUpgrades = [];

  for (const id of purchased) {
    const def = UPGRADES.find(u => u.id === id);
    if (def) {
      state.purchasedUpgrades.push(id);
      def.apply();
    }
  }

  // Recalc rates with current buildings + multipliers
  recalcRates();

  // Calculate offline progress
  const savedTime = data._t || 0;
  if (savedTime > 0) {
    const elapsed = (Date.now() - savedTime) / 1000;
    if (elapsed > 2) { // only if >2 seconds offline
      const offlineCredits = state.creditsPerSec * elapsed;
      const offlineEnergy = state.energyPerSec * elapsed;
      const offlineData = state.dataPerSec * elapsed;

      // Cap offline progress at 8 hours worth
      const maxOffline = 8 * 3600;
      const cappedElapsed = Math.min(elapsed, maxOffline);
      const ratio = cappedElapsed / elapsed;

      state.credits += offlineCredits * ratio;
      state.energy += offlineEnergy * ratio;
      state.data += offlineData * ratio;

      // Store report for UI to display
      offlineReport = {
        elapsed: cappedElapsed,
        credits: offlineCredits * ratio,
        energy: offlineEnergy * ratio,
        data: offlineData * ratio,
      };
    }
  }

  return true;
}

export function deleteSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    console.warn('Delete save failed:', e);
  }
}

export function hasSave() {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch (e) {
    return false;
  }
}

// Called from game loop update
export function updateAutoSave(dt) {
  autoSaveTimer += dt;
  if (autoSaveTimer >= AUTO_SAVE_INTERVAL) {
    autoSaveTimer = 0;
    saveGame();
  }
}

// Get and clear offline report
export function getOfflineReport() {
  const r = offlineReport;
  offlineReport = null;
  return r;
}

// Format time duration
function formatTime(seconds) {
  if (seconds < 60) return Math.floor(seconds) + 's';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ' + Math.floor(seconds % 60) + 's';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h + 'h ' + m + 'm';
}

// Build offline report text for UI
export function formatOfflineReport(report) {
  if (!report) return null;
  let msg = `Welcome back! (${formatTime(report.elapsed)} offline)\n`;
  if (report.credits > 0) msg += `+${formatNum(report.credits)} credits\n`;
  if (report.energy > 0) msg += `+${formatNum(report.energy)} energy\n`;
  if (report.data > 0) msg += `+${formatNum(report.data)} data`;
  return msg;
}

// Wire up beforeunload for save on exit
export function initSaveSystem() {
  window.addEventListener('beforeunload', () => {
    saveGame();
  });

  // Also save on visibility change (tab switch on mobile)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) saveGame();
  });
}
