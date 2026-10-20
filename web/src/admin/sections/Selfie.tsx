import { useState } from 'react';
import { adminApi } from '../../lib/api';
import { Btn, Color, Empty, MediaInput, Row, SaveBar, Section, Select, Text, Toggle } from '../components/form';
import { FrameOverlay } from '../../visitor/components/Camera';
import { Lightbox } from '../../visitor/components/Lightbox';
import { fmtDateTime } from '../events';
import { useAdmin, useAsync, useLiveBus, useSection } from '../store';

export default function Selfie() {
  const { value: s, set, save, saving, dirty, reset } = useSection<any>('selfie');
  const [test, setTest] = useState(false);
  const shots = useAsync(() => adminApi.get(`/selfies?test=${test ? 1 : 0}`), [test]);
  useLiveBus((m) => { if (m.t === 'selfie_new') shots.reload(); }, [shots.reload]);
  const { toast, setUnread } = useAdmin();
  const [zoom, setZoom] = useState<number | null>(null);
  const list: any[] = shots.data ?? [];

  const del = async (id: string) => {
    if (!confirm('ลบรูปนี้ถาวร?')) return;
    await adminApi.del(`/selfies/${id}`);
    toast('ลบแล้ว', 'ok');
    shots.reload();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Selfie & ของที่ระลึก 🤳</h1>
      <Section title="ตั้งค่าหน้าเซลฟี่" desc="หน้าชวนถ่ายรูปก่อนเปิดของขวัญ — ผู้รับเลือกเองว่าจะถ่ายและจะส่งไหม ข้ามได้เสมอ ไม่บล็อกทางเข้า และรูปจะส่งก็ต่อเมื่อผู้รับกดส่งเท่านั้น">
        <Toggle label="เปิดหน้าเซลฟี่" checked={s.enabled} onChange={(v) => set({ enabled: v })} />
        <Row>
          <Text label="หัวข้อ" value={s.title} onChange={(v) => set({ title: v })} />
          <Text label="ข้อความรอง" value={s.subtitle} onChange={(v) => set({ subtitle: v })} />
          <Text label="ป้ายรูปที่ 1 (คู่กับของขวัญ)" value={s.giftLabel} onChange={(v) => set({ giftLabel: v })} />
          <Text label="ป้ายรูปที่ 2 (คู่กับตัวแทนของเรา)" value={s.togetherLabel} onChange={(v) => set({ togetherLabel: v })} />
          <Text label="ปุ่มส่งรูป" value={s.sendLabel} onChange={(v) => set({ sendLabel: v })} />
          <Text label="ปุ่มข้าม" value={s.skipLabel} onChange={(v) => set({ skipLabel: v })} />
          <Text label="ข้อความขอบคุณหลังส่ง" value={s.thanksText} onChange={(v) => set({ thanksText: v })} />
        </Row>
        <Row>
          <MediaInput label="รูปตัวแทนของเรา" hint="เช่น รูปเรา รูปการ์ตูน หรือสติกเกอร์ ให้ผู้รับถ่ายคู่ด้วย" value={s.representationImageId} onChange={(id) => set({ representationImageId: id })} />
          <Text label="คำบรรยายใต้รูปตัวแทน" value={s.representationCaption} onChange={(v) => set({ representationCaption: v })} />
        </Row>
      </Section>

      <Section title="กรอบรูปถ่าย 🖼️" desc="เลือกกรอบสำเร็จรูป หรืออัปโหลดกรอบ PNG พื้นใสของตัวเอง (ครอบรูปสี่เหลี่ยมจัตุรัส)">
        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <div className="space-y-4">
            <Row>
              <Select label="สไตล์กรอบ" value={s.frameStyle} onChange={(v) => set({ frameStyle: v })} options={[
                ['polaroid', 'โพลารอยด์ (ขอบขาว + ข้อความ)'], ['hearts', 'หัวใจ 💗'], ['pastel', 'ขอบพาสเทล'], ['none', 'ไม่มีกรอบ'], ['custom', 'กรอบที่อัปโหลดเอง'],
              ]} />
              <Color label="สีกรอบ/ข้อความ" value={s.frameColor} onChange={(v) => set({ frameColor: v })} />
              <Text label="ข้อความบนกรอบ" value={s.frameCaption} onChange={(v) => set({ frameCaption: v })} />
            </Row>
            {s.frameStyle === 'custom' && (
              <MediaInput label="ไฟล์กรอบ PNG พื้นใส" hint="ควรเป็นสี่เหลี่ยมจัตุรัส ตรงกลางโปร่งใสเพื่อให้เห็นหน้า" value={s.frameImageId} onChange={(id) => set({ frameImageId: id })} />
            )}
          </div>
          <div>
            <p className="mb-1 text-sm text-zinc-500">ตัวอย่างกรอบ</p>
            <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-gradient-to-br from-pink-100 to-violet-100">
              <div className="absolute inset-0 grid place-items-center text-5xl opacity-40">🙂</div>
              <FrameOverlay frame={{ style: s.frameStyle, imageUrl: s.frameImageId ? `/media/${s.frameImageId}` : null, color: s.frameColor, caption: s.frameCaption }} />
            </div>
          </div>
        </div>
      </Section>

      <Section title="รูปที่ได้รับ" desc="เห็นเฉพาะในหน้าแอดมินนี้" actions={
        <div className="flex gap-1 text-sm">
          <button className={`rounded-lg px-2.5 py-1 ${!test ? 'bg-pink-500 text-white' : 'bg-zinc-100'}`} onClick={() => setTest(false)}>รูปจริง</button>
          <button className={`rounded-lg px-2.5 py-1 ${test ? 'bg-violet-600 text-white' : 'bg-zinc-100'}`} onClick={() => setTest(true)}>ทดสอบ</button>
          <Btn onClick={() => { shots.reload(); setUnread((x) => x); }}>↻</Btn>
        </div>
      }>
        {list.length === 0 ? <Empty>ยังไม่มีรูปส่งเข้ามา</Empty> : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {list.map((p, i) => (
              <figure key={p.id} className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
                <button className="block w-full" onClick={() => setZoom(i)}>
                  <img src={p.url} alt="" className="aspect-square w-full object-cover" />
                </button>
                <figcaption className="flex items-center justify-between gap-1 p-1.5 text-xs text-zinc-500">
                  <span>{p.kind === 'together' ? '💞 คู่ตัวแทน' : '🎁 กับของขวัญ'}</span>
                  <button className="text-red-500 hover:underline" onClick={() => del(p.id)}>ลบ</button>
                </figcaption>
                <p className="px-1.5 pb-1.5 text-[11px] text-zinc-400">{fmtDateTime(p.created_at)} · {p.device ?? ''}</p>
              </figure>
            ))}
          </div>
        )}
      </Section>

      <Lightbox items={list.map((p) => ({ url: p.url, caption: p.kind === 'together' ? 'คู่กับตัวแทนของเรา' : 'กับของขวัญ' }))} index={zoom} onIndex={setZoom} onClose={() => setZoom(null)} />
      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={reset} />
    </div>
  );
}
