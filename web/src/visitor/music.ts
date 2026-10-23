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

export interface Track {
  id: string;
  title: string | null;
  engine: 'audio' | 'youtube';
  url?: string;
  videoId?: string;
  start: number;
  end: number;
}

const keyOf = (t: Track | null) =>
  t ? `${t.engine}:${t.engine === 'youtube' ? t.videoId : t.url}:${t.start}:${t.end}` : '';

/* ----------------------------------------------------- YouTube IFrame API loader */
let ytApiPromise: Promise<any> | null = null;
function loadYouTubeApi(): Promise<any> {
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const w = window as any;
    if (w.YT && w.YT.Player) return resolve(w.YT);
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => { prev?.(); resolve(w.YT); };
    if (!document.getElementById('yt-iframe-api')) {
      const s = document.createElement('script');
      s.id = 'yt-iframe-api';
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    }
  });
  return ytApiPromise;
}

/**
 * Background music that plays either uploaded/linked audio files (two cross-fading <audio>)
 * or YouTube videos (hidden IFrame player). Each track can play just a chosen segment (start→end)
 * and loop it. Browsers block autoplay, so nothing starts until enable() runs from a tap.
 */
export class MusicController {
  private els: HTMLAudioElement[];
  private activeAudio = 0;
  private fades = new Map<HTMLAudioElement, number>();
  private listeners = new Set<() => void>();

  private track: Track | null = null;
  private key = '';
  private engine: 'audio' | 'youtube' | null = null;

