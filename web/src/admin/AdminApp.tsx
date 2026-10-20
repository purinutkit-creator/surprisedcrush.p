import { AnimatePresence, motion } from 'framer-motion';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { adminApi, ApiError } from '../lib/api';
import { sfx } from '../lib/sfx';
import { Btn } from './components/form';
import { eventLabel, notifyKey } from './events';
import { AdminContext, AdminLive, type Toast } from './store';

const Dashboard = lazy(() => import('./sections/Dashboard'));
const Recipient = lazy(() => import('./sections/Recipient'));
const Letter = lazy(() => import('./sections/Letter'));
const Game = lazy(() => import('./sections/Game'));
const Exchange = lazy(() => import('./sections/Exchange'));
const Messages = lazy(() => import('./sections/Messages'));
const Gallery = lazy(() => import('./sections/Gallery'));
const Selfie = lazy(() => import('./sections/Selfie'));
const Confession = lazy(() => import('./sections/Confession'));
const Music = lazy(() => import('./sections/Music'));
const Appearance = lazy(() => import('./sections/Appearance'));
const Website = lazy(() => import('./sections/Website'));
const Security = lazy(() => import('./sections/Security'));
const Live = lazy(() => import('./sections/Live'));
const Fyi = lazy(() => import('./sections/Fyi'));
const Simulator = lazy(() => import('./sections/Simulator'));

const BASE = '/surprisedmycrush';
const NAV: { to: string; label: string; icon: string }[] = [
  { to: '', label: 'Dashboard', icon: '📊' },
  { to: 'live', label: 'Live Visitors', icon: '🔴' },
  { to: 'simulator', label: 'ทดลองเล่น (Simulator)', icon: '🧪' },
  { to: 'recipient', label: 'Recipient Settings', icon: '🎂' },
  { to: 'letter', label: 'Birthday Letter', icon: '💌' },
  { to: 'game', label: 'Guessing Game', icon: '🕵️' },
  { to: 'exchange', label: 'Exchange & Missions', icon: '🎟️' },
  { to: 'messages', label: 'Messages Inbox', icon: '💬' },
  { to: 'gallery', label: 'Photo Gallery', icon: '📸' },
  { to: 'selfie', label: 'Selfie & ของที่ระลึก', icon: '🤳' },
  { to: 'confession', label: 'Confession Page', icon: '💖' },
  { to: 'fyi', label: 'FYI & Love Timer', icon: '💡' },
  { to: 'music', label: 'Music Manager', icon: '🎵' },
  { to: 'appearance', label: 'Appearance', icon: '🎨' },
  { to: 'website', label: 'Website Settings', icon: '⚙️' },
  { to: 'security', label: 'Security', icon: '🔐' },
];

function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await adminApi.post('/login', { password });
      onDone();
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-pink-100 via-white to-violet-100 p-5 font-admin">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-pink-100 bg-white/90 p-7 shadow-xl backdrop-blur">
        <div className="mb-4 text-center text-5xl">🔐</div>
        <h1 className="text-center text-xl font-semibold text-zinc-800">Surprised My Crush</h1>
        <p className="mb-6 text-center text-sm text-zinc-500">เข้าสู่ระบบหลังบ้านของ 1st Gift</p>
        <label className="mb-1 block text-sm font-medium text-zinc-700" htmlFor="pw">รหัสผ่าน</label>
        <input id="pw" type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100" />
        {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">{err}</p>}
        <button disabled={busy || !password} className="mt-5 w-full rounded-xl bg-pink-500 py-2.5 font-semibold text-white shadow hover:bg-pink-600 disabled:opacity-50">
          {busy ? 'กำลังตรวจสอบ…' : 'เข้าสู่ระบบ'}
        </button>
        <p className="mt-4 text-center text-xs text-zinc-400">ระบบจะล็อกชั่วคราวเมื่อใส่รหัสผิดหลายครั้ง</p>
      </form>
    </main>
  );
}

