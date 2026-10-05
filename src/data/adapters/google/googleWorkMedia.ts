import { shrinkImageForUpload } from '../../../lib/imageShrink';
import type { Asset, PublicAssetCollaboration } from '../../../types';
import { isInlineMediaUrl, mediaReference } from '../../../lib/workMedia';
import type { StandardWorkMediaDraft } from '../../../lib/workMedia';
import { callGoogleBackend } from './googleTransport';

export const GOOGLE_WORK_MEDIA_CHUNK_BYTES = 2 * 1024 * 1024;
export const GOOGLE_WORK_MEDIA_MAX_BYTES = 10 * 1024 * 1024;
const SUPPORTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export type GoogleWorkAssetInput = Partial<Asset> & { workMediaDraft?: StandardWorkMediaDraft[] };
export type GooglePendingWorkMedia = StandardWorkMediaDraft & { blob: Blob; mimeType: string; fileSize: number };

export interface PreparedGoogleWorkMedia {
  asset: Partial<Asset>;
  pending: GooglePendingWorkMedia[];
}

function validUuid(value: string): boolean {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
}

async function sourceBlob(source: string, mimeType?: string): Promise<Blob> {
  const response = await fetch(source);
  if (!response.ok) throw new Error('อ่านไฟล์รูปจากฉบับร่างไม่สำเร็จ');
  const blob = await response.blob();
  return blob.type ? blob : new Blob([blob], { type: mimeType || 'image/png' });
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('เบราว์เซอร์ไม่รองรับการตรวจสอบไฟล์รูป');
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map(value => value.toString(16).padStart(2, '0')).join('');
}

function randomUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  throw new Error('เบราว์เซอร์ไม่สามารถสร้าง media identity ได้');
}

function copyAsset(asset: GoogleWorkAssetInput): GoogleWorkAssetInput {
  return JSON.parse(JSON.stringify(asset)) as GoogleWorkAssetInput;
}

