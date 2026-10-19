import type { IncomingMessage, Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { ADMIN_COOKIE, resolveAdmin } from './auth.js';
import { one, query } from './db.js';
import { deviceKind, detectDevice, sha256 } from './util.js';

interface VisitorPresence {
  sessionId: string;
  preview: boolean;
  conns: Set<WebSocket>;
  device: string;
  kind: 'phone' | 'tablet' | 'desktop';
  viewport: { w: number; h: number } | null;
  page: string;
  pageSince: number;
  connectedAt: number;
  lastActivity: number;
  lastSeen: number;
  consent: boolean;
  recording: boolean;
  music: { playing: boolean; title: string | null };
  rtt: number | null;
  scroll: number;
}
interface AdminConn { ws: WebSocket; adminSessionId: string; watching: string | null; rtt: number | null }

const visitors = new Map<string, VisitorPresence>();
const admins = new Set<AdminConn>();
const leaveTimers = new Map<string, NodeJS.Timeout>();

function send(ws: WebSocket, msg: unknown) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

const watchersOf = (sessionId: string) => [...admins].filter((a) => a.watching === sessionId);

export function presenceSnapshot() {
  return [...visitors.values()].map((v) => ({
    sessionId: v.sessionId, preview: v.preview, online: v.conns.size > 0, device: v.device, kind: v.kind, viewport: v.viewport,
    page: v.page, pageSince: v.pageSince, connectedAt: v.connectedAt, lastActivity: v.lastActivity, lastSeen: v.lastSeen,
    consent: v.consent, recording: v.recording, watched: watchersOf(v.sessionId).length > 0, music: v.music, rtt: v.rtt, scroll: v.scroll,
  }));
}

let presenceTimer: NodeJS.Timeout | null = null;
function pushPresence() {
  if (presenceTimer) return;
  presenceTimer = setTimeout(() => {
    presenceTimer = null;
    const snap = { t: 'presence', visitors: presenceSnapshot(), now: Date.now() };
    for (const a of admins) send(a.ws, snap);
  }, 250);
}

function updateRecording(sessionId: string, restart = false) {
  const v = visitors.get(sessionId);
  if (!v) return;
  const want = v.consent && watchersOf(sessionId).length > 0;
  if (want !== v.recording || (want && restart)) {
    v.recording = want;
    for (const c of v.conns) send(c, { t: 'record', on: want });
    pushPresence();
  }
}

function watchStatus(a: AdminConn) {
  if (!a.watching) return;
  const v = visitors.get(a.watching);
  const state = !v || v.conns.size === 0 ? 'offline' : !v.consent ? 'no_consent' : v.recording ? 'live' : 'waiting';
  send(a.ws, { t: 'watch_status', sessionId: a.watching, state, kind: v?.kind, viewport: v?.viewport });
}

export const hub = {
  visitorEvent(sessionId: string, preview: boolean, event: { id: string; type: string; data: unknown; at: Date }) {
    const v = visitors.get(sessionId);
    if (v) { v.lastActivity = Date.now(); }
    for (const a of admins) send(a.ws, { t: 'event', sessionId, preview, event });
    pushPresence();
  },
  toAdmins(msg: unknown) {
    for (const a of admins) send(a.ws, msg);
  },
  toVisitor(sessionId: string, msg: unknown) {
    const v = visitors.get(sessionId);
    if (!v) return false;
    for (const c of v.conns) send(c, msg);
    return v.conns.size > 0;
  },
  consentChanged(sessionId: string, consent: boolean) {
    const v = visitors.get(sessionId);
    if (!v) return;
    v.consent = consent;
    updateRecording(sessionId, true);
    for (const a of watchersOf(sessionId)) watchStatus(a);
    pushPresence();
  },
  revokeAdminSession(adminSessionId: string) {
    for (const a of admins) if (a.adminSessionId === adminSessionId) a.ws.close(4001, 'revoked');
  },
  forget(sessionId: string) {
    const v = visitors.get(sessionId);
    if (v) for (const c of v.conns) c.close(4002, 'reset');
    visitors.delete(sessionId);
    pushPresence();
  },
};

async function authVisitor(req: IncomingMessage, url: URL) {
  const cookies = parseCookies(req.headers.cookie);
  if (url.searchParams.get('preview') === '1') {
    const admin = await resolveAdmin(cookies[ADMIN_COOKIE]);
    if (!admin) return null;
    const row = await one<{ id: string; live_consent: boolean }>(
      `SELECT id, live_consent FROM visitor_sessions WHERE is_preview AND admin_session_id = $1`, [admin.sessionId]);
    return row ? { ...row, preview: true } : null;
  }
  const token = cookies.gift_sid;
  if (!token) return null;
  const row = await one<{ id: string; live_consent: boolean }>(
    `SELECT v.id, v.live_consent FROM visitor_tokens t JOIN visitor_sessions v ON v.id = t.session_id
     WHERE t.token_hash = $1 AND NOT v.is_preview`, [sha256(token)]);
  return row ? { ...row, preview: false } : null;
}

async function logLeave(sessionId: string, preview: boolean) {
  const row = await one<{ id: string; created_at: Date }>(
    `INSERT INTO activity_logs (actor, session_id, is_preview, type, data) VALUES ('visitor', $1, $2, 'leave', '{}') RETURNING id, created_at`,
    [sessionId, preview]);
  hub.visitorEvent(sessionId, preview, { id: row!.id, type: 'leave', data: {}, at: row!.created_at });
}

const MAX_RR_BATCH = 4 * 1024 * 1024;

export function attachRealtime(server: Server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 * 1024 });

  server.on('upgrade', async (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname !== '/ws') return socket.destroy();
    const role = url.searchParams.get('role');
    // Same-origin check: the browser always sends Origin on WebSocket handshakes.
    const origin = req.headers.origin;
    if (origin && req.headers.host && new URL(origin).host !== req.headers.host) return socket.destroy();
    try {
      if (role === 'admin') {
        const admin = await resolveAdmin(parseCookies(req.headers.cookie)[ADMIN_COOKIE]);
        if (!admin) return socket.destroy();
        wss.handleUpgrade(req, socket, head, (ws) => onAdmin(ws, admin.sessionId));
      } else {
        const v = await authVisitor(req, url);
        if (!v) return socket.destroy();
        wss.handleUpgrade(req, socket, head, (ws) => onVisitor(ws, req, v));
      }
    } catch {
      socket.destroy();
    }
  });

  // Keep connections honest: drop sockets that stop answering pings, measure round trip time.
  setInterval(() => {
    for (const ws of wss.clients) {
      const w = ws as WebSocket & { alive?: boolean; pingAt?: number };
      if (w.alive === false) { ws.terminate(); continue; }
      w.alive = false;
      w.pingAt = Date.now();
      ws.ping();
    }
    pushPresence();
  }, 15_000).unref();
}

