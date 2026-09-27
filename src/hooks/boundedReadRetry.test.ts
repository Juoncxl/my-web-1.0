import { describe, expect, it, vi } from 'vitest';
import { isTransientReadFailure, readWithBoundedRetry } from './boundedReadRetry';

describe('bounded Owner read recovery', () => {
  it('retries a transient failure once and returns the successful result', async () => {
    const read = vi.fn().mockRejectedValueOnce(Object.assign(new Error('gateway'), { status: 504 })).mockResolvedValue('works');
    await expect(readWithBoundedRetry(read, { enabled: true, isCurrent: () => true, delayMs: 0 })).resolves.toBe('works');
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('does not retry deterministic auth or contract errors', async () => {
    const read = vi.fn().mockRejectedValue(Object.assign(new Error('unauthorized'), { status: 401 }));
    await expect(readWithBoundedRetry(read, { enabled: true, isCurrent: () => true, delayMs: 0 })).rejects.toMatchObject({ status: 401 });
    expect(read).toHaveBeenCalledOnce();
    expect(isTransientReadFailure(Object.assign(new Error('invalid request'), { status: 400 }))).toBe(false);
  });

  it('does not loop after the bounded retry fails', async () => {
    const read = vi.fn().mockRejectedValue(Object.assign(new Error('timeout'), { status: 504 }));
    await expect(readWithBoundedRetry(read, { enabled: true, isCurrent: () => true, delayMs: 0 })).rejects.toMatchObject({ status: 504 });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('does not retry when the request scope becomes stale before recovery', async () => {
    let current = true;
    const read = vi.fn().mockImplementationOnce(async () => {
      current = false;
      return { error: 'HTTP 504 Gateway timeout' };
    }).mockResolvedValue({ data: 'stale' });
    const result = await readWithBoundedRetry(read, { enabled: true, isCurrent: () => current, getError: value => (value as any).error, delayMs: 0 });
    expect(result).toEqual({ error: 'HTTP 504 Gateway timeout' });
    expect(read).toHaveBeenCalledOnce();
  });

  it('can disable recovery for public reads', async () => {
    const read = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(readWithBoundedRetry(read, { enabled: false, isCurrent: () => true, delayMs: 0 })).rejects.toThrow('Failed to fetch');
    expect(read).toHaveBeenCalledOnce();
  });
});
