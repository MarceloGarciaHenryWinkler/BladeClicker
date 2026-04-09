// skyline.js — Procedural cyberpunk skyline with parallax layers
import { pushQuad, width, height } from './glInit.js';
import { state } from '../state.js';
import { BUILDING_ORDER } from '../systems/buildings.js';

// --- Seeded PRNG (deterministic skyline per seed) ---
let seed = 42;
function rng() {
  seed = (seed * 16807 + 0) % 2147483647;
  return (seed - 1) / 2147483646;
}
function rngRange(min, max) { return min + rng() * (max - min); }

// --- Parallax layers (back to front) ---
// Each layer: depth factor (0=far, 1=near), buildings array
const NUM_LAYERS = 4;
const LAYER_CONFIGS = [
  { depth: 0.05, count: 18, hMin: 0.25, hMax: 0.50, baseY: 0.68, tint: [0.04, 0.03, 0.08], winChance: 0.10 },
  { depth: 0.15, count: 14, hMin: 0.20, hMax: 0.55, baseY: 0.70, tint: [0.06, 0.04, 0.14], winChance: 0.20 },
  { depth: 0.35, count: 10, hMin: 0.18, hMax: 0.60, baseY: 0.72, tint: [0.08, 0.06, 0.20], winChance: 0.35 },
  { depth: 1.00, count: 8,  hMin: 0.10, hMax: 0.50, baseY: 0.75, tint: [0.10, 0.07, 0.25], winChance: 0.50 },
];

// Pre-generated building data per layer
const layers = [];

// Window flicker state — pre-allocated grid per building
// Each building stores: { x, relW, relH, baseY, windows: [{wx,wy,hue,flickerSeed}], ... }

export function generateSkyline(newSeed) {
  seed = newSeed || 42;
  layers.length = 0;

  for (let li = 0; li < NUM_LAYERS; li++) {
    const cfg = LAYER_CONFIGS[li];
    const buildings = [];

    for (let i = 0; i < cfg.count; i++) {
      const relW = rngRange(0.03, 0.08);
      const relH = rngRange(cfg.hMin, cfg.hMax);
      const x = rngRange(-0.02, 1.02 - relW);

      // Building shape variations
      const hasAntenna = rng() > 0.6;
      const antennaH = hasAntenna ? rngRange(0.02, 0.06) : 0;
      const hasTower = rng() > 0.7;
      const towerW = hasTower ? relW * rngRange(0.2, 0.4) : 0;
      const towerH = hasTower ? rngRange(0.03, 0.08) : 0;

      // Window grid
      const windows = [];
      const winCols = Math.floor(relW * 1000 / 8);
      const winRows = Math.floor(relH * 1000 / 10);
      for (let wy = 0; wy < winRows; wy++) {
        for (let wx = 0; wx < winCols; wx++) {
          if (rng() < cfg.winChance) {
            windows.push({
              cx: wx / winCols,
              cy: wy / winRows,
              hue: rng(),           // color variety
              flickerSeed: rng() * 100, // unique flicker phase
              flickerSpeed: rngRange(0.2, 2.0),
            });
          }
        }
      }

      // Neon accent strip (side of building)
      const neonSide = rng() > 0.5 ? 'left' : 'right';
      const neonHue = rng();

      buildings.push({
        x, relW, relH,
        hasAntenna, antennaH,
        hasTower, towerW, towerH,
        windows, neonSide, neonHue,
      });
    }

    // Sort by x for consistent overlap
    buildings.sort((a, b) => a.x - b.x);
    layers.push({ cfg, buildings });
  }
}

