import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(join(process.cwd(), 'apps-script', 'api-only-owner', 'Code.gs'), 'utf8');

class MemorySheet {
  reads = 0;
  constructor(readonly rows: unknown[][]) {}
  getLastRow() { return this.rows.length; }
  getLastColumn() { return this.rows[0]?.length || 0; }
  getRange(row: number, column: number, height: number, width: number) {
    return { getValues: () => { this.reads++; return Array.from({ length: height }, (_, r) => Array.from({ length: width }, (_, c) => this.rows[row - 1 + r]?.[column - 1 + c] ?? '')); } };
  }
}

function bridge() {
  const context: Record<string, any> = {};
  const properties = new Map<string, string>();
  context.Utilities = {
    getUuid: () => '0123456789abcdef0123456789abcdef',
    DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
    computeDigest: (_algorithm: string, value: string) => [...createHash('sha256').update(value, 'utf8').digest()].map(byte => byte > 127 ? byte - 256 : byte)
  };
  context.PropertiesService = { getScriptProperties: () => ({
    getProperty: (key: string) => properties.get(key) ?? null,
    setProperty: (key: string, value: string) => { properties.set(key, value); return this; },
    getProperties: () => Object.fromEntries(properties),
    deleteProperty: (key: string) => { properties.delete(key); }
  }) };
  context.LockService = { getScriptLock: () => ({ waitLock: vi.fn(), releaseLock: vi.fn() }) };
  context.console = { log: vi.fn() };
  runInNewContext(source, context);
  return { context, properties };
}

function snapshotSheets(ctx: Record<string, any>) {
  const work = { id: 'asset_public1', title: 'Public', userId: 'PRIVATE_OWNER_ID', ownerUserId: 'PRIVATE_OWNER_ID', driveFileId: 'DRIVE_FILE',
    authorName: 'Creator', category: 'character', status: 'finished', visibility: 'public', isPublic: true, tags: ['public'],
    content: 'safe public snippet', contentBlocks: [], uiCodeSnippet: '', previewImages: [], media: [], folderId: 'PRIVATE_FOLDER',
    shortDescription: 'card summary', icon: { type: 'emoji', value: '✨' } };
  const index = new MemorySheet([ctx.PUBLIC_HEADERS, ['asset_public1', 'Public', 'character', 'finished', '2026-01-01', '["public"]', 'card summary', 'PRIVATE_DRIVE_ID', 'true', '',
    JSON.stringify({ summaryVersion: 2, asset: work })]]);
  const map = new MemorySheet([['schemaVersion', 'workId', 'publicCreatorId'], [1, 'asset_public1', 'cxlc_0123456789abcdef0123456789abcdef']]);
  const creators = new MemorySheet([['publicCreatorId', 'slug', 'displayName', 'bio', 'avatarRef', 'coverRef', 'active', 'updatedAt', 'schemaVersion'],
    ['cxlc_0123456789abcdef0123456789abcdef', 'creator-one', 'Creator One', 'Public bio', '', '', true, '2026-01-01', 1]]);
  const settings = new MemorySheet([['publicCreatorId', 'settingsVersion', 'settingsJson'],
    ['cxlc_0123456789abcdef0123456789abcdef', 1, JSON.stringify({ settingsVersion: 1, layout: 'locked', widgets: ['note'], widgetConfigs: { note: { text: 'hello' } } })]]);
  const sheets: Record<string, MemorySheet> = { Index: index, WorkCreatorMap: map, PublicCreatorIndex: creators, CreatorSettings: settings };
  ctx.config_ = () => ({ publicSheetId: 'PUBLIC_SHEET_ID' });
  ctx.SpreadsheetApp = { openById: vi.fn(() => ({ getSheets: () => [index], getSheetByName: (name: string) => sheets[name] || null })) };
  return { index, map, creators, settings };
}

