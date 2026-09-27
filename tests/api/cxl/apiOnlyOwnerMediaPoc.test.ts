import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(join(process.cwd(), 'apps-script', 'api-only-owner', 'Code.gs'), 'utf8');
const CHUNK_BYTES = 2 * 1024 * 1024;
const SECRET = 'test-only-shared-secret';
const OWNER_ID = 'test-owner';

class MemoryBlob {
  private readonly bytes: Buffer;
  constructor(value: number[] | Buffer, private readonly mimeType = 'application/octet-stream', private readonly name = '') {
    this.bytes = Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from(value.map(byte => byte & 0xff));
  }
  getBytes() { return [...this.bytes].map(byte => byte > 127 ? byte - 256 : byte); }
  getContentType() { return this.mimeType; }
  getName() { return this.name; }
  getSize() { return this.bytes.length; }
}

class MemoryFile {
  trashed = false;
  sharing = 'PRIVATE';
  constructor(readonly id: string, readonly name: string, readonly blob: MemoryBlob) {}
  getId() { return this.id; }
  getName() { return this.name; }
  getBlob() { return this.blob; }
  getSize() { return this.blob.getSize(); }
  getMimeType() { return this.blob.getContentType(); }
  getSharingAccess() { return this.sharing; }
  setSharing(access: string) { this.sharing = access; return this; }
  setTrashed(value: boolean) { this.trashed = value; return this; }
}

class MemoryFolder {
  readonly files: MemoryFile[] = [];
  sharing = 'PRIVATE';
  constructor(readonly id: string) {}
  getId() { return this.id; }
  getSharingAccess() { return this.sharing; }
  createFile(blob: MemoryBlob) {
    const file = new MemoryFile(`drive-private-${randomUUID()}`, blob.getName(), blob);
    this.files.push(file);
    return file;
  }
  getFilesByName(name: string) { return iterator(this.files.filter(file => !file.trashed && file.name === name)); }
  getFiles() { return iterator(this.files.filter(file => !file.trashed)); }
}

function iterator<T>(items: T[]) {
  let index = 0;
  return { hasNext: () => index < items.length, next: () => items[index++] };
}

function digest(bytes: number[] | Buffer) {
  const raw = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes.map(byte => byte & 0xff));
  return createHash('sha256').update(raw).digest('hex');
}

function makeBridge(secret = SECRET) {
  const properties: Record<string, string> = {
    CXL_API_SHARED_SECRET: SECRET,
    CXL_OWNER_USER_ID: OWNER_ID,
    CXL_MEDIA_FOLDER_ID: 'isolated-canonical-folder',
    CXL_MEDIA_STAGING_FOLDER_ID: 'isolated-staging-folder'
  };
  const canonical = new MemoryFolder(properties.CXL_MEDIA_FOLDER_ID);
  const staging = new MemoryFolder(properties.CXL_MEDIA_STAGING_FOLDER_ID);
  const folders: Record<string, MemoryFolder> = { [canonical.id]: canonical, [staging.id]: staging };
  const driveRangeCalls: Array<{ url: string; options: Record<string, any> }> = [];
  let driveFetchOverride: ((url: string, options: Record<string, any>) => any) | undefined;
  const context: Record<string, any> = {
    __properties: properties,
    __canonical: canonical,
    __staging: staging,
    __driveRangeCalls: driveRangeCalls,
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (key: string) => properties[key] || null,
      setProperty: (key: string, value: string) => { properties[key] = value; return this; },
      deleteProperty: (key: string) => { delete properties[key]; return this; },
      getProperties: () => ({ ...properties })
    }) },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: (text: string) => ({ text, setMimeType() { return this; } }) },
    DriveApp: {
      Access: { PRIVATE: 'PRIVATE', ANYONE_WITH_LINK: 'ANYONE_WITH_LINK' },
      Permission: { VIEW: 'VIEW' },
      getFolderById: (id: string) => { if (!folders[id]) throw new Error('missing folder'); return folders[id]; },
      getFileById: (id: string) => [...canonical.files, ...staging.files].find(file => file.id === id && !file.trashed) || null
    },
    ScriptApp: { getOAuthToken: () => 'test-only-google-oauth-token' },
    UrlFetchApp: { fetch: (url: string, options: Record<string, any>) => {
      driveRangeCalls.push({ url, options });
      if (driveFetchOverride) return driveFetchOverride(url, options);
      const fileId = decodeURIComponent(new URL(url).pathname.split('/').at(-1) || '');
      const file = [...canonical.files, ...staging.files].find(item => item.id === fileId && !item.trashed);
      if (!file) return { getResponseCode: () => 404, getContent: () => [] };
      const range = String(options.headers?.Range || '').match(/^bytes=(\d+)-(\d+)$/);
      if (!range) return { getResponseCode: () => 400, getContent: () => [] };
      const all = Buffer.from(file.blob.getBytes().map(byte => byte & 0xff));
      const chunk = all.subarray(Number(range[1]), Number(range[2]) + 1);
      return { getResponseCode: () => 206, getContent: () => [...chunk].map(byte => byte > 127 ? byte - 256 : byte) };
    } },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA-256' },
      base64Decode: (value: string) => [...Buffer.from(value, 'base64')].map(byte => byte > 127 ? byte - 256 : byte),
      base64Encode: (value: number[]) => Buffer.from(value.map(byte => byte & 0xff)).toString('base64'),
      computeDigest: (_algorithm: string, value: number[]) => [...createHash('sha256').update(Buffer.from(value.map(byte => byte & 0xff))).digest()].map(byte => byte > 127 ? byte - 256 : byte),
      newBlob: (bytes: number[] | Buffer, mimeType?: string, name?: string) => new MemoryBlob(bytes, mimeType, name),
      getUuid: () => randomUUID()
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    console: { log: vi.fn(), info: vi.fn(), warn: vi.fn() }
  };
  runInNewContext(source, context);
  context.__setDriveFetch = (override: typeof driveFetchOverride) => { driveFetchOverride = override; };
  context.__wrongSecret = secret;
  return context;
}

