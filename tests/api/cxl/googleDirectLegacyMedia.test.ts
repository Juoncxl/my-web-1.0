import { generateKeyPairSync } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const WORK = 'asset_1787157835769_rzw94';
const MEDIA = '33d230a7-87d3-40c4-a9fc-e66a3fde1b66';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);

function stubGoogle(mediaRecords: Record<string, unknown>[], driveFiles: { id: string; name: string; size: string }[]) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const url = String(input);
    calls.push(url);
    if (url.startsWith('https://oauth2.googleapis.com/token')) return Response.json({ access_token: 'token', expires_in: 3600 });
    if (url.includes('sheets.googleapis.com')) return Response.json({ values: [['id', 'file_id'], [WORK, 'recordFile']] });
    if (url.includes('/files/recordFile?alt=media')) {
      return Response.json({ row: { id: WORK }, cxlAsset: { previewImages: [`media:${MEDIA}`] }, mediaRecords });
    }
    if (url.includes('/drive/v3/files?q=')) return Response.json({ files: driveFiles });
    if (url.includes('/files/legacyCopy?alt=media')) return new Response(JPEG, { headers: { 'content-type': 'image/jpeg' } });
    return new Response('not found', { status: 404 });
  }));
  return calls;
}

describe('legacy Supabase images copied into Drive', () => {
  beforeEach(() => {
    vi.resetModules();
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    process.env.CXL_GOOGLE_SA_EMAIL = 'reader@example.iam.gserviceaccount.com';
    process.env.CXL_GOOGLE_SA_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    process.env.CXL_PRIVATE_SHEET_ID = 'privateSheet';
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('serves a record without drive_file_id from the Drive copy named after its storage file', async () => {
    const calls = stubGoogle(
      [{ id: MEDIA, storage_path: `user/${WORK}/${MEDIA}.jpg`, mime_type: 'image/jpeg' }],
      [{ id: 'legacyCopy', name: `${MEDIA}.jpg`, size: String(JPEG.length) }]
    );
    const { directWorkMedia } = await import('../../../api/cxl/googleDirect');
    const result = await directWorkMedia(WORK, `media:${MEDIA}`, 'owner', false);
    expect(result?.mimeType).toBe('image/jpeg');
    expect(result?.bytes.equals(JPEG)).toBe(true);
    expect(decodeURIComponent(calls.find(url => url.includes('/drive/v3/files?q='))!)).toContain(`name contains '${MEDIA}.'`);
  });

  it('ignores Drive files whose name only starts with the media ID', async () => {
    stubGoogle(
      [{ id: MEDIA, storage_path: `user/${WORK}/${MEDIA}.jpg` }],
      [{ id: 'legacyCopy', name: `${MEDIA}.jpg.bak.jpg`, size: '9' }, { id: 'legacyCopy', name: `${MEDIA}-x.jpg`, size: '9' }]
    );
    const { directWorkMedia } = await import('../../../api/cxl/googleDirect');
    expect(await directWorkMedia(WORK, `media:${MEDIA}`, 'owner', false)).toBeNull();
  });

  it('never uses a name lookup for new proxy uploads', async () => {
    const calls = stubGoogle([{ id: MEDIA, storage_path: `google-work-media/${MEDIA}` }], [{ id: 'legacyCopy', name: `${MEDIA}.jpg`, size: '9' }]);
    const { directWorkMedia } = await import('../../../api/cxl/googleDirect');
    expect(await directWorkMedia(WORK, `media:${MEDIA}`, 'owner', true)).toBeNull();
    expect(calls.some(url => url.includes('/drive/v3/files?q='))).toBe(false);
  });

  it('points saved Supabase profile image URLs at the Drive-backed route', async () => {
    const { rewriteLegacyProfileImageUrls } = await import('../../../api/cxl/googleDirect');
    const saved = JSON.stringify({ coverUrl: 'https://iqyefjwykydurxtisjap.supabase.co/storage/v1/object/public/profile-media/a7254db7-f89d-4fce-92af-c339846771cc/cover-1788621717440-78bdecf4.png', other: 'https://x.supabase.co/storage/v1/object/public/work-media/a/b.png' });
    expect(JSON.parse(rewriteLegacyProfileImageUrls(saved))).toEqual({
      coverUrl: '/api/cxl/media?profile=cover-1788621717440-78bdecf4.png',
      other: 'https://x.supabase.co/storage/v1/object/public/work-media/a/b.png'
    });
  });

  it('serves a profile cover only by its Supabase-era name pattern', async () => {
    const calls = stubGoogle([], [{ id: 'legacyCopy', name: 'cover-1788621717440-78bdecf4.jpg', size: String(JPEG.length) }]);
    const { directLegacyProfileImage } = await import('../../../api/cxl/googleDirect');
    expect((await directLegacyProfileImage('cover-1788621717440-78bdecf4.jpg'))?.bytes.equals(JPEG)).toBe(true);
    expect(await directLegacyProfileImage(`${MEDIA}.jpg`)).toBeNull();
    expect(await directLegacyProfileImage("cover-1-78bdecf4.jpg' or name contains 'x")).toBeNull();
    expect(calls.filter(url => url.includes('/drive/v3/files?q=')).length).toBe(1);
  });

  it('stores a Drive image in the object store and serves the stored copy next time', async () => {
    const calls = stubGoogle(
      [{ id: MEDIA, storage_path: `user/${WORK}/${MEDIA}.jpg` }],
      [{ id: 'legacyCopy', name: `${MEDIA}.jpg`, size: String(JPEG.length) }]
    );
    const stored = new Map<string, { bytes: Buffer; mimeType: string }>();
    const { setMediaObjectCache } = await import('../../../src/server/mediaObjectCache');
    setMediaObjectCache({ get: async key => stored.get(key) || null, put: async (key, bytes, mimeType) => { stored.set(key, { bytes, mimeType }); } });
    const { directWorkMedia } = await import('../../../api/cxl/googleDirect');
    expect((await directWorkMedia(WORK, `media:${MEDIA}`, 'owner', false))?.bytes.equals(JPEG)).toBe(true);
    expect(stored.get('drive/legacyCopy')).toEqual({ bytes: JPEG, mimeType: 'image/jpeg' });
    const driveDownloads = () => calls.filter(url => url.includes('/files/legacyCopy?alt=media')).length;
    expect(driveDownloads()).toBe(1);
    expect((await directWorkMedia(WORK, `media:${MEDIA}`, 'owner', false))?.bytes.equals(JPEG)).toBe(true);
    expect(driveDownloads()).toBe(1);
  });

  it('falls back to Drive when the stored copy is unusable or the store fails', async () => {
    const calls = stubGoogle(
      [{ id: MEDIA, storage_path: `user/${WORK}/${MEDIA}.jpg` }],
      [{ id: 'legacyCopy', name: `${MEDIA}.jpg`, size: String(JPEG.length) }]
    );
    const { setMediaObjectCache } = await import('../../../src/server/mediaObjectCache');
    setMediaObjectCache({ get: async () => ({ bytes: Buffer.from('not an image'), mimeType: 'image/jpeg' }), put: async () => { throw new Error('R2 down'); } });
    const { directWorkMedia } = await import('../../../api/cxl/googleDirect');
    expect((await directWorkMedia(WORK, `media:${MEDIA}`, 'owner', false))?.bytes.equals(JPEG)).toBe(true);
    expect(calls.filter(url => url.includes('/files/legacyCopy?alt=media')).length).toBe(1);
  });

  it('reads images uploaded straight to R2 from the bucket, never from Drive', async () => {
    const calls = stubGoogle([{ id: MEDIA, drive_file_id: `r2:media/${MEDIA}`, delivery: 'vercel_proxy', asset_id: WORK, mime_type: 'image/jpeg' }], []);
    const { setMediaBucket } = await import('../../../src/server/cxlR2Media');
    setMediaBucket({ get: async key => key === `media/${MEDIA}` ? { bytes: JPEG, contentType: 'image/jpeg' } : null, put: async () => {}, delete: async () => {}, list: async () => ({ keys: [] }) });
    const { directWorkMedia } = await import('../../../api/cxl/googleDirect');
    expect((await directWorkMedia(WORK, `media:${MEDIA}`, 'owner', true))?.bytes.equals(JPEG)).toBe(true);
    expect(calls.some(url => url.includes('alt=media') && !url.includes('recordFile'))).toBe(false);
  });

  it('does not serve an image the Work does not reference', async () => {
    const calls = stubGoogle([], [{ id: 'legacyCopy', name: 'other.jpg', size: '9' }]);
    const { directWorkMedia } = await import('../../../api/cxl/googleDirect');
    expect(await directWorkMedia(WORK, 'media:other', 'owner', false)).toBeNull();
    expect(calls.some(url => url.includes('/drive/v3/files?q='))).toBe(false);
  });
});
