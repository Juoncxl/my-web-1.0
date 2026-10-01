import type { AssetMediaRecord } from '../../types';

/**
 * Composer-local unified media draft.
 *
 * The existing Asset media contract supports six preview images and one
 * legacy previewImage. D.4 keeps that safe limit while giving the Composer
 * stable ids and an explicit cover selection for the current draft.
 */
export const CREATOR_MEDIA_MAX_ITEMS = 6;
export const CREATOR_MEDIA_MAX_FILE_BYTES = 10 * 1024 * 1024;
const CREATOR_MEDIA_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export type CreatorMediaKind = 'image' | 'gif';

export interface CreatorMediaItem {
  id: string;
  src: string;
  /** Stable media identity for upload retries; independent of Work request IDs. */
  mediaId?: string;
  localBlobKey?: string;
  kind: CreatorMediaKind;
  mimeType?: string;
  naturalWidth?: number;
  naturalHeight?: number;
}

export interface CreatorMediaDraft {
  items: CreatorMediaItem[];
  coverId: string | null;
}

export function createBlankMediaDraft(): CreatorMediaDraft {
  return { items: [], coverId: null };
}

export function cloneMediaDraft(draft: CreatorMediaDraft): CreatorMediaDraft {
  return {
    items: draft.items.map(item => ({ ...item })),
    coverId: draft.coverId
  };
}

export function getCreatorMediaKind(mimeType?: string, src = ''): CreatorMediaKind {
  return mimeType === 'image/gif' || src.startsWith('data:image/gif') ? 'gif' : 'image';
}

export function isSupportedCreatorMediaFile(file: { type: string; size: number }): boolean {
  return CREATOR_MEDIA_MIME_TYPES.has(file.type.toLowerCase()) && file.size > 0 && file.size <= CREATOR_MEDIA_MAX_FILE_BYTES;
}

/** Image type from the file's own bytes; '' when it is not a supported image. */
export function sniffCreatorMediaType(head: Uint8Array): string {
  const ascii = (start: number, end: number) => String.fromCharCode(...head.subarray(start, end));
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  if (head.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => head[index] === byte)) return 'image/png';
  if (head.length >= 6 && ['GIF87a', 'GIF89a'].includes(ascii(0, 6))) return 'image/gif';
  if (head.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return '';
}

/**
 * The real image type of a picked file. Browsers derive `file.type` from the
 * extension (often empty on Windows, or wrong for renamed files), while the
 * server checks the bytes, so the bytes decide here too.
 */
export async function resolveCreatorMediaType(file: Blob & { size: number }): Promise<string> {
  if (file.size <= 0 || file.size > CREATOR_MEDIA_MAX_FILE_BYTES) return '';
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  return sniffCreatorMediaType(head);
}

/** Global Work media v1 deliberately accepts static images only. Legacy GIF
 * entries remain readable so existing local drafts are never silently lost. */
export function isSupportedCreatorGlobalMediaFile(file: { type: string; size: number }): boolean {
  return isSupportedCreatorMediaFile(file) && file.type !== 'image/gif';
}

