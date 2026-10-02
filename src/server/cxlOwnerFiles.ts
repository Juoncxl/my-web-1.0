import { randomBytes } from 'node:crypto';

/**
 * Small private JSON files in the Owner's Drive folder (Collab progress ticks, idea inbox).
 * Only Owner-authenticated endpoints call these; nothing here is ever public.
 */
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const TIMEOUT_MS = 10_000;

export async function findOwnerFile(token: string, folderId: string, name: string): Promise<string | null> {
  const query = `'${folderId.replace(/['\\]/g, '\\$&')}' in parents and name = '${name}' and trashed = false`;
  const listed = await fetch(`${DRIVE_FILES}?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!listed.ok) throw new Error(`Owner file lookup failed (HTTP ${listed.status})`);
  return ((await listed.json()) as { files?: { id?: string }[] }).files?.[0]?.id || null;
}

export async function readOwnerJson(token: string, fileId: string | null): Promise<unknown> {
  if (!fileId) return {};
  const response = await fetch(`${DRIVE_FILES}/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`Owner file read failed (HTTP ${response.status})`);
  return response.json().catch(() => ({}));
}

export async function writeOwnerJson(token: string, folderId: string, fileId: string | null, name: string, value: unknown): Promise<void> {
  const boundary = `cxl-${randomBytes(12).toString('hex')}`;
  const metadata = fileId ? {} : { name, parents: [folderId], mimeType: 'application/json' };
  const body = [
    `--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '', JSON.stringify(metadata),
    `--${boundary}`, 'Content-Type: application/json', '', JSON.stringify(value), `--${boundary}--`, ''
  ].join('\r\n');
  const saved = await fetch(fileId
    ? `${DRIVE_UPLOAD}/${encodeURIComponent(fileId)}?uploadType=multipart&supportsAllDrives=true`
    : `${DRIVE_UPLOAD}?uploadType=multipart&supportsAllDrives=true`, {
    method: fileId ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!saved.ok) throw new Error(`Owner file save failed (HTTP ${saved.status})`);
}
