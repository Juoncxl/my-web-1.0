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

async function publicOwnerProfile(publicGasUrl: string, publicCreatorId: string) {
  const url = new URL(publicGasUrl);
  url.searchParams.set('cxlApi', 'profiles.getPublic');
  url.searchParams.set('ids', JSON.stringify([publicCreatorId]));
  const response = await fetch(url, { headers: { Accept: 'application/json' }, redirect: 'follow', signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error('Public Creator profile is unavailable');
  const raw = await response.json() as { ok?: boolean; data?: { data?: unknown } };
  if (raw.ok !== true || !raw.data || !Array.isArray(raw.data.data)) throw new Error('Public Creator response is malformed');
  const profiles = raw.data.data as Array<Record<string, unknown>>;
  return profiles.find(profile => profile.publicCreatorId === publicCreatorId) || null;
}

function safePublicImageUrl(value: unknown, appOrigin: string): string | undefined {
  if (typeof value !== 'string' || value.length > 2048 || /^data:/i.test(value)) return undefined;
  try {
    const url = new URL(value, appOrigin);
    if (url.protocol !== 'https:' || ['drive.google.com', 'docs.google.com', 'script.google.com'].includes(url.hostname)) return undefined;
    return url.toString();
  } catch { return undefined; }
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
  let profile: Record<string, unknown> | null = null;
  try { profile = await publicOwnerProfile(config.publicGasUrl, config.publicCreatorId); }
  catch { /* retain an authenticated identity with safe presentation defaults */ }

  const user = {
    id: config.legacyOwnerId,
    publicCreatorId: config.publicCreatorId,
    displayName: typeof profile?.displayName === 'string' ? profile.displayName : 'Creator',
    username: typeof profile?.username === 'string' ? profile.username : undefined,
    bio: typeof profile?.bio === 'string' ? profile.bio : '',
    avatarUrl: safePublicImageUrl(profile?.avatarUrl, config.appOrigin),
    coverUrl: safePublicImageUrl(profile?.coverUrl, config.appOrigin),
    createdAt: typeof profile?.createdAt === 'string' ? profile.createdAt : new Date(claims.iat * 1000).toISOString(),
    provider: 'google' as const
  };
  return send(res, 200, { ok: true, authenticated: true, expiresAt: new Date(claims.exp * 1000).toISOString(), csrfToken, user });
}
