/**
 * A backup host (Render) runs with CXL_READ_ONLY=on: it shows the site but refuses changes,
 * because Cloudflare's D1 holds the Works and edits made elsewhere would never reach it.
 */
export const READ_ONLY_ERROR = 'This backup site is read-only. Make changes on the main site.';

export function readOnlySite(env: Record<string, string | undefined> = process.env): boolean {
  return String(env.CXL_READ_ONLY || '').trim().toLowerCase() === 'on';
}
