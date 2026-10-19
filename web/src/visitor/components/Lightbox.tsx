import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';

export interface LightboxItem { url: string; caption?: string }

/** Full-screen image viewer: arrows, keyboard, swipe on phones. */
export function Lightbox({ items, index, onIndex, onClose }: {
  items: LightboxItem[]; index: number | null; onIndex: (i: number) => void; onClose: () => void;
}) {
  const open = index !== null && !!items[index];
  const go = (d: number) => { if (index !== null) onIndex((index + d + items.length) % items.length); };

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = prev; };
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black/75 backdrop-blur-md"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.figure
              key={index}
              className="flex max-h-[85dvh] w-full max-w-3xl flex-col items-center px-4"
              initial={{ opacity: 0, x: 60, scale: 0.96 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -60, scale: 0.96 }}
              transition={{ type: 'spring', damping: 26, stiffness: 260 }}
              drag={items.length > 1 ? 'x' : false} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.6}
              onDragEnd={(_, info) => { if (info.offset.x < -60) go(1); else if (info.offset.x > 60) go(-1); }}
              onClick={(e) => e.stopPropagation()}
            >
              <img src={items[index!].url} alt={items[index!].caption ?? ''} draggable={false}
                className="max-h-[75dvh] w-auto max-w-full rounded-2xl bg-white object-contain p-2 shadow-2xl" />
              {items[index!].caption && <figcaption className="mt-3 text-center font-letter text-lg text-white">{items[index!].caption}</figcaption>}
            </motion.figure>
          </AnimatePresence>
          {items.length > 1 && (
            <>
              <button aria-label="ก่อนหน้า" onClick={(e) => { e.stopPropagation(); go(-1); }} className="absolute left-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/80 text-xl">‹</button>
              <button aria-label="ถัดไป" onClick={(e) => { e.stopPropagation(); go(1); }} className="absolute right-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/80 text-xl">›</button>
              <p className="absolute bottom-safe text-sm text-white/80">{index! + 1} / {items.length}</p>
            </>
          )}
          <button aria-label="ปิด" onClick={onClose} className="absolute right-4 top-[calc(var(--safe-top)+1rem)] grid h-11 w-11 place-items-center rounded-full bg-white/80 text-lg">✕</button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
