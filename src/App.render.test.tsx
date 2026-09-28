import React from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./lib/auth/useAuthSession', () => ({
  useAuthSession: () => ({ currentUser: null, isLoading: false, setCurrentUser: () => undefined, transitionToGuest: () => undefined })
}));

async function renderAppToMarkup(element: React.ReactNode): Promise<string> {
  return new Promise((resolve, reject) => {
    let markup = '';
    let output: PassThrough;
    const stream = renderToPipeableStream(element, {
      onAllReady: () => {
        output = new PassThrough();
        output.setEncoding('utf8');
        output.on('data', chunk => { markup += chunk; });
        output.on('end', () => resolve(markup));
        stream.pipe(output);
      },
      onError: reject
    });
  });
}

function installAnonymousBrowserGlobals() {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined, removeItem: () => undefined });
  vi.stubGlobal('window', {
    location: { pathname: '/', search: '', hash: '', origin: 'https://preview.example' },
    matchMedia: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
    history: { pushState: () => undefined },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    setTimeout,
    clearTimeout
  });
  vi.stubGlobal('document', { addEventListener: () => undefined, removeEventListener: () => undefined });
}

describe('anonymous Google/Vercel application render', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

  it('renders Header and Login without the top-level ErrorBoundary fallback', async () => {
    vi.stubEnv('VITE_CXL_OWNER_AUTH_BACKEND', 'vercel');
    vi.stubEnv('VITE_CXL_WORKS_READ_BACKEND', 'google');
    vi.stubEnv('VITE_CXL_WORKS_WRITE_BACKEND', 'google');
    installAnonymousBrowserGlobals();
    vi.resetModules();

    const { default: App } = await import('./App');
    const markup = await renderAppToMarkup(<App />);

    expect(markup).toContain('<header');
    expect(markup).toContain('aria-label="เมนูผู้เยี่ยมชม"');
    expect(markup).not.toContain('เกิดข้อผิดพลาดชั่วคราวในการแสดงผลส่วนนี้');
  });

  it('renders a card from a successful public Works response', async () => {
    vi.stubEnv('VITE_CXL_OWNER_AUTH_BACKEND', 'vercel');
    vi.stubEnv('VITE_CXL_WORKS_READ_BACKEND', 'google');
    installAnonymousBrowserGlobals();
    vi.resetModules();

    const publicWork = {
      id: 'asset_public', title: 'Public Work renders', authorName: 'Creator', category: 'character',
      icon: { type: 'emoji', value: '✨' }, content: '', contentBlocks: [], previewImage: '', previewImages: [], media: [],
      visibility: 'public', isPublic: true, status: 'finished', tags: [], createdAt: '', updatedAt: '', deletedAt: null
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200,
      json: async () => ({ ok: true, data: { data: [publicWork], error: null } }) }));

    const [{ googleDataAdapter }, { AuthProvider }, { ThemeProvider }, { AssetCard }] = await Promise.all([
      import('./data/adapters/google/googleDataAdapter'),
      import('./context/AuthContext'),
      import('./context/ThemeContext'),
      import('./components/AssetCard')
    ]);
    const result = await googleDataAdapter.works.fetch({ publicOnly: true, detail: 'summary' });
    expect(result.data).toHaveLength(1);
    const markup = await renderAppToMarkup(
      <AuthProvider><ThemeProvider><AssetCard asset={result.data![0]} onClick={() => undefined} /></ThemeProvider></AuthProvider>
    );
    expect(markup).toContain('Public Work renders');
  });

  it.each([
    ['empty snapshot', { ok: true, data: { data: [], error: null } }],
    ['failed snapshot', { ok: false, error: 'snapshot unavailable' }]
  ])('%s leaves the feed in a safe empty result state', async (_label, payload) => {
    vi.stubEnv('VITE_CXL_OWNER_AUTH_BACKEND', 'vercel');
    vi.stubEnv('VITE_CXL_WORKS_READ_BACKEND', 'google');
    installAnonymousBrowserGlobals();
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: payload.ok, status: payload.ok ? 200 : 502,
      json: async () => payload }));
    const { googleDataAdapter } = await import('./data/adapters/google/googleDataAdapter');
    const result = await googleDataAdapter.works.fetch({ publicOnly: true, detail: 'summary' });
    expect(result.data).toEqual([]);
    if (!payload.ok) expect(result.error).toBe('snapshot unavailable');
  });
});

