import type { Asset } from '../types';
import { mediaIdFromReference } from './workMedia';

const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

export interface WorkDetailGalleryImage {
  src: string;
  mediaId?: string;
  mimeType?: string;
}

export function resolveWorkDetailGalleryImages(asset: Asset, requestedCover = ''): WorkDetailGalleryImage[] {
  const galleryRecords = [...(asset.media || [])]
    .filter(item => item.purpose === 'gallery')
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const sourceImages = asset.previewImages?.length
    ? asset.previewImages.filter(Boolean)
    : asset.previewImage ? [asset.previewImage] : [];
  const sources = requestedCover
    ? [requestedCover, ...sourceImages.filter(image => image !== requestedCover)]
    : sourceImages;

  return sources
    .filter((src, index) => Boolean(src) && sources.indexOf(src) === index)
    .map(src => {
      const referencedId = mediaIdFromReference(src);
      const record = galleryRecords.find(item => item.id === referencedId || item.signedUrl === src)
        || (src === requestedCover && requestedCover === asset.previewImage ? galleryRecords.find(item => item.isCover) : undefined);
      return { src, mediaId: record?.id, mimeType: record?.mimeType };
    });
}

export function getWorkShareUrl(assetId: string, origin = ''): string {
  const normalizedOrigin = origin.replace(/\/+$/u, '');
  return `${normalizedOrigin}/work/${encodeURIComponent(assetId)}`;
}

export function sanitizeDownloadName(value: string, fallback: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9ก-๙_-]+/gu, '_').replace(/^_+|_+$/gu, '');
  return /[a-zA-Z0-9ก-๙]/u.test(normalized) ? normalized : fallback;
}

export function getImageFileExtension(mimeType = '', src = ''): string {
  const normalizedMimeType = mimeType.split(';', 1)[0].trim().toLowerCase();
  if (IMAGE_EXTENSION_BY_MIME[normalizedMimeType]) return IMAGE_EXTENSION_BY_MIME[normalizedMimeType];

  const dataUrlMimeType = src.match(/^data:([^;,]+)/iu)?.[1]?.toLowerCase();
  if (dataUrlMimeType && IMAGE_EXTENSION_BY_MIME[dataUrlMimeType]) return IMAGE_EXTENSION_BY_MIME[dataUrlMimeType];

  return 'png';
}

export function createReferenceImageFilename(
  workTitle: string,
  participantName: string,
  index: number,
  mimeType = '',
  src = ''
): string {
  const work = sanitizeDownloadName(workTitle, 'cxl-work');
  const participant = sanitizeDownloadName(participantName, 'participant');
  const extension = getImageFileExtension(mimeType, src);
  return `${work}-${participant}-reference-${Math.max(0, index) + 1}.${extension}`;
}

export function createGalleryImageFilename(
  workTitle: string,
  index: number,
  mimeType = '',
  src = ''
): string {
  const work = sanitizeDownloadName(workTitle, 'cxl-work');
  const extension = getImageFileExtension(mimeType, src);
  return `${work}-gallery-${Math.max(0, index) + 1}.${extension}`;
}

async function createImageFile(filename: string, mimeType: string, src: string): Promise<File> {
  const response = await fetch(src);
  if (!response.ok) throw new Error('Unable to read the image');
  const image = await response.blob();
  const resolvedMimeType = mimeType.split(';', 1)[0].trim() || image.type || 'image/png';
  return new File([image], filename.replace(/\.[^.]+$/u, `.${getImageFileExtension(resolvedMimeType, src)}`), { type: resolvedMimeType });
}

export async function createReferenceImageFile(
  workTitle: string,
  participantName: string,
  index: number,
  mimeType: string,
  src: string
): Promise<File> {
  return createImageFile(createReferenceImageFilename(workTitle, participantName, index, mimeType, src), mimeType, src);
}

export async function createGalleryImageFile(
  workTitle: string,
  index: number,
  mimeType: string,
  src: string
): Promise<File> {
  return createImageFile(createGalleryImageFilename(workTitle, index, mimeType, src), mimeType, src);
}

export async function copyPlainText(value: string): Promise<boolean> {
  if (!value) return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Continue to the selection fallback for browsers that block Clipboard API.
  }

  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false;
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

export function shouldUseNativeImageShare(userAgent: string, maxTouchPoints = 0): boolean {
  // iOS/iPadOS exposes "Save Image" in its native share sheet. Android share
  // targets are OEM/app dependent, so Android uses a direct file download.
  return /iPad|iPhone|iPod/i.test(userAgent) || (maxTouchPoints > 1 && /Macintosh/i.test(userAgent));
}

export function triggerBrowserUrlDownload(source: string, filename: string): boolean {
  if (typeof document === 'undefined' || !source) return false;
  const anchor = document.createElement('a');
  anchor.href = source;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return true;
}

export function triggerBrowserFileDownload(file: File): boolean {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return false;
  const objectUrl = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = file.name;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  globalThis.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  return true;
}
