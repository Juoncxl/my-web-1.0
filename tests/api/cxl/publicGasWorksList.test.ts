import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(join(process.cwd(), 'apps-script', 'public', 'Code.gs'), 'utf8');
const CREATOR_ID = `cxlc_${'a'.repeat(32)}`;

function summary(id: string) {
  return JSON.stringify({ summaryVersion: 2, asset: {
    id, title: `Work ${id}`, category: 'character', status: 'finished', visibility: 'public', isPublic: true,
    tags: [], content: '', previewImages: [], contentBlocks: [], uiCodeSnippet: '', media: [],
    collaborationAssetId: null
  } });
}

class MemorySheet {
  getValuesCalls = 0;
  getLastColumnCalls = 0;
  getRangeCalls: number[][] = [];
  constructor(readonly values: unknown[][]) {}
  getLastRow() { return this.values.length; }
  getLastColumn() { this.getLastColumnCalls += 1; return this.values[0]?.length || 1; }
  getRange(row: number, column: number, height: number, width: number) {
    this.getRangeCalls.push([row, column, height, width]);
    return { getValues: () => {
      this.getValuesCalls += 1;
      return Array.from({ length: height }, (_, rowIndex) => Array.from({ length: width }, (_, columnIndex) =>
        this.values[row - 1 + rowIndex]?.[column - 1 + columnIndex] ?? ''));
    } };
  }
}

function publicIndexRow(id: string, summaryJson: string, active = true) {
  return [id, `Work ${id}`, 'character', 'finished', '2026-09-28', '[]', '', 'must-not-be-read', active ? 'true' : 'false', '', summaryJson];
}

function bridge(indexRows = [publicIndexRow('asset_one', summary('asset_one'))], mappingRows?: unknown[][]) {
  const indexSheet = new MemorySheet([Array(11).fill('header'), ...indexRows]);
  const creatorSheet = new MemorySheet(mappingRows || [
    ['schemaVersion', 'workId', 'publicCreatorId'], [1, 'asset_one', CREATOR_ID]
  ]);
  const book = {
    getSheets: vi.fn(() => [indexSheet, creatorSheet]),
    getSheetByName: vi.fn((name: string) => name === 'WorkCreatorMap' ? creatorSheet : null)
  };
  const openById = vi.fn(() => book);
  const getProperty = vi.fn((name: string) => name === 'PUBLIC_SHEET_ID' ? 'private-sheet-identifier' : null);
  const output: { text: string } = { text: '' };
  const context: Record<string, any> = {
    SpreadsheetApp: { openById },
    PropertiesService: { getScriptProperties: () => ({ getProperty }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text: string) => { output.text = text; return { setMimeType: () => output }; }
    },
    DriveApp: new Proxy({}, { get: () => { throw new Error('Public Works list must not access Drive'); } })
  };
  const parseCounts = new Map<string, number>();
  context.JSON = Object.create(JSON);
  context.JSON.parse = (raw: string, ...args: unknown[]) => {
    if (typeof raw === 'string' && raw.startsWith('{"summaryVersion":')) parseCounts.set(raw, (parseCounts.get(raw) || 0) + 1);
    return JSON.parse(raw, ...(args as []));
  };
  runInNewContext(source, context);
  return { context, indexSheet, creatorSheet, openById, getProperty, book, output, parseCounts };
}

function request(fixture: ReturnType<typeof bridge>, includeTiming = false) {
  fixture.context.doGet({ parameter: { cxlApi: 'works.list', ...(includeTiming ? { includeTiming: '1' } : {}) } });
  return JSON.parse(fixture.output.text);
}

describe('Public GAS works.list summary path', () => {
  it('bulk-reads the Public index and WorkCreatorMap once, parses each active summary once, and never opens Drive', () => {
    const rawSummary = summary('asset_one');
    const fixture = bridge([
      publicIndexRow('asset_one', rawSummary),
      // An inactive row is not parsed or projected even if its tags/summary are malformed.
      ['asset_retired', '', '', '', '', '{', '', 'private-drive-file-id', 'false', '', '{']
    ]);

    const response = request(fixture, true);

    expect(response.ok).toBe(true);
    expect(response.data).toHaveLength(1);
    expect(response.data[0]).toMatchObject({ id: 'asset_one', publicCreatorId: CREATOR_ID });
    expect(fixture.openById).toHaveBeenCalledOnce();
    expect(fixture.getProperty).toHaveBeenCalledExactlyOnceWith('PUBLIC_SHEET_ID');
    expect(fixture.book.getSheets).toHaveBeenCalledOnce();
    expect(fixture.book.getSheetByName).toHaveBeenCalledExactlyOnceWith('WorkCreatorMap');
    expect(fixture.indexSheet.getRangeCalls).toEqual([[2, 1, 2, 11]]);
    expect(fixture.indexSheet.getValuesCalls).toBe(1);
    expect(fixture.indexSheet.getLastColumnCalls).toBe(0);
    expect(fixture.creatorSheet.getValuesCalls).toBe(1);
    expect(fixture.parseCounts.get(rawSummary)).toBe(1);
    expect(JSON.stringify(response)).not.toMatch(/private-drive-file-id|must-not-be-read/);
  });

  it('rejects malformed active summaries without a Drive fallback or additional sheet reads', () => {
    const fixture = bridge([publicIndexRow('asset_broken', '{not-json')]);

    const response = request(fixture);

    expect(response).toMatchObject({ ok: false, error: 'Public summary index is not ready' });
    expect(fixture.openById).toHaveBeenCalledOnce();
    expect(fixture.indexSheet.getValuesCalls).toBe(1);
    expect(fixture.creatorSheet.getValuesCalls).toBe(0);
  });

  it('returns timing only when Preview asks for it and limits metadata to phase labels and durations', () => {
    const response = request(bridge(), true);

    expect(response.meta.timing.action).toBe('works.list');
    expect(response.meta.timing.totalMs).toEqual(expect.any(Number));
    expect(Object.keys(response.meta.timing.phases).sort()).toEqual([
      'public_creator_map_read', 'public_index_read', 'public_projection', 'public_sheet_open', 'public_summary_parse', 'response_construction'
    ]);
    for (const duration of Object.values(response.meta.timing.phases) as number[]) expect(duration).toEqual(expect.any(Number));
    expect(JSON.stringify(response.meta)).not.toMatch(/asset_|private-sheet-identifier|Drive|https?:|secret/i);

    const withoutTiming = request(bridge());
    expect(withoutTiming.meta).toBeUndefined();
  });
});

