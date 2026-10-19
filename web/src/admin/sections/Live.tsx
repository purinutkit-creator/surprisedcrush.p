import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Replayer } from 'rrweb';
import 'rrweb/dist/style.css';
import { adminApi } from '../../lib/api';
import { Badge, Btn, Empty, inputCls, Section } from '../components/form';
import { eventLabel, fmtDateTime, fmtDuration, fmtTime, pageLabel } from '../events';
import { useAdmin, useAsync, useLiveBus } from '../store';

type Status = 'online' | 'idle' | 'offline' | 'live';
const DOT: Record<Status, string> = { online: '🟢', idle: '🟡', offline: '⚫', live: '🔴' };
const STATUS_TH: Record<Status, string> = { online: 'Online', idle: 'Idle', offline: 'Offline', live: 'Live' };

function statusOf(p: any, now: number): Status {
  if (!p?.online) return 'offline';
  if (p.recording && p.watched) return 'live';
  if (now - p.lastActivity > 60_000) return 'idle';
  return 'online';
}

/** Re-creates the visitor's page from the rrweb DOM stream (never a screenshot of the device). */
function LiveView({ sessionId, presence, onStop }: { sessionId: string; presence: any; onStop: () => void }) {
  const { live } = useAdmin();
  const frame = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const replayer = useRef<Replayer | null>(null);
  const dims = useRef({ width: 390, height: 844 });
  const [state, setState] = useState('connecting');
  const [lastAt, setLastAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const kind = presence?.kind ?? 'phone';

  const fit = useCallback(() => {
    const wrap = root.current?.querySelector('.replayer-wrapper') as HTMLElement | null;
    const box = frame.current;
    if (!wrap || !box) return;
    const s = Math.min(box.clientWidth / dims.current.width, box.clientHeight / dims.current.height);
    wrap.style.transform = `scale(${s})`;
    wrap.style.left = `${(box.clientWidth - dims.current.width * s) / 2}px`;
  }, []);

  useEffect(() => {
    live.send({ t: 'watch', sessionId });
    const off = live.on((m) => {
      if (m.t === '_status' && live.status === 'online') live.send({ t: 'watch', sessionId });
      if (m.t === 'watch_status' && m.sessionId === sessionId) setState(m.state);
      if (m.t !== 'rr' || m.sessionId !== sessionId) return;
      setLastAt(Date.now());
      setState('live');
      for (const e of m.e as any[]) {
        if (e.type === 4) {
          // Meta event = a fresh recording started: rebuild the replayer around the new full snapshot.
          replayer.current?.destroy();
          if (root.current) root.current.innerHTML = '';
          dims.current = { width: e.data.width || 390, height: e.data.height || 844 };
          const r = new Replayer([], {
            root: root.current!, liveMode: true, mouseTail: { strokeStyle: '#FF82AB', lineWidth: 3, duration: 600 },
            showWarning: false, blockClass: 'rr-block', triggerFocus: false, UNSAFE_replayCanvas: false,
          });
          r.on('resize', (d: any) => { dims.current = { width: d.width, height: d.height }; fit(); });
          r.startLive(e.timestamp - 300);
          replayer.current = r;
          setTimeout(fit, 30);
        }
        replayer.current?.addEvent(e);
      }
    });
    const ro = new ResizeObserver(fit);
    if (frame.current) ro.observe(frame.current);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      off();
      ro.disconnect();
      clearInterval(tick);
      live.send({ t: 'unwatch' });
      replayer.current?.destroy();
      replayer.current = null;
    };
  }, [sessionId, live, fit]);

  const latency = presence?.rtt != null && live.rtt != null ? Math.round((presence.rtt + live.rtt) / 2) : null;
  const frameCls = kind === 'desktop' ? 'aspect-[16/10] w-full rounded-xl border-[10px] border-zinc-800' : kind === 'tablet'
    ? 'mx-auto aspect-[3/4] w-full max-w-[420px] rounded-[28px] border-[14px] border-zinc-800'
    : 'mx-auto aspect-[9/19.5] w-full max-w-[300px] rounded-[38px] border-[12px] border-zinc-900';
  const msg: Record<string, string> = {
    connecting: 'กำลังเชื่อมต่อ…', waiting: 'รอภาพจากผู้รับ…', offline: 'ผู้รับออฟไลน์อยู่',
    no_consent: 'ผู้รับยังไม่ได้อนุญาต Live View — ระบบจะไม่แสดงหน้าจอจนกว่าเขาจะยินยอม', live: '',
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge color={state === 'live' ? 'red' : 'zinc'}>{state === 'live' ? '🔴 LIVE' : msg[state] ? '⏳' : ''} {state !== 'live' && state}</Badge>
        {latency != null && <span className="text-zinc-500">ความล่าช้า ≈ {latency} ms</span>}
        {lastAt && <span className="text-zinc-400">อัปเดตล่าสุด {Math.max(0, Math.round((now - lastAt) / 1000))} วิที่แล้ว</span>}
        <span className="text-zinc-400">· ช่องกรอกข้อมูลถูกปิดบังเสมอ</span>
        <Btn className="ml-auto" onClick={() => live.send({ t: 'resync' })}>↻ Resync</Btn>
        <Btn kind="danger" onClick={onStop}>■ Stop Watching</Btn>
      </div>
      <div className={`relative overflow-hidden bg-white shadow-2xl ${frameCls}`} ref={frame}>
        <div ref={root} className="absolute inset-0" />
        {state !== 'live' && <div className="absolute inset-0 grid place-items-center bg-zinc-50/95 p-6 text-center text-sm text-zinc-500">{msg[state] ?? state}</div>}
      </div>
      {presence?.music && <p className="text-center text-xs text-zinc-500">🎵 {presence.music.playing ? `กำลังเล่น: ${presence.music.title ?? 'เพลง'}` : 'ปิดเพลงอยู่'}</p>}
    </div>
  );
}

