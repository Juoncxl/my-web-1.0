import type { User } from '../types';
import { replaceMockProfileSnapshot } from './creatorPersistence';

export type QaProfileImageKind = 'avatar' | 'cover';

export interface QaProfileImageSaveResult {
  key: string;
  url: string;
  previousBlob: Blob | null;
}

const DB_NAME = 'cxl_creator_space_qa_images_v1';
const DB_VERSION = 1;
const STORE_NAME = 'profile-images';
const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_PROFILE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

type StoredImage = { key: string; ownerId: string; kind: QaProfileImageKind; blob: Blob; updatedAt: string };

const memoryImages = new Map<string, StoredImage>();
const objectUrls = new Map<string, string>();
let databasePromise: Promise<IDBDatabase> | null = null;

export function profileImageKey(ownerId: string, kind: QaProfileImageKind): string {
  return `${ownerId}:${kind}`;
}

export function validateQaProfileImage(file: Pick<File, 'size' | 'type'>): string | null {
  if (!SUPPORTED_PROFILE_IMAGE_TYPES.has(file.type)) return 'รองรับเฉพาะไฟล์ JPG, PNG, WEBP หรือ GIF';
  if (file.size <= 0 || file.size > MAX_PROFILE_IMAGE_BYTES) return 'ขนาดไฟล์ต้องไม่เกิน 5MB';
  return null;
}

function canUseIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase> {
  if (!canUseIndexedDb()) return Promise.reject(new Error('IndexedDB ไม่พร้อมใช้งานในเบราว์เซอร์นี้'));
  if (databasePromise) return databasePromise;
  const requestPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error || new Error('เปิดพื้นที่จัดเก็บรูปภาพ QA ไม่สำเร็จ'));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
  });
  databasePromise = requestPromise.then(value => value, error => {
    databasePromise = null;
    throw error;
  });
  return databasePromise;
}

async function readStoredImage(key: string): Promise<StoredImage | null> {
  if (!canUseIndexedDb()) return memoryImages.get(key) || null;
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
    request.onerror = () => reject(request.error || new Error('อ่านรูปภาพ QA ไม่สำเร็จ'));
    request.onsuccess = () => resolve((request.result as StoredImage | undefined) || null);
  });
}

async function putStoredImage(image: StoredImage): Promise<void> {
  if (!canUseIndexedDb()) {
    memoryImages.set(image.key, image);
    return;
  }
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(image);
    request.onerror = () => reject(request.error || new Error('บันทึกรูปภาพ QA ไม่สำเร็จ'));
    request.onsuccess = () => resolve();
  });
}

async function deleteStoredImage(key: string): Promise<void> {
  if (!canUseIndexedDb()) {
    memoryImages.delete(key);
    return;
  }
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(key);
    request.onerror = () => reject(request.error || new Error('ลบรูปภาพ QA ไม่สำเร็จ'));
    request.onsuccess = () => resolve();
  });
}

function revokeObjectUrl(key: string): void {
  const url = objectUrls.get(key);
  if (!url) return;
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
  objectUrls.delete(key);
}

function createObjectUrl(key: string, blob: Blob): string {
  const existing = objectUrls.get(key);
  if (existing) return existing;
  if (typeof URL.createObjectURL !== 'function') throw new Error('เบราว์เซอร์ไม่รองรับการแสดงตัวอย่างรูปภาพ QA');
  const url = URL.createObjectURL(blob);
  objectUrls.set(key, url);
  return url;
}

export async function saveQaProfileImage(options: {
  ownerId: string;
  kind: QaProfileImageKind;
  blob: Blob;
}): Promise<QaProfileImageSaveResult> {
  if (!options.ownerId) throw new Error('ไม่พบเจ้าของรูปภาพ QA');
  if (typeof Blob === 'undefined' || !(options.blob instanceof Blob) || options.blob.size <= 0) throw new Error('ข้อมูลรูปภาพ QA ไม่ถูกต้อง');
  const key = profileImageKey(options.ownerId, options.kind);
  const previous = await readStoredImage(key);
  const image: StoredImage = {
    key,
    ownerId: options.ownerId,
    kind: options.kind,
    blob: options.blob,
    updatedAt: new Date().toISOString()
  };
  try {
    await putStoredImage(image);
  } catch (error) {
    throw error;
  }
  revokeObjectUrl(key);
  try {
    return { key, url: createObjectUrl(key, options.blob), previousBlob: previous?.blob || null };
  } catch (error) {
    try {
      if (previous) await putStoredImage(previous);
      else await deleteStoredImage(key);
    } catch {
      // Preserve the original object URL error; the next hydration will
      // surface the underlying browser storage state for recovery.
    }
    throw error;
  }
}

