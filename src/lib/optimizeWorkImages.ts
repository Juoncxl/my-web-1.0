/**
 * One-off Owner tool: re-encode the large images of existing Works the same way
 * new uploads are shrunk, then save them through the normal Work update path.
 *
 * Nothing is overwritten in Drive. Each optimized image is uploaded as a new media
 * file and the Work switches its reference to it; the old file stays in Drive
 * (marked retired by the server), so a Work can always be restored from it.
 * Collaboration Works are skipped: their images live inside participant data.
 */
import type { Asset, AssetMediaRecord } from '../types';
import type { StandardWorkMediaDraft } from './workMedia';
import { shrinkImageForUpload } from './imageShrink';

/** Images at or below this size are left alone; shrinking them saves too little. */
export const OPTIMIZE_MIN_BYTES = 300 * 1024;
/** A re-encoded image must be at least this much smaller to be worth a new upload. */
export const OPTIMIZE_MIN_SAVING_RATIO = 0.8;
const SHRINKABLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type OptimizeTargetKind = 'icon' | 'gallery' | 'content';

export interface OptimizeTarget {
  kind: OptimizeTargetKind;
  /** The display URL currently in the Work (what the browser downloads). */
  url: string;
  /** Gallery position, or the content block id. */
  index?: number;
  blockId?: string;
  /** Known stored size; undefined for legacy media without a record. */
  fileSize?: number;
}

export interface OptimizedImage {
  newMediaId: string;
  source: string;
}

function mediaIdFromDisplayUrl(url: string): string | null {
  if (!url.includes('/api/cxl/media')) return null;
  try {
    const ref = new URL(url, 'https://cxl.invalid').searchParams.get('ref') || '';
    return ref.startsWith('media:') ? ref.slice('media:'.length) : null;
  } catch { return null; }
}

function recordFor(asset: Asset, url: string, mediaId?: string | null): AssetMediaRecord | undefined {
  const id = mediaId || mediaIdFromDisplayUrl(url);
  return id ? (asset.media || []).find(item => item.id === id) : undefined;
}

/** True when the image is a stored Work image that could be large enough to shrink. */
function isCandidate(asset: Asset, url: string | undefined, mediaId?: string | null): url is string {
  if (!url || !url.includes('/api/cxl/media')) return false;
  const record = recordFor(asset, url, mediaId);
  if (!record) return true; // legacy media: size unknown until downloaded
  return SHRINKABLE_TYPES.has((record.mimeType || '').toLowerCase()) && record.fileSize > OPTIMIZE_MIN_BYTES;
}

/** Lists the images of one (hydrated, full) Work that are worth optimizing. */
export function planWorkImageOptimization(asset: Asset): OptimizeTarget[] {
  if (asset.category === 'collab' || asset.collaboration || asset.deletedAt) return [];
  const targets: OptimizeTarget[] = [];
  const size = (url: string, mediaId?: string | null) => recordFor(asset, url, mediaId)?.fileSize;
  if (asset.icon?.type === 'image' && isCandidate(asset, asset.icon.value, asset.icon.mediaId)) {
    targets.push({ kind: 'icon', url: asset.icon.value, fileSize: size(asset.icon.value, asset.icon.mediaId) });
  }
  (asset.previewImages || []).forEach((url, index) => {
    if (isCandidate(asset, url)) targets.push({ kind: 'gallery', url, index, fileSize: size(url) });
  });
  (asset.contentBlocks || []).forEach(block => {
    if (block.type === 'Image' && isCandidate(asset, block.body, block.mediaId)) {
      targets.push({ kind: 'content', url: block.body, blockId: block.id, fileSize: size(block.body, block.mediaId) });
    }
  });
  return targets;
}

/**
 * Builds the partial Work update that swaps each optimized image for its new upload.
 * Unchanged images stay as display URLs; the Google save path maps them back to refs.
 */
