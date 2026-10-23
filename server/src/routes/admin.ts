import { Router } from 'express';
import multer from 'multer';
import { ADMIN_COOKIE, changePassword, getSecurity, login, logAdmin, requireAdmin } from '../auth.js';
import {
  discardDraft, exportContent, hasUnpublishedChanges, importContent, loadContent, publishDraft, saveList, saveSection,
} from '../content.js';
import { one, query } from '../db.js';
import { DEFAULT_ADMIN_PREFS, DEFAULT_SECURITY, LISTS, SECTIONS, withDefaults, type ListName, type SectionName } from '../defaults.js';
import { fetchJson, parseYouTubeId } from '../http.js';
import { hub, presenceSnapshot } from '../realtime.js';
import { deleteMedia, saveMedia } from '../storage.js';
import { ah, clampInt, HttpError, randomToken, rateLimit } from '../util.js';
import { applyMissionReward, gameNumbers, logVisitor, type GameRow, type VisitorRow } from '../visitor.js';

export const adminRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 40 * 1024 * 1024, files: 30 } });

adminRouter.post('/login', rateLimit('login', 10, 60_000), ah(async (req, res) => {
  res.json(await login(req, res));
}));

adminRouter.use(requireAdmin);

adminRouter.post('/logout', ah(async (req, res) => {
  await query(`UPDATE admin_sessions SET revoked_at = now() WHERE id = $1`, [req.admin!.sessionId]);
  await logAdmin(req, 'logout');
  hub.revokeAdminSession(req.admin!.sessionId);
  res.clearCookie(ADMIN_COOKIE, { path: '/' });
  res.json({ ok: true });
}));

adminRouter.get('/me', ah(async (req, res) => {
  const admin = await one<{ prefs: any; password_changed_at: Date; created_at: Date }>(
    `SELECT prefs, password_changed_at, created_at FROM admin_users WHERE id = $1`, [req.admin!.adminId]);
  res.json({
    username: req.admin!.username,
    prefs: withDefaults(DEFAULT_ADMIN_PREFS, admin?.prefs),
    // Encourage changing the initial password without ever revealing it.
    passwordIsInitial: admin ? admin.password_changed_at.getTime() - admin.created_at.getTime() < 1000 : false,
  });
}));

adminRouter.put('/prefs', ah(async (req, res) => {
  const prefs = withDefaults(DEFAULT_ADMIN_PREFS, req.body);
  await query(`UPDATE admin_users SET prefs = $1 WHERE id = $2`, [prefs, req.admin!.adminId]);
  res.json({ prefs });
}));

/* -------------------------------------------------------------- content */

adminRouter.get('/content', ah(async (_req, res) => {
  const [draft, publishedAt] = await Promise.all([
    loadContent('draft'),
    one<{ value: string }>(`SELECT value FROM app_kv WHERE key = 'published_at'`),
  ]);
  res.json({ ...draft, dirty: await hasUnpublishedChanges(), publishedAt: publishedAt?.value ?? null });
}));

adminRouter.put('/content/:section', ah(async (req, res) => {
  const name = req.params.section as SectionName;
  if (!(name in SECTIONS)) throw new HttpError(404, 'unknown section');
  const data = await saveSection(name, req.body ?? {});
  await logAdmin(req, 'save_draft', { section: name });
  res.json({ data, dirty: await hasUnpublishedChanges() });
}));

adminRouter.put('/list/:list', ah(async (req, res) => {
  const name = req.params.list as ListName;
  if (!(name in LISTS)) throw new HttpError(404, 'unknown list');
  if (!Array.isArray(req.body)) throw new HttpError(400, 'expected array');
  if (req.body.length > 500) throw new HttpError(400, 'too many items');
  const items = await saveList(name, req.body);
  await logAdmin(req, 'save_draft', { list: name, count: items.length });
  res.json({ items, dirty: await hasUnpublishedChanges() });
}));

