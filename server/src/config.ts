import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://gift:gift@localhost:5432/gift',
  databaseSsl: process.env.DATABASE_SSL === 'true',
  isProduction: process.env.NODE_ENV === 'production',
  /** Only used the very first time the database is initialised. Change it from the admin afterwards. */
  initialAdminPassword: process.env.ADMIN_INITIAL_PASSWORD ?? '05/05/2011',
  /** Set when running behind a reverse proxy (Render, Fly, Railway, Nginx...) so req.ip is the real client IP. */
  trustProxy: process.env.TRUST_PROXY ?? (process.env.NODE_ENV === 'production' ? '1' : 'loopback'),
  s3: {
    bucket: process.env.S3_BUCKET ?? '',
    region: process.env.S3_REGION ?? 'auto',
    endpoint: process.env.S3_ENDPOINT || undefined,
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  },
  webDist: path.resolve(here, '../web'),
  limits: {
    image: 15 * 1024 * 1024,
    audio: 40 * 1024 * 1024,
    font: 6 * 1024 * 1024,
  },
};

export const s3Enabled = () => Boolean(config.s3.bucket && config.s3.accessKeyId && config.s3.secretAccessKey);
