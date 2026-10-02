import { generateKeyPairSync, sign as signBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import login from '../../../../api/cxl/auth/login';
import callback from '../../../../api/cxl/auth/callback';
import session from '../../../../api/cxl/auth/session';
import logout from '../../../../api/cxl/auth/logout';
import { OWNER_OIDC_TRANSACTION_COOKIE, verifyOidcTransactionToken, createOwnerSessionToken } from '../../../../src/server/cxlOwnerAuth';

const secret = 'session-secret-that-is-at-least-32-characters-long';
const allowedSub = 'google-owner-subject-123456789';
const legacyOwnerId = 'legacy-private-owner-key';
const publicCreatorId = 'cxlc_0123456789abcdef0123456789abcdef';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = publicKey.export({ format: 'jwk' });

function response() {
  return { statusCode: 200, headers: {} as Record<string, string | string[]>, body: '',
    setHeader(name: string, value: string | string[]) { this.headers[name] = value; },
    end(value = '') { this.body = value; } };
}
function signedIdentity(nonce: string, sub = allowedSub) {
  const now = Math.floor(Date.now() / 1000);
  const enc = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = enc({ alg: 'RS256', kid: 'handler-key', typ: 'JWT' });
  const payload = enc({ iss: 'https://accounts.google.com', aud: 'google-client-id', sub, exp: now + 300, iat: now,
    nonce, email: 'owner@example.invalid', email_verified: true });
  const data = `${header}.${payload}`;
  return `${data}.${signBytes('RSA-SHA256', Buffer.from(data), privateKey).toString('base64url')}`;
}

describe('Vercel Owner auth handlers', () => {
  beforeEach(() => {
    vi.stubEnv('CXL_OWNER_AUTH_BACKEND', 'vercel');
    vi.stubEnv('GOOGLE_OIDC_CLIENT_ID', 'google-client-id');
    vi.stubEnv('GOOGLE_OIDC_CLIENT_SECRET', 'server-only-google-client-secret');
    vi.stubEnv('CXL_OWNER_GOOGLE_SUB', allowedSub);
    vi.stubEnv('CXL_OWNER_SESSION_SECRET', secret);
    vi.stubEnv('CXL_OWNER_OIDC_REDIRECT_URI', 'https://cxl.example/api/cxl/auth/callback');
    vi.stubEnv('CXL_OWNER_APP_ORIGIN', 'https://cxl.example');
    vi.stubEnv('CXL_OWNER_USER_ID', legacyOwnerId);
    vi.stubEnv('CXL_OWNER_PUBLIC_CREATOR_ID', publicCreatorId);
    vi.stubEnv('CXL_OWNER_PROFILE_SLUG', 'juoncxl');
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('starts only the fixed Google OIDC redirect with secure transaction cookie and ignores arbitrary redirect input', () => {
    const res = response();
    login({ method: 'GET', url: '/api/cxl/auth/login?next=https://attacker.invalid' } as any, res as any);
    const location = new URL(String(res.headers.Location));
    expect(res.statusCode).toBe(302);
    expect(location.origin).toBe('https://accounts.google.com');
    expect(location.searchParams.get('redirect_uri')).toBe('https://cxl.example/api/cxl/auth/callback');
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    expect(location.searchParams.get('state')).toHaveLength(43);
    expect(String(res.headers['Set-Cookie'])).toContain('Secure');
    expect(String(res.headers['Set-Cookie'])).toContain('HttpOnly');
  });

  it('validates state/nonce/PKCE callback then sets signed Owner and CSRF cookies', async () => {
    const start = response();
    login({ method: 'GET', url: '/api/cxl/auth/login' } as any, start as any);
    const location = new URL(String(start.headers.Location));
    const transactionCookie = String(start.headers['Set-Cookie']).split(';')[0];
    const tx = verifyOidcTransactionToken(transactionCookie.slice(`${OWNER_OIDC_TRANSACTION_COOKIE}=`.length), secret);
    expect(tx).not.toBeNull();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id_token: signedIdentity(tx!.nonce) }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ keys: [{ ...publicJwk, kid: 'handler-key', alg: 'RS256', use: 'sig' }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const res = response();
    await callback({ method: 'GET', url: `/api/cxl/auth/callback?code=oauth-code&state=${location.searchParams.get('state')}`,
      headers: { cookie: transactionCookie } } as any, res as any);
    expect(res.statusCode).toBe(302);
    expect(res.headers.Location).toBe('https://cxl.example');
    const cookies = res.headers['Set-Cookie'] as string[];
    expect(cookies.some(value => value.startsWith('__Host-cxl_owner=') && value.includes('HttpOnly') && value.includes('Secure'))).toBe(true);
    expect(cookies.some(value => value.startsWith('__Host-cxl_csrf=') && !value.includes('HttpOnly'))).toBe(true);
    expect(String(fetchMock.mock.calls[0][1].body)).toContain(tx!.codeVerifier);
  });

  it('rejects a callback for a different Google subject without issuing an Owner session', async () => {
    const start = response();
    login({ method: 'GET', url: '/api/cxl/auth/login' } as any, start as any);
    const location = new URL(String(start.headers.Location));
    const transactionCookie = String(start.headers['Set-Cookie']).split(';')[0];
    const tx = verifyOidcTransactionToken(transactionCookie.slice(`${OWNER_OIDC_TRANSACTION_COOKIE}=`.length), secret)!;
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id_token: signedIdentity(tx.nonce, 'other-google-subject-123456789') }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ keys: [{ ...publicJwk, kid: 'handler-key', alg: 'RS256', use: 'sig' }] }), { status: 200 })));
    const res = response();
    await callback({ method: 'GET', url: `/api/cxl/auth/callback?code=oauth-code&state=${location.searchParams.get('state')}`,
      headers: { cookie: transactionCookie } } as any, res as any);
    expect(res.statusCode).toBe(302);
    const cookies = Array.isArray(res.headers['Set-Cookie']) ? res.headers['Set-Cookie'] as string[] : [String(res.headers['Set-Cookie'])];
    expect(cookies.some(value => value.startsWith('__Host-cxl_owner='))).toBe(false);
  });

  it('rejects mismatched OIDC state before exchanging the authorization code', async () => {
    const start = response();
    login({ method: 'GET', url: '/api/cxl/auth/login' } as any, start as any);
    const transactionCookie = String(start.headers['Set-Cookie']).split(';')[0];
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = response();
    await callback({ method: 'GET', url: '/api/cxl/auth/callback?code=oauth-code&state=wrong-state',
      headers: { cookie: transactionCookie } } as any, res as any);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(302);
    const cookies = Array.isArray(res.headers['Set-Cookie']) ? res.headers['Set-Cookie'] as string[] : [String(res.headers['Set-Cookie'])];
    expect(cookies.some(value => value.startsWith('__Host-cxl_owner='))).toBe(false);
  });

  it('restores stable Owner identity without waiting for Public GAS profile enrichment', async () => {
    const token = createOwnerSessionToken(allowedSub, 'owner@example.invalid', secret).token;
    const fetchMock = vi.fn().mockRejectedValue(new Error('Public GAS unavailable'));
    vi.stubGlobal('fetch', fetchMock);
    const res = response();
    await session({ method: 'GET', headers: { cookie: `__Host-cxl_owner=${token}` } } as any, res as any);
    const payload = JSON.parse(res.body);
    expect(payload).toMatchObject({ ok: true, authenticated: true, user: {
      id: legacyOwnerId, publicCreatorId, displayName: 'Juon', username: 'juoncxl', provider: 'google'
    } });
    expect(payload.user.internalProfileId).toBeUndefined();
    expect(payload.user.email).toBeUndefined();
    expect(payload.user.avatarUrl).toBeUndefined();
    expect(payload.user.socialLinks).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();

    const profileSuccessFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', profileSuccessFetch);
    const profileAvailable = response();
    await session({ method: 'GET', headers: { cookie: `__Host-cxl_owner=${token}` } } as any, profileAvailable as any);
    expect(JSON.parse(profileAvailable.body).user).toMatchObject({ username: 'juoncxl', displayName: 'Juon' });
    expect(profileSuccessFetch).not.toHaveBeenCalled();

    const denied = response();
    logout({ method: 'POST', headers: { origin: 'https://evil.example', cookie: '__Host-cxl_csrf=csrf' } } as any, denied as any);
    expect(denied.statusCode).toBe(403);
    const loggedOut = response();
    logout({ method: 'POST', headers: { origin: 'https://cxl.example', cookie: '__Host-cxl_csrf=csrf', 'x-cxl-csrf': 'csrf' } } as any, loggedOut as any);
    expect(loggedOut.statusCode).toBe(200);
    expect(String(loggedOut.headers['Set-Cookie'])).toContain('Max-Age=0');
  });

  it('renews an Owner session older than a day and restores a missing CSRF cookie', async () => {
    const twoDaysAgo = Math.floor(Date.now() / 1000) - 2 * 24 * 60 * 60;
    const old = createOwnerSessionToken(allowedSub, undefined, secret, twoDaysAgo).token;
    const res = response();
    await session({ method: 'GET', headers: { cookie: `__Host-cxl_owner=${old}` } } as any, res as any);
    const cookies = ([] as string[]).concat(res.headers['Set-Cookie'] as string | string[]);
    expect(JSON.parse(res.body)).toMatchObject({ authenticated: true });
    expect(cookies.some(cookie => cookie.startsWith('__Host-cxl_owner=') && !cookie.includes(old) && cookie.includes('HttpOnly'))).toBe(true);
    expect(cookies.some(cookie => cookie.startsWith('__Host-cxl_csrf=') && !cookie.includes('HttpOnly'))).toBe(true);

    const fresh = createOwnerSessionToken(allowedSub, undefined, secret).token;
    const kept = response();
    await session({ method: 'GET', headers: { cookie: `__Host-cxl_owner=${fresh}; __Host-cxl_csrf=existing` } } as any, kept as any);
    expect(kept.headers['Set-Cookie']).toBeUndefined();
    expect(JSON.parse(kept.body).csrfToken).toBe('existing');
  });

  it('keeps unauthenticated visitors anonymous without a profile lookup', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = response();
    await session({ method: 'GET', headers: { cookie: '' } } as any, res as any);
    expect(JSON.parse(res.body)).toMatchObject({ ok: true, authenticated: false, user: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
