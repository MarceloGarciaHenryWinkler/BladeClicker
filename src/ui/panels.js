// panels.js — Building and upgrade panel DOM generation
import { state } from '../state.js';
import { getBuildingCost, buyBuilding, formatNum } from '../economy.js';
import { BUILDINGS, BUILDING_ORDER } from '../systems/buildings.js';
import { getAvailableUpgrades, buyUpgrade } from '../systems/upgrades.js';
import { playBuy, playDeny } from '../audio/synth.js';

let buildingListEl = null;
let upgradeListEl = null;
let panelEl = null;
let activeTab = 'buildings';

export function initPanels() {
  panelEl = document.getElementById('sidePanel');
  buildingListEl = document.getElementById('buildingList');
  upgradeListEl = document.getElementById('upgradeList');

  // Tab buttons
  document.getElementById('tabBuildings').addEventListener('click', () => setTab('buildings'));
  document.getElementById('tabUpgrades').addEventListener('click', () => setTab('upgrades'));

  // Toggle panel
  document.getElementById('panelToggle').addEventListener('click', togglePanel);

  setTab('buildings');
}

function setTab(tab) {
  activeTab = tab;
  document.getElementById('tabBuildings').classList.toggle('active', tab === 'buildings');
  document.getElementById('tabUpgrades').classList.toggle('active', tab === 'upgrades');
  buildingListEl.style.display = tab === 'buildings' ? 'block' : 'none';
  upgradeListEl.style.display = tab === 'upgrades' ? 'block' : 'none';
}

function togglePanel() {
  panelEl.classList.toggle('collapsed');
}

// Called every render frame — rebuild lists (cheap DOM diffing)
export function updatePanels() {
  if (panelEl.classList.contains('collapsed')) return;

  if (activeTab === 'buildings') {
    updateBuildings();
  } else {
    updateUpgrades();
  }
}

// --- Buildings ---
let lastBuildingHash = '';

function updateBuildings() {
  // Simple hash to avoid unnecessary DOM thrash
  let hash = '';
  for (const id of BUILDING_ORDER) {
    const owned = state.buildings[id] || 0;
    const cost = getBuildingCost(id);
    const canAfford = state.credits >= cost ? 1 : 0;
    const visible = state.credits >= BUILDINGS[id].unlockAt || owned > 0 ? 1 : 0;
    hash += `${id}:${owned}:${canAfford}:${visible}|`;
  }
  if (hash === lastBuildingHash) return;
  lastBuildingHash = hash;

  buildingListEl.innerHTML = '';

  for (const id of BUILDING_ORDER) {
    const def = BUILDINGS[id];
    const owned = state.buildings[id] || 0;
    const cost = getBuildingCost(id);
    const visible = state.credits >= def.unlockAt || owned > 0;

    if (!visible) continue;

    const canAfford = state.credits >= cost;
    const btn = document.createElement('button');
    btn.className = 'panel-btn' + (canAfford ? '' : ' disabled');
    btn.innerHTML =
      `<span class="btn-name">${def.name}</span>` +
      `<span class="btn-info">${def.desc}</span>` +
      `<span class="btn-cost">${formatNum(cost)} cr</span>` +
      `<span class="btn-owned">${owned}</span>`;

    btn.addEventListener('click', () => {
      if (buyBuilding(id)) {
        playBuy();
        lastBuildingHash = ''; // force refresh
      } else {
        playDeny();
      }
    });
    buildingListEl.appendChild(btn);
  }
}

// --- Upgrades ---
let lastUpgradeHash = '';

function updateUpgrades() {
  const available = getAvailableUpgrades();
  let hash = available.map(u => u.id + (state.credits >= u.cost ? '1' : '0')).join('|');
  if (hash === lastUpgradeHash) return;
  lastUpgradeHash = hash;

  upgradeListEl.innerHTML = '';

  if (available.length === 0) {
    upgradeListEl.innerHTML = '<div class="panel-empty">No upgrades available</div>';
    return;
  }

  for (const upg of available) {
    const canAfford = state[upg.currency] >= upg.cost;
    const btn = document.createElement('button');
    btn.className = 'panel-btn upgrade-btn' + (canAfford ? '' : ' disabled');
    btn.innerHTML =
      `<span class="btn-name">${upg.name}</span>` +
      `<span class="btn-info">${upg.desc}</span>` +
      `<span class="btn-cost">${formatNum(upg.cost)} ${upg.currency}</span>`;

    btn.addEventListener('click', () => {
      if (buyUpgrade(upg.id)) {
        playBuy();
        lastUpgradeHash = '';
      } else {
        playDeny();
      }
    });
    upgradeListEl.appendChild(btn);
  }
}
