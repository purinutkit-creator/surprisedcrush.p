import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../lib/api';
import { useVisitor } from '../context';

/** Shown only in admin preview: jump through the flow without touching real visitor data. */
export function PreviewBar() {
  const { state, reload } = useVisitor();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (state.mode !== 'preview') return null;

  const act = async (action: string) => {
    setBusy(true);
    try {
      if (action === 'reset') await adminApi.post('/preview/reset', {});
      else await adminApi.post(`/sessions/${state.sessionId}/action`, { action });
      await reload();
      if (action === 'reset') nav('/');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  const btn = 'rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-violet-700 shadow disabled:opacity-50';
  return (
    <div className="fixed left-2 top-[calc(var(--safe-top)+3rem)] z-[70] font-admin">
      <button onClick={() => setOpen(!open)} className="rounded-full bg-violet-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg">
        🧪 PREVIEW {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="mt-2 flex w-52 flex-col gap-1.5 rounded-2xl bg-violet-600/95 p-3 text-white shadow-xl">
          <p className="text-[11px] leading-snug opacity-90">ใช้ข้อมูล Draft · ข้อความที่ส่งจะเป็น “ข้อความทดสอบ” ไม่ปนกับของจริง</p>
          <p className="text-[11px] opacity-80">ขั้นตอนตอนนี้: <b>{state.step}</b> · ทายผิด {state.progress.attemptsUsed}/{state.progress.attemptsTotal}</p>
          <button disabled={busy} className={btn} onClick={() => act('reset')}>↺ เริ่มใหม่ตั้งแต่ต้น</button>
          <button disabled={busy} className={btn} onClick={() => act('sim_pass_birthday')}>ข้ามวันเกิด</button>
          <button disabled={busy} className={btn} onClick={() => act('sim_read_letter')}>ข้ามจดหมาย</button>
          <button disabled={busy} className={btn} onClick={() => act('unlock_hint')}>ปลดคำใบ้ +1</button>
          <button disabled={busy} className={btn} onClick={() => act('sim_exhaust')}>ทายผิดครบทุกครั้ง</button>
          <button disabled={busy} className={btn} onClick={() => act('extra_chance')}>เพิ่มโอกาส +1</button>
          <button disabled={busy} className={btn} onClick={() => act('reveal')}>ทายถูกเลย</button>
          <button disabled={busy} className={btn} onClick={() => nav('/yourmybestcrushever')}>ไปหน้าบอกความรู้สึก</button>
        </div>
      )}
    </div>
  );
}
