import { useEffect, useMemo, useRef, useState } from 'react';
import { GOOGLE_FONTS, loadFont } from '../../lib/theme';
import { Field, inputCls } from './form';

/** Searchable font picker: curated Google Fonts (Thai-ready flagged), uploaded fonts, or any Google Font name. */
export function FontSelect({ label, value, onChange, custom = [], allowDefault, hint }: {
  label: string; value: string; onChange: (v: string) => void; custom?: { family: string; url?: string | null }[]; allowDefault?: string; hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const list = useMemo(() => {
    const all = [
      ...custom.map((c) => ({ family: c.family, thai: true, style: 'ฟอนต์ที่อัปโหลด', custom: true })),
      ...GOOGLE_FONTS.map((f) => ({ ...f, custom: false })),
    ];
    const s = q.trim().toLowerCase();
    return s ? all.filter((f) => f.family.toLowerCase().includes(s) || f.style.includes(s) || (s === 'thai' && f.thai) || (s === 'ไทย' && f.thai)) : all;
  }, [q, custom]);
  useEffect(() => { if (open) list.slice(0, 40).forEach((f) => !f.custom && loadFont(f.family)); }, [open, list]);
  useEffect(() => { if (value) loadFont(value, custom.filter((c) => c.url) as any); }, [value]);

  return (
    <Field label={label} hint={hint}>
      <div className="relative" ref={box}>
        <button type="button" onClick={() => setOpen(!open)} className={`${inputCls} flex items-center justify-between text-left`}>
          <span style={{ fontFamily: value ? `"${value}"` : undefined }}>{value || allowDefault || 'เลือกฟอนต์'}</span>
          <span className="text-zinc-400">▾</span>
        </button>
        {open && (
          <div className="absolute z-30 mt-1 w-full rounded-xl border border-zinc-200 bg-white p-2 shadow-xl">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาฟอนต์… (พิมพ์ ไทย เพื่อดูฟอนต์ไทย)" className={`${inputCls} mb-2`} />
            <div className="max-h-72 overflow-y-auto">
              {allowDefault && <button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-pink-50" onClick={() => { onChange(''); setOpen(false); }}>{allowDefault}</button>}
              {list.map((f) => (
                <button key={f.family} type="button" onClick={() => { onChange(f.family); setOpen(false); }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left hover:bg-pink-50 ${value === f.family ? 'bg-pink-50' : ''}`}>
                  <span style={{ fontFamily: `"${f.family}"` }} className="text-[17px]">{f.family} · สุขสันต์วันเกิด</span>
                  <span className="shrink-0 text-[10px] text-zinc-400">{f.thai ? '🇹🇭 ' : ''}{f.style}</span>
                </button>
              ))}
              {q.trim() && !list.some((f) => f.family.toLowerCase() === q.trim().toLowerCase()) && (
                <button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm text-pink-600 hover:bg-pink-50" onClick={() => { onChange(q.trim()); setOpen(false); }}>
                  ใช้ Google Font ชื่อ “{q.trim()}”
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </Field>
  );
}
