import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { burst } from '../../lib/confetti';
import { sfx } from '../../lib/sfx';
import { timerValue, UNIT_LABELS, UNITS, type Duration, type TimerConfig, type Unit } from '../../lib/timer';

const easings: Record<string, (t: number) => number> = {
  fast: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)), // fast start, slows down at the end
  normal: (t) => 1 - Math.pow(1 - t, 3),
  slow: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
};

function Digit({ d, preset, spinning }: { d: string; preset: string; spinning: boolean }) {
  const flip = preset === 'flip';
  return (
    <span className="relative inline-block overflow-hidden" style={{ width: '0.62em', height: '1.15em', perspective: flip ? 300 : undefined }}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={d}
          className="absolute inset-0 text-center"
          style={{ filter: preset === 'slot' && spinning ? 'blur(1.2px)' : undefined }}
          initial={flip ? { rotateX: -90, opacity: 0 } : { y: '-100%', opacity: 0 }}
          animate={flip ? { rotateX: 0, opacity: 1 } : { y: '0%', opacity: 1 }}
          exit={flip ? { rotateX: 90, opacity: 0 } : { y: '100%', opacity: 0 }}
          transition={{ duration: spinning ? 0.09 : 0.35, ease: 'easeOut' }}
        >{d}</motion.span>
      </AnimatePresence>
    </span>
  );
}

function RollingNumber({ value, pad, preset, spinning }: { value: number; pad: number; preset: string; spinning: boolean }) {
  const s = String(Math.max(0, value)).padStart(pad, '0');
  return <span className="inline-flex tabular-nums">{s.split('').map((d, i) => <Digit key={s.length - i} d={d} preset={preset} spinning={spinning} />)}</span>;
}

const sizeClass: Record<string, string> = { md: 'text-3xl', lg: 'text-4xl sm:text-5xl', xl: 'text-5xl sm:text-6xl' };

export interface TimerProps {
  id: string;
  timer: TimerConfig & Record<string, any>;
  /** Changing this replays the count-up. */
  replayKey?: number;
}

export function LoveTimer({ id, timer, replayKey = 0 }: TimerProps) {
  const reduce = useReducedMotion();
  const units = UNITS.filter((u) => timer.units?.[u]);
  const shown: Unit[] = units.length ? units : ['seconds'];
  const a = timer.appearance ?? {};
  const seenKey = `gift_timer_seen_${id}`;
  const skip = useMemo(() => {
    if (reduce) return true;
    if (timer.animateEveryOpen !== false) return false;
    try { return localStorage.getItem(seenKey) === '1'; } catch { return false; }
  }, [reduce, timer.animateEveryOpen, seenKey, replayKey]);

  const [display, setDisplay] = useState<Duration>(() => (skip ? timerValue(timer).value : { years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 }));
  const [phase, setPhase] = useState<'running' | 'done'>(skip ? 'done' : 'running');
  const [reached, setReached] = useState(false);
  const raf = useRef<number>(0);

  // Count up from zero to the real value.
  useEffect(() => {
    if (skip && replayKey === 0) { setPhase('done'); setDisplay(timerValue(timer).value); return; }
    setPhase('running');
    const dur = Math.min(8, Math.max(1, Number(timer.runDuration) || 4)) * 1000;
    const ease = easings[timer.startSpeed] ?? easings.fast;
    const t0 = performance.now();
    let lastTick = 0;
    const frame = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const target = timerValue(timer).value;
      const e = ease(p);
      const v = {} as Duration;
      for (const u of UNITS) v[u] = Math.round(target[u] * e);
      setDisplay(v);
      if (timer.sound && now - lastTick > 90 && p < 1) { sfx.tick(); lastTick = now; }
      if (p < 1) raf.current = requestAnimationFrame(frame);
      else {
        setPhase('done');
        try { localStorage.setItem(seenKey, '1'); } catch { /* ignore */ }
        if (timer.confetti && timer.mode !== 'countdown') burst({ x: 0.5, y: 0.5 });
      }
    };
    raf.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayKey, JSON.stringify(timer)]);

  // Live and countdown modes keep ticking every second, always computed from the real start date.
  useEffect(() => {
    if (phase !== 'done' || (timer.mode !== 'live' && timer.mode !== 'countdown')) return;
    const tick = () => {
      const r = timerValue(timer);
      setDisplay(r.value);
      if (r.reached && !reached) {
        setReached(true);
        if (timer.mode === 'countdown' && timer.confetti) burst();
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, JSON.stringify(timer)]);

  const valid = timerValue(timer).valid;
  const cardStyle: CSSProperties = {
    color: a.numberColor || undefined,
    borderColor: a.borderColor || undefined,
    borderRadius: a.radius != null ? `${a.radius}px` : undefined,
    fontFamily: a.font ? `"${a.font}", var(--f-number)` : 'var(--f-number)',
    background: a.bgImageUrl ? `center/cover url("${a.bgImageUrl}")` : a.background || a.bgColor || undefined,
  };
  const neon = a.cardStyle === 'neon';
  const glow = a.glow !== false;

  if (!valid) return <p className="text-center text-sm text-ink/60">ยังไม่ได้ตั้งวันที่ของตัวนับเวลา</p>;

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        data-style={a.cardStyle === 'neon' ? 'solid' : a.cardStyle || 'glass'}
        className={`gift-card w-full px-3 py-4 ${neon ? '!bg-[#2a1636] !text-pink-200' : ''} ${glow ? 'animate-glow' : ''}`}
        style={cardStyle}
      >
        <motion.div
          className={`flex flex-wrap items-start justify-center gap-x-2 gap-y-3 font-semibold text-primary ${sizeClass[a.size] ?? sizeClass.lg}`}
          style={{
            color: a.numberColor || undefined,
            textShadow: glow || a.preset === 'glow' ? '0 0 18px rgb(var(--c-primary) / .55)' : undefined,
          }}
          animate={phase === 'done' && !reduce ? { scale: [1, 1.08, 0.98, 1] } : {}}
          transition={{ duration: 0.6 }}
        >
          {shown.map((u, i) => (
            <div key={u} className="flex items-start">
              <div className="flex flex-col items-center">
                <RollingNumber value={display[u]} pad={u === 'years' ? 1 : 2} preset={a.preset || 'rolling'} spinning={phase === 'running'} />
                <span className="mt-1 text-[10px] font-medium tracking-[0.18em] opacity-70 sm:text-xs" style={{ fontFamily: 'var(--f-body)' }}>
                  {UNIT_LABELS[u].en}
                </span>
              </div>
              {i < shown.length - 1 && <span className="mx-0.5 opacity-50">:</span>}
            </div>
          ))}
        </motion.div>
      </div>
      <AnimatePresence>
        {phase === 'done' && (timer.mode === 'countdown' ? reached && timer.reachedText : timer.afterText) && (
          <motion.p
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="text-center font-heading text-lg text-primary"
          >
            {timer.mode === 'countdown' ? timer.reachedText : timer.afterText}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
