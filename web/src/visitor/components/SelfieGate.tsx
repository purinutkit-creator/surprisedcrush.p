import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { visitorApi } from '../../lib/api';
import { heartExplosion } from '../../lib/confetti';
import { sfx } from '../../lib/sfx';
import { useVisitor } from '../context';
import { GiftButton, Page, PopIn } from '../ui';
import { GiftBox } from '../pages/Welcome';
import { CameraCapture, type Frame } from './Camera';

/**
 * Optional selfie keepsake shown before the gift. Always skippable.
 * Uses an in-app camera with a decorative frame (set by the admin); a photo is only sent
 * when the recipient taps send, and the camera opens only on their own tap.
 */
function Slot({ label, kind, frame, guideUrl, guideCaption, sendLabel }: {
  label: string; kind: 'gift' | 'together'; frame: Frame; guideUrl?: string | null; guideCaption?: string; sendLabel: string;
}) {
  const { apply } = useVisitor();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onCapture = (b: Blob) => { setBlob(b); setPreview(URL.createObjectURL(b)); setSent(false); setErr(null); };
  const send = async () => {
    if (!blob) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await visitorApi.uploadSelfie(blob, kind);
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
        <figure className="mx-auto mb-3 w-32 rotate-[-2deg] bg-white p-2 pb-5 shadow">
          <img src={guideUrl} alt="" className="aspect-square w-full rounded object-cover" />
          {guideCaption && <figcaption className="pt-1 text-center font-letter text-xs text-ink/70">{guideCaption}</figcaption>}
        </figure>
      )}
      {sent ? (
        <div className="flex flex-col items-center gap-2 py-4">
          {preview && <img src={preview} alt="" className="max-h-56 rounded-2xl" />}
          <p className="font-heading text-emerald-600">ส่งแล้ว 💗</p>
        </div>
      ) : preview ? (
        <div className="flex flex-col items-center gap-3">
          <div className="relative aspect-square w-full max-w-[280px] overflow-hidden rounded-2xl">
            <img src={preview} alt="ตัวอย่างรูป" className="h-full w-full object-cover" />
          </div>
          {err && <p className="text-center text-sm text-primary">{err}</p>}
          <div className="flex gap-2">
            <button className="gift-btn-ghost !min-h-[46px]" onClick={() => { setBlob(null); setPreview(null); }}>ถ่ายใหม่</button>
            <GiftButton className="!min-h-[46px] !px-5 !text-base" disabled={busy} onClick={send}>{busy ? 'กำลังส่ง…' : sendLabel}</GiftButton>
          </div>
        </div>
      ) : (
        <CameraCapture frame={frame} onCapture={onCapture} busy={busy} />
      )}
    </div>
  );
}

export function SelfieGate({ onDone }: { onDone: () => void }) {
  const { state } = useVisitor();
  const sf = state.selfie;
  const [busy, setBusy] = useState(false);
  if (!sf?.enabled) { onDone(); return null; }

  const frame: Frame = { style: sf.frameStyle ?? 'polaroid', imageUrl: sf.frameImageUrl, color: sf.frameColor, caption: sf.frameCaption };

  const finish = async () => {
    setBusy(true);
    try { await visitorApi.post('/api/progress', { event: 'selfie_done' }); } catch { /* optional */ }
    onDone();
  };

  return (
    <Page className="justify-center">
      <PopIn className="mb-4"><GiftBox size={88} /></PopIn>
      <h1 className="text-center font-heading text-2xl text-primary sm:text-3xl">{sf.title}</h1>
      <p className="mx-auto mt-3 max-w-md text-center text-ink/80">{sf.subtitle}</p>
      <p className="mt-2 text-center text-xs text-ink/50">รูปจะส่งก็ต่อเมื่อเธอกดส่งเองนะ กล้องจะเปิดเมื่อเธอแตะเท่านั้น 💗</p>

      <div className="mt-6 grid w-full gap-4 sm:grid-cols-2">
        <Slot label={sf.giftLabel} kind="gift" frame={frame} sendLabel={sf.sendLabel} />
        <Slot label={sf.togetherLabel} kind="together" frame={frame} guideUrl={sf.representationImageUrl} guideCaption={sf.representationCaption} sendLabel={sf.sendLabel} />
      </div>

      <div className="mt-8 flex flex-col items-center gap-2">
        <GiftButton disabled={busy} onClick={finish}>{state.progress.selfieDone ? 'ไปเปิดของขวัญต่อ 🎁' : 'เข้าสู่ของขวัญเลย 🎁'}</GiftButton>
        {!state.progress.selfieDone && <button className="text-sm text-ink/50 underline" onClick={finish} disabled={busy}>{sf.skipLabel}</button>}
      </div>
    </Page>
  );
}