export function buildOptimizedWorkUpdate(asset: Asset, replaced: Map<string, OptimizedImage>):
  { updates: Partial<Asset> & { workMediaDraft: StandardWorkMediaDraft[] }; mediaIds: string[] } {
  const drafts: StandardWorkMediaDraft[] = [];
  const updates: Partial<Asset> & { workMediaDraft: StandardWorkMediaDraft[] } = { workMediaDraft: drafts };

  if (asset.icon?.type === 'image' && replaced.has(asset.icon.value)) {
    const image = replaced.get(asset.icon.value)!;
    updates.icon = { ...asset.icon, value: image.source, mediaId: image.newMediaId, storageKey: undefined, localBlobKey: undefined };
    drafts.push({ mediaId: image.newMediaId, source: image.source, purpose: 'icon', sortOrder: 0, isCover: false });
  }

  const gallery = asset.previewImages || [];
  if (gallery.some(url => replaced.has(url))) {
    updates.previewImages = gallery.map((url, sortOrder) => {
      const image = replaced.get(url);
      if (!image) return url;
      drafts.push({ mediaId: image.newMediaId, source: image.source, purpose: 'gallery', sortOrder, isCover: asset.previewImage === url });
      return image.source;
    });
    if (asset.previewImage !== undefined) updates.previewImage = replaced.get(asset.previewImage)?.source ?? asset.previewImage;
  }

  const blocks = asset.contentBlocks || [];
  if (blocks.some(block => block.type === 'Image' && replaced.has(block.body))) {
    // The server matches each upload to its placement; a content image's sortOrder is its block index.
    updates.contentBlocks = blocks.map((block, sortOrder) => {
      const image = block.type === 'Image' ? replaced.get(block.body) : undefined;
      if (!image) return block;
      drafts.push({ mediaId: image.newMediaId, source: image.source, purpose: 'prompt_example', contextId: block.id, sortOrder, isCover: false });
      return { ...block, body: image.source, mediaId: image.newMediaId, localBlobKey: undefined };
    });
  }

  return { updates, mediaIds: [...new Set(drafts.map(item => item.mediaId))] };
}

export interface OptimizeWorkResult {
  workId: string;
  title: string;
  optimized: number;
  bytesBefore: number;
  bytesAfter: number;
  error?: string;
}

export interface OptimizeDependencies {
  fetchFullWork: (id: string) => Promise<Asset | null>;
  updateWork: (id: string, updates: Partial<Asset>, options: { requestId: string; expectedRevision?: number }) => Promise<{ error?: string | null }>;
  download: (url: string) => Promise<Blob>;
  shrink?: (blob: Blob) => Promise<Blob>;
  newId?: () => string;
  toObjectUrl?: (blob: Blob) => string;
  revokeObjectUrl?: (url: string) => void;
}

/** Optimizes one Work end to end. Never throws; failures come back in `error`. */
export async function optimizeWorkImages(workId: string, deps: OptimizeDependencies): Promise<OptimizeWorkResult> {
  const result: OptimizeWorkResult = { workId, title: '', optimized: 0, bytesBefore: 0, bytesAfter: 0 };
  const objectUrls: string[] = [];
  const shrink = deps.shrink || shrinkImageForUpload;
  const newId = deps.newId || (() => crypto.randomUUID());
  const toObjectUrl = deps.toObjectUrl || (blob => URL.createObjectURL(blob));
  const revoke = deps.revokeObjectUrl || (url => URL.revokeObjectURL(url));
  try {
    const asset = await deps.fetchFullWork(workId);
    if (!asset) throw new Error('โหลดผลงานไม่สำเร็จ');
    result.title = asset.title || workId;
    const targets = planWorkImageOptimization(asset);
    if (!targets.length) return result;

    const replaced = new Map<string, OptimizedImage>();
    for (const target of targets) {
      if (replaced.has(target.url)) continue; // the same image used twice
      const original = await deps.download(target.url);
      if (original.size <= OPTIMIZE_MIN_BYTES || !SHRINKABLE_TYPES.has((original.type || '').toLowerCase())) continue;
      const smaller = await shrink(original);
      if (smaller === original || smaller.size > original.size * OPTIMIZE_MIN_SAVING_RATIO) continue;
      const source = toObjectUrl(smaller);
      objectUrls.push(source);
      replaced.set(target.url, { newMediaId: newId(), source });
      result.bytesBefore += original.size;
      result.bytesAfter += smaller.size;
    }
    if (!replaced.size) return result;

    const { updates } = buildOptimizedWorkUpdate(asset, replaced);
    const saved = await deps.updateWork(workId, updates, { requestId: newId(), expectedRevision: asset.revision });
    if (saved.error) throw new Error(saved.error);
    result.optimized = replaced.size;
    return result;
  } catch (error) {
    return { ...result, optimized: 0, bytesBefore: 0, bytesAfter: 0, error: error instanceof Error ? error.message : 'ย่อรูปไม่สำเร็จ' };
  } finally {
    objectUrls.forEach(url => revoke(url));
  }
}
