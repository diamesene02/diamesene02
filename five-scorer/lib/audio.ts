// Synthesized sound effects via Web Audio API.
// Zero-byte assets, zero latency, offline-native.

let ctx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

// Call from any user-triggered handler to unlock audio on mobile.
export function unlockAudio(): void {
  if (unlocked) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  const buf = c.createBuffer(1, 1, 22050);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  src.start(0);
  unlocked = true;
}

type ToneOptions = {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  glideTo?: number | null;
  delay?: number;
};

function playTone({
  freq,
  duration,
  type = "sine",
  gain = 0.22,
  glideTo = null,
  delay = 0,
}: ToneOptions): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + duration);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export function playGoalSound(): void {
  playTone({ freq: 440, glideTo: 880, duration: 0.14, type: "triangle", gain: 0.28 });
  playTone({ freq: 1320, duration: 0.12, type: "sine", gain: 0.18, delay: 0.09 });
}

export function playUndoSound(): void {
  playTone({ freq: 520, glideTo: 260, duration: 0.16, type: "sawtooth", gain: 0.18 });
}
