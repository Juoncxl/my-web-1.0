/**
 * One-off Owner tool: re-encode the large images of existing Works the same way
 * new uploads are shrunk, then save them through the normal Work update path.
 *
 * Nothing is overwritten in place. Each optimized image is uploaded as a new media
 * file and the Work switches its reference to it. The server marks the old proxy
 * file retired; its hourly cleanup later moves it to Drive trash (restorable for
 * 30 days). Legacy files are never touched.
 * Collaboration participant reference images are included: both the owner draft
 * (`collaboration`) and the public copy (`publicCollaboration`) switch together.
 */
import type { Asset, AssetMediaRecord } from '../types';
import type { StandardWorkMediaDraft } from './workMedia';
import { shrinkImageForUpload } from './imageShrink';
import { CATEGORIES } from './constants';

/** Images at or below this size are left alone; shrinking them saves too little. */
export const OPTIMIZE_MIN_BYTES = 300 * 1024;
/** A re-encoded image must be at least this much smaller to be worth a new upload. */
export const OPTIMIZE_MIN_SAVING_RATIO = 0.8;
const SHRINKABLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type OptimizeTargetKind = 'icon' | 'gallery' | 'content' | 'collab_reference';

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
  // Many stored records carry no size (0) or type; those are measured after download instead.
  const type = (record.mimeType || '').toLowerCase();
  if (type && !SHRINKABLE_TYPES.has(type)) return false;
  return !(record.fileSize > 0 && record.fileSize <= OPTIMIZE_MIN_BYTES);
}

