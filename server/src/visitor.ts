import type { Request, Response } from 'express';
import { ADMIN_COOKIE, resolveAdmin } from './auth.js';
import { loadContent, type Content, type ListItem } from './content.js';
import { one, query, type Stage } from './db.js';
import { hub } from './realtime.js';
import { mediaUrl } from './storage.js';
import { countChars, detectDevice, fill, HttpError, normalizeAnswer, pickRandom, randomToken, sha256 } from './util.js';

export const VISITOR_COOKIE = 'gift_sid';
const YEAR_MS = 365 * 86400_000;

export interface VisitorRow {
  id: string; is_preview: boolean; invite_id: string | null; device: string | null;
  started_at: Date; last_seen_at: Date; play_started_at: Date | null;
  birthday_passed: boolean; birthday_fails: number; birthday_locked_until: Date | null;
  letter_opened: boolean; letter_read: boolean; celebrated: boolean; message_sent: boolean;
  gallery_opened: boolean; confession_opened: boolean; live_consent: boolean; tracking_ack: boolean;
  selfie_done: boolean;
}
export interface GameRow {
  session_id: string; started_at: Date | null; attempts_used: number; extra_chances: number; hint_bonus: number;
  special_hints: string[]; solved: boolean; solved_via: string | null; solved_at: Date | null; exhausted_count: number;
}
export interface VisitorCtx { session: VisitorRow; game: GameRow; stage: Stage; preview: boolean; content: Content }

export class BlockedError extends HttpError {}

const isPreviewReq = (req: Request) => req.get('x-gift-preview') === '1' || req.query.preview === '1';

async function loadSessionRows(id: string) {
  const session = await one<VisitorRow>(`SELECT * FROM visitor_sessions WHERE id = $1`, [id]);
  if (!session) return null;
  await query(`INSERT INTO guessing_sessions (session_id) VALUES ($1) ON CONFLICT DO NOTHING`, [id]);
  const game = (await one<GameRow>(`SELECT * FROM guessing_sessions WHERE session_id = $1`, [id]))!;
  return { session, game };
}

async function attachToken(res: Response, sessionId: string) {
  const token = randomToken();
  await query(`INSERT INTO visitor_tokens (token_hash, session_id) VALUES ($1, $2)`, [sha256(token), sessionId]);
  res.cookie(VISITOR_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: req_secure(), path: '/', maxAge: YEAR_MS });
}
const req_secure = () => process.env.NODE_ENV === 'production';

/**
 * Find (or create) the visitor session for this request.
 * Preview requests from a signed-in admin get an isolated preview session that reads draft content.
 */
