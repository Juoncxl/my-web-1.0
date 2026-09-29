import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const kitDir = join(process.cwd(), 'apps-script', 'api-only-owner');
const source = readFileSync(join(kitDir, 'Code.gs'), 'utf8');

function makeBridge(secret = 'test-only-shared-secret', ownerId = 'test-owner') {
  const cacheValues = new Map<string, string>();
  const scriptCache = {
    get: (key: string) => cacheValues.get(key) || null,
    put: (key: string, value: string) => { cacheValues.set(key, String(value)); },
    remove: (key: string) => { cacheValues.delete(key); }
  };
  const context: Record<string, any> = {
    CacheService: { getScriptCache: () => scriptCache },
    Utilities: { getUuid: () => 'cache-test-uuid' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key: string) => ({
      CXL_API_SHARED_SECRET: secret,
      CXL_OWNER_USER_ID: ownerId
    }[key]) }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text: string) => ({ text, setMimeType: () => ({ text }) })
    }
  };
  runInNewContext(source, context);
  return context;
}

function post(context: Record<string, any>, body: unknown) {
  const response = context.doPost({ postData: { contents: JSON.stringify(body) } });
  return JSON.parse(response.text);
}

describe('API-only Owner GAS package isolation', () => {
  it('contains no Owner UI, admin/import/export/upload entrypoints, or google.script.run-callable helpers', () => {
    expect(source).not.toMatch(/HtmlService|Index\.html|setupWorkspace|workspaceInfo|importNextBatch|backfillCoverRefs|startExport|exportNextBatch|uploadOwnerMedia|uploadCxlMedia/);
    expect(JSON.parse(readFileSync(join(kitDir, 'appsscript.json'), 'utf8'))).toMatchObject({ runtimeVersion: 'V8' });
    const entries = [...source.matchAll(/^function\s+([\w$]+)\s*\(/gm)].map(match => match[1]);
    expect(entries.filter(name => !['doGet', 'doPost'].includes(name)).every(name => name.endsWith('_'))).toBe(true);
    expect(source).toContain("function doGet() {\n  return apiJson_({ok:false,error:'Method not allowed'");
    expect(existsSync(join(kitDir, 'Index.html'))).toBe(false);
  });

  it('fails malformed JSON closed', () => {
    const context = makeBridge();
    const response = context.doPost({ postData: { contents: '{bad json' } });
    expect(JSON.parse(response.text)).toMatchObject({ ok: false, code: 'INVALID_JSON', httpStatus: 400 });
  });

  it('answers GET with harmless JSON and never serves Owner content', () => {
    const response = makeBridge().doGet();
    expect(JSON.parse(response.text)).toMatchObject({ ok: false, code: 'METHOD_NOT_ALLOWED', httpStatus: 405 });
  });

  it.each([
    ['missing secret', undefined],
    ['wrong secret', 'wrong-secret']
  ])('rejects %s before dispatch', (_label, supplied) => {
    const context = makeBridge();
    const fetchSpy = vi.fn();
    context.fetchCxlWorks_ = fetchSpy;
    const response = post(context, { authorization: supplied, ownerUserId: 'test-owner', action: 'works.fetch', args: [{}] });
    expect(response).toMatchObject({ ok: false, code: 'OWNER_API_UNAUTHORIZED', httpStatus: 401 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects unknown actions after authentication without dispatching another operation', () => {
    const context = makeBridge();
    const fetchSpy = vi.fn();
    context.fetchCxlWorks_ = fetchSpy;
    const response = post(context, { authorization: 'test-only-shared-secret', ownerUserId: 'test-owner', action: 'setupWorkspace', args: [] });
    expect(response).toMatchObject({ ok: false, code: 'UNSUPPORTED_ACTION', httpStatus: 400 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a caller-supplied Owner identity that differs from Script Properties', () => {
    const context = makeBridge();
    const fetchSpy = vi.fn();
    context.fetchCxlWorks_ = fetchSpy;
    const response = post(context, { authorization: 'test-only-shared-secret', ownerUserId: 'forged-owner', action: 'works.fetch', args: [{}] });
    expect(response).toMatchObject({ ok: false, code: 'OWNER_API_UNAUTHORIZED', httpStatus: 401 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns timing metadata only after Owner authentication and includes no request identifiers or credentials', () => {
    const context = makeBridge();
    context.fetchCxlWorks_ = () => {
      context.ownerTimingPhase_('owner_index_read', 12);
      return { data: [{ id: 'work-id-must-not-enter-timing' }], error: null };
    };
    const response = post(context, { authorization: 'test-only-shared-secret', ownerUserId: 'test-owner', action: 'works.fetch', args: [{}], includeTiming: true });
    const timing = response.meta.timing;
    expect(Object.keys(timing).sort()).toEqual(['action', 'phases', 'totalMs']);
    expect(timing.action).toBe('works.fetch');
    expect(timing.phases).toMatchObject({ auth_request_validation: expect.any(Number), owner_index_read: 12, response_construction: expect.any(Number) });
    expect(Object.keys(timing.phases).every((phase: string) => context.OWNER_TIMING_PHASES_.includes(phase))).toBe(true);
    expect(Object.values(timing.phases).every((duration: any) => typeof duration === 'number' && duration >= 0)).toBe(true);
    expect(JSON.stringify(timing)).not.toMatch(/work-id-must-not-enter-timing|test-owner|test-only-shared-secret|authorization|cookie|url/i);
  });

  it('does not return timing metadata without Preview server opt-in or before authentication', () => {
    const context = makeBridge();
    context.fetchCxlWorks_ = () => ({ data: [], error: null });
    const ordinary = post(context, { authorization: 'test-only-shared-secret', ownerUserId: 'test-owner', action: 'works.fetch', args: [{}] });
    const unauthorized = post(context, { authorization: 'wrong', ownerUserId: 'test-owner', action: 'works.fetch', args: [{}], includeTiming: true });
    expect(ordinary).not.toHaveProperty('meta');
    expect(unauthorized).not.toHaveProperty('meta');
  });

  it('covers the agreed Owner write/read timing phases in source', () => {
    const requiredPhases = [
      'auth_request_validation', 'existing_work_index_lookup', 'canonical_drive_json_read',
      'revision_idempotency_validation', 'write_payload_prepare', 'search_artifact_generation',
      'search_chunk_write', 'stale_search_cleanup', 'drive_revision_write', 'private_index_update',
      'private_public_transition', 'public_projection_sync', 'response_construction',
      'owner_index_read', 'owner_search_index_read', 'summary_parse_projection',
      'folders_drive_read', 'folders_projection'
    ];
    expect(requiredPhases.every(phase => source.includes(`ownerTimingPhase_('${phase}'`))).toBe(true);
    expect(source).toContain('timing.totalMs=Date.now()-API_TIMING_CONTEXT_.startedAt');
  });

  it.each([
    ['works.fetch', [{}], 'fetchCxlWorks_'],
    ['folders.fetch', [], 'cxlOwnerFolders_'],
    ['works.create', [{ title: 'New' }, { requestId: 'request' }], 'saveCxlWorkApi_'],
    ['works.update', ['work-id', { title: 'Update' }, { requestId: 'request', expectedRevision: 1 }], 'saveCxlWorkApi_'],
    ['media.upload.begin', [{ mediaId: '123e4567-e89b-42d3-a456-426614174000' }], 'mediaWorkUploadDispatch_'],
    ['media.upload.chunk', [{ uploadId: '123e4567-e89b-42d3-a456-426614174001' }], 'mediaWorkUploadDispatch_'],
    ['media.upload.finalize', [{ uploadId: '123e4567-e89b-42d3-a456-426614174001' }], 'mediaWorkUploadDispatch_'],
    ['media.cleanup', [], 'mediaWorkCleanupDispatch_']
  ])('dispatches allowlisted %s only after shared-secret validation', (action, args, helper) => {
    const context = makeBridge();
    const spy = vi.fn().mockReturnValue({ data: 'ok' });
    context[helper] = spy;
    const response = post(context, { authorization: 'test-only-shared-secret', ownerUserId: 'test-owner', action, args });
    expect(response.ok).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('keeps GO 7 media and GO 8 private collaboration mutation guards in the Owner write contract', () => {
    const context = makeBridge();
    expect(() => context.validateCxlWritePayload_({ collaboration: { name: 'Private draft' } }, 'update'))
      .toThrow(expect.objectContaining({ apiCode: 'UNSUPPORTED_COLLAB_DRAFT' }));
    expect(() => context.rejectUnsupportedWorkMedia_({ previewImage: 'data:image/png;base64,AA==' }, null))
      .toThrow(expect.objectContaining({ apiCode: 'UNSUPPORTED_MEDIA_MUTATION' }));
    expect(() => context.rejectUnsupportedWorkMedia_({ category: 'collab' }, null, ['123e4567-e89b-42d3-a456-426614174000']))
      .toThrow(expect.objectContaining({ apiCode: 'UNSUPPORTED_COLLAB_DRAFT' }));
  });

  it('reuses the canonical post-write record instead of rereading it for the response', () => {
    const context = makeBridge();
    const currentRecord = {
      revision: 3,
      row: { id: 'asset_work', user_id: 'test-owner', visibility: 'private', is_public: false, deleted_at: '', folder_id: '' },
      cxlAsset: { id: 'asset_work', userId: 'test-owner', title: 'Before', visibility: 'private', isPublic: false, folderId: null }
    };
    const savedRecord = {
      ...currentRecord,
      revision: 4,
      row: { ...currentRecord.row, title: 'After' },
      cxlAsset: { ...currentRecord.cxlAsset, title: 'After' }
    };
    const getOwnerWork = vi.fn(() => savedRecord);
    const responseRecord = vi.fn(record => record);
    context.config_ = () => ({ privateSheetId: 'private-index' });
    context.sheet_ = () => ({ sheet: 'private-index' });
    context.rowById_ = () => ({ id: 'asset_work', file_id: 'current-file' });
    context.parse_ = () => currentRecord;
    context.writeFingerprint_ = () => 'fingerprint';
    context.saveOwnerWork_ = () => ({ id: 'asset_work', revision: 4, updatedAt: '2026-09-27T00:00:00.000Z', record: savedRecord });
    context.getOwnerWork_ = getOwnerWork;
    context.finishCxlPublicProjection_ = vi.fn();
    context.cxlWriteResult_ = responseRecord;

    const result = context.saveCxlWorkApi_('update', { id: 'asset_work', updates: { title: 'After' } }, {
      requestId: '123e4567-e89b-42d3-a456-426614174000', expectedRevision: 3
    }, 'test-owner');

    expect(getOwnerWork).not.toHaveBeenCalled();
    expect(responseRecord).toHaveBeenCalledWith(savedRecord);
    expect(result).toBe(savedRecord);
  });

  it('answers an idempotent update retry from its already loaded canonical record', () => {
    const context = makeBridge();
    const record = {
      revision: 4, lastWriteRequestId: '123e4567-e89b-42d3-a456-426614174000', lastWriteFingerprint: 'fingerprint',
      row: { id: 'asset_work', visibility: 'private', is_public: false, deleted_at: '' },
      cxlAsset: { id: 'asset_work', title: 'After', visibility: 'private', isPublic: false }
    };
    const getOwnerWork = vi.fn();
    const responseRecord = vi.fn(value => value);
    context.config_ = () => ({ privateSheetId: 'private-index' });
    context.sheet_ = () => ({ sheet: 'private-index' });
    context.rowById_ = () => ({ id: 'asset_work', file_id: 'current-file' });
    context.parse_ = () => record;
    context.writeFingerprint_ = () => 'fingerprint';
    context.getOwnerWork_ = getOwnerWork;
    context.finishCxlPublicProjection_ = vi.fn();
    context.cxlWriteResult_ = responseRecord;

    const result = context.saveCxlWorkApi_('update', { id: 'asset_work', updates: { title: 'After' } }, {
      requestId: '123e4567-e89b-42d3-a456-426614174000', expectedRevision: 3
    }, 'test-owner');

    expect(getOwnerWork).not.toHaveBeenCalled();
    expect(responseRecord).toHaveBeenCalledWith(record);
    expect(result).toBe(record);
  });
});
