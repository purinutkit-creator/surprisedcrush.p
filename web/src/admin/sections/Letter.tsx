import { useState } from 'react';
import { Envelope, LetterPaper } from '../../visitor/pages/Letter';
import { FontSelect } from '../components/FontSelect';
import { Area, Btn, Color, MediaInput, Num, Row, SaveBar, Section, Select, Text } from '../components/form';
import { PreviewBox, toPublicLetter, useVars } from '../components/Preview';
import { useAdmin, useSection } from '../store';

export default function Letter() {
  const { content } = useAdmin();
  const { value: l, set, save, saving, dirty, reset } = useSection<any>('letter');
  const vars = useVars();
  const [replay, setReplay] = useState(0);
  const [opening, setOpening] = useState(false);
  const pub = toPublicLetter(l, vars);
  const stickers: any[] = l.stickers ?? [];
  const images: any[] = l.images ?? [];
  const setSticker = (i: number, patch: any) => set({ stickers: stickers.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  const custom = content.sections.theme.customFonts ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Birthday Letter 💌</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Section title="ซองจดหมาย">
            <Row>
              <Text label="หัวข้อ" value={l.envelopeTitle} onChange={(v) => set({ envelopeTitle: v })} />
              <Text label="ข้อความรอง" value={l.envelopeSubtitle} onChange={(v) => set({ envelopeSubtitle: v })} />
              <Text label="ปุ่มเปิดจดหมาย" value={l.openButton} onChange={(v) => set({ openButton: v })} />
              <Select label="เอฟเฟกต์เปิดซอง" value={l.openEffect} onChange={(v) => set({ openEffect: v })}
                options={[['flap', 'ฝาซองพับเปิด + กระดาษเลื่อนออก'], ['fade', 'ซองจางหาย'], ['zoom', 'ซูมกระดาษขึ้นมา'], ['none', 'ไม่มีเอฟเฟกต์']]} />
              <Color label="สีซองจดหมาย" value={l.envelopeColor} onChange={(v) => set({ envelopeColor: v })} />
            </Row>
          </Section>
          <Section title="เนื้อหาจดหมาย" desc={<>รองรับ Emoji และจัดรูปแบบ: <code>**ตัวหนา**</code> <code>*เอียง*</code> <code>__ขีดเส้นใต้__</code> <code>==ไฮไลต์==</code> <code>[color=#ff82ab]สี[/color]</code> <code>[big]ใหญ่[/big]</code></>}>
            <Text label="หัวจดหมาย" value={l.header} onChange={(v) => set({ header: v })} />
            <Area label="เนื้อหา" value={l.body} onChange={(v) => set({ body: v })} rows={12} hint="เว้นบรรทัดว่างเพื่อขึ้นย่อหน้าใหม่" />
            <Text label="คำลงท้าย" value={l.closing} onChange={(v) => set({ closing: v })} />
            <Text label="ปุ่มไปเกมทาย" value={l.nextButton} onChange={(v) => set({ nextButton: v })} />
          </Section>
          <Section title="หน้าตาจดหมาย">
            <Row>
              <FontSelect label="ฟอนต์จดหมาย" value={l.font} onChange={(v) => set({ font: v })} custom={custom} allowDefault="ใช้ฟอนต์จดหมายจากธีม" />
              <Num label="ความเร็ว Typewriter (มิลลิวินาที/ตัวอักษร)" hint="0 = แสดงทันที" value={l.typewriterSpeed} min={0} max={200} onChange={(v) => set({ typewriterSpeed: v })} />
              <Color label="สีกระดาษ" value={l.paperColor} onChange={(v) => set({ paperColor: v })} />
              <MediaInput label="รูปพื้นหลังจดหมาย" value={l.backgroundImageId} onChange={(id) => set({ backgroundImageId: id })} />
            </Row>
          </Section>
          <Section title="สติกเกอร์ในจดหมาย" desc="ใช้ Emoji หรืออัปโหลดรูปสติกเกอร์ (PNG พื้นใส) ตำแหน่งเป็น % ของกระดาษ">
            {stickers.map((s, i) => (
              <div key={s.id ?? i} className="grid grid-cols-2 items-end gap-2 rounded-xl border border-zinc-200 p-3 sm:grid-cols-6">
                <Text label="Emoji" value={s.emoji} onChange={(v) => setSticker(i, { emoji: v })} />
                <Num label="X %" value={s.x} min={0} max={100} onChange={(v) => setSticker(i, { x: v })} />
                <Num label="Y %" value={s.y} min={0} max={100} onChange={(v) => setSticker(i, { y: v })} />
                <Num label="ขนาด" value={s.size} min={12} max={120} onChange={(v) => setSticker(i, { size: v })} />
                <Num label="เอียง°" value={s.rotate} min={-180} max={180} onChange={(v) => setSticker(i, { rotate: v })} />
                <Btn kind="danger" onClick={() => set({ stickers: stickers.filter((_, k) => k !== i) })}>ลบ</Btn>
                <div className="col-span-2 sm:col-span-6"><MediaInput label="หรือใช้รูปสติกเกอร์" value={s.mediaId} onChange={(id) => setSticker(i, { mediaId: id })} /></div>
              </div>
            ))}
            <Btn onClick={() => set({ stickers: [...stickers, { id: `s${Date.now()}`, emoji: '💗', mediaId: null, x: 50, y: 50, size: 32, rotate: 0 }] })}>＋ เพิ่มสติกเกอร์</Btn>
          </Section>
          <Section title="รูปภาพในจดหมาย" desc="แสดงต่อท้ายเนื้อหาจดหมายแบบโพลารอยด์">
            {images.map((img, i) => (
              <div key={i} className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 p-3">
                <MediaInput label={`รูปที่ ${i + 1}`} value={img.mediaId} onChange={(id) => set({ images: images.map((x, k) => (k === i ? { ...x, mediaId: id } : x)) })} />
                <div className="min-w-[200px] flex-1"><Text label="คำบรรยาย" value={img.caption} onChange={(v) => set({ images: images.map((x, k) => (k === i ? { ...x, caption: v } : x)) })} /></div>
                <Btn kind="danger" onClick={() => set({ images: images.filter((_, k) => k !== i) })}>ลบ</Btn>
              </div>
            ))}
            <Btn onClick={() => set({ images: [...images, { mediaId: null, caption: '' }] })}>＋ เพิ่มรูป</Btn>
          </Section>
        </div>
        <PreviewBox title="Preview จดหมาย">
          <div className="space-y-6 py-2">
            <div className="text-center">
              <p className="font-heading text-2xl text-primary">{l.envelopeTitle}</p>
              <p className="mb-6 mt-1 text-ink/70">{l.envelopeSubtitle}</p>
              <div className="origin-top scale-90"><Envelope color={l.envelopeColor} opening={opening} effect={l.openEffect} /></div>
              <div className="mt-2 flex justify-center gap-2">
                <Btn onClick={() => setOpening(!opening)}>{opening ? 'ปิดซอง' : 'ลองเปิดซอง'}</Btn>
                <Btn onClick={() => setReplay((r) => r + 1)}>▶ เล่น Typewriter</Btn>
              </div>
            </div>
            <LetterPaper key={replay} letter={pub} typing={replay > 0} />
          </div>
        </PreviewBox>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={reset} />
    </div>
  );
}