adminRouter.post('/publish', ah(async (req, res) => {
  await publishDraft();
  await logAdmin(req, 'publish');
  hub.toAdmins({ t: 'published' });
  // Everyone currently on the site reloads their state to see the new version.
  for (const v of presenceSnapshot()) if (!v.preview) hub.toVisitor(v.sessionId, { t: 'refresh' });
  res.json({ ok: true, dirty: false });
}));

adminRouter.post('/discard', ah(async (req, res) => {
  await discardDraft();
  await logAdmin(req, 'discard_draft');
  res.json({ ok: true });
}));

adminRouter.get('/export', ah(async (req, res) => {
  await logAdmin(req, 'export_settings');
  res.setHeader('Content-Disposition', `attachment; filename="1st-gift-settings-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(await exportContent());
}));

adminRouter.post('/import', ah(async (req, res) => {
  await importContent(req.body);
  await logAdmin(req, 'import_settings');
  res.json({ ok: true, dirty: await hasUnpublishedChanges() });
}));

/* ---------------------------------------------------------------- media */

adminRouter.post('/upload', upload.array('files', 30), ah(async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (!files.length) throw new HttpError(400, 'ไม่มีไฟล์');
  const saved = [];
  const errors = [];
  for (const f of files) {
    try {
      saved.push(await saveMedia(f.buffer, Buffer.from(f.originalname, 'latin1').toString('utf8')));
    } catch (e: any) {
      errors.push({ filename: f.originalname, error: e.message });
    }
  }
  await logAdmin(req, 'upload', { count: saved.length });
  res.json({ files: saved.map((f) => ({ ...f, url: `/media/${f.id}` })), errors });
}));

adminRouter.get('/media', ah(async (req, res) => {
  const kind = String(req.query.kind ?? '');
  const rows = await query(
    `SELECT id, kind, filename, mime, size, created_at FROM media_files ${kind ? 'WHERE kind = $1' : ''} ORDER BY created_at DESC LIMIT 500`,
    kind ? [kind] : []);
  res.json(rows.map((r: any) => ({ ...r, url: `/media/${r.id}` })));
}));

adminRouter.delete('/media/:id', ah(async (req, res) => {
  await deleteMedia(req.params.id);
  await logAdmin(req, 'delete_media', { id: req.params.id });
  res.json({ ok: true });
}));

/* ---------------------------------------------------------------- stats */

adminRouter.get('/stats', ah(async (_req, res) => {
  const s = await one<any>(`
    SELECT
      (SELECT count(*) FROM visitor_sessions WHERE NOT is_preview)::int AS visitors,
      (SELECT count(*) FROM visitor_sessions WHERE NOT is_preview AND play_started_at IS NOT NULL)::int AS starts,
      (SELECT count(*) FROM visitor_sessions WHERE NOT is_preview AND birthday_passed)::int AS birthday_ok,
      (SELECT count(*) FROM guessing_attempts a JOIN visitor_sessions v ON v.id = a.session_id WHERE NOT v.is_preview)::int AS guesses,
      (SELECT count(*) FROM guessing_sessions g JOIN visitor_sessions v ON v.id = g.session_id WHERE NOT v.is_preview AND g.solved)::int AS solved,
      (SELECT count(*) FROM guessing_sessions g JOIN visitor_sessions v ON v.id = g.session_id WHERE NOT v.is_preview AND g.exhausted_count > 0)::int AS exhausted,
      (SELECT count(*) FROM exchange_requests r JOIN visitor_sessions v ON v.id = r.session_id WHERE NOT v.is_preview)::int AS exchanges,
      (SELECT count(*) FROM exchange_requests r JOIN visitor_sessions v ON v.id = r.session_id WHERE NOT v.is_preview AND r.status = 'pending')::int AS pending_requests,
      (SELECT count(*) FROM recipient_messages WHERE NOT is_test)::int AS messages,
      (SELECT count(*) FROM recipient_messages WHERE NOT is_test AND NOT is_read)::int AS unread,
      (SELECT count(*) FROM selfie_submissions WHERE NOT is_test)::int AS selfies,
      (SELECT count(*) FROM selfie_submissions WHERE NOT is_test AND NOT is_read)::int AS unread_selfies,
      (SELECT count(*) FROM visitor_sessions WHERE NOT is_preview AND gallery_opened)::int AS gallery,
      (SELECT count(*) FROM visitor_sessions WHERE NOT is_preview AND confession_opened)::int AS confession,
      (SELECT max(last_seen_at) FROM visitor_sessions WHERE NOT is_preview) AS last_visit
  `);
  const recent = await query(`
    SELECT l.id, l.session_id, l.type, l.data, l.created_at FROM activity_logs l
    WHERE l.actor = 'visitor' AND NOT l.is_preview ORDER BY l.id DESC LIMIT 15`);
  res.json({ ...s, recent, online: presenceSnapshot().filter((p) => p.online && !p.preview).length });
}));

/* ------------------------------------------------------------- sessions */

async function sessionSummaries(where = 'TRUE', params: unknown[] = []) {
  const content = await loadContent('published');
  const draft = await loadContent('draft');
  const rows = await query<VisitorRow & GameRow & { invite_label: string | null; guess_count: number; message_count: number; pending: number }>(`
    SELECT v.*, g.started_at AS game_started_at, g.attempts_used, g.extra_chances, g.hint_bonus, g.special_hints, g.solved, g.solved_via,
      g.solved_at, g.exhausted_count, i.label AS invite_label,
      (SELECT count(*) FROM guessing_attempts a WHERE a.session_id = v.id)::int AS guess_count,
      (SELECT count(*) FROM exchange_requests r WHERE r.session_id = v.id AND r.status = 'pending')::int AS pending
    FROM visitor_sessions v
    LEFT JOIN guessing_sessions g ON g.session_id = v.id
    LEFT JOIN invites i ON i.id = v.invite_id
    WHERE ${where} ORDER BY v.last_seen_at DESC LIMIT 300`, params);
  return rows.map((r: any) => {
    const c = r.is_preview ? draft : content;
    const game = {
      session_id: r.id, started_at: r.game_started_at, attempts_used: r.attempts_used ?? 0, extra_chances: r.extra_chances ?? 0,
      hint_bonus: r.hint_bonus ?? 0, special_hints: r.special_hints ?? [], solved: !!r.solved, solved_via: r.solved_via, solved_at: r.solved_at, exhausted_count: r.exhausted_count ?? 0,
    };
    const nums = gameNumbers({ session: r, game, stage: 'published', preview: r.is_preview, content: c });
    return {
      id: r.id, preview: r.is_preview, device: r.device, ip: r.ip, invite: r.invite_label, startedAt: r.started_at, lastSeenAt: r.last_seen_at,
      playStartedAt: r.play_started_at, birthdayPassed: r.birthday_passed, letterOpened: r.letter_opened, letterRead: r.letter_read,
      gameStarted: !!r.game_started_at, attemptsUsed: game.attempts_used, attemptsLeft: nums.left, attemptsTotal: nums.total,
      hintsUnlocked: nums.hintsUnlocked, hintsTotal: c.lists.hints.length, specialHints: game.special_hints, solved: game.solved, solvedVia: game.solved_via,
      exhausted: nums.exhausted, messageSent: r.message_sent, galleryOpened: r.gallery_opened, confessionOpened: r.confession_opened,
      liveConsent: r.live_consent, guessCount: r.guess_count, pendingRequests: r.pending,
    };
  });
}

adminRouter.get('/sessions', ah(async (req, res) => {
  const includePreview = req.query.preview === '1';
  res.json(await sessionSummaries(includePreview ? 'TRUE' : 'NOT v.is_preview'));
}));

adminRouter.get('/live', ah(async (_req, res) => {
  const presence = presenceSnapshot();
  const ids = presence.map((p) => p.sessionId);
  const recentIds = await query<{ id: string }>(`SELECT id FROM visitor_sessions WHERE last_seen_at > now() - interval '24 hours'`);
  const all = [...new Set([...ids, ...recentIds.map((r) => r.id)])];
  const sessions = all.length ? await sessionSummaries('v.id = ANY($1::uuid[])', [all]) : [];
  res.json({ presence, sessions, now: Date.now() });
}));

adminRouter.get('/sessions/:id', ah(async (req, res) => {
  const [summary] = await sessionSummaries('v.id = $1', [req.params.id]);
  if (!summary) throw new HttpError(404, 'not found');
  const [attempts, events, requests] = await Promise.all([
    query(`SELECT guess, correct, created_at FROM guessing_attempts WHERE session_id = $1 ORDER BY id`, [req.params.id]),
    query(`SELECT id, type, data, created_at FROM activity_logs WHERE session_id = $1 ORDER BY id DESC LIMIT 400`, [req.params.id]),
    query(`SELECT id, mission_title, submission, status, created_at, decided_at FROM exchange_requests WHERE session_id = $1 ORDER BY created_at`, [req.params.id]),
  ]);
  res.json({ summary, attempts, events: events.reverse(), requests });
}));

async function resetSession(id: string) {
  await query(`DELETE FROM guessing_attempts WHERE session_id = $1`, [id]);
  await query(`DELETE FROM exchange_requests WHERE session_id = $1`, [id]);
  await query(`DELETE FROM activity_logs WHERE session_id = $1`, [id]);
  await query(`UPDATE guessing_sessions SET started_at = NULL, attempts_used = 0, extra_chances = 0, hint_bonus = 0, special_hints = '[]',
               solved = false, solved_via = NULL, solved_at = NULL, exhausted_count = 0 WHERE session_id = $1`, [id]);
  await query(`UPDATE visitor_sessions SET play_started_at = NULL, birthday_passed = false, birthday_passed_at = NULL, birthday_fails = 0,
               birthday_locked_until = NULL, letter_opened = false, letter_read = false, celebrated = false, message_sent = false,
               gallery_opened = false, confession_opened = false WHERE id = $1`, [id]);
}

adminRouter.post('/sessions/:id/action', ah(async (req, res) => {
  const id = req.params.id;
  const s = await one<{ id: string; is_preview: boolean }>(`SELECT id, is_preview FROM visitor_sessions WHERE id = $1`, [id]);
  if (!s) throw new HttpError(404, 'not found');
  await query(`INSERT INTO guessing_sessions (session_id) VALUES ($1) ON CONFLICT DO NOTHING`, [id]);
  const action = String(req.body?.action ?? '');
  const amount = clampInt(req.body?.amount, 1, 20, 1);
  const pv = { id, preview: s.is_preview };
  switch (action) {
    case 'reset_attempts':
      await query(`UPDATE guessing_sessions SET attempts_used = 0, extra_chances = 0 WHERE session_id = $1`, [id]);
      await logVisitor(pv, 'admin_reset_attempts');
      break;
    case 'extra_chance':
      await query(`UPDATE guessing_sessions SET extra_chances = extra_chances + $2 WHERE session_id = $1`, [id, amount]);
      await logVisitor(pv, 'admin_extra_chance', { amount });
      break;
    case 'unlock_hint':
      await query(`UPDATE guessing_sessions SET hint_bonus = hint_bonus + 1 WHERE session_id = $1`, [id]);
      await logVisitor(pv, 'admin_unlock_hint');
      break;
    case 'special_hint': {
      const text = String(req.body?.text ?? '').trim().slice(0, 300);
      if (!text) throw new HttpError(400, 'ใส่คำใบ้ก่อน');
      await query(`UPDATE guessing_sessions SET special_hints = special_hints || to_jsonb($2::text) WHERE session_id = $1`, [id, text]);
      await logVisitor(pv, 'admin_special_hint');
      break;
    }
    case 'reveal':
      await query(`UPDATE guessing_sessions SET solved = true, solved_via = 'admin', solved_at = now() WHERE session_id = $1 AND NOT solved`, [id]);
      await logVisitor(pv, 'solved', { via: 'admin' });
      break;
    case 'reset_birthday_lock':
      await query(`UPDATE visitor_sessions SET birthday_fails = 0, birthday_locked_until = NULL WHERE id = $1`, [id]);
      break;
    case 'reset_all':
      await resetSession(id);
      await logVisitor(pv, 'admin_reset_session');
      break;
    case 'surprise': {
      const kind = ['hearts', 'confetti', 'message', 'stars'].includes(req.body?.kind) ? req.body.kind : 'hearts';
      const text = String(req.body?.text ?? '').slice(0, 200);
      const delivered = hub.toVisitor(id, { t: 'surprise', kind, text });
      await logVisitor(pv, 'admin_surprise', { kind });
      await logAdmin(req, 'send_surprise', { sessionId: id, kind });
      return res.json({ ok: true, delivered });
    }
    case 'delete':
      hub.forget(id);
      await query(`DELETE FROM visitor_sessions WHERE id = $1`, [id]);
      await logAdmin(req, 'delete_session', { sessionId: id });
      return res.json({ ok: true });
    // Simulation helpers for the preview tester.
    case 'sim_pass_birthday':
      await query(`UPDATE visitor_sessions SET birthday_passed = true, play_started_at = coalesce(play_started_at, now()) WHERE id = $1`, [id]);
      break;
    case 'sim_read_letter':
      await query(`UPDATE visitor_sessions SET birthday_passed = true, letter_opened = true, letter_read = true WHERE id = $1`, [id]);
      break;
    case 'sim_exhaust': {
      const content = await loadContent(s.is_preview ? 'draft' : 'published');
      await query(`UPDATE visitor_sessions SET birthday_passed = true, letter_opened = true, letter_read = true WHERE id = $1`, [id]);
      await query(`UPDATE guessing_sessions SET started_at = coalesce(started_at, now()), attempts_used = $2 + extra_chances, solved = false WHERE session_id = $1`,
        [id, Math.max(1, Number(content.sections.game.maxAttempts) || 5)]);
      break;
    }
    default:
      throw new HttpError(400, 'unknown action');
  }
  await logAdmin(req, 'session_action', { sessionId: id, action });
  hub.toVisitor(id, { t: 'refresh' });
  res.json({ ok: true });
}));

/** Preview session of the current admin (used by the simulator). */
adminRouter.get('/preview-session', ah(async (req, res) => {
  const row = await one<{ id: string }>(`SELECT id FROM visitor_sessions WHERE is_preview AND admin_session_id = $1`, [req.admin!.sessionId]);
  res.json({ id: row?.id ?? null });
}));

adminRouter.post('/preview/reset', ah(async (req, res) => {
  const rows = await query<{ id: string }>(`SELECT id FROM visitor_sessions WHERE is_preview AND admin_session_id = $1`, [req.admin!.sessionId]);
  for (const r of rows) {
    await resetSession(r.id);
    hub.toVisitor(r.id, { t: 'refresh' });
  }
  if (req.body?.messages) await query(`DELETE FROM recipient_messages WHERE is_test`);
  await logAdmin(req, 'reset_preview');
  res.json({ ok: true });
}));

adminRouter.post('/reset-play-data', ah(async (req, res) => {
  if (req.body?.confirm !== 'RESET') throw new HttpError(400, 'ต้องยืนยันด้วยการพิมพ์ RESET');
  for (const v of presenceSnapshot()) if (!v.preview) hub.forget(v.sessionId);
  await query(`DELETE FROM activity_logs WHERE actor = 'visitor' AND NOT is_preview`);
  if (req.body?.messages) await query(`DELETE FROM recipient_messages`);
  await query(`DELETE FROM visitor_sessions WHERE NOT is_preview`);
  await logAdmin(req, 'reset_play_data', { messages: !!req.body?.messages });
  res.json({ ok: true });
}));

/* -------------------------------------------------------- guesses & missions */

adminRouter.get('/attempts', ah(async (_req, res) => {
  res.json(await query(`
    SELECT a.id, a.session_id, a.guess, a.correct, a.created_at, v.device, v.is_preview
    FROM guessing_attempts a JOIN visitor_sessions v ON v.id = a.session_id ORDER BY a.id DESC LIMIT 500`));
}));

adminRouter.get('/requests', ah(async (_req, res) => {
  res.json(await query(`
    SELECT r.*, v.device, v.is_preview FROM exchange_requests r JOIN visitor_sessions v ON v.id = r.session_id
    WHERE r.status <> 'failed' OR r.created_at > now() - interval '7 days'
    ORDER BY (r.status = 'pending') DESC, r.created_at DESC LIMIT 300`));
}));

adminRouter.post('/requests/:id/decide', ah(async (req, res) => {
  const approve = !!req.body?.approve;
  const r = await one<{ id: string; session_id: string; mission_id: string; status: string }>(
    `UPDATE exchange_requests SET status = $2, decided_at = now(), note = $3 WHERE id = $1 AND status = 'pending' RETURNING *`,
    [req.params.id, approve ? 'approved' : 'rejected', String(req.body?.note ?? '').slice(0, 300)]);
  if (!r) throw new HttpError(409, 'คำขอนี้ถูกตัดสินไปแล้ว');
  const s = await one<{ is_preview: boolean }>(`SELECT is_preview FROM visitor_sessions WHERE id = $1`, [r.session_id]);
  const content = await loadContent(s?.is_preview ? 'draft' : 'published');
  const mission = content.lists.missions.find((m) => m.id === r.mission_id);
  if (approve && mission) await applyMissionReward(r.session_id, !!s?.is_preview, mission);
  await logVisitor({ id: r.session_id, preview: !!s?.is_preview }, approve ? 'exchange_approved' : 'exchange_rejected', { mission: mission?.title ?? '' });
  await logAdmin(req, approve ? 'approve_request' : 'reject_request', { requestId: r.id });
  hub.toVisitor(r.session_id, { t: 'refresh' });
  hub.toAdmins({ t: 'requests_changed' });
  res.json({ ok: true });
}));

/* ------------------------------------------------------------- messages */

adminRouter.get('/messages', ah(async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const test = req.query.test === '1';
  const params: unknown[] = [test];
  let where = 'm.is_test = $1';
  if (q) { params.push(`%${q}%`); where += ` AND m.content ILIKE $2`; }
  res.json(await query(`
    SELECT m.id, m.session_id, m.content, m.char_count, m.is_read, m.is_test, m.created_at, v.device
    FROM recipient_messages m LEFT JOIN visitor_sessions v ON v.id = m.session_id
    WHERE ${where} ORDER BY m.created_at DESC LIMIT 500`, params));
}));

adminRouter.patch('/messages/:id', ah(async (req, res) => {
  await query(`UPDATE recipient_messages SET is_read = $2 WHERE id = $1`, [req.params.id, !!req.body?.read]);
  res.json({ ok: true });
}));

adminRouter.delete('/messages/:id', ah(async (req, res) => {
  await query(`DELETE FROM recipient_messages WHERE id = $1`, [req.params.id]);
  await logAdmin(req, 'delete_message', { id: req.params.id });
  res.json({ ok: true });
}));

adminRouter.get('/messages.csv', ah(async (req, res) => {
  const rows = await query<{ created_at: Date; content: string; char_count: number; is_read: boolean; device: string | null }>(`
    SELECT m.created_at, m.content, m.char_count, m.is_read, v.device FROM recipient_messages m
    LEFT JOIN visitor_sessions v ON v.id = m.session_id WHERE m.is_test = $1 ORDER BY m.created_at`, [req.query.test === '1']);
  const esc = (v: unknown) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // prevent spreadsheet formula injection
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [['sent_at', 'message', 'characters', 'read', 'device'].join(',')];
  for (const r of rows) lines.push([r.created_at.toISOString(), r.content, r.char_count, r.is_read ? 'yes' : 'no', r.device].map(esc).join(','));
  await logAdmin(req, 'export_messages');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="messages-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send('﻿' + lines.join('\r\n'));
}));

/* -------------------------------------------------------------- youtube music */

// Optional YouTube Data API key enables in-admin song search. Stored admin-side only, never sent to visitors.
adminRouter.get('/youtube-key', ah(async (_req, res) => {
  const row = await one<{ value: string }>(`SELECT value FROM app_kv WHERE key = 'youtube_api_key'`);
  res.json({ set: !!(row?.value && String(row.value).length > 10) });
}));

adminRouter.put('/youtube-key', ah(async (req, res) => {
  const key = String(req.body?.key ?? '').trim();
  if (key) {
    await query(`INSERT INTO app_kv (key, value) VALUES ('youtube_api_key', to_jsonb($1::text))
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [key]);
  } else {
    await query(`DELETE FROM app_kv WHERE key = 'youtube_api_key'`);
  }
  await logAdmin(req, 'youtube_key_set', { set: !!key });
  res.json({ set: !!key });
}));

