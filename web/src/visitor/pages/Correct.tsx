import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { visitorApi } from '../../lib/api';
import { celebrate, heartExplosion } from '../../lib/confetti';
import { sfx } from '../../lib/sfx';
import { useVisitor } from '../context';
import { GiftButton, Page, PopIn } from '../ui';

export function CorrectView({ c, onNext, busy }: { c: any; onNext: () => void; busy?: boolean }) {
  return (
    <>
      <div className="relative mt-10 text-8xl">
        <motion.span className="inline-block" initial={{ scale: 0, rotate: -30 }} animate={{ scale: [0, 1.3, 1], rotate: 0 }} transition={{ duration: 0.8 }}>🎉</motion.span>
        {['✨', '💖', '⭐', '💗', '✨', '🌟'].map((s, i) => (
          <motion.span key={i} className="absolute left-1/2 top-1/2 text-3xl"
            initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
            animate={{ x: Math.cos((i / 6) * Math.PI * 2) * 110, y: Math.sin((i / 6) * Math.PI * 2) * 90, opacity: [0, 1, 0.9], scale: 1 }}
            transition={{ delay: 0.3 + i * 0.05, duration: 0.9 }}>{s}</motion.span>
        ))}
      </div>
      <PopIn delay={0.25}><h1 className="mt-8 text-center font-heading text-5xl text-primary drop-shadow">{c.title}</h1></PopIn>
      <PopIn delay={0.5}><p className="mt-5 text-center font-heading text-2xl">{c.subtitle}</p></PopIn>
      <PopIn delay={0.75}><p className="mt-3 text-center text-lg text-ink/80">{c.subtitle2}</p></PopIn>
      {(c.senderName || c.senderPhotoUrl) && (
        <PopIn delay={1.1} className="mt-8">
          <div className="flex flex-col items-center gap-3 rounded-[var(--radius)] border-2 border-primary/40 bg-card/80 px-8 py-6 animate-glow">
            {c.senderPhotoUrl && <img src={c.senderPhotoUrl} alt="" className="h-28 w-28 rounded-full border-4 border-white object-cover shadow-soft" />}
            {c.senderName && <p className="font-heading text-3xl text-primary">{c.senderName} 💗</p>}
          </div>
        </PopIn>
      )}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.6 }} className="mt-10">
        <GiftButton onClick={onNext} disabled={busy}>{c.button}</GiftButton>
      </motion.div>
    </>
  );
}

export default function CorrectPage() {
  const { state, apply } = useVisitor();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    sfx.success();
    celebrate();
    const t = setTimeout(() => heartExplosion({ x: 0.5, y: 0.35 }), 1100);
    return () => clearTimeout(t);
  }, []);
  if (!state.correct) return null;
  const next = async () => {
    setBusy(true);
    try { apply((await visitorApi.post('/api/progress', { event: 'celebrated' })).state); } finally { setBusy(false); }
  };
  return <Page className="justify-center"><CorrectView c={state.correct} onNext={next} busy={busy} /></Page>;
}
