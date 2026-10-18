import { afterEach, describe, expect, it, vi } from 'vitest';
import { markSourcesDirty, setSourceDb, sourceText, type D1Like } from './cxlSourceStore';

/** Just enough of D1 for the statements cxlSourceStore issues. */
function memoryD1(options: { failReads?: boolean } = {}) {
  const copies = new Map<string, { body: string; fetched_at: number }>();
  const meta = new Map<string, number>();
  const statement = (sql: string, values: unknown[] = []) => ({
    bind: (...next: unknown[]) => statement(sql, next),
    async first<T>() {
      if (options.failReads) throw new Error('D1 unavailable');
      if (sql.startsWith('SELECT body')) return (copies.get(String(values[0])) || null) as T | null;
      if (sql.startsWith('SELECT value')) return (meta.has('dirty_at') ? { value: meta.get('dirty_at') } : null) as T | null;
      throw new Error(`Unexpected ${sql}`);
    },
    async run() {
      if (sql.startsWith('INSERT INTO source_copy')) copies.set(String(values[0]), { body: String(values[1]), fetched_at: Number(values[2]) });
      else if (sql.startsWith('INSERT INTO source_meta')) meta.set('dirty_at', Math.max(meta.get('dirty_at') || 0, Number(values[0])));
      return {};
    }
  });
  const db = { prepare: (sql: string) => statement(sql), batch: async () => [] } as unknown as D1Like;
  return { db, copies };
}

afterEach(() => { setSourceDb(null); vi.unstubAllEnvs(); });

describe('D1 copies of Google sources', () => {
  it('always reads Google while the switch is off', async () => {
    setSourceDb(memoryD1().db);
    const load = vi.fn(async () => 'from google');
    await sourceText('sheet:x', load);
    await sourceText('sheet:x', load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('serves the stored copy until a write marks it stale, then reads Google again', async () => {
    const d1 = memoryD1();
    setSourceDb(d1.db);
    vi.stubEnv('CXL_D1_SOURCES', 'on');
    const load = vi.fn(async () => `v${load.mock.calls.length}`);
    expect(await sourceText('sheet:x', load, 1_000)).toBe('v1');
    expect(await sourceText('sheet:x', load, 2_000)).toBe('v1');
    expect(load).toHaveBeenCalledTimes(1);
    await markSourcesDirty(3_000);
    expect(await sourceText('sheet:x', load, 4_000)).toBe('v2');
    expect(await sourceText('sheet:x', load, 5_000)).toBe('v2');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('refreshes a copy older than 15 minutes (edits made directly in Sheets)', async () => {
    setSourceDb(memoryD1().db);
    vi.stubEnv('CXL_D1_SOURCES', 'on');
    const load = vi.fn(async () => 'body');
    await sourceText('file:a', load, 0);
    await sourceText('file:a', load, 14 * 60_000);
    await sourceText('file:a', load, 16 * 60_000);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('falls back to Google when D1 fails, and lets Google errors through', async () => {
    setSourceDb(memoryD1({ failReads: true }).db);
    vi.stubEnv('CXL_D1_SOURCES', 'on');
    await expect(sourceText('sheet:x', async () => 'from google')).resolves.toBe('from google');
    await expect(sourceText('sheet:y', async () => { throw new Error('Google API request failed (HTTP 429)'); })).rejects.toThrow('HTTP 429');
  });
});
