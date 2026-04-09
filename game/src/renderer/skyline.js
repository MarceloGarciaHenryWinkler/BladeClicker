// skyline.js — Procedural cyberpunk skyline with parallax layers
import { pushQuad, width, height } from './glInit.js';
import { state } from '../state.js';
import { BUILDINGS, BUILDING_ORDER } from '../systems/buildings.js';

// --- Seeded PRNG ---
let seed = 42;
function rng() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}
function rngRange(min, max) { return min + rng() * (max - min); }

// Ground line at 88% — gives buildings lots of vertical space
const GROUND_Y = 0.88;

// Background layers: tall buildings filling most of the screen
const LAYER_CONFIGS = [
  { count: 25, hMin: 0.15, hMax: 0.50, baseY: 0.84, tint: [0.10, 0.08, 0.22], winChance: 0.12 },
  { count: 20, hMin: 0.20, hMax: 0.55, baseY: 0.85, tint: [0.14, 0.11, 0.30], winChance: 0.20 },
  { count: 15, hMin: 0.15, hMax: 0.50, baseY: 0.86, tint: [0.20, 0.15, 0.40], winChance: 0.35 },
  { count: 12, hMin: 0.10, hMax: 0.45, baseY: 0.87, tint: [0.28, 0.20, 0.52], winChance: 0.50 },
];

const layers = [];

// Purchased building cache
let purchasedBuildingCache = [];
let lastBuildingHash = '';

// Neon color palette per building tier
const TIER_COLORS = [
  { r: 0.0, g: 0.9, b: 1.0 },   // neonSign: cyan
  { r: 0.0, g: 1.0, b: 0.5 },   // dataTerminal: green
  { r: 1.0, g: 0.5, b: 0.0 },   // powerRelay: orange
  { r: 1.0, g: 0.0, b: 0.7 },   // holoBoard: magenta
  { r: 0.6, g: 0.0, b: 1.0 },   // synthLab: purple
  { r: 0.2, g: 0.5, b: 1.0 },   // skyTower: blue
  { r: 1.0, g: 0.9, b: 0.0 },   // aiCore: yellow
  { r: 1.0, g: 0.15, b: 0.15 }, // orbitalLink: red
];

function generateBgBuilding(cfg) {
  const relW = rngRange(0.03, 0.09);
  const relH = rngRange(cfg.hMin, cfg.hMax);
  const x = rngRange(0.0, 1.0 - relW);
  const flickerSeed = rng() * 100;
  const hasAntenna = rng() > 0.5;
  const antennaH = hasAntenna ? rngRange(0.01, 0.04) : 0;

  const windows = [];
  const winCols = Math.max(2, Math.floor(relW * 200));
  const winRows = Math.max(3, Math.floor(relH * 80));
  for (let wy = 0; wy < winRows; wy++) {
    for (let wx = 0; wx < winCols; wx++) {
      if (rng() < cfg.winChance) {
        windows.push({ cx: wx / winCols, cy: wy / winRows, hue: rng(), seed: rng() * 100, spd: rngRange(0.2, 2.0) });
      }
    }
  }
  return { x, relW, relH, flickerSeed, hasAntenna, antennaH, windows };
}

export function generateSkyline(newSeed) {
  seed = newSeed || 42;
  layers.length = 0;
  for (const cfg of LAYER_CONFIGS) {
    const buildings = [];
    for (let i = 0; i < cfg.count; i++) buildings.push(generateBgBuilding(cfg));
    buildings.sort((a, b) => a.x - b.x);
    layers.push({ cfg, buildings });
  }
}

// Rebuild purchased building visuals when counts change
function rebuildPurchasedBuildings() {
  let hash = '';
  for (const id of BUILDING_ORDER) hash += (state.buildings[id] || 0) + ',';
  if (hash === lastBuildingHash) return;
  lastBuildingHash = hash;

  purchasedBuildingCache = [];
  seed = 9999;
  let slot = 0;
  const total = getOwnedBuildingCount();

  for (let ti = 0; ti < BUILDING_ORDER.length; ti++) {
    const id = BUILDING_ORDER[ti];
    const count = state.buildings[id] || 0;
    if (!count) continue;

    for (let i = 0; i < count; i++) {
      const relW = 0.035 + ti * 0.007 + rngRange(-0.004, 0.004);
      const relH = 0.15 + ti * 0.07 + rngRange(-0.02, 0.03);
      const x = 0.01 + (slot / Math.max(1, total + 1)) * 0.94 + rngRange(-0.008, 0.008);

      const windows = [];
      const wc = Math.max(2, Math.floor(relW * 150));
      const wr = Math.max(4, Math.floor(relH * 60));
      for (let wy = 0; wy < wr; wy++) {
        for (let wx = 0; wx < wc; wx++) {
          if (rng() < 0.45) windows.push({ cx: wx / wc, cy: wy / wr, seed: rng() * 100, spd: rngRange(0.2, 1.5) });
        }
      }

      purchasedBuildingCache.push({
        x, relW, relH, tierIdx: ti, windows,
        hasAntenna: rng() > 0.35,
        antennaH: rngRange(0.02, 0.05),
        flickerSeed: rng() * 100,
        hasTower: rng() > 0.5,
        towerW: relW * rngRange(0.3, 0.5),
        towerH: rngRange(0.03, 0.07),
      });
      slot++;
    }
  }
  purchasedBuildingCache.sort((a, b) => a.x - b.x);
}