function post(context: Record<string, any>, action: string, args: unknown[], authorization = SECRET, ownerUserId = OWNER_ID) {
  const result = context.doPost({ postData: { contents: JSON.stringify({ authorization, ownerUserId, action, args }) } });
  return JSON.parse(result.text);
}

function png(size: number) {
  const bytes = Buffer.alloc(size);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
  return bytes;
}

function liveTestPng68() {
  return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/7b8AAAAASUVORK5CYII=', 'base64');
}

function seedReadMedia(context: Record<string, any>, bytes: Buffer) {
  const ids = { mediaId: randomUUID(), workNonce: randomUUID() };
  const file = context.__canonical.createFile(new MemoryBlob(bytes, 'image/png', 'isolated-read-test.png'));
  context.__properties[`CXL_MEDIA_POC_MEDIA_${ids.mediaId}`] = JSON.stringify({
    workNonce: ids.workNonce,
    workId: `asset_media_poc_${ids.workNonce}`,
    mediaId: ids.mediaId,
    fileId: file.id,
    mimeType: 'image/png',
    totalFileSize: bytes.length,
    sha256: digest(bytes),
    active: true,
    isPublic: false,
    ownerUserId: OWNER_ID
  });
  return { ids, file, readArgs: (chunkIndex: number) => ({
    mediaId: ids.mediaId, workNonce: ids.workNonce, ref: `media:${ids.mediaId}`, chunkIndex
  }) };
}

function parsedReadLogs(context: Record<string, any>) {
  return [...context.console.log.mock.calls, ...context.console.warn.mock.calls].map(([line]: [string]) => JSON.parse(line));
}

function persistedReadDiagnostic(context: Record<string, any>) {
  return JSON.parse(context.__properties.CXL_MEDIA_POC_LAST_READ_DIAGNOSTIC || 'null');
}

function begin(context: Record<string, any>, bytes: Buffer, extras: Record<string, unknown> = {}) {
  const ids = { uploadId: randomUUID(), mediaId: randomUUID(), workNonce: randomUUID() };
  const response = post(context, 'media.poc.begin', [{ ...ids, totalFileSize: bytes.length, rawChunkSize: CHUNK_BYTES,
    totalChunks: Math.ceil(bytes.length / CHUNK_BYTES), mimeType: 'image/png', sha256: digest(bytes), ...extras }]);
  return { ids, response };
}

