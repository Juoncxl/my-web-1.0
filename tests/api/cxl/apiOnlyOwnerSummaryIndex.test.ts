import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(join(process.cwd(), 'apps-script', 'api-only-owner', 'Code.gs'), 'utf8');

function bridge() {
  const context: Record<string, any> = {};
  let id = 0;
  context.Utilities = { getUuid: () => `token-${++id}` };
  context.console = { log: vi.fn() };
  runInNewContext(source, context);
  return context;
}

function asset(id = 'work-1', overrides: Record<string, unknown> = {}) {
  return {
    id, userId: 'owner-1', authorName: 'Owner Name', title: 'Work title', icon: { type: 'emoji', value: '✨' },
    category: 'character', shortDescription: 'short description', contentTypeLabels: [], contentTypes: [],
    contentBlocks: [], content: '', uiCodeSnippet: '', previewImage: '', previewImages: [], media: [], folderId: null,
    isPublic: false, visibility: 'private', status: 'draft', tags: [], createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z', deletedAt: null, ...overrides
  };
}

function indexed(work: ReturnType<typeof asset>, ctx = bridge()) {
  const artifacts = ctx.ownerSearchArtifacts_(work);
  const summaryAsset = { ...work, content: String(work.content || '').slice(0, 600), uiCodeSnippet: String(work.uiCodeSnippet || '').slice(0, 600), contentBlocks: (work.contentBlocks as any[]).map(block => ({ ...block, body: '' })) };
  const row = {
    id: work.id, title: work.title, category: work.category, status: work.status, visibility: work.visibility,
    isPublic: work.isPublic, deletedAt: work.deletedAt, folderId: work.folderId, tags: work.tags,
    createdAt: work.createdAt, updatedAt: work.updatedAt, userId: work.userId, revision: 3,
    summaryVersion: 1, summaryJson: JSON.stringify({ summaryVersion: 1, asset: summaryAsset }),
    searchVersion: artifacts.version, searchChunkCount: artifacts.chunks.length, searchIndexToken: artifacts.token
  };
  const chunks = artifacts.chunks.map((search_text: string, chunk_index: number) => ({
    work_id: work.id, chunk_index, search_text, search_version: artifacts.version,
    updated_at: artifacts.updatedAt, index_token: artifacts.token
  }));
  return { row, chunks, artifacts };
}

class MemorySheet {
  rows: unknown[][];
  valueReads: number[][] = [];
  constructor(headers: string[], data: unknown[][] = []) { this.rows = [headers, ...data]; }
  getLastColumn() { return this.rows[0]?.length || 1; }
  getLastRow() { return this.rows.length; }
  getRange(row: number, column: number, height = 1, width = 1) {
    const sheet = this;
    return {
      getValues() { sheet.valueReads.push([row, column, height, width]); return Array.from({ length: height }, (_, r) => Array.from({ length: width }, (_, c) => sheet.rows[row - 1 + r]?.[column - 1 + c] ?? '')); },
      getValue() { return sheet.rows[row - 1]?.[column - 1] ?? ''; },
      createTextFinder(text: string) {
        let entire = false;
        return {
          matchEntireCell(value: boolean) { entire = value; return this; },
          matchCase() { return this; },
          useRegularExpression() { return this; },
          findAll() {
            const matches: { getRow: () => number }[] = [];
            for (let index = row - 1; index < Math.min(sheet.rows.length, row - 1 + height); index++) {
              const cell = String(sheet.rows[index]?.[column - 1] ?? '');
              if (entire ? cell === text : cell.includes(text)) matches.push({ getRow: () => index + 1 });
            }
            return matches;
          }
        };
      },
      setValues(values: unknown[][]) {
        values.forEach((valuesRow, r) => {
          const rowNumber = row - 1 + r;
          while (sheet.rows.length <= rowNumber) sheet.rows.push(Array(sheet.getLastColumn()).fill(''));
          while (sheet.rows[rowNumber].length < column - 1 + valuesRow.length) sheet.rows[rowNumber].push('');
          valuesRow.forEach((value, c) => { sheet.rows[rowNumber][column - 1 + c] = value; });
        });
      }
    };
  }
  appendRow(values: unknown[]) { this.rows.push(values); }
  deleteRow(row: number) { this.rows.splice(row - 1, 1); }
  deleteRows(row: number, count: number) { this.rows.splice(row - 1, count); }
  deleteColumn(column: number) { this.rows.forEach(row => row.splice(column - 1, 1)); }
}