function Toasts({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  const nav = useNavigate();
  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-[100] flex w-[min(92vw,360px)] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} layout initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
            className={`pointer-events-auto flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm shadow-lg ${
              t.kind === 'error' ? 'border-red-200 bg-red-50 text-red-700' : t.kind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-pink-200 bg-white text-zinc-800'}`}>
            <span className="flex-1">{t.text}</span>
            {t.action && <button className="font-semibold text-pink-600 underline" onClick={() => { nav(t.action!.to); dismiss(t.id); }}>{t.action.label}</button>}
            <button className="text-zinc-400 hover:text-zinc-700" onClick={() => dismiss(t.id)} aria-label="ปิด">✕</button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function Shell({ me, setMe, onLogout }: { me: any; setMe: (m: any) => void; onLogout: () => void }) {
  const [content, setContent] = useState<any>(null);
  const [dirty, setDirty] = useState(false);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [unread, setUnread] = useState(0);
  const [pending, setPending] = useState(0);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [liveStatus, setLiveStatus] = useState('connecting');
  const live = useMemo(() => new AdminLive(), []);
  const loc = useLocation();
  const prefsRef = useRef(me.prefs);
  prefsRef.current = me.prefs;

  const toast = useCallback((text: string, kind: Toast['kind'] = 'info', action?: Toast['action']) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-4), { id, text, kind, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 4500);
  }, []);

  const reloadContent = useCallback(async () => {
    const c = await adminApi.get('/content');
    setContent(c);
    setDirty(c.dirty);
    setPublishedAt(c.publishedAt);
  }, []);

  const refreshCounts = useCallback(async () => {
    try {
      const s = await adminApi.get('/stats');
      setUnread(s.unread);
      setPending(s.pending_requests);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { reloadContent(); refreshCounts(); }, [reloadContent, refreshCounts]);
  useEffect(() => { setMenu(false); }, [loc.pathname]);

  // Realtime notifications.
  useEffect(() => {
    live.connect();
    const off = live.on((m) => {
      if (m.t === '_status') setLiveStatus(live.status);
      const prefs = prefsRef.current ?? {};
      if (m.t === 'message_new') {
        refreshCounts();
        if (prefs.events?.message_sent !== false) {
          toast(m.preview ? '💌 ข้อความทดสอบใหม่จากโหมด Preview' : '💌 มีข้อความใหม่จากเขา!', 'info', { label: 'อ่านเลย', to: `${BASE}/messages${m.preview ? '?test=1' : ''}` });
          if (prefs.sound) sfx.chime();
          if (prefs.desktop && 'Notification' in window && Notification.permission === 'granted') new Notification('💌 มีข้อความใหม่จากเขา!');
        }
      }
      if (m.t === 'requests_changed') refreshCounts();
      if (m.t === 'selfie_new') {
        toast(m.preview ? '🤳 มีรูปเซลฟี่ทดสอบส่งเข้ามา' : '🤳 เขาส่งรูปเซลฟี่มาให้!', 'info', { label: 'ดูเลย', to: `${BASE}/selfie${m.preview ? '?test=1' : ''}` });
        if (prefs.sound) sfx.chime();
      }
      if (m.t === 'event' && !m.preview) {
        const key = notifyKey(m.event);
        if (key && key !== 'message_sent' && prefs.events?.[key]) {
          toast(`🔔 ${eventLabel(m.event)}`, 'info', { label: 'ดูสด', to: `${BASE}/live?s=${m.sessionId}` });
          if (prefs.sound) sfx.chime();
          if (prefs.desktop && 'Notification' in window && Notification.permission === 'granted') new Notification('1st Gift', { body: eventLabel(m.event) });
        }
      }
    });
    return () => { off(); live.close(); };
  }, [live, toast, refreshCounts]);

  const publish = async () => {
    if (!confirm('Publish การเปลี่ยนแปลงทั้งหมดให้หน้าเว็บจริงเห็นเลยมั้ย?')) return;
    setBusy(true);
    try {
      await adminApi.post('/publish');
      await reloadContent();
      toast('🚀 Publish แล้ว! หน้าเว็บจริงอัปเดตเรียบร้อย', 'ok');
    } catch (e: any) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const discard = async () => {
    if (!confirm('ทิ้งการแก้ไขทั้งหมดที่ยังไม่ Publish และกลับไปใช้เวอร์ชันล่าสุดที่เผยแพร่อยู่?')) return;
    await adminApi.post('/discard');
    await reloadContent();
    toast('ย้อนกลับเป็นเวอร์ชันที่ Publish ล่าสุดแล้ว', 'ok');
  };
  const resetPreview = async () => {
    await adminApi.post('/preview/reset', {});
    toast('รีเซ็ตความคืบหน้าในโหมด Preview แล้ว', 'ok');
  };
  const logout = async () => {
    await adminApi.post('/logout').catch(() => {});
    onLogout();
  };

  if (!content) return <div className="grid min-h-[100dvh] place-items-center font-admin text-zinc-500">กำลังโหลด…</div>;

  const ctx = {
    content, dirty, publishedAt, reloadContent, setDirty, toast, me, live, unread, setUnread, pending, setPending,
    setSection: (name: string, data: any) => setContent((c: any) => ({ ...c, sections: { ...c.sections, [name]: data } })),
    setList: (name: string, items: any[]) => setContent((c: any) => ({ ...c, lists: { ...c.lists, [name]: items } })),
    setPrefs: async (prefs: any) => {
      const res = await adminApi.put('/prefs', prefs);
      setMe({ ...me, prefs: res.prefs });
    },
  };

  const badge = (to: string) => (to === 'messages' && unread ? unread : to === 'exchange' && pending ? pending : 0);

  return (
    <AdminContext.Provider value={ctx}>
      <div className="min-h-[100dvh] bg-zinc-50 font-admin text-zinc-800">
        <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-zinc-200 bg-white transition-transform lg:translate-x-0 ${menu ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex h-16 items-center gap-2 border-b border-zinc-100 px-5">
            <span className="text-2xl">🎁</span>
            <div>
              <p className="text-sm font-semibold leading-tight">1st Gift</p>
              <p className="text-xs text-zinc-500">Surprised My Crush</p>
            </div>
          </div>
          <nav className="h-[calc(100dvh-8rem)] space-y-0.5 overflow-y-auto p-3">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to ? `${BASE}/${n.to}` : BASE} end={!n.to}
                className={({ isActive }) => `flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${isActive ? 'bg-pink-50 font-semibold text-pink-700' : 'text-zinc-600 hover:bg-zinc-50'}`}>
                <span className="w-5 text-center">{n.icon}</span>
                <span className="flex-1">{n.label}</span>
                {badge(n.to) > 0 && <span className="rounded-full bg-pink-500 px-1.5 py-0.5 text-[11px] font-bold text-white">{badge(n.to)}</span>}
              </NavLink>
            ))}
          </nav>
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between border-t border-zinc-100 p-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${liveStatus === 'online' ? 'bg-emerald-500' : liveStatus === 'connecting' ? 'bg-amber-400' : 'bg-zinc-400'}`} />
              Realtime {liveStatus === 'online' ? 'เชื่อมต่อแล้ว' : liveStatus === 'connecting' ? 'กำลังเชื่อมต่อ…' : 'หลุด (กำลังต่อใหม่)'}
            </span>
            <button onClick={logout} className="rounded-lg px-2 py-1 hover:bg-zinc-100">Logout</button>
          </div>
        </aside>
        {menu && <div className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={() => setMenu(false)} />}

        <div className="lg:pl-64">
          <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
            <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 sm:px-6">
              <button className="rounded-lg p-2 text-xl lg:hidden" onClick={() => setMenu(true)} aria-label="เมนู">☰</button>
              <div className="mr-auto min-w-0 text-sm">
                {dirty
                  ? <span className="font-medium text-amber-700">● มี Draft ที่ยังไม่ Publish</span>
                  : <span className="text-emerald-700">✓ หน้าเว็บจริงเป็นเวอร์ชันล่าสุด</span>}
                {publishedAt && <span className="ml-2 hidden text-xs text-zinc-400 sm:inline">Publish ล่าสุด {new Date(publishedAt).toLocaleString('th-TH')}</span>}
              </div>
              <a href="/?preview=1" target="_blank" rel="noreferrer"><Btn>👀 Preview Website</Btn></a>
              <Btn onClick={resetPreview} title="ล้างความคืบหน้าใน Preview">↺ Reset Preview</Btn>
              {dirty && <Btn kind="ghost" onClick={discard}>ทิ้ง Draft</Btn>}
              <Btn kind="primary" onClick={publish} disabled={busy || !dirty}>🚀 Publish Changes</Btn>
              <a href="/?preview=0" target="_blank" rel="noreferrer"><Btn kind="ghost">🌐 View Live</Btn></a>
            </div>
          </header>
          {me.passwordIsInitial && (
            <div className="mx-4 mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 sm:mx-6">
              ⚠️ ยังใช้รหัสผ่านเริ่มต้นอยู่ แนะนำให้เปลี่ยนก่อนส่งลิงก์ให้เขานะ — <Link className="font-semibold underline" to={`${BASE}/security`}>เปลี่ยนรหัสผ่าน</Link>
            </div>
          )}
          <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
            <Suspense fallback={<p className="py-10 text-center text-zinc-400">กำลังโหลด…</p>}>
              <Routes>
                <Route index element={<Dashboard />} />
                <Route path="live" element={<Live />} />
                <Route path="simulator" element={<Simulator />} />
                <Route path="recipient" element={<Recipient />} />
                <Route path="letter" element={<Letter />} />
                <Route path="game" element={<Game />} />
                <Route path="exchange" element={<Exchange />} />
                <Route path="messages" element={<Messages />} />
                <Route path="gallery" element={<Gallery />} />
                <Route path="selfie" element={<Selfie />} />
                <Route path="confession" element={<Confession />} />
                <Route path="fyi" element={<Fyi />} />
                <Route path="music" element={<Music />} />
                <Route path="appearance" element={<Appearance />} />
                <Route path="website" element={<Website />} />
                <Route path="security" element={<Security />} />
                <Route path="*" element={<Navigate to={BASE} replace />} />
              </Routes>
            </Suspense>
          </main>
        </div>
        <Toasts toasts={toasts} dismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
      </div>
    </AdminContext.Provider>
  );
}

export default function AdminApp() {
  const [me, setMe] = useState<any>(undefined);
  const check = useCallback(async () => {
    try { setMe(await adminApi.get('/me')); } catch { setMe(null); }
  }, []);
  useEffect(() => {
    document.title = 'Admin · 1st Gift';
    check();
  }, [check]);
  if (me === undefined) return <div className="grid min-h-[100dvh] place-items-center font-admin text-zinc-500">กำลังโหลด…</div>;
  if (!me) return <Login onDone={check} />;
  return <Shell me={me} setMe={setMe} onLogout={() => setMe(null)} />;
}

export { BASE };