// Resolve a pasted link/id to a video id + title (no API key needed; uses YouTube oEmbed).
adminRouter.get('/youtube-info', ah(async (req, res) => {
  const id = parseYouTubeId(String(req.query.q ?? ''));
  if (!id) throw new HttpError(400, 'ลิงก์ YouTube ไม่ถูกต้อง');
  try {
    const data = await fetchJson<{ title: string; author_name: string }>(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`);
    res.json({ videoId: id, title: data.title, author: data.author_name });
  } catch {
    // Still usable — the admin can set the title by hand.
    res.json({ videoId: id, title: '', author: '' });
  }
}));

adminRouter.get('/youtube-search', rateLimit('ytsearch', 30, 60_000), ah(async (req, res) => {
  const q = String(req.query.q ?? '').trim().slice(0, 100);
  if (!q) throw new HttpError(400, 'ใส่ชื่อเพลงก่อน');
  const row = await one<{ value: string }>(`SELECT value FROM app_kv WHERE key = 'youtube_api_key'`);
  const key = row?.value;
  if (!key) throw new HttpError(409, 'ยังไม่ได้ตั้งค่า YouTube API Key (ใส่คีย์เพื่อค้นหาในแอดมิน หรือใช้วิธีวางลิงก์แทนได้)', { noKey: true });
  try {
    const data = await fetchJson<any>(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=12&q=${encodeURIComponent(q)}&key=${encodeURIComponent(key)}`);
    const items = (data.items ?? []).map((it: any) => ({
      videoId: it.id?.videoId, title: it.snippet?.title, author: it.snippet?.channelTitle,
      thumb: it.snippet?.thumbnails?.default?.url ?? null,
    })).filter((x: any) => x.videoId);
    res.json({ items });
  } catch (e: any) {
    throw new HttpError(502, 'ค้นหาไม่สำเร็จ ตรวจสอบ API Key หรือโควตา (หรือใช้วิธีวางลิงก์แทน)');
  }
}));

