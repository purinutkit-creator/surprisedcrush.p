import { useRef, useState, type ReactNode } from 'react';
import { adminApi, mediaUrl } from '../../lib/api';
import { useAdmin } from '../store';

export function Section({ title, desc, children, actions }: { title: string; desc?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-zinc-800">{title}</h3>
          {desc && <p className="mt-0.5 text-sm text-zinc-500">{desc}</p>}
        </div>
        {actions}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function Field({ label, hint, children, className = '' }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-zinc-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export const inputCls = 'w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-[15px] text-zinc-800 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100 disabled:bg-zinc-50';

export function Text({ label, hint, value, onChange, placeholder, type = 'text', className }: {
  label: ReactNode; hint?: ReactNode; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string;
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      <input type={type} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    </Field>
  );
}

export function Area({ label, hint, value, onChange, rows = 4, placeholder }: {
  label: ReactNode; hint?: ReactNode; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <textarea value={value ?? ''} rows={rows} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={`${inputCls} resize-y leading-relaxed`} />
    </Field>
  );
}

export function Num({ label, hint, value, onChange, min, max, step = 1 }: {
  label: ReactNode; hint?: ReactNode; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number;
}) {
  return (
    <Field label={label} hint={hint}>
      <input type="number" value={Number.isFinite(value) ? value : ''} min={min} max={max} step={step}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))} className={inputCls} />
    </Field>
  );
}

