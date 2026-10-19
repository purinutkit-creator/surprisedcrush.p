import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

/** Normalise a typed name: Unicode NFC, strip zero-width chars, collapse whitespace, lower-case (English). */
export function normalizeAnswer(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[​-‍﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const segmenter = new Intl.Segmenter('th', { granularity: 'grapheme' });

/** Count characters the way people see them (emoji = 1, Thai vowels/tone marks attach to their consonant). */
export function countChars(text: string): number {
  const cleaned = text.normalize('NFC').replace(/[​-‍﻿]/g, '').replace(/\s+/g, ' ').trim();
  let n = 0;
  for (const _ of segmenter.segment(cleaned)) n++;
  return n;
}

export function detectDevice(ua: string | undefined): string {
  if (!ua) return 'Unknown';
  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && /Mobile/i.test(ua))) return 'iPad';
  if (/iPhone|iPod/i.test(ua)) return 'iPhone';
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? 'Android' : 'Android Tablet';
  if (/Windows/i.test(ua)) return 'PC (Windows)';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac';
  if (/Linux/i.test(ua)) return 'PC (Linux)';
  return 'Other';
}

export function deviceKind(device: string): 'phone' | 'tablet' | 'desktop' {
  if (device === 'iPhone' || device === 'Android') return 'phone';
  if (device === 'iPad' || device === 'Android Tablet') return 'tablet';
  return 'desktop';
}

/** Small in-memory sliding-window limiter, keyed by ip + bucket. */
const hits = new Map<string, number[]>();
setInterval(() => {
  const now = Date.now();
  for (const [k, arr] of hits) if (!arr.length || now - arr[arr.length - 1] > 3600_000) hits.delete(k);
}, 60_000).unref();

export function rateLimit(bucket: string, max: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${bucket}:${req.ip}`;
    const now = Date.now();
    const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (arr.length >= max) {
      const retry = Math.ceil((windowMs - (now - arr[0])) / 1000);
      res.setHeader('Retry-After', String(retry));
      return res.status(429).json({ error: 'ช้าลงนิดนึงน้า ลองใหม่อีกครู่นะ 🥺', retryAfter: retry });
    }
    arr.push(now);
    hits.set(key, arr);
    next();
  };
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);

export function fill(template: string, vars: Record<string, string | number>): string {
  return String(template ?? '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export function pickRandom<T>(arr: T[]): T | undefined {
  return arr.length ? arr[crypto.randomInt(arr.length)] : undefined;
}

export function clampInt(v: unknown, min: number, max: number, fallback: number) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
