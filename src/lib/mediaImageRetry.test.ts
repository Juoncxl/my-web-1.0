import { describe, expect, it } from 'vitest';
import { isRetryableMediaSrc, MEDIA_IMAGE_MAX_RETRIES, mediaImageAttemptSrc, mediaImageRetryDelayMs } from './mediaImageRetry';

const SCOPED = '/api/cxl/media?scope=public&workId=asset_x&ref=media%3A123e4567-e89b-42d3-a456-426614174001&v=1';
const LEGACY = '/api/cxl/media?workId=asset_x&ref=media%3Aold';

describe('media image retry', () => {
  it('retries only scoped Work media, never legacy misses or other sources', () => {
    expect(isRetryableMediaSrc(SCOPED)).toBe(true);
    expect(isRetryableMediaSrc(LEGACY)).toBe(false);
    expect(isRetryableMediaSrc('data:image/png;base64,AAAA')).toBe(false);
    expect(isRetryableMediaSrc('https://example.com/a.png?scope=public')).toBe(false);
  });

  it('gives each attempt its own URL and leaves the first load untouched', () => {
    expect(mediaImageAttemptSrc(SCOPED, 0)).toBe(SCOPED);
    expect(mediaImageAttemptSrc(SCOPED, 2)).toBe(`${SCOPED}&retry=2`);
    expect(mediaImageAttemptSrc(LEGACY, 2)).toBe(LEGACY);
  });

  it('waits longer on each attempt with jitter so retries do not burst together', () => {
    expect(MEDIA_IMAGE_MAX_RETRIES).toBe(3);
    expect(mediaImageRetryDelayMs(1, () => 0)).toBe(2_000);
    expect(mediaImageRetryDelayMs(2, () => 0)).toBe(6_000);
    expect(mediaImageRetryDelayMs(3, () => 0)).toBe(15_000);
    expect(mediaImageRetryDelayMs(3, () => 0.999)).toBeLessThan(16_500);
    expect(mediaImageRetryDelayMs(9, () => 0)).toBe(15_000);
  });
});
