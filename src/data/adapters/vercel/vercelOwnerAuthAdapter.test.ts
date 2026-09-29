import { afterEach, describe, expect, it, vi } from 'vitest';
import { vercelOwnerAuthAdapter } from './vercelOwnerAuthAdapter';

describe('Vercel Owner auth adapter', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('restores a server-verified session without accessing Supabase Auth', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, authenticated: true, user: {
      id: 'legacy-owner-key', publicCreatorId: 'cxlc_0123456789abcdef0123456789abcdef', displayName: 'Owner', createdAt: '2026-01-01T00:00:00.000Z'
    } }) });
    vi.stubGlobal('fetch', fetchMock);
    let current: any = null;
    let loading = false;
    const bootstrap = vercelOwnerAuthAdapter.createSessionBootstrap({ setCurrentUser: user => { current = user; }, setLoading: value => { loading = value; } });
    await bootstrap.ready;
    expect(fetchMock.mock.calls[0][0]).toBe('/api/cxl/auth/session');
    expect(fetchMock.mock.calls[0][1].credentials).toBe('same-origin');
    expect(current).toMatchObject({ id: 'legacy-owner-key', publicCreatorId: 'cxlc_0123456789abcdef0123456789abcdef' });
    expect(loading).toBe(false);
    bootstrap.dispose();
  });

  it('posts logout with same-origin cookies and synchronizer CSRF token', async () => {
    vi.stubGlobal('document', { cookie: '__Host-cxl_csrf=csrf-token' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const result = await vercelOwnerAuthAdapter.signOutLocal();
    expect(result.error).toBeNull();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/cxl/auth/logout');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', credentials: 'same-origin', headers: { 'X-CXL-CSRF': 'csrf-token' } });
  });
});
