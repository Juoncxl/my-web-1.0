import type { AssetCollaborationLink } from '../types';

export function safeCollabLinkUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

/** Drafts retain incomplete inputs so editing a URL never discards the row. */
export function normalizeCollabLinks(value: unknown): AssetCollaborationLink[] {
  if (!Array.isArray(value)) return [];
  return value.filter(item => item && typeof item === 'object' && typeof item.id === 'string').slice(0, 30).map(item => ({
    id: item.id.slice(0, 128),
    label: typeof item.label === 'string' ? item.label.slice(0, 160) : '',
    url: typeof item.url === 'string' ? item.url.slice(0, 2048) : '',
    visibility: item.visibility === 'public' ? 'public' : 'private'
  }));
}

export function publicCollabLinks(value: unknown): AssetCollaborationLink[] {
  return normalizeCollabLinks(value).filter(link => link.visibility === 'public' && safeCollabLinkUrl(link.url)).map(link => ({ ...link, label: link.label.trim(), url: safeCollabLinkUrl(link.url)! }));
}
