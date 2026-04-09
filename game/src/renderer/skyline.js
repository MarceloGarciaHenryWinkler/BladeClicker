// skyline.js — Procedural cyberpunk skyline with parallax layers
import { pushQuad, width, height } from './glInit.js';
import { state } from '../state.js';
import { BUILDINGS, BUILDING_ORDER } from '../systems/buildings.js';

// --- Seeded PRNG (deterministic skyline per seed) ---
let seed = 42;
function rng() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}
function rngRange(min, max) { return min + rng() * (max - min); }

// --- Parallax layers (back to front) ---
const LAYER_CONFIGS = [
  { depth: 0.05, count: 20, hMin: 0.15, hMax: 0.35, baseY: 0.65, tint: [0.18, 0.15, 0.38], winChance: 0.18 },
  { depth: 0.15, count: 16, hMin: 0.18, hMax: 0.45, baseY: 0.68, tint: [0.24, 0.19, 0.48], winChance: 0.30 },
  { depth: 0.35, count: 12, hMin: 0.15, hMax: 0.50, baseY: 0.72, tint: [0.32, 0.25, 0.58], winChance: 0.45 },
  { depth: 1.00, count: 10, hMin: 0.10, hMax: 0.45, baseY: 0.75, tint: [0.40, 0.32, 0.68], winChance: 0.60 },
];

// Pre-generated building data per layer
const layers = [];

// --- Player-purchased buildings rendered in foreground ---
let purchasedBuildingCache = [];
let lastBuildingHash = '';

function generateBuilding(cfg, i) {
  const relW = rngRange(0.04, 0.10);
  const relH = rngRange(cfg.hMin, cfg.hMax);
  const x = rngRange(-0.02, 1.02 - relW);

  const hasAntenna = rng() > 0.5;
  const antennaH = hasAntenna ? rngRange(0.02, 0.05) : 0;
  const hasTower = rng() > 0.65;
  const towerW = hasTower ? relW * rngRange(0.25, 0.45) : 0;
  const towerH = hasTower ? rngRange(0.02, 0.06) : 0;

  const windows = [];
  const winCols = Math.max(2, Math.floor(relW * 800 / 6));
  const winRows = Math.max(3, Math.floor(relH * 800 / 8));
  for (let wy = 0; wy < winRows; wy++) {
    for (let wx = 0; wx < winCols; wx++) {
      if (rng() < cfg.winChance) {
        windows.push({
          cx: wx / winCols,
          cy: wy / winRows,
          hue: rng(),
          flickerSeed: rng() * 100,
          flickerSpeed: rngRange(0.15, 1.5),
        });
      }
    }
  }

  const neonSide = rng() > 0.5 ? 'left' : 'right';
  const neonHue = rng();
  const flickerSeed = rng() * 100;

  return { x, relW, relH, hasAntenna, antennaH, hasTower, towerW, towerH, windows, neonSide, neonHue, flickerSeed };
}

export function generateSkyline(newSeed) {
  seed = newSeed || 42;
  layers.length = 0;

  for (let li = 0; li < LAYER_CONFIGS.length; li++) {
    const cfg = LAYER_CONFIGS[li];
    const buildings = [];
    for (let i = 0; i < cfg.count; i++) {
      buildings.push(generateBuilding(cfg, i));
    }
    buildings.sort((a, b) => a.x - b.x);
    layers.push({ cfg, buildings });
  }
}

