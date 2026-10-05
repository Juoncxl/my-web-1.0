/**
 * Shrinks a picked image before upload so each view downloads far less.
 * Photos and screenshots are re-encoded as WebP with the long edge capped;
 * GIFs (which may be animated) and anything already small are left alone.
 * Outside a browser (tests, server) the original blob is returned untouched.
 */
export const SHRINK_MAX_EDGE = 1920;
export const SHRINK_SKIP_BELOW_BYTES = 300 * 1024;
const SHRINKABLE = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function shrinkImageForUpload(blob: Blob, quality = 0.86): Promise<Blob> {
  const type = (blob.type || '').toLowerCase();
  if (!SHRINKABLE.has(type) || blob.size < SHRINK_SKIP_BELOW_BYTES) return blob;
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return blob;
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, SHRINK_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) { bitmap.close(); return blob; }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const shrunk = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality));
    // Some browsers fall back to PNG for unsupported types; keep whichever is smaller.
    return shrunk && shrunk.size > 0 && shrunk.size < blob.size && shrunk.type === 'image/webp' ? shrunk : blob;
  } catch {
    return blob;
  }
}
