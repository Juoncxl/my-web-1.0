import type { CreatorWorkDraft } from '../components/creator/CreatorWorkWorkspace';
import { dataUrlToBlob, isInlineMediaUrl } from './workMedia';

const DATABASE_NAME = 'cxl-composer-drafts';
const DATABASE_VERSION = 1;
const DRAFT_STORE = 'drafts';
const BLOB_STORE = 'blobs';
const LOCAL_BLOB_PREFIX = 'local-media:';

export interface StoredComposerDraft {
  key: string;
  savedAt: string;
  serverUpdatedAt?: string;
  draft: CreatorWorkDraft;
  blobKeys: string[];
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('เบราว์เซอร์นี้ไม่รองรับการกู้ฉบับร่าง'));
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DRAFT_STORE)) db.createObjectStore(DRAFT_STORE, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(BLOB_STORE)) db.createObjectStore(BLOB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('เปิดพื้นที่ฉบับร่างไม่สำเร็จ'));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('จัดการฉบับร่างไม่สำเร็จ'));
  });
}

async function inlineUrlToBlob(value: string): Promise<Blob> {
  if (value.startsWith('data:')) return dataUrlToBlob(value);
  const response = await fetch(value);
  if (!response.ok) throw new Error('อ่านรูปในฉบับร่างไม่สำเร็จ');
  return response.blob();
}

export async function saveComposerDraft(key: string, draft: CreatorWorkDraft, serverUpdatedAt?: string): Promise<void> {
  const db = await openDatabase();
  const metadata = JSON.parse(JSON.stringify(draft)) as CreatorWorkDraft;
  const blobs = new Map<string, Blob>();
  let sequence = 0;

  const extract = async (value: unknown): Promise<unknown> => {
    if (isInlineMediaUrl(value)) {
      const blobKey = `${key}:${Date.now()}:${sequence++}`;
      blobs.set(blobKey, await inlineUrlToBlob(value));
      return `${LOCAL_BLOB_PREFIX}${blobKey}`;
    }
    if (Array.isArray(value)) return Promise.all(value.map(extract));
    if (value && typeof value === 'object') {
      const output: Record<string, unknown> = {};
      for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) output[childKey] = await extract(child);
      return output;
    }
    return value;
  };

  const safeDraft = await extract(metadata) as CreatorWorkDraft;
  const previous = await requestResult(db.transaction(DRAFT_STORE, 'readonly').objectStore(DRAFT_STORE).get(key)) as StoredComposerDraft | undefined;
  const transaction = db.transaction([DRAFT_STORE, BLOB_STORE], 'readwrite');
  const draftStore = transaction.objectStore(DRAFT_STORE);
  const blobStore = transaction.objectStore(BLOB_STORE);
  for (const [blobKey, blob] of blobs) blobStore.put(blob, blobKey);
  draftStore.put({ key, savedAt: new Date().toISOString(), serverUpdatedAt, draft: safeDraft, blobKeys: [...blobs.keys()] } satisfies StoredComposerDraft);
  (previous?.blobKeys || []).filter(oldKey => !blobs.has(oldKey)).forEach(oldKey => blobStore.delete(oldKey));
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('บันทึกฉบับร่างไม่สำเร็จ'));
    transaction.onabort = () => reject(transaction.error || new Error('พื้นที่เก็บฉบับร่างไม่เพียงพอ'));
  });
  db.close();
}

export async function loadComposerDraft(key: string): Promise<StoredComposerDraft | null> {
  const db = await openDatabase();
  const stored = await requestResult(db.transaction(DRAFT_STORE, 'readonly').objectStore(DRAFT_STORE).get(key)) as StoredComposerDraft | undefined;
  if (!stored) { db.close(); return null; }
  const transaction = db.transaction(BLOB_STORE, 'readonly');
  const blobStore = transaction.objectStore(BLOB_STORE);
  const blobValues = await Promise.all(stored.blobKeys.map(blobKey => requestResult(blobStore.get(blobKey)) as Promise<Blob | undefined>));
  const blobs = new Map(stored.blobKeys.map((blobKey, index) => [blobKey, blobValues[index]]));
  const restore = (value: unknown): unknown => {
    if (typeof value === 'string' && value.startsWith(LOCAL_BLOB_PREFIX)) {
      const blobKey = value.slice(LOCAL_BLOB_PREFIX.length);
      const blob = blobs.get(blobKey);
      return blob ? URL.createObjectURL(blob) : '';
    }
    if (Array.isArray(value)) return value.map(restore);
    if (value && typeof value === 'object') {
      const output: Record<string, unknown> = {};
      for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) output[childKey] = restore(child);
      return output;
    }
    return value;
  };
  const draft = restore(stored.draft) as CreatorWorkDraft;
  db.close();
  return { ...stored, draft };
}

export async function deleteComposerDraft(key: string): Promise<void> {
  const db = await openDatabase();
  const stored = await requestResult(db.transaction(DRAFT_STORE, 'readonly').objectStore(DRAFT_STORE).get(key)) as StoredComposerDraft | undefined;
  const transaction = db.transaction([DRAFT_STORE, BLOB_STORE], 'readwrite');
  const draftStore = transaction.objectStore(DRAFT_STORE);
  (stored?.blobKeys || []).forEach(blobKey => transaction.objectStore(BLOB_STORE).delete(blobKey));
  draftStore.delete(key);
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('ลบฉบับร่างไม่สำเร็จ'));
  });
  db.close();
}

export function composerDraftKey(userId: string, assetId?: string | null): string {
  return assetId ? `edit:${userId}:${assetId}` : `new:${userId}`;
}