// Generate visual buildings from player purchases
function rebuildPurchasedBuildings() {
  let hash = '';
  for (const id of BUILDING_ORDER) {
    hash += (state.buildings[id] || 0) + ',';
  }
  if (hash === lastBuildingHash) return;
  lastBuildingHash = hash;

  purchasedBuildingCache = [];
  seed = 9999; // deterministic seed for purchased buildings

  const frontCfg = { winChance: 0.60 };
  let slot = 0;

  for (const id of BUILDING_ORDER) {
    const count = state.buildings[id] || 0;
    const def = BUILDINGS[id];
    if (count === 0) continue;

    // Each building type gets a size tier — taller tiers are bigger
    const tierIdx = BUILDING_ORDER.indexOf(id);
    const baseH = 0.12 + tierIdx * 0.06;
    const baseW = 0.05 + tierIdx * 0.01;

    for (let i = 0; i < count; i++) {
      const relW = baseW + rngRange(-0.01, 0.015);
      const relH = baseH + rngRange(-0.02, 0.04);
      // Spread evenly across screen width
      const totalSlots = Math.max(1, getOwnedBuildingCount());
      const x = 0.02 + (slot / (totalSlots + 1)) * 0.92 + rngRange(-0.02, 0.02);

      const windows = [];
      const winCols = Math.max(2, Math.floor(relW * 900 / 6));
      const winRows = Math.max(3, Math.floor(relH * 900 / 7));
      for (let wy = 0; wy < winRows; wy++) {
        for (let wx = 0; wx < winCols; wx++) {
          if (rng() < frontCfg.winChance) {
            windows.push({
              cx: wx / winCols,
              cy: wy / winRows,
              hue: rng(),
              flickerSeed: rng() * 100,
              flickerSpeed: rngRange(0.1, 1.2),
            });
          }
        }
      }

      const neonHue = tierIdx / BUILDING_ORDER.length;
      purchasedBuildingCache.push({
        x, relW, relH,
        hasAntenna: rng() > 0.4,
        antennaH: rngRange(0.01, 0.04),
        hasTower: rng() > 0.5,
        towerW: relW * rngRange(0.25, 0.4),
        towerH: rngRange(0.02, 0.05),
        windows,
        neonSide: rng() > 0.5 ? 'left' : 'right',
        neonHue,
        flickerSeed: rng() * 100,
        buildingId: id,
        tierIdx,
      });
      slot++;
    }
  }

  // Sort by position
  purchasedBuildingCache.sort((a, b) => a.x - b.x);
}

// --- Render the skyline ---
export function renderSkyline(time, dt) {
  const w = width;
  const h = height;
  const hw = w / 2;

  renderSkyGradient(w, h, hw);

  // Background layers
  for (let li = 0; li < layers.length; li++) {
    const { cfg, buildings } = layers[li];
    const tR = cfg.tint[0], tG = cfg.tint[1], tB = cfg.tint[2];
    const fogMul = 0.4 + cfg.depth * 0.6;

    for (let bi = 0; bi < buildings.length; bi++) {
      renderBuilding(buildings[bi], cfg.baseY, tR, tG, tB, fogMul, time, w, h, hw);
    }

    // Ground strip per layer
    pushQuad(-hw, cfg.baseY * h, w, 2, tR * 0.8, tG * 0.8, tB * 1.2, 0.5);
  }

  // Player-purchased buildings (foreground, bright and prominent)
  rebuildPurchasedBuildings();
  if (purchasedBuildingCache.length > 0) {
    const baseY = 0.75;
    for (let i = 0; i < purchasedBuildingCache.length; i++) {
      const b = purchasedBuildingCache[i];
      const tierT = b.tierIdx / 7;
      // Very bright — player's buildings must stand out clearly
      const tR = 0.55 + tierT * 0.25;
      const tG = 0.40 + tierT * 0.20;
      const tB = 0.70 + tierT * 0.25;
      renderBuilding(b, baseY, tR, tG, tB, 1.0, time, w, h, hw);

      // Extra glow bar at base for purchased buildings
      const bx = -hw + b.x * w;
      const bw = b.relW * w;
      const glowR = b.neonHue < 0.33 ? 0.8 : (b.neonHue < 0.66 ? 0.0 : 0.9);
      const glowG = b.neonHue < 0.33 ? 0.0 : (b.neonHue < 0.66 ? 0.8 : 0.0);
      const glowB = b.neonHue < 0.33 ? 0.9 : (b.neonHue < 0.66 ? 0.7 : 0.7);
      const glowA = 0.35 + Math.sin(time * 1.2 + i * 1.7) * 0.15;
      pushQuad(bx - 3, baseY * h - 4, bw + 6, 8, glowR, glowG, glowB, glowA);
    }
  }

  // Foreground ground plane
  pushQuad(-hw, h * 0.75, w, h * 0.25, 0.02, 0.02, 0.06, 1.0);

  // Ground reflection line
  pushQuad(-hw, h * 0.75, w, 2, 0.15, 0.10, 0.30, 0.6);

  // Wet ground reflections
  renderGroundReflections(time, w, h, hw);

  // Rain
  renderRain(dt || 0.016, w, h, hw);
}

