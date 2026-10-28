import { describe, expect, it, vi } from 'vitest';
import { r2ReadOnlyBucketFromEnv, signR2Get } from './r2ReadOnlyBucket';

const env = { CXL_R2_ACCOUNT_ID: 'acct123', CXL_R2_ACCESS_KEY_ID: 'AKIDEXAMPLE', CXL_R2_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY' };
const reply = (status: number, body = '', contentType = '') => ({ ok: status >= 200 && status < 300, status,
  headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType || null : null) },
  arrayBuffer: async () => new TextEncoder().encode(body).buffer as ArrayBuffer });

describe('read-only R2 media over the S3 API', () => {
  it('is off until all three settings are present', () => {
    expect(r2ReadOnlyBucketFromEnv({})).toBeNull();
    expect(r2ReadOnlyBucketFromEnv({ ...env, CXL_R2_SECRET_ACCESS_KEY: ' ' })).toBeNull();
    expect(r2ReadOnlyBucketFromEnv(env)).not.toBeNull();
  });

  it('signs a GET for the object in the cxl-media bucket and returns its bytes and type', async () => {
    const fetchMock = vi.fn(async () => reply(200, 'image-bytes', 'image/webp'));
    const bucket = r2ReadOnlyBucketFromEnv(env, fetchMock)!;
    const object = await bucket.get('media/1f77537d-0000-4000-8000-000000000000');
    expect(object).toEqual({ bytes: Buffer.from('image-bytes'), contentType: 'image/webp' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { method: string; headers: Record<string, string> }];
    expect(url).toBe('https://acct123.r2.cloudflarestorage.com/cxl-media/media/1f77537d-0000-4000-8000-000000000000');
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/auto\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/);
  });

  it('treats 404 as missing and other failures as errors', async () => {
    expect(await r2ReadOnlyBucketFromEnv(env, vi.fn(async () => reply(404)))!.get('upload/x.json')).toBeNull();
    await expect(r2ReadOnlyBucketFromEnv(env, vi.fn(async () => reply(403)))!.get('media/x')).rejects.toThrow('HTTP 403');
  });

  it('never writes, deletes or lists', async () => {
    const bucket = r2ReadOnlyBucketFromEnv(env, vi.fn())!;
    await expect(async () => bucket.put('media/x', 'y', 'text/plain')).rejects.toThrow('read-only');
    await expect(async () => bucket.delete(['media/x'])).rejects.toThrow('read-only');
    await expect(async () => bucket.list('media/')).rejects.toThrow('read-only');
  });

  it('matches a Signature V4 computed separately in Python (hashlib/hmac)', () => {
    // AWS's documented GET example inputs, with region "auto" and an unsigned payload.
    const headers = signR2Get('examplebucket.s3.amazonaws.com', '/test.txt', 'AKIAIOSFODNN7EXAMPLE', 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', new Date('2013-05-24T00:00:00Z'));
    expect(headers['x-amz-date']).toBe('20130524T000000Z');
    expect(headers.Authorization).toBe('AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/auto/s3/aws4_request, '
      + 'SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=0705757e0d69357eff9905b8278a66f3014f942659728cafeed0470dff5215e5');
  });
});
