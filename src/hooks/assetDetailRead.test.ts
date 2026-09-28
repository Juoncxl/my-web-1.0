import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { Asset } from '../types';
import { hydrateAssetDetailInBackground, isCurrentDetailOpen, loadAssetDetailWithBoundedRetry, openAssetDetailImmediately, shouldRetryOwnerDetailRead } from './assetDetailRead';

const useAssetDataSource = readFileSync(new URL('./useAssetData.ts', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const detailModalSource = readFileSync(new URL('../components/WorkDetailModal.tsx', import.meta.url), 'utf8');

function hydrationHarness(assetId: string, sequence: { current: number }, load: (id: string) => Promise<Asset | null>, scope = { current: 'owner-scope' }) {
  const state: Array<{ assetId: string; status: 'loading' | 'error' } | null> = [];
  const onOpen = vi.fn();
  const onRecent = vi.fn();
  let pending = Promise.resolve();
  openAssetDetailImmediately(assetId, onOpen, onRecent, id => {
    pending = hydrateAssetDetailInBackground({ assetId: id, sequence, scopeKey: scope.current,
      getCurrentScopeKey: () => scope.current, load, setState: value => state.push(value), clearState: () => state.push(null) });
  });
  return { pending, state, onOpen, onRecent };
}

function work(id: string): Asset {
  return { id, title: id } as Asset;
}

describe('Owner full Work detail recovery', () => {
  it('opens and tracks the summary synchronously before the full detail request resolves', async () => {
    let resolve!: (asset: Asset) => void;
    const load = vi.fn(() => new Promise<Asset>(done => { resolve = done; }));
    const sequence = { current: 0 };
    const harness = hydrationHarness('work-a', sequence, load);
    expect(harness.onOpen).toHaveBeenCalledOnce();
    expect(harness.onRecent).toHaveBeenCalledOnce();
    expect(load).toHaveBeenCalledOnce();
    expect(harness.state).toEqual([{ assetId: 'work-a', status: 'loading' }]);
    const detail = work('work-a');
    resolve(detail);
    await harness.pending;
    expect(harness.state).toEqual([{ assetId: 'work-a', status: 'loading' }, null]);
    expect(harness.onOpen).toHaveBeenCalledOnce();
  });

  it('does not let Work A resolve over a newer Work B open', async () => {
    const sequence = { current: 0 };
    let resolveA!: (asset: Asset) => void;
    const statesA: unknown[] = [];
    const pendingA = hydrateAssetDetailInBackground({ assetId: 'work-a', sequence, scopeKey: 'owner', getCurrentScopeKey: () => 'owner',
      load: () => new Promise<Asset>(resolve => { resolveA = resolve; }), setState: value => statesA.push(value), clearState: () => statesA.push(null) });
    const statesB: unknown[] = [];
    await hydrateAssetDetailInBackground({ assetId: 'work-b', sequence, scopeKey: 'owner', getCurrentScopeKey: () => 'owner',
      load: async () => work('work-b'), setState: value => statesB.push(value), clearState: () => statesB.push(null) });
    resolveA(work('work-a'));
    await pendingA;
    expect(statesA).toEqual([{ assetId: 'work-a', status: 'loading' }]);
    expect(statesB).toEqual([{ assetId: 'work-b', status: 'loading' }, null]);
  });

  it('ignores detail completion after auth/read scope changes', async () => {
    const sequence = { current: 0 };
    const scope = { current: 'owner-a' };
    let resolve!: (asset: Asset) => void;
    const state: unknown[] = [];
    const pending = hydrateAssetDetailInBackground({ assetId: 'work-a', sequence, scopeKey: scope.current,
      getCurrentScopeKey: () => scope.current, load: () => new Promise<Asset>(done => { resolve = done; }),
      setState: value => state.push(value), clearState: () => state.push(null) });
    scope.current = 'owner-b';
    resolve(work('work-a'));
    await pending;
    expect(state).toEqual([{ assetId: 'work-a', status: 'loading' }]);
  });

  it('keeps the summary modal available after hydration failure and supports a new retry', async () => {
    const sequence = { current: 0 };
    const states: unknown[] = [];
    const load = vi.fn().mockRejectedValueOnce(new Error('private upstream details')).mockResolvedValueOnce(work('work-a'));
    const options = { assetId: 'work-a', sequence, scopeKey: 'owner', getCurrentScopeKey: () => 'owner', load,
      setState: (value: unknown) => states.push(value), clearState: () => states.push(null) };
    await hydrateAssetDetailInBackground(options);
    expect(states).toEqual([{ assetId: 'work-a', status: 'loading' }, { assetId: 'work-a', status: 'error' }]);
    await hydrateAssetDetailInBackground(options);
    expect(states.at(-1)).toBeNull();
    expect(load).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(states)).not.toContain('private upstream details');
    expect(appSource).toContain('detailHydration?.assetId === viewingAsset.id');
    expect(detailModalSource).toContain('detailHydration.onRetry');
  });

  it('does not reopen the modal when a pending detail request finishes after close', async () => {
    let resolve!: (asset: Asset) => void;
    const open = vi.fn();
    const close = vi.fn();
    const sequence = { current: 0 };
    const pending = Promise.resolve();
    let hydration!: Promise<void>;
    openAssetDetailImmediately('work-a', open, vi.fn(), assetId => {
      hydration = hydrateAssetDetailInBackground({ assetId, sequence, scopeKey: 'owner', getCurrentScopeKey: () => 'owner',
        load: () => new Promise<Asset>(done => { resolve = done; }), setState: vi.fn(), clearState: vi.fn() });
    });
    close();
    resolve(work('work-a'));
    await hydration;
    expect(open).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it('keeps one canonical summary/detail modal and a direct full Work route', () => {
    expect(appSource).toContain('void hydrateAssetDetailInBackground<Asset>');
    expect(appSource).toContain('openAssetDetailImmediately(asset.id, openAssetView, trackRecentlyViewed, hydrateDetail)');
    expect(appSource).toContain('onRetry: () => hydrateDetail(viewingAsset.id)');
    expect(appSource).toContain('data-work-detail-loading-shell');
    expect(appSource).toContain('{cover ? <img src={cover}');
    expect(appSource).toContain('{asset.authorName ||');
    expect(appSource).toContain("detail: 'full', limit: 1");
    expect(appSource).toContain('if (assets.some(asset => asset.id === workId)) openAssetView(workId)');
    expect(detailModalSource).toContain('data-work-detail-presentation="canonical"');
    expect(detailModalSource).toContain('data-work-detail-section="main-content-loading"');
    expect(useAssetDataSource).toContain('asset => asset.id === detailedAsset.id ? detailedAsset : asset');
    expect(useAssetDataSource).toContain('options?.suppressError ? () => undefined : reportError');
  });

  it('does not open a stale detail selection after another Work or scope becomes current', () => {
    const requestA = { sequence: 1, scopeKey: 'owner-a' };
    expect(isCurrentDetailOpen(requestA, 2, 'owner-a')).toBe(false);
    expect(isCurrentDetailOpen(requestA, 1, 'owner-b')).toBe(false);
    expect(isCurrentDetailOpen(requestA, 1, 'owner-a')).toBe(true);
  });

  it('retries one Owner 504 and returns/commits detail without requiring another user action', async () => {
    const sequence = { current: 0 };
    const detail = work('work-a');
    const read = vi.fn()
      .mockResolvedValueOnce({ data: [], error: 'HTTP 504 Gateway Timeout' })
      .mockResolvedValueOnce({ data: [detail], error: null });
    const committed: Asset[] = [];
    const result = await loadAssetDetailWithBoundedRetry({
      sequence,
      isScopeCurrent: () => true,
      retryOwnerTransient: true,
      read,
      reportError: vi.fn(),
      commit: asset => committed.push(asset),
      delayMs: 0
    });
    expect(read).toHaveBeenCalledTimes(2);
    expect(result).toBe(detail);
    expect(committed).toEqual([detail]);
  });

  it('does not retry deterministic detail errors', async () => {
    const read = vi.fn().mockResolvedValue({ data: [], error: 'HTTP 404 Work not found' });
    const reportError = vi.fn();
    const result = await loadAssetDetailWithBoundedRetry({
      sequence: { current: 0 },
      isScopeCurrent: () => true,
      retryOwnerTransient: true,
      read,
      reportError,
      commit: vi.fn(),
      delayMs: 0
    });
    expect(result).toBeNull();
    expect(read).toHaveBeenCalledOnce();
    expect(reportError).toHaveBeenCalledWith('HTTP 404 Work not found');
  });

  it('prevents an in-flight Work A retry from committing after Work B is selected', async () => {
    const sequence = { current: 0 };
    let resolveRetry!: (value: { data: Asset[]; error: null }) => void;
    let retryStarted!: () => void;
    const secondReadStarted = new Promise<void>(resolve => { retryStarted = resolve; });
    const readA = vi.fn()
      .mockResolvedValueOnce({ data: [], error: 'HTTP 504 Gateway Timeout' })
      .mockImplementationOnce(() => {
        retryStarted();
        return new Promise(resolve => { resolveRetry = resolve; });
      });
    const committed: string[] = [];
    const pendingA = loadAssetDetailWithBoundedRetry({
      sequence, isScopeCurrent: () => true, retryOwnerTransient: true, read: readA,
      reportError: vi.fn(), commit: asset => committed.push(asset.id), delayMs: 0
    });
    await secondReadStarted;

    const workB = work('work-b');
    const resultB = await loadAssetDetailWithBoundedRetry({
      sequence, isScopeCurrent: () => true, retryOwnerTransient: true,
      read: vi.fn().mockResolvedValue({ data: [workB], error: null }),
      reportError: vi.fn(), commit: asset => committed.push(asset.id), delayMs: 0
    });
    resolveRetry({ data: [work('work-a')], error: null });
    await expect(pendingA).resolves.toBeNull();
    expect(resultB?.id).toBe('work-b');
    expect(committed).toEqual(['work-b']);
  });

  it('prevents a detail retry from committing after the authenticated scope changes', async () => {
    const sequence = { current: 0 };
    let scope = 'owner-a';
    let resolveRetry!: (value: { data: Asset[]; error: null }) => void;
    let retryStarted!: () => void;
    const secondReadStarted = new Promise<void>(resolve => { retryStarted = resolve; });
    const read = vi.fn()
      .mockResolvedValueOnce({ data: [], error: 'HTTP 504 Gateway Timeout' })
      .mockImplementationOnce(() => {
        retryStarted();
        return new Promise(resolve => { resolveRetry = resolve; });
      });
    const committed: Asset[] = [];
    const pending = loadAssetDetailWithBoundedRetry({
      sequence, isScopeCurrent: () => scope === 'owner-a', retryOwnerTransient: true, read,
      reportError: vi.fn(), commit: asset => committed.push(asset), delayMs: 0
    });
    await secondReadStarted;
    scope = 'owner-b';
    resolveRetry({ data: [work('stale-owner-work')], error: null });
    await expect(pending).resolves.toBeNull();
    expect(committed).toEqual([]);
  });

  it('keeps public visitor detail as a single read and gates retry to authenticated Vercel Owner scope', async () => {
    const read = vi.fn().mockResolvedValue({ data: [], error: 'HTTP 504 Gateway Timeout' });
    const result = await loadAssetDetailWithBoundedRetry({
      sequence: { current: 0 }, isScopeCurrent: () => true, retryOwnerTransient: false, read,
      reportError: vi.fn(), commit: vi.fn(), delayMs: 0
    });
    expect(result).toBeNull();
    expect(read).toHaveBeenCalledOnce();
    expect(shouldRetryOwnerDetailRead({ vercelOwnerAuth: true })).toBe(false);
    expect(shouldRetryOwnerDetailRead({ vercelOwnerAuth: true, currentUserId: 'owner', publicOnly: true })).toBe(false);
    expect(shouldRetryOwnerDetailRead({ vercelOwnerAuth: true, currentUserId: 'owner', creatorSlug: 'another-creator' })).toBe(false);
    expect(shouldRetryOwnerDetailRead({ vercelOwnerAuth: true, currentUserId: 'owner', creatorSlug: 'juoncxl', scopedUserId: 'owner' })).toBe(true);
    expect(shouldRetryOwnerDetailRead({ vercelOwnerAuth: true, currentUserId: 'owner' })).toBe(true);
    expect(useAssetDataSource).toContain('retryOwnerTransient: shouldRetryOwnerDetailRead({');
    expect(useAssetDataSource).toContain('readLifecycle.current.isCurrent(ticket)');
  });
});