export async function getQaProfileImage(options: { ownerId: string; kind: QaProfileImageKind }): Promise<Blob | null> {
  if (!options.ownerId) return null;
  const image = await readStoredImage(profileImageKey(options.ownerId, options.kind));
  return image?.ownerId === options.ownerId && image.kind === options.kind ? image.blob : null;
}

export async function getQaProfileImageUrl(options: { ownerId: string; kind: QaProfileImageKind }): Promise<string | null> {
  const key = profileImageKey(options.ownerId, options.kind);
  const blob = await getQaProfileImage(options);
  return blob ? createObjectUrl(key, blob) : null;
}

export async function deleteQaProfileImage(options: { ownerId: string; kind: QaProfileImageKind }): Promise<void> {
  const key = profileImageKey(options.ownerId, options.kind);
  await deleteStoredImage(key);
  revokeObjectUrl(key);
}

export async function restoreQaProfileImage(options: { ownerId: string; kind: QaProfileImageKind; blob: Blob | null }): Promise<void> {
  const key = profileImageKey(options.ownerId, options.kind);
  if (!options.blob) {
    await deleteStoredImage(key);
    revokeObjectUrl(key);
    return;
  }
  await putStoredImage({ key, ownerId: options.ownerId, kind: options.kind, blob: options.blob, updatedAt: new Date().toISOString() });
  revokeObjectUrl(key);
}

function dataUrlToBlob(value: string): Blob | null {
  const match = value.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match || !SUPPORTED_PROFILE_IMAGE_TYPES.has(match[1])) return null;
  try {
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: match[1] });
  } catch {
    return null;
  }
}

export async function hydrateQaProfileImages(profile: User): Promise<User> {
  if (!profile.id) return profile;
  let next = profile;
  let changed = false;
  for (const kind of ['avatar', 'cover'] as const) {
    const urlField = kind === 'avatar' ? 'avatarUrl' : 'coverUrl';
    const keyField = kind === 'avatar' ? 'avatarImageKey' : 'coverImageKey';
    const existingKey = profile[keyField];
    if (existingKey && existingKey !== profileImageKey(profile.id, kind)) continue;
    if (existingKey) {
      try {
        const url = await getQaProfileImageUrl({ ownerId: profile.id, kind });
        if (url && next[urlField] !== url) {
          next = { ...next, [urlField]: url };
          changed = true;
        } else if (!url) {
          // A missing Blob means this reference is stale (for example after a
          // user cleared site data). Remove only the broken key and retain a
          // non-runtime fallback URL, if one exists. Storage read failures
          // throw and are deliberately left untouched for a later retry.
          const fallbackUrl = profile[urlField] && !isQaObjectUrl(profile[urlField]) && !profile[urlField].startsWith('data:')
            ? profile[urlField]
            : undefined;
          next = { ...next, [keyField]: undefined, [urlField]: fallbackUrl };
          changed = true;
        }
      } catch {
        // Image hydration is optional presentation data; keep the canonical
        // Profile identity even if the browser image store is unavailable.
      }
      continue;
    }
    if (!profile[urlField]?.startsWith('data:')) continue;
    const blob = dataUrlToBlob(profile[urlField]);
    if (!blob) continue;
    try {
      const saved = await saveQaProfileImage({ ownerId: profile.id, kind, blob });
      next = { ...next, [urlField]: saved.url, [keyField]: saved.key };
      changed = true;
    } catch {
      // Never let legacy image migration break Profile text/identity reads.
    }
  }
  if (changed && (next.avatarImageKey !== profile.avatarImageKey || next.coverImageKey !== profile.coverImageKey)) {
    replaceMockProfileSnapshot({
      ...next,
      avatarUrl: next.avatarImageKey ? undefined : next.avatarUrl,
      coverUrl: next.coverImageKey ? undefined : next.coverUrl
    });
  }
  return changed ? next : profile;
}

export function isQaObjectUrl(value?: string | null): boolean {
  return Boolean(value?.startsWith('blob:'));
}

export function getQaProfileImageStorageLimits(): { maxBytes: number; types: readonly string[] } {
  return { maxBytes: MAX_PROFILE_IMAGE_BYTES, types: [...SUPPORTED_PROFILE_IMAGE_TYPES] };
}
