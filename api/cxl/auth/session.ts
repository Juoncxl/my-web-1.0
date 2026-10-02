import type { IncomingMessage, ServerResponse } from 'node:http';
import { directDriveGet, directOwnerReadsEnabled } from '../googleDirect.js';
import { loadSealedOwnerDriveCredential, openRefreshToken, ownerDriveAccessToken } from '../../../src/server/cxlOwnerDrive.js';
import {
  cookieValue,
  createOwnerSessionToken,
  getOwnerAuthConfig,
  makeCsrfToken,
  makeSecureCookie,
  OWNER_CSRF_COOKIE,
  OWNER_SESSION_COOKIE,
  OWNER_SESSION_RENEW_AFTER_SECONDS,
  OWNER_SESSION_TTL_SECONDS,
  selectOwnerAuthMode,
  verifyOwnerSessionToken
} from '../../../src/server/cxlOwnerAuth.js';

type Request = IncomingMessage;
type Response = ServerResponse & { json?: (body: unknown) => void };

function send(res: Response, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET'); return send(res, 405, { ok: false, error: 'Method not allowed' });
  }
  if (selectOwnerAuthMode(process.env.CXL_OWNER_AUTH_BACKEND) !== 'vercel') return send(res, 404, { ok: false, error: 'Owner auth mode is not enabled' });
  const config = getOwnerAuthConfig();
  if (!config) return send(res, 503, { ok: false, error: 'Owner authentication is not configured' });
  let claims = verifyOwnerSessionToken(cookieValue(req.headers.cookie, OWNER_SESSION_COOKIE));
  if (!claims) return send(res, 200, { ok: true, authenticated: false, user: null });

  // `?drive=status`: prove the stored Owner Drive grant still refreshes and can reach Drive.
  if (new URL(req.url || '/', 'https://cxl.invalid').searchParams.get('drive') === 'status') {
    const folderId = process.env.CXL_INCOMING_FOLDER_ID?.trim();
    if (!folderId || !directOwnerReadsEnabled()) return send(res, 200, { ok: true, drive: { connected: false, reason: 'not_configured' } });
    try {
      const sealed = await loadSealedOwnerDriveCredential(folderId, directDriveGet);
      if (!sealed) return send(res, 200, { ok: true, drive: { connected: false, reason: 'not_connected' } });
      const token = await ownerDriveAccessToken(sealed, config);
      const about = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', {
        headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000)
      });
      if (!about.ok) return send(res, 200, { ok: true, drive: { connected: false, reason: 'drive_unreachable' } });
      const { connectedAt } = openRefreshToken(sealed, config.sessionSecret);
      return send(res, 200, { ok: true, drive: { connected: true, connectedAt } });
    } catch (error) {
      console.info(JSON.stringify({ event: 'cxl_owner_drive_status_failed', reason: error instanceof Error ? error.message.slice(0, 120) : 'unknown' }));
      return send(res, 200, { ok: true, drive: { connected: false, reason: 'grant_invalid' } });
    }
  }

  const csrfCookie = cookieValue(req.headers.cookie, OWNER_CSRF_COOKIE);
  const csrfToken = csrfCookie || makeCsrfToken();
  const cookies: string[] = [];
  // Sliding session: an Owner who keeps using the site is not signed out mid-edit.
  if (Math.floor(Date.now() / 1000) - claims.iat >= OWNER_SESSION_RENEW_AFTER_SECONDS) {
    const renewed = createOwnerSessionToken(claims.sub, claims.email, process.env.CXL_OWNER_SESSION_SECRET || '');
    claims = renewed.claims;
    cookies.push(makeSecureCookie(OWNER_SESSION_COOKIE, renewed.token, OWNER_SESSION_TTL_SECONDS));
    cookies.push(makeSecureCookie(OWNER_CSRF_COOKIE, csrfToken, OWNER_SESSION_TTL_SECONDS, false));
  } else if (!csrfCookie) {
    cookies.push(makeSecureCookie(OWNER_CSRF_COOKIE, csrfToken, Math.max(60, claims.exp - Math.floor(Date.now() / 1000)), false));
  }
  if (cookies.length) res.setHeader('Set-Cookie', cookies);

  const user = {
    id: config.legacyOwnerId,
    publicCreatorId: config.publicCreatorId,
    displayName: 'Juon',
    username: config.ownerProfileSlug,
    bio: '',
    createdAt: new Date(claims.iat * 1000).toISOString(),
    provider: 'google' as const
  };
  return send(res, 200, { ok: true, authenticated: true, expiresAt: new Date(claims.exp * 1000).toISOString(), csrfToken, user });
}
