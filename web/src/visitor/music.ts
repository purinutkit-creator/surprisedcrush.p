const PREF_KEY = 'gift_music';

export function musicPref(): 'on' | 'off' | null {
  try {
    const v = localStorage.getItem(PREF_KEY);
    return v === 'on' || v === 'off' ? v : null;
  } catch {
    return null;
  }
}

function savePref(v: 'on' | 'off') {
  try { localStorage.setItem(PREF_KEY, v); } catch { /* private mode */ }
}

/**
 * Two <audio> elements that cross-fade. Keeps playing (without restarting) while pages share the same track.
 * Browsers block autoplay, so nothing plays until `enable()` is called from a tap/click.
 */
export class MusicController {
  private els: HTMLAudioElement[];
  private active = 0;
  private url: string | null = null;
  private title: string | null = null;
  private fades = new Map<HTMLAudioElement, number>();
  private listeners = new Set<() => void>();
  volume = 0.6;
  loop = true;
  fadeMs = 1200;
  on = false;
  blocked = false;

  constructor() {
    this.els = [new Audio(), new Audio()];
    for (const el of this.els) {
      el.preload = 'auto';
      el.setAttribute('playsinline', '');
      el.addEventListener('play', () => this.emit());
      el.addEventListener('pause', () => this.emit());
      el.addEventListener('ended', () => {
        // Some browsers ignore `loop` for streamed sources; restart manually.
        if (this.loop && el === this.els[this.active]) { el.currentTime = 0; el.play().catch(() => {}); }
      });
    }
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() { for (const l of this.listeners) l(); }

  get playing() { return !this.els[this.active].paused; }
  get currentTitle() { return this.title; }
  get hasTrack() { return !!this.url; }

  configure(opts: { volume: number; loop: boolean; fadeMs: number }) {
    this.volume = Math.min(1, Math.max(0, Number(opts.volume) || 0.6));
    this.loop = opts.loop !== false;
    this.fadeMs = Math.max(0, Number(opts.fadeMs) || 0);
    for (const el of this.els) el.loop = this.loop;
    const cur = this.els[this.active];
    if (!cur.paused && !this.fades.has(cur)) cur.volume = this.volume;
  }

  private fade(el: HTMLAudioElement, to: number, done?: () => void) {
    const prev = this.fades.get(el);
    if (prev) clearInterval(prev);
    const from = el.volume;
    const steps = Math.max(1, Math.round(this.fadeMs / 40));
    let i = 0;
    if (!this.fadeMs) { el.volume = to; done?.(); return; }
    const id = window.setInterval(() => {
      i++;
      el.volume = Math.min(1, Math.max(0, from + ((to - from) * i) / steps));
      if (i >= steps) { clearInterval(id); this.fades.delete(el); done?.(); }
    }, 40);
    this.fades.set(el, id);
  }

  /** Switch to a track (null = silence). Same URL keeps playing seamlessly. */
  setTrack(url: string | null, title: string | null = null) {
    if (url === this.url) return;
    this.url = url;
    this.title = title;
    const old = this.els[this.active];
    if (!old.paused) this.fade(old, 0, () => old.pause());
    if (!url) { this.emit(); return; }
    this.active = 1 - this.active;
    const next = this.els[this.active];
    next.src = url;
    next.loop = this.loop;
    next.currentTime = 0;
    if (this.on) this.start(next);
    this.emit();
  }

  private start(el: HTMLAudioElement) {
    el.volume = 0;
    el.play().then(() => {
      this.blocked = false;
      this.fade(el, this.volume);
    }).catch(() => {
      this.blocked = true;
      this.emit();
    });
  }

  /** Must be called from a user gesture the first time. */
  enable() {
    this.on = true;
    savePref('on');
    const el = this.els[this.active];
    if (this.url && el.paused) this.start(el);
    this.emit();
  }

  disable() {
    this.on = false;
    savePref('off');
    const el = this.els[this.active];
    this.fade(el, 0, () => el.pause());
    this.emit();
  }

  toggle() {
    if (this.on && this.playing) this.disable(); else this.enable();
  }

  destroy() {
    for (const el of this.els) { el.pause(); el.src = ''; }
    for (const id of this.fades.values()) clearInterval(id);
  }
}
