import { useState } from 'react';
import { mediaUrl } from '../../lib/api';
import { PRESET_NAMES, THEME_PRESETS } from '../../lib/presets';
import { Background } from '../../visitor/components/Background';
import { Btn, Color, MediaInput, Num, Row, SaveBar, Section, Select, Text, Toggle } from '../components/form';
import { FontSelect } from '../components/FontSelect';
import { Themed } from '../components/Preview';
import { useSection } from '../store';

const COLOR_LABELS: [string, string][] = [
  ['primary', 'Primary'], ['secondary', 'Secondary'], ['accent', 'Accent'], ['background', 'Background'], ['text', 'Text'],
  ['button', 'Button'], ['buttonText', 'Button Text'], ['card', 'Card'], ['border', 'Border'],
  ['gradientFrom', 'Gradient 1'], ['gradientVia', 'Gradient 2'], ['gradientTo', 'Gradient 3'],
];
const FONT_SLOTS: [string, string][] = [
  ['heading', 'ฟอนต์หัวข้อ'], ['body', 'ฟอนต์เนื้อหา'], ['button', 'ฟอนต์ปุ่ม'], ['letter', 'ฟอนต์จดหมาย'], ['confession', 'ฟอนต์หน้าสารภาพ'], ['number', 'ฟอนต์ตัวเลข (Timer)'],
];

