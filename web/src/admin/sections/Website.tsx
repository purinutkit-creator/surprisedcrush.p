import { useRef, useState } from 'react';
import { adminApi } from '../../lib/api';
import { Area, Badge, Btn, Empty, inputCls, MediaInput, Row, SaveBar, Section, Select, Text, Toggle } from '../components/form';
import { fmtDateTime } from '../events';
import { useAdmin, useAsync, useSection } from '../store';

const PAGE_TOGGLES: [string, string][] = [
  ['letter', 'จดหมายอวยพร'], ['game', 'เกมทายตัวตน'], ['exchange', 'ระบบแลกสิทธิ์'], ['message', 'เขียนข้อความถึงผู้ส่ง'],
  ['gallery', 'แกลเลอรีรูปภาพ'], ['confession', 'หน้าบอกความรู้สึก'],
];

function Invites() {
  const { toast } = useAdmin();
  const inv = useAsync(() => adminApi.get('/invites'));
  const [label, setLabel] = useState('');
  const link = (code: string) => `${location.origin}/?invite=${code}`;
  const create = async () => {
    await adminApi.post('/invites', { label });
    setLabel('');
    inv.reload();
  };
  return (
    <Section title="ลิงก์คำเชิญเฉพาะผู้รับ 🔗" desc="ใช้คู่กับ “ต้องเข้าผ่านลิงก์คำเชิญ” เพื่อจำกัดว่าใครเปิดของขวัญได้">
      <div className="flex gap-2">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ชื่อเรียกลิงก์ เช่น สำหรับเขา" className={inputCls} />
        <Btn kind="primary" onClick={create}>＋ สร้างลิงก์</Btn>
      </div>
      {(inv.data ?? []).length === 0 ? <Empty>ยังไม่มีลิงก์คำเชิญ</Empty> : (
        <ul className="space-y-2">
          {inv.data!.map((i: any) => (
            <li key={i.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 p-3 text-sm">
              <span className="font-medium">{i.label || 'ไม่มีชื่อ'}</span>
              {i.enabled ? <Badge color="green">ใช้งานได้</Badge> : <Badge>ปิดอยู่</Badge>}
              <span className="text-xs text-zinc-500">ใช้แล้ว {i.uses} ครั้ง · {fmtDateTime(i.created_at)}</span>
              <code className="w-full truncate rounded bg-zinc-50 px-2 py-1 text-xs">{link(i.code)}</code>
              <Btn onClick={() => { navigator.clipboard?.writeText(link(i.code)); toast('คัดลอกลิงก์แล้ว', 'ok'); }}>คัดลอก</Btn>
              <Btn onClick={async () => { await adminApi.patch(`/invites/${i.id}`, { enabled: !i.enabled }); inv.reload(); }}>{i.enabled ? 'ปิด' : 'เปิด'}</Btn>
              <Btn kind="danger" onClick={async () => { if (confirm('ลบลิงก์นี้?')) { await adminApi.del(`/invites/${i.id}`); inv.reload(); } }}>ลบ</Btn>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function DataTools() {
  const { toast, reloadContent } = useAdmin();
  const file = useRef<HTMLInputElement>(null);
  const [msgs, setMsgs] = useState(false);
  const importFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const json = JSON.parse(await f.text());
      if (!confirm('นำเข้าการตั้งค่านี้ทับ Draft ปัจจุบัน?')) return;
      await adminApi.post('/import', json);
      await reloadContent();
      toast('นำเข้าแล้ว ✓ ตรวจดูแล้วกด Publish', 'ok');
    } catch (e: any) { toast(e.message || 'ไฟล์ไม่ถูกต้อง', 'error'); } finally { if (file.current) file.current.value = ''; }
  };
  const resetPlay = async () => {
    const typed = prompt('การรีเซ็ตจะลบความคืบหน้าและประวัติของผู้เล่นทุกคน (ไม่รวม Preview)\nพิมพ์ RESET เพื่อยืนยัน');
    if (typed !== 'RESET') return;
    try {
      await adminApi.post('/reset-play-data', { confirm: 'RESET', messages: msgs });
      toast('รีเซ็ตข้อมูลการเล่นแล้ว', 'ok');
    } catch (e: any) { toast(e.message, 'error'); }
  };
  return (
    <Section title="ข้อมูล & สำรองการตั้งค่า">
      <div className="flex flex-wrap gap-2">
        <a href="/api/admin/export"><Btn>⬇️ Export Settings (.json)</Btn></a>
        <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => importFile(e.target.files?.[0])} />
        <Btn onClick={() => file.current?.click()}>⬆️ Import Settings</Btn>
      </div>
      <p className="text-xs text-zinc-500">ไฟล์ Export เก็บข้อความและการตั้งค่าทั้งหมด (รูป/เพลงอ้างอิงจากไฟล์ที่อัปโหลดไว้ในระบบนี้)</p>
      <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
        <p className="mb-2 font-medium text-red-700">Reset ข้อมูลการเล่น</p>
        <Toggle label="ลบข้อความที่ได้รับด้วย" checked={msgs} onChange={setMsgs} />
        <Btn kind="danger" className="mt-3" onClick={resetPlay}>รีเซ็ตความคืบหน้าของผู้เล่นทั้งหมด</Btn>
      </div>
    </Section>
  );
}

export default function Website() {
  const { value: w, set, save, saving, dirty, reset } = useSection<any>('website');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Website Settings ⚙️</h1>
      <Section title="ข้อมูลเว็บไซต์ & SEO">
        <Row>
          <Text label="ชื่อเว็บไซต์" value={w.siteName} onChange={(v) => set({ siteName: v })} />
          <Text label="SEO Title" value={w.seoTitle} onChange={(v) => set({ seoTitle: v })} />
        </Row>
        <Area label="Meta Description" rows={2} value={w.metaDescription} onChange={(v) => set({ metaDescription: v })} hint="ข้อความที่แสดงเวลาแชร์ลิงก์" />
        <Row>
          <Text label="ข้อความ Footer" value={w.footerText} onChange={(v) => set({ footerText: v })} />
          <MediaInput label="Favicon (PNG / ICO)" kind="icon" value={w.faviconId} onChange={(id) => set({ faviconId: id })} />
        </Row>
      </Section>
      <Section title="เปิด/ปิดเว็บไซต์ชั่วคราว">
        <Toggle label="ปิดเว็บไซต์ชั่วคราว" hint="ผู้รับจะเห็นข้อความด้านล่างแทน (โหมด Preview ยังใช้ได้)" checked={w.siteClosed} onChange={(v) => set({ siteClosed: v })} />
        <Row>
          <Text label="หัวข้อตอนปิด" value={w.closedTitle} onChange={(v) => set({ closedTitle: v })} />
          <Text label="ข้อความตอนปิด" value={w.closedMessage} onChange={(v) => set({ closedMessage: v })} />
        </Row>
      </Section>
      <Section title="เปิด/ปิดหน้าต่าง ๆ" desc="ปิดหน้าไหน ระบบจะข้ามขั้นตอนนั้นให้อัตโนมัติ">
        <Row cols={3}>
          {PAGE_TOGGLES.map(([k, l]) => <Toggle key={k} label={l} checked={w.pages[k]} onChange={(v) => set({ pages: { ...w.pages, [k]: v } })} />)}
        </Row>
      </Section>
      <Section title="การบันทึกความคืบหน้า" desc="ความคืบหน้าเก็บใน Database ฝั่ง Server เสมอ — ลบ Local Storage หรือแก้ค่าในเบราว์เซอร์ก็เพิ่มโอกาสทายเองไม่ได้">
        <Select label="ผูกความคืบหน้ากับ" value={w.progress.binding} onChange={(v) => set({ progress: { ...w.progress, binding: v } })} options={[
          ['device', 'อุปกรณ์ (Cookie + จำอุปกรณ์/เครือข่ายเดิม แม้ล้าง Cookie)'],
          ['cookie', 'Cookie ของเบราว์เซอร์เท่านั้น'],
          ['invite', 'ลิงก์คำเชิญ (เปิดจากหลายอุปกรณ์ก็ใช้ความคืบหน้าเดียวกัน)'],
        ]} />
        <Toggle label="ต้องเข้าผ่านลิงก์คำเชิญเท่านั้น" hint="คนที่ไม่มีลิงก์จะเปิดของขวัญไม่ได้" checked={w.progress.requireInvite} onChange={(v) => set({ progress: { ...w.progress, requireInvite: v } })} />
        <Row>
          <Text label="หัวข้อเมื่อไม่มีลิงก์" value={w.progress.blockedTitle} onChange={(v) => set({ progress: { ...w.progress, blockedTitle: v } })} />
          <Text label="ข้อความเมื่อไม่มีลิงก์" value={w.progress.blockedMessage} onChange={(v) => set({ progress: { ...w.progress, blockedMessage: v } })} />
        </Row>
      </Section>
      <Section title="การแจ้งเตือน & Live Screen View" desc="หน้าแอดมินเห็นความคืบหน้า กิจกรรม และข้อความทั้งหมดอยู่แล้ว ส่วนนี้คุมหน้าตาฝั่งผู้รับและภาพ Live">
        <Toggle label="เปิด Live Screen View (ดูหน้าเว็บที่ผู้รับกำลังเปิดแบบสด)" hint="ดูได้ทันทีเมื่อผู้รับออนไลน์ ไม่ต้องให้ผู้รับกดอนุญาตก่อน" checked={w.tracking.liveViewEnabled} onChange={(v) => set({ tracking: { ...w.tracking, liveViewEnabled: v } })} />
        <Toggle label="ปิดบังช่องกรอกในภาพ Live View" hint="ปิดไว้ (ค่าเริ่มต้น) = เห็นทุกอย่างที่ผู้รับพิมพ์ในภาพสด เช่น วันเกิดและข้อความ" checked={w.tracking.maskInputs} onChange={(v) => set({ tracking: { ...w.tracking, maskInputs: v } })} />
        <Toggle label="แสดงหมายเหตุให้ผู้รับทราบว่าเว็บนี้แสดงกิจกรรมให้คนทำของขวัญ" hint="แนะนำให้เปิดไว้เพื่อความโปร่งใส — แสดงครั้งเดียวตอนเปิดเว็บ" checked={w.tracking.noticeEnabled} onChange={(v) => set({ tracking: { ...w.tracking, noticeEnabled: v } })} />
        <Area label="ข้อความหมายเหตุ" rows={3} value={w.tracking.noticeText} onChange={(v) => set({ tracking: { ...w.tracking, noticeText: v } })} />
        <Toggle label="ขอตำแหน่งที่อยู่ของผู้รับ" hint="เปิดแล้วจะมีการ์ดชวนแชร์ตำแหน่ง ผู้รับต้องกดอนุญาต แล้วเบราว์เซอร์จะถามยืนยันอีกครั้ง — ข้ามได้เสมอ" checked={w.tracking.askLocation} onChange={(v) => set({ tracking: { ...w.tracking, askLocation: v } })} />
        {w.tracking.askLocation && <Area label="ข้อความชวนแชร์ตำแหน่ง" rows={2} value={w.tracking.locationText} onChange={(v) => set({ tracking: { ...w.tracking, locationText: v } })} />}
      </Section>
      <Invites />
      <DataTools />
      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={reset} />
    </div>
  );
}
