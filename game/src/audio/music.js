// music.js — Procedural ambient cyberpunk soundtrack
import { getCtx, getMaster, createPad } from './synth.js';

// Pad voices
let pads = [];
let droneOsc = null;
let droneGain = null;
let lfoNode = null;
let isPlaying = false;

// Chord progressions (frequencies in Hz) — moody minor/suspended
const CHORDS = [
  [65.41, 130.81, 196.00, 311.13],  // C2, C3, G3, Eb4
  [58.27, 116.54, 174.61, 277.18],  // Bb1, Bb2, F3, Db4
  [61.74, 123.47, 185.00, 293.66],  // B1, B2, F#3, D4
  [55.00, 110.00, 164.81, 261.63],  // A1, A2, E3, C4
];

let chordIdx = 0;
let chordTimer = 0;
const CHORD_DUR = 12; // seconds per chord

export function startAmbient() {
  const ctx = getCtx();
  const master = getMaster();
  if (!ctx || isPlaying) return;
  isPlaying = true;

  // --- Deep sub drone ---
  droneOsc = ctx.createOscillator();
  droneGain = ctx.createGain();
  droneOsc.type = 'sine';
  droneOsc.frequency.value = 40;
  droneGain.gain.value = 0;
  droneOsc.connect(droneGain);
  droneGain.connect(master);
  droneOsc.start();

  // Fade drone in
  droneGain.gain.setTargetAtTime(0.06, ctx.currentTime, 2.0);

  // --- LFO for slow movement ---
  lfoNode = ctx.createOscillator();
  lfoNode.type = 'sine';
  lfoNode.frequency.value = 0.08; // very slow
  lfoNode.start();

  // --- Create pad voices ---
  const chord = CHORDS[0];
  for (let i = 0; i < chord.length; i++) {
    const type = i === 0 ? 'sine' : (i < 3 ? 'triangle' : 'sine');
    const vol = i === 0 ? 0.04 : 0.025;
    const pad = createPad(chord[i], type, vol);
    if (pad) {
      // LFO modulates filter cutoff
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 200;
      lfoNode.connect(lfoGain);
      lfoGain.connect(pad.filter.frequency);

      // Fade in
      pad.gain.gain.setTargetAtTime(pad.targetGain, ctx.currentTime, 3.0);
      pads.push(pad);
    }
  }
}

export function updateAmbient(dt) {
  if (!isPlaying) return;
  const ctx = getCtx();
  if (!ctx) return;

  chordTimer += dt;
  if (chordTimer >= CHORD_DUR) {
    chordTimer = 0;
    chordIdx = (chordIdx + 1) % CHORDS.length;
    transitionChord(CHORDS[chordIdx]);
  }
}

function transitionChord(chord) {
  if (!isPlaying || pads.length === 0) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  for (let i = 0; i < pads.length && i < chord.length; i++) {
    pads[i].osc.frequency.setTargetAtTime(chord[i], now, 2.0);
  }

  // Shift drone to root
  if (droneOsc) {
    droneOsc.frequency.setTargetAtTime(chord[0] * 0.5, now, 2.0);
  }
}

export function stopAmbient() {
  if (!isPlaying) return;
  isPlaying = false;
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Fade out everything
  for (const pad of pads) {
    pad.gain.gain.setTargetAtTime(0, now, 1.0);
    pad.osc.stop(now + 4);
  }
  pads = [];

  if (droneOsc) {
    droneGain.gain.setTargetAtTime(0, now, 1.0);
    droneOsc.stop(now + 4);
    droneOsc = null;
  }

  if (lfoNode) {
    lfoNode.stop(now + 4);
    lfoNode = null;
  }
}

export function isAmbientPlaying() { return isPlaying; }
