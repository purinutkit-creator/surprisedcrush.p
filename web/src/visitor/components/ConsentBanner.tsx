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

const LOC_KEY = 'gift_loc_asked';

/** Optional location share. Appears only if the admin enabled it; the browser's own prompt still gates it. */
export function LocationPrompt() {
  const { state, apply } = useVisitor();
  const t = state.tracking ?? {};
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const askedLocal = (() => { try { return localStorage.getItem(LOC_KEY) === '1'; } catch { return false; } })();
  // Show only after the notice is acknowledged, and only once.
  const needed = t.askLocation && !t.locationShared && !t.locationAsked && !askedLocal && t.ack && state.mode !== 'preview';

  useEffect(() => {
    if (!needed) { setShow(false); return; }
    const id = setTimeout(() => setShow(true), 900);
    return () => clearTimeout(id);
  }, [needed]);

  const remember = () => { try { localStorage.setItem(LOC_KEY, '1'); } catch { /* ignore */ } };
  const skip = async () => {
    remember();
    setShow(false);
    try { apply((await visitorApi.post('/api/progress', { event: 'location_asked' })).state); } catch { /* optional */ }
  };
  const allow = () => {
    if (!('geolocation' in navigator)) { setErr('อุปกรณ์นี้แชร์ตำแหน่งไม่ได้'); return; }
    setBusy(true);
    setErr(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await visitorApi.post('/api/location', { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
          remember();
          apply(res.state);
          setShow(false);
        } catch (e: any) {
          setErr(e.message ?? 'ส่งไม่สำเร็จ');
        } finally {
          setBusy(false);
        }
      },
      (geoErr) => {
        setBusy(false);
        // Permission denied or unavailable — the recipient stays in control.
        if (geoErr.code === geoErr.PERMISSION_DENIED) skip();
        else setErr('ขอตำแหน่งไม่สำเร็จ ลองใหม่หรือข้ามได้น้า');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 120, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 260 }}
          className="fixed inset-x-3 bottom-safe z-50 mx-auto max-w-md" role="dialog" aria-label="แชร์ตำแหน่ง"
        >
          <div className="gift-card p-5 text-sm leading-relaxed" data-style="solid">
            <p className="mb-1 font-heading text-base text-primary">อีกนิดนึง 📍</p>
            <p className="mb-4 text-ink/80">{t.locationText}</p>
            {err && <p className="mb-2 text-primary">{err}</p>}
            <div className="flex gap-2">
              <button disabled={busy} className="gift-btn !min-h-[44px] flex-1 !px-3 !text-base" onClick={allow}>{busy ? 'กำลังขอ…' : 'แชร์ตำแหน่ง 💗'}</button>
              <button disabled={busy} className="gift-btn-ghost flex-1 !min-h-[44px]" onClick={skip}>ขอข้าม</button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
