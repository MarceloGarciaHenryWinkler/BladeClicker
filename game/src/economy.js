// economy.js — Currency generation, costs, and scaling
import { state } from './state.js';
import { BUILDINGS } from './systems/buildings.js';

// Cost formula: baseCost * scaleFactor ^ owned
export function getBuildingCost(buildingId) {
  const def = BUILDINGS[buildingId];
  if (!def) return Infinity;
  const owned = state.buildings[buildingId] || 0;
  return Math.floor(def.baseCost * Math.pow(def.scaleFactor, owned));
}

// Purchase a building if affordable
export function buyBuilding(buildingId) {
  const cost = getBuildingCost(buildingId);
  if (state.credits < cost) return false;

  state.credits -= cost;
  state.buildings[buildingId] = (state.buildings[buildingId] || 0) + 1;

  recalcRates();
  return true;
}

// Recalculate all per-second rates from owned buildings
export function recalcRates() {
  let cps = 0, eps = 0, dps = 0;

  for (const id in BUILDINGS) {
    const owned = state.buildings[id] || 0;
    if (owned === 0) continue;
    const def = BUILDINGS[id];
    cps += def.cps * owned;
    eps += (def.eps || 0) * owned;
    dps += (def.dps || 0) * owned;
  }

  // Apply global multipliers from upgrades
  state.creditsPerSec = cps * state.globalCpsMult;
  state.energyPerSec = eps * state.globalEpsMult;
  state.dataPerSec = dps * state.globalDpsMult;
}

// Handle a player click
export function doClick() {
  state.credits += state.creditsPerClick * state.clickMult;
  state.totalClicks++;
}

// Format large numbers compactly
export function formatNum(n) {
  if (n < 1e3) return Math.floor(n).toString();
  if (n < 1e6) return (n / 1e3).toFixed(1) + 'K';
  if (n < 1e9) return (n / 1e6).toFixed(2) + 'M';
  if (n < 1e12) return (n / 1e9).toFixed(2) + 'B';
  return (n / 1e12).toFixed(2) + 'T';
}
