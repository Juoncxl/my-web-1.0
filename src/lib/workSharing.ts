const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

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

export async function createReferenceImageFile(
  workTitle: string,
  participantName: string,
  index: number,
  mimeType: string,
  src: string
): Promise<File> {
  const response = await fetch(src);
  if (!response.ok) throw new Error('Unable to read the reference image');
  const image = await response.blob();
  const resolvedMimeType = mimeType.split(';', 1)[0].trim() || image.type || 'image/png';
  return new File([
    image
  ], createReferenceImageFilename(workTitle, participantName, index, resolvedMimeType, src), { type: resolvedMimeType });
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
