import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { visitorApi } from '../../lib/api';
import { RichText, Typewriter } from '../../lib/text';
import { Lightbox } from './Lightbox';
import { LoveTimer } from './LoveTimer';

const sizes: Record<string, string> = { sm: 'text-base', md: 'text-lg', lg: 'text-xl', xl: 'text-2xl' };
const imgAnim: Record<string, any> = {
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 } },
  zoom: { initial: { opacity: 0, scale: 0.8 }, animate: { opacity: 1, scale: 1 } },
  float: { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: [0, -8, 0] }, transition: { y: { repeat: Infinity, duration: 4 } } },
  rotate: { initial: { opacity: 0, rotate: -12 }, animate: { opacity: 1, rotate: -3 } },
};

function Lines({ text, typewriter, speed, lineByLine }: { text: string; typewriter: boolean; speed: number; lineByLine: boolean }) {
  const lines = String(text ?? '').split('\n');
  const [shown, setShown] = useState(lineByLine ? 1 : lines.length);
  useEffect(() => { setShown(lineByLine ? 1 : lines.length); }, [text, lineByLine, lines.length]);
  useEffect(() => {
    if (!lineByLine || typewriter || shown >= lines.length) return;
    const t = setTimeout(() => setShown((s) => s + 1), 900);
    return () => clearTimeout(t);
  }, [shown, lineByLine, typewriter, lines.length]);

  if (!lineByLine) return typewriter ? <Typewriter text={text} speed={speed} /> : <RichText text={text} />;
  return (
    <div className="space-y-1">
      {lines.slice(0, shown).map((l, i) => (
        <motion.p key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          {typewriter ? <Typewriter text={l} speed={speed} onDone={() => i === shown - 1 && setShown((s) => Math.min(lines.length, s + 1))} /> : <RichText text={l} />}
        </motion.p>
      ))}
    </div>
  );
}

