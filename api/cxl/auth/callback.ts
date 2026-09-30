import type { IncomingMessage, ServerResponse } from 'node:http';
import { hasOwnerDriveScopes, OWNER_DRIVE_CONNECT_COOKIE, sealRefreshToken, storeOwnerDriveCredential } from '../../../src/server/cxlOwnerDrive.js';
import {
  clearSecureCookie,
  cookieValue,
  createOwnerSessionToken,
  getOwnerAuthConfig,
  makeCsrfToken,
  makeSecureCookie,
  OWNER_CSRF_COOKIE,
  OWNER_OIDC_TRANSACTION_COOKIE,
  OWNER_SESSION_COOKIE,
  OWNER_SESSION_TTL_SECONDS,
  selectOwnerAuthMode,
  validateGoogleIdToken,
  verifyOidcTransactionToken
} from '../../../src/server/cxlOwnerAuth.js';

type Request = IncomingMessage;
type Response = ServerResponse & { json?: (body: unknown) => void };

function completeError(res: Response, origin: string | undefined) {
  res.setHeader('Set-Cookie', clearSecureCookie(OWNER_OIDC_TRANSACTION_COOKIE));
  res.statusCode = 302;
  res.setHeader('Location', origin || '/');
  res.end();
}

export default async function handler(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  if (selectOwnerAuthMode(process.env.CXL_OWNER_AUTH_BACKEND) !== 'vercel') {
    res.statusCode = 404; return res.end();
  }
  if (req.method !== 'GET') {
    res.statusCode = 405; res.setHeader('Allow', 'GET'); return res.end();
  }
  const config = getOwnerAuthConfig();
  if (!config) {
    res.statusCode = 503; res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: 'Owner authentication is not configured' }));
  }
  let callback: URL;
  try { callback = new URL(req.url || '/api/cxl/auth/callback', config.appOrigin); }
  catch { return completeError(res, config.appOrigin); }
  const code = callback.searchParams.get('code') || '';
  const state = callback.searchParams.get('state') || '';
  const transaction = verifyOidcTransactionToken(cookieValue(req.headers.cookie, OWNER_OIDC_TRANSACTION_COOKIE), config.sessionSecret);
  if (!code || code.length > 4096 || !transaction || !state || state !== transaction.state) return completeError(res, config.appOrigin);

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: transaction.codeVerifier
      }),
      signal: AbortSignal.timeout(10_000)
    });
    if (!tokenResponse.ok) return completeError(res, config.appOrigin);
    const tokens = await tokenResponse.json() as { id_token?: unknown; access_token?: unknown; refresh_token?: unknown; scope?: unknown };
    if (typeof tokens.id_token !== 'string' || tokens.id_token.length > 16_384) return completeError(res, config.appOrigin);
    const identity = await validateGoogleIdToken(tokens.id_token, config, transaction.nonce);
    const email = typeof identity.email === 'string' && identity.email_verified === true ? identity.email : undefined;
    const session = createOwnerSessionToken(identity.sub as string, email, config.sessionSecret);
    const csrfToken = makeCsrfToken();

    // Drive connect: identity above is already pinned to the Owner's Google account.
    let driveResult: 'connected' | 'failed' | null = null;
    if (cookieValue(req.headers.cookie, OWNER_DRIVE_CONNECT_COOKIE) === state) {
      driveResult = 'failed';
      const folderId = process.env.CXL_INCOMING_FOLDER_ID?.trim();
      if (folderId && typeof tokens.refresh_token === 'string' && typeof tokens.access_token === 'string' && hasOwnerDriveScopes(tokens.scope)) {
        try {
          await storeOwnerDriveCredential(tokens.access_token, folderId, sealRefreshToken(tokens.refresh_token, config.sessionSecret, email));
          driveResult = 'connected';
        } catch (error) {
          console.info(JSON.stringify({ event: 'cxl_owner_drive_connect_failed', reason: error instanceof Error ? error.message.slice(0, 120) : 'unknown' }));
        }
      }
    }

    res.setHeader('Set-Cookie', [
      clearSecureCookie(OWNER_OIDC_TRANSACTION_COOKIE),
      clearSecureCookie(OWNER_DRIVE_CONNECT_COOKIE),
      makeSecureCookie(OWNER_SESSION_COOKIE, session.token, OWNER_SESSION_TTL_SECONDS),
      makeSecureCookie(OWNER_CSRF_COOKIE, csrfToken, OWNER_SESSION_TTL_SECONDS, false)
    ]);
    res.statusCode = 302;
    res.setHeader('Location', driveResult ? `${config.appOrigin.replace(/\/$/, '')}/?drive=${driveResult}` : config.appOrigin);
    return res.end();
  } catch {
    return completeError(res, config.appOrigin);
  }
}
