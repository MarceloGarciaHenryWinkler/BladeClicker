// state.js — Central game state
export const state = {
  // Currencies
  credits: 0,
  energy: 0,
  data: 0,

  // Rates (per second)
  creditsPerSec: 0,
  energyPerSec: 0,
  dataPerSec: 0,

  // Click
  creditsPerClick: 1,
  clickMult: 1,
  totalClicks: 0,

  // Global multipliers (from upgrades)
  globalCpsMult: 1,
  globalEpsMult: 1,
  globalDpsMult: 1,

  // Timing
  lastTick: 0,
  totalTime: 0,

  // Buildings owned (keyed by building id)
  buildings: {},

  // Upgrades purchased
  purchasedUpgrades: [],

  // Unlock flags
  energyUnlocked: false,
  dataUnlocked: false,

  // Flags
  paused: false,
};
