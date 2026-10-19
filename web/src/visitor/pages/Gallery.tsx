import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { visitorApi } from '../../lib/api';
import { Lightbox } from '../components/Lightbox';
import { useVisitor } from '../context';
import type { PageProps } from '../MainFlow';
import { GiftButton, Page } from '../ui';

export const FRAMES: Record<string, string> = {
  pink: '#FFD6E7', lavender: '#E9D5FF', cream: '#FFF3D6', peach: '#FFD8C2', blue: '#DBEAFE', mint: '#D1FAE5', white: '#FFFFFF',
};
const TILTS = [-3, 2.5, -1.5, 3, -2.5, 1.5, -2, 2];

export function PhotoCard({ photo, index, onOpen }: { photo: any; index: number; onOpen: () => void }) {
  const tilt = TILTS[index % TILTS.length];
  const anim = photo.animation ?? 'float';
  const ratio = photo.width && photo.height ? photo.width / photo.height : 1;
  return (
    <motion.figure
      initial={anim === 'none' ? false : { opacity: 0, y: 40, scale: anim === 'pop' ? 0.6 : 0.95, rotate: 0 }}
      whileInView={{ opacity: 1, y: 0, scale: 1, rotate: tilt }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ type: 'spring', stiffness: 160, damping: 18, delay: (index % 4) * 0.08 }}
      whileHover={{ rotate: anim === 'tilt' ? -tilt : 0, scale: 1.04, zIndex: 5 }}
      className="relative mb-6 break-inside-avoid"
    >
      <button
        onClick={onOpen}
        className={`block w-full rounded-md p-2.5 pb-10 text-left shadow-[0_12px_30px_-12px_rgba(0,0,0,0.25)] ${anim === 'float' ? 'animate-float' : ''}`}
        style={{ background: FRAMES[photo.frame] ?? FRAMES.white, ['--r' as any]: '0deg', animationDelay: `${(index % 5) * 0.7}s` }}
        aria-label={photo.caption || `รูปที่ ${index + 1}`}
      >
        <img src={photo.url} alt={photo.caption ?? ''} loading="lazy" draggable={false}
          className="w-full rounded-sm bg-white object-cover" style={{ aspectRatio: String(Math.min(1.6, Math.max(0.6, ratio))) }} />
        {photo.caption && <figcaption className="absolute inset-x-3 bottom-2.5 truncate text-center font-letter text-ink/80">{photo.caption}</figcaption>}
      </button>
      {photo.sticker && <span className="pointer-events-none absolute -right-2 -top-3 text-3xl drop-shadow" style={{ transform: `rotate(${-tilt * 3}deg)` }}>{photo.sticker}</span>}
      {photo.isCover && <span className="pointer-events-none absolute -left-2 -top-3 rounded-full bg-primary px-2 py-0.5 text-xs text-white shadow">♡ cover</span>}
    </motion.figure>
  );
}

export default function GalleryPage({ onReread }: PageProps) {
  const { state, apply } = useVisitor();
  const nav = useNavigate();
  const g = state.gallery;
  const [idx, setIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!state.progress.galleryOpened) visitorApi.post('/api/progress', { event: 'gallery_opened' }).then((r) => apply(r.state)).catch(() => {});
  }, [state.progress.galleryOpened, apply]);

  if (!g) return null;
  const photos: any[] = [...g.photos].sort((a, b) => Number(b.isCover) - Number(a.isCover));
  const open = (i: number) => { setIdx(i); visitorApi.track('photo_open', { n: i + 1 }); };

  return (
    <Page className="!max-w-4xl">
      <motion.div initial={{ scale: 0.5, rotate: -10, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} className="mt-6 text-6xl animate-float">🎀</motion.div>
      <h1 className="mt-3 text-center font-heading text-3xl text-primary sm:text-4xl">{g.title}</h1>
      <p className="mt-3 text-center text-lg text-ink/80">{g.subtitle}</p>

      {photos.length === 0 ? (
        <p className="my-16 text-center text-ink/60">{g.emptyText}</p>
      ) : (
        <div className="mt-10 w-full columns-2 gap-5 px-1 sm:columns-3">
          {photos.map((p, i) => <PhotoCard key={p.id} photo={p} index={i} onOpen={() => open(i)} />)}
        </div>
      )}

      <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mt-10 flex flex-col items-center text-center">
        <p className="font-heading text-2xl text-primary">{g.endText1}</p>
        <p className="mt-2 max-w-md text-lg text-ink/80">{g.endText2}</p>
        <div className="mt-8 flex flex-col items-center gap-3">
          {state.pages?.confession && (
            <GiftButton onClick={() => nav('/yourmybestcrushever')} disabled={!state.progress.confessionAvailable} className="animate-glow">
              {g.confessionButton}
            </GiftButton>
          )}
          {state.pages?.letter && <button className="gift-btn-ghost" onClick={onReread}>{g.rereadButton}</button>}
        </div>
      </motion.div>

      <Lightbox items={photos.map((p) => ({ url: p.url, caption: p.caption }))} index={idx} onIndex={setIdx} onClose={() => setIdx(null)} />
    </Page>
  );
}
