import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { directPublicReadsEnabled, directPublicWorksList } from './googleDirect.js';

type Request = IncomingMessage;
type Response = ServerResponse;
type Row = Record<string, unknown>;

// /work/:id is rewritten here so link previews (LINE, Discord, X, Facebook) see the
// Work's own title, description and cover. Browsers get the same SPA shell.
const SHARE_CACHE_CONTROL = 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400';
const WORK_ID_RE = /^asset_[A-Za-z0-9_-]{1,96}$/;
const MEDIA_REF_RE = /^media:[A-Za-z0-9_-]{1,128}$/;
const HASH_REF_RE = /^cxl-media:[a-f0-9]{64}$/i;
const DEFAULT_DESCRIPTION = 'คลังส่วนตัวและพื้นที่แชร์ผลงานสำหรับครีเอเตอร์แชทบอท';

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function clip(value: string, max: number): string {
  const flat = value.replace(/[#*`_>]/g, '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

function mediaUrl(work: Row, ref: string, origin: string): string {
  const id = MEDIA_REF_RE.test(ref) ? ref.slice(6) : '';
  const record = (Array.isArray(work.media) ? work.media as Row[] : []).find(item => item && item.id === id);
  const params = new URLSearchParams({ workId: text(work.id), ref });
  if (record?.delivery === 'vercel_proxy') params.set('scope', 'public');
  return `${origin}/api/cxl/media?${params.toString()}`;
}

/** Cover first, then an image icon, then the site icon. */
export function shareImageUrl(work: Row, origin: string): string {
  const cover = text(work.previewImage) || text((Array.isArray(work.previewImages) ? work.previewImages : [])[0]);
  if (MEDIA_REF_RE.test(cover) || HASH_REF_RE.test(cover)) return mediaUrl(work, cover, origin);
  if (/^https:\/\//i.test(cover)) return cover;
  const icon = work.icon && typeof work.icon === 'object' ? work.icon as Row : null;
  const iconRef = icon?.type === 'image' ? text(icon.mediaId) ? `media:${text(icon.mediaId)}` : text(icon.value) : '';
  if (MEDIA_REF_RE.test(iconRef) || HASH_REF_RE.test(iconRef)) return mediaUrl(work, iconRef, origin);
  return `${origin}/icon-512.png`;
}

export function shareMeta(work: Row | null, origin: string, pageUrl: string): string {
  const title = work ? `${clip(text(work.title) || 'ผลงาน', 120)} · CXL Studio` : 'CXL Studio';
  const description = work
    ? clip(text(work.shortDescription) || text(work.content) || `ผลงานโดย ${text(work.authorName) || 'Creator'}`, 200)
    : DEFAULT_DESCRIPTION;
  const image = work ? shareImageUrl(work, origin) : `${origin}/icon-512.png`;
  const tags: Array<[string, string, string]> = [
    ['name', 'description', description],
    ['property', 'og:site_name', 'CXL Studio'],
    ['property', 'og:title', title],
    ['property', 'og:description', description],
    ['property', 'og:type', work ? 'article' : 'website'],
    ['property', 'og:url', pageUrl],
    ['property', 'og:image', image],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', description],
    ['name', 'twitter:image', image]
  ];
  return `<title>${escapeHtml(title)}</title>\n    `
    + tags.map(([attr, key, value]) => `<meta ${attr}="${key}" content="${escapeHtml(value)}" />`).join('\n    ');
}

/** Replaces the shell's default title/description/OG/Twitter tags with the Work's. */
export function injectShareMeta(shell: string, meta: string): string {
  const stripped = shell
    .replace(/\s*<title>[\s\S]*?<\/title>/i, '')
    .replace(/\s*<meta\s+(?:name|property)="(?:description|og:[^"]+|twitter:[^"]+)"[^>]*>/gi, '');
  return stripped.replace(/<\/head>/i, `    ${meta}\n  </head>`);
}

let cachedShell: string | null = null;

async function loadShell(req: Request, origin: string): Promise<string> {
  if (cachedShell) return cachedShell;
  for (const candidate of [path.join(process.cwd(), 'dist', 'index.html'), path.join(process.cwd(), 'index.html')]) {
    try {
      const html = await readFile(candidate, 'utf8');
      // The source index.html points at /src/main.tsx; only a built shell is usable.
      if (!html.includes('/src/main.tsx')) return (cachedShell = html);
    } catch { /* try the next source */ }
  }
  // Fall back to the deployed static shell. Forward the cookie so protected Preview
  // deployments still answer.
  const response = await fetch(`${origin}/index.html`, { headers: req.headers.cookie ? { cookie: req.headers.cookie } : {} });
  if (!response.ok) throw new Error(`Shell HTTP ${response.status}`);
  return (cachedShell = await response.text());
}

function requestOrigin(req: Request): string {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  return /^[A-Za-z0-9.:-]+$/.test(host) ? `${proto === 'http' ? 'http' : 'https'}://${host}` : 'https://cxlstudio.vercel.app';
}

async function publicWork(id: string): Promise<Row | null> {
  if (!WORK_ID_RE.test(id) || !directPublicReadsEnabled()) return null;
  try {
    return (await directPublicWorksList()).find(work => work.id === id) || null;
  } catch {
    // A preview without a Work beats a broken page.
    return null;
  }
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, HEAD');
    return res.end();
  }
  const origin = requestOrigin(req);
  const id = new URL(req.url || '/', 'http://localhost').searchParams.get('id') || '';
  const pageUrl = `${origin}/work/${encodeURIComponent(id)}`;
  try {
    const [shell, work] = await Promise.all([loadShell(req, origin), publicWork(id)]);
    const html = injectShareMeta(shell, shareMeta(work, origin, pageUrl));
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', SHARE_CACHE_CONTROL);
    return res.end(req.method === 'HEAD' ? undefined : html);
  } catch {
    // Without a shell there is no app to boot here; send the visitor home.
    res.statusCode = 302;
    res.setHeader('Location', '/');
    res.setHeader('Cache-Control', 'no-store');
    return res.end();
  }
}
