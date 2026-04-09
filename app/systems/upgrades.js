// upgrades.js — One-time purchasable upgrades
import { state } from '../state.js';
import { recalcRates } from '../economy.js';

export const UPGRADES = [
  {
    id: 'clickBoost1',
    name: 'Reinforced Finger',
    desc: '+1 credit per click',
    cost: 50,
    currency: 'credits',
    apply() { state.creditsPerClick += 1; },
    req: () => state.totalClicks >= 10,
  },
  {
    id: 'clickBoost2',
    name: 'Neural Tap',
    desc: '2x click power',
    cost: 500,
    currency: 'credits',
    apply() { state.clickMult *= 2; },
    req: () => state.totalClicks >= 100,
  },
  {
    id: 'cpsMult1',
    name: 'Overclocked Grid',
    desc: '2x credits/sec',
    cost: 1000,
    currency: 'credits',
    apply() { state.globalCpsMult *= 2; recalcRates(); },
    req: () => state.creditsPerSec >= 5,
  },
  {
    id: 'cpsMult2',
    name: 'Dark Market Access',
    desc: '3x credits/sec',
    cost: 25000,
    currency: 'credits',
    apply() { state.globalCpsMult *= 3; recalcRates(); },
    req: () => state.creditsPerSec >= 100,
  },
  {
    id: 'energyUnlock',
    name: 'Grid Splice',
    desc: 'Unlocks energy generation',
    cost: 200,
    currency: 'credits',
    apply() { state.energyUnlocked = true; },
    req: () => (state.buildings['powerRelay'] || 0) >= 1,
  },
  {
    id: 'dataUnlock',
    name: 'Deep Net Probe',
    desc: 'Unlocks data generation',
    cost: 100,
    currency: 'credits',
    apply() { state.dataUnlocked = true; },
    req: () => (state.buildings['dataTerminal'] || 0) >= 1,
  },
  {
    id: 'clickBoost3',
    name: 'Cybernetic Arm',
    desc: '+5 credits per click, 3x click power',
    cost: 10000,
    currency: 'credits',
    apply() { state.creditsPerClick += 5; state.clickMult *= 3; },
    req: () => state.totalClicks >= 500,
  },
  {
    id: 'epsMult1',
    name: 'Reactor Boost',
    desc: '2x energy/sec',
    cost: 5000,
    currency: 'credits',
    apply() { state.globalEpsMult *= 2; recalcRates(); },
    req: () => state.energyPerSec >= 2,
  },
  {
    id: 'dpsMult1',
    name: 'Quantum Cache',
    desc: '2x data/sec',
    cost: 5000,
    currency: 'credits',
    apply() { state.globalDpsMult *= 2; recalcRates(); },
    req: () => state.dataPerSec >= 2,
  },
];

export function buyUpgrade(upgradeId) {
  const def = UPGRADES.find(u => u.id === upgradeId);
  if (!def) return false;
  if (state.purchasedUpgrades.includes(upgradeId)) return false;
  if (state[def.currency] < def.cost) return false;

  state[def.currency] -= def.cost;
  state.purchasedUpgrades.push(upgradeId);
  def.apply();
  return true;
}

export function getAvailableUpgrades() {
  return UPGRADES.filter(u =>
    !state.purchasedUpgrades.includes(u.id) && u.req()
  );
}
