import type { Asset } from '../types';

const DB_NAME = 'cxl_creator_space_qa_work_payloads_v1';
const DB_VERSION = 1;
const STORE_NAME = 'work-payloads';
const KEY_PREFIX = 'work-payload:';

type StoredPayload = {
  key: string;
  assetId: string;
  payload: {
    content: string;
    contentBlocks: NonNullable<Asset['contentBlocks']>;
    uiCodeSnippet?: string;
    previewImage?: string;
    previewImages?: string[];
    collaboration?: Asset['collaboration'];
    publicCollaboration?: Asset['publicCollaboration'];
  };
  updatedAt: string;
};

const memoryPayloads = new Map<string, StoredPayload>();
let databasePromise: Promise<IDBDatabase> | null = null;

function canUseIndexedDb(): boolean { return typeof indexedDB !== 'undefined'; }

function makeKey(assetId: string): string {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${KEY_PREFIX}${encodeURIComponent(assetId)}:${suffix}`;
}

function openDatabase(): Promise<IDBDatabase> {
  if (!canUseIndexedDb()) return Promise.reject(new Error('IndexedDB ไม่พร้อมใช้งานในเบราว์เซอร์นี้'));
  if (databasePromise) return databasePromise;
  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error || new Error('เปิดพื้นที่จัดเก็บ Work QA ไม่สำเร็จ'));
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
  }).then(value => value, error => { databasePromise = null; throw error; });
  return databasePromise;
}

async function putStoredPayload(value: StoredPayload): Promise<void> {
  if (!canUseIndexedDb()) { memoryPayloads.set(value.key, value); return; }
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(value);
    request.onerror = () => reject(request.error || new Error('บันทึกข้อมูล Work QA ไม่สำเร็จ'));
    request.onsuccess = () => resolve();
  });
}

async function getStoredPayload(key: string): Promise<StoredPayload | null> {
  if (!canUseIndexedDb()) return memoryPayloads.get(key) || null;
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
    request.onerror = () => reject(request.error || new Error('อ่านข้อมูล Work QA ไม่สำเร็จ'));
    request.onsuccess = () => resolve((request.result as StoredPayload | undefined) || null);
  });
}

async function deleteStoredPayload(key: string): Promise<void> {
  if (!canUseIndexedDb()) { memoryPayloads.delete(key); return; }
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(key);
    request.onerror = () => reject(request.error || new Error('ลบข้อมูล Work QA ไม่สำเร็จ'));
    request.onsuccess = () => resolve();
  });
}

export function isQaWorkPayloadKey(key: string | undefined): boolean { return Boolean(key?.startsWith(KEY_PREFIX)); }

function structuredCloneSafe<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

export function getQaWorkPayload(asset: Asset): StoredPayload['payload'] {
  return {
    content: asset.content || '',
    contentBlocks: (asset.contentBlocks || []).map(block => ({ ...block })),
    uiCodeSnippet: asset.uiCodeSnippet || '',
    previewImage: asset.previewImage || '',
    previewImages: [...(asset.previewImages || [])],
    collaboration: asset.collaboration ? structuredCloneSafe(asset.collaboration) : null,
    publicCollaboration: asset.publicCollaboration ? structuredCloneSafe(asset.publicCollaboration) : null
  };
}

export function stripQaWorkPayload(asset: Asset, key: string): Asset {
  return { ...asset, qaStorageKey: key, content: '', contentBlocks: [], uiCodeSnippet: '', previewImage: '', previewImages: [], collaboration: null, publicCollaboration: null };
}

export async function saveQaWorkPayload(options: { assetId: string; asset: Asset }): Promise<{ key: string }> {
  if (!options.assetId) throw new Error('ไม่พบ Work สำหรับบันทึกข้อมูล');
  const key = makeKey(options.assetId);
  await putStoredPayload({ key, assetId: options.assetId, payload: getQaWorkPayload(options.asset), updatedAt: new Date().toISOString() });
  return { key };
}

export async function deleteQaWorkPayload(key: string | undefined): Promise<void> {
  if (key && isQaWorkPayloadKey(key)) await deleteStoredPayload(key);
}

export async function hydrateQaWorkPayloads(assets: Asset[]): Promise<Asset[]> {
  return Promise.all(assets.map(async asset => {
    if (!asset.qaStorageKey) return asset;
    try {
      const stored = await getStoredPayload(asset.qaStorageKey);
      if (!stored) return asset;
      return { ...asset, content: stored.payload.content, contentBlocks: stored.payload.contentBlocks, uiCodeSnippet: stored.payload.uiCodeSnippet, previewImage: stored.payload.previewImage, previewImages: stored.payload.previewImages, collaboration: stored.payload.collaboration, publicCollaboration: stored.payload.publicCollaboration };
    } catch { return asset; }
  }));
}
