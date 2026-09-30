import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Owner Google Drive/Sheets write access (OAuth, acting as the Owner).
 *
 * The Owner grants Drive + Sheets once through the existing Google sign-in
 * (`/api/cxl/auth/login?drive=1`). The refresh token is sealed with
 * AES-256-GCM using a key derived from CXL_OWNER_SESSION_SECRET and stored as
 * one small file in the private incoming folder, written with the Owner's own
 * token and read back with the read-only Service Account. Nothing reaches the
 * browser.
 */

export const OWNER_DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets'
] as const;
export const OWNER_DRIVE_CONNECT_COOKIE = '__Host-cxl_drive_connect';
export const OWNER_DRIVE_CREDENTIAL_FILE = 'cxl-owner-drive-credential.json';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const TIMEOUT_MS = 10_000;

interface SealedCredential {
  v: 1;
  iv: string;
  tag: string;
  data: string;
  email?: string;
  connectedAt: string;
}

function sealKey(secret: string): Buffer {
  return createHash('sha256').update(`cxl-owner-drive:v1:${secret}`).digest();
}

export function sealRefreshToken(refreshToken: string, secret: string, email?: string, now = new Date()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', sealKey(secret), iv);
  const data = Buffer.concat([cipher.update(refreshToken, 'utf8'), cipher.final()]);
  const sealed: SealedCredential = {
    v: 1, iv: iv.toString('base64url'), tag: cipher.getAuthTag().toString('base64url'), data: data.toString('base64url'),
    ...(email ? { email } : {}), connectedAt: now.toISOString()
  };
  return JSON.stringify(sealed);
}

export function openRefreshToken(sealedJson: string, secret: string): { refreshToken: string; email?: string; connectedAt: string } {
  const sealed = JSON.parse(sealedJson) as SealedCredential;
  if (sealed?.v !== 1) throw new Error('Unsupported Owner Drive credential');
  const decipher = createDecipheriv('aes-256-gcm', sealKey(secret), Buffer.from(sealed.iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(sealed.tag, 'base64url'));
  const refreshToken = Buffer.concat([decipher.update(Buffer.from(sealed.data, 'base64url')), decipher.final()]).toString('utf8');
  return { refreshToken, email: sealed.email, connectedAt: sealed.connectedAt };
}

function escapeQuery(value: string): string {
  return value.replace(/['\\]/g, '\\$&');
}

/** Creates or replaces the sealed credential file in the private folder, as the Owner. */
export async function storeOwnerDriveCredential(ownerAccessToken: string, folderId: string, sealedJson: string): Promise<void> {
  const auth = { Authorization: `Bearer ${ownerAccessToken}` };
  const query = `'${escapeQuery(folderId)}' in parents and name = '${OWNER_DRIVE_CREDENTIAL_FILE}' and trashed = false`;
  const listed = await fetch(`${DRIVE_FILES}?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
    headers: auth, signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!listed.ok) throw new Error(`Owner Drive credential lookup failed (HTTP ${listed.status})`);
  const existingId = ((await listed.json()) as { files?: { id?: string }[] }).files?.[0]?.id;

  const boundary = `cxl-${randomBytes(12).toString('hex')}`;
  const metadata = existingId ? {} : { name: OWNER_DRIVE_CREDENTIAL_FILE, parents: [folderId], mimeType: 'application/json' };
  const body = [
    `--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '', JSON.stringify(metadata),
    `--${boundary}`, 'Content-Type: application/json', '', sealedJson, `--${boundary}--`, ''
  ].join('\r\n');
  const url = existingId
    ? `${DRIVE_UPLOAD}/${encodeURIComponent(existingId)}?uploadType=multipart&supportsAllDrives=true`
    : `${DRIVE_UPLOAD}?uploadType=multipart&supportsAllDrives=true`;
  const saved = await fetch(url, {
    method: existingId ? 'PATCH' : 'POST',
    headers: { ...auth, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!saved.ok) throw new Error(`Owner Drive credential save failed (HTTP ${saved.status})`);
}

/** Reads the sealed credential with a caller-supplied (Service Account) Drive GET. */
export async function loadSealedOwnerDriveCredential(
  folderId: string,
  driveGet: (url: string) => Promise<globalThis.Response>
): Promise<string | null> {
  const query = `'${escapeQuery(folderId)}' in parents and name = '${OWNER_DRIVE_CREDENTIAL_FILE}' and trashed = false`;
  const listed = await (await driveGet(`${DRIVE_FILES}?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`)).json() as { files?: { id?: string }[] };
  const fileId = listed.files?.[0]?.id;
  if (!fileId) return null;
  return (await driveGet(`${DRIVE_FILES}/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`)).text();
}

let cachedOwnerToken: { value: string; expiresAt: number; source: string } | null = null;

/** Exchanges the stored refresh token for a short-lived Owner access token (cached per instance). */
export async function ownerDriveAccessToken(
  sealedJson: string,
  config: { clientId: string; clientSecret: string; sessionSecret: string }
): Promise<string> {
  if (cachedOwnerToken && cachedOwnerToken.source === sealedJson && cachedOwnerToken.expiresAt > Date.now() + 60_000) return cachedOwnerToken.value;
  const { refreshToken } = openRefreshToken(sealedJson, config.sessionSecret);
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  const body = await response.json().catch(() => null) as { access_token?: string; expires_in?: number; scope?: string } | null;
  if (!response.ok || !body?.access_token) throw new Error(`Owner Drive token refresh failed (HTTP ${response.status})`);
  const granted = (body.scope || '').split(/\s+/);
  if (!OWNER_DRIVE_SCOPES.every(scope => granted.includes(scope))) throw new Error('Owner Drive grant is missing Drive or Sheets access');
  cachedOwnerToken = { value: body.access_token, expiresAt: Date.now() + (Number(body.expires_in) || 3600) * 1000, source: sealedJson };
  return body.access_token;
}

export function hasOwnerDriveScopes(scope: unknown): boolean {
  const granted = typeof scope === 'string' ? scope.split(/\s+/) : [];
  return OWNER_DRIVE_SCOPES.every(item => granted.includes(item));
}