function renderBuilding(b, baseY, tR, tG, tB, fogMul, time, w, h, hw) {
  const bx = -hw + b.x * w;
  const bw = b.relW * w;
  const bh = b.relH * h;
  const by = baseY * h - bh;

  // Building body
  pushQuad(bx, by, bw, bh, tR * fogMul, tG * fogMul, tB * fogMul, 1.0);

  // Darker edges
  const edgeW = Math.max(1, bw * 0.05);
  pushQuad(bx, by, edgeW, bh, 0.02, 0.02, 0.05, 0.7);
  pushQuad(bx + bw - edgeW, by, edgeW, bh, 0.02, 0.02, 0.05, 0.7);

  // Rooftop highlight (bright neon edge)
  pushQuad(bx, by, bw, 4, tR * 2.5, tG * 2.5, tB * 3.0, 0.9);

  // Antenna
  if (b.hasAntenna) {
    const ax = bx + bw * 0.45;
    const ah = b.antennaH * h;
    pushQuad(ax, by - ah, 2, ah, 0.20, 0.20, 0.40, 0.8);
    const blink = Math.sin(time * 2.5 + (b.flickerSeed || 0)) > 0.6;
    if (blink) {
      pushQuad(ax - 2, by - ah - 3, 6, 6, 1.0, 0.15, 0.2, 0.9);
    }
  }

  // Tower extension
  if (b.hasTower) {
    const tw = b.towerW * w;
    const th = b.towerH * h;
    const tx = bx + (bw - tw) * 0.5;
    pushQuad(tx, by - th, tw, th, tR * 0.9, tG * 0.9, tB * 1.3, 1.0);
  }

  // Neon accent strip (wide, bright)
  const neonAlpha = 0.5 + Math.sin(time * 0.8 + b.neonHue * 10) * 0.2;
  const neonW = Math.max(4, bw * 0.06);
  const neonX = b.neonSide === 'left' ? bx : bx + bw - neonW;
  const nr = b.neonHue < 0.33 ? 1.0 : (b.neonHue < 0.66 ? 0.0 : 1.0);
  const ng = b.neonHue < 0.33 ? 0.0 : (b.neonHue < 0.66 ? 1.0 : 0.1);
  const nb = b.neonHue < 0.33 ? 1.0 : (b.neonHue < 0.66 ? 0.9 : 0.8);
  pushQuad(neonX, by + bh * 0.03, neonW, bh * 0.94, nr, ng, nb, neonAlpha);

  // Windows
  renderWindows(b, bx, by, bw, bh, time, fogMul);
}

function renderWindows(b, bx, by, bw, bh, time, fogMul) {
  const wins = b.windows;
  const winW = Math.max(4, bw * 0.09);
  const winH = Math.max(4, bh * 0.025);
  const padX = bw * 0.10;
  const padY = bh * 0.06;
  const innerW = bw - padX * 2;
  const innerH = bh - padY * 2;

  for (let i = 0; i < wins.length; i++) {
    const win = wins[i];
    const wx = bx + padX + win.cx * innerW;
    const wy = by + padY + win.cy * innerH;

    const flicker = Math.sin(time * win.flickerSpeed + win.flickerSeed);
    if (flicker < -0.3) continue;

    const brightness = 0.6 + flicker * 0.4;
    const alpha = (0.6 + brightness * 0.4) * fogMul;

    let wr, wg, wb;
    if (win.hue < 0.3) {
      wr = 1.0 * brightness; wg = 0.75 * brightness; wb = 0.25 * brightness;
    } else if (win.hue < 0.6) {
      wr = 0.1 * brightness; wg = 0.9 * brightness; wb = 1.0 * brightness;
    } else if (win.hue < 0.8) {
      wr = 1.0 * brightness; wg = 0.2 * brightness; wb = 0.8 * brightness;
    } else {
      wr = 0.7 * brightness; wg = 0.75 * brightness; wb = 1.0 * brightness;
    }

    pushQuad(wx, wy, winW, winH, wr, wg, wb, alpha);
  }
}