describe('API-only Owner isolated Media POC', () => {
  it('keeps the API-only surface and new folder configuration isolated from Owner UI and real media actions', () => {
    expect(source).not.toMatch(/HtmlService|Index\.html|setupWorkspace|startExport|exportNextBatch|uploadOwnerMedia/);
    expect(source).toContain("'media.poc.publicChunk'");
    expect(source).toContain("'CXL_MEDIA_FOLDER_ID'");
    expect(source).toContain("'CXL_MEDIA_STAGING_FOLDER_ID'");
    expect(source).toContain("'media.poc.cleanup'");
    expect(source).toContain('Range:\'bytes=\'+start+\'-\'+end');
    expect(source).toContain('ScriptApp.getOAuthToken()');
  });

  it.each([['missing', ''], ['wrong', 'not-the-secret']])('rejects %s shared secret before a POC action', (_label, secret) => {
    const context = makeBridge();
    const response = post(context, 'media.poc.cleanup', [], secret);
    expect(response).toMatchObject({ ok: false, code: 'OWNER_API_UNAUTHORIZED', httpStatus: 401 });
    expect(context.__staging.files).toHaveLength(0);
  });

  it('rejects arbitrary/unknown media actions even after authentication', () => {
    const response = post(makeBridge(), 'media.upload', [{}] as any);
    expect(response).toMatchObject({ ok: false, code: 'UNSUPPORTED_ACTION' });
  });

  it('accepts only the four supported image signatures and derives the extension from the validated MIME', () => {
    const context = makeBridge();
    const signatures: Array<[string, number[]]> = [
      ['image/jpeg', [0xff, 0xd8, 0xff, 0x00]],
      ['image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
      ['image/webp', [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]],
      ['image/gif', [...Buffer.from('GIF89a')]]
    ];
    for (const [mime, signature] of signatures) {
      expect(context.mediaPocExpectedMime_(signature)).toBe(mime);
      const bytes = Buffer.from(signature);
      const { ids } = begin(context, bytes, { mimeType: mime });
      expect(post(context, 'media.poc.chunk', [{ uploadId: ids.uploadId, chunkIndex: 0, base64: bytes.toString('base64'), sha256: digest(bytes) }]).ok).toBe(true);
      expect(post(context, 'media.poc.finalize', [{ uploadId: ids.uploadId }]).ok).toBe(true);
      expect(context.__canonical.files.filter((file: MemoryFile) => !file.trashed).at(-1).name).toMatch(new RegExp(`\\.${mime.split('/')[1] === 'jpeg' ? 'jpg' : mime.split('/')[1]}$`));
    }
  });

  it('uploads five 2 MiB chunks out of order, allows byte-identical retry, rejects conflicting retry, then finalizes privately', () => {
    const context = makeBridge();
    const bytes = png(10 * 1024 * 1024);
    const { ids, response: start } = begin(context, bytes);
    expect(start).toMatchObject({ ok: true, data: { workId: `asset_media_poc_${ids.workNonce}`, mediaId: ids.mediaId, state: 'private', size: bytes.length } });
    expect(JSON.stringify(start)).not.toMatch(/drive-private-|drive.google|script.google|secret/i);
    const storedSession = JSON.parse(context.__properties[`CXL_MEDIA_POC_SESSION_${ids.uploadId}`]);
    expect(post(context, 'media.poc.begin', [storedSession])).toMatchObject({ ok: true, data: { uploadId: ids.uploadId } });
    expect(post(context, 'media.poc.begin', [{ ...storedSession, sha256: 'a'.repeat(64) }]).code).toBe('MEDIA_POC_IDEMPOTENCY_CONFLICT');
    const order = [4, 2, 0, 3, 1];
    for (const chunkIndex of order) {
      const chunk = bytes.subarray(chunkIndex * CHUNK_BYTES, Math.min((chunkIndex + 1) * CHUNK_BYTES, bytes.length));
      const base64 = chunk.toString('base64');
      const chunkHash = digest(chunk);
      const result = post(context, 'media.poc.chunk', [{ uploadId: ids.uploadId, chunkIndex, base64, sha256: chunkHash }]);
      expect(result).toMatchObject({ ok: true, data: { chunkIndex, stored: true, idempotent: false } });
      if (chunkIndex === 2) {
        const retry = post(context, 'media.poc.chunk', [{ uploadId: ids.uploadId, chunkIndex, base64, sha256: chunkHash }]);
        expect(retry.data.idempotent).toBe(true);
        const conflictBytes = Buffer.from(chunk); conflictBytes[10] ^= 0x01;
        const conflict = post(context, 'media.poc.chunk', [{ uploadId: ids.uploadId, chunkIndex,
          base64: conflictBytes.toString('base64'), sha256: digest(conflictBytes) }]);
        expect(conflict).toMatchObject({ ok: false, code: 'MEDIA_POC_CHUNK_CONFLICT' });
      }
    }
    const finalized = post(context, 'media.poc.finalize', [{ uploadId: ids.uploadId }]);
    expect(finalized).toMatchObject({ ok: true, data: { state: 'private', size: bytes.length, totalChunks: 5, sha256: digest(bytes) } });
    expect(context.__canonical.files.filter((file: MemoryFile) => !file.trashed)).toHaveLength(1);
    expect(context.__canonical.files[0].sharing).toBe('PRIVATE');
    expect(context.__staging.files.filter((file: MemoryFile) => !file.trashed)).toHaveLength(0);
    expect(JSON.stringify(finalized)).not.toContain(context.__canonical.files[0].id);
    expect(post(context, 'media.poc.finalize', [{ uploadId: ids.uploadId }]).ok).toBe(true);
    expect(context.__canonical.files.filter((file: MemoryFile) => !file.trashed)).toHaveLength(1);
  }, 20_000);

  it('rejects finalize when chunks are missing and resumes after the missing chunk arrives', () => {
    const context = makeBridge();
    const bytes = png(CHUNK_BYTES + 12);
    const { ids } = begin(context, bytes);
    const first = bytes.subarray(0, CHUNK_BYTES);
    expect(post(context, 'media.poc.chunk', [{ uploadId: ids.uploadId, chunkIndex: 0, base64: first.toString('base64'), sha256: digest(first) }]).ok).toBe(true);
    expect(post(context, 'media.poc.finalize', [{ uploadId: ids.uploadId }])).toMatchObject({ ok: false, code: 'MEDIA_POC_CHUNK_MISSING' });
    const last = bytes.subarray(CHUNK_BYTES);
    expect(post(context, 'media.poc.chunk', [{ uploadId: ids.uploadId, chunkIndex: 1, base64: last.toString('base64'), sha256: digest(last) }]).ok).toBe(true);
    expect(post(context, 'media.poc.finalize', [{ uploadId: ids.uploadId }]).ok).toBe(true);
  });

  it('rejects malformed base64, wrong chunk checksum, invalid MIME/signature, oversized files and unprivate folders', () => {
    const context = makeBridge();
    const bytes = png(16);
    const { ids } = begin(context, bytes);
    expect(post(context, 'media.poc.chunk', [{ uploadId: ids.uploadId, chunkIndex: 0, base64: 'not base64', sha256: digest(bytes) }]).ok).toBe(false);
    expect(post(context, 'media.poc.chunk', [{ uploadId: ids.uploadId, chunkIndex: 1, base64: bytes.toString('base64'), sha256: digest(bytes) }]).code)
      .toBe('INVALID_MEDIA_POC_CHUNK');
    expect(post(context, 'media.poc.chunk', [{ uploadId: ids.uploadId, chunkIndex: 0, base64: bytes.toString('base64'), sha256: 'a'.repeat(64) }])
      .code).toBe('MEDIA_POC_CHUNK_CHECKSUM');
    const wrongTypeContext = makeBridge();
    const wrongType = begin(wrongTypeContext, bytes, { mimeType: 'image/jpeg' });
    const wrongChunk = post(wrongTypeContext, 'media.poc.chunk', [{ uploadId: wrongType.ids.uploadId, chunkIndex: 0,
      base64: bytes.toString('base64'), sha256: digest(bytes) }]);
    expect(wrongChunk.ok).toBe(true);
    expect(post(wrongTypeContext, 'media.poc.finalize', [{ uploadId: wrongType.ids.uploadId }]).code).toBe('MEDIA_POC_MIME_MISMATCH');
    expect(begin(context, Buffer.alloc(10 * 1024 * 1024 + 1)).response.code).toBe('INVALID_MEDIA_POC_REQUEST');
    context.__canonical.sharing = 'ANYONE_WITH_LINK';
    expect(begin(context, bytes).response.code).toBe('MEDIA_POC_FOLDER_NOT_PRIVATE');
  });

  it('rejects a final digest mismatch and allows an expired failed-checksum session to be cleaned', () => {
    const context = makeBridge();
    const sourceBytes = png(48);
    const { ids } = begin(context, sourceBytes);
    const corrupt = Buffer.from(sourceBytes); corrupt[24] ^= 0x7f;
    expect(post(context, 'media.poc.chunk', [{ uploadId: ids.uploadId, chunkIndex: 0,
      base64: corrupt.toString('base64'), sha256: digest(corrupt) }]).ok).toBe(true);
    expect(post(context, 'media.poc.finalize', [{ uploadId: ids.uploadId }]).code).toBe('MEDIA_POC_FINAL_CHECKSUM');
    const session = JSON.parse(context.__properties[`CXL_MEDIA_POC_SESSION_${ids.uploadId}`]);
    session.expiresAt = Date.now() - 1;
    context.__properties[`CXL_MEDIA_POC_SESSION_${ids.uploadId}`] = JSON.stringify(session);
    expect(post(context, 'media.poc.cleanup', [])).toMatchObject({ ok: true, data: { deletedSessions: 1, deletedChunks: 1, remaining: 0 } });
    expect(context.__canonical.files.filter((file: MemoryFile) => !file.trashed)).toHaveLength(0);
  });

  it('requires the exact synthetic Work/ref association, keeps anonymous private reads denied, and revokes public reads', () => {
    const context = makeBridge();
    const bytes = png(32);
    const { ids } = begin(context, bytes);
    const chunk = bytes.toString('base64');
    expect(post(context, 'media.poc.chunk', [{ uploadId: ids.uploadId, chunkIndex: 0, base64: chunk, sha256: digest(bytes) }]).ok).toBe(true);
    expect(post(context, 'media.poc.finalize', [{ uploadId: ids.uploadId }]).ok).toBe(true);
    const readArgs = { mediaId: ids.mediaId, workNonce: ids.workNonce, ref: `media:${ids.mediaId}`, chunkIndex: 0 };
    expect(post(context, 'media.poc.publicChunk', [readArgs]).code).toBe('MEDIA_POC_MEDIA_NOT_PUBLIC');
    expect(post(context, 'media.poc.ownerChunk', [{ ...readArgs, workNonce: randomUUID() }]).code).toBe('MEDIA_POC_MEDIA_NOT_FOUND');
    expect(post(context, 'media.poc.ownerChunk', [{ ...readArgs, ref: 'media:other' }]).code).toBe('MEDIA_POC_MEDIA_NOT_FOUND');
    expect(post(context, 'media.poc.ownerChunk', [readArgs], '', OWNER_ID).code).toBe('OWNER_API_UNAUTHORIZED');
    expect(post(context, 'media.poc.setPublic', [{ mediaId: ids.mediaId, workNonce: ids.workNonce, isPublic: true }]))
      .toMatchObject({ ok: true, data: { state: 'public', ref: `media:${ids.mediaId}` } });
    const publicChunk = post(context, 'media.poc.publicChunk', [readArgs]);
    expect(publicChunk).toMatchObject({ ok: true, data: { mimeType: 'image/png', totalFileSize: bytes.length, ref: `media:${ids.mediaId}` } });
    expect(Buffer.from(publicChunk.data.base64, 'base64')).toEqual(bytes);
    const publicReadLogs = parsedReadLogs(context).filter(log => log.action === 'media.poc.publicChunk');
    expect(publicReadLogs.map(log => log.phase)).toContain('response_constructed');
    expect(publicReadLogs.map(log => log.phase)).toContain('drive_range_validated');
    expect(context.__driveRangeCalls[0].options.headers.Range).toBe(`bytes=0-${bytes.length - 1}`);
    expect(context.__driveRangeCalls[0].options.headers.Authorization).toBe('Bearer test-only-google-oauth-token');
    expect(JSON.stringify(publicChunk)).not.toContain('test-only-google-oauth-token');
    expect(post(context, 'media.poc.setPublic', [{ mediaId: ids.mediaId, workNonce: ids.workNonce, isPublic: false }]).ok).toBe(true);
    expect(post(context, 'media.poc.publicChunk', [readArgs]).code).toBe('MEDIA_POC_MEDIA_NOT_PUBLIC');
    expect(context.__canonical.files[0].sharing).toBe('PRIVATE');
  });

  it('returns the exact Owner read contract for a finalized 68-byte PNG', () => {
    const context = makeBridge();
    const bytes = liveTestPng68();
    expect(bytes).toHaveLength(68);
    const { ids } = begin(context, bytes);
    expect(post(context, 'media.poc.chunk', [{ uploadId: ids.uploadId, chunkIndex: 0,
      base64: bytes.toString('base64'), sha256: digest(bytes) }]).ok).toBe(true);
    expect(post(context, 'media.poc.finalize', [{ uploadId: ids.uploadId }]).ok).toBe(true);

    const response = post(context, 'media.poc.ownerChunk', [{
      mediaId: ids.mediaId, workNonce: ids.workNonce, ref: `media:${ids.mediaId}`, chunkIndex: 0
    }]);

    expect(response).toMatchObject({ ok: true, data: {
      workId: `asset_media_poc_${ids.workNonce}`,
      mediaId: ids.mediaId,
      ref: `media:${ids.mediaId}`,
      mimeType: 'image/png',
      totalFileSize: 68,
      totalChunks: 1,
      chunkIndex: 0,
      sha256: digest(bytes),
      chunkSha256: digest(bytes)
    } });
    expect(Buffer.from(response.data.base64, 'base64')).toEqual(bytes);
  });

  it('logs successful Owner chunk reads with only safe fields and records Drive 206 validation', () => {
    const context = makeBridge();
    const bytes = liveTestPng68();
    const fixture = seedReadMedia(context, bytes);
    const response = post(context, 'media.poc.ownerChunk', [fixture.readArgs(0)]);
    expect(response.ok).toBe(true);

    const logs = parsedReadLogs(context);
    expect(logs.map(log => log.phase)).toEqual(expect.arrayContaining([
      'request_received', 'manifest_validated', 'drive_fetch_started', 'drive_fetch_completed',
      'drive_range_validated', 'response_constructed'
    ]));
    expect(logs.find(log => log.phase === 'drive_fetch_completed')).toMatchObject({
      event: 'media_poc_read', action: 'media.poc.ownerChunk', httpStatus: 206,
      expectedBytes: bytes.length, actualBytes: bytes.length
    });
    const allowedKeys = new Set(['event', 'action', 'phase', 'code', 'httpStatus', 'expectedBytes', 'actualBytes', 'durationMs', 'chunkIndex']);
    for (const log of logs) {
      expect(Object.keys(log).every(key => allowedKeys.has(key))).toBe(true);
      expect(log.chunkIndex).toBe(0);
      expect(typeof log.durationMs === 'undefined' || Number.isFinite(log.durationMs)).toBe(true);
    }
    const serialized = JSON.stringify(logs);
    for (const sensitive of [fixture.ids.mediaId, fixture.ids.workNonce, fixture.file.id,
      `media:${fixture.ids.mediaId}`, 'test-only-google-oauth-token', digest(bytes), bytes.toString('base64'), 'isolated-canonical-folder']) {
      expect(serialized).not.toContain(sensitive);
    }
    expect(serialized).not.toMatch(/https?:\/\//i);

    const diagnostic = persistedReadDiagnostic(context);
    expect(diagnostic.action).toBe('ownerChunk');
    expect(Object.keys(diagnostic).sort()).toEqual(['action', 'phases']);
    const allowedDiagnosticPhaseKeys = new Set(['phase', 'code', 'httpStatus', 'expectedBytes', 'actualBytes', 'durationMs', 'chunkIndex']);
    for (const phase of diagnostic.phases) expect(Object.keys(phase).every((key: string) => allowedDiagnosticPhaseKeys.has(key))).toBe(true);
    expect(diagnostic.phases.at(-1).phase).toBe('response_constructed');
    expect(diagnostic.phases.find((phase: any) => phase.phase === 'drive_fetch_completed')).toMatchObject({
      httpStatus: 206, expectedBytes: bytes.length, actualBytes: bytes.length
    });
    expect(context.__properties.CXL_MEDIA_POC_LAST_READ_DIAGNOSTIC.length).toBeLessThan(2048);
    expect(post(context, 'media.poc.readDiagnostics', [])).toEqual({ ok: true, data: diagnostic });
  });

  it('supports Drive HTTP 200 full-body fallback and logs only status and byte counts', () => {
    const context = makeBridge();
    const bytes = png(CHUNK_BYTES + 23);
    const fixture = seedReadMedia(context, bytes);
    context.__setDriveFetch(() => ({ getResponseCode: () => 200, getContent: () => [...bytes].map(byte => byte > 127 ? byte - 256 : byte) }));

    const response = post(context, 'media.poc.ownerChunk', [fixture.readArgs(1)]);
    expect(response.ok).toBe(true);
    expect(Buffer.from(response.data.base64, 'base64')).toEqual(bytes.subarray(CHUNK_BYTES));
    const logs = parsedReadLogs(context);
    expect(logs.find(log => log.phase === 'drive_fetch_completed')).toMatchObject({
      httpStatus: 200, expectedBytes: 23, actualBytes: bytes.length
    });
    expect(logs.find(log => log.phase === 'drive_range_validated')).toMatchObject({
      httpStatus: 200, expectedBytes: 23, actualBytes: 23
    });
    const diagnostic = persistedReadDiagnostic(context);
    expect(diagnostic.phases.find((phase: any) => phase.phase === 'drive_fetch_completed')).toMatchObject({
      httpStatus: 200, expectedBytes: 23, actualBytes: bytes.length
    });
  });

  it('logs non-range Drive status and throws a safe failure code', () => {
    const context = makeBridge();
    const bytes = liveTestPng68();
    const fixture = seedReadMedia(context, bytes);
    context.__setDriveFetch(() => ({ getResponseCode: () => 403, getContent: () => [1, 2, 3] }));

    const response = post(context, 'media.poc.ownerChunk', [fixture.readArgs(0)]);
    expect(response).toMatchObject({ ok: false, code: 'MEDIA_POC_MEDIA_READ_FAILED' });
    const logs = parsedReadLogs(context);
    expect(logs.find(log => log.phase === 'drive_fetch_completed')).toMatchObject({
      httpStatus: 403, expectedBytes: bytes.length, actualBytes: 3
    });
    expect(logs.filter(log => log.phase === 'read_failed').at(-1)).toMatchObject({
      code: 'MEDIA_POC_MEDIA_READ_FAILED', action: 'media.poc.ownerChunk'
    });
    expect(persistedReadDiagnostic(context).phases.at(-1)).toMatchObject({
      phase: 'read_failed', code: 'MEDIA_POC_MEDIA_READ_FAILED'
    });
  });

  it('logs thrown UrlFetch failures without copying exception details or sensitive read data', () => {
    const context = makeBridge();
    const bytes = liveTestPng68();
    const fixture = seedReadMedia(context, bytes);
    const sensitiveFailure = 'https://drive.example/private/file-id Bearer secret-token ' + bytes.toString('base64');
    context.__setDriveFetch(() => { throw new Error(sensitiveFailure); });

    const response = post(context, 'media.poc.ownerChunk', [fixture.readArgs(0)]);
    expect(response).toMatchObject({ ok: false, code: 'MEDIA_POC_MEDIA_READ_FAILED' });
    const logs = parsedReadLogs(context);
    expect(logs.filter(log => log.phase === 'read_failed').at(-1)).toMatchObject({
      code: 'MEDIA_POC_MEDIA_READ_FAILED', action: 'media.poc.ownerChunk'
    });
    const serialized = JSON.stringify(logs);
    expect(serialized).not.toContain(sensitiveFailure);
    expect(serialized).not.toContain(fixture.ids.mediaId);
    expect(serialized).not.toContain(fixture.ids.workNonce);
    expect(serialized).not.toContain(fixture.file.id);
    expect(serialized).not.toContain(digest(bytes));
  });

  it('starts a fresh diagnostic for each read instead of mixing prior phases or status', () => {
    const context = makeBridge();
    const bytes = liveTestPng68();
    const fixture = seedReadMedia(context, bytes);
    expect(post(context, 'media.poc.ownerChunk', [fixture.readArgs(0)]).ok).toBe(true);
    expect(persistedReadDiagnostic(context).phases.some((phase: any) => phase.phase === 'response_constructed')).toBe(true);

    context.__setDriveFetch(() => { throw new Error('drive fetch failed'); });
    expect(post(context, 'media.poc.ownerChunk', [fixture.readArgs(0)]).code).toBe('MEDIA_POC_MEDIA_READ_FAILED');
    const latest = persistedReadDiagnostic(context);
    expect(latest.action).toBe('ownerChunk');
    expect(latest.phases.map((phase: any) => phase.phase)).toEqual([
      'request_received', 'manifest_validated', 'drive_fetch_started', 'read_failed'
    ]);
    expect(latest.phases.some((phase: any) => 'httpStatus' in phase)).toBe(false);
    expect(latest.phases.some((phase: any) => phase.phase === 'response_constructed')).toBe(false);
  });

  it('protects readDiagnostics with the existing GAS shared-secret and configured Owner checks and sanitizes stored data', () => {
    const context = makeBridge();
    context.__properties.CXL_MEDIA_POC_LAST_READ_DIAGNOSTIC = JSON.stringify({
      action: 'ownerChunk',
      ownerId: 'private-owner-value',
      fileId: 'private-drive-id',
      phases: [{ phase: 'request_received', url: 'https://private.example', authorization: 'secret-token', checksum: 'a'.repeat(64) }]
    });
    expect(post(context, 'media.poc.readDiagnostics', [], '', OWNER_ID).code).toBe('OWNER_API_UNAUTHORIZED');
    expect(post(context, 'media.poc.readDiagnostics', [], SECRET, 'spoofed-owner').code).toBe('OWNER_API_UNAUTHORIZED');

    const response = post(context, 'media.poc.readDiagnostics', []);
    expect(response).toEqual({ ok: true, data: { action: 'ownerChunk', phases: [{ phase: 'request_received' }] } });
    expect(JSON.stringify(response)).not.toMatch(/private-owner-value|private-drive-id|https?:|secret-token|checksum/i);
    expect(post(context, 'media.poc.readDiagnostics', [{}]).code).toBe('INVALID_MEDIA_POC_REQUEST');
  });

  it('cleans only a bounded number of expired POC staging sessions and never touches canonical media', () => {
    const context = makeBridge();
    const expired = { uploadId: randomUUID(), mediaId: randomUUID(), workId: 'asset_media_poc_expired', totalFileSize: 4,
      rawChunkSize: CHUNK_BYTES, totalChunks: 1, mimeType: 'image/png', sha256: 'a'.repeat(64), ownerUserId: OWNER_ID,
      expiresAt: Date.now() - 1, status: 'uploading' };
    const live = { ...expired, uploadId: randomUUID(), expiresAt: Date.now() + 60_000 };
    context.__properties[`CXL_MEDIA_POC_SESSION_${expired.uploadId}`] = JSON.stringify(expired);
    context.__properties[`CXL_MEDIA_POC_SESSION_${live.uploadId}`] = JSON.stringify(live);
    const moreExpired = Array.from({ length: 5 }, () => ({ ...expired, uploadId: randomUUID() }));
    for (const session of moreExpired) context.__properties[`CXL_MEDIA_POC_SESSION_${session.uploadId}`] = JSON.stringify(session);
    context.__staging.createFile(new MemoryBlob([1, 2, 3, 4], 'application/octet-stream', `cxl-media-poc-chunk-${expired.uploadId}-00.bin`));
    context.__staging.createFile(new MemoryBlob([1, 2, 3, 4], 'application/octet-stream', `cxl-media-poc-chunk-${live.uploadId}-00.bin`));
    context.__canonical.createFile(new MemoryBlob([1, 2, 3, 4], 'image/png', 'poc-canonical.png'));
    const cleanup = post(context, 'media.poc.cleanup', []);
    expect(cleanup).toMatchObject({ ok: true, data: { deletedSessions: 5, deletedChunks: 1, remaining: 2 } });
    expect(context.__staging.files.filter((file: MemoryFile) => !file.trashed).map((file: MemoryFile) => file.name))
      .toEqual([`cxl-media-poc-chunk-${live.uploadId}-00.bin`]);
    expect(context.__canonical.files.filter((file: MemoryFile) => !file.trashed)).toHaveLength(1);
  });
});
