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
  { depth: 0.05, count: 20, hMin: 0.08, hMax: 0.20, baseY: 0.65, tint: [0.15, 0.12, 0.30], winChance: 0.15 },
  { depth: 0.15, count: 16, hMin: 0.10, hMax: 0.28, baseY: 0.68, tint: [0.20, 0.16, 0.38], winChance: 0.25 },
  { depth: 0.35, count: 12, hMin: 0.10, hMax: 0.32, baseY: 0.72, tint: [0.28, 0.22, 0.50], winChance: 0.35 },
  { depth: 1.00, count: 10, hMin: 0.08, hMax: 0.28, baseY: 0.75, tint: [0.35, 0.28, 0.60], winChance: 0.50 },
];

// Pre-generated building data per layer
const layers = [];

// --- Player-purchased buildings ---
let purchasedBuildingCache = [];
let lastBuildingHash = '';

// Neon color palette for each building tier (bright, saturated)
const TIER_COLORS = [
  { r: 0.0, g: 0.9, b: 1.0 },  // neonSign: cyan
  { r: 0.0, g: 1.0, b: 0.6 },  // dataTerminal: mint green
  { r: 1.0, g: 0.6, b: 0.0 },  // powerRelay: orange
  { r: 1.0, g: 0.0, b: 0.8 },  // holoBoard: magenta
  { r: 0.6, g: 0.0, b: 1.0 },  // synthLab: purple
  { r: 0.0, g: 0.5, b: 1.0 },  // skyTower: blue
  { r: 1.0, g: 1.0, b: 0.0 },  // aiCore: yellow
  { r: 1.0, g: 0.2, b: 0.2 },  // orbitalLink: red
];

function generateBuilding(cfg) {
  const relW = rngRange(0.04, 0.10);
  const relH = rngRange(cfg.hMin, cfg.hMax);
  const x = rngRange(-0.02, 1.02 - relW);
  const hasAntenna = rng() > 0.5;
  const antennaH = hasAntenna ? rngRange(0.02, 0.05) : 0;
  const neonSide = rng() > 0.5 ? 'left' : 'right';
  const neonHue = rng();
  const flickerSeed = rng() * 100;

  const windows = [];
  const winCols = Math.max(2, Math.floor(relW * 800 / 6));
  const winRows = Math.max(3, Math.floor(relH * 800 / 8));
  for (let wy = 0; wy < winRows; wy++) {
    for (let wx = 0; wx < winCols; wx++) {
      if (rng() < cfg.winChance) {
        windows.push({ cx: wx / winCols, cy: wy / winRows, hue: rng(), flickerSeed: rng() * 100, flickerSpeed: rngRange(0.15, 1.5) });
      }
    }
  }

  return { x, relW, relH, hasAntenna, antennaH, windows, neonSide, neonHue, flickerSeed };
}

export function generateSkyline(newSeed) {
  seed = newSeed || 42;
  layers.length = 0;
  for (let li = 0; li < LAYER_CONFIGS.length; li++) {
    const cfg = LAYER_CONFIGS[li];
    const buildings = [];
    for (let i = 0; i < cfg.count; i++) {
      buildings.push(generateBuilding(cfg));
    }
    buildings.sort((a, b) => a.x - b.x);
    layers.push({ cfg, buildings });
  }
}

// Rebuild cache when building counts change
function rebuildPurchasedBuildings() {
  let hash = '';
  for (const id of BUILDING_ORDER) {
    hash += (state.buildings[id] || 0) + ',';
  }
  if (hash === lastBuildingHash) return;
  lastBuildingHash = hash;

  purchasedBuildingCache = [];
  seed = 9999;

  let slot = 0;
  const totalSlots = getOwnedBuildingCount();

  for (let ti = 0; ti < BUILDING_ORDER.length; ti++) {
    const id = BUILDING_ORDER[ti];
    const count = state.buildings[id] || 0;
    if (count === 0) continue;

    for (let i = 0; i < count; i++) {
      // Size scales with tier
      const relW = 0.04 + ti * 0.008 + rngRange(-0.005, 0.005);
      const relH = 0.10 + ti * 0.05 + rngRange(-0.015, 0.02);
      // Evenly spread across screen
      const x = 0.02 + (slot / Math.max(1, totalSlots + 1)) * 0.92 + rngRange(-0.01, 0.01);

      // Windows
      const windows = [];
      const winCols = Math.max(2, Math.floor(relW * 120));
      const winRows = Math.max(3, Math.floor(relH * 50));
      for (let wy = 0; wy < winRows; wy++) {
        for (let wx = 0; wx < winCols; wx++) {
          if (rng() < 0.5) {
            windows.push({ cx: wx / winCols, cy: wy / winRows, flickerSeed: rng() * 100, flickerSpeed: rngRange(0.2, 1.5) });
          }
        }
      }

      purchasedBuildingCache.push({
        x, relW, relH, tierIdx: ti, windows,
        hasAntenna: rng() > 0.4,
        antennaH: rngRange(0.015, 0.04),
        flickerSeed: rng() * 100,
      });
      slot++;
    }
  }

  purchasedBuildingCache.sort((a, b) => a.x - b.x);
}