// ============ MAIN RENDER ============
export function renderSkyline(time, dt) {
  const w = width;
  const h = height;
  const hw = w / 2;
  const gy = GROUND_Y * h;

  // 1. Sky
  renderSky(w, h, hw, time);

  // 2. Background city layers (back to front)
  for (let li = 0; li < layers.length; li++) {
    const { cfg, buildings } = layers[li];
    const t = cfg.tint;
    // Fog strip between layers for depth
    if (li > 0) {
      pushQuad(-hw, cfg.baseY * h - 2, w, 4, t[0] * 2, t[1] * 2, t[2] * 2, 0.15);
    }
    for (let bi = 0; bi < buildings.length; bi++) {
      drawBgBuilding(buildings[bi], cfg, time, w, h, hw);
    }
  }

  // 3. Ground plane
  pushQuad(-hw, gy, w, h - gy, 0.025, 0.02, 0.06, 1.0);
  // Horizon glow
  pushQuad(-hw, gy - 2, w, 4, 0.35, 0.15, 0.65, 0.6);
  pushQuad(-hw, gy - 1, w, 2, 0.5, 0.25, 0.9, 0.3);

  // 4. Ground reflections
  drawGroundReflections(time, w, h, hw, gy);

  // 5. PURCHASED BUILDINGS — on top of everything
  rebuildPurchasedBuildings();

  // DEBUG: log building count once per second
  if (Math.floor(time) !== Math.floor(time - (dt || 0.016))) {
    console.log('[SKYLINE] purchased cache:', purchasedBuildingCache.length, 'w:', w, 'h:', h, 'gy:', gy);
    if (purchasedBuildingCache.length > 0) {
      const b0 = purchasedBuildingCache[0];
      const bx = -hw + b0.x * w;
      const by = gy - b0.relH * h;
      console.log('[SKYLINE] building 0: bx=', bx, 'by=', by, 'bw=', b0.relW * w, 'bh=', b0.relH * h);
    }
  }

  // DEBUG: if we have purchased buildings, draw a BRIGHT WHITE rectangle as proof
  if (purchasedBuildingCache.length > 0) {
    pushQuad(-hw + 10, 10, 150, 40, 1.0, 1.0, 1.0, 1.0); // top-left white bar
  }

  drawPurchasedBuildings(time, w, h, hw, gy);

  // 6. Atmospheric haze overlays
  drawAtmosphere(time, w, h, hw);

  // 7. Rain
  renderRain(dt || 0.016, w, h, hw);
}

