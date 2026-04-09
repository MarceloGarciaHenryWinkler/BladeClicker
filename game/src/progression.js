// progression.js — Milestone tracking and notifications
import { state } from './state.js';
import { formatNum } from './economy.js';

const MILESTONES = [
  { id: 'm_100cr', check: () => state.credits >= 100, msg: 'First 100 credits earned' },
  { id: 'm_1kcr', check: () => state.credits >= 1000, msg: '1,000 credits — the city stirs' },
  { id: 'm_10kcr', check: () => state.credits >= 10000, msg: '10K credits — the grid hums' },
  { id: 'm_100kcr', check: () => state.credits >= 100000, msg: '100K credits — corporate attention' },
  { id: 'm_1mcr', check: () => state.credits >= 1000000, msg: '1M credits — megacorp tier' },
  { id: 'm_10clicks', check: () => state.totalClicks >= 10, msg: '10 clicks — warming up' },
  { id: 'm_100clicks', check: () => state.totalClicks >= 100, msg: '100 clicks — dedicated' },
  { id: 'm_1kclicks', check: () => state.totalClicks >= 1000, msg: '1,000 clicks — cybernetic' },
  { id: 'm_firstbuild', check: () => Object.values(state.buildings).some(v => v > 0), msg: 'First building purchased' },
  { id: 'm_energy', check: () => state.energyUnlocked, msg: 'Energy grid accessed' },
  { id: 'm_data', check: () => state.dataUnlocked, msg: 'Data streams online' },
];

let achieved = new Set();
let pendingNotifications = [];

export function initProgression() {
  // Mark already-achieved milestones (from loaded save)
  for (const m of MILESTONES) {
    if (m.check()) achieved.add(m.id);
  }
}

export function updateProgression() {
  for (const m of MILESTONES) {
    if (achieved.has(m.id)) continue;
    if (m.check()) {
      achieved.add(m.id);
      pendingNotifications.push(m.msg);
    }
  }
}

export function popNotification() {
  return pendingNotifications.shift() || null;
}
