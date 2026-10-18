import { fail } from './cxlDirectErrors.js';
import type { D1Like } from './cxlSourceStore.js';

/**
 * Works stored in Cloudflare D1 as the source of truth (CXL_D1_PRIMARY=on).
 *
 * Each row keeps the canonical record (the same JSON Drive revision files hold), the private
 * index fields the Sheets row would hold, and, for public Works, the public row and projection.
 * Writes commit here first (one atomic statement guarded by the expected revision); the same
 * record is then mirrored to Sheets/Drive as a backup. mirrored_revision tracks how far that
 * backup has caught up, so failed mirrors can be retried later.
 *
 * Reads build "virtual" Sheets rows and Drive files from these rows (file IDs d1:<id> and
 * d1pub:<id>), so the existing read code interprets them unchanged.
 */

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any
type Row = Record<string, unknown>;

export interface WorkCommit {
  id: string;
  record: Json;
  indexMeta: Row;
  publicRow: Row | null;
  publicProjection: Json | null;
  /** Revision the row must still have; null for a create. */
  expectedRevision: number | null;
}

export interface WorkStore {
  load(id: string): Promise<Json | null>;
  findByCreateRequest(requestId: string): Promise<Json | null>;
  exists(id: string): Promise<boolean>;
  category(id: string): Promise<string | null>;
  commit(change: WorkCommit): Promise<void>;
  remove(id: string, record: Json | null): Promise<void>;
  markMirrored(id: string, revision: number, error: string | null): Promise<void>;
  markDeleteMirrored(id: string, error: string | null): Promise<void>;
}

