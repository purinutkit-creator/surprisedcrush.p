import confetti from 'canvas-confetti';

const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const colors = () => {
  const s = getComputedStyle(document.documentElement);
  const toHex = (v: string) => {
    const [r, g, b] = v.trim().split(/\s+/).map(Number);
    return '#' + [r, g, b].map((x) => (x || 0).toString(16).padStart(2, '0')).join('');
  };
  return [toHex(s.getPropertyValue('--c-primary')), toHex(s.getPropertyValue('--c-secondary')), toHex(s.getPropertyValue('--c-accent')), '#FFD8C2', '#FFFFFF'];
};

const heart = (() => {
  try { return confetti.shapeFromText({ text: '💗', scalar: 2 }); } catch { return undefined; }
})();
const star = (() => {
  try { return confetti.shapeFromText({ text: '✨', scalar: 2 }); } catch { return undefined; }
})();

export function burst(origin = { x: 0.5, y: 0.6 }) {
  if (reduce()) return;
  confetti({ particleCount: 90, spread: 80, startVelocity: 42, origin, colors: colors(), scalar: 1, ticks: 220 });
}

export function heartExplosion(origin = { x: 0.5, y: 0.5 }) {
  if (reduce()) return;
  const shapes = heart && star ? [heart, star] : undefined;
  confetti({ particleCount: 40, spread: 360, startVelocity: 28, origin, shapes, scalar: 2, ticks: 180, gravity: 0.6, flat: true } as any);
}

export function celebrate() {
  if (reduce()) return;
  burst({ x: 0.5, y: 0.65 });
  setTimeout(() => heartExplosion({ x: 0.5, y: 0.45 }), 250);
  const end = Date.now() + 1800;
  (function frame() {
    confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors: colors() });
    confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors: colors() });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
