export async function fetchJson<T = any>(url: string, timeoutMs = 8000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

/** Accepts a YouTube URL, an embed/share link, a Shorts link, or a bare 11-char id. */
export function parseYouTubeId(input: string): string | null {
  const s = String(input ?? '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m =
    s.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/) ||
    s.match(/[?&]v=([\w-]{11})/);
  return m ? m[1] : null;
}
