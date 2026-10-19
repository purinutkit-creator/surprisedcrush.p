import { isPreview } from '../lib/api';

type Handler = (msg: any) => void;

/**
 * Realtime link to the server: presence (which page, online/idle), admin "surprises" and refresh pushes,
 * and — only after the visitor explicitly consents — an rrweb DOM stream of this website for Live View.
 * Nothing outside this web page (screen, camera, microphone, other apps) is ever accessed.
 */
export class LiveClient {
  private ws: WebSocket | null = null;
  private retry = 0;
  private closed = false;
  private handlers = new Set<Handler>();
  private page = 'welcome';
  private stopRecord: (() => void) | null = null;
  private buffer: unknown[] = [];
  private flushTimer: number | null = null;
  private lastActivity = 0;
  private recordWanted = false;
  private reconnectTimer: number | null = null;

  connect() {
    this.closed = false;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws?role=visitor${isPreview() ? '&preview=1' : ''}`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.send({ t: 'hello', page: this.page, viewport: { w: innerWidth, h: innerHeight } });
    };
    ws.onmessage = (ev) => {
      let msg: any;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.t === 'record') this.setRecording(!!msg.on);
      for (const h of this.handlers) h(msg);
    };
    ws.onclose = () => {
      this.stopRecording();
      this.ws = null;
      if (this.closed) return;
      // Reconnect with backoff when the internet drops.
      const delay = Math.min(15000, 800 * 2 ** this.retry++) + Math.random() * 400;
      this.reconnectTimer = window.setTimeout(() => this.connect(), delay);
    };
  }

  close() {
    this.closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopRecording();
    this.ws?.close();
  }

  on(h: Handler) {
    this.handlers.add(h);
    return () => { this.handlers.delete(h); };
  }

  send(msg: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  setPage(page: string) {
    this.page = page;
    this.send({ t: 'page', page });
  }

  activity() {
    const now = Date.now();
    if (now - this.lastActivity < 4000) return;
    this.lastActivity = now;
    const max = document.documentElement.scrollHeight - innerHeight;
    this.send({ t: 'activity', scroll: max > 0 ? scrollY / max : 0, viewport: { w: innerWidth, h: innerHeight } });
  }

  music(playing: boolean, title: string | null) {
    this.send({ t: 'music', playing, title });
  }

  private async setRecording(on: boolean) {
    this.recordWanted = on;
    this.stopRecording();
    if (!on) return;
    const { record } = await import('rrweb');
    if (!this.recordWanted || this.stopRecord) return;
    const stop = record({
      emit: (event) => {
        this.buffer.push(event);
        if (!this.flushTimer) this.flushTimer = window.setTimeout(() => this.flush(), 120);
      },
      // Privacy first: every input value is masked, and anything marked rr-mask / rr-block is hidden.
      maskAllInputs: true,
      maskTextClass: 'rr-mask',
      blockClass: 'rr-block',
      recordCanvas: false,
      collectFonts: false,
      inlineImages: false,
      sampling: { mousemove: 60, scroll: 120, input: 'last', media: 800 },
      slimDOMOptions: { script: true, comment: true, headFavicon: true, headWhitespace: true, headMetaSocial: true },
    });
    this.stopRecord = stop ?? null;
  }

  private flush() {
    this.flushTimer = null;
    if (!this.buffer.length) return;
    const e = this.buffer;
    this.buffer = [];
    this.send({ t: 'rr', e, ts: Date.now() });
  }

  private stopRecording() {
    this.stopRecord?.();
    this.stopRecord = null;
    this.buffer = [];
  }
}
