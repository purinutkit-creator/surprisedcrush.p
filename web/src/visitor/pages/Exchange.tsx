import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { ApiError, visitorApi } from '../../lib/api';
import { burst } from '../../lib/confetti';
import { sfx } from '../../lib/sfx';
import { countChars } from '../../lib/text';
import { useVisitor } from '../context';
import { Card, GiftButton, Page } from '../ui';
import { HintList } from './Game';

function rewardChips(r: any) {
  const chips: string[] = [];
  if (r.extraChances > 0) chips.push(`+${r.extraChances} โอกาสทาย 💗`);
  if (r.specialHint) chips.push('คำใบ้พิเศษ 🌟');
  if (r.reveal) chips.push('เปิดเฉลย 🎁');
  return chips;
}

const statusLabel: Record<string, { text: string; cls: string }> = {
  pending: { text: 'รออนุมัติ ⏳', cls: 'bg-amber-100 text-amber-700' },
  approved: { text: 'สำเร็จแล้ว ✓', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { text: 'ยังไม่ผ่าน', cls: 'bg-rose-100 text-rose-700' },
  failed: { text: 'ลองใหม่ได้', cls: 'bg-rose-50 text-rose-600' },
};

function Mission({ m, pendingText, rejectedText }: { m: any; pendingText: string; rejectedText: string }) {
  const { apply } = useVisitor();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const done = m.status === 'approved';
  const pending = m.status === 'pending';
  const blocked = done || pending || m.triesLeft <= 0;
  const long = m.kind === 'message' || m.kind === 'free';
  const count = countChars(text);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await visitorApi.post(`/api/exchange/${m.id}`, { submission: text });
      setMsg({ text: res.message, ok: res.status !== 'failed' });
      if (res.status === 'approved') { sfx.success(); burst(); setTimeout(() => apply(res.state), 1500); }
      else { if (res.status === 'failed') sfx.wrong(); apply(res.state); }
      if (res.status !== 'failed') setText('');
    } catch (ex) {
      setMsg({ text: ex instanceof ApiError ? ex.message : 'ลองใหม่อีกครั้งน้า', ok: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-heading text-xl text-primary">{m.title}</h3>
          {m.status && statusLabel[m.status] && <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${statusLabel[m.status].cls}`}>{statusLabel[m.status].text}</span>}
        </div>
        {m.description && <p className="mt-1 text-ink/75">{m.description}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {rewardChips(m.reward).map((c) => <span key={c} className="rounded-full bg-secondary/70 px-2.5 py-0.5 text-xs">{c}</span>)}
          {m.requiresApproval && <span className="rounded-full bg-accent/70 px-2.5 py-0.5 text-xs">ต้องรอคนส่งอนุมัติ</span>}
        </div>
        {m.kind === 'question' && m.question && <p className="mt-4 rounded-2xl bg-card/80 p-3 font-heading">❓ {m.question}</p>}
        {m.kind === 'phrase' && m.phrase && (
          <p className="mt-4 rounded-2xl border border-dashed border-primary/50 bg-card/80 p-3 text-center font-heading">“{m.phrase}”</p>
        )}
        {pending && <p className="mt-4 text-center text-ink/70">{pendingText}</p>}
        {m.status === 'rejected' && <p className="mt-4 text-center text-ink/70">{rejectedText}</p>}
        {!blocked && (
          <form onSubmit={submit} className="mt-4">
            {long ? (
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={3000} className="gift-input rr-mask resize-none"
                placeholder={m.kind === 'message' ? 'พิมพ์ข้อความถึงคนส่งของขวัญ…' : 'พิมพ์คำขอของเธอ…'} />
            ) : (
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} className="gift-input rr-mask"
                placeholder={m.kind === 'phrase' ? 'พิมพ์ข้อความตามด้านบน…' : 'คำตอบของเธอ…'} />
            )}
            {m.kind === 'message' && m.minLength > 0 && <p className="mt-1 text-right text-sm text-ink/60">{count} / {m.minLength} ตัวอักษร</p>}
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-ink/50">เหลือ {m.triesLeft} ครั้ง</span>
              <GiftButton type="submit" disabled={busy || !text.trim()} className="!min-h-[46px] !px-5 !text-base">{busy ? 'กำลังตรวจ…' : 'ส่งภารกิจ ✨'}</GiftButton>
            </div>
          </form>
        )}
        {!done && !pending && m.triesLeft <= 0 && <p className="mt-3 text-center text-sm text-ink/60">ใช้สิทธิ์ภารกิจนี้ครบแล้วน้า</p>}
        <AnimatePresence>
          {msg && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`mt-3 text-center font-heading ${msg.ok ? 'text-emerald-600' : 'text-primary'}`}>
              {msg.text}
            </motion.p>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

export default function ExchangePage() {
  const { state } = useVisitor();
  const e = state.exchange;
  const g = state.game;
  const [open, setOpen] = useState(false);
  if (!e) return null;
  const missions: any[] = e.missions ?? [];

  return (
    <Page>
      <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-6 text-7xl">🥺</motion.div>
      <h1 className="mt-4 text-center font-heading text-3xl text-primary">{e.exhaustedTitle}</h1>
      <p className="mt-3 text-center text-lg text-ink/80">{e.exhaustedSubtitle}</p>

      {!open && e.enabled && missions.length > 0 && (
        <GiftButton className="mt-8" onClick={() => setOpen(true)}>{e.exchangeButton}</GiftButton>
      )}
      {(!e.enabled || missions.length === 0) && <p className="mt-8 text-center text-ink/70">{e.noMissionsText}</p>}

      <AnimatePresence>
        {open && (
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-8 w-full space-y-4">
            <h2 className="text-center font-heading text-xl">{e.listTitle}</h2>
            {missions.map((m) => <Mission key={m.id} m={m} pendingText={e.pendingText} rejectedText={e.rejectedText} />)}
          </motion.section>
        )}
      </AnimatePresence>

      {g && <HintList title={g.hintsTitle} hints={g.hints} special={g.specialHints} total={0} />}
    </Page>
  );
}
