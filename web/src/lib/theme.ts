import type { CSSProperties } from 'react';

export const GOOGLE_FONTS: { family: string; thai: boolean; weights?: string; style: string }[] = [
  { family: 'Mali', thai: true, weights: '400;500;600;700', style: 'น่ารัก ลายมือ' },
  { family: 'Itim', thai: true, style: 'น่ารัก ลายมือ' },
  { family: 'Mitr', thai: true, weights: '300;400;500;600', style: 'โมเดิร์น' },
  { family: 'Kanit', thai: true, weights: '300;400;500;600;700', style: 'โมเดิร์น' },
  { family: 'Prompt', thai: true, weights: '300;400;500;600;700', style: 'โมเดิร์น' },
  { family: 'Sarabun', thai: true, weights: '300;400;500;600;700', style: 'อ่านง่าย' },
  { family: 'Sriracha', thai: true, style: 'ลายมือ' },
  { family: 'Charm', thai: true, weights: '400;700', style: 'ลายมือ หรูหรา' },
  { family: 'Charmonman', thai: true, weights: '400;700', style: 'ลายมือ หรูหรา' },
  { family: 'Kodchasan', thai: true, weights: '300;400;500;600;700', style: 'น่ารัก' },
  { family: 'KoHo', thai: true, weights: '300;400;500;600;700', style: 'น่ารัก' },
  { family: 'Krub', thai: true, weights: '300;400;500;600;700', style: 'อ่านง่าย' },
  { family: 'K2D', thai: true, weights: '300;400;500;600;700', style: 'โมเดิร์น' },
  { family: 'Niramit', thai: true, weights: '300;400;500;600;700', style: 'อ่านง่าย' },
  { family: 'Athiti', thai: true, weights: '300;400;500;600;700', style: 'อ่านง่าย' },
  { family: 'Bai Jamjuree', thai: true, weights: '300;400;500;600;700', style: 'โมเดิร์น' },
  { family: 'Chakra Petch', thai: true, weights: '300;400;500;600;700', style: 'เทค' },
  { family: 'Fahkwang', thai: true, weights: '300;400;500;600;700', style: 'คลาสสิก' },
  { family: 'Pridi', thai: true, weights: '300;400;500;600;700', style: 'มีหัว คลาสสิก' },
  { family: 'Trirong', thai: true, weights: '300;400;500;600;700', style: 'มีหัว คลาสสิก' },
  { family: 'Taviraj', thai: true, weights: '300;400;500;600;700', style: 'มีหัว คลาสสิก' },
  { family: 'Maitree', thai: true, weights: '300;400;500;600;700', style: 'มีหัว คลาสสิก' },
  { family: 'Thasadith', thai: true, weights: '400;700', style: 'อ่านง่าย' },
  { family: 'Pattaya', thai: true, style: 'ตัวหนา สนุก' },
  { family: 'Chonburi', thai: true, style: 'ตัวหนา หัวข้อ' },
  { family: 'Srisakdi', thai: true, weights: '400;700', style: 'ประดิษฐ์' },
  { family: 'Noto Sans Thai', thai: true, weights: '300;400;500;600;700', style: 'มาตรฐาน' },
  { family: 'Noto Sans Thai Looped', thai: true, weights: '300;400;500;600;700', style: 'มีหัว อ่านง่าย' },
  { family: 'Noto Serif Thai', thai: true, weights: '400;500;600;700', style: 'มีเชิง' },
  { family: 'IBM Plex Sans Thai', thai: true, weights: '300;400;500;600;700', style: 'มาตรฐาน' },
  { family: 'IBM Plex Sans Thai Looped', thai: true, weights: '300;400;500;600;700', style: 'มีหัว' },
  { family: 'Anuphan', thai: true, weights: '300;400;500;600;700', style: 'โมเดิร์น' },
  { family: 'Fredoka', thai: false, weights: '400;500;600;700', style: 'กลมมน น่ารัก' },
  { family: 'Quicksand', thai: false, weights: '400;500;600;700', style: 'กลมมน' },
  { family: 'Nunito', thai: false, weights: '400;600;700;800', style: 'กลมมน' },
  { family: 'Poppins', thai: false, weights: '400;500;600;700', style: 'โมเดิร์น' },
  { family: 'Comfortaa', thai: false, weights: '400;500;600;700', style: 'กลมมน' },
  { family: 'Baloo 2', thai: false, weights: '400;500;600;700', style: 'น่ารัก ตัวหนา' },
  { family: 'Varela Round', thai: false, style: 'กลมมน' },
  { family: 'Pacifico', thai: false, style: 'ลายมือ' },
  { family: 'Dancing Script', thai: false, weights: '400;500;600;700', style: 'ลายมือ' },
  { family: 'Caveat', thai: false, weights: '400;500;600;700', style: 'ลายมือ' },
  { family: 'Great Vibes', thai: false, style: 'ลายมือ หรูหรา' },
  { family: 'Sacramento', thai: false, style: 'ลายมือ หรูหรา' },
  { family: 'Parisienne', thai: false, style: 'ลายมือ หรูหรา' },
  { family: 'Satisfy', thai: false, style: 'ลายมือ' },
  { family: 'Gaegu', thai: false, weights: '400;700', style: 'ลายมือ น่ารัก' },
  { family: 'Patrick Hand', thai: false, style: 'ลายมือ' },
  { family: 'Indie Flower', thai: false, style: 'ลายมือ' },
  { family: 'Sniglet', thai: false, weights: '400;800', style: 'น่ารัก' },
  { family: 'Chewy', thai: false, style: 'สนุก' },
  { family: 'Playfair Display', thai: false, weights: '400;500;600;700', style: 'มีเชิง หรูหรา' },
  { family: 'Lora', thai: false, weights: '400;500;600;700', style: 'มีเชิง' },
  { family: 'Montserrat', thai: false, weights: '400;500;600;700', style: 'โมเดิร์น' },
  { family: 'DM Sans', thai: false, weights: '400;500;700', style: 'โมเดิร์น' },
];

