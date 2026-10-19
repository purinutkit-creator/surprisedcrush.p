import bcrypt from 'bcryptjs';
import type { NextFunction, Request, Response } from 'express';
import { config } from './config.js';
import { one, query } from './db.js';
import { DEFAULT_SECURITY, withDefaults } from './defaults.js';
import { HttpError, randomToken, sha256 } from './util.js';

export const ADMIN_COOKIE = 'gift_admin';

export interface AdminCtx { adminId: string; sessionId: string; username: string }
declare module 'express-serve-static-core' {
  interface Request { admin?: AdminCtx }
}

export async function getSecurity() {
  const row = await one<{ value: any }>(`SELECT value FROM app_kv WHERE key = 'security'`);
  return withDefaults(DEFAULT_SECURITY, row?.value);
}

export async function seedAdmin() {
  const existing = await one(`SELECT 1 FROM admin_users LIMIT 1`);
  if (existing) return;
  const hash = await bcrypt.hash(config.initialAdminPassword, 12);
  await query(`INSERT INTO admin_users (username, password_hash) VALUES ('admin', $1)`, [hash]);
  console.log('[gift] Admin account created with the initial password. Change it in Security Settings.');
}

export async function logAdmin(req: Request, type: string, data: Record<string, unknown> = {}) {
  await query(`INSERT INTO activity_logs (actor, type, data, ip) VALUES ('admin', $1, $2, $3)`, [type, data, req.ip]);
}

/** Returns seconds until the IP may try again, or 0 when allowed. */
async function lockSeconds(ip: string) {
  const sec = await getSecurity();
  const rows = await query<{ success: boolean; created_at: Date }>(
    `SELECT success, created_at FROM login_attempts WHERE ip = $1 AND created_at > now() - make_interval(mins => $2)
     ORDER BY created_at DESC LIMIT 50`, [ip, sec.lockMinutes]);
  let fails = 0;
  let firstFail: Date | null = null;
  for (const r of rows) {
    if (r.success) break;
    fails++;
    firstFail = r.created_at;
  }
  if (fails < sec.maxLoginAttempts || !firstFail) return 0;
  const last = rows[0].created_at.getTime();
  return Math.max(1, Math.ceil((last + sec.lockMinutes * 60_000 - Date.now()) / 1000));
}

export function cookieOpts(maxAgeMs: number) {
  return { httpOnly: true, secure: config.isProduction, sameSite: 'strict' as const, path: '/', maxAge: maxAgeMs };
}

export async function login(req: Request, res: Response) {
  const ip = req.ip ?? 'unknown';
  const wait = await lockSeconds(ip);
  if (wait > 0) throw new HttpError(429, `ใส่รหัสผิดหลายครั้งเกินไป ลองใหม่ในอีก ${Math.ceil(wait / 60)} นาที`, { retryAfter: wait });

  const password = String(req.body?.password ?? '');
  const admin = await one<{ id: string; username: string; password_hash: string }>(`SELECT id, username, password_hash FROM admin_users ORDER BY created_at LIMIT 1`);
  const ok = !!admin && password.length > 0 && password.length < 200 && (await bcrypt.compare(password, admin.password_hash));
  await query(`INSERT INTO login_attempts (ip, user_agent, success) VALUES ($1, $2, $3)`, [ip, req.get('user-agent') ?? '', ok]);
  if (!ok || !admin) {
    await query(`INSERT INTO activity_logs (actor, type, data, ip) VALUES ('admin', 'login_failed', '{}', $1)`, [ip]);
    // Constant-ish delay makes brute forcing slower.
    await new Promise((r) => setTimeout(r, 600));
    const left = await lockSeconds(ip);
    throw new HttpError(401, left > 0 ? `ใส่รหัสผิดหลายครั้งเกินไป ลองใหม่ในอีก ${Math.ceil(left / 60)} นาที` : 'รหัสผ่านไม่ถูกต้อง');
  }
  const sec = await getSecurity();
  const token = randomToken();
  const maxAge = sec.sessionDays * 86400_000;
  const session = await one<{ id: string }>(
    `INSERT INTO admin_sessions (admin_id, token_hash, ip, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, now() + make_interval(secs => $5)) RETURNING id`,
    [admin.id, sha256(token), ip, req.get('user-agent') ?? '', maxAge / 1000]);
  res.cookie(ADMIN_COOKIE, token, cookieOpts(maxAge));
  await query(`INSERT INTO activity_logs (actor, type, data, ip) VALUES ('admin', 'login', $1, $2)`, [{ session: session!.id }, ip]);
  return { ok: true };
}

export async function resolveAdmin(token: string | undefined): Promise<AdminCtx | null> {
  if (!token) return null;
  const row = await one<{ id: string; admin_id: string; username: string }>(
    `UPDATE admin_sessions s SET last_seen_at = now()
     FROM admin_users u
     WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.id = s.admin_id
     RETURNING s.id, s.admin_id, u.username`, [sha256(token)]);
  return row ? { adminId: row.admin_id, sessionId: row.id, username: row.username } : null;
}

export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    const admin = await resolveAdmin(req.cookies?.[ADMIN_COOKIE]);
    if (!admin) throw new HttpError(401, 'กรุณาเข้าสู่ระบบ');
    // CSRF guard: browsers cannot send this custom header cross-site without a CORS preflight we never allow.
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.get('x-gift-admin') !== '1') throw new HttpError(403, 'Forbidden');
    req.admin = admin;
    next();
  } catch (e) {
    next(e);
  }
}

export async function changePassword(req: Request) {
  const current = String(req.body?.current ?? '');
  const next = String(req.body?.next ?? '');
  if (next.length < 6) throw new HttpError(400, 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 6 ตัวอักษร');
  if (next.length > 128) throw new HttpError(400, 'รหัสผ่านยาวเกินไป');
  const admin = await one<{ password_hash: string }>(`SELECT password_hash FROM admin_users WHERE id = $1`, [req.admin!.adminId]);
  if (!admin || !(await bcrypt.compare(current, admin.password_hash))) throw new HttpError(400, 'รหัสผ่านปัจจุบันไม่ถูกต้อง');
  const hash = await bcrypt.hash(next, 12);
  await query(`UPDATE admin_users SET password_hash = $1, password_changed_at = now() WHERE id = $2`, [hash, req.admin!.adminId]);
  // Sign out every other device.
  await query(`UPDATE admin_sessions SET revoked_at = now() WHERE admin_id = $1 AND id <> $2 AND revoked_at IS NULL`, [req.admin!.adminId, req.admin!.sessionId]);
  await logAdmin(req, 'password_changed');
}
