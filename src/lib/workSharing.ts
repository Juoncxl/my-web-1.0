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
