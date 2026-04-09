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

  // Timing
  lastTick: 0,
  totalTime: 0,

  // Buildings owned
  buildings: [],

  // Flags
  paused: false,
};