// --- Render the skyline ---
export function renderSkyline(time, dt) {
  const w = width;
  const h = height;
  const hw = w / 2;

  // Sky gradient (top = dark blue, horizon = deep purple)
  renderSkyGradient(w, h, hw);

  // Render layers back to front
  for (let li = 0; li < layers.length; li++) {
    const { cfg, buildings } = layers[li];
    const parallaxX = cfg.depth * 0; // camera parallax placeholder
    const tR = cfg.tint[0], tG = cfg.tint[1], tB = cfg.tint[2];

    // Depth fog: far layers are dimmer
    const fogMul = 0.3 + cfg.depth * 0.7;

    for (let bi = 0; bi < buildings.length; bi++) {
      const b = buildings[bi];
      const bx = -hw + (b.x + parallaxX) * w;
      const bw = b.relW * w;
      const bh = b.relH * h;
      const by = cfg.baseY * h - bh;

      // Building body
      pushQuad(bx, by, bw, bh,
        tR * fogMul, tG * fogMul, tB * fogMul, 1.0);

      // Darker edges (left/right trim)
      const edgeW = Math.max(1, bw * 0.04);
      pushQuad(bx, by, edgeW, bh, 0.01, 0.01, 0.03, 0.8);
      pushQuad(bx + bw - edgeW, by, edgeW, bh, 0.01, 0.01, 0.03, 0.8);

      // Rooftop highlight
      pushQuad(bx, by, bw, 2, tR * 1.5, tG * 1.5, tB * 2.0, 0.6);

      // Antenna
      if (b.hasAntenna) {
        const ax = bx + bw * 0.45;
        const ah = b.antennaH * h;
        pushQuad(ax, by - ah, 2, ah, 0.15, 0.15, 0.3, 0.8);
        // Blinking light
        const blink = Math.sin(time * 2.5 + b.flickerSeed) > 0.7;
        if (blink) {
          pushQuad(ax - 1, by - ah - 2, 4, 4, 1.0, 0.1, 0.15, 0.9);
        }
      }

      // Tower extension
      if (b.hasTower) {
        const tw = b.towerW * w;
        const th = b.towerH * h;
        const tx = bx + (bw - tw) * 0.5;
        pushQuad(tx, by - th, tw, th, tR * 0.8, tG * 0.8, tB * 1.2, 1.0);
      }

      // Neon accent strip
      const neonAlpha = 0.3 + Math.sin(time * 0.8 + b.neonHue * 10) * 0.15;
      const neonX = b.neonSide === 'left' ? bx : bx + bw - 3;
      const nr = b.neonHue < 0.33 ? 0.8 : (b.neonHue < 0.66 ? 0.0 : 0.9);
      const ng = b.neonHue < 0.33 ? 0.0 : (b.neonHue < 0.66 ? 0.9 : 0.0);
      const nb = b.neonHue < 0.33 ? 0.9 : (b.neonHue < 0.66 ? 0.8 : 0.7);
      pushQuad(neonX, by + bh * 0.1, 3, bh * 0.8, nr, ng, nb, neonAlpha);

      // Windows
      renderWindows(b, bx, by, bw, bh, time, fogMul);
    }

    // Ground strip per layer
    pushQuad(-hw, cfg.baseY * h, w, 2, tR * 0.5, tG * 0.5, tB * 0.8, 0.4);
  }

  // Foreground ground plane
  pushQuad(-hw, h * 0.75, w, h * 0.25, 0.015, 0.015, 0.04, 1.0);

  // Ground reflection line
  pushQuad(-hw, h * 0.75, w, 1, 0.1, 0.08, 0.2, 0.5);

  // Progress-based extra window lights
  renderProgressLights(time, w, h, hw);

  // Wet ground reflections (faint mirrored glow spots)
  renderGroundReflections(time, w, h, hw);

  // Rain
  renderRain(dt || 0.016, w, h, hw);
}

function renderWindows(b, bx, by, bw, bh, time, fogMul) {
  const wins = b.windows;
  const winW = Math.max(2, bw * 0.06);
  const winH = Math.max(2, bh * 0.015);
  const padX = bw * 0.08;
  const padY = bh * 0.05;
  const innerW = bw - padX * 2;
  const innerH = bh - padY * 2;

  for (let i = 0; i < wins.length; i++) {
    const win = wins[i];
    const wx = bx + padX + win.cx * innerW;
    const wy = by + padY + win.cy * innerH;

    // Flicker: some windows turn on/off slowly
    const flicker = Math.sin(time * win.flickerSpeed + win.flickerSeed);
    if (flicker < -0.3) continue; // off

    const brightness = 0.5 + flicker * 0.3;
    const alpha = (0.5 + brightness * 0.5) * fogMul;

    // Color from hue
    let wr, wg, wb;
    if (win.hue < 0.3) {
      // Warm yellow/orange
      wr = 1.0 * brightness; wg = 0.7 * brightness; wb = 0.2 * brightness;
    } else if (win.hue < 0.6) {
      // Cool cyan
      wr = 0.1 * brightness; wg = 0.8 * brightness; wb = 0.9 * brightness;
    } else if (win.hue < 0.8) {
      // Magenta/pink
      wr = 0.9 * brightness; wg = 0.15 * brightness; wb = 0.7 * brightness;
    } else {
      // White/blue
      wr = 0.6 * brightness; wg = 0.65 * brightness; wb = 1.0 * brightness;
    }

    pushQuad(wx, wy, winW, winH, wr, wg, wb, alpha);
  }
}

function renderSkyGradient(w, h, hw) {
  // Draw sky as vertical bands (top dark → horizon purple/blue)
  const bands = 8;
  const bandH = h * 0.75 / bands;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const r = 0.02 + t * 0.06;
    const g = 0.01 + t * 0.02;
    const b = 0.06 + t * 0.10;
    pushQuad(-hw, i * bandH, w, bandH + 1, r, g, b, 1.0);
  }
}

