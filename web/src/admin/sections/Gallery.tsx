import { useRef, useState } from 'react';
import { adminApi, mediaUrl } from '../../lib/api';
import { FRAMES, PhotoCard } from '../../visitor/pages/Gallery';
import { Badge, Btn, Empty, imageSize, MediaInput, Row, SaveBar, Section, Select, Text, Toggle } from '../components/form';
import { PreviewBox } from '../components/Preview';
import { newKey, SortableList } from '../components/Sortable';
import { useAdmin, useList, useSection } from '../store';

const FRAME_OPTS: [string, string][] = Object.keys(FRAMES).map((k) => [k, { pink: 'ชมพู', lavender: 'ลาเวนเดอร์', cream: 'ครีม', peach: 'พีช', blue: 'ฟ้า', mint: 'มินต์', white: 'ขาว' }[k] ?? k]);
const ANIM_OPTS: [string, string][] = [['float', 'ลอยขึ้นลง'], ['tilt', 'เอียงเมื่อชี้'], ['pop', 'เด้งตอนปรากฏ'], ['none', 'ไม่มี']];

export default function Gallery() {
  const { toast } = useAdmin();
  const web = useSection<any>('website');
  const g = useSection<any>('gallery');
  const photos = useList<any>('photos');
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const dirty = web.dirty || g.dirty || photos.dirty;
  const saving = web.saving || g.saving || photos.saving;
  const save = async () => { if (web.dirty) await web.save(); if (g.dirty) await g.save(); if (photos.dirty) await photos.save(); };

  const upload = async (files: FileList | File[] | null) => {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith('image/'));
    if (!list.length) return;
    setBusy(true);
    try {
      const dims = await Promise.all(list.map(imageSize));
      const res = await adminApi.upload(list);
      res.errors.forEach((e) => toast(`${e.filename}: ${e.error}`, 'error'));
      const added = res.files.map((f, i) => ({
        _key: newKey(), mediaId: f.id, width: dims[i]?.width ?? 0, height: dims[i]?.height ?? 0, caption: '',
        frame: Object.keys(FRAMES)[(photos.items.length + i) % 5], sticker: ['💗', '🎀', '✨', '🌸', '⭐'][(photos.items.length + i) % 5],
        animation: 'float', visible: true, isCover: false,
      }));
      photos.setItems([...photos.items, ...added]);
      toast(`อัปโหลด ${added.length} รูปแล้ว — อย่าลืมกด Save Draft`, 'ok');
    } catch (e: any) { toast(e.message, 'error'); } finally { setBusy(false); if (file.current) file.current.value = ''; }
  };

  const selected = photos.items.find((p) => p._key === sel);
  const visible = photos.items.filter((p) => p.visible && p.mediaId).map((p) => ({ ...p, id: p._key, url: mediaUrl(p.mediaId) }));
  const v = g.value;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Photo Gallery 📸</h1>
      <Toggle label="เปิดหน้าแกลเลอรี" checked={web.value.pages.gallery} onChange={(on) => web.set({ pages: { ...web.value.pages, gallery: on } })} />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Section title="รูปภาพ" desc="ลากรูปมาวาง หรือเลือกหลายรูปพร้อมกันได้ · ลากการ์ดเพื่อเรียงลำดับ · กดที่รูปเพื่อแก้รายละเอียด">
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
              className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center text-sm transition ${drag ? 'border-pink-400 bg-pink-50' : 'border-zinc-300'}`}
            >
              <span className="text-3xl">🖼️</span>
              <span className="text-zinc-600">ลากไฟล์ JPG / PNG / WEBP มาวางที่นี่</span>
              <input ref={file} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => upload(e.target.files)} />
              <Btn kind="primary" onClick={() => file.current?.click()} disabled={busy}>{busy ? 'กำลังอัปโหลด…' : 'เลือกรูปจากเครื่อง'}</Btn>
            </div>
            {photos.items.length === 0 ? <Empty>ยังไม่มีรูป</Empty> : (
              <SortableList grid items={photos.items} onChange={photos.setItems} render={(p, i, handle) => (
                <div className={`relative overflow-hidden rounded-xl border bg-white ${sel === p._key ? 'border-pink-500 ring-2 ring-pink-200' : 'border-zinc-200'}`}>
                  <button className="block w-full" onClick={() => setSel(sel === p._key ? null : p._key)}>
                    {p.mediaId ? <img src={mediaUrl(p.mediaId)!} alt="" className={`aspect-square w-full object-cover ${p.visible ? '' : 'opacity-40 grayscale'}`} /> : <div className="aspect-square bg-zinc-100" />}
                  </button>
                  <div className="flex items-center gap-1 p-1.5 text-xs">
                    {handle}
                    <span className="flex-1 truncate">{i + 1}. {p.caption || 'ไม่มีคำบรรยาย'}</span>
                    {p.isCover && <Badge color="pink">ปก</Badge>}
                    {!p.visible && <Badge>ซ่อน</Badge>}
                  </div>
                </div>
              )} />
            )}
          </Section>
          {selected && (
            <Section title="แก้ไขรูปที่เลือก" actions={<Btn kind="ghost" onClick={() => setSel(null)}>ปิด</Btn>}>
              <MediaInput label="เปลี่ยนรูป" value={selected.mediaId}
                onChange={(id, f) => photos.update(selected._key, { mediaId: id, ...(f?.width ? { width: f.width, height: f.height } : {}) })} />
              <Text label="คำบรรยายใต้รูป" value={selected.caption} onChange={(x) => photos.update(selected._key, { caption: x })} />
              <Row cols={3}>
                <Select label="กรอบรูป" value={selected.frame} onChange={(x) => photos.update(selected._key, { frame: x })} options={FRAME_OPTS} />
                <Select label="Animation" value={selected.animation} onChange={(x) => photos.update(selected._key, { animation: x })} options={ANIM_OPTS} />
                <Text label="สติกเกอร์ (Emoji)" value={selected.sticker} onChange={(x) => photos.update(selected._key, { sticker: x })} />
              </Row>
              <Toggle label="แสดงรูปนี้" checked={selected.visible} onChange={(x) => photos.update(selected._key, { visible: x })} />
              <Toggle label="ตั้งเป็นรูปหน้าปก" hint="รูปปกจะขึ้นเป็นรูปแรก" checked={selected.isCover}
                onChange={(x) => photos.setItems(photos.items.map((p) => ({ ...p, isCover: p._key === selected._key ? x : x ? false : p.isCover })))} />
              <Btn kind="danger" onClick={() => { photos.remove(selected._key); setSel(null); }}>ลบรูปนี้ออกจากแกลเลอรี</Btn>
            </Section>
          )}
          <Section title="ข้อความในหน้าแกลเลอรี">
            <Row>
              <Text label="หัวข้อ" value={v.title} onChange={(x) => g.set({ title: x })} />
              <Text label="ข้อความรอง" value={v.subtitle} onChange={(x) => g.set({ subtitle: x })} />
              <Text label="ข้อความตอนท้าย 1" value={v.endText1} onChange={(x) => g.set({ endText1: x })} />
              <Text label="ข้อความตอนท้าย 2" value={v.endText2} onChange={(x) => g.set({ endText2: x })} />
              <Text label="ปุ่มไปหน้าบอกความรู้สึก" value={v.confessionButton} onChange={(x) => g.set({ confessionButton: x })} />
              <Text label="ปุ่มอ่านจดหมายอีกครั้ง" value={v.rereadButton} onChange={(x) => g.set({ rereadButton: x })} />
              <Text label="ข้อความเมื่อยังไม่มีรูป" value={v.emptyText} onChange={(x) => g.set({ emptyText: x })} />
            </Row>
          </Section>
        </div>
        <PreviewBox title="Preview แกลเลอรี">
          <p className="text-center font-heading text-2xl text-primary">{v.title}</p>
          <p className="mb-6 text-center text-ink/70">{v.subtitle}</p>
          <div className="columns-2 gap-4">
            {[...visible].sort((a, b) => Number(b.isCover) - Number(a.isCover)).map((p, i) => <PhotoCard key={p._key} photo={p} index={i} onOpen={() => setSel(p._key)} />)}
          </div>
        </PreviewBox>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => { web.reset(); g.reset(); photos.reset(); }} />
    </div>
  );
}
