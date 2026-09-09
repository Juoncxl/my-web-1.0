import { afterEach, describe, expect, it, vi } from 'vitest';
import { createReferenceImageFile, createReferenceImageFilename, getImageFileExtension, getWorkShareUrl, sanitizeDownloadName, shouldUseNativeImageShare, triggerBrowserFileDownload, triggerBrowserUrlDownload } from './workSharing';

afterEach(() => vi.unstubAllGlobals());

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

  it('turns a data URL into a named image File for mobile saving', async () => {
    const file = await createReferenceImageFile('คอลแลป X', 'Juon', 0, 'image/png', 'data:image/png;base64,aGVsbG8=');
    expect(file.name).toBe('คอลแลป_X-Juon-reference-1.png');
    expect(file.type).toBe('image/png');
    expect(await file.text()).toBe('hello');
  });

  it('uses the native save sheet only on iOS and iPad desktop-mode Safari', () => {
    expect(shouldUseNativeImageShare('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe(true);
    expect(shouldUseNativeImageShare('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);
    expect(shouldUseNativeImageShare('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36')).toBe(false);
    expect(shouldUseNativeImageShare('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(false);
  });

  it('uses a direct URL download for signed Storage URLs on Android and desktop', () => {
    const anchor = { href: '', download: '', rel: '', click: vi.fn(), remove: vi.fn() };
    const appendChild = vi.fn();
    vi.stubGlobal('document', { createElement: vi.fn(() => anchor), body: { appendChild } });

    expect(triggerBrowserUrlDownload('https://storage.example/signed-image', 'reference.jpg')).toBe(true);
    expect(anchor.href).toBe('https://storage.example/signed-image');
    expect(anchor.download).toBe('reference.jpg');
    expect(anchor.rel).toBe('noopener');
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(anchor.remove).toHaveBeenCalledOnce();
  });

  it('falls back to a Blob URL download without navigating to a data URL', () => {
    const anchor = { href: '', download: '', rel: '', click: vi.fn(), remove: vi.fn() };
    const appendChild = vi.fn();
    const createObjectURL = vi.fn(() => 'blob:reference-image');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('document', { createElement: vi.fn(() => anchor), body: { appendChild } });
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

    expect(triggerBrowserFileDownload(new File(['image'], 'reference.png', { type: 'image/png' }))).toBe(true);
    expect(anchor.href).toBe('blob:reference-image');
    expect(anchor.download).toBe('reference.png');
    expect(appendChild).toHaveBeenCalledWith(anchor);
    expect(anchor.click).toHaveBeenCalledOnce();
  });
});