function renderGroundReflections(time, w, h, hw) {
  // Faint colored light patches on the wet ground
  const groundY = h * 0.76;
  const groundH = h * 0.23;

  for (let i = 0; i < 20; i++) {
    // Deterministic positions using simple hash
    const px = ((i * 137.3 + 42.7) % 1.0);
    const py = ((i * 91.1 + 17.3) % 0.8);
    const pulse = Math.sin(time * 0.4 + i * 2.3) * 0.5 + 0.5;

    const rx = -hw + px * w;
    const ry = groundY + py * groundH;
    const rw = 15 + (i % 5) * 8;

    // Alternate colors
    const ci = i % 4;
    const cr = ci === 0 ? 0.0 : ci === 1 ? 0.6 : ci === 2 ? 0.0 : 0.4;
    const cg = ci === 0 ? 0.6 : ci === 1 ? 0.0 : ci === 2 ? 0.7 : 0.1;
    const cb = ci === 0 ? 0.8 : ci === 1 ? 0.5 : ci === 2 ? 0.3 : 0.7;

    pushQuad(rx, ry, rw, 2, cr, cg, cb, 0.06 + pulse * 0.05);
  }
}

// --- Rain particles (pre-allocated, no GC) ---
const MAX_RAIN = 120;
const rain = new Float32Array(MAX_RAIN * 4); // x, y, speed, length per drop
let rainInited = false;

function initRain() {
  for (let i = 0; i < MAX_RAIN; i++) {
    const o = i * 4;
    rain[o    ] = Math.random();          // x (0..1)
    rain[o + 1] = Math.random();          // y (0..1)
    rain[o + 2] = 0.3 + Math.random() * 0.7; // speed
    rain[o + 3] = 8 + Math.random() * 20;    // length px
  }
  rainInited = true;
}

function renderRain(dt, w, h, hw) {
  if (!rainInited) initRain();

  for (let i = 0; i < MAX_RAIN; i++) {
    const o = i * 4;

    // Update position
    rain[o + 1] += rain[o + 2] * dt * 0.8;
    rain[o]     += rain[o + 2] * dt * 0.05; // slight wind

    // Wrap
    if (rain[o + 1] > 1.0) {
      rain[o + 1] = -0.05;
      rain[o] = Math.random();
    }
    if (rain[o] > 1.05) rain[o] = -0.05;

    const rx = -hw + rain[o] * w;
    const ry = rain[o + 1] * h;
    const rl = rain[o + 3];

    // Fade based on depth (speed = proxy for depth)
    const alpha = 0.03 + rain[o + 2] * 0.06;

    pushQuad(rx, ry, 1, rl, 0.4, 0.5, 0.7, alpha);
  }
}

// --- Skyline density reacts to owned building count ---
function getOwnedBuildingCount() {
  let count = 0;
  for (const id of BUILDING_ORDER) {
    count += state.buildings[id] || 0;
  }
  return count;
}

// Extra foreground window lights based on progress
function renderProgressLights(time, w, h, hw) {
  const count = getOwnedBuildingCount();
  if (count === 0) return;

  // More lights as player progresses (max 30 extra)
  const extraLights = Math.min(30, Math.floor(count * 0.5));
  const frontLayer = layers[layers.length - 1];
  if (!frontLayer) return;

  for (let i = 0; i < extraLights; i++) {
    // Distribute across front-layer buildings
    const bIdx = i % frontLayer.buildings.length;
    const b = frontLayer.buildings[bIdx];
    const bx = -hw + b.x * w;
    const bw = b.relW * w;
    const bh = b.relH * h;
    const by = frontLayer.cfg.baseY * h - bh;

    const wx = bx + (((i * 73 + 31) % 100) / 100) * bw * 0.8 + bw * 0.1;
    const wy = by + (((i * 47 + 13) % 100) / 100) * bh * 0.8 + bh * 0.1;

    const flicker = Math.sin(time * 1.5 + i * 4.7);
    if (flicker < 0) continue;

    const bright = 0.5 + flicker * 0.5;
    const ci = i % 3;
    const r = ci === 0 ? 0.9 * bright : ci === 1 ? 0.0 : 0.1;
    const g = ci === 0 ? 0.3 * bright : ci === 1 ? 0.9 * bright : 0.7 * bright;
    const bl = ci === 0 ? 0.1 : ci === 1 ? 0.8 * bright : 0.9 * bright;

    pushQuad(wx, wy, 4, 5, r, g, bl, 0.6 * bright);
  }
}

// Call on init
generateSkyline(42);
