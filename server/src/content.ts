import { one, query, tx, type Stage } from './db.js';
import {
  DEFAULT_LISTS, DEFAULT_SECTIONS, LIST_ITEM_DEFAULTS, LISTS, SECTIONS,
  withDefaults, type ListName, type SectionName,
} from './defaults.js';

export interface ListItem { id: string; [k: string]: any }
export interface Content {
  sections: Record<SectionName, Record<string, any>>;
  lists: Record<ListName, ListItem[]>;
}

const cache = new Map<Stage, Content>();

export function invalidateContent() {
  cache.clear();
}

export async function loadContent(stage: Stage): Promise<Content> {
  const hit = cache.get(stage);
  if (hit) return hit;
  const sections = {} as Content['sections'];
  for (const [name, table] of Object.entries(SECTIONS) as [SectionName, string][]) {
    const row = await one<{ data: any }>(`SELECT data FROM ${table} WHERE stage = $1`, [stage]);
    sections[name] = withDefaults(DEFAULT_SECTIONS[name], row?.data);
  }
  const lists = {} as Content['lists'];
  for (const [name, table] of Object.entries(LISTS) as [ListName, string][]) {
    const rows = await query<{ id: string; data: any }>(
      `SELECT id, data FROM ${table} WHERE stage = $1 ORDER BY sort_order, updated_at`, [stage]);
    lists[name] = rows.map((r) => ({ ...withDefaults(LIST_ITEM_DEFAULTS[name](), r.data), id: r.id }));
  }
  const content = { sections, lists };
  cache.set(stage, content);
  return content;
}

export async function saveSection(name: SectionName, data: Record<string, any>) {
  const table = SECTIONS[name];
  const merged = withDefaults(DEFAULT_SECTIONS[name], data);
  await query(
    `INSERT INTO ${table} (stage, data, updated_at) VALUES ('draft', $1, now())
     ON CONFLICT (stage) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [merged],
  );
  invalidateContent();
  return merged;
}

/** Replace the whole draft list (handles add / edit / delete / reorder in one call). */
export async function saveList(name: ListName, items: Record<string, any>[]) {
  const table = LISTS[name];
  await tx(async (c) => {
    await c.query(`DELETE FROM ${table} WHERE stage = 'draft'`);
    let order = 0;
    for (const item of items) {
      const { id, ...data } = item;
      const merged = withDefaults(LIST_ITEM_DEFAULTS[name](), data);
      if (typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)) {
        await c.query(`INSERT INTO ${table} (id, stage, sort_order, data) VALUES ($1, 'draft', $2, $3)`, [id, order++, merged]);
      } else {
        await c.query(`INSERT INTO ${table} (stage, sort_order, data) VALUES ('draft', $1, $2)`, [order++, merged]);
      }
    }
  });
  invalidateContent();
  return (await loadContent('draft')).lists[name];
}

/** Copy every draft section and list over the published version, atomically. */
export async function publishDraft() {
  await tx(async (c) => {
    for (const table of Object.values(SECTIONS)) {
      await c.query(`DELETE FROM ${table} WHERE stage = 'published'`);
      await c.query(`INSERT INTO ${table} (stage, data, updated_at) SELECT 'published', data, now() FROM ${table} WHERE stage = 'draft'`);
    }
    for (const table of Object.values(LISTS)) {
      await c.query(`DELETE FROM ${table} WHERE stage = 'published'`);
      await c.query(`INSERT INTO ${table} (id, stage, sort_order, data, updated_at) SELECT id, 'published', sort_order, data, now() FROM ${table} WHERE stage = 'draft'`);
    }
    await c.query(`INSERT INTO app_kv (key, value) VALUES ('published_at', to_jsonb(now()))
                   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`);
  });
  invalidateContent();
}

/** Throw away unpublished edits. */
export async function discardDraft() {
  await tx(async (c) => {
    for (const table of Object.values(SECTIONS)) {
      await c.query(`DELETE FROM ${table} WHERE stage = 'draft'`);
      await c.query(`INSERT INTO ${table} (stage, data, updated_at) SELECT 'draft', data, now() FROM ${table} WHERE stage = 'published'`);
    }
    for (const table of Object.values(LISTS)) {
      await c.query(`DELETE FROM ${table} WHERE stage = 'draft'`);
      await c.query(`INSERT INTO ${table} (id, stage, sort_order, data, updated_at) SELECT id, 'draft', sort_order, data, now() FROM ${table} WHERE stage = 'published'`);
    }
  });
  invalidateContent();
}

export async function hasUnpublishedChanges() {
  const [draft, published] = await Promise.all([loadContent('draft'), loadContent('published')]);
  return JSON.stringify(draft) !== JSON.stringify(published);
}

/** First boot: write the default content to both stages. */
export async function seedContent() {
  const existing = await one(`SELECT 1 FROM website_settings LIMIT 1`);
  if (existing) return;
  for (const [name, table] of Object.entries(SECTIONS) as [SectionName, string][]) {
    await query(`INSERT INTO ${table} (stage, data) VALUES ('draft', $1) ON CONFLICT DO NOTHING`, [DEFAULT_SECTIONS[name]]);
  }
  for (const name of Object.keys(LISTS) as ListName[]) {
    await saveList(name, DEFAULT_LISTS[name]);
  }
  await publishDraft();
}

export async function exportContent() {
  const draft = await loadContent('draft');
  return { app: '1st-gift', version: 1, exportedAt: new Date().toISOString(), ...draft };
}

export async function importContent(payload: any) {
  if (!payload || payload.app !== '1st-gift' || typeof payload.sections !== 'object' || typeof payload.lists !== 'object') {
    throw new Error('ไฟล์ตั้งค่าไม่ถูกต้อง');
  }
  for (const name of Object.keys(SECTIONS) as SectionName[]) {
    if (payload.sections[name]) await saveSection(name, payload.sections[name]);
  }
  for (const name of Object.keys(LISTS) as ListName[]) {
    if (Array.isArray(payload.lists[name])) await saveList(name, payload.lists[name]);
  }
}