function trackAlive(ws: WebSocket, onRtt: (ms: number) => void) {
  const w = ws as WebSocket & { alive?: boolean; pingAt?: number };
  w.alive = true;
  ws.on('pong', () => { w.alive = true; if (w.pingAt) onRtt(Date.now() - w.pingAt); });
}

function onVisitor(ws: WebSocket, req: IncomingMessage, s: { id: string; live_consent: boolean; preview: boolean }) {
  const ua = req.headers['user-agent'];
  const device = detectDevice(ua);
  let v = visitors.get(s.id);
  const now = Date.now();
  const pending = leaveTimers.get(s.id);
  if (pending) { clearTimeout(pending); leaveTimers.delete(s.id); }
  if (!v) {
    v = {
      sessionId: s.id, preview: s.preview, conns: new Set(), device, kind: deviceKind(device), viewport: null,
      page: 'welcome', pageSince: now, connectedAt: now, lastActivity: now, lastSeen: now, consent: s.live_consent,
      recording: false, music: { playing: false, title: null }, rtt: null, scroll: 0,
    };
    visitors.set(s.id, v);
  } else if (v.conns.size === 0) {
    v.connectedAt = now;
  }
  const pres = v;
  pres.conns.add(ws);
  pres.consent = s.live_consent;
  pres.device = device;
  pres.kind = deviceKind(device);
  trackAlive(ws, (ms) => { pres.rtt = ms; });
  updateRecording(s.id, true);
  pushPresence();
  for (const a of watchersOf(s.id)) watchStatus(a);

  ws.on('message', (raw, isBinary) => {
    if (isBinary) return;
    let msg: any;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    pres.lastSeen = Date.now();
    switch (msg.t) {
      case 'hello':
        if (msg.viewport) pres.viewport = { w: Number(msg.viewport.w) || 0, h: Number(msg.viewport.h) || 0 };
        if (typeof msg.page === 'string') { pres.page = msg.page.slice(0, 40); pres.pageSince = Date.now(); }
        pushPresence();
        break;
      case 'page':
        if (typeof msg.page === 'string' && msg.page !== pres.page) {
          pres.page = msg.page.slice(0, 40);
          pres.pageSince = Date.now();
          pres.lastActivity = Date.now();
          pushPresence();
        }
        break;
      case 'activity':
        pres.lastActivity = Date.now();
        if (typeof msg.scroll === 'number') pres.scroll = Math.max(0, Math.min(1, msg.scroll));
        if (msg.viewport) pres.viewport = { w: Number(msg.viewport.w) || 0, h: Number(msg.viewport.h) || 0 };
        pushPresence();
        break;
      case 'music':
        pres.music = { playing: !!msg.playing, title: typeof msg.title === 'string' ? msg.title.slice(0, 120) : null };
        pushPresence();
        break;
      case 'rr': {
        // Never relay when the visitor has not consented, regardless of what the client says.
        if (!pres.consent || !pres.recording || !Array.isArray(msg.e)) return;
        if (raw.toString().length > MAX_RR_BATCH) return;
        const out = JSON.stringify({ t: 'rr', sessionId: s.id, e: msg.e, sentAt: msg.ts });
        for (const a of watchersOf(s.id)) if (a.ws.readyState === WebSocket.OPEN) a.ws.send(out);
        break;
      }
    }
  });

  ws.on('close', () => {
    pres.conns.delete(ws);
    if (pres.conns.size === 0) {
      pres.recording = false;
      pres.lastSeen = Date.now();
      for (const a of watchersOf(s.id)) watchStatus(a);
      pushPresence();
      leaveTimers.set(s.id, setTimeout(() => {
        leaveTimers.delete(s.id);
        if (pres.conns.size === 0) logLeave(s.id, s.preview).catch(() => {});
      }, 20_000));
    }
  });
}