/* -------------------------------------------------------------- selfies */

adminRouter.get('/selfies', ah(async (req, res) => {
  const test = req.query.test === '1';
  const rows = await query(`
    SELECT s.id, s.kind, s.media_id, s.is_read, s.is_test, s.created_at, v.device
    FROM selfie_submissions s LEFT JOIN visitor_sessions v ON v.id = s.session_id
    WHERE s.is_test = $1 ORDER BY s.created_at DESC LIMIT 300`, [test]);
  // Mark the shown ones as read.
  await query(`UPDATE selfie_submissions SET is_read = true WHERE is_test = $1 AND NOT is_read`, [test]);
  res.json(rows.map((r: any) => ({ ...r, url: `/media/${r.media_id}` })));
}));

adminRouter.delete('/selfies/:id', ah(async (req, res) => {
  const row = await one<{ media_id: string }>(`DELETE FROM selfie_submissions WHERE id = $1 RETURNING media_id`, [req.params.id]);
  if (row) await deleteMedia(row.media_id).catch(() => {});
  await logAdmin(req, 'delete_selfie', { id: req.params.id });
  res.json({ ok: true });
}));

/* -------------------------------------------------------------- invites */

adminRouter.get('/invites', ah(async (_req, res) => {
  res.json(await query(`SELECT * FROM invites ORDER BY created_at DESC`));
}));

