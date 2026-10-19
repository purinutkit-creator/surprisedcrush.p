/** Tiny synthesized sound effects (no files to download). Only plays when the visitor turned sound on. */
let ctx: AudioContext | null = null;
let enabled = false;

export function setSfxEnabled(on: boolean) {
  enabled = on;
}

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.12) {
  const a = audio();
  if (!a) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, a.currentTime + start);
  g.gain.setValueAtTime(0.0001, a.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, a.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
  osc.connect(g).connect(a.destination);
  osc.start(a.currentTime + start);
  osc.stop(a.currentTime + start + dur + 0.05);
}

export const sfx = {
  pop() { if (enabled) { tone(660, 0, 0.12, 'triangle'); tone(990, 0.06, 0.14, 'sine', 0.08); } },
  wrong() { if (enabled) { tone(392, 0, 0.18, 'triangle', 0.1); tone(330, 0.12, 0.25, 'triangle', 0.1); } },
  success() { if (enabled) [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.3, 'sine', 0.1)); },
  tick() { if (enabled) tone(1400, 0, 0.03, 'square', 0.025); },
  whoosh() { if (enabled) { tone(300, 0, 0.3, 'sine', 0.06); tone(600, 0.1, 0.3, 'sine', 0.05); } },
  /** Admin notification chime (ignores the visitor sound setting). */
  chime() { [880, 1175, 1568].forEach((f, i) => tone(f, i * 0.12, 0.35, 'sine', 0.12)); },
};
