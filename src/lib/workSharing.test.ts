import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Asset } from '../types';
import { copyPlainText, createGalleryImageFile, createGalleryImageFilename, createReferenceImageFile, createReferenceImageFilename, getImageFileExtension, getWorkShareUrl, resolveWorkDetailGalleryImages, sanitizeDownloadName, shouldUseNativeImageShare, triggerBrowserFileDownload, triggerBrowserUrlDownload } from './workSharing';

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

  it('creates descriptive gallery filenames and Files', async () => {
    expect(createGalleryImageFilename('คอลแลป X', 1, 'image/webp')).toBe('คอลแลป_X-gallery-2.webp');
    const file = await createGalleryImageFile('คอลแลป X', 1, 'image/png', 'data:image/png;base64,aGVsbG8=');
    expect(file.name).toBe('คอลแลป_X-gallery-2.png');
    expect(file.type).toBe('image/png');
    expect(await file.text()).toBe('hello');
  });

  it('keeps the selected cover first and retains Storage media metadata', () => {
    const asset = {
      previewImage: 'https://storage.example/cover',
      previewImages: ['https://storage.example/one', 'https://storage.example/cover'],
      media: [
        { id: 'one', assetId: 'work-1', storagePath: 'one.png', purpose: 'gallery', mimeType: 'image/png', fileSize: 10, sortOrder: 0, isCover: false, signedUrl: 'https://storage.example/one' },
        { id: 'cover', assetId: 'work-1', storagePath: 'cover.jpg', purpose: 'gallery', mimeType: 'image/jpeg', fileSize: 10, sortOrder: 1, isCover: true, signedUrl: 'https://storage.example/cover' }
      ]
    } as Asset;

    expect(resolveWorkDetailGalleryImages(asset, asset.previewImage)).toEqual([
      { src: 'https://storage.example/cover', mediaId: 'cover', mimeType: 'image/jpeg' },
      { src: 'https://storage.example/one', mediaId: 'one', mimeType: 'image/png' }
    ]);
  });

  it('keeps legacy gallery URLs downloadable without a media manifest', () => {
    const asset = { previewImage: 'data:image/png;base64,YQ==', previewImages: ['data:image/png;base64,YQ==', 'https://legacy.example/two.jpg'] } as Asset;
    expect(resolveWorkDetailGalleryImages(asset, asset.previewImage)).toEqual([
      { src: 'data:image/png;base64,YQ==', mediaId: undefined, mimeType: undefined },
      { src: 'https://legacy.example/two.jpg', mediaId: undefined, mimeType: undefined }
    ]);
  });

  it('copies plain text through Clipboard API and falls back to a temporary selection', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(copyPlainText('#คลองเลื่อยเหล็ก')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('#คลองเลื่อยเหล็ก');

    const textarea = { value: '', style: {}, setAttribute: vi.fn(), select: vi.fn(), remove: vi.fn() };
    const execCommand = vi.fn(() => true);
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('document', { createElement: vi.fn(() => textarea), body: { appendChild: vi.fn() }, execCommand });
    await expect(copyPlainText('#fallback')).resolves.toBe(true);
    expect(textarea.value).toBe('#fallback');
    expect(textarea.select).toHaveBeenCalledOnce();
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(textarea.remove).toHaveBeenCalledOnce();
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
