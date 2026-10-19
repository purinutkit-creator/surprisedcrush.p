import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { config, s3Enabled } from './config.js';
import { one, query } from './db.js';

let s3: S3Client | null = null;
function client() {
  if (!s3) {
    s3 = new S3Client({
      region: config.s3.region,
      endpoint: config.s3.endpoint,
      forcePathStyle: config.s3.forcePathStyle,
      credentials: { accessKeyId: config.s3.accessKeyId, secretAccessKey: config.s3.secretAccessKey },
    });
  }
  return s3;
}

export type MediaKind = 'image' | 'audio' | 'font';

/** Detect file type from its first bytes (never trust the browser-provided mime). */
export function sniff(buf: Buffer): { kind: MediaKind; mime: string } | null {
  const hex = buf.subarray(0, 12).toString('hex');
  const ascii = buf.subarray(0, 12).toString('latin1');
  if (hex.startsWith('ffd8ff')) return { kind: 'image', mime: 'image/jpeg' };
  if (hex.startsWith('89504e47')) return { kind: 'image', mime: 'image/png' };
  if (ascii.startsWith('GIF8')) return { kind: 'image', mime: 'image/gif' };
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return { kind: 'image', mime: 'image/webp' };
  if (hex.startsWith('00000100')) return { kind: 'image', mime: 'image/x-icon' };
  if (ascii.slice(4, 12).match(/^ftyp(heic|heix|mif1)/)) return { kind: 'image', mime: 'image/heic' };
  if (ascii.startsWith('ID3') || hex.startsWith('fffb') || hex.startsWith('fff3') || hex.startsWith('fff2')) return { kind: 'audio', mime: 'audio/mpeg' };
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WAVE') return { kind: 'audio', mime: 'audio/wav' };
  if (ascii.startsWith('OggS')) return { kind: 'audio', mime: 'audio/ogg' };
  if (ascii.startsWith('fLaC')) return { kind: 'audio', mime: 'audio/flac' };
  if (ascii.slice(4, 8) === 'ftyp') return { kind: 'audio', mime: 'audio/mp4' };
  if (hex.startsWith('fff1') || hex.startsWith('fff9')) return { kind: 'audio', mime: 'audio/aac' };
  if (ascii.startsWith('wOF2')) return { kind: 'font', mime: 'font/woff2' };
  if (ascii.startsWith('wOFF')) return { kind: 'font', mime: 'font/woff' };
  if (ascii.startsWith('OTTO')) return { kind: 'font', mime: 'font/otf' };
  if (hex.startsWith('00010000') || ascii.startsWith('true')) return { kind: 'font', mime: 'font/ttf' };
  return null;
}

export async function saveMedia(buf: Buffer, filename: string) {
  const type = sniff(buf);
  if (!type) throw new Error('ไฟล์ประเภทนี้ไม่รองรับ (รองรับ JPG, PNG, WEBP, GIF, MP3, WAV, OGG, M4A, TTF, OTF, WOFF, WOFF2)');
  const limit = config.limits[type.kind];
  if (buf.length > limit) throw new Error(`ไฟล์ใหญ่เกินไป (สูงสุด ${Math.round(limit / 1024 / 1024)} MB)`);
  const safeName = filename.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 120) || 'file';
  if (s3Enabled()) {
    const row = await one<{ id: string }>(
      `INSERT INTO media_files (kind, filename, mime, size, storage) VALUES ($1,$2,$3,$4,'s3') RETURNING id`,
      [type.kind, safeName, type.mime, buf.length]);
    const key = `gift/${row!.id}`;
    await client().send(new PutObjectCommand({ Bucket: config.s3.bucket, Key: key, Body: buf, ContentType: type.mime }));
    await query(`UPDATE media_files SET s3_key = $1 WHERE id = $2`, [key, row!.id]);
    return { id: row!.id, kind: type.kind, mime: type.mime, size: buf.length, filename: safeName };
  }
  const row = await one<{ id: string }>(
    `INSERT INTO media_files (kind, filename, mime, size, storage, data) VALUES ($1,$2,$3,$4,'db',$5) RETURNING id`,
    [type.kind, safeName, type.mime, buf.length, buf]);
  return { id: row!.id, kind: type.kind, mime: type.mime, size: buf.length, filename: safeName };
}

export async function deleteMedia(id: string) {
  const row = await one<{ storage: string; s3_key: string | null }>(`DELETE FROM media_files WHERE id = $1 RETURNING storage, s3_key`, [id]);
  mem.delete(id);
  if (row?.storage === 's3' && row.s3_key && s3Enabled()) {
    await client().send(new DeleteObjectCommand({ Bucket: config.s3.bucket, Key: row.s3_key })).catch(() => {});
  }
}

/** Small LRU for DB-stored files so audio range requests don't hit Postgres every time. */
const mem = new Map<string, { mime: string; data: Buffer }>();
const MEM_MAX = 120 * 1024 * 1024;
let memSize = 0;
function remember(id: string, entry: { mime: string; data: Buffer }) {
  mem.set(id, entry);
  memSize += entry.data.length;
  for (const [k, v] of mem) {
    if (memSize <= MEM_MAX) break;
    mem.delete(k);
    memSize -= v.data.length;
  }
}

function parseRange(header: string | undefined, size: number): [number, number] | null {
  const m = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!m) return null;
  let start = m[1] ? Number(m[1]) : NaN;
  let end = m[2] ? Number(m[2]) : size - 1;
  if (Number.isNaN(start)) { start = size - end; end = size - 1; }
  if (start < 0 || start >= size || end < start) return null;
  return [start, Math.min(end, size - 1)];
}

export async function serveMedia(req: Request, res: Response) {
  const id = req.params.id;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(404).end();
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  const meta = await one<{ mime: string; size: number; storage: string; s3_key: string | null }>(
    `SELECT mime, size, storage, s3_key FROM media_files WHERE id = $1`, [id]);
  if (!meta) return res.status(404).end();
  res.setHeader('Content-Type', meta.mime);

  if (meta.storage === 's3' && meta.s3_key) {
    const range = req.headers.range;
    const obj = await client().send(new GetObjectCommand({ Bucket: config.s3.bucket, Key: meta.s3_key, Range: range }));
    if (obj.ContentRange) { res.status(206); res.setHeader('Content-Range', obj.ContentRange); }
    if (obj.ContentLength != null) res.setHeader('Content-Length', String(obj.ContentLength));
    (obj.Body as Readable).pipe(res);
    return;
  }

  let entry = mem.get(id);
  if (!entry) {
    const row = await one<{ data: Buffer }>(`SELECT data FROM media_files WHERE id = $1`, [id]);
    if (!row?.data) return res.status(404).end();
    entry = { mime: meta.mime, data: row.data };
    remember(id, entry);
  }
  const size = entry.data.length;
  const range = parseRange(req.headers.range, size);
  if (req.headers.range && !range) {
    res.setHeader('Content-Range', `bytes */${size}`);
    return res.status(416).end();
  }
  if (range) {
    const [start, end] = range;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    res.setHeader('Content-Length', String(end - start + 1));
    return res.end(entry.data.subarray(start, end + 1));
  }
  res.setHeader('Content-Length', String(size));
  res.end(entry.data);
}

export const mediaUrl = (id: string | null | undefined) => (id ? `/media/${id}` : null);
