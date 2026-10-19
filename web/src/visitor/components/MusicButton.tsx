import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { visitorApi } from '../../lib/api';
import { setSfxEnabled } from '../../lib/sfx';
import { useVisitor } from '../context';
import { musicPref } from '../music';

export function MusicButton() {
  const { music, state, live } = useVisitor();
  const snap = useSyncExternalStore(
    (cb) => music.subscribe(cb),
    () => `${music.on}|${music.playing}|${music.blocked}|${music.currentTitle}`,
  );
  const [askOpen, setAskOpen] = useState(false);
  const enabled = state.music?.enabled;

  useEffect(() => {
    setSfxEnabled(music.on);
    live.music(music.playing, music.currentTitle);
  }, [snap, music, live]);

  useEffect(() => {
    if (!enabled) return;
    if (musicPref() === null) {
      const t = setTimeout(() => setAskOpen(true), 1200);
      return () => clearTimeout(t);
    }
  }, [enabled]);

  // Remembered "on": resume on the first tap anywhere (browsers need a user gesture).
  useEffect(() => {
    if (!enabled || musicPref() !== 'on') return;
    const resume = () => { if (!music.playing) music.enable(); };
    window.addEventListener('pointerdown', resume, { once: true });
    return () => window.removeEventListener('pointerdown', resume);
  }, [enabled, music]);

  if (!enabled) return null;
  const playing = music.playing;

  return (
    <div className="fixed right-4 bottom-safe z-40 flex flex-col items-end gap-2">
      <AnimatePresence>
        {askOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="gift-card w-60 p-4 text-sm" data-style="glass"
          >
            <p className="mb-3 font-heading">{state.recipient?.soundPrompt ?? 'เปิดเสียงเพลงด้วยมั้ย? 🎵'}</p>
            <div className="flex gap-2">
              <button className="gift-btn !min-h-0 flex-1 !px-3 !py-2 !text-sm" onClick={() => { music.enable(); setAskOpen(false); visitorApi.track('music_on'); }}>เปิดเลย 🎶</button>
              <button className="gift-btn-ghost !min-h-0 flex-1 !px-3 !py-2 !text-sm" onClick={() => { music.disable(); setAskOpen(false); }}>ไม่เป็นไร</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button
        whileTap={{ scale: 0.9 }}
        aria-label={playing ? 'ปิดเพลง' : 'เปิดเพลง'}
        title={music.currentTitle ?? 'เพลง'}
        onClick={() => { music.toggle(); setAskOpen(false); visitorApi.track(music.on ? 'music_on' : 'music_off'); }}
        className={`relative grid h-14 w-14 place-items-center rounded-full bg-card/80 text-2xl shadow-soft backdrop-blur border border-line ${playing ? 'animate-glow' : ''}`}
      >
        <span className={playing ? 'animate-spin-slow inline-block' : ''}>{playing ? '🎵' : '🔇'}</span>
        {playing && (
          <>
            <span className="pointer-events-none absolute -top-2 left-1 text-xs animate-bounce-soft">♪</span>
            <span className="pointer-events-none absolute -top-3 right-1 text-sm animate-bounce-soft" style={{ animationDelay: '.5s' }}>♫</span>
          </>
        )}
      </motion.button>
    </div>
  );
}
