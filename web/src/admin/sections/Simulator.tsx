import { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../lib/api';
import { Btn, Section, Toggle } from '../components/form';
import { useAdmin } from '../store';

const SIZES = { phone: { w: 390, h: 780, label: '📱 มือถือ' }, tablet: { w: 768, h: 960, label: '📲 แท็บเล็ต' }, desktop: { w: 1200, h: 760, label: '💻 คอม' } } as const;

/** Play the whole gift end-to-end with draft content. Nothing here touches the real recipient's data. */
export default function Simulator() {
  const { toast, dirty } = useAdmin();
  const [size, setSize] = useState<keyof typeof SIZES>('phone');
  const [src, setSrc] = useState('/?preview=1');
  const [n, setN] = useState(0);
  const [clearMsgs, setClearMsgs] = useState(true);
  const reload = (path = src) => { setSrc(path); setN((x) => x + 1); };

  const act = async (action: string) => {
    try {
      const { id } = await adminApi.get('/preview-session');
      if (!id) { toast('เปิด Preview ให้โหลดก่อนแป๊บนึงนะ', 'error'); return; }
      await adminApi.post(`/sessions/${id}/action`, { action });
    } catch (e: any) { toast(e.message, 'error'); }
  };
  const resetAll = async () => {
    await adminApi.post('/preview/reset', { messages: clearMsgs });
    toast('เริ่มทดลองใหม่ตั้งแต่ต้นแล้ว', 'ok');
    reload('/?preview=1');
  };
  const s = SIZES[size];
  const scale = size === 'phone' ? 1 : size === 'tablet' ? 0.62 : 0.55;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">ทดลองเล่น (Simulator) 🧪</h1>
        <p className="text-sm text-zinc-500">เล่นตั้งแต่กรอกวันเกิด → ทายผิดครบ → แลกสิทธิ์ → ทายถูก → ส่งข้อความ → หน้าบอกชอบ โดยใช้ข้อมูล Draft · ข้อความที่ส่งจะเป็น “ข้อความทดสอบ” แยกจากของจริง</p>
        {dirty && <p className="mt-1 text-sm text-amber-700">● Preview ใช้ Draft ที่บันทึกแล้ว (รวมส่วนที่ยังไม่ Publish)</p>}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col items-center gap-3 overflow-x-auto rounded-2xl border border-zinc-200 bg-zinc-100 p-4">
          <div className="flex gap-1 rounded-xl bg-white p-1 text-sm">
            {(Object.keys(SIZES) as (keyof typeof SIZES)[]).map((k) => (
              <button key={k} onClick={() => setSize(k)} className={`rounded-lg px-3 py-1 ${size === k ? 'bg-pink-500 text-white' : ''}`}>{SIZES[k].label}</button>
            ))}
          </div>
          <div style={{ width: s.w * scale, height: s.h * scale }} className="relative">
            <div style={{ width: s.w, height: s.h, transform: `scale(${scale})`, transformOrigin: 'top left' }}
              className={`overflow-hidden bg-white shadow-2xl ${size === 'phone' ? 'rounded-[40px] border-[12px] border-zinc-900' : 'rounded-2xl border-[10px] border-zinc-800'}`}>
              <iframe key={n} src={src} title="Preview" className="h-full w-full border-0" />
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <Section title="ควบคุมการทดลอง">
            <Toggle label="ลบข้อความทดสอบตอนเริ่มใหม่" checked={clearMsgs} onChange={setClearMsgs} />
            <Btn kind="primary" className="w-full" onClick={resetAll}>↺ เริ่มใหม่ตั้งแต่ต้น</Btn>
            <div className="grid grid-cols-2 gap-2">
              <Btn onClick={() => act('sim_pass_birthday')}>ข้ามวันเกิด</Btn>
              <Btn onClick={() => act('sim_read_letter')}>ข้ามจดหมาย</Btn>
              <Btn onClick={() => act('unlock_hint')}>คำใบ้ +1</Btn>
              <Btn onClick={() => act('sim_exhaust')}>ทายผิดครบ</Btn>
              <Btn onClick={() => act('extra_chance')}>โอกาส +1</Btn>
              <Btn onClick={() => act('reveal')}>ทายถูกเลย</Btn>
            </div>
            <Btn className="w-full" onClick={() => reload('/yourmybestcrushever?preview=1')}>💖 เปิด /yourmybestcrushever</Btn>
            <Btn className="w-full" onClick={() => reload('/?preview=1')}>🏠 กลับหน้าแรก / Reload</Btn>
            <a href={src} target="_blank" rel="noreferrer" className="block"><Btn className="w-full">↗ เปิดในแท็บใหม่</Btn></a>
          </Section>
          <Section title="ตรวจผลการทดลอง">
            <Link to="/surprisedmycrush/messages?test=1" className="block text-sm text-pink-600 hover:underline">💬 ดูข้อความทดสอบ →</Link>
            <Link to="/surprisedmycrush/live" className="block text-sm text-pink-600 hover:underline">🔴 ดู Live Visitors (ติ๊ก “แสดง Preview”) →</Link>
            <Link to="/surprisedmycrush/exchange" className="block text-sm text-pink-600 hover:underline">🎟️ อนุมัติคำขอแลกสิทธิ์ทดสอบ →</Link>
          </Section>
        </div>
      </div>
    </div>
  );
}
