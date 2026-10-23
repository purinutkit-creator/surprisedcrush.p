import QRCodeStyling, { type Options } from 'qr-code-styling';
import { useEffect, useMemo, useRef, useState } from 'react';
import { adminApi, mediaUrl } from '../../lib/api';
import { Btn, Color, Field, inputCls, MediaInput, Row, Section, Select } from '../components/form';
import { useAdmin, useAsync } from '../store';

const DOT_TYPES: [string, string][] = [
  ['rounded', 'มน'], ['dots', 'จุดกลม'], ['classy', 'คลาสซี่'], ['classy-rounded', 'คลาสซี่มน'], ['square', 'เหลี่ยม'], ['extra-rounded', 'มนมาก'],
];
const CORNER_TYPES: [string, string][] = [['extra-rounded', 'มน'], ['dot', 'จุด'], ['square', 'เหลี่ยม']];

/** Render an emoji to a transparent PNG data URL to use as the QR center image. */
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

export default function Qr() {
  const { toast, content } = useAdmin();
  const invites = useAsync(() => adminApi.get('/invites'));
  const holder = useRef<HTMLDivElement>(null);
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
    cornersDotOptions: { type: cornerType === 'square' ? 'square' : 'dot' as any, color: gradient ? dotColor2 : dotColor },
    backgroundOptions: { color: bgTransparent ? 'transparent' : bgColor },
  }), [url, image, dotType, cornerType, dotColor, dotColor2, gradient, bgColor, bgTransparent]);

  useEffect(() => {
    if (!qr.current) {
      qr.current = new QRCodeStyling(options);
      if (holder.current) { holder.current.innerHTML = ''; qr.current.append(holder.current); }
    } else {
      qr.current.update(options);
    }
  }, [options]);

  const download = (ext: 'png' | 'svg') => qr.current?.download({ name: 'surprisedcrush-qr', extension: ext });
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
              ...(requireInvite || inviteOpts.length ? inviteOpts : []),
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
          <Section title="รูปตรงกลาง QR" desc="เลือกหัวใจหรือไอคอน หรืออัปโหลดรูปของตัวเอง (ระบบตั้ง error-correction สูงไว้ให้สแกนได้แม้มีรูปตรงกลาง)">
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
          <Section title="สีและรูปทรง">
            <Row cols={3}>
              <Select label="รูปทรงจุด" value={dotType} onChange={setDotType} options={DOT_TYPES} />
              <Select label="มุม QR" value={cornerType} onChange={setCornerType} options={CORNER_TYPES} />
              <Field label="ไล่สี (gradient)"><div className="pt-1"><input type="checkbox" checked={gradient} onChange={(e) => setGradient(e.target.checked)} className="h-5 w-5" /></div></Field>
              <Color label="สีจุด" value={dotColor} onChange={setDotColor} />
              {gradient && <Color label="สีไล่ที่ 2" value={dotColor2} onChange={setDotColor2} />}
              <Color label="สีพื้นหลัง" value={bgColor} onChange={setBgColor} />
              <Field label="พื้นหลังโปร่งใส"><div className="pt-1"><input type="checkbox" checked={bgTransparent} onChange={(e) => setBgTransparent(e.target.checked)} className="h-5 w-5" /></div></Field>
            </Row>
          </Section>
        </div>
        <div className="lg:sticky lg:top-20 lg:self-start">
          <p className="mb-2 text-sm font-semibold text-zinc-600">👀 ตัวอย่าง</p>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-[linear-gradient(45deg,#f4f4f5_25%,transparent_25%,transparent_75%,#f4f4f5_75%),linear-gradient(45deg,#f4f4f5_25%,#fff_25%,#fff_75%,#f4f4f5_75%)] bg-[length:20px_20px] bg-[position:0_0,10px_10px] p-5">
            <div ref={holder} className="rounded-xl bg-white p-2 shadow" />
            <div className="flex gap-2">
              <Btn kind="primary" onClick={() => download('png')}>⬇️ PNG</Btn>
              <Btn onClick={() => download('svg')}>⬇️ SVG</Btn>
            </div>
            <p className="text-center text-xs text-zinc-500">ลองสแกนด้วยมือถือเพื่อเช็กก่อนส่งนะครับ</p>
          </div>
        </div>
      </div>
    </div>
  );
}
