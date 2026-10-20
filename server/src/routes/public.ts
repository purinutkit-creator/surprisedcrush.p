import { Router } from 'express';
import multer from 'multer';
import { loadContent } from '../content.js';
import { one, query } from '../db.js';
import { hub } from '../realtime.js';
import { deleteMedia, saveMedia } from '../storage.js';
import { ah, HttpError, rateLimit } from '../util.js';
import {
  BlockedError, buildState, checkBirthday, getConfession, guess, logVisitor, markProgress, requireVisitor,
  resolveVisitor, sendMessage, startWithoutBirthday, submitMission,
} from '../visitor.js';

export const publicRouter = Router();

publicRouter.use(rateLimit('public', 240, 60_000));

/** Shown instead of the gift when the site is closed or an invite is required. */
async function gate(req: any) {
  if (req.get('x-gift-preview') === '1' || req.query.preview === '1') return null;
  const w = (await loadContent('published')).sections.website;
  if (w.siteClosed) return { closed: true, title: w.closedTitle, message: w.closedMessage, site: { siteName: w.siteName, footerText: w.footerText } };
  return null;
}

async function stateOrGate(req: any, res: any) {
  const closed = await gate(req);
  if (closed) return closed;
  try {
    const ctx = await requireVisitor(req, res);
    return await buildState(ctx);
  } catch (e) {
    if (e instanceof BlockedError) {
      const w = (await loadContent('published')).sections.website;
      return { blocked: true, title: e.extra.title, message: e.message, site: { siteName: w.siteName, footerText: w.footerText } };
    }
    throw e;
  }
}

/** Re-resolve after a mutation so the response always reflects the database. */
async function fresh(req: any, res: any) {
  const ctx = await requireVisitor(req, res);
  return buildState(ctx);
}

async function ensureOpen(req: any) {
  if (await gate(req)) throw new HttpError(503, 'closed');
}

publicRouter.get('/state', ah(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(await stateOrGate(req, res));
}));

publicRouter.post('/birthday', rateLimit('birthday', 12, 60_000), ah(async (req, res) => {
  await ensureOpen(req);
  const ctx = await requireVisitor(req, res);
  const result = await checkBirthday(ctx, req.body);
  res.json({ ...result, state: await fresh(req, res) });
}));

publicRouter.post('/start', ah(async (req, res) => {
  await ensureOpen(req);
  const ctx = await requireVisitor(req, res);
  await startWithoutBirthday(ctx);
  res.json({ ok: true, state: await fresh(req, res) });
}));

publicRouter.post('/progress', ah(async (req, res) => {
  await ensureOpen(req);
  const ctx = await requireVisitor(req, res);
  await markProgress(ctx, String(req.body?.event ?? ''));
  res.json({ ok: true, state: await fresh(req, res) });
}));

publicRouter.post('/guess', rateLimit('guess', 20, 60_000), ah(async (req, res) => {
  await ensureOpen(req);
  const ctx = await requireVisitor(req, res);
  const result = await guess(ctx, req.body?.name);
  res.json({ ...result, state: await fresh(req, res) });
}));

publicRouter.post('/exchange/:missionId', rateLimit('exchange', 20, 60_000), ah(async (req, res) => {
  await ensureOpen(req);
  const ctx = await requireVisitor(req, res);
  const result = await submitMission(ctx, req.params.missionId, req.body?.submission);
  res.json({ ...result, state: await fresh(req, res) });
}));

publicRouter.post('/message', rateLimit('message', 6, 60_000), ah(async (req, res) => {
  await ensureOpen(req);
  const ctx = await requireVisitor(req, res);
  const result = await sendMessage(ctx, req.body?.content);
  res.json({ ...result, state: await fresh(req, res) });
}));

publicRouter.get('/confession', ah(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const closed = await gate(req);
  if (closed) return res.json(closed);
  const ctx = await requireVisitor(req, res);
  const confession = await getConfession(ctx);
  res.json({ confession, state: await buildState(await requireVisitor(req, res)) });
}));

publicRouter.post('/consent', ah(async (req, res) => {
  const ctx = await requireVisitor(req, res);
  const live = req.body?.live;
  const ack = req.body?.ack;
  const liveAllowed = ctx.content.sections.website.tracking.liveViewEnabled;
  if (ack === true) await query(`UPDATE visitor_sessions SET tracking_ack = true WHERE id = $1`, [ctx.session.id]);
  if (typeof live === 'boolean') {
    const value = live && liveAllowed;
    await query(`UPDATE visitor_sessions SET live_consent = $2, tracking_ack = true WHERE id = $1`, [ctx.session.id, value]);
    if (value !== ctx.session.live_consent) {
      await logVisitor({ id: ctx.session.id, preview: ctx.preview }, value ? 'live_consent_on' : 'live_consent_off');
    }
    hub.consentChanged(ctx.session.id, value);
  }
  res.json({ ok: true, state: await fresh(req, res) });
}));

const selfieUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 } });

publicRouter.post('/selfie', rateLimit('selfie', 12, 60_000), selfieUpload.single('photo'), ah(async (req, res) => {
  await ensureOpen(req);
  const ctx = await requireVisitor(req, res);
  if (!ctx.content.sections.selfie.enabled) throw new HttpError(403, 'ตอนนี้ยังไม่เปิดให้ถ่ายรูปน้า');
  const file = req.file;
  if (!file) throw new HttpError(400, 'ยังไม่มีรูปเลยน้า');
  const kind = ['gift', 'together'].includes(req.body?.kind) ? req.body.kind : 'gift';
  const media = await saveMedia(file.buffer, `selfie-${kind}.jpg`);
  if (media.kind !== 'image') { await deleteMedia(media.id); throw new HttpError(400, 'ต้องเป็นรูปภาพเท่านั้นน้า'); }
  const row = await one<{ id: string }>(
    `INSERT INTO selfie_submissions (session_id, media_id, kind, is_test) VALUES ($1,$2,$3,$4) RETURNING id`,
    [ctx.session.id, media.id, kind, ctx.preview]);
  await query(`UPDATE visitor_sessions SET selfie_done = true WHERE id = $1`, [ctx.session.id]);
  await logVisitor({ id: ctx.session.id, preview: ctx.preview }, 'selfie_sent', { kind });
  hub.toAdmins({ t: 'selfie_new', preview: ctx.preview });
  res.json({ ok: true, state: await fresh(req, res) });
}));

const TRACK_TYPES = new Set([
  'page_view', 'birthday_typing', 'letter_opening', 'message_typing', 'photo_open', 'fyi_open', 'fyi_item',
  'music_on', 'music_off', 'confession_replay', 'reread_letter', 'hint_view',
]);

publicRouter.post('/track', rateLimit('track', 90, 60_000), ah(async (req, res) => {
  const ctx = await resolveVisitor(req, res, { create: false });
  const type = String(req.body?.type ?? '');
  if (!ctx || !TRACK_TYPES.has(type)) return res.status(204).end();
  const raw = req.body?.data && typeof req.body.data === 'object' ? req.body.data : {};
  // Keep only short primitive values; nothing typed by the visitor is accepted here.
  const data: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(raw).slice(0, 6)) {
    if (typeof v === 'number' || typeof v === 'boolean') data[k.slice(0, 20)] = v;
    else if (typeof v === 'string') data[k.slice(0, 20)] = v.slice(0, 60);
  }
  await logVisitor({ id: ctx.session.id, preview: ctx.preview }, type, data);
  res.status(204).end();
}));