function legacyPrivateRows(count: number, ctx: Record<string, any>) {
  const headers = [...ctx.PRIVATE_HEADERS, 'search_text'];
  const rows = Array.from({ length: count }, (_, index) => {
    const work = asset(`w${index}`, { title: `Title ${index}`, content: `Existing indexed content ${index}` });
    return headers.map((header) => ({
      id: work.id, title: work.title, category: work.category, status: work.status, visibility: 'private', is_public: 'false',
      deleted_at: '', folder_id: '', tags: '[]', updated_at: work.updatedAt, revision: 1, file_id: `file-${index}`,
      user_id: 'owner-1', created_at: work.createdAt,
      summary_json: JSON.stringify({ summaryVersion: 1, asset: work }), summary_version: 1,
      search_text: 'legacy single-cell corpus'
    } as Record<string, unknown>)[header] ?? '');
  });
  return new MemorySheet(headers, rows);
}

function writableBridge() {
  const context = bridge();
  const privateSheet = new MemorySheet(context.PRIVATE_HEADERS);
  const searchSheet = new MemorySheet(context.OWNER_SEARCH_HEADERS_);
  const files = new Map<string, any>();
  let onLock: (() => void) | undefined;
  context.config_ = () => ({ privateSheetId: 'private', privateId: 'drive' });
  context.sheet_ = () => privateSheet;
  context.ownerSearchSheet_ = () => searchSheet;
  context.LockService = { getScriptLock: () => ({ waitLock: () => onLock?.(), releaseLock: vi.fn() }) };
  context.shareRecordMedia_ = vi.fn();
  context.validateOwnerFolder_ = vi.fn();
  context.writeFingerprint_ = () => 'matching-fingerprint';
  context.parse_ = vi.fn((fileId: string) => structuredClone(files.get(fileId)));
  context.putJsonRevision_ = vi.fn((_folder: string, _name: string, record: any) => {
    const fileId = `file-${record.revision}`;
    files.set(fileId, structuredClone(record));
    return fileId;
  });
  context.putJson_ = context.putJsonRevision_;
  const original = asset('write-work', { content: 'first indexed revision' });
  context.saveOwnerWork_({ id: original.id, ownerUserId: 'owner-1', title: original.title, category: 'character', status: 'draft', visibility: 'private', tags: [], cxlAsset: original, content: original.content }, { idempotent: true, deferPublicSync: true });
  context.parse_.mockClear();
  context.putJsonRevision_.mockClear();
  return { context, privateSheet, searchSheet, files, setOnLock: (callback: () => void) => { onLock = callback; } };
}