function renderSkyGradient(w, h, hw) {
  const bands = 10;
  const bandH = h * 0.75 / bands;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const r = 0.02 + t * 0.08;
    const g = 0.01 + t * 0.03;
    const b = 0.07 + t * 0.12;
    pushQuad(-hw, i * bandH, w, bandH + 1, r, g, b, 1.0);
  }
}

function renderGroundReflections(time, w, h, hw) {
  const groundY = h * 0.76;
  const groundH = h * 0.23;

  // Reflections from purchased buildings
  for (let i = 0; i < purchasedBuildingCache.length; i++) {
    const b = purchasedBuildingCache[i];
    const bx = -hw + b.x * w;
    const bw = b.relW * w;
    const pulse = Math.sin(time * 0.5 + i * 2.1) * 0.5 + 0.5;

    const tierT = b.tierIdx / 7;
    const cr = 0.1 + tierT * 0.3;
    const cg = 0.2 + tierT * 0.1;
    const cb = 0.5 + tierT * 0.2;

    // Vertical reflection streak
    pushQuad(bx + bw * 0.3, groundY, bw * 0.4, groundH * 0.5, cr, cg, cb, 0.04 + pulse * 0.03);
  }

  // Ambient reflections
  for (let i = 0; i < 15; i++) {
    const px = ((i * 137.3 + 42.7) % 1.0);
    const py = ((i * 91.1 + 17.3) % 0.6);
    const pulse = Math.sin(time * 0.4 + i * 2.3) * 0.5 + 0.5;
    const rx = -hw + px * w;
    const ry = groundY + py * groundH;
    const rw = 20 + (i % 5) * 10;
    const ci = i % 4;
    const cr = ci === 0 ? 0.0 : ci === 1 ? 0.7 : ci === 2 ? 0.0 : 0.5;
    const cg = ci === 0 ? 0.7 : ci === 1 ? 0.0 : ci === 2 ? 0.8 : 0.15;
    const cb = ci === 0 ? 0.9 : ci === 1 ? 0.6 : ci === 2 ? 0.4 : 0.8;
    pushQuad(rx, ry, rw, 2, cr, cg, cb, 0.08 + pulse * 0.06);
  }
}

// --- Rain ---
const MAX_RAIN = 120;
const rain = new Float32Array(MAX_RAIN * 4);
let rainInited = false;

function initRain() {
  for (let i = 0; i < MAX_RAIN; i++) {
    const o = i * 4;
    rain[o    ] = Math.random();
    rain[o + 1] = Math.random();
    rain[o + 2] = 0.3 + Math.random() * 0.7;
    rain[o + 3] = 8 + Math.random() * 20;
  }
  rainInited = true;
}

function renderRain(dt, w, h, hw) {
  if (!rainInited) initRain();
  for (let i = 0; i < MAX_RAIN; i++) {
    const o = i * 4;
    rain[o + 1] += rain[o + 2] * dt * 0.8;
    rain[o]     += rain[o + 2] * dt * 0.05;
    if (rain[o + 1] > 1.0) { rain[o + 1] = -0.05; rain[o] = Math.random(); }
    if (rain[o] > 1.05) rain[o] = -0.05;
    const rx = -hw + rain[o] * w;
    const ry = rain[o + 1] * h;
    const rl = rain[o + 3];
    const alpha = 0.04 + rain[o + 2] * 0.07;
    pushQuad(rx, ry, 1, rl, 0.5, 0.55, 0.75, alpha);
  }
}

function getOwnedBuildingCount() {
  let count = 0;
  for (const id of BUILDING_ORDER) {
    count += state.buildings[id] || 0;
  }
  return count;
}

// Init
generateSkyline(42);