function Detail({ id, presence, now, watching, setWatching }: { id: string; presence: any; now: number; watching: boolean; setWatching: (v: boolean) => void }) {
  const { toast } = useAdmin();
  const d = useAsync(() => adminApi.get(`/sessions/${id}`), [id]);
  const [events, setEvents] = useState<any[]>([]);
  const [surprise, setSurprise] = useState('');
  const [hint, setHint] = useState('');
  const timeline = useRef<HTMLDivElement>(null);
  useEffect(() => { if (d.data) setEvents(d.data.events); }, [d.data]);
  useLiveBus((m) => {
    if (m.t === 'event' && m.sessionId === id) {
      setEvents((xs) => [...xs, { ...m.event, created_at: m.event.at }]);
      d.reload();
    }
    if (m.t === 'requests_changed') d.reload();
  }, [id, d.reload]);
  useEffect(() => { timeline.current?.scrollTo({ top: timeline.current.scrollHeight, behavior: 'smooth' }); }, [events.length]);

  const act = async (action: string, extra: any = {}) => {
    try {
      const r = await adminApi.post(`/sessions/${id}/action`, { action, ...extra });
      toast(action === 'surprise' ? (r.delivered ? 'ส่งเซอร์ไพรส์แล้ว 💗' : 'ผู้รับออฟไลน์ ส่งไม่ถึง') : 'เรียบร้อย ✓ หน้าของผู้รับอัปเดตแล้ว', r.delivered === false ? 'error' : 'ok');
      d.reload();
    } catch (e: any) { toast(e.message, 'error'); }
  };
  const decide = async (rid: string, approve: boolean) => {
    await adminApi.post(`/requests/${rid}/decide`, { approve });
    toast(approve ? 'อนุมัติภารกิจแล้ว' : 'ปฏิเสธแล้ว', 'ok');
    d.reload();
  };

  const s = d.data?.summary;
  if (!s) return <p className="text-sm text-zinc-400">กำลังโหลด…</p>;
  const st = statusOf(presence, now);
  const pending = (d.data.requests ?? []).filter((r: any) => r.status === 'pending');
  const step = (ok: boolean, label: string) => <span className={`rounded-full px-2 py-0.5 text-xs ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>{ok ? '✓' : '○'} {label}</span>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg">{DOT[st]}</span>
        <span className="font-semibold">{s.device}</span>
        <Badge>{STATUS_TH[st]}</Badge>
        {s.preview && <Badge color="violet">Preview</Badge>}
        {s.liveConsent ? <Badge color="green">อนุญาต Live View</Badge> : <Badge>ไม่อนุญาต Live View</Badge>}
        {!watching && <Btn kind="primary" className="ml-auto" disabled={!s.liveConsent || !presence?.online} onClick={() => setWatching(true)}
          title={!s.liveConsent ? 'ต้องได้รับความยินยอมจากผู้รับก่อน' : !presence?.online ? 'ผู้รับออฟไลน์' : ''}>👁️ Watch Live</Btn>}
      </div>

      {watching && <LiveView sessionId={id} presence={presence} onStop={() => setWatching(false)} />}

      <Section title="View Progress">
        <div className="flex flex-wrap gap-1.5">
          {step(s.birthdayPassed, 'วันเกิด')}{step(s.letterOpened, 'เปิดจดหมาย')}{step(s.letterRead, 'อ่านจดหมาย')}{step(s.gameStarted, 'เริ่มเกม')}
          {step(s.solved, s.solved ? `ทายถูก (${s.solvedVia})` : 'ทายถูก')}{step(s.messageSent, 'ส่งข้อความ')}{step(s.galleryOpened, 'แกลเลอรี')}{step(s.confessionOpened, 'หน้าบอกความรู้สึก')}
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <p><span className="text-zinc-500">ทายไปแล้ว</span><br /><b>{s.attemptsUsed}</b> ครั้ง (ผิด)</p>
          <p><span className="text-zinc-500">โอกาสเหลือ</span><br /><b>{s.attemptsLeft}</b> / {s.attemptsTotal}</p>
          <p><span className="text-zinc-500">คำใบ้ที่เปิด</span><br /><b>{s.hintsUnlocked}</b> / {s.hintsTotal}</p>
          <p><span className="text-zinc-500">อยู่ในเว็บ</span><br /><b>{presence?.online ? fmtDuration(now - presence.connectedAt) : '—'}</b></p>
        </div>
        {(d.data.attempts ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 text-sm">
            {d.data.attempts.map((a: any, i: number) => <Badge key={i} color={a.correct ? 'green' : 'red'}>{a.guess}</Badge>)}
          </div>
        )}
      </Section>

      <Section title="ควบคุมจากแอดมิน" desc="เปลี่ยนแปลงแล้วหน้าของผู้รับอัปเดตแบบ Real-Time">
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => act('reset_attempts')}>↺ Reset Attempts</Btn>
          <Btn onClick={() => act('extra_chance', { amount: 1 })}>💗 Give Extra Chance</Btn>
          <Btn onClick={() => act('unlock_hint')}>💡 Unlock Hint</Btn>
          <Btn onClick={() => act('reveal')}>🎉 เปิดเฉลยให้</Btn>
          <Btn onClick={() => act('reset_birthday_lock')}>🔓 ปลดล็อกวันเกิด</Btn>
        </div>
        <div className="flex gap-2">
          <input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="ส่งคำใบ้พิเศษเฉพาะคนนี้…" className={inputCls} />
          <Btn disabled={!hint.trim()} onClick={() => { act('special_hint', { text: hint }); setHint(''); }}>ส่ง</Btn>
        </div>
        {pending.length > 0 && (
          <div className="space-y-2 rounded-xl bg-violet-50 p-3">
            <p className="text-sm font-semibold text-violet-700">Approve Mission — รออนุมัติ {pending.length}</p>
            {pending.map((r: any) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{r.mission_title}</span>
                {r.submission && <span className="truncate text-zinc-600">“{r.submission}”</span>}
                <Btn kind="primary" onClick={() => decide(r.id, true)}>อนุมัติ</Btn>
                <Btn kind="danger" onClick={() => decide(r.id, false)}>ปฏิเสธ</Btn>
              </div>
            ))}
          </div>
        )}
        <div className="rounded-xl border border-pink-200 bg-pink-50/50 p-3">
          <p className="mb-2 text-sm font-semibold text-pink-700">Send Surprise ✨</p>
          <div className="flex flex-wrap gap-2">
            <input value={surprise} onChange={(e) => setSurprise(e.target.value)} placeholder="ข้อความเซอร์ไพรส์ (ไม่บังคับ)" className={`${inputCls} min-w-[200px] flex-1`} maxLength={200} />
            <Btn onClick={() => act('surprise', { kind: 'hearts', text: surprise })}>💗 หัวใจ</Btn>
            <Btn onClick={() => act('surprise', { kind: 'confetti', text: surprise })}>🎉 Confetti</Btn>
            <Btn onClick={() => act('surprise', { kind: 'stars', text: surprise })}>⭐ ดาว</Btn>
            {surprise && <Btn onClick={() => act('surprise', { kind: 'message', text: surprise })}>💬 ข้อความอย่างเดียว</Btn>}
          </div>
        </div>
        <div className="flex gap-2">
          <Btn kind="danger" onClick={() => confirm('รีเซ็ตความคืบหน้าทั้งหมดของคนนี้?') && act('reset_all')}>รีเซ็ตทั้งหมด</Btn>
          <Btn kind="danger" onClick={() => confirm('ลบ Session นี้ถาวร?') && act('delete')}>ลบ Session</Btn>
        </div>
      </Section>

      <Section title="Live Activity Timeline" desc="ชื่อที่ทายแสดงที่นี่เท่านั้น ไม่อยู่ในภาพจำลองหน้าจอ">
        <div ref={timeline} className="max-h-[420px] overflow-y-auto">
          <ul className="space-y-1 font-mono text-[13px]">
            {events.map((e: any) => (
              <li key={e.id} className={`flex gap-3 rounded-lg px-2 py-1 ${e.type === 'solved' || e.type === 'message_sent' ? 'bg-pink-50' : ''}`}>
                <span className="shrink-0 text-zinc-400">{fmtTime(e.created_at)}</span>
                <span className="font-sans">{eventLabel(e)}</span>
              </li>
            ))}
            {events.length === 0 && <li className="text-zinc-400">ยังไม่มีกิจกรรม</li>}
          </ul>
        </div>
      </Section>
    </div>
  );
}

export default function Live() {
  const { live } = useAdmin();
  const [params, setParams] = useSearchParams();
  const selected = params.get('s');
  const [presence, setPresence] = useState<any[]>([]);
  const [now, setNow] = useState(Date.now());
  const [scope, setScope] = useState<'recent' | 'all'>('recent');
  const [watching, setWatching] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const data = useAsync(() => (scope === 'all' ? adminApi.get(`/sessions?preview=${showPreview ? 1 : 0}`).then((sessions) => ({ sessions })) : adminApi.get('/live')), [scope, showPreview]);
  const reloadTimer = useRef<number | null>(null);
  const softReload = useCallback(() => {
    if (reloadTimer.current) return;
    reloadTimer.current = window.setTimeout(() => { reloadTimer.current = null; data.reload(); }, 800);
  }, [data.reload]);

  useEffect(() => { if (data.data?.presence) setPresence(data.data.presence); }, [data.data]);
  useLiveBus((m) => {
    if (m.t === 'presence') setPresence(m.visitors);
    if (m.t === 'event') softReload();
  }, [softReload]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { setWatching(false); }, [selected]);

  const pmap = useMemo(() => new Map(presence.map((p) => [p.sessionId, p])), [presence]);
  const sessions: any[] = (data.data?.sessions ?? []).filter((s: any) => showPreview || !s.preview);
  const sorted = [...sessions].sort((a, b) => Number(!!pmap.get(b.id)?.online) - Number(!!pmap.get(a.id)?.online));
  const online = presence.filter((p) => p.online && (showPreview || !p.preview)).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Live Visitors 🔴</h1>
          <p className="text-sm text-zinc-500">อัปเดตแบบ Real-Time ไม่ต้อง Refresh · Realtime: {live.status}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge color="green">🟢 ออนไลน์ {online}</Badge>
          <Badge>ทั้งหมด {sessions.length}</Badge>
          <div className="flex rounded-xl border border-zinc-300 bg-white p-0.5">
            <button className={`rounded-lg px-2.5 py-1 ${scope === 'recent' ? 'bg-pink-500 text-white' : ''}`} onClick={() => setScope('recent')}>24 ชม.</button>
            <button className={`rounded-lg px-2.5 py-1 ${scope === 'all' ? 'bg-pink-500 text-white' : ''}`} onClick={() => setScope('all')}>ทั้งหมด</button>
          </div>
          <label className="flex items-center gap-1"><input type="checkbox" checked={showPreview} onChange={(e) => setShowPreview(e.target.checked)} /> แสดง Preview</label>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <div className="space-y-2">
          {sorted.length === 0 && <Empty>ยังไม่มีผู้เข้าชม</Empty>}
          {sorted.map((s) => {
            const p = pmap.get(s.id);
            const st = statusOf(p, now);
            return (
              <button key={s.id} onClick={() => setParams({ s: s.id })}
                className={`block w-full rounded-2xl border bg-white p-3.5 text-left shadow-sm transition ${selected === s.id ? 'border-pink-400 ring-2 ring-pink-100' : 'border-zinc-200 hover:border-pink-200'}`}>
                <div className="flex items-center gap-2 text-sm">
                  <span>{DOT[st]}</span><span className="font-semibold">{s.device ?? 'Unknown'}</span>
                  <span className="text-xs text-zinc-500">{STATUS_TH[st]}</span>
                  {s.preview && <Badge color="violet">preview</Badge>}
                  {s.pendingRequests > 0 && <Badge color="violet">รออนุมัติ {s.pendingRequests}</Badge>}
                  <span className="ml-auto text-xs text-zinc-400">{s.invite ?? ''}</span>
                </div>
                <p className="mt-1 text-sm">
                  {p?.online ? <>📍 {pageLabel(p.page)} · {fmtDuration(now - p.pageSince)}</> : <span className="text-zinc-400">เห็นล่าสุด {fmtDateTime(s.lastSeenAt)}</span>}
                </p>
                <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5">ทาย {s.attemptsUsed} · เหลือ {s.attemptsLeft}</span>
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5">คำใบ้ {s.hintsUnlocked}/{s.hintsTotal}</span>
                  <span className={`rounded px-1.5 py-0.5 ${s.letterRead ? 'bg-emerald-100' : 'bg-zinc-100'}`}>💌 {s.letterRead ? 'อ่านแล้ว' : s.letterOpened ? 'เปิดแล้ว' : 'ยัง'}</span>
                  <span className={`rounded px-1.5 py-0.5 ${s.solved ? 'bg-emerald-100' : 'bg-zinc-100'}`}>🕵️ {s.solved ? 'ถูกแล้ว' : 'ยัง'}</span>
                  <span className={`rounded px-1.5 py-0.5 ${s.messageSent ? 'bg-emerald-100' : 'bg-zinc-100'}`}>💬 {s.messageSent ? 'ส่งแล้ว' : 'ยัง'}</span>
                  <span className={`rounded px-1.5 py-0.5 ${s.confessionOpened ? 'bg-pink-100' : 'bg-zinc-100'}`}>💖 {s.confessionOpened ? 'เปิดแล้ว' : 'ยัง'}</span>
                  {p?.online && <span className="rounded bg-zinc-100 px-1.5 py-0.5">⏱ {fmtDuration(now - p.connectedAt)}</span>}
                </div>
              </button>
            );
          })}
        </div>
        <div>
          {selected
            ? <Detail key={selected} id={selected} presence={pmap.get(selected)} now={now} watching={watching} setWatching={setWatching} />
            : <Empty>เลือกผู้เข้าชมทางซ้ายเพื่อดู Activity, Progress และ Watch Live</Empty>}
        </div>
      </div>
    </div>
  );
}
