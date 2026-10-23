import QRCodeStyling, { type Options } from 'qr-code-styling';
import { useEffect, useMemo, useRef, useState } from 'react';
import { adminApi, mediaUrl } from '../../lib/api';
import { Btn, Color, Field, inputCls, MediaInput, Row, Section, Select } from '../components/form';
import { useAdmin, useAsync } from '../store';

const DOT_TYPES: [string, string][] = [
  ['rounded', 'มน'], ['dots', 'จุดกลม'], ['classy', 'คลาสซี่'], ['classy-rounded', 'คลาสซี่มน'], ['square', 'เหลี่ยม'], ['extra-rounded', 'มนมาก'],
];
const CORNER_TYPES: [string, string][] = [['extra-rounded', 'มน'], ['dot', 'จุด'], ['square', 'เหลี่ยม']];
const SHAPES: [string, string][] = [['none', 'สี่เหลี่ยม (ปกติ)'], ['heart', 'กรอบหัวใจ 💗'], ['circle', 'กรอบวงกลม'], ['rounded', 'กรอบมุมมน']];

function emojiDataUrl(emoji: string, size = 160): string {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.font = `${Math.floor(size * 0.8)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, size / 2, size / 2 + size * 0.05);
  return c.toDataURL('image/png');
}

const CENTER_PRESETS = ['none', '💗', '🎁', '🎀', '⭐', '💌', '🥰', 'custom'] as const;

function heartPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number) {
  ctx.beginPath();
  for (let t = 0; t <= Math.PI * 2 + 0.02; t += 0.02) {
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const px = cx + x * scale, py = cy - y * scale;
    if (t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

const blobToImage = (blob: Blob) => new Promise<HTMLImageElement>((resolve, reject) => {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => { resolve(img); URL.revokeObjectURL(url); };
  img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
  img.src = url;
});

/** Draw the QR image inside the chosen outer shape onto `canvas`. The QR stays a full square
 * (in a white "quiet-zone" panel) so it remains scannable; the shape is decorative around it. */
function compose(canvas: HTMLCanvasElement, qrImg: HTMLImageElement, shape: string, shapeColor: string, bg: string, transparent: boolean) {
  const ctx = canvas.getContext('2d')!;
  if (shape === 'none') {
    const S = 320;
    canvas.width = canvas.height = S;
    ctx.clearRect(0, 0, S, S);
    if (!transparent) { ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S); }
    ctx.drawImage(qrImg, 0, 0, S, S);
    return;
  }
  const S = 560;
  canvas.width = canvas.height = S;
  ctx.clearRect(0, 0, S, S);
  ctx.save();
  ctx.fillStyle = shapeColor;
  if (shape === 'heart') {
    heartPath(ctx, S / 2, S * 0.56, S / 34);
    ctx.shadowColor = 'rgba(0,0,0,0.12)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    ctx.fill();
  } else if (shape === 'circle') {
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 6, 0, Math.PI * 2); ctx.fill();
  } else {
    roundRectPath(ctx, 8, 8, S - 16, S - 16, 56); ctx.fill();
  }
  ctx.restore();
  // White panel + QR, centred (a touch high for the heart so it sits in the fat part).
  const q = Math.round(S * (shape === 'heart' ? 0.5 : 0.62));
  const qx = Math.round((S - q) / 2);
  const qy = Math.round(shape === 'heart' ? S * 0.26 : (S - q) / 2);
  const pad = Math.round(q * 0.07);
  ctx.fillStyle = bg === 'transparent' ? '#FFFFFF' : bg;
  roundRectPath(ctx, qx - pad, qy - pad, q + pad * 2, q + pad * 2, 18);
  ctx.fill();
  ctx.drawImage(qrImg, qx, qy, q, q);
}

export default function Qr() {
  const { toast, content } = useAdmin();
  const invites = useAsync(() => adminApi.get('/invites'));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qr = useRef<QRCodeStyling | null>(null);

  const origin = location.origin;
  const [target, setTarget] = useState('root');
  const [dotType, setDotType] = useState('rounded');
  const [cornerType, setCornerType] = useState('extra-rounded');
  const [dotColor, setDotColor] = useState('#FF4D94');
  const [dotColor2, setDotColor2] = useState('#A855F7');
  const [gradient, setGradient] = useState(true);
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [bgTransparent, setBgTransparent] = useState(false);
  const [center, setCenter] = useState<(typeof CENTER_PRESETS)[number]>('💗');
  const [customId, setCustomId] = useState<string | null>(null);
  const [shape, setShape] = useState('heart');
  const [shapeColor, setShapeColor] = useState('#FF82AB');

  const url = useMemo(() => {
    if (target === 'root') return `${origin}/`;
    if (target === 'confession') return `${origin}/yourmybestcrushever`;
    return `${origin}/?invite=${target}`;
  }, [target, origin]);

  const image = center === 'none' ? undefined : center === 'custom' ? (mediaUrl(customId) ?? undefined) : emojiDataUrl(center);

  const options = useMemo<Options>(() => ({
    width: 320, height: 320, type: 'canvas', data: url, image,
    qrOptions: { errorCorrectionLevel: 'H' },
    imageOptions: { crossOrigin: 'anonymous', margin: 6, imageSize: 0.42, hideBackgroundDots: true },
    dotsOptions: gradient
      ? { type: dotType as any, gradient: { type: 'linear', rotation: 0.78, colorStops: [{ offset: 0, color: dotColor }, { offset: 1, color: dotColor2 }] } }
      : { type: dotType as any, color: dotColor },
    cornersSquareOptions: { type: cornerType as any, color: dotColor },
    cornersDotOptions: { type: (cornerType === 'square' ? 'square' : 'dot') as any, color: gradient ? dotColor2 : dotColor },
    backgroundOptions: { color: '#FFFFFF' },
  }), [url, image, dotType, cornerType, dotColor, dotColor2, gradient]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!qr.current) qr.current = new QRCodeStyling(options);
      else qr.current.update(options);
      try {
        const raw = (await qr.current.getRawData('png')) as Blob | null;
        if (!raw || cancelled || !canvasRef.current) return;
        const img = await blobToImage(raw);
        if (cancelled) return;
        compose(canvasRef.current, img, shape, shapeColor, bgTransparent ? 'transparent' : bgColor, bgTransparent);
      } catch { /* render error ignored */ }
    })();
    return () => { cancelled = true; };
  }, [options, shape, shapeColor, bgColor, bgTransparent]);

  const download = () => {
    const c = canvasRef.current;
    if (!c) return;
    c.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `surprisedcrush-qr-${shape}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, 'image/png');
  };
  const copyLink = () => { navigator.clipboard?.writeText(url); toast('คัดลอกลิงก์แล้ว', 'ok'); };

  const requireInvite = content.sections.website.progress.requireInvite;
  const inviteOpts: [string, string][] = (invites.data ?? []).filter((i: any) => i.enabled).map((i: any) => [i.code, `ลิงก์คำเชิญ: ${i.label || i.code}`]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">QR Code 🔗</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Section title="ลิงก์ที่จะใส่ใน QR">
            <Select label="ปลายทาง" value={target} onChange={setTarget} options={[
              ['root', 'หน้าแรกของเว็บ (สำหรับส่งให้เขา)'],
              ...inviteOpts,
              ['confession', 'หน้าบอกความรู้สึกโดยตรง (ปกติไม่ต้องใช้)'],
            ]} />
            <div className="flex items-center gap-2">
              <input readOnly value={url} className={`${inputCls} flex-1`} />
              <Btn onClick={copyLink}>คัดลอก</Btn>
            </div>
            {requireInvite && target === 'root' && (
              <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">เว็บเปิดเฉพาะลิงก์คำเชิญอยู่ — ควรเลือกลิงก์คำเชิญด้านบน (สร้างได้ที่ Website Settings)</p>
            )}
          </Section>
          <Section title="รูปทรงกรอบ" desc="QR เป็นสี่เหลี่ยมเสมอ (เพื่อให้สแกนได้) แต่ใส่กรอบรูปหัวใจ/วงกลมล้อมรอบได้">
            <Row>
              <Select label="ทรงกรอบ" value={shape} onChange={setShape} options={SHAPES} />
              {shape !== 'none' && <Color label="สีกรอบ" value={shapeColor} onChange={setShapeColor} />}
            </Row>
          </Section>
          <Section title="รูปตรงกลาง QR" desc="เลือกหัวใจหรือไอคอน หรืออัปโหลดรูปของตัวเอง (ตั้ง error-correction สูงไว้ให้สแกนได้แม้มีรูปตรงกลาง)">
            <div className="flex flex-wrap gap-2">
              {CENTER_PRESETS.map((c) => (
                <button key={c} onClick={() => setCenter(c)}
                  className={`grid h-12 w-12 place-items-center rounded-xl border text-2xl ${center === c ? 'border-pink-500 ring-2 ring-pink-200' : 'border-zinc-200'}`}>
                  {c === 'none' ? '🚫' : c === 'custom' ? '🖼️' : c}
                </button>
              ))}
            </div>
            {center === 'custom' && <MediaInput label="รูปตรงกลาง" value={customId} onChange={(id) => setCustomId(id)} />}
          </Section>
          <Section title="สีและรูปทรงจุด">
            <Row cols={3}>
              <Select label="รูปทรงจุด" value={dotType} onChange={setDotType} options={DOT_TYPES} />
              <Select label="มุม QR" value={cornerType} onChange={setCornerType} options={CORNER_TYPES} />
              <Field label="ไล่สี (gradient)"><div className="pt-1"><input type="checkbox" checked={gradient} onChange={(e) => setGradient(e.target.checked)} className="h-5 w-5" /></div></Field>
              <Color label="สีจุด" value={dotColor} onChange={setDotColor} />
              {gradient && <Color label="สีไล่ที่ 2" value={dotColor2} onChange={setDotColor2} />}
              <Color label="สีพื้นหลัง QR" value={bgColor} onChange={setBgColor} />
              <Field label="พื้นหลังโปร่งใส (เฉพาะทรงสี่เหลี่ยม)"><div className="pt-1"><input type="checkbox" checked={bgTransparent} onChange={(e) => setBgTransparent(e.target.checked)} className="h-5 w-5" /></div></Field>
            </Row>
          </Section>
        </div>
        <div className="lg:sticky lg:top-20 lg:self-start">
          <p className="mb-2 text-sm font-semibold text-zinc-600">👀 ตัวอย่าง</p>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-[linear-gradient(45deg,#f4f4f5_25%,transparent_25%,transparent_75%,#f4f4f5_75%),linear-gradient(45deg,#f4f4f5_25%,#fff_25%,#fff_75%,#f4f4f5_75%)] bg-[length:20px_20px] bg-[position:0_0,10px_10px] p-5">
            <canvas ref={canvasRef} className="h-auto w-full max-w-[300px]" />
            <Btn kind="primary" onClick={download}>⬇️ ดาวน์โหลด PNG</Btn>
            <p className="text-center text-xs text-zinc-500">ลองสแกนด้วยมือถือเพื่อเช็กก่อนส่งนะครับ</p>
          </div>
        </div>
      </div>
    </div>
  );
}
