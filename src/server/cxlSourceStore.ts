/**
 * Cloudflare D1 copy of what the API reads from Google (CXL_D1_SOURCES=on): the raw Sheets
 * ranges and Drive JSON files, stored as the text Google returned. The code that interprets
 * them is unchanged, so every response is built exactly as before; only the transport moves.
 *
 * A copy is used while it is newer than the last write (any Owner write marks the store
 * dirty) and younger than MAX_AGE (covers edits made directly in Sheets/Drive). Otherwise it
 * is read from Google again and stored. Any D1 failure falls back to Google.
 * Google stays the source of truth; D1 only saves the Sheets read quota and latency.
 */

interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
  run(): Promise<unknown>;
}
export interface D1Like {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown>;
}

const MAX_AGE_MS = 15 * 60_000;
// D1 values are capped at about 2 MB; larger sources are simply not copied.
const MAX_BODY_CHARS = 1_800_000;

let db: D1Like | null = null;
let schemaReady: Promise<void> | null = null;

export function setSourceDb(next: D1Like | null): void {
  if (next !== db) schemaReady = null;
  db = next;
}

export function sourceStoreEnabled(): boolean {
  return db !== null && String(process.env.CXL_D1_SOURCES || '').trim().toLowerCase() === 'on';
}

function ensureSchema(store: D1Like): Promise<void> {
  if (!schemaReady) {
    schemaReady = store.batch([
      store.prepare('CREATE TABLE IF NOT EXISTS source_copy (key TEXT PRIMARY KEY, body TEXT NOT NULL, fetched_at INTEGER NOT NULL)'),
      store.prepare('CREATE TABLE IF NOT EXISTS source_meta (name TEXT PRIMARY KEY, value INTEGER NOT NULL)')
    ]).then(() => undefined);
    schemaReady.catch(() => { schemaReady = null; });
  }
  return schemaReady;
}

async function dirtyAt(store: D1Like): Promise<number> {
  const row = await store.prepare("SELECT value FROM source_meta WHERE name = 'dirty_at'").first<{ value: number }>();
  return Number(row?.value || 0);
}

/**
 * The text of one Google source (a Sheets range or a Drive file), from the D1 copy when it
 * is fresh, otherwise from `load` (which is then stored). `load` errors propagate as before.
 */
export async function sourceText(key: string, load: () => Promise<string>, now = Date.now()): Promise<string> {
  const store = sourceStoreEnabled() ? db : null;
  if (!store) return load();
  let copy: { body: string; fetched_at: number } | null = null;
  let dirty = 0;
  try {
    await ensureSchema(store);
    [copy, dirty] = await Promise.all([
      store.prepare('SELECT body, fetched_at FROM source_copy WHERE key = ?').bind(key).first<{ body: string; fetched_at: number }>(),
      dirtyAt(store)
    ]);
  } catch (error) {
    console.info(JSON.stringify({ event: 'cxl_source_store', result: 'read_failed', reason: error instanceof Error ? error.message.slice(0, 120) : 'unknown' }));
    return load();
  }
  if (copy && copy.fetched_at > dirty && now - copy.fetched_at < MAX_AGE_MS) return copy.body;
  const body = await load();
  if (body.length <= MAX_BODY_CHARS) {
    await store.prepare('INSERT INTO source_copy (key, body, fetched_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET body = excluded.body, fetched_at = excluded.fetched_at')
      .bind(key, body, now).run()
      .catch(error => console.info(JSON.stringify({ event: 'cxl_source_store', result: 'write_failed', reason: error instanceof Error ? error.message.slice(0, 120) : 'unknown' })));
  }
  return body;
}

/** After any Owner write: every copy taken before now is stale. */
export async function markSourcesDirty(now = Date.now()): Promise<void> {
  const store = db;
  if (!store) return;
  try {
    await ensureSchema(store);
    await store.prepare("INSERT INTO source_meta (name, value) VALUES ('dirty_at', ?) ON CONFLICT(name) DO UPDATE SET value = MAX(value, excluded.value)").bind(now).run();
  } catch (error) {
    console.info(JSON.stringify({ event: 'cxl_source_store', result: 'dirty_failed', reason: error instanceof Error ? error.message.slice(0, 120) : 'unknown' }));
  }
}