function onAdmin(ws: WebSocket, adminSessionId: string) {
  const conn: AdminConn = { ws, adminSessionId, watching: null, rtt: null };
  admins.add(conn);
  trackAlive(ws, (ms) => { conn.rtt = ms; send(ws, { t: 'rtt', ms }); });
  send(ws, { t: 'presence', visitors: presenceSnapshot(), now: Date.now() });

  ws.on('message', (raw) => {
    let msg: any;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.t === 'watch' && typeof msg.sessionId === 'string') {
      const prev = conn.watching;
      conn.watching = msg.sessionId;
      if (prev && prev !== msg.sessionId) updateRecording(prev);
      // Restart so the new watcher receives a fresh full snapshot.
      updateRecording(msg.sessionId, true);
      watchStatus(conn);
      query(`INSERT INTO activity_logs (actor, type, data) VALUES ('admin', 'live_watch', $1)`, [{ sessionId: msg.sessionId }]).catch(() => {});
    } else if (msg.t === 'unwatch') {
      const prev = conn.watching;
      conn.watching = null;
      if (prev) updateRecording(prev);
    } else if (msg.t === 'resync' && conn.watching) {
      updateRecording(conn.watching, true);
    }
  });

  ws.on('close', () => {
    admins.delete(conn);
    if (conn.watching) updateRecording(conn.watching);
  });
}