export default function Appearance() {
  const { value: t, set, save, saving, dirty, reset } = useSection<any>('theme');
  const [newFont, setNewFont] = useState<{ family: string; mediaId: string | null }>({ family: '', mediaId: null });
  const custom = (t.customFonts ?? []).map((f: any) => ({ family: f.family, url: mediaUrl(f.mediaId) }));
  const setColor = (k: string, v: string) => set({ colors: { ...t.colors, [k]: v }, preset: 'custom' });
  const setFont = (k: string, v: string) => set({ fonts: { ...t.fonts, [k]: v } });
  const anim = t.animations ?? {};

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Appearance Settings 🎨</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Section title="ธีมสำเร็จรูป">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries(THEME_PRESETS).map(([k, c]) => (
                <button key={k} onClick={() => set({ preset: k, colors: { ...c } })}
                  className={`rounded-xl border p-3 text-left text-sm transition ${t.preset === k ? 'border-pink-500 ring-2 ring-pink-200' : 'border-zinc-200 hover:border-pink-300'}`}>
                  <div className="mb-2 flex gap-1">{['primary', 'secondary', 'accent', 'background'].map((x) => <span key={x} className="h-5 w-5 rounded-full border" style={{ background: c[x] }} />)}</div>
                  {PRESET_NAMES[k]}
                </button>
              ))}
              <div className={`rounded-xl border p-3 text-sm ${t.preset === 'custom' ? 'border-pink-500 ring-2 ring-pink-200' : 'border-dashed border-zinc-300 text-zinc-500'}`}>
                🎨 {PRESET_NAMES.custom}<br /><span className="text-xs">แก้สีด้านล่างเพื่อสร้างธีมเอง</span>
              </div>
            </div>
          </Section>
          <Section title="สีของธีม">
            <Row cols={3}>{COLOR_LABELS.map(([k, l]) => <Color key={k} label={l} value={t.colors[k]} onChange={(v) => setColor(k, v)} />)}</Row>
          </Section>
          <Section title="ฟอนต์" desc="รองรับ Google Fonts (ค้นหาได้) และอัปโหลดฟอนต์เอง · ฟอนต์ที่มี 🇹🇭 รองรับภาษาไทยครบ">
            <Row>
              {FONT_SLOTS.map(([k, l]) => (
                <div key={k} className="flex items-end gap-1.5">
                  <div className="flex-1"><FontSelect label={l} value={t.fonts[k]} onChange={(v) => setFont(k, v)} custom={custom} /></div>
                  <Btn kind="ghost" title="ใช้ฟอนต์นี้ทุกส่วน" onClick={() => set({ fonts: Object.fromEntries(FONT_SLOTS.map(([s]) => [s, t.fonts[k]])) })}>Apply to All</Btn>
                </div>
              ))}
            </Row>
            <div className="rounded-xl border border-zinc-200 p-3">
              <p className="mb-2 text-sm font-medium">อัปโหลดฟอนต์ของตัวเอง (TTF, OTF, WOFF, WOFF2)</p>
              <div className="flex flex-wrap items-end gap-3">
                <Text label="ชื่อฟอนต์" value={newFont.family} onChange={(v) => setNewFont({ ...newFont, family: v })} placeholder="เช่น MyCuteFont" />
                <MediaInput label="ไฟล์ฟอนต์" kind="font" value={newFont.mediaId} onChange={(id) => setNewFont({ ...newFont, mediaId: id })} />
                <Btn kind="primary" disabled={!newFont.family.trim() || !newFont.mediaId}
                  onClick={() => { set({ customFonts: [...(t.customFonts ?? []), { family: newFont.family.trim(), mediaId: newFont.mediaId }] }); setNewFont({ family: '', mediaId: null }); }}>
                  ＋ เพิ่มฟอนต์
                </Btn>
              </div>
              {(t.customFonts ?? []).map((f: any, i: number) => (
                <div key={i} className="mt-2 flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm">
                  <span>{f.family}</span>
                  <Btn kind="danger" onClick={() => set({ customFonts: t.customFonts.filter((_: any, k: number) => k !== i) })}>ลบ</Btn>
                </div>
              ))}
            </div>
          </Section>
          <Section title="ปุ่ม การ์ด และพื้นหลัง">
            <Row cols={3}>
              <Num label="ความโค้งของมุม (px)" value={t.radius} min={0} max={48} onChange={(v) => set({ radius: v })} />
              <Select label="สไตล์การ์ด" value={t.cardStyle} onChange={(v) => set({ cardStyle: v })} options={[['glass', 'กระจกฝ้า (Glass)'], ['solid', 'ทึบ'], ['outline', 'เส้นขอบ']]} />
              <Select label="ทรงปุ่ม" value={t.buttonStyle} onChange={(v) => set({ buttonStyle: v })} options={[['pill', 'แคปซูล'], ['rounded', 'มุมมน'], ['square', 'เหลี่ยม']]} />
              <Select label="พื้นหลัง" value={t.background?.type ?? 'gradient'} onChange={(v) => set({ background: { ...t.background, type: v } })} options={[['gradient', 'ไล่สีพาสเทล'], ['image', 'รูปภาพ']]} />
            </Row>
            {t.background?.type === 'image' && <MediaInput label="รูปพื้นหลัง" value={t.background?.imageId} onChange={(id) => set({ background: { ...t.background, imageId: id } })} />}
          </Section>
          <Section title="Animation & Transition" desc="ผู้ที่ตั้งค่าลดการเคลื่อนไหว (Reduced Motion) ในเครื่องจะเห็นแบบเรียบ ๆ อัตโนมัติ">
            <Row>
              <Toggle label="หัวใจลอย" checked={anim.floatingHearts} onChange={(v) => set({ animations: { ...anim, floatingHearts: v } })} />
              <Toggle label="ดาวระยิบ" checked={anim.stars} onChange={(v) => set({ animations: { ...anim, stars: v } })} />
              <Toggle label="Sparkle ✨" checked={anim.sparkles} onChange={(v) => set({ animations: { ...anim, sparkles: v } })} />
              <Toggle label="แสงฟุ้งพื้นหลัง" checked={anim.particles} onChange={(v) => set({ animations: { ...anim, particles: v } })} />
            </Row>
            <Row>
              <Select label="ปริมาณ Animation" value={anim.intensity} onChange={(v) => set({ animations: { ...anim, intensity: v } })} options={[['normal', 'ปกติ'], ['low', 'น้อย (ประหยัดเครื่อง)']]} />
              <Select label="การเปลี่ยนหน้า" value={t.transition} onChange={(v) => set({ transition: v })} options={[['fadeSlide', 'Fade + Slide'], ['fade', 'Fade'], ['zoom', 'Zoom'], ['slideUp', 'Slide Up']]} />
            </Row>
          </Section>
        </div>
        <div className="lg:sticky lg:top-20 lg:self-start">
          <p className="mb-2 text-sm font-semibold text-zinc-600">👀 Preview ก่อนบันทึก</p>
          <Themed theme={t} className="isolate p-6">
            <div className="pointer-events-none absolute inset-0 -z-0 [&>div]:!absolute"><Background hearts={anim.floatingHearts} stars={anim.stars} sparkles={anim.sparkles} particles={anim.particles} intensity={anim.intensity} /></div>
            <div className="relative space-y-4 text-center">
              <p className="font-heading text-2xl text-primary">Happy Birthday น้างับ 🎂💗</p>
              <p className="text-ink/80">มีของขวัญเล็ก ๆ จากใครบางคนมาให้ด้วยน้าา</p>
              <div className="gift-card p-4" data-style={t.cardStyle}>
                <p className="font-letter text-lg">To: น้องคนพิเศษ 💕</p>
                <p className="mt-1 text-sm">ฟอนต์จดหมาย · 0123456789</p>
                <input className="gift-input mt-3 text-center" placeholder="พิมพ์ชื่อ…" readOnly />
              </div>
              <button className="gift-btn">ยืนยันวันเกิดของเค้า 💌</button>
              <div><button className="gift-btn-ghost">ปุ่มรอง</button></div>
              <p className="font-confession text-xl text-primary">I Have a Crush on You 💗</p>
              <p className="font-number text-3xl text-primary">01 : 08 : 12</p>
            </div>
          </Themed>
        </div>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={reset} />
    </div>
  );
}
