import { useEffect, useState, type FormEvent } from 'react';
import { adminApi } from '../../lib/api';
import { Badge, Btn, Num, Row, Section, Text, Toggle } from '../components/form';
import { fmtDateTime, NOTIFY_LABELS } from '../events';
import { useAdmin, useAsync } from '../store';

function Password() {
  const { toast } = useAdmin();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (f.next !== f.confirm) return toast('รหัสผ่านใหม่ไม่ตรงกัน', 'error');
    setBusy(true);
    try {
      await adminApi.post('/password', { current: f.current, next: f.next });
      toast('เปลี่ยนรหัสผ่านแล้ว ✓ อุปกรณ์อื่นถูกออกจากระบบทั้งหมด', 'ok');
      setF({ current: '', next: '', confirm: '' });
    } catch (ex: any) { toast(ex.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <Section title="เปลี่ยนรหัสผ่านแอดมิน" desc="รหัสผ่านเก็บเป็น bcrypt hash ที่ Server เท่านั้น">
      <form onSubmit={submit} className="space-y-3">
        <Row cols={3}>
          <Text label="รหัสผ่านปัจจุบัน" type="password" value={f.current} onChange={(v) => setF({ ...f, current: v })} />
          <Text label="รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)" type="password" value={f.next} onChange={(v) => setF({ ...f, next: v })} />
          <Text label="ยืนยันรหัสผ่านใหม่" type="password" value={f.confirm} onChange={(v) => setF({ ...f, confirm: v })} />
        </Row>
        <Btn type="submit" kind="primary" disabled={busy || !f.current || f.next.length < 6}>เปลี่ยนรหัสผ่าน</Btn>
      </form>
    </Section>
  );
}

function Sessions() {
  const { toast } = useAdmin();
  const s = useAsync(() => adminApi.get('/admin-sessions'));
  return (
    <Section title="จัดการ Session ของแอดมิน" actions={<Btn onClick={s.reload}>↻</Btn>}>
      <ul className="divide-y divide-zinc-100 text-sm">
        {(s.data ?? []).map((x: any) => (
          <li key={x.id} className="flex flex-wrap items-center gap-2 py-2.5">
            {x.current && <Badge color="green">อุปกรณ์นี้</Badge>}
            <span className="max-w-md truncate text-zinc-600">{x.user_agent}</span>
            <span className="text-xs text-zinc-400">IP {x.ip} · ใช้ล่าสุด {fmtDateTime(x.last_seen_at)}</span>
            {!x.current && <Btn kind="danger" className="ml-auto" onClick={async () => { await adminApi.del(`/admin-sessions/${x.id}`); toast('ออกจากระบบอุปกรณ์นั้นแล้ว', 'ok'); s.reload(); }}>ออกจากระบบ</Btn>}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Protection() {
  const { toast } = useAdmin();
  const sec = useAsync(() => adminApi.get('/security'));
  const [v, setV] = useState<any>(null);
  useEffect(() => { if (sec.data) setV(sec.data.settings); }, [sec.data]);
  if (!v) return null;
  return (
    <Section title="Login Attempt Protection" desc="ใส่รหัสผิดเกินจำนวนที่กำหนดจาก IP เดียวกัน จะถูกล็อกชั่วคราว">
      <Row cols={3}>
        <Num label="ใส่ผิดได้สูงสุด (ครั้ง)" value={v.maxLoginAttempts} min={3} max={20} onChange={(x) => setV({ ...v, maxLoginAttempts: x })} />
        <Num label="ล็อกนาน (นาที)" value={v.lockMinutes} min={1} max={1440} onChange={(x) => setV({ ...v, lockMinutes: x })} />
        <Num label="อยู่ในระบบได้นาน (วัน)" value={v.sessionDays} min={1} max={60} onChange={(x) => setV({ ...v, sessionDays: x })} />
      </Row>
      <Btn kind="primary" onClick={async () => { await adminApi.put('/security', v); toast('บันทึกแล้ว', 'ok'); sec.reload(); }}>บันทึก</Btn>
      <details className="text-sm">
        <summary className="cursor-pointer text-zinc-600">ประวัติการเข้าสู่ระบบล่าสุด</summary>
        <ul className="mt-2 max-h-64 divide-y divide-zinc-100 overflow-auto">
          {(sec.data?.attempts ?? []).map((a: any, i: number) => (
            <li key={i} className="flex gap-2 py-1.5">
              {a.success ? <Badge color="green">สำเร็จ</Badge> : <Badge color="red">ผิด</Badge>}
              <span className="text-zinc-500">{fmtDateTime(a.created_at)}</span><span className="text-zinc-400">IP {a.ip}</span>
            </li>
          ))}
        </ul>
      </details>
    </Section>
  );
}

function Notifications() {
  const { me, setPrefs, toast } = useAdmin();
  const p = me.prefs;
  const setEvent = (k: string, v: boolean) => setPrefs({ ...p, events: { ...p.events, [k]: v } });
  return (
    <Section title="Live Notifications 🔔" desc="แจ้งเตือนใน Dashboard ทันทีเมื่อผู้รับทำสิ่งเหล่านี้">
      <Row>
        <Toggle label="เสียงแจ้งเตือน" checked={p.sound} onChange={(v) => setPrefs({ ...p, sound: v })} />
        <Toggle label="แจ้งเตือนบนเดสก์ท็อป/มือถือ (Browser Notification)" checked={p.desktop} onChange={async (v) => {
          if (v && 'Notification' in window) {
            const perm = await Notification.requestPermission();
            if (perm !== 'granted') return toast('เบราว์เซอร์ไม่อนุญาตการแจ้งเตือน', 'error');
          }
          setPrefs({ ...p, desktop: v });
        }} />
      </Row>
      <Row cols={3}>
        {Object.entries(NOTIFY_LABELS).map(([k, l]) => <Toggle key={k} label={l} checked={!!p.events?.[k]} onChange={(v) => setEvent(k, v)} />)}
      </Row>
    </Section>
  );
}

function Logs() {
  const [actor, setActor] = useState('admin');
  const logs = useAsync(() => adminApi.get(`/logs?actor=${actor}`), [actor]);
  return (
    <Section title="Activity Logs" actions={
      <div className="flex gap-1 text-sm">
        {[['admin', 'แอดมิน'], ['visitor', 'ผู้เข้าชม'], ['all', 'ทั้งหมด']].map(([k, l]) => (
          <button key={k} onClick={() => setActor(k)} className={`rounded-lg px-2.5 py-1 ${actor === k ? 'bg-pink-500 text-white' : 'bg-zinc-100'}`}>{l}</button>
        ))}
      </div>
    }>
      <ul className="max-h-96 divide-y divide-zinc-100 overflow-auto text-sm">
        {(logs.data ?? []).map((l: any) => (
          <li key={l.id} className="flex flex-wrap gap-2 py-1.5">
            <span className="w-36 shrink-0 text-zinc-500">{fmtDateTime(l.created_at)}</span>
            <Badge color={l.actor === 'admin' ? 'violet' : 'pink'}>{l.actor}</Badge>
            <span className="font-medium">{l.type}</span>
            <span className="truncate text-xs text-zinc-400">{Object.keys(l.data ?? {}).length ? JSON.stringify(l.data) : ''}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export default function Security() {
  const logout = async () => { await adminApi.post('/logout'); location.reload(); };
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Security Settings 🔐</h1>
        <Btn kind="danger" onClick={logout}>Logout</Btn>
      </div>
      <Password />
      <Notifications />
      <Sessions />
      <Protection />
      <Logs />
    </div>
  );
}
