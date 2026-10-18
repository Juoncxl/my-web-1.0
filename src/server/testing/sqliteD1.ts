import { DatabaseSync } from 'node:sqlite';
import type { D1Like } from '../cxlSourceStore';

/**
 * Test-only stand-in for a Cloudflare D1 binding, backed by Node's built-in SQLite, so the
 * Work store's SQL runs against a real SQLite engine (D1 is SQLite). Mirrors the D1 result
 * shapes the code relies on: first() → row | null, all() → { results }, run() → { meta: { changes } },
 * batch() → all statements in one transaction.
 */
export function sqliteD1(): D1Like & { raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  type Bound = { sql: string; values: unknown[] };
  const statement = (sql: string, values: unknown[] = []) => {
    const bound: Bound = { sql, values };
    const params = () => values.map(value => (value === undefined ? null : value)) as never[];
    return {
      bound,
      bind: (...next: unknown[]) => statement(sql, next),
      async first<T>() { return (raw.prepare(sql).get(...params()) ?? null) as T | null; },
      async all<T>() { return { results: raw.prepare(sql).all(...params()) as T[] }; },
      async run() { const result = raw.prepare(sql).run(...params()); return { meta: { changes: Number(result.changes) } }; }
    };
  };
  return {
    raw,
    prepare: (sql: string) => statement(sql),
    async batch(statements) {
      raw.exec('BEGIN');
      try {
        const results = [];
        for (const item of statements as unknown as { run(): Promise<unknown> }[]) results.push(await item.run());
        raw.exec('COMMIT');
        return results;
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    }
  } as D1Like & { raw: DatabaseSync };
}
