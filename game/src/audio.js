// All sound is synthesised with WebAudio: no audio files, no network.
// A low midnight pad, soft footsteps, a coin chime, and a two-tone alarm.

let ctx = null;
let master = null;
let muted = false;
let padNodes = null;
let alarmTimer = 0;

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

/** Must be called from a user gesture at least once; afterwards it just works. */
export function ensureAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    startPad();
  } catch {
    ctx = null;
  }
}

function startPad() {
  if (!ctx || padNodes) return;
  const gain = ctx.createGain();
  gain.gain.value = 0.05;
  gain.connect(master);
  const notes = [110, 164.81, 220];
  const oscillators = notes.map((freq) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start();
    return osc;
  });
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.02;
  lfo.connect(lfoGain);
  lfoGain.connect(gain.gain);
  lfo.start();
  padNodes = { gain, oscillators, lfo };
}

function tone(freq, seconds, type, volume, when = 0, slideTo = null) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + seconds);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t0);
  osc.stop(t0 + seconds + 0.05);
}

export function playStep(sneaking) {
  tone(sneaking ? 90 : 130, 0.07, 'triangle', sneaking ? 0.05 : 0.1);
}

export function playPickup() {
  tone(660, 0.12, 'sine', 0.22);
  tone(880, 0.14, 'sine', 0.22, 0.08);
  tone(1320, 0.2, 'sine', 0.18, 0.16);
}

export function playCoin() {
  tone(1568, 0.08, 'square', 0.08);
  tone(1568, 0.08, 'square', 0.08, 0.12);
}

export function playSmoke() {
  tone(300, 0.4, 'sawtooth', 0.1, 0, 60);
}

export function playEmp() {
  tone(1200, 0.35, 'sawtooth', 0.12, 0, 120);
  tone(900, 0.3, 'square', 0.07, 0.1, 90);
}

export function playSpotted() {
  tone(220, 0.18, 'square', 0.16);
  tone(330, 0.18, 'square', 0.16, 0.14);
}

export function playCaught() {
  tone(440, 0.5, 'sawtooth', 0.2, 0, 110);
  tone(220, 0.6, 'sawtooth', 0.18, 0.2, 55);
}

export function playWin() {
  [523, 659, 784, 1047].forEach((freq, i) => tone(freq, 0.25, 'sine', 0.22, i * 0.12));
}

export function playClick() {
  tone(440, 0.05, 'square', 0.08);
}

/** Two-tone alarm while the meter is high; call every frame with dt. */
export function updateAlarmSound(alarm, dt) {
  if (!ctx || muted) return;
  if (alarm < 55) return;
  alarmTimer -= dt;
  if (alarmTimer <= 0) {
    alarmTimer = alarm >= 90 ? 0.5 : 0.9;
    tone(740, 0.22, 'square', 0.07);
    tone(554, 0.22, 'square', 0.07, 0.24);
  }
}
