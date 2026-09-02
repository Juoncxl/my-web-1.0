import type { Asset } from '../types';

const DB_NAME = 'cxl_creator_space_qa_work_icons_v1';
const DB_VERSION = 1;
const STORE_NAME = 'work-icons';
const KEY_PREFIX = 'work-icon:';
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

type StoredWorkIcon = {
  key: string;
  assetId: string;
  blob: Blob;
  mimeType: string;
  updatedAt: string;
};

const memoryIcons = new Map<string, StoredWorkIcon>();
const objectUrls = new Map<string, string>();
let databasePromise: Promise<IDBDatabase> | null = null;

function canUseIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function makeKey(assetId: string): string {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${KEY_PREFIX}${encodeURIComponent(assetId)}:${suffix}`;
}

function openDatabase(): Promise<IDBDatabase> {
  if (!canUseIndexedDb()) return Promise.reject(new Error('IndexedDB ไม่พร้อมใช้งานในเบราว์เซอร์นี้'));
  if (databasePromise) return databasePromise;
  const requestPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error || new Error('เปิดพื้นที่จัดเก็บ Work Icon QA ไม่สำเร็จ'));
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

async function readStoredIcon(key: string): Promise<StoredWorkIcon | null> {
  if (!canUseIndexedDb()) return memoryIcons.get(key) || null;
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
    request.onerror = () => reject(request.error || new Error('อ่าน Work Icon QA ไม่สำเร็จ'));
    request.onsuccess = () => resolve((request.result as StoredWorkIcon | undefined) || null);
  });
}

async function putStoredIcon(icon: StoredWorkIcon): Promise<void> {
  if (!canUseIndexedDb()) {
    memoryIcons.set(icon.key, icon);
    return;
  }
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(icon);
    request.onerror = () => reject(request.error || new Error('บันทึก Work Icon QA ไม่สำเร็จ'));
    request.onsuccess = () => resolve();
  });
}

async function deleteStoredIcon(key: string): Promise<void> {
  if (!canUseIndexedDb()) {
    memoryIcons.delete(key);
    return;
  }
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(key);
    request.onerror = () => reject(request.error || new Error('ลบ Work Icon QA ไม่สำเร็จ'));
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
  if (typeof URL.createObjectURL !== 'function') throw new Error('เบราว์เซอร์ไม่รองรับการแสดง Work Icon QA');
  const url = URL.createObjectURL(blob);
  objectUrls.set(key, url);
  return url;
}

export function isQaWorkIconKeyForAsset(key: string | undefined, assetId: string): boolean {
  return Boolean(key?.startsWith(`${KEY_PREFIX}${encodeURIComponent(assetId)}:`));
}

export function dataUrlToQaWorkIconBlob(value: string): Blob | null {
  const match = value.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match || !SUPPORTED_IMAGE_TYPES.has(match[1])) return null;
  try {
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: match[1] });
  } catch {
    return null;
  }
}

export async function saveQaWorkIcon(options: { assetId: string; blob: Blob }): Promise<{ key: string; url: string; mimeType: string }> {
  if (!options.assetId) throw new Error('ไม่พบ Work สำหรับบันทึกไอคอน');
  if (!(options.blob instanceof Blob) || options.blob.size <= 0 || !SUPPORTED_IMAGE_TYPES.has(options.blob.type)) {
    throw new Error('ไฟล์ Work Icon ต้องเป็น JPG, PNG, WEBP หรือ GIF ที่ถูกต้อง');
  }
  const key = makeKey(options.assetId);
  const icon: StoredWorkIcon = { key, assetId: options.assetId, blob: options.blob, mimeType: options.blob.type, updatedAt: new Date().toISOString() };
  await putStoredIcon(icon);
  try {
    return { key, url: createObjectUrl(key, icon.blob), mimeType: icon.mimeType };
  } catch (error) {
    try { await deleteStoredIcon(key); } catch { /* preserve the original presentation error */ }
    throw error;
  }
}

export async function getQaWorkIcon(key: string): Promise<StoredWorkIcon | null> {
  return readStoredIcon(key);
}

export async function getQaWorkIconUrl(key: string): Promise<{ url: string; mimeType: string } | null> {
  const icon = await readStoredIcon(key);
  return icon ? { url: createObjectUrl(key, icon.blob), mimeType: icon.mimeType } : null;
}

export async function deleteQaWorkIcon(key: string): Promise<void> {
  await deleteStoredIcon(key);
  revokeObjectUrl(key);
}

export async function hydrateQaWorkIcons(assets: Asset[]): Promise<Asset[]> {
  return Promise.all(assets.map(async asset => {
    const icon = asset.icon;
    if (icon.type !== 'image' || !icon.storageKey) return asset;
    try {
      const hydrated = await getQaWorkIconUrl(icon.storageKey);
      if (!hydrated) {
        return {
          ...asset,
          icon: { ...icon, value: icon.value.startsWith('blob:') ? '' : icon.value, storageKey: undefined }
        };
      }
      return { ...asset, icon: { ...icon, value: hydrated.url, mimeType: icon.mimeType || hydrated.mimeType } };
    } catch {
      // Keep a data/remote fallback URL intact if browser binary storage is temporarily unavailable.
      return asset;
    }
  }));
}
