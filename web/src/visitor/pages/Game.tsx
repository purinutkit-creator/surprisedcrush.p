import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { ApiError, visitorApi } from '../../lib/api';
import { burst } from '../../lib/confetti';
import { sfx } from '../../lib/sfx';
import { fill } from '../../lib/text';
import { useVisitor } from '../context';
import { Card, GiftButton, Page } from '../ui';

export function Hearts({ total, left }: { total: number; left: number }) {
  return (
    <div className="flex flex-wrap justify-center gap-1.5" aria-label={`เหลือ ${left} จาก ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <AnimatePresence key={i} mode="popLayout">
          {i < left ? (
            <motion.span key="full" className="text-3xl" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 1.8, opacity: 0, y: -20, rotate: 25 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18 }}>💗</motion.span>
          ) : (
            <motion.span key="empty" className="text-3xl opacity-30 grayscale" initial={{ scale: 0.5 }} animate={{ scale: 1 }}>🤍</motion.span>
          )}
        </AnimatePresence>
      ))}
    </div>
  );
}

export function HintList({ title, hints, special, total }: { title: string; hints: string[]; special: string[]; total: number }) {
  if (!hints.length && !special.length && !total) return null;
  return (
    <div className="mt-6 w-full">
      <h3 className="mb-3 text-center font-heading text-lg text-primary">{title}</h3>
      <ul className="space-y-2.5">
        {hints.map((h, i) => (
          <motion.li key={`h${i}`} initial={{ opacity: 0, scale: 0.85, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="flex gap-3 rounded-2xl border border-line bg-card/85 p-3.5 shadow-sm">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary font-number text-sm text-white">{i + 1}</span>
            <span className="leading-relaxed">{h}</span>
          </motion.li>
        ))}
        {special.map((h, i) => (
          <motion.li key={`s${i}`} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
            className="flex gap-3 rounded-2xl border-2 border-primary/40 bg-secondary/50 p-3.5 animate-glow">
            <span className="text-xl">🌟</span><span className="leading-relaxed">{h}</span>
          </motion.li>
        ))}
        {Array.from({ length: Math.max(0, total - hints.length) }).map((_, i) => (
          <li key={`l${i}`} className="flex items-center gap-3 rounded-2xl border border-dashed border-line bg-card/40 p-3.5 text-ink/40">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-line/60 text-sm">🔒</span>คำใบ้ที่ {hints.length + i + 1} — ทายผิดแล้วจะเปิดให้น้า
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function GamePage() {
  const { state, apply } = useVisitor();
  const g = state.game;
  const p = state.progress;
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; key: number; good?: boolean } | null>(null);
  const [shake, setShake] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!p.gameStarted) visitorApi.post('/api/progress', { event: 'game_started' }).catch(() => {});
  }, [p.gameStarted]);

  if (!g) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const res = await visitorApi.post('/api/guess', { name });
      if (res.correct) {
        sfx.success();
        burst();
        setMsg({ text: 'ใช่เลยยย! 💗', key: Date.now(), good: true });
        setTimeout(() => apply(res.state), 900);
      } else {
        sfx.wrong();
        setShake((x) => x + 1);
        setMsg({ text: res.message, key: Date.now() });
        setName('');
        if (res.newHint) setTimeout(() => sfx.pop(), 350);
        if (res.exhausted) setTimeout(() => apply(res.state), 1800);
        else apply(res.state);
        inputRef.current?.focus();
      }
    } catch (ex) {
      setMsg({ text: ex instanceof ApiError ? ex.message : 'ลองใหม่อีกครั้งน้า', key: Date.now() });
      if (ex instanceof ApiError && ex.data?.exhausted) visitorApi.get('/api/state').then(apply);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-3 mt-4 text-6xl animate-float">🕵️‍♀️</motion.div>
      <h1 className="text-center font-heading text-3xl text-primary sm:text-4xl">{g.title}</h1>
      <p className="mt-3 max-w-md text-center text-lg text-ink/80">{g.subtitle}</p>

      <Card className="mt-6 w-full p-5 sm:p-6">
        {g.showHearts && <Hearts total={p.attemptsTotal} left={p.attemptsLeft} />}
        <p className="mt-2 text-center font-heading text-primary">{fill(g.remainingText, { N: p.attemptsLeft })}</p>
        <form onSubmit={submit} className="mt-4">
          <div key={shake} className={shake ? 'animate-shake' : ''}>
            <input
              ref={inputRef} value={name} onChange={(e) => setName(e.target.value)} placeholder={g.placeholder} maxLength={80}
              autoComplete="off" enterKeyHint="send" className="gift-input text-center text-lg" aria-label="ชื่อที่คิดว่าใช่"
            />
          </div>
          <GiftButton type="submit" disabled={busy || !name.trim()} className="mt-4 w-full">{busy ? 'ลุ้นแป๊บ… 🤞' : g.button}</GiftButton>
        </form>
        <div className="min-h-[3rem] pt-3 text-center">
          <AnimatePresence mode="wait">
            {msg && (
              <motion.p key={msg.key} role="status" initial={{ opacity: 0, scale: 0.6, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 18 }}
                className={`inline-block rounded-full px-4 py-2 font-heading ${msg.good ? 'bg-primary text-white' : 'bg-secondary/80 text-ink'}`}>
                {msg.text}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </Card>

      <HintList title={g.hintsTitle} hints={g.hints} special={g.specialHints} total={g.hintsTotal} />

      {g.guesses?.length > 0 && (
        <div className="mt-6 w-full text-center">
          <p className="mb-2 text-sm text-ink/60">ชื่อที่ทายไปแล้ว</p>
          <div className="flex flex-wrap justify-center gap-2">
            {g.guesses.filter((x: any) => !x.correct).map((x: any, i: number) => (
              <span key={i} className="rounded-full border border-line bg-card/70 px-3 py-1 text-sm text-ink/70 line-through decoration-primary/60">{x.guess}</span>
            ))}
          </div>
        </div>
      )}
    </Page>
  );
}
