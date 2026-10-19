import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { visitorApi } from '../../lib/api';
import { heartExplosion } from '../../lib/confetti';
import { sfx } from '../../lib/sfx';
import { RichText, Typewriter } from '../../lib/text';
import { useVisitor } from '../context';
import type { PageProps } from '../MainFlow';
import { GiftButton, Page } from '../ui';

function FloatingHearts({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      {Array.from({ length: 10 }).map((_, i) => (
        <motion.span
          key={i} className="absolute text-2xl" style={{ left: `${10 + i * 8}%`, bottom: '40%' }}
          initial={{ y: 0, opacity: 0, scale: 0.4 }} animate={{ y: -220 - (i % 3) * 40, opacity: [0, 1, 0], scale: 1 }}
          transition={{ duration: 2.4, delay: i * 0.12, ease: 'easeOut' }}
        >{['💗', '💕', '💖', '🩷'][i % 4]}</motion.span>
      ))}
    </div>
  );
}

export function Envelope({ color, opening, effect }: { color: string; opening: boolean; effect: string }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative mx-auto h-48 w-72 sm:h-56 sm:w-80" style={{ perspective: 900 }}>
      <div className="absolute inset-0 rounded-2xl shadow-soft" style={{ background: color }} />
      {/* paper peeking out */}
      <motion.div
        className="absolute inset-x-5 top-4 h-40 rounded-xl bg-white shadow"
        initial={false}
        animate={opening ? { y: effect === 'none' ? 0 : -110, opacity: 1 } : { y: 0 }}
        transition={{ delay: reduce ? 0 : 0.5, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="mx-5 mt-5 space-y-2">
          <div className="h-2 w-3/4 rounded bg-secondary" /><div className="h-2 w-full rounded bg-secondary/70" /><div className="h-2 w-2/3 rounded bg-secondary/70" />
        </div>
      </motion.div>
      {/* front pocket */}
      <div className="absolute inset-x-0 bottom-0 h-[70%] rounded-b-2xl" style={{ background: color, clipPath: 'polygon(0 0, 50% 45%, 100% 0, 100% 100%, 0 100%)', filter: 'brightness(0.97)' }} />
      {/* flap */}
      <motion.div
        className="absolute inset-x-0 top-0 h-[58%] origin-top"
        style={{ background: color, clipPath: 'polygon(0 0, 100% 0, 50% 100%)', filter: 'brightness(0.93)', zIndex: opening ? 0 : 2 }}
        initial={false}
        animate={opening && effect === 'flap' ? { rotateX: 180 } : opening && effect !== 'none' ? { opacity: 0 } : { rotateX: 0, opacity: 1 }}
        transition={{ duration: reduce ? 0.01 : 0.6, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute left-1/2 top-[44%] z-10 -translate-x-1/2 -translate-y-1/2 text-4xl"
        animate={opening ? { scale: 0, opacity: 0 } : { scale: [1, 1.1, 1] }}
        transition={opening ? { duration: 0.3 } : { repeat: Infinity, duration: 1.6 }}
      >💌</motion.div>
    </div>
  );
}

/** The letter paper itself. Used by the visitor page and by the admin preview. */
export function LetterPaper({ letter, typing, onTyped }: { letter: any; typing: boolean; onTyped?: () => void }) {
  const [typedAll, setTypedAll] = useState(false);
  const bodyDone = typedAll || !typing;
  const font = letter.font ? `"${letter.font}", var(--f-letter)` : 'var(--f-letter)';
  return (
    <div
      className="relative w-full overflow-hidden rounded-[var(--radius)] border border-line/70 p-6 shadow-soft sm:p-8"
      style={{
        fontFamily: font,
        background: letter.backgroundImageUrl
          ? `linear-gradient(rgb(255 255 255 / .78), rgb(255 255 255 / .86)), center/cover url("${letter.backgroundImageUrl}")`
          : `repeating-linear-gradient(${letter.paperColor || '#FFFDF8'} 0 31px, rgb(var(--c-secondary) / .55) 31px 32px)`,
        backgroundColor: letter.paperColor || '#FFFDF8',
      }}
    >
      {(letter.stickers ?? []).map((s: any) => (
        <span key={s.id} className="pointer-events-none absolute select-none" style={{ left: `${s.x}%`, top: `${s.y}%`, transform: `translate(-50%, -50%) rotate(${s.rotate || 0}deg)`, fontSize: s.size || 32 }}>
          {s.url ? <img src={s.url} alt="" style={{ width: (s.size || 32) * 1.6 }} /> : s.emoji}
        </span>
      ))}
      <h2 className="mb-4 text-2xl text-primary">{letter.header}</h2>
      <div className="text-lg leading-8 text-ink">
        {typing ? <Typewriter text={letter.body} speed={letter.typewriterSpeed} onDone={() => { setTypedAll(true); onTyped?.(); }} /> : <RichText text={letter.body} />}
      </div>
      {(letter.images ?? []).length > 0 && bodyDone && (
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          {letter.images.map((img: any, i: number) => (
            <motion.figure key={i} initial={{ opacity: 0, scale: 0.8, rotate: 0 }} animate={{ opacity: 1, scale: 1, rotate: i % 2 ? 3 : -3 }}
              className="w-36 bg-white p-2 pb-6 shadow-md">
              <img src={img.url} alt={img.caption ?? ''} className="aspect-square w-full object-cover" />
              {img.caption && <figcaption className="pt-1 text-center text-sm">{img.caption}</figcaption>}
            </motion.figure>
          ))}
        </div>
      )}
      <AnimatePresence>
        {bodyDone && (
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 text-right text-lg text-primary">
            {letter.closing}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LetterPage({ reread, onRereadDone }: PageProps) {
  const { state, apply } = useVisitor();
  const letter = state.letter;
  const firstTime = !state.progress.letterOpened && !reread;
  const [phase, setPhase] = useState<'closed' | 'opening' | 'reading'>(state.progress.letterOpened && !reread ? 'reading' : 'closed');
  const [typed, setTyped] = useState(!firstTime);
  const [busy, setBusy] = useState(false);
  if (!letter) return null;

  const open = () => {
    setPhase('opening');
    sfx.whoosh();
    if (!state.progress.letterOpened) visitorApi.post('/api/progress', { event: 'letter_opened' }).catch(() => {});
    else visitorApi.track('reread_letter');
    setTimeout(() => heartExplosion({ x: 0.5, y: 0.45 }), 700);
    setTimeout(() => setPhase('reading'), 1700);
  };

  const next = async () => {
    if (reread) { onRereadDone(); return; }
    setBusy(true);
    try {
      const res = await visitorApi.post('/api/progress', { event: 'letter_read' });
      apply(res.state);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page className="justify-center">
      <AnimatePresence mode="wait">
        {phase !== 'reading' ? (
          <motion.div key="env" className="relative flex w-full flex-col items-center text-center" exit={{ opacity: 0, scale: 0.9, y: -30 }}>
            <FloatingHearts show={phase === 'opening'} />
            <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="font-heading text-3xl text-primary sm:text-4xl">{letter.envelopeTitle}</motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="mb-10 mt-3 text-lg text-ink/80">{letter.envelopeSubtitle}</motion.p>
            <motion.div initial={{ opacity: 0, y: 30, rotate: -4 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: 0.35, type: 'spring' }}
              className={phase === 'closed' ? 'animate-float' : ''}>
              <Envelope color={letter.envelopeColor} opening={phase === 'opening'} effect={letter.openEffect} />
            </motion.div>
            <GiftButton className="mt-12" onClick={open} disabled={phase !== 'closed'}>{letter.openButton}</GiftButton>
          </motion.div>
        ) : (
          <motion.div
            key="paper" className="w-full"
            initial={letter.openEffect === 'zoom' ? { opacity: 0, scale: 0.6 } : { opacity: 0, y: 60 }}
            animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <LetterPaper letter={letter} typing={firstTime && !typed} onTyped={() => setTyped(true)} />
            <div className="mt-8 flex flex-col items-center gap-3">
              {!typed && <button className="text-sm text-ink/50 underline" onClick={() => setTyped(true)}>อ่านเร็ว ๆ แล้ว ข้ามได้น้า</button>}
              <AnimatePresence>
                {typed && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <GiftButton onClick={next} disabled={busy}>{reread ? 'กลับไปดูของขวัญ 🎁' : letter.nextButton}</GiftButton>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Page>
  );
}
