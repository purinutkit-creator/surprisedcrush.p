import { useEffect, useRef, useState } from 'react';

export interface Frame {
  style: 'polaroid' | 'hearts' | 'pastel' | 'none' | 'custom';
  imageUrl?: string | null;
  color?: string;
  caption?: string;
}

const SIZE = 1080;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });

/** Draw the chosen decorative frame on top of the captured square photo. */
async function drawFrame(ctx: CanvasRenderingContext2D, frame: Frame) {
  const color = frame.color || '#FF82AB';
  if (frame.style === 'custom' && frame.imageUrl) {
    try { ctx.drawImage(await loadImage(frame.imageUrl), 0, 0, SIZE, SIZE); } catch { /* ignore missing overlay */ }
    return;
  }
  if (frame.style === 'polaroid') {
    const b = SIZE * 0.045;
    ctx.lineWidth = b * 2;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(b, b, SIZE - b * 2, SIZE - b * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, SIZE - SIZE * 0.17, SIZE, SIZE * 0.17);
    ctx.fillRect(0, 0, b, SIZE); ctx.fillRect(SIZE - b, 0, b, SIZE); ctx.fillRect(0, 0, SIZE, b);
    if (frame.caption) {
      ctx.fillStyle = color;
      ctx.font = `600 ${SIZE * 0.07}px Mali, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(frame.caption, SIZE / 2, SIZE - SIZE * 0.085, SIZE * 0.86);
    }
  } else if (frame.style === 'hearts') {
    ctx.lineWidth = SIZE * 0.03;
    ctx.strokeStyle = color;
    roundRect(ctx, SIZE * 0.03, SIZE * 0.03, SIZE * 0.94, SIZE * 0.94, SIZE * 0.08);
    ctx.stroke();
    ctx.font = `${SIZE * 0.09}px serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    const pad = SIZE * 0.09;
    ctx.fillText('💗', pad, pad); ctx.fillText('💗', SIZE - pad, pad);
    ctx.fillText('🎀', pad, SIZE - pad); ctx.fillText('💗', SIZE - pad, SIZE - pad);
    if (frame.caption) { ctx.fillStyle = color; ctx.font = `600 ${SIZE * 0.06}px Mali, sans-serif`; ctx.fillText(frame.caption, SIZE / 2, SIZE * 0.1, SIZE * 0.7); }
  } else if (frame.style === 'pastel') {
    ctx.lineWidth = SIZE * 0.05;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, SIZE - ctx.lineWidth, SIZE - ctx.lineWidth);
    ctx.globalAlpha = 1;
    if (frame.caption) { ctx.fillStyle = color; ctx.font = `600 ${SIZE * 0.06}px Mali, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(frame.caption, SIZE / 2, SIZE - SIZE * 0.08, SIZE * 0.8); }
  }
}

/** CSS overlay that previews the frame live over the camera. */
export function FrameOverlay({ frame }: { frame: Frame }) {
  if (frame.style === 'custom' && frame.imageUrl) {
    return <img src={frame.imageUrl} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />;
  }
  const color = frame.color || '#FF82AB';
  if (frame.style === 'polaroid') {
    return (
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 border-[14px] border-white" />
        <div className="absolute inset-x-0 bottom-0 flex h-[17%] items-center justify-center bg-white font-heading" style={{ color }}>{frame.caption}</div>
      </div>
    );
  }
  if (frame.style === 'hearts') {
    return (
      <div className="pointer-events-none absolute inset-0 rounded-[8%]" style={{ border: `10px solid ${color}` }}>
        <span className="absolute left-1 top-1 text-2xl">💗</span><span className="absolute right-1 top-1 text-2xl">💗</span>
        <span className="absolute bottom-1 left-1 text-2xl">🎀</span><span className="absolute bottom-1 right-1 text-2xl">💗</span>
      </div>
    );
  }
  if (frame.style === 'pastel') return <div className="pointer-events-none absolute inset-0" style={{ border: `16px solid ${color}`, opacity: 0.85 }} />;
  return null;
}

/**
 * In-app selfie camera. Opens the camera only after the user taps "open camera" (a user gesture,
 * which also triggers the browser's own permission prompt). Falls back to a file picker if the
 * camera is unavailable or denied. Produces a square JPEG with the decorative frame composited in.
 */
export function CameraCapture({ frame, onCapture, busy }: { frame: Frame; onCapture: (blob: Blob) => void; busy?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'idle' | 'live'>('idle');
  const [err, setErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const stop = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };
  useEffect(() => stop, []);

  const start = async () => {
    setErr(null);
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });
      streamRef.current = stream;
      setMode('live');
      // wait a tick for the <video> to mount
      requestAnimationFrame(() => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); } });
    } catch {
      setErr('เปิดกล้องไม่ได้ (อาจไม่อนุญาต) ลองเลือกรูปจากเครื่องแทนได้น้า');
      fileRef.current?.click();
    } finally {
      setStarting(false);
    }
  };

  const snap = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE; canvas.height = SIZE;
    const ctx = canvas.getContext('2d')!;
    const vw = video.videoWidth, vh = video.videoHeight, s = Math.min(vw, vh);
    // Mirror horizontally so the saved selfie matches the preview.
    ctx.save();
    ctx.translate(SIZE, 0); ctx.scale(-1, 1);
    ctx.drawImage(video, (vw - s) / 2, (vh - s) / 2, s, s, 0, 0, SIZE, SIZE);
    ctx.restore();
    await drawFrame(ctx, frame);
    canvas.toBlob((blob) => { if (blob) { stop(); setMode('idle'); onCapture(blob); } }, 'image/jpeg', 0.9);
  };

  const fromFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const img = await loadImage(URL.createObjectURL(f));
      const canvas = document.createElement('canvas');
      canvas.width = SIZE; canvas.height = SIZE;
      const ctx = canvas.getContext('2d')!;
      const s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, SIZE, SIZE);
      await drawFrame(ctx, frame);
      canvas.toBlob((blob) => { if (blob) onCapture(blob); }, 'image/jpeg', 0.9);
    } catch {
      setErr('อ่านรูปไม่ได้ ลองใหม่น้า');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative aspect-square w-full max-w-[280px] overflow-hidden rounded-2xl bg-ink/10">
        {mode === 'live' ? (
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" style={{ transform: 'scaleX(-1)' }} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-5xl">📷</div>
        )}
        <FrameOverlay frame={frame} />
      </div>
      {err && <p className="text-center text-sm text-primary">{err}</p>}
      <input ref={fileRef} type="file" accept="image/*" capture="user" className="hidden" onChange={fromFile} />
      {mode === 'live' ? (
        <div className="flex gap-2">
          <button className="gift-btn !min-h-[46px] !px-6" disabled={busy} onClick={snap}>📸 ถ่าย</button>
          <button className="gift-btn-ghost !min-h-[46px]" onClick={() => { stop(); setMode('idle'); }}>ปิดกล้อง</button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button className="gift-btn !min-h-[46px] !px-5" disabled={starting} onClick={start}>{starting ? 'กำลังเปิด…' : '📷 เปิดกล้อง'}</button>
          <button className="gift-btn-ghost !min-h-[46px]" onClick={() => fileRef.current?.click()}>เลือกรูป</button>
        </div>
      )}
    </div>
  );
}
