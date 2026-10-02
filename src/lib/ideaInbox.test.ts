import { afterEach, describe, expect, it, vi } from 'vitest';
import { draftAfterSave, fetchIdeas, filterIdeas, formatIdeaTime, sendIdeaOp, type Idea } from './ideaInbox';
import { OWNER_SESSION_EXPIRED_MESSAGE } from '../data/adapters/google/googleTransport';

const idea = (id: string, status: Idea['status'], workId: string | null): Idea => ({
  id, text: id, status, workId, createdAt: '2026-10-02T14:14:00.000Z', updatedAt: '2026-10-02T14:14:00.000Z', history: []
});

afterEach(() => vi.unstubAllGlobals());

describe('idea inbox client', () => {
  it('shows the time it was written in Thai, Bangkok time', () => {
    expect(formatIdeaTime('2026-10-02T14:14:00.000Z')).toBe('2 ต.ค. 2569 · 21:14 น.');
  });

  it('filters by status and by Work', () => {
    const ideas = [idea('a', 'waiting', 'asset_1'), idea('b', 'used', null), idea('c', 'waiting', null)];
    expect(filterIdeas(ideas, 'waiting').map(item => item.id)).toEqual(['a', 'c']);
    expect(filterIdeas(ideas, 'all', 'asset_1').map(item => item.id)).toEqual(['a']);
  });

  it('posts an operation with the CSRF header to the idea store', async () => {
    vi.stubGlobal('document', { cookie: '__Host-cxl_csrf=tok' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, data: { version: 1, ideas: [idea('a', 'waiting', null)] } }) });
    vi.stubGlobal('fetch', fetchMock);
    await expect(sendIdeaOp({ op: 'add', text: 'x' })).resolves.toHaveLength(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/cxl/collab-progress?store=ideas');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', headers: { 'X-CXL-CSRF': 'tok' } });
  });

  it('explains being offline in Thai instead of "Failed to fetch"', async () => {
    vi.stubGlobal('document', { cookie: '__Host-cxl_csrf=tok' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(sendIdeaOp({ op: 'add', text: 'x' })).rejects.toThrow('เชื่อมต่ออินเทอร์เน็ตไม่ได้ — ไอเดียยังไม่ถูกบันทึก ข้อความยังอยู่ในช่อง ลองอีกครั้ง');
    await expect(fetchIdeas()).rejects.toThrow('เชื่อมต่ออินเทอร์เน็ตไม่ได้');
  });

  it('keeps text typed while the previous idea was saving', () => {
    expect(draftAfterSave('ไอเดีย A', 'ไอเดีย A')).toBe('');
    expect(draftAfterSave('ไอเดีย A\nไอเดีย B ที่พิมพ์ต่อ', 'ไอเดีย A')).toBe('ไอเดีย A\nไอเดีย B ที่พิมพ์ต่อ');
  });

  it('explains an expired login in Thai', async () => {
    vi.stubGlobal('document', { cookie: '__Host-cxl_csrf=tok' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ ok: false }) }));
    await expect(sendIdeaOp({ op: 'add', text: 'x' })).rejects.toThrow(OWNER_SESSION_EXPIRED_MESSAGE);
  });
});
