import {
  createHash,
  createHmac,
  createPublicKey,
  randomBytes,
  timingSafeEqual,
  verify as verifySignature
} from 'node:crypto';

export const OWNER_SESSION_COOKIE = '__Host-cxl_owner';
export const OWNER_OIDC_TRANSACTION_COOKIE = '__Host-cxl_oidc_tx';
export const OWNER_CSRF_COOKIE = '__Host-cxl_csrf';
export const OWNER_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
/** A session older than this is re-issued (sliding) when the Owner's browser checks it. */
export const OWNER_SESSION_RENEW_AFTER_SECONDS = 24 * 60 * 60;
export const OWNER_OIDC_TRANSACTION_TTL_SECONDS = 10 * 60;
const GOOGLE_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

export type OwnerAuthEnvironment = Record<string, string | undefined>;
export type OwnerAuthMode = 'supabase' | 'vercel';

export interface OwnerAuthConfig {
  clientId: string;
  clientSecret: string;
  allowedSub: string;
  sessionSecret: string;
  redirectUri: string;
  appOrigin: string;
  legacyOwnerId: string;
  publicCreatorId: string;
  ownerProfileSlug: string;
}

export interface OwnerSessionClaims {
  sub: string;
  email?: string;
  iat: number;
  exp: number;
  v: 1;
}

export interface OidcTransactionClaims {
  state: string;
  nonce: string;
  codeVerifier: string;
  iat: number;
  exp: number;
  v: 1;
}

export interface GoogleIdTokenClaims {
  iss?: unknown;
  aud?: unknown;
  sub?: unknown;
  exp?: unknown;
  iat?: unknown;
  nonce?: unknown;
  email?: unknown;
  email_verified?: unknown;
  azp?: unknown;
}

export function selectOwnerAuthMode(value: unknown): OwnerAuthMode {
  return String(value || '').trim().toLowerCase() === 'vercel' ? 'vercel' : 'supabase';
}

export function getOwnerAuthConfig(env: OwnerAuthEnvironment = process.env): OwnerAuthConfig | null {
  const clientId = env.GOOGLE_OIDC_CLIENT_ID?.trim() || '';
  const clientSecret = env.GOOGLE_OIDC_CLIENT_SECRET?.trim() || '';
  const allowedSub = env.CXL_OWNER_GOOGLE_SUB?.trim() || '';
  const sessionSecret = env.CXL_OWNER_SESSION_SECRET || '';
  const redirectUri = env.CXL_OWNER_OIDC_REDIRECT_URI?.trim() || '';
  const appOrigin = env.CXL_OWNER_APP_ORIGIN?.trim() || '';
  const legacyOwnerId = env.CXL_OWNER_USER_ID?.trim() || '';
  const publicCreatorId = env.CXL_OWNER_PUBLIC_CREATOR_ID?.trim() || '';
  // This is a public route identity, not an authorization input. Keep a
  // configured override while preserving the established canonical route
  // when older Preview environments have not set the optional variable yet.
  const rawOwnerProfileSlug = env.CXL_OWNER_PROFILE_SLUG;
  const ownerProfileSlug = rawOwnerProfileSlug === undefined || rawOwnerProfileSlug.trim() === ''
    ? 'juoncxl'
    : rawOwnerProfileSlug.trim().replace(/^@+/, '').toLowerCase();

  if (!clientId || !clientSecret || !/^[A-Za-z0-9_-]{20,}$/.test(allowedSub) || sessionSecret.length < 32
    || !legacyOwnerId || !/^cxlc_[a-f0-9]{32}$/i.test(publicCreatorId)
    || !/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(ownerProfileSlug)) return null;
  try {
    const app = new URL(appOrigin);
    const callback = new URL(redirectUri);
    if (app.protocol !== 'https:' || app.origin !== appOrigin || app.pathname !== '/' || app.search || app.hash) return null;
    if (callback.protocol !== 'https:' || callback.origin !== app.origin || callback.pathname !== '/api/cxl/auth/callback' || callback.search || callback.hash) return null;
  } catch { return null; }

  return { clientId, clientSecret, allowedSub, sessionSecret, redirectUri, appOrigin, legacyOwnerId, publicCreatorId, ownerProfileSlug };
}

