import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { burst, heartExplosion } from '../../lib/confetti';
import { sfx } from '../../lib/sfx';
import { useVisitor } from '../context';

interface Surprise { id: number; kind: string; text: string }

/** Hearts / confetti / a message sent live from the admin dashboard. */
export function SurpriseLayer() {
  const { live } = useVisitor();
  const [items, setItems] = useState<Surprise[]>([]);
  useEffect(() => live.on((m) => {
    if (m.t !== 'surprise') return;
    const s = { id: Date.now() + Math.random(), kind: m.kind, text: m.text ?? '' };
    sfx.pop();
    if (m.kind === 'confetti') burst();
    if (m.kind === 'hearts' || m.kind === 'stars') heartExplosion();
    setItems((x) => [...x, s]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== s.id)), 5200);
  }), [live]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      <AnimatePresence>
        {items.map((s) => (
          <div key={s.id}>
            {(s.kind === 'hearts' || s.kind === 'stars') && Array.from({ length: 14 }).map((_, i) => (
              <motion.span
                key={i} className="absolute bottom-0 text-3xl"
                style={{ left: `${(i * 37) % 100}%` }}
                initial={{ y: 40, opacity: 0 }} animate={{ y: -window.innerHeight - 80, opacity: [0, 1, 1, 0] }}
                transition={{ duration: 3.5 + (i % 4) * 0.4, delay: (i % 5) * 0.15, ease: 'easeOut' }}
              >{s.kind === 'stars' ? '⭐' : ['💗', '💖', '💕'][i % 3]}</motion.span>
            ))}
            {s.text && (
              <motion.div
                initial={{ opacity: 0, scale: 0.6, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', damping: 16 }}
                className="absolute inset-x-6 top-1/3 mx-auto max-w-sm"
              >
                <div className="gift-card p-5 text-center font-heading text-xl text-primary" data-style="solid">{s.text}</div>
              </motion.div>
            )}
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