/** Lists the images of one (hydrated, full) Work that are worth optimizing. */
export function planWorkImageOptimization(asset: Asset): OptimizeTarget[] {
  if (asset.deletedAt) return [];
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
  // Owner draft first; the public copy only when there is no draft. Both carry the same images.
  const collaboration = asset.collaboration || asset.publicCollaboration;
  (collaboration?.participants || []).forEach(participant => {
    (participant.referenceImages || []).forEach((image, index) => {
      if (image && isCandidate(asset, image.src, image.mediaId)) {
        targets.push({ kind: 'collab_reference', url: image.src, index, blockId: participant.id, fileSize: size(image.src, image.mediaId) });
      }
    });
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

  // Collaboration reference images. The server places them by their index in the owner
  // draft (or the public copy when there is no draft), so the uploads follow that order.
  type Collab = NonNullable<Asset['collaboration']> | NonNullable<Asset['publicCollaboration']>;
  const swap = <T extends Collab>(collaboration: T): T => ({
    ...collaboration,
    participants: (collaboration.participants || []).map(participant => ({
      ...participant,
      referenceImages: (participant.referenceImages || []).map(image => {
        const optimized = image ? replaced.get(image.src) : undefined;
        return optimized ? { ...image, src: optimized.source, mediaId: optimized.newMediaId, localBlobKey: undefined } : image;
      })
    }))
  }) as T;
  const placementSource = asset.collaboration || asset.publicCollaboration;
  const collabHits = (placementSource?.participants || []).flatMap(participant => (participant.referenceImages || [])
    .map((image, sortOrder) => ({ participant, image, sortOrder }))
    .filter(({ image }) => image && replaced.has(image.src)));
  if (collabHits.length) {
    for (const { participant, image, sortOrder } of collabHits) {
      const optimized = replaced.get(image.src)!;
      drafts.push({ mediaId: optimized.newMediaId, source: optimized.source, purpose: 'collab_reference', contextId: participant.id, sortOrder, isCover: false });
    }
    // The server only accepts a collaboration draft on a payload that names the collab category.
    updates.category = asset.category;
    if (asset.collaboration) updates.collaboration = swap(asset.collaboration);
    if (asset.publicCollaboration) updates.publicCollaboration = swap(asset.publicCollaboration);
  }

  // One upload per new image, even when it sits in more than one place.
  const seen = new Set<string>();
  updates.workMediaDraft = drafts.filter(item => !seen.has(item.mediaId) && Boolean(seen.add(item.mediaId)));
  return { updates, mediaIds: [...seen] };
}

export interface OptimizeWorkResult {
  workId: string;
  title: string;
  optimized: number;
  bytesBefore: number;
  bytesAfter: number;
  /** Images that could not be downloaded and were left untouched. */
  skipped?: number;
  /** Images downloaded and measured. */
  checked?: number;
  /** True when a GIF icon was replaced by the category emoji. */
  gifIconReplaced?: boolean;
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
/**
 * GIF icons are swapped for the category emoji (the Owner's choice): an animated icon is
 * loaded on every card and can weigh several MB, and shrinking would lose the animation.
 */
export function gifIconReplacement(asset: Asset): Asset['icon'] | null {
  if (asset.icon?.type !== 'image' || !asset.icon.value) return null;
  const record = recordFor(asset, asset.icon.value, asset.icon.mediaId);
  const type = (record?.mimeType || asset.icon.mimeType || '').toLowerCase();
  if (type !== 'image/gif' && !/\.gif(?:$|\?)/i.test(asset.icon.value)) return null;
  return { type: 'emoji', value: CATEGORIES[asset.category]?.emoji || '✨' };
}

/** Images per save: a big Collaboration (dozens of participants) is optimized over several saves. */
export const OPTIMIZE_BATCH_SIZE = 12;
const MAX_ROUNDS = 60;

/** Stable key of a stored image: its ref, since display URLs change version after every save. */
function imageKey(url: string): string {
  try { return new URL(url, 'https://cxl.invalid').searchParams.get('ref') || url; } catch { return url; }
}

/** Optimizes one Work end to end, saving in batches. Never throws; failures come back in `error`. */
export async function optimizeWorkImages(workId: string, deps: OptimizeDependencies): Promise<OptimizeWorkResult> {
  const result: OptimizeWorkResult = { workId, title: '', optimized: 0, bytesBefore: 0, bytesAfter: 0 };
  const shrink = deps.shrink || shrinkImageForUpload;
  const newId = deps.newId || (() => crypto.randomUUID());
  const toObjectUrl = deps.toObjectUrl || (blob => URL.createObjectURL(blob));
  const revoke = deps.revokeObjectUrl || (url => URL.revokeObjectURL(url));
  const examined = new Set<string>();
  try {
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const asset = await deps.fetchFullWork(workId);
      if (!asset) throw new Error('โหลดผลงานไม่สำเร็จ');
      result.title = asset.title || workId;
      const emojiIcon = asset.deletedAt ? null : gifIconReplacement(asset);
      const targets = planWorkImageOptimization(asset).filter(target => !examined.has(imageKey(target.url)));
      if (!targets.length && !emojiIcon) break;

      const replaced = new Map<string, OptimizedImage>();
      const objectUrls: string[] = [];
      let before = 0;
      let after = 0;
      try {
        for (const target of targets) {
          if (replaced.size >= OPTIMIZE_BATCH_SIZE) break;
          const key = imageKey(target.url);
          if (examined.has(key)) continue; // the same image used twice
          examined.add(key);
          // An image that can no longer be read (e.g. a legacy file that is gone) is skipped,
          // not fatal: the rest of the Work can still be optimized.
          let original: Blob;
          try { original = await deps.download(target.url); } catch { result.skipped = (result.skipped || 0) + 1; continue; }
          result.checked = (result.checked || 0) + 1;
          if (original.size <= OPTIMIZE_MIN_BYTES || !SHRINKABLE_TYPES.has((original.type || '').toLowerCase())) continue;
          const smaller = await shrink(original);
          if (smaller === original || smaller.size > original.size * OPTIMIZE_MIN_SAVING_RATIO) continue;
          const source = toObjectUrl(smaller);
          objectUrls.push(source);
          replaced.set(target.url, { newMediaId: newId(), source });
          before += original.size;
          after += smaller.size;
        }
        if (!replaced.size && !emojiIcon) continue;
        const { updates } = buildOptimizedWorkUpdate(asset, replaced);
        if (emojiIcon) {
          updates.icon = emojiIcon;
          updates.workMediaDraft = updates.workMediaDraft.filter(item => item.purpose !== 'icon');
        }
        const saved = await deps.updateWork(workId, updates, { requestId: newId(), expectedRevision: asset.revision });
        if (saved.error) throw new Error(saved.error);
        result.optimized += replaced.size;
        if (emojiIcon) result.gifIconReplaced = true;
        result.bytesBefore += before;
        result.bytesAfter += after;
      } finally {
        objectUrls.forEach(url => revoke(url));
      }
    }
    return result;
  } catch (error) {
    // Earlier batches of this Work are already saved; report them along with the failure.
    return { ...result, error: error instanceof Error ? error.message : 'ย่อรูปไม่สำเร็จ' };
  }
}