// ============ PURCHASED BUILDINGS ============
function drawPurchasedBuildings(time, w, h, hw, gy) {
  for (let i = 0; i < purchasedBuildingCache.length; i++) {
    const b = purchasedBuildingCache[i];
    const tc = TIER_COLORS[b.tierIdx] || TIER_COLORS[0];

    const bw = b.relW * w;
    const bh = b.relH * h;
    const bx = -hw + b.x * w;
    const by = gy - bh;

    // === BUILDING BODY — FULL BRIGHTNESS ===
    pushQuad(bx, by, bw, bh, tc.r * 0.7 + 0.2, tc.g * 0.7 + 0.15, tc.b * 0.7 + 0.2, 1.0);

    // === TOWER EXTENSION ===
    if (b.hasTower) {
      const tw = b.towerW * w;
      const th = b.towerH * h;
      const tx = bx + (bw - tw) * 0.5;
      pushQuad(tx, by - th, tw, th, tc.r * 0.3 + 0.10, tc.g * 0.3 + 0.08, tc.b * 0.3 + 0.12, 1.0);
      // Tower rooftop
      pushQuad(tx - 1, by - th - 1, tw + 2, 3, tc.r, tc.g, tc.b, 0.8);
    }

    // === BRIGHT NEON EDGES ===
    // Left edge
    pushQuad(bx, by, 3, bh, tc.r, tc.g, tc.b, 0.8);
    // Right edge
    pushQuad(bx + bw - 3, by, 3, bh, tc.r, tc.g, tc.b, 0.8);
    // Rooftop — BRIGHT neon bar
    pushQuad(bx - 3, by - 3, bw + 6, 6, tc.r, tc.g, tc.b, 1.0);
    // Rooftop glow halo
    pushQuad(bx - 10, by - 10, bw + 20, 12, tc.r, tc.g, tc.b, 0.2);
    // Base neon bar
    pushQuad(bx - 4, gy - 3, bw + 8, 6, tc.r, tc.g, tc.b, 0.6);

    // === ANTENNA ===
    if (b.hasAntenna) {
      const ax = bx + bw * 0.5 - 1;
      const ah = b.antennaH * h;
      pushQuad(ax, by - ah - (b.hasTower ? b.towerH * h : 0), 2, ah, 0.4, 0.35, 0.6, 0.9);
      const topY = by - ah - (b.hasTower ? b.towerH * h : 0);
      if (Math.sin(time * 3.0 + b.flickerSeed) > 0.4) {
        pushQuad(ax - 3, topY - 5, 8, 8, 1.0, 0.1, 0.15, 1.0);
        pushQuad(ax - 6, topY - 8, 14, 14, 1.0, 0.1, 0.15, 0.15); // glow
      }
    }

    // === WINDOWS ===
    const wins = b.windows;
    const padX = bw * 0.14;
    const padY = bh * 0.06;
    const innerW = bw - padX * 2;
    const innerH = bh - padY * 2;
    const winW = Math.max(3, bw * 0.07);
    const winH = Math.max(2, bh * 0.03);

    for (let wi = 0; wi < wins.length; wi++) {
      const win = wins[wi];
      const wx = bx + padX + win.cx * (innerW - winW);
      const wy = by + padY + win.cy * (innerH - winH);
      const f = Math.sin(time * win.spd + win.seed);
      if (f < -0.4) continue;
      const br = 0.7 + f * 0.3;
      pushQuad(wx, wy, winW, winH, tc.r * br, tc.g * br, tc.b * br, 0.9);
    }

    // === VERTICAL NEON STRIPE ===
    const sw = Math.max(3, bw * 0.06);
    const inset = bw * 0.14;
    const sx = (i % 2 === 0) ? bx + inset : bx + bw - inset - sw;
    const sa = 0.5 + Math.sin(time * 0.7 + i * 2.0) * 0.2;
    pushQuad(sx, by + bh * 0.1, sw, bh * 0.8, tc.r, tc.g, tc.b, sa);

    // === HOLOGRAPHIC SIGN (on larger buildings) ===
    if (b.tierIdx >= 2 && bw > 30) {
      const signW = bw * 0.6;
      const signH = Math.max(8, bh * 0.06);
      const signX = bx + (bw - signW) * 0.5;
      const signY = by + bh * 0.3;
      const signA = 0.4 + Math.sin(time * 0.4 + b.flickerSeed) * 0.15;
      pushQuad(signX, signY, signW, signH, tc.r, tc.g, tc.b, signA);
      pushQuad(signX - 2, signY - 2, signW + 4, signH + 4, tc.r, tc.g, tc.b, signA * 0.3);
    }
  }
}

// ============ BACKGROUND BUILDINGS ============
function drawBgBuilding(b, cfg, time, w, h, hw) {
  const t = cfg.tint;
  const bx = -hw + b.x * w;
  const bw = b.relW * w;
  const bh = b.relH * h;
  const by = cfg.baseY * h - bh;

  // Body
  pushQuad(bx, by, bw, bh, t[0], t[1], t[2], 1.0);

  // Rooftop line
  pushQuad(bx, by, bw, 2, t[0] * 2.5, t[1] * 2.5, t[2] * 2.5, 0.5);

  // Antenna blink
  if (b.hasAntenna && Math.sin(time * 2.5 + b.flickerSeed) > 0.6) {
    const ax = bx + bw * 0.45;
    pushQuad(ax - 2, by - b.antennaH * h - 3, 5, 5, 1.0, 0.15, 0.2, 0.7);
  }

  // Windows
  const wins = b.windows;
  const winW = Math.max(2, bw * 0.07);
  const winH = Math.max(2, bh * 0.025);
  const pX = bw * 0.10;
  const pY = bh * 0.06;
  const iW = bw - pX * 2;
  const iH = bh - pY * 2;
  for (let i = 0; i < wins.length; i++) {
    const win = wins[i];
    const f = Math.sin(time * win.spd + win.seed);
    if (f < -0.3) continue;
    const br = 0.4 + f * 0.6;
    const wx = bx + pX + win.cx * iW;
    const wy = by + pY + win.cy * iH;
    let wr, wg, wb;
    if (win.hue < 0.3) { wr = 1.0; wg = 0.7; wb = 0.2; }
    else if (win.hue < 0.6) { wr = 0.1; wg = 0.8; wb = 1.0; }
    else { wr = 0.8; wg = 0.2; wb = 1.0; }
    pushQuad(wx, wy, winW, winH, wr * br, wg * br, wb * br, 0.6);
  }
}

