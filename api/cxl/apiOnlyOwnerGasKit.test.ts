import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const kitDir = join(process.cwd(), 'apps-script', 'api-only-owner');
const source = readFileSync(join(kitDir, 'Code.gs'), 'utf8');

function makeBridge(secret = 'test-only-shared-secret', ownerId = 'test-owner') {
  const context: Record<string, any> = {
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

  it.each([
    ['works.fetch', [{}], 'fetchCxlWorks_'],
    ['folders.fetch', [], 'cxlOwnerFolders_'],
    ['works.create', [{ title: 'New' }, { requestId: 'request' }], 'saveCxlWorkApi_'],
    ['works.update', ['work-id', { title: 'Update' }, { requestId: 'request', expectedRevision: 1 }], 'saveCxlWorkApi_']
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
  });
});
