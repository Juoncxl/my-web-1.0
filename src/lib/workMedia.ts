import type { Asset, AssetMediaPurpose, AssetMediaRecord, PublicAssetCollaboration } from '../types';
import { getSupabaseClient } from './supabaseClient';

export const WORK_MEDIA_BUCKET = 'work-media';
export const WORK_MEDIA_SIGNED_URL_SECONDS = 60 * 60;
const SIGNED_URL_CACHE_MS = 50 * 60 * 1000;
const MAX_CONCURRENT_UPLOADS = 3;
const MEDIA_REF_PREFIX = 'media:';
const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

type PendingMedia = {
  blob: Blob;
  record: AssetMediaRecord;
};

export type PreparedAssetMedia = {
  asset: Asset;
  pending: PendingMedia[];
};

type SignedCacheEntry = { url: string; expiresAt: number };
const signedUrlCache = new Map<string, SignedCacheEntry>();

function cloneAsset(asset: Asset): Asset {
  return JSON.parse(JSON.stringify(asset)) as Asset;
}

function createMediaId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, token => {
    const value = Math.floor(Math.random() * 16);
    return (token === 'x' ? value : (value & 0x3) | 0x8).toString(16);
  });
}

export function isInlineMediaUrl(value: unknown): value is string {
  return typeof value === 'string' && (/^data:image\//i.test(value) || /^blob:/i.test(value));
}

export function mediaReference(mediaId: string): string {
  return `${MEDIA_REF_PREFIX}${mediaId}`;
}

export function mediaIdFromReference(value: unknown): string | null {
  return typeof value === 'string' && value.startsWith(MEDIA_REF_PREFIX)
    ? value.slice(MEDIA_REF_PREFIX.length) || null
    : null;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const match = dataUrl.match(/^data:([^;,]+)(;base64)?,(.*)$/s);
  if (!match) throw new Error('รูปแบบ data URL ไม่ถูกต้อง');
  const mimeType = match[1].toLowerCase();
  if (!SUPPORTED_TYPES.has(mimeType)) throw new Error(`ไม่รองรับไฟล์ชนิด ${mimeType}`);
  const raw = match[2]
    ? atob(match[3])
    : decodeURIComponent(match[3]);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

async function urlToBlob(url: string, mimeType?: string): Promise<Blob> {
  if (url.startsWith('data:')) return dataUrlToBlob(url);
  const response = await fetch(url);
  if (!response.ok) throw new Error('อ่านไฟล์รูปจากฉบับร่างไม่สำเร็จ');
  const blob = await response.blob();
  return blob.type ? blob : new Blob([blob], { type: mimeType || 'image/png' });
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/webp') return 'webp';
  return 'png';
}

function mapMediaRow(row: any): AssetMediaRecord {
  return {
    id: row.id,
    assetId: row.asset_id,
    storagePath: row.storage_path,
    purpose: row.purpose,
    contextId: row.context_id,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size || 0),
    sortOrder: Number(row.sort_order || 0),
    isCover: Boolean(row.is_cover),
    naturalWidth: row.natural_width || undefined,
    naturalHeight: row.natural_height || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function manifestPayload(record: AssetMediaRecord) {
  return {
    id: record.id,
    asset_id: record.assetId,
    storage_path: record.storagePath,
    purpose: record.purpose,
    context_id: record.contextId || null,
    mime_type: record.mimeType,
    file_size: record.fileSize,
    sort_order: record.sortOrder,
    is_cover: record.isCover,
    natural_width: record.naturalWidth || null,
    natural_height: record.naturalHeight || null
  };
}

export async function prepareAssetMedia(asset: Asset, userId: string): Promise<PreparedAssetMedia> {
  const next = cloneAsset(asset);
  // Creator avatars are hydrated from the canonical public profile resolver.
  // The local profile image store may expose that avatar as an origin-bound
  // blob URL, but it is not Work media and must never block or enter a Work
  // payload.
  if (isInlineMediaUrl(next.authorAvatar)) next.authorAvatar = undefined;
  const pending: PendingMedia[] = [];
  const pendingBySource = new Map<string, PendingMedia>();
  const existing = asset.media || [];

  const prepare = async (input: {
    source: string;
    mediaId?: string;
    purpose: AssetMediaPurpose;
    contextId?: string | null;
    sortOrder: number;
    isCover?: boolean;
    mimeType?: string;
    naturalWidth?: number;
    naturalHeight?: number;
  }): Promise<{ ref: string; mediaId?: string }> => {
    const referenceId = input.mediaId || mediaIdFromReference(input.source);
    if (referenceId) return { ref: mediaReference(referenceId), mediaId: referenceId };

    const matching = existing.find(item => item.signedUrl === input.source) || existing.find(item =>
      item.purpose === input.purpose
      && item.sortOrder === input.sortOrder
      && (item.contextId || null) === (input.contextId || null)
      && (!item.signedUrl || item.signedUrl === input.source)
    );
    if (!isInlineMediaUrl(input.source)) {
      return matching
        ? { ref: mediaReference(matching.id), mediaId: matching.id }
        : { ref: input.source };
    }

    const sourceKey = `${input.purpose}:${input.contextId || ''}:${input.sortOrder}:${input.source}`;
    const shared = pendingBySource.get(sourceKey);
    if (shared) return { ref: mediaReference(shared.record.id), mediaId: shared.record.id };
    const blob = await urlToBlob(input.source, input.mimeType);
    const mimeType = (blob.type || input.mimeType || 'image/png').toLowerCase();
    if (!SUPPORTED_TYPES.has(mimeType)) throw new Error(`ไม่รองรับไฟล์ชนิด ${mimeType}`);
    if (blob.size <= 0 || blob.size > 10 * 1024 * 1024) throw new Error('รูปต้องมีขนาดไม่เกิน 10MB ต่อไฟล์');
    const id = createMediaId();
    const storagePath = `${userId}/${asset.id}/${id}.${extensionForMimeType(mimeType)}`;
    const item: PendingMedia = {
      blob,
      record: {
        id,
        assetId: asset.id,
        storagePath,
        purpose: input.purpose,
        contextId: input.contextId || null,
        mimeType,
        fileSize: blob.size,
        sortOrder: input.sortOrder,
        isCover: Boolean(input.isCover),
        naturalWidth: input.naturalWidth,
        naturalHeight: input.naturalHeight
      }
    };
    pending.push(item);
    pendingBySource.set(sourceKey, item);
    return { ref: mediaReference(id), mediaId: id };
  };

  if (next.icon.type === 'image' && next.icon.value) {
    const result = await prepare({ source: next.icon.value, mediaId: next.icon.mediaId, purpose: 'icon', sortOrder: 0, mimeType: next.icon.mimeType });
    next.icon = { ...next.icon, value: result.ref, mediaId: result.mediaId, storageKey: undefined, localBlobKey: undefined };
  }

  const originalPreviewImages = [...(next.previewImages || [])];
  const coverSource = next.previewImage || originalPreviewImages[0] || '';
  const preparedGallery = await Promise.all(originalPreviewImages.map(async (source, sortOrder) => {
    const result = await prepare({ source, purpose: 'gallery', sortOrder, isCover: source === coverSource });
    return result.ref;
  }));
  next.previewImages = preparedGallery;
  next.previewImage = preparedGallery[originalPreviewImages.indexOf(coverSource)] || preparedGallery[0] || '';

  next.contentBlocks = await Promise.all((next.contentBlocks || []).map(async (block, sortOrder) => {
    if (block.type !== 'Image' || !block.body) return block;
    const originalSource = block.body;
    const result = await prepare({ source: block.body, mediaId: block.mediaId, purpose: 'prompt_example', contextId: block.id, sortOrder });
    if (originalSource !== result.ref) next.content = next.content.split(originalSource).join(result.ref);
    return { ...block, body: result.ref, mediaId: result.mediaId, localBlobKey: undefined };
  }));

  const prepareCollaboration = async <T extends PublicAssetCollaboration | NonNullable<Asset['collaboration']>>(collaboration: T | null | undefined): Promise<T | null | undefined> => {
    if (!collaboration) return collaboration;
    const cloned = JSON.parse(JSON.stringify(collaboration)) as T;
    for (const participant of cloned.participants) {
      participant.referenceImages = await Promise.all(participant.referenceImages.map(async (image, sortOrder) => {
        const result = await prepare({
          source: image.src,
          mediaId: image.mediaId,
          purpose: 'collab_reference',
          contextId: participant.id,
          sortOrder,
          mimeType: image.mimeType,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight
        });
        return { ...image, src: result.ref, mediaId: result.mediaId, localBlobKey: undefined };
      }));
    }
    return cloned;
  };

  next.collaboration = await prepareCollaboration(next.collaboration);
  next.publicCollaboration = await prepareCollaboration(next.publicCollaboration);
  next.media = [...existing, ...pending.map(item => item.record)];
  assertNoInlineWorkMedia(next);
  return { asset: next, pending };
}

/** Validate the complete Work payload while excluding the creator avatar,
 * which belongs to the canonical Profile media pipeline. */
export function assertNoInlineWorkMedia(asset: Asset): void {
  const { authorAvatar: _profileOwnedAvatar, ...workPayload } = asset;
  assertNoInlineMedia(workPayload);
}

export function assertNoInlineMedia(value: unknown): void {
  const visit = (item: unknown, path: string) => {
    if (isInlineMediaUrl(item)) throw new Error(`พบรูปที่ยังไม่ได้อัปโหลดใน ${path}`);
    if (Array.isArray(item)) item.forEach((child, index) => visit(child, `${path}[${index}]`));
    else if (item && typeof item === 'object') Object.entries(item as Record<string, unknown>)
      .filter(([key]) => key !== 'signedUrl')
      .forEach(([key, child]) => visit(child, `${path}.${key}`));
  };
  visit(value, 'asset');
}

export function collectReferencedMediaIds(asset: Asset): Set<string> {
  const ids = new Set<string>();
  const visit = (item: unknown, key = '') => {
    if (key === 'media') return;
    if (typeof item === 'string') {
      const id = mediaIdFromReference(item);
      if (id) ids.add(id);
      return;
    }
    if (Array.isArray(item)) item.forEach(child => visit(child));
    else if (item && typeof item === 'object') Object.entries(item as Record<string, unknown>).forEach(([childKey, child]) => {
      if (childKey === 'mediaId' && typeof child === 'string') ids.add(child);
      else visit(child, childKey);
    });
  };
  visit(asset);
  return ids;
}

async function runWithConcurrency<T>(items: T[], worker: (item: T, index: number) => Promise<void>): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(MAX_CONCURRENT_UPLOADS, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

export async function uploadPreparedMedia(prepared: PreparedAssetMedia): Promise<AssetMediaRecord[]> {
  if (!prepared.pending.length) return [];
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('ระบบ Storage ยังไม่พร้อมใช้งาน');
  const uploadedPaths: string[] = [];
  try {
    await runWithConcurrency(prepared.pending, async (item, index) => {
      const { error } = await supabase.storage.from(WORK_MEDIA_BUCKET).upload(item.record.storagePath, item.blob, {
        contentType: item.record.mimeType,
        cacheControl: '3600',
        upsert: false
      });
      if (error) throw new Error(`อัปโหลดรูป ${index + 1}/${prepared.pending.length} ไม่สำเร็จ: ${error.message}`);
      uploadedPaths.push(item.record.storagePath);
    });
    const { error: manifestError } = await supabase.from('asset_media').insert(prepared.pending.map(item => manifestPayload(item.record)));
    if (manifestError) throw new Error(`บันทึกรายการรูปไม่สำเร็จ: ${manifestError.message}`);
    return prepared.pending.map(item => item.record);
  } catch (error) {
    if (uploadedPaths.length) await supabase.storage.from(WORK_MEDIA_BUCKET).remove(uploadedPaths);
    throw error;
  }
}

export async function cleanupNewMedia(records: AssetMediaRecord[]): Promise<void> {
  if (!records.length) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;
  await supabase.from('asset_media').delete().in('id', records.map(item => item.id));
  await supabase.storage.from(WORK_MEDIA_BUCKET).remove(records.map(item => item.storagePath));
  records.forEach(item => signedUrlCache.delete(item.storagePath));
}

export async function listAssetMediaForDeletion(assetIds: string | string[]): Promise<AssetMediaRecord[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const ids = Array.isArray(assetIds) ? assetIds : [assetIds];
  if (!ids.length) return [];
  try {
    const { data } = await supabase.from('asset_media').select('*').in('asset_id', ids);
    return (data || []).map(mapMediaRow);
  } catch {
    // Backward-compatible test/local clients may not expose the additive table yet.
    return [];
  }
}

export async function removeAssetMediaObjects(records: AssetMediaRecord[]): Promise<void> {
  if (!records.length) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase.storage.from(WORK_MEDIA_BUCKET).remove(records.map(item => item.storagePath));
  if (error) throw new Error(`ล้างไฟล์ของผลงานไม่สำเร็จ: ${error.message}`);
  records.forEach(item => signedUrlCache.delete(item.storagePath));
}

async function signRecords(records: AssetMediaRecord[], force = false): Promise<AssetMediaRecord[]> {
  const supabase = getSupabaseClient();
  if (!supabase || !records.length) return records;
  const now = Date.now();
  const missing = records.filter(item => force || !signedUrlCache.get(item.storagePath) || signedUrlCache.get(item.storagePath)!.expiresAt <= now);
  if (missing.length) {
    const { data, error } = await supabase.storage.from(WORK_MEDIA_BUCKET).createSignedUrls(missing.map(item => item.storagePath), WORK_MEDIA_SIGNED_URL_SECONDS);
    if (!error && data) data.forEach((result, index) => {
      if (result.signedUrl) signedUrlCache.set(missing[index].storagePath, { url: result.signedUrl, expiresAt: now + SIGNED_URL_CACHE_MS });
    });
  }
  return records.map(item => ({ ...item, signedUrl: signedUrlCache.get(item.storagePath)?.url }));
}

function hydrateCollaboration<T extends PublicAssetCollaboration | NonNullable<Asset['collaboration']>>(collaboration: T | null | undefined, records: AssetMediaRecord[]): T | null | undefined {
  if (!collaboration) return collaboration;
  const next = JSON.parse(JSON.stringify(collaboration)) as T;
  next.participants.forEach(participant => {
    const participantRecords = records.filter(item => item.purpose === 'collab_reference' && item.contextId === participant.id).sort((a, b) => a.sortOrder - b.sortOrder);
    participant.referenceImages = participant.referenceImages.map((image, index) => {
      const id = image.mediaId || mediaIdFromReference(image.src);
      const record = records.find(item => item.id === id) || participantRecords[index];
      return record?.signedUrl ? { ...image, src: record.signedUrl, mediaId: record.id, mimeType: record.mimeType, naturalWidth: record.naturalWidth, naturalHeight: record.naturalHeight } : image;
    });
  });
  return next;
}

export async function hydrateAssetMedia(assets: Asset[], force = false, summaryOnly = false): Promise<Asset[]> {
  if (!assets.length) return assets;
  const supabase = getSupabaseClient();
  if (!supabase) return assets;
  const { data, error } = await supabase.from('asset_media').select('*').in('asset_id', assets.map(asset => asset.id));
  if (error || !data?.length) return assets;
  let manifest = data.map(mapMediaRow);
  if (summaryOnly) {
    const referencedCoverIds = new Set(assets.map(asset => mediaIdFromReference(asset.previewImage)).filter((id): id is string => Boolean(id)));
    manifest = manifest.filter(item => item.purpose === 'icon' || item.isCover || referencedCoverIds.has(item.id));
  }
  const records = await signRecords(manifest, force);
  return assets.map(asset => {
    const own = records.filter(item => item.assetId === asset.id);
    const galleryFallback = own.filter(item => item.purpose === 'gallery').sort((a, b) => a.sortOrder - b.sortOrder);
    const galleryFromRefs = (asset.previewImages || []).map(value => {
      const id = mediaIdFromReference(value);
      return own.find(item => item.id === id);
    }).filter((item): item is AssetMediaRecord => Boolean(item));
    const gallery = galleryFromRefs.length ? galleryFromRefs : galleryFallback;
    const coverId = mediaIdFromReference(asset.previewImage);
    const cover = own.find(item => item.id === coverId) || gallery.find(item => item.isCover) || gallery[0];
    const icon = own.find(item => item.purpose === 'icon');
    const blocks = (asset.contentBlocks || []).map(block => {
      if (block.type !== 'Image') return block;
      const id = block.mediaId || mediaIdFromReference(block.body);
      const record = own.find(item => item.id === id) || own.find(item => item.purpose === 'prompt_example' && item.contextId === block.id);
      return record?.signedUrl ? { ...block, body: record.signedUrl, mediaId: record.id } : block;
    });
    return {
      ...asset,
      media: own,
      icon: icon?.signedUrl ? { ...asset.icon, type: 'image', value: icon.signedUrl, mediaId: icon.id, mimeType: icon.mimeType } : asset.icon,
      previewImages: gallery.length ? gallery.map(item => item.signedUrl || mediaReference(item.id)) : asset.previewImages,
      previewImage: cover?.signedUrl || asset.previewImage,
      contentBlocks: blocks,
      collaboration: hydrateCollaboration(asset.collaboration, own),
      publicCollaboration: hydrateCollaboration(asset.publicCollaboration, own)
    };
  });
}

export async function getFreshMediaDownload(mediaId: string, filename?: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data: row, error } = await supabase.from('asset_media').select('storage_path').eq('id', mediaId).maybeSingle();
  if (error || !row) return null;
  const { data, error: signError } = await supabase.storage.from(WORK_MEDIA_BUCKET).createSignedUrl(row.storage_path, 5 * 60, filename ? { download: filename } : undefined);
  return signError ? null : data.signedUrl;
}

function replaceMediaIds<T>(value: T, idMap: Map<string, string>): T {
  const visit = (item: unknown): unknown => {
    if (typeof item === 'string') {
      const oldId = mediaIdFromReference(item);
      return oldId && idMap.has(oldId) ? mediaReference(idMap.get(oldId)!) : item;
    }
    if (Array.isArray(item)) return item.map(visit);
    if (item && typeof item === 'object') {
      const output: Record<string, unknown> = {};
      Object.entries(item as Record<string, unknown>).forEach(([key, child]) => {
        output[key] = key === 'mediaId' && typeof child === 'string' && idMap.has(child) ? idMap.get(child)! : visit(child);
      });
      return output;
    }
    return item;
  };
  return visit(value) as T;
}

/** Copy canonical files so a fork never depends on its source owner's objects. */
export async function cloneAssetMediaForFork(source: Asset, target: Asset, userId: string): Promise<{ asset: Asset; created: AssetMediaRecord[] }> {
  const sourceRecords = source.media || [];
  if (!sourceRecords.length) {
    const prepared = await prepareAssetMedia(target, userId);
    const created = await uploadPreparedMedia(prepared);
    return { asset: prepared.asset, created };
  }
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('ระบบ Storage ยังไม่พร้อมใช้งาน');
  const idMap = new Map<string, string>();
  const pending: PendingMedia[] = [];
  for (const record of sourceRecords) {
    const { data: blob, error } = await supabase.storage.from(WORK_MEDIA_BUCKET).download(record.storagePath);
    if (error || !blob) throw new Error(`คัดลอกรูปของผลงานไม่สำเร็จ: ${error?.message || 'อ่านไฟล์ไม่ได้'}`);
    const id = createMediaId();
    idMap.set(record.id, id);
    pending.push({
      blob,
      record: {
        ...record,
        id,
        assetId: target.id,
        storagePath: `${userId}/${target.id}/${id}.${extensionForMimeType(record.mimeType)}`,
        signedUrl: undefined,
        createdAt: undefined,
        updatedAt: undefined
      }
    });
  }
  const asset = replaceMediaIds(target, idMap);
  asset.media = pending.map(item => item.record);
  const created = await uploadPreparedMedia({ asset, pending });
  return { asset, created };
}