let db: D1Like | null = null;
let schemaReady: Promise<void> | null = null;
export function setWorkDb(next: D1Like | null): void {
  if (next !== db) schemaReady = null;
  db = next;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS works (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, create_request_id TEXT, category TEXT, record TEXT NOT NULL,
    index_meta TEXT NOT NULL, public_row TEXT, public_projection TEXT, updated_at TEXT, mirrored_revision INTEGER NOT NULL DEFAULT 0, mirror_error TEXT)`,
  'CREATE INDEX IF NOT EXISTS works_create_request ON works (create_request_id)',
  'CREATE TABLE IF NOT EXISTS deleted_works (id TEXT PRIMARY KEY, deleted_at TEXT NOT NULL, record TEXT, mirrored INTEGER NOT NULL DEFAULT 0, mirror_error TEXT)',
  'CREATE TABLE IF NOT EXISTS work_store_meta (name TEXT PRIMARY KEY, value TEXT NOT NULL)'
];

async function database(): Promise<D1Like> {
  if (!db) fail('WORK_STORE_UNAVAILABLE', 'Work database is not bound');
  const store = db!;
  if (!schemaReady) {
    schemaReady = store.batch(SCHEMA.map(sql => store.prepare(sql))).then(() => undefined);
    schemaReady.catch(() => { schemaReady = null; });
  }
  await schemaReady;
  return store;
}

/** True once the switch is on and the Works were imported (see importWorks in cxlWorkImport). */
export async function workStorePrimary(): Promise<boolean> {
  if (!db || String(process.env.CXL_D1_PRIMARY || '').trim().toLowerCase() !== 'on') return false;
  try {
    const store = await database();
    const imported = await store.prepare("SELECT value FROM work_store_meta WHERE name = 'imported_at'").first<{ value: string }>();
    return Boolean(imported?.value);
  } catch {
    return false;
  }
}

export async function setWorkStoreMeta(name: string, value: string): Promise<void> {
  const store = await database();
  await store.prepare('INSERT INTO work_store_meta (name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value').bind(name, value).run();
}

const parse = (text: unknown) => (typeof text === 'string' && text ? JSON.parse(text) : null);

export const d1WorkStore: WorkStore = {
  async load(id) {
    const row = await (await database()).prepare('SELECT record FROM works WHERE id = ?').bind(id).first<{ record: string }>();
    return row ? parse(row.record) : null;
  },
  async findByCreateRequest(requestId) {
    const row = await (await database()).prepare('SELECT record FROM works WHERE create_request_id = ?').bind(requestId).first<{ record: string }>();
    return row ? parse(row.record) : null;
  },
  async exists(id) {
    const store = await database();
    const [live, gone] = await Promise.all([
      store.prepare('SELECT 1 AS found FROM works WHERE id = ?').bind(id).first(),
      store.prepare('SELECT 1 AS found FROM deleted_works WHERE id = ?').bind(id).first()
    ]);
    return Boolean(live || gone);
  },
  async category(id) {
    const row = await (await database()).prepare('SELECT category FROM works WHERE id = ?').bind(id).first<{ category: string }>();
    return row ? row.category : null;
  },
  async commit(change) {
    const store = await database();
    const values = [Number(change.record.revision) || 1, String(change.record.createRequestId || '') || null, String(change.record.row?.category || ''),
      JSON.stringify(change.record), JSON.stringify(change.indexMeta), change.publicRow ? JSON.stringify(change.publicRow) : null,
      change.publicProjection ? JSON.stringify(change.publicProjection) : null, String(change.record.row?.updated_at || '')];
    if (change.expectedRevision === null) {
      const result = await store.prepare(`INSERT INTO works (revision, create_request_id, category, record, index_meta, public_row, public_projection, updated_at, id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`).bind(...values, change.id).run() as { meta?: { changes?: number } };
      if (result.meta?.changes !== 1) fail('IDEMPOTENCY_KEY_REUSED', 'Create requestId conflicts with an existing Work');
      return;
    }
    const result = await store.prepare(`UPDATE works SET revision = ?, create_request_id = ?, category = ?, record = ?, index_meta = ?, public_row = ?, public_projection = ?, updated_at = ?
      WHERE id = ? AND revision = ?`).bind(...values, change.id, change.expectedRevision).run() as { meta?: { changes?: number } };
    if (result.meta?.changes !== 1) fail('REVISION_CONFLICT', 'Work revision changed before save; reload before saving');
  },
  async remove(id, record) {
    const store = await database();
    // The trashed record is kept so a retried delete mirror can first bring Google to it.
    await store.batch([
      store.prepare('DELETE FROM works WHERE id = ?').bind(id),
      store.prepare('INSERT INTO deleted_works (id, deleted_at, record) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET deleted_at = excluded.deleted_at, record = excluded.record, mirrored = 0')
        .bind(id, new Date().toISOString(), record ? JSON.stringify(record) : null)
    ]);
  },
  async markMirrored(id, revision, error) {
    const store = await database();
    if (error) await store.prepare('UPDATE works SET mirror_error = ? WHERE id = ?').bind(error.slice(0, 300), id).run();
    else await store.prepare('UPDATE works SET mirrored_revision = MAX(mirrored_revision, ?), mirror_error = NULL WHERE id = ?').bind(revision, id).run();
  },
  async markDeleteMirrored(id, error) {
    await (await database()).prepare('UPDATE deleted_works SET mirrored = ?, mirror_error = ? WHERE id = ?').bind(error ? 0 : 1, error ? error.slice(0, 300) : null, id).run();
  }
};

/** Revision of every Work in D1, for the importer. */
export async function storedRevisions(): Promise<Map<string, number>> {
  const rows = await (await database()).prepare('SELECT id, revision FROM works').all<{ id: string; revision: number }>();
  return new Map((rows.results || []).map(row => [row.id, Number(row.revision)]));
}

/**
 * Copies a record read from Google into D1 (the Google copy is then already the backup).
 * Never replaces a newer D1 revision.
 */
export async function importRecord(change: Omit<WorkCommit, 'expectedRevision'>): Promise<void> {
  const r = change.record;
  await (await database()).prepare(`INSERT INTO works (id, revision, create_request_id, category, record, index_meta, public_row, public_projection, updated_at, mirrored_revision)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET revision = excluded.revision, create_request_id = excluded.create_request_id, category = excluded.category,
    record = excluded.record, index_meta = excluded.index_meta, public_row = excluded.public_row, public_projection = excluded.public_projection, updated_at = excluded.updated_at,
    mirrored_revision = excluded.mirrored_revision, mirror_error = NULL WHERE works.revision < excluded.revision`)
    .bind(change.id, Number(r.revision) || 1, String(r.createRequestId || '') || null, String(r.row?.category || ''), JSON.stringify(r), JSON.stringify(change.indexMeta),
      change.publicRow ? JSON.stringify(change.publicRow) : null, change.publicProjection ? JSON.stringify(change.publicProjection) : null, String(r.row?.updated_at || ''), Number(r.revision) || 1)
    .run();
}

/** Counts for the Owner tool: how many Works, and how many backups are behind. */
export async function workStoreStatus(): Promise<{ works: number; mirrorPending: number; deletePending: number; importedAt: string | null }> {
  const store = await database();
  const [works, pending, deletions, imported] = await Promise.all([
    store.prepare('SELECT count(*) AS n FROM works').first<{ n: number }>(),
    store.prepare('SELECT count(*) AS n FROM works WHERE mirrored_revision < revision').first<{ n: number }>(),
    store.prepare('SELECT count(*) AS n FROM deleted_works WHERE mirrored = 0').first<{ n: number }>(),
    store.prepare("SELECT value FROM work_store_meta WHERE name = 'imported_at'").first<{ value: string }>()
  ]);
  return { works: Number(works?.n || 0), mirrorPending: Number(pending?.n || 0), deletePending: Number(deletions?.n || 0), importedAt: imported?.value || null };
}

// ---- Virtual Sheets rows / Drive files for the read path ----

export const D1_RECORD_PREFIX = 'd1:';
export const D1_PROJECTION_PREFIX = 'd1pub:';

/** Private Index rows (header-keyed) as the Sheets first tab would return them. */
export async function d1PrivateIndexRows(): Promise<Row[]> {
  const rows = await (await database()).prepare('SELECT id, index_meta FROM works').all<{ id: string; index_meta: string }>();
  return (rows.results || []).map(row => ({ ...parse(row.index_meta), file_id: `${D1_RECORD_PREFIX}${row.id}` }));
}

/** Public Index rows (active public Works). */
export async function d1PublicRows(): Promise<Row[]> {
  const rows = await (await database()).prepare('SELECT id, public_row FROM works WHERE public_row IS NOT NULL').all<{ id: string; public_row: string }>();
  return (rows.results || []).map(row => ({ ...parse(row.public_row), file_id: `${D1_PROJECTION_PREFIX}${row.id}`, active: 'true' }));
}

/** The record (d1:<id>) or public projection (d1pub:<id>) a virtual file ID names. */
export async function d1VirtualFile(fileId: string): Promise<Json | null> {
  const store = await database();
  if (fileId.startsWith(D1_PROJECTION_PREFIX)) {
    const row = await store.prepare('SELECT public_projection FROM works WHERE id = ?').bind(fileId.slice(D1_PROJECTION_PREFIX.length)).first<{ public_projection: string }>();
    return row ? parse(row.public_projection) : null;
  }
  const row = await store.prepare('SELECT record FROM works WHERE id = ?').bind(fileId.slice(D1_RECORD_PREFIX.length)).first<{ record: string }>();
  return row ? parse(row.record) : null;
}

/** Works whose Sheets/Drive backup is behind, and deletions not yet mirrored. */
export async function pendingMirrors(limit: number): Promise<{ works: Json[]; deletions: { id: string; record: Json | null }[] }> {
  const store = await database();
  const [works, deletions] = await Promise.all([
    store.prepare('SELECT record FROM works WHERE mirrored_revision < revision ORDER BY updated_at LIMIT ?').bind(limit).all<{ record: string }>(),
    store.prepare('SELECT id, record FROM deleted_works WHERE mirrored = 0 LIMIT ?').bind(limit).all<{ id: string; record: string | null }>()
  ]);
  return { works: (works.results || []).map(row => parse(row.record)), deletions: (deletions.results || []).map(row => ({ id: row.id, record: parse(row.record) })) };
}