adminRouter.post('/invites', ah(async (req, res) => {
  const code = randomToken(9);
  const row = await one(`INSERT INTO invites (code, label) VALUES ($1, $2) RETURNING *`, [code, String(req.body?.label ?? '').slice(0, 80)]);
  await logAdmin(req, 'create_invite');
  res.json(row);
}));

adminRouter.patch('/invites/:id', ah(async (req, res) => {
  const row = await one(`UPDATE invites SET enabled = coalesce($2, enabled), label = coalesce($3, label) WHERE id = $1 RETURNING *`,
    [req.params.id, typeof req.body?.enabled === 'boolean' ? req.body.enabled : null, typeof req.body?.label === 'string' ? req.body.label.slice(0, 80) : null]);
  res.json(row);
}));

adminRouter.delete('/invites/:id', ah(async (req, res) => {
  await query(`DELETE FROM invites WHERE id = $1`, [req.params.id]);
  await logAdmin(req, 'delete_invite');
  res.json({ ok: true });
}));

/* ------------------------------------------------------------- security */

adminRouter.post('/password', rateLimit('password', 5, 60_000), ah(async (req, res) => {
  await changePassword(req);
  res.json({ ok: true });
}));

adminRouter.get('/admin-sessions', ah(async (req, res) => {
  const rows = await query(`SELECT id, ip, user_agent, created_at, last_seen_at, expires_at FROM admin_sessions
    WHERE revoked_at IS NULL AND expires_at > now() ORDER BY last_seen_at DESC`);
  res.json(rows.map((r: any) => ({ ...r, current: r.id === req.admin!.sessionId })));
}));

