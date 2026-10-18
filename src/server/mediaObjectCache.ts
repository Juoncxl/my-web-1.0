/**
 * Optional object store (Cloudflare R2 on Workers) that keeps a copy of every Drive
 * image the API serves, keyed by Drive file ID. Drive stays the source of truth: a
 * missing copy is read from Drive and stored here, and any store failure falls back
 * to Drive. Hosts without a store (Vercel, Render, tests) leave it unset.
 */
export interface MediaObjectCache {
  get(key: string): Promise<{ bytes: Buffer; mimeType: string } | null>;
  put(key: string, bytes: Buffer, mimeType: string): Promise<void>;
}

let cache: MediaObjectCache | null = null;

export function setMediaObjectCache(next: MediaObjectCache | null): void {
  cache = next;
}

export function mediaObjectCache(): MediaObjectCache | null {
  return cache;
}

/** Object key for a Drive file; Drive file IDs never change for a file's lifetime. */
export function driveMediaKey(fileId: string): string {
  return `drive/${fileId}`;
}