// --- Main render ---
export function renderSkyline(time, dt) {
  const w = width;
  const h = height;
  const hw = w / 2;

  // 1. Sky gradient
  renderSkyGradient(w, h, hw);

  // 2. Background layers (distant buildings)
  for (let li = 0; li < layers.length; li++) {
    const { cfg, buildings } = layers[li];
    const tR = cfg.tint[0], tG = cfg.tint[1], tB = cfg.tint[2];
    for (let bi = 0; bi < buildings.length; bi++) {
      renderBgBuilding(buildings[bi], cfg.baseY, tR, tG, tB, time, w, h, hw);
    }
    // Horizon line per layer
    pushQuad(-hw, cfg.baseY * h, w, 1, tR * 1.5, tG * 1.5, tB * 1.5, 0.3);
  }

  // 3. Ground plane (BEFORE purchased buildings)
  const groundY = h * 0.75;
  pushQuad(-hw, groundY, w, h * 0.25, 0.03, 0.02, 0.08, 1.0);

  // 4. Ground horizon glow line
  pushQuad(-hw, groundY - 1, w, 3, 0.3, 0.15, 0.6, 0.7);

  // 5. Wet ground reflections
  renderGroundReflections(time, w, h, hw);

  // 6. PURCHASED BUILDINGS — rendered LAST (on top of ground)
  rebuildPurchasedBuildings();
  renderPurchasedBuildings(time, w, h, hw);

  // 7. Rain (on top of everything)
  renderRain(dt || 0.016, w, h, hw);
}

// --- Purchased building rendering (completely rewritten) ---
function renderPurchasedBuildings(time, w, h, hw) {
  const groundY = h * 0.75;

  for (let i = 0; i < purchasedBuildingCache.length; i++) {
    const b = purchasedBuildingCache[i];
    const tc = TIER_COLORS[b.tierIdx] || TIER_COLORS[0];

    const bw = b.relW * w;
    const bh = b.relH * h;
    const bx = -hw + b.x * w;
    const by = groundY - bh; // building rises up from ground

    // Building body — dark but clearly distinct from background
    const bodyR = tc.r * 0.25 + 0.08;
    const bodyG = tc.g * 0.25 + 0.06;
    const bodyB = tc.b * 0.25 + 0.15;
    pushQuad(bx, by, bw, bh, bodyR, bodyG, bodyB, 1.0);

    // Left edge highlight
    pushQuad(bx, by, 2, bh, tc.r * 0.5, tc.g * 0.5, tc.b * 0.5, 0.8);
    // Right edge highlight
    pushQuad(bx + bw - 2, by, 2, bh, tc.r * 0.5, tc.g * 0.5, tc.b * 0.5, 0.8);

    // Rooftop — bright neon line
    pushQuad(bx - 1, by - 2, bw + 2, 4, tc.r, tc.g, tc.b, 0.9);

    // Rooftop glow (wider, faded)
    pushQuad(bx - 4, by - 5, bw + 8, 6, tc.r, tc.g, tc.b, 0.25);

    // Base glow at ground level
    pushQuad(bx - 3, groundY - 3, bw + 6, 6, tc.r, tc.g, tc.b, 0.4);

    // Antenna with blinking light
    if (b.hasAntenna) {
      const ax = bx + bw * 0.5 - 1;
      const ah = b.antennaH * h;
      pushQuad(ax, by - ah, 2, ah, 0.4, 0.4, 0.6, 0.9);
      const blink = Math.sin(time * 3.0 + b.flickerSeed) > 0.5;
      if (blink) {
        pushQuad(ax - 2, by - ah - 4, 6, 6, 1.0, 0.1, 0.2, 1.0);
      }
    }

    // Windows — bright colored squares
    const wins = b.windows;
    const padX = bw * 0.12;
    const padY = bh * 0.08;
    const innerW = bw - padX * 2;
    const innerH = bh - padY * 2;
    const winW = Math.max(3, bw * 0.08);
    const winH = Math.max(3, bh * 0.04);

    for (let wi = 0; wi < wins.length; wi++) {
      const win = wins[wi];
      const wx = bx + padX + win.cx * (innerW - winW);
      const wy = by + padY + win.cy * (innerH - winH);

      const flicker = Math.sin(time * win.flickerSpeed + win.flickerSeed);
      if (flicker < -0.4) continue; // window off

      const bright = 0.7 + flicker * 0.3;
      // Use the tier color for windows, with brightness variation
      pushQuad(wx, wy, winW, winH, tc.r * bright, tc.g * bright, tc.b * bright, 0.9);
    }

    // Vertical neon stripe on one side
    const stripeW = Math.max(3, bw * 0.05);
    const stripeX = (i % 2 === 0) ? bx + 3 : bx + bw - stripeW - 3;
    const stripeAlpha = 0.4 + Math.sin(time * 0.6 + i * 2.0) * 0.15;
    pushQuad(stripeX, by + bh * 0.05, stripeW, bh * 0.9, tc.r, tc.g, tc.b, stripeAlpha);
  }
}

