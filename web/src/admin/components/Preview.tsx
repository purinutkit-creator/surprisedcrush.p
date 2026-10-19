import { useEffect, type ReactNode } from 'react';
import { mediaUrl } from '../../lib/api';
import { fill } from '../../lib/text';
import { loadThemeFonts, themeVars } from '../../lib/theme';
import { useAdmin } from '../store';

export function publicTheme(theme: any) {
  return {
    ...theme,
    background: { ...theme.background, imageUrl: mediaUrl(theme.background?.imageId) },
    customFonts: (theme.customFonts ?? []).map((f: any) => ({ family: f.family, url: mediaUrl(f.mediaId) })).filter((f: any) => f.url),
  };
}

/** Renders children with the (draft) website theme, isolated from the admin styles. */
export function Themed({ children, theme, className = '' }: { children: ReactNode; theme?: any; className?: string }) {
  const { content } = useAdmin();
  const t = publicTheme(theme ?? content.sections.theme);
  useEffect(() => { loadThemeFonts(t); }, [JSON.stringify(t.fonts), JSON.stringify(t.customFonts)]);
  return (
    <div style={themeVars(t)} className={`gift-bg relative overflow-hidden rounded-2xl border border-zinc-200 font-body text-ink ${className}`}>
      {children}
    </div>
  );
}

export function PreviewBox({ title = 'Preview', children, theme }: { title?: string; children: ReactNode; theme?: any }) {
  return (
    <div className="lg:sticky lg:top-20">
      <p className="mb-2 text-sm font-semibold text-zinc-600">👀 {title} <span className="font-normal text-zinc-400">(ใช้ข้อมูลที่กำลังแก้ ยังไม่บันทึกก็เห็นได้)</span></p>
      <Themed theme={theme} className="max-h-[78vh] overflow-y-auto p-4">{children}</Themed>
    </div>
  );
}

export function useVars() {
  const { content } = useAdmin();
  const r = content.sections.recipient;
  return { NAME: r.nickname, CALL: r.callPrefix, FULLNAME: r.fullName || r.nickname };
}

export function toPublicLetter(l: any, vars: Record<string, string>) {
  return {
    ...l,
    header: fill(l.header, vars), body: fill(l.body, vars), closing: fill(l.closing, vars),
    backgroundImageUrl: mediaUrl(l.backgroundImageId),
    stickers: (l.stickers ?? []).map((s: any) => ({ ...s, url: mediaUrl(s.mediaId) })),
    images: (l.images ?? []).map((i: any) => ({ ...i, url: mediaUrl(i.mediaId) })).filter((i: any) => i.url),
  };
}

export function toPublicFyi(i: any) {
  return {
    ...i, imageUrl: mediaUrl(i.imageId), bgImageUrl: mediaUrl(i.bgImageId),
    timer: { ...i.timer, appearance: { ...i.timer.appearance, bgImageUrl: mediaUrl(i.timer?.appearance?.bgImageId) } },
  };
}
