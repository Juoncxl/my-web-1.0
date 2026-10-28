import { createHash, createHmac } from 'node:crypto';
import type { MediaBucket } from './cxlR2Media.js';

/**
 * Read-only access to the Cloudflare R2 media bucket from hosts outside Cloudflare (Render).
 *
 * Works uploaded since R2 became the upload target keep their images only in R2, so a backup
 * host reads them over R2's S3-compatible API with an access key limited to Object Read.
 * Settings: CXL_R2_ACCOUNT_ID, CXL_R2_ACCESS_KEY_ID, CXL_R2_SECRET_ACCESS_KEY and optional
 * CXL_R2_BUCKET (default cxl-media). Writes throw: the backup host never changes R2.
 */

type Env = Record<string, string | undefined>;
type Fetch = (input: string, init: { method: string; headers: Record<string, string>; signal?: AbortSignal }) => Promise<{
  ok: boolean; status: number; headers: { get(name: string): string | null }; arrayBuffer(): Promise<ArrayBuffer>;
}>;

const REGION = 'auto';
const SERVICE = 's3';
const TIMEOUT_MS = 20_000;
const UNSIGNED = 'UNSIGNED-PAYLOAD';

const sha256Hex = (value: string) => createHash('sha256').update(value).digest('hex');
const hmac = (key: Buffer | string, value: string) => createHmac('sha256', key).update(value).digest();
// S3 canonical URIs encode everything except unreserved characters, segment by segment.
const encodeSegment = (segment: string) => encodeURIComponent(segment).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** AWS Signature V4 headers for an unsigned-payload GET of host + path. */
export function signR2Get(host: string, path: string, accessKeyId: string, secretAccessKey: string, now = new Date()): Record<string, string> {
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const date = amzDate.slice(0, 8);
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = ['GET', path, '', `host:${host}`, `x-amz-content-sha256:${UNSIGNED}`, `x-amz-date:${amzDate}`, '', signedHeaders, UNSIGNED].join('\n');
  const scope = `${date}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, date), REGION), SERVICE), 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  return {
    'x-amz-content-sha256': UNSIGNED,
    'x-amz-date': amzDate,
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  };
}

const readOnly = () => { throw new Error('R2 media is read-only on this host'); };

/** The R2 media bucket over the S3 API, or null when the settings are missing. */
export function r2ReadOnlyBucketFromEnv(env: Env = process.env, fetchImpl: Fetch = fetch as unknown as Fetch): MediaBucket | null {
  const accountId = env.CXL_R2_ACCOUNT_ID?.trim() || '';
  const accessKeyId = env.CXL_R2_ACCESS_KEY_ID?.trim() || '';
  const secretAccessKey = env.CXL_R2_SECRET_ACCESS_KEY?.trim() || '';
  const bucketName = env.CXL_R2_BUCKET?.trim() || 'cxl-media';
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  const host = `${accountId}.r2.cloudflarestorage.com`;

  return {
    async get(key) {
      const path = '/' + [bucketName, ...key.split('/')].map(encodeSegment).join('/');
      const response = await fetchImpl(`https://${host}${path}`, {
        method: 'GET',
        headers: signR2Get(host, path, accessKeyId, secretAccessKey),
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`R2 read failed: HTTP ${response.status}`);
      return { bytes: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get('content-type') || '' };
    },
    put: readOnly,
    delete: readOnly,
    list: readOnly
  };
}
