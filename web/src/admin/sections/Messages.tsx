import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from '../../lib/api';
import { Badge, Btn, Empty, inputCls, Toggle } from '../components/form';
import { fmtDateTime } from '../events';
import { useAdmin, useAsync, useLiveBus } from '../store';

export default function Messages() {
  const { toast, setUnread, me, setPrefs } = useAdmin();
  const [params, setParams] = useSearchParams();
  const test = params.get('test') === '1';
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const msgs = useAsync(() => adminApi.get(`/messages?test=${test ? 1 : 0}&q=${encodeURIComponent(query)}`), [test, query]);
  useLiveBus((m) => { if (m.t === 'message_new') msgs.reload(); }, [msgs.reload]);
  useEffect(() => { const t = setTimeout(() => setQuery(q), 300); return () => clearTimeout(t); }, [q]);

  const refreshUnread = async () => setUnread((await adminApi.get('/stats')).unread);
  const read = async (m: any, value = true) => {
    await adminApi.patch(`/messages/${m.id}`, { read: value });
    msgs.setData((msgs.data as any[]).map((x) => (x.id === m.id ? { ...x, is_read: value } : x)));
    refreshUnread();
  };
  const del = async (m: any) => {
    if (!confirm('ลบข้อความนี้ถาวร?')) return;
    await adminApi.del(`/messages/${m.id}`);
    toast('ลบแล้ว', 'ok');
    msgs.reload();
    refreshUnread();
  };
  const list: any[] = msgs.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Messages Inbox 💬</h1>
          <p className="text-sm text-zinc-500">ข้อความจากเขาถึงคุณ — เห็นได้เฉพาะในหน้าแอดมินนี้เท่านั้น</p>
        </div>
        <a href={`/api/admin/messages.csv?test=${test ? 1 : 0}`}><Btn>⬇️ Export CSV</Btn></a>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-zinc-300 bg-white p-0.5 text-sm">
          <button className={`rounded-lg px-3 py-1.5 ${!test ? 'bg-pink-500 text-white' : ''}`} onClick={() => setParams({})}>ข้อความจริง</button>
          <button className={`rounded-lg px-3 py-1.5 ${test ? 'bg-violet-600 text-white' : ''}`} onClick={() => setParams({ test: '1' })}>ข้อความทดสอบ (Preview)</button>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 ค้นหาข้อความ…" className={`${inputCls} max-w-xs`} />
      </div>
      <div className="max-w-md">
        <Toggle label="เสียงแจ้งเตือนเมื่อมีข้อความใหม่" checked={me.prefs.sound} onChange={(v) => setPrefs({ ...me.prefs, sound: v })} />
      </div>
      {list.length === 0 ? <Empty>{query ? 'ไม่พบข้อความที่ค้นหา' : 'ยังไม่มีข้อความ 💌'}</Empty> : (
        <ul className="space-y-3">
          {list.map((m) => (
            <li key={m.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${!m.is_read ? 'border-pink-300' : 'border-zinc-200'}`}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {!m.is_read ? <Badge color="pink">● ยังไม่อ่าน</Badge> : <Badge>อ่านแล้ว</Badge>}
                <span className="text-zinc-500">{fmtDateTime(m.created_at)}</span>
                <span className="text-zinc-400">· {m.char_count} ตัวอักษร · {m.device ?? ''}</span>
                <div className="ml-auto flex gap-1.5">
                  <Btn kind="ghost" onClick={() => read(m, !m.is_read)}>{m.is_read ? 'ทำเป็นยังไม่อ่าน' : 'ทำเครื่องหมายอ่านแล้ว'}</Btn>
                  <Btn kind="danger" onClick={() => del(m)}>ลบ</Btn>
                </div>
              </div>
              <button className="mt-3 block w-full text-left" onClick={() => { setOpen(open === m.id ? null : m.id); if (!m.is_read) read(m); }}>
                <p className={`whitespace-pre-wrap text-[15px] leading-relaxed ${open === m.id ? '' : 'line-clamp-3'}`}>{m.content}</p>
                {open !== m.id && m.content.length > 160 && <span className="text-xs text-pink-600">อ่านทั้งหมด…</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
