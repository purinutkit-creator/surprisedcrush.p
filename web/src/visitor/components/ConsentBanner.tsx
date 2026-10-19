import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { visitorApi } from '../../lib/api';
import { useVisitor } from '../context';

/** Tells the visitor what is tracked and asks before any Live View sharing. */
export function ConsentBanner() {
  const { state, apply } = useVisitor();
  const t = state.tracking ?? {};
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const needed = !t.ack && (t.noticeEnabled || t.liveViewEnabled) && state.mode !== 'preview';

  useEffect(() => {
    if (!needed) { setShow(false); return; }
    const id = setTimeout(() => setShow(true), 1800);
    return () => clearTimeout(id);
  }, [needed]);

  const answer = async (live: boolean | null) => {
    setBusy(true);
    try {
      const res = await visitorApi.post('/api/consent', live === null ? { ack: true } : { ack: true, live });
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
          className="fixed inset-x-3 bottom-safe z-50 mx-auto max-w-md" role="dialog" aria-label="การแจ้งเตือนความเป็นส่วนตัว"
        >
          <div className="gift-card p-5 text-sm leading-relaxed" data-style="solid">
            <p className="mb-1 font-heading text-base text-primary">ก่อนเปิดของขวัญ 🎀</p>
            {t.noticeEnabled && <p className="mb-3 text-ink/80">{t.noticeText}</p>}
            {t.liveViewEnabled ? (
              <>
                <p className="mb-4 text-ink/90">{t.consentText}</p>
                <div className="flex gap-2">
                  <button disabled={busy} className="gift-btn !min-h-[44px] flex-1 !px-3 !text-base" onClick={() => answer(true)}>อนุญาต 💗</button>
                  <button disabled={busy} className="gift-btn-ghost flex-1 !min-h-[44px]" onClick={() => answer(false)}>ไม่อนุญาต</button>
                </div>
              </>
            ) : (
              <button disabled={busy} className="gift-btn w-full !min-h-[44px] !text-base" onClick={() => answer(null)}>รับทราบ 💗</button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Always visible while sharing, so the visitor can stop at any moment. */
export function LiveIndicator() {
  const { state, apply, live } = useVisitor();
  const [recording, setRecording] = useState(false);
  useEffect(() => live.on((m) => { if (m.t === 'record') setRecording(!!m.on); }), [live]);
  if (!state.tracking?.live) return null;
  const stop = async () => {
    const res = await visitorApi.post('/api/consent', { live: false });
    apply(res.state);
  };
  return (
    <div className="fixed left-1/2 top-[calc(var(--safe-top)+0.5rem)] z-50 -translate-x-1/2">
      <button onClick={stop} className="flex items-center gap-2 rounded-full border border-line bg-card/85 px-3 py-1.5 text-xs shadow-soft backdrop-blur">
        <span className={`h-2 w-2 rounded-full ${recording ? 'bg-red-500 animate-pulse' : 'bg-ink/30'}`} />
        {recording ? 'กำลังแชร์หน้าเว็บนี้' : 'อนุญาตให้แชร์หน้าเว็บ'}
        <span className="font-bold text-primary">หยุดแชร์</span>
      </button>
    </div>
  );
}
