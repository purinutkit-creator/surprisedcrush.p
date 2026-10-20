import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { ApiError, visitorApi } from '../lib/api';
import { applyThemeToRoot } from '../lib/theme';
import { Background } from './components/Background';
import { ConsentBanner, LiveIndicator } from './components/ConsentBanner';
import { GiftLoader } from './components/GiftLoader';
import { MusicButton } from './components/MusicButton';
import { PreviewBar } from './components/PreviewBar';
import { SurpriseLayer } from './components/SurpriseLayer';
import { TipsButton } from './components/Tips';
import { Ctx, type VisitorState } from './context';
import { LiveClient } from './live';
import { MusicController } from './music';

function Notice({ title, message, footer, onRetry }: { title: string; message: string; footer?: string; onRetry?: () => void }) {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center gift-bg">
      <div className="text-6xl animate-float">🎁</div>
      <h1 className="font-heading text-2xl text-primary">{title}</h1>
      <p className="max-w-sm text-ink/75">{message}</p>
      {onRetry && <button className="gift-btn" onClick={onRetry}>ลองอีกครั้ง 💗</button>}
      {footer && <p className="mt-8 text-xs text-ink/50">{footer}</p>}
    </main>
  );
}

export default function VisitorShell() {
  const [state, setState] = useState<VisitorState | null>(null);
  const [gate, setGate] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPageState] = useState('welcome');
  const music = useMemo(() => new MusicController(), []);
  const live = useMemo(() => new LiveClient(), []);
  const stateRef = useRef<VisitorState | null>(null);

  const apply = useCallback((s: any) => {
    if (s?.closed || s?.blocked) { setGate(s); return; }
    setGate(null);
    stateRef.current = s;
    setState(s);
  }, []);

  const reload = useCallback(async () => {
    try {
      setError(null);
      apply(await visitorApi.get('/api/state'));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'โหลดไม่สำเร็จ');
    }
  }, [apply]);

  useEffect(() => { reload(); }, [reload]);

  // Realtime link (after the server has given us a session cookie).
  const sessionId = state?.sessionId;
  useEffect(() => {
    if (!sessionId) return;
    live.connect();
    const off = live.on((m) => { if (m.t === 'refresh') reload(); });
    const onAct = () => live.activity();
    window.addEventListener('pointerdown', onAct, { passive: true });
    window.addEventListener('scroll', onAct, { passive: true });
    window.addEventListener('keydown', onAct);
    const vis = () => { if (document.visibilityState === 'visible') reload(); };
    document.addEventListener('visibilitychange', vis);
    return () => {
      off();
      live.close();
      window.removeEventListener('pointerdown', onAct);
      window.removeEventListener('scroll', onAct);
      window.removeEventListener('keydown', onAct);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [sessionId, live, reload]);

  useEffect(() => () => music.destroy(), [music]);

  // Whether the admin's live replay masks what the recipient types (off by default now).
  useEffect(() => { live.maskInputs = !!state?.tracking?.maskInputs; }, [state?.tracking?.maskInputs, live]);

  const setPage = useCallback((p: string) => {
    setPageState(p);
    live.setPage(p);
    visitorApi.track('page_view', { page: p });
  }, [live]);

  // Theme and document title.
  useEffect(() => {
    if (!state) return;
    applyThemeToRoot(state.theme);
    if (state.mode === 'preview') document.title = `🧪 Preview · ${state.site?.siteName ?? ''}`;
  }, [state?.theme, state?.mode]);

  // Pick the track for the current page; same track = keeps playing.
  useEffect(() => {
    const m = state?.music;
    if (!m) return;
    music.configure({ volume: m.defaultVolume, loop: m.loop, fadeMs: m.fadeMs });
    if (!m.enabled) { music.setTrack(null); return; }
    const pick = m.pageTracks?.[page];
    const id = pick === 'none' ? null : pick || m.mainTrackId || m.tracks[0]?.id;
    const t = m.tracks.find((x: any) => x.id === id);
    music.setTrack(t?.url ?? null, t?.title ?? null);
  }, [state?.music, page, music]);

  if (gate) return <Notice title={gate.title} message={gate.message} footer={gate.site?.footerText} />;
  if (error && !state) return <Notice title="อุ๊ย โหลดไม่สำเร็จ 🥺" message={error} onRetry={reload} />;
  if (!state) return <GiftLoader full />;

  const anim = state.theme?.animations ?? {};
  return (
    <Ctx.Provider value={{ state, apply, reload, setPage, page, music, live }}>
      <Background
        hearts={anim.floatingHearts !== false} stars={anim.stars !== false} sparkles={anim.sparkles !== false}
        particles={anim.particles !== false} intensity={anim.intensity} dreamy={page === 'confession'}
      />
      {state.theme?.background?.type === 'image' && state.theme.background.imageUrl && (
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-20 bg-cover bg-center opacity-60" style={{ backgroundImage: `url("${state.theme.background.imageUrl}")` }} />
      )}
      <Outlet />
      {state.site?.footerText && (
        <footer className="relative -mt-20 px-24 pb-safe text-center text-[11px] text-ink/40">{state.site.footerText}</footer>
      )}
      <MusicButton />
      <TipsButton fyi={state.fyi} page={page} />
      <ConsentBanner />
      <LiveIndicator />
      <SurpriseLayer />
      <PreviewBar />
    </Ctx.Provider>
  );
}
