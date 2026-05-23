/**
 * Haptic feedback utility for mobile devices.
 * Falls back silently on devices that don't support vibration.
 */

export const haptic = {
  /** Light tap — button press, selection */
  light() {
    try {
      if ('vibrate' in navigator) navigator.vibrate(8);
    } catch (_) {}
  },

  /** Medium tap — confirm action */
  medium() {
    try {
      if ('vibrate' in navigator) navigator.vibrate(15);
    } catch (_) {}
  },

  /** Heavy tap — important action, error */
  heavy() {
    try {
      if ('vibrate' in navigator) navigator.vibrate([30, 20, 30]);
    } catch (_) {}
  },

  /** Success pattern */
  success() {
    try {
      if ('vibrate' in navigator) navigator.vibrate([10, 50, 10]);
    } catch (_) {}
  },

  /** Error pattern */
  error() {
    try {
      if ('vibrate' in navigator) navigator.vibrate([50, 30, 50, 30, 50]);
    } catch (_) {}
  },
};

/**
 * Simple sound effects using Web Audio API.
 * No external files needed — pure synthesized tones.
 */

let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function isSoundEnabled() {
  return localStorage.getItem('partyhub_sound_enabled') !== 'false';
}

function playTone(freq, duration = 0.15, volume = 0.2, type = 'sine') {
  try {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = type;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (_) {}
}

export const sounds = {
  /** Button click */
  tap() { playTone(800, 0.06, 0.15); },

  /** Card flip / draw */
  card() {
    playTone(600, 0.05, 0.1);
    setTimeout(() => playTone(900, 0.08, 0.12), 50);
  },

  /** Success / correct */
  success() {
    playTone(523, 0.15, 0.2);
    setTimeout(() => playTone(659, 0.15, 0.2), 100);
    setTimeout(() => playTone(784, 0.2, 0.2), 200);
  },

  /** Error / wrong */
  error() {
    playTone(300, 0.2, 0.15, 'sawtooth');
    setTimeout(() => playTone(250, 0.3, 0.12, 'sawtooth'), 150);
  },

  /** Timer warning */
  tick() { playTone(1000, 0.03, 0.08); },

  /** Game start / reveal */
  reveal() {
    const notes = [440, 554, 659, 880];
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.25, 0.2), i * 120);
    });
  },

  /** Vote / count */
  count() { playTone(660, 0.1, 0.12); },

  /** Night phase */
  night() {
    playTone(220, 0.4, 0.1, 'triangle');
    setTimeout(() => playTone(196, 0.5, 0.08, 'triangle'), 300);
  },

  /** Day phase */
  day() {
    playTone(523, 0.2, 0.15);
    setTimeout(() => playTone(659, 0.2, 0.15), 100);
    setTimeout(() => playTone(784, 0.3, 0.18), 200);
  },

  /** Player joined room */
  playerJoin() {
    playTone(880, 0.08, 0.12);
    setTimeout(() => playTone(1100, 0.1, 0.15), 80);
  },

  /** Countdown tick (last 5 seconds) */
  countdown() { playTone(600, 0.08, 0.2, 'square'); },

  /** Countdown final (time's up!) */
  timeUp() {
    playTone(400, 0.15, 0.25, 'sawtooth');
    setTimeout(() => playTone(300, 0.2, 0.2, 'sawtooth'), 120);
    setTimeout(() => playTone(200, 0.3, 0.2, 'sawtooth'), 240);
  },

  /** Game start fanfare */
  gameStart() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.18, 0.2), i * 100);
    });
  },

  /** Winner / victory */
  victory() {
    const notes = [523, 659, 784, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.2, 0.22), i * 130);
    });
  },

  /** Drawing: pencil stroke start */
  draw() { playTone(1400, 0.02, 0.05); },

  /** Correct guess */
  correctGuess() {
    playTone(784, 0.12, 0.2);
    setTimeout(() => playTone(1047, 0.15, 0.22), 100);
    setTimeout(() => playTone(1318, 0.2, 0.2), 200);
  },

  /** New round */
  newRound() {
    playTone(440, 0.1, 0.15);
    setTimeout(() => playTone(554, 0.1, 0.15), 80);
    setTimeout(() => playTone(659, 0.12, 0.18), 160);
  },
};

export function feedback(type) {
  switch (type) {
    case 'tap': sounds.tap(); haptic.light(); break;
    case 'success': sounds.success(); haptic.success(); break;
    case 'error': sounds.error(); haptic.error(); break;
    case 'gameStart': sounds.gameStart(); haptic.medium(); break;
    case 'victory': sounds.victory(); haptic.heavy(); break;
    case 'countdown': sounds.countdown(); haptic.light(); break;
    case 'timeUp': sounds.timeUp(); haptic.heavy(); break;
    case 'correctGuess': sounds.correctGuess(); haptic.success(); break;
    case 'newRound': sounds.newRound(); haptic.medium(); break;
    case 'playerJoin': sounds.playerJoin(); haptic.light(); break;
    case 'spyReveal': sounds.reveal(); haptic.heavy(); break;
    default: break;
  }
}
