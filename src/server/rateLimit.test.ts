import { afterEach, describe, expect, it } from 'vitest';
import { clientIp, rateLimitRetryAfter, resetRateLimitsForTests } from './rateLimit';

afterEach(() => resetRateLimitsForTests());

describe('rateLimitRetryAfter', () => {
  const rule = { limit: 3, windowMs: 60_000 };

  it('allows requests up to the limit, then asks the client to wait', () => {
    expect([1, 2, 3].map(() => rateLimitRetryAfter('ip-a', rule, 1_000))).toEqual([0, 0, 0]);
    expect(rateLimitRetryAfter('ip-a', rule, 1_000)).toBe(60);
    expect(rateLimitRetryAfter('ip-b', rule, 1_000)).toBe(0);
  });

  it('starts a fresh window once the old one ends', () => {
    for (let i = 0; i < 4; i += 1) rateLimitRetryAfter('ip-a', rule, 1_000);
    expect(rateLimitRetryAfter('ip-a', rule, 61_000)).toBe(0);
  });
});

describe('clientIp', () => {
  it('prefers the platform client address headers', () => {
    expect(clientIp({ headers: { 'x-real-ip': '203.0.113.9', 'x-forwarded-for': '198.51.100.1' } } as never)).toBe('203.0.113.9');
    expect(clientIp({ headers: { 'x-forwarded-for': '198.51.100.1, 10.0.0.1' } } as never)).toBe('198.51.100.1');
  });
});
