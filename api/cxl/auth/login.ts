import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  createOidcTransactionToken,
  createPkceChallenge,
  createRandomToken,
  getOwnerAuthConfig,
  makeSecureCookie,
  OWNER_OIDC_TRANSACTION_COOKIE,
  OWNER_OIDC_TRANSACTION_TTL_SECONDS,
  selectOwnerAuthMode
} from '../../../src/server/cxlOwnerAuth.js';

type Request = IncomingMessage;
type Response = ServerResponse & { json?: (body: unknown) => void };

export default function handler(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  if (selectOwnerAuthMode(process.env.CXL_OWNER_AUTH_BACKEND) !== 'vercel') {
    res.statusCode = 404; return res.end();
  }
  if (req.method !== 'GET') {
    res.statusCode = 405; res.setHeader('Allow', 'GET'); return res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
  }
  const config = getOwnerAuthConfig();
  if (!config) {
    res.statusCode = 503; res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: 'Owner authentication is not configured' }));
  }
  const state = createRandomToken(32);
  const nonce = createRandomToken(32);
  const codeVerifier = createRandomToken(48);
  const transaction = createOidcTransactionToken(state, nonce, codeVerifier, config.sessionSecret);
  const authorize = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorize.searchParams.set('client_id', config.clientId);
  authorize.searchParams.set('redirect_uri', config.redirectUri);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('scope', 'openid email profile');
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('nonce', nonce);
  authorize.searchParams.set('code_challenge', createPkceChallenge(codeVerifier));
  authorize.searchParams.set('code_challenge_method', 'S256');
  authorize.searchParams.set('prompt', 'select_account');
  res.setHeader('Set-Cookie', makeSecureCookie(OWNER_OIDC_TRANSACTION_COOKIE, transaction, OWNER_OIDC_TRANSACTION_TTL_SECONDS));
  res.statusCode = 302;
  res.setHeader('Location', authorize.toString());
  return res.end();
}