describe('API-only Owner public read snapshot', () => {
  it('serves public list from properties only and omits private IDs and fields', () => {
    const { context, properties } = bridge();
    context.Utilities.getUuid = () => '0123456789abcdef0123456789abcdef';
    const snapshot = { version: 1, updatedAt: '2026-01-01T00:00:00.000Z', works: [{ id: 'asset_public1', title: 'Public', publicCreatorId: 'cxlc_0123456789abcdef0123456789abcdef' }], creators: [], settings: {} };
    const serialized = JSON.stringify(snapshot);
    const base = 'CXL_PUBLIC_READ_SNAPSHOT_0123456789abcdef0123456789abcdef_';
    properties.set(`${base}0`, serialized);
    properties.set(`${base}M`, JSON.stringify({ version: 1, chunks: 1, sha256: createHash('sha256').update(serialized).digest('hex') }));
    properties.set('CXL_PUBLIC_READ_SNAPSHOT_CURRENT', '0123456789abcdef0123456789abcdef');
    context.SpreadsheetApp = { openById: vi.fn(() => { throw new Error('Home reads must not open Sheets'); }) };
    context.DriveApp = { getFileById: vi.fn(() => { throw new Error('Home reads must not read Drive'); }) };

    const result = context.publicReadDispatch_('public.works.list', [{}]);

    expect(result).toEqual(snapshot.works);
    expect(context.SpreadsheetApp.openById).not.toHaveBeenCalled();
    expect(context.DriveApp.getFileById).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_OWNER_ID|DRIVE_FILE|PRIVATE_FOLDER|userId|driveFileId/);
  });

  it('bulk builds the initial snapshot once and atomically installs its generation', () => {
    const { context, properties } = bridge();
    const sheets = snapshotSheets(context);
    const result = context.publicReadSnapshotRebuild_();
    const generation = properties.get('CXL_PUBLIC_READ_SNAPSHOT_CURRENT');
    const snapshot = context.publicReadSnapshot_();

    expect(result.works).toBe(1);
    expect(generation).toBe('0123456789abcdef0123456789abcdef');
    expect([sheets.index.reads, sheets.map.reads, sheets.creators.reads, sheets.settings.reads]).toEqual([1, 1, 1, 1]);
    expect(snapshot.works[0]).toMatchObject({ id: 'asset_public1', title: 'Public', publicCreatorId: 'cxlc_0123456789abcdef0123456789abcdef', content: 'safe public snippet' });
    expect(JSON.stringify(snapshot)).not.toMatch(/PRIVATE_OWNER_ID|PRIVATE_DRIVE_ID|DRIVE_FILE|PRIVATE_FOLDER|ownerUserId|driveFileId|folderId/);
  });

  it('keeps the previous valid generation active when a rebuild fails', () => {
    const { context, properties } = bridge();
    snapshotSheets(context);
    context.publicReadSnapshotRebuild_();
    const oldGeneration = properties.get('CXL_PUBLIC_READ_SNAPSHOT_CURRENT');
    context.SpreadsheetApp.openById = vi.fn(() => { throw new Error('sheet unavailable'); });

    expect(() => context.publicReadSnapshotRebuild_()).toThrow();
    expect(properties.get('CXL_PUBLIC_READ_SNAPSHOT_CURRENT')).toBe(oldGeneration);
    expect(context.publicReadSnapshot_().works).toHaveLength(1);
  });

  it('refreshes the snapshot after public upsert and public-to-private deactivation', () => {
    const { context } = bridge();
    context.privatePublicCreatorId_ = vi.fn(() => 'cxlc_0123456789abcdef0123456789abcdef');
    context.upsertWorkCreatorMap_ = vi.fn();
    context.syncPublic_ = vi.fn();
    context.publicReadSnapshotRebuild_ = vi.fn();
    const publicRecord = { row: { id: 'asset_1', visibility: 'public', is_public: true, deleted_at: '' } };
    const privateRecord = { row: { id: 'asset_1', visibility: 'private', is_public: false, deleted_at: '' } };

    context.finishCxlPublicProjection_(publicRecord, 'owner-internal', false);
    context.finishCxlPublicProjection_(privateRecord, 'owner-internal', true);

    expect(context.upsertWorkCreatorMap_).toHaveBeenCalledTimes(1);
    expect(context.syncPublic_).toHaveBeenCalledTimes(2);
    expect(context.publicReadSnapshotRebuild_).toHaveBeenCalledTimes(2);
  });
});