adminRouter.delete('/admin-sessions/:id', ah(async (req, res) => {
  await query(`UPDATE admin_sessions SET revoked_at = now() WHERE id = $1`, [req.params.id]);
  hub.revokeAdminSession(req.params.id);
  await logAdmin(req, 'revoke_session', { id: req.params.id });
  res.json({ ok: true });
}));

adminRouter.get('/security', ah(async (_req, res) => {
  const attempts = await query(`SELECT ip, user_agent, success, created_at FROM login_attempts ORDER BY id DESC LIMIT 100`);
  res.json({ settings: await getSecurity(), attempts });
}));

adminRouter.put('/security', ah(async (req, res) => {
  const settings = {
    maxLoginAttempts: clampInt(req.body?.maxLoginAttempts, 3, 20, DEFAULT_SECURITY.maxLoginAttempts),
    lockMinutes: clampInt(req.body?.lockMinutes, 1, 1440, DEFAULT_SECURITY.lockMinutes),
    sessionDays: clampInt(req.body?.sessionDays, 1, 60, DEFAULT_SECURITY.sessionDays),
  };
  await query(`INSERT INTO app_kv (key, value) VALUES ('security', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [settings]);
  await logAdmin(req, 'security_settings');
  res.json({ settings });
}));

adminRouter.get('/logs', ah(async (req, res) => {
  const actor = req.query.actor === 'visitor' ? 'visitor' : req.query.actor === 'all' ? null : 'admin';
  const rows = await query(`SELECT id, actor, session_id, is_preview, type, data, ip, created_at FROM activity_logs
    ${actor ? 'WHERE actor = $1' : ''} ORDER BY id DESC LIMIT 500`, actor ? [actor] : []);
  res.json(rows);
}));

