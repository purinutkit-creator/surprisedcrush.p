import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { visitorApi } from '../../lib/api';
import { burst, celebrate } from '../../lib/confetti';
import { Typewriter } from '../../lib/text';
import { GiftLoader } from '../components/GiftLoader';
import { useVisitor } from '../context';
import { GiftButton, Page } from '../ui';

function Falling({ kind }: { kind: string }) {
  const chars = kind === 'flowers' ? ['🌸', '🌷', '💮', '🌼'] : kind === 'stars' ? ['⭐', '✨', '🌟'] : ['💗', '💖', '💕'];
  const items = useMemo(() => Array.from({ length: 14 }, (_, i) => ({
    left: (i * 61) % 100, size: 16 + ((i * 7) % 16), dur: 9 + (i % 5) * 2, delay: -(i * 1.3), dx: ((i % 3) - 1) * 60,
  })), []);
  return (
    <div aria-hidden className="particles pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {items.map((it, i) => (
        <span key={i} className="absolute top-0" style={{
          left: `${it.left}%`, fontSize: it.size, animation: `fall ${it.dur}s linear ${it.delay}s infinite`, ['--dx' as any]: `${it.dx}px`,
        }}>{chars[i % chars.length]}</span>
      ))}
    </div>
  );
}

/** The confession scene. Used by the real page and by the admin preview. */
export function ConfessionView({ data, onBack }: { data: any; onBack?: () => void }) {
  const [round, setRound] = useState(0);
  const [shown, setShown] = useState(1);
  const [titleDone, setTitleDone] = useState(false);
  const lines: string[] = data.lines ?? [];
  const finished = titleDone && shown > lines.length;

  useEffect(() => { setShown(1); setTitleDone(false); }, [round, data]);
  useEffect(() => { if (finished && data.confetti) celebrate(); }, [finished, data.confetti]);

  const lineDone = (i: number) => {
    const isBig = lines[i]?.startsWith('# ');
    if (isBig && data.confetti) burst({ x: 0.5, y: 0.45 });
    setTimeout(() => setShown((s) => Math.max(s, i + 2)), Math.max(200, Number(data.lineDelay) || 1600));
  };

  return (
    <>
      <Falling kind={data.animation} />
      <div className="relative z-10 flex w-full flex-col items-center text-center font-confession">
        <motion.div key={`heart${round}`} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }}
          className="mt-8 text-7xl drop-shadow-[0_0_25px_rgb(var(--c-primary)/0.6)] animate-heartbeat">💖</motion.div>
        <h1 className="mt-6 min-h-[3.5rem] font-confession text-3xl leading-snug text-primary sm:text-4xl">
          <Typewriter key={`t${round}`} text={data.title} speed={45} onDone={() => setTimeout(() => setTitleDone(true), 700)} />
        </h1>
        <div className="mt-8 w-full space-y-5">
          {titleDone && lines.slice(0, shown).map((l, i) => {
            const big = l.startsWith('# ');
            const text = big ? l.slice(2) : l;
            return (
              <motion.p key={`${round}-${i}`} initial={{ opacity: 0, y: 14, scale: big ? 0.8 : 1 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6 }}
                className={big ? 'py-4 font-confession text-4xl font-bold text-primary drop-shadow-[0_0_18px_rgb(var(--c-primary)/0.45)] sm:text-5xl' : 'text-xl leading-relaxed text-ink/90'}>
                <Typewriter text={text} speed={big ? Math.max(40, data.typewriterSpeed * 1.4) : data.typewriterSpeed} onDone={() => lineDone(i)} caret={!big} />
              </motion.p>
            );
          })}
        </div>
        <AnimatePresence>
          {finished && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mt-12 flex w-full flex-col items-center">
              {(data.images ?? []).length > 0 && (
                <div className="mb-10 flex flex-wrap justify-center gap-5">
                  {data.images.map((u: string, i: number) => (
                    <motion.img key={u} src={u} alt="" initial={{ opacity: 0, rotate: 0, scale: 0.7 }} animate={{ opacity: 1, rotate: i % 2 ? 4 : -4, scale: 1 }}
                      transition={{ delay: 0.3 + i * 0.2, type: 'spring' }}
                      className="w-40 rounded-md bg-white p-2 pb-8 shadow-xl sm:w-52" />
                  ))}
                </div>
              )}
              <div className="relative mb-8 text-[7rem] leading-none animate-heartbeat" aria-hidden>💗</div>
              <p className="max-w-md text-lg text-ink/85">{data.endText}</p>
              <div className="mt-8 flex flex-col items-center gap-3">
                {data.showReplayButton && (
                  <GiftButton onClick={() => { setRound((r) => r + 1); visitorApi.track('confession_replay'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                    {data.replayButton}
                  </GiftButton>
                )}
                {onBack && <button className="gift-btn-ghost" onClick={onBack}>{data.backButton}</button>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

export default function ConfessionPage() {
  const { setPage, apply } = useVisitor();
  const nav = useNavigate();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { setPage('confession'); }, [setPage]);
  useEffect(() => {
    visitorApi.get('/api/confession')
      .then((r) => { if (r.closed || r.blocked) { apply(r); return; } setData(r.confession); if (r.state) apply(r.state); })
      .catch((e) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (err) return <Page className="justify-center"><p className="text-center text-primary">{err}</p></Page>;
  if (!data) return <GiftLoader full label="กำลังเตรียมความลับ…" />;
  if (data.locked) {
    return (
      <Page className="justify-center text-center">
        <div className="text-7xl animate-float">🤫</div>
        <h1 className="mt-6 font-heading text-3xl text-primary">{data.lockedTitle}</h1>
        <p className="mt-3 max-w-sm text-lg text-ink/80">{data.lockedText}</p>
        <GiftButton className="mt-8" onClick={() => nav('/')}>กลับไปเปิดของขวัญ 🎁</GiftButton>
      </Page>
    );
  }
  return (
    <Page>
      <ConfessionView data={data} onBack={() => nav('/')} />
    </Page>
  );
}
