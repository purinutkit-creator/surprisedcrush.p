import { useState } from 'react';
import { mediaUrl } from '../../lib/api';
import { fill } from '../../lib/text';
import { ConfessionView } from '../../visitor/pages/Confession';
import { Btn, MediaInput, Num, Row, SaveBar, Section, Select, StringList, Text, Toggle } from '../components/form';
import { PreviewBox, useVars } from '../components/Preview';
import { useAdmin, useSection } from '../store';

export default function Confession() {
  const { content } = useAdmin();
  const web = useSection<any>('website');
  const c = useSection<any>('confession');
  const music = useSection<any>('music');
  const vars = useVars();
  const [round, setRound] = useState(0);
  const v = c.value;
  const dirty = web.dirty || c.dirty || music.dirty;
  const saving = web.saving || c.saving || music.saving;
  const save = async () => { if (web.dirty) await web.save(); if (c.dirty) await c.save(); if (music.dirty) await music.save(); };
  const images: string[] = v.imageIds ?? [];
  const preview = {
    ...v, title: fill(v.title, vars), lines: (v.confess ? v.lines : v.altLines).map((l: string) => fill(l, vars)),
    endText: fill(v.endText, vars), images: images.map((id) => mediaUrl(id)).filter(Boolean),
  };
  const tracks: [string, string][] = [['', 'ใช้เพลงหลักของเว็บ'], ['none', 'ไม่มีเพลง'], ...content.lists.tracks.map((t: any) => [t.id, t.title || 'ไม่มีชื่อ'] as [string, string])];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Confession Page 💖 <span className="text-base font-normal text-zinc-400">/yourmybestcrushever</span></h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Section title="การเข้าถึงหน้านี้" desc="ตรวจที่ Server — พิมพ์ URL ตรง ๆ ก็เข้าไม่ได้ถ้ายังไม่ผ่านเงื่อนไข">
            <Toggle label="เปิดหน้านี้" checked={web.value.pages.confession} onChange={(on) => web.set({ pages: { ...web.value.pages, confession: on } })} />
            <Toggle label="ต้องส่งข้อความก่อนถึงจะเข้าได้" checked={v.requireMessage} onChange={(x) => c.set({ requireMessage: x })} />
            <Toggle label="ต้องเปิดแกลเลอรีก่อนถึงจะเข้าได้" checked={v.requireGallery} onChange={(x) => c.set({ requireGallery: x })} />
            <Row>
              <Text label="หัวข้อเมื่อยังเข้าไม่ได้" value={v.lockedTitle} onChange={(x) => c.set({ lockedTitle: x })} />
              <Text label="ข้อความเมื่อยังเข้าไม่ได้" value={v.lockedText} onChange={(x) => c.set({ lockedText: x })} />
            </Row>
          </Section>
          <Section title="ข้อความบอกความรู้สึก" desc="บรรทัดที่ขึ้นต้นด้วย “# ” จะแสดงเป็นตัวใหญ่พร้อม Confetti">
            <Toggle label="สารภาพความรู้สึก" hint="ถ้าปิด จะใช้ข้อความชุดสำรอง (ไม่สารภาพ) แทน" checked={v.confess} onChange={(x) => c.set({ confess: x })} />
            <Text label="หัวข้อ" value={v.title} onChange={(x) => c.set({ title: x })} />
            {v.confess
              ? <StringList label="ข้อความ (แสดงทีละบรรทัด)" value={v.lines} onChange={(x) => c.set({ lines: x })} multiline />
              : <StringList label="ข้อความชุดสำรอง" value={v.altLines} onChange={(x) => c.set({ altLines: x })} multiline />}
            <Row>
              <Num label="เวลาหน่วงก่อนบรรทัดถัดไป (ms)" value={v.lineDelay} min={0} max={10000} step={100} onChange={(x) => c.set({ lineDelay: x })} />
              <Num label="ความเร็ว Typewriter (ms/ตัว)" value={v.typewriterSpeed} min={0} max={300} onChange={(x) => c.set({ typewriterSpeed: x })} />
              <Text label="ข้อความตอนจบ" value={v.endText} onChange={(x) => c.set({ endText: x })} />
              <Text label="ปุ่มกลับไปดูของขวัญ" value={v.backButton} onChange={(x) => c.set({ backButton: x })} />
            </Row>
            <Toggle label="แสดงปุ่มอ่านข้อความอีกครั้ง" checked={v.showReplayButton} onChange={(x) => c.set({ showReplayButton: x })} />
            {v.showReplayButton && <Text label="ข้อความปุ่ม" value={v.replayButton} onChange={(x) => c.set({ replayButton: x })} />}
          </Section>
          <Section title="Animation, เพลง และรูปภาพ">
            <Row>
              <Select label="Animation พื้นหลัง" value={v.animation} onChange={(x) => c.set({ animation: x })} options={[['hearts', 'หัวใจลอย'], ['flowers', 'ดอกไม้ร่วง'], ['stars', 'ดวงดาว']]} />
              <Select label="เพลงเฉพาะหน้านี้" value={music.value.pageTracks.confession ?? ''} onChange={(x) => music.set({ pageTracks: { ...music.value.pageTracks, confession: x } })} options={tracks} />
            </Row>
            <Toggle label="Confetti" checked={v.confetti} onChange={(x) => c.set({ confetti: x })} />
            {images.map((id, i) => (
              <div key={i} className="flex items-end gap-2">
                <MediaInput label={`รูปที่ ${i + 1}`} value={id} onChange={(nid) => c.set({ imageIds: nid ? images.map((x, k) => (k === i ? nid : x)) : images.filter((_, k) => k !== i) })} />
              </div>
            ))}
            <MediaInput label="เพิ่มรูป" value={null} onChange={(id) => id && c.set({ imageIds: [...images, id] })} />
          </Section>
        </div>
        <PreviewBox title="Preview หน้าบอกความรู้สึก">
          <div className="mb-2 flex justify-end"><Btn onClick={() => setRound((r) => r + 1)}>▶ เล่นใหม่</Btn></div>
          <div className="relative min-h-[600px] overflow-hidden">
            <ConfessionView key={round} data={preview} onBack={() => {}} />
          </div>
        </PreviewBox>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => { web.reset(); c.reset(); music.reset(); }} />
    </div>
  );
}
