import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  cookieValue,
  getOwnerAuthConfig,
  makeCsrfToken,
  makeSecureCookie,
  OWNER_CSRF_COOKIE,
  OWNER_SESSION_COOKIE,
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
  const claims = verifyOwnerSessionToken(cookieValue(req.headers.cookie, OWNER_SESSION_COOKIE));
  if (!claims) return send(res, 200, { ok: true, authenticated: false, user: null });

  const csrfCookie = cookieValue(req.headers.cookie, OWNER_CSRF_COOKIE);
  const csrfToken = csrfCookie || makeCsrfToken();
  const csrfMaxAge = csrfCookie ? OWNER_SESSION_TTL_SECONDS : OWNER_SESSION_TTL_SECONDS;
  if (!csrfCookie) res.setHeader('Set-Cookie', makeSecureCookie(OWNER_CSRF_COOKIE, csrfToken, csrfMaxAge, false));

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