// --- Background buildings (simplified) ---
function renderBgBuilding(b, baseY, tR, tG, tB, time, w, h, hw) {
  const bx = -hw + b.x * w;
  const bw = b.relW * w;
  const bh = b.relH * h;
  const by = baseY * h - bh;

  // Body
  pushQuad(bx, by, bw, bh, tR, tG, tB, 1.0);

  // Rooftop edge
  pushQuad(bx, by, bw, 2, tR * 2.0, tG * 2.0, tB * 2.0, 0.6);

  // Antenna
  if (b.hasAntenna) {
    const ax = bx + bw * 0.45;
    const ah = b.antennaH * h;
    pushQuad(ax, by - ah, 2, ah, 0.15, 0.15, 0.30, 0.7);
    if (Math.sin(time * 2.5 + b.flickerSeed) > 0.6) {
      pushQuad(ax - 2, by - ah - 3, 6, 6, 1.0, 0.15, 0.2, 0.8);
    }
  }

  // Windows
  const wins = b.windows;
  const winW = Math.max(3, bw * 0.08);
  const winH = Math.max(3, bh * 0.03);
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
    const bright = 0.5 + flicker * 0.5;
    let wr, wg, wb;
    if (win.hue < 0.3) { wr = 1.0 * bright; wg = 0.7 * bright; wb = 0.2 * bright; }
    else if (win.hue < 0.6) { wr = 0.1 * bright; wg = 0.8 * bright; wb = 1.0 * bright; }
    else { wr = 0.8 * bright; wg = 0.2 * bright; wb = 1.0 * bright; }
    pushQuad(wx, wy, winW, winH, wr, wg, wb, 0.7);
  }
}

// --- Sky gradient ---
function renderSkyGradient(w, h, hw) {
  const bands = 12;
  const bandH = h * 0.75 / bands;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const r = 0.02 + t * 0.06;
    const g = 0.01 + t * 0.03;
    const b = 0.06 + t * 0.10;
    pushQuad(-hw, i * bandH, w, bandH + 1, r, g, b, 1.0);
  }
}

// --- Ground reflections ---
function renderGroundReflections(time, w, h, hw) {
  const groundY = h * 0.76;
  const groundH = h * 0.23;

  // Reflections from purchased buildings
  for (let i = 0; i < purchasedBuildingCache.length; i++) {
    const b = purchasedBuildingCache[i];
    const tc = TIER_COLORS[b.tierIdx] || TIER_COLORS[0];
    const bx = -hw + b.x * w;
    const bw = b.relW * w;
    const pulse = Math.sin(time * 0.5 + i * 2.1) * 0.5 + 0.5;
    // Colored reflection streak
    pushQuad(bx + bw * 0.2, groundY, bw * 0.6, groundH * 0.4, tc.r, tc.g, tc.b, 0.03 + pulse * 0.03);
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
    pushQuad(rx, ry, rw, 2, cr, cg, cb, 0.06 + pulse * 0.05);
  }
}

// --- Rain ---
const MAX_RAIN = 120;
const rain = new Float32Array(MAX_RAIN * 4);
let rainInited = false;

function initRain() {
  for (let i = 0; i < MAX_RAIN; i++) {
    const o = i * 4;
    rain[o] = Math.random();
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
    rain[o] += rain[o + 2] * dt * 0.05;
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
