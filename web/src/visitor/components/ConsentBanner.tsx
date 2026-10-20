import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { visitorApi } from '../../lib/api';
import { useVisitor } from '../context';

/** One-time heads-up that this gift shows the recipient's in-site activity to the gift-giver. */
export function ConsentBanner() {
  const { state, apply } = useVisitor();
  const t = state.tracking ?? {};
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const needed = !t.ack && t.noticeEnabled && state.mode !== 'preview';

  useEffect(() => {
    if (!needed) { setShow(false); return; }
    const id = setTimeout(() => setShow(true), 1800);
    return () => clearTimeout(id);
  }, [needed]);

  const ack = async () => {
    setBusy(true);
    try {
      const res = await visitorApi.post('/api/consent', { ack: true, live: t.liveViewEnabled });
      apply(res.state);
      setShow(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 120, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 260 }}
          className="fixed inset-x-3 bottom-safe z-50 mx-auto max-w-md" role="dialog" aria-label="หมายเหตุ"
        >
          <div className="gift-card p-5 text-sm leading-relaxed" data-style="solid">
            <p className="mb-1 font-heading text-base text-primary">ก่อนเปิดของขวัญ 🎀</p>
            <p className="mb-4 text-ink/80">{t.noticeText}</p>
            <button disabled={busy} className="gift-btn w-full !min-h-[44px] !text-base" onClick={ack}>รับทราบ 💗</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Kept for import compatibility; the gift no longer shows a persistent sharing control. */
export function LiveIndicator() {
  return null;
}
