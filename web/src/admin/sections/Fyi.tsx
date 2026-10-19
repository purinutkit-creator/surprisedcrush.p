import { useState } from 'react';
import { UNIT_LABELS, UNITS } from '../../lib/timer';
import { FyiCard, TipsModal } from '../../visitor/components/Tips';
import { Area, Badge, Btn, Color, MediaInput, Num, Row, SaveBar, Section, Select, Text, Toggle } from '../components/form';
import { FontSelect } from '../components/FontSelect';
import { PreviewBox, Themed, toPublicFyi } from '../components/Preview';
import { newKey, SortableList } from '../components/Sortable';
import { pageLabel } from '../events';
import { useAdmin, useList, useSection } from '../store';

const TIMEZONES = ['Asia/Bangkok', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Singapore', 'Asia/Hong_Kong', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney', 'UTC'];
const blankTimer = () => ({
  mode: 'live', start: '', end: '', timezone: 'Asia/Bangkok',
  units: { years: true, months: true, days: true, hours: true, minutes: true, seconds: true },
  custom: { years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 },
  runDuration: 4, startSpeed: 'fast', sound: false, confetti: true, afterText: 'นานขนาดนี้แล้วนะ ที่มีเธออยู่ในใจ 💗', reachedText: 'ถึงเวลาแล้ว! 🎉', animateEveryOpen: true,
  appearance: { numberColor: '', bgColor: '', borderColor: '', font: '', size: 'lg', cardStyle: 'glass', preset: 'rolling', radius: 24, glow: true, background: '', bgImageId: null },
});