function base64url(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function signClaims(claims: object, secret: string, purpose: 'session' | 'transaction'): string {
  const payload = base64url(JSON.stringify(claims));
  const signature = createHmac('sha256', secret).update(`${purpose}.${payload}`).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyClaims<T extends { iat: number; exp: number; v: number }>(
  token: string | undefined,
  secret: string,
  purpose: 'session' | 'transaction',
  nowSeconds = Math.floor(Date.now() / 1000)
): T | null {
  if (!token || token.length > 4096) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;
  const expected = createHmac('sha256', secret).update(`${purpose}.${payload}`).digest('base64url');
  if (!safeEqual(signature, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as T;
    if (!claims || !Number.isInteger(claims.iat) || !Number.isInteger(claims.exp) || claims.v !== 1
      || claims.iat > nowSeconds + 60 || claims.exp <= nowSeconds || claims.exp <= claims.iat) return null;
    return claims;
  } catch { return null; }
}

export function createOwnerSessionToken(
  sub: string,
  email: string | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): { token: string; claims: OwnerSessionClaims } {
  const claims: OwnerSessionClaims = {
    sub,
    ...(email ? { email } : {}),
    iat: nowSeconds,
    exp: nowSeconds + OWNER_SESSION_TTL_SECONDS,
    v: 1
  };
  return { token: signClaims(claims, secret, 'session'), claims };
}

export function verifyOwnerSessionToken(
  token: string | undefined,
  env: OwnerAuthEnvironment = process.env,
  nowSeconds = Math.floor(Date.now() / 1000)
): OwnerSessionClaims | null {
  const secret = env.CXL_OWNER_SESSION_SECRET || '';
  const allowedSub = env.CXL_OWNER_GOOGLE_SUB?.trim() || '';
  if (secret.length < 32 || !allowedSub) return null;
  const claims = verifyClaims<OwnerSessionClaims>(token, secret, 'session', nowSeconds);
  if (!claims || claims.sub !== allowedSub || claims.exp - claims.iat > OWNER_SESSION_TTL_SECONDS) return null;
  return claims;
}

export function createOidcTransactionToken(
  state: string,
  nonce: string,
  codeVerifier: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): string {
  return signClaims({ state, nonce, codeVerifier, iat: nowSeconds,
    exp: nowSeconds + OWNER_OIDC_TRANSACTION_TTL_SECONDS, v: 1 } satisfies OidcTransactionClaims, secret, 'transaction');
}

export function verifyOidcTransactionToken(
  token: string | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): OidcTransactionClaims | null {
  const claims = verifyClaims<OidcTransactionClaims>(token, secret, 'transaction', nowSeconds);
  if (!claims || claims.exp - claims.iat > OWNER_OIDC_TRANSACTION_TTL_SECONDS
    || typeof claims.state !== 'string' || claims.state.length < 32
    || typeof claims.nonce !== 'string' || claims.nonce.length < 32
    || typeof claims.codeVerifier !== 'string' || claims.codeVerifier.length < 43) return null;
  return claims;
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  (header || '').split(';').forEach(part => {
    const separator = part.indexOf('=');
    if (separator <= 0) return;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name && value) cookies[name] = value;
  });
  return cookies;
}

export function cookieValue(header: string | undefined, name: string): string | undefined {
  return parseCookies(header)[name];
}

export function makeSecureCookie(name: string, value: string, maxAgeSeconds: number, httpOnly = true): string {
  return `${name}=${value}; Path=/; Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}; Secure; SameSite=Lax${httpOnly ? '; HttpOnly' : ''}`;
}

export function clearSecureCookie(name: string, httpOnly = true): string {
  return `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Lax${httpOnly ? '; HttpOnly' : ''}`;
}

export function createRandomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function createPkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function constantTimeEqual(left: string, right: string): boolean {
  return safeEqual(left, right);
}

export function validateGoogleIdToken(
  token: string,
  config: Pick<OwnerAuthConfig, 'clientId' | 'allowedSub'>,
  expectedNonce: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  fetcher: typeof fetch = fetch
): Promise<GoogleIdTokenClaims> {
  return (async () => {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Google identity token is malformed');
    let header: { alg?: unknown; kid?: unknown };
    let claims: GoogleIdTokenClaims;
    try {
      header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch { throw new Error('Google identity token is malformed'); }
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error('Google identity token algorithm is not allowed');
    const response = await fetcher(GOOGLE_JWKS_URL, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('Google identity keys are unavailable');
    const jwks = await response.json() as { keys?: Array<JsonWebKey & { kid?: string; alg?: string; use?: string }> };
    const jwk = jwks.keys?.find(key => key.kid === header.kid && (!key.alg || key.alg === 'RS256') && (!key.use || key.use === 'sig'));
    if (!jwk) throw new Error('Google identity signing key was not found');
    const publicKey = createPublicKey({ key: jwk as any, format: 'jwk' });
    const validSignature = verifySignature('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, Buffer.from(parts[2], 'base64url'));
    if (!validSignature) throw new Error('Google identity token signature is invalid');
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!GOOGLE_ISSUERS.has(String(claims.iss || '')) || !audiences.includes(config.clientId)
      || typeof claims.exp !== 'number' || claims.exp <= nowSeconds
      || typeof claims.iat !== 'number' || claims.iat > nowSeconds + 60
      || typeof claims.sub !== 'string' || claims.sub !== config.allowedSub
      || typeof claims.nonce !== 'string' || !safeEqual(claims.nonce, expectedNonce)
      || (claims.email_verified !== undefined && claims.email_verified !== true)) {
      throw new Error('Google identity token claims are invalid');
    }
    if (Array.isArray(claims.aud) && claims.aud.length > 1 && claims.azp !== config.clientId) {
      throw new Error('Google identity token authorized party is invalid');
    }
    return claims;
  })();
}

export function makeCsrfToken(): string {
  return createRandomToken(32);
}

export function verifyCsrfRequest(
  origin: string | undefined,
  expectedOrigin: string,
  cookieHeader: string | undefined,
  headerToken: string | undefined
): boolean {
  if (!origin || origin !== expectedOrigin || !headerToken) return false;
  const cookieToken = cookieValue(cookieHeader, '__Host-cxl_csrf');
  return Boolean(cookieToken && constantTimeEqual(cookieToken, headerToken));
}
