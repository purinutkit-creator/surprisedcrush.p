import compression from 'compression';
import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { seedAdmin } from './auth.js';
import { config } from './config.js';
import { loadContent, seedContent } from './content.js';
import { migrate, pool } from './db.js';
import { attachRealtime } from './realtime.js';
import { adminRouter } from './routes/admin.js';
import { publicRouter } from './routes/public.js';
import { mediaUrl, serveMedia } from './storage.js';
import { ah, HttpError } from './util.js';

const app = express();
app.set('trust proxy', /^\d+$/.test(config.trustProxy) ? Number(config.trustProxy) : config.trustProxy);
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      // YouTube IFrame Player API scripts for background music from YouTube.
      'script-src': ["'self'", 'https://www.youtube.com', 'https://s.ytimg.com'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
      'img-src': ["'self'", 'data:', 'blob:', 'https://i.ytimg.com', 'https://img.youtube.com'],
      'media-src': ["'self'", 'https:', 'blob:'],
      'connect-src': ["'self'", 'ws:', 'wss:', 'https://www.youtube.com', 'https://www.googleapis.com'],
      // rrweb's replayer renders the visitor's DOM inside a sandboxed same-origin iframe; YouTube for music.
      'frame-src': ["'self'", 'blob:', 'https://www.youtube.com', 'https://www.youtube-nocookie.com'],
      'worker-src': ["'self'", 'blob:'],
      'frame-ancestors': ["'self'"],
      'upgrade-insecure-requests': config.isProduction ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(cookieParser());
// text/plain is what navigator.sendBeacon uses.
app.use(express.json({ limit: '2mb', type: ['application/json', 'text/plain'] }));

app.get('/healthz', ah(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
}));

app.get('/media/:id', ah(serveMedia));
app.use('/api/admin', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); }, adminRouter);
app.use('/api', publicRouter);
app.use('/api', (_req, res) => res.status(404).json({ error: 'not found' }));

app.get('/favicon.ico', ah(async (_req, res) => {
  const w = (await loadContent('published')).sections.website;
  const url = mediaUrl(w.faviconId);
  if (url) return res.redirect(302, url);
  res.type('image/svg+xml').send(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><text y="52" font-size="52">🎁</text></svg>`);
}));

/* --------------------------------------------------------------- web app */

const indexFile = path.join(config.webDist, 'index.html');
const hasWeb = fs.existsSync(indexFile);
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

if (hasWeb) {
  app.use('/assets', express.static(path.join(config.webDist, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(config.webDist, { index: false, maxAge: '1h' }));
  const template = fs.readFileSync(indexFile, 'utf8');
  app.get('*', ah(async (req, res) => {
    const w = (await loadContent('published')).sections.website;
    const isAdmin = req.path.startsWith('/surprisedmycrush');
    const title = isAdmin ? 'Admin · 1st Gift' : w.seoTitle || w.siteName;
    const favicon = mediaUrl(w.faviconId) ?? '/favicon.ico';
    const html = template
      .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
      .replace('<!--meta-->', [
        `<meta name="description" content="${escapeHtml(w.metaDescription)}">`,
        `<meta property="og:title" content="${escapeHtml(title)}">`,
        `<meta property="og:description" content="${escapeHtml(w.metaDescription)}">`,
        `<link rel="icon" href="${favicon}">`,
        isAdmin ? '<meta name="robots" content="noindex, nofollow">' : '<meta name="robots" content="noindex">',
      ].join('\n    '));
    res.setHeader('Cache-Control', 'no-cache');
    res.type('html').send(html);
  }));
} else {
  app.get('/', (_req, res) => res.type('text').send('Web build not found. Run `npm run build` or use `npm run dev` (Vite on :5173).'));
}

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...err.extra });
  if (err?.type === 'entity.too.large' || err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'ไฟล์หรือข้อมูลใหญ่เกินไป' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง' });
  console.error(err);
  res.status(500).json({ error: 'เกิดข้อผิดพลาด ลองใหม่อีกครั้งนะ' });
});

async function main() {
  await migrate();
  await seedAdmin();
  await seedContent();
  const server = http.createServer(app);
  attachRealtime(server);
  server.listen(config.port, () => console.log(`[gift] listening on http://localhost:${config.port}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
