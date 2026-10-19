import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { ApiError, visitorApi } from '../../lib/api';
import { celebrate } from '../../lib/confetti';
import { sfx } from '../../lib/sfx';
import { useVisitor } from '../context';
import { Card, GiftButton, Page, PopIn } from '../ui';

export function GiftBox({ size = 120 }: { size?: number }) {
  return (
    <div className="relative animate-float select-none" style={{ width: size, height: size }} aria-hidden>
      <div className="absolute inset-x-0 bottom-0 h-[62%] rounded-2xl bg-primary shadow-soft" />
      <div className="absolute inset-x-[-6%] top-[26%] h-[18%] rounded-xl bg-primary brightness-110" style={{ filter: 'brightness(1.08)' }} />
      <div className="absolute left-1/2 top-[26%] h-[74%] w-[16%] -translate-x-1/2 bg-secondary" />
      <div className="absolute left-1/2 top-[4%] -translate-x-1/2 text-[2.6em] leading-none" style={{ fontSize: size * 0.34 }}>🎀</div>
      <span className="absolute -right-4 top-2 text-2xl animate-heartbeat">💗</span>
      <span className="absolute -left-5 top-10 text-lg animate-pulse">✨</span>
    </div>
  );
}

export default function WelcomePage() {
  const { state, apply } = useVisitor();
  const r = state.recipient;
  const [d, setD] = useState({ day: '', month: '', year: '' });
  const [err, setErr] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [locked, setLocked] = useState<number>(r.lockedSeconds ?? 0);
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const typed = useRef(false);

  useEffect(() => {
    if (locked <= 0) return;
    const t = setInterval(() => setLocked((x) => Math.max(0, x - 1)), 1000);
    return () => clearInterval(t);
  }, [locked > 0]);

  const set = (key: 'day' | 'month' | 'year', max: number, idx: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, max);
    setD((x) => ({ ...x, [key]: v }));
    setErr(null);
    if (!typed.current) { typed.current = true; visitorApi.track('birthday_typing'); }
    if (v.length === max && idx < 2) refs[idx + 1].current?.focus();
  };
  const back = (idx: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !(e.target as HTMLInputElement).value && idx > 0) refs[idx - 1].current?.focus();
  };

  const finish = (s: any) => {
    setSuccess(true);
    sfx.success();
    celebrate();
    setTimeout(() => apply(s), 2200);
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy || locked > 0) return;
    if (!d.day || !d.month || d.year.length !== 4) {
      setErr('กรอกให้ครบ วัน / เดือน / ปี (4 หลัก) ก่อนน้า 🎀');
      setShake((x) => x + 1);
      return;
    }
    setBusy(true);
    try {
      const res = await visitorApi.post('/api/birthday', { day: +d.day, month: +d.month, year: +d.year });
      if (res.ok) finish(res.state);
      else {
        setErr(res.message);
        setShake((x) => x + 1);
        sfx.wrong();
        if (res.lockedSeconds) setLocked(res.lockedSeconds);
        setD({ day: '', month: '', year: '' });
        refs[0].current?.focus();
      }
    } catch (ex) {
      if (ex instanceof ApiError) {
        setErr(ex.message);
        if (ex.data?.lockedSeconds) setLocked(ex.data.lockedSeconds);
      }
      setShake((x) => x + 1);
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    setBusy(true);
    try {
      const res = await visitorApi.post('/api/start');
      finish(res.state);
    } catch (ex: any) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  const box = 'gift-input rr-mask text-center text-2xl font-number tracking-widest !px-2';
  return (
    <Page className="justify-center">
      <PopIn className="mb-6"><GiftBox /></PopIn>
      <motion.h1
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="text-center font-heading text-3xl leading-snug text-primary drop-shadow-sm sm:text-4xl"
      >
        {r.welcomeTitle}
      </motion.h1>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className="mt-4 max-w-md text-center text-lg leading-relaxed text-ink/80">
        {r.welcomeSubtitle}
      </motion.p>

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="mt-8 w-full max-w-sm">
        <Card className="p-6">
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div key="ok" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-6 text-center">
                <div className="mb-2 text-5xl animate-heartbeat">🥳</div>
                <p className="font-heading text-2xl text-primary">{r.birthdaySuccess}</p>
              </motion.div>
            ) : r.birthdayCheck ? (
              <motion.form key="form" onSubmit={submit} exit={{ opacity: 0, scale: 0.95 }}>
                <label className="mb-3 block text-center font-heading text-lg">{r.birthdayLabel}</label>
                <div key={shake} className={`flex items-center justify-center gap-2 ${shake ? 'animate-shake' : ''}`}>
                  <input ref={refs[0]} aria-label="วัน" inputMode="numeric" autoComplete="off" placeholder="DD" value={d.day} onChange={set('day', 2, 0)} onKeyDown={back(0)} className={`${box} w-16`} />
                  <span className="text-2xl text-primary/60">/</span>
                  <input ref={refs[1]} aria-label="เดือน" inputMode="numeric" autoComplete="off" placeholder="MM" value={d.month} onChange={set('month', 2, 1)} onKeyDown={back(1)} className={`${box} w-16`} />
                  <span className="text-2xl text-primary/60">/</span>
                  <input ref={refs[2]} aria-label="ปี" inputMode="numeric" autoComplete="off" placeholder="YYYY" value={d.year} onChange={set('year', 4, 2)} onKeyDown={back(2)} className={`${box} w-24`} />
                </div>
                <AnimatePresence>
                  {(err || locked > 0) && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 text-center text-primary" role="alert">
                      {locked > 0 ? `${err ?? ''} ลองใหม่ได้ใน ${Math.floor(locked / 60)}:${String(locked % 60).padStart(2, '0')} ⏳` : err}
                    </motion.p>
                  )}
                </AnimatePresence>
                <GiftButton type="submit" disabled={busy || locked > 0} className="mt-5 w-full">
                  {busy ? 'กำลังเช็ก… 💭' : r.birthdayButton}
                </GiftButton>
              </motion.form>
            ) : (
              <motion.div key="start" className="text-center">
                <GiftButton onClick={start} disabled={busy} className="w-full">{r.startButton}</GiftButton>
                {err && <p className="mt-3 text-primary">{err}</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>
    </Page>
  );
}
