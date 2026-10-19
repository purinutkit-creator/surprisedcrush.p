import { Link } from 'react-router-dom';
import { adminApi } from '../../lib/api';
import { Badge, Section } from '../components/form';
import { eventLabel, fmtDateTime, fmtTime } from '../events';
import { useAdmin, useAsync, useLiveBus } from '../store';

function Stat({ label, value, icon, to }: { label: string; value: number | string; icon: string; to?: string }) {
  const body = (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-pink-200">
      <div className="flex items-center justify-between text-zinc-500"><span className="text-sm">{label}</span><span className="text-xl">{icon}</span></div>
      <p className="mt-2 text-3xl font-semibold text-zinc-800">{value}</p>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export default function Dashboard() {
  const { content } = useAdmin();
  const stats = useAsync(() => adminApi.get('/stats'));
  useLiveBus((m) => { if (m.t === 'event' || m.t === 'message_new' || m.t === 'requests_changed') stats.reload(); }, [stats.reload]);
  const s = stats.data;
  const r = content.sections.recipient;
  const warnings: { text: string; to: string }[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.birthday) && r.birthdayCheckEnabled) warnings.push({ text: 'ยังไม่ได้ตั้งวันเกิดของผู้รับ (ตอนนี้จะข้ามการตรวจวันเกิดไปก่อน)', to: 'recipient' });
  if (r.nickname === 'NAME' || !r.nickname) warnings.push({ text: 'ยังไม่ได้ตั้งชื่อเล่นของผู้รับ', to: 'recipient' });
  if (content.sections.website.pages.game && content.lists.answers.length === 0) warnings.push({ text: 'ยังไม่ได้ตั้งชื่อคำตอบที่ถูกต้องของเกมทาย (ทายยังไงก็ไม่ถูก)', to: 'game' });
  if (content.lists.photos.length === 0 && content.sections.website.pages.gallery) warnings.push({ text: 'ยังไม่มีรูปในแกลเลอรี', to: 'gallery' });
  if (content.lists.tracks.length === 0) warnings.push({ text: 'ยังไม่มีเพลงประกอบ', to: 'music' });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard 📊</h1>
        <p className="text-sm text-zinc-500">ภาพรวมของขวัญชิ้นนี้ (ไม่นับข้อมูลจากโหมด Preview)</p>
      </div>
      {warnings.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-semibold text-amber-800">เช็กลิสต์ก่อนส่งลิงก์ ✍️</p>
          {warnings.map((w) => <Link key={w.text} to={`/surprisedmycrush/${w.to}`} className="block text-sm text-amber-800 hover:underline">• {w.text} →</Link>)}
        </div>
      )}
      {s && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          <Stat label="ออนไลน์ตอนนี้" value={s.online} icon="🟢" to="/surprisedmycrush/live" />
          <Stat label="ผู้เข้าชม" value={s.visitors} icon="👀" />
          <Stat label="เริ่มเล่น" value={s.starts} icon="▶️" />
          <Stat label="วันเกิดถูกต้อง" value={s.birthday_ok} icon="🎂" />
          <Stat label="จำนวนครั้งที่ทาย" value={s.guesses} icon="🕵️" />
          <Stat label="ทายถูก" value={s.solved} icon="🎉" />
          <Stat label="ทายผิดครบ" value={s.exhausted} icon="🥺" />
          <Stat label="ภารกิจแลกสิทธิ์" value={s.exchanges} icon="🎟️" to="/surprisedmycrush/exchange" />
          <Stat label="ข้อความที่ได้รับ" value={s.messages} icon="💌" to="/surprisedmycrush/messages" />
          <Stat label="ยังไม่อ่าน" value={s.unread} icon="📬" to="/surprisedmycrush/messages" />
          <Stat label="เปิดแกลเลอรี" value={s.gallery} icon="📸" />
          <Stat label="เข้าหน้าบอกความรู้สึก" value={s.confession} icon="💖" />
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="เข้าชมล่าสุด" desc={s ? fmtDateTime(s.last_visit) : '…'}>
          {s?.pending_requests > 0 && (
            <Link to="/surprisedmycrush/exchange" className="block rounded-xl bg-violet-50 p-3 text-sm text-violet-700">🎟️ มีคำขอแลกสิทธิ์รออนุมัติ {s.pending_requests} รายการ →</Link>
          )}
          <ul className="divide-y divide-zinc-100 text-sm">
            {(s?.recent ?? []).map((e: any) => (
              <li key={e.id} className="flex gap-3 py-2">
                <span className="w-16 shrink-0 font-mono text-xs text-zinc-400">{fmtTime(e.created_at)}</span>
                <span className="flex-1">{eventLabel(e)}</span>
              </li>
            ))}
            {s && s.recent.length === 0 && <li className="py-3 text-zinc-400">ยังไม่มีใครเปิดของขวัญ</li>}
          </ul>
        </Section>
        <Section title="ทางลัด">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[['simulator', '🧪 ทดลองเล่นตั้งแต่ต้นจนจบ'], ['live', '🔴 ดูผู้เข้าชมแบบสด'], ['recipient', '🎂 ตั้งชื่อ & วันเกิด'], ['game', '🕵️ ตั้งคำตอบ & คำใบ้'],
              ['gallery', '📸 อัปโหลดรูป'], ['website', '🔗 สร้างลิงก์คำเชิญ']].map(([to, l]) => (
              <Link key={to} to={`/surprisedmycrush/${to}`} className="rounded-xl border border-zinc-200 p-3 hover:border-pink-300 hover:bg-pink-50">{l}</Link>
            ))}
          </div>
          <p className="text-xs text-zinc-500">ลิงก์สำหรับส่งให้เขา: <Badge color="pink">{location.origin}/</Badge></p>
        </Section>
      </div>
    </div>
  );
}
