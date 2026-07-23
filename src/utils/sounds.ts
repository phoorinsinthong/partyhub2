// Sound effects utility using Web Audio API (no audio files needed)

const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

let audioCtx: AudioContext | null = null;
let soundEnabled = localStorage.getItem('partyhub_sound') !== 'false';

function getContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioCtx();
  }
  // Resume if suspended (browsers require user gesture)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function setSoundEnabled(enabled: boolean) {
  soundEnabled = !!enabled;
  localStorage.setItem('partyhub_sound', soundEnabled ? 'true' : 'false');
}

export function isSoundEnabled() {
  return soundEnabled;
}

// Happy ascending two-note chime
export function playCorrect() {
  if (!soundEnabled) return;
  const ctx = getContext();
  const now = ctx.currentTime;

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  gain.connect(ctx.destination);
  osc1.connect(gain);
  osc2.connect(gain);

  osc1.type = 'sine';
  osc2.type = 'sine';
  osc1.frequency.value = 523.25; // C5
  osc2.frequency.value = 659.25; // E5

  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

  osc1.start(now);
  osc1.stop(now + 0.15);
  osc2.start(now + 0.12);
  osc2.stop(now + 0.3);
}

// Short descending buzz
export function playWrong() {
  if (!soundEnabled) return;
  const ctx = getContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  gain.connect(ctx.destination);
  osc.connect(gain);

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.exponentialRampToValueAtTime(150, now + 0.2);

  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

  osc.start(now);
  osc.stop(now + 0.25);
}

// Single short tick for countdown
export function playCountdown() {
  if (!soundEnabled) return;
  const ctx = getContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  gain.connect(ctx.destination);
  osc.connect(gain);

  osc.type = 'sine';
  osc.frequency.value = 880; // A5

  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

  osc.start(now);
  osc.stop(now + 0.1);
}

// Triumphant ascending 4-note fanfare
export function playWin() {
  if (!soundEnabled) return;
  const ctx = getContext();
  const now = ctx.currentTime;

  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
  const noteLength = 0.12;
  const gap = 0.1;

  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    gain.connect(ctx.destination);
    osc.connect(gain);

    osc.type = 'sine';
    osc.frequency.value = freq;

    const start = now + i * (noteLength + gap * 0.5);
    gain.gain.setValueAtTime(0.3, start);
    gain.gain.exponentialRampToValueAtTime(0.01, start + noteLength);

    osc.start(start);
    osc.stop(start + noteLength);
  });
}

// Very short UI click
export function playClick() {
  if (!soundEnabled) return;
  const ctx = getContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  gain.connect(ctx.destination);
  osc.connect(gain);

  osc.type = 'sine';
  osc.frequency.value = 1000;

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

  osc.start(now);
  osc.stop(now + 0.05);
}

// Whoosh/sweep sound for new round
export function playNewRound() {
  if (!soundEnabled) return;
  const ctx = getContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(200, now);
  filter.frequency.exponentialRampToValueAtTime(2000, now + 0.25);
  filter.Q.value = 0.5;

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(100, now);
  osc.frequency.exponentialRampToValueAtTime(600, now + 0.3);

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.setValueAtTime(0.2, now + 0.1);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

  osc.start(now);
  osc.stop(now + 0.35);
}
