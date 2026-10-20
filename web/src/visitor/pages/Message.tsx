import { AnimatePresence, motion } from 'framer-motion';
import { useRef, useState } from 'react';
import { ApiError, visitorApi } from '../../lib/api';
import { heartExplosion } from '../../lib/confetti';
import { sfx } from '../../lib/sfx';
import { countChars, fill } from '../../lib/text';
import { useVisitor } from '../context';
import { Card, GiftButton, Page } from '../ui';

export default function MessagePage() {
  const { state, apply } = useVisitor();
  const m = state.message;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const typed = useRef(false);
  if (!m) return null;
  const min = Math.max(1, Number(m.minChars) || 50);
  const count = countChars(text);
  const ok = count >= min;
  const pct = Math.min(100, (count / min) * 100);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok || busy || sent) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await visitorApi.post('/api/message', { content: text });
      setSent(true);
      sfx.whoosh();
      setTimeout(() => { heartExplosion({ x: 0.5, y: 0.3 }); sfx.success(); }, 900);
      setTimeout(() => apply(res.state), 3200);
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : 'ส่งไม่สำเร็จ ลองใหม่อีกครั้งน้า');
      setBusy(false);
    }
  };

  return (
    <Page>
      <AnimatePresence mode="wait">
        {!sent ? (
          <motion.div key="form" className="flex w-full flex-col items-center" exit={{ opacity: 0 }}>
            <div className="mb-2 mt-6 text-6xl animate-float">💬</div>
            <h1 className="text-center font-heading text-2xl leading-snug text-primary sm:text-3xl">{m.title}</h1>
            <p className="mt-3 text-center text-lg text-ink/80">{m.subtitle}</p>
            <Card className="mt-6 w-full p-5">
              <form onSubmit={submit}>
                <textarea
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    if (!typed.current) { typed.current = true; visitorApi.track('message_typing'); }
                  }}
                  maxLength={Number(m.maxChars) || 5000}
                  rows={8}
                  placeholder={m.placeholder}
                  className="gift-input min-h-[220px] resize-y font-letter text-lg leading-relaxed"
                  aria-label="ข้อความถึงผู้ส่ง"
                />
                <div className="mt-3">
                  <div className="h-2 overflow-hidden rounded-full bg-line/50">
                    <motion.div className="h-full rounded-full bg-primary" animate={{ width: `${pct}%` }} transition={{ type: 'spring', damping: 20 }} />
                  </div>
                  <p className={`mt-1.5 text-right text-sm ${ok ? 'text-emerald-600' : 'text-ink/60'}`} aria-live="polite">
                    {fill(m.counterText, { COUNT: count, MIN: min })} {ok ? '✓' : ''}
                  </p>
                </div>
                {!ok && count > 0 && <p className="text-sm text-ink/60">{fill(m.tooShortText, { MIN: min, COUNT: count })}</p>}
                {err && <p className="mt-2 text-center text-primary" role="alert">{err}</p>}
                <GiftButton type="submit" disabled={!ok || busy} className="mt-5 w-full">{busy ? 'กำลังส่ง… 💨' : m.button}</GiftButton>
              </form>
            </Card>
          </motion.div>
        ) : (
          <motion.div key="sent" className="flex min-h-[70dvh] w-full flex-col items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <motion.div className="text-7xl"
              initial={{ x: 0, y: 0, rotate: 0, scale: 1 }}
              animate={{ x: [0, -20, 260], y: [0, 10, -420], rotate: [0, -10, 25], scale: [1, 1.1, 0.4], opacity: [1, 1, 0] }}
              transition={{ duration: 1.6, ease: 'easeIn' }}>💌</motion.div>
            <motion.p initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.2, type: 'spring' }}
              className="mt-4 font-heading text-3xl text-primary">{m.successText}</motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </Page>
  );
}