describe('API-only Owner chunked search index', () => {
  it('chunks searchable corpora larger than one cell and finds terms in later chunks', () => {
    const context = bridge();
    const work = asset('large', { content: `${'x'.repeat(70_000)} unique-late-term ${'y'.repeat(10_000)}` });
    const { row, chunks } = indexed(work, context);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk: any) => chunk.search_text.length <= context.OWNER_SEARCH_CHUNK_CHARS_)).toBe(true);
    context.listOwnerIndex_ = () => [row];
    context.listOwnerSearchIndex_ = () => chunks;
    context.getOwnerWork_ = vi.fn(() => { throw new Error('search must not read Drive'); });
    expect(context.fetchCxlWorks_({ search: 'UNIQUE-LATE-TERM' }).data.map((item: any) => item.id)).toEqual(['large']);
    expect(context.getOwnerWork_).not.toHaveBeenCalled();
  });

  it('preserves substring search for a query crossing a chunk boundary', () => {
    const context = bridge();
    const crossingQuery = 'cross-boundary-substring';
    const boundaryOffset = context.OWNER_SEARCH_CHUNK_CHARS_ - 8;
    const work = asset('boundary', { content: `${'a'.repeat(boundaryOffset)}${crossingQuery}${'b'.repeat(40_000)}` });
    const { row, chunks } = indexed(work, context);
    expect(chunks.some((chunk: any) => chunk.search_text.includes(crossingQuery))).toBe(true);
    context.listOwnerIndex_ = () => [row];
    context.listOwnerSearchIndex_ = () => chunks;
    expect(context.fetchCxlWorks_({ search: crossingQuery }).data.map((item: any) => item.id)).toEqual(['boundary']);
  });

  it('keeps full-content search coverage across all existing fields and never returns search data', () => {
    const context = bridge();
    const work = asset('fields', {
      title: 'TitleNeedle', shortDescription: 'DescriptionNeedle', content: `ContentNeedle${'x'.repeat(700)}FullCorpusOnlyMarker`,
      contentBlocks: [{ id: 'b', type: 'Text', title: 'BlockTitleNeedle', body: 'BlockBodyNeedle' }],
      authorName: 'AuthorNeedle', tags: ['TagNeedle'], uiCodeSnippet: 'CodeNeedle'
    });
    const { row, chunks } = indexed(work, context);
    context.listOwnerIndex_ = () => [row];
    context.listOwnerSearchIndex_ = () => chunks;
    for (const query of ['titleneedle', 'DESCRIPTIONneedle', 'contentneedle', 'blocktitleneedle', 'blockbodyneedle', 'authorneedle', 'tagneedle', 'codeneedle']) {
      const result = context.fetchCxlWorks_({ search: query });
      expect(result.data.map((item: any) => item.id), query).toEqual(['fields']);
      expect(JSON.stringify(result)).not.toContain('search_text');
      expect(JSON.stringify(result)).not.toContain('FullCorpusOnlyMarker');
    }
  });

  it('does not read OwnerSearchIndex or canonical Drive JSON for an unsearched list', () => {
    const context = bridge();
    const { row } = indexed(asset('list-only'), context);
    context.listOwnerIndex_ = () => [row];
    context.listOwnerSearchIndex_ = vi.fn(() => { throw new Error('search sheet must not be read'); });
    context.getOwnerWork_ = vi.fn(() => { throw new Error('list must not read Drive'); });
    expect(context.fetchCxlWorks_({ detail: 'summary' }).data[0].id).toBe('list-only');
    expect(context.listOwnerSearchIndex_).not.toHaveBeenCalled();
    expect(context.getOwnerWork_).not.toHaveBeenCalled();
  });

  it('logs read phase timings without including work identifiers or search content', () => {
    const context = bridge();
    const { row } = indexed(asset('private-work-id', { title: 'private search phrase' }), context);
    context.listOwnerIndex_ = () => [row];
    context.fetchCxlWorks_({ detail: 'summary' });
    const logs = context.console.log.mock.calls.map((call: unknown[]) => String(call[0])).join('\n');
    expect(logs).toContain('cxl_owner_timing');
    expect(logs).toContain('indexReadMs');
    expect(logs).not.toContain('private-work-id');
    expect(logs).not.toContain('private search phrase');
  });

  it('reads only the selected canonical Work JSON for detail and rejects full-list detail', () => {
    const context = bridge();
    const work = asset('detail');
    context.getOwnerWork_ = vi.fn(() => ({ cxlAsset: work, revision: 3, mediaRecords: [] }));
    expect(context.fetchCxlWorks_({ assetId: 'detail', detail: 'full' }).data[0].id).toBe('detail');
    expect(context.getOwnerWork_).toHaveBeenCalledTimes(1);
    expect(context.getOwnerWork_).toHaveBeenCalledWith('detail', true);
    expect(() => context.fetchCxlWorks_({ detail: 'full' })).toThrow(/Full Work reads require one assetId/);
    expect(context.getOwnerWork_).toHaveBeenCalledTimes(1);
  });

  it('fails a search closed when a required chunk is missing or invalid', () => {
    const context = bridge();
    const { row, chunks } = indexed(asset('stale', { content: 'searchable body' }), context);
    context.listOwnerIndex_ = () => [row];
    context.listOwnerSearchIndex_ = () => chunks.slice(1);
    expect(() => context.fetchCxlWorks_({ search: 'body' })).toThrow(/search index is incomplete/);
  });

  it('preserves owner, public, folder, deleted, category, ordering, and limit filters', () => {
    const context = bridge();
    const works = [
      asset('older', { createdAt: '2025-01-01', category: 'lore', folderId: 'folder-1' }),
      asset('newer', { createdAt: '2026-02-01', category: 'lore', folderId: 'folder-1', isPublic: true, visibility: 'public' }),
      asset('deleted', { createdAt: '2026-03-01', deletedAt: '2026-03-02', category: 'lore', folderId: 'folder-1' }),
      asset('other-folder', { category: 'lore', folderId: 'folder-2' }),
      asset('other-owner', { userId: 'elsewhere', category: 'lore', folderId: 'folder-1' }),
      asset('other-category', { category: 'prompts', folderId: 'folder-1' })
    ];
    const ready = works.map(work => indexed(work, context));
    context.listOwnerIndex_ = () => ready.map(item => item.row);
    context.listOwnerSearchIndex_ = () => ready.flatMap(item => item.chunks);
    const result = context.fetchCxlWorks_({ userId: 'owner-1', currentUserId: 'owner-1', category: 'lore', folderId: 'folder-1', includeDeleted: false, limit: 1 });
    expect(result.data.map((item: any) => item.id)).toEqual(['newer']);
    expect(context.fetchCxlWorks_({ userId: 'owner-1', publicOnly: true }).data.map((item: any) => item.id)).toEqual(['newer']);
    expect(context.fetchCxlWorks_({ userId: 'owner-1', onlyDeleted: true, currentUserId: 'owner-1' }).data.map((item: any) => item.id)).toEqual(['deleted']);
  });

  it('refreshes compact private summary and search generation without storing search text in Private Index', () => {
    const context = bridge();
    const work = asset('updated', { content: `${'x'.repeat(65_000)} updated hidden content`, uiCodeSnippet: 'Updated code' });
    const record = { row: { id: 'updated', user_id: 'owner-1', created_at: work.createdAt, title: work.title, tags: [], is_public: false }, cxlAsset: work, revision: 4, mediaRecords: [] };
    const artifacts = context.ownerSearchArtifacts_(work);
    const metadata = context.privateMeta_(record, 'private-file-id', artifacts);
    const envelope = JSON.parse(metadata.summary_json);
    expect(metadata.search_version).toBe(1);
    expect(metadata.search_chunk_count).toBeGreaterThan(1);
    expect(metadata.search_index_token).toBe(artifacts.token);
    expect(metadata).not.toHaveProperty('search_text');
    expect(envelope.summaryVersion).toBe(1);
    expect(envelope.asset.content).toHaveLength(600);
    expect(envelope).not.toHaveProperty('search_text');
    expect(artifacts.chunks.join('')).toContain('updated hidden content');
  });

  it('backfill resumes partial progress, clears legacy cells, and reruns without duplicate chunks or rereads', () => {
    const context = bridge();
    const privateSheet = legacyPrivateRows(21, context);
    const searchSheet = new MemorySheet(context.OWNER_SEARCH_HEADERS_);
    let reads = 0;
    context.config_ = () => ({ privateSheetId: 'private-sheet' });
    context.sheet_ = () => privateSheet;
    context.ownerSearchSheet_ = () => searchSheet;
    context.parse_ = (fileId: string) => {
      reads++;
      const index = Number(fileId.split('-')[1]);
      const work = asset(`w${index}`, { title: `Title ${index}`, content: `${'z'.repeat(35_000)} needle-${index}` });
      return { row: { id: work.id, user_id: 'owner-1', created_at: work.createdAt, title: work.title, tags: [], is_public: false }, cxlAsset: work, revision: 1, mediaRecords: [] };
    };
    const first = context.backfillOwnerSummaryIndex_();
    expect(first).toMatchObject({ processed: 20, driveReads: 20, remaining: 1, ready: false, batchLimit: 20 });
    expect(reads).toBe(20);
    const second = context.backfillOwnerSummaryIndex_();
    expect(second).toMatchObject({ processed: 1, driveReads: 1, remaining: 0, ready: true });
    expect(reads).toBe(21);
    const rowCount = searchSheet.getLastRow();
    const third = context.backfillOwnerSummaryIndex_();
    expect(third).toMatchObject({ processed: 0, driveReads: 0, remaining: 0, ready: true });
    expect(searchSheet.getLastRow()).toBe(rowCount);
    expect(privateSheet.rows[0]).not.toContain('search_text');
  });

  it('replaces old chunks after an update and removes stale extra chunks', () => {
    const context = bridge();
    const old = indexed(asset('update-work', { content: `${'old '.repeat(12_000)}stale-only-term` }), context);
    const next = indexed(asset('update-work', { content: 'short new revision' }), context);
    const rows = [...old.chunks, ...next.chunks];
    const sheet = new MemorySheet(context.OWNER_SEARCH_HEADERS_, rows.map((chunk: any) => context.OWNER_SEARCH_HEADERS_.map((key: string) => chunk[key])));
    context.removeStaleOwnerSearchChunks_(sheet, 'update-work', next.artifacts.token);
    expect(sheet.getLastRow() - 1).toBe(next.chunks.length);
    expect(JSON.stringify(sheet.rows)).not.toContain('stale-only-term');
  });

  it('cleans stale search chunks using exact Work matches and reads only matching token ranges', () => {
    const context = bridge();
    const old = indexed(asset('cleanup-work', { content: `${'old '.repeat(12_000)}stale-only-term` }), context);
    const next = indexed(asset('cleanup-work', { content: 'short new revision' }), context);
    const sheet = new MemorySheet(context.OWNER_SEARCH_HEADERS_, [...old.chunks, ...next.chunks].map((chunk: any) => context.OWNER_SEARCH_HEADERS_.map((key: string) => chunk[key])));
    context.removeStaleOwnerSearchChunks_(sheet, 'cleanup-work', next.artifacts.token);

    expect(sheet.valueReads).toEqual([
      [1, 1, 1, context.OWNER_SEARCH_HEADERS_.length],
      [2, context.OWNER_SEARCH_HEADERS_.indexOf('index_token') + 1, old.chunks.length + next.chunks.length, 1]
    ]);
    expect(sheet.getLastRow() - 1).toBe(next.chunks.length);
  });

  it('uses an exact ID-column lookup instead of projecting every Private Index row', () => {
    const context = bridge();
    const sheet = new MemorySheet(['id', 'title', 'file_id'], [
      ['work-a', 'A', 'file-a'], ['work-b', 'B', 'file-b'], ['work-c', 'C', 'file-c']
    ]);
    const projectRows = vi.spyOn(context, 'objectRows_').mockImplementation(() => { throw new Error('full index projection is not allowed'); });

    expect(context.rowById_(sheet, 'work-b')).toMatchObject({ id: 'work-b', title: 'B', file_id: 'file-b', _sheetRow: 3 });
    expect(context.rowById_(sheet, 'missing')).toBeNull();
    expect(projectRows).not.toHaveBeenCalled();
  });

  it('rejects duplicate exact index IDs instead of selecting an ambiguous canonical file', () => {
    const context = bridge();
    const sheet = new MemorySheet(['id', 'file_id'], [['duplicate', 'first'], ['duplicate', 'second']]);
    expect(() => context.rowById_(sheet, 'duplicate')).toThrow(expect.objectContaining({ apiCode: 'INDEX_ROW_AMBIGUOUS' }));
  });

  it('selects public projection work only for transitions that need an active public row', () => {
    const context = bridge();
    expect(context.publicProjectionAction_(false, false)).toBe('none'); // private -> private
    expect(context.publicProjectionAction_(true, false)).toBe('deactivate'); // public -> private
    expect(context.publicProjectionAction_(false, true)).toBe('upsert'); // private -> public
    expect(context.publicProjectionAction_(true, true)).toBe('upsert'); // public -> public

    const privateRecord = { row: { id: 'private-work', visibility: 'private', is_public: false, deleted_at: '' } };
    context.upsertWorkCreatorMap_ = vi.fn();
    context.syncPublic_ = vi.fn();
    expect(() => context.finishCxlPublicProjection_(privateRecord, 'owner')).not.toThrow();
    expect(context.upsertWorkCreatorMap_).not.toHaveBeenCalled();
    expect(context.syncPublic_).not.toHaveBeenCalled();
  });

  it('refreshes the Private summary and active search generation on create/update writes', () => {
    const context = bridge();
    const privateSheet = new MemorySheet(context.PRIVATE_HEADERS_ || context.PRIVATE_HEADERS);
    const searchSheet = new MemorySheet(context.OWNER_SEARCH_HEADERS_);
    let canonical: any;
    context.config_ = () => ({ privateSheetId: 'private', privateId: 'drive' });
    context.sheet_ = () => privateSheet;
    context.ownerSearchSheet_ = () => searchSheet;
    context.LockService = { getScriptLock: () => ({ waitLock: vi.fn(), releaseLock: vi.fn() }) };
    context.shareRecordMedia_ = vi.fn();
    context.parse_ = vi.fn(() => canonical);
    context.putJsonRevision_ = vi.fn((_folder: string, _name: string, record: any) => { canonical = record; return `file-${record.revision}`; });
    context.putJson_ = vi.fn((_folder: string, _name: string, record: any) => { canonical = record; return `file-${record.revision}`; });
    const original = asset('write-work', { content: 'first indexed revision' });
    context.saveOwnerWork_({ id: original.id, ownerUserId: 'owner-1', title: original.title, category: 'character', status: 'draft', visibility: 'private', tags: [], cxlAsset: original, content: original.content }, { idempotent: true, deferPublicSync: true });
    const firstIndex = context.objectRows_(privateSheet)[0];
    const firstToken = firstIndex.search_index_token;
    expect(context.objectRows_(searchSheet).some((row: any) => row.index_token === firstToken && String(row.search_text).includes('first indexed revision'))).toBe(true);

    context.saveOwnerWork_({ id: original.id, ownerUserId: 'owner-1', revision: 1, title: original.title, category: 'character', status: 'draft', visibility: 'private', tags: [], cxlAsset: { ...original, content: 'replacement indexed revision' }, content: 'replacement indexed revision' }, { idempotent: true, deferPublicSync: true });
    const updatedIndex = context.objectRows_(privateSheet)[0];
    const chunks = context.objectRows_(searchSheet);
    expect(updatedIndex.search_index_token).not.toBe(firstToken);
    expect(updatedIndex.revision).toBe(2);
    expect(chunks.some((row: any) => row.index_token === firstToken)).toBe(true);
    expect(chunks.some((row: any) => row.index_token === updatedIndex.search_index_token)).toBe(true);
    expect(context.ownerSearchMatches_([updatedIndex], chunks, 'replacement indexed revision')['write-work']).toBe(true);
    expect(context.ownerSearchMatches_([updatedIndex], chunks, 'first indexed revision')['write-work']).toBeUndefined();
    expect(context.ownerSearchReadiness_([updatedIndex], chunks)).toMatchObject({ validWorks: 1, staleExtraChunks: 1 });
    expect(context.verifyOwnerSummaryReadiness_()).toMatchObject({ ready: true, validSearchWorks: 1, staleExtraChunks: 1 });
    expect(updatedIndex).not.toHaveProperty('search_text');
    expect(context.parse_).toHaveBeenCalledOnce();
    expect(canonical.cxlAsset.content).toBe('replacement indexed revision');
  });

  it('compacts stale search generations in bounded manual batches without touching active search rows', () => {
    const context = bridge();
    const current = indexed(asset('work-a', { content: 'current searchable content' }), context);
    const stale = [
      { ...current.chunks[0], index_token: 'old-a', search_text: 'obsolete a' },
      { ...current.chunks[0], work_id: 'orphan', index_token: 'old-orphan', search_text: 'orphan content' },
      { ...current.chunks[0], index_token: 'older-a', search_text: 'obsolete b' }
    ];
    const privateSheet = new MemorySheet(['id', 'search_index_token'], [['work-a', current.artifacts.token]]);
    const searchSheet = new MemorySheet(context.OWNER_SEARCH_HEADERS_, [...stale, ...current.chunks].map((row: any) => context.OWNER_SEARCH_HEADERS_.map((key: string) => row[key])));
    context.config_ = () => ({ privateSheetId: 'private' });
    context.sheet_ = () => privateSheet;
    context.ownerSearchSheet_ = () => searchSheet;
    context.LockService = { getScriptLock: () => ({ waitLock: vi.fn(), releaseLock: vi.fn() }) };

    expect(context.compactOwnerSearchIndex_(2)).toMatchObject({ deleted: 2, remaining: 1, batchLimit: 2 });
    expect(context.compactOwnerSearchIndex_(2)).toMatchObject({ deleted: 1, remaining: 0 });
    expect(context.compactOwnerSearchIndex_()).toMatchObject({ deleted: 0, remaining: 0, batchLimit: 20 });
    expect(context.objectRows_(searchSheet)).toHaveLength(current.chunks.length);
    expect(context.objectRows_(searchSheet)[0].index_token).toBe(current.artifacts.token);
  });

  it('reuses the preloaded canonical Work after a locked row check and writes through the known index row', () => {
    const { context, privateSheet } = writableBridge();
    const rowById = vi.fn(context.rowById_);
    const rowAtNumber = vi.fn(context.rowAtSheetNumber_);
    const setIndex = vi.fn(context.setPrivateIndexRow_);
    context.rowById_ = rowById;
    context.rowAtSheetNumber_ = rowAtNumber;
    context.setPrivateIndexRow_ = setIndex;

    const result = context.saveCxlWorkApi_('update', { id: 'write-work', updates: { title: 'Updated title' } }, {
      requestId: '123e4567-e89b-42d3-a456-426614174000', expectedRevision: 1
    }, 'owner-1');

    expect(result.data).toMatchObject({ id: 'write-work', title: 'Updated title', revision: 2 });
    expect(context.parse_).toHaveBeenCalledOnce();
    expect(rowById).toHaveBeenCalledOnce();
    expect(rowAtNumber).toHaveBeenCalledOnce();
    expect(setIndex).toHaveBeenCalledWith(privateSheet, expect.objectContaining({ id: 'write-work' }), 2, expect.objectContaining({ id: 'write-work', revision: 1, file_id: 'file-1' }));
    expect(context.putJsonRevision_).toHaveBeenCalledOnce();
  });

  it('finds the Work again under the lock if its preloaded row number moved', () => {
    const { context, privateSheet, setOnLock } = writableBridge();
    setOnLock(() => {
      const headers = privateSheet.rows[0] as string[];
      privateSheet.rows.splice(1, 0, headers.map(header => header === 'id' ? 'unrelated-work' : ''));
    });
    const result = context.saveCxlWorkApi_('update', { id: 'write-work', updates: { title: 'Moved row update' } }, {
      requestId: '123e4567-e89b-42d3-a456-426614174000', expectedRevision: 1
    }, 'owner-1');
    expect(result.data).toMatchObject({ title: 'Moved row update', revision: 2 });
    expect(context.rowById_(privateSheet, 'write-work')).toMatchObject({ _sheetRow: 3, revision: 2 });
    expect(context.parse_).toHaveBeenCalledOnce();
  });

  it('does not recreate a Work removed between preload and the locked check', () => {
    const { context, privateSheet, setOnLock } = writableBridge();
    setOnLock(() => { privateSheet.rows.splice(1, 1); });
    expect(() => context.saveCxlWorkApi_('update', { id: 'write-work', updates: { title: 'Must not recreate' } }, {
      requestId: '123e4567-e89b-42d3-a456-426614174000', expectedRevision: 1
    }, 'owner-1')).toThrow(expect.objectContaining({ apiCode: 'REVISION_CONFLICT' }));
    expect(context.putJsonRevision_).not.toHaveBeenCalled();
  });

  it('rejects a Work whose canonical Owner changes while waiting for the lock', () => {
    const { context, privateSheet, files, setOnLock } = writableBridge();
    setOnLock(() => {
      const index = context.rowById_(privateSheet, 'write-work');
      const columns = privateSheet.rows[0] as string[];
      privateSheet.rows[index._sheetRow - 1][columns.indexOf('file_id')] = 'other-owner-file';
      const changed = structuredClone(files.get('file-1'));
      changed.row.user_id = 'different-owner';
      files.set('other-owner-file', changed);
    });
    expect(() => context.saveCxlWorkApi_('update', { id: 'write-work', updates: { title: 'Must not save' } }, {
      requestId: '123e4567-e89b-42d3-a456-426614174000', expectedRevision: 1
    }, 'owner-1')).toThrow(expect.objectContaining({ apiCode: 'WORK_NOT_OWNED' }));
    expect(context.putJsonRevision_).not.toHaveBeenCalled();
  });

  it.each([
    ['revision changes', 2],
    ['file changes without a revision increment', 1]
  ])('rejects a concurrent update when the locked %s', (_label, nextRevision) => {
    const { context, privateSheet, files, setOnLock } = writableBridge();
    setOnLock(() => {
      const index = context.rowById_(privateSheet, 'write-work');
      const columns = privateSheet.rows[0] as string[];
      const row = privateSheet.rows[index._sheetRow - 1];
      row[columns.indexOf('revision')] = nextRevision;
      row[columns.indexOf('file_id')] = 'concurrent-file';
      const concurrent = structuredClone(files.get('file-1'));
      concurrent.revision = nextRevision;
      concurrent.row.title = 'Concurrent update';
      files.set('concurrent-file', concurrent);
    });

    expect(() => context.saveCxlWorkApi_('update', { id: 'write-work', updates: { title: 'My update' } }, {
      requestId: '123e4567-e89b-42d3-a456-426614174000', expectedRevision: 1
    }, 'owner-1')).toThrow(expect.objectContaining({ apiCode: 'REVISION_CONFLICT' }));
    expect(context.parse_).toHaveBeenCalledTimes(2);
    expect(context.putJsonRevision_).not.toHaveBeenCalled();
    expect(context.rowById_(privateSheet, 'write-work').file_id).toBe('concurrent-file');
  });

  it('recognizes the same request completed while waiting for the lock without writing twice', () => {
    const { context, privateSheet, files, setOnLock } = writableBridge();
    const requestId = '123e4567-e89b-42d3-a456-426614174000';
    setOnLock(() => {
      const index = context.rowById_(privateSheet, 'write-work');
      const columns = privateSheet.rows[0] as string[];
      const row = privateSheet.rows[index._sheetRow - 1];
      row[columns.indexOf('revision')] = 2;
      row[columns.indexOf('file_id')] = 'completed-file';
      const completed = structuredClone(files.get('file-1'));
      completed.revision = 2;
      completed.row.title = 'Updated title';
      completed.lastWriteRequestId = requestId;
      completed.lastWriteFingerprint = 'matching-fingerprint';
      completed.cxlAsset.title = 'Updated title';
      files.set('completed-file', completed);
    });

    const result = context.saveCxlWorkApi_('update', { id: 'write-work', updates: { title: 'Updated title' } }, {
      requestId, expectedRevision: 1
    }, 'owner-1');
    expect(result.data).toMatchObject({ id: 'write-work', title: 'Updated title', revision: 2 });
    expect(context.parse_).toHaveBeenCalledTimes(2);
    expect(context.putJsonRevision_).not.toHaveBeenCalled();
  });
});
