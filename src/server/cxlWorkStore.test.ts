import { afterEach, describe, expect, it, vi } from 'vitest';
import { d1PrivateIndexRows, d1PublicRows, d1VirtualFile, d1WorkStore, importRecord, pendingMirrors, setWorkDb, setWorkStoreMeta, storedRevisions, workStorePrimary, workStoreStatus } from './cxlWorkStore';
import { sqliteD1 } from './testing/sqliteD1';

const record = (id: string, revision: number, extra: Record<string, unknown> = {}) => ({
  revision, createRequestId: `req-${id}`, row: { id, category: 'lore', updated_at: `2026-10-18T00:00:0${revision}Z` }, mediaRecords: [], ...extra
});
const commit = (id: string, revision: number, expectedRevision: number | null, isPublic = false) => d1WorkStore.commit({
  id, record: record(id, revision), expectedRevision, indexMeta: { id, revision, summary_json: '{}' },
  publicRow: isPublic ? { id, title: 'T', summary_json: '{}' } : null, publicProjection: isPublic ? { id, title: 'T' } : null
});

afterEach(() => { setWorkDb(null); vi.unstubAllEnvs(); });

describe('D1 Work store (real SQLite)', () => {
  it('creates once, updates only from the expected revision, and keeps backups pending until mirrored', async () => {
    setWorkDb(sqliteD1());
    await commit('asset_a', 1, null, true);
    await expect(commit('asset_a', 1, null)).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
    await commit('asset_a', 2, 1);
    await expect(commit('asset_a', 3, 1)).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
    expect((await d1WorkStore.load('asset_a')).revision).toBe(2);
    expect(await d1WorkStore.findByCreateRequest('req-asset_a')).toMatchObject({ revision: 2 });
    expect(await d1WorkStore.category('asset_a')).toBe('lore');

    expect((await pendingMirrors(10)).works.map(item => item.row.id)).toEqual(['asset_a']);
    await d1WorkStore.markMirrored('asset_a', 2, 'Google API PUT failed (HTTP 500)');
    expect((await workStoreStatus()).mirrorPending).toBe(1);
    await d1WorkStore.markMirrored('asset_a', 2, null);
    expect((await pendingMirrors(10)).works).toEqual([]);
  });

  it('builds the virtual index rows and files the read path interprets', async () => {
    setWorkDb(sqliteD1());
    await commit('asset_pub', 1, null, true);
    await commit('asset_priv', 1, null, false);
    expect(await d1PrivateIndexRows()).toEqual(expect.arrayContaining([
      { id: 'asset_pub', revision: 1, summary_json: '{}', file_id: 'd1:asset_pub' },
      { id: 'asset_priv', revision: 1, summary_json: '{}', file_id: 'd1:asset_priv' }
    ]));
    expect(await d1PublicRows()).toEqual([{ id: 'asset_pub', title: 'T', summary_json: '{}', file_id: 'd1pub:asset_pub', active: 'true' }]);
    expect(await d1VirtualFile('d1:asset_priv')).toMatchObject({ revision: 1, row: { id: 'asset_priv' } });
    expect(await d1VirtualFile('d1pub:asset_pub')).toEqual({ id: 'asset_pub', title: 'T' });
    expect(await d1VirtualFile('d1pub:asset_priv')).toBeNull();
  });

  it('imports Google records without overwriting a newer D1 revision, and only reports primary once imported', async () => {
    setWorkDb(sqliteD1());
    vi.stubEnv('CXL_D1_PRIMARY', 'on');
    const fields = (id: string, revision: number) => ({ id, record: record(id, revision), indexMeta: { id, revision }, publicRow: null, publicProjection: null });
    await importRecord(fields('asset_a', 3));
    await importRecord(fields('asset_a', 2));
    expect(await storedRevisions()).toEqual(new Map([['asset_a', 3]]));
    // Imported records are already backed up in Google.
    expect((await pendingMirrors(10)).works).toEqual([]);
    expect(await workStorePrimary()).toBe(false);
    await setWorkStoreMeta('imported_at', '2026-10-18T00:00:00Z');
    expect(await workStorePrimary()).toBe(true);
    vi.stubEnv('CXL_D1_PRIMARY', 'off');
    expect(await workStorePrimary()).toBe(false);
  });

  it('removes a Work atomically and keeps its record for the delete mirror', async () => {
    setWorkDb(sqliteD1());
    await commit('asset_a', 1, null);
    await d1WorkStore.remove('asset_a', record('asset_a', 1));
    expect(await d1WorkStore.load('asset_a')).toBeNull();
    expect(await d1WorkStore.exists('asset_a')).toBe(true);
    expect((await pendingMirrors(10)).deletions).toEqual([{ id: 'asset_a', record: expect.objectContaining({ revision: 1 }) }]);
    await d1WorkStore.markDeleteMirrored('asset_a', null);
    expect((await pendingMirrors(10)).deletions).toEqual([]);
  });
});