export async function resolveVisitor(req: Request, res: Response | null, opts: { create: boolean }): Promise<VisitorCtx | null> {
  if (isPreviewReq(req)) {
    const admin = await resolveAdmin(req.cookies?.[ADMIN_COOKIE]);
    if (!admin) throw new HttpError(401, 'Preview ต้องเข้าสู่ระบบแอดมินก่อน');
    let row = await one<{ id: string }>(`SELECT id FROM visitor_sessions WHERE is_preview AND admin_session_id = $1`, [admin.sessionId]);
    if (!row) {
      row = await one<{ id: string }>(
        `INSERT INTO visitor_sessions (is_preview, admin_session_id, ip, user_agent, device, tracking_ack)
         VALUES (true, $1, $2, $3, $4, true) RETURNING id`,
        [admin.sessionId, req.ip, req.get('user-agent') ?? '', detectDevice(req.get('user-agent'))]);
    }
    const rows = (await loadSessionRows(row!.id))!;
    return { ...rows, stage: 'draft', preview: true, content: await loadContent('draft') };
  }

  const content = await loadContent('published');
  const website = content.sections.website;
  const token = req.cookies?.[VISITOR_COOKIE];
  if (token) {
    const t = await one<{ session_id: string }>(
      `SELECT t.session_id FROM visitor_tokens t JOIN visitor_sessions v ON v.id = t.session_id
       WHERE t.token_hash = $1 AND NOT v.is_preview`, [sha256(token)]);
    if (t) {
      const ua = req.get('user-agent') ?? '';
      await query(`UPDATE visitor_sessions SET last_seen_at = now(), ip = $2, user_agent = $3, device = $4 WHERE id = $1`,
        [t.session_id, req.ip, ua, detectDevice(ua)]);
      const rows = (await loadSessionRows(t.session_id))!;
      return { ...rows, stage: 'published', preview: false, content };
    }
  }
  if (!opts.create || !res) return null;

  const inviteCode = String(req.query.invite ?? req.get('x-gift-invite') ?? '').trim();
  let invite: { id: string } | undefined;
  if (inviteCode) invite = await one(`SELECT id FROM invites WHERE code = $1 AND enabled`, [inviteCode]);
  if (website.progress.requireInvite && !invite) {
    throw new BlockedError(403, website.progress.blockedMessage, { blocked: true, title: website.progress.blockedTitle });
  }
  const ua = req.get('user-agent') ?? '';
  const deviceHash = sha256(`${req.ip}|${ua}`);
  let sessionId: string | undefined;

  if (website.progress.binding === 'invite' && invite) {
    sessionId = (await one<{ id: string }>(
      `SELECT id FROM visitor_sessions WHERE invite_id = $1 AND NOT is_preview ORDER BY started_at LIMIT 1`, [invite.id]))?.id;
  } else if (website.progress.binding === 'device') {
    sessionId = (await one<{ id: string }>(
      `SELECT id FROM visitor_sessions WHERE device_hash = $1 AND NOT is_preview AND last_seen_at > now() - interval '60 days'
       ORDER BY last_seen_at DESC LIMIT 1`, [deviceHash]))?.id;
  }
  if (!sessionId) {
    sessionId = (await one<{ id: string }>(
      `INSERT INTO visitor_sessions (device_hash, invite_id, ip, user_agent, device) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [deviceHash, invite?.id ?? null, req.ip, ua, detectDevice(ua)]))!.id;
    if (invite) await query(`UPDATE invites SET uses = uses + 1 WHERE id = $1`, [invite.id]);
    await logVisitor({ id: sessionId, preview: false }, 'enter', { device: detectDevice(ua), invite: invite ? inviteCode : null });
  }
  await attachToken(res, sessionId);
  const rows = (await loadSessionRows(sessionId))!;
  return { ...rows, stage: 'published', preview: false, content };
}

export async function requireVisitor(req: Request, res: Response) {
  const ctx = await resolveVisitor(req, res, { create: true });
  if (!ctx) throw new HttpError(401, 'session');
  return ctx;
}

export async function logVisitor(s: { id: string; preview: boolean }, type: string, data: Record<string, unknown> = {}) {
  const row = await one<{ id: string; created_at: Date }>(
    `INSERT INTO activity_logs (actor, session_id, is_preview, type, data) VALUES ('visitor', $1, $2, $3, $4) RETURNING id, created_at`,
    [s.id, s.preview, type, data]);
  hub.visitorEvent(s.id, s.preview, { id: row!.id, type, data, at: row!.created_at });
}

/* ---------------------------------------------------------------- flow */

export function vars(c: Content) {
  const r = c.sections.recipient;
  return { NAME: r.nickname, CALL: r.callPrefix, FULLNAME: r.fullName || r.nickname };
}

export const birthdayCheckActive = (c: Content) => {
  const r = c.sections.recipient;
  return r.birthdayCheckEnabled && /^\d{4}-\d{2}-\d{2}$/.test(r.birthday);
};

export function gameNumbers(ctx: VisitorCtx) {
  const g = ctx.content.sections.game;
  const total = Math.max(1, Number(g.maxAttempts) || 5) + ctx.game.extra_chances;
  const left = Math.max(0, total - ctx.game.attempts_used);
  const hintsUnlocked = Math.min(ctx.content.lists.hints.length, ctx.game.attempts_used + ctx.game.hint_bonus);
  return { total, left, hintsUnlocked, exhausted: !ctx.game.solved && left === 0 };
}

const pagesOf = (c: Content) => c.sections.website.pages as Record<string, boolean>;
export const gameDone = (ctx: VisitorCtx) => !pagesOf(ctx.content).game || ctx.game.solved;
export const canMessage = (ctx: VisitorCtx) => ctx.session.birthday_passed && gameDone(ctx) && pagesOf(ctx.content).message;
export const canGallery = (ctx: VisitorCtx) =>
  ctx.session.birthday_passed && gameDone(ctx) && (!pagesOf(ctx.content).message || ctx.session.message_sent);

export function canConfession(ctx: VisitorCtx) {
  const p = pagesOf(ctx.content);
  const c = ctx.content.sections.confession;
  if (!p.confession || !ctx.session.birthday_passed || !gameDone(ctx)) return false;
  if (c.requireMessage && p.message && !ctx.session.message_sent) return false;
  if (c.requireGallery && p.gallery && !ctx.session.gallery_opened) return false;
  return true;
}

export type Step = 'welcome' | 'letter' | 'game' | 'exchange' | 'correct' | 'message' | 'gallery' | 'end';

export function currentStep(ctx: VisitorCtx): Step {
  const p = pagesOf(ctx.content);
  if (!ctx.session.birthday_passed) return 'welcome';
  if (p.letter && !ctx.session.letter_read) return 'letter';
  if (p.game && !ctx.game.solved) return gameNumbers(ctx).exhausted ? 'exchange' : 'game';
  if (p.game && ctx.game.solved && !ctx.session.celebrated) return 'correct';
  if (p.message && !ctx.session.message_sent) return 'message';
  if (p.gallery) return 'gallery';
  return 'end';
}

/* ------------------------------------------------------------- projections */

const trackUrl = (t: ListItem) => (t.source === 'url' ? (/^https?:\/\//i.test(t.url) ? t.url : null) : mediaUrl(t.mediaId));

export function publicTheme(c: Content) {
  const t = c.sections.theme;
  return {
    ...t,
    background: { ...t.background, imageUrl: mediaUrl(t.background?.imageId) },
    customFonts: (t.customFonts ?? []).map((f: any) => ({ family: f.family, url: mediaUrl(f.mediaId) })).filter((f: any) => f.url),
  };
}

function publicFyi(c: Content) {
  const f = c.sections.fyi;
  return {
    enabled: f.enabled, buttonLabel: f.buttonLabel, title: f.title, subtitle: f.subtitle, display: f.display, pages: f.pages,
    items: c.lists.fyiItems.filter((i) => i.published).map((i) => {
      const { title: _internal, ...rest } = i;
      return {
        ...rest,
        imageUrl: mediaUrl(i.imageId),
        bgImageUrl: mediaUrl(i.bgImageId),
        timer: { ...i.timer, appearance: { ...i.timer.appearance, bgImageUrl: mediaUrl(i.timer?.appearance?.bgImageId) } },
      };
    }),
  };
}

function publicMusic(c: Content) {
  const m = c.sections.music;
  const tracks = c.lists.tracks.map((t) => ({ id: t.id, title: t.title, url: trackUrl(t) })).filter((t) => t.url);
  return { enabled: m.enabled && tracks.length > 0, defaultVolume: m.defaultVolume, loop: m.loop, fadeMs: m.fadeMs, mainTrackId: m.mainTrackId, pageTracks: m.pageTracks, tracks };
}

export function publicLetter(c: Content) {
  const l = c.sections.letter;
  const v = vars(c);
  return {
    ...l,
    header: fill(l.header, v), body: fill(l.body, v), closing: fill(l.closing, v),
    backgroundImageUrl: mediaUrl(l.backgroundImageId),
    stickers: (l.stickers ?? []).map((s: any) => ({ ...s, url: mediaUrl(s.mediaId) })),
    images: (l.images ?? []).map((i: any) => ({ ...i, url: mediaUrl(i.mediaId) })).filter((i: any) => i.url),
  };
}

export async function buildState(ctx: VisitorCtx) {
  const c = ctx.content;
  const s = ctx.session;
  const w = c.sections.website;
  const r = c.sections.recipient;
  const v = vars(c);
  const step = currentStep(ctx);
  const nums = gameNumbers(ctx);
  const pages = pagesOf(c);

  const state: Record<string, any> = {
    mode: ctx.preview ? 'preview' : 'live',
    sessionId: s.id,
    site: { siteName: w.siteName, footerText: w.footerText, faviconUrl: mediaUrl(w.faviconId) },
    theme: publicTheme(c),
    tracking: { ...w.tracking, ack: s.tracking_ack, live: s.live_consent },
    music: publicMusic(c),
    fyi: publicFyi(c),
    pages,
    step,
    recipient: {
      nickname: r.nickname, callPrefix: r.callPrefix,
      welcomeTitle: fill(r.welcomeTitle, v), welcomeSubtitle: fill(r.welcomeSubtitle, v),
      birthdayLabel: r.birthdayLabel, birthdayButton: r.birthdayButton, birthdaySuccess: fill(r.birthdaySuccess, v),
      birthdayCheck: birthdayCheckActive(c), startButton: r.startButton, soundPrompt: r.soundPrompt,
      lockedSeconds: s.birthday_locked_until ? Math.max(0, Math.ceil((s.birthday_locked_until.getTime() - Date.now()) / 1000)) : 0,
    },
    progress: {
      birthdayPassed: s.birthday_passed, letterOpened: s.letter_opened, letterRead: s.letter_read,
      gameStarted: !!ctx.game.started_at, attemptsUsed: ctx.game.attempts_used, attemptsLeft: nums.left, attemptsTotal: nums.total,
      solved: ctx.game.solved, solvedVia: ctx.game.solved_via, messageSent: s.message_sent,
      galleryOpened: s.gallery_opened, confessionOpened: s.confession_opened, confessionAvailable: canConfession(ctx),
      selfieDone: s.selfie_done,
    },
  };

  if (c.sections.selfie.enabled) {
    const sf = c.sections.selfie;
    state.selfie = {
      enabled: true, title: fill(sf.title, v), subtitle: fill(sf.subtitle, v),
      giftLabel: sf.giftLabel, togetherLabel: sf.togetherLabel,
      representationImageUrl: mediaUrl(sf.representationImageId), representationCaption: sf.representationCaption,
      sendLabel: sf.sendLabel, skipLabel: sf.skipLabel, thanksText: sf.thanksText,
    };
  }

  if (!s.birthday_passed) return state;

  if (pages.letter) state.letter = publicLetter(c);

  if (pages.game && (s.letter_read || !pages.letter)) {
    const g = c.sections.game;
    const guesses = await query<{ guess: string; correct: boolean; created_at: Date }>(
      `SELECT guess, correct, created_at FROM guessing_attempts WHERE session_id = $1 ORDER BY id`, [s.id]);
    state.game = {
      title: fill(g.title, v), subtitle: fill(g.subtitle, v), placeholder: g.placeholder, button: g.button,
      remainingText: g.remainingText, showHearts: g.showHearts, hintsTitle: g.hintsTitle, soundEffects: g.soundEffects,
      hints: c.lists.hints.slice(0, nums.hintsUnlocked).map((h) => h.text),
      hintsTotal: c.lists.hints.length,
      specialHints: ctx.game.special_hints ?? [],
      guesses: guesses.map((x) => ({ guess: x.guess, correct: x.correct, at: x.created_at })),
    };
  }

  if (pages.game && nums.exhausted) {
    const e = c.sections.exchange;
    const reqs = await query<{ mission_id: string; status: string; created_at: Date }>(
      `SELECT mission_id, status, created_at FROM exchange_requests WHERE session_id = $1 ORDER BY created_at`, [s.id]);
    state.exchange = {
      enabled: pages.exchange,
      ...e,
      missions: pages.exchange ? c.lists.missions.filter((m) => m.enabled).map((m) => {
        const mine = reqs.filter((x) => x.mission_id === m.id);
        const failed = mine.filter((x) => x.status === 'failed').length;
        const last = mine[mine.length - 1];
        return {
          id: m.id, title: m.title, description: m.description, kind: m.kind, minLength: m.minLength,
          question: m.kind === 'question' ? m.question : '', phrase: m.kind === 'phrase' ? m.phrase : '',
          requiresApproval: m.requiresApproval || m.kind === 'free',
          triesLeft: Math.max(0, (m.maxTries || 3) - failed),
          status: last ? last.status : null,
          reward: { extraChances: m.rewardExtraChances, specialHint: !!m.rewardSpecialHint, reveal: m.rewardReveal },
        };
      }) : [],
    };
  }

  if (pages.game && ctx.game.solved) {
    const g = c.sections.game;
    state.correct = {
      title: fill(g.correctTitle, v), subtitle: fill(g.correctSubtitle, v), subtitle2: fill(g.correctSubtitle2, v),
      senderName: g.revealSenderName ? g.senderDisplayName || null : null,
      senderPhotoUrl: g.revealSenderName ? mediaUrl(g.senderPhotoId) : null,
      button: g.correctButton, via: ctx.game.solved_via,
    };
  }

  if (canMessage(ctx)) {
    const m = c.sections.message;
    state.message = { ...m, title: fill(m.title, v), subtitle: fill(m.subtitle, v) };
  }

  if (canGallery(ctx) && pages.gallery) {
    const g = c.sections.gallery;
    state.gallery = {
      ...g,
      photos: c.lists.photos.filter((p) => p.visible && p.mediaId).map((p) => ({
        id: p.id, url: mediaUrl(p.mediaId), width: p.width, height: p.height, caption: p.caption,
        frame: p.frame, sticker: p.sticker, animation: p.animation, isCover: p.isCover,
      })),
    };
  }
  return state;
}

/* ----------------------------------------------------------------- actions */

export async function checkBirthday(ctx: VisitorCtx, body: any) {
  const s = ctx.session;
  const r = ctx.content.sections.recipient;
  if (s.birthday_passed) return { ok: true };
  if (!birthdayCheckActive(ctx.content)) throw new HttpError(400, 'ไม่ต้องกรอกวันเกิด');
  if (s.birthday_locked_until && s.birthday_locked_until.getTime() > Date.now()) {
    const wait = Math.ceil((s.birthday_locked_until.getTime() - Date.now()) / 1000);
    throw new HttpError(429, r.birthdayLocked, { lockedSeconds: wait });
  }
  if (!s.play_started_at) {
    await query(`UPDATE visitor_sessions SET play_started_at = now() WHERE id = $1`, [s.id]);
    await logVisitor(sv(ctx), 'play_start');
  }
  const d = Number(body?.day), m = Number(body?.month), y = Number(body?.year);
  const [cy, cm, cd] = String(r.birthday).split('-').map(Number);
  const ok = d === cd && m === cm && (y === cy || (r.acceptBuddhistYear && y - 543 === cy));
  if (ok) {
    await query(`UPDATE visitor_sessions SET birthday_passed = true, birthday_passed_at = now(), birthday_fails = 0, birthday_locked_until = NULL WHERE id = $1`, [s.id]);
    await logVisitor(sv(ctx), 'birthday_ok');
    return { ok: true };
  }
  const fails = s.birthday_fails + 1;
  const max = Math.max(1, Number(r.birthdayMaxTries) || 5);
  if (fails >= max) {
    await query(`UPDATE visitor_sessions SET birthday_fails = 0, birthday_locked_until = now() + make_interval(mins => $2) WHERE id = $1`,
      [s.id, Math.max(1, Number(r.birthdayLockMinutes) || 3)]);
  } else {
    await query(`UPDATE visitor_sessions SET birthday_fails = $2 WHERE id = $1`, [s.id, fails]);
  }
  await logVisitor(sv(ctx), 'birthday_fail', { tries: fails });
  return { ok: false, message: r.birthdayError, lockedSeconds: fails >= max ? Number(r.birthdayLockMinutes) * 60 : 0, locked: fails >= max };
}

export async function startWithoutBirthday(ctx: VisitorCtx) {
  if (birthdayCheckActive(ctx.content)) throw new HttpError(400, 'ต้องกรอกวันเกิดก่อนน้า');
  if (!ctx.session.birthday_passed) {
    await query(`UPDATE visitor_sessions SET birthday_passed = true, birthday_passed_at = now(), play_started_at = coalesce(play_started_at, now()) WHERE id = $1`, [ctx.session.id]);
    await logVisitor(sv(ctx), 'play_start');
  }
}

const sv = (ctx: VisitorCtx) => ({ id: ctx.session.id, preview: ctx.preview });

export async function markProgress(ctx: VisitorCtx, event: string) {
  const s = ctx.session;
  const pages = pagesOf(ctx.content);
  const id = s.id;
  switch (event) {
    case 'letter_opened':
      if (!s.birthday_passed || !pages.letter) throw new HttpError(403, 'locked');
      if (!s.letter_opened) { await query(`UPDATE visitor_sessions SET letter_opened = true WHERE id = $1`, [id]); await logVisitor(sv(ctx), 'letter_opened'); }
      return;
    case 'letter_read':
      if (!s.birthday_passed || !pages.letter) throw new HttpError(403, 'locked');
      if (!s.letter_read) { await query(`UPDATE visitor_sessions SET letter_opened = true, letter_read = true WHERE id = $1`, [id]); await logVisitor(sv(ctx), 'letter_read'); }
      return;
    case 'game_started':
      if (!s.birthday_passed || !pages.game || (pages.letter && !s.letter_read)) throw new HttpError(403, 'locked');
      if (!ctx.game.started_at) { await query(`UPDATE guessing_sessions SET started_at = now() WHERE session_id = $1`, [id]); await logVisitor(sv(ctx), 'game_start'); }
      return;
    case 'selfie_done':
      // Optional keepsake; the visitor may skip at any time.
      if (!s.selfie_done) await query(`UPDATE visitor_sessions SET selfie_done = true WHERE id = $1`, [id]);
      return;
    case 'celebrated':
      if (!ctx.game.solved) throw new HttpError(403, 'locked');
      if (!s.celebrated) await query(`UPDATE visitor_sessions SET celebrated = true WHERE id = $1`, [id]);
      return;
    case 'gallery_opened':
      if (!canGallery(ctx) || !pages.gallery) throw new HttpError(403, 'locked');
      if (!s.gallery_opened) { await query(`UPDATE visitor_sessions SET gallery_opened = true WHERE id = $1`, [id]); await logVisitor(sv(ctx), 'gallery_opened'); }
      return;
    default:
      throw new HttpError(400, 'unknown event');
  }
}

export async function guess(ctx: VisitorCtx, raw: unknown) {
  const pages = pagesOf(ctx.content);
  const s = ctx.session;
  if (!s.birthday_passed || !pages.game || (pages.letter && !s.letter_read)) throw new HttpError(403, 'locked');
  if (ctx.game.solved) return { correct: true };
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!text) throw new HttpError(400, 'พิมพ์ชื่อก่อนน้า 🥺');
  const nums = gameNumbers(ctx);
  if (nums.left <= 0) throw new HttpError(409, 'หมดโอกาสแล้วน้า', { exhausted: true });
  if (!ctx.game.started_at) await query(`UPDATE guessing_sessions SET started_at = now() WHERE session_id = $1`, [s.id]);

  const normalized = normalizeAnswer(text);
  const answers = ctx.content.lists.answers.map((a) => normalizeAnswer(String(a.value ?? ''))).filter(Boolean);
  const correct = answers.includes(normalized);
  await query(`INSERT INTO guessing_attempts (session_id, guess, normalized, correct) VALUES ($1,$2,$3,$4)`, [s.id, text, normalized, correct]);

  if (correct) {
    await query(`UPDATE guessing_sessions SET solved = true, solved_via = 'guess', solved_at = now() WHERE session_id = $1`, [s.id]);
    await logVisitor(sv(ctx), 'guess', { guess: text, correct: true, attempt: ctx.game.attempts_used + 1 });
    await logVisitor(sv(ctx), 'solved', { via: 'guess' });
    return { correct: true };
  }
  // Atomic increment guarded by the limit so parallel requests can't sneak extra guesses in.
  const upd = await one<{ attempts_used: number }>(
    `UPDATE guessing_sessions SET attempts_used = attempts_used + 1 WHERE session_id = $1 AND attempts_used < $2 RETURNING attempts_used`,
    [s.id, nums.total]);
  const used = upd?.attempts_used ?? nums.total;
  await logVisitor(sv(ctx), 'guess', { guess: text, correct: false, attempt: used });
  const hintIndex = used + ctx.game.hint_bonus;
  if (hintIndex <= ctx.content.lists.hints.length) await logVisitor(sv(ctx), 'hint_unlocked', { hint: hintIndex });
  const exhausted = used >= nums.total;
  if (exhausted) {
    await query(`UPDATE guessing_sessions SET exhausted_count = exhausted_count + 1 WHERE session_id = $1`, [s.id]);
    await logVisitor(sv(ctx), 'exhausted');
  }
  const msg = pickRandom<string>(ctx.content.sections.game.wrongMessages ?? []) ?? 'ยังไม่ใช่น้าา';
  return { correct: false, message: msg, exhausted, newHint: hintIndex <= ctx.content.lists.hints.length };
}

export async function applyMissionReward(sessionId: string, preview: boolean, m: ListItem) {
  if (m.rewardExtraChances > 0) {
    await query(`UPDATE guessing_sessions SET extra_chances = extra_chances + $2 WHERE session_id = $1`, [sessionId, Math.min(20, Number(m.rewardExtraChances))]);
  }
  if (m.rewardSpecialHint) {
    await query(`UPDATE guessing_sessions SET special_hints = special_hints || to_jsonb($2::text) WHERE session_id = $1`, [sessionId, String(m.rewardSpecialHint)]);
  }
  if (m.rewardReveal) {
    await query(`UPDATE guessing_sessions SET solved = true, solved_via = 'mission', solved_at = now() WHERE session_id = $1 AND NOT solved`, [sessionId]);
    await logVisitor({ id: sessionId, preview }, 'solved', { via: 'mission' });
  }
}

export async function submitMission(ctx: VisitorCtx, missionId: string, raw: unknown) {
  const pages = pagesOf(ctx.content);
  if (!pages.game || !pages.exchange || ctx.game.solved || !gameNumbers(ctx).exhausted) throw new HttpError(403, 'ยังแลกสิทธิ์ไม่ได้น้า');
  const m = ctx.content.lists.missions.find((x) => x.id === missionId && x.enabled);
  if (!m) throw new HttpError(404, 'ไม่พบภารกิจนี้');
  const prior = await query<{ status: string }>(`SELECT status FROM exchange_requests WHERE session_id = $1 AND mission_id = $2`, [ctx.session.id, m.id]);
  if (prior.some((p) => p.status === 'pending')) throw new HttpError(409, ctx.content.sections.exchange.pendingText);
  if (prior.some((p) => p.status === 'approved')) throw new HttpError(409, 'ภารกิจนี้ทำสำเร็จไปแล้วน้า');
  const failed = prior.filter((p) => p.status === 'failed' || p.status === 'rejected').length;
  if (failed >= (m.maxTries || 3)) throw new HttpError(429, 'ใช้สิทธิ์ภารกิจนี้ครบแล้วน้า ลองภารกิจอื่นดูสิ');

  const submission = String(raw ?? '').trim().slice(0, 3000);
  let passed = false;
  let failMsg = 'ยังไม่ผ่านเงื่อนไขน้า ลองใหม่อีกทีสิ 🥺';
  switch (m.kind) {
    case 'message':
      passed = countChars(submission) >= (Number(m.minLength) || 1);
      failMsg = `เขียนอีกนิดน้า ต้องมีอย่างน้อย ${m.minLength} ตัวอักษร`;
      break;
    case 'question': {
      const accepted = (m.answers ?? []).map((a: string) => normalizeAnswer(String(a))).filter(Boolean);
      passed = accepted.includes(normalizeAnswer(submission));
      failMsg = 'คำตอบยังไม่ถูกน้า 🤭';
      break;
    }
    case 'phrase':
      passed = normalizeAnswer(submission) === normalizeAnswer(String(m.phrase ?? '')) && !!m.phrase;
      failMsg = 'พิมพ์ยังไม่ตรงกับข้อความที่กำหนดน้า';
      break;
    case 'free':
      passed = submission.length > 0;
      failMsg = 'พิมพ์อะไรสักหน่อยน้า';
      break;
  }
  const needsApproval = m.requiresApproval || m.kind === 'free';
  const status = !passed ? 'failed' : needsApproval ? 'pending' : 'approved';
  const req = await one<{ id: string }>(
    `INSERT INTO exchange_requests (session_id, mission_id, mission_title, submission, status, decided_at)
     VALUES ($1,$2,$3,$4,$5, CASE WHEN $5 = 'approved' THEN now() END) RETURNING id`,
    [ctx.session.id, m.id, m.title, submission, status]);
  await logVisitor(sv(ctx), 'exchange_request', { mission: m.title, status, requestId: req!.id });
  if (status === 'approved') await applyMissionReward(ctx.session.id, ctx.preview, m);
  if (status === 'pending') hub.toAdmins({ t: 'requests_changed' });
  return {
    status,
    message: status === 'failed' ? failMsg : status === 'pending' ? ctx.content.sections.exchange.pendingText : 'ภารกิจสำเร็จ! 🎉',
  };
}

export async function sendMessage(ctx: VisitorCtx, raw: unknown) {
  if (!canMessage(ctx)) throw new HttpError(403, 'ยังส่งข้อความไม่ได้น้า');
  const m = ctx.content.sections.message;
  const content = String(raw ?? '').trim();
  const count = countChars(content);
  const min = Math.max(1, Number(m.minChars) || 50);
  if (count < min) throw new HttpError(400, fill(m.tooShortText, { MIN: min, COUNT: count }));
  if (count > (Number(m.maxChars) || 5000)) throw new HttpError(400, 'ข้อความยาวเกินไปน้า');
  // Only the first submit wins, even if the button is pressed twice.
  const claimed = await one(`UPDATE visitor_sessions SET message_sent = true WHERE id = $1 AND NOT message_sent RETURNING id`, [ctx.session.id]);
  if (!claimed) return { duplicate: true };
  const row = await one<{ id: string }>(
    `INSERT INTO recipient_messages (session_id, content, char_count, is_test) VALUES ($1,$2,$3,$4) RETURNING id`,
    [ctx.session.id, content, count, ctx.preview]);
  await logVisitor(sv(ctx), 'message_sent', { chars: count, messageId: row!.id });
  hub.toAdmins({ t: 'message_new', id: row!.id, preview: ctx.preview });
  return { duplicate: false };
}

export async function getConfession(ctx: VisitorCtx) {
  const c = ctx.content.sections.confession;
  if (!canConfession(ctx)) {
    return { locked: true, lockedTitle: c.lockedTitle, lockedText: c.lockedText, enabled: !!pagesOf(ctx.content).confession };
  }
  if (!ctx.session.confession_opened) {
    await query(`UPDATE visitor_sessions SET confession_opened = true WHERE id = $1`, [ctx.session.id]);
    await logVisitor(sv(ctx), 'confession_opened');
  }
  const v = vars(ctx.content);
  return {
    locked: false,
    title: fill(c.title, v),
    lines: (c.confess ? c.lines : c.altLines).map((l: string) => fill(l, v)),
    lineDelay: c.lineDelay, typewriterSpeed: c.typewriterSpeed, animation: c.animation, confetti: c.confetti,
    showReplayButton: c.showReplayButton, replayButton: c.replayButton, endText: fill(c.endText, v), backButton: c.backButton,
    images: (c.imageIds ?? []).map((id: string) => mediaUrl(id)).filter(Boolean),
  };
}
