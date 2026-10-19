import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { adminApi } from '../lib/api';
import { stripKeys, withKeys, type Keyed } from './components/Sortable';

export type Toast = { id: number; text: string; kind: 'ok' | 'error' | 'info'; action?: { label: string; to: string } };

export class AdminLive {
  ws: WebSocket | null = null;
  status: 'connecting' | 'online' | 'offline' = 'connecting';
  rtt: number | null = null;
  private handlers = new Set<(m: any) => void>();
  private retry = 0;
  private closed = false;
  private timer: number | null = null;

  connect() {
    this.closed = false;
    this.status = 'connecting';
    this.emit({ t: '_status' });
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?role=admin`);
    this.ws = ws;
    ws.onopen = () => { this.retry = 0; this.status = 'online'; this.emit({ t: '_status' }); };
    ws.onmessage = (ev) => {
      let m: any;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === 'rtt') this.rtt = m.ms;
      this.emit(m);
    };
    ws.onclose = () => {
      this.status = 'offline';
      this.emit({ t: '_status' });
      if (this.closed) return;
      this.timer = window.setTimeout(() => this.connect(), Math.min(15000, 700 * 2 ** this.retry++));
    };
  }
  close() { this.closed = true; if (this.timer) clearTimeout(this.timer); this.ws?.close(); }
  send(m: unknown) { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m)); }
  on(h: (m: any) => void) { this.handlers.add(h); return () => { this.handlers.delete(h); }; }
  private emit(m: any) { for (const h of this.handlers) h(m); }
}

export interface AdminCtx {
  content: any;
  dirty: boolean;
  publishedAt: string | null;
  reloadContent: () => Promise<void>;
  setSection: (name: string, data: any) => void;
  setList: (name: string, items: any[]) => void;
  setDirty: (d: boolean) => void;
  toast: (text: string, kind?: Toast['kind'], action?: Toast['action']) => void;
  me: any;
  setPrefs: (p: any) => Promise<void>;
  live: AdminLive;
  unread: number;
  setUnread: (n: number | ((x: number) => number)) => void;
  pending: number;
  setPending: (n: number) => void;
}

export const AdminContext = createContext<AdminCtx | null>(null);
export function useAdmin() {
  const v = useContext(AdminContext);
  if (!v) throw new Error('useAdmin outside provider');
  return v;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Local editable copy of one settings section, with Save Draft. */
export function useSection<T = any>(name: string) {
  const { content, setSection, setDirty, toast } = useAdmin();
  const server = content.sections[name] as T;
  const [value, setValue] = useState<T>(server);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setValue(server); }, [server]);
  const dirty = !same(value, server);
  const set = useCallback((patch: Partial<T> | ((v: T) => T)) => {
    setValue((v) => (typeof patch === 'function' ? (patch as (v: T) => T)(v) : { ...v, ...patch }));
  }, []);
  const save = async () => {
    setSaving(true);
    try {
      const res = await adminApi.put(`/content/${name}`, value);
      setSection(name, res.data);
      setDirty(res.dirty);
      toast('บันทึก Draft แล้ว ✓ (กด Publish เพื่อให้หน้าเว็บจริงเปลี่ยน)', 'ok');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };
  return { value, set, setValue, save, saving, dirty, reset: () => setValue(server) };
}

/** Local editable copy of one list (with stable drag keys), saved as a whole. */
export function useList<T extends object = any>(name: string) {
  const { content, setList, setDirty, toast } = useAdmin();
  const server = content.lists[name] as T[];
  const [items, setItems] = useState<(T & Keyed)[]>(() => withKeys(server));
  const [saving, setSaving] = useState(false);
  useEffect(() => { setItems(withKeys(server)); }, [server]);
  const dirty = !same(stripKeys(items), server);
  const save = async () => {
    setSaving(true);
    try {
      const res = await adminApi.put(`/list/${name}`, stripKeys(items));
      setList(name, res.items);
      setDirty(res.dirty);
      toast('บันทึก Draft แล้ว ✓', 'ok');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };
  const update = (key: string, patch: Partial<T>) => setItems((xs) => xs.map((x) => (x._key === key ? { ...x, ...patch } : x)));
  const remove = (key: string) => setItems((xs) => xs.filter((x) => x._key !== key));
  return { items, setItems, update, remove, save, saving, dirty, reset: () => setItems(withKeys(server)) };
}

export function useLiveBus(handler: (m: any) => void, deps: unknown[] = []) {
  const { live } = useAdmin();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => live.on(handler), [live, ...deps]);
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const run = useCallback(async () => {
    setLoading(true);
    try { setData(await fn()); setError(null); } catch (e: any) { setError(e.message); } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  return useMemo(() => ({ data, error, loading, reload: run, setData }), [data, error, loading, run]);
}
