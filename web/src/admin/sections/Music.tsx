import { useEffect, useRef, useState } from 'react';
import { adminApi, mediaUrl } from '../../lib/api';
import { Badge, Btn, Empty, Field, inputCls, Num, Row, SaveBar, Section, Select, Text, Toggle } from '../components/form';
import { newKey, SortableList } from '../components/Sortable';
import { pageLabel } from '../events';
import { useAdmin, useList, useSection } from '../store';

const PAGES = ['welcome', 'letter', 'game', 'exchange', 'correct', 'message', 'gallery', 'confession'];

const toMMSS = (s: number) => { const n = Math.max(0, Math.floor(s || 0)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };
function parseMMSS(str: string): number {
  const t = String(str).trim();
  if (!t) return 0;
  if (/^\d+$/.test(t)) return Number(t);
  const m = t.match(/^(\d+):(\d{1,2})$/);
  return m ? Number(m[1]) * 60 + Math.min(59, Number(m[2])) : 0;
}

/** Start/end "ท่อน" editor shared by audio and YouTube tracks. */
function Segment({ t, update }: { t: any; update: (p: any) => void }) {
  return (
    <div className="mt-2 flex flex-wrap items-end gap-3 rounded-lg bg-zinc-50 p-2.5">
      <Field label="เริ่มที่ (นาที:วินาที)" hint="เว้น 0:00 = ตั้งแต่ต้น">
        <input defaultValue={toMMSS(t.startSec)} onBlur={(e) => update({ startSec: parseMMSS(e.target.value) })} placeholder="0:00" className={`${inputCls} w-28`} />
      </Field>
      <Field label="จบที่ (นาที:วินาที)" hint="เว้น 0:00 = จนจบเพลง">
        <input defaultValue={toMMSS(t.endSec)} onBlur={(e) => update({ endSec: parseMMSS(e.target.value) })} placeholder="0:00" className={`${inputCls} w-28`} />
      </Field>
      <span className="pb-2 text-xs text-zinc-500">เล่นเฉพาะช่วงนี้แล้ววนซ้ำ · {t.endSec > t.startSec ? `ยาว ${toMMSS(t.endSec - t.startSec)}` : 'ทั้งเพลง'}</span>
    </div>
  );
}

export default function Music() {
  const { toast } = useAdmin();
  const m = useSection<any>('music');
  const tracks = useList<any>('tracks');
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState('');
  const [paste, setPaste] = useState('');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [keySet, setKeySet] = useState(false);
  const [keyVal, setKeyVal] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const dirty = m.dirty || tracks.dirty;
  const saving = m.saving || tracks.saving;
  const save = async () => { if (tracks.dirty) await tracks.save(); if (m.dirty) await m.save(); };
  const v = m.value;

  useEffect(() => { adminApi.get('/youtube-key').then((r) => setKeySet(r.set)).catch(() => {}); }, []);

  const addYt = (videoId: string, title: string) => {
    tracks.setItems([...tracks.items, { _key: newKey(), title: title || 'เพลง YouTube', source: 'youtube', videoId, mediaId: null, url: '', startSec: 0, endSec: 0 }]);
    toast('เพิ่มเพลงแล้ว — อย่าลืม Save Draft', 'ok');
  };
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const res = await adminApi.upload(files);
      res.errors.forEach((e) => toast(`${e.filename}: ${e.error}`, 'error'));
      const added = res.files.filter((f) => f.kind === 'audio').map((f) => ({ _key: newKey(), title: f.filename.replace(/\.[^.]+$/, ''), source: 'upload', mediaId: f.id, url: '', videoId: '', startSec: 0, endSec: 0 }));
      tracks.setItems([...tracks.items, ...added]);
      if (added.length) toast(`เพิ่ม ${added.length} เพลงแล้ว — กด Save Draft`, 'ok');
    } catch (e: any) { toast(e.message, 'error'); } finally { setBusy(false); if (file.current) file.current.value = ''; }
  };
  const addUrl = () => {
    if (!/^https?:\/\//i.test(url)) return toast('ใส่ลิงก์ไฟล์เสียงที่ขึ้นต้นด้วย https://', 'error');
    tracks.setItems([...tracks.items, { _key: newKey(), title: url.split('/').pop()?.split('?')[0] || 'เพลงจากลิงก์', source: 'url', mediaId: null, url, videoId: '', startSec: 0, endSec: 0 }]);
    setUrl('');
  };
  const addPaste = async () => {
    if (!paste.trim()) return;
    try { const r = await adminApi.get(`/youtube-info?q=${encodeURIComponent(paste)}`); addYt(r.videoId, r.title); setPaste(''); }
    catch (e: any) { toast(e.message, 'error'); }
  };
  const search = async () => {
    if (!q.trim()) return;
    setSearching(true);
    setResults(null);
    try { const r = await adminApi.get(`/youtube-search?q=${encodeURIComponent(q)}`); setResults(r.items); }
    catch (e: any) { toast(e.message, 'error'); if (e.data?.noKey) setResults([]); }
    finally { setSearching(false); }
  };
  const saveKey = async () => {
    const r = await adminApi.put('/youtube-key', { key: keyVal });
    setKeySet(r.set); setKeyVal('');
    toast(r.set ? 'บันทึก API Key แล้ว ค้นหาเพลงได้เลย' : 'ลบ API Key แล้ว', 'ok');
  };

  const saved = tracks.items.filter((t: any) => t.id);
  const opts: [string, string][] = saved.map((t: any) => [t.id, t.title || 'ไม่มีชื่อ']);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Music Manager 🎵</h1>

      <Section title="เพิ่มเพลงจาก YouTube 🔎" desc="ค้นหาชื่อเพลง (ไทย/สากล/ญี่ปุ่น/เกาหลี) หรือวางลิงก์ YouTube แล้วเลือกท่อนที่อยากเล่นได้ — ไม่ต้องอัปโหลดไฟล์เอง">
        <div className="flex flex-wrap gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="พิมพ์ชื่อเพลง / ศิลปิน…" className={`${inputCls} min-w-[220px] flex-1`} />
          <Btn kind="primary" onClick={search} disabled={searching}>{searching ? 'กำลังค้นหา…' : '🔎 ค้นหา'}</Btn>
          <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`} target="_blank" rel="noreferrer"><Btn>เปิดบน YouTube ↗</Btn></a>
        </div>
        {results && results.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {results.map((r) => (
              <div key={r.videoId} className="flex items-center gap-2 rounded-xl border border-zinc-200 p-2">
                {r.thumb && <img src={r.thumb} alt="" className="h-12 w-16 rounded object-cover" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" dangerouslySetInnerHTML={{ __html: r.title }} />
                  <p className="truncate text-xs text-zinc-500">{r.author}</p>
                </div>
                <Btn kind="primary" onClick={() => addYt(r.videoId, String(r.title).replace(/<[^>]+>/g, ''))}>＋ เพิ่ม</Btn>
              </div>
            ))}
          </div>
        )}
        {results && results.length === 0 && !keySet && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            การค้นหาในแอดมินต้องใช้ YouTube API Key (ฟรีจาก Google Cloud) — หรือใช้วิธี <b>วางลิงก์</b> ด้านล่างได้เลย (กดปุ่ม “เปิดบน YouTube ↗” เพื่อหาเพลง แล้วก็อปลิงก์มาวาง)
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
          <span className="text-sm text-zinc-500">หรือวางลิงก์:</span>
          <input value={paste} onChange={(e) => setPaste(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPaste()} placeholder="วางลิงก์ YouTube (youtu.be/… หรือ youtube.com/watch?v=…)" className={`${inputCls} min-w-[240px] flex-1`} />
          <Btn onClick={addPaste}>＋ เพิ่มจากลิงก์</Btn>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-zinc-600">ตั้งค่า YouTube API Key (ไว้ค้นหาในแอดมิน) {keySet && <Badge color="green">ตั้งค่าแล้ว</Badge>}</summary>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <div className="flex-1"><Text label="API Key" value={keyVal} onChange={setKeyVal} placeholder={keySet ? '•••••••• (ตั้งค่าไว้แล้ว)' : 'วาง API Key ที่นี่'} /></div>
            <Btn kind="primary" onClick={saveKey}>บันทึก</Btn>
            {keySet && <Btn kind="danger" onClick={() => { setKeyVal(''); adminApi.put('/youtube-key', { key: '' }).then(() => { setKeySet(false); toast('ลบคีย์แล้ว', 'ok'); }); }}>ลบคีย์</Btn>}
          </div>
          <p className="mt-1 text-xs text-zinc-500">สร้างฟรีที่ Google Cloud Console → เปิด “YouTube Data API v3” → Create credentials → API key</p>
        </details>
      </Section>

      <Section title="อัปโหลด / ลิงก์ไฟล์เสียง" desc="ถ้ามีไฟล์เพลงเอง อัปโหลด MP3 / WAV / OGG / M4A หรือวางลิงก์ไฟล์เสียงโดยตรงได้">
        <div className="flex flex-wrap gap-2">
          <input ref={file} type="file" multiple accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac" className="hidden" onChange={(e) => upload(e.target.files)} />
          <Btn onClick={() => file.current?.click()} disabled={busy}>{busy ? 'กำลังอัปโหลด…' : '⬆️ อัปโหลดไฟล์เพลง'}</Btn>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/song.mp3" className={`${inputCls} max-w-sm`} />
          <Btn onClick={addUrl}>＋ เพิ่มจาก URL</Btn>
        </div>
      </Section>

      <Section title="Playlist" desc="ลากเพื่อเรียงลำดับ · กด “ตั้งท่อน” เพื่อเลือกช่วงเพลงที่จะเล่น">
        {tracks.items.length === 0 ? <Empty>ยังไม่มีเพลง</Empty> : (
          <SortableList items={tracks.items} onChange={tracks.setItems} render={(t, _i, handle) => (
            <div className="rounded-xl border border-zinc-200 bg-white p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                {handle}
                <input value={t.title} onChange={(e) => tracks.update(t._key, { title: e.target.value })} className={`${inputCls} min-w-[150px] flex-1`} />
                {t.source === 'youtube' ? <Badge color="red">YouTube</Badge> : t.source === 'url' ? <Badge color="blue">URL</Badge> : <Badge color="pink">ไฟล์</Badge>}
                {t.id && t.id === v.mainTrackId && <Badge color="green">เพลงหลัก</Badge>}
                {!t.id && <Badge color="amber">ยังไม่บันทึก</Badge>}
                {(t.startSec > 0 || t.endSec > 0) && <Badge color="violet">ท่อน {toMMSS(t.startSec)}{t.endSec > t.startSec ? `–${toMMSS(t.endSec)}` : '→'}</Badge>}
                <Btn onClick={() => setOpen(open === t._key ? null : t._key)}>{open === t._key ? 'ย่อ' : '✂️ ตั้งท่อน'}</Btn>
                <Btn kind="danger" onClick={() => tracks.remove(t._key)}>ลบ</Btn>
              </div>
              {t.source !== 'youtube' && (
                <audio src={t.source === 'url' ? t.url : mediaUrl(t.mediaId) ?? undefined} controls preload="none" className="mt-2 h-9 w-full max-w-[320px]" />
              )}
              {open === t._key && (
                <div className="mt-2">
                  {t.source === 'youtube' && t.videoId && (
                    <iframe
                      className="aspect-video w-full max-w-md rounded-lg"
                      src={`https://www.youtube-nocookie.com/embed/${t.videoId}?start=${t.startSec || 0}`}
                      title={t.title} allow="encrypted-media" referrerPolicy="strict-origin-when-cross-origin" />
                  )}
                  <p className="mt-1 text-xs text-zinc-500">เปิดฟังเพื่อหาเวลาท่อนที่ชอบ แล้วกรอกเวลาด้านล่าง (เช่น 0:45 ถึง 1:30)</p>
                  <Segment t={t} update={(p) => tracks.update(t._key, p)} />
                </div>
              )}
            </div>
          )} />
        )}
      </Section>

      <Section title="การตั้งค่า" desc="เบราว์เซอร์บล็อกเสียงอัตโนมัติ เพลงจะเริ่มหลังผู้รับกดยินยอมเปิดเสียง และมีปุ่มโน้ตเพลงลอยให้ปิด/เปิดได้ตลอด">
        <Toggle label="เปิดใช้เพลงประกอบ" checked={v.enabled} onChange={(x) => m.set({ enabled: x })} />
        <Toggle label="เล่นวนซ้ำ (Loop)" checked={v.loop} onChange={(x) => m.set({ loop: x })} />
        <Row cols={3}>
          <Select label="เพลงหลักของเว็บไซต์" value={v.mainTrackId ?? ''} onChange={(x) => m.set({ mainTrackId: x || null })} options={[['', 'เพลงแรกในรายการ'], ...opts]} />
          <Num label="ระดับเสียงเริ่มต้น (%)" value={Math.round((v.defaultVolume ?? 0.6) * 100)} min={0} max={100} onChange={(x) => m.set({ defaultVolume: x / 100 })} />
          <Num label="Fade เวลาเปลี่ยนเพลง (ms)" value={v.fadeMs} min={0} max={6000} step={100} onChange={(x) => m.set({ fadeMs: x })} />
        </Row>
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
