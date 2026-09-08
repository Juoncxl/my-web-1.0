import { describe, expect, it } from 'vitest';
import { createReferenceImageFilename, getImageFileExtension, getWorkShareUrl, sanitizeDownloadName } from './workSharing';

describe('Work sharing and reference image downloads', () => {
  it('creates a direct Work URL and encodes the asset id', () => {
    expect(getWorkShareUrl('work/a b', 'https://cxlstudio.vercel.app/')).toBe('https://cxlstudio.vercel.app/work/work%2Fa%20b');
    expect(getWorkShareUrl('work-1')).toBe('/work/work-1');
  });

  it('sanitizes download names without losing Thai text', () => {
    expect(sanitizeDownloadName('  ลิบรา / Libra  ', 'fallback')).toBe('ลิบรา_Libra');
    expect(sanitizeDownloadName('---', 'fallback')).toBe('fallback');
  });

  it('resolves supported image extensions from MIME types and data URLs', () => {
    expect(getImageFileExtension('image/jpeg')).toBe('jpg');
    expect(getImageFileExtension('', 'data:image/webp;base64,abc')).toBe('webp');
    expect(getImageFileExtension('image/unknown')).toBe('png');
  });

  it('creates a descriptive per-reference filename', () => {
    expect(createReferenceImageFilename('คอลแลป X', 'Juon', 0, 'image/jpeg')).toBe('คอลแลป_X-Juon-reference-1.jpg');
  });
});
