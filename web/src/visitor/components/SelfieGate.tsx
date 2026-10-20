import { AnimatePresence, motion } from 'framer-motion';
import { useRef, useState } from 'react';
import { visitorApi } from '../../lib/api';
import { heartExplosion } from '../../lib/confetti';
import { sfx } from '../../lib/sfx';
import { useVisitor } from '../context';
import { GiftButton, Page, PopIn } from '../ui';
import { GiftBox } from '../pages/Welcome';

/**
 * Optional selfie keepsake shown before the gift.
 * It is always skippable and only sends a photo when the recipient taps "send" — nothing is
 * captured automatically and the camera is only opened by their own tap.
 */
function Slot({ label, kind, guideUrl, guideCaption, sendLabel }: {
  label: string; kind: 'gift' | 'together'; guideUrl?: string | null; guideCaption?: string; sendLabel: string;
}) {
  const { apply } = useVisitor();
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { setErr('เลือกเป็นรูปภาพน้า'); return; }
    setErr(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setSent(false);
  };
  const send = async () => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await visitorApi.uploadSelfie(file, kind);
      setSent(true);
      sfx.pop();
      heartExplosion({ x: 0.5, y: 0.5 });
      if (res.state) apply(res.state);
    } catch (e: any) {
      setErr(e.message ?? 'ส่งไม่สำเร็จ ลองใหม่น้า');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-[var(--radius)] border border-line bg-card/80 p-4">
      <p className="mb-3 text-center font-heading text-lg text-primary">{label}</p>
      {kind === 'together' && guideUrl && (
        <figure className="mx-auto mb-3 w-40 rotate-[-2deg] bg-white p-2 pb-6 shadow">
          <img src={guideUrl} alt="" className="aspect-square w-full rounded object-cover" />
          {guideCaption && <figcaption className="pt-1 text-center font-letter text-xs text-ink/70">{guideCaption}</figcaption>}
        </figure>
      )}
      <div className="flex flex-col items-center gap-3">
        {preview ? (
          <img src={preview} alt="ตัวอย่างรูปของคุณ" className="max-h-56 w-auto rounded-2xl border border-line object-contain" />
        ) : (
          <button onClick={() => ref.current?.click()} className="grid h-40 w-40 place-items-center rounded-2xl border-2 border-dashed border-primary/40 text-center text-sm text-ink/60">
            <span><span className="block text-4xl">📸</span>แตะเพื่อถ่าย / เลือกรูป</span>
          </button>
        )}
        {/* capture="user" opens the front camera on phones; on desktop it's a normal file picker. */}
        <input ref={ref} type="file" accept="image/*" capture="user" className="hidden" onChange={pick} />
        {err && <p className="text-sm text-primary">{err}</p>}
        <AnimatePresence mode="wait">
          {sent ? (
            <motion.p key="sent" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-heading text-emerald-600">ส่งแล้ว 💗</motion.p>
          ) : (
            <motion.div key="btns" className="flex gap-2">
              {preview && <button className="gift-btn-ghost !min-h-[44px] !px-4" onClick={() => ref.current?.click()}>ถ่ายใหม่</button>}
              <GiftButton className="!min-h-[46px] !px-5 !text-base" disabled={!file || busy} onClick={send}>{busy ? 'กำลังส่ง…' : sendLabel}</GiftButton>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function SelfieGate({ onDone }: { onDone: () => void }) {
  const { state } = useVisitor();
  const sf = state.selfie;
  const [busy, setBusy] = useState(false);
  if (!sf?.enabled) { onDone(); return null; }

  const finish = async () => {
    setBusy(true);
    try { await visitorApi.post('/api/progress', { event: 'selfie_done' }); } catch { /* optional */ }
    onDone();
  };

  return (
    <Page className="justify-center">
      <PopIn className="mb-4"><GiftBox size={96} /></PopIn>
      <h1 className="text-center font-heading text-2xl text-primary sm:text-3xl">{sf.title}</h1>
      <p className="mx-auto mt-3 max-w-md text-center text-ink/80">{sf.subtitle}</p>
      <p className="mt-2 text-center text-xs text-ink/50">รูปจะส่งก็ต่อเมื่อเธอกดส่งเองนะ ไม่กดก็ไม่มีอะไรถูกส่ง 💗</p>

      <div className="mt-6 grid w-full gap-4 sm:grid-cols-2">
        <Slot label={sf.giftLabel} kind="gift" sendLabel={sf.sendLabel} />
        <Slot label={sf.togetherLabel} kind="together" guideUrl={sf.representationImageUrl} guideCaption={sf.representationCaption} sendLabel={sf.sendLabel} />
      </div>

      <div className="mt-8 flex flex-col items-center gap-2">
        <GiftButton disabled={busy} onClick={finish}>{state.progress.selfieDone ? 'ไปเปิดของขวัญต่อ 🎁' : 'เข้าสู่ของขวัญเลย 🎁'}</GiftButton>
        {!state.progress.selfieDone && <button className="text-sm text-ink/50 underline" onClick={finish} disabled={busy}>{sf.skipLabel}</button>}
      </div>
    </Page>
  );
}