export function createMediaItem(
  src: string,
  mimeType?: string,
  id = `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  mediaId?: string
): CreatorMediaItem {
  return { id, src, ...(mediaId ? { mediaId } : {}), kind: getCreatorMediaKind(mimeType, src), mimeType };
}

export function createMediaDraftFromLegacy(input: { previewImages?: string[]; previewImage?: string; media?: AssetMediaRecord[] }): CreatorMediaDraft {
  const legacyCover = (input.previewImage || '').trim();
  const sources = [...(input.previewImages || [])];
  if (legacyCover && !sources.includes(legacyCover)) sources.unshift(legacyCover);
  if (legacyCover && !sources.slice(0, CREATOR_MEDIA_MAX_ITEMS).includes(legacyCover)) {
    sources.unshift(legacyCover);
  }

  const items = sources
    .filter((src, index) => Boolean(src) && sources.indexOf(src) === index)
    .map((src, index) => {
      const refId = src.startsWith('media:') ? src.slice('media:'.length) : '';
      const proxyRecord = input.media?.find(item => item.delivery === 'vercel_proxy' && item.signedUrl === src && item.purpose === 'gallery');
      return createMediaItem(src, proxyRecord?.mimeType, `legacy-media-${index}`,
        refId || proxyRecord?.id || (isLocalMediaSource(src) ? createStableMediaId_() : undefined));
    });
  const coverItem = legacyCover ? items.find(item => item.src === legacyCover) : undefined;
  return { items, coverId: coverItem?.id || items[0]?.id || null };
}

function isLocalMediaSource(value: string): boolean {
  return /^data:image\//i.test(value) || /^blob:/i.test(value);
}

function createStableMediaId_(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, token => {
    const value = Math.floor(Math.random() * 16);
    return (token === 'x' ? value : (value & 0x3) | 0x8).toString(16);
  });
}

export function mediaDraftToPreviewImages(draft: CreatorMediaDraft): string[] {
  return draft.items.map(item => item.src);
}

export function getCoverMedia(draft: CreatorMediaDraft): CreatorMediaItem | null {
  return draft.items.find(item => item.id === draft.coverId) || null;
}

export function addMediaItem(draft: CreatorMediaDraft, item: CreatorMediaItem): CreatorMediaDraft {
  const next = cloneMediaDraft(draft);
  if (next.items.length >= CREATOR_MEDIA_MAX_ITEMS || next.items.some(existing => existing.src === item.src)) return next;
  next.items.push({ ...item });
  if (!next.coverId) next.coverId = item.id;
  return next;
}

export function setCoverMedia(draft: CreatorMediaDraft, itemId: string): CreatorMediaDraft {
  const next = cloneMediaDraft(draft);
  if (next.items.some(item => item.id === itemId)) next.coverId = itemId;
  return next;
}

export function removeMediaItem(draft: CreatorMediaDraft, itemId: string): CreatorMediaDraft {
  const next = cloneMediaDraft(draft);
  next.items = next.items.filter(item => item.id !== itemId);
  if (next.coverId === itemId) next.coverId = next.items[0]?.id || null;
  return next;
}

export function replaceMediaItem(draft: CreatorMediaDraft, itemId: string, replacement: CreatorMediaItem): CreatorMediaDraft {
  const next = cloneMediaDraft(draft);
  const index = next.items.findIndex(item => item.id === itemId);
  if (index < 0) return next;
  next.items[index] = { ...replacement, id: itemId };
  return next;
}

export function setMediaItemDimensions(draft: CreatorMediaDraft, itemId: string, naturalWidth: number, naturalHeight: number): CreatorMediaDraft {
  if (naturalWidth <= 0 || naturalHeight <= 0) return draft;
  const item = draft.items.find(candidate => candidate.id === itemId);
  if (!item || (item.naturalWidth === naturalWidth && item.naturalHeight === naturalHeight)) return draft;
  const next = cloneMediaDraft(draft);
  const index = next.items.findIndex(candidate => candidate.id === itemId);
  next.items[index] = { ...next.items[index], naturalWidth, naturalHeight };
  return next;
}

export function moveMediaItem(draft: CreatorMediaDraft, itemId: string, direction: 'left' | 'right'): CreatorMediaDraft {
  const next = cloneMediaDraft(draft);
  const index = next.items.findIndex(item => item.id === itemId);
  const target = direction === 'left' ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= next.items.length) return next;
  [next.items[index], next.items[target]] = [next.items[target], next.items[index]];
  return next;
}

export function reorderMediaItem(draft: CreatorMediaDraft, itemId: string, targetId: string): CreatorMediaDraft {
  const next = cloneMediaDraft(draft);
  const sourceIndex = next.items.findIndex(item => item.id === itemId);
  const targetIndex = next.items.findIndex(item => item.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return next;
  const [moved] = next.items.splice(sourceIndex, 1);
  next.items.splice(targetIndex, 0, moved);
  return next;
}