  private yt: any = null;
  private ytHost: HTMLDivElement | null = null;
  private ytReady = false;
  private ytPlaying = false;
  private segTimer: number | null = null;
  private ytFade: number | null = null;

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
      el.addEventListener('timeupdate', () => this.audioSegmentCheck(el));
      el.addEventListener('ended', () => {
        if (this.loop && el === this.els[this.activeAudio]) { el.currentTime = this.track?.start ?? 0; el.play().catch(() => {}); }
      });
    }
  }

  subscribe(fn: () => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit() { for (const l of this.listeners) l(); }

  get playing() { return this.engine === 'youtube' ? this.ytPlaying : !!this.engine && !this.els[this.activeAudio].paused; }
  get currentTitle() { return this.track?.title ?? null; }
  get hasTrack() { return !!this.track; }

  configure(opts: { volume: number; loop: boolean; fadeMs: number }) {
    this.volume = Math.min(1, Math.max(0, Number(opts.volume) || 0.6));
    this.loop = opts.loop !== false;
    this.fadeMs = Math.max(0, Number(opts.fadeMs) || 0);
    if (this.engine === 'audio') {
      const cur = this.els[this.activeAudio];
      if (!cur.paused && !this.fades.has(cur)) cur.volume = this.volume;
    } else if (this.engine === 'youtube' && this.yt && !this.ytFade) {
      try { this.yt.setVolume(Math.round(this.volume * 100)); } catch { /* not ready */ }
    }
  }

  /** Switch to a track (null = silence). Same track (engine + source + segment) keeps playing. */
  setTrack(track: Track | null) {
    const k = keyOf(track);
    if (k === this.key) return;
    this.key = k;
    this.stopCurrent();
    this.track = track;
    this.engine = track?.engine ?? null;
    if (!track) { this.emit(); return; }
    if (this.on) this.startCurrent();
    this.emit();
  }

  private stopCurrent() {
    if (this.engine === 'audio') {
      const el = this.els[this.activeAudio];
      if (!el.paused) this.fadeAudio(el, 0, () => el.pause());
    } else if (this.engine === 'youtube') {
      this.clearSeg();
      this.ytPlaying = false;
      if (this.yt) this.fadeYt(0, () => { try { this.yt.pauseVideo(); } catch { /* ignore */ } });
    }
  }

  private startCurrent() {
    if (!this.track) return;
    if (this.track.engine === 'audio') this.startAudio(this.track);
    else this.startYouTube(this.track);
  }

  /* ----------------------------------- audio engine */
  private audioSegmentCheck(el: HTMLAudioElement) {
    if (el !== this.els[this.activeAudio] || !this.track || this.track.engine !== 'audio') return;
    const { start, end } = this.track;
    if (end > start && el.currentTime >= end) { el.currentTime = start; if (!this.loop) { el.pause(); } }
  }

  private startAudio(track: Track) {
    this.activeAudio = 1 - this.activeAudio;
    const el = this.els[this.activeAudio];
    el.src = track.url!;
    el.loop = this.loop && !(track.end > track.start); // segment loop handled manually
    el.volume = 0;
    const begin = () => { try { el.currentTime = track.start || 0; } catch { /* seek later */ } };
    el.addEventListener('loadedmetadata', begin, { once: true });
    el.play().then(() => { this.blocked = false; begin(); this.fadeAudio(el, this.volume); }).catch(() => { this.blocked = true; this.emit(); });
  }

  private fadeAudio(el: HTMLAudioElement, to: number, done?: () => void) {
    const prev = this.fades.get(el);
    if (prev) clearInterval(prev);
    if (!this.fadeMs) { el.volume = to; done?.(); return; }
    const from = el.volume;
    const steps = Math.max(1, Math.round(this.fadeMs / 40));
    let i = 0;
    const id = window.setInterval(() => {
      i++;
      el.volume = Math.min(1, Math.max(0, from + ((to - from) * i) / steps));
      if (i >= steps) { clearInterval(id); this.fades.delete(el); done?.(); }
    }, 40);
    this.fades.set(el, id);
  }

  /* ----------------------------------- youtube engine */
  private ensureYtHost() {
    if (this.ytHost) return;
    const host = document.createElement('div');
    // Keep it in the layout (off-screen) — fully hidden iframes can get throttled/muted.
    host.style.cssText = 'position:fixed;width:1px;height:1px;left:-9999px;bottom:0;opacity:0.01;pointer-events:none;';
    const inner = document.createElement('div');
    host.appendChild(inner);
    document.body.appendChild(host);
    this.ytHost = inner as HTMLDivElement;
  }

  private async startYouTube(track: Track) {
    this.ensureYtHost();
    const YT = await loadYouTubeApi();
    if (this.track !== track) return; // changed while loading
    const begin = () => {
      try {
        this.yt.seekTo(track.start || 0, true);
        this.yt.setVolume(0);
        this.yt.playVideo();
        this.fadeYt(this.volume);
        this.startSeg(track);
      } catch { /* not ready */ }
    };
    if (!this.yt) {
      this.yt = new YT.Player(this.ytHost, {
        host: 'https://www.youtube-nocookie.com',
        videoId: track.videoId,
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => { this.ytReady = true; if (this.track === track && this.on) begin(); },
          onStateChange: (e: any) => {
            // 1 = playing, 2 = paused, 0 = ended
            this.ytPlaying = e.data === 1;
            if (e.data === 0 && this.loop && this.track?.engine === 'youtube') { try { this.yt.seekTo(this.track.start || 0, true); this.yt.playVideo(); } catch { /* ignore */ } }
            this.emit();
          },
        },
      });
    } else if (this.ytReady) {
      this.yt.loadVideoById({ videoId: track.videoId, startSeconds: track.start || 0 });
      begin();
    }
  }

  private startSeg(track: Track) {
    this.clearSeg();
    if (!(track.end > track.start)) return;
    this.segTimer = window.setInterval(() => {
      try { if (this.yt.getCurrentTime() >= track.end) this.yt.seekTo(track.start || 0, true); } catch { /* ignore */ }
    }, 250);
  }
  private clearSeg() { if (this.segTimer) { clearInterval(this.segTimer); this.segTimer = null; } }

  private fadeYt(to: number, done?: () => void) {
    if (this.ytFade) clearInterval(this.ytFade);
    if (!this.yt) { done?.(); return; }
    let from = 0;
    try { from = (this.yt.getVolume?.() ?? this.volume * 100) / 100; } catch { from = this.volume; }
    if (!this.fadeMs) { try { this.yt.setVolume(Math.round(to * 100)); } catch { /* ignore */ } done?.(); return; }
    const steps = Math.max(1, Math.round(this.fadeMs / 40));
    let i = 0;
    this.ytFade = window.setInterval(() => {
      i++;
      const v = Math.min(1, Math.max(0, from + ((to - from) * i) / steps));
      try { this.yt.setVolume(Math.round(v * 100)); } catch { /* ignore */ }
      if (i >= steps) { clearInterval(this.ytFade!); this.ytFade = null; done?.(); }
    }, 40);
  }

  /* ----------------------------------- controls */
  enable() {
    this.on = true;
    savePref('on');
    if (this.track && !this.playing) this.startCurrent();
    this.emit();
  }
  disable() {
    this.on = false;
    savePref('off');
    this.stopCurrent();
    this.emit();
  }
  toggle() { if (this.on && this.playing) this.disable(); else this.enable(); }

  destroy() {
    for (const el of this.els) { el.pause(); el.src = ''; }
    for (const id of this.fades.values()) clearInterval(id);
    this.clearSeg();
    if (this.ytFade) clearInterval(this.ytFade);
    try { this.yt?.destroy?.(); } catch { /* ignore */ }
    this.ytHost?.parentElement?.remove();
  }
}