/** Convert Work local media sources into canonical refs before sending them to Google. */
export async function prepareGoogleWorkMedia(input: GoogleWorkAssetInput): Promise<PreparedGoogleWorkMedia> {
  const asset = copyAsset(input);
  const drafts = [...(input.workMediaDraft || [])];
  const ids = new Set<string>();
  const pending: GooglePendingWorkMedia[] = [];
  const byMediaId = new Map<string, StandardWorkMediaDraft>();
  const attachedMediaIdForSource = (source: string): string | undefined =>
    asset.media?.find(item => item.delivery === 'vercel_proxy' && item.signedUrl === source)?.id;

  for (const draft of drafts) {
    if (!validUuid(draft.mediaId) || ids.has(draft.mediaId)) throw new Error('รายการรูปมี media identity ไม่ถูกต้อง');
    ids.add(draft.mediaId);
    byMediaId.set(draft.mediaId, draft);
    if (!isInlineMediaUrl(draft.source)) continue;
    const blob = await shrinkImageForUpload(await sourceBlob(draft.source, draft.mimeType));
    const mimeType = (blob.type || draft.mimeType || '').toLowerCase();
    if (!SUPPORTED_MIME_TYPES.has(mimeType)) throw new Error(`ไม่รองรับไฟล์ชนิด ${mimeType || 'ไม่ทราบชนิด'}`);
    if (blob.size <= 0 || blob.size > GOOGLE_WORK_MEDIA_MAX_BYTES) throw new Error('รูปต้องมีขนาดไม่เกิน 10MB ต่อไฟล์');
    pending.push({ ...draft, blob, mimeType, fileSize: blob.size });
  }

  // Hydrated display URLs (including legacy media without scope) map back to their stored ref.
  const refFromDisplayUrl = (source: string): string | undefined => {
    if (!source.includes('/api/cxl/media')) return undefined;
    try {
      const url = new URL(source, 'https://cxl.invalid');
      const ref = url.searchParams.get('ref') || '';
      return url.pathname === '/api/cxl/media' && (!asset.id || url.searchParams.get('workId') === asset.id)
        && /^(?:media:[A-Za-z0-9_-]{1,128}|cxl-media:[a-f0-9]{64})$/i.test(ref) ? ref : undefined;
    } catch { return undefined; }
  };
  const toReference = (source: string, mediaId?: string): string => {
    const displayRef = mediaId ? undefined : refFromDisplayUrl(source);
    if (displayRef?.startsWith('cxl-media:')) return displayRef;
    const id = mediaId || (source.startsWith('media:') ? source.slice('media:'.length) : '') || attachedMediaIdForSource(source)
      || (displayRef ? displayRef.slice('media:'.length) : '') || '';
    if (isInlineMediaUrl(source)) {
      const upload = id ? byMediaId.get(id) : undefined;
      if (!upload || upload.source !== source) throw new Error('รูปใน Work ไม่มี media identity ที่คงที่');
      return mediaReference(id);
    }
    return id ? mediaReference(id) : source;
  };

  if (asset.authorAvatar && isInlineMediaUrl(asset.authorAvatar)) asset.authorAvatar = undefined;

  if (asset.icon?.type === 'image' && asset.icon.value) {
    const source = asset.icon.value;
    const mediaId = asset.icon.mediaId;
    if (isInlineMediaUrl(source) && (!mediaId || byMediaId.get(mediaId)?.purpose !== 'icon')) {
      throw new Error('ไอคอนใน Work ไม่มี media identity ที่คงที่');
    }
    asset.icon = { ...asset.icon, value: toReference(source, mediaId), mediaId: mediaId || undefined, storageKey: undefined, localBlobKey: undefined };
  }

  if (asset.previewImages) {
    asset.previewImages = asset.previewImages.map((source, sortOrder) => {
      const upload = drafts.find(item => item.purpose === 'gallery' && item.sortOrder === sortOrder);
      return toReference(source, upload?.mediaId);
    });
  }
  if (asset.previewImage !== undefined) {
    const coverUpload = drafts.find(item => item.purpose === 'gallery' && item.isCover && item.source === asset.previewImage);
    asset.previewImage = asset.previewImage ? toReference(asset.previewImage, coverUpload?.mediaId) : '';
  }

  if (asset.contentBlocks) asset.contentBlocks = asset.contentBlocks.map(block => {
    if (block.type !== 'Image' || !block.body) return block;
    const matching = drafts.find(item => item.purpose === 'prompt_example' && item.contextId === block.id);
    const mediaId = block.mediaId || matching?.mediaId;
    const body = toReference(block.body, mediaId);
    if (body !== block.body && asset.content) asset.content = asset.content.split(block.body).join(body);
    return { ...block, body, mediaId: mediaId || undefined, localBlobKey: undefined };
  });

  const rewriteCollaboration = <T extends PublicAssetCollaboration | NonNullable<Asset['collaboration']>>(
    collaboration: T | null | undefined
  ): T | null | undefined => {
    if (!collaboration) return collaboration;
    const cloned = JSON.parse(JSON.stringify(collaboration)) as T;
    cloned.participants = (cloned.participants || []).map(participant => ({
      ...participant,
      referenceImages: (participant.referenceImages || []).map((image, sortOrder) => {
        const matching = drafts.find(item => item.purpose === 'collab_reference'
          && item.contextId === participant.id && item.sortOrder === sortOrder);
        const mediaId = image.mediaId || matching?.mediaId;
        return {
          ...image,
          src: toReference(image.src, mediaId),
          mediaId: mediaId || undefined,
          localBlobKey: undefined
        };
      })
    }));
    return cloned;
  };

  asset.collaboration = rewriteCollaboration(asset.collaboration);
  asset.publicCollaboration = rewriteCollaboration(asset.publicCollaboration);

  delete (asset as GoogleWorkAssetInput).workMediaDraft;
  return { asset, pending };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export interface GoogleWorkMediaUploadOptions {
  workId: string;
}

function mediaIdFromRef(value: string | undefined): string | null {
  const match = typeof value === 'string' ? value.match(/^media:([A-Za-z0-9_-]{1,128})$/) : null;
  return match?.[1] || null;
}

export function googleWorkMediaProxyUrl(workId: string, mediaId: string, scope: 'owner' | 'public', version?: string): string {
  const params = new URLSearchParams({ scope, workId, ref: mediaReference(mediaId) });
  if (version) params.set('v', version);
  return `/api/cxl/media?${params.toString()}`;
}

/** Convert attached Work proxy media into display URLs in a read object. */
export function hydrateGoogleWorkMedia(asset: Asset): Asset {
  const scope = asset.visibility === 'public' && asset.isPublic === true && !asset.deletedAt ? 'public' : 'owner';
  const updatedAtMs = Date.parse(asset.updatedAt || asset.createdAt);
  const version = Number.isFinite(updatedAtMs) ? String(updatedAtMs) : undefined;
  const records = (asset.media || []).filter(item => item.delivery === 'vercel_proxy'
    && item.assetId === asset.id && ['icon', 'gallery', 'prompt_example', 'collab_reference'].includes(item.purpose));
  // Migrated (legacy) media records carry a Drive file but no vercel_proxy delivery;
  // they are served by the legacy /api/cxl/media route instead of staying raw `media:` refs.
  const legacyIds = new Set((asset.media || []).filter(item => item.delivery !== 'vercel_proxy' && item.id).map(item => item.id));
  if (!records.length && !legacyIds.size) return asset;

  const urlFor = (id: string | null) => {
    if (!id) return undefined;
    const item = records.find(record => record.id === id);
    if (item) return googleWorkMediaProxyUrl(asset.id, item.id, scope, version);
    if (!legacyIds.has(id)) return undefined;
    const params = new URLSearchParams({ workId: asset.id, ref: mediaReference(id) });
    if (version) params.set('v', version);
    return `/api/cxl/media?${params.toString()}`;
  };
  const media = (asset.media || []).map(item => {
    const signedUrl = item.delivery === 'vercel_proxy' && item.assetId === asset.id
      && ['icon', 'gallery', 'prompt_example', 'collab_reference'].includes(item.purpose)
      ? googleWorkMediaProxyUrl(asset.id, item.id, scope, version) : item.signedUrl;
    return signedUrl ? { ...item, signedUrl } : item;
  });

  const iconId = asset.icon?.type === 'image'
    ? asset.icon.mediaId || mediaIdFromRef(asset.icon.value)
    : null;
  const iconUrl = urlFor(iconId);
  const previewImages = asset.previewImages?.map(source => {
    const id = mediaIdFromRef(source);
    return urlFor(id) || source;
  });
  const previewImageId = mediaIdFromRef(asset.previewImage);
  const coverRecord = records.find(item => item.purpose === 'gallery' && item.isCover);
  const previewImage = urlFor(previewImageId)
    || (!asset.previewImage && coverRecord ? urlFor(coverRecord.id) : undefined)
    || asset.previewImage;
  const contentBlocks = asset.contentBlocks?.map(block => {
    if (block.type !== 'Image') return block;
    const id = block.mediaId || mediaIdFromRef(block.body);
    const imageUrl = urlFor(id);
    return imageUrl ? { ...block, body: imageUrl, mediaId: id || undefined } : block;
  });
  const hydrateCollaboration = <T extends PublicAssetCollaboration | NonNullable<Asset['collaboration']>>(
    collaboration: T | null | undefined
  ): T | null | undefined => {
    if (!collaboration) return collaboration;
    // Owner summary rows carry participant placeholders (`{}`) without referenceImages.
    return {
      ...collaboration,
      participants: (collaboration.participants || []).map(participant => ({
        ...participant,
        referenceImages: (participant.referenceImages || []).map(image => {
          const id = image.mediaId || mediaIdFromRef(image.src);
          const src = urlFor(id) || image.src;
          return { ...image, src, mediaId: id || undefined };
        })
      }))
    } as T;
  };

  return {
    ...asset,
    media,
    icon: iconUrl && asset.icon?.type === 'image'
      ? { ...asset.icon, value: iconUrl, mediaId: iconId || undefined,
        mimeType: records.find(item => item.id === iconId)?.mimeType || asset.icon.mimeType }
      : asset.icon,
    ...(previewImages ? { previewImages } : {}),
    ...(previewImage !== undefined ? { previewImage } : {}),
    ...(contentBlocks ? { contentBlocks } : {}),
    collaboration: hydrateCollaboration(asset.collaboration),
    publicCollaboration: hydrateCollaboration(asset.publicCollaboration)
  };
}

export function hydrateGoogleWorkMediaResult<T extends { data?: Asset | Asset[] | null }>(result: T): T {
  if (Array.isArray(result.data)) return { ...result, data: result.data.map(hydrateGoogleWorkMedia) } as T;
  if (result.data && typeof result.data === 'object') return { ...result, data: hydrateGoogleWorkMedia(result.data) } as T;
  return result;
}

/** Files upload up to three at a time; each file sends its <=2 MiB chunks in order. */
export async function uploadGoogleWorkMedia(
  pending: GooglePendingWorkMedia[],
  { workId }: GoogleWorkMediaUploadOptions
): Promise<string[]> {
  let next = 0;
  const worker = async () => {
    while (next < pending.length) await uploadOneGoogleWorkMedia(pending[next++], workId);
  };
  await Promise.all(Array.from({ length: Math.min(3, pending.length) }, worker));
  return pending.map(item => item.mediaId);
}

/** A lost upload session (busy Drive, or a step that could not reach the direct path) is restarted. */
const UPLOAD_RESTART_CODES = new Set(['MEDIA_UPLOAD_SESSION_NOT_FOUND', 'MEDIA_UPLOAD_RETRY']);
const UPLOAD_ATTEMPTS = 3;

async function uploadOneGoogleWorkMedia(item: GooglePendingWorkMedia, workId: string): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await uploadOneGoogleWorkMediaAttempt(item, workId);
      return;
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code || '') : '';
      if (attempt >= UPLOAD_ATTEMPTS || !UPLOAD_RESTART_CODES.has(code)) throw error;
      await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
    }
  }
}

