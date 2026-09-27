import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(join(process.cwd(), 'apps-script', 'api-only-owner', 'Code.gs'), 'utf8');

function bridge() {
  const context: Record<string, any> = {};
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

function indexRow(work: ReturnType<typeof asset>, searchText: string, overrides: Record<string, unknown> = {}) {
  return {
    id: work.id, title: work.title, category: work.category, status: work.status, visibility: work.visibility,
    isPublic: work.isPublic, deletedAt: work.deletedAt, folderId: work.folderId, tags: work.tags,
    createdAt: work.createdAt, updatedAt: work.updatedAt, userId: work.userId, revision: 3,
    summaryVersion: 1, summaryJson: JSON.stringify({ summaryVersion: 1, asset: work }), searchText, ...overrides
  };
}

describe('API-only Owner Private summary index', () => {
  it('serves summary/list from Private Index only and never returns search_text', () => {
    const context = bridge();
    const summary = asset('one');
    context.listOwnerIndex_ = () => [indexRow(summary, 'work title hidden body')];
    context.getOwnerWork_ = vi.fn(() => { throw new Error('list must not read Drive'); });

    const result = context.fetchCxlWorks_({ userId: 'owner-1', detail: 'summary' });
    expect(result.data.map((item: any) => item.id)).toEqual(['one']);
    expect(context.getOwnerWork_).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('search_text');
    expect(JSON.stringify(result)).not.toContain('hidden body');
  });

  it('matches full-content search text from every legacy search field, case-insensitively', () => {
    const context = bridge();
    const searchable = asset('one', {
      title: 'TitleNeedle', shortDescription: 'DescriptionNeedle', content: 'ContentNeedle',
      contentBlocks: [{ id: 'b', type: 'Text', title: 'BlockTitleNeedle', body: 'BlockBodyNeedle' }],
      authorName: 'AuthorNeedle', tags: ['TagNeedle'], uiCodeSnippet: 'CodeNeedle'
    });
    const searchText = context.ownerSearchText_(searchable);
    const row = indexRow(searchable, searchText);
    context.listOwnerIndex_ = () => [row];

    for (const query of ['titleneedle', 'DESCRIPTIONneedle', 'contentneedle', 'blocktitleneedle', 'blockbodyneedle', 'authorneedle', 'tagneedle', 'codeneedle']) {
      expect(context.fetchCxlWorks_({ userId: 'owner-1', search: query }).data.map((item: any) => item.id), query).toEqual(['one']);
    }
  });

  it('reads canonical Drive JSON exactly once for a single Work detail and rejects full-list detail', () => {
    const context = bridge();
    const work = asset('one');
    context.getOwnerWork_ = vi.fn(() => ({ cxlAsset: work, revision: 3, mediaRecords: [] }));
    expect(context.fetchCxlWorks_({ assetId: 'one', detail: 'full' }).data[0].id).toBe('one');
    expect(context.getOwnerWork_).toHaveBeenCalledTimes(1);
    expect(() => context.fetchCxlWorks_({ detail: 'full' })).toThrow(/Full Work reads require one assetId/);
    expect(context.getOwnerWork_).toHaveBeenCalledTimes(1);
  });

  it('fails the list closed until every Private Index row has the supported summary version', () => {
    const context = bridge();
    context.listOwnerIndex_ = () => [indexRow(asset('ready'), 'ready'), indexRow(asset('stale'), 'stale', { summaryVersion: 0 })];
    context.getOwnerWork_ = vi.fn();
    expect(() => context.fetchCxlWorks_({ userId: 'owner-1' })).toThrow(/summary index is incomplete/);
    expect(context.getOwnerWork_).not.toHaveBeenCalled();
  });

  it('preserves owner, public, folder, deleted, category, ordering, and limit filters', () => {
    const context = bridge();
    context.listOwnerIndex_ = () => [
      indexRow(asset('older', { createdAt: '2025-01-01', category: 'lore', folderId: 'folder-1' }), 'older'),
      indexRow(asset('newer', { createdAt: '2026-02-01', category: 'lore', folderId: 'folder-1', isPublic: true, visibility: 'public' }), 'newer'),
      indexRow(asset('deleted', { createdAt: '2026-03-01', deletedAt: '2026-03-02', category: 'lore', folderId: 'folder-1' }), 'deleted'),
      indexRow(asset('other-folder', { category: 'lore', folderId: 'folder-2' }), 'other-folder'),
      indexRow(asset('other-owner', { userId: 'elsewhere', category: 'lore', folderId: 'folder-1' }), 'other-owner'),
      indexRow(asset('other-category', { category: 'prompts', folderId: 'folder-1' }), 'other-category')
    ];
    const result = context.fetchCxlWorks_({ userId: 'owner-1', currentUserId: 'owner-1', category: 'lore', folderId: 'folder-1', includeDeleted: false, limit: 1 });
    expect(result.data.map((item: any) => item.id)).toEqual(['newer']);
    expect(context.fetchCxlWorks_({ userId: 'owner-1', publicOnly: true }).data.map((item: any) => item.id)).toEqual(['newer']);
    expect(context.fetchCxlWorks_({ userId: 'owner-1', onlyDeleted: true, currentUserId: 'owner-1' }).data.map((item: any) => item.id)).toEqual(['deleted']);
  });

  it('refreshes versioned summary and private search index on every create/update metadata build', () => {
    const context = bridge();
    const longContent = `${'x'.repeat(1600)} Updated hidden content`;
    const work = asset('one', { title: 'Updated Title', content: longContent, uiCodeSnippet: 'Updated code' });
    const record = { row: { id: 'one', user_id: 'owner-1', created_at: work.createdAt, title: work.title, tags: [] }, cxlAsset: work, revision: 4, mediaRecords: [] };
    const metadata = context.privateMeta_(record, 'private-file-id');
    const envelope = JSON.parse(metadata.summary_json);
    expect(metadata.summary_version).toBe(1);
    expect(envelope.summaryVersion).toBe(1);
    expect(envelope.asset.title).toBe('Updated Title');
    expect(metadata.search_text).toContain('updated hidden content');
    expect(metadata.search_text).toContain('updated code');
    expect(envelope.asset.content).toHaveLength(600);
    expect(envelope.asset.content).not.toContain('Updated hidden content');
    expect(envelope).not.toHaveProperty('search_text');
    const changed = context.privateMeta_({ ...record, cxlAsset: { ...work, content: 'next revision content' }, revision: 5 }, 'private-file-id-2');
    expect(changed.summary_version).toBe(1);
    expect(JSON.parse(changed.summary_json).asset.content).toBe('next revision content');
    expect(changed.search_text).toContain('next revision content');
  });

  it('backfills at most 20 stale rows and is safe to rerun without rereading or rewriting ready rows', () => {
    const context = bridge();
    const rows: Record<string, any>[] = Array.from({ length: 21 }, (_, index) => ({ _sheetRow: index + 2, id: `w${index}`, file_id: `file-${index}`, summary_version: 0 }));
    const headers = [...context.PRIVATE_HEADERS];
    const sheet = {
      getLastColumn: () => headers.length,
      getRange: (row: number, _column: number, _height: number, _width: number) => ({
        setValues: (values: unknown[][]) => {
          const target = rows.find(item => item._sheetRow === row)!;
          headers.forEach((key, index) => { target[key] = values[0][index]; });
        }
      })
    };
    let reads = 0;
    context.config_ = () => ({ privateSheetId: 'private-sheet' });
    context.sheet_ = () => sheet;
    context.ensurePrivateHeaders_ = () => undefined;
    context.objectRows_ = () => rows;
    context.parse_ = () => { reads++; return { row: { id: `w${reads}`, user_id: 'owner', title: `Title ${reads}`, created_at: '2026-01-01' }, cxlAsset: asset(`w${reads}`), revision: 1, mediaRecords: [] }; };
    context.privateMeta_ = (record: any) => ({ id: record.row.id, summary_json: JSON.stringify({ summaryVersion: 1, asset: asset(record.row.id) }), summary_version: 1, search_text: 'indexed text' });

    const first = context.backfillOwnerSummaryIndex_();
    expect(first).toMatchObject({ processed: 20, remaining: 1, ready: false, batchLimit: 20 });
    expect(reads).toBe(20);
    const second = context.backfillOwnerSummaryIndex_();
    expect(second).toMatchObject({ processed: 1, remaining: 0, ready: true });
    expect(reads).toBe(21);
    const third = context.backfillOwnerSummaryIndex_();
    expect(third).toMatchObject({ processed: 0, remaining: 0, ready: true });
    expect(reads).toBe(21);
  });
});
