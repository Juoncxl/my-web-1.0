import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  clearSecureCookie,
  OWNER_CSRF_COOKIE,
  OWNER_SESSION_COOKIE,
  OWNER_OIDC_TRANSACTION_COOKIE,
  selectOwnerAuthMode,
  verifyCsrfRequest
} from '../../../src/server/cxlOwnerAuth.js';

type Request = IncomingMessage;
type Response = ServerResponse & { json?: (body: unknown) => void };

export default function handler(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'POST') { res.statusCode = 405; res.setHeader('Allow', 'POST'); return res.end(JSON.stringify({ ok: false, error: 'Method not allowed' })); }
  if (selectOwnerAuthMode(process.env.CXL_OWNER_AUTH_BACKEND) !== 'vercel') { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: 'Owner auth mode is not enabled' })); }
  const expectedOrigin = process.env.CXL_OWNER_APP_ORIGIN?.trim() || '';
  if (!expectedOrigin || !verifyCsrfRequest(req.headers.origin, expectedOrigin, req.headers.cookie, req.headers['x-cxl-csrf'] as string | undefined)) {
    res.statusCode = 403; return res.end(JSON.stringify({ ok: false, error: 'Request origin or CSRF token is invalid' }));
  }
  res.setHeader('Set-Cookie', [clearSecureCookie(OWNER_SESSION_COOKIE), clearSecureCookie(OWNER_OIDC_TRANSACTION_COOKIE), clearSecureCookie(OWNER_CSRF_COOKIE, false)]);
  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true }));
}
