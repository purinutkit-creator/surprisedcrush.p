import { useMemo } from 'react';

interface Props { hearts?: boolean; stars?: boolean; sparkles?: boolean; particles?: boolean; intensity?: string; dreamy?: boolean }

const rand = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

/** Soft decorative layer. Pure CSS animations, few elements, hidden for reduced-motion users. */
export function Background({ hearts = true, stars = true, sparkles = true, particles = true, intensity = 'normal', dreamy = false }: Props) {
  const scale = intensity === 'low' ? 0.5 : 1;
  const items = useMemo(() => {
    const out: { key: string; char: string; style: React.CSSProperties; cls: string }[] = [];
    const n = (k: number) => Math.round(k * scale * (dreamy ? 1.6 : 1));
    if (hearts) for (let i = 0; i < n(10); i++) {
      out.push({
        key: `h${i}`, char: ['💗', '💕', '🩷', '💖', '♡'][i % 5], cls: 'particles',
        style: {
          left: `${rand(i + 1) * 100}%`, bottom: '-40px', fontSize: `${14 + rand(i + 7) * 18}px`,
          animation: `rise ${11 + rand(i + 3) * 10}s linear ${-rand(i + 5) * 20}s infinite`,
          ['--dx' as any]: `${(rand(i + 9) - 0.5) * 120}px`, ['--o' as any]: 0.55,
        },
      });
    }
    if (stars) for (let i = 0; i < n(14); i++) {
      out.push({
        key: `s${i}`, char: ['✦', '⋆', '✧'][i % 3], cls: 'particles particles-extra',
        style: {
          left: `${rand(i + 20) * 100}%`, top: `${rand(i + 40) * 100}%`, fontSize: `${8 + rand(i + 60) * 12}px`,
          color: 'rgb(var(--c-primary) / 0.6)', animation: `twinkle ${2.5 + rand(i + 80) * 3}s ease-in-out ${rand(i) * 3}s infinite`,
        },
      });
    }
    if (sparkles) for (let i = 0; i < n(6); i++) {
      out.push({
        key: `k${i}`, char: '✨', cls: 'particles particles-extra',
        style: {
          left: `${rand(i + 100) * 100}%`, top: `${rand(i + 120) * 90}%`, fontSize: `${12 + rand(i + 140) * 10}px`,
          animation: `twinkle ${3 + rand(i + 160) * 2}s ease-in-out ${rand(i + 2) * 4}s infinite`,
        },
      });
    }
    return out;
  }, [hearts, stars, sparkles, scale, dreamy]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden gift-bg">
      {particles && (
        <>
          <div className="particles absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-secondary/60 blur-3xl" />
          <div className="particles absolute -right-24 top-2/3 h-80 w-80 rounded-full bg-accent/60 blur-3xl" />
          {dreamy && <div className="particles absolute left-1/3 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />}
        </>
      )}
      {items.map((it) => (
        <span key={it.key} className={`absolute select-none ${it.cls}`} style={it.style}>{it.char}</span>
      ))}
    </div>
  );
}