async function uploadOneGoogleWorkMediaAttempt(item: GooglePendingWorkMedia, workId: string): Promise<void> {
  const bytes = new Uint8Array(await item.blob.arrayBuffer());
    const sha256 = await sha256Hex(bytes);
    const totalChunks = Math.ceil(bytes.length / GOOGLE_WORK_MEDIA_CHUNK_BYTES);
    const begin = await callGoogleBackend<{ uploadId: string; finalized?: boolean }>('media.upload.begin', [{
      uploadId: randomUuid(), mediaId: item.mediaId, workId,
      totalFileSize: bytes.length, rawChunkSize: GOOGLE_WORK_MEDIA_CHUNK_BYTES, totalChunks,
      mimeType: item.mimeType, sha256, purpose: item.purpose,
      contextId: item.contextId || null, sortOrder: item.sortOrder, isCover: item.isCover
    }]);

    if (!begin.finalized) {
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
        const start = chunkIndex * GOOGLE_WORK_MEDIA_CHUNK_BYTES;
        const chunk = bytes.subarray(start, Math.min(bytes.length, start + GOOGLE_WORK_MEDIA_CHUNK_BYTES));
        const chunkSha256 = await sha256Hex(chunk);
        await callGoogleBackend('media.upload.chunk', [{
          uploadId: begin.uploadId, chunkIndex, base64: bytesToBase64(chunk), sha256: chunkSha256
        }]);
      }
      // mediaId lets the server confirm a stalled finalize from Drive; it is not sent to Apps Script.
      await callGoogleBackend('media.upload.finalize', [{ uploadId: begin.uploadId, mediaId: item.mediaId }]);
    }
}