export function FyiCard({ item, index, total, replayKey, onZoom }: { item: any; index: number; total: number; replayKey: number; onZoom: (url: string, caption?: string) => void }) {
  const showImage = (item.kind === 'image' || item.kind === 'mixed') && item.imageUrl;
  const showTimer = item.kind === 'timer' || item.kind === 'mixed';
  const anim = imgAnim[item.imageAnimation] ?? imgAnim.fade;
  return (
    <div
      className="relative flex flex-col gap-4 overflow-hidden rounded-[calc(var(--radius)-6px)] border border-line bg-card/90 p-5"
      style={item.bgImageUrl ? { background: `linear-gradient(rgb(var(--c-card)/.8), rgb(var(--c-card)/.88)), center/cover url("${item.bgImageUrl}")` } : undefined}
    >
      <div className="flex items-center justify-between">
        <span className="font-number text-sm font-semibold tracking-widest text-primary">{String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
        {item.sticker && <span className="text-2xl animate-float">{item.sticker}</span>}
      </div>
      {item.heading && <h3 className="font-heading text-xl text-primary">{item.heading}</h3>}
      {item.description && <p className="text-sm text-ink/70">{item.description}</p>}
      {item.text && (
        <div
          className={`${sizes[item.textSize] ?? sizes.md} leading-relaxed`}
          style={{ color: item.textColor || undefined, fontFamily: item.font ? `"${item.font}", var(--f-body)` : undefined }}
        >
          <Lines key={replayKey} text={item.text} typewriter={item.typewriter} speed={item.typewriterSpeed} lineByLine={item.lineByLine} />
        </div>
      )}
      {showImage && (
        <motion.button
          key={`img${replayKey}`}
          {...anim}
          transition={{ duration: 0.6, ...(anim.transition ?? {}) }}
          onClick={() => onZoom(item.imageUrl, item.caption)}
          className={`mx-auto block ${item.polaroid ? 'rotate-[-2deg] bg-white p-2 pb-8 shadow-lg' : ''} max-w-[85%] rounded-md`}
        >
          <img src={item.imageUrl} alt={item.caption ?? ''} className="max-h-64 w-full rounded object-cover" loading="lazy" />
          {item.caption && <span className={`block pt-2 font-letter text-sm text-ink/80 ${item.polaroid ? '' : 'text-center'}`}>{item.caption}</span>}
        </motion.button>
      )}
      {showTimer && <LoveTimer id={item.id} timer={item.timer} replayKey={replayKey} />}
    </div>
  );
}

export function TipsModal({ fyi, open, onClose }: { fyi: any; open: boolean; onClose: () => void }) {
  const items: any[] = fyi?.items ?? [];
  const [i, setI] = useState(0);
  const [replay, setReplay] = useState(0);
  const [zoom, setZoom] = useState<{ url: string; caption?: string } | null>(null);
  const display = fyi?.display ?? 'carousel';
  useEffect(() => { if (open) { setI(0); setReplay((r) => r + 1); } }, [open]);
  useEffect(() => { if (open && items[i]) visitorApi.track('fyi_item', { n: i + 1 }); }, [i, open]);

  const go = (d: number) => setI((x) => Math.min(items.length - 1, Math.max(0, x + d)));
  const hasTimer = items.some((x) => x.kind === 'timer' || x.kind === 'mixed');

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[75] flex items-end justify-center bg-ink/30 backdrop-blur-md sm:items-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
            <motion.div
              role="dialog" aria-label={fyi.title}
              className="gift-card relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-b-none p-5 pb-safe sm:rounded-b-[var(--radius)]"
              data-style="solid"
              initial={{ y: 80, scale: 0.92, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 80, scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 24, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line sm:hidden" />
              <button aria-label="ปิด" onClick={onClose} className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-secondary/60 text-ink">✕</button>
              <h2 className="pr-10 font-heading text-2xl text-primary">{fyi.title}</h2>
              <p className="mb-4 text-ink/70">{fyi.subtitle}</p>

              {display === 'stories' && items.length > 0 && (
                <div className="mb-3 flex gap-1">
                  {items.map((_, k) => <span key={k} className={`h-1 flex-1 rounded-full ${k <= i ? 'bg-primary' : 'bg-line'}`} />)}
                </div>
              )}

              <div className="no-scrollbar -mx-1 flex-1 overflow-y-auto px-1">
                {items.length === 0 && <p className="py-8 text-center text-ink/60">ยังไม่มีเรื่องเล่าตอนนี้น้า 🤭</p>}
                {display === 'list' ? (
                  <div className="space-y-4">
                    {items.map((it, k) => (
                      <motion.div key={it.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: k * 0.08 }}>
                        <FyiCard item={it} index={k} total={items.length} replayKey={replay} onZoom={(url, caption) => setZoom({ url, caption })} />
                      </motion.div>
                    ))}
                  </div>
                ) : items[i] && (
                  <div className="relative">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={items[i].id}
                        initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
                        transition={{ duration: 0.3 }}
                        drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.5}
                        onDragEnd={(_, info) => { if (info.offset.x < -50) go(1); else if (info.offset.x > 50) go(-1); }}
                      >
                        <FyiCard item={items[i]} index={i} total={items.length} replayKey={replay} onZoom={(url, caption) => setZoom({ url, caption })} />
                      </motion.div>
                    </AnimatePresence>
                    {display === 'stories' && (
                      <>
                        <button aria-label="ก่อนหน้า" className="absolute inset-y-0 left-0 w-1/4" onClick={() => go(-1)} />
                        <button aria-label="ถัดไป" className="absolute inset-y-0 right-0 w-1/4" onClick={() => go(1)} />
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                {display !== 'list' ? (
                  <>
                    <button className="gift-btn-ghost !min-h-[44px] !px-4" disabled={i === 0} onClick={() => go(-1)}>‹ Previous</button>
                    {hasTimer && <button className="gift-btn-ghost !min-h-[44px] !px-3" onClick={() => setReplay((r) => r + 1)} aria-label="Replay">↻</button>}
                    {i < items.length - 1
                      ? <button className="gift-btn !min-h-[44px] !px-5 !text-base" onClick={() => go(1)}>Next ›</button>
                      : <button className="gift-btn !min-h-[44px] !px-5 !text-base" onClick={onClose}>ปิด 💗</button>}
                  </>
                ) : (
                  <>
                    {hasTimer && <button className="gift-btn-ghost !min-h-[44px]" onClick={() => setReplay((r) => r + 1)}>↻ Replay</button>}
                    <button className="gift-btn ml-auto !min-h-[44px] !text-base" onClick={onClose}>ปิด 💗</button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <Lightbox items={zoom ? [zoom] : []} index={zoom ? 0 : null} onIndex={() => {}} onClose={() => setZoom(null)} />
    </>
  );
}

export function TipsButton({ fyi, page }: { fyi: any; page: string }) {
  const [open, setOpen] = useState(false);
  if (!fyi?.enabled || !fyi.pages?.[page] || !(fyi.items?.length > 0)) return null;
  return (
    <>
      <motion.button
        initial={{ scale: 0 }} animate={{ scale: 1 }} whileTap={{ scale: 0.9 }}
        onClick={() => { setOpen(true); visitorApi.track('fyi_open', { page }); }}
        className="fixed left-4 bottom-safe z-40 flex h-14 items-center gap-1 rounded-full border border-line bg-card/85 px-4 font-button text-primary shadow-soft backdrop-blur animate-bounce-soft"
      >
        {fyi.buttonLabel || 'TIPS 💡'}
      </motion.button>
      <TipsModal fyi={fyi} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
