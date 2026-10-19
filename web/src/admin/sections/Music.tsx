import { useRef, useState } from 'react';
import { adminApi, mediaUrl } from '../../lib/api';
import { Badge, Btn, Empty, inputCls, Num, Row, SaveBar, Section, Select, Toggle } from '../components/form';
import { newKey, SortableList } from '../components/Sortable';
import { pageLabel } from '../events';
import { useAdmin, useList, useSection } from '../store';

const PAGES = ['welcome', 'letter', 'game', 'exchange', 'correct', 'message', 'gallery', 'confession'];

export default function Music() {
  const { toast } = useAdmin();
  const m = useSection<any>('music');
  const tracks = useList<any>('tracks');
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const dirty = m.dirty || tracks.dirty;
  const saving = m.saving || tracks.saving;
  // New tracks need an id before they can be picked as main/page track, so save the list first.
  const save = async () => { if (tracks.dirty) await tracks.save(); if (m.dirty) await m.save(); };
  const v = m.value;

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const res = await adminApi.upload(files);
      res.errors.forEach((e) => toast(`${e.filename}: ${e.error}`, 'error'));
      const added = res.files.filter((f) => f.kind === 'audio').map((f) => ({ _key: newKey(), title: f.filename.replace(/\.[^.]+$/, ''), source: 'upload', mediaId: f.id, url: '' }));
      tracks.setItems([...tracks.items, ...added]);
      if (added.length) toast(`เพิ่ม ${added.length} เพลงแล้ว — กด Save Draft`, 'ok');
    } catch (e: any) { toast(e.message, 'error'); } finally { setBusy(false); if (file.current) file.current.value = ''; }
  };
  const addUrl = () => {
    if (!/^https?:\/\//i.test(url)) return toast('ใส่ลิงก์ไฟล์เสียงที่ขึ้นต้นด้วย https://', 'error');
    tracks.setItems([...tracks.items, { _key: newKey(), title: url.split('/').pop()?.split('?')[0] || 'เพลงจากลิงก์', source: 'url', mediaId: null, url }]);
    setUrl('');
  };
  const saved = tracks.items.filter((t: any) => t.id);
  const opts: [string, string][] = saved.map((t: any) => [t.id, t.title || 'ไม่มีชื่อ']);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Music Manager 🎵</h1>
      <Section title="การตั้งค่า" desc="เบราว์เซอร์บล็อกเสียงอัตโนมัติ เพลงจะเริ่มหลังผู้รับกดยินยอมเปิดเสียง และมีปุ่มโน้ตเพลงลอยให้ปิด/เปิดได้ตลอด">
        <Toggle label="เปิดใช้เพลงประกอบ" checked={v.enabled} onChange={(x) => m.set({ enabled: x })} />
        <Toggle label="เล่นวนซ้ำ (Loop)" checked={v.loop} onChange={(x) => m.set({ loop: x })} />
        <Row cols={3}>
          <Select label="เพลงหลักของเว็บไซต์" value={v.mainTrackId ?? ''} onChange={(x) => m.set({ mainTrackId: x || null })} options={[['', 'เพลงแรกในรายการ'], ...opts]} />
          <Num label="ระดับเสียงเริ่มต้น (%)" value={Math.round((v.defaultVolume ?? 0.6) * 100)} min={0} max={100} onChange={(x) => m.set({ defaultVolume: x / 100 })} />
          <Num label="Fade เวลาเปลี่ยนเพลง (ms)" value={v.fadeMs} min={0} max={6000} step={100} onChange={(x) => m.set({ fadeMs: x })} />
        </Row>
      </Section>
      <Section title="Playlist" desc="อัปโหลด MP3 / WAV / OGG / M4A หรือเพิ่มจากลิงก์ไฟล์เสียงโดยตรง · ลากเพื่อเรียงลำดับ">
        <div className="flex flex-wrap gap-2">
          <input ref={file} type="file" multiple accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac" className="hidden" onChange={(e) => upload(e.target.files)} />
          <Btn kind="primary" onClick={() => file.current?.click()} disabled={busy}>{busy ? 'กำลังอัปโหลด…' : '⬆️ อัปโหลดเพลง'}</Btn>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/song.mp3" className={`${inputCls} max-w-sm`} />
          <Btn onClick={addUrl}>＋ เพิ่มจาก URL</Btn>
        </div>
        {tracks.items.length === 0 ? <Empty>ยังไม่มีเพลง</Empty> : (
          <SortableList items={tracks.items} onChange={tracks.setItems} render={(t, _i, handle) => (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white p-2.5">
              {handle}
              <input value={t.title} onChange={(e) => tracks.update(t._key, { title: e.target.value })} className={`${inputCls} min-w-[160px] flex-1`} />
              {t.source === 'url' ? <Badge color="blue">URL</Badge> : <Badge color="pink">อัปโหลด</Badge>}
              {t.id && t.id === v.mainTrackId && <Badge color="green">เพลงหลัก</Badge>}
              {!t.id && <Badge color="amber">ยังไม่บันทึก</Badge>}
              <audio src={t.source === 'url' ? t.url : mediaUrl(t.mediaId) ?? undefined} controls preload="none" className="h-9 max-w-[260px]" />
              <Btn kind="danger" onClick={() => tracks.remove(t._key)}>ลบ</Btn>
            </div>
          )} />
        )}
      </Section>
      <Section title="เพลงแยกแต่ละหน้า" desc="ถ้าใช้เพลงเดียวกันต่อกัน เพลงจะเล่นต่อเนื่องไม่เริ่มใหม่ · เปลี่ยนเพลงจะ Fade Out/In ให้อัตโนมัติ">
        <Row cols={4}>
          {PAGES.map((p) => (
            <Select key={p} label={pageLabel(p)} value={v.pageTracks?.[p] ?? ''} onChange={(x) => m.set({ pageTracks: { ...v.pageTracks, [p]: x } })}
              options={[['', 'ใช้เพลงหลัก'], ['none', 'ไม่มีเพลง'], ...opts]} />
          ))}
        </Row>
      </Section>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => { m.reset(); tracks.reset(); }} />
    </div>
  );
}
