import type { CollabProgress } from './collabSchedule';

const ENDPOINT = '/api/cxl/collab-progress';

function csrfToken(): string {
  const prefix = '__Host-cxl_csrf=';
  const cookie = typeof document === 'undefined' ? '' : String(document.cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : '';
}

async function readResponse(response: Response): Promise<CollabProgress> {
  const body = await response.json().catch(() => null) as { ok?: boolean; data?: CollabProgress; error?: string } | null;
  if (!response.ok || !body?.ok || !body.data) throw new Error(body?.error || `HTTP ${response.status}`);
  return body.data;
}

export async function fetchCollabProgress(): Promise<CollabProgress> {
  return readResponse(await fetch(ENDPOINT, { credentials: 'same-origin', headers: { Accept: 'application/json' } }));
}

export async function saveCollabProgress(key: string, done: boolean): Promise<CollabProgress> {
  return readResponse(await fetch(ENDPOINT, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CXL-CSRF': csrfToken() },
    body: JSON.stringify({ key, done })
  }));
}
