import { describe, expect, it } from 'vitest';
import { applyIdeaOp, IdeaError, IDEA_LIMITS, parseIdeaOp, sanitizeIdeaFile, type IdeaFile } from './cxlIdeas';

const T0 = new Date('2026-10-02T14:14:00.000Z');
const T1 = new Date('2026-10-03T01:00:00.000Z');
let counter = 0;
const newId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;
const empty = (): IdeaFile => ({ version: 1, ideas: [] });
const add = (file: IdeaFile, text: string, workId?: string | null, now = T0) => applyIdeaOp(file, { op: 'add', text, workId }, now, newId);

describe('idea rules', () => {
  it('adds newest first with server time, a server id and trimmed text', () => {
    let file = add(empty(), '  ทหารเรือหลงทาง  ', 'asset_abc');
    file = add(file, 'สอง', null, T1);
    const [second, first] = file.ideas;
    expect(second.text).toBe('สอง');
    expect(first).toMatchObject({ text: 'ทหารเรือหลงทาง', status: 'waiting', workId: 'asset_abc', createdAt: T0.toISOString(), updatedAt: T0.toISOString(), history: [] });
    expect(first.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('rejects bad operations', () => {
    expect(parseIdeaOp({ op: 'add', text: '   ' })).toBeNull();
    expect(parseIdeaOp({ op: 'add', text: 'x'.repeat(IDEA_LIMITS.text + 1) })).toBeNull();
    expect(parseIdeaOp({ op: 'add', text: 'ok', workId: '../x' })).toBeNull();
    expect(parseIdeaOp({ op: 'rename', id: 'a' })).toBeNull();
    expect(parseIdeaOp({ op: 'status', id: 'a', status: 'done' })).toBeNull();
    expect(parseIdeaOp({ op: 'add', text: 'ok', createdAt: '2020-01-01T00:00:00.000Z' })).toEqual({ op: 'add', text: 'ok', workId: null });
  });

  it('keeps the original wording and date when text is edited', () => {
    let file = add(empty(), 'เดิม');
    const id = file.ideas[0].id;
    file = applyIdeaOp(file, { op: 'edit', id, text: 'ใหม่' }, T1, newId);
    expect(file.ideas[0]).toMatchObject({ text: 'ใหม่', createdAt: T0.toISOString(), updatedAt: T1.toISOString(), history: [{ text: 'เดิม', replacedAt: T1.toISOString() }] });
    const same = applyIdeaOp(file, { op: 'edit', id, text: '  ใหม่ ' }, new Date('2026-10-04T00:00:00.000Z'), newId);
    expect(same).toEqual(file);
  });

  it('caps history at the limit, dropping the oldest', () => {
    let file = add(empty(), 'v0');
    const id = file.ideas[0].id;
    for (let i = 1; i <= IDEA_LIMITS.history + 2; i += 1) file = applyIdeaOp(file, { op: 'edit', id, text: `v${i}` }, T1, newId);
    expect(file.ideas[0].history).toHaveLength(IDEA_LIMITS.history);
    expect(file.ideas[0].history[0].text).toBe('v2');
  });

  it('changes status and work without touching the creation date, and deletes', () => {
    let file = add(empty(), 'x');
    const id = file.ideas[0].id;
    file = applyIdeaOp(file, { op: 'status', id, status: 'dropped' }, T1, newId);
    file = applyIdeaOp(file, { op: 'move', id, workId: 'asset_zz' }, T1, newId);
    expect(file.ideas[0]).toMatchObject({ status: 'dropped', workId: 'asset_zz', createdAt: T0.toISOString(), updatedAt: T1.toISOString() });
    expect(applyIdeaOp(file, { op: 'delete', id }, T1, newId).ideas).toEqual([]);
  });

  it('answers 404 for an unknown idea and 409 at the limit', () => {
    expect(() => applyIdeaOp(empty(), { op: 'delete', id: 'missing' }, T1, newId)).toThrow(expect.objectContaining({ status: 404 }));
    const full: IdeaFile = { version: 1, ideas: Array.from({ length: IDEA_LIMITS.ideas }, (_, i) => ({ id: `id-${i}`, text: 't', status: 'waiting' as const, workId: null, createdAt: T0.toISOString(), updatedAt: T0.toISOString(), history: [] })) };
    try { add(full, 'one more'); throw new Error('no error'); } catch (error) { expect(error).toBeInstanceOf(IdeaError); expect((error as IdeaError).status).toBe(409); }
  });

  it('keeps only well-formed ideas from a stored file', () => {
    const valid = add(empty(), 'ok').ideas[0];
    expect(sanitizeIdeaFile({ ideas: [valid, { id: 1 }] }).ideas).toEqual([valid]);
    expect(sanitizeIdeaFile(null)).toEqual({ version: 1, ideas: [] });
  });
});