export function Toggle({ label, hint, checked, onChange }: { label: ReactNode; hint?: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-zinc-200 px-3.5 py-3 hover:bg-zinc-50">
      <span>
        <span className="block text-sm font-medium text-zinc-700">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-zinc-500">{hint}</span>}
      </span>
      <button type="button" role="switch" aria-checked={!!checked} onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-pink-500' : 'bg-zinc-300'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}

export function Select({ label, hint, value, onChange, options }: {
  label: ReactNode; hint?: ReactNode; value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  return (
    <Field label={label} hint={hint}>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </Field>
  );
}

export function Color({ label, value, onChange }: { label: ReactNode; value: string; onChange: (v: string) => void }) {
  const valid = /^#[0-9a-f]{6}$/i.test(value ?? '');
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={valid ? value : '#ffffff'} onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-10 w-12 cursor-pointer rounded-lg border border-zinc-300 bg-white p-1" />
        <input value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="#FF82AB" maxLength={9}
          className={`${inputCls} font-mono uppercase ${value && !/^#[0-9a-f]{3,8}$/i.test(value) ? 'border-red-400' : ''}`} />
      </div>
    </Field>
  );
}

export function Row({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const c = cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';
  return <div className={`grid gap-4 ${c}`}>{children}</div>;
}

export function Btn({ children, onClick, kind = 'default', disabled, type = 'button', className = '', title }: {
  children: ReactNode; onClick?: () => void; kind?: 'default' | 'primary' | 'danger' | 'ghost' | 'violet'; disabled?: boolean; type?: 'button' | 'submit'; className?: string; title?: string;
}) {
  const k = {
    default: 'border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50',
    primary: 'bg-pink-500 text-white hover:bg-pink-600 shadow-sm',
    danger: 'border border-red-200 bg-white text-red-600 hover:bg-red-50',
    ghost: 'text-zinc-600 hover:bg-zinc-100',
    violet: 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm',
  }[kind];
  return (
    <button type={type} title={title} disabled={disabled} onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${k} ${className}`}>
      {children}
    </button>
  );
}

/** Editable list of strings (wrong-guess messages, confession lines, accepted mission answers…). */
export function StringList({ label, hint, value, onChange, placeholder, multiline }: {
  label: ReactNode; hint?: ReactNode; value: string[]; onChange: (v: string[]) => void; placeholder?: string; multiline?: boolean;
}) {
  const list = Array.isArray(value) ? value : [];
  const set = (i: number, v: string) => onChange(list.map((x, k) => (k === i ? v : x)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const n = [...list];
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };
  return (
    <Field label={label} hint={hint}>
      <div className="space-y-2">
        {list.map((v, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <span className="mt-2.5 w-6 shrink-0 text-right text-xs text-zinc-400">{i + 1}</span>
            {multiline
              ? <textarea rows={2} value={v} placeholder={placeholder} onChange={(e) => set(i, e.target.value)} className={`${inputCls} resize-y`} />
              : <input value={v} placeholder={placeholder} onChange={(e) => set(i, e.target.value)} className={inputCls} />}
            <div className="flex shrink-0 flex-col">
              <button type="button" className="px-1.5 text-xs text-zinc-500 hover:text-zinc-800" onClick={() => move(i, -1)} aria-label="เลื่อนขึ้น">▲</button>
              <button type="button" className="px-1.5 text-xs text-zinc-500 hover:text-zinc-800" onClick={() => move(i, 1)} aria-label="เลื่อนลง">▼</button>
            </div>
            <button type="button" className="mt-1.5 rounded-lg px-2 py-1 text-red-500 hover:bg-red-50" onClick={() => onChange(list.filter((_, k) => k !== i))} aria-label="ลบ">✕</button>
          </div>
        ))}
        <Btn onClick={() => onChange([...list, ''])}>＋ เพิ่ม</Btn>
      </div>
    </Field>
  );
}

const ACCEPT: Record<string, string> = {
  image: 'image/jpeg,image/png,image/webp,image/gif',
  audio: 'audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac',
  font: '.ttf,.otf,.woff,.woff2',
  icon: 'image/png,image/x-icon,.ico',
};

/** Upload (or remove) one media file. Returns the media id. */
export function MediaInput({ label, hint, value, onChange, kind = 'image' }: {
  label: ReactNode; hint?: ReactNode; value: string | null; onChange: (id: string | null, file?: { filename: string; width?: number; height?: number }) => void; kind?: 'image' | 'audio' | 'font' | 'icon';
}) {
  const ref = useRef<HTMLInputElement>(null);
  const { toast } = useAdmin();
  const [busy, setBusy] = useState(false);
  const url = mediaUrl(value);
  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const dims = kind === 'image' ? await imageSize(files[0]) : undefined;
      const res = await adminApi.upload([files[0]]);
      if (res.errors.length) toast(res.errors[0].error, 'error');
      if (res.files[0]) onChange(res.files[0].id, { filename: res.files[0].filename, ...dims });
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  };
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-3">
        {url && (kind === 'image' || kind === 'icon') && <img src={url} alt="" className="h-16 w-16 rounded-lg border object-cover" />}
        {url && kind === 'audio' && <audio src={url} controls className="h-10 max-w-[240px]" />}
        {url && kind === 'font' && <span className="rounded-lg bg-zinc-100 px-2 py-1 text-xs">อัปโหลดแล้ว ✓</span>}
        <input ref={ref} type="file" accept={ACCEPT[kind]} className="hidden" onChange={(e) => pick(e.target.files)} />
        <Btn onClick={() => ref.current?.click()} disabled={busy}>{busy ? 'กำลังอัปโหลด…' : url ? 'เปลี่ยนไฟล์' : 'อัปโหลด'}</Btn>
        {url && <Btn kind="ghost" onClick={() => onChange(null)}>ลบ</Btn>}
      </div>
    </Field>
  );
}

export function imageSize(file: File): Promise<{ width: number; height: number } | undefined> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) return resolve(undefined);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve(undefined); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

/** Sticky footer that appears when a form has unsaved edits. */
export function SaveBar({ dirty, saving, onSave, onReset, extra }: { dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void; extra?: ReactNode }) {
  if (!dirty && !extra) return null;
  return (
    <div className="sticky bottom-3 z-20 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-pink-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
      <span className="text-sm text-zinc-600">{dirty ? '● มีการแก้ไขที่ยังไม่บันทึก' : ''}</span>
      <div className="flex gap-2">
        {extra}
        {dirty && <Btn kind="ghost" onClick={onReset} disabled={saving}>ยกเลิก</Btn>}
        {dirty && <Btn kind="primary" onClick={onSave} disabled={saving}>{saving ? 'กำลังบันทึก…' : '💾 Save Draft'}</Btn>}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">{children}</p>;
}

export function Badge({ children, color = 'zinc' }: { children: ReactNode; color?: 'zinc' | 'pink' | 'green' | 'amber' | 'red' | 'violet' | 'blue' }) {
  const c = {
    zinc: 'bg-zinc-100 text-zinc-700', pink: 'bg-pink-100 text-pink-700', green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-800', red: 'bg-red-100 text-red-700', violet: 'bg-violet-100 text-violet-700', blue: 'bg-sky-100 text-sky-700',
  }[color];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${c}`}>{children}</span>;
}
