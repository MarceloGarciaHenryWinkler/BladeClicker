// synth.js — Low-level Web Audio synthesizer utilities
let ctx = null;
let masterGain = null;

export function initAudio() {
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.3;
  masterGain.connect(ctx.destination);
  return ctx;
}

export function getCtx() { return ctx; }
export function getMaster() { return masterGain; }

export function setMasterVolume(v) {
  if (masterGain) masterGain.gain.value = Math.max(0, Math.min(1, v));
}

// Resume audio context (must be called from user gesture)
export function resumeAudio() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

// --- Click SFX: short filtered blip ---
export function playClick() {
  if (!ctx) return;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'square';
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.exponentialRampToValueAtTime(220, now + 0.08);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2000, now);
  filter.frequency.exponentialRampToValueAtTime(400, now + 0.1);
  filter.Q.value = 5;

  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);

  osc.start(now);
  osc.stop(now + 0.13);
}

// --- Purchase SFX: ascending tone ---
export function playBuy() {
  if (!ctx) return;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);

  gain.gain.setValueAtTime(0.1, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  osc.connect(gain);
  gain.connect(masterGain);

  osc.start(now);
  osc.stop(now + 0.16);
}

// --- Error/denied SFX: low buzz ---
export function playDeny() {
  if (!ctx) return;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(110, now);

  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

  osc.connect(gain);
  gain.connect(masterGain);

  osc.start(now);
  osc.stop(now + 0.21);
}

// --- Create a sustained pad oscillator (for ambient) ---
export function createPad(freq, type, gainVal) {
  if (!ctx) return null;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = type || 'sine';
  osc.frequency.value = freq;

  filter.type = 'lowpass';
  filter.frequency.value = 800;
  filter.Q.value = 1;

  gain.gain.value = 0;

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);

  osc.start();

  return { osc, gain, filter, targetGain: gainVal || 0.05 };
}