// ============ SKY ============
function renderSky(w, h, hw, time) {
  // Dark sky gradient (only upper portion)
  const skyH = GROUND_Y * h;
  const bands = 10;
  const bandH = skyH / bands;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    pushQuad(-hw, i * bandH, w, bandH + 1, 0.01 + t * 0.05, 0.01 + t * 0.02, 0.04 + t * 0.10, 1.0);
  }
}

// ============ ATMOSPHERE ============
function drawAtmosphere(time, w, h, hw) {
  // Horizontal haze layers for depth (between building rows)
  for (let i = 0; i < 5; i++) {
    const y = h * (0.45 + i * 0.08);
    const a = 0.03 + Math.sin(time * 0.15 + i * 1.5) * 0.01;
    pushQuad(-hw, y, w, 15, 0.06, 0.03, 0.15, a);
  }

  // Neon ambient glow spots (floating city lights)
  for (let i = 0; i < 20; i++) {
    seed = 77777 + i;
    const gx = -hw + rng() * w;
    const gy = h * (0.3 + rng() * 0.55);
    const gs = 4 + rng() * 12;
    const ci = i % 5;
    const cr = ci === 0 ? 1.0 : ci === 1 ? 0.0 : ci === 2 ? 1.0 : ci === 3 ? 0.0 : 0.8;
    const cg = ci === 0 ? 0.0 : ci === 1 ? 1.0 : ci === 2 ? 0.0 : ci === 3 ? 0.6 : 0.2;
    const cb = ci === 0 ? 0.8 : ci === 1 ? 0.7 : ci === 2 ? 1.0 : ci === 3 ? 1.0 : 1.0;
    const pulse = 0.05 + Math.sin(time * 0.5 + i * 1.3) * 0.03;
    pushQuad(gx, gy, gs, gs, cr, cg, cb, pulse);
  }
  seed = 42; // restore
}

// ============ GROUND REFLECTIONS ============
function drawGroundReflections(time, w, h, hw, gy) {
  const groundH = h - gy;

  // Building reflections
  for (let i = 0; i < purchasedBuildingCache.length; i++) {
    const b = purchasedBuildingCache[i];
    const tc = TIER_COLORS[b.tierIdx] || TIER_COLORS[0];
    const bx = -hw + b.x * w;
    const bw = b.relW * w;
    const pulse = Math.sin(time * 0.5 + i * 2.1) * 0.5 + 0.5;
    pushQuad(bx + bw * 0.15, gy + 4, bw * 0.7, groundH * 0.5, tc.r, tc.g, tc.b, 0.04 + pulse * 0.03);
  }

  // Ambient wet ground streaks
  for (let i = 0; i < 20; i++) {
    const px = ((i * 137.3 + 42.7) % 1.0);
    const py = ((i * 91.1 + 17.3) % 0.7);
    const pulse = Math.sin(time * 0.4 + i * 2.3) * 0.5 + 0.5;
    const rx = -hw + px * w;
    const ry = gy + 3 + py * groundH;
    const rw = 15 + (i % 6) * 12;
    const ci = i % 5;
    const cr = ci < 2 ? 0.0 : ci < 4 ? 0.8 : 0.5;
    const cg = ci < 2 ? 0.7 : ci < 3 ? 0.0 : 0.2;
    const cb = ci < 2 ? 0.9 : ci < 4 ? 0.7 : 0.8;
    pushQuad(rx, ry, rw, 2, cr, cg, cb, 0.05 + pulse * 0.04);
  }
}

// ============ RAIN ============
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
    pushQuad(-hw + rain[o] * w, rain[o + 1] * h, 1, rain[o + 3], 0.5, 0.55, 0.75, 0.04 + rain[o + 2] * 0.07);
  }
}

function getOwnedBuildingCount() {
  let count = 0;
  for (const id of BUILDING_ORDER) count += state.buildings[id] || 0;
  return count;
}

// Init
generateSkyline(42);
