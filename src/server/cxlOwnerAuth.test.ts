import { generateKeyPairSync, sign as signBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createOidcTransactionToken, createOwnerSessionToken, createPkceChallenge, makeSecureCookie,
  OWNER_SESSION_TTL_SECONDS, verifyCsrfRequest, verifyOidcTransactionToken,
  verifyOwnerSessionToken, validateGoogleIdToken
} from './cxlOwnerAuth';

const secret = 'session-secret-that-is-at-least-32-characters-long';
const allowedSub = 'google-owner-subject-123456789';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = publicKey.export({ format: 'jwk' });

function makeIdToken(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'RS256', kid: 'test-kid', typ: 'JWT' });
  const payload = encode({ iss: 'https://accounts.google.com', aud: 'test-client-id', sub: allowedSub,
    exp: now + 300, iat: now, nonce: 'expected-nonce', email: 'owner@example.invalid', email_verified: true, ...overrides });
  const content = `${header}.${payload}`;
  return `${content}.${signBytes('RSA-SHA256', Buffer.from(content), privateKey).toString('base64url')}`;
}

const jwksFetch = async () => new Response(JSON.stringify({ keys: [{ ...publicJwk, kid: 'test-kid', alg: 'RS256', use: 'sig' }] }), {
  status: 200, headers: { 'Content-Type': 'application/json' }
});

describe('CXL Vercel Owner auth primitives', () => {
  it('uses signed, absolute-expiry sessions and rejects expired or tampered cookies', () => {
    const now = Math.floor(Date.now() / 1000);
    const { token, claims } = createOwnerSessionToken(allowedSub, 'owner@example.invalid', secret, now);
    const env = { CXL_OWNER_SESSION_SECRET: secret, CXL_OWNER_GOOGLE_SUB: allowedSub };
    expect(claims.exp - claims.iat).toBe(OWNER_SESSION_TTL_SECONDS);
    expect(verifyOwnerSessionToken(token, env, now + 1)?.sub).toBe(allowedSub);
    expect(verifyOwnerSessionToken(token, env, claims.exp)).toBeNull();
    expect(verifyOwnerSessionToken(`${token}x`, env, now + 1)).toBeNull();
  });

  it('signs short-lived OIDC state, nonce, and PKCE transaction material', () => {
    const token = createOidcTransactionToken('s'.repeat(43), 'n'.repeat(43), 'v'.repeat(64), secret);
    expect(verifyOidcTransactionToken(token, secret)?.codeVerifier).toBe('v'.repeat(64));
    expect(verifyOidcTransactionToken(token, 'wrong-session-secret-that-is-long-enough')).toBeNull();
    expect(createPkceChallenge('verifier')).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('validates Google signature and OIDC issuer/audience/expiry/nonce/sub/email_verified', async () => {
    const config = { clientId: 'test-client-id', allowedSub };
    const valid = await validateGoogleIdToken(makeIdToken(), config, 'expected-nonce', undefined, jwksFetch as typeof fetch);
    expect(valid.sub).toBe(allowedSub);
    await expect(validateGoogleIdToken(makeIdToken({ sub: 'other-subject-value-123456789' }), config, 'expected-nonce', undefined, jwksFetch as typeof fetch)).rejects.toThrow();
    await expect(validateGoogleIdToken(makeIdToken({ nonce: 'wrong' }), config, 'expected-nonce', undefined, jwksFetch as typeof fetch)).rejects.toThrow();
    await expect(validateGoogleIdToken(makeIdToken({ email_verified: false }), config, 'expected-nonce', undefined, jwksFetch as typeof fetch)).rejects.toThrow();
    await expect(validateGoogleIdToken(makeIdToken({ exp: 1 }), config, 'expected-nonce', undefined, jwksFetch as typeof fetch)).rejects.toThrow();
    await expect(validateGoogleIdToken(makeIdToken({ iss: 'https://attacker.invalid' }), config, 'expected-nonce', undefined, jwksFetch as typeof fetch)).rejects.toThrow();
    await expect(validateGoogleIdToken(makeIdToken({ aud: 'other-client-id' }), config, 'expected-nonce', undefined, jwksFetch as typeof fetch)).rejects.toThrow();
  });

  it('sets host-only secure cookies and enforces exact-origin synchronizer CSRF', () => {
    const csrf = 'csrf-value';
    expect(makeSecureCookie('__Host-cxl_owner', 'signed', 60)).toContain('Secure');
    expect(makeSecureCookie('__Host-cxl_owner', 'signed', 60)).toContain('HttpOnly');
    expect(makeSecureCookie('__Host-cxl_owner', 'signed', 60)).not.toContain('Domain=');
    const cookie = `__Host-cxl_csrf=${csrf}`;
    expect(verifyCsrfRequest('https://cxl.example', 'https://cxl.example', cookie, csrf)).toBe(true);
    expect(verifyCsrfRequest('https://evil.example', 'https://cxl.example', cookie, csrf)).toBe(false);
    expect(verifyCsrfRequest(undefined, 'https://cxl.example', cookie, csrf)).toBe(false);
    expect(verifyCsrfRequest('https://cxl.example', 'https://cxl.example', cookie, 'wrong')).toBe(false);
  });
});
