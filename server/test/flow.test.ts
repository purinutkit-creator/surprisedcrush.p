/**
 * End-to-end API test of the whole gift flow.
 * Needs a running server with a fresh database:  TEST_URL=http://localhost:3000 npm test
 * (Password defaults to the initial admin password; set TEST_ADMIN_PASSWORD if you changed it.)
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

const BASE = process.env.TEST_URL ?? 'http://localhost:3000';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? '05/05/2011';

class Client {
  cookies = new Map<string, string>();
  constructor(private extra: Record<string, string> = {}) {}
  async req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
        'User-Agent': this.extra.ua ?? 'flow-test',
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';');
      const i = kv.indexOf('=');
      this.cookies.set(kv.slice(0, i), kv.slice(i + 1));
    }
    const text = await res.text();
    let data: any = text;
    try { data = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, data, text };
  }
  admin(method: string, path: string, body?: unknown) {
    return this.req(method, `/api/admin${path}`, body, { 'X-Gift-Admin': '1' });
  }
}

const admin = new Client({ ua: 'flow-test-admin' });

test('admin login rejects wrong password and accepts the right one', async () => {
  const bad = await admin.req('POST', '/api/admin/login', { password: 'nope' });
  assert.equal(bad.status, 401);
  const ok = await admin.req('POST', '/api/admin/login', { password: ADMIN_PASSWORD });
  assert.equal(ok.status, 200);
  const me = await admin.admin('GET', '/me');
  assert.equal(me.status, 200);
});

test('admin mutations require the CSRF header', async () => {
  const r = await admin.req('PUT', '/api/admin/content/recipient', {});
  assert.equal(r.status, 403);
});

test('configure the gift and publish', async () => {
  const content = (await admin.admin('GET', '/content')).data;
  const recipient = { ...content.sections.recipient, nickname: 'มายด์', birthday: '2011-05-05', birthdayMaxTries: 3 };
  assert.equal((await admin.admin('PUT', '/content/recipient', recipient)).status, 200);
  assert.equal((await admin.admin('PUT', '/list/answers', [{ value: 'Poom' }, { value: 'ภูมิ' }])).status, 200);
  const game = { ...content.sections.game, maxAttempts: 3, senderDisplayName: 'พี่ภูมิ' };
  assert.equal((await admin.admin('PUT', '/content/game', game)).status, 200);
  const missions = content.lists.missions.map((m: any) => (m.kind === 'question' ? { ...m, enabled: true, answers: ['สวนสาธารณะ'] } : m));
  assert.equal((await admin.admin('PUT', '/list/missions', missions)).status, 200);
  const pub = await admin.admin('POST', '/publish');
  assert.equal(pub.status, 200);
});

test('full visitor journey', async () => {
  const v = new Client({ ua: `visitor-${Date.now()}` });
  let s = (await v.req('GET', '/api/state')).data;
  assert.equal(s.step, 'welcome');
  assert.match(s.recipient.welcomeTitle, /มายด์/);
  const raw = JSON.stringify(s);
  assert.ok(!raw.includes('2011-05-05'), 'birthday must not leak');
  assert.ok(!raw.includes('Poom') && !raw.includes('ภูมิ'), 'answer must not leak');
  assert.equal(s.letter, undefined, 'letter hidden before birthday');

  // Confession is locked before finishing.
  const locked = (await v.req('GET', '/api/confession')).data;
  assert.equal(locked.confession.locked, true);

  // Wrong birthday, then lockout after 3 tries.
  let r = await v.req('POST', '/api/birthday', { day: 1, month: 1, year: 2000 });
  assert.equal(r.data.ok, false);
  await v.req('POST', '/api/birthday', { day: 2, month: 1, year: 2000 });
  r = await v.req('POST', '/api/birthday', { day: 3, month: 1, year: 2000 });
  assert.equal(r.data.locked, true);
  r = await v.req('POST', '/api/birthday', { day: 5, month: 5, year: 2011 });
  assert.equal(r.status, 429, 'locked even with the right answer');

  // Admin unlocks, Buddhist year accepted.
  await admin.admin('POST', `/sessions/${s.sessionId}/action`, { action: 'reset_birthday_lock' });
  r = await v.req('POST', '/api/birthday', { day: 5, month: 5, year: 2554 });
  assert.equal(r.data.ok, true);
  s = r.data.state;
  assert.equal(s.step, 'letter');
  assert.ok(s.letter.header.includes('มายด์'));
  assert.equal(s.game, undefined, 'game hidden before reading letter');

  // Cannot skip ahead.
  assert.equal((await v.req('POST', '/api/guess', { name: 'x' })).status, 403);
  assert.equal((await v.req('POST', '/api/progress', { event: 'gallery_opened' })).status, 403);

  s = (await v.req('POST', '/api/progress', { event: 'letter_read' })).data.state;
  assert.equal(s.step, 'game');
  assert.equal(s.progress.attemptsLeft, 3);

  r = await v.req('POST', '/api/guess', { name: 'Somchai' });
  assert.equal(r.data.correct, false);
  assert.equal(r.data.state.game.hints.length, 1);
  r = await v.req('POST', '/api/guess', { name: 'Somsak' });
  assert.equal(r.data.state.game.hints.length, 2);
  r = await v.req('POST', '/api/guess', { name: 'Sompong' });
  assert.equal(r.data.exhausted, true);
  s = r.data.state;
  assert.equal(s.step, 'exchange');
  assert.ok(!JSON.stringify(s.exchange).includes('สวนสาธารณะ'), 'mission answers must not leak');
  assert.equal((await v.req('POST', '/api/guess', { name: 'Poom' })).status, 409, 'no guesses left');

  // Refresh keeps the count.
  s = (await v.req('GET', '/api/state')).data;
  assert.equal(s.progress.attemptsLeft, 0);

  // Question mission: wrong then right → +1 chance and special hint.
  const q = s.exchange.missions.find((m: any) => m.kind === 'question');
  r = await v.req('POST', `/api/exchange/${q.id}`, { submission: 'ห้าง' });
  assert.equal(r.data.status, 'failed');
  r = await v.req('POST', `/api/exchange/${q.id}`, { submission: '  สวนสาธารณะ ' });
  assert.equal(r.data.status, 'approved');
  s = r.data.state;
  assert.equal(s.step, 'game');
  assert.equal(s.progress.attemptsLeft, 1);
  assert.equal(s.game.specialHints.length, 1);

  // Case/space-insensitive correct guess.
  r = await v.req('POST', '/api/guess', { name: '  pOOm  ' });
  assert.equal(r.data.correct, true);
  s = r.data.state;
  assert.equal(s.step, 'correct');
  assert.equal(s.correct.senderName, 'พี่ภูมิ');

  s = (await v.req('POST', '/api/progress', { event: 'celebrated' })).data.state;
  assert.equal(s.step, 'message');

  // Message validation.
  assert.equal((await v.req('POST', '/api/message', { content: '      ' })).status, 400);
  assert.equal((await v.req('POST', '/api/message', { content: 'สั้นไป 💗' })).status, 400);
  const msg = 'ขอบคุณมาก ๆ เลยนะ ของขวัญน่ารักมาก ดีใจที่สุดเลย 💗💗 ไม่คิดว่าจะเป็นเธอจริง ๆ เขินมากเลยอะ ไว้เจอกันนะ แล้วก็ขอบคุณที่ตั้งใจทำให้ขนาดนี้เลยน้า';
  r = await v.req('POST', '/api/message', { content: msg });
  assert.equal(r.status, 200);
  assert.equal(r.data.duplicate, false);
  r = await v.req('POST', '/api/message', { content: msg });
  assert.equal(r.data.duplicate, true, 'double submit is ignored');
  s = r.data.state;
  assert.equal(s.step, 'gallery');

  // Confession requires the gallery to be opened (default setting).
  assert.equal((await v.req('GET', '/api/confession')).data.confession.locked, true);
  s = (await v.req('POST', '/api/progress', { event: 'gallery_opened' })).data.state;
  assert.equal(s.progress.confessionAvailable, true);
  const conf = (await v.req('GET', '/api/confession')).data.confession;
  assert.equal(conf.locked, false);
  assert.ok(conf.lines.length > 3);

  // Admin sees exactly one real message, and it's in the CSV.
  const inbox = (await admin.admin('GET', '/messages')).data;
  assert.ok(inbox.some((m: any) => m.content === msg));
  const csv = await admin.admin('GET', '/messages.csv');
  assert.ok(csv.text.includes('เขินมากเลยอะ'));
  const detail = (await admin.admin('GET', `/sessions/${s.sessionId}`)).data;
  assert.ok(detail.events.some((e: any) => e.type === 'guess' && e.data.guess === 'Somchai'));
});

test('clearing cookies does not reset attempts (device binding)', async () => {
  const ua = `same-device-${Date.now()}`;
  const a = new Client({ ua });
  let s = (await a.req('GET', '/api/state')).data;
  await a.req('POST', '/api/birthday', { day: 5, month: 5, year: 2011 });
  await a.req('POST', '/api/progress', { event: 'letter_read' });
  await a.req('POST', '/api/guess', { name: 'wrong' });
  const b = new Client({ ua }); // fresh cookie jar, same device
  s = (await b.req('GET', '/api/state')).data;
  assert.equal(s.progress.attemptsUsed, 1);
});

test('preview sessions are isolated and messages are marked as test', async () => {
  const p = await admin.req('GET', '/api/state', undefined, { 'X-Gift-Preview': '1' });
  assert.equal(p.data.mode, 'preview');
  const id = p.data.sessionId;
  await admin.admin('POST', `/sessions/${id}/action`, { action: 'reveal' });
  await admin.admin('POST', `/sessions/${id}/action`, { action: 'sim_read_letter' });
  await admin.req('POST', '/api/progress', { event: 'celebrated' }, { 'X-Gift-Preview': '1' });
  const r = await admin.req('POST', '/api/message', { content: 'ทดสอบข้อความยาว ๆ ให้ครบห้าสิบตัวอักษรนะครับ 1234567890 abcdefghij' }, { 'X-Gift-Preview': '1' });
  assert.equal(r.status, 200);
  const real = (await admin.admin('GET', '/messages')).data;
  assert.ok(!real.some((m: any) => m.content.startsWith('ทดสอบข้อความยาว')));
  const tests = (await admin.admin('GET', '/messages?test=1')).data;
  assert.ok(tests.some((m: any) => m.content.startsWith('ทดสอบข้อความยาว')));
  // A visitor without admin cookie cannot use preview mode.
  const anon = new Client();
  assert.equal((await anon.req('GET', '/api/state', undefined, { 'X-Gift-Preview': '1' })).status, 401);
});

test('admin routes require login', async () => {
  const anon = new Client();
  assert.equal((await anon.req('GET', '/api/admin/messages')).status, 401);
  assert.equal((await anon.req('GET', '/api/admin/content')).status, 401);
});
