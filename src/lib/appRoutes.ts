/**
 * Every path the SPA answers. Vercel rewrites all unknown paths to index.html,
 * so anything not listed here renders the in-app "page not found" view.
 * Keep the legacy paths: links shared before the profile/route changes still use them.
 */
const KNOWN_APP_PATHS: readonly RegExp[] = [
  /^\/$/,
  /^\/index\.html$/i,
  /^\/@[^/]+\/?$/i,              // creator profile
  /^\/work\/[^/]+(?:\/edit)?\/?$/i, // Work detail / editor
  /^\/schedule\/?$/i,             // Collab schedule
  /^\/creator\/[^/]+\/?$/i,       // legacy profile link → /@slug
  /^\/vault\/?$/i,                // legacy Vault bookmark
  /^\/creator-space\/?$/i         // legacy Creator Space bookmark
];

export function isKnownAppPath(pathname: string): boolean {
  return KNOWN_APP_PATHS.some(pattern => pattern.test(pathname));
}

/**
 * Some hosts (Cloudflare Static Assets) redirect /@slug to /%40slug. Turn the
 * percent-encoded "@" of a profile path back into "/@slug"; null when unchanged.
 */
export function normalizeEncodedProfilePath(pathname: string): string | null {
  return /^\/%40/i.test(pathname) ? `/@${pathname.slice(4)}` : null;
}
