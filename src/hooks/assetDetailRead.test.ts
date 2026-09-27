import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { Asset } from '../types';
import { isCurrentDetailOpen, loadAssetDetailWithBoundedRetry, shouldRetryOwnerDetailRead } from './assetDetailRead';

const useAssetDataSource = readFileSync(new URL('./useAssetData.ts', import.meta.url), 'utf8');

function work(id: string): Asset {
  return { id, title: id } as Asset;
}

describe('Owner full Work detail recovery', () => {
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