const loaded = new Set<string>(['Mali', 'Itim', 'Fredoka', 'IBM Plex Sans Thai']);

/** Inject the stylesheet for a font: uploaded fonts via @font-face, everything else from Google Fonts. */
export function loadFont(family: string, custom: { family: string; url: string }[] = []) {
  if (!family || loaded.has(family)) return;
  loaded.add(family);
  const c = custom.find((f) => f.family === family);
  if (c) {
    const style = document.createElement('style');
    style.textContent = `@font-face { font-family: ${JSON.stringify(family)}; src: url(${JSON.stringify(c.url)}); font-display: swap; }`;
    document.head.appendChild(style);
    return;
  }
  const known = GOOGLE_FONTS.find((f) => f.family === family);
  const fam = encodeURIComponent(family).replace(/%20/g, '+');
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${fam}${known?.weights ? `:wght@${known.weights}` : ''}&display=swap`;
  document.head.appendChild(link);
}

export function hexToTriplet(hex: string, fallback = '255 130 171'): string {
  const m = String(hex ?? '').trim().replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  if (!/^[0-9a-f]{6}$/i.test(full)) return fallback;
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

const quote = (f: string) => (f ? `"${f.replace(/"/g, '')}"` : '');

export interface Theme {
  colors: Record<string, string>;
  fonts: Record<string, string>;
  customFonts?: { family: string; url: string }[];
  radius?: number;
  cardStyle?: string;
  buttonStyle?: string;
  background?: { type: string; imageUrl?: string | null };
  animations?: Record<string, any>;
  transition?: string;
}

/** CSS variables for a theme. Can be put on :root (visitor site) or on a wrapper (admin previews). */
export function themeVars(theme: Theme): CSSProperties {
  const c = theme.colors ?? {};
  const vars: Record<string, string> = {};
  for (const key of ['primary', 'secondary', 'accent', 'background', 'text', 'button', 'buttonText', 'card', 'border']) {
    if (c[key]) vars[`--c-${key}`] = hexToTriplet(c[key]);
  }
  vars['--g-from'] = c.gradientFrom || '#FFD6E7';
  vars['--g-via'] = c.gradientVia || c.background || '#FFF9F5';
  vars['--g-to'] = c.gradientTo || '#E9D5FF';
  vars['--radius'] = `${theme.radius ?? 28}px`;
  vars['--btn-radius'] = theme.buttonStyle === 'rounded' ? '18px' : theme.buttonStyle === 'square' ? '10px' : '999px';
  for (const key of ['heading', 'body', 'button', 'letter', 'confession', 'number']) {
    const f = theme.fonts?.[key];
    if (f) vars[`--f-${key}`] = quote(f);
  }
  return vars as CSSProperties;
}

export function loadThemeFonts(theme: Theme) {
  for (const f of Object.values(theme.fonts ?? {})) if (f) loadFont(f, theme.customFonts ?? []);
}

export function applyThemeToRoot(theme: Theme) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(themeVars(theme))) root.style.setProperty(k, String(v));
  root.dataset.motion = theme.animations?.intensity === 'low' ? 'low' : 'normal';
  loadThemeFonts(theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && theme.colors?.secondary) meta.setAttribute('content', theme.colors.secondary);
}
