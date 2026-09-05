/**
 * Composer-local unified media draft.
 *
 * The existing Asset media contract supports six preview images and one
 * legacy previewImage. D.4 keeps that safe limit while giving the Composer
 * stable ids and an explicit cover selection for the current draft.
 */
export const CREATOR_MEDIA_MAX_ITEMS = 6;
export const CREATOR_MEDIA_MAX_FILE_BYTES = 10 * 1024 * 1024;

export type CreatorMediaKind = 'image' | 'gif';

export interface CreatorMediaItem {
  id: string;
  src: string;
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
  return file.type.startsWith('image/') && file.size > 0 && file.size <= CREATOR_MEDIA_MAX_FILE_BYTES;
}

/** Global Work media v1 deliberately accepts static images only. Legacy GIF
 * entries remain readable so existing local drafts are never silently lost. */
export function isSupportedCreatorGlobalMediaFile(file: { type: string; size: number }): boolean {
  return isSupportedCreatorMediaFile(file) && file.type !== 'image/gif';
}

export function createMediaItem(src: string, mimeType?: string, id = `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`): CreatorMediaItem {
  return { id, src, kind: getCreatorMediaKind(mimeType, src), mimeType };
}

export function createMediaDraftFromLegacy(input: { previewImages?: string[]; previewImage?: string }): CreatorMediaDraft {
  const legacyCover = (input.previewImage || '').trim();
  const sources = [...(input.previewImages || [])];
  if (legacyCover && !sources.includes(legacyCover)) sources.unshift(legacyCover);
  if (legacyCover && !sources.slice(0, CREATOR_MEDIA_MAX_ITEMS).includes(legacyCover)) {
    sources.unshift(legacyCover);
  }

  const items = sources
    .filter((src, index) => Boolean(src) && sources.indexOf(src) === index)
    .map((src, index) => createMediaItem(src, undefined, `legacy-media-${index}`));
  const coverItem = legacyCover ? items.find(item => item.src === legacyCover) : undefined;
  return { items, coverId: coverItem?.id || null };
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
  if (next.coverId === itemId) next.coverId = null;
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