function TimerEditor({ t, onChange, custom }: { t: any; onChange: (t: any) => void; custom: any[] }) {
  const set = (p: any) => onChange({ ...t, ...p });
  const ap = t.appearance ?? {};
  const setAp = (p: any) => set({ appearance: { ...ap, ...p } });
  return (
    <div className="space-y-4 rounded-xl bg-pink-50/40 p-3">
      <p className="text-sm font-semibold text-pink-700">⏱ Animated Love Timer</p>
      <Row>
        <Select label="โหมด" value={t.mode} onChange={(v) => set({ mode: v })} options={[
          ['exact', 'Count to Exact Time (วิ่งแล้วหยุด)'], ['live', 'Live Counting Forever (นับต่อทุกวินาที)'],
          ['custom', 'Custom Duration (กำหนดเอง)'], ['countdown', 'Countdown (นับถอยหลัง)'],
        ]} />
        <Select label="Timezone" value={t.timezone} onChange={(v) => set({ timezone: v })} options={TIMEZONES.map((z) => [z, z])} />
      </Row>
      {(t.mode === 'exact' || t.mode === 'live') && (
        <Row>
          <Text type="datetime-local" label="วันและเวลาเริ่มต้น (เริ่มชอบ)" value={t.start} onChange={(v) => set({ start: v })} />
          <Text type="datetime-local" label="วันและเวลาสิ้นสุด (ถ้ามี)" hint="เว้นว่าง = นับถึงตอนที่เปิดดู" value={t.end} onChange={(v) => set({ end: v })} />
        </Row>
      )}
      {t.mode === 'countdown' && <Text type="datetime-local" label="วันที่เป้าหมาย" value={t.end} onChange={(v) => set({ end: v })} />}
      {t.mode === 'custom' && (
        <Row cols={3}>
          {UNITS.map((u) => <Num key={u} label={UNIT_LABELS[u].en} value={t.custom?.[u] ?? 0} min={0} onChange={(v) => set({ custom: { ...t.custom, [u]: v } })} />)}
        </Row>
      )}
      <div>
        <p className="mb-1 text-sm font-medium text-zinc-700">หน่วยที่แสดง</p>
        <div className="flex flex-wrap gap-2">
          {UNITS.map((u) => (
            <label key={u} className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${t.units?.[u] ? 'border-pink-400 bg-pink-100 text-pink-700' : 'border-zinc-300 text-zinc-500'}`}>
              <input type="checkbox" className="hidden" checked={!!t.units?.[u]} onChange={(e) => set({ units: { ...t.units, [u]: e.target.checked } })} />
              {UNIT_LABELS[u].en}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-zinc-500">คำนวณตามปฏิทินจริง · ถ้าซ่อนหน่วยใหญ่ เวลาจะถูกรวมเข้าหน่วยถัดไป (เช่น ซ่อนปี → แสดงเป็นเดือนรวม)</p>
      </div>
      <Row cols={3}>
        <Num label="ระยะเวลาวิ่งถึงค่าจริง (วินาที)" value={t.runDuration} min={1} max={8} onChange={(v) => set({ runDuration: v })} />
        <Select label="ความเร็ว Animation เริ่มต้น" value={t.startSpeed} onChange={(v) => set({ startSpeed: v })} options={[['fast', 'เร็วแล้วค่อย ๆ ช้าลง'], ['normal', 'ปกติ'], ['slow', 'นุ่มนวล']]} />
        <Select label="เล่น Animation" value={t.animateEveryOpen ? 'every' : 'first'} onChange={(v) => set({ animateEveryOpen: v === 'every' })} options={[['every', 'ทุกครั้งที่เปิดการ์ด'], ['first', 'เฉพาะครั้งแรก']]} />
      </Row>
      <Row>
        <Toggle label="เสียงขณะตัวเลขวิ่ง" checked={t.sound} onChange={(v) => set({ sound: v })} />
        <Toggle label="Confetti เมื่อถึงเป้าหมาย" checked={t.confetti} onChange={(v) => set({ confetti: v })} />
        <Text label="ข้อความหลัง Animation จบ" value={t.afterText} onChange={(v) => set({ afterText: v })} />
        <Text label="ข้อความเมื่อนับถอยหลังถึงเวลา" value={t.reachedText} onChange={(v) => set({ reachedText: v })} />
      </Row>
      <p className="pt-2 text-sm font-semibold text-zinc-700">หน้าตาตัวนับ</p>
      <Row cols={3}>
        <Color label="สีตัวเลข" value={ap.numberColor} onChange={(v) => setAp({ numberColor: v })} />
        <Color label="สีพื้นหลัง" value={ap.bgColor} onChange={(v) => setAp({ bgColor: v })} />
        <Color label="สีกรอบ" value={ap.borderColor} onChange={(v) => setAp({ borderColor: v })} />
        <FontSelect label="ฟอนต์ตัวเลข" value={ap.font} onChange={(v) => setAp({ font: v })} custom={custom} allowDefault="ใช้ฟอนต์ตัวเลขจากธีม" />
        <Select label="ขนาดตัวเลข" value={ap.size} onChange={(v) => setAp({ size: v })} options={[['md', 'กลาง'], ['lg', 'ใหญ่'], ['xl', 'ใหญ่มาก']]} />
        <Select label="รูปแบบการ์ด" value={ap.cardStyle} onChange={(v) => setAp({ cardStyle: v })} options={[['glass', 'Glass'], ['solid', 'Solid'], ['outline', 'Outline'], ['neon', 'Neon Night']]} />
        <Select label="Animation Preset" value={ap.preset} onChange={(v) => setAp({ preset: v })} options={[['rolling', 'Rolling Number'], ['slot', 'Slot Machine'], ['flip', 'Number Flip'], ['glow', 'Soft Glow']]} />
        <Num label="ความโค้งมุม (px)" value={ap.radius} min={0} max={48} onChange={(v) => setAp({ radius: v })} />
        <Toggle label="เงาและแสง Glow" checked={ap.glow !== false} onChange={(v) => setAp({ glow: v })} />
      </Row>
      <Row>
        <Text label="Gradient พื้นหลัง (CSS)" placeholder="linear-gradient(135deg, #FFD6E7, #E9D5FF)" value={ap.background} onChange={(v) => setAp({ background: v })} />
        <MediaInput label="หรือรูปพื้นหลัง" value={ap.bgImageId} onChange={(id) => setAp({ bgImageId: id })} />
      </Row>
    </div>
  );
}

export default function Fyi() {
  const { content } = useAdmin();
  const f = useSection<any>('fyi');
  const items = useList<any>('fyiItems');
  const [open, setOpen] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [replay, setReplay] = useState(0);
  const dirty = f.dirty || items.dirty;
  const saving = f.saving || items.saving;
  const save = async () => { if (f.dirty) await f.save(); if (items.dirty) await items.save(); };
  const v = f.value;
  const custom = (content.sections.theme.customFonts ?? []).map((x: any) => ({ family: x.family }));
  const sel = items.items.find((i) => i._key === open);
  const published = items.items.filter((i) => i.published).map((i) => toPublicFyi({ ...i, id: i._key }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">FYI & Love Timer 💡</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <Section title="ปุ่ม TIPS และหน้าต่าง FYI">
            <Toggle label="เปิดระบบ TIPS / FYI" checked={v.enabled} onChange={(x) => f.set({ enabled: x })} />
            <Row>
              <Text label="ข้อความปุ่ม" value={v.buttonLabel} onChange={(x) => f.set({ buttonLabel: x })} />
              <Select label="รูปแบบการแสดง" value={v.display} onChange={(x) => f.set({ display: x })} options={[['carousel', 'Carousel (เลื่อนทีละข้อ)'], ['list', 'Vertical List'], ['stories', 'Story Cards']]} />
              <Text label="หัวข้อ" value={v.title} onChange={(x) => f.set({ title: x })} />
              <Text label="ข้อความรอง" value={v.subtitle} onChange={(x) => f.set({ subtitle: x })} />
            </Row>
            <div>
              <p className="mb-1 text-sm font-medium text-zinc-700">แสดงปุ่ม TIPS ในหน้า</p>
              <div className="flex flex-wrap gap-2">
                {Object.keys(v.pages).map((p) => (
                  <label key={p} className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${v.pages[p] ? 'border-pink-400 bg-pink-100 text-pink-700' : 'border-zinc-300 text-zinc-500'}`}>
                    <input type="checkbox" className="hidden" checked={!!v.pages[p]} onChange={(e) => f.set({ pages: { ...v.pages, [p]: e.target.checked } })} />
                    {pageLabel(p)}
                  </label>
                ))}
              </div>
            </div>
          </Section>
          <Section title="รายการ FYI" desc="เพิ่มได้ไม่จำกัด · ลากเพื่อเรียงลำดับ · แต่ละข้อมีข้อความ รูป และ Timer พร้อมกันได้ (ประเภท Mixed)">
            <SortableList items={items.items} onChange={items.setItems} render={(it, i, handle) => (
              <div className={`flex items-center gap-2 rounded-xl border bg-white p-2.5 ${open === it._key ? 'border-pink-400' : 'border-zinc-200'}`}>
                {handle}
                <span className="font-mono text-xs text-zinc-400">{String(i + 1).padStart(2, '0')}</span>
                <button className="flex-1 truncate text-left text-sm font-medium" onClick={() => setOpen(open === it._key ? null : it._key)}>{it.title || it.heading || it.text?.slice(0, 40) || '(ว่าง)'}</button>
                <Badge color={it.kind === 'timer' ? 'pink' : it.kind === 'image' ? 'blue' : it.kind === 'mixed' ? 'violet' : 'zinc'}>{it.kind}</Badge>
                <button onClick={() => items.update(it._key, { published: !it.published })}>{it.published ? <Badge color="green">Published</Badge> : <Badge>Unpublished</Badge>}</button>
              </div>
            )} />
            <Btn onClick={() => {
              const key = newKey();
              items.setItems([...items.items, {
                _key: key, title: `FYI #${String(items.items.length + 1).padStart(2, '0')}`, kind: 'text', heading: '', description: '', text: '', textColor: '', textSize: 'md', font: '',
                typewriter: false, typewriterSpeed: 40, lineByLine: false, imageId: null, caption: '', polaroid: true, imageAnimation: 'fade', bgImageId: null, sticker: '', published: true, timer: blankTimer(),
              }]);
              setOpen(key);
            }}>＋ เพิ่ม FYI</Btn>
          </Section>
          {sel && (
            <Section title={`แก้ไข: ${sel.title || 'FYI'}`} actions={<div className="flex gap-2"><Btn kind="danger" onClick={() => { items.remove(sel._key); setOpen(null); }}>ลบ</Btn><Btn kind="ghost" onClick={() => setOpen(null)}>ปิด</Btn></div>}>
              <Row>
                <Text label="ชื่อรายการ (เห็นเฉพาะแอดมิน)" value={sel.title} onChange={(x) => items.update(sel._key, { title: x })} />
                <Select label="ประเภท" value={sel.kind} onChange={(x) => items.update(sel._key, { kind: x })} options={[['text', 'Text'], ['image', 'Image'], ['timer', 'Timer'], ['mixed', 'Mixed (ข้อความ + รูป + Timer)']]} />
                <Text label="หัวข้อหลัก" value={sel.heading} onChange={(x) => items.update(sel._key, { heading: x })} />
                <Text label="คำอธิบาย" value={sel.description} onChange={(x) => items.update(sel._key, { description: x })} />
              </Row>
              <Area label="ข้อความ" hint="รองรับ Emoji และ **ตัวหนา** *เอียง* ==ไฮไลต์== [color=#hex]สี[/color]" value={sel.text} onChange={(x) => items.update(sel._key, { text: x })} rows={4} />
              <Row cols={3}>
                <Color label="สีข้อความ" value={sel.textColor} onChange={(x) => items.update(sel._key, { textColor: x })} />
                <Select label="ขนาดข้อความ" value={sel.textSize} onChange={(x) => items.update(sel._key, { textSize: x })} options={[['sm', 'เล็ก'], ['md', 'กลาง'], ['lg', 'ใหญ่'], ['xl', 'ใหญ่มาก']]} />
                <FontSelect label="ฟอนต์" value={sel.font} onChange={(x) => items.update(sel._key, { font: x })} custom={custom} allowDefault="ใช้ฟอนต์เนื้อหา" />
                <Toggle label="Typewriter" checked={sel.typewriter} onChange={(x) => items.update(sel._key, { typewriter: x })} />
                <Num label="ความเร็ว (ms/ตัว)" value={sel.typewriterSpeed} min={0} max={300} onChange={(x) => items.update(sel._key, { typewriterSpeed: x })} />
                <Toggle label="แสดงทีละบรรทัด" checked={sel.lineByLine} onChange={(x) => items.update(sel._key, { lineByLine: x })} />
              </Row>
              {(sel.kind === 'image' || sel.kind === 'mixed') && (
                <Row>
                  <MediaInput label="รูปภาพ (JPG, PNG, WEBP)" value={sel.imageId} onChange={(id) => items.update(sel._key, { imageId: id })} />
                  <Text label="คำบรรยายใต้ภาพ" value={sel.caption} onChange={(x) => items.update(sel._key, { caption: x })} />
                  <Select label="Animation รูป" value={sel.imageAnimation} onChange={(x) => items.update(sel._key, { imageAnimation: x })} options={[['fade', 'Fade'], ['zoom', 'Zoom'], ['float', 'Float'], ['rotate', 'Rotate']]} />
                  <Toggle label="กรอบ Polaroid" checked={sel.polaroid} onChange={(x) => items.update(sel._key, { polaroid: x })} />
                </Row>
              )}
              <Row>
                <MediaInput label="รูปพื้นหลังการ์ด" value={sel.bgImageId} onChange={(id) => items.update(sel._key, { bgImageId: id })} />
                <Text label="สติกเกอร์ตกแต่ง (Emoji)" value={sel.sticker} onChange={(x) => items.update(sel._key, { sticker: x })} />
              </Row>
              {(sel.kind === 'timer' || sel.kind === 'mixed') && <TimerEditor t={sel.timer} onChange={(t) => items.update(sel._key, { timer: t })} custom={custom} />}
              <Toggle label="Publish รายการนี้" checked={sel.published} onChange={(x) => items.update(sel._key, { published: x })} />
            </Section>
          )}
        </div>
        <PreviewBox title="Preview การ์ด FYI">
          <div className="mb-3 flex justify-end gap-2">
            <Btn onClick={() => setReplay((r) => r + 1)}>↻ Replay</Btn>
            <Btn kind="primary" onClick={() => setModal(true)}>เปิดหน้าต่าง TIPS</Btn>
          </div>
          {sel ? <FyiCard item={toPublicFyi({ ...sel, id: sel._key })} index={items.items.indexOf(sel)} total={items.items.length} replayKey={replay} onZoom={() => {}} />
            : <p className="text-center text-sm text-ink/60">เลือกรายการเพื่อดูตัวอย่าง</p>}
        </PreviewBox>
      </div>
      {modal && <Themed className="!fixed !inset-0 !z-[90] !rounded-none !border-0 !bg-transparent"><TipsModal fyi={{ ...v, items: published }} open={modal} onClose={() => setModal(false)} /></Themed>}
      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => { f.reset(); items.reset(); }} />
    </div>
  );
}
