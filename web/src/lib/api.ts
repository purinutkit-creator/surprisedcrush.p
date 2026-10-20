export class ApiError extends Error {
  constructor(public status: number, message: string, public data: any = {}) {
    super(message);
  }
}

const PREVIEW_KEY = 'gift_preview';

export function isPreview(): boolean {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('preview') === '1') sessionStorage.setItem(PREVIEW_KEY, '1');
    if (q.get('preview') === '0') sessionStorage.removeItem(PREVIEW_KEY);
    return sessionStorage.getItem(PREVIEW_KEY) === '1';
  } catch {
    return new URLSearchParams(location.search).get('preview') === '1';
  }
}

export function inviteCode(): string | null {
  try {
    const q = new URLSearchParams(location.search).get('invite');
    if (q) localStorage.setItem('gift_invite', q);
    return q ?? localStorage.getItem('gift_invite');
  } catch {
    return new URLSearchParams(location.search).get('invite');
  }
}

async function request<T>(method: string, url: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const h: Record<string, string> = { ...headers };
  if (body !== undefined && !(body instanceof FormData)) h['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: h,
      credentials: 'same-origin',
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ ลองใหม่อีกครั้งนะ 📶');
  }
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new ApiError(res.status, (data && data.error) || 'เกิดข้อผิดพลาด ลองใหม่อีกครั้งนะ', data ?? {});
  return data as T;
}

function visitorHeaders() {
  const h: Record<string, string> = {};
  if (isPreview()) h['X-Gift-Preview'] = '1';
  const inv = inviteCode();
  if (inv) h['X-Gift-Invite'] = inv;
  return h;
}

export const visitorApi = {
  get: <T = any>(url: string) => request<T>('GET', url, undefined, visitorHeaders()),
  post: <T = any>(url: string, body: unknown = {}) => request<T>('POST', url, body, visitorHeaders()),
  /** Upload an optional selfie keepsake the visitor chose to send. */
  uploadSelfie(file: Blob, kind: string) {
    const fd = new FormData();
    fd.append('photo', file, 'selfie.jpg');
    fd.append('kind', kind);
    return request<{ ok: boolean; state: any }>('POST', '/api/selfie', fd, visitorHeaders());
  },
  /** Fire-and-forget activity event. Never contains anything the visitor typed. */
  track(type: string, data: Record<string, string | number | boolean> = {}) {
    request('POST', '/api/track', { type, data }, visitorHeaders()).catch(() => {});
  },
};

const ADMIN_H = { 'X-Gift-Admin': '1' };
export const adminApi = {
  get: <T = any>(url: string) => request<T>('GET', `/api/admin${url}`, undefined, ADMIN_H),
  post: <T = any>(url: string, body: unknown = {}) => request<T>('POST', `/api/admin${url}`, body, ADMIN_H),
  put: <T = any>(url: string, body: unknown) => request<T>('PUT', `/api/admin${url}`, body, ADMIN_H),
  patch: <T = any>(url: string, body: unknown) => request<T>('PATCH', `/api/admin${url}`, body, ADMIN_H),
  del: <T = any>(url: string) => request<T>('DELETE', `/api/admin${url}`, undefined, ADMIN_H),
  upload: (files: File[] | FileList) => {
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append('files', f);
    return request<{ files: { id: string; url: string; kind: string; filename: string; mime: string }[]; errors: { filename: string; error: string }[] }>(
      'POST', '/api/admin/upload', fd, ADMIN_H);
  },
};

export const mediaUrl = (id: string | null | undefined) => (id ? `/media/${id}` : null);
