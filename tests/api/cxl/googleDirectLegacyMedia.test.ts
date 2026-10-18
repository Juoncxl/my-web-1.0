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

  it('does not serve an image the Work does not reference', async () => {
    const calls = stubGoogle([], [{ id: 'legacyCopy', name: 'other.jpg', size: '9' }]);
    const { directWorkMedia } = await import('../../../api/cxl/googleDirect');
    expect(await directWorkMedia(WORK, 'media:other', 'owner', false)).toBeNull();
    expect(calls.some(url => url.includes('/drive/v3/files?q='))).toBe(false);
  });
});
